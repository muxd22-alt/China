# China Buy-Plan — Execution Plan

Single source of truth for the trip + purchases. The dashboard (`index.html`) renders this plan with live numbers.

## 1. Goal & budgets

| Line | Budget (SAR) | Scope |
|---|---|---|
| Server & tech | 12,000 | Proxmox host, anti-cheat box, endpoints, networking, cameras |
| Home furnishing | 38,000 | Sofas, kitchen, bath, bedroom, lighting, decor, light electronics |
| **Total** | **50,000** | Includes 8,500 freight + 15% tax + 10% reserve (5,000) held back |

Freight model: one consolidated sea shipment, ~8,500 SAR fixed → heavier carts cost less per kilo.
Tax model: 15% on goods value (edit `data/config.json` if the real rate differs).

## 2. Architecture (locked decisions)

- **One Proxmox host** — Ryzen 9 7900X + X670E + 128GB DDR5 + RTX 3090 24GB.
  Game VM (GPU passthrough) + Sunshine → Moonlight to every room; LXCs for Jellyfin, AdGuard, cameras.
- **Second physical box** — used OEM tower + RTX 3060, bare-metal Windows, for kernel anti-cheat games
  (Valorant / Fortnite / PUBG refuse VMs). This is non-negotiable if those games matter.
- **Endpoints per room** — mini-PC or Mi Box running Moonlight locally; KB/mouse pair to the endpoint, never to the server.
- **AI on the same 3090** — vLLM/SGLang with PagedAttention + KV-cache offload to the 128GB RAM,
  scheduled around gaming (single GPU = one full-quality session at a time).
- Network: Ethernet per room (run cables **before** furniture lands), 2.5GbE switch.

## 3. Buy order (phases — encoded in `data/products.json`)

| Phase | What | Why this order |
|---|---|---|
| 1 — commit early | case, mobo, CPU, PSU, UPS, AIO, network, sofa/kitchen/bed | These age slowest; order day one |
| 2 — mid | RAM, NVMe, endpoints, peripherals, cameras, decor | Medium volatility |
| 3 — last | GPUs (3090, 3060), HDDs, OEM box, gadgets | Most volatile prices — verify locally before paying |

**Rules:** PSU + UPS = new only. Everything else used is fair game — but GPU-Z VRAM + 10-min fan test before cash.
Xianyu for parts (negotiate 10–15%), Huaqiangbei/SEG for GPUs, Foshan/1688 for furniture.

## 4. Decision engine (how the dashboard thinks)

- **FX signal** — live SAR→CNY vs an 8-week weekly average (dual-source verified):
  - ≤ −2% below average → **FAVORABLE**: convert and place big orders this week.
  - ≥ +2% above average → **WAIT**: split orders or hold conversions.
- **Tier toggle** — P0 / Core P0–P1 / +P2 / Everything shows the same budget at four commitment levels.
  Server is the tight line: if it runs over while home sits on surplus → rebalance sub-budgets, keep the 50K total.
- **Landed calculator** — any item: `SAR = CNY × rate × 1.15 + freight share`. Rule of thumb:
  if landed > ~90% of the local price → **do not ship it**.
- **Reserve** — 10% never committed. Freight quotes and FX both move.

## 5. Timeline (to end-2026)

1. **Now → trip:** shortlist exact SKUs, verify prices in the dashboard daily, run the cables plan for rooms.
2. **On arrival in China:** Phase 1 orders immediately (sea freight is 3–6 weeks), Phase 2 within week one.
3. **Before flying back:** Phase 3 — GPUs/HDDs only after live testing; compare against local Saudi prices first.
4. **After arrival:** Proxmox install, Moonlight endpoints per room, cameras local-only, cancel what the stack replaces.
5. **Ongoing:** dashboard refreshes daily at 08:00 Riyadh — act on FAVERABLE/WAIT signals as they appear.

## 6. Trip logistics (estimates — verify live)

- Routes: JED/RUH → Shenzhen (Huaqiangbei run) or Beijing; fares are banded in the dashboard with deep links.
- Stays: Shenzhen/Foshan ¥120–450/night — converted live in the Travel section.

