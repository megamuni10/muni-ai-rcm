import json
import boto3
import logging
from datetime import datetime
from typing import Dict, Any

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    SubmitClaimAgent: Generate and submit 837 claims to clearinghouses
    
    Input:
    - claim_data: Complete claim information (patient, provider, services)
    - submission_method: 'claim_md', 'direct', 'test'
    - validate_only: If true, only validate without submitting
    
    Output:
    - submission_id: Unique identifier for the submission
    - validation_results: Claim validation results
    - submission_status: Status of the submission
    - tracking_info: Information for tracking the claim
    """
    
    try:
        # Extract input data
        claim_data = event.get('claimData', {})
        submission_method = event.get('submissionMethod', 'test')
        validate_only = event.get('validateOnly', False)
        
        claim_id = claim_data.get('claimId', f"CLM_{int(datetime.utcnow().timestamp())}")
        
        logger.info(f"Processing claim submission: {claim_id}")
        
        # Validate claim data
        validation_results = validate_claim_data(claim_data)
        
        if not validation_results['is_valid']:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'success': False,
                    'claim_id': claim_id,
                    'validation_results': validation_results,
                    'message': 'Claim validation failed'
                })
            }
        
        # Generate 837 transaction
        x837_data = generate_837_transaction(claim_data)
        
        submission_result = {
            'claim_id': claim_id,
            'validation_results': validation_results,
            'x837_generated': True,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Submit claim if not validation-only
        if not validate_only:
            if submission_method == 'claim_md':
                submission_info = submit_to_claim_md(x837_data, claim_data)
            elif submission_method == 'direct':
                submission_info = submit_direct(x837_data, claim_data)
            else:  # test mode
                submission_info = generate_test_submission(claim_id)
            
            submission_result.update(submission_info)
        else:
            submission_result['validate_only'] = True
            submission_result['submission_status'] = 'validation_complete'
        
        # Store submission data
        store_agent_run({
            'agent_name': 'SubmitClaimAgent',
            'input_data': event,
            'output_data': submission_result,
            'timestamp': datetime.utcnow().isoformat(),
            'claim_id': claim_id,
            'status': 'completed'
        })
        
        # Store claim in tracking system
        store_claim_submission(claim_id, submission_result)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                **submission_result
            })
        }
        
    except Exception as e:
        logger.error(f"Error in SubmitClaimAgent: {str(e)}")
        
        store_agent_run({
            'agent_name': 'SubmitClaimAgent',
            'input_data': event,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'failed'
        })
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': 'Failed to submit claim',
                'message': str(e)
            })
        }

def validate_claim_data(claim_data: Dict) -> Dict:
    """Validate claim data before submission"""
    
    errors = []
    warnings = []
    
    # Required fields validation
    required_fields = [
        'patientId', 'providerId', 'serviceDate', 
        'diagnosisCodes', 'procedureCodes', 'charges'
    ]
    
    for field in required_fields:
        if not claim_data.get(field):
            errors.append(f"Missing required field: {field}")
    
    # Patient information validation
    patient = claim_data.get('patient', {})
    if not patient.get('firstName') or not patient.get('lastName'):
        errors.append("Patient first and last name are required")
    
    if not patient.get('dateOfBirth'):
        errors.append("Patient date of birth is required")
    
    # Insurance validation
    insurance = claim_data.get('insurance', {})
    if not insurance.get('payerId'):
        errors.append("Insurance payer ID is required")
    
    if not insurance.get('memberId'):
        errors.append("Insurance member ID is required")
    
    # Service validation
    services = claim_data.get('services', [])
    if not services:
        errors.append("At least one service must be provided")
    
    for i, service in enumerate(services):
        if not service.get('procedureCode'):
            errors.append(f"Service {i+1}: Procedure code is required")
        
        if not service.get('chargeAmount') or service.get('chargeAmount') <= 0:
            errors.append(f"Service {i+1}: Valid charge amount is required")
    
    # Diagnosis codes validation
    diagnosis_codes = claim_data.get('diagnosisCodes', [])
    if not diagnosis_codes:
        errors.append("At least one diagnosis code is required")
    
    # Warnings for best practices
    if len(diagnosis_codes) > 12:
        warnings.append("More than 12 diagnosis codes may cause processing delays")
    
    total_charges = sum(s.get('chargeAmount', 0) for s in services)
    if total_charges > 10000:
        warnings.append("High-value claim may require additional documentation")
    
    return {
        'is_valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings,
        'validated_at': datetime.utcnow().isoformat()
    }

def generate_837_transaction(claim_data: Dict) -> Dict:
    """Generate X12 837 Professional transaction"""
    
    # In production, this would generate a full X12 837 transaction
    # For now, return a structured representation
    
    return {
        'transaction_set': '837',
        'version': '005010X222A1',
        'claim_id': claim_data.get('claimId'),
        'patient': claim_data.get('patient', {}),
        'provider': claim_data.get('provider', {}),
        'insurance': claim_data.get('insurance', {}),
        'services': claim_data.get('services', []),
        'diagnosis_codes': claim_data.get('diagnosisCodes', []),
        'generated_at': datetime.utcnow().isoformat(),
        'format': 'X12_837P'
    }

def submit_to_claim_md(x837_data: Dict, claim_data: Dict) -> Dict:
    """Submit claim via Claim.MD clearinghouse"""
    
    # In production, integrate with Claim.MD API
    logger.info("Would submit to Claim.MD clearinghouse")
    
    return {
        'submission_method': 'claim_md',
        'submission_id': f"CMD_{int(datetime.utcnow().timestamp())}",
        'submission_status': 'submitted',
        'clearinghouse': 'Claim.MD',
        'expected_response_time': '24-48 hours',
        'tracking_url': f"https://claim.md/track/{x837_data['claim_id']}",
        'submitted_at': datetime.utcnow().isoformat()
    }

def submit_direct(x837_data: Dict, claim_data: Dict) -> Dict:
    """Submit claim directly to payer"""
    
    # In production, submit directly to payer systems
    logger.info("Would submit directly to payer")
    
    payer_id = claim_data.get('insurance', {}).get('payerId', 'UNKNOWN')
    
    return {
        'submission_method': 'direct',
        'submission_id': f"DIR_{int(datetime.utcnow().timestamp())}",
        'submission_status': 'submitted',
        'payer_id': payer_id,
        'expected_response_time': '5-10 business days',
        'submitted_at': datetime.utcnow().isoformat()
    }

def generate_test_submission(claim_id: str) -> Dict:
    """Generate test submission for development/testing"""
    
    return {
        'submission_method': 'test',
        'submission_id': f"TEST_{int(datetime.utcnow().timestamp())}",
        'submission_status': 'test_submitted',
        'message': 'Claim processed in test mode',
        'development_mode': True,
        'submitted_at': datetime.utcnow().isoformat(),
        'test_scenario': 'successful_submission'
    }

def store_claim_submission(claim_id: str, submission_data: Dict) -> None:
    """Store claim submission in tracking system"""
    
    # In production, store in RDS claims table
    logger.info(f"Storing claim submission: {claim_id}")
    
    # TODO: Implement RDS storage
    # rds_client = boto3.client('rds-data')
    # INSERT INTO claims (claim_id, submission_data, status, created_at) VALUES (...)

def store_agent_run(run_data: Dict) -> None:
    """Store agent execution data in RDS"""
    
    logger.info(f"Agent run data: {json.dumps(run_data, default=str)}")
    
    # TODO: Implement RDS connection
    # rds_client = boto3.client('rds-data')
    # rds_client.execute_statement(...)