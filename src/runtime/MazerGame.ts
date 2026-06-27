import * as THREE from "three";
import { generateMaze, type Maze } from "../game/maze";
import {
  collectOrb,
  createProgression,
  enterTower,
  placeOrbOnPedestal,
  type ProgressionState,
} from "../game/progression";
import {
  CELL_SIZE,
  PLAYER_CROUCH_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_STAND_HEIGHT,
  TOWER_DOOR_CENTER_ANGLE,
  TOWER_DOOR_HALF_ANGLE,
  TOWER_DOOR_HALF_WIDTH,
  TOWER_DOOR_HEIGHT,
  TOWER_INNER_RADIUS,
  TOWER_OUTER_RADIUS,
  TOWER_TOP_HEIGHT,
  TOWER_TOTAL_HEIGHT,
  TOWER_WINDOW_CENTER_ANGLE,
  TOWER_WINDOW_CEILING,
  TOWER_WINDOW_FLOOR,
  TOWER_WINDOW_HALF_ANGLE,
  WALL_HEIGHT,
  cellToWorld,
  createMazeCollision,
  findNearestWalkableFloor,
  isInsideTowerInterior,
  isNearTowerDoor,
  type MazeCollision,
} from "../game/world";
import { createRetroTextures, type RetroTextures } from "../render/textures";

type GameMode = "main" | "playing" | "paused" | "won";

type TowerOpening = {
  centerAngle: number;
  halfAngle: number;
  minY: number;
  maxY: number;
};

type PlayerState = {
  position: THREE.Vector3;
  velocityY: number;
  yaw: number;
  pitch: number;
  crouched: boolean;
  grounded: boolean;
};

type UiElements = {
  canvasHost: HTMLElement;
  mainMenu: HTMLElement;
  pauseMenu: HTMLElement;
  winScreen: HTMLElement;
  hud: HTMLElement;
  objective: HTMLElement;
  orbStatus: HTMLElement;
  noclipStatus: HTMLElement;
  prompt: HTMLElement;
  playButton: HTMLButtonElement;
  resumeButton: HTMLButtonElement;
  exitButton: HTMLButtonElement;
  winMenuButton: HTMLButtonElement;
  playAgainButton: HTMLButtonElement;
};

const MAZE_SIZE = 49;
const RENDER_SCALE = 0.55;
const LOOK_SPEED = 0.0021;
const WALK_SPEED = 7.4;
const CROUCH_SPEED = 3.5;
const NOCLIP_SPEED = 12.5;
const JUMP_SPEED = 6.4;
const GRAVITY = -18;
const TOWER_WALL_SEGMENTS = 20;
const TOWER_WALL_THICKNESS = 0.72;

