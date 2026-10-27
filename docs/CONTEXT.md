# Project Context — Simple Contextual Research Agent

**Diperbarui:** 2026-10-27

**Milestone aktif:** M1

**Status:** Persiapan Fase 3 `awaiting_review`; checks offline lulus; research behavior P3-01–P3-04 belum diimplementasikan

**Repository:** https://github.com/hardzal/simple-agent-research

**Base branch:** master

**Branch aktif:** phase/03-agent-behavior

Dokumen ini menyimpan kondisi aktual dan titik lanjut. Requirement dimiliki [PRD.md](PRD.md), desain di [ARCHITECTURE.md](ARCHITECTURE.md), task di [PLAN.md](PLAN.md), dan workflow di [AGENTS.md](../AGENTS.md).

## 1. Kondisi yang telah diverifikasi

Remote `origin/master` masih `858759b`, merge PR dokumentasi #1. Implementasi Fase 1 `5f516eb` dan Fase 2 `e425782` sudah commit/push pada branch masing-masing, tetapi belum di-merge dan belum memiliki PR implementasi saat pengecekan awal. Atas instruksi pengguna 2026-10-27, branch `phase/03-agent-behavior` dibuat dari `origin/phase/02-tools` pada `e425782`; tidak mengubah master atau menandai fase sebelumnya merged.

Sebelum baseline dokumentasi PR #1, repository belum memiliki source aplikasi, package manifest, lockfile, Docker config, atau test suite. Kondisi tersebut bukan status implementasi saat ini.

Implementasi Fase 1 mencakup package/tooling, config parser, provider factory, safe metrics logger, adapter scope, factory Studio tanpa persistence, serta guarded compatibility runner. Fase 2 menambahkan adapter Tavily, source registry, report validation/store, dan tiga scoped tools. Agent riset, Docker, atau application entry point belum tersedia.

| Area                                      | Status                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Requirement produk M1                     | Baseline dokumentasi sudah di-merge lewat PR #1                                                 |
| Arsitektur dan kontrak tools              | Adapter Tavily, registry, report store, validator, dan tiga scoped tools tersedia               |
| Rencana enam fase                         | Persiapan Fase 3 aktif; task behavior Fase 3 dan Fase 4–6 planned                               |
| Aturan kerja Hermes dan draft PR per fase | Disusun berdasarkan keputusan pengguna                                                          |
| Paket/SDK yang terpasang                  | Verifikasi terbaru Node 24.16.0; pnpm 11.22.0; core 1.17.1; OpenAI adapter 1.3.5; Studio 1.3.20 |
| Unit/integration/offline eval             | 107 unit tests dan 12 filesystem integration tests lulus; offline eval riset belum tersedia     |
| Gateway/model smoke test                  | LIVE-01 terakhir lulus; dua percobaan sebelumnya gagal validasi replay                          |
| Tavily live test                          | LIVE-02 lulus; satu query, lima hasil, tanpa LLM/retry                                          |
| Docker/Studio runtime                     | Route Studio buffered/streaming diuji in-process; UI/server/Docker belum dijalankan             |

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
- V-03: adapter/normalisasi Tavily verified dengan fixtures dan LIVE-02 terdahulu; tidak ada live rerun pada persiapan Fase 3.
- V-04: permission bind mount, non-root/read-only root, dan UI di Docker Desktop/WSL2.

Lihat task pemilik dan kriteria di ARCHITECTURE/PLAN. Ketiadaan bukti bukan bukti fitur tidak didukung. Jangan mengganti pilihan deployment tanpa menjelaskan hasil uji.

Kredensial asli tidak dibaca atau dicetak. Pada live test yang diotorisasi, .env dimuat langsung oleh Node --env-file tanpa menampilkan isinya; nilai secret tidak dicatat pada evidence. LIVE-02 melakukan satu Tavily call dan hanya mencatat metadata aman.

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
- Fase 2 offline integration dan LIVE-02 telah diverifikasi di bawah. Offline eval produk, Docker acceptance, dan LIVE-03 belum tersedia. LIVE-01 lulus pada run terakhir di bawah.

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

## 5. Bukti Fase 2

- `pnpm install --frozen-lockfile --offline && pnpm run check && git diff --check`: exit 0. Format, lint, typecheck, build, 94 unit tests, dan 11 filesystem integration tests lulus.
- Unit tests mencakup adapter/registry, validator provenance, LIVE-02 guard, input/quota/deadline/isolasi scoped tools. Integration tests mencakup round-trip UTF-8/hash, duplicate write, traversal, symlink/junction, tampering, cancellation, dan EACCES sintetis.
- LIVE-02: command `ALLOW_LIVE_TESTS=true pnpm exec node --env-file=.env --import tsx scripts/live.ts --case LIVE-02`; exit 0. Run ID `c6c24477-640c-4685-968e-1efb0de6534b`, endpoint Tavily search, query `Redis official documentation`, duration 2782 ms, modelCalls 0, searchCalls 1, resultCount 5, sourceCount 5, tokens null. Tidak ada secret/raw response di output.
- Snapshot Fase 2 sudah commit/push pada `phase/02-tools` (`e425782`), belum di-merge. Dua temuan review tambahan ditangani pada branch Fase 3 di bawah; bukti awal 94/11 tests tidak mencakup dua regresi tersebut.

