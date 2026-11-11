# Phase 0.2 --- API Specification

**Project:** Multi-Tenant Project Management API\
**Status:** Consolidated specification\
**Base path:** `/api/v1`\
**Version:** 1.0\
**Scope:** V1 API contract for Authentication, Organization, Membership,
Invitation, Project, Issue, Comment, Activity, and Notification.

------------------------------------------------------------------------

## 1. Purpose and scope

Dokumen ini menetapkan kontrak HTTP API V1 berdasarkan keputusan domain
dan API yang telah disepakati. Dokumen mencakup endpoint, autentikasi,
authorization, request/response, validasi, error contract, pagination,
concurrency, dan transaction boundary yang relevan.

Dokumen ini bukan implementasi. Detail fisik database seperti tipe kolom
final, constraint, index, migration, dan strategi locking akan dirinci
pada **Phase 0.3 --- Database Specification**.

### 1.1 Technology context

-   Node.js 24 + TypeScript
-   Express 5
-   PostgreSQL 18
-   Prisma ORM 7 dengan PostgreSQL adapter
-   Zod untuk validasi input
-   Vitest + Supertest untuk pengujian
-   Pino untuk structured logging

### 1.2 API conventions

-   Semua endpoint berada di bawah `/api/v1`.
-   Request dan response menggunakan JSON kecuali dinyatakan lain.
-   Timestamp menggunakan ISO 8601 dalam UTC.
-   ID resource menggunakan UUID.
-   Authentication menggunakan opaque Bearer Session token.
-   User identity selalu diambil dari Session terautentikasi, bukan dari
    ID yang dikirim client.
-   Error response menggunakan satu envelope konsisten.
-   Resource tenant hanya dapat diakses melalui active Membership,
    kecuali endpoint yang secara eksplisit tidak memerlukan Membership
    aktif, seperti Accept Invitation dan akses Notification personal.
-   Tidak ada hard delete untuk Project, Issue, Membership, atau Comment
    pada V1 sesuai aturan masing-masing resource.

### 1.3 Authentication header

``` http
Authorization: Bearer <opaque-session-token>
```

Token mentah hanya diberikan kepada client ketika Register, Login, dan
Refresh berhasil. Database hanya menyimpan SHA-256 hash token.

### 1.4 Error envelope

Semua error menggunakan bentuk:

``` json
{
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human-readable explanation."
  }
}
```

`message` tidak boleh membocorkan detail internal, credential, token,
atau informasi tenant yang seharusnya tidak dapat diakses.

### 1.5 General error semantics

  -----------------------------------------------------------------------
  HTTP                                Makna
  ----------------------------------- -----------------------------------
  400                                 Request atau parameter tidak valid

  401                                 Authentication tidak ada atau
                                      Session tidak valid

  403                                 User terautentikasi tetapi tidak
                                      memiliki permission

  404                                 Resource tidak ditemukan atau
                                      sengaja disamarkan karena batas
                                      tenant/visibility

  409                                 Konflik state, duplicate, atau
                                      optimistic concurrency conflict

  422                                 Request valid secara struktur
                                      tetapi melanggar aturan domain

  429                                 Rate limit atau cooldown

  500                                 Kegagalan internal yang tidak
                                      diekspos secara detail
  -----------------------------------------------------------------------

Aturan tenant: - Resource Organization yang tidak ada dan Organization
tanpa active Membership bagi User diperlakukan sama: `404`. - Resource
lintas tenant atau tidak terlihat karena authorization/visibility juga
menggunakan `404` bila dinyatakan oleh kontrak endpoint. - Active
Membership tanpa permission menghasilkan `403`. - Stale version
menghasilkan `409 VERSION_CONFLICT`. - Invalid Issue status transition
menghasilkan `422 INVALID_STATUS_TRANSITION`.

### 1.6 Pagination

Collection endpoint menggunakan cursor pagination.

Query: - `limit`: default `20`, minimum `1`, maksimum `100`. - `cursor`:
opaque cursor dari response sebelumnya.

Response:

``` json
{
  "data": [],
  "pagination": {
    "nextCursor": null,
    "hasMore": false,
    "totalCount": 0
  }
}
```

`totalCount` dihitung setelah seluruh filter diterapkan pada saat
request. Ordering harus deterministic dan menggunakan tie-breaker ID.

Default ordering setiap endpoint ditentukan pada bagian endpoint
terkait.

### 1.7 PATCH semantics and optimistic concurrency

-   PATCH bersifat partial update untuk field yang memang dapat diubah.
-   Field yang tidak dikirim tidak berubah.
-   `null` hanya bermakna penghapusan nilai jika field tersebut secara
    eksplisit nullable.
-   Untuk resource yang mendukung optimistic concurrency control (OCC),
    request menyertakan `version` integer yang dibaca client.
-   Update dilakukan secara conditional terhadap version yang
    diharapkan.
-   Successful actual mutation menaikkan version satu angka.
-   No-op tidak menaikkan version dan tidak menghasilkan Activity
    kecuali endpoint menyatakan lain.
-   Version mismatch menghasilkan `409 VERSION_CONFLICT`.
-   Client harus mengambil representasi terbaru dan merekonsiliasi
    perubahan; server tidak melakukan blind automatic retry.

------------------------------------------------------------------------

# 2. Authentication API

## 2.1 Register

`POST /api/v1/auth/register`

Authentication: tidak diperlukan.

### Request

``` json
{
  "email": "alice@example.com",
  "password": "SecurePassword123!",
  "displayName": "Alice"
}
```

### Validation and behavior

-   `email` wajib valid, di-trim, lalu dinormalisasi menjadi lowercase.
-   Email harus unik secara global setelah normalisasi.
-   `password` wajib 12--128 karakter.
-   Password tidak boleh di-trim, di-lowercase, atau dinormalisasi
    sebelum hashing.
-   Tidak ada kewajiban komposisi uppercase/lowercase/angka/simbol.
-   Password di-hash menggunakan Argon2id.
-   `displayName` wajib dan tidak boleh kosong.
-   Create User dan Session dilakukan dalam satu transaction.
-   Register langsung membuat Session; client memperoleh token pada
    response.
-   Register tidak membuat Organization atau Membership.
-   Email verification tidak diwajibkan pada V1.

### Success

HTTP `201 Created`

``` json
{
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "alice@example.com",
      "displayName": "Alice",
      "createdAt": "2026-11-02T10:00:00.000Z"
    },
    "session": {
      "id": "session-uuid",
      "accessToken": "opaque-random-token",
      "tokenType": "Bearer",
      "expiresAt": "2026-11-09T10:00:00.000Z"
    }
  }
}
```

Session token: - Random opaque token dengan entropy dari 32 random
bytes. - Raw token hanya dikembalikan sekali. - Database menyimpan
SHA-256 hash, bukan raw token. - Expiry tujuh hari sejak Session dibuat.

### Errors

