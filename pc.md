# Homelab Architecture — BC-250 Cluster (current, Sep 2026)

> Replaces the earlier single-box 3090 plan below (see archive). Numbers live in `data/config.json` /
> `data/products.json`; the dashboard renders them. Budget frame: 50K SAR total, **45K deployable**
> (10% reserve held back), server line rebalanced to 23K.

## Topology

```
                         ┌──────────────────────────────────────────┐
                         │   10GbE SFP+ Switch (TP-Link TL-ST1008F) │
                         └───────┬──────────────────────────┬───────┘
                                 │                          │
        ┌────────────────────────┴────────┐        ┌────────┴────────────────────────┐
        │  Planner Node (2x BC-250)       │        │  Worker Node (3x BC-250)        │
        │  • 32GB GDDR6 VRAM              │        │  • 48GB GDDR6 VRAM              │
        │  • Runs: 14B–32B Orchestrator   │        │  • Runs: Parallel 7B/8B Tools   │
        └─────────────────────────────────┘        └─────────────────────────────────┘
                                 │                          │
                         ┌───────┴──────────────────────────┴───────┐
                         │   Core NAS / Virtualization Host         │
                         │   • Ryzen AM5 / Used EPYC Board          │
                         │   • 2TB NVMe (VMs) + ZFS Mirror HDDs     │
                         │   • Jellyfin, Game VMs, PXE Host         │
                         └──────────────────────────────────────────┘
```

## Node split (5x AMD BC-250)

- **What a BC-250 is:** ex-crypto-mining board with a cut-down PS5 APU — 6C Zen2 (8C unlockable) +
  24 RDNA2 CU ("Cyan Skillfish"), **16GB GDDR6 shared CPU/GPU @ 448 GB/s**, 220W, PCIe 8-pin,
  M.2 + GbE + DP on-board. Linux only (RADV/Vulkan, no Windows driver). Community: modded BIOS
  (VRAM split) + SMU governor; llama.cpp-Vulkan fork runs ~60 tok/s for 8B per board.
  Sourcing: Xianyu ~¥650–850/card.
- **Node A — 2x BC-250 / ~32GB VRAM:** central **Planner & Reasoning** node. Runs the 14B–32B
  quantized orchestrator (e.g. Qwen3-32B Q4) via llama.cpp Vulkan.
- **Node B — 3x BC-250 / ~48GB VRAM:** **Execution & Agentic Worker** node. Multiple concurrent
  7B/8B tool-calling agents without VRAM swapping.
- Each node sits on a cheap used carrier host (board + CPU + 32GB, Xianyu) in an open frame / 4U
  enclosure inside a 12U–18U cabinet.

## Network & storage backbone

- **10GbE (mandatory):** 1GbE (~110 MB/s) chokes llama.cpp RPC KV-cache / tensor transfers between
  Node A and Node B. 3x Mellanox ConnectX-3 SFP+ (¥100–150 each on Xianyu) + DACs + TP-Link
  TL-ST1008F 8-port 10G switch (¥750) → ~1.1 GB/s inter-node + NAS throughput.
- **Storage:** core host = 2TB NVMe (model weights/VMs) + ZFS mirrored 8TB enterprise HDDs
  (Jellyfin + camera archives).
- **Endpoints:** mini-PCs dropped as primary endpoints — Xiaomi Mi Box x2 stream Moonlight/Jellyfin
  straight to the TVs.

## Mass OS deployment (100GB image cloning)

- **Method:** PXE multicast via **Clonezilla SE** hosted on the NAS (core host is the PXE server).
- **Golden image:** one target NVMe with CachyOS/Ubuntu + Mesa RADV + `amdgpu.sg_display=0` +
  the BC-250 governor script baked in.
- **Execution:** boot all 5 node drives over PXE, multicast the 100GB image simultaneously over
  10GbE — under ~3 minutes per batch.

## Power & rack

