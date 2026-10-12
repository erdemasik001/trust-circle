import { describe, expect, it } from "vitest";
import { displayBalance, displayUsdc, formatDate, formatDuration, shortAddress, tryParseUsdc } from "./format";

describe("displayUsdc", () => {
  it("shows at least two decimals and keeps up to six", () => {
    expect(displayUsdc(0n)).toBe("0.00");
    expect(displayUsdc(5_000_000n)).toBe("5.00");
    expect(displayUsdc(600_000n)).toBe("0.60");
    expect(displayUsdc(4_950_000n)).toBe("4.95");
    expect(displayUsdc(123_456n)).toBe("0.123456");
  });
});

describe("displayBalance", () => {
  it("rounds down to cents", () => {
    expect(displayBalance(49_996_716n)).toBe("49.99");
    expect(displayBalance(5_000_000n)).toBe("5.00");
    expect(displayBalance(9_999n)).toBe("0.00");
  });
});

describe("tryParseUsdc", () => {
  it("parses plain decimals to 6-decimal units", () => {
    expect(tryParseUsdc("5")).toBe(5_000_000n);
    expect(tryParseUsdc(" 1.5 ")).toBe(1_500_000n);
    expect(tryParseUsdc("0.000001")).toBe(1n);
    expect(tryParseUsdc("2.")).toBe(2_000_000n);
  });

  it("accepts a decimal comma", () => {
    expect(tryParseUsdc("1,5")).toBe(1_500_000n);
  });

  it("rejects anything else", () => {
    for (const bad of ["", "abc", "-1", "1e3", ".5", "1.2.3", "0.0000001", "1 000"]) {
      expect(tryParseUsdc(bad), bad).toBeNull();
    }
  });
});

describe("formatDuration", () => {
  it("picks a unit that fits", () => {
    expect(formatDuration(30)).toBe("less than a minute");
    expect(formatDuration(300)).toBe("5 min");
    expect(formatDuration(3 * 3600)).toBe("3 h");
    expect(formatDuration(47 * 3600 + 12 * 60)).toBe("47 h 12 min");
    expect(formatDuration(48 * 3600)).toBe("2 days");
    expect(formatDuration(30 * 24 * 3600)).toBe("30 days");
  });
});

describe("formatDate", () => {
  it("is locale independent", () => {
    expect(formatDate(Date.UTC(2026, 10, 11, 12) / 1000)).toBe("11 Nov 2026");
  });
});

describe("shortAddress", () => {
  it("keeps both ends", () => {
    expect(shortAddress("0x97174becF0fB0dF8Bb9d55cAF13cCb403d7F8490")).toBe("0x9717…8490");
  });
});
