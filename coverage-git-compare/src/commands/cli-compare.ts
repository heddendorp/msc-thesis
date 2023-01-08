import chalk from 'chalk';
import { getPathsFromPackageLock } from '../helpers/package-lock-handler';
import jetpack from 'fs-jetpack';
import { Command } from 'commander';
import util from 'util';
import { compareFiles } from '../helpers/compare-files';

const exec = util.promisify(require('child_process').exec);

export async function runAnalysis({ commit, path, limit, json }) {
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
    if (!json) {
      console.log(
        chalk.gray(
          'package-lock.json changes detected, adding changed dependencies to list of changed files'
        )
      );
    }
    const { stderr } = await exec(
      `git show ${
        commit ? commit : `HEAD${Array(limit).fill('^').join('')}`
      }:package-lock.json > old-package-lock.json`
    );
    if (stderr) {
      if (!json) {
        console.log(chalk.red(stderr));
      }
      return;
    }
    const additionalFiles = getPathsFromPackageLock(
      'old-package-lock.json',
      'package-lock.json'
    );
    jetpack.remove('old-package-lock.json');
    changedFiles.push(...additionalFiles);
  }
  const nonFlakyFail = await compareFiles(
    path,
    changedFiles,
    commitNumber,
    json
  );
  console.log();
  if (nonFlakyFail) {
    if (!json) {
      console.log(chalk.red('Failure does not appear to be flaky'));
    }
    return 1;
  } else {
    if (!json) {
      console.log('FLAKECHECK:POSITIVE');
    }
    return 0;
  }
}

export function registerCliCompareCommand(program: Command) {
  program
    .command('compare')
    .option('-c, --commit <commit>', 'Commit to compare with')
    .option('-p, --path <path>', 'Path to coverage report', './coverage')
    .option('-l, --limit <limit>', 'Maximum commits to inspect', '10')
    .option('-json', 'Output in JSON format')
    .action(async (options) => {
      const exitCode = await runAnalysis(options);
      process.exit(exitCode);
    });
}
