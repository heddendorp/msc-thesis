import * as dotenv from "dotenv";
import { Octokit } from "octokit";
dotenv.config();
import { execSync } from "child_process";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function run() {
  const res = await octokit.rest.actions.listWorkflowRuns({
    owner: "GladysAssistant",
    repo: "Gladys",
    // status: "failure",
    workflow_id: "docker-pr-build.yml",
    per_page: 1500,
  });
  console.log(res.data.total_count);
  console.log(res.data.workflow_runs.length);
  const runsWithFailedCypress = [];
  const runsWithCommitFound = [];
  for (const run of res.data.workflow_runs) {
    if(!['failure','success', 'completed'].includes(run.status??'')){
        console.log("Run not finished");
        console.log(run.status);
        continue;
    }
    let commitExists = false;
    try {
      commitExists =
        execSync(`cd ../../gladys-original && git cat-file -t ${run.head_sha}`)
          .toString()
          .trim() === "commit";
    } catch (error) {
      commitExists = false;
    }
    if (!commitExists) {
      console.log("No commit found");
      continue;
    } else {
      console.log("Commit found");
    }
    runsWithCommitFound.push(run);
    // const jobs = await octokit.rest.actions.listJobsForWorkflowRun({
    //   owner: "GladysAssistant",
    //   repo: "Gladys",
    //   run_id: run.id,
    // });

    // const cypressRunJob = jobs.data.jobs.find(
    //   (job) => job.name === "Cypress run"
    // );
    if (commitExists) {
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
  console.log(runsWithCommitFound.length);

  // Dispatch workflows for each run
  for (const run of runsWithFailedCypress.slice(0)) {
    const commitToAnalyze = run.run.head_sha;
    const commitToCompare =
      run.lastSuccesBefore?.head_sha ?? `${commitToAnalyze}^`;
    console.log(`Analyzing ${commitToAnalyze} against ${commitToCompare}`);
    await octokit.rest.actions.createWorkflowDispatch({
      owner: "heddendorp",
      repo: "Gladys",
      workflow_id: "historic-tests.yml",
      ref: "master",
      inputs: {
        ref: commitToAnalyze,
        "coverage-comparison": commitToCompare,
      },
    });
    console.log(`Dispatched workflow for ${commitToAnalyze}`);
  }
}

run();
