const API_BASE = (
  (window.APP_CONFIG && window.APP_CONFIG.API_BASE)
  || localStorage.getItem('go_todo_api_base')
  || 'http://localhost:8080'
).replace(/\/+$/, '');

const API_STATE_ENDPOINT = `${API_BASE}/api/state`;
const API_AUTH_LOGIN_ENDPOINT = `${API_BASE}/api/auth/login`;
const API_AUTH_REGISTER_ENDPOINT = `${API_BASE}/api/auth/register`;
const API_AUTH_ME_ENDPOINT = `${API_BASE}/api/auth/me`;
const API_AUTH_LOGOUT_ENDPOINT = `${API_BASE}/api/auth/logout`;
const LOCAL_BACKUP_KEY = 'studyTracker_v2_backup';
const LEGACY_LOCAL_KEY = 'studyTracker_v2';
const AUTH_TOKEN_KEY = 'studyTracker_auth_token';
const AUTH_USER_KEY = 'studyTracker_auth_user';
const MAX_PAUSE_SECONDS = 10 * 60;

const navButtons = document.querySelectorAll('.nav-btn[data-module]');
const modulePanels = document.querySelectorAll('.module-panel');
let activeModule = 'plan';

const planForm = document.getElementById('plan-form');
const planNameInput = document.getElementById('plan-name-input');
const planList = document.getElementById('plan-list');
const planEmpty = document.getElementById('plan-empty');
const planCardTemplate = document.getElementById('plan-card-template');

const themeSelect = document.getElementById('theme-select');

const weekPrevBtn = document.getElementById('week-prev-btn');
const weekNextBtn = document.getElementById('week-next-btn');
const calendarWeekLabel = document.getElementById('calendar-week-label');
const weekBoard = document.getElementById('week-board');

const timerPlanList = document.getElementById('timer-plan-list');
const timerPlanEmpty = document.getElementById('timer-plan-empty');
const timerStateEl = document.getElementById('timer-state');
const activePlanEl = document.getElementById('active-plan');
const timerDisplayEl = document.getElementById('timer-display');
const pauseLimitEl = document.getElementById('pause-limit');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const endBtn = document.getElementById('end-btn');

const todayTotalEl = document.getElementById('today-total');
const weekTotalEl = document.getElementById('week-total');
const monthTotalEl = document.getElementById('month-total');
const streakTotalEl = document.getElementById('streak-total');
const weekTotalHeroEl = document.getElementById('week-total-hero');
const weekActiveDaysEl = document.getElementById('week-active-days');
const monthActiveDaysEl = document.getElementById('month-active-days');
const taskCompletionRateEl = document.getElementById('task-completion-rate');

const breakdownDateInput = document.getElementById('breakdown-date');
const breakdownList = document.getElementById('breakdown-list');
const breakdownEmpty = document.getElementById('breakdown-empty');

const weekPieCanvas = document.getElementById('week-pie-canvas');
const monthPieCanvas = document.getElementById('month-pie-canvas');
const weekPieLegend = document.getElementById('week-pie-legend');
const monthPieLegend = document.getElementById('month-pie-legend');
const weekPieEmpty = document.getElementById('week-pie-empty');
const monthPieEmpty = document.getElementById('month-pie-empty');

const trendCanvas = document.getElementById('trend-canvas');
const chartAverageEl = document.getElementById('chart-average');

const recordBody = document.getElementById('record-body');
const recordTemplate = document.getElementById('record-row-template');
const recordEmpty = document.getElementById('empty-state');
const clearBtn = document.getElementById('clear-btn');
const currentUserEl = document.getElementById('current-user');
const logoutBtn = document.getElementById('logout-btn');

const PIE_COLORS = ['#f6d26b', '#ef7d52', '#6f7788', '#4f8f54', '#6ea7e8', '#b96bea', '#de5f78', '#44b9ae'];
const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

let state = defaultState();
let tickTimer = null;
let saveQueue = Promise.resolve();
let serverReachable = false;
let weekCursorStart = startOfWeek(new Date());
const expandedPlanIds = new Set();
const pieChartState = new Map();
let redirectingForAuth = false;

function setButtonContent(button, iconId, text) {
  button.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${iconId}"></use></svg><span>${text}</span>`;
}

init().catch((error) => {
  if (redirectingForAuth) {
    return;
  }
  console.error('初始化失败:', error);
  state = defaultState();
  applyTheme('light');
  renderAll();
});

async function init() {
  const authenticated = await ensureAuthenticated();
  if (!authenticated) {
    return;
  }

  if (breakdownDateInput) {
    breakdownDateInput.value = formatDate(new Date());
  }
  bindEvents();
  if (modulePanels.length && navButtons.length) {
    const defaultModule = document.body.dataset.module || 'plan';
    setActiveModule(defaultModule);
  }

  const loaded = await loadInitialState();
  state = loaded;

  applyTheme(state.theme || 'light');
  ensureTicking();
  renderAll();
}

function bindEvents() {
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveModule(btn.dataset.module);
    });
  });

  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      applyTheme(themeSelect.value);
      state.theme = themeSelect.value;
      saveState();
      drawTrendChart();
      renderCategoryPies();
    });
  }

  if (planForm && planNameInput) {
    planForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = planNameInput.value.trim();
      if (!name) {
        return;
      }

      const id = createId('plan');
      state.plans.push({ id, name, tasks: [] });
      expandedPlanIds.add(id);
      planNameInput.value = '';
      saveState();
      renderPlans();
      renderTimerPlanList();
      renderWeekBoard();
    });
  }

  if (weekPrevBtn) {
    weekPrevBtn.addEventListener('click', () => {
      const d = new Date(weekCursorStart);
      d.setDate(d.getDate() - 7);
      weekCursorStart = d;
      renderWeekBoard();
    });
  }

  if (weekNextBtn) {
    weekNextBtn.addEventListener('click', () => {
      const d = new Date(weekCursorStart);
      d.setDate(d.getDate() + 7);
      weekCursorStart = d;
      renderWeekBoard();
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', pauseSession);
  }
  if (resumeBtn) {
    resumeBtn.addEventListener('click', resumeSession);
  }
  if (endBtn) {
    endBtn.addEventListener('click', endSession);
  }

  if (breakdownDateInput) {
    breakdownDateInput.addEventListener('change', renderBreakdown);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const hasRecords = Object.keys(state.records || {}).length > 0;
      const hasSessionLogs = Object.keys(state.sessionLogs || {}).length > 0;
      if (!hasRecords && !hasSessionLogs) {
        return;
      }
      if (!confirm('确认清空全部学习记录吗？计划与任务会保留。')) {
        return;
      }
      state.records = {};
      state.sessionLogs = {};
      saveState();
      renderAll();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logout();
    });
  }

  window.addEventListener('resize', () => {
    drawTrendChart();
    renderCategoryPies();
  });
}

