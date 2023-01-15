import { fetch } from '@whatwg-node/fetch';
import { Command } from 'commander';
import { XMLParser } from 'fast-xml-parser';
import util from 'util';
import chalk from 'chalk';
import { updatePackageScripts } from '../file-updates/package-scripts.js';
import { addDockerOverrides } from '../file-updates/docker-overrides.js';
import { updateGradleDependencies } from '../file-updates/gradle-dependencies.js';
import {
  addRerunLogger,
  updateCypressConfig,
} from '../file-updates/cypress-config.js';
import { updateComposeFile } from '../file-updates/compose-update';
import jetpack from 'fs-jetpack';
import {version} from '../../package.json';
import { parse } from 'yaml';

const exec = util.promisify(require('child_process').exec);

const xmlParser = new XMLParser();

export async function createBranch(
  planKey,
  latestSuccess,
  analyzedRun,
  { token, prefix, skipGit, local }
) {
  console.log(
    `HISTORIC_ANALYSIS_HELPER-VERSION: ${version}`
  );
  console.log(
    chalk.green(
      `Setting up analysis for Build ${analyzedRun} of Plan ${planKey}`
    )
  );
  const successfulBuildResponse = await fetch(
    `https://bamboobruegge.in.tum.de/rest/api/latest/result/${planKey}-${latestSuccess}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const successfulBuildXml = await successfulBuildResponse.text();
  const successfulBuildData = xmlParser.parse(successfulBuildXml);
  const lastSuccessfulCommit = successfulBuildData.result.vcsRevisionKey;
  const analyzedBuildResponse = await fetch(
    `https://bamboobruegge.in.tum.de/rest/api/latest/result/${planKey}-${analyzedRun}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const analyzedBuildXml = await analyzedBuildResponse.text();
  const analyzedBuildData = xmlParser.parse(analyzedBuildXml);
  const analyzedCommit = analyzedBuildData.result.vcsRevisionKey;
  // Save current branch name
  const { stdout: currentBranchStdout, stderr: currentBranchStderr } = await exec(
    `git rev-parse --abbrev-ref HEAD`
  );
  if (currentBranchStderr) {
    console.log(chalk.red(currentBranchStderr));
  }
  const currentBranch = currentBranchStdout.trim();
  console.log(chalk.gray(`Current branch: ${currentBranch}`));
  console.log(chalk.gray(`Creating branch for ${analyzedCommit}`));
  const { stdout: branchStdout, stderr: branchStderr } = await exec(
    `git checkout -b ${prefix}/build-${analyzedRun} ${analyzedCommit}`
  );
  if (branchStderr) {
    console.log(chalk.red(branchStderr));
  }

  const artemisPackage = jetpack.read('package.json', 'json');
  const cypressPackage = jetpack.read('src/test/cypress/package.json', 'json');

  console.log(chalk.gray(`Installing flaky test detection dependencies`));
  const { stdout: installStdout, stderr: installStderr } = await exec(
    `cd src/test/cypress && npm i -D @heddendorp/coverage-git-compare @heddendorp/cypress-plugin-multilanguage-coverage`
  );
  if (installStderr) {
    console.log(chalk.red(installStderr));
  }
  console.log(chalk.gray(`Adding flaky test detection script to package.json`));
  updatePackageScripts(lastSuccessfulCommit);
  console.log(chalk.green(`Done!`));
  console.log(chalk.gray(`Determining cypress docker image`));
  const dockerComposeContent = jetpack.read('src/main/docker/cypress/docker-compose.yml',
  'utf8');
  const dockerComposeData = parse(dockerComposeContent);
  const cypressImage = dockerComposeData.services['artemis-cypress'].image.split(':')[1];
  console.log(chalk.gray(`Using cypress docker image ${cypressImage}`));
  console.log(chalk.gray(`Adding Docker override files`));
  addDockerOverrides(cypressImage);
  console.log(chalk.green(`Done!`));
  console.log(chalk.gray(`Adding gradle dependencies`));
  updateGradleDependencies();
  console.log(chalk.green(`Done!`));
  console.log(chalk.gray(`Adding cypress plugin`));
  console.log(chalk.gray(`Determining cypress version`));
  const cypressVersion = cypressPackage.devDependencies.cypress;
  console.log(
    chalk.gray(`Adding cypress plugin for version ${cypressVersion}`)
  );
  const newCypress = cypressVersion.split('.')[0] > 9;
  updateCypressConfig(artemisPackage.version, newCypress);
  console.log(chalk.green(`Done!`));
  console.log(chalk.gray(`Adding cypress reruns`));
  updateComposeFile();
  addRerunLogger();
  console.log(chalk.green(`Done!`));
  if (skipGit) {
    console.log(chalk.green(`Skipping git commit`));
    return;
  }
  console.log(chalk.gray(`Committing changes`));
  const { stdout: commitStdout, stderr: commitStderr } = await exec(
    `git add . && git commit -m "Add flaky test detection"`
  );
  if (commitStderr) {
    console.log(chalk.red(commitStderr));
  }
  console.log(chalk.green(`Done!`));
  if (local) {
    console.log(chalk.green(`Skipping git push`));
  } else {
    console.log(chalk.gray(`Pushing changes`));
    const { stdout: pushStdout, stderr: pushStderr } = await exec(
      `git push --set-upstream origin ${prefix}/build-${analyzedRun}`
    );
    if (pushStderr) {
      console.log(chalk.red(pushStderr));
    }
    console.log(chalk.green(`Done!`));
  }
  console.log(chalk.green(`Branch created!`));
  console.log(chalk.gray(`Switching back to '${currentBranch}' branch`));
  const { stdout: checkoutStdout, stderr: checkoutStderr } = await exec(
    `git checkout ${currentBranch}`
  );
  if (checkoutStderr) {
    console.log(chalk.red(checkoutStderr));
  }
  console.log(chalk.green(`Done!`));
}

export function registerCreateBranchCommand(program: Command) {
  program
    .command('branch')
    .argument('<planKey>', 'Bamboo plan key to work on')
    .argument('<latestSuccess>', 'Latest successful run before analyzed run')
    .argument('<analyzedRun>', 'Analyzed run')
    .option(
      '-p, --prefix <prefix>',
      'Prefix for the created branch',
      'flaky-history'
    )
    .option('-g, --skip-git', 'Skip git commands')
    .option('-l, --local', "Don't push to remote")
    .option('-t, --token <token>', 'Bamboo access token')
    .action((planKey, latestSuccess, analyzedRun, options) =>
      createBranch(planKey, latestSuccess, analyzedRun, options)
    );
}
