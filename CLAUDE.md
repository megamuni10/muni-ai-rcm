# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **AI-native Revenue Cycle Management (RCM) platform** built on AWS Amplify Gen 2. The platform transforms healthcare billing operations through intelligent automation with a **Devin-like autonomous experience** for healthcare finance.

**Key Product Features:**
- **Multi-role user interface** (Admin, Ops, Provider) with sophisticated dashboards
- **EHR data paste functionality** for contractors to input clinical data seamlessly
- **Guided workflow system** with step-by-step autonomous claim processing
- **Real-time transparency** and status tracking for providers
- Agent-native microservices for RCM workflows
- HIPAA-compliant AWS-only deployment
- Manual data entry workflow for claim creation and payment posting
- AI-powered claim coding, eligibility verification, and denial management
- LLM feedback loops for continuous improvement

**Technology Stack:**
- **Frontend/Backend**: Next.js 14 (SSR, App Router) with TypeScript on Amplify
- **UI/UX**: Role-based dashboards with sophisticated workflow management
- **Authentication**: Multi-role system (Admin/Ops/Provider) with Cognito integration
- **App Logic**: Server Actions + minimal API routes for uploads
- **Agents**: Python Lambda agents with AWS CDK infrastructure
- **Database**: Comprehensive RCM data models with RDS (PostgreSQL) + S3 for PHI-safe storage
- **AI/ML**: AWS Bedrock (Nova Pro) for LLM inference
- **Integration**: EventBridge, Step Functions, API Gateway

## High-Level Architecture

```
Frontend (Next.js App Router on Amplify) ─────────────────────────────┐
                                             │
                       App Router (UI) ──────┘
                       Server Actions (backend logic in-app)
                             │
                       AWS SDK → Agent Lambda invocation
                             │
External systems ──▶ API Gateway (webhooks) ▶ Webhook Lambdas
                             │
                    EventBridge / Step Functions (chained agents)
                             │
                   CDK-Deployed Python Lambda Agents (stateless)
                             │
                 RDS (Postgres) + S3 (PHI-safe buckets)
                             │
                     Bedrock API (Nova Pro) for LLM inference
```

## Design Principles

### 1. Agent-Native Microservices
- Each RCM function is implemented as an isolated **Python** Lambda agent
- App-triggered Lambdas (e.g. `SubmitClaimAgent`) invoked from Server Actions
- Webhook Lambdas (e.g. `ERAParserAgent`) invoked via API Gateway
- No persistent state in agents - all outputs stored in `agent_runs` and/or RDS/S3

### 2. Full-Stack App-Local Logic
- App Router handles all frontend + backend logic together:
  - SSR and client views
  - `server-only` functions for secure backend logic
  - Server Actions handle calling agents using the AWS SDK

### 3. Infrastructure Standards
- All Lambdas run in private VPC with encrypted subnets
- Each agent has its own IAM role with minimal scope
- CloudWatch logging + agent execution logged to RDS
- All external APIs (Bedrock, Claim MD) called from within agents only

### 4. Security & HIPAA Compliance
- Encrypted private subnets for all services
- S3 encrypted, versioned, access-logged
- RDS encrypted with password rotation
- Secrets via AWS Secrets Manager (90-day rotation)
- CloudTrail + GuardDuty + CloudWatch alarms enabled

## Key Architecture Components

### Frontend (Next.js App Router)
- **Framework**: Next.js 14 with App Router and SSR
- **Styling**: Enhanced CSS with role-based dashboard styling
- **State Management**: React hooks (useState, useEffect) with workflow state management
- **UI Components**: Custom RCM components with modal-based interactions
- **Authentication**: Multi-role Amplify Auth with Cognito (Admin/Ops/Provider)
- **Data**: Real-time subscriptions via Amplify Data client
- **User Experience**: Devin-like guided workflows with autonomous processing

