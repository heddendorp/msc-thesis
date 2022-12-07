import path from 'path';
import util from 'util';
import {Config} from './index';
import PluginConfigOptions = Cypress.PluginConfigOptions;

const exec = util.promisify(require('child_process').exec);

export function handleBeforeSpec(
  config: Config,
  pluginConfig: PluginConfigOptions
) {
  // Extract host from baseUrl
  const host =
    pluginConfig.baseUrl?.split('//')[1].split(':')[0] ?? 'localhost';
  return async (spec: Cypress.Cypress['spec']) => {
    console.log('Starting code coverage for spec: ' + spec.name);
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
      });
    }
  };
}
