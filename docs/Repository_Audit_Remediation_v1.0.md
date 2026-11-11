# Repository Consistency & Remediation Audit

**Tanggal:** 9 November 2026  
**Versi:** 1.0  
**Status:** Audit statis selesai; perbaikan belum diterapkan  
**Repository yang diperiksa:** `multi-tenant-project-management-main.zip`  
**Dokumen acuan:** PRD V1.2, Requirements V1.2, Domain Map V1.2, Permissions V1.1, Database Specification V1.3, API Contract, API Conventions, Architecture, ADR-001, Cross-Document Consistency Review V1.1, Implementation Plan V1.1  
**Tujuan:** Menghasilkan satu daftar temuan yang dapat dipakai untuk mengurutkan pekerjaan perbaikan dan implementasi berikutnya.

---

## 1. Ringkasan eksekutif

Repository bukan greenfield. Fondasi API sudah ada: workspace pnpm, Express 5, Prisma 7, PostgreSQL, autentikasi berbasis session, Organization creation, middleware umum, OpenAPI modular, PostgreSQL integration tests, dan GitHub Actions.

Namun, repository saat ini baru mengimplementasikan sebagian kecil dari kontrak V1.2. Implementasi nyata terutama mencakup Identity dasar dan pembuatan Organization. Sebagian besar domain V1 seperti Membership lifecycle, Invitation, Project, Issue, Label, Comment, Activity, Notification, dan Outbox belum tersedia sebagai implementasi.

Ada pula beberapa mismatch yang harus dibereskan sebelum fitur baru dibangun di atas fondasi yang salah:
1. Model `Membership` belum memenuhi Database Specification V1.3.
2. Kontrak API mewajibkan Session refresh, tetapi route refresh tidak ada.
3. Create Organization belum membuat Activity secara atomik seperti kontrak API.
4. Service Application mengakses Prisma secara langsung, bertentangan dengan dependency boundary ADR-001.
5. OpenAPI belum mencakup kontrak API yang disetujui dan belum divalidasi oleh CI.
6. Repository ZIP tidak memuat `apps/web`, walaupun Architecture dan Implementation Plan mendefinisikan workspace `apps/api` dan `apps/web`.

**Kesimpulan:** repository layak menjadi titik awal implementasi, tetapi belum layak dinyatakan siap untuk feature delivery V1 secara menyeluruh. Prioritas pertama adalah memperbaiki fondasi dan menyelaraskan implementasi Identity/Organization dengan spesifikasi. Setelah itu, lanjutkan vertical slice berdasarkan dependency order pada Implementation Plan.

Audit ini bersifat statis. Tidak ada klaim bahwa lint, typecheck, build, migration, atau test berhasil dijalankan dari ZIP.

## 2. Cara membaca status

| Status | Arti |
|---|---|
| `MATCH` | Bukti yang terlihat konsisten dengan dokumen acuan untuk bagian yang diperiksa. |
| `MISMATCH` | Implementasi yang ada bertentangan dengan keputusan atau kontrak yang disetujui. |
| `MISSING` | Kapabilitas yang diwajibkan untuk V1 belum ditemukan pada repository. |
| `PARTIAL` | Sebagian implementasi ada, tetapi belum memenuhi seluruh acceptance criteria. |
| `UNVERIFIED` | Bukti statis tidak cukup untuk memastikan perilaku atau hasil eksekusi. |
| `OUT OF SCOPE` | Tidak dinilai sebagai kewajiban implementasi saat ini atau secara eksplisit bukan target V1. |

Prioritas:
- **P0 - Blocker:** harus dibereskan sebelum memperluas implementasi yang bergantung padanya.
- **P1 - High:** harus dibereskan pada foundation atau sebelum domain terkait dibangun.
- **P2 - Medium:** perlu diselesaikan sebelum domain/release terkait dianggap selesai.
- **P3 - Later:** hardening atau optimasi yang menunggu bukti/workload/keputusan tambahan.

## 3. Batas audit dan sumber kebenaran

### 3.1 Yang diperiksa

- Seluruh daftar file dalam source ZIP.
- Root `package.json`, `pnpm-workspace.yaml`, lockfile presence, Docker Compose, dan GitHub Actions workflow.
- Prisma schema dan migration files.
- Express app, routes, controllers, services, repositories, middleware, dan konfigurasi.
- Test files dan helper yang disertakan.
- Modular OpenAPI source, bundled OpenAPI, dan README OpenAPI.
- Dokumen aktif pada docs ZIP serta dokumen kerja terbaru yang tersedia di workspace.

### 3.2 Yang tidak dilakukan

- Tidak menjalankan `pnpm install`, lint, typecheck, build, test, atau migration.
- Tidak menguji API terhadap PostgreSQL hidup.
- Tidak melakukan penetration test, load test, benchmark, backup/restore test, atau deployment test.
- Tidak menganggap isi `docs/archive` sebagai keputusan aktif.
- Tidak mengubah source code, Prisma schema, migration, atau dokumen spesifikasi.

### 3.3 Catatan otoritas dokumen