- **Chassis:** 4U rackmount or open mining frame in a 12U/18U cabinet (BC-250 boards are
  non-standard 305mm — off-the-shelf cases don't fit).
- **Power:** 1600–2000W redundant (1+1) enterprise server PSU + 12V breakout board (¥600, used,
  load-tested) to absorb 5x 220W spikes; core host keeps its own new ATX PSU.
- **Cooling:** Delta-class 4000+ RPM 120mm fans aimed at the passive heatsinks **and the GDDR6**.

## Procurement snapshot

| Category | Item | Source | Est. (CNY / SAR) |
|---|---|---|---|
| Compute | 5x AMD BC-250 16GB | Xianyu | ~¥650–850/card (≈2,100 total) |
| Networking | 3x ConnectX-3 10GbE + DACs | Xianyu / Taobao | ~¥350 (≈200) |
| Switching | TP-Link TL-ST1008F 8-port 10G | Taobao / JD | ~¥750 (≈420) |
| Power | 1600–2000W redundant PSU + breakout | Xianyu / Huaqiangbei | ~¥600 (≈335) |
| Bedroom | Bed + mattress + nightstands | Foshan Lecong | ~¥3,200 (≈1,780) |
| Decor | Dimmable lighting + made-to-measure curtains | Taobao / Foshan | ~¥1,100 (≈615) |
| Flight | Direct RUH ↔ SZX (CZ5007 nonstop) | China Southern | ~¥4,200 (≈2,350) |

*Wardrobe excluded from the bedroom list (floor space + budget). Saudia has no RUH–SZX passenger
nonstop (SV992 is cargo) — CZ is the only nonstop carrier, 3×/week.*

---

## Archive: original consultation log (pre-Sep 2026 — single-box 3090 plan)

Claude finished the response



افكر باستضافة خدمات عن طريق مايعرف ب home lab وافكر بشراء كل شيء مستعمل من الصين اثناء ذهابي لهناك للتجهيز للانتقال لبيتي

وانا احتاج العب باكثر من غرفة واكثر من جهاز كتابلت او foldable وللاطفال مستقبلا وللافلام وباختلاف الشاشات

بنهاية 2026 ماهو التفكير والاستثمار الصحيح هل اشتري بي سي العاب وسيرفر

او استثمر بسيرفر متكامل لاستضافة كل هذه الخدمات المحليه والذكاء الخارق المحلي والالعاب

بميزانية عشرة الاف ريال وعادي اشتري مستعمل كقطع ماهو المفروض اللي افكر فيه

سيرفر خارق و proxmox او kubernetes

حيث انني فاهم بالشبكات والانظمة ومقبل على الشراء كل مايحتاجه الموضوع ولكن ميزانيتي حدود ال 10 الاف ريال سعودي لمنزل العمر وتجهيزه بانظمة صحيحة ومستدامه

ويمكن الترقية لاحقا لاظافة الزوجه والاطفال عند الحاجه وايضا التطوير مستقبلا وايضا استخدامه بكل شاشات المنزل عن طريق طريقة محليه مناسبة 100% بدو مشاكل او حقوق او حماية لعبه تمنع هذا الشيء .. الخ

Read memory, searched the web, added to memory



التوصية المباشرة: سيرفر واحد متكامل، مو تقسيم لجهاز ألعاب + سيرفر منفصل. بميزانية 10 آلاف ريال، لو قسمتها بين جهازين بتضعف الاثنين. الحل الصح تقنيًا هو صندوق واحد قوي، وتوزّع فيه الأحمال بالـ virtualization — بالضبط الاستخدام اللي صمم له Proxmox.



Proxmox وليس Kubernetes — لسيرفر واحد ماديًا، Kubernetes عبء إداري بدون فايدة حقيقية (قوته تظهر مع عدة عقد فيزيائية). Proxmox يعطيك LXC خفيفة للخدمات + VM كامل مع GPU passthrough للألعاب، وسهل يوسّع لاحقًا. إذا حبيت تتعلم k3s مستقبلاً كمطور، تقدر تشغّله جوا VM على نفس السيرفر — بدون ما يعقّد البنية الأساسية الحين.



القطعة الحاسمة: كرت شاشة مستعمل RTX 3090 (24GB) — هذا هو الخيار اللي يحل ثلاث مشاكل بقطعة وحدة: أداء ألعاب ممتاز، VRAM كافي لموديلات AI محلية كبيرة (70B بالـ quantization)، وترميز فيديو لجيلفن. أسعاره بالسوق المستعمل حاليًا حوالي 700-1000 دولار (\~2700-3800 ريال)، وغالبًا أرخص من كذا بسوق الصين المستعمل (Xianyu / هواتشيانغبي). تجنب شراء بدون فحص — فحص الـ VRAM وحالة الفانات قبل الدفع.



باقي القطع:



&#x20;   معالج + لوحة أم مستعملة تدعم IOMMU للـ passthrough — Ryzen 9 (5900X/5950X أو 7900) خيار متوازن بين أداء الألعاب وعدد الأنوية للحاويات

&#x20;   رام 64-128GB

&#x20;   تخزين: NVMe للـ VMs، وهارديسكات (يفضل بـ ZFS mirror) للميديا — امتداد طبيعي لمكتبة جيلفن اللي عندك أصلاً

&#x20;   مزود الطاقة: يُشترى جديد فقط (850-1000W، 80+ Gold) — ما يستاهل المخاطرة بقطعة أمان

&#x20;   UPS يفضّل يكون ضمن الميزانية — سيرفر يشتغل 24/7 بمنزل العمر، وحماية البيانات (خصوصًا مع ZFS) تستاهل



البنية المقترحة:

Proxmox host → حاويات LXC لـ Jellyfin وAdGuard Home والخدمات اللي شغّالة عندك بالفولد (تنقلها هنا مباشرة) + VM ويندوز واحد مع GPU passthrough يشغّل Sunshine، وتبث لكل غرفة/جهاز عبر Moonlight (تابلت، فولد، أجهزة الأطفال لاحقًا، وحتى صندوق شاومي اللي عندك) — بث محلي بالكامل بدون أي اعتماد على خدمات سحابية أو قيود DRM. الذكاء الاصطناعي المحلي (Ollama/llama.cpp) يشارك نفس الكرت في الأوقات اللي مو فيها ألعاب.



الشبكة: كيبل إيثرنت بدل واي فاي بقدر الإمكان لتقليل تأخير البث بين الغرف، أو على الأقل Wi-Fi 6.



التوسع لاحقًا: الزوجة والأطفال يعني ببساطة VM/LXC إضافية أو كرت GPU ثاني (كرتين 3090 = 48GB VRAM لموديلات أكبر) — البنية تتحمل هذا من غير إعادة تصميم.



وماهي الالعاب التي لاتقبل gpu passthrough وتعتبره غش او احتماليه غش لاني احب العاب الاون لاين



واشرح لي ماهي k3s ومدامك رحت مع الوحدات الطرفية بهذه الطريقة كل اشبك كل كيبورد وايرلس وماوس لكل شاشة ويعتبر موصول ب vm خاص لهذا النظام شاشة الصالة تحتاج ويندوز وكيبورد وماوس هل بشراء شاومي tv box او بماذا ؟

Searched the web, updated memory



١) الألعاب اللي تعتبر VM (حتى مع passthrough) غش محتمل:



