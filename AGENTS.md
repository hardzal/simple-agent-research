# Repository Instructions for Hermes

Dokumen ini mengatur coding agent yang mengerjakan repository. Perilaku aplikasi research agent dimiliki [docs/PRD.md](docs/PRD.md) dan diimplementasikan pada runtime, tools, serta research instructions.

## 1. Mulai dari kondisi aktual

Repository: https://github.com/hardzal/simple-agent-research

Base branch: `master`

Lingkungan utama: Windows melalui WSL2 dan Docker Desktop.

Pada awal sesi:

1. Baca [docs/CONTEXT.md](docs/CONTEXT.md) untuk fase, status review, dan bukti terakhir.
2. Baca [docs/PLAN.md](docs/PLAN.md) untuk dependency dan task fase aktif.
3. Baca bagian [docs/PRD.md](docs/PRD.md) dan [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) yang terkait sebelum mengubah implementasi.
4. Periksa status Git dan perubahan yang sudah ada. Jangan menghapus atau memasukkan perubahan pengguna yang tidak berkaitan.

Pada baseline dokumentasi, implementasi aplikasi belum dimulai. Siapkan kode hanya ketika pemilik proyek meminta memulai fase implementasi. Jangan menyatakan perintah pnpm/Docker atau tests sudah tersedia sebelum file dan script-nya dibuat.

