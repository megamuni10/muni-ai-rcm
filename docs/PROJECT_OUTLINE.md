# Muni Health – Agent‑Native RCM Platform **v0 Blueprint (Full Detail)**

> **Goal**  Ship a HIPAA‑compliant Next.js web app that automates eligibility, claim creation → ClaimMD submission → payment posting for ≤1 000 claims/week, while leaving high‑friction edge work manual but traceable.  This document is the build contract for engineering.

---

## 1  End‑to‑End Process at 1‑Claim Granularity

| #  | Actor / Service                                                                                                                      | Manual?              | Tech Surface                  | PHI Artifact            | Automation Slice (Lambda)       |
| -- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ----------------------------- | ----------------------- | ------------------------------- |
| 1  | **Ops** adds new claim via “Add Claim” form                                                                                          | ✅                    | `/ops/coding` page            | ClaimJSON row           | —                               |
| 2  | **Ops** opens “Coding Queue” UI, keys CPT/ICD, POS, charges                                                                          | ✅                    | `/ops/coding` page            | Google‑like Grid row    | — (future `CodingAgent`)        |
| 3  | **Server Action** builds `ClaimJSON`, calls **`EligibilityAgent`**                                                                   | Auto                 | `lambda:EligibilityAgent`     | 270/271 XML             | EligibilityAgent (v0)           |
| 4  | **Ops** reviews eligibility response → ok                                                                                            | ✅                    | Modal inside coding page      | —                       | —                               |
| 5  | **SubmitClaimAgent** serialises 837P, uploads via ClaimMD REST                                                                       | Auto                 | `lambda:SubmitClaimAgent`     | 837P X12                | SubmitClaimAgent (v0)           |
| 6  | ClaimMD returns 277CA (rejection) **OR** queues 835                                                                                  | Auto                 | API GW webhook `/webhook/era` | 277CA / 835             | `ERAIngestAgent` (v0)           |
| 7a | *If 277CA reject* → **DenialLoopAgent** drafts appeal & updates status; Ops reviews in “Rejection Queue”, edits if needed, resubmits | Auto (toggle‑on/off) | `/ops/rejections`             | diff rows + appeal PDF  | `DenialLoopAgent` (v0)          |
| 7b | *If 835 paid* → Ops opens “Post Payments” UI, copy/paste paid \$, hit **Post**                                                       | ✅                    | `/ops/payments`               | PaymentNotice FHIR POST | `PostPaymentAgent` (v0 minimal) |
| 8  | **Provider** sees claim & payment status on dashboard; may download PDF EOB                                                          | Auto                 | `/provider/claims`            | none                    | Dynamo stream → revalidate page |
| 9  | **Admin** dashboards update (KPIs, audit)                                                                                            | Auto                 | `/admin/dashboard`            | none                    | Redshift view refresh           |

---

## 2  Functional Modules & RCM Task Coverage

1. **Eligibility**  (Automated)
   *Lambda `EligibilityAgent`* → ClaimMD 270, parse 271, store in `eligibility` table.
2. **Coding & Charge Capture**  (Manual in v0)
   Spreadsheet‑like grid → row per encounter.  Future: call `CodingAgent` (Bedrock‑LLM).
3. **Claim Build & Scrub**  (Automated)
   `SubmitClaimAgent` converts `ClaimJSON` → 837.  Basic payer edits (POS+CPT mismatch) in code.
4. **Submission & Status Poll**  (Automated)
   Submit → ClaimMD Upload.  277CA rejection path handled by queue.
5. **ERA / EFT Ingest**  (Automated)
   `ERAIngestAgent` webhook saves raw file, updates `payments` table.
6. **Payment Posting**  (Manual UI with helper)\*\*
   Ops pastes paid amount → `PostPaymentAgent` writes FHIR PaymentNotice (or CSV stub) back to EHR.
7. **Denial Management**  (Toggleable Auto)
   *Lambda `DenialLoopAgent`* classifies CARC/RARC, drafts appeal PDF, updates claim status. Ops can disable and handle manually.
   Out of v0—manual Google Doc appeals.
8. **Reporting / KPIs**  (Light)
   Pre‑canned queries exposed in Admin page:  First‑Pass Yield, Days‑to‑Submit, Paid \$.

---

## 3  Persona UX Spec (Wireframe‑Level)

### 3.1 Provider `/provider/claims`

* **Header KPI**: YTD Net Collections \$
* **Table** (lazy‑load, N=500):  DOS • Patient • Charge • Status • Paid • Paid Date • Denial Code.
* **Filters**: Status dropdown, Date range.
* **Row Action**: Download EOB (link to S3 835‑PDF).

