import React from "react";

/**
 * ISO/IEC 18004 compliant QR Code generator (Byte mode, Error Correction Level L, Versions 1-27).
 * Produces genuinely scannable QR symbols with GF(256) Reed-Solomon error correction,
 * BCH(15,5) format metadata, BCH(18,6) version metadata (V >= 7), and 8-mask penalty optimization.
 */

// [ecCodewordsPerBlock, group1Blocks, group1DataCodewords, group2Blocks, group2DataCodewords]
const EC_L_TABLE: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 0, 0, 0, 0], // placeholder 0
  [7, 1, 19, 0, 0],
  [10, 1, 34, 0, 0],
  [15, 1, 55, 0, 0],
  [20, 1, 80, 0, 0],
  [26, 1, 108, 0, 0],
  [18, 2, 68, 0, 0],
  [20, 2, 78, 0, 0],
  [24, 2, 97, 0, 0],
  [30, 2, 116, 0, 0],
  [18, 2, 68, 2, 69],
  [20, 4, 81, 0, 0],
  [24, 2, 92, 2, 93],
  [26, 4, 107, 0, 0],
  [30, 3, 115, 1, 116],
  [22, 5, 87, 1, 88],
  [24, 5, 98, 1, 99],
  [28, 1, 107, 5, 108],
  [30, 5, 120, 1, 121],
  [28, 3, 113, 4, 114],
  [28, 3, 107, 5, 108],
  [28, 4, 116, 4, 117],
  [28, 2, 111, 7, 112],
  [30, 4, 121, 5, 122],
  [30, 6, 117, 4, 118],
  [26, 8, 106, 4, 107],
  [28, 10, 114, 2, 115],
  [30, 8, 122, 4, 123],
];

const ALIGNMENT_COORDS: ReadonlyArray<readonly number[]> = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsComputeEc(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const rem = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function selectVersion(byteLength: number): number {
  for (let v = 1; v < EC_L_TABLE.length; v++) {
    const [, g1, d1, g2, d2] = EC_L_TABLE[v];
    const totalDataBytes = g1 * d1 + g2 * d2;
    const countBits = v <= 9 ? 8 : 16;
    const headerBits = 4 + countBits;
    const maxDataBytes = Math.floor((totalDataBytes * 8 - headerBits) / 8);
    if (byteLength <= maxDataBytes) {
      return v;
    }
  }
  throw new Error(
    `Payload (${byteLength} bytes) exceeds QR Level L capacity (max ~1464 bytes). Use Anchor Mode for compact QR links.`
  );
}

function buildDataAndEcCodewords(payloadBytes: Uint8Array, version: number): Uint8Array {
  const [ecPerBlock, g1Count, g1Data, g2Count, g2Data] = EC_L_TABLE[version];
  const totalDataBytes = g1Count * g1Data + g2Count * g2Data;
  const countBits = version <= 9 ? 8 : 16;

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Byte mode indicator: 0100
  pushBits(0b0100, 4);
  pushBits(payloadBytes.length, countBits);
  for (let i = 0; i < payloadBytes.length; i++) {
    pushBits(payloadBytes[i], 8);
  }

  // Terminator (up to 4 zero bits)
  const capacityBits = totalDataBytes * 8;
  const terminatorLen = Math.min(4, capacityBits - bits.length);
  for (let i = 0; i < terminatorLen; i++) bits.push(0);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Convert to bytes and apply alternating pad bytes 0xEC, 0x11
  const dataCodewords = new Uint8Array(totalDataBytes);
  let byteIdx = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    dataCodewords[byteIdx++] = b;
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (byteIdx < totalDataBytes) {
    dataCodewords[byteIdx++] = padBytes[padIdx % 2];
    padIdx++;
  }

  // Split into blocks and compute RS ECC
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let i = 0; i < g1Count; i++) {
    const block = dataCodewords.slice(offset, offset + g1Data);
    offset += g1Data;
    dataBlocks.push(block);
    ecBlocks.push(rsComputeEc(block, ecPerBlock));
  }
  for (let i = 0; i < g2Count; i++) {
    const block = dataCodewords.slice(offset, offset + g2Data);
    offset += g2Data;
    dataBlocks.push(block);
    ecBlocks.push(rsComputeEc(block, ecPerBlock));
  }

  // Interleave data codewords, then EC codewords
  const out: number[] = [];
  const maxDataLen = Math.max(g1Data, g2Data);
  for (let col = 0; col < maxDataLen; col++) {
    for (const block of dataBlocks) {
      if (col < block.length) out.push(block[col]);
    }
  }
  for (let col = 0; col < ecPerBlock; col++) {
    for (const ec of ecBlocks) {
      out.push(ec[col]);
    }
  }
  return new Uint8Array(out);
}

