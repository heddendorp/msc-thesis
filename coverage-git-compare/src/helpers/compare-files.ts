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
  if (json) {
    console.log(`"commitNumber": "${commitNumber}", "changedFiles": [`);
    changedFiles.forEach((file, index) => {
      console.log(`"${file}"${index < changedFiles.length - 1 ? ',' : ''}`);
    });
    console.log(`], "coverageFiles": [`);
    coverageFiles.forEach((file, index) => {
      console.log(`"${file}"${index < changedFiles.length - 1 ? ',' : ''}`);
    });
    console.log(`],`);
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
  if (json) {
    console.log(`"testResults": [`);
  }
  for (const file of coverageFiles) {
    const testName = file.split('-')[0];
    const rawFiles = (await coverageFolder.readAsync(file, 'json')) as string[];
    const coveredFiles = rawFiles.map((f) => f.replaceAll('\\', '/'));
    const changedFilesForTest = changedFiles
      .filter((f: string) =>
        coveredFiles.some((cf: string) => minimatch(cf, f))
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
        console.log(
          `{"testName": "${testName}", "changedFiles": [${changedFilesForTest.join(
            ','
          )}]},`
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
        console.log(`{"testName": "${testName}", "changedFiles": []},`);
      }
    }
  }
  if (json) {
    console.log(`],`);
  }
  return nonFlakyFail;
};
