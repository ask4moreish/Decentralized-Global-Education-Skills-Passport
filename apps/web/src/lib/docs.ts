/**
 * Base URL for the markdown docs/ directory hosted on GitHub. Used by the
 * landing page verticals row (and any future in-app docs link) to link out to
 * the authoritative reference docs without depending on whether the dev server
 * or static deployment is configured to serve /docs/*.
 *
 * The repo slug is intentionally hard-coded — these are public docs and the
 * GitHub URL is the most stable entry point across local dev, preview deploys,
 * and production. If we ever move docs hosting, change this constant in one
 * place and every link updates.
 */
export const DOCS_BASE_URL =
  "https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/blob/main/docs";

export interface Vertical {
  /** Stable id used as React key + DOM id suffix. */
  id: string;
  /** Small mono-font eyebrow label rendered above the card title. */
  pill: string;
  /** Card title — the headline of the vertical. */
  title: string;
  /** 1-2 sentence body describing what the vertical does. */
  body: string;
  /**
   * Anchor slug matching the corresponding heading in docs/VERTICALS.md.
   * GitHub auto-generates these as `lower-kebab` of the heading text:
   *   "Sealed grants / SCF-style" → "sealed-grants-scf-style"
   *   "Sealed RFPs / procurement"  → "sealed-rfps-procurement"
   *   "Sealed auctions"            → "sealed-auctions"
   *   "Sealed credential portfolios (planned)" → "sealed-credential-portfolios-planned"
   * If you rename a heading in docs/VERTICALS.md, update the slug here too.
   */
  slug: string;
}

/**
 * The four verticals the landing page currently advertises — same set as
 * docs/VERTICALS.md's "active / planned" list (DAO voting is intentionally
 * excluded because it's submission-era reference only and is already covered
 * by the interactive demo cases section).
 */
export const VERTICALS: Vertical[] = [
  {
    id: "grants",
    pill: "Sealed grants · SCF-style",
    title: "Sealed grant review",
    body: "Judges commit encrypted scores. Drand opens the panel together for one verifiable allocation result.",
    slug: "sealed-grants-scf-style",
  },
  {
    id: "rfps",
    pill: "Sealed RFPs · procurement",
    title: "Sealed bidding & appraisal",
    body: "Bidders and appraisers commit in parallel. Reveal sets the price floor — no front-running.",
    slug: "sealed-rfps-procurement",
  },
  {
    id: "auctions",
    pill: "Sealed auctions",
    title: "Closed-bid auctions",
    body: "All bids sealed to Drand R. No meta leak, no copy-trading before close, no public running leader.",
    slug: "sealed-auctions",
  },
  {
    id: "credentials",
    pill: "Sealed credentials · planned",
    title: "Sealed credential portfolios",
    body: "Issuers commit a sealed credential stack; verifiers and the holder reveal together. Pilot-shaped, not yet shipped.",
    slug: "sealed-credential-portfolios-planned",
  },
];

/** Build a GitHub docs URL pointing at the vertical section in docs/VERTICALS.md. */
export function verticalDocsUrl(v: Vertical): string {
  return `${DOCS_BASE_URL}/VERTICALS.md#${v.slug}`;
}
