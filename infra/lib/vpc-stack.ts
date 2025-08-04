import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC with private subnets for HIPAA compliance
    this.vpc = new ec2.Vpc(this, 'MuniRcmVpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 3,
      natGateways: 2, // High availability
      
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          mapPublicIpOnLaunch: false,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],

      // Enable DNS
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // VPC Flow Logs for security monitoring
    new ec2.FlowLog(this, 'VpcFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    // Security group for Lambda functions
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for RCM Lambda functions',
      allowAllOutbound: true, // Lambda needs outbound for AWS services
    });

    // Security group for RDS database
    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for RDS PostgreSQL database',
      allowAllOutbound: false,
    });

    // Allow Lambda to connect to RDS
    databaseSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda functions to connect to PostgreSQL'
    );

    // VPC Endpoints for AWS services (reduce NAT costs and improve security)
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [
        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // Interface endpoints for other AWS services
    const interfaceEndpoints = [
      'lambda',
      'rds',
      'secretsmanager',
      'kms',
      'logs',
      'monitoring',
      'events',
      'bedrock-runtime',
    ];

    interfaceEndpoints.forEach(service => {
      this.vpc.addInterfaceEndpoint(`${service}Endpoint`, {
        service: new ec2.InterfaceVpcEndpointAwsService(service),
        subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [lambdaSecurityGroup],
      });
    });

    // Export security group IDs for use in other stacks
    new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
      value: lambdaSecurityGroup.securityGroupId,
      description: 'Security Group ID for Lambda functions',
      exportName: 'MuniRcm-LambdaSecurityGroup',
    });

    new cdk.CfnOutput(this, 'DatabaseSecurityGroupId', {
      value: databaseSecurityGroup.securityGroupId,
      description: 'Security Group ID for RDS database',
      exportName: 'MuniRcm-DatabaseSecurityGroup',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID for Muni RCM platform',
      exportName: 'MuniRcm-VpcId',
    });
  }
}