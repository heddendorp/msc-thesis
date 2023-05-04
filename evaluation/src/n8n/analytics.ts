import * as dotenv from "dotenv";
dotenv.config();
import { Octokit } from "octokit";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import lodash from "lodash";

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { stringify } from "csv/sync";
import jetpack from "fs-jetpack";

const toLatexNum = (num: any) => `\\num{${num}}`;

type Data = {
  baseLine: {
    commits: {
      sha: string;
      parent: string;
      branch: string;
      successful: boolean;
      runs: {
        id: number;
        conclusion: string;
        installDuration: number;
        testDuration: number;
        installConclusion: string;
        testConclusion: string;
      }[];
    }[];
  };
  timings: {
    runs: {
      id: number;
      conclusion: string;
      installDuration: number;
      testDuration: number;
      testInstrumentedDuration: number;
      installConclusion: string;
      testConclusion: string;
      testInstrumentedConclusion: string;
      sha: string;
      passed: boolean;
      passedInstrumented: boolean;
    }[];
    testcases: {
      name: string;
      averageDuration: number;
      averageDurationInstrumented: number;
      results: {
        passed: number;
        failed: number;
        skipped: number;
      };
      resultsInstrumented: {
        passed: number;
        failed: number;
        skipped: number;
      };
    }[];
  };
};

class LowWithLodash<T> extends Low<T> {
  chain: lodash.ExpChain<this["data"]> = lodash.chain(this).get("data");
}

// File path
const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "db.json");

// Configure lowdb to write to JSONFile
const adapter = new JSONFile<Data>(file);
const db = new LowWithLodash(adapter);

// Read data from JSON file, this will set db.data content
await db.read();

// If file.json doesn't exist, db.data will be null
// Set default data
db.data ||= { baseLine: { commits: [] }, timings: { runs: [], testcases: [] } };
db.data.baseLine ||= { commits: [] };
db.data.timings ||= { runs: [], testcases: [] };

if (!db.data) {
  throw new Error("no data");
}

// find longest test duration
const longestTestDuration = db.chain
  .get("baseLine.commits")
  .flatMap((commit) => commit.runs)
  .maxBy((run) => run.testDuration)
  .get("testDuration")
  .value();

// find longest duration of a successful run
const longestSuccessfulTestDuration = db.chain
  .get("baseLine.commits")
  .flatMap((commit) => commit.runs)
  .filter((run) => run.conclusion === "success")
  .maxBy((run) => run.testDuration)
  .get("testDuration")
  .value();

// transform to minutes
const longestTestDurationMinutes = Math.round(longestTestDuration / 1000 / 60);
console.log(
  `The longest test execution took ${longestTestDurationMinutes} minutes`
);

// transform to minutes
const longestSuccessfulTestDurationMinutes = Math.round(
  longestSuccessfulTestDuration / 1000 / 60
);
console.log(
  `The longest successful test execution took ${longestSuccessfulTestDurationMinutes} minutes`
);
console.log();

// check if there are duplicate commits in the db
const duplicateCommits = db.chain
  .get("baseLine.commits")
  .groupBy("sha")
  .pickBy((commits) => commits.length > 1)
  .value();

if (Object.keys(duplicateCommits).length > 0) {
  console.log(
    `${Object.keys(duplicateCommits).length} duplicate commits found`
  );

  // merge duplicate commits while preventing duplicate runs
  const mergedCommits = Object.values(duplicateCommits).map((commits) => {
    const mergedCommit = commits[0];
    const runs = commits.flatMap((commit) => commit.runs);
    mergedCommit.runs = lodash.uniqBy(runs, "id");
    return mergedCommit;
  });

  // replace duplicate commits with merged commits

  db.chain
    .get("baseLine.commits")
    .remove((commit) => duplicateCommits[commit.sha])
    .value();

  db.chain
    .get("baseLine.commits")
    .push(...mergedCommits)
    .value();
}

// Analyze testcases with regards to their duration and results

// check for how many testcases the instrumented duration is longer than the non-instrumented duration

