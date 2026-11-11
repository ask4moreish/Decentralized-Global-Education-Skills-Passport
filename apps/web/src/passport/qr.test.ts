import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encodeQrMatrix } from "./qr.js";
import { routeFromHash, passportTabFromHash } from "../config/routing.js";
import {
  createVerifiableCredential,
  createCredentialSharePackage,
  DEFAULT_PASSPORT_VERIFY_URL,
} from "skills-passport-sdk";

// Independent ISO/IEC 18004 QR decoder (EC Level L) to verify our encoder produces genuinely scannable symbols.
const ALIGN_CENTERS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
  11: [6, 30, 54],
  12: [6, 32, 58],
  13: [6, 34, 62],
  14: [6, 26, 46, 66],
  15: [6, 26, 48, 70],
  16: [6, 26, 50, 74],
  17: [6, 30, 54, 78],
  18: [6, 30, 56, 82],
  19: [6, 30, 58, 86],
  20: [6, 34, 62, 90],
  21: [6, 28, 50, 72, 94],
  22: [6, 26, 50, 74, 98],
  23: [6, 30, 54, 78, 102],
  24: [6, 28, 54, 80, 106],
  25: [6, 32, 58, 84, 110],
  26: [6, 30, 58, 86, 114],
  27: [6, 34, 62, 90, 118],
};

const EC_L_SPEC: Record<number, [number, number, number, number, number]> = {
  1: [7, 1, 19, 0, 0],
  2: [10, 1, 34, 0, 0],
  3: [15, 1, 55, 0, 0],
  4: [20, 1, 80, 0, 0],
  5: [26, 1, 108, 0, 0],
  6: [18, 2, 68, 0, 0],
  7: [20, 2, 78, 0, 0],
  8: [24, 2, 97, 0, 0],
  9: [30, 2, 116, 0, 0],
  10: [18, 2, 68, 2, 69],
  11: [20, 4, 81, 0, 0],
  12: [24, 2, 92, 2, 93],
  13: [26, 4, 107, 0, 0],
  14: [30, 3, 115, 1, 116],
  15: [22, 5, 87, 1, 88],
  16: [24, 5, 98, 1, 99],
  17: [28, 1, 107, 5, 108],
  18: [30, 5, 120, 1, 121],
  19: [28, 3, 113, 4, 114],
  20: [28, 3, 107, 5, 108],
  21: [28, 4, 116, 4, 117],
  22: [28, 2, 111, 7, 112],
  23: [30, 4, 121, 5, 122],
  24: [30, 6, 117, 4, 118],
  25: [26, 8, 106, 4, 107],
  26: [28, 10, 114, 2, 115],
  27: [30, 8, 122, 4, 123],
};

function gfPow(exp: number): number {
  let x = 1;
  for (let i = 0; i < exp % 255; i++) {
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  return x;
}

function gfMul(a: number, b: number): number {
  let res = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) res ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1d;
    b >>>= 1;
  }
  return res;
}

function verifyRsSyndromeZero(codewordBlock: Uint8Array, ecCount: number): boolean {
  for (let rootExp = 0; rootExp < ecCount; rootExp++) {
    const root = gfPow(rootExp);
    let evalVal = 0;
    for (let i = 0; i < codewordBlock.length; i++) {
      evalVal = gfMul(evalVal, root) ^ codewordBlock[i];
    }
    if (evalVal !== 0) return false;
  }
  return true;
}

