import jetpack from 'fs-jetpack';
import minimatch from 'minimatch';
import chalk from 'chalk';

export const compareFiles = async (
  path: string,
  changedFiles: string[],
  commitNumber: number,
  json: boolean = false
): Promise<boolean> => {
  const coverageFolder = jetpack.cwd(path);
  const coverageFiles = await coverageFolder.findAsync({
    matching: '*files.json',
  });
  if (coverageFiles.length === 0) {
    if (json) {
      console.log(`"error": "No coverage files found"`);
    } else {
      console.log(chalk.red(`No coverage files found`));
    }
    return true;
  }
  if (json) {
    console.log(
      `"commitNumber": "${commitNumber}", "changedFileNum": ${JSON.stringify(
        changedFiles.length
      )}, "coverageFiles": ${JSON.stringify(coverageFiles)},`
    );
  } else {
    console.log(
      chalk.gray(
        `Comparing ${commitNumber} commits with ${coverageFiles.length} coverage files`
      )
    );
    console.log(
      chalk.gray(
        `Changed files: ${changedFiles.length} files changed in ${commitNumber} commits`
      )
    );
  }
  let nonFlakyFail = false;
  let isFirst = true;
  if (json) {
    console.log(`"testResults": [`);
  }
  for (const file of coverageFiles) {
    const testName = file.split('-')[0];
    const rawFiles = (await coverageFolder.readAsync(file, 'json')) as string[];
    const coveredFiles = rawFiles.map((f) => f.replaceAll('\\', '/'));
    const changedFilesForTest = changedFiles
      .filter((f: string) =>
        coveredFiles
          .map((path) =>
            path.includes('src/main/java')
              ? path
              : path.replace(
                  'de/tum/in/www1/artemis/',
                  'src/main/java/de/tum/in/www1/artemis/'
                )
          )
          .some((cf: string) => minimatch(`${cf}`, `${f}`))
      )
      .map((path) => {
        if (path.includes('node_modules')) {
          return chalk.yellow(
            `Dependency: ${path.split('node_modules/')[1].replace('/**/*', '')}`
          );
        }
        return path;
      });
    if (changedFilesForTest.length > 0) {
      nonFlakyFail = true;
      if (!json) {
        console.log(
          chalk.red(
            `\nTest ${testName} has covered ${chalk.bold(
              changedFilesForTest.length
            )} changes that appeared in your commit range`
          )
        );
        console.log(changedFilesForTest.join(`\n`));
      } else {
        if (!isFirst) {
          console.log(`,`);
        }
        isFirst = false;
        console.log(
          `{"testName": "${testName}", "changedFiles": ${JSON.stringify(
            changedFilesForTest
          )}, "coveredFileNum": ${JSON.stringify(coveredFiles.length)}}`
        );
      }
    } else {
      if (!json) {
        console.log(
          chalk.green(
            `Test ${testName} has not covered any changes that appeared in your commit range`
          )
        );
      } else {
        if (!isFirst) {
          console.log(`,`);
        }
        isFirst = false;
        console.log(
          `{"testName": "${testName}", "changedFiles": ${JSON.stringify(
            changedFilesForTest
          )}, "coveredFileNum": ${JSON.stringify(coveredFiles.length)}}`
        );
      }
    }
  }
  if (json) {
    console.log(`],`);
  }
  return nonFlakyFail;
};
