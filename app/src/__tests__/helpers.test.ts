import { relativeTime } from "../lib/time";
import { isEmail, passwordScore } from "../lib/validation";

describe("isEmail", () => {
  it("accepts ordinary addresses and rejects junk", () => {
    expect(isEmail("vale@example.com")).toBe(true);
    expect(isEmail(" vale@example.com ")).toBe(true);
    expect(isEmail("vale@example")).toBe(false);
    expect(isEmail("vale example.com")).toBe(false);
  });
});

describe("passwordScore", () => {
  it("scores length, mixed case, digits and symbols", () => {
    expect(passwordScore("short")).toBe(0);
    expect(passwordScore("abcdefgh")).toBe(1);
    expect(passwordScore("Abcdefgh")).toBe(2);
    expect(passwordScore("Abcdefg1")).toBe(3);
    expect(passwordScore("Abcdef1!")).toBe(4);
  });
});

describe("relativeTime", () => {
  const now = new Date(2026, 9, 1, 15, 0);
  const at = (d: Date) => relativeTime(d.toISOString(), now);
  it("formats recent edits like the design", () => {
    expect(at(new Date(2026, 9, 1, 14, 59, 40))).toBe("Just now");
    expect(at(new Date(2026, 9, 1, 13, 0))).toBe("2 hours ago");
    expect(at(new Date(2026, 8, 30, 20, 0))).toBe("Yesterday");
    expect(at(new Date(2026, 8, 28, 12, 0))).toBe("3 days ago");
    expect(at(new Date(2026, 8, 22, 12, 0))).toBe("Last week");
  });
});
