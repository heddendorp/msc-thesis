import * as dotenv from "dotenv";
dotenv.config();
import { Octokit } from "octokit";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import lodash from "lodash";

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import jetpack from "fs-jetpack";
import { execa } from "execa";

type Data = {
  baseLine: {
    commits: {
      sha: string;
      parent: string;
      branch: string;
      successful: boolean;
      flaky: boolean;
      runs: {
        id: number;
        conclusion: string;
        installDuration: number;
        testDuration: number;
        installConclusion: string;
        testConclusion: string;
      }[];
    }[];
  };
  prs: {
    number: number;
    name: string;
    state: string;
    merged: boolean;
    commits: {
      sha: string;
      parent: string;
    }[];
  }[];
};

class LowWithLodash<T> extends Low<T> {
  chain: lodash.ExpChain<this["data"]> = lodash.chain(this).get("data");
}

// File path
const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "db.json");

// Configure lowdb to write to JSONFile
const adapter = new JSONFile<Data>(file);
const db = new LowWithLodash(adapter);

// Read data from JSON file, this will set db.data content
await db.read();

// If file.json doesn't exist, db.data will be null
// Set default data
db.data ||= { baseLine: { commits: [] }, prs: [] };
db.data.baseLine ||= { commits: [] };
db.data.prs ||= [];

const getRelatedCommits = (commits: string[]): string[] => {
  const uniqueCommits = lodash.uniq(commits);
  const newSet = [...uniqueCommits];
  uniqueCommits.forEach((commit) => {
    const commitData = db.chain
      .get("baseLine.commits")
      .find({ sha: commit })
      .value();

    if (commitData) {
      newSet.push(commitData.parent);
    }

    const childData = db.chain
      .get("baseLine.commits")
      .filter({ parent: commit })
      .value();

    if (childData) {
      childData.forEach((child) => {
        newSet.push(child.sha);
      });
    }
  });
  if (lodash.uniq(newSet).length === uniqueCommits.length) {
    return lodash.uniq(newSet);
  } else {
    return getRelatedCommits(lodash.uniq(newSet));
  }
};

if (!db.data) {
  throw new Error("no data");
}

const diagramLines: string[] = [`flowchart TD`];

const prCommits = db.chain.get("prs").flatMap("commits").map("sha").value();

db.chain
  .get("baseLine.commits")
  .value()
  .filter((commit) => {
    if (prCommits.includes(commit.sha)) {
      return true;
    }
    // return false;
    const relatedCommits = getRelatedCommits([commit.sha]);
    return lodash.intersection(relatedCommits, prCommits).length > 0;
  })
  .forEach((commit) => {
    const commitInPr = prCommits.includes(commit.sha);
    if (commitInPr) {
      diagramLines.push(
        ` ${commit.sha}("${commit.branch || "unknown"}(${commit.runs.length})")`
      );
    } else {
      diagramLines.push(
        ` ${commit.sha}(["${commit.branch || "unknown"}(${
          commit.runs.length
        })"])`
      );
    }
    if (commit.successful) {
      diagramLines.push(` style ${commit.sha} stroke:green,stroke-width:2px`);
    } else {
      diagramLines.push(` style ${commit.sha} stroke:red,stroke-width:2px`);
    }
    diagramLines.push(` ${commit.sha} --> ${commit.parent}`);
  });

// db.chain
//   .get("baseLine.commits")
//   .value()
//   .forEach((commit) => {
//     diagramLines.push(` ${commit.sha} --> ${commit.parent}`);
//   });

const diagram = lodash.uniq(diagramLines).join("\n");

jetpack.write("diagram.mermaid", diagram);
await execa("mmdc", [
  "-i",
  "diagram.mermaid",
  "-o",
  "diagram.svg",
  "-b",
  "transparent",
]);
