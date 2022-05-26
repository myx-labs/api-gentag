import { config as config_env } from "dotenv-safe";
config_env();

export default {
  api: {
    port:
      typeof process.env.API_PORT !== "undefined"
        ? parseInt(process.env.API_PORT)
        : 3000,
    key: process.env.AUTHENTICATION_KEY as string,
  },
};
