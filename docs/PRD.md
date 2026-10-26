# PRD & Implementation Plan

## Simple Contextual Research Agent — Milestone 1

**Status:** Draft v1.0  
**Project type:** AI Engineering — Proof of Concept  
**Language:** TypeScript  
**Agent Framework:** Anvia SDK v1  
**Development Interface:** Anvia Studio  
**Runtime:** Docker  
**Database:** Not required  
**Output:** Markdown research report

---

## 1. Product Overview

### 1.1 Background

Project ini bertujuan membangun AI Research Agent sederhana yang dapat melakukan riset berbasis web menggunakan LLM dan tool calling.

Agent menerima topik atau pertanyaan dari user, menentukan pendekatan riset yang sesuai, mencari informasi relevan, menganalisis temuan, kemudian menghasilkan laporan singkat dalam file Markdown.

Agent harus menyesuaikan kedalaman dan struktur analisis terhadap kompleksitas permintaan, tanpa memaksakan format laporan yang sama untuk seluruh topik.

### 1.2 Problem Statement

Mencari informasi melalui search engine sering kali mengharuskan user membaca banyak hasil pencarian untuk memahami sebuah topik, mengetahui konteksnya, dan menarik kesimpulan.

Research Agent diharapkan menyederhanakan proses tersebut dengan menghasilkan laporan ringkas yang mencantumkan sumber informasi dan dapat diverifikasi.

### 1.3 Product Goal

Membangun satu AI agent dengan tugas utama:

> Conduct concise, context-aware, web-based research on user-provided topics and generate a relevant Markdown report supported by traceable sources.

### 1.4 Success Criteria

Project dinyatakan berhasil jika:

1. Agent dapat menerima dan memahami berbagai topik riset.
2. Agent menggunakan web search untuk memperoleh informasi.
3. Agent menghasilkan laporan yang relevan dengan tingkat kompleksitas permintaan.
4. Agent mencantumkan URL sumber yang berasal dari hasil pencarian.
5. Agent membuat dan membaca kembali file Markdown di sandbox.
6. Agent menangani ambiguitas dan ketiadaan hasil pencarian dengan benar.
7. Agent memiliki batas penggunaan resources.
8. Agent dapat dijalankan melalui Docker dan diuji menggunakan Anvia Studio.
9. Kelima mandatory evaluation cases berhasil dijalankan.

---

## 2. Scope & Boundaries

### 2.1 In Scope

- Single Research Agent.
- Multi-topic, on-demand research.
- Web search melalui satu search API provider.
- Context-aware research planning.
- Information gathering dan summarization.
- Contextual analysis.
- Comparative analysis apabila relevan.
- Conclusion synthesis.
- Source citations.
- Markdown report generation.
- Sandbox file read/write.
- Docker containerization.
- Anvia Studio integration.
- Automated evaluation.
- Basic token, latency, dan tool usage metrics.

### 2.2 Out of Scope

Untuk menjaga kompleksitas project:

- Multi-agent orchestration.
- Autonomous background research.
- Scheduled news monitoring.
- PostgreSQL atau persistent conversation memory.
- RAG, vector database, dan embeddings.
- MCP server integration.
- Deep research dengan puluhan sumber.
- Crawling penuh atau ekstraksi semua isi website.
- PDF generation.
- Authentication dan multi-user production system.
- Production observability melalui Anvia Lens.

Setiap research request dianggap independen.

---

## 3. Functional Requirements

| ID    | Requirement                                                | Prioritas  |
| ----- | ---------------------------------------------------------- | ---------- |
| FR-01 | Menerima permintaan riset dalam bahasa natural             | Must       |
| FR-02 | Mengidentifikasi research intent dan konteks topik         | Must       |
| FR-03 | Menentukan research scope secara adaptif                   | Must       |
| FR-04 | Melakukan web search melalui tool                          | Must       |
| FR-05 | Mengevaluasi relevansi hasil pencarian                     | Must       |
| FR-06 | Melakukan analisis dan perbandingan jika relevan           | Must       |
| FR-07 | Menghasilkan kesimpulan sesuai bukti                       | Must       |
| FR-08 | Menyertakan URL sumber                                     | Must       |
| FR-09 | Membuat file laporan di sandbox                            | Must       |
| FR-10 | Membaca kembali file untuk verifikasi                      | Must       |
| FR-11 | Meminta klarifikasi jika permintaan ambigu secara material | Must       |
| FR-12 | Menangani hasil pencarian yang tidak berguna               | Must       |
| FR-13 | Menerapkan execution dan tool usage limits                 | Must       |
| FR-14 | Menampilkan agent di Anvia Studio                          | Must       |
| FR-15 | Mencatat token usage, tool calls, dan durasi               | Must       |
| FR-16 | Menyimpan conversation memory                              | Won't — M1 |

