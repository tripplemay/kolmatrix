import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CampaignRow } from "../CampaignRow";

describe("CampaignRow", () => {
  it("renders name, subtitle, progress and status dot", () => {
    render(
      <CampaignRow name="Honor of Kings APAC" subtitle="Mobile" progress={42} status="active" />
    );
    expect(screen.getByText("Honor of Kings APAC")).toBeInTheDocument();
    expect(screen.getByText("Mobile")).toBeInTheDocument();
    expect(screen.getByText(/42%/)).toBeInTheDocument();
    expect(screen.getByLabelText("status active")).toBeInTheDocument();
  });

  it("clamps progress to 0–100 range", () => {
    render(<CampaignRow name="x" progress={150} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("fires onMoreClick when the More button is clicked", async () => {
    const user = userEvent.setup();
    const onMoreClick = vi.fn();
    render(<CampaignRow name="x" onMoreClick={onMoreClick} />);
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(onMoreClick).toHaveBeenCalledOnce();
  });

  it("shows metric cells when primary/secondary metrics provided", () => {
    render(
      <CampaignRow
        name="x"
        primaryMetric={{ label: "CTR", value: "4.2%" }}
        secondaryMetric={{ label: "CVR", value: "1.1%" }}
      />
    );
    expect(screen.getByText("CTR")).toBeInTheDocument();
    expect(screen.getByText("4.2%")).toBeInTheDocument();
    expect(screen.getByText("CVR")).toBeInTheDocument();
  });
});
