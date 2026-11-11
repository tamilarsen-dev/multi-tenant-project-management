# 0001 — API Contract

| Field | Value |
|---|---|
| Document ID | 0001 |
| Version | 1.1 |
| Status | Complete for V1 planning; pending implementation review |
| Product | Multi-Tenant Project Management SaaS |
| API version | V1 |
| Base path | `/api/v1` |
| Last updated | 2026-11-09 |
| Replaces | Phase 0.2 API Specification V1.0 as the maintained API contract |

## 1. Purpose

Dokumen ini mendefinisikan kontrak HTTP publik untuk API V1: endpoint, method, path, request, response, authorization, validasi khusus endpoint, error yang dapat dihasilkan, dan perilaku mutasi.

Dokumen ini diturunkan dari Phase 0.2 API Specification V1.0 dan diselaraskan dengan Requirements V1.2, Domain Map V1.2, Permissions V1.1, Database Specification V1.3, Security Baseline V1.0, dan Architecture baseline ADR-001.

## 2. Authority and boundaries

- `api-conventions.md` adalah otoritas untuk aturan HTTP lintas endpoint: format, authentication header, error envelope, status semantics, pagination, PATCH/OCC, dan request limits.
- Requirements Specification adalah otoritas untuk functional behavior dan acceptance criteria.
- Domain Map adalah otoritas untuk domain meaning, lifecycle, dan invariants.
- Permissions Specification adalah otoritas untuk role/action authorization.
- Database Specification adalah otoritas untuk persistence constraints, transaction/locking requirements, dan retention mechanics.
- Security Baseline adalah otoritas untuk security controls.
- ADR-001 dan `architecture.md` adalah otoritas untuk codebase boundaries, bukan bentuk HTTP response.

Jika kontrak endpoint bertentangan dengan salah satu authority di atas, jangan menebak atau mengubah policy secara diam-diam. Catat discrepancy dan selesaikan pada dokumen pemilik keputusan.

## 3. Scope

Endpoint V1 yang didefinisikan dalam dokumen ini mencakup Authentication, Organization, Membership, Invitation, Project, Issue, Comment, Activity, dan Notification.

Dokumen ini bukan implementasi dan tidak membuktikan bahwa endpoint, middleware, tests, database behavior, atau security controls telah tersedia.

## 4. API-wide conventions

Aturan global tidak diduplikasi di sini. Implementasi dan client MUST mengikuti [`api-conventions.md`](./api-conventions.md). Setiap endpoint di bawah ini menggunakan base path `/api/v1`; path ditampilkan lengkap agar kontrak dapat dibaca tanpa menyusun prefix secara manual.

## 5. Endpoint contracts

## 5.1 Authentication API

### 5.1.1 Register

`POST /api/v1/auth/register`

Authentication: tidak diperlukan.

#### Request

``` json
{
  "email": "alice@example.com",
  "password": "SecurePassword123!",
  "displayName": "Alice"
}
```

#### Validation and behavior

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

#### Success

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

#### Errors

-   `400 VALIDATION_ERROR`
-   `409 EMAIL_ALREADY_EXISTS`
-   `500 INTERNAL_SERVER_ERROR`

### 5.1.2 Login

`POST /api/v1/auth/login`

Authentication: tidak diperlukan.

#### Request

``` json
{
  "email": "alice@example.com",
  "password": "SecurePassword123!"
}
```

#### Behavior

-   Email dinormalisasi dengan aturan Register.
-   Password diverifikasi menggunakan fungsi Argon2id verify terhadap
    password hash.
-   Jangan melakukan hash ulang password lalu membandingkan hasilnya
    karena Argon2id menggunakan salt.
-   Setiap Login berhasil membuat Session baru.
-   Session lain yang sudah aktif tetap aktif; V1 mendukung
    multi-session.
-   Token dan expiry mengikuti aturan Session Register.

#### Success

HTTP `200 OK`

Response berisi `data.user` dan `data.session` dengan struktur yang sama
seperti Register. Field `createdAt` pada User boleh disertakan.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_CREDENTIALS`
-   `500 INTERNAL_SERVER_ERROR`

Unknown email dan wrong password harus menghasilkan response yang sama
untuk mengurangi user enumeration.

### 5.1.3 Refresh Session

`POST /api/v1/auth/refresh`

Authentication: Bearer Session wajib. Tidak ada request body.

#### Behavior

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

#### Success

HTTP `200 OK`

Response berisi User dan Session baru dengan struktur seperti Register.

#### Errors

-   `401 MISSING_AUTHENTICATION`
-   `401 INVALID_SESSION`
-   `500 INTERNAL_SERVER_ERROR`

### 5.1.4 Logout

`POST /api/v1/auth/logout`

Authentication: Bearer Session wajib. Tidak ada request body.

#### Behavior

-   Revoke Session yang sedang digunakan dengan mengisi `revoked_at`.
-   Session lain milik User tetap aktif.
-   Logout all devices tidak termasuk V1.

#### Success

HTTP `204 No Content`, tanpa response body.

#### Errors

-   `401 MISSING_AUTHENTICATION`
-   `401 INVALID_SESSION`
-   `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

## 5.2 Organization API

Semua endpoint pada bagian ini memerlukan Bearer Session.

### 5.2.1 Create Organization

`POST /api/v1/organizations`

#### Request

``` json
{
  "name": "Acme Engineering"
}
```

#### Validation and behavior

-   `name` wajib, 1--100 karakter setelah trim.
-   Whitespace di awal/akhir di-trim.
-   Tidak di-lowercase.
-   Whitespace-only ditolak.
-   Nama Organization tidak harus unik.
-   User ID diambil dari Session.
-   User boleh membuat beberapa Organization.
-   Create Organization, Membership `OWNER` dengan status `ACTIVE`, dan
    Activity `ORGANIZATION_CREATED` harus berada dalam satu transaction.

#### Success

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

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `500 INTERNAL_SERVER_ERROR`

### 5.2.2 List Organizations

`GET /api/v1/organizations`

#### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.

#### Behavior

-   Hanya Organization yang memiliki ACTIVE Membership untuk User
    terautentikasi.
-   Order: `created_at DESC, id DESC`.
-   Setiap item berisi Organization dan Membership User tersebut.
-   Tidak ada Organization yang cocok menghasilkan `200` dengan
    `data: []`.

#### Success

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

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `500 INTERNAL_SERVER_ERROR`

