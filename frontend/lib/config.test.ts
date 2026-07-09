import { describe, expect, it } from "vitest";
import { stroopsToXlm, xlmToStroops, shortAddr, STROOPS_PER_XLM } from "./config";

describe("stroopsToXlm", () => {
  it("converts whole XLM amounts", () => {
    expect(stroopsToXlm(10_000_000n)).toBe("1");
    expect(stroopsToXlm(5_000_000_000n)).toBe("500");
  });

  it("keeps fractional stroops, trimming trailing zeros", () => {
    expect(stroopsToXlm(15_000_000n)).toBe("1.5");
    expect(stroopsToXlm(1n)).toBe("0.0000001");
    expect(stroopsToXlm(12_345_678n)).toBe("1.2345678");
  });

  it("handles zero", () => {
    expect(stroopsToXlm(0n)).toBe("0");
  });
});

describe("xlmToStroops", () => {
  it("converts whole and fractional XLM", () => {
    expect(xlmToStroops("1")).toBe(10_000_000n);
    expect(xlmToStroops("1.5")).toBe(15_000_000n);
    expect(xlmToStroops("0.0000001")).toBe(1n);
  });

  it("truncates beyond 7 decimal places", () => {
    expect(xlmToStroops("1.00000019")).toBe(10_000_001n);
  });

  it("round-trips with stroopsToXlm", () => {
    for (const s of [1n, 999n, 10_000_000n, 123_456_789n]) {
      expect(xlmToStroops(stroopsToXlm(s))).toBe(s);
    }
  });

  it("matches the milestone amounts used on testnet", () => {
    expect(xlmToStroops("100")).toBe(100n * STROOPS_PER_XLM);
    expect(xlmToStroops("100")).toBe(1_000_000_000n);
  });
});

describe("shortAddr", () => {
  it("truncates long Stellar addresses", () => {
    const addr = "GBME4BGEBVYEQCPN2LZU6DMAFVEGJNHHXL5EDJGA63YGDXIASV4NNRLN";
    expect(shortAddr(addr)).toBe("GBME4B…4NNRLN");
  });

  it("leaves short strings untouched", () => {
    expect(shortAddr("GABC")).toBe("GABC");
  });
});
