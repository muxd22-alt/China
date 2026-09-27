import { readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) dashboard-refresh/1.0" };
const warnings = [];

const readJson = async (name) => JSON.parse(await readFile(path.join(DATA, name), "utf8"));
const exists = async (name) => { try { await access(path.join(DATA, name), constants.F_OK); return true; } catch { return false; } };
const timedFetch = async (url, ms = 20000) => {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
};

async function fetchRates() {
  let primary = null, secondary = null;
  try {
    const j = await (await timedFetch("https://open.er-api.com/v6/latest/SAR")).json();
    if (j.result === "success" && j.rates) primary = { source: "open.er-api.com", date: j.time_last_update_utc || null, rates: j.rates };
  } catch (e) { warnings.push(`primary FX failed: ${e.message}`); }
  try {
    const j = await (await timedFetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/sar.json")).json();
    if (j.sar) {
      const rates = { SAR: 1 };
      for (const [k, v] of Object.entries(j.sar)) if (typeof v === "number") rates[k.toUpperCase()] = v;
      secondary = { source: "fawazahmed0/currency-api (jsDelivr)", date: j.date || null, rates };
    }
  } catch (e) { warnings.push(`secondary FX failed: ${e.message}`); }
  if (!primary && !secondary) throw new Error("All FX sources failed - cannot refresh");
  const base = primary || secondary;
  const check = secondary || primary;
  const divergence = {};
  for (const cur of ["CNY", "USD", "EUR", "GBP"]) {
    const a = base.rates[cur], b = check.rates[cur];
    if (a && b) divergence[cur] = +(((a - b) / a) * 100).toFixed(4);
  }
  return { base, check, divergence };
}

async function fetchHistory(cfg) {
  const points = [];
  let missing = 0;
  const today = new Date();
  for (let i = cfg.fx.historyPoints; i >= 1; i--) {
    const d = new Date(today.getTime() - i * cfg.fx.historyStepDays * 86400000).toISOString().slice(0, 10);
    try {
      const j = await (await timedFetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${d}/v1/currencies/sar.json`, 12000)).json();
      if (j.sar && j.sar.cny) points.push({ date: j.date || d, cny: j.sar.cny, usd: j.sar.usd || null });
    } catch { missing++; }
  }
  if (missing) warnings.push(`${missing} FX history point(s) unavailable`);
  return points;
}

function fxSignal(currentCny, history, cfg) {
  if (!currentCny || history.length < 3) return { key: "INSUFFICIENT", label: "No reliable trend yet", detail: "History points below threshold - decision: normal pace" };
  const cnySeries = [...history.map((p) => p.cny), currentCny];
  const avg = cnySeries.reduce((a, b) => a + b, 0) / cnySeries.length;
  const min = Math.min(...cnySeries), max = Math.max(...cnySeries);
  const pctVsAvg = ((currentCny - avg) / avg) * 100;
  const first = cnySeries[0], last = cnySeries[cnySeries.length - 1];
  const trendPct = ((last - first) / first) * 100;
  const avgSar = 1 / avg;
  let key = "NEUTRAL", label = "CNY near 8-week average", detail = "No timing edge - follow the phased buy order";
  if (pctVsAvg <= -cfg.fx.favorablePct) {
    key = "FAVORABLE";
    label = "CNY below trend - good window";
    detail = `1 CNY ≈ ${avgSar.toFixed(4)} SAR on average; today it costs less. Convert and place big-ticket orders this week.`;
  } else if (pctVsAvg >= cfg.fx.favorablePct) {
    key = "WAIT";
    label = "CNY above trend - hold conversions";
    detail = `CNY is running hot vs its ${cnySeries.length}-point average. Split large orders or wait for a dip; small orders unaffected.`;
  }
  return { key, label, detail, avg, min, max, pctVsAvg, trendPct, series: cnySeries };
}

const decodeEntities = (s) => s
  .replace(/<!\[CDATA\[|\]\]>/g, "")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

async function fetchNews(cfg) {
  const out = [];
  for (const q of cfg.newsQueries) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q.q)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await timedFetch(url);
      const xml = await res.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
        const b = m[1];
        const title = (b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
        const link = (b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
        const pub = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "";
        const ts = Date.parse(pub);
        return { feed: q.id, feedLabel: q.label, title: decodeEntities(title).trim(), link: link.trim(), pubDate: pub, ts: Number.isNaN(ts) ? null : ts };
      }).filter((i) => i.title && i.link);
      items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      out.push(...items.slice(0, q.max));
    } catch (e) {
      warnings.push(`news feed "${q.id}" failed: ${e.message}`);
    }
  }
  const seen = new Set();
  return out.filter((i) => (seen.has(i.link) ? false : (seen.add(i.link), true))).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

function budgetEngine(products, rates, cfg) {
  const sarPerCny = 1 / rates.CNY;
  const tiers = { P0: ["P0"], P1: ["P0", "P1"], P2: ["P0", "P1", "P2"], P3: ["P0", "P1", "P2", "P3"] };
  const goodsOf = (items) => items.reduce((s, it) => s + it.qty * it.cny * sarPerCny, 0);

  const bundles = {};
  for (const bundle of ["server", "home"]) {
    const items = products.items.filter((i) => i.bundle === bundle);
    const byTier = {};
    for (const [tier, pris] of Object.entries(tiers)) byTier[tier] = goodsOf(items.filter((i) => pris.includes(i.priority)));
    bundles[bundle] = { goodsByTier: byTier, itemCount: items.length };
  }
  const allGoods = goodsOf(products.items);
  const budgets = { server: cfg.budgets.serverTech, home: cfg.budgets.homeFurnishing, total: cfg.budgets.total };
  const result = {};
  for (const bundle of ["server", "home"]) {
    result[bundle] = { tiers: {} };
    for (const [tier, goods] of Object.entries(bundles[bundle].goodsByTier)) {
      const tax = goods * cfg.logistics.taxRate;
      const ship = allGoods > 0 ? cfg.logistics.shippingSAR * (goods / allGoods) : 0;
      const landed = goods + tax + ship;
      const budget = budgets[bundle];
      result[bundle].tiers[tier] = {
        goods: round(goods), tax: round(tax), shipping: round(ship), landed: round(landed),
        budget, remaining: round(budget - landed), pct: round((landed / budget) * 100),
        status: landed <= budget ? "ok" : "over",
      };
    }
  }
  const coreGoods = result.server.tiers.P1.goods + result.home.tiers.P1.goods;
  const coreTax = coreGoods * cfg.logistics.taxRate;
  const coreLanded = coreGoods + coreTax + cfg.logistics.shippingSAR;
  const reserve = cfg.budgets.total * cfg.budgets.contingencyPct;
  result.overview = {
    totalBudget: cfg.budgets.total,
    contingencyReserve: round(reserve),
    deployable: round(cfg.budgets.total - reserve),
    coreLanded: round(coreLanded),
    coreWithinDeployable: coreLanded <= cfg.budgets.total - reserve,
    shippingSAR: cfg.logistics.shippingSAR,
    taxRate: cfg.logistics.taxRate,
    sarPerCny: round(sarPerCny, 6),
  };
  return result;
}
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

async function trackSnapshot(dateKey, rates, budgets, products) {
  let doc = { points: [] };
  if (await exists("history.json")) {
    try {
      doc = await readJson("history.json");
      if (!Array.isArray(doc.points)) doc = { points: [] };
    } catch {
      warnings.push("history.json unreadable - restarted tracking");
      doc = { points: [] };
    }
  }
  const sarPerCny = 1 / rates.CNY;
  const p = {};
  let goodsCny = 0;
  for (const it of products.items) {
    p[it.id] = [it.cny, it.qty];
    goodsCny += it.cny * it.qty;
  }
  const core = { s: budgets.server.tiers.P1.landed, h: budgets.home.tiers.P1.landed };
  core.t = round(core.s + core.h);
  const all = { s: budgets.server.tiers.P3.landed, h: budgets.home.tiers.P3.landed };
  all.t = round(all.s + all.h);
  const point = {
    date: dateKey,
    sarCny: round(rates.CNY, 6),
    sarUsd: round(rates.USD, 6),
    goodsCny: round(goodsCny),
    goodsSar: round(goodsCny * sarPerCny),
    core, all, p,
  };
  const i = doc.points.findIndex((x) => x.date === dateKey);
  if (i >= 0) doc.points[i] = point;
  else doc.points.push(point);
  doc.points.sort((a, b) => a.date.localeCompare(b.date));
  if (doc.points.length > 730) doc.points = doc.points.slice(-730);
  const txt = '{\n"points": [\n' + doc.points.map((x) => JSON.stringify(x)).join(",\n") + '\n]\n}\n';
  await writeFile(path.join(DATA, "history.json"), txt);
  return doc.points;
}

function pickTip(cfg) {
  const start = Date.UTC(new Date().getUTCFullYear(), 0, 0);
  const doy = Math.floor((Date.now() - start) / 86400000);
  return { index: doy % cfg.tips.length, total: cfg.tips.length, text: cfg.tips[doy % cfg.tips.length] };
}

async function main() {
  const cfg = await readJson("config.json");
  const products = await readJson("products.json");

  const { base, check, divergence } = await fetchRates(cfg);
  const history = await fetchHistory(cfg);
  const currentCny = base.rates.CNY;
  const signal = fxSignal(currentCny, history, cfg);

  const bigDivergence = Object.entries(divergence).filter(([, v]) => Math.abs(v) > cfg.fx.divergenceWarnPct);
  if (bigDivergence.length) warnings.push(`FX sources diverge on ${bigDivergence.map(([k]) => k).join(", ")}`);

  const news = await fetchNews(cfg);
  if (news.length === 0 && (await exists("news.json"))) {
    warnings.push("news refresh empty - keeping previous snapshot");
  }

  const budgets = budgetEngine(products, { CNY: currentCny }, cfg);
  const now = new Date().toISOString();
  const tracked = await trackSnapshot(now.slice(0, 10), base.rates, budgets, products);

  const ratesDoc = {
    generatedAt: now, base: base.source, baseDate: base.date, check: check.source, checkDate: check.date,
    rates: base.rates, divergence, history, signal,
  };
  const newsDoc = { generatedAt: now, items: news };
  const summaryDoc = {
    generatedAt: now, budgets, tip: pickTip(cfg), travel: cfg.travel,
    logistics: cfg.logistics, warnings, newsCount: news.length,
  };
  const dashboard = {
    meta: { generatedAt: now, project: cfg.meta.project, dailyRefresh: "GitHub Actions 05:00 UTC (08:00 Riyadh)" },
    config: cfg, products, rates: ratesDoc, news: newsDoc, summary: summaryDoc, history: tracked,
  };

  await writeFile(path.join(DATA, "rates.json"), JSON.stringify(ratesDoc, null, 2));
  if (news.length > 0) await writeFile(path.join(DATA, "news.json"), JSON.stringify(newsDoc, null, 2));
  await writeFile(path.join(DATA, "summary.json"), JSON.stringify(summaryDoc, null, 2));
  await writeFile(path.join(DATA, "dashboard.js"), `window.DASH = ${JSON.stringify(dashboard)};`);

  console.log(`OK rates: SAR/CNY=${currentCny} history=${history.length}pts signal=${signal.key}`);
  console.log(`OK news: ${news.length} items | budgets: server P1 landed=${budgets.server.tiers.P1.landed} home P1 landed=${budgets.home.tiers.P1.landed}`);
  console.log(`OK tracked: ${tracked.length} daily point(s) in history.json since ${tracked[0]?.date || "-"}`);
  if (warnings.length) console.log("WARN:\n - " + warnings.join("\n - "));
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
