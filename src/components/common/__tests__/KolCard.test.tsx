import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { KolCard } from "../KolCard";

describe("KolCard", () => {
  it("renders name, follower count and up to 3 tags", () => {
    render(
      <KolCard
        name="GamerXia"
        followers="1.2M"
        aiScore={91}
        tags={["gaming", "fps", "speedrun", "extra"]}
      />
    );
    expect(screen.getByText("GamerXia")).toBeInTheDocument();
    expect(screen.getByText("1.2M")).toBeInTheDocument();
    expect(screen.getByText("gaming")).toBeInTheDocument();
    expect(screen.getByText("fps")).toBeInTheDocument();
    expect(screen.getByText("speedrun")).toBeInTheDocument();
    expect(screen.queryByText("extra")).toBeNull();
  });

  it("becomes a button and fires onClick when onClick is provided", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<KolCard name="X" followers="1k" aiScore={50} onClick={onClick} />);
    const btn = screen.getByRole("button", { name: /X/ });
    await user.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("row variant positions aiScore inline and drops the top-right overlay", () => {
    const { container } = render(<KolCard name="X" followers="1k" aiScore={42} variant="row" />);
    // in row variant there should be NO absolute-positioned top-right node
    expect(container.querySelector(".absolute.top-3.right-3")).toBeNull();
  });
});
