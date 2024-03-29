import * as dotenv from "dotenv";
dotenv.config();
import { Octokit } from "octokit";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import lodash from "lodash";
import { $, execa } from "execa";

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

// if (
//   runs.find(
//     (run) =>
//       (run.status === "in_progress" || run.status === "queued") &&
//       run.name?.includes("establishBaseline")
//   )
// ) {
//   throw new Error("There is a run in progress, please wait for it to finish");
// }

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
const updateDB = runs
  .filter((run) => run.name?.includes("establishBaseline"))
  .filter(run => run.status === "completed")
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
        // wait 1 second to not hit rate limit
        await new Promise((resolve) => setTimeout(resolve, 1000));
        db.data?.baseLine.commits.push({
          sha: commit ?? "",
          branch: branch ?? "",
          parent: parentCommit,
          runs: [runData],
          successful: runData.testConclusion === "success",
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
      try {
        const { stderr, stdout } = await execa(
          "git",
          ["branch", "--contains", commit],
          { cwd: "../../n8n" }
        );
        const branch = stdout.split(" ")[1];
        if (branch && commitIndex !== -1) {
          db.chain
            .get("baseLine.commits")
            .find({ sha: commit })
            .set("branch", branch)
            .value();
        }
      } catch (error) {
        // console.log("Error getting branch");
      }
    }
  });

let updateCount = 0;

for (const update of updateDB) {
  await update;
  console.log("updated", updateCount++);
}

// update commit to success if any run was successful
db.data?.baseLine.commits.forEach((commit) => {
  if (commit.runs.some((run) => run.testConclusion === "success")) {
    commit.successful = true;
  } else {
    commit.successful = false;
  }
  if (
    commit.runs.some((run) => run.testConclusion === "success") &&
    commit.runs.some((run) => run.testConclusion === "failure")
  ) {
    commit.flaky = true;
  } else {
    commit.flaky = false;
  }
});

await db.write();
