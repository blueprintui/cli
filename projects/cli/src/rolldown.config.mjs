import typescript from '@rollup/plugin-typescript';
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

const config = await getUserConfig();
const cwd = process.cwd();
const project = {
  externals: config.externals,
  packageJSON: fs.readJsonSync(path.resolve(cwd, './package.json')),
  assets: config.assets.map(a => path.resolve(cwd, a)),
  baseDir: path.resolve(cwd, config.baseDir),
  outDir: path.resolve(cwd, config.outDir),
  entryPoints: config.entryPoints.map(e => path.resolve(cwd, e)),
  tsconfig: path.resolve(cwd, config.tsconfig),
  customElementsManifestConfig: config.customElementsManifestConfig ? path.resolve(cwd, config.customElementsManifestConfig) :  path.resolve(__dirname, './custom-elements-manifest.config.mjs'),
  prod: process.env.BLUEPRINTUI_BUILD === 'production',
  sourcemap: config.sourcemap
};

const entryFiles = [...project.entryPoints.flatMap(i => glob.globbySync(i))];
const input = Object.fromEntries(
  entryFiles.map(entry => {
    const rel = path.relative(path.resolve(cwd, config.baseDir), entry);
    const name = rel.replace(/\.ts$/, '');
    return [name, entry];
  })
);

export default [
  {
    external: project.externals,
    input,
    treeshake: false,
    preserveEntrySignatures: 'strict',
    resolve: {
      conditionNames: ['import', 'module', project.prod ? 'production' : 'development', 'default'],
    },
    output: {
      format: 'esm',
      dir: project.outDir,
      preserveModules: true,
      preserveModulesRoot: path.resolve(cwd, config.baseDir),
      sourcemap: project.sourcemap,
      entryFileNames: (chunkInfo) => {
        if (chunkInfo.facadeModuleId?.endsWith('.css')) {
          return '[name].css.js';
        }
        return '[name].js';
      }
    },
    plugins: [
      project.prod ? cleanOutDir() : [],
      css({ minify: project.prod }),
      copyAssets(),
      compileTypescript(),
      project.prod ? [] : writeCache(project),
      project.prod ? minifyHTML() : [],
      project.prod ? minifyJavaScript() : [],
      project.prod ? inlinePackageVersion() : [],
      project.prod ? postClean(): [],
      project.prod ? customElementsAnalyzer(project) : []
    ],
  },
];

function cleanOutDir() {
  return {
    name: 'clean-out-dir',
    async buildStart() {
      await fs.rm(project.outDir, { recursive: true, force: true });
    }
  };
}

function copyAssets() {
  return {
    name: 'copy-assets',
    async buildStart() {
      for (const src of project.assets) {
        const dest = path.resolve(cwd, config.outDir, path.basename(src));
        await fs.cp(src, dest, { recursive: true });
      }
    }
  };
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
  return {
    name: 'inline-package-version',
    transform(code) {
      if (code.includes('PACKAGE_VERSION')) {
        return { code: code.replaceAll('PACKAGE_VERSION', project.packageJSON.version), map: null };
      }
    }
  };
}

function postClean() {
  return {
    name: 'post-clean',
    async writeBundle() {
      const tsbuildinfo = glob.globbySync(`${project.outDir}/**/.tsbuildinfo`);
      for (const file of tsbuildinfo) {
        await fs.rm(file, { recursive: true, force: true });
      }
    }
  };
}
