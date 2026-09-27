const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const signed = (n, d = 1) => `${n >= 0 ? "+" : ""}${round(n, d)}`;

const CHECKED_WINDOW_DAYS = 30;
export const checkedRecent = (item) =>
  typeof item.checked === "string" &&
  Date.now() - Date.parse(item.checked + "T00:00:00Z") <= CHECKED_WINDOW_DAYS * 86400000;

export function crossedThresholds(products) {
  const withT = products.items.filter((i) => typeof i.target_cny === "number");
  const crossed = withT
    .filter((i) => i.cny <= i.target_cny)
    .map((i) => ({ ...i, pctUnder: round(((i.target_cny - i.cny) / i.target_cny) * 100, 1) }))
    .sort((a, b) => a.priority.localeCompare(b.priority) || b.pctUnder - a.pctUnder);
  const above = withT
    .filter((i) => i.cny > i.target_cny)
    .map((i) => ({ item: i, abovePct: round(((i.cny - i.target_cny) / i.target_cny) * 100, 1) }))
    .sort((a, b) => a.abovePct - b.abovePct);
  return {
    crossed,
    withTargets: withT.length,
    total: products.items.length,
    closest: above.length ? above[0] : null,
  };
}

function fareMovement(tracked, dateKey) {
  const pts = tracked.filter((p) => p.fare);
  if (pts.length < 2) return { score: 50, deltaPct: null, note: "awaiting a second tracked fare check", low: pts.length ? pts[pts.length - 1].fare.low : null };
  const cur = pts[pts.length - 1];
  const cutoff = new Date(Date.parse(dateKey + "T00:00:00Z") - 7 * 86400000).toISOString().slice(0, 10);
  const ref = [...pts].filter((p) => p.date <= cutoff).pop() || pts[0];
  if (ref.date === cur.date) return { score: 50, deltaPct: null, note: "fare baseline only - needs a week of tracking", low: cur.fare.low };
  const deltaPct = ((cur.fare.low - ref.fare.low) / ref.fare.low) * 100;
  const score = clamp(50 - deltaPct * 10, 0, 100);
  const note = deltaPct < -0.5 ? `fares eased ${Math.abs(deltaPct).toFixed(1)}% since ${ref.date}` : deltaPct > 0.5 ? `fares rose ${deltaPct.toFixed(1)}% since ${ref.date}` : `fares flat since ${ref.date}`;
  return { score: round(score), deltaPct: round(deltaPct, 2), note, low: cur.fare.low, refDate: ref.date };
}

export function tripReadiness({ signal, products, checklist, tracked, dateKey }) {
  const trend = Math.abs(signal.trendPct || 0);
  const fxScore = trend <= 1.5 ? 100 : clamp(100 - (trend - 1.5) * 25, 0, 100);
  const core = products.items.filter((i) => i.priority === "P0" || i.priority === "P1");
  const withT = core.filter((i) => typeof i.target_cny === "number").length;
  const covScore = core.length ? (withT / core.length) * 100 : 0;
  const fare = fareMovement(tracked, dateKey);
  const score = round(0.4 * fxScore + 0.3 * covScore + 0.3 * fare.score);
  const booked = !!(checklist.items.find((i) => i.id === "flights") || {}).done;
  const fareMature = fare.deltaPct != null;
  const band = score >= 70 && fareMature ? "READY" : score >= 40 ? "BUILDING" : "EARLY";
  return {
    score, band, booked,
    components: [
      { key: "fx", label: "FX trend stability", score: round(fxScore), value: `${(signal.trendPct || 0).toFixed(2)}% drift over ${signal.series ? signal.series.length - 1 : "?"} pts` },
      { key: "targets", label: "P0/P1 target coverage", score: round(covScore), value: `${withT} of ${core.length} items have targets` },
      { key: "fare", label: "Flight-fare movement", score: fare.score, value: fare.note },
    ],
    fare,
  };
}