### Backend Infrastructure
- **Data Layer**: Comprehensive RCM models (Claims, Patients, Providers, Workflows, Audits) with RDS (PostgreSQL) + S3 for PHI-safe storage
- **Authentication**: Multi-role Cognito-based auth with custom user attributes and groups
- **Infrastructure**: AWS CDK v2 (TypeScript) for all resources
- **Compute**: Python Lambda agents in private VPC
- **Integration**: EventBridge, Step Functions, API Gateway
- **AI/ML**: AWS Bedrock (Nova Pro) for LLM inference
- **Workflow Management**: State tracking and step-by-step guidance system

## Monorepo Structure

```
/                       ← monorepo root
├── app/                ← Next.js App Router frontend + backend (TS)
│   ├── app/            ← Multi-role UI routes, layouts, Server Actions
│   └── lib/            ← Enhanced auth utilities, workflow system, AWS SDK logic
├── agents/             ← Python-based Lambdas (one folder per agent)
│   └── CodingAgent/
│       ├── handler.py
│       ├── prompt.py
│       └── schema.py
├── infra/              ← CDK (TypeScript) for VPC, IAM, API GW, Lambda
│   └── lib/            ← CDK stack definitions
├── schemas/            ← JSON schemas (I/O contracts)
├── scripts/            ← Agent test runners, bootstrap scripts
├── .github/workflows/  ← CI/CD: Amplify + CDK deploy
├── amplify/            ← Amplify-managed backend (auth, storage, APIs)
│   ├── backend.ts      ← Amplify backend definition
│   ├── data/resource.ts ← GraphQL schema and data configuration
│   └── auth/resource.ts ← Authentication configuration
├── amplify_outputs.json ← Generated Amplify configuration (auto-generated)
└── README.md
```

## API + Execution Structure

### Internal App Logic (App Router Server Actions)
Server Actions replace most API routes and invoke Lambda agents via AWS SDK with enhanced workflow integration:

| Server Action            | Purpose                | Agent Triggered         | Workflow Integration     |
| ------------------------ | ---------------------- | ----------------------- | ------------------------ |
| `processEHRData()`       | Parse clinical data    | `EHRParsingAgent`       | Initiates new workflow   |
| `submitClaim()`          | Submit claim to Claim MD | `SubmitClaimAgent`      | Final workflow step      |
| `checkEligibility()`     | Run 270/271 query      | `EligibilityAgent`      | Pre-encounter (T-2 days) |
| `generateAppeal()`       | Draft appeal letter    | `AppealLetterAgent`     | Denial management flow   |
| `estimatePatientCost()`  | Predict patient OOP    | `PatientEstimatorAgent` | Cost calculation step    |
| `generateAICodes()`      | AI-powered coding      | `CodingAgent`           | Core workflow step       |
| `startWorkflow()`        | Initialize workflow    | N/A                     | Workflow orchestration   |
| `updateWorkflowStep()`   | Update workflow state  | N/A                     | Progress tracking        |

**Minimal API Routes (uploads only):**
- `/api/upload-era` - Handle 835 file uploads, then call `ERAParserAgent`

### External Webhook Endpoints (API Gateway)
Third-party systems hit these endpoints:

| Webhook Route            | Source          | Handler Lambda          |
| ------------------------ | --------------- | ----------------------- |
| `POST /webhook/era`      | Claim MD (835)  | `ERAParserAgent`        |
| `POST /webhook/denial`   | Claim MD (277)  | `DenialClassifierAgent` |
| `POST /webhook/claim-status` | Claim MD    | `ClaimStatusAgent`      |
| `POST /webhook/chart`    | Manual Entry    | Triggers `CodingAgent`  |

## Common Development Commands

```bash
# Frontend Development
npm run dev        # Start Next.js development server on localhost:3000
npm run build      # Build Next.js for production
npm run start      # Start production Next.js server
npm run lint       # Run Next.js ESLint

# Amplify Backend
npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID  # Deploy Amplify backend

# CDK Infrastructure
cd infra/
cdk deploy         # Deploy CDK stacks (agents, RDS, S3, VPC, IAM)
cdk destroy        # Destroy CDK stacks

# Agent Development
scripts/run-local-agent.sh CodingAgent  # Test agent locally with mock event
scripts/deploy-agent.sh CodingAgent     # Deploy individual agent Lambda

# Testing
scripts/test-agent.py --agent CodingAgent --payload test-payload.json
```