const testcasesWithLongerInstrumentedDuration = db.chain
  .get("timings.testcases")
  .filter(
    (testcase) =>
      testcase.averageDurationInstrumented > testcase.averageDuration
  )
  .value();

// Calculate a percentage

const percentage = (value: number, total: number) =>
  Math.round((value / total) * 100);

const median = (array: Array<number>) => {
  array.sort((a, b) => b - a);
  const length = array.length;
  if (length % 2 == 0) {
    return (array[length / 2] + array[length / 2 - 1]) / 2;
  } else {
    return array[Math.floor(length / 2)];
  }
};

// Calculate the percentage of testcases with longer instrumented duration

const percentageOfTestcasesWithLongerInstrumentedDuration = percentage(
  testcasesWithLongerInstrumentedDuration.length,
  db.data.timings.testcases.length
);

console.log(
  `${percentageOfTestcasesWithLongerInstrumentedDuration}% of testcases have a longer instrumented duration`
);

// calculte how much longer the instrumented duration is on average

const averageDurationDifference = db.chain
  .get("timings.testcases")
  .map((testcase) => {
    return testcase.averageDurationInstrumented - testcase.averageDuration;
  })
  .mean()
  .value();

const averageDurationIncrease = db.chain
  .get("timings.testcases")
  .map((testcase) => {
    return (
      (testcase.averageDurationInstrumented - testcase.averageDuration) /
      testcase.averageDuration
    );
  })
  .mean()
  .value();

const medianDurationDifference = median(
  db.chain
    .get("timings.testcases")
    .map((testcase) => {
      return testcase.averageDurationInstrumented - testcase.averageDuration;
    })
    .value()
);

console.log(
  `The average duration difference is ${Math.round(
    averageDurationDifference
  )}ms`
);

console.log(
  `The average duration increase is ${Math.round(
    averageDurationIncrease * 100
  )}%`
);

console.log(
  `The median duration difference is ${Math.round(medianDurationDifference)}ms`
);

const numberOfFailedTestcases = db.chain
  .get("timings.testcases")
  .filter((testcase) => testcase.results.failed > 0)
  .value().length;

const percentageOfFailedTestcases = percentage(
  numberOfFailedTestcases,
  db.data.timings.testcases.length
);

console.log(
  `${percentageOfFailedTestcases}% of testcases have failed at least once`
);

const numberOfFailedTestcasesInstrumented = db.chain
  .get("timings.testcases")
  .filter((testcase) => testcase.resultsInstrumented.failed > 0)
  .value().length;

const percentageOfFailedTestcasesInstrumented = percentage(
  numberOfFailedTestcasesInstrumented,
  db.data.timings.testcases.length
);

console.log(
  `${percentageOfFailedTestcasesInstrumented}% of testcases have failed at least once when instrumented`
);

const averageDurationPassed = db.chain
  .get("timings.runs")
  .filter((run) => run.passed)
  .map((run) => run.testDuration)
  .map((duration) => duration / 1000 / 60)
  .mean()
  .value();

const averageDurationPassedInstrumented = db.chain
  .get("timings.runs")
  .filter((run) => run.passedInstrumented)
  .map((run) => run.testInstrumentedDuration)
  .map((duration) => duration / 1000 / 60)
  .mean()
  .value();

const averageDurationFailed = db.chain
  .get("timings.runs")
  .filter((run) => !run.passed)
  .map((run) => run.testDuration)
  .map((duration) => duration / 1000 / 60)
  .mean()
  .value();

const averageDurationFailedInstrumented = db.chain
  .get("timings.runs")
  .filter((run) => !run.passedInstrumented)
  .map((run) => run.testInstrumentedDuration)
  .map((duration) => duration / 1000 / 60)
  .mean()
  .value();

  // Calculate the percent change between the two averages
const percentChange = (a:number, b:number) => ((b - a) / a) * 100;

const percentChangePassed = percentChange(
  averageDurationPassed,
  averageDurationPassedInstrumented
);