-   `400 VALIDATION_ERROR`
-   `409 EMAIL_ALREADY_EXISTS`
-   `500 INTERNAL_SERVER_ERROR`

## 2.2 Login

`POST /api/v1/auth/login`

Authentication: tidak diperlukan.

### Request

``` json
{
  "email": "alice@example.com",
  "password": "SecurePassword123!"
}
```

### Behavior

-   Email dinormalisasi dengan aturan Register.
-   Password diverifikasi menggunakan fungsi Argon2id verify terhadap
    password hash.
-   Jangan melakukan hash ulang password lalu membandingkan hasilnya
    karena Argon2id menggunakan salt.
-   Setiap Login berhasil membuat Session baru.
-   Session lain yang sudah aktif tetap aktif; V1 mendukung
    multi-session.
-   Token dan expiry mengikuti aturan Session Register.

### Success

HTTP `200 OK`

Response berisi `data.user` dan `data.session` dengan struktur yang sama
seperti Register. Field `createdAt` pada User boleh disertakan.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_CREDENTIALS`
-   `500 INTERNAL_SERVER_ERROR`

Unknown email dan wrong password harus menghasilkan response yang sama
untuk mengurangi user enumeration.

## 2.3 Refresh Session

`POST /api/v1/auth/refresh`

Authentication: Bearer Session wajib. Tidak ada request body.

### Behavior

1.  Hash token dari Authorization header menggunakan SHA-256.
2.  Cari dan lock Session terkait.
3.  Verifikasi Session belum revoked dan belum expired.
4.  Revoke Session lama dan buat Session baru dalam satu transaction.
5.  Kembalikan token baru dengan expiry tujuh hari sejak Session baru
    dibuat.

Concurrency: - Dua refresh bersamaan dengan token yang sama tidak boleh
sama-sama berhasil. - Hanya satu request yang boleh melakukan rotasi. -
Reuse token lama ditolak dan dicatat pada log keamanan. - Reuse token
lama tidak otomatis me-revoke Session baru. - Refresh hanya berlaku jika
Session lama masih valid. Setelah tujuh hari, User harus Login
kembali. - Tidak ada grace window untuk refresh token lama pada V1.

### Success

HTTP `200 OK`

Response berisi User dan Session baru dengan struktur seperti Register.

### Errors

-   `401 MISSING_AUTHENTICATION`
-   `401 INVALID_SESSION`
-   `500 INTERNAL_SERVER_ERROR`

## 2.4 Logout

`POST /api/v1/auth/logout`

Authentication: Bearer Session wajib. Tidak ada request body.

### Behavior

-   Revoke Session yang sedang digunakan dengan mengisi `revoked_at`.
-   Session lain milik User tetap aktif.
-   Logout all devices tidak termasuk V1.

### Success

HTTP `204 No Content`, tanpa response body.

### Errors

-   `401 MISSING_AUTHENTICATION`
-   `401 INVALID_SESSION`
-   `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

# 3. Organization API

Semua endpoint pada bagian ini memerlukan Bearer Session.

## 3.1 Create Organization

`POST /api/v1/organizations`

### Request

``` json
{
  "name": "Acme Engineering"
}
```

### Validation and behavior

-   `name` wajib, 1--100 karakter setelah trim.
-   Whitespace di awal/akhir di-trim.
-   Tidak di-lowercase.
-   Whitespace-only ditolak.
-   Nama Organization tidak harus unik.
-   User ID diambil dari Session.
-   User boleh membuat beberapa Organization.
-   Create Organization, Membership `OWNER` dengan status `ACTIVE`, dan
    Activity `ORGANIZATION_CREATED` harus berada dalam satu transaction.

### Success

HTTP `201 Created`

``` json
{
  "data": {
    "organization": {
      "id": "organization-uuid",
      "name": "Acme Engineering",
      "createdAt": "2026-11-02T10:00:00.000Z"
    },
    "membership": {
      "id": "membership-uuid",
      "userId": "user-uuid",
      "role": "OWNER",
      "status": "ACTIVE",
      "joinedAt": "2026-11-02T10:00:00.000Z"
    }
  }
}
```

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `500 INTERNAL_SERVER_ERROR`

## 3.2 List Organizations

`GET /api/v1/organizations`

### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.

### Behavior

-   Hanya Organization yang memiliki ACTIVE Membership untuk User
    terautentikasi.
-   Order: `created_at DESC, id DESC`.
-   Setiap item berisi Organization dan Membership User tersebut.
-   Tidak ada Organization yang cocok menghasilkan `200` dengan
    `data: []`.

### Success

HTTP `200 OK`

``` json
{
  "data": [
    {
      "organization": {
        "id": "organization-uuid",
        "name": "Acme Engineering",
        "createdAt": "2026-11-02T10:00:00.000Z"
      },
      "membership": {
        "id": "membership-uuid",
        "role": "OWNER",
        "status": "ACTIVE",
        "joinedAt": "2026-11-02T10:00:00.000Z"
      }
    }
  ],
  "pagination": {
    "nextCursor": null,
    "hasMore": false,
    "totalCount": 1
  }
}
```

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `500 INTERNAL_SERVER_ERROR`

## 3.3 Get Organization Detail

`GET /api/v1/organizations/{organizationId}`

### Behavior

-   `organizationId` harus UUID.
-   ACTIVE Membership wajib.
-   Semua role aktif dapat membaca.
-   Response memuat Organization dan Membership User yang sedang login.
-   Organization response memuat `version` untuk OCC pada Update
    Organization.

### Success

HTTP `200 OK`, dengan `data.organization` dan `data.membership`.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

Organization tidak ditemukan dan User tidak memiliki ACTIVE Membership
tidak boleh dapat dibedakan melalui response.

## 3.4 Update Organization

`PATCH /api/v1/organizations/{organizationId}`

Authorization: OWNER atau ADMIN.

### Request

``` json
{
  "name": "Acme Technologies",
  "version": 3
}
```

### Validation and behavior

-   `name`: 1--100 karakter setelah trim; trim leading/trailing
    whitespace; tidak lowercase.
-   `version`: integer wajib, yaitu version yang dibaca client.
-   MEMBER mendapat `403 FORBIDDEN`.
-   Conditional update berdasarkan Organization ID dan expected version.
-   Version dinaikkan satu angka dan `updated_at` diperbarui.
-   Update Organization dan Activity `ORGANIZATION_UPDATED` satu
    transaction.
-   Jika tidak cocok version, tidak ada Activity yang dibuat.
-   GET Organization Detail harus mengembalikan version.

### Success

HTTP `200 OK`

``` json
{
  "data": {
    "organization": {
      "id": "organization-uuid",
      "name": "Acme Technologies",
      "version": 4,
      "createdAt": "2026-11-02T10:00:00.000Z",
      "updatedAt": "2026-11-02T11:00:00.000Z"
    }
  }
}
```

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

# 4. Membership API

Semua endpoint memerlukan Session dan ACTIVE Membership pada
Organization kecuali jika kontrak menyatakan target Membership REMOVED
dapat dibaca.

