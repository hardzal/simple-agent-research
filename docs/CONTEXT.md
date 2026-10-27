# Project Context — Simple Contextual Research Agent

**Diperbarui:** 2026-10-27

**Milestone aktif:** M1

**Status:** Spesifikasi selesai secara lokal; publikasi GitHub blocked; implementasi belum dimulai

**Repository:** https://github.com/hardzal/simple-agent-research

**Base branch:** master

**Branch dokumentasi lokal:** docs/m1-agent-specifications

Dokumen ini menyimpan kondisi aktual dan titik lanjut. Requirement dimiliki [PRD.md](PRD.md), desain di [ARCHITECTURE.md](ARCHITECTURE.md), task di [PLAN.md](PLAN.md), dan workflow di [AGENTS.md](../AGENTS.md).

## 1. Kondisi yang telah diverifikasi

Snapshot repository pada master: `c37dc3b3421eb0ab522c141659710d076d3dd777`.

Sebelum perubahan dokumentasi ini, repository berisi README, AGENTS, serta empat file docs. PRD berisi draft v1.0; dokumen lainnya baru berisi judul. Tidak ada source aplikasi, package manifest, lockfile, Docker config, atau test suite.

Perubahan baseline ini menyusun spesifikasi dan workflow ke lima dokumen serta menambahkan README sebagai peta masuk. Belum ada implementasi aplikasi atau instalasi dependency.

| Area | Status |
| --- | --- |
| Requirement produk M1 | Disusun untuk review |
| Arsitektur dan kontrak tools | Disusun; compatibility checks belum dijalankan |
| Rencana enam fase | Disusun; seluruh fase implementasi planned |
| Aturan kerja Hermes dan draft PR per fase | Disusun berdasarkan keputusan pengguna |
| Paket/SDK yang terpasang | Belum ada |
| Unit/integration/offline eval | Belum tersedia |
| Gateway/model smoke test | Belum dijalankan |
| Tavily live test | Belum dijalankan |
| Docker/Studio runtime | Belum dibuat atau dijalankan |

## 2. Keputusan pengguna yang telah dikumpulkan

| Topik | Keputusan | Sumber acuan |
| --- | --- | --- |
| Klarifikasi | Akhiri request; pengguna mengirim ulang permintaan lengkap | PRD §4.2 |
| Draft ditolak | Satu revisi, hanya selama budget awal masih tersedia | PRD §4.5 |
| Bahasa laporan | Mengikuti bahasa permintaan kecuali ada instruksi bahasa eksplisit | PRD §2 |
| LLM | Gateway https://gateway.devscale.id/v1, model gpt-6-luna | ARCH §1, §5 |
| Search | Tavily Search API; pengguna sudah memiliki akses | ARCH §1 |
| Development | Windows, Docker Desktop/WSL2 | ARCH §9 |
| Coding agent | Hermes | AGENTS |
| Review cadence | Berhenti setiap fase selesai dan checks lulus | AGENTS §3, §6 |
| Live tests | Hanya task live test yang ditentukan PLAN; ordinary checks memakai mock | PLAN §9 |
| Git handoff | Branch terpisah dan draft PR ke master per fase; owner review/merge | AGENTS §6 |

Stack produk, tiga application tools, tanpa database/memory, dan scope M1 lainnya mengikuti PRD awal. Default tooling Node.js 24/npm/Vitest merupakan keputusan implementasi yang dituliskan terbuka di ARCHITECTURE, bukan pilihan pengguna yang pernah ditanyakan.

## 3. Verifikasi teknis yang masih terbuka

- V-01: versi Anvia v1, binding state/lifecycle, generation/streaming, dan Studio policy seam.
- V-02: dukungan Chat API, tool calling/result replay, serta usage pada gateway dan model pilihan.
- V-03: integrasi Tavily dan normalisasi response fields.
- V-04: permission bind mount, non-root/read-only root, dan UI di Docker Desktop/WSL2.

Lihat task pemilik dan kriteria di ARCHITECTURE/PLAN. Ketiadaan bukti bukan bukti fitur tidak didukung. Jangan mengganti pilihan deployment tanpa menjelaskan hasil uji.

Kredensial tidak diberikan atau diperiksa dalam sesi dokumentasi ini. “Akses Tavily tersedia” tidak sama dengan “TAVILY_API_KEY tersedia pada environment Hermes”.

## 4. Pemeriksaan baseline dokumentasi

Pemeriksaan yang telah lulus:

- git diff --check: tidak ada whitespace error.
- Pemeriksaan Python inline: enam dokumen memiliki isi; link lokal, code fences, dan bentuk tabel valid.
- Definisi FR-01–FR-18 dan EVAL-01–EVAL-05 masing-masing tersedia satu kali; seluruh referensi 24 task IDs terdefinisi.
- Changed paths hanya enam file dokumentasi yang direncanakan.
- Endpoint/model dan default budget sesuai keputusan; tidak ditemukan pola literal credential pada dokumen.
- Remote master masih sesuai snapshot sumber sebelum publikasi branch.

Tidak ada npm test, provider request, eval live, Docker build, atau Studio run yang dijalankan sebagai bagian perubahan dokumentasi ini. Tidak ada fase implementasi yang boleh diberi status verified berdasarkan pemeriksaan dokumen.

## 5. Titik lanjut

1. Terapkan patch dokumentasi pada branch terpisah, lalu push dan buka draft PR ke master menggunakan akses GitHub yang memiliki izin tulis.
2. Setelah publikasi berhasil, perbarui blocker ini dan tambahkan tautan PR; owner mereview dan merge PR dokumentasi.
3. Pada permintaan mulai implementasi, Hermes membaca AGENTS serta dokumen terkait.
4. Mulai Fase 1 dari master terbaru, pada branch phase/01-project-foundation.
5. Kerjakan P1-01 sampai P1-03 dan LIVE-01 sesuai guard PLAN; serahkan draft PR Fase 1 dan berhenti sebelum Fase 2.

## 6. Blocker publikasi dokumentasi

Akses baca repository berhasil. Pembuatan Git tree melalui integrasi GitHub ditolak dengan HTTP 403, Resource not accessible by integration. Branch remote, commit remote, dan draft PR dokumentasi belum dibuat melalui integrasi tersebut; master tidak diubah.

Hasil lokal disiapkan sebagai paket enam file Markdown dan patch terhadap snapshot master di atas. Patch dapat direview dan diterapkan pada clone lokal. Tidak mencoba melewati penolakan akses melalui transport atau kredensial lain.

## 7. Cara memperbarui konteks

Setelah pekerjaan nyata, perbarui tanggal, fase/task aktif, commit/PR terkait, checks beserta hasilnya, blocker, dan titik lanjut. Simpan ringkasan yang dapat digunakan sesi berikutnya. Jangan menyalin seluruh requirement, menyimpan secret, atau menandai task selesai hanya karena direncanakan.
