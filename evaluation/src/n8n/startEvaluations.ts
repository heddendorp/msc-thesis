import * as dotenv from "dotenv";
dotenv.config();
import { Octokit } from "octokit";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import lodash from "lodash";
import { promisify } from "util";
import { pipeline } from "stream";
import jetpack from "fs-jetpack";
import { Extract } from "unzip-stream";

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const streamPipeline = promisify(pipeline);

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
      installConclusion: string;
      testConclusion: string;
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
  candidates: {
    sha: string;
    branch: string;
    firstSuccessfulParent: string;
    failingTestcases: string[];
  }[];
  results: {}[];
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
db.data ||= {
  baseLine: { commits: [] },
  timings: { runs: [], testcases: [] },
  candidates: [],
  results: [],
};
db.data.baseLine ||= { commits: [] };
db.data.timings ||= { runs: [], testcases: [] };
db.data.candidates ||= [];
db.data.results ||= [];

const targetRunNumber = 6;

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

const evaluation = await Promise.all(analysisRuns);

console.log("evaluation", evaluation);
console.log("lineResultsSum", lineResultsSum);
console.log("fileResultsSum", fileResultsSum);
console.log("runs", runs.length);

// throw new Error("done");

// Start evaluation if it didn't run ten times yet

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
  // .slice(0, 2)
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
      // break;
    }
  })
  .value();

if (launchNewRuns) {
  await Promise.all(actionStarts);
}

await db.write();
