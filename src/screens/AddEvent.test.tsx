import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddEvent } from "./AddEvent";

describe("AddEvent", () => {
  it("saves an event with the start time as an ISO string", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AddEvent onBack={() => {}} onSave={onSave} />);

    await userEvent.type(screen.getByLabelText("Title"), "  Trivia night  ");
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-11-14" } });
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "18:00" } });
    await userEvent.type(screen.getByLabelText("Place"), "Uptown Waterloo");
    await userEvent.click(screen.getByRole("button", { name: /add event/i }));

    expect(onSave).toHaveBeenCalledWith({
      title: "Trivia night",
      startsAt: new Date("2026-11-14T18:00").toISOString(),
      place: "Uptown Waterloo",
      url: null,
    });
  });

  it("asks for the required fields instead of saving", async () => {
    const onSave = vi.fn();
    render(<AddEvent onBack={() => {}} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /add event/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/fill in/i);
  });
});
