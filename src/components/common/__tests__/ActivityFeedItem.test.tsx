import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityFeedItem } from "../ActivityFeedItem";

describe("ActivityFeedItem", () => {
  it("renders text and time", () => {
    render(<ActivityFeedItem text="Sarah sent 20 emails" time="12m ago" />);
    expect(screen.getByText("Sarah sent 20 emails")).toBeInTheDocument();
    expect(screen.getByText("12m ago")).toBeInTheDocument();
  });

  it("renders timeline dot by default and hides it when showTimeline=false", () => {
    const { container, rerender } = render(<ActivityFeedItem text="x" time="t" />);
    // dot is the first aria-hidden span child
    expect(container.querySelector("[aria-hidden]")).not.toBeNull();

    rerender(<ActivityFeedItem text="x" time="t" showTimeline={false} />);
    expect(container.querySelector("span[aria-hidden]")).toBeNull();
  });

  it("shows the inline material icon when icon prop is set", () => {
    render(<ActivityFeedItem text="x" time="t" icon="check_circle" />);
    expect(screen.getByText("check_circle")).toBeInTheDocument();
  });
});
