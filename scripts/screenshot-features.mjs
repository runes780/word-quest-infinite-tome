import { chromium } from 'playwright';
import { join } from 'path';

const PROJECT_ROOT = '/Users/xuqining/Documents/code/Claude-Code/Word Quest: Infinite Tome';
const OUTPUT_DIR = join(PROJECT_ROOT, 'public', 'wordquest');

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Handle settings modal - fill in a fake API key and save
  const apiKeyInput = page.locator('input[placeholder*="sk-"], input[type="password"]').first();
  if (await apiKeyInput.isVisible().catch(() => false)) {
    console.log('Filling API key...');
    await apiKeyInput.fill('sk-fake-api-key-for-screenshots-only');
    
    // Click Save button
    const saveButton = page.locator('button:has-text("Save")').first();
    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(1000);
    }
  }
  
  // Close any remaining modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // --- Screenshot 1: Main input screen ---
  console.log('Taking main screen screenshot...');
  await page.screenshot({
    path: join(OUTPUT_DIR, 'input-section-screenshot.png'),
    fullPage: false,
  });
  console.log('Saved: input-section-screenshot.png');

  // --- Screenshot 2: SRS Dashboard ---
  console.log('Taking SRS Dashboard screenshot...');
  const srsButton = page.locator('button:has-text("SRS Review")');
  if (await srsButton.isVisible().catch(() => false)) {
    await srsButton.click({ force: true });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: join(OUTPUT_DIR, 'srs-dashboard-screenshot.png'),
      fullPage: false,
    });
    console.log('Saved: srs-dashboard-screenshot.png');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // --- Screenshot 3: Parent Dashboard (Guardian) ---
  console.log('Taking Parent Dashboard screenshot...');
  const guardianButton = page.locator('button[aria-label*="Dashboard"], button[aria-label*="dashboard"]').first();
  if (await guardianButton.isVisible().catch(() => false)) {
    await guardianButton.click({ force: true });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: join(OUTPUT_DIR, 'mastery-tracking-screenshot.png'),
      fullPage: false,
    });
    console.log('Saved: mastery-tracking-screenshot.png');
  }

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
