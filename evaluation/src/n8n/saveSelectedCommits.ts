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
const db = new LowWithLodash<Data>(adapter);

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

const branches = await octokit.rest.repos.listBranches({
  owner: "n8n-io",
  repo: "n8n",
  per_page: 50,
});

const branchRequests = branches.data.map(async (branch) => {
  const commits = await octokit.rest.repos.listCommits({
    owner: "n8n-io",
    repo: "n8n",
    sha: branch.name,
    per_page: 5,
    until: "2023-03-20",
  });

  return {
    number: 0,
    name: branch.name,
    state: "branch",
    merged: false,
    commits: commits.data.map((commit) => {
      return {
        sha: commit.sha,
        parent: commit.parents[0].sha,
      };
    }),
  };
});

const branchCommits = await Promise.all(branchRequests);

console.log(branchCommits);

// throw new Error("stop");

const pullRequests = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
  owner: "n8n-io",
  repo: "n8n",
  state: "all",
  per_page: 50,
  until: "2023-03-20",
});

const prRequests = pullRequests.data.map(async (pr) => {
  const commits = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
    {
      owner: "n8n-io",
      repo: "n8n",
      pull_number: pr.number,
      per_page: 5,
    }
  );
  return {
    number: pr.number,
    name: pr.title,
    state: pr.state,
    merged: pr.merged_at !== null,
    commits: commits.data.map((commit) => {
      return {
        sha: commit.sha,
        parent: commit.parents[0].sha,
      };
    }),
  };
});

const prs = await Promise.all(prRequests);

const selection = prs.concat(
  branchCommits
    .filter((branch) => branch.commits.length > 0)
    .filter((branch) => {
      return !prs.some((pr) =>
        pr.commits.some((prCommit) =>
          branch.commits.some(
            (branchCommit) => prCommit.sha === branchCommit.sha
          )
        )
      );
    })
);

if(db.data){
  // merge db prs with selection
  const oldPrs = db.data.prs.filter((pr) => {
    return !selection.some((newPr) => newPr.number === pr.number);
  });
  db.data.prs = oldPrs.concat(selection);
  await db.write();
}

// if (db.data) {
//   db.data!.prs = selection;

//   await db.write();
// }
