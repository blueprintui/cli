#!/usr/bin/env node

import * as url from 'url';
import { path } from 'zx';
import { cwd } from 'process';
import { spinner } from 'zx/experimental';
import { rollup, watch } from 'rollup';
import { program } from 'commander';
import { loadConfigFile } from 'rollup/loadConfigFile';
import { cp, lstat, readdir } from 'fs/promises';
import { readFileSync, writeFileSync } from 'fs';
import { join, resolve }  from 'path';
import { getUserConfig } from './utils.mjs';

const deepReadDir = async (dirPath) => await Promise.all(
  (await readdir(dirPath)).map(async (entity) => {
    const path = join(dirPath, entity)
    return (await lstat(path)).isDirectory() ? await deepReadDir(path) : path
  }),
);

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const status = {
  error: '\x1b[31m%s\x1b[0m',
  warn: '\x1b[33m%s\x1b[0m',
  info: '\x1b[36m%s\x1b[0m',
  success: '\x1b[32m%s\x1b[0m'
};

program
  .command('build')
  .option('--config', 'path for custom config')
  .option('--watch')
  .description('build library')
  .action(async (options, command) => {
    process.env.BLUEPRINTUI_BUILD = !options.watch ? 'production' : 'development';
    process.env.BLUEPRINTUI_CONFIG = command.args[0] ? path.resolve(command.args[0]) : path.resolve('./blueprint.config.js');
    buildRollup(options);
  });

program
  .command('new')
  .argument('<library name>', 'library name')
  .description('generate library')
  .action(async (name, command) => {
    const outPath = resolve(cwd(), `./${name}`);
    await cp(resolve(__dirname, './project'), outPath, { recursive: true });

    const files = (await deepReadDir(outPath))?.flat(Number.POSITIVE_INFINITY);
    files.forEach(file => {
      const value = readFileSync(file, 'utf8').toString();
      writeFileSync(file, value.replaceAll('{{LIBRARY}}', name));
    });
  });

program
  .command('api')
  .option('--update')
  .option('--test')
  .description('verify and update custom elements manifest API lockfile')
  .action(async (options, command) => {
    process.env.BLUEPRINTUI_BUILD = !options.watch ? 'production' : 'development';
    process.env.BLUEPRINTUI_CONFIG = command.args[0] ? path.resolve(command.args[0]) : path.resolve('./blueprint.config.js');

    const config = await getUserConfig();
    const lockfilePath = config.customElementsManifestLockFile ? path.resolve(config.customElementsManifestLockFile) : path.resolve('./custom-elements.lock.json');
    const manifestPath = path.resolve(config.outDir, './custom-elements.json');
    const lockfile = readFileSync(lockfilePath, 'utf8').toString();
    const manifest = readFileSync(manifestPath, 'utf8').toString();

    if (options.test) {      
      if (lockfile !== manifest) {
        console.error(status.error, '🚫 new custom element API changes detected, run "bp api --update" to update the custom-elements.lock.json');
      } else {
        console.log(status.success, `✅ No custom element API changes detected`);
      }
    }

    if (options.update) {
      writeFileSync(lockfilePath, manifest);
      console.log(status.success, `🔏 custom-elements.lock.json updated to latest API changes`);
    }
  });

program.parse();

function buildRollup(args) {
  loadConfigFile(path.resolve(__dirname, './rollup.config.mjs'), {}).then(
    async ({ options, warnings }) => {
      if (warnings.count) {
        console.log(`${warnings.count} warnings`);
      }

      warnings.flush();

      if (!args.watch) {
        const start = Date.now();
        let bundle;
        let buildFailed = false;
        try {
          bundle = await spinner('Building...', async () => await rollup(options[0]));
          await bundle.write(options[0].output[0]);
        } catch (error) {
          buildFailed = true;
          console.error(status.error, error);
        }
        if (bundle) {
          const end = Date.now();
          console.log(status.success, `Completed in ${(end - start) / 1000} seconds 🎉`);
          await bundle.close();
        }
        process.exit(buildFailed ? 1 : 0);
      }

      if (args.watch) {
        const watcher = watch(options[0]);

        try {
          watcher.on('event', (event) => {
            if (event.result) {
              event.result.watchFiles = null;
            }

            switch (event.code) {
              case 'START':
                console.log(status.info, 'Building...');
                break;
              case 'ERROR':
                console.error(status.error, event.error);
                event.result.close();
                break;
              case 'WARN':
                console.error(status.warn, event.error);
                break;
              case 'BUNDLE_END':
                console.log(status.success, `Complete in ${event.duration / 1000} seconds`);
                event.result.close();
                break;
            }
          });
        } catch (error) {
          console.error(error);
        }
        watcher.on('event', ({ result }) => {
          if (result) {
            result.close();
          }
        });
      }
    }
  );
}
