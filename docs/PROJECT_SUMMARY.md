# RCM Platform Developer Reference - Technical Summary

This document provides a comprehensive overview of the Muni AI RCM Platform - an AI-native Revenue Cycle Management system built for healthcare organizations. For detailed documentation, see the `/docs` directory.

## 🔧 Project Overview

* **Product:** AI-native full-stack Revenue Cycle Management (RCM) platform
* **Mission:** Focus on AI-powered code accuracy while outsourcing compliance validation to Claim MD, eliminating the need to maintain complex payer-specific rules
* **Deployment:** AWS-only (single BAA, HIPAA-compliant)
* **Architecture:** Modern full-stack monorepo with microservices agents

### Technology Stack

* **Frontend/Backend**: Next.js 14 (SSR, App Router) with TypeScript on AWS Amplify
* **Authentication**: Multi-role system (Admin/Ops/Provider) with Cognito integration
* **App Logic**: Server Actions + minimal API routes for uploads
* **Agents**: Python Lambda agents with AWS CDK infrastructure
* **Database**: Comprehensive RCM data models with RDS (PostgreSQL) + S3 for PHI-safe storage
* **AI/ML**: AWS Bedrock (Nova Pro) for LLM inference
* **Integration**: EventBridge, Step Functions, API Gateway

## 🛡️ High-Level Architecture

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
│                External │Systems Integration                         │
│  Manual Data Entry ────▶│◀────── API Gateway (Webhooks)              │
│  Claim MD ──────────────▶│◀────── EventBridge / Step Functions       │
│  Manual Payment Post ──▶│                                             │
└─────────────────────────┼───────────────────────────────────────────┘
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

## 🧠 Design Principles

### 1. Agent-Native Microservices
- Each RCM function is implemented as an isolated **Python** Lambda agent
- App-triggered Lambdas (e.g. `SubmitClaimAgent`) invoked from Server Actions
- Webhook Lambdas (e.g. `ERAParserAgent`) invoked via API Gateway
- No persistent state in agents - all outputs stored in `agent_runs` and/or RDS/S3

### 2. Full-Stack App-Local Logic
- App Router handles all frontend + backend logic together:
  - SSR and client views with role-based dashboards
  - `server-only` functions for secure backend logic
  - Server Actions handle calling agents using the AWS SDK

### 3. Autonomous Workflow System
- Guided, step-by-step claim processing with Devin-like experience
- Real-time status tracking and transparency
- Intelligent task prioritization and dependency resolution
- Role-based workflow adaptation (Admin/Ops/Provider)

### 4. Infrastructure Standards
- All Lambdas run in private VPC with encrypted subnets
- Each agent has its own IAM role with minimal scope
- CloudWatch logging + agent execution logged to RDS
- All external APIs (Bedrock, Claim MD) called from within agents only

## 🔎 API + Execution Structure

### Multi-Role User Experience

The platform provides distinct experiences for different user types:

**Admin Dashboard Features:**
- System analytics and revenue metrics
- User management and role assignment  
- Real-time monitoring of agent health and API usage
- Platform configuration and compliance oversight

**Ops Dashboard Features (Internal Team):**
- Remote EHR access to monitor completed encounters
- Extract encounter data and enter into platform manually for v1
- Intelligent work queue with priority-based task sorting
- AI review center for low-confidence predictions
- Denial management workflows with appeal generation
- Post payments back to client EHR via remote access manually for v1
- Quality assurance tools and performance metrics

**Provider Dashboard Features:**
- View practice performance metrics and financial KPIs
- Real-time claim status tracking and payment visibility
- Revenue analytics and denial rate trends
- Transparent view of how ops team is managing their billing

### Internal App Logic (Server Actions)

Server Actions replace most API routes and invoke Lambda agents via AWS SDK with enhanced workflow integration:

