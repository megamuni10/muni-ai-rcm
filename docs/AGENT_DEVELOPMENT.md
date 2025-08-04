# Agent Development Guide - Muni AI RCM Platform

## Overview

Agents are the core intelligence layer of the Muni AI RCM platform. Each agent is a specialized Python Lambda function that handles a specific aspect of the revenue cycle. This guide covers how to create, test, deploy, and integrate new agents into the platform.

## Agent Architecture

### Core Principles

1. **Single Responsibility**: Each agent handles one specific RCM task
2. **Stateless Design**: No persistent state within agents
3. **Schema-Driven**: Input/output contracts via JSON Schema
4. **Development Mode**: Mock responses for local testing
5. **Comprehensive Logging**: Structured logs for debugging and ML training

### Agent Structure

```
agents/
└── YourAgentName/
    ├── handler.py       # Main Lambda handler
    ├── prompt.py        # LLM prompt templates
    ├── schema.py        # Input/output validation
    ├── utils.py         # Helper functions
    ├── requirements.txt # Python dependencies
    └── __init__.py
```

## Creating a New Agent

### Step 1: Define the Agent's Purpose

Before writing code, clearly define:
- What RCM problem does this agent solve?
- What inputs does it need?
- What outputs should it produce?
- Which external services will it interact with?

### Step 2: Create the Agent Directory

```bash
# From repository root
mkdir -p agents/YourAgentName
cd agents/YourAgentName
```

### Step 3: Create the JSON Schema

