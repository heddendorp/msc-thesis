# cypress-plugin-multilanguage-coverage

This is a plugin for [cypress](https://www.cypress.io/) that allows you to generate a coverage report for your multilanguage project.   
Currently, there is support for frontend that runs in the browser and is tested by cypress. For the backend, there is support for java servers that are instrumented with [jacoco](https://www.jacoco.org/jacoco/).

## Installation
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

### Java Instrumentation
You can instrument a java project with jacoco by running the following command in the root of your project:
```bash
java -javaagent:.\jars\jacocoagent.jar=output=tcpserver -jar .\jars\your.jar
```
For [Artemis](https://github.com/ls1intum/Artemis), you can use the following command:
```bash
java -javaagent:.\jars\jacocoagent.jar=output=tcpserver -jar .\build\libs\Artemis-6.0.0.jar --spring.profiles.active=dev,jenkins,gitlab,artemis,scheduling,local    
```
_This is for a local setup with GitLab and Jenkins_

For that you have to build the project first with
```bash
./gradlew spotlessApply -x webapp # to fix formatting issues
./gradlew build -x test -x jacocoTestCoverageVerification # to build the project without running tests
```

### Configuration
You can configure the plugin by passing a config map to the registerMultilanguageCoveragePlugin function. The following options are available:

```typescript
interface Config {
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
  /**
   * If enabled, the coverage report will only be saved if the spec fails.
   * @default true
   */
  onlySaveOnFailure: boolean;
  /**
   * If enabled, the coverage folder will be deleted before the coverage report is generated.
   * @default true
   */
  cleanCoverageFolder: boolean;
  /**
   * The path to the Artemis distribution file.
   * If this is set, the plugin will extract it in place and use the extracted files for coverage.
   * @default '../../../build/libs/Artemis-6.0.0.war'
   */
  distributionFile: string;
}
```
It is recommended to set the workingDirectory to the root of your cypress project. This way, Your files don't end up in your node_modules folder.
```typescript
{workingDirectory:path.join(__dirname, '..')}
```

## Limitations
Currently coverage is only collected per file. In future versions of the plugin, more granular coverage could be a feature to support.

## References
- [How to build, test, and publish a TypeScript npm package in 2022](https://www.strictmode.io/articles/build-test-and-publish-npm-package-2022)
- [How To Set Up a New TypeScript Project](https://www.digitalocean.com/community/tutorials/typescript-new-project) by DigitalOcean
- Cypress [Plugin Guide](https://docs.cypress.io/guides/tooling/plugins-guide)