### 3.2 Ops Worklists

| Route              | Purpose                         | Columns                           | Primary Action           |
| ------------------ | ------------------------------- | --------------------------------- | ------------------------ |
| `/ops/coding`      | un‑coded encounters             | DOS, Patient, Note preview        | Edit CPT/ICD, Save       |
| `/ops/eligibility` | 271 errors (no active coverage) | Patient, Plan, Err                | Contact patient (manual) |
| `/ops/rejections`  | 277CA rejects                   | Claim ID, Reject code, Msg        | Fix → Resubmit           |
| `/ops/payments`    | 835 ready‑to‑post               | Claim ID, Paid, Adj, Patient Resp | Post to EHR              |

### 3.3 Admin `/admin/dashboard`

* **Widgets**: Gross Submitted \$, Net Paid \$, FPY %, AR>90 \$, Denial %.
* **Tables**: Recent errors, Agent latency, User audit trail.

---

## 4  Data Architecture & Schemas

### 4.1 DynamoDB (single‑table)

| PK (claim\_id) | SK         | Sample Attr                             |
| -------------- | ---------- | --------------------------------------- |
| 123            | METADATA   | patient\_id, dos, provider\_npi, charge |
| 123            | ELIG       | status, plan\_id, copay                 |
| 123            | 837        | s3\_uri, ts                             |
| 123            | 277CA#ts   | code, msg                               |
| 123            | 835#ts     | s3\_uri, paid, adj                      |
| 123            | AUDIT#user | action, ts                              |

### 4.2 RDS (Postgres) – optional analytic copy

Tables: `claims_fact`, `payments_fact`, `agents_run`, `users` (Cognito sub ↔ role).

### 4.3 S3 Bucket Layout

```
rcm-phi/
  837/
  835/
  eob-pdf/
  notes/
```

All AES‑256, versioned, lifecycle to Glacier after 2 y.

---

## 5  AWS Components Map

| Need                   | Service                             | Notes                         |
| ---------------------- | ----------------------------------- | ----------------------------- |
| Auth & RBAC            | Cognito (3 groups)                  | provider, ops, admin          |
| Frontend hosting       | Amplify Hosting                     | CI on main                    |
| Secure backend runtime | Next.js App Router (server actions) | runs in Amplify SSR container |
| Stateless compute      | Lambda (Python 3.12)                | **5 Lambdas v0**              |
| Event bus              | EventBridge                         | for rejection/paid events     |
| Secret storage         | Secrets Manager                     | ClaimMD creds                 |
| Observability          | CloudWatch Logs + Metrics           | alarms on 5xx, latency        |
| Audit                  | CloudTrail                          | Org‑level                     |

---

## 6  Next.js Codebase Layout (v0‑ready)

```
app/
  provider/claims/page.tsx
  ops/[
    coding, eligibility, rejections, payments]/page.tsx
  admin/dashboard/page.tsx
  api/webhook/era/route.ts   ← revalidate + forward to Lambda
lib/
  db.ts  ← Dynamo helpers
  auth.ts  ← Cognito hooks
  aws.ts  ← Lambda clients
agents/
  EligibilityAgent/
  SubmitClaimAgent/
  ERAIngestAgent/
  PostPaymentAgent/
  DenialLoopAgent/
infrastructure/
  vpc-stack.ts
  lambdas-stack.ts
  amplify-stack.ts
```

---

## 7  Build Milestones (Realistic Hours)

| Week | Deliverable                                                           | Lead Time |
| ---- | --------------------------------------------------------------------- | --------- |
| 1    | Repo bootstrap, Cognito, Amplify, base pages (no data)                | 24 h      |
| 2    | Dynamo schema + AWS CDK stacks                                        | 24 h      |
| 3    | Eligibility‑ & Submit‑agents, coding UI CRUD                          | 32 h      |
| 4    | ERA webhook + ingest agent, **DenialLoopAgent**, rejection/payment UI | 40 h      |
| 5    | Admin dashboard KPIs (Athena/Redshift) + harden security              | 24 h      |
| 6    | End‑to‑end UAT with first live claims                                 | —         |

---

## 8  Open Items to Lock Before Sprint

1. **Claim field validation spec** — finalize required vs optional fields for Add Claim form.
2. **ClaimMD ERA delivery** — webhook vs SFTP polling.
3. **Bank account webhook** — if auto‑recon in v0? (lean yes/no).
4. **Hosting region** — us‑east‑1 default unless customer contracts demand otherwise.

*All new scope must be triaged into v0.1 backlog once this blueprint is approved.*