Dokumen aktif yang dipakai adalah versi terbaru yang disebut dalam Implementation Plan V1.1. Dokumen lama di `docs/archive` dan planning historis di source repository tidak dipakai untuk mengalahkan keputusan aktif.

API Contract yang dipakai untuk pemeriksaan endpoint adalah dokumen API Contract terbaru yang tersedia di workspace. OpenAPI dalam source ZIP diperlakukan sebagai dokumentasi implementasi saat ini, bukan sebagai pengganti API Contract yang disetujui.

---

## 4. Matriks konsistensi tingkat repository

| Area | Status | Bukti yang ditemukan | Dampak / catatan |
|---|---|---|---|
| pnpm workspace | `MATCH` | Root `pnpm-workspace.yaml` berisi `apps/*`; root scripts menjalankan lint/typecheck/build/test secara rekursif. | Struktur workspace dasar sudah ada. |
| `apps/api` | `MATCH` | API package, source, Prisma, tests, OpenAPI tersedia. | Fondasi backend nyata sudah ada. |
| `apps/web` | `MISSING / UNVERIFIED` | Tidak ada file `apps/web` dalam source ZIP. | Architecture dan plan mendefinisikan web workspace. Bisa jadi sengaja belum dikirim, tetapi tidak dapat dianggap tersedia. |
| Node/TypeScript/Express | `PARTIAL` | Package API menggunakan Express 5 dan TypeScript; runtime CI diset ke Node 24. | Versi dependency aktual perlu diverifikasi dari lockfile dan instalasi. |
| PostgreSQL/Prisma | `PARTIAL` | Prisma schema, dua migration, Prisma adapter PostgreSQL, dan test helpers tersedia. | Model database baru mencakup User, Session, Organization, Membership. |
| API architecture | `MISMATCH` | Service Identity/Organization mengimpor Prisma client secara langsung. | Dependency direction tidak sesuai ADR-001. |
| Identity | `PARTIAL / MISMATCH` | Register, login, me, logout tersedia; refresh tidak tersedia. | Kontrak API mendefinisikan refresh session. |
| Organization | `PARTIAL / MISMATCH` | Create Organization tersedia. List/detail/update belum ditemukan. Create tidak membuat Activity. | Tidak memenuhi keseluruhan Organization API contract. |
| Membership | `MISMATCH / MISSING` | Hanya model dasar Membership dengan composite primary key, role, createdAt. | Tidak memiliki identifier/status/version/lifecycle sesuai DB Spec V1.3. Lifecycle endpoints belum ada. |
| Invitation | `MISSING` | Tidak ditemukan module, routes, schema, repository, migration, atau tests. | Seluruh Invitation lifecycle dan email Outbox belum diimplementasikan. |
| Project | `MISSING` | Tidak ditemukan module atau persistence model. | Project vertical slice belum dimulai. |
| Issue / Label | `MISSING` | Tidak ditemukan module atau persistence model. | Issue lifecycle, numbering, assignment, status, priority, label lifecycle belum ada. |
| Comment / Activity | `MISSING / MISMATCH` | Tidak ditemukan model/module Activity atau Comment. Organization creation juga belum menulis Activity. | Audit trail yang diwajibkan belum tersedia. |
| Notification | `MISSING` | Tidak ditemukan model/module/worker. | In-app notification lifecycle belum ada. |
| Outbox | `MISSING` | Tidak ditemukan model, migration, worker, atau tests. | Invitation email delivery belum memiliki durable delivery mechanism. |
| OpenAPI | `PARTIAL / MISMATCH` | Modular source dan bundle ada; hanya health, auth dasar, dan create Organization yang terdaftar. | Tidak mencerminkan seluruh API Contract; refresh juga tidak ada. |
| CI | `PARTIAL` | PostgreSQL service, Prisma generate/migrate, lint, typecheck, build, test ada. | OpenAPI bundle/validation belum menjadi CI gate. |
| Tests | `PARTIAL / UNVERIFIED` | Test auth, middleware, health, Organization create, dan helpers ada. | Belum mencakup mayoritas domain/invariant V1. Tidak dijalankan dalam audit ini. |
| Deployment/operations | `UNVERIFIED` | Docker Compose tersedia. | Tidak cukup bukti untuk menyatakan deployment, backup/restore, monitoring, atau operational readiness siap. |

## 5. Temuan terperinci dan tindakan perbaikan

### AUD-001 — Membership persistence model tidak sesuai Database Specification V1.3

**Status:** `MISMATCH`  
**Prioritas:** P0  
**Area pemilik:** Database Specification V1.3 → Prisma schema/migrations → Membership module  
**Bukti repository:** `apps/api/prisma/schema.prisma`, migration `add_organizations`.

Model saat ini:
- Composite primary key `(organizationId, userId)`.
- Field `role`.
- Field `createdAt`.
- Tidak terlihat `id`, `status`, `version`, `joinedAt`, atau `removedAt`.

