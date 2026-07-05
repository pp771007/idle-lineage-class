背景音樂資料夾 (Background Music / BGM)
=======================================

把音樂檔放在這個資料夾，遊戲會依「場景」自動播放並交叉淡入淡出。
The BGM engine (js/17-audio.js) auto-plays a looping track per scene, with crossfade.

支援格式 / formats: .mp3 (建議/preferred) · .ogg
  ⚠️ 不要用 .wav 當背景音樂——一首歌的 WAV 會是幾十 MB，打包檔會爆肥。請用 mp3/ogg（壓縮）。

場景與檔名 / scenes (檔名固定，副檔名 mp3 或 ogg 擇一):

  title.mp3     登入／選存檔畫面 (login / slot select)
  create.mp3    創角畫面 (character creation) ★新增
  town.mp3      共通城鎮、安全區（下列專屬城鎮以外的所有安全區）
  battle.mp3    野外戰鬥 (normal field combat)
  boss.mp3      頭目戰 (boss fight)

專屬城鎮 BGM（檔名＝城鎮代號；沒放就自動用 town.mp3）/ per-town tracks:

  town_silent.mp3        沉默洞穴
  town_ivory_tower.mp3   象牙塔（1~3樓安全區）
  town_talking.mp3       說話之島村莊
  town_kent_castle.mp3   肯特村（肯特城）
  town_elf.mp3           妖精森林
  town_giran.mp3         奇岩村
  town_heine.mp3         海音
  town_aden.mp3          亞丁
  town_oren.mp3          歐瑞村
  town_gludio.mp3        燃柳村
  town_silver_knight.mp3 銀騎士村莊
  town_witon.mp3         威頓村
  town_pride.mp3         傲慢之塔（入口）
  town_windwood_castle.mp3 風木城堡

  ※ 其餘城鎮（海音城／席琳神殿／希培利亞／貝希摩斯／炎魔謁見所／海賊島村莊／時空裂痕）= 共通 town.mp3。

規則 / behavior:
- 音樂會「無限循環」，切換場景時 1 秒交叉淡化。
- 某場景「沒有放音檔」→ 維持目前正在播的曲目（不會中斷或變安靜）。
  例：只放 town.mp3 + battle.mp3，頭目戰時會延續戰鬥音樂。
- 音量／開關在遊戲內「自動化設定 → 🎵 背景音樂」調整（與戰鬥音效分開）。
- 首次點擊後才會開始播（瀏覽器規定；遊戲本來就要點擊進入，無感）。
- 加好檔案後：網頁版 Ctrl+Shift+R 重新整理；打包版需重新打包 (npm run pack)。
