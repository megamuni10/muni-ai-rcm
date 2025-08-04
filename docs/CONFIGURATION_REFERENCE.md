# Configuration Reference - Muni AI RCM Platform

This document contains all configuration files, environment variables, and settings needed for the Muni AI RCM Platform.

## Environment Variables

### Development (.env.local)

```bash
# Application Environment
NODE_ENV=development
NEXT_PUBLIC_DEV_MODE=true

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Database Configuration
RDS_ENDPOINT=muni-rcm-db.cluster-xyz.us-east-1.rds.amazonaws.com
DB_SECRET_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:DatabaseSecret-abcdef
DB_NAME=muni_rcm
DB_USER=muni_rcm_admin

# Lambda Configuration
AGENT_DEVELOPMENT_MODE=true
LAMBDA_TIMEOUT=300
LAMBDA_MEMORY=512

# API Gateway
API_GATEWAY_URL=https://api123456.execute-api.us-east-1.amazonaws.com/prod

# Claim MD Integration
CLAIM_MD_API_URL=https://api.claim.md
CLAIM_MD_ACCOUNT_KEY=your-claim-md-account-key
CLAIM_MD_WEBHOOK_SECRET=your-webhook-secret

# Nova Pro Configuration
BEDROCK_MODEL_ID=amazon.nova-pro-v1:0
BEDROCK_MAX_TOKENS=2000
BEDROCK_TEMPERATURE=0.1

# Development Overrides
DEV_USER_ROLE=ops  # admin, ops, or provider
DEV_USER_ID=dev-user-123
DEV_ORGANIZATION_ID=org-dev-123

# Security
NEXTAUTH_SECRET=your-nextauth-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# Monitoring
ENABLE_CLOUDWATCH_LOGS=true
LOG_LEVEL=info
```

### Production (.env.production)

```bash
# Application Environment
NODE_ENV=production
NEXT_PUBLIC_DEV_MODE=false

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Database Configuration (populated by CDK)
RDS_ENDPOINT=${RDS_ENDPOINT}
DB_SECRET_ARN=${DB_SECRET_ARN}
DB_NAME=muni_rcm
DB_USER=muni_rcm_admin

# Lambda Configuration
AGENT_DEVELOPMENT_MODE=false
LAMBDA_TIMEOUT=300
LAMBDA_MEMORY=1024

# API Gateway (populated by CDK)
API_GATEWAY_URL=${API_GATEWAY_URL}

# Claim MD Integration
CLAIM_MD_API_URL=https://api.claim.md
CLAIM_MD_ACCOUNT_KEY=${CLAIM_MD_ACCOUNT_KEY}
CLAIM_MD_WEBHOOK_SECRET=${CLAIM_MD_WEBHOOK_SECRET}

# Nova Pro Configuration
BEDROCK_MODEL_ID=amazon.nova-pro-v1:0
BEDROCK_MAX_TOKENS=2000
BEDROCK_TEMPERATURE=0.1

# Security
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=https://your-domain.com

# Monitoring
ENABLE_CLOUDWATCH_LOGS=true
LOG_LEVEL=warn
```