function setActiveModule(moduleName) {
  activeModule = moduleName;
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.module === moduleName);
  });
  modulePanels.forEach((panel) => {
    const visible = panel.dataset.modulePanel === moduleName;
    panel.hidden = !visible;
    panel.classList.toggle('active', visible);
  });
}

function applyTheme(theme) {
  const value = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', value);
  if (themeSelect) {
    themeSelect.value = value;
  }
}

function renderAll() {
  renderPlans();
  renderTimerPlanList();
  renderWeekBoard();
  renderTimer();
  renderStats();
  renderBreakdown();
  renderCategoryPies();
  renderTable();
  drawTrendChart();
}

function renderPlans() {
  if (!planList || !planEmpty || !planCardTemplate) {
    return;
  }
  planList.innerHTML = '';
  const plans = state.plans;
  planEmpty.style.display = plans.length ? 'none' : 'block';

  plans.forEach((plan) => {
    const card = planCardTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector('.plan-name').textContent = plan.name;

    const toggleBtn = card.querySelector('.toggle-btn');
    const editBtn = card.querySelector('.edit-btn');
    const removeBtn = card.querySelector('.remove-btn');
    const expanded = expandedPlanIds.has(plan.id);

    if (expanded) {
      card.classList.add('expanded');
      setButtonContent(toggleBtn, 'i-chevron-down', '收起');
    }

    toggleBtn.addEventListener('click', () => {
      if (expandedPlanIds.has(plan.id)) {
        expandedPlanIds.delete(plan.id);
      } else {
        expandedPlanIds.add(plan.id);
      }
      renderPlans();
    });

    editBtn.addEventListener('click', () => renamePlan(plan.id));
    removeBtn.addEventListener('click', () => deletePlan(plan.id));

    const taskForm = card.querySelector('.task-form');
    const taskTitleInput = card.querySelector('.task-title-input');
    const taskStartInput = card.querySelector('.task-start-input');
    const taskDaysInput = card.querySelector('.task-days-input');
    const taskList = card.querySelector('.task-list');
    const taskEmpty = card.querySelector('.task-empty');

    taskStartInput.value = formatDate(new Date());
    taskDaysInput.value = 1;

    taskForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = taskTitleInput.value.trim();
      const startDate = taskStartInput.value;
      const days = Number(taskDaysInput.value);

      if (!title || !isValidDateKey(startDate) || Number.isNaN(days) || days < 1 || days > 60) {
        alert('请填写有效计划名、开始日期和天数（1-60）。');
        return;
      }

      addTask(plan.id, title, startDate, days);
      taskTitleInput.value = '';
      taskDaysInput.value = 1;
    });

    renderTaskList(plan, taskList, taskEmpty);
    planList.appendChild(card);
  });
}

function renderTaskList(plan, container, emptyEl) {
  container.innerHTML = '';
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  emptyEl.style.display = tasks.length ? 'none' : 'block';

  tasks
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .forEach((task) => {
      const li = document.createElement('li');
      li.className = 'task-item';

      const top = document.createElement('div');
      top.className = 'task-item-top';

      const title = document.createElement('span');
      title.className = 'task-title';
      title.textContent = task.title;

      const actions = document.createElement('div');
      actions.className = 'task-item-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'secondary';
      setButtonContent(editBtn, 'i-edit', '修改');
      editBtn.addEventListener('click', () => editTask(plan.id, task.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'danger';
      setButtonContent(deleteBtn, 'i-trash', '删除');
      deleteBtn.addEventListener('click', () => removeTask(plan.id, task.id));

      actions.append(editBtn, deleteBtn);
      top.append(title, actions);

      const doneCount = task.dates.filter((dateKey) => !!task.completedDates?.[dateKey]).length;
      const meta = document.createElement('p');
      meta.className = 'task-meta';
      meta.textContent = `开始: ${task.startDate} / 天数: ${task.days} / 完成: ${doneCount}/${task.dates.length}`;

      li.append(top, meta);
      container.appendChild(li);
    });
}

function renderTimerPlanList() {
  if (!timerPlanList || !timerPlanEmpty) {
    return;
  }
  timerPlanList.innerHTML = '';
  const plans = state.plans;
  const taskEntries = [];
  plans.forEach((plan) => {
    (plan.tasks || []).forEach((task) => {
      taskEntries.push({ plan, task });
    });
  });
  timerPlanEmpty.style.display = taskEntries.length ? 'none' : 'block';

  taskEntries.forEach(({ plan, task }) => {
    const item = document.createElement('article');
    item.className = 'timer-plan-item';

    const left = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'timer-plan-name';
    name.textContent = task.title;
    const meta = document.createElement('p');
    meta.className = 'timer-plan-meta';
    meta.textContent = `类别：${plan.name}`;
    left.append(name, meta);
    const btn = document.createElement('button');
    btn.type = 'button';
    setButtonContent(btn, 'i-play', '开始计时');

    if (state.session && state.session.planId === plan.id && (!state.session.taskId || state.session.taskId === task.id)) {
      setButtonContent(btn, 'i-timer', '计时中');
      btn.disabled = true;
    } else if (state.session) {
      setButtonContent(btn, 'i-lock', '进行中（不可切换）');
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => startPlan(plan.id, task.id));
    }

    item.append(left, btn);
    timerPlanList.appendChild(item);
  });
}

function addTask(planId, title, startDate, days) {
  const plan = findPlan(planId);
  if (!plan) {
    return;
  }
  plan.tasks.push(createTask(title, startDate, days));
  saveState();
  renderPlans();
  renderWeekBoard();
  renderStats();
}

function editTask(planId, taskId) {
  const task = findTask(planId, taskId);
  if (!task) {
    return;
  }

  const nextTitle = prompt('计划名称：', task.title);
  if (nextTitle === null) {
    return;
  }
  const cleanTitle = nextTitle.trim();
  if (!cleanTitle) {
    alert('计划名称不能为空。');
    return;
  }

  const nextStart = prompt('开始日期（YYYY-MM-DD）：', task.startDate);
  if (nextStart === null) {
    return;
  }
  const cleanStart = nextStart.trim();
  if (!isValidDateKey(cleanStart)) {
    alert('开始日期格式无效，请使用 YYYY-MM-DD。');
    return;
  }

  const nextDaysText = prompt('持续天数（1-60）：', String(task.days));
  if (nextDaysText === null) {
    return;
  }
  const nextDays = Number(nextDaysText.trim());
  if (Number.isNaN(nextDays) || nextDays < 1 || nextDays > 60) {
    alert('持续天数必须是 1 到 60 的数字。');
    return;
  }

  const nextDates = buildDateSeries(cleanStart, nextDays);
  const nextCompleted = {};
  nextDates.forEach((dateKey) => {
    if (task.completedDates && task.completedDates[dateKey]) {
      nextCompleted[dateKey] = true;
    }
  });

  task.title = cleanTitle;
  task.startDate = cleanStart;
  task.days = nextDays;
  task.dates = nextDates;
  task.completedDates = nextCompleted;

  saveState();
  renderPlans();
  renderWeekBoard();
  renderStats();
}

function removeTask(planId, taskId) {
  const plan = findPlan(planId);
  if (!plan) {
    return;
  }
  const task = plan.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }
  if (!confirm(`确认删除计划“${task.title}”吗？`)) {
    return;
  }
  plan.tasks = plan.tasks.filter((item) => item.id !== taskId);
  saveState();
  renderPlans();
  renderWeekBoard();
  renderStats();
}

