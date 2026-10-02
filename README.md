# Tennis Swing Lab V1.4

這一版重點不是增加更多功能，而是**真正驗證 AI 是否有成功載入及推理**。

## V1.4 改動

- MediaPipe Library 狀態
- WASM Runtime 狀態
- Pose Model 狀態
- GPU → CPU fallback
- 真正的 AI Ready 狀態
- 真正單 frame Pose test
- 清楚顯示初始化錯誤
- Retry AI initialization
- 選擇本機影片後才啟用分析
- 24 秒 / 720×1280 / 30 FPS 影片可直接測試
- 15 / 24 / 30 FPS analysis
- 640 / 960 / 1280px analysis setting
- 33 pose landmarks
- 基本關節角度

## GitHub Pages

只需要把以下 4 個檔案放入 GitHub Pages repository：

- index.html
- app.js
- style.css
- README.md

不需要上傳影片到 GitHub。

影片由瀏覽器使用本機 File API 讀取，Pose inference 在瀏覽器內進行。

## 測試順序

1. 開 GitHub Pages
2. Ctrl + F5
3. 先看 AI Engine Diagnostics
4. 必須看到 `AI Ready · GPU` 或 `AI Ready · CPU`
5. 再選擇你的 24 秒影片
6. 按 `開始分析`
7. 最後 Real Test 應顯示類似 `✓ 576/576 frames`

如果不是 Ready，請把頁面上的紅色完整錯誤訊息 screenshot 貼回來。


## V1.4
- Dynamic import AI library，避免 module import 失敗令整個 app 靜默停止。
- jsDelivr ESM + unpkg fallback。
- Library / WASM / Model / Delegate 每一層獨立顯示狀態。
- 如果載入失敗，頁面直接顯示真正錯誤。


## V1.4
- 改用 Google 官方 Web guide 所示的 `vision_bundle.mjs` exact file 優先載入。
- CDN fallback 保留。
- 失敗時一次列出所有 CDN 的實際錯誤，避免只看到最後一個錯誤。
