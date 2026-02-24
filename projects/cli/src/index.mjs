#!/usr/bin/env node

import * as url from 'url';
import { path, spinner } from 'zx';
import { cwd } from 'process';
import { rolldown, watch } from 'rolldown';
import { program } from 'commander';
import { cp, readdir } from 'fs/promises';
import { readFileSync, writeFileSync } from 'fs';
import { resolve }  from 'path';
import { getUserConfig } from './utils.mjs';
import { publint } from 'publint';
import { formatMessage } from 'publint/utils';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const status = {
  error: '\x1b[31m%s\x1b[0m',
  warn: '\x1b[33m%s\x1b[0m',
  info: '\x1b[36m%s\x1b[0m',
  success: '\x1b[32m%s\x1b[0m'
};

program
  .command('build')
  .option('--config <path>', 'path for custom config')
  .option('--watch')
  .description('build library')
  .action(async (options, command) => {
    process.env.BLUEPRINTUI_BUILD = options.watch ? 'development' : 'production';
    process.env.BLUEPRINTUI_CONFIG = options.config ? path.resolve(options.config) : path.resolve('./blueprint.config.js');
    await buildRolldown(options);
  });

program
  .command('new')
  .argument('<library name>', 'library name')
  .description('generate library')
  .action(async (name, command) => {
    const outPath = resolve(cwd(), `./${name}`);
    await cp(resolve(__dirname, './project'), outPath, { recursive: true });

    const entries = await readdir(outPath, { recursive: true, withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => resolve(e.parentPath, e.name));
    for (const file of files) {
      const value = readFileSync(file, 'utf8');
      writeFileSync(file, value.replaceAll('{{LIBRARY}}', name));
    }
  });

program
  .command('api')
  .option('--config <path>', 'path for custom config')
  .option('--update')
  .option('--test')
  .description('verify and update custom elements manifest API lockfile')
  .action(async (options, command) => {
    process.env.BLUEPRINTUI_BUILD = 'production';
    process.env.BLUEPRINTUI_CONFIG = options.config ? path.resolve(options.config) : path.resolve('./blueprint.config.js');

    const config = await getUserConfig();
    const lockfilePath = config.customElementsManifestLockFile ? path.resolve(config.customElementsManifestLockFile) : path.resolve('./custom-elements.lock.json');
    const manifestPath = path.resolve(config.outDir, './custom-elements.json');
    const lockfile = readFileSync(lockfilePath, 'utf8');
    const manifest = readFileSync(manifestPath, 'utf8');

    if (options.test) {
      if (lockfile !== manifest) {
        console.error(status.error, '🚫 new custom element API changes detected, run "bp api --update" to update the custom-elements.lock.json');
        process.exit(1);
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
  }
}