function renderWeekBoard() {
  if (!weekBoard || !calendarWeekLabel) {
    return;
  }
  weekBoard.innerHTML = '';
  const weekDays = getWeekDays(weekCursorStart);
  const startKey = formatDate(weekDays[0]);
  const endKey = formatDate(weekDays[6]);
  calendarWeekLabel.textContent = `${startKey} ~ ${endKey}`;

  weekDays.forEach((dayDate, idx) => {
    const dateKey = formatDate(dayDate);
    const entries = getScheduleEntriesByDate(dateKey);

    const col = document.createElement('article');
    col.className = 'week-day-column';
    if (dateKey === formatDate(new Date())) {
      col.classList.add('today');
    }

    const head = document.createElement('div');
    head.className = 'week-day-head';
    head.innerHTML = `<span class="week-day-name">${WEEKDAY_NAMES[idx]}</span><span class="week-day-date">${dayDate.getMonth() + 1}/${dayDate.getDate()}</span>`;

    const list = document.createElement('ul');
    list.className = 'week-schedule-list';

    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'week-task-item';
      empty.innerHTML = '<span class="week-task-sub">暂无安排</span>';
      list.appendChild(empty);
    } else {
      entries.forEach((entry) => {
        list.appendChild(createWeekTaskItem(entry));
      });
    }

    col.append(head, list);
    weekBoard.appendChild(col);
  });
}

function createWeekTaskItem(entry) {
  const li = document.createElement('li');
  li.className = 'week-task-item';
  li.classList.add('has-check');
  if (entry.done) {
    li.classList.add('done');
  }

  const title = document.createElement('span');
  title.className = 'week-task-title';
  title.textContent = entry.taskTitle;

  const sub = document.createElement('span');
  sub.className = 'week-task-sub';
  sub.textContent = entry.planName;

  const check = document.createElement('label');
  check.className = 'schedule-check';

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = entry.done;
  box.setAttribute('aria-label', '标记计划完成');
  box.addEventListener('change', () => {
    li.classList.toggle('done', box.checked);
    toggleTaskDone(entry.planId, entry.taskId, entry.date, box.checked);
  });

  const text = document.createElement('span');
  text.className = 'sr-only';
  text.textContent = '完成';

  check.append(box, text);
  li.append(title, sub, check);
  return li;
}

function getScheduleEntriesByDate(dateKey) {
  const entries = [];
  state.plans.forEach((plan) => {
    (plan.tasks || []).forEach((task) => {
      if (task.dates.includes(dateKey)) {
        entries.push({
          planId: plan.id,
          planName: plan.name,
          taskId: task.id,
          taskTitle: task.title,
          date: dateKey,
          done: !!task.completedDates?.[dateKey],
        });
      }
    });
  });
  return entries;
}

function toggleTaskDone(planId, taskId, dateKey, done) {
  const task = findTask(planId, taskId);
  if (!task) {
    return;
  }
  if (!task.completedDates) {
    task.completedDates = {};
  }
  if (done) {
    task.completedDates[dateKey] = true;
  } else {
    delete task.completedDates[dateKey];
  }
  saveState();
  renderPlans();
  renderWeekBoard();
  renderStats();
}

function renamePlan(planId) {
  const plan = findPlan(planId);
  if (!plan) {
    return;
  }
  const next = prompt('请输入新的类别名称：', plan.name);
  if (next === null) {
    return;
  }
  const clean = next.trim();
  if (!clean) {
    alert('类别名称不能为空。');
    return;
  }
  plan.name = clean;
  saveState();
  renderAll();
}

function deletePlan(planId) {
  if (state.session && state.session.planId === planId) {
    alert('该类别正在计时中，请结束后再删除。');
    return;
  }
  const plan = findPlan(planId);
  if (!plan) {
    return;
  }
  if (!confirm(`确认删除类别“${plan.name}”及其计划吗？`)) {
    return;
  }
  state.plans = state.plans.filter((item) => item.id !== planId);
  expandedPlanIds.delete(planId);
  saveState();
  renderAll();
}

