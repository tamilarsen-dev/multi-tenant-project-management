# API Conventions

| Field | Value |
|---|---|
| Version | 1.1 |
| Status | Approved for V1 planning; pending implementation verification |
| Product | Multi-Tenant Project Management SaaS |
| API version | V1 |
| Base path | `/api/v1` |
| Last updated | 2026-11-09 |
| Related contract | [`0001-api-contract.md`](./0001-api-contract.md) |

## 1. Purpose and authority

Dokumen ini menetapkan aturan HTTP lintas endpoint agar server dan client menggunakan perilaku yang konsisten. Dokumen ini tidak mendefinisikan endpoint atau menggantikan API Contract.

`0001-api-contract.md` adalah otoritas untuk endpoint, method, path, request/response DTO, authorization spesifik, dan perilaku per endpoint. Security Baseline tetap menjadi otoritas untuk keputusan security yang lebih luas.

## 2. Base path and transport

- Semua endpoint V1 berada di bawah `/api/v1`.
- Request dan response menggunakan JSON kecuali endpoint secara eksplisit menyatakan tidak memiliki body atau response body.
- Client mengirim `Content-Type: application/json` untuk JSON request body.
- Successful responses menggunakan status code yang ditetapkan oleh endpoint contract.
- `204 No Content` tidak memiliki response body.
- `202 Accepted` berarti pekerjaan diterima untuk diproses asynchronous, bukan berarti pekerjaan eksternal telah selesai.
- Tidak ada multipart/file upload pada V1.

## 3. Identifiers and timestamps

- Resource IDs menggunakan UUID.
- Timestamp API menggunakan ISO 8601 UTC, umumnya dengan millisecond precision dan akhiran `Z`.
- Timestamp disimpan/dioperasikan sebagai UTC; konversi ke timezone pengguna dilakukan pada presentation/client layer.
- Jangan mengirim database-internal identifiers atau fields yang tidak menjadi bagian dari response DTO.

## 4. Authentication and actor identity

Authenticated endpoints menggunakan opaque Bearer Session token:

```http
Authorization: Bearer <opaque-session-token>
```

- Token opaque dibuat dari 32 random bytes.
- Session berlaku tetap selama tujuh hari sejak dibuat; bukan sliding expiration.
- Refresh merotasi token secara atomik: Session lama dicabut dan Session baru dibuat.
- Logout mencabut Session yang dipakai request; tidak mencabut Session lain milik User.
- Server menyimpan SHA-256 hash token, bukan raw token.
- Raw token hanya dikembalikan pada Register, Login, dan Refresh yang berhasil; invitation token dikirim melalui email dan tidak pernah dikembalikan oleh API.
- User identity dan actor Membership context selalu berasal dari Session serta data server-side. Jangan mempercayai `userId`, role, atau membership actor yang dikirim client.
- JWT dan cookie-based authentication bukan mekanisme V1.

Browser token storage strategy belum diputuskan pada Security Baseline dan harus ditetapkan sebelum browser authentication dirilis. Jangan menganggap keputusan Bearer otomatis menyelesaikan penyimpanan credential di browser.

## 5. Success response conventions

- Object responses menggunakan envelope `data` sesuai endpoint contract.
- Collection responses menggunakan `data` array dan `pagination` object.
- Endpoint dapat mengembalikan `204 No Content` jika tidak ada representasi yang perlu dikembalikan.
- Jangan menambahkan field response yang tidak didefinisikan kontrak tanpa memperbarui API Contract.
- Response DTO harus explicit. Jangan mengembalikan password hash, session token hash, invitation token/hash, internal persistence fields, atau secret.

Collection pagination shape:

```json
{
  "data": [],
  "pagination": {
    "nextCursor": null,
    "hasMore": false,
    "totalCount": 0
  }
}
```

## 6. Error response conventions

Semua error menggunakan satu envelope:

```json
{
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human-readable explanation."
  }
}
```

