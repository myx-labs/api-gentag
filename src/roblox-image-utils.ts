// Modules
import got from "got";
import { fileTypeFromBuffer } from "file-type";
import { XMLParser } from "fast-xml-parser";
import { imageSize as sizeOf } from "image-size";
import config from "./config.js";

const timeoutDuration = 5 * 1000;

export interface RobloxAsset {
  webId?: number;
  assetId: number;
  type?: string;
  buffer: Buffer;
}

const assetCache: RobloxAsset[] = [];

function getIDfromURL(url: string): number | null {
  const regex: RegExp = /\/asset\/\?id=(\d+)/;
  const match = url.match(regex);
  if (match !== null) {
    const id: number = parseInt(match[1]);
    return id;
  }
  return null; // Explicitly return null if no match
}

// New helper function to fetch asset info, handling direct images and XML indirections
async function fetchAssetInfo(
  requestedId: number
): Promise<{ buffer: Buffer; finalAssetId: number; assetType?: string }> {
  const robloxApiKey = config.credentials.roblox;
  const assetDeliveryURL = `https://apis.roblox.com/asset-delivery-api/v1/assetId/${requestedId}`;

  const initialResponse: { location: string } = await got(assetDeliveryURL, {
    timeout: { request: timeoutDuration },
    headers: { "x-api-key": robloxApiKey },
  }).json();

  if (!initialResponse.location) {
    throw new Error(
      `Asset with ID ${requestedId} not found (no initial location).`
    );
  }

  const assetResponse = await got(initialResponse.location, {
    timeout: { request: timeoutDuration },
  });
  const assetBuffer = assetResponse.rawBody;

  const fileType = await fileTypeFromBuffer(assetBuffer);
  if (fileType?.mime.startsWith("image/")) {
    // Direct image buffer
    return {
      buffer: assetBuffer,
      finalAssetId: requestedId,
      assetType: undefined,
    };
  } else {
    // Not a direct image, try parsing as XML
    const parser = new XMLParser({ ignoreAttributes: false });
    const textContent = assetBuffer.toString();
    let json;
    try {
      json = parser.parse(textContent);
    } catch (e) {
      throw new Error(
        `Failed to parse XML for asset ID ${requestedId}: ${
          (e as Error).message
        }. Content: ${textContent.substring(0, 200)}`
      );
    }

    if (json.roblox?.Item?.Properties?.Content?.url) {
      const item = json.roblox.Item;
      const xmlAssetType = item["@_class"];
      const contentUrl = item.Properties.Content.url.trim();

      let imageIdToFetchFromContent: number | null = null;

      const rbxAssetIdMatch = contentUrl.match(/^rbxassetid:\/\/(\d+)/);
      if (rbxAssetIdMatch) {
        imageIdToFetchFromContent = parseInt(rbxAssetIdMatch[1], 10);
      } else {
        imageIdToFetchFromContent = getIDfromURL(contentUrl); // Handles standard /asset/?id= URLs
      }

      let finalImageBuffer: Buffer;
      let finalAssetIdForImage: number;

      if (imageIdToFetchFromContent !== null) {
        // Asset ID found in XML URL (either rbxassetid or /asset/?id=)
        finalAssetIdForImage = imageIdToFetchFromContent;
        const imageAssetApiResponse: { location: string } = await got(
          `https://apis.roblox.com/asset-delivery-api/v1/assetId/${finalAssetIdForImage}`,
          {
            timeout: { request: timeoutDuration },
            headers: { "x-api-key": robloxApiKey },
          }
        ).json();

        if (!imageAssetApiResponse.location) {
          throw new Error(
            `Image asset ID ${finalAssetIdForImage} (from XML content URL: ${contentUrl}) did not yield a location.`
          );
        }
        finalImageBuffer = await got(imageAssetApiResponse.location, {
          timeout: { request: timeoutDuration },
        }).buffer();
      } else if (
        contentUrl.startsWith("http://") ||
        contentUrl.startsWith("https://")
      ) {
        // Direct HTTP/HTTPS URL from XML (e.g., CDN link)
        finalImageBuffer = await got(contentUrl, {
          timeout: { request: timeoutDuration },
        }).buffer();
        // For direct URLs from XML, the 'finalAssetIdForImage' is the original requestedId,
        // as the direct URL is considered a representation of that original asset.
        finalAssetIdForImage = requestedId;
      } else {
        throw new Error(
          `XML content URL '${contentUrl}' for asset ${requestedId} is not a recognized rbxassetid, Roblox asset URL, or direct HTTP(S) URL.`
        );
      }

      const verifyFinalFileType = await fileTypeFromBuffer(finalImageBuffer);
      if (!verifyFinalFileType?.mime.startsWith("image/")) {
        throw new Error(
          `Content from XML (resolved to ID ${finalAssetIdForImage} or URL ${contentUrl}) for original asset ${requestedId} is not an image. Mime: ${verifyFinalFileType?.mime}`
        );
      }
      return {
        buffer: finalImageBuffer,
        finalAssetId: finalAssetIdForImage,
        assetType: xmlAssetType,
      };
    } else {
      const snippet = textContent.substring(0, 500);
      throw new Error(
        `Asset ID ${requestedId} resolved to non-image, or malformed XML (missing Properties.Content.url). XML Snippet: ${snippet}`
      );
    }
  }
}

