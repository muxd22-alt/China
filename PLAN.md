# China Buy-Plan — Execution Plan

Single source of truth for the trip + purchases. The dashboard (`index.html`) renders this plan with live numbers.

## 1. Goal & budgets

| Line | Budget (SAR) | Scope |
|---|---|---|
| Server & tech | 24,800 | Proxmox core host, 5x BC-250 planner/worker nodes, anti-cheat box, 10GbE backbone, rack + 3D-printed airflow kit, KV-scratch NVMe, endpoints, cameras |
| Home furnishing | 25,200 | Sofas, kitchen, bath, bedroom (no wardrobe), lighting, decor, controllers, light electronics |
| **Total** | **50,000** | Includes 8,500 freight + 15% tax + 10% reserve (5,000) held back → **45,000 deployable ceiling** |

Rebalanced Sep 2026 (+1,800 server / −1,800 home, total unchanged) for airflow/3D-printing parts,
the 3rd (KV) NVMe and the 2000W PSU sizing — home still covers its full P3 scope with large headroom.

Freight model: one consolidated sea shipment, ~8,500 SAR fixed → heavier carts cost less per kilo.
Tax model: 15% on goods value (edit `data/config.json` if the real rate differs).

## 2. Architecture (locked decisions)

- **Core host (NAS / virtualization)** — Ryzen 9 7900X + X670E + 128GB DDR5 + RTX 3090.
  Proxmox: Game VM (GPU passthrough) + Sunshine → Moonlight to every TV;   LXCs for Jellyfin, AdGuard, cameras;
  storage: 2x 2TB NVMe (VM/models + game library) + two ZFS mirror pairs (8TB x4 = 16TB usable);
  PXE host for the fleet. Second physical box: used OEM tower + RTX 3060, bare-metal Windows,
  for kernel anti-cheat games (Valorant / Fortnite / PUBG refuse VMs) — non-negotiable if those games matter.
- **BC-250 cluster (LLM compute) — 5x AMD BC-250 16GB GDDR6 boards from Xianyu (~650–850 CNY each)**
  (ex-mining cut-down PS5 APU: 6C Zen2 + 24 RDNA2 CU, 16GB shared @ 448 GB/s, 220W, Linux/RADV only):
  - **Node A — 2x BC-250 (~32GB VRAM):** Planner / Orchestrator. Runs the 14B–32B quantized orchestrator
    (e.g. Qwen-32B Q4) via llama.cpp Vulkan.
  - **Node B — 3x BC-250 (~48GB VRAM):** Execution / Agentic worker. Runs parallel 7B/8B tool-calling
    agents without VRAM swapping.
  - Each node is a cheap used carrier host (board + CPU + 32GB) + ConnectX-3 NIC, mounted in an open
    frame / 4U rack in a 12U–18U cabinet.
- **10GbE SFP+ backbone (mandatory)** — 3x Mellanox ConnectX-3 (~100–150 CNY each) + TP-Link TL-ST1008F
  8-port switch (~750 CNY). ~1.1 GB/s between Node A / Node B / core: llama.cpp RPC KV-cache and tensor
  transfer are the whole reason this exists — 1GbE (~110 MB/s) would strangle it.
- **Power & cooling** — 1600–2000W redundant (1+1) enterprise PSU + 12V breakout board feeds the 5x 220W
  BC-250 spikes; Delta-class 4000+ RPM fans aimed at the passive heatsinks **and the GDDR6** (runs extremely hot).
- **Endpoints per room** — TV boxes (Mi Box x2), not mini-PCs: Moonlight/Jellyfin decode at the TV,
  KB/mouse pair to the endpoint, never to the server.
- **AI split** — LLMs live on the BC-250 nodes (planner + workers); the 3090 keeps the Game VM and
  doubles as the CUDA box for 70B-class jobs when nobody is gaming.
- **Mass OS deployment (PXE multicast)** — Clonezilla SE on the NAS pushes golden 100GB NVMe images
  (CachyOS/Ubuntu + Mesa RADV + `amdgpu.sg_display=0` + BC-250 SMU governor script) to all 5 node drives
  over 10GbE in under ~3 minutes per batch. **Two goldens:** `golden-infer.img` (default) and
  `golden-console.img` (SteamOS Beta + bc250-steamos-real-toolkit — see below).
