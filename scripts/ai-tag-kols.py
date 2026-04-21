#!/usr/bin/env python3
"""
AI tag 2524 KOLs from XLSX into game categories (方案 C 全量打标).

用法:
    AIGCGATEWAY_API_KEY=pk_xxx python3 scripts/ai-tag-kols.py

输出:
    docs/kol-seed-enriched.json —— 每条 KOL 含 is_gaming / categories / confidence / reasoning
    docs/kol-seed-summary.txt   —— 统计 + 成本
"""
import openpyxl, json, os, time, sys, requests

XLSX_PATH = "docs/Youtube网红清单-1203.xlsx"
OUT_JSON = "docs/kol-seed-enriched.json"
OUT_SUMMARY = "docs/kol-seed-summary.txt"
API_KEY = os.environ.get("AIGCGATEWAY_API_KEY")
API_BASE = "https://aigc.guangai.ai/v1"
MODEL = "claude-haiku-4.5"
BATCH_SIZE = 50
RATE_SLEEP = 1.0  # seconds between batches to respect rate limits

if not API_KEY:
    sys.exit("ERROR: set AIGCGATEWAY_API_KEY env var")

SYSTEM_PROMPT = """You are classifying YouTube content creators into game category tags based on their channel name, handle, and basic metadata. You must return strict JSON with classifications for every creator in the input list.

Available categories (exactly these 11, no others):
- MOBA — Multiplayer online battle arena (LoL, Dota, Honor of Kings)
- RPG — Role-playing games (Genshin, Final Fantasy, Elden Ring)
- FPS — First-person shooter (Valorant, CS2, Call of Duty, Fortnite)
- Simulation — Life/city/vehicle/farming sims (Sims, Cities Skylines, Flight Sim, Farming Simulator)
- Casual — Casual/puzzle/mobile games (Candy Crush, Among Us, Fall Guys, Roblox casual modes)
- Esports — Competitive esports coverage and analysis
- Retro — Retro/classic games (NES, SNES, Arcade, Atari, DOS)
- 手游 — Mobile-first games (Clash Royale, PUBG Mobile, 王者荣耀, Brawl Stars)
- 二次元 — Anime-style games (Genshin, Honkai, Blue Archive, Arknights)
- 沙盒 — Sandbox/building/survival (Minecraft, Roblox building, Terraria, Valheim)
- Other — Non-gaming content or creator is not primarily gaming-focused

Rules:
1. Assign 0-3 categories per creator, ordered most → least relevant. Most creators fit 1 category.
2. If the channel is clearly NOT gaming (e.g. tech, lifestyle, family vlog, music, food, sports), return ["Other"].
3. Base your judgment ONLY on the name and handle text. Do NOT fabricate info. Do NOT browse URLs.
4. Return a confidence: "high" (strong signal) / "medium" (hint but uncertain) / "low" (guessing).
5. Return 1-line reasoning in English (≤ 15 words).
6. Output valid JSON object with key "classifications" mapping to an array.
7. The input has "idx" field — preserve it in the output so the order maps back.

Output schema example:
{"classifications":[{"idx":0,"categories":["MOBA"],"confidence":"high","reasoning":"Name indicates League of Legends"}]}"""


def load_rows():
    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, data_only=True)
    ws = wb["Sheet1"]
    rows = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue
        platform, name, url, region, followers = row
        rows.append({
            "platform": platform, "name": name or "",
            "url": url, "region": region, "followers": followers,
        })
    return rows


def call_chat(user_msg, retries=3):
    for attempt in range(retries):
        try:
            resp = requests.post(
                f"{API_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {API_KEY}"},
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_msg},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                    "max_tokens": 4000,
                },
                timeout=90,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            return json.loads(content), usage
        except Exception as e:
            print(f"  retry {attempt+1}/{retries}: {e}", file=sys.stderr, flush=True)
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Failed after {retries} retries")


