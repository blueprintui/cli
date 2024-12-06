import defu from 'defu';
import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import virtual from '@rollup/plugin-virtual';
import copy from 'rollup-plugin-copy';
import del from 'rollup-plugin-delete';
import { fs, glob, path } from 'zx';
import { idiomaticDecoratorsTransformer, constructorCleanupTransformer } from '@lit/ts-transformers';
import { fileURLToPath } from 'url';
import { css } from './plugin-minify-css.mjs';
import { minifyHTML } from './plugin-minify-html-literals.mjs';
import { minifyJavaScript } from './plugin-minify-javascript.mjs';
import { customElementsAnalyzer } from './plugin-custom-elements-analyzer.mjs';
import { writeCache } from './plugin-esm-cache.mjs';
import { getUserConfig } from './utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userConfig = await getUserConfig();
const cwd = process.cwd();
const project = {
  externals: userConfig.externals,
  packageJSON: fs.readJsonSync(path.resolve(cwd, './package.json')),
  assets: userConfig.assets.map(a => path.resolve(cwd, a)),
  baseDir: path.resolve(cwd, userConfig.baseDir),
  outDir: path.resolve(cwd, userConfig.outDir),
  entryPoints: userConfig.entryPoints.map(e => path.resolve(cwd, e)),
  tsconfig: path.resolve(cwd, userConfig.tsconfig),
  customElementsManifestConfig: userConfig.customElementsManifestConfig ? path.resolve(cwd, userConfig.customElementsManifestConfig) :  path.resolve(__dirname, './custom-elements-manifest.config.mjs'),
  prod: process.env.BLUEPRINTUI_BUILD === 'production',
  sourcemap: userConfig.sourcemap,
  rollupOptions: userConfig.rollupOptions
};

const defaultConfig = {
  external: project.externals,
  input: 'library-entry-points',
  treeshake: false,
  preserveEntrySignatures: 'strict',
  output: {
    format: 'esm',
    dir: project.outDir,
    preserveModules: true,
    sourcemap: project.sourcemap,
    sourcemapExcludeSources: true
  },
  plugins: [
    project.prod ? cleanOutDir() : [],
    css({ minify: project.prod }),
    copyAssets(),
    createEntrypoints(),
    nodeResolve({ exportConditions: [project.prod ? 'production' : 'development'] }),
    compileTypescript(),
    project.prod ? [] : writeCache(project),
    project.prod ? minifyHTML() : [],
    project.prod ? minifyJavaScript() : [],
    project.prod ? inlinePackageVersion() : [],
    project.prod ? postClean(): [],
    project.prod ? customElementsAnalyzer(project) : []
  ],
};

const config = defu(project.rollupOptions, defaultConfig);

export default [
  config,
];

function cleanOutDir() {
  return del({ targets: [project.outDir], hook: 'buildStart', runOnce: true });
}

function copyAssets() {
  return copy({ copyOnce: true, targets: project.assets.map(src => ({ src, dest: userConfig.outDir }))});
}

function createEntrypoints() {
  return virtual({ 'library-entry-points': [...project.entryPoints.flatMap(i => glob.globbySync(i))].map(entry => `export * from '${entry}';`).join('\n') });
}

function compileTypescript() {
  return typescript({
    cacheDir: path.resolve(__dirname, '.rollup.cache', project.packageJSON.name),
    tsconfig: project.tsconfig,
    noEmitOnError: project.prod,
    compilerOptions: { sourceMap: project.sourcemap },
    transformers: {
      before: [{ type: 'program', factory: idiomaticDecoratorsTransformer }],
      after: [{ type: 'program', factory: constructorCleanupTransformer }],
    }
  });
}

function inlinePackageVersion() {
  return replace({ preventAssignment: false, values: { PACKAGE_VERSION: project.packageJSON.version } });
}

function postClean() {
  return del({ targets: [`${project.outDir}/**/.tsbuildinfo`, `${project.outDir}/**/_virtual`], hook: 'writeBundle' });
}
