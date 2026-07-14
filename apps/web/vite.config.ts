import { resolve } from "node:path";
import { createRequire } from "node:module";
import react from "@vitejs/plugin-react";
import inject from "@rollup/plugin-inject";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);

/**
 * Split vendor libraries into separate chunks so browser caching stays
 * effective when app code changes.  Dependencies are grouped by
 * stability — React/framer (rarely change), SDK/tlock (change together).
 * All other node_modules (crypto polyfills, stellar-sdk, etc.) share a
 * single generic vendor chunk to avoid circular references.
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
    // Everything else in node_modules lands in a shared vendor chunk
    // (includes crypto polyfills, stellar-sdk, etc. — all npm deps that
    //  change together, avoiding the circular-chunk warning from a
    //  separate vendor-crypto chunk that cross-imports from vendor).
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