`message` harus aman untuk client dan tidak membocorkan stack trace, SQL/provider detail, credentials, token, atau keberadaan resource tenant yang disembunyikan.

### 6.1 HTTP status semantics

| Status | Meaning |
|---:|---|
| `400` | Request syntax, parameter, path, query, atau structural validation tidak valid |
| `401` | Authentication hilang, invalid, expired, atau revoked |
| `403` | Actor terautentikasi dan resource berada dalam visibility scope, tetapi action tidak diizinkan; juga digunakan untuk explicit invitation email mismatch |
| `404` | Resource tidak ada atau sengaja disamarkan karena tenant/visibility boundary |
| `409` | State conflict, duplicate/conflict constraint, invalid current lifecycle state, atau optimistic concurrency conflict |
| `413` | Request body melebihi batas ukuran |
| `422` | Request valid secara struktur tetapi melanggar aturan domain, misalnya invalid Issue status transition atau assignee tidak aktif |
| `429` | Rate limit atau cooldown/quota tercapai |
| `500` | Kegagalan internal yang tidak diekspos secara detail |

Endpoint contract menentukan error code spesifik. Jangan mengganti error code hanya karena dua kondisi memakai HTTP status yang sama.

### 6.2 Tenant visibility semantics

- Organization tidak ditemukan dan Organization tanpa ACTIVE Membership bagi actor harus menghasilkan perilaku `404` yang sama.
- Resource lintas tenant atau tidak terlihat karena visibility menggunakan `404` jika ditetapkan oleh endpoint contract.
- ACTIVE Membership yang tidak memiliki permission untuk resource/action yang terlihat menghasilkan `403`.
- Personal Notification hanya dapat diakses oleh recipient User; kegagalan ownership disamarkan sebagai `404`.

## 7. Request validation and resource limits

- Gunakan Zod untuk memvalidasi request structure, types, enums, dan field constraints.
- Validasi `params`, `query`, dan `body` secara konsisten sebelum use case dijalankan.
- JSON request body maksimum 1 MB; body terlalu besar ditolak dengan `413 Content Too Large` sebelum schema validation.
- Batas field mengikuti Requirements dan endpoint contract. Zod dan database constraints harus konsisten.
- Query/filter/search lengths, jumlah filter, array values, cursor length/format, dan sorting fields harus dibatasi.
- Sorting hanya menerima allowlist field yang dipetakan server-side; jangan menerima nama kolom database bebas dari client.
- Invalid syntax/parameter/structural input menggunakan `400`; domain-rule violations menggunakan `422` jika kontrak endpoint menyatakan demikian.
- Request validation bukan pengganti authorization, tenant scoping, atau domain invariant checks.

## 8. Pagination and ordering

Collection endpoints menggunakan cursor pagination.

| Parameter | Rule |
|---|---|
| `limit` | Default `20`, minimum `1`, maksimum `100` |
| `cursor` | Opaque cursor yang dikembalikan server; optional pada halaman pertama |

- Cursor harus divalidasi dan tidak boleh mengungkap struktur internal database.
- Ordering setiap collection endpoint harus deterministic dan memiliki ID tie-breaker.
- Urutan spesifik ditentukan pada API Contract per endpoint.
- `totalCount` dihitung setelah seluruh filter dan tenant/authorization scope diterapkan pada saat request.
- Invalid limit/cursor/filter/sort ditolak; jangan silently clamp invalid values kecuali endpoint secara eksplisit menyatakan demikian.

## 9. PATCH and optimistic concurrency control

- `PATCH` adalah partial update: field yang tidak dikirim tidak berubah.
- `null` berarti menghapus nilai hanya jika field tersebut secara eksplisit nullable.
- Untuk mutation yang menggunakan OCC, request harus mengirim expected `version` integer yang dibaca client.
- Server melakukan conditional mutation terhadap resource ID dan expected version.
- Actual successful mutation menaikkan version tepat satu.
- No-op tidak menaikkan version dan tidak membuat Activity/Notification kecuali endpoint menyatakan lain.
- Version mismatch menghasilkan `409 VERSION_CONFLICT`.
- Server tidak melakukan blind automatic retry. Client harus mengambil representasi terbaru dan merekonsiliasi perubahan.
- Version awal untuk resource yang menggunakan OCC adalah `1`, kecuali spesifikasi resource menetapkan lain.

