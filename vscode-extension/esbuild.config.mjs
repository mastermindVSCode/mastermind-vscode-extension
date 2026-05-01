import esbuild from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: false,
  minify: true,
  external: ['vscode'],
  logLevel: 'warning',
};

await esbuild.build({
  ...common,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
});

await esbuild.build({
  ...common,
  entryPoints: ['src/client.ts'],
  outfile: 'dist/client.js',
});

await esbuild.build({
  ...common,
  entryPoints: ['src/lsp/server.ts'],
  outfile: 'dist/lsp/server.js',
});

