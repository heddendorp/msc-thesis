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

// find longest test duration
const longestTestDuration = db.chain
  .get("baseLine.commits")
  .flatMap((commit) => commit.runs)
  .maxBy((run) => run.testDuration)
  .get("testDuration")
  .value();

  // find longest duration of a successful run
  const longestSuccessfulTestDuration = db.chain
  .get("baseLine.commits")
  .flatMap((commit) => commit.runs)
  .filter((run) => run.conclusion === "success")
  .maxBy((run) => run.testDuration)
  .get("testDuration")
  .value();

  console.log(longestTestDuration)

  // transform to minutes
  const longestTestDurationMinutes = Math.round(longestTestDuration / 1000 / 60);
  console.log(longestTestDurationMinutes)

  // transform to minutes
  const longestSuccessfulTestDurationMinutes = Math.round(longestSuccessfulTestDuration / 1000 / 60);
  console.log(longestSuccessfulTestDurationMinutes)