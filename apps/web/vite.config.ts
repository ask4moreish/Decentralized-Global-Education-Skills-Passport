import react from "@vitejs/plugin-react";
import inject from "@rollup/plugin-inject";
import { createRequire } from "node:module";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);

export default defineConfig({
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
      // stream-browserify: uncommented if a dependency requires Node.js `stream`
      // stream: require.resolve("stream-browserify"),
      // events: uncommented if a dependency requires Node.js `events`
      // events: require.resolve("events/"),
      "node:crypto": require.resolve("crypto-browserify"),
      "node:buffer": require.resolve("buffer/"),
    },
  },
  define: {
    global: "globalThis",
    "process.env": "{}",
    "process.version": JSON.stringify("v22.0.0"),
  },
  optimizeDeps: {
    include: ["buffer", "crypto-browserify", "process/browser"],
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
