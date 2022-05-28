#!/usr/bin/env node

import path from 'path';
import * as url from 'url';
import loadConfigFile from 'rollup/loadConfigFile';
import { rollup, watch } from 'rollup';
import { program } from 'commander';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const ERROR = '\x1b[31m%s\x1b[0m'; //red
const WARN = '\x1b[33m%s\x1b[0m'; //yellow
const INFO = '\x1b[36m%s\x1b[0m'; //cyan
const SUCCESS = '\x1b[32m%s\x1b[0m'; //green

program
  .command('build')
  .option('--config', 'path for custom config')
  .option('--watch')
  .option('--prod')
  .description('build library')
  .action(async (options, command) => {
    process.env.BLUEPRINTUI_BUILD = options.prod || !options.watch ? 'production' : 'development';
    process.env.BLUEPRINTUI_CONFIG = command.args[0] ? path.resolve(command.args[0]) : path.resolve(process.cwd(), './rollup.config.js');
    buildRollup(options);
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
          console.log(INFO, 'Building...');
          bundle = await rollup(options[0]);
          await bundle.write(options[0].output[0]);
        } catch (error) {
          buildFailed = true;
          console.error(ERROR, error);
        }
        if (bundle) {
          const end = Date.now();
          console.log(SUCCESS, `Completed in ${(end - start) / 1000} seconds 🎉`);
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
                console.log(INFO, 'Building...');
                break;
              case 'ERROR':
                console.error(ERROR, event.error);
                event.result.close();
                break;
              case 'WARN':
                console.error(ERROR, event.error);
                break;
              case 'BUNDLE_END':
                console.log(SUCCESS, `Complete in ${event.duration / 1000} seconds`);
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
