# API Reference - Muni AI RCM Platform

## Overview

The Muni AI RCM Platform uses **Next.js Server Actions** as the primary API layer instead of traditional REST endpoints. Server Actions provide type-safe, server-side functions that can be called directly from React components while maintaining security and performance.

## Server Actions

All server actions are defined in `app/lib/actions.ts` and implement role-based access control.

### Authentication & Authorization

All server actions require authentication and validate user roles:

```typescript
const userRole = await getUserRoleServer();
if (!userRole) {
  return { success: false, error: 'Authentication required' };
}
```

**Available Roles:**
- `admin` - Full system access
- `ops` - Claims processing and review
- `provider` - Claim submission and tracking

## Core Server Actions

### EHR Data Processing

#### `processEHRData(ehrData: string, claimId?: string)`

Processes clinical EHR data and extracts structured information for claim creation.

**Parameters:**
- `ehrData` (string) - Raw clinical text from EHR system
- `claimId` (string, optional) - Existing claim ID to update

**Returns:**
```typescript
{
  success: boolean;
  claimId?: string;
  extractedData?: {
    patient: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      memberID: string;
    };
    visit: {
      serviceDate: string;
      provider: string;
      facility: string;
    };
    diagnosis: Array<{
      code: string;
      description: string;
    }>;
    procedures: Array<{
      code: string;
      description: string;
    }>;
    confidence: number;
  };
  message: string;
  error?: string;
}
```

**Usage Example:**
```typescript
const result = await processEHRData(`
  Patient: John Doe, DOB: 03/15/1985
  Visit Date: 01/15/2024
  Chief Complaint: Annual physical examination
  Assessment: Patient appears healthy
  Plan: Continue current medications
`);

if (result.success) {
  console.log('Claim ID:', result.claimId);
  console.log('Extracted data:', result.extractedData);
}
```

**Permissions:** All authenticated users

---

### Claim Management

#### `submitClaim(formData: FormData)`

Submits a claim to Claim MD API for validation and payer submission.

**FormData Parameters:**
- `claimId` - Unique claim identifier
- `patientId` - Patient identifier
- `amount` - Claim total amount
- `workflowStateId` - Associated workflow state

**Returns:**
```typescript
{
  success: boolean;
  claimId?: string;
  status?: 'submitted' | 'pending' | 'error';
  claimmdBatchId?: string;
  claimmdStatus?: 'CREATED' | 'QUEUED' | 'REJECTED' | 'ACCEPTED' | 'PAID';
  claimmdErrors?: Array<{
    code: string;
    message: string;
    segment: string;
  }>;
  message: string;
  error?: string;
}
```

**Usage Example:**
```tsx
<form action={submitClaim}>
  <input name="claimId" value="CLM-12345" />
  <input name="patientId" value="PAT-67890" />
  <input name="amount" type="number" value="250.00" />
  <input name="workflowStateId" value="WF-ABC123" />
  <button type="submit">Submit Claim</button>
</form>
```

**Permissions:** `admin`, `ops`, `provider`

---

### Eligibility Verification

#### `checkEligibility(formData: FormData)`

Verifies patient insurance eligibility and benefits in real-time.

**FormData Parameters:**
- `patientId` - Patient identifier
- `insuranceId` - Insurance policy identifier
- `workflowStateId` - Associated workflow state

**Returns:**
```typescript
{
  success: boolean;
  patientId?: string;
  eligible?: boolean;
  coverage?: string;
  copay?: number;
  deductible?: number;
  coinsurance?: number;
  outOfPocketMax?: number;
  benefits?: {
    medicalCoverage: string;
    preventiveCare: string;
    specialistCopay: number;
  };
  message: string;
  error?: string;
}
```

**Usage Example:**
```tsx
<form action={checkEligibility}>
  <input name="patientId" value="PAT-67890" />
  <input name="insuranceId" value="INS-BCBS-123" />
  <button type="submit">Check Eligibility</button>
</form>
```

**Permissions:** `admin`, `ops`, `provider`

---

### AI-Powered Coding

#### `generateAICodes(claimId: string, clinicalData: any)`

Generates medical codes (CPT, ICD-10, HCPCS) using AI analysis of clinical documentation.

**Parameters:**
- `claimId` (string) - Claim identifier
- `clinicalData` (object) - Structured clinical information

