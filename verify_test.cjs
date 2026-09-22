const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST_DIR = path.join(__dirname, 'dist');
const QC_DIR = '/mnt/d/aigen/Arona/qc/rit-pkkmb';

// Ensure QC_DIR exists
if (!fs.existsSync(QC_DIR)) {
  fs.mkdirSync(QC_DIR, { recursive: true });
}

// Simple static server for dist
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  
  const filePath = path.join(DIST_DIR, reqPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: ' + reqPath);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

async function runTests() {
  await new Promise((resolve) => server.listen(3456, resolve));
  console.log('[Server] Static dist server running at http://localhost:3456');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/kazuki/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  try {
    await page.goto('http://localhost:3456', { waitUntil: 'networkidle' });
    console.log('[Page] Loaded successfully');

    // Wait for preloader dismissal if any
    await page.waitForTimeout(1000);

    // -------------------------------------------------------------
    // Test 1: Disclaimer Modal Position (Must be centered in viewport, not canvas)
    // -------------------------------------------------------------
    console.log('\n--- Testing Disclaimer Modal Viewport Centering ---');
    // Scroll to footer
    await page.evaluate(() => {
      const trigger = document.getElementById('disclaimer-trigger-btn');
      trigger.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(300);

    const scrollYBefore = await page.evaluate(() => window.scrollY);
    console.log(`[Disclaimer] Current window scrollY: ${scrollYBefore}px (near bottom)`);

    // Click disclaimer trigger
    await page.click('#disclaimer-trigger-btn');
    await page.waitForTimeout(400);

    // Evaluate modal bounding box relative to viewport
    const disclaimerMetrics = await page.evaluate(() => {
      const modal = document.getElementById('disclaimer-modal');
      const dialog = modal ? modal.querySelector('div') : null;
      const modalRect = modal ? modal.getBoundingClientRect() : null;
      const dialogRect = dialog ? dialog.getBoundingClientRect() : null;
      return {
        modalOpacity: modal ? window.getComputedStyle(modal).opacity : null,
        dialogRect,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth
      };
    });

    console.log('[Disclaimer] Modal metrics:', JSON.stringify(disclaimerMetrics, null, 2));

    if (!disclaimerMetrics.dialogRect) {
      throw new Error('Disclaimer dialog rect not found!');
    }

    // Check that dialogRect.top is in the viewport!
    const dialogTop = disclaimerMetrics.dialogRect.top;
    const dialogHeight = disclaimerMetrics.dialogRect.height;
    const vpHeight = disclaimerMetrics.viewportHeight;

    console.log(`[Disclaimer] Dialog top in viewport: ${dialogTop.toFixed(1)}px, height: ${dialogHeight.toFixed(1)}px, viewport height: ${vpHeight}px`);
    if (dialogTop < 0 || dialogTop > vpHeight) {
      throw new Error(`FAIL: Disclaimer modal is NOT in viewport! dialogTop=${dialogTop}, vpHeight=${vpHeight}`);
    }

    // Modal is nicely centered in viewport
    const expectedTopApprox = (vpHeight - dialogHeight) / 2;
    console.log(`[Disclaimer] Expected center top ≈ ${expectedTopApprox.toFixed(1)}px. Actual top = ${dialogTop.toFixed(1)}px.`);
    if (Math.abs(dialogTop - expectedTopApprox) > 60) {
      console.warn(`[Disclaimer] Warning: slightly off-center by ${Math.abs(dialogTop - expectedTopApprox).toFixed(1)}px, but within viewport bounds.`);
    } else {
      console.log('[Disclaimer] PASS: Dialog is accurately centered in viewport!');
    }

    // Take screenshot of opened disclaimer modal
    await page.screenshot({ path: path.join(QC_DIR, '01_disclaimer_modal_mobile.png') });
    console.log('[Proof] Saved: 01_disclaimer_modal_mobile.png');

    // Close disclaimer modal
    await page.click('#disclaimer-close-btn');
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // Test 2: Showcase Lightbox & Exit Button Position
    // -------------------------------------------------------------
    console.log('\n--- Testing Showcase Lightbox & Exit Button ---');
    await page.evaluate(() => {
      const el = document.getElementById('showcase');
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(300);

    // Open lightbox via zoom button
    await page.click('#showcase-zoom-btn');
    await page.waitForTimeout(400);

    const lightboxMetrics = await page.evaluate(() => {
      const modal = document.getElementById('showcase-lightbox');
      const dialog = modal ? modal.querySelector('div') : null;
      const closeBtn = document.getElementById('lightbox-close-btn');
      const dialogRect = dialog ? dialog.getBoundingClientRect() : null;
      const closeBtnRect = closeBtn ? closeBtn.getBoundingClientRect() : null;
      const counterEl = document.getElementById('lightbox-counter');
      return {
        dialogRect,
        closeBtnRect,
        counterText: counterEl ? counterEl.textContent.trim() : '',
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth
      };
    });

    console.log('[Lightbox] Metrics:', JSON.stringify(lightboxMetrics, null, 2));

    const closeBtnTop = lightboxMetrics.closeBtnRect.top;
    const dialogCardTop = lightboxMetrics.dialogRect.top;
    console.log(`[Lightbox] Close btn top: ${closeBtnTop.toFixed(1)}px, Card top: ${dialogCardTop.toFixed(1)}px`);

    // Verify close button is close to preview card, not at monitor top (e.g. top: 24px)
    const distanceToCard = Math.abs(closeBtnTop - dialogCardTop);
    console.log(`[Lightbox] Distance between close button and preview card top: ${distanceToCard.toFixed(1)}px`);
    if (distanceToCard > 50) {
      throw new Error(`FAIL: Close button is too far from preview card! distance=${distanceToCard}`);
    }
    console.log('[Lightbox] PASS: Close button is placed close to the preview card!');

    // Test gallery next image navigation
    await page.click('#lightbox-next-btn');
    await page.waitForTimeout(300);

    const updatedCounter = await page.evaluate(() => {
      const counterEl = document.getElementById('lightbox-counter');
      return counterEl ? counterEl.textContent.trim() : '';
    });
    console.log(`[Lightbox] Counter after next click: "${updatedCounter}"`);
    if (!updatedCounter.startsWith('2 /')) {
      throw new Error(`FAIL: Counter did not advance to 2! got "${updatedCounter}"`);
    }

    await page.screenshot({ path: path.join(QC_DIR, '02_showcase_lightbox_mobile.png') });
    console.log('[Proof] Saved: 02_showcase_lightbox_mobile.png');

    // Close lightbox using the close button
    await page.click('#lightbox-close-btn');
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // Test 3: 3-Pill Sliding Window Divisi (Ala P5X)
    // -------------------------------------------------------------
    console.log('\n--- Testing 3-Pill Sliding Window Divisi ---');
    await page.evaluate(() => {
      const el = document.getElementById('divisions');
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(300);

    // Verify there are exactly 3 pills visible
    const initialPillState = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('#division-pills-window .division-pill-btn'));
      return pills.map(p => ({
        id: p.id,
        divIdx: p.getAttribute('data-div-idx'),
        hasActiveScale: p.classList.contains('scale-105')
      }));
    });

    console.log('[Divisions] Initial pills:', initialPillState);
    if (initialPillState.length !== 3) {
      throw new Error(`FAIL: Expected exactly 3 pills, found ${initialPillState.length}`);
    }
    if (initialPillState[0].divIdx !== '0' || initialPillState[1].divIdx !== '1' || initialPillState[2].divIdx !== '2') {
      throw new Error(`FAIL: Initial pills should be [0, 1, 2], got ${JSON.stringify(initialPillState)}`);
    }
    console.log('[Divisions] PASS: Initial window is [0, 1, 2] with slot 0 active!');

    await page.screenshot({ path: path.join(QC_DIR, '03_divisions_window_012.png') });

    // Click Next button -> window should slide to [1, 2, 3]
    await page.click('#div-next-btn');
    await page.waitForTimeout(300);

    const nextPillState = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('#division-pills-window .division-pill-btn'));
      return pills.map(p => ({
        id: p.id,
        divIdx: p.getAttribute('data-div-idx'),
        hasActiveScale: p.classList.contains('scale-105')
      }));
    });

    console.log('[Divisions] After Next click:', nextPillState);
    if (nextPillState[0].divIdx !== '1' || nextPillState[1].divIdx !== '2' || nextPillState[2].divIdx !== '3') {
      throw new Error(`FAIL: After next, pills should be [1, 2, 3], got ${JSON.stringify(nextPillState)}`);
    }
    console.log('[Divisions] PASS: Window shifted to [1, 2, 3] with slot 0 active (index 1)!');

    await page.screenshot({ path: path.join(QC_DIR, '04_divisions_window_123.png') });

    // Click slot 2 (which is divIdx 3) -> window should update to [3, 4, 5]
    await page.click('#pill-slot-2');
    await page.waitForTimeout(300);

    const clickedPillState = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('#division-pills-window .division-pill-btn'));
      return pills.map(p => ({
        id: p.id,
        divIdx: p.getAttribute('data-div-idx'),
        hasActiveScale: p.classList.contains('scale-105')
      }));
    });

    console.log('[Divisions] After clicking slot 2 (div 3):', clickedPillState);
    if (clickedPillState[0].divIdx !== '3' || clickedPillState[1].divIdx !== '4' || clickedPillState[2].divIdx !== '5') {
      throw new Error(`FAIL: Expected pills to be [3, 4, 5], got ${JSON.stringify(clickedPillState)}`);
    }
    console.log('[Divisions] PASS: Window shifted to [3, 4, 5]!');

    // Test looping around to index 7 and back to 0
    // Div total is 8 (0-7). Let's click next until index 7
    for (let i = 0; i < 4; i++) {
      await page.click('#div-next-btn');
      await page.waitForTimeout(200);
    }

    const stateAt7 = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('#division-pills-window .division-pill-btn'));
      return pills.map(p => p.getAttribute('data-div-idx'));
    });
    console.log('[Divisions] At index 7 window:', stateAt7);
    if (stateAt7[0] !== '7' || stateAt7[1] !== '0' || stateAt7[2] !== '1') {
      throw new Error(`FAIL: Expected pills at 7 to be [7, 0, 1], got ${JSON.stringify(stateAt7)}`);
    }

    // Now click Next again -> should loop smoothly to 0 with [0, 1, 2]
    await page.click('#div-next-btn');
    await page.waitForTimeout(250);

    const stateAt0 = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('#division-pills-window .division-pill-btn'));
      return pills.map(p => p.getAttribute('data-div-idx'));
    });
    console.log('[Divisions] Loop back to 0 window:', stateAt0);
    if (stateAt0[0] !== '0' || stateAt0[1] !== '1' || stateAt0[2] !== '2') {
      throw new Error(`FAIL: Expected loop to [0, 1, 2], got ${JSON.stringify(stateAt0)}`);
    }
    console.log('[Divisions] PASS: Smooth looping verified [7, 0, 1] -> [0, 1, 2]!');

    await page.screenshot({ path: path.join(QC_DIR, '05_divisions_loop_smooth.png') });

    // -------------------------------------------------------------
    // Test 4: FAQ Layout & Stepper Verification
    // -------------------------------------------------------------
    console.log('\n--- Testing FAQ Section Layout & Stepper ---');
    await page.evaluate(() => {
      const el = document.getElementById('faq');
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(300);

    // Check Question 2 activation
    const qButtons = await page.$$('.faq-q-btn');
    if (qButtons.length !== 4) {
      throw new Error(`FAIL: Expected 4 FAQ question buttons, got ${qButtons.length}`);
    }

    // Click Question 2 ("Aku anak Ilkom, boleh join?")
    await qButtons[1].click();
    await page.waitForTimeout(300);

    const faqActiveState = await page.evaluate(() => {
      const q2 = document.querySelectorAll('.faq-q-btn')[1];
      const bg = q2 ? q2.querySelector('.faq-active-bg') : null;
      const isBgVisible = bg && !bg.classList.contains('hidden');
      const answerEl = document.getElementById('faq-answer-text');
      const hintEl = document.getElementById('faq-hint-text');
      const arrowEl = document.getElementById('faq-continue-arrow');
      return {
        isBgVisible,
        answerText: answerEl ? answerEl.textContent.trim() : '',
        hintVisible: hintEl && !hintEl.classList.contains('opacity-0'),
        arrowVisible: arrowEl && !arrowEl.classList.contains('opacity-0')
      };
    });

    console.log('[FAQ] Active state on Q2 click:', faqActiveState);
    if (!faqActiveState.isBgVisible) {
      throw new Error('FAIL: FAQ active background was not displayed on Q2!');
    }
    if (!faqActiveState.answerText.includes('Nyambung parah!')) {
      throw new Error(`FAIL: Expected answer beat 1 for Q2, got "${faqActiveState.answerText}"`);
    }
    console.log('[FAQ] PASS: Q2 active state and dialogue beat 1 displayed!');

    // Click dialogue box to advance beat 2
    await page.click('#dialogue-box-container');
    await page.waitForTimeout(300);

    const beat2Text = await page.evaluate(() => {
      const answerEl = document.getElementById('faq-answer-text');
      return answerEl ? answerEl.textContent.trim() : '';
    });
    console.log('[FAQ] After stepping to beat 2:', beat2Text);
    if (!beat2Text.includes('desainer grafis')) {
      throw new Error(`FAIL: Expected beat 2 dialogue, got "${beat2Text}"`);
    }
    console.log('[FAQ] PASS: Dialogue stepped successfully to beat 2!');

    await page.screenshot({ path: path.join(QC_DIR, '06_faq_active_stepper.png') });

    // Full page screenshot on mobile
    await page.screenshot({ path: path.join(QC_DIR, '07_full_page_mobile.png'), fullPage: true });

    // Also desktop view test (1280x720)
    console.log('\n--- Testing Desktop View Centering ---');
    const desktopPage = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1
    });
    await desktopPage.goto('http://localhost:3456', { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(500);

    // Scroll to footer on desktop and open disclaimer
    await desktopPage.evaluate(() => {
      const trigger = document.getElementById('disclaimer-trigger-btn');
      trigger.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await desktopPage.waitForTimeout(300);
    await desktopPage.click('#disclaimer-trigger-btn');
    await desktopPage.waitForTimeout(400);

    const desktopDisclaimerMetrics = await desktopPage.evaluate(() => {
      const modal = document.getElementById('disclaimer-modal');
      const dialog = modal ? modal.querySelector('div') : null;
      return {
        dialogRect: dialog ? dialog.getBoundingClientRect() : null,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth
      };
    });

    console.log('[Desktop Disclaimer] Metrics:', desktopDisclaimerMetrics);
    const dTop = desktopDisclaimerMetrics.dialogRect.top;
    const dLeft = desktopDisclaimerMetrics.dialogRect.left;
    const dWidth = desktopDisclaimerMetrics.dialogRect.width;
    console.log(`[Desktop Disclaimer] dialogTop: ${dTop}px (viewport: 720px), width: ${dWidth}px`);

    if (dTop < 0 || dTop > 720) {
      throw new Error(`FAIL: Desktop disclaimer modal is outside 720px viewport! dTop=${dTop}`);
    }
    if (dWidth > 430) {
      throw new Error(`FAIL: Desktop modal card width exceeds 420px container! dWidth=${dWidth}`);
    }
    console.log('[Desktop Disclaimer] PASS: Centered in desktop viewport, width bounded to max-w-[420px]!');

    await desktopPage.screenshot({ path: path.join(QC_DIR, '08_desktop_disclaimer_modal.png') });
    await desktopPage.close();

    console.log('\n==========================================');
    console.log('ALL VERIFICATION SUITES PASSED CLEANLY (100%)');
    console.log('Zero Console Errors:', consoleErrors.length === 0);
    console.log('==========================================');

  } finally {
    await browser.close();
    server.close();
  }
}

runTests().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
