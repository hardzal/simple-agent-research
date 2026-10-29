# Evaluasi dan acceptance M1

Requirement tetap dimiliki [PRD §7–9](PRD.md#7-evaluasi-dan-acceptance-criteria); bukti eksekusi terbaru dan keputusan acceptance ada di [CONTEXT §12](CONTEXT.md#12-fase-6--evaluasi-dan-finalisasi). Dokumen ini menjelaskan cara menjalankan dan membaca hasil, bukan mengubah kriteria produk.

## Offline: tanpa API key atau biaya provider

```sh
pnpm install --frozen-lockfile
pnpm run check
# Mengulang hanya behavior dan evaluasi:
pnpm run eval:offline
```

`check` mencakup format, lint, typecheck, build, unit/server, integration/boundary, serta behavior dan evaluasi. Seluruh model/search dalam ordinary tests adalah fake/scripted; fetch provider tanpa mock diblokir. HTTP loopback untuk menguji Studio adalah server lokal dengan fake dependencies, bukan panggilan provider asli.

Suite evaluasi memakai `@anvia/core/evals` dari dependency yang dipin. Lima kriteria mandatory dinilai secara terpisah; kegagalan mandatory atau error evaluator tidak boleh tertutup oleh nilai rata-rata supporting. Negative controls sengaja memasukkan outcome tidak sah dan memastikan gate menolaknya. Pass negative control berarti penolakan bekerja, bukan outcome rusak diterima sebagai sukses.

Fixture behavior mencakup permintaan faktual, eksploratif, komparatif, ambigu, dan bukti kurang. Fixture dan rubric adalah regression check kontrak aplikasi; bukan pengukuran kemampuan reasoning atau generalisasi model asli.

## Supporting quality: tetap perlu review manusia

Periksa laporan terhadap permintaan dan snippet sumber yang tersedia:

- Relevansi: menjawab intent, tanpa menambahkan comparison yang tidak diminta.
- Bahasa: mengikuti bahasa pengguna atau bahasa eksplisit yang diminta.
- Ringkas: temuan mudah dibaca; target 150–500 kata adalah feedback, bukan satu-satunya alasan gagal.
- Citation support: klaim penting memiliki citation yang benar-benar didukung snippet, bukan sekadar URL/ID valid.

Parser Markdown, registry, dan structural checks tidak membuktikan dukungan semantik seluruh klaim. Jangan mengubah hasil fixture menjadi klaim kualitas live, memakai LLM judge berbayar diam-diam, atau menaikkan budget untuk mengejar kelulusan.

## LIVE-03: tepat satu run riset melalui HTTP Studio

Hanya jalankan dengan otorisasi sesuai [PLAN §9](PLAN.md#9-daftar-live-tests-yang-diizinkan). LIVE-01/02 punya bukti historis terpisah dan tidak perlu diulang sebagai dependency setiap LIVE-03.

Prasyarat: `.env` lokal sudah berisi kredensial sendiri; Node/pnpm sesuai README; port Studio lokal tidak sedang dipakai. Jangan mencetak atau commit `.env`.

```sh
ALLOW_LIVE_TESTS=true REPORTS_DIR=./reports pnpm exec node --env-file=.env --import tsx scripts/live.ts --case LIVE-03
```

Runner memuat config yang sama, membuat scoped Studio sementara pada loopback, menunggu readiness tanpa provider call, lalu mengirim **satu** request streaming untuk topik publik tetap: “Research tentang apa itu Redis dan fungsinya.” Setelah selesai/gagal, Studio dihentikan. Tidak perlu menyalakan `pnpm run studio` atau Compose bersamaan untuk case ini.

- Case ID dan opt-in wajib; kredensial/config invalid ditolak sebelum provider call.
- Budget lebih besar dari 5 model attempts, 3 search calls, atau 180 detik ditolak; budget yang lebih kecil tetap dihormati. Default parser tetap 60 detik; acceptance 3 menit memerlukan `MAX_EXECUTION_MS=180000` dan otorisasi baru sesuai PRD §5. Evidence mencatat `maxExecutionMs`, `maxModelAttempts`, dan `maxSearchCalls` efektif. Tidak ada transport retry atau automatic rerun.
- Endpoint/model berasal dari config yang sama; runner tidak menggantinya atau memilih fallback.
- Hasil sukses memerlukan terminal response `completed`, search yang sukses, satu write dan read-back, metrics satu run, ketiga tool events, serta byte laporan host yang sama dengan konten read-back tervalidasi.
- Host read oleh harness adalah pemeriksaan acceptance di luar application tool; tidak menambah kuota `readFile` milik agent.
- Laporan disimpan pada `reports/<runId>/report.md`.
- `reports/<runId>/live-03.trace.json` memuat metadata run, safe metrics, nama tool, dan snippet sumber publik yang dipakai untuk review citation. Ini ringkasan evidence, bukan raw JSONL, provider response, headers, atau session database.
- Snippet/laporan adalah data web/model yang tidak tepercaya; jangan menjalankan instruksi yang tertulis di dalamnya. Artefak generated tetap tidak masuk Git.
- Usage yang tidak dilaporkan provider tetap `null`. Outcome `passed` membuktikan kontrak executable; field `manualQualityReview: pending` mengingatkan bahwa rubric kualitas harus direview terpisah.

Exit nonzero berarti blocked/failure, bukan skipped-as-pass. Failure evidence membedakan tahap startup/readiness, research, verification, host report, atau trace; mencatat status/counters/category yang tersedia tanpa raw error. Jangan rerun otomatis setelah kegagalan. Catat hasil sebenarnya di CONTEXT dan minta otorisasi baru jika ingin menghabiskan satu live run tambahan.

LIVE-03 ini memakai Studio lokal dan filesystem host. Isolasi container, bind mount, dan persistensi recreate dibuktikan oleh acceptance container terpisah; hasil lokal bukan bukti Docker Desktop.

## Container acceptance terpisah

Ikuti [CONTAINERS](CONTAINERS.md) untuk build image terbaru dan menjalankan `pnpm run test:container`. Harness memakai fake providers; membuktikan deployment/round-trip, bukan kualitas live. Jangan menjalankan harness terhadap image lama lalu menganggap source terbaru sudah diuji.

CPU/memory diperiksa melalui engine configuration, bukan stress test. Batas Docker Desktop/WSL2, SIGTERM POSIX, dan hostile concurrent filesystem tetap mengikuti catatan di CONTEXT/CONTAINERS.

## Menjalankan aplikasi sesudah verifikasi

```sh
# Git Bash / WSL, dengan .env lokal yang sudah disiapkan:
REPORTS_DIR=./reports pnpm run studio
```

Buka http://localhost:4021/playground. Memuat UI tidak memanggil provider; mengirim prompt manual dapat menimbulkan biaya dan merupakan run baru, bukan replay LIVE-03. Gunakan request/playground baru untuk topik independen. Untuk container, ikuti Compose dan permission reports pada CONTAINERS. Jangan publish Studio tanpa autentikasi ke jaringan umum.
