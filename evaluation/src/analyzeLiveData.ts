import * as dotenv from "dotenv";
dotenv.config();
import jetpack from "fs-jetpack";
import lodash from "lodash";
import { stringify } from "csv/sync";

export interface LiveData {
  branchData: BranchDataEntity[];
  flakyTestStats: FlakyTestStatsEntity[];
}
export interface BranchDataEntity {
  flakyKey: string;
  regularKey: string;
  name: string;
  results: ResultsEntity[];
}
export interface ResultsEntity {
  regularBuild: RegularBuildOrFlakyBuild;
  flakyBuild: RegularBuildOrFlakyBuild;
  flakyTests: FlakyTestsEntityOrRegularTestsEntity[];
  regularTests: FlakyTestsEntityOrRegularTestsEntity1[];
  combinedTests: CombinedTestsEntity[];
  flakyFailed: number[];
  regularFailed: number[];
  onlyRunInFlaky: number[];
  onlyRunInRegular: number[];
}
export interface RegularBuildOrFlakyBuild {
  key: string;
  label: string;
  state: string;
  startTime: string;
  completeTime: string;
  duration: number;
  buildNumber: number;
  successful: boolean;
}
export interface FlakyTestsEntityOrRegularTestsEntity {
  methodName: string;
  status: string;
  successful: boolean;
}
export interface FlakyTestsEntityOrRegularTestsEntity1 {
  methodName: string;
  status: string;
  successful: boolean;
}
export interface CombinedTestsEntity {
  methodName: string;
  flakyStatus: string;
  regularStatus: string;
  flakySuccessful: boolean;
  regularSuccessful: boolean;
}
export interface FlakyTestStatsEntity {
  test: string;
  successful: number;
  failed: number;
  total: number;
  flaky: number;
}

const toLatexNum = (num: any) => `\\num{${num}}`;

const liveData = jetpack.read("data/live-data.json", "json") as LiveData;

liveData.branchData = liveData.branchData
  .map((branchData) => ({
    ...branchData,
    results: branchData.results.filter((result) => {
      if (result.regularTests.length === 0 || result.flakyTests.length === 0) {
        console.log("excluded build because no tests", result.regularBuild.key);
        return false;
      }
      if (result.regularBuild.successful === false) {
        if (!result.regularFailed.length) {
          console.log(
            "excluded build because regular build failed and no regular failed tests",
            result.regularBuild.key
          );
          return false;
        }
      }
      if (result.flakyBuild.successful === false) {
        if (!result.flakyFailed.length) {
          console.log(
            "excluded build because flaky build failed and no flaky failed tests",
            result.flakyBuild.key
          );
          return false;
        }
      }
      if (result.regularBuild.duration < 1000 * 60 * 20) {
        console.log(
          "excluded build because of short regular build duration",
          result.regularBuild.duration / 1000 / 60,
          result.regularBuild.key
        );
        return false;
      }
      if (result.flakyBuild.duration < 1000 * 60 * 20) {
        console.log(
          "excluded build because of short flaky build duration",
          result.flakyBuild.duration / 1000 / 60,
          result.flakyBuild.key
        );
        return false;
      }
      return true;
    }),
  }))
  .filter((branch) => branch.results.length > 0);

const data = lodash.chain(liveData);

const rawdata = lodash.chain(
  jetpack.read("data/live-data.json", "json") as LiveData
);

const totalResultCount = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .value().length;

console.log(totalResultCount, "totalResultCount");

const rawResultCount = rawdata
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .value().length;

console.log(rawResultCount, "rawResultCount");

const branchCount = data.get("branchData").value().length;

console.log(branchCount, "branchCount");

const rawBranchCount = rawdata.get("branchData").value().length;

console.log(rawBranchCount, "rawBranchCount");

const averageDuration = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .map((result) => result.regularBuild.duration / 1000 / 60)
  .mean()
  .value();

console.log(averageDuration, "min averageDuration");

const failedRegularBuilds = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.regularBuild.successful === false)
  .value().length;

