const SIZE = 640

export function createPapercutApp(root) {
  const state = {
    step: "shape",
    shape: "square",
    folds: 2,
    sectors: 4,
    drawing: false,
    last: null,
    brush: 18,
    mode: "cut",
    history: [],
  }

  const wedge = document.createElement("canvas")
  wedge.width = SIZE
  wedge.height = SIZE
  const wctx = wedge.getContext("2d", { willReadFrequently: true })

  root.innerHTML = `
    <div class="app">
      <header>
        <h1>剪紙 · 對稱創作</h1>
        <p>選紙 → 摺幾多次 → 剪一格 → 展開睇團花</p>
      </header>
      <div class="panel">
        <div class="steps" id="steps"></div>
        <div id="controls"></div>
        <div class="stage"><canvas id="view" width="${SIZE}" height="${SIZE}"></canvas></div>
        <p class="hint" id="hint"></p>
        <div class="row" id="actions"></div>
      </div>
    </div>
  `

  const view = root.querySelector("#view")
  const vctx = view.getContext("2d")
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

  function clipSector(ctx, n) {
    const cx = SIZE / 2, cy = SIZE / 2
    const a0 = -Math.PI / 2
    const a1 = a0 + (Math.PI * 2) / n
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, SIZE, a0, a1)
    ctx.closePath()
    ctx.clip()
  }

  function resetWedge() {
    wctx.clearRect(0, 0, SIZE, SIZE)
    wctx.save()
    clipSector(wctx, state.sectors)
    clipPaper(wctx)
    wctx.fillStyle = "#f7efe2"
    wctx.fillRect(0, 0, SIZE, SIZE)
    wctx.restore()
    state.history = []
  }

  function snapshot() {
    state.history.push(wedge.toDataURL("image/png"))
    if (state.history.length > 20) state.history.shift()
  }

  function renderSteps() {
    const labels = [["shape","1 選紙"],["fold","2 摺紙"],["cut","3 剪裁"],["result","4 展開"]]
    stepsEl.innerHTML = labels.map(([id,t]) => `<span class="${state.step===id?"on":""}">${t}</span>`).join("")
  }

  function renderControls() {
    if (state.step === "shape") {
      controls.innerHTML = `<div class="row"><h2>紙形</h2>
        <button type="button" data-shape="square" class="secondary ${state.shape==="square"?"active":""}">方形（窗花）</button>
        <button type="button" data-shape="circle" class="secondary ${state.shape==="circle"?"active":""}">圓形（團花）</button></div>`
      controls.querySelectorAll("[data-shape]").forEach((b) => {
        b.onclick = () => { state.shape = b.dataset.shape; render() }
      })
      hint.textContent = "方形似傳統窗花；圓形適合團花。"
      actions.innerHTML = `<button type="button" class="ok" id="next">下一步：摺紙</button>`
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
      hint.textContent = "摺得越多，對稱同重複越多。圓形最多可到 16 等份。"
      actions.innerHTML = `<button type="button" class="ghost" id="back">上一步</button>
        <button type="button" class="ok" id="next">下一步：開始剪</button>`
      actions.querySelector("#back").onclick = () => { state.step = "shape"; render() }
      actions.querySelector("#next").onclick = () => {
        state.sectors = sectorsFromFolds(state.folds)
        resetWedge(); state.step = "cut"; render()
      }
    } else if (state.step === "cut") {
      controls.innerHTML = `<div class="row"><h2>工具</h2>
        <button type="button" id="cutBtn" class="${state.mode==="cut"?"ok":"ghost"}">剪刀（剪走）</button>
        <button type="button" id="restBtn" class="${state.mode==="restore"?"ok":"ghost"}">補回紙</button>
        <button type="button" class="ghost" id="undo">復原</button>
        <button type="button" class="ghost" id="clear">清空重剪</button></div>
        <div class="row"><h2>筆粗</h2>
        <button type="button" class="ghost" data-b="10">細</button>
        <button type="button" class="ghost" data-b="18">中</button>
        <button type="button" class="ghost" data-b="28">大</button></div>`
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
      hint.textContent = "只喺亮起嗰一格剪。剪走嘅位展開後會變成通花。"
      actions.innerHTML = `<button type="button" class="ghost" id="back">上一步</button>
        <button type="button" class="ok" id="next">預覽成品</button>`
      actions.querySelector("#back").onclick = () => { state.step = "fold"; render() }
      actions.querySelector("#next").onclick = () => { state.step = "result"; render() }
    } else {
      controls.innerHTML = `<div class="row"><h2>成品</h2><span style="color:var(--muted)">已按 ${state.sectors} 等份對稱展開</span></div>`
      hint.textContent = "可以下載圖片，或者返回再剪。"
      actions.innerHTML = `<button type="button" class="ghost" id="back">返回再剪</button>
        <button type="button" class="secondary" id="restart">全部重來</button>
        <button type="button" class="ok" id="dl">下載圖片</button>`
      actions.querySelector("#back").onclick = () => { state.step = "cut"; render() }
      actions.querySelector("#restart").onclick = () => {
        state.step = "shape"; state.shape = "square"; state.folds = 2; state.sectors = 4
        resetWedge(); render()
      }
      actions.querySelector("#dl").onclick = () => {
        const a = document.createElement("a")
        a.download = `papercut-${state.shape}-${state.sectors}.png`
        a.href = view.toDataURL("image/png")
        a.click()
      }
    }
  }

  function drawFoldGuide(ctx) {
    ctx.fillStyle = "#efe6d8"
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.save()
    clipPaper(ctx)
    ctx.fillStyle = "#e8d9c8"
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.restore()
    ctx.save()
    clipSector(ctx, state.sectors)
    clipPaper(ctx)
    ctx.fillStyle = "#f7efe2"
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.restore()
    const n = state.sectors, cx = SIZE / 2, cy = SIZE / 2
    ctx.strokeStyle = "rgba(212,160,23,0.65)"
    ctx.lineWidth = 2
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / n
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * SIZE, cy + Math.sin(a) * SIZE)
      ctx.stroke()
    }
    ctx.strokeStyle = "#d4a017"
    ctx.lineWidth = 3
    ctx.beginPath()
    if (state.shape === "circle") ctx.arc(cx, cy, SIZE * 0.46, 0, Math.PI * 2)
    else {
      const m = SIZE * 0.08
      ctx.rect(m, m, SIZE - m * 2, SIZE - m * 2)
    }
    ctx.stroke()
  }

  function composeFull(ctx) {
    ctx.fillStyle = "#efe6d8"
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.save()
    clipPaper(ctx)
    ctx.fillStyle = "#e8d9c8"
    ctx.fillRect(0, 0, SIZE, SIZE)
    const n = state.sectors, cx = SIZE / 2, cy = SIZE / 2
    for (let i = 0; i < n; i++) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((i * Math.PI * 2) / n)
      ctx.translate(-cx, -cy)
      ctx.drawImage(wedge, 0, 0)
      ctx.restore()
    }
    ctx.restore()
    ctx.strokeStyle = "#d4a017"
    ctx.lineWidth = 3
    ctx.beginPath()
    if (state.shape === "circle") ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.46, 0, Math.PI * 2)
    else {
      const m = SIZE * 0.08
      ctx.rect(m, m, SIZE - m * 2, SIZE - m * 2)
    }
    ctx.stroke()
  }

  function drawView() {
    if (state.step === "shape") {
      vctx.fillStyle = "#efe6d8"
      vctx.fillRect(0, 0, SIZE, SIZE)
      vctx.fillStyle = "#f7efe2"
      vctx.strokeStyle = "#d4a017"
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
    } else if (state.step === "cut") {
      drawFoldGuide(vctx)
      vctx.save()
      clipSector(vctx, state.sectors)
      clipPaper(vctx)
      vctx.drawImage(wedge, 0, 0)
      vctx.restore()
    } else {
      composeFull(vctx)
    }
  }

  function pointerPos(e) {
    const rect = view.getBoundingClientRect()
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
    return rel <= (Math.PI * 2) / state.sectors
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
      wctx.strokeStyle = "#f7efe2"
      wctx.fillStyle = "#f7efe2"
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
    if (!state.drawing || state.step !== "cut") return
    e.preventDefault()
    paintAt(pointerPos(e))
  }
  function onUp() { state.drawing = false; state.last = null }

  view.addEventListener("pointerdown", onDown)
  view.addEventListener("pointermove", onMove)
  view.addEventListener("pointerup", onUp)
  view.addEventListener("pointercancel", onUp)

  function render() {
    renderSteps()
    renderControls()
    drawView()
  }

  state.sectors = sectorsFromFolds(state.folds)
  resetWedge()
  render()
  return { destroy() { root.innerHTML = "" } }
}
