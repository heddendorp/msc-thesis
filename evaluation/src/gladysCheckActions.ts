import * as dotenv from "dotenv";
import { Octokit } from "octokit";
dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function run() {
  const res = await octokit.rest.actions.listWorkflowRuns({
    owner: "GladysAssistant",
    repo: "Gladys",
    status: "failure",
    workflow_id: "docker-pr-build.yml",
    per_page: 1500,
  });
  console.log(res.data.total_count);
  const runsWithFailedCypress = [];
  for (const run of res.data.workflow_runs) {
    const jobs = await octokit.rest.actions.listJobsForWorkflowRun({
      owner: "GladysAssistant",
      repo: "Gladys",
      run_id: run.id,
    });

    const cypressRunJob = jobs.data.jobs.find(
      (job) => job.name === "Cypress run"
    );
    if (cypressRunJob?.conclusion === "failure") {
      const lastSuccesBefore = await octokit.rest.actions.listWorkflowRuns({
        owner: "GladysAssistant",
        repo: "Gladys",
        status: "success",
        workflow_id: "docker-pr-build.yml",
        created_before: run.created_at,
        branch: run.head_branch ?? undefined,
        per_page: 1,
      });
      if (lastSuccesBefore.data.total_count === 0) {
        runsWithFailedCypress.push({ run });
        console.log("No last success before");
      } else {
        runsWithFailedCypress.push({
          run,
          lastSuccesBefore: lastSuccesBefore.data.workflow_runs[0],
        });
      }
    }
  }
  console.log(runsWithFailedCypress.length);

  // Dispatch workflows for each run
  for (const run of runsWithFailedCypress) {
    const commitToAnalyze = run.run.head_sha;
    const commitToCompare =
      run.lastSuccesBefore?.head_sha ?? `${commitToAnalyze}^`;
    console.log(`Analyzing ${commitToAnalyze} against ${commitToCompare}`);
    await octokit.rest.actions.createWorkflowDispatch({
      owner: "heddendorp",
      repo: "Gladys",
      workflow_id: "historic-tests.yml",
      ref: 'master',
      inputs: {
        ref: commitToAnalyze,
        "coverage-comparison": commitToCompare,
      },
    });
    console.log(`Dispatched workflow for ${commitToAnalyze}`);
  }
}

run();