---

## 4. Agent Behavior Contract

### 4.1 Research Understanding

Sebelum melakukan pencarian, agent harus memahami:

- Apa subjek riset?
- Apa yang sebenarnya ingin diketahui user?
- Apakah permintaan bersifat faktual, eksploratif, atau komparatif?
- Informasi apa yang dibutuhkan untuk menjawab?
- Seberapa dalam analisis yang diperlukan?

Agent tidak perlu menghasilkan dokumen perencanaan terpisah. Penentuan scope dilakukan sebagai bagian dari pengambilan keputusan agent.

### 4.2 Adaptive Research Depth

| Research Type | Contoh                 | Expected Behavior                                   |
| ------------- | ---------------------- | --------------------------------------------------- |
| Factual       | Apa fungsi Redis?      | Definisi, fungsi, contoh penggunaan                 |
| Exploratory   | Research tentang Redis | Definisi, konteks ekosistem, use case, keterbatasan |
| Comparative   | Redis vs Memcached     | Perbandingan, trade-off, kesimpulan bersyarat       |

Klasifikasi ini merupakan panduan perilaku, bukan keharusan untuk membuat tiga pipeline berbeda.

### 4.3 Decision Rules

**Rule A — Search**

Agent harus menggunakan web search sebelum menyampaikan klaim faktual sebagai hasil riset.

**Rule B — Relevance**

Agent hanya menggunakan informasi yang relevan dengan permintaan user.

**Rule C — Search Sufficiency**

Agent boleh berhenti mencari ketika informasi yang tersedia sudah memadai untuk menjawab permintaan dengan batasan yang jelas.

**Rule D — Adaptive Structure**

Agent menentukan struktur dan kedalaman laporan berdasarkan kebutuhan riset.

**Rule E — Ambiguity**

Jika terdapat beberapa interpretasi yang secara material mengubah hasil riset dan konteks tidak cukup untuk memilih, agent meminta klarifikasi.

**Rule F — Insufficient Evidence**

Jika sumber tidak memadai setelah upaya pencarian yang wajar, agent menjelaskan keterbatasan dan tidak mengarang temuan.

**Rule G — Citation**

URL dalam laporan harus berasal dari hasil web search pada request tersebut. Sumber tidak boleh dibuat oleh LLM.

**Rule H — Completion**

Setelah laporan berhasil ditulis, dibaca, dan lolos pemeriksaan dasar, agent harus berhenti.

### 4.4 Initial Resource Limits

| Resource              | Initial Limit                  |
| --------------------- | ------------------------------ |
| Anvia `maxTurns`      | 5                              |
| Web search tool calls | 3                              |
| Search results        | Maksimum 5 per search          |
| File write            | 1 successful report write      |
| File read             | 1 successful verification read |
| Report length         | Target 150–500 kata            |
| Execution timeout     | 60 detik                       |
| Model retries         | Dinonaktifkan pada versi awal  |
| Tool concurrency      | 1                              |

Catatan: Dalam Anvia v1, `maxTurns: 5` berarti satu panggilan model awal dan maksimal lima putaran model lanjutan, bukan tepat lima LLM calls atau lima tool calls.

Batas ini harus dapat dikonfigurasi dan disesuaikan berdasarkan hasil evaluasi.

---

## 5. Tool Design

Agent hanya diberikan tiga application tools.

### 5.1 `webSearch`

**Purpose:** Mencari informasi web yang relevan dengan topik riset.

Input:

```typescript
type WebSearchInput = {
  query: string;
};
```

Output:

```typescript
type WebSearchResult = {
  results: Array<{
    sourceId: string;
    title: string;
    url: string;
    snippet: string;
    publishedAt?: string;
  }>;
};
```

Responsibilities:

- Memvalidasi search query.
- Memanggil search provider.
- Membatasi jumlah hasil.
- Menghilangkan duplikasi URL.
- Menormalkan hasil pencarian.
- Membatasi panjang snippet untuk menghemat token.
- Menyimpan daftar sumber yang ditemukan dalam konteks request.
- Mengembalikan hasil kosong jika tidak ada informasi berguna.

**Proposed provider:** Tavily Search API. Implementasi menggunakan adapter agar provider bisa diganti tanpa mengubah agent.

