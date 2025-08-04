# Deployment Guide - Muni AI RCM Platform

## Overview

This guide covers the complete deployment process for the Muni AI RCM Platform, from initial AWS setup to production deployment and ongoing maintenance. The platform uses AWS Amplify for frontend hosting and AWS CDK for infrastructure management.

## Prerequisites

### Required Accounts and Permissions

1. **AWS Account**
   - Administrative access for initial setup
   - Production account separate from development
   - Business Associate Agreement (BAA) signed with AWS

2. **Required CLI Tools**
   ```bash
   # AWS CLI v2
   aws --version  # Should be 2.x.x or higher
   
   # Amplify CLI
   npm install -g @aws-amplify/cli
   
   # CDK CLI
   npm install -g aws-cdk
   
   # Node.js & npm
   node --version  # Should be 18.x or higher
   npm --version   # Should be 8.x or higher
   ```

3. **Required Permissions**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "amplify:*",
           "cloudformation:*",
           "iam:*",
           "lambda:*",
           "dynamodb:*",
           "s3:*",
           "cognito-idp:*",
           "bedrock:*",
           "secretsmanager:*",
           "ec2:*",
           "rds:*",
           "apigateway:*"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

### Environment Setup

```bash
# Configure AWS credentials
aws configure
# AWS Access Key ID: [Your access key]
# AWS Secret Access Key: [Your secret key]
# Default region name: us-east-1
# Default output format: json

# Verify AWS configuration
aws sts get-caller-identity
```

## Infrastructure Deployment

### Phase 1: Core Infrastructure (CDK)

Deploy the foundational AWS infrastructure first.

```bash
# Navigate to infrastructure directory
cd infra

# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy all stacks
cdk deploy --all --require-approval never

# Or deploy stacks individually
cdk deploy MuniRcmVpcStack
cdk deploy MuniRcmSecurityStack
cdk deploy MuniRcmDatabaseStack
cdk deploy MuniRcmAgentsStack
cdk deploy MuniRcmApiGatewayStack
```

#### CDK Stack Dependencies

```typescript
// Deployment order is important
const deploymentOrder = [
  'MuniRcmVpcStack',        // 1. Network foundation
  'MuniRcmSecurityStack',   // 2. IAM roles and policies
  'MuniRcmDatabaseStack',   // 3. RDS and DynamoDB
  'MuniRcmAgentsStack',     // 4. Lambda functions
  'MuniRcmApiGatewayStack'  // 5. API endpoints
];
```

#### Infrastructure Validation

```bash
# Validate all stacks are deployed
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Test database connectivity
aws rds describe-db-instances --query 'DBInstances[0].Endpoint'

# Verify Lambda functions
aws lambda list-functions --query 'Functions[].FunctionName'

# Check VPC configuration
aws ec2 describe-vpcs --filters "Name=tag:Project,Values=MuniRcm"
```

### Phase 2: Application Backend (Amplify)

Deploy the Amplify backend for authentication and data management.

```bash
# Navigate to app directory
cd app

# Install dependencies
npm install

# Initialize Amplify project (first time only)
npx ampx configure profile
npx ampx sandbox --profile [your-profile]

# Deploy to production
npx ampx pipeline-deploy --branch main --app-id [your-app-id]
```

#### Amplify Configuration

Create `amplify.yml` for build configuration:

```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - npm ci
        - npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

### Phase 3: Frontend Application

Deploy the Next.js application through Amplify Hosting.

```bash
# Build and test locally first
npm run build
npm run start

# Verify build artifacts
ls -la .next/

# Deploy through Amplify console or CLI
```

## Environment Configuration

### Development Environment

```bash
# Environment variables for development
cat > .env.local << EOF
# Development settings
NODE_ENV=development
NEXT_PUBLIC_DEV_MODE=true

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Agent Configuration
AGENT_DEVELOPMENT_MODE=true
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# Database
DATABASE_URL=postgresql://localhost:5432/muni_rcm_dev

# Security
NEXTAUTH_SECRET=your-dev-secret-here
NEXTAUTH_URL=http://localhost:3000
EOF
```

### Staging Environment

```bash
# Staging environment configuration
cat > .env.staging << EOF
# Staging settings
NODE_ENV=staging
NEXT_PUBLIC_DEV_MODE=false

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Agent Configuration
AGENT_DEVELOPMENT_MODE=false
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# Database
DATABASE_URL=${DATABASE_URL_STAGING}

# Security
NEXTAUTH_SECRET=${NEXTAUTH_SECRET_STAGING}
NEXTAUTH_URL=https://staging.muni-rcm.com
EOF
```

### Production Environment

```bash
# Production environment (use AWS Secrets Manager)
aws secretsmanager create-secret \
  --name "muni-rcm/production/config" \
  --description "Production configuration for Muni RCM" \
  --secret-string '{
    "NODE_ENV": "production",
    "DATABASE_URL": "postgresql://...",
    "NEXTAUTH_SECRET": "...",
    "BEDROCK_MODEL_ID": "anthropic.claude-3-sonnet-20240229-v1:0",
    "ENCRYPTION_KEY": "...",
    "WEBHOOK_SECRET": "..."
  }'