Role: `OWNER`, `ADMIN`, `MEMBER`. Status: `ACTIVE`, `REMOVED`.

## 4.1 List Organization Memberships

`GET /api/v1/organizations/{organizationId}/memberships`

### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.
-   `status`: `ACTIVE` atau `REMOVED`; default `ACTIVE`.

### Visibility

-   Semua ACTIVE Membership dapat melihat roster ACTIVE.
-   OWNER dan ADMIN boleh meminta `status=REMOVED`.
-   MEMBER yang meminta `status=REMOVED` mendapat `403 FORBIDDEN`.
-   Order: `joined_at DESC, id DESC`.

### Response

HTTP `200 OK`, collection berisi: - Membership `id`, `userId`, `role`,
`status`, `joinedAt`, `removedAt`. - User `id`, `displayName`,
`email`. - `pagination`.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

## 4.2 Get Membership Detail

`GET /api/v1/organizations/{organizationId}/memberships/{membershipId}`

### Visibility and behavior

-   OWNER/ADMIN dapat melihat ACTIVE atau REMOVED Membership.
-   MEMBER hanya dapat melihat ACTIVE Membership.
-   User tidak memperoleh akses Organization hanya karena memiliki
    Membership REMOVED; self-access ke Membership REMOVED juga tidak
    diberikan.
-   Membership harus berada di Organization pada URL.
-   Response berisi Membership dan User (`id`, `displayName`, `email`),
    termasuk role/status/joinedAt/removedAt/createdAt/updatedAt.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN` jika aktif tetapi tidak berhak melihat
-   `404 MEMBERSHIP_NOT_FOUND` jika tidak ada atau tidak terlihat
-   `500 INTERNAL_SERVER_ERROR`

## 4.3 Update Membership Role

`PATCH /api/v1/organizations/{organizationId}/memberships/{membershipId}/role`

### Request

``` json
{
  "role": "ADMIN",
  "version": 1
}
```

### Authorization

-   OWNER dapat mengubah role ADMIN/MEMBER dan Owner lain selama minimal
    satu ACTIVE OWNER tetap ada.
-   ADMIN dapat mengubah role ADMIN/MEMBER lain; tidak dapat mengubah
    OWNER dan tidak dapat mempromosikan diri menjadi OWNER.
-   MEMBER tidak dapat mengubah role.

### Behavior

-   Target Membership harus ACTIVE.
-   `version` wajib.
-   OCC: version harus cocok, lalu dinaikkan satu.
-   Last-owner invariant harus dilindungi dengan transaction/locking
    yang mencegah race condition.
-   Update dan Activity `MEMBERSHIP_ROLE_CHANGED` atomic.
-   Initial Membership version adalah 1.

### Success

HTTP `200 OK`, berisi Membership terbaru termasuk `version`.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 MEMBERSHIP_NOT_FOUND`
-   `409 VERSION_CONFLICT`
-   `409 LAST_OWNER_REQUIRED`
-   `500 INTERNAL_SERVER_ERROR`

## 4.4 Revoke Membership

`DELETE /api/v1/organizations/{organizationId}/memberships/{membershipId}`

### Request

``` json
{
  "version": 1
}
```

### Authorization

-   OWNER dapat revoke ADMIN/MEMBER; dapat revoke OWNER lain jika
    setidaknya satu ACTIVE OWNER tetap ada. OWNER boleh revoke diri
    sendiri jika Owner lain tetap ada.
-   ADMIN dapat revoke ADMIN/MEMBER lain dan dirinya sendiri; tidak
    dapat revoke OWNER.
-   MEMBER hanya dapat self-remove, tidak dapat revoke orang lain.

### Behavior

-   Target harus ACTIVE.
-   Soft revoke: status menjadi `REMOVED`, isi `removed_at`, increment
    version.
-   Transaction harus mengunci Organization atau menggunakan mekanisme
    setara untuk melindungi last-owner invariant.
-   Semua Issue yang assigned ke Membership tersebut di-unassign dalam
    transaction yang sama.
-   Buat Activity `MEMBERSHIP_REMOVED` secara atomic.
-   Session User tetap aktif secara global, tetapi akses ke Organization
    langsung hilang.
-   Target yang sudah REMOVED diperlakukan sebagai tidak ditemukan.

### Success

HTTP `204 No Content`.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 MEMBERSHIP_NOT_FOUND`
-   `409 VERSION_CONFLICT`
-   `409 LAST_OWNER_REQUIRED`
-   `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

# 5. Invitation API

Invitation berlaku pada Organization tertentu. Invitation email
dinormalisasi. Invitation token tidak pernah dikembalikan melalui API.

## 5.1 Create Invitation

`POST /api/v1/organizations/{organizationId}/invitations`

### Authorization

-   OWNER dapat mengundang ADMIN atau MEMBER.
-   ADMIN dapat mengundang MEMBER saja.
-   MEMBER tidak dapat mengundang.
-   OWNER tidak dapat diundang.

### Request

``` json
{
  "email": "alice@example.com",
  "role": "MEMBER"
}
```

### Behavior

-   Email di-trim dan lowercase.
-   Invitation berlaku tujuh hari sejak dibuat.
-   Invitation tidak memiliki User FK; email adalah target.
-   Jika target sudah memiliki ACTIVE Membership, kembalikan
    `409 ALREADY_ORGANIZATION_MEMBER`.
-   REMOVED Membership boleh diundang; saat acceptance record Membership
    yang sama direaktivasi.
-   Sebelum create, expire stale PENDING Invitation dengan Organization
    dan email yang sama di dalam transaction.
-   Partial unique index pada `(organization_id, email)` untuk
    `status='PENDING'`.
-   Tangani unique constraint violation untuk race condition.
-   Generate opaque random token 32 bytes; simpan SHA-256 hash saja.
-   Raw token dikirim melalui email, tidak dikembalikan melalui API atau
    ditulis ke log.
-   Invitation, Activity `INVITATION_CREATED`, dan Outbox Event dibuat
    dalam satu transaction.
-   Email delivery failure tidak membatalkan Invitation.

### Success

HTTP `201 Created`, berisi Invitation tanpa token/hash.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `409 ALREADY_ORGANIZATION_MEMBER`
-   `409 PENDING_INVITATION_EXISTS`
-   `500 INTERNAL_SERVER_ERROR`

## 5.2 List Organization Invitations

`GET /api/v1/organizations/{organizationId}/invitations`

### Authorization

OWNER/ADMIN saja. MEMBER ditolak.

### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.
-   `status`: optional `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`;
    tanpa filter berarti semua.

### Behavior

-   OWNER/ADMIN melihat semua Invitation Organization, bukan hanya yang
    mereka buat.
-   Order: `created_at DESC, id DESC`.
-   GET tidak mengubah status stale Invitation. Jika DB masih PENDING
    meski `expires_at` telah lewat, response tetap PENDING sampai worker
    mengubahnya menjadi EXPIRED.

### Response

