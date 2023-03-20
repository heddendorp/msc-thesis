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

if (
  runs.find(
    (run) =>
      (run.status === "in_progress" || run.status === "queued") &&
      run.name?.includes("evaluateRun")
  )
) {
  // throw new Error("There is a run in progress, please wait for it to finish");
}

// Get analysis results for finished runs
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

  if (!artifact) {
    console.log("no artifact found");
    return;
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
  const lineResults = json.runs[0].lineCheck.testResults.map((result: any) => {
    return {
      test: result.testName,
      flaky: result.changedFiles.lenght > 0,
      falkyFile: result.changedFileLevel.lenght > 0,
    };
  });
  // console.log(json.runs[0].lineCheck.testResults);

  console.log(candidate.failingTestcases);
  console.log(lineResults);
});

await Promise.all(analysisRuns);

throw new Error("done");

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
    return matchingRuns.length < 10;
  })
  .slice(0, 2)
  .map(async (candidate) => {
    const matchingRuns = runs.filter((run) => {
      const commit = run.name?.split("-")[1].split("➡️")[0].trim();
      if (!commit) {
        console.log("no commit found");
        return false;
      }
      return candidate.sha === commit;
    });
    if (matchingRuns.length < 10) {
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

await Promise.all(actionStarts);

await db.write();
