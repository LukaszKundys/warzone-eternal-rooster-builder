import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { ToastProvider } from "../components/Toast";
import { AuthProvider } from "../lib/auth";
import { createLocalBackend, DEMO_EMAIL, DEMO_PASSWORD } from "../lib/backend/local";

function renderApp(path = "/login") {
  const backend = createLocalBackend();
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider backend={backend}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return backend;
}

async function logIn(password = DEMO_PASSWORD) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Email"), DEMO_EMAIL);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
  return user;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("log in", () => {
  it("validates empty fields inline", async () => {
    renderApp();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Log in" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
  });

  it("shows a form error for a wrong password", async () => {
    renderApp();
    await logIn("wrong-password");
    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument();
  });

  it("opens My Lists with the demo lists", async () => {
    renderApp();
    await logIn();
    expect(await screen.findByRole("heading", { name: "My lists" })).toBeInTheDocument();
    expect(await screen.findByText("4 saved lists")).toBeInTheDocument();
    expect(screen.getByText("⚠ 12 points over limit")).toBeInTheDocument();
  });
});

describe("sign up", () => {
  it("requires every field and the terms", async () => {
    renderApp("/signup");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Create account" }));
    expect(screen.getByText("Display name must be at least 2 characters.")).toBeInTheDocument();
    expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument();
    expect(screen.getByText("You must accept to continue.")).toBeInTheDocument();
  });

  it("creates an account and lands on an empty My Lists", async () => {
    renderApp("/signup");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Display name"), "Max Steiner");
    await user.type(screen.getByLabelText("Email"), "max@example.com");
    await user.type(screen.getByLabelText("Password"), "Abcdef1!");
    expect(screen.getByText("Strong")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("No lists yet")).toBeInTheDocument();
    expect(screen.getByText("Max Steiner")).toBeInTheDocument();
  });

  it("rejects an email that already has an account", async () => {
    renderApp("/signup");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Display name"), "Someone");
    await user.type(screen.getByLabelText("Email"), DEMO_EMAIL);
    await user.type(screen.getByLabelText("Password"), "Abcdef1!");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
  });
});

describe("my lists", () => {
  it("duplicates, confirms before deleting, filters and logs out", async () => {
    renderApp();
    const user = await logIn();
    await screen.findByText("4 saved lists");

    const card = (name: string) => screen.getByRole("heading", { name }).closest("article")!;

    await user.click(within(card("Boardroom Coup")).getByRole("button", { name: "Duplicate" }));
    expect(await screen.findByRole("heading", { name: "Boardroom Coup (copy)" })).toBeInTheDocument();
    expect(screen.getByText("5 saved lists")).toBeInTheDocument();

    await user.click(within(card("Test roster")).getByRole("button", { name: "Delete Test roster" }));
    expect(screen.getByText("Delete this list permanently?")).toBeInTheDocument();
    await user.click(within(card("Test roster")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Delete this list permanently?")).not.toBeInTheDocument();
    await user.click(within(card("Test roster")).getByRole("button", { name: "Delete Test roster" }));
    await user.click(within(card("Test roster")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("4 saved lists")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Test roster" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Over limit" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Rebel" }));
    expect(screen.getByText("No lists match your search.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All" }));
    await user.type(screen.getByLabelText("Search lists"), "capitol");
    expect(screen.getAllByRole("article")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /Commander Vale/ }));
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("keeps changes after logging out and back in", async () => {
    renderApp();
    let user = await logIn();
    await screen.findByText("4 saved lists");
    await user.click(screen.getByRole("button", { name: "Delete Test roster" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByText("3 saved lists");
    await user.click(screen.getByRole("button", { name: /Commander Vale/ }));
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));
    user = await logIn();
    expect(await screen.findByText("3 saved lists")).toBeInTheDocument();
  });
});

describe("guards", () => {
  it("sends signed-out players from /lists to log in", async () => {
    renderApp("/lists");
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });
});

describe("google sign-in", () => {
  it.each(["/login", "/signup"])("is shown but disabled on %s", async (path) => {
    renderApp(path);
    expect(await screen.findByRole("button", { name: /continue with google/i })).toBeDisabled();
  });
});
