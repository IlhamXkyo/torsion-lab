# TORSION LAB

Interactive kinetic chaos laboratory, vector phase space telemetry, and procedural acoustic resonance workbench.

Torsion Lab integrates the Euler-Lagrange equations of motion for a rigid coupled double pendulum using a symplectic 4th-order Runge-Kutta (RK4) integrator. It visualizes sensitive dependence on initial conditions (the butterfly effect) via live Lyapunov exponent estimation, real-time Poincare phase space portraits, and procedural Web Audio harmonic feedback.

---

## Fitur Utama

- **Fisika Lagrangian Presisi Tinggi**: Formulasi mekanika analitik dua pendulum terkopel diselesaikan dengan solver numerik Runge-Kutta orde 4 (RK4) yang dipecah dalam 4 sub-langkah per frame demi kestabilan energi total Hamiltonian dan minim drift energi.
- **Deteksi Kaos dan Eksponen Lyapunov**: Fitur Shadow Twin menjalankan dua pendulum sekaligus dengan selisih awal hanya 0.0001 radian, menghitung laju divergensi fase waktu nyata dalam satuan $\lambda/\text{s}$.
- **Potret Ruang Fase Bebas Diskontinuitas**: Widget HUD memetakan kecepatan sudut terhadap simpangan sudut ($\theta_2$ vs $\omega_2$). Dilengkapi deteksi batas sudut $[-\pi, \pi]$ otomatis untuk mencegah coretan garis artifisial saat rotasi penuh.
- **Sintesis Audio Prosedural**: Web Audio API tanpa berkas eksternal. Menghasilkan dengung bass proporsional terhadap momentum kinetik dan denting kristal pentatonik dengan stereo panning tiap pendulum melintasi sumbu kesetimbangan vertikal, lengkap dengan pembersihan siklus hidup node otomatis.
- **Interaksi Medan Magnet & Touch Tool**: Tambahkan kumparan elektromagnetik penarik atau penolak di atas kanvas dengan klik kanan atau melalui tombol Magnet Tool (`C`) yang ramah layar sentuh dan ponsel.
- **Ekspor Vektor SVG Adaptif Tema**: Simpan snapshot PNG beresolusi tinggi atau unduh kurva lintasan kaotik dalam format SVG murni yang otomatis mewarisi palet tema aktif.
- **Tema Tampilan Monokrom dan Fosfor CRT**: Pilihan palet CRT Green, Cyberpunk Cyan, Amber Monolith, dan Slate Stealth.
- **Suite Pengujian Otomatis**: Dilengkapi unit test bawaan Node.js (`npm test`) yang memverifikasi hukum kekekalan energi Hamiltonian, pembungkusan sudut Euclidean, dan toleransi gaya medan magnet.

---

## Mekanika Fisika

Persamaan gerak diturunkan dari Lagrangian $L = T - V$, di mana energi kinetik total $T$ dan energi potensial gravitasi $V$ dinyatakan sebagai:

```text
T = 0.5 * m1 * (l1 * w1)^2 + 0.5 * m2 * ((l1 * w1)^2 + (l2 * w2)^2 + 2 * l1 * l2 * w1 * w2 * cos(t1 - t2))
V = - (m1 + m2) * g * l1 * cos(t1) - m2 * g * l2 * cos(t2)
```

Sistem persamaan diferensial non-linear orde dua ini ditransformasikan ke dalam empat persamaan diferensial orde satu, lalu diintegrasikan pada setiap frame menggunakan algoritma RK4:

```text
k1 = f(t_n, y_n)
k2 = f(t_n + dt/2, y_n + dt*k1/2)
k3 = f(t_n + dt/2, y_n + dt*k2/2)
k4 = f(t_n + dt, y_n + dt*k3)
y_{n+1} = y_n + (dt/6) * (k1 + 2*k2 + 2*k3 + k4)
```

---

## Pintasan Tombol (Keyboard Shortcuts)

| Tombol | Fungsi |
|---|---|
| `Space` | Menjeda atau melanjutkan simulasi |
| `R` | Mereset posisi pendulum ke konfigurasi awal |
| `T` | Membersihkan riwayat garis lintasan (trail) |
| `M` | Menyalakan atau mematikan synthesizer audio |
| `C` | Mengaktifkan atau menonaktifkan mode alat magnet (klik kanvas untuk pasang/lepas coil) |
| `S` | Mengaktifkan atau menonaktifkan pendulum kembar (Shadow Twin) |
| `1` sampai `5` | Memilih preset dinamika (Twin Chaos, Flip Loop, Magnetic Trap, Harmonic, Zero-G) |
| `Klik Kanan` | Memasang atau menghapus kumparan medan magnet pada kanvas |

---

## Cara Menjalankan

Proyek ini dibangun murni menggunakan standar web modern (Vanilla ES Modules, Canvas API, Web Audio API) tanpa dependensi compiler atau bundler berat.

### Menjalankan Aplikasi
1. Clone repositori ini:
   ```bash
   git clone https://github.com/IlhamXkyo/torsion-lab.git
   cd torsion-lab
   ```

2. Buka berkas `index.html` langsung di browser modern apa saja, atau jalankan server lokal:
   ```bash
   npx serve .
   ```
   atau dengan Python:
   ```bash
   python -m http.server 8000
   ```

3. Buka `http://localhost:8000` di peramban Anda.

### Menjalankan Unit Test
Jalankan test suite numerik bawaan:
```bash
npm test
```
atau secara langsung:
```bash
node --test test/*.test.mjs
```
