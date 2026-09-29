// scripts/judge.mjs
// Advisory "System 1" judgements for listing / seller text, using Laya (local, no API cost).
// Reads  data/inbox.json      -> [{ "id": "3090-xianyu-1", "wanted": "RTX 3090 24GB", "text": "listing or seller message", "price_cny": 4200 }]
// Writes data/judgements.json -> flags only. It never touches budgets, FX signal, or landed-cost math.
//
// Run after `node scripts/update.mjs`:   node scripts/judge.mjs

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Laya } from "@receptron/laya";

const INBOX = "data/inbox.json";
const OUT = "data/judgements.json";
const LOW = 0.3; // P(true) inside [LOW, HIGH] = Laya is unsure -> escalate to a free LLM
const HIGH = 0.7;
const MAX_LLM_CALLS = Number(process.env.MAX_LLM_CALLS ?? 20); // protect the 1000/day free quota

if (!existsSync(INBOX)) {
  console.log(`No ${INBOX}; nothing to judge.`);
  process.exit(0);
}
const inbox = JSON.parse(await readFile(INBOX, "utf8"));

const questions = {
  suspicious: {
    type: "noul",
    instructions:
      "Does this listing or seller message look like a scam, a misrepresented item, or a mining or refurbished card sold as new?",
  },
  matches_wanted: {
    type: "noul",
    instructions: "Does the listing match the item the buyer wants?",
  },
  condition: {
    type: "score",
    instructions: "Condition of the item as described",
    criteria: ["poor", "used", "good", "like new"],
  },
};

// English checkpoint by default. For Chinese listings set LAYA_SUBFOLDER=multilingual
// (check that the ONNX repo you use actually publishes that folder).
const loadOpts = {};
if (process.env.LAYA_SUBFOLDER) loadOpts.subfolder = process.env.LAYA_SUBFOLDER;
if (process.env.LAYA_REPO) loadOpts.repo = process.env.LAYA_REPO;
const laya = await Laya.load(loadOpts);

async function secondOpinion(item) {
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL; // set to a ":free" model id you have access to
  if (!key || !model) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              'You check second-hand hardware listings for a buyer. Reply with JSON only: {"verdict":"ok"|"risky"|"mismatch","reason":"<=25 words"}',
          },
          { role: "user", content: `Wanted: ${item.wanted}\nPrice CNY: ${item.price_cny ?? "?"}\nListing: ${item.text}` },
        ],
      }),
    });
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "";
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (err) {
    return { verdict: "error", reason: String(err).slice(0, 80) };
  }
}

const results = [];
let llmCalls = 0;

for (const item of inbox) {
  const state = { wanted: item.wanted, price_cny: item.price_cny, listing: String(item.text).slice(0, 1200) };
  const { answers } = await laya.systemOne(state, questions);

  const suspicious = answers.suspicious.noul;
  const matches = answers.matches_wanted.noul;
  const unsure =
    (suspicious >= LOW && suspicious <= HIGH) || (matches >= LOW && matches <= HIGH);

  let flag = "ok";
  if (suspicious > HIGH || matches < LOW) flag = "review";
  else if (unsure) flag = "unsure";

  let llm = null;
  if (flag !== "ok" && llmCalls < MAX_LLM_CALLS) {
    llm = await secondOpinion(item);
    if (llm) llmCalls++;
  }

  results.push({
    id: item.id,
    flag,
    suspicious: Number(suspicious.toFixed(3)),
    matches_wanted: Number(matches.toFixed(3)),
    condition: Number(answers.condition.score.toFixed(2)), // 0..3
    second_opinion: llm,
  });
}

await laya.close();
await writeFile(
  OUT,
  JSON.stringify({ generated: new Date().toISOString(), note: "Advisory only. Verify in person before paying.", items: results }, null, 2),
);
console.log(`Judged ${results.length} items; ${llmCalls} LLM second opinions.`);