## Next.js Configuration

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  },
  env: {
    AWS_REGION: process.env.AWS_REGION,
    API_GATEWAY_URL: process.env.API_GATEWAY_URL,
    CLAIM_MD_API_URL: process.env.CLAIM_MD_API_URL,
  },
  images: {
    domains: ['localhost', 'your-domain.com'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/webhook/:path*',
        destination: `${process.env.API_GATEWAY_URL}/webhook/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
```

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
```

## AWS Amplify Configuration

### amplify/backend.ts

```typescript
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

export const backend = defineBackend({
  auth,
  data,
});

// Additional backend configuration
backend.addOutput({
  custom: {
    API_GATEWAY_URL: process.env.API_GATEWAY_URL,
    AWS_REGION: process.env.AWS_REGION,
  },
});
```

### amplify/auth/resource.ts

```typescript
import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['Admins', 'Operations', 'Providers'],
  userAttributes: {
    'custom:role': {
      dataType: 'String',
      mutable: true,
    },
    'custom:organization_id': {
      dataType: 'String',
      mutable: true,
    },
  },
});
```

### amplify/data/resource.ts

```typescript
import { defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = /* GraphQL */ `
  type UserProfile @model @auth(rules: [{ allow: owner }, { allow: groups, groups: ["Admins"] }]) {
    id: ID!
    userId: String! @index(name: "byUserId")
    email: String!
    role: String!
    organizationId: String!
    isActive: Boolean
    lastLogin: AWSDateTime
    createdAt: AWSDateTime
    updatedAt: AWSDateTime
  }

  type Patient @model @auth(rules: [{ allow: groups, groups: ["Admins", "Operations", "Providers"] }]) {
    id: ID!
    patientId: String! @index(name: "byPatientId")
    firstName: String!
    lastName: String!
    dateOfBirth: AWSDate!
    phone: String
    email: String
    address: AWSJSON
    insuranceInfo: AWSJSON
    providerId: String
    isActive: Boolean
    createdAt: AWSDateTime
    updatedAt: AWSDateTime
  }

  type Claim @model @auth(rules: [{ allow: groups, groups: ["Admins", "Operations", "Providers"] }]) {
    id: ID!
    claimId: String! @index(name: "byClaimId")
    patientId: String! @index(name: "byPatientId")
    providerId: String! @index(name: "byProviderId")
    status: String!
    claimType: String!
    serviceDate: AWSDate!
    submissionDate: AWSDateTime
    totalAmount: Float!
    paidAmount: Float
    patientResponsibility: Float
    diagnosisCodes: [String!]!
    procedureCodes: [String!]!
    claimmdBatchId: String
    claimmdStatus: String
    claimmdErrors: AWSJSON
    retryCount: Int
    aiGeneratedData: AWSJSON
    manualOverrides: AWSJSON
    workflowSteps: AWSJSON
    assignedTo: String
    priority: String
    isActive: Boolean
    createdAt: AWSDateTime
    updatedAt: AWSDateTime
  }

  type WorkflowState @model @auth(rules: [{ allow: groups, groups: ["Admins", "Operations"] }]) {
    id: ID!
    claimId: String! @index(name: "byClaimId")
    currentStep: String!
    completedSteps: [String!]
    nextSteps: [String!]
    isBlocked: Boolean
    blockReason: String
    assignedTo: String
    estimatedCompletion: AWSDateTime
    metadata: AWSJSON
    createdAt: AWSDateTime
    updatedAt: AWSDateTime
  }

  type AgentRun @model @auth(rules: [{ allow: groups, groups: ["Admins", "Operations"] }]) {
    id: ID!
    runId: String! @index(name: "byRunId")
    agentName: String! @index(name: "byAgentName")
    claimId: String @index(name: "byClaimId")
    patientId: String
    inputData: AWSJSON!
    outputData: AWSJSON
    status: String!
    executionTime: Float
    cost: Float
    confidence: Float
    needsReview: Boolean @index(name: "byNeedsReview")
    reviewedBy: String
    reviewNotes: String
    createdAt: AWSDateTime
    updatedAt: AWSDateTime
  }
`;

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
```

## AWS CDK Configuration

### cdk.json (Extended)

```json
{
  "app": "npx ts-node --prefer-ts-exts app.ts",
  "requireApproval": "never",
  "watch": {
    "include": [
      "**"
    ],
    "exclude": [
      "README.md",
      "cdk*.json",
      "**/*.d.ts",
      "**/*.js",
      "tsconfig.json",
      "package*.json",
      "yarn.lock",
      "node_modules",
      "test"
    ]
  },
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:checkSecretUsage": true,
    "@aws-cdk/core:target-partitions": ["aws", "aws-cn"],
    "@aws-cdk-containers/ecs-service-extensions:enableDefaultLogDriver": true,
    "@aws-cdk/aws-ec2:uniqueImdsv2TemplateName": true,
    "@aws-cdk/aws-ecs:arnFormatIncludesClusterName": true,
    "@aws-cdk/aws-iam:minimizePolicies": true,
    "@aws-cdk/core:validateSnapshotRemovalPolicy": true,
    "@aws-cdk/aws-codepipeline:crossAccountKeyAliasStackSafeResourceName": true,
    "@aws-cdk/aws-s3:createDefaultLoggingPolicy": true,
    "@aws-cdk/aws-sns-subscriptions:restrictSqsDescryption": true,
    "@aws-cdk/aws-apigateway:disableCloudWatchRole": true,
    "@aws-cdk/core:enablePartitionLiterals": true,
    "@aws-cdk/aws-events:eventsTargetQueueSameAccount": true,
    "@aws-cdk/aws-iam:standardizedServicePrincipals": true,
    "@aws-cdk/aws-ecs:disableExplicitDeploymentControllerForCircuitBreaker": true,
    "@aws-cdk/aws-iam:importedRoleStackSafeDefaultPolicyName": true,
    "@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy": true,
    "@aws-cdk/aws-route53-patters:useCertificate": true,
    "@aws-cdk/customresources:installLatestAwsSdkDefault": false,
    "@aws-cdk/aws-rds:databaseProxyUniqueResourceName": true,
    "@aws-cdk/aws-codedeploy:removeAlarmsFromDeploymentGroup": true,
    "@aws-cdk/aws-apigateway:authorizerChangeDeploymentLogicalId": true,
    "@aws-cdk/aws-ec2:launchTemplateDefaultUserData": true,
    "@aws-cdk/aws-secretsmanager:useAttachedSecretResourcePolicyForSecretTargetAttachments": true,
    "@aws-cdk/aws-redshift:columnId": true,
    "@aws-cdk/aws-stepfunctions-tasks:enableLogging": true,
    "@aws-cdk/aws-ec2:restrictDefaultSecurityGroup": true,
    "@aws-cdk/aws-apigateway:requestValidatorUniqueId": true,
    "@aws-cdk/aws-kms:aliasNameRef": true,
    "@aws-cdk/aws-autoscaling:generateLaunchTemplateInsteadOfLaunchConfig": true,
    "@aws-cdk/core:includePrefixInUniqueNameGeneration": true,
    "@aws-cdk/aws-efs:denyAnonymousAccess": true,
    "@aws-cdk/aws-opensearchservice:enableLogging": true,
    "@aws-cdk/aws-normlize-line-endings": true,
    "@aws-cdk/aws-kms:reduceCrossAccountRegionPolicyScope": true,
    "@aws-cdk/aws-eks:nodegroupNameAttribute": true,
    "@aws-cdk/aws-ec2:ebsDefaultGp3Volume": true,
    "@aws-cdk/aws-ecs:removeDefaultDeploymentAlarm": true,
    "muni-rcm:environment": "development",
    "muni-rcm:enableMonitoring": true,
    "muni-rcm:enableDeletionProtection": false
  }
}
```

## Lambda Agent Configuration

### Python Requirements Template

```txt
# agents/*/requirements.txt
boto3==1.34.0
psycopg2-binary==2.9.9
requests==2.31.0
python-json-logger==2.0.7
pydantic==2.5.2
tenacity==8.2.3
```

### Agent Environment Variables

```python
# Common environment variables for all agents
import os

