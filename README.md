# Simple Contextual Research Agent

Proof of concept research assistant personal berbasis TypeScript, Anvia SDK v1, dan Tavily. Berikan topik dalam bahasa sehari-hari; agent menentukan kebutuhan riset, mencari bukti melalui snippet web, lalu menyimpan laporan Markdown dengan citation yang dapat ditelusuri.

Tujuan repository ini adalah membuktikan satu alur riset yang sederhana, bounded, dan dapat diuji—bukan crawler, chatbot dengan memory, atau platform multi-agent.

## Yang dapat dilakukan

- **Faktual:** “Apa itu Redis dan apa fungsinya?”
- **Eksploratif:** “Research tentang Redis.” Agent membahas konsep, ekosistem, dan use case, bukan otomatis membuat perbandingan.
- **Komparatif:** “Bandingkan Redis dan Memcached untuk cache aplikasi.”
- **Klarifikasi:** topik ambigu seperti “Research Apple” diakhiri dengan pertanyaan; pengguna mengirim ulang permintaan lengkap sebagai run baru.

Laporan mengikuti bahasa permintaan kecuali pengguna meminta bahasa lain. Setiap run berdiri sendiri: tidak ada database, RAG, conversation memory, atau state sumber yang dibagi antar-run.

## Status dan batas verifikasi