console.log(failedRegularBuilds, "failedRegularBuilds");

const failedRegularBuildsOrReruns = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter(
    (result) =>
      result.regularBuild.successful === false || !!result.regularBuild.label
  )
  .value().length;

console.log(failedRegularBuildsOrReruns, "failedRegularBuildsOrReruns");

const failedFlakyBuilds = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.flakyBuild.successful === false)
  .value().length;

console.log(failedFlakyBuilds, "failedFlakyBuilds");

const passedRegularBuilds = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.regularBuild.successful === true)
  .value().length;

console.log(passedRegularBuilds, "passedRegularBuilds");

const passedRegularBuildsNoReruns = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter(
    (result) =>
      result.regularBuild.successful === true && !result.regularBuild.label
  )
  .value().length;

console.log(passedRegularBuildsNoReruns, "passedRegularBuildsNoReruns");

const passedFlakyBuilds = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.flakyBuild.successful === true)
  .value().length;

console.log(passedFlakyBuilds, "passedFlakyBuilds");

const infoTable = [
  ["", "Instrumented", "Non Instrumented"],
  [
    "Passed",
    passedFlakyBuilds,
    passedRegularBuildsNoReruns,
  ],
  [
    "Failed",
    failedFlakyBuilds,
    failedRegularBuildsOrReruns,
  ],
];

const infoTableWithReruns = [
  ["", "Instrumented", "Non Instrumented"],
  ["Passed", passedFlakyBuilds, passedRegularBuilds],
  ["Failed", failedFlakyBuilds, failedRegularBuilds],
];

console.log(infoTable);
console.log(infoTableWithReruns);

const allBuildsInfo = [
  ["instrumented", "result"],
  ...data
    .get("branchData")
    .flatMap((branchData) => branchData.results)
    .flatMap((result) => [
      ["instrumented", result.flakyBuild.successful ? "passed" : "failed"],
      ["non-instrumented", result.regularBuild.successful ? "passed" : "failed"],
    ])
    .value(),
]

jetpack.write("data/artemis-allBuildsInfo.csv", stringify(allBuildsInfo));

const allBuildsWithRerunAsFail = [
  ["instrumented", "result"],
  ...data
    .get("branchData")
    .flatMap((branchData) => branchData.results)
    .flatMap((result) => [
      ["instrumented", result.flakyBuild.successful ? "passed" : "failed"],
      ["non-instrumented", (result.regularBuild.label || !result.regularBuild.successful) ? "failed" : "passed"],
    ])
    .value(),
]

jetpack.write("data/artemis-allBuildsWithRerunAsFail.csv", stringify(allBuildsWithRerunAsFail));

jetpack.write("../thesis/data/artemis-runResults.csv", stringify(infoTable));
jetpack.write(
  "../thesis/data/artemis-runResults-withReruns.csv",
  stringify(infoTableWithReruns)
);

const averageFlakyDuration = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .map((result) => result.flakyBuild.duration / 1000 / 60)
  .mean()
  .value();

console.log(averageFlakyDuration, "min averageFlakyDuration");

const averagePassedDurationRegular = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.regularBuild.successful === true)
  .map((result) => result.regularBuild.duration / 1000 / 60)
  .mean()
  .value();

console.log(averagePassedDurationRegular, "min averagePassedDurationRegular");

const averagePassedDurationFlaky = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.flakyBuild.successful === true)
  .map((result) => result.flakyBuild.duration / 1000 / 60)
  .mean()
  .value();

console.log(averagePassedDurationFlaky, "min averagePassedDurationFlaky");

const averageFailedDurationRegular = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.regularBuild.successful === false)
  .map((result) => result.regularBuild.duration / 1000 / 60)
  .mean()
  .value();

console.log(averageFailedDurationRegular, "min averageFailedDurationRegular");

const averageFailedDurationFlaky = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.flakyBuild.successful === false)
  .map((result) => result.flakyBuild.duration / 1000 / 60)
  .mean()
  .value();

