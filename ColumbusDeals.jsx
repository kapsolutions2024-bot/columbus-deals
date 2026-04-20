/**
 * ColumbusDeals.jsx
 * ------------------
 * Drop-in React component for your website.
 * Fetches live data from your backend API and renders
 * the full Columbus investment dashboard.
 *
 * Usage:
 *   import ColumbusDeals from './ColumbusDeals';
 *   <ColumbusDeals apiUrl="https://your-api.com" />
 */

import { useState, useEffect, useCallback } from "react";

const API_URL = "http://localhost:3001"; // Replace with your deployed API URL

const TYPE_COLORS = {
  "Duplex+":        { bg: "#E6F1FB", text: "#0C447C" },
  "1% Rule":        { bg: "#EAF3DE", text: "#27500A" },
  "Best Cash Flow": { bg: "#FAEEDA", text: "#633806" },
  "Turnkey":        { bg: "#EEEDFE", text: "#3C3489" },
  "Fix & Flip":     { bg: "#FAECE7", text: "#712B13" },
};

const CATEGORIES = ["All", "Duplex+", "1% Rule", "Best Cash Flow", "Turnkey", "Fix & Flip"];

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }) {
  return (
    <div style={{
      background: "var(--color-background-secondary, #f5f5f3)",
      borderRadius: 8, padding: "14px 16px",
    }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#4caf50", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function CategoryBadge({ category }) {
  const c = TYPE_COLORS[category] || { bg: "#eee", text: "#333" };
  return (
    <span style={{
      background: c.bg, color: c.text,
      fontSize: 11, fontWeight: 500,
      padding: "3px 8px", borderRadius: 6,
      display: "inline-block",
    }}>
      {category}
    </span>
  );
}

function DealCard({ deal }) {
  const isFlip = deal.category === "Fix & Flip";
  const cfColor = deal.monthlyCashFlow > 700 ? "#2e7d32" : "#e65100";

  return (
    <div style={{
      background: "#fff",
      border: deal.hot ? "2px solid #1976d2" : "0.5px solid rgba(0,0,0,0.12)",
      borderRadius: 12,
      padding: "1rem 1.25rem",
      display: "flex", flexDirection: "column", gap: 0,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <CategoryBadge category={deal.category} />
        {deal.hot && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            background: "#FCEBEB", color: "#791F1F",
            padding: "2px 8px", borderRadius: 6,
          }}>HOT DEAL</span>
        )}
      </div>

      <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 2 }}>{deal.title}</div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>{deal.address}</div>

      {/* Detail rows */}
      {Object.entries(deal.details).map(([k, v]) => (
        <div key={k} style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 13, padding: "5px 0",
          borderBottom: "0.5px solid rgba(0,0,0,0.07)",
        }}>
          <span style={{ color: "#777" }}>{k}</span>
          <span style={{ fontWeight: 500 }}>{v}</span>
        </div>
      ))}

      {/* Core metrics */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: "0.5px solid rgba(0,0,0,0.07)" }}>
        <span style={{ color: "#777" }}>Price</span>
        <span style={{ fontWeight: 500 }}>${deal.price.toLocaleString()}</span>
      </div>

      {!isFlip && deal.monthlyCashFlow && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: "0.5px solid rgba(0,0,0,0.07)" }}>
          <span style={{ color: "#777" }}>Monthly cash flow</span>
          <span style={{ fontWeight: 500, color: cfColor }}>+${deal.monthlyCashFlow.toLocaleString()}/mo</span>
        </div>
      )}

      {!isFlip && deal.capRate && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: "0.5px solid rgba(0,0,0,0.07)" }}>
          <span style={{ color: "#777" }}>Cap rate</span>
          <span style={{ fontWeight: 500 }}>{deal.capRate}%</span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0" }}>
        <span style={{ color: "#777" }}>{isFlip ? "Projected ROI" : "Cash-on-cash ROI"}</span>
        <span style={{ fontWeight: 500, color: deal.cashOnCashROI > 15 ? "#2e7d32" : "inherit" }}>
          {deal.cashOnCashROI}%
        </span>
      </div>

      {/* Note */}
      <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>{deal.note}</div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "#eee", borderRadius: 2, marginTop: 10 }}>
        <div style={{
          height: "100%", borderRadius: 2,
          background: "#1976d2",
          width: `${Math.min(100, deal.cashOnCashROI * 3.5)}%`,
        }} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ColumbusDeals({ apiUrl = API_URL }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("default");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(2000000);
  const [refreshing, setRefreshing] = useState(false);

  const loadDeals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${apiUrl}/api/deals`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${apiUrl}/api/deals/refresh`, { method: "POST" });
      await loadDeals();
    } catch (err) {
      setError("Refresh failed: " + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  // Filter + sort
  const filteredDeals = (data?.deals || [])
    .filter(d => activeCategory === "All" || d.category === activeCategory)
    .filter(d => d.price >= minPrice && d.price <= maxPrice)
    .sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      if (sortBy === "roi") return b.cashOnCashROI - a.cashOnCashROI;
      if (sortBy === "cashflow") return (b.monthlyCashFlow || 0) - (a.monthlyCashFlow || 0);
      return (b.hot ? 1 : 0) - (a.hot ? 1 : 0); // hot deals first
    });

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ textAlign: "center", padding: "3rem", color: "#888" }}>
      Loading Columbus deals...
    </div>
  );

  if (error) return (
    <div style={{ textAlign: "center", padding: "3rem", color: "#c62828" }}>
      <div style={{ fontWeight: 500 }}>Failed to load deals</div>
      <div style={{ fontSize: 13, marginTop: 8 }}>{error}</div>
      <button onClick={loadDeals} style={{ marginTop: 16, padding: "8px 20px", cursor: "pointer" }}>
        Retry
      </button>
    </div>
  );

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1200, margin: "0 auto", padding: "0 1rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Columbus, OH — Investment Opportunities</h1>
          <p style={{ fontSize: 13, color: "#888", margin: "4px 0 0" }}>{data?.weekLabel}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, background: "#EAF3DE", color: "#27500A", padding: "4px 10px", borderRadius: 6 }}>
            Auto-updates weekly
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ fontSize: 12, padding: "5px 14px", cursor: "pointer", borderRadius: 6, border: "0.5px solid #ccc", background: "transparent" }}
          >
            {refreshing ? "Refreshing..." : "Refresh now"}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: "1.5rem" }}>
        <MetricCard label="Avg monthly cash flow" value={`$${data?.metrics?.avgMonthlyCashFlow?.toLocaleString()}`} sub="across rental listings" />
        <MetricCard label="Avg cap rate" value={`${data?.metrics?.avgCapRate?.toFixed(1)}%`} sub="rental properties" />
        <MetricCard label="Rental deals" value={data?.metrics?.totalRentalDeals} sub="active listings" />
        <MetricCard label="Flip opportunities" value={data?.metrics?.totalFlipDeals} sub="active deals" />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: "1.25rem" }}>
        {/* Category tabs */}
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            style={{
              fontSize: 13, padding: "6px 14px",
              borderRadius: 6, cursor: "pointer",
              border: activeCategory === c ? "none" : "0.5px solid #ccc",
              background: activeCategory === c ? "#E6F1FB" : "transparent",
              color: activeCategory === c ? "#0C447C" : "#555",
              fontWeight: activeCategory === c ? 500 : 400,
            }}
          >{c}</button>
        ))}

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ fontSize: 13, padding: "6px 10px", borderRadius: 6, border: "0.5px solid #ccc", marginLeft: "auto" }}>
          <option value="default">Sort: Hot deals first</option>
          <option value="roi">Sort: Highest ROI</option>
          <option value="cashflow">Sort: Highest cash flow</option>
          <option value="price-asc">Sort: Price low → high</option>
          <option value="price-desc">Sort: Price high → low</option>
        </select>
      </div>

      {/* Price range filter */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: "1.25rem", fontSize: 13, color: "#777" }}>
        <span>Price range:</span>
        <input type="number" value={minPrice} onChange={e => setMinPrice(+e.target.value)}
          placeholder="Min $" style={{ width: 110, padding: "5px 8px", borderRadius: 6, border: "0.5px solid #ccc", fontSize: 13 }} />
        <span>–</span>
        <input type="number" value={maxPrice} onChange={e => setMaxPrice(+e.target.value)}
          placeholder="Max $" style={{ width: 110, padding: "5px 8px", borderRadius: 6, border: "0.5px solid #ccc", fontSize: 13 }} />
        <span style={{ color: "#aaa" }}>{filteredDeals.length} deal{filteredDeals.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Deal grid */}
      {filteredDeals.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#999" }}>No deals match your filters.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {filteredDeals.map(deal => <DealCard key={deal.id} deal={deal} />)}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "0.5px solid #eee", fontSize: 12, color: "#aaa" }}>
        Data auto-refreshes every Monday at 7AM ET via AI market analysis. Always verify with a licensed Columbus agent before purchasing.
        Last updated: {data?.updatedAt}
      </div>
    </div>
  );
}
