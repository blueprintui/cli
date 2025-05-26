import { minify } from 'terser';

export function minifyJavaScript(terserOptions = { ecma: 2022, module: true, format: { comments: false }, compress: { passes: 2, unsafe: true } }) {
  return {
    name: 'terser',
    async renderChunk(code, _chunk, outputOptions) {
      try {
        return await minify(code, { module: true, sourceMap: outputOptions.sourcemap, ...terserOptions });
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
  };
}