# Homelab Master Plan — the complete package

One rack. Zero mini-PCs. Everything below is what the buy-list in `data/products.json` funds, what
`PLAN.md` phases, and what the dashboard's **Stack** section visualizes. Budget frame: 50K SAR total,
**23K server line / 27K home line** (BC-250-first rebuild, Sep 2026 — the boards are the compute,
the high-end core PC is cancelled), 45K deployable, freight 8,500 + 15% tax + 10% reserve.

## 0. What this replaces

Scattered mini-PCs / one-off boxes → **one racked, redundant, cloned-from-golden-image cluster** bought
from the Chinese secondary market (Xianyu / Huaqiangbei / Foshan) at a fraction of brand-name pricing —
**and the high-end tower PC**: LLM pool, gaming and streaming encode move onto six BC-250 boards; only
the cheap plumbing (storage, VMs, PXE) stays on x86 — see §13 for the limits sheet.

## 1. The rack map

```
                        ┌────────────────────────────────────────────┐
                        │  10GbE SFP+ switch · TP-Link TL-ST1008F    │
                        │  (backbone: inference traffic + PXE + NAS) │
                        └──────┬─────────────────────────┬───────────┘
                               │                         │
        ┌──────────────────────┴─────────┐   ┌───────────┴──────────────────────┐
        │  NODE A · Planner (2×BC-250)   │   │  NODE B · Workers+flex (4×BC-250)│
        │  ~28GB usable · 14B–32B Q4     │   │  ~54GB usable · 3 workers+1 game │
        │  orchestrator · llama.cpp VK   │   │  tool-callers · flex = Sunshine  │
        │  ConnectX-3 10GbE              │   │  ConnectX-3 10GbE                │
        └────────────────────────────────┘   └──────────────────────────────────┘
                               │                         │
                        ┌──────┴─────────────────────────┴───────────┐
                        │  CORE · NAS / virtualization host          │
                        │  Ryzen 5 5700G · B550 · 128GB DDR4 (iGPU)  │
                        │  plumbing only · optional 3090 sits at P3  │
                        │  3×2TB NVMe (VM · games · KV scratch)      │
                        │  8TB×2 mirror (media+cameras) · 8TB×2 (bkp)│
                        │  Proxmox · Jellyfin · ZFS · PXE/Clonezilla │
                        └────────────────────────────────────────────┘
   Edge: Mi Box ×2 at the TVs (Moonlight/Jellyfin decode) · KB/mouse pair to the endpoint
   Power: 1+1 2000W redundant PSU + breakout (6 boards, Mild ≈1.1kW 24/7) · new 850W ATX + 1500VA UPS (core)
   Cooling: 2× Delta PWM 120mm per board (heatsink + GDDR6) + cabinet exhaust, curves in CoolerControl
   Airflow: 3D-printed shrouds/closers seal fan pressure into the heatsink channels (PETG)
   Rack: 12U–18U cabinet (600mm) + 2× 4U open-frame shelves — BC-250 = 305mm, no off-the-shelf case
   Console mode: Node B's flex board PXE-boots the golden-console image (SteamOS Beta + bc250 toolkit)
                 for couch gaming; workers keep 3, inference never drops below 2+3 — see §12
```

## 2. Bill of materials — where each line comes from

