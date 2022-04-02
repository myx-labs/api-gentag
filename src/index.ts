// Global config
import { startAPI } from "./express.js";

async function bootstrap() {
  await startAPI();
}

(async () => {
  await bootstrap();
})();
