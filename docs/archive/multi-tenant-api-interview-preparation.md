# Multi-Tenant Project Management API

## Interview Preparation Guide

> **Tujuan:** Membantu persiapan menjelaskan proyek saat screening
> recruiter/HR dan technical interview.
>
> **Penting:** Dokumen ini membedakan desain yang sudah ditentukan dari
> fitur yang sudah benar-benar diimplementasikan. Saat ini domain
> features masih dalam tahap perencanaan. Jangan mengklaim fitur,
> testing, deployment, atau performa sudah selesai sebelum ada
> implementasi dan bukti verifikasinya.

## 1. Ringkasan proyek

**Multi-Tenant Project Management API** adalah backend API untuk
aplikasi manajemen proyek kolaboratif, dengan konsep yang terinspirasi
dari Jira atau Linear.

Satu aplikasi melayani banyak organisasi. Setiap organisasi memiliki
anggota, role, project, issue, comment, activity, dan notification.
Tantangan utamanya bukan sekadar CRUD, melainkan menjaga isolasi data
antar-organisasi, authorization, integritas data, dan konsistensi ketika
beberapa request berjalan bersamaan.

**Tech stack** - Node.js 24 + TypeScript - Express 5 - PostgreSQL 18 -
Prisma ORM 7 + PostgreSQL adapter - Zod - Vitest + Supertest - Pino -
Docker Compose - pnpm workspace / monorepo - GitHub Actions untuk CI

**Status saat ini:** Analisis domain, spesifikasi API, spesifikasi
database, dan implementation plan V1 sudah disusun. Fondasi repository
dan CI telah dipersiapkan. Implementasi fitur domain belum dimulai.

### Jawaban 30 detik

"Saya sedang membangun backend API untuk aplikasi project management
multi-tenant menggunakan Node.js, TypeScript, Express, dan PostgreSQL.
Tantangan utamanya adalah memastikan pengguna dari organisasi berbeda
tidak bisa mengakses data satu sama lain, sekaligus menjaga
authorization dan konsistensi data. Saya sudah menyusun domain model,
API contract, database constraints, dan aturan concurrency sebelum masuk
ke implementasi bertahap."

Sesuaikan kalimat terakhir seiring progres implementasi.

## 2. Masalah yang diselesaikan

**Multi-tenancy** berarti satu aplikasi melayani beberapa organisasi
atau customer, dengan batas akses data yang jelas di antara mereka.

Contoh: - Satu User dapat menjadi anggota Organization A dan
Organization B. - User tersebut bisa menjadi Owner di A, tetapi Member
di B. - Keanggotaan di A tidak boleh otomatis memberikan akses ke data
B. - Request harus memverifikasi identitas, membership aktif, konteks
organisasi, dan permission terhadap resource.

Tiga konsep yang harus dibedakan:

-   **Authentication:** siapa yang membuat request?
-   **Authorization:** apakah identitas tersebut boleh melakukan
    tindakan ini?
-   **Tenant isolation:** apakah resource berada dalam konteks
    organisasi yang boleh diakses?

## 3. Domain model

Domain V1 memiliki 11 entitas utama:

  -----------------------------------------------------------------------
  Entitas                             Tanggung jawab
  ----------------------------------- -----------------------------------
  User                                Identitas pengguna global

  Session                             Sesi autentikasi server-side

  Organization                        Batas tenant

  Membership                          Hubungan User dengan Organization
                                      beserta role dan status

  Invitation                          Undangan bergabung ke Organization

  Project                             Project milik Organization

  Issue                               Work item di dalam Project

  Comment                             Diskusi pada Issue

  Activity                            Catatan append-only atas perubahan
                                      penting

  Notification                        Notifikasi untuk pengguna

  OutboxEvent                         Pekerjaan asynchronous yang harus
                                      diproses, misalnya email undangan
  -----------------------------------------------------------------------

