import { fetch } from '@whatwg-node/fetch';
import { Command } from 'commander';
import { XMLParser } from 'fast-xml-parser';
import util from 'util';
import chalk from 'chalk';
import { getPathsFromPackageLock } from '../helpers/package-lock-handler';
import jetpack from 'fs-jetpack';
import { compareFiles } from '../helpers/compare-files';
import { version } from '../../package.json';
import parseDiff from 'parse-diff';
import { compareLines } from '../helpers/compare-lines';

const exec = util.promisify(require('child_process').exec);

const xmlParser = new XMLParser();
export function registerBambooCompareCommand(program: Command) {
  program
    .command('bamboo')
    .argument('<planKey>', 'Bamboo plan key')
    .argument('<bambooToken>', 'Bamboo access token')
    .option('-p, --path <path>', 'Path to coverage report', './coverage')
    .option(
      '-b, --branch [branch]',
      'Branch to compare against if no build is found',
      'develop'
    )
    .action(async (planKey, token, { path, branch }) => {
      console.log(`COVERAGE_GIT_COMPARE-VERSION: ${version}`);
      let lastSuccessfulCommit = 'HEAD^';
      const planResponse = await fetch(
        `https://bamboobruegge.in.tum.de/rest/api/latest/result/${planKey}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const planXml = await planResponse.text();
      const planData = xmlParser.parse(planXml);
      let lastSuccessfulBuild;
      try {
        const result = planData.results.results.result;
        if (Array.isArray(result)) {
          lastSuccessfulBuild = result.find(
            (result: any) => result.buildState === 'Successful'
          )?.buildResultKey;
        } else {
          lastSuccessfulBuild =
            result.buildState === 'Successful'
              ? result.buildResultKey
              : undefined;
        }
      } catch (e) {
        console.warn(
          'Problem when parsing data from request: ',
          `https://bamboobruegge.in.tum.de/rest/api/latest/result/${planKey}`
        );
        console.log('Issue loading last successful build: ', e);
      }
      if (lastSuccessfulBuild) {
        console.debug(`Last successful build: ${lastSuccessfulBuild}`);
        const successfulBuildResponse = await fetch(
          `https://bamboobruegge.in.tum.de/rest/api/latest/result/${lastSuccessfulBuild}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const successfulBuildXml = await successfulBuildResponse.text();
        const successfulBuildData = xmlParser.parse(successfulBuildXml);
        lastSuccessfulCommit = successfulBuildData.result.vcsRevisionKey;
      } else {
        console.debug('No successful build found, falling back to ', branch);
        lastSuccessfulCommit = branch;
      }
      const { stdout } = await exec(
        `git log ${lastSuccessfulCommit}...HEAD --pretty="@begin@%h@end@" --name-only`,
        { maxBuffer: 1024 * 500 }
      );
      const commitNumber = stdout.split('@begin@').length - 1;
      const { stdout: diff } = await exec(`git diff ${lastSuccessfulCommit}`, {
        maxBuffer: 1024 * 1000,
      });
      const changedFiles = parseDiff(diff).map((change) => change.to);
      const changedLines = parseDiff(diff).map((change) => ({
        file: change.to,
        lines: change.chunks.flatMap((chunk) =>
          Array.from(
            new Set(
              chunk.changes.flatMap((change) => {
                switch (change.type) {
                  case 'add':
                    return [change.ln];
                  case 'normal':
                    return [change.ln1, change.ln2];
                  case 'del':
                    return [change.ln];
                  default:
                    return [];
                }
              })
            )
          )
        ),
      }));
      if (changedFiles.some((file: string) => file === 'package-lock.json')) {
        console.log(
          chalk.gray(
            'package-lock.json changes detected, adding changed dependencies to list of changed files'
          )
        );
        const { stderr } = await exec(
          `git show ${lastSuccessfulCommit}:package-lock.json > old-package-lock.json`
        );
        if (stderr) {
          console.log(chalk.red(stderr));
          return;
        }
        const additionalFiles = getPathsFromPackageLock(
          'old-package-lock.json',
          'package-lock.json'
        );
        jetpack.remove('old-package-lock.json');
        changedFiles.push(...additionalFiles);
      }
      const nonFlakyFail = await compareFiles(path, changedFiles, commitNumber);
      const nonFlakyFailLines = await compareLines(
        path,
        changedLines,
        commitNumber
      );
      console.log();
      if (nonFlakyFail) {
        console.log(
          chalk.yellow('File coverage indicates a non flaky failure')
        );
      } else {
        console.log(chalk.green('File coverage indicates a flaky failure'));
      }
      if (nonFlakyFailLines) {
        console.log(chalk.red('Failure does not appear to be flaky'));
        process.exit(1);
      } else {
        console.log('FLAKECHECK:POSITIVE');
        process.exit(0);
      }
    });
}
