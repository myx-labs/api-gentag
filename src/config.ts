import { config as config_env } from "dotenv-safe";
config_env();

export default {
  api: {
    port: parseInt(process.env.API_PORT) as number,
    key: process.env.AUTHENTICATION_KEY as string,
  },
};
