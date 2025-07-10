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
    EligibilityAgent: Check patient insurance eligibility via 270/271 transactions
    
    Input:
    - patient_id: Patient identifier
    - insurance_info: Insurance card information
    - service_type: Type of service being verified
    - provider_info: Provider performing the service
    
    Output:
    - eligibility_status: Active, inactive, or unknown
    - coverage_details: Deductible, copay, coinsurance information
    - benefits: Covered services and limitations
    - authorization_required: Whether prior auth is needed
    """
    
    try:
        # Extract input data
        patient_id = event.get('patientId', '')
        insurance_info = event.get('insuranceInfo', {})
        service_type = event.get('serviceType', 'medical_care')
        provider_info = event.get('providerInfo', {})
        
        logger.info(f"Checking eligibility for patient: {patient_id}")
        
        # Generate 270 transaction
        x270_request = generate_270_transaction(
            patient_id, insurance_info, service_type, provider_info
        )
        
        # Submit eligibility inquiry
        if not event.get('development_mode', True):
            eligibility_response = submit_270_inquiry(x270_request)
        else:
            # Development mode - return mock data
            eligibility_response = generate_mock_eligibility_response(
                patient_id, insurance_info, service_type
            )
        
        # Parse 271 response
        eligibility_data = parse_271_response(eligibility_response)
        
        # Enhance with additional logic
        enhanced_data = enhance_eligibility_data(eligibility_data, service_type)
        
        result = {
            'success': True,
            'patient_id': patient_id,
            'eligibility_check_id': f"EC_{int(datetime.utcnow().timestamp())}",
            'timestamp': datetime.utcnow().isoformat(),
            **enhanced_data
        }
        
        # Store result
        store_agent_run({
            'agent_name': 'EligibilityAgent',
            'input_data': event,
            'output_data': result,
            'timestamp': datetime.utcnow().isoformat(),
            'patient_id': patient_id,
            'status': 'completed'
        })
        
        return {
            'statusCode': 200,
            'body': json.dumps(result)
        }
        
    except Exception as e:
        logger.error(f"Error in EligibilityAgent: {str(e)}")
        
        store_agent_run({
            'agent_name': 'EligibilityAgent',
            'input_data': event,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'failed'
        })
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': 'Failed to check eligibility',
                'message': str(e)
            })
        }

def generate_270_transaction(patient_id: str, insurance_info: Dict, 
                           service_type: str, provider_info: Dict) -> Dict:
    """Generate X12 270 eligibility inquiry transaction"""
    
    return {
        'transaction_set': '270',
        'version': '005010X279A1',
        'inquiry_id': f"INQ_{int(datetime.utcnow().timestamp())}",
        'patient': {
            'id': patient_id,
            'member_id': insurance_info.get('memberId', ''),
            'first_name': insurance_info.get('firstName', ''),
            'last_name': insurance_info.get('lastName', ''),
            'date_of_birth': insurance_info.get('dateOfBirth', '')
        },
        'payer': {
            'id': insurance_info.get('payerId', ''),
            'name': insurance_info.get('payerName', '')
        },
        'provider': {
            'npi': provider_info.get('npi', ''),
            'name': provider_info.get('name', ''),
            'tax_id': provider_info.get('taxId', '')
        },
        'service_type_codes': [service_type],
        'generated_at': datetime.utcnow().isoformat()
    }

def submit_270_inquiry(x270_request: Dict) -> Dict:
    """Submit 270 inquiry to clearinghouse/payer"""
    
    # In production, submit to clearinghouse or directly to payer
    logger.info(f"Submitting 270 inquiry: {x270_request['inquiry_id']}")
    
    # TODO: Implement actual 270/271 submission
    # This would typically go through a clearinghouse like Claim.MD
    
    return {
        'submission_successful': True,
        'inquiry_id': x270_request['inquiry_id'],
        'submitted_at': datetime.utcnow().isoformat()
    }

def generate_mock_eligibility_response(patient_id: str, insurance_info: Dict, 
                                     service_type: str) -> Dict:
    """Generate mock 271 eligibility response for development"""
    
    # Simulate different eligibility scenarios
    scenarios = ['active', 'inactive', 'pending', 'limited']
    scenario = scenarios[hash(patient_id) % len(scenarios)]
    
    if scenario == 'active':
        return {
            'eligibility_status': 'active',
            'effective_date': '2024-01-01',
            'plan_type': 'PPO',
            'deductible': {
                'individual': 1500.00,
                'remaining': 800.00
            },
            'copay': {
                'office_visit': 25.00,
                'specialist': 50.00,
                'emergency': 150.00
            },
            'coinsurance': 20.0,
            'out_of_pocket_max': {
                'individual': 5000.00,
                'remaining': 3200.00
            },
            'authorization_required': service_type in ['surgery', 'imaging', 'specialist'],
            'covered_services': ['medical_care', 'preventive', 'pharmacy'],
            'response_code': '001',
            'development_mode': True
        }
    elif scenario == 'inactive':
        return {
            'eligibility_status': 'inactive',
            'termination_date': '2023-12-31',
            'reason': 'Coverage terminated',
            'response_code': '003',
            'development_mode': True
        }
    else:
        return {
            'eligibility_status': 'unknown',
            'reason': 'Unable to verify coverage',
            'response_code': '004',
            'development_mode': True
        }

def parse_271_response(response_data: Dict) -> Dict:
    """Parse X12 271 eligibility response"""
    
    # In production, this would parse actual 271 transactions
    # For now, pass through the mock data
    
    return response_data

def enhance_eligibility_data(eligibility_data: Dict, service_type: str) -> Dict:
    """Enhance eligibility data with additional business logic"""
    
    enhanced = eligibility_data.copy()
    
    # Add recommendations based on eligibility
    if eligibility_data.get('eligibility_status') == 'active':
        recommendations = []
        
        # Check if authorization is required
        if eligibility_data.get('authorization_required'):
            recommendations.append({
                'type': 'prior_authorization',
                'message': 'Prior authorization required for this service',
                'priority': 'high'
            })
        
        # Check remaining deductible
        deductible = eligibility_data.get('deductible', {})
        remaining_deductible = deductible.get('remaining', 0)
        
        if remaining_deductible > 0:
            recommendations.append({
                'type': 'patient_payment',
                'message': f'Patient has ${remaining_deductible:.2f} remaining deductible',
                'priority': 'medium'
            })
        
        # Check out-of-pocket maximum
        oop_max = eligibility_data.get('out_of_pocket_max', {})
        remaining_oop = oop_max.get('remaining', 0)
        
        if remaining_oop < 1000:
            recommendations.append({
                'type': 'oop_maximum',
                'message': 'Patient close to out-of-pocket maximum',
                'priority': 'low'
            })
        
        enhanced['recommendations'] = recommendations
        enhanced['verification_status'] = 'verified'
        
    elif eligibility_data.get('eligibility_status') == 'inactive':
        enhanced['recommendations'] = [{
            'type': 'coverage_issue',
            'message': 'Patient coverage is inactive - verify current insurance',
            'priority': 'critical'
        }]
        enhanced['verification_status'] = 'failed'
        
    else:
        enhanced['recommendations'] = [{
            'type': 'verification_needed',
            'message': 'Unable to verify coverage - contact insurance directly',
            'priority': 'high'
        }]
        enhanced['verification_status'] = 'unknown'
    
    # Add estimated patient responsibility
    if eligibility_data.get('eligibility_status') == 'active':
        estimated_cost = estimate_patient_responsibility(eligibility_data, service_type)
        enhanced['estimated_patient_cost'] = estimated_cost
    
    return enhanced

def estimate_patient_responsibility(eligibility_data: Dict, service_type: str) -> Dict:
    """Estimate patient's financial responsibility"""
    
    # Mock service costs
    service_costs = {
        'office_visit': 200.00,
        'specialist': 350.00,
        'imaging': 800.00,
        'surgery': 5000.00,
        'emergency': 1200.00
    }
    
    estimated_charge = service_costs.get(service_type, 250.00)
    
    # Calculate patient responsibility
    copay = eligibility_data.get('copay', {}).get(service_type, 0.00)
    deductible_remaining = eligibility_data.get('deductible', {}).get('remaining', 0.00)
    coinsurance_rate = eligibility_data.get('coinsurance', 0.00) / 100
    
    # Simple calculation
    if copay > 0:
        patient_cost = copay
    else:
        deductible_portion = min(estimated_charge, deductible_remaining)
        coinsurance_portion = (estimated_charge - deductible_portion) * coinsurance_rate
        patient_cost = deductible_portion + coinsurance_portion
    
    return {
        'estimated_charge': estimated_charge,
        'patient_responsibility': round(patient_cost, 2),
        'insurance_portion': round(estimated_charge - patient_cost, 2),
        'calculation_method': 'estimated',
        'disclaimer': 'Estimate only - actual costs may vary'
    }

def store_agent_run(run_data: Dict) -> None:
    """Store agent execution data in RDS"""
    
    logger.info(f"Agent run data: {json.dumps(run_data, default=str)}")
    
    # TODO: Implement RDS connection
    # rds_client = boto3.client('rds-data')
    # rds_client.execute_statement(...)