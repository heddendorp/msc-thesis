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
  prs: {
    number: number;
    name: string;
    state: string;
    merged: boolean;
    commits: {
      sha: string;
      parent: string;
    }[];
  }[];
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
  prs: [],
};
db.data.baseLine ||= { commits: [] };
db.data.timings ||= { runs: [], testcases: [] };
db.data.candidates ||= [];
db.data.results ||= [];
db.data.prs ||= [];

if (!db.data) {
  throw new Error("no data");
}

const getFirstSuccessfulParent = (commit: string): string | null => {
  const commitData = db.chain
    .get("baseLine.commits")
    .find({ sha: commit })
    .value();
  if (!commitData) {
    return null;
  }
  if (commitData.successful) {
    return commit;
  }
  if (!commitData.parent) {
    return null;
  }
  return getFirstSuccessfulParent(commitData.parent);
};

const getOldestParent = (commit: string): string => {
  const commitData = db.chain
    .get("baseLine.commits")
    .find({ sha: commit })
    .value();
  if (!commitData) {
    return commit;
  }
  if (!commitData.parent) {
    return commit;
  }
  return getOldestParent(commitData.parent);
};

const commitsToRun = db.chain
  .get("prs")
  .map("commits")
  .flatten()
  .map((plannedCommit) => {
    const commit = db.chain
      .get("baseLine.commits")
      .find({ sha: plannedCommit.sha })
      .value();
    if (!commit) {
      console.log("no commit");
      return plannedCommit.sha;
    }
    if (commit.successful) {
      return null;
    }
    if (commit.runs.length < 5) {
      return plannedCommit.sha;
    }
    const firstSuccessfulParent = getFirstSuccessfulParent(plannedCommit.sha);
    if (!firstSuccessfulParent) {
      console.log("no first successful parent");
      return getOldestParent(plannedCommit.sha);
    }
    const child = db.chain
      .get("baseLine.commits")
      .find({ parent: plannedCommit.sha })
      .value();
    if (!child) {
      const parent = db.chain
        .get("baseLine.commits")
        .find({ sha: plannedCommit.parent })
        .value();
      if (!parent) {
        console.log("single commit");
        return plannedCommit.parent;
      }
    }
    return null;
  })
  .filter((sha) => !!sha)
  .uniq()
  .value();

console.log(`Starting ${commitsToRun.length} runs`);

for (const commit of commitsToRun) {
  if (!commit) {
    continue;
  }
  await octokit.rest.actions.createWorkflowDispatch({
    owner: "heddendorp",
    repo: "n8n",
    workflow_id: "e2e-historic.yml",
    ref: "master",
    inputs: {
      ref: commit,
      compare: `${commit}~1`,
      coverage: "[false]",
      containers: "[1]",
      run: "establishBaselineExtension",
    },
  });
}
