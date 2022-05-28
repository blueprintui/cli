// import { readonlyPlugin } from 'cem-plugin-readonly';
import { resolve } from 'path';

const cwd = process.cwd();

export default {
  globs: [resolve(cwd, './src/**/element.ts')],
  outdir: './dist/lib',
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

export function baseDir(config = { baseDir: 'src' }) {
  return {
    name: 'base-dir',
    packageLinkPhase({ customElementsManifest }) {
      customElementsManifest.modules = JSON.parse(
        JSON.stringify(customElementsManifest.modules).replaceAll(`"/${config.baseDir}/`, '"').replaceAll(`"${config.baseDir}/`, '"')
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
