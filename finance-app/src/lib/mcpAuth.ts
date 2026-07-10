import { timingSafeEqual } from "crypto";

function safeEqual(token: string, expected: string): boolean {
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Constant-time bearer token check against MCP_API_KEY. The MCP server is the one piece
 * of this app reachable from the public internet without a UI login in front of it.
 *
 * Accepts the token two ways: a standard `Authorization: Bearer <token>` header (for
 * command-line/standalone clients), or a `?key=<token>` query parameter — some MCP client
 * UIs (e.g. Claude's "Add custom connector" dialog) only offer a single URL field with no
 * way to set custom headers, so the token has to travel as part of the URL instead.
 */
export function isAuthorized(req: Request): boolean {
  const expected = process.env.MCP_API_KEY;
  if (!expected) return false; // refuse to serve if no key is configured — never fail open

  const header = req.headers.get("authorization") ?? "";
  const [scheme, headerToken] = header.split(" ");
  if (scheme === "Bearer" && headerToken && safeEqual(headerToken, expected)) return true;

  const queryToken = new URL(req.url).searchParams.get("key");
  if (queryToken && safeEqual(queryToken, expected)) return true;

  return false;
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" },
  });
}