## Data Client Usage

### Enhanced Data Models
The application now includes comprehensive RCM data models with role-based authorization:

```typescript
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

// Available models with role-based access:
// - UserProfile (Admin, Ops, Provider roles)
// - Patient (patient demographics and insurance)
// - Provider (healthcare provider information)
// - Claim (comprehensive claim management)
// - WorkflowState (guided workflow tracking)
// - AgentRun (AI agent execution logs)
// - EligibilityCheck (insurance verification)
// - Appeal (denial management)
// - AuditLog (security and compliance)

// Real-time subscription for claims
client.models.Claim.observeQuery().subscribe({
  next: (data) => setClaims([...data.items]),
});

// Create claim with workflow integration
client.models.Claim.create({
  claimId: "CLM-12345",
  patientId: "PAT-67890",
  status: "draft",
  claimType: "professional",
  totalAmount: 250.00,
  workflowSteps: {},
  priority: "medium"
});
```

### Server Action Example
Server Actions invoke Python Lambda agents via AWS SDK:

```typescript
// /app/lib/actions.ts
'use server';

import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

export async function submitClaim(claimId: string, patientData: any) {
  const lambda = new LambdaClient({ region: process.env.AWS_REGION });
  
  const command = new InvokeCommand({
    FunctionName: "SubmitClaimAgent",
    Payload: JSON.stringify({
      claimId,
      patientData
    })
  });
  
  const response = await lambda.send(command);
  return JSON.parse(response.Payload?.toString() || "{}");
}
```

### Using Server Actions in Components
```typescript
// /app/claims/page.tsx
import { submitClaim } from '@/lib/actions';

export default function ClaimsPage() {
  return (
    <form action={submitClaim}>
      <input name="claimId" placeholder="Claim ID" />
      <button type="submit">Submit Claim</button>
    </form>
  );
}
```

### Agent Structure
Each Python Lambda agent follows this pattern:

```python
# /agents/CodingAgent/handler.py
import json
import boto3
from bedrock_client import BedrockClient

def lambda_handler(event, context):
    # Extract input
    patient_data = event.get('patientData', {})
    
    # Initialize Bedrock client
    bedrock = BedrockClient()
    
    # Generate CPT/ICD codes using Nova Pro
    coding_result = bedrock.generate_codes(patient_data)
    
    # Store result in RDS
    store_agent_run(event, coding_result)
    
    return {
        'statusCode': 200,
        'body': json.dumps(coding_result)
    }
```

## LLM Feedback Loop

The platform implements continuous improvement through structured feedback:

| Stage              | Agent            | Data Logged                                     |
| ------------------ | ---------------- | ----------------------------------------------- |
| Initial Prediction | `CodingAgent`    | CPT/ICD guess with LLM metadata                 |
| Human Review       | UI-layer         | CPT/ICD corrections stored in delta record      |
| Outcome Tracking   | `ERAParserAgent` | `paid`, `denied`, `adjusted` result recorded    |
| Re-train Prep      | Scripted         | Exported `training_pairs.json` from agent_runs |

All structured deltas are stored in RDS for training fine-tuned Nova Pro models.

## Manual Data Entry Workflow (Ops Team)

The platform uses a manual data entry process managed entirely by our internal ops team:

**Claim Creation Flow:**
1. Ops team has remote access to client EHR systems
2. Team monitors encounter list for completed doctor visits
3. When new encounters are completed, ops team pulls the data
4. Data is entered into our Next.js application through the Ops dashboard
5. Claims are built and submitted through our guided workflow system

**Payment Posting Flow:**
1. Payment information is received from payers (ERA/835 files)
2. Ops team processes payments in our system
3. Using remote EHR access, team posts payment data back to client's EHR
4. All transactions are tracked in our RDS database for audit trails