# AWS Configuration
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
DB_SECRET_ARN = os.environ.get('DB_SECRET_ARN')

# Development Configuration
DEVELOPMENT_MODE = os.environ.get('DEVELOPMENT_MODE', 'false').lower() == 'true'

# Bedrock Configuration
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'amazon.nova-pro-v1:0')
BEDROCK_MAX_TOKENS = int(os.environ.get('BEDROCK_MAX_TOKENS', '2000'))
BEDROCK_TEMPERATURE = float(os.environ.get('BEDROCK_TEMPERATURE', '0.1'))

# Claim MD Configuration
CLAIM_MD_API_URL = os.environ.get('CLAIM_MD_API_URL', 'https://api.claim.md')
CLAIM_MD_ACCOUNT_KEY = os.environ.get('CLAIM_MD_ACCOUNT_KEY')

# Logging Configuration
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
```

## Database Configuration

### Connection Pool Settings

```python
# Database connection configuration
DB_CONFIG = {
    'pool_size': 5,
    'max_overflow': 10,
    'pool_timeout': 30,
    'pool_recycle': 3600,
    'connect_args': {
        'sslmode': 'require',
        'connect_timeout': 10,
        'application_name': 'muni-ai-rcm'
    }
}
```

### Migration Configuration

```bash
# database/migrate.sh
#!/bin/bash

# Database migration script
DB_HOST=${RDS_ENDPOINT}
DB_NAME=${DB_NAME:-muni_rcm}
DB_USER=${DB_USER:-muni_rcm_admin}