HTTP `200 OK`, item memuat `id`, `email`, `role`, `status`, `invitedBy`
(`id`, `displayName`), `expiresAt`, `acceptedAt`, `revokedAt`,
`createdAt`, dan pagination.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

## 5.3 Get Invitation Detail

`GET /api/v1/organizations/{organizationId}/invitations/{invitationId}`

-   OWNER/ADMIN saja.
-   Invitation harus milik Organization pada URL.
-   Token dan token hash tidak pernah dikembalikan.
-   GET tidak mengubah status Invitation.
-   Response memuat detail Invitation dan timestamps.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 INVITATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

## 5.4 Revoke Invitation

`DELETE /api/v1/organizations/{organizationId}/invitations/{invitationId}`

Authorization: OWNER/ADMIN. Tidak ada request body.

### Behavior

-   Lock Invitation dan verifikasi Organization.
-   Jika PENDING dan belum expired: set status REVOKED, `revoked_at`,
    `updated_at`, dan Activity `INVITATION_REVOKED` dalam satu
    transaction.
-   Jika status DB PENDING tetapi `expires_at <= now`, ubah menjadi
    EXPIRED dalam transaction lalu kembalikan
    `409 INVITATION_NOT_PENDING`. Tidak membuat `INVITATION_REVOKED`
    Activity.
-   ACCEPTED, REVOKED, EXPIRED menghasilkan
    `409 INVITATION_NOT_PENDING`.

### Success

HTTP `204 No Content`.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 INVITATION_NOT_FOUND`
-   `409 INVITATION_NOT_PENDING`
-   `500 INTERNAL_SERVER_ERROR`

## 5.5 Resend Invitation

`POST /api/v1/organizations/{organizationId}/invitations/{invitationId}/resend`

Authorization: OWNER/ADMIN.

### Behavior

-   Hanya Invitation PENDING dan belum expired.
-   Menggunakan token yang sama; token hash tidak berubah.
-   Expiry tidak diperpanjang.
-   Queue email melalui Outbox.
-   Success berarti email masuk queue, bukan berarti provider telah
    mengirim email.
-   Response `202 Accepted`, `emailDelivery.status = QUEUED`.
-   Manual resend cooldown 60 detik per Invitation.
-   Cooldown manual tidak memengaruhi retry worker.
-   Email failure tidak membatalkan Invitation.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 INVITATION_NOT_FOUND`
-   `409 INVITATION_NOT_PENDING`
-   `429 RESEND_COOLDOWN`
-   `500 INTERNAL_SERVER_ERROR`

## 5.6 Accept Invitation

`POST /api/v1/invitations/accept`

Authentication: Bearer Session wajib. Active Membership pada target
Organization tidak diperlukan.

### Request

``` json
{
  "token": "opaque-invitation-token"
}
```

### Behavior

1.  Hash token dengan SHA-256 dan cari Invitation.
2.  Lock Invitation.
3.  Verifikasi status PENDING dan expiry.
4.  Jika DB status PENDING tetapi `expires_at <= now`, ubah status
    menjadi EXPIRED dalam transaction dan kembalikan
    `409 INVITATION_EXPIRED`.
5.  Normalized email User dari Session harus cocok dengan email
    Invitation; jika tidak `403 INVITATION_EMAIL_MISMATCH`.
6.  Jika User tidak memiliki Membership, buat Membership.
7.  Jika User memiliki REMOVED Membership, reaktivasi record yang sama:
    role dari Invitation, status ACTIVE, reset `joined_at`, clear
    `removed_at`.
8.  Jika User sudah memiliki ACTIVE Membership,
    `409 MEMBERSHIP_ALREADY_ACTIVE`.
9.  Tandai Invitation ACCEPTED dan isi `accepted_at`.
10. Buat Activity `INVITATION_ACCEPTED` dan Notification untuk inviter.
11. Seluruh operasi di atas satu transaction.
12. Concurrent accept hanya boleh menghasilkan satu keberhasilan.

### Success

HTTP `200 OK`, berisi Invitation dan Membership hasil acceptance.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 INVITATION_EMAIL_MISMATCH`
-   `404 INVITATION_NOT_FOUND`
-   `409 INVITATION_EXPIRED`
-   `409 INVITATION_NOT_PENDING`
-   `409 MEMBERSHIP_ALREADY_ACTIVE`
-   `500 INTERNAL_SERVER_ERROR`

## 5.7 Invitation email delivery

Transactional Outbox: - Invitation + Activity + Outbox dibuat dalam
transaction. - Worker memproses email di background. - Initial attempt
ditambah maksimum tiga retry transient pada menit 1, 5, dan 15. -
Maksimum empat attempt. - Permanent error tidak di-retry. -
At-least-once processing; jangan mengklaim exactly-once delivery. -
Worker concurrency menggunakan locking yang sesuai, misalnya
`SELECT ... FOR UPDATE SKIP LOCKED`. - Raw token dan secret tidak boleh
muncul pada log. - Lease/crash recovery lebih lanjut ditentukan pada
database/operational specification.

------------------------------------------------------------------------

# 6. Project API

Semua endpoint memerlukan Session dan ACTIVE Membership pada
Organization.

## 6.1 Create Project

`POST /api/v1/organizations/{organizationId}/projects`

Authorization: semua role aktif.

### Request

``` json
{
  "name": "Backend Platform",
  "description": "Project management API"
}
```

### Validation and behavior

-   `name`: wajib, 1--100 karakter setelah trim.
-   `description`: optional, nullable, maksimum 5000 karakter.
-   Empty/whitespace description dinormalisasi menjadi `null`.
-   Client tidak boleh menentukan `organizationId`, `nextIssueNumber`,
    `archivedAt`, atau `version`.
-   Project dibuat active dengan `next_issue_number=1`, `version=1`.
-   Activity `PROJECT_CREATED` dibuat atomic.

### Success

HTTP `201 Created`, berisi Project.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

## 6.2 List Organization Projects

`GET /api/v1/organizations/{organizationId}/projects`

Authorization: semua role aktif.

### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.
-   `status`: `ACTIVE` atau `ARCHIVED`, default `ACTIVE`.

### Behavior

-   Semua active member boleh melihat archived Project melalui filter.
-   Order: `created_at DESC, id DESC`.
-   List response tidak perlu memuat `nextIssueNumber` atau `version`.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

## 6.3 Get Project Detail

`GET /api/v1/organizations/{organizationId}/projects/{projectId}`

-   Semua role aktif dapat membaca Project aktif maupun archived.
-   Response memuat `version`.
-   `nextIssueNumber` tidak dipublikasikan.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

## 6.4 Update Project

`PATCH /api/v1/organizations/{organizationId}/projects/{projectId}`

Authorization: OWNER/ADMIN.

### Request

``` json
{
  "name": "Backend Platform V2",
  "description": null,
  "version": 3
}
```

### Validation and behavior

-   PATCH partial semantics.
-   `name` optional, jika dikirim 1--100 karakter setelah trim.
-   `description` optional nullable max 5000; empty menjadi null.
-   `version` wajib positive integer.
-   Minimal satu field mutable (`name` atau `description`) harus
    dikirim.
-   Project harus active.
-   OCC; version naik hanya jika ada perubahan aktual.
-   No-op tidak menaikkan version dan tidak membuat Activity.
-   Actual update + Activity `PROJECT_UPDATED` atomic.

### Success

HTTP `200 OK`, berisi Project terbaru.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `409 PROJECT_ARCHIVED`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

## 6.5 Archive Project

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/archive`

