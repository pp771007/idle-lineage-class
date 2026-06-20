// Cloudflare Worker:定時打 GitHub workflow_dispatch,觸發 sync-upstream.yml。
// 取代 GitHub 內建 schedule(後者排隊常延遲一兩小時);本 Worker 的 Cron Trigger 準時很多。
//
// 設定:
//   - 觸發目標 repo / workflow / ref 在 wrangler.toml 的 [vars]
//   - GitHub PAT 用 `wrangler secret put GH_PAT`(fine-grained,給該 repo 的 Actions: Read and write)
//   - 觸發頻率在 wrangler.toml 的 [triggers] crons
//
// 只靠 Cron Trigger 跑、不對外開網址(wrangler.toml workers_dev=false),故無 fetch handler。
// 要手動驗證觸發:用 `gh api ... /dispatches` 打一次;看執行紀錄:`wrangler tail sync-trigger`。

async function dispatch(env) {
  const repo = env.GH_REPO;
  const workflow = env.GH_WORKFLOW;
  const ref = env.GH_REF || "main";
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GH_PAT}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cf-sync-trigger",
    },
    body: JSON.stringify({ ref }),
  });

  // 成功時 GitHub 回 204 No Content。
  if (res.status === 204) {
    console.log(`workflow_dispatch ok: ${repo} ${workflow}@${ref}`);
  } else {
    const text = await res.text();
    console.error(`workflow_dispatch failed: ${res.status} ${text}`);
  }
}

export default {
  // Cron Trigger 進入點
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatch(env));
  },
};
