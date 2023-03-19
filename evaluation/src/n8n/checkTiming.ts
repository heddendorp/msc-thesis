import * as dotenv from "dotenv";
dotenv.config();
import { Octokit } from "octokit";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import lodash from "lodash";

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { promisify } from "util";
import { pipeline } from "stream";
import jetpack from "fs-jetpack";
import { Extract } from "unzip-stream";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const streamPipeline = promisify(pipeline);

type Data = {
  timings: {
    runs: {
      id: number;
      conclusion: string;
      installDuration: number;
      testDuration: number;
      installConclusion: string;
      testConclusion: string;
      sha: string;
      passed: boolean;
      passedInstrumented: boolean;
    }[];
    testcases: {
      name: string;
      averageDuration: number;
      averageDurationInstrumented: number;
      results: {
        passed: number;
        failed: number;
        skipped: number;
      };
      resultsInstrumented: {
        passed: number;
        failed: number;
        skipped: number;
      };
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
db.data ||= { timings: { runs: [], testcases: [] } };
db.data.timings = { runs: [], testcases: [] };

if (!db.data) {
  throw new Error("no data");
}

// Get action results

// Get action results
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

if (
  runs.find(
    (run) =>
      (run.status === "in_progress" || run.status === "queued") &&
      run.name?.includes("establishHostedTimings")
  )
) {
  throw new Error("There is a run in progress, please wait for it to finish");
}

const getRunData = async (run: {
  id: number;
  conclusion: string | null;
  //   [key: string]: any;
}): Promise<{
  id: number;
  conclusion: string;
  installDuration: number;
  testDuration: number;
  installConclusion: string;
  testConclusion: string;
}> => {
  const runData = await octokit.rest.actions.listJobsForWorkflowRun({
    owner: "heddendorp",
    repo: "n8n",
    run_id: run.id,
  });
  const installJob = runData.data.jobs.find((job) =>
    job.name?.includes("install")
  );
  const testJob = runData.data.jobs.find((job) =>
    job.name?.includes("testing")
  );
  return {
    id: run.id,
    conclusion: run.conclusion ?? "",
    installDuration:
      new Date(installJob?.completed_at ?? "").getTime() -
      new Date(installJob?.started_at ?? "").getTime(),
    testDuration:
      new Date(testJob?.completed_at ?? "").getTime() -
      new Date(testJob?.started_at ?? "").getTime(),
    installConclusion: installJob?.conclusion ?? "",
    testConclusion: testJob?.conclusion ?? "",
  };
};

// throw new Error("stop");
const updateDB = runs
  .filter((run) => run.name?.includes("establishHostedTimings"))
  .map(async (run) => {
    if (run.conclusion) {
      const commit = run.name?.split("-")[1].split("➡️")[0].trim();
      if (!commit) {
        console.log("no commit found");
        return;
      }

      const runIndex = db.chain
        .get("timings.runs")
        .findIndex({ id: run.id })
        .value();
      if (!runIndex) {
        console.log("no runIndex found");
        return;
      }
      if (runIndex === -1) {
        const runData = await getRunData(run);
        db.chain
          .get("timings.runs")
          .push({
            id: run.id,
            conclusion: run.conclusion,
            installDuration: runData.installDuration,
            testDuration: runData.testDuration,
            installConclusion: runData.installConclusion,
            testConclusion: runData.testConclusion,
            sha: commit,
            passed: run.conclusion === "success",
            passedInstrumented: run.conclusion === "success",
          })
          .value();
      } else {
        console.log("run already exists");
      }
    }
  });
await Promise.all(updateDB);

// Download reports for each run
const downloadReports = db.chain
  .get("timings.runs")
  .map(async (run) => {
    const artifactResponse =
      await octokit.rest.actions.listWorkflowRunArtifacts({
        owner: "heddendorp",
        repo: "n8n",
        run_id: run.id,
      });
    const artifact = artifactResponse.data.artifacts.find((artifact) =>
      artifact.name?.includes("results-no-coverage")
    );
    if (!artifact) {
      console.log("no artifact found");
      return;
    }
    const downloadResponse = await octokit.rest.actions.downloadArtifact({
      owner: "heddendorp",
      repo: "n8n",
      artifact_id: artifact.id,
      archive_format: "zip",
    });
    const response = await fetch(downloadResponse.url);
    if (!response.ok) {
      throw new Error(`Unexpected response ${response.statusText}`);
    }
    jetpack.dir(`./timing-reports/${run.id}`, { empty: true });
    await streamPipeline(
      // @ts-ignore
      response.body,
      Extract({ path: `./timing-reports/${run.id}` })
    );

    const coverageArtifact = artifactResponse.data.artifacts.find((artifact) =>
      artifact.name?.includes("results-coverage")
    );
    if (!coverageArtifact) {
      console.log("no artifact found");
      return;
    }
    const coverageDownloadResponse =
      await octokit.rest.actions.downloadArtifact({
        owner: "heddendorp",
        repo: "n8n",
        artifact_id: coverageArtifact.id,
        archive_format: "zip",
      });
    const coverageResponse = await fetch(coverageDownloadResponse.url);
    if (!coverageResponse.ok) {
      throw new Error(`Unexpected response ${coverageResponse.statusText}`);
    }
    jetpack.dir(`./timing-reports/${run.id}-coverage`, { empty: true });
    await streamPipeline(
      // @ts-ignore
      coverageResponse.body,
      Extract({ path: `./timing-reports/${run.id}-coverage` })
    );
  })
  .value();
await Promise.all(downloadReports);

// Map that saves all durations for each testcase
const testcaseDurations: Record<string, number[]> = {};
const coverageTestcaseDurations: Record<string, number[]> = {};
const testcaseResults: Record<
  string,
  { passed: number; failed: number; skipped: number }
> = {};
const coverageTestcaseResults: Record<
  string,
  { passed: number; failed: number; skipped: number }
> = {};

// Read downloaded reports and compile data for every testcase
const readReports = db.chain
  .get("timings.runs")
  .map(async (run) => {
    const reportContent = await jetpack.readAsync(
      `./timing-reports/${run.id}/report.json`,
      "json"
    );
    const coverageReportContent = await jetpack.readAsync(
      `./timing-reports/${run.id}-coverage/report.json`,
      "json"
    );
    const allTests: any[] = [];
    reportContent.results.forEach((result: any) => {
      allTests.push(...result.tests);
      result.suites.forEach((suite: any) => {
        allTests.push(...suite.tests);
        suite.suites.forEach((suite: any) => {
          allTests.push(...suite.tests);
        });
      });
    });
    allTests.forEach((test: any) => {
      if (!testcaseResults[test.fullTitle]) {
        testcaseResults[test.fullTitle] = {
          passed: 0,
          failed: 0,
          skipped: 0,
        };
      }
      testcaseResults[test.fullTitle][
        test.state as "passed" | "failed" | "skipped"
      ]++;
      if (testcaseDurations[test.fullTitle]) {
        testcaseDurations[test.fullTitle].push(test.duration);
      } else {
        testcaseDurations[test.fullTitle] = [test.duration];
      }
    });

    const coverageTests: any[] = [];
    coverageReportContent.results.forEach((result: any) => {
      coverageTests.push(...result.tests);
      result.suites.forEach((suite: any) => {
        coverageTests.push(...suite.tests);
        suite.suites.forEach((suite: any) => {
          coverageTests.push(...suite.tests);
          
        });
      });
    });
    coverageTests.forEach((test: any) => {
      if (!coverageTestcaseResults[test.fullTitle]) {
        coverageTestcaseResults[test.fullTitle] = {
          passed: 0,
          failed: 0,
          skipped: 0,
        };
      }
      coverageTestcaseResults[test.fullTitle][
        test.state as "passed" | "failed" | "skipped"
      ]++;
      if (coverageTestcaseDurations[test.fullTitle]) {
        coverageTestcaseDurations[test.fullTitle].push(test.duration);
      } else {
        coverageTestcaseDurations[test.fullTitle] = [test.duration];
      }
    });

    // update passed flags for run
    const passed = allTests.every((test) => test.state === "passed");
    const passedInstrumented = coverageTests.every(
      (test) => test.state === "passed"
    );

    run.passed = passed;
    run.passedInstrumented = passedInstrumented;
  })
  .value();
await Promise.all(readReports);

// Calculate average duration for each testcase and enter it into the db
Object.keys(testcaseDurations).forEach((testcase) => {
  const testcaseIndex = db.chain
    .get("timings.testcases")
    .findIndex({ name: testcase })
    .value();
  if (testcaseIndex === -1) {
    db.chain
      .get("timings.testcases")
      .push({
        name: testcase,
        averageDuration: Math.round(
          testcaseDurations[testcase].reduce((a, b) => a + b, 0) /
            testcaseDurations[testcase].length
        ),
        averageDurationInstrumented: Math.round(
          coverageTestcaseDurations[testcase].reduce((a, b) => a + b, 0) /
            coverageTestcaseDurations[testcase].length
        ),
        results: testcaseResults[testcase],
        resultsInstrumented: coverageTestcaseResults[testcase],
      })
      .value();
  } else {
    db.chain
      .get("timings.testcases")
      .nth(testcaseIndex)
      .assign({
        averageDuration: Math.round(
          testcaseDurations[testcase].reduce((a, b) => a + b, 0) /
            testcaseDurations[testcase].length
        ),
        averageDurationInstrumented: Math.round(
          coverageTestcaseDurations[testcase].reduce((a, b) => a + b, 0) /
            coverageTestcaseDurations[testcase].length
        ),
      })
      .value();
  }
});

await db.write();
