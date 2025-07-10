#!/bin/bash

# Script to deploy individual Lambda agents
# Usage: ./scripts/deploy-agent.sh CodingAgent

set -e

AGENT_NAME=$1

if [ -z "$AGENT_NAME" ]; then
    echo "Usage: $0 <agent_name>"
    echo "Available agents: CodingAgent, ERAParserAgent, SubmitClaimAgent, EligibilityAgent"
    exit 1
fi

AGENT_DIR="agents/$AGENT_NAME"

if [ ! -d "$AGENT_DIR" ]; then
    echo "Error: Agent directory $AGENT_DIR not found"
    exit 1
fi

echo "🚀 Deploying $AGENT_NAME..."
echo "📁 Agent directory: $AGENT_DIR"
echo ""

cd "$AGENT_DIR"

# Create deployment package
echo "📦 Creating deployment package..."

# Create a clean deployment directory
rm -rf deploy
mkdir deploy

# Copy source files
cp *.py deploy/

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "📥 Installing Python dependencies..."
    pip install -r requirements.txt -t deploy/
fi

# Create zip package
cd deploy
zip -r "../${AGENT_NAME}.zip" .
cd ..

# Deploy using AWS CLI (assumes proper AWS credentials are configured)
echo "🔄 Deploying to AWS Lambda..."

# Check if function exists
if aws lambda get-function --function-name "$AGENT_NAME" 2>/dev/null; then
    echo "📝 Updating existing function..."
    aws lambda update-function-code \
        --function-name "$AGENT_NAME" \
        --zip-file "fileb://${AGENT_NAME}.zip"
else
    echo "🆕 Creating new function..."
    # Note: This would need additional parameters like role, runtime, etc.
    # In practice, use CDK for initial deployment
    echo "⚠️  Function does not exist. Use CDK to create infrastructure first:"
    echo "   cd infra && cdk deploy MuniRcmAgentsStack"
fi

# Clean up
rm -rf deploy
rm "${AGENT_NAME}.zip"

echo ""
echo "✅ $AGENT_NAME deployment completed!"

cd ../..