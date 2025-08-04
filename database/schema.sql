-- Muni AI RCM Platform Database Schema
-- PostgreSQL 15.x
-- This schema implements the complete data model for the RCM platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum types
CREATE TYPE user_role AS ENUM ('admin', 'ops', 'provider');
CREATE TYPE claim_status AS ENUM ('draft', 'pending_review', 'submitted', 'accepted', 'rejected', 'paid', 'denied', 'appealed');
CREATE TYPE agent_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE workflow_step AS ENUM ('data_entry', 'eligibility_check', 'coding', 'review', 'submission', 'payment_posting', 'appeal');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent');

-- Users table (for local auth, Cognito manages main auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cognito_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'provider',
    organization_id UUID,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(20),
    npi VARCHAR(10),
    address JSONB,
    contact_info JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Providers table
CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    npi VARCHAR(10) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100),
    license_number VARCHAR(50),
    license_state VARCHAR(2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    mrn VARCHAR(100),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10),
    ssn_encrypted VARCHAR(255), -- Encrypted SSN
    address JSONB,
    phone VARCHAR(20),
    email VARCHAR(255),
    emergency_contact JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, mrn)
);

-- Insurance policies table
CREATE TABLE IF NOT EXISTS insurance_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id),
    payer_id VARCHAR(100),
    payer_name VARCHAR(255),
    plan_name VARCHAR(255),
    member_id VARCHAR(100),
    group_number VARCHAR(100),
    policy_type VARCHAR(50), -- primary, secondary, tertiary
    effective_date DATE,
    termination_date DATE,
    copay_amount DECIMAL(10,2),
    deductible_amount DECIMAL(10,2),
    out_of_pocket_max DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Claims table with Claim MD integration fields
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id VARCHAR(100) UNIQUE NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    patient_id UUID REFERENCES patients(id),
    provider_id UUID REFERENCES providers(id),
    insurance_policy_id UUID REFERENCES insurance_policies(id),
    
    -- Claim details
    claim_type VARCHAR(50) NOT NULL, -- professional, institutional, dental
    service_date DATE NOT NULL,
    admission_date DATE,
    discharge_date DATE,
    place_of_service VARCHAR(5),
    
    -- Financial data
    total_charge_amount DECIMAL(10,2) NOT NULL,
    expected_payment DECIMAL(10,2),
    paid_amount DECIMAL(10,2) DEFAULT 0,
    adjustment_amount DECIMAL(10,2) DEFAULT 0,
    patient_responsibility DECIMAL(10,2),
    
    -- Status tracking
    status claim_status NOT NULL DEFAULT 'draft',
    priority priority_level DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id),
    
    -- Claim MD integration
    claimmd_batch_id VARCHAR(100),
    claimmd_claim_id VARCHAR(100),
    claimmd_status VARCHAR(50),
    claimmd_errors JSONB,
    claimmd_submission_date TIMESTAMP,
    claimmd_acceptance_date TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    last_retry_date TIMESTAMP,
    
    -- Diagnosis and procedure codes
    diagnosis_codes TEXT[], -- Array of ICD-10 codes
    procedure_codes TEXT[], -- Array of CPT/HCPCS codes
    modifiers JSONB,
    
    -- AI generated data
    ai_confidence_score DECIMAL(3,2),
    ai_suggested_codes JSONB,
    manual_review_required BOOLEAN DEFAULT false,
    review_notes TEXT,
    
    -- Workflow tracking
    workflow_state JSONB,
    current_workflow_step workflow_step,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Claim line items table
CREATE TABLE IF NOT EXISTS claim_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    service_date DATE NOT NULL,
    procedure_code VARCHAR(10) NOT NULL,
    modifiers VARCHAR(10)[],
    diagnosis_pointer INTEGER[],
    units DECIMAL(10,2) NOT NULL,
    charge_amount DECIMAL(10,2) NOT NULL,
    allowed_amount DECIMAL(10,2),
    paid_amount DECIMAL(10,2),
    denial_reason VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(claim_id, line_number)
);

-- Agent runs table for tracking all AI agent executions
CREATE TABLE IF NOT EXISTS agent_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id VARCHAR(100) UNIQUE NOT NULL,
    agent_name VARCHAR(100) NOT NULL,
    agent_version VARCHAR(20),
    
    -- Context
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    claim_id UUID REFERENCES claims(id),
    patient_id UUID REFERENCES patients(id),
    
    -- Execution data
    input_data JSONB NOT NULL,
    output_data JSONB,
    error_message TEXT,
    status agent_status NOT NULL DEFAULT 'pending',
    
    -- Performance metrics
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    execution_time_ms INTEGER,
    tokens_used INTEGER,
    cost_estimate DECIMAL(10,4),
    
    -- AI metrics
    confidence_score DECIMAL(3,2),
    needs_human_review BOOLEAN DEFAULT false,
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,
    review_timestamp TIMESTAMP,
    
    -- Feedback for training
    human_feedback JSONB,
    outcome_data JSONB, -- Actual results vs predictions
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow states table
CREATE TABLE IF NOT EXISTS workflow_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES claims(id) UNIQUE NOT NULL,
    current_step workflow_step NOT NULL,
    completed_steps workflow_step[],
    pending_steps workflow_step[],
    
    -- Step metadata
    step_data JSONB,
    assigned_to UUID REFERENCES users(id),
    
    -- Blocking and errors
    is_blocked BOOLEAN DEFAULT false,
    block_reason TEXT,
    error_count INTEGER DEFAULT 0,
    last_error JSONB,
    
    -- Time tracking
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimated_completion TIMESTAMP,
    actual_completion TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Eligibility checks table
