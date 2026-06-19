const Nav = {
  currentPage: 'home',
  history: [],

  go(page, params) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (!target) { console.error('Page not found:', page); return; }
    target.classList.add('active');
    if (this.currentPage) this.history.push(this.currentPage);
    this.currentPage = page;
    window.scrollTo(0, 0);
    if (typeof App !== 'undefined' && App.onPageChange) App.onPageChange(page, params);
  },

  back() {
    const prev = this.history.pop();
    if (prev) this.go(prev);
  },

  canGoBack() { return this.history.length > 0; }
};