- **Toolkit adoption (bc250-steamos-real-toolkit, read & decided)** — nodes keep CachyOS but adopt the
  toolkit's **Mild (undervolt) profile** (CPU 3.5GHz/GPU 1600MHz, tested stable 8c+40CU on 460W),
  **CoolerControl PWM fan curves**, and the **UMA 512MB split**; 8c/40CU unlocks are opt-in flags after
  base stability. SteamOS Beta's kernel churn is accepted ONLY on the console image, where PXE
  re-clones in minutes. **Console mode:** one Node B carrier PXE-boots the console image for couch
  gaming (FSR4/Sunshine) — same rack, second simultaneous gaming path beside the 3090 Game VM.
- **Inference tiers** — Tier 0 = **DeepSeek-V4.1-Flash via API** (763B params ≈ 380GB at 4-bit = 4.7×
  the whole cluster → API-only; 1M-ctx agentic escalation, spend capped ~150 SAR/mo, never the daily
  brief). Tier 1 = Node A planner (14B–32B local), Tier 2 = Node B workers (7B–8B), Tier 3 = 3090
  batch. KV-cache compression (890B/token in V4.1) is tracked as the roadmap: llama.cpp KV-quant +
  prefix reuse now, KV offload later onto the **dedicated 2TB KV-scratch NVMe** (bought so the next
  compression advance is config, not hardware). Full analysis: `homelab.md` §10–§12.
- **Proxmox service map** — Game VM (3090), Home Assistant, Jellyfin, Frigate NVR, Samba/NFS,
  AdGuard, Uptime Kuma+Grafana, NUT, dashboard, downloads — table in `homelab.md` §9. ZFS pools
  native to Proxmox (no nested NAS OS); nodes stay bare-metal CachyOS.
- Network: Ethernet per room (run cables **before** furniture lands) on top of the 10GbE core.

## 3. Buy order (phases — encoded in `data/products.json`)

| Phase | What | Why this order |
|---|---|---|
| 1 — commit early | case, mobo, CPU, PSU, UPS, AIO, node carrier hosts, redundant 2000W PSU + breakout, 10GbE NICs/switch, rack + cabinet, network, sofa/kitchen/bed | These age slowest; order day one |
| 2 — mid | RAM, NVMe (incl. KV scratch), BC-250 boards (+ 10 PWM fans, 3D-print kit), Mi Boxes, controllers, peripherals, cameras, decor, lighting/curtains | Used boards: validate one carrier first, then the rest |
| 3 — last | GPUs (3090, 3060), HDDs, OEM box, gadgets, 3D printer (skip if owned) | Most volatile prices — verify locally before paying |

**Rules:** ATX PSU + UPS = new only (the redundant mining PSU for the BC-250 nodes is the one used exception — load-test it).
Everything else used is fair game — but GPU-Z VRAM + 10-min fan test before cash, and a live boot test on every BC-250.
Sourcing: **Shenzhen / Huaqiangbei** for BC-250s, GPUs and 10GbE gear; **Foshan / Lecong** for the bedroom and furniture;
**Xianyu** for used enterprise hardware (negotiate 10–15%).

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
4. **After arrival:** Proxmox install, PXE-multicast the golden image to the BC-250 node drives (Clonezilla SE over 10GbE),
   Moonlight endpoints per room, cameras local-only, cancel what the stack replaces.
5. **Ongoing:** dashboard refreshes daily at 08:00 Riyadh — act on FAVERABLE/WAIT signals as they appear.

## 6. Trip logistics (estimates — verify live)

- **Route locked:** direct **RUH ↔ SZX nonstop** (China Southern CZ5007, ~8h, 3×/week; Saudia's RUH–SZX
  nonstop is cargo-only). JED and PVG bands remain as fallbacks — all banded in the dashboard with deep links.
- Sourcing map: **Shenzhen (Huaqiangbei/SEG)** → BC-250s, GPUs, 10GbE gear · **Foshan (Lecong)** → bedroom + furniture ·
  **Xianyu** → used enterprise hardware, carrier hosts, ConnectX-3.
- Stays: Shenzhen/Foshan ¥120–450/night — converted live in the Travel section.

## 7. How to keep it fresh

```
node scripts/update.mjs     # local refresh any time
```
GitHub Actions runs the same command daily at 05:00 UTC and commits `data/`.
Edit prices freely in `data/products.json`; budgets/logistics/tips live in `data/config.json`.