**Service Model Benefits:**
- Providers focus on patient care, not billing operations
- Our ops team handles all RCM data entry and processing
- More profitable than traditional RCM services due to AI automation
- Works with any EHR system that allows remote access
- Complete service offering - providers don't need to learn our platform

## Design Decision Rationale

### Why App Router + Server Actions (vs. Traditional API Routes)

**Decision**: Combined frontend and backend logic in Next.js App Router using Server Actions instead of separate `/api/` routes.

**Reasoning**:
1. **Simplified Architecture**: Eliminates the need for separate API layer - frontend forms directly call server functions
2. **Type Safety**: Server Actions provide end-to-end TypeScript safety from UI to agent invocation
3. **Developer Experience**: Reduces context switching between frontend and backend code
4. **Performance**: Server Actions run closer to the UI, reducing latency for Lambda agent calls
5. **Maintenance**: Single codebase for UI and business logic reduces complexity

**Implementation Pattern**:
```typescript
// Server Action in /app/lib/actions.ts
'use server';
export async function submitClaim(formData: FormData) {
  // Direct Lambda invocation from server context
  const lambda = new LambdaClient({ region: process.env.AWS_REGION });
  // ...
}

// Usage in React component
<form action={submitClaim}>
  <input name="claimId" />
  <button type="submit">Submit</button>
</form>
```

### Why Python Lambda Agents (vs. Node.js/TypeScript)

**Decision**: Implemented all RCM agents in Python despite the Next.js frontend being TypeScript.

**Reasoning**:
1. **Healthcare Ecosystem**: Most medical coding libraries, X12 parsers, and ML tools are Python-first
2. **AWS Bedrock**: Python SDK has the most mature support for Bedrock and Nova Pro integration
3. **Data Science Integration**: Future ML model training and analysis workflows are Python-native
4. **Library Ecosystem**: Better support for HL7 FHIR, medical terminologies (SNOMED, ICD-10)
5. **Team Expertise**: Healthcare industry developers typically have stronger Python backgrounds

### Why CDK (vs. Terraform or SAM)

**Decision**: Used AWS CDK (TypeScript) for infrastructure instead of Terraform or SAM.

**Reasoning**:
1. **Type Safety**: CDK provides compile-time checking for AWS resource configurations
2. **Developer Experience**: Same language (TypeScript) as frontend reduces cognitive load
3. **AWS Native**: Best integration with AWS services and latest features
4. **Reusability**: CDK constructs allow for composable infrastructure patterns
5. **Testing**: Can unit test infrastructure code alongside application code

### Why Monorepo Structure

**Decision**: Single repository containing frontend, agents, infrastructure, and schemas.

**Reasoning**:
1. **Atomic Deployments**: Changes to schemas/APIs can be deployed together across all components
2. **Shared Types**: JSON schemas in `/schemas/` provide contracts between frontend and agents
3. **Development Velocity**: No need to coordinate releases across multiple repositories
4. **Documentation**: Single source of truth for all platform documentation
5. **Tooling**: Unified CI/CD pipeline and development scripts

### Why Mock Data in Development Mode

**Decision**: All agents include `development_mode` flag that returns realistic mock data.

**Reasoning**:
1. **Development Speed**: Frontend and UI development can proceed without AWS infrastructure
2. **Cost Optimization**: No Bedrock API calls or external service costs during development
3. **Testing**: Predictable responses enable reliable UI testing and demos
4. **Onboarding**: New developers can run the full stack locally without AWS setup
5. **Compliance**: Avoid accidental PHI exposure during development with synthetic data

### Why JSON Schemas for API Contracts

**Decision**: Dedicated `/schemas/` directory with formal JSON Schema definitions for all agent APIs.

**Reasoning**:
1. **Type Safety**: Frontend and agents can validate inputs/outputs at runtime
2. **Documentation**: Self-documenting API contracts that serve as living documentation
3. **Versioning**: Schema evolution can be tracked and backward compatibility maintained
4. **Code Generation**: Future tooling can generate TypeScript types from schemas
5. **Interoperability**: External systems can integrate using standard JSON Schema format