المشكلة مو بالباسثرو نفسه، المشكلة بأنظمة الحماية اللي تشتغل بمستوى الـ kernel وما تقدر تفرّق بين مستخدم شرعي وشخص يستخدم VM لإخفاء أدوات غش، فتحظر الكل:



&#x20;   Riot Vanguard (Valorant, League of Legends) — الأشد صرامة، يمنع التشغيل جوا أي VM من الأساس

&#x20;   Easy Anti-Cheat (Fortnite, Apex Legends, Rust) — يحظر أغلب الحالات

&#x20;   BattlEye (PUBG, Rainbow Six Siege, Destiny 2, Sea of Thieves, Helldivers 2) — نفس الشي، وبعض الحلول القديمة (تفعيل Hyper-V) صارت غير مضمونة وتتكسر مع كل تحديث

&#x20;   Roblox صار يحظرها مؤخرًا هو الثاني



أقل قيودًا: CS2 (VAC أقل عدائية تجاه VMs)، وأي لعبة بدون anti-cheat على مستوى الـ kernel (تعاونية، إندي، قديمة).



يعني لو أساس لعبك من القائمة الأولى، لا تبني كل الخطة حول VM مشترك — خصص جهاز فيزيائي صغير يشتغل ويندوز مباشرة (بدون VM) لهذي الألعاب تحديدًا، وخلي السيرفر للباقي. محاولات إخفاء بصمة الـ hypervisor موجودة بالمجتمعات بس تخالف شروط الاستخدام وتتكسر باستمرار — ما أنصح فيها.



٢) k3s باختصار:



نسخة مصغّرة من Kubernetes، ملف تشغيل واحد أقل من 100MB، تستخدم SQLite بدل etcd فتخف على الموارد، وتركيبها أمر واحد. فايدتها الحقيقية تطلع لما يكون عندك أكثر من جهاز فيزيائي توزع الخدمات بينهم بجدولة تلقائية. بحالتك (صندوق واحد) Proxmox وحده أبسط وكافي؛ لو حبيت تتعلمها كمطور، شغّلها جوا VM على نفس Proxmox بدون ما تأثر على البنية الأساسية.



٣) الأجهزة الطرفية لكل شاشة — تصحيح مهم للفكرة:



