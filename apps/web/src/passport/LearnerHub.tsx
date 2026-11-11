import React, { useState } from "react";
import { isConnected, requestAccess, getAddress } from "@stellar/freighter-api";
import {
  createCredentialSharePackage,
  createSelectiveCredentialView,
  type VerifiableEducationCredential,
} from "skills-passport-sdk";
import {
  DEFAULT_PASSPORT_CONTRACT_ID,
  DEMO_LEARNERS,
  ENCRYPTED_VAULT_STORAGE_KEY,
  clearDemoPassportStorage,
  hasEncryptedVault,
  importEncryptedVaultJson,
  initializeSeedCredentials,
  loadStoredCredentials,
  loadStoredIssuers,
  saveEncryptedVault,
  unlockEncryptedVault,
  type StoredCredentialItem,
} from "./passportState";
import { QrCodeSvg } from "./qr";

export function LearnerHub() {
  const [vaultEncrypted, setVaultEncrypted] = useState<boolean>(() =>
    hasEncryptedVault()
  );
  const [vaultLocked, setVaultLocked] = useState<boolean>(() =>
    hasEncryptedVault()
  );
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [vaultStatusMessage, setVaultStatusMessage] = useState<string | null>(
    null
  );
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<StoredCredentialItem[]>(() =>
    hasEncryptedVault() ? [] : loadStoredCredentials()
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
  const [shareMode, setShareMode] = useState<"anchor" | "payload">("anchor");
  const [redactName, setRedactName] = useState(true);
  const [redactAddress, setRedactAddress] = useState(false);
  const [redactGrade, setRedactGrade] = useState(true);
  const [redactDescription, setRedactDescription] = useState(false);
  const [ackPayloadDisclosure, setAckPayloadDisclosure] = useState(false);
  const [walletNotice, setWalletNotice] = useState<string | null>(null);

  async function handleEncryptVault() {
    setVaultError(null);
    setVaultStatusMessage(null);
    try {
      const currentCreds =
        credentials.length > 0 ? credentials : loadStoredCredentials();
      const currentIssuers = loadStoredIssuers();
      await saveEncryptedVault(currentCreds, currentIssuers, vaultPassphrase);
      setVaultEncrypted(true);
      setVaultLocked(false);
      setCredentials(currentCreds);
      setVaultPassphrase("");
      setVaultStatusMessage(
        "Vault encrypted with PBKDF2-SHA256 + AES-256-GCM; plaintext demo keys removed from localStorage."
      );
    } catch (err: any) {
      setVaultError(err?.message || "Failed to encrypt vault");
    }
  }

  async function handleUnlockVault() {
    setVaultError(null);
    setVaultStatusMessage(null);
    try {
      const bundle = await unlockEncryptedVault(vaultPassphrase);
      setCredentials(bundle.credentials);
      setVaultLocked(false);
      setVaultEncrypted(true);
      setVaultPassphrase("");
      setVaultStatusMessage("Encrypted vault unlocked into in-memory React state.");
    } catch (err: any) {
      setVaultError(err?.message || "Failed to unlock vault");
    }
  }

  function handleLockVault() {
    setVaultError(null);
    setCredentials([]);
    setVaultLocked(true);
    setVaultStatusMessage("Vault locked. Credential data cleared from component memory.");
  }

  function handleExportEncryptedBackup() {
    setVaultError(null);
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(ENCRYPTED_VAULT_STORAGE_KEY)
        : null;
    if (!raw) {
      setVaultError("Encrypt your vault with a passphrase before exporting an encrypted backup.");
      return;
    }
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skills-passport-vault.skp-vault.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportEncryptedBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVaultError(null);
    setVaultStatusMessage(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = String(ev.target?.result || "");
        const bundle = await importEncryptedVaultJson(content, vaultPassphrase);
        setCredentials(bundle.credentials);
        setVaultEncrypted(true);
        setVaultLocked(false);
        setVaultPassphrase("");
        setVaultStatusMessage("Encrypted vault backup imported and unlocked.");
      } catch (err: any) {
        setVaultError(
          err?.message ||
            "Enter the backup passphrase above before selecting a .skp-vault.json file."
        );
      }
    };
    reader.readAsText(file);
  }

  function handleClearDemoStorage() {
    clearDemoPassportStorage();
    setVaultEncrypted(false);
    setVaultLocked(false);
    setVaultPassphrase("");
    setCredentials([]);
    setVaultStatusMessage("Cleared all local browser credential storage.");
  }

  function handleReloadDemoSeed() {
    const seeded = initializeSeedCredentials();
    setVaultEncrypted(false);
    setVaultLocked(false);
    setCredentials(seeded);
    setVaultStatusMessage("Reloaded read-only demo seed credentials.");
  }

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
    setWalletNotice(null);
    try {
      const connected = await isConnected();
      if (connected && connected.isConnected) {
        const access = await requestAccess();
        if (access && !access.error) {
          const addr = await getAddress();
          if (addr && addr.address) {
            setFreighterAddress(addr.address);
            setWalletConnected(true);
            return;
          }
        }
      }
      setWalletConnected(false);
      setFreighterAddress(null);
      setWalletNotice(
        "Freighter wallet extension was not detected or access was denied. Using read-only Demo Learner Profile."
      );
    } catch {
      setWalletConnected(false);
      setFreighterAddress(null);
      setWalletNotice(
        "Unable to connect to Freighter wallet. Using read-only Demo Learner Profile."
      );
    }
  }

  function handleOpenShareModal(cred: VerifiableEducationCredential) {
    setActiveShareCred(cred);
    setSelectedSkills([...cred.credentialSubject.skills]);
    setCopiedLink(false);
    setShareMode("anchor");
    setAckPayloadDisclosure(false);
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

  const verifyBaseUrl =
    typeof window !== "undefined"
      ? window.location.origin + window.location.pathname + "#/passport/verify"
      : "https://ask4moreish.github.io/Decentralized-Global-Education-Skills-Passport/#/passport/verify";

  // Generate sharing package with Zero-PII anchor mode or salted selective disclosure
  const sharePackage = activeShareCred
    ? createCredentialSharePackage(activeShareCred, verifyBaseUrl, {
        mode: shareMode,
        contractId:
          activeShareCred.proof.contractId ||
          DEFAULT_PASSPORT_CONTRACT_ID,
        selectedSkills: shareMode === "payload" ? selectedSkills : undefined,
        redactRecipientName: shareMode === "payload" ? redactName : undefined,
        redactRecipientAddress: shareMode === "payload" ? redactAddress : undefined,
        redactGrade: shareMode === "payload" ? redactGrade : undefined,
        redactDescription: shareMode === "payload" ? redactDescription : undefined,
      })
    : null;

  const canRevealShareLink =
    shareMode === "anchor" || ackPayloadDisclosure;

  function handleCopyShareLink() {
    if (canRevealShareLink && sharePackage?.verificationUrl) {
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

        {walletNotice && (
          <div className="privacy-notice-banner" role="status">
            <span>{walletNotice}</span>
          </div>
        )}

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

      {/* Vault Encryption, Demo Boundary Notice & Recovery Backup */}
      <div className="vault-security-card">
        <div className="vault-security-header">
          <div>
            <h4>Local Passport Storage &amp; Recovery</h4>
            <p className="privacy-warning-note">
              <strong>Demo Browser Storage — Not Hardware-Backed Production Storage:</strong>{" "}
              Browser <code>localStorage</code> is accessible to same-origin scripts and browser
              extensions. Encrypting with a passphrase stores only{" "}
              <code>PBKDF2-SHA256</code> + <code>AES-256-GCM</code> ciphertext at rest and clears
              plaintext demo entries; production deployments should use encrypted cloud/device enclaves.
            </p>
          </div>
          <span
            className={`vault-storage-badge ${
              vaultLocked
                ? "vault-locked"
                : vaultEncrypted
                ? "vault-encrypted"
                : "vault-demo"
            }`}
          >
            {vaultLocked
              ? "🔒 Vault Locked"
              : vaultEncrypted
              ? "🛡 Encrypted at Rest"
              : "⚠ Unencrypted Demo Storage"}
          </span>
        </div>

        <div className="vault-controls-row">
          <input
            type="password"
            className="vault-passphrase-input"
            value={vaultPassphrase}
            onChange={(e) => setVaultPassphrase(e.target.value)}
            placeholder={
              vaultLocked
                ? "Enter vault passphrase to unlock..."
                : "Set/enter passphrase (8+ chars) to encrypt or restore..."
            }
            aria-label="Vault encryption passphrase"
          />
          <div className="vault-actions-row">
            {vaultLocked ? (
              <button
                type="button"
                className="primary-action compact"
                onClick={handleUnlockVault}
              >
                Unlock Vault
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="primary-action compact"
                  onClick={handleEncryptVault}
                >
                  {vaultEncrypted ? "Re-Encrypt Vault" : "Encrypt Vault in Browser"}
                </button>
                {vaultEncrypted && (
                  <button
                    type="button"
                    className="secondary-action compact"
                    onClick={handleLockVault}
                  >
                    Lock Vault
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              className="secondary-action compact"
              onClick={handleExportEncryptedBackup}
              disabled={!vaultEncrypted}
            >
              Export Encrypted Backup
            </button>
            <label className="secondary-action compact vault-backup-label">
              Restore Backup
              <input
                type="file"
                accept=".json,.skp-vault.json,application/json"
                onChange={handleImportEncryptedBackup}
              />
            </label>
            <button
              type="button"
              className="secondary-action compact"
              onClick={handleClearDemoStorage}
            >
              Clear Storage
            </button>
            {credentials.length === 0 && !vaultLocked && (
              <button
                type="button"
                className="secondary-action compact"
                onClick={handleReloadDemoSeed}
              >
                Reload Demo Seed
              </button>
            )}
          </div>
        </div>

        {vaultStatusMessage && (
          <div className="privacy-notice-banner" role="status">
            <span>{vaultStatusMessage}</span>
          </div>
        )}
        {vaultError && (
          <div className="error-banner" role="alert">
            <span>✕ {vaultError}</span>
          </div>
        )}
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
                {canRevealShareLink ? (
                  <QrCodeSvg value={sharePackage.qrPayload} size={220} />
                ) : (
                  <div className="qr-consent-placeholder">
                    <p>
                      Confirm the disclosure notice below before generating a QR code or link containing credential claims.
                    </p>
                  </div>
                )}
                <p className="qr-caption">
                  {shareMode === "anchor"
                    ? "Zero-PII Anchor QR: encodes only contract ID, credential ID, and SHA-256 commitment."
                    : "Selective Document QR: encodes only the claims and skills you explicitly select below."}
                </p>
              </div>

              {/* Privacy & Sharing Mechanism */}
              <div className="selective-disclosure-box">
                <h4>Privacy &amp; Sharing Mechanism</h4>
                <div className="share-mode-options">
                  <label className="share-mode-option">
                    <input
                      type="radio"
                      name="shareMode"
                      value="anchor"
                      checked={shareMode === "anchor"}
                      onChange={() => {
                        setShareMode("anchor");
                        setAckPayloadDisclosure(false);
                      }}
                    />
                    <span><strong>Zero-PII On-Chain Anchor (Recommended)</strong></span>
                  </label>
                  <label className="share-mode-option">
                    <input
                      type="radio"
                      name="shareMode"
                      value="payload"
                      checked={shareMode === "payload"}
                      onChange={() => setShareMode("payload")}
                    />
                    <span><strong>Selective Document Link</strong></span>
                  </label>
                </div>
                <p className="disclosure-desc">
                  {shareMode === "anchor"
                    ? "Encodes ONLY the Soroban contract ID, credential ID, and 32-byte hash commitment in the URL hash fragment (#/passport/verify?...). Zero student names, degrees, skills, or grades appear in the link."
                    : activeShareCred.proof.type === "StellarSorobanSaltedClaims2026"
                    ? "Uses salted per-claim SHA-256 commitments: redacted attributes and unchosen skills are stripped (with their salts) while disclosed claims stay cryptographically verifiable against the on-chain root hash. (Not zero-knowledge unlinkability: credential ID and issuer remain linkable.)"
                    : "Whole-document commitment credential: redacting attributes changes the document hash and will fail hash-match verification unless shared via Zero-PII Anchor or re-issued with salted selective disclosure."}
                </p>
                <p className="privacy-warning-note">
                  <strong>Privacy reality check:</strong> URL hash fragments (<code>#</code>) are not sent in HTTP request lines, <em>however</em> browser history, clipboard managers, forwarded messages, and screenshots still retain any opened or copied link. Anchor queries also reveal on-chain issuer/recipient Stellar addresses and status.
                </p>
              </div>

              {shareMode === "payload" && (
                <>
                  <div className="selective-disclosure-box">
                    <h4>Attribute Redaction Controls</h4>
                    <div className="redaction-checkbox-grid">
                      <label className="redaction-checkbox">
                        <input
                          type="checkbox"
                          checked={redactName}
                          onChange={(e) => setRedactName(e.target.checked)}
                        />
                        <span>Redact Student Name</span>
                      </label>
                      <label className="redaction-checkbox">
                        <input
                          type="checkbox"
                          checked={redactAddress}
                          onChange={(e) => setRedactAddress(e.target.checked)}
                        />
                        <span>Redact Learner Stellar DID</span>
                      </label>
                      <label className="redaction-checkbox">
                        <input
                          type="checkbox"
                          checked={redactGrade}
                          onChange={(e) => setRedactGrade(e.target.checked)}
                        />
                        <span>Redact Honors / Grade</span>
                      </label>
                      <label className="redaction-checkbox">
                        <input
                          type="checkbox"
                          checked={redactDescription}
                          onChange={(e) => setRedactDescription(e.target.checked)}
                        />
                        <span>Redact Achievement Description</span>
                      </label>
                    </div>
                  </div>

                  {/* Selective Disclosure Controls */}
                  <div className="selective-disclosure-box">
                    <h4>Selective Skills Disclosure</h4>
                    <p className="disclosure-desc">
                      Choose which skills to include in this presentation. Unselected skills and their salts are excluded.
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

                  {sharePackage.privacyReport && (
                    <div className="privacy-notice-banner">
                      <div>
                        <strong>Exposed in this presentation link:</strong>{" "}
                        {sharePackage.privacyReport.exposedUrlFields.length > 0
                          ? sharePackage.privacyReport.exposedUrlFields.join(", ")
                          : "None"}
                      </div>
                      <label className="consent-checkbox">
                        <input
                          type="checkbox"
                          checked={ackPayloadDisclosure}
                          onChange={(e) => setAckPayloadDisclosure(e.target.checked)}
                        />
                        <span>
                          I intentionally consent to share the selected claims above and understand that copied/opened links persist in browser history, clipboard, and screenshots.
                        </span>
                      </label>
                    </div>
                  )}
                </>
              )}

              {/* Link copy */}
              <div className="link-copy-box">
                <label>Shareable Verification Link:</label>
                <div className="copy-row">
                  <input
                    type="text"
                    readOnly
                    value={
                      canRevealShareLink
                        ? sharePackage.verificationUrl || ""
                        : "Confirm selective disclosure consent above to reveal link"
                    }
                    className="share-url-input"
                  />
                  <button
                    type="button"
                    className="primary-action compact"
                    onClick={handleCopyShareLink}
                    disabled={!canRevealShareLink}
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
                onClick={() =>
                  handleDownloadJson(
                    shareMode === "payload" ? sharePackage.credential : activeShareCred
                  )
                }
              >
                {shareMode === "payload"
                  ? "Download Disclosed Presentation JSON"
                  : "Download Full VC JSON"}
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