export function buildCall({ signal, budgets, crossedInfo, readiness, dualOk, checklist, cfg }) {
  const server = budgets.server.tiers.P1, home = budgets.home.tiers.P1;
  const totalLanded = round(server.landed + home.landed, 0);
  const deployable = budgets.overview.deployable;
  const headroom = round(deployable - totalLanded, 0);
  const reserve = budgets.overview.contingencyReserve;
  const booked = readiness.booked;
  const cny = signal.series ? signal.series[signal.series.length - 1] : null;

  let verdict, confidence, driver;
  if (readiness.band === "READY" && !booked) {
    verdict = "BOOK FLIGHT"; confidence = "ESTIMATE"; driver = "trip readiness reached READY";
  } else if (crossedInfo.crossed.length && headroom > 0) {
    verdict = "BUY NOW";
    confidence = crossedInfo.crossed.every((c) => checkedRecent(c)) ? "VERIFIED" : "ESTIMATE";
    driver = `${crossedInfo.crossed.length} price target(s) crossed with budget headroom`;
  } else if (signal.key === "FAVORABLE" && headroom > 0) {
    verdict = "BUY NOW"; confidence = dualOk ? "VERIFIED" : "ESTIMATE"; driver = "CNY below its multi-week trend";
  } else if (signal.key === "WAIT") {
    verdict = "HOLD"; confidence = dualOk ? "VERIFIED" : "ESTIMATE"; driver = "CNY running above trend - split or delay conversions";
  } else if (signal.key === "INSUFFICIENT") {
    verdict = "WATCH"; confidence = "ESTIMATE"; driver = "history too thin for a timing call";
  } else {
    verdict = "WATCH"; confidence = dualOk ? "VERIFIED" : "ESTIMATE"; driver = "no statistical edge today";
  }

  const parts = [];
  parts.push(
    `1 SAR = ${cny ? cny.toFixed(4) : "?"} CNY - ${Math.abs(signal.pctVsAvg || 0).toFixed(2)}% ` +
    `${(signal.pctVsAvg || 0) <= 0 ? "below" : "above"} its ${signal.series ? signal.series.length : "?"}-point average ` +
    `(signal ${signal.key}, ${(signal.trendPct || 0) >= 0 ? "+" : ""}${(signal.trendPct || 0).toFixed(2)}% drift); ` +
    `${dualOk ? "dual-source FX verified" : "FX sources diverge - treat as approximate"}.`
  );
  parts.push(
    `Core plan lands at ${totalLanded.toLocaleString("en-US")} SAR vs ${deployable.toLocaleString("en-US")} deployable - ` +
    `${headroom >= 0 ? `${headroom.toLocaleString("en-US")} SAR headroom` : `${(-headroom).toLocaleString("en-US")} SAR over`}, ` +
    `${reserve.toLocaleString("en-US")} SAR reserve held back.`
  );
  if (crossedInfo.crossed.length) {
    const names = crossedInfo.crossed.slice(0, 2).map((c) => `${c.name} (${c.pctUnder}% under target)`).join(", ");
    parts.push(`${crossedInfo.crossed.length} of ${crossedInfo.withTargets} targeted items crossed: ${names}${crossedInfo.crossed.length > 2 ? `, +${crossedInfo.crossed.length - 2} more` : ""}.`);
  } else if (crossedInfo.closest) {
    parts.push(`${crossedInfo.withTargets} targets set, none crossed - closest is ${crossedInfo.closest.item.name} at +${crossedInfo.closest.abovePct}% above target.`);
  }
  parts.push(
    `Trip readiness ${readiness.score}/100 (${readiness.band}) - ${readiness.components.map((c) => `${c.label.toLowerCase()} ${c.score}`).join(", ")}; ${readiness.fare.note}` +
    `${booked ? "; flights already booked" : ""}.`
  );
  parts.push(`Call: ${verdict} - driven by ${driver}.`);

  return {
    verdict, confidence, driver,
    reasoning: parts.join(" "),
    inputs: {
      sarCny: cny || null,
      pctVsAvg: round(signal.pctVsAvg || 0, 2),
      signal: signal.key,
      landed: totalLanded,
      headroom,
      crossed: crossedInfo.crossed.length,
      readiness: readiness.score,
      goodsCny: null,
    },
  };
}

const fmtSigned = (n, d = 2) => `${n >= 0 ? "+" : ""}${round(n, d)}`;

export function diffDecisions(prev, cur) {
  if (!prev) return `First recorded call - baseline saved as ${cur.verdict}.`;
  const p = [];
  p.push(prev.verdict === cur.verdict ? `call held at ${cur.verdict}` : `${prev.verdict} → ${cur.verdict}`);
  const f0 = prev.inputs?.pctVsAvg, f1 = cur.inputs?.pctVsAvg;
  if (f0 != null && f1 != null) {
    if (Math.abs(f1 - f0) >= 0.05) p.push(`CNY vs avg ${fmtSigned(f0)}% → ${fmtSigned(f1)}%`);
    else p.push(`CNY vs avg steady at ${fmtSigned(f1)}%`);
  }
  const c0 = prev.inputs?.crossed ?? 0, c1 = cur.inputs?.crossed ?? 0;
  if (c0 !== c1) p.push(`crossed targets ${c0} → ${c1}`);
  if (prev.inputs?.readiness != null && cur.inputs?.readiness != null && prev.inputs.readiness !== cur.inputs.readiness)
    p.push(`readiness ${prev.inputs.readiness} → ${cur.inputs.readiness}`);
  const d = round((cur.inputs?.landed || 0) - (prev.inputs?.landed || 0), 0);
  if (d) p.push(`landed ${d > 0 ? "+" : ""}${d} SAR`);
  if (prev.confidence !== cur.confidence) p.push(`confidence ${prev.confidence} → ${cur.confidence}`);
  return `Since yesterday: ${p.join(" · ")}.`;
}

export function recordDecision(doc, entry) {
  const entries = Array.isArray(doc.entries) ? doc.entries : [];
  const i = entries.findIndex((e) => e.date === entry.date);
  if (i >= 0) entries[i] = entry;
  else entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length > 730) entries.splice(0, entries.length - 730);
  return { entries };
}

