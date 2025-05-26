import browserslist from 'browserslist';
import { transform, browserslistToTargets } from 'lightningcss';

const targets = browserslistToTargets(browserslist('Chrome > 116'));

// fork of https://github.com/justinfagnani/rollup-plugin-css-modules/tree/main
export const css = (options = {}) => {
  return {
    name: 'css-modules',
    transform(code, id) {
      const isCssModule = this.getModuleInfo(id)?.attributes.type === 'css';
      if (isCssModule) {
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

        return `const stylesheet = new CSSStyleSheet();stylesheet.replaceSync(\`${output}\`);export default stylesheet;`;
      }
      return null;
    },
  };
};
