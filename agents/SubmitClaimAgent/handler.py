import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base_agent import BaseAgent
from typing import Dict, Any, Optional
import json
import logging
import boto3
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

class SubmitClaimAgent(BaseAgent):
    """
    Submit claims to Claim MD for X12 EDI generation and payer submission
    
    This agent submits structured JSON claim data to Claim MD, which handles:
    - X12 837 EDI generation and validation
    - Payer-specific formatting requirements  
    - Claim submission to clearinghouses/payers
    - Status tracking and notifications
    """
    
    def validate_input(self, event: Dict[str, Any]) -> Optional[str]:
        """Validate required claim submission fields"""
        
        claim_data = event.get('claimData')
        if not claim_data:
            return "Missing required field: claimData"
        
        # Check for essential claim fields
        required_fields = ['claimId', 'patientId', 'providerId', 'serviceDate']
        for field in required_fields:
            if not claim_data.get(field):
                return f"Missing required claim field: {field}"
        
        # Check for services
        services = claim_data.get('services', [])
        if not services:
            return "At least one service must be provided"
        
        return None
    
    def execute_production_mode(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Submit claim to Claim MD production API"""
        
        claim_data = event.get('claimData', {})
        claim_id = claim_data.get('claimId')
        
        # Get Claim MD credentials
        claim_md_config = self._get_claim_md_config()
        
        # Prepare claim payload for Claim MD
        claim_payload = self._prepare_claim_md_payload(claim_data)
        
        # Submit to Claim MD
        submission_result = self._submit_to_claim_md(claim_payload, claim_md_config)
        
        # Update local claim record
        self._update_claim_record(claim_id, submission_result)
        
        return {
            'success': True,
            'claim_id': claim_id,
            'claimmd_batch_id': submission_result.get('batch_id'),
            'claimmd_claim_id': submission_result.get('claim_id'),
            'submission_status': submission_result.get('status', 'submitted'),
            'tracking_number': submission_result.get('tracking_number'),
            'expected_response_time': '24-48 hours',
            'submitted_at': datetime.utcnow().isoformat()
        }
    
    def execute_development_mode(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Return mock submission result for development"""
        
        claim_data = event.get('claimData', {})
        claim_id = claim_data.get('claimId')
        
        return {
            'success': True,
            'claim_id': claim_id,
            'claimmd_batch_id': f'BATCH-DEV-{claim_id}',
            'claimmd_claim_id': f'CMD-DEV-{claim_id}',
            'submission_status': 'submitted',
            'tracking_number': f'TRK-DEV-{claim_id}',
            'expected_response_time': '24-48 hours',
            'development_mode': True,
            'submitted_at': datetime.utcnow().isoformat(),
            'message': 'Claim processed in development mode - no actual submission'
        }
    
    def _get_claim_md_config(self) -> Dict[str, str]:
        """Get Claim MD API configuration from Secrets Manager"""
        
        try:
            secrets_client = boto3.client('secretsmanager', region_name=self.aws_region)
            response = secrets_client.get_secret_value(
                SecretId='muni-rcm/claim-md-credentials'
            )
            return json.loads(response['SecretString'])
        except Exception as e:
            logger.error(f"Failed to get Claim MD credentials: {str(e)}")
            raise Exception("Claim MD configuration not available")
    
    def _prepare_claim_md_payload(self, claim_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert our internal claim format to Claim MD API format
        """
        
        # Extract key claim components
        patient = claim_data.get('patient', {})
        provider = claim_data.get('provider', {})
        insurance = claim_data.get('insurance', {})
        services = claim_data.get('services', [])
        diagnosis_codes = claim_data.get('diagnosisCodes', [])
        
        # Build Claim MD payload structure
        payload = {
            'claim': {
                'id': claim_data.get('claimId'),
                'type': claim_data.get('claimType', 'professional'),
                'service_date': claim_data.get('serviceDate'),
                'patient': {
                    'id': patient.get('id'),
                    'first_name': patient.get('firstName'),
                    'last_name': patient.get('lastName'),
                    'date_of_birth': patient.get('dateOfBirth'),
                    'gender': patient.get('gender'),
                    'address': patient.get('address', {}),
                    'phone': patient.get('phone'),
                    'ssn': patient.get('ssn')  # Will be encrypted by Claim MD
                },
                'provider': {
                    'npi': provider.get('npi'),
                    'name': provider.get('name'),
                    'taxonomy': provider.get('taxonomy'),
                    'address': provider.get('address', {}),
                    'phone': provider.get('phone')
                },
                'insurance': {
                    'payer_id': insurance.get('payerId'),
                    'payer_name': insurance.get('payerName'),
                    'member_id': insurance.get('memberId'),
                    'group_number': insurance.get('groupNumber'),
                    'plan_name': insurance.get('planName')
                },
                'services': [
                    {
                        'line_number': i + 1,
                        'procedure_code': service.get('procedureCode'),
                        'modifiers': service.get('modifiers', []),
                        'diagnosis_pointers': service.get('diagnosisPointers', [1]),
                        'service_date': service.get('serviceDate', claim_data.get('serviceDate')),
                        'units': service.get('units', 1),
                        'charge_amount': service.get('chargeAmount'),
                        'place_of_service': service.get('placeOfService', '11')
                    }
                    for i, service in enumerate(services)
                ],
                'diagnoses': [
                    {
                        'pointer': i + 1,
                        'code': dx_code,
                        'code_type': 'ICD10'
                    }
                    for i, dx_code in enumerate(diagnosis_codes)
                ]
            },
            'options': {
                'validate_only': False,
                'test_mode': False,
                'priority': 'normal'
            }
        }
        
        return payload
    
    def _submit_to_claim_md(self, payload: Dict[str, Any], config: Dict[str, str]) -> Dict[str, Any]:
        """Submit claim to Claim MD API"""
        
        api_url = config.get('api_url', 'https://api.claim.md')
        account_key = config.get('account_key')
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {account_key}',
            'X-API-Version': '2024-01'
        }
        
        try:
            response = requests.post(
                f'{api_url}/claims/submit',
                json=payload,
                headers=headers,
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            return {
                'status': 'submitted',
                'batch_id': result.get('batch_id'),
                'claim_id': result.get('claim_id'),
                'tracking_number': result.get('tracking_number'),
                'validation_status': result.get('validation_status'),
                'submission_id': result.get('submission_id')
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Claim MD API error: {str(e)}")
            
            # Check for validation errors
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    return {
                        'status': 'rejected',
                        'error': 'Claim MD validation failed',
                        'validation_errors': error_data.get('errors', []),
                        'needs_rework': True
                    }
                except:
                    pass
            
            raise Exception(f"Claim MD submission failed: {str(e)}")
    
    def _update_claim_record(self, claim_id: str, submission_result: Dict[str, Any]):
        """Update local claim record with Claim MD submission info"""
        
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE claims 
                        SET claimmd_batch_id = %s,
                            claimmd_status = %s,
                            claimmd_submission_date = %s,
                            status = CASE 
                                WHEN %s = 'rejected' THEN 'rejected'
                                ELSE 'submitted'
                            END,
                            updated_at = %s
                        WHERE claim_id = %s
                    """, (
                        submission_result.get('batch_id'),
                        submission_result.get('status'),
                        datetime.utcnow(),
                        submission_result.get('status'),
                        datetime.utcnow(),
                        claim_id
                    ))
                    conn.commit()
                    
        except Exception as e:
            logger.warning(f"Failed to update claim record: {str(e)}")

# Lambda handler entry point
agent = SubmitClaimAgent()

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Lambda entry point"""
    return agent.lambda_handler(event, context)

