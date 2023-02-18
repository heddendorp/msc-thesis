import * as dotenv from "dotenv";
dotenv.config();
import jetpack from "fs-jetpack";
import { XMLParser } from "fast-xml-parser";
import { fetch } from "@whatwg-node/fetch";

const masterPlanKeyRegular = "ARTEMIS-AETG";
const masterPlanKeyFlaky = "ARTEMIS-AECF";
const xmlParser = new XMLParser();

async function run() {
  const data = jetpack.read("./data/data.json", "json");
  const branches = data.branches;
  const newBranches = [];
  for (const branch of branches) {
      const regularPlanResponse = await fetch(
        `https://bamboobruegge.in.tum.de/rest/api/latest/search/branches?masterPlanKey=${masterPlanKeyRegular}&searchTerm=${branch.branchName.replace(
          "/",
          "-"
        )}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
          },
        }
      );
      const regularXml = await regularPlanResponse.text();
      const regularData = xmlParser.parse(regularXml);
      let regularKey
      try{
        regularKey =
        regularData.searchResults.searchResults.searchEntity.key;
      } catch (e) {
        console.log(`Could not find regular plan for ${branch.branchName}`);
      }

      const flakyPlanResponse = await fetch(
        `https://bamboobruegge.in.tum.de/rest/api/latest/search/branches?masterPlanKey=${masterPlanKeyFlaky}&searchTerm=${branch.branchName.replace(
          "/",
          "-"
        )}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
          },
        }
      );
      const flakyXml = await flakyPlanResponse.text();
      const flakyData = xmlParser.parse(flakyXml);
      let flakyKey
      try{
        flakyKey =
        flakyData.searchResults.searchResults.searchEntity.key;
      } catch (e) {
        console.log(`Could not find flaky plan for ${branch.branchName}`);
      }

      const plans = [
        {
          planKey: regularKey,
          isFlakeCheck: false,
          runningGoal: 10,
          saveLogs: true,
        },
        {
          planKey: flakyKey,
          isFlakeCheck: true,
          runningGoal: 10,
          saveLogs: true,
        },
      ];
      if(!regularKey || !flakyKey){
         newBranches.push(branch)
      } else {
        newBranches.push({
          ...branch,
          plans,
        });
      }
  }
  jetpack.write("./data/data.json", { ...data, branches: newBranches });
}

run();
