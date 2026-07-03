// ================================================
// HEMA-Vision — Progress Tracking & Persistence
// Saves learning progress to localStorage
// ================================================

const Progress = {
  KEY: 'hema_vision_progress_v1',
  data: null,

  _defaults() {
    return {
      quizScores: {},        // { module: bestPercent }
      quizAttempts: {},      // { module: count }
      viewedComponents: [],  // component ids
      viewedPatterns: [],    // pattern ids
      examinedEvidence: [],  // evidence ids (persisted crime scene)
      mythFactSeen: [],      // myth/fact ids
      crimeSceneComplete: false,
      achievements: [],      // achievement ids
      totalStudyTime: 0,     // seconds
      lastVisit: null,
      firstVisit: null
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      this.data = raw ? { ...this._defaults(), ...JSON.parse(raw) } : this._defaults();
    } catch (e) {
      console.warn('Progress load failed, using defaults:', e.message);
      this.data = this._defaults();
    }
    if (!this.data.firstVisit) this.data.firstVisit = Date.now();
    this.data.lastVisit = Date.now();
    this.save();
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Progress save failed:', e.message);
    }
  },

  // ─── Tracking methods ───
  recordQuizScore(module, percent) {
    if (!this.data) this.load();
    const prev = this.data.quizScores[module] || 0;
    this.data.quizScores[module] = Math.max(prev, percent);
    this.data.quizAttempts[module] = (this.data.quizAttempts[module] || 0) + 1;
    this.save();
    this._checkAchievements();
    return this.data.quizScores[module];
  },

  getBestScore(module) {
    if (!this.data) this.load();
    return this.data.quizScores[module] || null;
  },

  markViewed(type, id) {
    if (!this.data) this.load();
    const map = { component: 'viewedComponents', pattern: 'viewedPatterns', mythfact: 'mythFactSeen' };
    const key = map[type];
    if (key && !this.data[key].includes(id)) {
      this.data[key].push(id);
      this.save();
      this._checkAchievements();
    }
  },

  markEvidence(id) {
    if (!this.data) this.load();
    if (!this.data.examinedEvidence.includes(id)) {
      this.data.examinedEvidence.push(id);
      this.save();
    }
  },

  setCrimeSceneComplete() {
    if (!this.data) this.load();
    this.data.crimeSceneComplete = true;
    this.save();
    this._checkAchievements();
  },

  addStudyTime(seconds) {
    if (!this.data) this.load();
    this.data.totalStudyTime += seconds;
    this.save();
  },

  // ─── Progress calculation ───
  getModuleProgress() {
    if (!this.data) this.load();
    const totalComponents = (window.AppData?.bloodComponents || []).length || 4;
    const totalPatterns = (window.AppData?.patterns || []).length || 10;
    const totalMythFacts = (window.AppData?.mythFacts || []).length || 12;
    return {
      components: Math.round((this.data.viewedComponents.length / totalComponents) * 100),
      patterns: Math.round((this.data.viewedPatterns.length / totalPatterns) * 100),
      crimescene: this.data.crimeSceneComplete ? 100 :
        Math.round((this.data.examinedEvidence.length / ((window.AppData?.crimeScene?.evidence || []).length || 10)) * 100),
      mythfact: Math.round((this.data.mythFactSeen.length / totalMythFacts) * 100)
    };
  },

  getOverallProgress() {
    const p = this.getModuleProgress();
    const quizModules = ['BloodComponents', 'PatternLibrary', 'CrimeScene', 'MythFact'];
    const quizAvg = quizModules.reduce((sum, m) => sum + (this.data.quizScores[m] || 0), 0) / quizModules.length;
    return Math.round((p.components + p.patterns + p.crimescene + p.mythfact + quizAvg) / 5);
  },

  // ─── Achievements ───
  _achievementDefs() {
    return [
      { id: 'first_step', icon: '👣', name: 'First Steps', desc: 'View your first 3D model', check: d => d.viewedComponents.length + d.viewedPatterns.length >= 1 },
      { id: 'hematologist', icon: '🩸', name: 'Hematologist', desc: 'View all blood components', check: d => d.viewedComponents.length >= 4 },
      { id: 'pattern_master', icon: '🔬', name: 'Pattern Master', desc: 'View all bloodstain patterns', check: d => d.viewedPatterns.length >= 10 },
      { id: 'investigator', icon: '🔍', name: 'Investigator', desc: 'Complete a crime scene investigation', check: d => d.crimeSceneComplete },
      { id: 'myth_buster', icon: '⚖️', name: 'Myth Buster', desc: 'Review all myth vs fact cards', check: d => d.mythFactSeen.length >= 12 },
      { id: 'quiz_taker', icon: '📝', name: 'Quiz Taker', desc: 'Complete your first quiz', check: d => Object.keys(d.quizScores).length >= 1 },
      { id: 'perfect_score', icon: '🏆', name: 'Perfect Score', desc: 'Score 100% on any quiz', check: d => Object.values(d.quizScores).some(s => s === 100) },
      { id: 'scholar', icon: '🎓', name: 'Forensic Scholar', desc: 'Score 85%+ on all quiz modules', check: d => ['BloodComponents', 'PatternLibrary', 'CrimeScene', 'MythFact'].every(m => (d.quizScores[m] || 0) >= 85) }
    ];
  },

  _checkAchievements() {
    const newly = [];
    this._achievementDefs().forEach(a => {
      if (!this.data.achievements.includes(a.id) && a.check(this.data)) {
        this.data.achievements.push(a.id);
        newly.push(a);
      }
    });
    if (newly.length > 0) {
      this.save();
      newly.forEach(a => this._notify(a));
    }
  },

  getAchievements() {
    if (!this.data) this.load();
    return this._achievementDefs().map(a => ({
      ...a,
      unlocked: this.data.achievements.includes(a.id)
    }));
  },

  _notify(achievement) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
      <div class="achievement-toast-icon">${achievement.icon}</div>
      <div class="achievement-toast-body">
        <div class="achievement-toast-label">Achievement Unlocked!</div>
        <div class="achievement-toast-name">${achievement.name}</div>
      </div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  },

  reset() {
    this.data = this._defaults();
    this.data.firstVisit = Date.now();
    this.data.lastVisit = Date.now();
    this.save();
  }
};

if (typeof window !== 'undefined') window.Progress = Progress;
