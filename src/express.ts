// Global config
import config from "./config.js";

// Modules
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { fileTypeFromBuffer } from "file-type";

// Classes
import {
  createNametag,
  getTemplateFromIndex,
  getTemplates,
} from "./nametag.js";

// Variables
const router = fastify({
  trustProxy: true,
}).withTypeProvider<TypeBoxTypeProvider>();
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

router.get("/nametag/options", async (req, res) => {
  try {
    const templates = await getTemplates();
    return templates.map((item) => item.data);
  } catch (error) {
    res.status(500);
    return {
      error: error instanceof Error ? error.message : "Unknown error occured",
    };
  }
});

router.get(
  "/nametag/:name",
  {
    schema: {
      params: Type.Strict(
        Type.Object({
          name: Type.String(),
        })
      ),
    },
  },
  async (req, res) => {
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
      res.status(500);
      return {
        error: error instanceof Error ? error.message : "Unknown error occured",
      };
    }
  }
);

function parseLegacyShirtIDs(jsonString: string | undefined) {
  const ids: number[] = [];
  try {
    if (jsonString) {
      const parsedIDs = JSON.parse(jsonString);
      for (const id of parsedIDs) {
        if (typeof id === "number") {
          ids.push(id);
        }
      }
    }
  } catch (error) {}
  return ids;
}

router.get(
  "/nametag/create/:index/:name",
  {
    schema: {
      params: Type.Strict(
        Type.Object({
          name: Type.String(),
          index: Type.Number(),
        })
      ),
      querystring: Type.Strict(
        Type.Object({
          tShirtIDs: Type.Optional(Type.String()),
          assetId: Type.Optional(Type.Array(Type.Number())),
        })
      ),
    },
  },
  async (req, res) => {
    try {
      const name: string = req.params.name;
      const index: number = req.params.index;
      const tShirtIDs: number[] = [];
      // new shirt ID query format (?assetId=1&assetId=2)
      const assetIDs = req.query.assetId;
      if (assetIDs) {
        for (const id of assetIDs) {
          tShirtIDs.push(id);
        }
      }
      // legacy shirt ID support (?tShirtIDs=[1,2])
      const parsedIDs = parseLegacyShirtIDs(req.query.tShirtIDs);
      for (const id of parsedIDs) {
        tShirtIDs.push(id);
      }
      const imageBuffer = await createNametag(name, index, false, tShirtIDs);
      const fileType = await fileTypeFromBuffer(imageBuffer);
      if (typeof fileType === "undefined") {
        throw new Error("Unable to infer file type!");
      }
      res.header("Content-Type", fileType.mime);
      res.header("Cache-Control", "public");
      console.log({
        name: name,
        index: index,
        assetIDs: tShirtIDs,
        path: req.url,
        ip: req.ip,
      });
      return imageBuffer;
    } catch (error) {
      res.status(500);
      return {
        error: error instanceof Error ? error.message : "Unknown error occured",
      };
    }
  }
);

router.get(
  "/nametag/preview/:index/:name",
  {
    schema: {
      params: Type.Strict(
        Type.Object({
          name: Type.String(),
          index: Type.Number(),
        })
      ),
      querystring: Type.Strict(
        Type.Object({
          tShirtIDs: Type.Optional(Type.String()),
          assetId: Type.Optional(Type.Array(Type.Number())),
        })
      ),
    },
  },
  async (req, res) => {
    try {
      const name: string = req.params.name;
      const index: number = req.params.index;
      const tShirtIDs: number[] = [];
      // new shirt ID query format (?assetId=1&assetId=2)
      const assetIDs = req.query.assetId;
      if (assetIDs) {
        for (const id of assetIDs) {
          tShirtIDs.push(id);
        }
      }
      // legacy shirt ID support (?tShirtIDs=[1,2])
      const parsedIDs = parseLegacyShirtIDs(req.query.tShirtIDs);
      for (const id of parsedIDs) {
        tShirtIDs.push(id);
      }
      const imageBuffer = await createNametag(name, index, true, tShirtIDs);
      const fileType = await fileTypeFromBuffer(imageBuffer);
      if (typeof fileType === "undefined") {
        throw new Error("Unable to infer file type!");
      }
      res.header("Content-Type", fileType.mime);
      res.header("Cache-Control", "public");
      console.log({
        name: name,
        index: index,
        assetIDs: tShirtIDs,
        path: req.url,
        ip: req.ip,
      });
      return imageBuffer;
    } catch (error) {
      res.status(500);
      return {
        error: error instanceof Error ? error.message : "Unknown error occured",
      };
    }
  }
);

router.get(
  "/nametag/data/:index",
  {
    schema: {
      params: Type.Strict(
        Type.Object({
          index: Type.Number(),
        })
      ),
    },
  },
  async (req, res) => {
    try {
      const index: number = req.params.index;
      const template = await getTemplateFromIndex(index);
      return template;
    } catch (error) {
      res.status(500);
      return {
        error: error instanceof Error ? error.message : "Unknown error occured",
      };
    }
  }
);

export async function startAPI() {
  const url = await router.listen({ port: port });
  console.log(`Listening on ${url}`);
}
