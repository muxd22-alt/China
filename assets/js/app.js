(function () {
  const D = window.DASH;
  const $ = (id) => document.getElementById(id);
  if (!D) {
    $("metaLine").textContent = "data/dashboard.js missing - run: node scripts/update.mjs";
    return;
  }

  const cfg = D.config, products = D.products, rates = D.rates, summary = D.summary;
  const sarPerCny = 1 / rates.rates.CNY;
  const allGoodsCny = products.items.reduce((s, i) => s + i.qty * i.cny, 0);
  const allGoodsSar = allGoodsCny * sarPerCny;
  const taxRate = cfg.logistics.taxRate;
  const shipSar = cfg.logistics.shippingSAR;

  const fmt = (n, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmt4 = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const timeAgo = (ts) => {
    if (!ts) return "recent";
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  };

  const lineMath = (item) => {
    const goods = item.qty * item.cny * sarPerCny;
    const tax = goods * taxRate;
    const freight = allGoodsSar > 0 ? shipSar * (goods / allGoodsSar) : 0;
    return { goods, tax, freight, landed: goods + tax + freight };
  };

  function renderMeta() {
    const d = new Date(D.meta.generatedAt);
    $("metaLine").textContent = `${D.meta.project} · data as of ${d.toUTCString().replace(":00 GMT", " UTC")} · ${D.meta.dailyRefresh}`;
  }

  function sparkline(series) {
    if (!series || series.length < 2) return "";
    const w = 130, h = 40, pad = 4;
    const min = Math.min(...series), max = Math.max(...series);
    const span = max - min || 1;
    const pts = series.map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / (series.length - 1);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return [x, y];
    });
    const poly = pts.map((p) => p.join(",")).join(" ");
    const last = pts[pts.length - 1];
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <polyline points="${poly}" fill="none" stroke="#37d0c0" stroke-width="2"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="3.2" fill="#5aa2ff"/>
    </svg>`;
  }

  function renderFx() {
    const cny = rates.rates.CNY, usd = rates.rates.USD, eur = rates.rates.EUR;
    const sig = rates.signal;
    const sigClass = sig.key === "FAVORABLE" ? "ok" : sig.key === "WAIT" ? "warn" : sig.key === "INSUFFICIENT" ? "warn" : "info";
    const series = sig.series || rates.history.map((p) => p.cny).concat(cny);
    const divRows = Object.entries(rates.divergence)
      .map(([k, v]) => `<div class="row"><span class="muted">${k}</span><span>${Math.abs(v) <= cfg.fx.divergenceWarnPct ? "✓" : "⚠"} ${v}%</span></div>`)
      .join("");
    const divOk = Object.values(rates.divergence).every((v) => Math.abs(v) <= cfg.fx.divergenceWarnPct);

    $("fxSection").innerHTML = `
      <div class="card">
        <div class="label">Saudi Riyal → Chinese Yuan</div>
        <div class="rate-row">
          <div>
            <div class="rate-big">1 SAR = ${fmt4(cny)} CNY</div>
            <div class="rate-sub">1 CNY = ${fmt4(sarPerCny)} SAR · avg ${fmt4(1 / (sig.avg || cny))} SAR</div>
          </div>
          ${sparkline(series)}
        </div>
        <div style="margin-top:10px"><span class="badge ${sigClass}">${sig.key}</span> <span style="font-size:13px">${esc(sig.label)}</span></div>
        <div class="signal-note">${esc(sig.detail)}</div>
        ${sig.pctVsAvg != null ? `<div class="signal-note mono">${sig.pctVsAvg >= 0 ? "+" : ""}${fmt(sig.pctVsAvg, 2)}% vs ${series.length}-point avg · 8-wk trend ${sig.trendPct >= 0 ? "+" : ""}${fmt(sig.trendPct, 2)}%</div>` : ""}
      </div>
      <div class="card">
        <div class="label">Peg & majors</div>
        <div class="rate-big" style="font-size:26px">1 SAR = ${fmt4(usd)} USD</div>
        <div class="rate-sub">1 SAR = ${fmt4(eur)} EUR</div>
        <div class="signal-note">USD peg reference: 3.75 (actual ${fmt4(1 / usd)})</div>
        <div class="signal-note">source: ${esc(rates.base)} · ${rates.baseDate ? new Date(rates.baseDate).toUTCString().slice(0, 16) : ""}</div>
      </div>
      <div class="card">
        <div class="label">Dual-source check</div>
        <div style="margin-top:6px"><span class="badge ${divOk ? "ok" : "warn"}">${divOk ? "SOURCES AGREE" : "DIVERGENCE"}</span></div>
        <div style="margin-top:8px">${divRows}</div>
        <div class="signal-note">${esc(rates.check)}</div>
      </div>`;
  }

  const tierLabels = { P0: "P0 only", P1: "Core P0-P1", P2: "+ P2", P3: "Everything" };
  let activeTier = "P1";

  function renderTierSwitch() {
    $("tierSwitch").innerHTML = Object.keys(tierLabels)
      .map((t) => `<button data-tier="${t}" class="${t === activeTier ? "active" : ""}">${tierLabels[t]}</button>`)
      .join("");
    $("tierSwitch").querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => { activeTier = b.dataset.tier; renderTierSwitch(); renderBudgets(); renderCalls(); })
    );
  }

  function budgetCard(title, b) {
    const pct = Math.min(b.pct, 100);
    const over = b.status === "over";
    return `<div class="card budget">
      <h3>${title}</h3>
      <div class="bar"><i class="${over ? "over" : ""}" style="width:${pct}%"></i></div>
      <div class="amounts">${fmt(b.landed)} <small>SAR landed</small></div>
      <div class="row"><span class="muted">budget ${fmt(b.budget)}</span>
      <span style="color:${over ? "var(--bad)" : "var(--ok)"}">${over ? "over by " + fmt(-b.remaining) : fmt(b.remaining) + " free"}</span></div>
      <div class="row"><span class="muted">goods ${fmt(b.goods)} + tax ${fmt(b.tax)} + freight ${fmt(b.shipping)}</span></div>
    </div>`;
  }

  function renderBudgets() {
    const s = summary.budgets;
    const server = s.server.tiers[activeTier], home = s.home.tiers[activeTier];
    const totalLanded = server.landed + home.landed;
    const reserve = s.overview.contingencyReserve;
    const deployable = s.overview.totalBudget - reserve;
    const free = deployable - totalLanded;
    const totalCard = `<div class="card budget">
      <h3>Grand total (with reserve)</h3>
      <div class="bar"><i class="${totalLanded > deployable ? "over" : ""}" style="width:${Math.min((totalLanded / deployable) * 100, 100)}%"></i></div>
      <div class="amounts">${fmt(totalLanded)} <small>SAR landed</small></div>
      <div class="row"><span class="muted">deployable ${fmt(deployable)} (50k − 10% reserve)</span>
      <span style="color:${free < 0 ? "var(--bad)" : "var(--ok)"}">${free < 0 ? "over by " + fmt(-free) : fmt(free) + " headroom"}</span></div>
      <div class="row"><span class="muted">reserve held: ${fmt(reserve)} SAR</span></div>
    </div>`;
    $("budgetGrid").innerHTML = budgetCard("Server & tech", server) + budgetCard("Home furnishing", home) + totalCard;

    const parts = [];
    parts.push(`Tier "${tierLabels[activeTier]}" · goods ${fmt(server.goods + home.goods)} + 15% tax ${fmt(server.tax + home.tax)} + freight ${fmt(server.shipping + home.shipping)}.`);
    if (server.status === "over" && home.remaining > 500) {
      parts.push(`Server is over by ${fmt(-server.remaining)} SAR while home sits on ${fmt(home.remaining)} free - rebalance the sub-budgets (keep the grand total unchanged).`);
    }
    if (free > 2000) parts.push(`Plan fits comfortably; the ${fmt(free)} SAR headroom is real - upgrade targets are GPUs, RAM or a second NVMe before touching the reserve.`);
    $("budgetHint").textContent = parts.join(" ");
  }

  function renderCalls() {
    const sig = rates.signal;
    const tier = summary.budgets.server.tiers[activeTier];
    const home = summary.budgets.home.tiers[activeTier];
    const total = tier.landed + home.landed;
    const deployable = summary.budgets.overview.deployable;
    const newest = D.news.items.length ? D.news.items[0].ts : null;
    const calls = [];

    calls.push({
      cls: sig.key === "FAVORABLE" ? "good" : sig.key === "WAIT" ? "warn" : "",
      title: "FX timing", body: `${sig.label}. ${sig.detail}`,
    });
    calls.push({
      cls: tier.status === "over" ? "bad" : "good",
      title: "Server line", body: tier.status === "over"
        ? `Over budget by ${fmt(-tier.remaining)} SAR at "${tierLabels[activeTier]}". Trim P2/P3 (Mi Box, basic peripherals) or move surplus from the home line.`
        : `Fits: ${fmt(tier.landed)} of ${fmt(tier.budget)} SAR (${fmt(tier.pct)}%).`,
    });
    calls.push({
      cls: total <= deployable ? "good" : "bad",
      title: "Grand plan", body: total <= deployable
        ? `All-in ${fmt(total)} SAR vs ${fmt(deployable)} deployable - ${fmt(deployable - total)} SAR headroom beyond the 10% reserve.`
        : `All-in ${fmt(total)} SAR exceeds deployable ${fmt(deployable)} SAR - cut ${fmt(total - deployable)} SAR of options before ordering.`,
    });
    const divOk = Object.values(rates.divergence).every((v) => Math.abs(v) <= cfg.fx.divergenceWarnPct);
    calls.push({
      cls: divOk ? "good" : "warn",
      title: "Data integrity", body: divOk
        ? `Two independent FX sources agree within ${cfg.fx.divergenceWarnPct}%. ${D.news.items.length} fresh headlines loaded.`
        : `FX sources disagree - treat conversions as approximate and re-check before large transfers.`,
    });
    if (newest) calls.push({ cls: "", title: "Freshness", body: `Newest headline: ${timeAgo(newest)}. Dashboard refreshed automatically every day at 08:00 Riyadh time.` });
    calls.push({ cls: "warn", title: `Tip ${summary.tip.index + 1}/${summary.tip.total}`, body: summary.tip.text });
    (summary.warnings || []).forEach((w) => calls.push({ cls: "warn", title: "Warning", body: w }));

    $("calls").innerHTML = calls.map((c) => `<div class="call ${c.cls}"><b>${c.title}</b>${esc(c.body)}</div>`).join("");
  }

  /* ---------- server route (15K cap decision) ---------- */
  let routePick = null;
  function renderRoute() {
    const route = cfg.route, platforms = cfg.platforms || [];
    if (!route || !platforms.length) {
      $("routeGrid").innerHTML = `<p class="hint">Route data missing from data/config.json.</p>`;
      return;
    }
    if (!routePick) routePick = (route.priorities[0] || {}).id;
    const active = route.priorities.find((p) => p.id === routePick) || route.priorities[0];
    const cap = route.capSAR;
    $("routeMeta").textContent = `${platforms.length} platforms · hard cap ${fmt(cap)} SAR · prices checked ${route.checked}`;

    $("routeChips").innerHTML = route.priorities
      .map((p) => `<button data-p="${p.id}" class="${p.id === active.id ? "active" : ""}">${esc(p.label)}</button>`)
      .join("");
    $("routeChips").querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => { routePick = b.dataset.p; renderRoute(); })
    );

    const picked = platforms.find((p) => p.id === active.pick);
    $("routeVerdict").innerHTML = `
      <div><b>${esc(active.label)} → ${esc(picked ? picked.name : active.pick)}</b></div>
      <div style="margin-top:4px">${esc(active.why)}</div>
      <div class="hint" style="margin-top:8px">${esc(route.overall)}</div>`;

    $("routeGrid").innerHTML = platforms.map((p) => {
      const hasPrice = p.priceLow != null && p.priceHigh != null;
      const mid = hasPrice ? (p.priceLow + p.priceHigh) / 2 : null;
      const over = hasPrice && mid > cap;
      const pct = hasPrice ? Math.min((mid / cap) * 100, 100) : 0;
      const price = hasPrice
        ? `<span class="amt ${over ? "over" : "within"}">${fmt(p.priceLow)}–${fmt(p.priceHigh)} <small style="font-size:12px">SAR</small></span>
           <span class="src">mid ${fmt(mid)} · cap ${fmt(cap)}</span>`
        : `<span class="amt tbd">price TBA</span><span class="src">prototype — nothing to order</span>`;
      const capBar = hasPrice
        ? `<div class="rc-cap"><i class="${over ? "over" : ""}" style="width:${pct}%"></i></div>`
        : `<div class="rc-cap-na">watch the news feeds for launch pricing</div>`;
      const variants = (p.variants || []).length
        ? `<div class="rc-sub">cheaper routes</div><div class="rc-variants">${p.variants.map((v) => `<span>${esc(v)}</span>`).join("")}</div>`
        : "";
      return `<div class="card route-card ${p.id === active.pick ? "picked" : ""}">
        <div class="rc-top"><h3>${esc(p.name)}</h3><span class="rc-badge ${p.badgeClass}">${esc(p.badge)}</span></div>
        <div class="rc-price">${price}</div>
        ${capBar}
        <div class="rc-specs">
          <div><span class="k">memory</span><span class="v">${esc(p.mem)}</span></div>
          <div><span class="k">bandwidth</span><span class="v">${esc(p.bw)}</span></div>
          <div><span class="k">power</span><span class="v">${esc(p.power)}</span></div>
          <div><span class="k">local AI</span><span class="v">${esc(p.ai)}</span></div>
          <div><span class="k">OS</span><span class="v">${esc(p.os)}</span></div>
        </div>
        ${variants}
        <div class="rc-sub">pros</div><ul class="rc-list pros">${p.pros.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <div class="rc-sub">cons</div><ul class="rc-list cons">${p.cons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <p class="rc-note">${esc(p.priceNote)}</p>
        <div class="rc-best"><b>Best for:</b> ${esc(p.bestFor)}</div>
      </div>`;
    }).join("");
  }

  /* ---------- model fit matrix ---------- */
  const FIT_TEXT = { fast: "fast", fits: "fits", slow: "slow", tight: "tight", dual: "2-node", no: "—" };
  function renderFit() {
    const classes = cfg.modelClasses, cols = cfg.fitColumns;
    if (!classes || !cols) { $("fitTable").innerHTML = ""; return; }
    $("fitMeta").textContent = `est. ${cfg.route.checked} · quantized weights (Q4/Q3) · hand-edited in data/config.json`;
    $("fitTable").innerHTML = `
      <thead><tr>
        <th>Model class</th><th class="num">Size</th>
        ${cols.map((c) => `<th class="fit-cell">${esc(c.label)}</th>`).join("")}
      </tr></thead>
      <tbody>${classes.map((m) => `
        <tr>
          <td><span class="fit-name">${esc(m.name)}</span><span class="fit-ex">${esc(m.examples)}</span></td>
          <td class="num fit-gb">~${m.gb}GB</td>
          ${cols.map((c) => {
            const lv = (m.fits || {})[c.key] || "no";
            return `<td class="fit-cell"><span class="fit-${lv}">${FIT_TEXT[lv]}</span></td>`;
          }).join("")}
        </tr>`).join("")}
      </tbody>`;
    $("fitLegend").innerHTML = [
      `<b class="fit-fast">fast</b> comfortable GPU-class speed`,
      `<b class="fit-fits">fits</b> loads with usable speed`,
      `<b class="fit-slow">slow</b> CPU/host offload heavy`,
      `<b class="fit-tight">tight</b> barely fits, little context room`,
      `<b class="fit-dual">2-node</b> needs a linked pair`,
      `<b class="fit-no">—</b> does not fit`,
    ].map((s) => `<span>${s}</span>`).join("");
  }

  function wireNav() {
    const links = [...document.querySelectorAll(".jumpnav a")];
    links.forEach((a) => a.addEventListener("click", () => {
      links.forEach((l) => l.classList.remove("active"));
      a.classList.add("active");
    }));
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach((a) => {
      const el = document.querySelector(a.getAttribute("href"));
      if (el) io.observe(el);
    });
  }

  function renderCalc() {
    const cny = Math.max(0, parseFloat($("calcCny").value) || 0);
    const localRaw = parseFloat($("calcLocal").value);
    const goods = cny * sarPerCny;
    const tax = goods * taxRate;
    const freight = allGoodsSar > 0 ? shipSar * (goods / allGoodsSar) : 0;
    const landed = goods + tax + freight;
    let verdict = `<div class="calc-verdict hint">Freight is a fixed ${fmt(shipSar)} SAR for the whole container - every extra item you add splits that pie thinner.</div>`;
    if (!Number.isNaN(localRaw) && localRaw > 0) {
      const diff = localRaw - landed;
      const ratio = landed / localRaw;
      if (ratio <= 0.9) verdict = `<div class="calc-verdict"><span class="badge ok">SHIP IT</span> Lands at ${fmt(landed)} vs ${fmt(localRaw)} local - saves ${fmt(diff)} SAR (${fmt((1 - ratio) * 100)}% cheaper).</div>`;
      else if (ratio <= 1) verdict = `<div class="calc-verdict"><span class="badge info">MARGINAL</span> Saves only ${fmt(diff)} SAR (${fmt((1 - ratio) * 100)}%) - worth it only if bundled into the same shipment.</div>`;
      else verdict = `<div class="calc-verdict"><span class="badge bad">SKIP</span> Local wins by ${fmt(-diff)} SAR - leave this one home.</div>`;
    }
    $("calcOut").innerHTML = `
      <div><span class="k">Goods</span><span class="v">${fmt(goods, 2)}</span></div>
      <div><span class="k">+15% tax</span><span class="v">${fmt(tax, 2)}</span></div>
      <div><span class="k">Freight share</span><span class="v">${fmt(freight, 2)}</span></div>
      <div><span class="k">Landed SAR</span><span class="v" style="color:var(--accent)">${fmt(landed, 2)}</span></div>` + verdict;
  }

  let filterBundle = "all", filterPri = "all", sortKey = "priority", sortDir = 1, search = "";

  function renderFilters() {
    const btn = (group, val, label) => `<button data-g="${group}" data-v="${val}" class="${(group === "bundle" ? filterBundle : filterPri) === val ? "active" : ""}">${label}</button>`;
    $("filters").innerHTML =
      btn("bundle", "all", "All bundles") + btn("bundle", "server", "Server & tech") + btn("bundle", "home", "Home") +
      `<span style="width:10px"></span>` +
      btn("pri", "all", "Any priority") + btn("pri", "P0", "P0") + btn("pri", "P1", "P1") + btn("pri", "P2", "P2") + btn("pri", "P3", "P3") +
      `<input type="search" id="listSearch" placeholder="search the list…" value="${esc(search)}">`;
    $("filters").querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.g === "bundle") filterBundle = b.dataset.v; else filterPri = b.dataset.v;
        renderFilters(); renderList();
      })
    );
    $("listSearch").addEventListener("input", (e) => { search = e.target.value.toLowerCase(); renderList(); });
  }

  function renderList() {
    let items = products.items.filter((i) =>
      (filterBundle === "all" || i.bundle === filterBundle) &&
      (filterPri === "all" || i.priority === filterPri) &&
      (!search || i.name.toLowerCase().includes(search) || i.category.toLowerCase().includes(search) || (i.why || "").toLowerCase().includes(search))
    );
    const priOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    items = [...items].sort((a, b) => {
      let x, y;
      if (sortKey === "sarLine") { x = lineMath(a).landed; y = lineMath(b).landed; }
      else if (sortKey === "priority") { x = priOrder[a.priority]; y = priOrder[b.priority]; }
      else if (sortKey === "target") { x = a.target_cny ?? Infinity; y = b.target_cny ?? Infinity; }
      else { x = a[sortKey]; y = b[sortKey]; }
      if (typeof x === "string") return sortDir * x.localeCompare(y);
      return sortDir * (x - y);
    });
    const goodsShown = items.reduce((s, i) => s + i.qty * i.cny * sarPerCny, 0);
    $("listStats").textContent = `${items.length} lines · goods ${fmt(goodsShown)} SAR + tax & freight on top`;

    $("listBody").innerHTML = items.map((i) => {
      const m = lineMath(i);
      const hit = typeof i.target_cny === "number" && i.cny <= i.target_cny;
      const tgt = typeof i.target_cny === "number"
        ? `<span class="tgt-cell ${hit ? "hit" : "miss"}">¥${fmt(i.target_cny)}</span>`
        : `<span class="tgt-cell miss">—</span>`;
      return `<tr class="${hit ? "crossed" : ""}">
        <td data-label="Item">${esc(i.name)} <span class="tag ${i.priority.toLowerCase()}">${i.priority}</span>${i.added ? `<span class="tag added">smart add</span>` : ""}${hit ? `<span class="tag" style="color:var(--ok);border-color:rgba(61,220,132,.5)">target hit</span>` : ""}<span class="why">${esc(i.why || "")}</span></td>
        <td data-label="Bundle">${i.bundle === "server" ? "Server" : "Home"} · ${esc(i.category)}</td>
        <td class="num" data-label="Pri">${i.priority}</td>
        <td class="num" data-label="Phase">${i.phase}</td>
        <td class="num" data-label="Qty">${i.qty}</td>
        <td class="num" data-label="CNY">¥${fmt(i.cny)}</td>
        <td class="num" data-label="Target">${tgt}</td>
        <td class="num" data-label="Landed">${fmt(m.landed)}</td>
      </tr>`;
    }).join("");
  }

  document.querySelectorAll("#listTable th[data-sort]").forEach((th) =>
    th.addEventListener("click", () => {
      const k = th.dataset.sort;
      if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; }
      renderList();
    })
  );

  function renderNews() {
    $("newsMeta").textContent = `${D.news.items.length} headlines · refreshed daily`;
    $("newsGrid").innerHTML = D.news.items.map((n) => `
      <div class="news-item">
        <span class="feed">${esc(n.feedLabel)}</span>
        <a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a>
        <span class="when">${timeAgo(n.ts)}</span>
      </div>`).join("") || `<p class="hint">No headlines in the latest snapshot.</p>`;
  }

  function renderTravel() {
    const routes = cfg.travel.routes.map((r) => `
      <div class="card travel-card">
        <span class="route">${esc(r.from)} → ${esc(r.to)}</span>
        <span class="fare">${fmt(r.sarLow)} – ${fmt(r.sarHigh)} <small style="font-size:11px;color:var(--muted)">SAR return</small></span>
        <span class="note">${esc(r.via)} · ${esc(r.note)}</span>
        <a href="${esc(r.link)}" target="_blank" rel="noopener">check live fares →</a>
      </div>`);
    const stays = cfg.travel.stays.map((s) => `
      <div class="card travel-card">
        <span class="route">${esc(s.city)}</span>
        <span class="fare">${fmt(s.cnyNightLow * sarPerCny)} – ${fmt(s.cnyNightHigh * sarPerCny)} <small style="font-size:11px;color:var(--muted)">SAR / night</small></span>
        <span class="note">converted at live rate from ¥${s.cnyNightLow}–¥${s.cnyNightHigh}</span>
        <a href="${esc(s.link)}" target="_blank" rel="noopener">search stays →</a>
      </div>`);
    $("travelGrid").innerHTML = routes.concat(stays).join("");
  }

  function renderFoot() {
    $("foot").innerHTML = `
      <div>Prices in the buy list are CNY estimates (editable in <code>data/products.json</code>) - verify on-site before paying.</div>
      <div>FX: ${esc(rates.base)} + ${esc(rates.check)} · News: Google News RSS · Refreshed by GitHub Actions</div>`;
  }

  let chartSeq = 0;
  function chartSVG(series, opts) {
    opts = opts || {};
    const yFmt = opts.yFmt || ((v) => fmt(v));
    const n = Math.max(0, ...series.map((s) => s.pts.length));
    if (!n) return `<p class="hint">No tracked points yet - the first snapshot lands today.</p>`;
    const W = 480, H = 185, L = 58, R = 10, T = 12, B = 24;
    const ys = series.flatMap((s) => s.pts.map((p) => p.y));
    let min = Math.min(...ys), max = Math.max(...ys);
    if (min === max) { const pad = Math.abs(min) * 0.02 || 1; min -= pad; max += pad; }
    else { const pad = (max - min) * 0.12; min -= pad; max += pad; }
    const X = (i, len) => (len <= 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (len - 1));
    const Y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
    let g = "";
    for (let k = 0; k <= 4; k++) {
      const v = min + ((max - min) * k) / 4;
      const y = Y(v);
      g += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" stroke="#1e2a38" stroke-dasharray="3 4"/>`;
      g += `<text x="${L - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${yFmt(v)}</text>`;
    }
    if (opts.refY != null && opts.refY >= min && opts.refY <= max) {
      const ry = Y(opts.refY);
      g += `<line x1="${L}" y1="${ry.toFixed(1)}" x2="${W - R}" y2="${ry.toFixed(1)}" stroke="#ffb454" stroke-dasharray="6 4" opacity=".75"/>`;
      g += `<text x="${W - R}" y="${(ry - 4).toFixed(1)}" text-anchor="end" fill="#ffb454">${esc(opts.refLabel || "")}</text>`;
    }
    series.forEach((s) => {
      if (!s.pts.length) return;
      const dpath = s.pts.map((p, i) => `${i ? "L" : "M"}${X(i, s.pts.length).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
      g += `<path d="${dpath}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
      const step = Math.max(1, Math.ceil(s.pts.length / 40));
      s.pts.forEach((p, i) => {
        const cx = X(i, s.pts.length), cy = Y(p.y), last = i === s.pts.length - 1;
        const tip = `<title>${p.d} · ${s.name}: ${yFmt(p.y)}</title>`;
        if (s.pts.length <= 25 || last) g += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${last ? 3.6 : 2.4}" fill="${s.color}">${tip}</circle>`;
        else if (i % step === 0) g += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="transparent">${tip}</circle>`;
      });
    });
    const fd = series[0].pts[0].d, ld = series[0].pts[series[0].pts.length - 1].d;
    g += `<text x="${L}" y="${H - 6}">${fd.slice(5)}</text>`;
    if (n > 2) g += `<text x="${W - R}" y="${H - 6}" text-anchor="end">${ld.slice(5)}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
  }

  let histDays = 0;
  const histRanges = { 0: "All", 30: "30D", 14: "14D", 7: "7D" };
  const histCut = () => (histDays ? Date.now() - histDays * 86400000 : null);

  function renderHistRange() {
    $("histRange").innerHTML = Object.entries(histRanges)
      .map(([d, l]) => `<button data-d="${d}" class="${+d === histDays ? "active" : ""}">${l}</button>`)
      .join("");
    $("histRange").querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => { histDays = +b.dataset.d; renderHistRange(); renderHistory(); })
    );
  }

  function renderHistory() {
    const full = D.history || [];
    const grid = $("histGrid");
    if (!full.length) {
      grid.innerHTML = `<p class="hint">No tracked points yet - run <code>node scripts/update.mjs</code> to start tracking.</p>`;
      $("priceEdits").textContent = "";
      return;
    }
    const cut = histCut();
    const pts = cut ? full.filter((p) => Date.parse(p.date + "T00:00:00Z") >= cut) : full;
    const shown = pts.length ? pts : full.slice(-1);

    const landed = [
      { name: "Total core", color: "#ffb454", pts: shown.map((p) => ({ d: p.date, y: p.core.t })) },
      { name: "Server", color: "#5aa2ff", pts: shown.map((p) => ({ d: p.date, y: p.core.s })) },
      { name: "Home", color: "#37d0c0", pts: shown.map((p) => ({ d: p.date, y: p.core.h })) },
    ];
    const fxMap = new Map();
    (rates.history || []).forEach((h) => { if (!cut || Date.parse(h.date + "T00:00:00Z") >= cut) fxMap.set(h.date, h.cny); });
    shown.forEach((p) => fxMap.set(p.date, p.sarCny));
    const fxPts = [...fxMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, y]) => ({ d, y }));
    const fxAvg = fxPts.reduce((s, p) => s + p.y, 0) / (fxPts.length || 1);
    const goods = [{ name: "Goods value", color: "#b48cff", pts: shown.map((p) => ({ d: p.date, y: p.goodsCny })) }];

    const cards = [
      { title: "Landed plan cost (SAR)", sub: `${shown.length} point(s) · core tier · since ${full[0].date}`, series: landed, yFmt: (v) => fmt(v), legend: true },
      { title: "SAR → CNY rate", sub: "tracked daily + weekly backfill", series: [{ name: "1 SAR in CNY", color: "#37d0c0", pts: fxPts }], yFmt: (v) => fmt4(v), refY: fxAvg, refLabel: "avg " + fmt4(fxAvg), legend: false },
      { title: "Goods value (CNY)", sub: "a jump = price edit in products.json", series: goods, yFmt: (v) => fmt(v), legend: true },
    ];
    grid.innerHTML = cards.map((c) => `
      <div class="chart-card">
        <h4>${c.title}</h4>
        <div class="chart-sub">${c.sub}</div>
        ${chartSVG(c.series, { yFmt: c.yFmt, refY: c.refY, refLabel: c.refLabel })}
        ${c.legend ? `<div class="legend">${c.series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join("")}</div>` : ""}
      </div>`).join("");

    const nameOf = Object.fromEntries(products.items.map((i) => [i.id, i.name]));
    const edits = [];
    for (let i = 1; i < full.length; i++) {
      const prev = full[i - 1].p || {}, cur = full[i].p || {};
      for (const id of new Set([...Object.keys(prev), ...Object.keys(cur)])) {
        const a = prev[id], b = cur[id];
        if (JSON.stringify(a) !== JSON.stringify(b)) edits.push({ date: full[i].date, id, a, b });
      }
    }
    const recent = edits.slice(-8).reverse();
    const editHtml = recent.length
      ? `<br>Price edits: ` + recent.map((e) =>
          `<span class="ed">${e.date} · ${esc(nameOf[e.id] || e.id)}: ${e.a ? `¥${e.a[0]}×${e.a[1]}` : "new"} → ${e.b ? `¥${e.b[0]}×${e.b[1]}` : "removed"}</span>`
        ).join(" &nbsp;|&nbsp; ")
      : `<br>No price edits yet - edit <b>data/products.json</b> and the change appears here after the next refresh.`;
    $("priceEdits").innerHTML = `Tracking since <b>${full[0].date}</b> · ${full.length} snapshot(s), one per day.` + editHtml;
  }

  const todayUtc = () => new Date().toISOString().slice(0, 10);

  function renderToday() {
    const call = summary.call;
    const vb = $("verdictBadge");
    vb.textContent = call.verdict;
    vb.className = "verdict-badge v-" + call.verdict.replace(/\s+/g, "-").toLowerCase();
    const cb = $("confBadge");
    cb.textContent = call.confidence;
    cb.className = "badge " + (call.confidence === "VERIFIED" ? "ok" : "warn");
    cb.title = call.confidence === "VERIFIED"
      ? "Built from live dual-source FX and tracked history"
      : "Depends on estimated list prices or static fare bands - verify before acting";
    $("callStamp").textContent = `generated ${new Date(summary.generatedAt).toUTCString().slice(5, 16)} · driver: ${call.driver}`;
    $("callReason").textContent = call.reasoning;
    $("changedLine").textContent = summary.diff;

    const tail = summary.decisionsTail || [];
    $("recentStrip").innerHTML = tail.length > 1
      ? `<div class="strip-label">recent calls</div>` + tail.map((d) =>
          `<span class="chip c-${d.verdict.replace(/\s+/g, "-").toLowerCase()}" title="${esc(d.date)}: ${esc(d.driver || "")}"><b>${d.date.slice(5)}</b> ${d.verdict}</span>`
        ).join("")
      : "";

    const box = $("briefBox"), b = D.brief;
    box.hidden = false;
    if (b && b.brief) {
      const stale = b.date !== todayUtc();
      $("briefModel").textContent = `${b.model}${b.usedFallback ? " · fallback" : ""}${stale ? " · from " + b.date : ""}`;
      $("briefModel").className = "pill" + (stale ? " stale" : " live");
      $("briefText").textContent = b.brief;
      $("briefMoves").innerHTML = (b.keyMoves || []).map((m) => `<li>${esc(m)}</li>`).join("");
      $("briefWatch").innerHTML = b.watch ? `<b>Watch:</b> ${esc(b.watch)}` : "";
    } else {
      $("briefModel").textContent = "pending";
      $("briefModel").className = "pill";
      $("briefText").textContent = "No brief yet - add the OPENROUTER_API_KEY repository secret and run the daily workflow (or OPENROUTER_API_KEY=... node scripts/update.mjs locally). The router model writes it once per day; free models cover it if the paid one fails.";
      $("briefMoves").innerHTML = "";
      $("briefWatch").textContent = "";
    }
  }

  function renderCrossed() {
    const x = summary.crossed;
    $("crossedMeta").textContent = `${x.crossed.length} crossed of ${x.withTargets} targets · ${x.total} items tracked`;
    if (x.crossed.length) {
      $("crossedGrid").innerHTML = x.crossed.map((i) => `
        <div class="card crossed-card hit">
          <div class="cc-name">${esc(i.name)}</div>
          <div class="cc-nums"><span class="now">¥${fmt(i.cny)}</span><span class="tgt">target ¥${fmt(i.target_cny)}</span><span class="badge ok">−${i.pctUnder}%</span></div>
          <div class="cc-sub">${i.bundle === "server" ? "Server" : "Home"} · ${i.priority} · unit lands ~${fmt(i.cny * sarPerCny * (1 + taxRate))} SAR + freight · ${esc(i.why || "")}</div>
        </div>`).join("");
    } else {
      const c = x.closest;
      $("crossedGrid").innerHTML = `
        <div class="card">
          <div class="hint">No targets crossed yet - nothing to buy on signal today.</div>
          ${c ? `<div class="cc-nums" style="margin-top:10px"><span class="cc-name">${esc(c.item.name)}</span><span class="now">¥${fmt(c.item.cny)}</span><span class="tgt">target ¥${fmt(c.item.target_cny)}</span><span class="badge warn">+${c.abovePct}%</span></div>` : ""}
          <div class="hint">Closest miss shown above. When a tracked estimate hits its target it appears here and drives a BUY NOW call.</div>
        </div>`;
    }
  }

  function renderReadiness() {
    const r = summary.readiness;
    const cls = r.band === "READY" ? "ok" : r.band === "BUILDING" ? "warn" : "info";
    const note = r.band === "READY"
      ? "Ready to book - readiness crossed 70 with fare movement actually tracked. The daily call will read BOOK FLIGHT until flights are checked off."
      : r.fare.deltaPct == null
        ? "Fare movement needs a second tracked check: do a live fare search via the links below, then update the route bands in data/config.json - the change lands in history and unlocks READY."
        : "Building: push target coverage and FX stability up, and watch the fare band - READY flips the daily call to BOOK FLIGHT.";
    $("readinessBox").innerHTML = `
      <div class="ready-layout">
        <div class="ready-score">
          <div class="score-num">${r.score}<small>/100</small></div>
          <span class="badge ${cls}">${r.band}</span>
          ${r.booked ? `<div style="margin-top:8px"><span class="badge info">FLIGHTS BOOKED</span></div>` : ""}
        </div>
        <div class="ready-comps">
          ${r.components.map((c) => `
            <div class="comp">
              <div class="comp-row"><span>${esc(c.label)}</span><b>${c.score}</b></div>
              <div class="bar mini"><i style="width:${c.score}%"></i></div>
              <div class="hint">${esc(c.value)}</div>
            </div>`).join("")}
        </div>
        <div class="ready-note hint">${esc(note)}</div>
      </div>`;
  }

  let checkOverrides = {};
  try { checkOverrides = JSON.parse(localStorage.getItem("checklist-ov") || "{}"); } catch { checkOverrides = {}; }
  const checkDone = (it) => (it.id in checkOverrides ? !!checkOverrides[it.id] : !!it.done);
  const checkSynced = () => summary.checklist.items.every((i) => checkDone(i) === !!i.done);

  function renderChecklist() {
    const items = summary.checklist.items;
    const done = items.filter(checkDone).length;
    const groups = [...new Set(items.map((i) => i.group))];
    $("checkMeta").textContent = `${done}/${items.length} done`;
    $("checkListBox").innerHTML = groups.map((g) => `
      <div class="check-group">
        <div class="check-group-title">${esc(g)}</div>
        ${items.filter((i) => i.group === g).map((i) => `
          <label class="check-item ${checkDone(i) ? "done" : ""}">
            <input type="checkbox" data-id="${esc(i.id)}" ${checkDone(i) ? "checked" : ""}>
            <span>${esc(i.label)}</span>
          </label>`).join("")}
      </div>`).join("");
    $("checkListBox").querySelectorAll("input[data-id]").forEach((el) =>
      el.addEventListener("change", () => {
        checkOverrides[el.dataset.id] = el.checked;
        try { localStorage.setItem("checklist-ov", JSON.stringify(checkOverrides)); } catch {}
        renderChecklist();
      })
    );
    $("checkHint").innerHTML = checkSynced()
      ? `State matches <b>data/checklist.json</b>. Toggles persist locally; commit the file to sync across machines.`
      : `Local toggles differ from <b>data/checklist.json</b> - click "Copy checklist.json", paste over the file and commit to make them permanent (the rule engine reads the committed file).`;
  }

  function wireCopyChecklist() {
    $("copyChecklist").addEventListener("click", async () => {
      const items = summary.checklist.items.map((i) => ({ ...i, done: checkDone(i) }));
      const txt = JSON.stringify({ items }, null, 2) + "\n";
      try {
        await navigator.clipboard.writeText(txt);
        $("checkHint").textContent = "Copied - paste over data/checklist.json and commit.";
      } catch {
        const ta = document.createElement("textarea");
        ta.value = txt; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); $("checkHint").textContent = "Copied - paste over data/checklist.json and commit."; }
        catch { $("checkHint").textContent = "Copy failed - select the JSON from data/checklist.json manually."; }
        ta.remove();
      }
    });
  }

  renderMeta();
  renderToday();
  renderCrossed();
  renderFx();
  renderHistRange();
  renderHistory();
  renderTierSwitch();
  renderBudgets();
  renderCalls();
  renderRoute();
  renderFit();
  wireNav();
  renderFilters();
  renderList();
  renderNews();
  renderReadiness();
  renderChecklist();
  wireCopyChecklist();
  renderTravel();
  renderFoot();
  renderCalc();
  $("calcCny").addEventListener("input", renderCalc);
  $("calcLocal").addEventListener("input", renderCalc);
})();
