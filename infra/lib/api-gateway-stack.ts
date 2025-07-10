import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface ApiGatewayStackProps extends cdk.StackProps {
  agentFunctions: { [key: string]: lambda.Function };
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
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
        accessLogDestination: apigateway.LogGroupLogDestination.fromLogGroup(logGroup),
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
        rateLimit: 100, // requests per second
        burstLimit: 200,
      },
      quota: {
        limit: 10000, // requests per month
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

  private createWebhookEndpoints(agentFunctions: { [key: string]: lambda.Function }) {
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

    // Denial webhook endpoint (future DenialClassifierAgent)
    const denialResource = webhooks.addResource('denial');
    denialResource.addMethod('POST', new apigateway.LambdaIntegration(agentFunctions.ERAParserAgent), {
      apiKeyRequired: true,
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

  private createEraRequestModel(): apigateway.Model {
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

  private createChartRequestModel(): apigateway.Model {
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
}