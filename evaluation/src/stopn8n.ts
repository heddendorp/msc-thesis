import * as dotenv from "dotenv";
import { Octokit } from "octokit";
dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const deleteAll = true;

async function run() {
  const res = await octokit.rest.actions.listWorkflowRuns({
    owner: "heddendorp",
    repo: "n8n",
    workflow_id: "e2e-historic.yml",
    per_page: 1500,
  });
  console.log(res.data.workflow_runs.length);

  for (const run of res.data.workflow_runs) {
    console.log(run.id);
    if(["in_progress","queued"].includes(run.status??'')){
      await octokit.rest.actions.cancelWorkflowRun({
        owner: "heddendorp",
        repo: "n8n",
        run_id: run.id,
      });
    } else if(deleteAll){
      try{
        await octokit.rest.actions.deleteWorkflowRun({
          owner: "heddendorp",
          repo: "n8n",
          run_id: run.id,
        });
      }
      catch(e){
        console.log(e);
        console.log(run);
      }
    }
  }
}

run();