Database Specification V1.3 menetapkan Membership dengan logical uniqueness per pasangan Organization/User, tetapi juga memiliki identifier Membership tersendiri yang dipakai oleh tenant-sensitive references. Lifecycle `ACTIVE`/`REMOVED`, versioning, dan timestamp lifecycle dibutuhkan untuk reactivation, historical attribution, authorization, assignment, dan optimistic concurrency.

**Mengapa penting:** API Contract menggunakan `membershipId` sebagai identifier resource dan assignee reference. Tanpa `id`, `status`, dan lifecycle semantics, implementasi endpoint Membership, Invitation acceptance/reactivation, Issue assignment, serta removal tidak bisa mengikuti kontrak yang disetujui.

**Perbaikan yang diperlukan:**
1. Revisi Prisma model agar mengikuti struktur Database Specification V1.3.
2. Pertahankan unique constraint pasangan `(organization_id, user_id)` sebagai aturan satu Membership per pasangan.
3. Tambahkan identifier Membership dan lifecycle fields sesuai spesifikasi.
4. Tambahkan migration forward-only yang aman terhadap data yang sudah ada.
5. Perbarui repository/service/test yang menggunakan composite key secara langsung.
6. Pastikan foreign key tenant-sensitive menggunakan kombinasi Organization dan Membership identifier sesuai DB Spec, bukan hanya identifier global.
7. Tambahkan test untuk create, remove, reactivation, dan uniqueness.

**Acceptance:** Prisma schema, SQL migration, API DTO, dan tests konsisten dengan Database Specification V1.3; satu User tidak dapat memiliki dua row Membership untuk Organization yang sama; reactivation menggunakan row Membership yang sama.

### AUD-002 — Session refresh didefinisikan kontrak tetapi route belum diimplementasikan

**Status:** `MISMATCH`  
**Prioritas:** P0  
**Area pemilik:** Identity API Contract → Identity module → OpenAPI  
**Bukti repository:** `auth.routes.ts` hanya mendaftarkan `/register`, `/login`, `/me`, dan `/logout`.

API Contract mendefinisikan `POST /api/v1/auth/refresh`, termasuk aturan concurrency dan invalidasi token lama. Route dan flow refresh tidak ditemukan dalam source ZIP.

**Perbaikan yang diperlukan:**
1. Implementasikan refresh sesuai API Contract, bukan membuat semantik baru di code.
2. Terapkan rotasi token/session secara atomik sesuai keputusan kontrak.
3. Pastikan dua refresh request bersamaan dengan token yang sama tidak menghasilkan dua session/token aktif yang valid.
4. Tambahkan integration tests untuk sukses, expired/revoked token, reuse token lama, dan concurrent refresh.
5. Tambahkan endpoint beserta request/response/error/security definition ke OpenAPI.

**Acceptance:** perilaku refresh dan concurrency test memenuhi bagian Refresh Session pada API Contract; OpenAPI sama dengan route dan response aktual.

### AUD-003 — Create Organization tidak membuat Activity secara atomik

**Status:** `MISMATCH`  
**Prioritas:** P0  
**Area pemilik:** Organization API Contract → Activity module → Organization use case  
**Bukti repository:** `organization.service.ts` membuat Organization dan OWNER Membership dalam transaction. Tidak ditemukan Activity model/module atau insert Activity pada flow tersebut.

API Contract menetapkan Create Organization, OWNER Membership `ACTIVE`, dan Activity `ORGANIZATION_CREATED` berada dalam satu transaction.

**Perbaikan yang diperlukan:**
1. Implementasikan minimum Activity persistence capability sesuai Database Specification V1.3.
2. Perbarui Organization creation use case untuk membuat Organization, initial Membership, dan Activity dalam satu transaction.
3. Pastikan kegagalan pada salah satu operasi membatalkan seluruh transaction.
4. Tambahkan integration test yang membuktikan ketiga record berhasil dibuat bersama dan rollback bersama.

**Acceptance:** tidak ada Organization yang tercipta tanpa OWNER Membership atau Activity `ORGANIZATION_CREATED` akibat kegagalan parsial.

### AUD-004 — Application service bergantung langsung pada Prisma

**Status:** `MISMATCH`  
**Prioritas:** P0  
**Area pemilik:** ADR-001 → Architecture → API foundation  
**Bukti repository:** `auth.service.ts` dan `organization.service.ts` mengimpor Prisma client/Prisma types secara langsung; service mengoordinasikan operasi persistence menggunakan Prisma.

ADR-001 menetapkan Pragmatic Clean Architecture. Application mengoordinasikan use case dan transaction boundary melalui application-facing abstraction/port. Infrastructure mengimplementasikan akses Prisma. Prisma-specific types tidak boleh bocor ke Domain dan dependency direction tidak boleh mengarah dari Application ke concrete Infrastructure.

**Perbaikan yang diperlukan:**
1. Pisahkan use case orchestration dari Prisma implementation.
2. Definisikan port/repository/transaction abstraction secukupnya untuk use case yang benar-benar memerlukannya.
3. Pindahkan Prisma query dan adapter transaction ke Infrastructure.
4. Letakkan wiring konkret pada composition root.
5. Jangan membuat generic repository framework besar; abstraksi harus mengikuti kebutuhan use case.
6. Tambahkan pemeriksaan dependency/layer convention atau setidaknya review checklist yang bisa ditegakkan CI.

