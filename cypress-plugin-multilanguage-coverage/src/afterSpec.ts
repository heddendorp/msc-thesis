import Spec = Cypress.Spec;
import {ChromeClient} from './chromeClient';
import {Config} from './index';
import util from 'util';
import path from 'path';
// @ts-ignore - no types available
import jacoco from 'jacoco-parse';
import v8ToIstanbul from 'v8-to-istanbul';
import jetpack from 'fs-jetpack';
import PluginConfigOptions = Cypress.PluginConfigOptions;

const exec = util.promisify(require('child_process').exec);

export function handleAfterSpec(
  config: Config,
  pluginConfig: PluginConfigOptions
) {
  // Extract host from baseUrl
  const host =
    pluginConfig.baseUrl?.split('//')[1].split(':')[0] ?? 'localhost';
  return async (
    spec: Spec,
    results: CypressCommandLine.RunResult
  ): Promise<void> => {
    const startTime = Date.now();
    if (config.onlySaveOnFailure && !results.stats.failures) {
      console.log('Skipping coverage report for spec: ' + spec.name);
      return;
    }

    const specName = spec.name.split('/').pop();
    const coverageFolder = jetpack.dir(
      path.join(config.workingDirectory, config.coverageFolder),
      {empty: false}
    );
    console.log('Collecting code coverage for spec: ' + specName);
    let frontendFiles: string[] = [];
    let frontendCoverage: any = {error: 'Collection failed'};
    try {
      const client = await ChromeClient.get();
      const profilerCoverage = await client.Profiler.takePreciseCoverage();
      await client.Profiler.stopPreciseCoverage();
      const jsCoverage = profilerCoverage.result.filter(
        res => res.url.includes('.js') && !res.url.includes('__')
      );
      const coverageResultMap = {};
      await Promise.all(
        jsCoverage.map(async res => {
          const fileName = res.url.split('/').pop();
          if (!fileName) return;
          const filePath = path.join(
            config.workingDirectory,
            config.frontendBuildLocation,
            fileName
          );
          const converter = v8ToIstanbul(filePath);
          await converter.load();
          converter.applyCoverage(res.functions);
          Object.assign(coverageResultMap, converter.toIstanbul());
        })
      );
      frontendCoverage = Object.values(coverageResultMap);
      frontendFiles = frontendCoverage
        .filter(
          (entry: any) =>
            Object.values(entry.s).some((v: any) => v > 0) ||
            Object.values(entry.f).some((v: any) => v > 0)
        )
        .map((entry: any) => entry.path.split('webpack:\\').pop());
    } catch (e) {
      console.error(e);
      console.warn('could not collect frontend coverage');
      console.log('==ERROR:COVERAGE-COLLECTION:NO-FRONTEND==');
    }

    if (config.enableJavaCoverage) {
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
          `${specName}-coverage.exec`
        )} --reset --address ${host}`
      ).then(({stdout, stderr}: {stdout: string; stderr: string}) => {
        console.log(stdout);
        if (stderr) console.error(stderr);
      });
      await exec(
        `java -jar ${path.join(
          __dirname,
          '..',
          '..',
          'jars',
          'jacococli.jar'
        )} report ${path.join(
          config.workingDirectory,
          config.jaCoCoFilePath,
          `${specName}-coverage.exec`
        )} --classfiles ${path.join(
          config.workingDirectory,
          config.javaClassesLocation
        )} --sourcefiles ${path.join(
          config.workingDirectory,
          config.javaSourceLocation
        )} --xml ${path.join(
          config.workingDirectory,
          config.jaCoCoFilePath,
          `${specName}-coverage.xml`
        )}`
      ).then(({stdout, stderr}: {stdout: string; stderr: string}) => {
        console.log(stdout);
        if (stderr) console.error(stderr);
      });
      const javaCoverage = await new Promise<any>((resolve, reject) => {
        jacoco.parseFile(
          path.join(
            config.workingDirectory,
            config.jaCoCoFilePath,
            `${specName}-coverage.xml`
          ),
          (err: any, data: any) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          }
        );
      });
      const javaFiles = javaCoverage
        .filter(
          (entry: any) =>
            entry.lines.hit || entry.branches.hit || entry.functions.hit
        )
        .map((entry: any) => {
          if (!config.distributionFile) {
            return entry.file.replace(
              'de/tum/in/www1/artemis/',
              'src/main/java/de/tum/in/www1/artemis/'
            );
          }
          return entry.file;
        });
      const coveredFiles = frontendFiles.concat(javaFiles);
      if (config.saveRawCoverage) {
        coverageFolder.write(`${specName}-java.json`, javaCoverage);
      }
      coverageFolder.write(`${specName}-covered-files.json`, coveredFiles);
    }

    if (config.saveRawCoverage) {
      coverageFolder.write(`${specName}-frontend.json`, frontendCoverage);
    }

    if (!config.enableJavaCoverage) {
      coverageFolder.write(`${specName}-covered-files.json`, frontendFiles);
    }
    const endTime = Date.now();
    jetpack.append('times.txt', (endTime - startTime).toString());
    console.log('TIME_PASSED', endTime - startTime);
  };
}
