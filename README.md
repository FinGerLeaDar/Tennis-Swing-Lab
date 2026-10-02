# 🎾 Tennis Swing Lab V1.1

## 這版修正

V1.1 針對第一輪 GitHub Pages 測試加入：

- AI loading 狀態
- GPU → CPU 自動 fallback
- AI 載入錯誤提示
- Retry 按鈕
- 影片選擇後自動啟用分析
- MediaPipe VIDEO mode 使用遞增 timestamp
- 保持影片 local-first，不把影片上傳到 GitHub/backend

## 檔案

- `index.html`
- `app.js`
- `style.css`
- `README.md`

## GitHub Pages

將 4 個檔案放入 repository root，然後：

`Settings → Pages → Deploy from a branch → main / root`

## 注意

MediaPipe runtime 與 Pose Landmarker model 目前由 CDN / Google-hosted model 載入，所以第一次使用需要 Internet。

影片本身由瀏覽器的 local File / HTMLVideoElement 讀取，不會 POST 到你的 GitHub repository。

## 第一輪測試

建議先用：

- 720 × 1280
- 約 24 秒
- 3.2 MB
- 30 FPS

的測試片。

先選影片，確認右上角變成：

`● AI Ready · GPU`

或者：

`● AI Ready · CPU`

之後按：

`🧠 開始分析`

## V1.1 尚未包括

- 球拍偵測
- 網球偵測
- Contact Point
- Racket Path
- Ball Path
- Racket Speed
- 專業教練級評分

下一階段才加入以上功能。