### 5.2.3 Get Organization Detail

`GET /api/v1/organizations/{organizationId}`

#### Behavior

-   `organizationId` harus UUID.
-   ACTIVE Membership wajib.
-   Semua role aktif dapat membaca.
-   Response memuat Organization dan Membership User yang sedang login.
-   Organization response memuat `version` untuk OCC pada Update
    Organization.

#### Success

HTTP `200 OK`, dengan `data.organization` dan `data.membership`.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

Organization tidak ditemukan dan User tidak memiliki ACTIVE Membership
tidak boleh dapat dibedakan melalui response.

### 5.2.4 Update Organization

`PATCH /api/v1/organizations/{organizationId}`

Authorization: OWNER atau ADMIN.

#### Request

``` json
{
  "name": "Acme Technologies",
  "version": 3
}
```

#### Validation and behavior

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

#### Success

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

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

## 5.3 Membership API

Semua endpoint memerlukan Session dan ACTIVE Membership pada
Organization kecuali jika kontrak menyatakan target Membership REMOVED
dapat dibaca.

Role: `OWNER`, `ADMIN`, `MEMBER`. Status: `ACTIVE`, `REMOVED`.

### 5.3.1 List Organization Memberships

`GET /api/v1/organizations/{organizationId}/memberships`

#### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.
-   `status`: `ACTIVE` atau `REMOVED`; default `ACTIVE`.

#### Visibility

-   Semua ACTIVE Membership dapat melihat roster ACTIVE.
-   OWNER dan ADMIN boleh meminta `status=REMOVED`.
-   MEMBER yang meminta `status=REMOVED` mendapat `403 FORBIDDEN`.
-   Order: `joined_at DESC, id DESC`.

#### Response

HTTP `200 OK`, collection berisi: - Membership `id`, `userId`, `role`,
`status`, `joinedAt`, `removedAt`. - User `id`, `displayName`,
`email`. - `pagination`.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

### 5.3.2 Get Membership Detail

`GET /api/v1/organizations/{organizationId}/memberships/{membershipId}`

#### Visibility and behavior

-   OWNER/ADMIN dapat melihat ACTIVE atau REMOVED Membership.
-   MEMBER hanya dapat melihat ACTIVE Membership.
-   User tidak memperoleh akses Organization hanya karena memiliki
    Membership REMOVED; self-access ke Membership REMOVED juga tidak
    diberikan.
-   Membership harus berada di Organization pada URL.
-   Response berisi Membership dan User (`id`, `displayName`, `email`),
    termasuk role/status/joinedAt/removedAt/createdAt/updatedAt.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN` jika aktif tetapi tidak berhak melihat
-   `404 MEMBERSHIP_NOT_FOUND` jika tidak ada atau tidak terlihat
-   `500 INTERNAL_SERVER_ERROR`

### 5.3.3 Update Membership Role

`PATCH /api/v1/organizations/{organizationId}/memberships/{membershipId}/role`

#### Request

``` json
{
  "role": "ADMIN",
  "version": 1
}
```

#### Authorization

-   OWNER dapat mengubah role ADMIN/MEMBER dan Owner lain selama minimal
    satu ACTIVE OWNER tetap ada.
-   ADMIN dapat mengubah role ADMIN/MEMBER lain; tidak dapat mengubah
    OWNER dan tidak dapat mempromosikan diri menjadi OWNER.
-   MEMBER tidak dapat mengubah role.

#### Behavior

-   Target Membership harus ACTIVE.
-   `version` wajib.
-   OCC: version harus cocok, lalu dinaikkan satu.
-   Last-owner invariant harus dilindungi dengan transaction/locking
    yang mencegah race condition.
-   Update dan Activity `MEMBERSHIP_ROLE_CHANGED` atomic.
-   Initial Membership version adalah 1.

#### Success

HTTP `200 OK`, berisi Membership terbaru termasuk `version`.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 MEMBERSHIP_NOT_FOUND`
-   `409 VERSION_CONFLICT`
-   `409 LAST_OWNER_REQUIRED`
-   `500 INTERNAL_SERVER_ERROR`

### 5.3.4 Revoke Membership

`DELETE /api/v1/organizations/{organizationId}/memberships/{membershipId}`

#### Request

``` json
{
  "version": 1
}
```

#### Authorization

-   OWNER dapat revoke ADMIN/MEMBER; dapat revoke OWNER lain jika
    setidaknya satu ACTIVE OWNER tetap ada. OWNER boleh revoke diri
    sendiri jika Owner lain tetap ada.
-   ADMIN dapat revoke ADMIN/MEMBER lain dan dirinya sendiri; tidak
    dapat revoke OWNER.
-   MEMBER hanya dapat self-remove, tidak dapat revoke orang lain.

#### Behavior

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

#### Success

HTTP `204 No Content`.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 MEMBERSHIP_NOT_FOUND`
-   `409 VERSION_CONFLICT`
-   `409 LAST_OWNER_REQUIRED`
-   `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

## 5.4 Invitation API

Invitation berlaku pada Organization tertentu. Invitation email
dinormalisasi. Invitation token tidak pernah dikembalikan melalui API.

### 5.4.1 Create Invitation

`POST /api/v1/organizations/{organizationId}/invitations`

#### Authorization

-   OWNER dapat mengundang ADMIN atau MEMBER.
-   ADMIN dapat mengundang MEMBER saja.
-   MEMBER tidak dapat mengundang.
-   OWNER tidak dapat diundang.

#### Request

``` json
{
  "email": "alice@example.com",
  "role": "MEMBER"
}
```

#### Behavior

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

#### Success

HTTP `201 Created`, berisi Invitation tanpa token/hash.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `409 ALREADY_ORGANIZATION_MEMBER`
-   `409 PENDING_INVITATION_EXISTS`
-   `500 INTERNAL_SERVER_ERROR`

### 5.4.2 List Organization Invitations

`GET /api/v1/organizations/{organizationId}/invitations`

#### Authorization

OWNER/ADMIN saja. MEMBER ditolak.

#### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.
-   `status`: optional `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`;
    tanpa filter berarti semua.

#### Behavior

-   OWNER/ADMIN melihat semua Invitation Organization, bukan hanya yang
    mereka buat.
-   Order: `created_at DESC, id DESC`.
-   GET tidak mengubah status stale Invitation. Jika DB masih PENDING
    meski `expires_at` telah lewat, response tetap PENDING sampai worker
    mengubahnya menjadi EXPIRED.

