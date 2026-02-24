import { resolve } from 'path';
import { customElementVsCodePlugin } from 'custom-element-vs-code-integration';
import { getUserConfig } from './utils.mjs';

const cwd = process.cwd();
const config = await getUserConfig();
const baseSrc = resolve(cwd, config.baseDir);

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
    commands(),
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
      const base = baseSrc.endsWith('/') ? baseSrc : `${baseSrc}/`;
      customElementsManifest.modules = JSON.parse(
        JSON.stringify(customElementsManifest.modules).replaceAll(base, '').replaceAll(base.slice(1), '')
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

function commands() {
  return {
    analyzePhase({ ts, node, moduleDoc }) {
      switch (node.kind) {
        case ts.SyntaxKind.ClassDeclaration:
          const classDeclaration = moduleDoc.declarations.find(d => d.name === node.name?.getText());

          node.jsDoc?.forEach(jsDoc => {
            jsDoc.tags?.forEach(tag => {
              if (tag.tagName?.getText() === 'command') {
                const [name, ...rest] = tag.comment.split(' - ');
                const description = rest.join(' - ').trim();
                classDeclaration.commands = classDeclaration.commands ?? [];
                classDeclaration.commands.push({ name: name.trim(), description });
              }
            });
          });

          break;
      }
    }
  }
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
