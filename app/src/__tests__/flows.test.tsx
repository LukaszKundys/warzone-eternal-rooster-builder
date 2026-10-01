import { cleanup, render, screen, within } from "@testing-library/react";
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
    expect(screen.getByText("⚠ 5 DP over limit")).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Servants of Darkness" }));
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

describe("builder", () => {
  const card = (name: string) => screen.getByRole("heading", { name }).closest("article")!;

  it("builds a new list, checks it against the rules and saves it", async () => {
    renderApp();
    const user = await logIn();
    await screen.findByText("4 saved lists");
    await user.click(screen.getAllByRole("button", { name: "+ New list" })[0]);

    await user.type(await screen.findByLabelText("List name"), "Strike Team");
    await user.click(screen.getByRole("button", { name: "Add Blitzer // Leader" }));
    // A Leader alone isn't legal: it needs a Blitzer Trooper.
    expect(screen.getByText("Not legal yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Status/ }));
    expect(screen.getByText("Blitzer // Leader needs 1 × Trooper of type Blitzers, 0 available")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Catalogue/ }));
    await user.click(screen.getByRole("button", { name: "Add Blitzer" }));
    expect(screen.getAllByText("Legal").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("button", { name: "Saved" })).toBeDisabled();

    await user.click(screen.getByRole("link", { name: /My lists/ }));
    expect(await screen.findByText("5 saved lists")).toBeInTheDocument();
    expect(within(card("Strike Team")).getByText("9")).toBeInTheDocument();
    expect(within(card("Strike Team")).getByText("of 40 DP")).toBeInTheDocument();
    expect(within(card("Strike Team")).getByText("2 units")).toBeInTheDocument();
  });

  it("edits a saved list and keeps the changes", async () => {
    renderApp();
    const user = await logIn();
    await screen.findByText("4 saved lists");
    await user.click(within(card("Boardroom Coup")).getByRole("button", { name: "Edit" }));

    expect(await screen.findByLabelText("List name")).toHaveValue("Boardroom Coup");
    await user.click(screen.getByRole("button", { name: /^Force/ }));
    expect(screen.getByRole("article", { name: "Free Marine // RPG" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Free Marine // RPG" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("button", { name: "Saved" });

    await user.click(screen.getByRole("link", { name: /My lists/ }));
    await screen.findByText("4 saved lists");
    expect(within(card("Boardroom Coup")).getByText("22")).toBeInTheDocument();
    expect(within(card("Boardroom Coup")).getByText("5 units")).toBeInTheDocument();
  });

  it("attaches an asset to a unit that can carry it", async () => {
    renderApp();
    const user = await logIn();
    await screen.findByText("4 saved lists");
    await user.click(within(card("Iron Fist Vanguard")).getByRole("button", { name: "Edit" }));
    await screen.findByLabelText("List name");

    await user.click(screen.getByRole("tab", { name: /Assets/ }));
    await user.click(screen.getByRole("button", { name: "Add Command Helmet" }));
    const dialog = screen.getByRole("dialog", { name: "Command Helmet" });
    // Only the two Leaders have the Command ability.
    const choices = within(dialog).getAllByRole("button", { name: /Leader/ });
    expect(choices).toHaveLength(2);
    await user.click(choices[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Force/ }));
    expect(within(screen.getByRole("article", { name: "Blitzer // Leader" })).getByText("Command Helmet")).toBeInTheDocument();
  });

  it("asks before leaving with unsaved changes", async () => {
    renderApp();
    const user = await logIn();
    await screen.findByText("4 saved lists");
    await user.click(screen.getAllByRole("button", { name: "+ New list" })[0]);
    await user.click(await screen.findByRole("button", { name: "Add Blitzer" }));

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByRole("link", { name: /My lists/ }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText("List name")).toBeInTheDocument();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("link", { name: /My lists/ }));
    expect(await screen.findByText("4 saved lists")).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("shows a message for a list that doesn't exist", async () => {
    renderApp();
    await logIn();
    await screen.findByText("4 saved lists");
    // The session is stored, so a fresh app opened at the URL is still signed in.
    cleanup();
    renderApp("/lists/does-not-exist");
    expect(await screen.findByRole("heading", { name: "List not found" })).toBeInTheDocument();
  });
});

describe("password reset", () => {
  it("explains a dead link and offers a new one", async () => {
    renderApp("/reset-password");
    expect(await screen.findByText("This reset link is invalid or has expired. Request a new one.")).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Request a new link" }));
    expect(await screen.findByRole("heading", { name: "Reset password" })).toBeInTheDocument();
  });

  it("sets a new password from a valid link", async () => {
    renderApp();
    let user = await logIn();
    await screen.findByText("4 saved lists");
    // A valid emailed link arrives with the player signed in.
    cleanup();
    renderApp("/reset-password");
    user = userEvent.setup();
    await user.type(await screen.findByLabelText("New password"), "Newpass123!");
    await user.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByText("4 saved lists")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Commander Vale/ }));
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));
    await logIn(DEMO_PASSWORD);
    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Password", { selector: "input" }));
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "Newpass123!");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("4 saved lists")).toBeInTheDocument();
  });
});

