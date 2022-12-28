#!/usr/bin/env node

import {clear} from 'node:console';
import chalk from 'chalk';
import {Command} from 'commander';
import packageJson from '../package.json';
import {registerCreateBranchCommand} from './commands/create-branch.js';


clear();
console.log(
  chalk.red('Artemis analysis tool'),
);
const program = new Command();
program
  .name('artemis-history')
  .version(packageJson.version)
  .description('A CLI for setting up Artemis history analysis');

registerCreateBranchCommand(program);

program.parse();
