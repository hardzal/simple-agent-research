# Project Context — Simple Contextual Research Agent

**Diperbarui:** 2026-10-27

**Milestone aktif:** M1

**Status:** Checks offline dan LIVE-01 Fase 1 lulus; commit/draft PR dan owner review/merge belum dilakukan; belum masuk Fase 2

**Repository:** https://github.com/hardzal/simple-agent-research

**Base branch:** master

**Branch aktif:** phase/01-project-foundation

Dokumen ini menyimpan kondisi aktual dan titik lanjut. Requirement dimiliki [PRD.md](PRD.md), desain di [ARCHITECTURE.md](ARCHITECTURE.md), task di [PLAN.md](PLAN.md), dan workflow di [AGENTS.md](../AGENTS.md).

## 1. Kondisi yang telah diverifikasi

Baseline Fase 1: origin/master `858759b`, merge PR dokumentasi #1. Branch implementasi dimulai dari baseline ini. Perubahan implementasi masih lokal, belum commit/push/draft PR.

Sebelum baseline dokumentasi PR #1, repository belum memiliki source aplikasi, package manifest, lockfile, Docker config, atau test suite. Kondisi tersebut bukan status implementasi saat ini.

Implementasi Fase 1 kini mencakup package/tooling, config parser, provider factory, safe metrics logger, adapter scope, factory Studio tanpa persistence, serta guarded compatibility runner. Belum ada tiga application tools, agent riset, Docker, atau application entry point.

| Area                                      | Status                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| Requirement produk M1                     | Baseline dokumentasi sudah di-merge lewat PR #1                                     |
| Arsitektur dan kontrak tools              | Spike SDK offline dijalankan; implementasi tools belum dimulai                      |
| Rencana enam fase                         | Fase 1 aktif; Fase 2–6 planned                                                      |
| Aturan kerja Hermes dan draft PR per fase | Disusun berdasarkan keputusan pengguna                                              |
| Paket/SDK yang terpasang                  | Node 24.14.0; pnpm 11.22.0; core 1.17.1; OpenAI adapter 1.3.5; Studio 1.3.20        |
| Unit/integration/offline eval             | Lima file unit/probe offline, 85 tests; integration/eval produk belum dibuat        |
| Gateway/model smoke test                  | LIVE-01 terakhir lulus; dua percobaan sebelumnya gagal validasi replay              |
| Tavily live test                          | Belum dijalankan                                                                    |
| Docker/Studio runtime                     | Route Studio buffered/streaming diuji in-process; UI/server/Docker belum dijalankan |

## 2. Keputusan pengguna yang telah dikumpulkan

| Topik          | Keputusan                                                               | Sumber acuan  |
| -------------- | ----------------------------------------------------------------------- | ------------- |
| Klarifikasi    | Akhiri request; pengguna mengirim ulang permintaan lengkap              | PRD §4.2      |
| Draft ditolak  | Satu revisi, hanya selama budget awal masih tersedia                    | PRD §4.5      |
| Bahasa laporan | Mengikuti bahasa permintaan kecuali ada instruksi bahasa eksplisit      | PRD §2        |
| LLM            | Gateway https://gateway.devscale.id/v1, model gpt-6-luna                | ARCH §1, §5   |
| Search         | Tavily Search API; pengguna sudah memiliki akses                        | ARCH §1       |
| Development    | Windows, Docker Desktop/WSL2                                            | ARCH §9       |
| Coding agent   | Hermes                                                                  | AGENTS        |
| Review cadence | Berhenti setiap fase selesai dan checks lulus                           | AGENTS §3, §6 |
| Live tests     | Hanya task live test yang ditentukan PLAN; ordinary checks memakai mock | PLAN §9       |
| Git handoff    | Branch terpisah dan draft PR ke master per fase; owner review/merge     | AGENTS §6     |

Stack produk, tiga application tools, tanpa database/memory, dan scope M1 lainnya mengikuti PRD awal. Pengguna menyetujui arah research assistant personal dan implementasi M1 bertahap, lalu meminta pengecekan offline serta migrasi npm ke pnpm. pnpm 11.22.0 dipin di packageManager dengan pnpm-lock.yaml sebagai satu-satunya lockfile; package-lock.json dihapus. Node.js 24/Vitest tetap keputusan implementasi yang dituliskan terbuka di ARCHITECTURE.

## 3. Status verifikasi teknis

- V-01: binding scope/lifecycle, generation/streaming, direct tool rejection, cancellation/deadline, dan finalization seam terbukti dengan fake model. Factory scoped Studio wajib dipakai; konfigurasi default mengkloning agent dan melewati adapter. Trace persistence sementara nonaktif pada spike; integrasi UI/trace produk tetap wajib dibuktikan Fase 5.
- V-02: LIVE-01 terakhir membuktikan tool-call → tool-result → final response pada gateway/model terpilih. Pemeriksaan tetap exact-match. Ini bukan bukti streaming provider, Tavily, riset end-to-end, atau UI Docker.
- V-03: integrasi Tavily dan normalisasi response fields.
- V-04: permission bind mount, non-root/read-only root, dan UI di Docker Desktop/WSL2.

