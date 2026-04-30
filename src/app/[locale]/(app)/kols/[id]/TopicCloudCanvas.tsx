"use client";

/**
 * B5-F006 · Client-only @visx/wordcloud renderer.
 *
 * Pulled out of TopicCloud.tsx so the entire @visx/wordcloud +
 * d3-cloud chunk lives behind a `next/dynamic({ ssr: false })`
 * boundary in TopicCloud.tsx. Other pages don't pay the bundle cost;
 * SSR can't trip on visx's window/document references.
 *
 * Sizing per spec §F006 #4: fontSize = 14 + weight * 18 → 14-32px.
 * Container is fixed 100% width × max-h 240px; visx's d3-cloud layout
 * collapses extra terms when packing fails (which is fine — the
 * loader already caps at 10 keywords).
 */
import { Wordcloud } from "@visx/wordcloud";
import { useMemo } from "react";

import type { TopicKeyword } from "@/lib/kol-detail/topic-cloud";

interface Props {
  keywords: TopicKeyword[];
}

interface WordcloudDatum {
  text: string;
  value: number;
}

const WIDTH = 480;
const HEIGHT = 220;
const MIN_FONT = 14;
const MAX_FONT = 32;
const COLORS = ["#67e8f9", "#22d3ee", "#a5f3fc", "#fef3c7", "#fde68a"];

function fontSizeFromWeight(weight: number): number {
  // weight is already clamped 0..1 by normalizeKeywords; map linearly
  // into the 14-32px design range.
  const clamped = Math.max(0, Math.min(1, weight));
  return Math.round(MIN_FONT + clamped * (MAX_FONT - MIN_FONT));
}

// Deterministic pseudo-random seeded by the keyword set so the layout
// stays stable across re-renders (avoids the cloud reshuffling every
// time React re-evaluates the component).
function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

export default function TopicCloudCanvas({ keywords }: Props) {
  const words = useMemo<WordcloudDatum[]>(
    () =>
      keywords.map((k) => ({
        text: k.term,
        value: fontSizeFromWeight(k.weight),
      })),
    [keywords]
  );

  const seed = useMemo(() => hashString(keywords.map((k) => k.term).join("|")) || 1, [keywords]);

  if (words.length === 0) return null;

  return (
    <div className="w-full" data-testid="kol-topic-cloud-canvas">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-auto max-h-[240px] w-full"
        role="img"
        aria-label="Topic cloud"
      >
        <Wordcloud<WordcloudDatum>
          words={words}
          width={WIDTH}
          height={HEIGHT}
          fontSize={(d) => d.value}
          font="Inter, system-ui, sans-serif"
          padding={3}
          spiral="archimedean"
          rotate={0}
          random={seededRandom(seed)}
        >
          {(cloudWords) =>
            cloudWords.map((w, i) => (
              <text
                key={`${w.text}-${i}`}
                fill={COLORS[i % COLORS.length]}
                textAnchor="middle"
                transform={`translate(${w.x ?? 0}, ${w.y ?? 0}) rotate(${w.rotate ?? 0})`}
                fontSize={w.size}
                fontFamily={w.font}
              >
                {w.text}
              </text>
            ))
          }
        </Wordcloud>
      </svg>
    </div>
  );
}
