# Panduan developer

README berisi [cara mencoba aplikasi](../README.md). Dokumen ini menjelaskan API programatik, cara kerja runtime, konfigurasi, debugging, dan pemeriksaan kode. Untuk container gunakan [CONTAINERS](CONTAINERS.md); untuk evaluasi dan live acceptance gunakan [EVALUATION](EVALUATION.md).

## Menyiapkan dan memeriksa kode

Gunakan Node.js 24 (`>=24.14.0 <25`) dan pnpm `11.22.0`, sesuai `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm run check
```

Instalasi memerlukan registry atau cache pnpm lengkap. Ordinary checks tidak memerlukan API key, tidak membaca `.env`, dan tidak memanggil provider nyata. Model/search memakai fake atau scripted fixtures; fetch provider tanpa mock diblokir. Integration tests menggunakan direktori sementara yang dibersihkan.

| Perintah                    | Kegunaan                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `pnpm run check`            | Menjalankan seluruh pemeriksaan offline di bawah secara berurutan                     |
| `pnpm run format:check`     | Memeriksa format; gunakan `pnpm run format` untuk memperbaikinya                      |
| `pnpm run lint`             | Memeriksa kode dengan ESLint                                                          |
| `pnpm run typecheck`        | Memeriksa tipe TypeScript tanpa menghasilkan file                                     |
| `pnpm run build`            | Menghasilkan modul JavaScript dan entrypoint Studio di `dist/`                        |
| `pnpm run test:unit`        | Menguji config, adapter, validator, scope, dan server dengan fake dependencies        |
| `pnpm run test:integration` | Menguji filesystem, tools, runtime, dan boundary Studio                               |
| `pnpm run eval:offline`     | Menjalankan behavior fixtures dan SDK mandatory evaluations beserta negative controls |

Gunakan `pnpm-lock.yaml` sebagai satu-satunya lockfile. `check` tidak mencakup live probes atau container acceptance. Petunjuk keduanya ada di EVALUATION dan CONTAINERS.

## Cara kerja runtime

```text
Permintaan pengguna
  -> validasi input dan scope run baru
  -> research agent + model kompatibel OpenAI
      -> webSearch: Tavily snippets + registry sumber per run
      -> writeFile: validasi Markdown/citation lalu publikasi laporan
      -> readFile: verifikasi byte/hash dan isi laporan
  -> finalizer aplikasi -> ResearchResponse + safe metrics
```

| Tool        | Tanggung jawab                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `webSearch` | Mengambil maksimum lima hasil per pencarian; URL dinormalisasi dan diberi ID `S1`, `S2`, dan seterusnya dalam run aktif |
| `writeFile` | Menolak draft tidak valid sebelum I/O; aplikasi menentukan path laporan, bukan model                                    |
| `readFile`  | Membaca hanya laporan milik run aktif dan memverifikasi byte/hash serta citation                                        |

Pencarian tidak meminta halaman lengkap atau jawaban generatif Tavily. Isi web adalah bukti tidak tepercaya, bukan instruksi. Pemeriksaan citation memvalidasi ID/URL dan struktur, bukan membuktikan dukungan semantik setiap klaim oleh snippet.

## API programatik

`src/index.ts` dan hasil build `dist/index.js` mengekspor `parseConfig`, `createResearchRuntime`, `createResearchAgent`, `createScopedStudio`, dan tipe `ResearchResponse`.

Contoh berikut menggunakan provider nyata dan dapat menimbulkan biaya. Ini penggunaan manual, bukan pemeriksaan offline atau perintah yang perlu dijalankan saat mengubah dokumentasi.

1. Siapkan `.env` dari `.env.example` hanya jika file lokal belum ada.
2. Isi `OPENAI_API_KEY` dan `TAVILY_API_KEY` secara lokal; jangan mencetak atau commit nilainya.
3. Untuk pemakaian lokal, gunakan `REPORTS_DIR=./reports`. Nilai `/app/reports` digunakan dalam container.
4. Jalankan dari Git Bash atau WSL:

```sh
pnpm run build
node --env-file=.env --input-type=module -e '
import { parseConfig, createResearchRuntime } from "./dist/index.js";
const runtime = await createResearchRuntime(parseConfig(process.env));
const response = await runtime.run("Research tentang apa itu Redis dan fungsinya.");
console.log(JSON.stringify(response, null, 2));
'
```

Konstruksi runtime tidak memanggil model/search dan tidak memuat `.env` sendiri. Contoh memakai `--env-file` milik Node. Pemanggilan provider dimulai pada `runtime.run(...)`.

Untuk pembatalan, teruskan `{ abortSignal: controller.signal }` sebagai argumen kedua. Input kosong, terlalu panjang, atau envelope tidak valid ditolak sebelum run/provider; error input tersebut bukan `needs_clarification`.

Untuk pengujian offline, `createResearchRuntime(config, overrides)` menerima `model`, `searchProvider`, `reportStore`, dan `logger`. Contoh fixtures ada di [tests/fixtures/research.ts](../tests/fixtures/research.ts).

### Response dan streaming

