Aplikasi Ringkasan Dokumen
Aplikasi ini adalah alat web sederhana untuk meringkas dokumen (.docx dan .pdf) menggunakan model Google Gemini. Aplikasi ini berjalan di sisi server menggunakan Node.js dan Express, dan menggunakan Puppeteer untuk mengubah ringkasan menjadi file PDF yang dapat diunduh.

Prasyarat
Sebelum memulai, pastikan Anda telah menginstal yang berikut:

Node.js (versi 14 atau lebih tinggi)

npm (termasuk dengan Node.js)

Langkah-langkah Menjalankan Aplikasi
Ikuti langkah-langkah di bawah ini untuk mengatur dan menjalankan aplikasi di komputer Anda.

1. Instal Dependensi
Buka terminal di direktori proyek Anda dan jalankan perintah berikut untuk menginstal semua pustaka yang diperlukan:

npm install express multer @google/generative-ai mammoth pdf-parse puppeteer marked dotenv

2. Konfigurasi Kunci API
Aplikasi ini memerlukan Google Gemini API Key. Untuk mengonfigurasinya, Anda perlu membuat file baru bernama .env di direktori utama proyek Anda.

Isi file .env dengan baris berikut, ganti YOUR_API_KEY dengan kunci API Gemini Anda:

GEMINI_API_KEY=YOUR_API_KEY

Penting: Jaga kerahasiaan kunci API Anda. Jangan bagikan file ini atau unggah ke repositori publik seperti GitHub.

3. Menjalankan Server
Setelah dependensi terinstal dan kunci API Anda dikonfigurasi, jalankan server dengan perintah berikut:

node server.js

Jika server berhasil dimulai, Anda akan melihat pesan di terminal yang mirip dengan:
Server listening at http://localhost:3000

4. Menggunakan Aplikasi
Buka browser web Anda dan navigasi ke alamat yang ditampilkan di terminal:

http://localhost:3000

Anda sekarang dapat mengunggah file .docx atau .pdf, memilih bahasa ringkasan, dan mengklik tombol "Buat Ringkasan". Setelah ringkasan selesai, Anda dapat mengklik tombol "Unduh PDF" untuk menyimpan hasilnya.