function bchFormatBits(mask: number): number {
  // EC Level L indicator = 01
  const data = (0b01 << 3) | (mask & 0b111);
  let rem = data << 10;
  const poly = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if (rem & (1 << i)) {
      rem ^= poly << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0b101010000010010;
}

function bchVersionBits(version: number): number {
  let rem = version << 12;
  const poly = 0b1111100100101;
  for (let i = 17; i >= 12; i--) {
    if (rem & (1 << i)) {
      rem ^= poly << (i - 12);
    }
  }
  return (version << 12) | rem;
}

function maskCondition(mask: number, r: number, c: number): boolean {
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
}

function evaluatePenalty(matrix: boolean[][]): number {
  const n = matrix.length;
  let penalty = 0;

  // Rule 1: 5+ consecutive same-color modules in row/col
  for (let r = 0; r < n; r++) {
    let runLen = 1;
    for (let c = 1; c < n; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < n; c++) {
    let runLen = 1;
    for (let r = 1; r < n; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 same-color blocks
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 3: 1:1:3:1:1 finder-like pattern with 4-module light quiet zone
  const matchPattern = (arr: boolean[], idx: number, pat: number[]) =>
    pat.every((bit, k) => arr[idx + k] === (bit === 1));
  const patA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const patB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c <= n - 11; c++) {
      if (matchPattern(matrix[r], c, patA) || matchPattern(matrix[r], c, patB)) {
        penalty += 40;
      }
    }
  }
  for (let c = 0; c < n; c++) {
    const col = matrix.map((row) => row[c]);
    for (let r = 0; r <= n - 11; r++) {
      if (matchPattern(col, r, patA) || matchPattern(col, r, patB)) {
        penalty += 40;
      }
    }
  }

  // Rule 4: dark module ratio deviation from 50%
  let dark = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) dark++;
    }
  }
  const pct = (dark * 100) / (n * n);
  const prev5 = Math.floor(pct / 5) * 5;
  const next5 = prev5 + 5;
  penalty += Math.min(Math.abs(prev5 - 50) / 5, Math.abs(next5 - 50) / 5) * 10;

  return penalty;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const payloadBytes = new TextEncoder().encode(text);
  const version = selectVersion(payloadBytes.length);
  const size = 17 + 4 * version;
  const codewords = buildDataAndEcCodewords(payloadBytes, version);

  const modules: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const setFunction = (r: number, c: number, dark: boolean) => {
    modules[r][c] = dark;
    isFunction[r][c] = true;
  };

  const drawFinderWithSeparator = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr;
        const c = left + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const dark =
          inOuter &&
          (dr === 0 ||
            dr === 6 ||
            dc === 0 ||
            dc === 6 ||
            (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setFunction(r, c, dark);
      }
    }
  };

  drawFinderWithSeparator(0, 0);
  drawFinderWithSeparator(0, size - 7);
  drawFinderWithSeparator(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  // Dark module
  setFunction(4 * version + 9, 8, true);

  // Alignment patterns (skip only the 3 corners overlapping finder patterns, not timing lines)
  const align = ALIGNMENT_COORDS[version];
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      const cr = align[i];
      const cc = align[j];
      const overlapsFinder =
        (cr <= 8 && cc <= 8) ||
        (cr <= 8 && cc >= size - 8) ||
        (cr >= size - 8 && cc <= 8);
      if (overlapsFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark =
            Math.max(Math.abs(dr), Math.abs(dc)) === 2 || (dr === 0 && dc === 0);
          setFunction(cr + dr, cc + dc, dark);
        }
      }
    }
  }

  // Reserve format info cells
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = size - 8; i < size; i++) {
    isFunction[8][i] = true;
  }
  for (let i = size - 7; i < size; i++) {
    isFunction[i][8] = true;
  }

  // Version info (versions >= 7)
  if (version >= 7) {
    const vBits = bchVersionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      setFunction(a, b, bit);
      setFunction(b, a, bit);
    }
  }

  // Zigzag place data/EC bits
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  let dirUp = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip vertical timing column
    for (let step = 0; step < size; step++) {
      const r = dirUp ? size - 1 - step : step;
      for (let dx = 0; dx < 2; dx++) {
        const c = right - dx;
        if (isFunction[r][c]) continue;
        let dark = false;
        if (bitIdx < totalBits) {
          const cw = codewords[bitIdx >>> 3];
          dark = ((cw >>> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx++;
        }
        modules[r][c] = dark;
      }
    }
    dirUp = !dirUp;
  }

  const writeFormatInfo = (grid: boolean[][], mask: number) => {
    const fmt = bchFormatBits(mask);
    // Horizontal & vertical around top-left finder
    for (let i = 0; i <= 5; i++) {
      grid[8][i] = ((fmt >>> (14 - i)) & 1) === 1;
    }
    grid[8][7] = ((fmt >>> 8) & 1) === 1;
    grid[8][8] = ((fmt >>> 7) & 1) === 1;
    grid[7][8] = ((fmt >>> 6) & 1) === 1;
    for (let i = 9; i <= 14; i++) {
      grid[14 - i][8] = ((fmt >>> (14 - i)) & 1) === 1;
    }
    // Bottom-left + top-right copies
    for (let i = 0; i <= 6; i++) {
      grid[size - 1 - i][8] = ((fmt >>> (14 - i)) & 1) === 1;
    }
    for (let i = 7; i <= 14; i++) {
      grid[8][size - 15 + i] = ((fmt >>> (14 - i)) & 1) === 1;
    }
  };

  // Pick optimal mask (lowest ISO penalty)
  let bestMatrix: boolean[][] | null = null;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = modules.map((row, r) =>
      row.map((val, c) =>
        isFunction[r][c] ? val : maskCondition(mask, r, c) ? !val : val
      )
    );
    writeFormatInfo(candidate, mask);
    const penalty = evaluatePenalty(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMatrix = candidate;
    }
  }

  return bestMatrix!;
}

export function QrCodeSvg({
  value,
  size = 220,
  className = "",
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const { matrix, error } = React.useMemo(() => {
    try {
      return { matrix: encodeQrMatrix(value), error: null as string | null };
    } catch (err: any) {
      return { matrix: null, error: err?.message || "Payload too large for QR code" };
    }
  }, [value]);

  if (!matrix || error) {
    return (
      <div
        className={`qr-code-fallback ${className}`}
        role="img"
        aria-label="QR code unavailable for oversized payload"
      >
        <p>{error}</p>
      </div>
    );
  }

  const quietZone = 4;
  const totalModules = matrix.length + quietZone * 2;
  const cellSize = size / totalModules;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`qr-code-svg ${className}`}
      style={{ background: "#ffffff", borderRadius: "8px" }}
      role="img"
      aria-label="Verification QR code"
    >
      <rect width={size} height={size} fill="#ffffff" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={(c + quietZone) * cellSize}
              y={(r + quietZone) * cellSize}
              width={cellSize + 0.15}
              height={cellSize + 0.15}
              fill="#0f172a"
            />
          ) : null
        )
      )}
    </svg>
  );
}