const percentChangeFailed = percentChange(
  averageDurationFailed,
  averageDurationFailedInstrumented
);

const csvDurationTable = [
  ["Result", "Duration (min)", "Instrumented Duration (min)", "Change"],
  [
    "Passed",
    toLatexNum(averageDurationPassed),
    toLatexNum(averageDurationPassedInstrumented),
    toLatexNum(percentChangePassed)+" \\%",
  ],
  [
    "Failed",
    toLatexNum(averageDurationFailed),
    toLatexNum(averageDurationFailedInstrumented),
    toLatexNum(percentChangeFailed)+" \\%",
  ],
];

const durationsPassed = db.chain
  .get("timings.testcases")
  .filter((testcase) => testcase.results.passed > 0)
  .map((testcase) => testcase.averageDuration)
  .value();

const durationsPassedInstrumented = db.chain
  .get("timings.testcases")
  .filter((testcase) => testcase.resultsInstrumented.passed > 0)
  .map((testcase) => testcase.averageDurationInstrumented)
  .value();

const durationsFailed = db.chain
  .get("timings.testcases")
  .filter((testcase) => testcase.results.failed > 0)
  .map((testcase) => testcase.averageDuration)
  .value();

const durationsFailedInstrumented = db.chain
  .get("timings.testcases")
  .filter((testcase) => testcase.resultsInstrumented.failed > 0)
  .map((testcase) => testcase.averageDurationInstrumented)
  .value();

jetpack.write(
  "../thesis/data/durationResults.csv",
  stringify(csvDurationTable)
);

// Build a table with counts of successful, failed and skipped testcases instrumented and non-instrumented

const table: {
  passed: { instrumented: number; nonInstrumented: number };
  failed: { instrumented: number; nonInstrumented: number };
  skipped: { instrumented: number; nonInstrumented: number };
} = {
  passed: { instrumented: 0, nonInstrumented: 0 },
  failed: { instrumented: 0, nonInstrumented: 0 },
  skipped: { instrumented: 0, nonInstrumented: 0 },
};

db.data.timings.testcases.forEach((testcase) => {
  table.passed.instrumented += testcase.resultsInstrumented.passed;
  table.passed.nonInstrumented += testcase.results.passed;
  table.failed.instrumented += testcase.resultsInstrumented.failed;
  table.failed.nonInstrumented += testcase.results.failed;
  table.skipped.instrumented += testcase.resultsInstrumented.skipped;
  table.skipped.nonInstrumented += testcase.results.skipped;
});

console.table(table);

const csvTable = [
  ["Result", "Instrumented", "Non-Instrumented"],
  ["Passed", table.passed.instrumented, table.passed.nonInstrumented],
  ["Failed", table.failed.instrumented, table.failed.nonInstrumented],
  ["Skipped", table.skipped.instrumented, table.skipped.nonInstrumented],
];

jetpack.write("../thesis/data/testcaseResults.csv", stringify(csvTable));

// Build a table with the successful runs vs failed runs for instrumented and non-instrumented

const table2: {
  successful: { instrumented: number; nonInstrumented: number };
  failed: { instrumented: number; nonInstrumented: number };
} = {
  successful: { instrumented: 0, nonInstrumented: 0 },
  failed: { instrumented: 0, nonInstrumented: 0 },
};

db.chain
  .get("timings.runs")
  .forEach((run) => {
    if (run.passed) {
      table2.successful.nonInstrumented++;
    } else {
      table2.failed.nonInstrumented++;
    }
    if (run.passedInstrumented) {
      table2.successful.instrumented++;
    } else {
      table2.failed.instrumented++;
    }
  })
  .value();

console.table(table2);

const csvTable2 = [
  ["Result", "Instrumented", "Non Instrumented"],
  ["Passed", table2.successful.instrumented, table2.successful.nonInstrumented],
  ["Failed", table2.failed.instrumented, table2.failed.nonInstrumented],
];

jetpack.write("../thesis/data/runResults.csv", stringify(csvTable2));