Authorization: OWNER/ADMIN.

### Request

``` json
{
  "version": 3
}
```

### Behavior

-   Set `archived_at`, increment version, update `updated_at`.
-   Activity `PROJECT_ARCHIVED` dalam transaction.
-   Tidak mengarsipkan Issues secara otomatis.
-   Comments dan Activities dipertahankan.
-   Idempotent: jika sudah archived, kembalikan `200` dengan
    representasi terbaru, tanpa version increment atau Activity.
-   Periksa state archived sebelum OCC agar retry dengan version lama
    tetap dapat berhasil sebagai no-op.

### Success

HTTP `200 OK`, berisi Project.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

## 6.6 Restore Project

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/restore`

Authorization: OWNER/ADMIN.

### Request

``` json
{
  "version": 4
}
```

### Behavior

-   Set `archived_at = null`, increment version.
-   Activity `PROJECT_RESTORED` dalam transaction.
-   Tidak me-restore Issues yang sebelumnya di-archive secara
    individual.
-   Idempotent: jika sudah active, kembalikan `200` representasi terbaru
    tanpa version increment atau Activity.
-   Periksa state active sebelum OCC untuk idempotent retry.

### Success

HTTP `200 OK`, berisi Project.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

# 7. Issue API

Semua endpoint memerlukan Session dan ACTIVE Membership pada
Organization. Semua role aktif dapat mengelola Issues sesuai aturan di
bawah.

Status Issue: - `TODO` - `IN_PROGRESS` - `IN_REVIEW` - `DONE` -
`CANCELLED`

Allowed transitions: - `TODO` → `IN_PROGRESS`, `CANCELLED` -
`IN_PROGRESS` → `IN_REVIEW`, `CANCELLED` - `IN_REVIEW` → `IN_PROGRESS`,
`DONE`, `CANCELLED` - `DONE` → `IN_PROGRESS` - `CANCELLED` → `TODO`

## 7.1 Create Issue

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/issues`

Authorization: semua role aktif.

### Request

``` json
{
  "title": "Implement authentication",
  "description": "Implement registration and login",
  "assigneeMembershipId": "membership-uuid"
}
```

`assigneeMembershipId` optional dan nullable.

### Validation and behavior

-   `title`: wajib, 1--200 karakter setelah trim.
-   `description`: optional nullable max 10000; empty menjadi null.
-   Assignee, jika diberikan, harus ACTIVE Membership dalam Organization
    yang sama.
-   Assignee boleh actor sendiri atau member lain.
-   Project harus active.
-   Server menentukan `organizationId`, `projectId`, `number`, status
    `TODO`, `version=1`, `archivedAt=null`.
-   Client tidak dapat menentukan Issue number, status, version, atau
    creator.
-   Dalam satu transaction:
    1.  Validasi actor, Project, dan assignee.
    2.  Increment `Project.next_issue_number` secara atomic.
    3.  Create Issue.
    4.  Create Activity `ISSUE_CREATED`.
    5.  Jika assignee bukan actor, create Notification untuk assignee.
-   Unique `(project_id, number)`.
-   Composite FK memastikan Issue dan Project berasal dari Organization
    yang sama.

### Success

HTTP `201 Created`, berisi Issue.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `409 PROJECT_ARCHIVED`
-   `422 ASSIGNEE_NOT_ACTIVE`
-   `500 INTERNAL_SERVER_ERROR`

## 7.2 List Project Issues

`GET /api/v1/organizations/{organizationId}/projects/{projectId}/issues`

### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.
-   `status`: optional status enum.
-   `assigneeMembershipId`: optional UUID.
-   `includeArchived`: boolean, default `false`.

### Behavior

-   Semua role aktif dapat membaca.
-   `includeArchived=false`: hanya Issue aktif.
-   `includeArchived=true`: Issue aktif dan archived.
-   Order: `number DESC, id DESC`.
-   `totalCount` dihitung setelah semua filter diterapkan.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

## 7.3 Get Issue Detail

`GET /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}`

-   Semua role aktif dapat membaca Issue aktif maupun archived.
-   Issue harus cocok dengan Project dan Organization pada URL.
-   Response memuat `version`.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

## 7.4 Update Issue

`PATCH /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}`

Authorization: semua role aktif.

### Request

``` json
{
  "title": "Implement secure authentication",
  "description": null,
  "version": 2
}
```

### Validation and behavior

-   PATCH partial semantics.
-   `title` optional 1--200 setelah trim.
-   `description` optional nullable max 10000; empty menjadi null.
-   `version` wajib positive integer.
-   Minimal satu field mutable (`title` atau `description`) harus
    dikirim.
-   Status dan assignee tidak diubah melalui endpoint ini.
-   Issue dan Project harus active.
-   OCC; version naik hanya jika ada perubahan aktual.
-   No-op tidak menaikkan version dan tidak membuat Activity.
-   Actual update + Activity `ISSUE_UPDATED` atomic.
-   Activity menyimpan field yang berubah beserta nilai from/to.

### Success

HTTP `200 OK`, berisi Issue terbaru.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `409 ISSUE_ARCHIVED`
-   `409 PROJECT_ARCHIVED`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

## 7.5 Assign Issue

`PATCH /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/assignee`

Authorization: semua role aktif.

### Request

``` json
{
  "assigneeMembershipId": "membership-uuid",
  "version": 3
}
```

`assigneeMembershipId` boleh `null` untuk unassign.

### Behavior

-   Issue dan Project harus active.
-   Target assignee, jika non-null, harus ACTIVE Membership dalam
    Organization yang sama.
-   Transaction memvalidasi actor, Issue, Project, target Membership,
    dan OCC.
-   Actual change mengubah assignee dan version, membuat Activity
    `ISSUE_ASSIGNEE_CHANGED`, dan Notification kepada assignee baru jika
    bukan actor.
-   Assignee lama tidak diberi Notification.
-   Jika assignee tidak berubah, return `200` tanpa version increment,
    Activity, atau Notification.

### Success

HTTP `200 OK`, berisi Issue terbaru.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `409 ISSUE_ARCHIVED`
-   `409 PROJECT_ARCHIVED`
-   `409 VERSION_CONFLICT`
-   `422 ASSIGNEE_NOT_ACTIVE`
-   `500 INTERNAL_SERVER_ERROR`

## 7.6 Update Issue Status

`PATCH /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/status`

Authorization: semua role aktif.

