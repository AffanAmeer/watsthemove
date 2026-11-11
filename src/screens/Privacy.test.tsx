import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Privacy } from "./Privacy";

afterEach(() => vi.restoreAllMocks());

describe("Privacy", () => {
  it("does not delete when the person cancels the confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<Privacy onBack={() => {}} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deletes after the person confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<Privacy onBack={() => {}} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
