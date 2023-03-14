import * as dotenv from "dotenv";
import { Octokit } from "octokit";
dotenv.config();
import { execSync } from "child_process";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const runName = "gamma";
const defaultInput = {
  coverage: "[false]",
  containers: "[1]",
};
const evals = [
  {
    ref: "1bdeb6684a68f985a71ddeb11eea75dce19dde78",
    compare: "d253aa3e950e2b5976170be27adfcdb1b131ba4e",
  },
  {
    ref: "d253aa3e950e2b5976170be27adfcdb1b131ba4e",
    compare: "c6ba0bd8de5f3cf2c73e042002d7b233cb567aa6",
  },
  {
    ref: "c6ba0bd8de5f3cf2c73e042002d7b233cb567aa6",
    compare: "90afa5e55f96fbe46417f4be8f764795fb5c2225",
  },
  {
    ref: "90afa5e55f96fbe46417f4be8f764795fb5c2225",
    compare: "5c4343b828ad18034e284afa23d5074d82b133af",
  },
  {
    ref: "5c4343b828ad18034e284afa23d5074d82b133af",
    compare: "3831201aafea91a9a48ea42fe3b570a5e0fb67b4",
  },
  {
    ref: "3831201aafea91a9a48ea42fe3b570a5e0fb67b4",
    compare: "5f238ea6413d25704a5865d339401117e81dbbab",
  },
  {
    ref: "5f238ea6413d25704a5865d339401117e81dbbab",
    compare: "a881512b49421e5c0dab243502bbbd41caba25a0",
  },
  {
    ref: "a881512b49421e5c0dab243502bbbd41caba25a0",
    compare: "69b124fc7823e5fb4d0a8090959b3f0b17476ca4",
    // containers: "[1,2,3,4,5]",
  },
  {
    ref: "69b124fc7823e5fb4d0a8090959b3f0b17476ca4",
    compare: "974d57dfed78489d3f22c8c63e0ea624c637bfe0",
  },
  {
    ref: "974d57dfed78489d3f22c8c63e0ea624c637bfe0",
    compare: "8a21fefbc67598452872e6944313d5e3fa6567c1",
  },
  {
    ref: "8a21fefbc67598452872e6944313d5e3fa6567c1",
    compare: "7a4e9ef5faa0bc664d070e0808865b0ec8340c9e",
  },
];

async function run() {
  for (const evaluation of evals) {
    await octokit.rest.actions.createWorkflowDispatch({
      owner: "heddendorp",
      repo: "n8n",
      workflow_id: "e2e-historic.yml",
      ref: "master",
      inputs: {
        ...evaluation,
        run: runName,
      },
    });
  }
}

run();
