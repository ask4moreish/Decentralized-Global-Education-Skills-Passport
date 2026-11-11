import React, { useEffect, useState } from "react";
import {
  EducationPassportClient,
  credentialIdToBytes32Hex,
  decodeSharedCredential,
  verifyEducationCredential,
  parseVerificationUrl,
  type VerifiableEducationCredential,
  type VerificationDiagnostic,
  type AnchorPayload,
} from "skills-passport-sdk";
import {
  DEFAULT_PASSPORT_CONTRACT_ID,
  DEFAULT_PASSPORT_NETWORK_PASSPHRASE,
  DEFAULT_PASSPORT_RPC_URL,
  DEMO_ISSUERS,
  loadStoredCredentials,
  loadStoredIssuers,
  type StoredCredentialItem,
} from "./passportState";

const TESTNET_EVIDENCE_ANCHOR: AnchorPayload = {
  contractId: DEFAULT_PASSPORT_CONTRACT_ID,
  credentialId: "cad1f7ed2b230fc062f66ea79477c5b6daa66e16b82ba8eadf4a9dbdfc8dcf28",
  credentialHash: "f26b917d1089d5df4527a0bbbb03499fcdb5e8b1ddae96998596de7191b8f98c",
};

const MAX_CREDENTIAL_UPLOAD_BYTES = 512 * 1024;

function sanitizeParsedJson<T>(raw: string): T {
  const parsed = JSON.parse(raw);
  if (
    parsed &&
    typeof parsed === "object" &&
    (Object.prototype.hasOwnProperty.call(parsed, "__proto__") ||
      Object.prototype.hasOwnProperty.call(parsed, "constructor"))
  ) {
    throw new Error("Rejected JSON payload containing forbidden prototype keys");
  }
  return parsed as T;
}

