<div align="center">

# 📡 Website Monitoring Pulse
### Real-Time Website Observability & Latency Tracking Dashboard

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![HTTPX](https://img.shields.io/badge/Engine-HTTPX%20Async-blue?style=for-the-badge)](https://www.python-httpx.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel%20Serverless-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Platform monitoring uptime dan latensi website modern berbasis serverless.</b><br>
  Dirancang dengan arsitektur asinkronus berperforma tinggi, UI editorial yang elegan, serta dukungan dark/light mode bawaan.
</p>

[Fitur Utama](#-fitur-utama) •
[Arsitektur](#-arsitektur--cara-kerja) •
[Tech Stack](#-tech-stack) •
[Memulai Cepat](#-panduan-instalasi--lokal) •
[Dokumentasi API](#-dokumentasi-api) •
[Deployment](#-panduan-deployment)

---

</div>

## 📖 Tentang Project

**NEXCT Monitoring** adalah aplikasi observability modern yang memungkinkan developer, sysadmin, dan pemilik website memantau ketersediaan (*uptime/downtime*) dan kecepatan respon (*response latency*) layanan web secara real-time.

Dibangun dengan backend **FastAPI** asinkronus bertenaga **HTTPX** serta frontend interaktif tanpa dependensi berat (*zero-bloat vanilla stack*), aplikasi ini sangat ringan, responsif, dan siap di-deploy ke infrastruktur serverless seperti **Vercel** hanya dalam hitungan detik.

---

## ✨ Fitur Utama

- ⚡ **Asynchronous Ping Engine**: Melakukan pengecekan status dan kalkulasi latensi presisi tinggi (`perf_counter`) dalam milidetik (ms).
- 🟢 **Intelligent Status Detection**: Mendeteksi kode status HTTP lengkap (`2xx/3xx` Up, `4xx/5xx` Down, `408` Timeout, `503` Unreachable).
- 🛡️ **Smart URL Normalization**: Otomatis memvalidasi dan melengkapi skema URL (`https://`) serta menyaring input tidak valid.
- 🎨 **Modern Editorial UI Dashboard**: Tampilan visual clean, tipografi premium (*Plus Jakarta Sans* & *Manrope*), dan komponen visual responsif.
- 🌓 **Instant Dark / Light Mode**: Mendukung peralihan tema instan bebas flicker (*zero FOUC*) yang tersimpan di `localStorage`.
- ☁️ **Serverless Ready**: Terkonfigurasi langsung untuk Vercel Serverless Functions via `@vercel/python` dan `@vercel/static`.
- 🔌 **CORS Enabled REST API**: Endpoint backend siap dihubungkan dengan integrasi eksternal atau cron scheduler.

---

## 🏗 Arsitektur & Cara Kerja

```
   ┌─────────────────┐           ┌──────────────────┐           ┌────────────────────┐
   │                 │  HTTP GET │                  │  Async    │                    │
   │  Web Dashboard  │ ────────> │  FastAPI Server  │ ────────> │   Target Website   │
   │ (Vanilla JS/CSS)│ <──────── │ (HTTPX Engine)   │ <──────── │   (Endpoint URL)   │
   │                 │   JSON    │                  │  Response │                    │
   └─────────────────┘           └──────────────────┘           └────────────────────┘
                                           │
                                  [Latency Stopwatch]
                                  [Status Code Parse]
                                  [Timeout & Error Guard]
```

1. **Input & Sanitasi**: Dashboard mengirimkan target URL ke endpoint `/api/check`. Backend memvalidasi dan menormalisasi format URI.
2. **Pengujian Non-blocking**: `httpx.AsyncClient` mengirimkan HTTP request asinkron dengan header custom User-Agent dan batas timeout ketat (5 detik).
3. **Kalkulasi & Respon**: Menghitung delta waktu respons (*latency*), membaca status kode HTTP, dan mengembalikan payload JSON terstruktur ke client.

---

## 🛠 Tech Stack

### Backend
- **Language**: Python 3.10+
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (High-performance ASGI framework)
- **HTTP Client**: [HTTPX](https://www.python-httpx.org/) (Async non-blocking requests)
- **Data Validation**: [Pydantic](https://docs.pydantic.dev/)
- **Server**: [Uvicorn](https://www.uvicorn.org/)

### Frontend
- **Markup & Styling**: HTML5, Modern CSS3 (Custom Variables, Flexbox/Grid, Glassmorphism)
- **Typography**: Google Fonts (*Manrope* & *Plus Jakarta Sans*)
- **Scripting**: Vanilla JavaScript (ES6+ Asynchronous Fetch, DOM Manipulation, LocalStorage)

### Infrastruktur & Deployment
- **Hosting Platform**: Vercel Serverless
- **Runtime Builder**: `@vercel/python` & `@vercel/static`

---

## 📂 Struktur Direktori

```plaintext
NEXCT-Monitoring/
├── app/
│   ├── main.py              # Entry point FastAPI & konfigurasi static/CORS
│   ├── routes/
│   │   ├── check.py         # Endpoint pengecekan status & latensi website
│   │   └── health.py        # Healthcheck endpoint API
│   └── utils/
│       ├── http_client.py   # Client HTTPX async dengan header kustom
│       └── validator.py     # Validator dan auto-fix format URL
├── public/
│   ├── favicon/             # Aset web manifest dan icon
│   ├── index.html           # Dashboard UI modern
│   ├── script.js            # Logika interaktivitas client-side
│   └── style.css            # Desain tema, tata letak, dan animasi
├── requirements.txt         # Dependensi Python
├── vercel.json              # Konfigurasi routing serverless Vercel
├── LICENSE                  # Lisensi Open Source
└── README.md                # Dokumentasi project
```

---

## 🚀 Panduan Instalasi & Lokal

### 1. Prasyarat
Pastikan sistem Anda telah terpasang:
- **Python 3.10** atau versi lebih baru
- **Git**

### 2. Clone Repositori
```bash
git clone https://github.com/fallss/website-monitoring-pulse.git
cd website-monitoring-pulse
```

### 3. Buat dan Aktifkan Virtual Environment
```bash
# Linux / macOS
python3 -m venv venv
source venv/bin/activate

# Windows (Command Prompt / PowerShell)
python -m venv venv
venv\Scripts\activate
```

### 4. Install Dependensi
```bash
pip install -r requirements.txt
```

### 5. Jalankan Server Pengembangan
```bash
uvicorn app.main:app --reload --port 8000
```

Buka browser dan akses:
- **Dashboard UI**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 📡 Dokumentasi API

### 1. Pengecekan Website (`/api/check`)

Memeriksa status dan latensi website target.

- **Method**: `GET`
- **URL**: `/api/check`
- **Query Parameters**:
  | Parameter | Tipe | Wajib | Deskripsi |
  | :--- | :--- | :--- | :--- |
  | `url` | `string` | Ya | Alamat website target (contoh: `github.com` atau `https://google.com`) |

#### Contoh Request:
```bash
curl -X GET "http://localhost:8000/api/check?url=github.com"
```

#### Contoh Response Sukses (`200 OK`):
```json
{
  "url": "https://github.com",
  "status": "up",
  "status_code": 200,
  "response_time_ms": 142,
  "checked_at": "2026-10-29T03:45:10.123456+00:00"
}
```

#### Penjelasan Status:
| Status | Nilai | Penjelasan |
| :--- | :--- | :--- |
| `up` | HTTP `< 400` | Website berhasil diakses dan memberikan respon normal |
| `down` | HTTP `>= 400` | Website merespon dengan error (404, 500, dsb) |
| `down` | Code `408` | Request mengalami timeout (> 5 detik) |
| `down` | Code `503` | Jaringan terputus / domain tidak dapat dijangkau |

---

### 2. Healthcheck API (`/api/health`)

Memeriksa kesiapan layanan backend.

- **Method**: `GET`
- **URL**: `/api/health`

#### Contoh Response:
```json
{
  "status": "ok"
}
```

---

## ☁️ Panduan Deployment

### Deploy ke Vercel

Proyek ini telah dilengkapi dengan [`vercel.json`](vercel.json) bawaan:

#### Opsi 1: Menggunakan Vercel CLI
```bash
npm install -g vercel
vercel
```

#### Opsi 2: Hubungkan via Dashboard Vercel
1. Masuk ke [dashboard Vercel](https://vercel.com).
2. Pilih **"Add New Project"** lalu impor repositori GitHub ini.
3. Vercel akan otomatis membaca file [`vercel.json`](vercel.json) dan mendeteksi runtime Python serta static assets.
4. Klik **Deploy**.

---

## 🗺️ Roadmap Pengembangan

- [ ] Riwayat uptime berbasis database (SQLite / PostgreSQL / Supabase)
- [ ] Notifikasi webhook otomatis (Discord / Telegram / Slack) saat website down
- [ ] Pengujian SSL Certificate expiry checker
- [ ] Multi-region ping latency comparison
- [ ] PWA (Progressive Web App) support

---

## 🤝 Kontribusi

Kontribusi selalu terbuka dan diapresiasi! Untuk berkontribusi:

1. Fork repositori ini
2. Buat branch fitur baru (`git checkout -b feature/FiturKeren`)
3. Commit perubahan Anda (`git commit -m 'feat: menambahkan fitur keren'`)
4. Push ke branch (`git push origin feature/FiturKeren`)
5. Buka Pull Request

---

## 📄 Lisensi

Didistribusikan di bawah Lisensi MIT. Lihat berkas [LICENSE](LICENSE) untuk informasi lebih lanjut.

---

<div align="center">

Dibuat dengan ❤️ oleh **[Akbar Iqbnu Prayoga](https://github.com/AkbarIqbnuPrayoga)** & dikembangkan oleh **[fallss](https://github.com/fallss)**  
*Website Observability & Latency Systems*

</div>
