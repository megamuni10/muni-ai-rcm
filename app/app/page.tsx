"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-wrapper";
import { 
  submitClaim, 
  checkEligibility, 
  generateAppeal, 
  estimatePatientCost,
  processEHRData,
  generateAICodes,
  startWorkflow,
  updateWorkflowStep
} from "../lib/actions";
import { 
  getWorkflowTemplate, 
  calculateProgress, 
  getNextSteps, 
  getStepStatus,
  type WorkflowTemplate 
} from "@/components/workflow-templates";
import "./../app/app.css";

interface Claim {
  id: string;
  patientId: string;
  status: string;
  amount: number;
  submittedAt?: string;
}

interface UserRole {
  role: 'Admin' | 'Ops' | 'Provider';
  organization?: string;
  permissions: string[];
}

interface WorkflowState {
  id: string;
  claimId: string;
  templateId: string;
  currentStep: string;
  completedSteps: string[];
  progress: number;
  template: WorkflowTemplate | null;
}

export default function RCMDashboard() {
  const { userRole, loading: authLoading, signOut } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowState | null>(null);
  const [ehrData, setEhrData] = useState<string>('');
  const [showEHRPaste, setShowEHRPaste] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'workflow' | 'claims' | 'analytics'>('dashboard');

  // Enhanced handlers with workflow integration
  async function handleEHRPaste() {
    if (!ehrData.trim()) {
      setResults({ error: 'Please paste EHR data first' });
      return;
    }
    
    setLoading(true);
    try {
      const result = await processEHRData(ehrData);
      
      if (result.success) {
        // Start workflow
        const workflowResult = await startWorkflow(result.claimId, 'new-claim-submission');
        
        if (workflowResult.success) {
          const template = getWorkflowTemplate('new-claim-submission');
          setActiveWorkflow({
            id: workflowResult.workflowStateId,
            claimId: result.claimId,
            templateId: 'new-claim-submission',
            currentStep: 'eligibility-check',
            completedSteps: ['data-input'],
            progress: template ? calculateProgress(['data-input'], template) : 16,
            template
          });
          setActiveView('workflow');
        }
        
        setResults(result);
        setShowEHRPaste(false);
        setEhrData('');
      } else {
        setResults({ error: result.error || 'Failed to process EHR data' });
      }
    } catch (error) {
      setResults({ error: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }
  
  async function handleSubmitClaim(formData: FormData) {
    setLoading(true);
    try {
      const result = await submitClaim(formData);
      
      if (result.success) {
        const newClaim: Claim = {
          id: result.claimId || Date.now().toString(),
          patientId: formData.get('patientId') as string,
          status: result.status || 'submitted',
          amount: parseFloat(formData.get('amount') as string),
          submittedAt: new Date().toISOString()
        };
        setClaims([...claims, newClaim]);
        setResults(result);
      } else {
        setResults({ error: result.error || 'Submission failed' });
      }
    } catch (error) {
      setResults({ error: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckEligibility(formData: FormData) {
    setLoading(true);
    try {
      const result = await checkEligibility(formData);
      setResults(result);
    } catch (error) {
      setResults({ error: 'Eligibility check failed' });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateAppeal(formData: FormData) {
    setLoading(true);
    try {
      const result = await generateAppeal(formData);
      setResults(result);
    } catch (error) {
      setResults({ error: 'Appeal generation failed' });
    } finally {
      setLoading(false);
    }
  }

  async function handleEstimateCost(formData: FormData) {
    setLoading(true);
    try {
      const result = await estimatePatientCost(formData);
      setResults(result);
    } catch (error) {
      setResults({ error: 'Cost estimation failed' });
    } finally {
      setLoading(false);
    }
  }
  
  async function handleGenerateAICodes(claimId: string, clinicalData: any) {
    setLoading(true);
    try {
      const result = await generateAICodes(claimId, clinicalData);
      setResults(result);
    } catch (error) {
      setResults({ error: 'AI code generation failed' });
    } finally {
      setLoading(false);
    }
  }
  
  function startNewWorkflow(templateId: string) {
    const claimId = `CLM-${Date.now()}`;
    const template = getWorkflowTemplate(templateId);
    
    if (!template) {
      console.error('Invalid workflow template:', templateId);
      return;
    }
    
    setActiveWorkflow({
      id: `WF-${Date.now()}`,
      claimId,
      templateId,
      currentStep: template.steps[0]?.id || '',
      completedSteps: [],
      progress: 0,
      template
    });
    setActiveView('workflow');
  }
  
  function completeWorkflowStep(stepId: string) {
    if (!activeWorkflow) return;
    
    const newCompletedSteps = [...activeWorkflow.completedSteps, stepId];
    const newProgress = activeWorkflow.template ? 
      calculateProgress(newCompletedSteps, activeWorkflow.template) : 0;
    
    const nextSteps = activeWorkflow.template ? 
      getNextSteps(newCompletedSteps, activeWorkflow.template) : [];
    
    setActiveWorkflow({
      ...activeWorkflow,
      completedSteps: newCompletedSteps,
      currentStep: nextSteps[0]?.id || 'completed',
      progress: newProgress
    });
    
    // If workflow is complete, show completion message
    if (nextSteps.length === 0) {
      setResults({
        success: true,
        message: `🎉 Workflow "${activeWorkflow.template?.name}" completed successfully!`,
        claimId: activeWorkflow.claimId,
        completedSteps: newCompletedSteps.length,
        totalSteps: activeWorkflow.template?.steps.length || 0
      });
    }
  }
  
  if (authLoading || !userRole) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }
  
  const getRoleBasedDashboard = () => {
    switch (userRole.role) {
      case 'Admin':
        return <AdminDashboard />;
      case 'Ops':
        return <OpsDashboard />;
      case 'Provider':
        return <ProviderDashboard />;
      default:
        return <div>Access denied</div>;
    }
  };
  
  const AdminDashboard = () => (
    <div className="admin-dashboard">
      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Total Claims</h3>
          <p className="stat-number">2,847</p>
          <p className="stat-change">+12% from last month</p>
        </div>
        <div className="stat-card">
          <h3>Revenue</h3>
          <p className="stat-number">$847,392</p>
          <p className="stat-change">+8% from last month</p>
        </div>
        <div className="stat-card">
          <h3>Denial Rate</h3>
          <p className="stat-number">12.3%</p>
          <p className="stat-change">-2.1% from last month</p>
        </div>
        <div className="stat-card">
          <h3>AI Accuracy</h3>
          <p className="stat-number">94.7%</p>
          <p className="stat-change">+1.2% from last month</p>
        </div>
      </div>
      
      <div className="admin-controls">
        <div className="card">
          <h2>🔧 System Management</h2>
          <div className="button-group">
            <button className="btn btn-primary">Manage Users</button>
            <button className="btn btn-secondary">View Analytics</button>
            <button className="btn btn-secondary">System Settings</button>
          </div>
        </div>
        
        <div className="card">
          <h2>📊 Real-time Monitoring</h2>
          <div className="monitoring-grid">
            <div className="monitor-item">
              <span className="status-indicator active"></span>
              <span>Lambda Agents: Online</span>
            </div>
            <div className="monitor-item">
              <span className="status-indicator active"></span>
              <span>Database: Healthy</span>
            </div>
            <div className="monitor-item">
              <span className="status-indicator warning"></span>
              <span>API Rate Limit: 78%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  
  const OpsDashboard = () => (
    <div className="ops-dashboard">
      <div className="workflow-queue">
        <h2>📋 Work Queue</h2>
        <div className="queue-stats">
          <div className="queue-item">
            <span className="priority high">High Priority</span>
            <span className="count">7</span>
          </div>
          <div className="queue-item">
            <span className="priority medium">Medium Priority</span>
            <span className="count">23</span>
          </div>
          <div className="queue-item">
            <span className="priority low">Low Priority</span>
            <span className="count">45</span>
          </div>
        </div>
        
        <div className="queue-actions">
          <button className="btn btn-primary" onClick={() => startNewWorkflow('denial-management')}>Process Denial</button>
          <button className="btn btn-secondary" onClick={() => startNewWorkflow('new-claim-submission')}>Review Claim</button>
          <button className="btn btn-ghost" onClick={() => startNewWorkflow('era-processing')}>Process ERA</button>
        </div>
      </div>
      
      <div className="card">
        <h2>🔍 AI Review Center</h2>
        <div className="review-items">
          <div className="review-item">
            <div className="review-header">
              <span className="claim-id">CLM-789456</span>
              <span className="confidence low">AI Confidence: 67%</span>
            </div>
            <p>Procedure codes need manual review</p>
            <button className="btn btn-sm btn-primary">Review</button>
          </div>
          <div className="review-item">
            <div className="review-header">
              <span className="claim-id">CLM-123789</span>
              <span className="confidence medium">AI Confidence: 82%</span>
            </div>
            <p>Diagnosis coding requires verification</p>
            <button className="btn btn-sm btn-primary">Review</button>
          </div>
        </div>
      </div>
    </div>
  );
  
  const ProviderDashboard = () => (
    <div className="provider-dashboard">
      <div className="quick-actions">
        <div className="action-card" onClick={() => setShowEHRPaste(true)}>
          <div className="action-icon">📄</div>
          <h3>Paste EHR Data</h3>
          <p>Paste clinical notes or visit summary to start claim</p>
        </div>
        
        <div className="action-card" onClick={() => startNewWorkflow('new-claim-submission')}>  
          <div className="action-icon">✏️</div>
          <h3>Manual Entry</h3>
          <p>Enter patient information manually</p>
        </div>
        
        <div className="action-card" onClick={() => setActiveView('claims')}>
          <div className="action-icon">📊</div>
          <h3>View Claims</h3>
          <p>Track status and manage existing claims</p>
        </div>
      </div>
      
      <div className="provider-stats">
        <div className="stat-card">
          <h3>This Month</h3>
          <p className="stat-number">47</p>
          <p className="stat-label">Claims Submitted</p>
        </div>
        <div className="stat-card">
          <h3>Revenue</h3>
          <p className="stat-number">$23,847</p>
          <p className="stat-label">Expected</p>
        </div>
        <div className="stat-card">
          <h3>Avg Time</h3>
          <p className="stat-number">3.2 min</p>
          <p className="stat-label">Per Claim</p>
        </div>
      </div>
      
      <div className="card">
        <h2>💡 AI Insights</h2>
        <div className="insights">
          <div className="insight-item">
            <span className="insight-icon">💰</span>
            <span>Revenue optimization: Consider bundling procedures for increased reimbursement</span>
          </div>
          <div className="insight-item">
            <span className="insight-icon">⚡</span>
            <span>Efficiency tip: Your most common procedure codes are being auto-suggested</span>
          </div>
          <div className="insight-item">
            <span className="insight-icon">📈</span>
            <span>Trend alert: Telehealth claims are processing 2x faster this month</span>
          </div>
        </div>
      </div>
    </div>
  );
  
  const WorkflowView = () => {
    if (!activeWorkflow) return null;
    
    return (
      <div className="workflow-view">
        <div className="workflow-header">
          <div className="workflow-title">
            <h2>🚀 Guided Workflow</h2>
            <span className="workflow-type">New Claim Submission</span>
          </div>
          <div className="workflow-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${activeWorkflow.progress}%` }}></div>
            </div>
            <span className="progress-text">{activeWorkflow.progress}% Complete</span>
          </div>
        </div>
        
        <div className="workflow-steps">
          <div className="step-indicator">
            <div className="step completed">📄 Data Input</div>
            <div className="step active">🔍 Eligibility</div>
            <div className="step">🤖 AI Coding</div>
            <div className="step">👁️ Review</div>
            <div className="step">💰 Estimate</div>
            <div className="step">🚀 Submit</div>
          </div>
          
          <div className="current-step">
            <h3>Current Step: Eligibility Verification</h3>
            <p>Let's verify the patient's insurance eligibility and benefits.</p>
            
            <div className="step-actions">
              <button className="btn btn-primary" onClick={() => {
                handleCheckEligibility(new FormData());
                completeWorkflowStep('eligibility-check');
              }}>
                ⚡ Auto-Check Eligibility
              </button>
              <button className="btn btn-secondary">Skip This Step</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>🏥 Muni Health RCM Platform</h1>
            <p>AI-native Revenue Cycle Management</p>
          </div>
          <div className="header-right">
            <div className="user-info">
              <span className="user-role">{userRole.role}</span>
              <span className="user-org">{userRole.organization}</span>
              {process.env.NODE_ENV === 'production' && (
                <button className="btn btn-ghost btn-sm" onClick={signOut}>
                  Sign Out
                </button>
              )}
            </div>
            <nav className="nav-tabs">
              <button 
                className={`nav-tab ${activeView === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveView('dashboard')}
              >
                Dashboard
              </button>
              {activeWorkflow && (
                <button 
                  className={`nav-tab ${activeView === 'workflow' ? 'active' : ''}`}
                  onClick={() => setActiveView('workflow')}
                >
                  Workflow
                </button>
              )}
              <button 
                className={`nav-tab ${activeView === 'claims' ? 'active' : ''}`}
                onClick={() => setActiveView('claims')}
              >
                Claims
              </button>
              {userRole.role === 'Admin' && (
                <button 
                  className={`nav-tab ${activeView === 'analytics' ? 'active' : ''}`}
                  onClick={() => setActiveView('analytics')}
                >
                  Analytics
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Dynamic Content Based on Active View */}
      {activeView === 'dashboard' && getRoleBasedDashboard()}
      {activeView === 'workflow' && <WorkflowView />}
      {activeView === 'claims' && (
        <div className="claims-view">
          <h2>📊 Claims Management</h2>
          <div className="claims-filters">
            <select className="filter-select">
              <option>All Claims</option>
              <option>Submitted</option>
              <option>Pending</option>
              <option>Paid</option>
              <option>Denied</option>
            </select>
            <input type="text" placeholder="Search claims..." className="search-input" />
          </div>
          
          <div className="claims-table">
            <div className="table-header">
              <span>Claim ID</span>
              <span>Patient</span>
              <span>Status</span>
              <span>Amount</span>
              <span>Date</span>
              <span>Actions</span>
            </div>
            {claims.map(claim => (
              <div key={claim.id} className="table-row">
                <span>{claim.id}</span>
                <span>{claim.patientId}</span>
                <span className={`status ${claim.status}`}>{claim.status}</span>
                <span>${claim.amount.toFixed(2)}</span>
                <span>{claim.submittedAt ? new Date(claim.submittedAt).toLocaleDateString() : '-'}</span>
                <span>
                  <button className="btn btn-sm btn-secondary">View</button>
                  <button className="btn btn-sm btn-primary">Edit</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* EHR Data Paste Modal */}
      {showEHRPaste && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>📄 Paste EHR Data</h2>
              <button className="modal-close" onClick={() => setShowEHRPaste(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Paste your clinical notes, visit summary, or any EHR data below. Our AI will extract the relevant information to start your claim.</p>
              <textarea
                value={ehrData}
                onChange={(e) => setEhrData(e.target.value)}
                placeholder="Paste your EHR data here...

Example:
Patient: John Doe, DOB: 03/15/1985
Visit Date: 01/15/2024
Chief Complaint: Annual physical examination
Assessment: Healthy adult male, no acute concerns
Plan: Continue current medications, return in 1 year
CPT: 99213 - Office visit
ICD-10: Z00.00 - Routine health exam"
                className="ehr-textarea"
                rows={12}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEHRPaste(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleEHRPaste}
                disabled={!ehrData.trim() || loading}
              >
                {loading ? '⏳ Processing...' : '🚀 Process EHR Data'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Legacy Forms - Keep for backward compatibility */}
      <div className="dashboard-grid legacy-forms" style={{ display: activeView === 'dashboard' && userRole.role === 'Admin' ? 'grid' : 'none' }}>
        <section className="card">
          <h2>📄 Submit New Claim</h2>
          <form action={handleSubmitClaim} className="form">
            <div className="form-group">
              <label htmlFor="claimId">Claim ID:</label>
              <input 
                type="text" 
                name="claimId" 
                placeholder="CLM-12345"
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="patientId">Patient ID:</label>
              <input 
                type="text" 
                name="patientId" 
                placeholder="PAT-67890"
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="amount">Claim Amount:</label>
              <input 
                type="number" 
                name="amount" 
                step="0.01"
                min="0"
                placeholder="250.00"
                required 
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? '⏳ Submitting...' : '🚀 Submit Claim'}
            </button>
          </form>
        </section>

        {/* Eligibility Check */}
        <section className="card">
          <h2>🔍 Check Eligibility</h2>
          <form action={handleCheckEligibility} className="form">
            <div className="form-group">
              <label htmlFor="patientId">Patient ID:</label>
              <input 
                type="text" 
                name="patientId" 
                placeholder="PAT-67890"
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="insuranceId">Insurance ID:</label>
              <input 
                type="text" 
                name="insuranceId" 
                placeholder="INS-12345"
                required 
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-secondary">
              {loading ? '⏳ Checking...' : '🔍 Check Eligibility'}
            </button>
          </form>
        </section>

        {/* Appeal Generation */}
        <section className="card">
          <h2>📝 Generate Appeal</h2>
          <form action={handleGenerateAppeal} className="form">
            <div className="form-group">
              <label htmlFor="claimId">Claim ID:</label>
              <input 
                type="text" 
                name="claimId" 
                placeholder="CLM-12345"
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="denialReason">Denial Reason:</label>
              <input 
                type="text" 
                name="denialReason" 
                placeholder="Insufficient documentation"
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="additionalInfo">Additional Info:</label>
              <textarea 
                name="additionalInfo" 
                placeholder="Additional context for the appeal..."
                rows={3}
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-secondary">
              {loading ? '⏳ Generating...' : '📝 Generate Appeal'}
            </button>
          </form>
        </section>

        {/* Cost Estimation */}
        <section className="card">
          <h2>💰 Estimate Patient Cost</h2>
          <form action={handleEstimateCost} className="form">
            <div className="form-group">
              <label htmlFor="patientId">Patient ID:</label>
              <input 
                type="text" 
                name="patientId" 
                placeholder="PAT-67890"
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="procedureCode">Procedure Code:</label>
              <input 
                type="text" 
                name="procedureCode" 
                placeholder="99213"
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="facilityType">Facility Type:</label>
              <select name="facilityType" required>
                <option value="">Select facility type</option>
                <option value="office">Office</option>
                <option value="hospital">Hospital</option>
                <option value="emergency">Emergency</option>
                <option value="urgent_care">Urgent Care</option>
              </select>
            </div>
            <button type="submit" disabled={loading} className="btn btn-secondary">
              {loading ? '⏳ Calculating...' : '💰 Estimate Cost'}
            </button>
          </form>
        </section>
      </div>

      {/* Results Display */}
      {results && (
        <section className="card results-section">
          <h2>📋 Agent Response</h2>
          <div className="results-content">
            {results.error ? (
              <div className="error">
                <strong>❌ Error:</strong> {results.error}
              </div>
            ) : (
              <div className="success">
                <pre>{JSON.stringify(results, null, 2)}</pre>
              </div>
            )}
          </div>
          <button 
            onClick={() => setResults(null)} 
            className="btn btn-ghost"
          >
            Clear Results
          </button>
        </section>
      )}

      {/* Feature Overview */}
      <section className="card features-section">
        <h2>🚀 Platform Features</h2>
        <div className="features-grid">
          <div className="feature">
            <h3>🤖 AI-Powered Coding</h3>
            <p>Automatic CPT/ICD code suggestions using AWS Bedrock Nova Pro</p>
          </div>
          <div className="feature">
            <h3>⚡ Real-time Eligibility</h3>
            <p>Instant 270/271 eligibility verification with detailed benefits</p>
          </div>
          <div className="feature">
            <h3>📄 Smart Claims Processing</h3>
            <p>Automated 837 generation and submission to clearinghouses</p>
          </div>
          <div className="feature">
            <h3>🔄 ERA Automation</h3>
            <p>Intelligent 835 processing with denial classification</p>
          </div>
          <div className="feature">
            <h3>🏥 EHR Integration</h3>
            <p>Seamless integration with EHR systems via 1upHealth FHIR</p>
          </div>
          <div className="feature">
            <h3>🔒 HIPAA Compliant</h3>
            <p>End-to-end encryption and audit trails for PHI protection</p>
          </div>
        </div>
      </section>

      <footer className="dashboard-footer">
        <div className="footer-content">
          <div className="footer-left">
            <p>
              <strong>Muni Health RCM Platform</strong> - AI-native revenue cycle management
              <br />
              <small>Development Mode - Agents return mock data</small>
            </p>
          </div>
          <div className="footer-right">
            <div className="system-status">
              <span className="status-indicator active"></span>
              <span>All Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
