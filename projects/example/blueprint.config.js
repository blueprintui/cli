
export default { 
  library: {
    entryPoints: ['./src/**/index.ts', './src/include/*.ts'],
    externals: [/^tslib/, /^lit/],
  }
};
