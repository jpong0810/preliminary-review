import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/mcp/server";
import { isAuthorized, unauthorizedResponse } from "@/lib/mcpAuth";

export const runtime = "nodejs";

// Stateless MCP endpoint: a fresh server+transport per request, secured by a bearer token
// (MCP_API_KEY) since — unlike the browser UI — this is reachable from the public internet.
async function handle(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
