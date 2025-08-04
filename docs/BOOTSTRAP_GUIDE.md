# Bootstrap Guide - Muni AI RCM Platform

This guide provides step-by-step instructions to bootstrap the Muni AI RCM Platform from scratch. Follow these steps in order for one-shot development with Claude Code.

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- AWS CLI configured with appropriate permissions
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- PostgreSQL client tools (for testing)

## Step 1: Project Initialization

### 1.1 Create Next.js Application

```bash
# Create the main Next.js application
npx create-next-app@latest muni-ai-rcm --typescript --tailwind --eslint --app --src-dir=false

cd muni-ai-rcm

# Install additional dependencies
npm install @aws-sdk/client-lambda @aws-sdk/client-secrets-manager aws-amplify
npm install -D @types/node
```

### 1.2 Create Project Structure

```bash
# Create the monorepo structure
mkdir -p agents/{CodingAgent,EligibilityAgent,SubmitClaimAgent,ERAParserAgent,DenialClassifierAgent,AppealLetterAgent}
mkdir -p infra/lib
mkdir -p schemas
mkdir -p scripts
mkdir -p database
mkdir -p docs

# Create agent directories with standard files
for agent in CodingAgent EligibilityAgent SubmitClaimAgent ERAParserAgent DenialClassifierAgent AppealLetterAgent; do
  touch agents/$agent/handler.py
  touch agents/$agent/requirements.txt
  echo "boto3==1.34.0
psycopg2-binary==2.9.9
requests==2.31.0" > agents/$agent/requirements.txt
done
```

### 1.3 Initialize CDK Project

```bash
# Initialize CDK in infra directory
cd infra
npm init -y
npm install aws-cdk-lib constructs
npm install -D @types/node typescript

# Create CDK app file
cat > app.ts << 'EOF'
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MuniRcmStack } from './lib/muni-rcm-stack';

const app = new cdk.App();
new MuniRcmStack(app, 'MuniRcmStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
EOF

# Create CDK configuration
cat > cdk.json << 'EOF'
{
  "app": "npx ts-node --prefer-ts-exts app.ts",
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
    "@aws-cdk/aws-ecs:removeDefaultDeploymentAlarm": true
  }
}
EOF

cd ..
```

## Step 2: Environment Configuration

### 2.1 Create Environment Files

```bash
# Create main environment file
cat > .env.local << 'EOF'
NODE_ENV=development
NEXT_PUBLIC_DEV_MODE=true
AWS_REGION=us-east-1
AGENT_DEVELOPMENT_MODE=true

# AWS Configuration (will be set by deployment)
AWS_ACCOUNT_ID=
RDS_ENDPOINT=
DB_SECRET_ARN=
API_GATEWAY_URL=

# Claim MD Configuration
CLAIM_MD_API_URL=https://api.claim.md
CLAIM_MD_ACCOUNT_KEY=

# Development overrides
DEV_USER_ROLE=ops
EOF

# Create TypeScript configuration
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "infra", "agents"]
}
EOF

# Create infra TypeScript config
cat > infra/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["es2020"],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": false,
    "inlineSourceMap": true,
    "inlineSources": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "typeRoots": ["./node_modules/@types"]
  },
  "exclude": ["cdk.out"]
}
EOF
```

### 2.2 Create Package.json Scripts

```bash
# Update package.json with useful scripts
cat > package.json << 'EOF'
{
  "name": "muni-ai-rcm",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "deploy-infra": "cd infra && cdk deploy --all",
    "destroy-infra": "cd infra && cdk destroy --all",
    "deploy-agents": "./scripts/deploy-all-agents.sh",
    "test-agent": "./scripts/run-local-agent.sh",
    "db:migrate": "psql -h $RDS_ENDPOINT -U $DB_USER -d $DB_NAME -f database/schema.sql",
    "bootstrap": "./scripts/bootstrap.sh"
  },
  "dependencies": {
    "@aws-sdk/client-lambda": "^3.478.0",
    "@aws-sdk/client-secrets-manager": "^3.478.0",
    "aws-amplify": "^6.0.7",
    "next": "14.0.4",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.0.1",
    "eslint": "^8",
    "eslint-config-next": "14.0.4",
    "postcss": "^8",
    "tailwindcss": "^3.3.0",
    "typescript": "^5"
  }
}
EOF
```

