// x402-gated appraisal API.
//
// `POST /appraise` is payment-protected. An agent that calls it without payment
// gets HTTP 402 with the payment requirements (token, amount, payTo). It then
// signs a Soroban auth entry authorizing a USDC (SEP-41) transfer and retries
// with an `X-PAYMENT` header. This server is its OWN facilitator: it verifies
// the signed payment and settles it on-chain over Soroban RPC (the facilitator
// account sponsors the fee and submits) — no external relayer, no mock. Only
// after settlement succeeds does the agent receive the appraisal.

import http from "node:http";

import { x402Facilitator } from "@x402/core/facilitator";
import {
  x402HTTPResourceServer,
  x402ResourceServer,
  type FacilitatorClient,
  type HTTPAdapter,
  type HTTPRequestContext,
  type HTTPResponseInstructions,
  type RoutesConfig,
} from "@x402/core/server";
import type {
  PaymentPayload,
  PaymentRequirements,
  SupportedResponse,
} from "@x402/core/types";
import {
  convertToTokenAmount,
  createEd25519Signer,
  DEFAULT_TOKEN_DECIMALS,
} from "@x402/stellar";
import { ExactStellarScheme as FacilitatorStellarScheme } from "@x402/stellar/exact/facilitator";
import { ExactStellarScheme as ServerStellarScheme } from "@x402/stellar/exact/server";

import { appraise, AppraisalInputError, parseAppraisalRequest } from "./appraisal.js";
import type { AppraisalServerConfig } from "./config.js";

const APPRAISE_ROUTE = "POST /appraise";

/** Upper bound on the request body (an appraisal request is ~a few hundred
 *  bytes). Cap before x402 verification so a free request can't exhaust memory. */
