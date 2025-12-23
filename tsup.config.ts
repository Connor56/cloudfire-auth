import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"], // The entry point of the library
  format: ["esm"], // ESM only
  dts: true, // generate .d.ts
  clean: true, // Remove all files in the output directory before rebuilding
  target: "esnext", // Cloudflare Workers = modern V8
  minify: false, // optional, but not needed for a lib
});
