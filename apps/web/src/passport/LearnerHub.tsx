import React, { useState } from "react";
import { isConnected, requestAccess, getAddress } from "@stellar/freighter-api";
import {
  createCredentialSharePackage,
  createSelectiveCredentialView,
  type VerifiableEducationCredential,
} from "skills-passport-sdk";
import {
  DEMO_LEARNERS,
  loadStoredCredentials,
  type StoredCredentialItem,
} from "./passportState";
import { QrCodeSvg } from "./qr";

export function LearnerHub() {
  const [credentials, setCredentials] = useState<StoredCredentialItem[]>(() =>
    loadStoredCredentials()
  );
  const [selectedLearnerIdx, setSelectedLearnerIdx] = useState(0);
  const [walletConnected, setWalletConnected] = useState(false);
  const [freighterAddress, setFreighterAddress] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  // Sharing Modal State
  const [activeShareCred, setActiveShareCred] =
    useState<VerifiableEducationCredential | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  const activeLearner = DEMO_LEARNERS[selectedLearnerIdx];
  const displayedAddress = freighterAddress || activeLearner.address;
  const displayedDid = freighterAddress
    ? `did:stellar:${freighterAddress}`
    : activeLearner.did;

  // Filter credentials for this learner
  const learnerCredentials = credentials.filter((c) => {
    const recipientAddr =
      c.vc.credentialSubject.recipientAddress ||
      c.vc.credentialSubject.id.replace(/^did:stellar:/, "");
    return (
      recipientAddr === displayedAddress ||
      recipientAddr === activeLearner.address
    );
  });

  const filteredCredentials = learnerCredentials.filter((c) => {
    if (filterType === "all") return true;
    if (filterType === "degree")
      return c.vc.type.includes("DegreeCredential");
    if (filterType === "certificate")
      return c.vc.type.includes("CertificateCredential");
    if (filterType === "badge")
      return c.vc.type.includes("SkillBadgeCredential");
    return true;
  });

  async function handleConnectFreighter() {
    try {
      const connected = await isConnected();
      if (connected) {
        const access = await requestAccess();
        if (access) {
          const addr = await getAddress();
          if (addr && addr.address) {
            setFreighterAddress(addr.address);
            setWalletConnected(true);
            return;
          }
        }
      }
      // If Freighter not installed or rejected, inform user and keep simulated profile
      alert(
        "Freighter wallet extension was not detected or access was denied. Continuing in verified developer testnet wallet mode."
      );
      setWalletConnected(true);
    } catch {
      setWalletConnected(true);
    }
  }

  function handleOpenShareModal(cred: VerifiableEducationCredential) {
    setActiveShareCred(cred);
    setSelectedSkills([...cred.credentialSubject.skills]);
    setCopiedLink(false);
  }

  function handleToggleSkill(skill: string) {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  }

  function handleDownloadJson(cred: VerifiableEducationCredential) {
    const jsonStr = JSON.stringify(cred, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cred.credentialSubject.title.replace(/\s+/g, "_")}_W3C_VC.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Generate sharing package with selective disclosure
  const sharePackage = activeShareCred
    ? createCredentialSharePackage(
        createSelectiveCredentialView(activeShareCred, selectedSkills),
        window.location.origin + window.location.pathname + "#/verify"
      )
    : null;

  function handleCopyShareLink() {
    if (sharePackage?.verificationUrl) {
      navigator.clipboard.writeText(sharePackage.verificationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  }

  return (
    <div className="learner-hub">
      {/* Learner Identity & Wallet Banner */}
      <div className="learner-profile-card">
        <div className="profile-header">
          <div className="avatar-badge">
            <span className="avatar-icon">🎓</span>
          </div>
          <div className="profile-info">
            <div className="name-row">
              <h3>{activeLearner.name}</h3>
              <span className="status-badge verified">Verified Learner</span>
            </div>
            <p className="role-title">{activeLearner.role}</p>
            <div className="did-container">
              <span className="did-label">Stellar DID:</span>
              <code className="did-value">{displayedDid}</code>
            </div>
          </div>
          <div className="wallet-actions">
            {!walletConnected ? (
              <button
                type="button"
                className="primary-action compact"
                onClick={handleConnectFreighter}
              >
                Connect Freighter Wallet
              </button>
            ) : (
              <div className="wallet-connected-pill">
                <span className="dot online" />
                <span>Connected: {displayedAddress.slice(0, 6)}...{displayedAddress.slice(-4)}</span>
                <button
                  type="button"
                  className="disconnect-btn"
                  onClick={() => {
                    setWalletConnected(false);
                    setFreighterAddress(null);
                  }}
                  title="Disconnect wallet"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="switch-demo-profile">
              <label htmlFor="learner-select">Demo Profile:</label>
              <select
                id="learner-select"
                value={selectedLearnerIdx}
                onChange={(e) => {
                  setSelectedLearnerIdx(Number(e.target.value));
                  setFreighterAddress(null);
                  setWalletConnected(false);
                }}
              >
                {DEMO_LEARNERS.map((l, idx) => (
                  <option key={l.address} value={idx}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="profile-stats-grid">
          <div className="stat-box">
            <span className="stat-num">{learnerCredentials.length}</span>
            <span className="stat-label">Total Credentials</span>
          </div>
          <div className="stat-box">
            <span className="stat-num">
              {learnerCredentials.filter((c) => c.onChain.status === "Active").length}
            </span>
            <span className="stat-label">Active On-Chain</span>
          </div>
          <div className="stat-box">
            <span className="stat-num">
              {new Set(learnerCredentials.flatMap((c) => c.vc.credentialSubject.skills)).size}
            </span>
            <span className="stat-label">Verified Skills</span>
          </div>
          <div className="stat-box">
            <span className="stat-num">W3C VC</span>
            <span className="stat-label">Standard Format</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="credentials-controls">
        <div className="filter-tabs">
          <button
            type="button"
            className={`filter-tab ${filterType === "all" ? "active" : ""}`}
            onClick={() => setFilterType("all")}
          >
            All Credentials ({learnerCredentials.length})
          </button>
          <button
            type="button"
            className={`filter-tab ${filterType === "degree" ? "active" : ""}`}
            onClick={() => setFilterType("degree")}
          >
            Degrees (
            {
              learnerCredentials.filter((c) =>
                c.vc.type.includes("DegreeCredential")
              ).length
            }
            )
          </button>
          <button
            type="button"
            className={`filter-tab ${filterType === "certificate" ? "active" : ""}`}
            onClick={() => setFilterType("certificate")}
          >
            Certificates (
            {
              learnerCredentials.filter((c) =>
                c.vc.type.includes("CertificateCredential")
              ).length
            }
            )
          </button>
          <button
            type="button"
            className={`filter-tab ${filterType === "badge" ? "active" : ""}`}
            onClick={() => setFilterType("badge")}
          >
            Skill Badges (
            {
              learnerCredentials.filter((c) =>
                c.vc.type.includes("SkillBadgeCredential")
              ).length
            }
            )
          </button>
        </div>
      </div>

      {/* Credentials Grid */}
      <div className="credentials-grid">
        {filteredCredentials.length === 0 ? (
          <div className="empty-credentials-state">
            <p>No credentials found matching this filter.</p>
          </div>
        ) : (
          filteredCredentials.map(({ vc, onChain }) => {
            const isRevoked = onChain.status === "Revoked";
            const isSuspended = onChain.status === "Suspended";
            const isExpired =
              onChain.expiresAt !== undefined &&
              Math.floor(Date.now() / 1000) >= onChain.expiresAt;

            return (
              <div
                key={vc.id}
                className={`credential-card ${
                  isRevoked
                    ? "revoked"
                    : isSuspended
                    ? "suspended"
                    : isExpired
                    ? "expired"
                    : "active"
                }`}
              >
                <div className="card-top">
                  <div className="type-badge-row">
                    <span className="type-tag">{vc.type[1]}</span>
                    <span
                      className={`status-pill ${
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
                        : "Active & Verified"}
                    </span>
                  </div>
                  <h4 className="credential-title">
                    {vc.credentialSubject.title}
                  </h4>
                  <div className="institution-row">
                    <span className="inst-icon">🏛️</span>
                    <span className="inst-name">
                      {vc.credentialSubject.institution}
                    </span>
                  </div>
                </div>

                <div className="card-body">
                  <p className="achievement-desc">
                    {vc.credentialSubject.achievementDescription}
                  </p>

                  {vc.credentialSubject.grade && (
                    <div className="grade-badge">
                      <span>Honors: </span>
                      <strong>{vc.credentialSubject.grade}</strong>
                    </div>
                  )}

                  {/* Skills tags */}
                  <div className="skills-section">
                    <span className="skills-heading">Verified Competencies:</span>
                    <div className="skills-tags">
                      {vc.credentialSubject.skills.map((skill) => (
                        <span key={skill} className="skill-pill">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* On-Chain Commitment Details */}
                  <div className="proof-box">
                    <div className="proof-row">
                      <span>Commitment Hash:</span>
                      <code>
                        {vc.proof.credentialHash.slice(0, 16)}...
                        {vc.proof.credentialHash.slice(-8)}
                      </code>
                    </div>
                    <div className="proof-row">
                      <span>Issued:</span>
                      <span>
                        {new Date(vc.issuanceDate).toLocaleDateString()}
                      </span>
                    </div>
                    {vc.expirationDate && (
                      <div className="proof-row">
                        <span>Expires:</span>
                        <span>
                          {new Date(vc.expirationDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {isRevoked && onChain.revocationReason && (
                      <div className="revocation-notice">
                        <strong>Revocation Audit Note:</strong>{" "}
                        {onChain.revocationReason}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-actions">
                  <button
                    type="button"
                    className="primary-action compact"
                    onClick={() => handleOpenShareModal(vc)}
                  >
                    Share / QR Code
                  </button>
                  <button
                    type="button"
                    className="secondary-action compact"
                    onClick={() => handleDownloadJson(vc)}
                  >
                    Export VC JSON
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Share & QR Code Modal */}
      {activeShareCred && sharePackage && (
        <div className="modal-overlay" onClick={() => setActiveShareCred(null)}>
          <div
            className="share-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Share Credential & Verification QR</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setActiveShareCred(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="qr-container">
                <QrCodeSvg value={sharePackage.qrPayload} size={220} />
                <p className="qr-caption">
                  Scan with any camera or verifier to independently confirm authenticity on Stellar Soroban.
                </p>
              </div>

              {/* Selective Disclosure Controls */}
              <div className="selective-disclosure-box">
                <h4>Selective Skills Disclosure:</h4>
                <p className="disclosure-desc">
                  Choose which skills to include in this presentation. Unselected skills will not be revealed to the employer.
                </p>
                <div className="skills-toggle-grid">
                  {activeShareCred.credentialSubject.skills.map((skill) => {
                    const isSelected = selectedSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        className={`skill-toggle-btn ${
                          isSelected ? "selected" : "deselected"
                        }`}
                        onClick={() => handleToggleSkill(skill)}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Link copy */}
              <div className="link-copy-box">
                <label>Shareable Verification Link:</label>
                <div className="copy-row">
                  <input
                    type="text"
                    readOnly
                    value={sharePackage.verificationUrl}
                    className="share-url-input"
                  />
                  <button
                    type="button"
                    className="primary-action compact"
                    onClick={handleCopyShareLink}
                  >
                    {copiedLink ? "Copied! ✓" : "Copy Link"}
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-action compact"
                onClick={() => handleDownloadJson(activeShareCred)}
              >
                Download Full VC JSON
              </button>
              <button
                type="button"
                className="primary-action compact"
                onClick={() => setActiveShareCred(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
