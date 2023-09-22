// Modules
import got from "got";
import { fileTypeFromBuffer } from "file-type";
import { XMLParser } from "fast-xml-parser";
import { imageSize as sizeOf } from "image-size";

const timeoutDuration = 5 * 1000;

export interface RobloxAsset {
  webId?: number;
  assetId: number;
  type?: string;
  buffer: Buffer;
}

const assetCache: RobloxAsset[] = [];

function getIDfromURL(url: string) {
  const regex: RegExp = /\/asset\/\?id=(\d+)/;
  const match = url.match(regex);
  if (match !== null) {
    const id: number = parseInt(match[1]);
    return id;
  }
}

async function checkImage(buffer: Buffer) {
  const fileType = await fileTypeFromBuffer(buffer);
  if (fileType !== undefined) {
    if (fileType.mime.includes("image")) {
      return "image";
    }
  }
  return "unknown";
}

async function getImageIdFromAssetId(id: number) {
  const text = await got(
    `https://assetdelivery.roblox.com/v1/asset/?id=${id}`,
    {
      timeout: {
        request: timeoutDuration,
      },
    }
  ).text();
  const parser = new XMLParser({
    ignoreAttributes: false,
  });
  const json = parser.parse<any>(text);
  const item = json.roblox.Item;
  const type = item["@_class"]; // 'Shirt' or 'ShirtGraphic'
  const props = item.Properties;
  const url = props.Content.url;
  return [getIDfromURL(url), type];
}

async function getImageBufferFromImageId(id: number) {
  const imageBuffer = await got(
    `https://assetdelivery.roblox.com/v1/asset/?id=${id}`,
    {
      timeout: {
        request: timeoutDuration,
      },
    }
  ).buffer();
  return imageBuffer;
}

export async function getAssetFromId(id: number) {
  const cacheHit = assetCache.find(
    (item) => item.webId === id || item.assetId === id
  );
  if (!cacheHit) {
    const buffer = await got(
      `https://assetdelivery.roblox.com/v1/asset/?id=${id}`,
      {
        timeout: {
          request: timeoutDuration,
        },
      }
    ).buffer();
    const type = await checkImage(buffer);
    if (type !== "image") {
      const [imageId, assetType] = await getImageIdFromAssetId(id);
      const imageBuffer = await getImageBufferFromImageId(imageId);
      const asset: RobloxAsset = {
        webId: id,
        assetId: imageId,
        type: assetType,
        buffer: imageBuffer,
      };
      assetCache.push(asset);
      return asset;
    }
    const size = sizeOf(buffer);
    if (size.height && size.width) {
      const aspectRatio = size.height / size.width;
      const asset: RobloxAsset = {
        assetId: id,
        type: Math.abs(aspectRatio - 585 / 559)
          ? "Shirt"
          : Math.abs(aspectRatio - 128 / 128)
          ? "ShirtGraphic"
          : undefined,
        buffer: buffer,
      };
      assetCache.push(asset);
      return asset;
    }
  }
  return cacheHit;
}
