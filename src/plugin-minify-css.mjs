import browserslist from 'browserslist';
import { transform, browserslistToTargets } from 'lightningcss';
import { path } from 'zx';

const targets = browserslistToTargets(browserslist('Chrome > 112'));

export function minifyCSS() {
  return {
    load(id) { return id.slice(-4) === '.css' ? this.addWatchFile(path.resolve(id)) : null },
    transform: async (css, id) => {
      if (id.slice(-4) === '.css') {
        const code = transform({
          targets,
          drafts: {
            nesting: true
          },
          analyzeDependencies: true,
          code: Buffer.from(css),
          minify: true,
          sourceMap: false
        }).code.toString()

        return { code, map: { mappings: '' } };
      } else {
        return null;
      }
    }
  };
};
