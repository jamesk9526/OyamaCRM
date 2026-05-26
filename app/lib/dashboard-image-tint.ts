/**
 * Utilities for deriving Donor CRM shell tint colors from dashboard header imagery.
 */

export interface DashboardChromeTint {
  base: string;
  dark: string;
  mid: string;
  light: string;
  soft: string;
  border: string;
  shadowRgb: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const DEFAULT_TINT = "#047857";
const IMAGE_TINT_BLEND_WEIGHT = 0.58;

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHex(value: string | null | undefined): string {
  const input = String(value ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(input)) return input.toLowerCase();
  return DEFAULT_TINT;
}

function hexToRgb(hex: string): Rgb {
  const safe = normalizeHex(hex).replace("#", "");
  return {
    r: Number.parseInt(safe.slice(0, 2), 16),
    g: Number.parseInt(safe.slice(2, 4), 16),
    b: Number.parseInt(safe.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((channel) => clampChannel(channel).toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: Rgb, b: Rgb, weight: number): Rgb {
  return {
    r: a.r * (1 - weight) + b.r * weight,
    g: a.g * (1 - weight) + b.g * weight,
    b: a.b * (1 - weight) + b.b * weight,
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Keeps image-derived chrome recognizable without letting one header image dominate navigation. */
function softenImageTint(sampledColor: Rgb): Rgb {
  return mix(sampledColor, hexToRgb(DEFAULT_TINT), IMAGE_TINT_BLEND_WEIGHT);
}

/** Builds a stable shell palette from a single sampled or configured color. */
export function deriveDashboardChromeTint(color: string | null | undefined): DashboardChromeTint {
  const baseRgb = hexToRgb(normalizeHex(color));
  const adjustedBase = relativeLuminance(baseRgb) > 0.7 ? mix(baseRgb, { r: 4, g: 47, b: 46 }, 0.45) : baseRgb;
  const dark = mix(adjustedBase, { r: 2, g: 6, b: 23 }, 0.62);
  const mid = mix(adjustedBase, { r: 2, g: 44, b: 34 }, 0.28);
  const light = mix(adjustedBase, { r: 209, g: 250, b: 229 }, 0.28);
  const soft = mix(adjustedBase, { r: 255, g: 255, b: 255 }, 0.78);

  return {
    base: rgbToHex(adjustedBase),
    dark: rgbToHex(dark),
    mid: rgbToHex(mid),
    light: rgbToHex(light),
    soft: rgbToHex(soft),
    border: `rgba(${clampChannel(light.r)}, ${clampChannel(light.g)}, ${clampChannel(light.b)}, 0.28)`,
    shadowRgb: `${clampChannel(dark.r)}, ${clampChannel(dark.g)}, ${clampChannel(dark.b)}`,
  };
}

/**
 * Samples a browser-loadable header image and returns a chrome palette.
 * Remote images without CORS support intentionally fall back to the caller.
 */
export async function extractDashboardImageTint(imageUrl: string): Promise<DashboardChromeTint | null> {
  if (typeof window === "undefined" || !imageUrl.trim()) return null;

  return new Promise((resolve) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, size, size);
        const data = context.getImageData(0, 0, size, size).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let index = 0; index < data.length; index += 4) {
          const alpha = data[index + 3] ?? 0;
          if (alpha < 180) continue;
          r += data[index] ?? 0;
          g += data[index + 1] ?? 0;
          b += data[index + 2] ?? 0;
          count += 1;
        }

        if (count === 0) {
          resolve(null);
          return;
        }

        resolve(deriveDashboardChromeTint(rgbToHex(softenImageTint({ r: r / count, g: g / count, b: b / count }))));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });
}
