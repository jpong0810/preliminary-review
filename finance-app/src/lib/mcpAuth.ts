import { timingSafeEqual } from "crypto";

/** Constant-time bearer token check against MCP_API_KEY. The MCP server is the one piece of this app reachable from the public internet without a UI login in front of it. */
export function isAuthorized(req: Request): boolean {
  const expected = process.env.MCP_API_KEY;
  if (!expected) return false; // refuse to serve if no key is configured — never fail open

  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" },
  });
}