Define the agent's API contract in `schemas/your-agent-name.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "YourAgentName Schema",
  "type": "object",
  "properties": {
    "input": {
      "type": "object",
      "properties": {
        "claimId": {
          "type": "string",
          "description": "Unique claim identifier"
        },
        "patientData": {
          "type": "object",
          "properties": {
            "mrn": { "type": "string" },
            "dateOfBirth": { "type": "string", "format": "date" },
            "insurance": {
              "type": "object",
              "properties": {
                "payerId": { "type": "string" },
                "memberId": { "type": "string" }
              }
            }
          }
        },
        "clinicalData": {
          "type": "object",
          "description": "Clinical information for processing"
        }
      },
      "required": ["claimId", "patientData"]
    },
    "output": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string",
          "enum": ["success", "error", "partial"]
        },
        "result": {
          "type": "object",
          "description": "Agent-specific results"
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "metadata": {
          "type": "object",
          "properties": {
            "processingTime": { "type": "number" },
            "llmTokensUsed": { "type": "integer" }
          }
        }
      },
      "required": ["status", "result"]
    }
  }
}
```

### Step 4: Implement the Handler

Create `handler.py`:

```python
import json
import os
import logging
from datetime import datetime
from typing import Dict, Any
import boto3
from jsonschema import validate
import traceback

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
bedrock = boto3.client('bedrock-runtime')
dynamodb = boto3.resource('dynamodb')
secrets = boto3.client('secretsmanager')

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for YourAgentName
    
    Args:
        event: Input event containing claim and patient data
        context: Lambda context object
        
    Returns:
        Response dictionary with status and results
    """
    start_time = datetime.utcnow()
    
    try:
        # Log incoming request
        logger.info(f"Processing request: {json.dumps(event)}")
        
        # Development mode check
        if os.environ.get('DEVELOPMENT_MODE', 'false').lower() == 'true':
            return handle_development_mode(event)
        
        # Validate input
        validate_input(event)
        
        # Extract data
        claim_id = event['claimId']
        patient_data = event['patientData']
        clinical_data = event.get('clinicalData', {})
        
        # Main processing logic
        result = process_claim(claim_id, patient_data, clinical_data)
        
        # Store agent run for audit/ML training
        store_agent_run(event, result, start_time)
        
        # Return successful response
        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'success',
                'result': result,
                'confidence': result.get('confidence', 0.95),
                'metadata': {
                    'processingTime': (datetime.utcnow() - start_time).total_seconds(),
                    'agentVersion': os.environ.get('AGENT_VERSION', '1.0.0')
                }
            })
        }
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return error_response(400, str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}\n{traceback.format_exc()}")
        return error_response(500, "Internal processing error")

def validate_input(event: Dict[str, Any]) -> None:
    """Validate input against schema"""
    # Load schema (in production, cache this)
    schema_path = os.path.join(os.path.dirname(__file__), '../../schemas/your-agent-name.json')
    with open(schema_path, 'r') as f:
        schema = json.load(f)
    
    # Validate
    validate(event, schema['properties']['input'])

def process_claim(claim_id: str, patient_data: Dict, clinical_data: Dict) -> Dict[str, Any]:
    """
    Main processing logic for the agent
    """
    # Example: Call Bedrock for AI processing
    prompt = generate_prompt(patient_data, clinical_data)
    
    response = bedrock.invoke_model(
        modelId='anthropic.claude-3-sonnet-20240229-v1:0',
        contentType='application/json',
        accept='application/json',
        body=json.dumps({
            'prompt': prompt,
            'max_tokens': 1000,
            'temperature': 0.1
        })
    )
    
    # Parse response
    ai_result = json.loads(response['body'].read())
    
    # Post-process and structure result
    return {
        'processedClaimId': claim_id,
        'recommendations': ai_result.get('recommendations', []),
        'confidence': calculate_confidence(ai_result),
        'details': ai_result
    }

def generate_prompt(patient_data: Dict, clinical_data: Dict) -> str:
    """Generate LLM prompt based on input data"""
    from .prompt import MAIN_PROMPT_TEMPLATE
    
    return MAIN_PROMPT_TEMPLATE.format(
        patient_data=json.dumps(patient_data, indent=2),
        clinical_data=json.dumps(clinical_data, indent=2)
    )

def calculate_confidence(ai_result: Dict) -> float:
    """Calculate confidence score based on AI response"""
    # Implement your confidence calculation logic
    # This is a simplified example
    if 'confidence_factors' in ai_result:
        factors = ai_result['confidence_factors']
        return sum(factors.values()) / len(factors)
    return 0.85  # Default confidence

def store_agent_run(event: Dict, result: Dict, start_time: datetime) -> None:
    """Store execution details for audit and ML training"""
    table = dynamodb.Table(os.environ.get('AGENT_RUNS_TABLE', 'agent_runs'))
    
    table.put_item(Item={
        'runId': context.request_id,
        'agentName': 'YourAgentName',
        'timestamp': start_time.isoformat(),
        'input': event,
        'output': result,
        'processingTime': (datetime.utcnow() - start_time).total_seconds(),
        'success': True
    })

def handle_development_mode(event: Dict[str, Any]) -> Dict[str, Any]:
    """Return mock data for development"""
    logger.info("Running in development mode - returning mock data")
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'status': 'success',
            'result': {
                'processedClaimId': event.get('claimId', 'MOCK-123'),
                'recommendations': [
                    {
                        'type': 'coding',
                        'code': 'CPT-99213',
                        'description': 'Office visit, established patient',
                        'confidence': 0.92
                    }
                ],
                'confidence': 0.92,
                'details': {
                    'mockData': True,
                    'message': 'This is mock data for development'
                }
            },
            'metadata': {
                'processingTime': 0.123,
                'agentVersion': 'dev-1.0.0'
            }
        })
    }

def error_response(status_code: int, message: str) -> Dict[str, Any]:
    """Generate error response"""
    return {
        'statusCode': status_code,
        'body': json.dumps({
            'status': 'error',
            'error': message
        })
    }
```

### Step 5: Create Prompt Templates

Create `prompt.py`:

```python
"""
Prompt templates for YourAgentName
"""

MAIN_PROMPT_TEMPLATE = """You are an expert medical coder with deep knowledge of CPT, ICD-10, and HCPCS coding systems.

Given the following patient and clinical information, provide accurate medical coding recommendations.

Patient Data:
{patient_data}

Clinical Data:
{clinical_data}

Please provide:
1. Recommended CPT codes with descriptions
2. Applicable ICD-10 diagnosis codes
3. Any relevant modifiers
4. Confidence level for each recommendation
5. Brief rationale for selections

Format your response as structured JSON.
"""

VALIDATION_PROMPT = """Review the following medical codes for accuracy and compliance:

Codes: {codes}
Clinical Context: {context}

Identify any potential issues or improvements.
"""

APPEAL_PROMPT = """Generate a professional appeal letter for the following denial:

Denial Reason: {denial_reason}
Original Codes: {original_codes}
Clinical Documentation: {documentation}

