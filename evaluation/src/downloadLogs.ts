import * as dotenv from "dotenv";
dotenv.config();

import { chromium } from "playwright";
import * as jetpack from "fs-jetpack";
import { XMLParser } from "fast-xml-parser";
import { fetch } from "@whatwg-node/fetch";

const xmlParser = new XMLParser();

async function run() {
  const data = jetpack.read("./data/data.json", "json");
  const browser = await chromium.launch({ headless: !process.env.DEV });
  let page;
  const login = async () => {
    const page = await browser.newPage();
    await page.goto(
      "https://bamboobruegge.in.tum.de/userlogin!doDefault.action?os_destination=%2Fstart.action"
    );
    await page.getByLabel("Username").click();
    await page.getByLabel("Username").fill(process.env.BAMBOO_USERNAME ?? "");
    await page.getByLabel("Password").click();
    await page.getByLabel("Password").fill(process.env.BAMBOO_PASSWORD ?? "");
    await page.getByLabel("Remember my login on this computer").check();
    await page.locator("#loginForm_save").click();
    return page;
  };
  for (const branch of data.branches) {
    if(!branch.plans){
      continue;
    }
    for (const plan of branch.plans) {
      if (!plan.saveLogs) continue;
      console.log(`Downloading logs for ${plan.planKey}`);
      const planResponse = await fetch(
        `https://bamboobruegge.in.tum.de/rest/api/latest/result/${plan.planKey}?max-results=900`,
        {
          headers: {
            Authorization: `Bearer ${process.env.BAMBOO_TOKEN}`,
          },
        }
      );
      const xml = await planResponse.text();
      const data = xmlParser.parse(xml).results?.results?.result;
      const results = (Array.isArray(data)?data:data?[data]:[]).filter((result) => result.buildState !== "Unknown");
      for (const result of results) {
        const buildNumber = result.buildNumber;
        console.log(`Checking build #${buildNumber}`);
        const logPath = `./data/logs/${branch.branchName}/${plan.planKey}/${buildNumber}.txt`;
        const logExists = jetpack.exists(logPath);
        if (logExists) {
          console.log("Log already exists");
          continue;
        }
        if(!page){
          page = await login();
        }
        await page.goto(
          `https://bamboobruegge.in.tum.de/browse/${plan.planKey}-${buildNumber}/log`
        );
        console.log("Trying download");
        try {
          const downloadPromise = page.waitForEvent("download", {
            timeout: 1000,
          });
          downloadPromise.catch(() => {});
          await page
            .getByRole("link", { name: "Download" })
            .click({ timeout: 500 });
          const download = await downloadPromise;
          await download.saveAs(logPath);
          console.log(
            `Downloaded logs for ${plan.planKey} #${buildNumber} to ${logPath}`
          );
        } catch (e) {
          console.log("Download failed");
        }
        console.log();
      }
    }
  }
  browser.close();
}

void run();