#### Response

HTTP `200 OK`, item memuat `id`, `email`, `role`, `status`, `invitedBy`
(`id`, `displayName`), `expiresAt`, `acceptedAt`, `revokedAt`,
`createdAt`, dan pagination.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

### 5.4.3 Get Invitation Detail

`GET /api/v1/organizations/{organizationId}/invitations/{invitationId}`

-   OWNER/ADMIN saja.
-   Invitation harus milik Organization pada URL.
-   Token dan token hash tidak pernah dikembalikan.
-   GET tidak mengubah status Invitation.
-   Response memuat detail Invitation dan timestamps.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 INVITATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

### 5.4.4 Revoke Invitation

`DELETE /api/v1/organizations/{organizationId}/invitations/{invitationId}`

Authorization: OWNER/ADMIN. Tidak ada request body.

#### Behavior

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

#### Success

HTTP `204 No Content`.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 INVITATION_NOT_FOUND`
-   `409 INVITATION_NOT_PENDING`
-   `500 INTERNAL_SERVER_ERROR`

### 5.4.5 Resend Invitation

`POST /api/v1/organizations/{organizationId}/invitations/{invitationId}/resend`

Authorization: OWNER/ADMIN.

#### Behavior

-   Hanya Invitation berstatus `PENDING` dan belum expired yang dapat
    di-resend.
-   Resend merotasi token: token baru dibuat, token lama langsung tidak
    valid, dan expiry awal tujuh hari tidak diperpanjang.
-   Token baru hanya disimpan sebagai SHA-256 hash; raw token dikirim
    melalui Outbox email dan tidak dikembalikan melalui API atau log.
-   Invitation token rotation dan pembuatan Outbox Event harus commit
    dalam satu transaction.
-   Resend tunduk pada cooldown minimum 60 detik dan maksimum lima
    successful resend operations per Invitation dalam rolling 24-hour
    window.
-   Operasi dihitung setelah transaction token rotation + Outbox Event
    berhasil commit. Hasil delivery provider tidak mengubah hitungan.
-   Request yang ditolak oleh cooldown/quota tidak mengonsumsi quota,
    tidak merotasi token, dan tidak membuat Outbox Event.
-   Success berarti event masuk Outbox, bukan email sudah diterima.
-   Retry worker tidak mengonsumsi manual resend quota.

#### Success

HTTP `202 Accepted`, dengan status delivery `QUEUED`.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 INVITATION_NOT_FOUND`
-   `409 INVITATION_NOT_PENDING`
-   `429 RESEND_COOLDOWN` atau `429 RESEND_LIMIT_REACHED`
-   `500 INTERNAL_SERVER_ERROR`

### 5.4.6 Accept Invitation

`POST /api/v1/invitations/accept`

Authentication: Bearer Session wajib. Active Membership pada target
Organization tidak diperlukan.

#### Request

``` json
{
  "token": "opaque-invitation-token"
}
```

#### Behavior

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

#### Success

HTTP `200 OK`, berisi Invitation dan Membership hasil acceptance.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 INVITATION_EMAIL_MISMATCH`
-   `404 INVITATION_NOT_FOUND`
-   `409 INVITATION_EXPIRED`
-   `409 INVITATION_NOT_PENDING`
-   `409 MEMBERSHIP_ALREADY_ACTIVE`
-   `500 INTERNAL_SERVER_ERROR`

### 5.4.7 Invitation email delivery

Transactional Outbox: Invitation, Activity, dan Outbox Event dibuat
secara atomic dalam transaction. Worker memproses email di background.
Delivery bersifat at-least-once; exactly-once delivery tidak dijanjikan.
Maksimum delapan total delivery attempts termasuk initial attempt.
Transient network/timeouts, HTTP 408, HTTP 429, dan provider HTTP 5xx
boleh di-retry dengan exponential backoff mulai 1 menit, doubling,
maximum 60 menit, dan ±20% jitter. Provider 4xx selain 408/429 bersifat
non-retryable. Event terminal menjadi `FAILED`; event tersebut tidak
di-reset. Raw token dan secret tidak boleh masuk log. Detail claim,
lease, recovery, dan persistence mengikuti Database Specification.

------------------------------------------------------------------------

## 5.5 Project API

Semua endpoint memerlukan Session dan ACTIVE Membership pada
Organization.

### 5.5.1 Create Project

`POST /api/v1/organizations/{organizationId}/projects`

Authorization: semua role aktif.

#### Request

``` json
{
  "name": "Backend Platform",
  "description": "Project management API"
}
```

#### Validation and behavior

-   `name`: wajib, 1--100 karakter setelah trim.
-   `description`: optional, nullable, maksimum 5000 karakter.
-   Empty/whitespace description dinormalisasi menjadi `null`.
-   Client tidak boleh menentukan `organizationId`, `nextIssueNumber`,
    `archivedAt`, atau `version`.
-   Project dibuat active dengan `next_issue_number=1`, `version=1`.
-   Activity `PROJECT_CREATED` dibuat atomic.

#### Success

HTTP `201 Created`, berisi Project.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

### 5.5.2 List Organization Projects

`GET /api/v1/organizations/{organizationId}/projects`

Authorization: semua role aktif.

#### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.
-   `status`: `ACTIVE` atau `ARCHIVED`, default `ACTIVE`.

#### Behavior

-   Semua active member boleh melihat archived Project melalui filter.
-   Order: `created_at DESC, id DESC`.
-   List response tidak perlu memuat `nextIssueNumber` atau `version`.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

### 5.5.3 Get Project Detail

`GET /api/v1/organizations/{organizationId}/projects/{projectId}`

-   Semua role aktif dapat membaca Project aktif maupun archived.
-   Response memuat `version`.
-   `nextIssueNumber` tidak dipublikasikan.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

### 5.5.4 Update Project

`PATCH /api/v1/organizations/{organizationId}/projects/{projectId}`

Authorization: OWNER/ADMIN.

#### Request

``` json
{
  "name": "Backend Platform V2",
  "description": null,
  "version": 3
}
```

#### Validation and behavior

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

#### Success

HTTP `200 OK`, berisi Project terbaru.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `409 PROJECT_ARCHIVED`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

### 5.5.5 Archive Project

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/archive`

Authorization: OWNER/ADMIN.