```

## Database Setup

### RDS PostgreSQL Configuration

```bash
# Create database and user
psql -h your-rds-endpoint -U postgres -d postgres

CREATE DATABASE muni_rcm_prod;
CREATE USER muni_rcm_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE muni_rcm_prod TO muni_rcm_user;

# Enable required extensions
\c muni_rcm_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Database Migration

```bash
# Run database migrations (if using a migration tool)
npm run db:migrate

# Or manually execute schema
psql -h your-rds-endpoint -U muni_rcm_user -d muni_rcm_prod -f schema.sql
```

### DynamoDB Table Verification

```bash
# Verify Amplify Data tables are created
aws dynamodb list-tables --query 'TableNames' | grep -i patient

# Check table configuration
aws dynamodb describe-table --table-name Patient-[environment-id]
```

## Agent Deployment

### Lambda Function Deployment

```bash
# Deploy individual agents
cd agents/CodingAgent
zip -r function.zip .
aws lambda update-function-code \
  --function-name CodingAgent \
  --zip-file fileb://function.zip

# Deploy all agents using script
./scripts/deploy-all-agents.sh
```

### Agent Configuration

```bash
# Update environment variables for each agent
aws lambda update-function-configuration \
  --function-name CodingAgent \
  --environment Variables='{
    "BEDROCK_MODEL_ID": "anthropic.claude-3-sonnet-20240229-v1:0",
    "DATABASE_URL": "'$DATABASE_URL'",
    "DEVELOPMENT_MODE": "false"
  }'
```

### Agent Testing

```bash
# Test agent deployment
aws lambda invoke \
  --function-name CodingAgent \
  --payload '{"test": true}' \
  response.json

cat response.json
```

## Security Configuration

### SSL/TLS Certificate Setup

```bash
# Request certificate through ACM
aws acm request-certificate \
  --domain-name muni-rcm.com \
  --domain-name "*.muni-rcm.com" \
  --validation-method DNS \
  --subject-alternative-names api.muni-rcm.com

# Validate certificate (follow DNS instructions)
aws acm describe-certificate --certificate-arn [certificate-arn]
```

### WAF Configuration

```bash
# Deploy WAF rules
aws wafv2 create-web-acl \
  --name MuniRcmWAF \
  --scope CLOUDFRONT \
  --default-action Allow={} \
  --rules file://waf-rules.json
```

### Secrets Management

```bash
# Create all required secrets
aws secretsmanager create-secret \
  --name "muni-rcm/database/password" \
  --secret-string "your-secure-database-password"

aws secretsmanager create-secret \
  --name "muni-rcm/api-keys/claim-md" \
  --secret-string "your-claim-md-api-key"

aws secretsmanager create-secret \
  --name "muni-rcm/encryption/key" \
  --secret-string "your-encryption-key"
```

## Monitoring and Logging

### CloudWatch Dashboard

```bash
# Create monitoring dashboard
aws cloudwatch put-dashboard \
  --dashboard-name MuniRcmProduction \
  --dashboard-body file://monitoring-dashboard.json
```

### Log Group Configuration

```bash
# Create log groups with retention
aws logs create-log-group --log-group-name /aws/lambda/CodingAgent
aws logs put-retention-policy \
  --log-group-name /aws/lambda/CodingAgent \
  --retention-in-days 365
```

### Alerts Setup

```bash
# Create CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name "MuniRcm-HighErrorRate" \
  --alarm-description "High error rate alert" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-infrastructure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install CDK dependencies
        run: |
          cd infra
          npm ci
      
      - name: Deploy infrastructure
        run: |
          cd infra
          npx cdk deploy --all --require-approval never
  
  deploy-agents:
    needs: deploy-infrastructure
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy agents
        run: |
          ./scripts/deploy-all-agents.sh
  
  deploy-frontend:
    needs: [deploy-infrastructure, deploy-agents]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd app
          npm ci
      
      - name: Deploy Amplify backend
        run: |
          cd app
          npx ampx pipeline-deploy --branch main --app-id ${{ secrets.AMPLIFY_APP_ID }}
```

## Health Checks and Validation

### Application Health Check

```typescript
// Create health check endpoint
// app/api/health/route.ts
export async function GET() {
  try {
    // Check database connectivity
    const dbStatus = await checkDatabaseHealth();
    
    // Check external dependencies
    const servicesStatus = await checkExternalServices();
    
    // Check agent availability
    const agentsStatus = await checkAgentHealth();
    
    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        database: dbStatus,
        services: servicesStatus,
        agents: agentsStatus
      }
    });
  } catch (error) {
    return Response.json(
      { status: 'unhealthy', error: error.message },
      { status: 503 }
    );
  }
}
```

