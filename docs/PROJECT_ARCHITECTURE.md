# Project Architecture - Muni AI RCM Platform

## Overview

The Muni AI RCM Platform is an **AI-native Revenue Cycle Management system** built for healthcare organizations. It automates the entire RCM workflow from patient registration through payment collection using intelligent agents, providing a Devin-like autonomous experience for healthcare finance operations.

## Core Architecture Principles

### 1. **Agent-Native Design**
- Every RCM function is implemented as an isolated Python Lambda agent
- Agents are stateless microservices with specific responsibilities
- Each agent has its own IAM role, logging, and error handling
- Agents communicate through structured JSON schemas

### 2. **Full-Stack Monolithic Frontend**
- Next.js 14 App Router handles both UI and backend logic
- Server Actions replace traditional API endpoints
- TypeScript throughout for type safety
- Role-based UI adapts to user permissions

### 3. **HIPAA-Compliant Infrastructure**
- All services run in private VPC subnets
- End-to-end encryption for PHI data
- Comprehensive audit logging
- AWS-only deployment with single BAA

### 4. **Autonomous Workflow System**
- Guided, step-by-step claim processing
- Real-time status tracking and transparency
- Intelligent task prioritization
- Devin-like user experience for complex operations

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         External Systems                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │Manual Data Entry│  │   Claim MD   │  │Payment Posting│              │
│  │   (Ops Team)   │  │ (API/Webhooks)│  │   (Manual)    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼──────────────────┼──────────────────┼────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ /webhook/era │  │/webhook/denial│  │/webhook/status│              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼──────────────────┼──────────────────┼────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Agent Lambda Functions (Python)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ERAParserAgent│  │DenialClassify│  │ CodingAgent  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │EligibilityAgt│  │ SubmitClaim  │  │AppealLetter  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Next.js Application                             │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │                    App Router (UI Layer)                  │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │       │
│  │  │Admin Dashboard│ │Ops Dashboard│ │Provider Portal│      │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │       │
│  └─────────────────────────────────────────────────────────┘       │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │                Server Actions (Backend Logic)             │       │
│  │  • submitClaim()      • checkEligibility()               │       │
│  │  • processEHRData()   • generateAppeal()                 │       │
│  │  • startWorkflow()    • updateWorkflowStep()             │       │
│  └─────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │RDS PostgreSQL│  │  S3 Buckets  │  │  DynamoDB    │              │
│  │ (Encrypted)  │  │(PHI Storage) │  │(Session Data)│              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AWS Services Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │AWS Bedrock   │  │ EventBridge  │  │Step Functions│              │
│  │(Nova Pro LLM)│  │(Event Router)│  │ (Workflows)  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Cognito    │  │Secrets Mgr   │  │ CloudWatch   │              │
│  │(Multi-role)  │  │(Credentials) │  │(Logs/Metrics)│              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend Application (Next.js)

**Technology Stack:**
- Next.js 14 with App Router
- TypeScript for type safety
- Server Components for SSR
- Server Actions for backend logic
- Amplify hosting and CI/CD

**Key Features:**
- Role-based dashboards (Admin, Ops, Provider)
- Real-time status updates via subscriptions
- Performance dashboards and financial reporting for providers
- Guided workflow system
- Responsive, accessible UI

### Agent Lambda Functions

Each agent is a specialized Python Lambda that handles specific RCM tasks:

**Core Agents:**
- **CodingAgent**: AI-powered CPT/ICD code generation from clinical notes
- **EligibilityAgent**: Real-time insurance verification (270/271)
- **SubmitClaimAgent**: JSON claim submission to Claim MD API
- **ERAParserAgent**: 835 remittance advice processing
- **DenialClassifierAgent**: Intelligent denial categorization
- **AppealLetterAgent**: Automated appeal generation

**Agent Standards:**
- Python 3.11+ runtime
- Structured logging to CloudWatch
- Input/output validation via JSON schemas
- Development mode with realistic mock data
- Error handling and retry logic

### Data Architecture

**Primary Database (RDS PostgreSQL):**
- Encrypted at rest and in transit
- Multi-AZ deployment for HA
- Daily automated backups
- Role-based access control

**Key Tables:**
- `users` - Multi-role user management
- `patients` - Demographics and insurance
- `claims` - Comprehensive claim tracking with Claim MD integration fields
- `workflow_states` - Guided workflow progress
- `agent_runs` - AI execution audit trail
- `audit_logs` - HIPAA compliance logging

**S3 Storage:**
- PHI-compliant encrypted buckets
- Versioning enabled
- Access logging
- Lifecycle policies for archival