describe("account settings", () => {
  const section = (name: string) => screen.getByRole("form", { name });
  const openSettings = async () => {
    renderApp();
    const user = await logIn();
    await screen.findByText("4 saved lists");
    await user.click(screen.getByRole("button", { name: /Commander Vale/ }));
    await user.click(screen.getByRole("menuitem", { name: "Account settings" }));
    await screen.findByRole("heading", { name: "Display name" });
    return user;
  };
  const logOutAndBackIn = async (user: ReturnType<typeof userEvent.setup>, email: string, password: string) => {
    await user.click(screen.getByRole("link", { name: /My lists/ }));
    await user.click(await screen.findByRole("button", { name: /Commander|Vale/ }));
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));
    await user.type(await screen.findByLabelText("Email"), email);
    await user.type(screen.getByLabelText("Password", { selector: "input" }), password);
    await user.click(screen.getByRole("button", { name: "Log in" }));
  };

  it("changes the display name", async () => {
    const user = await openSettings();
    const name = within(section("Display name")).getByLabelText("Display name");
    await user.clear(name);
    await user.type(name, "General Vale");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByText("Display name saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save name" })).toBeDisabled();
    await user.click(screen.getByRole("link", { name: /My lists/ }));
    expect(await screen.findByRole("button", { name: /General Vale/ })).toBeInTheDocument();
  });

  it("changes the email and logs in with the new one", async () => {
    const user = await openSettings();
    const email = within(section("Email")).getByLabelText("New email");
    await user.type(email, DEMO_EMAIL);
    await user.click(screen.getByRole("button", { name: "Change email" }));
    expect(screen.getByText("That's already your email address.")).toBeInTheDocument();
    await user.clear(email);
    await user.type(email, "vale@example.com");
    await user.click(screen.getByRole("button", { name: "Change email" }));
    expect(await screen.findByText("Currently vale@example.com. You log in with this address.")).toBeInTheDocument();

    await logOutAndBackIn(user, "vale@example.com", DEMO_PASSWORD);
    expect(await screen.findByText("4 saved lists")).toBeInTheDocument();
  });

  it("changes the password only with the current one", async () => {
    const user = await openSettings();
    const pw = within(section("Password"));
    await user.type(pw.getByLabelText("Current password", { selector: "input" }), "not-it");
    await user.type(pw.getByLabelText("New password", { selector: "input" }), "Newpass123!");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await pw.findByText("That password is incorrect.")).toBeInTheDocument();

    await user.clear(pw.getByLabelText("Current password", { selector: "input" }));
    await user.type(pw.getByLabelText("Current password", { selector: "input" }), DEMO_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Password updated")).toBeInTheDocument();

    await logOutAndBackIn(user, DEMO_EMAIL, "Newpass123!");
    expect(await screen.findByText("4 saved lists")).toBeInTheDocument();
  });

  it("deletes the account and its lists after confirming", async () => {
    const user = await openSettings();
    const del = within(section("Delete account"));
    await user.type(del.getByLabelText("Password", { selector: "input" }), "not-it");
    await user.click(del.getByRole("button", { name: "Delete account" }));
    await user.click(await del.findByRole("button", { name: "Delete" }));
    expect(await del.findByText("That password is incorrect.")).toBeInTheDocument();

    await user.clear(del.getByLabelText("Password", { selector: "input" }));
    await user.type(del.getByLabelText("Password", { selector: "input" }), DEMO_PASSWORD);
    await user.click(del.getByRole("button", { name: "Delete account" }));
    expect(del.getByText("Delete your account and all your lists permanently?")).toBeInTheDocument();
    await user.click(del.getByRole("button", { name: "Cancel" }));
    await user.click(del.getByRole("button", { name: "Delete account" }));
    await user.click(del.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();

    await logIn();
    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument();
  });
});