**Acceptance:** Application tidak mengimpor Prisma client atau generated Prisma types; Domain tidak mengimpor Express/Prisma; Presentation tidak mengakses Prisma; transaction tetap atomik dan dapat diuji melalui adapter PostgreSQL.

### AUD-005 — OpenAPI belum merepresentasikan API Contract V1

**Status:** `MISMATCH`  
**Prioritas:** P1  
**Area pemilik:** API Contract → OpenAPI source → CI  
**Bukti repository:** `apps/api/docs/openapi/` memuat root YAML, paths auth/health/organizations, schema dasar, dan bundled YAML. Route OpenAPI saat ini hanya mencakup health, auth dasar, dan Organization create.

API Contract mendefinisikan area Authentication, Organization, Membership, Invitation, Project, Issue, Label, Comment, Activity, dan Notification. API Contract adalah desain target; OpenAPI saat ini hanya mencerminkan sebagian kecil implementasi.

**Perbaikan yang diperlukan:**
1. Jangan menambahkan endpoint yang belum diimplementasikan seolah-olah sudah tersedia pada dokumentasi runtime tanpa penandaan yang jelas.
2. Secara bertahap perluas OpenAPI bersamaan dengan vertical slice implementasi.
3. Tambahkan refresh session yang hilang.
4. Pastikan request, response, validation, authentication, dan error schema sesuai implementasi aktual.
5. Tetapkan modular YAML sebagai source of truth dan bundled file sebagai generated artifact.
6. Tambahkan OpenAPI bundle dan structural validation ke CI.

**Acceptance:** untuk setiap endpoint yang sudah diimplementasikan, OpenAPI sesuai route, Zod schema, response mapper, auth middleware, dan error envelope. CI gagal jika bundle/validation gagal.

### AUD-006 — `apps/web` tidak ada dalam source ZIP

**Status:** `MISSING / UNVERIFIED`  
**Prioritas:** P1 untuk kelengkapan monorepo; bukan blocker API backend  
**Area pemilik:** Architecture → Repository structure  
**Bukti repository:** `pnpm-workspace.yaml` memakai `apps/*`, tetapi ZIP hanya memuat `apps/api`.

Architecture mendefinisikan monorepo dengan `apps/api` dan `apps/web`. Source ZIP yang diaudit tidak memuat `apps/web`.

**Perbaikan yang diperlukan:**
1. Pastikan apakah web app memang belum dibuat atau tidak ikut dikirim dalam ZIP.
2. Jika belum dibuat, catat sebagai belum dimulai dan jangan mengklaim monorepo lengkap.
3. Jika web app memang berada di repository asli, pastikan paket tersebut masuk ke source snapshot berikutnya.
4. Jangan membuat placeholder `apps/web` hanya demi memenuhi struktur dokumen jika belum ada kebutuhan implementasi.

**Acceptance:** repository aktual dan Architecture memiliki status yang sama dan eksplisit untuk web workspace.

### AUD-007 — Organization API belum memenuhi keseluruhan kontrak

**Status:** `MISSING / PARTIAL`  
**Prioritas:** P1  
**Area pemilik:** Organization API Contract → Organization module  
**Bukti repository:** routes yang ditemukan hanya menyediakan create Organization.

API Contract juga mendefinisikan list Organizations, get detail, dan update Organization dengan membership access rules, version/concurrency behavior, serta Activity.

**Perbaikan yang diperlukan:**
1. Lengkapi list Organizations berdasarkan ACTIVE Membership milik actor.
2. Lengkapi detail Organization dengan pemeriksaan ACTIVE Membership.
3. Lengkapi update Organization dengan authorization, version handling, no-op semantics, dan Activity atomicity sesuai kontrak.
4. Tambahkan tests untuk tenant isolation, role access, stale version, no-op, dan Activity transaction.

**Acceptance:** seluruh endpoint Organization yang ditetapkan kontrak tersedia dan setiap query dibatasi pada Organization yang dapat diakses actor.

### AUD-008 — Membership lifecycle dan permission enforcement belum tersedia

**Status:** `MISSING`  
**Prioritas:** P1  
**Area pemilik:** Permissions V1.1 + Database Specification V1.3 + Membership API Contract  
**Bukti repository:** tidak ditemukan Membership routes/module; model Membership belum mendukung lifecycle yang ditetapkan.

Belum ditemukan implementasi list/detail Membership, role update, removal, Owner invariant, issue unassignment saat removal, atau Activity untuk perubahan Membership.

**Perbaikan yang diperlukan:**
1. Selesaikan AUD-001 terlebih dahulu.
2. Implementasikan Membership read/update/revoke sesuai API Contract dan Permissions V1.1.
3. Terapkan last active Owner invariant dengan lock ordering sesuai Database Specification.
4. Saat Membership dihapus, unassign Issues terkait dalam transaction yang sama.
5. Pastikan authorization dilakukan server-side dan selalu memeriksa Organization scope.
6. Tambahkan concurrency tests untuk last Owner dan Membership removal vs assignment.

