# Data Models - Muni AI RCM Platform

## Overview

The Muni AI RCM Platform uses a comprehensive data model designed to support the entire revenue cycle management workflow. All models are implemented using AWS Amplify Data with GraphQL, providing real-time subscriptions, role-based access control, and type safety.

## Schema Architecture

### Authorization Strategy

The data layer implements role-based access control with three primary roles:

- **Admin** - Full access to all data
- **Ops** - Read/write access to operational data, read-only for configuration
- **Provider** - Limited access to own data only

### Data Location

- **Primary Database**: AWS DynamoDB (via Amplify Data)
- **Audit Logs**: CloudWatch Logs + DynamoDB
- **File Storage**: S3 for documents and large payloads
- **Real-time**: GraphQL subscriptions for live updates

## Core Data Models

### UserProfile

Manages user accounts and role-based permissions.

```typescript
interface UserProfile {
  userId: string;          // Primary key - Cognito user ID
  email: string;           // User email address
  role: "Admin" | "Ops" | "Provider";
  organization: string;     // Organization identifier
  permissions: string[];    // Granular permissions array
  isActive: boolean;       // Account status
  lastLogin: Date;         // Last login timestamp
  createdAt: Date;
  updatedAt: Date;
}
```

**Authorization Rules:**
- Admins: Full access
- Owners: Can read and update their own profile
- Ops: Read-only access to user profiles

**Usage Example:**
```typescript
// Fetch current user profile
const { data: userProfile } = await client.models.UserProfile.get({
  userId: session.userId
});

// Update user preferences
await client.models.UserProfile.update({
  userId: session.userId,
  lastLogin: new Date()
});
```

### Patient

Stores comprehensive patient demographics and insurance information.

```typescript
interface Patient {
  patientId: string;       // Primary key - unique identifier
  firstName: string;       // Patient first name
  lastName: string;        // Patient last name
  dateOfBirth: Date;       // Date of birth
  ssn: string;            // Social Security Number (encrypted)
  phone: string;          // Contact phone number
  email: string;          // Contact email
  address: {              // Address object
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  insuranceInfo: {        // Insurance details
    primary: {
      payerId: string;
      memberId: string;
      groupNumber: string;
      planName: string;
    };
    secondary?: InsuranceDetails;
  };
  providerId: string;     // Associated provider
  isActive: boolean;      // Patient status
  createdAt: Date;
  updatedAt: Date;
}
```

**Authorization Rules:**
- Admins: Full access
- Ops: Full access for processing
- Providers: Read/update access

**Usage Example:**
```typescript
// Create new patient
const newPatient = await client.models.Patient.create({
  patientId: `PAT-${Date.now()}`,
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: new Date("1985-03-15"),
  insuranceInfo: {
    primary: {
      payerId: "BCBS",
      memberId: "ABC123456",
      groupNumber: "GRP789",
      planName: "Blue Cross Blue Shield"
    }
  },
  providerId: "PROV-001"
});

// Search patients by name
const { data: patients } = await client.models.Patient.list({
  filter: {
    and: [
      { firstName: { contains: "John" } },
      { isActive: { eq: true } }
    ]
  }
});
```

### Provider

Healthcare provider and organization information.

```typescript
interface Provider {
  providerId: string;      // Primary key - unique identifier
  organizationName: string; // Provider organization name
  npi: string;            // National Provider Identifier
  taxId: string;          // Tax identification number
  address: {              // Provider address
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  contactInfo: {          // Contact information
    phone: string;
    email: string;
    fax: string;
  };
  specialties: string[];   // Medical specialties
  isActive: boolean;      // Provider status
  createdAt: Date;
  updatedAt: Date;
}
```

**Usage Example:**
```typescript
// Get provider details
const { data: provider } = await client.models.Provider.get({
  providerId: "PROV-001"
});

// Update provider information
await client.models.Provider.update({
  providerId: "PROV-001",
  specialties: ["Internal Medicine", "Cardiology"]
});
```

### Claim

Central model for claim management and tracking.