def main():
    rows = load_rows()
    print(f"loaded {len(rows)} rows", file=sys.stderr, flush=True)

    total_batches = (len(rows) + BATCH_SIZE - 1) // BATCH_SIZE
    all_results = []
    total_prompt_tokens = 0
    total_completion_tokens = 0
    t0 = time.time()

    for batch_idx in range(total_batches):
        start = batch_idx * BATCH_SIZE
        end = min(start + BATCH_SIZE, len(rows))
        batch = rows[start:end]

        lines = []
        for local_idx, r in enumerate(batch):
            handle = r["url"].split("/")[-1] if r["url"] else ""
            lines.append(
                f'[{local_idx}] name={r["name"]!r}, handle={handle!r}, '
                f'region={r["region"]!r}, followers={r["followers"]}'
            )
        user_msg = (
            f"Classify these {len(batch)} YouTube creators. "
            f"Use the local 'idx' given ([0]...[{len(batch)-1}]):\n\n"
            + "\n".join(lines)
            + '\n\nReturn strict JSON with "classifications" key.'
        )

        try:
            parsed, usage = call_chat(user_msg)
        except Exception as e:
            print(f"batch {batch_idx+1}/{total_batches} FAIL: {e}", file=sys.stderr, flush=True)
            # fill with Other fallback
            for local_idx, r in enumerate(batch):
                all_results.append({
                    "idx": start + local_idx, **r,
                    "is_gaming": False, "categories": ["Other"],
                    "confidence": "low", "reasoning": "batch-failed, default Other",
                })
            continue

        total_prompt_tokens += usage.get("prompt_tokens", 0)
        total_completion_tokens += usage.get("completion_tokens", 0)

        # Index by local idx
        cls_by_idx = {c["idx"]: c for c in parsed.get("classifications", [])}
        for local_idx, r in enumerate(batch):
            cls = cls_by_idx.get(local_idx, {"categories": ["Other"], "confidence": "low", "reasoning": "missing in response"})
            cats = cls.get("categories", ["Other"])
            is_gaming = bool(cats) and "Other" not in cats
            all_results.append({
                "idx": start + local_idx, **r,
                "is_gaming": is_gaming,
                "categories": cats,
                "confidence": cls.get("confidence", "low"),
                "reasoning": cls.get("reasoning", ""),
            })

        elapsed = time.time() - t0
        eta = elapsed / (batch_idx + 1) * (total_batches - batch_idx - 1)
        print(
            f"batch {batch_idx+1:3d}/{total_batches} done "
            f"| results={len(all_results)} | "
            f"elapsed={elapsed:.0f}s eta={eta:.0f}s",
            file=sys.stderr, flush=True,
        )
        time.sleep(RATE_SLEEP)

    # Write
    gaming_count = sum(1 for r in all_results if r["is_gaming"])
    conf_dist = {"high": 0, "medium": 0, "low": 0}
    cat_dist = {}
    for r in all_results:
        conf_dist[r["confidence"]] = conf_dist.get(r["confidence"], 0) + 1
        for c in r["categories"]:
            cat_dist[c] = cat_dist.get(c, 0) + 1

    out = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": XLSX_PATH,
        "model": MODEL,
        "total": len(all_results),
        "gaming_count": gaming_count,
        "non_gaming_count": len(all_results) - gaming_count,
        "confidence_distribution": conf_dist,
        "category_distribution": cat_dist,
        "cost_usd": round(total_prompt_tokens * 1e-6 + total_completion_tokens * 5e-6, 4),
        "prompt_tokens": total_prompt_tokens,
        "completion_tokens": total_completion_tokens,
        "results": all_results,
    }
    with open(OUT_JSON, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    summary_lines = [
        "=== AI Tag Summary ===",
        f"generated_at:   {out['generated_at']}",
        f"total:          {out['total']}",
        f"gaming:         {gaming_count} ({gaming_count/len(all_results)*100:.1f}%)",
        f"non_gaming:     {out['non_gaming_count']}",
        f"cost_usd:       ${out['cost_usd']}",
        f"tokens:         {total_prompt_tokens} in + {total_completion_tokens} out",
        f"wall_time:      {time.time()-t0:.0f}s",
        "",
        "confidence distribution:",
        *[f"  {k}: {v}" for k, v in conf_dist.items()],
        "",
        "category distribution:",
        *[f"  {k}: {v}" for k, v in sorted(cat_dist.items(), key=lambda x: -x[1])],
    ]
    with open(OUT_SUMMARY, "w") as f:
        f.write("\n".join(summary_lines) + "\n")
    print("\n".join(summary_lines), file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
