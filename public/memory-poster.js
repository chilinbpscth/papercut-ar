'use strict';
/* =====================================================================
   紀念海報（裱畫）
   線上展開設計 + 實體剪紙相片 → 證書式米紙裱框海報，可下載 PNG。
   ===================================================================== */

const MP_W = 1600;
const MP_H = 1100;
const MP_RED = '#8E2528';
const MP_GOLD = '#C4A35A';
const MP_VERMILION = '#BC3532';
const MP_PAPER = '#F6EFE2';
const MP_INK = '#2C2822';
const MP_MUTED = '#6E6558';

function hkTodayString(date = new Date()){
  try{
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);
  }catch(_){
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

function posterLayout(W = MP_W, H = MP_H){
  const margin = Math.round(W * 0.045);
  const frameOuter = 18;
  const frameInner = 10;
  const contentX = margin + frameOuter + frameInner;
  const contentY = margin + frameOuter + frameInner;
  const contentW = W - 2 * contentX;
  const contentH = H - 2 * contentY;
  const titleY = contentY + Math.round(contentH * 0.08);
  const footerY = contentY + contentH - Math.round(contentH * 0.06);
  const panelTop = contentY + Math.round(contentH * 0.16);
  const panelBottom = footerY - Math.round(contentH * 0.1);
  const panelH = panelBottom - panelTop;
  const gap = Math.round(contentW * 0.04);
  const panelW = Math.floor((contentW - gap) / 2);
  return {
    W, H, margin, frameOuter, frameInner,
    contentX, contentY, contentW, contentH,
    titleY, footerY, panelTop, panelH, gap, panelW,
    leftPanel: { x: contentX, y: panelTop, w: panelW, h: panelH },
    rightPanel: { x: contentX + panelW + gap, y: panelTop, w: panelW, h: panelH },
    labelOffset: Math.round(contentH * 0.045),
  };
}

function designSVGMarkup(){
  if (typeof previewMarkup !== 'function'){
    throw new Error('previewMarkup 未就緒');
  }
  const body = previewMarkup('mpx').replace(/var\(--red\)/g, '#BC3532');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="70 70 860 860">${body}</svg>`;
}

function loadImageFromURL(url){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('圖片載入失敗'));
    img.src = url;
  });
}

function svgToImage(svgText){
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  return loadImageFromURL(url).finally(() => URL.revokeObjectURL(url));
}

async function designImageFromPreview(){
  if (globalThis.__paperAR?.renderTextureCanvas){
    try{ return await globalThis.__paperAR.renderTextureCanvas(); }
    catch(_){ /* fall through to SVG path */ }
  }
  return svgToImage(designSVGMarkup());
}

function roundRectPath(ctx, x, y, w, h, r){
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawMountBackground(ctx, layout){
  const { W, H, margin, frameOuter, frameInner } = layout;
  ctx.fillStyle = '#1A1410';
  ctx.fillRect(0, 0, W, H);

  /* vermilion outer frame */
  ctx.fillStyle = MP_VERMILION;
  ctx.fillRect(margin, margin, W - 2 * margin, H - 2 * margin);

  /* gold inner band */
  ctx.fillStyle = MP_GOLD;
  ctx.fillRect(
    margin + frameOuter * 0.35,
    margin + frameOuter * 0.35,
    W - 2 * (margin + frameOuter * 0.35),
    H - 2 * (margin + frameOuter * 0.35)
  );

  /* deep vermilion rim */
  ctx.fillStyle = MP_RED;
  ctx.fillRect(
    margin + frameOuter,
    margin + frameOuter,
    W - 2 * (margin + frameOuter),
    H - 2 * (margin + frameOuter)
  );

  /* rice-paper mount */
  const pad = frameOuter + frameInner;
  ctx.fillStyle = MP_PAPER;
  ctx.fillRect(margin + pad, margin + pad, W - 2 * (margin + pad), H - 2 * (margin + pad));

  /* subtle paper grain */
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 120; i++){
    const x = margin + pad + Math.random() * (W - 2 * (margin + pad));
    const y = margin + pad + Math.random() * (H - 2 * (margin + pad));
    ctx.fillStyle = i % 2 ? '#000' : '#fff';
    ctx.fillRect(x, y, 2 + Math.random() * 6, 1);
  }
  ctx.restore();
}

function drawContainImage(ctx, img, x, y, w, h, bg = '#FBF6EC'){
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 10);
  ctx.clip();
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  if (img){
    const iw = img.width || img.videoWidth || 1;
    const ih = img.height || img.videoHeight || 1;
    const scale = Math.min(w / iw, h / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = MP_MUTED;
    ctx.font = `${Math.round(h * 0.07)}px "Songti TC","Noto Serif TC",serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('尚未加入相片', x + w / 2, y + h / 2);
  }
  ctx.restore();
  ctx.strokeStyle = MP_GOLD;
  ctx.lineWidth = 3;
  roundRectPath(ctx, x, y, w, h, 10);
  ctx.stroke();
}