```typescript
interface Claim {
  claimId: string;         // Primary key - unique claim identifier
  patientId: string;       // Reference to Patient
  providerId: string;      // Reference to Provider
  status: "draft" | "submitted" | "pending" | "paid" | "denied" | "appealed";
  claimType: "professional" | "institutional" | "dental" | "vision";
  serviceDate: Date;       // Date of service
  submissionDate: Date;    // Claim submission date
  totalAmount: number;     // Total claim amount
  paidAmount: number;      // Amount paid by insurance
  patientResponsibility: number; // Patient out-of-pocket
  diagnosisCodes: string[]; // ICD-10 diagnosis codes
  procedureCodes: string[]; // CPT/HCPCS procedure codes
  claimmdBatchId: string;  // Claim MD batch identifier
  claimmdStatus: "CREATED" | "QUEUED" | "REJECTED" | "ACCEPTED" | "PAID";
  claimmdErrors: Array<{   // Claim MD validation errors
    code: string;
    message: string;
    segment: string;
  }>;
  retryCount: number;      // Number of submission retry attempts
  aiGeneratedData: {       // AI-generated suggestions
    suggestedCodes: {
      icd10: Array<{ code: string; confidence: number }>;
      cpt: Array<{ code: string; confidence: number }>;
    };
    confidence: number;
    reasoning: string;
  };
  manualOverrides: {       // Human overrides to AI suggestions
    originalCodes: string[];
    modifiedCodes: string[];
    reason: string;
    reviewedBy: string;
    reviewDate: Date;
  };
  workflowSteps: {         // Workflow progress tracking
    eligibilityCheck: { status: string; completedAt?: Date };
    coding: { status: string; completedAt?: Date };
    review: { status: string; completedAt?: Date };
    submission: { status: string; completedAt?: Date };
  };
  assignedTo: string;      // Currently assigned user
  priority: "low" | "medium" | "high" | "urgent";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Usage Example:**
```typescript
// Create new claim
const newClaim = await client.models.Claim.create({
  claimId: `CLM-${Date.now()}`,
  patientId: "PAT-123456",
  providerId: "PROV-001",
  status: "draft",
  claimType: "professional",
  serviceDate: new Date("2024-01-15"),
  totalAmount: 250.00,
  diagnosisCodes: ["Z00.00"],
  procedureCodes: ["99213"],
  priority: "medium"
});

// Update claim status after Claim MD submission
await client.models.Claim.update({
  claimId: "CLM-123456",
  status: "submitted",
  submissionDate: new Date(),
  claimmdBatchId: "BATCH-789",
  claimmdStatus: "QUEUED"
});

