// Global config
import config from "./config.js";

// Modules
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { fileTypeFromBuffer } from "file-type";

// Classes
import {
  createNametag,
  getTemplateFromIndex,
  getTemplates,
} from "./nametag.js";

// Variables
const router = fastify({ logger: true, trustProxy: "127.0.0.1" });
const port: number = config.api.port;

router.register(fastifyCors, {
  origin: [
    /localhost/,
    /127.0.0.1/,
    /yan3321.com/,
    /yan.gg/,
    /gentag.pages.dev/,
  ],
});

router.get("/example", async (req, res) => {
  return { message: "yeet" };
});

interface nameRequestParams {
  name: string;
}

interface indexRequestParams {
  index: number;
  name: string;
}
interface indexNameRequestQueryParams {
  tShirtIDs: string;
}

interface indexNameRequestParams {
  index: number;
  name: string;
}

interface idRequestParams {
  id: number;
}

router.get<{ Params: nameRequestParams }>(
  "/nametag/options",
  async (req, res) => {
    try {
      const templates = await getTemplates();
      return templates.map((item) => item.data);
    } catch (error) {
      if (error instanceof Error) {
        res.status(500);
        return { error: error.message };
      } else {
        res.status(500);
        return { error: "Unknown error occured" };
      }
    }
  }
);

router.get<{
  Params: nameRequestParams;
}>("/nametag/:name", async (req, res) => {
  try {
    const name: string = req.params.name as any;
    const imageBuffer = await createNametag(name);
    const fileType = await fileTypeFromBuffer(imageBuffer);
    if (typeof fileType === "undefined") {
      throw new Error("Unable to infer file type!");
    }
    res.header("Content-Type", fileType.mime);
    res.header("Cache-Control", "public");
    return imageBuffer;
  } catch (error) {
    if (error instanceof Error) {
      res.status(500);
      return { error: error.message };
    } else {
      res.status(500);
      return { error: "Unknown error occured" };
    }
  }
});

router.get<{
  Params: indexNameRequestParams;
  Querystring: indexNameRequestQueryParams;
}>("/nametag/create/:index/:name", async (req, res) => {
  try {
    const name: string = req.params.name;
    const index: number = req.params.index;
    const tShirtIDs: number[] = [];
    try {
      const parsedIDs = JSON.parse(req.query.tShirtIDs);
      for (const id of parsedIDs) {
        tShirtIDs.push(id);
      }
    } catch (error) {}
    const imageBuffer = await createNametag(name, index, false, tShirtIDs);
    const fileType = await fileTypeFromBuffer(imageBuffer);
    if (typeof fileType === "undefined") {
      throw new Error("Unable to infer file type!");
    }
    res.header("Content-Type", fileType.mime);
    res.header("Cache-Control", "public");
    return imageBuffer;
  } catch (error) {
    if (error instanceof Error) {
      res.status(500);
      return { error: error.message };
    } else {
      res.status(500);
      return { error: "Unknown error occured" };
    }
  }
});

router.get<{
  Params: indexNameRequestParams;
  Querystring: indexNameRequestQueryParams;
}>("/nametag/preview/:index/:name", async (req, res) => {
  try {
    const name: string = req.params.name;
    const index: number = req.params.index;
    const tShirtIDs: number[] = [];
    try {
      const parsedIDs = JSON.parse(req.query.tShirtIDs);
      for (const id of parsedIDs) {
        tShirtIDs.push(id);
      }
    } catch (error) {}
    const imageBuffer = await createNametag(name, index, true, tShirtIDs);
    const fileType = await fileTypeFromBuffer(imageBuffer);
    if (typeof fileType === "undefined") {
      throw new Error("Unable to infer file type!");
    }
    res.header("Content-Type", fileType.mime);
    res.header("Cache-Control", "public");
    return imageBuffer;
  } catch (error) {
    if (error instanceof Error) {
      res.status(500);
      return { error: error.message };
    } else {
      res.status(500);
      return { error: "Unknown error occured" };
    }
  }
});

router.get<{ Params: indexRequestParams }>(
  "/nametag/data/:index",
  async (req, res) => {
    try {
      const index: number = req.params.index;
      const template = await getTemplateFromIndex(index);
      return template;
    } catch (error) {
      if (error instanceof Error) {
        res.status(500);
        return { error: error.message };
      } else {
        res.status(500);
        return { error: "Unknown error occured" };
      }
    }
  }
);

export async function startAPI() {
  const url = await router.listen(port);
  console.log(`Listening on ${url}`);
}
