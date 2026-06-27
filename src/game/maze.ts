export type MazeCell = {
  x: number;
  y: number;
};

export type Maze = {
  size: number;
  openCells: Set<string>;
  spawnCell: MazeCell;
  towerCell: MazeCell;
};

export type MazeOptions = {
  size?: number;
  rng?: () => number;
};

const DEFAULT_SIZE = 49;
const EXTRA_LOOP_RATE = 0.18;

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function cellKey(cell: MazeCell): string {
  return `${cell.x},${cell.y}`;
}

export function isSameCell(a: MazeCell, b: MazeCell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function generateMaze(options: MazeOptions = {}): Maze {
  const size = normalizeMazeSize(options.size ?? DEFAULT_SIZE);
  const rng = options.rng ?? Math.random;
  const openCells = new Set<string>();
  const towerCell = { x: Math.floor(size / 2), y: Math.floor(size / 2) };
  const spawnX = randomOddBetween(1, size - 2, rng);
  const spawnCell = { x: spawnX, y: size - 1 };
  const startCell = { x: spawnX, y: size - 2 };
  const visited = new Set<string>();

  carve(startCell, openCells);
  visited.add(cellKey(startCell));

  const frontier = createFrontier(startCell, size, visited);
  while (frontier.length > 0) {
    const index = Math.floor(rng() * frontier.length);
    const edge = frontier.splice(index, 1)[0];
    if (!edge || visited.has(cellKey(edge.to))) {
      continue;
    }

    carve(edge.wall, openCells);
    carve(edge.to, openCells);
    visited.add(cellKey(edge.to));
    frontier.push(...createFrontier(edge.to, size, visited));
  }

  carve(spawnCell, openCells);
  carve(startCell, openCells);
  carveExtraConnections(size, openCells, rng);
  carveTowerPlaza(towerCell, size, openCells);
  connectTowerToMaze(towerCell, openCells);

  return {
    size,
    openCells,
    spawnCell,
    towerCell,
  };
}

export function findPath(maze: Maze, from: MazeCell, to: MazeCell): MazeCell[] {
  if (!maze.openCells.has(cellKey(from)) || !maze.openCells.has(cellKey(to))) {
    return [];
  }

  const queue = [from];
  const visited = new Set([cellKey(from)]);
  const previous = new Map<string, MazeCell>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (isSameCell(current, to)) {
      return rebuildPath(previous, from, to);
    }

    for (const neighbor of getOpenNeighbors(maze, current)) {
      const key = cellKey(neighbor);
      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      previous.set(key, current);
      queue.push(neighbor);
    }
  }

  return [];
}

export function isOpenCell(maze: Maze, cell: MazeCell): boolean {
  return maze.openCells.has(cellKey(cell));
}

export function getOpenNeighbors(maze: Maze, cell: MazeCell): MazeCell[] {
  return [
    { x: cell.x + 1, y: cell.y },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x, y: cell.y - 1 },
  ].filter((neighbor) => maze.openCells.has(cellKey(neighbor)));
}

function normalizeMazeSize(size: number): number {
  const rounded = Math.max(11, Math.floor(size));
  return rounded % 2 === 0 ? rounded + 1 : rounded;
}

function randomOddBetween(min: number, max: number, rng: () => number): number {
  const oddValues: number[] = [];
  for (let value = min; value <= max; value += 1) {
    if (value % 2 === 1) {
      oddValues.push(value);
    }
  }

  return oddValues[Math.floor(rng() * oddValues.length)] ?? min;
}

function isInsideCarveArea(cell: MazeCell, size: number): boolean {
  return cell.x > 0 && cell.y > 0 && cell.x < size - 1 && cell.y < size - 1;
}

type FrontierEdge = {
  to: MazeCell;
  wall: MazeCell;
};

function createFrontier(cell: MazeCell, size: number, visited: Set<string>): FrontierEdge[] {
  return [
    { to: { x: cell.x + 2, y: cell.y }, wall: { x: cell.x + 1, y: cell.y } },
    { to: { x: cell.x - 2, y: cell.y }, wall: { x: cell.x - 1, y: cell.y } },
    { to: { x: cell.x, y: cell.y + 2 }, wall: { x: cell.x, y: cell.y + 1 } },
    { to: { x: cell.x, y: cell.y - 2 }, wall: { x: cell.x, y: cell.y - 1 } },
  ].filter((edge) => isInsideCarveArea(edge.to, size) && !visited.has(cellKey(edge.to)));
}

function carveExtraConnections(size: number, openCells: Set<string>, rng: () => number): void {
  const candidates: MazeCell[] = [];

  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const cell = { x, y };
      if (openCells.has(cellKey(cell))) {
        continue;
      }

      const eastWestOpen =
        openCells.has(cellKey({ x: x - 1, y })) && openCells.has(cellKey({ x: x + 1, y }));
      const northSouthOpen =
        openCells.has(cellKey({ x, y: y - 1 })) && openCells.has(cellKey({ x, y: y + 1 }));

      if (eastWestOpen || northSouthOpen) {
        candidates.push(cell);
      }
    }
  }

  const shuffled = shuffle(candidates, rng);
  const connectionCount = Math.floor(shuffled.length * EXTRA_LOOP_RATE);
  for (let index = 0; index < connectionCount; index += 1) {
    const cell = shuffled[index];
    if (cell) {
      carve(cell, openCells);
    }
  }
}

function carve(cell: MazeCell, openCells: Set<string>): void {
  openCells.add(cellKey(cell));
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function carveTowerPlaza(towerCell: MazeCell, size: number, openCells: Set<string>): void {
  for (let y = towerCell.y - 1; y <= towerCell.y + 1; y += 1) {
    for (let x = towerCell.x - 1; x <= towerCell.x + 1; x += 1) {
      if (x > 0 && y > 0 && x < size - 1 && y < size - 1) {
        carve({ x, y }, openCells);
      }
    }
  }
}

function connectTowerToMaze(towerCell: MazeCell, openCells: Set<string>): void {
  let closest: MazeCell | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const key of openCells) {
    const [xText, yText] = key.split(",");
    const cell = { x: Number(xText), y: Number(yText) };
    const distance = Math.abs(cell.x - towerCell.x) + Math.abs(cell.y - towerCell.y);
    if (distance > 0 && distance < closestDistance) {
      closest = cell;
      closestDistance = distance;
    }
  }

  if (!closest) {
    return;
  }

  const cursor = { ...towerCell };
  carve(cursor, openCells);

  while (cursor.x !== closest.x) {
    cursor.x += Math.sign(closest.x - cursor.x);
    carve(cursor, openCells);
  }

  while (cursor.y !== closest.y) {
    cursor.y += Math.sign(closest.y - cursor.y);
    carve(cursor, openCells);
  }
}

function rebuildPath(previous: Map<string, MazeCell>, from: MazeCell, to: MazeCell): MazeCell[] {
  const path = [to];
  let cursor = to;

  while (!isSameCell(cursor, from)) {
    const prior = previous.get(cellKey(cursor));
    if (!prior) {
      return [];
    }

    path.push(prior);
    cursor = prior;
  }

  return path.reverse();
}
