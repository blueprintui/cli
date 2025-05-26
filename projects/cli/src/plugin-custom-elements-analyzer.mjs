import { runCustomElementsAnalyzer } from './utils.mjs';

export function customElementsAnalyzer(options) {
  let copied = false;
  return {
    name: 'custom-elements-analyzer',
    writeBundle: async () => {
      if (copied) {
        return;
      } else {
        await runCustomElementsAnalyzer(options.customElementsManifestConfig);
        copied = true;
      }
    }
  };
}