function startPlan(planId, taskId = null) {
  if (state.session) {
    alert('当前已有进行中的计时，请先结束。');
    return;
  }
  const nowMs = Date.now();
  state.session = {
    planId,
    taskId,
    elapsedSec: 0,
    startedAtMs: nowMs,
    firstStartedAtMs: nowMs,
    paused: false,
    pausedAtMs: null,
  };
  saveState();
  ensureTicking();
  renderTimerPlanList();
  renderTimer();
}

function pauseSession() {
  const session = state.session;
  if (!session || session.paused) {
    return;
  }
  session.elapsedSec += Math.floor((Date.now() - session.startedAtMs) / 1000);
  session.startedAtMs = null;
  session.paused = true;
  session.pausedAtMs = Date.now();
  saveState();
  renderTimer();
}

function resumeSession() {
  const session = state.session;
  if (!session || !session.paused) {
    return;
  }
  const pausedSeconds = Math.floor((Date.now() - session.pausedAtMs) / 1000);
  if (pausedSeconds > MAX_PAUSE_SECONDS) {
    forceEndForPauseLimit();
    return;
  }
  session.paused = false;
  session.pausedAtMs = null;
  session.startedAtMs = Date.now();
  saveState();
  renderTimer();
}

function endSession() {
  const session = state.session;
  if (!session) {
    return;
  }
  const totalSec = getSessionElapsedSec(session);
  const endedAtMs = Date.now();
  const today = formatDate(new Date());
  if (!state.records[today]) {
    state.records[today] = {};
  }
  const current = state.records[today][session.planId] || 0;
  state.records[today][session.planId] = current + totalSec;

  if (!state.sessionLogs[today]) {
    state.sessionLogs[today] = [];
  }
  state.sessionLogs[today].push({
    id: createId('log'),
    planId: session.planId,
    taskId: session.taskId || null,
    startAtMs: resolveSessionFirstStart(session),
    endAtMs: endedAtMs,
    seconds: totalSec,
  });

  state.session = null;
  saveState();
  renderTimerPlanList();
  renderAll();
}

function forceEndForPauseLimit() {
  alert('暂停超过 10 分钟，本次学习已自动结束并计入今日时长。');
  endSession();
}

function renderTimer() {
  if (!timerStateEl || !activePlanEl || !timerDisplayEl || !pauseLimitEl || !pauseBtn || !resumeBtn || !endBtn) {
    return;
  }
  const session = state.session;
  if (!session) {
    timerStateEl.textContent = '未开始';
    timerStateEl.className = 'timer-state idle';
    activePlanEl.textContent = '当前计划：无';
    timerDisplayEl.textContent = '00:00:00';
    pauseLimitEl.textContent = '暂停剩余：10:00';
    pauseBtn.disabled = true;
    resumeBtn.disabled = true;
    endBtn.disabled = true;
    return;
  }

  const elapsed = getSessionElapsedSec(session);
  activePlanEl.textContent = `当前计划：${getSessionTaskLabel(session)}`;
  timerDisplayEl.textContent = formatHms(elapsed);

  if (session.paused) {
    const pausedSec = Math.floor((Date.now() - session.pausedAtMs) / 1000);
    const remain = Math.max(0, MAX_PAUSE_SECONDS - pausedSec);
    timerStateEl.textContent = '已暂停';
    timerStateEl.className = 'timer-state paused';
    pauseLimitEl.textContent = `暂停剩余：${formatMmSs(remain)}`;
    pauseBtn.disabled = true;
    resumeBtn.disabled = false;
    endBtn.disabled = false;
  } else {
    timerStateEl.textContent = '计时中';
    timerStateEl.className = 'timer-state running';
    pauseLimitEl.textContent = '暂停剩余：10:00';
    pauseBtn.disabled = false;
    resumeBtn.disabled = true;
    endBtn.disabled = false;
  }
}

function renderStats() {
  if (!todayTotalEl || !weekTotalEl || !monthTotalEl || !streakTotalEl || !weekTotalHeroEl || !weekActiveDaysEl || !monthActiveDaysEl || !taskCompletionRateEl) {
    return;
  }
  const now = new Date();
  const today = formatDate(now);

  const todaySec = sumByDate(today);
  const weekSec = sumBetween(getStartOfWeek(now), now);
  const monthSec = sumBetween(getStartOfMonth(now), now);
  const streak = calculateStreak(now);
  const weekDays = countActiveDaysBetween(getStartOfWeek(now), now);
  const monthDays = countActiveDaysBetween(getStartOfMonth(now), now);
  const completion = getTaskCompletionRate();

  todayTotalEl.textContent = `${Math.round(todaySec / 60)} 分钟`;
  weekTotalEl.textContent = `${Math.round(weekSec / 60)} 分钟`;
  weekTotalHeroEl.textContent = `${Math.round(weekSec / 60)} 分钟`;
  monthTotalEl.textContent = `${Math.round(monthSec / 60)} 分钟`;
  streakTotalEl.textContent = `${streak} 天`;
  weekActiveDaysEl.textContent = `${weekDays} 天`;
  monthActiveDaysEl.textContent = `${monthDays} 天`;
  taskCompletionRateEl.textContent = `${completion}%`;
}

