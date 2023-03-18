import * as dotenv from "dotenv";
import { Octokit } from "octokit";
dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function triggerActions() {
  const commits = await octokit.rest.repos.listCommits({
    owner: "n8n-io",
    repo: "n8n",
    per_page: 25,
  });

  commits.data.forEach(async (commit: any) => {
    await octokit.request(
      "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
      {
        owner: "heddendorp",
        repo: "n8n",
        workflow_id: "e2e-historic.yml",
        ref: "master",
        inputs: {
          ref: commit.sha,
          compare: `${commit.sha}~1`,
          coverage: "[false,true]",
          containers: "[1]",
          run: "establishHostedTimings",
          useHostedRunner: "true",
        },
      }
    );
  });
}

triggerActions();
