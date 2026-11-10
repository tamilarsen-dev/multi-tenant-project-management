# Documentation Guide

Dokumentasi ini menjadi pintu masuk utama untuk memahami, mengembangkan, dan memelihara project **Multi-Tenant Project Management API**.

Tujuannya bukan sekadar mengumpulkan dokumen. Setiap dokumen memiliki tanggung jawab yang jelas agar keputusan produk, aturan domain, desain database, kontrak API, dan implementasi tidak saling bertentangan.

> **Prinsip utama:** jika implementasi bertentangan dengan dokumen keputusan yang masih aktif, jangan mengubah perilaku secara diam-diam. Periksa dokumen pemilik keputusan, tentukan perubahan yang benar, lalu perbarui implementasi dan dokumentasi terkait.

---

## 1. Mulai dari mana?

Urutan membaca yang disarankan:

1. **Product Requirements** untuk memahami masalah, tujuan, ruang lingkup, dan kebutuhan produk.
2. **PRD** untuk memahami konteks produk dan batasan V1.
3. **Domain Map** untuk memahami entitas domain dan hubungan antar-entitas.
4. **Architecture** dan **ADR** untuk memahami struktur sistem serta alasan keputusan teknis.
5. **Database Specification** untuk memahami model data, constraints, invariants, transaksi, dan concurrency.
6. **Permissions** untuk memahami siapa yang boleh melakukan apa dalam Organization.
7. **API Conventions** lalu **API Contract** untuk memahami aturan umum HTTP/API dan kontrak setiap endpoint.
8. **Implementation Plan** untuk melihat urutan pengerjaan dan dependency antar-pekerjaan.

Untuk mengerjakan fitur tertentu, baca dokumen pemilik domain tersebut beserta dokumen lintas-domain yang relevan. Jangan mengandalkan README ini sebagai pengganti spesifikasi.

---

## 2. Struktur dokumentasi

Dokumen aktif dikelompokkan berdasarkan tanggung jawabnya.

### `product/` — tujuan dan kebutuhan produk

| Dokumen | Tanggung jawab |
|---|---|
| `prd-v1.2.md` | Menjelaskan konteks produk, visi, target pengguna, ruang lingkup, dan batasan produk. |
| `requirements-v1.2.md` | Menjabarkan kebutuhan dan requirement yang harus dipenuhi oleh sistem. |

Dokumen product menjawab **apa yang perlu dibangun dan mengapa**. Dokumen ini tidak seharusnya menjadi tempat mendefinisikan detail implementasi database atau bentuk payload endpoint.

### `design/` — desain sistem dan kontrak teknis

| Dokumen | Tanggung jawab |
|---|---|
| `architecture.md` | Menjelaskan arsitektur aplikasi, pembagian layer, komponen, dan dependency direction. |
| `domain-map-v1.2.md` | Menjelaskan domain, entitas utama, relasi, dan batas konteks domain. |
| `database-specification-v1.3.md` | Menjadi acuan struktur data, constraints, lifecycle, invariants, transaction behavior, dan concurrency rules. |
| `permissions-v1.1.md` | Menetapkan role, permission, dan aturan otorisasi. |
| `api-conventions.md` | Menetapkan konvensi API lintas endpoint, seperti format response, error, validation, pagination, dan aturan umum HTTP. |
| `0001-api-contract.md` | Menetapkan kontrak API: endpoint, request, response, authorization, error behavior, dan semantik operasi. |

Dokumen design menjawab **bagaimana sistem harus berperilaku dan batasan teknis apa yang wajib dipenuhi**.

### `adr/` — catatan keputusan arsitektur

| Dokumen | Tanggung jawab |
|---|---|
| `ADR-001-architecture-baseline.md` | Mencatat keputusan baseline arsitektur beserta alasan dan konsekuensinya. |

ADR menyimpan alasan di balik keputusan penting. Jika suatu keputusan perlu diubah, revisi atau tambahkan ADR yang sesuai. Jangan hanya mengubah kode lalu membiarkan alasan dan keputusan lama tetap terlihat aktif.

### `implementation-plan-v1.1.md` — urutan implementasi

