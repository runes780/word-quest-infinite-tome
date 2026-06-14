import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, 'screenshots');

const localBrowserCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

const shots = [
  {
    name: 'wordquest-current-desktop-hero.png',
    url: 'http://localhost:3000/project#hero',
    viewport: desktop,
    waitMs: 2500,
  },
  {
    name: 'wordquest-current-mobile-hero.png',
    url: 'http://localhost:3000/project#hero',
    viewport: mobile,
    waitMs: 2500,
  },
  {
    name: 'linear-desktop-hero.png',
    url: 'https://linear.app/',
    viewport: desktop,
    waitMs: 5000,
  },
  {
    name: 'linear-product-rhythm.png',
    url: 'https://linear.app/',
    viewport: desktop,
    scrollY: 1100,
    waitMs: 3500,
  },
  {
    name: 'cursor-desktop-hero.png',
    url: 'https://cursor.com/',
    viewport: desktop,
    waitMs: 5000,
  },
  {
    name: 'raycast-dark-hero.png',
    url: 'https://www.raycast.com/',
    viewport: desktop,
    waitMs: 5000,
  },
  {
    name: 'framer-desktop-hero.png',
    url: 'https://www.framer.com/',
    viewport: desktop,
    waitMs: 5000,
  },
  {
    name: 'apple-ipad-product-reveal.png',
    url: 'https://www.apple.com/ipad-pro/',
    viewport: desktop,
    gotoWaitUntil: 'commit',
    timeoutMs: 90_000,
    waitMs: 5000,
  },
  {
    name: 'anthropic-editorial-hero.png',
    url: 'https://www.anthropic.com/',
    viewport: desktop,
    waitMs: 5000,
  },
  {
    name: 'codedex-adventure-hero.png',
    url: 'https://www.codedex.io/',
    viewport: desktop,
    waitMs: 5000,
  },
  {
    name: 'vercel-tech-hero.png',
    url: 'https://vercel.com/',
    viewport: desktop,
    waitMs: 5000,
  },
];

async function captureShot(page, shot) {
  await page.setViewportSize(shot.viewport);
  await page.goto(shot.url, {
    waitUntil: shot.gotoWaitUntil ?? 'domcontentloaded',
    timeout: shot.timeoutMs ?? 45_000,
  });
  await page.waitForTimeout(shot.waitMs ?? 2500);
  await dismissCookieBanners(page);

  if (shot.scrollY) {
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: 'instant' }), shot.scrollY);
    await page.waitForTimeout(shot.waitAfterScrollMs ?? 1500);
    await dismissCookieBanners(page);
  }

  const target = path.join(outputDir, shot.name);
  await page.screenshot({ path: target, fullPage: false });
  return target;
}

async function dismissCookieBanners(page) {
  const buttonLabels = [
    'Accept',
    'Accept all',
    'Accept All',
    'Allow all',
    'Agree',
    'Got it',
  ];

  for (const label of buttonLabels) {
    try {
      const button = page.getByRole('button', { name: label });
      const count = await button.count();
      if (count === 1 && await button.isVisible()) {
        await button.click({ timeout: 1500 });
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // Try the next common label.
    }
  }
}

await fs.mkdir(outputDir, { recursive: true });

let launchOptions = { headless: true };
for (const executablePath of localBrowserCandidates) {
  try {
    await fs.access(executablePath);
    launchOptions = { ...launchOptions, executablePath };
    break;
  } catch {
    // Try the next local browser candidate.
  }
}

const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({
  deviceScaleFactor: 1,
  extraHTTPHeaders: {
    'Accept-Language': 'en-US,en;q=0.9',
  },
  locale: 'en-US',
  reducedMotion: 'reduce',
});
const page = await context.newPage();

const results = [];
for (const shot of shots) {
  try {
    const target = await captureShot(page, shot);
    results.push({ name: shot.name, ok: true, target });
    console.log(`ok ${shot.name}`);
  } catch (error) {
    results.push({ name: shot.name, ok: false, error: error instanceof Error ? error.message : String(error) });
    console.log(`failed ${shot.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

await browser.close();

const manifest = {
  generatedAt: new Date().toISOString(),
  screenshots: results,
};

await fs.writeFile(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);
