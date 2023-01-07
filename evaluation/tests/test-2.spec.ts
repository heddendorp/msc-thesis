import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://bamboobruegge.in.tum.de/userlogin!doDefault.action?os_destination=%2Fstart.action');
  await page.getByLabel('Username').click();
  await page.getByLabel('Username').fill('ga63gix');
  await page.getByLabel('Password').click();
  await page.getByLabel('Password').fill('XHW.hqx6eta7duc6npe');
  await page.getByLabel('Remember my login on this computer').check();
  await page.locator('#loginForm_save').click();
  await page.goto('https://bamboobruegge.in.tum.de/browse/ARTEMIS-AETG1179');
  await page.locator('[id="history\\:ARTEMIS-AETG1179"]').click();
  await page.getByRole('cell', { name: ' #4' }).getByRole('link', { name: ' #4' }).click();
  await page.getByRole('link', { name: 'Logs' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download' }).click();
  const download = await downloadPromise;
});