# 剪紙（名稱待定）

學生剪紙教學網站，保留紙色／朱紅視覺風格，使用從紙邊開始的連續刀線。

公開網址：https://chilinbpscth.github.io/papercut-ar/

## 開發及建置

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite base 是 `/papercut-ar/`。`dist/` 為 GitHub Pages 靜態成品，發布到 `gh-pages`。
公開站直接進入，不包含本機 Python 測試伺服器或密碼。

## 教學

1. 對稱花瓣：弧線及八份對稱。
2. 柳葉紋團花：折剪鏤空、保留連接的紅紙。
3. 鋸齒紋窗花：轉角與花邊節奏。
4. 團圓窗花：花瓣、柳葉孔及中心孔的綜合運用。

每課有目標圖、逐步引導、即時預覽、思考題，以及直接顯示的文化小知識與來源。學生用語已簡化，步驟間按「下一步」。

## 結構

- `index.html`：目前介面與 SVG 渲染。
- `public/cut-geometry.js`：刀線分割多邊形。
- `public/scissors.js`：手勢、教學進度、即時預覽。
- `public/lessons.js`：課程、目標圖及文化來源。
- `public/rotation-controls.js`：AR 角度球、旋轉及擺放快捷鍵。
- `public/ar.js`、`public/ar-live.js`、`public/vendor/`：3D 模型輸出與 AR。
- `src/` 及舊 `.test.js`：先前版本的實作與回歸測試，保留作歷史參考；目前入口不載入。

## 驗證與限制

新版本 19 項幾何／互動／旋轉控制測試通過；桌面已實剪第四課全部三步並展開，3D 花形生成亦已驗證。
支援不交叉刀線，保留较大紙塊。手機觸控、AR 追蹤及拍照仍待實機驗證；AR 提供角度球、360° 自轉及「貼牆 90°」快捷鍵，需手動對齊牆面，尚未自動辨識牆面法線。
文化課是傳統元素的數碼練習，不代表完整掌握特定非遺流派技法。

基礎前端與 AR 資源來自 https://papercut-poc.pages.dev/ （2026-09-12）；保留原始授權聲明。`source-manifest.json` 記錄原站下載基準。原站的一個可選 worker 引用回傳 HTML，未作 worker 複製，詳見 manifest。沒有承諾所有引擎可選路徑可離線使用。
