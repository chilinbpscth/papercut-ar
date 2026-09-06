const SIZE = 640
let PAPER = "#f7efe2"
const TABLE = "#c4a574" // shows through cuts
const GOLD = "#d4a017"
const VERMILION = "#c41e3a"
const APP_VERSION = "v20260906-heavy"

export function createPapercutApp(root) {
  const state = {
    step: "shape",
    shape: "square",
    folds: 2,
    sectors: 4,
    drawing: false,
    last: null,
    brush: 22,
    mode: "cut", // cut | restore | stamp
    stamp: "circle", // circle | triangle | diamond
    strokePts: [], // live path for closed cutout
    history: [],
    showLivePreview: true,
    unfoldT: 1, // 0..1 animated unfold
    paperTone: "#f7efe2",
    symmetryMode: "alt-mirror", // alt-mirror | rotate
  }

  const wedge = document.createElement("canvas")
  wedge.width = SIZE
  wedge.height = SIZE
  const wctx = wedge.getContext("2d", { willReadFrequently: true })

  root.innerHTML = `
    <div class="app" data-app="papercut">
      <header class="app-header">
        <div>
          <h1>剪紙 · 對稱創作</h1>
          <p>一格剪完，按摺痕幾何展開成窗花／團花——唔係 AI 評分</p>
        </div>
        <span class="ver-chip" title="硬 refresh 後應見到呢個版號">${APP_VERSION}</span>
      </header>
      <details class="tip-card" open>
        <summary>課堂 5 分鐘點用</summary>
        <ol>
          <li>選圓形或方形</li>
          <li>摺 2～3 次（夠對稱又唔難）</li>
          <li>喺亮格圍一圈放手＝封閉剪口，或印章打窿</li>
          <li>左下角睇小「展開」，再撳「預覽成品」</li>
          <li>展開睇落會密好多、同單格唔一樣——呢個就係摺紙對稱，電腦冇改你剪嘅形</li>
        </ol>
      </details>
      <div class="panel">
        <div class="steps" id="steps"></div>
        <div id="controls"></div>
        <div class="stage-row" id="stageRow">
          <div class="stage tilt-wrap" id="tiltWrap">
            <canvas id="view" width="${SIZE}" height="${SIZE}" role="img" aria-label="剪紙畫布"></canvas>
            <div class="preview-stage mini hidden" id="previewWrap">
              <div class="preview-label" id="previewLabel">展開</div>
              <canvas id="preview" width="${SIZE}" height="${SIZE}" role="img" aria-label="展開預覽"></canvas>
              <div class="preview-caption">幾何展開 · 唔係評分</div>
            </div>
          </div>
        </div>
        <p class="hint" id="hint"></p>
        <div class="row" id="actions"></div>
      </div>
    </div>
  `

  const view = root.querySelector("#view")
  const preview = root.querySelector("#preview")
  const previewWrap = root.querySelector("#previewWrap")
  const tiltWrap = root.querySelector("#tiltWrap")
  const vctx = view.getContext("2d")
  const pctx = preview.getContext("2d")
  const stepsEl = root.querySelector("#steps")
  const controls = root.querySelector("#controls")
  const actions = root.querySelector("#actions")
  const hint = root.querySelector("#hint")
  const tipCard = root.querySelector(".tip-card")

  function sectorsFromFolds(folds) { return 2 ** folds }

  function clipPaper(ctx) {
    ctx.beginPath()
    if (state.shape === "circle") ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.46, 0, Math.PI * 2)
    else {
      const m = SIZE * 0.08
      ctx.rect(m, m, SIZE - m * 2, SIZE - m * 2)
    }
    ctx.clip()
  }

  function clipSector(ctx, n, mirror = false) {
    const cx = SIZE / 2, cy = SIZE / 2
    const a0 = -Math.PI / 2
    const a1 = a0 + (Math.PI * 2) / n
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    if (!mirror) ctx.arc(cx, cy, SIZE, a0, a1)
    else ctx.arc(cx, cy, SIZE, a0, a0 - (Math.PI * 2) / n, true)
    ctx.closePath()
    ctx.clip()
  }

  function resetWedge() {
    PAPER = state.paperTone || "#f7efe2"
    wctx.clearRect(0, 0, SIZE, SIZE)
    wctx.save()
    clipSector(wctx, state.sectors)
    clipPaper(wctx)
    wctx.fillStyle = PAPER
    wctx.fillRect(0, 0, SIZE, SIZE)
    wctx.restore()
    state.history = []
  }

  function snapshot() {
    state.history.push(wedge.toDataURL("image/png"))
    if (state.history.length > 24) state.history.shift()
  }

  function applyDemoPattern(kind) {
    snapshot()
    resetWedge()
    // ignore reset clearing history first entry — re-snapshot base
    state.history = []
    snapshot()
    wctx.save()
    clipSector(wctx, state.sectors)
    clipPaper(wctx)
    wctx.globalCompositeOperation = "destination-out"
    wctx.fillStyle = "#000"
    wctx.strokeStyle = "#000"
    wctx.lineCap = "round"
    wctx.lineJoin = "round"
    const cx = SIZE / 2, cy = SIZE / 2
    const n = state.sectors
    const mid = -Math.PI / 2 + Math.PI / n
    const rx = Math.cos(mid), ry = Math.sin(mid)
    if (kind === "petal") {
      for (let i = 0; i < 3; i++) {
        const d = SIZE * (0.18 + i * 0.1)
        wctx.beginPath()
        wctx.ellipse(cx + rx * d, cy + ry * d, SIZE * 0.045, SIZE * 0.08, mid, 0, Math.PI * 2)
        wctx.fill()
      }
    } else if (kind === "edge") {
      wctx.lineWidth = 16
      for (let i = 0; i < 4; i++) {
        const t = 0.35 + i * 0.12
        const x = cx + Math.cos(mid) * SIZE * t
        const y = cy + Math.sin(mid) * SIZE * t
        wctx.beginPath()
        wctx.moveTo(x - Math.sin(mid) * 28, y + Math.cos(mid) * 28)
        wctx.lineTo(x + Math.sin(mid) * 28, y - Math.cos(mid) * 28)
        wctx.stroke()
      }
    } else if (kind === "star") { // star notches near rim
      wctx.lineWidth = 14
      const a0 = -Math.PI / 2
      const a1 = a0 + (Math.PI * 2) / n
      for (let i = 0; i < 5; i++) {
        const a = a0 + (a1 - a0) * (0.15 + i * 0.15)
        const x = cx + Math.cos(a) * SIZE * 0.4
        const y = cy + Math.sin(a) * SIZE * 0.4
        wctx.beginPath()
        wctx.arc(x, y, 12 + (i % 2) * 6, 0, Math.PI * 2)
        wctx.fill()
      }
    } else if (kind === "heart") {
      const hx = cx + rx * SIZE * 0.28
      const hy = cy + ry * SIZE * 0.28
      const s = SIZE * 0.055
      wctx.beginPath()
      wctx.moveTo(hx, hy + s * 0.9)
      wctx.bezierCurveTo(hx - s * 1.4, hy - s * 0.1, hx - s * 0.55, hy - s * 1.15, hx, hy - s * 0.35)
      wctx.bezierCurveTo(hx + s * 0.55, hy - s * 1.15, hx + s * 1.4, hy - s * 0.1, hx, hy + s * 0.9)
      wctx.fill()
      wctx.beginPath()
      wctx.arc(cx + rx * SIZE * 0.14, cy + ry * SIZE * 0.14, 8, 0, Math.PI * 2)
      wctx.fill()
    } else if (kind === "lattice") {
      wctx.lineWidth = 12
      for (let i = 0; i < 3; i++) {
        const tt = 0.22 + i * 0.12
        const x0 = cx + Math.cos(mid - 0.18) * SIZE * tt
        const y0 = cy + Math.sin(mid - 0.18) * SIZE * tt
        const x1 = cx + Math.cos(mid + 0.18) * SIZE * tt
        const y1 = cy + Math.sin(mid + 0.18) * SIZE * tt
        wctx.beginPath()
        wctx.moveTo(x0, y0)
        wctx.lineTo(x1, y1)
        wctx.stroke()
      }
      wctx.lineWidth = 18
      wctx.beginPath()
      wctx.arc(cx, cy, SIZE * 0.38, mid - 0.22, mid + 0.22)
      wctx.stroke()
    } else if (kind === "snow") {
      wctx.beginPath()
      wctx.arc(cx + rx * SIZE * 0.12, cy + ry * SIZE * 0.12, 10, 0, Math.PI * 2)
      wctx.fill()
      for (let i = 0; i < 3; i++) {
        const d = SIZE * (0.22 + i * 0.09)
        const x = cx + rx * d, y = cy + ry * d
        const s = 10 + i * 2
        wctx.beginPath()
        wctx.moveTo(x, y - s)
        wctx.lineTo(x + s * 0.7, y)
        wctx.lineTo(x, y + s)
        wctx.lineTo(x - s * 0.7, y)
        wctx.closePath()
        wctx.fill()
      }
    }
    wctx.restore()
  }

  function composeFull(ctx, withShadow = true) {
    ctx.fillStyle = "#efe6d8"
    ctx.fillRect(0, 0, SIZE, SIZE)
    if (withShadow) {
      ctx.save()
      clipPaper(ctx)
      ctx.shadowColor = "rgba(44,36,32,0.28)"
      ctx.shadowBlur = 18
      ctx.shadowOffsetY = 6
      ctx.fillStyle = TABLE
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.restore()
    }
    // table under paper so cuts read as holes
    ctx.save()
    clipPaper(ctx)
    ctx.fillStyle = TABLE
    ctx.fillRect(0, 0, SIZE, SIZE)
    const n = state.sectors
    const cx = SIZE / 2, cy = SIZE / 2
    const u = Math.max(0, Math.min(1, state.unfoldT ?? 1))
    const theta = (Math.PI * 2) / n
    const spread = 0.15 + 0.85 * u
    const altMirror = state.symmetryMode !== "rotate"
    // n copies (not 2n). even = R(iθ); odd = R((i+1)θ)∘M_vertical
    // so adjacent sectors are mirrors and every sector is filled
    const maxI = Math.max(1, Math.round(1 + (n - 1) * u))
    for (let i = 0; i < maxI; i++) {
      ctx.save()
      ctx.translate(cx, cy)
      if (altMirror && i % 2 === 1) {
        ctx.rotate((i + 1) * theta * spread)
        ctx.scale(-1, 1)
      } else {
        ctx.rotate(i * theta * spread)
      }
      ctx.translate(-cx, -cy)
      ctx.globalAlpha = 0.45 + 0.55 * u
      ctx.drawImage(wedge, 0, 0)
      ctx.restore()
    }
    ctx.globalAlpha = 1
    ctx.restore()
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 3
    ctx.beginPath()
    if (state.shape === "circle") ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.46, 0, Math.PI * 2)
    else {
      const m = SIZE * 0.08
      ctx.rect(m, m, SIZE - m * 2, SIZE - m * 2)
    }
    ctx.stroke()
  }

  function drawFoldGuide(ctx) {
    ctx.fillStyle = "#efe6d8"
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.save()
    clipPaper(ctx)
    ctx.fillStyle = TABLE
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.restore()
    // inactive sectors: stacked muted paper so the bright cell reads as the folded pile
    const n = state.sectors, cx = SIZE / 2, cy = SIZE / 2
    for (let i = 1; i < n; i++) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((i * Math.PI * 2) / n)
      ctx.translate(-cx, -cy)
      ctx.save()
      clipSector(ctx, n)
      clipPaper(ctx)
      ctx.fillStyle = i % 2 ? "#e2d2be" : "#eadcc8"
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.restore()
      ctx.restore()
    }
    // fold rays
    ctx.strokeStyle = "rgba(212,160,23,0.7)"
    ctx.lineWidth = 2
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / n
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * SIZE, cy + Math.sin(a) * SIZE)
      ctx.stroke()
    }
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 3
    ctx.beginPath()
    if (state.shape === "circle") ctx.arc(cx, cy, SIZE * 0.46, 0, Math.PI * 2)
    else {
      const m = SIZE * 0.08
      ctx.rect(m, m, SIZE - m * 2, SIZE - m * 2)
    }
    ctx.stroke()
  }

  function renderSteps() {
    const labels = [["shape","1 選紙"],["fold","2 摺紙"],["cut","3 剪裁"],["result","4 展開"]]
    stepsEl.innerHTML = labels.map(([id,t]) => `<span class="${state.step===id?"on":""}">${t}</span>`).join("")
  }

  function renderControls() {
    previewWrap.classList.toggle("hidden", state.step !== "cut" || !state.showLivePreview)
    if (state.step === "shape") {
      controls.innerHTML = `<div class="row"><h2>紙形</h2>
        <button type="button" data-shape="square" class="secondary ${state.shape==="square"?"active":""}">方形（窗花）</button>
        <button type="button" data-shape="circle" class="secondary ${state.shape==="circle"?"active":""}">圓形（團花）</button></div>
        <div class="row"><h2>紙色</h2>
        <button type="button" class="ghost tone" data-tone="#f7efe2" style="background:#f7efe2;color:#2c2420">宣紙</button>
        <button type="button" class="ghost tone" data-tone="#fff8e7" style="background:#fff8e7;color:#2c2420">米黄</button>
        <button type="button" class="ghost tone" data-tone="#f3d9de" style="background:#f3d9de;color:#2c2420">淡粉</button>
        <button type="button" class="ghost tone" data-tone="#dceee6" style="background:#dceee6;color:#2c2420">淡青</button></div>`
      controls.querySelectorAll("[data-shape]").forEach((b) => {
        b.onclick = () => { state.shape = b.dataset.shape; render() }
      })
      controls.querySelectorAll("[data-tone]").forEach((b) => {
        b.onclick = () => { state.paperTone = b.dataset.tone; PAPER = state.paperTone; render() }
        if (b.dataset.tone === state.paperTone) b.classList.add("active")
      })
      hint.textContent = "方形似窗花；圓形似團花。紙色之後剪窿會更易睇。"
      actions.innerHTML = `<button type="button" class="primary" id="next">下一步：摺紙</button>`
      actions.querySelector("#next").onclick = () => { state.step = "fold"; render() }
    } else if (state.step === "fold") {
      const maxFolds = state.shape === "circle" ? 4 : 3
      let opts = ""
      for (let f = 1; f <= maxFolds; f++) {
        const sec = sectorsFromFolds(f)
        opts += `<button type="button" class="secondary ${state.folds===f?"active":""}" data-f="${f}">摺 ${f} 次（${sec} 等份）</button>`
      }
      controls.innerHTML = `<div class="row"><h2>摺幾多次</h2>${opts}</div>`
      controls.querySelectorAll("[data-f]").forEach((b) => {
        b.onclick = () => { state.folds = Number(b.dataset.f); state.sectors = sectorsFromFolds(state.folds); render() }
      })
      hint.textContent = "建議先試「摺 2～3 次」：夠對稱又唔難剪。摺越多，圖案越密。"
      actions.innerHTML = `<button type="button" class="ghost" id="back">上一步</button>
        <button type="button" class="primary" id="next">下一步：開始剪</button>`
      actions.querySelector("#back").onclick = () => { state.step = "shape"; render() }
      actions.querySelector("#next").onclick = () => {
        state.sectors = sectorsFromFolds(state.folds)
        resetWedge(); state.step = "cut"; render()
      }
    } else if (state.step === "cut") {
      const altOn = state.symmetryMode !== "rotate"
      controls.innerHTML = `<div class="row"><h2>工具</h2>
        <button type="button" id="cutBtn" class="${state.mode==="cut"?"primary":"ghost"}">剪刀</button>
        <button type="button" class="ghost" id="undo">復原</button>
        <button type="button" class="ghost" id="clear">全部重來</button></div>
        <div class="row"><h2>對稱</h2>
        <button type="button" id="symAlt" class="${altOn?"primary":"ghost"}">交替鏡射（似真摺紙）</button>
        <button type="button" id="symRot" class="${!altOn?"primary":"ghost"}">淨旋轉（疏啲）</button></div>
        <details class="more-tools">
          <summary>更多工具（印章／示範）</summary>
          <div class="row" style="margin-top:0.5rem">
            <button type="button" id="stampBtn" class="${state.mode==="stamp"?"primary":"ghost"}">印章</button>
            <button type="button" class="ghost" data-stamp="circle">圓孔</button>
            <button type="button" class="ghost" data-stamp="triangle">三角</button>
            <button type="button" class="ghost" data-stamp="diamond">菱形</button>
          </div>
          <div class="row">
            <button type="button" class="secondary" data-demo="petal">花瓣</button>
            <button type="button" class="secondary" data-demo="edge">齒邊</button>
            <button type="button" class="secondary" data-demo="star">星點</button>
            <button type="button" class="secondary" data-demo="heart">心形</button>
            <button type="button" class="secondary" data-demo="lattice">窗格</button>
            <button type="button" class="secondary" data-demo="snow">雪花</button>
          </div>
        </details>`
      controls.querySelector("#cutBtn").onclick = () => { state.mode = "cut"; renderControls(); drawView() }
      const stampBtn = controls.querySelector("#stampBtn")
      if (stampBtn) stampBtn.onclick = () => { state.mode = "stamp"; renderControls(); drawView() }
      controls.querySelector("#undo").onclick = () => {
        const prev = state.history.pop(); if (!prev) return
        const img = new Image()
        img.onload = () => { wctx.clearRect(0,0,SIZE,SIZE); wctx.drawImage(img,0,0); drawView() }
        img.src = prev
      }
      controls.querySelector("#clear").onclick = () => { snapshot(); resetWedge(); drawView() }
      controls.querySelector("#symAlt").onclick = () => { state.symmetryMode = "alt-mirror"; renderControls(); drawView() }
      controls.querySelector("#symRot").onclick = () => { state.symmetryMode = "rotate"; renderControls(); drawView() }
      controls.querySelectorAll("[data-stamp]").forEach((b) => {
        b.onclick = () => { state.stamp = b.dataset.stamp; state.mode = "stamp"; renderControls(); drawView() }
        if (state.mode === "stamp" && b.dataset.stamp === state.stamp) b.classList.add("active")
      })
      controls.querySelectorAll("[data-demo]").forEach((b) => {
        b.onclick = () => { applyDemoPattern(b.dataset.demo); drawView() }
      })
      hint.textContent = state.mode === "stamp"
        ? "喺亮格撳一下打窿。左下角小窗即時按摺數鋪滿成圈（幾何複製，唔係評分）。"
        : "亮格係摺起嗰一叠。圍成圈放手＝豆／葉形窿；輕輕一劃＝剪一刀。左下角係按摺痕複製，同亮格睇落唔同係正常，唔係 AI 判定。"
      actions.innerHTML = `<button type="button" class="ghost" id="back">上一步</button>
        <button type="button" class="primary" id="next">預覽成品</button>`
      actions.querySelector("#back").onclick = () => { state.step = "fold"; render() }
      actions.querySelector("#next").onclick = () => {
        state.step = "result"
        state.unfoldT = 0
        render()
        const t0 = performance.now()
        const dur = 900
        const anim = (now) => {
          if (state.step !== "result") return
          state.unfoldT = Math.min(1, (now - t0) / dur)
          drawView()
          if (state.unfoldT < 1) requestAnimationFrame(anim)
          else { state.unfoldT = 1; drawView() }
        }
        requestAnimationFrame(anim)
      }
    } else {
      controls.innerHTML = `<div class="row"><h2>成品</h2>
        <span style="color:var(--muted)">${state.sectors} 等份對稱 · 可下載或返回再剪</span></div>`
      hint.textContent = `把亮格複製成 ${state.sectors} 等份（${state.symmetryMode === "rotate" ? "淨旋轉" : "隔格鏡射"}）。拖住可轉。夠美就下載貼簿。`
      actions.innerHTML = `<button type="button" class="ghost" id="back">返回再剪</button>
        <button type="button" class="secondary" id="restart">全部重來</button>
        <button type="button" class="secondary" id="cam">相機擺放（簡易）</button>
        <button type="button" class="secondary" id="share">分享</button>
        <button type="button" class="primary" id="dl">下載圖片</button>`
      actions.querySelector("#back").onclick = () => { state.step = "cut"; state.unfoldT = 1; render() }
      actions.querySelector("#restart").onclick = () => {
        state.step = "shape"; state.shape = "square"; state.folds = 2; state.sectors = 4
        state.paperTone = "#f7efe2"; PAPER = state.paperTone
        state.unfoldT = 1; resetWedge(); render()
      }
      function makePngBlob(cb) {
        const prev = state.unfoldT
        state.unfoldT = 1
        const out = document.createElement("canvas")
        out.width = SIZE * 2
        out.height = SIZE * 2
        const octx = out.getContext("2d")
        octx.scale(2, 2)
        composeFull(octx)
        state.unfoldT = prev
        out.toBlob((blob) => cb(blob, out), "image/png")
      }
      actions.querySelector("#dl").onclick = () => {
        makePngBlob((blob, out) => {
          const a = document.createElement("a")
          a.download = `papercut-${state.shape}-${state.sectors}.png`
          a.href = out.toDataURL("image/png")
          a.click()
        })
      }
      actions.querySelector("#share").onclick = async () => {
        makePngBlob(async (blob) => {
          if (!blob) return
          const file = new File([blob], `papercut-${state.shape}-${state.sectors}.png`, { type: "image/png" })
          try {
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: "剪紙作品", text: "我嘅對稱剪紙" })
            } else if (navigator.share) {
              await navigator.share({ title: "剪紙作品", text: "打開學校剪紙應用睇下：https://chilinbpscth.github.io/papercut-ar/" })
            } else {
              hint.textContent = "呢部裝置未支援分享；請用「下載圖片」。"
            }
          } catch (err) {
            if (err && err.name !== "AbortError") hint.textContent = "分享取消或失敗；可以改下載。"
          }
        })
      }
      actions.querySelector("#cam").onclick = () => openCameraSticker()
    }
  }

  let resultAngle = 0
  let draggingResult = false
  let dragLastX = 0

  function drawView() {
    if (state.step === "shape") {
      vctx.fillStyle = "#efe6d8"
      vctx.fillRect(0, 0, SIZE, SIZE)
      vctx.fillStyle = PAPER
      vctx.strokeStyle = VERMILION
      vctx.lineWidth = 4
      if (state.shape === "circle") {
        vctx.beginPath(); vctx.arc(SIZE/2, SIZE/2, SIZE*0.36, 0, Math.PI*2); vctx.fill(); vctx.stroke()
      } else {
        const m = SIZE * 0.22
        vctx.fillRect(m, m, SIZE - m*2, SIZE - m*2)
        vctx.strokeRect(m, m, SIZE - m*2, SIZE - m*2)
      }
    } else if (state.step === "fold") {
      state.sectors = sectorsFromFolds(state.folds)
      drawFoldGuide(vctx)
      // show empty active sector paper
      vctx.save()
      clipSector(vctx, state.sectors)
      clipPaper(vctx)
      vctx.fillStyle = PAPER
      vctx.fillRect(0, 0, SIZE, SIZE)
      vctx.restore()
    } else if (state.step === "cut") {
      drawFoldGuide(vctx)
      vctx.save()
      clipSector(vctx, state.sectors)
      clipPaper(vctx)
      vctx.drawImage(wedge, 0, 0)
      vctx.restore()
      // highlight active sector outline
      vctx.save()
      const cx = SIZE/2, cy = SIZE/2, n = state.sectors
      const a0 = -Math.PI/2, a1 = a0 + (Math.PI*2)/n
      vctx.strokeStyle = VERMILION
      vctx.lineWidth = 3
      vctx.beginPath()
      vctx.moveTo(cx, cy)
      vctx.arc(cx, cy, SIZE*0.46, a0, a1)
      vctx.closePath()
      vctx.stroke()
      vctx.restore()
      // dashed live stroke + ghost of the hole that will punch on release
      if (state.strokePts && state.strokePts.length > 1) {
        vctx.save()
        clipSector(vctx, state.sectors)
        clipPaper(vctx)
        const pts = state.strokePts
        const first = pts[0], last = pts[pts.length - 1]
        const dist = Math.hypot(last.x - first.x, last.y - first.y)
        if (pts.length >= 6 && dist < 48) {
          vctx.fillStyle = "rgba(44,36,32,0.16)"
          vctx.beginPath()
          vctx.moveTo(first.x, first.y)
          for (let i = 1; i < pts.length; i++) vctx.lineTo(pts[i].x, pts[i].y)
          vctx.closePath()
          vctx.fill()
        }
        vctx.strokeStyle = "rgba(44,36,32,0.85)"
        vctx.lineWidth = 3
        vctx.setLineDash([8, 6])
        vctx.lineCap = "round"
        vctx.lineJoin = "round"
        vctx.beginPath()
        vctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) vctx.lineTo(pts[i].x, pts[i].y)
        vctx.stroke()
        vctx.setLineDash([])
        vctx.restore()
      }
      if (state.showLivePreview) {
        const lab = root.querySelector("#previewLabel")
        if (lab) lab.textContent = `展開 · ${state.sectors} 等份`
        const u = state.unfoldT; state.unfoldT = 1; composeFull(pctx); state.unfoldT = u
      }
    } else {
      vctx.save()
      vctx.fillStyle = "#efe6d8"
      vctx.fillRect(0, 0, SIZE, SIZE)
      vctx.translate(SIZE/2, SIZE/2)
      vctx.rotate(resultAngle)
      vctx.translate(-SIZE/2, -SIZE/2)
      composeFull(vctx)
      vctx.restore()
    }
  }

  function pointerPos(e, el = view) {
    const rect = el.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return {
      x: ((src.clientX - rect.left) / rect.width) * SIZE,
      y: ((src.clientY - rect.top) / rect.height) * SIZE,
    }
  }

  function inActiveSector(x, y) {
    const cx = SIZE / 2, cy = SIZE / 2
    let a = Math.atan2(y - cy, x - cx)
    let rel = a + Math.PI / 2
    while (rel < 0) rel += Math.PI * 2
    while (rel >= Math.PI * 2) rel -= Math.PI * 2
    return rel <= (Math.PI * 2) / state.sectors + 0.06
  }

  function stampAt(ctx, p, kind, r) {
    ctx.beginPath()
    if (kind === "triangle") {
      ctx.moveTo(p.x, p.y - r)
      ctx.lineTo(p.x + r * 0.9, p.y + r * 0.75)
      ctx.lineTo(p.x - r * 0.9, p.y + r * 0.75)
      ctx.closePath()
    } else if (kind === "diamond") {
      ctx.moveTo(p.x, p.y - r)
      ctx.lineTo(p.x + r * 0.75, p.y)
      ctx.lineTo(p.x, p.y + r)
      ctx.lineTo(p.x - r * 0.75, p.y)
      ctx.closePath()
    } else {
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    }
    ctx.fill()
  }

  function smoothClosePath(pts) {
    if (!pts || pts.length < 2) return pts || []
    // Chaikin-ish + close back to start for bean/leaf hole
    let cur = pts.slice()
    for (let pass = 0; pass < 2; pass++) {
      const next = []
      for (let i = 0; i < cur.length; i++) {
        const a = cur[i], b = cur[(i + 1) % cur.length]
        next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 })
        next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
      }
      cur = next
    }
    return cur
  }

  function pathLength(pts) {
    let len = 0
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    }
    return len
  }

  function commitClosedCut(pts) {
    if (!pts || pts.length < 2) return
    const first = pts[0], last = pts[pts.length - 1]
    const dist = Math.hypot(last.x - first.x, last.y - first.y)
    const len = pathLength(pts)
    if (len < 16 && dist < 16) {
      // accidental tap → small punch, matches "打窿" classroom feel
      snapshot()
      wctx.save()
      clipSector(wctx, state.sectors)
      clipPaper(wctx)
      wctx.globalCompositeOperation = "destination-out"
      wctx.fillStyle = "#000"
      wctx.beginPath()
      wctx.arc(first.x, first.y, Math.max(8, state.brush * 0.45), 0, Math.PI * 2)
      wctx.fill()
      wctx.restore()
      return
    }
    const nearLoop = dist < Math.max(24, 0.22 * len) && pts.length >= 6
    snapshot()
    wctx.save()
    clipSector(wctx, state.sectors)
    clipPaper(wctx)
    wctx.globalCompositeOperation = "destination-out"
    wctx.fillStyle = "#000"
    wctx.strokeStyle = "#000"
    wctx.lineCap = "round"
    wctx.lineJoin = "round"
    if (nearLoop || (pts.length >= 3 && dist < 36)) {
      // POC feel: release a loop → smooth bean/leaf hole
      let path = pts.slice()
      if (dist > 8) path.push({ x: first.x, y: first.y })
      path = smoothClosePath(path)
      wctx.beginPath()
      wctx.moveTo(path[0].x, path[0].y)
      for (let i = 1; i < path.length; i++) wctx.lineTo(path[i].x, path[i].y)
      wctx.closePath()
      wctx.fill()
    } else {
      // open scratch → thick knife cut, do NOT fill a giant triangle
      wctx.lineWidth = Math.max(16, state.brush)
      wctx.beginPath()
      wctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) wctx.lineTo(pts[i].x, pts[i].y)
      wctx.stroke()
    }
    wctx.restore()
  }

  function paintAt(p, { stampOnce = false } = {}) {
    if (!inActiveSector(p.x, p.y)) { state.last = null; return }
    if (state.mode === "stamp" || stampOnce) {
      snapshot()
      wctx.save()
      clipSector(wctx, state.sectors)
      clipPaper(wctx)
      wctx.globalCompositeOperation = "destination-out"
      wctx.fillStyle = "#000"
      stampAt(wctx, p, state.stamp, Math.max(10, state.brush * 0.7))
      wctx.restore()
      state.last = null
      drawView()
      return
    }
    // cut mode: accumulate path only; commit on pointer up
    state.strokePts.push({ x: p.x, y: p.y })
    state.last = p
    drawView()
  }

  function onDown(e) {
    if (state.step === "result") {
      draggingResult = true
      dragLastX = (e.touches ? e.touches[0] : e).clientX
      return
    }
    if (state.step !== "cut") return
    e.preventDefault()
    if (view.setPointerCapture && e.pointerId != null) {
      try { view.setPointerCapture(e.pointerId) } catch (_) {}
    }
    state.last = null
    state.strokePts = []
    if (state.mode === "stamp") {
      state.drawing = false
      paintAt(pointerPos(e), { stampOnce: true })
      return
    }
    state.drawing = true
    paintAt(pointerPos(e))
  }
  function onMove(e) {
    if (draggingResult && state.step === "result") {
      const pt = e.touches ? e.touches[0] : e
      const x = pt.clientX
      resultAngle += (x - dragLastX) * 0.01
      dragLastX = x
      const rect = tiltWrap.getBoundingClientRect()
      const nx = ((pt.clientX - rect.left) / rect.width) * 2 - 1
      const ny = ((pt.clientY - rect.top) / rect.height) * 2 - 1
      tiltWrap.style.transform = `perspective(900px) rotateY(${nx * 12}deg) rotateX(${-ny * 10}deg)`
      drawView()
      return
    }
    if (!state.drawing || state.step !== "cut" || state.mode === "stamp") return
    e.preventDefault()
    paintAt(pointerPos(e))
  }
  function onUp() {
    if (state.drawing && state.mode === "cut" && state.strokePts.length >= 3) {
      commitClosedCut(state.strokePts)
    }
    state.drawing = false
    state.last = null
    state.strokePts = []
    draggingResult = false
    if (state.step !== "result") tiltWrap.style.transform = ""
    drawView()
  }

  view.addEventListener("pointerdown", onDown)
  view.addEventListener("pointermove", onMove)
  view.addEventListener("pointerup", onUp)
  view.addEventListener("pointercancel", onUp)

  let idleSpin = 0
  function tickIdle() {
    if (state.step === "result" && !draggingResult) {
      resultAngle += 0.004
      const wobble = Math.sin(idleSpin) * 6
      tiltWrap.style.transform = `perspective(900px) rotateY(${wobble}deg) rotateX(${Math.cos(idleSpin) * 4}deg)`
      idleSpin += 0.03
      drawView()
    }
    requestAnimationFrame(tickIdle)
  }

  function render() {
    if (state.step !== "result") tiltWrap.style.transform = ""
    if (tipCard) tipCard.open = state.step === "shape" || state.step === "fold"
    view.style.cursor = state.step === "result" ? "grab" : "crosshair"
    tiltWrap.classList.toggle("is-result", state.step === "result")
    renderSteps()
    renderControls()
    drawView()
  }


  function openCameraSticker() {
    let overlay = root.querySelector(".cam-overlay")
    if (overlay) { overlay.remove() }
    overlay = document.createElement("div")
    overlay.className = "cam-overlay"
    overlay.innerHTML = `
      <div class="cam-panel">
        <div class="cam-stage">
          <video id="camVid" playsinline autoplay muted></video>
          <canvas id="camHud" width="640" height="480"></canvas>
        </div>
        <p class="cam-hint">拖動剪紙擺喺現實景物上；撳放大／縮小。無相機就用下載圖片。</p>
        <div class="row cam-actions">
          <button type="button" class="ghost" id="camSmaller">縮小</button>
          <button type="button" class="ghost" id="camBigger">放大</button>
          <button type="button" class="secondary" id="camShot">擷圖下載</button>
          <button type="button" class="primary" id="camClose">關閉</button>
        </div>
      </div>`
    root.querySelector(".app").appendChild(overlay)
    const video = overlay.querySelector("#camVid")
    const hud = overlay.querySelector("#camHud")
    const hctx = hud.getContext("2d")
    let scale = 0.45
    let ox = 0.5, oy = 0.5
    let dragging = false, lx = 0, ly = 0
    let stream = null
    const paper = document.createElement("canvas")
    paper.width = SIZE; paper.height = SIZE
    const prev = state.unfoldT; state.unfoldT = 1
    composeFull(paper.getContext("2d"), true)
    state.unfoldT = prev

    function layout() {
      const stage = overlay.querySelector(".cam-stage")
      const w = stage.clientWidth || 640
      const h = Math.round(w * 0.75)
      stage.style.height = h + "px"
      hud.width = w; hud.height = h
      draw()
    }
    function draw() {
      hctx.clearRect(0, 0, hud.width, hud.height)
      const s = Math.min(hud.width, hud.height) * scale
      hctx.drawImage(paper, ox * hud.width - s / 2, oy * hud.height - s / 2, s, s)
    }
    function onPointer(e, type) {
      const rect = hud.getBoundingClientRect()
      const pt = e.touches ? e.touches[0] : e
      const x = (pt.clientX - rect.left) / rect.width
      const y = (pt.clientY - rect.top) / rect.height
      if (type === "down") { dragging = true; lx = x; ly = y }
      else if (type === "move" && dragging) {
        ox += x - lx; oy += y - ly; lx = x; ly = y
        ox = Math.max(0.1, Math.min(0.9, ox))
        oy = Math.max(0.1, Math.min(0.9, oy))
        draw()
      } else if (type === "up") dragging = false
    }
    hud.addEventListener("pointerdown", (e) => { e.preventDefault(); onPointer(e, "down") })
    hud.addEventListener("pointermove", (e) => onPointer(e, "move"))
    hud.addEventListener("pointerup", () => onPointer({}, "up"))
    overlay.querySelector("#camBigger").onclick = () => { scale = Math.min(0.9, scale + 0.08); draw() }
    overlay.querySelector("#camSmaller").onclick = () => { scale = Math.max(0.2, scale - 0.08); draw() }
    overlay.querySelector("#camShot").onclick = () => {
      const out = document.createElement("canvas")
      out.width = hud.width; out.height = hud.height
      const o = out.getContext("2d")
      o.drawImage(video, 0, 0, out.width, out.height)
      o.drawImage(hud, 0, 0)
      const a = document.createElement("a")
      a.download = `papercut-cam-${Date.now()}.png`
      a.href = out.toDataURL("image/png")
      a.click()
    }
    const close = () => {
      if (stream) stream.getTracks().forEach((tr) => tr.stop())
      overlay.remove()
    }
    overlay.querySelector("#camClose").onclick = close

    const tryCam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        })
        video.srcObject = stream
        await video.play()
        layout()
        window.addEventListener("resize", layout, { once: false })
        overlay._onResize = layout
      } catch (err) {
        overlay.querySelector(".cam-hint").textContent =
          "開唔到相機（權限或裝置唔支援）。可以用「下載圖片」再喺相簿疊圖。"
        video.style.display = "none"
        hud.style.background = "#2c2420"
        layout()
        draw()
      }
    }
    tryCam()
  }

  state.sectors = sectorsFromFolds(state.folds)
  resetWedge()
  render()
  requestAnimationFrame(tickIdle)
  return { destroy() { root.innerHTML = "" } }
}
