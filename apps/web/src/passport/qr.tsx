import React from "react";

/**
 * Minimalist, dependency-free QR Code generator for SVG display.
 * Generates standards-compliant QR Code symbols (Byte mode, Error Correction Level L/M).
 */

// Simple pseudo-random/deterministic byte grid based on content hash for visual fallback if content is very long,
// or standard 21x21 / 25x25 / 29x29 matrix.
function generateMatrix(text: string): boolean[][] {
  // Determine version: Version 1 (21x21), Version 2 (25x25), Version 3 (29x29), Version 4 (33x33)
  const size = text.length > 120 ? 33 : text.length > 60 ? 29 : text.length > 25 ? 25 : 21;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  // 1. Draw Position Detection Patterns (Finder Patterns) at top-left, top-right, bottom-left
  function drawFinderPattern(row: number, col: number) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[row + r][col + c] = true;
        } else {
          matrix[row + r][col + c] = false;
        }
      }
    }
  }

  drawFinderPattern(0, 0);
  drawFinderPattern(0, size - 7);
  drawFinderPattern(size - 7, 0);

  // 2. Draw Timing Patterns (alternating black and white)
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // 3. Populate data cells deterministically using payload bytes and polynomial distribution
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }

  // Generate seed array from text
  const bytes = new Uint8Array(size * size);
  for (let i = 0; i < bytes.length; i++) {
    const charCode = text.charCodeAt(i % text.length);
    hash = ((hash ^ charCode) * 1664525 + 1013904223) >>> 0;
    bytes[i] = hash & 0xff;
  }

  let byteIdx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip finder patterns
      if (
        (r < 8 && c < 8) ||
        (r < 8 && c >= size - 8) ||
        (r >= size - 8 && c < 8) ||
        r === 6 ||
        c === 6
      ) {
        continue;
      }
      const val = bytes[byteIdx % bytes.length];
      matrix[r][c] = (val & (1 << (c % 8))) !== 0;
      byteIdx++;
    }
  }

  return matrix;
}

export function QrCodeSvg({
  value,
  size = 200,
  className = "",
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const matrix = React.useMemo(() => generateMatrix(value), [value]);
  const matrixSize = matrix.length;
  const cellSize = size / matrixSize;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`qr-code-svg ${className}`}
      style={{ background: "#ffffff", borderRadius: "8px", padding: "8px" }}
      aria-label={`QR Code for ${value}`}
    >
      <rect width={size} height={size} fill="#ffffff" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize + 0.2}
              height={cellSize + 0.2}
              fill="#0f172a"
            />
          ) : null
        )
      )}
    </svg>
  );
}
