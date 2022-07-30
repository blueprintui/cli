import { $, path } from 'zx';

export async function runCustomElementsAnalyzer(customElementsManifestConfig) {
  const cemPath = path.resolve('node_modules', '@custom-elements-manifest/analyzer/index.js');
  $.verbose = false;
  return await $`${cemPath} analyze --config ${customElementsManifestConfig} --quiet`;
}

export async function getUserConfig() {
  let userConfig = { };
  if (process.env.BLUEPRINTUI_CONFIG) {
    userConfig = await import(process.env.BLUEPRINTUI_CONFIG);
  }

  return {
    externals: [],
    assets: ['./README.md', './LICENSE.md', './package.json'],
    customElementsManifestLockFile: './custom-elements.lock.json',
    baseDir: './src',
    outDir: './dist/lib',
    entryPoints: ['./src/**/index.ts'],
    tsconfig: './tsconfig.lib.json',
    sourcemap: false,
    ...userConfig.default?.library
  };
}