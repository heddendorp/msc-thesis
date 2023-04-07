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
  prs: [],
};
db.data.baseLine ||= { commits: [] };
db.data.timings ||= { runs: [], testcases: [] };
db.data.candidates ||= [];
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

// Find commits that are successful or have five runs and have a parent that is successful

const commits = db.chain
  .get("prs")
  .map("commits")
  .flatten()
  .filter((plannedCommit) => {
    const commit = db.chain
      .get("baseLine.commits")
      .find({ sha: plannedCommit.sha })
      .value();
    if (!commit) {
      return false;
    }
    if (commit.successful) {
      return true;
    }
    if (commit.runs.length >= 5) {
      return true;
    }
    return false;
  })
  .map((plannedCommit) => {
    const commit = db.chain
      .get("baseLine.commits")
      .find({ sha: plannedCommit.sha })
      .value();
    if (!commit) {
      throw new Error("no commit");
    }
    return commit;
  })
  .filter((commit) => {
    const parent = getFirstSuccessfulParent(commit.parent);
    if (parent) {
      return true;
    }
    return false;
  })
  .filter((commit) => !!commit.branch)
  .filter((commit) =>
    commit.runs.some((run) => run.installConclusion === "success")
  )
  .value();

console.log(`found ${commits.length} commits`);
console.log(
  `${commits.filter((commit) => commit.successful).length} successful`
);
// commits.filter(commit => !commit.successful).forEach(commit => console.log(commit.runs))

// throw new Error("stop");

// Download the reports for all selected commits that have a no successful run

const downloads = commits
  .filter((commit) => !commit.successful)
  .map(async (commit) => {
    // console.log(`downloading for commit ${commit.sha}`);
    const runDownloads = commit.runs
      .filter((run) => run.testConclusion === "failure")
      .map(async (run) => {
        // console.log(`downloading ${run.id}`);
        const artifactResponse =
          await octokit.rest.actions.listWorkflowRunArtifacts({
            owner: "heddendorp",
            repo: "n8n",
            run_id: run.id,
          });
        const artifact = artifactResponse.data.artifacts.find((artifact) =>
          artifact.name?.includes("results-no-coverage")
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
        jetpack.dir(`./baseline-reports/${run.id}`, { empty: true });
        await streamPipeline(
          // @ts-ignore
          response.body,
          Extract({ path: `./baseline-reports/${run.id}` })
        );
        // console.log(`downloaded ${run.id}`);
      });
    await Promise.all(runDownloads);
  });

await Promise.all(downloads);

interface Candidate {
  sha: string;
  branch: string;
  firstSuccessfulParent: string;
  failingTestcases: string[];
}
// For each of the selected commits, find the testcases that always fail

const candidates: Candidate[] = await Promise.all(
  commits.map(async (commit) => {
    const firstSuccessfulParent = getFirstSuccessfulParent(commit.parent);
    if (!firstSuccessfulParent) {
      throw new Error("no first successful parent");
    }
    if (commit.successful) {
      return {
        sha: commit.sha,
        branch: commit.branch,
        firstSuccessfulParent,
        failingTestcases: [],
      };
    }

    const failingSpecFiles: string[] = [];
    const passingSpecFiles: string[] = [];
    for (const run of commit.runs.filter(
      (run) => run.testConclusion === "failure"
    )) {
      const report = jetpack.read(
        `./baseline-reports/${run.id}/report.json`,
        "json"
      );
      if (!report) {
        console.log(`no report for ${run.id}`);
        console.log(jetpack.list(`./baseline-reports/${run.id}`));
        throw new Error("no report");
      }
      report.results.forEach((result: any) => {
        const specFile = result.file.split("/").pop().split(".")[0];
        let tests = result.tests;
        tests = tests.concat(
          result.suites.flatMap((suite: any) =>
            suite.tests.concat(
              suite.suites.flatMap((suite: any) => suite.tests)
            )
          )
        );
        // console.log(tests);
        const allPassing = tests.every((test: any) => test.pass);
        if (allPassing) {
          passingSpecFiles.push(specFile);
        } else {
          failingSpecFiles.push(specFile);
        }
      });
    }
    // if(!commit.successful){
    //   console.log(`commit ${commit.sha} has ${lodash.uniq(failingTestcases).length} failing testcases`);
    //   console.log(lodash.uniq(failingTestcases).sort());
    //   console.log(`commit ${commit.sha} has ${lodash.uniq(passingTestcases).length} passing testcases`);
    //   console.log(lodash.uniq(passingTestcases).sort());
    // }
    // throw new Error("stop");
    const alwaysFailingTestcases = lodash.difference(
      failingSpecFiles,
      passingSpecFiles
    );
    return {
      sha: commit.sha,
      branch: commit.branch,
      firstSuccessfulParent,
      failingTestcases: lodash.uniq(alwaysFailingTestcases),
    };
  })
);

console.log(`found ${candidates.length} candidates`);
console.log(
  `found ${
    candidates.filter((candidate) => candidate.failingTestcases.length > 0)
      .length
  } candidates with failing testcases`
);

db.data.candidates = candidates;

await db.write();
