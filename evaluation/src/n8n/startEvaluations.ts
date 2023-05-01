import * as dotenv from "dotenv";
dotenv.config();
import { Octokit } from "octokit";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "util";
import { pipeline } from "stream";
import jetpack from "fs-jetpack";
import { Extract } from "unzip-stream";
import { stringify } from "csv/sync";

import { JSONFile } from "lowdb/node";
import { Data, LowWithLodash } from "./db-model.js";
import { LiveData } from "../analyzeLiveData.js";
import lodash from "lodash";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const streamPipeline = promisify(pipeline);

const toLatexNum = (num: any) => `\\num{${num}}`;

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
db.data ||= {
  baseLine: { commits: [] },
  timings: { runs: [], testcases: [] },
  candidates: [],
  results: [],
  prs: [],
};
db.data.baseLine ||= { commits: [] };
db.data.timings ||= { runs: [], testcases: [] };
db.data.candidates ||= [];
db.data.results ||= [];

const targetRunNumber = 5;

if (!db.data) {
  throw new Error("no data");
}

const data = await octokit.rest.actions.listWorkflowRuns({
  owner: "heddendorp",
  repo: "n8n",
  workflow_id: "e2e-eval.yml",
  per_page: 100,
});

const runs = data.data.workflow_runs;

const getRunsPage = async (page: number) => {
  console.log("getting page", page);
  const runsData = await octokit.rest.actions.listWorkflowRuns({
    owner: "heddendorp",
    repo: "n8n",
    workflow_id: "e2e-eval.yml",
    per_page: 100,
    page,
  });
  runs.push(...runsData.data.workflow_runs);
  if (runsData.data.total_count > page * 100) {
    await getRunsPage(page + 1);
  }
};

if (runs.length >= 100) {
  await getRunsPage(2);
}

console.log("runs", runs.length);

let launchNewRuns = true;

if (
  runs.find(
    (run) =>
      (run.status === "in_progress" || run.status === "queued") &&
      run.name?.includes("evaluateRun")
  )
) {
  console.log("found running runs");
  launchNewRuns = false;
}

// Get analysis results for finished runs
const lineResultsSum = {
  truePositives: 0,
  falsePositives: 0,
  trueNegatives: 0,
  falseNegatives: 0,
};

const fileResultsSum = {
  truePositives: 0,
  falsePositives: 0,
  trueNegatives: 0,
  falseNegatives: 0,
};

