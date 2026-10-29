# Implementation Plan — Milestone 1

**Status:** Fase 1–5 merged melalui PR #2/#3/#4; Fase 6 offline verified, live acceptance blocked pada `phase/06-evaluation`

**Diperbarui:** 2026-10-28

**Requirement:** [PRD.md](PRD.md)

**Desain:** [ARCHITECTURE.md](ARCHITECTURE.md)

**Workflow:** [AGENTS.md](../AGENTS.md)

**State dan bukti terbaru:** [CONTEXT.md](CONTEXT.md)

## 1. Aturan pelaksanaan

Kerjakan satu fase aktif pada branch terpisah. Sesuai [AGENTS §6](../AGENTS.md#6-git-draft-pr-dan-titik-berhenti), buat commit terpisah setiap fitur atau perubahan koheren selesai dan pemeriksaan terkait lulus, termasuk tests serta dokumentasi yang relevan; jangan menunggu akhir fase untuk commit. Setelah seluruh task fase selesai, seluruh gate fase yang tersedia lulus, dan PLAN/CONTEXT diperbarui, push branch dan buat satu draft PR ke `master` yang berisi commit-commit tersebut. Hentikan pekerjaan setelah menyerahkan PR; review dan merge dilakukan pemilik proyek.

Pada instruksi lanjut, mulai dari `master` yang sudah memuat hasil fase sebelumnya. Jangan menumpuk implementasi fase berikutnya dalam PR yang masih menunggu review.

Dokumentasi awal menggunakan branch `docs/m1-agent-specifications`. Ini baseline spesifikasi, bukan bukti bahwa Fase 1 sudah dilaksanakan.

Status task: `planned` → `in_progress` → `verified`; gunakan `blocked` jika dependency atau acceptance belum terpenuhi. `verified offline` tidak berarti `verified live`. Fase yang lulus checks dapat berstatus `awaiting_review`; status `merged` hanya setelah merge benar-benar terjadi.

## 2. Peta fase

| Fase | Branch                        | Hasil                                                  | Status saat ini                  |
| ---- | ----------------------------- | ------------------------------------------------------ | -------------------------------- |
| 1    | `phase/01-project-foundation` | SDK/tooling/config dan compatibility probe             | merged melalui PR #2             |
| 2    | `phase/02-tools`              | Tiga tools, source registry, report store              | merged melalui PR #2             |
| 3    | `phase/03-agent-behavior`     | Alur riset adaptif dan instruksi agent                 | merged melalui PR #2             |
| 4    | `phase/04-report-validation`  | Validasi lengkap, revisi, dan status final             | merged melalui PR #3             |
| 5    | `phase/05-docker-studio`      | Docker Desktop/WSL2 dan Studio terintegrasi            | merged melalui PR #4             |
| 6    | `phase/06-evaluation`         | Regression suite, live E2E, dan dokumentasi penggunaan | blocked: LIVE-03 budget_exceeded |

Catatan riwayat: dependency dan bukti pada Fase 1–3 di bawah mencatat kondisi saat fase tersebut dikerjakan, termasuk pengecualian branch sebelum merge. Status publikasi terkini adalah tabel di atas: ketiganya sudah merged melalui PR #2.

### Ringkasan penyelesaian sampai Fase 6

| Task                 | Status implementasi/verifikasi saat ini            | Bukti utama                                                                                                      |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| P1-01–P1-03          | verified offline, merged                           | Config/provider/scope tests dan frozen install; CONTEXT §4                                                       |
| LIVE-01              | verified live historis, merged                     | Tool-result replay exact-match pada run terakhir; CONTEXT §4                                                     |
| P2-01–P2-03, LIVE-02 | verified offline + LIVE-02 passed historis, merged | Adapter/registry/tools/filesystem tests; CONTEXT §5                                                              |
| P3-01–P3-04          | verified offline, merged                           | Instructions/runtime/policy dan behavior fixtures; CONTEXT §7                                                    |
| P4-01–P4-04          | verified offline, merged                           | Validator/revisi/error/late-result regression; CONTEXT §8                                                        |
| P5-01–P5-04          | implementasi merged; verified offline/Podman       | UI, Compose, image, host round-trip/recreate; Docker Desktop/WSL2 belum diverifikasi; CONTEXT §11                |
| P6-01/P6-02          | verified offline, belum merged                     | `tests/research.evaluation.test.ts` dan `tests/research.behavior.test.ts`; mandatory 5/5 serta negative controls |
| LIVE-03              | runner tersedia; acceptance blocked                | Satu run failed `budget_exceeded`, tanpa laporan; CONTEXT §12                                                    |
| P6-03                | dokumentasi/review DoD tersedia, belum merged      | README, EVALUATION, PRD §9, dan CONTEXT §12                                                                      |

Seluruh task implementasi enam fase sudah tersedia, tetapi seluruh acceptance PRD/PLAN belum lulus. Tidak ada klaim M1 selesai hanya karena implementasi telah mencapai Fase 6. Sisa sebelum acceptance akhir: live E2E sukses dan review kualitas laporannya (perlu otorisasi baru), bukti Docker Desktop/WSL2 yang belum tersedia, serta review/merge Fase 6 oleh pemilik. Tidak ada live rerun otomatis dalam pembaruan dokumentasi ini.

## 3. Fase 1 — Project foundation

**Dependency:** PR dokumentasi telah direview dan di-merge; owner meminta memulai implementasi.

| Task    | Pekerjaan                                                                                                              | Syarat selesai                                                                                            | Acuan              |
| ------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------ |
| P1-01   | Inisialisasi Node.js 24/TypeScript strict dan pnpm; pin paket Anvia v1 yang kompatibel; simpan pnpm-lock.yaml          | Install reproducible; build/typecheck lulus; versi dan engines tercatat                                   | ARCH §1, V-01      |
| P1-02   | Spike SDK dengan fake model: scope run, lifecycle, streaming, Studio registration, cancellation, dan finalization seam | API nyata diverifikasi; dua run tidak berbagi state; adapter boundary minimal terpilih dan terdokumentasi | FR-13, FR-14, V-01 |
| P1-03   | Environment schema, provider factory, logger aman, test runner, lint/format scripts, .gitignore, .env.example          | Config invalid gagal jelas; offline tests tidak memerlukan secrets; runtime retries dinonaktifkan         | FR-15, ARCH §5     |
| LIVE-01 | Satu probe gateway/model dengan tool sintetis tanpa side effect                                                        | Tool-call → tool-result → final response bekerja; API mode dan usage tersedia/tidak tersedia dicatat      | V-02               |

Tool sintetis LIVE-01 hanya fixture compatibility test, bukan application tool keempat dalam research agent.

Status task: P1-01 verified offline (fresh install frozen lockfile dan full check); P1-02 verified offline untuk spike scope/SDK/Studio routes; P1-03 verified offline (config, provider, logger, dan guards). LIVE-01 verified: run terakhir completed dengan dua model calls, satu tool call, dan exact nonce match. Dua percobaan sebelumnya gagal validasi replay; pada percobaan diagnostik terbukti nonce diterima tetapi format tidak persis. Tool kini memberikan finalResponse siap salin tanpa melonggarkan assertion. Setiap tambahan live run mendapat otorisasi pengguna; tidak ada automatic rerun. Rincian hasil ada di CONTEXT. Commit Fase 1 `5f516eb` sudah tersedia di remote; belum memiliki PR khusus Fase 1 atau merge. Draft PR persiapan Fase 3 membawa fondasi ini melalui ancestry branch. Pengguna mengizinkan basis Fase 2 dan persiapan Fase 3 tanpa menunggu merge; lihat dependency fase terkait.

Keputusan spike Studio: factory scoped menonaktifkan session/trace stores untuk menghindari clone yang melewati adapter; buffered/streaming route terbukti offline. Kebutuhan debug/trace yang dapat diinspeksi dipenuhi pada Fase 5 melalui live tool/response JSONL dan metrics tanpa persistence/cloning; bukti UI/server ada di CONTEXT. Factory spike awal sendiri bukan bukti kelulusan UI/trace produk.

**Pemeriksaan:** build, typecheck, lint, format check, unit test config/state, fake SDK probe, dan LIVE-01. Uji scope dengan fake dependencies sebelum menggunakan API asli.

**Deliverable/review:** package/config/lockfile, hasil verifikasi SDK, hasil LIVE-01, dan keputusan binding runtime Studio. Jika gateway atau API binding belum berfungsi, laporkan blocker konkret; jangan memulai Fase 2 dengan asumsi dukungan sudah terbukti.

## 4. Fase 2 — Tools implementation

**Dependency:** Fase 1 telah diverifikasi. Atas instruksi pengguna, branch `phase/02-tools` dibuat langsung dari commit Fase 1 `5f516eb` tanpa menunggu merge; pengecualian basis branch ini tidak memperluas scope fase.

| Task    | Pekerjaan                                                                                          | Syarat selesai                                                                                | Acuan                     |
| ------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| P2-01   | SearchProvider interface, adapter Tavily, normalisasi hasil, source registry, dan webSearch schema | Limit lima hasil; duplikasi memakai ID sama; query/snippet dibatasi; empty/error dibedakan    | FR-04, FR-05, FR-08, V-03 |
| P2-02   | Report store dan validasi mekanis awal untuk writeFile/readFile                                    | Path aplikasi; validasi sebelum tulis; satu successful write/read; hash/byte round-trip cocok | FR-09, FR-10              |
| P2-03   | Counter/deadline bersama untuk handler dan scope test                                              | Kuota direservasi sebelum I/O; read-before-write, write kedua, path/symlink tidak sah ditolak | FR-13                     |
| LIVE-02 | Satu pencarian Tavily menggunakan query fixture publik                                             | Response dapat dinormalisasi; fields opsional ditangani; tidak ada kredensial di output       | V-03                      |

Validasi dasar di P2-02 harus sudah menolak sumber asing sebelum successful write. Fase 4 memperlengkap format, status, revisi, dan edge cases; tidak menunda semua proteksi sampai fase tersebut.

Status P2-01/P2-02/P2-03: verified offline melalui adapter/registry/validator unit tests serta temp-filesystem integration untuk quota/deadline, isolation, round-trip, tampering, traversal, symlink/junction, dan EACCES sintetis. LIVE-02 verified live dengan tepat satu provider call, lima hasil ternormalisasi, tanpa LLM/retry. Completion policy produk dan bind mount Docker belum diklaim.

**Pemeriksaan:** handler unit tests tanpa LLM, temp-filesystem integration, duplicate/unknown source tests, quota, timeout, symlink, permission failure, dan LIVE-02.

**Deliverable/review:** tools dapat dipanggil dan diuji independen dengan scope eksplisit; belum mengklaim seluruh perilaku riset selesai.

## 5. Fase 3 — Research agent behavior

**Dependency default:** Fase 2 di-merge. Atas instruksi pengguna 2026-10-27, branch `phase/03-agent-behavior` dibuat langsung dari `origin/phase/02-tools` pada `e425782`, tanpa menunggu merge. Pengecualian ini hanya mengubah basis/transisi branch, bukan status review/merge, requirement PRD, atau scope task fase berikutnya. Fase 1 dan 2 belum di-merge. Setelah checkpoint persiapan, pengguna meminta melanjutkan implementasi P3-01–P3-04 pada branch yang sama; draft PR #2 diperbarui, bukan dibuat ulang atau di-merge otomatis.

| Task  | Pekerjaan                                                                  | Syarat selesai                                                                                        | Acuan               |
| ----- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| P3-01 | Tulis research instructions dan registrasikan tepat tiga application tools | Intent/kedalaman adaptif; snippet sebagai bukti; tidak mengikuti instruksi web                        | FR-01–FR-07         |
| P3-02 | Runner riset dan boundary policy yang sama untuk headless/Studio           | Run ID/state baru per request; tools tidak berjalan tanpa scope; hasil model tidak melewati finalizer | ARCH §4             |
| P3-03 | Klarifikasi stateless, no-evidence behavior, dan bahasa laporan            | Pertanyaan mengakhiri request; request baru memerlukan topik lengkap; bahasa mengikuti input/override | FR-11, FR-12, FR-17 |
| P3-04 | Offline behavior tests dengan scripted model dan search fixtures           | Tool sequence/status dapat diperiksa; tests tidak membutuhkan API key; sumber antar-run terisolasi    | EVAL-01–EVAL-03     |

**Persiapan transisi verified:** dua temuan review Fase 2 diperbaiki pada branch Fase 3: ekstraksi URL mempertahankan kurung seimbang pada sumber sah, dan middleware SDK menghitung tool attempt sebelum validasi input tanpa double-count pada handler. Regression tests diuji RED → GREEN; `pnpm run check` lulus dengan 107 unit tests dan 12 integration tests. LIVE-01/02 tidak dijalankan ulang. Bukti dan status publikasi ada di CONTEXT.

**Status task:** P3-01/P3-02/P3-03/P3-04 `verified` secara offline. Factory/instructions, runtime programatik, finalization seam, request stateless, metrics, dan scripted behavior suite tersedia. `pnpm run check` lulus: 107 unit tests, 32 integration/boundary tests, dan 12 offline behavior cases. Built ESM smoke klarifikasi lulus dengan satu fake model call, nol provider call, serta cleanup tempfile. Rencana rinci dan acceptance matrix: [phase-03-agent-behavior.md](plans/2026-10-27-phase-03-agent-behavior.md).

**Batas verifikasi saat handoff Fase 3 (historis):** fixtures membuktikan wiring/enforcement dan pelestarian bahasa keluaran scripted, bukan kemampuan semantik LLM live. Suite Anvia eval lengkap kemudian tersedia Fase 6. Fase 4 melengkapi parser/citation, revisi end-to-end, pemetaan exception menjadi status aplikasi, dan edge cases deadline/cancellation. Pada snapshot Fase 3, invalid request ditolak sebelum run; exception transport/turn/deadline dapat tetap reject alih-alih menjadi response status. Saat handoff Fase 3 tidak ada live API, UI/server, Docker, atau klaim DoD M1 selesai; status terkini ada di ringkasan §2.

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

**Status task Fase 4:** P4-01–P4-04 verified offline. Validator memakai token Markdown untuk struktur, citation ID, dan pasangan URL; satu revisi tidak mereset scope/budget; terminal response dan safe error mapping berlaku pada generation/stream/route Studio. Aplikasi membatasi model attempts sendiri sebelum request, menolak late result, dan membersihkan stream yang dibatalkan/ditinggalkan. Trace tiga search → write/read → final terbukti dalam lima model attempts tanpa menaikkan budget. `pnpm run check` setelah follow-up review lulus: 116 unit, 52 integration/boundary, dan 12 scripted behavior cases. Built ESM smoke lulus dengan fake model tanpa network. README menjelaskan tujuan repo, runtime usage, status, budget, dan batas verifikasi. Catatan publikasi lama sudah terselesaikan: follow-up `textStream` ikut merged melalui PR #3 pada `476821c`. Bukti historis ada di [CONTEXT](CONTEXT.md#8-bukti-implementasi-fase-4).

## 7. Fase 5 — Docker dan Anvia Studio

**Dependency:** Terpenuhi: `origin/master` pada `476821c` (merge PR #3), `3fa927b` ancestor terverifikasi melalui fetch. Branch Fase 5 dimulai dari baseline tersebut.

| Task  | Pekerjaan                                                              | Syarat selesai                                                                                                                | Acuan                 |
| ----- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| P5-01 | Dockerfile, Compose v2, bind mount, non-root, dan resource limits      | Build/start lokal; host publish loopback; report directory writable; tidak ada Docker socket                                  | ARCH §9, V-04         |
| P5-02 | Integrasikan objek runtime ke Studio dengan policy dan state yang sama | UI terbuka; fake-run policies tetap bekerja; history sesi tidak mencemari request independen; direct tools tidak bypass scope | FR-14, V-01, V-04     |
| P5-03 | Acceptance filesystem melalui container dan host                       | Report fixture terlihat di ./reports; read-back cocok; tetap tersedia setelah container dibuat ulang                          | FR-09, FR-10, EVAL-05 |
| P5-04 | Petunjuk Windows/WSL2 dan permission troubleshooting                   | Perintah memakai WSL2; port internal/host jelas; laporan/credential tidak masuk Git                                           | DoD setup             |

**Pemeriksaan:** compose config, image build, container startup, UI availability, bind-mount round-trip, non-root/permissions, dan isolated fake runs. Gunakan fake dependencies pada test harness yang terpisah dari runtime live.

Fase ini tidak menambahkan live research task. Membuka Studio tidak berarti harus menjalankan LLM/Tavily. Live research melalui Studio dilaksanakan pada LIVE-03.

**Deliverable/review:** runtime dapat diuji di Docker Desktop/WSL2 dan trace/debug surfaces tersedia.

**Status P5-01–P5-04:** verified offline dan melalui Podman 5.6.2; bukan verifikasi Docker Desktop. Image multi-stage `node:24.14.0-bookworm-slim` berhasil dibangun. Validasi Compose melalui provider Docker Compose v5.0.0 lulus tanpa membaca `.env`. Container produksi berhasil melayani UI; harness fake research melalui HTTP Studio membuktikan non-root, root read-only, CPU/memory limit, publish loopback, host/container byte equality dan persistensi setelah recreate. Runtime scoped yang sama dipakai, history tidak mencemari request, direct tools ditolak, dan tool/terminal debug events tersedia tanpa clone/persistence. `pnpm run check`: 128 unit/server, 52 integration/boundary, 12 offline behavior cases lulus setelah follow-up default bind standalone loopback. Compose up/recreate/healthy/down dan UI browser juga lulus dengan override environment fixture; Docker Desktop/WSL2 belum diuji. Panduan tersedia di [CONTAINERS](CONTAINERS.md). Tidak ada LIVE-01/02/03 atau API asli. Bukti dan keterbatasan di [CONTEXT](CONTEXT.md#11-bukti-fase-5).

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

**Status P6-01:** verified. `@anvia/core/evals@1.17.1` menjalankan lima mandatory cases melalui `runEvalSuite`: 5/5 case dan 10/10 metric outcomes pass. Enam wrapper tests mencakup status/citation negative controls yang tetap gagal walau supporting pass, target/metric error, serta missing/incomplete mandatory results. `eval:offline` menolak file suite yang tidak ditemukan.

**Status P6-02:** verified offline. Regression bahasa/revisi/isolation/injection/budget/filesystem tetap lulus, ditambah fixture-quality feedback tanpa paid judge. Word count bukan hard gate tunggal. Rubric manual relevance/language/citation support di EVALUATION; kualitas laporan live belum dapat dinilai.

**Status LIVE-03:** blocked. Satu run yang diotorisasi telah dipakai pada `2026-10-28T08:42:08.691Z`, final status `budget_exceeded`, tanpa report/success trace. Model attempts 2, search attempts 1, successful write/read 0/0, token usage unavailable. Tidak ada rerun, fallback, atau budget increase. Evidence dan batas diagnosis di CONTEXT §12. Ini bukan pass/skipped-as-pass; perlu instruksi/otorisasi baru sebelum live tambahan.

**Status P6-03:** verified untuk dokumentasi dan review DoD. README/EVALUATION/CONTEXT memisahkan offline pass, Podman acceptance, LIVE-03 failed, kualitas live blocked, dan Docker Desktop/WSL2 belum diverifikasi. M1 belum diterima; branch dipertahankan lokal karena live gate belum lulus. Tidak membuat PR seolah fase selesai atau menandai awaiting_review. Autentikasi API/browser GitHub juga belum tersedia.

## 9. Daftar live tests yang diizinkan

| ID      | Fase                     | Operasi                                                        | Batas otomatis per task                                                                     |
| ------- | ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| LIVE-01 | 1                        | Gateway LLM + satu tool fixture lokal tanpa side effect        | 1 agent run; maxTurns maksimum 2; timeout maksimum 60 detik; retries off                    |
| LIVE-02 | 2                        | Query Tavily: “Redis official documentation”                   | 1 provider search; maksimum 5 hasil; tanpa LLM                                              |
| LIVE-03 | 6 / follow-up acceptance | “Research tentang apa itu Redis dan fungsinya.” melalui Studio | 1 research run per otorisasi; maksimum 180 detik, 5 model attempts, 3 search; tanpa retries |

Follow-up acceptance saat ini mendapat otorisasi pengguna untuk satu LIVE-03 tambahan dengan `MAX_EXECUTION_MS=180000`; ini perubahan eksplisit batas waktu PRD §5, bukan rerun otomatis atau penghapusan hasil gagal terdahulu. Guard maksimum 180 detik memiliki regression batas atas serta mencatat konfigurasi efektif pada evidence. LIVE-01 tetap maksimum 60 detik.

Satu run dapat berisi beberapa HTTP/model calls; catat jumlah aktual. Batas otomatis bukan kuota panggilan gratis, dan tidak meliputi automatic rerun setelah kegagalan.

Live test hanya berjalan dengan opt-in environment `ALLOW_LIVE_TESTS=true`, case ID eksplisit, dan kredensial lokal yang sesuai. Default command tidak memanggil layanan eksternal. Penggunaan API oleh research agent saat pengguna sengaja menjalankan riset bukan background test otomatis.

Jika kredensial, akses gateway, atau akses UI tidak tersedia, catat `blocked`; jangan meminta pengguna menaruh API key pada chat/PR. Test code dan instruksi tetap disiapkan. Tambahan run di luar daftar/batas ini perlu instruksi pengguna baru.

Bukti hasil: task ID, waktu, endpoint/model tanpa secret, command/mekanisme invocation, run ID, outcome, jumlah model/search calls, usage yang tersedia, durasi, dan path laporan relatif bila completed.

## 10. Perintah yang tersedia pada Fase 6

Script berikut sudah tersedia di `package.json`, kecuali `docker compose` yang merupakan command engine terhadap `compose.yaml`. Seluruhnya kini memiliki implementasi; baseline dokumentasi dahulu belum menyediakannya. Ordinary `check` tidak menjalankan live probes atau acceptance container.

| Perintah                          | Tersedia mulai             | Fungsi                                                                                 |
| --------------------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| pnpm run lint                     | Fase 1                     | Lint kode/config                                                                       |
| pnpm run format:check             | Fase 1                     | Pemeriksaan format termasuk dokumen                                                    |
| pnpm run typecheck                | Fase 1                     | TypeScript tanpa emit                                                                  |
| pnpm run build                    | Fase 1                     | Build modul termasuk entry point programatik riset                                     |
| pnpm run test:unit                | Fase 1                     | Unit tests offline                                                                     |
| pnpm run test:integration         | Fase 2                     | Integration tests offline/temp filesystem                                              |
| pnpm run eval:offline             | Fase 3, dilengkapi Fase 6  | 12 behavior + 6 SDK wrapper tests; mandatory EVAL-01–05 dan negative controls          |
| pnpm run check                    | Fase 1, diperluas bertahap | Seluruh checks offline yang sudah diimplementasikan                                    |
| pnpm run test:live --case LIVE-01 | Fase 1                     | Live runner dengan case filter dan guard kuota                                         |
| pnpm run test:live --case LIVE-02 | Fase 2                     | Satu Tavily search, tanpa model; opt-in wajib                                          |
| pnpm run test:live --case LIVE-03 | Fase 6                     | Satu riset HTTP Studio, host verification, dan safe evidence; opt-in wajib             |
| pnpm run studio                   | Fase 5                     | Development Studio                                                                     |
| pnpm run test:container           | Fase 5                     | Acceptance image/UI dan fake research dengan host round-trip/recreate; engine terpisah |
| docker compose up --build         | Fase 5                     | Runtime lokal dan bind mount                                                           |

Runner live menolak invocation tanpa case ID/opt-in; LIVE-01/02/03 sudah tersedia. `test:live` tidak otomatis memuat `.env`; contoh pemuatan environment yang aman ada di README/EVALUATION. Script `studio` memuat `.env` dan mengirim prompt dapat memanggil API berbayar. Tersedianya command bukan otorisasi mengulang live test atau bukti keberhasilan semua case.

## 11. Bukti handoff setiap fase

Dalam PLAN/CONTEXT dan PR, tulis:

1. Requirement/task yang diselesaikan dan perubahan perilakunya.
2. Command/check yang benar-benar dijalankan dan hasilnya.
3. Test yang belum dijalankan beserta alasan; blocked tidak dihitung pass.
4. Bukti live test jika ada, tanpa kredensial.
5. Keterbatasan atau keputusan implementasi yang material.
6. Branch, draft PR, dan titik lanjut setelah owner review/merge.

Jangan menandai M1 selesai hanya karena agent menghasilkan teks laporan atau karena seluruh checkbox dokumentasi sudah terisi.
