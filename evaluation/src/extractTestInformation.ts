import * as dotenv from "dotenv";
import { XMLParser } from "fast-xml-parser";
dotenv.config();

import * as jetpack from "fs-jetpack";

async function run() {
  const alwaysArray = [
    "testsuite",
    "testcase",
    "failure",
    "error",
    "skipped",
    "system-out",
    "system-err",
  ];
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (name, jpath, isLeafNode, isAttribute) => {
      if (name === "testsuites") {
        return false;
      }
      return alwaysArray.includes(name);
    },
  });
  const data = jetpack.read("./data/data.json", "json");
  const index: any[] = [];
  for (const branch of data.branches) {
    console.log(`Branch: ${branch.branchName}`);
    for (const plan of branch.plans) {
      console.log(`Plan: ${plan.planKey}`);
      if (!jetpack.exists(`./data/logs/${branch.branchName}/${plan.planKey}`)) {
        console.log(`No logs for ${plan.planKey}`);
        continue;
      }
      const logFiles = jetpack.find(`./data/logs/${branch.branchName}/${plan.planKey}`, {
        matching: "*.txt",
      });
      const informationFiles: string[] = [];
      let confirmedFlakes = 0;
      let fails = 0;
      const times: number[] = [];
      for (const logFile of logFiles) {
        console.log(`Checking logfile: ${logFile}`);
        const log = jetpack.read(logFile, "utf8");
        if (!log) {
          console.log(`No log for ${logFile}`);
          continue;
        }
        const lines = log.split("\n");
        const xmlStartLines = lines
          .map(
            (line, index) =>
              line.includes('<?xml version="1.0" encoding="UTF-8"?>') && index
          )
          .filter((line) => typeof line === "number") as number[];
        const xmlEndLines = lines
          .map((line, index) => line.includes("</testsuites>") && index)
          .filter((line) => typeof line === "number") as number[];
        if (xmlStartLines.length !== xmlEndLines.length) {
          console.log(`Mismatched XML start and end lines`);
          continue;
        }
        const testsuites: any[] = [];
        for (let i = 0; i < xmlStartLines.length; i++) {
          const xml = lines
            .slice(xmlStartLines[i] + 1, xmlEndLines[i])
            .map((line) => line.slice(line.indexOf("|") + 6))
            .join("\n");
          const json = parser.parse(xml).testsuites.testsuite;
          if (json.length === 1) {
            testsuites.push({ ...json[0], testsuites: [json[0]] });
            continue;
          }
          testsuites.push({ ...json[0], testsuites: json.slice(1) });
        }

        const flakeOutputStartLine = lines.findIndex((line) =>
          line.includes("==FLAKECHECK:START==")
        );
        const flakeOutputEndLine = lines.findIndex((line) =>
          line.includes("==FLAKECHECK:END==")
        );
        let flakeData: any = null;
        if (flakeOutputStartLine !== -1 && flakeOutputEndLine !== -1) {
          const flakeOutput = lines
            .slice(flakeOutputStartLine + 1, flakeOutputEndLine)
            .filter(line => line.includes('artemis-cypress_1'))
            .map((line) => line.slice(line.indexOf("|") + 6))
            .join("\n");
          flakeData = JSON.parse(flakeOutput);
        }

        const testcases = testsuites.flatMap((testsuite) =>
          testsuite.testsuites
            .filter((testsuite) => testsuite.testcase?.length)
            .flatMap((testsuite) => testsuite.testcase)
        );
        const totalTime = testcases
          .map((testcase) => Number(testcase.time))
          .reduce((a, b) => a + b, 0);

        const failedBuild = testsuites.some((test) =>
          test.testsuites.some((testsuite) => Number(testsuite.failures) > 0)
        );
        const hasRerun = log.includes("RERUN:");
        const suspectedFlaky = log.includes("FLAKECHECK:POSITIVE");
        const suspectedNotFlaky = log.includes("FLAKECHECK:NEGATIVE");
        const confirmedFlaky = !failedBuild && hasRerun;
        const flakeCheckIssue = failedBuild && suspectedNotFlaky;

        const jsonFile = logFile
          .replace(".txt", ".json")
          .replace("logs", "json");
        informationFiles.push(jsonFile.replaceAll("\\", "/"));
        times.push(totalTime);
        if (confirmedFlaky) {
          confirmedFlakes++;
        }
        if (failedBuild) {
          fails++;
        }
        jetpack.write(jsonFile, {
          analyzedTests: testsuites.length,
          analyzedTestcases: testcases.length,
          failedBuild,
          hasRerun,
          suspectedFlaky,
          confirmedFlaky,
          flakeCheckIssue,
          totalTime: Math.round((Math.round(totalTime) / 60) * 100) / 100,
          tests: testsuites,
          flakeData,
          testcases,
        });
      }
      const averageTime =
        Math.round(
          (times.reduce((a, b) => a + b, 0) / times.length / 60) * 100
        ) / 100;
      index.push({
        ...plan,
        branch: branch.branchName,
        averageTime,
        confirmedFlakes,
        fails,
        informationFiles,
      });
    }
    jetpack.write("./data/json/index.json", index);
    console.log();
  }
}

void run();
