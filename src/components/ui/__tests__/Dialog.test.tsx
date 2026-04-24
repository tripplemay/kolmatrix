import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
} from "../Dialog";

describe("Dialog", () => {
  it("renders the panel content when open=true", () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Add KOL</DialogTitle>
            </DialogHeader>
            <p>Pick a creator.</p>
            <DialogFooter>
              <button type="button">Close</button>
            </DialogFooter>
          </DialogPanel>
        </DialogPortal>
      </Dialog>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Add KOL")).toBeInTheDocument();
    expect(screen.getByText("Pick a creator.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close/ })).toBeInTheDocument();
  });

  it("hides content when open=false", () => {
    render(
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogPortal>
          <DialogPanel>
            <p>Hidden panel</p>
          </DialogPanel>
        </DialogPortal>
      </Dialog>
    );
    expect(screen.queryByText("Hidden panel")).not.toBeInTheDocument();
  });
});