### Why Private VPC for All Lambda Functions

**Decision**: All agents run in private subnets with VPC endpoints for AWS services.

**Reasoning**:
1. **HIPAA Compliance**: PHI never traverses public internet
2. **Security Defense**: Multiple layers of network isolation
3. **Audit Requirements**: Network traffic can be monitored and logged
4. **Regulatory**: Healthcare industry best practices require private networking
5. **Data Sovereignty**: All data remains within controlled AWS environment

## Important Development Notes

- **Client-side components**: Use "use client" directive for React components
- **Amplify configuration**: Loaded from `amplify_outputs.json` (auto-generated)
- **TypeScript**: Configured with strict mode and Next.js plugin
- **Security**: All external API calls must be made from within Lambda agents
- **Role Testing**: Change `role` in `getUserRole()` function (`auth-utils.ts`) to test different dashboards
- **Development Mode**: All workflows and agents return realistic mock data for local testing
- **Workflow State**: Guided workflows maintain state for autonomous user experience
- **Multi-Role UI**: Dashboard adapts based on user role (Admin/Ops/Provider)
- **Provider Dashboard**: View claim status, financial reports, and performance metrics into our system
- **Linting**: Next.js ESLint configured, no additional tools
- **Secrets**: All sensitive data via AWS Secrets Manager with rotation
- **Database**: Enhanced RCM models with RDS PostgreSQL encryption

## Deployment & DevOps

### Frontend Deployment
- **Amplify**: Auto-deploy from `main` branch
- **Build artifacts**: `.next` directory with SSR support
- **Caching**: `.next/cache`, `.npm`, and `node_modules`

### Backend Deployment
- **CDK stacks**: Deployed via `cdk deploy` or GitHub Actions
- **Lambda agents**: Python packages deployed from `/agents/` directories
- **Infrastructure**: VPC, RDS, S3, IAM roles, security groups via CDK

### CI/CD Pipeline
- **GitHub Actions**: Automated deployment for CDK stacks and Lambda functions
- **Testing**: Local agent testing via `scripts/run-local-agent.sh`
- **Monitoring**: CloudWatch logs and metrics for all components

## Development Workflow & Evolution Strategy

### Current State (Sophisticated Multi-Role Platform)
This codebase represents a **production-ready RCM platform** with autonomous workflow capabilities, implementing:

1. **✅ Core Architecture**: Monorepo with App Router + Server Actions + Python agents
2. **✅ Foundation Infrastructure**: VPC, RDS, S3, Lambda, API Gateway via CDK
3. **✅ Enhanced Agent Framework**: 6+ RCM agents with development mode and realistic mock data
4. **✅ Sophisticated Multi-Role UI**: Role-based dashboards (Admin/Ops/Provider) with guided workflows
5. **✅ Service-Based Model**: Ops team handles all data entry via remote EHR access
6. **✅ Autonomous Workflows**: Devin-like step-by-step guidance with progress tracking
7. **✅ Comprehensive Data Models**: Full RCM entity modeling with role-based authorization
8. **✅ Real-time Transparency**: Live status tracking and provider-focused transparency
9. **✅ Type Safety**: Enhanced TypeScript throughout with workflow state management
10. **✅ Development Tooling**: Enhanced testing and deployment automation

### Next Development Phases

**Phase 1: Role-Based Testing & Refinement**
- Test role-based dashboards (Admin/Ops/Provider) with different user scenarios
- Validate ops team workflow for remote EHR data extraction and payment posting
- Test guided workflow system end-to-end
- Refine autonomous user experience and workflow transitions
- Validate real-time status tracking and transparency features

**Phase 2: AWS Infrastructure Deployment**
- Deploy CDK stacks to development AWS environment
- Configure Amplify hosting for Next.js application  
- Test end-to-end integration with real Lambda agents
- Validate HIPAA compliance and security controls

**Phase 3: External Integrations**
- Integrate with real AWS Bedrock Nova Pro for CodingAgent
- Connect to Claim MD API for claim submission and ERA processing
- Enhance manual data entry workflows with better UI/UX
- Add real 270/271 eligibility verification

