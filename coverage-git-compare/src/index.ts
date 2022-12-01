#!/usr/bin/env node

import {clear} from 'node:console';
import chalk from 'chalk';
import figlet from 'figlet';
import {Command} from 'commander';
import packageJson from '../package.json';
import jetpack from 'fs-jetpack';
import util from 'util';
import {getPathsFromPackageLock} from './package-lock-handler';
import minimatch from 'minimatch';

const exec = util.promisify(require('child_process').exec);

clear();
console.log(
  chalk.red(figlet.textSync('Cov-Git-compare', {horizontalLayout: 'full'}))
);
const program = new Command();
program
  .name('coverage-git-compare')
  .version(packageJson.version)
  .description('A CLI for comparing coverage reports with recent commits');

program
  .command('compare')
  .option('-c, --commit <commit>', 'Commit to compare with')
  .option('-p, --path <path>', 'Path to coverage report', './coverage')
  .option('-l, --limit <limit>', 'Maximum commits to inspect', '10')
  .action(async options => {
    const {commit, path, limit} = options;
    const {stdout} = await exec(
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
      const {stderr} = await exec(
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
    const coverageFolder = jetpack.cwd(path);
    const coverageFiles = await coverageFolder.findAsync({
      matching: '*files.json',
    });
    console.log(
      `Inspecting ${commitNumber} commits and ${coverageFiles.length} failed tests`
    );
    for (const file of coverageFiles) {
      const testName = file.split('-')[0];
      const rawFiles = (await coverageFolder.readAsync(
        file,
        'json'
      )) as string[];
      const coveredFiles = rawFiles.map(f => f.replaceAll('\\', '/'));
      const changedFilesForTest = changedFiles
        .filter((f: string) =>
          coveredFiles.some((cf: string) => minimatch(cf, f))
        )
        .map(path => {
          if (path.includes('node_modules')) {
            return chalk.yellow(
              `Dependency: ${path
                .split('node_modules/')[1]
                .replace('/**/*', '')}`
            );
          }
          return path;
        });
      if (changedFilesForTest.length > 0) {
        console.log(
          chalk.red(
            `\nTest ${testName} has covered ${chalk.bold(
              changedFilesForTest.length
            )} changes that appeared in your commit range`
          )
        );
        console.log(changedFilesForTest.join(`\n`));
      } else {
        console.log(chalk.green(`\n${testName} has not covered changed files`));
      }
    }
    console.log();
  });

program.parse();