Dokumen ini mengatur tahapan implementasi, dependency, dan urutan pekerjaan. Implementation Plan bukan pengganti spesifikasi. Jika ada perbedaan, gunakan dokumen pemilik keputusan untuk menentukan perilaku yang benar, lalu perbarui Implementation Plan.

### Dokumen audit

Laporan audit repository mencatat perbedaan antara spesifikasi aktif dan kondisi implementasi pada saat audit dilakukan. Audit adalah **snapshot kondisi repository**, bukan spesifikasi produk atau desain permanen.

Setiap temuan audit perlu ditutup dengan perubahan kode/dokumen dan bukti verifikasi. Jangan menganggap status audit otomatis selesai hanya karena task sudah dikerjakan.

---

## 3. Sumber kebenaran dan urutan otoritas

Tidak ada satu dokumen yang menjadi sumber kebenaran untuk semua hal. Gunakan dokumen yang memiliki tanggung jawab atas keputusan tersebut.

| Pertanyaan | Dokumen acuan utama |
|---|---|
| Apa tujuan dan scope produk? | PRD |
| Apa requirement yang harus dipenuhi? | Requirements |
| Apa entitas domain dan relasinya? | Domain Map |
| Bagaimana struktur dan dependency aplikasi? | Architecture + ADR |
| Bagaimana struktur data dan invariant database? | Database Specification |
| Siapa yang boleh melakukan tindakan tertentu? | Permissions |
| Apa aturan umum API? | API Conventions |
| Apa perilaku endpoint tertentu? | API Contract |
| Apa urutan implementasinya? | Implementation Plan |
| Apa yang belum sesuai di repository saat audit? | Repository Audit |

### Aturan menyelesaikan konflik

Jika dua dokumen tampak bertentangan:

1. Identifikasi keputusan yang dipersoalkan dan dokumen pemiliknya.
2. Periksa versi dan status dokumen. Jangan memakai dokumen historis atau arsip sebagai keputusan aktif.
3. Periksa apakah konflik tersebut memang konflik atau hanya dua dokumen yang membahas aspek berbeda.
4. Jika keputusan perlu berubah, revisi dokumen pemilik keputusan terlebih dahulu.
5. Perbarui semua dokumen turunan yang terdampak.
6. Perbarui implementasi, OpenAPI, migration, dan tests sesuai perubahan.
7. Catat keputusan arsitektur yang berdampak luas melalui ADR.

Jangan menyelesaikan konflik dengan memilih dokumen yang paling baru diedit secara otomatis. Tanggung jawab dokumen lebih penting daripada timestamp file.

---

## 4. Hubungan antar-dokumen

Alur konseptual dokumentasi:

```text
Product
  PRD
   |
  Requirements
   |
Domain & Design
  Domain Map
   |
  Architecture + ADR
   |
  Database Specification
  Permissions
  API Conventions
   |
  API Contract
   |
Implementation Plan
   |
Implementation
  Source code + migrations + tests + OpenAPI
   |
Verification
  CI + repository audit + operational evidence
```

Hubungan ini bukan berarti semua dokumen harus selalu diedit bersamaan. Perubahan dilakukan berdasarkan dampaknya.

Contoh:
- Perubahan lifecycle Membership dapat memengaruhi Database Specification, Permissions, API Contract, Domain Map, Implementation Plan, migration, service, dan tests.
- Perubahan response envelope dapat memengaruhi API Conventions, API Contract, OpenAPI, error middleware, dan tests.
- Perubahan role dapat memengaruhi Permissions, API Contract, authorization logic, dan tests.
- Perubahan arsitektur dapat memerlukan ADR, Architecture, Implementation Plan, serta dependency antar-package.

---

## 5. Dokumentasi dan implementasi

Untuk setiap fitur, jaga konsistensi setidaknya pada lima lapisan:

1. **Domain:** aturan bisnis dan lifecycle entitas.
2. **Database:** constraints, foreign keys, indexes, invariants, dan transaction/concurrency behavior.
3. **API:** endpoint, request/response, authorization, validation, dan error semantics.
4. **Implementation:** layer ownership, service/use case, persistence adapter, dan transport handler.
5. **Verification:** unit/integration tests, migration checks, OpenAPI validation, dan CI.

Fitur belum dianggap selesai hanya karena endpoint merespons sukses. Periksa juga tenant isolation, authorization, failure path, transaction atomicity, dan concurrency behavior jika relevan.

