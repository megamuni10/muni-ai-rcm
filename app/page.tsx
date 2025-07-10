"use client";

import { useState } from "react";
import "./../app/app.css";

export default function App() {
  const [claims, setClaims] = useState<Array<{id: string, patientId: string, status: string, amount: number}>>([]);

  function createClaim() {
    const patientId = window.prompt("Patient ID");
    const amount = parseFloat(window.prompt("Claim amount") || "0");
    
    if (patientId && amount > 0) {
      const newClaim = {
        id: Date.now().toString(),
        patientId,
        status: "pending",
        amount
      };
      setClaims([...claims, newClaim]);
    }
  }

  return (
    <main>
      <h1>Muni Health RCM Platform</h1>
      <div style={{ padding: "20px" }}>
        <h2>Claims Management</h2>
        <button onClick={createClaim} style={{ marginBottom: "20px", padding: "10px 20px" }}>
          + New Claim
        </button>
        
        <div>
          <h3>Active Claims</h3>
          {claims.length === 0 ? (
            <p>No claims yet. Create your first claim!</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {claims.map((claim) => (
                <li key={claim.id} style={{ 
                  border: "1px solid #ccc", 
                  margin: "10px 0", 
                  padding: "10px",
                  borderRadius: "5px"
                }}>
                  <strong>Patient ID:</strong> {claim.patientId} <br />
                  <strong>Amount:</strong> ${claim.amount.toFixed(2)} <br />
                  <strong>Status:</strong> {claim.status}
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div style={{ marginTop: "40px", padding: "20px", backgroundColor: "#f0f0f0", borderRadius: "5px" }}>
          <h3>🚀 RCM Platform Features (Coming Soon)</h3>
          <ul>
            <li>AI-powered claim coding with CPT/ICD suggestions</li>
            <li>Automated eligibility verification</li>
            <li>Smart denial management and appeals</li>
            <li>Real-time ERA processing</li>
            <li>EHR integration via 1upHealth</li>
            <li>HIPAA-compliant data handling</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
