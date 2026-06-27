import * as THREE from "three";

export type RetroTextures = {
  grass: THREE.CanvasTexture;
  wall: THREE.CanvasTexture;
  tower: THREE.CanvasTexture;
  stair: THREE.CanvasTexture;
  pedestal: THREE.CanvasTexture;
  door: THREE.CanvasTexture;
};

type PaintFn = (context: CanvasRenderingContext2D, size: number) => void;

export function createRetroTextures(): RetroTextures {
  return {
    grass: createPixelTexture(64, paintGrass, 18, 18),
    wall: createPixelTexture(64, paintMazeStone, 1, 1),
    tower: createPixelTexture(64, paintTowerBrick, 1, 1),
    stair: createPixelTexture(64, paintConcrete, 1, 1),
    pedestal: createPixelTexture(64, paintPedestal, 1, 1),
    door: createPixelTexture(32, paintDoor, 1, 1),
  };
}

function createPixelTexture(
  size: number,
  paint: PaintFn,
  repeatX: number,
  repeatY: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create texture canvas context.");
  }

  context.imageSmoothingEnabled = false;
  paint(context, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);

  return texture;
}

function paintGrass(context: CanvasRenderingContext2D, size: number): void {
  context.fillStyle = "#2d412c";
  context.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const shade = (x * 7 + y * 13) % 4;
      context.fillStyle = ["#263825", "#345033", "#42643a", "#1d2d21"][shade] ?? "#345033";
      context.fillRect(x, y, 4, 4);
    }
  }

  context.fillStyle = "rgba(94, 74, 45, 0.35)";
  for (let index = 0; index < 18; index += 1) {
    const x = (index * 19) % size;
    const y = (index * 29) % size;
    context.fillRect(x, y, 6, 2);
  }
}

function paintMazeStone(context: CanvasRenderingContext2D, size: number): void {
  context.fillStyle = "#4a4f55";
  context.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 16) {
    for (let x = 0; x < size; x += 16) {
      const offset = y % 32 === 0 ? 0 : 8;
      context.fillStyle = (x + y) % 32 === 0 ? "#5b6267" : "#393f45";
      context.fillRect((x + offset) % size, y, 15, 15);
    }
  }

  context.strokeStyle = "#202429";
  context.lineWidth = 2;
  for (let y = 0; y < size; y += 16) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size, y);
    context.stroke();
  }
}

function paintTowerBrick(context: CanvasRenderingContext2D, size: number): void {
  context.fillStyle = "#5a5149";
  context.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 12) {
    const rowOffset = y % 24 === 0 ? 0 : 12;
    for (let x = -rowOffset; x < size; x += 24) {
      context.fillStyle = (x + y) % 48 === 0 ? "#70665c" : "#403a35";
      context.fillRect(x + 1, y + 1, 22, 10);
    }
  }
}

function paintConcrete(context: CanvasRenderingContext2D, size: number): void {
  context.fillStyle = "#686863";
  context.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 8) {
    for (let x = 0; x < size; x += 8) {
      context.fillStyle = (x * 3 + y * 5) % 16 === 0 ? "#7b7a73" : "#4c4d49";
      context.fillRect(x, y, 7, 7);
    }
  }
}

function paintPedestal(context: CanvasRenderingContext2D, size: number): void {
  context.fillStyle = "#53483d";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#84715d";
  context.fillRect(0, 0, size, 8);
  context.fillRect(0, 28, size, 5);
  context.fillStyle = "#2a241f";
  context.fillRect(0, 8, size, 2);
  context.fillRect(0, 33, size, 2);
}

function paintDoor(context: CanvasRenderingContext2D, size: number): void {
  context.fillStyle = "#1d1714";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#4e3021";
  for (let x = 2; x < size; x += 8) {
    context.fillRect(x, 0, 5, size);
  }
  context.fillStyle = "#c79d56";
  context.fillRect(size - 9, size / 2, 3, 3);
}