export function EmployerVerifier() {
  const [credentials] = useState<StoredCredentialItem[]>(() =>
    loadStoredCredentials()
  );
  const [issuers] = useState(() => loadStoredIssuers());

  const [verificationMode, setVerificationMode] = useState<"demo" | "testnet">("testnet");
  const [verificationProvenance, setVerificationProvenance] = useState<string | null>(null);
  const [loadingRpc, setLoadingRpc] = useState(false);

  const [inputUrlOrData, setInputUrlOrData] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [activeCredential, setActiveCredential] =
    useState<VerifiableEducationCredential | null>(null);
  const [anchorInfo, setAnchorInfo] = useState<AnchorPayload | null>(null);
  const [diagnostic, setDiagnostic] = useState<VerificationDiagnostic | null>(
    null
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [scrubbedFragment, setScrubbedFragment] = useState(false);

  // Check URL on mount or hash change for embedded credential payload or zero-PII anchor
  useEffect(() => {
    function parseUrlPayload() {
      const href = window.location.href;
      const parsed = parseVerificationUrl(href);
      if (parsed.type === "payload" && parsed.payload) {
        setActiveCredential(parsed.payload);
        setAnchorInfo(null);
        setInputUrlOrData("");
        setJsonInput(JSON.stringify(parsed.payload, null, 2));
        void runVerification(parsed.payload);
        // Scrub fragment parameters from the visible URL / current history entry
        window.history.replaceState(null, "", "#/passport/verify");
        setScrubbedFragment(true);
      } else if (parsed.type === "anchor" && parsed.anchor) {
        setAnchorInfo(parsed.anchor);
        setActiveCredential(null);
        setInputUrlOrData("");
        void runAnchorVerification(parsed.anchor);
        window.history.replaceState(null, "", "#/passport/verify");
        setScrubbedFragment(true);
      }
    }

    parseUrlPayload();
    window.addEventListener("hashchange", parseUrlPayload);
    return () => window.removeEventListener("hashchange", parseUrlPayload);
  }, []);

  async function fetchLiveTestnetRecord(credentialIdHex: string, contractId?: string) {
    const targetContract = contractId || DEFAULT_PASSPORT_CONTRACT_ID;
    const client = new EducationPassportClient({
      contractId: targetContract,
      rpcUrl: DEFAULT_PASSPORT_RPC_URL,
      networkPassphrase: DEFAULT_PASSPORT_NETWORK_PASSPHRASE,
    });
    const record = await client.fetchOnChainRecord(credentialIdHex);
    return { record, targetContract };
  }

  async function runAnchorVerification(
    anchor: AnchorPayload,
    preferredMode: "demo" | "testnet" = verificationMode
  ) {
    setParseError(null);
    const targetId = (anchor.credentialId || "").toLowerCase();
    const targetHash = (anchor.credentialHash || "").toLowerCase();

    if (preferredMode === "testnet" && targetId) {
      setLoadingRpc(true);
      try {
        const { record, targetContract } = await fetchLiveTestnetRecord(
          targetId,
          anchor.contractId
        );
        setVerificationProvenance(
          `Live Stellar Soroban Testnet RPC (${targetContract.slice(0, 8)}...)`
        );
        if (!record) {
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
              hashMatched: false,
              issuerAuthorized: false,
              statusActive: false,
              notExpired: true,
              issuerAddress: "",
              recipientAddress: "",
              issuedAt: "",
            },
            errors: [
              `No live ledger record on Soroban Testnet contract ${targetContract} for credentialId ${targetId}`,
            ],
          });
          return;
        }
        const hashMatches =
          !targetHash || record.credentialHash.toLowerCase() === targetHash;
        const isRevoked = record.status === "Revoked";
        const isSuspended = record.status === "Suspended";
        const isExpired =
          record.expiresAt !== undefined &&
          Math.floor(Date.now() / 1000) >= record.expiresAt;
        const isIssuerAuthorized = record.issuerAuthorized !== false;
        const isActive =
          hashMatches &&
          record.status === "Active" &&
          !isExpired &&
          isIssuerAuthorized;

        setDiagnostic({
          isValid: isActive,
          status: !hashMatches
            ? "tampered"
            : isRevoked
            ? "revoked"
            : isSuspended
            ? "suspended"
            : isExpired
            ? "expired"
            : !isIssuerAuthorized
            ? "untrusted"
            : "valid",
          tampered: !hashMatches,
          revoked: isRevoked,
          suspended: isSuspended,
          expired: isExpired,
          untrustedIssuer: !isIssuerAuthorized,
          calculatedHash: anchor.credentialHash || record.credentialHash,
          claimedHash: record.credentialHash,
          evidence: {
            hashMatched: hashMatches,
            issuerAuthorized: isIssuerAuthorized,
            statusActive: record.status === "Active",
            notExpired: !isExpired,
            issuerAddress: record.issuer,
            recipientAddress: record.recipient,
            issuedAt: new Date(record.issuedAt * 1000).toISOString(),
            expiresAt: record.expiresAt
              ? new Date(record.expiresAt * 1000).toISOString()
              : undefined,
          },
          errors: !hashMatches
            ? ["Anchor hash commitment does not match live Soroban ledger record."]
            : isRevoked
            ? [`Credential revoked on Testnet: ${record.revocationReason || "No reason specified"}`]
            : isSuspended
            ? [`Credential suspended on Testnet: ${record.revocationReason || "Under review"}`]
            : isExpired
            ? ["Credential validity period has expired on-chain."]
            : !isIssuerAuthorized
            ? ["Issuing institution is deauthorized on Testnet."]
            : [],
        });
        return;
      } catch (err: any) {
        setParseError(
          `Live Testnet RPC lookup failed (${err?.message || "network error"}). Switch to Demo Local Cache to inspect offline seed fixtures.`
        );
        return;
      } finally {
        setLoadingRpc(false);
      }
    }

    setVerificationProvenance("Demo Browser Local Cache — Not Live Ledger");
    const stored =
      credentials.find(
        (c) =>
          targetId &&
          c.onChain.credentialId.toLowerCase() === targetId &&
          (!targetHash || c.onChain.credentialHash.toLowerCase() === targetHash)
      ) ||
      credentials.find(
        (c) => targetHash && c.onChain.credentialHash.toLowerCase() === targetHash
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
          hashMatched: false,
          issuerAuthorized: false,
          statusActive: false,
          notExpired: true,
          issuerAddress: "",
          recipientAddress: "",
          issuedAt: "",
        },
        errors: [
          `No demo storage record found matching credential ID/hash: ${anchor.credentialHash || anchor.credentialId || "none"}`,
        ],
      });
      return;
    }

    const onChain = stored.onChain;
    const hashMatches = !targetHash || onChain.credentialHash.toLowerCase() === targetHash;
    const isRevoked = onChain.status === "Revoked";
    const isSuspended = onChain.status === "Suspended";
    const isExpired =
      onChain.expiresAt !== undefined &&
      Math.floor(Date.now() / 1000) >= onChain.expiresAt;
    const isActive =
      hashMatches && onChain.status === "Active" && !isExpired && isIssuerAuthorized;

    setDiagnostic({
      isValid: isActive,
      status: !hashMatches
        ? "tampered"
        : isRevoked
        ? "revoked"
        : isSuspended
        ? "suspended"
        : isExpired
        ? "expired"
        : !isIssuerAuthorized
        ? "untrusted"
        : "valid",
      tampered: !hashMatches,
      revoked: isRevoked,
      suspended: isSuspended,
      expired: isExpired,
      untrustedIssuer: !isIssuerAuthorized,
      calculatedHash: anchor.credentialHash || onChain.credentialHash,
      claimedHash: onChain.credentialHash,
      evidence: {
        hashMatched: hashMatches,
        issuerAuthorized: isIssuerAuthorized,
        statusActive: onChain.status === "Active",
        notExpired: !isExpired,
        issuerAddress: onChain.issuer,
        recipientAddress: onChain.recipient,
        issuedAt: new Date(onChain.issuedAt * 1000).toISOString(),
        expiresAt: onChain.expiresAt ? new Date(onChain.expiresAt * 1000).toISOString() : undefined,
      },
      errors: !hashMatches
        ? ["Anchor hash commitment does not match stored demo record."]
        : isRevoked
        ? [`Credential revoked (demo store): ${onChain.revocationReason || "No reason specified"}`]
        : isSuspended
        ? [`Credential suspended (demo store): ${onChain.revocationReason || "Under review"}`]
        : isExpired
        ? ["Credential validity period has expired."]
        : !isIssuerAuthorized
        ? ["Issuing institution is deauthorized in demo store."]
        : [],
    });
  }

  async function runVerification(
    vc: VerifiableEducationCredential,
    preferredMode: "demo" | "testnet" = verificationMode
  ) {
    setParseError(null);

    let idKey = "";
    try {
      idKey = vc.id ? credentialIdToBytes32Hex(vc.id) : "";
    } catch {
      idKey = "";
    }
    const claimedHash = vc.proof?.credentialHash?.toLowerCase() || "";

    if (preferredMode === "testnet" && idKey) {
      setLoadingRpc(true);
      try {
        const { record, targetContract } = await fetchLiveTestnetRecord(
          idKey,
          vc.proof?.contractId
        );
        setVerificationProvenance(
          `Live Stellar Soroban Testnet RPC (${targetContract.slice(0, 8)}...)`
        );
        const diag = verifyEducationCredential(vc, record);
        setDiagnostic(diag);
        return;
      } catch (err: any) {
        setParseError(
          `Live Testnet RPC lookup failed (${err?.message || "network error"}). Showing off-chain cryptographic & W3C checks without ledger status.`
        );
      } finally {
        setLoadingRpc(false);
      }
    }

    setVerificationProvenance("Demo Browser Local Cache — Not Live Ledger");
    const stored = credentials.find(
      (c) =>
        (idKey && c.onChain.credentialId.toLowerCase() === idKey) ||
        (claimedHash && c.onChain.credentialHash.toLowerCase() === claimedHash)
    );

    const issuerAddr = vc.issuer?.id ? vc.issuer.id.replace("did:stellar:", "") : "";
    const issuerProfile = issuers.find((i) => i.address === issuerAddr);
    const isIssuerAuthorized = issuerProfile ? issuerProfile.isAuthorized : false;

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
          void runAnchorVerification(parsed.anchor);
          return;
        }
        if (parsed.type === "payload" && parsed.payload) {
          setAnchorInfo(null);
          setActiveCredential(parsed.payload);
          setJsonInput(JSON.stringify(parsed.payload, null, 2));
          void runVerification(parsed.payload);
          return;
        }

        // Try direct base64 decode if not parsed by URL
        try {
          const vc = decodeSharedCredential(text);
          setAnchorInfo(null);
          setActiveCredential(vc);
          setJsonInput(JSON.stringify(vc, null, 2));
          void runVerification(vc);
          return;
        } catch {
          const vc = sanitizeParsedJson<VerifiableEducationCredential>(text);
          setAnchorInfo(null);
          setActiveCredential(vc);
          setJsonInput(JSON.stringify(vc, null, 2));
          void runVerification(vc);
          return;
        }
      }

      if (jsonInput.trim()) {
        const vc = sanitizeParsedJson<VerifiableEducationCredential>(jsonInput.trim());
        setAnchorInfo(null);
        setActiveCredential(vc);
        void runVerification(vc);
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
    if (file.size > MAX_CREDENTIAL_UPLOAD_BYTES) {
      setParseError("Credential JSON upload exceeds 512 KB safety limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const vc = sanitizeParsedJson<VerifiableEducationCredential>(content);
        setAnchorInfo(null);
        setActiveCredential(vc);
        setJsonInput(JSON.stringify(vc, null, 2));
        setInputUrlOrData("");
        void runVerification(vc);
      } catch (err: any) {
        setParseError(`Invalid JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  // Sample Scenarios for 1-click verification testing
  function handleLoadSample(
    scenario: "testnet-live" | "valid" | "tampered" | "revoked" | "expired" | "untrusted"
  ) {
    setParseError(null);

    if (scenario === "testnet-live") {
      setVerificationMode("testnet");
      setAnchorInfo(TESTNET_EVIDENCE_ANCHOR);
      setActiveCredential(null);
      setJsonInput("");
      setInputUrlOrData("");
      void runAnchorVerification(TESTNET_EVIDENCE_ANCHOR, "testnet");
      return;
    }

    setVerificationMode("demo");
    const validSample = credentials[0].vc;

    if (scenario === "valid") {
      setAnchorInfo(null);
      setActiveCredential(validSample);
      setJsonInput(JSON.stringify(validSample, null, 2));
      setInputUrlOrData("");
      void runVerification(validSample, "demo");
    } else if (scenario === "tampered") {
      const tampered = {
        ...validSample,
        credentialSubject: {
          ...validSample.credentialSubject,
          title: "Doctor of Philosophy in Artificial Intelligence (Tampered)",
          grade: "Perfect Score 4.0 (Forged)",
        },
      };
      setAnchorInfo(null);
      setActiveCredential(tampered);
      setJsonInput(JSON.stringify(tampered, null, 2));
      setInputUrlOrData("");
      void runVerification(tampered, "demo");
    } else if (scenario === "revoked") {
      const revoked = credentials.find((c) => c.onChain.status === "Revoked")?.vc || credentials[3].vc;
      setAnchorInfo(null);
      setActiveCredential(revoked);
      setJsonInput(JSON.stringify(revoked, null, 2));
      setInputUrlOrData("");
      void runVerification(revoked, "demo");
    } else if (scenario === "expired") {
      const expired = credentials.find((c) => c.onChain.expiresAt !== undefined)?.vc || credentials[4].vc;
      setAnchorInfo(null);
      setActiveCredential(expired);
      setJsonInput(JSON.stringify(expired, null, 2));
      setInputUrlOrData("");
      void runVerification(expired, "demo");
    } else if (scenario === "untrusted") {
      const rogueAddr = DEMO_ISSUERS[3].address;
      const untrusted = {
        ...validSample,
        issuer: {
          id: `did:stellar:${rogueAddr}`,
          name: "Unaccredited Online Diploma Mill",
        },
      };
      setAnchorInfo(null);
      setActiveCredential(untrusted);
      setJsonInput(JSON.stringify(untrusted, null, 2));
      setInputUrlOrData("");
      void runVerification(untrusted, "demo");
    }
  }

  return (
    <div className="employer-verifier">
      {/* Verifier Hero / Guide */}
      <div className="verifier-intro-card">
        <h3>Independent Employer &amp; Verifier Portal</h3>
        <p>
          Verify W3C Verifiable Credentials and zero-PII anchors against either the{" "}
          <strong>Live Stellar Testnet Soroban Contract</strong> (
          <code>{DEFAULT_PASSPORT_CONTRACT_ID.slice(0, 10)}...</code>) or offline demo fixtures.
        </p>

        <div className="verifier-mode-bar">
          <span className="scenarios-label">Verification Backend:</span>
          <button
            type="button"
            className={`sample-btn ${verificationMode === "testnet" ? "active-source-btn" : ""}`}
            onClick={() => setVerificationMode("testnet")}
          >
            🌐 Live Stellar Testnet RPC
          </button>
          <button
            type="button"
            className={`sample-btn ${verificationMode === "demo" ? "active-source-btn" : ""}`}
            onClick={() => setVerificationMode("demo")}
          >
            🧪 Demo Local Cache
          </button>
          <button
            type="button"
            className="sample-btn valid-btn"
            onClick={() => handleLoadSample("testnet-live")}
          >
            🔎 Query Real Testnet Credential (cad1f7...)
          </button>
        </div>

        {/* 1-Click Test Scenarios */}
        <div className="sample-scenarios-row">
          <span className="scenarios-label">Try Demo Scenarios:</span>
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
            placeholder="https://.../#/passport/verify?cid=...&id=...&h=..."
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
            disabled={loadingRpc}
          >
            {loadingRpc ? "Querying Stellar Testnet RPC..." : "Execute Verification"}
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
              {verificationProvenance && (
                <div className="verifier-provenance-banner" role="status">
                  <span>Source: <strong>{verificationProvenance}</strong></span>
                </div>
              )}

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
                      : diagnostic.suspended
                      ? "CREDENTIAL IS CURRENTLY SUSPENDED"
                      : diagnostic.status === "unverifiable"
                      ? "UNVERIFIABLE: NO LEDGER RECORD FOUND"
                      : diagnostic.expired
                      ? "CREDENTIAL HAS EXPIRED"
                      : "ISSUER IS UNTRUSTED / DEAUTHORIZED"}
                  </h3>
                  <p>
                    {diagnostic.isValid
                      ? "Cryptographic hash matches commitment, issuing institution is verified, and credential is active."
                      : diagnostic.tampered
                      ? "Computed hash or cryptographic proof failed verification! Document claims may have been altered."
                      : diagnostic.revoked
                      ? "The issuing institution formally revoked this credential."
                      : diagnostic.suspended
                      ? "This credential is temporarily suspended pending review."
                      : diagnostic.status === "unverifiable"
                      ? "No registration record was found in the selected verification backend for this credential ID or hash."
                      : diagnostic.expired
                      ? "This credential has passed its expiration window."
                      : "The issuing entity address is not registered or was deauthorized."}
                  </p>
                </div>
              </div>

              {/* Evidentiary Proof Breakdown */}
              <div className="evidence-breakdown-card">
                <h4>Evidentiary Proof &amp; Cryptographic Breakdown</h4>
                <div className="evidence-checklist">
                  <div className="check-item">
                    <span className={`check-icon ${diagnostic.evidence.hashMatched ? "pass" : "fail"}`}>
                      {diagnostic.evidence.hashMatched ? "✓" : "✕"}
                    </span>
                    <div className="check-desc">
                      <strong>SHA-256 Hash Commitment Integrity:</strong>
                      <span>
                        {diagnostic.evidence.hashMatched
                          ? "Computed canonical hash matches commitment."
                          : "Hash mismatch or missing ledger commitment."}
                      </span>
                      <div className="hash-compare-row">
                        <span>Computed: <code>{diagnostic.calculatedHash.slice(0, 18)}...</code></span>
                        <span>Claimed: <code>{diagnostic.claimedHash.slice(0, 18)}...</code></span>
                      </div>
                    </div>
                  </div>

                  {diagnostic.evidence.w3cSchemaValid !== undefined && (
                    <div className="check-item">
                      <span className={`check-icon ${diagnostic.evidence.w3cSchemaValid ? "pass" : "fail"}`}>
                        {diagnostic.evidence.w3cSchemaValid ? "✓" : "✕"}
                      </span>
                      <div className="check-desc">
                        <strong>W3C VC Data Model v1.1 &amp; Proof Validation:</strong>
                        <span>
                          {diagnostic.evidence.w3cSchemaValid
                            ? "JSON-LD context, timestamps, DID StrKeys, and proof format conform to W3C VC v1.1."
                            : "One or more W3C VC v1.1 schema or StrKey checks flagged warnings/errors."}
                          {diagnostic.evidence.dataIntegrityVerified !== undefined &&
                            ` · Data Integrity (eddsa-jcs-2022): ${
                              diagnostic.evidence.dataIntegrityVerified ? "VERIFIED" : "FAILED"
                            }`}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="check-item">
                    <span className={`check-icon ${diagnostic.evidence.issuerAuthorized ? "pass" : "fail"}`}>
                      {diagnostic.evidence.issuerAuthorized ? "✓" : "✕"}
                    </span>
                    <div className="check-desc">
                      <strong>Issuer Authorization &amp; Accreditation:</strong>
                      <span>
                        {diagnostic.evidence.issuerAuthorized
                          ? "Issuing institution is active and verified in selected registry."
                          : "Issuer is unrecognized or deauthorized."}
                      </span>
                    </div>
                  </div>

                  <div className="check-item">
                    <span className={`check-icon ${diagnostic.evidence.statusActive ? "pass" : "fail"}`}>
                      {diagnostic.evidence.statusActive ? "✓" : "✕"}
                    </span>
                    <div className="check-desc">
                      <strong>Lifecycle Status:</strong>
                      <span>
                        {diagnostic.status === "unverifiable"
                          ? "Status: NOT FOUND on selected registry."
                          : diagnostic.revoked
                          ? "Status: REVOKED."
                          : diagnostic.suspended
                          ? "Status: SUSPENDED pending review."
                          : "Status: ACTIVE."}
                      </span>
                    </div>
                  </div>

                  <div className="check-item">
                    <span className={`check-icon ${diagnostic.evidence.notExpired ? "pass" : "fail"}`}>
                      {diagnostic.evidence.notExpired ? "✓" : "✕"}
                    </span>
                    <div className="check-desc">
                      <strong>Validity Period &amp; Expiration Check:</strong>
                      <span>
                        {diagnostic.evidence.notExpired
                          ? "Credential is within its valid date range."
                          : "Credential has expired."}
                      </span>
                    </div>
                  </div>
                </div>
                {diagnostic.errors.length > 0 && (
                  <div className="privacy-warning-note">
                    <strong>Diagnostic Findings:</strong> {diagnostic.errors.join(" | ")}
                  </div>
                )}
              </div>

              {scrubbedFragment && (
                <div className="privacy-notice-banner" role="status">
                  <span>
                    URL fragment parameters were cleared from the address bar after verification. Note: prior browser history entries or copied links may still retain visited URLs.
                  </span>
                </div>
              )}

              {/* Credential Details (if verified or loaded) */}
              {activeCredential && (
                <div className="verified-details-card">
                  <h4>Inspected Credential Details</h4>
                  {diagnostic.evidence.hiddenClaimsCount !== undefined && diagnostic.evidence.hiddenClaimsCount > 0 && (
                    <p className="privacy-warning-note">
                      Selective Disclosure Presentation: {diagnostic.evidence.hiddenClaimsCount} attribute commitment(s) remain hidden behind salted SHA-256 digests and were not disclosed by the holder.
                    </p>
                  )}
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
                  <p className="disclosure-desc">
                    Verified without exposing student name, degree title, skills, or grades in the sharing link. On-chain anchor verification proves commitment existence and status; ledger lookups expose issuer/recipient Stellar addresses.
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
