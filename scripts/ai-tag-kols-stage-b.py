#!/usr/bin/env python3
"""
Stage B: 对 Stage A 的 low-confidence Other 用 Jina Reader 抓 YouTube
About 页后，再喂 LLM 重判，救回被误判为 Non-gaming 的游戏 KOL。

用法:
    AIGCGATEWAY_API_KEY=pk_xxx python3 scripts/ai-tag-kols-stage-b.py

输入: docs/kol-seed-enriched.json (Stage A 结果)
输出:
    docs/kol-seed-stage-b.json      — Stage B 单独结果（仅重判部分）
    docs/kol-seed-enriched-final.json — 合并后的最终结果
    docs/kol-seed-stage-b-summary.txt — 统计
"""
import json, os, time, sys, requests
from concurrent.futures import ThreadPoolExecutor, as_completed

IN_A = "docs/kol-seed-enriched.json"
OUT_B = "docs/kol-seed-stage-b.json"
OUT_FINAL = "docs/kol-seed-enriched-final.json"
OUT_SUMMARY = "docs/kol-seed-stage-b-summary.txt"

API_KEY = os.environ.get("AIGCGATEWAY_API_KEY")
API_BASE = "https://aigc.guangai.ai/v1"
MODEL = "claude-haiku-4.5"
BATCH_SIZE = 20               # 更小 batch 因为每条带 About 页文本
JINA_CONCURRENCY = 10         # jina 并发抓
JINA_TIMEOUT = 30
JINA_MAX_CONTENT = 2500       # 每条 About 页内容最多 2500 chars 喂 LLM
RATE_SLEEP = 1.0

if not API_KEY:
    sys.exit("ERROR: set AIGCGATEWAY_API_KEY env var")

SYSTEM_PROMPT = """You are re-classifying YouTube creators whom an earlier pass marked as non-gaming with LOW confidence. Now you have the actual YouTube channel "About" page content for each creator. Use this fresh context to decide whether they are actually gaming creators we missed.

Available categories (exactly these 11):
- MOBA · RPG · FPS · Simulation · Casual · Esports · Retro
- 手游 · 二次元 · 沙盒 · Other

Rules:
1. Base judgment on the channel_about content + name + handle.
2. If the About page clearly shows this is a gaming channel, classify accordingly (0-3 categories).
3. If the About is truly non-gaming (lifestyle/tech/music/family/etc), keep as ["Other"].
4. If About is empty/error/insufficient, fall back to ["Other"] with low confidence.
5. Return confidence: high / medium / low.
6. Return 1-line reasoning (≤ 15 words).
7. Output JSON object with key "classifications" mapping to an array with idx.

Example output:
{"classifications":[{"idx":0,"categories":["FPS"],"confidence":"high","reasoning":"About explicitly mentions CS2 gameplay videos"}]}"""


def fetch_jina(url):
    """Fetch YouTube channel /about via Jina Reader. Return cleaned text."""
    jina_url = f"https://r.jina.ai/{url.rstrip('/')}/about"
    try:
        resp = requests.get(jina_url, timeout=JINA_TIMEOUT)
        resp.raise_for_status()
        text = resp.text
        # Extract just "Markdown Content:" body
        marker = "Markdown Content:"
        if marker in text:
            text = text.split(marker, 1)[1]
        # Strip header noise (nav links, titles)
        lines = []
        skip_header = True
        for line in text.splitlines():
            if skip_header:
                if line.startswith("#") or "|" in line or line.startswith("["):
                    continue
                if line.strip() and not line.startswith(("Title:", "URL", "登录", "订阅")):
                    skip_header = False
            lines.append(line)
        cleaned = "\n".join(lines)[:JINA_MAX_CONTENT]
        return cleaned.strip() or "(empty)"
    except Exception as e:
        return f"(fetch error: {type(e).__name__})"


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
            print(f"  LLM retry {attempt+1}/{retries}: {e}", file=sys.stderr, flush=True)
            time.sleep(2 ** attempt)
    raise RuntimeError(f"LLM failed after {retries} retries")


