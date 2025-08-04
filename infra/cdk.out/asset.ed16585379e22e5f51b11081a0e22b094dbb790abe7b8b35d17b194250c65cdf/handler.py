import json
import boto3
import logging
from datetime import datetime
from typing import Dict, Any, List

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    ERAParserAgent: Parse 835 ERA files and extract payment/denial information
    
    Input:
    - era_file_url: S3 URL to the 835 ERA file
    - claim_ids: List of claim IDs to process
    - source: Source system (e.g., 'Claim.MD', 'manual_upload')
    
    Output:
    - parsed_payments: List of payment details
    - parsed_denials: List of denial details
    - claim_statuses: Updated status for each claim
    - summary: High-level summary of the ERA
    """
    
    try:
        # Extract input data
        era_file_url = event.get('eraFileUrl', '')
        claim_ids = event.get('claimIds', [])
        source = event.get('source', 'unknown')
        
        logger.info(f"Processing ERA file from {source}: {era_file_url}")
        
        # Download and parse ERA file
        if not event.get('development_mode', True):
            era_data = download_and_parse_era(era_file_url)
        else:
            # Development mode - use mock data
            era_data = generate_mock_era_data(claim_ids)
        
        # Process payments and denials
        payments = extract_payments(era_data)
        denials = extract_denials(era_data)
        
        # Update claim statuses
        claim_updates = update_claim_statuses(payments, denials)
        
        # Generate summary
        summary = generate_era_summary(payments, denials)
        
        # Store results
        result = {
            'success': True,
            'era_file_url': era_file_url,
            'source': source,
            'payments': payments,
            'denials': denials,
            'claim_updates': claim_updates,
            'summary': summary,
            'timestamp': datetime.utcnow().isoformat(),
            'processed_claims': len(claim_ids)
        }
        
        # Store in RDS
        store_agent_run({
            'agent_name': 'ERAParserAgent',
            'input_data': event,
            'output_data': result,
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'completed'
        })
        
        # Trigger follow-up agents if needed
        trigger_follow_up_processing(denials)
        
        return {
            'statusCode': 200,
            'body': json.dumps(result)
        }
        
    except Exception as e:
        logger.error(f"Error in ERAParserAgent: {str(e)}")
        
        store_agent_run({
            'agent_name': 'ERAParserAgent',
            'input_data': event,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'failed'
        })
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Failed to parse ERA file',
                'message': str(e)
            })
        }

def download_and_parse_era(era_file_url: str) -> Dict:
    """Download ERA file from S3 and parse X12 835 format"""
    
    # Extract S3 bucket and key from URL
    s3 = boto3.client('s3')
    
    # In production, implement X12 835 parsing
    # For now, return placeholder structure
    return {
        'transaction_set': '835',
        'version': '005010X221A1',
        'payer': {
            'name': 'Sample Insurance Co',
            'id': 'SAMPLE001'
        },
        'payment_details': [],
        'claim_details': []
    }

def generate_mock_era_data(claim_ids: List[str]) -> Dict:
    """Generate mock ERA data for development"""
    
    mock_claims = []
    for i, claim_id in enumerate(claim_ids):
        if i % 3 == 0:  # Some denials
            status = 'denied'
            paid_amount = 0.00
            denial_reason = 'Insufficient documentation'
        else:  # Mostly payments
            status = 'paid'
            paid_amount = 150.00 + (i * 25.00)
            denial_reason = None
            
        mock_claims.append({
            'claim_id': claim_id,
            'status': status,
            'charged_amount': 200.00 + (i * 25.00),
            'paid_amount': paid_amount,
            'patient_responsibility': 25.00 if status == 'paid' else 0.00,
            'denial_reason': denial_reason,
            'adjustment_codes': ['CO-45'] if status == 'denied' else None
        })
    
    return {
        'transaction_set': '835',
        'version': '005010X221A1',
        'payer': {
            'name': 'Mock Insurance Co',
            'id': 'MOCK001'
        },
        'payment_date': datetime.utcnow().isoformat(),
        'total_payment': sum(c['paid_amount'] for c in mock_claims),
        'claim_details': mock_claims,
        'development_mode': True
    }

def extract_payments(era_data: Dict) -> List[Dict]:
    """Extract payment information from ERA data"""
    
    payments = []
    for claim in era_data.get('claim_details', []):
        if claim.get('status') == 'paid' and claim.get('paid_amount', 0) > 0:
            payments.append({
                'claim_id': claim['claim_id'],
                'paid_amount': claim['paid_amount'],
                'patient_responsibility': claim.get('patient_responsibility', 0.00),
                'payment_date': era_data.get('payment_date', datetime.utcnow().isoformat()),
                'payer_name': era_data.get('payer', {}).get('name', 'Unknown'),
                'check_number': era_data.get('check_number', 'EFT'),
                'payment_method': 'electronic'
            })
    
    return payments

def extract_denials(era_data: Dict) -> List[Dict]:
    """Extract denial information from ERA data"""
    
    denials = []
    for claim in era_data.get('claim_details', []):
        if claim.get('status') == 'denied' or claim.get('denial_reason'):
            denials.append({
                'claim_id': claim['claim_id'],
                'denial_reason': claim.get('denial_reason', 'Unspecified'),
                'adjustment_codes': claim.get('adjustment_codes', []),
                'denied_amount': claim.get('charged_amount', 0.00),
                'denial_date': era_data.get('payment_date', datetime.utcnow().isoformat()),
                'payer_name': era_data.get('payer', {}).get('name', 'Unknown'),
                'appeal_eligible': True,
                'priority': 'medium'
            })
    
    return denials

def update_claim_statuses(payments: List[Dict], denials: List[Dict]) -> List[Dict]:
    """Update claim statuses based on payments and denials"""
    
    updates = []
    
    # Process payments
    for payment in payments:
        updates.append({
            'claim_id': payment['claim_id'],
            'new_status': 'paid',
            'paid_amount': payment['paid_amount'],
            'payment_date': payment['payment_date'],
            'updated_at': datetime.utcnow().isoformat()
        })
    
    # Process denials
    for denial in denials:
        updates.append({
            'claim_id': denial['claim_id'],
            'new_status': 'denied',
            'denial_reason': denial['denial_reason'],
            'denial_date': denial['denial_date'],
            'updated_at': datetime.utcnow().isoformat()
        })
    
    return updates

def generate_era_summary(payments: List[Dict], denials: List[Dict]) -> Dict:
    """Generate high-level summary of the ERA"""
    
    total_paid = sum(p['paid_amount'] for p in payments)
    total_denied = len(denials)
    total_claims = len(payments) + total_denied
    
    return {
        'total_claims_processed': total_claims,
        'total_payments': len(payments),
        'total_denials': total_denied,
        'total_paid_amount': total_paid,
        'average_payment': total_paid / max(len(payments), 1),
        'denial_rate': (total_denied / max(total_claims, 1)) * 100,
        'requires_follow_up': total_denied > 0,
        'generated_at': datetime.utcnow().isoformat()
    }

def trigger_follow_up_processing(denials: List[Dict]) -> None:
    """Trigger follow-up agents for denials"""
    
    if not denials:
        return
    
    # In production, trigger DenialClassifierAgent via EventBridge
    logger.info(f"Would trigger DenialClassifierAgent for {len(denials)} denials")
    
    # TODO: Implement EventBridge integration
    # eventbridge = boto3.client('events')
    # eventbridge.put_events(...)

def store_agent_run(run_data: Dict) -> None:
    """Store agent execution data in RDS"""
    
    logger.info(f"Agent run data: {json.dumps(run_data, default=str)}")
    
    # TODO: Implement RDS connection
    # rds_client = boto3.client('rds-data')
    # rds_client.execute_statement(...)