/**
 * Columbus Investment Deals — Backend API
 * ----------------------------------------
 * Express server that:
 *  1. Runs a weekly cron job to fetch fresh deals via Claude AI
 *  2. Caches results in deals.json (or swap for any DB)
 *  3. Serves deals via REST API with CORS for your frontend
 *
 * Setup:
 *   npm install
 *   ANTHROPIC_API_KEY=your_key_here node server.js
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const DEALS_FILE = path.join(__dirname, "deals.json");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY is not set in your environment.");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadDeals() {
  if (!fs.existsSync(DEALS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DEALS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveDeals(data) {
  fs.writeFileSync(DEALS_FILE, JSON.stringify(data, null, 2));
}

// ─── Claude AI Deal Fetcher ───────────────────────────────────────────────────

async function fetchDealsFromClaude() {
  console.log("[Cron] Fetching fresh Columbus deals from Claude AI...");

  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `You are a real estate investment analyst specializing in Columbus, Ohio.
You return ONLY raw JSON — no markdown, no backticks, no explanation.
Your JSON must be valid and parseable with JSON.parse().`;

  const userPrompt = `Today is ${today}. Find the 10 best real estate investment opportunities available right now in Columbus, Ohio.

Include these categories (2 deals each):
1. Duplex+ (multi-family, 2+ units)
2. 1% Rule (monthly rent >= 1% of purchase price)
3. Best Cash Flow (highest monthly cash flow)
4. Turnkey (move-in ready, tenant in place)
5. Fix & Flip (highest projected profit margin)

Return a JSON object with this exact structure:
{
  "updatedAt": "${today}",
  "weekLabel": "Week of [Month Day, Year]",
  "metrics": {
    "avgMonthlyCashFlow": number,
    "avgCapRate": number,
    "totalRentalDeals": number,
    "totalFlipDeals": number
  },
  "deals": [
    {
      "id": number,
      "category": "Duplex+" | "1% Rule" | "Best Cash Flow" | "Turnkey" | "Fix & Flip",
      "hot": boolean,
      "title": string,
      "address": string,
      "neighborhood": string,
      "price": number,
      "monthlyRent": number | null,
      "capRate": number | null,
      "monthlyCashFlow": number | null,
      "cashOnCashROI": number,
      "details": { [key: string]: string },
      "note": string,
      "arv": number | null,
      "rehabCost": number | null,
      "projectedProfit": number | null
    }
  ]
}

Use realistic Columbus, OH addresses and neighborhoods (Linden, Franklinton, Whitehall, Hilliard, OSU corridor, Olde Towne East, Clintonville, Milo-Grogan, etc.).
Use realistic 2025 Columbus market prices and rents.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const rawText = data.content.map((b) => b.text || "").join("");

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  const deals = JSON.parse(cleaned);

  console.log(`[Cron] Fetched ${deals.deals.length} deals. Saving...`);
  saveDeals(deals);
  return deals;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/deals — return cached deals (or generate on first request)
app.get("/api/deals", async (req, res) => {
  let deals = loadDeals();

  if (!deals) {
    try {
      deals = await fetchDealsFromClaude();
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch deals", detail: err.message });
    }
  }

  res.json(deals);
});

// POST /api/deals/refresh — manually trigger a refresh (protect with a secret in production)
app.post("/api/deals/refresh", async (req, res) => {
  const secret = req.headers["x-refresh-secret"];
  if (process.env.REFRESH_SECRET && secret !== process.env.REFRESH_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const deals = await fetchDealsFromClaude();
    res.json({ success: true, dealsCount: deals.deals.length, updatedAt: deals.updatedAt });
  } catch (err) {
    res.status(500).json({ error: "Refresh failed", detail: err.message });
  }
});

// GET /api/deals/health — simple health check
app.get("/api/health", (req, res) => {
  const deals = loadDeals();
  res.json({
    status: "ok",
    lastUpdated: deals?.updatedAt || "never",
    dealCount: deals?.deals?.length || 0,
  });
});

// ─── Weekly Cron Job ──────────────────────────────────────────────────────────
// Runs every Monday at 7:00 AM (adjust timezone as needed)
cron.schedule("0 7 * * 1", async () => {
  console.log("[Cron] Weekly refresh triggered (Monday 7AM)...");
  try {
    await fetchDealsFromClaude();
    console.log("[Cron] Weekly refresh complete.");
  } catch (err) {
    console.error("[Cron] Weekly refresh failed:", err.message);
  }
}, {
  timezone: "America/New_York"
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n Columbus Deals API running on http://localhost:${PORT}`);
  console.log(` Endpoints:`);
  console.log(`   GET  /api/deals           — Get current deals`);
  console.log(`   POST /api/deals/refresh   — Force refresh`);
  console.log(`   GET  /api/health          — Health check`);
  console.log(` Weekly cron: Every Monday at 7:00 AM ET\n`);
});
