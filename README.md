# 私人日誌（Journal App）

個人私有的雲端日誌系統。Phase 1 已完成：基本日誌 CRUD、Magic Link 登入、月份日曆瀏覽、PWA 基本設定。

> 完整規劃見根目錄上層的 `private-journal-spec.md`。

---

## 技術棧

- **Next.js 14**（App Router）+ TypeScript + Tailwind CSS
- **Supabase**（Auth + PostgreSQL + RLS）
- **Tiptap**（富文字編輯器，自動儲存 debounce 2 秒）
- **shadcn/ui** 風格元件（Radix + cva）
- **PWA**：可安裝至手機桌面

---

## 目錄結構

```
journal-app/
├── app/
│   ├── (auth)/login/                Magic Link 登入頁
│   ├── (app)/                       已登入區域（共用 layout）
│   │   ├── page.tsx                 → 自動轉向 /journal/{今天}
│   │   ├── journal/[date]/          指定日期日誌（編輯器主頁）
│   │   ├── timeline/                月曆 + 最近日誌清單
│   │   ├── gallery/ stats/ settings/  其他分頁（Phase 1 為 stub）
│   ├── auth/callback/               Supabase OAuth callback
│   ├── api/entries/                 GET 取得 / 月份；POST upsert
│   └── api/entries/[id]/            DELETE
├── components/
│   ├── editor/                      JournalEditor、MoodSelector、TagInput
│   ├── timeline/CalendarView.tsx
│   ├── ui/                          shadcn 風格元件
│   └── Nav.tsx                      Sidebar + BottomTabs
├── lib/
│   ├── supabase/{client,server,middleware}.ts
│   └── utils.ts
├── types/index.ts
├── supabase/migrations/0001_initial.sql
├── middleware.ts                    Session refresh + 未登入轉向
└── public/manifest.json             PWA
```

---

## 首次啟動

### 1. 環境變數

`.env.local` 已預先填入 Supabase URL 與 keys。如需重新建立可參考 `.env.example`：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

⚠️ `service_role` key 絕不能暴露於前端或 commit 到 git。

### 2. 跑 Supabase Migration

到 Supabase 後台 → 左側 **SQL Editor** → **New query** → 貼上 `supabase/migrations/0001_initial.sql` → Run。

這會建立以下資料表並啟用 Row Level Security：
- `journal_entries`、`voice_memos`、`journal_photos`、`google_photos_auth`、`quick_notes`

### 3. 設定 Auth URL（本地開發）

到 Supabase **Authentication → URL Configuration**：
- **Site URL**：`http://localhost:3000`
- **Redirect URLs**：加入 `http://localhost:3000/auth/callback`，部署後再加上正式網址

### 4. 啟動開發伺服器

```bash
npm install   # 第一次
npm run dev
```

打開 http://localhost:3000 → 會被導到登入頁 → 輸入 Email → 收信點連結 → 自動進入「今天」的編輯器。

---

## Phase 1 已實作

- [x] Supabase Auth（Magic Link）+ middleware 自動轉向
- [x] 今日日誌編輯器（Tiptap）
- [x] 自動儲存（debounce 2 秒，狀態指示「儲存中／已儲存／失敗」）
- [x] 字數即時統計
- [x] 心情選擇器（1–5）+ 預設情緒標籤 + 自訂標籤
- [x] 月份日曆（顯示有寫日誌的日子 + 當日心情 emoji）
- [x] 最近日誌清單
- [x] 桌機側邊欄 / 手機底部 tabs
- [x] 日期前後切換、不能寫未來
- [x] PWA manifest（icons 需自行補上 `public/icon-192.png`、`public/icon-512.png`）

## 接下來（Phase 2–5）

- Phase 2：語音錄音 + Whisper API、照片上傳、Google Photos 整合
- Phase 3：全文搜尋、Recharts 統計圖表
- Phase 4：Claude AI 摘要、年度回顧
- Phase 5：離線同步、推播通知、深色模式、匯出 PDF

---

## 開發備註

- `app/(app)/layout.tsx` 是已登入區域的 root layout，做 server-side auth check；middleware 也會擋未登入。
- `lib/supabase/server.ts` 用於 Server Components 與 API Routes，會自動帶 user JWT，所以查詢會被 RLS 過濾。
- Tiptap 內容存兩份：`content`（plain text，用於字數/搜尋）、`content_html`（富文字渲染）。
- 自動儲存會在 unmount 時 flush 一次 pending 變更。

## 部署

Vercel + Supabase Cloud：

1. `git push` 到 GitHub
2. Vercel Import → 設定環境變數（同 `.env.local`）
3. 拿到 Vercel 網址後，更新 Supabase **URL Configuration** 的 Redirect URLs
