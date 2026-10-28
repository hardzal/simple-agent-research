# Project Context — Simple Contextual Research Agent

**Diperbarui:** 2026-10-28

**Milestone aktif:** M1

**Status:** Fase 3 P3-01–P3-04 verified offline; `awaiting_review` pada draft PR #2; Fase 4 belum dimulai

**Repository:** https://github.com/hardzal/simple-agent-research

**Base branch:** master

**Branch aktif:** phase/03-agent-behavior

Dokumen ini menyimpan kondisi aktual dan titik lanjut. Requirement dimiliki [PRD.md](PRD.md), desain di [ARCHITECTURE.md](ARCHITECTURE.md), task di [PLAN.md](PLAN.md), dan workflow di [AGENTS.md](../AGENTS.md).

## 1. Kondisi yang telah diverifikasi

Remote `origin/master` masih `858759b`, merge PR dokumentasi #1. Implementasi Fase 1 `5f516eb` dan Fase 2 `e425782` sudah commit/push pada branch masing-masing, tetapi belum di-merge dan belum memiliki PR implementasi saat pengecekan awal. Atas instruksi pengguna 2026-10-27, branch `phase/03-agent-behavior` dibuat dari `origin/phase/02-tools` pada `e425782`; tidak mengubah master atau menandai fase sebelumnya merged.

Sebelum baseline dokumentasi PR #1, repository belum memiliki source aplikasi, package manifest, lockfile, Docker config, atau test suite. Kondisi tersebut bukan status implementasi saat ini.

Implementasi Fase 1 mencakup package/tooling, config parser, provider factory, safe metrics logger, adapter scope, factory Studio tanpa persistence, serta guarded compatibility runner. Fase 2 menambahkan adapter Tavily, source registry, report validation/store, dan tiga scoped tools. Fase 3 kini menyediakan factory research agent, instructions, policy minimum, runner/entry point programatik, dan offline behavior cases. Docker dan UI/server Studio belum tersedia.

| Area                                      | Status                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Requirement produk M1                     | Baseline dokumentasi sudah di-merge lewat PR #1                                                 |
| Arsitektur dan kontrak tools              | Adapter Tavily, registry, report store, validator, dan tiga scoped tools tersedia               |
| Rencana enam fase                         | Fase 3 verified offline, awaiting_review; Fase 4–6 planned                                      |
| Aturan kerja Hermes dan draft PR per fase | Disusun berdasarkan keputusan pengguna                                                          |
| Paket/SDK yang terpasang                  | Verifikasi terbaru Node 24.16.0; pnpm 11.22.0; core 1.17.1; OpenAI adapter 1.3.5; Studio 1.3.20 |
| Unit/integration/offline eval             | 107 unit tests, 32 integration/boundary tests, dan 12 scripted offline behavior cases lulus     |
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
- Fase 2 offline integration dan LIVE-02 telah diverifikasi di bawah. Offline behavior suite Fase 3 kini tersedia; suite Anvia eval lengkap Fase 6, Docker acceptance, dan LIVE-03 belum tersedia. LIVE-01 lulus pada run terakhir di bawah.

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