console.log(averageFailedDurationFlaky, "min averageFailedDurationFlaky");

// Calculate the percent change between the two averages
const percentChange = (a:number, b:number) => ((b - a) / a) * 100;

const percentChangePassed = percentChange(
  averagePassedDurationRegular,
  averagePassedDurationFlaky
);

const percentChangeFailed = percentChange(
  averageFailedDurationRegular,
  averageFailedDurationFlaky
);

const averageDurationTable = [
  ["Result", "Duration (min)", "Instrumented Duration (min)", "Change"],
  [
    "Passed",
    toLatexNum(averagePassedDurationRegular),
    toLatexNum(averagePassedDurationFlaky),
    toLatexNum(percentChangePassed)+" \\%",
  ],
  [
    "Failed",
    toLatexNum(averageFailedDurationRegular),
    toLatexNum(averageFailedDurationFlaky),
    toLatexNum(percentChangeFailed)+" \\%",
  ],
];

const failedDurationsRegular = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.regularBuild.successful === false)
  .map((result) => result.regularBuild.duration)
  .map((duration) => duration / 1000 / 60)
  .value();

const failedDurationsFlaky = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.flakyBuild.successful === false)
  .map((result) => result.flakyBuild.duration)
  .map((duration) => duration / 1000 / 60)
  .value();

const passedDurationsRegular = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.regularBuild.successful === true)
  .map((result) => result.regularBuild.duration)
  .map((duration) => duration / 1000 / 60)
  .value();

const passedDurationsFlaky = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.flakyBuild.successful === true)
  .map((result) => result.flakyBuild.duration)
  .map((duration) => duration / 1000 / 60)
  .value();

const spssTable = [
  ["Group", "Duration (min)"],
  ...failedDurationsRegular.map((duration) => ["FR", duration]),
  ...failedDurationsFlaky.map((duration) => ["FF", duration]),
  ...passedDurationsRegular.map((duration) => ["PR", duration]),
  ...passedDurationsFlaky.map((duration) => ["PF", duration]),
];

jetpack.write("data/artemis-spss.csv", stringify(spssTable));

const dataPath = "../thesis/data/artemis/";

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

console.log(averageDurationTable);

jetpack.write(
  "../thesis/data/artemis-durationResults.csv",
  stringify(averageDurationTable)
);

const labeledFlakyResults = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => !!result.flakyBuild.label)
  .value().length;

console.log(labeledFlakyResults, "labeledFlakyResults");

const knownTruePositive = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => !!result.flakyBuild.label)
  .filter((result) => {
    if (result.flakyBuild.successful === false) {
      if (result.regularBuild.successful === true) {
        return true;
      }
      const testsFailedInFlaky = result.flakyTests.filter(
        (test) => test.successful === false
      );
      const testsFailedInRegular = result.regularTests.filter(
        (test) => test.successful === false
      );
      const testIntersection = testsFailedInFlaky.filter((test) =>
        testsFailedInRegular.some(
          (otherTest) => otherTest.methodName === test.methodName
        )
      );
      if (testIntersection.length == 0) {
        return true;
      }
    }
    return false;
  })
  .value().length;

console.log(knownTruePositive, "knownTruePositive");

const knownFalseNegative = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => !result.flakyBuild.label)
  .filter((result) => result.flakyBuild.successful === false)
  .filter((result) => {
    if (result.flakyBuild.successful === false) {
      if (result.regularBuild.successful === true) {
        return true;
      }
      const testsFailedInFlaky = result.flakyTests.filter(
        (test) => test.successful === false
      );
      const testsFailedInRegular = result.regularTests.filter(
        (test) => test.successful === false
      );
      const testIntersection = testsFailedInFlaky.filter((test) =>
        testsFailedInRegular.some(
          (otherTest) => otherTest.methodName === test.methodName
        )
      );
      if (testIntersection.length == 0) {
        return true;
      }
    }
    return false;
  })
  .value().length;

