import { describe, expect, it } from "vitest";
import { isValidTransition } from "./index";

describe("ORDER_TRANSITIONS", () => {
  it("allows direct paper-trading entry submit", () => {
    expect(isValidTransition("idle", "submitted")).toBe(true);
  });

  it("allows the full keeper execution path", () => {
    expect(isValidTransition("submitted", "keeper_step_1")).toBe(true);
    expect(isValidTransition("keeper_step_1", "keeper_step_2")).toBe(true);
    expect(isValidTransition("keeper_step_2", "keeper_step_3")).toBe(true);
    expect(isValidTransition("keeper_step_3", "keeper_step_4")).toBe(true);
    expect(isValidTransition("keeper_step_4", "filled")).toBe(true);
    expect(isValidTransition("filled", "idle")).toBe(true);
  });
});
