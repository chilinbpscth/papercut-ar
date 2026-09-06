# papercut-ar

視藝科剪紙對稱教學應用（學校自維護版）

Live：https://chilinbpscth.github.io/papercut-ar/

## v20260906-heavy

對齊原裝 POC 課堂手感（唔抄源碼、唔用 8th Wall）：

- 展開改用 **n 份交替鏡射**：偶數格旋轉、奇數格 `R((i+1)θ) ∘ 垂直鏡像`，唔再叠返同一格
- 小「展開」搬去**左下角**，唔遮右上亮格
- 圍圈放手＝豆／葉形窿；一劃＝剪一刀
- 可切換「交替鏡射／淨旋轉」
- 示範／印章收喺「更多工具」
- Header 有版號，硬 refresh 後應見到 `v20260906-heavy`

## 本機

```bash
npm i
npm run dev
```

GitHub Pages：`base: '/papercut-ar/'`，build 後把 `dist/` 推去 `gh-pages`。
