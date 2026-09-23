# BRIEF REVISI 6: FIRST-TOUCH AUTOPLAY BGM & ASYNC ASSET BACKGROUND PRELOADER
Dari: Arona (Lead Arsitek & QA) | Untuk: Plana (Full-Stack Executor) | Tanggal: 2026-09-23

## 1. Goal
Memperbaiki 2 kendala UX pada website promosi RIT PKKMB 2026:
1. **Autoplay BGM pada Sentuhan Pertama (First-Touch Autoplay):** Memperbaiki deadlock state audio di mana BGM tertahan dan listener terhapus sebelum audio berbunyi. BGM otomatis langsung memutar audio pada sentuhan/interaksi pertama pengguna di halaman utama setelah preloader, serta sinkronisasi state toggle BGM yang presisi.
2. **Background Async Asset Preloader:** Mengeliminasi lag/blank saat klik `Prev`, `Next`, atau `Role Change` pada Divisi & Showcase dengan memuat seluruh aset SVG varian (termasuk SVG 1.6MB) dan gambar galeri secara asinkron di balik layar (background prefetch) segera setelah layar terbuka.

⚠️ **STRICT CONSTRAINT DARI SENSEI LYSANDER:**
- DILARANG merubah koordinat absolut, ukuran, token desain, atau tata letak visual Figma yang sudah presisi!
- DILARANG auto-commit git (Sensei melakukan commit manual).
- Tanpa prompt "Tap to Enter" di preloader — preloader tetap auto-dismiss secara natural, lalu BGM aktif pada sentuhan pertama di halaman utama.

---

## 2. Required Skills (Load via skill_view)
- [ ] `frontend-taste-and-design`
- [ ] `web-design-guidelines`
- [ ] `modern-web-motion`
- [ ] `playwright-iterative-qa`

---

## 3. Konteks & Scope
- Path Repositori: `/mnt/d/github/RIT-PKKMB-P5/`
- File Target:
  - `src/components/Header.astro` (Logika BGM state machine & first-touch interaction fallback)
  - `src/components/Preloader.astro` (Dispatch event `p5:preloader-dismissed` saat preloader selesai dismiss)
  - `src/components/Divisions.astro` (Hapus `loading="lazy"` pada `#div-img`, pasang background asset pre-fetcher async)
  - `src/components/Showcase.astro` (Hapus `loading="lazy"` pada thumbnail dinamis & modal lightbox main image)
- QC Output Sandbox: `/mnt/d/aigen/Arona/qc/rit-pkkmb/`

---

## 4. Rincian Spesifikasi Teknis

### A. First-Touch BGM Autoplay (`src/components/Header.astro` & `src/components/Preloader.astro`)
1. **Event Dispatch dari Preloader:**
   - Di `src/components/Preloader.astro`, saat fungsi `dismissPreloader()` selesai (atau saat preloader disembunyikan `p.style.display = 'none'`), tambahkan:
     ```ts
     window.dispatchEvent(new CustomEvent('p5:preloader-dismissed'));
     ```
2. **State Machine BGM & Fix Deadlock (`src/components/Header.astro`):**
   - Status awal `let isPlaying = false;` dan `let userPaused = false;`.
   - Ikon awal tetap `src="/assets/svg/menu_music_on.svg"` (menandakan BGM siap berputar).
   - Fungsi `playAudio()`:
     ```ts
     const playAudio = () => {
       if (userPaused || isPlaying) return;
       audio.play().then(() => {
         icon.src = '/assets/svg/menu_music_on.svg';
         isPlaying = true;
         cleanupGestureListeners();
       }).catch((err) => {
         // Browser memblokir unmuted autoplay -> status TETAP isPlaying = false
         isPlaying = false;
         // Biarkan gesture listeners tetap aktif!
       });
     };
     ```
   - **First-Touch Listeners:**
     - Pasang listener interaksi pada `window`: `['click', 'touchstart', 'pointerdown', 'keydown', 'wheel', 'scroll']`.
     - Fungsi `cleanupGestureListeners()` hanya menghapus listener tersebut jika `isPlaying === true` (audio benar-benar sudah berputar).
     - Dengarkan juga event `p5:preloader-dismissed` untuk mencoba `playAudio()` jika browser mengizinkan unmuted autoplay secara langsung.
   - **Toggle Button Sync:**
     - Klik pada `bgm-toggle-btn`:
       - Jika audio sedang berputar (`isPlaying === true`): pause audio, set `userPaused = true; isPlaying = false; icon.src = '/assets/images/nav/menu_music_off.png';`.
       - Jika audio sedang paused: set `userPaused = false; playAudio();`.

