import { describe, expect, test } from "vitest";
import {
  cellKey,
  findPath,
  generateMaze,
  getOpenNeighbors,
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

  test("default maze is expansive with intersections, dead ends, and loops", () => {
    const maze = generateMaze({ rng: seededRandom(2026) });
    const stats = measureMaze(maze);
    const path = findPath(maze, maze.spawnCell, maze.towerCell);

    expect(maze.size).toBeGreaterThanOrEqual(41);
    expect(path.length).toBeGreaterThanOrEqual(maze.size);
    expect(stats.intersections).toBeGreaterThanOrEqual(80);
    expect(stats.deadEnds).toBeGreaterThanOrEqual(70);
    expect(stats.loopEdges).toBeGreaterThanOrEqual(35);
  });

  test("large mazes remain solvable and branch-rich across seeds", () => {
    for (let seed = 30; seed < 40; seed += 1) {
      const maze = generateMaze({ size: 45, rng: seededRandom(seed) });
      const path = findPath(maze, maze.spawnCell, maze.towerCell);
      const stats = measureMaze(maze);

      expect(path.length).toBeGreaterThanOrEqual(Math.floor(maze.size * 0.7));
      expect(stats.intersections).toBeGreaterThanOrEqual(75);
      expect(stats.deadEnds).toBeGreaterThanOrEqual(65);
      expect(stats.loopEdges).toBeGreaterThanOrEqual(30);
    }
  });
});

function measureMaze(maze: ReturnType<typeof generateMaze>) {
  let deadEnds = 0;
  let intersections = 0;
  let edgeCount = 0;

  for (const key of maze.openCells) {
    const [x, y] = key.split(",").map(Number);
    const degree = getOpenNeighbors(maze, { x, y }).length;
    edgeCount += degree;

    if (degree === 1) {
      deadEnds += 1;
    }

    if (degree >= 3) {
      intersections += 1;
    }
  }

  return {
    deadEnds,
    intersections,
    loopEdges: edgeCount / 2 - maze.openCells.size + 1,
  };
}