| Server Action            | Purpose                | Agent Triggered         | Workflow Integration     |
| ------------------------ | ---------------------- | ----------------------- | ------------------------ |
| `processEHRData()`       | Parse clinical data    | `EHRParsingAgent`       | Initiates new workflow   |
| `submitClaim()`          | Submit claim to Claim MD | `SubmitClaimAgent`      | Final workflow step      |
| `checkEligibility()`     | Run 270/271 query      | `EligibilityAgent`      | Workflow step tracking   |
| `generateAppeal()`       | Draft appeal letter    | `AppealLetterAgent`     | Denial management flow   |
| `estimatePatientCost()`  | Predict patient OOP    | `PatientEstimatorAgent` | Cost calculation step    |
| `generateAICodes()`      | AI-powered coding      | `CodingAgent`           | Core workflow step       |
| `startWorkflow()`        | Initialize workflow    | N/A                     | Workflow orchestration   |
| `updateWorkflowStep()`   | Update workflow state  | N/A                     | Progress tracking        |

### External Webhook Endpoints (API Gateway)

| Webhook Route            | Source          | Handler Lambda          | Purpose                  |
| ------------------------ | --------------- | ----------------------- | ------------------------ |
| `POST /webhook/era`      | Claim MD (835)  | `ERAParserAgent`        | Process payment advice   |
| `POST /webhook/denial`   | Claim MD (277)  | `DenialClassifierAgent` | Handle claim denials     |
| `POST /webhook/claim-status` | Claim MD    | `ClaimStatusAgent`      | Handle status updates    |

## 📁 Monorepo Structure

```
muni-ai-rcm/
├── app/                    # Next.js App Router frontend + backend (TS)
│   ├── app/               # Multi-role UI routes, layouts, Server Actions
│   ├── lib/               # Enhanced auth utilities, workflow system, AWS SDK logic
│   ├── amplify/           # Auth and data configuration
│   └── package.json
├── agents/                 # Python-based Lambda agents (one folder per agent)
│   ├── CodingAgent/
│   │   ├── handler.py
│   │   ├── prompt.py
│   │   └── schema.py
│   ├── EligibilityAgent/
│   ├── SubmitClaimAgent/
│   └── ERAParserAgent/
├── infra/                  # CDK (TypeScript) for VPC, IAM, API GW, Lambda
│   ├── lib/               # CDK stack definitions
│   └── app.ts
├── docs/                   # Comprehensive documentation
│   ├── PROJECT_ARCHITECTURE.md
│   ├── GETTING_STARTED.md
│   ├── USER_ROLES_GUIDE.md
│   ├── AGENT_DEVELOPMENT.md
│   ├── API_REFERENCE.md
│   ├── DATA_MODELS.md
│   ├── SECURITY_COMPLIANCE.md
│   ├── DEPLOYMENT_GUIDE.md
│   └── WORKFLOW_SYSTEM.md
├── schemas/                # JSON schemas (I/O contracts)
├── scripts/                # Agent test runners, deployment scripts
├── .github/workflows/      # CI/CD: Amplify + CDK deploy
└── CLAUDE.md              # Development guidance
```

## 🔐 Security & HIPAA Compliance

### Comprehensive Security Framework
- **Administrative Safeguards**: Role-based access control, workforce training, audit procedures
- **Physical Safeguards**: AWS data center security, workstation controls, device management
- **Technical Safeguards**: Encryption at rest/transit, access controls, audit logging

### Key Security Features
- AES-256 encryption for all data at rest
- TLS ≥ 1.2 for all data in transit
- Private VPC with encrypted subnets
- Role-based IAM with least privilege
- Comprehensive audit trails with 7-year retention
- Automated incident response procedures
- HIPAA-compliant Business Associate Agreement with AWS

## ♻️ AI Feedback Loop & Continuous Learning

The platform implements sophisticated feedback mechanisms for continuous AI improvement:

| Stage              | Component        | Data Captured                                   |
| ------------------ | ---------------- | ----------------------------------------------- |
| Initial Prediction | `CodingAgent`    | CPT/ICD suggestions with LLM confidence scores |
| Human Review       | UI Review Panel  | Expert corrections and override reasons         |
| Outcome Tracking   | `ERAParserAgent` | Claim outcomes (paid/denied/adjusted)          |
| Training Feedback  | Analytics System | Structured training pairs for model refinement |