**Acceptance:** tidak ada Organization tanpa active Owner; role/permission checks konsisten; Membership removal tidak meninggalkan Issue assigned ke Membership REMOVED.

### AUD-009 — Invitation dan transactional email Outbox belum diimplementasikan

**Status:** `MISSING`  
**Prioritas:** P1  
**Area pemilik:** Invitation API Contract + Database Specification V1.3  
**Bukti repository:** tidak ditemukan Invitation/Outbox model, migration, module, route, worker, atau tests.

API Contract dan Database Specification menetapkan Invitation lifecycle, token hash/rotation, expiry, resend cooldown/quota, acceptance, Activity, Notification, serta transactional Outbox delivery.

**Perbaikan yang diperlukan:**
1. Implementasikan schema/migration Invitation dan Outbox sesuai Database Specification V1.3.
2. Implementasikan create/list/detail/revoke/resend/accept.
3. Terapkan token hanya dalam bentuk hash di database; raw token hanya untuk delivery yang diperlukan dan tidak masuk API response/log.
4. Terapkan lock, token version, cooldown, rolling quota, dan expiry semantics sesuai spesifikasi.
5. Implementasikan worker dengan lease/retry/recovery semantics yang ditentukan.
6. Tambahkan tests untuk acceptance race, revoke race, resend race/quota, stale token suppression, lease recovery, retry classification, dan terminal failure.

**Acceptance:** Invitation, Activity, dan Outbox event dibuat secara atomik; kegagalan email tidak membatalkan Invitation; resend/accept/revoke mengikuti concurrency rules.

### AUD-010 — Project domain belum diimplementasikan

**Status:** `MISSING`  
**Prioritas:** P1 setelah Organization/Membership stabil  
**Area pemilik:** Project API Contract + Database Specification V1.3  
**Bukti repository:** tidak ditemukan Project model, migration, module, routes, atau tests.

**Perbaikan yang diperlukan:**
1. Implementasikan create/list/detail/update/archive/restore sesuai API Contract.
2. Terapkan Organization scoping dan permission rules.
3. Terapkan optimistic concurrency/version semantics dan no-op behavior.
4. Buat Activity untuk actual state changes dalam transaction.
5. Pertahankan Comments dan Activities saat archive/restore sesuai keputusan domain.

**Acceptance:** seluruh operasi Project tenant-scoped, version-safe, dan Activity atomic.

### AUD-011 — Issue dan Label domain belum diimplementasikan

**Status:** `MISSING`  
**Prioritas:** P1 setelah Project  
**Area pemilik:** Issue/Label API Contract + Database Specification V1.3  
**Bukti repository:** tidak ditemukan Issue, Label, atau IssueLabel model/module/migration/test.

Domain ini memiliki invariant yang lebih kompleks: nomor Issue per Project, status transition, priority, assignee Membership scope, archive/restore, Label lifecycle, Issue-Label association, restore collision, dan concurrency.

**Perbaikan yang diperlukan:**
1. Implementasikan Project counter dan Issue number allocation secara atomik.
2. Implementasikan status/priority dan transition rules sesuai spesifikasi.
3. Validasi assignee sebagai ACTIVE Membership dalam Organization yang sama.
4. Implementasikan archive/restore dan restore collision behavior.
5. Implementasikan Label dan IssueLabel lifecycle sesuai kontrak.
6. Terapkan lock ordering dan database constraints dari Database Specification V1.3.
7. Tambahkan tests untuk number allocation concurrency, assignment vs removal, status transition, label association, serta restore collision.

**Acceptance:** nomor Issue unik per Project; Issue tidak dapat ditugaskan ke Membership REMOVED atau tenant lain; invariant tetap benar pada operasi concurrent.

### AUD-012 — Comment dan Activity domain belum diimplementasikan

**Status:** `MISSING`  
**Prioritas:** P1/P2, sesuai urutan dependency plan  
**Area pemilik:** Comment/Activity API Contract + Database Specification V1.3  
**Bukti repository:** tidak ditemukan model/module/routes/migrations/tests untuk Comment dan Activity.

**Perbaikan yang diperlukan:**
1. Implementasikan Activity sebagai Organization-level append-only stream.
2. Implementasikan Comment create/update/delete sesuai aturan author/admin.
3. Delete Comment harus menjadi metadata-only tombstone: body dihapus, metadata historis dipertahankan.
4. Activity metadata tidak boleh menyimpan Comment body, password, raw token, atau secret.
5. Integrasikan Activity ke use case yang mewajibkan event.
6. Tambahkan tests untuk authorization, tombstone, append-only behavior, dan transaction atomicity.

**Acceptance:** setiap perubahan domain yang diwajibkan kontrak menghasilkan Activity dalam transaction yang sama; Comment deletion menghapus body namun mempertahankan tombstone.

### AUD-013 — Notification domain dan retention belum diimplementasikan

