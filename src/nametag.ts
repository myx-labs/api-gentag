import pkg from "canvas";
import { getAssetFromId, RobloxAsset } from "./roblox-image-utils.js";
import fs from "fs"; // For file system operations
import path from "path"; // For path manipulation

const { registerFont, createCanvas, loadImage, Image } = pkg;

// Register your standard fallback font
// Ensure this path is correct relative to your execution directory
try {
  if (fs.existsSync("./resources/fonts/Pixeled.ttf")) {
    registerFont("./resources/fonts/Pixeled.ttf", {
      family: "Pixeled",
    });
    console.log("Successfully registered font: Pixeled");
  } else {
    console.warn(
      "Warning: Pixeled.ttf not found at ./resources/fonts/Pixeled.ttf. Fallback font might not work as expected."
    );
  }
} catch (error) {
  console.error("Error registering font:", error);
}

// Configurations
import templatesFromFile from "./templates.js"; // Assuming templates.js exports the array directly

// --- Interfaces ---
export interface CustomCharacterStyle {
  directory: string; // Path to the character images (e.g., "./resources/custom_fonts/police/")
  targetHeight: number; // Desired height for each character image on the canvas
  spacing: number; // Pixels between characters (actual images or placeholders)
  extension?: string; // e.g., ".png" (defaults to .png)
  caseSensitiveFileNames?: boolean; // Are filenames case sensitive (e.g., a.png vs A.png)? Defaults to false.
  characterMap?: { [char: string]: string }; // e.g., { '+': 'plus', ' ': 'space' }
  fallbackChar?: string; // Optional: character image to use if a specific one isn't found (e.g., 'unknown.png')
  missingCharacterSpacing?: number; // NEW: Width in pixels to use if a character image and its fallback are missing
}

export interface NametagTextConfig {
  font: {
    size: string; // For fillText: "30px". For customChars: represents target height as string e.g., "40"
    family: string; // For fillText: "Pixeled". For customChars: can be a descriptive name like "PoliceCustom"
  };
  colour: string; // Used as fillStyle for fillText, or could be a tint for custom characters (more advanced)
  anchorPoint: [number, number]; // [x, y] - for fillText, this is the center. For custom, also center.
  maxWidth: number; // For fillText. For custom characters, used to potentially scale down.
  customCharacterStyle?: CustomCharacterStyle;
}

export interface NametagTemplateData {
  name: string; // Template name
  category: string;
  type: string;
  variant: number;
  text: NametagTextConfig;
}

export interface NametagTemplate {
  data: NametagTemplateData;
  assets: { canvasImage: pkg.Image; previewAsset: RobloxAsset };
}

// Internal type for drawTextWithCustomCharacters
interface LoadedCharData {
  img: pkg.Image | null; // Null if it's a spacing placeholder
  width: number;
  height: number;
  originalChar: string;
  isSpacingPlaceholder: boolean;
}

// --- Helper Functions ---

function sanitiseNametagString(text: string): string {
  return text.replace(/[^a-zA-Z0-9\+]/g, "_");
}

