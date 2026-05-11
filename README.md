# Fisika 3D Interaktif V8

Website pembelajaran Fisika 3D berbasis Vite, Babylon.js, Rapier, dan kontrol gesture tangan.

## Perbaikan V8

Script `dev:https` sudah diperbaiki.

Sebelumnya:

```bash
vite --host 0.0.0.0 --https
```

Itu membuat error pada beberapa versi Vite:

```bash
Unknown option `--https`
```

Sekarang HTTPS diaktifkan dari `vite.config.js` memakai `@vitejs/plugin-basic-ssl`.

## Cara menjalankan lokal biasa

```bash
npm install
npm run dev
```

Buka:

```bash
http://localhost:5173
```

## Cara menjalankan HTTPS untuk kamera HP

```bash
npm install
npm run dev:https
```

Lalu buka alamat HTTPS yang muncul di terminal dari HP.

Contoh:

```bash
https://192.168.1.10:5173
```

Browser mungkin menampilkan peringatan sertifikat lokal. Pilih lanjutkan jika ini proyek lokal milik sendiri.

## Cara paling aman untuk HP

Deploy ke GitHub Pages. GitHub Pages memakai HTTPS, sehingga kamera gesture lebih mudah aktif.

## Gesture

| Gesture | Fungsi |
|---|---|
| Telapak terbuka | Play |
| Kepalan tangan | Pause |
| Telunjuk ke atas | Zoom In |
| Dua jari / Victory | Zoom Out |
| Jempol ke atas | Reset |

## Materi

1. Gerak jatuh bebas
2. Gerak parabola
3. Hukum Newton
4. Tumbukan
5. Bandul sederhana
6. Tata surya
7. Gelombang
8. Medan magnet