export function buildPrompt({ plan, dateKey, call, signal, budgets, crossedInfo, readiness, checklist, decisions, tracked, news, briefWords = 110 }) {
  const L = [];
  L.push(`# MASTER PLAN (source of truth - do not contradict)`);
  L.push(plan.slice(0, 5500));
  L.push("");
  L.push(`Date (UTC): ${dateKey}`);
  L.push("");
  L.push(`## Rule engine call (must stay consistent with this)`);
  L.push(`verdict=${call.verdict} confidence=${call.confidence} driver=${call.driver}`);
  L.push(`reasoning: ${call.reasoning}`);
  L.push("");
  L.push(`## Verified inputs (dual-source FX unless noted)`);
  L.push(`FX: 1 SAR = ${call.inputs.sarCny} CNY, ${call.inputs.pctVsAvg}% vs ${signal.series?.length || "?"}-pt avg, signal=${signal.key}, trend=${(signal.trendPct || 0).toFixed(2)}%`);
  L.push(`Budgets: server core ${budgets.server.tiers.P1.landed}/12000, home core ${budgets.home.tiers.P1.landed}/38000, landed total ${call.inputs.landed}, headroom ${call.inputs.headroom}, reserve ${budgets.overview.contingencyReserve}`);
  L.push(`Crossed: ${crossedInfo.crossed.length} (of ${crossedInfo.withTargets} targets); closest: ${crossedInfo.closest ? `${crossedInfo.closest.item.name} +${crossedInfo.closest.abovePct}%` : "n/a"}`);
  L.push(`Trip readiness: ${readiness.score}/100 ${readiness.band} | ${readiness.components.map((c) => `${c.label}=${c.value}`).join(" | ")} | flights booked: ${readiness.booked}`);
  L.push("");
  L.push(`## Past decisions (oldest → newest, these are my recorded calls)`);
  decisions.slice(-12).forEach((d) => L.push(`${d.date} ${d.verdict} (${d.confidence}) fx=${d.inputs?.signal} vsAvg=${d.inputs?.pctVsAvg}% crossed=${d.inputs?.crossed} ready=${d.inputs?.readiness}`));
  if (decisions.length <= 1) L.push("(decision log starts today)");
  L.push("");
  L.push(`## Price & cost trend (last 7 tracked days)`);
  tracked.slice(-7).forEach((t) => L.push(`${t.date}: goods=¥${t.goodsCny} coreLanded=${t.core.t} SAR sarCny=${t.sarCny}`));
  L.push("");
  const undone = checklist.items.filter((i) => !i.done).map((i) => i.label);
  L.push(`## Pre-trip checklist (${checklist.items.filter((i) => i.done).length}/${checklist.items.length} done)`);
  L.push(undone.length ? `undone: ${undone.join("; ")}` : "all done");
  L.push("");
  L.push(`## Today's headlines`);
  news.slice(0, 10).forEach((n) => L.push(`- ${n.title}`));
  L.push("");
  L.push(`Write TODAY'S DAILY BRIEF as STRICT JSON only (no markdown, no code fences):`);
  L.push(`{"brief":"one paragraph, max ${briefWords} words: what changed, what it means, what to do - cite concrete numbers and reference past recorded decisions when relevant","keyMoves":["max 3 short imperative moves, only if they matter today; use [] if nothing"],"watch":"one sentence: the single thing to monitor tomorrow"}`);
  return L.join("\n");
}

const SYSTEM = "You are the morning analyst for a personal China buy-plan dashboard (SAR budget, trip to China for electronics + furniture). You receive verified data and a rule-engine call. You write a tight daily brief as strict JSON. Never invent numbers; use only what is given. Reference the recorded past decisions when continuity matters. Direct, concrete, no filler.";

export function parseBrief(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  try {
    const j = JSON.parse(t);
    if (typeof j.brief !== "string" || !j.brief.trim()) return null;
    return {
      brief: j.brief.trim(),
      keyMoves: Array.isArray(j.keyMoves) ? j.keyMoves.filter((x) => typeof x === "string").slice(0, 3) : [],
      watch: typeof j.watch === "string" ? j.watch.trim() : "",
    };
  } catch { return null; }
}

export async function askOpenRouter(cfg, prompt, key) {
  const base = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const models = [cfg.llm.primary, ...(cfg.llm.fallbacks || [])].filter(Boolean);
  const errs = [];
  for (const model of models) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Title": "China Buy-Plan Dashboard" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
          temperature: 0.4,
          max_tokens: 700,
        }),
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) { errs.push(`${model} HTTP ${res.status}`); continue; }
      const j = await res.json();
      const parsed = parseBrief(j.choices?.[0]?.message?.content || "");
      if (!parsed) { errs.push(`${model} unparseable`); continue; }
      return { model, usedFallback: model !== models[0], ms: Date.now() - t0, errors: errs, ...parsed };
    } catch (e) { errs.push(`${model} ${e.message}`); }
  }
  throw new Error(errs.join(" | "));
}