async function drawTextWithCustomCharacters(
  ctx: pkg.CanvasRenderingContext2D,
  textToRender: string,
  config: NametagTextConfig
): Promise<number> {
  if (!config.customCharacterStyle) {
    console.warn(
      "drawTextWithCustomCharacters called without customCharacterStyle."
    );
    return 0;
  }

  const style = config.customCharacterStyle;
  const dir = style.directory;
  const targetHeight = style.targetHeight; // This is the height for actual images
  const interElementSpacing = style.spacing; // Renamed for clarity, used between any two elements
  const extension = style.extension || ".png";
  const caseSensitive = style.caseSensitiveFileNames || false;
  const charMap = style.characterMap || {};

  const loadedElements: LoadedCharData[] = [];
  let cumulativeWidthOfElements = 0;

  for (const char of textToRender) {
    let charFilenameCandidate = caseSensitive ? char : char.toLowerCase();
    if (charMap[char]) {
      charFilenameCandidate = charMap[char];
    } else if (!caseSensitive && charMap[char.toLowerCase()]) {
      charFilenameCandidate = charMap[char.toLowerCase()];
    }

    const imagePath = path.join(dir, `${charFilenameCandidate}${extension}`);
    let elementProcessed = false;

    try {
      if (fs.existsSync(imagePath)) {
        const img = await loadImage(imagePath);
        const aspectRatio = img.width / img.height;
        const scaledWidth = style.targetHeight * aspectRatio; // Use style.targetHeight for actual images
        loadedElements.push({
          img,
          width: scaledWidth,
          height: style.targetHeight,
          originalChar: char,
          isSpacingPlaceholder: false,
        });
        cumulativeWidthOfElements += scaledWidth;
        elementProcessed = true;
      } else {
        // Primary image not found, try fallback character image
        if (
          style.fallbackChar &&
          charFilenameCandidate !== style.fallbackChar
        ) {
          const fallbackImagePath = path.join(
            dir,
            `${style.fallbackChar}${extension}`
          );
          if (fs.existsSync(fallbackImagePath)) {
            console.warn(
              `Character image for '${char}' (path: ${imagePath}) not found. Using fallback '${style.fallbackChar}'.`
            );
            const img = await loadImage(fallbackImagePath);
            const aspectRatio = img.width / img.height;
            const scaledWidth = style.targetHeight * aspectRatio;
            loadedElements.push({
              img,
              width: scaledWidth,
              height: style.targetHeight,
              originalChar: char,
              isSpacingPlaceholder: false,
            });
            cumulativeWidthOfElements += scaledWidth;
            elementProcessed = true;
          }
        }

        // If not processed by primary or fallback image, try default spacing
        if (!elementProcessed) {
          if (
            style.missingCharacterSpacing &&
            style.missingCharacterSpacing > 0
          ) {
            console.warn(
              `Character image for '${char}' (path: ${imagePath}) and fallback not found. Using default spacing: ${style.missingCharacterSpacing}px.`
            );
            loadedElements.push({
              img: null,
              width: style.missingCharacterSpacing,
              height: style.targetHeight, // Keep height consistent for vertical alignment logic
              originalChar: char,
              isSpacingPlaceholder: true,
            });
            cumulativeWidthOfElements += style.missingCharacterSpacing;
            elementProcessed = true; // Mark as processed by spacing
          } else {
            console.warn(
              `Character image for '${char}' (path: ${imagePath}), fallback, and default spacing not configured. Skipping char visuals and width contribution.`
            );
            // Character contributes no width and no visual if this branch is hit
          }
        }
      }
    } catch (err) {
      console.error(
        `Error processing character '${char}' (intended path: ${imagePath}):`,
        err
      );
      // If error occurs during loading, attempt to use missingCharacterSpacing as a last resort
      if (style.missingCharacterSpacing && style.missingCharacterSpacing > 0) {
        console.warn(
          `Due to error, using default spacing for '${char}': ${style.missingCharacterSpacing}px.`
        );
        loadedElements.push({
          img: null,
          width: style.missingCharacterSpacing,
          height: style.targetHeight,
          originalChar: char,
          isSpacingPlaceholder: true,
        });
        cumulativeWidthOfElements += style.missingCharacterSpacing;
      } else {
        console.warn(
          `Due to error and no default spacing for '${char}', character will have no visual or width contribution.`
        );
      }
    }
  }

  if (loadedElements.length === 0) return 0;

  const totalInterElementGaps =
    loadedElements.length > 0
      ? (loadedElements.length - 1) * interElementSpacing
      : 0;
  let totalRenderedWidth = cumulativeWidthOfElements + totalInterElementGaps;

  let scaleFactor = 1;
  if (
    config.maxWidth > 0 &&
    totalRenderedWidth > config.maxWidth &&
    totalRenderedWidth > 0
  ) {
    // Added totalRenderedWidth > 0 to prevent division by zero
    scaleFactor = config.maxWidth / totalRenderedWidth;
  }

  const finalScaledTotalWidth = totalRenderedWidth * scaleFactor;
  let currentDrawX = config.anchorPoint[0] - finalScaledTotalWidth / 2;

  for (let i = 0; i < loadedElements.length; i++) {
    const element = loadedElements[i];
    const scaledElementWidth = element.width * scaleFactor;
    const scaledElementHeight = element.height * scaleFactor; // Height is also scaled
    // Vertical position for each element, ensuring it's centered around the anchorPoint's Y
    const drawY = config.anchorPoint[1] - scaledElementHeight / 2;

    if (!element.isSpacingPlaceholder && element.img) {
      ctx.drawImage(
        element.img,
        currentDrawX,
        drawY,
        scaledElementWidth,
        scaledElementHeight
      );
    }
    // If it's a spacing placeholder, its width is still accounted for.

    currentDrawX += scaledElementWidth;
    if (i < loadedElements.length - 1) {
      // Add spacing if not the last element
      currentDrawX += interElementSpacing * scaleFactor;
    }
  }
  return finalScaledTotalWidth;
}

