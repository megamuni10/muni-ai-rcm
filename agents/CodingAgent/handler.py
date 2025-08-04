import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base_agent import BaseAgent
from typing import Dict, Any, Optional
import json
import logging

logger = logging.getLogger(__name__)

class CodingAgent(BaseAgent):
    """
    AI-powered medical coding using AWS Bedrock Nova Pro
    
    Converts clinical documentation into appropriate CPT and ICD-10 codes
    for claim submission. Replaces manual coding processes with AI accuracy.
    """
    
    def validate_input(self, event: Dict[str, Any]) -> Optional[str]:
        """Validate required input fields"""
        
        # Check for required clinical data
        clinical_notes = event.get('clinicalNotes') or event.get('chartNotes')
        if not clinical_notes:
            return "Missing required field: clinicalNotes or chartNotes"
        
        patient_data = event.get('patientData', {})
        if not patient_data.get('age') and not patient_data.get('dateOfBirth'):
            return "Patient age or date of birth is required"
        
        return None
    
    def execute_production_mode(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI-powered medical coding"""
        
        # Extract input data
        patient_data = event.get('patientData', {})
        encounter_data = event.get('encounterData', {})
        clinical_notes = event.get('clinicalNotes') or event.get('chartNotes', '')
        claim_id = event.get('claimId')
        
        # Build Nova Pro prompt
        prompt = self._build_coding_prompt(patient_data, encounter_data, clinical_notes)
        
        # Invoke Nova Pro
        response_text = self.invoke_nova_pro(prompt, max_tokens=2000, temperature=0.1)
        
        # Parse response
        coding_result = self._parse_coding_response(response_text)
        
        # Add metadata
        coding_result.update({
            'claim_id': claim_id,
            'patient_id': patient_data.get('id'),
            'model_used': self.bedrock_model_id,
            'confidence_threshold': 0.85,
            'requires_review': self._requires_manual_review(coding_result)
        })
        
        return coding_result
    
    def execute_development_mode(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Return realistic mock coding data for development"""
        
        patient_data = event.get('patientData', {})
        encounter_data = event.get('encounterData', {})
        
        return {
            'success': True,
            'cpt_codes': [
                {
                    'code': '99214',
                    'description': 'Office/outpatient visit, established patient, moderate complexity',
                    'confidence': 0.94,
                    'reasoning': 'Based on documented examination and medical decision making complexity'
                },
                {
                    'code': '36415',
                    'description': 'Collection of venous blood by venipuncture',
                    'confidence': 0.88,
                    'reasoning': 'Lab work documented in clinical notes'
                }
            ],
            'icd_codes': [
                {
                    'code': 'I10',
                    'description': 'Essential hypertension',
                    'confidence': 0.91,
                    'reasoning': 'Documented elevated blood pressure and current hypertension management'
                },
                {
                    'code': 'Z00.00',
                    'description': 'Encounter for general adult medical examination without abnormal findings',
                    'confidence': 0.85,
                    'reasoning': 'Annual wellness visit component documented'
                }
            ],
            'claim_id': event.get('claimId'),
            'patient_id': patient_data.get('id'),
            'model_used': 'development_mock',
            'development_mode': True,
            'requires_review': False,
            'overall_confidence': 0.89
        }
    
    def _build_coding_prompt(self, patient_data: Dict, encounter_data: Dict, clinical_notes: str) -> str:
        """Build comprehensive prompt for Nova Pro medical coding"""
        
        prompt = f"""You are an expert medical coder certified in CPT and ICD-10 coding. Analyze the following clinical documentation and provide accurate medical codes.

PATIENT INFORMATION:
Age: {patient_data.get('age', 'Not provided')}
Gender: {patient_data.get('gender', 'Not provided')}
Insurance: {patient_data.get('insurance', 'Not provided')}

ENCOUNTER DETAILS:
Visit Type: {encounter_data.get('visitType', 'Not provided')}
Date of Service: {encounter_data.get('dateOfService', 'Not provided')}
Provider: {encounter_data.get('provider', 'Not provided')}
Place of Service: {encounter_data.get('placeOfService', 'Office')}

CLINICAL DOCUMENTATION:
{clinical_notes}

CODING REQUIREMENTS:
1. Provide the most specific and appropriate CPT codes for all procedures, services, and evaluations performed
2. Provide the most specific ICD-10 codes for all diagnoses, both primary and secondary
3. Include confidence scores (0.0-1.0) for each code based on documentation quality
4. Provide brief reasoning for each code selection
5. Flag any codes that may require additional documentation

IMPORTANT CODING GUIDELINES:
- Use the most specific codes available
- Ensure medical necessity is supported by documentation
- Follow current CMS guidelines
- Consider both primary and secondary diagnoses
- Include preventive care codes when applicable

Please respond in the following JSON format only:
{{
    "success": true,
    "cpt_codes": [
        {{
            "code": "99214",
            "description": "Office visit, established patient, moderate complexity",
            "confidence": 0.95,
            "reasoning": "Documentation supports moderate complexity E&M visit"
        }}
    ],
    "icd_codes": [
        {{
            "code": "I10",
            "description": "Essential hypertension", 
            "confidence": 0.90,
            "reasoning": "Documented hypertension with ongoing management"
        }}
    ],
    "coding_notes": "Any additional notes about code selection",
    "documentation_gaps": ["List any missing documentation that could improve coding accuracy"]
}}"""
        
        return prompt
    
    def _parse_coding_response(self, response_text: str) -> Dict[str, Any]:
        """Parse and validate Nova Pro coding response"""
        
        try:
            result = self.extract_json_from_text(response_text)
            
            # Validate response structure
            if not result.get('success'):
                return {'success': False, 'error': 'AI coding failed', 'requires_review': True}
            
            # Ensure required fields exist
            cpt_codes = result.get('cpt_codes', [])
            icd_codes = result.get('icd_codes', [])
            
            if not cpt_codes and not icd_codes:
                return {'success': False, 'error': 'No codes generated', 'requires_review': True}
            
            # Calculate overall confidence
            all_confidences = []
            for code_list in [cpt_codes, icd_codes]:
                for code in code_list:
                    if 'confidence' in code:
                        all_confidences.append(code['confidence'])
            
            overall_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
            
            result['overall_confidence'] = overall_confidence
            return result
            
        except Exception as e:
            logger.error(f"Failed to parse coding response: {str(e)}")
            return {
                'success': False,
                'error': f'Response parsing failed: {str(e)}',
                'requires_review': True,
                'raw_response': response_text[:500]  # First 500 chars for debugging
            }
    
    def _requires_manual_review(self, coding_result: Dict[str, Any]) -> bool:
        """Determine if coding result requires manual review"""
        
        if not coding_result.get('success'):
            return True
        
        # Check overall confidence
        overall_confidence = coding_result.get('overall_confidence', 0.0)
        if overall_confidence < 0.85:
            return True
        
        # Check for documentation gaps
        if coding_result.get('documentation_gaps'):
            return True
        
        # Check individual code confidences
        for code_list in [coding_result.get('cpt_codes', []), coding_result.get('icd_codes', [])]:
            for code in code_list:
                if code.get('confidence', 0.0) < 0.80:
                    return True
        
        return False

# Lambda handler entry point
agent = CodingAgent()

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Lambda entry point"""
    return agent.lambda_handler(event, context)

