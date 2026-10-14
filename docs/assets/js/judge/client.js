/**
 * DeruckOJ judge transport and failover client.
 *
 * Responsibilities:
 * - discover Local Judge capabilities through `/health`;
 * - execute C++/Python on Local Judge, Judge0 or Wandbox;
 * - keep fixed `local` mode strict while allowing `auto` mode to fail over;
 * - reject infrastructure responses (`SE`, queued or malformed) instead of
 *   turning them into accepted execution results.
 *
 * UI rendering and submission persistence belong to `../app.js`.
 * Maintenance notes: `documentation/judge-maintenance-2026-10-14.md`.
 */

    // Multi-judge pool configuration (Load balancing & automatic failover)
    let judgeMode = 'auto'; // 'auto' | 'judge0' | 'wandbox' | 'local'
    let judgeRoundRobinCounter = 0;

    const JUDGE_SERVERS = {
      judge0: {
        id: 'judge0',
        name: '26TinyLove',
        fullName: '26TinyLove Judge0 (Cloud C++20 / Py3)',
        url: 'https://judge.26tinylove.com',
        available: true,
        failCount: 0,
        cooldownUntil: 0
      },
      judge0_ce: {
        id: 'judge0_ce',
        name: 'Judge0 Official',
        fullName: 'Judge0 CE Cloud (Cloud C++20 / Py3)',
        url: 'https://ce.judge0.com',
        available: true,
        failCount: 0,
        cooldownUntil: 0
      },
      wandbox: {
        id: 'wandbox',
        name: 'Wandbox',
        fullName: 'Wandbox Cloud (GCC 13 / Py 3.12)',
        url: 'https://wandbox.org',
        available: true,
        failCount: 0,
        cooldownUntil: 0
      },
      local: {
        id: 'local',
        name: 'Local Judge',
        fullName: 'Local Judge Siêu Tốc (MinGW & Python)',
        url: 'http://127.0.0.1:8080',
        available: false,
        failCount: 0,
        cooldownUntil: 0
      }
    };

    function updateJudgeEngineUI() {
      const text = document.getElementById('judge-engine-text');
      if (text) text.textContent = judgeMode === 'auto'
        ? (JUDGE_SERVERS.local.available ? 'Sẵn sàng · Máy cục bộ' : 'Tự động · Cloud dự phòng')
        : judgeMode === 'local' && !JUDGE_SERVERS.local.available ? 'Chưa kết nối máy cục bộ' : JUDGE_SERVERS[judgeMode]?.name || 'Máy chấm';
      document.getElementById('opt-local-judge')?.classList.remove('hidden');
      const selector = document.getElementById('judge-server-select');
      if (selector) selector.value = judgeMode;
      const status = document.getElementById('judge-connection-status');
      if (status) status.textContent = JUDGE_SERVERS.local.available
        ? 'Đã kết nối máy chấm cục bộ. Có thể chạy thử hoặc nộp bài.'
        : 'Máy cục bộ chưa kết nối. Mở file chay_he_thong_cham.bat trong scripts/windows rồi bấm Kiểm tra kết nối; hoặc chọn máy chấm cloud.';
    }

    function handleJudgeServerChange(val) {
      if (typeof isJudging !== 'undefined' && isJudging) { updateJudgeEngineUI(); return; }
      if (val !== 'auto' && !JUDGE_SERVERS[val]) return;
      judgeMode = val;
      updateJudgeEngineUI();
      if (val === 'auto') {
        showLiveToast("Đã chọn tự động: ưu tiên máy cục bộ, dùng cloud khi không kết nối được.");
      } else {
        const srv = JUDGE_SERVERS[val];
        showLiveToast(`Đã cố định máy chấm: ${srv ? srv.name : val}`);
      }
    }

    async function checkJudgeServersHealth() {
      try {
        const resp = await fetch('http://127.0.0.1:8080/health', {
          signal: safeTimeoutSignal(1500)
        });
        if (resp.ok) {
          const data = await resp.json();
          JUDGE_SERVERS.local.available = (data && data.status === 'ok');
          localJudgeAvailable = JUDGE_SERVERS.local.available;
          JUDGE_SERVERS.local.batch = Boolean(data.batch);
          JUDGE_SERVERS.local.cpp = Boolean(data.gpp);
        } else {
          JUDGE_SERVERS.local.available = false;
          localJudgeAvailable = false;
        }
      } catch (e) {
        JUDGE_SERVERS.local.available = false;
        localJudgeAvailable = false;
      }

      // Cloud judges are available by default unless consecutive execution errors occur
      if (JUDGE_SERVERS.judge0.failCount < 3) {
        JUDGE_SERVERS.judge0.available = true;
      }
      if (JUDGE_SERVERS.judge0_ce.failCount < 3) {
        JUDGE_SERVERS.judge0_ce.available = true;
      }
      if (JUDGE_SERVERS.wandbox.failCount < 3) {
        JUDGE_SERVERS.wandbox.available = true;
      }

      updateJudgeEngineUI();
      return true;
    }
    const checkLocalJudgeHealth = checkJudgeServersHealth;

