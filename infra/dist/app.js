#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const vpc_stack_1 = require("./lib/vpc-stack");
const database_stack_1 = require("./lib/database-stack");
const agents_stack_1 = require("./lib/agents-stack");
const api_gateway_stack_1 = require("./lib/api-gateway-stack");
const security_stack_1 = require("./lib/security-stack");
const app = new cdk.App();
// Environment configuration
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};
// Security and networking foundation
const securityStack = new security_stack_1.SecurityStack(app, 'MuniRcmSecurityStack', {
    env,
    description: 'Security resources for Muni Health RCM platform',
});
const vpcStack = new vpc_stack_1.VpcStack(app, 'MuniRcmVpcStack', {
    env,
    description: 'VPC and networking for Muni Health RCM platform',
});
// Database layer
const databaseStack = new database_stack_1.DatabaseStack(app, 'MuniRcmDatabaseStack', {
    env,
    vpc: vpcStack.vpc,
    description: 'RDS and S3 resources for Muni Health RCM platform',
});
// Lambda agents
const agentsStack = new agents_stack_1.AgentsStack(app, 'MuniRcmAgentsStack', {
    env,
    vpc: vpcStack.vpc,
    database: databaseStack.database,
    s3Bucket: databaseStack.s3Bucket,
    description: 'Python Lambda agents for RCM workflows',
});
// API Gateway for webhooks
const apiGatewayStack = new api_gateway_stack_1.ApiGatewayStack(app, 'MuniRcmApiGatewayStack', {
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
    cdk.Tags.of(app).add(key, commonTags[key]);
});
//# sourceMappingURL=app.js.map