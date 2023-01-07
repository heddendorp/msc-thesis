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
      console.log(`Checking runs for ${plan.planKey}`);
      await page.goto(`https://bamboobruegge.in.tum.de/browse/${plan.planKey}`);
      await page.locator(`[id="history\\:${plan.planKey}"]`).click();
      const firstRowInnerText = await page.getByRole("row").nth(1).innerText();
      const firstBuildNumber = firstRowInnerText.match(/#(\d+)/)?.[1] ?? "";
      if (firstBuildNumber <= plan.runningGoal) {
        const runButton = await page.getByRole("button", { name: "Run " });
        const buttonIsDisabled = await runButton.getAttribute("aria-disabled");
        if (buttonIsDisabled === null) {
          console.log(`Running ${plan.planKey}`);
          await runButton.click();
          await page.getByRole("link", { name: "Run branch" }).click();
        } else {
          console.log("Run button is disabled");
        }
      }
    }
  }
  browser.close();
}

void run();
