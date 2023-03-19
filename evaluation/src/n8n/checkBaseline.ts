import * as dotenv from "dotenv";
dotenv.config();
import { Octokit } from "octokit";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import lodash from "lodash";

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

type Data = {
  baseLine: {
    commits: {
      sha: string;
      parent: string;
      branch: string;
      successful: boolean;
      flaky: boolean;
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
db.data ||= { baseLine: { commits: [] } };
db.data.baseLine ||= { commits: [] };

if (!db.data) {
  throw new Error("no data");
}

// Get action results
const runs = (
  await octokit.rest.actions.listWorkflowRuns({
    owner: "heddendorp",
    repo: "n8n",
    workflow_id: "e2e-historic.yml",
    per_page: 100,
    page: 1,
  })
).data.workflow_runs;

const getRunsPage = async (page: number) => {
  console.log("getting page", page);
  const runsData = await octokit.rest.actions.listWorkflowRuns({
    owner: "heddendorp",
    repo: "n8n",
    workflow_id: "e2e-historic.yml",
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
      run.name?.includes("establishBaseline")
  )
) {
  throw new Error("There is a run in progress, please wait for it to finish");
}

const getRunData = async (run: {
  id: number;
  conclusion: string | null;
}): Promise<{
  id: number;
  conclusion: string;
  installDuration: number;
  testDuration: number;
  installConclusion: string;
  testConclusion: string;
}> => {
  const runData = await octokit.rest.actions.listJobsForWorkflowRun({
    owner: "heddendorp",
    repo: "n8n",
    run_id: run.id,
  });
  const installJob = runData.data.jobs.find((job) =>
    job.name?.includes("install")
  );
  const testJob = runData.data.jobs.find((job) =>
    job.name?.includes("testing")
  );
  return {
    id: run.id,
    conclusion: run.conclusion ?? "",
    installDuration:
      new Date(installJob?.completed_at ?? "").getTime() -
      new Date(installJob?.started_at ?? "").getTime(),
    testDuration:
      new Date(testJob?.completed_at ?? "").getTime() -
      new Date(testJob?.started_at ?? "").getTime(),
    installConclusion: installJob?.conclusion ?? "",
    testConclusion: testJob?.conclusion ?? "",
  };
};

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

// throw new Error("stop");
const updateDB = runs
  .filter((run) => run.name?.includes("establishBaseline"))
  .map(async (run) => {
    if (run.conclusion) {
      const commit = run.name?.split("-")[1].split("➡️")[0].trim();
      if (!commit) {
        console.log("no commit found");
        return;
      }

      const commitIndex = db.chain
        .get("baseLine.commits")
        .findIndex({ sha: commit })
        .value();
      if (commitIndex === -1) {
        const commitResponse = await octokit.rest.repos.getCommit({
          owner: "n8n-io",
          repo: "n8n",
          ref: commit,
        });
        const parentCommit = commitResponse.data.parents[0].sha;
        const prResponse =
          await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
            owner: "n8n-io",
            repo: "n8n",
            commit_sha: commit,
          });
        const branch = prResponse.data[0]?.head?.ref;
        const runData = await getRunData(run);
        db.data?.baseLine.commits.push({
          sha: commit ?? "",
          branch: branch ?? "",
          parent: parentCommit,
          runs: [runData],
          successful: run.conclusion === "success",
          flaky: false,
        });
      } else {
        const runIndex = db.chain
          .get("baseLine.commits")
          .find({ sha: commit })
          .get("runs")
          .findIndex({ id: run.id })
          .value();
        if (runIndex === -1) {
          const runData = await getRunData(run);
          db.data?.baseLine.commits[commitIndex].runs.push(runData);
        }
      }
    }
  });
await Promise.all(updateDB);

// update commit to success if any run was successful
db.data?.baseLine.commits.map(async (commit) => {
  if (commit.runs.some((run) => run.conclusion === "success")) {
    commit.successful = true;
  }
  if (
    commit.runs.some((run) => run.conclusion === "success") &&
    commit.runs.some((run) => run.conclusion === "failure")
  ) {
    commit.flaky = true;
  }
});

// Check every commit for success and trigger new action if below five runs have been recorded
const checkCommits = db.data?.baseLine.commits.map(async (commit) => {
  if (commit.runs.length < 5) {
    if (!commit.runs.some((run) => run.conclusion === "success")) {
      console.log("not enough runs - extending");
      const triggerResponse = await octokit.rest.actions.createWorkflowDispatch(
        {
          owner: "heddendorp",
          repo: "n8n",
          workflow_id: "e2e-historic.yml",
          ref: "master",
          inputs: {
            ref: commit.sha,
            compare: `${commit.sha}~1`,
            coverage: "[false]",
            containers: "[1]",
            run: "establishBaselineRerun",
          },
        }
      );
    }
  } else {
    if (!commit.runs.some((run) => run.conclusion === "success")) {
      const parent = getFirstSuccessfulParent(commit.sha);
      if (!parent) {
        console.log("no parent found - extending");
        const triggerResponse =
          await octokit.rest.actions.createWorkflowDispatch({
            owner: "heddendorp",
            repo: "n8n",
            workflow_id: "e2e-historic.yml",
            ref: "master",
            inputs: {
              ref: getOldestParent(commit.sha),
              compare: `${getOldestParent(commit.sha)}~1`,
              coverage: "[false]",
              containers: "[1]",
              run: "establishBaselineExtension",
            },
          });
      }
    }
  }
});
await Promise.all(checkCommits);

await db.write();
