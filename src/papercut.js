const SIZE = 640
let PAPER = "#c41e3a"
const TABLE = "#fff4e8" // light window through cuts (dark/vermilion paper)
const GOLD = "#d4a017"
const VERMILION = "#c41e3a"
const APP_VERSION = "v20260906-class2"
/** Hole-through fill under cuts: light paper needs dark desk so holes read. */
function holeFill() {
  const hex = String(PAPER || "#c41e3a").replace("#", "").trim()
  if (hex.length < 6) return TABLE
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  if (lum > 0.72) return "#4a3728" // warm dark desk / ink
  return TABLE // light window for vermilion / dark paper
}

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
    stamp: "circle", // circle | crescent | teardrop
    strokePts: [], // live path for closed cutout
    history: [],
    showLivePreview: true,
    unfoldT: 1, // 0..1 animated unfold
    paperTone: "#c41e3a",
    symmetryMode: "alt-mirror", // fixed: true fold geometry (alt-mirror)
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
          <p>摺邊留紙橋再剪窿；展開係幾何對稱——唔係 AI 評分</p>
        </div>
        <span class="ver-chip" title="硬 refresh 後應見到呢個版號">${APP_VERSION}</span>
      </header>
      <details class="tip-card" open>
        <summary>課堂 5 分鐘點用</summary>
        <ol>
          <li>選圓形或方形</li>
          <li>摺 2～3 次（夠對稱又唔難）</li>
          <li>喺扇形一叠圍一圈放手＝封閉剪口</li>
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

  function paperHalf() { return SIZE * 0.42 } // clipPaper margin 0.08 → 半邊 0.42

  function drawPoly(ctx, poly, close = true) {
    if (!poly || poly.length < 2) return
    ctx.beginPath()
    ctx.moveTo(poly[0].x, poly[0].y)
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y)
    if (close) ctx.closePath()
  }

  function clipHalfPoly(poly, aRad, sign, cx, cy) {
    const dx = Math.cos(aRad), dy = Math.sin(aRad)
    const ev = (p) => (dx * (p.y - cy) - dy * (p.x - cx)) * sign
    const out = []
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i], p2 = poly[(i + 1) % poly.length]
      const e1 = ev(p1), e2 = ev(p2)
      if (e1 >= 0) out.push(p1)
      if ((e1 >= 0) !== (e2 >= 0)) {
        const t = e1 / ((e1 - e2) || 1e-9)
        out.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t })
      }
    }
    return out
  }

  function squareOutlinePoly() {
    const H = paperHalf(), cx = SIZE / 2, cy = SIZE / 2
    return [
      { x: cx - H, y: cy - H }, { x: cx + H, y: cy - H },
      { x: cx + H, y: cy + H }, { x: cx - H, y: cy + H },
    ]
  }

  /** 摺完最上層要剪嘅包：圓＝扇；方＝正方形 ∩ 兩摺半平面（POC clipHalf） */
  function packetPoly() {
    const cx = SIZE / 2, cy = SIZE / 2
    const n = state.sectors
    const a0 = -Math.PI / 2
    const a1 = a0 + (Math.PI * 2) / n
    if (state.shape === "circle") {
      const r = SIZE * 0.46, pts = [{ x: cx, y: cy }]
      for (let i = 0; i <= 16; i++) {
        const a = a0 + (a1 - a0) * (i / 16)
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
      }
      return pts
    }
    let poly = squareOutlinePoly()
    poly = clipHalfPoly(poly, a0, 1, cx, cy)
    poly = clipHalfPoly(poly, a1, -1, cx, cy)
    return poly
  }

  function clipPacket(ctx) {
    drawPoly(ctx, packetPoly())
    ctx.clip()
  }

  function rayToPaperEdge(ang, cx, cy) {
    if (state.shape === "circle") {
      const r = SIZE * 0.46
      return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r }
    }
    const H = paperHalf()
    const d = H / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)))
    return { x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d }
  }

  function cutViewParams() {
    const n = state.sectors
    const theta = (Math.PI * 2) / n
    const mid = -Math.PI / 2 + theta / 2
    const tipX = SIZE * 0.5
    const tipY = SIZE * 0.82
    const paperR = SIZE * 0.46
    // enlarge so paperR ~0.46*SIZE reads as ~0.72*SIZE on screen
    const scale = (SIZE * 0.72) / paperR
    return { n, theta, mid, tipX, tipY, scale, paperR }
  }

  function applyCutViewTransform(ctx) {
    const { tipX, tipY, mid, scale } = cutViewParams()
    ctx.translate(tipX, tipY)
    ctx.rotate(-Math.PI / 2 - mid)
    ctx.scale(scale, scale)
    ctx.translate(-SIZE / 2, -SIZE / 2)
  }

  function viewToWedge(p) {
    const { tipX, tipY, mid, scale } = cutViewParams()
    let x = p.x - tipX
    let y = p.y - tipY
    // inverse of rotate(-PI/2 - mid)
    const ang = Math.PI / 2 + mid
    const c = Math.cos(ang), s = Math.sin(ang)
    const rx = x * c - y * s
    const ry = x * s + y * c
    return { x: rx / scale + SIZE / 2, y: ry / scale + SIZE / 2 }
  }

  function drawFoldedWedgeView(ctx) {
    const { n, theta, mid, tipX, tipY, scale, paperR } = cutViewParams()
    const a0 = -Math.PI / 2
    const a1 = a0 + theta
    const cx = SIZE / 2, cy = SIZE / 2
    const pack = packetPoly()

    ctx.fillStyle = "#efe6d8"
    ctx.fillRect(0, 0, SIZE, SIZE)

    // stacked muted layers (thickness under the fold pile)
    const layers = [
      { dx: 14, dy: 10, fill: "#cbb89a" },
      { dx: 9, dy: 6, fill: "#d9c8aa" },
      { dx: 5, dy: 3, fill: "#e4d6bc" },
    ]
    for (const L of layers) {
      ctx.save()
      ctx.translate(tipX + L.dx, tipY + L.dy)
      ctx.rotate(-Math.PI / 2 - mid)
      ctx.scale(scale, scale)
      ctx.translate(-cx, -cy)
      drawPoly(ctx, pack)
      ctx.fillStyle = L.fill
      ctx.fill()
      ctx.restore()
    }

    // soft drop shadow for the top wedge
    ctx.save()
    applyCutViewTransform(ctx)
    drawPoly(ctx, pack)
    ctx.shadowColor = "rgba(44,36,32,0.38)"
    ctx.shadowBlur = 24
    ctx.shadowOffsetX = 6
    ctx.shadowOffsetY = 14
    ctx.fillStyle = "rgba(44,36,32,0.22)"
    ctx.fill()
    ctx.restore()

    // hole fill under cuts, then the actual wedge bitmap
    ctx.save()
    applyCutViewTransform(ctx)
    ctx.save()
    clipPacket(ctx)
    clipPaper(ctx)
    ctx.fillStyle = holeFill()
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.drawImage(wedge, 0, 0)
    ctx.restore()

    // dashed fold edges (a0 / a1) to paper edge
    const e0 = rayToPaperEdge(a0, cx, cy)
    const e1 = rayToPaperEdge(a1, cx, cy)
    ctx.strokeStyle = "rgba(44,36,32,0.78)"
    ctx.lineWidth = 2.4 / scale
    ctx.setLineDash([11 / scale, 8 / scale])
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(cx, cy); ctx.lineTo(e0.x, e0.y)
    ctx.moveTo(cx, cy); ctx.lineTo(e1.x, e1.y)
    ctx.stroke()
    ctx.setLineDash([])

    // soft outer rim (packet outline)
    ctx.strokeStyle = "rgba(44,36,32,0.3)"
    ctx.lineWidth = 1.6 / scale
    drawPoly(ctx, pack)
    ctx.stroke()
    ctx.restore()

    // N-layer chip top-right
    const chip = `${n} 層`
    ctx.font = "600 17px system-ui, -apple-system, sans-serif"
    ctx.textAlign = "right"
    ctx.textBaseline = "middle"
    const tw = ctx.measureText(chip).width
    const chipR = SIZE - 16
    const chipY = 28
    const padX = 12
    const x0 = chipR - tw - padX
    const y0 = chipY - 12
    const ww = tw + padX * 2
    const hh = 24
    ctx.fillStyle = "rgba(255,248,240,0.92)"
    ctx.strokeStyle = "rgba(196,160,100,0.55)"
    ctx.lineWidth = 1
    ctx.beginPath()
    const rr = 12
    ctx.moveTo(x0 + rr, y0)
    ctx.arcTo(x0 + ww, y0, x0 + ww, y0 + hh, rr)
    ctx.arcTo(x0 + ww, y0 + hh, x0, y0 + hh, rr)
    ctx.arcTo(x0, y0 + hh, x0, y0, rr)
    ctx.arcTo(x0, y0, x0 + ww, y0, rr)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = "#5a4638"
    ctx.fillText(chip, chipR, chipY)
  }

  function resetWedge() {
    PAPER = state.paperTone || "#f7efe2"
    wctx.clearRect(0, 0, SIZE, SIZE)
    wctx.save()
    clipPacket(wctx)
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
    clipPacket(wctx)
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
      wctx.lineWidth = 5
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
      wctx.lineWidth = 5
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
      wctx.lineWidth = 5
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
      wctx.lineWidth = 6
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

  function drawMountFrame(ctx, s) {
    ctx.fillStyle = "#c41e3a"
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = "#d4a017"
    ctx.fillRect(6, 6, s - 12, s - 12)
    ctx.fillStyle = "#f3e6d0"
    ctx.fillRect(10, 10, s - 20, s - 20)
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
      ctx.fillStyle = holeFill()
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.restore()
    }
    // hole fill under paper so cuts read clearly (dark desk on light paper)
    ctx.save()
    clipPaper(ctx)
    ctx.fillStyle = holeFill()
    ctx.fillRect(0, 0, SIZE, SIZE)
    const n = state.sectors
    const cx = SIZE / 2, cy = SIZE / 2
    const u = Math.max(0, Math.min(1, state.unfoldT ?? 1))
    const theta = (Math.PI * 2) / n
    const spread = 0.15 + 0.85 * u
    const altMirror = true // always alt-mirror (true fold geometry)
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
    const cx = SIZE / 2, cy = SIZE / 2
    const n = state.sectors
    ctx.fillStyle = "#efe6d8"
    ctx.fillRect(0, 0, SIZE, SIZE)

    ctx.save()
    clipPaper(ctx)
    ctx.fillStyle = "#f4ebe0"
    ctx.fillRect(0, 0, SIZE, SIZE)

    if (state.shape === "square") {
      ctx.fillStyle = "#efe4d4"
      ctx.fillRect(0, 0, SIZE, SIZE)

      const pack = packetPoly()
      drawPoly(ctx, pack)
      const tone = String(PAPER || VERMILION).toLowerCase()
      const light = ["#efe6d4", "#f3e4c8", "#f3d9de", "#dceee6", "#f7efe2"].includes(tone)
      ctx.fillStyle = light ? VERMILION : PAPER
      ctx.fill()
      ctx.fillStyle = "rgba(44,36,32,0.22)"
      ctx.fill()

      ctx.strokeStyle = "rgba(212,160,23,0.9)"
      ctx.lineWidth = 2.4
      ctx.setLineDash([14, 10])
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / n
        const e = rayToPaperEdge(a, cx, cy)
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(e.x, e.y)
        ctx.stroke()
      }
      ctx.setLineDash([])

      const foldHint = state.folds === 1
        ? "對摺一次 → 剪呢半邊"
        : state.folds === 2
          ? "再對摺 → 剪呢一角（4 層）"
          : "第三次對角摺 → 剪呢個三角（8 層）"
      let lx = 0, ly = 0
      for (const p of pack) { lx += p.x; ly += p.y }
      lx /= pack.length; ly /= pack.length
      ctx.font = '700 16px "Noto Sans TC","PingFang HK",sans-serif'
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      const tw = ctx.measureText(foldHint).width
      const bw = tw + 20, bh = 28
      ctx.fillStyle = "rgba(255,250,243,0.94)"
      ctx.strokeStyle = "rgba(196,30,58,0.55)"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(lx - bw / 2, ly - bh / 2, bw, bh, 14)
      ctx.fill(); ctx.stroke()
      ctx.fillStyle = "#2c2420"
      ctx.fillText(foldHint, lx, ly)
    } else {
      // 圓形：保留 inactive pie + active clipSector 深色扇 + 金射線
      const paperR = SIZE * 0.46
      for (let i = 1; i < n; i++) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate((i * Math.PI * 2) / n)
        ctx.translate(-cx, -cy)
        ctx.save()
        clipSector(ctx, n)
        ctx.fillStyle = i % 2 ? "#efe4d4" : "#f7efe2"
        ctx.fillRect(0, 0, SIZE, SIZE)
        ctx.restore()
        ctx.restore()
      }
      ctx.save()
      clipSector(ctx, n)
      const tone = String(PAPER || VERMILION).toLowerCase()
      const lumGuess = (tone === "#efe6d4" || tone === "#f3e4c8" || tone === "#f3d9de" || tone === "#dceee6" || tone === "#f7efe2")
      ctx.fillStyle = lumGuess ? VERMILION : PAPER
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.fillStyle = lumGuess ? "rgba(44,36,32,0.18)" : "rgba(44,36,32,0.28)"
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.restore()

      ctx.strokeStyle = "rgba(212,160,23,0.85)"
      ctx.lineWidth = 2.2
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / n
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(a) * SIZE, cy + Math.sin(a) * SIZE)
        ctx.stroke()
      }

      const mid = -Math.PI / 2 + Math.PI / n
      const lx = cx + Math.cos(mid) * paperR * 0.55
      const ly = cy + Math.sin(mid) * paperR * 0.55
      ctx.font = '700 18px "Noto Sans TC","PingFang HK",sans-serif'
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      const label = "之後剪呢格"
      const tw = ctx.measureText(label).width
      const pad = 10
      ctx.fillStyle = "rgba(255,250,243,0.94)"
      ctx.strokeStyle = "rgba(196,30,58,0.55)"
      ctx.lineWidth = 1.5
      const bw = tw + pad * 2, bh = 28
      const bx = lx - bw / 2, by = ly - bh / 2
      ctx.beginPath()
      ctx.roundRect(bx, by, bw, bh, 14)
      ctx.fill(); ctx.stroke()
      ctx.fillStyle = "#2c2420"
      ctx.fillText(label, lx, ly)
    }
    ctx.restore()

    ctx.strokeStyle = GOLD
    ctx.lineWidth = 3
    ctx.beginPath()
    if (state.shape === "circle") ctx.arc(cx, cy, SIZE * 0.46, 0, Math.PI * 2)
    else {
      const m = SIZE * 0.08
      ctx.rect(m, m, SIZE - m * 2, SIZE - m * 2)
    }
    ctx.stroke()

    ctx.font = '600 13px "Noto Sans TC","PingFang HK",sans-serif'
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    const legend = "深色＝剪 · 淺色＝摺埋"
    const lw = ctx.measureText(legend).width
    ctx.fillStyle = "rgba(255,248,240,0.92)"
    ctx.strokeStyle = "rgba(196,160,100,0.5)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(14, SIZE - 36, lw + 20, 24, 10)
    ctx.fill(); ctx.stroke()
    ctx.fillStyle = "#5a4638"
    ctx.fillText(legend, 24, SIZE - 24)
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
        <button type="button" class="ghost tone" data-tone="#c41e3a" style="background:#c41e3a;color:#fff">硃紅</button>
        <button type="button" class="ghost tone" data-tone="#efe6d4" style="background:#efe6d4;color:#2c2420">宣紙</button>
        <button type="button" class="ghost tone" data-tone="#f3e4c8" style="background:#f3e4c8;color:#2c2420">米黄</button>
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
      hint.textContent = state.shape === "square"
        ? "方形：深色塊＝摺完最上面嗰包（1次對半、2次一角、3次對角三角）。淺色＝摺埋睇唔到。"
        : "圓形：深色扇形＝摺起要剪嗰格；淺色＝摺埋。建議先試摺 2～3 次。"
      actions.innerHTML = `<button type="button" class="ghost" id="back">上一步</button>
        <button type="button" class="primary" id="next">下一步：開始剪</button>`
      actions.querySelector("#back").onclick = () => { state.step = "shape"; render() }
      actions.querySelector("#next").onclick = () => {
        state.sectors = sectorsFromFolds(state.folds)
        resetWedge(); state.step = "cut"; render()
      }
    } else if (state.step === "cut") {
      state.mode = "cut"
      state.symmetryMode = "alt-mirror"
      controls.innerHTML = `<div class="row cut-actions" id="cutActions">
        <button type="button" class="ghost" id="undo">復原</button>
        <button type="button" class="ghost" id="clear">重新再來</button></div>`
      controls.querySelector("#undo").onclick = () => {
        const prev = state.history.pop(); if (!prev) return
        const img = new Image()
        img.onload = () => { wctx.clearRect(0,0,SIZE,SIZE); wctx.drawImage(img,0,0); drawView() }
        img.src = prev
      }
      controls.querySelector("#clear").onclick = () => { snapshot(); resetWedge(); drawView() }
      hint.textContent = "虛線係摺邊；畫面係摺起嗰一叠扇形。要圍成密封圖形先剪得走（豆／葉形窿）；尖角剪過兩條摺邊會整塊尖角飛走。左下角係展開預覽。"
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
      hint.textContent = `按你摺嘅次數展開成 ${state.sectors} 等份。夠美就下載貼簿。`
      actions.innerHTML = `<button type="button" class="ghost" id="back">返回再剪</button>
        <button type="button" class="secondary" id="restart">全部重來</button>
        <button type="button" class="secondary" id="cam">相機擺放（簡易）</button>
        <button type="button" class="secondary" id="share">分享</button>
        <button type="button" class="primary" id="dl">下載圖片</button>`
      actions.querySelector("#back").onclick = () => { state.step = "cut"; state.unfoldT = 1; render() }
      actions.querySelector("#restart").onclick = () => {
        state.step = "shape"; state.shape = "square"; state.folds = 2; state.sectors = 4
        state.paperTone = "#c41e3a"; PAPER = state.paperTone
        state.unfoldT = 1; resetWedge(); render()
      }
      function makePngBlob(cb) {
        const prev = state.unfoldT
        state.unfoldT = 1
        const out = document.createElement("canvas")
        out.width = SIZE * 2 + 96
        out.height = SIZE * 2 + 96
        const octx = out.getContext("2d")
        drawMountFrame(octx, out.width)
        octx.save()
        octx.translate(48, 48)
        octx.scale(2, 2)
        composeFull(octx, true)
        octx.restore()
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
    } else if (state.step === "cut") {
      drawFoldedWedgeView(vctx)
      // live stroke in wedge coords -> cut view transform
      if (state.strokePts && state.strokePts.length > 1) {
        const { scale } = cutViewParams()
        vctx.save()
        applyCutViewTransform(vctx)
        clipPacket(vctx)
        clipPaper(vctx)
        const pts = state.strokePts
        const first = pts[0], last = pts[pts.length - 1]
        const dist = Math.hypot(last.x - first.x, last.y - first.y)
        const len = pathLength(pts)
        const nearLoop = dist < Math.max(24, 0.22 * len) && pts.length >= 6
        const tipGhost = isTipChopStroke(pts)
        vctx.lineCap = "round"
        vctx.lineJoin = "round"
        if (nearLoop || tipGhost) {
          vctx.fillStyle = "rgba(44,36,32,0.22)"
          if (tipGhost && !nearLoop) {
            const g = tipChopPolygon(pts)
            if (g) { drawPoly(vctx, g); vctx.fill() }
          } else {
            vctx.beginPath()
            vctx.moveTo(pts[0].x, pts[0].y)
            for (let i = 1; i < pts.length; i++) vctx.lineTo(pts[i].x, pts[i].y)
            vctx.closePath()
            vctx.fill()
          }
          vctx.strokeStyle = "rgba(44,36,32,0.85)"
          vctx.lineWidth = 3 / scale
          vctx.setLineDash([8 / scale, 6 / scale])
          drawPoly(vctx, tipGhost && !nearLoop ? (tipChopPolygon(pts) || pts) : pts, !!nearLoop || tipGhost)
          vctx.stroke()
          vctx.setLineDash([])
        } else {
          vctx.strokeStyle = "rgba(44,36,32,0.35)"
          vctx.lineWidth = 2 / scale
          vctx.setLineDash([6 / scale, 8 / scale])
          drawPoly(vctx, pts, false)
          vctx.stroke()
          vctx.setLineDash([])
        }
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
    const p = {
      x: ((src.clientX - rect.left) / rect.width) * SIZE,
      y: ((src.clientY - rect.top) / rect.height) * SIZE,
    }
    // cut workspace is a transformed wedge; map screen -> wedge buffer
    if (state.step === "cut") return viewToWedge(p)
    return p
  }

  function inActiveSector(x, y) {
    // square/circle both use packet geometry so hit-test matches clipPacket
    const pack = packetPoly()
    if (pointInPoly(x, y, pack)) return true
    // slight angular slack for circle fingers near fold rays
    if (state.shape === "circle") {
      const cx = SIZE / 2, cy = SIZE / 2
      let a = Math.atan2(y - cy, x - cx)
      let rel = a + Math.PI / 2
      while (rel < 0) rel += Math.PI * 2
      while (rel >= Math.PI * 2) rel -= Math.PI * 2
      return rel <= (Math.PI * 2) / state.sectors + 0.06
    }
    return false
  }

  function stampAt(ctx, p, kind, r) {
    if (kind === "crescent" || kind === "triangle") {
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.arc(p.x + r * 0.38, p.y - r * 0.08, r * 0.7, 0, Math.PI * 2, true)
      ctx.fill("evenodd")
      return
    }
    ctx.beginPath()
    if (kind === "teardrop" || kind === "diamond") {
      ctx.moveTo(p.x, p.y - r)
      ctx.bezierCurveTo(p.x + r * 0.9, p.y - r * 0.2, p.x + r * 0.55, p.y + r * 0.7, p.x, p.y + r)
      ctx.bezierCurveTo(p.x - r * 0.55, p.y + r * 0.7, p.x - r * 0.9, p.y - r * 0.2, p.x, p.y - r)
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

  function distToRay(p, angle, cx, cy) {
    const dx = p.x - cx, dy = p.y - cy
    const along = dx * Math.cos(angle) + dy * Math.sin(angle)
    if (along < 0) return Math.hypot(dx, dy)
    const px = Math.cos(angle) * along
    const py = Math.sin(angle) * along
    return Math.hypot(dx - px, dy - py)
  }

  function pointInPoly(px, py, poly) {
    // ray-cast; poly is [{x,y}, ...]
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y
      const xj = poly[j].x, yj = poly[j].y
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-9) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  function raySegHit(cx, cy, angle, p1, p2) {
    const rx = Math.cos(angle), ry = Math.sin(angle)
    const sx = p2.x - p1.x, sy = p2.y - p1.y
    const den = rx * sy - ry * sx
    if (Math.abs(den) < 1e-8) return null
    const qx = p1.x - cx, qy = p1.y - cy
    const tRay = (qx * sy - qy * sx) / den
    const tSeg = (rx * qy - ry * qx) / den
    if (tRay >= 0 && tSeg >= 0 && tSeg <= 1) {
      return { x: cx + rx * tRay, y: cy + ry * tRay, tRay }
    }
    return null
  }

  function strokeHitsRay(pts, angle, cx, cy, tol) {
    let best = null, bestD = tol
    for (let i = 0; i < pts.length; i++) {
      const d = distToRay(pts[i], angle, cx, cy)
      if (d < bestD) { bestD = d; best = { x: pts[i].x, y: pts[i].y, idx: i } }
      if (i > 0) {
        const hit = raySegHit(cx, cy, angle, pts[i - 1], pts[i])
        if (hit) return { hit: true, at: hit }
      }
    }
    return best ? { hit: true, at: best } : { hit: false }
  }

  function nearestIdx(pts, at) {
    let bi = 0, bd = Infinity
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - at.x, pts[i].y - at.y)
      if (d < bd) { bd = d; bi = i }
    }
    return bi
  }

  function isSealedLoop(pts) {
    if (!pts || pts.length < 8) return false
    const first = pts[0], last = pts[pts.length - 1]
    const dist = Math.hypot(last.x - first.x, last.y - first.y)
    const len = pathLength(pts)
    return dist < Math.max(22, Math.min(40, 0.08 * len)) && len > 48
  }

  function isTipChopStroke(pts) {
    if (!pts || pts.length < 2) return false
    const cx = SIZE / 2, cy = SIZE / 2
    const n = state.sectors
    const a0 = -Math.PI / 2
    const a1 = a0 + (Math.PI * 2) / n
    const h0 = strokeHitsRay(pts, a0, cx, cy, 36)
    const h1 = strokeHitsRay(pts, a1, cx, cy, 36)
    if (!h0.hit || !h1.hit) return false
    let minR = Infinity
    for (const p of pts) minR = Math.min(minR, Math.hypot(p.x - cx, p.y - cy))
    const paperR = state.shape === "circle" ? SIZE * 0.46 : SIZE * 0.42
    return minR < paperR * 0.62
  }

  function tipChopPolygon(pts) {
    const cx = SIZE / 2, cy = SIZE / 2
    const n = state.sectors
    const a0 = -Math.PI / 2, a1 = a0 + (Math.PI * 2) / n
    const h0 = strokeHitsRay(pts, a0, cx, cy, 36)
    const h1 = strokeHitsRay(pts, a1, cx, cy, 36)
    if (!h0.hit || !h1.hit) return null
    const i0 = nearestIdx(pts, h0.at)
    const i1 = nearestIdx(pts, h1.at)
    const lo = Math.min(i0, i1), hi = Math.max(i0, i1)
    const mid = pts.slice(lo, hi + 1)
    if (i0 > i1) mid.reverse()
    return [{ x: cx, y: cy }, h0.at, ...mid, h1.at]
  }

  function flashSealHint() {
    const prev = hint.textContent
    hint.textContent = "要圍成密封圖形先剪得走"
    hint.classList.add("hint-flash")
    clearTimeout(flashSealHint._t)
    flashSealHint._t = setTimeout(() => {
      hint.classList.remove("hint-flash")
      if (state.step === "cut") {
        hint.textContent = "虛線係摺邊；畫面係摺起嗰一叠扇形。要圍成密封圖形先剪得走（豆／葉形窿）；尖角剪過兩條摺邊會整塊尖角飛走。左下角係展開預覽。"
      } else {
        hint.textContent = prev
      }
    }, 1600)
  }

  function commitClosedCut(pts) {
    if (!pts || pts.length < 2) return
    const sealed = isSealedLoop(pts)
    const tipChop = isTipChopStroke(pts)
    if (!sealed && !tipChop) {
      flashSealHint()
      return
    }
    snapshot()
    wctx.save()
    clipPacket(wctx)
    clipPaper(wctx)
    wctx.globalCompositeOperation = "destination-out"
    wctx.fillStyle = "#000"
    if (tipChop && !sealed) {
      drawPoly(wctx, tipChopPolygon(pts) || [{ x: SIZE / 2, y: SIZE / 2 }, ...pts])
      wctx.fill()
    } else {
      let path = pts.slice()
      const first = pts[0], last = pts[pts.length - 1]
      if (Math.hypot(last.x - first.x, last.y - first.y) > 8) {
        path.push({ x: first.x, y: first.y })
      }
      path = smoothClosePath(path)
      const cx = SIZE / 2, cy = SIZE / 2
      if (pointInPoly(cx, cy, path) || tipChop) {
        drawPoly(wctx, [{ x: cx, y: cy }, ...path])
      } else {
        drawPoly(wctx, path)
      }
      wctx.fill()
    }
    wctx.restore()
  }

  function paintAt(p, { stampOnce = false } = {}) {
    if (!inActiveSector(p.x, p.y)) { state.last = null; return }
    if (state.mode === "stamp" || stampOnce) {
      snapshot()
      wctx.save()
      clipPacket(wctx)
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
      return // finished artwork stays still
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
    if (state.step === "result") return
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
    tiltWrap.style.transform = ""
    drawView()
  }

  view.addEventListener("pointerdown", onDown)
  view.addEventListener("pointermove", onMove)
  view.addEventListener("pointerup", onUp)
  view.addEventListener("pointercancel", onUp)

  function tickIdle() {
    // finished artwork stays still — no idle spin / tilt
    requestAnimationFrame(tickIdle)
  }

  function render() {
    tiltWrap.style.transform = ""
    if (tipCard) tipCard.open = state.step === "shape" || state.step === "fold"
    view.style.cursor = state.step === "result" ? "default" : "crosshair"
    tiltWrap.classList.toggle("is-result", state.step === "result")
    tiltWrap.classList.toggle("artwork-frame", state.step === "result")
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
