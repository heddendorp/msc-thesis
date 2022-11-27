import * as Cypress from 'cypress';
import {handleBeforeBrowserLaunch} from './browserLaunch';
import {handleAfterSpec} from './afterSpec';
import {handleBeforeSpec} from './beforeSpec';
import PluginConfig = Cypress.PluginConfig;
import {handleBeforeRun} from "./beforeRun";

export function registerMultilanguageCoveragePlugin(
  config: Partial<Config>
): PluginConfig {
  const pluginConfig: Config = {
    ...defaultConfig,
    ...config,
  };
  return (on, config) => {
    on('before:run', handleBeforeRun(pluginConfig));
    on('before:browser:launch', handleBeforeBrowserLaunch(pluginConfig));
    on('before:spec', handleBeforeSpec(pluginConfig));
    on('after:spec', handleAfterSpec(pluginConfig));
  };
}

const defaultConfig: Config = {
  enableJavaCoverage: true,
  resetCoverageOnSpecStart: true,
  coverageFolder: 'coverage',
  jaCoCoFilePath: 'jacoco',
  frontendBuildLocation: '../../../build/resources/main/static',
  workingDirectory: __dirname,
  javaClassesLocation: '../../../build/classes',
  javaSourceLocation: '../../../src/main/java',
  saveRawCoverage: false,
  onlySaveOnFailure: true,
  cleanCoverageFolder: true,
};

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
}
