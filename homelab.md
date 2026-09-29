# Homelab Master Plan — the complete package

One rack. Zero mini-PCs. Everything below is what the buy-list in `data/products.json` funds, what
`PLAN.md` phases, and what the dashboard's **Stack** section visualizes. Budget frame: 50K SAR total,
**24.8K server line / 25.2K home line** (rebalanced Sep 2026 for airflow/printing/KV storage),
45K deployable, freight 8,500 + 15% tax + 10% reserve.

## 0. What this replaces

Scattered mini-PCs / one-off boxes → **one racked, redundant, cloned-from-golden-image cluster** bought
from the Chinese secondary market (Xianyu / Huaqiangbei / Foshan) at a fraction of brand-name pricing.

## 1. The rack map

```
                        ┌────────────────────────────────────────────┐
                        │  10GbE SFP+ switch · TP-Link TL-ST1008F    │
                        │  (backbone: inference traffic + PXE + NAS) │
                        └──────┬─────────────────────────┬───────────┘
                               │                         │
        ┌──────────────────────┴─────────┐   ┌───────────┴──────────────────────┐
        │  NODE A · Planner (2×BC-250)   │   │  NODE B · Workers (3×BC-250)     │
        │  ~32GB GDDR6 · 14B–32B Q4      │   │  ~48GB GDDR6 · parallel 7B/8B    │
        │  orchestrator · llama.cpp VK   │   │  tool-calling agents · llama.cpp │
        │  ConnectX-3 10GbE              │   │  ConnectX-3 10GbE                │
        └────────────────────────────────┘   └──────────────────────────────────┘
                               │                         │
                        ┌──────┴─────────────────────────┴───────────┐
                        │  CORE · NAS / virtualization host          │
                        │  Ryzen 9 7900X · X670E · 128GB DDR5        │
                        │  RTX 3090 (game VM) · RTX 3060 box beside  │
                        │  3×2TB NVMe (VM/models · games · KV scratch)│
                        │  8TB×2 mirror (media+cameras) · 8TB×2 (bkp)│
                        │  Proxmox · Jellyfin · ZFS · PXE/Clonezilla │
                        └────────────────────────────────────────────┘
   Edge: Mi Box ×2 at the TVs (Moonlight/Jellyfin decode) · KB/mouse pair to the endpoint
   Power: 1+1 2000W redundant PSU + breakout (nodes, sized for 8c+40CU) · new ATX + 1500VA UPS (core)
   Cooling: 2× Delta PWM 120mm per board (heatsink + GDDR6) + cabinet exhaust, curves in CoolerControl
   Airflow: 3D-printed shrouds/closers seal fan pressure into the heatsink channels (PETG)
   Rack: 12U–18U cabinet (600mm) + 2× 4U open-frame shelves — BC-250 = 305mm, no off-the-shelf case
   Console mode: one carrier PXE-boots the golden-console image (SteamOS Beta + bc250 toolkit)
                 for couch gaming; same rack, same boards, swapped image — see §12
```

## 2. Bill of materials — where each line comes from

