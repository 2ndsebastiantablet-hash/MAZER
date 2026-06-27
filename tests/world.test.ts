import { describe, expect, test } from "vitest";
import { generateMaze, seededRandom } from "../src/game/maze";
import {
  CELL_SIZE,
  cellToWorld,
  createMazeCollision,
  worldToCell,
} from "../src/game/world";

describe("world grid mapping", () => {
  test("places the tower cell at the world origin", () => {
    const maze = generateMaze({ size: 21, rng: seededRandom(5) });

    const tower = cellToWorld(maze, maze.towerCell);

    expect(tower.x).toBe(0);
    expect(tower.z).toBe(0);
  });

  test("round-trips maze cells through world positions", () => {
    const maze = generateMaze({ size: 21, rng: seededRandom(6) });

    const world = cellToWorld(maze, maze.spawnCell);
    const cell = worldToCell(maze, world.x + CELL_SIZE * 0.1, world.z - CELL_SIZE * 0.1);

    expect(cell).toEqual(maze.spawnCell);
  });

  test("blocks walls but allows carved maze cells", () => {
    const maze = generateMaze({ size: 21, rng: seededRandom(7) });
    const collision = createMazeCollision(maze);
    const open = cellToWorld(maze, maze.spawnCell);
    const wallCell = { x: 0, y: 0 };
    const wall = cellToWorld(maze, wallCell);

    expect(collision.isWalkable(open.x, open.z, 0)).toBe(true);
    expect(collision.isWalkable(wall.x, wall.z, 0)).toBe(false);
  });
});
