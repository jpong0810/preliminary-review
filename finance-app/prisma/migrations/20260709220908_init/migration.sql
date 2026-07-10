-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('exposure', 'price');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('bullish', 'bearish', 'neutral');

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" SERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "geography_breakdown" JSONB,
    "account_id" INTEGER NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quantity" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "price" DOUBLE PRECISION NOT NULL,
    "fx_rate_to_usd" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "cost_basis" DOUBLE PRECISION,
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" SERIAL NOT NULL,
    "rule_type" "RuleType" NOT NULL,
    "label" TEXT NOT NULL,
    "metric" TEXT,
    "target" TEXT,
    "operator" TEXT,
    "threshold" DOUBLE PRECISION,
    "ticker" TEXT,
    "description" TEXT,
    "last_status" TEXT,
    "last_checked" TIMESTAMP(3),
    "last_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thoughts" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentiment" "Sentiment" NOT NULL DEFAULT 'neutral',
    "related_tickers" JSONB,
    "linked_research_id" INTEGER,
    "related_holding_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thoughts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_entries" (
    "id" SERIAL NOT NULL,
    "topic" TEXT NOT NULL,
    "thesis_statement" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "deep_dive" TEXT NOT NULL,
    "exposure_options" JSONB NOT NULL DEFAULT '[]',
    "existing_exposure" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linked_thought_id" INTEGER,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digest_sources" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "speaker" TEXT,
    "source_type" TEXT NOT NULL,
    "url" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "date_logged" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "key_takeaways" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "action_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digest_syntheses" (
    "id" SERIAL NOT NULL,
    "week_of" TIMESTAMP(3) NOT NULL,
    "key_takeaways" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consensus_bullets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "new_or_contrarian_bullets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "action_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_syntheses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" SERIAL NOT NULL,
    "origin_type" TEXT NOT NULL,
    "digest_source_id" INTEGER,
    "thought_id" INTEGER,
    "speaker" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "date_made" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT,
    "outcome_note" TEXT,
    "outcome_reviewed_at" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER,
    "text" TEXT NOT NULL,
    "note" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linked_thought_id" INTEGER,
    "date_saved" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todos" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'untagged',
    "done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ThoughtHoldings" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "holdings_ticker_idx" ON "holdings"("ticker");

-- CreateIndex
CREATE INDEX "holdings_account_id_idx" ON "holdings"("account_id");

-- CreateIndex
CREATE INDEX "thoughts_date_idx" ON "thoughts"("date");

-- CreateIndex
CREATE INDEX "digest_sources_date_logged_idx" ON "digest_sources"("date_logged");

-- CreateIndex
CREATE INDEX "digest_syntheses_week_of_idx" ON "digest_syntheses"("week_of");

-- CreateIndex
CREATE INDEX "calls_speaker_idx" ON "calls"("speaker");

-- CreateIndex
CREATE UNIQUE INDEX "_ThoughtHoldings_AB_unique" ON "_ThoughtHoldings"("A", "B");

-- CreateIndex
CREATE INDEX "_ThoughtHoldings_B_index" ON "_ThoughtHoldings"("B");

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thoughts" ADD CONSTRAINT "thoughts_linked_research_id_fkey" FOREIGN KEY ("linked_research_id") REFERENCES "research_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_entries" ADD CONSTRAINT "research_entries_linked_thought_id_fkey" FOREIGN KEY ("linked_thought_id") REFERENCES "thoughts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_digest_source_id_fkey" FOREIGN KEY ("digest_source_id") REFERENCES "digest_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_thought_id_fkey" FOREIGN KEY ("thought_id") REFERENCES "thoughts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "digest_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_linked_thought_id_fkey" FOREIGN KEY ("linked_thought_id") REFERENCES "thoughts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ThoughtHoldings" ADD CONSTRAINT "_ThoughtHoldings_A_fkey" FOREIGN KEY ("A") REFERENCES "holdings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ThoughtHoldings" ADD CONSTRAINT "_ThoughtHoldings_B_fkey" FOREIGN KEY ("B") REFERENCES "thoughts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
