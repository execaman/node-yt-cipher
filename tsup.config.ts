import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  entry: ["src/index.ts"],
  experimentalDts: false,
  format: ["esm"],
  minify: false,
  outDir: "lib",
  platform: "node",
  removeNodeProtocol: false,
  skipNodeModulesBundle: true,
  target: "esnext",
  treeshake: true,
});
