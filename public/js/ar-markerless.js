// ================================================
// HEMA-Vision — Markerless AR viewer
// Live camera background + floating 3D model.
// No printed marker required.
// ================================================
(function () {
  const params = new URLSearchParams(location.search);
  const modelId = params.get('model') || 'rbc';

  function goBack() {
    if (document.referrer && document.referrer.indexOf(location.host) !== -1) history.back();
    else location.href = '/';
  }
  window.goBack = goBack;

  function showError(msg) {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('err-msg').textContent = msg;
    document.getElementById('err').classList.add('show');
  }

  function lookupName(id) {
    try {
      const c = (window.AppData?.bloodComponents || []).find(x => x.id === id);
      if (c) return c.name;
      const p = (window.AppData?.patterns || []).find(x => x.id === id);
      if (p) return p.name;
    } catch (e) {}
    return id.toUpperCase();
  }

  const AR = {
    scene: null, camera: null, renderer: null, group: null,
    zoom: 3.0, targetZoom: 3.0, baseScale: 1,
    autoRotate: true, isDragging: false,
    rotX: 0, rotY: 0, tRotX: 0, tRotY: 0,
    last: { x: 0, y: 0 }, pinch: 0, moved: 0,
    labels: [], svg: null, time: 0,

    zoomIn() { this.targetZoom = Math.max(1.2, this.targetZoom - 0.5); },
    zoomOut() { this.targetZoom = Math.min(6, this.targetZoom + 0.5); },
    toggleRotate() {
      this.autoRotate = !this.autoRotate;
      document.getElementById('rotbtn').textContent = this.autoRotate ? '⏸️' : '▶️';
    },
    reset() { this.tRotX = 0; this.tRotY = 0; this.targetZoom = 3.0; this.autoRotate = true;
      document.getElementById('rotbtn').textContent = '⏸️'; },

    async init() {
      if (!window.MODELS_GLTF || !window.MODELS_GLTF[modelId]) {
        showError('3D model "' + modelId + '" not found.'); return;
      }
      document.getElementById('title').childNodes[0].nodeValue = lookupName(modelId);

      this.scene = new THREE.Scene();
      const w = window.innerWidth, h = window.innerHeight;
      this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
      this.camera.position.set(0, 0, this.zoom);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.3;
      document.getElementById('gl').appendChild(this.renderer.domElement);

      this.scene.add(new THREE.HemisphereLight(0x88aaff, 0x223344, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 5, 4); this.scene.add(key);
      const fill = new THREE.DirectionalLight(0x99aaff, 0.5); fill.position.set(-3, 1, -2); this.scene.add(fill);

      this.svg = document.querySelector('#labels svg');

      await this.startCamera();
      this.loadModel();
      this.attachControls();
      window.addEventListener('resize', () => this.onResize());
      this.animate();
    },

    async startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        const video = document.getElementById('cam');
        video.srcObject = stream;
        await video.play();
        document.getElementById('loader').style.display = 'none';
      } catch (e) {
        console.warn('Camera error:', e);
        // Show model over a dark background even if camera denied
        document.getElementById('loader').style.display = 'none';
        document.getElementById('cam').style.background =
          'radial-gradient(circle at 50% 40%, #12172B, #0A0E1A)';
        document.getElementById('hint').textContent =
          '⚠️ Camera blocked — showing model on plain background';
      }
    },

    loadModel() {
      const gltf = window.MODELS_GLTF[modelId];
      const loader = new THREE.GLTFLoader();
      loader.parse(JSON.stringify(gltf), '', (res) => {
        const model = res.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const s = 1.6 / maxDim;
        model.scale.set(s, s, s);
        this.baseScale = 1;
        this.group = new THREE.Group();
        this.group.add(model);
        this.scene.add(this.group);
        this.setupLabels();
      }, (err) => { console.error(err); showError('Failed to load 3D model.'); });
    },

    setupLabels() {
      const defs = (window.AR_LABELS && window.AR_LABELS[modelId]) || [];
      const svgNS = 'http://www.w3.org/2000/svg';
      this.labels = defs.map(def => {
        const n = new THREE.Vector3(def.dir[0], def.dir[1], def.dir[2]).normalize();
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('stroke', 'rgba(255,255,255,0.85)');
        line.setAttribute('stroke-width', '1.5');
        this.svg.appendChild(line);
        const dot = document.createElementNS(svgNS, 'circle');
        dot.setAttribute('r', '3'); dot.setAttribute('fill', '#F59E0B');
        this.svg.appendChild(dot);
        const box = document.createElement('div');
        box.className = 'lbl'; box.textContent = def.text;
        document.getElementById('labels').appendChild(box);
        return { anchor: n.clone().multiplyScalar(0.78), lp: n.clone().multiplyScalar(1.2), line, dot, box };
      });
    },

    updateLabels() {
      if (!this.labels.length || !this.group) return;
      const w = window.innerWidth, h = window.innerHeight;
      this.group.updateMatrixWorld();
      const tmp = new THREE.Vector3();
      const proj = (v) => {
        tmp.copy(v).applyMatrix4(this.group.matrixWorld).project(this.camera);
        return { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, vis: tmp.z < 1 };
      };
      this.labels.forEach(l => {
        const a = proj(l.anchor), p = proj(l.lp);
        const show = a.vis && p.vis;
        l.box.style.opacity = show ? '1' : '0';
        l.line.style.opacity = show ? '1' : '0';
        l.dot.style.opacity = show ? '1' : '0';
        if (!show) return;
        const right = p.x >= a.x;
        l.box.style.left = p.x + 'px';
        l.box.style.top = p.y + 'px';
        l.box.style.transform = `translate(${right ? '0' : '-100%'}, -50%)`;
        l.line.setAttribute('x1', a.x); l.line.setAttribute('y1', a.y);
        l.line.setAttribute('x2', p.x); l.line.setAttribute('y2', p.y);
        l.dot.setAttribute('cx', a.x); l.dot.setAttribute('cy', a.y);
      });
    },

    attachControls() {
      const el = this.renderer.domElement;
      const down = (x, y) => { this.isDragging = true; this.autoRotate = false;
        document.getElementById('rotbtn').textContent = '▶️';
        this.last.x = x; this.last.y = y; this.moved = 0; };
      const move = (x, y) => {
        if (!this.isDragging) return;
        const dx = x - this.last.x, dy = y - this.last.y;
        this.moved += Math.abs(dx) + Math.abs(dy);
        this.tRotY += dx * 0.01; this.tRotX += dy * 0.01;
        this.tRotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.tRotX));
        this.last.x = x; this.last.y = y;
      };
      const up = () => { this.isDragging = false; };
      const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

      el.addEventListener('mousedown', e => down(e.clientX, e.clientY));
      window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
      window.addEventListener('mouseup', up);
      el.addEventListener('wheel', e => { e.preventDefault();
        this.targetZoom = Math.max(1.2, Math.min(6, this.targetZoom + (e.deltaY > 0 ? 0.3 : -0.3))); }, { passive: false });
      el.addEventListener('touchstart', e => {
        if (e.touches.length === 1) down(e.touches[0].clientX, e.touches[0].clientY);
        else if (e.touches.length === 2) { this.isDragging = false; this.pinch = dist(e.touches); }
      }, { passive: true });
      el.addEventListener('touchmove', e => {
        if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY);
        else if (e.touches.length === 2) { e.preventDefault();
          const d = dist(e.touches);
          if (this.pinch > 0) this.targetZoom = Math.max(1.2, Math.min(6, this.targetZoom + (this.pinch - d) * 0.01));
          this.pinch = d; }
      }, { passive: false });
      el.addEventListener('touchend', up);
    },

    onResize() {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    },

    animate() {
      requestAnimationFrame(() => this.animate());
      this.time += 0.016;
      this.zoom += (this.targetZoom - this.zoom) * 0.1;
      this.camera.position.z = this.zoom;
      this.camera.lookAt(0, 0, 0);
      if (this.group) {
        this.rotX += (this.tRotX - this.rotX) * 0.12;
        this.rotY += (this.tRotY - this.rotY) * 0.12;
        if (this.autoRotate && !this.isDragging) this.tRotY += 0.006;
        this.group.rotation.set(this.rotX, this.rotY, 0);
        this.group.position.y = Math.sin(this.time * 0.6) * 0.04;
      }
      this.renderer.render(this.scene, this.camera);
      this.updateLabels();
    }
  };

  window.AR = AR;
  window.addEventListener('load', () => AR.init());
})();
