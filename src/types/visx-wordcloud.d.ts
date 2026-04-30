/**
 * B5-F006 fixing-1 · Local ambient types for @visx/wordcloud.
 *
 * The published @visx/wordcloud@4.0.1-alpha.0 ships its own .d.ts
 * files under `lib/index.d.ts`, but those types are not always
 * resolved (npm install vs npm ci timing, stale node_modules,
 * alpha-tag republish drift). This shim mirrors the upstream surface
 * we actually use so the typechecker is deterministic across all
 * environments — Reviewer flagged `Cannot find module @visx/wordcloud`
 * + `Implicit any on d/cloudWords/w/i` after the F005 push.
 *
 * The augmentation is `declare module` (not `module/export =`) so
 * if upstream types DO load, theirs win and ours are no-ops.
 */
declare module "@visx/wordcloud" {
  import type { ReactNode } from "react";

  export interface BaseDatum {
    text: string;
  }

  export interface CloudWord {
    text?: string;
    font?: string;
    style?: string;
    weight?: string | number;
    rotate?: number;
    size?: number;
    padding?: number;
    x?: number;
    y?: number;
  }

  export interface WordcloudConfig<Datum extends BaseDatum> {
    width: number;
    height: number;
    words: Datum[];
    padding?: number | ((datum: Datum, index: number) => number);
    font?: string | ((datum: Datum, index: number) => string);
    fontSize?: number | ((datum: Datum, index: number) => number);
    fontStyle?: string | ((datum: Datum, index: number) => string);
    fontWeight?:
      | string
      | number
      | ((datum: Datum, index: number) => string | number);
    rotate?: number | ((datum: Datum, index: number) => number);
    spiral?:
      | "archimedean"
      | "rectangular"
      | ((size: [number, number]) => (t: number) => [number, number]);
    random?: () => number;
  }

  export interface WordcloudProps<Datum extends BaseDatum>
    extends WordcloudConfig<Datum> {
    children: (words: CloudWord[]) => ReactNode;
  }

  export function Wordcloud<Datum extends BaseDatum>(
    props: WordcloudProps<Datum>
  ): JSX.Element | null;
}
