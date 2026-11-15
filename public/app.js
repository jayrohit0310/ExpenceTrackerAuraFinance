// ==========================================================================
// AuraFinance - Modern Client Application Engine
// Linear / Stripe / Ramp Inspired Fintech Architecture
// ==========================================================================

// Global SPA State
const state = {
  user: null,
  currency: 'INR',
  currencySymbol: '₹',
  transactions: [],
  budgets: [],
  summary: {
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    budgetsStatus: []
  },
  activeView: 'dashboard',
  selectedMonth: '', // YYYY-MM
  theme: 'light', // 'light' or 'dark'
  chartPeriod: 'this', // 'this' or 'last'
  currentCategoryTab: 'expense',
  isLoadingTransactions: false,
  isRefreshing: false,
  deferredPwaPrompt: null,

  otpState: {
    email: '',
    targetStep: 1,
    timerInterval: null,
    remainingSeconds: 60
  },

  // Transaction list filtering, sorting, and pagination
  filters: {
    search: '',
    type: 'all',
    category: 'all',
    date: 'all',
    amount: 'all',
    paymentMethod: 'all'
  },
  sort: {
    key: 'date',
    order: 'desc'
  },
  pagination: {
    page: 1,
    itemsPerPage: 10
  },

  // Report details
  report: {
    compiled: false,
    startDate: '',
    endDate: '',
    data: {
      transactions: [],
      totalIncome: 0,
      totalExpense: 0,
      totalSavings: 0,
      highestCategory: '-',
      categorySummary: {}
    }
  },

  // Chart instances
  charts: {
    dashboardOverview: null,
    dashboardCategories: null,
    trends: null,
    categories: null,
    utilization: null
  }
};

// Currency Symbols Dictionary
const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  AED: 'AED '
};

