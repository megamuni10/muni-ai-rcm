"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
class DatabaseStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // KMS key for encryption
        this.kmsKey = new kms.Key(this, 'MuniRcmEncryptionKey', {
            description: 'KMS key for Muni Health RCM platform encryption',
            enableKeyRotation: true,
            keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
            keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
        });
        // S3 bucket for PHI-safe storage
        this.s3Bucket = new s3.Bucket(this, 'MuniRcmDataBucket', {
            bucketName: `muni-rcm-data-${this.account}-${this.region}`,
            // HIPAA compliance settings
            encryption: s3.BucketEncryption.KMS,
            encryptionKey: this.kmsKey,
            versioned: true,
            // Block all public access
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            // Lifecycle rules
            lifecycleRules: [
                {
                    id: 'DeleteOldVersions',
                    enabled: true,
                    noncurrentVersionExpiration: cdk.Duration.days(90),
                },
                {
                    id: 'TransitionToIA',
                    enabled: true,
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30),
                        },
                        {
                            storageClass: s3.StorageClass.GLACIER,
                            transitionAfter: cdk.Duration.days(90),
                        },
                    ],
                },
            ],
            // Server access logging
            serverAccessLogsBucket: new s3.Bucket(this, 'MuniRcmAccessLogsBucket', {
                bucketName: `muni-rcm-access-logs-${this.account}-${this.region}`,
                encryption: s3.BucketEncryption.S3_MANAGED,
                blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
                lifecycleRules: [
                    {
                        id: 'DeleteAccessLogs',
                        enabled: true,
                        expiration: cdk.Duration.days(365),
                    },
                ],
            }),
            serverAccessLogsPrefix: 'access-logs/',
            // Notification configuration for important events
            eventBridgeEnabled: true,
        });
        // Database subnet group
        const dbSubnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
            vpc: props.vpc,
            description: 'Subnet group for RDS PostgreSQL database',
            vpcSubnets: { subnets: props.vpc.isolatedSubnets },
        });
        // Database parameter group for optimization
        const parameterGroup = new rds.ParameterGroup(this, 'DatabaseParameterGroup', {
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_15,
            }),
            description: 'Parameter group for Muni RCM PostgreSQL database',
            parameters: {
                'shared_preload_libraries': 'pg_stat_statements',
                'log_statement': 'all',
                'log_min_duration_statement': '1000',
                'max_connections': '200',
            },
        });
        // RDS PostgreSQL database
        this.database = new rds.DatabaseInstance(this, 'MuniRcmDatabase', {
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_15,
            }),
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            // Database configuration
            databaseName: 'muni_rcm',
            credentials: rds.Credentials.fromGeneratedSecret('postgres', {}),
            // Storage configuration
            allocatedStorage: 20,
            maxAllocatedStorage: 100,
            storageType: rds.StorageType.GP2,
            storageEncrypted: true,
            storageEncryptionKey: this.kmsKey,
            // Network configuration
            vpc: props.vpc,
            subnetGroup: dbSubnetGroup,
            securityGroups: [
                ec2.SecurityGroup.fromSecurityGroupId(this, 'DatabaseSecurityGroup', cdk.Fn.importValue('MuniRcm-DatabaseSecurityGroup')),
            ],
            // High availability and backup
            multiAz: false,
            backupRetention: cdk.Duration.days(7),
            deleteAutomatedBackups: false,
            deletionProtection: true,
            // Monitoring
            monitoringInterval: cdk.Duration.minutes(1),
            enablePerformanceInsights: true,
            performanceInsightRetention: rds.PerformanceInsightRetention.MONTHS_1,
            performanceInsightEncryptionKey: this.kmsKey,
            // Maintenance
            autoMinorVersionUpgrade: true,
            preferredBackupWindow: '03:00-04:00',
            preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
            // Parameter group
            parameterGroup,
        });
        // Output database connection info for use by migration scripts
        new cdk.CfnOutput(this, 'DatabaseSecretArn', {
            value: this.database.secret?.secretArn || '',
            description: 'Secret ARN for database credentials',
            exportName: 'MuniRcm-DatabaseSecretArn',
        });
        // Outputs
        new cdk.CfnOutput(this, 'DatabaseEndpoint', {
            value: this.database.instanceEndpoint.hostname,
            description: 'RDS PostgreSQL database endpoint',
            exportName: 'MuniRcm-DatabaseEndpoint',
        });
        new cdk.CfnOutput(this, 'S3BucketName', {
            value: this.s3Bucket.bucketName,
            description: 'S3 bucket for PHI-safe storage',
            exportName: 'MuniRcm-S3Bucket',
        });
        new cdk.CfnOutput(this, 'KmsKeyId', {
            value: this.kmsKey.keyId,
            description: 'KMS key for encryption',
            exportName: 'MuniRcm-KmsKey',
        });
    }
}
exports.DatabaseStack = DatabaseStack;
//# sourceMappingURL=database-stack.js.map