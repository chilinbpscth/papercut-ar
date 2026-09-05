const SIZE = 640
const PAPER = "#f7efe2"
const TABLE = "#c4a574" // shows through cuts
const GOLD = "#d4a017"
const VERMILION = "#c41e3a"

export function createPapercutApp(root) {
  const state = {
    step: "shape",
    shape: "square",
    folds: 2,
    sectors: 4,
    drawing: false,
    last: null,
    brush: 22,
    mode: "cut",
    history: [],
    showLivePreview: true,
  }

  const wedge = document.createElement("canvas")
  wedge.width = SIZE
  wedge.height = SIZE
  const wctx = wedge.getContext("2d", { willReadFrequently: true })

  root.innerHTML = `
    <div class="app" data-app="papercut">
      <header>
        <h1>剪紙 · 對稱創作</h1>
        <p>一格剪完，對稱展開成窗花／團花——比真紙更易重試</p>
      </header>
      <details class="tip-card" open>
        <summary>課堂 5 分鐘點用</summary>
        <ol>
          <li>選圓形或方形</li>
          <li>摺 2～3 次（夠對稱又唔難）</li>
          <li>喺亮格剪，或撳「花瓣／齒邊／星點」示範</li>
          <li>睇右邊即時展開，滿意就下載貼簿</li>
        </ol>
      </details>
      <div class="panel">
        <div class="steps" id="steps"></div>
        <div id="controls"></div>
        <div class="stage-row" id="stageRow">
          <div class="stage tilt-wrap" id="tiltWrap"><canvas id="view" width="${SIZE}" height="${SIZE}" role="img" aria-label="剪紙畫布"></canvas></div>
          <div class="stage preview-stage hidden" id="previewWrap">
            <div class="preview-label">即時展開</div>
            <canvas id="preview" width="${SIZE}" height="${SIZE}" role="img" aria-label="展開預覽"></canvas>
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
    } else { // star notches near rim
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
    }
    wctx.restore()
  }

  function composeFull(ctx, withShadow = true) {
    ctx.fillStyle = "#efe6d8"
    ctx.fillRect(0, 0, SIZE, SIZE)
    // table under paper so cuts read as holes
    ctx.save()
    clipPaper(ctx)
    ctx.fillStyle = TABLE
    ctx.fillRect(0, 0, SIZE, SIZE)
    const n = state.sectors
    const cx = SIZE / 2, cy = SIZE / 2
    for (let mirror of [false, true]) {
      for (let i = 0; i < n; i++) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate((i * Math.PI * 2) / n)
        if (mirror) ctx.scale(-1, 1)
        ctx.translate(-cx, -cy)
        ctx.drawImage(wedge, 0, 0)
        ctx.restore()
      }
    }
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
    // inactive sectors: muted paper
    const n = state.sectors, cx = SIZE / 2, cy = SIZE / 2
    for (let i = 1; i < n; i++) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((i * Math.PI * 2) / n)
      ctx.translate(-cx, -cy)
      ctx.save()
      clipSector(ctx, n)
      clipPaper(ctx)
      ctx.fillStyle = "#e8d9c8"
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
        <button type="button" data-shape="circle" class="secondary ${state.shape==="circle"?"active":""}">圓形（團花）</button></div>`
      controls.querySelectorAll("[data-shape]").forEach((b) => {
        b.onclick = () => { state.shape = b.dataset.shape; render() }
      })
      hint.textContent = "方形似窗花；圓形似團花。之後可以隨便重試，唔使驚剪壞。"
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
      controls.innerHTML = `<div class="row"><h2>工具</h2>
        <button type="button" id="cutBtn" class="${state.mode==="cut"?"primary":"ghost"}">剪刀</button>
        <button type="button" id="restBtn" class="${state.mode==="restore"?"primary":"ghost"}">補紙</button>
        <button type="button" class="ghost" id="undo">復原</button>
        <button type="button" class="ghost" id="clear">清空</button></div>
        <div class="row"><h2>筆粗</h2>
        <button type="button" class="ghost" data-b="12">細</button>
        <button type="button" class="ghost" data-b="22">中</button>
        <button type="button" class="ghost" data-b="34">大</button></div>
        <div class="row"><h2>示範圖案</h2>
        <button type="button" class="secondary" data-demo="petal">花瓣</button>
        <button type="button" class="secondary" data-demo="edge">齒邊</button>
        <button type="button" class="secondary" data-demo="star">星點</button></div>`
      controls.querySelector("#cutBtn").onclick = () => { state.mode = "cut"; renderControls(); drawView() }
      controls.querySelector("#restBtn").onclick = () => { state.mode = "restore"; renderControls(); drawView() }
      controls.querySelector("#undo").onclick = () => {
        const prev = state.history.pop(); if (!prev) return
        const img = new Image()
        img.onload = () => { wctx.clearRect(0,0,SIZE,SIZE); wctx.drawImage(img,0,0); drawView() }
        img.src = prev
      }
      controls.querySelector("#clear").onclick = () => { snapshot(); resetWedge(); drawView() }
      controls.querySelectorAll("[data-b]").forEach((b) => {
        b.onclick = () => { state.brush = Number(b.dataset.b); renderControls() }
        if (Number(b.dataset.b) === state.brush) b.classList.add("active")
      })
      controls.querySelectorAll("[data-demo]").forEach((b) => {
        b.onclick = () => { applyDemoPattern(b.dataset.demo); drawView() }
      })
      hint.textContent = "只喺最亮嗰格剪；啡色底＝剪走嘅窿。右邊會即時睇展開效果。"
      actions.innerHTML = `<button type="button" class="ghost" id="back">上一步</button>
        <button type="button" class="primary" id="next">完成：睇大圖</button>`
      actions.querySelector("#back").onclick = () => { state.step = "fold"; render() }
      actions.querySelector("#next").onclick = () => { state.step = "result"; render() }
    } else {
      controls.innerHTML = `<div class="row"><h2>成品</h2>
        <span style="color:var(--muted)">${state.sectors} 等份對稱 · 可下載或返回再剪</span></div>`
      hint.textContent = "拖住成品可以轉角度睇。覺得夠美就可以下載俾學生貼簿。"
      actions.innerHTML = `<button type="button" class="ghost" id="back">返回再剪</button>
        <button type="button" class="secondary" id="restart">全部重來</button>
        <button type="button" class="primary" id="dl">下載圖片</button>`
      actions.querySelector("#back").onclick = () => { state.step = "cut"; render() }
      actions.querySelector("#restart").onclick = () => {
        state.step = "shape"; state.shape = "square"; state.folds = 2; state.sectors = 4
        resetWedge(); render()
      }
      actions.querySelector("#dl").onclick = () => {
        const out = document.createElement("canvas")
        out.width = SIZE * 2
        out.height = SIZE * 2
        const octx = out.getContext("2d")
        octx.scale(2, 2)
        composeFull(octx)
        const a = document.createElement("a")
        a.download = `papercut-${state.shape}-${state.sectors}.png`
        a.href = out.toDataURL("image/png")
        a.click()
      }
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
      if (state.showLivePreview) composeFull(pctx)
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
    return rel <= (Math.PI * 2) / state.sectors + 0.02
  }

  function paintAt(p) {
    if (!inActiveSector(p.x, p.y)) { state.last = null; return }
    wctx.save()
    clipSector(wctx, state.sectors)
    clipPaper(wctx)
    wctx.lineCap = "round"
    wctx.lineJoin = "round"
    wctx.lineWidth = state.brush
    if (state.mode === "cut") {
      wctx.globalCompositeOperation = "destination-out"
      wctx.strokeStyle = "#000"
      wctx.fillStyle = "#000"
    } else {
      wctx.globalCompositeOperation = "source-over"
      wctx.strokeStyle = PAPER
      wctx.fillStyle = PAPER
    }
    if (state.last) {
      wctx.beginPath()
      wctx.moveTo(state.last.x, state.last.y)
      wctx.lineTo(p.x, p.y)
      wctx.stroke()
    } else {
      wctx.beginPath()
      wctx.arc(p.x, p.y, state.brush / 2, 0, Math.PI * 2)
      wctx.fill()
    }
    wctx.restore()
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
    snapshot()
    state.drawing = true
    state.last = null
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
    if (!state.drawing || state.step !== "cut") return
    e.preventDefault()
    paintAt(pointerPos(e))
  }
  function onUp() {
    state.drawing = false
    state.last = null
    draggingResult = false
    if (state.step !== "result") tiltWrap.style.transform = ""
  }

  view.addEventListener("pointerdown", onDown)
  view.addEventListener("pointermove", onMove)
  view.addEventListener("pointerup", onUp)
  view.addEventListener("pointercancel", onUp)

  function render() {
    if (state.step !== "result") tiltWrap.style.transform = ""
    renderSteps()
    renderControls()
    drawView()
  }

  state.sectors = sectorsFromFolds(state.folds)
  resetWedge()
  render()
  return { destroy() { root.innerHTML = "" } }
}
