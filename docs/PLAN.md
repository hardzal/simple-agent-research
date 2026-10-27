# Implementation Plan — Milestone 1

**Status:** Checks offline dan LIVE-01 Fase 1 lulus; commit/draft PR dan owner review belum dilakukan; Fase 2 belum dimulai

**Diperbarui:** 2026-10-27

**Requirement:** [PRD.md](PRD.md)

**Desain:** [ARCHITECTURE.md](ARCHITECTURE.md)

**Workflow:** [AGENTS.md](../AGENTS.md)

**State dan bukti terbaru:** [CONTEXT.md](CONTEXT.md)

## 1. Aturan pelaksanaan

Kerjakan satu fase aktif. Setiap fase berakhir dengan pemeriksaan yang relevan, pembaruan PLAN/CONTEXT, commit pada branch terpisah, dan draft PR ke `master`. Hentikan pekerjaan setelah menyerahkan PR; review dan merge dilakukan pemilik proyek.

Pada instruksi lanjut, mulai dari `master` yang sudah memuat hasil fase sebelumnya. Jangan menumpuk implementasi fase berikutnya dalam PR yang masih menunggu review.

Dokumentasi awal menggunakan branch `docs/m1-agent-specifications`. Ini baseline spesifikasi, bukan bukti bahwa Fase 1 sudah dilaksanakan.

Status task: `planned` → `in_progress` → `verified`; gunakan `blocked` jika dependency belum tersedia. Fase yang lulus checks dapat berstatus `awaiting_review`; status `merged` hanya setelah merge benar-benar terjadi.

## 2. Peta fase

| Fase | Branch                        | Hasil                                                  | Status awal                      |
| ---- | ----------------------------- | ------------------------------------------------------ | -------------------------------- |
| 1    | `phase/01-project-foundation` | SDK/tooling/config dan compatibility probe             | checks verified; handoff pending |
| 2    | `phase/02-tools`              | Tiga tools, source registry, report store              | planned                          |
| 3    | `phase/03-agent-behavior`     | Alur riset adaptif dan instruksi agent                 | planned                          |
| 4    | `phase/04-report-validation`  | Validasi lengkap, revisi, dan status final             | planned                          |
| 5    | `phase/05-docker-studio`      | Docker Desktop/WSL2 dan Studio terintegrasi            | planned                          |
| 6    | `phase/06-evaluation`         | Regression suite, live E2E, dan dokumentasi penggunaan | planned                          |

## 3. Fase 1 — Project foundation

**Dependency:** PR dokumentasi telah direview dan di-merge; owner meminta memulai implementasi.

| Task    | Pekerjaan                                                                                                              | Syarat selesai                                                                                            | Acuan              |
| ------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------ |
| P1-01   | Inisialisasi Node.js 24/TypeScript strict dan pnpm; pin paket Anvia v1 yang kompatibel; simpan pnpm-lock.yaml          | Install reproducible; build/typecheck lulus; versi dan engines tercatat                                   | ARCH §1, V-01      |
| P1-02   | Spike SDK dengan fake model: scope run, lifecycle, streaming, Studio registration, cancellation, dan finalization seam | API nyata diverifikasi; dua run tidak berbagi state; adapter boundary minimal terpilih dan terdokumentasi | FR-13, FR-14, V-01 |
| P1-03   | Environment schema, provider factory, logger aman, test runner, lint/format scripts, .gitignore, .env.example          | Config invalid gagal jelas; offline tests tidak memerlukan secrets; runtime retries dinonaktifkan         | FR-15, ARCH §5     |
| LIVE-01 | Satu probe gateway/model dengan tool sintetis tanpa side effect                                                        | Tool-call → tool-result → final response bekerja; API mode dan usage tersedia/tidak tersedia dicatat      | V-02               |

Tool sintetis LIVE-01 hanya fixture compatibility test, bukan application tool keempat dalam research agent.

Status task: P1-01 verified offline (fresh install frozen lockfile dan full check); P1-02 verified offline untuk spike scope/SDK/Studio routes; P1-03 verified offline (config, provider, logger, dan guards). LIVE-01 verified: run terakhir completed dengan dua model calls, satu tool call, dan exact nonce match. Dua percobaan sebelumnya gagal validasi replay; pada percobaan diagnostik terbukti nonce diterima tetapi format tidak persis. Tool kini memberikan finalResponse siap salin tanpa melonggarkan assertion. Setiap tambahan live run mendapat otorisasi pengguna; tidak ada automatic rerun. Rincian hasil ada di CONTEXT. Belum ada commit/draft PR implementasi atau owner review/merge; Fase 2 tetap ditahan.