**Returns:**
```typescript
{
  success: boolean;
  claimId?: string;
  codes?: {
    icd10: Array<{
      code: string;
      description: string;
      confidence: number;
    }>;
    cpt: Array<{
      code: string;
      description: string;
      units: number;
      confidence: number;
    }>;
    hcpcs: Array<{
      code: string;
      description: string;
      confidence: number;
    }>;
  };
  confidence?: number;
  reasoning?: string;
  message: string;
  error?: string;
}
```

**Usage Example:**
```typescript
const clinicalData = {
  visitType: 'office',
  chiefComplaint: 'Annual physical',
  assessments: ['Hypertension', 'Type 2 Diabetes'],
  procedures: ['Physical examination', 'Blood pressure check']
};

const result = await generateAICodes('CLM-12345', clinicalData);

if (result.success) {
  console.log('Suggested codes:', result.codes);
  console.log('AI confidence:', result.confidence);
}
```

**Permissions:** `admin`, `ops`, `provider`

---

### Cost Estimation

#### `estimatePatientCost(formData: FormData)`

Estimates patient out-of-pocket costs based on insurance benefits and procedure codes.

**FormData Parameters:**
- `patientId` - Patient identifier
- `procedureCode` - CPT/HCPCS procedure code
- `facilityType` - Service facility type

**Returns:**
```typescript
{
  success: boolean;
  patientId?: string;
  procedureCode?: string;
  estimatedCost?: number;
  patientResponsibility?: number;
  insuranceCoverage?: number;
  breakdown?: {
    allowedAmount: number;
    copay: number;
    deductible: number;
    coinsurance: number;
    adjustments: number;
  };
  message: string;
  error?: string;
}
```

**Usage Example:**
```tsx
<form action={estimatePatientCost}>
  <input name="patientId" value="PAT-67890" />
  <input name="procedureCode" value="99213" />
  <select name="facilityType">
    <option value="office">Office</option>
    <option value="hospital">Hospital</option>
  </select>
  <button type="submit">Estimate Cost</button>
</form>
```

**Permissions:** `admin`, `ops`, `provider`

---

### Appeal Generation

#### `generateAppeal(formData: FormData)`

Generates professional appeal letters for denied claims using AI.

**FormData Parameters:**
- `claimId` - Denied claim identifier
- `denialReason` - Reason for denial
- `additionalInfo` - Supporting information

**Returns:**
```typescript
{
  success: boolean;
  claimId?: string;
  appealLetter?: string;
  message: string;
  error?: string;
}
```

**Usage Example:**
```tsx
<form action={generateAppeal}>
  <input name="claimId" value="CLM-12345" />
  <textarea name="denialReason" placeholder="Denial reason..." />
  <textarea name="additionalInfo" placeholder="Additional information..." />
  <button type="submit">Generate Appeal</button>
</form>
```

**Permissions:** `admin`, `ops`

---

### Workflow Management

#### `startWorkflow(claimId: string, workflowType: string)`

Initiates a guided workflow for claim processing.

**Parameters:**
- `claimId` (string) - Claim identifier
- `workflowType` (string) - Type of workflow to start

**Returns:**
```typescript
{
  success: boolean;
  workflowStateId?: string;
  message: string;
  error?: string;
}
```

**Usage Example:**
```typescript
const result = await startWorkflow('CLM-12345', 'new-claim-submission');
if (result.success) {
  console.log('Workflow started:', result.workflowStateId);
}
```

**Permissions:** All authenticated users

---

#### `updateWorkflowStep(workflowStateId: string, stepId: string, status: string)`

Updates the status of a workflow step.

**Parameters:**
- `workflowStateId` (string) - Workflow state identifier
- `stepId` (string) - Step identifier
- `status` (string) - New status value

**Returns:**
```typescript
{
  success: boolean;
  message: string;
  error?: string;
}
```

**Usage Example:**
```typescript
await updateWorkflowStep('WF-ABC123', 'eligibility-check', 'completed');
```

**Permissions:** All authenticated users

---

## Webhook Endpoints (API Gateway)

For external system integration, the platform provides webhook endpoints through API Gateway.

### Base URL
```
https://api.muni-rcm.aws.com/webhook
```

### Claim Status Updates

#### `POST /webhook/claim-status`

