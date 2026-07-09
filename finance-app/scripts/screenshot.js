const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
  await page.goto(process.argv[2], { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: process.argv[3], fullPage: true });
  await browser.close();
})();
