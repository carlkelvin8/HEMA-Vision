const Viewer3D = {
  scene: null, camera: null, renderer: null,
  isInitialized: false, currentModel: null, animFrame: null,
  particles: [], time: 0, group: null, clock: null,
  arMode: false, video: null, videoTex: null,
  _currentContainer: null,
  // Interactive controls state
  autoRotate: true,
  userRotX: 0, userRotY: 0,
  targetRotX: 0, targetRotY: 0,
  zoom: 3.0, targetZoom: 3.0,
  isDragging: false,
  _baseScale: 1,
  // Annotation labels
  labels: [],
  _labelLayer: null,
  _gyroEnabled: false,
  _gyroQuat: null,
  _placed: false,
  _modelPos: null,
  _deviceOrient: null,
  _lastPointer: { x: 0, y: 0 },
  _pinchDist: 0,
  _pointerHandlers: null,

  init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (this._currentContainer === containerId && this.isInitialized) return;
    if (this.isInitialized) {
      this._detachRenderer();
      this._cleanupScene();
      this.isInitialized = false;
    }
    this._currentContainer = containerId;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, w / h, 0.01, 50);
    this.camera.position.set(0, 0.25, 3.0);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true,
      powerPreference: 'high-performance', stencil: false
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.physicallyCorrectLights = true;
    container.appendChild(this.renderer.domElement);

    const hemi = new THREE.HemisphereLight(0x4488cc, 0x080820, 0.6);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffeedd, 2.0);
    key.position.set(3, 5, 4); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8888ff, 0.6);
    fill.position.set(-3, 2, -2); this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xcc5555, 0.3);
    rim.position.set(0, -2, -4); this.scene.add(rim);

    this._setDarkBg();
    this.isInitialized = true;
    this._attachControls(container);
    this.animate();
    window.addEventListener('resize', () => this.resize(container));
  },

  _attachControls(container) {
    // Remove old handlers if any
    this._detachControls();
    const el = this.renderer.domElement;

    const onDown = (x, y) => {
      this.isDragging = true;
      this.autoRotate = false;
      this._lastPointer.x = x;
      this._lastPointer.y = y;
      this._downX = x; this._downY = y;
      this._downTime = Date.now();
      this._moved = 0;
    };
    const onMove = (x, y) => {
      if (!this.isDragging) return;
      const dx = x - this._lastPointer.x;
      const dy = y - this._lastPointer.y;
      this._moved += Math.abs(dx) + Math.abs(dy);
      this.targetRotY += dx * 0.01;
      this.targetRotX += dy * 0.01;
      this.targetRotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.targetRotX));
      this._lastPointer.x = x;
      this._lastPointer.y = y;
    };
    const onUp = () => {
      // Tap (minimal movement) while in AR re-places the model in front
      if (this.arMode && this._moved < 10 && (Date.now() - this._downTime) < 350) {
        this.placeInFront();
      }
      this.isDragging = false;
    };

    const mouseDown = e => onDown(e.clientX, e.clientY);
    const mouseMove = e => onMove(e.clientX, e.clientY);
    const mouseUp = () => onUp();
    const wheel = e => {
      e.preventDefault();
      this.targetZoom = Math.max(1.2, Math.min(6, this.targetZoom + (e.deltaY > 0 ? 0.3 : -0.3)));
    };
    const touchStart = e => {
      if (e.touches.length === 1) {
        onDown(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        this._pinchDist = this._touchDist(e.touches);
      }
    };
    const touchMove = e => {
      if (e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const d = this._touchDist(e.touches);
        if (this._pinchDist > 0) {
          const delta = (this._pinchDist - d) * 0.01;
          this.targetZoom = Math.max(1.2, Math.min(6, this.targetZoom + delta));
        }
        this._pinchDist = d;
      }
    };
    const touchEnd = () => { onUp(); this._pinchDist = 0; };

    el.addEventListener('mousedown', mouseDown);
    window.addEventListener('mousemove', mouseMove);
    window.addEventListener('mouseup', mouseUp);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('touchstart', touchStart, { passive: true });
    el.addEventListener('touchmove', touchMove, { passive: false });
    el.addEventListener('touchend', touchEnd);

    this._pointerHandlers = { el, mouseDown, mouseMove, mouseUp, wheel, touchStart, touchMove, touchEnd };
  },

  _detachControls() {
    if (!this._pointerHandlers) return;
    const h = this._pointerHandlers;
    h.el.removeEventListener('mousedown', h.mouseDown);
    window.removeEventListener('mousemove', h.mouseMove);
    window.removeEventListener('mouseup', h.mouseUp);
    h.el.removeEventListener('wheel', h.wheel);
    h.el.removeEventListener('touchstart', h.touchStart);
    h.el.removeEventListener('touchmove', h.touchMove);
    h.el.removeEventListener('touchend', h.touchEnd);
    this._pointerHandlers = null;
  },

  _touchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // ─── Public control methods ───
  zoomIn() { this.targetZoom = Math.max(1.2, this.targetZoom - 0.5); },
  zoomOut() { this.targetZoom = Math.min(6, this.targetZoom + 0.5); },
  toggleRotation() { this.autoRotate = !this.autoRotate; return this.autoRotate; },
  resetView() {
    this.targetRotX = 0;
    this.targetRotY = 0;
    this.userRotX = 0;
    this.userRotY = 0;
    this.targetZoom = 3.0;
    this.autoRotate = true;
  },

  _detachRenderer() {
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  },

  _cleanupScene() {
    this.particles = [];
    if (this.group) {
      this.scene?.remove(this.group);
      this.group.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
      this.group = null;
    }
  },

  _setDarkBg() {
    const bc = document.createElement('canvas');
    bc.width = bc.height = 2;
    const ctx = bc.getContext('2d');
    const g = ctx.createRadialGradient(1, 1, 0, 1, 1, 1);
    g.addColorStop(0, '#0d0d20'); g.addColorStop(1, '#050510');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 2);
    if (this.scene) this.scene.background = new THREE.CanvasTexture(bc);
  },

  resize(container) {
    if (!this.renderer || !this.camera) return;
    const w = container.clientWidth, h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  },

  animate() {
    this.animFrame = requestAnimationFrame(() => this.animate());
    this.time += 0.016;
    if (this.videoTex && this.video && this.video.readyState >= 2) this.videoTex.needsUpdate = true;

    // Smooth camera zoom
    this.zoom += (this.targetZoom - this.zoom) * 0.1;
    if (this.camera && !this.arMode) {
      this.camera.position.z = this.zoom;
      this.camera.lookAt(0, 0, 0);
    } else if (this.camera && this.arMode && this._gyroEnabled && this._deviceOrient) {
      // Anchor model in the world: rotate the camera with the device
      this._applyGyroToCamera();
    }

    if (this.group) {
      // Smooth user rotation interpolation
      this.userRotX += (this.targetRotX - this.userRotX) * 0.12;
      this.userRotY += (this.targetRotY - this.userRotY) * 0.12;

      if (this.autoRotate && !this.isDragging) {
        this.targetRotY += 0.006;
      }
      this.group.rotation.y = this.userRotY;
      this.group.rotation.x = this.userRotX;
      const mp = this._modelPos || { x: 0, y: 0, z: 0 };
      this.group.position.set(mp.x, mp.y + Math.sin(this.time * 0.6) * 0.03, mp.z);
      const b = 1 + Math.sin(this.time * 0.4) * 0.005;
      this.group.scale.set(this._baseScale * b, this._baseScale * b, this._baseScale * b);
    }
    this.particles.forEach(p => {
      p.position.x += p.vx * 0.003;
      p.position.y += p.vy * 0.003;
      p.position.z += p.vz * 0.003;
      const L = 0.9;
      if (Math.abs(p.position.x) > L) p.vx *= -1;
      if (Math.abs(p.position.y) > L) p.vy *= -1;
      if (Math.abs(p.position.z) > L) p.vz *= -1;
    });
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
    this._updateLabels();
  },

  clear() {
    this.particles = [];
    this.clearLabels();
    if (this.group) {
      this.scene?.remove(this.group);
      this.group.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
      this.group = null;
    }
  },

  destroy() {
    this.stopAR();
    this.clear();
    this._detachControls();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this._detachRenderer();
    this.renderer?.dispose();
    if (this.loader) this.loader = null;
    this.isInitialized = false;
    this._currentContainer = null;
  },

  // ─── AR CAMERA ───
  async startAR() {
    if (this.arMode && this.video?.readyState >= 2) return true;
    try {
      if (this.video && this.video.srcObject) {
        this.video.srcObject.getTracks().forEach(t => t.stop());
      }
      this.video = document.createElement('video');
      this.video.setAttribute('playsinline', '');
      this.video.setAttribute('autoplay', '');
      this.video.muted = true;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      this.video.srcObject = stream;
      await this.video.play();
      this.videoTex = new THREE.VideoTexture(this.video);
      this.videoTex.minFilter = THREE.LinearFilter;
      this.videoTex.magFilter = THREE.LinearFilter;
      if (this.scene) this.scene.background = this.videoTex;
      this.arMode = true;
      // Anchor the model as if it's resting on a surface in front of the viewer
      this._modelPos = new THREE.Vector3(0, -0.35, -2.2);
      this.autoRotate = false;
      this.targetRotX = 0.15;
      if (this.camera) {
        this.camera.position.set(0, 0, 0);
        this.camera.rotation.set(0, 0, 0);
        this.camera.lookAt(0, -0.35, -2.2);
      }
      await this.enableGyro();
      return true;
    } catch (e) {
      console.warn('AR camera not available:', e.message);
      return false;
    }
  },

  // ─── DEVICE ORIENTATION (world anchoring) ───
  async enableGyro() {
    try {
      // iOS 13+ requires explicit permission
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') { this._gyroEnabled = false; return false; }
      }
      this._orientHandler = (e) => {
        if (e.alpha == null) return;
        this._deviceOrient = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
      };
      window.addEventListener('deviceorientation', this._orientHandler, true);
      this._gyroEnabled = true;
      return true;
    } catch (e) {
      console.warn('Gyro not available:', e.message);
      this._gyroEnabled = false;
      return false;
    }
  },

  disableGyro() {
    if (this._orientHandler) {
      window.removeEventListener('deviceorientation', this._orientHandler, true);
      this._orientHandler = null;
    }
    this._gyroEnabled = false;
    this._deviceOrient = null;
  },

  _screenOrient() {
    const a = (screen.orientation && screen.orientation.angle) ||
              window.orientation || 0;
    return THREE.MathUtils.degToRad(a);
  },

  _applyGyroToCamera() {
    const d = this._deviceOrient;
    if (!d) return;
    const deg = THREE.MathUtils.degToRad;
    const alpha = deg(d.alpha);
    const beta = deg(d.beta);
    const gamma = deg(d.gamma);
    const orient = this._screenOrient();
    const zee = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler();
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° about X
    euler.set(beta, alpha, -gamma, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
    this.camera.quaternion.multiply(q1);
    this.camera.quaternion.multiply(q0.setFromAxisAngle(zee, -orient));
  },

  // Re-place the anchored model in front of where the device currently points
  placeInFront() {
    if (!this.arMode || !this.camera) return;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const dist = 2.2;
    this._modelPos = new THREE.Vector3(
      dir.x * dist,
      dir.y * dist,
      dir.z * dist
    );
    this.targetRotY = 0;
    this.userRotY = 0;
  },

  stopAR() {
    this.arMode = false;
    this.disableGyro();
    this._modelPos = new THREE.Vector3(0, 0, 0);
    this.autoRotate = true;
    if (this.camera) {
      this.camera.position.set(0, 0.25, this.zoom);
      this.camera.rotation.set(0, 0, 0);
      this.camera.lookAt(0, 0, 0);
    }
    if (this.video && this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(t => t.stop());
      this.video.srcObject = null;
    }
    this.video = null;
    this.videoTex = null;
    this._setDarkBg();
  },

  toggleAR() {
    return this.arMode ? (this.stopAR(), false) : this.startAR();
  },

  // ─── AR FLOATING CARD ───
  async showARCard(containerId, title, text, color) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.style.display = 'block';
    this.init(containerId);
    await this.startAR();
    this.clear();
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 384;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color || '#C41E3A';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(20, 20, 472, 344, 24) : ctx.rect(20, 20, 472, 344);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(20, 20, 472, 344, 24) : ctx.rect(20, 20, 472, 344);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const tw = title.split(' ');
    let tl = '', ty = 70;
    for (const w of tw) {
      const t = tl + w + ' ';
      if (ctx.measureText(t).width > 430) { ctx.fillText(tl, 256, ty); tl = w + ' '; ty += 34; }
      else { tl = t; }
    }
    ctx.fillText(tl, 256, ty);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const words = text.split(' ');
    let line = '', y = ty + 40;
    for (const w of words) {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > 430) {
        ctx.fillText(line, 256, y); line = w + ' '; y += 30;
      } else { line = test; }
    }
    ctx.fillText(line, 256, y);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthTest: false });
    const geo = new THREE.PlaneGeometry(1.4, 1.05);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0.1, -0.8);
    this.group = new THREE.Group();
    this.group.add(mesh);
    this.scene.add(this.group);
  },

  _spawnParticles(count, color, sizeRange) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      positions[i*3] = (Math.random() - 0.5) * 2;
      positions[i*3+1] = (Math.random() - 0.5) * 2;
      positions[i*3+2] = (Math.random() - 0.5) * 2;
      colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: sizeRange[0], vertexColors: true,
      transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true
    });
    const mesh = new THREE.Points(geo, mat);
    this.scene.add(mesh);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        position: { x: positions[i*3], y: positions[i*3+1], z: positions[i*3+2] },
        vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2,
        vz: (Math.random() - 0.5) * 1.2, mesh: mesh
      });
    }
  },

  _fitModel(model, targetSize) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    return maxDim > 0 ? (targetSize || 1.5) / maxDim : 1;
  },

  // ─── ANNOTATION LABELS ───
  setLabels(labelDefs) {
    this.clearLabels();
    if (!labelDefs || !labelDefs.length) return;
    const container = document.getElementById(this._currentContainer);
    if (!container) return;

    // Overlay layer that holds SVG leader lines + HTML label boxes
    const layer = document.createElement('div');
    layer.className = 'ar-label-layer';
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'ar-label-lines');
    layer.appendChild(svg);

    this.labels = labelDefs.map(def => {
      const n = new THREE.Vector3(def.dir[0], def.dir[1], def.dir[2]).normalize();
      const anchor = n.clone().multiplyScalar(0.72);   // point near model surface
      const labelPos = n.clone().multiplyScalar(1.18);  // where the label floats
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('class', 'ar-label-line');
      svg.appendChild(line);
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('class', 'ar-label-dot');
      dot.setAttribute('r', '3');
      svg.appendChild(dot);
      const box = document.createElement('div');
      box.className = 'ar-label-box';
      box.textContent = def.text;
      layer.appendChild(box);
      return { anchor, labelPos, line, dot, box };
    });

    container.appendChild(layer);
    this._labelLayer = layer;
  },

  clearLabels() {
    if (this._labelLayer && this._labelLayer.parentNode) {
      this._labelLayer.parentNode.removeChild(this._labelLayer);
    }
    this._labelLayer = null;
    this.labels = [];
  },

  _updateLabels() {
    if (!this.labels.length || !this.group || !this.camera) return;
    const container = document.getElementById(this._currentContainer);
    if (!container) return;
    const w = container.clientWidth, h = container.clientHeight;
    this.group.updateMatrixWorld();
    const tmp = new THREE.Vector3();

    const project = (localVec) => {
      tmp.copy(localVec).applyMatrix4(this.group.matrixWorld).project(this.camera);
      return {
        x: (tmp.x * 0.5 + 0.5) * w,
        y: (-tmp.y * 0.5 + 0.5) * h,
        visible: tmp.z < 1 && tmp.z > -1
      };
    };

    this.labels.forEach(l => {
      const a = project(l.anchor);
      const p = project(l.labelPos);
      if (!a.visible || !p.visible) {
        l.box.style.opacity = '0';
        l.line.style.opacity = '0';
        l.dot.style.opacity = '0';
        return;
      }
      l.box.style.opacity = '1';
      l.line.style.opacity = '1';
      l.dot.style.opacity = '1';
      // Anchor to the side of the box nearest the model
      const onRight = p.x >= a.x;
      l.box.style.left = p.x + 'px';
      l.box.style.top = p.y + 'px';
      l.box.style.transform = `translate(${onRight ? '0' : '-100%'}, -50%)`;
      l.line.setAttribute('x1', a.x); l.line.setAttribute('y1', a.y);
      l.line.setAttribute('x2', p.x); l.line.setAttribute('y2', p.y);
      l.dot.setAttribute('cx', a.x); l.dot.setAttribute('cy', a.y);
    });
  },

  showComponent(comp) {
    this.clear();
    const key = comp.id === 'rbc' ? 'rbc' : comp.id === 'wbc' ? 'wbc' :
               comp.id === 'platelet' ? 'platelet' : 'plasma';
    const gltfData = window.MODELS_GLTF?.[key];
    if (!gltfData) { console.warn('No GLTF data for', key); return; }
    const loader = new THREE.GLTFLoader();
    loader.parse(JSON.stringify(gltfData), '', (result) => {
      const model = result.scene;
      model.traverse(child => {
        if (child.isMesh) {
          child.material.envMapIntensity = 0.8;
          child.material.needsUpdate = true;
        }
      });
      const s = this._fitModel(model, 1.5);
      model.scale.set(s, s, s);
      this._baseScale = 1;
      this.group = new THREE.Group();
      this.group.add(model);
      this.scene.add(this.group);
      const pc = comp.id === 'rbc' ? '#CC3333' : comp.id === 'wbc' ? '#E8E0D0' :
                comp.id === 'platelet' ? '#D4C5A9' : '#F5E6B8';
      this._spawnParticles(comp.id === 'rbc' ? 40 : 25, pc, [0.006, 0.018]);
      this.setLabels(window.AR_LABELS?.[comp.id]);
    }, (err) => console.error(key + ' GLTF parse error:', err));
  },

  showPattern(pattern) {
    this.clear();
    const gltfData = window.MODELS_GLTF?.[pattern.id];
    if (!gltfData) { console.warn('No GLTF data for', pattern.id); return; }
    const loader = new THREE.GLTFLoader();
    loader.parse(JSON.stringify(gltfData), '', (result) => {
      const model = result.scene;
      model.traverse(child => {
        if (child.isMesh) {
          child.material.envMapIntensity = 0.6;
          child.material.needsUpdate = true;
        }
      });
      const s = this._fitModel(model, 1.5);
      model.scale.set(s, s, s);
      this._baseScale = 1;
      this.group = new THREE.Group();
      this.group.add(model);
      this.scene.add(this.group);
      this.setLabels(window.AR_LABELS?.[pattern.id]);
    }, (err) => console.error(pattern.id + ' GLTF parse error:', err));
  }
};
