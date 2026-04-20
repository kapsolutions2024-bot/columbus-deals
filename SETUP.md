# Columbus Investment Deals — Setup Guide

## What This System Does

Every Monday at 7:00 AM ET, your server automatically:
1. Calls Claude AI with a prompt asking for the top 10 Columbus investment deals
2. Claude returns structured JSON with realistic deals across 5 categories
3. The JSON is cached to `deals.json` (or your database)
4. Your website fetches from `/api/deals` and renders the dashboard

---

## Quick Start

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

npm install
node server.js
```

The API will be live at `http://localhost:3001`.

**Test it:**
```bash
# Get deals (auto-generates on first call)
curl http://localhost:3001/api/deals

# Force a manual refresh
curl -X POST http://localhost:3001/api/deals/refresh

# Health check
curl http://localhost:3001/api/health
```

---

### 2. Frontend Setup

Copy `ColumbusDeals.jsx` into your React project:

```jsx
// In your page component:
import ColumbusDeals from './ColumbusDeals';

export default function InvestmentsPage() {
  return (
    <main>
      <ColumbusDeals apiUrl="https://your-api-domain.com" />
    </main>
  );
}
```

---

## Deployment Options

### Option A: Railway (Easiest — $5/mo)
```bash
# Install Railway CLI
npm install -g @railway/cli

cd backend
railway login
railway init
railway up

# Set env vars in Railway dashboard:
# ANTHROPIC_API_KEY=sk-ant-...
# REFRESH_SECRET=your-secret
```

### Option B: Render (Free tier available)
1. Push your `backend/` folder to GitHub
2. Create a new Web Service on render.com
3. Set build command: `npm install`
4. Set start command: `node server.js`
5. Add env vars in the Render dashboard

### Option C: VPS / DigitalOcean
```bash
# On your server:
git clone your-repo
cd backend
npm install
cp .env.example .env && nano .env

# Run with PM2 (keeps it alive forever)
npm install -g pm2
pm2 start server.js --name columbus-deals
pm2 save
pm2 startup
```

---

## Weekly Cron Schedule

The cron is built into `server.js` using `node-cron`.  
Default: **Every Monday at 7:00 AM Eastern**.

To change it, edit this line in `server.js`:
```js
cron.schedule("0 7 * * 1", ...) 
//             │ │ │ │ └── Day of week (1 = Monday)
//             │ │ │ └──── Month (*)
//             │ │ └────── Day of month (*)
//             │ └──────── Hour (7 = 7AM)
//             └────────── Minute (0)
```

Examples:
- Every Sunday at midnight: `"0 0 * * 0"`
- Every day at 6 AM: `"0 6 * * *"`
- Twice a week (Mon + Thu 8AM): `"0 8 * * 1,4"`

---

## Customizing the AI Prompt

The deal-generation prompt is in `server.js` inside `fetchDealsFromClaude()`.

**To change categories**, edit the `userPrompt` variable:
```js
// Example: Add "Section 8 Friendly" as a category
"5. Section 8 Friendly (approved for housing vouchers)"
```

**To focus on specific neighborhoods**:
```js
// Add to the prompt:
"Focus only on: Short North, Italian Village, German Village, and Arena District."
```

**To adjust deal count**:
```js
// Change "10 best" to however many you want:
"Find the 20 best real estate investment opportunities..."
// And update the JSON schema: "2 deals each" → "4 deals each"
```

---

## Swapping the JSON Cache for a Database

The default setup saves deals to `deals.json`. For production, replace the
`loadDeals()` and `saveDeals()` functions with your DB of choice:

### PostgreSQL (with pg)
```js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function loadDeals() {
  const { rows } = await pool.query('SELECT data FROM deals ORDER BY created_at DESC LIMIT 1');
  return rows[0]?.data || null;
}

async function saveDeals(data) {
  await pool.query('INSERT INTO deals (data, created_at) VALUES ($1, NOW())', [JSON.stringify(data)]);
}
```

### MongoDB (with mongoose)
```js
const Deal = mongoose.model('Deal', new Schema({ data: Object, createdAt: Date }));

async function loadDeals() {
  const doc = await Deal.findOne().sort({ createdAt: -1 });
  return doc?.data || null;
}

async function saveDeals(data) {
  await Deal.create({ data, createdAt: new Date() });
}
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deals` | Returns current cached deals |
| POST | `/api/deals/refresh` | Forces a fresh Claude AI call |
| GET | `/api/health` | Returns status + last updated time |

### `GET /api/deals` Response Shape
```json
{
  "updatedAt": "2025-04-20",
  "weekLabel": "Week of April 20, 2025",
  "metrics": {
    "avgMonthlyCashFlow": 680,
    "avgCapRate": 7.8,
    "totalRentalDeals": 8,
    "totalFlipDeals": 2
  },
  "deals": [
    {
      "id": 1,
      "category": "Duplex+",
      "hot": true,
      "title": "East Side Duplex — 2 Units",
      "address": "123 Oak St, Columbus OH 43203",
      "neighborhood": "Milo-Grogan",
      "price": 189000,
      "monthlyRent": 2100,
      "capRate": 8.4,
      "monthlyCashFlow": 610,
      "cashOnCashROI": 14.2,
      "details": { "Units": "2", "Sq Ft": "1,840" },
      "note": "Strong 1.1% rent-to-price ratio.",
      "arv": null,
      "rehabCost": null,
      "projectedProfit": null
    }
  ]
}
```

---

## Cost Estimate

Each weekly Claude API call uses ~2,000–3,000 tokens.  
At current Sonnet pricing (~$3/million input tokens), that's roughly **$0.01 per week** — about $0.52/year.

---

## Questions / Issues

- Claude returning non-JSON? The prompt includes a strict instruction. If it happens, check `server.js` — the `cleaned` variable strips markdown fences before parsing.
- CORS errors? Update the `cors()` config in `server.js` to whitelist your domain.
- Cron not firing? Make sure your server process stays alive (use PM2 or a managed host).
