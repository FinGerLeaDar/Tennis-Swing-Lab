# 🎾 Tennis Swing Lab V1

一個以 GitHub Pages 為目標的本機優先（local-first）網球動作分析 Web App。

## V1 功能

- Upload 本機網球影片
- 原始影片不會上傳到 GitHub / backend
- MediaPipe Pose Landmarker
- 人體 33 點 skeleton
- 逐格分析
- Forehand / Backhand / Serve / Other 選擇
- 15 / 24 / 30 FPS 分析選擇
- 640 / 960 / 1280px 分析寬度選擇
- 肩膀、手肘、膝等角度
- Slow motion
- Timeline
- Desktop / mobile responsive UI

## GitHub Pages 部署

1. 建立一個新的 GitHub repository。
2. 上傳：
   - `index.html`
   - `app.js`
   - `style.css`
   - `README.md`
3. Repository → **Settings** → **Pages**
4. Source 選 **Deploy from a branch**
5. Branch 選 `main` / root
6. Save
7. 等待 GitHub Pages 建立網站。

## 重要：影片處理方式

影片使用瀏覽器的 local `File` / `HTMLVideoElement` 讀取。

這個 V1 **沒有把影片 POST 到任何 server**。

GitHub Pages 只負責提供網站檔案及載入前端 AI runtime/model。

因此，即使手機影片是 1GB，亦不是先上傳 1GB 到 GitHub 再分析。

## AI 模型

V1 使用 MediaPipe Tasks Vision 的 Pose Landmarker。

模型與 WASM runtime 目前由 jsDelivr / Google-hosted model URL 載入，因此第一次開啟網站需要 Internet。

如日後要做到完全離線，可以把相應 runtime/model 放入 repository 或改用其他本地部署方式。

## V1 的限制

人體姿勢分析是第一階段。

目前**未正式加入**：

- Tennis racket detection
- Tennis ball detection
- 精確 contact point
- racket-head speed
- ball speed
- 3D biomechanical reconstruction
- 專業教練級動作評分

這些會放在 V2+。

## 拍攝建議

- 手機固定
- 全身入鏡
- 球拍盡量清楚
- 側面或約 45° 視角
- 60fps 優先
- 先用 10–30 秒短片測試

## 下一步

V2 建議加入：

1. Racket tracking
2. Ball tracking
3. Contact point
4. Swing path
5. 自動分辨 Forehand / Backhand / Serve
6. 動作 phase detection
7. 多次 swing comparison
