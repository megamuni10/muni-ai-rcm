import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base_agent import BaseAgent
from typing import Dict, Any, Optional
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class DenialClassifierAgent(BaseAgent):
    """
    AI-powered denial classification and analysis
    
    Analyzes denial reasons from payers and recommends appropriate actions:
    - Categorizes denial types (coding, auth, eligibility, etc.)
    - Suggests corrective actions
    - Estimates appeal success probability
    - Identifies prevention strategies
    """
    
    def validate_input(self, event: Dict[str, Any]) -> Optional[str]:
        """Validate denial data input"""
        
        denial_data = event.get('denialData')
        if not denial_data:
            return "Missing required field: denialData"
        
        if not denial_data.get('denialReason'):
            return "Missing denial reason"
        
        if not denial_data.get('claimId'):
            return "Missing claim ID"
        
        return None
    
    def execute_production_mode(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze denial using Nova Pro"""
        
        denial_data = event.get('denialData', {})
        claim_id = denial_data.get('claimId')
        
        # Build analysis prompt
        prompt = self._build_denial_analysis_prompt(denial_data)
        
        # Invoke Nova Pro for analysis
        response_text = self.invoke_nova_pro(prompt, max_tokens=1500, temperature=0.2)
        
        # Parse response
        analysis_result = self._parse_denial_analysis(response_text)
        
        # Store denial record in database
        self._store_denial_record(claim_id, denial_data, analysis_result)
        
        return {
            'success': True,
            'claim_id': claim_id,
            'denial_category': analysis_result.get('category'),
            'suggested_action': analysis_result.get('suggested_action'),
            'appeal_likelihood': analysis_result.get('appeal_likelihood'),
            'confidence': analysis_result.get('confidence'),
            'prevention_tips': analysis_result.get('prevention_tips', []),
            'requires_review': analysis_result.get('requires_review', False),
            'model_used': self.bedrock_model_id
        }
    
    def execute_development_mode(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Return mock denial analysis for development"""
        
        denial_data = event.get('denialData', {})
        claim_id = denial_data.get('claimId')
        
        return {
            'success': True,
            'claim_id': claim_id,
            'denial_category': 'coding_error',
            'suggested_action': 'recode_and_resubmit',
            'confidence': 0.92,
            'appeal_likelihood': 0.75,
            'prevention_tips': [
                'Review CPT code specificity requirements',
                'Ensure diagnosis supports medical necessity',
                'Consider modifier usage for accurate reporting'
            ],
            'requires_review': False,
            'development_mode': True,
            'estimated_rework_time': '15-30 minutes'
        }
    
    def _build_denial_analysis_prompt(self, denial_data: Dict[str, Any]) -> str:
        """Build prompt for Nova Pro denial analysis"""
        
        denial_reason = denial_data.get('denialReason', '')
        denial_code = denial_data.get('denialCode', '')
        payer_name = denial_data.get('payerName', '')
        claim_details = denial_data.get('claimDetails', {})
        
        prompt = f"""You are an expert medical billing and denial management specialist. Analyze the following claim denial and provide actionable recommendations.

DENIAL INFORMATION:
Payer: {payer_name}
Denial Code: {denial_code}
Denial Reason: {denial_reason}

ORIGINAL CLAIM DETAILS:
Service Date: {claim_details.get('serviceDate', 'Not provided')}
Procedure Codes: {', '.join(claim_details.get('procedureCodes', []))}
Diagnosis Codes: {', '.join(claim_details.get('diagnosisCodes', []))}
Total Amount: ${claim_details.get('totalAmount', 0)}

ANALYSIS REQUIREMENTS:
1. Categorize the denial type (coding_error, authorization_required, eligibility_issue, medical_necessity, documentation_insufficient, billing_error, etc.)
2. Determine the best corrective action (recode_and_resubmit, appeal_with_documentation, verify_eligibility, obtain_authorization, etc.)
3. Estimate appeal success likelihood (0.0-1.0)
4. Provide specific prevention tips for future claims
5. Assess if this requires immediate manual review

Consider common denial patterns, payer-specific policies, and industry best practices.

Respond in JSON format:
{{
    "category": "coding_error",
    "suggested_action": "recode_and_resubmit", 
    "confidence": 0.95,
    "appeal_likelihood": 0.80,
    "prevention_tips": [
        "Specific actionable tips to prevent similar denials"
    ],
    "requires_review": false,
    "reasoning": "Brief explanation of analysis"
}}"""
        
        return prompt
    
    def _parse_denial_analysis(self, response_text: str) -> Dict[str, Any]:
        """Parse Nova Pro denial analysis response"""
        
        try:
            result = self.extract_json_from_text(response_text)
            
            # Validate required fields
            required_fields = ['category', 'suggested_action', 'confidence']
            for field in required_fields:
                if field not in result:
                    result[field] = 'unknown' if field != 'confidence' else 0.5
            
            # Ensure confidence is within valid range
            confidence = result.get('confidence', 0.5)
            if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 1:
                result['confidence'] = 0.5
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to parse denial analysis: {str(e)}")
            return {
                'category': 'unknown',
                'suggested_action': 'manual_review',
                'confidence': 0.3,
                'requires_review': True,
                'error': f"Analysis parsing failed: {str(e)}"
            }
    
    def _store_denial_record(self, claim_id: str, denial_data: Dict[str, Any], analysis_result: Dict[str, Any]):
        """Store denial analysis in database for tracking and learning"""
        
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO denials (
                            claim_id, denial_date, denial_reason_code, 
                            denial_reason_description, denial_category,
                            ai_suggested_action, ai_prevention_tips,
                            created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (claim_id) DO UPDATE SET
                            denial_category = EXCLUDED.denial_category,
                            ai_suggested_action = EXCLUDED.ai_suggested_action,
                            ai_prevention_tips = EXCLUDED.ai_prevention_tips,
                            updated_at = %s
                    """, (
                        claim_id,
                        denial_data.get('denialDate'),
                        denial_data.get('denialCode'),
                        denial_data.get('denialReason'),
                        analysis_result.get('category'),
                        analysis_result.get('suggested_action'),
                        json.dumps(analysis_result.get('prevention_tips', [])),
                        datetime.utcnow(),
                        datetime.utcnow()
                    ))
                    conn.commit()
                    
        except Exception as e:
            logger.warning(f"Failed to store denial record: {str(e)}")

# Lambda handler entry point
agent = DenialClassifierAgent()

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Lambda entry point"""
    return agent.lambda_handler(event, context)