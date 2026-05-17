/**
 * BL-068-F005 · RefineInputBar error-path unit tests.
 *
 * F003 wired the success path and the basic 4 toast variants; F005
 * adds the strict client-side acceptance from spec §F005:
 *
 *   - unparsable response → unparsable toast + rawQuery preserved in
 *     the input so the user can edit + retry
 *   - permutation_invalid response → distinct permutation toast
 *     (driven by F002's `errorKind` discriminator added in F005)
 *   - capExhausted → cap toast + rawQuery preserved
 *   - network error (server ok:false) → network toast + preserved
 *   - 5s timeout → network toast + preserved
 *   - 5 locale labels: each toast uses the locale-specific string
 *
 * The success-path test stays in AiRecommendationPanel.test.tsx
 * (BL-068-F003 describe) since it exercises the parent cache write
 * end-to-end. Tests here focus on RefineInputBar in isolation so the
 * branching logic + label routing stay independently verifiable.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const applyRefineMock = vi.fn();
vi.mock("../refine-actions", () => ({
  applyRefineAction: (...args: unknown[]) => applyRefineMock(...args),
}));

beforeAll(() => {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
});

const { RefineInputBar } = await import("../RefineInputBar");

const CAMPAIGN = "ddddeeee-aaaa-bbbb-cccc-111122223333";
const POOL = [
  "11111111-1111-1111-1111-111111111111",
  "22222222-2222-2222-2222-222222222222",
  "33333333-3333-3333-3333-333333333333",
];

const LABELS_EN = {
  inputPlaceholder: "Refine with AI",
  applyButton: "Refine",
  resetButton: "Reset to AI default",
  loading: "Refining…",
  feedbackPrefix: "Reranked",
  unparsableToast: "Couldn't understand — try being more specific.",
  capExhaustedToast: "Daily AI quota reached. Current pool unchanged.",
  networkError: "Refine timed out. Please try again.",
  permutationInvalid: "Rerank result was invalid. Current pool unchanged.",
};

const LABELS_ZH = {
  inputPlaceholder: "用 AI 微调",
  applyButton: "重排",
  resetButton: "还原",
  loading: "重排中",
  feedbackPrefix: "已重排",
  unparsableToast: "无法理解，请尝试更具体的描述。",
  capExhaustedToast: "今日 AI 额度已用完，候选池保持不变。",
  networkError: "重排超时，请重试。",
  permutationInvalid: "重排结果无效，候选池保持不变。",
};

const LABELS_JA = {
  inputPlaceholder: "AI で絞り込み",
  applyButton: "絞り込み",
  resetButton: "リセット",
  loading: "絞り込み中",
  feedbackPrefix: "並び替え済み",
  unparsableToast: "理解できませんでした。もう少し具体的に指定してください。",
  capExhaustedToast: "本日の AI 利用上限に達しました。現在の候補は変更されません。",
  networkError: "絞り込みがタイムアウトしました。再試行してください。",
  permutationInvalid: "並び替え結果が無効でした。現在の候補は変更されません。",
};

const LABELS_KO = {
  inputPlaceholder: "AI 정제",
  applyButton: "정제",
  resetButton: "재설정",
  loading: "정제 중",
  feedbackPrefix: "재정렬됨",
  unparsableToast: "이해할 수 없습니다. 더 구체적으로 입력해 주세요.",
  capExhaustedToast: "오늘 AI 할당량을 모두 사용했습니다. 현재 후보는 유지됩니다.",
  networkError: "정제 시간이 초과되었습니다. 다시 시도해 주세요.",
  permutationInvalid: "재정렬 결과가 유효하지 않습니다. 현재 후보는 유지됩니다.",
};

const LABELS_ES = {
  inputPlaceholder: "Refinar con IA",
  applyButton: "Refinar",
  resetButton: "Restablecer",
  loading: "Refinando",
  feedbackPrefix: "Reordenado",
  unparsableToast: "No se pudo entender — intenta ser más específico.",
  capExhaustedToast: "Se alcanzó la cuota diaria de IA. El grupo actual no cambia.",
  networkError: "Tiempo de espera agotado. Inténtalo de nuevo.",
  permutationInvalid: "El resultado del reordenamiento no es válido. El grupo actual no cambia.",
};

const noop = () => {};

function renderBar(labels = LABELS_EN, locale = "en") {
  return render(
    <RefineInputBar
      campaignId={CAMPAIGN}
      currentPoolIds={POOL}
      locale={locale}
      hasRefineState={false}
      lastFeedback={null}
      onRefineApplied={noop}
      onReset={noop}
      labels={labels}
    />,
  );
}

async function submit(query: string) {
  fireEvent.change(screen.getByTestId("campaign-refine-input"), {
    target: { value: query },
  });
  fireEvent.click(screen.getByTestId("campaign-refine-apply"));
}

beforeEach(() => {
  applyRefineMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RefineInputBar — F005 error paths", () => {
  it("unparsable response: renders LLM per-locale feedback in unparsable toast + preserves rawQuery", async () => {
    applyRefineMock.mockResolvedValueOnce({
      ok: true,
      data: {
        orderedKolIds: POOL,
        feedback: "Please be more specific about audience.",
        unparsable: true,
        capExhausted: false,
        errorKind: "unparsable",
      },
    });

    renderBar();
    await submit("vibe");

    await waitFor(() => {
      expect(
        screen.getByTestId("campaign-refine-toast-unparsable"),
      ).toHaveTextContent("Please be more specific about audience.");
    });
    expect(
      (screen.getByTestId("campaign-refine-input") as HTMLInputElement).value,
    ).toBe("vibe");
  });

  it("unparsable response with empty feedback: falls back to unparsableToast label string", async () => {
    applyRefineMock.mockResolvedValueOnce({
      ok: true,
      data: {
        orderedKolIds: POOL,
        feedback: "",
        unparsable: true,
        capExhausted: false,
        errorKind: "unparsable",
      },
    });

    renderBar();
    await submit("???");

    await waitFor(() => {
      expect(
        screen.getByTestId("campaign-refine-toast-unparsable"),
      ).toHaveTextContent(LABELS_EN.unparsableToast);
    });
    expect(
      (screen.getByTestId("campaign-refine-input") as HTMLInputElement).value,
    ).toBe("???");
  });

  it("permutation_invalid response: renders distinct permutation toast + preserves rawQuery", async () => {
    applyRefineMock.mockResolvedValueOnce({
      ok: true,
      data: {
        orderedKolIds: POOL,
        feedback: "",
        unparsable: true,
        capExhausted: false,
        errorKind: "permutation_invalid",
      },
    });

    renderBar();
    await submit("rerank me");

    await waitFor(() => {
      expect(
        screen.getByTestId("campaign-refine-toast-permutation"),
      ).toHaveTextContent(LABELS_EN.permutationInvalid);
    });
    // The plain unparsable toast must NOT also render.
    expect(
      screen.queryByTestId("campaign-refine-toast-unparsable"),
    ).not.toBeInTheDocument();
    expect(
      (screen.getByTestId("campaign-refine-input") as HTMLInputElement).value,
    ).toBe("rerank me");
  });

  it("capExhausted response: cap toast + rawQuery preserved", async () => {
    applyRefineMock.mockResolvedValueOnce({
      ok: true,
      data: {
        orderedKolIds: POOL,
        feedback: "",
        unparsable: false,
        capExhausted: true,
      },
    });

    renderBar();
    await submit("anything");

    await waitFor(() => {
      expect(
        screen.getByTestId("campaign-refine-toast-cap"),
      ).toHaveTextContent(LABELS_EN.capExhaustedToast);
    });
    expect(
      (screen.getByTestId("campaign-refine-input") as HTMLInputElement).value,
    ).toBe("anything");
  });

  it("server ok:false (network / 5xx surfaced as result.ok=false): network toast + rawQuery preserved", async () => {
    applyRefineMock.mockResolvedValueOnce({
      ok: false,
      error: "internal_error",
    });

    renderBar();
    await submit("retry me");

    await waitFor(() => {
      expect(
        screen.getByTestId("campaign-refine-toast-network"),
      ).toHaveTextContent(LABELS_EN.networkError);
    });
    expect(
      (screen.getByTestId("campaign-refine-input") as HTMLInputElement).value,
    ).toBe("retry me");
  });

  it("5s soft timeout: server hangs past the deadline, network toast renders as soft hint + rawQuery preserved", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // applyRefineAction never resolves — soft 5s timer fires the network
    // toast (BL-068 fix-round 1: not a hard timeout — the action stays
    // awaited so a late response would still override this toast).
    applyRefineMock.mockReturnValueOnce(new Promise(() => {}));

    renderBar();
    await submit("hangs");

    await vi.advanceTimersByTimeAsync(5_001);

    await waitFor(() => {
      expect(
        screen.getByTestId("campaign-refine-toast-network"),
      ).toHaveTextContent(LABELS_EN.networkError);
    });
    expect(
      (screen.getByTestId("campaign-refine-input") as HTMLInputElement).value,
    ).toBe("hangs");
  });

  it("BL-068 fix-round 1 (B1): server response that arrives AFTER the 5s soft timer OVERRIDES the network toast with the real result", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Resolve after 6s — past the 5s soft timer. Behavior contract:
    // 5s → soft network toast shows (transient hint)
    // 6s → real unparsable response arrives → unparsable toast REPLACES
    // network toast. The reverse — network toast lingering after the
    // server responded — was the staging blocker B1.
    let resolveAction!: (
      value: Awaited<ReturnType<typeof applyRefineMock>>,
    ) => void;
    applyRefineMock.mockReturnValueOnce(
      new Promise((res) => {
        resolveAction = res;
      }),
    );

    renderBar();
    await submit("slow");

    await vi.advanceTimersByTimeAsync(5_001);
    await waitFor(() => {
      expect(
        screen.getByTestId("campaign-refine-toast-network"),
      ).toBeInTheDocument();
    });

    // Server finally responds with an unparsable result.
    resolveAction({
      ok: true,
      data: {
        orderedKolIds: POOL,
        feedback: "Late but real: please be more specific",
        unparsable: true,
        capExhausted: false,
        errorKind: "unparsable",
      },
    });
    await vi.advanceTimersByTimeAsync(1_000);

    await waitFor(() => {
      expect(
        screen.getByTestId("campaign-refine-toast-unparsable"),
      ).toHaveTextContent("Late but real: please be more specific");
    });
    // The soft network toast must be replaced — not stacked.
    expect(
      screen.queryByTestId("campaign-refine-toast-network"),
    ).not.toBeInTheDocument();
    // rawQuery still preserved through the whole flow.
    expect(
      (screen.getByTestId("campaign-refine-input") as HTMLInputElement).value,
    ).toBe("slow");
  });

  it.each([
    ["zh", LABELS_ZH],
    ["ja", LABELS_JA],
    ["ko", LABELS_KO],
    ["es", LABELS_ES],
  ])(
    "5 locale: %s permutation toast renders the locale-specific permutationInvalid string",
    async (locale, labels) => {
      applyRefineMock.mockResolvedValueOnce({
        ok: true,
        data: {
          orderedKolIds: POOL,
          feedback: "",
          unparsable: true,
          capExhausted: false,
          errorKind: "permutation_invalid",
        },
      });

      renderBar(labels, locale);
      await submit("rerank");

      await waitFor(() => {
        expect(
          screen.getByTestId("campaign-refine-toast-permutation"),
        ).toHaveTextContent(labels.permutationInvalid);
      });
      // Sanity — the English string should NOT leak into a non-en locale.
      if (locale !== "en") {
        expect(
          screen.queryByText(LABELS_EN.permutationInvalid),
        ).not.toBeInTheDocument();
      }
    },
  );
});