# Get password from Secrets Manager
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id $DB_SECRET_ARN \
  --query SecretString --output text | \
  jq -r .password)

export PGPASSWORD=$DB_PASSWORD

# Run migrations
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f schema.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f seed-data.sql

echo "✅ Database migration complete"
```

## Monitoring Configuration

### CloudWatch Log Groups

```typescript
// CDK configuration for log groups
const logGroups = [
  '/aws/lambda/MuniRcmStack-CodingAgent',
  '/aws/lambda/MuniRcmStack-EligibilityAgent',
  '/aws/lambda/MuniRcmStack-SubmitClaimAgent',
  '/aws/lambda/MuniRcmStack-ERAParserAgent',
  '/aws/apigateway/MuniRcmApi',
  '/aws/rds/instance/MuniRcmDatabase/postgresql'
];

logGroups.forEach(logGroupName => {
  new logs.LogGroup(this, logGroupName.replace(/[^a-zA-Z0-9]/g, ''), {
    logGroupName,
    retention: logs.RetentionDays.THIRTY_DAYS,
    removalPolicy: cdk.RemovalPolicy.DESTROY
  });
});
```

### Custom Metrics

```python
# Custom CloudWatch metrics
import boto3

cloudwatch = boto3.client('cloudwatch')

def put_custom_metric(metric_name: str, value: float, unit: str = 'Count', dimensions: dict = None):
    """Put custom metric to CloudWatch"""
    cloudwatch.put_metric_data(
        Namespace='MuniRCM',
        MetricData=[
            {
                'MetricName': metric_name,
                'Value': value,
                'Unit': unit,
                'Dimensions': [
                    {'Name': k, 'Value': v} for k, v in (dimensions or {}).items()
                ]
            }
        ]
    )

# Usage examples:
# put_custom_metric('ClaimProcessed', 1, dimensions={'Agent': 'CodingAgent'})
# put_custom_metric('AIConfidence', 0.95, 'Percent', dimensions={'Agent': 'CodingAgent'})
# put_custom_metric('ProcessingTime', 1.5, 'Seconds', dimensions={'Agent': 'CodingAgent'})
```

## Security Configuration

### IAM Policies

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:*:*:model/amazon.nova-pro-v1:0"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:DatabaseSecret-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "cloudwatch:namespace": "MuniRCM"
        }
      }
    }
  ]
}
```

### Security Group Rules

```typescript
// Lambda security group
const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
  vpc: this.vpc,
  description: 'Security group for Lambda functions',
  allowAllOutbound: true
});

// RDS security group
const rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
  vpc: this.vpc,
  description: 'Security group for RDS instance',
  allowAllOutbound: false
});

// Allow Lambda to connect to RDS
rdsSecurityGroup.addIngressRule(
  lambdaSecurityGroup,
  ec2.Port.tcp(5432),
  'Allow Lambda functions to connect to PostgreSQL'
);

// Allow HTTPS outbound for Claim MD API and Bedrock
lambdaSecurityGroup.addEgressRule(
  ec2.Peer.anyIpv4(),
  ec2.Port.tcp(443),
  'Allow HTTPS outbound for external APIs'
);
```

## Development Configuration

### VS Code Settings

```json
// .vscode/settings.json
{
  "python.defaultInterpreterPath": "./agents/CodingAgent/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/.git": true,
    "**/.DS_Store": true,
    "**/cdk.out": true,
    "**/venv": true,
    "**/__pycache__": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/cdk.out": true,
    "**/venv": true,
    "**/__pycache__": true
  }
}
```

### Git Configuration

```gitignore
# .gitignore
# Dependencies
node_modules/
*/node_modules/

# Production builds
.next/
out/
dist/
build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/

# CDK
cdk.out/
*.zip

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
logs
*.log
npm-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# AWS
.aws/

# Database
*.db
*.sqlite3

# Testing
coverage/
.nyc_output
.coverage
.pytest_cache/

# MacOS
.DS_Store

# Windows
Thumbs.db
ehthumbs.db
Desktop.ini
```

This configuration reference provides all the necessary settings, environment variables, and configuration files needed to run the Muni AI RCM Platform. Each section includes both development and production configurations where applicable.