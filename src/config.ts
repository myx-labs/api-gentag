import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();

export default {
  api: {
    port:
      typeof process.env.API_PORT !== "undefined"
        ? parseInt(process.env.API_PORT)
        : 3000,
    key: process.env.AUTHENTICATION_KEY as string,
  },
};