## 6. Persiapan Fase 3 — perbaikan review

- Branch `phase/03-agent-behavior` berbasis Fase 2 `e425782`, sesuai pengecualian eksplisit pengguna. Scope perubahan hanya dua perbaikan fondasi, regression tests, dan sinkronisasi dokumentasi; P3-01–P3-04 belum dikerjakan.
- Validator tidak lagi membuang kurung penutup yang berpasangan dalam path/query URL. Sumber sah diuji sebagai bare URL, autolink, dan Markdown link; sumber asing/lookalike tetap ditolak. Integration test membuktikan write/read-back laporan dengan URL berkurung.
- Middleware `onToolInput` Anvia 1.17.1 berjalan sebelum schema parse; `onToolStart` justru sesudah parse. Counter attempt sekarang dimiliki middleware pada run SDK. Scope handler sintetis memakai `toolCallsTrackedByRuntime: false`, sehingga direct handler tests tetap menghitung attempt tanpa double-count pada SDK. Fixture probe juga tidak menghitung ulang counter milik runtime.
- RED: focused suite menunjukkan 9 failures yang diharapkan (URL/round-trip dan input invalid generate/stream), tanpa production fix. GREEN: focused SDK/validator/integration/probe suite 47/47 pass. Valid search dan provider failure masing-masing tetap satu attempt; input invalid tidak memanggil provider atau filesystem.
- `pnpm install --frozen-lockfile`: exit 0 pada Windows/git-bash, Node v24.16.0, pnpm 11.22.0. `pnpm run check && git diff --check`: exit 0; format, lint, typecheck, build, 107 unit tests, 12 integration tests. Dependency/lockfile, endpoint/model, budget, dan assertion sumber asing tidak diubah.
- Tidak menjalankan LIVE-01/02/03, membaca secret .env, menjalankan Docker/Studio UI, atau menandai M1 selesai. Bukti live di atas merupakan riwayat, bukan live validation ulang setelah perbaikan.
- Publikasi persiapan: commit perbaikan `8ac7e8b` sudah dipush pada `origin/phase/03-agent-behavior`; [draft PR #2](https://github.com/hardzal/simple-agent-research/pull/2) terbuka dengan base `master`, status persiapan `awaiting_review`. Tidak ada merge atau perubahan master.
- Review independen pertama terhenti karena transport model, bukan approval. Retry berdasarkan ringkasan diff menemukan nol masalah keamanan/logika baru; bukan pengganti review owner atau bukti pengujian tambahan. Pemeriksaan 25 link lokal pada enam dokumen dan code fences lulus.

## 7. Titik lanjut

1. Owner mereview [draft PR #2](https://github.com/hardzal/simple-agent-research/pull/2) dari `phase/03-agent-behavior` ke `master`; tidak ada merge otomatis. Diff terhadap master juga mencakup fondasi Fase 1/2 yang belum di-merge.
2. Mulai implementasi behavior dari P3-01 pada branch ini setelah checkpoint persiapan direview; ikuti P3-02–P3-04 dan offline eval. Pengecualian basis branch tidak berarti Fase 3 selesai atau izin otomatis menjalankan fase berikutnya.
3. Tidak perlu live API pada Fase 3. LIVE-03 tetap Fase 6; Docker/Studio UI tetap Fase 5. Trace store default yang mengkloning scoped agent tidak boleh diaktifkan tanpa compatibility test.

## 8. Riwayat blocker publikasi dokumentasi — sudah terselesaikan

Pada sesi baseline, pembuatan Git tree melalui integrasi GitHub pernah ditolak HTTP 403. Ini riwayat, bukan blocker aktif: origin/master sekarang memuat merge PR dokumentasi #1 pada 858759b.

Link baseline yang sudah di-merge: https://github.com/hardzal/simple-agent-research/pull/1. Riwayat ini tidak menggantikan status branch/PR implementasi pada bagian persiapan Fase 3.

## 9. Cara memperbarui konteks

Setelah pekerjaan nyata, perbarui tanggal, fase/task aktif, commit/PR terkait, checks beserta hasilnya, blocker, dan titik lanjut. Simpan ringkasan yang dapat digunakan sesi berikutnya. Jangan menyalin seluruh requirement, menyimpan secret, atau menandai task selesai hanya karena direncanakan.