const likelyTrueNegatives = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => !result.flakyBuild.label)
  .filter((result) => result.flakyBuild.successful === false)
  .filter((result) => {
    if (result.flakyBuild.successful === false) {
      if (result.regularBuild.successful === true) {
        return false;
      }
      const testsFailedInFlaky = result.flakyTests.filter(
        (test) => test.successful === false
      );
      const testsFailedInRegular = result.regularTests.filter(
        (test) => test.successful === false
      );
      const testIntersection = testsFailedInFlaky.filter((test) =>
        testsFailedInRegular.some(
          (otherTest) => otherTest.methodName === test.methodName
        )
      );
      const similarity =
        (testIntersection.length * 2) /
        (testsFailedInFlaky.length + testsFailedInRegular.length);
      if (similarity > 0.75) {
        return true;
      }
    }
    return false;
  })
  .value().length;

console.log(likelyTrueNegatives, "likelyTrueNegatives");

const likelyFalsePositives = data
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => !!result.flakyBuild.label)
  .filter((result) => result.flakyBuild.successful === false)
  .filter((result) => {
    if (result.flakyBuild.successful === false) {
      if (result.regularBuild.successful === true) {
        return false;
      }
      const testsFailedInFlaky = result.flakyTests.filter(
        (test) => test.successful === false
      );
      const testsFailedInRegular = result.regularTests.filter(
        (test) => test.successful === false
      );
      const testIntersection = testsFailedInFlaky.filter((test) =>
        testsFailedInRegular.some(
          (otherTest) => otherTest.methodName === test.methodName
        )
      );
      const similarity =
        (testIntersection.length * 2) /
        (testsFailedInFlaky.length + testsFailedInRegular.length);
      if (similarity > 0.75) {
        return true;
      }
    }
    return false;
  })
  .value().length;

console.log(likelyFalsePositives, "likelyFalsePositives");

console.log(knownFalseNegative, "knownFalseNegative");

const unlabeledFlakyFails = failedFlakyBuilds - labeledFlakyResults;

const maxFlasePositives = labeledFlakyResults - knownTruePositive;
const maxTruePositives = labeledFlakyResults - likelyFalsePositives;

console.log(maxFlasePositives, "maxFlasePositives");

const maxTrueNegatives = unlabeledFlakyFails - knownFalseNegative;
const maxFalseNegatives = unlabeledFlakyFails - likelyTrueNegatives;

console.log(maxTrueNegatives, "maxTrueNegatives");
console.log(maxFalseNegatives, "maxFalseNegatives");

const precision = knownTruePositive / (knownTruePositive + maxFlasePositives);
const recall = knownTruePositive / (knownTruePositive + maxFalseNegatives);

const bestPrecision = maxTruePositives / (maxTruePositives + likelyFalsePositives);
const bestRecall = maxTruePositives / (maxTruePositives + knownFalseNegative);

console.log(precision, "precision");
console.log(recall, "recall");

console.log(bestPrecision, "bestPrecision");
console.log(bestRecall, "bestRecall");

const f1 = 2 * (precision * recall) / (precision + recall);
const bestF1 = 2 * (bestPrecision * bestRecall) / (bestPrecision + bestRecall);

console.log(f1, "f1");
console.log(bestF1, "bestF1");

const resultsCsv = [
  [
    "True Positives",
    "False Positives",
    "True Negatives",
    "False Negatives",
    "Precision",
    "Recall",
    "F1",
  ],
  [
    toLatexNum(knownTruePositive),
    toLatexNum(maxFlasePositives),
    toLatexNum(likelyTrueNegatives),
    toLatexNum(maxFalseNegatives),
    toLatexNum(precision),
    toLatexNum(recall),
    toLatexNum(f1),
  ],
];

jetpack.write(
  "../thesis/data/artemis-evaluationResult.csv",
  stringify(resultsCsv, { quoted: true })
    .replace(/(?<=^|,)"/gm, "{")
    .replace(/"(?=$|,)/gm, "}")
);
