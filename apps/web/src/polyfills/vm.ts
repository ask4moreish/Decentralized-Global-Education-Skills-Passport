/**
 * Browser stub for Node.js `vm` module.
 * Imported by asn1.js for dynamic code evaluation — never actually called
 * in the browser code paths that asn1.js uses. A real vm polyfill cannot
 * exist in the browser, so we provide an empty module that throws if
 * any code path actually tries to use it at runtime.
 */
export const Script = function Script() {
  throw new Error("vm.Script is not available in the browser");
};

export const createScript = () => {
  throw new Error("vm.createScript is not available in the browser");
};

export const runInNewContext = () => {
  throw new Error("vm.runInNewContext is not available in the browser");
};

export const runInThisContext = () => {
  throw new Error("vm.runInThisContext is not available in the browser");
};

export const isContext = () => false;

export const createContext = () => ({});

export default { Script, createScript, runInNewContext, runInThisContext, isContext, createContext };