#### Request

``` json
{
  "version": 3
}
```

#### Behavior

-   Set `archived_at`, increment version, update `updated_at`.
-   Activity `PROJECT_ARCHIVED` dalam transaction.
-   Tidak mengarsipkan Issues secara otomatis.
-   Comments dan Activities dipertahankan.
-   Idempotent: jika sudah archived, kembalikan `200` dengan
    representasi terbaru, tanpa version increment atau Activity.
-   Periksa state archived sebelum OCC agar retry dengan version lama
    tetap dapat berhasil sebagai no-op.

#### Success

HTTP `200 OK`, berisi Project.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

### 5.5.6 Restore Project

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/restore`

Authorization: OWNER/ADMIN.

#### Request

``` json
{
  "version": 4
}
```

#### Behavior

-   Set `archived_at = null`, increment version.
-   Activity `PROJECT_RESTORED` dalam transaction.
-   Tidak me-restore Issues yang sebelumnya di-archive secara
    individual.
-   Idempotent: jika sudah active, kembalikan `200` representasi terbaru
    tanpa version increment atau Activity.
-   Periksa state active sebelum OCC untuk idempotent retry.

#### Success

HTTP `200 OK`, berisi Project.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `403 FORBIDDEN`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

## 5.6 Issue API

Semua endpoint memerlukan Session dan ACTIVE Membership pada
Organization. Semua role aktif dapat mengelola Issues sesuai aturan di
bawah.

Status Issue: - `TODO` - `IN_PROGRESS` - `IN_REVIEW` - `DONE` -
`CANCELLED`

Allowed transitions: - `TODO` → `IN_PROGRESS`, `CANCELLED` -
`IN_PROGRESS` → `IN_REVIEW`, `CANCELLED` - `IN_REVIEW` → `IN_PROGRESS`,
`DONE`, `CANCELLED` - `DONE` → `IN_PROGRESS` - `CANCELLED` → `TODO`

Every Issue response representation includes `id`, `organizationId`,
`projectId`, `number`, `title`, `description`, `status`, `priority`,
`assigneeMembershipId`, `archivedAt`, `version`, `createdAt`, and
`updatedAt`, subject to the endpoint's response envelope. `priority` is
always returned, including when it was defaulted to `MEDIUM`. Label
associations are retrieved through the Issue-Label endpoints below.

### 5.6.1 Create Issue

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/issues`

Authorization: semua role aktif.

#### Request

``` json
{
  "title": "Implement authentication",
  "description": "Implement registration and login",
  "priority": "HIGH",
  "assigneeMembershipId": "membership-uuid"
}
```

`assigneeMembershipId` optional dan nullable.

#### Validation and behavior

-   `title`: wajib, 1--200 karakter setelah trim.
-   `description`: optional nullable max 10000; empty menjadi null.
-   `priority`: optional; enum `LOW`, `MEDIUM`, `HIGH`, `URGENT`; default `MEDIUM`.
-   `assigneeMembershipId`, jika diberikan, harus ACTIVE Membership dalam Organization
    yang sama.
-   Assignee boleh actor sendiri atau member lain.
-   Project harus active.
-   Server menentukan `organizationId`, `projectId`, `number`, status
    `TODO`, priority dari request atau `MEDIUM` jika tidak dikirim, `version=1`, `archivedAt=null`.
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

#### Success

HTTP `201 Created`, berisi Issue.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `409 PROJECT_ARCHIVED`
-   `422 ASSIGNEE_NOT_ACTIVE`
-   `500 INTERNAL_SERVER_ERROR`

### 5.6.2 List Project Issues

`GET /api/v1/organizations/{organizationId}/projects/{projectId}/issues`

#### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.
-   `status`: optional status enum.
-   `assigneeMembershipId`: optional UUID.
-   `includeArchived`: boolean, default `false`.

#### Behavior

-   Semua role aktif dapat membaca.
-   `includeArchived=false`: hanya Issue aktif.
-   `includeArchived=true`: Issue aktif dan archived.
-   Order: `number DESC, id DESC`.
-   `totalCount` dihitung setelah semua filter diterapkan.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

### 5.6.3 Get Issue Detail

`GET /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}`

-   Semua role aktif dapat membaca Issue aktif maupun archived.
-   Issue harus cocok dengan Project dan Organization pada URL.
-   Response memuat `version`.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

### 5.6.4 Update Issue

`PATCH /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}`

Authorization: semua role aktif.

#### Request

``` json
{
  "title": "Implement secure authentication",
  "description": null,
  "priority": "URGENT",
  "version": 2
}
```

#### Validation and behavior

-   PATCH partial semantics.
-   `title` optional 1--200 setelah trim.
-   `description` optional nullable max 10000; empty menjadi null.
-   `priority` optional; jika dikirim harus salah satu dari `LOW`, `MEDIUM`, `HIGH`, `URGENT`; `null` tidak diperbolehkan.
-   `version` wajib positive integer.
-   Minimal satu field mutable (`title`, `description`, atau `priority`) harus
    dikirim.
-   Status dan assignee tidak diubah melalui endpoint ini.
-   Issue dan Project harus active.
-   OCC; version naik hanya jika ada perubahan aktual.
-   No-op tidak menaikkan version dan tidak membuat Activity.
-   Actual update + Activity `ISSUE_UPDATED` atomic.
-   Activity menyimpan field yang berubah beserta nilai from/to.

#### Success

HTTP `200 OK`, berisi Issue terbaru.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `409 ISSUE_ARCHIVED`
-   `409 PROJECT_ARCHIVED`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

### 5.6.5 Assign Issue

`PATCH /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/assignee`

Authorization: semua role aktif.

#### Request

``` json
{
  "assigneeMembershipId": "membership-uuid",
  "version": 3
}
```

`assigneeMembershipId` boleh `null` untuk unassign.

#### Behavior

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

#### Success

HTTP `200 OK`, berisi Issue terbaru.

#### Errors

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

### 5.6.6 Update Issue Status

`PATCH /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/status`

Authorization: semua role aktif.

#### Request

``` json
{
  "status": "IN_PROGRESS",
  "version": 3
}
```

#### Behavior

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

#### Success

HTTP `200 OK`, berisi Issue terbaru.

#### Errors

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

