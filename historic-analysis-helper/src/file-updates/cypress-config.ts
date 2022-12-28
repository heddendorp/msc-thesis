import jetpack from 'fs-jetpack';

const cypressImports = `import { registerMultilanguageCoveragePlugin } from '@heddendorp/cypress-plugin-multilanguage-coverage';
import path from 'path';
`
const cypressConfig = `
    process.env.CYPRESS_COLLECT_COVERAGE === 'true' && registerMultilanguageCoveragePlugin({ workingDirectory: path.join(__dirname, '..'), saveRawCoverage: true })(on, config);`
const insertionMarker = 'module.exports = (on: (arg0: string, arg1: {}) => void, config: any) => {';
export const updateOldCypressConfig = () => {
  const configContent = jetpack.read('src/test/cypress/plugins/index.ts', 'utf8');
  const insertionIndex = configContent.indexOf(insertionMarker) + insertionMarker.length;
  // insert line after the module.exports line
  const newConfigContent = configContent.slice(0, insertionIndex) + cypressConfig + configContent.slice(insertionIndex);
  // add imports
  const newConfigContentWithImports = cypressImports + newConfigContent;
  jetpack.write('src/test/cypress/plugins/index.ts', newConfigContentWithImports);
}
