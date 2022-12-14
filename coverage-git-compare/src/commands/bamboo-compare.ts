import { fetch } from '@whatwg-node/fetch';
import { Command } from 'commander';
import { XMLParser } from 'fast-xml-parser';
import util from 'util';
import chalk from 'chalk';
import { getPathsFromPackageLock } from '../helpers/package-lock-handler';
import jetpack from 'fs-jetpack';
import minimatch from 'minimatch';
import { compareFiles } from '../helpers/compare-files';

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
      'devlop'
    )
    .action(async (planKey, token, { path, branch }) => {
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
      const lastSuccessfulBuild = planData.results.results.result.find(
        (result: any) => result.buildState === 'Successful'
      )?.buildResultKey;
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
        `git log ${lastSuccessfulCommit}...HEAD --pretty="@begin@%h@end@" --name-only`
      );
      const commitNumber = stdout.split('@begin@').length - 1;
      const files = stdout
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => !line.includes('@begin@') && line.length);
      const changedFiles = Array.from(new Set<string>(files));
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
      console.log();
      if (nonFlakyFail) {
        console.log(chalk.red('Failure does not appear to be flaky'));
        process.exit(1);
      } else {
        console.log('FLAKECHECK:POSITIVE');
        process.exit(0);
      }
    });
}