Fase 1–3 sudah masuk `master` melalui [PR #2](https://github.com/hardzal/simple-agent-research/pull/2). Fase 4 melengkapi validasi Markdown/citation, revisi draft dalam budget yang sama, dan pemetaan status/error pada runtime programatik serta route Studio in-process. Status review dan bukti checks terbaru selalu ada di [CONTEXT](docs/CONTEXT.md).

Yang tersedia adalah **API programatik**, tiga application tools, filesystem report store, dan test suite offline. Belum tersedia command `pnpm run studio`, server/UI Studio produk, Dockerfile, atau Docker Compose; integrasi tersebut milik Fase 5. Suite acceptance M1 dan LIVE-03 milik Fase 6. Jangan menganggap M1 atau integrasi riset end-to-end dengan provider nyata sudah selesai.

## Alur dan komponen

```text
Permintaan pengguna
  → validasi input dan scope run baru
  → research agent + model kompatibel OpenAI
      → webSearch: Tavily snippets + registry sumber per-run
      → writeFile: validasi Markdown/citation → publish laporan
      → readFile: verifikasi byte/hash dan isi laporan
  → finalizer aplikasi → ResearchResponse + safe metrics
```

Hanya ada tiga application tools:

| Tool        | Tanggung jawab                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `webSearch` | Mengambil maksimum lima hasil per pencarian; URL dinormalisasi dan diberi ID `S1`, `S2`, dan seterusnya dalam run itu. |
| `writeFile` | Menolak draft tidak valid sebelum I/O; path laporan dibuat aplikasi, bukan dipilih model.                              |
| `readFile`  | Membaca hanya laporan milik run aktif dan memverifikasi kembali byte/hash serta citation-nya.                          |

Pencarian tidak meminta raw page atau jawaban generatif Tavily. Isi web diperlakukan sebagai bukti yang tidak tepercaya, bukan instruksi. Registry/citation checks memeriksa provenance dan struktur, **bukan membuktikan setiap klaim benar atau didukung secara semantik**; keterbatasan snippet tetap harus dinyatakan pada laporan.

## Mulai dari checks offline

Prasyarat: Node.js 24 LTS (`>=24.14.0 <25`) dan pnpm `11.22.0`, sesuai `engines` dan `packageManager`. Lingkungan development utama adalah Windows/Git Bash atau WSL2; Docker Desktop diperlukan nanti pada Fase 5.

```sh
pnpm install --frozen-lockfile
pnpm run check
```

Instalasi memerlukan registry atau cache pnpm lengkap. Checks tidak memerlukan API key, tidak membaca `.env`, dan tidak memanggil provider nyata: model/search diganti fixture, `fetch` tanpa mock diblokir, dan integration tests memakai direktori sementara yang dibersihkan.

| Perintah                    | Pemeriksaan                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `pnpm run check`            | Seluruh gate offline di bawah, berurutan.                       |
| `pnpm run format:check`     | Format Prettier; `pnpm run format` untuk memperbaikinya.        |
| `pnpm run lint`             | ESLint.                                                         |
| `pnpm run typecheck`        | TypeScript strict.                                              |
| `pnpm run build`            | Menghasilkan modul JavaScript di `dist/`, bukan CLI/server UI.  |
| `pnpm run test:unit`        | Config, provider adapter, parser/validator, dan scope guards.   |
| `pnpm run test:integration` | Filesystem, tools, runtime, dan route Studio dengan fake model. |
| `pnpm run eval:offline`     | Scripted behavior cases; bukan penilaian kualitas LLM live.     |

Gunakan hanya pnpm dan `pnpm-lock.yaml`; jangan membuat lockfile package manager lain.

## Menggunakan runtime programatik

`src/index.ts` / `dist/index.js` mengekspor `parseConfig`, `createResearchRuntime`, `createResearchAgent`, `createScopedStudio`, dan tipe `ResearchResponse`.

Contoh berikut memakai **provider nyata dan dapat menimbulkan biaya**. Ini penggunaan manual, bukan bagian dari checks offline atau verifikasi Fase 4. Jangan menjalankannya sebagai automatic live debugging.

1. Salin `.env.example` menjadi `.env` jika file lokal belum ada; jangan menimpa konfigurasi yang sudah ada.
2. Isi `OPENAI_API_KEY` dan `TAVILY_API_KEY` secara lokal. Jangan commit atau mencetak nilainya.
3. Untuk run lokal, ubah `REPORTS_DIR` menjadi `./reports`; `/app/reports` pada contoh disiapkan untuk container nanti.
4. Jalankan build, kemudian contoh ini melalui Git Bash/WSL:

```sh
pnpm run build
node --env-file=.env --input-type=module -e '
import { parseConfig, createResearchRuntime } from "./dist/index.js";
const runtime = await createResearchRuntime(parseConfig(process.env));
const response = await runtime.run("Research tentang apa itu Redis dan fungsinya.");
console.log(JSON.stringify(response, null, 2));
'
```

Konstruksi runtime tidak memanggil model/search dan tidak memuat `.env` sendiri; contoh memakai mekanisme `--env-file` Node. Run sebenarnya dimulai pada `runtime.run(...)`. Untuk pembatalan, teruskan `{ abortSignal: controller.signal }` sebagai argumen kedua. Input kosong, terlalu panjang, atau envelope tidak valid ditolak sebelum run/provider; exception ini bukan `needs_clarification`.

Untuk fixture offline, `createResearchRuntime(config, overrides)` menerima `model`, `searchProvider`, `reportStore`, dan `logger`. Contoh yang benar-benar dieksekusi dalam tests ada di [tests/fixtures/research.ts](tests/fixtures/research.ts).

### Hasil run

Semua response aplikasi memiliki `runId`, `status`, dan `message`. Hanya `completed` memiliki `reportPath` serta `sources` yang dibangun dari state tervalidasi, bukan dipercaya dari klaim model.

| Status                  | Makna                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `completed`             | Search sukses, laporan valid ditulis, dan read-back berhasil; path serta sumber laporan disertakan. |
| `needs_clarification`   | Ambiguitas perlu dijawab pengguna; tidak ada tool yang dijalankan.                                  |
| `insufficient_evidence` | Search berjalan sukses tetapi bukti tidak memadai; tidak ada laporan dibuat.                        |
| `budget_exceeded`       | Kuota search/model turns atau deadline habis; tidak ada path laporan yang diklaim terverifikasi.    |
| `failed`                | Provider/I/O/validasi/final decision gagal, atau pengguna membatalkan run; tidak ada path/sources.  |

File yang sempat ditulis sebelum kegagalan read-back/deadline dapat tetap ada di reports root; keberadaannya **bukan bukti completed**. Runtime tidak menghapus artefak pengguna atau mengklaim file tersebut terverifikasi. Finalizer tidak melakukan filesystem read tambahan tersembunyi.

Untuk integrasi Studio, daftarkan `runtime.agent` melalui `createScopedStudio`, bukan `new Studio(...)` default: konfigurasi default SDK dapat mengkloning agent dan melewati scoped boundary. Session/trace persistence dinonaktifkan pada factory saat ini. Pada streaming, delta/turn events adalah draft; hanya terminal response JSON yang sudah melewati policy menjadi hasil aplikasi.

## Konfigurasi dan budget

Default provider: gateway kompatibel OpenAI `https://gateway.devscale.id/v1`, model `gpt-6-luna`, API mode Chat Completions (`LLM_API=chat`), serta Tavily Search API. Tidak ada fallback endpoint/model atau automatic retry untuk menyembunyikan kegagalan integrasi.

| Batas default         | Nilai                           |
| --------------------- | ------------------------------- |
| Search per run        | 3 calls, termasuk yang gagal    |
| Model turns per run   | 5 attempts, termasuk yang gagal |
| Deadline seluruh run  | 60 detik                        |
| Revisi draft          | 1 revisi setelah draft ditolak  |
| Successful write/read | Masing-masing 1 per run         |
| Tool concurrency      | 1                               |
| Hasil per search      | Maksimum 5                      |
| Ukuran laporan UTF-8  | 65.536 byte                     |

Semua langkah, termasuk revisi dan read-back, memakai budget run awal. Penolakan draft kedua menghentikan run; I/O failure bukan kesempatan revisi konten. Nilai config dan batas input/query/snippet tersedia di [.env.example](.env.example) serta [ARCHITECTURE](docs/ARCHITECTURE.md). Ini batas operasi/waktu/ukuran, **bukan jaminan token atau biaya moneter**.

Laporan disimpan sebagai `<REPORTS_DIR>/<runId>/report.md`. Report store menolak traversal/symlink/junction, tidak menimpa file yang ada, dan mempublikasikan file dengan hardlink atomik. Reports root harus trusted terhadap concurrent hostile rename; detail batas filesystem ada di ARCHITECTURE. Metrics berisi counters/status dan kategori error aman, bukan secret, raw provider response, atau teks laporan. Usage token yang tidak dilaporkan provider dicatat `null`, bukan dikarang menjadi nol.

## Guarded live tests

Live probes terpisah dari penggunaan runtime dan ordinary checks. Wajib izin sesuai fase, `ALLOW_LIVE_TESTS=true`, kredensial lokal, dan case ID eksplisit. Jangan automatic rerun, menambah live debugging, atau mengganti model/endpoint di luar [batas PLAN](docs/PLAN.md#9-daftar-live-tests-yang-diizinkan).

```sh
ALLOW_LIVE_TESTS=true pnpm exec node --env-file=.env --import tsx scripts/live.ts --case LIVE-01
ALLOW_LIVE_TESTS=true pnpm exec node --env-file=.env --import tsx scripts/live.ts --case LIVE-02
```

- **LIVE-01:** compatibility probe maksimum dua model calls dan satu tool sintetis tanpa side effect; exact-match tool-result replay. Tool probe bukan application tool keempat.
- **LIVE-02:** satu query publik `Redis official documentation`, maksimum lima hasil, tanpa LLM/retry.
- **LIVE-03:** riset end-to-end; baru dijalankan pada Fase 6 sesuai PLAN, bukan saat ini.

LIVE-01/02 memiliki bukti terdahulu di CONTEXT; keduanya tidak dijalankan ulang pada Fase 4. Bukti probe bukan bukti kualitas laporan, UI, bind mount Docker, atau acceptance M1 lengkap.

## Peta repository dan dokumen

| Lokasi / dokumen                                | Pemilik tanggung jawab                                                |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `src/agent/`                                    | Definisi research agent, instructions, dan binding policy/metrics.    |
| `src/application/`                              | Scope, lifecycle, runtime programatik, finalization, dan Studio seam. |
| `src/tools/`                                    | Tiga tools, kuota, revisi, serta completion guards.                   |
| `src/services/`                                 | Source registry, report validation/store, dan safe metrics.           |
| `src/providers/`, `src/config/`, `src/schemas/` | Adapter provider, config, serta kontrak typed.                        |
| `tests/`, `scripts/live.ts`                     | Offline fixtures/suites dan guarded live probes yang terpisah.        |
| [PRD](docs/PRD.md)                              | Scope produk, perilaku, budget, acceptance criteria.                  |
| [ARCHITECTURE](docs/ARCHITECTURE.md)            | Kontrak dan mekanisme teknis.                                         |
| [PLAN](docs/PLAN.md)                            | Task, dependency, gates, serta batas live tests per fase.             |
| [CONTEXT](docs/CONTEXT.md)                      | State, evidence, blockers, dan titik lanjut terbaru.                  |
| [AGENTS](AGENTS.md)                             | Workflow coding agent dan handoff.                                    |

Pengembangan berjalan satu branch per fase, **commit terpisah per fitur setelah checks terkait lulus**, lalu satu draft PR ke `master` ketika seluruh fase selesai. Review/merge dilakukan pemilik; fase berikutnya dimulai dari `master` yang sudah memuat fase sebelumnya.
