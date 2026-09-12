# PRD Jurnalis Org — v4.0 Custom Stack Edition

**Menggantikan:** PRD v3.0 + Addendum v3.1 (keduanya berbasis Supabase)
**Alasan ganti:** Pivot arsitektur total — backend terpisah, PostgreSQL polos, semua service (auth, storage, realtime) dibangun sendiri.
**Purpose:** Instruksi mesin. Agent baca, putuskan, eksekusi tanpa ambiguitas.
**Author:** Hamin (bareng Claude)

---

## SECTION 0: AGENT MANIFEST

### 0.1 Context Block (Baca Ini Dulu)

```
WHAT YOU ARE BUILDING:
  Platform manajemen organisasi jurnalistik SMA.
  Name: Jurnalis Org
  Domain target: jurnalis.org (frontend), api.jurnalis.org (backend, diakses lewat proxy — lihat 0.5)

ARSITEKTUR: Monorepo, frontend dan backend terpisah total, komunikasi lewat REST API + WebSocket.

  jurnalis-org/
  ├── apps/
  │   ├── web/              ← Next.js 14 App Router (frontend)
  │   └── api/               ← Fastify (backend)
  ├── packages/
  │   └── shared/            ← Zod schema + TypeScript types dipakai bareng web & api
  ├── package.json           ← npm workspaces root
  └── package-lock.json

TECH STACK (FIXED, JANGAN GANTI):
  Frontend Framework  : Next.js 14 (App Router, NOT Pages Router)
  Backend Framework   : Fastify 4 + TypeScript strict mode
  Database            : PostgreSQL polos (hosting: Neon, free tier permanen)
  ORM                 : Prisma
  Auth                : Custom JWT (access + refresh token), argon2 buat hash password
  Realtime            : @fastify/websocket (dibangun di atas library `ws`)
  File Storage        : Cloudflare R2 (S3-compatible, free tier 10GB)
  Notifikasi eksternal : Meta WhatsApp Cloud API + Resend (email) — SAMA kayak sebelumnya
  Styling             : Tailwind CSS v3 + shadcn/ui
  State (frontend)    : TanStack Query v5 (server) + Zustand v4 (client)
  Forms               : react-hook-form + zod
  Editor              : TipTap v2
  Charts              : Recharts
  Drag-drop           : @dnd-kit
  Validasi            : Zod, schema-nya di packages/shared, dipakai backend (fastify-type-provider-zod) DAN frontend (react-hook-form)
  Hosting backend      : Render (free web service)
  Hosting frontend      : Vercel
  Hosting database      : Neon (PostgreSQL serverless, free tier)
  Hosting file storage  : Cloudflare R2

USERS:
  - anggota  : Anggota biasa, bisa lihat & submit tugas sendiri
  - pengurus : Koordinator divisi, bisa assign tugas & approve
  - bendahara: Kelola keuangan, upload bukti
  - redaktur : Kelola editorial pipeline
  - ketua    : Full read + approve finance + overview kinerja
  - alumni   : Read-only ke konten publik + update profil sendiri
  - admin    : Full access, manage pengguna

USER COUNT: 50-100 aktif, ~500 alumni
DEVICE SPLIT: 70% mobile, 30% desktop
BUDGET: Gratis semua (free tier), upgrade hanya jika terpaksa
```

### 0.2 Kenapa Pivot Ini Signifikan

Di v3.0, Supabase nanganin 4 hal sekaligus: auth, database access dari client, file storage, dan realtime. Semua itu sekarang jadi kode yang harus ditulis sendiri di `apps/api`. Konsekuensi paling penting:

```
BERUBAH TOTAL:
  - Auth: dari Supabase Auth → custom JWT + argon2, tabel `users` gabung dari profiles+auth.users
  - Data access dari frontend: dari "supabase.from('table').select()" langsung di komponen
    → HARUS lewat fetch ke REST API, TIDAK ADA query database langsung dari Next.js
  - Authorization: dari RLS Policies di database → middleware/guard di level Fastify
  - Realtime: dari Supabase Realtime channel → koneksi WebSocket sendiri
  - File upload: dari Supabase Storage → presigned URL dari Cloudflare R2

TETAP SAMA (gak kena pivot):
  - Semua library frontend: TanStack Query, Zustand, react-hook-form+zod, TipTap, Recharts, dnd-kit
  - Notification wrapper WhatsApp (Pattern dari v3.0 Pattern 11) dan Resend (Pattern 12) — cuma
    perlu ganti cara ambil data user dari Prisma, bukan Supabase client
  - Skema data secara konsep (nama tabel, kolom, enum) — cuma pindah dari SQL DDL murni ke Prisma schema
  - Watermark canvas client-side dari Addendum v3.1 — gak butuh Supabase sama sekali
```

### 0.3 Golden Rules (NEVER VIOLATE)

```
RULE-001: JANGAN pakai Pages Router di frontend. Selalu App Router.
RULE-002: JANGAN pakai `any` di TypeScript, baik di apps/web maupun apps/api.
RULE-003: JANGAN ada query Prisma di luar apps/api. Frontend TIDAK PERNAH import Prisma Client.
RULE-004: JANGAN simpan JWT secret atau DATABASE_URL di kode frontend.
RULE-005: JANGAN buat file di luar struktur folder yang sudah ditentukan.
RULE-006: SETIAP endpoint yang terima body harus validasi pakai Zod schema dari packages/shared.
RULE-007: SETIAP query Prisma harus di-wrap try-catch, error di-log dengan context jelas.
RULE-008: SETIAP upload file harus compress dulu di client (browser-image-compression) SEBELUM ke server.
RULE-009: SETIAP route yang butuh auth harus verifikasi JWT lewat preHandler hook, tidak boleh inline manual.
RULE-010: JANGAN console.log rahasia (token, password, secret) di production code.
RULE-011: Zod schema WAJIB di packages/shared/src/validations/{feature}.ts, dipakai backend DAN frontend, jangan duplikat.
RULE-012: Password TIDAK PERNAH disimpan plain text. Selalu argon2.hash() sebelum masuk database.
RULE-013: Refresh token disimpan di database dalam bentuk HASH (bukan plain), dan di-rotate tiap dipakai.
```

### 0.4 Decision Framework

```
Q: Mana yang lebih simpel?                → Pilih yang lebih simpel
Q: Data ini butuh diakses publik tanpa login? → Buat endpoint publik terpisah, jangan reuse endpoint auth-protected
Q: Kapan pakai Server Component fetch langsung?
   → Next.js Server Component boleh fetch ke backend API pakai fetch() biasa (server-to-server, boleh pakai API key internal kalau perlu), TAPI TETAP lewat REST API, bukan Prisma.
Q: Kapan pakai TanStack Query di Client Component? → Semua data fetching yang butuh refetch/mutate interaktif.
Q: Kapan pakai Zustand?                    → UI state cross-component (sidebar open, filter aktif).
Q: Error handling di mana?                 → Try-catch + Zod validasi di Fastify, toast di Next.js.
Q: Realtime butuh dimana?                  → Notification bell, kanban board (task & editorial), attendance live count.
```

### 0.5 Kenapa Pakai Next.js Rewrites Sebagai Proxy (Penting!)

Frontend dan backend itu dua origin berbeda (`jurnalis.org` vs `api.jurnalis.org`). Kalau langsung fetch cross-origin, cookie httpOnly buat JWT jadi ribet (butuh `SameSite=None; Secure`, rawan masalah di beberapa browser/privacy mode). Solusinya: **Next.js rewrites** bikin browser ngerasa semua request tetap ke `jurnalis.org/api/*`, padahal di belakang layar di-proxy ke backend Fastify. Cookie jadi first-party, jauh lebih simpel dan aman.

