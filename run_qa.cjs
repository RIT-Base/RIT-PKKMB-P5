const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple static server for dist/
const distDir = path.join(__dirname, 'dist');
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/') reqUrl = '/index.html';
  const filePath = path.join(distDir, reqUrl);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + reqUrl);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

const PORT = 4422;
server.listen(PORT, async () => {
  console.log(`Test server running at http://localhost:${PORT}`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/kazuki/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const qcDir = '/mnt/d/aigen/Arona/qc/rit-pkkmb';
  if (!fs.existsSync(qcDir)) {
    fs.mkdirSync(qcDir, { recursive: true });
  }

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  try {
    console.log('Navigating to page...');
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });

    // Wait for preloader to finish disappearing
    await page.waitForTimeout(2000);

    // 1. Verify Video Autoplay
    const videoPlaying = await page.evaluate(() => {
      const v = document.getElementById('bg-star-video');
      return v && !v.paused && v.autoplay && v.loop && v.muted;
    });
    console.log('Background video autoplaying & looping:', videoPlaying);

    // 2. Verify Zero Red Glow in computed styles
    const glowElements = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const offending = [];
      all.forEach((el) => {
        const style = window.getComputedStyle(el);
        const filter = style.filter || '';
        const shadow = style.boxShadow || '';
        const textShadow = style.textShadow || '';
        if (
          filter.includes('rgba(230') ||
          shadow.includes('rgba(230') ||
          textShadow.includes('rgba(230')
        ) {
          offending.push({ tag: el.tagName, class: el.className });
        }
      });
      return offending;
    });
    console.log('Offending red glow elements count:', glowElements.length);

    // Desktop snapshot
    await page.screenshot({ path: path.join(qcDir, 'desktop_1440px.png'), fullPage: false });
    console.log('Saved desktop_1440px.png');

    // 3. Test Drawer slide from top to bottom
    console.log('Testing Drawer slide-down...');
    await page.click('#drawer-open-btn');
    await page.waitForTimeout(400);

    const drawerOpenState = await page.evaluate(() => {
      const drawer = document.getElementById('drawer-nav');
      return {
        hasTranslateY0: drawer.classList.contains('translate-y-0'),
        lacksTranslateYFull: !drawer.classList.contains('-translate-y-full'),
        isInteractive: !drawer.classList.contains('pointer-events-none'),
        bgStyle: window.getComputedStyle(drawer).backgroundColor
      };
    });
    console.log('Drawer Open State:', drawerOpenState);
    await page.screenshot({ path: path.join(qcDir, 'interactive_drawer_open.png') });

    // Close Drawer
    await page.click('#drawer-close-btn');
    await page.waitForTimeout(400);

    // 4. Test Division Pills & Navigation
    console.log('Testing Division Pills...');
    const pillButtonsCount = await page.evaluate(() => {
      return document.querySelectorAll('.division-pill-btn').length;
    });
    console.log('Division pill buttons count:', pillButtonsCount);

    // Click next division
    await page.click('#div-next-btn');
    await page.waitForTimeout(300);
    const div2Name = await page.evaluate(() => {
      const nameImg = document.getElementById('div-name-img');
      const tagImg = document.getElementById('div-tag-img');
      return { nameSrc: nameImg ? nameImg.src : null, tagSrc: tagImg ? tagImg.src : null };
    });
    console.log('Division 2 images:', div2Name);
    await page.screenshot({ path: path.join(qcDir, 'interactive_divisions_next.png') });

    // 5. Test Showcase: Open button visibility on empty vs non-empty URL
    console.log('Testing Showcase URL button & thumbnail overlay...');
    const p1OpenBtn = await page.evaluate(() => {
      const btn = document.getElementById('showcase-open-link');
      return btn && !btn.classList.contains('hidden') && btn.href.includes('kolase.fkazu.com');
    });
    console.log('Project 1 has visible open button with link:', p1OpenBtn);

    // Switch to Project 3 (which has url: "")
    await page.click('#showcase-next-btn');
    await page.waitForTimeout(200);
    await page.click('#showcase-next-btn');
    await page.waitForTimeout(200);

    const p3OpenBtn = await page.evaluate(() => {
      const btn = document.getElementById('showcase-open-link');
      return btn && btn.classList.contains('hidden');
    });
    console.log('Project 3 (empty URL) hides open button:', p3OpenBtn);

    // Test Showcase Lightbox
    console.log('Testing Showcase Zoom Lightbox...');
    await page.click('#showcase-zoom-btn');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(qcDir, 'interactive_lightbox_open.png') });
    await page.click('#lightbox-close-btn');
    await page.waitForTimeout(300);

    // 6. Test FAQ Dialogue Stepper
    console.log('Testing FAQ Dialogue Stepper...');
    const firstFaqBtn = await page.$('.faq-q-btn');
    if (firstFaqBtn) {
      await firstFaqBtn.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(qcDir, 'interactive_faq_active_beat1.png') });

      // Click dialogue box to advance
      const dialogueBox = await page.$('#dialogue-box-container');
      if (dialogueBox) {
        await dialogueBox.click();
        await page.waitForTimeout(200);
        await dialogueBox.click();
        await page.waitForTimeout(200);
        await dialogueBox.click();
        await page.waitForTimeout(200);
      }
      await page.screenshot({ path: path.join(qcDir, 'interactive_faq_reset_idle.png') });
    }

    // 7. Mobile Viewport Snapshots
    await page.setViewportSize({ width: 440, height: 900 });
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(qcDir, 'mobile_440px_full.png'), fullPage: true });
    console.log('Saved mobile_440px_full.png');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(qcDir, 'mobile_390px_hero.png'), fullPage: false });
    console.log('Saved mobile_390px_hero.png');

    console.log('\n=========================================');
    console.log('CONSOLE ERRORS COUNT:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log('Console Errors:', consoleErrors);
    }
    console.log('NETWORK ERRORS COUNT:', networkErrors.length);
    if (networkErrors.length > 0) {
      console.log('Network Errors:', networkErrors);
    }
    console.log('=========================================\n');

  } catch (err) {
    console.error('QA Test execution failed:', err);
  } finally {
    await browser.close();
    server.close();
  }
});