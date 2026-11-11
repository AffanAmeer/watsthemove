import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Friends } from "./Friends";

const me = { id: "me-1", email: "me@uwaterloo.ca", name: "Affan", program: "MSE" };

function setup(requests: Array<{ id: string; name: string; program: string }> = []) {
  const props = {
    me, friends: [], requests, onBack: vi.fn(), onInvite: vi.fn(), onToggleClose: vi.fn(), onSignOut: vi.fn(),
    onSendRequest: vi.fn().mockResolvedValue(undefined), onRespond: vi.fn().mockResolvedValue(undefined),
  };
  render(<Friends {...props} />);
  return props;
}

describe("Friends", () => {
  it("sends a request to the email typed in", async () => {
    const props = setup();
    await userEvent.type(screen.getByLabelText("UW email"), "maya@uwaterloo.ca");
    await userEvent.click(screen.getByRole("button", { name: /send request/i }));
    expect(props.onSendRequest).toHaveBeenCalledWith("maya@uwaterloo.ca");
  });

  it("lets you accept or decline an incoming request", async () => {
    const props = setup([{ id: "maya-1", name: "Maya", program: "" }]);
    await userEvent.click(screen.getByRole("button", { name: "Accept Maya" }));
    expect(props.onRespond).toHaveBeenCalledWith({ id: "maya-1", name: "Maya", program: "" }, true);
    await userEvent.click(screen.getByRole("button", { name: "Decline Maya" }));
    expect(props.onRespond).toHaveBeenLastCalledWith({ id: "maya-1", name: "Maya", program: "" }, false);
  });
});
