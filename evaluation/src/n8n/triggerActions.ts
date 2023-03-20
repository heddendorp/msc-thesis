import * as dotenv from "dotenv";
import { Octokit } from "octokit";
dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function triggerActions() {
  const pullRequests = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls",
    {
      owner: "n8n-io",
      repo: "n8n",
      state: "open",
      per_page: 10,
    }
  );

  const commitPromises = pullRequests.data.map(async (pr: any) => {
    const commits = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
      {
        owner: "n8n-io",
        repo: "n8n",
        pull_number: pr.number,
        per_page: 5,
      }
    );

    return commits.data;
  });

  const allCommits = await Promise.all(commitPromises);
  const flatCommits = allCommits.flat();

  flatCommits.forEach(async (commit: any) => {
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
          coverage: "[false]",
          containers: "[1]",
          run: "establishBaseline",
        //   useHostedRunner: 'false',
        },
      }
    );
  });
}

triggerActions();
