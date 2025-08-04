import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface AgentsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  database: rds.DatabaseInstance;
  s3Bucket: s3.Bucket;
}

export class AgentsStack extends cdk.Stack {
  public readonly agentFunctions: { [key: string]: lambda.Function } = {};

  constructor(scope: Construct, id: string, props: AgentsStackProps) {
    super(scope, id, props);

    // Common environment variables for all agents
    const commonEnvironment = {
      DB_HOST: props.database.instanceEndpoint.hostname,
      DB_NAME: 'muni_rcm',
      S3_BUCKET: props.s3Bucket.bucketName,
      // AWS_REGION: this.region, // Removed to avoid Lambda reserved variable error
    };

    // Security group for Lambda functions
    const lambdaSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'LambdaSecurityGroup',
      cdk.Fn.importValue('MuniRcm-LambdaSecurityGroup')
    );

    // Base IAM role for all agents
    const baseAgentRole = new iam.Role(this, 'BaseAgentRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
      inlinePolicies: {
        AgentBasePolicy: new iam.PolicyDocument({
          statements: [
            // CloudWatch Logs
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['*'],
            }),
            // S3 access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: [
                props.s3Bucket.bucketArn,
                `${props.s3Bucket.bucketArn}/*`,
              ],
            }),
            // Secrets Manager
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
              ],
              resources: [
                props.database.secret?.secretArn || '',
              ],
            }),
          ],
        }),
      },
    });

    // Create agent functions
    this.createCodingAgent(props, baseAgentRole, lambdaSecurityGroup, commonEnvironment);
    this.createERAParserAgent(props, baseAgentRole, lambdaSecurityGroup, commonEnvironment);
    this.createSubmitClaimAgent(props, baseAgentRole, lambdaSecurityGroup, commonEnvironment);
    this.createEligibilityAgent(props, baseAgentRole, lambdaSecurityGroup, commonEnvironment);
    this.createDenialClassifierAgent(props, baseAgentRole, lambdaSecurityGroup, commonEnvironment);
    this.createAppealLetterAgent(props, baseAgentRole, lambdaSecurityGroup, commonEnvironment);

    // Output function ARNs
    Object.entries(this.agentFunctions).forEach(([name, func]) => {
      new cdk.CfnOutput(this, `${name}Arn`, {
        value: func.functionArn,
        description: `ARN for ${name} Lambda function`,
        exportName: `MuniRcm-${name}Arn`,
      });
    });
  }

  private createCodingAgent(
    props: AgentsStackProps,
    baseRole: iam.Role,
    securityGroup: ec2.ISecurityGroup,
    environment: Record<string, string>
  ) {
    // Additional permissions for Bedrock
    const codingAgentRole = new iam.Role(this, 'CodingAgentRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    codingAgentRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );
    codingAgentRole.attachInlinePolicy(
      new iam.Policy(this, 'CodingAgentBasePolicy', {
        document: new iam.PolicyDocument({
          statements: [
            // CloudWatch Logs
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['*'],
            }),
            // S3 access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: [
                props.s3Bucket.bucketArn,
                `${props.s3Bucket.bucketArn}/*`,
              ],
            }),
            // Secrets Manager
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
              ],
              resources: [
                props.database.secret?.secretArn || '',
              ],
            }),
          ],
        }),
      })
    );
    codingAgentRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-pro-v1:0`,
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-lite-v1:0`,
        ],
      })
    );

    this.agentFunctions.CodingAgent = new lambda.Function(this, 'CodingAgent', {
      runtime: lambda.Runtime.PYTHON_3_10,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset('../agents/CodingAgent'),
      role: codingAgentRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment,
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'AI-powered medical coding using AWS Bedrock Nova Pro',
    });
  }

  private createERAParserAgent(
    props: AgentsStackProps,
    baseRole: iam.Role,
    securityGroup: ec2.ISecurityGroup,
    environment: Record<string, string>
  ) {
    // Additional permissions for EventBridge (to trigger other agents)
    const eraParserRole = new iam.Role(this, 'ERAParserAgentRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    eraParserRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );
    eraParserRole.attachInlinePolicy(
      new iam.Policy(this, 'ERAParserBasePolicy', {
        document: new iam.PolicyDocument({
          statements: [
            // CloudWatch Logs
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['*'],
            }),
            // S3 access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: [
                props.s3Bucket.bucketArn,
                `${props.s3Bucket.bucketArn}/*`,
              ],
            }),
            // Secrets Manager
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
              ],
              resources: [
                props.database.secret?.secretArn || '',
              ],
            }),
          ],
        }),
      })
    );
    eraParserRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'events:PutEvents',
        ],
        resources: [
          `arn:aws:events:${this.region}:${this.account}:event-bus/default`,
        ],
      })
    );

    this.agentFunctions.ERAParserAgent = new lambda.Function(this, 'ERAParserAgent', {
      runtime: lambda.Runtime.PYTHON_3_10,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset('../agents/ERAParserAgent'),
      role: eraParserRole,
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment,
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Parse 835 ERA files and extract payment/denial information',
    });
  }

  private createSubmitClaimAgent(
    props: AgentsStackProps,
    baseRole: iam.Role,
    securityGroup: ec2.ISecurityGroup,
    environment: Record<string, string>
  ) {
    this.agentFunctions.SubmitClaimAgent = new lambda.Function(this, 'SubmitClaimAgent', {
      runtime: lambda.Runtime.PYTHON_3_10,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset('../agents/SubmitClaimAgent'),
      role: baseRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment,
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Generate and submit 837 claims to clearinghouses',
    });
  }

  private createEligibilityAgent(
    props: AgentsStackProps,
    baseRole: iam.Role,
    securityGroup: ec2.ISecurityGroup,
    environment: Record<string, string>
  ) {
    this.agentFunctions.EligibilityAgent = new lambda.Function(this, 'EligibilityAgent', {
      runtime: lambda.Runtime.PYTHON_3_10,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset('../agents/EligibilityAgent'),
      role: baseRole,
      timeout: cdk.Duration.minutes(3),
      memorySize: 256,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment,
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Check patient insurance eligibility via 270/271 transactions',
    });
  }

  private createDenialClassifierAgent(
    props: AgentsStackProps,
    baseRole: iam.Role,
    securityGroup: ec2.ISecurityGroup,
    environment: Record<string, string>
  ) {
    // Denial Classifier needs Bedrock access for AI analysis
    const denialClassifierRole = new iam.Role(this, 'DenialClassifierAgentRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    denialClassifierRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );
    denialClassifierRole.attachInlinePolicy(
      new iam.Policy(this, 'DenialClassifierBasePolicy', {
        document: new iam.PolicyDocument({
          statements: [
            // CloudWatch Logs
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['*'],
            }),
            // S3 access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: [
                props.s3Bucket.bucketArn,
                `${props.s3Bucket.bucketArn}/*`,
              ],
            }),
            // Secrets Manager
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
              ],
              resources: [
                props.database.secret?.secretArn || '',
              ],
            }),
          ],
        }),
      })
    );
    denialClassifierRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
        ],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-pro-v1:0`,
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-lite-v1:0`,
        ],
      })
    );

    this.agentFunctions.DenialClassifierAgent = new lambda.Function(this, 'DenialClassifierAgent', {
      runtime: lambda.Runtime.PYTHON_3_10,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset('../agents/DenialClassifierAgent'),
      role: denialClassifierRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment,
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'AI-powered denial classification and analysis',
    });
  }

  private createAppealLetterAgent(
    props: AgentsStackProps,
    baseRole: iam.Role,
    securityGroup: ec2.ISecurityGroup,
    environment: Record<string, string>
  ) {
    // Appeal Letter Agent needs Bedrock access for letter generation
    const appealLetterRole = new iam.Role(this, 'AppealLetterAgentRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    appealLetterRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );
    appealLetterRole.attachInlinePolicy(
      new iam.Policy(this, 'AppealLetterBasePolicy', {
        document: new iam.PolicyDocument({
          statements: [
            // CloudWatch Logs
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['*'],
            }),
            // S3 access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: [
                props.s3Bucket.bucketArn,
                `${props.s3Bucket.bucketArn}/*`,
              ],
            }),
            // Secrets Manager
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
              ],
              resources: [
                props.database.secret?.secretArn || '',
              ],
            }),
          ],
        }),
      })
    );
    appealLetterRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
        ],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-pro-v1:0`,
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-lite-v1:0`,
        ],
      })
    );

    this.agentFunctions.AppealLetterAgent = new lambda.Function(this, 'AppealLetterAgent', {
      runtime: lambda.Runtime.PYTHON_3_10,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset('../agents/AppealLetterAgent'),
      role: appealLetterRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment,
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'AI-powered appeal letter generation',
    });
  }
}