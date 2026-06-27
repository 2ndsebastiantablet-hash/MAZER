import { describe, expect, test } from "vitest";
import {
  cellKey,
  findPath,
  generateMaze,
  seededRandom,
} from "../src/game/maze";

describe("maze generation", () => {
  test("places spawn at the outer edge and tower at the exact center", () => {
    const maze = generateMaze({ size: 21, rng: seededRandom(1234) });

    expect(maze.size).toBe(21);
    expect(maze.towerCell).toEqual({ x: 10, y: 10 });
    expect(maze.spawnCell.y).toBe(maze.size - 1);
    expect(maze.spawnCell.x).toBeGreaterThan(0);
    expect(maze.spawnCell.x).toBeLessThan(maze.size - 1);
    expect(maze.openCells.has(cellKey(maze.spawnCell))).toBe(true);
    expect(maze.openCells.has(cellKey(maze.towerCell))).toBe(true);
  });

  test("always carves a path from spawn to the tower", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const maze = generateMaze({ size: 25, rng: seededRandom(seed) });
      const path = findPath(maze, maze.spawnCell, maze.towerCell);

      expect(path.length).toBeGreaterThan(0);
      expect(path[0]).toEqual(maze.spawnCell);
      expect(path.at(-1)).toEqual(maze.towerCell);
    }
  });

  test("changes layout when a different random seed is used", () => {
    const first = generateMaze({ size: 21, rng: seededRandom(10) });
    const second = generateMaze({ size: 21, rng: seededRandom(11) });

    expect([...first.openCells].sort()).not.toEqual([...second.openCells].sort());
  });
});
