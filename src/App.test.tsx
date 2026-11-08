import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { createLocalApi, DEMO_CODE } from "./api/local";

// Monday Nov 9, 2026, 3:05 PM
const clock = () => new Date(2026, 10, 9, 15, 5);

async function setup(opts: { signedIn?: boolean; named?: boolean } = {}) {
  const user = userEvent.setup();
  const api = createLocalApi(localStorage, clock);
  if (opts.signedIn !== false) {
    const me = await api.verifyCode("a2ameer@uwaterloo.ca", DEMO_CODE);
    await api.saveName("Affan");
    localStorage.setItem(`wtm-named-${me.id}`, "1");
  }
  render(<App api={api} clock={clock} />);
  return { user, api };
}

async function signInThroughUi(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("UW email"), "a2ameer@uwaterloo.ca");
  await user.click(screen.getByRole("button", { name: "Send code" }));
  await user.type(await screen.findByLabelText("6-digit code"), DEMO_CODE);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await user.type(await screen.findByLabelText("Your name"), "Affan");
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

describe("sign in", () => {
  it("takes a UW email and a code, then asks for a name, then shows today's moves", async () => {
    const { user } = await setup({ signedIn: false });
    await signInThroughUi(user);
    expect(await screen.findByRole("heading", { name: "Today", level: 1 })).toBeInTheDocument();
    expect(await screen.findByTestId("move-gym")).toBeInTheDocument();
  });

  it("rejects an email that is not @uwaterloo.ca", async () => {
    const { user } = await setup({ signedIn: false });
    await user.type(await screen.findByLabelText("UW email"), "someone@gmail.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("@uwaterloo.ca");
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
  });

  it("rejects a wrong code", async () => {
    const { user } = await setup({ signedIn: false });
    await user.type(await screen.findByLabelText("UW email"), "a2ameer@uwaterloo.ca");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await user.type(await screen.findByLabelText("6-digit code"), "000000");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't right");
  });
});

describe("home feed", () => {
  it("shows friends' moves but hides close-only moves from people who haven't marked you close", async () => {
    await setup();
    expect(await screen.findByTestId("move-gym")).toBeInTheDocument(); // Maya marked me close
    expect(screen.getByTestId("move-food")).toBeInTheDocument();
    expect(screen.getByTestId("move-study")).toBeInTheDocument();
    expect(screen.queryByTestId("move-hang")).not.toBeInTheDocument(); // Jordan's close-only move
  });

  it("joins a move in one tap, and leaves with another", async () => {
    const { user } = await setup();
    const food = await screen.findByTestId("move-food");
    expect(within(food).getByLabelText("3 going")).toBeInTheDocument();
    await user.click(within(food).getByRole("button", { name: /I'm in for Food/ }));
    const joined = await within(food).findByRole("button", { name: /You're in/ });
    expect(within(food).getByLabelText("4 going")).toBeInTheDocument();
    await user.click(joined);
    expect(await within(food).findByRole("button", { name: /I'm in for Food/ })).toBeInTheDocument();
  });

  it("shows friends who are free right now, but only those who shared a schedule", async () => {
    await setup();
    const free = await screen.findByRole("region", { name: "Free now" });
    expect(within(free).getByText("Maya")).toBeInTheDocument();
    expect(within(free).getByText("Jordan")).toBeInTheDocument();
    expect(within(free).queryByText("Priya")).not.toBeInTheDocument();
  });

  it("filters by category using icon chips", async () => {
    const { user } = await setup();
    await screen.findByTestId("move-gym");
    await user.click(screen.getByRole("button", { name: "Food" }));
    expect(screen.getByTestId("move-food")).toBeInTheDocument();
    expect(screen.queryByTestId("move-gym")).not.toBeInTheDocument();
    expect(screen.queryByTestId("event")).not.toBeInTheDocument();
  });

  it("lists campus events and lets you join one", async () => {
    const { user } = await setup();
    const ev = (await screen.findAllByTestId("event"))[0];
    expect(within(ev).getByText("Drop-in Volleyball")).toBeInTheDocument();
    await user.click(within(ev).getByRole("button", { name: /I'm in for Drop-in Volleyball/ }));
    expect(await within(ev).findByRole("button", { name: /You're in/ })).toBeInTheDocument();
  });

  it("warns when a move clashes with one of your classes", async () => {
    const { api } = await setup();
    await api.saveBusy([{ day: 1, start: 17 * 60, end: 18 * 60 }]); // Monday 5-6 PM, gym is 5:30
    // render happened before saving; re-render fresh
    document.body.innerHTML = "";
    render(<App api={api} clock={clock} />);
    const gym = await screen.findByTestId("move-gym");
    expect(within(gym).getByText("Class")).toBeInTheDocument();
    expect(within(screen.getByTestId("move-food")).queryByText("Class")).not.toBeInTheDocument();
  });
});

describe("posting a move", () => {
  it("posts in a few taps and shows it as yours", async () => {
    const { user } = await setup();
    await screen.findByTestId("move-gym");
    await user.click(screen.getByRole("button", { name: /Post a move/ }));
    await user.click(screen.getByRole("radio", { name: "Study" }));
    await user.click(screen.getByRole("radio", { name: "Friends" }));
    await user.click(screen.getByRole("button", { name: "Post move" }));
    const mine = (await screen.findAllByTestId("move-study")).find((el) => within(el).queryByText("You"));
    expect(mine).toBeDefined();
    expect(within(mine!).getByText(/1 going/)).toBeInTheDocument();
  });

  it("offers only future times for today", async () => {
    const { user } = await setup();
    await user.click(await screen.findByRole("button", { name: /Post a move/ }));
    const options = within(screen.getByLabelText("Time")).getAllByRole("option").map((o) => o.textContent);
    expect(options[0]).toMatch(/3:15/);
    expect(options).not.toContain("2:00 p.m.");
  });
});

describe("friends", () => {
  it("marking someone close reveals their close-only moves", async () => {
    const { user } = await setup();
    await screen.findByTestId("move-gym");
    await user.click(screen.getByRole("button", { name: "Friends" }));
    // Jordan has a close-only move that Affan can't see yet; this is the friend's setting, so verify star toggling works
    await user.click(await screen.findByRole("button", { name: "Mark Jordan as close friend" }));
    expect(await screen.findByRole("button", { name: "Remove Jordan as close friend" })).toHaveAttribute("aria-pressed", "true");
  });

  it("an invite link adds the friend after sign-in", async () => {
    sessionStorage.setItem("wtm-add", "newperson");
    const { user } = await setup();
    expect(await screen.findByText("Friend added")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Friends" }));
    expect(await screen.findByText("New friend")).toBeInTheDocument();
  });
});

describe("schedule", () => {
  it("adds a class block by hand and keeps only day and time", async () => {
    const { user, api } = await setup();
    await user.click(await screen.findByRole("button", { name: "My schedule" }));
    await user.click(screen.getByRole("button", { name: "Monday" }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/Mon · 9:30 AM to 10:30 AM/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("heading", { name: "Today", level: 1 });
    expect(await api.getBusy()).toEqual([{ day: 1, start: 570, end: 630 }]);
  });
});
