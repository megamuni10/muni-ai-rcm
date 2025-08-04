#!/usr/bin/env python3
"""
Test script for Lambda agents in development mode
Tests all agents with mock data to verify they work correctly
"""

import json
import sys
import os
from datetime import datetime

# Add agents directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'agents'))

# Import agent handlers
from CodingAgent.handler import lambda_handler as coding_handler
from SubmitClaimAgent.handler import lambda_handler as submit_handler  
from DenialClassifierAgent.handler import lambda_handler as denial_handler
from AppealLetterAgent.handler import lambda_handler as appeal_handler

class MockContext:
    """Mock Lambda context for testing"""
    def __init__(self, function_name="test"):
        self.function_name = function_name
        self.aws_request_id = f"test-{datetime.now().timestamp()}"
        self.invoked_function_arn = f"arn:aws:lambda:us-east-1:123456789012:function:{function_name}"

def test_coding_agent():
    """Test CodingAgent with mock clinical data"""
    print("🧪 Testing CodingAgent...")
    
    event = {
        "clinicalNotes": """
        Patient presents for annual physical examination. 
        Blood pressure: 140/90 (elevated)
        Weight: 180 lbs, Height: 5'10"
        Assessment: Essential hypertension, routine preventive care
        Plan: Continue current antihypertensive medication, diet counseling
        Labs ordered: Comprehensive metabolic panel, lipid panel
        """,
        "patientData": {
            "id": "PAT-12345",
            "age": 45,
            "gender": "M"
        },
        "encounterData": {
            "visitType": "Annual Physical",
            "dateOfService": "2024-01-15",
            "provider": "Dr. Jane Smith, MD"
        },
        "claimId": "CLM-TEST-001"
    }
    
    # Set development mode
    os.environ['DEVELOPMENT_MODE'] = 'true'
    
    try:
        result = coding_handler(event, MockContext("CodingAgent"))
        response_data = json.loads(result['body'])
        
        if response_data['success']:
            print("  ✅ CodingAgent: SUCCESS")
            print(f"     Generated {len(response_data['result']['cpt_codes'])} CPT codes")
            print(f"     Generated {len(response_data['result']['icd_codes'])} ICD codes")
            print(f"     Overall confidence: {response_data['result']['overall_confidence']}")
        else:
            print("  ❌ CodingAgent: FAILED")
            print(f"     Error: {response_data.get('error')}")
            
    except Exception as e:
        print(f"  ❌ CodingAgent: EXCEPTION - {str(e)}")

def test_submit_claim_agent():
    """Test SubmitClaimAgent with mock claim data"""
    print("🧪 Testing SubmitClaimAgent...")
    
    event = {
        "claimData": {
            "claimId": "CLM-TEST-002",
            "patientId": "PAT-12345",
            "providerId": "PROV-001",
            "serviceDate": "2024-01-15",
            "claimType": "professional",
            "patient": {
                "id": "PAT-12345",
                "firstName": "John",
                "lastName": "Doe",
                "dateOfBirth": "1978-05-15",
                "gender": "M"
            },
            "provider": {
                "npi": "1234567890",
                "name": "Dr. Jane Smith"
            },
            "insurance": {
                "payerId": "AETNA",
                "payerName": "Aetna Insurance",
                "memberId": "ABC123456789"
            },
            "services": [
                {
                    "procedureCode": "99214",
                    "chargeAmount": 200.00,
                    "units": 1
                }
            ],
            "diagnosisCodes": ["I10", "Z00.00"]
        }
    }
    
    os.environ['DEVELOPMENT_MODE'] = 'true'
    
    try:
        result = submit_handler(event, MockContext("SubmitClaimAgent"))  
        response_data = json.loads(result['body'])
        
        if response_data['success']:
            print("  ✅ SubmitClaimAgent: SUCCESS")
            print(f"     Claim ID: {response_data['claim_id']}")
            print(f"     Batch ID: {response_data['claimmd_batch_id']}")
            print(f"     Status: {response_data['submission_status']}")
        else:
            print("  ❌ SubmitClaimAgent: FAILED")
            print(f"     Error: {response_data.get('error')}")
            
    except Exception as e:
        print(f"  ❌ SubmitClaimAgent: EXCEPTION - {str(e)}")