// Lucide Icon Mapping for Categories (STRICTLY NO EMOJIS)
const CATEGORY_ICONS = {
  'Food & Dining': { icon: 'utensils', color: '#F97316', bg: 'rgba(249, 115, 22, 0.12)' },
  'Shopping': { icon: 'shopping-bag', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
  'Entertainment': { icon: 'tv', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  'Utilities': { icon: 'zap', color: '#EAB308', bg: 'rgba(234, 179, 8, 0.12)' },
  'Rent & Housing': { icon: 'home', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  'Travel': { icon: 'plane', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  'Healthcare': { icon: 'heart-pulse', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },
  'Education': { icon: 'graduation-cap', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  'Miscellaneous': { icon: 'more-horizontal', color: '#64748B', bg: 'rgba(100, 116, 139, 0.12)' },
  'Salary': { icon: 'briefcase', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  'Freelance': { icon: 'laptop', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  'Investments': { icon: 'trending-up', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  'Gifts': { icon: 'gift', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
  'Other': { icon: 'circle-dollar-sign', color: '#64748B', bg: 'rgba(100, 116, 139, 0.12)' }
};

const CATEGORIES = {
  expense: [
    'Food & Dining',
    'Shopping',
    'Entertainment',
    'Utilities',
    'Rent & Housing',
    'Travel',
    'Healthcare',
    'Education',
    'Miscellaneous'
  ],
  income: [
    'Salary',
    'Freelance',
    'Investments',
    'Gifts',
    'Other'
  ]
};

// Fintech Color System
const COLORS = {
  primary: '#7C3AED',
  primaryHover: '#6D28D9',
  income: '#10B981',
  expense: '#F43F5E',
  warning: '#F59E0B',
  info: '#3B82F6',
  chartPalette: [
    '#7C3AED',
    '#10B981',
    '#3B82F6',
    '#F59E0B',
    '#EC4899',
    '#06B6D4',
    '#F43F5E',
    '#8B5CF6',
    '#64748B'
  ]
};

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCurrencySymbol() {
  const curr = (state.user && state.user.currency) || state.currency || 'INR';
  return CURRENCY_SYMBOLS[curr] || '₹';
}

function formatCurrency(amount) {
  const curr = (state.user && state.user.currency) || state.currency || 'INR';
  try {
    return new Intl.NumberFormat(curr === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (e) {
    return `${getCurrencySymbol()}${Number(amount).toFixed(2)}`;
  }
}

function isImageAvatar(avatar) {
  if (!avatar) return false;
  return typeof avatar === 'string' && (
    avatar.startsWith('data:image/') ||
    avatar.startsWith('http://') ||
    avatar.startsWith('https://') ||
    avatar.startsWith('/uploads/') ||
    avatar.startsWith('blob:')
  );
}

function renderAllAvatars(user) {
  if (!user) return;
  const displayName = user.name || user.username || 'User';
  const initials = displayName.substring(0, 2).toUpperCase();
  const avatarVal = user.avatar;

  const sideAvatar = document.getElementById('sidebar-user-avatar');
  if (sideAvatar) {
    if (isImageAvatar(avatarVal)) {
      sideAvatar.innerHTML = `<img src="${avatarVal}" alt="${escapeHtml(displayName)}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      sideAvatar.innerHTML = `<span id="user-initials">${escapeHtml(initials)}</span>`;
    }
  }

  const mobAvatar = document.getElementById('mobile-user-avatar');
  if (mobAvatar) {
    if (isImageAvatar(avatarVal)) {
      mobAvatar.innerHTML = `<img src="${avatarVal}" alt="${escapeHtml(displayName)}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      mobAvatar.innerHTML = `<span id="mobile-user-initials">${escapeHtml(initials)}</span>`;
    }
  }

  const profileAvatar = document.getElementById('profile-avatar-display');
  if (profileAvatar) {
    if (isImageAvatar(avatarVal)) {
      profileAvatar.innerHTML = `<img src="${avatarVal}" alt="${escapeHtml(displayName)}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      profileAvatar.innerHTML = `<span id="profile-avatar-initials">${escapeHtml(initials)}</span>`;
    }
  }
}

// SweetAlert2 Theme Helper
function getSwalTheme() {
  const isDark = document.body.classList.contains('dark-theme');
  return {
    background: isDark ? '#151C2E' : '#FFFFFF',
    color: isDark ? '#F8FAFC' : '#111827',
    confirmButtonColor: '#7C3AED',
    cancelButtonColor: isDark ? '#263247' : '#E5E7EB',
    customClass: {
      popup: 'fintech-swal',
      confirmButton: 'fintech-btn-confirm',
      cancelButton: 'fintech-btn-cancel'
    }
  };
}

function getToast() {
  const isDark = document.body.classList.contains('dark-theme');
  return Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2800,
    timerProgressBar: true,
    background: isDark ? '#1C263A' : '#FFFFFF',
    color: isDark ? '#F8FAFC' : '#111827',
    customClass: {
      popup: 'fintech-swal'
    }
  });
}

// ==========================================================================
// Initialization & Global Event Listeners
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Restore theme
  const savedTheme = localStorage.getItem('aura_theme') || 'dark';
  setAppTheme(savedTheme, false);

  // Global Search Shortcut (⌘ + K / Ctrl + K)
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('global-search-input');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });

  // Setup OTP Inputs
  setupOtpInputs();

  // Check user session
  checkSession();

  // Populate avatar presets
  populateAvatarPresets();

  // Lucide icons setup
  if (window.lucide) window.lucide.createIcons();
});

// ==========================================================================
// Session & Auth Handling
// ==========================================================================
async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.loggedIn && data.user) {
      handleLoginSuccess(data.user);
    } else {
      showAuthScreen();
    }
  } catch (err) {
    console.error('Session check failed:', err);
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
  document.getElementById('mobile-header').style.display = 'none';
  document.getElementById('mobile-nav').style.display = 'none';
  state.user = null;
  if (window.lucide) window.lucide.createIcons();
}

function handleLoginSuccess(user) {
  state.user = user;
  state.currency = user.currency || 'INR';

  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');

  // Display mobile elements via responsive classes
  document.getElementById('mobile-header').style.display = '';
  document.getElementById('mobile-nav').style.display = '';

  const displayName = user.name || user.username || 'Jay Rohit';
  const usernameDisplay = document.getElementById('username-display');
  const mobDropdownName = document.getElementById('mobile-dropdown-name');
  if (usernameDisplay) usernameDisplay.textContent = displayName;
  if (mobDropdownName) mobDropdownName.textContent = displayName;

  // Personalized dynamic greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const greetingEl = document.getElementById('header-greeting');
  if (greetingEl) greetingEl.textContent = `${timeGreeting}, ${displayName}!`;

  // Render all avatars
  renderAllAvatars(user);

  // Populate profile panel inputs
  const pName = document.getElementById('profile-name');
  const pUser = document.getElementById('profile-username');
  const pEmail = document.getElementById('profile-email');
  const pPhone = document.getElementById('profile-phone');
  const pBio = document.getElementById('profile-bio');
  const pCurr = document.getElementById('profile-currency');

  if (pName) pName.value = user.name || '';
  if (pUser) pUser.value = user.username || '';
  if (pEmail) pEmail.value = user.email || '';
  if (pPhone) pPhone.value = user.phone || '';
  if (pBio) pBio.value = user.bio || '';
  if (pCurr) pCurr.value = user.currency || 'INR';

  // Update modal currency symbols
  const sym = getCurrencySymbol();
  const modalSym = document.getElementById('modal-amount-symbol');
  if (modalSym) modalSym.textContent = sym;

  // Load backend data
  fetchData();
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-login-submit');
  const credential = document.getElementById('login-credential').value.trim();
  const password = document.getElementById('login-password').value;

  if (!credential || !password) {
    getToast().fire({ icon: 'warning', title: 'Please fill all fields' });
    return;
  }

  setButtonLoading(btn, true, 'Signing in...');
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    getToast().fire({ icon: 'success', title: 'Welcome back!' });
    handleLoginSuccess(data.user);
  } catch (err) {
    getToast().fire({ icon: 'error', title: err.message });
  } finally {
    setButtonLoading(btn, false, 'Sign In');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-register-submit');
  const name = document.getElementById('register-name').value.trim();
  const username = document.getElementById('register-username').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;

  if (!username || !email || !password) {
    getToast().fire({ icon: 'warning', title: 'Please fill all required fields' });
    return;
  }

  setButtonLoading(btn, true, 'Creating account...');
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    getToast().fire({ icon: 'success', title: 'Account created successfully!' });
    handleLoginSuccess(data.user);
  } catch (err) {
    getToast().fire({ icon: 'error', title: err.message });
  } finally {
    setButtonLoading(btn, false, 'Create Account');
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {}
  getToast().fire({ icon: 'info', title: 'Logged out successfully' });
  showAuthScreen();
}

function switchAuthTab(tab) {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('login-form');
  const formRegister = document.getElementById('register-form');

  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
  }
}

function setButtonLoading(btn, loading, text) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = `<span>${text}</span>`;
  } else if (btn.dataset.origText) {
    btn.innerHTML = btn.dataset.origText;
  }
}

// ==========================================================================
// Data Fetching & Sync
// ==========================================================================
async function fetchData() {
  try {
    const [txRes, budgetRes] = await Promise.all([
      fetch('/api/transactions'),
      fetch('/api/budgets')
    ]);

    state.transactions = await txRes.json();
    state.budgets = await budgetRes.json();

    populateMonthSelector();

    if (!state.selectedMonth) {
      state.selectedMonth = getActiveMonth();
      const select = document.getElementById('dashboard-month-select');
      if (select) select.value = state.selectedMonth;
    }

    await fetchSummaryStats();
    updateUI();
  } catch (err) {
    console.error('Fetch data error:', err);
  }
}

async function fetchSummaryStats() {
  try {
    const monthParam = state.selectedMonth ? `?month=${state.selectedMonth}` : '';
    const res = await fetch(`/api/stats/summary${monthParam}`);
    state.summary = await res.json();
  } catch (err) {
    console.error('Summary query failed:', err);
  }
}

async function handleManualRefresh() {
  const btn = document.getElementById('desktop-btn-refresh');
  if (btn) btn.classList.add('is-refreshing');

  await fetchData();
  getToast().fire({ icon: 'success', title: 'Data updated' });

  setTimeout(() => {
    if (btn) btn.classList.remove('is-refreshing');
  }, 400);
}

function getActiveMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function populateMonthSelector() {
  const select = document.getElementById('dashboard-month-select');
  if (!select) return;

  const monthSet = new Set();
  const currentMonth = getActiveMonth();
  monthSet.add(currentMonth);

  // Add months from transactions
  state.transactions.forEach(t => {
    if (t.date && t.date.length >= 7) {
      monthSet.add(t.date.substring(0, 7));
    }
  });

  const sortedMonths = Array.from(monthSet).sort().reverse();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  select.innerHTML = sortedMonths.map(m => {
    const [y, mm] = m.split('-');
    const label = `${monthNames[parseInt(mm, 10) - 1]} ${y}`;
    return `<option value="${m}">${label}</option>`;
  }).join('');
}

async function handleMonthChange() {
  const select = document.getElementById('dashboard-month-select');
  if (!select) return;
  state.selectedMonth = select.value;
  await fetchSummaryStats();
  updateUI();
}

// ==========================================================================
// SPA Navigation & Views
// ==========================================================================
function switchView(viewName) {
  state.activeView = viewName;
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Update navigation link highlights
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-btn').forEach(el => el.classList.remove('active'));

  const desktopNav = document.getElementById(`nav-${viewName}`);
  const mobileNav = document.getElementById(`mobile-nav-${viewName}`);
  if (desktopNav) desktopNav.classList.add('active');
  if (mobileNav) mobileNav.classList.add('active');

  // Toggle views
  document.querySelectorAll('.content-view').forEach(view => view.classList.add('hidden'));
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.remove('hidden');

  // Trigger view-specific loaders
  if (viewName === 'analytics') {
    renderCharts();
  } else if (viewName === 'categories') {
    renderCategoriesGrid();
  } else if (viewName === 'savings-goals') {
    renderGoalsGrid();
  } else if (viewName === 'dashboard') {
    renderDashboardOverviewChart(state.chartPeriod);
    renderDashboardCategoriesChart();
  }

  if (window.lucide) window.lucide.createIcons();
}

function updateUI() {
  renderMetrics();
  renderDashboardOverviewChart(state.chartPeriod);
  renderDashboardCategoriesChart();
  renderDashboardTransactions();
  renderTransactionsList();
  renderBudgetsList();
  renderCategoriesGrid();
  renderGoalsGrid();
  renderInsights();
  populateFilterCategoryDropdown();
  if (window.lucide) window.lucide.createIcons();
}

// ==========================================================================
// Dashboard Renderers & Financial Insights
// ==========================================================================
function renderMetrics() {
  const income = state.summary.totalIncome || 0;
  const expense = state.summary.totalExpense || 0;
  const savings = income - expense;
  const rate = income > 0 ? ((savings / income) * 100).toFixed(0) : 0;

  const balanceEl = document.getElementById('metric-balance');
  const incomeEl = document.getElementById('metric-income');
  const expenseEl = document.getElementById('metric-expense');
  const savingsEl = document.getElementById('metric-savings');
  const rateEl = document.getElementById('metric-savings-rate');

  if (balanceEl) balanceEl.textContent = formatCurrency(savings);
  if (incomeEl) incomeEl.textContent = formatCurrency(income);
  if (expenseEl) expenseEl.textContent = formatCurrency(expense);
  if (savingsEl) savingsEl.textContent = formatCurrency(savings);
  if (rateEl) rateEl.textContent = `${rate}%`;
}

function toggleDashboardChartPeriod(period) {
  state.chartPeriod = period;
  const btnThis = document.getElementById('btn-chart-period-this');
  const btnLast = document.getElementById('btn-chart-period-last');
  if (btnThis && btnLast) {
    if (period === 'this') {
      btnThis.classList.add('active');
      btnLast.classList.remove('active');
    } else {
      btnLast.classList.add('active');
      btnThis.classList.remove('active');
    }
  }
  renderDashboardOverviewChart(period);
}

function renderDashboardOverviewChart(period = 'this') {
  const canvas = document.getElementById('chart-dashboard-overview');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const isDark = document.body.classList.contains('dark-theme');

  // Filter transactions for period
  let targetMonth = state.selectedMonth || getActiveMonth();
  if (period === 'last') {
    const [y, m] = targetMonth.split('-').map(Number);
    const lastDate = new Date(y, m - 2, 1);
    targetMonth = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;
  }

  const txs = state.transactions.filter(t => t.date && t.date.startsWith(targetMonth));

  // 4 Week Buckets
  const incomeWeeks = [0, 0, 0, 0];
  const expenseWeeks = [0, 0, 0, 0];

  txs.forEach(t => {
    const day = parseInt(t.date.split('-')[2], 10) || 1;
    const weekIdx = Math.min(Math.floor((day - 1) / 7), 3);
    if (t.type === 'income') incomeWeeks[weekIdx] += t.amount;
    else expenseWeeks[weekIdx] += t.amount;
  });

  if (state.charts.dashboardOverview) {
    state.charts.dashboardOverview.destroy();
  }

  const incomeGrad = ctx.createLinearGradient(0, 0, 0, 220);
  incomeGrad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
  incomeGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  const expenseGrad = ctx.createLinearGradient(0, 0, 0, 220);
  expenseGrad.addColorStop(0, 'rgba(124, 58, 237, 0.25)');
  expenseGrad.addColorStop(1, 'rgba(124, 58, 237, 0.0)');

  state.charts.dashboardOverview = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [
        {
          label: 'Income',
          data: incomeWeeks,
          borderColor: '#10B981',
          backgroundColor: incomeGrad,
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointBackgroundColor: '#10B981',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Expenses',
          data: expenseWeeks,
          borderColor: '#7C3AED',
          backgroundColor: expenseGrad,
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointBackgroundColor: '#7C3AED',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1C263A' : '#FFFFFF',
          titleColor: isDark ? '#F8FAFC' : '#111827',
          bodyColor: isDark ? '#94A3B8' : '#64748B',
          borderColor: isDark ? '#263247' : '#E5E7EB',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)' },
          ticks: { color: isDark ? '#64748B' : '#94A3B8', font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)' },
          ticks: {
            color: isDark ? '#64748B' : '#94A3B8',
            font: { family: 'Inter', size: 11 },
            callback: (v) => formatCurrency(v)
          }
        }
      }
    }
  });
}

function renderDashboardCategoriesChart() {
  const canvas = document.getElementById('chart-dashboard-categories');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const isDark = document.body.classList.contains('dark-theme');

  const month = state.selectedMonth || getActiveMonth();
  const expenses = state.transactions.filter(t => t.type === 'expense' && t.date && t.date.startsWith(month));

  const catMap = {};
  let totalSpent = 0;
  expenses.forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    totalSpent += t.amount;
  });

  const totalEl = document.getElementById('dash-donut-total');
  if (totalEl) totalEl.textContent = formatCurrency(totalSpent);

  const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const labels = entries.slice(0, 5).map(e => e[0]);
  const values = entries.slice(0, 5).map(e => e[1]);

  const legendList = document.getElementById('dash-donut-legend');
  if (legendList) {
    if (entries.length === 0) {
      legendList.innerHTML = `<span style="font-size:0.85rem; color:var(--text-secondary);">No expenses recorded this month.</span>`;
    } else {
      legendList.innerHTML = entries.slice(0, 5).map((e, idx) => {
        const pct = totalSpent > 0 ? Math.round((e[1] / totalSpent) * 100) : 0;
        const col = COLORS.chartPalette[idx % COLORS.chartPalette.length];
        return `
          <div class="donut-legend-row">
            <div class="donut-legend-left">
              <span class="legend-dot" style="background-color:${col};"></span>
              <span>${escapeHtml(e[0])}</span>
            </div>
            <span class="donut-legend-pct">${pct}%</span>
          </div>
        `;
      }).join('');
    }
  }

  if (state.charts.dashboardCategories) {
    state.charts.dashboardCategories.destroy();
  }

  if (values.length === 0) {
    labels.push('No Expenses');
    values.push(1);
  }

  state.charts.dashboardCategories = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: entries.length > 0 ? COLORS.chartPalette : ['rgba(124, 58, 237, 0.1)'],
        borderColor: isDark ? '#151C2E' : '#FFFFFF',
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1C263A' : '#FFFFFF',
          titleColor: isDark ? '#F8FAFC' : '#111827',
          bodyColor: isDark ? '#94A3B8' : '#64748B',
          borderColor: isDark ? '#263247' : '#E5E7EB',
          borderWidth: 1,
          padding: 8,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`
          }
        }
      }
    }
  });
}

function renderDashboardTransactions() {
  const container = document.getElementById('dashboard-transactions');
  if (!container) return;

  const recent = state.transactions.slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:28px 16px; color:var(--text-secondary); font-size:0.875rem;">
        No recent transactions found. Tap "Add Transaction" to log an expense or income.
      </div>
    `;
    return;
  }

  container.innerHTML = recent.map(tx => {
    const isInc = tx.type === 'income';
    const catCfg = CATEGORY_ICONS[tx.category] || { icon: 'tag', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)' };
    const dateFormatted = formatDate(tx.date);
    const title = tx.description ? escapeHtml(tx.description) : escapeHtml(tx.category);

    return `
      <div class="recent-tx-item">
        <div class="recent-tx-left">
          <div class="tx-cat-icon" style="color:${catCfg.color}; background-color:${catCfg.bg};">
            <i data-lucide="${catCfg.icon}"></i>
          </div>
          <div class="recent-tx-details">
            <strong>${title}</strong>
            <span>${escapeHtml(tx.category)} • ${dateFormatted}</span>
          </div>
        </div>
        <span class="recent-tx-amount ${isInc ? 'income' : 'expense'}">
          ${isInc ? '+' : '-'}${formatCurrency(tx.amount)}
        </span>
      </div>
    `;
  }).join('');
}

function renderInsights() {
  const textEl = document.getElementById('dash-insight-text');
  if (!textEl) return;

  const month = state.selectedMonth || getActiveMonth();
  const txs = state.transactions.filter(t => t.date && t.date.startsWith(month));
  const expenses = txs.filter(t => t.type === 'expense');

  if (expenses.length === 0) {
    textEl.textContent = 'Keep logging your expenses to view automated category trends and budget consumption alerts.';
    return;
  }

  const catMap = {};
  let totalExpense = 0;
  expenses.forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    totalExpense += t.amount;
  });

  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const [topCat, topAmt] = sorted[0];
  const pct = Math.round((topAmt / totalExpense) * 100);

  textEl.textContent = `You spent ${formatCurrency(topAmt)} on ${topCat} this month, representing ${pct}% of your total outflows. Consider setting a category budget to cap non-essential spending.`;
}

// ==========================================================================
// Transactions Page & Filters
// ==========================================================================
function setTxTypeFilter(type) {
  state.filters.type = type;
  document.querySelectorAll('.tx-tab-btn').forEach(btn => btn.classList.remove('active'));
  const target = document.getElementById(`tab-tx-${type}`);
  if (target) target.classList.add('active');
  state.pagination.page = 1;
  renderTransactionsList();
}

function applyFilters() {
  const searchInput = document.getElementById('tx-search');
  const catFilter = document.getElementById('tx-category-filter');
  const dateFilter = document.getElementById('tx-date-filter');
  const amtFilter = document.getElementById('tx-amount-filter');

  state.filters.search = searchInput ? searchInput.value.trim().toLowerCase() : '';
  state.filters.category = catFilter ? catFilter.value : 'all';
  state.filters.date = dateFilter ? dateFilter.value : 'all';
  state.filters.amount = amtFilter ? amtFilter.value : 'all';

  state.pagination.page = 1;
  renderTransactionsList();
}

function getFilteredTransactions() {
  return state.transactions.filter(tx => {
    // Type Filter
    if (state.filters.type !== 'all' && tx.type !== state.filters.type) return false;

    // Search Filter
    if (state.filters.search) {
      const q = state.filters.search;
      const matchDesc = (tx.description || '').toLowerCase().includes(q);
      const matchCat = (tx.category || '').toLowerCase().includes(q);
      if (!matchDesc && !matchCat) return false;
    }

    // Category Filter
    if (state.filters.category !== 'all' && tx.category !== state.filters.category) return false;

    // Amount Filter
    if (state.filters.amount === 'low' && tx.amount >= 500) return false;
    if (state.filters.amount === 'mid' && (tx.amount < 500 || tx.amount > 5000)) return false;
    if (state.filters.amount === 'high' && tx.amount <= 5000) return false;

    // Date Filter
    if (state.filters.date !== 'all') {
      const txDate = new Date(tx.date);
      const now = new Date();
      if (state.filters.date === 'today') {
        if (tx.date !== now.toISOString().split('T')[0]) return false;
      } else if (state.filters.date === 'month') {
        const targetMonth = state.selectedMonth || getActiveMonth();
        if (!tx.date.startsWith(targetMonth)) return false;
      }
    }

    return true;
  }).sort((a, b) => {
    if (state.sort.key === 'date') {
      return state.sort.order === 'desc' ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date);
    } else if (state.sort.key === 'amount') {
      return state.sort.order === 'desc' ? b.amount - a.amount : a.amount - b.amount;
    }
    return 0;
  });
}

function toggleSort(key) {
  if (state.sort.key === key) {
    state.sort.order = state.sort.order === 'desc' ? 'asc' : 'desc';
  } else {
    state.sort.key = key;
    state.sort.order = 'desc';
  }
  renderTransactionsList();
}

function renderTransactionsList() {
  const tableBody = document.getElementById('transactions-list');
  const cardsContainer = document.getElementById('mobile-transactions-cards');
  if (!tableBody) return;

  const filtered = getFilteredTransactions();
  const total = filtered.length;
  const { page, itemsPerPage } = state.pagination;
  const startIdx = (page - 1) * itemsPerPage;
  const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

  // Update pagination indicators
  const startEl = document.getElementById('pg-start-idx');
  const endEl = document.getElementById('pg-end-idx');
  const totalEl = document.getElementById('pg-total-count');
  const prevBtn = document.getElementById('btn-pg-prev');
  const nextBtn = document.getElementById('btn-pg-next');

  if (startEl) startEl.textContent = total === 0 ? 0 : startIdx + 1;
  if (endEl) endEl.textContent = Math.min(startIdx + itemsPerPage, total);
  if (totalEl) totalEl.textContent = total;
  if (prevBtn) prevBtn.disabled = page <= 1;
  if (nextBtn) nextBtn.disabled = startIdx + itemsPerPage >= total;

  if (pageItems.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:36px; color:var(--text-secondary);">No matching transactions found.</td></tr>`;
    if (cardsContainer) {
      cardsContainer.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-secondary);">No transactions match your filters.</div>`;
    }
    return;
  }

  // Desktop Table Rows
  tableBody.innerHTML = pageItems.map(tx => {
    const isInc = tx.type === 'income';
    const catCfg = CATEGORY_ICONS[tx.category] || { icon: 'tag', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)' };
    const dateFormatted = formatDate(tx.date);
    const method = tx.payment_method || 'UPI';

    return `
      <tr>
        <td style="color:var(--text-secondary);">${dateFormatted}</td>
        <td><strong>${escapeHtml(tx.description || tx.category)}</strong></td>
        <td>
          <span class="badge-category">
            <i data-lucide="${catCfg.icon}" style="width:13px; height:13px; color:${catCfg.color};"></i>
            <span>${escapeHtml(tx.category)}</span>
          </span>
        </td>
        <td><span class="badge-payment">${escapeHtml(method)}</span></td>
        <td style="text-align:right; font-weight:700; color:${isInc ? 'var(--income)' : 'var(--expense)'};">
          ${isInc ? '+' : '-'}${formatCurrency(tx.amount)}
        </td>
        <td style="text-align:right;">
          <div class="action-buttons-cell" style="justify-content:flex-end;">
            <button class="btn-table-action" onclick="openTransactionModal('${tx.type}', '${tx.id || tx._id}')" title="Edit">
              <i data-lucide="pencil" style="width:15px; height:15px;"></i>
            </button>
            <button class="btn-table-action delete" onclick="deleteTransaction('${tx.id || tx._id}')" title="Delete">
              <i data-lucide="trash-2" style="width:15px; height:15px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Mobile Cards
  if (cardsContainer) {
    cardsContainer.innerHTML = pageItems.map(tx => {
      const isInc = tx.type === 'income';
      const catCfg = CATEGORY_ICONS[tx.category] || { icon: 'tag', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)' };
      const dateFormatted = formatDate(tx.date);
      const title = tx.description ? escapeHtml(tx.description) : escapeHtml(tx.category);

      return `
        <div class="mobile-tx-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div class="tx-cat-icon" style="color:${catCfg.color}; background-color:${catCfg.bg}; width:34px; height:34px;">
                <i data-lucide="${catCfg.icon}"></i>
              </div>
              <div>
                <strong>${title}</strong>
                <div style="font-size:0.75rem; color:var(--text-secondary);">${escapeHtml(tx.category)} • ${dateFormatted}</div>
              </div>
            </div>
            <strong style="color:${isInc ? 'var(--income)' : 'var(--expense)'}; font-size:1rem;">
              ${isInc ? '+' : '-'}${formatCurrency(tx.amount)}
            </strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:8px;">
            <span class="badge-payment">${escapeHtml(tx.payment_method || 'UPI')}</span>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-outline btn-sm" onclick="openTransactionModal('${tx.type}', '${tx.id || tx._id}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${tx.id || tx._id}')">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  if (window.lucide) window.lucide.createIcons();
}

function changePage(delta) {
  state.pagination.page += delta;
  renderTransactionsList();
}

function populateFilterCategoryDropdown() {
  const select = document.getElementById('tx-category-filter');
  if (!select) return;

  const cats = new Set();
  state.transactions.forEach(t => cats.add(t.category));

  select.innerHTML = '<option value="all">All Categories</option>' +
    Array.from(cats).sort().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

// ==========================================================================
// Add / Edit Transaction Modal
// ==========================================================================
let currentModalType = 'expense';
let selectedCategoryName = 'Food & Dining';

function setModalTxType(type) {
  currentModalType = type;
  const btnExp = document.getElementById('type-expense');
  const btnInc = document.getElementById('type-income');

  if (type === 'expense') {
    btnExp.classList.add('active');
    btnInc.classList.remove('active');
  } else {
    btnInc.classList.add('active');
    btnExp.classList.remove('active');
  }

  renderModalCategoryGrid(type);
}

function renderModalCategoryGrid(type) {
  const grid = document.getElementById('modal-category-picker-grid');
  if (!grid) return;

  const catList = CATEGORIES[type] || [];
  if (!catList.includes(selectedCategoryName)) {
    selectedCategoryName = catList[0] || '';
  }
  document.getElementById('modal-tx-category').value = selectedCategoryName;

  grid.innerHTML = catList.map(cat => {
    const cfg = CATEGORY_ICONS[cat] || { icon: 'tag', color: '#7C3AED' };
    const isAct = cat === selectedCategoryName;
    return `
      <div class="cat-picker-item ${isAct ? 'active' : ''}" onclick="selectModalCategory('${escapeHtml(cat)}')">
        <i data-lucide="${cfg.icon}" style="color:${cfg.color};"></i>
        <span>${escapeHtml(cat)}</span>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function selectModalCategory(cat) {
  selectedCategoryName = cat;
  document.getElementById('modal-tx-category').value = cat;
  renderModalCategoryGrid(currentModalType);
}

function openTransactionModal(type = 'expense', txId = null) {
  const modal = document.getElementById('transaction-modal');
  const title = document.getElementById('modal-tx-title');
  const submitBtn = document.getElementById('modal-tx-submit-btn');
  const idInput = document.getElementById('modal-tx-id');
  const amtInput = document.getElementById('modal-tx-amount');
  const dateInput = document.getElementById('modal-tx-date');
  const descInput = document.getElementById('modal-tx-desc');

  dateInput.value = new Date().toISOString().split('T')[0];
  idInput.value = '';
  amtInput.value = '';
  descInput.value = '';

  if (txId) {
    const tx = state.transactions.find(t => (t.id || t._id) === txId);
    if (tx) {
      idInput.value = tx.id || tx._id;
      amtInput.value = tx.amount;
      dateInput.value = tx.date;
      descInput.value = tx.description || '';
      selectedCategoryName = tx.category;
      setModalTxType(tx.type);
      title.textContent = 'Edit Transaction';
      submitBtn.textContent = 'Update Transaction';
    }
  } else {
    selectedCategoryName = type === 'expense' ? 'Food & Dining' : 'Salary';
    setModalTxType(type);
    title.textContent = 'Add Transaction';
    submitBtn.textContent = 'Add Transaction';
  }

  modal.classList.remove('hidden');
  amtInput.focus();
}

function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleSaveTransaction(e) {
  e.preventDefault();
  const txId = document.getElementById('modal-tx-id').value;
  const amount = parseFloat(document.getElementById('modal-tx-amount').value);
  const category = document.getElementById('modal-tx-category').value || selectedCategoryName;
  const date = document.getElementById('modal-tx-date').value;
  const description = document.getElementById('modal-tx-desc').value.trim();
  const paymentMethod = document.getElementById('modal-tx-payment-method').value;

  if (!amount || amount <= 0 || !category || !date) {
    getToast().fire({ icon: 'warning', title: 'Please provide a valid amount and category' });
    return;
  }

  const payload = {
    type: currentModalType,
    amount,
    category,
    date,
    description,
    payment_method: paymentMethod
  };

  try {
    const url = txId ? `/api/transactions/${txId}` : '/api/transactions';
    const method = txId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to save transaction');
    }

    closeTransactionModal();
    getToast().fire({ icon: 'success', title: txId ? 'Transaction updated' : 'Transaction recorded' });
    await fetchData();
  } catch (err) {
    getToast().fire({ icon: 'error', title: err.message });
  }
}

async function deleteTransaction(txId) {
  const sw = getSwalTheme();
  const result = await Swal.fire({
    title: 'Delete Transaction?',
    text: 'This action will permanently delete this record from your ledger.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete',
    cancelButtonText: 'Cancel',
    background: sw.background,
    color: sw.color,
    confirmButtonColor: '#F43F5E',
    cancelButtonColor: sw.cancelButtonColor
  });

  if (result.isConfirmed) {
    try {
      const res = await fetch(`/api/transactions/${txId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Deletion failed');
      getToast().fire({ icon: 'success', title: 'Transaction deleted' });
      await fetchData();
    } catch (err) {
      getToast().fire({ icon: 'error', title: err.message });
    }
  }
}

// ==========================================================================
// Budgets Management
// ==========================================================================
function renderBudgetsList() {
  const grid = document.getElementById('budgets-display-list');
  const amountEl = document.getElementById('overall-budget-amount');
  const spentEl = document.getElementById('overall-budget-spent');
  const progressEl = document.getElementById('overall-budget-progress');

  if (!grid) return;

  const month = state.selectedMonth || getActiveMonth();
  const expenses = state.transactions.filter(t => t.type === 'expense' && t.date && t.date.startsWith(month));

  let totalLimit = 0;
  let totalSpent = 0;

  state.budgets.forEach(b => {
    totalLimit += b.limit_amount;
  });

  expenses.forEach(t => {
    totalSpent += t.amount;
  });

  const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  if (amountEl) amountEl.textContent = formatCurrency(totalLimit);
  if (spentEl) spentEl.textContent = `${formatCurrency(totalSpent)} spent of ${formatCurrency(totalLimit)} (${overallPct}%)`;
  if (progressEl) {
    progressEl.style.width = `${Math.min(overallPct, 100)}%`;
    if (overallPct > 100) progressEl.className = 'budget-progress-bar danger';
    else if (overallPct > 80) progressEl.className = 'budget-progress-bar warning';
    else progressEl.className = 'budget-progress-bar';
  }

  if (state.budgets.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:36px; color:var(--text-secondary); background:var(--bg-card); border-radius:var(--radius-xl); border:1px solid var(--border-color);">
        No category budgets set. Tap "+ New Budget" to set limits for Food, Shopping, Bills, etc.
      </div>
    `;
    return;
  }

  grid.innerHTML = state.budgets.map(b => {
    const catSpent = expenses
      .filter(t => t.category === b.category)
      .reduce((sum, t) => sum + t.amount, 0);

    const pct = b.limit_amount > 0 ? Math.round((catSpent / b.limit_amount) * 100) : 0;
    const cfg = CATEGORY_ICONS[b.category] || { icon: 'tag', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)' };
    const barClass = pct > 100 ? 'danger' : pct > 80 ? 'warning' : '';

    return `
      <div class="category-budget-card">
        <div class="cat-budget-header">
          <div class="cat-budget-left">
            <div class="tx-cat-icon" style="color:${cfg.color}; background-color:${cfg.bg}; width:34px; height:34px;">
              <i data-lucide="${cfg.icon}"></i>
            </div>
            <strong>${escapeHtml(b.category)}</strong>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn-table-action delete" onclick="deleteBudget('${b.id || b._id}')" title="Delete Budget">
              <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
          </div>
        </div>

        <div class="cat-budget-amounts">
          <div>
            <strong>${formatCurrency(catSpent)}</strong>
            <span style="color:var(--text-secondary);"> / ${formatCurrency(b.limit_amount)}</span>
          </div>
          <span class="cat-budget-pct" style="color:${pct > 100 ? 'var(--expense)' : pct > 80 ? 'var(--warning)' : 'var(--income)'};">${pct}%</span>
        </div>

        <div class="budget-progress-track">
          <div class="budget-progress-bar ${barClass}" style="width: ${Math.min(pct, 100)}%;"></div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function openBudgetModal() {
  const modal = document.getElementById('budget-modal');
  const select = document.getElementById('budget-category');
  const limitInput = document.getElementById('budget-limit');

  if (select) {
    select.innerHTML = CATEGORIES.expense.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }
  if (limitInput) limitInput.value = '';
  if (modal) modal.classList.remove('hidden');
}

function closeBudgetModal() {
  const modal = document.getElementById('budget-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleSetBudget(e) {
  e.preventDefault();
  const category = document.getElementById('budget-category').value;
  const limitAmount = parseFloat(document.getElementById('budget-limit').value);

  if (!category || !limitAmount || limitAmount <= 0) {
    getToast().fire({ icon: 'warning', title: 'Enter a valid monthly limit amount' });
    return;
  }

  try {
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, limit_amount: limitAmount })
    });

    if (!res.ok) throw new Error('Failed to save budget');
    closeBudgetModal();
    getToast().fire({ icon: 'success', title: 'Budget saved' });
    await fetchData();
  } catch (err) {
    getToast().fire({ icon: 'error', title: err.message });
  }
}

async function deleteBudget(budgetId) {
  try {
    await fetch(`/api/budgets/${budgetId}`, { method: 'DELETE' });
    getToast().fire({ icon: 'success', title: 'Budget removed' });
    await fetchData();
  } catch (err) {
    getToast().fire({ icon: 'error', title: 'Failed to delete budget' });
  }
}

// ==========================================================================
// Analytics Charts Rendering
// ==========================================================================
async function renderCharts() {
  const colors = getChartThemeColors();
  const monthsRange = document.getElementById('analytics-time-range') ? parseInt(document.getElementById('analytics-time-range').value, 10) : 6;

  try {
    const [trendsRes, catRes] = await Promise.all([
      fetch(`/api/stats/monthly-trends?months=${monthsRange}`),
      fetch('/api/stats/category-breakdown')
    ]);

    const trendsData = await trendsRes.json();
    const catData = await catRes.json();

    renderTrendsChart(trendsData);
    renderCategoriesChart(catData);
    renderBudgetUtilizationChart();
  } catch (err) {
    console.error('Analytics chart error:', err);
  }
}

function getChartThemeColors() {
  const isDark = document.body.classList.contains('dark-theme');
  return {
    gridColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
    tickColor: isDark ? '#64748B' : '#94A3B8',
    legendColor: isDark ? '#94A3B8' : '#64748B',
    tooltipBg: isDark ? '#1C263A' : '#FFFFFF',
    tooltipColor: isDark ? '#F8FAFC' : '#111827',
    tooltipBorderColor: isDark ? '#263247' : '#E5E7EB',
    doughnutBorder: isDark ? '#151C2E' : '#FFFFFF'
  };
}

function renderTrendsChart(data) {
  const canvas = document.getElementById('chart-trends');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const colors = getChartThemeColors();

  if (state.charts.trends) state.charts.trends.destroy();

  const labels = data.map(d => d.label || d.month);
  const incomes = data.map(d => d.income);
  const expenses = data.map(d => d.expenses || d.expense);

  state.charts.trends = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomes,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5
        },
        {
          label: 'Expenses',
          data: expenses,
          borderColor: '#7C3AED',
          backgroundColor: 'rgba(124, 58, 237, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: colors.gridColor }, ticks: { color: colors.tickColor } },
        y: { grid: { color: colors.gridColor }, ticks: { color: colors.tickColor, callback: v => formatCurrency(v) } }
      }
    }
  });
}

function renderCategoriesChart(data) {
  const canvas = document.getElementById('chart-categories');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const colors = getChartThemeColors();

  if (state.charts.categories) state.charts.categories.destroy();

  const labels = data.map(d => d.category);
  const values = data.map(d => d.total);

  state.charts.categories = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: COLORS.chartPalette,
        borderColor: colors.doughnutBorder,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: colors.legendColor, font: { family: 'Inter', size: 11 } }
        }
      }
    }
  });
}