function drawPosterText(ctx, layout, { title, name, date }){
  const { contentX, contentW, titleY, footerY, leftPanel, rightPanel, labelOffset } = layout;
  ctx.fillStyle = MP_INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(layout.H * 0.055)}px "Songti TC","Noto Serif TC",serif`;
  ctx.fillText(title || '剪紙作品', contentX + contentW / 2, titleY);

  ctx.font = `500 ${Math.round(layout.H * 0.028)}px -apple-system,"PingFang TC","Noto Sans TC",sans-serif`;
  ctx.fillStyle = MP_MUTED;
  ctx.fillText('線上設計', leftPanel.x + leftPanel.w / 2, leftPanel.y + leftPanel.h + labelOffset);
  ctx.fillText('實體作品', rightPanel.x + rightPanel.w / 2, rightPanel.y + rightPanel.h + labelOffset);

  ctx.fillStyle = MP_INK;
  ctx.font = `600 ${Math.round(layout.H * 0.032)}px "Songti TC","Noto Serif TC",serif`;
  const who = (name || '學生').trim();
  const when = (date || hkTodayString()).trim();
  ctx.fillText(`${who}　·　${when}`, contentX + contentW / 2, footerY);

  ctx.font = `${Math.round(layout.H * 0.02)}px -apple-system,"PingFang TC",sans-serif`;
  ctx.fillStyle = MP_VERMILION;
  ctx.fillText('剪紙', contentX + contentW / 2, footerY + Math.round(layout.H * 0.035));
}

/**
 * Compose commemorative poster onto canvas.
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas
 * @param {{ designImage?: CanvasImageSource, photoImage?: CanvasImageSource, title?: string, name?: string, date?: string, seedRandom?: () => number }} opts
 */
function composeMemoryPoster(canvas, opts = {}){
  const layout = posterLayout(canvas.width || MP_W, canvas.height || MP_H);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d 不可用');
  const rnd = opts.seedRandom || Math.random;
  const _random = Math.random;
  if (opts.seedRandom) Math.random = rnd;
  try{
    drawMountBackground(ctx, layout);
    drawContainImage(ctx, opts.designImage || null, layout.leftPanel.x, layout.leftPanel.y, layout.leftPanel.w, layout.leftPanel.h);
    drawContainImage(ctx, opts.photoImage || null, layout.rightPanel.x, layout.rightPanel.y, layout.rightPanel.w, layout.rightPanel.h, '#EDE6D8');
    drawPosterText(ctx, layout, {
      title: opts.title,
      name: opts.name,
      date: opts.date,
    });
  } finally {
    if (opts.seedRandom) Math.random = _random;
  }
  return layout;
}

/* ---------- UI / camera / download ---------- */
const mpState = {
  photoURL: null,
  photoImage: null,
  designImage: null,
  stream: null,
  cameraMode: false,
};

function $(sel){ return document.querySelector(sel); }

function setHint(text){
  const el = $('#mp-hint');
  if (el) el.textContent = text;
}

function revokePhotoURL(){
  if (mpState.photoURL){
    URL.revokeObjectURL(mpState.photoURL);
    mpState.photoURL = null;
  }
}

function stopCamera(){
  const video = $('#mp-video');
  if (mpState.stream){
    mpState.stream.getTracks().forEach(t => t.stop());
    mpState.stream = null;
  }
  if (video){
    video.srcObject = null;
    video.classList.remove('active');
  }
  mpState.cameraMode = false;
  const snap = $('#mp-snap');
  if (snap) snap.hidden = true;
}

async function refreshPosterPreview(){
  const canvas = $('#mp-canvas');
  if (!canvas) return;
  if (!mpState.designImage){
    try{ mpState.designImage = await designImageFromPreview(); }
    catch(err){
      setHint('無法產生線上設計預覽：' + (err.message || err));
      return;
    }
  }
  composeMemoryPoster(canvas, {
    designImage: mpState.designImage,
    photoImage: mpState.photoImage,
    title: $('#mp-artwork-title')?.value,
    name: $('#mp-student-name')?.value,
    date: $('#mp-date')?.value,
  });
}

async function openMemoryPoster(){
  const modal = $('#mp-modal');
  if (!modal) return;
  mpState.designImage = null;
  mpState.photoImage = null;
  revokePhotoURL();
  stopCamera();
  const dateInput = $('#mp-date');
  if (dateInput && !dateInput.value) dateInput.value = hkTodayString();
  const titleInput = $('#mp-artwork-title');
  if (titleInput && !titleInput.value) titleInput.value = '剪紙作品';
  modal.hidden = false;
  $('#mp-canvas').style.display = '';
  setHint('左邊係線上設計，右邊請影／上載實體剪紙相片。');
  await refreshPosterPreview();
}

function closeMemoryPoster(){
  const modal = $('#mp-modal');
  if (modal) modal.hidden = true;
  stopCamera();
  revokePhotoURL();
  mpState.photoImage = null;
  mpState.designImage = null;
}

async function startCamera(){
  stopCamera();
  if (!navigator.mediaDevices?.getUserMedia){
    setHint('此瀏覽器唔支援相機，請改用「上載」。');
    $('#mp-file')?.click();
    return;
  }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
    });
    mpState.stream = stream;
    const video = $('#mp-video');
    const canvas = $('#mp-canvas');
    video.srcObject = stream;
    await video.play();
    video.classList.add('active');
    if (canvas) canvas.style.display = 'none';
    mpState.cameraMode = true;
    $('#mp-snap').hidden = false;
    setHint('對準實體剪紙，再撳「撳快門」。若相機打唔開，請用「上載」。');
  }catch(err){
    setHint('無法開啟相機（權限或裝置限制）。請改用「上載」。');
    $('#mp-file')?.click();
  }
}

async function snapFromCamera(){
  const video = $('#mp-video');
  if (!video || !mpState.stream) return;
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 960;
  const shot = document.createElement('canvas');
  shot.width = w; shot.height = h;
  shot.getContext('2d').drawImage(video, 0, 0, w, h);
  stopCamera();
  $('#mp-canvas').style.display = '';
  revokePhotoURL();
  mpState.photoURL = shot.toDataURL('image/jpeg', 0.92);
  mpState.photoImage = await loadImageFromURL(mpState.photoURL);
  setHint('已影相。可改標題／姓名後下載。');
  await refreshPosterPreview();
}

async function onFileChosen(file){
  if (!file) return;
  stopCamera();
  $('#mp-canvas').style.display = '';
  revokePhotoURL();
  mpState.photoURL = URL.createObjectURL(file);
  try{
    mpState.photoImage = await loadImageFromURL(mpState.photoURL);
    setHint('已上載相片。可改標題／姓名後下載。');
    await refreshPosterPreview();
  }catch(err){
    setHint('相片讀取失敗，請再試另一張圖。');
  }
}

function downloadPoster(){
  const canvas = $('#mp-canvas');
  if (!canvas) return;
  if (!mpState.photoImage){
    setHint('請先影相或上載實體作品相片，再下載。');
    return;
  }
  composeMemoryPoster(canvas, {
    designImage: mpState.designImage,
    photoImage: mpState.photoImage,
    title: $('#mp-artwork-title')?.value,
    name: $('#mp-student-name')?.value,
    date: $('#mp-date')?.value,
  });
  const a = document.createElement('a');
  const who = ($('#mp-student-name')?.value || '剪紙').trim().replace(/[\\/:*?"<>|]+/g, '_') || '剪紙';
  a.download = `紀念海報-${who}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  setHint('已開始下載 PNG。若無反應，請長按預覽圖儲存。');
}

