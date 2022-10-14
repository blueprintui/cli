// rollup-plugin-minify-html-literals https://github.com/asyncLiz/rollup-plugin-minify-html-literals/issues/24
import minify from 'minify-html-literals';
import { createFilter } from '@rollup/pluginutils';

export function minifyHTML(config = {}) {
  return {
    name: 'minify-html-literals',
    transform(code, id) {
      if (createFilter(config.include, config.exclude)(id)) {
        try {
          return minify.minifyHTMLLiterals(code, { ...(config.options || {}), fileName: id }); // https://www.npmjs.com/package/minify-html-literals#options
        } catch (error) {
          this.warn(error.message);
        }
      }
    }
  };
}