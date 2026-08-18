import { describe, expect, it } from "vitest";
import { detectEstimatedBuildings, detectIgnoredUiBands, simplifyImagePixels } from "./auto-site-background";

function imageWithBands(width: number, height: number, top: number, bottom: number) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const inInterface = y < top || y >= height - bottom;
      pixels[index] = inInterface ? 242 : (x * 17 + y * 7) % 210;
      pixels[index + 1] = inInterface ? 242 : (x * 9 + y * 19) % 200;
      pixels[index + 2] = inInterface ? 242 : (x * 5 + y * 13) % 190;
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

describe("automatic school background", () => {
  it("detects obvious neutral browser bars without cropping the canvas", () => {
    const width = 120;
    const height = 200;
    const bands = detectIgnoredUiBands(imageWithBands(width, height, 12, 10), width, height);
    expect(bands.top).toBeGreaterThanOrEqual(12);
    expect(bands.bottom).toBeGreaterThanOrEqual(10);
  });

  it("does not invent interface bands in a varied school image", () => {
    const width = 120;
    const height = 200;
    expect(detectIgnoredUiBands(imageWithBands(width, height, 0, 0), width, height)).toEqual({ top: 0, bottom: 0 });
  });

  it("reduces saturation and brightens pixels for material visibility", () => {
    const pixels = new Uint8ClampedArray([20, 120, 40, 255, 180, 40, 30, 255]);
    simplifyImagePixels(pixels, 2, 1);
    expect(Math.max(pixels[0], pixels[1], pixels[2]) - Math.min(pixels[0], pixels[1], pixels[2])).toBeLessThan(100);
    expect(pixels[0] + pixels[1] + pixels[2]).toBeGreaterThan(20 + 120 + 40);
  });

  it("finds elongated roof regions and estimates their height", () => {
    const width = 160;
    const height = 100;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = (y * width + x) * 4;
        const onRoof = (x >= 22 && x <= 72 && y >= 18 && y <= 28)
          || (x >= 96 && x <= 112 && y >= 48 && y <= 84);
        pixels[pixel] = onRoof ? 166 : 47;
        pixels[pixel + 1] = onRoof ? 72 : 116;
        pixels[pixel + 2] = onRoof ? 58 : 54;
        pixels[pixel + 3] = 255;
      }
    }

    const buildings = detectEstimatedBuildings(pixels, width, height);
    expect(buildings.length).toBeGreaterThanOrEqual(2);
    expect(buildings.every((building) => building.estimatedFloors >= 2)).toBe(true);
    expect(buildings.some((building) => building.confidence >= 0.35)).toBe(true);
  });
});
