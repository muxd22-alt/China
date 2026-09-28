# Homelab Master Plan — the complete package

One rack. Zero mini-PCs. Everything below is what the buy-list in `data/products.json` funds, what
`PLAN.md` phases, and what the dashboard's **Stack** section visualizes. Budget frame: 50K SAR total,
**23K server line**, 45K deployable, freight 8,500 + 15% tax + 10% reserve.

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
                        │  2×2TB NVMe (VM/models · games)            │
                        │  8TB×2 mirror (media+cameras) · 8TB×2 (bkp)│
                        │  Proxmox · Jellyfin · ZFS · PXE/Clonezilla │
                        └────────────────────────────────────────────┘
   Edge: Mi Box ×2 at the TVs (Moonlight/Jellyfin decode) · KB/mouse pair to the endpoint
   Power: 1+1 1600–2000W redundant PSU + breakout (nodes) · new ATX PSU + 1500VA UPS (core+net)
   Cooling: Delta 4000+ RPM 120mm fans straight onto BC-250 heatsinks AND the GDDR6
   Rack: open mining frame / 4U per node inside a 12U–18U cabinet (BC-250 = 305mm non-standard)
```

## 2. Bill of materials — where each line comes from

| # | Item | Qty | Where | Est. | Notes |
|---|---|---|---|---|---|
| 1 | AMD BC-250 16GB compute board | 5 | **Xianyu (闲鱼)** | ¥650–850 ea | Ex-mining PS5 APU; test boot + GDDR6 fan each |
| 2 | Node carrier hosts (board+CPU+32GB) | 2 | **Xianyu** | ~¥1,000 ea | Any cheap AM4/X99 skeleton with PCIe slots |
| 3 | Mellanox ConnectX-3 10GbE SFP+ + DAC | 3 | **Xianyu / Taobao** | ~¥110 ea | ¥100–150 is normal; DACs ~¥30 each |
| 4 | TP-Link TL-ST1008F 8-port 10G SFP+ | 1 | **Taobao / JD** | ~¥750 | See §4 — yes, you need it |
| 5 | 1600–2000W redundant PSU (1+1) + breakout | 1 | **Xianyu / Huaqiangbei** | ~¥600 | Used = OK here; load-test + burn in |
| 6 | 4U / open mining frame + 12U–18U cabinet | 1 | **Taobao / Xianyu** | ~¥600 | Off-the-shelf cases don't fit 305mm boards |
| 7 | High-static 120mm fans (Delta class) | 4 | **Taobao** | ~¥40 ea | Aim at GDDR6 too — it runs extremely hot |
| 8 | Core host: 7900X + X670E + 128GB + 3090 | 1 | **Xianyu + Huaqiangbei** | ~¥8,730 | `srv-cpu/mobo/ram/gpu1/case/aio/psu/ups` |
| 9 | Anti-cheat box: OEM tower + 3060 | 1 | **Xianyu / Huaqiangbei** | ~¥1,680 | Bare-metal Windows, kernel anti-cheat games |
| 10 | Storage: 2×2TB NVMe + 4×8TB HDD | — | **Xianyu / JD** | ~¥3,020 | NVMe: VM/models + games. HDD: 2 mirror pairs |
| 11 | 10GbE + 2.5GbE room runs, cameras, KB/M, Mi Box ×2 | — | **Taobao / Xianyu** | ~¥3,600 | Cables BEFORE furniture lands |
| 12 | Bedroom bundle: bed+mattress+nightstands, linens, lighting, curtains, rug, LED mirror — **NO wardrobe** | — | **Foshan Lecong / Taobao** | ~¥5,800 | See `furnteatures.md` |

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
| 5× BC-250 | 5 × 220W = **1,100W peak** (boards idle ~50W each with governor) | 1+1 redundant 1600–2000W + 12V breakout — sized for the spike, N+1 survives one PSU dying |
| 2 node carriers + 10GbE switch | ~150–250W | fed from the same 12V breakout rails (check connector budget) |
| Core host (7900X + 3090 + drives) | 400–700W peak, ~80W idle | **New** ATX 1200W 80+ Gold (never used) |
| Core + switch + 2 Mi Boxes (always-on) | ≤ 800W | 1500VA UPS (new, never used batteries) — survives outages for ZFS + cameras |

- **Cooling:** BC-250 heatsinks are designed for forced-air rackmount. Minimum two 120mm fans per
  board, direct on the heatsink **and on the GDDR6** (community consensus: it cooks without airflow).
  Delta 4000+ RPM class, wired to node power, PWM controlled. Keep the cabinet doors mesh/open.
- **Noise:** this is a *rack*, not a bedroom cabinet — utility room / balcony / spare corner.
  Fan curves on the governor keep idle near 50–65W per board, so 24/7 running is affordable.

## 6. Mass OS deployment — the helper that flashes 5 identical NVMe images

Your "copy the same OS across 100GB NVMe drives" pipeline:

1. **Build once:** seat one NVMe in the core host, install CachyOS/Ubuntu + Mesa RADV +
   `amdgpu.sg_display=0` kernel param + BC-250 SMU governor script + llama.cpp fork. Sysprep it → this is the **golden image**.
2. **Serve:** Clonezilla SE (server edition) on the core host / NAS; the PXE server (dnsmasq/CoW)
   hands out the image to any node that boots from the 10GbE NIC (ConnectX-3 PXE ROMs or on-board NIC).
3. **Multicast:** boot all 5 node NVMe targets, `clonezilla --mc` multicasts one stream to all
   receivers simultaneously — **~100GB in under ~3 minutes per batch over 10GbE**.
4. **Re-clone after config changes:** edit golden → re-multicast. Rebuilding a node = re-image, not re-install.

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

## 9. References

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