| # | Item | Qty | Where | Est. | Notes |
|---|---|---|---|---|---|
| 1 | AMD BC-250 16GB compute board | 6 | **Xianyu (闲鱼)** | ¥650–850 ea | Ex-mining PS5 APU; each board IS a computer — test boot + GDDR6 fan each |
| 2 | BC-250 IO carriers (riser + boot NVMe + 12V feed) | 6 | **Xianyu / Taobao** | ~¥350 ea | Per board — PCIe riser, boot NVMe, 12V power. No CPU/RAM host exists (old AM4-skeleton idea dropped) |
| 3 | Mellanox ConnectX-3 10GbE SFP+ + DAC | 6 | **Xianyu / Taobao** | ~¥110 ea | One per board (RPC + PXE multicast); core host stays on 2.5GbE. DACs ~¥30 each |
| 4 | TP-Link TL-ST1008F 8-port 10G SFP+ | 1 | **Taobao / JD** | ~¥750 | See §4 — yes, you need it |
| 5 | 2000W+2000W redundant PSU (1+1) + breakout | 1 | **Xianyu / Huaqiangbei** | ~¥750 | 6 boards: Mild-undervolt holds 24/7 ~1.1kW; 8c+40CU worst case can touch one 2000W leg — stagger it. Load-test + burn in |
| 6 | 12U–18U cabinet (600mm) + 2× 4U open-frame shelves | 1 | **Taobao / Xianyu** | ~¥600 | Off-the-shelf cases don't fit 305mm boards |
| 7 | High-static 120mm PWM fans (Delta class) | 14 | **Taobao** | ~¥40 ea | 2 per board ×6 (heatsink + GDDR6) + 2 cabinet exhaust; curves in CoolerControl |
| 8 | Core host: 5700G + B550 + 128GB DDR4 (iGPU VAAPI) | 1 | **Xianyu** | ~¥3,430 | `srv-cpu/mobo/ram/case/aio/psu/ups` — plumbing only (storage/VMs/PXE); +¥2,850 adds the optional 3090 at P3 |
| 9 | Anti-cheat box: OEM tower + 3060 | 1 | **Xianyu / Huaqiangbei** | ~¥1,680 | Bare-metal Windows, kernel anti-cheat games |
| 10 | Storage: 3×2TB NVMe + 4×8TB HDD | — | **Xianyu / JD** | ~¥3,640 | NVMe: VM/models · games · **KV/agent scratch**. HDD: 2 mirror pairs |
| 11 | 10GbE + 2.5GbE room runs, cameras, KB/M, Mi Box ×2, controllers ×2 | — | **Taobao / Xianyu** | ~¥4,360 | Cables BEFORE furniture lands |
| 12 | Bedroom bundle: bed+mattress+nightstands, linens, lighting, curtains, rug, LED mirror — **NO wardrobe** | — | **Foshan Lecong / Taobao** | ~¥5,800 | See `furnteatures.md` |
| 13 | 3D-printed airflow kit: shrouds, closers, ducts + 6× PETG spools | 1 | **Taobao** | ~¥500 | Print the closers so fan pressure hits the heatsinks, not the room |
| 14 | 3D printer (Neptune 4 class) — skip if you own one | 1 | **Taobao / JD** | ~¥900 | P3 optional; the rack's custom parts + endless home fixes |
| 15 | DP→HDMI 2.1 dongle (Ugreen CH7218 PCON) | 1 | **Taobao** | ~¥150 | Boards are DP-only — dongle = direct-HDMI console mode (toolkit CH7218 patch + EDID); Moonlight via Mi Box needs none |

Everything marked Xianyu/Huaqiangbei: **negotiate 10–15% down, pay after a live test**
(boot it, run the VRAM/fan test, check GDDR6 temps on the BC-250s).

## 3. Compute split — what runs where (BC-250-first)

- **Pool math:** each board is one 16GB unified pool (SoC + GDDR6 on-board, OS holds ~2GB) —
  **6 boards ≈ 81GB usable for models**. That is the entire local-tier capacity; the cheap host
  does NOT hold models (its 128GB DDR4 is services + the future KV-offload lane).
- **Node A (2× BC-250 ≈ 28GB usable):** the single 14B–32B orchestrator ("all-in helper planner").
  One model resident, plans tasks, talks to the workers. Never leaves inference duty.
- **Node B (4× BC-250 ≈ 54GB usable):** 3 boards run parallel 7B/8B agentic tool-callers — several
  agents at once without swapping; the **4th board is the flex**: a 4th worker when agents need it,
  or a Sunshine game node when the family plays (systemd target flips it — inference never drops
  below 2+3 while someone games).