**Status:** `MISSING`  
**Prioritas:** P2  
**Area pemilik:** Notification API Contract + Database Specification V1.3  
**Bukti repository:** tidak ditemukan model/module/routes/cleanup worker/tests.

**Perbaikan yang diperlukan:**
1. Implementasikan Notification recipient dan event mapping sesuai spesifikasi.
2. Implementasikan list, mark-read, mark-unread, dan mark-all-read.
3. Terapkan idempotency pada read state dan timestamp semantics.
4. Terapkan retention berdasarkan state: read 180 hari dari `read_at` saat ini; unread 365 hari dari `created_at`.
5. Pastikan cleanup batch dan predicate aman terhadap concurrent read/unread transition.

**Acceptance:** notification tidak bocor antar-user/tenant; cleanup tidak menghapus notification sebelum deadline berdasarkan state terkini.

### AUD-014 — Shared request validation belum mencakup params/query/body

**Status:** `PARTIAL`  
**Prioritas:** P1  
**Area pemilik:** Implementation Plan FND-03 → API conventions  
**Bukti repository:** Zod dan middleware `validate` tersedia, tetapi middleware generik yang diperiksa memvalidasi body. Belum terlihat konvensi shared untuk params dan query.

**Perbaikan yang diperlukan:**
1. Standarkan validasi `params`, `query`, dan `body`.
2. Tentukan cara hasil parse yang tervalidasi diteruskan ke handler.
3. Pastikan validation error menggunakan error envelope bersama.
4. Jangan mencampur transport validation dengan authorization/domain invariants.

**Acceptance:** seluruh route memakai pola validasi konsisten dan invalid request berhenti sebelum use case dijalankan.

### AUD-015 — Error envelope dan request correlation perlu verifikasi/penyelarasan

**Status:** `PARTIAL / UNVERIFIED`  
**Prioritas:** P1  
**Area pemilik:** Implementation Plan FND-02/FND-08 → API conventions  
**Bukti repository:** `AppError`, centralized error handler, Pino, dan request logger tersedia. Audit statis sebelumnya menemukan request ID tersedia pada logging path, tetapi belum tampak pada error response.

**Perbaikan yang diperlukan:**
1. Cocokkan error codes dan HTTP mappings dengan API Conventions/API Contract.
2. Sertakan request/correlation ID pada error response sesuai konvensi yang dipilih.
3. Pastikan production response tidak mengekspos stack trace/internal detail.
4. Pastikan log meredaksi password, session token, invitation token, dan payload sensitif.
5. Tambahkan test untuk error envelope dan redaction behavior.

**Acceptance:** error response stabil dan aman; request ID dapat dipakai untuk menghubungkan response dengan structured logs; data sensitif tidak tercatat.

### AUD-016 — Test coverage belum mengikuti invariant V1

**Status:** `PARTIAL`  
**Prioritas:** P1  
**Area pemilik:** Implementation Plan → Testing Strategy  
**Bukti repository:** tests tersedia untuk health, auth, middleware, logger, Organization creation, dan helper PostgreSQL. Tidak ditemukan tests untuk domain V1 yang belum diimplementasikan.

Test yang ada adalah fondasi yang perlu dipertahankan, bukan bukti seluruh acceptance criteria terpenuhi.

**Perbaikan yang diperlukan:**
1. Lengkapi test factories/fixtures untuk User, Organization, Membership, dan resource domain berikutnya.
2. Pertahankan integration test pada PostgreSQL.
3. Tambahkan test tenant isolation untuk setiap query/resource endpoint.
4. Tambahkan concurrency tests sesuai DB Spec: last Owner, Membership removal vs assignment, Invitation accept/resend/revoke, Session refresh, Issue number allocation, Outbox lease/retry, dan Notification retention.
5. Tambahkan migration-from-empty-database verification.
6. Jalankan test suite pada CI dan simpan hasil yang dapat ditinjau.

**Acceptance:** setiap invariant penting memiliki test yang gagal jika invariant dilanggar; integration test tidak bergantung pada leftover database state.

### AUD-017 — OpenAPI validation belum menjadi CI gate

**Status:** `MISSING`  
**Prioritas:** P1  
**Area pemilik:** OpenAPI README + GitHub Actions  
**Bukti repository:** script `docs:bundle` ada pada `apps/api/package.json`; CI menjalankan Prisma generate/migrate, lint, typecheck, build, test, tetapi tidak menjalankan bundling/validation OpenAPI.

**Perbaikan yang diperlukan:**
1. Tambahkan command validasi OpenAPI yang deterministic.
2. Jalankan bundling dan validation pada CI.
3. Jika bundled YAML dilacak di Git, verifikasi hasil bundle tidak stale.
4. Pastikan invalid `$ref`, schema, atau OpenAPI structure menyebabkan CI gagal.

**Acceptance:** perubahan API contract yang merusak OpenAPI tidak dapat merge melalui CI.

### AUD-018 — Migration chain dan runtime checks belum diverifikasi

**Status:** `UNVERIFIED`  
**Prioritas:** P1  
**Area pemilik:** Implementation Plan FND-05 → CI/database workflow  
**Bukti repository:** dua migration tersedia; CI menjalankan `prisma migrate deploy` pada PostgreSQL service sebelum test. Namun audit ini tidak mengeksekusi workflow tersebut.

