const App = {
  currentModule: '',
  quizState: null,
  mythFactIndex: 0,
  examinedEvidence: new Set(),
  scores: {},

  init() {
    this.renderHome();
    this.renderModuleSelection();
    this.renderAbout();
    Nav.go('home');
  },

  onPageChange(page, params) {
    switch (page) {
      case 'home': this.renderHome(); break;
      case 'modules': this.renderModuleSelection(); break;
      case 'about': this.renderAbout(); break;
      case 'components': this.initComponents(params); break;
      case 'patterns': this.initPatterns(params); break;
      case 'mythfact': this.initMythFact(); break;
      case 'crimescene': this.initCrimeScene(); break;
      case 'quiz': this.initQuiz(params?.module || this.currentModule); break;
    }
  },

  // ─── AR TOGGLE ───
  async toggleAR() {
    const btn = document.querySelector('.ar-btn');
    // Check current page
    const page = Nav.history?.[Nav.history.length - 1] || '';
    const isCardPage = page === 'mythfact' || page === 'quiz' || page.startsWith('quiz?') || page === 'crimescene';

    if (Viewer3D.arMode) {
      if (isCardPage) {
        Viewer3D.destroy();
        document.getElementById('ar-card-viewer').style.display = 'none';
      } else {
        Viewer3D.stopAR();
      }
      btn?.classList.remove('active');
      btn && (btn.innerHTML = '<span class="ar-dot"></span> AR');
      document.querySelector('.ar-hint')?.remove();
      if (this._arCardInterval) { clearInterval(this._arCardInterval); this._arCardInterval = null; }
      return;
    }

    if (isCardPage) {
      btn?.classList.add('active');
      btn && (btn.innerHTML = '<span class="ar-dot"></span> AR ON');
      const hint = document.createElement('div');
      hint.className = 'ar-hint';
      document.querySelector('.page.active')?.appendChild(hint);
      if (page === 'mythfact') {
        hint.textContent = '📖 Myth/Fact cards in AR — auto-rotates every 8s';
        this._showARMythFact();
      } else if (page === 'quiz' || page.startsWith('quiz?')) {
        hint.textContent = '📝 Quiz answers floating in AR';
        this._showARQuizCard();
      } else if (page === 'crimescene') {
        hint.textContent = '🔍 Evidence overlay in AR';
        this._showARCrimeScene();
      }
      setTimeout(() => hint.remove(), 4000);
    } else {
      const ok = await Viewer3D.startAR();
      if (!ok) { alert('Camera not available.'); return; }
      btn?.classList.add('active');
      btn && (btn.innerHTML = '<span class="ar-dot"></span> AR ON');
      const hint = document.createElement('div');
      hint.className = 'ar-hint';
      hint.textContent = '📱 Move device to see 3D model on real background';
      document.querySelector('.page.active')?.appendChild(hint);
      setTimeout(() => hint.remove(), 4000);
    }
  },

  _showARMythFact() {
    const entries = this.mfEntries || AppData.mythFacts;
    let idx = 0;
    const show = () => {
      if (!Viewer3D.arMode) return;
      const e = entries[idx % entries.length];
      Viewer3D.showARCard('ar-card-viewer', '❌ Myth: ' + e.myth, '✅ Fact: ' + e.fact + ' — ' + e.explanation, '#8B0000');
    };
    show();
    this._arCardInterval = setInterval(() => {
      if (!Viewer3D.arMode) { clearInterval(this._arCardInterval); return; }
      idx++;
      show();
    }, 8000);
  },

  _showARQuizCard() {
    const qs = this.quizState?.questions || AppData.questions;
    let idx = 0;
    const show = () => {
      if (!Viewer3D.arMode) return;
      const q = qs[idx % qs.length];
      const correct = q.options[q.correct];
      Viewer3D.showARCard('ar-card-viewer', '❓ ' + q.text, '✅ ' + correct, '#1B2D4F');
    };
    show();
    this._arCardInterval = setInterval(() => {
      if (!Viewer3D.arMode) { clearInterval(this._arCardInterval); return; }
      idx++;
      show();
    }, 8000);
  },

  _showARCrimeScene() {
    const evidence = AppData.crimeScene.evidence;
    let idx = 0;
    const show = () => {
      if (!Viewer3D.arMode) return;
      const e = evidence[idx % evidence.length];
      const icon = e.category === 'Bloodstain' ? '🩸' : e.category === 'Weapon' ? '🔪' : e.category === 'Furniture' ? '🪑' : e.category === 'Trace' ? '👣' : '🔧';
      Viewer3D.showARCard('ar-card-viewer', icon + ' ' + e.name, e.desc.substring(0, 200), '#122240');
    };
    show();
    this._arCardInterval = setInterval(() => {
      if (!Viewer3D.arMode) { clearInterval(this._arCardInterval); return; }
      idx++;
      show();
    }, 8000);
  },

  // ========== HOME ==========
  renderHome() {
    const page = document.getElementById('page-home');
    if (!page) return;
    page.innerHTML = `
      <div class="landing-hero">
        <div class="landing-logo">🔬</div>
        <h1 class="landing-title">HEMA-Vision</h1>
        <p class="landing-subtitle">Master forensic bloodstain pattern analysis through cutting-edge augmented reality technology</p>
        <div class="landing-cta">
          <button class="btn btn-primary btn-large" onclick="Nav.go('modules')">
            🚀 Start Learning
          </button>
          <button class="btn btn-secondary btn-large" onclick="Nav.go('about')">
            📚 Learn More
          </button>
        </div>
      </div>
      <div class="landing-features">
        <div class="feature-card">
          <div class="feature-icon">🩸</div>
          <h3 class="feature-title">Interactive 3D Models</h3>
          <p class="feature-desc">Explore blood components and patterns in stunning 3D with full AR support</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔍</div>
          <h3 class="feature-title">Crime Scene Investigation</h3>
          <p class="feature-desc">Analyze realistic evidence and develop professional forensic skills</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">⚖️</div>
          <h3 class="feature-title">Combat Misinformation</h3>
          <p class="feature-desc">Learn to identify and correct common forensic misconceptions</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📱</div>
          <h3 class="feature-title">AR Learning</h3>
          <p class="feature-desc">Use your device camera to overlay forensic models in real space</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3 class="feature-title">Knowledge Assessment</h3>
          <p class="feature-desc">Test your understanding with comprehensive quizzes and scenarios</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🎓</div>
          <h3 class="feature-title">Evidence-Based</h3>
          <p class="feature-desc">Content based on SWGSTAIN standards and peer-reviewed research</p>
        </div>
      </div>`;
  },

  // ========== ABOUT ==========
  renderAbout() {
    const page = document.getElementById('page-about');
    if (!page) return;
    page.innerHTML = `
      <div class="topbar">
        <button class="back-btn" onclick="Nav.back()">←</button>
        <h1>About HEMA-Vision</h1>
      </div>
      <div class="content">
        <div class="card">
          <h3>🎯 Mission Statement</h3>
          <p>HEMA-Vision is an innovative AR-powered educational platform designed to combat forensic science misinformation by providing criminology and forensic science students with scientifically accurate, interactive learning experiences in bloodstain pattern analysis.</p>
        </div>
        <div class="card">
          <h3>🔬 Scientific Foundation</h3>
          <p>All educational content is rigorously based on guidelines established by SWGSTAIN (Scientific Working Group on Bloodstain Pattern Analysis) and peer-reviewed forensic science literature. Our models and scenarios reflect real-world applications while maintaining pedagogical clarity.</p>
        </div>
        <div class="card">
          <h3>📚 Learning Objectives</h3>
          <p>• Master blood composition and cellular components<br>
          • Understand bloodstain pattern formation mechanisms<br>
          • Analyze crime scene evidence systematically<br>
          • Identify and correct forensic misconceptions<br>
          • Develop critical thinking in forensic interpretation<br>
          • Experience AR-enhanced spatial learning</p>
        </div>
        <div class="card">
          <h3>👥 Target Audience</h3>
          <p>This platform serves criminology students, forensic science students, law enforcement trainees, legal professionals, and anyone seeking evidence-based education in bloodstain pattern analysis.</p>
        </div>
        <div class="card">
          <h3>💻 Technology Stack</h3>
          <p>Built with cutting-edge web technologies including Three.js for 3D rendering, WebXR for augmented reality, and modern web standards ensuring cross-platform compatibility. Accessible on any device with a modern browser and camera.</p>
        </div>
        <div class="card">
          <h3>🤝 Academic Integrity</h3>
          <p>HEMA-Vision was developed as a research project to address the "CSI Effect" and combat media-driven forensic misconceptions. All scenarios are simulated training exercises designed for educational purposes only.</p>
        </div>
        <div class="card" style="text-align:center;border:2px solid var(--brand-gold)">
          <h4 style="color:var(--brand-gold);margin-bottom:var(--space-md)">📜 Version Information</h4>
          <p style="font-size:0.875rem;margin-bottom:var(--space-sm)"><strong>Version:</strong> 1.0.0</p>
          <p style="font-size:0.875rem;margin-bottom:var(--space-sm)"><strong>Last Updated:</strong> 2024</p>
          <p style="font-size:0.875rem"><strong>Platform:</strong> Web-based AR Learning System</p>
        </div>
      </div>`;
  },

  // ========== MODULE SELECTION ==========
  renderModuleSelection() {
    const page = document.getElementById('page-modules');
    if (!page) return;
    const modules = [
      { id: 'components', icon: '🩸', name: 'Blood Components', desc: 'Explore RBCs, WBCs, Platelets, and Plasma in interactive 3D', color: '#DC2626' },
      { id: 'patterns', icon: '🔴', name: 'Pattern Library', desc: 'Study 10 bloodstain patterns with professional AR visualizations', color: '#EF4444' },
      { id: 'crimescene', icon: '🔍', name: 'Crime Scene Analysis', desc: 'Investigate a realistic assault scenario with guided evidence examination', color: '#F59E0B' },
      { id: 'mythfact', icon: '⚖️', name: 'Myth vs Fact', desc: 'Master forensic literacy by identifying common misconceptions', color: '#991B1B' }
    ];
    page.innerHTML = `
      <div class="topbar">
        <button class="back-btn" onclick="Nav.back()">←</button>
        <h1>Learning Modules</h1>
      </div>
      <div class="content">
        <div class="content-header">
          <p class="content-subtitle">Choose a module to begin your forensic science training journey</p>
        </div>
        ${modules.map(m => `
          <div class="module-card" onclick="Nav.go('${m.id}')" style="border-left-color:${m.color}">
            <div class="module-header">
              <div class="module-icon">${m.icon}</div>
              <div class="module-content">
                <h3>${m.name}</h3>
                <p>${m.desc}</p>
              </div>
            </div>
          </div>
        `).join('')}
        <button class="btn btn-gold btn-block mt-lg" onclick="Nav.go('quiz')">
          📝 Comprehensive Assessment Quiz
        </button>
        <div class="divider"></div>
        <div class="card" style="text-align:center">
          <h4 style="color:var(--brand-gold);margin-bottom:var(--space-md)">🎓 Learning Path</h4>
          <p style="font-size:0.875rem;color:var(--text-tertiary)">We recommend completing modules in order: Blood Components → Pattern Library → Crime Scene → Myth vs Fact → Quiz</p>
        </div>
      </div>`;
  },

  // ========== BLOOD COMPONENTS ==========
  initComponents() {
    const page = document.getElementById('page-components');
    if (!page) return;
    page.innerHTML = `
      <div class="topbar"><button class="back-btn" onclick="Nav.back()">←</button><h1>Blood Components</h1><div class="topbar-right"><button class="ar-btn" onclick="App.toggleAR()"><span class="ar-dot"></span> AR</button></div></div>
      <div class="content">
        <div class="ar-banner"><h3>🔄 3D Interactive Viewer</h3><p>Tap a component below to view its 3D model. Drag to rotate, scroll to zoom.</p></div>
        <div class="viewer-container" id="component-viewer"></div>
        <div id="component-info" class="card"><p style="color:var(--text-secondary)">Select a component to view details.</p></div>
        <div class="grid-2" id="component-list"></div>
      </div>`;
    const list = document.getElementById('component-list');
    AppData.bloodComponents.forEach((c, i) => {
      const btn = document.createElement('div');
      btn.className = 'card';
      btn.style.cssText = `border-left:4px solid ${c.color};cursor:pointer;text-align:center`;
      btn.innerHTML = `<div style="font-size:28px;margin-bottom:4px">${c.shape === 'disc' ? '🟠' : c.shape === 'sphere' ? '⚪' : c.shape === 'irregular' ? '🔶' : '💧'}</div><h3>${c.name}</h3><p style="font-size:11px;font-style:italic">${c.scientificName}</p>`;
      btn.onclick = () => this.showComponentDetail(i);
      list.appendChild(btn);
    });
    Viewer3D.init('component-viewer');
    this.showComponentDetail(0);
  },

  showComponentDetail(index) {
    const c = AppData.bloodComponents[index];
    if (!c) return;
    Viewer3D.showComponent(c);
    const info = document.getElementById('component-info');
    if (info) info.innerHTML = `
      <h3>${c.name} <span style="font-size:14px;color:var(--gold);font-style:italic">${c.scientificName}</span></h3>
      <p>${c.description}</p>
      <h4 style="color:var(--gold);margin-top:12px">Function</h4><p>${c.function}</p>
      <h4 style="color:var(--gold);margin-top:12px">Role in Bloodstain Analysis</h4><p>${c.bpaRole}</p>`;
  },

  // ========== PATTERN LIBRARY ==========
  initPatterns(filter) {
    const page = document.getElementById('page-patterns');
    if (!page) return;
    const categories = ['All', 'Passive', 'Impact Spatter', 'Cast-Off', 'Arterial', 'Transfer', 'Altered'];
    page.innerHTML = `
      <div class="topbar"><button class="back-btn" onclick="Nav.back()">←</button><h1>Pattern Library</h1><div class="topbar-right"><button class="ar-btn" onclick="App.toggleAR()"><span class="ar-dot"></span> AR</button></div></div>
      <div class="content">
        <input class="search-input" id="pattern-search" placeholder="🔍 Search patterns..." oninput="App.filterPatterns()">
        <div class="filter-bar" id="pattern-filters">
          ${categories.map((c, i) => `<button class="filter-btn ${i === 0 ? 'active' : ''}" onclick="App.setPatternFilter(${i})">${c}</button>`).join('')}
        </div>
        <div class="viewer-container" id="pattern-viewer"></div>
        <div id="pattern-info" class="card"><p style="color:var(--text-secondary)">Select a pattern to view details.</p></div>
        <div id="pattern-list"></div>
      </div>`;
    Viewer3D.init('pattern-viewer');
    this.patternFilter = 0;
    this.filterPatterns();
  },

  setPatternFilter(index) {
    this.patternFilter = index;
    document.querySelectorAll('#pattern-filters .filter-btn').forEach((b, i) => b.classList.toggle('active', i === index));
    this.filterPatterns();
  },

  filterPatterns() {
    const q = (document.getElementById('pattern-search')?.value || '').toLowerCase();
    let patterns = AppData.patterns;
    if (this.patternFilter > 0) {
      const cat = ['All', 'Passive', 'Impact Spatter', 'Cast-Off', 'Arterial', 'Transfer', 'Altered'][this.patternFilter];
      patterns = patterns.filter(p => p.category === cat);
    }
    if (q) patterns = patterns.filter(p => p.name.toLowerCase().includes(q) || p.definition.toLowerCase().includes(q));
    const list = document.getElementById('pattern-list');
    if (!list) return;
    list.innerHTML = patterns.map(p => `
      <div class="card" onclick="App.showPatternDetail('${p.id}')" style="border-left:4px solid ${p.color};cursor:pointer">
        <span class="badge badge-${p.category.toLowerCase().replace(' ', '')}">${p.category}</span>
        <h3>${p.name}</h3>
        <p>${p.definition.substring(0, 100)}...</p>
      </div>
    `).join('');
    if (patterns.length > 0) this.showPatternDetail(patterns[0].id);
  },

  showPatternDetail(id) {
    const p = AppData.patterns.find(x => x.id === id);
    if (!p) return;
    Viewer3D.showPattern(p);
    const info = document.getElementById('pattern-info');
    if (info) info.innerHTML = `
      <span class="badge badge-${p.category.toLowerCase().replace(' ', '')}">${p.category}</span>
      <h3>${p.name}</h3>
      <h4 style="color:var(--gold);margin-top:8px">Definition</h4><p>${p.definition}</p>
      <h4 style="color:var(--gold);margin-top:8px">Characteristics</h4><p>${p.characteristics}</p>
      <h4 style="color:var(--gold);margin-top:8px">Formation Process</h4><p>${p.formation}</p>
      <h4 style="color:var(--gold);margin-top:8px">Crime Scene Significance</h4><p>${p.significance}</p>`;
  },

  // ========== MYTH VS FACT ==========
  initMythFact() {
    const page = document.getElementById('page-mythfact');
    if (!page) return;
    const categories = ['All', 'Bloodstain Interpretation', 'Investigation Process', 'Forensic Science', 'Media Representation'];
    this.mfFilter = 0;
    this.mfMode = 'explore';
    this.mfScore = 0;
    this.mfTotal = 0;
    page.innerHTML = `
      <div class="topbar"><button class="back-btn" onclick="Nav.back()">←</button><h1>Myth vs Fact</h1><div class="topbar-right"><button class="ar-btn" onclick="App.toggleAR()"><span class="ar-dot"></span> AR</button></div></div>
      <div class="content">
        <div class="filter-bar" id="mf-filters">
          ${categories.map((c, i) => `<button class="filter-btn ${i === 0 ? 'active' : ''}" onclick="App.setMFFilter(${i})">${c}</button>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="btn btn-small ${this.mfMode === 'explore' ? 'btn-primary' : 'btn-secondary'}" onclick="App.setMFMode('explore')" style="flex:1">📖 Explore Cards</button>
          <button class="btn btn-small ${this.mfMode === 'quiz' ? 'btn-primary' : 'btn-secondary'}" onclick="App.setMFMode('quiz')" style="flex:1">❓ Myth or Fact?</button>
        </div>
        <div id="mf-content"></div>
      </div>`;
    this.showMFContent();
  },

  setMFFilter(index) {
    this.mfFilter = index;
    document.querySelectorAll('#mf-filters .filter-btn').forEach((b, i) => b.classList.toggle('active', i === index));
    this.showMFContent();
  },

  setMFMode(mode) {
    this.mfMode = mode;
    document.querySelectorAll('[onclick*="setMFMode"]').forEach(b => b.className = `btn btn-small ${b.textContent.includes(mode === 'explore' ? 'Explore' : 'Myth or Fact') ? 'btn-primary' : 'btn-secondary'}`);
    this.showMFContent();
  },

  showMFContent() {
    const container = document.getElementById('mf-content');
    if (!container) return;
    let entries = AppData.mythFacts;
    if (this.mfFilter > 0) {
      const cats = ['All', 'Bloodstain Interpretation', 'Investigation Process', 'Forensic Science', 'Media Representation'];
      entries = entries.filter(e => e.category === cats[this.mfFilter]);
    }
    if (this.mfMode === 'explore') {
      this.mfIndex = 0;
      container.innerHTML = `
        <div style="text-align:center;margin-bottom:8px">
          <span style="color:var(--text-secondary);font-size:13px">Tap card to flip · ${entries.length} entries</span>
        </div>
        <div class="mythfact-card" id="mf-card" onclick="App.flipMFCard()">
          <div class="mythfact-inner" id="mf-inner">
            <div class="mythfact-front"><div class="mythfact-label">Myth</div><div class="mythfact-text" id="mf-myth">${entries[0]?.myth || ''}</div></div>
            <div class="mythfact-back"><div class="mythfact-label">Fact</div><div class="mythfact-text" id="mf-fact">${entries[0]?.fact || ''}</div></div>
          </div>
        </div>
        <div style="text-align:center;margin-bottom:12px">
          <span style="font-size:13px;color:var(--gold)" id="mf-category">${entries[0]?.category || ''}</span>
        </div>
        <div id="mf-explanation" class="card">
          <h4 style="color:var(--gold)">Explanation</h4><p style="font-size:14px">${entries[0]?.explanation || ''}</p>
          <h4 style="color:var(--gold);margin-top:8px">Forensic Principle</h4><p style="font-size:14px;font-style:italic">${entries[0]?.principle || ''}</p>
        </div>
        <div style="display:flex;gap:12px">
          <button class="btn btn-secondary btn-small" onclick="App.navMF(-1)" style="flex:1" ${entries.length <= 1 ? 'disabled' : ''}>← Previous</button>
          <button class="btn btn-primary btn-small" onclick="App.navMF(1)" style="flex:1" ${entries.length <= 1 ? 'disabled' : ''}>Next →</button>
        </div>`;
      this.mfEntries = entries;
    } else {
      this.mfQuizIndex = 0;
      this.mfScore = 0;
      this.mfTotal = entries.length;
      this.mfQuizEntries = entries;
      container.innerHTML = `<div id="mf-quiz-content"></div>`;
      this.showMFQuiz();
    }
  },

  flipMFCard() {
    document.getElementById('mf-card')?.classList.toggle('flipped');
  },

  navMF(dir) {
    this.mfIndex = (this.mfIndex + dir + this.mfEntries.length) % this.mfEntries.length;
    const e = this.mfEntries[this.mfIndex];
    const inner = document.getElementById('mf-inner');
    if (inner) inner.style.transform = 'rotateY(0deg)';
    document.getElementById('mf-card')?.classList.remove('flipped');
    const mythEl = document.getElementById('mf-myth');
    const factEl = document.getElementById('mf-fact');
    const catEl = document.getElementById('mf-category');
    const explEl = document.getElementById('mf-explanation');
    if (mythEl) mythEl.textContent = e.myth;
    if (factEl) factEl.textContent = e.fact;
    if (catEl) catEl.textContent = e.category;
    if (explEl) explEl.innerHTML = `<h4 style="color:var(--gold)">Explanation</h4><p style="font-size:14px">${e.explanation}</p><h4 style="color:var(--gold);margin-top:8px">Forensic Principle</h4><p style="font-size:14px;font-style:italic">${e.principle}</p>`;
  },

  showMFQuiz() {
    const container = document.getElementById('mf-quiz-content');
    if (!container || this.mfQuizIndex >= this.mfQuizEntries.length) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:30px">
          <h3>Quiz Complete!</h3>
          <div class="result-circle ${this.mfScore >= this.mfTotal * 0.7 ? 'grade-excellent' : this.mfScore >= this.mfTotal * 0.5 ? 'grade-good' : 'grade-poor'}">${this.mfScore}/${this.mfTotal}</div>
          <p style="margin-bottom:16px">You identified ${this.mfScore} out of ${this.mfTotal} statements correctly.</p>
          <button class="btn btn-primary" onclick="App.setMFMode('explore')">📖 Review Cards</button>
        </div>`;
      return;
    }
    const e = this.mfQuizEntries[this.mfQuizIndex];
    container.innerHTML = `
      <div style="text-align:center;margin-bottom:8px">
        <span style="color:var(--text-secondary);font-size:13px">Statement ${this.mfQuizIndex + 1} of ${this.mfTotal} · Score: ${this.mfScore}</span>
      </div>
      <div class="card" style="padding:20px;text-align:center">
        <div style="font-size:13px;color:var(--gold);margin-bottom:8px">${e.category}</div>
        <p style="font-size:17px;line-height:1.5;font-weight:500">"${e.statement || e.myth}"</p>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">Is this a Myth or a Fact?</p>
      <div style="display:flex;gap:12px">
        <button class="btn btn-block" style="background:#8B0000;color:white" onclick="App.answerMF('myth', '${e.id}')">❌ Myth</button>
        <button class="btn btn-block" style="background:#1B2D4F;color:white;border:1px solid var(--gold)" onclick="App.answerMF('fact', '${e.id}')">✅ Fact</button>
      </div>
      <div id="mf-feedback"></div>`;
  },

  answerMF(answer, id) {
    const e = AppData.mythFacts.find(x => x.id === id);
    if (!e) return;
    const isCorrect = answer === 'myth';
    if (isCorrect) this.mfScore++;
    this.mfTotal = Math.max(this.mfTotal, this.mfQuizEntries.length);
    const fb = document.getElementById('mf-feedback');
    if (fb) fb.innerHTML = `
      <div class="card" style="margin-top:12px;${isCorrect ? 'border-left:4px solid var(--success)' : 'border-left:4px solid var(--error)'}">
        <h3 style="color:${isCorrect ? 'var(--success)' : 'var(--error)'}">${isCorrect ? '✅ Correct!' : '❌ Incorrect'}</h3>
        <p><strong>Fact:</strong> ${e.fact}</p>
        <p style="margin-top:8px;font-size:13px">${e.explanation}</p>
        <button class="btn btn-primary btn-small" onclick="App.showMFQuiz()" style="margin-top:8px">Next →</button>
      </div>`;
    this.mfQuizIndex++;
  },

  // ========== CRIME SCENE ==========
  initCrimeScene() {
    const page = document.getElementById('page-crimescene');
    if (!page) return;
    this.examinedEvidence = new Set();
    const scene = AppData.crimeScene;
    page.innerHTML = `
      <div class="topbar"><button class="back-btn" onclick="Nav.back()">←</button><h1>Crime Scene</h1><div class="topbar-right"><button class="ar-btn" onclick="App.toggleAR()"><span class="ar-dot"></span> AR</button></div></div>
      <div class="content">
        <div class="ar-banner"><h3>🔍 ${scene.title}</h3><p>${scene.description}</p></div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="btn btn-primary btn-small" onclick="App.setCSMode('guided')" style="flex:1" id="cs-guided-btn">📋 Guided</button>
          <button class="btn btn-secondary btn-small" onclick="App.setCSMode('free')" style="flex:1" id="cs-free-btn">🔓 Free Explore</button>
        </div>
        <div id="cs-progress" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary)">
            <span>Evidence: <span id="cs-count">0/${scene.evidence.length}</span></span>
            <span id="cs-mode-label">Guided Mode</span>
          </div>
        </div>
        <div id="cs-step" class="card" style="border-left:4px solid var(--gold)"></div>
        <div id="cs-evidence-list"></div>
        <div id="cs-report" style="display:none"></div>
      </div>`;
    this.csMode = 'guided';
    this.csStep = 0;
    this.renderCSEvidence();
    this.updateCSStep();
  },

  setCSMode(mode) {
    this.csMode = mode;
    document.getElementById('cs-guided-btn').className = `btn btn-small ${mode === 'guided' ? 'btn-primary' : 'btn-secondary'}`;
    document.getElementById('cs-free-btn').className = `btn btn-small ${mode === 'free' ? 'btn-primary' : 'btn-secondary'}`;
    document.getElementById('cs-mode-label').textContent = mode === 'guided' ? 'Guided Mode' : 'Free Explore';
    if (mode === 'guided') { this.csStep = 0; this.updateCSTStep(); }
  },

  renderCSEvidence() {
    const list = document.getElementById('cs-evidence-list');
    if (!list) return;
    const scene = AppData.crimeScene;
    list.innerHTML = scene.evidence.map(e => `
      <div class="evidence-item ${this.examinedEvidence.has(e.id) ? 'examined' : ''}" onclick="App.examineEvidence('${e.id}')" id="ev-${e.id}">
        <span class="ev-icon">${e.category === 'Bloodstain' ? '🩸' : e.category === 'Weapon' ? '🔪' : e.category === 'Furniture' ? '🪑' : e.category === 'Trace' ? '👣' : '🔧'}</span>
        <div class="ev-info">
          <div class="ev-name">${e.name}</div>
          <div class="ev-cat">${e.category} ${e.key ? '· <span class="badge badge-key">Key</span>' : ''}</div>
        </div>
        <div class="ev-status">${this.examinedEvidence.has(e.id) ? '✅' : '⭕'}</div>
      </div>
    `).join('');
    document.getElementById('cs-count').textContent = `${this.examinedEvidence.size}/${scene.evidence.length}`;
  },

  examineEvidence(id) {
    const e = AppData.crimeScene.evidence.find(x => x.id === id);
    if (!e) return;
    this.examinedEvidence.add(id);
    this.renderCSEvidence();
    if (this.csMode === 'guided') this.csStep++;
    const panel = document.createElement('div');
    panel.className = 'detail-panel';
    panel.id = 'ev-detail';
    panel.innerHTML = `
      <button class="close-btn" onclick="this.parentElement.remove()">✕</button>
      <h2>${e.name}</h2>
      <span class="badge badge-key">${e.category}</span>
      ${e.key ? '<span class="badge badge-key" style="margin-left:4px">Key Evidence</span>' : ''}
      <h4>Description</h4><p>${e.desc}</p>
      ${e.pattern ? `<h4>Related Pattern</h4><p>${AppData.patterns.find(p => p.id === e.pattern)?.name || e.pattern}</p>` : ''}
      <h4>Investigation Prompts</h4>
      <ul style="color:var(--text-secondary);font-size:14px;padding-left:20px">
        ${e.prompts.map(p => `<li style="margin-bottom:4px">${p}</li>`).join('')}
      </ul>
      <button class="btn btn-primary btn-block" onclick="document.getElementById('ev-detail')?.remove();App.updateCSTStep()" style="margin-top:12px">✅ Mark as Examined</button>
    `;
    document.body.appendChild(panel);
    this.updateCSTStep();
  },

  updateCSTStep() {
    const stepEl = document.getElementById('cs-step');
    if (!stepEl) return;
    if (this.csMode === 'free') {
      stepEl.innerHTML = `<p style="font-size:14px">🔓 Free Exploration Mode — Examine any evidence you find interesting. Tap each item to investigate.</p>`;
      return;
    }
    const keyEvidence = AppData.crimeScene.evidence.filter(e => e.key);
    if (this.csStep >= keyEvidence.length) {
      stepEl.innerHTML = `<h3>✅ Investigation Complete!</h3><p>You have examined all ${keyEvidence.length} key pieces of evidence. <button class="btn btn-primary btn-small" onclick="App.showCSReport()" style="margin-left:8px">View Report</button></p>`;
      return;
    }
    const target = keyEvidence[this.csStep];
    stepEl.innerHTML = `
      <h3>Step ${this.csStep + 1} of ${keyEvidence.length}</h3>
      <p><strong>Find and examine:</strong> ${target.name}</p>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">${target.desc.substring(0, 120)}...</p>
      <div style="margin-top:8px;font-size:13px;color:var(--gold)">💡 Hint: Look for evidence in the ${target.category} category.</div>
    `;
  },

  showCSReport() {
    const report = document.getElementById('cs-report');
    if (!report) return;
    report.style.display = 'block';
    const total = AppData.crimeScene.evidence.length;
    const found = this.examinedEvidence.size;
    const pct = Math.round((found / total) * 100);
    report.innerHTML = `
      <div class="card" style="margin-top:16px;border:2px solid var(--gold)">
        <h2 style="text-align:center">📋 Investigation Report</h2>
        <div class="result-circle ${pct >= 70 ? 'grade-excellent' : pct >= 50 ? 'grade-good' : 'grade-fair'}" style="width:100px;height:100px;font-size:24px">${pct}%</div>
        <p style="text-align:center">${found} of ${total} evidence items examined</p>
        <h4 style="margin-top:12px;color:var(--gold)">Summary</h4>
        <p style="font-size:14px">Based on your investigation, this scene represents an assault involving blunt-force trauma (lamp base) with significant bloodshed. The victim sustained multiple impacts (cast-off pattern showing 6+ strikes) and remained in the living room long enough to form a significant blood pool. The blood trail suggests the victim moved toward the hallway. A footwear impression indicates a second individual was present and left the scene.</p>
        <p style="font-size:13px;color:var(--text-secondary);margin-top:8px"><strong>Note:</strong> This is a simulated training exercise. Real investigations require DNA analysis, medical examiner consultation, and corroborating evidence.</p>
        <button class="btn btn-primary btn-block" onclick="Nav.go('modules')" style="margin-top:12px">Back to Modules</button>
      </div>`;
  },

  // ========== QUIZ ==========
  initQuiz(module) {
    const page = document.getElementById('page-quiz');
    if (!page) return;
    const modules = ['All', 'BloodComponents', 'PatternLibrary', 'CrimeScene', 'MythFact'];
    page.innerHTML = `
      <div class="topbar"><button class="back-btn" onclick="Nav.back()">←</button><h1>Quiz</h1><div class="topbar-right"><button class="ar-btn" onclick="App.toggleAR()"><span class="ar-dot"></span> AR</button></div></div>
      <div class="content">
        <div class="filter-bar" id="quiz-filters">
          ${modules.map((m, i) => `<button class="filter-btn ${(!module && i === 0) || m === module ? 'active' : ''}" onclick="App.startQuiz('${m}')">${m === 'All' ? '📚 All' : m === 'BloodComponents' ? '🩸 Components' : m === 'PatternLibrary' ? '🔴 Patterns' : m === 'CrimeScene' ? '🔍 Crime Scene' : '⚖️ Myth/Fact'}</button>`).join('')}
        </div>
        <div id="quiz-content"></div>
      </div>`;
    this.startQuiz(module || 'All');
  },

  startQuiz(module) {
    this.quizState = { module, index: 0, score: 0, answers: [], questions: [] };
    let qs = AppData.questions;
    if (module !== 'All') qs = qs.filter(q => q.module === module);
    this.quizState.questions = this.shuffle(qs);
    this.showQuestion();
  },

  shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },

  showQuestion() {
    const qs = this.quizState;
    const q = qs.questions[qs.index];
    const container = document.getElementById('quiz-content');
    if (!container) return;
    if (!q || qs.index >= qs.questions.length) { this.showQuizResults(); return; }
    const labels = ['A', 'B', 'C', 'D'];
    container.innerHTML = `
      <div class="quiz-progress">Question ${qs.index + 1} of ${qs.questions.length} · Score: ${qs.score}</div>
      <div class="card">
        <div style="font-size:12px;color:var(--gold);margin-bottom:4px">${q.module} · Difficulty: ${'★'.repeat(q.difficulty)}${'☆'.repeat(5 - q.difficulty)}</div>
        <p style="font-size:16px;font-weight:500;line-height:1.5">${q.text}</p>
      </div>
      <div id="quiz-options">
        ${q.options.map((o, i) => `<button class="quiz-option" onclick="App.answer(${i})">${labels[i]}. ${o}</button>`).join('')}
      </div>
      <div id="quiz-feedback"></div>`;
    qs.current = q;
  },

  answer(index) {
    const q = this.quizState.current;
    if (!q) return;
    const isCorrect = index === q.correct;
    if (isCorrect) this.quizState.score++;
    this.quizState.answers.push({ question: q.text, userAnswer: q.options[index], correctAnswer: q.options[q.correct], isCorrect });
    document.querySelectorAll('.quiz-option').forEach((btn, i) => {
      btn.classList.add('disabled');
      if (i === q.correct) btn.classList.add('correct');
      if (i === index && !isCorrect) btn.classList.add('incorrect');
    });
    const fb = document.getElementById('quiz-feedback');
    if (fb) fb.innerHTML = `
      <div class="quiz-explanation">
        <strong style="color:${isCorrect ? 'var(--success)' : 'var(--error)'}">${isCorrect ? '✅ Correct!' : '❌ Incorrect'}</strong>
        <p style="margin-top:4px">${q.explanation}</p>
        <button class="btn btn-primary btn-small" onclick="App.nextQuestion()" style="margin-top:8px">
          ${this.quizState.index >= this.quizState.questions.length - 1 ? 'View Results' : 'Next →'}
        </button>
      </div>`;
  },

  nextQuestion() {
    this.quizState.index++;
    this.showQuestion();
  },

  showQuizResults() {
    const qs = this.quizState;
    const pct = qs.questions.length > 0 ? Math.round((qs.score / qs.questions.length) * 100) : 0;
    const grade = pct >= 85 ? 'Excellent' : pct >= 70 ? 'Good' : pct >= 50 ? 'Fair' : 'Poor';
    const gradeClass = pct >= 85 ? 'grade-excellent' : pct >= 70 ? 'grade-good' : pct >= 50 ? 'grade-fair' : 'grade-poor';
    const container = document.getElementById('quiz-content');
    if (!container) return;
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:24px">
        <h2>Quiz Complete!</h2>
        <div class="result-circle ${gradeClass}">${pct}%</div>
        <div style="font-size:20px;font-weight:600;margin-bottom:4px">${qs.score}/${qs.questions.length}</div>
        <div style="font-size:16px;color:var(--gold);margin-bottom:16px">Grade: ${grade}</div>
        <div style="margin-bottom:16px">
          ${Array(5).fill(0).map((_, i) => `<span style="font-size:24px">${i < Math.round(pct / 20) ? '★' : '☆'}</span>`).join('')}
        </div>
        <div style="text-align:left;margin-bottom:16px">
          <h4 style="color:var(--gold);margin-bottom:8px">Breakdown</h4>
          ${qs.answers.map(a => `
            <div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px">
              <span>${a.isCorrect ? '✅' : '❌'}</span>
              <span style="color:var(--text-secondary)">${a.question.substring(0, 50)}...</span>
              <br><span style="font-size:12px;color:${a.isCorrect ? 'var(--success)' : 'var(--error)'}">Your answer: ${a.userAnswer}</span>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-small" onclick="App.startQuiz('${qs.module}')" style="flex:1">🔄 Retry</button>
          <button class="btn btn-secondary btn-small" onclick="Nav.go('modules')" style="flex:1">📚 Modules</button>
        </div>
      </div>`;
    this.scores[qs.module] = pct;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
