import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base_agent import BaseAgent
from typing import Dict, Any, Optional
import json
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class AppealLetterAgent(BaseAgent):
    """
    AI-powered appeal letter generation for denied claims
    
    Generates professional, compelling appeal letters with:
    - Medical necessity justification
    - Supporting documentation references
    - Regulatory compliance
    - Success probability assessment
    """
    
    def validate_input(self, event: Dict[str, Any]) -> Optional[str]:
        """Validate appeal letter request"""
        
        appeal_data = event.get('appealData')
        if not appeal_data:
            return "Missing required field: appealData"
        
        if not appeal_data.get('claimId'):
            return "Missing claim ID"
        
        if not appeal_data.get('denialReason'):
            return "Missing denial reason"
        
        return None
    
    def execute_production_mode(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Generate appeal letter using Nova Pro"""
        
        appeal_data = event.get('appealData', {})
        claim_id = appeal_data.get('claimId')
        
        # Build letter generation prompt
        prompt = self._build_appeal_letter_prompt(appeal_data)
        
        # Generate letter using Nova Pro
        letter_text = self.invoke_nova_pro(prompt, max_tokens=3000, temperature=0.3)
        
        # Clean and format the letter
        formatted_letter = self._format_appeal_letter(letter_text)
        
        # Calculate appeal deadline
        appeal_deadline = self._calculate_appeal_deadline(appeal_data)
        
        # Store appeal record
        appeal_record = self._store_appeal_record(claim_id, appeal_data, formatted_letter)
        
        return {
            'success': True,
            'claim_id': claim_id,
            'appeal_letter': formatted_letter,
            'appeal_deadline': appeal_deadline.isoformat(),
            'supporting_documents_needed': self._identify_supporting_documents(appeal_data),
            'success_probability': self._estimate_success_probability(appeal_data),
            'model_used': self.bedrock_model_id,
            'appeal_id': appeal_record.get('appeal_id')
        }
    
    def execute_development_mode(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Return mock appeal letter for development"""
        
        appeal_data = event.get('appealData', {})
        claim_id = appeal_data.get('claimId')
        
        mock_letter = """Dear Claims Administrator,

RE: Appeal for Claim #{claim_id}
Patient: John Doe
Date of Service: 2024-01-15
Provider: Dr. Jane Smith, MD

We are formally appealing your denial of the above-referenced claim dated {denial_date}. The denial reason cited was "{denial_reason}."

MEDICAL NECESSITY JUSTIFICATION:
The services provided were medically necessary and appropriate for the patient's condition. The documentation clearly supports the medical necessity for the procedure performed.

SUPPORTING EVIDENCE:
1. Clinical notes demonstrate the patient's symptoms and examination findings
2. Diagnostic results support the treatment plan
3. Current medical guidelines support the chosen intervention

We respectfully request that you reverse your denial decision and process payment for this claim. The services rendered meet all criteria for coverage under the patient's benefit plan.

Please contact our office if you require additional information. We look forward to your prompt response.

Sincerely,
Medical Billing Department
""".format(
            claim_id=claim_id,
            denial_date=datetime.now().strftime('%Y-%m-%d'),
            denial_reason=appeal_data.get('denialReason', 'medical necessity')
        )
        
        return {
            'success': True,
            'claim_id': claim_id,
            'appeal_letter': mock_letter,
            'appeal_deadline': (datetime.now() + timedelta(days=30)).isoformat(),
            'supporting_documents_needed': [
                'Clinical notes from date of service',
                'Diagnostic test results',
                'Medical necessity documentation'
            ],
            'success_probability': 0.75,
            'development_mode': True,
            'appeal_id': f'APPEAL-DEV-{claim_id}'
        }
    
    def _build_appeal_letter_prompt(self, appeal_data: Dict[str, Any]) -> str:
        """Build prompt for Nova Pro appeal letter generation"""
        
        claim_id = appeal_data.get('claimId')
        patient_name = appeal_data.get('patientName', '')
        denial_reason = appeal_data.get('denialReason', '')
        denial_code = appeal_data.get('denialCode', '')
        payer_name = appeal_data.get('payerName', '')
        service_details = appeal_data.get('serviceDetails', {})
        clinical_notes = appeal_data.get('clinicalNotes', '')
        
        prompt = f"""You are an expert medical billing and appeals specialist. Write a professional, compelling appeal letter for a denied medical claim. The letter should be formal, well-structured, and persuasive.

APPEAL DETAILS:
Claim ID: {claim_id}
Patient: {patient_name}
Payer: {payer_name}
Denial Code: {denial_code}
Denial Reason: {denial_reason}

SERVICE INFORMATION:
Date of Service: {service_details.get('dateOfService', '')}
Procedure Codes: {', '.join(service_details.get('procedureCodes', []))}
Diagnosis Codes: {', '.join(service_details.get('diagnosisCodes', []))}
Treating Provider: {service_details.get('providerName', '')}

CLINICAL CONTEXT:
{clinical_notes}

LETTER REQUIREMENTS:
1. Professional business letter format
2. Clear reference to the denied claim
3. Strong medical necessity justification
4. Address the specific denial reason
5. Reference supporting documentation
6. Request for prompt reconsideration
7. Professional, respectful tone throughout

The letter should be compelling and demonstrate that:
- The services were medically necessary
- The documentation supports the treatment
- The denial was inappropriate
- Coverage should be provided under the benefit plan

Generate a complete, ready-to-send appeal letter that maximizes the chance of reversal."""
        
        return prompt
    
    def _format_appeal_letter(self, raw_letter: str) -> str:
        """Clean and format the generated appeal letter"""
        
        # Remove any extra formatting or instructions
        lines = raw_letter.split('\n')
        formatted_lines = []
        
        for line in lines:
            # Skip lines that look like instructions or metadata
            if line.startswith(('```', 'Here is', 'This letter', 'Note:')):
                continue
            formatted_lines.append(line)
        
        return '\n'.join(formatted_lines).strip()
    
    def _calculate_appeal_deadline(self, appeal_data: Dict[str, Any]) -> datetime:
        """Calculate appeal filing deadline based on payer rules"""
        
        denial_date = appeal_data.get('denialDate')
        payer_name = appeal_data.get('payerName', '').lower()
        
        # Default to 30 days for most payers
        days_to_appeal = 30
        
        # Adjust based on payer-specific rules
        if 'medicare' in payer_name:
            days_to_appeal = 120  # Medicare allows longer appeal periods
        elif 'medicaid' in payer_name:
            days_to_appeal = 60   # Medicaid varies but typically 60 days
        
        if denial_date:
            try:
                denial_dt = datetime.fromisoformat(denial_date.replace('Z', '+00:00'))
                return denial_dt + timedelta(days=days_to_appeal)
            except:
                pass
        
        # Default to 30 days from now if denial date unavailable
        return datetime.now() + timedelta(days=days_to_appeal)
    
    def _identify_supporting_documents(self, appeal_data: Dict[str, Any]) -> list:
        """Identify what supporting documents are needed"""
        
        denial_reason = appeal_data.get('denialReason', '').lower()
        
        base_docs = [
            'Copy of original claim',
            'Clinical notes from date of service'
        ]
        
        if 'medical necessity' in denial_reason:
            base_docs.extend([
                'Medical necessity documentation',
                'Clinical guidelines or research supporting treatment',
                'Provider attestation of medical necessity'
            ])
        
        if 'authorization' in denial_reason:
            base_docs.extend([
                'Prior authorization request',
                'Emergency treatment documentation if applicable'
            ])
        
        if 'documentation' in denial_reason:
            base_docs.extend([
                'Complete medical records',
                'Diagnostic test results',
                'Treatment history'
            ])
        
        return base_docs
    
    def _estimate_success_probability(self, appeal_data: Dict[str, Any]) -> float:
        """Estimate probability of successful appeal"""
        
        denial_reason = appeal_data.get('denialReason', '').lower()
        
        # Base success rates by denial type
        success_rates = {
            'medical necessity': 0.65,
            'documentation': 0.75,
            'coding error': 0.80,
            'authorization': 0.55,
            'eligibility': 0.30,
            'duplicate': 0.85,
            'billing error': 0.90
        }
        
        base_probability = 0.60  # Default
        
        for reason, probability in success_rates.items():
            if reason in denial_reason:
                base_probability = probability
                break
        
        # Adjust based on available documentation
        clinical_notes = appeal_data.get('clinicalNotes', '')
        if clinical_notes and len(clinical_notes) > 500:
            base_probability += 0.10  # Good documentation helps
        
        return min(base_probability, 0.95)  # Cap at 95%
    
    def _store_appeal_record(self, claim_id: str, appeal_data: Dict[str, Any], letter_text: str) -> Dict[str, Any]:
        """Store appeal record in database"""
        
        appeal_id = f"APPEAL-{claim_id}-{int(datetime.utcnow().timestamp())}"
        
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO appeals (
                            appeal_id, claim_id, appeal_level, appeal_letter,
                            status, submitted_date, ai_generated_letter,
                            ai_confidence_score, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        appeal_id,
                        claim_id,
                        1,  # First level appeal
                        letter_text,
                        'draft',
                        None,  # Not submitted yet
                        True,
                        self._estimate_success_probability(appeal_data),
                        datetime.utcnow()
                    ))
                    conn.commit()
                    
            return {'appeal_id': appeal_id}
            
        except Exception as e:
            logger.warning(f"Failed to store appeal record: {str(e)}")
            return {'appeal_id': appeal_id}

# Lambda handler entry point
agent = AppealLetterAgent()

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Lambda entry point"""
    return agent.lambda_handler(event, context)