function renderBreakdown() {
  if (!breakdownList || !breakdownDateInput || !breakdownEmpty) {
    return;
  }
  breakdownList.innerHTML = '';
  const date = breakdownDateInput.value || formatDate(new Date());
  const dayData = state.records[date] || {};
  const details = Object.entries(dayData)
    .filter(([, sec]) => sec > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalSec = details.reduce((sum, [, sec]) => sum + sec, 0);

  breakdownEmpty.style.display = details.length ? 'none' : 'block';
  details.forEach(([planId, sec]) => {
    const percent = totalSec > 0 ? ((sec / totalSec) * 100).toFixed(1) : '0.0';
    const item = document.createElement('li');
    item.className = 'breakdown-item';
    item.innerHTML = `<span>${escapeHtml(getPlanName(planId))}</span><strong>${Math.round(sec / 60)} 分钟 (${percent}%)</strong>`;
    breakdownList.appendChild(item);
  });
}

function renderCategoryPies() {
  if (!weekPieCanvas || !monthPieCanvas || !weekPieLegend || !monthPieLegend || !weekPieEmpty || !monthPieEmpty) {
    return;
  }
  const now = new Date();
  const weekData = getCategorySummary(getStartOfWeek(now), now);
  const monthData = getCategorySummary(getStartOfMonth(now), now);
  renderPieChart(weekPieCanvas, weekPieLegend, weekPieEmpty, weekData);
  renderPieChart(monthPieCanvas, monthPieLegend, monthPieEmpty, monthData);
}

function drawInteractivePie(canvas) {
  const stateForCanvas = pieChartState.get(canvas);
  if (!stateForCanvas) {
    return;
  }
  const {
    ctx, width, height, cx, cy, radius, slices, hoverIndex,
  } = stateForCanvas;
  const surfaceStrong = getComputedStyle(document.documentElement).getPropertyValue('--surface-strong').trim() || '#ffffff';

  ctx.clearRect(0, 0, width, height);
  slices.forEach((slice, index) => {
    const isActive = index === hoverIndex;
    const startRad = -Math.PI / 2 + slice.start;
    const endRad = -Math.PI / 2 + slice.end;
    const midRad = -Math.PI / 2 + (slice.start + slice.end) / 2;
    const offset = isActive ? 10 : 0;
    const ox = Math.cos(midRad) * offset;
    const oy = Math.sin(midRad) * offset;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startRad, endRad);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    ctx.lineWidth = isActive ? 2.6 : 1.8;
    ctx.strokeStyle = surfaceStrong;
    ctx.stroke();
    ctx.restore();
  });
}

function applyPieHoverState(canvas, hoverIndex) {
  const stateForCanvas = pieChartState.get(canvas);
  if (!stateForCanvas || stateForCanvas.hoverIndex === hoverIndex) {
    return;
  }
  stateForCanvas.hoverIndex = hoverIndex;
  drawInteractivePie(canvas);
  stateForCanvas.legendItems.forEach((li, idx) => {
    li.classList.toggle('active', idx === hoverIndex);
  });
  canvas.style.cursor = hoverIndex >= 0 ? 'pointer' : 'default';
}

function pickPieSliceIndex(canvas, clientX, clientY) {
  const stateForCanvas = pieChartState.get(canvas);
  if (!stateForCanvas) {
    return -1;
  }
  const {
    cx, cy, radius, slices,
  } = stateForCanvas;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > radius + 10) {
    return -1;
  }
  let angleFromTop = Math.atan2(dy, dx) + Math.PI / 2;
  if (angleFromTop < 0) {
    angleFromTop += Math.PI * 2;
  }
  return slices.findIndex((slice) => angleFromTop >= slice.start && angleFromTop < slice.end);
}

function renderPieChart(canvas, legendEl, emptyEl, data) {
  if (!canvas || !legendEl || !emptyEl) {
    return;
  }
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  legendEl.innerHTML = '';

  const totalSec = data.reduce((sum, item) => sum + item.seconds, 0);
  if (!data.length || totalSec <= 0) {
    emptyEl.style.display = 'block';
    pieChartState.delete(canvas);
    canvas.style.cursor = 'default';
    return;
  }
  emptyEl.style.display = 'none';

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.34;
  let accumulated = 0;
  const slices = [];
  const legendItems = [];

  data.forEach((item, index) => {
    const color = PIE_COLORS[index % PIE_COLORS.length];
    const angle = (item.seconds / totalSec) * Math.PI * 2;
    const start = accumulated;
    const end = accumulated + angle;
    slices.push({
      color, start, end, angle, item,
    });
    accumulated = end;

    const li = document.createElement('li');
    li.dataset.pieIndex = String(index);
    li.innerHTML = `<span class="pie-name"><span class="pie-dot" style="background:${color}"></span>${escapeHtml(item.name)}</span><strong>${Math.round(item.seconds / 60)} 分钟 (${((item.seconds / totalSec) * 100).toFixed(1)}%)</strong>`;
    li.addEventListener('mouseenter', () => applyPieHoverState(canvas, index));
    li.addEventListener('mouseleave', () => applyPieHoverState(canvas, -1));
    legendItems.push(li);
    legendEl.appendChild(li);
  });

  pieChartState.set(canvas, {
    ctx,
    width,
    height,
    cx,
    cy,
    radius,
    slices,
    legendItems,
    hoverIndex: -1,
  });
  drawInteractivePie(canvas);

  if (!canvas.dataset.pieInteractiveBound) {
    canvas.dataset.pieInteractiveBound = '1';
    canvas.addEventListener('mousemove', (event) => {
      const hoverIndex = pickPieSliceIndex(canvas, event.clientX, event.clientY);
      applyPieHoverState(canvas, hoverIndex);
    });
    canvas.addEventListener('mouseleave', () => {
      applyPieHoverState(canvas, -1);
    });
  }
}

