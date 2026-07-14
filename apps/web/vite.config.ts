import { resolve } from "node:path";
import { createRequire } from "node:module";
import react from "@vitejs/plugin-react";
import inject from "@rollup/plugin-inject";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);

/**
 * Split vendor libraries into separate chunks so browser caching stays
 * effective when app code changes.  Dependencies are grouped by
 * stability — React/framer (rarely change), SDK/tlock (change together),
 * crypto polyfills (pinned).
 */
function manualChunks(id: string): string | undefined {
  // Node_modules check
  if (id.includes("node_modules")) {
    // React & React DOM — change only via major upgrades
    if (id.includes("react") || id.includes("react-dom")) {
      return "vendor-react";
    }
    // framer-motion — heavy animation library
    if (id.includes("framer-motion")) {
      return "vendor-animation";
    }
    // Stellar SDK + crypto polyfills — large, change infrequently
    if (
      id.includes("@stellar/stellar-sdk") ||
      id.includes("crypto-browserify") ||
      id.includes("buffer") ||
      id.includes("process") ||
      id.includes("hash") ||
      id.includes("browserify") ||
      id.includes("bn.js") ||
      id.includes("elliptic") ||
      id.includes("minimalistic") ||
      id.includes("asn1.js") ||
      id.includes("parse-asn1") ||
      id.includes("pbkdf2") ||
      id.includes("public-encrypt") ||
      id.includes("randombytes") ||
      id.includes("safe-buffer") ||
      id.includes("create-hash") ||
      id.includes("create-hmac") ||
      id.includes("cipher-base") ||
      id.includes("readable-stream") ||
      id.includes("evp_bytestokey") ||
      id.includes("diffie-hellman") ||
      id.includes("des.js") ||
      id.includes("brorand")
    ) {
      return "vendor-crypto";
    }
    // Everything else in node_modules lands in a shared vendor chunk
    return "vendor";
  }

  // Monorepo workspace packages — SDK, tlock, agent, bindings, keeper, etc.
  if (id.includes("@decentralized-global-education-skills-passport")) {
    return "vendor-skp";
  }

  return undefined;
}

export default defineConfig({
  base: "/Decentralized-Global-Education-Skills-Passport/",
  plugins: [
    react(),
    {
      ...inject({
        process: "process/browser",
        Buffer: ["buffer", "Buffer"],
      }),
      enforce: "post",
    },
  ],
  resolve: {
    alias: {
      buffer: require.resolve("buffer/"),
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      events: require.resolve("events/"),
      vm: resolve("./src/polyfills/vm.ts"),
      "node:crypto": require.resolve("crypto-browserify"),
      "node:buffer": require.resolve("buffer/"),
      "node:http": resolve("./src/polyfills/http.ts"),
    },
  },
  define: {
    global: "globalThis",
    "process.env": "{}",
    "process.version": JSON.stringify("v22.0.0"),
  },
  optimizeDeps: {
    include: ["buffer", "crypto-browserify", "process/browser", "stream-browserify", "events"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    port: 5173,
    headers: {
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
  },
});
