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
export const TOWER_WALL_SIDES = 12;
export const TOWER_WALL_THICKNESS = 0.82;
export const TOWER_DOOR_HALF_WIDTH = 1.45;
export const TOWER_DOOR_HEIGHT = 4.6;
export const TOWER_DOOR_CENTER_ANGLE = Math.PI / 2;
export const TOWER_DOOR_HALF_ANGLE = 0.19;
export const TOWER_WINDOW_CENTER_ANGLE = 0;
export const TOWER_WINDOW_HALF_WIDTH = 1.75;
export const TOWER_WINDOW_HALF_ANGLE = 0.25;
export const TOWER_WINDOW_FLOOR = TOWER_TOP_HEIGHT - 0.35;
export const TOWER_WINDOW_CEILING = TOWER_TOP_HEIGHT + 4.45;

export type WorldPoint = {
  x: number;
  z: number;
};

export type SafeFloorPoint = WorldPoint & {
  y: number;
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

export type TowerWallPanel = {
  id: string;
  angle: number;
  x: number;
  z: number;
  y: number;
  yaw: number;
  width: number;
  height: number;
  depth: number;
  minY: number;
  maxY: number;
};

export type MazeCollision = {
  isWalkable: (x: number, z: number, currentY?: number, radius?: number) => boolean;
  getGroundHeight: (x: number, z: number, currentY: number) => number;
  stairs: StairStep[];
  towerWallPanels: TowerWallPanel[];
};

const STAIR_COUNT = 86;
const STAIR_TURNS = 1.7;
const STAIR_STEP_THICKNESS = 0.32;

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

export function findNearestWalkableFloor(maze: Maze, x: number, z: number): SafeFloorPoint | null {
  const start = worldToCell(maze, x, z);
  const visited = new Set<string>();
  const queue: MazeCell[] = [start];

  while (queue.length > 0) {
    const cell = queue.shift();
    if (!cell) {
      break;
    }

    const key = `${cell.x},${cell.y}`;
    if (visited.has(key)) {
      continue;
    }

    visited.add(key);

    if (cell.x >= 0 && cell.y >= 0 && cell.x < maze.size && cell.y < maze.size) {
      if (isOpenCell(maze, cell)) {
        const world = cellToWorld(maze, cell);
        return { x: world.x, y: 0, z: world.z };
      }
    }

    queue.push(
      { x: cell.x + 1, y: cell.y },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x, y: cell.y - 1 },
    );
  }

  return null;
}