Keputusan spike Studio: factory scoped menonaktifkan session/trace stores untuk menghindari clone yang melewati adapter; buffered/streaming route terbukti offline. Trace yang dapat diinspeksi sesuai DoD tetap wajib dipenuhi dan diuji pada integrasi Fase 5; factory spike ini bukan klaim kelulusan UI/trace produk.

**Pemeriksaan:** build, typecheck, lint, format check, unit test config/state, fake SDK probe, dan LIVE-01. Uji scope dengan fake dependencies sebelum menggunakan API asli.

**Deliverable/review:** package/config/lockfile, hasil verifikasi SDK, hasil LIVE-01, dan keputusan binding runtime Studio. Jika gateway atau API binding belum berfungsi, laporkan blocker konkret; jangan memulai Fase 2 dengan asumsi dukungan sudah terbukti.

## 4. Fase 2 — Tools implementation

**Dependency:** Fase 1 di-merge.

| Task    | Pekerjaan                                                                                          | Syarat selesai                                                                                | Acuan                     |
| ------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| P2-01   | SearchProvider interface, adapter Tavily, normalisasi hasil, source registry, dan webSearch schema | Limit lima hasil; duplikasi memakai ID sama; query/snippet dibatasi; empty/error dibedakan    | FR-04, FR-05, FR-08, V-03 |
| P2-02   | Report store dan validasi mekanis awal untuk writeFile/readFile                                    | Path aplikasi; validasi sebelum tulis; satu successful write/read; hash/byte round-trip cocok | FR-09, FR-10              |
| P2-03   | Counter/deadline bersama untuk handler dan scope test                                              | Kuota direservasi sebelum I/O; read-before-write, write kedua, path/symlink tidak sah ditolak | FR-13                     |
| LIVE-02 | Satu pencarian Tavily menggunakan query fixture publik                                             | Response dapat dinormalisasi; fields opsional ditangani; tidak ada kredensial di output       | V-03                      |

Validasi dasar di P2-02 harus sudah menolak sumber asing sebelum successful write. Fase 4 memperlengkap format, status, revisi, dan edge cases; tidak menunda semua proteksi sampai fase tersebut.

**Pemeriksaan:** handler unit tests tanpa LLM, temp-filesystem integration, duplicate/unknown source tests, quota, timeout, symlink, permission failure, dan LIVE-02.

**Deliverable/review:** tools dapat dipanggil dan diuji independen dengan scope eksplisit; belum mengklaim seluruh perilaku riset selesai.

## 5. Fase 3 — Research agent behavior

**Dependency:** Fase 2 di-merge.

| Task  | Pekerjaan                                                                  | Syarat selesai                                                                                        | Acuan               |
| ----- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| P3-01 | Tulis research instructions dan registrasikan tepat tiga application tools | Intent/kedalaman adaptif; snippet sebagai bukti; tidak mengikuti instruksi web                        | FR-01–FR-07         |
| P3-02 | Runner riset dan boundary policy yang sama untuk headless/Studio           | Run ID/state baru per request; tools tidak berjalan tanpa scope; hasil model tidak melewati finalizer | ARCH §4             |
| P3-03 | Klarifikasi stateless, no-evidence behavior, dan bahasa laporan            | Pertanyaan mengakhiri request; request baru memerlukan topik lengkap; bahasa mengikuti input/override | FR-11, FR-12, FR-17 |
| P3-04 | Offline behavior tests dengan scripted model dan search fixtures           | Tool sequence/status dapat diperiksa; tests tidak membutuhkan API key; sumber antar-run terisolasi    | EVAL-01–EVAL-03     |

**Pemeriksaan:** fake-model behavior cases faktual/eksploratif/komparatif, ambiguity tanpa search, no-result, bahasa, prompt injection, dan isolated runs.

**Deliverable/review:** alur riset bounded bekerja dengan fixtures. Live API tidak diperlukan pada fase ini.

## 6. Fase 4 — Report quality dan status final

**Dependency:** Fase 3 di-merge.