function decodeQrMatrix(matrix: boolean[][]): string {
  const size = matrix.length;
  const version = (size - 17) / 4;
  assert.ok(Number.isInteger(version) && version >= 1 && version <= 27);

  // Check finder pattern top-left center
  assert.equal(matrix[3][3], true);
  assert.equal(matrix[1][1], false);
  assert.equal(matrix[6][6], true);
  // Check dark module
  assert.equal(matrix[4 * version + 9][8], true);

  // Read format bits around top-left finder
  let fmt = 0;
  for (let i = 0; i <= 5; i++) fmt = (fmt << 1) | (matrix[8][i] ? 1 : 0);
  fmt = (fmt << 1) | (matrix[8][7] ? 1 : 0);
  fmt = (fmt << 1) | (matrix[8][8] ? 1 : 0);
  fmt = (fmt << 1) | (matrix[7][8] ? 1 : 0);
  for (let i = 9; i <= 14; i++) fmt = (fmt << 1) | (matrix[14 - i][8] ? 1 : 0);

  const unmaskedFmt = fmt ^ 0b101010000010010;
  const ecLevel = (unmaskedFmt >>> 13) & 0b11;
  const mask = (unmaskedFmt >>> 10) & 0b111;
  assert.equal(ecLevel, 0b01, "Expected EC Level L");

  // Recompute function mask map
  const isFunc: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) isFunc[r][c] = true;
    for (let c = size - 8; c < size; c++) isFunc[r][c] = true;
  }
  for (let r = size - 8; r < size; r++) {
    for (let c = 0; c < 9; c++) isFunc[r][c] = true;
  }
  for (let i = 8; i < size - 8; i++) {
    isFunc[6][i] = true;
    isFunc[i][6] = true;
  }
  for (const cr of ALIGN_CENTERS[version]) {
    for (const cc of ALIGN_CENTERS[version]) {
      if ((cr < 9 && cc < 9) || (cr < 9 && cc >= size - 8) || (cr >= size - 8 && cc < 9)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) isFunc[cr + dr][cc + dc] = true;
      }
    }
  }
  if (version >= 7) {
    for (let a = 0; a < 6; a++) {
      for (let b = size - 11; b < size - 8; b++) {
        isFunc[a][b] = true;
        isFunc[b][a] = true;
      }
    }
  }

  const unmask = (r: number, c: number): boolean => {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return false;
    }
  };

  const bits: number[] = [];
  let dirUp = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = dirUp ? size - 1 - step : step;
      for (let dx = 0; dx < 2; dx++) {
        const c = right - dx;
        if (isFunc[r][c]) continue;
        const bit = matrix[r][c] !== unmask(r, c) ? 1 : 0;
        bits.push(bit);
      }
    }
    dirUp = !dirUp;
  }

  const [ecPerBlock, g1Count, g1Data, g2Count, g2Data] = EC_L_SPEC[version];
  const totalCodewords = g1Count * (g1Data + ecPerBlock) + g2Count * (g2Data + ecPerBlock);
  const codewords = new Uint8Array(totalCodewords);
  for (let i = 0; i < totalCodewords; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    codewords[i] = b;
  }

  // De-interleave blocks and verify Reed-Solomon syndromes == 0
  const blocks: Uint8Array[] = [];
  for (let i = 0; i < g1Count; i++) blocks.push(new Uint8Array(g1Data + ecPerBlock));
  for (let i = 0; i < g2Count; i++) blocks.push(new Uint8Array(g2Data + ecPerBlock));

  let cwIdx = 0;
  const maxData = Math.max(g1Data, g2Data);
  for (let col = 0; col < maxData; col++) {
    for (let b = 0; b < blocks.length; b++) {
      const dLen = b < g1Count ? g1Data : g2Data;
      if (col < dLen) blocks[b][col] = codewords[cwIdx++];
    }
  }
  for (let col = 0; col < ecPerBlock; col++) {
    for (let b = 0; b < blocks.length; b++) {
      const dLen = b < g1Count ? g1Data : g2Data;
      blocks[b][dLen + col] = codewords[cwIdx++];
    }
  }

  const dataStream: number[] = [];
  for (let b = 0; b < blocks.length; b++) {
    assert.equal(verifyRsSyndromeZero(blocks[b], ecPerBlock), true, `RS syndrome failed for version ${version} block ${b}`);
    const dLen = b < g1Count ? g1Data : g2Data;
    for (let i = 0; i < dLen; i++) dataStream.push(blocks[b][i]);
  }

  const dataBits: number[] = [];
  for (const byte of dataStream) {
    for (let i = 7; i >= 0; i--) dataBits.push((byte >>> i) & 1);
  }

  const readInt = (pos: number, len: number) => {
    let v = 0;
    for (let i = 0; i < len; i++) v = (v << 1) | dataBits[pos + i];
    return v;
  };

  assert.equal(readInt(0, 4), 0b0100, "Expected Byte mode indicator");
  const countBits = version <= 9 ? 8 : 16;
  const byteCount = readInt(4, countBits);
  const out = new Uint8Array(byteCount);
  let p = 4 + countBits;
  for (let i = 0; i < byteCount; i++) {
    out[i] = readInt(p, 8);
    p += 8;
  }
  return new TextDecoder().decode(out);
}

