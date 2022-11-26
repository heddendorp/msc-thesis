import path from 'path';
import util from 'util';
import {Config} from './index';

const exec = util.promisify(require('child_process').exec);

export function handleBeforeSpec(config: Config) {
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
        )} --reset`
      ).then(({stdout, stderr}: {stdout: string; stderr: string}) => {
        console.log(stdout);
        if (stderr) console.error(stderr);
      });
    }
  };
}
