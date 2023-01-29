import * as dotenv from "dotenv";
dotenv.config();
import jetpack from "fs-jetpack";
import { fetch } from "@whatwg-node/fetch";

const masterPlanKeyRegular = "ARTEMIS-AETG";
const masterPlanKeyFlaky = "ARTEMIS-AECF";

async function run() {
  const existingData = jetpack.read("evaluation/data.json", "json") || [];

  const regularBranchesResponse = await fetch(
    `https://bamboobruegge.in.tum.de/rest/api/latest/plan/${masterPlanKeyRegular}.json?expand=branches`,
    {
      headers: {
        Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
      },
    }
  );
  const regularBranchesData = await regularBranchesResponse.json();

  const flakyBranchesResponse = await fetch(
    `https://bamboobruegge.in.tum.de/rest/api/latest/plan/${masterPlanKeyFlaky}.json?expand=branches`,
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

  regularBranchesData.branches.branch.forEach(
    (branch: { key: string; shortName: string }) => {
      const flakyBranch = flakyBranchesData.branches.branch.find(
        (flakyBranch: { key: string; shortName: string }) =>
          flakyBranch.shortName === branch.shortName
      );
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
      regularBuildKey: string;
      flakyBuildKey: string;
      flakyLabel: string;
      regularLabel: string;
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
      `https://bamboobruegge.in.tum.de/rest/api/latest/result/${branch.regularKey}.json?expand=results.result.stages.stage.results.result.,results.result.labels`,
      {
        headers: {
          Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
        },
      }
    );
    const regularBuildsData = await regularBuildsResponse.json();
    const flakyBuildsResponse = await fetch(
      `https://bamboobruegge.in.tum.de/rest/api/latest/result/${branch.flakyKey}.json?expand=results.result.stages.stage.results.result.,results.result.labels`,
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

    const resultData: Array<{
      regularBuildKey: string;
      flakyBuildKey: string;
      flakyLabel: string;
      regularLabel: string;
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
    }> = [];

    for (const result of regularBuildsData.results.result) {
      const flakyResult = flakyBuildsData.results.result.find(
        (flakyResult: { vcsRevisionKey: string }) =>
          flakyResult.vcsRevisionKey === result.vcsRevisionKey
      );
      if (!flakyResult) {
        console.log(`No flaky build for ${result.buildResultKey}`);
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
        `https://bamboobruegge.in.tum.de/rest/api/latest/result/${regularStageResult.key}.json?expand=testResults.allTests`,
        {
          headers: {
            Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
          },
        }
      );
      const regularTestData = await regularTestResponse.json();

      const flakyTestResponse = await fetch(
        `https://bamboobruegge.in.tum.de/rest/api/latest/result/${flakyStageResult.key}.json?expand=testResults.allTests`,
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

      resultData.push({
        regularBuildKey: result.buildResultKey,
        flakyBuildKey: flakyResult.buildResultKey,
        flakyLabel,
        regularLabel,
        flakyTests: flakyTests.map((test) => ({
          methodName: test.methodName,
          status: test.status,
          successful: test.status === "successful",
        })),
        regularTests: regularTests.map((test) => ({
          methodName: test.methodName,
          status: test.status,
          successful: test.status === "successful",
        })),
        combinedTests,
        flakyFailed,
        regularFailed,
        onlyRunInFlaky,
        onlyRunInRegular,
      });
    }

    branchData = [
      ...branchData.filter(
        (branchData) => branchData.name !== branch.name
      ),
      {
        ...branch,
        results: resultData,
      }
    ];
  }

  jetpack.write("data/json/live-data.json", branchData);
}

run();
