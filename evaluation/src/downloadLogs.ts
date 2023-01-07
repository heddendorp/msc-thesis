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
    for (const plan of branch.plans) {
      console.log(`Downloading logs for ${plan.planKey}`);
      await page.goto(`https://bamboobruegge.in.tum.de/browse/${plan.planKey}`);
      await page.locator(`[id="history\\:${plan.planKey}"]`).click();
      const rows = await page.getByRole("row").all();
      for (const row of rows) {
        const innerText = await row.innerText();
        if (!innerText.trim().startsWith("#")) continue;
        const buildNumber = innerText.match(/#(\d+)/)?.[1] ?? "";
        console.log(`Checking build #${buildNumber}`);
        const logExists = jetpack.exists(
          `./data/logs/${plan.planKey}/${buildNumber}.txt`
        );
        if (logExists) continue;
        await row.getByText(`#${buildNumber}`).click();
        await page.getByRole("link", { name: "Logs" }).click();
        const downloadLinkCount = await page
          .getByRole("link", { name: "Download" })
          .count();
        if (downloadLinkCount === 0) {
          console.log("No download link found");
          continue;
        }
        console.log("Download link found");
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("link", { name: "Download" }).click();
        const download = await downloadPromise;
        await download.saveAs(`./data/logs/${plan.planKey}/${buildNumber}.txt`);
        console.log(
          `Downloaded logs for ${plan.planKey} #${buildNumber} to ./data/logs/${plan.planKey}/${buildNumber}.txt`
        );
      }
    }
  }
  browser.close();
}

void run();
