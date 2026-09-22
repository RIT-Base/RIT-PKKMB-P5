import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const QC_DIR = '/mnt/d/aigen/Arona/qc/rit-pkkmb';
fs.mkdirSync(QC_DIR, { recursive: true });

(async () => {
  console.log('[QA] Starting Playwright Test Loop for RIT PKKMB...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/kazuki/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Console Error] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(`[Page Error] ${err.message}`);
  });

  const baseUrl = 'http://127.0.0.1:4321';

  // 1. Desktop Viewport Test (1440x900)
  console.log('[QA] Testing Desktop Viewport (1440px)...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // Wait for preloader fade-out
  await page.waitForTimeout(1600);

  await page.screenshot({
    path: path.join(QC_DIR, 'desktop_1440px.png'),
    fullPage: false,
  });
  console.log('[QA] Desktop snapshot saved.');

  // 2. Mobile Viewport Test (440x956 - Native Figma Canvas)
  console.log('[QA] Testing Mobile Viewport (440px Native)...');
  await page.setViewportSize({ width: 440, height: 956 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  await page.screenshot({
    path: path.join(QC_DIR, 'mobile_440px_full.png'),
    fullPage: true,
  });
  console.log('[QA] Mobile 440px full page snapshot saved.');

  // 3. Mobile Viewport Test (390x844 - iPhone / Standard Mobile)
  console.log('[QA] Testing Mobile Viewport (390px)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(QC_DIR, 'mobile_390px_hero.png'),
    fullPage: false,
  });

  // 4. Interactive Test: Navigation Drawer
  console.log('[QA] Testing Navigation Drawer...');
  await page.click('#drawer-open-btn');
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(QC_DIR, 'interactive_drawer_open.png'),
    fullPage: false,
  });

  await page.click('#drawer-close-btn');
  await page.waitForTimeout(500);

  // 5. Interactive Test: Divisions Slider
  console.log('[QA] Testing Divisions Slider...');
  const initialDivCounter = await page.textContent('#div-counter');
  console.log(`[QA] Initial Division: ${initialDivCounter}`);

  await page.click('#div-next-btn');
  await page.waitForTimeout(300);
  const nextDivCounter = await page.textContent('#div-counter');
  const nextDivName = await page.textContent('#div-name');
  console.log(`[QA] Next Division: ${nextDivCounter} - ${nextDivName}`);

  await page.locator('#divisions').screenshot({
    path: path.join(QC_DIR, 'interactive_divisions_next.png'),
  });

  // 6. Interactive Test: Showcase Slider & Lightbox
  console.log('[QA] Testing Showcase Slider & Lightbox...');
  await page.click('#showcase-next-btn');
  await page.waitForTimeout(300);
  const nextShowcaseTitle = await page.textContent('#showcase-title-text');
  console.log(`[QA] Next Showcase Title: ${nextShowcaseTitle}`);

  // Open Lightbox
  await page.click('#showcase-zoom-btn');
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(QC_DIR, 'interactive_lightbox_open.png'),
    fullPage: false,
  });

  // Cycle Next Lightbox Image
  await page.click('#lightbox-next-btn');
  await page.waitForTimeout(300);
  const lightboxCounter = await page.textContent('#lightbox-counter');
  console.log(`[QA] Lightbox counter after next: ${lightboxCounter}`);

  // Close Lightbox
  await page.click('#lightbox-close-btn');
  await page.waitForTimeout(300);

  // 7. Interactive Test: FAQ RPG Dialogue Stepper
  console.log('[QA] Testing FAQ Dialogue Stepper...');
  const firstQBtn = page.locator('.faq-q-btn').first();
  await firstQBtn.click();
  await page.waitForTimeout(300);

  const beat1Text = await page.textContent('#faq-answer-text');
  console.log(`[QA] Beat 1 text: "${beat1Text}"`);

  await page.locator('#faq').screenshot({
    path: path.join(QC_DIR, 'interactive_faq_active_beat1.png'),
  });

  // Tap dialogue box to advance to Beat 2
  await page.click('#dialogue-box-container');
  await page.waitForTimeout(300);
  const beat2Text = await page.textContent('#faq-answer-text');
  console.log(`[QA] Beat 2 text: "${beat2Text}"`);

  // Tap dialogue box to advance to Beat 3
  await page.click('#dialogue-box-container');
  await page.waitForTimeout(300);
  const beat3Text = await page.textContent('#faq-answer-text');
  console.log(`[QA] Beat 3 text: "${beat3Text}"`);

  // Tap dialogue box to finish beats -> reset to idle
  await page.click('#dialogue-box-container');
  await page.waitForTimeout(300);
  const resetText = await page.textContent('#faq-answer-text');
  console.log(`[QA] Reset text: "${resetText}"`);

  await page.locator('#faq').screenshot({
    path: path.join(QC_DIR, 'interactive_faq_reset_idle.png'),
  });

  // 8. Horizontal Overflow Check
  console.log('[QA] Verifying Zero Horizontal Overflow...');
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  console.log(`[QA] scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
  const hasHorizontalScroll = scrollWidth > clientWidth;

  await browser.close();

  console.log('----------------------------------------------------');
  console.log(`[QA RESULT] Console Errors Count: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Console Errors Detected:', consoleErrors);
  }
  console.log(`[QA RESULT] Horizontal Overflow: ${hasHorizontalScroll ? 'FAILED (Overflow detected)' : 'PASSED (Zero Overflow)'}`);
  console.log('----------------------------------------------------');

  if (consoleErrors.length > 0 || hasHorizontalScroll) {
    process.exit(1);
  } else {
    console.log('[QA SUCCESS] ALL CHECKS PASSED 100%!');
    process.exit(0);
  }
})();
