import React, { useState } from "react";
import {
  computeCredentialHash,
  createVerifiableCredential,
  type CredentialType,
  type OnChainCredentialRecord,
} from "skills-passport-sdk";
import {
  DEMO_ISSUERS,
  DEMO_LEARNERS,
  loadStoredCredentials,
  loadStoredIssuers,
  saveStoredCredentials,
  saveStoredIssuers,
  type IssuerProfile,
  type StoredCredentialItem,
} from "./passportState";

export function IssuerConsole() {
  const [issuers, setIssuers] = useState<IssuerProfile[]>(() =>
    loadStoredIssuers()
  );
  const [selectedIssuerIdx, setSelectedIssuerIdx] = useState(0);
  const [credentials, setCredentials] = useState<StoredCredentialItem[]>(() =>
    loadStoredCredentials()
  );

  // Issue Credential Form State
  const [templateType, setTemplateType] =
    useState<CredentialType>("DegreeCredential");
  const [recipientAddress, setRecipientAddress] = useState(
    DEMO_LEARNERS[0].address
  );
  const [recipientName, setRecipientName] = useState(DEMO_LEARNERS[0].name);
  const [title, setTitle] = useState("Master of Science in Distributed Ledger Engineering");
  const [skillsInput, setSkillsInput] = useState(
    "Soroban, Rust, Distributed Systems, Formal Verification, SAC"
  );
  const [grade, setGrade] = useState("First Class Honours");
  const [description, setDescription] = useState(
    "Demonstrated mastery of distributed state consensus and secure Soroban smart contract engineering."
  );
  const [expirationDate, setExpirationDate] = useState("");
  const [issueSuccess, setIssueSuccess] = useState<string | null>(null);

  // Revocation State
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const activeIssuer = issuers[selectedIssuerIdx];

  // Real-time commitment calculation preview
  const previewSkills = skillsInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const previewHash = React.useMemo(() => {
    try {
      const dummyVc = createVerifiableCredential({
        credentialType: templateType,
        issuer: {
          address: activeIssuer.address,
          name: activeIssuer.name,
        },
        recipient: {
          address: recipientAddress,
          name: recipientName,
        },
        title,
        institution: activeIssuer.name,
        skills: previewSkills,
        grade,
        achievementDescription: description,
        expirationDate: expirationDate || undefined,
      });
      return dummyVc.proof.credentialHash;
    } catch {
      return "";
    }
  }, [
    templateType,
    activeIssuer,
    recipientAddress,
    recipientName,
    title,
    previewSkills,
    grade,
    description,
    expirationDate,
  ]);

  function handleIssueCredential(e: React.FormEvent) {
    e.preventDefault();

    if (!activeIssuer.isAuthorized) {
      alert("Error: This institution is not authorized on the Soroban registry. Deauthorized or unverified issuers cannot issue credentials.");
      return;
    }

    const vc = createVerifiableCredential({
      credentialType: templateType,
      issuer: {
        address: activeIssuer.address,
        name: activeIssuer.name,
        url: activeIssuer.metadataUri,
      },
      recipient: {
        address: recipientAddress,
        name: recipientName,
      },
      title,
      institution: activeIssuer.name,
      skills: previewSkills,
      grade: grade || undefined,
      achievementDescription: description,
      expirationDate: expirationDate || undefined,
      contractId: "CDSPASSPORTREGISTRY2026STELLARGLOBALTESTNETKEY",
    });

    const onChainRecord: OnChainCredentialRecord = {
      credentialId: vc.id.replace("urn:uuid:", "").replace(/-/g, "").padEnd(64, "0").slice(0, 64),
      issuer: activeIssuer.address,
      recipient: recipientAddress,
      credentialHash: vc.proof.credentialHash,
      templateId: templateType.replace("Credential", ""),
      issuedAt: Math.floor(Date.parse(vc.issuanceDate) / 1000),
      expiresAt: expirationDate ? Math.floor(Date.parse(expirationDate) / 1000) : undefined,
      status: "Active",
      issuerAuthorized: true,
    };

    const updated = [
      { vc, onChain: onChainRecord },
      ...credentials,
    ];

    setCredentials(updated);
    saveStoredCredentials(updated);

    setIssueSuccess(`Successfully issued and committed credential "${title}" (Hash: ${vc.proof.credentialHash.slice(0, 16)}...)`);
    setTimeout(() => setIssueSuccess(null), 6000);
  }

  function handleConfirmRevoke() {
    if (!revokeTargetId || !revokeReason.trim()) return;

    const updated = credentials.map((item) => {
      if (item.onChain.credentialId === revokeTargetId) {
        return {
          ...item,
          onChain: {
            ...item.onChain,
            status: "Revoked" as const,
            revocationReason: revokeReason.trim(),
          },
        };
      }
      return item;
    });

    setCredentials(updated);
    saveStoredCredentials(updated);
    setRevokeTargetId(null);
    setRevokeReason("");
  }

  function handleToggleSuspend(credentialId: string) {
    const updated = credentials.map((item) => {
      if (item.onChain.credentialId === credentialId) {
        const nextStatus: "Active" | "Suspended" =
          item.onChain.status === "Suspended" ? "Active" : "Suspended";
        return {
          ...item,
          onChain: {
            ...item.onChain,
            status: nextStatus,
            revocationReason:
              nextStatus === "Suspended"
                ? "Temporarily suspended pending accreditation review"
                : undefined,
          },
        };
      }
      return item;
    });

    setCredentials(updated);
    saveStoredCredentials(updated);
  }

  function handleToggleIssuerAuthorization() {
    const updated = issuers.map((iss, idx) => {
      if (idx === selectedIssuerIdx) {
        return { ...iss, isAuthorized: !iss.isAuthorized };
      }
      return iss;
    });
    setIssuers(updated);
    saveStoredIssuers(updated);
  }

  return (
    <div className="issuer-console">
      {/* Issuer Authority Card */}
      <div className="issuer-authority-card">
        <div className="issuer-header">
          <div className="institution-badge">🏛️</div>
          <div className="institution-info">
            <div className="inst-title-row">
              <h3>{activeIssuer.name}</h3>
              <span
                className={`auth-status-pill ${
                  activeIssuer.isAuthorized ? "authorized" : "unauthorized"
                }`}
              >
                {activeIssuer.isAuthorized
                  ? "✓ Authorized On-Chain Issuer"
                  : "⚠ Deauthorized / Untrusted"}
              </span>
            </div>
            <p className="inst-addr">
              Stellar Address: <code>{activeIssuer.address}</code>
            </p>
            <p className="inst-meta">
              Accreditation URI:{" "}
              <a href={activeIssuer.metadataUri} target="_blank" rel="noreferrer">
                {activeIssuer.metadataUri}
              </a>
            </p>
          </div>
          <div className="issuer-selector-group">
            <label htmlFor="select-issuer">Select Issuer Identity:</label>
            <select
              id="select-issuer"
              value={selectedIssuerIdx}
              onChange={(e) => setSelectedIssuerIdx(Number(e.target.value))}
            >
              {issuers.map((iss, idx) => (
                <option key={iss.address} value={idx}>
                  {iss.name} {iss.isAuthorized ? "(Authorized)" : "(Revoked Auth)"}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary-action compact auth-toggle-btn"
              onClick={handleToggleIssuerAuthorization}
            >
              {activeIssuer.isAuthorized ? "Simulate Deauthorization" : "Authorize on Soroban"}
            </button>
          </div>
        </div>
      </div>

      {issueSuccess && (
        <div className="success-banner" role="alert">
          <span>✓ {issueSuccess}</span>
        </div>
      )}

      {/* Main Grid: Issue Form + Managed Credentials */}
      <div className="issuer-main-grid">
        {/* Issue Form */}
        <div className="issue-form-card">
          <div className="form-card-header">
            <h4>Issue New Education Credential</h4>
            <span className="soroban-tag">Soroban SHA-256 Commitment</span>
          </div>

          <form onSubmit={handleIssueCredential} className="credential-form">
            <div className="form-row">
              <label htmlFor="template-select">Credential Template</label>
              <select
                id="template-select"
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value as CredentialType)}
              >
                <option value="DegreeCredential">University Degree (B.Sc., M.Sc., Ph.D.)</option>
                <option value="CertificateCredential">Professional Certification</option>
                <option value="SkillBadgeCredential">Verified Competency Badge</option>
                <option value="CourseCompletionCredential">Course Completion</option>
                <option value="ProfessionalLicenseCredential">Professional License</option>
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="recipient-select">Recipient Learner (Stellar Address)</label>
              <div className="recipient-selector-combo">
                <input
                  id="recipient-select"
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="G..."
                  required
                />
                <select
                  aria-label="Select demo learner address"
                  onChange={(e) => {
                    const l = DEMO_LEARNERS[Number(e.target.value)];
                    if (l) {
                      setRecipientAddress(l.address);
                      setRecipientName(l.name);
                    }
                  }}
                >
                  {DEMO_LEARNERS.map((l, idx) => (
                    <option key={l.address} value={idx}>
                      Fill: {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="recipient-name">Recipient Name</label>
              <input
                id="recipient-name"
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>

            <div className="form-row">
              <label htmlFor="cred-title">Qualification Title</label>
              <input
                id="cred-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master of Science in Distributed Systems"
                required
              />
            </div>

            <div className="form-row">
              <label htmlFor="cred-skills">Skills & Competencies (comma-separated)</label>
              <input
                id="cred-skills"
                type="text"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                placeholder="Rust, Soroban, Cryptography, Distributed Systems"
                required
              />
            </div>

            <div className="form-row-half">
              <div>
                <label htmlFor="cred-grade">Grade / Honors</label>
                <input
                  id="cred-grade"
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="Summa Cum Laude, Grade A, etc."
                />
              </div>
              <div>
                <label htmlFor="cred-expiry">Expiration Date (Optional)</label>
                <input
                  id="cred-expiry"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="cred-desc">Achievement Description</label>
              <textarea
                id="cred-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description of program requirements met..."
                required
              />
            </div>

            {/* Cryptographic Hash Preview */}
            <div className="commitment-preview-box">
              <span className="preview-label">Deterministic SHA-256 Commitment (On-Chain):</span>
              <code className="preview-hash">{previewHash || "Calculating..."}</code>
              <p className="privacy-note">
                🔒 <strong>Privacy Guarantee:</strong> PII and sensitive transcript fields remain strictly off-chain. Only this 32-byte cryptographic digest is anchored on the Stellar Soroban ledger.
              </p>
            </div>

            <button type="submit" className="primary-action submit-issue-btn">
              Issue Credential & Commit On-Chain
            </button>
          </form>
        </div>

        {/* Issued Credentials Management Table */}
        <div className="issued-credentials-card">
          <div className="issued-card-header">
            <h4>Issued Credentials Lifecycle Registry</h4>
            <span className="count-pill">{credentials.length} Anchored Records</span>
          </div>

          <div className="credentials-table-wrapper">
            <table className="credentials-table">
              <thead>
                <tr>
                  <th>Qualification</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Hash Commitment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map(({ vc, onChain }) => {
                  const isRevoked = onChain.status === "Revoked";
                  const isSuspended = onChain.status === "Suspended";
                  const isExpired =
                    onChain.expiresAt !== undefined &&
                    Math.floor(Date.now() / 1000) >= onChain.expiresAt;

                  return (
                    <tr key={vc.id} className={isRevoked ? "row-revoked" : ""}>
                      <td>
                        <strong>{vc.credentialSubject.title}</strong>
                        <div className="table-subtext">{vc.type[1]}</div>
                      </td>
                      <td>
                        <div className="recipient-name">
                          {vc.credentialSubject.recipientName || "Learner"}
                        </div>
                        <code className="table-subtext">
                          {onChain.recipient.slice(0, 6)}...{onChain.recipient.slice(-4)}
                        </code>
                      </td>
                      <td>
                        <span
                          className={`table-status-pill ${
                            isRevoked
                              ? "status-revoked"
                              : isSuspended
                              ? "status-suspended"
                              : isExpired
                              ? "status-expired"
                              : "status-active"
                          }`}
                        >
                          {isRevoked
                            ? "Revoked"
                            : isSuspended
                            ? "Suspended"
                            : isExpired
                            ? "Expired"
                            : "Active"}
                        </span>
                      </td>
                      <td>
                        <code className="table-hash" title={onChain.credentialHash}>
                          {onChain.credentialHash.slice(0, 10)}...
                        </code>
                      </td>
                      <td>
                        <div className="table-actions-cell">
                          {!isRevoked && (
                            <>
                              <button
                                type="button"
                                className="action-link suspend"
                                onClick={() => handleToggleSuspend(onChain.credentialId)}
                              >
                                {isSuspended ? "Reactivate" : "Suspend"}
                              </button>
                              <button
                                type="button"
                                className="action-link revoke"
                                onClick={() => {
                                  setRevokeTargetId(onChain.credentialId);
                                  setRevokeReason("Administrative audit correction");
                                }}
                              >
                                Revoke
                              </button>
                            </>
                          )}
                          {isRevoked && (
                            <span className="revoked-note" title={onChain.revocationReason}>
                              Revoked: {onChain.revocationReason?.slice(0, 20)}...
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Revocation Reason Modal */}
      {revokeTargetId && (
        <div className="modal-overlay" onClick={() => setRevokeTargetId(null)}>
          <div className="revoke-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Revoke Credential On-Chain</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setRevokeTargetId(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="warning-text">
                ⚠ <strong>Irreversible Action:</strong> Revoking a credential permanently changes its status on the Soroban smart contract. Verifiers worldwide will immediately detect this status change.
              </p>
              <label htmlFor="revoke-reason-input">
                Mandatory Revocation Audit Reason:
              </label>
              <textarea
                id="revoke-reason-input"
                rows={3}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Academic integrity violation, clerical error, degree rescinded..."
                required
              />
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="secondary-action compact"
                onClick={() => setRevokeTargetId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-action danger-action compact"
                onClick={handleConfirmRevoke}
                disabled={!revokeReason.trim()}
              >
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
