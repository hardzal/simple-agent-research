# Simple Contextual Research Agent

Asisten riset sederhana untuk mencari informasi web dan menyimpannya sebagai laporan Markdown beserta sumbernya. Tulis topik atau pertanyaan lewat Anvia Studio, lalu buka laporan yang dihasilkan di komputer Anda.

Proyek ini masih berupa percobaan (proof of concept). Pengujian otomatis tanpa API asli sudah lulus, tetapi uji riset dengan layanan asli terakhir berhenti karena batas waktu dan belum menghasilkan laporan. Detail hasilnya ada di [status proyek](docs/CONTEXT.md#12-fase-6--evaluasi-dan-finalisasi).

## Contoh permintaan

- “Apa itu Redis dan apa fungsinya?”
- “Research tentang Redis, termasuk kegunaan dan keterbatasannya.”
- “Bandingkan Redis dan Memcached untuk cache aplikasi.”
- “Jelaskan Redis dalam bahasa Inggris.”

Laporan mengikuti bahasa permintaan, kecuali Anda meminta bahasa lain. Jika topik belum jelas, misalnya “Research Apple”, agent akan meminta penjelasan. Kirim ulang permintaan lengkap seperti “Research Apple perusahaan teknologi, terutama lini bisnisnya”.

Setiap permintaan berdiri sendiri. Agent tidak mengingat percakapan atau hasil riset sebelumnya.

## Mencoba di komputer sendiri

Siapkan:

- Node.js 24 (`>=24.14.0 <25`) dan pnpm `11.22.0`.
- API key untuk gateway model dan Tavily Search.
- Terminal Git Bash atau WSL jika memakai Windows.

Jalankan perintah berikut dari folder repository.

### 1. Pasang dependency

```sh
pnpm install --frozen-lockfile
```

### 2. Siapkan konfigurasi

Salin `.env.example` menjadi `.env` hanya jika `.env` belum ada. Jangan menimpa konfigurasi lokal yang sudah Anda gunakan.

Isi nilai berikut di `.env`:

- `OPENAI_API_KEY`: API key untuk gateway model.
- `TAVILY_API_KEY`: API key Tavily untuk pencarian web.
- `REPORTS_DIR=./reports`: lokasi penyimpanan laporan saat berjalan tanpa container.

Konfigurasi bawaan memakai gateway `https://gateway.devscale.id/v1` dan model `gpt-6-luna`. API key model harus sesuai dengan gateway yang digunakan. Jangan membagikan atau memasukkan `.env` ke Git.

### 3. Buka Studio

```sh
pnpm run studio
```

Buka http://localhost:4021/playground, pilih agent `research`, lalu kirim permintaan Anda. Untuk menghentikan server, tekan `Ctrl+C` pada terminal.

Membuka halaman Studio tidak memanggil layanan model atau pencarian. Mengirim permintaan riset menggunakan API asli dan dapat menimbulkan biaya. Jangan membuka akses Studio ke jaringan umum karena aplikasi ini belum menyediakan login.

Jika ingin menjalankannya dengan Podman atau Docker, ikuti [panduan container](docs/CONTAINERS.md). Panduan itu juga membahas izin folder laporan dan cara menghentikan container.

## Menemukan hasil riset

Jika berhasil, respons berstatus `completed` dan menyertakan lokasi laporan (`reportPath`) serta daftar sumber. Dengan konfigurasi lokal di atas, laporan tersimpan di:

```text
reports/<runId>/report.md
```

`runId` adalah ID unik untuk setiap permintaan. Anda bisa membuka `report.md` dengan editor teks atau aplikasi pembaca Markdown.

Agent memeriksa format dan sumber laporan, menyimpan file, lalu membacanya kembali sebelum menyatakan berhasil. Jika memakai container, laporan tetap berada di folder `reports` pada komputer Anda setelah container dibuat ulang.

Jika riset tidak selesai, lihat status pada respons:

| Status                  | Artinya                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `completed`             | Laporan berhasil disimpan dan diperiksa kembali                                       |
| `needs_clarification`   | Topik perlu diperjelas; kirim permintaan baru dengan konteks lengkap                  |
| `insufficient_evidence` | Pencarian berhasil, tetapi informasi yang ditemukan belum cukup untuk membuat laporan |
| `budget_exceeded`       | Batas waktu atau jumlah pemanggilan model/pencarian sudah tercapai                    |
| `failed`                | Terjadi kegagalan layanan, penyimpanan, validasi, atau pembatalan                     |

File yang ada di folder laporan belum tentu hasil yang berhasil. Gunakan status `completed` sebagai tanda bahwa aplikasi sudah memeriksanya.

## Batasan yang perlu diketahui

- Riset menggunakan cuplikan hasil pencarian, bukan membaca seluruh isi artikel. Periksa sumber sebelum memakai laporan untuk keputusan penting.
- Pengecekan sumber memastikan ID dan URL sesuai hasil pencarian. Pengecekan ini tidak menjamin semua kesimpulan benar.
- Batas bawaan setiap permintaan adalah 60 detik, maksimal tiga pencarian dan lima pemanggilan model. Semua langkah, termasuk perbaikan dan penyimpanan laporan, memakai batas yang sama.
- Agent mendapat satu kesempatan memperbaiki draft yang ditolak, selama waktu dan jumlah pemanggilan masih tersedia. Aplikasi tidak mengulang otomatis permintaan yang gagal.
- Proyek ini belum menyediakan riwayat percakapan permanen, login pengguna, atau layanan riset terjadwal.

Container dan Studio sudah diuji menggunakan Podman. Docker Desktop/WSL2 belum diuji langsung. Keberhasilan pengujian dengan data buatan belum membuktikan bahwa riset dengan API asli selalu berhasil.

## Memeriksa proyek tanpa API key

Untuk menjalankan pengujian otomatis tanpa memakai API asli:

```sh
pnpm install --frozen-lockfile
pnpm run check
```

Pemeriksaan ini tidak membaca `.env` dan memakai model serta pencarian buatan. Instalasi dependency tetap memerlukan koneksi ke registry atau cache pnpm yang lengkap.

## Dokumentasi lanjutan

- [Panduan developer](docs/DEVELOPMENT.md): API programatik, cara kerja internal, konfigurasi, debugging, dan perintah pengujian.
- [Studio dan container](docs/CONTAINERS.md): menjalankan Podman/Docker dan mengatasi masalah izin folder.
- [Evaluasi](docs/EVALUATION.md): pengujian tanpa API asli, aturan pengujian dengan API asli, dan cara menilai laporan.
- [Status proyek](docs/CONTEXT.md): hasil pengujian, kendala, dan pekerjaan yang belum terverifikasi.
- [Kebutuhan produk](docs/PRD.md), [arsitektur](docs/ARCHITECTURE.md), dan [rencana implementasi](docs/PLAN.md).
