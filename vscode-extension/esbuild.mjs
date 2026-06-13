import * as esbuild from "esbuild";

const dev = process.argv.includes("--dev");

const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  sourcemap: dev,
  minify: !dev,
  logLevel: "info",
  target: "node18",
  treeShaking: true,
};

/** Keep dist/client.js as a separate lazy-loaded chunk (not inlined into extension.js). */
const lazyClientExternal = {
  name: "lazy-client-external",
  setup(build) {
    build.onResolve({ filter: /^\.\/client$/ }, () => ({
      path: "./client",
      external: true,
    }));
  },
};

await esbuild.build({
  ...common,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  external: ["vscode"],
  plugins: [lazyClientExternal],
});

await esbuild.build({
  ...common,
  entryPoints: ["src/client.ts"],
  outfile: "dist/client.js",
  external: ["vscode"],
});

await esbuild.build({
  ...common,
  entryPoints: ["src/lsp/server.ts"],
  outfile: "dist/lsp/server.js",
});
