import pkg from "canvas";
const { loadImage } = pkg;

import { NametagTemplate } from "./nametag.js";
import { getAssetFromId } from "./roblox-image-utils.js";

import templates from "../resources/templates.json";

const loadedTemplates: NametagTemplate[] = await Promise.all(
  templates.map(async (item) => {
    const data = item;
    const assets = {
      canvasImage: await loadImage(`./resources/templates/${item.imagePath}`),
      previewAsset: await getAssetFromId(item.previewAssetId),
    };
    return {
      data: data,
      assets: assets,
    };
  })
);

export default loadedTemplates;