export async function createNametagImageBuffer(
  template: NametagTemplate,
  name: string,
  additionalAssets: RobloxAsset[] = []
): Promise<Buffer> {
  const canvas = createCanvas(128, 128);
  const ctx = canvas.getContext("2d");
  const templateAssets = template.assets;
  const textConfig = template.data.text;
  const [x, y] = textConfig.anchorPoint;

  ctx.imageSmoothingEnabled = false;

  for (const asset of additionalAssets) {
    try {
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
    } catch (error) {
      console.error(
        `Error loading or drawing additional asset (type: ${asset.type}):`,
        error
      );
    }
  }

  if (templateAssets.canvasImage) {
    try {
      ctx.drawImage(templateAssets.canvasImage, 0, 0);
    } catch (error) {
      console.error("Error drawing template canvasImage:", error);
    }
  } else {
    console.warn("Template is missing canvasImage asset.");
  }

  const nameForDisplay = name;

  if (
    textConfig.customCharacterStyle &&
    textConfig.customCharacterStyle.directory &&
    fs.existsSync(textConfig.customCharacterStyle.directory)
  ) {
    console.log(
      `Using custom characters for: "${nameForDisplay}" from ${textConfig.customCharacterStyle.directory}`
    );
    await drawTextWithCustomCharacters(
      ctx,
      nameForDisplay.toUpperCase(),
      textConfig
    );
  } else {
    if (
      textConfig.customCharacterStyle &&
      textConfig.customCharacterStyle.directory
    ) {
      console.warn(
        `Custom character directory ${textConfig.customCharacterStyle.directory} not found. Falling back to fillText.`
      );
    } else {
      console.log(`Using fillText for: "${nameForDisplay}"`);
    }
    ctx.font = `${textConfig.font.size} "${textConfig.font.family}"`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = textConfig.colour;
    ctx.fillText(
      nameForDisplay.toUpperCase(),
      x,
      y,
      textConfig.maxWidth > 0 ? textConfig.maxWidth : undefined
    );
  }

  ctx.imageSmoothingEnabled = false;
  return canvas.toBuffer("image/png");
}

export async function createNametag(
  name: string,
  templateIndex: number = 0,
  preview: boolean = false,
  tShirtIDs: number[] = []
): Promise<Buffer | null> {
  try {
    const template = await getTemplateFromIndex(templateIndex);
    if (!template) {
      console.error(`Template with index ${templateIndex} not found.`);
      return null;
    }

    const additionalAssets: RobloxAsset[] = [];

    if (preview && template.assets.previewAsset) {
      additionalAssets.push(template.assets.previewAsset);
    }

    if (tShirtIDs.length > 0) {
      const assetPromises = tShirtIDs.map((id) => getAssetFromId(id));
      const settledAssets = await Promise.allSettled(assetPromises);

      settledAssets.forEach((promise) => {
        if (promise.status === "fulfilled" && promise.value) {
          additionalAssets.push(promise.value);
        } else if (promise.status === "rejected") {
          console.warn("Failed to load a t-shirt asset:", promise.reason);
        }
      });
    }
    return createNametagImageBuffer(template, name, additionalAssets);
  } catch (error) {
    console.error("Error in createNametag:", error);
    return null;
  }
}

export async function getTemplateFromIndex(
  index: number = 0
): Promise<NametagTemplate | undefined> {
  const allTemplates = await getTemplates();
  if (!allTemplates || allTemplates.length === 0) {
    // Added check for empty/null templates
    console.error("No templates available.");
    return undefined;
  }
  if (index >= allTemplates.length) {
    console.warn(
      `Template index ${index} out of bounds (max: ${
        allTemplates.length - 1
      }). Using last template.`
    );
    index = allTemplates.length - 1;
  } else if (index < 0) {
    console.warn(`Template index ${index} is negative. Using first template.`);
    index = 0;
  }
  return allTemplates[index];
}

export async function getTemplates(): Promise<NametagTemplate[]> {
  const typedTemplates = templatesFromFile as any[];
  // Example of loading if canvasImage is a path and not pre-loaded:
  // This assumes that if canvasImage is a string, it's a path to be loaded.
  // And if it's already an Image object, it's used directly.
  // This part is crucial and depends on how templatesFromFile is structured.
  const loadedTemplates: NametagTemplate[] = [];
  if (typedTemplates && Array.isArray(typedTemplates)) {
    for (const t of typedTemplates) {
      if (t.assets && typeof t.assets.canvasImage === "string") {
        try {
          // Create a mutable copy to modify
          const templateCopy = JSON.parse(JSON.stringify(t));
          templateCopy.assets.canvasImage = await loadImage(
            t.assets.canvasImage
          );
          loadedTemplates.push(templateCopy as NametagTemplate);
        } catch (e) {
          console.error(
            `Failed to load canvasImage for template ${
              t.data?.name || "Unknown"
            }: ${t.assets.canvasImage}`,
            e
          );
          // Decide how to handle: skip template, use placeholder, etc.
          // For now, let's assume we add it as is, and drawing will fail later if image is crucial.
          loadedTemplates.push(t as NametagTemplate);
        }
      } else if (t.assets && t.assets.canvasImage) {
        // It might already be an Image object
        loadedTemplates.push(t as NametagTemplate);
      } else {
        // Handle templates missing assets or canvasImage
        console.warn(
          `Template ${
            t.data?.name || "Unknown"
          } is missing assets.canvasImage or assets itself.`
        );
        loadedTemplates.push(t as NametagTemplate); // Add as is, issues might arise later
      }
    }
    return loadedTemplates;
  }
  return []; // Return empty array if templatesFromFile is not as expected
}
