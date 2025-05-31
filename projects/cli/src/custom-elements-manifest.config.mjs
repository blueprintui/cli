import { resolve } from 'path';
import { customElementVsCodePlugin } from 'custom-element-vs-code-integration';

const cwd = process.cwd();
const baseSrc = resolve(cwd, 'src');

let userConfig = {};
if (process.env.BLUEPRINTUI_CONFIG) {
  userConfig = await import(process.env.BLUEPRINTUI_CONFIG);
}

const config = {
  baseDir: './src',
  outDir: './dist',
  ...userConfig?.default?.library
};

export default {
  globs: [resolve(cwd, config.baseDir)],
  exclude: [
    `${resolve(cwd, config.baseDir)}/**/*.test.ts`,
    `${resolve(cwd, config.baseDir)}/**/*.spec.ts`,
    `${resolve(cwd, config.baseDir)}/**/*.a11y.ts`,
    `${resolve(cwd, config.baseDir)}/**/*.performance.ts`,
    `${resolve(cwd, config.baseDir)}/**/*.stories.ts`,
    `${resolve(cwd, config.baseDir)}/**/*.examples.js`
  ],
  outdir: config.outDir,
  litelement: true,
  plugins: [
    tsExtension(),
    baseDir(),
    orderElements(),
    metadata({ tags: ['docs', 'spec', 'status', 'since', 'example'] }),
    customElementVsCodePlugin({
      outdir: config.outDir,
      hideLogs: true
    })
  ],
};

function orderElements() {
  return {
    name: 'order-elements',
    packageLinkPhase({ customElementsManifest }) {
      customElementsManifest.modules.sort((a, b) => (a.path < b.path ? -1 : 1));
    },
  };
}

function baseDir() {
  return {
    name: 'base-dir',
    packageLinkPhase({ customElementsManifest }) {
      customElementsManifest.modules = JSON.parse(
        JSON.stringify(customElementsManifest.modules).replaceAll(`"/${baseSrc}`, '"').replaceAll(`"${baseSrc}`, '"')
      );
    },
  };
}

function tsExtension() {
  return {
    name: 'ts-extensions',
    packageLinkPhase({ customElementsManifest }) {
      customElementsManifest.modules = JSON.parse(JSON.stringify(customElementsManifest.modules).replace(/\.ts"/g, '.js"'));
    },
  };
}

function metadata(config = { tags: [] }) {
  return {
    analyzePhase({ ts, node, moduleDoc }) {
      switch (node.kind) {
        case ts.SyntaxKind.ClassDeclaration:
          const classDeclaration = moduleDoc.declarations.find(d => d.name === node.name?.getText());

          node.jsDoc?.forEach(jsDoc => {
            jsDoc.tags?.forEach(tag => {
              let tagName = tag.tagName?.getText();
              if (config.tags.find(t => t === tagName)) {
                classDeclaration.metadata = { ...classDeclaration.metadata, [tagName]: tag.comment };
              }
            });
          });

          break;
      }
    }
  }
}
