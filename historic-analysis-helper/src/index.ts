#!/usr/bin/env node

import { clear } from 'node:console';
import chalk from 'chalk';
import { Command } from 'commander';
import packageJson from '../package.json';
import { registerCreateBranchCommand } from './commands/create-branch.js';
import { registerCreateBranchForCommitCommand } from './commands/create-for-commit';
import { registerUpdateN8NCommand } from './commands/udpate-n8n';

clear();
console.log(chalk.red('Historic analysis tool'));
const program = new Command();
program
  .name('historic-helper')
  .version(packageJson.version)
  .description('A CLI for setting up e2e history analysis');

registerCreateBranchCommand(program);
registerCreateBranchForCommitCommand(program);
registerUpdateN8NCommand(program);

program.parse();
