# Simple Contextual Research Agent

Proof of concept research agent dengan TypeScript, Anvia SDK v1, Tavily, dan Docker. Agent menerima topik, melakukan pencarian web dalam budget, lalu menulis dan memverifikasi laporan Markdown dengan citation yang dapat ditelusuri.

**Status saat ini:** baseline dokumentasi untuk review. Implementasi aplikasi, package scripts, Docker config, dan test suite belum dibuat.

## Dokumen proyek

| Dokumen | Isi |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Aturan kerja Hermes, testing, branch, dan draft PR per fase |
| [docs/PRD.md](docs/PRD.md) | Scope M1, perilaku, budget, dan acceptance criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Komponen, kontrak tools, provider, config, dan Docker |
| [docs/PLAN.md](docs/PLAN.md) | Enam fase implementasi, task, gate, dan live tests |
| [docs/CONTEXT.md](docs/CONTEXT.md) | Kondisi aktual, keputusan, blockers, dan titik lanjut |

## Lingkungan dan workflow

Target development adalah Windows dengan Docker Desktop/WSL2. Runtime memakai gateway kompatibel OpenAI dengan model gpt-6-luna, Tavily untuk search, dan Anvia Studio untuk menjalankan serta menginspeksi agent. Kredensial dikonfigurasi lokal pada fase implementasi.

Hermes mengerjakan satu fase pada branch terpisah, menjalankan checks yang relevan, memperbarui PLAN/CONTEXT, dan menyerahkan draft PR ke master. Pemilik proyek melakukan review dan merge sebelum fase berikutnya.

Setelah PR spesifikasi direview dan di-merge, instruksi awal untuk Hermes:

> Baca AGENTS.md, docs/CONTEXT.md, dan task Fase 1 dalam docs/PLAN.md. Pelajari requirement/desain terkait, lalu kerjakan Fase 1 saja. Jalankan checks dan LIVE-01 sesuai batas rencana, perbarui konteks, buat draft PR ke master, dan berhenti untuk review.

Petunjuk install, perintah menjalankan aplikasi, dan hasil pengujian ditambahkan setelah implementasinya tersedia. Kontrak perintah yang masih direncanakan ada di PLAN.
