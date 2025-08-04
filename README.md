# Muni AI RCM Platform

**AI-Native Revenue Cycle Management for Healthcare Organizations**

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![AWS Amplify](https://img.shields.io/badge/AWS-Amplify-orange)](https://aws.amazon.com/amplify/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11-blue)](https://www.python.org/)
[![HIPAA Compliant](https://img.shields.io/badge/HIPAA-Compliant-green)](https://www.hhs.gov/hipaa/)

## Overview

The Muni AI RCM Platform transforms healthcare billing operations through intelligent automation, providing a **Devin-like autonomous experience** for revenue cycle management. Our platform focuses on **AI-powered code accuracy** while **outsourcing compliance validation to Claim MD**, eliminating the need to maintain complex payer-specific rules. Built with AI-native architecture, the platform automates complex workflows from patient registration through payment collection while maintaining full HIPAA compliance.

### Key Features

🤖 **AI-Powered Automation**
- Automated medical coding (CPT, ICD-10, HCPCS)
- Real-time insurance eligibility verification
- Intelligent denial management and appeal generation
- Smart cost estimation and patient responsibility calculation

👥 **Multi-Role Dashboard System**
- **Provider Portal**: View claim status, financial reports, performance metrics
- **Operations Center**: Work queues, AI review panels, quality assurance
- **Admin Console**: System analytics, user management, compliance monitoring

🔄 **Autonomous Workflow System**
- Step-by-step guidance through complex RCM processes
- Real-time progress tracking with estimated completion times
- Intelligent error recovery and alternative path suggestions
- Role-based workflow adaptation

🔒 **Enterprise Security & Compliance**
- Full HIPAA compliance with comprehensive audit trails
- End-to-end encryption (AES-256 at rest, TLS ≥ 1.2 in transit)
- Role-based access control with principle of least privilege
- AWS-only deployment with Business Associate Agreement

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- AWS CLI configured
- AWS account with appropriate permissions

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/muni-ai-rcm.git
cd muni-ai-rcm

# Install dependencies
npm install
cd app && npm install
cd ../infra && npm install
cd ..

# Configure environment
cp app/.env.example app/.env.local
# Edit .env.local with your configuration

# Start development server
cd app
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

For complete setup instructions, see **[Getting Started Guide](./docs/GETTING_STARTED.md)**.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Multi-Role Frontend (Next.js)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │Admin Dashboard│ │Ops Dashboard│ │Provider Portal│                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                    Server Actions (Backend Logic)                    │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────────┐
│                    Agent│Layer (Python Lambdas)                      │
│  ┌──────────────┐  ┌────┼──────┐  ┌──────────────┐                  │
│  │ CodingAgent  │  │ERA│Parser │  │EligibilityAgt│                  │
│  └──────────────┘  └────┼──────┘  └──────────────┘                  │
│  ┌──────────────┐  ┌────┼──────┐  ┌──────────────┐                  │
│  │SubmitClaim   │  │Den│ialMgmt│  │AppealLetter  │                  │
│  └──────────────┘  └────┼──────┘  └──────────────┘                  │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────────┐
│                    Data │Layer & AI Services                         │
│  RDS PostgreSQL ────────┼────── S3 PHI Storage                       │
│  DynamoDB (Amplify) ────┼────── AWS Bedrock (Nova Pro)               │
│  CloudWatch Logs ───────┼────── Secrets Manager                      │
└─────────────────────────┴───────────────────────────────────────────┘
```

## Technology Stack

- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Backend**: Server Actions, AWS SDK direct invocation
- **Agents**: Python 3.11 Lambda functions with AWS CDK
- **AI/ML**: AWS Bedrock with Nova Pro for LLM inference
- **Database**: PostgreSQL (RDS) + DynamoDB + S3 for PHI storage
- **Infrastructure**: AWS CDK, VPC, IAM, API Gateway, EventBridge
- **Authentication**: AWS Cognito with multi-role support
- **Monitoring**: CloudWatch, X-Ray tracing, custom metrics
- **Claim Validation**: Claim MD API (outsourced compliance checking)

## Project Structure

```
muni-ai-rcm/
├── app/                    # Next.js application
│   ├── app/               # App Router pages and layouts
│   ├── lib/               # Server actions and utilities
│   └── amplify/           # Auth and data configuration
├── agents/                 # Python Lambda agents
│   ├── CodingAgent/       # AI-powered medical coding
│   ├── EligibilityAgent/  # Insurance verification
│   ├── SubmitClaimAgent/  # Claim submission
│   └── ERAParserAgent/    # Payment processing
├── infra/                  # AWS CDK infrastructure
│   └── lib/               # Stack definitions
├── docs/                   # Comprehensive documentation
├── schemas/                # JSON API contracts
└── scripts/                # Development and deployment tools
```

## User Roles & Features

### 👨‍⚕️ Provider Role
- **Performance Dashboard**: View practice RCM metrics and financial KPIs
- **Claim Tracking**: Real-time visibility into all claim statuses
- **Financial Reports**: Revenue analytics and payment transparency
- **Service Insights**: See how our ops team is managing your billing

### 👩‍💼 Operations Role (Internal Team)
- **EHR Remote Access**: Monitor and extract encounter data from client EHRs
- **Data Entry**: Input encounter data into platform for claim processing
- **Work Queue Management**: Priority-based task assignment and tracking
- **AI Review Center**: Validate low-confidence AI predictions
- **Denial Management**: Streamlined appeal workflows with AI-generated letters
- **Payment Posting**: Post payment data back to client EHRs via remote access
- **Quality Assurance**: Performance metrics and coding accuracy reports

### 👨‍💻 Admin Role
- **System Analytics**: Revenue metrics, claim volumes, AI performance
- **User Management**: Role assignment and access control
- **Platform Configuration**: Workflow templates and agent settings
- **Compliance Monitoring**: HIPAA audit trails and security reports

## Core Workflows

### Pre-Encounter (T-2 days)
1. **Appointment Scan**: System identifies appointments 48 hours out
2. **Eligibility Check**: Automated insurance verification via Claim MD (270/271)
3. **Coverage Review**: Ops team reviews eligibility responses
4. **Patient Outreach**: Contact patients if coverage issues found

### Post-Encounter Claim Submission
1. **Data Entry**: Ops team extracts encounter data from client EHR via remote access
2. **Patient Verification**: Review extracted patient information
3. **Eligibility Confirmation**: Verify pre-encounter eligibility still valid
4. **AI Coding**: Generate medical codes from clinical notes
5. **Cost Estimation**: Calculate patient out-of-pocket costs
6. **Final Review**: Comprehensive pre-submission validation
7. **Submission**: Submit JSON claim payload to Claim MD API

### Denial Management
1. **Denial Analysis**: AI categorization of denial reasons
2. **Strategy Review**: Recommended response approach
3. **Documentation**: Gather supporting evidence
4. **Appeal Generation**: AI-powered appeal letter creation
5. **Review & Submit**: Human validation and submission

## Development

### Common Commands

```bash
# Frontend development
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint

# Agent development
./scripts/run-local-agent.sh CodingAgent    # Test agent locally
./scripts/deploy-agent.sh CodingAgent       # Deploy individual agent

# Infrastructure
cd infra
cdk deploy          # Deploy all CDK stacks
cdk destroy         # Clean up resources
```

### Testing Different Roles

During development, you can test different user roles by modifying the `getUserRole()` function in `app/lib/auth-utils.ts`:

```typescript
export function getUserRole(): UserRole {
  // For development testing
  return 'admin'; // Change to 'ops' or 'provider'
}
```

### Environment Configuration

Create `.env.local` in the `app` directory:

```env
NODE_ENV=development
NEXT_PUBLIC_DEV_MODE=true
AWS_REGION=us-east-1
AGENT_DEVELOPMENT_MODE=true
```

## Documentation

📚 **Comprehensive Documentation Available**

| Document | Description |
|----------|-------------|
| **[Getting Started](./docs/GETTING_STARTED.md)** | Developer setup and quickstart guide |
| **[Project Architecture](./docs/PROJECT_ARCHITECTURE.md)** | Complete system architecture overview |
| **[User Roles Guide](./docs/USER_ROLES_GUIDE.md)** | Role-based features and workflows |
| **[Agent Development](./docs/AGENT_DEVELOPMENT.md)** | Creating and integrating AI agents |
| **[API Reference](./docs/API_REFERENCE.md)** | Server actions and webhook endpoints |
| **[Data Models](./docs/DATA_MODELS.md)** | Database schema and data contracts |
| **[Security & Compliance](./docs/SECURITY_COMPLIANCE.md)** | HIPAA compliance and security guidelines |
| **[Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)** | Production deployment procedures |
| **[Workflow System](./docs/WORKFLOW_SYSTEM.md)** | Autonomous workflow implementation |

## Security & Compliance

The platform is built with healthcare security requirements in mind:

- **HIPAA Compliant**: Full compliance with administrative, physical, and technical safeguards
- **Data Encryption**: AES-256 at rest, TLS 1.3 in transit
- **Access Controls**: Role-based permissions with audit logging
- **Network Security**: Private VPC with encrypted subnets
- **Incident Response**: Automated detection and response procedures

## Deployment

### Development Environment
```bash
cd app
npx ampx sandbox  # Deploy Amplify backend
npm run dev       # Start local development
```

### Production Deployment
```bash
# Deploy infrastructure
cd infra
cdk deploy --all

# Deploy agents
./scripts/deploy-all-agents.sh

# Deploy frontend
cd app
npx ampx pipeline-deploy --branch main --app-id $AWS_APP_ID
```

For detailed deployment instructions, see the **[Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)**.

## AI Agents

The platform includes specialized AI agents for different RCM functions:

| Agent | Purpose | Technology |
|-------|---------|------------|
| **CodingAgent** | Generate CPT/ICD codes from clinical notes | AWS Bedrock (Nova Pro) |
| **EligibilityAgent** | Real-time insurance verification | Payer API integration |
| **SubmitClaimAgent** | Submit JSON claims to Claim MD | REST API integration |
| **ERAParserAgent** | Process 835 payment advice | EDI parsing + reconciliation |
| **DenialClassifierAgent** | Categorize and analyze denials | AI classification |
| **AppealLetterAgent** | Generate professional appeal letters | LLM-powered document generation |

Each agent operates independently with structured inputs/outputs and comprehensive error handling.

## External Integrations

### Service-Based Model
- Internal ops team has remote access to client EHR systems
- Ops monitors completed encounters and extracts data
- Data processed through AI-powered RCM platform
- Payments posted back to client EHR via remote access
- Providers focus on patient care while we handle all billing

### Payer Systems (via Claim MD)
- Claim MD handles all X12 EDI generation and validation
- JSON/REST API for claim submission
- Real-time eligibility verification (270/271)
- Automated payment posting (835 ERA processing)
- Webhook notifications for claim status updates

### Other Integrations
- **AWS Bedrock**: AI/ML inference
- **EventBridge**: Event-driven workflows
- **Step Functions**: Complex workflow orchestration

## Performance & Monitoring

The platform includes comprehensive monitoring and analytics:

- **Real-time Dashboards**: System health, performance metrics
- **Custom Metrics**: Claim volumes, AI accuracy, processing times
- **Alerting**: Automated notifications for critical events
- **Audit Trails**: Complete activity logging for compliance
- **Performance Optimization**: Caching, connection pooling, auto-scaling

## Contributing

1. **Development Setup**: Follow the [Getting Started Guide](./docs/GETTING_STARTED.md)
2. **Code Standards**: TypeScript with strict mode, ESLint configuration
3. **Testing**: Write tests for new functionality
4. **Documentation**: Update relevant docs for changes
5. **Security**: Follow security best practices for healthcare data

## License

This project is proprietary software developed for healthcare organizations. See LICENSE file for details.

## Support

- **Documentation**: Check the comprehensive docs in `/docs`
- **Development Issues**: Review troubleshooting sections in documentation
- **Security Issues**: Follow responsible disclosure procedures
- **Feature Requests**: Submit detailed requirements and use cases

---

**Built for Healthcare. Powered by AI. Secured by Design.**

The Muni AI RCM Platform represents the future of healthcare revenue cycle management - where **AI focuses on coding accuracy** while **Claim MD ensures payer compliance**, eliminating the overhead of maintaining complex rules engines and delivering unprecedented efficiency in healthcare billing operations.