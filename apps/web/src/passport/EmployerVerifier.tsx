import React, { useEffect, useState } from "react";
import {
  decodeSharedCredential,
  verifyEducationCredential,
  parseVerificationUrl,
  type VerifiableEducationCredential,
  type VerificationDiagnostic,
  type AnchorPayload,
} from "skills-passport-sdk";
import {
  loadStoredCredentials,
  loadStoredIssuers,
  type StoredCredentialItem,
} from "./passportState";

export function EmployerVerifier() {
  const [credentials] = useState<StoredCredentialItem[]>(() =>
    loadStoredCredentials()
  );
  const [issuers] = useState(() => loadStoredIssuers());

  const [inputUrlOrData, setInputUrlOrData] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [activeCredential, setActiveCredential] =
    useState<VerifiableEducationCredential | null>(null);
  const [anchorInfo, setAnchorInfo] = useState<AnchorPayload | null>(null);
  const [diagnostic, setDiagnostic] = useState<VerificationDiagnostic | null>(
    null
  );
  const [parseError, setParseError] = useState<string | null>(null);

  // Check URL on mount or hash change for embedded credential payload or zero-PII anchor
  useEffect(() => {
    function parseUrlPayload() {
      const href = window.location.href;
      const parsed = parseVerificationUrl(href);
      if (parsed.type === "payload" && parsed.payload) {
        setActiveCredential(parsed.payload);
        setAnchorInfo(null);
        setInputUrlOrData(href);
        setJsonInput(JSON.stringify(parsed.payload, null, 2));
        runVerification(parsed.payload);
      } else if (parsed.type === "anchor" && parsed.anchor) {
        setAnchorInfo(parsed.anchor);
        setActiveCredential(null);
        setInputUrlOrData(href);
        runAnchorVerification(parsed.anchor);
      }
    }

    parseUrlPayload();
    window.addEventListener("hashchange", parseUrlPayload);
    return () => window.removeEventListener("hashchange", parseUrlPayload);
  }, []);

  function runAnchorVerification(anchor: AnchorPayload) {
    setParseError(null);
    const targetId = (anchor.credentialId || "").toLowerCase();
    const targetHash = (anchor.credentialHash || "").toLowerCase();
    const stored = credentials.find(
      (c) =>
        (targetId && c.onChain.credentialId.toLowerCase() === targetId) ||
        (targetHash && c.onChain.credentialHash.toLowerCase() === targetHash)
    );

    const isIssuerAuthorized = stored
      ? issuers.find((i) => i.address === stored.onChain.issuer)?.isAuthorized ?? false
      : false;

    if (!stored) {
      setDiagnostic({
        isValid: false,
        status: "unverifiable",
        tampered: false,
        revoked: false,
        suspended: false,
        expired: false,
        untrustedIssuer: true,
        calculatedHash: anchor.credentialHash || "",
        claimedHash: anchor.credentialHash || "",
        evidence: {
          hashMatched: Boolean(anchor.credentialHash),
          issuerAuthorized: false,
          statusActive: false,
          notExpired: true,
          issuerAddress: "",
          recipientAddress: "",
          issuedAt: new Date().toISOString(),
        },
        errors: [`No on-chain registration record found matching credential hash: ${anchor.credentialHash || "none"}`],
      });
      return;
    }

    const onChain = stored.onChain;
    const isRevoked = onChain.status === "Revoked";
    const isSuspended = onChain.status === "Suspended";
    const isExpired = onChain.expiresAt !== undefined && onChain.expiresAt < Math.floor(Date.now() / 1000);
    const isActive = onChain.status === "Active" && !isExpired && isIssuerAuthorized;

    setDiagnostic({
      isValid: isActive,
      status: isRevoked ? "revoked" : isSuspended ? "suspended" : isExpired ? "expired" : !isIssuerAuthorized ? "untrusted" : "valid",
      tampered: false,
      revoked: isRevoked,
      suspended: isSuspended,
      expired: isExpired,
      untrustedIssuer: !isIssuerAuthorized,
      calculatedHash: anchor.credentialHash || onChain.credentialHash,
      claimedHash: onChain.credentialHash,
      evidence: {
        hashMatched: true,
        issuerAuthorized: isIssuerAuthorized,
        statusActive: onChain.status === "Active",
        notExpired: !isExpired,
        issuerAddress: onChain.issuer,
        recipientAddress: onChain.recipient,
        issuedAt: new Date(onChain.issuedAt * 1000).toISOString(),
        expiresAt: onChain.expiresAt ? new Date(onChain.expiresAt * 1000).toISOString() : undefined,
      },
      errors: isRevoked
        ? ["Credential has been permanently revoked on-chain."]
        : isSuspended
        ? ["Credential is currently suspended on-chain."]
        : isExpired
        ? ["Credential validity period has expired."]
        : !isIssuerAuthorized
        ? ["Issuing institution is deauthorized."]
        : [],
    });
  }

  function runVerification(vc: VerifiableEducationCredential) {
    setParseError(null);

    // Look up on-chain record from registry
    const idKey = vc.id.replace("urn:uuid:", "").replace(/-/g, "").padEnd(64, "0").slice(0, 64);
    const stored = credentials.find(
      (c) =>
        c.onChain.credentialId === idKey ||
        c.onChain.credentialHash.toLowerCase() ===
          vc.proof.credentialHash.toLowerCase()
    );

    // Look up issuer in registry. Unknown issuers are not authorized.
    const issuerAddr = vc.issuer.id.replace("did:stellar:", "");
    const issuerProfile = issuers.find((i) => i.address === issuerAddr);
    const isIssuerAuthorized = issuerProfile ? issuerProfile.isAuthorized : false;

    // Look up on-chain ledger record. If not found in registry, record is null (unverifiable).
    const onChainRecord = stored
      ? {
          ...stored.onChain,
          issuerAuthorized: isIssuerAuthorized,
        }
      : null;

    const diag = verifyEducationCredential(vc, onChainRecord);
    setDiagnostic(diag);
  }

  function handleProcessInput() {
    setParseError(null);
    if (!inputUrlOrData.trim() && !jsonInput.trim()) {
      setParseError("Please enter a verification link or paste a W3C Verifiable Credential JSON.");
      return;
    }

    try {
      if (inputUrlOrData.trim()) {
        const text = inputUrlOrData.trim();
        const parsed = parseVerificationUrl(text);
        if (parsed.type === "anchor" && parsed.anchor) {
          setAnchorInfo(parsed.anchor);
          setActiveCredential(null);
          runAnchorVerification(parsed.anchor);
          return;
        }
        if (parsed.type === "payload" && parsed.payload) {
          setAnchorInfo(null);
          setActiveCredential(parsed.payload);
          setJsonInput(JSON.stringify(parsed.payload, null, 2));
          runVerification(parsed.payload);
          return;
        }

        // Try direct base64 decode if not parsed by URL
        try {
          const vc = decodeSharedCredential(text);
          setAnchorInfo(null);
          setActiveCredential(vc);
          setJsonInput(JSON.stringify(vc, null, 2));
          runVerification(vc);
          return;
        } catch {
          // If not base64, try JSON
          const vc = JSON.parse(text) as VerifiableEducationCredential;
          setAnchorInfo(null);
          setActiveCredential(vc);
          setJsonInput(JSON.stringify(vc, null, 2));
          runVerification(vc);
          return;
        }
      }

      if (jsonInput.trim()) {
        const vc = JSON.parse(jsonInput.trim()) as VerifiableEducationCredential;
        setAnchorInfo(null);
        setActiveCredential(vc);
        runVerification(vc);
      }
    } catch (err: any) {
      setParseError(`Failed to parse credential: ${err.message}`);
      setDiagnostic(null);
      setActiveCredential(null);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const vc = JSON.parse(content) as VerifiableEducationCredential;
        setActiveCredential(vc);
        setJsonInput(JSON.stringify(vc, null, 2));
        setInputUrlOrData("");
        runVerification(vc);
      } catch (err: any) {
        setParseError(`Invalid JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  // Sample Scenarios for 1-click verification testing
  function handleLoadSample(scenario: "valid" | "tampered" | "revoked" | "expired" | "untrusted") {
    setParseError(null);
    const validSample = credentials[0].vc;

    if (scenario === "valid") {
      setActiveCredential(validSample);
      setJsonInput(JSON.stringify(validSample, null, 2));
      setInputUrlOrData("");
      runVerification(validSample);
    } else if (scenario === "tampered") {
      // Modify degree title and grade without changing proof
      const tampered = {
        ...validSample,
        credentialSubject: {
          ...validSample.credentialSubject,
          title: "Doctor of Philosophy in Artificial Intelligence (Tampered)",
          grade: "Perfect Score 4.0 (Forged)",
        },
      };
      setActiveCredential(tampered);
      setJsonInput(JSON.stringify(tampered, null, 2));
      setInputUrlOrData("");
      runVerification(tampered);
    } else if (scenario === "revoked") {
      const revoked = credentials.find((c) => c.onChain.status === "Revoked")?.vc || credentials[3].vc;
      setActiveCredential(revoked);
      setJsonInput(JSON.stringify(revoked, null, 2));
      setInputUrlOrData("");
      runVerification(revoked);
    } else if (scenario === "expired") {
      const expired = credentials.find((c) => c.onChain.expiresAt !== undefined)?.vc || credentials[4].vc;
      setActiveCredential(expired);
      setJsonInput(JSON.stringify(expired, null, 2));
      setInputUrlOrData("");
      runVerification(expired);
    } else if (scenario === "untrusted") {
      // Untrusted issuer
      const untrusted = {
        ...validSample,
        issuer: {
          id: "did:stellar:GDROGUE999999999999999999999999999999999999999999999999999",
          name: "Unaccredited Online Diploma Mill",
        },
      };
      setActiveCredential(untrusted);
      setJsonInput(JSON.stringify(untrusted, null, 2));
      setInputUrlOrData("");
      runVerification(untrusted);
    }
  }

  return (
    <div className="employer-verifier">
      {/* Verifier Hero / Guide */}
      <div className="verifier-intro-card">
        <h3>Independent Employer & Verifier Portal</h3>
        <p>
          Verify any educational credential or skill badge without contacting the issuing institution or trusting a centralized intermediary. Authenticity, hash integrity, and on-chain revocation state are verified cryptographically against Stellar Soroban.
        </p>

        {/* 1-Click Test Scenarios */}
        <div className="sample-scenarios-row">
          <span className="scenarios-label">Try Verification Scenarios:</span>
          <button
            type="button"
            className="sample-btn valid-btn"
            onClick={() => handleLoadSample("valid")}
          >
            ✓ Authentic Degree
          </button>
          <button
            type="button"
            className="sample-btn tampered-btn"
            onClick={() => handleLoadSample("tampered")}
          >
            ⚠ Tampered Degree
          </button>
          <button
            type="button"
            className="sample-btn revoked-btn"
            onClick={() => handleLoadSample("revoked")}
          >
            ✕ Revoked License
          </button>
          <button
            type="button"
            className="sample-btn expired-btn"
            onClick={() => handleLoadSample("expired")}
          >
            ⏱ Expired Certificate
          </button>
          <button
            type="button"
            className="sample-btn untrusted-btn"
            onClick={() => handleLoadSample("untrusted")}
          >
            ⛔ Untrusted Issuer
          </button>
        </div>
      </div>

      {/* Input Section */}
      <div className="verifier-input-grid">
        <div className="input-card">
          <h4>Option A: Paste Verification URL or QR Data</h4>
          <input
            type="text"
            className="verifier-text-input"
            value={inputUrlOrData}
            onChange={(e) => setInputUrlOrData(e.target.value)}
            placeholder="https://.../#/verify?data=eyJhbGci... or raw base64"
          />

          <div className="or-divider">
            <span>OR</span>
          </div>

          <h4>Option B: Upload W3C Verifiable Credential (.json)</h4>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            className="file-input"
          />

          <div className="or-divider">
            <span>OR</span>
          </div>

          <h4>Option C: Paste Raw JSON</h4>
          <textarea
            className="json-textarea"
            rows={5}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{"@context": [...], "type": ["VerifiableCredential", ...], ...}'
          />

          <button
            type="button"
            className="primary-action verify-execute-btn"
            onClick={handleProcessInput}
          >
            Execute Verification
          </button>

          {parseError && (
            <div className="error-banner" role="alert">
              <span>✕ {parseError}</span>
            </div>
          )}
        </div>

        {/* Verification Result Panel */}
        <div className="verdict-card">
          {diagnostic ? (
            <div className="verdict-container">
              {/* Top Status Banner */}
              <div
                className={`verdict-banner ${
                  diagnostic.isValid
                    ? "banner-valid"
                    : diagnostic.tampered
                    ? "banner-tampered"
                    : diagnostic.revoked
                    ? "banner-revoked"
                    : diagnostic.expired
                    ? "banner-expired"
                    : "banner-untrusted"
                }`}
              >
                <div className="banner-icon">
                  {diagnostic.isValid
                    ? "✓"
                    : diagnostic.tampered
                    ? "⚠"
                    : diagnostic.revoked
                    ? "✕"
                    : diagnostic.expired
                    ? "⏱"
                    : "⛔"}
                </div>
                <div className="banner-text">
                  <h3>
                    {diagnostic.isValid
                      ? "CREDENTIAL IS VALID & AUTHENTIC"
                      : diagnostic.tampered
                      ? "VERIFICATION FAILED: CONTENT TAMPERED"
                      : diagnostic.revoked
                      ? "CREDENTIAL HAS BEEN REVOKED"
                      : diagnostic.expired
                      ? "CREDENTIAL HAS EXPIRED"
                      : "ISSUER IS UNTRUSTED / DEAUTHORIZED"}
                  </h3>
                  <p>
                    {diagnostic.isValid
                      ? "Cryptographic hash matches Soroban commitment, issuing institution is verified, and credential is active on ledger."
                      : diagnostic.tampered
                      ? "The computed hash does not match the signed proof commitment! Credential text, grade, or title was altered."
                      : diagnostic.revoked
                      ? "The issuing institution formally revoked this credential on the Soroban smart contract."
                      : diagnostic.expired
                      ? "This credential has passed its expiration window."
                      : "The issuing entity address is not registered or was deauthorized on the Soroban registry."}
                  </p>
                </div>
              </div>

              {/* Evidentiary Proof Breakdown */}
              <div className="evidence-breakdown-card">
                <h4>Evidentiary Proof & Cryptographic Breakdown</h4>
                <div className="evidence-checklist">
                  <div className="check-item">
                    <span className={`check-icon ${diagnostic.evidence.hashMatched ? "pass" : "fail"}`}>
                      {diagnostic.evidence.hashMatched ? "✓" : "✕"}
                    </span>
                    <div className="check-desc">
                      <strong>SHA-256 Hash Commitment Integrity:</strong>
                      <span>
                        {diagnostic.evidence.hashMatched
                          ? "Computed canonical hash perfectly matches on-chain commitment."
                          : "Hash mismatch detected! Document has been modified."}
                      </span>
                      <div className="hash-compare-row">
                        <span>Computed: <code>{diagnostic.calculatedHash.slice(0, 18)}...</code></span>
                        <span>Claimed: <code>{diagnostic.claimedHash.slice(0, 18)}...</code></span>
                      </div>
                    </div>
                  </div>

                  <div className="check-item">
                    <span className={`check-icon ${diagnostic.evidence.issuerAuthorized ? "pass" : "fail"}`}>
                      {diagnostic.evidence.issuerAuthorized ? "✓" : "✕"}
                    </span>
                    <div className="check-desc">
                      <strong>Issuer Authorization & Accreditation:</strong>
                      <span>
                        {diagnostic.evidence.issuerAuthorized
                          ? "Issuing institution is active and verified in Soroban issuer registry."
                          : "Issuer is unrecognized or deauthorized on-chain."}
                      </span>
                    </div>
                  </div>

                  <div className="check-item">
                    <span className={`check-icon ${diagnostic.evidence.statusActive ? "pass" : "fail"}`}>
                      {diagnostic.evidence.statusActive ? "✓" : "✕"}
                    </span>
                    <div className="check-desc">
                      <strong>On-Chain Lifecycle Status:</strong>
                      <span>
                        {diagnostic.revoked
                          ? "Status: REVOKED on ledger."
                          : diagnostic.suspended
                          ? "Status: SUSPENDED pending review."
                          : "Status: ACTIVE on ledger."}
                      </span>
                    </div>
                  </div>

                  <div className="check-item">
                    <span className={`check-icon ${diagnostic.evidence.notExpired ? "pass" : "fail"}`}>
                      {diagnostic.evidence.notExpired ? "✓" : "✕"}
                    </span>
                    <div className="check-desc">
                      <strong>Validity Period & Expiration Check:</strong>
                      <span>
                        {diagnostic.evidence.notExpired
                          ? "Credential is within its valid date range."
                          : "Credential has expired."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Credential Details (if verified or loaded) */}
              {activeCredential && (
                <div className="verified-details-card">
                  <h4>Inspected Credential Details</h4>
                  <div className="details-grid">
                    <div className="detail-row">
                      <span className="label">Qualification Title:</span>
                      <strong>{activeCredential.credentialSubject.title}</strong>
                    </div>
                    <div className="detail-row">
                      <span className="label">Issuing Institution:</span>
                      <span>{activeCredential.credentialSubject.institution}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Recipient DID:</span>
                      <code>{activeCredential.credentialSubject.id}</code>
                    </div>
                    <div className="detail-row">
                      <span className="label">Issuance Date:</span>
                      <span>{new Date(activeCredential.issuanceDate).toLocaleDateString()}</span>
                    </div>
                    {activeCredential.credentialSubject.grade && (
                      <div className="detail-row">
                        <span className="label">Grade / Honors:</span>
                        <span>{activeCredential.credentialSubject.grade}</span>
                      </div>
                    )}
                    <div className="detail-row full-width">
                      <span className="label">Verified Skills:</span>
                      <div className="skills-tags">
                        {activeCredential.credentialSubject.skills.map((s) => (
                          <span key={s} className="skill-pill">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Anchor Details (Zero-PII Mode) */}
              {anchorInfo && !activeCredential && (
                <div className="verified-details-card">
                  <h4>🔒 Zero-PII On-Chain Anchor Verification</h4>
                  <p style={{ fontSize: "0.9rem", color: "var(--muted, #64748b)", marginBottom: "1rem" }}>
                    Verified strictly against Soroban contract state without exposing student name, degree title, or grades in the sharing link.
                  </p>
                  <div className="details-grid">
                    <div className="detail-row">
                      <span className="label">Soroban Contract:</span>
                      <code>{anchorInfo.contractId}</code>
                    </div>
                    <div className="detail-row">
                      <span className="label">Credential ID:</span>
                      <code>{anchorInfo.credentialId}</code>
                    </div>
                    <div className="detail-row full-width">
                      <span className="label">Cryptographic Hash Commitment:</span>
                      <code>{anchorInfo.credentialHash}</code>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="verdict-placeholder">
              <div className="placeholder-icon">🔍</div>
              <h4>No Credential Inspected Yet</h4>
              <p>
                Paste a verification link, upload a W3C VC JSON file, or select one of the test scenarios on the left to view the verification report.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
