import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSnapshot } from "@/lib/snapshot";
import { createThought, searchThoughts } from "@/lib/thoughts";
import { findByTag } from "@/lib/tags";
import { promoteInsightToThought } from "@/lib/promote";
import { resolveAccountId, findHoldingByTickerAndAccount, resolveFxRate } from "@/lib/mcpHelpers";
import { usdValue } from "@/lib/holdings";

const exposureOptionSchema = z.object({
  vehicle: z.string(),
  rationale: z.array(z.string()).min(1),
  accuracyScore: z.number().min(1).max(10),
  derivativeTier: z.number().min(1),
  note: z.string().optional(),
});

const sourceRefSchema = z.object({ title: z.string(), url: z.string().optional() });

/** Builds a fresh McpServer with every tool registered. Called per-request in stateless HTTP mode. */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "finance-tracker", version: "1.0.0" });

  server.registerTool(
    "get_snapshot",
    {
      description:
        "Returns a compact snapshot: accounts, holdings, recent thoughts, research topics, open todos, rules, recent calls, and recent saved insights. " +
        "Call this first in a session to resolve ticker/account ambiguity, avoid duplicate entries, and check digest takeaways against real holdings.",
      inputSchema: {},
    },
    async () => {
      const snapshot = await getSnapshot();
      return { content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }] };
    }
  );

  server.registerTool(
    "add_account",
    {
      description:
        "Add a brokerage/holding account (e.g. 'JP UBS', 'JP IB'). Call this before add_holding if the account doesn't exist yet — " +
        "get_snapshot lists current accounts, and add_holding will error out (listing existing accounts) rather than guess if none match.",
      inputSchema: { name: z.string(), institution: z.string().optional() },
    },
    async (args) => {
      const account = await prisma.account.create({ data: { name: args.name, institution: args.institution ?? null } });
      return { content: [{ type: "text", text: JSON.stringify(account, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_account",
    {
      description:
        "Delete an account, e.g. to clean up an empty duplicate. Prefer accountId when known (get_snapshot lists ids) — " +
        "matching by name alone fails with a list of candidates if more than one account shares that name, since duplicate " +
        "names are exactly the kind of mess this tool gets used to clean up. Refuses if the account still has holdings " +
        "unless confirmCascade is true, which deletes those holdings along with it — only pass that after the person has " +
        "explicitly confirmed they want the holdings gone too.",
      inputSchema: { name: z.string().optional(), accountId: z.number().optional(), confirmCascade: z.boolean().optional() },
    },
    async (args) => {
      let account;
      if (args.accountId) {
        account = await prisma.account.findUnique({ where: { id: args.accountId }, include: { _count: { select: { holdings: true } } } });
        if (!account) throw new Error(`No account with id ${args.accountId}.`);
      } else if (args.name) {
        const matches = await prisma.account.findMany({ where: { name: args.name }, include: { _count: { select: { holdings: true } } } });
        if (matches.length === 0) throw new Error(`No account named "${args.name}" found.`);
        if (matches.length > 1) {
          throw new Error(
            `Multiple accounts named "${args.name}" — specify accountId instead: ` +
              matches.map((m) => `id ${m.id} (${m._count.holdings} holdings, ${m.institution ?? "no institution"})`).join("; ")
          );
        }
        account = matches[0];
      } else {
        throw new Error("Provide either name or accountId.");
      }
      if (account._count.holdings > 0 && !args.confirmCascade) {
        throw new Error(
          `Account "${account.name}" (id ${account.id}) still has ${account._count.holdings} holding(s) — pass confirmCascade: true to delete it and its holdings too.`
        );
      }
      await prisma.account.delete({ where: { id: account.id } });
      return {
        content: [
          {
            type: "text",
            text: `Deleted account "${account.name}" (id ${account.id})${account._count.holdings > 0 ? ` and its ${account._count.holdings} holding(s)` : ""}.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "add_holding",
    {
      description:
        "Add a new holding. Provide the account by name (as shown in get_snapshot) or accountId. " +
        "If currency is not USD and fxRateToUsd isn't supplied, the server will look up the current rate via web_search rather than assuming 1:1.",
      inputSchema: {
        ticker: z.string(),
        name: z.string(),
        category: z.string(),
        sector: z.string(),
        geography: z.string(),
        geographyBreakdown: z.array(z.object({ region: z.string(), weight: z.number() })).optional(),
        account: z.string().optional(),
        accountId: z.number().optional(),
        tags: z.array(z.string()).optional(),
        quantity: z.number(),
        currency: z.string().default("USD"),
        price: z.number(),
        fxRateToUsd: z.number().optional(),
        costBasis: z.number().optional(),
        notes: z.string().optional(),
      },
    },
    async (args) => {
      const accountId = await resolveAccountId(args.account, args.accountId);
      const fxRateToUsd = await resolveFxRate(args.currency ?? "USD", args.fxRateToUsd);
      const holding = await prisma.holding.create({
        data: {
          ticker: args.ticker.toUpperCase(),
          name: args.name,
          category: args.category,
          sector: args.sector,
          geography: args.geography,
          geographyBreakdown: args.geographyBreakdown,
          accountId,
          tags: args.tags ?? [],
          quantity: args.quantity,
          currency: args.currency ?? "USD",
          price: args.price,
          fxRateToUsd,
          costBasis: args.costBasis,
          notes: args.notes,
        },
      });
      return { content: [{ type: "text", text: JSON.stringify({ ...holding, usdValue: usdValue(holding) }, null, 2) }] };
    }
  );

  server.registerTool(
    "update_holding",
    {
      description: "Update an existing holding, matched by ticker + account (both required to disambiguate the same ticker across accounts).",
      inputSchema: {
        ticker: z.string(),
        account: z.string().optional(),
        accountId: z.number().optional(),
        updates: z.object({
          name: z.string().optional(),
          category: z.string().optional(),
          sector: z.string().optional(),
          geography: z.string().optional(),
          geographyBreakdown: z.array(z.object({ region: z.string(), weight: z.number() })).optional(),
          tags: z.array(z.string()).optional(),
          quantity: z.number().optional(),
          currency: z.string().optional(),
          price: z.number().optional(),
          fxRateToUsd: z.number().optional(),
          costBasis: z.number().optional(),
          notes: z.string().optional(),
        }),
      },
    },
    async (args) => {
      const existing = await findHoldingByTickerAndAccount(args.ticker, args.account, args.accountId);
      const holding = await prisma.holding.update({ where: { id: existing.id }, data: args.updates });
      return { content: [{ type: "text", text: JSON.stringify({ ...holding, usdValue: usdValue(holding) }, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_holding",
    {
      description: "Delete a holding, matched by ticker + account.",
      inputSchema: { ticker: z.string(), account: z.string().optional(), accountId: z.number().optional() },
    },
    async (args) => {
      const existing = await findHoldingByTickerAndAccount(args.ticker, args.account, args.accountId);
      await prisma.holding.delete({ where: { id: existing.id } });
      return { content: [{ type: "text", text: `Deleted ${existing.ticker} from account ${existing.accountId}.` }] };
    }
  );

  server.registerTool(
    "delete_all_holdings",
    {
      description: "Deletes every holding in the portfolio. Irreversible — only call this after the person has explicitly confirmed.",
      inputSchema: { confirm: z.boolean() },
    },
    async (args) => {
      if (!args.confirm) return { content: [{ type: "text", text: "Not deleted — confirm must be true." }], isError: true };
      const { count } = await prisma.holding.deleteMany({});
      return { content: [{ type: "text", text: `Deleted ${count} holdings.` }] };
    }
  );

  server.registerTool(
    "add_thought",
    {
      description:
        "Log a dated entry in the running Thoughts journal. Text is the only required input. Sentiment is always inferred server-side " +
        "unless you pass it. Tags are inferred only if you don't supply any. Related tickers are resolved locally against current holdings; " +
        "if the text implies a ticker that ISN'T currently held, search for its real price yourself and pass it via relatedTickerOverrides " +
        "rather than guessing.",
      inputSchema: {
        text: z.string(),
        date: z.string().optional(),
        tags: z.array(z.string()).optional(),
        sentiment: z.enum(["bullish", "bearish", "neutral"]).optional(),
        relatedHoldingIds: z.array(z.number()).optional(),
        linkedResearchId: z.number().optional(),
        relatedTickerOverrides: z.array(z.object({ ticker: z.string(), price: z.number(), currency: z.string().optional() })).optional(),
      },
    },
    async (args) => {
      const thought = await createThought(args);
      return { content: [{ type: "text", text: JSON.stringify(thought, null, 2) }] };
    }
  );

  server.registerTool(
    "search_thoughts",
    {
      description: "Filter the Thoughts log by date range, tag, or keyword — for questions that need history beyond get_snapshot's recent-20 summary.",
      inputSchema: {
        tag: z.string().optional(),
        keyword: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      },
    },
    async (args) => {
      const thoughts = await searchThoughts(args);
      return { content: [{ type: "text", text: JSON.stringify(thoughts, null, 2) }] };
    }
  );

  server.registerTool(
    "search_by_tag",
    {
      description: "Returns everything across all modules (holdings, thoughts, research, digest sources/insights, calls) carrying a given tag, grouped by module.",
      inputSchema: { tag: z.string() },
    },
    async (args) => {
      const results = await findByTag(args.tag);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.registerTool(
    "add_research_entry",
    {
      description:
        "Store a full research entry after doing real research (multiple searches, genuine pros/cons reasoning). " +
        "Call get_snapshot first to populate existingExposure accurately. exposureOptions must include several Tier-1 candidates " +
        "plus genuine Tier-2/3 candidates where the causal chain holds up — reasoning about downstream tiers without shipping them here is incomplete.",
      inputSchema: {
        topic: z.string(),
        thesisStatement: z.string(),
        date: z.string().optional(),
        summary: z.string(),
        suggestion: z.enum(["worth a closer look", "keep watching", "pass for now"]),
        deepDive: z.string(),
        exposureOptions: z.array(exposureOptionSchema),
        existingExposure: z.object({ summary: z.string(), holdingIds: z.array(z.number()) }).optional(),
        tags: z.array(z.string()).optional(),
        linkedThoughtId: z.number().optional(),
        sources: z.array(sourceRefSchema).optional(),
      },
    },
    async (args) => {
      const research = await prisma.research.create({
        data: {
          topic: args.topic,
          thesisStatement: args.thesisStatement,
          date: args.date ? new Date(args.date) : new Date(),
          summary: args.summary,
          suggestion: args.suggestion,
          deepDive: args.deepDive,
          exposureOptions: args.exposureOptions,
          existingExposure: args.existingExposure,
          tags: args.tags ?? [],
          linkedThoughtId: args.linkedThoughtId,
          sources: args.sources ?? [],
        },
      });
      return { content: [{ type: "text", text: JSON.stringify(research, null, 2) }] };
    }
  );

  server.registerTool(
    "add_todo",
    {
      description: "Add a to-do item.",
      inputSchema: { text: z.string(), type: z.enum(["action", "research", "decision", "untagged"]).optional() },
    },
    async (args) => {
      const todo = await prisma.todo.create({ data: { text: args.text, type: args.type ?? "untagged" } });
      return { content: [{ type: "text", text: JSON.stringify(todo, null, 2) }] };
    }
  );

  server.registerTool(
    "complete_todo",
    { description: "Mark a to-do as done.", inputSchema: { id: z.number() } },
    async (args) => {
      const todo = await prisma.todo.update({ where: { id: args.id }, data: { done: true } });
      return { content: [{ type: "text", text: JSON.stringify(todo, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_todo",
    { description: "Delete a to-do.", inputSchema: { id: z.number() } },
    async (args) => {
      await prisma.todo.delete({ where: { id: args.id } });
      return { content: [{ type: "text", text: "Deleted." }] };
    }
  );

  server.registerTool(
    "add_rule",
    {
      description:
        "Add an exposure rule (auto-computed, no search needed — metric/target/operator/threshold) or a price rule " +
        "(checked on-demand via web search — ticker/description).",
      inputSchema: {
        ruleType: z.enum(["exposure", "price"]),
        label: z.string(),
        metric: z.enum(["holding", "category", "sector", "geography", "tag"]).optional(),
        target: z.string().optional(),
        operator: z.enum(["max", "min"]).optional(),
        threshold: z.number().optional(),
        ticker: z.string().optional(),
        description: z.string().optional(),
      },
    },
    async (args) => {
      const rule = await prisma.rule.create({
        data:
          args.ruleType === "exposure"
            ? { ruleType: "exposure", label: args.label, metric: args.metric, target: args.target, operator: args.operator, threshold: args.threshold }
            : { ruleType: "price", label: args.label, ticker: args.ticker?.toUpperCase(), description: args.description },
      });
      return { content: [{ type: "text", text: JSON.stringify(rule, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_rule",
    { description: "Delete a rule.", inputSchema: { id: z.number() } },
    async (args) => {
      await prisma.rule.delete({ where: { id: args.id } });
      return { content: [{ type: "text", text: "Deleted." }] };
    }
  );

  server.registerTool(
    "update_rule_status",
    {
      description: "Update a price rule's status after checking it (e.g. via web_search).",
      inputSchema: {
        id: z.number(),
        status: z.enum(["ok", "triggered"]),
        note: z.string().optional(),
      },
    },
    async (args) => {
      const rule = await prisma.rule.update({
        where: { id: args.id },
        data: { lastStatus: args.status, lastNote: args.note, lastChecked: new Date() },
      });
      return { content: [{ type: "text", text: JSON.stringify(rule, null, 2) }] };
    }
  );

  server.registerTool(
    "add_digest_source",
    {
      description:
        "Log a digest source (podcast/video/article). `date` should be the content's real publish/recording date, not today — " +
        "date_logged is always set to today automatically. Aim for 5 key takeaways written for a long-term investor.",
      inputSchema: {
        title: z.string(),
        speaker: z.string().optional(),
        sourceType: z.enum(["podcast", "video", "article"]),
        url: z.string().optional(),
        date: z.string(),
        keyTakeaways: z.array(z.string()),
        actionItems: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      const source = await prisma.digestSource.create({
        data: {
          title: args.title,
          speaker: args.speaker,
          sourceType: args.sourceType,
          url: args.url,
          date: new Date(args.date),
          dateLogged: new Date(),
          keyTakeaways: args.keyTakeaways,
          actionItems: args.actionItems ?? [],
          tags: args.tags ?? [],
        },
      });
      return { content: [{ type: "text", text: JSON.stringify(source, null, 2) }] };
    }
  );

  server.registerTool(
    "add_digest_synthesis",
    {
      description: "Log a weekly digest synthesis. consensusBullets/newOrContrarianBullets/actionItems are each capped at 3 — never pad to hit a count.",
      inputSchema: {
        weekOf: z.string(),
        keyTakeaways: z.array(z.string()),
        consensusBullets: z.array(z.string()).max(3).optional(),
        newOrContrarianBullets: z.array(z.string()).max(3).optional(),
        actionItems: z.array(z.string()).max(3).optional(),
        sourceIds: z.array(z.number()).optional(),
        tags: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      const synthesis = await prisma.digestSynthesis.create({
        data: {
          weekOf: new Date(args.weekOf),
          keyTakeaways: args.keyTakeaways,
          consensusBullets: args.consensusBullets ?? [],
          newOrContrarianBullets: args.newOrContrarianBullets ?? [],
          actionItems: args.actionItems ?? [],
          sourceIds: args.sourceIds ?? [],
          tags: args.tags ?? [],
        },
      });
      return { content: [{ type: "text", text: JSON.stringify(synthesis, null, 2) }] };
    }
  );

  server.registerTool(
    "add_call",
    {
      description:
        "Log a checkable prediction, either origin_type='digest' (from a source) or origin_type='self' (from the person's own Thought — " +
        "offer this when a thought contains a clear, specific, checkable prediction, not for every thought). Never set outcome at creation time.",
      inputSchema: {
        originType: z.enum(["digest", "self"]),
        digestSourceId: z.number().optional(),
        thoughtId: z.number().optional(),
        speaker: z.string(),
        subject: z.string(),
        direction: z.string(),
        description: z.string(),
        timeframe: z.string(),
        dateMade: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      const call = await prisma.call.create({
        data: {
          originType: args.originType,
          digestSourceId: args.digestSourceId,
          thoughtId: args.thoughtId,
          speaker: args.speaker,
          subject: args.subject,
          direction: args.direction,
          description: args.description,
          timeframe: args.timeframe,
          dateMade: args.dateMade ? new Date(args.dateMade) : new Date(),
          tags: args.tags ?? [],
        },
      });
      return { content: [{ type: "text", text: JSON.stringify(call, null, 2) }] };
    }
  );

  server.registerTool(
    "update_call_outcome",
    {
      description: "Set the outcome on an existing call when revisiting it later.",
      inputSchema: {
        id: z.number(),
        outcome: z.enum(["correct", "incorrect", "mixed", "too-early-to-tell"]),
        outcomeNote: z.string().optional(),
      },
    },
    async (args) => {
      const call = await prisma.call.update({
        where: { id: args.id },
        data: { outcome: args.outcome, outcomeNote: args.outcomeNote, outcomeReviewedAt: new Date() },
      });
      return { content: [{ type: "text", text: JSON.stringify(call, null, 2) }] };
    }
  );

  server.registerTool(
    "add_insight",
    {
      description: "Save a point worth remembering. sourceId is optional — standalone insights are fine.",
      inputSchema: {
        text: z.string(),
        sourceId: z.number().optional(),
        note: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      const insight = await prisma.insight.create({
        data: { text: args.text, sourceId: args.sourceId, note: args.note, tags: args.tags ?? [] },
      });
      return { content: [{ type: "text", text: JSON.stringify(insight, null, 2) }] };
    }
  );

  server.registerTool(
    "promote_insight_to_thought",
    {
      description: "Create a new Thought entry from an existing insight's text, and link them. The insight itself is kept, not deleted.",
      inputSchema: { insightId: z.number() },
    },
    async (args) => {
      const thought = await promoteInsightToThought(args.insightId);
      return { content: [{ type: "text", text: JSON.stringify(thought, null, 2) }] };
    }
  );

  return server;
}
