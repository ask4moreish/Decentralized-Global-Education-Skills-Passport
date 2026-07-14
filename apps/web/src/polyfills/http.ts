/**
 * Browser stub for Node.js `http` module.
 * This module is never used in browser code — it's required by server-only
 * code that happens to be in the import graph via barrel exports. If any
 * browser code path actually calls http functions, it will throw.
 */
export const request = () => {
  throw new Error("http.request is not available in the browser");
};

export const get = () => {
  throw new Error("http.get is not available in the browser");
};

export const createServer = () => {
  throw new Error("http.createServer is not available in the browser");
};

export const STATUS_CODES: Record<number, string> = {};

export const METHODS: string[] = [];

export default { request, get, createServer, STATUS_CODES, METHODS };
