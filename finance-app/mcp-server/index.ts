/**
 * Standalone runner for the MCP server — an alternative to exposing it as a Next.js API
 * route, for anyone who'd rather deploy it as its own small service. Reuses the exact
 * same tool implementations in src/mcp/server.ts.
 *
 * Usage: MCP_API_KEY=... DATABASE_URL=... npx tsx mcp-server/index.ts [port]
 */
import "dotenv/config";
import { createServer } from "node:http";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "../src/mcp/server";
import { isAuthorized, unauthorizedResponse } from "../src/lib/mcpAuth";

const port = Number(process.argv[2] ?? process.env.PORT ?? 8787);

const httpServer = createServer(async (nodeReq, nodeRes) => {
  try {
    const url = `http://${nodeReq.headers.host ?? "localhost"}${nodeReq.url}`;
    const chunks: Buffer[] = [];
    for await (const chunk of nodeReq) chunks.push(chunk as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const request = new Request(url, {
      method: nodeReq.method,
      headers: nodeReq.headers as Record<string, string>,
      body: body && nodeReq.method !== "GET" && nodeReq.method !== "HEAD" ? body : undefined,
    });

    let response: Response;
    if (!isAuthorized(request)) {
      response = unauthorizedResponse();
    } else {
      const mcp = createMcpServer();
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      await mcp.connect(transport);
      response = await transport.handleRequest(request);
    }

    nodeRes.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        nodeRes.write(value);
      }
    }
    nodeRes.end();
  } catch (err) {
    console.error(err);
    nodeRes.writeHead(500).end("Internal error");
  }
});

httpServer.listen(port, () => {
  console.log(`MCP server listening on http://localhost:${port}/`);
});
