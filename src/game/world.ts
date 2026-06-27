import type { Maze, MazeCell } from "./maze";
import { isOpenCell } from "./maze";

export const CELL_SIZE = 6;
export const WALL_HEIGHT = 4.8;
export const PLAYER_RADIUS = 0.55;
export const PLAYER_STAND_HEIGHT = 1.75;
export const PLAYER_CROUCH_HEIGHT = 1.05;
export const TOWER_OUTER_RADIUS = 8.4;
export const TOWER_INNER_RADIUS = 6.35;
export const TOWER_TOP_HEIGHT = 23;
export const TOWER_TOTAL_HEIGHT = 29;
export const STAIR_RADIUS = 5.05;

export type WorldPoint = {
  x: number;
  z: number;
};

export type StairStep = {
  angle: number;
  top: number;
  x: number;
  z: number;
  yaw: number;
  width: number;
  depth: number;
  thickness: number;
};

export type MazeCollision = {
  isWalkable: (x: number, z: number, currentY?: number, radius?: number) => boolean;
  getGroundHeight: (x: number, z: number, currentY: number) => number;
  stairs: StairStep[];
};

const STAIR_COUNT = 86;
const STAIR_TURNS = 1.7;
const STAIR_STEP_THICKNESS = 0.32;
const DOOR_HALF_WIDTH = 1.75;

export function cellToWorld(maze: Maze, cell: MazeCell): WorldPoint {
  const center = Math.floor(maze.size / 2);

  return {
    x: (cell.x - center) * CELL_SIZE,
    z: (cell.y - center) * CELL_SIZE,
  };
}

export function worldToCell(maze: Maze, x: number, z: number): MazeCell {
  const center = Math.floor(maze.size / 2);

  return {
    x: Math.round(x / CELL_SIZE + center),
    y: Math.round(z / CELL_SIZE + center),
  };
}

export function createMazeCollision(maze: Maze): MazeCollision {
  const stairs = createSpiralStairs();

  return {
    stairs,
    isWalkable(x, z, currentY = 0, radius = 0) {
      const samples = [
        { x, z },
        { x: x + radius, z },
        { x: x - radius, z },
        { x, z: z + radius },
        { x, z: z - radius },
      ];

      return samples.every((sample) => isWalkablePoint(maze, sample.x, sample.z, currentY));
    },
    getGroundHeight(x, z, currentY) {
      if (isOnTowerTop(x, z, currentY)) {
        return TOWER_TOP_HEIGHT;
      }

      let groundHeight = 0;
      for (const step of stairs) {
        if (isPointOnStep(x, z, step) && step.top <= currentY + 0.82) {
          groundHeight = Math.max(groundHeight, step.top);
        }
      }

      return groundHeight;
    },
  };
}

export function createSpiralStairs(): StairStep[] {
  const stairs: StairStep[] = [];
  const startAngle = Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2 * STAIR_TURNS;

  for (let index = 0; index < STAIR_COUNT; index += 1) {
    const progress = index / (STAIR_COUNT - 1);
    const angle = startAngle + (endAngle - startAngle) * progress;
    const top = TOWER_TOP_HEIGHT * progress;

    stairs.push({
      angle,
      top,
      x: Math.cos(angle) * STAIR_RADIUS,
      z: Math.sin(angle) * STAIR_RADIUS,
      yaw: angle + Math.PI / 2,
      width: 2.45,
      depth: 3.15,
      thickness: STAIR_STEP_THICKNESS,
    });
  }

  return stairs;
}

export function isInsideTowerInterior(x: number, z: number): boolean {
  return Math.hypot(x, z) < TOWER_INNER_RADIUS - PLAYER_RADIUS;
}

export function isNearTowerDoor(x: number, z: number): boolean {
  const distance = Math.hypot(x, z);
  return Math.abs(x) < DOOR_HALF_WIDTH && z > 0 && distance < TOWER_OUTER_RADIUS + 0.65;
}

export function isOnTowerTop(x: number, z: number, currentY: number): boolean {
  return Math.hypot(x, z) < TOWER_INNER_RADIUS - 0.6 && currentY > TOWER_TOP_HEIGHT - 1.4;
}

export function isPointOnStep(x: number, z: number, step: StairStep): boolean {
  const dx = x - step.x;
  const dz = z - step.z;
  const cos = Math.cos(step.yaw);
  const sin = Math.sin(step.yaw);
  const localX = cos * dx + sin * dz;
  const localZ = -sin * dx + cos * dz;

  return Math.abs(localX) <= step.width / 2 && Math.abs(localZ) <= step.depth / 2;
}

function isWalkablePoint(maze: Maze, x: number, z: number, currentY: number): boolean {
  const distanceFromTower = Math.hypot(x, z);
  if (distanceFromTower < TOWER_OUTER_RADIUS + PLAYER_RADIUS) {
    if (isNearTowerDoor(x, z) || distanceFromTower < TOWER_INNER_RADIUS - PLAYER_RADIUS) {
      return true;
    }

    return currentY > TOWER_TOTAL_HEIGHT - 1.5;
  }

  const cell = worldToCell(maze, x, z);
  return isOpenCell(maze, cell);
}
