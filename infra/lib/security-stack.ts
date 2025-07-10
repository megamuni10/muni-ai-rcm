import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class SecurityStack extends cdk.Stack {
  public readonly kmsKey: kms.Key;
  public readonly amplifyServiceRole: iam.Role;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // KMS key for application-wide encryption
    this.kmsKey = new kms.Key(this, 'MuniRcmMasterKey', {
      description: 'Master KMS key for Muni Health RCM platform',
      enableKeyRotation: true,
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      alias: 'muni-rcm-master-key',
    });

    // IAM role for Amplify frontend to invoke Lambda agents
    this.amplifyServiceRole = new iam.Role(this, 'AmplifyServiceRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'Service role for Amplify to invoke RCM agents',
      inlinePolicies: {
        LambdaInvokePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'lambda:InvokeFunction',
              ],
              resources: [
                `arn:aws:lambda:${this.region}:${this.account}:function:*Agent*`,
              ],
            }),
          ],
        }),
        SecretsManagerPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
              ],
              resources: [
                `arn:aws:secretsmanager:${this.region}:${this.account}:secret:muni-rcm/*`,
              ],
            }),
          ],
        }),
      },
    });

    // Secrets for external integrations
    const claimMdSecret = new secretsmanager.Secret(this, 'ClaimMdCredentials', {
      secretName: 'muni-rcm/claim-md-credentials',
      description: 'Credentials for Claim.MD clearinghouse integration',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: '',
          environment: 'sandbox', // or 'production'
        }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
        passwordLength: 32,
      },
      encryptionKey: this.kmsKey,
    });

    const oneUpHealthSecret = new secretsmanager.Secret(this, 'OneUpHealthCredentials', {
      secretName: 'muni-rcm/1uphealth-credentials',
      description: 'Credentials for 1upHealth EHR integration',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          client_id: '',
          environment: 'sandbox', // or 'production'
        }),
        generateStringKey: 'client_secret',
        excludeCharacters: '"@/\\\'',
        passwordLength: 64,
      },
      encryptionKey: this.kmsKey,
    });

    // IAM policy for HIPAA compliance
    const hipaaCompliancePolicy = new iam.ManagedPolicy(this, 'HipaaCompliancePolicy', {
      managedPolicyName: 'MuniRcmHipaaCompliance',
      description: 'HIPAA compliance policy for Muni RCM platform',
      statements: [
        // Deny unencrypted S3 operations
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: [
            's3:PutObject',
          ],
          resources: ['*'],
          conditions: {
            StringNotEquals: {
              's3:x-amz-server-side-encryption': 'aws:kms',
            },
          },
        }),
        // Deny unencrypted RDS operations
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: [
            'rds:CreateDBInstance',
            'rds:CreateDBCluster',
          ],
          resources: ['*'],
          conditions: {
            Bool: {
              'rds:StorageEncrypted': 'false',
            },
          },
        }),
        // Require MFA for sensitive operations
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: [
            'rds:DeleteDBInstance',
            's3:DeleteBucket',
            'kms:ScheduleKeyDeletion',
          ],
          resources: ['*'],
          conditions: {
            BoolIfExists: {
              'aws:MultiFactorAuthPresent': 'false',
            },
          },
        }),
      ],
    });

    // Service-linked roles for AWS services
    const bedrockServiceLinkedRole = new iam.CfnServiceLinkedRole(this, 'BedrockServiceLinkedRole', {
      awsServiceName: 'bedrock.amazonaws.com',
      description: 'Service-linked role for Amazon Bedrock',
    });

    // CloudTrail role for security monitoring
    const cloudTrailRole = new iam.Role(this, 'CloudTrailRole', {
      assumedBy: new iam.ServicePrincipal('cloudtrail.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/CloudWatchLogsFullAccess'),
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'MasterKmsKeyId', {
      value: this.kmsKey.keyId,
      description: 'Master KMS key ID for encryption',
      exportName: 'MuniRcm-MasterKmsKey',
    });

    new cdk.CfnOutput(this, 'AmplifyServiceRoleArn', {
      value: this.amplifyServiceRole.roleArn,
      description: 'Amplify service role ARN',
      exportName: 'MuniRcm-AmplifyServiceRole',
    });

    new cdk.CfnOutput(this, 'ClaimMdSecretArn', {
      value: claimMdSecret.secretArn,
      description: 'Claim.MD credentials secret ARN',
      exportName: 'MuniRcm-ClaimMdSecret',
    });

    new cdk.CfnOutput(this, 'OneUpHealthSecretArn', {
      value: oneUpHealthSecret.secretArn,
      description: '1upHealth credentials secret ARN',
      exportName: 'MuniRcm-OneUpHealthSecret',
    });
  }
}