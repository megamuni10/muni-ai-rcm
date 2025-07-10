'use server';

import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({ 
  region: process.env.AWS_REGION || 'us-east-1' 
});

// Submit claim for processing
export async function submitClaim(formData: FormData) {
  const claimId = formData.get('claimId') as string;
  const patientId = formData.get('patientId') as string;
  const amount = parseFloat(formData.get('amount') as string);
  
  try {
    const command = new InvokeCommand({
      FunctionName: "SubmitClaimAgent",
      Payload: JSON.stringify({
        claimId,
        patientId,
        amount,
        timestamp: new Date().toISOString()
      })
    });
    
    const response = await lambda.send(command);
    const result = JSON.parse(response.Payload?.toString() || '{}');
    
    // In development, return mock response
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        claimId,
        status: 'submitted',
        message: 'Claim submitted successfully (dev mode)'
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error submitting claim:', error);
    return {
      success: false,
      error: 'Failed to submit claim'
    };
  }
}

// Check patient eligibility
export async function checkEligibility(formData: FormData) {
  const patientId = formData.get('patientId') as string;
  const insuranceId = formData.get('insuranceId') as string;
  
  try {
    const command = new InvokeCommand({
      FunctionName: "EligibilityAgent",
      Payload: JSON.stringify({
        patientId,
        insuranceId,
        timestamp: new Date().toISOString()
      })
    });
    
    const response = await lambda.send(command);
    const result = JSON.parse(response.Payload?.toString() || '{}');
    
    // Development mock
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        patientId,
        eligible: true,
        coverage: 'Active',
        copay: 25.00,
        deductible: 500.00,
        message: 'Eligibility verified (dev mode)'
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error checking eligibility:', error);
    return {
      success: false,
      error: 'Failed to check eligibility'
    };
  }
}

// Generate appeal letter
export async function generateAppeal(formData: FormData) {
  const claimId = formData.get('claimId') as string;
  const denialReason = formData.get('denialReason') as string;
  const additionalInfo = formData.get('additionalInfo') as string;
  
  try {
    const command = new InvokeCommand({
      FunctionName: "AppealLetterAgent",
      Payload: JSON.stringify({
        claimId,
        denialReason,
        additionalInfo,
        timestamp: new Date().toISOString()
      })
    });
    
    const response = await lambda.send(command);
    const result = JSON.parse(response.Payload?.toString() || '{}');
    
    // Development mock
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        claimId,
        appealLetter: `Dear Insurance Provider,\n\nWe are writing to appeal the denial of claim ${claimId}.\n\nReason for denial: ${denialReason}\n\nAdditional information: ${additionalInfo}\n\nWe respectfully request reconsideration of this claim.\n\nSincerely,\nMuni Health RCM Team`,
        message: 'Appeal letter generated (dev mode)'
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error generating appeal:', error);
    return {
      success: false,
      error: 'Failed to generate appeal letter'
    };
  }
}

// Estimate patient out-of-pocket cost
export async function estimatePatientCost(formData: FormData) {
  const patientId = formData.get('patientId') as string;
  const procedureCode = formData.get('procedureCode') as string;
  const facilityType = formData.get('facilityType') as string;
  
  try {
    const command = new InvokeCommand({
      FunctionName: "PatientEstimatorAgent",
      Payload: JSON.stringify({
        patientId,
        procedureCode,
        facilityType,
        timestamp: new Date().toISOString()
      })
    });
    
    const response = await lambda.send(command);
    const result = JSON.parse(response.Payload?.toString() || '{}');
    
    // Development mock
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        patientId,
        procedureCode,
        estimatedCost: 850.00,
        patientResponsibility: 125.00,
        insuranceCoverage: 725.00,
        message: 'Cost estimate calculated (dev mode)'
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error estimating cost:', error);
    return {
      success: false,
      error: 'Failed to estimate patient cost'
    };
  }
}