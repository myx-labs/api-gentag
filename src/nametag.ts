import pkg from "canvas";
import { getAssetFromId, RobloxAsset } from "./roblox-image-utils.js";
const { registerFont, createCanvas, loadImage } = pkg;

registerFont("./resources/fonts/Pixeled.ttf", {
  family: "Pixeled",
});

// Configurations
import templates from "./templates.js";

export interface NametagTemplate {
  data: {
    name: string;
    category: string;
    type: string;
    variant: number;
    text: {
      font: {
        size: string;
        family: string;
      };
      colour: string;
      anchorPoint: number[];
      maxWidth: number;
    };
  };
  assets: { canvasImage: pkg.Image; previewAsset: RobloxAsset };
}

// Functions
function sanitiseNametagString(text: string) {
  return text.replace(/[^a-z0-9+]+/gi, "+");
}

export async function createNametagImageBuffer(
  template: NametagTemplate,
  name: string,
  additionalAssets: RobloxAsset[] = []
) {
  const canvas = createCanvas(128, 128);
  const ctx = canvas.getContext("2d");
  const assets = template.assets;
  const text = template.data.text;
  const font = text.font;
  const [x, y] = text.anchorPoint;

  ctx.imageSmoothingEnabled = false;
  ctx.font = `${font.size} "${font.family}"`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = text.colour;

  for (const asset of additionalAssets) {
    const image = await loadImage(asset.buffer);
    switch (asset.type) {
      case "Shirt":
        ctx.drawImage(image, -231, -74);
        break;
      case "ShirtGraphic":
        ctx.drawImage(image, 0, 0);
        break;
      default:
        break;
    }
  }

  const nametagImage = assets.canvasImage;

  ctx.drawImage(nametagImage, 0, 0);
  ctx.fillText(name.toUpperCase(), x, y, text.maxWidth);

  return canvas.toBuffer("image/png");
}

export async function createNametag(
  name: string,
  index: number = 0,
  preview: boolean = false,
  tShirtIDs: number[] = []
) {
  const template = await getTemplateFromIndex(index);

  const additionalAssets: RobloxAsset[] = [];

  if (preview) {
    const previewAsset = template.assets.previewAsset;
    additionalAssets.push(previewAsset);
  }

  if (tShirtIDs.length > 0) {
    const assets = await Promise.allSettled(tShirtIDs.map(getAssetFromId));
    const legitAssets = assets.reduce((filtered, promise) => {
      if (promise.status === "fulfilled") {
        const asset = promise.value;
        if (asset) filtered.push(asset);
      }
      return filtered;
    }, [] as RobloxAsset[]);
    for (const asset of legitAssets) {
      additionalAssets.push(asset);
    }
  }

  return createNametagImageBuffer(template, name, additionalAssets);
}

export async function getTemplateFromIndex(index: number = 0) {
  const templates = await getTemplates();
  if (index >= templates.length - 1) {
    index = templates.length - 1;
  } else if (index < 0) {
    index = 0;
  }
  const template = templates[index];
  return template;
}

export async function getTemplates() {
  return templates as NametagTemplate[];
}