## 10. Tenant scoping and authorization boundary

Setiap Organization-scoped request mengikuti urutan konseptual:

1. Authenticate actor dan validasi Session.
2. Resolve Organization context dari path/resource sesuai kontrak.
3. Resolve ACTIVE Membership actor pada Organization tersebut.
4. Resolve target resource dalam tenant scope.
5. Evaluate role/action permission.
6. Evaluate resource lifecycle dan domain invariants.
7. Execute use case.

- Organization ID dari client bukan bukti akses.
- Resource ID yang sulit ditebak bukan authorization control.
- Authorization dilakukan server-side pada setiap request.
- Cross-tenant references ditolak; database composite constraints memberikan lapisan integrity tambahan.
- Exception seperti invitation acceptance dan personal Notification harus mengikuti aturan eksplisit di API Contract.

## 11. Idempotency and mutation semantics

- Endpoint yang menyatakan idempotent harus memberikan hasil konsisten pada retry tanpa mengulang side effect.
- Idempotency tidak boleh diasumsikan untuk semua POST request.
- State transition yang sudah tercapai dapat menjadi no-op jika kontrak endpoint menyatakannya.
- Jangan mengirim `Idempotency-Key` sebagai jaminan idempotency kecuali endpoint contract secara eksplisit mendukung dan mendefinisikan persistence/retention semantics untuk key tersebut.
- External email delivery bersifat at-least-once melalui Outbox; jangan menjanjikan exactly-once delivery.

## 12. Security-related HTTP behavior

Security Baseline V1.0 menetapkan:

- Explicit CORS origin allowlist per environment; no wildcard origin.
- Credentialed CORS tidak diaktifkan pada V1 karena Bearer authentication, bukan cookie.
- Izinkan hanya method dan headers yang dibutuhkan, termasuk `Authorization`, `Content-Type`, dan `Idempotency-Key` bila digunakan.
- Helmet digunakan sebagai security-header baseline.
- HSTS hanya aktif pada HTTPS deployment.
- JSON body limit 1 MB.
- Rate limiting berlaku pada global, IP, account, dan endpoint scopes menggunakan token bucket dengan in-memory store pada single-instance V1.
- `429` response menyertakan `Retry-After` bila relevan.
- Exact rate-limit thresholds dikonfigurasi dan dituning berdasarkan workload; jangan mengarang angka di dokumen ini.

CORS bukan authentication atau authorization. Non-browser clients tidak dibatasi oleh browser CORS enforcement.

## 13. Logging and sensitive data

- Jangan log password, raw Bearer/session token, invitation token, secret, API key, atau full sensitive request body.
- Pino redaction dikonfigurasi terpusat untuk password, Authorization, token, `DATABASE_URL`, API keys, dan sensitive body fields.
- Error response tidak mengandung stack trace atau internal exception details.
- Security events boleh dicatat, tetapi tidak boleh memuat credential mentah.
- Request ID/log correlation implementation harus mengikuti engineering logging conventions; request ID bukan bagian dari public response contract kecuali ditambahkan melalui perubahan kontrak eksplisit.

## 14. Change control

Perubahan terhadap convention lintas endpoint harus memperbarui dokumen ini, API Contract, dan automated tests yang relevan. Perubahan security policy harus disetujui dan dicatat pada Security Baseline. Jangan memperkenalkan alternate response envelope, pagination format, authentication mechanism, atau error semantics per module.

---

**Source basis:** Phase 0.2 API Specification V1.0 (superseded as maintained contract by `0001-api-contract.md` V1.1); Security Baseline Decision Record V1.0; Requirements V1.2; Domain Map V1.2; Permissions V1.1; Database Specification V1.3.