const analysisRuns = runs.map(async (run) => {
  const commit = run.name?.split("-")[1].split("➡️")[0].trim();
  if (!commit) {
    console.log("no commit found");
    return;
  }
  const artifactResponse = await octokit.rest.actions.listWorkflowRunArtifacts({
    owner: "heddendorp",
    repo: "n8n",
    run_id: run.id,
  });

  const artifact = artifactResponse.data.artifacts.find(
    (artifact) => artifact.name === "coverage-analysis"
  );

  if (run.status !== "completed") {
    return {
      runId: run.id,
      commit,
      error: "run not completed",
    };
  }

  if (run.conclusion === "success") {
    return {
      runId: run.id,
      commit,
      passed: true,
    };
  }

  if (!artifact) {
    console.log("no artifact found");
    return {
      runId: run.id,
      commit,
      error: "no artifact found",
    };
  }

  const downloadResponse = await octokit.rest.actions.downloadArtifact({
    owner: "heddendorp",
    repo: "n8n",
    artifact_id: artifact.id,
    archive_format: "zip",
  });

  const response = await fetch(downloadResponse.url);
  if (!response.ok) {
    throw new Error(`Unexpected response ${response.statusText}`);
  }
  jetpack.dir(`./evaluation-reports/${run.id}`, { empty: true });
  await streamPipeline(
    // @ts-ignore
    response.body,
    Extract({ path: `./evaluation-reports/${run.id}` })
  );

  const analysis = jetpack.read(
    `./evaluation-reports/${run.id}/coverage-output-1.txt`
  );

  const data = analysis
    ?.split("==FLAKECHECK:START==" as any)[1]
    .split("==FLAKECHECK:END==" as any)[0];
  if (!data) {
    console.log("no data found");
    return;
  }
  const json = JSON.parse(data);
  const candidate = db.chain.get("candidates").find({ sha: commit }).value();
  if (!candidate) {
    console.log("no candidate found");
    return;
  }
  const lineResults: { test: string; flaky: boolean; flakyFile: boolean }[] =
    json.runs[0].lineCheck.testResults.map((result: any) => {
      return {
        test: result.testName,
        flaky: result.changedFiles.length === 0,
        flakyFile: result.changedFileLevel.length === 0,
      };
    });
  // console.log(json.runs[0].lineCheck.testResults);
  // console.log(json.runs[0].lineCheck.testResults[0].changedFiles.length);
  // console.log(json.runs[0].lineCheck.testResults[0].changedFiles.length>0);

  // console.log(candidate.failingTestcases);
  // console.log(lineResults);

  const result = {
    runId: run.id,
    commit,
    lineResults: {
      truePostives: lineResults.filter(
        (result) =>
          !candidate.failingTestcases.includes(result.test) && result.flaky
      ).length,
      falseNegatives: lineResults.filter(
        (result) =>
          !candidate.failingTestcases.includes(result.test) && !result.flaky
      ).length,
      trueNegatives: lineResults.filter(
        (result) =>
          candidate.failingTestcases.includes(result.test) && !result.flaky
      ).length,
      falsePositives: lineResults.filter(
        (result) =>
          candidate.failingTestcases.includes(result.test) && result.flaky
      ).length,
    },
    fileResults: {
      truePostives: lineResults.filter(
        (result) =>
          !candidate.failingTestcases.includes(result.test) && result.flakyFile
      ).length,
      falseNegatives: lineResults.filter(
        (result) =>
          !candidate.failingTestcases.includes(result.test) && !result.flakyFile
      ).length,
      trueNegatives: lineResults.filter(
        (result) =>
          candidate.failingTestcases.includes(result.test) && !result.flakyFile
      ).length,
      falsePositives: lineResults.filter(
        (result) =>
          candidate.failingTestcases.includes(result.test) && result.flakyFile
      ).length,
    },
  };

  lineResultsSum.truePositives += result.lineResults.truePostives;
  lineResultsSum.falsePositives += result.lineResults.falsePositives;
  lineResultsSum.trueNegatives += result.lineResults.trueNegatives;
  lineResultsSum.falseNegatives += result.lineResults.falseNegatives;

  fileResultsSum.truePositives += result.fileResults.truePostives;
  fileResultsSum.falsePositives += result.fileResults.falsePositives;
  fileResultsSum.trueNegatives += result.fileResults.trueNegatives;
  fileResultsSum.falseNegatives += result.fileResults.falseNegatives;

  return result;
});

let analysedRuns = 0;
const evaluation = [];

for (const run of analysisRuns) {
  const result = await run;
  if (result) {
    evaluation.push(result);
  } else {
    console.log("no result");
  }
  analysedRuns++;
  console.log(`analysed ${analysedRuns} of ${runs.length}`);
}

// const evaluation = await Promise.all(analysisRuns);

// console.log("evaluation", evaluation);
console.log("lineResultsSum", lineResultsSum);
console.log("fileResultsSum", fileResultsSum);
console.log("runs", runs.length);

const linePrecision =
  lineResultsSum.truePositives /
  (lineResultsSum.truePositives + lineResultsSum.falsePositives);
const lineRecall =
  lineResultsSum.truePositives /
  (lineResultsSum.truePositives + lineResultsSum.falseNegatives);
const lineF1 =
  (2 * (linePrecision * lineRecall)) / (linePrecision + lineRecall);

const filePrecision =
  fileResultsSum.truePositives /
  (fileResultsSum.truePositives + fileResultsSum.falsePositives);
const fileRecall =
  fileResultsSum.truePositives /
  (fileResultsSum.truePositives + fileResultsSum.falseNegatives);
const fileF1 =
  (2 * (filePrecision * fileRecall)) / (filePrecision + fileRecall);

// Get numbers for artemis
console.log("===Artemis===");
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

const artemisData = lodash.chain(liveData);