### 5.2 `writeFile`

**Purpose:** Menulis laporan Markdown ke sandbox.

Input:

```typescript
type WriteFileInput = {
  content: string;
};
```

Output:

```typescript
type WriteFileResult = {
  success: boolean;
  path: string;
  bytesWritten: number;
};
```

Responsibilities:

- Menentukan path laporan berdasarkan run ID.
- Memvalidasi isi dan ukuran file.
- Menolak akses filesystem di luar direktori yang diizinkan.
- Membuat file Markdown.
- Mengembalikan status operasi.

Path ditentukan oleh aplikasi, bukan string path arbitrer dari LLM.

Contoh:

`/app/reports/<runId>/report.md`

### 5.3 `readFile`

**Purpose:** Membaca kembali laporan yang dibuat agent.

Input: Tidak membutuhkan path arbitrer. File diidentifikasi dari konteks run.

Output:

```typescript
type ReadFileResult = {
  success: boolean;
  content: string;
  path: string;
};
```

Responsibilities:

- Membaca file milik run aktif.
- Memastikan file tersedia.
- Mengembalikan konten laporan.
- Mendukung verifikasi write/read round-trip.

### 5.4 Tool Security

Seluruh tools menggunakan schema validation, misalnya Zod.

File tools harus menegakkan batas direktori, termasuk proteksi path traversal dan symlink escape.

Tool tidak boleh menerima perintah shell dari LLM.

Web search API credentials tidak boleh dikembalikan dalam tool output.

Setiap tool harus dapat diuji secara independen tanpa pemanggilan LLM.

---

## 6. Research Quality Contract

### 6.1 Source Quality

Agent memprioritaskan sumber yang relevan, jelas asalnya, dan sesuai dengan sifat topik.

Untuk topik teknis, dokumentasi resmi umumnya menjadi prioritas.

Untuk berita atau perkembangan terbaru, perhatikan tanggal publikasi dan relevansi waktu.

Untuk topik yang memiliki beragam perspektif, jangan hanya menggunakan satu pandangan jika hal tersebut menghasilkan kesimpulan yang menyesatkan.

### 6.2 Source Limitations

Versi pertama hanya menggunakan hasil dan snippet dari search API.

Karena belum ada full-page retrieval tool, agent tidak boleh mengklaim telah membaca keseluruhan artikel apabila hanya memperoleh snippet.

Jika sumber hanya mendukung kesimpulan terbatas, laporan harus menunjukkan keterbatasan tersebut.

### 6.3 Citation Policy

- Setiap sumber memiliki source ID dan URL.
- Laporan menggunakan referensi seperti `[S1]`.
- Bagian Sources memuat URL yang sesuai.
- URL yang tidak terdapat dalam hasil pencarian ditolak.
- Klaim utama harus didukung sumber yang relevan.
- Minimal satu sumber relevan untuk laporan yang berhasil; dua atau lebih diutamakan bila tersedia.
- Validasi URL membuktikan provenance pencarian, bukan otomatis membuktikan bahwa setiap klaim faktual benar.

### 6.4 Report Structure

Struktur laporan bersifat dinamis.

Elemen minimum untuk laporan berhasil:

- Research title.
- Main findings yang relevan.
- Context atau analysis jika diperlukan.
- Kesimpulan bila membantu menjawab permintaan.
- Sources beserta URL.

Contoh struktur untuk permintaan eksploratif:

```markdown
# Research: Redis

## Overview

...

## Role in the Ecosystem

...

## Key Findings

...

## Limitations

...

## Conclusion

...

## Sources

- [S1] https://example.com/source-one
- [S2] https://example.com/source-two
```

Bagian tidak relevan harus dihilangkan, bukan diisi hanya demi mengikuti template.

---

## 7. Runtime & System Architecture

### 7.1 High-Level Architecture

```text
User
  |
  v
Anvia Studio
  |
  v
Docker Container
  |
  +-- TypeScript App
       |
       +-- Anvia Research Agent
       |     |
       |     +-- LLM Provider
       |     |
       |     +-- webSearch
       |     |
       |     +-- writeFile
       |     |
       |     +-- readFile
       |
       +-- Resource Limits
       +-- Report Validation
       +-- Run Metrics
  |
  v
/app/reports
  |
  | Docker Bind Mount
  v
Host ./reports
```

### 7.2 Architectural Decisions

