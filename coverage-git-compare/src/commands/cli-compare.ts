import chalk from 'chalk';
import { getPathsFromPackageLock } from '../helpers/package-lock-handler';
import jetpack from 'fs-jetpack';
import { Command } from 'commander';
import util from 'util';
import { compareFiles } from '../helpers/compare-files';
import { version } from '../../package.json';
import parseDiff from 'parse-diff';
import { compareLines } from '../helpers/compare-lines';

const exec = util.promisify(require('child_process').exec);

export async function runAnalysis({ commit, path, limit, json }) {
  const { stdout } = await exec(
    `git log ${
      commit ? `${commit}...HEAD` : `HEAD~${limit}...HEAD`
    } --pretty="@begin@%h@end@" --name-only`,
    { maxBuffer: 1024 * 500 }
  );
  const commitNumber = stdout.split('@begin@').length - 1;
  const { stdout: diff } = await exec(
    `git diff ${commit ? `${commit}` : `HEAD~${limit}`}`,
    { maxBuffer: 1024 * 500 }
  );
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
  const nonFlakyFailLines = await compareLines(
    path,
    changedLines,
    commitNumber,
    json
  );
  console.log();
  if (nonFlakyFail) {
    if (!json) {
      console.log(chalk.yellow('File coverage indicates a non flaky failure'));
    }
  } else {
    if (!json) {
      console.log(chalk.green('File coverage indicates a flaky failure'));
    }
  }
  if (nonFlakyFailLines) {
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
      console.log(`COVERAGE_GIT_COMPARE-VERSION: ${version}`);
      const exitCode = await runAnalysis(options);
      process.exit(exitCode);
    });
}
