// import { readonlyPlugin } from 'cem-plugin-readonly';
import { resolve } from 'path';

const cwd = process.cwd();
const baseSrc = resolve(cwd, 'src');

let userConfig = { };
if (process.env.BLUEPRINTUI_CONFIG) {
  userConfig = await import(process.env.BLUEPRINTUI_CONFIG);
}

const config = {
  baseDir: './src',
  outDir: './dist/lib',
  ...userConfig?.default?.library
};

export default {
  globs: [resolve(cwd, config.baseDir)],
  outdir: config.outDir,
  litelement: true,
  plugins: [tsExtensionPlugin(), baseDir(), orderElements()],
};

export function orderElements() {
  return {
    name: 'order-elements',
    packageLinkPhase({ customElementsManifest }) {
      customElementsManifest.modules.sort((a, b) => (a.path < b.path ? -1 : 1));
    },
  };
}

export function baseDir() {
  return {
    name: 'base-dir',
    packageLinkPhase({ customElementsManifest }) {
      customElementsManifest.modules = JSON.parse(
        JSON.stringify(customElementsManifest.modules).replaceAll(`"/${baseSrc}`, '"').replaceAll(`"${baseSrc}`, '"')
      );
    },
  };
}

export function tsExtensionPlugin() {
  return {
    name: 'ts-extensions',
    packageLinkPhase({ customElementsManifest }) {
      customElementsManifest.modules = JSON.parse(JSON.stringify(customElementsManifest.modules).replace(/\.ts"/g, '.js"'));
    },
  };
}
