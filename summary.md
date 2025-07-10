# RCM Platform Developer Reference - Deep Technical Documentation

This document contains the complete architectural, technical, and operational detail for building the Muni Health agent-native RCM platform. It is intended as the **source of truth** for your engineering team—the equivalent of being in every conversation during the platform's design.

## 🔧 Project Context

* **Product:** AI-native full-stack Revenue Cycle Management (RCM)
* **Deployment:** AWS-only (single BAA, HIPAA-compliant)
* **Codebase:** Monorepo using the [`aws-samples/amplify-next-template`](https://github.com/aws-samples/amplify-next-template) as base:

  * Amplify-managed hosting + Cognito auth
  * Next.js (SSR) frontend (TypeScript)
  * Agent Lambdas (Python)
  * Infrastructure (AWS CDK in TypeScript)

---

## 🛡️ High-Level Architecture

```
Frontend (Next.js on Amplify) ──────────────────────────────────┐
                                        │
                          API Routes (/api/* in Next.js SSR)
                                        │
External systems ──▶ API Gateway (webhooks) ▶ Webhook Lambdas (e.g. Claim.MD)
                                        │
                               EventBridge / Step Functions
                                        │
                        CDK-Deployed Lambda Agents (Python)
                                        │
                    RDS (Postgres) + S3 (PHI-safe buckets)
                                        │
                        Bedrock API (Nova Pro) for LLM inference
```

---

## 🧠 Design Principles

### 1. Agent-Native Microservices

* Each RCM function is implemented as its own isolated **Python** Lambda (e.g. `CodingAgent`, `ERAParserAgent`).
* No persistent state in agents. All outputs are stored in `agent_runs` and/or written to RDS/S3.

### 2. Infrastructure Standards

* All Lambdas live in a private VPC.
* Each agent has its own IAM role with minimal scope.
* Logs are streamed to CloudWatch + agent execution is logged to RDS.
* All external APIs (e.g. Bedrock, Claim.MD) are called from within agents only.

### 3. DevOps & Observability

* CDK (in TypeScript) manages all infrastructure (networking, compute, storage, IAM, secrets).
* GitHub Actions deploys agents, CDK stacks, and frontend via Amplify.
* All schema contracts for APIs and agents live in `/schemas`.

---

## 🔎 API Structure Overview

### Internal App Routes (`/pages/api/*`)

Each route:

* Is called from frontend dashboard or mobile interface
* Performs input validation
* Invokes one or more Lambda agents via SDK or EventBridge

| Route                    | Purpose                | Agent Triggered         |
| ------------------------ | ---------------------- | ----------------------- |
| `/api/submit-claim`      | Trigger 837 submission | `SubmitClaimAgent`      |
| `/api/check-eligibility` | Run 270/271 query      | `EligibilityAgent`      |
| `/api/generate-appeal`   | Draft appeal letter    | `AppealLetterAgent`     |
| `/api/post-remit`        | Ingest uploaded 835    | `ERAParserAgent`        |
| `/api/estimate-cost`     | Predict patient OOP    | `PatientEstimatorAgent` |

### External Webhook Endpoints (API Gateway)

All third-party systems (e.g. Claim.MD, 1upHealth) hit these:

* API Gateway routes map directly to webhook Lambdas
* All webhook handlers are retry-safe, log failures, and call async agents

| Webhook Path              | Source          | Handler Lambda          |
| ------------------------- | --------------- | ----------------------- |
| `POST /webhook/era`       | Claim.MD (835)  | `ERAParserAgent`        |
| `POST /webhook/denial`    | Claim.MD (277)  | `DenialClassifierAgent` |
| `POST /webhook/chartdrop` | EHR / 1upHealth | Triggers `CodingAgent`  |

---

## 📁 Monorepo Layout

```
/                       ← monorepo root
├── amplify/            ← Amplify-managed backend (auth, storage, APIs)
├── app/                ← Next.js app from amplify-next-template (TS)
│   └── pages/api/      ← API routes triggered from app
├── agents/             ← One folder per Python-based Lambda agent
│   └── CodingAgent/
│       ├── handler.py
│       ├── prompt.py
│       └── schema.py
├── infra/              ← CDK app (TypeScript) for agents, RDS, S3, VPC, IAM
│   └── lib/            ← Stack definitions per infra domain
├── schemas/            ← JSON schemas for agents and API I/O contracts
├── scripts/            ← Test runners, local harness tools
├── .github/workflows/  ← CI/CD: CDK deploy, Lambda build + package
└── README.md
```

---

## 🔐 Security & HIPAA

* All services reside in encrypted private subnets
* IAM roles scoped to function per agent
* S3 (encrypted, versioned, access-logged)
* RDS (encrypted, password-rotated)
* Secrets via AWS Secrets Manager (rotated every 90 days)
* CloudTrail + GuardDuty + CloudWatch alarms enabled

---

## ♻️ LLM Feedback Loop

| Stage              | Agent            | Data Logged                                     |
| ------------------ | ---------------- | ----------------------------------------------- |
| Initial Prediction | `CodingAgent`    | CPT/ICD guess with LLM metadata                 |
| Human Review       | UI-layer         | CPT/ICD corrections stored in delta record      |
| Outcome Tracking   | `ERAParserAgent` | `paid`, `denied`, `adjusted` result recorded    |
| Re-train Prep      | Scripted         | Exported `training_pairs.json` from agent\_runs |

All structured deltas are stored for training Nova Pro-style fine-tuned agents.

---

## 🚀 Dev & Deploy

* **Frontend**: Amplify auto-deploy from `main`
* **CDK stacks**: Deployed via `cdk deploy` or GitHub Actions
* **Agents**: Python Lambdas deployed from `/agents/` using zipped packages
* **Run locally**: `scripts/run-local-agent.sh` simulates event payload

---

## 🌐 EHR Integration (via 1upHealth)

* Use org-signed B2B (preferred) or patient-auth flows
* Fetch:

  * `Patient`
  * `Encounter`
  * `Condition`
  * `DocumentReference`
  * `Observation`
  * `MedicationRequest`
* Store structured data in RDS, and PDFs / raw bundles in S3
* All calls from inside Python Lambdas only