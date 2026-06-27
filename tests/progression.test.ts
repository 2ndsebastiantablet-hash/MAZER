import { describe, expect, test } from "vitest";
import {
  collectOrb,
  createProgression,
  enterTower,
  placeOrbOnPedestal,
} from "../src/game/progression";

describe("objective progression", () => {
  test("advances from tower approach to tower climb", () => {
    const state = createProgression();

    const next = enterTower(state);

    expect(next.objective).toBe("Climb to the top of the tower.");
    expect(next.enteredTower).toBe(true);
    expect(next.hasOrb).toBe(false);
    expect(next.won).toBe(false);
  });

  test("collects the orb and switches the objective to returning home", () => {
    const state = enterTower(createProgression());

    const next = collectOrb(state);

    expect(next.objective).toBe("Return the orb to the pedestal at spawn.");
    expect(next.hasOrb).toBe(true);
    expect(next.orbPlaced).toBe(false);
    expect(next.won).toBe(false);
  });

  test("wins only when the carried orb is placed on the pedestal", () => {
    const withoutOrb = placeOrbOnPedestal(createProgression());
    const withOrb = placeOrbOnPedestal(collectOrb(enterTower(createProgression())));

    expect(withoutOrb.won).toBe(false);
    expect(withoutOrb.objective).toBe("Reach the tower at the center of the maze.");
    expect(withOrb.won).toBe(true);
    expect(withOrb.orbPlaced).toBe(true);
    expect(withOrb.hasOrb).toBe(false);
  });
});
