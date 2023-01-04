import jetpack from 'fs-jetpack';

const cypressImports = `import { registerMultilanguageCoveragePlugin } from '@heddendorp/cypress-plugin-multilanguage-coverage';
import path from 'path';
`;
const cypressConfig = `
    process.env.CYPRESS_COLLECT_COVERAGE === 'true' && registerMultilanguageCoveragePlugin({ workingDirectory: path.join(__dirname, '..'), saveRawCoverage: true })(on, config);`;
const insertionMarker =
  'module.exports = (on: (arg0: string, arg1: {}) => void, config: any) => {';
const taskMarker = 'error(message: string) {';
const logTask = `log(message: string) {
                    console.log('\x1b[37m', 'LOG: ', message, '\x1b[0m');
                    return null;
                },
`;
export const updateOldCypressConfig = () => {
  const configContent = jetpack.read(
    'src/test/cypress/plugins/index.ts',
    'utf8'
  );
  const insertionIndex =
    configContent.indexOf(insertionMarker) + insertionMarker.length;
  // insert line after the module.exports line
  const newConfigContent =
    configContent.slice(0, insertionIndex) +
    cypressConfig +
    configContent.slice(insertionIndex);

  const taskIndex = newConfigContent.indexOf(taskMarker);
  const newConfigContentWithLogTask =
    newConfigContent.slice(0, taskIndex) +
    logTask +
    newConfigContent.slice(taskIndex);

  // add imports
  const newConfigContentWithImports =
    cypressImports + newConfigContentWithLogTask;
  jetpack.write(
    'src/test/cypress/plugins/index.ts',
    newConfigContentWithImports
  );
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
  jetpack.append('src/test/cypress/support/index.ts', rerunLogger);
};
