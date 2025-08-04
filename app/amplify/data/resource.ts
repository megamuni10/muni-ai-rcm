import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== RCM PLATFORM DATA MODELS =============================================
Comprehensive data models for AI-native Revenue Cycle Management platform
with role-based access control and workflow management.
=========================================================================*/
const schema = a.schema({
  // User Profile and Organization Management
  UserProfile: a
    .model({
      userId: a.id().required(),
      email: a.string().required(),
      role: a.enum(["Admin", "Ops", "Provider"]),
      organization: a.string(),
      permissions: a.string().array(),
      isActive: a.boolean().default(true),
      lastLogin: a.datetime(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.group("Admin"),
      allow.owner().to(["read", "update"]),
      allow.group("Ops").to(["read"]),
    ]),

  // Patient Information
  Patient: a
    .model({
      patientId: a.string().required(),
      firstName: a.string().required(),
      lastName: a.string().required(),
      dateOfBirth: a.date(),
      ssn: a.string(),
      phone: a.string(),
      email: a.string(),
      address: a.json(),
      insuranceInfo: a.json(),
      providerId: a.string(),
      isActive: a.boolean().default(true),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.group("Admin"),
      allow.group("Ops"),
      allow.group("Provider").to(["read", "update"]),
    ]),

  // Healthcare Provider Information
  Provider: a
    .model({
      providerId: a.string().required(),
      organizationName: a.string().required(),
      npi: a.string(),
      taxId: a.string(),
      address: a.json(),
      contactInfo: a.json(),
      specialties: a.string().array(),
      isActive: a.boolean().default(true),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.group("Admin"),
      allow.group("Ops"),
      allow.group("Provider").to(["read", "update"]),
    ]),

  // Claims Management
  Claim: a
    .model({
      claimId: a.string().required(),
      patientId: a.string().required(),
      providerId: a.string().required(),
      status: a.enum(["draft", "submitted", "pending", "paid", "denied", "appealed"]),
      claimType: a.enum(["professional", "institutional", "dental", "vision"]),
      serviceDate: a.date(),
      submissionDate: a.datetime(),
      totalAmount: a.float(),
      paidAmount: a.float(),
      patientResponsibility: a.float(),
      diagnosisCodes: a.string().array(),
      procedureCodes: a.string().array(),
      rawClaimData: a.json(),
      aiGeneratedData: a.json(),
      manualOverrides: a.json(),
      workflowSteps: a.json(),
      assignedTo: a.string(),
      priority: a.enum(["low", "medium", "high", "urgent"]),
      isActive: a.boolean().default(true),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.group("Admin"),
      allow.group("Ops"),
      allow.group("Provider").to(["read"]),
    ]),

  // Workflow State Management
  WorkflowState: a
    .model({
      claimId: a.string().required(),
      currentStep: a.string().required(),
      completedSteps: a.string().array(),
      nextSteps: a.string().array(),
      isBlocked: a.boolean().default(false),
      blockReason: a.string(),
      assignedTo: a.string(),
      estimatedCompletion: a.datetime(),
      metadata: a.json(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.group("Admin"),
      allow.group("Ops"),
      allow.group("Provider").to(["read"]),
    ]),

  // Agent Execution Tracking
  AgentRun: a
    .model({
      runId: a.string().required(),
      agentName: a.string().required(),
      claimId: a.string(),
      patientId: a.string(),
      input: a.json(),
      output: a.json(),
      status: a.enum(["running", "completed", "failed", "timeout"]),
      executionTime: a.float(),
      cost: a.float(),
      confidence: a.float(),
      needsReview: a.boolean().default(false),
      reviewedBy: a.string(),
      reviewNotes: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.group("Admin"),
      allow.group("Ops"),
      allow.group("Provider").to(["read"]),
    ]),

  // Eligibility Verification
  EligibilityCheck: a
    .model({
      patientId: a.string().required(),
      insuranceId: a.string().required(),
      serviceDate: a.date(),
      isEligible: a.boolean(),
      eligibilityDetails: a.json(),
      benefits: a.json(),
      copay: a.float(),
      deductible: a.float(),
      coinsurance: a.float(),
      outOfPocketMax: a.float(),
      verificationDate: a.datetime(),
      expirationDate: a.datetime(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.group("Admin"),
      allow.group("Ops"),
      allow.group("Provider").to(["read"]),
    ]),

  // Appeals Management
  Appeal: a
    .model({
      claimId: a.string().required(),
      appealLevel: a.enum(["first", "second", "external"]),
      denialReason: a.string().required(),
      appealLetter: a.string(),
      supportingDocuments: a.string().array(),
      submissionDate: a.datetime(),
      deadline: a.datetime(),
      status: a.enum(["draft", "submitted", "pending", "approved", "denied"]),
      outcome: a.json(),
      assignedTo: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.group("Admin"),
      allow.group("Ops"),
      allow.group("Provider").to(["read"]),
    ]),

  // Audit Trail
  AuditLog: a
    .model({
      entityType: a.string().required(),
      entityId: a.string().required(),
      action: a.string().required(),
      userId: a.string().required(),
      userRole: a.string(),
      changes: a.json(),
      ipAddress: a.string(),
      userAgent: a.string(),
      timestamp: a.datetime(),
    })
    .authorization((allow) => [
      allow.group("Admin"),
      allow.group("Ops").to(["read"]),
    ]),

  // Keep original Todo for backward compatibility
  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
    userPoolAuthorizationMode: {
      userPoolId: "userPool",
    },
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
