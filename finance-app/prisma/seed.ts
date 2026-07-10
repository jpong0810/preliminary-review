import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.call.deleteMany(),
    prisma.insight.deleteMany(),
    prisma.digestSynthesis.deleteMany(),
    prisma.digestSource.deleteMany(),
    prisma.thought.deleteMany(),
    prisma.research.deleteMany(),
    prisma.rule.deleteMany(),
    prisma.todo.deleteMany(),
    prisma.holding.deleteMany(),
    prisma.account.deleteMany(),
  ]);

  const ubs = await prisma.account.create({ data: { name: "JP UBS", institution: "UBS" } });
  const ib = await prisma.account.create({ data: { name: "JP IB", institution: "Interactive Brokers" } });

  const smh = await prisma.holding.create({
    data: {
      ticker: "SMH",
      name: "VanEck Semiconductor ETF",
      category: "ETF",
      sector: "Technology",
      geography: "Global",
      geographyBreakdown: [
        { region: "US", weight: 75 },
        { region: "Asia", weight: 20 },
        { region: "Europe", weight: 5 },
      ],
      accountId: ib.id,
      tags: ["AI", "semis", "asset-heavy"],
      quantity: 40,
      currency: "USD",
      price: 285.4,
      fxRateToUsd: 1,
      costBasis: 210.0,
      notes: "Pure-play semiconductor exposure, thesis: AI compute buildout.",
    },
  });

  const nbis = await prisma.holding.create({
    data: {
      ticker: "NBIS",
      name: "Nebius Group",
      category: "Stock",
      sector: "Technology",
      geography: "Europe",
      accountId: ib.id,
      tags: ["AI", "neocloud"],
      quantity: 150,
      currency: "USD",
      price: 42.1,
      fxRateToUsd: 1,
      costBasis: 38.5,
      notes: "Open-source-friendly neocloud, added after open-source-AI research entry.",
    },
  });

  await prisma.holding.create({
    data: {
      ticker: "0700.HK",
      name: "Tencent Holdings",
      category: "Stock",
      sector: "Communication Services",
      geography: "Asia",
      accountId: ubs.id,
      tags: ["china", "gaming"],
      quantity: 200,
      currency: "HKD",
      price: 380.5,
      fxRateToUsd: 0.128,
      costBasis: 310.0,
      notes: "",
    },
  });

  await prisma.holding.create({
    data: {
      ticker: "SPY",
      name: "SPDR S&P 500 ETF",
      category: "ETF",
      sector: "Broad Market",
      geography: "US",
      accountId: ib.id,
      tags: ["core"],
      quantity: 60,
      currency: "USD",
      price: 746.77,
      fxRateToUsd: 1,
      costBasis: 620.0,
      notes: "Core position.",
    },
  });

  await prisma.holding.create({
    data: {
      ticker: "CASH",
      name: "Cash",
      category: "Cash",
      sector: "Cash",
      geography: "US",
      accountId: ubs.id,
      tags: [],
      quantity: 1,
      currency: "USD",
      price: 85000,
      fxRateToUsd: 1,
      notes: "",
    },
  });

  await prisma.rule.create({
    data: {
      ruleType: "exposure",
      label: "No single holding over 30%",
      metric: "holding",
      target: "SMH",
      operator: "max",
      threshold: 30,
    },
  });
  await prisma.rule.create({
    data: {
      ruleType: "exposure",
      label: "Tech sector under 50%",
      metric: "sector",
      target: "Technology",
      operator: "max",
      threshold: 50,
    },
  });
  await prisma.rule.create({
    data: {
      ruleType: "price",
      label: "SMH pullback watch",
      ticker: "SMH",
      description: "Flag if down more than 5% from its 3-month high",
    },
  });

  const source = await prisma.digestSource.create({
    data: {
      title: "AI's next stress test",
      speaker: "Morgan Stanley",
      sourceType: "article",
      url: "https://example.com/ai-stress-test",
      date: new Date("2026-07-06"),
      dateLogged: new Date("2026-07-07"),
      keyTakeaways: [
        "Token economics ratio (cost per token vs revenue per token) is emerging as a repeatable checkpoint for AI infra durability.",
        "Capex guidance from hyperscalers still trending up despite margin questions.",
        "Open-source model quality gap to closed frontier models continues to narrow.",
        "Power availability, not chip supply, is becoming the binding constraint for new data centers.",
        "Enterprise AI adoption is broadening beyond pilots into core workflows.",
      ],
      actionItems: ["3 sources flagged semiconductor demand durability this week — you hold SMH, worth a look."],
      tags: ["AI", "semis", "infrastructure"],
    },
  });

  await prisma.insight.create({
    data: {
      sourceId: source.id,
      text: "Token economics ratio is a good repeatable checkpoint for whether AI infra spend is actually being justified by revenue.",
      note: "Worth tracking quarterly across the hyperscalers.",
      tags: ["AI", "infrastructure"],
      dateSaved: new Date("2026-07-07"),
    },
  });

  const research = await prisma.research.create({
    data: {
      topic: "Open-source AI vs closed models",
      thesisStatement: "Open source AI models will catch up to closed models and take significant market share.",
      date: new Date("2026-07-09"),
      summary: "Open-weight models are closing the quality gap fast; the winners may be the neoclouds and infra that serve them cheaply, not just the model labs themselves.",
      suggestion: "worth a closer look",
      deepDive:
        "## Bull case\n\nOpen-weight models (Llama, Qwen, DeepSeek-class) have closed most of the benchmark gap with closed frontier models over the last 18 months, while costing a fraction to run. If this trend holds, enterprises have strong incentive to self-host or use cheaper open-weight-serving infra rather than pay closed-model API premiums for commodity tasks.\n\n## Bear case / risks\n\nClosed labs keep re-opening the gap at the frontier (reasoning, agentic tasks); enterprises may still pay for reliability/support bundles rather than raw model quality. Regulatory/export dynamics around Chinese open-weight models add geopolitical risk to some of the highest-quality open options.\n\n## Key uncertainties\n\n- Whether frontier capability gap re-widens with next-gen closed releases\n- Whether the Jevons paradox holds (cheaper inference -> more total usage -> more infra demand) or whether it nets out to lower total spend\n\n## What would need to be true\n\nOpen-weight quality needs to stay 'good enough' for the majority of enterprise use cases, and serving infrastructure needs to keep getting cheaper per token.",
      exposureOptions: [
        {
          vehicle: "NBIS (Nebius Group)",
          rationale: [
            "Neocloud built specifically to serve GPU compute cheaply, including for open-weight model workloads",
            "Revenue is directly tied to inference/training demand volume, not model licensing",
            "Smaller/newer than hyperscalers, so thesis exposure isn't diluted by unrelated business lines",
            "Risk: still capital-intensive and dependent on continued GPU access/financing",
          ],
          accuracyScore: 7,
          derivativeTier: 1,
        },
        {
          vehicle: "SMH (VanEck Semiconductor ETF)",
          rationale: [
            "Broad basket capturing the chip demand that any AI usage growth (open or closed) drives",
            "Diversified across the full compute stack, so it isn't a bet on any single model paradigm winning",
            "Diluted by non-AI semiconductor demand (auto, industrial) which caps how directly it tracks the thesis",
          ],
          accuracyScore: 5,
          derivativeTier: 1,
        },
        {
          vehicle: "Vistra / power & grid utilities",
          rationale: [
            "If cheaper open models drive more total inference volume (Jevons paradox), total data center power draw rises regardless of which model paradigm wins",
            "Grid capacity is already the binding constraint cited by multiple sources this week, ahead of chip supply",
            "Indirect: revenue depends on broad data center buildout, not this thesis specifically, which caps the score",
          ],
          accuracyScore: 4,
          derivativeTier: 2,
        },
        {
          vehicle: "Grid equipment / transformer manufacturers",
          rationale: [
            "One more link down the chain: more data centers requires more transformers and grid hardware",
            "Currently supply-constrained, giving pricing power if buildout continues",
          ],
          accuracyScore: 3,
          derivativeTier: 3,
        },
      ],
      existingExposure: {
        summary: "Already hold SMH (broad semis) and NBIS (direct neocloud pure-play) — the Tier 1 exposure is largely already in place.",
        holdingIds: [smh.id, nbis.id],
      },
      tags: ["AI", "semis", "infrastructure"],
      sources: [{ title: "AI's next stress test", url: "https://example.com/ai-stress-test" }],
    },
  });

  const t1 = await prisma.thought.create({
    data: {
      date: new Date("2026-06-22"),
      text: "I think we buy after a big dip, Trump unlikely to hold out for a long war with Iran.",
      tags: ["iran", "macro"],
      sentiment: "bullish",
    },
  });

  await prisma.call.create({
    data: {
      originType: "self",
      thoughtId: t1.id,
      speaker: "me",
      subject: "S&P 500 / broad market",
      direction: "buy the dip",
      description: "Expects a geopolitical-driven dip to reverse quickly; buying the dip rather than de-risking.",
      timeframe: "short-term",
      dateMade: new Date("2026-06-22"),
      tags: ["iran", "macro"],
    },
  });

  await prisma.thought.create({
    data: {
      date: new Date("2026-06-25"),
      text: "Things look expensive again, maybe stay away from adding more broad market exposure for now.",
      tags: ["valuation"],
      sentiment: "bearish",
      relatedTickers: [{ ticker: "SPY", price: 746.77 }],
    },
  });

  const t2 = await prisma.thought.create({
    data: {
      date: new Date("2026-07-09"),
      text: "NBIS is the cleanest way to get pure-play exposure to the open-source AI thesis — cheaper compute serving should keep winning share.",
      tags: ["AI", "semis"],
      sentiment: "bullish",
      relatedTickers: [{ ticker: "NBIS", price: 42.1 }],
      linkedResearchId: research.id,
      relatedHoldingIds: [nbis.id],
    },
  });

  await prisma.research.update({ where: { id: research.id }, data: { linkedThoughtId: t2.id } });

  await prisma.digestSynthesis.create({
    data: {
      weekOf: new Date("2026-07-06"),
      keyTakeaways: [
        "Token economics is becoming the key lens for judging whether AI infra capex is justified.",
        "Power/grid capacity, not chip supply, is the more binding constraint on new data center buildout.",
        "Open-weight model quality continues to narrow the gap with closed frontier labs.",
        "Enterprise AI usage is broadening past pilots into core workflows, supporting continued infra demand.",
        "Semiconductor demand durability was flagged across multiple sources this week.",
      ],
      consensusBullets: ["Both Morgan Stanley and two other sources this week agreed grid/power capacity is now the binding constraint, not chips."],
      newOrContrarianBullets: ["One source argued the Jevons paradox means cheaper inference INCREASES total compute demand rather than shrinking capex — worth tracking against consensus 'AI capex is peaking' narratives."],
      actionItems: ["3 sources flagged semiconductor demand durability this week — you hold SMH, worth a look."],
      sourceIds: [source.id],
      tags: ["AI", "semis", "infrastructure"],
    },
  });

  await prisma.todo.createMany({
    data: [
      { text: "Review SMH position size vs 30% single-holding rule", type: "decision" },
      { text: "Dig into grid/transformer pure-plays for Tier 3 exposure", type: "research" },
      { text: "Set a price alert for NBIS", type: "action" },
    ],
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