function renderBudgetUtilizationChart() {
  const canvas = document.getElementById('chart-budget-utilization');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const colors = getChartThemeColors();

  if (state.charts.utilization) state.charts.utilization.destroy();

  const labels = state.budgets.map(b => b.category);
  const limits = state.budgets.map(b => b.limit_amount);

  const month = state.selectedMonth || getActiveMonth();
  const expenses = state.transactions.filter(t => t.type === 'expense' && t.date && t.date.startsWith(month));

  const spents = state.budgets.map(b => {
    return expenses.filter(t => t.category === b.category).reduce((s, t) => s + t.amount, 0);
  });

  state.charts.utilization = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Limit', data: limits, backgroundColor: colors.gridColor },
        { label: 'Spent', data: spents, backgroundColor: '#7C3AED' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: colors.gridColor }, ticks: { color: colors.tickColor } },
        y: { grid: { color: colors.gridColor }, ticks: { color: colors.tickColor, callback: v => formatCurrency(v) } }
      }
    }
  });
}

// ==========================================================================
// Categories Management
// ==========================================================================
function switchCategoryTab(tab) {
  state.currentCategoryTab = tab;
  const btnExp = document.getElementById('tab-cat-expense');
  const btnInc = document.getElementById('tab-cat-income');
  if (btnExp && btnInc) {
    if (tab === 'expense') {
      btnExp.classList.add('active');
      btnInc.classList.remove('active');
    } else {
      btnInc.classList.add('active');
      btnExp.classList.remove('active');
    }
  }
  renderCategoriesGrid();
}

