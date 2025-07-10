# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **AI-native Revenue Cycle Management (RCM) platform** built on AWS Amplify Gen 2. The platform transforms healthcare billing operations through intelligent automation, starting from the [`aws-samples/amplify-next-template`](https://github.com/aws-samples/amplify-next-template) base.

**Key Product Features:**
- Agent-native microservices for RCM workflows
- HIPAA-compliant AWS-only deployment
- Full-stack integration with EHR systems via 1upHealth
- AI-powered claim coding, eligibility verification, and denial management
- LLM feedback loops for continuous improvement

**Technology Stack:**
- **Frontend/Backend**: Next.js 14 (SSR, App Router) with TypeScript on Amplify
- **App Logic**: Server Actions + minimal API routes for uploads
- **Agents**: Python Lambda agents with AWS CDK infrastructure
- **Database**: RDS (PostgreSQL) + S3 for PHI-safe storage
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
- All external APIs (Bedrock, Claim.MD) called from within agents only

### 4. Security & HIPAA Compliance
- Encrypted private subnets for all services
- S3 encrypted, versioned, access-logged
- RDS encrypted with password rotation
- Secrets via AWS Secrets Manager (90-day rotation)
- CloudTrail + GuardDuty + CloudWatch alarms enabled

## Key Architecture Components

### Frontend (Next.js App Router)
- **Framework**: Next.js 14 with App Router and SSR
- **Styling**: CSS modules and global CSS
- **State Management**: React hooks (useState, useEffect)
- **UI Components**: AWS Amplify UI React components
- **Authentication**: Amplify Auth with Cognito
- **Data**: Real-time subscriptions via Amplify Data client

### Backend Infrastructure
- **Data Layer**: RDS (PostgreSQL) + S3 for PHI-safe storage
- **Authentication**: Cognito-based auth via Amplify Auth
- **Infrastructure**: AWS CDK v2 (TypeScript) for all resources
- **Compute**: Python Lambda agents in private VPC
- **Integration**: EventBridge, Step Functions, API Gateway
- **AI/ML**: AWS Bedrock (Nova Pro) for LLM inference

## Monorepo Structure

```
/                       ← monorepo root
├── app/                ← Next.js App Router frontend + backend (TS)
│   ├── app/            ← UI routes, layouts, Server Actions
│   └── lib/            ← DB, session, AWS SDK logic
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
Server Actions replace most API routes and invoke Lambda agents via AWS SDK:

| Server Action            | Purpose                | Agent Triggered         |
| ------------------------ | ---------------------- | ----------------------- |
| `submitClaim()`          | Trigger 837 submission | `SubmitClaimAgent`      |
| `checkEligibility()`     | Run 270/271 query      | `EligibilityAgent`      |
| `generateAppeal()`       | Draft appeal letter    | `AppealLetterAgent`     |
| `estimatePatientCost()`  | Predict patient OOP    | `PatientEstimatorAgent` |

**Minimal API Routes (uploads only):**
- `/api/upload-era` - Handle 835 file uploads, then call `ERAParserAgent`

### External Webhook Endpoints (API Gateway)
Third-party systems hit these endpoints:

| Webhook Route            | Source          | Handler Lambda          |
| ------------------------ | --------------- | ----------------------- |
| `POST /webhook/era`      | Claim.MD (835)  | `ERAParserAgent`        |
| `POST /webhook/denial`   | Claim.MD (277)  | `DenialClassifierAgent` |
| `POST /webhook/chart`    | EHR / 1upHealth | Triggers `CodingAgent`  |

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

### Frontend Data Layer
The application uses Amplify's generateClient for real-time data operations:

```typescript
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

// Real-time subscription for claims
client.models.Claim.observeQuery().subscribe({
  next: (data) => setClaims([...data.items]),
});

// Create claim
client.models.Claim.create({
  patientId: "12345",
  status: "pending",
  amount: 250.00
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

## EHR Integration (via 1upHealth)

The platform integrates with EHR systems through 1upHealth FHIR API:

**Authentication Flows:**
- B2B org-signed (preferred) or patient-auth flows
- OAuth 2.0 with FHIR R4 endpoints

**FHIR Resources Retrieved:**
- `Patient` - Demographics and insurance information
- `Encounter` - Visit details and provider information
- `Condition` - Diagnosis codes and clinical context
- `DocumentReference` - Clinical notes and attachments
- `Observation` - Lab results and vital signs
- `MedicationRequest` - Prescription and medication history

**Data Flow:**
1. EHR data fetched via Python Lambda agents
2. Structured data stored in RDS (encrypted)
3. PDFs and raw FHIR bundles stored in S3
4. All calls made from within private VPC Lambda functions

## Important Development Notes

- **Client-side components**: Use "use client" directive for React components
- **Amplify configuration**: Loaded from `amplify_outputs.json` (auto-generated)
- **TypeScript**: Configured with strict mode and Next.js plugin
- **Security**: All external API calls must be made from within Lambda agents
- **Testing**: No testing framework currently configured - agents tested via scripts
- **Linting**: Next.js ESLint configured, no additional tools
- **Secrets**: All sensitive data via AWS Secrets Manager with rotation
- **Database**: RDS PostgreSQL with encryption at rest and in transit

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