def main():
    with open(IN_A) as f:
        stage_a = json.load(f)

    # Filter: Stage A judged non-gaming with LOW confidence
    targets = [r for r in stage_a["results"] if not r["is_gaming"] and r["confidence"] == "low"]
    print(f"Stage A total: {stage_a['total']}, low-conf non-gaming targets: {len(targets)}", file=sys.stderr, flush=True)

    # Phase 1: Parallel Jina fetch
    t0 = time.time()
    print(f"\n[Phase 1] Fetching {len(targets)} channels via Jina (concurrency={JINA_CONCURRENCY})", file=sys.stderr, flush=True)
    fetched = {}
    with ThreadPoolExecutor(max_workers=JINA_CONCURRENCY) as ex:
        futs = {ex.submit(fetch_jina, r["url"]): r["idx"] for r in targets}
        for i, fut in enumerate(as_completed(futs)):
            idx = futs[fut]
            try:
                fetched[idx] = fut.result()
            except Exception as e:
                fetched[idx] = f"(error: {e})"
            if (i + 1) % 50 == 0 or i + 1 == len(targets):
                elapsed = time.time() - t0
                print(f"  fetched {i+1}/{len(targets)} ({elapsed:.0f}s)", file=sys.stderr, flush=True)

    print(f"[Phase 1] done in {time.time()-t0:.0f}s", file=sys.stderr, flush=True)

    # Phase 2: Batched LLM re-classification
    t1 = time.time()
    total_batches = (len(targets) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"\n[Phase 2] Re-classifying {len(targets)} via {MODEL} in {total_batches} batches", file=sys.stderr, flush=True)

    stage_b_results = []
    total_prompt_tokens = 0
    total_completion_tokens = 0

    for batch_idx in range(total_batches):
        start = batch_idx * BATCH_SIZE
        end = min(start + BATCH_SIZE, len(targets))
        batch = targets[start:end]

        lines = []
        for local_idx, r in enumerate(batch):
            handle = r["url"].split("/")[-1] if r["url"] else ""
            about = fetched.get(r["idx"], "(no data)")
            lines.append(
                f'[{local_idx}] name={r["name"]!r}, handle={handle!r}, '
                f'region={r["region"]!r}, followers={r["followers"]}\n'
                f'    channel_about: """{about[:1500]}"""'
            )
        user_msg = (
            f"Re-classify these {len(batch)} YouTube creators based on their actual About page content:\n\n"
            + "\n\n".join(lines)
            + '\n\nReturn strict JSON with "classifications" key using local idx.'
        )

        try:
            parsed, usage = call_chat(user_msg)
        except Exception as e:
            print(f"batch {batch_idx+1}/{total_batches} FAIL: {e}", file=sys.stderr, flush=True)
            for local_idx, r in enumerate(batch):
                stage_b_results.append({
                    "idx": r["idx"], **r,
                    "stage_b_categories": ["Other"],
                    "stage_b_confidence": "low",
                    "stage_b_reasoning": "batch-failed, keep Other",
                    "stage_b_is_gaming": False,
                    "recovered": False,
                })
            continue

        total_prompt_tokens += usage.get("prompt_tokens", 0)
        total_completion_tokens += usage.get("completion_tokens", 0)

        cls_by_idx = {c["idx"]: c for c in parsed.get("classifications", [])}
        for local_idx, r in enumerate(batch):
            cls = cls_by_idx.get(local_idx, {"categories": ["Other"], "confidence": "low", "reasoning": "missing in response"})
            cats = cls.get("categories", ["Other"])
            is_gaming = bool(cats) and "Other" not in cats
            stage_b_results.append({
                "idx": r["idx"],
                "platform": r["platform"],
                "name": r["name"],
                "url": r["url"],
                "region": r["region"],
                "followers": r["followers"],
                "stage_b_categories": cats,
                "stage_b_confidence": cls.get("confidence", "low"),
                "stage_b_reasoning": cls.get("reasoning", ""),
                "stage_b_is_gaming": is_gaming,
                "recovered": is_gaming,  # was Non-gaming in Stage A, now gaming
            })

        elapsed = time.time() - t1
        eta = elapsed / (batch_idx + 1) * (total_batches - batch_idx - 1)
        print(
            f"  batch {batch_idx+1:3d}/{total_batches} done "
            f"| results={len(stage_b_results)} | "
            f"elapsed={elapsed:.0f}s eta={eta:.0f}s",
            file=sys.stderr, flush=True,
        )
        time.sleep(RATE_SLEEP)

    # Phase 3: Write stage-b standalone
    recovered_count = sum(1 for r in stage_b_results if r["recovered"])
    cat_dist = {}
    for r in stage_b_results:
        if r["stage_b_is_gaming"]:
            for c in r["stage_b_categories"]:
                cat_dist[c] = cat_dist.get(c, 0) + 1

    stage_b_out = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "input_source": IN_A,
        "model": MODEL,
        "total_reclassified": len(stage_b_results),
        "recovered_as_gaming": recovered_count,
        "still_non_gaming": len(stage_b_results) - recovered_count,
        "new_category_distribution": cat_dist,
        "cost_usd": round(total_prompt_tokens * 1e-6 + total_completion_tokens * 5e-6, 4),
        "prompt_tokens": total_prompt_tokens,
        "completion_tokens": total_completion_tokens,
        "wall_time_sec": round(time.time() - t0, 1),
        "results": stage_b_results,
    }
    with open(OUT_B, "w") as f:
        json.dump(stage_b_out, f, ensure_ascii=False, indent=2)

    # Phase 4: Merge into final
    stage_b_by_idx = {r["idx"]: r for r in stage_b_results}
    final_results = []
    for r in stage_a["results"]:
        if r["idx"] in stage_b_by_idx:
            b = stage_b_by_idx[r["idx"]]
            if b["stage_b_is_gaming"]:
                # Override: Stage B found gaming signal
                final_results.append({
                    **r,
                    "is_gaming": True,
                    "categories": b["stage_b_categories"],
                    "confidence": b["stage_b_confidence"],
                    "reasoning": b["stage_b_reasoning"],
                    "stage": "B-recovered",
                })
            else:
                # Stage B agrees not gaming (now higher confidence)
                final_results.append({
                    **r,
                    "confidence": b["stage_b_confidence"],
                    "reasoning": b["stage_b_reasoning"],
                    "stage": "B-confirmed-other",
                })
        else:
            final_results.append({**r, "stage": "A"})

    total_gaming = sum(1 for r in final_results if r["is_gaming"])
    final_cat_dist = {}
    for r in final_results:
        for c in r["categories"]:
            final_cat_dist[c] = final_cat_dist.get(c, 0) + 1

    final_out = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source_xlsx": stage_a.get("source", "docs/Youtube网红清单-1203.xlsx"),
        "stage_a_cost_usd": stage_a.get("cost_usd", 0),
        "stage_b_cost_usd": stage_b_out["cost_usd"],
        "total_cost_usd": round(stage_a.get("cost_usd", 0) + stage_b_out["cost_usd"], 4),
        "total": len(final_results),
        "gaming_count_final": total_gaming,
        "gaming_count_stage_a": stage_a["gaming_count"],
        "gaming_recovered_by_stage_b": recovered_count,
        "category_distribution_final": final_cat_dist,
        "results": final_results,
    }
    with open(OUT_FINAL, "w") as f:
        json.dump(final_out, f, ensure_ascii=False, indent=2)

    # Summary
    summary_lines = [
        "=== Stage B Summary ===",
        f"generated_at:            {stage_b_out['generated_at']}",
        f"low_conf_non_gaming_in:  {len(targets)}",
        f"recovered_as_gaming:     {recovered_count} ({recovered_count/len(targets)*100:.1f}%)",
        f"still_non_gaming:        {len(targets) - recovered_count}",
        f"stage_b_cost_usd:        ${stage_b_out['cost_usd']}",
        f"total_cost_a+b_usd:      ${final_out['total_cost_usd']}",
        f"wall_time:               {stage_b_out['wall_time_sec']}s",
        "",
        "=== Final (Stage A + B) ===",
        f"total_kols:              {final_out['total']}",
        f"gaming_count_final:      {total_gaming}",
        f"gaming_stage_a:          {stage_a['gaming_count']}",
        f"gaming_recovered_by_b:   {recovered_count}",
        "",
        "new categories recovered by B:",
        *[f"  {k}: {v}" for k, v in sorted(cat_dist.items(), key=lambda x: -x[1])],
        "",
        "final category distribution:",
        *[f"  {k}: {v}" for k, v in sorted(final_cat_dist.items(), key=lambda x: -x[1])],
    ]
    with open(OUT_SUMMARY, "w") as f:
        f.write("\n".join(summary_lines) + "\n")
    print("\n".join(summary_lines), file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