## 7. How to keep it fresh

```
node scripts/update.mjs     # local refresh any time
```
GitHub Actions runs the same command daily at 05:00 UTC and commits `data/`.
Edit prices freely in `data/products.json`; budgets/logistics/tips live in `data/config.json`.

**Price history:** every run writes a daily snapshot to `data/history.json` (FX, landed totals, goods value, all 29 list prices). The **Price History** charts graph it since day one — the FX chart also backfills weekly points, and any edit you make to a price shows up as a logged change event on the next refresh. Snapshots are capped at 730 days; same-day re-runs replace that day's point.

## 8. Daily decision engine

- **Today's Call** — one rule-engine verdict (`BUY NOW / HOLD / WATCH / BOOK FLIGHT`) synthesized from FX signal + budget headroom + crossed targets + trip readiness, with numeric reasoning and a `VERIFIED / ESTIMATE` confidence tag. Every run appends to `data/decisions.json`; the panel shows the diff since yesterday and a strip of recent calls.
- **Crossed thresholds** — items in `products.json` carry an optional `target_cny`; anything at/below target is pulled out of the list into an actionable panel and drives `BUY NOW`. Optional `checked` (YYYY-MM-DD) upgrades confidence to VERIFIED within 30 days.
- **Trip readiness** (separate from in-China phases) — FX trend stability (40%) + P0/P1 target coverage (30%) + flight-fare movement (30%). Fare movement needs two tracked checks: after a live fare search, edit the route bands in `config.json` and history records the change. Band `READY` flips the daily call to `BOOK FLIGHT`.
- **Pre-trip checklist** — `data/checklist.json` (visa, fares, flights, phase-1 list…) with persisted state; toggle locally, then **Copy checklist.json** and commit to sync.
- **Daily Brief (LLM, once per day)** — `scripts/update.mjs` sends the master plan + verified numbers + decision log + trend + headlines to OpenRouter (`typesafe/jev-router`, falling back to the free Nemotron/Gemma models) and stores strict-JSON output in `data/brief.json`. Key lives in the `OPENROUTER_API_KEY` GitHub secret; local runs without a key skip it gracefully. The gate makes at most one paid call per UTC day.

## 9. Server-route comparison (15K SAR cap)

- **What it is** — a second, alternative path: instead of the 50K buy plan, pick one platform for a single ~15K-SAR all-in home server. `data/config.json` carries the whole dataset: `route.priorities` (six requirement rows with a current `pick`), `route.overall` verdict, `platforms` (7 cards: used-Threadripper-PRO build, new 3090 build, Chinese Strix Halo, global Strix Halo, DGX Spark, Mac Studio, Xiaomi AI Cube — each with price vs-cap bar, memory/bandwidth/power/AI/OS, variants, pros/cons, `bestFor`), and `modelClasses`/`fitColumns` for the fit matrix.
- **The deciding factor — "What Runs Where"** — a local-model fit matrix: 6 model classes (8–14B → 405B/cluster) × 6 platforms, colored `fast / fits / slow / tight / dual / —`. Rendered by `renderFit()` in `app.js` as a sticky-header table (scrolls horizontally on mobile) plus a legend. The recommended row is the only one where Proxmox + GPU passthrough + anti-cheat gaming + 8TB all fit under the cap; Chinese Strix Halo is the value pick (~7.8K for 128GB after the DRAM shortage doubled prices), used TR PRO the CUDA pick.
- **Wiring** — Server Route sits between the cost sections and the buy list (`#sec-route`, jump-nav pill, scrollspy). The news feeds were re-pointed to platform/local-AI queries so relevant headlines (Strix restocks, DGX pricing, Mac launches) surface daily, and the LLM brief prompt (`decide.mjs: buildPrompt`) now receives `route` + `platforms` so it can flag any headline that changes the platform verdict.
- **Mobile** — the whole UI is mobile-first (base CSS is the phone layout; `min-width` at 640/900/1120). Buy list becomes labelled cards below 640px via `data-label`/`td::before`, jump-nav is a sticky scrollable pill row, fit table scrolls inside its wrapper.
