import * as dotenv from "dotenv";
dotenv.config();
import { Octokit } from "octokit";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSONFile } from "lowdb/node";
import { Data, LowWithLodash } from "./db-model.js";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// File path
const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "db.json");

// Configure lowdb to write to JSONFile
const adapter = new JSONFile<Data>(file);
const db = new LowWithLodash(adapter);

// Read data from JSON file, this will set db.data content
await db.read();

const getRunsPage = async (
  page: number,
  runs: any[],
  workflow: string
): Promise<any[]> => {
  console.log("getting page", page);
  const runsData = await octokit.rest.actions.listWorkflowRuns({
    owner: "heddendorp",
    repo: "n8n",
    workflow_id: workflow,
    per_page: 100,
    page,
  });
  const newRuns = [...runs, ...runsData.data.workflow_runs];
  if (runsData.data.total_count > page * 100) {
    return await getRunsPage(page + 1, newRuns, workflow);
  }
  return newRuns;
};

// Clean e2e-eval.yml

const evalRuns = await getRunsPage(1, [], "e2e-eval.yml");

const evalRunsToClean = evalRuns.filter(
    (run) => {
        const commit = run.name?.split("-")[1].split("➡️")[0].trim();
        const candidate = db.chain.get("candidates").find({ sha: commit }).value();
        return !candidate;
    });

console.log("evalRunsToClean", evalRunsToClean.length);

for (const run of evalRunsToClean) {
    await octokit.rest.actions.deleteWorkflowRun({
        owner: "heddendorp",
        repo: "n8n",
        run_id: run.id,
    });
}

// Utility functions
const isParentOfCandidate = (commit: string): boolean => {
    const commitData = db.chain
        .get("baseLine.commits")
        .find({ sha: commit })
        .value();
    if (!commitData) {
        return false;
    }
    const candidate = db.chain.get("candidates").find({ sha: commitData.parent }).value();
    if (candidate) {
        return true;
    }
    return isParentOfCandidate(commitData.parent);
};

// Clean e2e-historic.yml
// Make sure only necessary runs for the baseline are kept

const baselineRuns = await getRunsPage(1, [], "e2e-historic.yml");

const baselineRunsToClean = baselineRuns.filter(
    (run) => {
        const commit = run.name?.split("-")[1].split("➡️")[0].trim();
        const candidate = db.chain.get("candidates").find({ sha: commit }).value();
        if(candidate){
            return true;
        }
        return !isParentOfCandidate(commit);
    });

console.log("baselineRunsToClean", baselineRunsToClean.length);

for (const run of baselineRunsToClean) {
    await octokit.rest.actions.deleteWorkflowRun({
        owner: "heddendorp",
        repo: "n8n",
        run_id: run.id,
    });
}

// Clean e2e-timing.yml

const timingRuns = await getRunsPage(1, [], "e2e-timing.yml");

// for (const run of timingRuns) {
//     await octokit.rest.actions.deleteWorkflowRun({
//         owner: "heddendorp",
//         repo: "n8n",
//         run_id: run.id,
//     });
// }