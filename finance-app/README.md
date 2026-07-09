# Personal Finance & Research Dashboard

A hosted, single-user finance tracker + market-research workspace, with a built-in
MCP server so Claude can read and write to it directly from any conversation.

Stack: Next.js (App Router) + Prisma/Postgres + Chart.js, with the MCP server
exposed as a Next.js API route (`/api/mcp`) so it ships in the same deployment.

## Data model

See `prisma/schema.prisma` for the full schema: Account, Holding, Rule (exposure +
price), Thought, Research entry, Digest source/synthesis, Call (track record),
Insight, Todo — plus the cross-entity links that power the Tags and Lineage views.

## Local development

Prerequisites: Node 18+, a Postgres database (local or hosted).

```bash
cd finance-app
npm install
cp .env.example .env   # fill in DATABASE_URL, MCP_API_KEY, (optional) ANTHROPIC_API_KEY
npx prisma migrate dev
npm run db:seed        # optional: loads sample accounts/holdings/thoughts/research
npm run dev
```

The app is unauthenticated in the browser (single-user, assume only you have the
URL) — there's no login screen by design.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (Prisma) |
| `MCP_API_KEY` | yes (for the MCP server) | Bearer token every MCP request must present — this is the one part of the app reachable from the public internet |
| `ANTHROPIC_API_KEY` | optional but recommended | Powers server-side inference: the in-app Thoughts quick-add box (sentiment/tags/ticker-price inference via `/api/ai/infer-thought`), the "Check price rules" action, and FX-rate refresh. Without it, the app falls back to cheap local heuristics (keyword-based sentiment/tags, no live price/FX lookups) |

## Deploying

1. **Database**: create a free Postgres instance on [Neon](https://neon.tech) or
   [Supabase](https://supabase.com). Copy the connection string into `DATABASE_URL`.
2. **App**: deploy this directory to [Vercel](https://vercel.com) (or any Node
   host). Set the three env vars above in the project's environment settings.
   Run `npx prisma migrate deploy` against the production database once (Vercel's
   build step can do this via a `postinstall`/build command, or run it manually).
3. **MCP connector**: once deployed, the MCP endpoint is
   `https://<your-deployment>/api/mcp`. Add it to Claude as a custom connector
   (Settings → Connectors → Add custom connector), with header
   `Authorization: Bearer <MCP_API_KEY>`.

### Running the MCP server standalone (alternative)

Instead of the bundled `/api/mcp` route, you can run the same tool implementations
as their own small service:

```bash
npx tsx mcp-server/index.ts 8787
```

Point Claude's connector at `http://<host>:8787/` instead. Useful if you'd rather
scale/deploy the MCP server independently of the web app.

## Project layout

```
prisma/schema.prisma       Full data model
prisma/seed.ts             Sample data for local dev
src/lib/                   Shared business logic (USD conversion, exposure-rule
                            evaluation, tag search, lineage traversal, AI inference,
                            ticker/keyword matching) — used by both the web API
                            routes and the MCP tools, so behavior stays identical
                            whether you're using the browser or talking to Claude.
src/mcp/server.ts          MCP tool registrations (get_snapshot, add_holding, …)
src/app/api/mcp/route.ts   MCP endpoint (bearer-token gated, stateless)
mcp-server/index.ts        Standalone runner for the same MCP server
src/app/api/**             REST API used by the web UI
src/app/**/page.tsx        Investments / Thoughts / Research / Digest / Tags /
                            Lineage / To-do pages
```

## Notes on scope

- No multi-user support, no login/signup UI.
- No linked brokerage accounts or live/streaming prices — everything enters via
  manual edit or via Claude (MCP tools), and prices/FX rates refresh only on
  request (never a live feed).
- The Lineage/Thread view is explicitly experimental — it's additive over links
  that already exist elsewhere (Insight → Thought → Research → Thought →
  Holding) and safe to ignore if it doesn't earn its place.