// Real-time subscription for claim updates
const subscription = client.models.Claim.observeQuery({
  filter: { status: { eq: "pending" } }
}).subscribe({
  next: ({ items }) => {
    console.log("Pending claims updated:", items);
  }
});
```

### WorkflowState

Tracks guided workflow progress for autonomous claim processing.

```typescript
interface WorkflowState {
  claimId: string;         // Primary key - associated claim
  currentStep: string;     // Current workflow step
  completedSteps: string[]; // Array of completed steps
  nextSteps: string[];     // Array of upcoming steps
  isBlocked: boolean;      // Workflow blocked status
  blockReason: string;     // Reason for block
  assignedTo: string;      // Currently assigned user
  estimatedCompletion: Date; // Expected completion time
  metadata: {              // Step-specific metadata
    stepData: object;
    userInteractions: Array<{
      step: string;
      action: string;
      timestamp: Date;
      userId: string;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Usage Example:**
```typescript
// Start new workflow
const workflow = await client.models.WorkflowState.create({
  claimId: "CLM-123456",
  currentStep: "data-entry",
  nextSteps: ["eligibility-check", "coding", "review"],
  estimatedCompletion: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
});

// Progress workflow
await client.models.WorkflowState.update({
  claimId: "CLM-123456",
  currentStep: "eligibility-check",
  completedSteps: ["data-entry"],
  nextSteps: ["coding", "review"]
});
```

### AgentRun

Audit trail for AI agent executions and ML training data.

```typescript
interface AgentRun {
  runId: string;           // Primary key - unique execution ID
  agentName: string;       // Name of executed agent
  claimId: string;         // Associated claim (if applicable)
  patientId: string;       // Associated patient (if applicable)
  input: object;           // Agent input parameters
  output: object;          // Agent response/results
  status: "running" | "completed" | "failed" | "timeout";
  executionTime: number;   // Execution time in seconds
  cost: number;           // Execution cost (Bedrock tokens, etc.)
  confidence: number;      // AI confidence score
  needsReview: boolean;    // Flags low-confidence results
  reviewedBy: string;      // User who reviewed results
  reviewNotes: string;     // Review comments
  createdAt: Date;
  updatedAt: Date;
}
```

**Usage Example:**
```typescript
// Create agent run record
const agentRun = await client.models.AgentRun.create({
  runId: `RUN-${Date.now()}`,
  agentName: "CodingAgent",
  claimId: "CLM-123456",
  input: { clinicalNotes: "Patient visit for annual physical..." },
  output: { suggestedCodes: ["99213", "Z00.00"] },
  status: "completed",
  executionTime: 1.2,
  confidence: 0.95
});

// Query low-confidence runs for review
const { data: reviewQueue } = await client.models.AgentRun.list({
  filter: {
    and: [
      { needsReview: { eq: true } },
      { reviewedBy: { attributeExists: false } }
    ]
  }
});
```

### EligibilityCheck

Insurance eligibility verification results and caching.

```typescript
interface EligibilityCheck {
  patientId: string;       // Primary key - patient identifier
  insuranceId: string;     // Insurance policy identifier
  serviceDate: Date;       // Date of service
  isEligible: boolean;     // Eligibility status
  eligibilityDetails: {    // Detailed eligibility info
    memberStatus: string;
    planStatus: string;
    serviceTypeCoverage: object;
  };
  benefits: {              // Benefit details
    deductible: {
      individual: number;
      family: number;
      remaining: number;
    };
    outOfPocket: {
      individual: number;
      family: number;
      remaining: number;
    };
    coverage: {
      preventive: string;
      specialist: string;
      emergency: string;
    };
  };
  copay: number;          // Copay amount
  deductible: number;     // Deductible amount
  coinsurance: number;    // Coinsurance percentage
  outOfPocketMax: number; // Out-of-pocket maximum
  verificationDate: Date; // When verification was performed
  expirationDate: Date;   // When results expire
  createdAt: Date;
  updatedAt: Date;
}
```

### Appeal

Denial management and appeal tracking.

```typescript
interface Appeal {
  claimId: string;         // Primary key - associated claim
  appealLevel: "first" | "second" | "external";
  denialReason: string;    // Original denial reason
  appealLetter: string;    // Generated appeal letter
  supportingDocuments: string[]; // Document references
  submissionDate: Date;    // Appeal submission date
  deadline: Date;         // Appeal deadline
  status: "draft" | "submitted" | "pending" | "approved" | "denied";
  outcome: {              // Appeal result
    decision: string;
    amount: number;
    reason: string;
    nextSteps: string[];
  };
  assignedTo: string;     // Assigned user
  createdAt: Date;
  updatedAt: Date;
}
```

### AuditLog

Comprehensive audit trail for compliance and security.

```typescript
interface AuditLog {
  entityType: string;      // Type of entity (Patient, Claim, etc.)
  entityId: string;        // Entity identifier
  action: string;          // Action performed (create, update, delete)
  userId: string;          // User who performed action
  userRole: string;        // User's role at time of action
  changes: {               // What changed
    before: object;
    after: object;
    fields: string[];
  };
  ipAddress: string;       // Client IP address
  userAgent: string;       // Client user agent
  timestamp: Date;         // When action occurred
}
```

## Data Client Usage

### Initialization

```typescript
// Client-side components
'use client';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
```

### Real-time Subscriptions

```typescript
// Subscribe to claim status changes
const claimSubscription = client.models.Claim.observeQuery({
  filter: { providerId: { eq: currentProviderId } }
}).subscribe({
  next: ({ items, isSynced }) => {
    if (isSynced) {
      setClaims(items);
    }
  }
});

// Subscribe to workflow updates
const workflowSubscription = client.models.WorkflowState.observeQuery({
  filter: { assignedTo: { eq: currentUserId } }
}).subscribe({
  next: ({ items }) => {
    setWorkflowTasks(items);
  }
});
```

### Complex Queries

```typescript
// Dashboard analytics query
const getClaimAnalytics = async (providerId: string, dateRange: DateRange) => {
  const { data: claims } = await client.models.Claim.list({
    filter: {
      and: [
        { providerId: { eq: providerId } },
        { serviceDate: { ge: dateRange.start } },
        { serviceDate: { le: dateRange.end } }
      ]
    }
  });
  
  return {
    totalClaims: claims.length,
    totalAmount: claims.reduce((sum, claim) => sum + claim.totalAmount, 0),
    paidAmount: claims.reduce((sum, claim) => sum + claim.paidAmount, 0),
    denialRate: claims.filter(c => c.status === 'denied').length / claims.length
  };
};

// AI review queue
const getAIReviewQueue = async (role: UserRole) => {
  const { data: agentRuns } = await client.models.AgentRun.list({
    filter: {
      and: [
        { needsReview: { eq: true } },
        { reviewedBy: { attributeExists: false } },
        { confidence: { lt: 0.8 } }
      ]
    },
    limit: 50
  });
  
  return agentRuns.sort((a, b) => a.confidence - b.confidence);
};
```

### Batch Operations

```typescript
// Bulk claim status update
const updateClaimStatuses = async (claimIds: string[], status: string) => {
  const updatePromises = claimIds.map(claimId =>
    client.models.Claim.update({
      claimId,
      status,
      updatedAt: new Date()
    })
  );
  
  return Promise.all(updatePromises);
};
```

## Data Validation

### Schema Validation

All models include built-in validation:

```typescript
// Automatic validation on create/update
try {
  await client.models.Patient.create({
    patientId: "PAT-123",
    firstName: "John",
    lastName: "Doe",
    email: "invalid-email" // Will cause validation error
  });
} catch (error) {
  console.error("Validation failed:", error.errors);
}
```

### Custom Validation

```typescript
// Custom validation functions
export const validateClaimAmount = (amount: number): boolean => {
  return amount > 0 && amount <= 999999.99;
};

export const validateInsuranceMemberId = (memberId: string): boolean => {
  return /^[A-Z0-9]{6,12}$/.test(memberId);
};
```

## Performance Optimization

### Caching Strategy

```typescript
// Client-side caching for frequently accessed data
const useProviderCache = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  
  useEffect(() => {
    // Cache providers for 5 minutes
    const cacheKey = 'providers';
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        setProviders(data);
        return;
      }
    }
    
    // Fetch and cache
    client.models.Provider.list().then(({ data }) => {
      setProviders(data);
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    });
  }, []);
  
  return providers;
};
```

### Pagination

```typescript
// Paginated queries for large datasets
const usePaginatedClaims = (pageSize = 20) => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [nextToken, setNextToken] = useState<string>();
  
  const loadMore = async () => {
    const { data, nextToken: newToken } = await client.models.Claim.list({
      limit: pageSize,
      nextToken
    });
    
    setClaims(prev => [...prev, ...data]);
    setNextToken(newToken);
  };
  
  return { claims, loadMore, hasMore: !!nextToken };
};
```

## Security Considerations

### Data Encryption

- All sensitive fields (SSN, tax IDs) are encrypted at rest
- Data in transit protected by TLS ≥ 1.2
- Field-level encryption for PII in DynamoDB

### Access Control

```typescript
// Role-based filtering in queries
const getAccessibleClaims = async (userRole: UserRole, userId: string) => {
  const baseFilter = { isActive: { eq: true } };
  
  switch (userRole) {
    case 'Admin':
      // Admin sees all claims
      return client.models.Claim.list({ filter: baseFilter });
      
    case 'Ops':
      // Ops sees assigned claims and review queue
      return client.models.Claim.list({
        filter: {
          and: [
            baseFilter,
            { 
              or: [
                { assignedTo: { eq: userId } },
                { status: { eq: 'pending' } }
              ]
            }
          ]
        }
      });
      
    case 'Provider':
      // Providers see only their own claims
      return client.models.Claim.list({
        filter: {
          and: [
            baseFilter,
            { providerId: { eq: userId } }
          ]
        }
      });
  }
};
```

## Migration and Versioning

### Schema Evolution

```typescript
// Migration strategy for schema changes
const migrateClaimData = async () => {
  // Add new fields with default values
  const { data: claims } = await client.models.Claim.list();
  
  for (const claim of claims) {
    if (!claim.workflowSteps) {
      await client.models.Claim.update({
        claimId: claim.claimId,
        workflowSteps: {
          eligibilityCheck: { status: 'pending' },
          coding: { status: 'pending' },
          review: { status: 'pending' },
          submission: { status: 'pending' }
        }
      });
    }
  }
};
```

## Summary

The Muni AI RCM Platform data model provides:
- **Comprehensive coverage** of the revenue cycle
- **Role-based security** for healthcare compliance
- **Real-time updates** for responsive UX
- **Audit trails** for regulatory requirements
- **AI integration** for workflow automation
- **Type safety** throughout the application

The schema supports the autonomous, AI-powered workflow system while maintaining HIPAA compliance and providing the flexibility needed for complex healthcare billing scenarios.