"use client";

import { useState } from "react";
import { submitClaim, checkEligibility, generateAppeal, estimatePatientCost } from "../lib/actions";
import "./../app/app.css";

interface Claim {
  id: string;
  patientId: string;
  status: string;
  amount: number;
  submittedAt?: string;
}

export default function RCMDashboard() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

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

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🏥 Muni Health RCM Platform</h1>
        <p>AI-native Revenue Cycle Management</p>
      </header>

      <div className="dashboard-grid">
        {/* Claims Submission */}
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

      {/* Active Claims */}
      <section className="card claims-section">
        <h2>📊 Active Claims ({claims.length})</h2>
        {claims.length === 0 ? (
          <p className="empty-state">No claims submitted yet. Submit your first claim above!</p>
        ) : (
          <div className="claims-list">
            {claims.map((claim) => (
              <div key={claim.id} className="claim-item">
                <div className="claim-header">
                  <strong>Claim ID:</strong> {claim.id}
                  <span className={`status status-${claim.status}`}>{claim.status}</span>
                </div>
                <div className="claim-details">
                  <span><strong>Patient:</strong> {claim.patientId}</span>
                  <span><strong>Amount:</strong> ${claim.amount.toFixed(2)}</span>
                  {claim.submittedAt && (
                    <span><strong>Submitted:</strong> {new Date(claim.submittedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
        <p>
          <strong>Muni Health RCM Platform</strong> - AI-native revenue cycle management
          <br />
          <small>Development Mode - Agents return mock data</small>
        </p>
      </footer>
    </div>
  );
}
