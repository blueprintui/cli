# BlueprintUI CLI (alpha)

[![npm version](https://badge.fury.io/js/@blueprintui%2Fcli.svg)](https://badge.fury.io/js/@blueprintui%2Fcli)

## Opinionated CLI for creating Web Component Libraries

Blueprint CLI provides an out-of-the-box tool kit for compiling and creating
Web Component libraries. This project is still an experimental work in progress.

[Documentation](https://cli.blueprintui.dev/)

| Command      | Description                   |
| ------------ | ----------------------------- |
| build        | Build library for production |

| Options        | Description                                |
| -------------- | ------------------------------------------ |
| --config        | Path for `blueprint.config.js` file          |
| --watch        | Runs build in watch mode for development   |


### Configuration

The `blueprint.config.js` can be used to customize certain aspects of the build.
Below are the default values unless otherwise specified.

```javascript
export default { 
  library: {
    externals: [],
    assets: ['./README.md', './LICENSE.md', './package.json'],
    baseDir: './src',
    outDir: './dist/lib',
    entryPoints: ['./src/**/index.ts'],
    tsconfig: './tsconfig.lib.json',
    sourcemap: false,
  }
}
```
