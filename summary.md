# RCM Platform Developer Reference - Deep Technical Documentation

This document contains the complete architectural, technical, and operational detail for building the Muni Health agent-native RCM platform. It is intended as the **source of truth** for your engineering team—the equivalent of being in every conversation during the platform's design.

## 🔧 Project Context

* **Product:** AI-native full-stack Revenue Cycle Management (RCM)
* **Deployment:** AWS-only (single BAA, HIPAA-compliant)
* **Codebase:** Monorepo using the [`aws-samples/amplify-next-template`](https://github.com/aws-samples/amplify-next-template) as base:

  * Amplify-managed hosting + Cognito auth
  * Next.js (SSR, App Router) frontend (TypeScript)
  * App-local server actions + minimal API routes
  * Agent Lambdas (Python, CDK-managed)
  * Infrastructure (AWS CDK in TypeScript)

---

## 🛡️ High-Level Architecture

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

---

## 🧠 Design Principles

### 1. Agent-Native Microservices

* Each RCM function is implemented as its own isolated **Python** Lambda (e.g. `CodingAgent`, `ERAParserAgent`).
* App-triggered Lambdas (e.g. `SubmitClaimAgent`) are invoked from Server Actions in the frontend repo.
* Webhook Lambdas (e.g. `ERAParserAgent`) are invoked via API Gateway.

### 2. Full-Stack App-Local Logic

* App Router handles all frontend + backend logic together:

  * SSR and client views
  * `server-only` functions for secure backend logic
  * Server Actions handle calling agents using the AWS SDK

### 3. Infrastructure Standards

* All Lambdas run in a private VPC
* Each agent has a least-privilege IAM role
* Logs are streamed to CloudWatch; all agents log to RDS `agent_runs`
* Secrets are managed via AWS Secrets Manager

### 4. DevOps & Observability

* CDK (in TypeScript) defines all infrastructure
* GitHub Actions deploys frontend, Lambdas, and CDK stacks
* App, agents, and infra live in a single monorepo

---

## 🔎 API + Execution Structure

### Internal App Logic (App Router Server Actions)

Your app uses **Next.js Server Actions** to:

* Call Python Lambdas via AWS SDK (`@aws-sdk/client-lambda`)
* Query RDS (e.g. claim logs, payment status)
* Trigger Step Functions for multi-agent workflows

Server Actions replace most API routes. Minimal `/api/` endpoints are kept only when needed (e.g. uploads).

| Action               | Calls Agent Lambda      |
| -------------------- | ----------------------- |
| Submit claim         | `SubmitClaimAgent`      |
| Check eligibility    | `EligibilityAgent`      |
| Generate appeal      | `AppealLetterAgent`     |
| Estimate patient OOP | `PatientEstimatorAgent` |

### External Webhooks (API Gateway + Lambdas)

| Webhook Route          | Source          | Handler Lambda          |
| ---------------------- | --------------- | ----------------------- |
| `POST /webhook/era`    | Claim.MD (835)  | `ERAParserAgent`        |
| `POST /webhook/denial` | Claim.MD (277)  | `DenialClassifierAgent` |
| `POST /webhook/chart`  | EHR / 1upHealth | Triggers `CodingAgent`  |

---

## 📁 Monorepo Layout

```
/                       ← monorepo root
├── app/                ← Next.js App Router frontend (TS)
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
└── README.md
```

---

## 🔐 Security & HIPAA

* Encrypted VPC subnets
* IAM: scoped per Lambda
* S3: encrypted, private, versioned
* RDS: encrypted, backups, password-rotated
* CloudTrail + GuardDuty + CloudWatch Logs enabled
* Secrets rotated via AWS Secrets Manager

---

## ♻️ LLM Feedback Loop

Structured logs are stored for post-hoc analysis + training:

| Step               | Agent            | Logs                           |
| ------------------ | ---------------- | ------------------------------ |
| Initial prediction | `CodingAgent`    | CPT/ICD guess + prompt meta    |
| Human override     | Manual via UI    | CPT/ICD correction log         |
| Claim outcome      | `ERAParserAgent` | Payment / denial status        |
| Re-train           | CLI batch job    | Generates training\_pairs.json |

---

## 🚀 Dev & Deployment

* Amplify auto-builds frontend on push to `main`
* GitHub Actions triggers CDK deploy (infra)
* Python Lambdas built via zip package per agent
* Local dev: use `scripts/run-local-agent.sh`

---

## 🌐 EHR Integration: 1upHealth

* Uses org-signed B2B token flow (or patient auth)
* Pulls FHIR resources:
  * Patient, Encounter, Condition
  * Observation, DocumentReference, MedicationRequest
* Stored in S3 (raw) and RDS (normalized)
* Accessed only from secure Lambdas