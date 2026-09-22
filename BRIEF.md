# BRIEF REVISI 5: STICKY NAV, AUTOPLAY BGM, DRAWER GAME CANVAS, & OPTIMASI PRELOADER
Dari: Arona (Lead Arsitek & QA) | Untuk: Plana (Full-Stack Executor) | Tanggal: 2026-09-22

## 1. Goal
Menyelesaikan 4 penyesuaian akhir sebelum deploy sesuai instruksi Sensei Lysander:
1. **Autoplay & Active State BGM:** BGM audio langsung aktif dalam state playing secara default (`isPlaying = true`, icon `menu_music_on.svg`), dengan gesture-safe fallback yang langsung membunyikan musik saat ada interaksi pertama di halaman.
2. **Sticky Right Controls:** Tombol kontrol kanan (Music toggle & Burger menu) dibuat sticky/fixed di pojok kanan atas kontainer sehingga tetap dapat diakses kapan saja saat pengguna melakukan scroll.
3. **Game Canvas Scaling untuk Drawer:** Terapkan skala proporsional dinamis yang sama pada menu navigasi drawer (`Drawer.astro`) di layar mobile (< 440px) agar tata letaknya tetap rapi 1:1.
4. **Optimasi Preloader & Smart Cache:**
   - Gunakan cache session (`sessionStorage`): jika user sudah pernah memuat website dalam sesi tersebut (atau melakukan refresh), preloader langsung dismiss secara instan (fade cepat 0.2s) tanpa harus menunggu lama.
   - Preloader memprioritaskan aset pembuka (audio metadata, font `P5Hatty`, elemen hero header).
   - Elemen di bawah layar (below-the-fold) menerapkan lazyloading (`loading="lazy"` & `decoding="async"`).

⚠️ **ATURAN MUTLAK SENSEI LYSANDER (STRICT CONSTRAINT):**
DILARANG merubah koordinat absolut, ukuran, atau penataan dalam komponen yang sudah dirapikan Sensei!

## 2. Required Skills (Load via skill_view)
- [ ] `frontend-taste-and-design`
- [ ] `web-design-guidelines`
- [ ] `modern-web-motion`
- [ ] `playwright-iterative-qa`

## 3. Konteks & Scope
- Path Repositori: `/mnt/d/github/rit-pkkmb/`
- File Target:
  - `src/components/Header.astro` (Autoplay state, sticky controls)
  - `src/components/Drawer.astro` (Game canvas scaling pada drawer konten)
  - `src/components/Preloader.astro` (SessionStorage cache, prioritas preload)
  - `src/layouts/Layout.astro` (Koneksi sticky controls & drawer scaler jika diperlukan)
- DILARANG auto-commit git (Sensei Lysander commit manual).

---

## 4. Rincian Spesifikasi Teknis

### A. Autoplay & Active State BGM (`src/components/Header.astro`)
1. **Default State:**
   - Status awal `isPlaying = true`.
   - Ikon tombol BGM awal adalah `src="/assets/svg/menu_music_on.svg"`.
2. **Autoplay & Browser Gesture Policy Fallback:**
   - Saat halaman termuat, langsung panggil `audio.play()`.
   - Karena browser modern memblokir audio unmuted otomatis tanpa gesture, pasang safety listener pada window/document (`click`, `touchstart`, `keydown`):
     Jika audio tertahan oleh browser, pada tap/klik pertama di manapun (termasuk saat menyentuh preloader atau scroll), `audio.play()` langsung aktif tanpa mengharuskan pengguna mencari tombol musik.

### B. Sticky Right Controls (`src/components/Header.astro`)
1. **Posisi Tetap (Sticky / Fixed):**
   - Area `<!-- Right Controls: Music Toggle & Burger Menu -->` dibuat tetap melayang di pojok kanan atas kontainer saat halaman di-scroll ke bawah:
     - Gunakan `fixed top-5 z-40 flex items-center gap-3`.
     - Untuk penempatan horizontal yang presisi: di mobile (< 440px) gunakan `right-4`, di desktop (>= 440px) gunakan `right-4 md:right-[calc(50%-220px+16px)]` agar selalu mengunci 16px dari tepi kanan frame 440px yang berada di tengah layar monitor!
   - Tombol tetap memiliki efek transisi hover/active scale yang mulus.

### C. Game Canvas Scaling untuk Drawer (`src/components/Drawer.astro`)
1. **Dynamic Scaling:**
   - Di dalam container drawer `<nav id="drawer-nav">`, bungkus konten drawer dengan kontainer `w-[440px] h-full relative` yang menerapkan skala yang sama dengan canvas utama:
     Saat lebar layar ponsel `W < 440px`, konten diskala dengan `scale = W / 440` dan `transformOrigin: 'top center'`.
   - Ini memastikan seluruh tombol nav link, tombol close, dan panel medsos di bawah tetap proporsional dan tidak terpotong di layar ponsel kecil (360px – 390px).

### D. Optimasi Preloader & Smart Cache (`src/components/Preloader.astro`)
1. **Smart Cache Session:**
   - Periksa `sessionStorage.getItem('p5_preloader_seen')`:
     - Jika bernilai `'1'` (user me-refresh atau sudah pernah membuka website): Preloader langsung dismiss secara instan (`transition: opacity 0.2s`, `opacity: 0`, lalu `display: none`).
     - Jika kunjungan pertama: Jalankan animasi preloader 3D Persona 5, tunggu `load`, lalu simpan `sessionStorage.setItem('p5_preloader_seen', '1')` dan dismiss mulus.
2. **Prioritas Resource:**
   - Pasang `<link rel="preload" href="/assets/audio/Royal%20Days_128k.mp3" as="audio" />` dan `<link rel="preload" href="/assets/fonts/p5hatty.ttf" as="font" type="font/ttf" crossorigin />`.
   - Tambahkan `loading="lazy"` dan `decoding="async"` pada gambar-gambar di section bawah (Showcase gallery, footer logos, FAQ maskot).

---

## 5. Verifikasi Mandiri (Playwright Test Loop)
- Lakukan `npm run build` (wajib 0 error).
- Uji headless Playwright:
  - Verifikasi right controls tetap terlihat di posisi atas saat scroll ke bawah (`scrollY > 1000px`).
  - Verifikasi audio BGM berada di state play dengan icon `menu_music_on.svg`.
  - Verifikasi drawer pada viewport 360px & 390px diskala rapi tanpa overflow.
  - Verifikasi refresh kedua tidak memicu jeda preloader yang lama karena `sessionStorage`.
  - Simpan bukti screenshot ke `/mnt/d/aigen/Arona/qc/rit-pkkmb/sticky_nav_scrolled.png` dan `/mnt/d/aigen/Arona/qc/rit-pkkmb/drawer_scaled_mobile.png`.

## 6. Format Laporan (WAJIB)
FILE DISENTUH: <list path file>
SKILL DIMUAT: <list skill yang sudah di-load>
BUKTI TEST MANDIRI: <snapshot path / status console test>
HASIL:
- <ringkasan 4 fitur yang diselesaikan>
BLOCKER / PERTANYAAN: <jika ada>

## 7. Discord Notification (WAJIB saat run di WSL)
Setelah selesai dan terverifikasi, jalankan via terminal:
`plana send -t "discord:1537423423956058152" "[Plana: Task Selesai] RIT PKKMB 2026: Sticky Nav, Autoplay BGM, Drawer Canvas, & Preloader Cache selesai"`
