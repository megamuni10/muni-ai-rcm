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
    CodingAgent: AI-powered medical coding using AWS Bedrock Nova Pro
    
    Input:
    - patient_data: Patient demographics and medical history
    - encounter_data: Visit details, procedures, diagnoses
    - chart_notes: Clinical documentation
    
    Output:
    - cpt_codes: Suggested procedure codes
    - icd_codes: Suggested diagnosis codes
    - confidence_scores: AI confidence for each suggestion
    - reasoning: Explanation for code selections
    """
    
    try:
        # Extract input data
        patient_data = event.get('patientData', {})
        encounter_data = event.get('encounterData', {})
        chart_notes = event.get('chartNotes', '')
        
        # Log the incoming request
        logger.info(f"Processing coding request for patient: {patient_data.get('id', 'unknown')}")
        
        # Initialize Bedrock client (in production)
        if not event.get('development_mode', True):
            bedrock = boto3.client('bedrock-runtime')
            
            # Prepare prompt for Nova Pro
            prompt = build_coding_prompt(patient_data, encounter_data, chart_notes)
            
            # Call Bedrock Nova Pro
            response = bedrock.invoke_model(
                modelId='amazon.nova-pro-v1:0',
                body=json.dumps({
                    'inputText': prompt,
                    'textGenerationConfig': {
                        'maxTokenCount': 1000,
                        'temperature': 0.1,
                        'topP': 0.9
                    }
                })
            )
            
            result = json.loads(response['body'].read())
            coding_result = parse_bedrock_response(result)
        else:
            # Development mode - return mock data
            coding_result = generate_mock_coding_result(patient_data, encounter_data)
        
        # Store result in RDS (agent_runs table)
        store_agent_run({
            'agent_name': 'CodingAgent',
            'input_data': event,
            'output_data': coding_result,
            'timestamp': datetime.utcnow().isoformat(),
            'patient_id': patient_data.get('id'),
            'status': 'completed'
        })
        
        return {
            'statusCode': 200,
            'body': json.dumps(coding_result)
        }
        
    except Exception as e:
        logger.error(f"Error in CodingAgent: {str(e)}")
        
        # Store error in RDS
        store_agent_run({
            'agent_name': 'CodingAgent',
            'input_data': event,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'failed'
        })
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': 'Failed to process coding request'
            })
        }

def build_coding_prompt(patient_data: Dict, encounter_data: Dict, chart_notes: str) -> str:
    """Build the prompt for Bedrock Nova Pro"""
    
    prompt = f"""
You are an expert medical coder. Based on the following clinical information, suggest appropriate CPT and ICD-10 codes.

PATIENT INFORMATION:
Age: {patient_data.get('age', 'Not provided')}
Gender: {patient_data.get('gender', 'Not provided')}
Chief Complaint: {encounter_data.get('chief_complaint', 'Not provided')}

ENCOUNTER DETAILS:
Visit Type: {encounter_data.get('visit_type', 'Not provided')}
Date of Service: {encounter_data.get('date_of_service', 'Not provided')}
Provider: {encounter_data.get('provider', 'Not provided')}

CLINICAL NOTES:
{chart_notes}

Please provide:
1. CPT codes for procedures performed
2. ICD-10 codes for diagnoses
3. Confidence score (0-100) for each code
4. Brief reasoning for each code selection

Format your response as JSON with the following structure:
{{
    "cpt_codes": [
        {{"code": "99213", "description": "Office visit", "confidence": 95, "reasoning": "..."}}
    ],
    "icd_codes": [
        {{"code": "Z00.00", "description": "General exam", "confidence": 90, "reasoning": "..."}}
    ]
}}
"""
    
    return prompt

def parse_bedrock_response(bedrock_result: Dict) -> Dict:
    """Parse and validate Bedrock response"""
    
    try:
        # Extract generated text from Bedrock response
        generated_text = bedrock_result.get('results', [{}])[0].get('outputText', '')
        
        # Parse JSON from the generated text
        coding_data = json.loads(generated_text)
        
        return {
            'success': True,
            'cpt_codes': coding_data.get('cpt_codes', []),
            'icd_codes': coding_data.get('icd_codes', []),
            'timestamp': datetime.utcnow().isoformat(),
            'model_used': 'amazon.nova-pro-v1:0'
        }
        
    except (json.JSONDecodeError, KeyError) as e:
        logger.error(f"Failed to parse Bedrock response: {e}")
        return generate_fallback_coding_result()

def generate_mock_coding_result(patient_data: Dict, encounter_data: Dict) -> Dict:
    """Generate mock coding result for development"""
    
    return {
        'success': True,
        'cpt_codes': [
            {
                'code': '99213',
                'description': 'Office or other outpatient visit for evaluation and management',
                'confidence': 95,
                'reasoning': 'Standard office visit with moderate complexity'
            },
            {
                'code': '36415',
                'description': 'Collection of venous blood by venipuncture',
                'confidence': 88,
                'reasoning': 'Blood draw for laboratory tests'
            }
        ],
        'icd_codes': [
            {
                'code': 'Z00.00',
                'description': 'Encounter for general adult medical examination without abnormal findings',
                'confidence': 92,
                'reasoning': 'Routine preventive care visit'
            }
        ],
        'timestamp': datetime.utcnow().isoformat(),
        'model_used': 'development_mock',
        'development_mode': True
    }

def generate_fallback_coding_result() -> Dict:
    """Generate fallback result when AI fails"""
    
    return {
        'success': False,
        'error': 'AI coding failed',
        'cpt_codes': [],
        'icd_codes': [],
        'requires_manual_review': True,
        'timestamp': datetime.utcnow().isoformat()
    }

def store_agent_run(run_data: Dict) -> None:
    """Store agent execution data in RDS"""
    
    # In production, this would write to RDS
    # For now, just log the data
    logger.info(f"Agent run data: {json.dumps(run_data, default=str)}")
    
    # TODO: Implement RDS connection and insert
    # rds_client = boto3.client('rds-data')
    # rds_client.execute_statement(...)