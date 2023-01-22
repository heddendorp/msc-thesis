import jetpack from 'fs-jetpack';
import minimatch from 'minimatch';
import chalk from 'chalk';

export const compareLines = async (
  path: string,
  changesLines: {file: string, lines: number[]}[],
  commitNumber: number,
  json: boolean = false
): Promise<boolean> => {
  const coverageFolder = jetpack.cwd(path);
  const coverageFiles = await coverageFolder.findAsync({
    matching: '*lines.json',
  });
  if (json) {
    console.log(`"lineCheck":{"commitNumber": "${commitNumber}", "lineCheck":true, "changedFiles": ${JSON.stringify(changesLines)}, "coverageFiles": ${JSON.stringify(coverageFiles)},`);
  } else {
    console.log(
      chalk.gray(
        `Comparing ${commitNumber} commits with ${coverageFiles.length} coverage files`
      )
    );
    console.log(
      chalk.gray(
        `Changed files: ${changesLines.length} files changed in ${commitNumber} commits`
      )
    );
  }
  if(coverageFiles.length === 0) {
    if(json) {
      console.log(`"error": "No coverage files found"`);
    } else {
      console.log(chalk.red(`No coverage files found`));
    }
    return true;
  }
  let nonFlakyFail = false;
  let isFirst = true;
  if (json) {
    console.log(`"testResults": [`);
  }
  for (const file of coverageFiles) {
    const testName = file.split('-')[0];
    const rawLines = (await coverageFolder.readAsync(file, 'json')) as {file: string, lines: number[]}[];
    const coveredFiles = rawLines.map((f) => ({...f, file: f.file.replace(/\\/g, '/')}));
    const changedLinesForTest = changesLines
      .filter((entry: {file: string, lines: number[]}) =>
        coveredFiles.filter((cf) => minimatch(entry.file, cf.file))
        .filter((cf) => cf.lines.some((l) => entry.lines.includes(l))).length > 0
      );
    if (changedLinesForTest.length > 0) {
      nonFlakyFail = true;
      if (!json) {
        console.log(
          chalk.red(
            `\nTest ${testName} has covered ${chalk.bold(
              changedLinesForTest.length
            )} changes that appeared in your commit range`
          )
        );
        console.log(changedLinesForTest.map(entry => `${entry.file} lines ${entry.lines.join(',')}`).join(`\n`));
      } else {
        if (!isFirst) {
          console.log(`,`);
        }
        isFirst = false;
        console.log(
          `{"testName": "${testName}", "changedFiles": ${JSON.stringify(
            changedLinesForTest
          )}, "coveredFiles": ${JSON.stringify(coveredFiles)}}`
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
            changedLinesForTest
          )}, "coveredFiles": ${JSON.stringify(coveredFiles)}}`
        );
      }
    }
  }
  if (json) {
    console.log(`]},`);
  }
  return nonFlakyFail;
};