describe("pdf export", () => {
  it("prints a force sheet and removes it afterwards", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderApp();
    const user = await logIn();
    await screen.findByText("4 saved lists");
    const card = screen.getByRole("heading", { name: "Iron Fist Vanguard" }).closest("article")!;
    await user.click(within(card).getByRole("button", { name: "Edit" }));
    await user.click(await screen.findByRole("button", { name: /^Status/ }));
    await user.click(screen.getByRole("button", { name: /Printable force sheet/ }));

    await vi.waitFor(() => expect(print).toHaveBeenCalled());
    const sheet = document.querySelector(".print-sheet") as HTMLElement;
    expect(within(sheet).getByRole("heading", { name: "Iron Fist Vanguard" })).toBeInTheDocument();
    expect(within(sheet).getByText("Bauhaus · Agents of Light · 40 DP (Standard)")).toBeInTheDocument();
    // Identical units are grouped.
    expect(within(sheet).getByRole("heading", { name: "3 × Blitzer" })).toBeInTheDocument();
    expect(within(sheet).getByText("Fire Support")).toBeInTheDocument();
    expect(within(sheet).getByText("Legal")).toBeInTheDocument();

    window.dispatchEvent(new Event("afterprint"));
    await vi.waitFor(() => expect(document.querySelector(".print-sheet")).toBeNull());
    print.mockRestore();
  });
});

describe("sharing", () => {
  const card = (name: string) => screen.getByRole("heading", { name }).closest("article")!;
  /** Share Iron Fist Vanguard from the builder and return its link path. */
  const shareIronFist = async () => {
    renderApp();
    const user = await logIn();
    await screen.findByText("4 saved lists");
    await user.click(within(card("Iron Fist Vanguard")).getByRole("button", { name: "Edit" }));
    await user.click(await screen.findByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: "Create link" }));
    const url = (await screen.findByLabelText("Share link")) as HTMLInputElement;
    expect(screen.getByRole("button", { name: "Shared" })).toBeInTheDocument();
    return { user, path: new URL(url.value).pathname };
  };

  it("needs a saved list before it can be shared", async () => {
    renderApp();
    const user = await logIn();
    await screen.findByText("4 saved lists");
    await user.click(screen.getAllByRole("button", { name: "+ New list" })[0]);
    expect(await screen.findByRole("button", { name: "Share" })).toBeDisabled();
  });

  it("shows a shared list read-only to a signed-out viewer, who logs in to copy it", async () => {
    const { user, path } = await shareIronFist();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("link", { name: /My lists/ }));
    expect(within(card("Iron Fist Vanguard")).getByText("Shared")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Commander Vale/ }));
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));
    await screen.findByRole("heading", { name: "Log in" });

    cleanup();
    renderApp(path);
    expect(await screen.findByRole("heading", { name: "Iron Fist Vanguard" })).toBeInTheDocument();
    expect(screen.getByText(/by Commander Vale/)).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Blitzer // Leader" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duplicate" })).not.toBeInTheDocument();

    // Copying needs an account; logging in comes back here.
    const viewer = userEvent.setup();
    await viewer.click(screen.getByRole("button", { name: "Log in to copy" }));
    await logIn();
    await viewer.click(await screen.findByRole("button", { name: "Copy to my lists" }));
    expect(await screen.findByLabelText("List name")).toHaveValue("Iron Fist Vanguard (copy)");
    await viewer.click(screen.getByRole("link", { name: /My lists/ }));
    expect(await screen.findByText("5 saved lists")).toBeInTheDocument();
    // The copy is the viewer's own list and isn't shared.
    expect(within(card("Iron Fist Vanguard (copy)")).queryByText("Shared")).not.toBeInTheDocument();
  });

  it("breaks the link when sharing stops", async () => {
    const { user, path } = await shareIronFist();
    await user.click(screen.getByRole("button", { name: "Stop sharing" }));
    expect(await screen.findByRole("button", { name: "Create link" })).toBeInTheDocument();

    cleanup();
    renderApp(path);
    expect(await screen.findByRole("heading", { name: "List not found" })).toBeInTheDocument();
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
