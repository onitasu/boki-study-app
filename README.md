# 簿記2級 学習チェック（商業簿記＋工業簿記） + AIフラッシュカード

Supabase（認証＋DB） + Next.js（App Router） + React + MUI の Web アプリです。

- **商業簿記**：テーマ00〜24
- **工業簿記**：テーマ01〜22（＋複合問題編）
- 問題集の目次（開始ページ）をメタ情報として保持し、タスク表示に `問題集 pXX〜` を出します。
- **AIフラッシュカード**：テキスト写真＋自分メモを送ると、OpenAI API で「問題文/ヒント/回答/解説」を自動生成してカード化します。

## できること（MVP）
- ログイン / 新規登録（Supabase Auth）
- 開始日・試験日・1日の学習時間（分）を入力 → 自動で学習計画を生成
- 「今日のタスク」：チェック（完了/未完）+ 実績時間/メモ記録
- 「計画」：直近のタスク一覧
- 「テーマ」：テーマ別進捗（テキスト/問題集タスクの完了数）
- 「カード」：
  - 画像＋メモからカード生成（OpenAI API）
  - 未理解/理解済みの切替、理解した/まだ のトグル
  - カード削除（完全削除）

> 注意: ネイティブ通知は使わず、iPhone「時計」アプリのアラームを推奨しています。

---

## セットアップ手順

### 1) Supabase プロジェクト作成
- Supabaseで新規プロジェクトを作成
- Authで Email/Password を有効化（開発中は Email confirmation をOFFにすると楽）

### 2) DBマイグレーション（SQL Editor）
Supabase の SQL Editor で、以下の SQL を **順番に** 実行してください。

1. `supabase/migrations/20251228090000_init.sql`
   - plans / themes / tasks 等のスキーマ + テーマseed
2. `supabase/migrations/20251228093000_flashcards.sql`
   - flashcard_decks / flashcards（RLS含む）
3. `supabase/migrations/20251228100000_flashcard_folders.sql`
   - flashcard_folders + deckへのfolder_id追加

### 3) Storage（画像アップロード用）
Supabase の SQL Editor で以下の SQL を実行し、画像保存用バケットとポリシーを作成してください。

- `supabase/migrations/20251228094000_flashcard_images_storage.sql`
  - `flashcard-images` バケット + ownerベースのRLS

### 4) 環境変数（.env.local）
`.env.local.example` をコピーして `.env.local` を作り、値を入れてください。

必須:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`

任意:
- `OPENAI_MODEL`（デフォルト: `gpt-4o-mini`）

### 5) 起動
```bash
npm install
npm run dev
```

---

## OpenAI について
- 画像（テキスト写真）とユーザーのメモを入力にして、JSONスキーマに厳密準拠したカードを生成します。
- 著作権配慮のため、教材本文をそのまま長文で出力しないよう、プロンプト側で抑制しています。

---

## フォルダ構成
- `src/app` … Next.js App Router
- `src/components` … MUI UI コンポーネント
- `src/lib/planner` … 学習計画生成ロジック
- `supabase/migrations` … DBスキーマ + テーマseed

---

## ライセンス
社内/個人利用を想定（必要なら追記してください）。
