# China Buy-Plan Dashboard

One **50,000 SAR** plan for a four-family home — a racked homelab, a full furniture buy-list, and a
Shenzhen/Foshan sourcing trip — tracked by a self-refreshing static dashboard (no build step, no framework).

**Live:** https://muxd22-alt.github.io/China/ · **Refreshes daily** at 05:00 UTC (08:00 Riyadh) via GitHub Actions.

## The plan in one screen

| | |
|---|---|
| Total budget | **50,000 SAR** — goods + freight 8,500 + 15% import tax + 10% reserve (5,000) |
| Server & tech | **23,000 SAR** — cheap AM4 Proxmox core + 6× BC-250 (2 planner / 3 workers / 1 flex), 10GbE rack, airflow/3D-print kit, KV-scratch NVMe |
| Home furnishing | **27,000 SAR** — living room, kitchen, bath, bedroom (no wardrobe), lighting, controllers |
| Deployable ceiling | **45,000 SAR** (the 5,000 reserve is never committed) |
| Landed-cost rule | `SAR = CNY × rate × 1.15 + freight share` — ship only if landed < ~90% of the local price |
| Trip | Direct **RUH ↔ SZX** (China Southern **CZ5007**, 3×/week) → Shenzhen (Huaqiangbei/SEG) for tech, Foshan (Lecong) for furniture |

## Dashboard sections (`index.html`)

| # | Section | What it answers |
|---|---|---|
| 01 | **Today's Call** | Rule-engine verdict — `BUY NOW / HOLD / WATCH / BOOK FLIGHT` — with numeric reasoning, confidence tag, and the diff since yesterday |
| 02 | **Money** | FX signal (±2% vs an 8-week average, dual-source), budget bars per commitment tier (P0–P3), crossed targets, price-history charts, the daily LLM brief |
| 03 | **The Stack** | The rack diagram (6 nodes), answer cards (10GbE, redundancy, power…), Proxmox service map, docs index, model-fit matrix |
| 04 | **Buy List** | All 43 line items — filters, sort, search, per-line landed calculator, listing-judge badge |
| 05 | **Trip** | Route bands + fares, trip readiness (85/100), pre-trip checklist with copy-sync |
| 06 | **Daily Reading** | News feeds (local AI, hardware platforms, open models…) with show-more |

## Repository map

| Path | What it is |
|---|---|
| `index.html`, `assets/` | the whole UI — mobile-first, vanilla JS (`app.js`) + CSS |
| `data/config.json` | budgets, logistics/FX settings, model routing, tips, flight bands, deepseek tier |
| `data/products.json` | every line item: CNY price, qty, priority, phase, bundle, target price |
| `data/dashboard.js` | generated payload the page loads — **never edit by hand** |
| `data/*.json` | rates, news, decisions, history, brief, checklist — also generated |
| `scripts/update.mjs` | the pipeline: FX → news → budgets → call → readiness → brief |
| `scripts/decide.mjs` | the exact decision rules (call, readiness) + the LLM brief prompt |
| `scripts/judge.mjs` | advisory listing judge (Laya ONNX + optional free-LLM second opinion) |
| `scripts/laya-steps.yml` | judge steps for a workflow (already wired into `daily.yml`) |
| `.github/workflows/daily.yml` | the daily refresh job |
| `PLAN.md` | operating manual: budgets, phases, decision engine, timeline |
| `homelab.md` | master stack analysis: rack map, BOM, service map, inference tiers, KV roadmap, toolkit verdict |
| `pc.md`, `furnteatures.md` | architecture archive + home sourcing detail |
| `bc250-steamos-real-toolkit-main/` | vendored third-party toolkit for reference — **git-ignored** |

## How it stays fresh

```bash
node scripts/update.mjs     # local refresh; OPENROUTER_API_KEY optional (brief skips without it)
```

Actions runs the same command daily and commits `data/`. Edit prices in `products.json` and budgets
in `config.json`, run the refresh, commit — never hand-edit generated files. Every run snapshots to
`data/history.json`, which feeds the Price History charts and logs each price change as an event.