// Build a table with testcases that have failed at least once and their stats

const table3 = db.chain
  .get("timings.testcases")
  .filter(
    (testcase) =>
      testcase.results.failed > 0 || testcase.resultsInstrumented.failed > 0
  )
  .map((testcase) => {
    return {
      name: testcase.name,
      // averageDuration: testcase.averageDuration,
      // averageDurationInstrumented: testcase.averageDurationInstrumented,
      // averageDurationDifference:
      //   testcase.averageDurationInstrumented - testcase.averageDuration,
      durationIncrease: toLatexNum(
        percentage(
          testcase.averageDurationInstrumented - testcase.averageDuration,
          testcase.averageDuration
        )
      ),
      // numberOfRuns: testcase.results.passed + testcase.results.failed,
      // numberOfRunsInstrumented:
      //   testcase.resultsInstrumented.passed +
      //   testcase.resultsInstrumented.failed,
      failed: testcase.results.failed,
      failedInstrumented: testcase.resultsInstrumented.failed,
      passed: testcase.results.passed,
      passedInstrumented: testcase.resultsInstrumented.passed,
      // percentageOfFailedRuns: percentage(
      //   testcase.results.failed,
      //   testcase.results.passed + testcase.results.failed
      // ),
      // percentageOfFailedRunsInstrumented: percentage(
      //   testcase.resultsInstrumented.failed,
      //   testcase.resultsInstrumented.passed +
      //     testcase.resultsInstrumented.failed
      // ),
    };
  })
  .sortBy("failedInstrumented")
  .value();

console.table(table3);

jetpack.write(
  "../thesis/data/testcaseStats.csv",
  stringify(table3, { header: true, quoted: true })
    .replace(/(?<=^|,)"/gm, "{")
    .replace(/"(?=$|,)/gm, "}")
);

await db.write();

// Export of timings to csv

const dataPath = "../thesis/data/n8n/";

const failedDurationsRegular = db.chain
  .get("timings.runs")
  .filter((run) => !run.passed)
  .map((run) => run.testDuration)
  .map((duration) => duration / 1000 / 60)
  .value();

const failedDurationsFlaky = db.chain
  .get("timings.runs")
  .filter((run) => !run.passedInstrumented)
  .map((run) => run.testInstrumentedDuration)
  .map((duration) => duration / 1000 / 60)
  .value();

const passedDurationsRegular = db.chain
  .get("timings.runs")
  .filter((run) => run.passed)
  .map((run) => run.testDuration)
  .map((duration) => duration / 1000 / 60)
  .value();

const passedDurationsFlaky = db.chain
  .get("timings.runs")
  .filter((run) => run.passedInstrumented)
  .map((run) => run.testInstrumentedDuration)
  .map((duration) => duration / 1000 / 60)
  .value();

const spssTable = [
  ["Group", "Duration (min)", "exp", "res"],
  ...failedDurationsRegular.map((duration) => ["FR", duration, "regular", "failed"]),
  ...failedDurationsFlaky.map((duration) => ["FF", duration, "flaky", "failed"]),
  ...passedDurationsRegular.map((duration) => ["PR", duration, "regular", "passed"]),
  ...passedDurationsFlaky.map((duration) => ["PF", duration,  "flaky", "passed"]),
];

jetpack.write("data/n8n-spss.csv", stringify(spssTable));

// const dataPath = "../thesis/data/artemis/";

jetpack.write(
  dataPath + "failedDurationsRegular.csv",
  stringify(failedDurationsRegular.map((duration) => [duration]))
);

jetpack.write(
  dataPath + "failedDurationsFlaky.csv",
  stringify(failedDurationsFlaky.map((duration) => [duration]))
);

jetpack.write(
  dataPath + "passedDurationsRegular.csv",
  stringify(passedDurationsRegular.map((duration) => [duration]))
);

jetpack.write(
  dataPath + "passedDurationsFlaky.csv",
  stringify(passedDurationsFlaky.map((duration) => [duration]))
);
