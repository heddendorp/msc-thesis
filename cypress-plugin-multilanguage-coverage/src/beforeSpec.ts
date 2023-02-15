import path from 'path';
import util from 'util';
import {Config} from './index';
import PluginConfigOptions = Cypress.PluginConfigOptions;
import jetpack from 'fs-jetpack';
import {ChromeClient} from './chromeClient';

const exec = util.promisify(require('child_process').exec);

export function handleBeforeSpec(
  config: Config,
  pluginConfig: PluginConfigOptions
) {
  // Extract host from baseUrl
  const host = config.appHost;
  return async (spec: Cypress.Cypress['spec']) => {
    const startTime = Date.now();
    console.log('Starting code coverage for spec: ' + spec.name);
    const cypressVersion = Number(pluginConfig.version.split('.')[0]);
    if (cypressVersion > 10) {
      try {
        console.log('Starting chrome coverage for cypress version 10+');
        await ChromeClient.startCoverage();
      } catch (e) {
        console.log('Error starting chrome coverage', e);
      }
    }
    if (config.resetCoverageOnSpecStart && config.enableJavaCoverage) {
      await exec(
        `java -jar ${path.join(
          __dirname,
          '..',
          '..',
          'jars',
          'jacococli.jar'
        )} dump --destfile ${path.join(
          config.workingDirectory,
          config.jaCoCoFilePath,
          'reset-coverage.exec'
        )} --reset --address ${host}`
      ).then(({stdout, stderr}: {stdout: string; stderr: string}) => {
        console.log(stdout);
        if (stderr) console.error(stderr);
        const endTime = Date.now();
        jetpack.append('times.txt', (endTime - startTime).toString());
        console.log('TIME_PASSED', endTime - startTime);
      });
    } else {
      const endTime = Date.now();
      jetpack.append('times.txt', (endTime - startTime).toString());
      console.log('TIME_PASSED', endTime - startTime);
    }
  };
}