describe("ISO/IEC 18004 QR Encoder & Passport Sharing Routing", () => {
  it("encodes and independently decodes short, anchor-length, and multi-block selective-disclosure URLs", () => {
    const vc = createVerifiableCredential({
      credentialType: "DegreeCredential",
      issuer: { address: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ", name: "MIT" },
      recipient: { address: "GBZXN7PIRZGNMHGA728DJNVH3189031ZXCBNM91048NZX891048NZ104", name: "Elena Rostova" },
      title: "B.Sc. Computer Science",
      institution: "MIT",
      skills: ["Rust", "Soroban", "Cryptography"],
      grade: "4.0",
      achievementDescription: "Completed honours curriculum.",
      contractId: "CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5",
      selectiveDisclosure: true,
    });

    const anchorUrl = createCredentialSharePackage(vc, DEFAULT_PASSPORT_VERIFY_URL, {
      mode: "anchor",
      contractId: "CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5",
    }).qrPayload;

    const selectiveUrl = createCredentialSharePackage(vc, DEFAULT_PASSPORT_VERIFY_URL, {
      mode: "payload",
      redactRecipientName: true,
      redactGrade: true,
      selectedSkills: ["Rust"],
    }).qrPayload;

    const multiGroupPayload =
      "https://example.org/#/passport/verify?data=" + "A".repeat(900);

    const payloads = [
      "hello-stellar",
      "https://example.org/#/passport/verify?cid=CAP3&id=" + "a".repeat(64),
      anchorUrl,
      multiGroupPayload,
    ];

    for (const payload of payloads) {
      const matrix = encodeQrMatrix(payload);
      const decoded = decodeQrMatrix(matrix);
      assert.equal(decoded, payload);
    }

    // Large full salted payload URL exceeds practical QR capacity and throws an actionable message directing to Anchor Mode
    assert.throws(
      () => encodeQrMatrix(selectiveUrl),
      /Use Anchor Mode for compact QR links/
    );
  });

  it("routes #/passport/verify and legacy #/verify passport params to PassportPage verifier tab without breaking round receipts", () => {
    assert.equal(routeFromHash("#/passport/verify?cid=CAP3&id=" + "a".repeat(64)).page, "passport");
    assert.equal(passportTabFromHash("#/passport/verify?cid=CAP3&id=" + "a".repeat(64)), "verifier");
    assert.equal(routeFromHash("#/verify?cid=CAP3&id=" + "a".repeat(64)).page, "passport");
    assert.equal(passportTabFromHash("#/verify?cid=CAP3&id=" + "a".repeat(64)), "verifier");
    assert.equal(routeFromHash("#/verify?data=abc").page, "passport");
    assert.equal(passportTabFromHash("#/verify?data=abc"), "verifier");

    // Round receipt permalink (?d=...) MUST remain on VerifyPage
    assert.equal(routeFromHash("#/verify?d=eyJ2ZXJzaW9uIjoxfQ==").page, "verify");
    assert.equal(routeFromHash("#/verify").page, "verify");
    assert.equal(passportTabFromHash("#/passport/issuer"), "issuer");
    assert.equal(passportTabFromHash("#/passport"), "learner");
  });

  it("does not leak sharing URLs or payloads into QR SVG aria-label attributes", () => {
    const qrSource = readFileSync(new URL("./qr.tsx", import.meta.url), "utf8");
    assert.equal(qrSource.includes("QR Code for ${value}"), false);
    assert.ok(qrSource.includes('aria-label="Verification QR code"'));
  });
});
