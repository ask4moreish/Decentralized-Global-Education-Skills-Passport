import type { UseCaseId } from "./useCases";
import { USE_CASES } from "./useCases";

export type Page = "landing" | "demo" | "architecture" | "dashboard" | "verify" | "drand";

export interface RouteState {
  page: Page;
  useCase: UseCaseId;
}

export function routeFromHash(): RouteState {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (!hash || hash === "landing") {
    return { page: "landing", useCase: "grants" };
  }

  const parts = hash.split("?").filter(Boolean);
  const path = parts[0] ?? "";
  const segments = path.split("/").filter(Boolean);
  const head = segments[0];

  if (head === "verify") {
    return { page: "verify", useCase: "grants" };
  }
  if (head === "architecture") {
    return { page: "architecture", useCase: "grants" };
  }
  if (head === "dashboard") {
    return { page: "dashboard", useCase: "grants" };
  }
  if (head === "drand") {
    return { page: "drand", useCase: "grants" };
  }
  if (head === "demo" || head === "app") {
    const maybeCase = segments[1];
    const useCase = USE_CASES.some((item) => item.id === maybeCase)
      ? (maybeCase as UseCaseId)
      : "grants";
    return { page: "demo", useCase };
  }

  return { page: "landing", useCase: "grants" };
}

export function hashFor(page: Page, useCase: UseCaseId = "grants"): string {
  if (page === "landing") return "#/landing";
  if (page === "architecture") return "#/architecture";
  if (page === "dashboard") return "#/dashboard";
  if (page === "verify") return "#/verify";
  if (page === "drand") return "#/drand";
  return `#/demo/${useCase}`;
}
