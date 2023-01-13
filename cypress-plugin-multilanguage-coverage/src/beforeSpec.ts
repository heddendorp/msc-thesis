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
  const host =
    pluginConfig.baseUrl?.split('//')[1].split(':')[0] ?? 'localhost';
  return async (spec: Cypress.Cypress['spec']) => {
    const startTime = Date.now();
    console.log('Starting code coverage for spec: ' + spec.name);
    await ChromeClient.startCoverage();
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
    }
  };
}