Lihat task pemilik dan kriteria di ARCHITECTURE/PLAN. Ketiadaan bukti bukan bukti fitur tidak didukung. Jangan mengganti pilihan deployment tanpa menjelaskan hasil uji.

Kredensial asli tidak dibaca atau diperiksa saat pengecekan offline sebelumnya. Pada permintaan live terbaru, .env dimuat langsung oleh Node --env-file tanpa mencetak isinya; ALLOW_LIVE_TESTS=true diberikan eksplisit sesuai otorisasi pengguna. Tidak ada Tavily call. Nilai secret tidak dicatat pada evidence.

## 4. Bukti pengecekan Fase 1

Lingkungan: Windows/git-bash, Node v24.14.0, pnpm 11.22.0; verifikasi pada 2026-10-27 (+07:00).

- pnpm run check terbaru sesudah perbaikan probe: exit 0 untuk format, lint, typecheck, build, dan 85/85 tests pada lima file. Config 34, logger 19, SDK/Studio scope 15, provider 7, live-runner fixtures 10. Hanya dua tests tambahan untuk failure diagnostics/redaction dan kontrak finalResponse; negative invented-answer tetap ditolak.
- pnpm run typecheck dan pnpm run lint: exit 0 setelah perbaikan.
- pnpm install --frozen-lockfile --offline: exit 0 pada workspace utama dan direktori sementara yang awalnya tidak memiliki node_modules; fresh install memakai 361 paket dari cache tanpa download. pnpm run check lulus pada keduanya: format, lint, typecheck, build, dan seluruh 83 tests. Ini tidak berarti seluruh fase/live integration lulus.
- Built ESM smoke: modul dist/config, provider, scoped-agent, dan scoped-studio berhasil dimuat; route metadata /agents mengembalikan 200 tanpa provider request.
- Pemeriksaan 25 link Markdown lokal dan git diff --check lulus. PRD dibandingkan dengan baseline yang dinormalisasi oleh Prettier: perubahan PRD hanya format, bukan requirement. .gitattributes menetapkan LF untuk mencegah checkout Windows merusak format check.
- Baseline pertama menghasilkan 60 pass/1 fail: route Studio menghasilkan respons tetapi scoped tool tidak dipanggil karena default trace store mengkloning agent. Factory tanpa session/trace store memperbaiki route buffered dan streaming; tests sekarang menegaskan side effect fixture dan cleanup.
- Negative tests baru menemukan model attempt gagal tidak terhitung dan scope tidak dibersihkan saat tool factory melempar. Keduanya diperbaiki dengan pre-completion counter dan construction-error cleanup; focused RED → GREEN telah dijalankan.
- Provider HTTP 429/500/503 diuji dengan fetch sintetis: tepat satu request, tanpa retries. Usage gateway yang hilang dipetakan null, bukan nol rekaan.
- Bootstrap pnpm sempat timeout/EBUSY saat auto-install bersamaan; install diserialkan. Build script esbuild diizinkan secara spesifik; bukan approve semua dependency scripts.
- Hook pemeriksaan per-file menampilkan TS5112 pada TypeScript 6 karena file arg + tsconfig. Gate proyek pnpm run typecheck tidak mengalami error tersebut.
- Tidak ada offline eval produk, filesystem integration, Docker acceptance, atau LIVE-02/03 yang diklaim lulus. LIVE-01 lulus pada run terakhir di bawah.

### LIVE-01 — percobaan pertama, failed

- Dicatat pada 2026-10-27T14:09:27+07:00 setelah eksekusi; waktu mulai/durasi persis tidak tersedia pada output failure.
- Command: ALLOW_LIVE_TESTS=true pnpm exec node --env-file=.env --import tsx scripts/live.ts --case LIVE-01.
- Hasil terminal: exit 1; output aman {"caseId":"LIVE-01","outcome":"failed","errorType":"LIVE_REPLAY"}.
- Guard tetap satu run, maksimum dua model calls, satu tool sintetis, deadline maksimum 60 detik, retries off. Tidak ada rerun, fallback endpoint/model, Tavily call, atau implementasi Fase 2.
- Finalizer menolak bila toolCalls bukan 1, modelCalls bukan 2, status bukan completed, atau teks final tidak persis nonce yang dikembalikan tool. Output failure saat ini tidak membedakan kondisi tersebut. Jumlah aktual calls, usage, run ID, endpoint/model aktual, dan durasi tidak tersedia pada output; jangan mengisi dengan angka/nilai asumsi.
- Langkah diagnosis berikutnya: tambahkan diagnostics aman dan negative fixtures secara offline agar kondisi gagal dapat dibedakan. Request live berikutnya membutuhkan otorisasi baru; hasil ini bukan pass dan bukan bukti provider tidak mendukung tools.

