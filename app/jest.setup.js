// Jest setup file
import '@testing-library/jest-dom';

// Mock AWS Amplify
jest.mock('aws-amplify/auth', () => ({
  getCurrentUser: jest.fn(() => Promise.resolve({
    userId: 'test-user-123',
    email: 'test@example.com'
  }))
}));

jest.mock('aws-amplify/data', () => ({
  generateClient: jest.fn(() => ({
    models: {
      UserProfile: {
        get: jest.fn(() => Promise.resolve({
          data: {
            userId: 'test-user-123',
            email: 'test@example.com',
            role: 'Provider',
            organization: 'Test Org',
            isActive: true
          }
        }))
      },
      Claim: {
        create: jest.fn(() => Promise.resolve({ data: { id: 'test-claim' } }))
      },
      AgentRun: {
        create: jest.fn(() => Promise.resolve({ data: { id: 'test-run' } }))
      }
    }
  }))
}));

// Mock AWS SDK
jest.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn(() => ({
    send: jest.fn(() => Promise.resolve({
      Payload: JSON.stringify({ success: true, message: 'Test response' })
    }))
  })),
  InvokeCommand: jest.fn()
}));

// Setup environment
process.env.NODE_ENV = 'test';