export class MazerGame {
  private readonly ui: UiElements;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.08, 190);
  private readonly clock = new THREE.Clock();
  private readonly textures: RetroTextures;
  private readonly keys = new Set<string>();
  private readonly player: PlayerState = {
    position: new THREE.Vector3(),
    velocityY: 0,
    yaw: 0,
    pitch: 0,
    crouched: false,
    grounded: true,
  };

  private mode: GameMode = "main";
  private maze: Maze | null = null;
  private collision: MazeCollision | null = null;
  private progression: ProgressionState = createProgression();
  private worldGroup: THREE.Group | null = null;
  private jumpRequested = false;
  private orb: THREE.Mesh | null = null;
  private orbLight: THREE.PointLight | null = null;
  private carriedOrb: THREE.Group;
  private pedestalPosition = new THREE.Vector3();
  private noclipEnabled = false;
  private noclipWarning = "";
  private noclipWarningUntil = 0;

  constructor() {
    this.ui = getUiElements();
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x0f1620, 1);
    this.renderer.domElement.className = "game-canvas";
    this.ui.canvasHost.append(this.renderer.domElement);

    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.textures = createRetroTextures();
    this.carriedOrb = this.createCarriedOrb();
    this.camera.add(this.carriedOrb);

    this.configureScene();
    this.bindEvents();
    this.resize();
    this.showMainMenu();
    this.animate();
  }

  private configureScene(): void {
    this.scene.background = new THREE.Color(0x111923);
    this.scene.fog = new THREE.FogExp2(0x111923, 0.011);

    const ambient = new THREE.AmbientLight(0xa7a09a, 1.35);
    const sun = new THREE.DirectionalLight(0xffe0a8, 1.25);
    sun.position.set(-18, 28, 16);

    this.scene.add(ambient, sun);
  }

  private bindEvents(): void {
    this.ui.playButton.addEventListener("click", () => this.startNewGame());
    this.ui.playAgainButton.addEventListener("click", () => this.startNewGame());
    this.ui.resumeButton.addEventListener("click", () => this.resumeGame());
    this.ui.exitButton.addEventListener("click", () => this.showMainMenu());
    this.ui.winMenuButton.addEventListener("click", () => this.showMainMenu());
    this.renderer.domElement.addEventListener("click", () => this.handleCanvasClick());
    document.addEventListener("pointerlockchange", () => this.handlePointerLockChange());
    document.addEventListener("mousemove", (event) => this.handleMouseMove(event));
    document.addEventListener("mousedown", (event) => this.handleMouseDown(event));
    window.addEventListener("keydown", (event) => this.handleKeyDown(event));
    window.addEventListener("keyup", (event) => this.handleKeyUp(event));
    window.addEventListener("blur", () => this.keys.clear());
    window.addEventListener("resize", () => this.resize());
  }

  private startNewGame(): void {
    this.maze = generateMaze({ size: MAZE_SIZE, rng: Math.random });
    this.collision = createMazeCollision(this.maze);
    this.progression = createProgression();
    this.player.velocityY = 0;
    this.player.pitch = 0;
    this.player.yaw = 0;
    this.player.crouched = false;
    this.player.grounded = true;
    this.noclipEnabled = false;
    this.noclipWarning = "";
    this.noclipWarningUntil = 0;
    this.keys.clear();
    this.jumpRequested = false;

    const spawn = cellToWorld(this.maze, this.maze.spawnCell);
    this.player.position.set(spawn.x, 0, spawn.z);
    this.pedestalPosition.set(spawn.x, 1.35, spawn.z);

    this.buildWorld();
    this.mode = "playing";
    this.ui.mainMenu.hidden = true;
    this.ui.pauseMenu.hidden = true;
    this.ui.winScreen.hidden = true;
    this.ui.hud.hidden = false;
    this.syncCamera();
    this.updateUi();
    this.requestPointerLock();
  }

  private buildWorld(): void {
    if (!this.maze || !this.collision) {
      return;
    }

    this.clearWorld();

    const group = new THREE.Group();
    group.name = "mazer-world";
    this.worldGroup = group;
    this.scene.add(group);

    this.addGround(group);
    this.addMazeWalls(group);
    this.addSpawnBoundaryWalls(group);
    this.addTower(group);
    this.addPedestal(group);
    this.addOrb(group);
  }

  private addGround(group: THREE.Group): void {
    if (!this.maze) {
      return;
    }

    const groundSize = this.maze.size * CELL_SIZE + 42;
    const geometry = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);
    const material = new THREE.MeshLambertMaterial({ map: this.textures.grass });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    group.add(ground);
  }

  private addMazeWalls(group: THREE.Group): void {
    if (!this.maze) {
      return;
    }

    const blockedCells = [];
    for (let y = 0; y < this.maze.size; y += 1) {
      for (let x = 0; x < this.maze.size; x += 1) {
        const cell = { x, y };
        const world = cellToWorld(this.maze, cell);
        if (!this.maze.openCells.has(`${x},${y}`) && Math.hypot(world.x, world.z) > TOWER_OUTER_RADIUS + CELL_SIZE) {
          blockedCells.push(world);
        }
      }
    }

    const geometry = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const material = new THREE.MeshLambertMaterial({
      map: this.textures.wall,
      flatShading: true,
    });
    const walls = new THREE.InstancedMesh(geometry, material, blockedCells.length);
    const matrix = new THREE.Matrix4();

    blockedCells.forEach((cell, index) => {
      matrix.makeTranslation(cell.x, WALL_HEIGHT / 2, cell.z);
      walls.setMatrixAt(index, matrix);
    });

    walls.instanceMatrix.needsUpdate = true;
    group.add(walls);
  }

  private addSpawnBoundaryWalls(group: THREE.Group): void {
    if (!this.maze) {
      return;
    }

    const geometry = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const material = new THREE.MeshLambertMaterial({
      map: this.textures.wall,
      flatShading: true,
    });
    const boundary = new THREE.InstancedMesh(geometry, material, this.maze.size);
    const matrix = new THREE.Matrix4();

    for (let x = 0; x < this.maze.size; x += 1) {
      const world = cellToWorld(this.maze, { x, y: this.maze.size });
      matrix.makeTranslation(world.x, WALL_HEIGHT / 2, world.z);
      boundary.setMatrixAt(x, matrix);
    }

    boundary.instanceMatrix.needsUpdate = true;
    group.add(boundary);
  }

  private addTower(group: THREE.Group): void {
    if (!this.collision) {
      return;
    }

    const towerMaterial = new THREE.MeshLambertMaterial({
      map: this.textures.tower,
      flatShading: true,
    });
    const doorOpening: TowerOpening = {
      centerAngle: TOWER_DOOR_CENTER_ANGLE,
      halfAngle: TOWER_DOOR_HALF_ANGLE,
      minY: 0,
      maxY: TOWER_DOOR_HEIGHT,
    };
    const windowOpening: TowerOpening = {
      centerAngle: TOWER_WINDOW_CENTER_ANGLE,
      halfAngle: TOWER_WINDOW_HALF_ANGLE,
      minY: TOWER_WINDOW_FLOOR,
      maxY: TOWER_WINDOW_CEILING,
    };

    this.addTowerWallBand(group, towerMaterial, TOWER_DOOR_HEIGHT / 2, TOWER_DOOR_HEIGHT, [doorOpening]);
    this.addTowerWallBand(
      group,
      towerMaterial,
      (TOWER_DOOR_HEIGHT + TOWER_WINDOW_FLOOR) / 2,
      TOWER_WINDOW_FLOOR - TOWER_DOOR_HEIGHT,
      [],
    );
    this.addTowerWallBand(
      group,
      towerMaterial,
      (TOWER_WINDOW_FLOOR + TOWER_WINDOW_CEILING) / 2,
      TOWER_WINDOW_CEILING - TOWER_WINDOW_FLOOR,
      [windowOpening],
    );
    this.addTowerWallBand(
      group,
      towerMaterial,
      (TOWER_WINDOW_CEILING + TOWER_TOTAL_HEIGHT) / 2,
      TOWER_TOTAL_HEIGHT - TOWER_WINDOW_CEILING,
      [],
    );

    const frameMaterial = new THREE.MeshLambertMaterial({ map: this.textures.door });
    const frameGeometry = new THREE.BoxGeometry(0.55, TOWER_DOOR_HEIGHT, 0.75);
    const leftFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    const rightFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    leftFrame.position.set(-TOWER_DOOR_HALF_WIDTH - 0.28, TOWER_DOOR_HEIGHT / 2, TOWER_OUTER_RADIUS - 0.08);
    rightFrame.position.set(TOWER_DOOR_HALF_WIDTH + 0.28, TOWER_DOOR_HEIGHT / 2, TOWER_OUTER_RADIUS - 0.08);
    group.add(leftFrame, rightFrame);

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(TOWER_DOOR_HALF_WIDTH * 2 + 1.1, 0.55, 0.75), frameMaterial);
    lintel.position.set(0, TOWER_DOOR_HEIGHT + 0.08, TOWER_OUTER_RADIUS - 0.08);
    group.add(lintel);

    this.addTowerWindowFrame(group, frameMaterial);

    const topMaterial = new THREE.MeshLambertMaterial({ map: this.textures.stair, flatShading: true });
    const topPlatform = new THREE.Mesh(
      new THREE.CylinderGeometry(TOWER_INNER_RADIUS, TOWER_INNER_RADIUS, 0.5, 12),
      topMaterial,
    );
    topPlatform.position.y = TOWER_TOP_HEIGHT - 0.25;
    group.add(topPlatform);

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(TOWER_OUTER_RADIUS * 0.72, 4.8, 12),
      new THREE.MeshLambertMaterial({ color: 0x3b3130, flatShading: true }),
    );
    cap.position.y = TOWER_TOTAL_HEIGHT + 2.3;
    group.add(cap);

    const stepGeometry = new THREE.BoxGeometry(
      this.collision.stairs[0]?.width ?? 2.4,
      this.collision.stairs[0]?.thickness ?? 0.3,
      this.collision.stairs[0]?.depth ?? 3.1,
    );
    const stepMaterial = new THREE.MeshLambertMaterial({ map: this.textures.stair, flatShading: true });
    const steps = new THREE.InstancedMesh(stepGeometry, stepMaterial, this.collision.stairs.length);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    this.collision.stairs.forEach((step, index) => {
      position.set(step.x, step.top - step.thickness / 2, step.z);
      quaternion.setFromEuler(new THREE.Euler(0, step.yaw, 0));
      matrix.compose(position, quaternion, scale);
      steps.setMatrixAt(index, matrix);
    });

    steps.instanceMatrix.needsUpdate = true;
    group.add(steps);
  }

  private addTowerWallBand(
    group: THREE.Group,
    material: THREE.Material,
    yCenter: number,
    height: number,
    openings: TowerOpening[],
  ): void {
    if (height <= 0) {
      return;
    }

    const radius = TOWER_OUTER_RADIUS - TOWER_WALL_THICKNESS / 2;
    const arcWidth = ((Math.PI * 2 * TOWER_OUTER_RADIUS) / TOWER_WALL_SEGMENTS) * 0.94;
    const geometry = new THREE.BoxGeometry(arcWidth, height, TOWER_WALL_THICKNESS);
    const walls = new THREE.InstancedMesh(geometry, material, TOWER_WALL_SEGMENTS);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const minY = yCenter - height / 2;
    const maxY = yCenter + height / 2;
    let visibleSegments = 0;

    for (let index = 0; index < TOWER_WALL_SEGMENTS; index += 1) {
      const angle = (index / TOWER_WALL_SEGMENTS) * Math.PI * 2;
      const insideOpening = openings.some(
        (opening) =>
          rangesOverlap(minY, maxY, opening.minY, opening.maxY) &&
          angleWithin(angle, opening.centerAngle, opening.halfAngle),
      );

      if (insideOpening) {
        continue;
      }

      position.set(Math.cos(angle) * radius, yCenter, Math.sin(angle) * radius);
      quaternion.setFromEuler(new THREE.Euler(0, Math.PI / 2 - angle, 0));
      matrix.compose(position, quaternion, scale);
      walls.setMatrixAt(visibleSegments, matrix);
      visibleSegments += 1;
    }

    walls.count = visibleSegments;
    walls.instanceMatrix.needsUpdate = true;
    group.add(walls);
  }

  private addTowerWindowFrame(group: THREE.Group, material: THREE.Material): void {
    const windowHeight = TOWER_WINDOW_CEILING - TOWER_WINDOW_FLOOR;
    const windowWidth = Math.sin(TOWER_WINDOW_HALF_ANGLE) * TOWER_OUTER_RADIUS * 2;
    const x = TOWER_OUTER_RADIUS - 0.08;
    const y = (TOWER_WINDOW_FLOOR + TOWER_WINDOW_CEILING) / 2;
    const postGeometry = new THREE.BoxGeometry(0.78, windowHeight, 0.42);
    const lintelGeometry = new THREE.BoxGeometry(0.78, 0.46, windowWidth + 0.9);
    const leftPost = new THREE.Mesh(postGeometry, material);
    const rightPost = new THREE.Mesh(postGeometry, material);
    const sill = new THREE.Mesh(lintelGeometry, material);
    const lintel = new THREE.Mesh(lintelGeometry, material);

    leftPost.position.set(x, y, -windowWidth / 2 - 0.22);
    rightPost.position.set(x, y, windowWidth / 2 + 0.22);
    sill.position.set(x, TOWER_WINDOW_FLOOR - 0.12, 0);
    lintel.position.set(x, TOWER_WINDOW_CEILING + 0.12, 0);
    group.add(leftPost, rightPost, sill, lintel);
  }

  private addPedestal(group: THREE.Group): void {
    const material = new THREE.MeshLambertMaterial({ map: this.textures.pedestal, flatShading: true });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.55, 0.45, 8), material);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.82, 1.3, 8), material);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.85, 0.35, 8), material);

    base.position.set(this.pedestalPosition.x, 0.225, this.pedestalPosition.z);
    stem.position.set(this.pedestalPosition.x, 0.92, this.pedestalPosition.z);
    top.position.set(this.pedestalPosition.x, 1.72, this.pedestalPosition.z);
    group.add(base, stem, top);
  }

  private addOrb(group: THREE.Group): void {
    const material = new THREE.MeshStandardMaterial({
      color: 0xbffcff,
      emissive: 0x28e6ff,
      emissiveIntensity: 2.4,
      roughness: 0.25,
      metalness: 0.05,
      flatShading: true,
    });

    this.orb = new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 8), material);
    this.orb.position.set(0, TOWER_TOP_HEIGHT + 1.35, 0);
    this.orbLight = new THREE.PointLight(0x39efff, 2.7, 13, 2);
    this.orbLight.position.copy(this.orb.position);
    group.add(this.orb, this.orbLight);
  }

  private createCarriedOrb(): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: 0xd7ffff,
      emissive: 0x3cf3ff,
      emissiveIntensity: 2.8,
      roughness: 0.2,
      flatShading: true,
    });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), material);
    const light = new THREE.PointLight(0x64f6ff, 1.25, 3.5, 2);
    orb.position.set(0, 0, 0);
    light.position.set(0, 0, 0);
    group.position.set(0.52, -0.36, -0.82);
    group.add(orb, light);
    group.visible = false;

    return group;
  }

  private clearWorld(): void {
    if (!this.worldGroup) {
      return;
    }

    this.scene.remove(this.worldGroup);
    this.worldGroup.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else if (material) {
        material.dispose();
      }
    });
    this.worldGroup = null;
    this.orb = null;
    this.orbLight = null;
  }

  private animate(): void {
    window.requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.mode === "playing") {
      this.updateGame(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private updateGame(dt: number): void {
    this.updatePlayer(dt);
    this.updateProgression();
    this.updateOrbAnimation();
    this.syncCamera();
    this.updateUi();
  }

  private updatePlayer(dt: number): void {
    if (!this.collision) {
      return;
    }

    if (this.noclipEnabled) {
      this.updateNoclipPlayer(dt);
      return;
    }

    const moveX = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const moveZ = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    const length = Math.hypot(moveX, moveZ);

    if (length > 0) {
      const forwardX = -Math.sin(this.player.yaw);
      const forwardZ = -Math.cos(this.player.yaw);
      const rightX = Math.cos(this.player.yaw);
      const rightZ = -Math.sin(this.player.yaw);
      const speed = this.player.crouched ? CROUCH_SPEED : WALK_SPEED;
      const normalizedX = moveX / length;
      const normalizedZ = moveZ / length;
      const dx = (rightX * normalizedX + forwardX * normalizedZ) * speed * dt;
      const dz = (rightZ * normalizedX + forwardZ * normalizedZ) * speed * dt;

      this.tryMove(dx, dz);
    }

    const groundBeforeFall = this.collision.getGroundHeight(
      this.player.position.x,
      this.player.position.z,
      this.player.position.y,
    );

    if (this.player.grounded && groundBeforeFall > this.player.position.y) {
      this.player.position.y = groundBeforeFall;
    }

    if (this.jumpRequested && this.player.grounded && !this.player.crouched) {
      this.player.velocityY = JUMP_SPEED;
      this.player.grounded = false;
    }
    this.jumpRequested = false;

    this.player.velocityY += GRAVITY * dt;
    this.player.position.y += this.player.velocityY * dt;

    const ground = this.collision.getGroundHeight(
      this.player.position.x,
      this.player.position.z,
      this.player.position.y,
    );

    if (this.player.position.y <= ground) {
      this.player.position.y = ground;
      this.player.velocityY = 0;
      this.player.grounded = true;
    } else {
      this.player.grounded = false;
    }

    if (this.player.position.y < -12) {
      this.resetToSpawn();
    }
  }

  private updateNoclipPlayer(dt: number): void {
    const moveX = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const moveZ = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    const moveY =
      (this.keys.has("Space") ? 1 : 0) -
      (this.keys.has("ControlLeft") || this.keys.has("ControlRight") || this.keys.has("KeyC") ? 1 : 0);
    const horizontalLength = Math.hypot(moveX, moveZ);

    if (horizontalLength > 0) {
      const forwardX = -Math.sin(this.player.yaw);
      const forwardZ = -Math.cos(this.player.yaw);
      const rightX = Math.cos(this.player.yaw);
      const rightZ = -Math.sin(this.player.yaw);
      const normalizedX = moveX / horizontalLength;
      const normalizedZ = moveZ / horizontalLength;

      this.player.position.x +=
        (rightX * normalizedX + forwardX * normalizedZ) * NOCLIP_SPEED * dt;
      this.player.position.z +=
        (rightZ * normalizedX + forwardZ * normalizedZ) * NOCLIP_SPEED * dt;
    }

    if (moveY !== 0) {
      this.player.position.y += moveY * NOCLIP_SPEED * dt;
    }

    this.player.velocityY = 0;
    this.player.grounded = false;
  }

  private tryMove(dx: number, dz: number): void {
    if (!this.collision) {
      return;
    }

    const { position } = this.player;
    const nextX = position.x + dx;
    const nextZ = position.z + dz;

    if (this.collision.isWalkable(nextX, position.z, position.y, PLAYER_RADIUS)) {
      position.x = nextX;
    }

    if (this.collision.isWalkable(position.x, nextZ, position.y, PLAYER_RADIUS)) {
      position.z = nextZ;
    }
  }

  private resetToSpawn(): void {
    if (!this.maze) {
      return;
    }

    const spawn = cellToWorld(this.maze, this.maze.spawnCell);
    this.player.position.set(spawn.x, 0, spawn.z);
    this.player.velocityY = 0;
    this.player.grounded = true;
  }

  private updateProgression(): void {
    const { x, y, z } = this.player.position;

    if (!this.progression.enteredTower && isInsideTowerInterior(x, z)) {
      this.progression = enterTower(this.progression);
    }

    if (!this.progression.hasOrb && this.progression.enteredTower && this.orb) {
      const distance = this.orb.position.distanceTo(new THREE.Vector3(x, y + PLAYER_STAND_HEIGHT, z));
      if (distance < 2.15) {
        this.collectOrb();
      }
    }

    if (this.progression.hasOrb && this.isNearPedestal()) {
      this.placeOrb();
    }
  }

  private updateOrbAnimation(): void {
    const elapsed = this.clock.elapsedTime;
    if (this.orb && !this.progression.hasOrb && !this.progression.orbPlaced) {
      this.orb.position.y = TOWER_TOP_HEIGHT + 1.35 + Math.sin(elapsed * 2.4) * 0.22;
      this.orb.rotation.y += 0.025;
      if (this.orbLight) {
        this.orbLight.position.copy(this.orb.position);
        this.orbLight.intensity = 2.45 + Math.sin(elapsed * 4.5) * 0.35;
      }
    }

    this.carriedOrb.rotation.y += 0.035;
  }

  private collectOrb(): void {
    this.progression = collectOrb(this.progression);
    if (this.orb) {
      this.orb.visible = false;
    }
    if (this.orbLight) {
      this.orbLight.visible = false;
    }
    this.carriedOrb.visible = true;
  }

  private placeOrb(): void {
    this.progression = placeOrbOnPedestal(this.progression);
    this.carriedOrb.visible = false;
    this.showWinScreen();
  }

  private isNearPedestal(): boolean {
    const horizontalDistance = Math.hypot(
      this.player.position.x - this.pedestalPosition.x,
      this.player.position.z - this.pedestalPosition.z,
    );

    return horizontalDistance < 2.35 && this.player.position.y < 2.1;
  }

  private tryInteract(): void {
    if (this.mode !== "playing") {
      return;
    }

    if (!this.progression.hasOrb && this.progression.enteredTower && this.orb) {
      const distance = this.orb.position.distanceTo(this.camera.position);
      if (distance < 3.2) {
        this.collectOrb();
        return;
      }
    }

    if (this.progression.hasOrb && this.isNearPedestal()) {
      this.placeOrb();
    }
  }

  private syncCamera(): void {
    const eyeHeight = this.player.crouched ? PLAYER_CROUCH_HEIGHT : PLAYER_STAND_HEIGHT;
    this.camera.position.set(
      this.player.position.x,
      this.player.position.y + eyeHeight,
      this.player.position.z,
    );
    this.camera.rotation.set(this.player.pitch, this.player.yaw, 0);
  }

  private updateUi(): void {
    this.ui.objective.textContent = this.progression.objective;
    this.ui.orbStatus.textContent = this.progression.hasOrb ? "ORB HELD" : "NO ORB";
    this.ui.orbStatus.dataset.active = String(this.progression.hasOrb);
    this.ui.noclipStatus.hidden = !this.noclipEnabled;
    this.ui.noclipStatus.textContent =
      this.noclipWarning && this.clock.elapsedTime < this.noclipWarningUntil
        ? this.noclipWarning
        : "NOCLIP ON";
    this.ui.prompt.textContent = this.getPromptText();
    this.ui.prompt.hidden = this.ui.prompt.textContent.length === 0;
  }

  private getPromptText(): string {
    if (this.mode !== "playing") {
      return "";
    }

    const { x, z } = this.player.position;

    if (!this.progression.enteredTower && isNearTowerDoor(x, z)) {
      return "Enter the tower";
    }

    if (!this.progression.hasOrb && this.progression.enteredTower && this.orb) {
      const distance = this.orb.position.distanceTo(this.camera.position);
      if (distance < 3.4) {
        return "E / Click: take orb";
      }
    }

    if (this.progression.hasOrb && this.isNearPedestal()) {
      return "E / Click: place orb";
    }

    return "";
  }

  private handleCanvasClick(): void {
    if (this.mode === "playing" && document.pointerLockElement !== this.renderer.domElement) {
      this.requestPointerLock();
    }
  }

  private handlePointerLockChange(): void {
    if (this.mode === "playing" && document.pointerLockElement !== this.renderer.domElement) {
      this.pauseGame(false);
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.mode !== "playing" || document.pointerLockElement !== this.renderer.domElement) {
      return;
    }

    this.player.yaw -= event.movementX * LOOK_SPEED;
    this.player.pitch -= event.movementY * LOOK_SPEED;
    this.player.pitch = THREE.MathUtils.clamp(this.player.pitch, -1.35, 1.35);
  }

  private handleMouseDown(event: MouseEvent): void {
    if (event.button === 0 && this.mode === "playing") {
      this.tryInteract();
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "Tab") {
      event.preventDefault();
      if (this.mode === "playing") {
        this.player.crouched = !this.player.crouched;
      }
      return;
    }

    if (event.code === "Escape") {
      if (this.mode === "playing") {
        this.pauseGame(true);
      } else if (this.mode === "paused") {
        this.resumeGame();
      }
      return;
    }

    if (this.mode !== "playing") {
      return;
    }

    if (event.code === "KeyF") {
      if (event.repeat) {
        return;
      }
      this.toggleNoclip();
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      if (this.noclipEnabled) {
        this.keys.add(event.code);
        return;
      }
      this.jumpRequested = true;
      return;
    }

    if (event.code === "KeyE") {
      this.tryInteract();
      return;
    }

    this.keys.add(event.code);
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.code);
  }

  private toggleNoclip(): void {
    if (!this.maze || !this.collision) {
      return;
    }

    if (!this.noclipEnabled) {
      this.noclipEnabled = true;
      this.noclipWarning = "";
      this.player.velocityY = 0;
      this.player.grounded = false;
      return;
    }

    if (this.collision.isWalkable(this.player.position.x, this.player.position.z, this.player.position.y, PLAYER_RADIUS)) {
      this.landAtCurrentPosition();
      this.noclipEnabled = false;
      return;
    }

    const safe = findNearestWalkableFloor(this.maze, this.player.position.x, this.player.position.z);
    if (!safe) {
      this.noclipWarning = "NO SAFE FLOOR";
      this.noclipWarningUntil = this.clock.elapsedTime + 2.5;
      return;
    }

    this.player.position.set(safe.x, safe.y, safe.z);
    this.landAtCurrentPosition();
    this.noclipEnabled = false;
  }

  private landAtCurrentPosition(): void {
    if (!this.collision) {
      return;
    }

    this.player.position.y = this.collision.getGroundHeight(
      this.player.position.x,
      this.player.position.z,
      this.player.position.y,
    );
    this.player.velocityY = 0;
    this.player.grounded = true;
  }

  private pauseGame(exitPointerLock: boolean): void {
    if (this.mode !== "playing") {
      return;
    }

    this.mode = "paused";
    this.ui.pauseMenu.hidden = false;
    this.ui.hud.hidden = true;
    this.keys.clear();

    if (exitPointerLock && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  private resumeGame(): void {
    if (this.mode !== "paused") {
      return;
    }

    this.mode = "playing";
    this.ui.pauseMenu.hidden = true;
    this.ui.hud.hidden = false;
    this.requestPointerLock();
  }

  private showMainMenu(): void {
    this.mode = "main";
    this.progression = createProgression();
    this.carriedOrb.visible = false;
    this.noclipEnabled = false;
    this.noclipWarning = "";
    this.ui.mainMenu.hidden = false;
    this.ui.pauseMenu.hidden = true;
    this.ui.winScreen.hidden = true;
    this.ui.hud.hidden = true;
    this.ui.prompt.hidden = true;
    this.keys.clear();

    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  private showWinScreen(): void {
    this.mode = "won";
    this.noclipEnabled = false;
    this.ui.hud.hidden = true;
    this.ui.winScreen.hidden = false;
    this.keys.clear();

    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  private requestPointerLock(): void {
    this.renderer.domElement.requestPointerLock();
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(Math.max(1, Math.floor(width * RENDER_SCALE)), Math.max(1, Math.floor(height * RENDER_SCALE)), false);
    this.renderer.domElement.style.width = `${width}px`;
    this.renderer.domElement.style.height = `${height}px`;
  }
}

function getUiElements(): UiElements {
  return {
    canvasHost: getElement("canvas-host"),
    mainMenu: getElement("main-menu"),
    pauseMenu: getElement("pause-menu"),
    winScreen: getElement("win-screen"),
    hud: getElement("hud"),
    objective: getElement("objective-text"),
    orbStatus: getElement("orb-status"),
    noclipStatus: getElement("noclip-status"),
    prompt: getElement("interaction-prompt"),
    playButton: getButton("play-button"),
    resumeButton: getButton("resume-button"),
    exitButton: getButton("exit-button"),
    winMenuButton: getButton("win-menu-button"),
    playAgainButton: getButton("play-again-button"),
  };
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }

  return element;
}

function getButton(id: string): HTMLButtonElement {
  const element = getElement(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`#${id} must be a button.`);
  }

  return element;
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin < bMax && bMin < aMax;
}

function angleWithin(angle: number, center: number, halfWidth: number): boolean {
  const delta = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
  return Math.abs(delta) <= halfWidth;
}