Setiap response aplikasi memiliki `runId`, `status`, dan `message`. Hanya `completed` memiliki `reportPath` dan `sources` yang berasal dari state tervalidasi. Penjelasan status untuk pengguna ada di README; kontrak lengkap ada di [ARCHITECTURE](ARCHITECTURE.md#5-model-provider-dan-konfigurasi).

File yang sempat ditulis sebelum kegagalan read-back atau deadline dapat tetap ada. Keberadaan file bukan bukti `completed`. Runtime tidak menghapus artefak pengguna, dan finalizer tidak melakukan filesystem read tambahan tersembunyi.

Daftarkan `runtime.agent` melalui `createScopedStudio`, bukan `new Studio(...)` default. Konfigurasi default SDK dapat mengkloning agent dan melewati scope/policy aplikasi; factory proyek menonaktifkan session/trace persistence untuk menghindarinya.

Pada streaming, delta/turn/tool events adalah draft. Hanya terminal response JSON yang sudah melewati policy menjadi hasil aplikasi. `agent.stream(...).textStream` menunggu terminal response lalu menghasilkan JSON tersebut tepat sekali, sama dengan `.text` dan `.result.text`, termasuk saat recovery error. Ini bukan streaming token mentah secara bertahap.

## Konfigurasi dan batas eksekusi

Default provider adalah gateway kompatibel OpenAI `https://gateway.devscale.id/v1`, model `gpt-6-luna`, Chat Completions (`LLM_API=chat`), serta Tavily Search API. Tidak ada fallback endpoint/model atau automatic retry.

| Batas default         | Nilai                                                        |
| --------------------- | ------------------------------------------------------------ |
| Search per run        | 3 panggilan, termasuk yang gagal                             |
| Model per run         | 5 total attempts, termasuk call awal dan yang gagal          |
| Deadline run          | Default 60 detik; acceptance terotorisasi maksimum 180 detik |
| Revisi draft          | 1 setelah draft pertama ditolak                              |
| Successful write/read | Masing-masing 1 per run                                      |
| Tool concurrency      | 1                                                            |
| Hasil per search      | Maksimum 5                                                   |
| Ukuran laporan UTF-8  | 65.536 byte                                                  |

Semua langkah memakai budget run awal, termasuk revisi dan read-back. Penolakan draft kedua menghentikan run; kegagalan I/O bukan kesempatan revisi konten. Batas operasi/waktu/ukuran ini bukan jaminan token atau biaya moneter. Config dan batas input/query/snippet ada di `.env.example` dan `src/config/index.ts`.

Report store menyimpan `<REPORTS_DIR>/<runId>/report.md`, menolak traversal/symlink/junction, tidak menimpa file yang ada, dan memublikasikan dengan hardlink atomik. Reports root harus merupakan direktori host tepercaya terhadap concurrent hostile rename. Batas filesystem dijelaskan di ARCHITECTURE.

## Debugging Studio

Periksa events `tool_call`, `tool_result`, dan terminal `response` pada Playground/response JSONL, serta metrics proses. Untuk container Podman:

```sh
podman compose logs studio
```

Tidak ada persisted trace browser. Jika perlu memeriksa run setelah server berhenti, simpan output JSONL dari contoh publik yang aman. Jangan simpan secrets atau raw provider errors dalam logs, laporan, fixture, atau PR. Event draft bukan hasil terverifikasi.

Metrics berisi durasi, counters/status, penggunaan token yang tersedia, dan kategori error aman. Token usage yang tidak dilaporkan provider dicatat `null`, bukan nol rekaan. Timeout lokal tidak membuktikan bahwa proses atau billing pada provider remote berhenti.

## Live probes

Live probes terpisah dari penggunaan manual dan ordinary checks. Wajib izin sesuai [PLAN §9](PLAN.md#9-daftar-live-tests-yang-diizinkan), `ALLOW_LIVE_TESTS=true`, kredensial lokal, dan case ID eksplisit. Jangan automatic rerun, menambah paid debugging, atau mengganti provider/budget untuk mengejar kelulusan.

Command di bawah hanya untuk run yang sudah diotorisasi, bukan daftar perintah setup yang harus dijalankan berurutan:

```sh
ALLOW_LIVE_TESTS=true pnpm exec node --env-file=.env --import tsx scripts/live.ts --case LIVE-01
ALLOW_LIVE_TESTS=true pnpm exec node --env-file=.env --import tsx scripts/live.ts --case LIVE-02
```

- LIVE-01 menguji tool-result replay exact-match dengan maksimum dua model calls dan satu tool sintetis tanpa side effect. Tool sintetis bukan application tool keempat.
- LIVE-02 melakukan satu query publik `Redis official documentation`, maksimum lima hasil, tanpa LLM/retry.
- LIVE-03 menjalankan satu riset Redis melalui HTTP Studio sementara, lalu memeriksa host report round-trip dan menyimpan ringkasan trace. Command, guards, serta rubrik review ada di [EVALUATION](EVALUATION.md#live-03-tepat-satu-run-riset-melalui-http-studio).

LIVE-01/02 memiliki bukti historis dan tidak perlu diulang sebagai dependency LIVE-03. Hasil terkini ada di CONTEXT §13. Command LIVE-03 host sendiri bukan verifikasi Docker Desktop; follow-up yang dijalankan di image Docker dengan bind mount dibedakan eksplisit dari command host.

## Peta kode dan workflow

| Lokasi                                          | Isi                                                           |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `src/agent/`                                    | Research agent, instructions, dan binding policy/metrics      |
| `src/application/`                              | Scope, lifecycle, runtime, finalization, dan Studio           |
| `src/tools/`                                    | Tiga tools, quota, revisi, dan completion guards              |
| `src/services/`                                 | Source registry, report validation/store, dan metrics         |
| `src/providers/`, `src/config/`, `src/schemas/` | Adapter provider, config, dan kontrak tipe                    |
| `tests/`, `scripts/`                            | Offline suites, guarded live probes, dan container acceptance |

Pengembangan mengikuti [AGENTS](../AGENTS.md): satu branch per fase, commit terpisah per fitur setelah checks terkait lulus, lalu satu draft PR ke `master`. Review/merge dilakukan pemilik. Task dan acceptance dimiliki PLAN/PRD; state serta bukti eksekusi dimiliki CONTEXT.
