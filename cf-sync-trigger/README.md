# sync-trigger — Cloudflare Worker

定時打 GitHub `workflow_dispatch`,觸發本 repo 的 `.github/workflows/sync-upstream.yml`。

## 為什麼

GitHub Actions 的 `schedule:` 是「盡力而為、不保證準時」,整點附近排隊常延遲 1~2 小時。
改由 Cloudflare Worker 的 Cron Trigger(誤差數秒~十幾秒)定時呼叫 `workflow_dispatch`,
就能準時觸發同步;`sync-upstream.yml` 本體不用改。

## 設定 / 部署

```bash
cd cf-sync-trigger

# 1. 放入 GitHub PAT(fine-grained:對該 repo 開 Actions = Read and write)
npx wrangler secret put GH_PAT

# 2. 部署(會一起建立 Cron Trigger)
npx wrangler deploy
```

觸發目標 repo / workflow / 分支與頻率都在 `wrangler.toml` 改。

## 手動測試

本 Worker 設了 `workers_dev = false`(只靠 Cron Trigger 跑、不開公開網址),
所以沒有可直接開的 URL。要手動驗證觸發,直接用 PAT 打一次 GitHub 即可:

```bash
gh api --method POST -H "Accept: application/vnd.github+json" \
  /repos/pp771007/idle-lineage-class/actions/workflows/sync-upstream.yml/dispatches -f ref=main
```

回 204 代表 dispatch 成功;到 GitHub Actions 頁可看到一筆 `workflow_dispatch` 的 run。
要看 Worker 本身的執行紀錄:`npx wrangler tail sync-trigger`。

## 注意

- fine-grained PAT 最長一年到期,**過期會默默不跑**,記得設提醒更新後重跑 `wrangler secret put GH_PAT`。
- `sync-upstream.yml` 只留 `workflow_dispatch`(無 `schedule:`),定時完全靠本 Worker;Worker 沒部署或 PAT 過期
  就等於自動同步停擺,只能手動觸發。
- Cron 時間是 UTC,沒有時區設定可調;台灣時間要減 8 小時換算(現行 `20 10 * * *` = 台灣 18:20)。
