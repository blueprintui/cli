import { extname } from 'path';

const fileCache = {};

/**
 * Rollup plugin for local file writes
 * Compares the output of rollup to the current file on disk. If same it will
 * prevent rollup from writting to the file again preventing file watchers from being triggered
 */
export function writeCache(options = { }) {
  return {
    name: 'esm-cache',
    generateBundle(_options, bundles) {
      for (const [key, bundle] of Object.entries(bundles)) {
        const path = `${options.outDir}/${bundle.fileName}`;

        if (extname(path) === '.js' && fileCache[path] !== bundle.code) {
          fileCache[path] = bundle.code;
        } else {
          delete bundles[key];
        }
      }
    },
  };
};