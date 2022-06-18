import * as csso from 'csso';
import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import virtual from '@rollup/plugin-virtual';
import copy from 'rollup-plugin-copy';
import del from 'rollup-plugin-delete';
import minifyHTML from 'rollup-plugin-minify-html-literals';
import execute from 'rollup-plugin-shell';
import { fs, glob, path } from 'zx';
import { extname } from 'path';
import { terser } from 'rollup-plugin-terser';
import { importAssertions } from 'acorn-import-assertions';
import { idiomaticDecoratorsTransformer, constructorCleanupTransformer } from '@lit/ts-transformers';
import { fileURLToPath } from 'url';
import { importAssertionsPlugin } from './import-assert.mjs';
// import { importAssertionsPlugin } from 'rollup-plugin-import-assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let userConfig = { };
if (process.env.BLUEPRINTUI_CONFIG) {
  userConfig = await import(process.env.BLUEPRINTUI_CONFIG);
}

const config = {
  externals: [],
  assets: ['./README.md', './LICENSE', './package.json'],
  baseDir: './src',
  outDir: './dist/lib',
  entryPoints: ['./src/**/index.ts', './src/include/*.ts'],
  tsconfig: './tsconfig.lib.json',
  customElementsManifestConfig: './custom-elements-manifest.config.mjs',
  sourcemap: false,
  ...userConfig.default?.library
};

const cwd = process.cwd();
const project = {
  externals: config.externals,
  packageFile: path.resolve(cwd, './package.json'),
  assets: config.assets.map(a => path.resolve(cwd, a)),
  baseDir: path.resolve(cwd, config.baseDir),
  outDir: path.resolve(cwd, config.outDir),
  entryPoints: config.entryPoints.map(e => path.resolve(cwd, e)),
  tsconfig: path.resolve(cwd, config.tsconfig),
  customElementsManifestConfig: path.resolve(__dirname, config.customElementsManifestConfig),
  prod: process.env.BLUEPRINTUI_BUILD === 'production',
  sourcemap: config.sourcemap
}

export default [
  {
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
    acornInjectPlugins: [importAssertions],
    plugins: [
      // del({ targets: [project.outDir], hook: 'buildStart', runOnce: true }),
      copyAssets(),
      project.prod ? cssOptimize() : [],
      importAssertionsPlugin(),
      createEntrypoints(),
      nodeResolve({ exportConditions: [project.prod ? 'production' : 'development'] }),
      compileTypescript(),
      project.prod ? [] : typeCheck(),
      project.prod ? [] : writeCache(),
      project.prod ? minifyHTML.default() : [],
      project.prod ? minifyJavaScript() : [],
      project.prod ? inlinePackageVersion() : [],
      project.prod ? postClean(): [],
      project.prod ? packageCheck() : [],
      // project.prod ? customElementsAnalyzer() : [],
    ],
  },
];

function copyAssets() {
  return copy({ copyOnce: true, targets: project.assets.map(src => ({ src, dest: config.outDir }))});
}

function createEntrypoints() {
  return virtual({ 'library-entry-points': [...project.entryPoints.flatMap(i => glob.globbySync(i))].map(entry => `export * from '${entry}';`).join('\n') });
}

function compileTypescript() {
  return typescript({
    tsconfig: project.tsconfig,
    noEmitOnError: project.prod,
    compilerOptions: { sourceMap: project.sourcemap },
    transformers: {
      before: [{ type: 'program', factory: idiomaticDecoratorsTransformer }],
      after: [{ type: 'program', factory: constructorCleanupTransformer }],
    }
  });
}

function typeCheck() {
  return execute({ commands: [`tsc --noEmit --project ${project.tsconfig}`], hook: 'buildEnd' });
}

function minifyJavaScript() {
  return terser({ ecma: 2022, module: true, format: { comments: false }, compress: { passes: 2, unsafe: true } });
}

function inlinePackageVersion() {
  return replace({ preventAssignment: false, values: { PACKAGE_VERSION: fs.readJsonSync(project.packageFile).version } })
}

function postClean() {
  return del({ targets: [`${project.outDir}/**/.tsbuildinfo`, `${project.outDir}/**/_virtual`], hook: 'writeBundle' });
}

function packageCheck() {
  return execute({ commands: [`package-check --cwd ${project.outDir}`], sync: true, hook: 'writeBundle' });
};

function customElementsAnalyzer() {
  let copied = false;
  return {
    name: 'custom-elements-analyzer',
    writeBundle: async () => {
      if (copied) {
        return;
      } else {
        await $`cem analyze --config ${project.customElementsManifestConfig}`;
        const json = await fs.readJson(project.packageFile);
        const packageFile = { ...json, customElements: './custom-elements.json', scripts: undefined, devDependencies: undefined };
        await fs.writeFile(`${project.outDir}/package.json`, JSON.stringify(packageFile, null, 2));
      }
    }
  };
}

function cssOptimize() {
  return {
    load(id) { return id.slice(-4) === '.css' ? this.addWatchFile(path.resolve(id)) : null },
    transform: async (css, id) => id.slice(-4) === '.css' ? ({ code: csso.minify(css, { comments: false }).css, map: { mappings: '' } }) : null
  };
};

const fileCache = {};
/**
 * Rollup plugin for local file writes
 * Compares the output of rollup to the current file on disk. If same it will
 * prevent rollup from writting to the file again preventing file watchers from being triggered
 */
function writeCache() {
  return {
    name: 'esm-cache',
    generateBundle(_options, bundles) {
      for (const [key, bundle] of Object.entries(bundles)) {
        const path = `${project.outDir}/${bundle.fileName}`;

        if (extname(path) === '.js' && fileCache[path] !== bundle.code) {
          fileCache[path] = bundle.code;
        } else {
          delete bundles[key];
        }
      }
    },
  };
};