## The stack (full analysis in `homelab.md`)

- **One rack, zero mini-PCs, no high-end tower:** 12U–18U cabinet — cheap AM4 Proxmox core
  (5700G + 128GB DDR4, iGPU VAAPI, ZFS mirrors, PXE) + two bare-metal CachyOS nodes carrying
  **6× AMD BC-250 boards (~81GB usable model pool)** over 10GbE (2 planner + 3 workers + 1 flex
  game board), plus a bare-metal 3060 Windows box for kernel anti-cheat titles. The 3090 waits at
  optional P3 — `homelab.md` §13 has the limits sheet.
- **Proxmox services:** Game VM (optional 3090), Home Assistant, Jellyfin, Frigate NVR, Samba/NFS,
  AdGuard, Uptime Kuma/Grafana, NUT, dashboard, downloads (`homelab.md` §9).
- **Two golden images:** `golden-infer.img` (default) and `golden-console.img` (SteamOS Beta +
  **bc250-steamos-real-toolkit**) — PXE-boot the flex board to turn it into a couch gaming
  console, Clonezilla multicasts ~100GB in ~3 min. Toolkit verdict: adopt the **Mild-undervolt
  profile** (3.5 GHz/1600 MHz), CoolerControl PWM curves, UMA split and the **24→40CU unlock**
  (+1.54× llama.cpp); SteamOS lives only on the console image (`homelab.md` §12).
- **Inference tiers** (`homelab.md` §10):
  - **Tier 0 — DeepSeek-V4.1-Flash via API:** 763B params ≈ 380 GB at 4-bit = 4.7× the whole
    pool → API-only, spend capped ~150 SAR/mo, long-context agentic escalation, never the brief.
  - **Tier 1** Node A planner (14B–32B local) · **Tier 2** Node B workers (7B–8B parallel) ·
    **Tier 3** 70B-class batch across 4+ boards (or the optional 3090 if bought).
- **KV-cache future-proofing:** llama.cpp KV-quant + prefix reuse now; KV offload later onto the
  dedicated 2TB KV-scratch NVMe — DeepSeek's 890 B/token KV is why 1M-ctx API sessions are cheap
  and why the next compression advance should be a config change, not a purchase (`homelab.md` §11).

## Listing judge (advisory)

- Drop scraped Xianyu/1688 text into `data/inbox.json`:
  `[ { "id": "3090-xianyu-1", "wanted": "RTX 3090 24GB", "text": "…", "price_cny": 4200 } ]`
- After `update.mjs`, CI runs `scripts/judge.mjs` (Laya ONNX, ~1.7 GB weights, cached once) and
  writes `ok / unsure / review` flags to `data/judgements.json`; unsure bands (0.3–0.7) escalate to
  one free OpenRouter model (`MAX_LLM_CALLS=20`). The Buy section shows a badge.
- **Advisory only** — `decide.mjs` never reads judgements. FX and landed-cost math stay exact code.
  Calibrate against what you actually find in person for a couple of weeks before trusting flags.

## Buying & trip rules

- **Xianyu / Huaqiangbei:** negotiate 10–15% down; pay only after a live boot, GPU-Z VRAM check and
  fan test. Never pay before the test.
- **1688 vs Xianyu:** factory-refurbished units often run 30–40% under retail with traceable
  warranty; bundle furniture into one Foshan Lecong factory order for the export-carton discount.
- **Anti-cheat titles** (Valorant/Fortnite/PUBG) refuse VMs — the 3060 bare-metal box is non-negotiable.
- **Reserve 10%** for freight/FX movement; sea freight runs 3–6 weeks — Phase 1 orders land day one.

## Gotchas

- `bc250-steamos-real-toolkit-main/` is vendored for reference and git-ignored — don't commit it.
- When rebasing over the Actions refresh, git flips `--ours`/`--theirs`: keep the `data/` side you
  regenerated locally, then re-run `update.mjs` if in doubt.
- `OPENROUTER_API_KEY` exists only as an Actions secret; local runs skip the brief gracefully.
