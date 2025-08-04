#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from './lib/vpc-stack';
import { DatabaseStack } from './lib/database-stack';
import { AgentsStack } from './lib/agents-stack';
import { ApiGatewayStack } from './lib/api-gateway-stack';
import { SecurityStack } from './lib/security-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Security and networking foundation
const securityStack = new SecurityStack(app, 'MuniRcmSecurityStack', {
  env,
  description: 'Security resources for Muni Health RCM platform',
});

const vpcStack = new VpcStack(app, 'MuniRcmVpcStack', {
  env,
  description: 'VPC and networking for Muni Health RCM platform',
});

// Database layer
const databaseStack = new DatabaseStack(app, 'MuniRcmDatabaseStack', {
  env,
  vpc: vpcStack.vpc,
  description: 'RDS and S3 resources for Muni Health RCM platform',
});

// Lambda agents
const agentsStack = new AgentsStack(app, 'MuniRcmAgentsStack', {
  env,
  vpc: vpcStack.vpc,
  database: databaseStack.database,
  s3Bucket: databaseStack.s3Bucket,
  description: 'Python Lambda agents for RCM workflows',
});

// API Gateway for webhooks
const apiGatewayStack = new ApiGatewayStack(app, 'MuniRcmApiGatewayStack', {
  env,
  agentFunctions: agentsStack.agentFunctions,
  description: 'API Gateway for external webhooks',
});

// Add dependencies
databaseStack.addDependency(vpcStack);
databaseStack.addDependency(securityStack);
agentsStack.addDependency(databaseStack);
apiGatewayStack.addDependency(agentsStack);

// Tags for all resources
const commonTags = {
  Project: 'MuniHealthRCM',
  Environment: app.node.tryGetContext('environment') || 'development',
  Owner: 'MuniHealth',
  CostCenter: 'RCM-Platform',
  Compliance: 'HIPAA',
};

Object.keys(commonTags).forEach(key => {
  cdk.Tags.of(app).add(key, commonTags[key as keyof typeof commonTags]);
});