ما تحتاج توصل كيبورد وماوس بالسيرفر أو تخصص VM لكل شاشة. عندك VM ويندوز واحد بس (فيه الـ GPU)، وكل غرفة تحتاج فقط:



&#x20;   جهاز رخيص يشغّل تطبيق Moonlight

&#x20;   كيبورد/ماوس أو يد تحكم لاسلكية توصل بهذا الجهاز نفسه، مو بالسيرفر



ما فيه أسلاك أو USB passthrough من كل غرفة — البث كله عبر الشبكة.



شاشة الصالة تحديدًا: ما تحتاج ويندوز فيها إطلاقًا. لو صندوق شاومي عندك Android TV (أغلب Mi Box/Mi TV Stick كذا)، نزّل Moonlight عليه مباشرة وربط كيبورد+ماوس بلوتوث أو يد تحكم بنفس الصندوق — خلاص. لو نسخة مقفلة ما تدعم تثبيت تطبيقات، البدائل: Android TV box عادي، أو Raspberry Pi يشغّل moonlight-embedded، أو Nvidia Shield TV لدعم أفضل.



نقطة تأثر على التخطيط: بما إن عندك GPU واحد وVM ألعاب واحد، جلسة لعب واحدة بس تشتغل بكامل الأداء بأي لحظة — ما تقدر شخصين يلعبون بغرفتين مختلفتين بنفس الوقت بأداء كامل إلا لو ضفت GPU ثاني لاحقًا. الأفلام (جيلفن) مختلفة، تبث لعدة شاشات بنفس الوقت بدون مشكلة لأن الترميز أخف بكثير.



اوكي اعد ترتيب الانظمة والاجهزة من الصين كلسته بالمواصفات كامله والمعماريه المستهدفه والرامات والبور سبلاي وكرتين شاشة تناسب اعمالي

مع اجهزة رخيصة جدا ولكن تخدمني لشاشتين او ثلاثه مع شاشتين كمبيوتر باجمالي اربعه اجهزة رسميه في البيت غير الجوال وبعض خدمات الصور والكاميرات المنزلية لامان تام وهادرسكات ٨ تيرا بجامالي ميزانية 12000 ريال سعودي مع كل هذا بالحسبان مع كيبوردات وماوسات رهيبه سلسه الاستخدام ومثالية

اظفت كرتين شاشة لان الالعاب مهمه وفي حالة ال ai يحتاج مودل اكبر ولا احد يلعب مثلا يتم استغلالها اوتوماتيكا والتحديثات تتم بشكل الي ويمكن شراء جي بي يو رخيص لهذه الالعاب اللتي ما تدعم الباس ثرو ! ام لا هي ثثغرة بالنظام نفسه لانها العاب خفيفة الاداء فيمكن استثمار جهاز العاب بسيط وصغير ليدعم هذه الحالات

Created a file, read memory, updated memory

خطة تجهيز السيرفر المنزلي — الصين

Artifact·Only you



رتّبت لك كل شي بمستند كامل — البنية جهازين فيزيائيين (السيرفر الرئيسي بكرت الـ 3090 للألعاب المتساهلة والذكاء الاصطناعي وأعمالك، والجهاز الصغير بكرت 3060 مباشرة على ويندوز للألعاب اللي ترفض الـ VM)، مع محطات العرض الأربعة والتخزين والكيبوردات والكاميرات، وجدول ميزانية كامل يتراوح بين 9,480–12,080 ريال — يحتضن ميزانيتك بالضبط.



فكرتك عن الجهاز الصغير المنفصل كانت صحيحة تمامًا وأضفتها كما هي بالخطة.



هل يمكن من خلال البروكسموكس proxmox بناء نظام للعب الالعاب بالجهاز المستقل الضعيف لدعم صورته وتحسينها كتقنيات dlss 5 من  انفيديا او frame generation من السيرفر ليبث صورة لايف للعبه من الجهاز المستقل ومن ثم الى السيرفر ومن ثم الى شاشة الالعاب بشكل اجمل بس كعرض حي بدون latency ويعتبر حل مثالي لدعم اجهزة البيت ؟

Searched the web



السؤال الصريح: لا، هذا التصميم ما يشتغل بالشكل اللي تتخيله — والسبب مو تفصيل تقني بسيط، هو تعارض جوهري بمبدأ عمل DLSS نفسه.



ليش ما يشتغل:



