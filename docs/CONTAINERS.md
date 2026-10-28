# Studio dan container lokal

## Windows / WSL2

Gunakan Linux containers dan shell WSL2 dari root repository. Docker Desktop dengan integrasi distro WSL2 adalah target konfigurasi; Podman merupakan alternatif build/test yang disetujui untuk proyek ini. Hasil Podman tidak membuktikan Docker Desktop sudah diuji.

1. Siapkan `.env` dari `.env.example` hanya jika belum ada, lalu isi kredensial secara lokal. Jangan mencetak atau mengirim nilainya. `REPORTS_DIR` di Compose selalu `/app/reports`.
2. Buat direktori host milik UID/GID container (default Node: `1000:1000`):

   ```sh
   mkdir -p reports
   id -u
   id -g
   ```

   Jika ownership berbeda dan muncul `EACCES`, sesuaikan ownership hanya pada direktori reports proyek yang memang boleh diubah, misalnya `sudo chown 1000:1000 reports`. Jangan gunakan `chmod 777`. Pada filesystem Windows/DrvFS, ownership virtual dan mount options dapat berbeda; simpan repository di filesystem Linux distro WSL2 bila permission bind mount tidak konsisten. Rootless Podman mungkin memerlukan pemetaan UID melalui `podman unshare`; jangan memperbaiki dengan menjalankan aplikasi sebagai root.

3. Jalankan salah satu engine:

   ```sh
   docker compose up --build -d
   docker compose ps
   # Alternatif yang dipakai dalam verifikasi pengembangan:
   podman compose up --build -d
   podman compose ps
   ```

4. Buka http://localhost:4021. Host hanya dipublish pada `127.0.0.1:4021`; server di container bind `0.0.0.0:4021`. Memuat UI tidak memanggil LLM/Tavily. Mengirim riset manual memakai provider nyata dan dapat menimbulkan biaya. LIVE-03 otomatis tetap hanya Fase 6.
5. Hentikan dengan `docker compose down` atau `podman compose down`. File `./reports/<runId>/report.md` berada pada bind mount host, bukan writable layer container, sehingga tidak hilang ketika container dibuat ulang. Jangan menghapus reports saat ingin mempertahankan hasil.

Jangan menjalankan `compose config` yang mengekspansi environment ke log/PR karena dapat mencetak secrets. Pemeriksaan statis tanpa membaca/mengekspansi `.env`:

```sh
podman compose --env-file /dev/null -f compose.yaml config --no-env-resolution --no-interpolate --quiet
```

## Studio tanpa container

Node 24 dan pnpm terpin diperlukan. Ubah `REPORTS_DIR=./reports` pada `.env` untuk lokal, lalu:

```sh
pnpm install --frozen-lockfile
pnpm run studio
```

Gunakan playground/request baru untuk topik independen. Boundary tetap membuang history selain pesan user terakhir; UI history bukan product memory. Jangan mengganti factory scoped dengan Studio default karena SDK dapat mengkloning agent dan melewati policy.

## Acceptance tanpa API asli

Build image lebih dahulu; harness terpisah hanya menyuntikkan scripted model/search, tidak membaca `.env`, dan menolak network pada fixture. Entrypoint produksi tidak memiliki fake-mode switch.

```sh
podman build -t localhost/simple-agent-research:phase5 .
pnpm run test:container
# Alternatif engine; tag image yang sama harus sudah dibangun dengan Docker:
node scripts/container-acceptance.mjs docker
```

Harness menggunakan nama container unik, port loopback dinamis, dan direktori `reports/acceptance-*` miliknya sendiri. Container/direktori fixture tersebut dibersihkan sesudah test; laporan pengguna tidak dihapus. Test menjalankan entrypoint produksi untuk readiness/UI, memeriksa non-root/read-only root/CPU/memory, lalu menjalankan fake research melalui HTTP Studio, membandingkan byte laporan pada host/container, dan membuat ulang container untuk menguji persistensi. Ini bukan live research atau bukti kualitas LLM. Harness memakai `run` dengan sandbox flags yang sama. Smoke Compose up/recreate/healthy/down tambahan sudah dijalankan pada project fixture terpisah tanpa `.env` asli; lihat bukti di CONTEXT. Docker Desktop tetap belum diverifikasi.

## Batas sandbox

- UID/GID `1000:1000`, root filesystem read-only, hanya reports writable dan `/tmp` tmpfs 64 MiB.
- CPU 1, memory 1 GiB, PID 128, capabilities dibuang, no-new-privileges, tanpa privileged mode atau socket engine.
- Batas container bukan pengganti deadline, kuota tools/model, validasi citation, atau filesystem boundary per-run.
- Compose bukan egress allowlist, bukan isolasi hostile multi-tenant, dan cancellation lokal tidak menjamin billing provider remote berhenti.
- Reports root adalah area host tepercaya. Jangan membagikan Studio ke jaringan umum; produk ini tidak menambahkan authentication.
- Jika port 4021 dipakai aplikasi lain, hentikan konflik atau ubah hanya published host port pada konfigurasi lokal, bukan provider/model/budget.
