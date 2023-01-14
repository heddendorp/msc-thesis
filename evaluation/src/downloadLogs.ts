import * as dotenv from "dotenv";
dotenv.config();

import { chromium } from "playwright";
import * as jetpack from "fs-jetpack";

async function run() {
  const data = jetpack.read("./data/data.json", "json");
  const browser = await chromium.launch({ headless: !process.env.DEV });
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
  for (const branch of data.branches) {
    if(!branch.plans){
      continue;
    }
    for (const plan of branch.plans) {
      if (!plan.saveLogs) continue;
      console.log(`Downloading logs for ${plan.planKey}`);
      await page.goto(`https://bamboobruegge.in.tum.de/browse/${plan.planKey}`);
      await page.locator(`[id="history\\:${plan.planKey}"]`).click();
      const rows = await page.getByRole("row").allInnerTexts();
      for (const row of rows) {
        if (!row.trim().startsWith("#")) continue;
        const buildNumber = row.match(/#(\d+)/)?.[1] ?? "";
        console.log(`Checking build #${buildNumber}`);
        const logPath = `./data/logs/${branch.branchName}/${plan.planKey}/${buildNumber}.txt`;
        const logExists = jetpack.exists(logPath);
        if (logExists) {
          console.log("Log already exists");
          continue;
        }
        await page.goto(
          `https://bamboobruegge.in.tum.de/browse/${plan.planKey}-${buildNumber}`
        );
        await page.getByRole("link", { name: "Logs" }).click();
        console.log("Trying download");
        try {
          const downloadPromise = page.waitForEvent("download", {
            timeout: 3000,
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
