import * as dotenv from "dotenv";
import { Octokit } from "octokit";
dotenv.config();
import fs from "fs";
import { promisify } from "util";
import { pipeline } from "stream";
import zlib from "zlib";
import jetpack from "fs-jetpack";
import { PassThrough } from "stream";
import {Extract}  from 'unzip-stream'

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const streamPipeline = promisify(pipeline);

async function checkActions() {
  const runs = await octokit.request("GET /repos/{owner}/{repo}/actions/runs", {
    owner: "heddendorp",
    repo: "n8n",
    per_page: 150,
  });

//   console.table(runs.data.workflow_runs);

  const failedRuns = runs.data.workflow_runs.filter(
    (run: any) => run.conclusion === "failure"
  );

  const artifactPromises = failedRuns.map(async (run: any) => {
    const artifacts = await octokit.request(
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
      {
        owner: "heddendorp",
        repo: "n8n",
        run_id: run.id,
      }
    );

    return artifacts.data.artifacts;
  });

  const allArtifacts = await Promise.all(artifactPromises);
  const flatArtifacts = allArtifacts.flat();

  for (const artifact of flatArtifacts.slice(0, 1)) {
    const download = await octokit.rest.actions.downloadArtifact({
        owner: "heddendorp",
        repo: "n8n",
        artifact_id: artifact.id,
        archive_format: "zip",
    });

    console.log(download);

    const response = await fetch(download.url);
    if (!response.ok) {
      throw new Error(`Unexpected response ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error(`No response body`);
    }
    jetpack.dir(`./artifacts/${artifact.id}`, { empty: true });
    console.log(`Downloading artifact ${artifact.id}...`);
    await streamPipeline(
      response.body,
      Extract({ path: `./artifacts/${artifact.id}` })
    );
  }

  // Save the failed runs data to a JSON file for future analysis
  fs.writeFileSync("./failedRuns.json", JSON.stringify(failedRuns, null, 2));
}

checkActions();