function renderCategoriesGrid() {
  const container = document.getElementById('categories-grid-container');
  if (!container) return;

  const type = state.currentCategoryTab || 'expense';
  const catList = CATEGORIES[type] || [];

  const month = state.selectedMonth || getActiveMonth();
  const txs = state.transactions.filter(t => t.type === type && t.date && t.date.startsWith(month));

  const cardsHtml = catList.map(cat => {
    const cfg = CATEGORY_ICONS[cat] || { icon: 'tag', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)' };
    const matchingTxs = txs.filter(t => t.category === cat);
    const sum = matchingTxs.reduce((s, t) => s + t.amount, 0);

    return `
      <div class="category-card">
        <div class="category-icon-circle" style="color:${cfg.color}; background-color:${cfg.bg};">
          <i data-lucide="${cfg.icon}"></i>
        </div>
        <div class="category-card-name">${escapeHtml(cat)}</div>
        <div class="category-card-meta">${matchingTxs.length} records • ${formatCurrency(sum)}</div>
      </div>
    `;
  }).join('');

  const addCardHtml = `
    <div class="category-card custom-add" onclick="openCategoryModal()">
      <div class="category-icon-circle" style="background-color:var(--bg-secondary); color:var(--text-secondary);">
        <i data-lucide="plus"></i>
      </div>
      <div class="category-card-name">+ Custom Category</div>
      <div class="category-card-meta">Create your own label</div>
    </div>
  `;

  container.innerHTML = cardsHtml + addCardHtml;
  if (window.lucide) window.lucide.createIcons();
}