Relasi penting: - User dapat memiliki Membership di banyak
Organization. - Satu Membership menghubungkan satu User dengan satu
Organization. - Organization memiliki Projects. - Project memiliki
Issues. - Issue dapat ditugaskan kepada Membership. - Comment terkait
dengan Issue. - Activity mencatat event penting pada organisasi. -
Notification ditujukan kepada pengguna tertentu. - OutboxEvent menyimpan
pekerjaan eksternal agar dapat diproses ulang setelah kegagalan.

**Mengapa Issue ditugaskan ke Membership, bukan langsung ke User?**

Role dan akses bersifat spesifik terhadap organisasi. User yang sama
bisa memiliki role berbeda di organisasi berbeda. Referensi ke
Membership membuat konteks organisasi eksplisit dan memungkinkan
database memastikan assignee berasal dari organisasi yang sama.

**Mengapa Issue menyimpan `organization_id` dan `project_id`?**

Agar konteks tenant eksplisit dan composite foreign key dapat memastikan
Project yang direferensikan memang milik Organization yang sama. Ini
mencegah relasi lintas tenant yang tidak valid.

## 4. Authorization

Role V1: - `OWNER` - `ADMIN` - `MEMBER`

Tidak ada role `GUEST` pada V1.

Aturan penting: - Semua role boleh membuat Project. - Owner dapat
mengundang Admin dan Member. - Admin hanya dapat mengundang Member. -
Member tidak dapat mengundang. - Owner dan Admin dapat mengelola
Membership dengan batasan tertentu. - Tidak boleh menghapus atau
menurunkan role Owner terakhir. - Member aktif dapat mengelola Issue
yang dapat diaksesnya. - Member hanya dapat mengubah atau menghapus
Comment miliknya; Owner dan Admin dapat mengelola Comment anggota lain.

Saat memeriksa permission, sistem perlu memastikan: 1. User sudah
terautentikasi. 2. User memiliki Membership aktif pada Organization
terkait. 3. Resource benar-benar milik tenant tersebut. 4. Tindakan
diizinkan oleh role dan aturan resource. 5. Status resource memungkinkan
tindakan tersebut.

**404 versus 403** - `404 Not Found`: resource berada di luar konteks
tenant yang dapat diakses atau User tidak memiliki Membership aktif. -
`403 Forbidden`: User adalah anggota aktif tetapi tidak memiliki
permission untuk tindakan tersebut.

Tujuannya adalah mengurangi kebocoran informasi tentang keberadaan
resource lintas tenant.

## 5. Authentication

Desain V1 menggunakan **opaque database-backed Bearer session token**,
bukan JWT.

Perilaku yang direncanakan: - Token acak kriptografis sepanjang 32
byte. - Raw token dikirim ke client. - Database hanya menyimpan hash
SHA-256 token. - Masa berlaku 7 hari. - Refresh melakukan rotasi session
secara atomik. - Logout mencabut session saat ini. - Dua request refresh
bersamaan tidak boleh sama-sama berhasil merotasi session lama.

**Mengapa opaque session, bukan JWT?**

Opaque token adalah identifier acak yang validitasnya diperiksa terhadap
state session di server.

Keuntungan: - Revocation lebih sederhana. - Lifecycle session
terpusat. - Expiry dan rotation mudah dikendalikan.

Trade-off: - Request terautentikasi membutuhkan lookup session ke
database, kecuali ditambahkan cache dengan desain yang tepat.

JWT bukan teknologi yang buruk; ia memiliki trade-off berbeda. Untuk
kebutuhan V1 ini, kontrol session di server lebih diprioritaskan.

**Mengapa menyimpan hash token?**

Jika tabel session terekspos, attacker tidak langsung memperoleh bearer
token yang dapat digunakan. Database menyimpan verifier, bukan
credential mentah.

## 6. Database dan integritas data

PostgreSQL menjadi relational source of truth. Prisma menjadi akses data
utama, dengan custom SQL migration untuk fitur PostgreSQL yang tidak
cukup terwakili oleh Prisma schema.

