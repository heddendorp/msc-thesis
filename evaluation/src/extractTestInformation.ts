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
  for (const branch of data.branches) {
    console.log(`Branch: ${branch.branchName}`);
    for (const plan of branch.plans) {
      console.log(`Plan: ${plan.planKey}`);
      if (!jetpack.exists(`./data/logs/${plan.planKey}`)) {
        console.log(`No logs for ${plan.planKey}`);
        continue;
      }
      const logFiles = jetpack.find(`./data/logs/${plan.planKey}`, {
        matching: "*.txt",
      });
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
          console.log(json);
          testsuites.push({ ...json[0], testsuites: json.slice(1) });
        }

        const testcases = testsuites.flatMap((testsuite) =>
          testsuite.testsuites
            .filter((testsuite) => testsuite.testcase?.length)
            .flatMap((testsuite) => testsuite.testcase)
        );
        const totalTime = testcases
          .map((testcase) => Number(testcase.time))
          .reduce((a, b) => a + b, 0);

        const jsonFile = logFile
          .replace(".txt", ".json")
          .replace("logs", "json");
        jetpack.write(jsonFile, {
          analyzedTests: testsuites.length,
          analyzedTestcases: testcases.length,
          totalTime: Math.round((Math.round(totalTime) / 60) * 100) / 100,
          tests: testsuites,
          testcases,
        });
      }
    }
    console.log();
  }
}

void run();