DLSS (وحتى DLSS 5 اللي أعلنت عنه نفيديا رسميًا مارس 2026) مو فلتر فيديو عام يُطبّق على أي بث مصوّر — هو يحتاج بيانات من داخل محرك اللعبة نفسه أثناء الرندر: متجهات الحركة (motion vectors) وبيانات العمق، تُغذّى مباشرة للموديل عبر مكتبة NVIDIA Streamline المدمجة باللعبة، وتُعالج على نفس الكرت اللي يرندر الفريم. بمجرد ما الصورة تترندر وتترمّز لفيديو (زي اللي يصير بالـ Moonlight/Sunshine)، هذي البيانات تضيع نهائيًا — ما فيه طريقة لسيرفر منفصل يستقبل فيديو جاهز ويطبّق عليه "DLSS حقيقي" لأنه ببساطة مالها معلومات المحرك يحتاجها.



بالإضافة، DLSS 5 تحديدًا معلن أنه حصري لكروت RTX 50-series ولألعاب قصصية/فردية معينة (Starfield, Assassin's Creed Shadows...)، مو للألعاب التنافسية اللي بنيت الجهاز الضعيف من أجلها أساسًا.



والأهم — القفزة الإضافية تزيد اللاتنسي مو تقلله:



المسار اللي تقترحه (رندر بالجهاز الضعيف → ترميز → شبكة → فك ترميز بالسيرفر → معالجة AI → إعادة ترميز → شبكة → فك ترميز بالشاشة) يضيف مرحلتين ترميز/فك ترميز كاملتين + قفزة شبكة إضافية فوق المسار العادي. هذا يزيد اللاتنسي، ما يلغيه — بالضبط عكس اللي تبيه، وعكس سبب وجود الجهاز المستقل من الأساس (ألعاب أونلاين حساسة للتأخير).



الحل الفعلي (وهو أبسط بكثير):



كرت الـ RTX 3060 اللي بالجهاز الضعيف عنده Tensor Cores بنفسه — يعني DLSS Super Resolution العادي (مو 5) يشتغل عليه محليًا بدون أي قفزة شبكة، بأي لعبة تدعمه، بلا أي لاتنسي إضافي. هذا يعطيك تحسين الصورة اللي تبيه مجانًا من غير تعقيد. واللاعبين التنافسيين أصلًا غالبًا يقفلون تقنيات AI upscaling/frame-gen بالألعاب السريعة لأنها تزيد لاتنسي المدخلات وتسبب ghosting بالحركة — يفضلون الرندر الخام النظيف. يعني التصميم اللي بنيناه أصلًا (جهاز بسيط يرندر مباشرة ويبث) هو الحل المثالي فعلاً، بدون حاجة لأي حلقة إضافية عبر السيرفر.

Sequencing purchases around the financing timeline and budget.



Given the 6-month runway and the financing option, this isn't really a "what to buy" question anymore — it's a "what should the foundation look like in 2-3 years" question. That reframes DDR5-vs-unified-memory as architecture philosophy, not a shopping list.



The core answer: build the backbone on modular DDR5 + discrete GPU + standard Linux, not a soldered unified-memory box. Here's why, against each thing you listed:



Redundancy — A soldered unified-memory box (Strix Halo, Mac, DGX-style) is one unit: if it needs more memory, or a part degrades, the whole box is scrap. A modular system means every part — PSU, RAM stick, GPU, drive — is independently replaceable. That's what redundancy actually means for a hub meant to survive years, not a purchasing decision, it's a structural property of the design.



"Might invest more later" — this is the one that rules out unified memory outright. A soldered box has a hard ceiling the moment you buy it; the only way to add capacity is buying an entirely new box. DDR5 on a real motherboard means you add RAM, swap in a bigger GPU, add a second GPU, add drives — incrementally, whenever budget allows. "Might invest more" and "fixed at purchase" don't coexist.



Dev support — NVIDIA still wins clearly over anything in the unified-memory APU space right now. CUDA is the default target for nearly every ML framework and tutorial; AMD's ROCm has improved but stays second-tier for anything you actually want to build and debug yourself. Same logic on the platform side: Proxmox/KVM/Docker on standard x86 Linux is the most documented, most enduring homelab stack there is — a boutique mini PC's Linux support is comparatively thin.



Hybrid growth for a household — this is the strongest case for modular. Once you have more than one physical box (which you will, eventually, with wife/kids access, AI growth, redundancy needs), that's exactly where k3s/Kubernetes starts paying off — orchestrating across nodes, not administering one fixed appliance. A soldered box can only ever be itself; a Linux server can become the first node of something bigger.



Where unified memory still earns a place: as an add-on appliance later, not the backbone now. If in a year or two you want a compact, low-power, always-on box for one defined job, buying one then — ecosystem more mature, prices likely lower — is a perfectly fine incremental purchase. It's just never the right thing to bet years of core infrastructure on, since it can't grow with you.



On financing: Tabby/Tamara spreading the cost removes the main practical reason to compromise into the cheap-fixed-box now — you don't need to hit a small upfront number anymore. That said, I'm not the source for either service's actual terms/fees — worth checking directly since installment plans carry their own cost.



For the 6 months practically: don't lock a spec today. Rough buying order as the trip and budget allow: (1) case, motherboard, CPU, PSU — these age slowest, safe to commit early; (2) DDR5 RAM, whatever fits now, knowing you can add sticks later; (3) GPU and bulk storage last, closest to when you actually need them — pricing on both has been volatile this year, and waiting lets you see where it settles before committing the biggest line items.



okay and deep dive on the best combo arch of motherboard cpu and modified gpu with high vram and multiple to go with for gaming and dlss 5 and or intel or amd by 1st half of 2027to plan ahead and llm and kvcashe soultions and agentic and syntific discovery and so on based on ai 2027 paper and timeline being 100% accurate and true

Searched the web

You are out of free messages until 4:10 PM





Claude is AI and can make mistakes. Please double-check cited sources.



إليك التعمق التقني الشامل والمعماري (Deep Dive) لمنظومة سيرفر + ألعاب + ذكاء اصطناعي محلي بـ VRAM عالي بمنتصف 2026/2027، مصممة خصيصاً لميزانية الـ 10 آلاف ريال سعودي مع استغلال فرصة السفر إلى الصين (سوق Xianyu و Huaqiangbei).1. معمارية المنصة: المعالج واللوحة الأم (AMD vs Intel)في بيئة تجمع بين Proxmox Virtualization + AI Engine + Gaming VM Passthrough، الخيار الأفضل بوضوح حتى 2027 هو منصة AMD AM5 بدلاً من Intel.لماذا AMD AM5 بدلاً من Intel؟استدامة المقبس (Socket Longevity): مقبس AM5 مستمر بدعم الترقية حتى 2027+ (تقدر تبدأ بمعالج Ryzen 9 7900X وتحدث لاحقاً لـ Ryzen 9000X3D أو أجيال لاحقة على نفس اللوحة).عزل IOMMU و PCIe Passthrough: لوحات AMD الخادشية/الاحترافية توفر عزل IOMMU ممتاز جداً ومجرب لتمرير كروت الشاشة للـ VMs بدون مشاكل التعارض.دعم ذاكرة ECC (Unbuffered ECC): معظم لوحات AMD AM5 تدعم RAM ECC تلقائياً، وهي ميزة حاسمة لاستقرار سيرفر يشتغل 24/7 دون كراشات بيانات.استهلاك الطاقة والحرارة: معالجات AMD أكثر كفاءة في استهلاك الطاقة عند الضغط المستمر (AI Workloads) مقارنة بـ Intel.اللوحة الأم الحاسمة (Motherboard Requirement):تحتاج لوحة أم تدعم تقسيط ممرات PCIe (PCIe Bifurcation x8/x8) من السلوت الأول والثاني، وتأتي بشرائح AMD X670E أو X870E:الخيارات الممتازة:ASUS ProArt X670E-Creator WiFi (الخيار الذهبي: عزل IOMMU ممتاز، x8/x8 PCIe 5.0، منافذ 10GbE + 2.5GbE مدمجة).ASRock X670E Steel Legend أو ASRock Taichi (دعم ممتاز جداً لـ IOMMU وتقسيط PCIe).المعالج الموصى به:Ryzen 9 7900X / 7950X (مستعمل من الصين): يحتوي على 12 إلى 16 نواة / 24 إلى 32 مسار. خيار مثالي لتوزيع 8 أنوية لـ VM الألعاب و 8-16 نواة لسيرفر الذكاء الاصطناعي والـ LXCs.2. دمج كروت الشاشة (GPU Combo) وتقنيات DLSS 4/5 والكروت المعدلة من الصينتحدي 2026/2027 هو جمع أداء ألعاب ممتاز مع دعم تقنيات DLSS الحديثة (DLSS 3/4 Frame Gen) مع VRAM ضخم للذكاء الاصطناعي (LLM \& KV Cache) ضمن ميزانية محددة.الكروت المعدلة في الصين (Huaqiangbei \& Xianyu):في أسواق هوانغشيانغبي (سوق SEG الإلكتروني)، تجد تعديلات شائعة ومطلوبة جداً لمجتمع الـ AI:RTX 3090 24GB Turbo (Blower Fan Mod): كروت 3090 معدلة بتبريد توربيني (Blower) وشريحة نحيفة 2-Slot. ميزتها أنها تسمح بتركيب كرتين جنب بعض داخل الصندوق دون أن تحرّم الكرت العلوي من الهواء.RTX 2080 Ti 22GB Mod: كروت 2080Ti معدلة بـ VRAM مضاعف. رخيصة جداً بالصين (\~1200-1500 ريال)، لكنها تفتقر لـ Frame Generation (DLSS 3+) ولا تصلح ككرت ألعاب أساسي للمستقبل.RTX 4090 / 4080 Super Blower / Modded: كروت Ada Lovelace معدلة لتناسب السيرفرات.التجميعة المثالية لكرتين (Dual-GPU Setup):لتحقيق أفضل معادلة ألعاب + ذكاء اصطناعي:الكرت الأول (Gaming + Main Inference): RTX 4070 Ti Super 16GB أو RTX 4080 Super (جديد أو مستعمل)الوظيفة: مخصص لـ VM الألعاب عبر Sunshine/Moonlight.المميزات: يدعم DLSS 3/4 Frame Gen، أداء ممتاز على 4K/2K، استهلاك طاقة منخفض نسبياً (285W)، و16GB VRAM كافية جداً لأي لعبة حتى 2027.الكرت الثاني (AI / Heavy KV Cache / Agentic Worker): RTX 3090 24GB Blower Mod (مستعمل من الصين - Xianyu)الوظيفة: محرك حصري للذكاء الاصطناعي (Ollama, vLLM, SGLang, Agentic loops).المميزات: 24GB VRAM بعرض نطاق memory bandwidth عالي جداً (936 GB/s)، وسعره رخيص مستعمل بالصين (\~2500-2800 ريال).الاستفادة القصوى عند تشغيل الذكاء الاصطناعي (Multi-GPU Parallelism):عندما لا تكون تلعب، يمكنك دمج الكرتين عبر Tensor Parallelism (TP=2) في مكتبات مثل vLLM أو SGLang:$$\\text{Total VRAM} = 16\\text{GB} + 24\\text{GB} = 40\\text{GB VRAM}$$هذا الحجم يتيح تشغيل موديلات 70B (مثل Qwen 2.5 70B أو DeepSeek-R1 Distill 70B) بضغط FP8 / Q4 بسرعة استجابة عالية جداً!3. معمارية الذكاء الاصطناعي وإدارة KV Cache والـ Agentic Workflows (2026/2027)بناءً على اتجاهات الذكاء الاصطناعي لعام 2026/2027 (Test-Time Compute، نماذج التفكير والاستنتاج DeepSeek-R1 / Qwen Reasoning)، المشكلة الأساسية لم تعد حجم النموذج فقط، بل تضخم الـ KV Cache مع السياق الطويل (Long Context).       ┌─────────────────────────────────────────────────────────┐

&#x20;      │                 Proxmox VE (Host OS)                    │

&#x20;      └──────────────────────────┬──────────────────────────────┘

&#x20;                                 │

&#x20;        ┌────────────────────────┴────────────────────────┐

&#x20;        ▼                                                 ▼

┌─────────────────────────┐               ┌────────────────────────────────┐

│   Windows Gaming VM     │               │     AI / Services LXC/VM       │

│  (GPU 1: RTX 4070Ti S)  │               │     (GPU 2: RTX 3090 24GB)     │

├─────────────────────────┤               ├────────────────────────────────┤

│ • Sunshine Server       │               │ • vLLM / SGLang Engine         │

│ • Local PC Gaming       │               │ • FlashAttention-3 / PagedAttn │

│ • Stream via Moonlight  │               │ • Ollama + Open-WebUI          │

│   to TVs / Handhelds    │               │ • Agentic Engine (LangGraph)   │

└─────────────────────────┘               │ • Offload KV Cache to Host RAM │

&#x20;                                         └────────────────────────────────┘

حلول الـ KV Cache والذاكرة المطلوبة:PagedAttention \& RadixAttention (vLLM / SGLang):بدلاً من حجز VRAM ثابت لكل مستخدم، هذه المحركات تقسم الـ KV Cache إلى صفحات (Pages) ديناميكية. SGLang متفوق جداً في الـ Agentic Workflows لأنه يعيد استخدام الـ Prompts المتكررة (Prefix Caching) بسرعة ضخمة.Quantized KV Cache (FP8 / INT8 KV Cache):تقليل حجم الـ KV Cache بنسبة 50% إلى 75% بدقة FP8 أو INT4. هذا يتيح لك تشغيل سياق (Context Window) يصل إلى 128k Tokens لنموذج 70B دون نفاد ذاكرة الكرت.Host Memory Offloading (DDR5 128GB):محرك vLLM يسمح بنقل الـ KV Cache الزائد من VRAM الكرت إلى ذاكرة النظام الرئيسية (Host DDR5 RAM) عبر ممرات PCIe 5.0/4.0.التوصية: تركيب 128GB RAM DDR5 (4x32GB أو 2x64GB) بسرعة 5600/6000MHz.4. توزيع الميزانية المستهدفة (10,000 ريال سعودي)التشريعات والأسعار المتوقعة لشراء القطع (مزيج من جديد ومستعمل من الصين):القطعةالتفاصيل والمصدرالسعر التقديري (بالريال)المعالج (CPU)AMD Ryzen 9 7900X (مستعمل من الصين - Xianyu)\~ 1,100 - 1,300 ريالاللوحة الأم (Mobo)ASUS ProArt X670E-Creator أو ASRock X670E (جديدة أو مفتوحة الصندوق)\~ 1,500 - 1,800 ريالالرامات (RAM)128GB (2x64GB أو 4x32GB) DDR5 5600/6000MHz Expo\~ 1,400 - 1,600 ريالكرت الشاشة 1 (الألعاب)RTX 4070 Ti Super 16GB (مستعمل ممتازة / سوق محلي أو الصين)\~ 2,800 - 3,200 ريالكرت الشاشة 2 (AI)RTX 3090 24GB Blower Mod (مستعمل - سوق الصين Huaqiangbei)\~ 2,500 - 2,800 ريالالتخزين (Storage)2TB PCIe 4.0 NVMe (للـ VMs والـ AI) + 8TB HDD مستعمل سيرفرات (للميديا)\~ 900 ريالمزود الطاقة (PSU)جديد حصراً: 1200W 80+ Gold / ATX 3.0 (مثل Seasonic أو Corsair)\~ 900 ريالالصندوق والتبريدCasing واسع يدعم كرتين شاشة + مبرد مائي 360mm AIO\~ 700 ريالالمجموعمنظومة سيرفر + ألعاب + ذكاء اصطناعي خارق\~ 10,500 - 11,500 ريال(ملاحظة: يمكنك البدء بكرت واحد RTX 3090 24GB بخصم \~3000 ريال من المجموع الأولي، وتأجيل كرت الألعاب 4070 Ti Super للترقية لاحقاً عند الحاجة).5. نصائح وتوجيهات عملية للتسوق من الصين (Huaqiangbei \& Xianyu)تطبيق Xianyu (闲鱼): هو حراج الصين المستعمل التابع لـ Alibaba. تجد فيه المعالجات، كروت الشاشة، واللوحات بأسعار أرخص بـ 30-40% من السوق العالمي.فحص كروت الشاشة في هوانغشيانغبي:اطلب تشغيل برنامج GPU-Z وبرنامج FurMark لمدة 20 دقيقة على الأقل للتحقق من الحرارة.اطلب اختبار الـ VRAM عبر أداة MODS/MATS الخاصة بنvidia للتأكد من عدم وجود أي خلل في رقاقات الذاكرة (Memory Chips).مزود الطاقة (PSU): لا تشترِ PSU مستعمل إطلاقاً. اشترِ مزود طاقة جديد كلياً مع ضمان يدعم معايير ATX 3.0 / PCIe 5.0 لحماية أجهزتك من أي تذبذب كهربائي.الخلاصة والمعمارية الموصى بهاالبنية المثالية لمنزل العمر هي: Proxmox VE على لوحة AMD AM5 (X670E) + معالج Ryzen 9 + رام 128GB DDR5 + كرتين شاشة (RTX 4070Ti Super للألعاب والـ Passthrough و RTX 3090 24GB للذكاء الاصطناعي و الـ KV Cache). هذا يعطيك أداءً مستداماً، مرونة لا مثيل لها للترقية مستقبلاً، ودعماً كاملاً لبث الألعاب إلى كافة شاشات المنزل عبر Sunshine/Moonlight بحد أدنى من التأخير وقوة خرافية في معالجة نماذج الذكاء الاصطناعي المحلية.

