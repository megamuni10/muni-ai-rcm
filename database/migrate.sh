#!/bin/bash

# Database Migration Script for Muni AI RCM Platform
# This script applies the database schema to the RDS PostgreSQL instance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_NAME=${DB_NAME:-muni_rcm}
DB_USER=${DB_USER:-postgres}
AWS_REGION=${AWS_REGION:-us-east-1}

echo -e "${GREEN}🚀 Starting Muni RCM Database Migration${NC}"

# Check required environment variables
if [ -z "$RDS_ENDPOINT" ]; then
    echo -e "${RED}❌ RDS_ENDPOINT environment variable is required${NC}"
    exit 1
fi

if [ -z "$DB_SECRET_ARN" ]; then
    echo -e "${RED}❌ DB_SECRET_ARN environment variable is required${NC}"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is required but not installed${NC}"
    exit 1
fi

# Get database password from Secrets Manager
echo -e "${YELLOW}🔐 Retrieving database credentials from Secrets Manager...${NC}"
DB_CREDENTIALS=$(aws secretsmanager get-secret-value \
    --secret-id "$DB_SECRET_ARN" \
    --region "$AWS_REGION" \
    --query SecretString \
    --output text)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to retrieve database credentials${NC}"
    exit 1
fi

# Parse credentials JSON
DB_PASSWORD=$(echo "$DB_CREDENTIALS" | jq -r '.password')
DB_USERNAME=$(echo "$DB_CREDENTIALS" | jq -r '.username')

if [ "$DB_PASSWORD" = "null" ] || [ "$DB_USERNAME" = "null" ]; then
    echo -e "${RED}❌ Failed to parse database credentials${NC}"
    exit 1
fi

# Set environment variable for psql
export PGPASSWORD="$DB_PASSWORD"

echo -e "${YELLOW}🔍 Testing database connection...${NC}"

# Test connection
if ! psql -h "$RDS_ENDPOINT" -U "$DB_USERNAME" -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${RED}❌ Failed to connect to database${NC}"
    echo "Connection details:"
    echo "  Host: $RDS_ENDPOINT"
    echo "  User: $DB_USERNAME"
    echo "  Database: $DB_NAME"
    exit 1
fi

echo -e "${GREEN}✅ Database connection successful${NC}"

# Check if schema file exists
SCHEMA_FILE="$(dirname "$0")/schema.sql"
if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}❌ Schema file not found: $SCHEMA_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Applying database schema...${NC}"

# Apply schema
if psql -h "$RDS_ENDPOINT" -U "$DB_USERNAME" -d "$DB_NAME" -f "$SCHEMA_FILE"; then
    echo -e "${GREEN}✅ Schema applied successfully${NC}"
else
    echo -e "${RED}❌ Failed to apply schema${NC}"
    exit 1
fi

# Verify key tables exist
echo -e "${YELLOW}🔍 Verifying table creation...${NC}"

EXPECTED_TABLES=("users" "organizations" "providers" "patients" "claims" "agent_runs" "workflow_states")

for table in "${EXPECTED_TABLES[@]}"; do
    if psql -h "$RDS_ENDPOINT" -U "$DB_USERNAME" -d "$DB_NAME" -c "SELECT 1 FROM $table LIMIT 0;" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ Table '$table' exists${NC}"
    else
        echo -e "${RED}  ❌ Table '$table' missing${NC}"
        exit 1
    fi
done

# Check for seed data
echo -e "${YELLOW}🌱 Verifying seed data...${NC}"

ORG_COUNT=$(psql -h "$RDS_ENDPOINT" -U "$DB_USERNAME" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM organizations;")
USER_COUNT=$(psql -h "$RDS_ENDPOINT" -U "$DB_USERNAME" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;")

echo -e "${GREEN}  Organizations: $ORG_COUNT${NC}"
echo -e "${GREEN}  Users: $USER_COUNT${NC}"

# Create database indexes for performance (if not exists)
echo -e "${YELLOW}📊 Creating additional indexes...${NC}"

psql -h "$RDS_ENDPOINT" -U "$DB_USERNAME" -d "$DB_NAME" << 'EOF'
-- Additional performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_claims_updated_at ON claims(updated_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_states_updated_at ON workflow_states(updated_at);

-- Partial indexes for active records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_claims_active ON claims(id) WHERE status NOT IN ('paid', 'denied');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_runs_pending ON agent_runs(id) WHERE status IN ('pending', 'running');

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_claims_org_status ON claims(organization_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_runs_claim_agent ON agent_runs(claim_id, agent_name);
EOF

echo -e "${GREEN}✅ Additional indexes created${NC}"

# Clean up
unset PGPASSWORD

echo -e "${GREEN}🎉 Database migration completed successfully!${NC}"
echo ""
echo "Database Info:"
echo "  Endpoint: $RDS_ENDPOINT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USERNAME"
echo ""
echo "Next steps:"
echo "  1. Deploy Lambda agents"
echo "  2. Test agent database connections"
echo "  3. Start Next.js application"