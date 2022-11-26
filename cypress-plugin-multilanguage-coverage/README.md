# cypress-plugin-multilanguage-coverage

This is a plugin for [cypress](https://www.cypress.io/) that allows you to generate a coverage report for your multilanguage project.   
Currently, there is support for frontend that runs in the browser and is tested by cypress. For the backend, there is support for java servers that are instrumented with [jacoco](https://www.jacoco.org/jacoco/).

## Installation
Make sure to follow GitHub's guide on [how to install a npm package from their registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#installing-a-package).
You will have to [create a personal access](https://github.com/settings/tokens/new) token with the `read:packages` scope and use it to log in to npm.
```bash
npm login --scope=@heddendorp --registry=https://npm.pkg.github.com

# Username: USERNAME
# Password: TOKEN
# Email: PUBLIC-EMAIL-ADDRESS
```

```bash
npm install @heddendorp/cypress-plugin-multilanguage-coverage
```

You can find the releases of the package on [GitHub](https://github.com/heddendorp/msc-thesis/pkgs/npm/cypress-plugin-multilanguage-coverage).

After installing you have to add the following code to your cypress/plugins/index.ts file:

```typescript
import { registerMultilanguageCoveragePlugin } from 'cypress-plugin-multilanguage-coverage';

registerMultilanguageCoveragePlugin()(on, config);
```

## Usage
You can configure the plugin by passing a config map to the registerMultilanguageCoveragePlugin function. The following options are available:

```typescript
export interface Config {
  /**
   * If enabled, the plugin will generate a JaCoCo coverage report for Java code.
   * @default true
   */
  enableJavaCoverage: boolean;
  /**
   * If enabled, the java coverage will be reset when the browser is launched.
   * @default true
   */
  resetCoverageOnSpecStart: boolean;
  /**
   * The path where JaCoCo files will be written to.
   * @default 'jacoco'
   */
  jaCoCoFilePath: string;
  /**
   * The path where the compiled frontend files are located.
   * @default '../../../build/resources/main/static'
   */
  frontendBuildLocation: string;
  /**
   * The path where the coverage report will be written to.
   * @default 'coverage'
   */
  coverageFolder: string;
  /**
   * Base path for this plugin.
   * @default __dirname
   */
  workingDirectory: string;
  /**
   * The path where the compiled Java classes are located.
   * @default '../../../build/classes'
   */
  javaClassesLocation: string;
  /**
   * The path where the Java source files are located.
   * @default '../../../src/main/java'
   */
  javaSourceLocation: string;
  /**
   * If enabled, the raw coverage data will be logged to a file.
   * @default false
   */
  saveRawCoverage: boolean;
}
```
It is recommended to set the workingDirectory to the root of your cypress project. This way, Your files don't end up in your node_modules folder.
```typescript
{workingDirectory:path.join(__dirname, '..')}
```
