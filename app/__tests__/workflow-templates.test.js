/**
 * Unit tests for workflow templates and functionality
 */

const { 
  getWorkflowTemplate, 
  calculateProgress, 
  getNextSteps, 
  getStepStatus 
} = require('../components/workflow-templates');

describe('Workflow Templates', () => {
  describe('getWorkflowTemplate', () => {
    test('should return correct template for new-claim-submission', () => {
      const template = getWorkflowTemplate('new-claim-submission');
      
      expect(template).toBeDefined();
      expect(template.id).toBe('new-claim-submission');
      expect(template.name).toBe('New Claim Submission');
      expect(template.steps).toHaveLength(6);
      expect(template.steps[0].id).toBe('data-input');
    });

    test('should return null for invalid template', () => {
      const template = getWorkflowTemplate('invalid-template');
      expect(template).toBeNull();
    });
  });

  describe('calculateProgress', () => {
    test('should calculate correct progress percentage', () => {
      const template = getWorkflowTemplate('new-claim-submission');
      
      // No steps completed
      expect(calculateProgress([], template)).toBe(0);
      
      // 1 of 6 steps completed  
      expect(calculateProgress(['data-input'], template)).toBe(17);
      
      // 3 of 6 steps completed
      expect(calculateProgress(['data-input', 'eligibility-check', 'ai-coding'], template)).toBe(50);
      
      // All steps completed
      const allSteps = template.steps.map(s => s.id);
      expect(calculateProgress(allSteps, template)).toBe(100);
    });
  });

  describe('getNextSteps', () => {
    test('should return correct next steps based on dependencies', () => {
      const template = getWorkflowTemplate('new-claim-submission');
      
      // Initial state - should return data-input
      const initialSteps = getNextSteps([], template);
      expect(initialSteps).toHaveLength(1);
      expect(initialSteps[0].id).toBe('data-input');
      
      // After data-input - should return eligibility-check and ai-coding
      const afterDataInput = getNextSteps(['data-input'], template);
      expect(afterDataInput).toHaveLength(2);
      expect(afterDataInput.map(s => s.id)).toContain('eligibility-check');
      expect(afterDataInput.map(s => s.id)).toContain('ai-coding');
      
      // After ai-coding - should return code-review
      const afterAICoding = getNextSteps(['data-input', 'ai-coding'], template);
      expect(afterAICoding.map(s => s.id)).toContain('code-review');
    });
  });

  describe('getStepStatus', () => {
    test('should return correct status for each step', () => {
      const template = getWorkflowTemplate('new-claim-submission');
      
      // Initial state
      expect(getStepStatus('data-input', [], template)).toBe('active');
      expect(getStepStatus('eligibility-check', [], template)).toBe('blocked');
      
      // After data-input completed
      const completedDataInput = ['data-input'];
      expect(getStepStatus('data-input', completedDataInput, template)).toBe('completed');
      expect(getStepStatus('eligibility-check', completedDataInput, template)).toBe('active');
      expect(getStepStatus('ai-coding', completedDataInput, template)).toBe('active');
      expect(getStepStatus('code-review', completedDataInput, template)).toBe('blocked');
    });
  });
});

describe('Workflow Integration', () => {
  test('denial-management template should have correct structure', () => {
    const template = getWorkflowTemplate('denial-management');
    
    expect(template).toBeDefined();
    expect(template.id).toBe('denial-management');
    expect(template.steps).toHaveLength(4);
    expect(template.steps[0].id).toBe('denial-analysis');
    expect(template.steps[0].required).toBe(true);
  });

  test('pre-encounter-eligibility should be time-efficient', () => {
    const template = getWorkflowTemplate('pre-encounter-eligibility');
    
    expect(template).toBeDefined();
    expect(template.estimatedTotalTime).toBeLessThanOrEqual(5); // Should be quick
    expect(template.steps.some(s => !s.required)).toBe(true); // Has optional steps
  });

  test('all templates should have valid structure', () => {
    const templateIds = ['new-claim-submission', 'denial-management', 'pre-encounter-eligibility', 'era-processing'];
    
    templateIds.forEach(templateId => {
      const template = getWorkflowTemplate(templateId);
      
      expect(template).toBeDefined();
      expect(template.id).toBe(templateId);
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.steps).toBeDefined();
      expect(template.steps.length).toBeGreaterThan(0);
      expect(template.estimatedTotalTime).toBeGreaterThan(0);
      
      // Each step should have required fields
      template.steps.forEach(step => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.description).toBeTruthy();
        expect(step.icon).toBeTruthy();
        expect(typeof step.required).toBe('boolean');
        expect(step.estimatedTime).toBeGreaterThan(0);
      });
    });
  });
});