### Deployment Validation Script

```bash
#!/bin/bash
# validate-deployment.sh

echo "Validating Muni RCM deployment..."

# Check frontend accessibility
curl -f https://muni-rcm.com/api/health || exit 1

# Check database connectivity
aws rds describe-db-instances --db-instance-identifier muni-rcm-prod --query 'DBInstances[0].DBInstanceStatus' | grep -q "available" || exit 1

# Check Lambda functions
for agent in CodingAgent EligibilityAgent SubmitClaimAgent ERAParserAgent; do
  aws lambda get-function --function-name $agent > /dev/null || exit 1
done

# Check API Gateway
aws apigateway get-rest-apis --query 'items[?name==`MuniRcmApi`].id' --output text | grep -q . || exit 1

echo "Deployment validation successful!"
```

## Rollback Procedures

### Infrastructure Rollback

```bash
# Rollback CDK stacks to previous version
cdk deploy --rollback

# Or rollback specific stack
aws cloudformation cancel-update-stack --stack-name MuniRcmAgentsStack
aws cloudformation continue-update-rollback --stack-name MuniRcmAgentsStack
```

### Application Rollback

```bash
# Rollback Amplify deployment
aws amplify start-job \
  --app-id [app-id] \
  --branch-name main \
  --job-type RELEASE \
  --job-id [previous-job-id]

# Rollback Lambda functions
aws lambda update-function-code \
  --function-name CodingAgent \
  --s3-bucket [backup-bucket] \
  --s3-key [previous-version-key]
```

## Backup and Recovery

### Database Backup

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier muni-rcm-prod \
  --db-snapshot-identifier muni-rcm-backup-$(date +%Y%m%d-%H%M%S)

# Schedule automated backups
aws rds modify-db-instance \
  --db-instance-identifier muni-rcm-prod \
  --backup-retention-period 30 \
  --backup-window "03:00-04:00"
```

### Application Backup

```bash
# Backup S3 data
aws s3 sync s3://muni-rcm-data s3://muni-rcm-backup/$(date +%Y%m%d)

# Backup DynamoDB tables
aws dynamodb create-backup \
  --table-name Patient-[environment] \
  --backup-name Patient-backup-$(date +%Y%m%d)
```

## Performance Optimization

### CDN Configuration

```bash
# Configure CloudFront distribution
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json
```

### Auto Scaling

```bash
# Configure Lambda concurrency
aws lambda put-provisioned-concurrency-config \
  --function-name CodingAgent \
  --qualifier '$LATEST' \
  --provisioned-concurrency-config \
  ProvisionedConcurrencyConfig=10
```

## Maintenance Procedures

### Regular Maintenance Tasks

```bash
# Weekly maintenance script
#!/bin/bash

# Update security patches
aws ssm send-command \
  --document-name "AWS-RunPatchBaseline" \
  --targets "Key=tag:Environment,Values=Production"

# Rotate secrets
aws secretsmanager rotate-secret \
  --secret-id muni-rcm/database/password

# Clean up old logs
aws logs delete-log-group --log-group-name /aws/lambda/old-function

# Backup verification
./scripts/verify-backups.sh
```

### Cost Optimization

```bash
# Review and optimize costs monthly
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

## Troubleshooting

### Common Deployment Issues

1. **CDK Bootstrap Issues**
   ```bash
   # Re-bootstrap if needed
   cdk bootstrap --force
   ```

2. **Lambda Deployment Failures**
   ```bash
   # Check function logs
   aws logs tail /aws/lambda/CodingAgent --follow
   ```

3. **Database Connection Issues**
   ```bash
   # Test connectivity
   aws rds describe-db-instances --query 'DBInstances[0].Endpoint'
   ```

4. **Amplify Build Failures**
   ```bash
   # Check build logs in Amplify console
   aws amplify list-jobs --app-id [app-id] --branch-name main
   ```

## Support and Maintenance

### Monitoring Checklist

- [ ] All health checks passing
- [ ] No critical CloudWatch alarms
- [ ] Database performance within limits
- [ ] Lambda error rates < 1%
- [ ] API response times < 2s
- [ ] Backup verification successful

### Emergency Contacts

- **Primary On-Call**: [contact-info]
- **Secondary On-Call**: [contact-info]
- **AWS Support**: Enterprise support case
- **Security Team**: [contact-info]

## Summary

The deployment process involves:
1. Infrastructure deployment via CDK
2. Backend deployment via Amplify
3. Agent deployment via Lambda
4. Security configuration
5. Monitoring setup
6. Validation and testing

Following this guide ensures a secure, scalable, and maintainable production deployment of the Muni AI RCM Platform.