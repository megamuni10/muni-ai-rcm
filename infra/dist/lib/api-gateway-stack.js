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
exports.ApiGatewayStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class ApiGatewayStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // CloudWatch log group for API Gateway
        const logGroup = new logs.LogGroup(this, 'ApiGatewayLogGroup', {
            logGroupName: '/aws/apigateway/muni-rcm-webhooks',
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // API Gateway for external webhooks
        this.api = new apigateway.RestApi(this, 'MuniRcmWebhooksApi', {
            restApiName: 'Muni RCM Webhooks API',
            description: 'API Gateway for external system webhooks (Claim.MD, EHR systems)',
            // API Gateway configuration
            deployOptions: {
                stageName: 'v1',
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
                accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                    caller: true,
                    httpMethod: true,
                    ip: true,
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    user: true,
                }),
            },
            // CORS configuration
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: ['POST', 'OPTIONS'],
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                ],
            },
            // Security
            policy: new iam.PolicyDocument({
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        principals: [new iam.AnyPrincipal()],
                        actions: ['execute-api:Invoke'],
                        resources: ['*'],
                        conditions: {
                            IpAddress: {
                                'aws:SourceIp': [
                                    // Add known IP ranges for Claim.MD, EHR systems, etc.
                                    '0.0.0.0/0', // TODO: Restrict to known IPs in production
                                ],
                            },
                        },
                    }),
                ],
            }),
        });
        // Create webhook endpoints
        this.createWebhookEndpoints(props.agentFunctions);
        // API Key for authenticated access
        const apiKey = this.api.addApiKey('WebhooksApiKey', {
            apiKeyName: 'muni-rcm-webhooks-key',
            description: 'API key for Muni RCM webhook endpoints',
        });
        // Usage plan
        const usagePlan = this.api.addUsagePlan('WebhooksUsagePlan', {
            name: 'Muni RCM Webhooks Usage Plan',
            description: 'Usage plan for webhook endpoints',
            throttle: {
                rateLimit: 100,
                burstLimit: 200,
            },
            quota: {
                limit: 10000,
                period: apigateway.Period.MONTH,
            },
        });
        usagePlan.addApiKey(apiKey);
        usagePlan.addApiStage({
            stage: this.api.deploymentStage,
        });
        // Outputs
        new cdk.CfnOutput(this, 'ApiGatewayUrl', {
            value: this.api.url,
            description: 'API Gateway URL for webhooks',
            exportName: 'MuniRcm-ApiGatewayUrl',
        });
        new cdk.CfnOutput(this, 'ApiKeyId', {
            value: apiKey.keyId,
            description: 'API Key ID for webhook authentication',
            exportName: 'MuniRcm-ApiKeyId',
        });
    }
    createWebhookEndpoints(agentFunctions) {
        // Root webhook resource
        const webhooks = this.api.root.addResource('webhook');
        // ERA webhook endpoint
        const eraResource = webhooks.addResource('era');
        eraResource.addMethod('POST', new apigateway.LambdaIntegration(agentFunctions.ERAParserAgent), {
            apiKeyRequired: true,
            requestValidator: new apigateway.RequestValidator(this, 'EraRequestValidator', {
                restApi: this.api,
                validateRequestBody: true,
                validateRequestParameters: true,
            }),
            requestModels: {
                'application/json': this.createEraRequestModel(),
            },
        });
        // Denial webhook endpoint  
        const denialResource = webhooks.addResource('denial');
        denialResource.addMethod('POST', new apigateway.LambdaIntegration(agentFunctions.DenialClassifierAgent), {
            apiKeyRequired: true,
        });
        // Claim status webhook endpoint for Claim MD updates
        const claimStatusResource = webhooks.addResource('claim-status');
        claimStatusResource.addMethod('POST', new apigateway.LambdaIntegration(agentFunctions.ERAParserAgent), {
            apiKeyRequired: true,
            requestValidator: new apigateway.RequestValidator(this, 'ClaimStatusRequestValidator', {
                restApi: this.api,
                validateRequestBody: true,
            }),
            requestModels: {
                'application/json': this.createClaimStatusRequestModel(),
            },
        });
        // Chart/EHR webhook endpoint
        const chartResource = webhooks.addResource('chart');
        chartResource.addMethod('POST', new apigateway.LambdaIntegration(agentFunctions.CodingAgent), {
            apiKeyRequired: true,
            requestValidator: new apigateway.RequestValidator(this, 'ChartRequestValidator', {
                restApi: this.api,
                validateRequestBody: true,
            }),
            requestModels: {
                'application/json': this.createChartRequestModel(),
            },
        });
        // Health check endpoint
        const healthResource = this.api.root.addResource('health');
        healthResource.addMethod('GET', new apigateway.MockIntegration({
            integrationResponses: [
                {
                    statusCode: '200',
                    responseTemplates: {
                        'application/json': JSON.stringify({
                            status: 'healthy',
                            timestamp: '$context.requestTime',
                            version: 'v1',
                        }),
                    },
                },
            ],
            requestTemplates: {
                'application/json': '{"statusCode": 200}',
            },
        }), {
            methodResponses: [
                {
                    statusCode: '200',
                    responseModels: {
                        'application/json': apigateway.Model.EMPTY_MODEL,
                    },
                },
            ],
        });
    }
    createEraRequestModel() {
        return new apigateway.Model(this, 'EraRequestModel', {
            restApi: this.api,
            contentType: 'application/json',
            description: 'Model for ERA webhook requests',
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                required: ['eraFileUrl', 'source'],
                properties: {
                    eraFileUrl: {
                        type: apigateway.JsonSchemaType.STRING,
                        description: 'S3 URL to the 835 ERA file',
                    },
                    source: {
                        type: apigateway.JsonSchemaType.STRING,
                        description: 'Source system (e.g., Claim.MD)',
                        enum: ['Claim.MD', 'manual_upload', 'direct_payer'],
                    },
                    claimIds: {
                        type: apigateway.JsonSchemaType.ARRAY,
                        description: 'List of claim IDs to process',
                        items: {
                            type: apigateway.JsonSchemaType.STRING,
                        },
                    },
                    metadata: {
                        type: apigateway.JsonSchemaType.OBJECT,
                        description: 'Additional metadata',
                        properties: {
                            payerName: { type: apigateway.JsonSchemaType.STRING },
                            paymentDate: { type: apigateway.JsonSchemaType.STRING },
                            totalAmount: { type: apigateway.JsonSchemaType.NUMBER },
                        },
                    },
                },
            },
        });
    }
    createChartRequestModel() {
        return new apigateway.Model(this, 'ChartRequestModel', {
            restApi: this.api,
            contentType: 'application/json',
            description: 'Model for chart/EHR webhook requests',
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                required: ['patientId', 'encounterId'],
                properties: {
                    patientId: {
                        type: apigateway.JsonSchemaType.STRING,
                        description: 'Patient identifier',
                    },
                    encounterId: {
                        type: apigateway.JsonSchemaType.STRING,
                        description: 'Encounter identifier',
                    },
                    chartNotes: {
                        type: apigateway.JsonSchemaType.STRING,
                        description: 'Clinical documentation',
                    },
                    source: {
                        type: apigateway.JsonSchemaType.STRING,
                        description: 'EHR system source',
                        enum: ['1upHealth', 'Epic', 'Cerner', 'AllScripts'],
                    },
                    metadata: {
                        type: apigateway.JsonSchemaType.OBJECT,
                        description: 'Additional encounter metadata',
                        properties: {
                            visitType: { type: apigateway.JsonSchemaType.STRING },
                            provider: { type: apigateway.JsonSchemaType.STRING },
                            dateOfService: { type: apigateway.JsonSchemaType.STRING },
                        },
                    },
                },
            },
        });
    }
    createClaimStatusRequestModel() {
        return new apigateway.Model(this, 'ClaimStatusRequestModel', {
            restApi: this.api,
            contentType: 'application/json',
            description: 'Model for Claim MD status webhook requests',
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                required: ['claimId', 'status'],
                properties: {
                    claimId: {
                        type: apigateway.JsonSchemaType.STRING,
                        description: 'Claim identifier from our system',
                    },
                    claimmdClaimId: {
                        type: apigateway.JsonSchemaType.STRING,
                        description: 'Claim MD internal claim identifier',
                    },
                    batchId: {
                        type: apigateway.JsonSchemaType.STRING,
                        description: 'Claim MD batch identifier',
                    },
                    status: {
                        type: apigateway.JsonSchemaType.STRING,
                        description: 'Current claim status',
                        enum: ['accepted', 'rejected', 'submitted', 'paid', 'denied'],
                    },
                    errors: {
                        type: apigateway.JsonSchemaType.ARRAY,
                        description: 'List of validation errors if rejected',
                        items: {
                            type: apigateway.JsonSchemaType.OBJECT,
                            properties: {
                                code: { type: apigateway.JsonSchemaType.STRING },
                                message: { type: apigateway.JsonSchemaType.STRING },
                                field: { type: apigateway.JsonSchemaType.STRING },
                            },
                        },
                    },
                    paymentInfo: {
                        type: apigateway.JsonSchemaType.OBJECT,
                        description: 'Payment information if paid',
                        properties: {
                            paidAmount: { type: apigateway.JsonSchemaType.NUMBER },
                            adjustmentAmount: { type: apigateway.JsonSchemaType.NUMBER },
                            patientResponsibility: { type: apigateway.JsonSchemaType.NUMBER },
                            paymentDate: { type: apigateway.JsonSchemaType.STRING },
                        },
                    },
                    timestamp: {
                        type: apigateway.JsonSchemaType.STRING,
                        description: 'Status update timestamp',
                    },
                },
            },
        });
    }
}
exports.ApiGatewayStack = ApiGatewayStack;
//# sourceMappingURL=api-gateway-stack.js.map