export async function getAssetFromId(
  id: number
): Promise<RobloxAsset | undefined> {
  // Check cache: by original requested ID (webId) or by a previously resolved assetId
  for (const item of assetCache) {
    if (item.webId === id || item.assetId === id) {
      return item;
    }
  }

  try {
    const {
      buffer,
      finalAssetId,
      assetType: typeFromXml,
    } = await fetchAssetInfo(id);

    // Check cache again with finalAssetId, in case it was resolved from a different webId or directly matched 'id'
    const existingAssetByFinalId = assetCache.find(
      (a) => a.assetId === finalAssetId
    );
    if (existingAssetByFinalId) {
      // If this 'id' (webId) is new for this cached asset, link it.
      if (existingAssetByFinalId.webId === undefined && id !== finalAssetId) {
        existingAssetByFinalId.webId = id;
      }
      // Update type if newly found from XML and was previously unknown for this cached asset.
      if (existingAssetByFinalId.type === undefined && typeFromXml) {
        existingAssetByFinalId.type = typeFromXml;
      }
      return existingAssetByFinalId;
    }

    let determinedType = typeFromXml;
    if (!determinedType) {
      // If type not from XML, try to determine by aspect ratio
      try {
        const size = sizeOf(buffer); // image-size can throw if not a recognized image format
        if (size.height && size.width) {
          const aspectRatio = size.height / size.width;
          const tolerance = 0.015;
          if (Math.abs(aspectRatio - 585 / 559) < tolerance) {
            determinedType = "Shirt";
          } else if (Math.abs(aspectRatio - 128 / 128) < tolerance) {
            determinedType = "ShirtGraphic";
          }
        }
      } catch (sizeError) {
        console.warn(
          `Could not determine size for asset ID ${finalAssetId} (original ID ${id}): ${
            (sizeError as Error).message
          }`
        );
        // fileTypeFromBuffer in fetchAssetInfo should ensure it's an image, but image-size might not support all formats.
      }
    }

    const asset: RobloxAsset = {
      webId: id, // The original ID requested by the user
      assetId: finalAssetId, // The ID of the actual image asset
      type: determinedType,
      buffer: buffer,
    };

    assetCache.push(asset);
    return asset;
  } catch (error) {
    console.error(
      `Failed to get asset for ID ${id}:`,
      error instanceof Error ? error.message : String(error)
    );
    return undefined; // Return undefined on error as per Promise signature
  }
}