export function createMazeCollision(maze: Maze): MazeCollision {
  const stairs = createSpiralStairs();
  const towerWallPanels = createTowerWallPanels();

  return {
    stairs,
    towerWallPanels,
    isWalkable(x, z, currentY = 0, radius = 0) {
      const samples = [
        { x, z },
        { x: x + radius, z },
        { x: x - radius, z },
        { x, z: z + radius },
        { x, z: z - radius },
      ];

      return samples.every((sample) => isWalkablePoint(maze, towerWallPanels, sample.x, sample.z, currentY));
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

export function createTowerWallPanels(): TowerWallPanel[] {
  const panels: TowerWallPanel[] = [];
  const apothem = TOWER_OUTER_RADIUS - TOWER_WALL_THICKNESS / 2;
  const sideWidth = 2 * apothem * Math.tan(Math.PI / TOWER_WALL_SIDES) + 0.08;
  const doorWidth = TOWER_DOOR_HALF_WIDTH * 2;
  const doorPostWidth = Math.max(0.45, (sideWidth - doorWidth) / 2);
  const windowWidth = TOWER_WINDOW_HALF_WIDTH * 2;
  const windowPostWidth = Math.max(0.45, (sideWidth - windowWidth) / 2);

  for (let index = 0; index < TOWER_WALL_SIDES; index += 1) {
    const angle = (index / TOWER_WALL_SIDES) * Math.PI * 2;

    if (isAngleWithin(angle, TOWER_DOOR_CENTER_ANGLE, 0.001)) {
      addTowerPanel(panels, angle, 0, TOWER_DOOR_HEIGHT, doorPostWidth, -(doorWidth / 2 + doorPostWidth / 2), "door-left");
      addTowerPanel(panels, angle, 0, TOWER_DOOR_HEIGHT, doorPostWidth, doorWidth / 2 + doorPostWidth / 2, "door-right");
      addTowerPanel(panels, angle, TOWER_DOOR_HEIGHT, TOWER_TOTAL_HEIGHT, sideWidth, 0, "door-lintel-wall");
      continue;
    }

    if (isAngleWithin(angle, TOWER_WINDOW_CENTER_ANGLE, 0.001)) {
      addTowerPanel(panels, angle, 0, TOWER_WINDOW_FLOOR, sideWidth, 0, "window-lower-wall");
      addTowerPanel(
        panels,
        angle,
        TOWER_WINDOW_FLOOR,
        TOWER_WINDOW_CEILING,
        windowPostWidth,
        -(windowWidth / 2 + windowPostWidth / 2),
        "window-left",
      );
      addTowerPanel(
        panels,
        angle,
        TOWER_WINDOW_FLOOR,
        TOWER_WINDOW_CEILING,
        windowPostWidth,
        windowWidth / 2 + windowPostWidth / 2,
        "window-right",
      );
      addTowerPanel(panels, angle, TOWER_WINDOW_CEILING, TOWER_TOTAL_HEIGHT, sideWidth, 0, "window-upper-wall");
      continue;
    }

    addTowerPanel(panels, angle, 0, TOWER_TOTAL_HEIGHT, sideWidth, 0, `side-${index}`);
  }

  return panels;
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
  return Math.abs(x) < TOWER_DOOR_HALF_WIDTH && z > 0 && distance < TOWER_OUTER_RADIUS + 0.65;
}

export function isInTowerDoorOpening(x: number, z: number, currentY: number): boolean {
  const distance = Math.hypot(x, z);
  return (
    currentY <= TOWER_DOOR_HEIGHT + 0.4 &&
    Math.abs(x) < TOWER_DOOR_HALF_WIDTH &&
    z > 0 &&
    distance < TOWER_OUTER_RADIUS + PLAYER_RADIUS + 0.15
  );
}

export function isInTowerWindowOpening(x: number, z: number, currentY: number): boolean {
  const distance = Math.hypot(x, z);
  const angle = Math.atan2(z, x);

  return (
    currentY >= TOWER_WINDOW_FLOOR - 0.65 &&
    currentY <= TOWER_WINDOW_CEILING + 0.35 &&
    distance < TOWER_OUTER_RADIUS + PLAYER_RADIUS + 0.15 &&
    isAngleWithin(angle, TOWER_WINDOW_CENTER_ANGLE, TOWER_WINDOW_HALF_ANGLE)
  );
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

export function isPointInsideTowerWallPanel(panel: TowerWallPanel, x: number, z: number, y: number): boolean {
  const epsilon = 0.000001;

  if (y < panel.minY - epsilon || y > panel.maxY + epsilon) {
    return false;
  }

  const dx = x - panel.x;
  const dz = z - panel.z;
  const cos = Math.cos(panel.yaw);
  const sin = Math.sin(panel.yaw);
  const localX = cos * dx + sin * dz;
  const localZ = -sin * dx + cos * dz;

  return Math.abs(localX) <= panel.width / 2 + epsilon && Math.abs(localZ) <= panel.depth / 2 + epsilon;
}

function isWalkablePoint(maze: Maze, towerWallPanels: TowerWallPanel[], x: number, z: number, currentY: number): boolean {
  if (towerWallPanels.some((panel) => isPointInsideTowerWallPanel(panel, x, z, currentY))) {
    return false;
  }

  const distanceFromTower = Math.hypot(x, z);
  if (distanceFromTower < TOWER_OUTER_RADIUS + PLAYER_RADIUS) {
    return true;
  }

  const cell = worldToCell(maze, x, z);
  return isOpenCell(maze, cell);
}

function addTowerPanel(
  panels: TowerWallPanel[],
  angle: number,
  minY: number,
  maxY: number,
  width: number,
  tangentOffset: number,
  id: string,
): void {
  const apothem = TOWER_OUTER_RADIUS - TOWER_WALL_THICKNESS / 2;
  const tangentX = Math.sin(angle);
  const tangentZ = -Math.cos(angle);
  const y = (minY + maxY) / 2;

  panels.push({
    id,
    angle,
    x: Math.cos(angle) * apothem + tangentX * tangentOffset,
    z: Math.sin(angle) * apothem + tangentZ * tangentOffset,
    y,
    yaw: Math.PI / 2 - angle,
    width,
    height: maxY - minY,
    depth: TOWER_WALL_THICKNESS,
    minY,
    maxY,
  });
}

function isAngleWithin(angle: number, center: number, halfWidth: number): boolean {
  const delta = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
  return Math.abs(delta) <= halfWidth;
}
