import * as dotenv from "dotenv";
dotenv.config();
import { Octokit } from "octokit";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import lodash from "lodash";

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

type Data = {
  baseLine: {
    commits: {
      sha: string;
      parent: string;
      branch: string;
      successful: boolean;
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
db.data ||= { baseLine: { commits: [] } };
db.data.baseLine ||= { commits: [] };

if (!db.data) {
  throw new Error("no data");
}

const diagramLines: string[] = [`flowchart TD`];

db.chain.get("baseLine.commits").value().forEach((commit) => {
  if(commit.successful){
    diagramLines.push(` ${commit.sha}("${commit.branch || 'unknown'}(${commit.runs.length})")`)
    diagramLines.push(` style ${commit.sha} stroke:green,stroke-width:2px`)
  } else {
    diagramLines.push(` ${commit.sha}(["${commit.branch || 'unknown'}(${commit.runs.length})"])`)
    diagramLines.push(` style ${commit.sha} stroke:red,stroke-width:2px`)
  }
});

db.chain.get("baseLine.commits").value().forEach((commit) => {
  diagramLines.push(` ${commit.sha} --> ${commit.parent}`)
});

console.log(diagramLines.join('\n'));