Keputusan penting: - UUID v4 dibuat oleh aplikasi. - Timestamp UTC
menggunakan `TIMESTAMPTZ(3)`, sesuai presisi milidetik JavaScript
Date. - Composite foreign keys untuk integritas tenant. -
`ON DELETE RESTRICT` untuk relasi domain. - Database constraints untuk
invariant yang deterministik. - Partial unique indexes ketika keunikan
hanya berlaku pada subset baris. - `updated_at` dikelola aplikasi. -
Prisma Migrate menjadi otoritas migration.

**Mengapa PostgreSQL?**

Domain memiliki banyak relasi dan invariant: organization, membership,
project, issue, assignment, dan comment. Relational database menyediakan
foreign key, unique constraint, transaction, dan row-level locking yang
berguna untuk menjaga konsistensi tersebut.

**Mengapa validasi aplikasi saja tidak cukup?**

Validasi aplikasi menjaga batas API dan memberikan pesan error yang
baik. Constraint database melindungi data dari semua jalur penulisan,
termasuk kesalahan pada code path lain.

**Prisma versus raw SQL**

Prisma memberi type-safe data access, tetapi tidak menggantikan
pemahaman SQL. Partial index, CHECK constraint tertentu, advisory lock,
atau `SELECT ... FOR UPDATE` mungkin memerlukan custom SQL migration
atau raw SQL.

## 7. Transaction dan concurrency

Transaction mengelompokkan perubahan database sehingga semuanya commit
atau rollback bersama.

Contoh pembuatan Organization: 1. Insert Organization. 2. Insert Owner
Membership untuk pembuat. 3. Insert Activity.

Ketiganya harus berhasil atau gagal sebagai satu unit. Jika tidak,
sistem bisa memiliki Organization tanpa Owner Membership.

**Race condition pada Last Owner**

Misalnya ada dua Owner. Dua request bersamaan masing-masing memeriksa
bahwa masih ada dua Owner, lalu mencoba menghapus Owner yang berbeda.
Tanpa koordinasi, keduanya mungkin berhasil dan organisasi kehilangan
seluruh Owner.

Desain menggunakan Organization row lock untuk menyerialisasi operasi
yang memengaruhi invariant Last Owner, kemudian melakukan perubahan
Membership yang diperlukan.

**Optimistic Concurrency Control (OCC)**

Client mengirim expected version. Update hanya berhasil jika version di
database masih sama. Jika resource sudah diubah request lain, update
tidak cocok dan API mengembalikan `409 Conflict`.

**Pessimistic locking versus OCC** - Pessimistic locking
mengoordinasikan operasi dengan lock sebelum perubahan. - OCC membiarkan
operasi berjalan, lalu mendeteksi konflik ketika update dilakukan.

Keduanya menyelesaikan masalah berbeda. Desain menggunakan explicit
locking untuk invariant multi-row yang kritis dan OCC untuk stale client
updates.

## 8. Invitation dan transactional outbox

Email merupakan efek samping eksternal dan tidak dapat dijadikan bagian
dari transaction PostgreSQL biasa.

Flow yang direncanakan: 1. Buat Invitation dan OutboxEvent dalam satu
transaction. 2. Worker mengambil OutboxEvent yang pending. 3. Worker
mengirim email. 4. Worker menandai event berhasil atau menjadwalkan
retry. 5. Lease memungkinkan worker lain memulihkan pekerjaan jika
worker awal crash.

Retry yang direncanakan: satu percobaan awal dan maksimal tiga retry
pada menit ke-1, ke-5, dan ke-15.

**Mengapa transactional outbox?**

Tanpa outbox, transaction bisa commit lalu proses crash sebelum email
dikirim. Sebaliknya, email bisa terkirim lalu proses crash sebelum
status pengiriman dicatat.

Outbox membuat niat untuk melakukan pekerjaan eksternal tersimpan secara
durable dan dapat dipulihkan.

