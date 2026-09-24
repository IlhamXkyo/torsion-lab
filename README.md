# TORSION LAB

Interactive kinetic chaos laboratory, vector phase space telemetry, and procedural acoustic resonance workbench.

Torsion Lab integrates the Euler-Lagrange equations of motion for a rigid coupled double pendulum using a symplectic 4th-order Runge-Kutta (RK4) integrator. It visualizes sensitive dependence on initial conditions (the butterfly effect) via live Lyapunov exponent estimation, real-time Poincare phase space portraits, and procedural Web Audio harmonic feedback.

---

## Fitur Utama

- **Fisika Lagrangian Presisi Tinggi**: Formulasi mekanika analitik dua pendulum terkopel diselesaikan dengan solver numerik Runge-Kutta orde 4 (RK4) yang dipecah dalam 4 sub-langkah per frame demi kestabilan energi total Hamiltonian.
- **Deteksi Kaos dan Eksponen Lyapunov**: Fitur Shadow Twin menjalankan dua pendulum sekaligus dengan selisih awal hanya 0.0001 radian, menghitung divergensi fase secara langsung dalam satuan lambda.
- **Potret Ruang Fase Real-Time**: Widget HUD terpisah memetakan kecepatan sudut terhadap simpangan sudut sehingga membentuk kurva limit cycle dan chaotic attractor yang dinamis.
- **Sintesis Audio Prosedural**: Web Audio API tanpa file audio eksternal. Menghasilkan suara dengung bass proporsional terhadap momentum kinetik dan denting kristal pentatonik dengan stereo panning tiap pendulum melintasi sumbu kesetimbangan vertikal.
- **Interaksi Medan Magnet**: Tambahkan kumparan elektromagnetik penarik atau penolak di atas kanvas dengan klik kanan untuk membelokkan lintasan pendulum secara non-linear.
- **Ekspor Vektor dan Gambar**: Simpan snapshot beresolusi tinggi dalam format PNG atau unduh kurva lintasan kaotik dalam format SVG murni.
- **Tema Tampilan Monokrom dan Fosfor CRT**: Pilihan palet CRT Green, Cyberpunk Cyan, Amber Monolith, dan Slate Stealth.

---

## Mekanika Fisika

Persamaan gerak diturunkan dari Lagrangian \( L = T - V \), di mana energi kinetik total \( T \) dan energi potensial gravitasi \( V \) dinyatakan sebagai:

```
T = 0.5 * m1 * (l1 * w1)^2 + 0.5 * m2 * ((l1 * w1)^2 + (l2 * w2)^2 + 2 * l1 * l2 * w1 * w2 * cos(t1 - t2))
V = - (m1 + m2) * g * l1 * cos(t1) - m2 * g * l2 * cos(t2)
```

Sistem persamaan diferensial non-linear orde dua ini ditransformasikan ke dalam empat persamaan diferensial orde satu, lalu diintegrasikan pada setiap frame menggunakan algoritma RK4:

```
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
| `S` | Mengaktifkan atau menonaktifkan pendulum kembar (Shadow Twin) |
| `1` sampai `5` | Memilih preset dinamika (Twin Chaos, Flip Loop, Magnetic Trap, Harmonic, Zero-G) |
| `Klik Kanan` | Memasang atau menghapus kumparan medan magnet pada kanvas |

---

## Cara Menjalankan

Proyek ini dibangun murni menggunakan standar web modern (Vanilla ES Modules, Canvas API, Web Audio API) tanpa dependensi runtime atau proses build.

1. Clone repositori ini:
   ```bash
   git clone https://github.com/IlhamXkyo/torsion-lab.git
   cd torsion-lab
   ```

2. Buka berkas `index.html` langsung di browser modern apa saja, atau jalankan server lokal sederhana:
   ```bash
   npx serve .
   ```
   atau dengan Python:
   ```bash
   python -m http.server 8000
   ```

3. Buka `http://localhost:8000` di peramban Anda.