## Step 3: Create Core Files

### 3.1 Copy Implementation Templates

```bash
# Copy the base agent handler to all agents
for agent in CodingAgent EligibilityAgent SubmitClaimAgent ERAParserAgent DenialClassifierAgent AppealLetterAgent; do
  cp docs/IMPLEMENTATION_TEMPLATES.md agents/$agent/
  # Extract the Python handler template (this would be done by Claude Code)
  echo "# TODO: Extract and customize handler.py from IMPLEMENTATION_TEMPLATES.md" > agents/$agent/handler.py
done
```

### 3.2 Create Directory Structure for Next.js

```bash
# Create Next.js app structure
mkdir -p app/{dashboard,claims,patients,appeals,auth}
mkdir -p app/lib
mkdir -p components/{ui,dashboard,forms}

# Create basic layout files
cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Muni AI RCM Platform',
  description: 'AI-native Revenue Cycle Management platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
EOF

cat > app/page.tsx << 'EOF'
import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/dashboard')
}
EOF

cat > app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF
```

### 3.3 Create Database Schema

```bash
# Copy database schema from templates
echo "-- Copy from IMPLEMENTATION_TEMPLATES.md" > database/schema.sql
echo "-- TODO: Extract SQL schema from implementation templates" >> database/schema.sql
```

## Step 4: Create Utility Scripts

### 4.1 Bootstrap Script

```bash
cat > scripts/bootstrap.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Bootstrapping Muni AI RCM Platform..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3 is required"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required"; exit 1; }
command -v cdk >/dev/null 2>&1 || { echo "❌ AWS CDK is required"; exit 1; }

echo "✅ Prerequisites checked"

# Bootstrap CDK if needed
echo "🏗️  Bootstrapping AWS CDK..."
cd infra
cdk bootstrap
cd ..

echo "📦 Installing dependencies..."
npm install
cd infra && npm install && cd ..

echo "🐍 Setting up Python agents..."
for agent in agents/*/; do
  if [ -f "$agent/requirements.txt" ]; then
    echo "Setting up $(basename $agent)..."
    cd "$agent"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate
    cd ../..
  fi
done

echo "🎉 Bootstrap complete!"
echo ""
echo "Next steps:"
echo "1. Configure your .env.local file with AWS credentials"
echo "2. Run 'npm run deploy-infra' to deploy infrastructure"
echo "3. Run 'npm run dev' to start development server"
EOF

chmod +x scripts/bootstrap.sh
```

### 4.2 Agent Testing Script

```bash
cat > scripts/run-local-agent.sh << 'EOF'
#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Usage: $0 <AgentName> [payload-file]"
    echo "Example: $0 CodingAgent test-payload.json"
    exit 1
fi

AGENT_NAME=$1
PAYLOAD_FILE=${2:-"test-payload.json"}

if [ ! -d "agents/$AGENT_NAME" ]; then
    echo "❌ Agent $AGENT_NAME not found"
    exit 1
fi

echo "🧪 Testing $AGENT_NAME locally..."

cd "agents/$AGENT_NAME"

# Activate virtual environment
source venv/bin/activate

# Set development mode
export DEVELOPMENT_MODE=true

# Create test payload if it doesn't exist
if [ ! -f "$PAYLOAD_FILE" ]; then
    cat > test-payload.json << 'JSON'
{
  "clinicalNotes": "Patient presents for annual physical examination. No acute concerns. Continue current medications.",
  "patientData": {
    "age": 45,
    "gender": "M"
  },
  "claimId": "CLM-TEST-123"
}
JSON
fi

# Run the agent
python3 -c "
import json
import sys
from handler import lambda_handler

with open('$PAYLOAD_FILE', 'r') as f:
    event = json.load(f)

class MockContext:
    def __init__(self):
        self.function_name = '$AGENT_NAME'
        self.aws_request_id = 'test-request-id'

result = lambda_handler(event, MockContext())
print(json.dumps(result, indent=2))
"

deactivate
cd ../..

echo "✅ Agent test complete"
EOF

chmod +x scripts/run-local-agent.sh
```