CREATE TABLE IF NOT EXISTS eligibility_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id),
    insurance_policy_id UUID REFERENCES insurance_policies(id),
    check_date DATE NOT NULL,
    
    -- Request data
    service_type_codes VARCHAR(10)[],
    provider_id UUID REFERENCES providers(id),
    
    -- Response data
    status VARCHAR(50),
    is_eligible BOOLEAN,
    copay_amount DECIMAL(10,2),
    deductible_remaining DECIMAL(10,2),
    out_of_pocket_remaining DECIMAL(10,2),
    coverage_details JSONB,
    
    -- Claim MD integration
    claimmd_transaction_id VARCHAR(100),
    raw_response JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Remittance advice (ERA/835) table
CREATE TABLE IF NOT EXISTS remittance_advice (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    era_id VARCHAR(100) UNIQUE NOT NULL,
    payer_id VARCHAR(100),
    payer_name VARCHAR(255),
    check_number VARCHAR(50),
    check_date DATE,
    deposit_date DATE,
    total_paid_amount DECIMAL(10,2),
    
    -- Processing info
    status VARCHAR(50),
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMP,
    
    -- Claim MD data
    claimmd_era_id VARCHAR(100),
    raw_era_data JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ERA claim details
CREATE TABLE IF NOT EXISTS era_claim_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    remittance_advice_id UUID REFERENCES remittance_advice(id),
    claim_id UUID REFERENCES claims(id),
    patient_control_number VARCHAR(100),
    
    -- Payment details
    billed_amount DECIMAL(10,2),
    allowed_amount DECIMAL(10,2),
    paid_amount DECIMAL(10,2),
    patient_responsibility DECIMAL(10,2),
    
    -- Adjustments
    contractual_adjustment DECIMAL(10,2),
    other_adjustments DECIMAL(10,2),
    adjustment_reason_codes JSONB,
    
    -- Status
    claim_status VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Denials table
CREATE TABLE IF NOT EXISTS denials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES claims(id),
    denial_date DATE NOT NULL,
    denial_reason_code VARCHAR(10),
    denial_reason_description TEXT,
    
    -- Categorization
    denial_category VARCHAR(50), -- coding, auth, eligibility, etc
    is_preventable BOOLEAN,
    
    -- Appeal tracking
    appeal_deadline DATE,
    appeal_submitted BOOLEAN DEFAULT false,
    appeal_date DATE,
    appeal_outcome VARCHAR(50),
    
    -- AI analysis
    ai_suggested_action TEXT,
    ai_prevention_tips JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appeals table
CREATE TABLE IF NOT EXISTS appeals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    denial_id UUID REFERENCES denials(id),
    claim_id UUID REFERENCES claims(id),
    appeal_level INTEGER DEFAULT 1,
    
    -- Appeal content
    appeal_letter TEXT,
    supporting_documents JSONB,
    
    -- Status tracking
    status VARCHAR(50),
    submitted_date DATE,
    decision_date DATE,
    outcome VARCHAR(50),
    recovered_amount DECIMAL(10,2),
    
    -- AI generated
    ai_generated_letter BOOLEAN DEFAULT false,
    ai_confidence_score DECIMAL(3,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    
    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    
    -- PHI access tracking
    accessed_phi BOOLEAN DEFAULT false,
    phi_fields TEXT[],
    access_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_claims_organization ON claims(organization_id);
CREATE INDEX idx_claims_patient ON claims(patient_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_claimmd_batch ON claims(claimmd_batch_id);
CREATE INDEX idx_claims_service_date ON claims(service_date);
CREATE INDEX idx_claims_created_at ON claims(created_at);

CREATE INDEX idx_agent_runs_claim ON agent_runs(claim_id);
CREATE INDEX idx_agent_runs_agent_name ON agent_runs(agent_name);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE INDEX idx_agent_runs_needs_review ON agent_runs(needs_human_review);

CREATE INDEX idx_workflow_states_current_step ON workflow_states(current_step);
CREATE INDEX idx_workflow_states_assigned_to ON workflow_states(assigned_to);
CREATE INDEX idx_workflow_states_blocked ON workflow_states(is_blocked);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_phi ON audit_logs(accessed_phi);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_runs_updated_at BEFORE UPDATE ON agent_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_states_updated_at BEFORE UPDATE ON workflow_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row-level security policies (to be enabled after initial setup)
-- ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

-- Initial seed data for development
INSERT INTO organizations (id, name, tax_id, npi) VALUES 
    ('550e8400-e29b-41d4-a716-446655440001', 'Demo Medical Group', '12-3456789', '1234567890')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, cognito_id, email, role, organization_id) VALUES
    ('550e8400-e29b-41d4-a716-446655440002', 'dev-admin', 'admin@munihealth.com', 'admin', NULL),
    ('550e8400-e29b-41d4-a716-446655440003', 'dev-ops', 'ops@munihealth.com', 'ops', NULL),
    ('550e8400-e29b-41d4-a716-446655440004', 'dev-provider', 'provider@munihealth.com', 'provider', '550e8400-e29b-41d4-a716-446655440001')
ON CONFLICT DO NOTHING;