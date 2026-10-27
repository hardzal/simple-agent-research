# Simple Contextual Research Agent

Proof of concept research agent dengan TypeScript, Anvia SDK v1, Tavily, dan Docker. Agent menerima topik, melakukan pencarian web dalam budget, lalu menulis dan memverifikasi laporan Markdown dengan citation yang dapat ditelusuri.

**Status saat ini:** fondasi Fase 1 diimplementasikan; checks offline dan LIVE-01 lulus. Research agent, tiga application tools, UI/server Studio, dan Docker belum tersedia. Fase 2 belum dimulai; commit/draft PR dan review Fase 1 masih menunggu. Evidence ada di CONTEXT.

## Dokumen proyek

| Dokumen                                      | Isi                                                         |
| -------------------------------------------- | ----------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                       | Aturan kerja Hermes, testing, branch, dan draft PR per fase |
| [docs/PRD.md](docs/PRD.md)                   | Scope M1, perilaku, budget, dan acceptance criteria         |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Komponen, kontrak tools, provider, config, dan Docker       |
| [docs/PLAN.md](docs/PLAN.md)                 | Enam fase implementasi, task, gate, dan live tests          |
| [docs/CONTEXT.md](docs/CONTEXT.md)           | Kondisi aktual, keputusan, blockers, dan titik lanjut       |

## Lingkungan dan workflow

Target development adalah Windows dengan Docker Desktop/WSL2. Runtime memakai gateway kompatibel OpenAI dengan model gpt-6-luna, Tavily untuk search, dan Anvia Studio untuk menjalankan serta menginspeksi agent. Kredensial dikonfigurasi lokal pada fase implementasi.

Hermes mengerjakan satu fase pada branch terpisah, menjalankan checks yang relevan, memperbarui PLAN/CONTEXT, dan menyerahkan draft PR ke master. Pemilik proyek melakukan review dan merge sebelum fase berikutnya.

PR spesifikasi sudah di-merge. Fase 1 dikerjakan pada branch phase/01-project-foundation; status bukti dan blocker ada di CONTEXT.

## Pengecekan offline Fase 1

Gunakan Node.js 24.14.0 (24 LTS) dan pnpm 11.22.0 sesuai engines/packageManager. Hanya pnpm-lock.yaml yang digunakan; jangan membuat package-lock.json. pnpm-workspace.yaml mengizinkan build script esbuild secara spesifik dan menjaga OpenAI client versi yang sama dengan adapter.

```sh
pnpm install --frozen-lockfile
pnpm run check
```

check menjalankan format:check, lint, typecheck, build, dan test:unit. Semuanya offline terhadap provider: fake/scripted model dan fetch sintetis; tidak memerlukan kredensial atau membaca .env. Instalasi dependency tetap memerlukan registry atau cache pnpm yang lengkap. Gunakan pnpm run format untuk memperbaiki format. Integration suite filesystem, offline eval riset, pnpm run studio, dan Docker Compose belum tersedia; build saat ini menghasilkan modul fondasi, bukan aplikasi riset yang sudah dapat dipakai.

## Guarded LIVE-01 — bukan bagian checks offline

Runner dan guard-nya diuji dengan fixtures; alur tool-call/result/final response juga terbukti pada LIVE-01 nyata setelah perbaikan format probe. Jangan menjalankan tanpa instruksi live yang eksplisit. Ekspor environment secara lokal berdasarkan .env.example, tanpa menulis secret ke kode/chat/log. Script tidak otomatis memuat .env. Setelah opt-in ALLOW_LIVE_TESTS=true dan environment yang diperlukan tersedia, invocation yang didukung adalah:

```sh
pnpm run test:live --case LIVE-01
```

Runner menolak case lain, case ID yang hilang, dan opt-in yang bukan persis true. Satu invocation adalah satu run, maksimum dua model calls dan satu tool sintetis tanpa side effect; deadline maksimum 60 detik (atau config yang lebih kecil), tanpa SDK/runtime retry atau model/endpoint fallback. Jangan melakukan automatic rerun. Runner meminta nonce tool lalu memverifikasi replay pada jawaban final, dan hanya mengeluarkan ringkasan aman; token yang tidak dilaporkan gateway bernilai null. Tool sintetis ini bukan application tool keempat. Kuota total dan penghentian tetap mengikuti PLAN.

Probe memberikan finalResponse siap salin melalui tool; model harus menyalinnya persis. Exact-match tetap ditegakkan kode. Kegagalan menghasilkan diagnostics aman (counters, usage, status, dan kecocokan nonce), tanpa teks model, nonce, raw provider error, atau secret. Untuk memuat .env langsung tanpa mencetak isinya, mekanisme yang telah diuji adalah ALLOW_LIVE_TESTS=true pnpm exec node --env-file=.env --import tsx scripts/live.ts --case LIVE-01; tetap wajib ada izin live baru, bukan automatic rerun.

Spike Studio memakai factory scoped tanpa session/trace persistence agar SDK tidak mengkloning dan melewati boundary. Buffered/streaming route sudah diuji in-process; inspeksi UI/trace produk tetap wajib dibuktikan pada Fase 5. Gateway/model lulus LIVE-01; ini bukan uji riset end-to-end. Tavily asli, report filesystem, dan UI Docker belum diuji.
