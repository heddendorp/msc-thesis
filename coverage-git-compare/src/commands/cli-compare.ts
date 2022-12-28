import chalk from 'chalk';
import { getPathsFromPackageLock } from '../helpers/package-lock-handler';
import jetpack from 'fs-jetpack';
import minimatch from 'minimatch';
import { Command } from 'commander';
import util from 'util';
import { compareFiles } from '../helpers/compare-files';

const exec = util.promisify(require('child_process').exec);

export function registerCliCompareCommand(program: Command) {
  program
    .command('compare')
    .option('-c, --commit <commit>', 'Commit to compare with')
    .option('-p, --path <path>', 'Path to coverage report', './coverage')
    .option('-l, --limit <limit>', 'Maximum commits to inspect', '10')
    .action(async (options) => {
      const { commit, path, limit } = options;
      const { stdout } = await exec(
        `git log ${
          commit ? `${commit}...HEAD` : `-${limit}`
        } --pretty="@begin@%h@end@" --name-only`
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
          `git show ${
            commit ? commit : `HEAD${Array(limit).fill('^').join('')}`
          }:package-lock.json > old-package-lock.json`
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