function bindMemoryPosterUI(){
  const openBtn = $('#btn-memory-poster');
  if (!openBtn || openBtn.dataset.mpBound) return;
  openBtn.dataset.mpBound = '1';
  openBtn.addEventListener('click', () => openMemoryPoster());
  $('#mp-close')?.addEventListener('click', closeMemoryPoster);
  $('#mp-dismiss')?.addEventListener('click', closeMemoryPoster);
  $('#mp-camera')?.addEventListener('click', () => startCamera());
  $('#mp-snap')?.addEventListener('click', () => snapFromCamera());
  $('#mp-upload')?.addEventListener('click', () => $('#mp-file')?.click());
  $('#mp-file')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    onFileChosen(file);
  });
  $('#mp-download')?.addEventListener('click', () => downloadPoster());
  for (const id of ['#mp-artwork-title', '#mp-student-name', '#mp-date']){
    $(id)?.addEventListener('input', () => { refreshPosterPreview(); });
  }
  $('#mp-modal')?.addEventListener('click', e => {
    if (e.target === $('#mp-modal')) closeMemoryPoster();
  });
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', bindMemoryPosterUI);
} else {
  bindMemoryPosterUI();
}

globalThis.__memoryPoster = {
  hkTodayString,
  posterLayout,
  composeMemoryPoster,
  designSVGMarkup,
  openMemoryPoster,
  closeMemoryPoster,
  MP_W, MP_H,
};