```javascript
// apps/web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL}/:path*`, // contoh: https://jurnalis-api.onrender.com
      },
      {
        source: '/ws',
        destination: `${process.env.BACKEND_URL}/ws`,
      },
    ]
  },
}

module.exports = nextConfig
```

Dengan ini, semua fetch di frontend cukup `fetch('/api/tasks')`, TIDAK PERNAH hardcode URL backend langsung di komponen.

---

## SECTION 00: IMPLEMENTATION SEQUENCE

### Phase 0: Monorepo Bootstrap

```bash
mkdir jurnalis-org && cd jurnalis-org
npm init -y
mkdir -p apps/web apps/api packages/shared

# Root package.json: tambahkan "workspaces": ["apps/*", "packages/*"]

# --- packages/shared ---
cd packages/shared
npm init -y
npm install zod
npm install -D typescript
# tsconfig.json standar, export semua schema dari src/index.ts

# --- apps/api ---
cd ../../apps/api
npm init -y
npm install fastify @fastify/cors @fastify/cookie @fastify/jwt @fastify/websocket @fastify/multipart
npm install fastify-type-provider-zod zod
npm install @prisma/client prisma
npm install argon2
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install resend
npm install -D typescript tsx @types/node
npx prisma init

# --- apps/web ---
cd ../web
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install zustand
npm install react-hook-form @hookform/resolvers zod
npm install browser-image-compression
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install recharts
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image @tiptap/extension-placeholder
npm install date-fns
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card dialog dropdown-menu form input textarea select tabs toast badge avatar calendar table skeleton accordion command popover sheet switch slider separator scroll-area progress

# VERIFICATION:
# - npm run dev di apps/web jalan di localhost:3000 tanpa error
# - npm run dev di apps/api jalan di localhost:4000 tanpa error (belum ada route, tapi server nyala)
```

### Phase 1: Database & Prisma

```
Urutan:
1. Buat database gratis di neon.tech, catat DATABASE_URL
2. Isi apps/api/prisma/schema.prisma (Section 02 di bawah)
3. npx prisma migrate dev --name init  → generate migration + apply ke Neon
4. npx prisma generate               → generate Prisma Client

