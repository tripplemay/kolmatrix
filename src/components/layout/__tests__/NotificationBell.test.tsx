import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NotificationBell } from "../NotificationBell";

describe("NotificationBell", () => {
  it("shows plain label when unread is 0 or unset", () => {
    render(<NotificationBell />);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("announces unread count when > 0", () => {
    render(<NotificationBell unread={7} />);
    expect(screen.getByRole("button", { name: "Notifications (7 unread)" })).toBeInTheDocument();
  });
});