OpenAPI harus menggambarkan kontrak endpoint yang memang disepakati dan implementasinya. Modular OpenAPI source merupakan sumber untuk menghasilkan bundled specification. Jangan mengedit generated bundle secara manual jika bundle tersebut dihasilkan dari source modular.

---

## 6. Aturan pemeliharaan dokumentasi

### Saat menambah fitur

- Periksa dokumen pemilik domain sebelum menulis kode.
- Pastikan requirement dan acceptance criteria jelas.
- Perbarui API Contract jika public API berubah.
- Perbarui Database Specification jika model, constraint, atau invariant berubah.
- Perbarui Permissions jika aturan akses berubah.
- Perbarui Implementation Plan jika dependency atau urutan pekerjaan berubah.
- Tambahkan atau perbarui tests dan OpenAPI.

### Saat mengubah keputusan

- Jangan mengubah keputusan lintas-domain hanya melalui perubahan kode.
- Perbarui dokumen pemilik keputusan terlebih dahulu.
- Gunakan ADR untuk keputusan arsitektur yang memiliki konsekuensi jangka panjang.
- Perbarui dokumen turunan dan catat dampaknya.

### Saat menyelesaikan pekerjaan

- Hapus TODO yang sudah tidak relevan.
- Jangan mempertahankan dua dokumen aktif yang menyatakan keputusan berbeda.
- Jangan menyalin spesifikasi penuh ke banyak dokumen. Gunakan referensi ke dokumen pemilik.
- Tandai dokumen yang sudah digantikan sebagai superseded atau pindahkan ke arsip dengan status yang jelas.

---

## 7. Versi aktif dan arsip

Dokumen dengan nomor versi pada nama file menunjukkan baseline versi yang sedang dirujuk oleh project, misalnya `database-specification-v1.3.md`.

Folder `archive/`, jika ada, berisi materi historis. Dokumen di dalamnya **bukan sumber keputusan aktif** kecuali dokumen aktif secara eksplisit merujuknya untuk konteks sejarah.

Jika ada perbedaan antara dokumen aktif dan arsip, ikuti dokumen aktif. Jangan menghidupkan kembali keputusan lama hanya karena masih ada di repository.

---

## 8. Status dokumentasi bukan status implementasi

Keberadaan spesifikasi tidak berarti fiturnya sudah dibuat. Sebaliknya, keberadaan kode tidak berarti implementasinya sudah sesuai spesifikasi.

Gunakan pembedaan berikut:

- **Specified:** perilaku atau desain sudah didefinisikan dalam dokumen.
- **Planned:** pekerjaan masuk rencana implementasi.
- **Implemented:** kode sudah dibuat.
- **Verified:** behavior telah diuji dan bukti verifikasi tersedia.
- **Released:** fitur telah dirilis sesuai proses deployment project.

Status tersebut tidak boleh dipertukarkan. Khususnya, `Implemented` tidak otomatis berarti `Verified`.

---

## 9. Checklist sebelum merge

- [ ] Perubahan sesuai dokumen pemilik keputusan.
- [ ] Tidak ada konflik baru antar-dokumen aktif.
- [ ] Database constraints dan tenant boundary tetap terjaga.
- [ ] Authorization dan validation sesuai kontrak.
- [ ] Error response dan logging tidak membocorkan data sensitif.
- [ ] Transaction dan concurrency behavior diuji jika relevan.
- [ ] Migration tersedia dan aman untuk data yang ada.
- [ ] OpenAPI diperbarui untuk perubahan public API.
- [ ] Tests relevan berhasil dijalankan.
- [ ] Lint, typecheck, build, dan CI berhasil.
- [ ] Implementation Plan dan audit/remediation status diperbarui jika diperlukan.

---

## 10. Prinsip penutup

Dokumentasi harus mengurangi ambiguitas, bukan menambah birokrasi. Satu keputusan sebaiknya memiliki satu dokumen pemilik yang jelas. Dokumen lain boleh menjelaskan dampaknya, tetapi tidak boleh mendefinisikan ulang keputusan tersebut secara independen.

Jika kode, tests, OpenAPI, dan spesifikasi tidak sepakat, anggap pekerjaan belum selesai sampai perbedaannya diselesaikan secara eksplisit.
