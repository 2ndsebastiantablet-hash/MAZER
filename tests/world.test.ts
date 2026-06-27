import { describe, expect, test } from "vitest";
import { generateMaze, seededRandom } from "../src/game/maze";
import {
  CELL_SIZE,
  PLAYER_RADIUS,
  TOWER_DOOR_HEIGHT,
  TOWER_OUTER_RADIUS,
  TOWER_TOP_HEIGHT,
  TOWER_WINDOW_CEILING,
  TOWER_WINDOW_FLOOR,
  cellToWorld,
  createMazeCollision,
  createTowerWallPanels,
  findNearestWalkableFloor,
  isPointInsideTowerWallPanel,
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

  test("finds a nearby safe floor when exiting noclip inside a wall", () => {
    const maze = generateMaze({ size: 21, rng: seededRandom(8) });
    const wall = cellToWorld(maze, { x: 0, y: 0 });
    const safe = findNearestWalkableFloor(maze, wall.x, wall.z);
    const collision = createMazeCollision(maze);

    expect(safe).not.toBeNull();
    expect(collision.isWalkable(safe!.x, safe!.z, safe!.y)).toBe(true);
    expect(safe!.y).toBe(0);
  });

  test("matches tower collision to the visible door and top window openings", () => {
    const maze = generateMaze({ size: 21, rng: seededRandom(9) });
    const collision = createMazeCollision(maze);

    expect(collision.isWalkable(0, TOWER_OUTER_RADIUS, 0, PLAYER_RADIUS)).toBe(true);
    expect(collision.isWalkable(TOWER_OUTER_RADIUS, 0, 0, PLAYER_RADIUS)).toBe(false);
    expect(collision.isWalkable(TOWER_OUTER_RADIUS, 0, TOWER_TOP_HEIGHT, PLAYER_RADIUS)).toBe(true);
    expect(collision.isWalkable(0, -TOWER_OUTER_RADIUS, TOWER_TOP_HEIGHT, PLAYER_RADIUS)).toBe(false);
  });

  test("builds tower collision from visible wall panels with real doorway and window gaps", () => {
    const panels = createTowerWallPanels();

    expect(panels.length).toBeGreaterThan(0);
    expect(panels.some((panel) => isPointInsideTowerWallPanel(panel, 0, TOWER_OUTER_RADIUS, 1))).toBe(false);
    expect(panels.some((panel) => isPointInsideTowerWallPanel(panel, 0, TOWER_OUTER_RADIUS, TOWER_DOOR_HEIGHT + 1))).toBe(true);
    expect(panels.some((panel) => isPointInsideTowerWallPanel(panel, TOWER_OUTER_RADIUS, 0, 1))).toBe(true);
    expect(
      panels.some((panel) =>
        isPointInsideTowerWallPanel(panel, TOWER_OUTER_RADIUS, 0, (TOWER_WINDOW_FLOOR + TOWER_WINDOW_CEILING) / 2),
      ),
    ).toBe(false);
    expect(panels.some((panel) => isPointInsideTowerWallPanel(panel, 0, -TOWER_OUTER_RADIUS, TOWER_TOP_HEIGHT))).toBe(
      true,
    );
  });

  test("supports every stair step when climbing up or walking back down", () => {
    const maze = generateMaze({ size: 21, rng: seededRandom(10) });
    const collision = createMazeCollision(maze);
    const ascending = collision.stairs;
    const descending = [...collision.stairs].reverse();

    for (const step of [...ascending, ...descending]) {
      expect(collision.isWalkable(step.x, step.z, step.top, PLAYER_RADIUS)).toBe(true);
      const ground = collision.getGroundHeight(step.x, step.z, step.top + 0.35);

      expect(ground).toBeGreaterThanOrEqual(step.top - 0.001);
      expect(ground).toBeLessThanOrEqual(TOWER_TOP_HEIGHT);
    }
  });
});