**At-least-once delivery**

Outbox memberikan pemrosesan at-least-once, bukan exactly-once. Worker
mungkin berhasil mengirim email lalu crash sebelum mencatat
keberhasilan, sehingga pengiriman dicoba lagi. Sistem harus mampu
menangani kemungkinan percobaan duplikat.

## 9. API design

Base path:

`/api/v1`

Kelompok resource: - Authentication - Organizations - Memberships -
Invitations - Projects - Issues - Comments - Activities - Notifications

Format error:

``` json
{
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human-readable explanation"
  }
}
```

Konvensi status: - `400`: request validation failure. - `401`: tidak
terautentikasi atau authentication tidak valid. - `403`: anggota aktif
tidak memiliki permission. - `404`: resource tidak dapat diakses dalam
konteks tenant. - `409`: concurrency conflict atau stale version. -
`422`: transisi domain tidak valid.

Issue memiliki state: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`,
`CANCELLED`.

Perubahan status harus mengikuti state transition yang diizinkan, bukan
sekadar menerima string status apa pun.

## 10. Testing strategy

Rencana lapisan pengujian:

  -----------------------------------------------------------------------
  Jenis                               Fokus
  ----------------------------------- -----------------------------------
  Unit                                Domain rules dan logic terisolasi

  Integration                         Interaksi dengan PostgreSQL dan
                                      infrastruktur nyata

  API/HTTP                            Request, middleware, validation,
                                      status, response contract

  End-to-end                          Alur lengkap lintas beberapa
                                      komponen

  Security/concurrency                Tenant isolation, authorization,
                                      race condition, invariant
  -----------------------------------------------------------------------

Vitest digunakan sebagai test runner dan Supertest untuk menguji HTTP
application.

Contoh test penting: - User Organization A tidak dapat membaca Issue
Organization B. - Member tidak dapat mengundang pengguna. - Admin tidak
dapat mengundang Admin. - Owner terakhir tidak dapat dihapus atau
diturunkan role-nya. - Issue tidak dapat ditugaskan kepada Membership
dari Organization lain. - Dua refresh request bersamaan tidak dapat
merotasi session lama dua kali. - Dua operasi bersamaan tidak dapat
menghapus dua Owner terakhir. - Update dengan version lama menghasilkan
`409`. - Kegagalan email tidak membatalkan Invitation yang sudah dibuat.

Untuk aplikasi multi-tenant, negative authorization tests sama
pentingnya dengan happy-path tests.

## 11. Architecture

Arah arsitektur yang dipilih adalah **Modular Monolith dengan pragmatic
Clean Architecture**. Ini masih merupakan arah desain yang harus
divalidasi melalui implementasi.

**Modular monolith:** aplikasi tetap satu unit deployment, tetapi kode
dibagi menjadi modul domain seperti Auth, Organizations, Memberships,
Invitations, Projects, Issues, Comments, Activities, dan Notifications.

**Pragmatic Clean Architecture:** business rules dijaga agar tidak
bergantung langsung pada framework atau infrastruktur jika pemisahan
tersebut memberi manfaat.

Pembagian tanggung jawab konseptual: - **Domain:** business concepts,
invariants, domain rules. - **Application:** use-case orchestration. -
**Infrastructure:** Prisma, PostgreSQL, email provider, logging. -
**Presentation:** Express routes, controllers, request/response mapping.

Jangan mengklaim implementasi sudah sepenuhnya mengikuti Clean
Architecture sebelum dependency boundaries benar-benar terlihat di kode.

**Mengapa bukan microservices?**

V1 direncanakan berjalan sebagai satu aplikasi pada satu VPS. Modular
monolith lebih sederhana untuk dikembangkan, diuji, dideploy, dan
dioperasikan. Pemisahan service baru layak dipertimbangkan jika
kebutuhan scaling, ownership tim, atau operasional memang
membenarkannya.

## 12. Reliability dan operations

Rencana operasional V1: - Satu VPS. - API dan PostgreSQL sebagai
container Docker Compose terpisah. - Database hanya dapat diakses
melalui internal network. - Persistent database volume. - Backup
terenkripsi di luar VPS. - `pg_dump` harian. - Retensi 7 backup harian
dan 4 backup mingguan. - Target RPO 24 jam. - Target RTO 4 jam. -
Liveness dan readiness endpoint terpisah. - Structured logs dengan
request ID. - Metrics request, error, latency, CPU, memory, dan
database/query duration. - SSH key authentication, non-root deployment,
firewall, HTTPS, dan least privilege.

RPO adalah jumlah maksimum kehilangan data yang dapat diterima, diukur
dalam waktu. RTO adalah target waktu pemulihan layanan.

Target ini masih berupa rencana operasional. Jangan menyebutnya sebagai
jaminan pemulihan sampai backup restore dan recovery drill benar-benar
diuji.

## 13. Trade-off keputusan teknis

  -----------------------------------------------------------------------
  Keputusan               Alasan untuk V1         Trade-off
  ----------------------- ----------------------- -----------------------
  PostgreSQL              Relasi dan integritas   Perlu disiplin schema
                          data kuat               dan SQL

  Opaque DB-backed        Revocation dan          Lookup database pada
  session                 lifecycle mudah         request terautentikasi
                          dikontrol               

  Modular monolith        Batas modul tanpa       Perlu disiplin menjaga
                          kompleksitas            module boundaries
                          distributed system      

  Prisma + custom SQL     Type-safe access dan    Sebagian migration
                          fitur PostgreSQL        perlu SQL manual

  Composite foreign keys  Integritas tenant       Schema dan query lebih
                          dijaga database         kompleks

  Soft archive/removal    Riwayat dan referensi   Lebih banyak state dan
                          dipertahankan           filtering

  Transactional outbox    Pekerjaan eksternal     Perlu worker, lease,
                          durable                 retry, dan toleransi
                                                  duplikasi

  Locking + OCC           Menjaga invariant dan   Desain transaction
                          mendeteksi stale update lebih rumit

  Single VPS              Operasional V1 lebih    Availability dan
                          sederhana               horizontal scaling
                                                  terbatas
  -----------------------------------------------------------------------

Jawaban interview yang baik tidak menyebut satu pilihan sebagai yang
terbaik untuk semua situasi. Jelaskan requirement, alasan pilihan, dan
biaya yang menyertainya.

## 14. Pertanyaan recruiter / HR

### "Ceritakan project yang sedang kamu kerjakan."

Gunakan ringkasan 30 detik pada bagian pertama. Mulai dari produk dan
masalahnya, bukan daftar teknologi.

### "Kenapa memilih project ini?"

"Saya ingin membangun project yang lebih kompleks daripada CRUD dasar
dan memberi kesempatan untuk menghadapi masalah backend yang realistis.
Multi-tenancy membawa tantangan pada access control, data integrity, dan
concurrent operations. Melalui project ini saya ingin menunjukkan cara
saya merancang sistem backend, bukan hanya menggunakan framework."

### "Apa peranmu?"

Untuk portfolio solo:

"Saya bertanggung jawab atas project ini dari awal sampai akhir:
memahami kebutuhan, merancang domain dan API, mengambil keputusan
teknis, mengimplementasikan backend, menulis test, dan menyiapkan
deployment."

Sesuaikan dengan pekerjaan yang benar-benar sudah selesai.

### "Apa bagian paling menantang?"

Selama masih tahap desain:

"Bagian paling menantang sejauh ini adalah mendefinisikan authorization
dan data integrity lintas tenant. Satu user bisa memiliki role berbeda
di beberapa organisasi. Jadi, memeriksa apakah user sudah login saja
tidak cukup. Sistem juga harus memeriksa active membership, kepemilikan
tenant, dan permission untuk operasi tertentu."

Setelah implementasi, ganti dengan contoh bug atau masalah engineering
yang benar-benar kamu selesaikan.

### "Bagaimana kamu menggunakan AI?"

"Saya menggunakan AI sebagai engineering assistant untuk mengeksplorasi
alternatif, mereview desain, menghasilkan kandidat implementasi, dan
membantu investigasi error. Saya tidak menganggap kode hasil generasi
otomatis benar. Saya memverifikasi perilakunya melalui test, memeriksa
efek pada database, dan memastikan saya dapat menjelaskan desain serta
trade-off-nya."

Gunakan jawaban ini hanya jika memang mencerminkan praktikmu.

### "Apa yang kamu pelajari?"

Pilih pembelajaran yang spesifik: - Menerjemahkan business rules menjadi
database constraints. - Membedakan authentication, authorization, dan
tenant isolation. - Memahami transaction boundary dan concurrency. -
Menguji failure cases, bukan hanya happy path. - Memilih teknologi
berdasarkan trade-off, bukan popularitas.

### "Apa yang akan kamu tingkatkan di versi berikutnya?"

Kemungkinan area: - Search yang lebih baik. - Notification delivery yang
lebih matang. - Monitoring operasional yang lebih kuat. - Point-in-time
recovery. - Workflow customization. - Horizontal scaling jika pengukuran
menunjukkan kebutuhan.

Jangan menyajikan rencana V2 sebagai fitur yang sudah tersedia.

### "Kenapa kami harus merekrut fresh graduate?"

"Saya masih berada di awal karier, jadi saya tidak mengklaim pengalaman
production bertahun-tahun. Yang bisa saya tunjukkan adalah pendekatan
engineering yang terstruktur: memahami requirement, menjelaskan
trade-off desain, mengimplementasikan dan menguji fitur, menginvestigasi
kegagalan, serta mempelajari bagian stack yang belum saya kuasai. Saya
mencari tim tempat saya bisa menerapkan fondasi tersebut dan berkembang
melalui pekerjaan engineering nyata."

## 15. Pertanyaan technical interview yang perlu dipersiapkan

**Backend** 1. Apa yang terjadi ketika HTTP request masuk ke Express? 2.
Apa itu middleware dan mengapa urutannya penting? 3. Apa perbedaan
authentication dan authorization? 4. Mengapa input harus divalidasi di
API boundary? 5. Bagaimana error seharusnya mengalir di aplikasi?

**Database** 6. Apa itu foreign key? 7. Apa itu composite foreign key
dan mengapa digunakan di sini? 8. Apa itu transaction? 9. Apa arti ACID?
10. Apa itu index dan apa biaya write/storage-nya? 11. Apa itu partial
unique index? 12. Apa perbedaan READ COMMITTED dengan isolation level
yang lebih kuat?

**Concurrency** 13. Apa itu race condition? 14. Apa fungsi
`SELECT ... FOR UPDATE`? 15. Apa itu optimistic concurrency control? 16.
Bagaimana dua request bisa melanggar invariant Last Owner? 17. Apa itu
deadlock dan bagaimana lock ordering membantu mengurangi risikonya?

**Architecture** 18. Mengapa memilih modular monolith? 19. Apa tanggung
jawab domain, application, infrastructure, dan presentation? 20. Apa
tanggung jawab use case/service dan repository? 21. Kapan abstraction
berguna dan kapan justru berlebihan?

**Reliability dan testing** 22. Apa itu transactional outbox? 23.
Mengapa exactly-once delivery sulit? 24. Apa perbedaan unit,
integration, API, dan E2E testing? 25. Bagaimana menguji tenant
isolation? 26. Apa itu RPO dan RTO? 27. Bagaimana menginvestigasi
endpoint API yang lambat?

## 16. Cara melaporkan progres secara jujur

Gunakan tabel ini sebelum menulis CV atau menjawab interviewer.

  -------------------------------------------------------------------------------
  Area                    Status saat ini         Kapan boleh disebut selesai
  ----------------------- ----------------------- -------------------------------
  Domain analysis         Sudah dispesifikasikan  Dapat menjelaskan dan
                                                  mempertahankan business rules

  API contract            Sudah dispesifikasikan  Contract diimplementasikan dan
                                                  diverifikasi

  Database design         Sudah dispesifikasikan  Migration diterapkan dan
                                                  constraint diuji

  Authentication          Direncanakan            Register/login/refresh/logout
                                                  berjalan dan test lulus

  Organization &          Direncanakan            Use case dan authorization test
  Membership                                      lulus

  Invitation & outbox     Direncanakan            Worker, retry, dan failure
                                                  recovery diverifikasi

  Projects & Issues       Direncanakan            CRUD, transition, assignment,
                                                  dan tenant check lulus

  Comments & Activity     Direncanakan            Mutation dan audit behavior
                                                  diverifikasi

  Notifications           Direncanakan            Persistence, recipient rules,
                                                  dan read behavior diuji

  CI                      Fondasi dipersiapkan    Pipeline berjalan konsisten
                                                  pada repository

  Deployment              Direncanakan            Environment ter-deploy dan
                                                  operational checks berhasil

  Backup                  Direncanakan            Restore sudah diuji, bukan
                                                  hanya konfigurasi backup
  -------------------------------------------------------------------------------

Untuk setiap vertical slice yang selesai, simpan bukti: - Apa yang
diimplementasikan? - Test apa yang lulus? - Edge case penting apa yang
diverifikasi? - Apa yang berubah dari desain awal? - Apa yang masih
belum selesai?

Dengan begitu, kamu punya cerita interview yang konkret, bukan klaim
yang dihafalkan.

## 17. Draft CV entry

Gunakan setelah pekerjaan terkait benar-benar diimplementasikan. Selama
masih berlangsung, tampilkan sebagai project in progress dan jangan
mengklaim production readiness.

**Multi-Tenant Project Management API**\
*Node.js, TypeScript, Express, PostgreSQL, Prisma, Zod, Vitest,
Supertest, Docker*

-   Designed a multi-tenant project-management backend with
    organization-scoped memberships, role-based authorization, projects,
    issues, comments, activities, and notifications.
-   Designed tenant-integrity safeguards using composite foreign keys,
    database constraints, and transaction boundaries.
-   Specified opaque database-backed sessions, invitation workflows, and
    transactional outbox processing.
-   Planned layered verification covering unit, integration, API,
    end-to-end, security, and concurrency scenarios.

Ganti kata "Designed", "Specified", dan "Planned" dengan kata kerja
implementasi hanya setelah pekerjaan tersebut selesai dan memiliki
bukti.

## 18. Metode persiapan interview

Jangan menghafal seluruh dokumen. Untuk setiap topik, siapkan empat hal:

1.  **Problem:** Apa yang bisa salah?
2.  **Decision:** Apa yang dipilih?
3.  **Reasoning:** Mengapa pilihan itu menjawab masalah?
4.  **Trade-off:** Apa konsekuensi atau biaya dari pilihan itu?

Untuk cerita teknis, tambahkan:

5.  **Evidence:** Implementasi, test, log, atau pengukuran apa yang
    membuktikan bahwa solusi bekerja?

Urutan prioritas belajar: 1. Jelaskan produk dan penggunanya. 2.
Jelaskan multi-tenancy dan authorization. 3. Jelaskan domain model. 4.
Jelaskan authentication dan database integrity. 5. Jelaskan transaction
dan concurrency. 6. Jelaskan architecture dan testing. 7. Jelaskan
deployment dan operational trade-offs. 8. Jelaskan apa yang benar-benar
kamu implementasikan dan pelajari.

**Tujuannya bukan terdengar seperti senior engineer. Tujuannya
menunjukkan bahwa kamu memahami project sendiri, mampu bernalar tentang
keputusan engineering, jujur mengenai progres, dan dapat belajar
berdasarkan bukti.**