const failedFlakyBuilds = artemisData
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => result.flakyBuild.successful === false)
  .value().length;

console.log(failedFlakyBuilds, "failedFlakyBuilds");

const labeledFlakyResults = artemisData
  .get("branchData")
  .flatMap((branchData) => branchData.results)
  .filter((result) => !!result.flakyBuild.label)
  .value().length;

console.log(labeledFlakyResults, "labeledFlakyResults");

const knownTruePositive = artemisData
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

const knownFalseNegative = artemisData
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

const likelyTrueNegatives = artemisData
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

const likelyFalsePositives = artemisData
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

console.log(maxFlasePositives, "maxFlasePositives");

const maxTrueNegatives = unlabeledFlakyFails - knownFalseNegative;
const maxFalseNegatives = unlabeledFlakyFails - likelyTrueNegatives;

console.log(maxTrueNegatives, "maxTrueNegatives");
console.log(maxFalseNegatives, "maxFalseNegatives");

const precision = knownTruePositive / (knownTruePositive + maxFlasePositives);
const recall = knownTruePositive / (knownTruePositive + maxFalseNegatives);

console.log(precision, "precision");
console.log(recall, "recall");

const f1 = (2 * (precision * recall)) / (precision + recall);

console.log("===End Artemis===");

const resultsCsv = [
  [
    "Experiment",
    "True Positives",
    "False Positives",
    "True Negatives",
    "False Negatives",
    "Precision",
    "Recall",
    "F1",
    // "MCC"
  ],
  [
    "\\textsc{n8n} (line)",
    lineResultsSum.truePositives,
    lineResultsSum.falsePositives,
    lineResultsSum.trueNegatives,
    lineResultsSum.falseNegatives,
    ...[
      linePrecision,
      lineRecall,
      lineF1,
      // mccScore
    ].map((num) => toLatexNum(num)),
  ],
  [
    "\\textsc{n8n} (file)",
    fileResultsSum.truePositives,
    fileResultsSum.falsePositives,
    fileResultsSum.trueNegatives,
    fileResultsSum.falseNegatives,
    ...[
      filePrecision,
      fileRecall,
      fileF1,
      // mccScoreFile
    ].map((num) => toLatexNum(num)),
  ],
  [
    "\\textsc{ArtTEMis}",
    knownTruePositive,
    maxFlasePositives,
    likelyTrueNegatives,
    maxFalseNegatives,
    toLatexNum(precision),
    toLatexNum(recall),
    toLatexNum(f1),
  ],
];

jetpack.write(
  "../thesis/data/evaluationResult.csv",
  stringify(resultsCsv, { quoted: true })
    .replace(/(?<=^|,)"/gm, "{")
    .replace(/"(?=$|,)/gm, "}")
);

throw new Error("done");

const actionStarts = db.chain
  .get("candidates")
  .filter((candidate) => {
    const matchingRuns = runs.filter((run) => {
      const commit = run.name?.split("-")[1].split("➡️")[0].trim();
      if (!commit) {
        console.log("no commit found");
        return false;
      }
      return candidate.sha === commit;
    });
    return matchingRuns.length < targetRunNumber;
  })
  .slice(0, 5)
  .map(async (candidate) => {
    const matchingRuns = runs.filter((run) => {
      const commit = run.name?.split("-")[1].split("➡️")[0].trim();
      if (!commit) {
        console.log("no commit found");
        return false;
      }
      return candidate.sha === commit;
    });
    for (let i = 0; i < targetRunNumber - matchingRuns.length; i++) {
      console.log("starting run", candidate.sha);
      await octokit.rest.actions.createWorkflowDispatch({
        owner: "heddendorp",
        repo: "n8n",
        workflow_id: "e2e-eval.yml",
        ref: "master",
        inputs: {
          ref: candidate.sha,
          coverage: "[true]",
          containers: "[1]",
          run: "evaluateRun",
          compare: candidate.firstSuccessfulParent,
        },
      });
    }
  })
  .value();

let launchedRuns = 0;
if (launchNewRuns) {
  for (const actionStart of actionStarts) {
    await actionStart;
    launchedRuns++;
    console.log("launched", launchedRuns, "runs");
  }
}

await db.write();