### Infrastructure Components

**VPC Architecture:**
- Private subnets for all compute
- VPC endpoints for AWS services
- NAT gateways for outbound traffic
- Security groups with least privilege

**IAM Security:**
- Role per Lambda function
- Cross-account assume roles
- MFA for admin access
- Regular credential rotation

**Monitoring & Observability:**
- CloudWatch Logs for all components
- Custom metrics for business KPIs
- Alarms for critical events
- X-Ray tracing for performance

## Development Architecture

### Monorepo Structure

```
muni-ai-rcm/
├── app/                    # Next.js application
│   ├── app/               # App Router pages and layouts
│   ├── lib/               # Server actions and utilities
│   └── amplify/           # Auth and data configuration
├── agents/                 # Python Lambda functions
│   ├── CodingAgent/
│   ├── EligibilityAgent/
│   └── ...
├── infra/                  # CDK infrastructure
│   └── lib/               # Stack definitions
├── schemas/                # JSON API contracts
├── scripts/                # Dev and deployment tools
└── docs/                   # Documentation
```

### Development Workflow

1. **Local Development**
   - `npm run dev` for Next.js frontend
   - `scripts/run-local-agent.sh` for Lambda testing
   - Mock data mode for offline development

2. **Testing Strategy**
   - Unit tests for business logic
   - Integration tests for agent workflows
   - E2E tests for critical user paths

3. **Deployment Pipeline**
   - GitHub Actions for CI/CD
   - Amplify auto-deploy for frontend
   - CDK deploy for infrastructure
   - Blue-green deployments for zero downtime

## Security Architecture

### HIPAA Compliance

- **Encryption**: AES-256 for data at rest, TLS ≥ 1.2 in transit
- **Access Control**: Role-based with principle of least privilege
- **Audit Logging**: Comprehensive tracking of all PHI access
- **Data Retention**: Configurable policies per data type
- **Incident Response**: Automated alerting and response procedures

### Network Security

- **Private VPC**: All compute resources in private subnets
- **WAF**: Web application firewall on API Gateway
- **DDoS Protection**: AWS Shield Standard
- **Secret Management**: AWS Secrets Manager with rotation

## Scalability & Performance

### Auto-scaling Strategy

- **Lambda Concurrency**: Reserved capacity for critical agents
- **RDS Read Replicas**: For read-heavy workloads
- **CloudFront CDN**: For static asset delivery
- **SQS Queues**: For async processing and buffering

### Performance Optimization

- **Caching**: Redis for session and frequent queries
- **Connection Pooling**: RDS Proxy for database connections
- **Code Splitting**: Next.js automatic optimization
- **Image Optimization**: Next.js Image component

## Integration Architecture

### External System Integration

**Service-Based RCM Model:**
- Internal ops team has remote access credentials to client EHRs
- Team monitors encounter lists for completed visits
- Extracts data from EHR and enters into our platform
- AI processes claims automatically
- Ops team posts payments back to client EHR via remote access
- Providers only see dashboards and reports, no data entry required

**Payer Systems (via Claim MD):**
- Claim MD handles all X12 EDI generation and validation
- REST API for JSON claim submission
- Real-time eligibility checks (270/271)
- Webhook notifications for claim status updates
- Batch upload support (up to 2000 claims per API call)

### Event-Driven Architecture

- **EventBridge**: Central event router
- **Step Functions**: Complex workflow orchestration
- **SQS/SNS**: Decoupled message passing
- **Lambda Destinations**: Error handling and retries

## Cost Optimization

### Resource Management

- **Lambda**: Pay-per-use with provisioned concurrency for critical paths
- **RDS**: Reserved instances for predictable workloads
- **S3**: Intelligent tiering for cost-effective storage
- **Data Transfer**: VPC endpoints to minimize costs

### Monitoring & Optimization

- **Cost Explorer**: Track spending by service and tag
- **Trusted Advisor**: Automated optimization recommendations
- **Reserved Capacity**: For predictable workloads
- **Spot Instances**: For batch processing jobs

## Future Architecture Considerations

### Planned Enhancements

1. **Multi-Region Support**: DR and global expansion
2. **Advanced Analytics**: Real-time BI dashboards
3. **ML Model Training**: Custom models on claim data
4. **Mobile Applications**: Native iOS/Android apps
5. **Advanced Integrations**: Direct payer APIs

### Architecture Evolution

- Maintain backward compatibility
- Feature flags for gradual rollouts
- Comprehensive testing before major changes
- Regular architecture reviews