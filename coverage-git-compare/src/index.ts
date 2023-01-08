#!/usr/bin/env node

import { clear } from 'node:console';
import chalk from 'chalk';
import figlet from 'figlet';
import { Command } from 'commander';
import packageJson from '../package.json';
import { registerCliCompareCommand } from './commands/cli-compare.js';
import { registerBambooCompareCommand } from './commands/bamboo-compare';
import { registerHistoricAnalysisCommand } from './commands/historic-analysis';

clear();
console.log(
  chalk.red(figlet.textSync('Cov-Git-compare', { horizontalLayout: 'full' }))
);
const program = new Command();
program
  .name('coverage-git-compare')
  .version(packageJson.version)
  .description('A CLI for comparing coverage reports with recent commits');

registerCliCompareCommand(program);
registerBambooCompareCommand(program);
registerHistoricAnalysisCommand(program);

program.parse();