Create a compelling, evidence-based appeal.
"""
```

### Step 6: Add to CDK Infrastructure

Update `infra/lib/agents-stack.ts`:

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

export class AgentsStack extends Stack {
  constructor(scope: Construct, id: string, props: AgentsStackProps) {
    super(scope, id, props);
    
    // ... existing agents ...
    
    // Your new agent
    const yourAgentFunction = new lambda.Function(this, 'YourAgentName', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset('agents/YourAgentName'),
      timeout: Duration.minutes(5),
      memorySize: 512,
      environment: {
        DEVELOPMENT_MODE: props.developmentMode || 'false',
        AGENT_RUNS_TABLE: props.agentRunsTable.tableName,
        BEDROCK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0'
      },
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }
    });
    
    // Grant permissions
    props.agentRunsTable.grantWriteData(yourAgentFunction);
    
    // Bedrock permissions
    yourAgentFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'bedrock:ModelId': 'anthropic.claude-3-sonnet-20240229-v1:0'
        }
      }
    }));
  }
}
```

### Step 7: Create Server Action

Add to `app/lib/actions.ts`:

```typescript
'use server';

import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

export async function callYourAgent(
  claimId: string,
  patientData: any,
  clinicalData?: any
) {
  // Check user permissions
  const session = await auth();
  const userRole = await getUserRole(session.userId);
  
  if (!['admin', 'ops', 'provider'].includes(userRole)) {
    throw new Error('Unauthorized');
  }
  
  // Initialize Lambda client
  const lambda = new LambdaClient({ 
    region: process.env.AWS_REGION 
  });
  
  // Prepare payload
  const payload = {
    claimId,
    patientData,
    clinicalData: clinicalData || {}
  };
  
  // Invoke agent
  const command = new InvokeCommand({
    FunctionName: 'YourAgentName',
    Payload: JSON.stringify(payload)
  });
  
  try {
    const response = await lambda.send(command);
    const result = JSON.parse(
      new TextDecoder().decode(response.Payload)
    );
    
    // Log to audit trail
    await logAgentCall(session.userId, 'YourAgentName', result);
    
    return result;
  } catch (error) {
    console.error('Agent invocation failed:', error);
    throw new Error('Failed to process request');
  }
}
```

## Testing Agents

### Local Testing

1. **Create test payload**:

```json
// scripts/test-payloads/your-agent-test.json
{
  "claimId": "CLM-TEST-001",
  "patientData": {
    "mrn": "12345",
    "dateOfBirth": "1980-01-15",
    "insurance": {
      "payerId": "BCBS",
      "memberId": "ABC123456"
    }
  },
  "clinicalData": {
    "visitDate": "2024-01-15",
    "chiefComplaint": "Annual physical exam",
    "assessments": ["Hypertension", "Type 2 Diabetes"]
  }
}
```

2. **Run local test**:

```bash
# Enable development mode
export DEVELOPMENT_MODE=true

# Run the agent
./scripts/run-local-agent.sh YourAgentName ./scripts/test-payloads/your-agent-test.json
```

### Integration Testing

Create `agents/YourAgentName/test_handler.py`:

```python
import unittest
import json
from handler import lambda_handler, validate_input, process_claim

class TestYourAgent(unittest.TestCase):
    def setUp(self):
        self.valid_event = {
            'claimId': 'TEST-123',
            'patientData': {
                'mrn': '12345',
                'dateOfBirth': '1980-01-15',
                'insurance': {
                    'payerId': 'BCBS',
                    'memberId': 'ABC123'
                }
            }
        }
    
    def test_valid_input(self):
        """Test with valid input"""
        response = lambda_handler(self.valid_event, None)
        self.assertEqual(response['statusCode'], 200)
        
        body = json.loads(response['body'])
        self.assertEqual(body['status'], 'success')
        self.assertIn('result', body)
    
    def test_invalid_input(self):
        """Test with missing required field"""
        invalid_event = {'claimId': 'TEST-123'}
        response = lambda_handler(invalid_event, None)
        self.assertEqual(response['statusCode'], 400)
    
    def test_development_mode(self):
        """Test development mode returns mock data"""
        import os
        os.environ['DEVELOPMENT_MODE'] = 'true'
        
        response = lambda_handler(self.valid_event, None)
        body = json.loads(response['body'])
        self.assertTrue(body['result']['details']['mockData'])

if __name__ == '__main__':
    unittest.main()
```

## Agent Best Practices

### 1. Error Handling

```python
def robust_error_handling(event):
    try:
        # Main logic
        result = process_data(event)
        return success_response(result)
    
    except ValidationError as e:
        logger.warning(f"Validation failed: {e}")
        return error_response(400, "Invalid input", details=e.details)
    
    except ExternalAPIError as e:
        logger.error(f"External API failed: {e}")
        # Implement retry logic or fallback
        return handle_external_failure(e)
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        # Don't expose internal errors
        return error_response(500, "Processing failed")
```

### 2. Structured Logging

```python
def log_structured(event_type: str, details: Dict):
    """Log structured data for analysis"""
    log_entry = {
        'timestamp': datetime.utcnow().isoformat(),
        'eventType': event_type,
        'agentName': 'YourAgentName',
        'correlationId': get_correlation_id(),
        **details
    }
    logger.info(json.dumps(log_entry))
```

### 3. Performance Optimization

```python
# Cache frequently used data
from functools import lru_cache

@lru_cache(maxsize=100)
def get_payer_config(payer_id: str):
    """Cache payer configurations"""
    return fetch_payer_config(payer_id)

# Use connection pooling
class AgentContext:
    def __init__(self):
        self._db_connection = None
    
    @property
    def db(self):
        if not self._db_connection:
            self._db_connection = create_connection()
        return self._db_connection

# Global context
context = AgentContext()
```

### 4. Security Considerations

```python
def sanitize_input(data: Dict) -> Dict:
    """Remove sensitive data from logs"""
    sensitive_fields = ['ssn', 'creditCard', 'apiKey']
    sanitized = data.copy()
    
    for field in sensitive_fields:
        if field in sanitized:
            sanitized[field] = '***REDACTED***'
    
    return sanitized

def validate_permissions(event: Dict, required_role: str):
    """Ensure proper authorization"""
    user_role = event.get('userContext', {}).get('role')
    if user_role != required_role:
        raise PermissionError(f"Role {required_role} required")
```

## Monitoring and Debugging

### CloudWatch Metrics

```python
import boto3
cloudwatch = boto3.client('cloudwatch')

def publish_metrics(metric_name: str, value: float, unit: str = 'Count'):
    """Publish custom metrics"""
    cloudwatch.put_metric_data(
        Namespace='MuniRCM/Agents',
        MetricData=[{
            'MetricName': metric_name,
            'Value': value,
            'Unit': unit,
            'Dimensions': [
                {
                    'Name': 'AgentName',
                    'Value': 'YourAgentName'
                }
            ]
        }]
    )
```

### Debugging Tips

1. **Enable detailed logging**:
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   ```

2. **Use X-Ray tracing**:
   ```python
   from aws_xray_sdk.core import xray_recorder
   
   @xray_recorder.capture('process_claim')
   def process_claim(claim_id):
       # Processing logic
   ```

3. **Add correlation IDs**:
   ```python
   import uuid
   
   def add_correlation_id(event):
       event['correlationId'] = event.get('correlationId', str(uuid.uuid4()))
       return event['correlationId']
   ```

## Deployment

### Manual Deployment

```bash
# Deploy single agent
./scripts/deploy-agent.sh YourAgentName

# Deploy all infrastructure
cd infra
cdk deploy
```

### CI/CD Integration

Add to `.github/workflows/deploy.yml`:

```yaml
- name: Deploy YourAgentName
  run: |
    cd agents/YourAgentName
    zip -r function.zip .
    aws lambda update-function-code \
      --function-name YourAgentName \
      --zip-file fileb://function.zip
```

## Common Agent Patterns

### 1. Eligibility Check Agent
- Calls payer APIs for real-time verification
- Caches responses for 24 hours
- Returns structured benefits information

### 2. Coding Agent
- Uses LLM to suggest CPT/ICD codes
- Validates against payer-specific rules
- Tracks accuracy for improvement

### 3. Denial Management Agent
- Classifies denial reasons
- Suggests next actions
- Generates appeal templates

### 4. Payment Posting Agent
- Parses ERA (835) files
- Matches payments to claims
- Identifies discrepancies

## Summary

Creating agents for the Muni AI RCM platform involves:
1. Clear purpose definition
2. Schema-driven development
3. Comprehensive error handling
4. Development mode for testing
5. Structured logging for ML training
6. Secure, performant implementation
7. Proper integration with the platform

Follow these patterns to build reliable, maintainable agents that enhance the revenue cycle process.