### Request

``` json
{
  "status": "IN_PROGRESS",
  "version": 3
}
```

### Behavior

-   Issue dan Project harus active.
-   `status` harus salah satu enum yang ditetapkan.
-   Transition harus sesuai allowed transition table.
-   Invalid transition menghasilkan `422 INVALID_STATUS_TRANSITION`.
-   Same status adalah no-op `200`: tidak ada version increment,
    Activity, atau Notification.
-   Actual mutation dilakukan dalam transaction:
    1.  Validasi actor, Issue, Project.
    2.  Verifikasi version.
    3.  Validasi transition.
    4.  Update status dan version.
    5.  Create Activity `ISSUE_STATUS_CHANGED`.
    6.  Jika ada assignee dan assignee bukan actor, create Notification
        untuk assignee.
-   Jika tidak ada assignee, Activity tetap dibuat, Notification tidak.

### Success

HTTP `200 OK`, berisi Issue terbaru.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `409 ISSUE_ARCHIVED`
-   `409 PROJECT_ARCHIVED`
-   `409 VERSION_CONFLICT`
-   `422 INVALID_STATUS_TRANSITION`
-   `500 INTERNAL_SERVER_ERROR`

## 7.7 Archive Issue

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/archive`

Authorization: semua role aktif.

### Request

``` json
{
  "version": 3
}
```

### Behavior

-   Project harus active untuk actual mutation.
-   Set `archived_at`, increment version, update timestamp.
-   Activity `ISSUE_ARCHIVED` atomic.
-   Comments dan Activities dipertahankan.
-   Idempotent: jika Issue sudah archived, return `200` latest
    representation tanpa version increment/Activity.
-   Check archived state sebelum OCC untuk retry idempotent.

### Success

HTTP `200 OK`, berisi Issue.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `409 PROJECT_ARCHIVED`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

## 7.8 Restore Issue

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/restore`

Authorization: semua role aktif.

### Request

``` json
{
  "version": 4
}
```

### Behavior

-   Project harus active.
-   Set `archived_at=null`, increment version.
-   Status dan assignee tidak berubah.
-   Activity `ISSUE_RESTORED` atomic.
-   Idempotent: jika Issue sudah active, return `200` tanpa version
    increment/Activity.

### Success

HTTP `200 OK`, berisi Issue.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `409 PROJECT_ARCHIVED`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

## 7.9 Issue search

Search V1 hanya dalam satu Project: - Title dan description:
case-insensitive substring. - Issue number: exact numeric match. -
Cursor pagination. - Tidak ada fuzzy, semantic, atau global search.

------------------------------------------------------------------------

# 8. Comment API

Semua endpoint memerlukan Session dan ACTIVE Membership. Semua active
roles dapat membaca dan membuat Comment.

Comment body: - Trim leading/trailing whitespace. - 1--10000 karakter
setelah trim. - Internal line breaks dipertahankan. - HTML tidak boleh
dieksekusi sebagai active markup oleh client.

## 8.1 List Issue Comments

`GET /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments`

### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.

### Behavior

-   Semua active roles dapat membaca.
-   Read tetap diizinkan ketika Issue atau Project archived.
-   Memuat Comment aktif dan deleted.
-   Deleted Comment menampilkan placeholder
    `Comment ini telah dihapus.`; original body tidak dikembalikan.
-   Author dan timestamps tetap ditampilkan.
-   `totalCount` mencakup Comment deleted.
-   Order: `created_at ASC, id ASC`.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