VERIFICATION:
- npx prisma studio → buka browser, semua tabel keliatan, kosong tapi ada
- npx prisma validate → tidak ada error skema
```

### Phase 2: Auth System (BUAT SEBELUM FITUR APAPUN)

```
Urutan:
1. apps/api/src/lib/prisma.ts           ← Prisma Client singleton
2. apps/api/src/lib/jwt.ts               ← sign/verify access & refresh token
3. apps/api/src/lib/password.ts          ← argon2 hash/verify wrapper
4. apps/api/src/plugins/auth.ts          ← Fastify preHandler: authenticate, requireRole
5. apps/api/src/routes/auth.ts           ← register, login, refresh, logout, forgot-password, reset-password
6. apps/api/src/server.ts                ← entrypoint, register semua plugin
7. apps/web/src/lib/api-client.ts        ← fetch wrapper ke /api/*, auto-refresh token kalau 401
8. apps/web/src/middleware.ts            ← cek access token cookie, redirect ke /login kalau kosong
9. apps/web/src/app/(auth)/login/page.tsx
10. apps/web/src/app/(auth)/register/page.tsx

VERIFICATION:
- POST /api/auth/register dengan data valid → 201, user masuk tabel users, password ke-hash
- POST /api/auth/login → 200, dapet cookie access_token + refresh_token (httpOnly)
- GET /api/auth/me tanpa cookie → 401
- GET /api/auth/me dengan cookie valid → 200, data user
- Access token expired, refresh jalan otomatis lewat api-client.ts → user tetap login mulus
```

### Phase 3: Core Layout & Dashboard Shell

```
Sama kayak v3.0 Phase 2, tapi data user diambil dari GET /api/auth/me (bukan supabase.auth.getUser()).

VERIFICATION:
- Register akun baru → redirect ke dashboard → tidak error
- Logout → cookie ke-clear, redirect ke login
- Akses /dashboard tanpa login → redirect ke /login (dicek di middleware.ts)
```

### Phase 4: MVP Features (Urutan Wajib)

```
Urutan sama kayak v3.0:
F12 → F4 → F5 → F2 → F3 → F6 → F1 → F7 → F8 → F11 → F9 → F13

Tapi tiap fitur sekarang punya DUA sisi: backend route (apps/api/src/routes/{feature}.ts)
dan frontend page (apps/web/src/app/...). Lihat Section 04 buat manifest lengkap.
```

### Phase 5: V2 & V3 Features

```
F10 (Alumni) → F14 (Kinerja) → F17 (PWA) → F15 (Pitch Board) → F16 (Asset+Watermark) → F18 (Analytics)
```

---

## SECTION 01: ENVIRONMENT SETUP

### 01.1 apps/api/.env

```bash
# === DATABASE ===
DATABASE_URL="postgresql://user:pass@ep-xxxx.neon.tech/jurnalisorg?sslmode=require"

# === JWT ===
JWT_ACCESS_SECRET=random_secret_min_32_char_buat_sendiri
JWT_REFRESH_SECRET=random_secret_lain_min_32_char
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# === CLOUDFLARE R2 ===
R2_ACCOUNT_ID=xxxx
R2_ACCESS_KEY_ID=xxxx
R2_SECRET_ACCESS_KEY=xxxx
R2_BUCKET_PUBLIC=jurnalis-org-public
R2_BUCKET_PRIVATE=jurnalis-org-private
R2_PUBLIC_URL=https://public.jurnalis.org   # custom domain yang di-bind ke bucket public

# === META WHATSAPP ===
META_WA_PHONE_NUMBER_ID=1234567890
META_WA_ACCESS_TOKEN=EAAxxxxxx...
META_WA_WEBHOOK_VERIFY_TOKEN=random_secret_string_buat_sendiri
META_WA_APP_SECRET=xxxxxxxx

# === RESEND ===
RESEND_API_KEY=re_xxxxxxxx
APP_EMAIL_DOMAIN=jurnalis.org

# === APP CONFIG ===
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000   # buat CORS whitelist & link di email
CRON_SECRET=random_secret_string_buat_sendiri
```

### 01.2 apps/web/.env.local

```bash
BACKEND_URL=http://localhost:4000    # dipakai next.config.js rewrites, TIDAK ada NEXT_PUBLIC_ prefix
                                       # (server-side only, browser gak pernah tau URL backend asli)
NEXT_PUBLIC_APP_NAME=Jurnalis Org
```

### 01.3 Aturan Pemakaian Variable

```typescript
// apps/api: SEMUA env var boleh diakses langsung (server-only environment)
process.env.DATABASE_URL
process.env.JWT_ACCESS_SECRET

// apps/web: HANYA BACKEND_URL yang boleh dipakai, itupun CUMA di next.config.js
// TIDAK ADA env var rahasia lain yang boleh nyampe ke apps/web
// Kalau butuh identitas user, ambil dari cookie (lewat middleware / GET /api/auth/me), bukan dari env
```

---

## SECTION 02: DATABASE SCHEMA (Prisma)

Field naming SENGAJA pakai snake_case (bukan camelCase) biar konsisten 1:1 sama nama kolom di database, ngurangin salah translate. `id` semua tabel pakai UUID.

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// ENUMS
// ============================================
enum UserRole {
  anggota
  pengurus
  bendahara
  redaktur
  ketua
  alumni
  admin
}

enum TaskStatus {
  pending
  in_progress
  review
  revision
  completed
  cancelled
}

enum TaskType {
  liputan
  editing
  desain
  foto
  video
  administrasi
  lainnya
}

enum ProjectStatus {
  planning
  active
  on_hold
  completed
  cancelled
}

enum ContentCategory {
  sma
  jurnal
  liputan
  mading
}

enum ContentStatus {
  draft
  pending
  review
  revision
  published
  archived
}

enum AttendanceStatus {
  hadir
  izin
  sakit
  alpha
}

enum MeetingType {
  rutin
  rapat
  workshop
  liputan
  lainnya
}

enum FinanceType {
  pemasukan
  pengeluaran
}

enum FinanceStatus {
  pending
  approved
  rejected
}

enum NotificationChannel {
  in_app
  whatsapp
  email
}

enum NotificationStatus {
  pending
  sent
  delivered
  failed
  read
}

enum AssetWatermarkStatus {
  pending
  processing
  done
  failed
}

// ============================================
// AUTH
// ============================================
model User {
  id                  String    @id @default(uuid()) @db.Uuid
  full_name           String
  nickname            String?
  email               String    @unique
  password_hash       String
  phone               String?
  avatar_url          String?
  role                UserRole  @default(anggota)
  division            String?
  angkatan            Int?
  graduation_year     Int?
  bio                 String?
  social_media        Json      @default("{}")
  current_job         String?
  is_active           Boolean   @default(true)
  email_notifications Boolean   @default(true)
  wa_notifications    Boolean   @default(true)
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt

  refresh_tokens        RefreshToken[]
  password_resets       PasswordResetToken[]
  tasks_assigned_to     Task[]              @relation("TaskAssignedTo")
  tasks_assigned_by     Task[]              @relation("TaskAssignedBy")
  task_comments         TaskComment[]
  task_history          TaskHistory[]
  projects_coordinated  Project[]
  meetings_created      Meeting[]
  attendance_own        Attendance[]        @relation("AttendanceProfile")
  attendance_checked    Attendance[]        @relation("AttendanceCheckedBy")
  content_authored      ContentCard[]       @relation("ContentAuthor")
  content_edited        ContentCard[]       @relation("ContentEditor")
  content_likes         ContentLike[]
  finance_recorded      Finance[]           @relation("FinanceRecordedBy")
  finance_approved      Finance[]           @relation("FinanceApprovedBy")
  notifications         Notification[]
  notification_prefs    NotificationPreference[]
  performance_records   PerformanceRecord[]
  knowledge_authored    KnowledgeBase[]
  alumni_connection     AlumniConnection?
  org_structure_entries OrgStructure[]
  pitches_authored      Pitch[]
  pitch_votes           PitchVote[]
  content_calendar_assigned ContentCalendar[]
  assets_uploaded       Asset[]
  analytics_events      AnalyticsEvent[]

  @@map("users")
}

model RefreshToken {
  id          String   @id @default(uuid()) @db.Uuid
  user_id     String   @db.Uuid
  user        User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  token_hash  String   @unique   // SHA-256 hash dari refresh token, bukan plain text
  expires_at  DateTime
  revoked_at  DateTime?
  created_at  DateTime @default(now())

  @@index([user_id])
  @@map("refresh_tokens")
}

model PasswordResetToken {
  id          String   @id @default(uuid()) @db.Uuid
  user_id     String   @db.Uuid
  user        User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  token_hash  String   @unique
  expires_at  DateTime
  used_at     DateTime?
  created_at  DateTime @default(now())

  @@map("password_reset_tokens")
}

// ============================================
// ORG PROFILE
// ============================================
model OrgProfile {
  id            String   @id @default(uuid()) @db.Uuid
  name          String   @default("Jurnalis Org")
  tagline       String?
  vision        String?
  mission       String[]
  founded_year  Int?
  logo_url      String?
  cover_url     String?
  social_media  Json     @default("{}")
  contact_email String?
  contact_phone String?
  address       String?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@map("org_profile")
}

model Achievement {
  id          String   @id @default(uuid()) @db.Uuid
  title       String
  category    String   // 'lomba' | 'penghargaan' | 'publikasi'
  year        Int
  description String?
  image_url   String?
  created_at  DateTime @default(now())

  @@map("achievements")
}

// ============================================
// PROJECTS & TASKS
// ============================================
model Project {
  id               String        @id @default(uuid()) @db.Uuid
  title            String
  description      String?
  category         String?
  status           ProjectStatus @default(planning)
  coordinator_id   String?       @db.Uuid
  coordinator      User?         @relation(fields: [coordinator_id], references: [id])
  start_date       DateTime?     @db.Date
  end_date         DateTime?     @db.Date
  estimated_hours  Int           @default(0)
  actual_hours     Int           @default(0)
  weight_total     Int           @default(0)
  cover_image      String?
  created_at       DateTime      @default(now())
  updated_at       DateTime      @updatedAt

  tasks Task[]

  @@map("projects")
}

model Task {
  id              String      @id @default(uuid()) @db.Uuid
  project_id      String?     @db.Uuid
  project         Project?    @relation(fields: [project_id], references: [id], onDelete: SetNull)
  title           String
  description     String?
  type            TaskType    @default(lainnya)
  status          TaskStatus  @default(pending)
  assigned_to     String?     @db.Uuid
  assignee        User?       @relation("TaskAssignedTo", fields: [assigned_to], references: [id])
  assigned_by     String?     @db.Uuid
  assigner        User?       @relation("TaskAssignedBy", fields: [assigned_by], references: [id])
  weight          Int         @default(0)
  estimated_hours Int         @default(0)
  actual_hours    Int         @default(0)
  due_date        DateTime?
  completed_at    DateTime?
  attachments     Json        @default("[]")
  notes           String?
  created_at      DateTime    @default(now())
  updated_at      DateTime    @updatedAt

  comments TaskComment[]
  history  TaskHistory[]
  assets   Asset[]

  @@index([assigned_to])
  @@index([project_id])
  @@index([status])
  @@index([due_date])
  @@map("tasks")
}

model TaskComment {
  id         String   @id @default(uuid()) @db.Uuid
  task_id    String   @db.Uuid
  task       Task     @relation(fields: [task_id], references: [id], onDelete: Cascade)
  author_id  String   @db.Uuid
  author     User     @relation(fields: [author_id], references: [id])
  content    String
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@map("task_comments")
}

model TaskHistory {
  id         String   @id @default(uuid()) @db.Uuid
  task_id    String   @db.Uuid
  task       Task     @relation(fields: [task_id], references: [id], onDelete: Cascade)
  actor_id   String   @db.Uuid
  actor      User     @relation(fields: [actor_id], references: [id])
  action     String   // 'status_change' | 'comment' | 'submit' | 'assign'
  from_value String?
  to_value   String?
  notes      String?
  created_at DateTime @default(now())

  @@map("task_history")
}

// ============================================
// SCHEDULE & ATTENDANCE
// ============================================
model Meeting {
  id           String      @id @default(uuid()) @db.Uuid
  title        String
  type         MeetingType @default(rutin)
  description  String?
  start_time   DateTime
  end_time     DateTime?
  location     String?
  link         String?
  is_mandatory Boolean     @default(true)
  created_by   String?     @db.Uuid
  creator      User?       @relation(fields: [created_by], references: [id])
  is_closed    Boolean     @default(false)
  created_at   DateTime    @default(now())
  updated_at   DateTime    @updatedAt

  attendance Attendance[]

  @@index([start_time])
  @@map("meetings")
}

model Attendance {
  id          String            @id @default(uuid()) @db.Uuid
  meeting_id  String            @db.Uuid
  meeting     Meeting           @relation(fields: [meeting_id], references: [id], onDelete: Cascade)
  profile_id  String            @db.Uuid
  profile     User              @relation("AttendanceProfile", fields: [profile_id], references: [id])
  status      AttendanceStatus  @default(alpha)
  proof_url   String?
  notes       String?
  checked_by  String?           @db.Uuid
  checker     User?             @relation("AttendanceCheckedBy", fields: [checked_by], references: [id])
  created_at  DateTime          @default(now())
  updated_at  DateTime          @updatedAt

  @@unique([meeting_id, profile_id])
  @@index([meeting_id])
  @@index([profile_id])
  @@map("attendance")
}

// ============================================
// CONTENT / EDITORIAL
// ============================================
model ContentCard {
  id           String          @id @default(uuid()) @db.Uuid
  title        String
  slug         String          @unique
  excerpt      String?
  content      String          @default("")
  category     ContentCategory
  cover_image  String?
  author_id    String?         @db.Uuid
  author       User?           @relation("ContentAuthor", fields: [author_id], references: [id])
  editor_id    String?         @db.Uuid
  editor       User?           @relation("ContentEditor", fields: [editor_id], references: [id])
  status       ContentStatus   @default(draft)
  published_at DateTime?
  views        Int             @default(0)
  likes        Int             @default(0)
  tags         String[]        @default([])
  youtube_id   String?
  attachments  Json            @default("[]")
  is_featured  Boolean         @default(false)
  seo_title    String?
  seo_desc     String?
  created_at   DateTime        @default(now())
  updated_at   DateTime        @updatedAt

  content_likes    ContentLike[]
  calendar_entries ContentCalendar[]
  assets           Asset[]

  @@index([category])
  @@index([status])
  @@index([published_at])
  @@index([is_featured])
  @@map("content_cards")
}

model ContentLike {
  content_id String      @db.Uuid
  content    ContentCard @relation(fields: [content_id], references: [id], onDelete: Cascade)
  profile_id String      @db.Uuid
  profile    User        @relation(fields: [profile_id], references: [id], onDelete: Cascade)
  created_at DateTime    @default(now())

  @@id([content_id, profile_id])
  @@map("content_likes")
}

model ContentCalendar {
  id           String           @id @default(uuid()) @db.Uuid
  content_id   String?          @db.Uuid
  content      ContentCard?     @relation(fields: [content_id], references: [id])
  title        String
  scheduled_at DateTime
  category     ContentCategory?
  assignee_id  String?          @db.Uuid
  assignee     User?            @relation(fields: [assignee_id], references: [id])
  status       String           @default("planned")
  notes        String?
  created_at   DateTime         @default(now())

  @@map("content_calendar")
}

// ============================================
// FINANCE
// ============================================
model Finance {
  id          String        @id @default(uuid()) @db.Uuid
  type        FinanceType
  amount      Decimal       @db.Decimal(12, 2)
  description String
  category    String?
  proof_url   String?
  status      FinanceStatus @default(pending)
  recorded_by String?       @db.Uuid
  recorder    User?         @relation("FinanceRecordedBy", fields: [recorded_by], references: [id])
  approved_by String?       @db.Uuid
  approver    User?         @relation("FinanceApprovedBy", fields: [approved_by], references: [id])
  approved_at DateTime?
  created_at  DateTime      @default(now())
  updated_at  DateTime      @updatedAt

  @@index([type])
  @@index([status])
  @@map("finance")
}

// ============================================
// NOTIFICATIONS
// ============================================
model Notification {
  id           String              @id @default(uuid()) @db.Uuid
  recipient_id String              @db.Uuid
  recipient    User                @relation(fields: [recipient_id], references: [id], onDelete: Cascade)
  type         String
  title        String
  message      String
  data         Json                @default("{}")
  channel      NotificationChannel @default(in_app)
  status       NotificationStatus  @default(pending)
  sent_at      DateTime?
  read_at      DateTime?
  created_at   DateTime            @default(now())

  @@index([recipient_id])
  @@index([status])
  @@map("notifications")
}

model NotificationPreference {
  profile_id String  @db.Uuid
  profile    User    @relation(fields: [profile_id], references: [id], onDelete: Cascade)
  notif_type String
  in_app     Boolean @default(true)
  whatsapp   Boolean @default(true)
  email      Boolean @default(true)

  @@id([profile_id, notif_type])
  @@map("notification_preferences")
}

// ============================================
// PERFORMANCE
// ============================================
model PerformancePeriod {
  id         String   @id @default(uuid()) @db.Uuid
  name       String
  start_date DateTime @db.Date
  end_date   DateTime @db.Date
  is_active  Boolean  @default(false)
  created_at DateTime @default(now())

  records PerformanceRecord[]

  @@map("performance_periods")
}

model PerformanceRecord {
  id                String            @id @default(uuid()) @db.Uuid
  profile_id        String            @db.Uuid
  profile           User              @relation(fields: [profile_id], references: [id])
  period_id         String            @db.Uuid
  period            PerformancePeriod @relation(fields: [period_id], references: [id])
  tasks_completed   Int               @default(0)
  tasks_on_time     Int               @default(0)
  tasks_late        Int               @default(0)
  total_weight      Int               @default(0)
  attendance_total  Int               @default(0)
  attendance_hadir  Int               @default(0)
  content_published Int               @default(0)
  overall_score     Decimal           @default(0) @db.Decimal(5, 2)
  updated_at        DateTime          @updatedAt

  @@unique([profile_id, period_id])
  @@index([profile_id])
  @@index([period_id])
  @@map("performance_records")
}

// ============================================
// KNOWLEDGE BASE, FAQ, ALUMNI, STRUCTURE
// ============================================
model KnowledgeBase {
  id          String   @id @default(uuid()) @db.Uuid
  title       String
  content     String
  category    String?
  is_public   Boolean  @default(false)
  author_id   String?  @db.Uuid
  author      User?    @relation(fields: [author_id], references: [id])
  order_index Int      @default(0)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@map("knowledge_base")
}

model Faq {
  id          String   @id @default(uuid()) @db.Uuid
  question    String
  answer      String
  category    String?
  order_index Int      @default(0)
  created_at  DateTime @default(now())

  @@map("faqs")
}

model AlumniConnection {
  id              String   @id @default(uuid()) @db.Uuid
  profile_id      String   @unique @db.Uuid
  profile         User     @relation(fields: [profile_id], references: [id])
  graduation_year Int?
  current_job     String?
  company         String?
  linkedin_url    String?
  is_mentor       Boolean  @default(false)
  mentor_fields   String[] @default([])
  updated_at      DateTime @updatedAt

  @@map("alumni_connections")
}

model OrgStructure {
  id          String   @id @default(uuid()) @db.Uuid
  profile_id  String   @db.Uuid
  profile     User     @relation(fields: [profile_id], references: [id])
  position    String
  division    String?
  period_year Int
  order_index Int      @default(0)
  created_at  DateTime @default(now())

  @@map("org_structure")
}

// ============================================
// PITCH BOARD (F15)
// ============================================
model Pitch {
  id               String   @id @default(uuid()) @db.Uuid
  title            String
  description      String
  category         String?
  estimated_effort String?
  expected_impact  String?
  author_id        String?  @db.Uuid
  author           User?    @relation(fields: [author_id], references: [id])
  status           String   @default("draft")
  upvotes          Int      @default(0)
  downvotes        Int      @default(0)
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  votes PitchVote[]

  @@map("pitches")
}

model PitchVote {
  pitch_id   String   @db.Uuid
  pitch      Pitch    @relation(fields: [pitch_id], references: [id], onDelete: Cascade)
  profile_id String   @db.Uuid
  profile    User     @relation(fields: [profile_id], references: [id], onDelete: Cascade)
  vote       Int      // 1 atau -1, divalidasi di Zod schema bukan di DB constraint
  created_at DateTime @default(now())

  @@id([pitch_id, profile_id])
  @@map("pitch_votes")
}

// ============================================
// ASSET + WATERMARK (F16)
// ============================================
model Asset {
  id                  String                @id @default(uuid()) @db.Uuid
  title               String
  category            String?               // 'foto' | 'desain' | 'dokumentasi'
  original_url        String
  watermarked_url     String?
  watermark_status    AssetWatermarkStatus  @default(pending)
  uploaded_by         String?               @db.Uuid
  uploader            User?                 @relation(fields: [uploaded_by], references: [id])
  related_task_id     String?               @db.Uuid
  related_task        Task?                 @relation(fields: [related_task_id], references: [id], onDelete: SetNull)
  related_content_id  String?               @db.Uuid
  related_content     ContentCard?          @relation(fields: [related_content_id], references: [id], onDelete: SetNull)
  tags                String[]              @default([])
  is_public           Boolean               @default(false)
  created_at          DateTime              @default(now())
  updated_at          DateTime              @updatedAt

  @@index([uploaded_by])
  @@index([is_public])
  @@map("assets")
}

// ============================================
// ANALYTICS (F18)
// ============================================
model AnalyticsEvent {
  id          String   @id @default(uuid()) @db.Uuid
  event_type  String   // 'content_view' | 'content_like' | 'task_completed' | 'login'
  entity_type String?
  entity_id   String?  @db.Uuid
  actor_id    String?  @db.Uuid
  actor       User?    @relation(fields: [actor_id], references: [id])
  metadata    Json     @default("{}")
  created_at  DateTime @default(now())

  @@index([event_type, created_at])
  @@index([entity_type, entity_id])
  @@map("analytics_events")
}
```

VERIFICATION:
```
[ ] npx prisma validate → tidak ada error
[ ] npx prisma migrate dev --name init → sukses, tabel muncul di Neon dashboard
[ ] npx prisma studio → semua 27 model keliatan
```

---

## SECTION 03: AUTH & AUTHORIZATION SYSTEM

Ini section yang paling beda dari v3.0 karena dulu semuanya di-handle Supabase. Sekarang harus dibangun manual, jadi harus PRESISI.

### 03.1 Strategi

```
- Password: argon2id hash, JANGAN bcrypt (argon2 lebih modern & direkomendasikan OWASP terbaru)
- Access token: JWT, umur 15 menit, isi payload { sub: user_id, role }, disimpan di httpOnly cookie
- Refresh token: random string (bukan JWT), umur 30 hari, HASH-nya (SHA-256) disimpan di tabel
  refresh_tokens, plain text-nya di httpOnly cookie. Di-ROTATE setiap dipakai (refresh token lama
  di-revoke, refresh token baru diterbitkan) — ini nyegah replay attack kalau token lama bocor.
- Logout: hapus cookie + revoke refresh token di database (set revoked_at)
- Semua cookie: httpOnly, secure (production), sameSite=lax (karena udah same-origin lewat proxy Section 0.5)
```

### 03.2 Pattern: JWT & Password Helper

```typescript
// apps/api/src/lib/password.ts
import argon2 from 'argon2'

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id })
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain)
}
```

```typescript
// apps/api/src/lib/jwt.ts
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

type AccessPayload = { sub: string; role: string }

export function signAccessToken(payload: AccessPayload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m' })
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as AccessPayload
}

export function generateRefreshToken(): { plain: string; hash: string } {
  const plain = crypto.randomBytes(48).toString('hex')
  const hash = crypto.createHash('sha256').update(plain).digest('hex')
  return { plain, hash }
}

export function hashRefreshToken(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex')
}
```

### 03.3 Pattern: Auth Plugin (preHandler hooks)

```typescript
// apps/api/src/plugins/auth.ts
import fp from 'fastify-plugin'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken } from '../lib/jwt'

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: { id: string; role: string }
  }
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.access_token
    if (!token) return reply.code(401).send({ error: 'Unauthorized' })

    try {
      const payload = verifyAccessToken(token)
      request.currentUser = { id: payload.sub, role: payload.role }
    } catch {
      return reply.code(401).send({ error: 'Token invalid atau expired' })
    }
  })

  fastify.decorate('requireRole', (allowedRoles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.currentUser) return reply.code(401).send({ error: 'Unauthorized' })
      if (!allowedRoles.includes(request.currentUser.role)) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }
  })
})
```

Cara pakai di route mana pun (INI YANG WAJIB DIPAKAI, ganti semua inline role check manual):

```typescript
fastify.get('/tasks', { preHandler: [fastify.authenticate] }, handler)
fastify.post('/finance', { preHandler: [fastify.authenticate, fastify.requireRole(['bendahara', 'admin'])] }, handler)
```

### 03.4 Route: Auth Endpoints Lengkap

```typescript
// apps/api/src/routes/auth.ts
import { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma'
import { hashPassword, verifyPassword } from '../lib/password'
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../lib/jwt'
import { registerSchema, loginSchema } from '@jurnalis-org/shared/validations/auth'

const REFRESH_COOKIE_OPTS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/auth' }
const ACCESS_COOKIE_OPTS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' }

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (existing) return reply.code(409).send({ error: 'Email sudah terdaftar' })

    const password_hash = await hashPassword(parsed.data.password)
    const user = await prisma.user.create({
      data: { full_name: parsed.data.full_name, email: parsed.data.email, password_hash, role: 'anggota' },
    })

    return reply.code(201).send({ id: user.id, email: user.email, full_name: user.full_name })
  })

  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (!user || !(await verifyPassword(user.password_hash, parsed.data.password))) {
      return reply.code(401).send({ error: 'Email atau password salah' })
    }
    if (!user.is_active) return reply.code(403).send({ error: 'Akun nonaktif' })

    const accessToken = signAccessToken({ sub: user.id, role: user.role })
    const { plain, hash } = generateRefreshToken()
    await prisma.refreshToken.create({
      data: { user_id: user.id, token_hash: hash, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    })

    reply.setCookie('access_token', accessToken, ACCESS_COOKIE_OPTS)
    reply.setCookie('refresh_token', plain, REFRESH_COOKIE_OPTS)
    return reply.send({ id: user.id, email: user.email, full_name: user.full_name, role: user.role })
  })

  fastify.post('/refresh', async (request, reply) => {
    const plain = request.cookies.refresh_token
    if (!plain) return reply.code(401).send({ error: 'No refresh token' })

    const hash = hashRefreshToken(plain)
    const stored = await prisma.refreshToken.findUnique({ where: { token_hash: hash } })
    if (!stored || stored.revoked_at || stored.expires_at < new Date()) {
      return reply.code(401).send({ error: 'Refresh token invalid' })
    }

    // ROTATE: revoke yang lama, terbitkan yang baru
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked_at: new Date() } })
    const user = await prisma.user.findUniqueOrThrow({ where: { id: stored.user_id } })
    const accessToken = signAccessToken({ sub: user.id, role: user.role })
    const next = generateRefreshToken()
    await prisma.refreshToken.create({
      data: { user_id: user.id, token_hash: next.hash, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    })

    reply.setCookie('access_token', accessToken, ACCESS_COOKIE_OPTS)
    reply.setCookie('refresh_token', next.plain, REFRESH_COOKIE_OPTS)
    return reply.send({ status: 'ok' })
  })

  fastify.post('/logout', async (request, reply) => {
    const plain = request.cookies.refresh_token
    if (plain) {
      const hash = hashRefreshToken(plain)
      await prisma.refreshToken.updateMany({ where: { token_hash: hash }, data: { revoked_at: new Date() } })
    }
    reply.clearCookie('access_token', { path: '/' })
    reply.clearCookie('refresh_token', { path: '/api/auth' })
    return reply.send({ status: 'ok' })
  })

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.currentUser!.id } })
    const { password_hash, ...safe } = user
    return reply.send(safe)
  })
}

export default authRoutes
```

VERIFY:
```
[ ] POST /api/auth/register data valid → 201, cek tabel users password_hash BUKAN plain text
[ ] POST /api/auth/register email duplikat → 409
[ ] POST /api/auth/login salah password → 401
[ ] POST /api/auth/login benar → 200 + cookie access_token & refresh_token ke-set
[ ] GET /api/auth/me tanpa cookie → 401
[ ] Tunggu 15 menit (atau ubah JWT_ACCESS_EXPIRES_IN jadi 5s buat testing) → GET /api/auth/me → 401 karena expired
[ ] POST /api/auth/refresh dengan refresh_token valid → access_token baru ke-set, refresh_token lama ke-revoke (cek kolom revoked_at)
[ ] POST /api/auth/logout → cookie ke-clear, refresh token ke-revoke
```

### 03.5 Pattern: Frontend API Client dengan Auto-Refresh

```typescript
// apps/web/src/lib/api-client.ts
'use client'

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise
  isRefreshing = true
  refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((res) => res.ok)
    .finally(() => { isRefreshing = false })
  return refreshPromise
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`/api${path}`, { ...options, credentials: 'include' })

  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return fetch(`/api${path}`, { ...options, credentials: 'include' })
    }
    window.location.href = '/login'
  }

  return res
}
```

### 03.6 Pattern: Next.js Middleware (Route Protection)

```typescript
// apps/web/src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')
  const { pathname } = request.nextUrl

  if (!accessToken && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (accessToken && (pathname.startsWith('/login') || pathname.startsWith('/register'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

Catatan: middleware ini cuma cek KEBERADAAN cookie (bukan verifikasi signature-nya, karena `jsonwebtoken` butuh Node crypto yang gak jalan di Edge Runtime). Verifikasi asli tetap terjadi di backend tiap request lewat `fastify.authenticate`. Ini defense pertama doang biar UX gak nyantol nunjukin dashboard kosong dulu baru redirect.

---

## SECTION 04: WEBSOCKET (REALTIME)

### 04.1 Server: @fastify/websocket

```typescript
// apps/api/src/plugins/websocket.ts
import fp from 'fastify-plugin'
import websocket from '@fastify/websocket'
import { FastifyInstance } from 'fastify'
import { verifyAccessToken } from '../lib/jwt'

// Map userId -> Set of open connections (satu user bisa buka banyak tab)
const connections = new Map<string, Set<any>>()

export default fp(async function wsPlugin(fastify: FastifyInstance) {
  await fastify.register(websocket)

  fastify.get('/ws', { websocket: true }, (connection, request) => {
    const token = request.cookies?.access_token
    let userId: string
    try {
      userId = verifyAccessToken(token ?? '').sub
    } catch {
      connection.socket.close(4001, 'Unauthorized')
      return
    }

    if (!connections.has(userId)) connections.set(userId, new Set())
    connections.get(userId)!.add(connection.socket)

    connection.socket.on('close', () => {
      connections.get(userId)?.delete(connection.socket)
    })
  })

  // Dipanggil dari mana aja (misal src/lib/notifications.ts) buat push realtime ke user tertentu
  fastify.decorate('pushToUser', (userId: string, event: string, payload: unknown) => {
    const sockets = connections.get(userId)
    if (!sockets) return
    const message = JSON.stringify({ event, payload })
    for (const socket of sockets) {
      if (socket.readyState === 1) socket.send(message)
    }
  })
})
```

### 04.2 Client: Hook React

```typescript
// apps/web/src/hooks/use-realtime.ts
'use client'
import { useEffect, useRef } from 'react'

export function useRealtime(onMessage: (event: string, payload: unknown) => void) {
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      const { event, payload } = JSON.parse(e.data)
      onMessage(event, payload)
    }
    ws.onclose = () => {
      // Reconnect sederhana, 3 detik kemudian
      setTimeout(() => { wsRef.current = new WebSocket(`${protocol}://${window.location.host}/ws`) }, 3000)
    }

    return () => ws.close()
  }, [onMessage])
}
```

```typescript
// Pemakaian: src/hooks/use-notifications.ts
'use client'
import { useQueryClient } from '@tanstack/react-query'
import { useRealtime } from './use-realtime'
import { toast } from '@/components/ui/use-toast'

export function useNotificationSubscription() {
  const queryClient = useQueryClient()

  useRealtime((event, payload: any) => {
    if (event === 'notification:new') {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: payload.title, description: payload.message })
    }
    if (event === 'task:updated') {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  })
}
```

CATATAN PENTING: karena Render free tier cuma jalan SATU instance, `connections` Map di atas cukup buat skala 50-100 user aktif. Kalau nanti scale ke banyak instance, WAJIB ganti ke Postgres `LISTEN/NOTIFY` atau Redis pub/sub biar broadcast nyampe ke semua instance — TAPI JANGAN over-engineer ini sekarang, budget gratis.

VERIFY:
```
[ ] Buka /dashboard di 2 tab browser, login user yang sama
[ ] Trigger notifikasi dari tab lain (misal assign tugas) → toast muncul realtime di tab pertama tanpa refresh
[ ] Matiin koneksi (offline mode devtools) → nyalain lagi → WebSocket auto-reconnect dalam 3 detik
```

---

## SECTION 05: FILE STORAGE (Cloudflare R2)

### 05.1 Strategi

```
Dua bucket:
  jurnalis-org-public   → avatar, foto konten, watermarked asset. Diakses langsung via R2_PUBLIC_URL (custom domain).
  jurnalis-org-private   → attachment tugas, bukti keuangan, dokumen, foto original (belum watermark).
                           Diakses HANYA lewat presigned URL yang diterbitkan backend, expire 1 jam.

Alur upload (SAMA persis kayak v3.0, cuma sumber signed URL-nya beda):
  1. Client compressImages() dulu (Pattern 10, TIDAK BERUBAH dari v3.0)
  2. Client minta presigned upload URL ke POST /api/storage/signed-url
  3. Client PUT file langsung ke presigned URL (gak lewat backend, hemat bandwidth Render)
  4. Client kirim path final ke endpoint terkait (misal POST /api/tasks/:id/submit) buat disimpan di DB
```

### 05.2 Pattern: R2 Client & Signed URL

```typescript
// apps/api/src/lib/storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const ALLOWED_BUCKETS = [process.env.R2_BUCKET_PUBLIC!, process.env.R2_BUCKET_PRIVATE!]

export async function createUploadUrl(bucket: string, path: string, contentType: string) {
  if (!ALLOWED_BUCKETS.includes(bucket)) throw new Error('Bucket tidak valid')
  const command = new PutObjectCommand({ Bucket: bucket, Key: path, ContentType: contentType })
  return getSignedUrl(r2, command, { expiresIn: 3600 })
}

export async function createDownloadUrl(bucket: string, path: string) {
  if (!ALLOWED_BUCKETS.includes(bucket)) throw new Error('Bucket tidak valid')
  const command = new GetObjectCommand({ Bucket: bucket, Key: path })
  return getSignedUrl(r2, command, { expiresIn: 3600 })
}

export function publicUrl(path: string) {
  return `${process.env.R2_PUBLIC_URL}/${path}`
}
```

```typescript
// apps/api/src/routes/storage.ts
import { FastifyPluginAsync } from 'fastify'
import { createUploadUrl } from '../lib/storage'
import { signedUrlSchema } from '@jurnalis-org/shared/validations/storage'

const storageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/signed-url', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = signedUrlSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { bucket, path, contentType } = parsed.data
    const signedUrl = await createUploadUrl(bucket, path, contentType)
    return reply.send({ signedUrl, path, expiresIn: 3600 })
  })
}

export default storageRoutes
```

VERIFY:
```
[ ] POST /api/storage/signed-url dengan bucket valid → 200, dapet signedUrl
[ ] POST /api/storage/signed-url dengan bucket ngasal (bukan whitelist) → 400
[ ] PUT file ke signedUrl langsung dari browser → 200, file muncul di R2 dashboard
[ ] File di bucket public bisa diakses langsung via R2_PUBLIC_URL tanpa auth
[ ] File di bucket private TIDAK bisa diakses tanpa presigned URL
```

---

## SECTION 06: NOTIFICATION SERVICE (WA + Email, hampir sama kayak v3.0)

Wrapper WhatsApp (Pattern 11 v3.0) dan Resend (Pattern 12 v3.0) **TIDAK BERUBAH** — keduanya cuma `fetch()` ke API eksternal, gak pernah nyentuh Supabase. Yang berubah cuma cara ambil data user (Prisma, bukan Supabase client) dan rate limiting (Prisma query, bukan Supabase query — sama-sama DB-backed, cuma beda syntax).

```typescript
// apps/api/src/lib/notifications.ts
import { prisma } from './prisma'
import { sendWhatsApp } from './whatsapp'   // sama persis kayak v3.0 Pattern 11
import { sendEmail } from './email'          // sama persis kayak v3.0 Pattern 12

type NotificationPayload = {
  recipient_id: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  channels?: ('whatsapp' | 'email' | 'in_app')[]
}

async function isRateLimited(recipientId: string, type: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 5 * 60 * 1000)
  const count = await prisma.notification.count({
    where: { recipient_id: recipientId, type, created_at: { gte: windowStart } },
  })
  return count > 0
}

export async function sendNotification(fastify: FastifyInstanceWithWs, payload: NotificationPayload) {
  const { recipient_id, type, title, message, data = {}, channels = ['in_app'] } = payload

  if (await isRateLimited(recipient_id, type)) {
    return { skipped: true, reason: 'rate_limited' }
  }

  const user = await prisma.user.findUnique({
    where: { id: recipient_id },
    select: { phone: true, email: true, wa_notifications: true, email_notifications: true },
  })
  if (!user) throw new Error(`User not found: ${recipient_id}`)

  const results: Record<string, boolean> = {}

  if (channels.includes('in_app')) {
    const notif = await prisma.notification.create({
      data: { recipient_id, type, title, message, data, channel: 'in_app', status: 'sent', sent_at: new Date() },
    })
    results.in_app = true
    fastify.pushToUser(recipient_id, 'notification:new', notif)   // realtime push, lihat Section 04
  }

  if (channels.includes('whatsapp') && user.wa_notifications && user.phone) {
    try {
      await sendWhatsApp(user.phone, title, message)
      results.whatsapp = true
    } catch {
      results.whatsapp = false
      if (!channels.includes('email')) channels.push('email')
    }
  }

  if (channels.includes('email') && user.email_notifications) {
    try {
      await sendEmail({ to: user.email, subject: title, text: message })
      results.email = true
    } catch {
      results.email = false
    }
  }

  return results
}
```

Helper tingkat tinggi (`sendTaskAssigned`, `sendTaskStatusChange`, dll) sama persis kayak v3.0, tinggal ganti `supabase.from('tasks').select()` jadi `prisma.task.findUnique()`.

---

## SECTION 07: FEATURE FILE MANIFEST

Format baru: tiap fitur punya file backend (`apps/api`) dan frontend (`apps/web`). Urutan build sama kayak v3.0 Section 00 Phase 4-5.

### Shared (buat sebelum semua fitur)

```
BACKEND:
  apps/api/src/lib/prisma.ts
  apps/api/src/lib/jwt.ts, password.ts, storage.ts, notifications.ts, whatsapp.ts, email.ts
  apps/api/src/plugins/auth.ts, websocket.ts, cors.ts
  apps/api/src/routes/auth.ts, storage.ts
  apps/api/src/server.ts

FRONTEND:
  apps/web/src/lib/api-client.ts
  apps/web/src/middleware.ts
  apps/web/src/hooks/use-realtime.ts, use-notifications.ts
  apps/web/src/components/providers/query-provider.tsx
  apps/web/src/components/layout/sidebar.tsx, header.tsx, mobile-nav.tsx
  apps/web/src/components/ui/status-badge.tsx, user-avatar.tsx, file-upload.tsx, image-compressor.tsx, empty-state.tsx, loading-skeleton.tsx
  apps/web/src/app/layout.tsx
  apps/web/src/app/(auth)/login/page.tsx, register/page.tsx
  apps/web/src/app/(dashboard)/layout.tsx, page.tsx

SHARED:
  packages/shared/src/validations/auth.ts, storage.ts, tasks.ts, projects.ts, finance.ts,
    content.ts, pitches.ts, assets.ts, meetings.ts  ← satu file per fitur yang punya form (RULE-011)
```

### F12: Notifikasi (BUAT PERTAMA)

```
BACKEND:
  apps/api/src/routes/notifications.ts    → POST /notifications (trigger manual, admin/ketua only)
  apps/api/src/routes/webhooks.ts          → GET+POST /webhooks/wa-cloud (Pattern verifikasi signature, lihat 07.X di bawah)
  apps/api/src/routes/cron.ts              → GET /cron/keep-alive, GET /cron/deadline-check

FRONTEND:
  apps/web/src/components/notifications/notification-bell.tsx
  apps/web/src/components/notifications/notification-dropdown.tsx
  apps/web/src/components/notifications/notification-item.tsx

VERIFY: sama kayak v3.0, ganti "record muncul di Supabase" jadi "record muncul di Prisma Studio"
```

### F4: Submit Tugas

```
BACKEND:
  apps/api/src/routes/tasks.ts
    GET    /tasks              → list tugas milik user (atau semua kalau pengurus+)
    GET    /tasks/:id           → detail
    POST   /tasks/:id/submit    → update status jadi review + attachments
    PATCH  /tasks/:id/status    → update status (pengurus+)
    POST   /tasks/:id/comments  → tambah komentar

FRONTEND:
  apps/web/src/app/(dashboard)/tasks/page.tsx, [id]/page.tsx, [id]/submit/page.tsx
  apps/web/src/hooks/use-tasks.ts             ← TanStack Query, fetch ke /api/tasks lewat api-client.ts
  apps/web/src/components/tasks/task-card.tsx, task-detail.tsx, task-submit-form.tsx,
    task-history-timeline.tsx, task-comments.tsx, task-status-badge.tsx

VERIFY: sama kayak v3.0.
```

### F5, F2, F3, F6, F1, F7, F8, F9, F11, F13 (MVP sisanya)

```
Pola sama kayak F4: satu file route backend per fitur (apps/api/src/routes/{feature}.ts)
dengan REST endpoint standar (GET list, GET detail, POST create, PATCH update, DELETE),
satu set halaman + komponen frontend yang fetch lewat hooks/use-{feature}.ts.

Nama file komponen dan halaman IDENTIK sama v3.0 Section 03, TINGGAL PINDAH:
  - Supabase query di Server Component → fetch('/api/{feature}') pakai fetch() biasa (server-side)
  - Supabase query di Client Component (TanStack Query) → apiFetch('/{feature}') dari api-client.ts
  - Server Action → jadi POST/PATCH/DELETE endpoint di apps/api, dipanggil dari mutation TanStack Query

KHUSUS F7 (Finance): endpoint approve WAJIB pakai
  { preHandler: [fastify.authenticate, fastify.requireRole(['ketua', 'admin'])] }
KHUSUS F3 (Editorial): endpoint update stage WAJIB
  { preHandler: [fastify.authenticate, fastify.requireRole(['redaktur', 'ketua', 'admin'])] }
```

### F10, F14, F17 (V2) dan F15, F16, F18 (V3)

```
F10 (Alumni), F14 (Performance): pola CRUD sama, endpoint di apps/api/src/routes/alumni.ts, performance.ts

F17 (PWA): TIDAK BERUBAH dari v3.0 (manifest.json, service worker, next-pwa — full frontend, gak nyentuh backend)

F15 (Pitch Board):
  BACKEND: apps/api/src/routes/pitches.ts
    GET /pitches, POST /pitches, POST /pitches/:id/vote (toggle logic: vote sama = DELETE row)
  FRONTEND: apps/web/src/app/(dashboard)/pitches/...
  Vote count di-update via Prisma $transaction (bukan trigger DB kayak versi Supabase),
  hitung ulang upvotes/downvotes tiap kali vote berubah, dalam satu transaction sama insert/delete vote-nya.

F16 (Asset + Watermark):
  BACKEND: apps/api/src/routes/assets.ts
  FRONTEND: apps/web/src/lib/watermark.ts (Canvas API, IDENTIK sama Addendum v3.1 Pattern 17, gak berubah)
  Upload flow: compressImages() → applyWatermark() → signed URL ke bucket public → simpan record via POST /assets

F18 (Analytics):
  BACKEND: apps/api/src/routes/analytics.ts
    POST /analytics/track  → dipanggil internal (dari route lain, bukan dari client langsung)
    GET  /analytics/overview → requireRole(['pengurus','bendahara','redaktur','ketua','admin'])
  FRONTEND: apps/web/src/app/(dashboard)/analytics/...
```

---

## SECTION 08: WEBHOOK & CONSTRAINT KHUSUS

### 08.1 Webhook Meta WA (verifikasi WAJIB, sama pentingnya kayak Addendum v3.1)

```typescript
// apps/api/src/routes/webhooks.ts
import { FastifyPluginAsync } from 'fastify'
import crypto from 'crypto'

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/wa-cloud', async (request, reply) => {
    const q = request.query as Record<string, string>
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === process.env.META_WA_WEBHOOK_VERIFY_TOKEN) {
      return reply.send(q['hub.challenge'])
    }
    return reply.code(403).send({ error: 'Verification failed' })
  })

  fastify.post('/wa-cloud', {
    config: { rawBody: true },   // butuh raw body buat verifikasi signature, bukan yang udah di-parse Fastify
  }, async (request, reply) => {
    const signature = request.headers['x-hub-signature-256'] as string | undefined
    const rawBody = (request as any).rawBody as string

    if (!verifySignature(rawBody, signature)) {
      return reply.code(401).send({ error: 'Invalid signature' })
    }
    // TODO: proses payload status delivered/read/failed
    return reply.send({ status: 'ok' })
  })
}

function verifySignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature || !process.env.META_WA_APP_SECRET) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', process.env.META_WA_APP_SECRET).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export default webhookRoutes
```

Catatan: Fastify butuh plugin `@fastify/raw-body` (tambahkan ke npm install Phase 0) supaya `request.rawBody` tersedia — signature Meta dihitung dari raw bytes, bukan hasil `JSON.parse()`.

### 08.2 Aturan Baru (tambahan dari RULE-001 s.d. RULE-013 di Section 0.3)

```
RULE-014: SETIAP endpoint yang mutasi data (POST/PATCH/DELETE) WAJIB preHandler fastify.authenticate,
          KECUALI /auth/register, /auth/login, /webhooks/*, dan endpoint publik yang eksplisit
          didaftarkan (misal GET /news untuk halaman publik).
RULE-015: Frontend TIDAK PERNAH nyimpen access_token/refresh_token di localStorage/sessionStorage —
          harus httpOnly cookie doang. Ini nyegah XSS curi token.
RULE-016: Semua endpoint publik (GET /news, GET /about, dll) TETAP di apps/api dengan route terpisah,
          TIDAK PAKAI preHandler authenticate, tapi TETAP lewat REST, bukan Prisma langsung dari
          Server Component Next.js.

CONSTRAINT-013: JANGAN generate Prisma Client di apps/web. Prisma Client cuma boleh ke-generate
                dan ke-import di apps/api.
CONSTRAINT-014: CORS di backend HARUS whitelist FRONTEND_URL doang (@fastify/cors origin config),
                jangan wildcard '*' karena cookie credentials butuh origin eksplisit.
CONSTRAINT-015: WebSocket handshake WAJIB verifikasi JWT dari cookie sebelum accept koneksi,
                sama kayak REST endpoint yang protected.
```

---

## SECTION 09: DEPLOYMENT

```
FRONTEND (apps/web)  → Vercel, root directory di-set ke apps/web, env BACKEND_URL isi URL production Render
BACKEND (apps/api)    → Render free web service, root directory apps/api, build: npm run build, start: npm start
DATABASE              → Neon, copy connection string ke DATABASE_URL Render
FILE STORAGE           → Cloudflare R2, dua bucket (public custom domain + private)
KEEP-ALIVE             → Render free tier sleep abis 15 menit idle. Reuse GitHub Actions dari v3.0 Pattern 13,
                          ganti URL target ke GET https://<backend>.onrender.com/cron/keep-alive tiap 10 menit.

DEPLOY CHECKLIST:
[ ] Vercel: root directory = apps/web, env vars ke-set
[ ] Render: root directory = apps/api, env vars ke-set (termasuk DATABASE_URL dari Neon)
[ ] npx prisma migrate deploy dijalanin di Render (build command atau manual sekali)
[ ] CORS origin di backend = domain Vercel production
[ ] R2 custom domain public bucket udah aktif dan DNS ke-propagate
[ ] Meta WA Webhook URL diupdate ke https://<backend>.onrender.com/webhooks/wa-cloud
[ ] GitHub Actions keep-alive secrets di-update (URL berubah dari Vercel ke Render)
```

---

**END OF DOCUMENT v4.0**

> Dokumen ini MENGGANTIKAN PRD v3.0 dan Addendum v3.1 sepenuhnya. Kalau ada bagian v3.0 yang
> ke-refer tapi gak disebut ulang di sini (misal detail UI kanban drag-drop, formula skor performa,
> style TipTap editor), itu artinya TIDAK BERUBAH — tetap ikuti spek v3.0 yang lama, cuma
> sumber data-nya diganti dari Supabase client ke fetch API sesuai pattern di dokumen ini.
> Version: 4.0 | Author: Hamin
