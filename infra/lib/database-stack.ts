import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance;
  public readonly s3Bucket: s3.Bucket;
  public readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
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
      subnets: props.vpc.isolatedSubnets,
    });

    // Database parameter group for optimization
    const parameterGroup = new rds.ParameterGroup(this, 'DatabaseParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      description: 'Parameter group for Muni RCM PostgreSQL database',
      parameters: {
        'shared_preload_libraries': 'pg_stat_statements',
        'log_statement': 'all',
        'log_min_duration_statement': '1000', // Log slow queries
        'max_connections': '200',
      },
    });

    // RDS PostgreSQL database
    this.database = new rds.DatabaseInstance(this, 'MuniRcmDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      
      // Database configuration
      databaseName: 'muni_rcm',
      credentials: rds.Credentials.fromGeneratedSecret('rcm_admin', {
        description: 'RDS credentials for Muni RCM database',
        excludeCharacters: '"@/\\\'',
        secretName: 'muni-rcm/rds-credentials',
      }),

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
        ec2.SecurityGroup.fromSecurityGroupId(
          this,
          'DatabaseSecurityGroup',
          cdk.Fn.importValue('MuniRcm-DatabaseSecurityGroup')
        ),
      ],

      // High availability and backup
      multiAz: false, // Enable for production
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

    // Create initial database schema (Lambda function)
    const schemaInitFunction = new cdk.aws_lambda.Function(this, 'SchemaInitFunction', {
      runtime: cdk.aws_lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: cdk.aws_lambda.Code.fromInline(`
import json
import psycopg2
import boto3

def handler(event, context):
    # Get database credentials from Secrets Manager
    secrets_client = boto3.client('secretsmanager')
    secret_value = secrets_client.get_secret_value(SecretId='muni-rcm/rds-credentials')
    db_credentials = json.loads(secret_value['SecretString'])
    
    # Connect to database
    conn = psycopg2.connect(
        host=event['host'],
        database=event['database'],
        user=db_credentials['username'],
        password=db_credentials['password'],
        port=5432
    )
    
    # Create tables
    with conn.cursor() as cur:
        # Agent runs table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS agent_runs (
                id SERIAL PRIMARY KEY,
                agent_name VARCHAR(100) NOT NULL,
                input_data JSONB,
                output_data JSONB,
                error_message TEXT,
                status VARCHAR(50) NOT NULL,
                patient_id VARCHAR(100),
                claim_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        
        # Claims table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS claims (
                id SERIAL PRIMARY KEY,
                claim_id VARCHAR(100) UNIQUE NOT NULL,
                patient_id VARCHAR(100) NOT NULL,
                provider_id VARCHAR(100),
                payer_id VARCHAR(100),
                status VARCHAR(50) NOT NULL,
                total_amount DECIMAL(10,2),
                paid_amount DECIMAL(10,2) DEFAULT 0,
                submission_date TIMESTAMP,
                payment_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        
        # Patients table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS patients (
                id SERIAL PRIMARY KEY,
                patient_id VARCHAR(100) UNIQUE NOT NULL,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                date_of_birth DATE,
                insurance_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
    
    conn.commit()
    conn.close()
    
    return {'statusCode': 200, 'body': 'Schema initialized successfully'}
      `),
      vpc: props.vpc,
      environment: {
        DB_HOST: this.database.instanceEndpoint.hostname,
        DB_NAME: 'muni_rcm',
      },
    });

    // Grant permissions to schema init function
    this.database.secret?.grantRead(schemaInitFunction);

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