- Satu container untuk aplikasi dan agent.
- Satu agent instance definition.
- Anvia Studio dijalankan melalui entry point development.
- Satu run ID unik untuk setiap permintaan.
- Setiap run memiliki lokasi laporan tersendiri.
- Tidak menggunakan database.
- Tidak menyimpan conversation history persisten.
- Report disimpan melalui Docker bind mount.
- Report validation dan limit enforcement ditangani aplikasi, bukan hanya LLM.
- Container merupakan batas isolasi runtime, bukan sandbox terpisah untuk setiap request.

### 7.3 Docker Requirements

- Multi-stage build apabila diperlukan.
- Non-root application user.
- Resource limit untuk memory dan CPU.
- Non-privileged container.
- Filesystem aplikasi read-only bila kompatibel.
- Direktori reports merupakan lokasi tulis yang diizinkan.
- Environment variables untuk API credentials.
- Tidak memasang Docker socket ke container.
- Akses jaringan hanya sebatas layanan yang diperlukan.
- Port Studio hanya dipublikasikan ke loopback host untuk development.

### 7.4 Environment Variables

```dotenv
NODE_ENV=development
OPENAI_API_KEY=
LLM_MODEL=
TAVILY_API_KEY=
REPORTS_DIR=/app/reports
MAX_WEB_SEARCH_CALLS=3
MAX_AGENT_TURNS=5
MAX_EXECUTION_MS=60000
```

---

## 8. Application Response Contract

Aplikasi perlu menormalkan hasil agent menjadi status yang mudah diuji.

```typescript
type ResearchStatus =
  | "completed"
  | "needs_clarification"
  | "insufficient_evidence"
  | "budget_exceeded"
  | "failed";

type ResearchResponse = {
  runId: string;
  status: ResearchStatus;
  message: string;
  reportPath?: string;
  sources?: string[];
};
```

Ini merupakan kontrak hasil pada lapisan aplikasi, bukan klaim bahwa Anvia otomatis menghasilkan struktur tersebut.

### Behavior by Status

| Status                  | Expected Result                                                 |
| ----------------------- | --------------------------------------------------------------- |
| `completed`             | Laporan valid tersedia dan telah dibaca kembali                 |
| `needs_clarification`   | Pertanyaan klarifikasi, tidak menulis laporan                   |
| `insufficient_evidence` | Penjelasan keterbatasan, tanpa laporan faktual yang dibuat-buat |
| `budget_exceeded`       | Operasi tambahan dihentikan, hasil dilaporkan secara aman       |
| `failed`                | Error ditangani tanpa membocorkan credentials atau stack trace  |

---

## 9. Evaluation Strategy

### 9.1 Mandatory Eval Cases

| ID      | Scenario          | Expected Behavior                                    |
| ------- | ----------------- | ---------------------------------------------------- |
| EVAL-01 | Clear answer      | Agent menghasilkan laporan yang relevan dan ringkas  |
| EVAL-02 | Ambiguous request | Agent meminta klarifikasi saat konteks tidak cukup   |
| EVAL-03 | No useful result  | Agent mengakui keterbatasan tanpa mengarang          |
| EVAL-04 | Source citation   | Setiap URL laporan dapat dilacak ke hasil web search |
| EVAL-05 | Report created    | File benar-benar dibuat, dibaca kembali, dan valid   |

### 9.2 Test Scenarios

**EVAL-01 — Clear Answer**

Input: "Research tentang apa itu Redis dan fungsinya."

Expected:

- Memanggil web search.
- Menjelaskan fungsi Redis.
- Tidak membuat perbandingan panjang yang tidak diminta.
- Menghasilkan report Markdown.

**EVAL-02 — Ambiguous Request**

Input: "Research Apple."

Expected:

- Meminta klarifikasi apakah Apple perusahaan teknologi atau buah, kecuali konteks sudah cukup jelas.
- Tidak melakukan pencarian luas yang tidak diperlukan.
- Tidak membuat report sebelum ambiguitas diselesaikan.

**EVAL-03 — No Useful Result**

Input: Permintaan penelitian spesifik dengan mocked search results kosong atau tidak relevan.

Expected:

- Tidak membuat fakta fiktif.
- Menghentikan pencarian dalam budget.
- Mengembalikan `insufficient_evidence`.
- Tidak mengklaim report riset faktual berhasil dibuat.

**EVAL-04 — Citation Validation**

Input: Research tentang Node.js dengan hasil pencarian mock yang berisi URL tertentu.

Expected:

- Report mencantumkan URL dari hasil pencarian.
- Tidak membuat URL baru.
- Reference ID dan URL konsisten.