let customCategoryType = 'expense';
let customCategoryIcon = 'tag';

function setCustomCategoryType(type) {
  customCategoryType = type;
  const btnExp = document.getElementById('modal-cat-type-expense');
  const btnInc = document.getElementById('modal-cat-type-income');
  if (btnExp && btnInc) {
    if (type === 'expense') {
      btnExp.classList.add('active');
      btnInc.classList.remove('active');
    } else {
      btnInc.classList.add('active');
      btnExp.classList.remove('active');
    }
  }
}

function openCategoryModal() {
  const modal = document.getElementById('category-modal');
  const nameInput = document.getElementById('custom-cat-name');
  if (nameInput) nameInput.value = '';
  renderCustomCategoryIconPicker();
  if (modal) modal.classList.remove('hidden');
}

function closeCategoryModal() {
  const modal = document.getElementById('category-modal');
  if (modal) modal.classList.add('hidden');
}

function renderCustomCategoryIconPicker() {
  const grid = document.getElementById('custom-cat-icon-grid');
  if (!grid) return;

  const availableIcons = [
    'utensils', 'shopping-bag', 'tv', 'zap', 'home',
    'plane', 'heart-pulse', 'graduation-cap', 'briefcase', 'laptop',
    'trending-up', 'gift', 'tag', 'smartphone', 'coffee'
  ];

  grid.innerHTML = availableIcons.map(ic => {
    return `
      <div class="cat-picker-item ${ic === customCategoryIcon ? 'active' : ''}" onclick="selectCustomCatIcon('${ic}')">
        <i data-lucide="${ic}"></i>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function selectCustomCatIcon(ic) {
  customCategoryIcon = ic;
  renderCustomCategoryIconPicker();
}

function handleSaveCustomCategory(e) {
  e.preventDefault();
  const name = document.getElementById('custom-cat-name').value.trim();
  if (!name) return;

  if (!CATEGORIES[customCategoryType].includes(name)) {
    CATEGORIES[customCategoryType].push(name);
  }
  CATEGORY_ICONS[name] = {
    icon: customCategoryIcon,
    color: '#7C3AED',
    bg: 'rgba(124, 58, 237, 0.12)'
  };

  closeCategoryModal();
  getToast().fire({ icon: 'success', title: `Added "${name}" category` });
  renderCategoriesGrid();
  populateFilterCategoryDropdown();
}

// ==========================================================================
// Savings Goals Management
// ==========================================================================
function getGoalsStorageKey() {
  const uid = (state.user && (state.user.id || state.user._id)) || 'guest';
  return `aura_savings_goals_${uid}`;
}

function loadSavedGoals() {
  try {
    const raw = localStorage.getItem(getGoalsStorageKey());
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  // Defaults matching design board mockup
  return [
    { id: 'goal-1', name: 'Trip to Japan', target: 50000, saved: 25000, date: '2026-12-31' },
    { id: 'goal-2', name: 'New Laptop', target: 75000, saved: 30000, date: '2026-11-30' }
  ];
}

function saveGoals(goals) {
  try {
    localStorage.setItem(getGoalsStorageKey(), JSON.stringify(goals));
  } catch (e) {}
}

function renderGoalsGrid() {
  const container = document.getElementById('goals-grid-container');
  if (!container) return;

  const goals = loadSavedGoals();

  if (goals.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:36px; color:var(--text-secondary); background:var(--bg-card); border-radius:var(--radius-xl); border:1px solid var(--border-color);">
        No savings goals created yet. Tap "+ New Goal" to start tracking milestones!
      </div>
    `;
    return;
  }

  container.innerHTML = goals.map(g => {
    const pct = g.target > 0 ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
    return `
      <div class="goal-card">
        <div class="goal-card-header">
          <div class="goal-title-group">
            <div class="goal-avatar-badge">
              <i data-lucide="target"></i>
            </div>
            <div>
              <h4>${escapeHtml(g.name)}</h4>
              <span>Target Date: ${g.date}</span>
            </div>
          </div>
          <button class="btn-table-action delete" onclick="deleteGoal('${g.id}')" title="Delete Goal">
            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
          </button>
        </div>

        <div class="goal-amount-row">
          <strong>${formatCurrency(g.saved)}</strong>
          <span>of ${formatCurrency(g.target)} (${pct}%)</span>
        </div>

        <div class="budget-progress-track">
          <div class="budget-progress-bar" style="width:${pct}%;"></div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="openGoalDepositModal('${g.id}')">
            <i data-lucide="plus"></i>
            <span>Add Funds</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function openGoalModal() {
  const modal = document.getElementById('goal-modal');
  const name = document.getElementById('goal-name');
  const target = document.getElementById('goal-target');
  const saved = document.getElementById('goal-saved');
  const date = document.getElementById('goal-date');

  if (name) name.value = '';
  if (target) target.value = '';
  if (saved) saved.value = '0';
  if (date) date.value = new Date().toISOString().split('T')[0];

  if (modal) modal.classList.remove('hidden');
}

function closeGoalModal() {
  const modal = document.getElementById('goal-modal');
  if (modal) modal.classList.add('hidden');
}

function handleSaveGoal(e) {
  e.preventDefault();
  const name = document.getElementById('goal-name').value.trim();
  const target = parseFloat(document.getElementById('goal-target').value);
  const saved = parseFloat(document.getElementById('goal-saved').value) || 0;
  const date = document.getElementById('goal-date').value;

  if (!name || !target || target <= 0) {
    getToast().fire({ icon: 'warning', title: 'Please provide valid goal details' });
    return;
  }

  const goals = loadSavedGoals();
  goals.push({
    id: `goal-${Date.now()}`,
    name,
    target,
    saved,
    date
  });

  saveGoals(goals);
  closeGoalModal();
  getToast().fire({ icon: 'success', title: 'Goal created' });
  renderGoalsGrid();
}

function deleteGoal(id) {
  let goals = loadSavedGoals();
  goals = goals.filter(g => g.id !== id);
  saveGoals(goals);
  getToast().fire({ icon: 'success', title: 'Goal deleted' });
  renderGoalsGrid();
}

function openGoalDepositModal(id) {
  const modal = document.getElementById('goal-deposit-modal');
  const goals = loadSavedGoals();
  const goal = goals.find(g => g.id === id);
  if (!goal) return;

  document.getElementById('deposit-goal-id').value = id;
  document.getElementById('deposit-goal-info').textContent = `Adding savings toward: ${goal.name}`;
  document.getElementById('deposit-goal-amount').value = '';

  if (modal) modal.classList.remove('hidden');
}

function closeGoalDepositModal() {
  const modal = document.getElementById('goal-deposit-modal');
  if (modal) modal.classList.add('hidden');
}

function handleSaveGoalDeposit(e) {
  e.preventDefault();
  const id = document.getElementById('deposit-goal-id').value;
  const amt = parseFloat(document.getElementById('deposit-goal-amount').value);

  if (!amt || amt <= 0) return;

  const goals = loadSavedGoals();
  const goal = goals.find(g => g.id === id);
  if (goal) {
    goal.saved += amt;
    saveGoals(goals);
    getToast().fire({ icon: 'success', title: `Added ${formatCurrency(amt)} to ${goal.name}` });
  }

  closeGoalDepositModal();
  renderGoalsGrid();
}

// ==========================================================================
// Settings, Theme & Sub-Navigation
// ==========================================================================
function switchSettingsPanel(panelName) {
  document.querySelectorAll('.settings-tab-link').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('[id^="panel-settings-"]').forEach(el => el.classList.add('hidden'));

  const targetTab = Array.from(document.querySelectorAll('.settings-tab-link')).find(el => {
    return el.textContent.toLowerCase().includes(panelName);
  });
  if (targetTab) targetTab.classList.add('active');

  const targetPanel = document.getElementById(`panel-settings-${panelName}`);
  if (targetPanel) targetPanel.classList.remove('hidden');

  if (window.lucide) window.lucide.createIcons();
}

function setAppTheme(theme, updateState = true) {
  state.theme = theme;
  if (updateState) {
    localStorage.setItem('aura_theme', theme);
  }

  if (theme === 'dark') {
    document.body.className = 'dark-theme';
  } else if (theme === 'light') {
    document.body.className = 'light-theme';
  } else if (theme === 'system') {
    const isSysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.className = isSysDark ? 'dark-theme' : 'light-theme';
  }

  // Highlight active theme card in settings
  document.querySelectorAll('.theme-card-option').forEach(el => el.classList.remove('active'));
  const card = document.getElementById(`theme-opt-${theme}`);
  if (card) card.classList.add('active');

  // Update theme toggle icons
  const iconDesk = document.getElementById('theme-icon-desktop');
  const iconMob = document.getElementById('theme-icon-mobile');
  const isDarkNow = document.body.classList.contains('dark-theme');
  const iconName = isDarkNow ? 'sun' : 'moon';

  if (iconDesk) iconDesk.setAttribute('data-lucide', iconName);
  if (iconMob) iconMob.setAttribute('data-lucide', iconName);

  // Re-render open charts with new palette
  if (state.charts.dashboardOverview) renderDashboardOverviewChart(state.chartPeriod);
  if (state.charts.dashboardCategories) renderDashboardCategoriesChart();
  if (state.activeView === 'analytics') renderCharts();

  if (window.lucide) window.lucide.createIcons();
}

function toggleTheme() {
  const current = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  setAppTheme(next);
}

async function handleUpdateProfileInfo(e) {
  e.preventDefault();
  const name = document.getElementById('profile-name').value.trim();
  const username = document.getElementById('profile-username').value.trim();
  const phone = document.getElementById('profile-phone').value.trim();
  const bio = document.getElementById('profile-bio').value.trim();

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, phone, bio })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update profile');

    state.user = data.user;
    renderAllAvatars(data.user);
    getToast().fire({ icon: 'success', title: 'Profile updated' });
  } catch (err) {
    getToast().fire({ icon: 'error', title: err.message });
  }
}

async function handleUpdatePreferences(e) {
  e.preventDefault();
  const currency = document.getElementById('profile-currency').value;

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update currency');

    state.currency = currency;
    state.user.currency = currency;
    getToast().fire({ icon: 'success', title: `Currency updated to ${currency}` });
    updateUI();
  } catch (err) {
    getToast().fire({ icon: 'error', title: err.message });
  }
}

function previewCurrencyChange(curr) {
  state.currency = curr;
  updateUI();
}

async function handleUpdatePassword(e) {
  e.preventDefault();
  const newPassword = document.getElementById('profile-new-password').value;
  const confirmPassword = document.getElementById('profile-confirm-password').value;

  if (newPassword !== confirmPassword) {
    getToast().fire({ icon: 'warning', title: 'Passwords do not match' });
    return;
  }

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: newPassword })
    });
    if (!res.ok) throw new Error('Password update failed');
    getToast().fire({ icon: 'success', title: 'Password successfully updated' });
    document.getElementById('profile-new-password').value = '';
    document.getElementById('profile-confirm-password').value = '';
  } catch (err) {
    getToast().fire({ icon: 'error', title: err.message });
  }
}

// Data Export & Import
async function handleExportData() {
  window.location.href = '/api/user/data/export';
  getToast().fire({ icon: 'success', title: 'Downloading backup...' });
}

async function handleFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      const res = await fetch('/api/user/data/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });
      if (!res.ok) throw new Error('Import failed');
      getToast().fire({ icon: 'success', title: 'Data restored successfully' });
      await fetchData();
    } catch (err) {
      getToast().fire({ icon: 'error', title: 'Invalid backup file' });
    }
  };
  reader.readAsText(file);
}

async function handleClearAllTransactions() {
  const sw = getSwalTheme();
  const result = await Swal.fire({
    title: 'Wipe all records?',
    text: 'All transactions and budget configurations will be permanently cleared.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, clear all',
    cancelButtonText: 'Cancel',
    background: sw.background,
    color: sw.color,
    confirmButtonColor: '#F43F5E'
  });

  if (result.isConfirmed) {
    try {
      await fetch('/api/user/data/clear', { method: 'DELETE' });
      getToast().fire({ icon: 'success', title: 'All records cleared' });
      await fetchData();
    } catch (err) {
      getToast().fire({ icon: 'error', title: 'Reset failed' });
    }
  }
}

// ==========================================================================
// Avatar & Camera/Gallery Upload (No emojis)
// ==========================================================================
function openAvatarModal() {
  const modal = document.getElementById('avatar-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeAvatarModal() {
  const modal = document.getElementById('avatar-modal');
  if (modal) modal.classList.add('hidden');
}

function populateAvatarPresets() {
  const grid = document.getElementById('avatar-grid-list');
  if (!grid) return;

  const colorGradients = [
    'linear-gradient(135deg, #7C3AED, #3B82F6)',
    'linear-gradient(135deg, #10B981, #059669)',
    'linear-gradient(135deg, #F59E0B, #D97706)',
    'linear-gradient(135deg, #EC4899, #8B5CF6)',
    'linear-gradient(135deg, #3B82F6, #1D4ED8)'
  ];

  grid.innerHTML = colorGradients.map((grad, i) => {
    return `
      <div onclick="selectColorGradientAvatar('${grad}')" style="width:48px; height:48px; border-radius:50%; background:${grad}; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#FFF; font-weight:700; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
        ${i + 1}
      </div>
    `;
  }).join('');
}

async function selectColorGradientAvatar(grad) {
  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: grad })
    });
    const data = await res.json();
    state.user = data.user;
    renderAllAvatars(data.user);
    closeAvatarModal();
    getToast().fire({ icon: 'success', title: 'Profile avatar updated' });
  } catch (err) {}
}

async function handleAvatarFileChosen(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const base64 = event.target.result;
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: base64 })
      });
      const data = await res.json();
      state.user = data.user;
      renderAllAvatars(data.user);
      closeAvatarModal();
      getToast().fire({ icon: 'success', title: 'Photo updated' });
    } catch (err) {
      getToast().fire({ icon: 'error', title: 'Failed to upload photo' });
    }
  };
  reader.readAsDataURL(file);
}

async function removePersonalPhoto() {
  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: '' })
    });
    const data = await res.json();
    state.user = data.user;
    renderAllAvatars(data.user);
    closeAvatarModal();
    getToast().fire({ icon: 'info', title: 'Photo removed' });
  } catch (err) {}
}

// ==========================================================================
// Modals: Pro Upgrade & Notifications
// ==========================================================================
function openProModal() {
  const modal = document.getElementById('pro-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeProModal() {
  const modal = document.getElementById('pro-modal');
  if (modal) modal.classList.add('hidden');
}

function handleProUpgradeClick() {
  closeProModal();
  Swal.fire({
    title: 'AuraFinance Pro Activated!',
    text: 'Welcome to the premium tier. All professional analytics features and receipt intelligence are unlocked.',
    icon: 'success',
    confirmButtonColor: '#7C3AED'
  });
}

function openNotificationsModal() {
  const modal = document.getElementById('notifications-modal');
  const list = document.getElementById('notifications-list');
  if (!modal || !list) return;

  // Build notifications from actual state
  const notifications = [
    { title: 'Statement Ready', desc: 'Your November 2026 transaction ledger is compiled.', icon: 'file-text' }
  ];

  if (state.summary.totalExpense > 0 && state.summary.totalIncome > 0) {
    const rate = Math.round(((state.summary.totalIncome - state.summary.totalExpense) / state.summary.totalIncome) * 100);
    notifications.push({
      title: 'Savings Milestone',
      desc: `Your current net savings rate is at ${rate}%.`,
      icon: 'trending-up'
    });
  }

  list.innerHTML = notifications.map(n => `
    <div style="display:flex; gap:12px; align-items:flex-start; padding:10px 0; border-bottom:1px solid var(--border-subtle);">
      <div style="width:32px; height:32px; border-radius:var(--radius-sm); background:var(--primary-subtle); color:var(--primary); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <i data-lucide="${n.icon}" style="width:16px; height:16px;"></i>
      </div>
      <div>
        <strong style="font-size:0.875rem; display:block;">${n.title}</strong>
        <span style="font-size:0.775rem; color:var(--text-secondary);">${n.desc}</span>
      </div>
    </div>
  `).join('');

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeNotificationsModal() {
  const modal = document.getElementById('notifications-modal');
  if (modal) modal.classList.add('hidden');
}

// Global Search
function handleGlobalSearch(q) {
  state.filters.search = q.trim().toLowerCase();
  if (state.activeView !== 'transactions') {
    switchView('transactions');
  }
  const searchInput = document.getElementById('tx-search');
  if (searchInput) searchInput.value = q;
  renderTransactionsList();
}

// Mobile Menu Toggle
function toggleMobileMenu() {
  const dropdown = document.getElementById('mobile-dropdown-menu');
  if (dropdown) dropdown.classList.toggle('hidden');
}

// ==========================================================================
// Google Auth & Password Reset Modals
// ==========================================================================
function openGoogleAuthModal() {
  const modal = document.getElementById('google-auth-modal');
  renderGoogleAuthAccounts();
  if (modal) modal.classList.remove('hidden');
}

function closeGoogleAuthModal() {
  const modal = document.getElementById('google-auth-modal');
  if (modal) modal.classList.add('hidden');
}

function renderGoogleAuthAccounts() {
  const container = document.getElementById('google-auth-content');
  if (!container) return;

  const accounts = [
    { name: 'Jay Rohit', email: 'jayrohit0310@gmail.com' }
  ];

  container.innerHTML = accounts.map(a => `
    <div onclick="handleGoogleAccountPick('${escapeHtml(a.name)}', '${escapeHtml(a.email)}')" style="display:flex; align-items:center; justify-content:space-between; padding:12px; border:1px solid var(--border-color); border-radius:var(--radius-md); cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border-color)'">
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="width:36px; height:36px; border-radius:50%; background:#4285F4; color:#FFF; display:flex; align-items:center; justify-content:center; font-weight:700;">
          ${a.name.substring(0, 1)}
        </div>
        <div>
          <strong style="font-size:0.875rem; display:block;">${escapeHtml(a.name)}</strong>
          <span style="font-size:0.775rem; color:var(--text-secondary);">${escapeHtml(a.email)}</span>
        </div>
      </div>
      <i data-lucide="chevron-right" style="width:16px; height:16px; color:var(--text-secondary);"></i>
    </div>
  `).join('');

  if (window.lucide) window.lucide.createIcons();
}

async function handleGoogleAccountPick(name, email) {
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, google_id: `g_${email}` })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google login failed');
    closeGoogleAuthModal();
    getToast().fire({ icon: 'success', title: 'Signed in with Google' });
    handleLoginSuccess(data.user);
  } catch (err) {
    getToast().fire({ icon: 'error', title: err.message });
  }
}

async function handleGoogleFormSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('google-input-email').value.trim();
  const name = document.getElementById('google-input-name').value.trim();
  if (email && name) {
    handleGoogleAccountPick(name, email);
  }
}

// Password Reset OTP
function openForgotPasswordModal() {
  const modal = document.getElementById('forgot-password-modal');
  state.otpState.targetStep = 1;
  document.getElementById('fp-step-1').classList.remove('hidden');
  document.getElementById('fp-step-2').classList.add('hidden');
  document.getElementById('fp-step-3').classList.add('hidden');
  if (modal) modal.classList.remove('hidden');
}

function closeForgotPasswordModal() {
  const modal = document.getElementById('forgot-password-modal');
  if (modal) modal.classList.add('hidden');
}

function setupOtpInputs() {
  for (let i = 1; i <= 6; i++) {
    const input = document.getElementById(`otp-${i}`);
    if (input) {
      input.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && i < 6) {
          const next = document.getElementById(`otp-${i + 1}`);
          if (next) next.focus();
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && i > 1) {
          const prev = document.getElementById(`otp-${i - 1}`);
          if (prev) prev.focus();
        }
      });
    }
  }
}

async function handleSendOtp() {
  const email = document.getElementById('fp-email').value.trim();
  if (!email) return;

  state.otpState.email = email;
  document.getElementById('fp-target-email').textContent = email;

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

    if (data.devOtp) {
      const banner = document.getElementById('fp-dev-otp-banner');
      const code = document.getElementById('fp-dev-otp-code');
      if (banner && code) {
        banner.classList.remove('hidden');
        code.textContent = data.devOtp;
      }
    }

    document.getElementById('fp-step-1').classList.add('hidden');
    document.getElementById('fp-step-2').classList.remove('hidden');
    startOtpCountdown();
  } catch (err) {
    getToast().fire({ icon: 'error', title: err.message });
  }
}

function startOtpCountdown() {
  state.otpState.remainingSeconds = 60;
  const countEl = document.getElementById('otp-timer-count');
  const resendBtn = document.getElementById('btn-resend-otp');

  if (resendBtn) resendBtn.disabled = true;

  clearInterval(state.otpState.timerInterval);
  state.otpState.timerInterval = setInterval(() => {
    state.otpState.remainingSeconds--;
    if (countEl) countEl.textContent = state.otpState.remainingSeconds;

    if (state.otpState.remainingSeconds <= 0) {
      clearInterval(state.otpState.timerInterval);
      if (resendBtn) resendBtn.disabled = false;
    }
  }, 1000);
}

function handleResendOtp() {
  handleSendOtp();
}

async function handleVerifyOtp() {
  let otp = '';
  for (let i = 1; i <= 6; i++) {
    const input = document.getElementById(`otp-${i}`);
    if (input) otp += input.value;
  }

  if (otp.length < 6) {
    getToast().fire({ icon: 'warning', title: 'Enter the complete 6-digit code' });
    return;
  }

  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.otpState.email, otp })
    });
    if (!res.ok) throw new Error('Invalid code');

    document.getElementById('fp-step-2').classList.add('hidden');
    document.getElementById('fp-step-3').classList.remove('hidden');
  } catch (err) {
    getToast().fire({ icon: 'error', title: err.message });
  }
}

async function handleResetPassword() {
  let otp = '';
  for (let i = 1; i <= 6; i++) {
    const input = document.getElementById(`otp-${i}`);
    if (input) otp += input.value;
  }
  const newPassword = document.getElementById('fp-new-password').value;
  const confirmPassword = document.getElementById('fp-confirm-password').value;

  if (newPassword !== confirmPassword) {
    getToast().fire({ icon: 'warning', title: 'Passwords do not match' });
    return;
  }

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: state.otpState.email,
        otp,
        new_password: newPassword
      })
    });
    if (!res.ok) throw new Error('Reset failed');

    closeForgotPasswordModal();
    getToast().fire({ icon: 'success', title: 'Password updated! Please log in.' });
  } catch (err) {
    getToast().fire({ icon: 'error', title: err.message });
  }
}

// ==========================================================================
// Reports Export (PDF & Excel)
// ==========================================================================
function exportReport(format) {
  const month = state.selectedMonth || getActiveMonth();
  const txs = state.transactions.filter(t => t.date && t.date.startsWith(month));

  if (txs.length === 0) {
    getToast().fire({ icon: 'info', title: 'No transactions found for export' });
    return;
  }

  const filename = `AuraFinance_${month}_Statement`;

  if (format === 'excel') {
    if (typeof XLSX === 'undefined') {
      getToast().fire({ icon: 'error', title: 'Excel export library not available' });
      return;
    }

    const rows = [['Date', 'Type', 'Category', 'Description', 'Payment Method', 'Amount (INR)']];
    txs.forEach(t => {
      rows.push([
        t.date,
        t.type.toUpperCase(),
        t.category,
        t.description || '',
        t.payment_method || 'UPI',
        t.type === 'expense' ? -t.amount : t.amount
      ]);
    });

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    getToast().fire({ icon: 'success', title: 'Excel spreadsheet downloaded' });

  } else if (format === 'pdf') {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      getToast().fire({ icon: 'error', title: 'PDF export library not available' });
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, 210, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('AuraFinance', 14, 18);
    doc.setFontSize(10);
    doc.text(`Monthly Financial Statement • ${month}`, 14, 28);

    const tableRows = txs.map(t => [
      t.date,
      t.type.toUpperCase(),
      t.category,
      t.description || '-',
      `${t.type === 'expense' ? '-' : '+'}${t.amount.toFixed(2)}`
    ]);

    doc.autoTable({
      head: [['Date', 'Type', 'Category', 'Description', 'Amount']],
      body: tableRows,
      startY: 44,
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237] }
    });

    doc.save(`${filename}.pdf`);
    getToast().fire({ icon: 'success', title: 'PDF Statement downloaded' });
  }
}

// Utility: Format Date
function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = parseInt(parts[1], 10) - 1;
  return `${monthNames[m]} ${parseInt(parts[2], 10)}, ${parts[0]}`;
}
