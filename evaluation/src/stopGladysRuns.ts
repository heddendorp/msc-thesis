import * as dotenv from "dotenv";
import { Octokit } from "octokit";
dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function run() {
  const res = await octokit.rest.actions.listWorkflowRuns({
    owner: "heddendorp",
    repo: "Gladys",
    status: "in_progress",
    workflow_id: "historic-tests.yml",
    per_page: 1500,
  });
  console.log(res.data.total_count);

  for (const run of res.data.workflow_runs) {
    console.log(run.id);
    await octokit.rest.actions.cancelWorkflowRun({
      owner: "heddendorp",
      repo: "Gladys",
      run_id: run.id,
    });
  }
}

run();