**EVAL-05 — Report File Created**

Input: Research sederhana dengan sumber valid.

Expected:

- `writeFile` berhasil.
- `readFile` berhasil.
- File tersedia pada direktori host yang di-mount.
- Isi file sesuai dengan report yang dihasilkan.
- File tidak kosong.
- File memiliki sumber yang valid.

### 9.3 Supporting Tests

- Web search quota exceeded.
- File write permission denied.
- Attempted path traversal.
- Web search timeout.
- LLM provider failure.
- Duplicate search results.
- Report references an unknown source URL.
- Agent reaches maximum turns.

### 9.4 Evaluation Implementation

Gunakan `@anvia/core/evals` untuk automated suite.

Pendekatan:

1. Unit test tool handlers secara deterministik.
2. Mock search provider untuk menjalankan lima eval case.
3. Gunakan custom metrics untuk status, source validation, dan file existence.
4. Pisahkan test behavior agent yang memerlukan LLM dari unit test deterministic.
5. Jalankan live agent smoke test menggunakan Anvia Studio.
6. Catat hasil pass/fail dan resource usage.

Automated eval tidak boleh hanya mengandalkan penilaian LLM. File existence, URL whitelist, dan limit compliance diperiksa melalui assertion aplikasi.

### 9.5 Exit Criteria

- Kelima mandatory scenarios memiliki executable tests.
- Seluruh deterministic assertions lulus.
- Tidak ada citation URL yang dibuat-buat pada positive test cases.
- Batas resource dihormati.
- Tidak ada filesystem access di luar direktori yang diizinkan.
- Setidaknya satu live end-to-end research run berhasil.
- Hasil live run dapat diinspeksi di Studio.

---

## 10. Observability & Metrics

Metrics minimum:

| Metric             | Description               |
| ------------------ | ------------------------- |
| `run_duration_ms`  | Total durasi riset        |
| `model_calls`      | Jumlah pemanggilan model  |
| `input_tokens`     | Total input token         |
| `output_tokens`    | Total output token        |
| `web_search_calls` | Jumlah search requests    |
| `tool_calls`       | Jumlah tool calls         |
| `source_count`     | Jumlah sumber digunakan   |
| `report_created`   | Boolean                   |
| `report_verified`  | Boolean                   |
| `run_status`       | Final run status          |
| `error_type`       | Kategori error jika gagal |

Monitoring dilakukan melalui Anvia Studio traces dan logging aplikasi.

Opsional: estimasi biaya per run berdasarkan penggunaan token dan tarif model yang dikonfigurasi.

Tidak memerlukan PostgreSQL untuk menyimpan metrik pada Milestone 1.

---

## 11. Implementation Plan

### Phase 1 — Project Foundation

**Tasks**

- [ ] Inisialisasi TypeScript project.
- [ ] Setup package manager dan TypeScript configuration.
- [ ] Install Anvia Core, model provider, Studio, dan Zod.
- [ ] Konfigurasi environment variables.
- [ ] Membuat minimal Anvia Agent.
- [ ] Verifikasi koneksi LLM.
- [ ] Setup linting, formatting, dan test runner.

**Deliverable:** Basic Anvia agent dapat menjalankan prompt sederhana.

### Phase 2 — Tools Implementation

**Tasks**

- [ ] Mendefinisikan typed tool contracts.
- [ ] Implementasi search provider adapter.
- [ ] Implementasi `webSearch`.
- [ ] Implementasi `writeFile`.
- [ ] Implementasi `readFile`.
- [ ] Implementasi source registry per run.
- [ ] Implementasi tool errors.
- [ ] Unit test semua tools.
- [ ] Validasi sandbox filesystem boundary.

**Deliverable:** Ketiga tools dapat dijalankan dan diuji secara independen.

### Phase 3 — Research Agent Behavior

**Tasks**

- [ ] Menulis system instructions.
- [ ] Registrasi tools ke Anvia Agent.
- [ ] Implementasi adaptive research rules.
- [ ] Implementasi ambiguity handling.
- [ ] Implementasi source sufficiency rules.
- [ ] Implementasi resource limit enforcement.
- [ ] Implementasi report generation behavior.
- [ ] Implementasi stopping conditions.

**Deliverable:** Agent mampu menjalankan alur riset dengan tool calling.

### Phase 4 — Report Quality & Validation

**Tasks**