### 5.6.7 Archive Issue

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/archive`

Authorization: semua role aktif.

#### Request

``` json
{
  "version": 3
}
```

#### Behavior

-   Project harus active untuk actual mutation.
-   Set `archived_at`, increment version, update timestamp.
-   Activity `ISSUE_ARCHIVED` atomic.
-   Comments dan Activities dipertahankan.
-   Idempotent: jika Issue sudah archived, return `200` latest
    representation tanpa version increment/Activity.
-   Check archived state sebelum OCC untuk retry idempotent.

#### Success

HTTP `200 OK`, berisi Issue.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `409 PROJECT_ARCHIVED`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

### 5.6.8 Restore Issue

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/restore`

Authorization: semua role aktif.

#### Request

``` json
{
  "version": 4
}
```

#### Behavior

-   Project harus active.
-   Set `archived_at=null`, increment version.
-   Status dan assignee tidak berubah.
-   Activity `ISSUE_RESTORED` atomic.
-   Idempotent: jika Issue sudah active, return `200` tanpa version
    increment/Activity.

#### Success

HTTP `200 OK`, berisi Issue.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `409 PROJECT_ARCHIVED`
-   `409 VERSION_CONFLICT`
-   `500 INTERNAL_SERVER_ERROR`

### 5.6.9 Issue search

Search V1 hanya dalam satu Project: - Title dan description:
case-insensitive substring. - Issue number: exact numeric match. -
Cursor pagination. - Tidak ada fuzzy, semantic, atau global search.

------------------------------------------------------------------------

## 5.7 Label API

Label adalah resource milik Organization dan dapat digunakan oleh Issues
dalam Organization yang sama. Semua endpoint memerlukan Session dan
ACTIVE Membership pada Organization. Semua active roles (`OWNER`,
`ADMIN`, `MEMBER`) dapat mengelola Label dan relasi Issue-Label.

Label V1 hanya memiliki `name` dan lifecycle archive/restore. Color,
description, custom metadata, dan hard delete tidak termasuk V1.

### Label name normalization

- Input `name` wajib berupa string dengan 1--50 karakter setelah normalisasi.
- Server melakukan Unicode NFKC normalization, trim whitespace di awal/akhir,
  dan collapse internal whitespace menjadi satu ASCII space.
- Case dipertahankan pada display `name`.
- Server membuat `normalizedName` comparison key dengan Unicode case-folding.
- Active Label dengan `normalizedName` sama tidak boleh ada dalam satu Organization.
- `normalizedName` adalah detail internal dan tidak dikembalikan dalam response.
- Normalisasi harus menggunakan satu fungsi aplikasi yang konsisten; jangan
  mengandalkan PostgreSQL `LOWER()` untuk Unicode case-folding.

### 5.7.1 Create Label

`POST /api/v1/organizations/{organizationId}/labels`

Authorization: semua role aktif.

#### Request

```json
{
  "name": "Backend"
}
```

#### Behavior

- `name` wajib dan dinormalisasi sesuai aturan di atas.
- Hanya active Label yang ikut aturan uniqueness.
- Archived Label tidak memesan nama; nama archived Label boleh digunakan
  oleh Label aktif yang baru.
- Create Label dan Activity `LABEL_CREATED` dilakukan dalam satu transaction.
- Create Label dilakukan dalam Organization pada URL.
- Tidak ada `version` pada Label V1; Label tidak menggunakan OCC.
- Jika nama normalized sudah digunakan Label aktif dalam Organization yang sama,
  request ditolak.

#### Success

HTTP `201 Created`.

```json
{
  "data": {
    "label": {
      "id": "label-uuid",
      "name": "Backend",
      "archivedAt": null,
      "createdAt": "2026-11-09T10:00:00.000Z",
      "updatedAt": "2026-11-09T10:00:00.000Z"
    }
  }
}
```

#### Errors

- `400 VALIDATION_ERROR`
- `401 INVALID_SESSION`
- `404 ORGANIZATION_NOT_FOUND`
- `409 LABEL_NAME_ALREADY_EXISTS`
- `500 INTERNAL_SERVER_ERROR`

### 5.7.2 List Organization Labels

`GET /api/v1/organizations/{organizationId}/labels`

#### Query

- `limit`: default 20, maximum 100.
- `cursor`: optional.
- `includeArchived`: boolean, default `false`.

#### Behavior

- Semua active roles dapat membaca.
- Default hanya mengembalikan Label aktif.
- `includeArchived=true` mengembalikan Label aktif dan archived.
- Ordering deterministic: `createdAt DESC, id DESC`.
- Setiap item menggunakan Label response shape tanpa `normalizedName`.

#### Success

HTTP `200 OK`.

```json
{
  "data": [
    {
      "id": "label-uuid",
      "name": "Backend",
      "archivedAt": null,
      "createdAt": "2026-11-09T10:00:00.000Z",
      "updatedAt": "2026-11-09T10:00:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": null,
    "hasMore": false,
    "totalCount": 1
  }
}
```

#### Errors

- `400 VALIDATION_ERROR`
- `401 INVALID_SESSION`
- `404 ORGANIZATION_NOT_FOUND`
- `500 INTERNAL_SERVER_ERROR`

### 5.7.3 Get Label Detail

`GET /api/v1/organizations/{organizationId}/labels/{labelId}`

#### Behavior

- Semua active roles dapat membaca Label aktif maupun archived.
- Label harus berada dalam Organization pada URL.
- Response mencakup `archivedAt` sehingga client dapat membedakan lifecycle state.

#### Success

HTTP `200 OK`, dengan `data.label` menggunakan Label response shape.

#### Errors

- `400 VALIDATION_ERROR`
- `401 INVALID_SESSION`
- `404 ORGANIZATION_NOT_FOUND`
- `404 LABEL_NOT_FOUND`
- `500 INTERNAL_SERVER_ERROR`

### 5.7.4 Rename Label

`PATCH /api/v1/organizations/{organizationId}/labels/{labelId}`

Authorization: semua role aktif.

#### Request

```json
{
  "name": "Platform Engineering"
}
```

#### Behavior

- Label harus aktif; archived Label tidak dapat di-rename sampai di-restore.
- `name` wajib dan dinormalisasi sesuai aturan Label name normalization.
- Rename mengikuti active normalized-name uniqueness dalam Organization.
- Jika nama baru memiliki normalized value yang sama dengan nama saat ini,
  operasi adalah no-op dan tidak mengubah `updatedAt`.
