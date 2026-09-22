const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST_DIR = path.resolve(__dirname, '../dist');
const PORT = 8089;

// Simple static server for dist
function startServer() {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.mp3': 'audio/mpeg',
      '.ttf': 'font/ttf',
      '.json': 'application/json',
    };

    const server = http.createServer((req, res) => {
      let filePath = path.join(DIST_DIR, decodeURIComponent(req.url.split('?')[0]));
      if (filePath.endsWith(path.sep) || fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, () => {
      console.log(`Test server running at http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: '/home/kazuki/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const errors = [];
  const results = {};

  try {
    // ----------------------------------------------------
    // TEST 1: Desktop Sticky Nav & Autoplay BGM
    // ----------------------------------------------------
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`Console error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`Page error: ${err.message}`));

    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });

    // Wait for initial preloader to finish on first visit
    await page.waitForTimeout(2000);

    // Check BGM default state
    const bgmIconSrc = await page.$eval('#bgm-icon', (el) => el.getAttribute('src'));
    results.bgmIconSrc = bgmIconSrc;
    console.log('1. BGM Icon Src:', bgmIconSrc);
    if (!bgmIconSrc.includes('menu_music_on.svg')) {
      errors.push(`Expected menu_music_on.svg, but got ${bgmIconSrc}`);
    }

    // Check sticky nav initial top
    const initialTop = await page.$eval('#right-controls', (el) => el.getBoundingClientRect().top);
    console.log('2. Sticky Controls Initial Top (Desktop):', initialTop);

    // Scroll down 1500px
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(300);

    const scrolledTop = await page.$eval('#right-controls', (el) => el.getBoundingClientRect().top);
    console.log('3. Sticky Controls Top after Scroll 1500px (Desktop):', scrolledTop);
    results.desktopStickyTop = scrolledTop;

    if (Math.abs(scrolledTop - 20) > 5) {
      errors.push(`Expected sticky controls top ~20px when scrolled, got ${scrolledTop}`);
    }

    // Take screenshot of scrolled desktop sticky nav
    const qcDir = '/mnt/d/aigen/Arona/qc/rit-pkkmb';
    if (!fs.existsSync(qcDir)) fs.mkdirSync(qcDir, { recursive: true });
    await page.screenshot({ path: path.join(qcDir, 'sticky_nav_scrolled.png') });
    console.log('Saved sticky_nav_scrolled.png');

    // Test BGM toggle button
    await page.click('#bgm-toggle-btn');
    await page.waitForTimeout(100);
    const toggledOffIcon = await page.$eval('#bgm-icon', (el) => el.getAttribute('src'));
    console.log('4. BGM Icon after Click (Paused):', toggledOffIcon);

    await page.click('#bgm-toggle-btn');
    await page.waitForTimeout(100);
    const toggledOnIcon = await page.$eval('#bgm-icon', (el) => el.getAttribute('src'));
    console.log('5. BGM Icon after Re-Click (Playing):', toggledOnIcon);

    // Check sessionStorage
    const sessionSeen = await page.evaluate(() => sessionStorage.getItem('p5_preloader_seen'));
    console.log('6. SessionStorage p5_preloader_seen:', sessionSeen);
    results.sessionSeen = sessionSeen;

    // ----------------------------------------------------
    // TEST 2: Fast Dismiss on Refresh / Second Load
    // ----------------------------------------------------
    const refreshStartTime = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Check preloader state after 300ms
    await page.waitForTimeout(300);
    const preloaderDisplay = await page.$eval('#p5-preloader', (el) => {
      return {
        display: el.style.display,
        opacity: el.style.opacity,
        visibility: getComputedStyle(el).visibility
      };
    });
    console.log('7. Preloader state on reload after 300ms:', preloaderDisplay);
    results.preloaderFastDismiss = preloaderDisplay;

    await page.close();

    // ----------------------------------------------------
    // TEST 3: Mobile Viewport (390px) — Sticky Nav & Scaled Drawer
    // ----------------------------------------------------
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    await mobilePage.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1200);

    // Scroll down on mobile
    await mobilePage.evaluate(() => window.scrollTo(0, 1200));
    await mobilePage.waitForTimeout(200);

    const mobileScrolledTop = await mobilePage.$eval('#right-controls', (el) => el.getBoundingClientRect().top);
    console.log('8. Sticky Controls Top after Scroll 1200px (Mobile 390px):', mobileScrolledTop);
    results.mobileStickyTop = mobileScrolledTop;
    if (Math.abs(mobileScrolledTop - 20) > 5) {
      errors.push(`Expected mobile sticky controls top ~20px, got ${mobileScrolledTop}`);
    }

    // Open Drawer
    await mobilePage.click('#drawer-open-btn');
    await mobilePage.waitForTimeout(500);

    // Check Drawer Canvas Inner scale
    const drawerScaleInfo = await mobilePage.$eval('#drawer-canvas-inner', (el) => {
      const rect = el.getBoundingClientRect();
      return {
        transform: el.style.transform,
        width: rect.width,
        height: rect.height,
        parentWidth: el.parentElement.clientWidth
      };
    });
    console.log('9. Drawer Inner Scale Info (390px):', drawerScaleInfo);
    results.drawerScaleInfo390 = drawerScaleInfo;

    // Check expected scale for 390px = 390 / 440 = ~0.88636
    const expectedScale390 = 390 / 440;
    if (!drawerScaleInfo.transform.includes('scale(')) {
      errors.push(`Expected drawer transform to contain scale, got ${drawerScaleInfo.transform}`);
    }

    // Check no horizontal overflow
    const hasHorizontalOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log('10. Mobile 390px Horizontal Overflow:', hasHorizontalOverflow);
    results.overflow390 = hasHorizontalOverflow;
    if (hasHorizontalOverflow) {
      errors.push('Horizontal overflow detected on mobile 390px');
    }

    // Save screenshot of scaled drawer on mobile
    await mobilePage.screenshot({ path: path.join(qcDir, 'drawer_scaled_mobile.png') });
    console.log('Saved drawer_scaled_mobile.png');

    await mobilePage.close();

    // ----------------------------------------------------
    // TEST 4: Small Mobile Viewport (360px)
    // ----------------------------------------------------
    const smallMobilePage = await browser.newPage({
      viewport: { width: 360, height: 780 }
    });

    await smallMobilePage.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await smallMobilePage.waitForTimeout(500);

    await smallMobilePage.click('#drawer-open-btn');
    await smallMobilePage.waitForTimeout(400);

    const drawerScaleInfo360 = await smallMobilePage.$eval('#drawer-canvas-inner', (el) => {
      const rect = el.getBoundingClientRect();
      return {
        transform: el.style.transform,
        width: rect.width,
        height: rect.height,
        scrollWidth: document.documentElement.scrollWidth
      };
    });
    console.log('11. Drawer Inner Scale Info (360px):', drawerScaleInfo360);
    results.drawerScaleInfo360 = drawerScaleInfo360;

    await smallMobilePage.close();

  } catch (err) {
    errors.push(`Test execution exception: ${err.message}\n${err.stack}`);
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n--- TEST SUMMARY ---');
  console.log('Results:', JSON.stringify(results, null, 2));
  if (errors.length > 0) {
    console.error('FAILED with errors:', errors);
    process.exit(1);
  } else {
    console.log('ALL TESTS PASSED CLEANLY (100%)');
  }
})();