## 8.2 Create Comment

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments`

Authorization: semua active roles.

### Request

``` json
{
  "body": "The authentication flow is ready for review."
}
```

### Behavior

-   Issue dan Project harus active.
-   Body wajib, trim, 1--10000 karakter.
-   Actor Membership berasal dari Session.
-   Dalam satu transaction:
    1.  Create Comment.
    2.  Create Activity `COMMENT_CREATED`.
    3.  Jika Issue memiliki assignee dan assignee bukan actor, create
        Notification untuk assignee.
-   Activity/Notification tidak menyimpan Comment body.

### Success

HTTP `201 Created`, berisi Comment.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `409 ISSUE_ARCHIVED`
-   `409 PROJECT_ARCHIVED`
-   `500 INTERNAL_SERVER_ERROR`

## 8.3 Update Comment

`PATCH /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments/{commentId}`

### Authorization

-   OWNER/ADMIN dapat mengelola Comment siapa pun.
-   MEMBER hanya dapat mengelola Comment miliknya sendiri.

### Request

``` json
{
  "body": "The authentication flow is ready for QA.",
  "version": 1
}
```

### Behavior

-   Comment harus belum deleted.
-   Issue dan Project harus active.
-   Body wajib, 1--10000 karakter setelah trim.
-   Version wajib.
-   OCC; update body, version, updated_at.
-   Activity `COMMENT_UPDATED` atomic.
-   Activity tidak menyimpan Comment body.
-   Initial Comment version adalah 1.

### Success

HTTP `200 OK`, berisi Comment terbaru.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `404 COMMENT_NOT_FOUND`
-   `409 COMMENT_DELETED`
-   `409 ISSUE_ARCHIVED`
-   `409 PROJECT_ARCHIVED`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

## 8.4 Delete Comment

`DELETE /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments/{commentId}`

### Authorization

-   OWNER/ADMIN dapat delete Comment siapa pun.
-   MEMBER hanya dapat delete Comment miliknya sendiri.

### Request

``` json
{
  "version": 1
}
```

### Behavior

-   Soft delete: set `deleted_at`, increment version, update
    `updated_at`.
-   Issue dan Project harus active untuk actual delete.
-   Activity `COMMENT_DELETED` atomic.
-   Original body tetap disimpan di DB tetapi tidak pernah dikembalikan
    setelah deletion.
-   Sudah deleted: idempotent `200`, kembalikan placeholder; tidak ada
    version increment atau Activity.
-   Authorization tetap diperiksa pada retry.
-   Initial Comment version adalah 1.

### Success

HTTP `200 OK`, berisi Comment placeholder, author, timestamps, dan
deletion state.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `404 COMMENT_NOT_FOUND`
-   `409 ISSUE_ARCHIVED`
-   `409 PROJECT_ARCHIVED`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

Catatan: idempotency berarti repeated delete tidak menghasilkan
`409 COMMENT_DELETED`; status tersebut relevan untuk Update Comment
terhadap Comment yang sudah deleted.

------------------------------------------------------------------------

# 9. Activity API

Activity adalah append-only organization event log. Tidak ada read
event.

## 9.1 List Organization Activities

`GET /api/v1/organizations/{organizationId}/activities`

Authorization: semua ACTIVE roles.

### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.
-   `eventType`: optional.
-   `actorId`: optional.
-   `issueId`: optional.

### Behavior

-   Semua ACTIVE roles dapat membaca seluruh Activity Organization,
    termasuk event administratif.
-   Order: `created_at DESC, id DESC`.
-   `totalCount` dihitung setelah filter.
-   Project context disimpan dalam metadata; Activity tidak memiliki
    `project_id`.
-   Actor boleh null, misalnya untuk event sistem.
-   Metadata menggunakan versioned envelope.
-   Tidak boleh menyimpan password, token, secret, atau Comment body.
-   Tidak ada endpoint detail Activity pada V1.
-   Tidak ada API create/update/delete Activity.
-   Activity dibuat oleh operasi bisnis yang relevan dan atomic dengan
    mutasi domain.

### Response

HTTP `200 OK`, collection berisi: - `id` - `eventType` - `actor`
nullable - `issue` nullable - `metadata` - `createdAt` - `pagination`

Metadata envelope:

``` json
{
  "schemaVersion": 1,
  "entityType": "ISSUE",
  "entityId": "issue-uuid",
  "changes": {}
}
```

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

# 10. Notification API

Notification adalah inbox personal yang mereferensikan Activity dan
menyimpan snapshot konten ringkas. Notification tidak menggantikan
Activity.

Notification types yang disepakati: - `INVITATION_ACCEPTED` -
`ISSUE_ASSIGNED` - `USER_MENTIONED` - `COMMENT_ADDED` -
`ISSUE_STATUS_CHANGED`

Recipient rules: - Invitation accepted → inviter. - Issue assigned →
assignee baru. - User mentioned → User yang disebut. - Comment added →
assignee. - Issue status changed → assignee. - Tidak ada
self-notification. - Tidak ada Notification baru untuk inactive
member. - Tidak ada watchers/subscribers, push, atau realtime pada V1. -
Email hanya untuk Invitation.

## 10.1 Notification content snapshot

Notification response self-contained. Setiap Notification menyimpan
snapshot `content` ketika dibuat: - `title` - `message` - `resource`
reference (type dan ID) - `activityId` tetap menjadi referensi ke
Activity.

Snapshot tidak berubah jika nama User, Issue, atau resource berubah
kemudian. Jangan menduplikasi seluruh Activity. Jangan memasukkan secret
atau Comment body ke snapshot.

Contoh:

``` json
{
  "id": "notification-uuid",
  "organization": {
    "id": "organization-uuid",
    "name": "Acme Engineering"
  },
  "type": "ISSUE_ASSIGNED",
  "content": {
    "title": "Issue assigned to you",
    "message": "Alice assigned you to Implement authentication.",
    "resource": {
      "type": "ISSUE",
      "id": "issue-uuid"
    }
  },
  "activityId": "activity-uuid",
  "readAt": null,
  "createdAt": "2026-11-02T10:00:00.000Z"
}
```

## 10.2 List My Notifications

`GET /api/v1/notifications`

Authentication: Bearer Session wajib.

### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.
-   `status`: `ALL`, `UNREAD`, atau `READ`; default `ALL`.

### Behavior

-   User hanya dapat membaca Notification miliknya sendiri.
-   Recipient User ID selalu berasal dari Session.
-   Order: `created_at DESC, id DESC`.
-   Filter status:
    -   `ALL`: semua Notification.
    -   `UNREAD`: `read_at IS NULL`.
    -   `READ`: `read_at IS NOT NULL`.
-   Notification menyertakan snapshot content dan Organization summary.
-   Historical personal Notification tetap dapat dibaca setelah
    Membership Organization dicabut; tidak memberi akses ke resource
    Organization lainnya.
-   `totalCount` dihitung setelah filter.

### Success

HTTP `200 OK`, collection dengan `data` dan `pagination`.

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `500 INTERNAL_SERVER_ERROR`

## 10.3 Mark Notification as Read

`PATCH /api/v1/notifications/{notificationId}/read`

Authentication: Bearer Session wajib. Tidak ada request body.

### Behavior

-   User hanya dapat mengubah Notification miliknya sendiri.
-   Tidak memerlukan ACTIVE Membership pada Organization; Notification
    adalah resource personal.
-   Jika belum dibaca, isi `read_at` dengan timestamp operasi pertama.
-   Jika sudah dibaca, kembalikan nilai `readAt` sebelumnya tanpa
    perubahan.
-   Tidak membuat Activity.
-   Idempotent.
-   Conditional update memastikan concurrent request tidak menimpa
    timestamp pembacaan pertama.

### Success

HTTP `200 OK`

``` json
{
  "data": {
    "id": "notification-uuid",
    "readAt": "2026-11-02T14:00:00.000Z"
  }
}
```

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 NOTIFICATION_NOT_FOUND` jika tidak ada atau bukan milik User
-   `500 INTERNAL_SERVER_ERROR`

## 10.4 Mark All Notifications as Read

`PATCH /api/v1/notifications/read-all`

Authentication: Bearer Session wajib. Tidak ada request body.

### Behavior

-   Menandai seluruh Notification milik User yang `read_at IS NULL`.
-   Notification yang sudah dibaca tidak diubah.
-   Tidak memengaruhi Notification User lain.
-   Tidak membuat Activity.
-   Idempotent.
-   Implementasi dapat menggunakan satu conditional UPDATE berdasarkan
    `recipient_user_id` dari Session.

### Success

HTTP `204 No Content`.

### Errors

