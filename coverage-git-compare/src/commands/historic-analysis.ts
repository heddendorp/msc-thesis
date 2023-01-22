import { Command } from 'commander';
import { runAnalysis } from './cli-compare';
import {version} from '../../package.json';
import { execSync } from 'child_process';

export function registerHistoricAnalysisCommand(program: Command) {
  program
    .command('history')
    .option('-c, --commit <commit>', 'First commit to compare with')
    .option('-p, --path <path>', 'Path to coverage report', './coverage')
    .option('-l, --limit <limit>', 'Maximum commits to inspect', '30')
    .action(async ({ commit, path, limit }) => {
      console.log(`COVERAGE_GIT_COMPARE-VERSION: ${version}`);
      console.log('==FLAKECHECK:START==');
      console.log(
        `{ "commit": "${commit}", "path": "${path}", "limit": "${limit}", "runs": [`
      );
      for (let i = 0; i < parseInt(limit); i++) {
        const commit = execSync(`git rev-parse HEAD~${i}`).toString().trim();
        console.log(`{ "commit": "${commit}", `);
        const exitCode = await runAnalysis({
          commit,
          path,
          limit: 10,
          json: true,
        });
        console.log(
          `"suspectedFlaky": ${
            exitCode === 0
          } ,"exitCode": "${exitCode}", "flag": "${
            exitCode === 0 ? 'FLAKECHECK:POSITIVE' : 'FLAKECHECK:NEGATIVE'
          }" }`
        );
        if (exitCode === 1) {
          break;
        }
        if (i < parseInt(limit) - 1) {
          console.log(',');
        }
      }
      console.log(']}');
      console.log('==FLAKECHECK:END==');
    });
}