- Jika nama normalized sudah digunakan Label aktif lain dalam Organization,
  request ditolak dengan `409 LABEL_NAME_ALREADY_EXISTS`.
- Actual rename membuat Activity `LABEL_RENAMED` dalam transaction yang sama.
  Metadata mencatat `labelId`, display name lama, dan display name baru.
- Label tidak memiliki `version`; operasi tidak menggunakan OCC.
- Concurrent rename/create/restore yang bertabrakan diselesaikan oleh
  unique partial index. Conflict database dipetakan ke error contract,
  bukan menjadi `500`.

#### Success

HTTP `200 OK`, berisi `data.label` terbaru.

#### Errors

- `400 VALIDATION_ERROR`
- `401 INVALID_SESSION`
- `404 ORGANIZATION_NOT_FOUND`
- `404 LABEL_NOT_FOUND`
- `409 LABEL_ARCHIVED`
- `409 LABEL_NAME_ALREADY_EXISTS`
- `500 INTERNAL_SERVER_ERROR`

### 5.7.5 Archive Label

`POST /api/v1/organizations/{organizationId}/labels/{labelId}/archive`

Authorization: semua role aktif.

#### Behavior

- Label aktif diubah menjadi archived dengan mengisi `archivedAt`.
- Archive tidak menghapus Issue-Label associations.
- Existing associations tetap terlihat pada Issue sebagai historical context;
  Label harus ditandai archived dalam response.
- Actual archive membuat Activity `LABEL_ARCHIVED` dalam transaction yang sama.
- Archive yang diulang pada Label archived adalah idempotent dan mengembalikan
  representasi terbaru tanpa side effect tambahan.
- Label tidak memiliki `version`; operasi tidak menggunakan OCC.

#### Success

HTTP `200 OK`, berisi `data.label`.

#### Errors

- `400 VALIDATION_ERROR`
- `401 INVALID_SESSION`
- `404 ORGANIZATION_NOT_FOUND`
- `404 LABEL_NOT_FOUND`
- `500 INTERNAL_SERVER_ERROR`

### 5.7.6 Restore Label

`POST /api/v1/organizations/{organizationId}/labels/{labelId}/restore`

Authorization: semua role aktif.

#### Behavior

- Label archived dapat di-restore jika tidak ada Label aktif lain dalam
  Organization yang memiliki `normalizedName` sama.
- Jika terjadi collision, restore ditolak dengan `409 LABEL_NAME_ALREADY_EXISTS`.
- Pada collision, Label tetap archived dan Issue-Label associations yang
  sudah ada tidak berubah.
- Jika tidak ada collision, `archivedAt` menjadi `null`.
- Actual restore membuat Activity `LABEL_RESTORED` dalam transaction yang sama.
- Restore tidak mengubah Issue-Label associations.
- Restore terhadap Label yang sudah aktif adalah idempotent dan mengembalikan
  representasi terbaru tanpa side effect tambahan.
- Label tidak memiliki `version`; operasi tidak menggunakan OCC.
- Unique partial index menjadi final integrity defense terhadap race condition.

#### Success

HTTP `200 OK`, berisi `data.label`.

#### Errors

- `400 VALIDATION_ERROR`
- `401 INVALID_SESSION`
- `404 ORGANIZATION_NOT_FOUND`
- `404 LABEL_NOT_FOUND`
- `409 LABEL_NAME_ALREADY_EXISTS`
- `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

## 5.8 Issue-Label Association API

Relasi Issue-Label dikelola melalui nested Issue resource. Semua endpoint
memerlukan Session dan ACTIVE Membership pada Organization.

Issue dan parent Project harus aktif untuk setiap actual association
mutation. Semua active roles dapat melihat, menambah, dan menghapus
association.

### 5.8.1 List Labels on an Issue

`GET /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/labels`

#### Query

- `limit`: default 20, maximum 100.
- `cursor`: optional.

#### Behavior

- Mengembalikan Label yang terhubung dengan Issue, termasuk Label archived.
- Label archived ditandai melalui `archivedAt` non-null.
- Ordering deterministic: `attachedAt DESC, label.id DESC`.
- Setiap item mengembalikan `label` dengan Label response shape dan
  `attachedAt` yang berasal dari `issue_labels.created_at`.
- Read diperbolehkan untuk Issue archived maupun Issue dalam Project archived,
  selama actor memiliki active Membership dan resource berada dalam tenant scope.

#### Success

HTTP `200 OK` dengan collection envelope dan pagination standar.

#### Errors

- `400 VALIDATION_ERROR`
- `401 INVALID_SESSION`
- `404 ORGANIZATION_NOT_FOUND`
- `404 PROJECT_NOT_FOUND`
- `404 ISSUE_NOT_FOUND`
- `500 INTERNAL_SERVER_ERROR`

### 5.8.2 Attach Label to Issue

`PUT /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/labels/{labelId}`

Authorization: semua role aktif.

Tidak ada request body.

#### Behavior

- Issue dan Project harus aktif.
- Label harus berada dalam Organization yang sama.
- Label archived tidak dapat ditambahkan sebagai association baru.
- Jika association sudah ada, operasi adalah no-op yang idempotent.
  Ini juga berlaku jika Label tersebut kemudian di-archive; request tidak
  membuat association baru.
- Jika association belum ada dan Label archived, request ditolak.
- Duplicate association tidak menghasilkan duplicate row atau Activity.
- Association insert mematuhi composite tenant foreign keys dan primary key
  `(issueId, labelId)`.
- Issue version tidak dinaikkan karena perubahan join relation bukan update
  field Issue pada V1.
- Actual attach membuat Activity `ISSUE_LABEL_ATTACHED`. Activity dan
  association mutation harus commit dalam satu transaction.
- No-op attach tidak membuat Activity.
- Tidak ada Notification untuk attach/detach Label pada V1.

#### Success

HTTP `204 No Content`, baik ketika association baru dibuat maupun ketika
association sudah ada (idempotent retry).

#### Errors

- `401 INVALID_SESSION`
- `404 ORGANIZATION_NOT_FOUND`
- `404 PROJECT_NOT_FOUND`
- `404 ISSUE_NOT_FOUND`
- `404 LABEL_NOT_FOUND`
- `409 ISSUE_ARCHIVED`
- `409 PROJECT_ARCHIVED`
- `409 LABEL_ARCHIVED`
- `500 INTERNAL_SERVER_ERROR`

### 5.8.3 Detach Label from Issue

`DELETE /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/labels/{labelId}`

Authorization: semua role aktif.

Tidak ada request body.

#### Behavior

- Issue dan Project harus aktif.
- Label harus berada dalam Organization yang sama.
- Association yang ada dihapus.
- Label boleh archived; archived Label tetap dapat dilepas dari Issue.
- Association yang sudah tidak ada menghasilkan no-op `204 No Content`.
- Issue version tidak dinaikkan.
- Actual detach membuat Activity `ISSUE_LABEL_DETACHED`. Activity dan
  association mutation harus commit dalam satu transaction.
- No-op detach tidak membuat Activity.
- Tidak ada Notification untuk attach/detach Label pada V1.

#### Success

HTTP `204 No Content`.

#### Errors

- `401 INVALID_SESSION`
- `404 ORGANIZATION_NOT_FOUND`
- `404 PROJECT_NOT_FOUND`
- `404 ISSUE_NOT_FOUND`
- `404 LABEL_NOT_FOUND`
- `409 ISSUE_ARCHIVED`
- `409 PROJECT_ARCHIVED`
- `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