- **Cross-node:** llama.cpp RPC / split inference across A and B over the 10GbE link (§4). Boards are
  Linux-only (RADV/Vulkan); UMA split + SMU governor baked into the golden image on every board.
- **Core host (cheap AM4 — 5700G + B550 + 128GB DDR4):** the plumbing only: Proxmox LXCs for Jellyfin
  (iGPU VAAPI transcode), AdGuard, NVR, dashboard; ZFS pools; PXE/Clonezilla server. An optional
  3090 (P3) adds a Game VM **only if bought**. The 3060 OEM box stays bare-metal Windows for kernel
  anti-cheat titles (Valorant/Fortnite/PUBG refuse VMs) — non-negotiable gap-filler.
- **Edge:** Mi Box ×2 — decode only at the TV. No mini-PCs anywhere in the chain.

## 4. The 10GbE question — future-proof, inference, or both?

**Both — it's not optional for this build.** Three concrete reasons, in priority order:

1. **Inference (the real reason):** KV-cache/tensor traffic between Node A ↔ Node B and between
   nodes and the core host during RPC-split runs. 1GbE ≈ 110 MB/s strangles it; 10GbE ≈ 1.1 GB/s
   makes multi-node splits viable. Cards are ¥110 — the cheapest part of the plan that you'd regret skipping.
2. **Mass OS deployment:** the 100GB golden image multicasts to 6 node drives in minutes, not hours.
3. **NAS + future:** Jellyfin 4K remuxes, camera archives, and any future 2nd switch/NAS share the
   same fabric. 2.5GbE stays as the *room* tier (endpoints, cameras) — the SFP+ switch is the backbone.

## 5. Power & cooling (the honest math)

| Domain | Load | Supply |
|---|---|---|
| 6× BC-250 (24/7 inference, Mild-undervolt profile) | ~6 × 180W ≈ **1,080W continuous**, idle ~35W/board | 1+1 **2000W** + 12V breakout — N+1 covers the whole load on one leg |
| 6× BC-250 (worst case: 8c unlocked + 40CU + Extreme preset) | up to **~2,100W** | touches one 2000W leg — *never* run this 24/7, and stagger it (console-mode Extreme is one board at a time anyway; toolkit: 460W holds ONE board at Mild) |
| 6 IO carriers + 10GbE switch | ~150–300W | fed from the same 12V breakout rails (check connector budget) |
| Core host (5700G + optional 3090 + drives) | 150–450W peak, ~35W idle | **New** ATX 850W 80+ Gold (never used) |
| Core + switch + 2 Mi Boxes (always-on) | ≤ 600W | 1500VA UPS (new, never used batteries) — survives outages for ZFS + cameras |

- **Profiles (from the bc250-steamos-real-toolkit, v1.9.x):** 24/7 nodes run **Mild (undervolt):
  CPU 3.5 GHz / GPU 1600 MHz** — the toolkit's own stability tests hold it with 8c+40CU on a
  460W server PSU. Moderate/Strong/Extreme presets (up to GPU 2350 MHz) exist only for
  **console-mode sessions** (§12), never for unattended inference.
- **Cooling:** 2× 120mm PWM per board — one on the heatsink, one across the GDDR6 (it cooks
  without airflow). Delta 4000+ RPM class ×10 total incl. cabinet exhaust; **CoolerControl**
  (from the same toolkit ecosystem, distro-agnostic) drives the curves from a web UI.
  3D-printed **shrouds and closers** (PETG, survives 70–80°C) seal the gap so pressure goes
  through the fins instead of around the board.
- **Noise:** this is a *rack*, not a bedroom cabinet — utility room / balcony / spare corner.
  Governor + fan curves keep idle near 50–65W per board, so 24/7 running is affordable.

## 6. Mass OS deployment — the helper that flashes identical NVMe images

Your "copy the same OS across 100GB NVMe drives" pipeline — **two golden images, one rack**:

1. **`golden-infer.img` (default):** seat one NVMe in the core host, install CachyOS/Ubuntu +
   Mesa RADV + `amdgpu.sg_display=0` + BC-250 SMU governor (Mild-undervolt default) +
   CoolerControl curves + llama.cpp fork. Sysprep it.