const MAX_BODY_BYTES = 8 * 1024;

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    req.on("data", (c) => {
      const chunk = c as Buffer;
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error(`request body exceeds ${MAX_BODY_BYTES} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Minimal HTTPAdapter over a Node request + already-read body. */
function makeAdapter(
  req: http.IncomingMessage,
  url: URL,
  parsedBody: unknown,
): HTTPAdapter {
  return {
    getHeader: (name) => {
      const v = req.headers[name.toLowerCase()];
      return Array.isArray(v) ? v[0] : v;
    },
    getMethod: () => req.method ?? "GET",
    getPath: () => url.pathname,
    getUrl: () => url.toString(),
    getAcceptHeader: () => (req.headers["accept"] as string) ?? "",
    getUserAgent: () => (req.headers["user-agent"] as string) ?? "",
    getQueryParams: () => Object.fromEntries(url.searchParams.entries()),
    getQueryParam: (name) => url.searchParams.get(name) ?? undefined,
    getBody: () => parsedBody,
  };
}

function send(
  res: http.ServerResponse,
  status: number,
  headers: Record<string, string>,
  body: unknown,
) {
  const payload =
    typeof body === "string" ? body : JSON.stringify(body ?? {}, null, 2);
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(payload);
}

function writeInstructions(res: http.ServerResponse, i: HTTPResponseInstructions) {
  const body =
    i.isHtml || typeof i.body === "string"
      ? (i.body as string)
      : JSON.stringify(i.body ?? {}, null, 2);
  res.writeHead(i.status, {
    "content-type": i.isHtml ? "text/html" : "application/json",
    ...i.headers,
  });
  res.end(body ?? "");
}

/** Build (and initialize) the x402-gated appraisal HTTP server. */
export async function buildAppraisalServer(
  config: AppraisalServerConfig,
): Promise<http.Server> {
  const rpcConfig = config.rpcUrl ? { url: config.rpcUrl } : undefined;

  // In-process facilitator: verifies + settles on-chain (sponsors fees, submits).
  const facilitatorSigner = createEd25519Signer(config.facilitatorSecret, config.network);
  const facilitator = new x402Facilitator().register(
    config.network,
    new FacilitatorStellarScheme([facilitatorSigner], { rpcConfig }),
  );
  // x402Facilitator already exposes verify/settle/getSupported; adapt the
  // synchronous getSupported() to the async FacilitatorClient contract so we can
  // wire it straight into the resource server with no HTTP hop.
  const facilitatorClient: FacilitatorClient = {
    verify: (payload, requirements) => facilitator.verify(payload, requirements),
    settle: (payload, requirements) => facilitator.settle(payload, requirements),
    getSupported: async (): Promise<SupportedResponse> =>
      facilitator.getSupported() as unknown as SupportedResponse,
  };

  // Resource server: builds payment requirements and orchestrates verify/settle.
  const serverScheme = new ServerStellarScheme().registerMoneyParser(async (amount) => ({
    amount: convertToTokenAmount(String(amount), DEFAULT_TOKEN_DECIMALS),
    asset: config.asset,
    extra: {},
  }));
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    config.network,
    serverScheme,
  );

  const routes: RoutesConfig = {
    [APPRAISE_ROUTE]: {
      accepts: {
        scheme: "exact",
        payTo: config.payTo,
        price: config.price,
        network: config.network,
      },
      description: "Decentralized Global Education & Skills Passport deterministic item appraisal (fair value + suggested max bid)",
      mimeType: "application/json",
      serviceName: "decentralized-global-education-skills-passport-appraisal",
    },
  };

  const httpServer = new x402HTTPResourceServer(resourceServer, routes);
  await httpServer.initialize();

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const method = req.method ?? "GET";

      if (method === "GET" && url.pathname === "/healthz") {
        return send(res, 200, {}, { ok: true, service: "decentralized-global-education-skills-passport-appraisal" });
      }
      if (method === "GET" && url.pathname === "/") {
        return send(res, 200, {}, {
          service: "decentralized-global-education-skills-passport-appraisal",
          pay: APPRAISE_ROUTE,
          asset: config.asset,
          price: config.price,
          network: config.network,
        });
      }

      let rawBody: Buffer;
      try {
        rawBody = await readBody(req);
      } catch (e) {
        const tooLarge =
          e instanceof Error && e.message.includes("exceeds");
        return send(
          res,
          tooLarge ? 413 : 400,
          {},
          {
            error: tooLarge
              ? "request body too large (max 8 KiB)"
              : "failed to read request body",
          },
        );
      }
      let parsedBody: unknown = undefined;
      if (rawBody.length > 0) {
        try {
          parsedBody = JSON.parse(rawBody.toString("utf8"));
        } catch {
          return send(res, 400, {}, { error: "invalid JSON body" });
        }
      }

      const adapter = makeAdapter(req, url, parsedBody);
      const ctx: HTTPRequestContext = {
        adapter,
        path: url.pathname,
        method,
        paymentHeader: adapter.getHeader("X-PAYMENT"),
      };

      const result = await httpServer.processHTTPRequest(ctx);

      if (result.type === "no-payment-required") {
        return send(res, 404, {}, { error: "not found" });
      }
      if (result.type === "payment-error") {
        return writeInstructions(res, result.response);
      }

      // result.type === "payment-verified": funds are authorized but not yet
      // captured. Produce the resource; only settle on a valid request so a
      // malformed body never costs the caller.
      let body: unknown;
      try {
        body = { appraisal: appraise(parseAppraisalRequest(parsedBody)) };
      } catch (e) {
        if (e instanceof AppraisalInputError) {
          return send(res, 400, {}, { error: e.message });
        }
        throw e;
      }

      const responseBody = Buffer.from(JSON.stringify(body));
      const settle = await httpServer.processSettlement(
        result.paymentPayload as PaymentPayload,
        result.paymentRequirements as PaymentRequirements,
        result.declaredExtensions,
        { request: ctx, responseBody, responseHeaders: {} },
      );

      if (!settle.success) {
        return writeInstructions(res, settle.response);
      }
      return send(
        res,
        200,
        settle.headers,
        {
          ...(body as object),
          payment: {
            transaction: settle.transaction,
            network: settle.network,
            payer: settle.payer,
          },
        },
      );
    } catch (err) {
      send(res, 500, {}, { error: err instanceof Error ? err.message : String(err) });
    }
  });
}