function drawTrendChart() {
  if (!trendCanvas || !chartAverageEl) {
    return;
  }
  const points = lastNDays(7);
  const maxValue = Math.max(...points.map((item) => item.minutes), 60);
  const total = points.reduce((sum, item) => sum + item.minutes, 0);
  chartAverageEl.textContent = `日均 ${Math.round(total / points.length)} 分钟`;

  const ctx = trendCanvas.getContext('2d');
  const rect = trendCanvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (trendCanvas.width !== Math.round(width * dpr) || trendCanvas.height !== Math.round(height * dpr)) {
    trendCanvas.width = Math.round(width * dpr);
    trendCanvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const padding = { top: 26, right: 30, bottom: 38, left: 30 };
  const chartHeight = height - padding.top - padding.bottom;
  const valueLabelSpace = 24;
  const plotTop = padding.top + valueLabelSpace;
  const plotHeight = Math.max(20, chartHeight - valueLabelSpace);
  const chartWidth = width - padding.left - padding.right;
  ctx.clearRect(0, 0, width, height);

  const css = getComputedStyle(document.documentElement);
  const lineColor = css.getPropertyValue('--grid-line').trim() || '#d7d3ca';
  const textColor = css.getPropertyValue('--text').trim() || '#1c2825';
  const barColor = css.getPropertyValue('--accent').trim() || '#5f8078';
  const barLabelColor = css.getPropertyValue('--text').trim() || '#1c2825';

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = Math.round(plotTop + (plotHeight / 4) * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  const slotWidth = chartWidth / points.length;
  const barWidth = Math.min(42, slotWidth * 0.42);
  points.forEach((item, index) => {
    const barHeight = maxValue ? (item.minutes / maxValue) * plotHeight : 0;
    const x = padding.left + index * slotWidth + (slotWidth - barWidth) / 2;
    const y = plotTop + (plotHeight - barHeight);

    roundRect(ctx, x, y, barWidth, barHeight, 7, barColor);

    ctx.fillStyle = barLabelColor;
    ctx.font = '700 13px Manrope, \"Noto Sans SC\", \"Segoe UI\", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const valueY = Math.max(padding.top + 12, y - 8);
    ctx.fillText(`${item.minutes} 分钟`, x + barWidth / 2, valueY);

    ctx.fillStyle = textColor;
    ctx.font = '700 13px Manrope, \"Noto Sans SC\", \"Segoe UI\", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(item.label, x + barWidth / 2, height - padding.bottom + 10);
  });
}

function renderTable() {
  if (!recordBody || !recordTemplate || !recordEmpty) {
    return;
  }
  recordBody.innerHTML = '';
  const entries = Object.entries(state.records)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .filter(([, dayData]) => dayData && typeof dayData === 'object' && Object.keys(dayData).length);

  recordEmpty.style.display = entries.length ? 'none' : 'block';
  entries.forEach(([date, dayData]) => {
    const tr = recordTemplate.content.firstElementChild.cloneNode(true);
    const total = Object.values(dayData).reduce((sum, value) => sum + value, 0);
    tr.querySelector('.date').textContent = prettyDate(date);
    tr.querySelector('.duration').textContent = `${Math.round(total / 60)} 分钟 (${formatDuration(total)})`;

    const detailText = Object.entries(dayData)
      .filter(([, sec]) => sec > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([planId, sec]) => `${getPlanName(planId)}: ${Math.round(sec / 60)} 分钟`)
      .join(' / ');
    tr.querySelector('.detail').textContent = detailText || '-';

    const timeRangeCell = tr.querySelector('.time-range');
    const logs = getLogsByDate(date);
    if (timeRangeCell) {
      timeRangeCell.textContent = '';
      if (!logs.length) {
        timeRangeCell.textContent = '-';
      } else {
        logs.forEach((log) => {
          const item = document.createElement('div');
          item.className = 'time-range-item';
          item.textContent = `${getPlanName(log.planId)}: ${formatClock(log.startAtMs)} - ${formatClock(log.endAtMs)}`;
          timeRangeCell.appendChild(item);
        });
      }
    }

    tr.querySelector('.delete-btn').addEventListener('click', () => {
      delete state.records[date];
      delete state.sessionLogs[date];
      saveState();
      renderAll();
    });

    recordBody.appendChild(tr);
  });
}

function roundRect(ctx, x, y, width, height, radius, fillStyle) {
  if (height <= 0) {
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function ensureTicking() {
  if (tickTimer) {
    clearInterval(tickTimer);
  }
  tickTimer = setInterval(() => {
    if (!state.session) {
      return;
    }
    if (state.session.paused) {
      const pausedSec = Math.floor((Date.now() - state.session.pausedAtMs) / 1000);
      if (pausedSec > MAX_PAUSE_SECONDS) {
        forceEndForPauseLimit();
        return;
      }
    }
    renderTimer();
  }, 1000);
}

function getSessionElapsedSec(session) {
  if (!session) {
    return 0;
  }
  if (session.paused) {
    return session.elapsedSec;
  }
  return session.elapsedSec + Math.floor((Date.now() - session.startedAtMs) / 1000);
}

function getLogsByDate(dateKey) {
  const raw = state.sessionLogs && Array.isArray(state.sessionLogs[dateKey]) ? state.sessionLogs[dateKey] : [];
  return raw
    .filter((log) => log && typeof log === 'object')
    .sort((a, b) => (a.startAtMs || 0) - (b.startAtMs || 0));
}

function getCategorySummary(start, end) {
  const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const summary = {};
  Object.entries(state.records).forEach(([date, dayData]) => {
    const stamp = new Date(`${date}T00:00:00`).getTime();
    if (stamp < startTime || stamp > endTime) {
      return;
    }
    Object.entries(dayData).forEach(([planId, sec]) => {
      summary[planId] = (summary[planId] || 0) + sec;
    });
  });
  return Object.entries(summary)
    .map(([planId, seconds]) => ({ planId, name: getPlanName(planId), seconds }))
    .filter((item) => item.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
}

function sumByDate(dateText) {
  const dayData = state.records[dateText] || {};
  return Object.values(dayData).reduce((sum, sec) => sum + sec, 0);
}

function sumBetween(start, end) {
  const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Object.entries(state.records).reduce((sum, [date, dayData]) => {
    const stamp = new Date(`${date}T00:00:00`).getTime();
    if (stamp < startTime || stamp > endTime) {
      return sum;
    }
    return sum + Object.values(dayData).reduce((sub, sec) => sub + sec, 0);
  }, 0);
}

function countActiveDaysBetween(start, end) {
  const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Object.entries(state.records).reduce((count, [date, dayData]) => {
    const stamp = new Date(`${date}T00:00:00`).getTime();
    if (stamp < startTime || stamp > endTime) {
      return count;
    }
    const total = Object.values(dayData).reduce((sum, sec) => sum + sec, 0);
    return total > 0 ? count + 1 : count;
  }, 0);
}

function getTaskCompletionRate() {
  let total = 0;
  let done = 0;
  state.plans.forEach((plan) => {
    (plan.tasks || []).forEach((task) => {
      total += task.dates.length;
      done += task.dates.filter((d) => !!task.completedDates?.[d]).length;
    });
  });
  if (!total) {
    return 0;
  }
  return Math.round((done / total) * 100);
}

function calculateStreak(fromDate) {
  let streak = 0;
  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  while (true) {
    const key = formatDate(cursor);
    if (sumByDate(key) <= 0) {
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getStartOfWeek(date) {
  return startOfWeek(date);
}

function getStartOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function lastNDays(n) {
  const arr = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = formatDate(d);
    arr.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, minutes: Math.round(sumByDate(key) / 60) });
  }
  return arr;
}

function startOfWeek(date) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = current.getDay();
  const diff = day === 0 ? 6 : day - 1;
  current.setDate(current.getDate() - diff);
  return current;
}

function getWeekDays(weekStart) {
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function findPlan(planId) {
  return state.plans.find((plan) => plan.id === planId);
}

function findTask(planId, taskId) {
  const plan = findPlan(planId);
  if (!plan) {
    return null;
  }
  return (plan.tasks || []).find((task) => task.id === taskId) || null;
}

function getPlanName(planId) {
  const plan = findPlan(planId);
  if (plan) {
    return plan.name;
  }
  return `已删除类别(${planId.slice(-4)})`;
}

function getSessionTaskLabel(session) {
  const planName = getPlanName(session.planId);
  if (!session.taskId) {
    return planName;
  }
  const task = findTask(session.planId, session.taskId);
  if (!task) {
    return `${planName} / 已删除计划`;
  }
  return `${task.title}（${planName}）`;
}

function createTask(title, startDate, days) {
  return {
    id: createId('task'),
    title,
    startDate,
    days,
    dates: buildDateSeries(startDate, days),
    completedDates: {},
  };
}

function buildDateSeries(startDate, days) {
  const arr = [];
  const start = new Date(`${startDate}T00:00:00`);
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    arr.push(formatDate(d));
  }
  return arr;
}

function isValidDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;
}

function prettyDate(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${dateText} (${weekNames[date.getDay()]})`;
}

function formatDuration(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (!h) {
    return `${m} 分钟`;
  }
  if (!m) {
    return `${h} 小时`;
  }
  return `${h} 小时 ${m} 分钟`;
}

function formatHms(totalSec) {
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatMmSs(totalSec) {
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formatClock(timestampMs) {
  const stamp = Number(timestampMs);
  if (!Number.isFinite(stamp)) {
    return '--:--:--';
  }
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) {
    return '--:--:--';
  }
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function resolveSessionFirstStart(session) {
  if (!session || typeof session !== 'object') {
    return Date.now();
  }
  const first = Number(session.firstStartedAtMs);
  if (Number.isFinite(first) && first > 0) {
    return first;
  }
  const started = Number(session.startedAtMs);
  if (Number.isFinite(started) && started > 0) {
    return started;
  }
  const pausedAt = Number(session.pausedAtMs);
  const elapsed = Number(session.elapsedSec);
  if (Number.isFinite(pausedAt) && pausedAt > 0 && Number.isFinite(elapsed) && elapsed >= 0) {
    return pausedAt - (elapsed * 1000);
  }
  return Date.now();
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(input) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getCurrentPageName() {
  const path = window.location.pathname;
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  return fileName || 'index.html';
}

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function setAuthSession(authPayload) {
  if (!authPayload || !authPayload.token) {
    return;
  }
  localStorage.setItem(AUTH_TOKEN_KEY, authPayload.token);
  localStorage.setItem(AUTH_USER_KEY, authPayload.username || '');
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(LOCAL_BACKUP_KEY);
  localStorage.removeItem(LEGACY_LOCAL_KEY);
}

function getAuthHeaders(extraHeaders = {}) {
  const token = getAuthToken();
  if (!token) {
    return { ...extraHeaders };
  }
  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  };
}

function redirectToLogin() {
  const next = encodeURIComponent(getCurrentPageName());
  redirectingForAuth = true;
  window.location.replace(`login.html?next=${next}`);
}

function handleUnauthorized() {
  clearAuthSession();
  redirectToLogin();
}

async function ensureAuthenticated() {
  const token = getAuthToken();
  if (!token) {
    redirectToLogin();
    return false;
  }

  try {
    const response = await fetch(API_AUTH_ME_ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
      headers: getAuthHeaders(),
    });
    if (response.status === 401) {
      handleUnauthorized();
      return false;
    }
    if (!response.ok) {
      throw new Error(`登录态校验失败: ${response.status}`);
    }
    const me = await response.json();
    if (currentUserEl) {
      currentUserEl.textContent = me.username || '未知用户';
    }
    return true;
  } catch (error) {
    console.error('校验登录状态失败:', error);
    alert('无法连接后端服务，请确认服务已启动后重试。');
    return false;
  }
}

async function logout() {
  try {
    const token = getAuthToken();
    if (token) {
      await fetch(API_AUTH_LOGOUT_ENDPOINT, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    }
  } catch (error) {
    console.warn('登出请求失败，按本地退出处理:', error);
  } finally {
    clearAuthSession();
    redirectToLogin();
  }
}

async function loadInitialState() {
  try {
    const response = await fetch(API_STATE_ENDPOINT, {
      cache: 'no-store',
      headers: getAuthHeaders(),
    });
    if (response.status === 401) {
      handleUnauthorized();
      return defaultState();
    }
    if (!response.ok) {
      throw new Error(`状态读取失败: ${response.status}`);
    }
    const remoteData = normalizeState(await response.json());
    serverReachable = true;

    const migrated = tryMigrateLegacy(remoteData);
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(migrated));
    return migrated;
  } catch (error) {
    console.warn('后端不可用，回退本地备份:', error);
    serverReachable = false;
    return loadFromLocalBackup();
  }
}

function tryMigrateLegacy(remoteData) {
  if (!isStateEmpty(remoteData)) {
    return remoteData;
  }
  const legacy = loadLegacyLocalState();
  if (!legacy || isStateEmpty(legacy)) {
    return remoteData;
  }
  if (serverReachable) {
    persistStateToServer(legacy).catch((error) => {
      console.warn('迁移旧数据到后端失败:', error);
    });
  }
  return legacy;
}

function loadFromLocalBackup() {
  try {
    const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
    if (!raw) {
      return defaultState();
    }
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn('读取本地备份失败:', error);
    return defaultState();
  }
}

function loadLegacyLocalState() {
  try {
    const raw = localStorage.getItem(LEGACY_LOCAL_KEY);
    if (!raw) {
      return null;
    }
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    return null;
  }
}

function saveState() {
  const normalized = normalizeState(state);
  state = normalized;
  localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(normalized));
  saveQueue = saveQueue
    .then(() => persistStateToServer(normalized))
    .catch((error) => {
      console.warn('写入后端失败，已保留本地备份:', error);
    });
}

async function persistStateToServer(payload) {
  if (!serverReachable) {
    return;
  }
  const response = await fetch(API_STATE_ENDPOINT, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (response.status === 401) {
    handleUnauthorized();
    return;
  }
  if (!response.ok) {
    throw new Error(`状态保存失败: ${response.status}`);
  }
}

function normalizeState(value) {
  const base = value && typeof value === 'object' ? value : {};
  const rawPlans = Array.isArray(base.plans) ? base.plans : [];
  const plans = rawPlans.map((plan) => {
    const tasks = Array.isArray(plan.tasks)
      ? plan.tasks.map((task) => {
        const startDate = isValidDateKey(task.startDate) ? task.startDate : formatDate(new Date());
        const days = Number(task.days) >= 1 ? Math.min(60, Number(task.days)) : 1;
        const dates = Array.isArray(task.dates) && task.dates.length
          ? task.dates.filter(isValidDateKey)
          : buildDateSeries(startDate, days);
        const completedDates = {};
        if (task.completedDates && typeof task.completedDates === 'object') {
          Object.entries(task.completedDates).forEach(([dateKey, done]) => {
            if (done && isValidDateKey(dateKey)) {
              completedDates[dateKey] = true;
            }
          });
        }
        return {
          id: task.id || createId('task'),
          title: typeof task.title === 'string' && task.title.trim() ? task.title.trim() : '未命名计划',
          startDate,
          days,
          dates,
          completedDates,
        };
      })
      : [];
    return {
      id: plan.id || createId('plan'),
      name: typeof plan.name === 'string' && plan.name.trim() ? plan.name.trim() : '未命名类别',
      tasks,
    };
  });

  const sessionLogs = normalizeSessionLogs(base.sessionLogs);
  const session = normalizeSession(base.session);

  return {
    plans,
    records: base.records && typeof base.records === 'object' ? base.records : {},
    sessionLogs,
    session,
    theme: base.theme === 'dark' ? 'dark' : 'light',
  };
}

function isStateEmpty(candidate) {
  return (!candidate.plans || candidate.plans.length === 0)
    && (!candidate.records || Object.keys(candidate.records).length === 0)
    && (!candidate.sessionLogs || Object.keys(candidate.sessionLogs).length === 0)
    && !candidate.session;
}

function defaultState() {
  return {
    plans: [],
    records: {},
    sessionLogs: {},
    session: null,
    theme: 'light',
  };
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }
  if (typeof session.planId !== 'string' || !session.planId) {
    return null;
  }
  const paused = Boolean(session.paused);
  let startedAtMs = Number.isFinite(Number(session.startedAtMs)) ? Number(session.startedAtMs) : null;
  let pausedAtMs = Number.isFinite(Number(session.pausedAtMs)) ? Number(session.pausedAtMs) : null;
  if (paused && !pausedAtMs) {
    pausedAtMs = Date.now();
  }
  if (!paused && !startedAtMs) {
    startedAtMs = Date.now();
  }
  return {
    planId: session.planId,
    taskId: typeof session.taskId === 'string' ? session.taskId : null,
    elapsedSec: Number.isFinite(Number(session.elapsedSec)) ? Math.max(0, Math.floor(Number(session.elapsedSec))) : 0,
    startedAtMs,
    firstStartedAtMs: resolveSessionFirstStart(session),
    paused,
    pausedAtMs,
  };
}

function normalizeSessionLogs(rawLogs) {
  if (!rawLogs || typeof rawLogs !== 'object') {
    return {};
  }
  const normalized = {};
  Object.entries(rawLogs).forEach(([dateKey, records]) => {
    if (!isValidDateKey(dateKey) || !Array.isArray(records)) {
      return;
    }
    const items = records
      .map(normalizeSessionLog)
      .filter(Boolean)
      .sort((a, b) => (a.startAtMs || 0) - (b.startAtMs || 0));
    if (items.length) {
      normalized[dateKey] = items;
    }
  });
  return normalized;
}

function normalizeSessionLog(log) {
  if (!log || typeof log !== 'object' || typeof log.planId !== 'string' || !log.planId) {
    return null;
  }
  const seconds = Number.isFinite(Number(log.seconds)) ? Math.max(0, Math.round(Number(log.seconds))) : 0;
  let startAtMs = Number.isFinite(Number(log.startAtMs)) ? Number(log.startAtMs) : null;
  let endAtMs = Number.isFinite(Number(log.endAtMs)) ? Number(log.endAtMs) : null;
  if (!startAtMs && endAtMs && seconds > 0) {
    startAtMs = endAtMs - (seconds * 1000);
  }
  if (!endAtMs && startAtMs) {
    endAtMs = startAtMs + (seconds * 1000);
  }
  if (!startAtMs && !endAtMs) {
    return null;
  }
  if (!startAtMs) {
    startAtMs = endAtMs;
  }
  if (!endAtMs) {
    endAtMs = startAtMs;
  }
  if (endAtMs < startAtMs) {
    const temp = startAtMs;
    startAtMs = endAtMs;
    endAtMs = temp;
  }
  return {
    id: typeof log.id === 'string' && log.id ? log.id : createId('log'),
    planId: log.planId,
    taskId: typeof log.taskId === 'string' ? log.taskId : null,
    startAtMs,
    endAtMs,
    seconds,
  };
}
