# Phase 3 Research Behavior Implementation Plan

**Goal:** Menyelesaikan P3-01–P3-04 dengan satu agent bounded dan verifikasi offline.

**Architecture:** Factory research agent memakai scope SDK yang sudah terbukti. Hook per-scope menormalisasi input stateless dan memetakan kandidat JSON menjadi response aplikasi sebelum terminal outcome generation/streaming. Runner headless menggunakan objek yang sama dengan Studio; tidak ada model/finalizer kedua.

**Tech Stack:** TypeScript strict, Anvia core 1.17.1, Studio 1.3.20, Zod, Vitest, pnpm.

## Scope dan sequencing

1. Baca PRD/ARCH dan API SDK terpin. Gunakan branch Fase 3 yang sudah disiapkan atas instruksi pengguna; update draft PR #2, bukan merge otomatis.
2. RED: buat `tests/fixtures/research.ts`, `tests/research-agent.test.ts`, dan `tests/research.behavior.test.ts`. Import runtime baru harus gagal sebelum implementasi tersedia.
3. Buat `src/schemas/research.ts` untuk kandidat tiga status serta response aplikasi lima status. Parser lokal tidak mempercayai path/sources bebas dari model.
4. Buat `src/agent/research.instructions.ts` dan `src/agent/research.agent.ts`: instructions adaptif faktual/eksploratif/komparatif, bahasa/override, klarifikasi stateless, snippets tidak tepercaya, dan tepat tiga tools.
5. Tambahkan hook typed minimal pada `src/application/scoped-agent.ts` untuk normalisasi request dan transformasi completion per scope. Hook kosong mempertahankan compatibility fixtures. Runtime memakai WeakMap scope dan cleanup; tidak ada mutable currentRun bersama.
6. Buat `src/application/research-policy.ts`: normalisasi input hanya pesan user terakhir; kandidat final diparse lokal; completed wajib search/write/read-back tervalidasi; klarifikasi tanpa tools; no-evidence memerlukan search sukses tanpa publikasi. Error tidak dijadikan no-evidence.
7. Buat `src/application/research-runner.ts` dan export programatik `src/index.ts`. Dependency injection fake model/search/store/logger wajib bekerja tanpa API key asli. Tidak membuat CLI live/default network command atau Studio UI/server.
8. GREEN: `pnpm exec vitest run tests/research-agent.test.ts tests/research.behavior.test.ts`. Perbaiki source, bukan melonggarkan negative assertions. Tambahkan regression test terlebih dulu jika integrasi menunjukkan kontrak berbeda.
9. Tambahkan `eval:offline` dan perluas `check` di package.json. Behavior tests dipisahkan dari unit/integration agar tidak dihitung ganda. `@anvia/core/evals` lengkap tetap Fase 6.
10. Jalankan `pnpm run check`, built-module smoke offline, link/fence/diff checks. Sinkronkan PLAN/CONTEXT/ARCH/README berdasarkan bukti aktual, review, commit, push, update draft PR #2 dan berhenti.

## Acceptance matrix

| Task  | Bukti yang diperlukan                                                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3-01 | Instructions diteruskan ke model; tepat webSearch/writeFile/readFile; factual/exploratory/comparative scripted traces                                                            |
| P3-02 | UUID baru; isolated overlapping runs; direct tool ditolak; generate/stream dan Studio app.request melewati policy yang sama; override/history tidak bypass                       |
| P3-03 | Klarifikasi tanpa search/write; request baru tidak membawa history; empty/irrelevant search → insufficient_evidence; provider failure bukan no-evidence; fixtures ID/EN/override |
| P3-04 | EVAL-01–03 dan supporting cases executable offline; actual tempfile report/read-back; source whitelist/quotas; prompt injection negative control; missing usage null             |

## Batas acceptance

- P4 memperlengkap citation parser, seluruh error/revisi/status edge cases, dan regression maksimum budget. Policy minimum yang diperlukan P3 tidak boleh hanya berupa prompt.
- P5 memiliki Docker, UI/server, bind mount, dan trace persistence. P3 hanya route in-process fake dependencies.
- Tidak membaca .env atau menjalankan LIVE-01/02/03. Tidak mengganti endpoint/model, menambah turns, database, memory, multi-agent, atau tools lain.
- Scripted output menguji wiring/enforcement, bukan kemampuan semantik model live atau mutu generalisasi prompt.