Receives claim status updates from Claim MD.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <webhook-token>
```

**Request Body:**
```json
{
  "claimId": "CLM-12345",
  "batchId": "BATCH-789",
  "status": "ACCEPTED",
  "timestamp": "2024-01-15T10:30:00Z",
  "details": {
    "payerClaimId": "PAY-98765",
    "acceptedDate": "2024-01-15T10:30:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "statusUpdated": true
}
```

---

### ERA Processing

#### `POST /webhook/era`

Processes Electronic Remittance Advice (835) files from Claim MD.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <webhook-token>
```

**Request Body:**
```json
{
  "payerId": "BCBS",
  "eraData": "ISA*00*...",
  "fileName": "835_20240115_001.txt",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "processedClaims": 25,
  "totalPayments": 12500.00,
  "adjustments": 150.00,
  "denials": 2
}
```

---

### Denial Processing

#### `POST /webhook/denial`

Processes claim denial notifications (277) from Claim MD.

**Request Body:**
```json
{
  "claimId": "CLM-12345",
  "denialCode": "CO-97",
  "denialReason": "Payment adjusted because the benefit for this service is included in the payment/allowance for another service/procedure",
  "payerId": "BCBS",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "denialProcessed": true,
  "nextAction": "appeal_recommended",
  "appealDeadline": "2024-02-14"
}
```

---



## Error Handling

All server actions follow a consistent error response format:

```typescript
{
  success: false,
  error: string,
  details?: any
}
```

### Common Error Codes

- `401` - Authentication required
- `403` - Insufficient permissions
- `400` - Invalid input/validation error
- `404` - Resource not found
- `500` - Internal server error
- `503` - External service unavailable

### Error Response Examples

```typescript
// Authentication error
{
  success: false,
  error: 'Authentication required'
}

// Validation error
{
  success: false,
  error: 'Invalid claim data',
  details: {
    field: 'patientId',
    message: 'Patient ID is required'
  }
}

// External service error
{
  success: false,
  error: 'Claim MD API temporarily unavailable'
}

// Claim MD rejection error
{
  success: false,
  error: 'Claim rejected by Claim MD',
  details: {
    errors: [
      { code: 'REQ001', message: 'Missing required field: memberID', segment: 'NM1' },
      { code: 'VAL002', message: 'Invalid procedure code combination', segment: 'SV1' }
    ]
  }
}
```

## Development Mode

During development, all server actions return mock data to enable local testing without external dependencies.

**Environment Variable:**
```bash
NODE_ENV=development
```

**Mock Response Indicators:**
- Messages include "(dev mode)"
- Realistic but fake data
- Consistent response times
- No external API calls

## Rate Limiting

Server actions implement rate limiting to prevent abuse:

- **User Actions**: 100 requests per minute per user
- **Workflow Actions**: 50 requests per minute per user
- **AI Coding**: 20 requests per minute per user

## Type Safety

All server actions are fully typed with TypeScript:

```typescript
// Type definitions
interface EHRProcessingResult {
  success: boolean;
  claimId?: string;
  extractedData?: ExtractedClinicalData;
  message: string;
  error?: string;
}

// Usage with type safety
const result: EHRProcessingResult = await processEHRData(ehrText);
```

## Security Considerations

1. **Input Validation**: All inputs validated against schemas
2. **Output Sanitization**: Sensitive data redacted in responses
3. **Audit Logging**: All actions logged with user context
4. **Rate Limiting**: Per-user and per-endpoint limits
5. **Authentication**: Session-based auth with Cognito
6. **Authorization**: Role-based access control

## Integration Examples

### React Component Integration

```tsx
'use client';

import { processEHRData } from '@/lib/actions';
import { useState } from 'react';

export function EHRProcessor() {
  const [result, setResult] = useState(null);
  
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const ehrData = formData.get('ehrData') as string;
    
    const response = await processEHRData(ehrData);
    setResult(response);
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <textarea name="ehrData" placeholder="Paste EHR data..." />
      <button type="submit">Process</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </form>
  );
}
```

### Progressive Enhancement

```tsx
// Works with and without JavaScript
<form action={submitClaim}>
  <input name="claimId" required />
  <button type="submit">Submit</button>
</form>
```

### Error Boundaries

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({error}: {error: Error}) {
  return (
    <div>
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
    </div>
  );
}

<ErrorBoundary FallbackComponent={ErrorFallback}>
  <ClaimSubmissionForm />
</ErrorBoundary>
```

## Summary

The Muni AI RCM Platform's API layer provides:
- **Type-safe** server actions for all operations
- **Role-based access control** for security
- **Comprehensive error handling** for reliability
- **Development mode** for offline testing
- **Webhook endpoints** for external integrations
- **Progressive enhancement** for accessibility

All APIs are designed to support the autonomous, AI-powered workflow system while maintaining security and compliance standards.