**Perbaikan/verifikasi yang diperlukan:**
1. Jalankan migration dari database kosong menggunakan versi dependency yang terkunci.
2. Jalankan migration status dan test berulang.
3. Verifikasi test database guard menolak database yang bukan test database.
4. Pastikan workflow CI benar-benar berhasil pada commit terkini.
5. Verifikasi migration baru untuk Membership dan domain berikutnya bersifat forward-only dan tidak menghilangkan data yang perlu dipertahankan.

**Acceptance:** clean database migration, lint, typecheck, build, dan test berhasil pada CI; hasil aktual tercatat, bukan diasumsikan dari keberadaan YAML.

### AUD-019 — Docker/deployment dan operational readiness belum terbukti

**Status:** `UNVERIFIED`  
**Prioritas:** P2/P3 sebelum release  
**Area pemilik:** Deployment/Operational Readiness  
**Bukti repository:** `compose.yaml` dan environment examples tersedia. Bukti tersebut tidak membuktikan production deployment, backup/restore, monitoring, alerting, atau recovery procedure.

**Perbaikan/verifikasi yang diperlukan:**
1. Verifikasi Compose untuk local development dan dependency health.
2. Pastikan secret production tidak disimpan dalam repository.
3. Dokumentasikan deployment dan rollback aplikasi yang kompatibel dengan forward-only migration policy.
4. Tetapkan backup dan restore procedure; lakukan restore exercise.
5. Tetapkan health/readiness checks, log retention, disk/database monitoring, dan incident procedure.
6. Jangan menetapkan load target atau capacity claim sebelum workload dan objective disepakati.

**Acceptance:** release checklist dan backup/restore evidence tersedia sebelum V1 production release.

### AUD-020 — Security controls ada, tetapi coverage belum cukup untuk dinyatakan tervalidasi

**Status:** `PARTIAL / UNVERIFIED`  
**Prioritas:** P1/P2  
**Area pemilik:** Security Baseline Decision Record + API foundation  
**Bukti repository:** Argon2 password hashing, hashed session token, auth middleware, Helmet/security headers, CORS, rate limiter, dan tests untuk beberapa middleware tersedia.

Keberadaan middleware bukan bukti bahwa keseluruhan security baseline sudah terpenuhi. Belum ada bukti dari audit statis ini untuk semua abuse cases, tenant authorization, secret redaction, refresh concurrency, invitation token lifecycle, dan production configuration.

**Perbaikan/verifikasi yang diperlukan:**
1. Pertahankan Argon2 dan penyimpanan hash session token.
2. Tambahkan tests untuk token expiry/revocation/reuse dan refresh concurrency.
3. Uji authorization dan tenant isolation pada semua resource endpoints.
4. Verifikasi rate limiting untuk endpoint sensitif dan kebijakan proxy/trust proxy.
5. Audit log redaction dan error response.
6. Verifikasi production CORS, security headers, cookie/bearer strategy sesuai API Contract, dan secret handling.

**Acceptance:** security baseline memiliki test/evidence untuk threat surface yang relevan, bukan hanya konfigurasi middleware.

---

## 6. Hal yang sudah ada dan perlu dipertahankan

Berdasarkan source yang terlihat, jangan membuang atau menulis ulang fondasi berikut tanpa alasan teknis dan regression evidence:

- pnpm workspace dan root scripts rekursif.
- API package terpisah di `apps/api`.
- Express 5 application/server split.
- Zod validation dan centralized error handling.
- `AppError` dan success response abstraction.
- Pino / pino-http request logging.
- Argon2 password hashing.
- Session token disimpan dalam bentuk hash.
- PostgreSQL melalui Prisma adapter.
- Migration workflow dan test database guard.
- Vitest + Supertest integration test setup.
- Test coverage untuk auth, middleware, health, dan Organization creation.
- Modular OpenAPI source dan bundling script.
- GitHub Actions dengan PostgreSQL service dan quality checks.

Fondasi tersebut perlu diperbaiki/ditingkatkan, bukan otomatis diganti.

## 7. Urutan remediation yang direkomendasikan

Urutan ini mengikuti dependency antar-invariant dan Implementation Plan V1.1. Jangan mulai membangun domain yang bergantung pada Membership/Activity sebelum fondasi keduanya benar.

