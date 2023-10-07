import browserslist from 'browserslist';
import { createFilter } from '@rollup/pluginutils';
import { transform, browserslistToTargets } from 'lightningcss';
import { path } from 'zx';

const targets = browserslistToTargets(browserslist('Chrome > 116'));

// fork of https://github.com/jleeson/rollup-plugin-import-css to enable import attributes and minificaiton
export const css = (options = {}) => {
  const styles = {};
  const filter = createFilter(
    options.include ?? ['**/*.css'],
    options.exclude ?? []
  );

  /* function to sort the css imports in order - credit to rollup-plugin-postcss */
  const getRecursiveImportOrder = (id, getModuleInfo, seen = new Set()) => {
    if (seen.has(id)) return [];

    seen.add(id);

    const result = [id];

    getModuleInfo(id).importedIds.forEach((importFile) => {
      result.push(...getRecursiveImportOrder(importFile, getModuleInfo, seen));
    });

    return result;
  };

  return {
    name: 'import-css',

    /* convert the css file to a module and save the code for a file output */
    transform(code, id) {
      if (!filter(id)) return;

      const output = options.minify
        ? transform({
            targets,
            drafts: {
              nesting: true,
            },
            analyzeDependencies: true,
            code: Buffer.from(code),
            minify: true,
            sourceMap: false,
          }).code.toString()
        : code;

      /* cache the result */
      if (!styles[id] || styles[id] != output) {
        styles[id] = output;
      }

      return {
        code: `const sheet = new CSSStyleSheet();sheet.replaceSync(${JSON.stringify(
          output
        )});export default sheet;`,
        map: { mappings: '' },
      };
    },

    /* output a css file with all css that was imported without being assigned a variable */
    generateBundle(opts, bundle) {
      /* collect all the imported modules for each entry file */
      let modules = {};
      let entryChunk = null;
      for (let file in bundle) {
        modules = Object.assign(modules, bundle[file].modules);
        if (!entryChunk) entryChunk = bundle[file].facadeModuleId;
      }

      /* get the list of modules in order */
      const moduleIds = getRecursiveImportOrder(entryChunk, this.getModuleInfo);

      /* remove css that was imported as a string */
      const css = Object.entries(styles)
        .sort((a, b) => moduleIds.indexOf(a[0]) - moduleIds.indexOf(b[0]))
        .map(([id, code]) => {
          if (!modules[id]) return code;
        })
        .join('\n');

      /* return the asset name by going through a set of possible options */
      const getAssetName = () => {
        const fileName = options.output ?? opts.file ?? 'bundle.js';
        return `${path.basename(fileName, path.extname(fileName))}.css`;
      };

      /* return the asset fileName by going through a set of possible options */
      const getAssetFileName = () => {
        if (options.output) return options.output;
        if (opts.assetFileNames) return undefined;
        return `${getAssetName()}.css`;
      };

      this.emitFile({
        type: 'asset',
        name: getAssetName(),
        fileName: getAssetFileName(),
        source: css,
      });
    },
  };
};