- Branch `phase/03-agent-behavior` berbasis Fase 2 `e425782`, sesuai pengecualian eksplisit pengguna. Pada checkpoint persiapan, scope perubahan hanya dua perbaikan fondasi, regression tests, dan sinkronisasi dokumentasi. Implementasi P3-01–P3-04 kemudian diminta pengguna dan bukti terbarunya ada di bagian berikutnya.
- Validator tidak lagi membuang kurung penutup yang berpasangan dalam path/query URL. Sumber sah diuji sebagai bare URL, autolink, dan Markdown link; sumber asing/lookalike tetap ditolak. Integration test membuktikan write/read-back laporan dengan URL berkurung.
- Middleware `onToolInput` Anvia 1.17.1 berjalan sebelum schema parse; `onToolStart` justru sesudah parse. Counter attempt sekarang dimiliki middleware pada run SDK. Scope handler sintetis memakai `toolCallsTrackedByRuntime: false`, sehingga direct handler tests tetap menghitung attempt tanpa double-count pada SDK. Fixture probe juga tidak menghitung ulang counter milik runtime.
- RED: focused suite menunjukkan 9 failures yang diharapkan (URL/round-trip dan input invalid generate/stream), tanpa production fix. GREEN: focused SDK/validator/integration/probe suite 47/47 pass. Valid search dan provider failure masing-masing tetap satu attempt; input invalid tidak memanggil provider atau filesystem.
- `pnpm install --frozen-lockfile`: exit 0 pada Windows/git-bash, Node v24.16.0, pnpm 11.22.0. `pnpm run check && git diff --check`: exit 0; format, lint, typecheck, build, 107 unit tests, 12 integration tests. Dependency/lockfile, endpoint/model, budget, dan assertion sumber asing tidak diubah.
- Tidak menjalankan LIVE-01/02/03, membaca secret .env, menjalankan Docker/Studio UI, atau menandai M1 selesai. Bukti live di atas merupakan riwayat, bukan live validation ulang setelah perbaikan.
- Publikasi persiapan: commit perbaikan `8ac7e8b` sudah dipush pada `origin/phase/03-agent-behavior`; [draft PR #2](https://github.com/hardzal/simple-agent-research/pull/2) terbuka dengan base `master`, status persiapan `awaiting_review`. Tidak ada merge atau perubahan master.
- Review independen pertama terhenti karena transport model, bukan approval. Retry berdasarkan ringkasan diff menemukan nol masalah keamanan/logika baru; bukan pengganti review owner atau bukti pengujian tambahan. Pemeriksaan 25 link lokal pada enam dokumen dan code fences lulus.

## 7. Bukti implementasi Fase 3

- Atas instruksi lanjut pengguna, implementasi diteruskan pada `phase/03-agent-behavior` setelah checkpoint `4ebbe55`, walaupun PR #2 masih draft dan master belum memuat Fase 1/2. Ini melanjutkan pengecualian branch yang eksplisit, bukan klaim merge atau izin Fase 4.
- P3-01: `src/agent/research.instructions.ts` dan `research.agent.ts` menyediakan satu factory dengan tepat webSearch/writeFile/readFile. Instructions memuat intent adaptif, bahasa/override, kebutuhan bukti snippet, klarifikasi stateless, citation, dan prompt-injection boundary.
- P3-02: hook typed `prepareInput`/`transformResponse` pada boundary SDK mengikat policy yang sama pada generate/stream dan route Studio in-process. WeakMap per-scope dibersihkan pada close; hasil final diverifikasi sebelum terminal outcome. Headless `createResearchRuntime(...).run(...)` hanya memanggil objek agent yang sama; export programatik tersedia di `src/index.ts`. Tidak ada HTTP service atau UI produk baru.
- P3-03: schema lokal memeriksa kandidat JSON; response completed hanya dari search sukses + write/read-back tervalidasi. Path dan sources berasal dari state; sources hanya citation badan laporan yang dipakai, bukan seluruh registry. Klarifikasi wajib tanpa tools; no-evidence wajib search sukses tanpa publikasi; provider failure tidak dianggap search kosong. Hanya pesan user terakhir dibawa dari history, override runtime caller dihapus, dan envelope teks dimanipulasi ditolak sebelum model.
- P3-04: `pnpm run eval:offline` menjalankan 12 scripted cases untuk EVAL-01–03, eksploratif/komparatif, ID/EN/override, prompt injection, provider failure dan quota. Suite integration menambahkan 20 runtime boundary cases, termasuk overlapping sources, malformed/forged decisions, usage availability, dan Studio buffered/stream route.
- TDD/evidence: suite awal gagal karena runtime belum tersedia; setelah implementasi, empat mismatch fixture menunjukkan format user message SDK memakai content string. Fixtures dikoreksi sesuai API nyata; schema runtime mendukung string/text-parts. Regression tambahan menemukan null content menghasilkan TypeError dan angka text terkoersi menjadi prompt; dua negative cases terbukti RED lalu GREEN dengan Zod input schema. Contoh JSON di instructions juga diuji parser: invalid pipe-alternative example terbukti RED lalu diganti contoh JSON konkret yang valid (GREEN). Semua negative assertions provenance/status tetap dipertahankan.
- `pnpm install --frozen-lockfile` dan `pnpm run check`: exit 0 pada Node v24.16.0, pnpm 11.22.0. Hasil: format, lint, typecheck, build, 107 unit tests, 32 integration/boundary tests, 12 offline behavior cases. Default fetch pada tests diblokir; tidak membaca .env atau memakai API asli. Dependency/lockfile, endpoint/model, dan budget produk tidak diubah.
- Built ESM smoke via import `dist/index.js`: klarifikasi berhasil, satu fake model call, nol provider call, temporary reports root dibersihkan. Tempfile fixtures dibersihkan afterEach. Log hanya metrics aman; missing usage null, usage yang dilaporkan diakumulasi.
- Keterbatasan: scripted fixtures menguji control flow/enforcement dan pelestarian output bahasa, bukan kualitas/generalisasi LLM live. Raw delta/turn events adalah draft, hanya terminal output/text berisi response policy. Invalid request menolak sebelum run; pemetaan lengkap exception model/turn/deadline/cancellation ke status aplikasi dan seluruh citation/revisi edge cases tetap Fase 4. UI/server, trace persistence, Docker/bind mount dan LIVE-03 belum diverifikasi.
- Review independen terhadap staged source diff Fase 3: tidak menemukan masalah keamanan/logika baru pada scope fase ini; tidak menggantikan owner review atau live acceptance.
- Handoff tetap [draft PR #2](https://github.com/hardzal/simple-agent-research/pull/2), base `master`, status `awaiting_review`. Tidak merge atau mengubah ready; P3 verified offline bukan M1 accepted.

## 8. Titik lanjut

1. Owner mereview draft PR #2; diff terhadap master juga membawa Fase 1/2 yang belum di-merge.
2. Setelah review/merge dan instruksi lanjut, mulai Fase 4 dari master terbaru: P4-01–P4-04, bukan live rerun atau fitur Docker/Studio UI. Tidak ada pengecualian merge otomatis untuk Fase 4.
3. LIVE-03 tetap Fase 6; Docker/Studio UI dan trace persistence tetap Fase 5. Jangan mengaktifkan trace store default yang mengkloning scoped agent tanpa compatibility test.

## 9. Riwayat blocker publikasi dokumentasi — sudah terselesaikan

Pada sesi baseline, pembuatan Git tree melalui integrasi GitHub pernah ditolak HTTP 403. Ini riwayat, bukan blocker aktif: origin/master sekarang memuat merge PR dokumentasi #1 pada 858759b.

Link baseline yang sudah di-merge: https://github.com/hardzal/simple-agent-research/pull/1. Riwayat ini tidak menggantikan status branch/PR implementasi pada bagian persiapan Fase 3.

## 10. Cara memperbarui konteks

Setelah pekerjaan nyata, perbarui tanggal, fase/task aktif, commit/PR terkait, checks beserta hasilnya, blocker, dan titik lanjut. Simpan ringkasan yang dapat digunakan sesi berikutnya. Jangan menyalin seluruh requirement, menyimpan secret, atau menandai task selesai hanya karena direncanakan.
