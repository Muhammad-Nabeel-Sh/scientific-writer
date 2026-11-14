import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Plain Vite config for build scripts run with vite-node:
//   npx vite-node -c scripts/vite.config.ts scripts/<script>.ts
// (only the $lib alias from SvelteKit is needed).
export default defineConfig({
  resolve: { alias: { $lib: fileURLToPath(new URL('../src/lib', import.meta.url)) } },
});
