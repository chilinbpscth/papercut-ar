'use strict';
/* =====================================================================
   In-page AR（8th Wall / Niantic Spatial XR Engine，self-host）
   - 「AR 擺放」掣嘅調度器：支援嘅手機/平板行 in-page AR；
     唔支援就後備返 ar.js 嘅 3D 預覽／Quick Look 彈窗
   - 兒童友善流程：權限預告 → 掃描引導 → 追蹤穩定先俾擺 → 影相留念
   - engine 檔案 vendor 自 dawnbreaker-ar-kit（v1.0.0，釘死）
   ===================================================================== */
(() => {
  const $ = s => document.querySelector(s);
  const btnAR = $('#btn-ar');
  if (!btnAR) return;

  const VENDOR = 'vendor';
  let enginePromise = null;         /* 三個 script 載入（一次過） */
  let modulesAdded = false;
  let running = false;
  let trackingOk = false, placed = false;
  let paper = null, lastSurfaceY = null;
  const SURFACE_TYPES = ['DETECTED_SURFACE', 'ESTIMATED_SURFACE'];

  /* ---------- script 懶載入 ---------- */
  function loadScript(src, attrs){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      for (const k in (attrs || {})) s.setAttribute(k, attrs[k]);
      s.onload = resolve;
      s.onerror = () => reject(new Error('script load failed: ' + src));
      document.head.appendChild(s);
    });
  }
  function loadEngine(){
    if (!enginePromise){
      enginePromise = (async () => {
        if (typeof THREE === 'undefined')
          await loadScript(`${VENDOR}/three/three-0.149.0.min.js`);
        if (typeof XR8 === 'undefined'){
          const xrReady = new Promise(res => window.addEventListener('xrloaded', res, { once: true }));
          await loadScript(`${VENDOR}/8thwall/1.0.0/xr.js`, { 'data-preload-chunks': 'slam' });
          await xrReady;
        }
        if (typeof XRExtras === 'undefined')
          await loadScript(`${VENDOR}/8thwall-xrextras/1.0.0/xrextras.js`);
      })();
      enginePromise.catch(() => { enginePromise = null; });
    }
    return enginePromise;
  }

  /* ---------- three.js 場景 ---------- */
  const groundPlane = typeof THREE !== 'undefined' ? null : null; /* 延後建立 */
  let _plane = null, _raycaster = null, _hit = null;

  function makePaperMesh(textureCanvas){
    const tex = new THREE.CanvasTexture(textureCanvas);
    tex.anisotropy = 4;
    const mat = new THREE.MeshLambertMaterial({
      map: tex, transparent: false, alphaTest: 0.5, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    return mesh;
  }

  const scenePipelineModule = () => ({
    name: 'papercut-live',
    onStart: ({ canvas }) => {
      const { scene, camera } = XR8.Threejs.xrScene();
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const dir = new THREE.DirectionalLight(0xffffff, 0.5);
      dir.position.set(1, 4, 2);
      scene.add(dir);
      scene.add(paper);
      camera.position.set(0, 1.3, 0);
      XR8.XrController.updateCameraProjectionMatrix({
        origin: camera.position, facing: camera.quaternion,
      });
      if (!canvas.__paperBound){
        canvas.__paperBound = true;
        canvas.addEventListener('touchstart', e => {
          if (e.touches.length > 1) return;
          placeAt(e.touches[0].clientX, e.touches[0].clientY);
        });
        canvas.addEventListener('mousedown', e => placeAt(e.clientX, e.clientY));
      }
    },
    onUpdate: ({ processCpuResult }) => {
      const reality = processCpuResult && processCpuResult.reality;
      if (!reality || !reality.trackingStatus) return;
      const ok = reality.trackingStatus === 'NORMAL';
      if (ok !== trackingOk){
        trackingOk = ok;
        if (!placed) setStatus(ok ? 'ready' : 'scanning');
      }
    },
    onCameraStatusChange: ({ status }) => {
      if (status === 'failed') showCameraTrouble();
    },
    onException: err => console.error('XR8 exception:', err),
  });

  function placeAt(x, y){
    if (!running || !trackingOk || !paper) return;
    const { camera } = XR8.Threejs.xrScene();
    const cam = camera.position;
    const raw = XR8.XrController.hitTest(x / innerWidth, y / innerHeight,
      [...SURFACE_TYPES, 'FEATURE_POINT']) || [];
    const good = raw
      .map(h => ({ ...h, d: Math.hypot(h.position.x - cam.x, h.position.y - cam.y, h.position.z - cam.z) }))
      .filter(h => h.d > 0.3 && h.d < 4 && h.position.y < cam.y - 0.1)
      .sort((a, b) =>
        (SURFACE_TYPES.includes(a.type) ? 0 : 1) - (SURFACE_TYPES.includes(b.type) ? 0 : 1) ||
        a.d - b.d);
    if (good.length){
      const p = good[0].position;
      paper.position.set(p.x, p.y + 0.005, p.z);
      lastSurfaceY = p.y;
    } else {
      if (!_plane){
        _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        _raycaster = new THREE.Raycaster();
        _hit = new THREE.Vector3();
      }
      _plane.constant = -(lastSurfaceY ?? 0);
      _raycaster.setFromCamera(
        { x: (x / innerWidth) * 2 - 1, y: -(y / innerHeight) * 2 + 1 }, camera);
      if (!_raycaster.ray.intersectPlane(_plane, _hit)) return;
      paper.position.set(_hit.x, (lastSurfaceY ?? 0) + 0.005, _hit.z);
    }
    paper.visible = true;
    if (!placed){
      placed = true;
      setStatus('placed');
      $('#arlive-photo-btn').hidden = false;
    }
  }

  /* ---------- UI ---------- */
  const STATUS_TEXT = {
    scanning: '慢慢咁郁吓部機，影住張檯或者地下～ 📱',
    ready: '得喇！㩒一下想擺剪紙嘅位置 👆',
    placed: '好靚呀！行近啲、繞住佢睇吓，影返張相留念啦 📷',
  };
  function setStatus(key){
    $('#arlive-status').textContent = STATUS_TEXT[key] || '';
  }
  function showCameraTrouble(){
    $('#arlive-intro-text').innerHTML =
      '開唔到相機喎。去 <b>設定 → Safari → 相機</b> 揀「允許」，再返嚟試多次啦～';
    $('#arlive-intro').hidden = false;
    $('#arlive-hud').hidden = true;
    $('#arlive-start').textContent = '再試一次';
    $('#arlive-start').disabled = false;
  }

  async function requestMotionPermission(){
    try {
      if (typeof DeviceMotionEvent !== 'undefined' &&
          typeof DeviceMotionEvent.requestPermission === 'function'){
        if (await DeviceMotionEvent.requestPermission() !== 'granted') return false;
      }
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function'){
        await DeviceOrientationEvent.requestPermission().catch(() => {});
      }
      return true;
    } catch (_){ return false; }
  }

  async function startSession(){
    $('#arlive-start').disabled = true;
    const motionOk = await requestMotionPermission();
    if (!motionOk){
      $('#arlive-intro-text').innerHTML =
        '要有「動作與方向」權限先玩到 AR～ 撳「允許」再試多次啦。';
      $('#arlive-start').textContent = '再試一次';
      $('#arlive-start').disabled = false;
      return;
    }
    const canvasTex = await __paperAR.renderTextureCanvas();
    paper = makePaperMesh(canvasTex);
    placed = false; trackingOk = false; lastSurfaceY = null;
    if (!modulesAdded){
      XR8.XrController.configure({ scale: 'absolute', enableWorldPoints: false });
      if (XR8.CanvasScreenshot)
        XR8.CanvasScreenshot.configure({ maxDimension: 1920, jpgCompression: 90 });
      XR8.addCameraPipelineModules([
        XR8.GlTextureRenderer.pipelineModule(),
        XR8.Threejs.pipelineModule(),
        XR8.XrController.pipelineModule(),
        XRExtras.FullWindowCanvas.pipelineModule(),
        ...(XR8.CanvasScreenshot ? [XR8.CanvasScreenshot.pipelineModule()] : []),
        scenePipelineModule(),
      ]);
      modulesAdded = true;
    }
    const canvas = $('#arlive-canvas');
    canvas.style.display = 'block';
    XR8.run({ canvas });
    running = true;
    $('#arlive-intro').hidden = true;
    $('#arlive-hud').hidden = false;
    $('#arlive-photo-btn').hidden = true;
    setStatus('scanning');
  }

  function closeLive(){
    if (running){ try { XR8.stop(); } catch (_) {} running = false; }
    if (paper){
      const { scene } = XR8.Threejs.xrScene() || {};
      if (scene) scene.remove(paper);
      paper = null;
    }
    /* FullWindowCanvas 將 canvas 搬咗去 body，一定要自己收埋佢，
       唔係就會留一格定格畫面擋住成個 app */
    $('#arlive-canvas').style.display = 'none';
    $('#arlive').hidden = true;
    $('#arlive-photo').hidden = true;
  }

  let photoFile = null;

  async function takePhoto(){
    if (!XR8.CanvasScreenshot) return;
    const flash = $('#arlive-flash');
    flash.style.opacity = '0.9';
    setTimeout(() => { flash.style.opacity = '0'; }, 180);
    try {
      const jpeg = await XR8.CanvasScreenshot.takeScreenshot();
      const bin = atob(jpeg);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      photoFile = new File([bytes], 'papercut-ar.jpg', { type: 'image/jpeg' });
      $('#arlive-photo-img').src = 'data:image/jpeg;base64,' + jpeg;
      $('#arlive-photo').hidden = false;
    } catch (err){
      console.error(err);
      setStatus('placed');
    }
  }

  /* iOS Safari 對 <a download> + data URL 會靜默失敗，
     所以行 Web Share API（原生面板有「儲存影像」直落相簿）；
     唔支援先退返 blob URL download */
  async function savePhoto(){
    if (!photoFile) return;
    if (navigator.canShare && navigator.canShare({ files: [photoFile] })){
      try {
        await navigator.share({ files: [photoFile] });
        return;
      } catch (err){
        if (err && err.name === 'AbortError') return;   /* 用戶自己取消 */
        console.error(err);
      }
    }
    const url = URL.createObjectURL(photoFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'papercut-ar.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /* ---------- 調度：撳「AR 擺放」 ---------- */
  async function dispatch(){
    btnAR.disabled = true;
    try {
      await loadEngine();
      const compatible = XR8.XrDevice.isDeviceBrowserCompatible({
        allowedDevices: XR8.XrConfig.device().MOBILE,
      });
      if (compatible){
        $('#arlive').hidden = false;
        $('#arlive-intro').hidden = false;
        $('#arlive-hud').hidden = true;
        $('#arlive-intro-text').innerHTML =
          '將你嘅剪紙擺入現實世界！<br>等陣手機會問你借<b>相機</b>同<b>動作感應</b>，撳「允許」就得喇～';
        $('#arlive-start').textContent = '開始';
        $('#arlive-start').disabled = false;
        return;
      }
    } catch (err){
      console.error('engine 載入唔到，行後備路徑：', err);
    } finally {
      btnAR.disabled = false;
    }
    /* 後備：ar.js 嘅 3D 預覽／Quick Look 彈窗 */
    if (__paperAR.openViewerAR) __paperAR.openViewerAR();
  }

  btnAR.addEventListener('click', dispatch);
  $('#arlive-start').addEventListener('click', startSession);
  $('#arlive-close').addEventListener('click', closeLive);
  $('#arlive-photo-btn').addEventListener('click', takePhoto);
  $('#arlive-photo-save').addEventListener('click', savePhoto);
  $('#arlive-photo-close').addEventListener('click', () => { $('#arlive-photo').hidden = true; });
})();
