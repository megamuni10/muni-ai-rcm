// Workflow templates for different claim types and scenarios

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  action?: string;
  required: boolean;
  estimatedTime: number;
  dependencies?: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  estimatedTotalTime: number;
}

export const workflowTemplates: Record<string, WorkflowTemplate> = {
  'new-claim-submission': {
    id: 'new-claim-submission',
    name: 'New Claim Submission',
    description: 'Complete workflow for submitting a new healthcare claim',
    estimatedTotalTime: 8,
    steps: [
      {
        id: 'data-input',
        title: 'Data Input',
        description: 'Enter or paste patient and visit information',
        icon: '📄',
        required: true,
        estimatedTime: 2,
      },
      {
        id: 'eligibility-check',
        title: 'Eligibility Verification',
        description: 'Verify patient insurance eligibility and benefits',
        icon: '🔍',
        action: 'checkEligibility',
        required: true,
        estimatedTime: 1,
        dependencies: ['data-input'],
      },
      {
        id: 'ai-coding',
        title: 'AI Code Generation',
        description: 'Generate CPT and ICD codes using AI analysis',
        icon: '🤖',
        action: 'generateAICodes',
        required: true,
        estimatedTime: 2,
        dependencies: ['data-input'],
      },
      {
        id: 'code-review',
        title: 'Code Review',
        description: 'Review and validate AI-generated codes',
        icon: '👁️',
        required: true,
        estimatedTime: 2,
        dependencies: ['ai-coding'],
      },
      {
        id: 'cost-estimation',
        title: 'Cost Estimation',
        description: 'Calculate patient responsibility and expected payment',
        icon: '💰',
        action: 'estimatePatientCost',
        required: false,
        estimatedTime: 1,
        dependencies: ['eligibility-check', 'code-review'],
      },
      {
        id: 'claim-submission',
        title: 'Submit Claim',
        description: 'Final submission to payer via Claim.MD',
        icon: '🚀',
        action: 'submitClaim',
        required: true,
        estimatedTime: 1,
        dependencies: ['code-review'],
      },
    ],
  },

  'denial-management': {
    id: 'denial-management',
    name: 'Denial Management',
    description: 'Handle denied claims and create appeals',
    estimatedTotalTime: 12,
    steps: [
      {
        id: 'denial-analysis',
        title: 'Analyze Denial',
        description: 'Review denial reason and classify the issue',
        icon: '🔍',
        action: 'classifyDenial',
        required: true,
        estimatedTime: 3,
      },
      {
        id: 'documentation-review',
        title: 'Documentation Review',
        description: 'Gather supporting clinical documentation',
        icon: '📋',
        required: true,
        estimatedTime: 4,
        dependencies: ['denial-analysis'],
      },
      {
        id: 'appeal-generation',
        title: 'Generate Appeal',
        description: 'Create appeal letter with AI assistance',
        icon: '📝',
        action: 'generateAppeal',
        required: true,
        estimatedTime: 3,
        dependencies: ['documentation-review'],
      },
      {
        id: 'appeal-review',
        title: 'Review Appeal',
        description: 'Final review and approval of appeal letter',
        icon: '✅',
        required: true,
        estimatedTime: 2,
        dependencies: ['appeal-generation'],
      },
    ],
  },

  'pre-encounter-eligibility': {
    id: 'pre-encounter-eligibility',
    name: 'Pre-Encounter Eligibility',
    description: 'Verify eligibility before patient visit (T-2 days)',
    estimatedTotalTime: 3,
    steps: [
      {
        id: 'schedule-review',
        title: 'Schedule Review',
        description: 'Review upcoming appointments',
        icon: '📅',
        required: true,
        estimatedTime: 1,
      },
      {
        id: 'eligibility-batch',
        title: 'Batch Eligibility Check',
        description: 'Run eligibility verification for scheduled patients',
        icon: '🔍',
        action: 'batchEligibilityCheck',
        required: true,
        estimatedTime: 1,
        dependencies: ['schedule-review'],
      },
      {
        id: 'patient-notification',
        title: 'Patient Notification',
        description: 'Notify patients of coverage issues or requirements',
        icon: '📞',
        required: false,
        estimatedTime: 1,
        dependencies: ['eligibility-batch'],
      },
    ],
  },

  'era-processing': {
    id: 'era-processing',
    name: 'ERA Processing',
    description: 'Process Electronic Remittance Advice (835) files',
    estimatedTotalTime: 5,
    steps: [
      {
        id: 'era-parsing',
        title: 'Parse ERA File',
        description: 'Extract payment and adjustment information',
        icon: '📊',
        action: 'parseERA',
        required: true,
        estimatedTime: 1,
      },
      {
        id: 'payment-matching',
        title: 'Match Payments',
        description: 'Match payments to outstanding claims',
        icon: '🔗',
        required: true,
        estimatedTime: 2,
        dependencies: ['era-parsing'],
      },
      {
        id: 'adjustment-review',
        title: 'Review Adjustments',
        description: 'Review and process claim adjustments',
        icon: '⚖️',
        required: true,
        estimatedTime: 2,
        dependencies: ['payment-matching'],
      },
    ],
  },
};

export function getWorkflowTemplate(templateId: string): WorkflowTemplate | null {
  return workflowTemplates[templateId] || null;
}

export function calculateProgress(completedSteps: string[], template: WorkflowTemplate): number {
  if (template.steps.length === 0) return 0;
  
  const completedCount = completedSteps.filter(stepId => 
    template.steps.some(step => step.id === stepId)
  ).length;
  
  return Math.round((completedCount / template.steps.length) * 100);
}

export function getNextSteps(completedSteps: string[], template: WorkflowTemplate): WorkflowStep[] {
  return template.steps.filter(step => {
    // Skip if already completed
    if (completedSteps.includes(step.id)) return false;
    
    // Check if dependencies are met
    if (step.dependencies) {
      const dependenciesMet = step.dependencies.every(depId => 
        completedSteps.includes(depId)
      );
      if (!dependenciesMet) return false;
    }
    
    return true;
  });
}

export function getStepStatus(stepId: string, completedSteps: string[], template: WorkflowTemplate): 'completed' | 'active' | 'pending' | 'blocked' {
  if (completedSteps.includes(stepId)) return 'completed';
  
  const step = template.steps.find(s => s.id === stepId);
  if (!step) return 'pending';
  
  // Check if dependencies are met
  if (step.dependencies) {
    const dependenciesMet = step.dependencies.every(depId => 
      completedSteps.includes(depId)
    );
    if (!dependenciesMet) return 'blocked';
  }
  
  // Check if this is the next logical step
  const nextSteps = getNextSteps(completedSteps, template);
  if (nextSteps.some(s => s.id === stepId)) return 'active';
  
  return 'pending';
}