## 5.9 Comment API

Semua endpoint memerlukan Session dan ACTIVE Membership. Semua active
roles dapat membaca dan membuat Comment.

Comment body: - Trim leading/trailing whitespace. - 1--10000 karakter
setelah trim. - Internal line breaks dipertahankan. - HTML tidak boleh
dieksekusi sebagai active markup oleh client.

### 5.9.1 List Issue Comments

`GET /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments`

#### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.

#### Behavior

-   Semua active roles dapat membaca.
-   Read tetap diizinkan ketika Issue atau Project archived.
-   Memuat Comment aktif dan deleted.
-   Deleted Comment ditampilkan sebagai metadata-only tombstone.
-   Original body telah dihapus dari persistence dan tidak pernah
    dikembalikan.
-   Response mempertahankan Comment ID, author attribution, creation
    timestamp, dan deletion timestamp. Client menampilkan placeholder
    sesuai UI convention.
-   `totalCount` mencakup Comment deleted.
-   Order: `created_at ASC, id ASC`.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

### 5.9.2 Create Comment

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments`

Authorization: semua active roles.

#### Request

``` json
{
  "body": "The authentication flow is ready for review."
}
```

#### Behavior

-   Issue dan Project harus active.
-   Body wajib, trim, 1--10000 karakter.
-   Actor Membership berasal dari Session.
-   Dalam satu transaction:
    1.  Create Comment.
    2.  Create Activity `COMMENT_CREATED`.
    3.  Jika Issue memiliki assignee dan assignee bukan actor, create
        Notification untuk assignee.
-   Activity/Notification tidak menyimpan Comment body.

#### Success

HTTP `201 Created`, berisi Comment.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `404 PROJECT_NOT_FOUND`
-   `404 ISSUE_NOT_FOUND`
-   `409 ISSUE_ARCHIVED`
-   `409 PROJECT_ARCHIVED`
-   `500 INTERNAL_SERVER_ERROR`

### 5.9.3 Update Comment

`PATCH /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments/{commentId}`

#### Authorization

-   OWNER/ADMIN dapat mengelola Comment siapa pun.
-   MEMBER hanya dapat mengelola Comment miliknya sendiri.

#### Request

``` json
{
  "body": "The authentication flow is ready for QA.",
  "version": 1
}
```

#### Behavior

-   Comment harus belum deleted.
-   Issue dan Project harus active.
-   Body wajib, 1--10000 karakter setelah trim.
-   Version wajib.
-   OCC; update body, version, updated_at.
-   Activity `COMMENT_UPDATED` atomic.
-   Activity tidak menyimpan Comment body.
-   Initial Comment version adalah 1.

#### Success

HTTP `200 OK`, berisi Comment terbaru.

#### Errors

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

### 5.9.4 Delete Comment

`DELETE /api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments/{commentId}`

#### Authorization

-   OWNER/ADMIN dapat delete Comment siapa pun.
-   MEMBER hanya dapat delete Comment miliknya sendiri.

#### Request

``` json
{
  "version": 1
}
```

#### Behavior

-   Delete adalah tombstone operation, bukan physical deletion.
-   Dalam transaction yang sama, set `deleted_at` dan set `body = null`;
    body asli dihapus segera.
-   Issue dan Project harus active untuk actual delete.
-   Activity `COMMENT_DELETED` dibuat secara atomic dan tidak boleh
    menyimpan Comment body.
-   Tombstone mempertahankan Comment ID, author reference, creation
    timestamp, dan deletion timestamp.
-   Tombstone dipertahankan tanpa automatic purge selama V1.
-   Repeated delete bersifat idempotent dan tidak membuat Activity atau
    mengubah timestamp/version lagi.
-   Authorization tetap diperiksa pada retry.
-   Initial Comment version adalah 1.

#### Success

HTTP `200 OK`, berisi Comment placeholder, author, timestamps, dan
deletion state.

#### Errors

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

Catatan: Update terhadap Comment yang sudah deleted ditolak dengan
`409 COMMENT_DELETED`. Repeated DELETE tetap idempotent.

------------------------------------------------------------------------

## 5.10 Activity API

Activity adalah append-only organization event log. Tidak ada read
event.

### 5.10.1 List Organization Activities

`GET /api/v1/organizations/{organizationId}/activities`

Authorization: semua ACTIVE roles.

#### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.
-   `eventType`: optional.
-   `actorId`: optional.
-   `issueId`: optional.

#### Behavior

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

#### Response

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

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 ORGANIZATION_NOT_FOUND`
-   `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

## 5.11 Notification API

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

### 5.11.1 Notification content snapshot

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

### 5.11.2 List My Notifications

`GET /api/v1/notifications`

Authentication: Bearer Session wajib.

#### Query

-   `limit`: default 20, maximum 100.
-   `cursor`: optional.
-   `status`: `ALL`, `UNREAD`, atau `READ`; default `ALL`.

#### Behavior

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

#### Success

HTTP `200 OK`, collection dengan `data` dan `pagination`.

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `500 INTERNAL_SERVER_ERROR`

### 5.11.3 Mark Notification as Read

`PATCH /api/v1/notifications/{notificationId}/read`

Authentication: Bearer Session wajib. Tidak ada request body.

#### Behavior

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

#### Success

HTTP `200 OK`

``` json
{
  "data": {
    "id": "notification-uuid",
    "readAt": "2026-11-02T14:00:00.000Z"
  }
}
```

#### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_SESSION`
-   `404 NOTIFICATION_NOT_FOUND` jika tidak ada atau bukan milik User
-   `500 INTERNAL_SERVER_ERROR`

