const API_BASE = (
  (window.APP_CONFIG && window.APP_CONFIG.API_BASE)
  || localStorage.getItem('go_todo_api_base')
  || 'http://localhost:8080'
).replace(/\/+$/, '');

const API_AUTH_LOGIN_ENDPOINT = `${API_BASE}/api/auth/login`;
const API_AUTH_REGISTER_ENDPOINT = `${API_BASE}/api/auth/register`;
const API_AUTH_ME_ENDPOINT = `${API_BASE}/api/auth/me`;
const AUTH_TOKEN_KEY = 'studyTracker_auth_token';
const AUTH_USER_KEY = 'studyTracker_auth_user';
const LOCAL_BACKUP_KEY = 'studyTracker_v2_backup';
const LEGACY_LOCAL_KEY = 'studyTracker_v2';

const tabLoginBtn = document.getElementById('tab-login');
const tabRegisterBtn = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authMessageEl = document.getElementById('auth-message');

initAuthPage().catch((error) => {
  console.error('认证页初始化失败:', error);
  showMessage('页面初始化失败，请刷新后重试。', true);
});

async function initAuthPage() {
  bindEvents();
  await tryAutoRedirectForLoggedInUser();
}

function bindEvents() {
  if (tabLoginBtn) {
    tabLoginBtn.addEventListener('click', () => setMode('login'));
  }
  if (tabRegisterBtn) {
    tabRegisterBtn.addEventListener('click', () => setMode('register'));
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleLoginSubmit();
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleRegisterSubmit();
    });
  }
}

function setMode(mode) {
  const isLogin = mode === 'login';
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
  tabLoginBtn.classList.toggle('active', isLogin);
  tabRegisterBtn.classList.toggle('active', !isLogin);
  showMessage('');
}

async function tryAutoRedirectForLoggedInUser() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    return;
  }

  try {
    const response = await fetch(API_AUTH_ME_ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      window.location.replace(getNextPage());
      return;
    }
    if (response.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch (_) {
    // 网络失败时保留当前页面，等待用户手动登录。
  }
}

async function handleLoginSubmit() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  await submitAuth(API_AUTH_LOGIN_ENDPOINT, username, password, '登录成功，正在进入...');
}

async function handleRegisterSubmit() {
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  await submitAuth(API_AUTH_REGISTER_ENDPOINT, username, password, '注册成功，正在进入...');
}

async function submitAuth(endpoint, username, password, successMessage) {
  if (!username || !password) {
    showMessage('用户名和密码不能为空。', true);
    return;
  }

  setFormsDisabled(true);
  showMessage('正在请求，请稍候...');
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const payload = await tryReadJson(response);
    if (!response.ok) {
      showMessage(readMessage(payload) || `请求失败：${response.status}`, true);
      return;
    }

    localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
    localStorage.setItem(AUTH_USER_KEY, payload.username || username);
    localStorage.removeItem(LOCAL_BACKUP_KEY);
    localStorage.removeItem(LEGACY_LOCAL_KEY);
    showMessage(successMessage, false);
    window.location.replace(getNextPage());
  } catch (error) {
    console.error('认证请求失败:', error);
    showMessage('网络异常，请检查后端服务是否可用。', true);
  } finally {
    setFormsDisabled(false);
  }
}

function getNextPage() {
  const params = new URLSearchParams(window.location.search);
  const rawNext = (params.get('next') || 'index.html').trim();
  const whitelist = new Set(['index.html', 'timer.html', 'stats.html']);
  return whitelist.has(rawNext) ? rawNext : 'index.html';
}

function setFormsDisabled(disabled) {
  [loginForm, registerForm].forEach((form) => {
    if (!form) {
      return;
    }
    Array.from(form.elements).forEach((el) => {
      el.disabled = disabled;
    });
  });
}

function showMessage(message, isError = false) {
  if (!authMessageEl) {
    return;
  }
  authMessageEl.textContent = message;
  authMessageEl.classList.toggle('error', Boolean(isError));
  authMessageEl.classList.toggle('success', Boolean(message) && !isError);
}

async function tryReadJson(response) {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

function readMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  return payload.message || payload.error || '';
}