All corrections and outcomes are stored in structured format for training fine-tuned models.

## 🚀 Development & Deployment

### Development Commands
```bash
# Frontend development
npm run dev        # Start Next.js development server
npm run build      # Build for production
npm run lint       # Run ESLint

# Agent development
./scripts/run-local-agent.sh CodingAgent  # Test agent locally
./scripts/deploy-agent.sh CodingAgent     # Deploy individual agent

# Infrastructure
cd infra && cdk deploy  # Deploy CDK stacks
```

### Deployment Pipeline
- **Amplify**: Auto-deploy frontend from `main` branch
- **GitHub Actions**: Automated CDK and agent deployment
- **Blue-Green Deployments**: Zero-downtime production updates
- **Comprehensive Testing**: Unit, integration, and E2E tests

## 🌐 External Integrations

### Service-Based RCM Model
- **Remote EHR Access**: Ops team has credentials to access client EHR systems
- **Encounter Monitoring**: Team watches for completed doctor visits
- **Data Extraction**: Pull encounter data from EHR into our platform
- **AI Processing**: Automated coding, eligibility, and claim submission
- **Payment Posting**: Post ERAs back to client EHR via remote access
- **Service Benefits**: Providers focus on care while we handle all billing operations

### Payer Integration (Claim MD)
- **Claim MD handles all X12 EDI generation and validation**
- **JSON/REST API**: Submit claims as structured JSON payloads
- **Webhook notifications**: Real-time status updates from Claim MD
- **Rejection handling**: AI-powered rework loop for validation errors
- **Batch support**: Up to 2000 claims per API call

## 📊 Documentation Overview

The platform includes comprehensive documentation in the `/docs` directory:

1. **[PROJECT_ARCHITECTURE.md](./docs/PROJECT_ARCHITECTURE.md)** - Complete system architecture and component details
2. **[GETTING_STARTED.md](./docs/GETTING_STARTED.md)** - Developer quickstart guide and setup instructions
3. **[USER_ROLES_GUIDE.md](./docs/USER_ROLES_GUIDE.md)** - Role-based features and workflows for Admin/Ops/Provider
4. **[AGENT_DEVELOPMENT.md](./docs/AGENT_DEVELOPMENT.md)** - Guide for creating and integrating new AI agents
5. **[API_REFERENCE.md](./docs/API_REFERENCE.md)** - Complete server actions and webhook endpoints reference
6. **[DATA_MODELS.md](./docs/DATA_MODELS.md)** - Comprehensive data schema and usage examples
7. **[SECURITY_COMPLIANCE.md](./docs/SECURITY_COMPLIANCE.md)** - HIPAA compliance and security guidelines
8. **[DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md)** - Production deployment procedures and best practices
9. **[WORKFLOW_SYSTEM.md](./docs/WORKFLOW_SYSTEM.md)** - Guided workflow implementation and autonomous features

## 🎯 Key Platform Features

### Autonomous Workflow System
- **Devin-like Experience**: Step-by-step guidance through complex RCM processes
- **Role Adaptation**: Workflows customize based on user skill level and permissions
- **Real-time Progress**: Live status tracking with estimated completion times
- **Intelligent Recovery**: Automatic error handling and alternative path suggestions

### AI-Powered Operations
- **Medical Coding**: Automated CPT/ICD code generation from clinical notes
- **Eligibility Verification**: Real-time insurance coverage checking
- **Denial Management**: Intelligent denial classification and appeal generation
- **Cost Estimation**: Accurate patient responsibility calculations

### Multi-Role Dashboard System
- **Provider Portal**: Performance dashboards, claim tracking, financial transparency
- **Service Model**: Internal ops team handles all data entry and payment posting
- **Operations Center**: Work queues, AI review panels, quality assurance tools
- **Admin Console**: System analytics, user management, compliance monitoring

This platform represents a complete, production-ready solution for AI-native revenue cycle management with sophisticated user experiences and comprehensive automation capabilities.