**Price history:** every run writes a daily snapshot to `data/history.json` (FX, landed totals, goods value, all list prices). The **Price History** charts graph it since day one — the FX chart also backfills weekly points, and any edit you make to a price shows up as a logged change event on the next refresh. Snapshots are capped at 730 days; same-day re-runs replace that day's point.

## 8. Daily decision engine

- **Today's Call** — one rule-engine verdict (`BUY NOW / HOLD / WATCH / BOOK FLIGHT`) synthesized from FX signal + budget headroom + crossed targets + trip readiness, with numeric reasoning and a `VERIFIED / ESTIMATE` confidence tag. Every run appends to `data/decisions.json`; the panel shows the diff since yesterday and a strip of recent calls.
- **Crossed thresholds** — items in `products.json` carry an optional `target_cny`; anything at/below target is pulled out of the list into an actionable panel and drives `BUY NOW`. Optional `checked` (YYYY-MM-DD) upgrades confidence to VERIFIED within 30 days.
- **Trip readiness** (separate from in-China phases) — FX trend stability (40%) + P0/P1 target coverage (30%) + flight-fare movement (30%). Fare movement needs two tracked checks: after a live fare search, edit the route bands in `config.json` and history records the change. Band `READY` flips the daily call to `BOOK FLIGHT`.
- **Pre-trip checklist** — `data/checklist.json` (visa, fares, flights, phase-1 list…) with persisted state; toggle locally, then **Copy checklist.json** and commit to sync.
- **Daily Brief (LLM, once per day)** — `scripts/update.mjs` sends the master plan + verified numbers + decision log + trend + headlines to OpenRouter (`typesafe/jev-router`, falling back to the free Nemotron/Gemma models) and stores strict-JSON output in `data/brief.json`. Key lives in the `OPENROUTER_API_KEY` GitHub secret; local runs without a key skip it gracefully. The gate makes at most one paid call per UTC day.
- **Listing judge (advisory, Sep 2026)** — drop scraped Xianyu/1688 listing text into `data/inbox.json` (`[{ "id", "wanted", "text", "price_cny" }]`); after `update.mjs`, the workflow runs `scripts/judge.mjs` (Laya ONNX, ~1.7GB weights, cached) and writes `ok/unsure/review` flags to `data/judgements.json` — unsure bands (0.3–0.7) escalate to one free OpenRouter model, capped at `MAX_LLM_CALLS=20`. The Buy section shows a badge; **advisory only** — `decide.mjs` never reads judgements (FX ±2% and landed-cost math stay exact code), and step failures (`continue-on-error`) never block the daily refresh.

## 9. Server-route comparison (15K SAR cap)

- **What it is** — a second, alternative path: instead of the 50K buy plan, pick one platform for a single ~15K-SAR all-in home server. `data/config.json` carries the whole dataset: `route.priorities` (six requirement rows with a current `pick`), `route.overall` verdict, `platforms` (7 cards: used-Threadripper-PRO build, new 3090 build, Chinese Strix Halo, global Strix Halo, DGX Spark, Mac Studio, Xiaomi AI Cube — each with price vs-cap bar, memory/bandwidth/power/AI/OS, variants, pros/cons, `bestFor`), and `modelClasses`/`fitColumns` for the fit matrix.
- **The deciding factor — "What Runs Where"** — a local-model fit matrix: 6 model classes (8–14B → 405B/cluster) × 6 platforms, colored `fast / fits / slow / tight / dual / —`. Rendered by `renderFit()` in `app.js` as a sticky-header table (scrolls horizontally on mobile) plus a legend. The recommended row is the only one where Proxmox + GPU passthrough + anti-cheat gaming + 8TB all fit under the cap; Chinese Strix Halo is the value pick (~7.8K for 128GB after the DRAM shortage doubled prices), used TR PRO the CUDA pick.
- **Wiring** — Server Route sits between the cost sections and the buy list (`#sec-route`, jump-nav pill, scrollspy). The news feeds were re-pointed to platform/local-AI queries so relevant headlines (Strix restocks, DGX pricing, Mac launches) surface daily, and the LLM brief prompt (`decide.mjs: buildPrompt`) now receives `route` + `platforms` so it can flag any headline that changes the platform verdict.
- **Mobile** — the whole UI is mobile-first (base CSS is the phone layout; `min-width` at 640/900/1120). Buy list becomes labelled cards below 640px via `data-label`/`td::before`, jump-nav is a sticky scrollable pill row, fit table scrolls inside its wrapper.