2. **`golden-console.img` (couch gaming):** SteamOS Beta/Preview + the
   **bc250-steamos-real-toolkit** (Install All) — CU/core unlock, FSR4, VA-API encode for
   Sunshine, fan presets. This is the *only* place SteamOS belongs: its Beta kernel churn is
   tolerable for a console because PXE re-clones it in minutes (§12).
3. **Serve:** Clonezilla SE on the core host / NAS; dnsmasq PXE hands the image to any node
   booting from its NIC (ConnectX-3 PXE ROMs or on-board NIC).
4. **Multicast:** boot the node NVMe targets, `clonezilla --mc` multicasts one stream to all
   receivers — **~100GB in under ~3 minutes per batch over 10GbE**.
5. **Re-clone after config changes:** edit golden → re-multicast. Rebuilding a node = re-image,
   not re-install. Switching a carrier to console mode = PXE-boot the other image.

## 7. Redundancy — what fails and what catches it

| Failure | Caught by |
|---|---|
| One node PSU leg dies | 1+1 redundant PSU (hot swap the failed module) |
| One BC-250 board dies | Boards are ¥750 commodities — swap, re-run the PXE clone, rejoin |
| Disk dies | ZFS mirror keeps both pools running; resilver from the spare |
| Core PSU dies | New branded ATX unit + 5-yr warranty |
| Power outage | 1500VA UPS on core+network; ZFS and cameras ride through |
| An IO carrier dies | Per-board carrier (~¥350) — move the board, re-clone, rejoin |
| Config drift across nodes | Killed by design: golden image + re-clone instead of hand-patching |

## 8. Improvements & next steps (post-trip)

