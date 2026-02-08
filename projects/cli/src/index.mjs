#!/usr/bin/env node

import * as url from 'url';
import { path, spinner } from 'zx';
import { cwd } from 'process';
import { rolldown, watch } from 'rolldown';
import { program } from 'commander';
import { cp, lstat, readdir } from 'fs/promises';
import { readFileSync, writeFileSync } from 'fs';
import { join, resolve }  from 'path';
import { getUserConfig } from './utils.mjs';
import { publint } from 'publint';
import { formatMessage } from 'publint/utils';

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
    await buildRolldown(options);
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

async function buildRolldown(args) {
  const configs = (await import(path.resolve(__dirname, './rolldown.config.mjs'))).default;
  const config = configs[0];
  const outputOptions = Array.isArray(config.output) ? config.output[0] : config.output;

  if (!args.watch) {
    const start = Date.now();
    let bundle;
    let buildFailed = false;
    try {
      bundle = await spinner('Building...', async () => await rolldown(config));
      await bundle.write(outputOptions);
    } catch (error) {
      buildFailed = true;
      console.error(status.error, error);
    }
    if (bundle) {
      const end = Date.now();
      await bundle.close();

      const { messages } = await spinner('Verifying Package...', async () => await publint({
        strict: true,
        pkgDir: resolve(cwd())
      }));

      if (messages.length) {
        const pkg = JSON.parse(readFileSync(resolve(cwd(),'./package.json'), 'utf8'));
        for (const message of messages) {
          console.log(formatMessage(message, pkg))
        }
      } else {
        console.log(status.success, `Success in ${(end - start) / 1000} seconds 🎉`);
      }
    }
    process.exit(buildFailed ? 1 : 0);
  }

  if (args.watch) {
    const watcher = watch(config);

    try {
      watcher.on('event', (event) => {
        switch (event.code) {
          case 'START':
            console.log(status.info, 'Building...');
            break;
          case 'ERROR':
            console.error(status.error, event.error);
            if (event.result) {
              event.result.close();
            }
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