| Task  | Pekerjaan                                                | Syarat selesai                                                                                                       | Acuan                        |
| ----- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| P4-01 | Lengkapi parser/validator Markdown dan citation matching | Inline/reference/autolink/bare URL diperiksa; sumber asing ditolak; negative control gagal sebagaimana mestinya      | FR-08, EVAL-04               |
| P4-02 | Implementasi satu revisi draft dalam budget yang sama    | Draft awal invalid tidak menulis; revisi valid dapat berhasil; revisi invalid kedua menghentikan run                 | FR-18                        |
| P4-03 | Finalizer dan safe error mapping untuk seluruh status    | Completed hanya dari verified state; reportPath/sources tidak dipercaya dari model; provider error bukan no-evidence | PRD §6                       |
| P4-04 | Budget/cancellation dan end-to-end offline regression    | Hasil terlambat ditolak; setelah terminal tidak ada side effect baru; write/read evidence cocok                      | FR-09, FR-10, FR-13, EVAL-05 |

**Pemeriksaan:** unknown source ID/URL, citation tanpa pasangan, malformed final output, satu revisi berhasil/gagal/kehabisan budget, provider down vs empty search, file berubah/hilang, dan cancellation.

Tambahkan scripted trace tiga search → write → read → final. Uji juga bahwa kesempatan revisi tidak menjamin tambahan turns di luar limit. Jangan menaikkan budget diam-diam agar test lulus.

**Deliverable/review:** semua status dapat diperiksa deterministik; laporan hanya dinyatakan berhasil setelah round-trip sah.

## 7. Fase 5 — Docker dan Anvia Studio

**Dependency:** Fase 4 di-merge.

| Task  | Pekerjaan                                                              | Syarat selesai                                                                                                                | Acuan                 |
| ----- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| P5-01 | Dockerfile, Compose v2, bind mount, non-root, dan resource limits      | Build/start lokal; host publish loopback; report directory writable; tidak ada Docker socket                                  | ARCH §9, V-04         |
| P5-02 | Integrasikan objek runtime ke Studio dengan policy dan state yang sama | UI terbuka; fake-run policies tetap bekerja; history sesi tidak mencemari request independen; direct tools tidak bypass scope | FR-14, V-01, V-04     |
| P5-03 | Acceptance filesystem melalui container dan host                       | Report fixture terlihat di ./reports; read-back cocok; tetap tersedia setelah container dibuat ulang                          | FR-09, FR-10, EVAL-05 |
| P5-04 | Petunjuk Windows/WSL2 dan permission troubleshooting                   | Perintah memakai WSL2; port internal/host jelas; laporan/credential tidak masuk Git                                           | DoD setup             |

**Pemeriksaan:** compose config, image build, container startup, UI availability, bind-mount round-trip, non-root/permissions, dan isolated fake runs. Gunakan fake dependencies pada test harness yang terpisah dari runtime live.

Fase ini tidak menambahkan live research task. Membuka Studio tidak berarti harus menjalankan LLM/Tavily. Live research melalui Studio dilaksanakan pada LIVE-03.

**Deliverable/review:** runtime dapat diuji di Docker Desktop/WSL2 dan trace/debug surfaces tersedia.

## 8. Fase 6 — Evaluation dan final validation

**Dependency:** Fase 5 di-merge.

| Task    | Pekerjaan                                                     | Syarat selesai                                                                                                    | Acuan           |
| ------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------- |
| P6-01   | Suite executable @anvia/core/evals untuk lima mandatory cases | Status, source whitelist, file existence/round-trip, dan limits memiliki assertion kode                           | EVAL-01–EVAL-05 |
| P6-02   | Regression supporting cases dan quality rubric                | Bahasa, revisi, cross-run isolation, prompt injection, budget/error paths diperiksa; failures membuat suite gagal | PRD §7          |
| LIVE-03 | Satu live research end-to-end melalui Studio                  | Search nyata; report valid; read-back; host file; final status; trace dapat diinspeksi                            | DoD M1          |
| P6-03   | README setup/testing, hasil eval, limitations, dan review DoD | Langkah reproduce jelas; status pass/fail/blocked jujur; tokens tidak tersedia diberi tanda                       | FR-15, DoD M1   |

