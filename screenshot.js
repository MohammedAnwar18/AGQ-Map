const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 800 });
  
  console.log('Navigating...');
  await page.goto('https://palnovaa.com/p/khv', { waitUntil: 'networkidle2' });
  
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'screenshot.png' });
  
  console.log('Done.');
  await browser.close();
})();
