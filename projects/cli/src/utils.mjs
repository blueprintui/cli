import { cli } from '@custom-elements-manifest/analyzer/cli.js';

export async function runCustomElementsAnalyzer(customElementsManifestConfig) {
  // disable noisy log output from custom-elements-manifest analyzer
  const log = console.log;
  console.log = () => {};
  try {
    return await cli({ argv: ['analyze', '--quiet', '--config', customElementsManifestConfig] });
  } finally {
    console.log = log;
  }
}

export async function getUserConfig() {
  let userConfig = { };
  if (process.env.BLUEPRINTUI_CONFIG) {
    userConfig = await import(process.env.BLUEPRINTUI_CONFIG);
  }

  return {
    externals: [],
    assets: [],
    customElementsManifestLockFile: './custom-elements.lock.json',
    baseDir: './src',
    outDir: './dist',
    entryPoints: ['./src/**/index.ts'],
    tsconfig: './tsconfig.lib.json',
    sourcemap: false,
    ...userConfig.default?.library
  };
}