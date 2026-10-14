// One place for daily administration; existing editors remain available from each list.
function canManageWebsite() {
  return Boolean(currentAuth && ['admin', 'teacher'].includes(currentAuth.role));
}

function syncManagementAccess() {
  const allowed = canManageWebsite();
  for (const id of ['tab-btn-admin', 'tab-btn-admin-mobile']) {
    document.getElementById(id)?.classList.toggle('hidden', !allowed);
  }
  document.querySelectorAll('[data-admin-exclusive]').forEach(el => el.classList.toggle('hidden', currentAuth?.role !== 'admin'));
  if (!allowed) document.getElementById('section-admin')?.classList.add('hidden');
}

function openManagement(tab = 'overview') {
  if (!canManageWebsite()) { showAuthModal(); return; }
  switchTab('admin');
  switchAdminSubTab(tab);
}

function renderManagementPanel(tab) {
  if (!canManageWebsite()) return;
  const tabs = ['overview', 'students', 'problems', 'curriculum', 'grading', 'export'];
  if (!tabs.includes(tab)) tab = 'overview';
  currentAdminSubTab = tab;
  document.querySelectorAll('[data-management-tab]').forEach(button => {
    const active = button.dataset.managementTab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  tabs.forEach(name => document.getElementById(`admin-panel-${name}`)?.classList.toggle('hidden', name !== tab));
  syncManagementAccess();
  const stats = {
    students: appData?.students?.length || 0,
    problems: appData?.problems?.length || 0,
    pending: (appData?.submissions || []).filter(s => !s.verdict && (s.status === 'Đã nộp' || s.status === 'Chưa chấm')).length,
    tests: (appData?.problems || []).filter(p => p.testcases?.length || p.grading_method === 'code').length,
  };
  for (const [key, value] of Object.entries(stats)) {
    const element = document.getElementById(`management-count-${key}`);
    if (element) element.textContent = value;
  }
  if (tab === 'students') {
    document.getElementById('leaderboard-admin-tuition-container')?.classList.remove('hidden');
    renderAdminStudents();
  } else if (tab === 'problems') renderAdminProblems();
  else if (tab === 'curriculum') renderAdminCurriculum();
  else if (tab === 'grading') renderManagementGrading();
}

function renderManagementGrading() {
  const body = document.getElementById('management-grading-body');
  if (!body) return;
  body.replaceChildren();
  for (const problem of appData?.problems || []) {
    const row = document.createElement('tr');
    const count = problem.testcases?.length || 0;
    const labels = [problem.id, problem.name, problem.grading_method === 'code' ? 'Sinh test bằng code' : count ? `${count} test` : 'Chưa có bộ test'];
    for (const value of labels) {
      const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
    }
    const actions = document.createElement('td');
    const edit = document.createElement('button'); edit.className = 'management-button'; edit.textContent = 'Sửa bộ test';
    edit.onclick = () => { openTestcaseManagerModal(); loadProblemIntoTestcaseManager(problem.id); };
    const run = document.createElement('button'); run.className = 'management-button'; run.textContent = 'Mở máy chấm';
    run.onclick = () => openJudgeWithProblem(problem.id);
    actions.append(edit, run); row.appendChild(actions); body.appendChild(row);
  }
}

function showJudgeServiceError(error) {
  const message = `${error.message || error} Kết quả chưa được ghi nhận. Bạn có thể thử lại.`;
  const banner = document.getElementById('judge-verdict-banner');
  if (banner) {
    banner.className = 'rounded-xl p-4 text-sm bg-amber-950 border border-amber-500/40 text-amber-200';
    banner.textContent = message;
  }
  const tag = document.getElementById('judge-verdict-tag');
  if (tag) tag.textContent = 'CHƯA CHẤM XONG';
}
