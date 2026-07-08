import process from "process/browser";

(globalThis as { process: typeof process }).process = process;
