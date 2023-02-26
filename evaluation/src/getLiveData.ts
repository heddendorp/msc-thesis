import * as dotenv from "dotenv";
dotenv.config();
import jetpack from "fs-jetpack";
import { fetch } from "@whatwg-node/fetch";

const masterPlanKeyRegular = "ARTEMIS-AETG";
const masterPlanKeyFlaky = "ARTEMIS-AECF";

async function run() {
  const existingData = jetpack.read("evaluation/live-data.json", "json") || [];

  const regularBranchesResponse = await fetch(
    `https://bamboobruegge.in.tum.de/rest/api/latest/plan/${masterPlanKeyRegular}.json?expand=branches&max-results=900`,
    {
      headers: {
        Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
      },
    }
  );
  const regularBranchesData = await regularBranchesResponse.json();

  const flakyBranchesResponse = await fetch(
    `https://bamboobruegge.in.tum.de/rest/api/latest/plan/${masterPlanKeyFlaky}.json?expand=branches&max-results=900`,
    {
      headers: {
        Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
      },
    }
  );
  const flakyBranchesData = await flakyBranchesResponse.json();

  const branches: Array<{
    flakyKey: string;
    regularKey: string;
    name: string;
  }> = [];

  const flakyTestStats = new Map<
    string,
    { total: number; successful: number; failed: number; flaky: number }
  >();

  regularBranchesData.branches.branch.forEach(
    (branch: { key: string; shortName: string }) => {
      const flakyBranch = flakyBranchesData.branches.branch.find(
        (flakyBranch: { key: string; shortName: string }) =>
          flakyBranch.shortName === branch.shortName
      );
      // Skip flaky evaluation branches
      if (branch.shortName.includes("flaky-evaluation")) {
        return;
      }
      if (flakyBranch) {
        branches.push({
          flakyKey: flakyBranch.key,
          regularKey: branch.key,
          name: branch.shortName,
        });
      } else {
        console.log(`Could not find flaky plan for ${branch.shortName}`);
      }
    }
  );

  let branchData: Array<{
    name: string;
    flakyKey: string;
    regularKey: string;
    results: Array<{
      regularBuild: {
        key: string;
        label: string;
        state: string;
        startTime: string;
        completeTime: string;
        duration: number;
        queuedDuration: number;
        buildNumber: number;
        successful: boolean;
      };
      flakyBuild: {
        key: string;
        label: string;
        state: string;
        startTime: string;
        completeTime: string;
        duration: number;
        queuedDuration: number;
        buildNumber: number;
        successful: boolean;
      };
      flakyTests: Array<{
        methodName: string;
        status: "successful" | "failed";
        successful: boolean;
      }>;
      regularTests: Array<{
        methodName: string;
        status: "successful" | "failed";
        successful: boolean;
      }>;
      combinedTests: Array<{
        methodName: string;
        flakyStatus: "successful" | "failed";
        regularStatus: "successful" | "failed";
        flakySuccessful: boolean;
        regularSuccessful: boolean;
      }>;
      flakyFailed: number[];
      regularFailed: number[];
      onlyRunInFlaky: number[];
      onlyRunInRegular: number[];
    }>;
  }> = existingData;

  for (const branch of branches) {
    const regularBuildsResponse = await fetch(
      `https://bamboobruegge.in.tum.de/rest/api/latest/result/${branch.regularKey}.json?expand=results.result.stages.stage.results.result.,results.result.labels&max-results=900`,
      {
        headers: {
          Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
        },
      }
    );
    const regularBuildsData = await regularBuildsResponse.json();
    const flakyBuildsResponse = await fetch(
      `https://bamboobruegge.in.tum.de/rest/api/latest/result/${branch.flakyKey}.json?expand=results.result.stages.stage.results.result.,results.result.labels&max-results=900`,
      {
        headers: {
          Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
        },
      }
    );
    const flakyBuildsData = await flakyBuildsResponse.json();

    if (
      regularBuildsData.results.result.length === 0 ||
      flakyBuildsData.results.result.length === 0
    ) {
      console.log(`No builds for ${branch.name}`);
      continue;
    }

    const resultData: (typeof branchData)[0]["results"] = [];

    for (const result of regularBuildsData.results.result) {
      const flakyResult = flakyBuildsData.results.result.find(
        (flakyResult: { vcsRevisionKey: string }) =>
          flakyResult.vcsRevisionKey === result.vcsRevisionKey
      );
      if (!flakyResult) {
        console.log(`No flaky build for ${result.buildResultKey}`);
        continue;
      }

      // Skip builds started before the flaky evaluation
      if (
        new Date(result.buildStartedTime) <
        new Date("2023-02-27T00:00:00.000+0000")
      ) {
        continue;
      }

      const flakyLabel = flakyResult.labels.label[0]?.name;
      const regularLabel = result.labels.label[0]?.name;

      const regularStageResult = result.stages.stage[0]?.results?.result[0];
      const flakyStageResult = flakyResult.stages.stage[0]?.results?.result[0];

      if (!regularStageResult || !flakyStageResult) {
        console.log(`No stage result for ${result.buildResultKey}`);
        continue;
      }

      const regularTestResponse = await fetch(
        `https://bamboobruegge.in.tum.de/rest/api/latest/result/${regularStageResult.key}.json?expand=testResults.allTests&max-results=900`,
        {
          headers: {
            Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
          },
        }
      );
      const regularTestData = await regularTestResponse.json();

      const flakyTestResponse = await fetch(
        `https://bamboobruegge.in.tum.de/rest/api/latest/result/${flakyStageResult.key}.json?expand=testResults.allTests&max-results=900`,
        {
          headers: {
            Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
          },
        }
      );
      const flakyTestData = await flakyTestResponse.json();

      const regularTests = regularTestData.testResults.allTests.testResult;
      const flakyTests = flakyTestData.testResults.allTests.testResult;

      const combinedTests: Array<{
        methodName: string;
        flakyStatus: "successful" | "failed";
        regularStatus: "successful" | "failed";
        flakySuccessful: boolean;
        regularSuccessful: boolean;
      }> = [];

      for (const test of regularTests) {
        const flakyTest = flakyTests.find(
          (flakyTest: { methodName: string }) =>
            flakyTest.methodName === test.methodName
        );
        if (flakyTest) {
          combinedTests.push({
            methodName: test.methodName,
            flakyStatus: flakyTest.status,
            regularStatus: test.status,
            flakySuccessful: flakyTest.status === "successful",
            regularSuccessful: test.status === "successful",
          });
        }
      }
      for (const test of flakyTests) {
        if (!flakyTestStats.has(test.methodName)) {
          flakyTestStats.set(test.methodName, {
            successful: 0,
            failed: 0,
            total: 0,
            flaky: 0,
          });
        }
        const testStats = flakyTestStats.get(test.methodName);
        testStats.total++;
        if (test.status === "failed") {
          testStats.failed++;
          if (flakyLabel) {
            testStats.flaky++;
          }
        } else {
          testStats.successful++;
        }
        flakyTestStats.set(test.methodName, testStats);
      }

      const flakyFailed = flakyTests
        .filter((test) => test.status === "failed")
        .map((test) => test.testCaseId);
      const regularFailed = regularTests
        .filter((test) => test.status === "failed")
        .map((test) => test.testCaseId);

      const onlyRunInFlaky = flakyTests
        .filter(
          (test) =>
            !regularTests.find(
              (regularTest) => regularTest.methodName === test.methodName
            )
        )
        .map((test) => test.testCaseId);
      const onlyRunInRegular = regularTests
        .filter(
          (test) =>
            !flakyTests.find(
              (flakyTest) => flakyTest.methodName === test.methodName
            )
        )
        .map((test) => test.testCaseId);

      const bothSuccessful = result.successful && flakyResult.successful;

      resultData.push({
        regularBuild: {
          key: result.buildResultKey,
          label: regularLabel,
          state: result.buildState,
          startTime: result.buildStartedTime,
          completeTime: result.buildCompletedTime,
          duration: result.buildDuration,
          queuedDuration: result.queuedDuration,
          buildNumber: result.buildNumber,
          successful: result.successful,
        },
        flakyBuild: {
          key: flakyResult.buildResultKey,
          label: flakyLabel,
          state: flakyResult.buildState,
          startTime: flakyResult.buildStartedTime,
          completeTime: flakyResult.buildCompletedTime,
          duration: flakyResult.buildDuration,
          queuedDuration: flakyResult.queuedDuration,
          buildNumber: flakyResult.buildNumber,
          successful: flakyResult.successful,
        },
        flakyTests: bothSuccessful
          ? []
          : flakyTests.map((test) => ({
              methodName: test.methodName,
              status: test.status,
              successful: test.status === "successful",
            })),
        regularTests: bothSuccessful
          ? []
          : regularTests.map((test) => ({
              methodName: test.methodName,
              status: test.status,
              successful: test.status === "successful",
            })),
        combinedTests: bothSuccessful ? [] : combinedTests,
        flakyFailed,
        regularFailed,
        onlyRunInFlaky,
        onlyRunInRegular,
      });
    }

    branchData = [
      ...branchData.filter((branchData) => branchData.name !== branch.name),
      {
        ...branch,
        results: resultData,
      },
    ];
  }
  jetpack.write("data/live-data.json", {
    branchData,
    flakyTestStats: Array.from(flakyTestStats.entries()).map(([test, stats]) => ({
      test,
      ...stats,
    })),
  });
}

run();