1. **After the trip:** swap room drops to 10GbE where you already pulled Cat6 (it's 10G-rated to 55m).
2. **Monitor it:** NUT for the UPS + Prometheus/node_exporter on the core host — the dashboard's
   daily job stays *buying*; ops metrics get their own glance.
3. **Model serving:** llama.cpp RPC first (simplest); evaluate exo/ik_llama.cpp if you want
   transparent multi-board tensor splits. Keep the planner model on Node A always-on.
4. **Future scale:** a second TL-ST1008F or 25GbE only when a single node outgrows 3 boards —
   not before. ConnectX-3 are PCIe 3.0 ×8; don't chase RDMA tuning, plain TCP is enough at this scale.
5. **Spare budget:** server P3 sits at 96% of 23K with ~1K free (a 7th board waits for a Xianyu
   price dip → pool ~95GB); the home line's ~10K surplus is the real spare — 4th NVMe or 25GbE
   before it ever touches the reserve.

## 9. Proxmox service map — the core host, made up and final

One host, every family service. ZFS pools live directly on Proxmox (no nested TrueNAS — fewer
moving parts, Samba/NFS served from a small LXC):

| ID | Type | Service | Notes |
|---|---|---|---|
| 100 | VM | **Windows Game VM** | *only if the optional 3090 (P3) is bought* — passthrough → Sunshine → Moonlight on all 4 TVs; 8c/16t + 48GB dedicated. Default gaming path is the BC-250 flex board (§3) |
| 101 | VM | **Home Assistant** | Lights, curtains, climate for the four-family home; Zigbee stick passthrough |
| 110 | LXC | **Jellyfin** | 5700G iGPU VAAPI transcode; library on the 8TB media mirror (3090 NVENC only if bought) |
| 111 | LXC | **Frigate NVR** | 4 PoE cameras, local-only, clips on media mirror; object detection on the 3090 when bought, else CPU low-FPS |
| 112 | LXC | **Samba/NFS + rclone** | File shares for the family; serves the PXE images too |
| 113 | LXC | **AdGuard Home** | Network-wide DNS ad/tracker blocking, per-family client stats |
| 114 | LXC | **Uptime Kuma + Grafana** | Dashboards for power, temps (node_exporter on carriers), UPS |
| 115 | LXC | **NUT server** | 1500VA UPS monitoring → clean shutdown on outage |
| 116 | LXC | **Dashboard container** | This repo's static site + the Actions refresh runner |
| 120 | LXC | **qBittorrent / download box** | Media acquisition, bind-mounted into the media mirror |
| — | host | **Proxmox + ZFS + dnsmasq PXE** | 2 mirror pairs (media, backups) + 3×2TB NVMe pools |

The 3060 OEM tower stays **bare-metal Windows** beside the rack (kernel anti-cheat titles refuse
VMs). Node A/B boards stay **bare-metal CachyOS** — Proxmox never touches them (passthrough adds
nothing for headless inference and costs performance).

## 10. Inference tiers — where DeepSeek-V4.1-Flash fits (and where it doesn't)

**Verdict: DeepSeek-V4.1-Flash is an API-only frontier tier for this rack. The local tiers stay as built.**

Why not local — the numbers (from the model card, Sep 2026):

- 763B parameters (552B backbone + 196B Engram + experts), **4-bit ≈ 380GB of weights —
  4.7× the entire BC-250 pool (~81GB usable)**, 12× the game GPU. Even absurd Q2 + full DRAM/NVMe
  offload on the core host decodes at a fraction of a token/sec. It is not a "future upgrade" —
  it is a different hardware class (multi-GPU 8×24GB minimum).
- The CED architecture activates only **8B prefill / 16B decode** per token — but weights must
  still be reachable; low activation does not shrink the 380GB you must store.

The tier stack (what the system actually does):

| Tier | Model | Where | Role |
|---|---|---|---|
| **0 · Frontier API** | DeepSeek-V4.1-Flash (or any 1M-ctx MoE) | paid API, capped ~SAR 150/mo | long-context agentic escalation: 1M-token repos/logs, multimodal docs, hard planning — never the daily brief (that stays on the free router) |
| **1 · Local planner** | Qwen-class 14B–32B Q4 | Node A, ~28GB resident | the always-on "helper planner": plans, routes tools, decides when to escalate to tier 0 |
| **2 · Local workers** | 7B–8B tool-callers ×N | Node B, ~54GB (3 workers + flex) | parallel agentic execution, no API cost |
| **3 · Local batch** | 70B-class Q4 / embeddings | pool across 4+ boards (or the optional 3090) | batch jobs, code assist, local RAG — 42GB needs an RPC split, not one board |

Escalation logic lives in the Node A planner: *try tiers 1–2 first; call tier 0 only when the
task needs >32k context, vision, or the local attempt fails.* Every API call logs its token cost
to the dashboard's daily brief input so the cap is visible.

## 11. KV-cache compression — future-proofing the analysis (and the budget)

DeepSeek-V4.1-Flash pushes global KV to **890 bytes/token** (FP4 main KV + CSA2 sparse attention +
SWA bounded replay ≈ 1/4 of V4-Flash, 1/437 of V1) — 1M tokens of context costs under 1GB of cache.
What that means *here*:

1. **API tier gets cheaper, not bigger:** 1M-ctx agentic sessions are affordable because the
   provider's KV footprint collapsed. This is exactly why tier 0 is capped in *spend*, not in
   context length — reserve ~SAR 150/month from headroom and revisit after the first invoice.
2. **Local roadmap (in priority order):**
   - **Now:** llama.cpp KV quantization (`-ctk q8_0 -ctv q8_0` ≈ halves KV), prefix cache reuse
     (`--cache-reuse`), modest 32k contexts — all fit comfortably in GDDR6 today.
   - **Next:** speculative decoding with a small draft model (the local analogue of DSpark) and
     SWA-style models that never persist sliding-window KV.
   - **Later:** true KV paging/offload to the **dedicated 2TB KV-scratch NVMe** (`srv-kv-nvme`)
     as llama.cpp/vLLM mature it — bought precisely so the *next* compression advance is a config
     change, not a hardware purchase.
3. **What this bought in the BOM:** the 3rd NVMe (KV/agent scratch, kept off games and media),
   128GB DRAM for host offload, and the 10GbE fabric for cross-node KV traffic. If a
   ≤100B-class SWA/MoE model (the compression lineage made local) appears, it lands on Node B
   without touching the budget.

## 12. The bc250-steamos-real-toolkit verdict — what we adopt, what we reject

Read in full (v1.9.12, vendored at `bc250-steamos-real-toolkit-main/`, git-ignored). It is a
menu-driven SteamOS toolkit: governors, **24→40 CU unlock** (duggasco kernel patch: llama.cpp pp512
302→466 tok/s = **+1.54×** verified in-tree), 6c→8c core unlock, UMA split, display/audio fixes,
CoolerControl/PWM fan control, VA-API encode. Our call:

| Toolkit piece | Inference nodes (CachyOS) | Console mode (SteamOS) | Why |
|---|---|---|---|
| **Mild (undervolt) profile 3.5GHz/1600MHz** | ✅ **default** | ✅ | toolkit-tested stable 8c+40CU @ 460W PSU per board; the 24/7 efficiency point |
| **SMU/gpu governors, CoolerControl curves** | ✅ **adopt** | ✅ | distro-agnostic — this *is* our fan-control software now |
| **UMA split (512MB) + ttm.pages_limit** | ✅ **adopt** | ✅ | frees nearly all 16GB unified RAM at idle (~12GB ttm ceiling for models) |
| **8c core unlock** | ⚠ opt-in flag | ✅ default | more host threads for RPC/prefill; costs power — off until measured |
| **40CU unlock** | ✅ **adopt** (benchmark first) | ✅ | the patch's own bench: pp512 302→466 tok/s (+54%) — stage after base stability, then it's default |
| **VA-API encode (VCN is fused off)** | ⚠ only if a BC-250 hosts Sunshine | ✅ | shader+CPU-wavefront driver: encode ~86fps HEVC 1080p works; **decode ~30fps — validates Mi Box as the only decode endpoint** |
| **Display/audio/WiFi neptune patches** | ❌ headless, irrelevant | ✅ | needs the Beta kernel; CH7218 dongle for direct HDMI |
| **SteamOS Beta kernel dependency** | ❌ **reject for nodes** | ✅ tolerated | Beta churn breaks a deterministic golden image — on a console it's fine because PXE re-clones in minutes |

**Console mode = "one solution for both" made literal:** Node B's **flex board** PXE-boots
`golden-console.img` (SteamOS + toolkit, Extreme presets OK for a session) and that board becomes a
couch gaming console — FSR4, mesh shaders, 40CU, Sunshine streaming to a Mi Box or straight HDMI via
the CH7218 dongle (§2.15). Node A (the planner) **never** leaves inference duty, and the workers keep
3 boards. Family gaming paths, in order: **flex BC-250 board** (default: console image or CachyOS +
Steam, Sunshine to any TV — zero extra hardware) → **3090 Game VM** (*only if bought at P3*: full
quality, Moonlight to every TV) → **3060 box** (anti-cheat, desk). Two paths at once, zero extra
hardware — plus `home-ctrl` controllers for every sofa.

## 13. Where the limits hit — the BC-250-first sheet

The question this section answers: *can 5+ BC-250s replace the high-end core PC (7900X + X670E +
128GB DDR5 + 3090 ≈ ¥10,610)?* — and what is missing if they try.

**Verdict: yes for everything heavy, no for the plumbing — and the plumbing is exactly what the
cheap AM4 host (¥3,430) is for.** The premium core is cancelled; its duties split three ways:

| Limit | Where it hits | Cheap gap-filler |
|---|---|---|
| Pool ceiling: 6 × ~13.5GB ≈ **81GB usable** | 235B/405B-class models (105/190GB) never fit | tier-0 DeepSeek API (§10) — spend-capped, not hardware-capped |
| 10GbE RPC (1.1 GB/s vs 448 GB/s on-board GDDR6) | cross-board splits run ~0.5–0.8× a single-GPU run | keep small models planner-resident (never cross the wire); accept the split only for 70B-class |
| Zen2 single-thread (~3.5–4GHz) | host-scale jobs: ZFS scrub, compilers, bulk orchestration | the cheap host's 8C/16T + 128GB DDR4 (bulk/scratch + future KV-offload lane) |
| No Windows driver — ever | kernel anti-cheat titles (Valorant/Fortnite/PUBG) | 3060 bare-metal box, unchanged — non-negotiable |
| No CUDA / NCCL | CUDA-only training & fine-tune tooling | not required: Vulkan inference + tier-0 API; optional 3090 (P3) only if CUDA proves necessary |
| VCN fused off → software VA-API encode (~86fps 1080p) | 4K transcode, many simultaneous streams | stream 1080p60 (Moonlight decodes on the Mi Box); Jellyfin transcodes on the host iGPU |
| 24→40CU ≈ entry-class 1080p GPU | AAA above 1080p-high, ray tracing, >60fps | FSR + 1080p target; the optional 3090 (P3) is the only real "AAA shelf" answer |
| DP-only output, small single-board IO | direct-HDMI TVs; lots of SATA/HBA expansion | CH7218 dongle (§2.15) for console mode; all SATA/ZFS lives on the cheap host |
| One box = one local display session | couch + desk at the same time | N boards = N Sunshine sessions (flex pool); anti-cheat box covers the desk |

**What the rebuild bought:** core row ¥10,610 → ¥6,280 counting the 3090 either way (**−¥4,330**;
the GPU itself moved from P0 to optional P3) — reinvested into the 6th board (+¥750), per-board IO
carriers (+¥100), three extra NICs (+¥345) and the HDMI dongle (+¥150); storage, the fabric, rack
and redundancy kept in full. Server line lands **P3 ≈ 22.0K of 23K (96%)** with every capability
except premium silicon still funded. The three options as of Sep 2026:

- **A — all-in boards, no x86 core:** cheapest, but loses ZFS/PXE/iGPU-VAAPI bulk duties → rejected;
  a dead $80 motherboard shouldn't run the family's cameras.
- **B — BC-250-first + cheap AM4 core (CHOSEN):** the boards do AI/gaming/encode, the ¥3,430 host
  does plumbing, 3060 covers anti-cheat, 3090 waits at P3.
- **C — keep the premium core:** rejected — ¥7K of silicon duplicated what six ¥750 boards do better
  per yuan (§10 tiers).

## 14. References

- **BC-250 SteamOS Real Toolkit (read this one):** https://github.com/rpf16rj/bc250-steamos-real-toolkit
  (vendored locally in this repo, git-ignored)
- **DeepSeek-V4.1-Flash model card (KV compression):** https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash
- BC-250 specs/setup/gaming: https://bc250.info/ · community hub + CAD + ROCm notes: https://bc-250.com/
- Deep docs (BIOS mod, governor, Vulkan/llama.cpp): https://github.com/elektricM/amd-bc250-docs
- llama.cpp fork tuned for BC-250: https://github.com/TechMakesArt/llama.cpp-bc250
- llama.cpp multi-GPU / split modes: https://github.com/ggml-org/llama.cpp/blob/master/docs/multi-gpu.md
- Clonezilla SE (PXE multicast): https://clonezilla.org/ · PXE basics: your core host's dnsmasq
- 10G switch: TP-Link TL-ST1008F product page · NICs: Mellanox ConnectX-3 EN (MCX311A) market listing
- Sourcing: Xianyu (闲鱼) for used · Huaqiangbei/SEG for GPUs & networking · Taobao/JD for new
  small parts · Foshan Lecong (乐从) for bedroom + furniture · 1688 for factory refurb
- Dashboard pipeline: `PLAN.md` (budgets/phases) · `data/products.json` (prices) ·
  `homelab.md` (this file) · `pc.md` (architecture archive + current) · `furnteatures.md` (home)