function safeStringToBase64(value) {
  return btoa(Array.from(new TextEncoder().encode(String(value ?? '')), byte => String.fromCharCode(byte)).join(''));
}

function safeBase64ToString(value) {
  if (!value) return '';
  return new TextDecoder().decode(Uint8Array.from(atob(value), char => char.charCodeAt(0)));
}

function safeTimeoutSignal(ms) {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(Math.ceil(ms));
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function judgeTimeLimit(value) {
  const seconds = Number(String(value ?? 1).trim().replace(/s$/i, '').trim());
  if (!Number.isFinite(seconds) || seconds < 0.05 || seconds > 10) throw new Error('Thời gian của bài phải từ 0.05 đến 10 giây.');
  return seconds;
}

function effectiveJudgeTime(lang, seconds) {
  return lang === 'python' ? Math.max(seconds * 2, 2.5) : seconds;
}

function validateJudgeResult(data, server) {
  if (data?.status === 'SE') {
    throw new Error(data.stderr || data.error || 'Máy chấm gặp lỗi hệ thống.');
  }
  if (!data || !['OK', 'CE', 'RTE', 'TLE', 'OLE'].includes(data.status)) {
    throw new Error(data?.stderr || data?.error || 'Máy chấm chưa trả về kết quả hợp lệ.');
  }
  return { ...data, stdout: data.stdout ?? data.output ?? '',
    stderr: data.stderr || data.error || '', compile_error: data.compile_error || '', server };
}

/** Return whether a server can execute the requested language right now. */
function judgeServerSupportsLanguage(serverId, lang) {
  if (serverId !== 'local') return true;
  return lang !== 'cpp' || JUDGE_SERVERS.local.cpp !== false;
}

async function judgeRequest(url, options = {}, timeout = 15000) {
  let response;
  try { response = await fetch(url, { ...options, signal: safeTimeoutSignal(timeout) }); }
  catch (error) { throw new Error(error.name === 'TimeoutError' || error.name === 'AbortError'
    ? 'Máy chấm chưa phản hồi trong thời gian chờ. Kết quả chưa được ghi nhận.'
    : 'Không kết nối được máy chấm. Kiểm tra máy chủ hoặc chọn máy chấm khác.'); }
  let data;
  try { data = await response.json(); } catch { throw new Error('Máy chấm trả về dữ liệu không hợp lệ.'); }
  if (!response.ok) throw new Error(data?.stderr || data?.error || `Máy chấm trả về HTTP ${response.status}.`);
  return data;
}

async function executeLocalJudge(lang, code, stdin, timeLimit) {
  const seconds = judgeTimeLimit(timeLimit);
  const data = await judgeRequest(`${JUDGE_SERVERS.local.url}/judge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lang, code, stdin: String(stdin ?? ''), time_limit: seconds })
  }, (45 + effectiveJudgeTime(lang, seconds)) * 1000);
  return validateJudgeResult(data, 'Local');
}

async function executeJudge0(serverKey, lang, code, stdin, timeLimit) {
  const server = JUDGE_SERVERS[serverKey];
  const seconds = effectiveJudgeTime(lang, judgeTimeLimit(timeLimit));
  const payload = { language_id: lang === 'cpp' ? 54 : 71, source_code: safeStringToBase64(code), stdin: safeStringToBase64(stdin), cpu_time_limit: seconds };
  if (lang === 'cpp') payload.compiler_options = '-O2 -std=c++17';
  let data = await judgeRequest(`${server.url}/submissions?base64_encoded=true&wait=false`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const token = data.token;
  const deadline = Date.now() + (45 + seconds) * 1000;
  while ((!data.status || [1, 2].includes(data.status.id)) && token && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 500));
    data = await judgeRequest(`${server.url}/submissions/${encodeURIComponent(token)}?base64_encoded=true`);
  }
  const id = data.status?.id;
  if (![3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(id)) {
    throw new Error([1, 2].includes(id) ? 'Bài vẫn đang chờ máy chấm. Chưa có kết quả; hãy thử lại sau.' : 'Máy chấm cloud gặp lỗi hoặc chưa trả kết quả.');
  }
  return validateJudgeResult({
    status: id === 6 ? 'CE' : id === 5 ? 'TLE' : id >= 7 ? 'RTE' : 'OK',
    stdout: safeBase64ToString(data.stdout), stderr: safeBase64ToString(data.stderr) || (id === 5 ? `Quá thời gian (${seconds}s).` : id >= 7 ? data.status.description : ''),
    compile_error: safeBase64ToString(data.compile_output), execution_time: Number(data.time) || 0
  }, server.name);
}

async function executeWandbox(lang, code, stdin, timeLimit) {
  const seconds = effectiveJudgeTime(lang, judgeTimeLimit(timeLimit));
  const data = await judgeRequest('https://wandbox.org/api/compile.json', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ compiler: lang === 'cpp' ? 'gcc-13.2.0' : 'cpython-3.12.7', code, stdin, options: lang === 'cpp' ? 'optimize' : '' })
  }, (45 + seconds) * 1000);
  if (data.status === undefined && !data.signal) throw new Error('Wandbox chưa trả về trạng thái chạy.');
  const timeout = ['SIGXCPU', 'SIGKILL'].includes(data.signal);
  const failed = String(data.status) !== '0' || Boolean(data.signal);
  return validateJudgeResult({
    status: timeout ? 'TLE' : failed && data.compiler_error ? 'CE' : failed ? 'RTE' : 'OK',
    stdout: data.program_output || '', stderr: data.program_error || (timeout ? 'Quá thời gian cho phép.' : failed ? `Lỗi tiến trình ${data.status ?? data.signal}` : ''),
    compile_error: data.compiler_error || '', execution_time: null
  }, 'Wandbox');
}

/** Execute one input using the selected mode and automatic failover policy. */
async function executeCode(lang, code, stdin, timeLimit = 1) {
  if (judgeMode === 'local') {
    if (!JUDGE_SERVERS.local.available) await checkJudgeServersHealth();
    if (!judgeServerSupportsLanguage('local', lang)) {
      throw new Error('Máy chấm cục bộ chưa có g++. Hãy cài trình biên dịch C++ hoặc chọn chế độ Tự động/Cloud.');
    }
    return executeLocalJudge(lang, code, stdin, timeLimit);
  }
  if (judgeMode === 'wandbox') return executeWandbox(lang, code, stdin, timeLimit);
  if (judgeMode === 'judge0' || judgeMode === 'judge0_ce') return executeJudge0(judgeMode, lang, code, stdin, timeLimit);
  if (!JUDGE_SERVERS.local.available) await checkJudgeServersHealth();
  const canUseLocal = JUDGE_SERVERS.local.available && judgeServerSupportsLanguage('local', lang);
  const order = [...(canUseLocal ? ['local'] : []), 'judge0', 'judge0_ce', 'wandbox'];
  let lastError;
  for (const id of order) {
    if (Date.now() < JUDGE_SERVERS[id].cooldownUntil) continue;
    try {
      const data = id === 'local' ? await executeLocalJudge(lang, code, stdin, timeLimit)
        : id === 'wandbox' ? await executeWandbox(lang, code, stdin, timeLimit)
        : await executeJudge0(id, lang, code, stdin, timeLimit);
      return data;
    } catch (error) { lastError = error; JUDGE_SERVERS[id].cooldownUntil = Date.now() + 15000; }
  }
  throw lastError || new Error('Các máy chấm đang bận. Hãy thử lại sau.');
}

/**
 * Execute a complete testcase set.
 * Local batch is preferred because it compiles C++ once; auto mode falls back
 * to cloud execution when the local service is unavailable or returns `SE`.
 */
async function executeJudgeBatch(lang, code, tests, timeLimit) {
  if (!Array.isArray(tests) || !tests.length || tests.length > 100 || tests.some(t => !t || t.output === undefined || t.input === undefined)) {
    throw new Error('Bộ test cần có 1–100 test và đầy đủ dữ liệu vào/đáp án.');
  }
  const seconds = judgeTimeLimit(timeLimit);
  if (judgeMode === 'auto' || judgeMode === 'local') await checkJudgeServersHealth();
  const localSelected = judgeMode === 'local';
  const localEligible = JUDGE_SERVERS.local.available
    && JUDGE_SERVERS.local.batch
    && judgeServerSupportsLanguage('local', lang);
  if (localSelected && !localEligible) {
    throw new Error(lang === 'cpp' && JUDGE_SERVERS.local.cpp === false
      ? 'Máy chấm cục bộ chưa có g++. Hãy cài trình biên dịch C++ hoặc chọn chế độ Tự động/Cloud.'
      : 'Máy chấm cục bộ chưa sẵn sàng cho chế độ chấm theo bộ test.');
  }
  if ((localSelected || judgeMode === 'auto') && localEligible) {
    try {
      const data = await judgeRequest(`${JUDGE_SERVERS.local.url}/judge-batch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, code, inputs: tests.map(t => String(t.input)), time_limit: seconds })
      }, (50 + tests.length * (effectiveJudgeTime(lang, seconds) + 0.25)) * 1000);
      if (!Array.isArray(data.results) || !data.results.length) throw new Error('Máy chấm không trả về kết quả test.');
      const results = data.results.map(item => validateJudgeResult(item, 'Local'));
      if (results[0].status !== 'CE' && results.length !== tests.length) throw new Error('Máy chấm chưa hoàn thành đủ bộ test.');
      return results;
    } catch (error) {
      if (localSelected) throw error;
      JUDGE_SERVERS.local.cooldownUntil = Date.now() + 15000;
    }
  }
  const results = [];
  for (const test of tests) {
    const data = await executeCode(lang, code, String(test.input), seconds);
    results.push(data);
    if (data.status === 'CE') break;
  }
  return results;
}