- [ ] Membuat report quality rules.
- [ ] Mengembangkan report validator.
- [ ] Menguji source citation whitelist.
- [ ] Memastikan file dibuat di direktori run.
- [ ] Memastikan read-back verification.
- [ ] Menambahkan failure handling.
- [ ] Menormalisasi application response status.

**Deliverable:** Report yang dihasilkan dapat divalidasi dan diverifikasi.

### Phase 5 — Docker & Anvia Studio

**Tasks**

- [ ] Membuat Dockerfile.
- [ ] Membuat Docker Compose configuration.
- [ ] Setup reports bind mount.
- [ ] Setup non-root container user.
- [ ] Mengintegrasikan Anvia Studio.
- [ ] Menguji agent dari Studio Playground.
- [ ] Memeriksa tool execution traces.
- [ ] Memastikan file tetap ada setelah container dibuat ulang.

**Deliverable:** Research Agent berjalan di Docker dan dapat diuji melalui Anvia Studio.

### Phase 6 — Evaluation & Final Validation

**Tasks**

- [ ] Implementasi lima mandatory eval cases.
- [ ] Implementasi deterministic assertions.
- [ ] Implementasi unit tests dan integration tests.
- [ ] Jalankan live smoke test.
- [ ] Verifikasi resource metrics.
- [ ] Uji timeout dan error cases.
- [ ] Review prompt dan hasil evaluasi.
- [ ] Menulis README serta petunjuk menjalankan project.

**Deliverable:** Agent memenuhi requirement tugas dan hasilnya dapat direproduksi.

---

## 12. Proposed Project Structure

```text
simple-research-agent/
├── src/
│   ├── agent/
│   │   ├── research.agent.ts
│   │   ├── research.instructions.ts
│   │   └── research.config.ts
│   │
│   ├── tools/
│   │   ├── web-search.tool.ts
│   │   ├── write-file.tool.ts
│   │   └── read-file.tool.ts
│   │
│   ├── services/
│   │   ├── search-provider.ts
│   │   ├── report-validator.ts
│   │   └── resource-limiter.ts
│   │
│   ├── schemas/
│   │   └── research.schema.ts
│   │
│   ├── evals/
│   │   ├── research.eval.ts
│   │   └── fixtures/
│   │
│   ├── tests/
│   │   ├── tools.test.ts
│   │   └── research.integration.test.ts
│   │
│   ├── studio.ts
│   └── index.ts
│
├── reports/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

File `research.eval.ts` merupakan entry point evaluation suite. Detail import dan runner disesuaikan dengan API Anvia v1 yang terpasang.

---

## 13. Risks & Mitigation

| Risk                                 | Mitigation                                                |
| ------------------------------------ | --------------------------------------------------------- |
| Agent melakukan web search berulang  | Tool-level counter dan max turns                          |
| LLM menghasilkan citation palsu      | Source registry dan URL validation                        |
| Report terlalu panjang               | Prompt guidance dan output validation                     |
| LLM membuat kesimpulan tanpa bukti   | Source quality rules dan eval                             |
| Agent membaca file tidak sah         | Restricted paths, non-root user, filesystem checks        |
| Container dihapus                    | Docker bind mount                                         |
| Penggunaan token berlebihan          | Search result truncation, limits, metrics                 |
| Web API failure                      | Graceful error handling                                   |
| Prompt injection dari search results | Treat web results as untrusted evidence, not instructions |

---

## 14. Definition of Done — Milestone 1

Milestone 1 dinyatakan selesai ketika:

- [ ] Satu Anvia Research Agent berhasil dijalankan.
- [ ] Agent mendukung research topics yang berbeda-beda.
- [ ] Agent dapat memanggil web search tool.
- [ ] Agent memiliki sandbox write/read tools.
- [ ] Report Markdown berhasil dibuat.
- [ ] File dapat dibaca kembali dan diverifikasi.
- [ ] URL citation dapat ditelusuri ke search results.
- [ ] Agent menangani ambiguous request dan no useful result.
- [ ] Agent berhenti sesuai resource budget.
- [ ] Container dapat dijalankan menggunakan Docker Compose.
- [ ] Report tersedia di host directory.
- [ ] Agent dapat diuji melalui Anvia Studio.
- [ ] Lima mandatory evaluation cases tersedia dan lulus.
- [ ] Dokumentasi setup dan testing tersedia.

**Final Deliverable:** Functional, bounded, and evaluable Simple Contextual Research Agent built with TypeScript, Anvia SDK, and Docker.

**Next Milestone (Optional):** PostgreSQL-based conversation memory using Anvia memory adapter.
