import { Command } from 'commander';
import chalk from 'chalk';
import { version } from '../../package.json';
import jetpack from 'fs-jetpack';

export async function runUpdate({ coverage }) {
  console.log(`HISTORIC_ANALYSIS_HELPER-VERSION: ${version}`);

  const packageJsonContent = jetpack.read('package.json', 'json');
  packageJsonContent.scripts['start:default'] =
    'cd packages/cli/bin && node --inspect=9222 n8n';
  packageJsonContent.scripts['start:windows'] =
    'cd packages/cli/bin && node --inspect=9222 n8n';
  jetpack.write('package.json', packageJsonContent, {
    jsonIndent: 4,
  });

  const cypressConfigContent = jetpack.read('cypress.config.js');
  let newCypressConfigContent = cypressConfigContent
    .replace(`video: true,`, `video: false,`)
    .replace(
      `defineConfig({`,
      `defineConfig({
      reporter: 'mochawesome',
      reporterOptions: {
        reportFilename: '[name]-report',
      },`
    )
    .replace(`runMode: 2,`, `runMode: 0,`)
    .replace(`defaultCommandTimeout: 10000,`, `defaultCommandTimeout: 100000,`)
    .replace(`experimentalSessionAndOrigin`, `experimentalMemoryManagement`)
    .replace(`requestTimeout: 12000,`, `requestTimeout: 120000,`);
  if (coverage) {
    newCypressConfigContent = newCypressConfigContent.replace(
      `			});`,
      `			});
    require('@heddendorp/per-test-v8-cov/plugin')(on, config);`
    );
    console.log(chalk.green(`Enabled coverage collection`));
  }
  jetpack.write('cypress.config.js', newCypressConfigContent);

  console.log(chalk.green(`Done!`));
}

export function registerUpdateN8NCommand(program: Command) {
  program
    .command('update-n8n')
    .option('-c, --coverage', 'Enable coverage collection')
    .action((options) => runUpdate(options));
  program.command('enable-n8n-sourcemaps').action(() => {
    const viteConfigContent = jetpack.read('packages/editor-ui/vite.config.ts');
    const newViteConfigContent = viteConfigContent.replace(
      'sourcemap: false',
      `sourcemap: true`
    );
    jetpack.write('packages/editor-ui/vite.config.ts', newViteConfigContent);
  });
}