**Phase 4: Production Readiness**
- Implement comprehensive error handling and retries
- Add monitoring, alerting, and observability
- Performance optimization and load testing
- Security audit and penetration testing

### Key Integration Points for Future Development

**When adding new agents**: 
1. Create new directory in `/agents/` with `handler.py`, `schema.py`
2. Add JSON schema to `/schemas/` directory
3. Create CDK stack entry in `/infra/lib/agents-stack.ts`
4. Add Server Action in `/app/lib/actions.ts` with role-based authorization
5. Integrate into workflow templates and guided user experience
6. Update role-based dashboard components in `/app/app/page.tsx`
7. Add appropriate UI components for the user role that will interact with the agent

**When modifying schemas**:
1. Update JSON schema in `/schemas/`
2. Update Python agent validation in `handler.py`
3. Update TypeScript types in Server Actions
4. Update UI forms and validation

**When adding external integrations**:
1. Store credentials in AWS Secrets Manager via CDK
2. Add VPC endpoints if needed for external APIs
3. Implement integration within Python agents only
4. Never call external APIs directly from frontend

### Architecture Evolution Principles

1. **Security First**: All PHI handling must remain within private VPC
2. **Agent Isolation**: Each agent remains stateless and independently deployable
3. **Schema Contracts**: All API changes must be backward compatible
4. **Development Mode**: All new features must support local development with mocks
5. **Monitoring**: All agent executions must be logged to RDS for audit trails
6. **Role-Based Access**: All new features must respect user role permissions and workflows
7. **Autonomous Experience**: Maintain Devin-like guided workflows for complex processes
8. **Provider Transparency**: Always prioritize clear visibility into claim status and financial outcomes

## Role-Based User Experience

### Admin Dashboard Features
- **System Analytics**: Revenue metrics, claim volumes, AI accuracy tracking
- **User Management**: Role assignment and organization management
- **Real-time Monitoring**: Lambda agent health, database status, API rate limits
- **Platform Settings**: Configuration and system-wide controls

### Ops Dashboard Features
- **Work Queue**: Prioritized tasks requiring manual review (High/Medium/Low)
- **AI Review Center**: Low-confidence predictions and edge cases
- **Denial Management**: Structured workflows for appeals and corrections
- **Performance Metrics**: Team productivity and claim processing efficiency

### Provider Dashboard Features
- **Performance Dashboard**: View RCM metrics, claim status, and financial reports
- **Guided Workflows**: Step-by-step claim submission with autonomous processing
- **Claim Transparency**: Real-time status tracking and financial visibility
- **Performance Insights**: Personal metrics and AI-powered optimization suggestions

### Guided Workflow System

**Pre-Encounter Workflow (T-2 days):**
1. **Appointment Monitoring** → System identifies appointments 48 hours out
2. **Eligibility Check** → Automatic insurance verification via Claim MD
3. **Coverage Review** → Ops team reviews eligibility results
4. **Patient Outreach** → Contact patients about coverage issues if needed

**Post-Encounter Claim Workflow:**
1. **Encounter Monitoring** → Ops team pulls completed encounters from client EHR
2. **Eligibility Confirmation** → Verify pre-encounter eligibility is still valid
3. **AI Coding** → Automated CPT/ICD code generation
4. **Review & Approval** → Human oversight of AI suggestions
5. **Cost Estimation** → Patient responsibility calculation
6. **Claim Submission** → JSON claim payload submission to Claim MD

**Denial Management Workflow:**
1. **Analyze Denial** → AI classification of denial reason
2. **Gather Documentation** → Supporting evidence collection
3. **Generate Appeal** → AI-powered appeal letter creation
4. **Review & Edit** → Human oversight and customization
5. **Submit Appeal** → Automated payer submission

This documentation captures the complete thought process and design rationale that went into building the platform, ensuring future developers understand both the "what" and the "why" behind every architectural decision, including the sophisticated multi-role user experience and autonomous workflow capabilities.