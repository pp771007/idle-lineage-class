// sheet-upload.mjs — 用 Google 服務帳戶把 xlsx 蓋回雲端硬碟上的同一個檔案(網址不變)
//
//   GDRIVE_SA_KEY='<服務帳戶 JSON 全文>' node scripts/sheet-upload.mjs <檔案.xlsx>
//
// 檔案 ID 取自 sheet-config.json 的 googleSheet 網址(上傳到雲端硬碟的 xlsx,網址裡那段就是檔案 ID)。
// 服務帳戶要先被「共用」成那個檔案的編輯者。金鑰只從環境變數讀(GitHub Secrets),絕不寫進 repo。
// 不用任何套件:JWT 用 node:crypto 自己簽,換 access token 後直接打 Drive API。
import fs from 'node:fs';
import crypto from 'node:crypto';
import { CONFIG } from './sheet-lib.mjs';

const file = process.argv[2];
const raw = process.env.GDRIVE_SA_KEY;
if (!file || !raw) { console.error('用法:GDRIVE_SA_KEY=... node scripts/sheet-upload.mjs <檔案.xlsx>'); process.exit(1); }
let key;
try { key = JSON.parse(raw); } catch { console.error('GDRIVE_SA_KEY 不是有效的 JSON:請把下載的 .json 檔整份內容貼進 GitHub Secrets。'); process.exit(1); }
const id = (String(JSON.parse(fs.readFileSync(CONFIG, 'utf8')).googleSheet || '').match(/\/d\/([\w-]{20,})/) || [])[1];
if (!id) { console.error('sheet-config.json 裡沒有試算表網址。'); process.exit(1); }

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: key.client_email, scope: 'https://www.googleapis.com/auth/drive',
  aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600,
});
const jwt = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), key.private_key).toString('base64url');

const tok = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
}).then(r => r.json());
if (!tok.access_token) { console.error('Google 登入失敗:', tok.error_description || tok.error || tok); process.exit(1); }

const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&supportsAllDrives=true`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  body: fs.readFileSync(file),
});
if (!res.ok) {
  const t = await res.text();
  const hint = res.status === 404 || res.status === 403
    ? `\n→ 多半是試算表還沒「共用」給 ${key.client_email}(權限要選「編輯者」)。` : '';
  console.error(`上傳到雲端硬碟失敗(${res.status}):${t.slice(0, 300)}${hint}`);
  process.exit(1);
}
console.log('✅ 已更新雲端硬碟上的試算表(網址不變)。');
