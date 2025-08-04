# Base Agent Class - Muni AI RCM Platform
# Provides common functionality for all Python Lambda agents

import json
import os
import boto3
import psycopg2
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from contextlib import contextmanager
from abc import ABC, abstractmethod
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BaseAgent(ABC):
    """
    Base class for all RCM agents providing common functionality:
    - Database connections with connection pooling
    - Nova Pro LLM integration
    - Agent run tracking
    - Error handling and logging
    - Development mode support
    """
    
    def __init__(self):
        self.development_mode = os.environ.get('DEVELOPMENT_MODE', 'false').lower() == 'true'
        self.aws_region = os.environ.get('AWS_REGION', 'us-east-1')
        self.db_secret_arn = os.environ.get('DB_SECRET_ARN')
        self.bedrock_model_id = os.environ.get('BEDROCK_MODEL_ID', 'amazon.nova-pro-v1:0')
        
        # Initialize AWS clients
        self.bedrock_client = None
        self.secrets_client = None
        self.db_credentials = None
        
        # Agent metadata
        self.agent_name = self.__class__.__name__
        self.agent_version = "1.0.0"
        
    def lambda_handler(self, event: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """
        Main Lambda handler - orchestrates agent execution
        """
        run_id = str(uuid.uuid4())
        start_time = datetime.utcnow()
        
        try:
            logger.info(f"Starting {self.agent_name} execution - Run ID: {run_id}")
            
            # Validate input
            validation_error = self.validate_input(event)
            if validation_error:
                return self._create_error_response(400, validation_error, run_id)
            
            # Store agent run start
            self._store_agent_run_start(run_id, event, start_time)
            
            # Execute agent logic
            if self.development_mode:
                logger.info(f"Running {self.agent_name} in development mode")
                result = self.execute_development_mode(event)
            else:
                logger.info(f"Running {self.agent_name} in production mode")
                result = self.execute_production_mode(event)
            
            # Store successful completion
            end_time = datetime.utcnow()
            execution_time = int((end_time - start_time).total_seconds() * 1000)
            
            self._store_agent_run_completion(run_id, result, end_time, execution_time)
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'success': True,
                    'run_id': run_id,
                    'agent': self.agent_name,
                    'execution_time_ms': execution_time,
                    'result': result
                })
            }
            
        except Exception as e:
            logger.error(f"Error in {self.agent_name}: {str(e)}", exc_info=True)
            
            # Store error
            end_time = datetime.utcnow()
            execution_time = int((end_time - start_time).total_seconds() * 1000)
            self._store_agent_run_error(run_id, str(e), end_time, execution_time)
            
            return self._create_error_response(500, f"{self.agent_name} execution failed", run_id)
    
    @abstractmethod
    def validate_input(self, event: Dict[str, Any]) -> Optional[str]:
        """Validate input data - return error message if invalid, None if valid"""
        pass
    
    @abstractmethod
    def execute_production_mode(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Execute agent logic in production mode"""
        pass
    
    @abstractmethod
    def execute_development_mode(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Execute agent logic in development mode (mock data)"""
        pass
    
    def get_bedrock_client(self):
        """Get or create Bedrock client"""
        if not self.bedrock_client:
            self.bedrock_client = boto3.client('bedrock-runtime', region_name=self.aws_region)
        return self.bedrock_client
    
    def invoke_nova_pro(self, prompt: str, max_tokens: int = 2000, temperature: float = 0.1) -> str:
        """
        Invoke Nova Pro model with the given prompt
        """
        try:
            bedrock = self.get_bedrock_client()
            
            request_body = {
                "inputText": prompt,
                "textGenerationConfig": {
                    "maxTokenCount": max_tokens,
                    "temperature": temperature,
                    "topP": 0.9,
                    "stopSequences": []
                }
            }
            
            response = bedrock.invoke_model(
                modelId=self.bedrock_model_id,
                body=json.dumps(request_body)
            )
            
            result = json.loads(response['body'].read())
            return result.get('results', [{}])[0].get('outputText', '')
            
        except Exception as e:
            logger.error(f"Nova Pro invocation failed: {str(e)}")
            raise Exception(f"LLM inference failed: {str(e)}")
    
    @contextmanager
    def get_db_connection(self):
        """
        Get database connection with automatic cleanup
        """
        conn = None
        try:
            if not self.db_credentials:
                self._load_db_credentials()
            
            conn = psycopg2.connect(
                host=os.environ.get('DB_HOST'),
                database=os.environ.get('DB_NAME', 'muni_rcm'),
                user=self.db_credentials['username'],
                password=self.db_credentials['password'],
                port=5432,
                connect_timeout=10,
                application_name=f'muni-ai-rcm-{self.agent_name}'
            )
            
            yield conn
            
        except Exception as e:
            logger.error(f"Database connection failed: {str(e)}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()
    
    def _load_db_credentials(self):
        """Load database credentials from Secrets Manager"""
        if not self.secrets_client:
            self.secrets_client = boto3.client('secretsmanager', region_name=self.aws_region)
        
        if not self.db_secret_arn:
            raise Exception("DB_SECRET_ARN environment variable not set")
        
        try:
            response = self.secrets_client.get_secret_value(SecretId=self.db_secret_arn)
            self.db_credentials = json.loads(response['SecretString'])
        except Exception as e:
            logger.error(f"Failed to load database credentials: {str(e)}")
            raise
    
    def _store_agent_run_start(self, run_id: str, input_data: Dict[str, Any], start_time: datetime):
        """Store agent run start in database"""
        if self.development_mode:
            logger.info(f"Agent run started - Run ID: {run_id}")
            return
        
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO agent_runs (
                            run_id, agent_name, agent_version, input_data, 
                            status, start_time, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (
                        run_id, self.agent_name, self.agent_version,
                        json.dumps(input_data), 'running', start_time, start_time
                    ))
                    conn.commit()
        except Exception as e:
            logger.warning(f"Failed to store agent run start: {str(e)}")
    
    def _store_agent_run_completion(self, run_id: str, output_data: Dict[str, Any], 
                                  end_time: datetime, execution_time_ms: int):
        """Store successful agent run completion"""
        if self.development_mode:
            logger.info(f"Agent run completed - Run ID: {run_id}, Time: {execution_time_ms}ms")
            return
        
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE agent_runs 
                        SET output_data = %s, status = %s, end_time = %s,
                            execution_time_ms = %s, updated_at = %s
                        WHERE run_id = %s
                    """, (
                        json.dumps(output_data), 'completed', end_time,
                        execution_time_ms, end_time, run_id
                    ))
                    conn.commit()
        except Exception as e:
            logger.warning(f"Failed to store agent run completion: {str(e)}")
    
    def _store_agent_run_error(self, run_id: str, error_message: str, 
                             end_time: datetime, execution_time_ms: int):
        """Store failed agent run"""
        if self.development_mode:
            logger.info(f"Agent run failed - Run ID: {run_id}, Error: {error_message}")
            return
        
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE agent_runs 
                        SET error_message = %s, status = %s, end_time = %s,
                            execution_time_ms = %s, updated_at = %s
                        WHERE run_id = %s
                    """, (
                        error_message, 'failed', end_time,
                        execution_time_ms, end_time, run_id
                    ))
                    conn.commit()
        except Exception as e:
            logger.warning(f"Failed to store agent run error: {str(e)}")
    
    def _create_error_response(self, status_code: int, message: str, run_id: str) -> Dict[str, Any]:
        """Create standardized error response"""
        return {
            'statusCode': status_code,
            'body': json.dumps({
                'success': False,
                'error': message,
                'run_id': run_id,
                'agent': self.agent_name,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
    
    def extract_json_from_text(self, text: str) -> Dict[str, Any]:
        """
        Extract JSON from LLM response text that may contain extra formatting
        """
        try:
            # Try direct JSON parsing first
            return json.loads(text)
        except json.JSONDecodeError:
            # Look for JSON in code blocks
            lines = text.split('\n')
            json_lines = []
            in_json = False
            
            for line in lines:
                if '```json' in line.lower() or '```' in line and in_json:
                    in_json = not in_json
                    continue
                if in_json or (line.strip().startswith('{') and line.strip().endswith('}')):
                    json_lines.append(line)
            
            if json_lines:
                try:
                    return json.loads('\n'.join(json_lines))
                except json.JSONDecodeError:
                    pass
            
            # Last resort: look for anything that looks like JSON
            start_brace = text.find('{')
            end_brace = text.rfind('}')
            
            if start_brace != -1 and end_brace != -1:
                try:
                    return json.loads(text[start_brace:end_brace + 1])
                except json.JSONDecodeError:
                    pass
            
            raise ValueError("No valid JSON found in response")