| Urutan | Task | Temuan terkait | Prioritas | Exit condition |
|---:|---|---|---|---|
| 1 | Tetapkan status source snapshot dan kelengkapan `apps/web` | AUD-006 | P1 | Scope repository jelas; tidak ada asumsi bahwa web app sudah tersedia. |
| 2 | Refactor persistence boundary dan composition root | AUD-004 | P0 | Application tidak bergantung langsung pada Prisma. |
| 3 | Selaraskan Membership schema + migration ke DB Spec V1.3 | AUD-001 | P0 | Identifier, lifecycle, version, constraints, dan FK sesuai spesifikasi. |
| 4 | Tambahkan minimum Activity capability | AUD-003, AUD-012 | P0 | Activity append-only tersedia dan Organization create menulis event atomik. |
| 5 | Lengkapi Session refresh | AUD-002 | P0 | Refresh concurrency dan token rotation lulus tests. |
| 6 | Lengkapi Organization API | AUD-007 | P1 | List/detail/update beserta access/version/activity semantics lulus tests. |
| 7 | Lengkapi Membership lifecycle/permissions | AUD-008 | P1 | Owner invariant, revoke, reactivation, tenant checks lulus tests. |
| 8 | Tambahkan OpenAPI coverage + CI validation | AUD-005, AUD-017 | P1 | Implemented endpoints terdokumentasi akurat; CI memvalidasi bundle. |
| 9 | Implementasikan Invitation + Outbox | AUD-009 | P1 | Lifecycle, resend/accept concurrency, delivery recovery lulus tests. |
| 10 | Implementasikan Project | AUD-010 | P1 | Project lifecycle dan concurrency lulus tests. |
| 11 | Implementasikan Issue + Label | AUD-011 | P1 | Numbering, assignment, status, label, archive/restore lulus tests. |
| 12 | Lengkapi Comment + Activity integration | AUD-012 | P1/P2 | Comment tombstone dan Activity coverage konsisten. |
| 13 | Implementasikan Notification + retention | AUD-013 | P2 | Read state, recipient scope, cleanup semantics lulus tests. |
| 14 | Lengkapi validation/error/logging/test coverage | AUD-014 s.d. AUD-016, AUD-020 | P1/P2 | Foundation DoD terpenuhi dan invariant penting memiliki tests. |
| 15 | Verifikasi migration/CI/runtime | AUD-018 | P1 | Bukti eksekusi CI dan clean migration tersedia. |
| 16 | Deployment, backup/restore, observability hardening | AUD-019 | P2/P3 | Release readiness evidence tersedia. |

## 8. Definition of Done audit remediation

Sebuah temuan baru boleh ditandai selesai jika:

1. Perubahan sesuai dokumen pemiliknya atau dokumen pemilik direvisi melalui keputusan yang eksplisit.
2. Source code dan migration sudah diubah, bukan hanya TODO atau komentar.
3. Tests mencakup behavior normal, failure path, authorization/tenant boundary, dan concurrency jika relevan.
4. OpenAPI diperbarui untuk perubahan public API.
5. Lint, typecheck, build, migration, dan tests yang relevan benar-benar dijalankan.
6. CI hijau pada commit yang memuat perubahan.
7. Tidak ada kontradiksi baru antara API Contract, Database Specification, Permissions, Architecture, dan Implementation Plan.

Status audit ini tidak otomatis berubah hanya karena kode telah ditulis. Bukti verifikasi tetap diperlukan.

## 9. Keputusan yang tidak boleh dibuat diam-diam selama remediation

Hal-hal berikut sudah ditentukan oleh dokumen aktif dan tidak boleh diubah hanya demi memudahkan implementasi:

- Organization adalah tenant boundary.
- User dapat menjadi anggota beberapa Organization dengan role berbeda.
- Role V1 adalah OWNER, ADMIN, MEMBER; tidak ada GUEST.
- Membership removal dan reactivation mengikuti lifecycle yang sama; reactivation memakai row Membership yang sama.
- Last active Owner invariant harus dijaga.
- PostgreSQL adalah source of truth; constraint database menegakkan invariant integritas penting.
- Application use case mengendalikan transaction boundary; Prisma implementation berada di Infrastructure.
- Activity bersifat append-only dan Organization-level.
- Invitation token tidak dikembalikan melalui API dan token disimpan dalam bentuk hash.
- Invitation email delivery menggunakan transactional Outbox.
- Comment deletion adalah metadata-only tombstone sesuai keputusan V1.
- Notification retention bergantung pada current read state dan timestamp yang relevan.
- Migration bersifat forward-only; jangan mengasumsikan destructive rollback.

Jika implementasi menemukan bahwa keputusan tersebut perlu diubah, hentikan bagian terkait dan revisi dokumen/ADR pemiliknya terlebih dahulu.

## 10. Kesimpulan akhir

Repository saat ini adalah **foundation implementation**, bukan implementasi V1 yang hampir selesai. Ada beberapa komponen teknis yang sudah layak dipertahankan, tetapi kontrak domain dan persistence belum lengkap.

Pekerjaan paling penting bukan menambahkan banyak endpoint sekaligus. Urutannya adalah:
1. benahi dependency boundary;
2. selaraskan Membership dengan Database Specification V1.3;
3. sediakan Activity minimum dan perbaiki atomicity Organization creation;
4. lengkapi Session refresh;
5. selesaikan Organization dan Membership;
6. baru lanjut ke Invitation/Outbox, Project, Issue/Label, Comment, dan Notification.

**Tidak ada perubahan source code atau schema yang dilakukan sebagai bagian dari audit ini.** Dokumen ini adalah satu daftar temuan dan urutan remediation yang menjadi dasar pekerjaan berikutnya.