| # | Item | Qty | Where | Est. | Notes |
|---|---|---|---|---|---|
| 1 | AMD BC-250 16GB compute board | 5 | **Xianyu (闲鱼)** | ¥650–850 ea | Ex-mining PS5 APU; test boot + GDDR6 fan each |
| 2 | Node carrier hosts (board+CPU+32GB) | 2 | **Xianyu** | ~¥1,000 ea | Any cheap AM4/X99 skeleton with PCIe slots |
| 3 | Mellanox ConnectX-3 10GbE SFP+ + DAC | 3 | **Xianyu / Taobao** | ~¥110 ea | ¥100–150 is normal; DACs ~¥30 each |
| 4 | TP-Link TL-ST1008F 8-port 10G SFP+ | 1 | **Taobao / JD** | ~¥750 | See §4 — yes, you need it |
| 5 | 2000W+2000W redundant PSU (1+1) + breakout | 1 | **Xianyu / Huaqiangbei** | ~¥750 | Sized for 8c+40CU worst case (~1.75kW); Mild-undervolt holds 24/7 ~1kW. Load-test + burn in |
| 6 | 12U–18U cabinet (600mm) + 2× 4U open-frame shelves | 1 | **Taobao / Xianyu** | ~¥600 | Off-the-shelf cases don't fit 305mm boards |
| 7 | High-static 120mm PWM fans (Delta class) | 10 | **Taobao** | ~¥40 ea | 2 per board (heatsink + GDDR6) + 2 exhaust spares; curves in CoolerControl |
| 8 | Core host: 7900X + X670E + 128GB + 3090 | 1 | **Xianyu + Huaqiangbei** | ~¥8,730 | `srv-cpu/mobo/ram/gpu1/case/aio/psu/ups` |
| 9 | Anti-cheat box: OEM tower + 3060 | 1 | **Xianyu / Huaqiangbei** | ~¥1,680 | Bare-metal Windows, kernel anti-cheat games |
| 10 | Storage: 3×2TB NVMe + 4×8TB HDD | — | **Xianyu / JD** | ~¥3,640 | NVMe: VM/models · games · **KV/agent scratch**. HDD: 2 mirror pairs |
| 11 | 10GbE + 2.5GbE room runs, cameras, KB/M, Mi Box ×2, controllers ×2 | — | **Taobao / Xianyu** | ~¥4,360 | Cables BEFORE furniture lands |
| 12 | Bedroom bundle: bed+mattress+nightstands, linens, lighting, curtains, rug, LED mirror — **NO wardrobe** | — | **Foshan Lecong / Taobao** | ~¥5,800 | See `furnteatures.md` |
| 13 | 3D-printed airflow kit: shrouds, closers, ducts + 6× PETG spools | 1 | **Taobao** | ~¥500 | Print the closers so fan pressure hits the heatsinks, not the room |
| 14 | 3D printer (Neptune 4 class) — skip if you own one | 1 | **Taobao / JD** | ~¥900 | P3 optional; the rack's custom parts + endless home fixes |

Everything marked Xianyu/Huaqiangbei: **negotiate 10–15% down, pay after a live test**
(boot it, run the VRAM/fan test, check GDDR6 temps on the BC-250s).

## 3. Compute split — what runs where

- **Node A (2× BC-250 ≈ 32GB):** the single 14B–32B orchestrator ("all-in helper planner").
  One model resident, plans tasks, talks to the workers.
- **Node B (3× BC-250 ≈ 48GB):** parallel 7B/8B agentic tool-callers — several agents at once
  without swapping.
- **Cross-node:** llama.cpp RPC / split inference between A and B over the 10GbE link
  (this is the *inference* answer in §4). Boards are Linux-only (RADV/Vulkan) — modded BIOS
  (VRAM split) + SMU governor on every board; the golden image bakes this in.
- **Core host:** Proxmox — game VM (RTX 3090 passthrough) + Sunshine → Moonlight; LXCs for Jellyfin,
  AdGuard, NVR, dashboard; ZFS pools; PXE server. The 3060 OEM box stays bare-metal Windows for
  kernel anti-cheat titles (Valorant/Fortnite/PUBG refuse VMs).
- **Edge:** Mi Box ×2 — decode only at the TV. No mini-PCs anywhere in the chain.

## 4. The 10GbE question — future-proof, inference, or both?

**Both — it's not optional for this build.** Three concrete reasons, in priority order:

1. **Inference (the real reason):** KV-cache/tensor traffic between Node A ↔ Node B and between
   nodes and the core host during RPC-split runs. 1GbE ≈ 110 MB/s strangles it; 10GbE ≈ 1.1 GB/s
   makes multi-node splits viable. Cards are ¥110 — the cheapest part of the plan that you'd regret skipping.
2. **Mass OS deployment:** the 100GB golden image multicasts to 5 node drives in minutes, not hours.
3. **NAS + future:** Jellyfin 4K remuxes, camera archives, and any future 2nd switch/NAS share the
   same fabric. 2.5GbE stays as the *room* tier (endpoints, cameras) — the SFP+ switch is the backbone.