### Riwayat baseline dokumentasi (bukan bukti runtime)

Pemeriksaan yang telah lulus:

- git diff --check: tidak ada whitespace error.
- Pemeriksaan Python inline: enam dokumen memiliki isi; link lokal, code fences, dan bentuk tabel valid.
- Definisi FR-01–FR-18 dan EVAL-01–EVAL-05 masing-masing tersedia satu kali; seluruh referensi 24 task IDs terdefinisi.
- Changed paths hanya enam file dokumentasi yang direncanakan.
- Endpoint/model dan default budget sesuai keputusan; tidak ditemukan pola literal credential pada dokumen.
- Remote master masih sesuai snapshot sumber sebelum publikasi branch.

Pada baseline dokumentasi dahulu tidak ada test, provider request, eval live, Docker build, atau Studio run. Pemeriksaan dokumen tersebut tidak dijadikan bukti runtime Fase 1.

### LIVE-01 — diagnosis dan perbaikan KISS

- Setelah instruksi pengguna untuk memperbaiki LIVE-01, satu run diagnostik dimulai 2026-10-27T07:28:44.327Z: runId 2f970159-1f66-4335-9516-ef2cb5a318f3; exit 1 / LIVE_REPLAY; durationMs 29985.9607; modelCalls 2; toolCalls 1; status completed; inputTokens 205; outputTokens 42; nonceMatched false; nonceIncluded true. Endpoint https://gateway.devscale.id/v1; model gpt-6-luna; API chat. Alur tool bekerja, tetapi teks final bukan format exact-match. Bentuk penyimpangan teks tidak dicatat karena raw output sengaja tidak dilog.
- Perbaikan kecil: tool memberikan finalResponse yang lengkap; instruksi meminta model menyalinnya verbatim, bukan merangkai prefix dan nonce. Assertion tidak dilonggarkan, endpoint/model tidak diganti, budget tidak dinaikkan. Failure diagnostics kini memuat metadata aman, tanpa raw exception/teks model/nonce/secret. Regression offline diperiksa RED → GREEN.
- Pengguna kemudian memilih eksplisit “Jalankan satu LIVE-01 tambahan, tanpa retry”. Run verifikasi dimulai 2026-10-27T07:36:15.947Z: runId e764eadb-3e0d-4757-b6c0-0e8c8e2e6e4f; exit 0 / passed; durationMs 32192.302000000003; modelCalls 2; toolCalls 1; status completed; inputTokens 250; outputTokens 71; nonceMatched true; nonceIncluded true. Endpoint/model/API sama. Command sama dengan percobaan pertama.
- Total tiga invocation live sepanjang pekerjaan ini, masing-masing sesuai instruksi/konfirmasi pengguna; tidak ada automatic rerun, retry, fallback, atau Tavily call. Tidak ada tambahan run setelah pass.

## 5. Titik lanjut

1. Checks offline dan LIVE-01 telah lulus. Tinjau perubahan lokal Fase 1; jangan memulai Fase 2 sebelum owner review/merge.
2. Tidak perlu menambah test matrix atau live debugging setelah pass. Request live tambahan tetap membutuhkan otorisasi baru; jangan meminta secret di chat.
3. Sesudah bukti Fase 1 lengkap, perbarui status task, siapkan commit/push/draft PR sesuai workflow dan otorisasi pengguna, lalu berhenti untuk owner review/merge.
4. Trace UI produk tetap gate Fase 5. Jangan mengaktifkan trace store default/model registry yang mengkloning scoped agent tanpa compatibility test baru.

## 6. Riwayat blocker publikasi dokumentasi — sudah terselesaikan

Pada sesi baseline, pembuatan Git tree melalui integrasi GitHub pernah ditolak HTTP 403. Ini riwayat, bukan blocker aktif: origin/master sekarang memuat merge PR dokumentasi #1 pada 858759b.

Link baseline yang sudah di-merge: https://github.com/hardzal/simple-agent-research/pull/1. Belum ada PR implementasi Fase 1; tidak ada commit/push yang dijalankan pada pengecekan offline ini.

## 7. Cara memperbarui konteks

Setelah pekerjaan nyata, perbarui tanggal, fase/task aktif, commit/PR terkait, checks beserta hasilnya, blocker, dan titik lanjut. Simpan ringkasan yang dapat digunakan sesi berikutnya. Jangan menyalin seluruh requirement, menyimpan secret, atau menandai task selesai hanya karena direncanakan.
