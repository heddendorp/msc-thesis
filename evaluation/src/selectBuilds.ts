import * as dotenv from "dotenv";
dotenv.config();
import jetpack from "fs-jetpack";
import { XMLParser } from "fast-xml-parser";
import { fetch } from "@whatwg-node/fetch";

const masterPlanKeyRegular = "ARTEMIS-AETG";
const xmlParser = new XMLParser();

async function run() {
  const data = jetpack.read("./data/data.json", "json");
  const regularPlanResponse = await fetch(
    `https://bamboobruegge.in.tum.de/rest/api/latest/result/${masterPlanKeyRegular}?max-results=900`,
    {
      headers: {
        Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
      },
    }
  );
  const regularXml = await regularPlanResponse.text();
  const results = xmlParser.parse(regularXml).results.results.result;
  const filteredResults = results.filter((result) => {
    return (
      580 <= result.buildNumber &&
      result.buildNumber <= 792 &&
      result.buildState === "Successful"
    );
  });
  const analyzedBuilds = filteredResults.map((result) => ({
    planKey: masterPlanKeyRegular,
    target: result.buildNumber,
    lastSuccess: results.find(
      (r) => r.buildNumber < result.buildNumber && r.buildState === "Successful"
    ).buildNumber,
  }));
  const newData = {
    ...data,
    analyzedBuilds,
  };
  jetpack.write("./data/data.json", newData);
}

run();