Hermes mendukung project context AGENTS.md. Dokumen lain tetap harus dibaca secara eksplisit; keberadaan file bukan bukti bahwa semuanya otomatis dimuat. Jalankan Hermes dari root repository. Setelah perubahan instruksi, pastikan sesi aktif membaca versi terbaru. Rujukan: [Hermes project context](https://hermes-agent.nousresearch.com/docs/user-guide/which-file-does-what).

## 2. Sumber acuan dan perubahan dokumen

| Dokumen      | Pemilik informasi                                               |
| ------------ | --------------------------------------------------------------- |
| PRD          | Scope, perilaku produk, budget, acceptance criteria             |
| ARCHITECTURE | Komponen, kontrak, provider, config, dan mekanisme teknis       |
| PLAN         | Task, dependency, checks, dan daftar live tests                 |
| CONTEXT      | Kondisi yang sudah diamati, bukti hasil, blockers, titik lanjut |
| AGENTS       | Aturan kerja coding agent dan handoff                           |

Instruksi pengguna yang berlaku menjadi acuan pekerjaan. PLAN/CONTEXT tidak boleh diam-diam mengubah requirement PRD. Jika menemukan kontradiksi material, jelaskan dengan lokasi dan dampaknya. Putuskan detail implementasi rutin sendiri dalam scope fase; jangan meminta konfirmasi untuk setiap keputusan kecil.

Perbarui dokumen yang memiliki informasi tersebut dan gunakan referensi silang. CONTEXT berupa ringkasan state, bukan salinan PRD atau transkrip percakapan.

## 3. Kerjakan satu fase

- Kerjakan task fase aktif beserta test dan dokumentasi yang diperlukan.
- Ikuti dependency di PLAN. Jangan mengerjakan fitur fase berikutnya hanya untuk mengisi waktu.
- Resource limits, validasi citation, filesystem boundary, dan completion checks harus ditegakkan kode; prompt bukan pengganti enforcement.
- Pertahankan scope M1. Jangan menambah database, RAG, multi-agent, background queue, framework web, atau UI produk.
- Gunakan modul/factory dan typed contracts sesuai ARCHITECTURE; hindari abstraksi yang belum dibutuhkan.
- Verifikasi import/signature terhadap dependency yang dipin. Jangan mengarang API Anvia atau konfigurasi provider.
- Jangan mengubah endpoint/model atau menaikkan budget untuk menyembunyikan integration failure.
- Jangan melemahkan assertion, menghapus negative case, atau memalsukan hasil supaya checks terlihat lulus.

Tiga application tools adalah bagian produk. Tools yang tersedia bagi coding agent untuk mengembangkan repository merupakan hal terpisah dan tidak otomatis menjadi kemampuan research agent.

## 4. Konvensi implementasi dan pemeriksaan

Gunakan TypeScript strict, pnpm yang dipin melalui packageManager dan satu pnpm-lock.yaml. Gunakan pnpm install --frozen-lockfile untuk install reproducible; jangan menambahkan package-lock.json atau lockfile package manager lain. Nama kode/file teknis konsisten dalam bahasa Inggris; penjelasan dokumen dan handoff dapat memakai bahasa Indonesia.

Default tooling dan kontrak script berada di ARCHITECTURE/PLAN. Tambahkan script hanya saat functionality-nya ada. Sesudah implementasi, README harus memberi perintah yang benar-benar dapat dijalankan.

Jalankan checks yang sesuai perubahan dan seluruh gate fase yang tersedia: format, lint, typecheck, build, unit/integration tests, dan offline eval. Perluas pnpm run check seiring suite tersedia. Perubahan dokumentasi saja cukup diperiksa link, konsistensi requirement/task, format/diff; tidak perlu mengklaim runtime tests lulus.

Jika pemeriksaan gagal, perbaiki dalam scope fase lalu ulangi pemeriksaan yang relevan. Jika terhalang dependency di luar scope atau kredensial tidak tersedia, catat blocker dan bukti; jangan melaporkan pass.

Semua ordinary test/check commands memakai fake/scripted model dan fake search. Test runner tidak boleh diam-diam menggunakan API asli saat mock belum tersedia.

## 5. Penggunaan API asli

Hanya jalankan LIVE-01, LIVE-02, dan LIVE-03 pada task/fase dan batas otomatis yang ditetapkan PLAN. Wajib ada opt-in environment dan case ID eksplisit. Jangan melakukan automatic rerun atau tambahan live debugging di luar batas tersebut.

Kredensial berada di environment lokal; jangan menulis nilainya ke kode, fixture, logs, report, commit, atau PR. Akses Tavily dinyatakan tersedia oleh pengguna; hal itu tidak membuktikan secret sudah tersedia di environment agent.

Runtime endpoint/model yang dipilih dan compatibility checks ada di ARCHITECTURE. Uji berbayar yang blocked tetap ditulis blocked, bukan skipped-as-pass. Siapkan kode dan instruksi pengujiannya.

## 6. Git, draft PR, dan titik berhenti

1. Pastikan fase sebelumnya sudah direview dan di-merge. Mulai branch fase dari origin/master terbaru.
2. Gunakan nama branch pada PLAN. Jangan commit/push implementasi langsung ke master.
3. Commit hanya perubahan fase aktif, termasuk PLAN/CONTEXT dan README bila relevan.
4. Sebelum handoff, periksa diff, tracked files, dan hasil checks. Jangan commit .env, credential, node_modules, build output, atau laporan generated.
5. Push branch dan buat satu draft pull request dengan base master. Jika PR fase sudah ada, perbarui PR itu.
6. PR menjelaskan masalah/perilaku yang berubah, task/requirement, pemeriksaan yang dijalankan, hasil live test bila ada, dan keterbatasan yang material.
7. Perbarui status menjadi awaiting_review dan berikan tautan PR.
8. Akhiri giliran. Jangan merge PR, mengubahnya menjadi ready, atau memulai fase berikutnya secara otomatis.

Review dan merge dilakukan pemilik proyek. Pada instruksi lanjut berikutnya, baca kembali state dan cek bahwa hasil fase sebelumnya benar-benar sudah masuk master.

Jika push/PR tidak dapat dilakukan karena akses, pertahankan branch/commit lokal dan laporkan blocker beserta bukti. Jangan mengganti workflow menjadi push langsung ke master. Jangan force-push, menghapus branch pengguna, atau mereset perubahan yang tidak dibuat untuk task aktif.

## 7. Handoff minimum

Setiap akhir fase, laporkan secara ringkas:

- Perubahan dan requirement yang terpenuhi.
- Checks yang benar-benar dijalankan beserta hasilnya.
- Yang blocked/belum diverifikasi serta alasannya.
- Branch dan tautan draft PR.
- Titik lanjut setelah review dan merge.

Tandai task verified berdasarkan bukti. Bedakan “kode dibuat”, “test lulus”, “live integration terbukti”, dan “sudah di-merge”.