-   `401 INVALID_SESSION`
-   `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

# 11. Cross-cutting domain and consistency rules

## 11.1 Tenant isolation

-   Active Membership adalah prasyarat akses Organization resource.
-   Organization ID tidak boleh dipercaya dari request body untuk
    menentukan tenant context.
-   Query dan mutation tenant-scoped harus membatasi Organization ID dan
    resource ID secara konsisten.
-   Issue harus berada pada Project dan Organization yang sama.
-   Assignee harus merupakan ACTIVE Membership di Organization Issue.
-   Cross-tenant resource dan resource yang tidak terlihat menggunakan
    404 sesuai kontrak.

## 11.2 Optimistic concurrency

Version integer digunakan pada resource berikut: - Organization -
Membership - Project - Issue - Comment

Version awal adalah 1. - Request mutasi yang memerlukan OCC harus
menyertakan expected version. - Actual mutation menaikkan version
satu. - No-op tidak menaikkan version. - Version mismatch menghasilkan
409. - Database specification harus menetapkan conditional
update/locking yang mencegah lost update.

## 11.3 Transactional Activity

Untuk mutasi bisnis yang menghasilkan Activity, perubahan resource dan
Activity harus commit atau rollback bersama. Tidak boleh ada Activity
sukses untuk mutasi yang gagal.

## 11.4 Notification

Notification dibuat dalam transaction yang sama dengan Activity/mutasi
terkait jika aturan event memerlukannya. Notification tidak dibuat untuk
actor sendiri. Unique `(activity_id, recipient_user_id)` merupakan
kandidat constraint untuk mencegah duplikasi; final constraint
dikonfirmasi pada Phase 0.3.

## 11.5 Archive rules

-   Organization tidak dapat di-archive atau dihapus permanen pada V1.
-   Project dan Issue menggunakan archive/restore, bukan hard delete.
-   Project archive tidak otomatis mengarsipkan Issue.
-   Project restore tidak otomatis me-restore Issue yang sebelumnya
    di-archive secara individual.
-   Issue dalam archived Project tidak dapat dimodifikasi.
-   Archived Issue/Project masih dapat dibaca.
-   Comment read tetap diizinkan ketika Issue/Project archived;
    create/update/delete Comment tidak diizinkan pada resource archived.

## 11.6 Activity metadata

Activity metadata menggunakan envelope berversi: - `schemaVersion` -
`entityType` - `entityId` - `changes`

Metadata harus cukup untuk audit event dan menghindari penyimpanan
secret, token, password, atau Comment body.

## 11.7 Outbox and delivery guarantees

-   Transactional Outbox digunakan untuk email Invitation.
-   Delivery bersifat at-least-once, bukan exactly-once.
-   Retry transient failure: initial attempt + maksimum tiga retry pada
    1, 5, dan 15 menit.
-   Permanent failure tidak di-retry.
-   Worker harus aman terhadap concurrent processing.
-   Resend manual menggunakan cooldown 60 detik dan tidak mengubah
    Invitation expiry.

------------------------------------------------------------------------

# 12. Endpoint inventory

  ----------------------------------------------------------------------------------------------------------------------------------------------------
  Domain            Method            Path                                                                                           Purpose
  ----------------- ----------------- ---------------------------------------------------------------------------------------------- -----------------
  Auth              POST              `/auth/register`                                                                               Register User +
                                                                                                                                     Session

  Auth              POST              `/auth/login`                                                                                  Login, create
                                                                                                                                     Session

  Auth              POST              `/auth/refresh`                                                                                Rotate Session

  Auth              POST              `/auth/logout`                                                                                 Revoke current
                                                                                                                                     Session

  Organization      POST              `/organizations`                                                                               Create
                                                                                                                                     Organization

  Organization      GET               `/organizations`                                                                               List
                                                                                                                                     Organizations

  Organization      GET               `/organizations/{organizationId}`                                                              Get Organization

  Organization      PATCH             `/organizations/{organizationId}`                                                              Update
                                                                                                                                     Organization

  Membership        GET               `/organizations/{organizationId}/memberships`                                                  List Memberships

  Membership        GET               `/organizations/{organizationId}/memberships/{membershipId}`                                   Get Membership

  Membership        PATCH             `/organizations/{organizationId}/memberships/{membershipId}/role`                              Change role

  Membership        DELETE            `/organizations/{organizationId}/memberships/{membershipId}`                                   Revoke Membership

  Invitation        POST              `/organizations/{organizationId}/invitations`                                                  Create Invitation

  Invitation        GET               `/organizations/{organizationId}/invitations`                                                  List Invitations

  Invitation        GET               `/organizations/{organizationId}/invitations/{invitationId}`                                   Get Invitation

  Invitation        DELETE            `/organizations/{organizationId}/invitations/{invitationId}`                                   Revoke Invitation

  Invitation        POST              `/organizations/{organizationId}/invitations/{invitationId}/resend`                            Resend Invitation

  Invitation        POST              `/invitations/accept`                                                                          Accept Invitation

  Project           POST              `/organizations/{organizationId}/projects`                                                     Create Project

  Project           GET               `/organizations/{organizationId}/projects`                                                     List Projects

  Project           GET               `/organizations/{organizationId}/projects/{projectId}`                                         Get Project

  Project           PATCH             `/organizations/{organizationId}/projects/{projectId}`                                         Update Project

  Project           POST              `/organizations/{organizationId}/projects/{projectId}/archive`                                 Archive Project

  Project           POST              `/organizations/{organizationId}/projects/{projectId}/restore`                                 Restore Project

  Issue             POST              `/organizations/{organizationId}/projects/{projectId}/issues`                                  Create Issue

  Issue             GET               `/organizations/{organizationId}/projects/{projectId}/issues`                                  List Issues

  Issue             GET               `/organizations/{organizationId}/projects/{projectId}/issues/{issueId}`                        Get Issue

  Issue             PATCH             `/organizations/{organizationId}/projects/{projectId}/issues/{issueId}`                        Update Issue

  Issue             PATCH             `/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/assignee`               Assign Issue

  Issue             PATCH             `/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/status`                 Change Issue
                                                                                                                                     status

  Issue             POST              `/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/archive`                Archive Issue

  Issue             POST              `/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/restore`                Restore Issue

  Comment           GET               `/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments`               List Comments

  Comment           POST              `/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments`               Create Comment

  Comment           PATCH             `/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments/{commentId}`   Update Comment

  Comment           DELETE            `/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments/{commentId}`   Soft-delete
                                                                                                                                     Comment

  Activity          GET               `/organizations/{organizationId}/activities`                                                   List Activities

  Notification      GET               `/notifications`                                                                               List My
                                                                                                                                     Notifications

  Notification      PATCH             `/notifications/{notificationId}/read`                                                         Mark one read

  Notification      PATCH             `/notifications/read-all`                                                                      Mark all read
  ----------------------------------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 13. Explicit V1 exclusions

The following are outside V1 scope unless separately approved: - Email
verification. - JWT authentication and cookie-based Session. - Logout
all devices. - Organization archive/permanent deletion. - Project/Issue
hard delete. - Custom Issue workflows. - Fuzzy, semantic, or global
Issue search. - Activity detail endpoint and client-side Activity
mutations. - Notification push/realtime. - Notification
watchers/subscribers. - Email notifications other than Invitation. -
Full Comment edit history. - Automatic cascading archive/restore between
Project and Issue. - Kubernetes and multi-instance deployment. -
Distributed tracing. - PITR. - Performance SLO numeric targets before
workload baseline.

------------------------------------------------------------------------

# 14. Open items for Phase 0.3 Database Specification

These are not API endpoint blockers, but must be resolved in the
database design:

1.  Final PostgreSQL types, nullability, defaults, and naming.
2.  Full ERD and FK graph.
3.  Composite foreign keys for tenant integrity and assignee membership.
4.  Unique/check constraints and partial unique indexes.
5.  Notification `content` JSONB snapshot schema and schema versioning.
6.  Notification uniqueness, including
    `(activity_id, recipient_user_id)` decision.
7.  Invitation resend cooldown persistence, likely `last_resent_at` or
    an equivalent durable design.
8.  Membership, Project, Issue, Comment version fields and initial
    values.
9.  Last-Owner concurrency protection and transaction locking strategy.
10. Invitation acceptance/revocation and expiry concurrency.
11. Atomic Issue number allocation.
12. Outbox worker locking, retry state, and crash recovery.
13. Indexes for cursor pagination and tenant-scoped queries.
14. Migration and seed strategy.

**Phase 0.2 completion criterion:** endpoint contracts and decisions are
consolidated here. Phase 0.3 must translate these contracts into
enforceable database structures and transaction strategies before domain
implementation begins.
