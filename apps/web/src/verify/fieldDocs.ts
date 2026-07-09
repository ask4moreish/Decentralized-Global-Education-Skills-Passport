// Human-readable documentation of every receipt field shown in the explorer.
// Keys are dot-paths into a RoundReceipt so the explorer can directly link an
// issue.path (e.g. "bids.GABC…commitment") to its description.
//
// The descriptions are deliberately short and tied to the verifier's checks
// — they explain what each field *means* and why the verifier cares.

export interface FieldDoc {
  /** Path inside the receipt, e.g. "roundId" or "bids.GABC.commitment". */
  path: string;
  /** Compact label shown next to the path. */
  label: string;
  /** One-sentence explanation in user-facing language. */
  description: string;
}

export interface FieldSection {
  id: string;
  title: string;
  fields: FieldDoc[];
}

export const FIELD_SECTIONS: FieldSection[] = [
  {
    id: "schema",
    title: "Schema & network",
    fields: [
      {
        path: "version",
        label: "version",
        description:
          "Receipt schema version. Must be 1. The verifier rejects any other value before running field-level checks.",
      },
      {
        path: "network",
        label: "network",
        description:
          "Stellar network passphrase (e.g. 'Test SDF Network ; September 2015'). The bundled fingerprint pins this field so forged passphrases are caught offline.",
      },
      {
        path: "networkFingerprint",
        label: "networkFingerprint",
        description:
          "sha256(utf8(network)) in lowercase hex. The verifier recomputes this from the bundled network and rejects the receipt if it differs.",
      },
      {
        path: "contractId",
        label: "contractId",
        description: "Soroban contract ID (C…). The verifier confirms it starts with C.",
      },
      {
        path: "exportedAt",
        label: "exportedAt",
        description:
          "ISO-8601 timestamp indicating when the receipt was exported locally. Not on-chain and not security-relevant.",
      },
    ],
  },
  {
    id: "round",
    title: "Round parameters",
    fields: [
      {
        path: "roundId",
        label: "roundId",
        description: "On-chain round id, encoded as decimal bigint string.",
      },
      {
        path: "itemRef",
        label: "itemRef",
        description: "Opaque 32-byte reference to the round's subject item (hex).",
      },
      {
        path: "revealRound",
        label: "revealRound",
        description:
          "Drand round R whose BLS threshold signature unlocks every sealed entry. Reveal cannot happen until R is published.",
      },
      {
        path: "clearingRule",
        label: "clearingRule",
        description:
          "Either 'HighestBid' or 'LowestBid'. Drives which bid wins and what the verifier recomputes for the declared winner.",
      },
      {
        path: "commitDeadline",
        label: "commitDeadline",
        description: "Unix seconds after which no more commits are accepted on-chain.",
      },
      {
        path: "revealDeadline",
        label: "revealDeadline",
        description: "Unix seconds after which reveal closes and the round is final.",
      },
      {
        path: "operator",
        label: "operator",
        description: "Round operator Stellar address (G…). Not checked individually by the verifier.",
      },
      {
        path: "auditorPubkey",
        label: "auditorPubkey",
        description:
          "Hex encoded auditor public key. Receives the encrypted bidder identity blob sealed per bid.",
      },
    ],
  },
  {
    id: "participants",
    title: "Participants",
    fields: [
      {
        path: "bidders",
        label: "bidders",
        description:
          "Ordered bidder addresses matching the on-chain index. Order matters: the verifier pairs each address with its entry in bids.",
      },
      {
        path: "bids.<address>",
        label: "bids",
        description:
          "Per-bidder entry keyed by Stellar address. Each entry contains the sealed commitment, escrow, revealed value (if any), and ephemeral evidence.",
      },
      {
        path: "bids.<address>.commitment",
        label: "commitment",
        description:
          "sha256(be16(value) || 32-byte nonce) in lowercase hex. The recompute check is the strongest offline binding in the verifier: a tampered commitment no longer matches the value+nonce.",
      },
      {
        path: "bids.<address>.escrow",
        label: "escrow",
        description: "Decimal bigint of USDC locked at commit time.",
      },
      {
        path: "bids.<address>.revealedValue",
        label: "revealedValue",
        description:
          "Bid value disclosed at reveal. Decimal bigint string. The verifier recomputes binding only when this field is non-null.",
      },
      {
        path: "bids.<address>.nonce",
        label: "nonce",
        description:
          "32-byte hex nonce. Required for the verifier's recompute check. Some contracts persist the hash on-chain only and do not include the nonce here — that is flagged as a 'missing_nonce_recompute' but not as an error.",
      },
      {
        path: "bids.<address>.evidence",
        label: "evidence",
        description:
          "Two expiry-bound blob hex strings — the tlock ciphertext and the encrypted auditor blob — used to dispute coercion post-hoc.",
      },
    ],
  },
  {
    id: "outcome",
    title: "Outcome",
    fields: [
      {
        path: "winner",
        label: "winner",
        description:
          "Declared winning bidder address. The verifier recomputes the expected winner from each valid revealed bid and compares.",
      },
      {
        path: "winningValue",
        label: "winningValue",
        description:
          "Decimal bigint of the winning bid. Surfaces only when a winner is declared.",
      },
      {
        path: "status",
        label: "status",
        description:
          "Final on-chain status (Open, Revealing, Cleared, Settled, Voided). An unknown value is reported as a warning, not an error.",
      },
      {
        path: "artifactChecksum",
        label: "artifactChecksum",
        description:
          "Optional sha256 hex of the local artifact manifest. When present, the receipt-cli verifier cross-checks it against the actual file with --verify-artifact-checksum.",
      },
    ],
  },
];
