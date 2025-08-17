import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"], // ESM only
  dts: true, // generate .d.ts
  sourcemap: true,
  clean: true,
  target: "esnext", // Cloudflare Workers = modern V8
  minify: false, // optional, but not needed for a lib
});