### B. Background Async Asset Pre-caching (`src/components/Divisions.astro` & `src/components/Showcase.astro`)
1. **Hapus `loading="lazy"` pada Dynamic Target:**
   - Di `Divisions.astro`: ubah `<img id="div-img" ... loading="lazy" decoding="async" />` menjadi `<img id="div-img" ... decoding="async" />` (tanpa lazy).
   - Di `Showcase.astro`: ubah `<img id="showcase-thumb-img" ... loading="lazy" />` dan `<img id="lightbox-main-img" ... loading="lazy" />` menjadi `decoding="async"` tanpa lazy.
2. **Async Background Pre-fetcher Queue:**
   - Jalankan pre-fetching seluruh gambar divisi dan galeri setelah preloader dismiss (mendengarkan event `p5:preloader-dismissed` atau pada `requestIdleCallback` / `window.onload`):
   - Ambil seluruh daftar URL:
     - **Divisi (Prioritas 1):** Divisi 1 (`mobdev`) `image_red` & `image_blue`, Divisi 7 (`quest`) `image_red` & `image_blue`, serta varian blue dari Divisi 0 (`webdev-blue.svg`).
     - **Divisi (Prioritas 2):** Seluruh sisa `image_red` & `image_blue` divisi 2–6 (termasuk `gamedev-red.svg` dan `gamedev-blue.svg`), serta `name_svg`, `tag_svg`, `nav_pill`, `nav_pill_active`.
     - **Showcase (Prioritas 3):** Semua `thumbnail_overlay` dan file `gallery` dari `showcase.json`.
   - Mekanisme pre-cache non-blocking:
     ```ts
     const preloadAsset = (url: string) => {
       if (!url) return;
       const img = new Image();
       img.decoding = 'async';
       img.src = url;
     };
     ```
   - Lakukan pemanggilan bertahap (batch per 2-3 aset dengan interval atau via `requestIdleCallback`) agar tidak membebani network thread saat halaman baru saja dibuka.
   - Dengan begitu, saat user scrolling ke bagian Divisi dan menekan tombol Next/Prev/Role Change, seluruh gambar sudah ada di memory/HTTP cache browser dan bertransisi mulus 0ms tanpa ada tampilan kosong/blank!

---

## 5. Verifikasi Mandiri (Playwright Test Loop)
Plana wajib menjalankan pengujian otomatis:
1. `npm run build` di `/mnt/d/github/RIT-PKKMB-P5/` (wajib lolos 0 error).
2. Buat / update script pengujian headless Playwright:
   - Verifikasi bahwa setelah preloader selesai dan dilakukan 1 interaksi sentuhan (`page.mouse.click(100, 100)` atau `page.touchscreen.tap(100, 100)`), elemen `<audio id="bgm-audio">` berstatus `paused === false` dan icon BGM bernilai `menu_music_on.svg`.
   - Verifikasi carousel Divisi: klik `Next` dan `Role Change`, pastikan `img#div-img` memiliki `src` yang valid dan tidak menghasilkan console error 404.
   - Verifikasi tidak ada error runtime pada console.

---

## 6. Format Laporan (WAJIB)
FILE DISENTUH: <list path file>
SKILL DIMUAT: <list skill yang sudah di-load>
BUKTI TEST MANDIRI: <snapshot path / status console test>
HASIL:
- <ringkasan implementasi first-touch BGM autoplay>
- <ringkasan implementasi background async asset preloader>
BLOCKER / PERTANYAAN: <jika ada>

## 7. Discord Notification (WAJIB saat run di WSL)
Setelah selesai dan terverifikasi, jalankan via terminal:
`plana send -t "discord:1537423423956058152" "[Plana: Task Selesai] RIT PKKMB 2026: First-Touch BGM & Async Asset Preloader selesai diimplementasikan & terverifikasi"`