def test_denial_classifier_agent():
    """Test DenialClassifierAgent with mock denial data"""
    print("🧪 Testing DenialClassifierAgent...")
    
    event = {
        "denialData": {
            "claimId": "CLM-TEST-003", 
            "denialReason": "Insufficient documentation to support medical necessity",
            "denialCode": "B7",
            "denialDate": "2024-01-20",
            "payerName": "Aetna Insurance",
            "claimDetails": {
                "serviceDate": "2024-01-15",
                "procedureCodes": ["99214"],
                "diagnosisCodes": ["I10"],
                "totalAmount": 200.00
            }
        }
    }
    
    os.environ['DEVELOPMENT_MODE'] = 'true'
    
    try:
        result = denial_handler(event, MockContext("DenialClassifierAgent"))
        response_data = json.loads(result['body'])
        
        if response_data['success']:
            print("  ✅ DenialClassifierAgent: SUCCESS")
            print(f"     Category: {response_data['result']['denial_category']}")
            print(f"     Suggested action: {response_data['result']['suggested_action']}")
            print(f"     Appeal likelihood: {response_data['result']['appeal_likelihood']}")
        else:
            print("  ❌ DenialClassifierAgent: FAILED")
            print(f"     Error: {response_data.get('error')}")
            
    except Exception as e:
        print(f"  ❌ DenialClassifierAgent: EXCEPTION - {str(e)}")

def test_appeal_letter_agent():
    """Test AppealLetterAgent with mock appeal data"""
    print("🧪 Testing AppealLetterAgent...")
    
    event = {
        "appealData": {
            "claimId": "CLM-TEST-004",
            "patientName": "John Doe", 
            "denialReason": "Medical necessity not established",
            "denialCode": "B7",
            "denialDate": "2024-01-20",
            "payerName": "Aetna Insurance",
            "serviceDetails": {
                "dateOfService": "2024-01-15",
                "procedureCodes": ["99214"],
                "diagnosisCodes": ["I10"],
                "providerName": "Dr. Jane Smith"
            },
            "clinicalNotes": "Patient presented with elevated blood pressure requiring comprehensive evaluation and management."
        }
    }
    
    os.environ['DEVELOPMENT_MODE'] = 'true'
    
    try:
        result = appeal_handler(event, MockContext("AppealLetterAgent"))
        response_data = json.loads(result['body'])
        
        if response_data['success']:
            print("  ✅ AppealLetterAgent: SUCCESS")
            print(f"     Appeal ID: {response_data['result']['appeal_id']}")
            print(f"     Success probability: {response_data['result']['success_probability']}")
            print(f"     Letter length: {len(response_data['result']['appeal_letter'])} characters")
        else:
            print("  ❌ AppealLetterAgent: FAILED")
            print(f"     Error: {response_data.get('error')}")
            
    except Exception as e:
        print(f"  ❌ AppealLetterAgent: EXCEPTION - {str(e)}")

def main():
    """Run all agent tests"""
    print("🚀 Starting Lambda Agent Tests (Development Mode)")
    print("=" * 60)
    
    # Test all agents
    test_coding_agent()
    print()
    test_submit_claim_agent()
    print()  
    test_denial_classifier_agent()
    print()
    test_appeal_letter_agent()
    
    print()
    print("=" * 60)
    print("🎉 Agent testing complete!")
    print()
    print("Next steps:")
    print("1. Deploy CDK stacks: cd infra && npm run deploy")
    print("2. Run database migration: ./database/migrate.sh") 
    print("3. Test agents in AWS Lambda environment")

if __name__ == "__main__":
    main()