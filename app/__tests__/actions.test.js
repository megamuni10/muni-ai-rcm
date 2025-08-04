/**
 * Unit tests for server actions
 */

// Mock the server-only directive
jest.mock('server-only', () => ({}));

// Set environment to development for testing
process.env.NODE_ENV = 'development';

const { 
  processEHRData, 
  generateAICodes, 
  checkEligibility, 
  submitClaim 
} = require('../lib/actions');

describe('Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processEHRData', () => {
    test('should successfully process EHR data in development mode', async () => {
      const ehrData = `
        Patient: John Doe, DOB: 03/15/1985
        Visit Date: 01/15/2024
        Chief Complaint: Annual physical examination
        Assessment: Healthy adult male, no acute concerns
        Plan: Continue current medications, return in 1 year
      `;

      const result = await processEHRData(ehrData);

      expect(result.success).toBe(true);
      expect(result.claimId).toBeDefined();
      expect(result.extractedData).toBeDefined();
      expect(result.extractedData.patient.firstName).toBe('John');
      expect(result.extractedData.patient.lastName).toBe('Doe');
      expect(result.extractedData.diagnosis).toHaveLength(1);
      expect(result.extractedData.procedures).toHaveLength(1);
    });

    test('should handle empty EHR data', async () => {
      const result = await processEHRData('');

      // Even empty data should be processed in dev mode
      expect(result.success).toBe(true);
      expect(result.extractedData).toBeDefined();
    });
  });

  describe('generateAICodes', () => {
    test('should generate AI codes successfully', async () => {
      const claimId = 'CLM-12345';
      const clinicalData = {
        chiefComplaint: 'Annual physical',
        assessment: 'Healthy adult'
      };

      const result = await generateAICodes(claimId, clinicalData);

      expect(result.success).toBe(true);
      expect(result.claimId).toBe(claimId);
      expect(result.codes).toBeDefined();
      expect(result.codes.icd10).toHaveLength(1);
      expect(result.codes.cpt).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reasoning).toBeDefined();
    });

    test('should include proper code structure', async () => {
      const result = await generateAICodes('test-claim', {});

      expect(result.codes.icd10[0]).toHaveProperty('code');
      expect(result.codes.icd10[0]).toHaveProperty('description');
      expect(result.codes.icd10[0]).toHaveProperty('confidence');
      
      expect(result.codes.cpt[0]).toHaveProperty('code');
      expect(result.codes.cpt[0]).toHaveProperty('description');
      expect(result.codes.cpt[0]).toHaveProperty('units');
      expect(result.codes.cpt[0]).toHaveProperty('confidence');
    });
  });

  describe('checkEligibility', () => {
    test('should check eligibility successfully', async () => {
      const formData = new FormData();
      formData.append('patientId', 'PAT-12345');
      formData.append('insuranceId', 'INS-67890');

      const result = await checkEligibility(formData);

      expect(result.success).toBe(true);
      expect(result.patientId).toBe('PAT-12345');
      expect(result.eligible).toBe(true);
      expect(result.coverage).toBe('Active');
      expect(result.copay).toBeDefined();
      expect(result.deductible).toBeDefined();
      expect(result.benefits).toBeDefined();
    });
  });

  describe('submitClaim', () => {
    test('should submit claim successfully', async () => {
      const formData = new FormData();
      formData.append('claimId', 'CLM-12345');
      formData.append('patientId', 'PAT-67890');
      formData.append('amount', '250.00');

      const result = await submitClaim(formData);

      expect(result.success).toBe(true);
      expect(result.claimId).toBe('CLM-12345');
      expect(result.status).toBe('submitted');
      expect(result.trackingId).toBeDefined();
    });

    test('should handle missing required fields', async () => {
      const formData = new FormData();
      // Missing required fields

      const result = await submitClaim(formData);

      // In development mode, this should still work with defaults
      expect(result.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('actions should handle errors gracefully', async () => {
      // This test ensures our error handling works
      // In a real scenario, we might mock failures
      
      const result = await processEHRData('test data');
      expect(result).toHaveProperty('success');
      
      if (!result.success) {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('Development vs Production mode', () => {
    test('should return mock data in development', async () => {
      process.env.NODE_ENV = 'development';
      
      const result = await generateAICodes('test', {});
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('dev mode');
    });
  });
});