#!/bin/bash

# Script to run Lambda agents locally for testing
# Usage: ./scripts/run-local-agent.sh CodingAgent test-payload.json

set -e

AGENT_NAME=$1
PAYLOAD_FILE=$2

if [ -z "$AGENT_NAME" ] || [ -z "$PAYLOAD_FILE" ]; then
    echo "Usage: $0 <agent_name> <payload_file>"
    echo "Example: $0 CodingAgent test-payloads/coding-agent-test.json"
    exit 1
fi

AGENT_DIR="agents/$AGENT_NAME"

if [ ! -d "$AGENT_DIR" ]; then
    echo "Error: Agent directory $AGENT_DIR not found"
    exit 1
fi

if [ ! -f "$PAYLOAD_FILE" ]; then
    echo "Error: Payload file $PAYLOAD_FILE not found"
    exit 1
fi

echo "🚀 Running $AGENT_NAME locally..."
echo "📁 Agent directory: $AGENT_DIR"
echo "📄 Payload file: $PAYLOAD_FILE"
echo ""

# Set up Python environment
cd "$AGENT_DIR"

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "📥 Installing Python dependencies..."
    pip install -r requirements.txt
fi

# Set environment variables for local testing
export AWS_REGION="us-east-1"
export DB_HOST="localhost"
export DB_NAME="muni_rcm_test"
export S3_BUCKET="muni-rcm-test-bucket"

# Create a simple test runner
cat > local_test.py << EOF
import json
import sys
import os
from handler import lambda_handler

def main():
    # Load test payload
    with open('../../$PAYLOAD_FILE', 'r') as f:
        event = json.load(f)
    
    # Mock context
    class MockContext:
        def __init__(self):
            self.function_name = '$AGENT_NAME'
            self.function_version = '1'
            self.invoked_function_arn = 'arn:aws:lambda:us-east-1:123456789012:function:$AGENT_NAME'
            self.memory_limit_in_mb = 512
            self.remaining_time_in_millis = lambda: 300000
    
    context = MockContext()
    
    # Set development mode
    event['development_mode'] = True
    
    print("🎯 Invoking lambda_handler...")
    print("📊 Input event:")
    print(json.dumps(event, indent=2))
    print("")
    
    try:
        result = lambda_handler(event, context)
        print("✅ Agent execution completed successfully!")
        print("📤 Output:")
        print(json.dumps(result, indent=2))
        return 0
    except Exception as e:
        print(f"❌ Agent execution failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
EOF

# Run the test
echo "🔄 Executing agent..."
python local_test.py

# Clean up
rm local_test.py
deactivate

echo ""
echo "✨ Local agent test completed!"

cd ../..