## 5. Power & cooling (the honest math)

| Domain | Load | Supply |
|---|---|---|
| 5× BC-250 (24/7 inference, Mild-undervolt profile) | ~5 × 180W ≈ **900W continuous**, idle ~50W/board | 1+1 **2000W** + 12V breakout — N+1 covers the whole load on one leg |
| 5× BC-250 (worst case: 8c unlocked + 40CU + Extreme preset) | up to **~1,750W** | same 2000W leg — but *never* run this profile 24/7; toolkit says a 460W PSU only holds ONE board at Mild |
| 2 node carriers + 10GbE switch | ~150–250W | fed from the same 12V breakout rails (check connector budget) |
| Core host (7900X + 3090 + drives) | 400–700W peak, ~80W idle | **New** ATX 1200W 80+ Gold (never used) |
| Core + switch + 2 Mi Boxes (always-on) | ≤ 800W | 1500VA UPS (new, never used batteries) — survives outages for ZFS + cameras |

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
| Node carrier host dies | Cheap Xianyu skeleton — the boards move to a spare carrier |
| Config drift across nodes | Killed by design: golden image + re-clone instead of hand-patching |

## 8. Improvements & next steps (post-trip)

1. **After the trip:** swap room drops to 10GbE where you already pulled Cat6 (it's 10G-rated to 55m).
2. **Monitor it:** NUT for the UPS + Prometheus/node_exporter on the core host — the dashboard's
   daily job stays *buying*; ops metrics get their own glance.
3. **Model serving:** llama.cpp RPC first (simplest); evaluate exo/ik_llama.cpp if you want
   transparent multi-board tensor splits. Keep the planner model on Node A always-on.
4. **Future scale:** a second TL-ST1008F or 25GbE only when a single node outgrows 3 boards —
   not before. ConnectX-3 are PCIe 3.0 ×8; don't chase RDMA tuning, plain TCP is enough at this scale.
5. **Spare budget:** the 11.9K headroom in the plan buys a 6th BC-250 (worker parity) or a 4th
   NVMe before it ever touches the reserve.

## 9. Proxmox service map — the core host, made up and final

One host, every family service. ZFS pools live directly on Proxmox (no nested TrueNAS — fewer
moving parts, Samba/NFS served from a small LXC):

| ID | Type | Service | Notes |
|---|---|---|---|
| 100 | VM | **Windows Game VM** | RTX 3090 passthrough → Sunshine → Moonlight on all 4 TVs; 8c/16t + 48GB dedicated |
| 101 | VM | **Home Assistant** | Lights, curtains, climate for the four-family home; Zigbee stick passthrough |
| 110 | LXC | **Jellyfin** | 3090 NVENC transcode; library on the 8TB media mirror |
| 111 | LXC | **Frigate NVR** | 4 PoE cameras, local-only, clips on media mirror, object detection on the 3090 when idle |
| 112 | LXC | **Samba/NFS + rclone** | File shares for the family; serves the PXE images too |
| 113 | LXC | **AdGuard Home** | Network-wide DNS ad/tracker blocking, per-family client stats |
| 114 | LXC | **Uptime Kuma + Grafana** | Dashboards for power, temps (node_exporter on carriers), UPS |
| 115 | LXC | **NUT server** | 1500VA UPS monitoring → clean shutdown on outage |
| 116 | LXC | **Dashboard container** | This repo's static site + the Actions refresh runner |
| 120 | LXC | **qBittorrent / download box** | Media acquisition, bind-mounted into the media mirror |
| — | host | **Proxmox + ZFS + dnsmasq PXE** | 2 mirror pairs (media, backups) + 3×2TB NVMe pools |

The 3060 OEM tower stays **bare-metal Windows** beside the rack (kernel anti-cheat titles refuse
VMs). Node A/B carriers stay **bare-metal CachyOS** — Proxmox never touches them (passthrough
adds nothing for headless inference and costs performance).

## 10. Inference tiers — where DeepSeek-V4.1-Flash fits (and where it doesn't)

**Verdict: DeepSeek-V4.1-Flash is an API-only frontier tier for this rack. The local tiers stay as built.**

Why not local — the numbers (from the model card, Sep 2026):

- 763B parameters (552B backbone + 196B Engram + experts), **4-bit ≈ 380GB of weights —
  4.7× the entire BC-250 cluster (80GB)**, 12× the game GPU. Even absurd Q2 + full DRAM/NVMe
  offload on the core host decodes at a fraction of a token/sec. It is not a "future upgrade" —
  it is a different hardware class (multi-GPU 8×24GB minimum).
- The CED architecture activates only **8B prefill / 16B decode** per token — but weights must
  still be reachable; low activation does not shrink the 380GB you must store.

The tier stack (what the system actually does):

| Tier | Model | Where | Role |
|---|---|---|---|
| **0 · Frontier API** | DeepSeek-V4.1-Flash (or any 1M-ctx MoE) | paid API, capped ~SAR 150/mo | long-context agentic escalation: 1M-token repos/logs, multimodal docs, hard planning — never the daily brief (that stays on the free router) |
| **1 · Local planner** | Qwen-class 14B–32B Q4 | Node A, ~32GB resident | the always-on "helper planner": plans, routes tools, decides when to escalate to tier 0 |
| **2 · Local workers** | 7B–8B tool-callers ×N | Node B, ~48GB | parallel agentic execution, no API cost |
| **3 · Local accelerator** | 70B-class Q4 / embeddings | core 3090 when not gaming | batch jobs, code assist, local RAG |

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
menu-driven SteamOS toolkit: governors, 32→40 CU unlock, 6c→8c core unlock, UMA split, display/
audio fixes, CoolerControl/PWM fan control, VA-API encode. Our call:

| Toolkit piece | Inference nodes (CachyOS) | Console mode (SteamOS) | Why |
|---|---|---|---|
| **Mild (undervolt) profile 3.5GHz/1600MHz** | ✅ **default** | ✅ | toolkit-tested stable 8c+40CU @ 460W PSU; the 24/7 efficiency point |
| **SMU/gpu governors, CoolerControl curves** | ✅ **adopt** | ✅ | distro-agnostic — this *is* our fan-control software now |
| **UMA split (512MB) + ttm.pages_limit** | ✅ **adopt** | ✅ | frees nearly all 32GB carrier RAM at idle |
| **8c core unlock** | ⚠ opt-in flag | ✅ default | more host threads for RPC/prefill; costs power — off until measured |
| **40CU unlock** | ⚠ benchmark first | ✅ | +25% shader ALUs is real for Vulkan compute *if* clocks hold — stage after base stability |
| **VA-API encode (VCN is fused off)** | ⚠ only if a BC-250 hosts Sunshine | ✅ | encode ~86fps HEVC works; **decode is ~30fps — validates Mi Box as the only decode endpoint** |
| **Display/audio/WiFi neptune patches** | ❌ headless, irrelevant | ✅ | needs the Beta kernel |
| **SteamOS Beta kernel dependency** | ❌ **reject for nodes** | ✅ tolerated | Beta churn breaks a deterministic golden image — on a console it's fine because PXE re-clones in minutes |

**Console mode = "one solution for both" made literal:** a carrier PXE-boots `golden-console.img`
(SteamOS + toolkit, Extreme presets OK for a session) and the same board becomes a couch gaming
console — FSR4, mesh shaders, 40CU, Sunshine streaming to a Mi Box or straight HDMI. Node A
(the planner) **never** leaves inference duty; console mode borrows a Node B carrier (workers
drop to 2 boards until the image swaps back). Family gaming paths, in order: **3090 Game VM**
(full quality, Moonlight to every TV) → **BC-250 console mode** (lighter/indie couch sessions,
second simultaneous player) → **3060 box** (anti-cheat, desk). Two gaming paths at once, zero
extra hardware — plus `home-ctrl` controllers for every sofa.

## 13. References

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