### 4.3 Deployment Script

```bash
cat > scripts/deploy-all-agents.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Deploying all Lambda agents..."

# Build and package each agent
for agent_dir in agents/*/; do
    agent_name=$(basename "$agent_dir")
    
    if [ -f "$agent_dir/handler.py" ]; then
        echo "📦 Packaging $agent_name..."
        
        cd "$agent_dir"
        
        # Create deployment package
        rm -rf dist
        mkdir -p dist
        
        # Copy source code
        cp *.py dist/
        
        # Install dependencies
        if [ -f "requirements.txt" ]; then
            pip install -r requirements.txt -t dist/
        fi
        
        # Create zip package
        cd dist
        zip -r "../${agent_name}.zip" .
        cd ..
        
        echo "✅ $agent_name packaged"
        cd ../..
    fi
done

echo "🎉 All agents packaged successfully!"
echo "💡 Run 'npm run deploy-infra' to deploy infrastructure and agents"
EOF

chmod +x scripts/deploy-all-agents.sh
```

## Step 5: Development Workflow

### 5.1 First-Time Setup Commands

```bash
# Run these commands in sequence for first-time setup:

# 1. Bootstrap the project
./scripts/bootstrap.sh

# 2. Configure environment (edit .env.local with your AWS settings)
# 3. Deploy infrastructure
npm run deploy-infra

# 4. Run database migrations (after RDS is deployed)
npm run db:migrate

# 5. Start development server
npm run dev
```

### 5.2 Daily Development Commands

```bash
# Start development server
npm run dev

# Test an agent locally
npm run test-agent CodingAgent

# Deploy changes to AWS
npm run deploy-infra

# Deploy only agents (after code changes)
npm run deploy-agents
```

## Step 6: Verification Steps

### 6.1 Local Development Verification

```bash
# 1. Verify Next.js is running
curl http://localhost:3000

# 2. Test agent locally
./scripts/run-local-agent.sh CodingAgent

# 3. Check database connection (after deployment)
psql -h $RDS_ENDPOINT -U $DB_USER -d $DB_NAME -c "SELECT version();"
```

### 6.2 AWS Deployment Verification

```bash
# 1. Check CDK stacks
cd infra && cdk list

# 2. Verify Lambda functions
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `MuniRcm`)].FunctionName'

# 3. Check RDS instance
aws rds describe-db-instances --query 'DBInstances[?DBName==`muni_rcm`].Endpoint.Address'

# 4. Test API Gateway endpoints
curl -X POST $API_GATEWAY_URL/webhook/era -H "Content-Type: application/json" -d '{}'
```

## Step 7: Troubleshooting

### 7.1 Common Issues

**CDK Bootstrap Failed:**
```bash
# Ensure AWS credentials are configured
aws sts get-caller-identity

# Bootstrap with explicit account/region
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

**Agent Deployment Failed:**
```bash
# Check Lambda function logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/MuniRcm

# Check specific function
aws logs tail /aws/lambda/MuniRcmStack-CodingAgent --follow
```

**Database Connection Failed:**
```bash
# Check RDS endpoint
aws rds describe-db-instances --db-instance-identifier MuniRcmStack-Database

# Test connection with psql
psql -h $RDS_ENDPOINT -U $DB_USER -d $DB_NAME
```

### 7.2 Reset Commands

```bash
# Reset infrastructure (WARNING: Destroys all data)
npm run destroy-infra

# Reset local development
rm -rf node_modules infra/node_modules agents/*/venv
npm install
./scripts/bootstrap.sh
```

## Step 8: Next Steps After Bootstrap

1. **Customize Agent Logic**: Edit agent handlers in `agents/*/handler.py`
2. **Implement UI Components**: Add React components in `components/`
3. **Configure Authentication**: Set up AWS Amplify Auth
4. **Add Real Data Models**: Implement Amplify Data schema
5. **Connect to Claim MD**: Add real API integration
6. **Testing**: Write unit and integration tests
7. **Monitoring**: Set up CloudWatch dashboards
8. **Production Setup**: Configure production environment variables

This bootstrap guide provides a complete foundation that Claude Code can build upon to create the full Muni AI RCM Platform with minimal manual intervention.