### 5.11.4 Mark All Notifications as Read

`PATCH /api/v1/notifications/read-all`

Authentication: Bearer Session wajib. Tidak ada request body.

#### Behavior

-   Menandai seluruh Notification milik User yang `read_at IS NULL`.
-   Notification yang sudah dibaca tidak diubah.
-   Tidak memengaruhi Notification User lain.
-   Tidak membuat Activity.
-   Idempotent.
-   Implementasi dapat menggunakan satu conditional UPDATE berdasarkan
    `recipient_user_id` dari Session.

#### Success

HTTP `204 No Content`.

#### Errors

-   `401 INVALID_SESSION`
-   `500 INTERNAL_SERVER_ERROR`

------------------------------------------------------------------------

## 13. Cross-endpoint contract invariants

### 13.1 Tenant isolation

- Active Membership adalah prasyarat akses Organization resource, kecuali endpoint personal atau invitation acceptance yang secara eksplisit dikecualikan.
- Organization ID dari client bukan bukti hak akses dan tidak boleh menentukan actor/tenant context tanpa validasi server-side.
- Tenant-scoped query dan mutation harus memverifikasi Organization ID dan resource ID secara konsisten.
- Issue harus berada dalam Project dan Organization yang sama.
- Assignee harus ACTIVE Membership dalam Organization yang sama.
- Resource lintas tenant atau tidak terlihat mengikuti `404` masking behavior dalam API Conventions.

### 13.2 Optimistic concurrency

OCC berlaku untuk Organization, Membership, Project, Issue, dan Comment sesuai operasi yang mensyaratkannya. Version awal adalah `1`. Actual mutation menaikkan version satu; no-op tidak menaikkan version. Version mismatch menghasilkan `409 VERSION_CONFLICT`.

### 13.3 Transactional Activity and Notification

Jika suatu endpoint mensyaratkan Activity atau Notification, perubahan bisnis dan record terkait harus commit atau rollback bersama. Activity metadata dan Notification snapshot tidak boleh menyimpan password, token, secret, atau Comment body.

Label V1 Activity events: `LABEL_CREATED`, `LABEL_RENAMED`, `LABEL_ARCHIVED`,
`LABEL_RESTORED`, `ISSUE_LABEL_ATTACHED`, dan `ISSUE_LABEL_DETACHED`.
Label catalogue events memiliki `issueId = null`; Issue-Label association
events menggunakan `issueId` terkait. Metadata adalah versioned object dan
minimal mengidentifikasi `labelId`; rename juga mencatat display name lama
dan baru. No-op requests tidak emiten Activity. Label operations tidak
membuat Notification pada V1.

### 13.4 Archive and deletion semantics

- Organization tidak di-archive atau dihapus permanen pada V1.
- Project dan Issue menggunakan archive/restore, bukan hard delete.
- Project archive tidak otomatis mengarsipkan Issues; Project restore tidak otomatis me-restore Issues yang sebelumnya di-archive secara individual.
- Archived Project/Issue tetap dapat dibaca, tetapi mutation mengikuti resource-state rules.
- Comment deletion menghapus body dan mempertahankan metadata-only tombstone tanpa automatic purge selama V1.
- Label deletion berarti archive, bukan physical deletion.

### 13.5 Invitation delivery

- Invitation delivery menggunakan transactional Outbox dan at-least-once processing.
- Maksimum delapan total delivery attempts termasuk initial attempt.
- Retry transient network/timeouts, HTTP 408, HTTP 429, dan HTTP 5xx dengan bounded exponential backoff, maksimum 60 menit, ±20% jitter.
- Non-retryable provider 4xx langsung menjadi terminal failure.
- Resend manual merotasi token, tidak memperpanjang expiry, dan dibatasi cooldown 60 detik serta lima successful resends per Invitation per rolling 24 jam.

## 14. Contract completion decisions

Tiga gap pada Phase 0.2 telah ditutup dalam dokumen ini:

| Capability | V1 contract decision |
|---|---|
| Issue priority | Field pada Create Issue dan Update Issue; default `MEDIUM`; tidak ada endpoint khusus; mengikuti Issue OCC dan `ISSUE_UPDATED` Activity |
| Organization Labels | Nested Organization resource: create, list, read, rename, archive, restore; semua active roles; no hard delete; no Label OCC karena tabel Label tidak memiliki version |
| Issue-Label association | Nested Issue relationship: list, idempotent attach via `PUT`, idempotent detach via `DELETE`; archived Label tidak dapat ditambahkan baru tetapi existing association tetap terlihat dan dapat dilepas |

Keputusan tersebut menerjemahkan Requirements V1.2, Domain Map V1.2, Permissions V1.1, dan Database Specification V1.3 ke HTTP contract. Detail normalization, tenant integrity, uniqueness, archive/restore collision, dan association retention tetap mengikuti dokumen pemilik domain/persistence.

## 15. Explicit V1 API exclusions

Unless separately approved, V1 does not expose email verification, JWT/cookie authentication, logout-all-sessions, Organization archive/deletion, Project/Issue hard delete, custom Issue workflows, fuzzy/semantic/global Issue search, Activity detail or client-side Activity mutation, push/realtime notifications, watchers/subscribers, non-invitation email notifications, full Comment edit history, automatic cascading Project/Issue archive, or public endpoints for internal Outbox processing.

## 16. Change management

Any public contract change MUST update this document and relevant API tests. Changes to cross-cutting behavior MUST update `api-conventions.md`. Changes to product/domain/authorization/persistence policy MUST first be resolved in the owning specification. Breaking changes require an explicit API versioning decision; do not silently repurpose an existing field, status code, or endpoint.

---

**Source note:** Endpoint definitions are consolidated from the former Phase 0.2 API Specification V1.0 and reconciled to Requirements V1.2, Domain Map V1.2, Permissions V1.1, Database Specification V1.3, and Security Baseline V1.0. The three previously open contract gaps (Issue priority, Organization Labels, and Issue-Label associations) are resolved in Version 1.1. This document remains a design contract, not implementation evidence.