**Pemeriksaan:** seluruh check offline yang tersedia, image/Compose acceptance, lima eval cases, supporting cases kritis, serta LIVE-03. Review manual kualitas satu report live meliputi relevansi, citation support, bahasa, dan batasan snippet.

**Deliverable/review:** M1 dapat direproduksi; owner memutuskan kelulusan/merge akhir.

## 9. Daftar live tests yang diizinkan

| ID      | Fase | Operasi                                                        | Batas otomatis per task                                                  |
| ------- | ---- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| LIVE-01 | 1    | Gateway LLM + satu tool fixture lokal tanpa side effect        | 1 agent run; maxTurns maksimum 2; timeout maksimum 60 detik; retries off |
| LIVE-02 | 2    | Query Tavily: “Redis official documentation”                   | 1 provider search; maksimum 5 hasil; tanpa LLM                           |
| LIVE-03 | 6    | “Research tentang apa itu Redis dan fungsinya.” melalui Studio | 1 research run dalam semua batas PRD; tanpa retries                      |

Satu run dapat berisi beberapa HTTP/model calls; catat jumlah aktual. Batas otomatis bukan kuota panggilan gratis, dan tidak meliputi automatic rerun setelah kegagalan.

Live test hanya berjalan dengan opt-in environment `ALLOW_LIVE_TESTS=true`, case ID eksplisit, dan kredensial lokal yang sesuai. Default command tidak memanggil layanan eksternal. Penggunaan API oleh research agent saat pengguna sengaja menjalankan riset bukan background test otomatis.

Jika kredensial, akses gateway, atau akses UI tidak tersedia, catat `blocked`; jangan meminta pengguna menaruh API key pada chat/PR. Test code dan instruksi tetap disiapkan. Tambahan run di luar daftar/batas ini perlu instruksi pengguna baru.

Bukti hasil: task ID, waktu, endpoint/model tanpa secret, command/mekanisme invocation, run ID, outcome, jumlah model/search calls, usage yang tersedia, durasi, dan path laporan relatif bila completed.

## 10. Kontrak perintah yang akan dibuat

**Perintah ini adalah target implementasi, belum tersedia pada baseline dokumentasi.** Tambahkan script ketika functionality-nya benar-benar ada; jangan memakai script kosong atau pass palsu.

| Perintah                          | Tersedia mulai             | Fungsi                                              |
| --------------------------------- | -------------------------- | --------------------------------------------------- |
| pnpm run lint                     | Fase 1                     | Lint kode/config                                    |
| pnpm run format:check             | Fase 1                     | Pemeriksaan format termasuk dokumen                 |
| pnpm run typecheck                | Fase 1                     | TypeScript tanpa emit                               |
| pnpm run build                    | Fase 1                     | Build fondasi; belum entry point aplikasi riset     |
| pnpm run test:unit                | Fase 1                     | Unit tests offline                                  |
| pnpm run test:integration         | Fase 2                     | Integration tests offline/temp filesystem           |
| pnpm run eval:offline             | Fase 3, dilengkapi Fase 6  | Agent behavior/eval fixtures tanpa API asli         |
| pnpm run check                    | Fase 1, diperluas bertahap | Seluruh checks offline yang sudah diimplementasikan |
| pnpm run test:live --case LIVE-01 | Fase 1                     | Live runner dengan case filter dan guard kuota      |
| pnpm run studio                   | Fase 5                     | Development Studio                                  |
| docker compose up --build         | Fase 5                     | Runtime lokal dan bind mount                        |

Runner live harus menolak invocation tanpa case ID/opt-in. Tambahkan LIVE-02/03 hanya pada fase pemiliknya. README mencerminkan perintah yang sudah tersedia, bukan seluruh target masa depan.

## 11. Bukti handoff setiap fase

Dalam PLAN/CONTEXT dan PR, tulis:

1. Requirement/task yang diselesaikan dan perubahan perilakunya.
2. Command/check yang benar-benar dijalankan dan hasilnya.
3. Test yang belum dijalankan beserta alasan; blocked tidak dihitung pass.
4. Bukti live test jika ada, tanpa kredensial.
5. Keterbatasan atau keputusan implementasi yang material.
6. Branch, draft PR, dan titik lanjut setelah owner review/merge.

Jangan menandai M1 selesai hanya karena agent menghasilkan teks laporan atau karena seluruh checkbox dokumentasi sudah terisi.
