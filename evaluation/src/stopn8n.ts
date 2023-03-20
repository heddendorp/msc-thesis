import * as dotenv from "dotenv";
import { Octokit } from "octokit";
dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const deleteAll = true;

async function run() {
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

  for (const run of runs.filter((run) =>
    run.name?.includes("establishHostedTimings")
  )) {
    console.log(run.id);
    if (["in_progress", "queued"].includes(run.status ?? "")) {
      await octokit.rest.actions.cancelWorkflowRun({
        owner: "heddendorp",
        repo: "n8n",
        run_id: run.id,
      });
    } else if (deleteAll) {
      try {
        await octokit.rest.actions.deleteWorkflowRun({
          owner: "heddendorp",
          repo: "n8n",
          run_id: run.id,
        });
      } catch (e) {
        console.log(e);
        console.log(run);
      }
    }
  }
}

run();
