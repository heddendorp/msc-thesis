import jetpack from 'fs-jetpack';

const cypressImports = `import { registerMultilanguageCoveragePlugin } from '@heddendorp/cypress-plugin-multilanguage-coverage';
import path from 'path';
`;
const cypressConfig = (version, newCypress) => `
    process.env.CYPRESS_COLLECT_COVERAGE === 'true' && registerMultilanguageCoveragePlugin({ workingDirectory: path.join(__dirname${
      newCypress ? '' : ", '..'"
    }), saveRawCoverage: true, distributionFile: '../../../build/libs/Artemis-${version}.war' })(on, config);`;
const oldInsertionMarker =
  'module.exports = (on: (arg0: string, arg1: any) => void, config: any) => {';
const newInsertionMarker = 'setupNodeEvents(on) {';
const insertionMarkerReplacement = `setupNodeEvents(on, config) {`;
const taskMarker = 'error(message: string) {';
const logTask = `log(message: string) {
                    console.log('\x1b[37m', 'LOG: ', message, '\x1b[0m');
                    return null;
                },
`;
export const updateCypressConfig = (
  artemisVersion: string,
  newCypress: boolean
) => {
  const cypressConfigFile = newCypress
    ? 'src/test/cypress/cypress.config.ts'
    : 'src/test/cypress/plugins/index.ts';
  const configContent = jetpack.read(cypressConfigFile, 'utf8');
  const insertionMarker = newCypress ? newInsertionMarker : oldInsertionMarker;
  const insertionIndex = configContent.indexOf(insertionMarker);
  // insert line after the module.exports line
  const newConfigContent =
    configContent.slice(0, insertionIndex) +
    (newCypress ? insertionMarkerReplacement : oldInsertionMarker) +
    cypressConfig(artemisVersion, newCypress) +
    configContent.slice(insertionIndex + insertionMarker.length);

  const taskIndex = newConfigContent.indexOf(taskMarker);
  const newConfigContentWithLogTask =
    newConfigContent.slice(0, taskIndex) +
    logTask +
    newConfigContent.slice(taskIndex);

  // add imports
  const newConfigContentWithImports =
    cypressImports + newConfigContentWithLogTask;
  jetpack.write(cypressConfigFile, newConfigContentWithImports);
};

const rerunLogger = `
/**
 * We want to log our test retries to the console to be able to see how often a test is retried.
 */
const config: any = Cypress.config();
if (!config.isInteractive && config.reporter !== 'spec') {
    afterEach(() => {
        const test = (cy as any).state('runnable')?.ctx?.currentTest;
        if (test?.state === 'failed' && test?._currentRetry < test?._retries) {
            cy.task('log', \` RERUN: (Attempt \${test._currentRetry + 1} of \${test._retries + 1}) \${test.title}\`, { log: false });
        }
    });
}`;

export const addRerunLogger = () => {
  const fileContent = jetpack.read('src/test/cypress/support/index.ts', 'utf8');
  if(!fileContent.includes(`cy.task('log', \` RERUN: (Attempt'`)){
    jetpack.append('src/test/cypress/support/index.ts', rerunLogger);
  }
};
