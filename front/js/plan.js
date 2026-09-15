/**
 * 플래너 임웹 전용 — 전화 확인 후 공통·개인 일정 표시 (드라이브 링크 없음).
 * GAS: 조회(match/bootstrap/curriculum)는 관리자와 동일 **GET JSONP**.
 * todo 저장(apply)만 `doPost` JSON — URL 길이 한도 때문에 JSONP 불가.
 * 스니펫에서 먼저 `window.__SOLPATH__ = { gasBaseUrl: "…/exec", … }` 를 둔다.
 */
function spReadPlanInjected_() {
  if (typeof globalThis === 'undefined') {
    return { url: '', planDemo: { active: false, yearMonth: '', fixtureUrl: '', fixture: null } };
  }
  const o = globalThis.__SOLPATH__;
  if (!o || typeof o !== 'object') {
    return { url: '', planDemo: { active: false, yearMonth: '', fixtureUrl: '', fixture: null } };
  }
  const demoRaw = o.planDemo && typeof o.planDemo === 'object' ? o.planDemo : null;
  /** @type {{ mun?: { fixtureUrl: string, fixture: object|null }, sci?: { fixtureUrl: string, fixture: object|null } }} */
  const fixtures = {};
  const fixturesRaw = demoRaw && demoRaw.fixtures && typeof demoRaw.fixtures === 'object' ? demoRaw.fixtures : null;
  if (fixturesRaw) {
    ['mun', 'sci'].forEach(function (key) {
      const row = fixturesRaw[key];
      if (!row || typeof row !== 'object') return;
      fixtures[key] = {
        fixtureUrl: String(row.fixtureUrl != null ? row.fixtureUrl : '').trim(),
        fixture: row.fixture != null && typeof row.fixture === 'object' ? row.fixture : null
      };
    });
  }
  const planDemo = {
    active: Boolean(demoRaw && demoRaw.active === true),
    yearMonth: String(demoRaw && demoRaw.yearMonth != null ? demoRaw.yearMonth : '').trim(),
    startTab: String(demoRaw && demoRaw.startTab != null ? demoRaw.startTab : 'student').trim(),
    defaultTrack: String(demoRaw && demoRaw.defaultTrack != null ? demoRaw.defaultTrack : 'mun').trim(),
    fixtureUrl: String(demoRaw && demoRaw.fixtureUrl != null ? demoRaw.fixtureUrl : '').trim(),
    fixture: demoRaw && demoRaw.fixture != null && typeof demoRaw.fixture === 'object' ? demoRaw.fixture : null,
    fixtures: fixtures
  };
  return {
    url: String(
      o.gasBaseUrl != null
        ? o.gasBaseUrl
        : o.GAS_BASE_URL != null
          ? o.GAS_BASE_URL
          : o.execUrl != null
            ? o.execUrl
            : ''
    ).trim(),
    planDemo: planDemo
  };
}

const _planInj = spReadPlanInjected_();
const GAS_BASE_URL = _planInj.url || '';
/** @type {{ active: boolean, yearMonth: string, startTab: string, defaultTrack: string, fixtureUrl: string, fixture: object|null, fixtures: object }} */
const PLAN_DEMO = _planInj.planDemo || {
  active: false,
  yearMonth: '',
  startTab: 'student',
  defaultTrack: 'mun',
  fixtureUrl: '',
  fixture: null,
  fixtures: {}
};
const GAS_MODE = {
  get useMock() {
    if (PLAN_DEMO.active) {
      return false;
    }
    return !String(GAS_BASE_URL).trim();
  },
  get canSync() {
    return Boolean(String(GAS_BASE_URL).trim());
  }
};

const MOUNT_ID = 'solpath-plan-root';

/**
 * @param {HTMLElement} root
 * @returns {boolean}
 */
function plannerIsPlanDemoRoot_(root) {
  return Boolean(root && root.classList && root.classList.contains('is-plan-demo'));
}

/**
 * @param {{ yearMonth?: string }} cfg
 * @returns {Date}
 */
function plannerPlanDemoViewMonthDate_(cfg) {
  const ym = String(cfg && cfg.yearMonth != null ? cfg.yearMonth : '').trim();
  const m = ym.match(/^(\d{4})-(\d{1,2})$/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, 1);
  }
  return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
}

/**
 * @param {unknown} raw
 * @returns {{ role: string, common: object[], personal: object[] | null, student_profile: Record<string, unknown> | null, curriculum: unknown }}
 */
function plannerNormalizePlanDemoFixture_(raw) {
  const o = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const prof =
    o.student_profile != null && typeof o.student_profile === 'object'
      ? /** @type {Record<string, unknown>} */ (o.student_profile)
      : null;
  return {
    role: o.role === 'member' ? 'member' : 'guest',
    common: Array.isArray(o.common) ? o.common : [],
    personal: Array.isArray(o.personal) ? o.personal : [],
    student_profile: prof,
    curriculum: o.curriculum
  };
}

/**
 * @param {{ fixtureUrl?: string, fixture?: object|null }} cfg
 * @returns {Promise<Record<string, unknown>>}
 */
async function plannerLoadPlanDemoFixture_(cfg) {
  if (cfg.fixture && typeof cfg.fixture === 'object') {
    return /** @type {Record<string, unknown>} */ (cfg.fixture);
  }
  const url = String(cfg.fixtureUrl != null ? cfg.fixtureUrl : '').trim();
  if (!url.length) {
    throw new Error('planDemo.fixtureUrl 또는 planDemo.fixture 가 필요합니다.');
  }
  const res = await fetch(url, { method: 'GET', credentials: 'omit', cache: 'default' });
  if (!res.ok) {
    throw new Error('데모 데이터를 불러오지 못했습니다 (HTTP ' + String(res.status) + ').');
  }
  const data = await res.json();
  if (!data || typeof data !== 'object') {
    throw new Error('데모 데이터 JSON 형식이 올바르지 않습니다.');
  }
  return /** @type {Record<string, unknown>} */ (data);
}

/** @returns {boolean} */
function plannerPlanDemoHasMultiTrack_() {
  const fx = PLAN_DEMO.fixtures;
  return Boolean(fx && fx.mun && fx.sci);
}

/**
 * @param {unknown} raw
 * @returns {''|'mun'|'sci'}
 */
function plannerPlanDemoNormalizeTrack_(raw) {
  const s = String(raw != null ? raw : '')
    .trim()
    .toLowerCase();
  if (!s.length) return '';
  if (s === 'sci' || s === 'science' || s === '이과' || s === 'nat' || s === 'natural') return 'sci';
  if (s === 'mun' || s === 'liberal' || s === '문과' || s === 'humanities') return 'mun';
  return '';
}

/**
 * URL `?spPlanTrack=mun|sci` · `#spPlanTrack=…` · 스니펫 `defaultTrack`.
 * @returns {'mun'|'sci'}
 */
function plannerPlanDemoInitialTrack_() {
  const fromUrl = plannerPlanDemoTrackFromUrl_();
  if (fromUrl) return fromUrl;
  const def = plannerPlanDemoNormalizeTrack_(PLAN_DEMO.defaultTrack);
  return def === 'sci' ? 'sci' : 'mun';
}

/**
 * @returns {''|'mun'|'sci'}
 */
function plannerPlanDemoTrackFromUrl_() {
  if (typeof window === 'undefined') return '';
  try {
    const q = new URLSearchParams(window.location.search);
    const keys = ['spPlanTrack', 'planTrack', 'track'];
    let i;
    for (i = 0; i < keys.length; i++) {
      const t = plannerPlanDemoNormalizeTrack_(q.get(keys[i]));
      if (t) return t;
    }
    const hash = String(window.location.hash || '').replace(/^#/, '');
    const hm = hash.match(/(?:^|[?&])spPlanTrack=(mun|sci)/i);
    if (hm) return hm[1].toLowerCase() === 'sci' ? 'sci' : 'mun';
  } catch (_e) {
    /* ignore */
  }
  return '';
}

/**
 * @param {'mun'|'sci'} track
 */
function plannerPlanDemoSyncTrackInUrl_(track) {
  if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('spPlanTrack', track === 'sci' ? 'sci' : 'mun');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch (_e) {
    /* ignore */
  }
}

/**
 * @param {'mun'|'sci'} track
 * @returns {{ fixtureUrl: string, fixture: object|null }}
 */
function plannerPlanDemoFixtureCfgForTrack_(track) {
  const t = track === 'sci' ? 'sci' : 'mun';
  const fx = PLAN_DEMO.fixtures;
  if (fx && fx[t]) {
    return {
      fixtureUrl: String(fx[t].fixtureUrl || ''),
      fixture: fx[t].fixture || null
    };
  }
  return {
    fixtureUrl: PLAN_DEMO.fixtureUrl,
    fixture: PLAN_DEMO.fixture
  };
}

/**
 * @param {HTMLElement} root
 */
function plannerMountDemoTrackBar_(root) {
  if (!plannerPlanDemoHasMultiTrack_()) return;
  if (root.querySelector('#sp-plan-demo-track-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'sp-plan-demo-track-bar';
  bar.className = 'sp-plan-demoTrackBar';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', '수강생 계열 선택');
  bar.innerHTML =
    '<button type="button" class="sp-plan-demoTrackBar__btn" data-sp-demo-track="mun" role="tab" aria-selected="false">' +
    '<span class="sp-plan-demoTrackBar__btnMain">문과 수강생</span>' +
    '<span class="sp-plan-demoTrackBar__btnSub">솔루션(문과)</span>' +
    '</button>' +
    '<button type="button" class="sp-plan-demoTrackBar__btn" data-sp-demo-track="sci" role="tab" aria-selected="false">' +
    '<span class="sp-plan-demoTrackBar__btnMain">이과 수강생</span>' +
    '<span class="sp-plan-demoTrackBar__btnSub">솔루션(이과)</span>' +
    '</button>';
  const shell = root.querySelector('.sp-plan-rootinner');
  if (shell) {
    shell.insertBefore(bar, shell.firstChild);
  } else {
    root.prepend(bar);
  }
}

/**
 * @param {HTMLElement} root
 * @param {'mun'|'sci'} track
 */
function plannerUpdateDemoTrackBar_(root, track) {
  const bar = root.querySelector('#sp-plan-demo-track-bar');
  if (!bar) return;
  bar.querySelectorAll('[data-sp-demo-track]').forEach(function (btn) {
    if (!(btn instanceof HTMLElement)) return;
    const on = btn.getAttribute('data-sp-demo-track') === track;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

/**
 * @param {HTMLElement} root
 * @param {'mun'|'sci'} track
 * @returns {Promise<void>}
 */
async function plannerSwitchPlanDemoTrack_(root, track) {
  root.__spPlanDemoTrack = track;
  plannerPlanDemoSyncTrackInUrl_(track);
  plannerUpdateDemoTrackBar_(root, track);
  const ban = root.querySelector('#sp-plan-banner');
  if (ban) ban.setAttribute('hidden', 'hidden');
  const cfg = plannerPlanDemoFixtureCfgForTrack_(track);
  const raw = await plannerLoadPlanDemoFixture_(cfg);
  const pack = plannerNormalizePlanDemoFixture_(raw);
  if (ban) ban.setAttribute('hidden', 'hidden');
  renderCalendar_(root, {
    role: pack.role,
    common: pack.common,
    personal: pack.personal,
    curriculum: pack.curriculum
  });
  renderPlannerStudentProfile_(root, pack.student_profile);
  plannerRefreshMonthlyNotice_(root);
}

/**
 * @param {HTMLElement} root
 */
function wirePlannerDemoTrackOnce_(root) {
  if (root.__spPlanDemoTrackWired) return;
  root.__spPlanDemoTrackWired = true;
  root.addEventListener('click', function (e) {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    const btn = t.closest ? t.closest('[data-sp-demo-track]') : null;
    if (!(btn instanceof HTMLElement)) return;
    const track = plannerPlanDemoNormalizeTrack_(btn.getAttribute('data-sp-demo-track'));
    if (!track || track === root.__spPlanDemoTrack) return;
    e.preventDefault();
    const ban = root.querySelector('#sp-plan-banner');
    if (ban) {
      ban.textContent = '데모 데이터 불러오는 중…';
      ban.removeAttribute('hidden');
    }
    plannerSwitchPlanDemoTrack_(root, track).catch(function (err) {
      const m = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
      if (ban) {
        ban.textContent = m;
        ban.removeAttribute('hidden');
      }
    });
  });
}

/**
 * 홍보 데모 — 탭 없이 학생 정보 아래 월간 플래너를 한 페이지에 표시.
 * @param {HTMLElement} root
 */
function plannerApplyPlanDemoSinglePageLayout_(root) {
  const tabsRow = root.querySelector('.sp-plan-mainTabsRow');
  if (tabsRow) {
    tabsRow.setAttribute('hidden', 'hidden');
    tabsRow.setAttribute('aria-hidden', 'true');
  }
  const tabs = root.querySelector('.sp-plan-mainTabs');
  if (tabs) {
    tabs.setAttribute('hidden', 'hidden');
    tabs.setAttribute('aria-hidden', 'true');
  }

  const panelStudent = root.querySelector('#sp-plan-tab-student');
  const panelMonthly = root.querySelector('#sp-plan-tab-monthly');
  if (!panelMonthly) return;

  let shell = root.querySelector('.sp-plan-demoMonthlyShell');
  if (!shell) {
    shell = document.createElement('div');
    shell.className = 'sp-plan-demoMonthlyShell';
    if (panelStudent) {
      panelStudent.insertAdjacentElement('afterend', shell);
    } else {
      const body = root.querySelector('.sp-plan-body');
      if (!body) return;
      body.appendChild(shell);
    }
    shell.appendChild(panelMonthly);
  }

  if (panelStudent) {
    panelStudent.removeAttribute('hidden');
    panelStudent.removeAttribute('aria-hidden');
  }
  panelMonthly.removeAttribute('hidden');
  panelMonthly.removeAttribute('aria-hidden');
}

/**
 * 홍보 데모 — 저장·월 이동·관리 UI만 숨김. 학생 정보·월간 플래너 한 페이지(조회 전용).
 * @param {HTMLElement} root
 */
function plannerApplyPlanDemoChrome_(root) {
  root.classList.add('is-plan-demo');
  /** @param {string} sel */
  function hide(sel) {
    const el = root.querySelector(sel);
    if (!el) return;
    el.setAttribute('hidden', 'hidden');
    el.setAttribute('aria-hidden', 'true');
  }
  hide('.sp-plan-gate');
  hide('#sp-plan-devbar');
  hide('#sp-plan-quick-reg');
  hide('#sp-plan-export-bar');
  hide('#sp-plan-student-manual-reg');
  hide('#sp-plan-admin-modal');
  const adminTap = root.querySelector('#sp-plan-admin-tap');
  if (adminTap && adminTap.parentElement) {
    adminTap.parentElement.setAttribute('hidden', 'hidden');
    adminTap.parentElement.setAttribute('aria-hidden', 'true');
  }
  hide('.sp-plan-month__nav[data-nav="-1"]');
  hide('.sp-plan-month__nav[data-nav="1"]');
  const monthActions = root.querySelector('.sp-plan-month__actions');
  if (monthActions) {
    monthActions.setAttribute('hidden', 'hidden');
    monthActions.setAttribute('aria-hidden', 'true');
  }
  plannerApplyPlanDemoSinglePageLayout_(root);
  plannerApplyPlanMobileCalHint_(root);
}

/** @type {number} */
const PLANNER_COACHING_SUBJ_PREVIEW_MAX = 140;

const PLAN_MOBILE_MQ = '(max-width: 720px)';

/**
 * 모바일 달력 안내(1회 삽입) — 본편·데모 공통.
 * @param {HTMLElement} root
 */
function plannerApplyPlanMobileCalHint_(root) {
  const slot = root.querySelector('#sp-plan-calendar-slot');
  if (!slot || !slot.parentElement) return;
  if (slot.parentElement.querySelector('.sp-plan-mobileCalHint')) return;
  const hint = document.createElement('p');
  hint.className = 'sp-plan-mobileCalHint';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = '달력은 좌우로 밀어 보세요. 날짜를 누르면 할 일 요약 → 일일 플래너 순으로 열립니다.';
  slot.parentElement.insertBefore(hint, slot);
}

/**
 * @param {HTMLElement} root
 * @returns {boolean}
 */
function plannerIsPlanMobile_(root) {
  if (!root) return false;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(PLAN_MOBILE_MQ).matches;
}

/**
 * @param {string} ymd
 * @returns {string}
 */
function plannerFormatYmdKoShort_(ymd) {
  const s = String(ymd != null ? ymd : '').trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return s;
  return String(Number(m[2])) + '월 ' + String(Number(m[3])) + '일';
}

/**
 * @param {string} text
 * @returns {{ preview: string, truncated: boolean }}
 */
function plannerCoachingSubjectPreviewText_(text) {
  const full = String(text != null ? text : '').trim();
  if (full.length <= PLANNER_COACHING_SUBJ_PREVIEW_MAX) {
    return { preview: full, truncated: false };
  }
  let cut = full.slice(0, PLANNER_COACHING_SUBJ_PREVIEW_MAX);
  const lastNl = cut.lastIndexOf('\n');
  if (lastNl > PLANNER_COACHING_SUBJ_PREVIEW_MAX * 0.55) {
    cut = cut.slice(0, lastNl);
  }
  return { preview: cut.trimEnd() + '…', truncated: true };
}

/**
 * @param {HTMLElement} root
 * @param {string} subject
 * @param {string} body
 */
function plannerOpenCoachingSubjModal_(root, subject, body) {
  plannerEnsureCoachingSubjModal_(root);
  const m = root.querySelector('#sp-plan-coaching-subj-modal');
  if (!m) return;
  const sk = String(subject != null ? subject : '').trim();
  const bv = String(body != null ? body : '').trim();
  const title = m.querySelector('#sp-plan-coaching-subj-modal-title');
  if (title) title.textContent = sk.length ? sk : '과목별 상세 안내';
  const bodyEl = m.querySelector('#sp-plan-coaching-subj-modal-body');
  if (bodyEl) bodyEl.textContent = bv.length ? bv : '—';
  m.removeAttribute('hidden');
}

/**
 * @param {HTMLElement} root
 */
function plannerCloseCoachingSubjModal_(root) {
  const m = root.querySelector('#sp-plan-coaching-subj-modal');
  if (m) m.setAttribute('hidden', 'hidden');
}

/**
 * @param {HTMLElement} root
 */
function plannerEnsureCoachingSubjModal_(root) {
  let m = root.querySelector('#sp-plan-coaching-subj-modal');
  if (m) return;
  m = document.createElement('div');
  m.id = 'sp-plan-coaching-subj-modal';
  m.className = 'sp-plan-modal sp-plan-modal--coachingSubj';
  m.setAttribute('hidden', 'hidden');
  m.innerHTML =
    '<div class="sp-plan-modal__backdrop" data-sp-plan-close="coaching-subj" aria-hidden="true"></div>' +
    '<div class="sp-plan-modal__panel" role="dialog" aria-modal="true" aria-labelledby="sp-plan-coaching-subj-modal-title">' +
    '<div class="sp-plan-modal__head">' +
    '<div class="sp-plan-modal__title" id="sp-plan-coaching-subj-modal-title">과목별 상세 안내</div>' +
    '<button type="button" class="btn btn--ghost sp-plan-modal__close" data-sp-plan-close="coaching-subj">닫기</button>' +
    '</div>' +
    '<div class="sp-plan-modal__body sp-plan-coachingSubjModal__body" id="sp-plan-coaching-subj-modal-body"></div>' +
    '</div>';
  root.appendChild(m);
  m.addEventListener('click', function (e) {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    if (t.getAttribute('data-sp-plan-close') === 'coaching-subj' || t.closest('[data-sp-plan-close="coaching-subj"]')) {
      plannerCloseCoachingSubjModal_(root);
    }
  });
}

/**
 * @param {HTMLElement} root
 */
function wirePlannerCoachingSubjReadOnce_(root) {
  if (root.__spPlanCoachingSubjReadWired) return;
  root.__spPlanCoachingSubjReadWired = true;
  root.addEventListener('click', function (e) {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    const btn = t.closest ? t.closest('[data-sp-coaching-subj-open]') : null;
    if (!(btn instanceof HTMLElement)) return;
    e.preventDefault();
    const idx = Number(btn.getAttribute('data-sp-coaching-subj-idx'));
    const list = root.__spPlanCoachingSubjReadList;
    if (!list || !list[idx]) return;
    plannerOpenCoachingSubjModal_(root, list[idx].subject, list[idx].body);
  });
  if (!root.__spPlanCoachingMobileMqWired) {
    root.__spPlanCoachingMobileMqWired = true;
    try {
      const mq = window.matchMedia(PLAN_MOBILE_MQ);
      mq.addEventListener('change', function () {
        plannerCloseCoachingSubjModal_(root);
        if (root.__spPlanStudentProfileInitial && typeof root.__spPlanStudentProfileInitial === 'object') {
          renderPlannerCoachingBlocks_(root, root.__spPlanStudentProfileInitial);
        }
      });
    } catch (_mqErr) {
      /* matchMedia 미지원 */
    }
  }
}

/**
 * 모바일 — 달력 칸 요약(할 일·고정·이벤트·메모).
 * @param {object} st
 * @param {string} key ymd
 * @returns {string}
 */
function plannerPlanDayPeekBodyHtml_(st, key) {
  /** @type {string[]} */
  const parts = [];
  const summary = plannerQuickPlanCellSummaryHtml_(st, key);
  if (summary) {
    parts.push('<div class="sp-plan-dayPeek__sum" aria-label="학습 할 일">' + summary + '</div>');
  }
  const fixed = plannerFixedScheduleFooterHtml_(st, key);
  if (fixed) {
    parts.push('<div class="sp-plan-dayPeek__fixed">' + fixed + '</div>');
  }
  const events = plannerEventsForDay_(st, key);
  if (events.length) {
    let evHtml =
      '<div class="sp-plan-dayPeek__events"><div class="sp-plan-dayPeek__lbl">이벤트</div><ul class="sp-plan-dayPeek__evList">';
    events.forEach(function (ev) {
      const t = ev && ev.title != null ? String(ev.title).trim() : '';
      if (t) evHtml += '<li>' + esc(t) + '</li>';
    });
    evHtml += '</ul></div>';
    parts.push(evHtml);
  }
  const memo = plannerDayMemoText_(st, key);
  if (memo) {
    parts.push(
      '<div class="sp-plan-dayPeek__memo"><div class="sp-plan-dayPeek__lbl">메모</div>' +
        '<p class="sp-plan-dayPeek__memoTxt">' +
        esc(memo) +
        '</p></div>'
    );
  }
  if (!parts.length) {
    return '<p class="sp-plan-dayPeek__empty">이 날 등록된 할 일이 없습니다.</p>';
  }
  return parts.join('');
}

/**
 * @param {HTMLElement} root
 * @returns {Promise<void>}
 */
async function plannerStartPlanDemo_(root) {
  root.classList.add('is-plan-demo');
  root.__spPlanAdminMode = false;
  root.__spPlanActiveTab = PLAN_DEMO.startTab === 'monthly' ? 'monthly' : 'student';
  root.__spPlanDemoViewMonth = plannerPlanDemoViewMonthDate_(PLAN_DEMO);
  const demoTrack = plannerPlanDemoInitialTrack_();
  root.__spPlanDemoTrack = demoTrack;
  plannerMountDemoTrackBar_(root);
  plannerUpdateDemoTrackBar_(root, demoTrack);
  plannerPlanDemoSyncTrackInUrl_(demoTrack);

  const gate = root.querySelector('.sp-plan-gate');
  if (gate) {
    gate.setAttribute('hidden', 'hidden');
    gate.setAttribute('aria-hidden', 'true');
  }
  plannerRevealPlanMain_(root);

  const ban = root.querySelector('#sp-plan-banner');
  /** @type {{ role: string, common: object[], personal: object[] | null, student_profile: Record<string, unknown> | null, curriculum: unknown }} */
  let pack;
  try {
    const raw = await plannerLoadPlanDemoFixture_(plannerPlanDemoFixtureCfgForTrack_(demoTrack));
    pack = plannerNormalizePlanDemoFixture_(raw);
  } catch (e) {
    const m = e && typeof e === 'object' && 'message' in e ? String(/** @type {{ message?: string }} */ (e).message) : String(e);
    if (ban) {
      ban.textContent = m;
      ban.removeAttribute('hidden');
    }
    renderCalendar_(root, { role: 'guest', common: [], personal: [], curriculum: { courses: [], lectures: [] } });
    plannerApplyPlanDemoChrome_(root);
    plannerApplyAdminVisibility_(root);
    return;
  }

  if (ban) {
    ban.setAttribute('hidden', 'hidden');
  }
  renderCalendar_(root, {
    role: pack.role,
    common: pack.common,
    personal: pack.personal,
    curriculum: pack.curriculum
  });
  renderPlannerStudentProfile_(root, pack.student_profile);
  plannerRefreshMonthlyNotice_(root);
  plannerApplyPlanDemoChrome_(root);
  plannerApplyAdminVisibility_(root);
}

/** `styles.css`가 막혀도 게이트 한 줄·가운데 유지 */
const PLAN_GATE_FALLBACK_CSS = `#solpath-plan-root .sp-plan-gate{display:flex!important;flex-direction:column!important;align-items:center!important;margin-left:auto!important;margin-right:auto!important;width:100%!important;max-width:min(100%,52rem)!important;box-sizing:border-box!important;padding:1rem clamp(0.75rem,3vw,1.75rem) 1.25rem!important}#solpath-plan-root .sp-plan-gate__lead,#solpath-plan-root .sp-plan-gate__privacy{width:100%;max-width:100%;text-align:center;margin:0 0 0.5rem}#solpath-plan-root .sp-plan-gate__privacy{margin-bottom:1rem;color:#64748b;font-size:0.85rem}#solpath-plan-root .sp-plan-gate__pair{display:flex!important;flex-wrap:wrap!important;align-items:flex-start!important;justify-content:center!important;gap:0.75rem 2rem!important;width:100%!important;max-width:100%!important;margin-left:auto!important;margin-right:auto!important;padding-left:0.25rem!important;padding-right:0.25rem!important;overflow:visible!important;box-sizing:border-box!important}#solpath-plan-root .sp-plan-gate__stack{display:flex!important;flex-direction:column!important;gap:0.28rem!important;flex:0 0 auto!important}#solpath-plan-root .sp-plan-gate__stack--tel{align-items:flex-start!important}#solpath-plan-root .sp-plan-gate__lbl{font-size:0.75rem;font-weight:600;color:#1e293b;text-align:left;align-self:stretch}#solpath-plan-root .sp-plan-gate__tel{display:inline-flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:0.35rem!important}#solpath-plan-root .sp-plan-gate__dash{color:#94a3b8;font-weight:600;flex-shrink:0}#solpath-plan-root .sp-plan-gate__input{box-sizing:border-box;padding:0.45rem 0.35rem;border:1px solid #cbd5e1;border-radius:8px;font-size:1rem}#solpath-plan-root .sp-plan-gate__input--seg3{width:6.5rem!important;min-width:6.5rem!important;max-width:7.5rem!important;padding:0.5rem 0.65rem!important;text-align:center;flex-shrink:0;box-sizing:border-box!important}#solpath-plan-root .sp-plan-gate__input--seg4{width:8rem!important;min-width:8rem!important;max-width:9rem!important;padding:0.5rem 0.65rem!important;text-align:center;flex-shrink:0;box-sizing:border-box!important}#solpath-plan-root .sp-plan-gate__input--name{width:min(100%,14rem);min-width:6.5rem;max-width:20rem;text-align:left;padding-left:0.45rem;padding-right:0.45rem}#solpath-plan-root .sp-plan-gate__err{margin:0.5rem 0 0;width:100%;max-width:100%;text-align:center;color:#b71c1c;font-size:0.8rem}#solpath-plan-root .sp-plan-gate__btn{margin-top:0.85rem;align-self:center}`;

function injectPlanGateFallbackCss_() {
  if (document.getElementById('sp-plan-gate-fallback-css')) return;
  const el = document.createElement('style');
  el.id = 'sp-plan-gate-fallback-css';
  el.textContent = PLAN_GATE_FALLBACK_CSS;
  document.head.appendChild(el);
}

const PLAN_SESSION_ADMIN_KEY = 'sp_plan_admin_mode';

/**
 * 어드민: 제작용 바 · 할 일 등록(빠른·고정·개별·POST 미리보기) 표시.
 * @param {HTMLElement} root `#solpath-plan-root`
 */
function plannerApplyAdminVisibility_(root) {
  const admin = Boolean(root.__spPlanAdminMode);
  root.classList.toggle('is-plan-admin', admin);
  const dev = root.querySelector('#sp-plan-devbar');
  const reg = root.querySelector('#sp-plan-quick-reg');
  const tap = root.querySelector('#sp-plan-admin-tap');
  if (tap) {
    tap.setAttribute('aria-label', '솔루션 학습 플래너');
    if (admin) tap.setAttribute('aria-pressed', 'true');
    else tap.removeAttribute('aria-pressed');
  }
  const profileTitle = root.querySelector('#sp-plan-student-info-title');
  if (profileTitle) profileTitle.removeAttribute('title');
  if (dev) {
    if (admin) {
      dev.removeAttribute('hidden');
      dev.removeAttribute('aria-hidden');
    } else {
      dev.setAttribute('hidden', 'hidden');
      dev.setAttribute('aria-hidden', 'true');
    }
  }
  if (reg) {
    if (admin) {
      reg.removeAttribute('hidden');
      reg.removeAttribute('aria-hidden');
    } else {
      reg.setAttribute('hidden', 'hidden');
      reg.setAttribute('aria-hidden', 'true');
    }
  }
  const saveRow = root.querySelector('#sp-plan-student-save-row');
  if (saveRow) {
    if (plannerStudentProfileCanEdit_(root)) {
      saveRow.removeAttribute('hidden');
    } else {
      saveRow.setAttribute('hidden', 'hidden');
    }
  }
  const manualReg = root.querySelector('#sp-plan-student-manual-reg');
  if (manualReg) {
    if (admin) {
      manualReg.removeAttribute('hidden');
      manualReg.removeAttribute('aria-hidden');
    } else {
      manualReg.setAttribute('hidden', 'hidden');
      manualReg.setAttribute('aria-hidden', 'true');
    }
  }
  const showMemberCoaching = plannerStudentProfileIsMemberView_(root);
  const coaching = root.querySelector('#sp-plan-coaching');
  if (coaching) {
    if (showMemberCoaching) {
      coaching.removeAttribute('hidden');
      coaching.removeAttribute('aria-hidden');
    } else {
      coaching.setAttribute('hidden', 'hidden');
      coaching.setAttribute('aria-hidden', 'true');
    }
  }
  const monthlyNotice = root.querySelector('#sp-plan-monthly-notice');
  if (monthlyNotice) {
    if (showMemberCoaching) {
      monthlyNotice.removeAttribute('hidden');
      monthlyNotice.removeAttribute('aria-hidden');
    } else {
      monthlyNotice.setAttribute('hidden', 'hidden');
      monthlyNotice.setAttribute('aria-hidden', 'true');
    }
  }
  plannerSyncCoachingReadOnlyState_(root);
}

/**
 * 월 이동·커리큘럼 await 시 달력 로딩 표시.
 * @param {HTMLElement} root
 * @param {boolean} on
 * @param {string} [statusText]
 */
function plannerSetMonthFetchLoading_(root, on, statusText) {
  const wrap = root.querySelector('#sp-plan-month-wrap');
  if (!wrap) return;
  let el = wrap.querySelector('#sp-plan-month-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sp-plan-month-loading';
    el.className = 'sp-plan-month__loading';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="sp-plan-month__loadingBox" aria-hidden="true"><span class="sp-plan-month__loadingSpinner"></span></div>' +
      '<span class="sp-plan-month__loadingText">일정 불러오는 중…</span>';
    wrap.appendChild(el);
  }
  const msg = String(statusText != null ? statusText : '').trim();
  const textEl = el.querySelector('.sp-plan-month__loadingText');
  if (textEl && msg.length) {
    textEl.textContent = msg;
  } else if (textEl && !on) {
    textEl.textContent = '일정 불러오는 중…';
  }
  wrap.classList.toggle('is-month-fetching', Boolean(on));
  if (on) {
    el.removeAttribute('hidden');
    wrap.setAttribute('aria-busy', 'true');
  } else {
    el.setAttribute('hidden', 'hidden');
    wrap.removeAttribute('aria-busy');
  }
}

/**
 * 게이트 통과 전: 학생 정보·월간 플랜·달력(`#sp-plan-app-main`) 전부 숨김.
 * @param {HTMLElement} root
 */
function plannerSetGatePending_(root) {
  root.classList.add('is-plan-gate-pending');
  const main = root.querySelector('#sp-plan-app-main');
  if (main) {
    main.setAttribute('hidden', 'hidden');
    main.setAttribute('aria-hidden', 'true');
  }
}

/**
 * 확인·원페이지만 후: 게이트 아래 본문(학생 정보·달력) 표시.
 * @param {HTMLElement} root
 */
function plannerRevealPlanMain_(root) {
  root.classList.remove('is-plan-gate-pending');
  const main = root.querySelector('#sp-plan-app-main');
  if (main) {
    main.removeAttribute('hidden');
    main.removeAttribute('aria-hidden');
  }
}

/**
 * @param {HTMLElement} root
 */
function plannerSetAdminMode_(root, on) {
  root.__spPlanAdminMode = Boolean(on);
  // 모드 전환 = 편집 세션 경계. 저장하지 않은 편집 표시를 남기면 조회 화면이 서버 값으로 못 돌아간다.
  plannerClearProfileDirty_(root);
  try {
    sessionStorage.setItem(PLAN_SESSION_ADMIN_KEY, root.__spPlanAdminMode ? '1' : '0');
  } catch (_e) {
    /* ignore */
  }
  plannerApplyAdminVisibility_(root);
  const prof =
    root.__spPlanStudentProfileInitial && typeof root.__spPlanStudentProfileInitial === 'object'
      ? root.__spPlanStudentProfileInitial
      : null;
  if (prof) {
    renderPlannerStudentProfile_(root, prof);
  }
  if (typeof root.__spPlanRerenderMonth === 'function') {
    root.__spPlanRerenderMonth();
  }
}

/**
 * @param {HTMLElement} root
 */
function plannerMountAdminSecretInput_(root) {
  const slot = root.querySelector('#sp-plan-admin-secret-slot');
  if (!slot || slot.querySelector('#sp-plan-admin-secret')) return;
  const inp = document.createElement('input');
  inp.type = 'password';
  inp.id = 'sp-plan-admin-secret';
  inp.className = 'sp-plan-admin-modal__input';
  inp.setAttribute('autocomplete', 'new-password');
  inp.setAttribute('name', 'sp-planner-admin-verify');
  inp.setAttribute('spellcheck', 'false');
  inp.maxLength = 80;
  slot.appendChild(inp);
}

/**
 * @param {HTMLElement} root
 */
function plannerUnmountAdminSecretInput_(root) {
  const slot = root.querySelector('#sp-plan-admin-secret-slot');
  if (slot) slot.innerHTML = '';
}

/**
 * @param {HTMLElement} root
 */
function plannerShowAdminUnlockModal_(root) {
  const modal = root.querySelector('#sp-plan-admin-modal');
  const err = root.querySelector('#sp-plan-admin-modal-err');
  if (!modal) return;
  plannerMountAdminSecretInput_(root);
  const inp = /** @type {HTMLInputElement | null} */ (root.querySelector('#sp-plan-admin-secret'));
  if (err) {
    err.textContent = '';
    err.setAttribute('hidden', 'hidden');
  }
  if (inp) {
    inp.value = '';
  }
  modal.removeAttribute('hidden');
  modal.removeAttribute('aria-hidden');
  if (inp) {
    window.setTimeout(function () {
      inp.focus();
    }, 0);
  }
}

/**
 * @param {HTMLElement} root
 */
function plannerHideAdminUnlockModal_(root) {
  const modal = root.querySelector('#sp-plan-admin-modal');
  if (!modal) return;
  modal.setAttribute('hidden', 'hidden');
  modal.setAttribute('aria-hidden', 'true');
  plannerUnmountAdminSecretInput_(root);
}

/**
 * @param {HTMLElement} root
 */
async function plannerAdminUnlockSubmit_(root) {
  const inp = /** @type {HTMLInputElement | null} */ (root.querySelector('#sp-plan-admin-secret'));
  const err = root.querySelector('#sp-plan-admin-modal-err');
  const submitBtn = root.querySelector('#sp-plan-admin-modal-submit');
  const secret = inp ? String(inp.value || '').trim() : '';
  if (!secret.length) {
    if (err) {
      err.textContent = '암호를 입력해 주세요.';
      err.removeAttribute('hidden');
    }
    return;
  }
  if (GAS_MODE.useMock) {
    if (err) {
      err.textContent = 'gasBaseUrl이 없어 서버 확인을 할 수 없습니다.';
      err.removeAttribute('hidden');
    }
    return;
  }
  if (submitBtn) submitBtn.setAttribute('disabled', 'disabled');
  if (err) {
    err.textContent = '확인 중…';
    err.removeAttribute('hidden');
  }
  const res = await plannerGasCall_({ action: 'plannerAdminVerify', admin_secret: secret });
  if (submitBtn) submitBtn.removeAttribute('disabled');
  if (!res || !res.ok) {
    const m = res && res.error && res.error.message != null ? String(res.error.message) : '확인에 실패했습니다.';
    if (err) err.textContent = m;
    return;
  }
  const data = /** @type {{ outcome?: string }} */ (res.data || {});
  if (String(data.outcome || '') === 'ok') {
    plannerSetAdminMode_(root, true);
    plannerHideAdminUnlockModal_(root);
    return;
  }
  if (err) {
    err.textContent = '암호가 올바르지 않습니다.';
    err.removeAttribute('hidden');
  }
  if (inp) {
    inp.focus();
    inp.select();
  }
}

/**
 * @param {HTMLElement} el
 * @param {HTMLElement} root
 * @param {{ count: number, lastAt: number }} st
 */
function plannerAdminUnlockOnFiveTap_(el, root, st) {
  const resetMs = 2600;
  el.addEventListener('click', function (e) {
    e.preventDefault();
    const now = Date.now();
    if (now - st.lastAt > resetMs) st.count = 0;
    st.lastAt = now;
    st.count++;
    if (st.count < 5) return;
    st.count = 0;
    st.lastAt = 0;
    if (root.__spPlanAdminMode) {
      plannerSetAdminMode_(root, false);
      plannerHideAdminUnlockModal_(root);
      return;
    }
    plannerShowAdminUnlockModal_(root);
  });
}

/**
 * 헤더 로고·「학생 정보」제목 5회 연속 클릭 → 암호 모달(게이트에서도 표시). 켜진 뒤 5회면 해제.
 * @param {HTMLElement} root
 */
function wirePlannerAdminUnlockOnce_(root) {
  if (root.__spPlanAdminUnlockWired) return;
  root.__spPlanAdminUnlockWired = true;
  const tap = root.querySelector('#sp-plan-admin-tap');
  const modal = root.querySelector('#sp-plan-admin-modal');
  const profileTitle = root.querySelector('#sp-plan-student-info-title');
  /** @type {{ count: number, lastAt: number }} */
  const st = { count: 0, lastAt: 0 };
  if (tap) plannerAdminUnlockOnFiveTap_(tap, root, st);
  if (profileTitle) plannerAdminUnlockOnFiveTap_(profileTitle, root, st);
  if (!tap && !profileTitle) return;

  if (!modal) return;
  modal.addEventListener('click', function (e) {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    if (t.getAttribute('data-sp-admin-close') === '1' || t.closest('[data-sp-admin-close="1"]')) {
      plannerHideAdminUnlockModal_(root);
    }
  });
  const submitBtn = root.querySelector('#sp-plan-admin-modal-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', function (e) {
      e.preventDefault();
      void plannerAdminUnlockSubmit_(root);
    });
  }
  const inp = root.querySelector('#sp-plan-admin-secret');
  if (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        void plannerAdminUnlockSubmit_(root);
      }
    });
  }
}

/**
 * 관리자 `app.js` / `studentMgmt.js` 와 동일: `GET` JSONP.
 * @param {string} baseUrl
 * @param {string} action
 * @param {Record<string, string>|null} extraParams
 * @param {number} timeoutMs
 * @returns {Promise<Record<string, unknown>>}
 */
function plannerGasJsonpWithParams_(baseUrl, action, extraParams, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const cb = '_solpath_jp_' + String(Date.now()) + '_' + String(Math.floor(Math.random() * 1e9));
    const lim = timeoutMs != null ? timeoutMs : 360000;
    const t = window.setTimeout(function () {
      cleanup();
      reject(new Error('timeout'));
    }, lim);
    const s = document.createElement('script');
    const g = globalThis;
    function cleanup() {
      window.clearTimeout(t);
      try {
        delete g[cb];
      } catch (_e) {
        g[cb] = undefined;
      }
      if (s.parentNode) {
        s.parentNode.removeChild(s);
      }
    }
    g[cb] = function (/** @type {Record<string, unknown>} */ data) {
      cleanup();
      resolve(data);
    };
    let u;
    try {
      u = new URL(baseUrl);
    } catch (_e) {
      cleanup();
      reject(new Error('bad url'));
      return;
    }
    u.searchParams.set('format', 'jsonp');
    u.searchParams.set('callback', cb);
    u.searchParams.set('action', action);
    if (extraParams) {
      Object.keys(extraParams).forEach(function (k) {
        u.searchParams.set(k, extraParams[k]);
      });
    }
    s.async = true;
    s.src = u.toString();
    s.onerror = function () {
      cleanup();
      reject(new Error('script error'));
    };
    document.head.appendChild(s);
  });
}

/**
 * 로컬 달 기준 `yyyy-MM` (`plannerBootstrap` · `year_month`).
 * @param {Date} d
 * @returns {string}
 */
function plannerYearMonthFromDate_(d) {
  if (!(d instanceof Date) || isNaN(Number(d.getTime()))) {
    d = new Date();
  }
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return String(y) + '-' + (m < 10 ? '0' : '') + String(m);
}

/**
 * GAS `dbPlannerReadCommonEvents_` · `DB_PLANNER_COMMON_CALENDAR_HEADERS` 와 동일 키.
 * @typedef {{ event_id: string, start_date: string, end_date: string, title: string, description: string, category: string, sort_key: number }} PlannerCommonEvent
 */

/**
 * @param {unknown} v
 * @returns {string} `yyyy-MM-dd` 또는 빈 문자열
 */
function plannerCommonEventDateString_(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(Number(v.getTime()))) {
    return plannerYmdFromParts_(v.getFullYear(), v.getMonth(), v.getDate());
  }
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return iso[1] + '-' + iso[2] + '-' + iso[3];
  }
  return '';
}

/**
 * @param {unknown} ev
 * @returns {PlannerCommonEvent}
 */
function plannerNormalizeCommonEventFromApi_(ev) {
  const o = ev && typeof ev === 'object' ? /** @type {Record<string, unknown>} */ (ev) : {};
  const sk = o.sort_key;
  let skn = sk != null && String(sk).trim() !== '' ? Number(sk) : 0;
  if (!isFinite(skn)) {
    skn = 0;
  }
  const start0 = plannerCommonEventDateString_(o.start_date);
  let end0 = plannerCommonEventDateString_(o.end_date);
  if (start0 && (!end0 || end0 < start0)) {
    end0 = start0;
  }
  return {
    event_id: String(o.event_id != null ? o.event_id : '').trim(),
    start_date: start0,
    end_date: end0,
    title: String(o.title != null ? o.title : '').trim(),
    description: String(o.description != null ? o.description : '').trim(),
    category: String(o.category != null ? o.category : '').trim(),
    sort_key: skn
  };
}

/**
 * @param {unknown} arr
 * @returns {PlannerCommonEvent[]}
 */
function plannerNormalizeCommonEventsFromApi_(arr) {
  if (!Array.isArray(arr)) {
    return [];
  }
  const list = arr.map(plannerNormalizeCommonEventFromApi_).filter(function (e) {
    return e.start_date.length > 0;
  });
  list.sort(function (a, b) {
    if (a.sort_key !== b.sort_key) {
      return a.sort_key - b.sort_key;
    }
    if (a.start_date !== b.start_date) {
      return a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0;
    }
    if (a.event_id !== b.event_id) {
      return a.event_id < b.event_id ? -1 : 1;
    }
    return 0;
  });
  return list;
}

/**
 * 공통 일정: `start_date`~`end_date`(포함) 각 날에 배지 합산.
 * @param {Record<string, number>} byDate
 * @param {PlannerCommonEvent[]} events
 */
function plannerCommonEventsMergeIntoByDate_(byDate, events) {
  events.forEach(function (ev) {
    const start = ev.start_date;
    const end = ev.end_date || start;
    if (!start) {
      return;
    }
    const ps = start.split('-');
    const pe = end.split('-');
    if (ps.length !== 3 || pe.length !== 3) {
      byDate[start] = (byDate[start] || 0) + 1;
      return;
    }
    const y1 = Number(ps[0]);
    const m1 = Number(ps[1]);
    const d1 = Number(ps[2]);
    const y2 = Number(pe[0]);
    const m2 = Number(pe[1]);
    const d2 = Number(pe[2]);
    if (![y1, m1, d1, y2, m2, d2].every(isFinite)) {
      byDate[start] = (byDate[start] || 0) + 1;
      return;
    }
    let cur = new Date(y1, m1 - 1, d1);
    const last = new Date(y2, m2 - 1, d2);
    let guard = 0;
    while (guard < 400 && cur <= last) {
      const key = plannerYmdFromParts_(cur.getFullYear(), cur.getMonth(), cur.getDate());
      byDate[key] = (byDate[key] || 0) + 1;
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
      guard++;
    }
  });
}

/**
 * bootstrap `curriculum` → 상태에 둘 `{ courses, lectures }`.
 * @param {unknown} raw
 * @returns {{ courses: object[], lectures: object[] }}
 */
function plannerNormalizeCurriculumFromBootstrap_(raw) {
  const o = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const courses = o.courses;
  const lectures = o.lectures;
  return {
    courses: Array.isArray(courses) ? /** @type {object[]} */ (courses) : [],
    lectures: Array.isArray(lectures) ? /** @type {object[]} */ (lectures) : []
  };
}

const PLANNER_CURRICULUM_CACHE_KEY = 'sp_plan_curriculum_v1';

/**
 * @returns {{ version: string, curriculum: { courses: object[], lectures: object[] } } | null}
 */
function plannerCurriculumCacheRead_() {
  try {
    const raw = sessionStorage.getItem(PLANNER_CURRICULUM_CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    const version = String(o.version != null ? o.version : '').trim();
    if (!version.length) return null;
    return {
      version: version,
      curriculum: plannerNormalizeCurriculumFromBootstrap_(o.curriculum)
    };
  } catch (_e) {
    return null;
  }
}

/**
 * @param {string} version
 * @param {unknown} curriculum
 */
function plannerCurriculumCacheWrite_(version, curriculum) {
  try {
    sessionStorage.setItem(
      PLANNER_CURRICULUM_CACHE_KEY,
      JSON.stringify({
        version: version,
        curriculum: curriculum
      })
    );
  } catch (_e) {
    /* quota */
  }
}

/**
 * `plannerCurriculum` — 캐시 우선, 없으면 GAS fetch.
 * @param {string} [serverVersion]
 * @returns {Promise<{ version: string, curriculum: { courses: object[], lectures: object[] } } | null>}
 */
function plannerFetchCurriculumPack_(serverVersion) {
  const wantVer = String(serverVersion != null ? serverVersion : '').trim();
  const cached = plannerCurriculumCacheRead_();
  if (cached && (!wantVer.length || cached.version === wantVer)) {
    return Promise.resolve({ version: cached.version, curriculum: cached.curriculum });
  }
  return plannerGasCall_({ action: 'plannerCurriculum' })
    .then(function (res) {
      if (!res || !res.ok) return null;
      const d = /** @type {{ version?: string, curriculum?: unknown }} */ (res.data || {});
      const version = String(d.version != null ? d.version : '').trim();
      const curriculum = d.curriculum;
      if (!version.length || !curriculum || typeof curriculum !== 'object') return null;
      const norm = plannerNormalizeCurriculumFromBootstrap_(curriculum);
      plannerCurriculumCacheWrite_(version, curriculum);
      return { version: version, curriculum: norm };
    })
    .catch(function () {
      return null;
    });
}

/**
 * 커리큘럼 로드 후 빠른등록·개별등록·열린 일정등록 모달 셀렉트 갱신.
 * @param {HTMLElement} root
 */
function plannerRefreshCurriculumSelectsInRoot_(root) {
  const st = root.__spPlanState;
  if (!st || typeof st !== 'object') return;
  const slot = root.querySelector('#sp-plan-calendar-slot');
  if (slot) {
    plannerQuickCurriculumRefreshCascade_(slot, st, 'all');
    const panelCurr = slot.querySelector('#sp-plan-manual-curriculum');
    if (panelCurr && !panelCurr.hasAttribute('hidden')) {
      plannerCurriculumRefreshCascade_(slot, st, 'all', 'panel');
    } else if (st.manualRegMode === 'curriculum') {
      plannerCurriculumRefreshCascade_(slot, st, 'all', 'panel');
    }
  }
  const calReg = root.querySelector('#sp-plan-cal-reg-modal');
  if (calReg && !calReg.hasAttribute('hidden')) {
    const calCurr = calReg.querySelector('#sp-calreg-manual-curriculum');
    if (calCurr && !calCurr.hasAttribute('hidden')) {
      plannerCurriculumRefreshCascade_(calReg, st, 'all', 'calreg');
    } else if (st.manualRegMode === 'curriculum') {
      plannerCurriculumRefreshCascade_(calReg, st, 'all', 'calreg');
    }
  }
}

/**
 * @param {HTMLElement} root
 * @param {unknown} curriculum
 */
function plannerApplyCurriculumToRoot_(root, curriculum) {
  const st = root.__spPlanState;
  if (!st || typeof st !== 'object') return;
  st.plannerCurriculum = plannerNormalizeCurriculumFromBootstrap_(curriculum);
  plannerRefreshCurriculumSelectsInRoot_(root);
}

/**
 * bootstrap `curriculum_version` + sessionStorage — 커리큘럼은 bootstrap 본문과 분리.
 * @param {HTMLElement} root
 * @param {string} [serverVersion]
 * @returns {Promise<void>}
 */
function plannerEnsureCurriculumLoaded_(root, serverVersion) {
  if (plannerIsPlanDemoRoot_(root)) {
    return Promise.resolve();
  }
  const rid = (root.__spPlannerCurriculumFetchId = (root.__spPlannerCurriculumFetchId || 0) + 1);
  return plannerFetchCurriculumPack_(serverVersion).then(function (pack) {
    if (!pack || root.__spPlannerCurriculumFetchId !== rid) return;
    plannerApplyCurriculumToRoot_(root, pack.curriculum);
  });
}

/**
 * @param {HTMLElement} root
 * @param {unknown} boot
 */
function plannerInitCurriculumOnCalendar_(root, boot) {
  const st = root.__spPlanState;
  if (!st || typeof st !== 'object') return;
  const b = boot && typeof boot === 'object' ? /** @type {Record<string, unknown>} */ (boot) : {};
  if (b.curriculum != null) {
    st.plannerCurriculum = plannerNormalizeCurriculumFromBootstrap_(b.curriculum);
    return;
  }
  const cached = plannerCurriculumCacheRead_();
  st.plannerCurriculum = cached ? cached.curriculum : { courses: [], lectures: [] };
}

/**
 * 게이트 통과 후 저장된 연락처로 `viewMonth` 해당 달 bootstrap만 다시 읽기 (§8.5 구역 C).
 * @param {HTMLElement} root
 * @returns {Promise<void>}
 */
function plannerRefetchBootstrapForViewMonth_(root) {
  if (plannerIsPlanDemoRoot_(root)) {
    return Promise.resolve();
  }
  const ctx = root.__spPlannerBootstrapCtx;
  const st = root.__spPlanState;
  if (
    !ctx ||
    typeof ctx !== 'object' ||
    !st ||
    typeof st !== 'object' ||
    !Array.isArray(ctx.phoneSegments)
  ) {
    return Promise.resolve();
  }
  const segs = ctx.phoneSegments;
  if (segs[0].length !== 3 || segs[1].length !== 4 || segs[2].length !== 4) {
    return Promise.resolve();
  }
  const view = st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime()) ? st.viewMonth : new Date();
  const rid = (root.__spPlannerMonthFetchId = (root.__spPlannerMonthFetchId || 0) + 1);
  const msgEl = root.querySelector('#sp-plan-month-apply-msg');
  if (msgEl) {
    msgEl.textContent = '';
    msgEl.setAttribute('hidden', 'hidden');
  }
  plannerSetMonthFetchLoading_(root, true, '일정 불러오는 중…');
  return plannerGasCall_({
    action: 'plannerBootstrap',
    phoneSegments: segs,
    name: ctx.name != null ? ctx.name : '',
    memberCode: ctx.memberCode != null ? ctx.memberCode : '',
    year_month: plannerYearMonthFromDate_(view)
  })
    .then(function (boot) {
      if (root.__spPlannerMonthFetchId !== rid) return;
      if (!boot || !boot.ok) {
        const m =
          boot && boot.error && boot.error.message != null
            ? String(boot.error.message)
            : '일정을 불러오지 못했습니다. 잠시 후 다시 달을 옮겨 보세요.';
        if (msgEl) {
          msgEl.textContent = m;
          msgEl.removeAttribute('hidden');
        }
        return;
      }
      const d = /** @type {{ role?: string, common?: object[], personal?: object[] | null, student_profile?: Record<string, unknown>, curriculum_version?: string }} */ (
        boot.data || {}
      );
      const cv = d.curriculum_version != null ? String(d.curriculum_version).trim() : '';
      /** @type {Record<string, unknown>} */
      const mergePack = {
        role: d.role || 'guest',
        common: d.common || [],
        personal: d.personal != null ? d.personal : null,
        student_profile: d.student_profile,
        curriculum_version: cv
      };
      // 월 이동: 캐시 hit면 즉시 붙이고, miss여도 일정 merge를 커리큘럼 fetch에 묶지 않음
      const cached = plannerCurriculumCacheRead_();
      if (cached && (!cv.length || cached.version === cv)) {
        mergePack.curriculum = cached.curriculum;
      }
      plannerMergeBootstrapMonthData_(root, /** @type {Parameters<typeof plannerMergeBootstrapMonthData_>[1]} */ (mergePack));
      if (cv.length && !(cached && cached.version === cv)) {
        void plannerEnsureCurriculumLoaded_(root, cv);
      }
    })
    .finally(function () {
      if (root.__spPlannerMonthFetchId === rid) {
        plannerSetMonthFetchLoading_(root, false);
      }
    });
}

/**
 * 월 이동 재조회 결과만 상태·달력 격자에 반영 (`renderCalendar_` 전체 생략 — 등록 폼 유지).
 * @param {HTMLElement} root
 * @param {{ role: string, common: object[], personal: object[] | null, student_profile?: Record<string, unknown>, curriculum?: unknown, curriculum_version?: string }} pack
 */
function plannerMergeBootstrapMonthData_(root, pack) {
  const st = root.__spPlanState;
  if (!st || typeof st !== 'object') return;
  const roleNext = pack.role === 'member' ? 'member' : 'guest';
  st.role = roleNext;
  if (st.planGuestUnlockMock) {
    st.role = 'member';
  }
  if (pack.curriculum != null) {
    st.plannerCurriculum = plannerNormalizeCurriculumFromBootstrap_(pack.curriculum);
  }
  const common = plannerNormalizeCommonEventsFromApi_(pack.common);
  const personal = pack.personal != null && Array.isArray(pack.personal) ? pack.personal : [];
  st.plannerCommonEvents = common;
  /** @type {Record<string, number>} */
  const byDate = {};
  plannerCommonEventsMergeIntoByDate_(byDate, common);
  personal.forEach(function (ev) {
    const d0 = String((ev && ev.date) || '').trim();
    if (!d0) return;
    byDate[d0] = (byDate[d0] || 0) + 1;
  });
  st.byDate = byDate;
  st.apiHadCalendarRows = common.length > 0 || personal.length > 0;
  const ban = root.querySelector('#sp-plan-banner');
  if (ban) {
    if (st.role === 'guest') {
      ban.textContent = '수강 확인이 되지 않아 학원 공통 일정만 표시됩니다. 문의가 필요하면 담당자에게 연락해 주세요.';
      ban.removeAttribute('hidden');
    } else {
      ban.setAttribute('hidden', 'hidden');
    }
  }
  renderPlannerStudentProfile_(root, pack.student_profile);
  plannerApplyBootstrapPersonal_(st, pack.personal, st.role);
  if (typeof root.__spPlanRerenderMonth === 'function') {
    root.__spPlanRerenderMonth();
  }
  plannerRefreshCurriculumSelectsInRoot_(root);
  plannerRefreshPostPreview_(root);
  if (typeof root.__spPlanRefreshOpenDayModal === 'function') {
    root.__spPlanRefreshOpenDayModal();
  }
}

const PLANNER_GAS_POST_TIMEOUT_MS = 360000;
/** todo apply POST 분할 — 행 단위 */
const PLANNER_TODO_APPLY_BATCH_SIZE = 80;
/** apply(POST)만 — GAS ContentService 302 뒤 간헐 실패 시 추가 시도(총 1+N). 조회는 JSONP. */
const PLANNER_GAS_APPLY_MAX_RETRY = 2;

/**
 * HTTP 실패·비JSON 본문이 HTML이면 게이트에 구글 페이지 원문을 그대로 안 보여 줌.
 * @param {number} status
 * @param {string} text
 * @returns {string}
 */
function plannerGasHttpErrorMessage_(status, text) {
  const raw = String(text != null ? text : '');
  const looksHtml = /^\s*</.test(raw) || /<!DOCTYPE/i.test(raw) || /<html[\s>]/i.test(raw);
  if (status === 401) {
    return 'GAS Web App 401 — 배포「액세스: 누구나(익명)」+ Execute as Me + **새 버전** URL을 gasBaseUrl에 넣었는지 확인하세요. (Google 계정 필요/옛 배포 URL이면 401+CORS로 보입니다.)';
  }
  if (looksHtml && (status === 404 || status === 502 || status === 503 || status === 504)) {
    return (
      '서버 연결이 일시적으로 실패했습니다(HTTP ' +
      String(status) +
      '). 잠시 후 「확인」을 다시 눌러 주세요.'
    );
  }
  if (looksHtml) {
    return '서버 응답이 올바르지 않습니다(HTTP ' + String(status) + '). 잠시 후 다시 시도해 주세요.';
  }
  return 'HTTP ' + String(status) + (raw.length ? ': ' + raw.slice(0, 280) : '');
}

/**
 * 분할 apply 세션 id — GAS Cache 버퍼·멱등 재시도용.
 * @returns {string}
 */
function plannerNewApplySessionId_() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (_e) {}
  return 'as_' + String(Date.now()) + '_' + Math.random().toString(36).slice(2, 12);
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function plannerGasSleepMs_(ms) {
  return new Promise(function (resolve) {
    window.setTimeout(resolve, ms);
  });
}

/**
 * @param {Record<string, unknown>|null|undefined} result
 * @returns {boolean}
 */
function plannerGasPostResultShouldRetry_(result) {
  if (!result || typeof result !== 'object') {
    return true;
  }
  const err = result.error;
  if (!err || typeof err !== 'object') {
    return false;
  }
  const code = String(/** @type {{ code?: unknown }} */ (err).code != null ? /** @type {{ code?: unknown }} */ (err).code : '');
  if (code === 'NETWORK') {
    return true;
  }
  if (code === 'HTTP_404' || code === 'HTTP_502' || code === 'HTTP_503' || code === 'HTTP_504') {
    return true;
  }
  if (code === 'INVALID_RESPONSE') {
    return true;
  }
  return false;
}

/**
 * GAS Web App POST — 1회 시도.
 * @param {string} url
 * @param {Record<string, unknown>} bodyObj
 * @param {number} [timeoutMs]
 * @return {Promise<unknown>}
 */
async function plannerGasJsonPostOnce_(url, bodyObj, timeoutMs) {
  const lim = timeoutMs != null ? timeoutMs : PLANNER_GAS_POST_TIMEOUT_MS;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    ctrl &&
    window.setTimeout(function () {
      try {
        ctrl.abort();
      } catch (_e) {}
    }, lim);
  try {
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(bodyObj),
      credentials: 'omit',
      signal: ctrl ? ctrl.signal : undefined
    });
    const text = await res.text();
    if (!res.ok) {
      const code = res.status === 401 ? 'UNAUTHORIZED' : 'HTTP_' + String(res.status);
      return { ok: false, error: { code: code, message: plannerGasHttpErrorMessage_(res.status, text) } };
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (_e) {
      const looksHtml = /^\s*</.test(text) || /<!DOCTYPE/i.test(text) || /<html[\s>]/i.test(text);
      return {
        ok: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: looksHtml
            ? '서버 연결이 일시적으로 실패했습니다. 잠시 후 「확인」을 다시 눌러 주세요.'
            : 'JSON 파싱 실패(HTTP ' + String(res.status) + '): ' + text.slice(0, 400)
        }
      };
    }
    return data;
  } finally {
    if (timer) {
      window.clearTimeout(timer);
    }
  }
}

/**
 * GAS Web App POST — `maxRetry`>0 이면 간헐 404·NETWORK 등에서 재시도.
 * @param {string} url
 * @param {Record<string, unknown>} bodyObj
 * @param {number} [timeoutMs]
 * @param {number} [maxRetry]
 * @return {Promise<unknown>}
 */
async function plannerGasJsonPost_(url, bodyObj, timeoutMs, maxRetry) {
  const retries = maxRetry != null && maxRetry > 0 ? Math.floor(maxRetry) : 0;
  let last = null;
  let attempt;
  for (attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await plannerGasSleepMs_(800 * attempt);
    }
    try {
      last = await plannerGasJsonPostOnce_(url, bodyObj, timeoutMs);
    } catch (e) {
      if (attempt >= retries) {
        throw e;
      }
      last = {
        ok: false,
        error: {
          code: 'NETWORK',
          message: e && typeof e === 'object' && 'message' in e ? String(/** @type {{ message?: string }} */ (e).message) : String(e)
        }
      };
    }
    if (attempt >= retries || !plannerGasPostResultShouldRetry_(/** @type {Record<string, unknown>} */ (last))) {
      return last;
    }
  }
  return last;
}

/**
 * GAS JSONP는 `{ error: { message } }` 와 `{ error: 'X', message: '…' }` 를 섞어 쓴다. 플래너 UI는 여기서 통일한다.
 * @param {unknown} data
 * @return {Record<string, unknown>}
 */
function plannerGasNormalizeResult_(data) {
  if (data == null || typeof data !== 'object') {
    return {
      ok: false,
      error: { code: 'INVALID_RESPONSE', message: '서버 응답이 비어 있거나 JSON이 아닙니다. Executions·Network에서 script 응답을 확인하세요.' }
    };
  }
  const o = /** @type {Record<string, unknown>} */ (data);
  if (o.ok === true) {
    return o;
  }
  const err = o.error;
  let msg = '';
  let code = '';
  if (err != null && typeof err === 'object' && 'message' in err && (/** @type {{ message?: unknown }} */ (err).message != null)) {
    msg = String(/** @type {{ message?: unknown }} */ (err).message);
    code =
      'code' in err && (/** @type {{ code?: unknown }} */ (err).code != null)
        ? String(/** @type {{ code?: unknown }} */ (err).code)
        : '';
  } else if (typeof err === 'string') {
    code = err;
    msg = o.message != null ? String(o.message) : err;
  } else if (o.message != null) {
    msg = String(o.message);
  }
  if (!msg.length) {
    if (err === 'UNKNOWN_ACTION' || code === 'UNKNOWN_ACTION') {
      msg =
        '배포된 Web App에 이 action이 없습니다. clasp push 후 **새 버전으로 배포**했는지 확인하세요. (UNKNOWN_ACTION)';
    } else {
      try {
        msg = JSON.stringify(o).slice(0, 900);
      } catch (_e) {
        msg = 'ok=false 이지만 상세 메시지를 꺼내지 못했습니다.';
      }
    }
  }
  return { ok: false, error: { code: code || 'GAS_ERROR', message: msg } };
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {string[]}
 */
function plannerPhoneSegmentsFromPayload_(payload) {
  const segs = /** @type {unknown[]} */ (Array.isArray(payload.phoneSegments) ? payload.phoneSegments : []);
  return [
    String(segs[0] != null ? segs[0] : '').replace(/\D/g, ''),
    String(segs[1] != null ? segs[1] : '').replace(/\D/g, ''),
    String(segs[2] != null ? segs[2] : '').replace(/\D/g, '')
  ];
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {string}
 */
function plannerLinkKeyFromPayload_(payload) {
  return String(
    payload.memberCode != null
      ? payload.memberCode
      : payload.link_key != null
        ? payload.link_key
        : ''
  ).trim();
}

/**
 * `HttpOpenSync.js` `doPost` — JSON 본문 `action` + 필드 (`phoneSegments` 배열, `todos` 배열 등).
 * @param {string} url
 * @param {Record<string, unknown>} bodyObj
 * @param {{ maxRetry?: number }} [opts]
 * @return {Promise<Record<string, unknown>>}
 */
async function plannerGasPostAction_(url, bodyObj, opts) {
  const maxRetry = opts && opts.maxRetry != null ? opts.maxRetry : 0;
  try {
    const raw = await plannerGasJsonPost_(url, bodyObj, PLANNER_GAS_POST_TIMEOUT_MS, maxRetry);
    return plannerGasNormalizeResult_(raw);
  } catch (e) {
    const m = e && typeof e === 'object' && 'message' in e ? String(/** @type {{ message?: string }} */ (e).message) : String(e);
    return {
      ok: false,
      error: {
        code: 'NETWORK',
        message: m
      }
    };
  }
}

/**
 * 조회용 — `fetch` POST가 아니라 GET JSONP (대시보드·문서 §CORS 정본).
 * GAS ContentService는 `/exec` → googleusercontent 302가 필수인데, 브라우저 POST+follow가
 * 그 한 번짜리 URL에서 HTML 404를 간헐적으로 받는 게 게이트 `HTTP 404: <!DOCTYPE…docs.goo` 원인.
 * @param {string} url
 * @param {string} action
 * @param {Record<string, string>|null} extraParams
 * @returns {Promise<Record<string, unknown>>}
 */
async function plannerGasJsonpAction_(url, action, extraParams) {
  try {
    const raw = await plannerGasJsonpWithParams_(url, action, extraParams, PLANNER_GAS_POST_TIMEOUT_MS);
    return plannerGasNormalizeResult_(raw);
  } catch (e) {
    const m = e && typeof e === 'object' && 'message' in e ? String(/** @type {{ message?: string }} */ (e).message) : String(e);
    return {
      ok: false,
      error: {
        code: 'NETWORK',
        message: m === 'script error' ? '서버 스크립트 로드에 실패했습니다. 잠시 후 다시 시도해 주세요.' : m
      }
    };
  }
}

/**
 * 플래너 GAS — 조회는 JSONP, 큰 본문(apply·프로필)만 POST.
 * @param {Record<string, unknown>} payload
 * @return {Promise<Record<string, unknown>>}
 */
async function plannerGasCall_(payload) {
  const url = String(GAS_BASE_URL || '').trim();
  const action = String(payload.action != null ? payload.action : '');
  if (PLAN_DEMO.active) {
    return {
      ok: false,
      error: { code: 'PLAN_DEMO', message: '데모 화면에서는 서버 요청을 하지 않습니다.' }
    };
  }
  if (!url) {
    return { ok: false, error: { code: 'NO_GAS_URL', message: 'gasBaseUrl이 없습니다.' } };
  }
  if (
    action === 'plannerRegistryRebuild' ||
    action === 'plannerDevFullReset' ||
    action === 'initPlannerMasterSheets' ||
    action === 'plannerRegistryManualCreate'
  ) {
    if (action === 'plannerRegistryManualCreate') {
      return plannerGasPostAction_(url, {
        action: action,
        display_name: String(payload.display_name != null ? payload.display_name : ''),
        phoneSegments: plannerPhoneSegmentsFromPayload_(payload)
      });
    }
    return plannerGasPostAction_(url, { action: action });
  }
  if (action === 'plannerMatch' || action === 'plannerBootstrap') {
    const segs = plannerPhoneSegmentsFromPayload_(payload);
    /** @type {Record<string, string>} */
    const q = {
      p0: segs[0] || '',
      p1: segs[1] || '',
      p2: segs[2] || '',
      n: String(payload.name != null ? payload.name : '')
    };
    const lk = plannerLinkKeyFromPayload_(payload);
    if (lk.length) q.m = lk;
    const ym = String(payload.year_month != null ? payload.year_month : payload.yearMonth != null ? payload.yearMonth : '').trim();
    if (ym.length) q.year_month = ym;
    return plannerGasJsonpAction_(url, action, q);
  }
  if (action === 'plannerCurriculum') {
    return plannerGasJsonpAction_(url, action, null);
  }
  if (action === 'plannerAdminVerify') {
    return plannerGasJsonpAction_(url, action, {
      admin_secret: String(payload.admin_secret != null ? payload.admin_secret : '').trim()
    });
  }
  if (action === 'plannerRegistryProfileSave') {
    const prof =
      payload.student_profile != null && typeof payload.student_profile === 'object'
        ? payload.student_profile
        : {};
    const monthlyPatch =
      payload.monthly_plan_notices_patch != null && typeof payload.monthly_plan_notices_patch === 'object'
        ? payload.monthly_plan_notices_patch
        : {};
    return plannerGasPostAction_(url, {
      action: action,
      phoneSegments: plannerPhoneSegmentsFromPayload_(payload),
      name: String(payload.name != null ? payload.name : ''),
      memberCode: plannerLinkKeyFromPayload_(payload),
      link_key: plannerLinkKeyFromPayload_(payload),
      student_profile: prof,
      monthly_plan_notices_patch: monthlyPatch
    });
  }
  if (action === 'plannerPersonalTodosApply') {
    const ym = String(payload.year_month != null ? payload.year_month : payload.yearMonth != null ? payload.yearMonth : '').trim();
    const todos = Array.isArray(payload.todos) ? payload.todos : [];
    const body = {
      action: action,
      phoneSegments: plannerPhoneSegmentsFromPayload_(payload),
      name: String(payload.name != null ? payload.name : ''),
      memberCode: plannerLinkKeyFromPayload_(payload),
      link_key: plannerLinkKeyFromPayload_(payload),
      year_month: ym,
      todos: todos
    };
    if (payload.batch_index != null) {
      body.batch_index = payload.batch_index;
    }
    if (payload.batch_total != null) {
      body.batch_total = payload.batch_total;
    }
    if (payload.apply_session_id != null) {
      body.apply_session_id = payload.apply_session_id;
    }
    return plannerGasPostAction_(url, body, { maxRetry: PLANNER_GAS_APPLY_MAX_RETRY });
  }
  return { ok: false, error: { code: 'BAD_ACTION', message: '지원하지 않는 action: ' + action } };
}

/** 부트스트랩 `student_profile` / registry 저장에 쓰는 키 (`phone_display` 제외). */
const PLANNER_STUDENT_PROFILE_KEYS_FOR_SAVE = [
  'display_name',
  'track',
  'admission_type',
  'prev_university',
  'prev_major_gpa',
  'goal_university',
  'goal_department',
  'study_status'
];

/** 코칭·월별 안내 — registry JSON/텍스트 열 (관리자 전용 UI). */
const PLANNER_COACHING_PROFILE_KEYS_FOR_SAVE = ['plan_features', 'subject_guides_json', 'monthly_plan_notices_json'];

/** 전 학생 동일 — 학생 정보 탭 고정 안내 (DB 없음). */
const PLANNER_STATIC_MAJOR_NOTICE_HTML =
  '<div class="sp-plan-coaching__static">' +
  '<p class="sp-plan-coaching__staticLead"><strong>🔶 주요 안내사항</strong></p>' +
  '<ul class="sp-plan-coaching__staticList">' +
  '<li>일일학습 인증·솔루틴 매일학습지·카카오 채널 발송 등 운영 안내는 담당 코칭을 통해 안내됩니다.</li>' +
  '<li>학습 계획·과목별 상세·월별 안내는 아래 항목과 월간 플래너 상단에서 확인·관리합니다.</li>' +
  '<li>문의는 카카오톡 채널·홈페이지 일일학습 코칭 게시판을 이용해 주세요.</li>' +
  '</ul></div>';

/**
 * @param {string} s
 * @returns {string}
 */
function escAttr(s) {
  return String(s != null ? s : '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/** @param {unknown} v */
function plannerStudentFieldIsEmpty_(v) {
  return !String(v != null ? v : '').trim();
}

/**
 * @param {Record<string, unknown>|null|undefined} profile
 * @returns {Record<string, string>}
 */
/**
 * @param {unknown} raw
 * @returns {Record<string, string>}
 */
function plannerParseProfileJsonObject_(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    /** @type {Record<string, string>} */
    const outObj = {};
    Object.keys(/** @type {Record<string, unknown>} */ (raw)).forEach(function (k) {
      outObj[k] = raw[k] != null ? String(raw[k]) : '';
    });
    return outObj;
  }
  const s = String(raw != null ? raw : '').trim();
  if (!s.length) return {};
  try {
    const o = JSON.parse(s);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    /** @type {Record<string, string>} */
    const out = {};
    Object.keys(o).forEach(function (k) {
      out[k] = o[k] != null ? String(o[k]) : '';
    });
    return out;
  } catch (_e) {
    return {};
  }
}

/**
 * @param {Record<string, string>} obj
 * @returns {string}
 */
function plannerStringifyProfileJsonObject_(obj) {
  const o = obj && typeof obj === 'object' ? obj : {};
  /** @type {Record<string, string>} */
  const clean = {};
  Object.keys(o).forEach(function (k) {
    const key = String(k != null ? k : '').trim();
    if (!key.length) return;
    clean[key] = String(o[k] != null ? o[k] : '');
  });
  return JSON.stringify(clean);
}

function plannerNormalizeStudentProfileFromApi_(profile) {
  const o = profile && typeof profile === 'object' ? /** @type {Record<string, unknown>} */ (profile) : {};
  /** @type {Record<string, string>} */
  const out = { phone_display: '' };
  PLANNER_STUDENT_PROFILE_KEYS_FOR_SAVE.forEach(function (k) {
    out[k] = o[k] != null ? String(o[k]).trim() : '';
  });
  PLANNER_COACHING_PROFILE_KEYS_FOR_SAVE.forEach(function (k) {
    if (k === 'plan_features') {
      out[k] = o[k] != null ? String(o[k]) : '';
    } else {
      out[k] = plannerStringifyProfileJsonObject_(plannerParseProfileJsonObject_(o[k]));
    }
  });
  out.phone_display = o.phone_display != null ? String(o.phone_display).trim() : '';
  return out;
}

/**
 * @param {HTMLElement} root
 * @returns {boolean}
 */
function plannerStudentProfileIsMemberView_(root) {
  const st = root.__spPlanState;
  if (!st || typeof st !== 'object') return false;
  if (st.planGuestUnlockMock) return true;
  return st.role === 'member';
}

/**
 * 회원 화면에서 학생 정보 빈 칸 입력·저장 — 관리자 모드(암호 해제)일 때만.
 * @param {HTMLElement} root
 * @returns {boolean}
 */
function plannerStudentProfileCanEdit_(root) {
  return plannerStudentProfileIsMemberView_(root) && Boolean(root.__spPlanAdminMode);
}

/**
 * 월간 「일정 저장·삭제」·할 일 등록 POST — 관리자 모드(암호 해제)일 때만.
 * @param {HTMLElement} root
 * @returns {boolean}
 */
function plannerPlanAdminBulkScheduleAllowed_(root) {
  return Boolean(root.__spPlanAdminMode);
}

/**
 * 화면에서 실제로 고친 프로필 키만 모아 둔다. 재렌더·bootstrap이 이 키를 서버 값으로 덮지 않고,
 * 저장 페이로드에도 이 키만 실어 옛 화면이 다른 값을 지우지 못하게 한다.
 * @param {HTMLElement} root
 * @returns {Record<string, boolean>}
 */
function plannerProfileDirtyMap_(root) {
  if (!root.__spPlanProfileDirty || typeof root.__spPlanProfileDirty !== 'object') {
    root.__spPlanProfileDirty = {};
  }
  return /** @type {Record<string, boolean>} */ (root.__spPlanProfileDirty);
}

/**
 * @param {HTMLElement} root
 * @returns {Record<string, boolean>}
 */
function plannerMonthlyNoticeDirtyMap_(root) {
  if (!root.__spPlanMonthlyNoticesDirty || typeof root.__spPlanMonthlyNoticesDirty !== 'object') {
    root.__spPlanMonthlyNoticesDirty = {};
  }
  return /** @type {Record<string, boolean>} */ (root.__spPlanMonthlyNoticesDirty);
}

/** @param {HTMLElement} root */
function plannerClearProfileDirty_(root) {
  root.__spPlanProfileDirty = {};
  root.__spPlanMonthlyNoticesDirty = {};
}

/**
 * 학과·평점은 입력 두 칸이 `prev_major_gpa` 한 열로 합쳐진다.
 * @param {string} attrKey
 * @returns {string}
 */
function plannerProfileDirtyKeyFromInputAttr_(attrKey) {
  if (attrKey === 'prev_major' || attrKey === 'prev_major_gpa_only') return 'prev_major_gpa';
  return attrKey;
}

/**
 * 상담기록의 정본은 `__spPlanMonthlyNoticesInitial` — 입력 즉시 반영해야 달력 재렌더가 화면을 비우지 않는다.
 * @param {HTMLElement} root
 */
function wirePlannerProfileDirtyTrackingOnce_(root) {
  if (root.__spPlanProfileDirtyWired) return;
  root.__spPlanProfileDirtyWired = true;
  root.addEventListener('input', function (e) {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    if (t.id === 'sp-plan-monthly-notice-body') {
      plannerFlushMonthlyNoticeDraft_(root);
      const st = root.__spPlanState;
      const vm =
        st && st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime()) ? st.viewMonth : new Date();
      plannerMonthlyNoticeDirtyMap_(root)[plannerYearMonthFromDate_(vm)] = true;
      return;
    }
    if (t.id === 'sp-plan-coaching-features') {
      plannerProfileDirtyMap_(root).plan_features = true;
      return;
    }
    if (t.hasAttribute('data-sp-plan-subject-key') || t.hasAttribute('data-sp-plan-subject-body')) {
      plannerProfileDirtyMap_(root).subject_guides_json = true;
      return;
    }
    const stuKey = t.getAttribute('data-sp-plan-student-input');
    if (stuKey) {
      plannerProfileDirtyMap_(root)[plannerProfileDirtyKeyFromInputAttr_(stuKey)] = true;
    }
  });
}

/**
 * 고친 프로필 키 + 고친 달 상담기록만 담은 저장 페이로드.
 * @param {HTMLElement} root
 * @returns {{ profile: Record<string, string>, monthly_patch: Record<string, string> }}
 */
function plannerCollectStudentProfilePayloadForSave_(root) {
  const dirty = plannerProfileDirtyMap_(root);
  const tbody = root.querySelector('#sp-plan-student-tbody');
  /** @type {Record<string, string>} */
  const profile = {};
  PLANNER_STUDENT_PROFILE_KEYS_FOR_SAVE.forEach(function (k) {
    if (k === 'prev_major_gpa') return;
    if (!dirty[k] || !tbody) return;
    const inp = tbody.querySelector('[data-sp-plan-student-input="' + escAttr(k) + '"]');
    if (!inp || !('value' in inp)) return;
    profile[k] = String(/** @type {HTMLInputElement | HTMLTextAreaElement} */ (inp).value).trim();
  });
  if (dirty.prev_major_gpa && tbody) {
    const majorInp = tbody.querySelector('[data-sp-plan-student-input="prev_major"]');
    const gpaInp = tbody.querySelector('[data-sp-plan-student-input="prev_major_gpa_only"]');
    if (majorInp || gpaInp) {
      const major =
        majorInp && 'value' in majorInp
          ? String(/** @type {HTMLInputElement} */ (majorInp).value).trim()
          : '';
      const gpa =
        gpaInp && 'value' in gpaInp
          ? String(/** @type {HTMLInputElement} */ (gpaInp).value).trim()
          : '';
      profile.prev_major_gpa = plannerComposePrevMajorGpa_(major, gpa);
    } else {
      const legacy = tbody.querySelector('[data-sp-plan-student-input="prev_major_gpa"]');
      if (legacy && 'value' in legacy) {
        profile.prev_major_gpa = String(/** @type {HTMLInputElement} */ (legacy).value).trim();
      }
    }
  }
  const featEl = root.querySelector('#sp-plan-coaching-features');
  if (dirty.plan_features && featEl && 'value' in featEl) {
    profile.plan_features = String(/** @type {HTMLTextAreaElement} */ (featEl).value);
  }
  const subjBody = root.querySelector('#sp-plan-coaching-subjects-body');
  if (dirty.subject_guides_json && subjBody) {
    /** @type {Record<string, string>} */
    const subjects = {};
    subjBody.querySelectorAll('[data-sp-plan-subject-row]').forEach(function (rowEl) {
      if (!(rowEl instanceof HTMLElement)) return;
      const subInp = rowEl.querySelector('[data-sp-plan-subject-key]');
      const bodyInp = rowEl.querySelector('[data-sp-plan-subject-body]');
      const sk =
        subInp && 'value' in subInp ? String(/** @type {HTMLInputElement} */ (subInp).value).trim() : '';
      if (!sk.length) return;
      const bv =
        bodyInp && 'value' in bodyInp ? String(/** @type {HTMLTextAreaElement} */ (bodyInp).value) : '';
      subjects[sk] = bv;
    });
    profile.subject_guides_json = plannerStringifyProfileJsonObject_(subjects);
  }
  const monthlyMap =
    root.__spPlanMonthlyNoticesInitial && typeof root.__spPlanMonthlyNoticesInitial === 'object'
      ? /** @type {Record<string, string>} */ (root.__spPlanMonthlyNoticesInitial)
      : {};
  const monthlyDirty = plannerMonthlyNoticeDirtyMap_(root);
  /** @type {Record<string, string>} */
  const monthlyPatch = {};
  Object.keys(monthlyDirty).forEach(function (ym) {
    if (!monthlyDirty[ym]) return;
    monthlyPatch[ym] = monthlyMap[ym] != null ? String(monthlyMap[ym]) : '';
  });
  return { profile: profile, monthly_patch: monthlyPatch };
}

/**
 * 코칭·월별 안내 — 회원은 조회, 관리자 모드에서만 입력·저장 UI.
 * @param {HTMLElement} root
 */
function plannerSyncCoachingReadOnlyState_(root) {
  const canEdit = plannerStudentProfileCanEdit_(root);
  const coaching = root.querySelector('#sp-plan-coaching');
  if (coaching) {
    coaching.classList.toggle('is-coaching-readonly', !canEdit);
  }
  const monthly = root.querySelector('#sp-plan-monthly-notice');
  if (monthly) {
    monthly.classList.toggle('is-readonly', !canEdit);
  }
  const featEl = root.querySelector('#sp-plan-coaching-features');
  if (featEl instanceof HTMLTextAreaElement) {
    featEl.readOnly = !canEdit;
    if (canEdit) featEl.removeAttribute('aria-readonly');
    else featEl.setAttribute('aria-readonly', 'true');
  }
  const monEl = root.querySelector('#sp-plan-monthly-notice-body');
  if (monEl instanceof HTMLTextAreaElement) {
    monEl.readOnly = !canEdit;
    if (canEdit) monEl.removeAttribute('aria-readonly');
    else monEl.setAttribute('aria-readonly', 'true');
  }
  const monHint = root.querySelector('.sp-plan-monthlyNotice__hint');
  if (monHint) {
    if (canEdit) monHint.removeAttribute('hidden');
    else monHint.setAttribute('hidden', 'hidden');
  }
}

/**
 * @param {HTMLElement} root
 * @param {Record<string, unknown>|null|undefined} profile
 */
function renderPlannerCoachingBlocks_(root, profile) {
  const wrap = root.querySelector('#sp-plan-coaching');
  if (!wrap) return;
  const canEdit = plannerStudentProfileCanEdit_(root);
  const p = plannerNormalizeStudentProfileFromApi_(profile);
  const staticEl = wrap.querySelector('#sp-plan-coaching-static');
  if (staticEl) staticEl.innerHTML = PLANNER_STATIC_MAJOR_NOTICE_HTML;
  const name = p.display_name && p.display_name.length ? p.display_name : '학생';
  const featTitle = wrap.querySelector('#sp-plan-coaching-features-title');
  if (featTitle) featTitle.textContent = name + '님 계획표 특징';
  const dirty = plannerProfileDirtyMap_(root);
  const featEl = wrap.querySelector('#sp-plan-coaching-features');
  if (featEl && 'value' in featEl && !dirty.plan_features) {
    /** @type {HTMLTextAreaElement} */ (featEl).value = p.plan_features || '';
  }
  const serverMonthly = plannerParseProfileJsonObject_(p.monthly_plan_notices_json);
  const prevMonthly =
    root.__spPlanMonthlyNoticesInitial && typeof root.__spPlanMonthlyNoticesInitial === 'object'
      ? /** @type {Record<string, string>} */ (root.__spPlanMonthlyNoticesInitial)
      : null;
  if (prevMonthly) {
    const monthlyDirty = plannerMonthlyNoticeDirtyMap_(root);
    Object.keys(monthlyDirty).forEach(function (ym) {
      if (!monthlyDirty[ym]) return;
      serverMonthly[ym] = prevMonthly[ym] != null ? String(prevMonthly[ym]) : '';
    });
  }
  root.__spPlanMonthlyNoticesInitial = serverMonthly;
  const subjObj = plannerParseProfileJsonObject_(p.subject_guides_json);
  const subjBody = dirty.subject_guides_json ? null : wrap.querySelector('#sp-plan-coaching-subjects-body');
  if (subjBody) {
    const keys = Object.keys(subjObj);
    let h = '';
    if (canEdit) {
      if (!keys.length) {
        h += plannerCoachingSubjectRowHtml_('', '');
      } else {
        keys.forEach(function (k) {
          h += plannerCoachingSubjectRowHtml_(k, subjObj[k] || '');
        });
      }
    } else if (!keys.length) {
      h =
        '<tr><td colspan="2" class="sp-plan-coaching__subjEmpty" role="cell">등록된 과목별 안내가 없습니다.</td></tr>';
      root.__spPlanCoachingSubjReadList = [];
    } else {
      /** @type {{ subject: string, body: string }[]} */
      const readList = [];
      const planMobile = plannerIsPlanMobile_(root);
      keys.forEach(function (k, idx) {
        readList.push({ subject: k, body: subjObj[k] || '' });
        h += plannerCoachingSubjectRowReadHtml_(k, subjObj[k] || '', idx, planMobile);
      });
      root.__spPlanCoachingSubjReadList = readList;
    }
    subjBody.innerHTML = h;
  }
  plannerRefreshMonthlyNotice_(root);
  plannerSyncCoachingReadOnlyState_(root);
}

/**
 * @param {string} subject
 * @param {string} body
 * @param {number} readIdx
 * @param {boolean} [mobilePreview] 모바일일 때만 미리보기·「전체 보기」
 * @returns {string}
 */
function plannerCoachingSubjectRowReadHtml_(subject, body, readIdx, mobilePreview) {
  const sk = String(subject != null ? subject : '').trim();
  const bv = String(body != null ? body : '').trim();
  if (!sk.length && !bv.length) return '';
  const prev = mobilePreview ? plannerCoachingSubjectPreviewText_(bv) : { preview: bv, truncated: false };
  let bodyCell;
  if (prev.truncated && bv.length) {
    bodyCell =
      '<td class="sp-plan-coaching__subjBodyRead sp-plan-coaching__subjBodyRead--preview">' +
      '<p class="sp-plan-coaching__subjPreview">' +
      esc(prev.preview) +
      '</p>' +
      '<button type="button" class="btn btn--ghost sp-plan-coaching__subjMore" data-sp-coaching-subj-open data-sp-coaching-subj-idx="' +
      String(readIdx) +
      '">전체 보기</button>' +
      '</td>';
  } else {
    bodyCell =
      '<td class="sp-plan-coaching__subjBodyRead">' + esc(bv.length ? bv : '—') + '</td>';
  }
  return (
    '<tr data-sp-plan-subject-row>' +
    '<th scope="row" class="sp-plan-coaching__subjKeyRead">' +
    esc(sk.length ? sk : '—') +
    '</th>' +
    bodyCell +
    '</tr>'
  );
}

/**
 * @param {string} subject
 * @param {string} body
 * @returns {string}
 */
function plannerCoachingSubjectRowHtml_(subject, body) {
  return (
    '<tr data-sp-plan-subject-row>' +
    '<td class="sp-plan-coaching__subjKey"><input type="text" class="sp-plan-coaching__input" data-sp-plan-subject-key value="' +
    escAttr(subject) +
    '" maxlength="200" placeholder="예: ✔️ [어휘]" autocomplete="off" spellcheck="true"/></td>' +
    '<td class="sp-plan-coaching__subjBody"><textarea class="sp-plan-coaching__textarea" data-sp-plan-subject-body rows="4" maxlength="8000" spellcheck="true">' +
    esc(body) +
    '</textarea></td>' +
    '<td class="sp-plan-coaching__subjAct"><button type="button" class="btn btn--ghost sp-plan-coaching__rowDel" data-sp-plan-subject-del title="행 삭제">삭제</button></td>' +
    '</tr>'
  );
}

/**
 * 월별 안내 textarea → 메모리 드래프트 (`viewMonth` 기준).
 * @param {HTMLElement} root
 */
function plannerFlushMonthlyNoticeDraft_(root) {
  const st = root.__spPlanState;
  if (!st || !(st.viewMonth instanceof Date) || isNaN(st.viewMonth.getTime())) return;
  const ymKey = plannerYearMonthFromDate_(st.viewMonth);
  const bodyEl = root.querySelector('#sp-plan-monthly-notice-body');
  if (!bodyEl || !('value' in bodyEl)) return;
  if (!root.__spPlanMonthlyNoticesInitial || typeof root.__spPlanMonthlyNoticesInitial !== 'object') {
    root.__spPlanMonthlyNoticesInitial = {};
  }
  root.__spPlanMonthlyNoticesInitial[ymKey] = String(/** @type {HTMLTextAreaElement} */ (bodyEl).value);
}

/**
 * 월간 플래너 상단 — `viewMonth`와 동기.
 * @param {HTMLElement} root
 */
function plannerRefreshMonthlyNotice_(root) {
  const block = root.querySelector('#sp-plan-monthly-notice');
  if (!block) return;
  const st = root.__spPlanState;
  const vm =
    st && st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime()) ? st.viewMonth : new Date();
  const ymKey = plannerYearMonthFromDate_(vm);
  const titleEl = block.querySelector('#sp-plan-monthly-notice-title');
  if (titleEl) {
    titleEl.textContent = String(vm.getMonth() + 1) + '월 상담기록';
  }
  const monthly =
    root.__spPlanMonthlyNoticesInitial && typeof root.__spPlanMonthlyNoticesInitial === 'object'
      ? root.__spPlanMonthlyNoticesInitial
      : {};
  const bodyEl = block.querySelector('#sp-plan-monthly-notice-body');
  if (bodyEl && 'value' in bodyEl) {
    const cur = monthly[ymKey] != null ? String(monthly[ymKey]) : '';
    /** @type {HTMLTextAreaElement} */ (bodyEl).value = cur;
  }
  const emptyEl = block.querySelector('#sp-plan-monthly-notice-empty');
  if (emptyEl) {
    const has = monthly[ymKey] != null && String(monthly[ymKey]).trim().length > 0;
    if (plannerStudentProfileCanEdit_(root)) {
      emptyEl.setAttribute('hidden', 'hidden');
    } else if (!has) {
      emptyEl.removeAttribute('hidden');
    } else {
      emptyEl.setAttribute('hidden', 'hidden');
    }
  }
  plannerSyncCoachingReadOnlyState_(root);
}

/**
 * @param {HTMLElement} root
 */
function wirePlannerMainTabsOnce_(root) {
  if (root.__spPlanMainTabsWired) return;
  root.__spPlanMainTabsWired = true;
  const tabStudent = root.querySelector('#sp-plan-tab-btn-student');
  const tabMonthly = root.querySelector('#sp-plan-tab-btn-monthly');
  const panelStudent = root.querySelector('#sp-plan-tab-student');
  const panelMonthly = root.querySelector('#sp-plan-tab-monthly');

  /**
   * @param {'student'|'monthly'} which
   */
  function showTab(which) {
    root.__spPlanActiveTab = which;
    if (tabStudent) {
      const on = which === 'student';
      tabStudent.classList.toggle('is-active', on);
      tabStudent.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    if (tabMonthly) {
      const on = which === 'monthly';
      tabMonthly.classList.toggle('is-active', on);
      tabMonthly.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    if (panelStudent) {
      if (which === 'student') {
        panelStudent.removeAttribute('hidden');
        panelStudent.removeAttribute('aria-hidden');
      } else {
        panelStudent.setAttribute('hidden', 'hidden');
        panelStudent.setAttribute('aria-hidden', 'true');
      }
    }
    if (panelMonthly) {
      if (which === 'monthly') {
        panelMonthly.removeAttribute('hidden');
        panelMonthly.removeAttribute('aria-hidden');
      } else {
        panelMonthly.setAttribute('hidden', 'hidden');
        panelMonthly.setAttribute('aria-hidden', 'true');
      }
    }
  }

  root.__spPlanShowMainTab = showTab;
  if (tabStudent) {
    tabStudent.addEventListener('click', function () {
      showTab('student');
    });
  }
  if (tabMonthly) {
    tabMonthly.addEventListener('click', function () {
      showTab('monthly');
    });
  }
  if (PLAN_DEMO.active || root.classList.contains('is-plan-demo')) {
    plannerApplyPlanDemoSinglePageLayout_(root);
  } else {
    showTab(root.__spPlanActiveTab === 'monthly' ? 'monthly' : 'student');
  }

  root.addEventListener('click', function (e) {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t || !root.__spPlanAdminMode) return;
    const addBtn = t.id === 'sp-plan-coaching-subject-add' ? t : t.closest ? t.closest('#sp-plan-coaching-subject-add') : null;
    if (addBtn) {
      e.preventDefault();
      const tbody = root.querySelector('#sp-plan-coaching-subjects-body');
      if (tbody) {
        tbody.insertAdjacentHTML('beforeend', plannerCoachingSubjectRowHtml_('', ''));
        plannerProfileDirtyMap_(root).subject_guides_json = true;
      }
      return;
    }
    const delBtn = t.closest ? t.closest('[data-sp-plan-subject-del]') : null;
    if (delBtn) {
      e.preventDefault();
      const row = delBtn.closest('[data-sp-plan-subject-row]');
      const tbody = root.querySelector('#sp-plan-coaching-subjects-body');
      if (row && tbody) {
        row.remove();
        plannerProfileDirtyMap_(root).subject_guides_json = true;
        if (!tbody.querySelector('[data-sp-plan-subject-row]')) {
          tbody.insertAdjacentHTML('beforeend', plannerCoachingSubjectRowHtml_('', ''));
        }
      }
    }
  });
}

/**
 * @param {HTMLElement} root
 * @param {{ msgEl?: HTMLElement|null, partOfDual?: boolean }} [opts]
 * @returns {Promise<boolean>}
 */
async function plannerStudentProfileSaveClick_(root, opts) {
  const partOfDual = Boolean(opts && opts.partOfDual);
  const msgEl =
    (opts && opts.msgEl) ||
    root.querySelector('#sp-plan-student-save-msg');
  const ctx = root.__spPlannerBootstrapCtx;
  const st = root.__spPlanState;
  if (!ctx || !st || !plannerStudentProfileCanEdit_(root)) {
    if (msgEl && !partOfDual) {
      msgEl.textContent = '저장할 수 없습니다.';
      msgEl.removeAttribute('hidden');
    }
    return false;
  }
  const payload = plannerCollectStudentProfilePayloadForSave_(root);
  const hasProfileChange = Object.keys(payload.profile).length > 0;
  const hasMonthlyChange = Object.keys(payload.monthly_patch).length > 0;
  if (!hasProfileChange && !hasMonthlyChange) {
    if (msgEl && !partOfDual) {
      msgEl.textContent = '변경된 내용이 없습니다.';
      msgEl.removeAttribute('hidden');
      window.setTimeout(function () {
        msgEl.setAttribute('hidden', 'hidden');
      }, 2200);
    }
    return true;
  }
  if (msgEl && !partOfDual) {
    msgEl.textContent = '저장 중…';
    msgEl.removeAttribute('hidden');
  }
  const res = await plannerGasCall_({
    action: 'plannerRegistryProfileSave',
    phoneSegments: ctx.phoneSegments,
    name: ctx.name || '',
    memberCode: ctx.memberCode || '',
    student_profile: payload.profile,
    monthly_plan_notices_patch: payload.monthly_patch
  });
  if (!res || !res.ok) {
    if (msgEl && !partOfDual) {
      const m = res && res.error && res.error.message != null ? String(res.error.message) : '저장에 실패했습니다.';
      msgEl.textContent = m;
    }
    return false;
  }
  plannerClearProfileDirty_(root);
  const ymDate = st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime()) ? st.viewMonth : new Date();
  const boot = await plannerGasCall_({
    action: 'plannerBootstrap',
    phoneSegments: ctx.phoneSegments,
    name: ctx.name || '',
    memberCode: ctx.memberCode || '',
    year_month: plannerYearMonthFromDate_(ymDate)
  });
  if (boot && boot.ok && boot.data) {
    const d = /** @type {{ student_profile?: Record<string, unknown> }} */ (boot.data);
    renderPlannerStudentProfile_(root, d.student_profile);
    renderPlannerCoachingBlocks_(root, d.student_profile);
    if (msgEl && !partOfDual) {
      msgEl.textContent = '저장했습니다.';
      window.setTimeout(function () {
        msgEl.setAttribute('hidden', 'hidden');
      }, 2200);
    }
    return true;
  }
  if (msgEl && !partOfDual) {
    msgEl.textContent = '저장은 반영되었을 수 있습니다. 달력 월을 한 번 바꿔 새로고침해 보세요.';
  }
  return true;
}

/**
 * 관리자 모드 — 프로필·코칭 저장과 일정 저장을 한 번에(순서: 프로필 → 일정).
 * @param {HTMLElement} root
 * @param {{ msgEl?: HTMLElement|null, requireAdmin?: boolean, fromProfile?: boolean }} [opts]
 */
async function plannerAdminDualSaveClick_(root, opts) {
  opts = opts || {};
  const isAdmin = Boolean(root.__spPlanAdminMode);
  if (!isAdmin) {
    if (opts.fromProfile) {
      void plannerStudentProfileSaveClick_(root, { msgEl: opts.msgEl });
      return;
    }
    void plannerPersonalTodosApplyClick_(root, opts);
    return;
  }

  const msgEl =
    opts.msgEl ||
    root.querySelector('#sp-plan-student-save-msg') ||
    root.querySelector('#sp-plan-todos-apply-msg') ||
    root.querySelector('#sp-plan-month-apply-msg') ||
    root.querySelector('#sp-plan-day-apply-msg');

  if (root.__spPlanAdminDualSaveInFlight) {
    if (msgEl) {
      msgEl.textContent = '저장 중입니다. 잠시만 기다려 주세요.';
      msgEl.removeAttribute('hidden');
    }
    return;
  }
  root.__spPlanAdminDualSaveInFlight = true;
  try {
    if (msgEl) {
      msgEl.textContent = '저장 중…';
      msgEl.removeAttribute('hidden');
    }

    let profileOk = true;
    const profileSkipped = !plannerStudentProfileCanEdit_(root);
    if (!profileSkipped) {
      profileOk = await plannerStudentProfileSaveClick_(root, { partOfDual: true });
    }

    const todosOk = await plannerPersonalTodosApplyClick_(root, {
      msgEl: msgEl,
      requireAdmin: opts.requireAdmin,
      partOfDual: true,
      skipInFlightCheck: true
    });

    if (!msgEl) return;

    if (profileSkipped) {
      if (todosOk) {
        msgEl.textContent = '저장했습니다.';
        window.setTimeout(function () {
          msgEl.setAttribute('hidden', 'hidden');
        }, 2200);
      } else {
        msgEl.textContent =
          '일정 저장에 실패했습니다. 화면 데이터는 그대로입니다. 다시 저장해 주세요.';
      }
      return;
    }

    if (profileOk && todosOk) {
      msgEl.textContent = '프로필·코칭·일정을 저장했습니다.';
      window.setTimeout(function () {
        msgEl.setAttribute('hidden', 'hidden');
      }, 2200);
      return;
    }
    if (profileOk && !todosOk) {
      msgEl.textContent =
        '프로필·코칭은 저장됐으나 일정 저장에 실패했습니다. 화면 데이터는 그대로입니다. 다시 저장해 주세요.';
      return;
    }
    if (!profileOk && todosOk) {
      msgEl.textContent = '일정은 저장됐으나 프로필·코칭 저장에 실패했습니다. 다시 저장해 주세요.';
      return;
    }
    msgEl.textContent = '저장에 실패했습니다. 다시 저장해 주세요.';
  } finally {
    root.__spPlanAdminDualSaveInFlight = false;
  }
}

function wirePlannerStudentProfileSaveOnce_(root) {
  if (root.__spPlanStudentSaveWired) return;
  root.__spPlanStudentSaveWired = true;
  root.addEventListener('click', function (e) {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    const btn = t.id === 'sp-plan-student-save' ? t : t.closest ? t.closest('#sp-plan-student-save') : null;
    if (!btn) return;
    e.preventDefault();
    void plannerAdminDualSaveClick_(root, { fromProfile: true, msgEl: root.querySelector('#sp-plan-student-save-msg') });
  });
}

/**
 * @param {HTMLElement} root
 * @param {string[]} rawSegs
 * @returns {string[]}
 */
function plannerReadPhoneSegments_(rawSegs) {
  return (rawSegs || []).map(function (s) {
    return String(s != null ? s : '').replace(/\D/g, '');
  });
}

/**
 * @param {HTMLElement} root
 */
async function plannerManualRegSubmitClick_(root) {
  if (!root.__spPlanAdminMode) return;
  const nameEl = /** @type {HTMLInputElement | null} */ (root.querySelector('#sp-manual-reg-name'));
  const p0 = /** @type {HTMLInputElement | null} */ (root.querySelector('#sp-manual-reg-p0'));
  const p1 = /** @type {HTMLInputElement | null} */ (root.querySelector('#sp-manual-reg-p1'));
  const p2 = /** @type {HTMLInputElement | null} */ (root.querySelector('#sp-manual-reg-p2'));
  const msgEl = root.querySelector('#sp-manual-reg-msg');
  const btn = root.querySelector('#sp-manual-reg-submit');
  const displayName = nameEl ? String(nameEl.value || '').trim() : '';
  const segs = plannerReadPhoneSegments_([p0 && p0.value, p1 && p1.value, p2 && p2.value]);
  if (!displayName.length) {
    if (msgEl) {
      msgEl.textContent = '학생 이름을 입력해 주세요.';
      msgEl.removeAttribute('hidden');
    }
    if (nameEl) nameEl.focus();
    return;
  }
  if (segs[0].length !== 3 || segs[1].length !== 4 || segs[2].length !== 4) {
    if (msgEl) {
      msgEl.textContent = '휴대전화를 11자리(앞 3 · 가운데 4 · 끝 4) 숫자로 입력해 주세요.';
      msgEl.removeAttribute('hidden');
    }
    if (p0 && segs[0].length < 3) p0.focus();
    else if (p1 && segs[1].length < 4) p1.focus();
    else if (p2) p2.focus();
    return;
  }
  if (btn instanceof HTMLButtonElement) {
    btn.disabled = true;
  }
  if (msgEl) {
    msgEl.textContent = '등록 중…';
    msgEl.removeAttribute('hidden');
  }
  try {
    const res = await plannerGasCall_({
      action: 'plannerRegistryManualCreate',
      display_name: displayName,
      phoneSegments: segs
    });
    if (!res || !res.ok) {
      const m =
        res && res.error && res.error.message != null ? String(res.error.message) : '학생 수기 등록에 실패했습니다.';
      if (msgEl) msgEl.textContent = m;
      return;
    }
    const d = /** @type {{ member_code?: string, duplicate_phone_count?: number }} */ (res.data || {});
    const mc = d.member_code != null ? String(d.member_code) : '';
    let okMsg = '등록했습니다.';
    if (mc.length) okMsg += ' (코드: ' + mc + ')';
    if (Number(d.duplicate_phone_count) > 0) {
      okMsg += ' 같은 번호가 이미 ' + String(d.duplicate_phone_count) + '명 있어, 게이트에서 이름 확인이 필요할 수 있습니다.';
    }
    if (msgEl) msgEl.textContent = okMsg;
    if (nameEl) nameEl.value = '';
    if (p0) p0.value = '';
    if (p1) p1.value = '';
    if (p2) p2.value = '';
  } finally {
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = false;
    }
  }
}

function wirePlannerManualRegOnce_(root) {
  if (root.__spPlanManualRegWired) return;
  root.__spPlanManualRegWired = true;
  plannerWirePhoneSegInputs_(
    /** @type {HTMLInputElement} */ (root.querySelector('#sp-manual-reg-p0')),
    /** @type {HTMLInputElement} */ (root.querySelector('#sp-manual-reg-p1')),
    /** @type {HTMLInputElement} */ (root.querySelector('#sp-manual-reg-p2'))
  );
  root.addEventListener('click', function (e) {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    const btn = t.id === 'sp-manual-reg-submit' ? t : t.closest ? t.closest('#sp-manual-reg-submit') : null;
    if (!btn) return;
    e.preventDefault();
    void plannerManualRegSubmitClick_(root);
  });
}

const PLANNER_PDF_LIB_HTML2CANVAS = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
const PLANNER_PDF_LIB_JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';

/**
 * @param {string} src
 * @returns {Promise<void>}
 */
function plannerLoadScriptOnce_(src) {
  return new Promise(function (resolve, reject) {
    const prev = document.querySelector('script[data-sp-plan-pdf-src="' + src + '"]');
    if (prev) {
      if (prev.getAttribute('data-sp-plan-pdf-ready') === '1') {
        resolve();
        return;
      }
      prev.addEventListener('load', function () {
        resolve();
      });
      prev.addEventListener('error', function () {
        reject(new Error('script load failed'));
      });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.setAttribute('data-sp-plan-pdf-src', src);
    s.onload = function () {
      s.setAttribute('data-sp-plan-pdf-ready', '1');
      resolve();
    };
    s.onerror = function () {
      reject(new Error('script load failed'));
    };
    document.head.appendChild(s);
  });
}

/**
 * @returns {Promise<void>}
 */
async function plannerEnsurePdfLibs_() {
  await plannerLoadScriptOnce_(PLANNER_PDF_LIB_HTML2CANVAS);
  await plannerLoadScriptOnce_(PLANNER_PDF_LIB_JSPDF);
  if (typeof globalThis.html2canvas !== 'function') {
    throw new Error('html2canvas unavailable');
  }
  const jspdfNs = globalThis.jspdf;
  if (!jspdfNs || typeof jspdfNs.jsPDF !== 'function') {
    throw new Error('jsPDF unavailable');
  }
}

/**
 * @param {HTMLTableCellElement|null} td
 * @returns {string}
 */
function plannerStudentProfileCellTextForExport_(td) {
  if (!td) return '—';
  const inp = td.querySelector('input, textarea');
  if (inp && 'value' in inp) {
    const v = String(/** @type {HTMLInputElement | HTMLTextAreaElement} */ (inp).value).trim();
    return v.length ? v : '—';
  }
  const t = String(td.textContent || '').trim();
  return t.length ? t : '—';
}

/**
 * PDF/PNG 파일명 베이스 (`솔패스플래너-…`).
 * @param {HTMLElement} root
 * @returns {string}
 */
function plannerExportDownloadBasename_(root) {
  const st = root.__spPlanState;
  const tbody = root.querySelector('#sp-plan-student-tbody');
  let name = '';
  if (tbody) {
    const nameInp = tbody.querySelector('[data-sp-plan-student-input="display_name"]');
    if (nameInp && 'value' in nameInp) {
      name = String(/** @type {HTMLInputElement} */ (nameInp).value || '').trim();
    } else {
      const nameTd = tbody.querySelector('[data-sp-plan-student="display_name"]');
      if (nameTd) name = plannerStudentProfileCellTextForExport_(/** @type {HTMLTableCellElement} */ (nameTd));
    }
  }
  if (!name || name === '—') name = '플래너';
  let ymLabel = '';
  if (st && st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime())) {
    ymLabel = st.viewMonth.getFullYear() + '년' + (st.viewMonth.getMonth() + 1) + '월';
  }
  const base = '솔패스플래너-' + ymLabel + '-' + name;
  return base.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
}

/**
 * @param {HTMLElement} root
 * @param {string} ext `.pdf` | `.png`
 * @returns {string}
 */
function plannerExportDownloadFilename_(root, ext) {
  const base = plannerExportDownloadBasename_(root);
  const e = String(ext || '.pdf');
  return base + (e.charAt(0) === '.' ? e : '.' + e);
}

/**
 * PDF clone — 입력·버튼을 인쇄용 정적 텍스트로 바꿈.
 * @param {HTMLElement} container
 */
function plannerPdfReplaceFormControlsWithText_(container) {
  container.querySelectorAll('textarea').forEach(function (ta) {
    if (!(ta instanceof HTMLTextAreaElement)) return;
    const div = document.createElement('div');
    div.className = 'sp-plan-pdf-printText';
    div.textContent = ta.value;
    ta.parentNode.replaceChild(div, ta);
  });
  container.querySelectorAll('input[type="text"]').forEach(function (inp) {
    if (!(inp instanceof HTMLInputElement)) return;
    const span = document.createElement('span');
    span.className = 'sp-plan-pdf-printText';
    span.textContent = inp.value;
    inp.parentNode.replaceChild(span, inp);
  });
}

/**
 * PDF — 모바일 「전체 보기」 잘림 없이 과목별 본문 전체 표시.
 * @param {HTMLElement} clone
 * @param {HTMLElement} root
 */
function plannerPdfExpandCoachingSubjectsIn_(clone, root) {
  const list = root.__spPlanCoachingSubjReadList;
  if (!Array.isArray(list) || !list.length) return;
  const rows = clone.querySelectorAll('[data-sp-coaching-subj-open]');
  rows.forEach(function (btn) {
    if (!(btn instanceof HTMLElement)) return;
    const idx = Number(btn.getAttribute('data-sp-coaching-subj-idx'));
    const item = list[idx];
    const td = btn.closest('td');
    if (!td || !item) return;
    td.className = 'sp-plan-coaching__subjBodyRead';
    td.textContent = String(item.body != null ? item.body : '').trim() || '—';
  });
}

/**
 * PDF — 달력 칸은 `<button.sp-plan-day>` 인데, sanitize에서 button 전부 제거 시 칸이 통째로 사라짐 → div로 치환.
 * @param {HTMLElement} clone
 */
function plannerPdfUnbuttonCalendarDays_(clone) {
  clone.querySelectorAll('button.sp-plan-day').forEach(function (btn) {
    if (!(btn instanceof HTMLButtonElement)) return;
    const div = document.createElement('div');
    div.className = btn.className;
    Array.from(btn.attributes).forEach(function (attr) {
      const n = attr.name;
      if (n === 'type' || n === 'disabled') return;
      div.setAttribute(n, attr.value);
    });
    div.innerHTML = btn.innerHTML;
    btn.parentNode.replaceChild(div, btn);
  });
}

/**
 * PDF 캡처 clone — 관리·등록 UI 제거, hidden 해제.
 * @param {HTMLElement} clone
 * @param {HTMLElement} root
 * @param {'student'|'monthly'} which
 */
function plannerPdfSanitizePanelClone_(clone, root, which) {
  clone.removeAttribute('hidden');
  clone.removeAttribute('aria-hidden');
  clone.classList.remove('sp-plan-tabPanel');
  const rm = function (sel) {
    clone.querySelectorAll(sel).forEach(function (el) {
      el.remove();
    });
  };
  if (which === 'student') {
    rm('#sp-plan-student-save-row');
    rm('#sp-plan-student-manual-reg');
    rm('.sp-plan-student__hint');
    rm('#sp-plan-coaching-subject-add');
    rm('.sp-plan-coaching__rowDel');
    rm('.sp-plan-coaching__thAct');
    rm('.sp-plan-coaching__subjAct');
    const coaching = clone.querySelector('#sp-plan-coaching');
    if (coaching) {
      coaching.removeAttribute('hidden');
      coaching.removeAttribute('aria-hidden');
    }
    plannerPdfExpandCoachingSubjectsIn_(clone, root);
    rm('button');
  } else {
    const notice = clone.querySelector('#sp-plan-monthly-notice');
    if (notice) {
      notice.removeAttribute('hidden');
      notice.removeAttribute('aria-hidden');
    }
    rm('.sp-plan-monthlyNotice__hint');
    rm('#sp-plan-monthly-notice-empty');
    rm('#sp-plan-quick-reg');
    rm('.sp-plan-month__actions');
    rm('.sp-plan-month__nav');
    rm('#sp-plan-month-loading');
    rm('#sp-plan-calendar-ctx-menu');
    rm('.sp-plan-weekCurBtn');
    plannerPdfUnbuttonCalendarDays_(clone);
    rm('button');
  }
  plannerPdfReplaceFormControlsWithText_(clone);
}

/**
 * PDF 캡처용 — 1페이지 학생 정보·2페이지 월간 플래너(본문 너비 clone, 화면 밖).
 * @param {HTMLElement} root
 * @returns {{ host: HTMLElement, pageStudent: HTMLElement, pageMonthly: HTMLElement }}
 */
function plannerBuildExportCaptureHost_(root) {
  const body = root.querySelector('.sp-plan-body');
  const panelStudent = root.querySelector('#sp-plan-tab-student');
  const panelMonthly = root.querySelector('#sp-plan-tab-monthly');
  const host = document.createElement('div');
  host.className = 'sp-plan-export-capture';
  host.setAttribute('aria-hidden', 'true');
  const w = body && body.offsetWidth > 0 ? body.offsetWidth : root.clientWidth;
  if (w > 0) {
    host.style.width = String(w) + 'px';
    host.style.maxWidth = String(w) + 'px';
  }
  const pageStudent = document.createElement('div');
  pageStudent.className = 'sp-plan-export-capture__page sp-plan-export-capture__page--student';
  const pageMonthly = document.createElement('div');
  pageMonthly.className = 'sp-plan-export-capture__page sp-plan-export-capture__page--monthly';
  if (panelStudent) {
    const studentClone = /** @type {HTMLElement} */ (panelStudent.cloneNode(true));
    plannerPdfSanitizePanelClone_(studentClone, root, 'student');
    pageStudent.appendChild(studentClone);
  }
  if (panelMonthly) {
    const monthlyClone = /** @type {HTMLElement} */ (panelMonthly.cloneNode(true));
    plannerPdfSanitizePanelClone_(monthlyClone, root, 'monthly');
    pageMonthly.appendChild(monthlyClone);
  }
  host.appendChild(pageStudent);
  host.appendChild(pageMonthly);
  root.appendChild(host);
  return { host: host, pageStudent: pageStudent, pageMonthly: pageMonthly };
}

/**
 * @param {HTMLElement} el
 * @returns {Promise<HTMLCanvasElement>}
 */
async function plannerCaptureElementCanvas_(el) {
  const html2canvas = globalThis.html2canvas;
  await new Promise(function (resolve) {
    requestAnimationFrame(function () {
      requestAnimationFrame(resolve);
    });
  });
  return html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
    width: el.scrollWidth,
    height: el.scrollHeight,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
    scrollX: 0,
    scrollY: 0
  });
}

/**
 * 캔버스 한 덩어리를 A4에 맞춰 이어 붙임(세로 넘치면 같은 섹션 내 추가 페이지).
 * @param {object} pdf
 * @param {HTMLCanvasElement} canvas
 * @param {boolean} newPageBefore 첫 장 앞에 빈 페이지를 넣을지(2번째 섹션 시작)
 */
function plannerPdfAppendCanvas_(pdf, canvas, newPageBefore) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 6;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const imgH = (canvas.height * contentW) / canvas.width;
  let heightLeft = imgH;
  let position = margin;
  let slice = 0;
  while (heightLeft > 0) {
    if (slice > 0 || newPageBefore) {
      pdf.addPage();
      newPageBefore = false;
    }
    pdf.addImage(imgData, 'JPEG', margin, position, contentW, imgH);
    heightLeft -= contentH;
    position = margin - (imgH - heightLeft);
    slice++;
  }
  return slice > 0;
}

/**
 * 학생 정보(1섹션) → 월간 플래너(2섹션) 순서로 PDF 저장.
 * @param {HTMLCanvasElement} canvasStudent
 * @param {HTMLCanvasElement} canvasMonthly
 * @param {string} filename
 */
function plannerSaveStudentMonthlyPdf_(canvasStudent, canvasMonthly, filename) {
  const jsPDF = globalThis.jspdf.jsPDF;
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const hasStudent = plannerPdfAppendCanvas_(pdf, canvasStudent, false);
  plannerPdfAppendCanvas_(pdf, canvasMonthly, hasStudent);
  pdf.save(filename);
}

/**
 * @param {HTMLElement} root
 */
async function plannerExportPdfClick_(root) {
  const btn = root.querySelector('#sp-plan-pdf-export');
  const msgEl = root.querySelector('#sp-plan-pdf-export-msg');
  const main = root.querySelector('#sp-plan-app-main');
  if (!btn || !main || main.hasAttribute('hidden')) {
    if (msgEl) {
      msgEl.textContent = '게이트 확인 후 이용할 수 있습니다.';
      msgEl.removeAttribute('hidden');
    }
    return;
  }
  if (!root.querySelector('#sp-plan-month-wrap')) {
    if (msgEl) {
      msgEl.textContent = '달력을 불러온 뒤 다시 시도해 주세요.';
      msgEl.removeAttribute('hidden');
    }
    return;
  }
  btn.setAttribute('disabled', 'disabled');
  if (msgEl) {
    msgEl.textContent = 'PDF 생성 중…';
    msgEl.removeAttribute('hidden');
  }

  let captureHost = null;
  try {
    await plannerEnsurePdfLibs_();
    const capture = plannerBuildExportCaptureHost_(root);
    captureHost = capture.host;
    const canvasStudent = await plannerCaptureElementCanvas_(capture.pageStudent);
    const canvasMonthly = await plannerCaptureElementCanvas_(capture.pageMonthly);
    plannerSaveStudentMonthlyPdf_(
      canvasStudent,
      canvasMonthly,
      plannerExportDownloadFilename_(root, '.pdf')
    );
    if (msgEl) {
      msgEl.textContent = '저장했습니다.';
      window.setTimeout(function () {
        msgEl.setAttribute('hidden', 'hidden');
      }, 2200);
    }
  } catch (e) {
    const m = e && e.message != null ? String(e.message) : String(e);
    if (msgEl) msgEl.textContent = 'PDF 생성 실패: ' + m;
  } finally {
    if (captureHost && captureHost.parentNode) {
      captureHost.parentNode.removeChild(captureHost);
    }
    btn.removeAttribute('disabled');
  }
}

function wirePlannerPdfExportOnce_(root) {
  if (root.__spPlanPdfExportWired) return;
  root.__spPlanPdfExportWired = true;
  root.addEventListener('click', function (e) {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    const btn = t.id === 'sp-plan-pdf-export' ? t : t.closest ? t.closest('#sp-plan-pdf-export') : null;
    if (!btn) return;
    e.preventDefault();
    void plannerExportPdfClick_(root);
  });
}

/**
 * 저장 직전: 열린 일일 모달의 메모·타임라인을 `monthTodos`에 반영.
 * @param {HTMLElement} root
 */
function plannerPrepareClientStateBeforeApply_(root) {
  const st = root.__spPlanState;
  if (!st || !st.selectedDate) return;
  const day = String(st.selectedDate).trim();
  if (!day) return;
  const modal = root.querySelector('#sp-plan-day-modal');
  if (!modal || modal.hasAttribute('hidden')) return;
  const memoTa = modal.querySelector('#sp-plan-day-memo');
  if (memoTa instanceof HTMLTextAreaElement) {
    if (!st.dayMemoByDate) st.dayMemoByDate = {};
    st.dayMemoByDate[day] = memoTa.value;
    plannerSyncDayMemoToMonthTodo_(st, day);
  }
  plannerPersistTimelineSlotMapToMonthTodos_(st, day);
}

/**
 * @param {object[]} arr
 * @param {number} size
 * @returns {object[][]}
 */
function plannerChunkTodosForApply_(arr, size) {
  const list = Array.isArray(arr) ? arr : [];
  const n = size > 0 ? Math.floor(size) : PLANNER_TODO_APPLY_BATCH_SIZE;
  /** @type {object[][]} */
  const out = [];
  let i;
  for (i = 0; i < list.length; i += n) {
    out.push(list.slice(i, i + n));
  }
  if (!out.length) {
    out.push([]);
  }
  return out;
}

/**
 * 저장 성공 후 클라 `monthTodos` — bootstrap 없이 서버 반영 표시.
 * @param {object} st
 * @param {Date} viewMonth
 */
function plannerMarkViewMonthTodosSaved_(st, viewMonth) {
  if (!st || typeof st !== 'object') return;
  const pfx = plannerMonthYmdPrefix_(viewMonth);
  plannerEnsureMonthTodos_(st);
  st.monthTodos.forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    if (String(r.date || '').trim().indexOf(pfx) !== 0) return;
    r._fromServer = true;
  });
  plannerRebuildQuickPostPayload_(st);
}

/**
 * todo apply 후 UI만 갱신(bootstrap 생략).
 * @param {HTMLElement} root
 */
function plannerRefreshUiAfterTodosApply_(root) {
  plannerRefreshPostPreview_(root);
  if (typeof root.__spPlanRerenderMonth === 'function') {
    root.__spPlanRerenderMonth();
  }
  if (typeof root.__spPlanRefreshOpenDayModal === 'function') {
    root.__spPlanRefreshOpenDayModal();
  }
}

/**
 * `plannerPersonalTodosApply` — 해당 월 todo를 batch POST로 저장.
 * @param {Record<string, unknown>} callPayload `plannerGasCall_` 인자
 * @param {HTMLElement|null} msgEl
 * @returns {Promise<{ ok: boolean, written: number, error?: string }>}
 */
async function plannerPersonalTodosApplyBatched_(callPayload, msgEl) {
  const todos = Array.isArray(callPayload.todos) ? /** @type {object[]} */ (callPayload.todos) : [];
  const chunks = plannerChunkTodosForApply_(todos, PLANNER_TODO_APPLY_BATCH_SIZE);
  const batchTotal = chunks.length;
  const applySessionId = batchTotal > 1 ? plannerNewApplySessionId_() : '';
  let writtenTotal = 0;
  let bi;
  for (bi = 0; bi < batchTotal; bi++) {
    if (msgEl) {
      msgEl.textContent =
        batchTotal > 1 ? '저장 중… (' + String(bi + 1) + '/' + String(batchTotal) + ')' : '저장 중…';
      msgEl.removeAttribute('hidden');
    }
    /** @type {Record<string, unknown>} */
    const batchPayload = {
      action: 'plannerPersonalTodosApply',
      phoneSegments: callPayload.phoneSegments,
      name: callPayload.name,
      memberCode: callPayload.memberCode,
      year_month: callPayload.year_month,
      todos: chunks[bi],
      batch_index: bi,
      batch_total: batchTotal
    };
    if (applySessionId.length) {
      batchPayload.apply_session_id = applySessionId;
    }
    const res = await plannerGasCall_(batchPayload);
    if (!res || !res.ok) {
      const m = res && res.error && res.error.message != null ? String(res.error.message) : '저장에 실패했습니다.';
      return { ok: false, written: writtenTotal, error: m };
    }
    const d = /** @type {{ written?: number }} */ (res.data || {});
    writtenTotal += Number(d.written) || 0;
  }
  return { ok: true, written: writtenTotal };
}

/**
 * `plannerPersonalTodosApply` — 현재 보는 달(`viewMonth`)의 todo 페이로드를 학생 월 시트에 덮어쓴다.
 * @param {HTMLElement} root
 * @param {{ msgEl?: HTMLElement|null, requireAdmin?: boolean, partOfDual?: boolean, skipInFlightCheck?: boolean }} [opts]
 */
async function plannerPersonalTodosApplyClick_(root, opts) {
  const partOfDual = Boolean(opts && opts.partOfDual);
  const msgEl =
    (opts && opts.msgEl) ||
    root.querySelector('#sp-plan-todos-apply-msg') ||
    root.querySelector('#sp-plan-month-apply-msg') ||
    root.querySelector('#sp-plan-day-apply-msg');
  const ctx = root.__spPlannerBootstrapCtx;
  const st = root.__spPlanState;
  const memberUi = st && (st.role === 'member' || st.planGuestUnlockMock);
  if (opts && opts.requireAdmin && !plannerPlanAdminBulkScheduleAllowed_(root)) {
    if (msgEl && !partOfDual) {
      msgEl.textContent = '관리자 모드에서만 할 수 있습니다.';
      msgEl.removeAttribute('hidden');
    }
    return false;
  }
  if (!ctx || !st || !memberUi) {
    if (msgEl && !partOfDual) {
      msgEl.textContent = '회원 확인 후에만 저장할 수 있습니다.';
      msgEl.removeAttribute('hidden');
    }
    return false;
  }
  if (!opts || !opts.skipInFlightCheck) {
    if (root.__spPlanTodosApplyInFlight || root.__spPlanAdminDualSaveInFlight) {
      if (msgEl && !partOfDual) {
        msgEl.textContent = '저장 중입니다. 잠시만 기다려 주세요.';
        msgEl.removeAttribute('hidden');
      }
      return false;
    }
  }
  root.__spPlanTodosApplyInFlight = true;
  try {
    plannerPrepareClientStateBeforeApply_(root);
    plannerRebuildQuickPostPayload_(st);
    const ymDate = st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime()) ? st.viewMonth : new Date();
    const ym = plannerYearMonthFromDate_(ymDate);
    const todos =
      st.plannerQuickPostBody && Array.isArray(st.plannerQuickPostBody.todos) ? st.plannerQuickPostBody.todos : [];
    if (msgEl && !partOfDual) {
      msgEl.textContent = '저장 중…';
      msgEl.removeAttribute('hidden');
    }
    const applyRes = await plannerPersonalTodosApplyBatched_(
      {
        phoneSegments: ctx.phoneSegments,
        name: ctx.name || '',
        memberCode: ctx.memberCode || '',
        year_month: ym,
        todos: todos
      },
      msgEl
    );
    if (!applyRes.ok) {
      if (msgEl && !partOfDual) {
        msgEl.textContent =
          (applyRes.error || '저장에 실패했습니다.') + ' 화면 데이터는 그대로입니다. 다시 저장해 주세요.';
      }
      return false;
    }
    plannerMarkViewMonthTodosSaved_(st, ymDate);
    plannerRefreshUiAfterTodosApply_(root);
    if (msgEl && !partOfDual) {
      msgEl.textContent = '저장했습니다.';
      window.setTimeout(function () {
        msgEl.setAttribute('hidden', 'hidden');
      }, 2200);
    }
    return true;
  } finally {
    root.__spPlanTodosApplyInFlight = false;
  }
}

function wirePlannerPersonalTodosApplyOnce_(root) {
  if (root.__spPlanTodosApplyWired) return;
  root.__spPlanTodosApplyWired = true;
  root.addEventListener('click', function (e) {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    const saveBtn =
      t.id === 'sp-plan-todos-apply' || t.id === 'sp-plan-month-save' || t.id === 'sp-plan-day-save'
        ? t
        : t.closest
          ? t.closest('#sp-plan-todos-apply, #sp-plan-month-save, #sp-plan-day-save')
          : null;
    if (saveBtn instanceof HTMLElement) {
      e.preventDefault();
      let msgEl = null;
      if (saveBtn.id === 'sp-plan-month-save') msgEl = root.querySelector('#sp-plan-month-apply-msg');
      else if (saveBtn.id === 'sp-plan-day-save') msgEl = root.querySelector('#sp-plan-day-apply-msg');
      else msgEl = root.querySelector('#sp-plan-todos-apply-msg');
      const requireAdmin =
        saveBtn.id === 'sp-plan-month-save' || saveBtn.id === 'sp-plan-todos-apply';
      void plannerAdminDualSaveClick_(root, { msgEl: msgEl, requireAdmin: requireAdmin });
      return;
    }
    const clearBtn =
      t.id === 'sp-plan-month-clear' ? t : t.closest ? t.closest('#sp-plan-month-clear') : null;
    if (clearBtn) {
      e.preventDefault();
      void plannerClearMonthScheduleClick_(root);
    }
  });
}

/**
 * 해당 날·보는 달 타임라인 페인트 캐시 제거 → 다음 모달/b bootstrap 시 `monthTodos`에서 재구축.
 * @param {object} st
 * @param {string} ymd
 */
function plannerInvalidateDayTimelineCache_(st, ymd) {
  if (!st || !st.dayTimelineTodoByDate) return;
  const day = String(ymd || '').trim();
  if (!day) return;
  try {
    delete st.dayTimelineTodoByDate[day];
  } catch (_e) {
    st.dayTimelineTodoByDate[day] = {};
  }
}

/**
 * @param {object} st
 * @param {Date} viewMonth
 */
function plannerInvalidateTimelineCacheForViewMonth_(st, viewMonth) {
  if (!st || !st.dayTimelineTodoByDate) return;
  const pfx = plannerMonthYmdPrefix_(viewMonth);
  Object.keys(st.dayTimelineTodoByDate).forEach(function (k) {
    if (k.indexOf(pfx) !== 0) return;
    try {
      delete st.dayTimelineTodoByDate[k];
    } catch (_e) {
      st.dayTimelineTodoByDate[k] = {};
    }
  });
}

/**
 * 「일정 삭제하기」 실패 시 복구용 — 해당 월 `monthTodos`·일별 캐시 스냅샷.
 * @param {object} st
 * @param {Date} viewMonth
 * @returns {{ monthTodos: object[], dayTimelineTodoByDate: Record<string, Record<string, string>>, dayFixedBlockSlotsByDate: Record<string, Record<string, boolean>>, dayMemoByDate: Record<string, string> }}
 */
function plannerSnapshotViewMonthPlannerState_(st, viewMonth) {
  plannerEnsureMonthTodos_(st);
  const pfx = plannerMonthYmdPrefix_(viewMonth);
  /** @type {object[]} */
  const monthTodos = [];
  st.monthTodos.forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    if (String(r.date != null ? r.date : '').trim().indexOf(pfx) !== 0) return;
    const copy = Object.assign({}, r);
    if (r._fromServer) copy._fromServer = true;
    monthTodos.push(copy);
  });
  /** @type {Record<string, Record<string, string>>} */
  const dayTimelineTodoByDate = {};
  if (st.dayTimelineTodoByDate) {
    Object.keys(st.dayTimelineTodoByDate).forEach(function (k) {
      if (k.indexOf(pfx) !== 0) return;
      dayTimelineTodoByDate[k] = Object.assign({}, st.dayTimelineTodoByDate[k]);
    });
  }
  /** @type {Record<string, Record<string, boolean>>} */
  const dayFixedBlockSlotsByDate = {};
  if (st.dayFixedBlockSlotsByDate) {
    Object.keys(st.dayFixedBlockSlotsByDate).forEach(function (k) {
      if (k.indexOf(pfx) !== 0) return;
      dayFixedBlockSlotsByDate[k] = Object.assign({}, st.dayFixedBlockSlotsByDate[k]);
    });
  }
  /** @type {Record<string, string>} */
  const dayMemoByDate = {};
  if (st.dayMemoByDate) {
    Object.keys(st.dayMemoByDate).forEach(function (k) {
      if (k.indexOf(pfx) !== 0) return;
      dayMemoByDate[k] = String(st.dayMemoByDate[k]);
    });
  }
  return {
    monthTodos: monthTodos,
    dayTimelineTodoByDate: dayTimelineTodoByDate,
    dayFixedBlockSlotsByDate: dayFixedBlockSlotsByDate,
    dayMemoByDate: dayMemoByDate
  };
}

/**
 * @param {object} st
 * @param {Date} viewMonth
 * @param {{ monthTodos: object[], dayTimelineTodoByDate: Record<string, Record<string, string>>, dayFixedBlockSlotsByDate: Record<string, Record<string, boolean>>, dayMemoByDate: Record<string, string> }} snap
 */
function plannerRestoreViewMonthPlannerState_(st, viewMonth, snap) {
  if (!st || !snap) return;
  const pfx = plannerMonthYmdPrefix_(viewMonth);
  plannerEnsureMonthTodos_(st);
  st.monthTodos = st.monthTodos.filter(function (r) {
    if (!r || typeof r !== 'object') return false;
    return String(r.date != null ? r.date : '').trim().indexOf(pfx) !== 0;
  });
  snap.monthTodos.forEach(function (r) {
    st.monthTodos.push(Object.assign({}, r));
  });
  if (!st.dayTimelineTodoByDate) st.dayTimelineTodoByDate = {};
  Object.keys(st.dayTimelineTodoByDate).forEach(function (k) {
    if (k.indexOf(pfx) === 0) {
      try {
        delete st.dayTimelineTodoByDate[k];
      } catch (_e) {
        st.dayTimelineTodoByDate[k] = {};
      }
    }
  });
  Object.keys(snap.dayTimelineTodoByDate).forEach(function (k) {
    st.dayTimelineTodoByDate[k] = Object.assign({}, snap.dayTimelineTodoByDate[k]);
  });
  if (!st.dayFixedBlockSlotsByDate) st.dayFixedBlockSlotsByDate = {};
  Object.keys(st.dayFixedBlockSlotsByDate).forEach(function (k) {
    if (k.indexOf(pfx) === 0) {
      try {
        delete st.dayFixedBlockSlotsByDate[k];
      } catch (_e) {
        st.dayFixedBlockSlotsByDate[k] = {};
      }
    }
  });
  Object.keys(snap.dayFixedBlockSlotsByDate).forEach(function (k) {
    st.dayFixedBlockSlotsByDate[k] = Object.assign({}, snap.dayFixedBlockSlotsByDate[k]);
  });
  if (!st.dayMemoByDate) st.dayMemoByDate = {};
  Object.keys(st.dayMemoByDate).forEach(function (k) {
    if (k.indexOf(pfx) === 0) {
      try {
        delete st.dayMemoByDate[k];
      } catch (_e) {
        st.dayMemoByDate[k] = '';
      }
    }
  });
  Object.keys(snap.dayMemoByDate).forEach(function (k) {
    st.dayMemoByDate[k] = snap.dayMemoByDate[k];
  });
  plannerRebuildFixedBlockSlotsForMonth_(st, viewMonth);
  plannerRebuildQuickPostPayload_(st);
}

/**
 * 보는 달 `monthTodos` 전부 제거(로컬·서버 행 구분 없음) + 캐시 정리.
 * @param {object} st
 * @param {Date} viewMonth
 */
function plannerClearAllTodosForViewMonth_(st, viewMonth) {
  plannerEnsureMonthTodos_(st);
  const pfx = plannerMonthYmdPrefix_(viewMonth);
  st.monthTodos = st.monthTodos.filter(function (r) {
    if (!r || typeof r !== 'object') return false;
    return String(r.date != null ? r.date : '').trim().indexOf(pfx) !== 0;
  });
  [st.dayTimelineTodoByDate, st.dayFixedBlockSlotsByDate, st.dayMemoByDate].forEach(function (bag) {
    if (!bag || typeof bag !== 'object') return;
    Object.keys(bag).forEach(function (k) {
      if (k.indexOf(pfx) === 0) {
        try {
          delete bag[k];
        } catch (_e) {
          if (bag === st.dayMemoByDate) bag[k] = '';
          else bag[k] = {};
        }
      }
    });
  });
  plannerRebuildFixedBlockSlotsForMonth_(st, viewMonth);
  plannerRebuildQuickPostPayload_(st);
}

/**
 * 달력 「일정 삭제하기」— 해당 월 todo 전부 지운 뒤 시트에 덮어쓰기.
 * @param {HTMLElement} root
 */
async function plannerClearMonthScheduleClick_(root) {
  const msgEl = root.querySelector('#sp-plan-month-apply-msg');
  const ctx = root.__spPlannerBootstrapCtx;
  const st = root.__spPlanState;
  if (!plannerPlanAdminBulkScheduleAllowed_(root)) {
    if (msgEl) {
      msgEl.textContent = '관리자 모드에서만 삭제할 수 있습니다.';
      msgEl.removeAttribute('hidden');
    }
    return;
  }
  const memberUi = st && (st.role === 'member' || st.planGuestUnlockMock);
  if (!ctx || !st || !memberUi) {
    if (msgEl) {
      msgEl.textContent = '회원 확인 후에만 삭제할 수 있습니다.';
      msgEl.removeAttribute('hidden');
    }
    return;
  }
  const vm = st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime()) ? st.viewMonth : new Date();
  const ymLabel = String(vm.getFullYear()) + '년 ' + String(vm.getMonth() + 1) + '월';
  const confirmed = window.confirm(
    ymLabel +
      ' 일정을 전부 삭제할까요?\n\n이 달 할 일·타임라인·메모가 모두 지워지고 서버에도 반영됩니다. 이 동작은 되돌리기 어렵습니다.'
  );
  if (!confirmed) return;
  const snap = plannerSnapshotViewMonthPlannerState_(st, vm);
  plannerClearAllTodosForViewMonth_(st, vm);
  plannerRefreshPostPreview_(root);
  if (typeof root.__spPlanRerenderMonth === 'function') {
    root.__spPlanRerenderMonth();
  }
  const modal = root.querySelector('#sp-plan-day-modal');
  if (modal && st.selectedDate && !modal.hasAttribute('hidden') && typeof root.__spPlanRefreshOpenDayModal === 'function') {
    root.__spPlanRefreshOpenDayModal();
  }
  const ok = await plannerPersonalTodosApplyClick_(root, { msgEl: msgEl });
  if (!ok) {
    plannerRestoreViewMonthPlannerState_(st, vm, snap);
    plannerRefreshPostPreview_(root);
    if (typeof root.__spPlanRerenderMonth === 'function') {
      root.__spPlanRerenderMonth();
    }
    if (modal && st.selectedDate && !modal.hasAttribute('hidden') && typeof root.__spPlanRefreshOpenDayModal === 'function') {
      root.__spPlanRefreshOpenDayModal();
    }
    if (msgEl) {
      msgEl.textContent = '서버에 삭제를 반영하지 못했습니다. 화면을 이전 상태로 되돌렸습니다.';
      msgEl.removeAttribute('hidden');
    }
  }
}

/** @param {string} s */
function esc(s) {
  return String(s != null ? s : '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * `prev_major_gpa` 문자열(예: `국어국문학과 · 평점 3.82 / 4.5`)에서 학과·평점만 분리한다.
 * @param {string} raw
 * @returns {{ major: string, gpa: string }}
 */
function plannerPrevMajorGpaParts_(raw) {
  const s = String(raw != null ? raw : '').trim();
  if (!s) return { major: '—', gpa: '—' };
  const chunks = s
    .split(/\s*·\s*/)
    .map(function (x) {
      return String(x || '').trim();
    })
    .filter(Boolean);
  let major = '';
  let gpa = '';
  chunks.forEach(function (chunk) {
    const m = chunk.match(/^평점\s*(.*)$/i);
    if (m) {
      const rest = String(m[1] != null ? m[1] : '').trim();
      gpa = rest || '—';
    } else if (!major) {
      major = chunk;
    }
  });
  if (!major) major = '—';
  if (!gpa) gpa = '—';
  return { major: major, gpa: gpa };
}

/**
 * 학과·평점 입력 → registry `prev_major_gpa` 한 칸.
 * @param {string} major
 * @param {string} gpa
 * @returns {string}
 */
function plannerComposePrevMajorGpa_(major, gpa) {
  const m = String(major != null ? major : '').trim();
  const g = String(gpa != null ? gpa : '').trim();
  if (!m && !g) return '';
  if (m && g) return m + ' · 평점 ' + g;
  if (g) return '평점 ' + g;
  return m;
}

/**
 * @param {string} display major|gpa with — placeholder
 * @returns {string}
 */
function plannerPrevMajorGpaInputVal_(display) {
  const s = String(display != null ? display : '').trim();
  return s === '—' ? '' : s;
}

/**
 * 학생 정보 표 — bootstrap `student_profile`. 관리자 모드에서 입력·수정(학과/평점은 각각 입력 후 `prev_major_gpa`로 합쳐 저장).
 * @param {HTMLElement} root
 * @param {Record<string, unknown>|null|undefined} profile
 */
function renderPlannerStudentProfile_(root, profile) {
  const tbody = root.querySelector('#sp-plan-student-tbody');
  if (!tbody) return;
  const canEdit = plannerStudentProfileCanEdit_(root);
  const p = plannerNormalizeStudentProfileFromApi_(profile);
  const profileDirty = plannerProfileDirtyMap_(root);
  /** @type {Record<string, string>} */
  const keepDirtyInputs = {};
  tbody.querySelectorAll('[data-sp-plan-student-input]').forEach(function (el) {
    if (!(el instanceof HTMLElement) || !('value' in el)) return;
    const attrKey = el.getAttribute('data-sp-plan-student-input') || '';
    if (!attrKey.length) return;
    if (!profileDirty[plannerProfileDirtyKeyFromInputAttr_(attrKey)]) return;
    keepDirtyInputs[attrKey] = String(/** @type {HTMLInputElement | HTMLTextAreaElement} */ (el).value);
  });
  root.__spPlanStudentProfileInitial = {};
  PLANNER_STUDENT_PROFILE_KEYS_FOR_SAVE.forEach(function (k) {
    root.__spPlanStudentProfileInitial[k] = p[k];
  });
  PLANNER_COACHING_PROFILE_KEYS_FOR_SAVE.forEach(function (k) {
    root.__spPlanStudentProfileInitial[k] = p[k];
  });

  function showVal(key) {
    const v = p[key];
    if (plannerStudentFieldIsEmpty_(v)) return '—';
    return String(v);
  }

  function tdReadCell(key) {
    return '<td data-sp-plan-student="' + escAttr(key) + '">' + esc(showVal(key)) + '</td>';
  }

  function tdInp(key) {
    const v = p && p[key] != null ? String(p[key]) : '';
    return (
      '<td><input type="text" class="sp-plan-student__input" data-sp-plan-student-input="' +
      escAttr(key) +
      '" value="' +
      escAttr(v) +
      '" maxlength="2000" autocomplete="off" spellcheck="true" /></td>'
    );
  }

  function tdTxtArea(key) {
    const v = p && p[key] != null ? String(p[key]) : '';
    return (
      '<td colspan="3" class="sp-plan-student__td--text"><textarea class="sp-plan-student__input sp-plan-student__textarea" rows="3" data-sp-plan-student-input="' +
      escAttr(key) +
      '" maxlength="3000" spellcheck="true">' +
      esc(v) +
      '</textarea></td>'
    );
  }

  const hintEl = root.querySelector('.sp-plan-student__hint');
  if (hintEl) {
    if (canEdit) {
      hintEl.textContent = '관리자 모드에서 학생 정보를 수정할 수 있습니다.';
    } else if (plannerStudentProfileIsMemberView_(root)) {
      hintEl.textContent = '학생 정보는 조회만 가능합니다. 항목 입력은 관리자 모드에서만 할 수 있습니다.';
    } else {
      hintEl.textContent = '학생 정보는 조회만 가능합니다.';
    }
  }

  /** @param {string} key */
  const ed = function (key) {
    return canEdit;
  };

  let h = '';
  h += '<tr>';
  h += '<th scope="row">이름</th>';
  h += ed('display_name') ? tdInp('display_name') : tdReadCell('display_name');
  h += '<th scope="row">휴대전화</th>';
  h += '<td data-sp-plan-student="phone_display">' + esc(showVal('phone_display')) + '</td>';
  h += '</tr>';

  h += '<tr>';
  h += '<th scope="row">계열</th>';
  h += ed('track') ? tdInp('track') : tdReadCell('track');
  h += '<th scope="row">편입 구분</th>';
  h += ed('admission_type') ? tdInp('admission_type') : tdReadCell('admission_type');
  h += '</tr>';

  const pmAll = plannerPrevMajorGpaParts_(p.prev_major_gpa);
  const majorInpVal = plannerPrevMajorGpaInputVal_(pmAll.major);
  const gpaInpVal = plannerPrevMajorGpaInputVal_(pmAll.gpa);

  h += '<tr>';
  h += '<th scope="row">전적대</th>';
  h += ed('prev_university') ? tdInp('prev_university') : tdReadCell('prev_university');
  if (canEdit) {
    h += '<th scope="row">학과</th>';
    h +=
      '<td><input type="text" class="sp-plan-student__input" data-sp-plan-student-input="prev_major" value="' +
      escAttr(majorInpVal) +
      '" maxlength="500" autocomplete="off" spellcheck="true" placeholder="예: 국어국문학과"/></td>';
  } else {
    h += '<th scope="row">학과</th>';
    h += '<td data-sp-plan-student="prev_major">' + esc(pmAll.major) + '</td>';
  }
  h += '</tr>';

  h += '<tr>';
  h += '<th scope="row">평점</th>';
  if (canEdit) {
    h +=
      '<td colspan="3"><input type="text" class="sp-plan-student__input" data-sp-plan-student-input="prev_major_gpa_only" value="' +
      escAttr(gpaInpVal) +
      '" maxlength="200" autocomplete="off" spellcheck="true" placeholder="예: 3.82 / 4.5"/></td>';
  } else {
    h += '<td colspan="3" data-sp-plan-student="prev_major_gpa">' + esc(pmAll.gpa) + '</td>';
  }
  h += '</tr>';

  h += '<tr>';
  h += '<th scope="row">목표대학</th>';
  h += ed('goal_university') ? tdInp('goal_university') : tdReadCell('goal_university');
  h += '<th scope="row">목표 학과</th>';
  h += ed('goal_department') ? tdInp('goal_department') : tdReadCell('goal_department');
  h += '</tr>';

  h += '<tr class="sp-plan-student__tr--study">';
  h += '<th scope="row">공부 현황</th>';
  if (ed('study_status')) {
    h += tdTxtArea('study_status');
  } else {
    h += '<td colspan="3" class="sp-plan-student__td--text" data-sp-plan-student="study_status">' + esc(showVal('study_status')) + '</td>';
  }
  h += '</tr>';

  tbody.innerHTML = h;
  Object.keys(keepDirtyInputs).forEach(function (attrKey) {
    const el = tbody.querySelector('[data-sp-plan-student-input="' + escAttr(attrKey) + '"]');
    if (el && 'value' in el) {
      /** @type {HTMLInputElement | HTMLTextAreaElement} */ (el).value = keepDirtyInputs[attrKey];
    }
  });

  const saveRow = root.querySelector('#sp-plan-student-save-row');
  if (saveRow) {
    if (canEdit) saveRow.removeAttribute('hidden');
    else saveRow.setAttribute('hidden', 'hidden');
  }
  renderPlannerCoachingBlocks_(root, profile);
}

/**
 * 주간 커리큘럼 한 블록 — API에서 내려올 **JSON 형태** (`rows[]`).
 * @typedef {{ subject: string, subject_code?: string, textbook_goal: string, lesson_outline: string, link_url?: string }} PlannerCurriculumRowPayload
 * @typedef {{ source: string, week_index: number, focus_phase: string, rows: PlannerCurriculumRowPayload[] }} PlannerCurriculumWeekPayload
 */

/**
 * `monthTodos` 해당 주 날짜에서 과목별 강 범위(제목 `· N강` 파싱).
 * @param {object} st
 * @param {string[]} weekDateKeys YYYY-MM-DD 7일
 * @returns {Record<string, { min: number, max: number }>}
 */
function plannerCurriculumWeekLessonRangeFromQuickPlan_(st, weekDateKeys) {
  /** @type {Record<string, { min: number, max: number }>} */
  const out = {};
  if (!st) return out;
  (weekDateKeys || []).forEach(function (key) {
    plannerMonthTodosForDay_(st, key).forEach(function (t) {
      if (!t || plannerIsTraceGhostDisplay_(t)) return;
      const subj = String(t.category != null ? t.category : '').trim();
      if (!plannerIsStudyCategoryCode_(subj)) return;
      const lessons = plannerLessonsFromStudyTitle_(String(t.title != null ? t.title : ''));
      lessons.forEach(function (L) {
      if (!isFinite(L) || L <= 0) return;
      if (!out[subj]) out[subj] = { min: L, max: L };
      else {
        if (L < out[subj].min) out[subj].min = L;
        if (L > out[subj].max) out[subj].max = L;
      }
      });
    });
  });
  return out;
}

/**
 * @param {{ min: number, max: number }|null|undefined} r
 * @returns {string}
 */
function plannerCurriculumLessonOutlineFromRange_(r) {
  if (!r || !isFinite(r.min) || !isFinite(r.max) || r.min <= 0 || r.max <= 0) return '';
  const lo = Math.min(r.min, r.max);
  const hi = Math.max(r.min, r.max);
  if (lo === hi) return String(lo) + '강';
  return String(lo) + '강~' + String(hi) + '강';
}

/**
 * 마스터 `subject` 컬럼만 → 학습 과목 코드 (매칭 없으면 빈 문자열).
 * @param {string} subjectRaw
 * @returns {string}
 */
function plannerSubjectCodeFromSubjectField_(subjectRaw) {
  const s = String(subjectRaw != null ? subjectRaw : '').trim();
  if (!s.length) return '';
  const sl = s.toLowerCase();
  if (sl === 'grammar' || s === '문법') return 'grammar';
  if (sl === 'logic' || s === '논리') return 'logic';
  if (sl === 'read' || s === '독해') return 'read';
  if (sl === 'comprehensive' || s === '종합') return 'comprehensive';
  if (sl === 'math' || s === '수학') return 'math';
  if (sl === 'toeic_rc' || /^토익\s*rc$/i.test(s)) return 'toeic_rc';
  if (sl === 'toeic_lc' || /^토익\s*lc$/i.test(s)) return 'toeic_lc';
  if (sl === 'vocab' || s === '어휘') return 'vocab';
  if (sl === 'misc' || s === '기타') return 'misc';
  return '';
}

/**
 * 강좌 행(`subject`·`course_name`) → 빠른등록 코드 `grammar`|`logic`|`read`|`comprehensive`|`vocab` 등 (없으면 빈 문자열).
 * `subject` 컬럼이 있으면 우선(예: LOGIC-TREE 독해 강좌명에 logic 오매칭 방지).
 * @param {object} course
 * @returns {string}
 */
function plannerSubjectCodeFromCatalogCourse_(course) {
  const c = course && typeof course === 'object' ? course : {};
  const fromSubject = plannerSubjectCodeFromSubjectField_(c.subject);
  if (fromSubject) return fromSubject;
  const subj = String(c.subject != null ? c.subject : '').trim().toLowerCase();
  const cn = String(c.course_name != null ? c.course_name : '').trim().toLowerCase();
  const blob = subj + ' ' + cn;
  if (/\bgrammar\b|문법/.test(blob)) return 'grammar';
  if (/\blogic\b|논리/.test(blob)) return 'logic';
  if (/\bread\b|독해/.test(blob)) return 'read';
  if (/\bcomprehensive\b|종합/.test(blob)) return 'comprehensive';
  if (/\bmath\b|수학/.test(blob)) return 'math';
  if (/\btoeic[_\s-]?rc\b|토익\s*rc/i.test(blob)) return 'toeic_rc';
  if (/\btoeic[_\s-]?lc\b|토익\s*lc/i.test(blob)) return 'toeic_lc';
  if (/\bvocab\b|어휘/.test(blob)) return 'vocab';
  if (/\bmisc\b|기타/.test(blob)) return 'misc';
  return 'misc';
}

/**
 * @param {object[]} courses
 * @param {string} code
 * @returns {object|null}
 */
function plannerFindCatalogCourseForSubjectCode_(courses, code) {
  if (!Array.isArray(courses) || !code) return null;
  for (let i = 0; i < courses.length; i++) {
    const row = courses[i];
    if (row && typeof row === 'object' && plannerSubjectCodeFromCatalogCourse_(row) === code) {
      return row;
    }
  }
  return null;
}

/**
 * todo `title`·긴 라벨에서 강좌명만 (`[Day1]`·`N교시`·`N강` 구간 전까지).
 * @param {string} title
 * @returns {string}
 */
function plannerCurriculumCourseNameFromTodoTitle_(title) {
  const s = String(title != null ? title : '').trim();
  if (!s.length) return '';
  const daySplit = s.split(/\s·\s*(?=\[Day\s*\d+)/i);
  if (daySplit[0] && daySplit[0].trim().length) {
    return daySplit[0].trim();
  }
  const segs = s.split(' · ').map(function (p) {
    return p.trim();
  }).filter(Boolean);
  const keep = [];
  for (let i = 0; i < segs.length; i++) {
    const p = segs[i];
    if (/^\[Day\s*\d+/i.test(p) || /^\d+교시\b/.test(p)) break;
    if (/^\d+강$/.test(p) && keep.length > 0) break;
    keep.push(p);
  }
  if (keep.length) return keep.join(' · ');
  return s.length > 72 ? s.slice(0, 72) + '…' : s;
}

/**
 * 주차 표 교재명 칸 — 강좌명만 (강사명·회차 상세 제외).
 * @param {string} _instructor
 * @param {string} courseName
 * @param {string} [fallbackTodoTitle]
 * @returns {string}
 */
function plannerCurriculumCourseNameOnly_(_instructor, courseName, fallbackTodoTitle) {
  const cname = String(courseName != null ? courseName : '').trim();
  if (cname.length) return cname;
  return plannerCurriculumCourseNameFromTodoTitle_(fallbackTodoTitle);
}

/**
 * @param {object[]} lectures
 * @param {unknown} courseId
 * @param {{ min: number, max: number }|null|undefined} range
 * @returns {string}
 */
function plannerLectureTitlesInRangeForCourse_(lectures, courseId, range) {
  if (courseId === '' || courseId == null || !Array.isArray(lectures)) return '';
  const idStr = String(courseId);
  const lo =
    range && isFinite(range.min) && isFinite(range.max) ? Math.min(range.min, range.max) : NaN;
  const hi =
    range && isFinite(range.min) && isFinite(range.max) ? Math.max(range.min, range.max) : NaN;
  const list = lectures.filter(function (L) {
    if (!L || String(L.course_id) !== idStr) return false;
    const no = Number(L.lecture_no);
    if (!isFinite(no)) return false;
    if (isFinite(lo) && isFinite(hi)) return no >= lo && no <= hi;
    return true;
  });
  list.sort(function (a, b) {
    return (Number(a.lecture_no) || 0) - (Number(b.lecture_no) || 0);
  });
  return list
    .map(function (L) {
      return String(L.lecture_name != null ? L.lecture_name : '').trim();
    })
    .filter(Boolean)
    .join(' · ');
}

/**
 * @param {object[]} lectures
 * @param {string} lectureId
 * @returns {object|null}
 */
function plannerFindCatalogLectureById_(lectures, lectureId) {
  const id = String(lectureId != null ? lectureId : '').trim();
  if (!id.length || !Array.isArray(lectures)) return null;
  for (let i = 0; i < lectures.length; i++) {
    const L = lectures[i];
    if (L && String(L.lecture_id != null ? L.lecture_id : '').trim() === id) return L;
  }
  return null;
}

/**
 * @param {object[]} courses
 * @param {unknown} courseId
 * @returns {object|null}
 */
function plannerFindCatalogCourseById_(courses, courseId) {
  if (courseId === '' || courseId == null || !Array.isArray(courses)) return null;
  const idStr = String(courseId);
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    if (c && String(c.course_id != null ? c.course_id : '') === idStr) return c;
  }
  return null;
}

/**
 * 주간 커리큘럼 — todo 1건이 속할 강좌/강의 그룹 키.
 * @param {{ lectures?: object[] }} pack
 * @param {string} title
 * @param {string} lectureId
 * @returns {string}
 */
function plannerCurriculumWeekGroupKeyForTodo_(pack, title, lectureId) {
  const lid = String(lectureId != null ? lectureId : '').trim();
  if (lid.length) {
    const lec = plannerFindCatalogLectureById_(pack.lectures, lid);
    if (lec && lec.course_id != null && String(lec.course_id).trim() !== '') {
      return 'course:' + String(lec.course_id).trim();
    }
    return 'lecture:' + lid;
  }
  const tit = String(title != null ? title : '').trim();
  if (tit.length) {
    const name = plannerCurriculumCourseNameFromTodoTitle_(tit);
    if (name.length) return 'title:' + name;
  }
  return 'manual';
}

/**
 * 주간 커리큘럼 — 그룹(강좌·강의·수기) 1개 → 표 1행.
 * @param {string} code 과목 코드
 * @param {{ titles: string[], lectureIds: string[] }} bucket
 * @param {{ courses?: object[], lectures?: object[] }} pack
 * @returns {PlannerCurriculumRowPayload}
 */
function plannerCurriculumWeekRowFromGroup_(code, bucket, pack) {
  /** @type {number[]} */
  const lessonNums = [];
  (bucket.titles || []).forEach(function (tit) {
    plannerLessonsFromStudyTitle_(tit).forEach(function (n) {
      lessonNums.push(n);
    });
  });
  let outline = plannerLessonsToOutline_(lessonNums) || '';
  if (!outline.length) outline = '—';
  let textbook_goal = '';
  let link_url = '';
  const lids = bucket.lectureIds || [];
  for (let li = 0; li < lids.length; li++) {
    const lec = plannerFindCatalogLectureById_(pack.lectures, lids[li]);
    if (!lec) continue;
    const course = plannerFindCatalogCourseById_(pack.courses, lec.course_id);
    if (!course) continue;
    textbook_goal = plannerCurriculumCourseNameOnly_(course.instructor, course.course_name, '');
    link_url = String(course.link_url != null ? course.link_url : '').trim();
    if (textbook_goal.length) break;
  }
  if (!textbook_goal.length && bucket.titles && bucket.titles.length) {
    textbook_goal = plannerCurriculumCourseNameFromTodoTitle_(bucket.titles[0]);
  }
  if (!textbook_goal.length) textbook_goal = '—';
  return {
    subject: plannerCategoryLabelKo_(code),
    subject_code: code,
    textbook_goal: textbook_goal,
    lesson_outline: outline,
    link_url: link_url
  };
}

/**
 * 주간 교재 payload — 과목 수(같은 과목 여러 강좌는 1과목으로).
 * @param {PlannerCurriculumRowPayload[]} rows
 * @returns {number}
 */
function plannerCurriculumWeekDistinctSubjectCount_(rows) {
  /** @type {Record<string, boolean>} */
  const seen = {};
  let n = 0;
  (rows || []).forEach(function (r) {
    if (!r) return;
    const code = String(r.subject_code != null ? r.subject_code : '').trim();
    if (!code.length) return;
    if (code === 'misc' && r.textbook_goal === '—' && r.lesson_outline === '—') return;
    if (seen[code]) return;
    seen[code] = true;
    n++;
  });
  return n;
}

/**
 * 해당 주 `monthTodos`만으로 주간 커리큘럼 표 payload (할 일 없으면 빈 `rows`).
 * 같은 과목에 서로 다른 강좌·강의가 있으면 **행을 나눠** 모두 표시한다.
 * @param {object} st
 * @param {number} weekIndex
 * @param {string[]} weekDateKeys
 * @param {{ courses?: object[], lectures?: object[] }|null|undefined} curriculum
 * @returns {PlannerCurriculumWeekPayload}
 */
function plannerCurriculumWeekPayloadFromMonthTodos_(st, weekIndex, weekDateKeys, curriculum) {
  const pack = plannerNormalizeCurriculumFromBootstrap_(curriculum);
  /** @type {Record<string, { groupKey: string, titles: string[], lectureIds: string[] }[]>} */
  const bySubj = {};
  (weekDateKeys || []).forEach(function (key) {
    plannerMonthTodosForDay_(st, key).forEach(function (t) {
      if (!t || plannerIsTraceGhostDisplay_(t)) return;
      const cat = String(t.category != null ? t.category : '').trim();
      if (!cat || cat === PLAN_CATEGORY_FIXED || cat === PLAN_CATEGORY_EVENT || cat === 'memo' || cat === PLAN_CATEGORY_ROUTINE) return;
      if (plannerIsRoutineExcludedFromStudyTotals_(t.task_id, cat)) return;
      const subj = plannerIsStudyCategoryCode_(cat) ? cat : 'misc';
      if (!bySubj[subj]) bySubj[subj] = [];
      const title = String(t.title != null ? t.title : '').trim();
      const lid = String(t.lecture_id != null ? t.lecture_id : '').trim();
      if (!title.length && !lid.length) return;
      const groupKey = plannerCurriculumWeekGroupKeyForTodo_(pack, title, lid);
      let bucket = null;
      const groups = bySubj[subj];
      for (let gi = 0; gi < groups.length; gi++) {
        if (groups[gi].groupKey === groupKey) {
          bucket = groups[gi];
          break;
        }
      }
      if (!bucket) {
        bucket = { groupKey: groupKey, titles: [], lectureIds: [] };
        groups.push(bucket);
      }
      if (title && bucket.titles.indexOf(title) < 0) bucket.titles.push(title);
      if (lid && bucket.lectureIds.indexOf(lid) < 0) bucket.lectureIds.push(lid);
    });
  });
  /** @type {PlannerCurriculumRowPayload[]} */
  const rows = [];
  PLANNER_STUDY_CATEGORY_ORDER.forEach(function (code) {
    const groups = bySubj[code];
    if (!groups || !groups.length) {
      if (code === 'misc') {
        rows.push({
          subject: plannerCategoryLabelKo_('misc'),
          subject_code: 'misc',
          textbook_goal: '—',
          lesson_outline: '—',
          link_url: ''
        });
      }
      return;
    }
    groups.forEach(function (bucket) {
      if (!bucket.titles.length && !bucket.lectureIds.length) return;
      rows.push(plannerCurriculumWeekRowFromGroup_(code, bucket, pack));
    });
  });
  return {
    source: rows.length ? 'todos' : 'empty',
    week_index: weekIndex,
    focus_phase: '',
    rows: rows
  };
}

/**
 * 주간 커리큘럼 표 — 해당 주 실제 todo만 (없으면 빈 표).
 * @param {number} weekIndex
 * @param {string[]} weekDateKeys
 * @param {{ courses?: object[], lectures?: object[] }|null|undefined} curriculum
 * @param {object} st
 * @returns {PlannerCurriculumWeekPayload}
 */
function plannerCurriculumWeekPayloadForRender_(weekIndex, weekDateKeys, curriculum, st) {
  return plannerCurriculumWeekPayloadFromMonthTodos_(st, weekIndex, weekDateKeys, curriculum);
}

/**
 * 주차 표 링크 — 시트에 `https://` 없이 넣은 값도 열리게.
 * @param {string} href
 * @returns {string}
 */
function plannerNormalizeCurriculumLinkUrl_(href) {
  const s = String(href != null ? href : '').trim();
  if (!s.length) return '';
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  return 'https://' + s;
}

/**
 * `PlannerCurriculumWeekPayload` → 표 HTML (내용은 전부 `esc` / 링크는 `escAttr`).
 * @param {PlannerCurriculumWeekPayload} payload
 * @returns {string}
 */
function plannerCurriculumWeekTableHtml_(payload) {
  if (!payload || !payload.rows || !payload.rows.length) {
    return (
      '<div class="sp-plan-cur sp-plan-cur--empty" data-sp-plan-cur-source="empty" data-sp-plan-cur-week="' +
      String(payload && payload.week_index != null ? payload.week_index : '') +
      '">' +
      '<p class="sp-plan-cur__empty" role="status">이번 주 등록된 할 일이 없습니다.</p>' +
      '</div>'
    );
  }
  let body = '';
  (payload.rows || []).forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    const subj = String(r.subject != null ? r.subject : '').trim();
    const goal = String(r.textbook_goal != null ? r.textbook_goal : '').trim();
    const outl = String(r.lesson_outline != null ? r.lesson_outline : '').trim();
    const href = plannerNormalizeCurriculumLinkUrl_(r.link_url);
    const linkInner = href.length
      ? '<a class="sp-plan-cur__a" href="' +
        escAttr(href) +
        '" target="_blank" rel="noopener noreferrer">열기</a>'
      : '<span class="sp-plan-cur__noLink">—</span>';
    body +=
      '<tr><th scope="row">' +
      esc(subj) +
      '</th><td class="sp-plan-cur__goal">' +
      esc(goal) +
      '</td><td class="sp-plan-cur__outline">' +
      esc(outl) +
      '</td><td class="sp-plan-cur__link">' +
      linkInner +
      '</td></tr>';
  });
  return (
    '<div class="sp-plan-cur" data-sp-plan-cur-source="' +
    esc(payload.source) +
    '" data-sp-plan-cur-week="' +
    String(payload.week_index) +
    '">' +
    '<table class="sp-plan-cur__tbl">' +
    '<thead><tr>' +
    '<th scope="col" class="sp-plan-cur__thCat">구분</th>' +
    '<th scope="col">교재명 · 학습 목표</th>' +
    '<th scope="col" class="sp-plan-cur__thOut">목차</th>' +
    '<th scope="col" class="sp-plan-cur__thLink">링크</th>' +
    '</tr></thead><tbody>' +
    body +
    '</tbody></table></div>'
  );
}

const PLAN_DEV_HTML = `<div class="sp-plan-devbar" id="sp-plan-devbar" role="region" aria-label="제작용 도구" hidden aria-hidden="true">
  <span class="sp-plan-devbar__label">제작용</span>
  <button type="button" class="btn btn--ghost sp-plan-devbar__btn" id="sp-plan-dev-skip-gate" title="전화·이름 확인 없이 메인 화면만 표시합니다. (추적·GAS 호출 없음)">원페이지만(게이트 생략)</button>
  <button type="button" class="btn btn--ghost sp-plan-devbar__btn" id="sp-plan-dev-init" title="Drive에 플래너 마스터 스프레드시트가 없으면 새로 만들고, 필요한 시트·헤더를 맞춥니다.">마스터 준비(파일·탭)</button>
  <button type="button" class="btn btn--ghost sp-plan-devbar__btn" id="sp-plan-dev-sync" title="주문 원천 DB에서 레지스트리를 갱신합니다. planner_registry에 수기로 넣은 행·프로필·코칭 열은 유지하고, 주문에서 다시 쓰는 행만 회원·주문 정보를 맞춥니다. 학생 todo 데이터는 지우지 않습니다.">동기화(레지스트리+학생파일)</button>
  <span class="sp-plan-devbar__msg" id="sp-plan-dev-msg" aria-live="polite"></span>
</div>
<div class="sp-overlay" id="sp-plan-sync-overlay" hidden aria-hidden="true">
  <div class="sp-overlay-box">
    <div class="sp-spinner" aria-hidden="true"></div>
    <p class="sp-overlay-text" id="sp-plan-sync-overlay-title">동기화 중</p>
    <p class="sp-overlay-sub" id="sp-plan-sync-overlay-desc">화면을 닫지 마세요. 학생 파일이 많을수록 수 분 걸릴 수 있습니다.</p>
  </div>
</div>`;

const PLAN_APP_SHELL_START = `<div class="app-shell app-shell--plan">
  <header class="app-header">
    <div class="brand">
      <button type="button" class="brand-mark sp-plan-adminTap" id="sp-plan-admin-tap" aria-label="플래너"></button>
      <div>
        <div class="brand__title" style="color:#4a148c">솔루션 학습 플래너</div>
        <p class="sp-plan-desc">한 달 학습 일정과 할 일을 달력에서 확인하고 기록합니다.</p>
      </div>
    </div>
  </header>
</div>`;

const PLAN_APP_MAIN_AND_CLOSE = `<main class="app-main sp-plan-app-main app-shell app-shell--plan sp-plan-shell-body" id="sp-plan-app-main" hidden>
    <p class="sp-plan-banner" id="sp-plan-banner" hidden></p>
    <div class="panel panel--hero sp-plan-body">
      <div class="sp-plan-mainTabsRow">
        <nav class="sp-plan-mainTabs" role="tablist" aria-label="플래너 구역">
          <button type="button" class="sp-plan-mainTabs__btn is-active" id="sp-plan-tab-btn-student" role="tab" aria-selected="true" aria-controls="sp-plan-tab-student">학생 정보</button>
          <button type="button" class="sp-plan-mainTabs__btn" id="sp-plan-tab-btn-monthly" role="tab" aria-selected="false" aria-controls="sp-plan-tab-monthly">월간 플래너</button>
        </nav>
        <div class="sp-plan-exportBar" id="sp-plan-export-bar">
          <button type="button" class="btn btn--ghost sp-plan-exportBar__btn" id="sp-plan-pdf-export" title="학생 정보(1페이지)와 월간 플래너(2페이지)를 PDF로 저장합니다">PDF로 저장</button>
          <span class="sp-plan-exportBar__msg" id="sp-plan-pdf-export-msg" hidden aria-live="polite"></span>
        </div>
      </div>
      <div class="sp-plan-tabPanel" id="sp-plan-tab-student" role="tabpanel" aria-labelledby="sp-plan-tab-btn-student">
      <section class="sp-plan-student" id="sp-plan-student-info" aria-labelledby="sp-plan-student-info-title">
        <h2 class="sp-plan-student__title" id="sp-plan-student-info-title">학생 정보</h2>
        <p class="sp-plan-student__hint">비어 있는 항목만 입력할 수 있습니다. 저장한 내용은 이 화면에서 다시 수정할 수 없습니다.</p>
        <div class="sp-plan-student__wrap">
          <table class="sp-plan-student__tbl">
            <tbody id="sp-plan-student-tbody"></tbody>
          </table>
          <div class="sp-plan-student__saveRow" id="sp-plan-student-save-row" hidden>
            <button type="button" class="btn btn--primary" id="sp-plan-student-save">프로필·코칭 저장</button>
            <span class="sp-plan-student__saveMsg" id="sp-plan-student-save-msg" hidden></span>
          </div>
        </div>
        <section class="sp-plan-coaching" id="sp-plan-coaching" hidden aria-hidden="true" aria-label="코칭 안내">
          <div class="sp-plan-coaching__block" id="sp-plan-coaching-static"></div>
          <div class="sp-plan-coaching__block">
            <h3 class="sp-plan-coaching__h3" id="sp-plan-coaching-features-title">계획표 특징</h3>
            <textarea class="sp-plan-coaching__textarea sp-plan-coaching__textarea--features" id="sp-plan-coaching-features" rows="10" maxlength="12000" spellcheck="true" placeholder="평일·주말 학습 특징, 커리큘럼 설계 의도 등"></textarea>
          </div>
          <div class="sp-plan-coaching__block">
            <div class="sp-plan-coaching__blockHead">
              <h3 class="sp-plan-coaching__h3">과목별 상세 안내</h3>
              <button type="button" class="btn btn--ghost sp-plan-coaching__addRow" id="sp-plan-coaching-subject-add">과목 추가</button>
            </div>
            <div class="sp-plan-coaching__tableWrap">
              <table class="sp-plan-coaching__tbl">
                <thead><tr><th scope="col">과목</th><th scope="col">상세 내용</th><th scope="col" class="sp-plan-coaching__thAct"> </th></tr></thead>
                <tbody id="sp-plan-coaching-subjects-body"></tbody>
              </table>
            </div>
        </div>
      </section>
      </section>
      </div>
      <div class="sp-plan-tabPanel" id="sp-plan-tab-monthly" role="tabpanel" aria-labelledby="sp-plan-tab-btn-monthly" hidden aria-hidden="true">
      <section class="sp-plan-monthlyNotice" id="sp-plan-monthly-notice" hidden aria-hidden="true" aria-labelledby="sp-plan-monthly-notice-title">
        <h2 class="sp-plan-monthlyNotice__title" id="sp-plan-monthly-notice-title">월 상담기록</h2>
        <p class="sp-plan-monthlyNotice__hint">달력과 같은 달 기준입니다. 관리자 모드에서는 「프로필·코칭 저장」 또는 「일정 저장하기」 중 아무 버튼이나 누르면 프로필·코칭·일정이 함께 저장됩니다.</p>
        <textarea class="sp-plan-monthlyNotice__body" id="sp-plan-monthly-notice-body" rows="12" maxlength="16000" spellcheck="true" placeholder="이 달 학습계획·수강기간·인증 방법 등"></textarea>
        <p class="sp-plan-monthlyNotice__empty" id="sp-plan-monthly-notice-empty" hidden>이 달에 등록된 안내가 없습니다.</p>
      </section>
      <div class="sp-plan-monthly-title" id="sp-plan-monthly-label">월간 학습 달력</div>
      <div class="sp-plan-calendar-slot" id="sp-plan-calendar-slot" role="region" aria-labelledby="sp-plan-monthly-label"></div>
    </div>
    </div>
  </main>`;

/** 게이트·본문과 분리 — `#sp-plan-app-main[hidden]` 안에 두면 모달이 안 보임 */
const PLAN_ADMIN_MODAL_HTML = `<div class="sp-plan-modal sp-plan-modal--admin" id="sp-plan-admin-modal" hidden aria-hidden="true">
      <div class="sp-plan-modal__backdrop" data-sp-admin-close="1"></div>
      <div class="sp-plan-modal__panel" role="dialog" aria-modal="true" aria-labelledby="sp-plan-admin-modal-title">
        <div class="sp-plan-modal__head">
          <div class="sp-plan-modal__title" id="sp-plan-admin-modal-title">관리자 모드</div>
          <button type="button" class="btn btn--ghost sp-plan-modal__close" data-sp-admin-close="1">닫기</button>
        </div>
        <div class="sp-plan-modal__body sp-plan-admin-modal__body">
          <p class="sp-plan-admin-modal__hint">운영자 암호를 입력해 주세요.</p>
          <label class="sp-plan-admin-modal__lbl">
            <span class="sp-plan-admin-modal__lblText">암호</span>
            <span id="sp-plan-admin-secret-slot" class="sp-plan-admin-modal__inputSlot"></span>
          </label>
          <p class="sp-plan-admin-modal__err" id="sp-plan-admin-modal-err" hidden role="alert"></p>
          <div class="sp-plan-admin-modal__actions">
            <button type="button" class="btn btn--primary" id="sp-plan-admin-modal-submit">확인</button>
          </div>
        </div>
      </div>
    </div>`;

const PLAN_STUDENT_MANUAL_REG_HTML = `<div class="sp-plan-studentManualReg" id="sp-plan-student-manual-reg" hidden aria-hidden="true" aria-labelledby="sp-plan-student-manual-reg-title">
  <h3 class="sp-plan-studentManualReg__title" id="sp-plan-student-manual-reg-title">학생 수기 등록</h3>
  <p class="sp-plan-studentManualReg__hint">이름·휴대전화만 입력하면 수기 등록 목록에 추가되고 학생 플래너 파일이 만들어집니다. 멤버 코드는 서버에서 자동 발급됩니다.</p>
  <div class="sp-plan-studentManualReg__form">
    <label class="sp-plan-studentManualReg__lbl">이름
      <input type="text" id="sp-manual-reg-name" class="sp-plan-studentManualReg__input sp-plan-studentManualReg__input--name" maxlength="80" autocomplete="off" spellcheck="true" placeholder="홍길동"/>
    </label>
    <div class="sp-plan-studentManualReg__telWrap">
      <span class="sp-plan-studentManualReg__lbl" id="sp-manual-reg-phone-legend">휴대전화</span>
      <div class="sp-plan-studentManualReg__tel" role="group" aria-labelledby="sp-manual-reg-phone-legend">
        <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" class="sp-plan-studentManualReg__seg sp-plan-studentManualReg__seg--3" id="sp-manual-reg-p0" aria-label="휴대전화 앞자리 세 자리" autocomplete="off"/>
        <span class="sp-plan-studentManualReg__dash" aria-hidden="true">-</span>
        <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" class="sp-plan-studentManualReg__seg sp-plan-studentManualReg__seg--4" id="sp-manual-reg-p1" aria-label="휴대전화 중간 네 자리" autocomplete="off"/>
        <span class="sp-plan-studentManualReg__dash" aria-hidden="true">-</span>
        <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" class="sp-plan-studentManualReg__seg sp-plan-studentManualReg__seg--4" id="sp-manual-reg-p2" aria-label="휴대전화 끝 네 자리" autocomplete="off"/>
      </div>
    </div>
    <button type="button" class="btn btn--primary sp-plan-studentManualReg__btn" id="sp-manual-reg-submit">수기 등록</button>
  </div>
  <p class="sp-plan-studentManualReg__msg" id="sp-manual-reg-msg" hidden aria-live="polite"></p>
</div>`;

const GATE_HTML = `<div class="sp-plan-gate">
  ${PLAN_STUDENT_MANUAL_REG_HTML}
  <p class="sp-plan-gate__lead">솔패스 수강 확인을 위해 휴대전화 번호를 입력해 주세요.</p>
  <p class="sp-plan-gate__privacy">입력하신 정보는 본인 확인과 플래너 이용에만 사용됩니다.</p>
  <div class="sp-plan-gate__pair" role="group" aria-label="이름 및 휴대전화">
    <div class="sp-plan-gate__stack">
      <label class="sp-plan-gate__lbl" for="sp-plan-name">이름</label>
      <input
        class="sp-plan-gate__input sp-plan-gate__input--name"
        id="sp-plan-name"
        type="text"
        maxlength="40"
        autocomplete="off"
        name="sp-plan-gate-display-name"
        placeholder="동일 번호가 여러 명일 때만 입력"
      />
    </div>
    <div class="sp-plan-gate__stack sp-plan-gate__stack--tel">
      <span class="sp-plan-gate__lbl" id="sp-plan-phone-legend">휴대전화</span>
      <div class="sp-plan-gate__tel" role="group" aria-labelledby="sp-plan-phone-legend" autocomplete="off">
        <input
          class="sp-plan-gate__input sp-plan-gate__input--seg3"
          id="sp-plan-p0"
          type="tel"
          inputmode="numeric"
          maxlength="3"
          autocomplete="one-time-code"
          name="sp-plan-gate-tel-a"
          aria-label="휴대전화 앞자리 세 자리"
        />
        <span class="sp-plan-gate__dash" aria-hidden="true">-</span>
        <input
          class="sp-plan-gate__input sp-plan-gate__input--seg4"
          id="sp-plan-p1"
          type="tel"
          inputmode="numeric"
          maxlength="4"
          autocomplete="one-time-code"
          name="sp-plan-gate-tel-b"
          aria-label="휴대전화 중간 네 자리"
        />
        <span class="sp-plan-gate__dash" aria-hidden="true">-</span>
        <input
          class="sp-plan-gate__input sp-plan-gate__input--seg4"
          id="sp-plan-p2"
          type="tel"
          inputmode="numeric"
          maxlength="4"
          autocomplete="one-time-code"
          name="sp-plan-gate-tel-c"
          aria-label="휴대전화 끝 네 자리"
        />
      </div>
      <p class="sp-plan-gate__telhint">숫자만 입력해 주세요. (010-0000-0000 형식)</p>
    </div>
  </div>
  <p class="sp-plan-gate__status" id="sp-plan-gate-status" hidden aria-live="polite" aria-busy="false"></p>
  <p class="sp-plan-gate__err" id="sp-plan-gate-err" hidden></p>
  <button type="button" class="btn btn--primary sp-plan-gate__btn" id="sp-plan-gate-submit">확인</button>
</div>`;

/** @param {string[]} segs */
function readPhoneSegments_(segs) {
  return [
    String(segs[0] != null ? segs[0] : '').replace(/\D/g, ''),
    String(segs[1] != null ? segs[1] : '').replace(/\D/g, ''),
    String(segs[2] != null ? segs[2] : '').replace(/\D/g, '')
  ];
}

/**
 * 휴대전화 세 칸: input·붙여넣기에서 숫자만 유지, 3·4·4.
 * @param {HTMLInputElement|null} p0
 * @param {HTMLInputElement|null} p1
 * @param {HTMLInputElement|null} p2
 */
function plannerWirePhoneSegInputs_(p0, p1, p2) {
  if (!p0 || !p1 || !p2) return;

  const MAXL = [3, 4, 4];

  function digitsOnly(s) {
    return String(s != null ? s : '').replace(/\D/g, '');
  }

  function setSeg(el, max, raw) {
    const d = digitsOnly(raw).slice(0, max);
    if (el.value !== d) {
      el.value = d;
    }
    return d.length;
  }

  /** 짧은 붙여넣기: 0번 칸부터 순서대로 채움 */
  function fillFromStart(d) {
    const x = digitsOnly(d);
    if (!x.length) return;
    p0.value = x.slice(0, 3);
    var rest = x.slice(3);
    p1.value = rest.slice(0, 4);
    rest = rest.slice(4);
    p2.value = rest.slice(0, 4);
    if (p2.value.length < 4) p2.focus();
    else if (p1.value.length < 4) p1.focus();
    else p0.focus();
  }

  /**
   * @param {HTMLInputElement} el
   * @param {number} idx
   */
  function onInputCell(el, idx) {
    const max = MAXL[idx];
    const len = setSeg(el, max, el.value);
    if (len >= max && idx < 2) {
      const next = idx === 0 ? p1 : p2;
      window.setTimeout(function () {
        next.focus();
        try {
          next.setSelectionRange(0, next.value.length);
        } catch (_e) {}
      }, 0);
    }
  }

  [p0, p1, p2].forEach(function (el, idx) {
    el.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const okNav = [
        'Backspace',
        'Delete',
        'Tab',
        'Escape',
        'Enter',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End'
      ];
      if (okNav.indexOf(e.key) >= 0) {
        if (e.key === 'Backspace' && el.value.length === 0) {
          if (idx > 0) {
            const prev = idx === 1 ? p0 : p1;
            prev.focus();
            const pl = prev.value.length;
            prev.setSelectionRange(pl, pl);
          }
        }
        return;
      }
      /* 숫자 정리는 input(setSeg)만 — keydown에서 막으면 글자 조합 중 입력이 잘릴 수 있음 */
    });

    el.addEventListener('input', function () {
      onInputCell(el, idx);
    });

    el.addEventListener('paste', function (e) {
      e.preventDefault();
      const d = digitsOnly(e.clipboardData && e.clipboardData.getData('text'));
      if (!d.length) return;
      if (d.length >= 10) {
        p0.value = d.slice(0, 3);
        p1.value = d.slice(3, 7);
        p2.value = d.slice(7, 11);
        p2.focus();
        return;
      }
      if (idx === 0) {
        fillFromStart(d);
      } else if (idx === 1) {
        p1.value = d.slice(0, 4);
        p2.value = d.slice(4, 8);
        p2.focus();
      } else {
        p2.value = d.slice(0, 4);
        p2.focus();
      }
    });
  });
}

/**
 * 게이트 휴대전화 세 칸.
 * @param {HTMLElement} root
 */
function wirePlanPhoneDigitsOnly_(root) {
  plannerWirePhoneSegInputs_(
    /** @type {HTMLInputElement | null} */ (root.querySelector('#sp-plan-p0')),
    /** @type {HTMLInputElement | null} */ (root.querySelector('#sp-plan-p1')),
    /** @type {HTMLInputElement | null} */ (root.querySelector('#sp-plan-p2'))
  );
}

/** 일일 타임라인 행 순서(6…23, 0…5) · `시_칸` 키 · 프론트만 */
const PLAN_TIMELINE_HOURS_ORDERED = Object.freeze([
  6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5
]);
const PLAN_TIMELINE_CELLS_PER_HOUR = 6;
const PLAN_TIMELINE_CELL_MIN = 10;
/** 타임라인 막대 칸 라벨 — 제목(공백 제거)을 칸마다 이 글자 수만큼 */
const PLAN_TIMELINE_BAR_LABEL_CHUNK_LEN = 4;
/** 예전 30분 슬롯 마이그레이션용 */
const PLAN_TIMELINE_LEGACY_START_H = 6;
const PLAN_TIMELINE_LEGACY_STEP_MIN = 30;

/** 일일 목록에 항상 노출. 타임라인 과목별 합계·달력 ‘시간표’ 분 배지에서는 제외 */
const PLAN_FIXED_SLEEP_TODO_ID = '__sp_routine_sleep';
const PLAN_FIXED_MEAL_TODO_ID = '__sp_routine_meal';
/** DB `category` — 고정 일정(합산·배지 제외) */
const PLAN_CATEGORY_FIXED = 'fixed';
/** DB `category` — 달력 별·일일 배너만 표시(할 일·합산·타임라인 제외) */
const PLAN_CATEGORY_EVENT = 'event';
/** DB `category` — 일일 모달 루틴(취침·식사). `timeline_slots` 칠한 뒤에만 POST */
const PLAN_CATEGORY_ROUTINE = 'routine';

/**
 * 학습 과목 단일 소스 — 코드·라벨·짧은 표기. 새 과목은 여기 + `styles.css` 동일 `--{code}` 패턴.
 * @type {{ code: string, label: string, short: string }[]}
 */
const PLANNER_STUDY_SUBJECT_DEFS = [
  { code: 'vocab', label: '어휘', short: '어' },
  { code: 'grammar', label: '문법', short: '문' },
  { code: 'logic', label: '논리', short: '논' },
  { code: 'read', label: '독해', short: '독' },
  { code: 'comprehensive', label: '종합', short: '종' },
  { code: 'math', label: '수학', short: '수' },
  { code: 'toeic_rc', label: '토익RC', short: 'RC' },
  { code: 'toeic_lc', label: '토익LC', short: 'LC' },
  { code: 'misc', label: '기타', short: '기' }
];

/** 같은 날 표시·`sort_key` 부여 (드래그 순서 없음). */
const PLANNER_STUDY_CATEGORY_ORDER = PLANNER_STUDY_SUBJECT_DEFS.map(function (d) {
  return d.code;
});

/** @param {string} code @returns {boolean} */
function plannerIsStudyCategoryCode_(code) {
  const c = String(code != null ? code : '').trim();
  return PLANNER_STUDY_CATEGORY_ORDER.indexOf(c) >= 0;
}

/** @param {string} code @returns {string} */
function plannerStudyCategoryLabelFromCode_(code) {
  const c = String(code != null ? code : '').trim();
  for (let i = 0; i < PLANNER_STUDY_SUBJECT_DEFS.length; i++) {
    if (PLANNER_STUDY_SUBJECT_DEFS[i].code === c) return PLANNER_STUDY_SUBJECT_DEFS[i].label;
  }
  return '';
}

/** @param {string} code @returns {string} */
function plannerStudyCategoryShortFromCode_(code) {
  const c = String(code != null ? code : '').trim();
  for (let i = 0; i < PLANNER_STUDY_SUBJECT_DEFS.length; i++) {
    if (PLANNER_STUDY_SUBJECT_DEFS[i].code === c) return PLANNER_STUDY_SUBJECT_DEFS[i].short;
  }
  return '';
}

/**
 * 직접등록 등 `<select>` 옵션 HTML.
 * @param {{ selected?: string, includeFixed?: boolean }} [opts]
 * @returns {string}
 */
function plannerStudyCategorySelectOptionsHtml_(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const selected = String(o.selected != null ? o.selected : 'misc').trim() || 'misc';
  let html = '';
  PLANNER_STUDY_SUBJECT_DEFS.forEach(function (d) {
    html +=
      '<option value="' +
      d.code +
      '"' +
      (d.code === selected ? ' selected' : '') +
      '>' +
      d.label +
      '</option>';
  });
  if (o.includeFixed) {
    html += '<option value="fixed">고정</option>';
  }
  return html;
}

/** @returns {Record<string, number>} */
function plannerStudyCategoryMinutesAccumulator_() {
  /** @type {Record<string, number>} */
  const acc = {};
  PLANNER_STUDY_CATEGORY_ORDER.forEach(function (code) {
    acc[code] = 0;
  });
  return acc;
}

/** task_id 등 문자열에서 학습 과목 코드 추출(없으면 `misc`). @param {string} id @returns {string} */
function plannerTodoCategoryToken_(id) {
  const s = String(id != null ? id : '');
  if (plannerIsStudyCategoryCode_(s)) return s;
  const core = PLANNER_STUDY_CATEGORY_ORDER.filter(function (c) {
    return c !== 'misc';
  }).join('|');
  const m = s.match(new RegExp('(' + core + ')'));
  return m ? m[1] : 'misc';
}

/**
 * @param {object|null|undefined} row
 * @returns {boolean} `trace_dates`만으로 그날에 보이는 회색 흔적(본행 아님)
 */
function plannerIsTraceGhostDisplay_(row) {
  return Boolean(row && typeof row === 'object' && row._spTraceGhost === true);
}

/**
 * 취침·식사·고정일정 — 월간 합산·배지·과목별 공부 시간에 넣지 않음.
 * @param {string} taskId
 * @param {string} [category]
 * @returns {boolean}
 */
function plannerIsExcludedFromStudyTotals_(taskId, category) {
  if (plannerIsRoutineExcludedFromStudyTotals_(taskId)) return true;
  const c = String(category != null ? category : '').trim();
  if (c === PLAN_CATEGORY_FIXED || c === PLAN_CATEGORY_EVENT || c === 'memo') return true;
  return false;
}

/**
 * @param {object} st
 * @param {string} ymd
 * @returns {object[]}
 */
function plannerEventsForDay_(st, ymd) {
  const day = String(ymd || '').trim();
  return plannerMonthTodosForDay_(st, day).filter(function (r) {
    return r && String(r.category || '').trim() === PLAN_CATEGORY_EVENT;
  });
}

/**
 * @param {object[]} events
 * @returns {string}
 */
function plannerDayEventHoverTitle_(events) {
  return events
    .map(function (r) {
      return String(r.title != null ? r.title : '').trim();
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {object} st
 * @param {string} dateYmd
 * @returns {string}
 */
function plannerDayModalEventStripHtml_(st, dateYmd) {
  const events = plannerEventsForDay_(st, dateYmd);
  if (!events.length) return '';
  const items = events
    .map(function (r) {
      const t = String(r.title != null ? r.title : '').trim();
      if (!t) return '';
      return '<li class="sp-plan-day__eventItem">' + esc(t) + '</li>';
    })
    .filter(Boolean)
    .join('');
  if (!items) return '';
  return (
    '<div class="sp-plan-day__eventStripInner" role="group" aria-label="이벤트">' +
    '<div class="sp-plan-day__eventStripHead">' +
    '<span class="sp-plan-day__eventStripIcon" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d="M12 2.5l2.86 5.79 6.39.93-4.62 4.51 1.09 6.36L12 17.77l-5.72 3.01 1.09-6.36-4.62-4.51 6.39-.93L12 2.5z"/></svg>' +
    '</span>' +
    '<span class="sp-plan-day__eventStripTitle">이벤트</span>' +
    '</div>' +
    '<ul class="sp-plan-day__eventList">' +
    items +
    '</ul></div>'
  );
}

/**
 * @param {HTMLElement} root
 */
function plannerRefreshDayModalEventStrip_(root) {
  const el = root.querySelector('#sp-plan-day-event-strip');
  if (!el) return;
  const st = root.__spPlanState;
  if (!st || !st.selectedDate) {
    el.innerHTML = '';
    el.setAttribute('hidden', 'hidden');
    return;
  }
  const html = plannerDayModalEventStripHtml_(st, st.selectedDate);
  if (!html) {
    el.innerHTML = '';
    el.setAttribute('hidden', 'hidden');
    return;
  }
  el.innerHTML = html;
  el.removeAttribute('hidden');
}

/**
 * @param {string} taskId
 * @returns {boolean}
 */
function plannerIsRoutineTaskId_(taskId) {
  const id = String(taskId != null ? taskId : '').trim();
  return id === PLAN_FIXED_SLEEP_TODO_ID || id === PLAN_FIXED_MEAL_TODO_ID;
}

/**
 * @param {string} taskId
 * @param {string} [category]
 * @returns {boolean}
 */
function plannerIsRoutineExcludedFromStudyTotals_(taskId, category) {
  if (plannerIsRoutineTaskId_(taskId)) return true;
  return String(category != null ? category : '').trim() === PLAN_CATEGORY_ROUTINE;
}

/**
 * @param {string} dateYmd
 * @returns {{ task_id: string, title: string, date: string, category: string, lecture_id: string, timeline_slots: string, sort_key: number, mark: string, trace_dates: string, created_date: string, updated_date: string }[]}
 */
function plannerFixedRoutineTodoRows_(dateYmd) {
  const y = String(dateYmd || '').trim();
  const today = plannerTodayYmdSeoul_();
  /**
   * @param {string} taskId
   * @param {string} title
   * @param {number} sortKey
   */
  function row(taskId, title, sortKey) {
    return {
      task_id: taskId,
      title: title,
      date: y,
      category: PLAN_CATEGORY_ROUTINE,
      lecture_id: '',
      timeline_slots: '[]',
      sort_key: sortKey,
      mark: 'none',
      trace_dates: '[]',
      created_date: today,
      updated_date: today
    };
  }
  return [
    row(PLAN_FIXED_SLEEP_TODO_ID, '취침시간', -1000),
    row(PLAN_FIXED_MEAL_TODO_ID, '식사시간', -999)
  ];
}

/**
 * 루틴 행은 타임라인을 칠한 경우에만 월 apply 본문에 포함.
 * @param {object|null} row
 * @returns {boolean}
 */
function plannerShouldIncludeRowInMonthApply_(row) {
  if (!row || typeof row !== 'object') return false;
  if (row._deleted) return false;
  const cat = String(row.category != null ? row.category : '').trim();
  const tid = String(row.task_id != null ? row.task_id : '').trim();
  if (cat !== PLAN_CATEGORY_ROUTINE && !plannerIsRoutineTaskId_(tid)) return true;
  const raw = String(row.timeline_slots != null ? row.timeline_slots : '').trim();
  if (!raw.length || raw === '[]') return false;
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) && j.length > 0;
  } catch (_e) {
    return false;
  }
}

/**
 * @param {string} dateYmd
 * @param {{ task_id: string, title: string, date: string, category: string, lecture_id: string, timeline_slots: string, sort_key: number, mark: string, trace_dates: string, created_date: string, updated_date: string }[]} list
 */
function plannerWithFixedRoutineTodosFirst_(dateYmd, list) {
  const idSeen = {};
  (list || []).forEach(function (r) {
    if (r && r.task_id) idSeen[String(r.task_id)] = true;
  });
  const prefix = [];
  plannerFixedRoutineTodoRows_(dateYmd).forEach(function (fr) {
    if (!idSeen[String(fr.task_id)]) prefix.push(fr);
  });
  return prefix.concat(list || []);
}

/**
 * @param {string} cat
 * @returns {string}
 */
function plannerCategoryLabelKo_(cat) {
  const c = String(cat != null ? cat : '').trim() || 'misc';
  const fromStudy = plannerStudyCategoryLabelFromCode_(c);
  if (fromStudy) return fromStudy;
  const m = {
    fixed: '고정일정',
    event: '이벤트',
    routine: '루틴'
  };
  return m[c] != null ? m[c] : c;
}

/**
 * @param {string} cat
 * @returns {number}
 */
function plannerStudyCategoryRank_(cat) {
  const c = String(cat != null ? cat : '').trim() || 'misc';
  if (c === PLAN_CATEGORY_FIXED) return -9000;
  if (c === PLAN_CATEGORY_ROUTINE) return -8000;
  if (c === 'memo') return 9000;
  const ix = PLANNER_STUDY_CATEGORY_ORDER.indexOf(c);
  return ix >= 0 ? ix : PLANNER_STUDY_CATEGORY_ORDER.length;
}

/**
 * 한글 제목·라벨 정렬 — 숫자는 크기 순(예: p.2, p.7, p.12), 문자는 가나다순.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function plannerLocaleCompareKo_(a, b) {
  return String(a != null ? a : '').localeCompare(String(b != null ? b : ''), 'ko', { numeric: true });
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function plannerCompareMonthTodoDisplay_(a, b) {
  const ga = plannerIsTraceGhostDisplay_(a) ? 1 : 0;
  const gb = plannerIsTraceGhostDisplay_(b) ? 1 : 0;
  if (ga !== gb) return ga - gb;
  const ra = plannerStudyCategoryRank_(String(a.category != null ? a.category : ''));
  const rb = plannerStudyCategoryRank_(String(b.category != null ? b.category : ''));
  if (ra !== rb) return ra - rb;
  const tc = plannerLocaleCompareKo_(String(a.title != null ? a.title : ''), String(b.title != null ? b.title : ''));
  if (tc !== 0) return tc;
  return plannerLocaleCompareKo_(String(a.task_id != null ? a.task_id : ''), String(b.task_id != null ? b.task_id : ''));
}

/**
 * 보는 달 각 날짜별 `sort_key` — 과목(어휘→…→기타), 같은 과목 안 제목 가나다+숫자순.
 * @param {object} st
 */
function plannerAssignCategorySortKeysForViewMonth_(st) {
  plannerEnsureMonthTodos_(st);
  const view = st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime()) ? st.viewMonth : new Date();
  const pfx = plannerMonthYmdPrefix_(view);
  /** @type {Record<string, object[]>} */
  const byDay = {};
  st.monthTodos.forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    const d = String(r.date != null ? r.date : '').trim();
    if (d.indexOf(pfx) !== 0) return;
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(r);
  });
  Object.keys(byDay).forEach(function (ymd) {
    const rows = byDay[ymd].slice().sort(plannerCompareMonthTodoDisplay_);
    rows.forEach(function (row, ix) {
      row.sort_key = ix;
    });
  });
}

/**
 * 왼쪽 표에서 **과목 열 rowspan** 기준: 루틴(취침·식사)은 각각 분리, 그 외는 같은 category 연속만 병합.
 * @param {{ task_id?: string, category?: string }|null} r
 * @returns {string}
 */
function plannerTodoSideMergeKey_(r) {
  if (!r) return '';
  if (plannerIsTraceGhostDisplay_(r)) {
    return '\0trace\0' + String(r.task_id != null ? r.task_id : '') + '\0' + String(r._spTraceOnDate || '');
  }
  const id = String(r.task_id != null ? r.task_id : '').trim();
  if (plannerIsRoutineExcludedFromStudyTotals_(id)) return '\0routine\0' + id;
  if (String(r.category != null ? r.category : '').trim() === PLAN_CATEGORY_FIXED) return '\0fixed\0' + id;
  return '\0cat\0' + (String(r.category != null ? r.category : '').trim() || 'misc');
}

/**
 * @param {{ task_id?: string, category?: string }|null} r
 * @returns {string}
 */
function plannerTodoSideSubjectLabel_(r) {
  if (!r) return '';
  if (plannerIsTraceGhostDisplay_(r)) return '밀림';
  const id = String(r.task_id != null ? r.task_id : '').trim();
  if (id === PLAN_FIXED_SLEEP_TODO_ID) return '취침';
  if (id === PLAN_FIXED_MEAL_TODO_ID) return '식사';
  if (String(r.category != null ? r.category : '').trim() === PLAN_CATEGORY_FIXED) return '고정';
  return plannerCategoryLabelKo_(r.category);
}

function plannerPad2_(n) {
  return String(n < 10 ? '0' : '') + String(n);
}

function plannerYmdFromParts_(y, m0, day) {
  return String(y) + '-' + plannerPad2_(m0 + 1) + '-' + plannerPad2_(day);
}

/** @returns {string} 서울 기준 오늘 `YYYY-MM-DD` */
function plannerTodayYmdSeoul_() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch (_e) {
    const d = new Date();
    return plannerYmdFromParts_(d.getFullYear(), d.getMonth(), d.getDate());
  }
}

/**
 * @param {unknown} v `YYYY-MM-DD` 또는 ISO 시각 문자열
 * @returns {string}
 */
function plannerYmdFromDateField_(v) {
  const s = String(v != null ? v : '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function plannerParseTraceDatesJson_(raw) {
  const s = String(raw != null ? raw : '').trim();
  if (!s.length) return [];
  try {
    const j = JSON.parse(s);
    if (!Array.isArray(j)) return [];
    const out = [];
    j.forEach(function (d) {
      const y = plannerYmdFromDateField_(d);
      if (y && out.indexOf(y) < 0) out.push(y);
    });
    out.sort();
    return out;
  } catch (_e) {
    return [];
  }
}

/**
 * @param {string[]} list
 * @returns {string}
 */
function plannerTraceDatesToJson_(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  arr.sort();
  return JSON.stringify(arr);
}

/**
 * @param {object} row
 * @param {string} ymd
 * @returns {boolean}
 */
function plannerTraceDatesIncludes_(row, ymd) {
  const d = String(ymd || '').trim();
  if (!d) return false;
  return plannerParseTraceDatesJson_(row && row.trace_dates).indexOf(d) >= 0;
}

/**
 * @param {string} fromDateYmd
 * @param {string} toDateYmd
 * @returns {boolean} `to`가 `from`보다 뒤(밀림)이면 true — `trace_dates`에만 기록
 */
function plannerIsPostponeMove_(fromDateYmd, toDateYmd) {
  const a = String(fromDateYmd || '').trim();
  const b = String(toDateYmd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return false;
  return b > a;
}

/**
 * 같은 `task_id` 행: `date`만 변경. 밀림이면 떠난 날을 `trace_dates`에 append (행 추가 없음).
 * @param {object} row
 * @param {string} toDateYmd
 */
function plannerApplyTodoDateMove_(row, toDateYmd) {
  if (!row || typeof row !== 'object') return;
  const fromD = String(row.date != null ? row.date : '').trim();
  const toD = String(toDateYmd || '').trim();
  if (!fromD || !toD || fromD === toD) return;
  if (plannerIsPostponeMove_(fromD, toD)) {
    const list = plannerParseTraceDatesJson_(row.trace_dates);
    if (list.indexOf(fromD) < 0) list.push(fromD);
    row.trace_dates = plannerTraceDatesToJson_(list);
  }
  row.date = toD;
  row.updated_date = plannerTodayYmdSeoul_();
}

/**
 * @param {object|null} row
 * @returns {boolean}
 */
function plannerTodoCanDrag_(row) {
  if (!row || typeof row !== 'object' || row._deleted) return false;
  if (plannerIsTraceGhostDisplay_(row)) return false;
  const cat = String(row.category != null ? row.category : '').trim();
  if (cat === PLAN_CATEGORY_FIXED || cat === PLAN_CATEGORY_EVENT || cat === 'memo') return false;
  if (plannerIsRoutineExcludedFromStudyTotals_(row.task_id, cat)) return false;
  return true;
}

/**
 * 커리큘럼 행 날짜 이동 시 새 `task_id` (`lec_{id}_{date}`) 계산·중복 검사.
 * @param {object} st
 * @param {object} row
 * @param {string} newDateYmd
 * @returns {{ newTid: string, err: string }}
 */
function plannerLecTaskIdMovePlan_(st, row, newDateYmd) {
  if (!st || !row) return { newTid: '', err: '' };
  const toD = String(newDateYmd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toD)) return { newTid: '', err: '' };
  let lid = String(row.lecture_id != null ? row.lecture_id : '').trim();
  const tid0 = String(row.task_id != null ? row.task_id : '').trim();
  const m = /^lec_(.+)_(\d{4}-\d{2}-\d{2})$/.exec(tid0);
  if (!lid && m) lid = String(m[1]).trim();
  if (!lid && tid0.indexOf('lec_') !== 0) return { newTid: '', err: '' };
  if (!lid) return { newTid: '', err: '' };
  const newTid = 'lec_' + lid + '_' + toD;
  if (newTid === tid0) return { newTid: newTid, err: '' };
  const dup = st.monthTodos.some(function (r) {
    return r && r !== row && !r._deleted && String(r.task_id || '').trim() === newTid;
  });
  if (dup) return { newTid: newTid, err: '같은 날짜에 이미 같은 회차가 있습니다.' };
  return { newTid: newTid, err: '' };
}

/**
 * 관리자 드래그 — 날짜 이동 + 밀림 흔적(`trace_dates`).
 * @param {object} st
 * @param {string} taskId
 * @param {string} fromYmd
 * @param {string} toYmd
 * @returns {string} 빈 문자열=성공
 */
function plannerMoveMonthTodoByDrag_(st, taskId, fromYmd, toYmd) {
  plannerEnsureMonthTodos_(st);
  const tid = String(taskId || '').trim();
  const from = String(fromYmd || '').trim();
  const to = String(toYmd || '').trim();
  if (!tid || !from || !to) return '날짜를 확인해 주세요.';
  if (from === to) return '';
  const row = plannerFindMonthTodoByTaskId_(st, tid);
  if (!row || String(row.date || '').trim() !== from) {
    return '이동할 일정을 찾을 수 없습니다.';
  }
  if (!plannerTodoCanDrag_(row)) return '이 일정은 옮길 수 없습니다.';
  const lecPlan = plannerLecTaskIdMovePlan_(st, row, to);
  if (lecPlan.err) return lecPlan.err;
  plannerApplyTodoDateMove_(row, to);
  if (lecPlan.newTid && lecPlan.newTid !== tid) {
    row.task_id = lecPlan.newTid;
  }
  if (!row._fromServer) row.updated_date = plannerTodayYmdSeoul_();
  plannerInvalidateDayTimelineCache_(st, from);
  plannerInvalidateDayTimelineCache_(st, to);
  plannerRebuildQuickPostPayload_(st);
  return '';
}

/**
 * `trace_dates`에서 하루 흔적만 제거(본행 `date` 유지).
 * @param {object} st
 * @param {string} taskId
 * @param {string} traceYmd
 * @returns {boolean}
 */
function plannerRemoveTraceDateFromTodo_(st, taskId, traceYmd) {
  plannerEnsureMonthTodos_(st);
  const tid = String(taskId || '').trim();
  const d = String(traceYmd || '').trim();
  if (!tid || !d) return false;
  const row = plannerFindMonthTodoByTaskId_(st, tid);
  if (!row) return false;
  const list = plannerParseTraceDatesJson_(row.trace_dates).filter(function (x) {
    return x !== d;
  });
  if (list.length === plannerParseTraceDatesJson_(row.trace_dates).length) return false;
  row.trace_dates = plannerTraceDatesToJson_(list);
  if (!row._fromServer) row.updated_date = plannerTodayYmdSeoul_();
  plannerRebuildQuickPostPayload_(st);
  return true;
}

/**
 * @param {HTMLElement} root
 * @param {string} taskId
 * @param {string} traceYmd
 */
function plannerDeleteTraceFromCalendar_(root, taskId, traceYmd) {
  if (!root.__spPlanAdminMode) return;
  const st = root.__spPlanState;
  const slot = root.querySelector('#sp-plan-calendar-slot');
  if (!st) return;
  plannerRemoveTraceDateFromTodo_(st, taskId, traceYmd);
  plannerRefreshPostPreview_(root);
  if (typeof root.__spPlanRerenderMonth === 'function') {
    root.__spPlanRerenderMonth();
  }
  const modal = root.querySelector('#sp-plan-day-modal');
  if (modal && st.selectedDate && !modal.hasAttribute('hidden')) {
    if (typeof root.__spPlanRefreshOpenDayModal === 'function') {
      root.__spPlanRefreshOpenDayModal();
    }
  }
  if (slot) plannerHideTodoContextMenu_(slot);
}

/**
 * @param {HTMLElement} slot
 * @param {{ isTrace?: boolean, taskIds?: string[], mode?: string }} pending
 */
function plannerUpdateCalendarCtxMenuLabels_(slot, pending) {
  const menu = slot.querySelector('#sp-plan-calendar-ctx-menu');
  if (!menu) return;
  const btnReg = menu.querySelector('[data-sp-ctx-action="register"]');
  const btnEventReg = menu.querySelector('[data-sp-ctx-action="event-register"]');
  const btnEventDel = menu.querySelector('[data-sp-ctx-action="event-delete"]');
  const btnTodo = menu.querySelector('[data-sp-ctx-action="delete"]');
  const btnTrace = menu.querySelector('[data-sp-ctx-action="delete-trace"]');
  const trace = Boolean(pending && pending.isTrace);
  const hasTasks = Boolean(pending && pending.taskIds && pending.taskIds.length);
  const hasEvents = Boolean(pending && pending.hasEvents);
  if (btnReg instanceof HTMLElement) {
    btnReg.removeAttribute('hidden');
  }
  if (btnEventReg instanceof HTMLElement) {
    btnEventReg.removeAttribute('hidden');
  }
  if (btnEventDel instanceof HTMLElement) {
    if (hasEvents) btnEventDel.removeAttribute('hidden');
    else btnEventDel.setAttribute('hidden', 'hidden');
  }
  if (btnTodo instanceof HTMLElement) {
    if (trace || !hasTasks) btnTodo.setAttribute('hidden', 'hidden');
    else btnTodo.removeAttribute('hidden');
  }
  if (btnTrace instanceof HTMLElement) {
    if (trace) btnTrace.removeAttribute('hidden');
    else btnTrace.setAttribute('hidden', 'hidden');
  }
}

/**
 * LEGACY CODE: 상단 「개별 등록」 패널 HTML — 달력 우클릭 「일정 등록」 모달로 대체. **렌더하지 않음.** append·cascade 로직은 재사용.
 * @param {string} defManDue
 * @returns {string}
 */
function plannerLegacyManualRegPanelHtml_(defManDue) {
  return (
    '<div class="sp-plan-todoReg__panel sp-plan-todoReg__panel--manual" id="sp-plan-manual-reg" aria-label="개별 등록">' +
    '<div class="sp-plan-todoReg__panelHead">' +
    '<span class="sp-plan-todoReg__panelBadge sp-plan-todoReg__panelBadge--manual" aria-hidden="true">개별</span>' +
    '<div class="sp-plan-todoReg__panelHeadText">' +
    '<h3 class="sp-plan-todoReg__panelTitle">개별 등록</h3>' +
    '<p class="sp-plan-todoReg__panelSub">제목을 직접 쓰거나, 등록된 강좌·회차를 골라 한 건씩 추가합니다.</p>' +
    '</div></div>' +
    '<p class="sp-plan-manual__err" id="sp-plan-manual-err" hidden></p>' +
    '<p class="sp-plan-manual__err sp-plan-manual__err--curr" id="sp-plan-curr-err" hidden></p>' +
    '<p class="sp-plan-curr__hint" id="sp-curr-catalog-hint" hidden></p>' +
    '<div class="sp-plan-manual__mode" role="group" aria-label="개별 등록 방식">' +
    '<button type="button" class="btn btn--ghost sp-plan-manual__modeBtn is-active" id="sp-manual-mode-direct" aria-pressed="true">직접 입력</button>' +
    '<button type="button" class="btn btn--ghost sp-plan-manual__modeBtn" id="sp-manual-mode-curriculum" aria-pressed="false">커리큘럼</button>' +
    '</div>' +
    '<div id="sp-plan-manual-direct" class="sp-plan-manual__block">' +
    '<div class="sp-plan-manual__grid">' +
    '<label class="sp-plan-manual__lbl">제목<input type="text" id="sp-manual-title" class="sp-plan-manual__input" maxlength="200" placeholder="예: 모의고사 오답" autocomplete="off"/></label>' +
    '<label class="sp-plan-manual__lbl">날짜<input type="date" id="sp-manual-due" class="sp-plan-manual__input" value="' +
    esc(defManDue) +
    '"/></label>' +
    '<label class="sp-plan-manual__lbl">과목<select id="sp-manual-cat" class="sp-plan-manual__select">' +
    plannerStudyCategorySelectOptionsHtml_({ selected: 'misc', includeFixed: true }) +
    '</select></label>' +
    '</div>' +
    '<button type="button" class="btn btn--primary sp-plan-manual__add" id="sp-manual-add">할 일 추가</button>' +
    '</div>' +
    '<div id="sp-plan-manual-curriculum" class="sp-plan-manual__block" hidden>' +
    '<div class="sp-plan-manual__grid sp-plan-manual__grid--curr">' +
    '<label class="sp-plan-manual__lbl">과목<select id="sp-curr-subj" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="과목 선택"></select></label>' +
    '<label class="sp-plan-manual__lbl">선생님<select id="sp-curr-instructor" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="선생님 선택"></select></label>' +
    '<label class="sp-plan-manual__lbl">강좌명<select id="sp-curr-course" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="강좌명 선택"></select></label>' +
    '<label class="sp-plan-manual__lbl">회차<select id="sp-curr-lecture" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="회차 선택"></select></label>' +
    '<label class="sp-plan-manual__lbl">날짜<input type="date" id="sp-curr-due" class="sp-plan-manual__input" value="' +
    esc(defManDue) +
    '"/></label>' +
    '<label class="sp-plan-manual__lbl sp-plan-manual__lbl--preview">제목<input type="text" id="sp-curr-title-preview" class="sp-plan-manual__input sp-plan-manual__control--fit" readonly tabindex="-1" aria-readonly="true" data-sp-fit-ph="회차를 선택하면 자동 입력" placeholder="회차를 선택하면 자동 입력"/></label>' +
    '</div>' +
    '<button type="button" class="btn btn--primary sp-plan-manual__add" id="sp-curr-add">할 일 추가</button>' +
    '</div></div>'
  );
}

/**
 * 달력 우클릭 「일정 등록」 모달 본문(개별 등록과 동일 필드, 날짜 입력 없음).
 * @param {string} fixedTimeOptsStart
 * @param {string} fixedTimeOptsEnd
 * @returns {string}
 */
function plannerCalRegModalBodyHtml_(fixedTimeOptsStart, fixedTimeOptsEnd) {
  return (
    '<p class="sp-plan-manual__err" id="sp-calreg-manual-err" hidden></p>' +
    '<p class="sp-plan-manual__err sp-plan-manual__err--curr" id="sp-calreg-curr-err" hidden></p>' +
    '<p class="sp-plan-curr__hint" id="sp-calreg-curr-catalog-hint" hidden></p>' +
    '<div class="sp-plan-manual__mode" role="group" aria-label="등록 방식">' +
    '<button type="button" class="btn btn--ghost sp-plan-manual__modeBtn is-active" id="sp-calreg-mode-direct" aria-pressed="true">직접 입력</button>' +
    '<button type="button" class="btn btn--ghost sp-plan-manual__modeBtn" id="sp-calreg-mode-curriculum" aria-pressed="false">커리큘럼</button>' +
    '</div>' +
    '<div id="sp-calreg-manual-direct" class="sp-plan-manual__block">' +
    '<div class="sp-plan-manual__grid">' +
    '<label class="sp-plan-manual__lbl">제목<input type="text" id="sp-calreg-manual-title" class="sp-plan-manual__input" maxlength="200" placeholder="예: 모의고사 오답" autocomplete="off"/></label>' +
    '<label class="sp-plan-manual__lbl">과목<select id="sp-calreg-manual-cat" class="sp-plan-manual__select">' +
    plannerStudyCategorySelectOptionsHtml_({ selected: 'misc', includeFixed: true }) +
    '</select></label>' +
    '</div>' +
    '<div id="sp-calreg-manual-fixed-time" class="sp-plan-calReg__fixedTime" hidden>' +
    '<div class="sp-plan-quick__row sp-plan-quick__row--horiz">' +
    '<span class="sp-plan-quick__lbl">시간</span>' +
    '<div class="sp-plan-fixed__timeSelects">' +
    '<label class="sp-plan-fixed__timeLbl">시작<select id="sp-calreg-fixed-start" class="sp-plan-manual__select">' +
    fixedTimeOptsStart +
    '</select></label>' +
    '<label class="sp-plan-fixed__timeLbl">끝<select id="sp-calreg-fixed-end" class="sp-plan-manual__select">' +
    fixedTimeOptsEnd +
    '</select></label>' +
    '</div></div></div>' +
    '<button type="button" class="btn btn--primary sp-plan-manual__add" id="sp-calreg-manual-add">할 일 추가</button>' +
    '</div>' +
    '<div id="sp-calreg-manual-curriculum" class="sp-plan-manual__block" hidden>' +
    '<div class="sp-plan-manual__grid sp-plan-manual__grid--curr">' +
    '<label class="sp-plan-manual__lbl">과목<select id="sp-calreg-curr-subj" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="과목 선택"></select></label>' +
    '<label class="sp-plan-manual__lbl">선생님<select id="sp-calreg-curr-instructor" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="선생님 선택"></select></label>' +
    '<label class="sp-plan-manual__lbl">강좌명<select id="sp-calreg-curr-course" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="강좌명 선택"></select></label>' +
    '<label class="sp-plan-manual__lbl">회차<select id="sp-calreg-curr-lecture" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="회차 선택"></select></label>' +
    '<label class="sp-plan-manual__lbl sp-plan-manual__lbl--preview">제목<input type="text" id="sp-calreg-curr-title-preview" class="sp-plan-manual__input sp-plan-manual__control--fit" readonly tabindex="-1" aria-readonly="true" data-sp-fit-ph="회차를 선택하면 자동 입력" placeholder="회차를 선택하면 자동 입력"/></label>' +
    '</div>' +
    '<button type="button" class="btn btn--primary sp-plan-manual__add" id="sp-calreg-curr-add">할 일 추가</button>' +
    '</div>'
  );
}

/**
 * @param {HTMLElement} root
 * @param {string} fixedTimeOptsStart
 * @param {string} fixedTimeOptsEnd
 */
function plannerEnsureCalRegModal_(root, fixedTimeOptsStart, fixedTimeOptsEnd) {
  let el = root.querySelector('#sp-plan-cal-reg-modal');
  if (el) return;
  el = document.createElement('div');
  el.id = 'sp-plan-cal-reg-modal';
  el.className = 'sp-plan-modal sp-plan-calReg-modal';
  el.setAttribute('hidden', 'hidden');
  el.innerHTML =
    '<div class="sp-plan-modal__backdrop" data-sp-plan-close="1" aria-hidden="true"></div>' +
    '<div class="sp-plan-modal__panel" role="dialog" aria-modal="true" aria-labelledby="sp-plan-cal-reg-title">' +
    '<header class="sp-plan-modal__head">' +
    '<h2 class="sp-plan-modal__title" id="sp-plan-cal-reg-title">일정 등록</h2>' +
    '<button type="button" class="btn btn--ghost sp-plan-modal__close" data-sp-plan-close="1">닫기</button>' +
    '</header>' +
    '<div class="sp-plan-modal__body sp-plan-calReg__body">' +
    plannerCalRegModalBodyHtml_(fixedTimeOptsStart, fixedTimeOptsEnd) +
    '</div></div>';
  root.appendChild(el);
  plannerSetFixedTimelineSelectDefaults_(
    el.querySelector('#sp-calreg-fixed-start'),
    el.querySelector('#sp-calreg-fixed-end')
  );
  plannerWireCalRegModalOnce_(root);
}

/**
 * @param {HTMLElement} root
 * @param {string} ymd
 */
function plannerOpenCalRegModal_(root, ymd) {
  const st = root.__spPlanState;
  if (!st) return;
  const modal = root.querySelector('#sp-plan-cal-reg-modal');
  if (!modal) return;
  const day = String(ymd || '').trim();
  if (!day) return;
  st.calRegDueYmd = day;
  const titleEl = modal.querySelector('#sp-plan-cal-reg-title');
  if (titleEl) titleEl.textContent = day + ' · 일정 등록';
  plannerSetManualRegMode_(modal, st, st.manualRegMode === 'curriculum' ? 'curriculum' : 'direct', 'calreg');
  plannerCurriculumRefreshCascade_(modal, st, 'all', 'calreg');
  plannerSyncManualFixedTimeVisibility_(modal, 'calreg');
  plannerControlFitSyncWidthsIn_(modal);
  modal.removeAttribute('hidden');
}

/**
 * @param {HTMLElement} root
 */
function plannerCloseCalRegModal_(root) {
  const modal = root.querySelector('#sp-plan-cal-reg-modal');
  if (!modal) return;
  modal.setAttribute('hidden', 'hidden');
  const st = root.__spPlanState;
  if (st) st.calRegDueYmd = '';
}

/**
 * @param {HTMLElement} root
 */
function plannerEnsureEventRegModal_(root) {
  let el = root.querySelector('#sp-plan-event-reg-modal');
  if (el) return;
  el = document.createElement('div');
  el.id = 'sp-plan-event-reg-modal';
  el.className = 'sp-plan-modal sp-plan-eventReg-modal';
  el.setAttribute('hidden', 'hidden');
  el.innerHTML =
    '<div class="sp-plan-modal__backdrop" data-sp-plan-close="1" aria-hidden="true"></div>' +
    '<div class="sp-plan-modal__panel" role="dialog" aria-modal="true" aria-labelledby="sp-plan-event-reg-title">' +
    '<header class="sp-plan-modal__head">' +
    '<h2 class="sp-plan-modal__title" id="sp-plan-event-reg-title">이벤트 등록</h2>' +
    '<button type="button" class="btn btn--ghost sp-plan-modal__close" data-sp-plan-close="1">닫기</button>' +
    '</header>' +
    '<div class="sp-plan-modal__body sp-plan-eventReg__body">' +
    '<p class="sp-plan-eventReg__hint">제목만 등록됩니다. 달력 날짜에 별로 표시됩니다.</p>' +
    '<p class="sp-plan-eventReg__err" id="sp-plan-event-reg-err" hidden></p>' +
    '<label class="sp-plan-eventReg__lbl">제목' +
    '<input type="text" id="sp-plan-event-reg-title-input" class="sp-plan-eventReg__input" maxlength="200" placeholder="예: 모의고사" autocomplete="off"/>' +
    '</label>' +
    '<button type="button" class="btn btn--primary sp-plan-eventReg__add" id="sp-plan-event-reg-add">등록</button>' +
    '</div></div>';
  root.appendChild(el);
  plannerWireEventRegModalOnce_(root);
}

/**
 * @param {HTMLElement} root
 * @param {string} ymd
 */
function plannerOpenEventRegModal_(root, ymd) {
  const st = root.__spPlanState;
  if (!st) return;
  const modal = root.querySelector('#sp-plan-event-reg-modal');
  if (!modal) return;
  const day = String(ymd || '').trim();
  if (!day) return;
  st.eventRegDueYmd = day;
  const titleEl = modal.querySelector('#sp-plan-event-reg-title');
  if (titleEl) titleEl.textContent = day + ' · 이벤트 등록';
  const input = modal.querySelector('#sp-plan-event-reg-title-input');
  if (input instanceof HTMLInputElement) {
    input.value = '';
  }
  const errEl = modal.querySelector('#sp-plan-event-reg-err');
  if (errEl) {
    errEl.textContent = '';
    errEl.setAttribute('hidden', 'hidden');
  }
  modal.removeAttribute('hidden');
  if (input instanceof HTMLInputElement) {
    requestAnimationFrame(function () {
      input.focus();
    });
  }
}

/**
 * @param {HTMLElement} root
 */
function plannerCloseEventRegModal_(root) {
  const modal = root.querySelector('#sp-plan-event-reg-modal');
  if (!modal) return;
  modal.setAttribute('hidden', 'hidden');
  const st = root.__spPlanState;
  if (st) st.eventRegDueYmd = '';
}

/**
 * @param {object} st
 * @param {string} ymd
 * @param {string} title
 * @returns {string}
 */
function plannerAppendEventTodo_(st, ymd, title) {
  plannerEnsureMonthTodos_(st);
  const day = String(ymd || '').trim();
  const t = String(title != null ? title : '').trim();
  if (!day) return '날짜를 확인해 주세요.';
  if (!t) return '제목을 입력해 주세요.';
  const today = plannerTodayYmdSeoul_();
  const tid = 'evt_' + String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8);
  st.monthTodos.push({
    task_id: tid,
    title: t,
    date: day,
    category: PLAN_CATEGORY_EVENT,
    lecture_id: '',
    timeline_slots: '[]',
    sort_key: 0,
    mark: 'none',
    trace_dates: '[]',
    created_date: today,
    updated_date: today
  });
  plannerRebuildQuickPostPayload_(st);
  return '';
}

/**
 * @param {HTMLElement} root
 * @param {string} ymd
 */
async function plannerDeleteAllEventsForDay_(root, ymd) {
  if (!root.__spPlanAdminMode) return;
  const st = root.__spPlanState;
  if (!st) return;
  const day = String(ymd || '').trim();
  const ids = plannerEventsForDay_(st, day)
    .map(function (r) {
      return String(r.task_id || '').trim();
    })
    .filter(Boolean);
  if (!ids.length) return;
  await plannerDeleteTodosFromCalendar_(root, day, ids);
}

/**
 * @param {HTMLElement} root
 */
function plannerWireEventRegModalOnce_(root) {
  const modal = root.querySelector('#sp-plan-event-reg-modal');
  if (!modal || modal.__spPlanEventRegWired) return;
  modal.__spPlanEventRegWired = true;
  modal.addEventListener('click', function (e) {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    if (t.getAttribute && t.getAttribute('data-sp-plan-close') === '1') {
      plannerCloseEventRegModal_(root);
      return;
    }
    const addBtn =
      t.id === 'sp-plan-event-reg-add' ? t : t.closest ? t.closest('#sp-plan-event-reg-add') : null;
    if (!addBtn) return;
    const st = root.__spPlanState;
    if (!st || !st.eventRegDueYmd) return;
    const due = String(st.eventRegDueYmd);
    const input = modal.querySelector('#sp-plan-event-reg-title-input');
    const title = input && 'value' in input ? String(/** @type {HTMLInputElement} */ (input).value) : '';
    const errEl = modal.querySelector('#sp-plan-event-reg-err');
    const msg = plannerAppendEventTodo_(st, due, title);
    if (errEl) {
      if (msg) {
        errEl.textContent = msg;
        errEl.removeAttribute('hidden');
      } else {
        errEl.textContent = '';
        errEl.setAttribute('hidden', 'hidden');
      }
    }
    if (msg) return;
    plannerRefreshPostPreview_(root);
    if (typeof root.__spPlanRerenderMonth === 'function') root.__spPlanRerenderMonth();
    const dayModal = root.querySelector('#sp-plan-day-modal');
    if (dayModal && st.selectedDate === due && !dayModal.hasAttribute('hidden')) {
      if (typeof root.__spPlanRefreshOpenDayModal === 'function') root.__spPlanRefreshOpenDayModal();
    }
    plannerCloseEventRegModal_(root);
  });
}

/**
 * @param {HTMLElement} root
 */
function plannerWireCalRegModalOnce_(root) {
  const modal = root.querySelector('#sp-plan-cal-reg-modal');
  if (!modal || modal.__spPlanCalRegWired) return;
  modal.__spPlanCalRegWired = true;
  modal.addEventListener('click', function (e) {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    if (t.getAttribute && t.getAttribute('data-sp-plan-close') === '1') {
      plannerCloseCalRegModal_(root);
      return;
    }
    const st = root.__spPlanState;
    if (!st || !st.calRegDueYmd) return;
    const due = String(st.calRegDueYmd);
    const formOpts = { dueYmd: due, formKind: /** @type {'calreg'} */ ('calreg') };
    const modeDirect =
      t.id === 'sp-calreg-mode-direct' ? t : t.closest ? t.closest('#sp-calreg-mode-direct') : null;
    const modeCurr =
      t.id === 'sp-calreg-mode-curriculum' ? t : t.closest ? t.closest('#sp-calreg-mode-curriculum') : null;
    if (modeDirect) {
      plannerSetManualRegMode_(modal, st, 'direct', 'calreg');
      return;
    }
    if (modeCurr) {
      plannerSetManualRegMode_(modal, st, 'curriculum', 'calreg');
      return;
    }
    const manualAdd = t.id === 'sp-calreg-manual-add' ? t : t.closest ? t.closest('#sp-calreg-manual-add') : null;
    if (manualAdd) {
      const errM = modal.querySelector('#sp-calreg-manual-err');
      const msg = plannerAppendManualTodoFromForm_(modal, st, formOpts);
      if (errM) {
        if (msg) {
          errM.textContent = msg;
          errM.removeAttribute('hidden');
        } else {
          errM.textContent = '';
          errM.setAttribute('hidden', 'hidden');
        }
      }
      if (!msg) {
        plannerRefreshPostPreview_(root);
        if (typeof root.__spPlanRerenderMonth === 'function') root.__spPlanRerenderMonth();
        const dayModal = root.querySelector('#sp-plan-day-modal');
        if (dayModal && st.selectedDate === due && !dayModal.hasAttribute('hidden')) {
          if (typeof root.__spPlanRefreshOpenDayModal === 'function') root.__spPlanRefreshOpenDayModal();
        }
      }
      return;
    }
    const currAdd = t.id === 'sp-calreg-curr-add' ? t : t.closest ? t.closest('#sp-calreg-curr-add') : null;
    if (currAdd) {
      const errC = modal.querySelector('#sp-calreg-curr-err');
      const msgC = plannerAppendCurriculumTodoFromForm_(modal, st, formOpts);
      if (errC) {
        if (msgC) {
          errC.textContent = msgC;
          errC.removeAttribute('hidden');
        } else {
          errC.textContent = '';
          errC.setAttribute('hidden', 'hidden');
        }
      }
      if (!msgC) {
        plannerRefreshPostPreview_(root);
        if (typeof root.__spPlanRerenderMonth === 'function') root.__spPlanRerenderMonth();
        const dayModal = root.querySelector('#sp-plan-day-modal');
        if (dayModal && st.selectedDate === due && !dayModal.hasAttribute('hidden')) {
          if (typeof root.__spPlanRefreshOpenDayModal === 'function') root.__spPlanRefreshOpenDayModal();
        }
      }
      return;
    }
  });
  modal.addEventListener('change', function (e) {
    const t = e.target;
    if (!(t instanceof HTMLSelectElement)) return;
    const st = root.__spPlanState;
    if (!st) return;
    const id = t.id || '';
    if (id === 'sp-calreg-manual-cat') {
      plannerSyncManualFixedTimeVisibility_(modal, 'calreg');
      return;
    }
    if (id === 'sp-calreg-curr-subj') {
      plannerCurriculumRefreshCascade_(modal, st, 'subject', 'calreg');
    } else if (id === 'sp-calreg-curr-instructor') {
      plannerCurriculumRefreshCascade_(modal, st, 'instructor', 'calreg');
    } else if (id === 'sp-calreg-curr-course') {
      plannerCurriculumRefreshCascade_(modal, st, 'course', 'calreg');
    } else if (id === 'sp-calreg-curr-lecture') {
      plannerCurriculumRefreshCascade_(modal, st, 'preview', 'calreg');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    const m = root.querySelector('#sp-plan-cal-reg-modal');
    if (m && !m.hasAttribute('hidden')) plannerCloseCalRegModal_(root);
  });
}

/**
 * @param {HTMLElement} root
 * @param {HTMLElement|null} grid
 */
function plannerSyncCalendarChipDraggable_(root, grid) {
  if (!grid) return;
  const on = Boolean(root.__spPlanAdminMode);
  grid.querySelectorAll('[data-sp-draggable-todo="1"]').forEach(function (el) {
    if (el instanceof HTMLElement) {
      el.draggable = on;
    }
  });
}

function plannerMonthYmdPrefix_(viewMonth) {
  return String(viewMonth.getFullYear()) + '-' + plannerPad2_(viewMonth.getMonth() + 1) + '-';
}

/**
 * @param {object} st
 * @param {Date} viewMonth
 */
function plannerMonthHasQuickPlan_(st, viewMonth) {
  const pfx = plannerMonthYmdPrefix_(viewMonth);
  plannerEnsureMonthTodos_(st);
  return st.monthTodos.some(function (r) {
    return r && !r._fromServer && String(r.date || '').trim().indexOf(pfx) === 0;
  });
}

/**
 * @param {object} st
 * @param {Date} viewMonth
 */
function plannerClearQuickPlanForMonth_(st, viewMonth) {
  plannerClearLocalTodosForMonth_(st, viewMonth);
}

/**
 * API/시트 `timeline_slots` 한 요소 → `시_칸` 키 (`8_3`). `0830` 형태는 시·분에서 10분 칸으로 변환.
 * @param {unknown} slot
 * @returns {string}
 */
function plannerNormalizeTimelineSlotKeyFromApi_(slot) {
  const s = String(slot != null ? slot : '').trim();
  if (!s) return '';
  if (/^\d+_[0-5]$/.test(s)) return s;
  if (/^\d{4}$/.test(s)) {
    const hour = parseInt(s.slice(0, 2), 10);
    const min = parseInt(s.slice(2, 4), 10);
    if (!isFinite(hour) || !isFinite(min)) return '';
    const sub = Math.floor(min / 10);
    if (sub < 0 || sub > 5) return '';
    return plannerTimelineSlotKey_(hour, sub);
  }
  return '';
}

/**
 * bootstrap `personal` 한 줄 → 페이로드용( `task_id` 문자열 ).
 * @param {object} row
 * @returns {{ task_id: string, title: string, date: string, category: string, lecture_id: string, timeline_slots: string, sort_key: number, mark: string, trace_dates: string, created_date: string, updated_date: string }}
 */
function plannerNormalizeServerTodoRowForPayload_(row) {
  const r = row && typeof row === 'object' ? row : {};
  const tidRaw = r.task_id;
  const task_id = tidRaw != null && String(tidRaw).trim() !== '' ? String(tidRaw).trim() : '';
  const ts0 = String(r.timeline_slots != null ? r.timeline_slots : '').trim();
  const dateStr = String(r.date != null ? r.date : '').trim();
  const today = plannerTodayYmdSeoul_();
  let created_date = plannerYmdFromDateField_(r.created_date);
  if (!created_date) created_date = plannerYmdFromDateField_(r.created_at);
  if (!created_date) created_date = today;
  let updated_date = plannerYmdFromDateField_(r.updated_date);
  if (!updated_date) updated_date = plannerYmdFromDateField_(r.updated_at);
  if (!updated_date) updated_date = today;
  const timeline_slots = ts0.length ? ts0 : '[]';
  const mark = String(r.mark != null ? r.mark : 'none').trim() || 'none';
  const trace_dates = plannerTraceDatesToJson_(plannerParseTraceDatesJson_(r.trace_dates));
  return {
    task_id: task_id,
    title: String(r.title != null ? r.title : '').trim() || '(제목 없음)',
    date: dateStr,
    category: String(r.category != null ? r.category : 'misc').trim() || 'misc',
    lecture_id: String(r.lecture_id != null ? r.lecture_id : ''),
    timeline_slots: timeline_slots,
    sort_key: Number(r.sort_key) || 0,
    mark: mark,
    trace_dates: trace_dates,
    created_date: created_date,
    updated_date: updated_date
  };
}

/**
 * @param {object} st
 */
function plannerEnsureMonthTodos_(st) {
  if (!st || typeof st !== 'object') return;
  if (!Array.isArray(st.monthTodos)) st.monthTodos = [];
}

/**
 * @param {object} row
 * @returns {object}
 */
function plannerTodoRowFromServer_(row) {
  const n = plannerNormalizeServerTodoRowForPayload_(row);
  n._fromServer = true;
  return n;
}

/**
 * @param {object} row
 * @returns {object}
 */
function plannerTodoRowLocal_(row) {
  const n = plannerNormalizeServerTodoRowForPayload_(row);
  n._fromServer = false;
  return n;
}

/**
 * POST 본문용 — `_fromServer` 제거.
 * @param {object} row
 * @returns {object}
 */
function plannerTodoRowForPost_(row) {
  return plannerNormalizeServerTodoRowForPayload_(row);
}

/**
 * @param {object} st
 * @param {string} ymd
 * @returns {number}
 */
function plannerNextSortKeyForDate_(st, ymd) {
  plannerEnsureMonthTodos_(st);
  let max = -1;
  st.monthTodos.forEach(function (r) {
    if (!r || String(r.date || '').trim() !== ymd) return;
    const sk = Number(r.sort_key) || 0;
    if (sk > max) max = sk;
  });
  return max + 1;
}

/**
 * @param {object} st
 * @param {object} row
 */
function plannerPushMonthTodo_(st, row, skipRebuild) {
  plannerEnsureMonthTodos_(st);
  const d = String(row.date != null ? row.date : '').trim();
  if (!d) return;
  if (row.sort_key == null || row.sort_key === '' || !isFinite(Number(row.sort_key))) {
    row.sort_key = plannerNextSortKeyForDate_(st, d);
  }
  st.monthTodos.push(row);
  if (!skipRebuild) plannerRebuildQuickPostPayload_(st);
}

/**
 * @param {object} st
 * @param {Date} viewMonth
 */
function plannerClearLocalTodosForMonth_(st, viewMonth) {
  plannerEnsureMonthTodos_(st);
  const pfx = plannerMonthYmdPrefix_(viewMonth);
  st.monthTodos = st.monthTodos.filter(function (r) {
    if (!r || typeof r !== 'object') return false;
    if (r._fromServer) return true;
    const d = String(r.date != null ? r.date : '').trim();
    return d.indexOf(pfx) !== 0;
  });
  if (st.dayFixedBlockSlotsByDate) {
    Object.keys(st.dayFixedBlockSlotsByDate).forEach(function (k) {
      if (k.indexOf(pfx) === 0) {
        try {
          delete st.dayFixedBlockSlotsByDate[k];
        } catch (_e) {
          st.dayFixedBlockSlotsByDate[k] = {};
        }
      }
    });
  }
  plannerRebuildQuickPostPayload_(st);
}

/**
 * @param {object} st
 * @param {string} ymd
 * @returns {Record<string, string>}
 */
function plannerBuildTimelineSlotMapForDayFromMonthTodos_(st, ymd) {
  const rows = plannerMonthTodosForDay_(st, ymd);
  /** @type {Record<string, string>} */
  const map = {};
  rows.forEach(function (row) {
    if (!row || plannerIsTraceGhostDisplay_(row)) return;
    const cat = String(row.category != null ? row.category : '').trim();
    if (cat === PLAN_CATEGORY_FIXED || cat === PLAN_CATEGORY_EVENT || cat === 'memo') return;
    if (plannerIsRoutineExcludedFromStudyTotals_(row.task_id, cat)) return;
    const tid = String(row.task_id != null ? row.task_id : '').trim();
    if (!tid) return;
    let arr = [];
    try {
      const j = JSON.parse(String(row.timeline_slots != null ? row.timeline_slots : '[]'));
      if (Array.isArray(j)) arr = j;
    } catch (_e) {}
    arr.forEach(function (slot) {
      const sk = plannerNormalizeTimelineSlotKeyFromApi_(slot);
      if (sk) map[sk] = tid;
    });
  });
  return map;
}

/**
 * 일일 모달 타임라인 맵 → 해당 날 `monthTodos` 행의 `timeline_slots`.
 * @param {object} st
 * @param {string} ymd
 */
function plannerPersistTimelineSlotMapToMonthTodos_(st, ymd) {
  const map = st.dayTimelineTodoByDate && st.dayTimelineTodoByDate[ymd];
  if (!map || typeof map !== 'object') return;
  /** @type {Record<string, string[]>} */
  const byTask = {};
  Object.keys(map).forEach(function (sk) {
    const tid = String(map[sk] != null ? map[sk] : '').trim();
    if (!tid) return;
    if (!byTask[tid]) byTask[tid] = [];
    byTask[tid].push(sk);
  });
  plannerEnsureMonthTodos_(st);
  const today = plannerTodayYmdSeoul_();
  st.monthTodos.forEach(function (row) {
    if (!row || String(row.date || '').trim() !== ymd) return;
    if (plannerIsTraceGhostDisplay_(row)) return;
    const cat = String(row.category != null ? row.category : '').trim();
    if (cat === PLAN_CATEGORY_FIXED || cat === PLAN_CATEGORY_EVENT || cat === 'memo') return;
    if (plannerIsRoutineExcludedFromStudyTotals_(row.task_id, cat)) return;
    const tid = String(row.task_id != null ? row.task_id : '').trim();
    const keys = byTask[tid] ? byTask[tid].slice().sort() : [];
    row.timeline_slots = JSON.stringify(keys);
    if (!row._fromServer) row.updated_date = today;
  });
  plannerUpsertRoutineMonthTodosFromDayMap_(st, ymd, byTask);
  if (st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime())) {
    plannerRebuildFixedBlockSlotsForMonth_(st, st.viewMonth);
  }
  plannerRebuildQuickPostPayload_(st);
}

/**
 * 일일 모달에서 취침·식사 칠함 → `monthTodos`에 `category:routine` 행 upsert(칸 없으면 제거).
 * @param {object} st
 * @param {string} ymd
 * @param {Record<string, string[]>} byTask
 */
function plannerUpsertRoutineMonthTodosFromDayMap_(st, ymd, byTask) {
  plannerEnsureMonthTodos_(st);
  const day = String(ymd || '').trim();
  if (!day) return;
  const today = plannerTodayYmdSeoul_();
  /** @type {{ id: string, title: string, sort: number }[]} */
  const specs = [
    { id: PLAN_FIXED_SLEEP_TODO_ID, title: '취침시간', sort: -1000 },
    { id: PLAN_FIXED_MEAL_TODO_ID, title: '식사시간', sort: -999 }
  ];
  specs.forEach(function (spec) {
    const keys = byTask[spec.id] ? byTask[spec.id].slice().sort() : [];
    let ix = -1;
    let i;
    for (i = 0; i < st.monthTodos.length; i++) {
      const r = st.monthTodos[i];
      if (r && String(r.date || '').trim() === day && String(r.task_id || '').trim() === spec.id) {
        ix = i;
        break;
      }
    }
    if (!keys.length) {
      if (ix >= 0) st.monthTodos.splice(ix, 1);
      return;
    }
    const payload = {
      task_id: spec.id,
      title: spec.title,
      date: day,
      category: PLAN_CATEGORY_ROUTINE,
      lecture_id: '',
      timeline_slots: JSON.stringify(keys),
      sort_key: spec.sort,
      mark: 'none',
      trace_dates: '[]',
      created_date: today,
      updated_date: today
    };
    if (ix >= 0) {
      const prev = st.monthTodos[ix];
      const fromSrv = prev && prev._fromServer;
      st.monthTodos[ix] = plannerTodoRowLocal_(payload);
      if (fromSrv) st.monthTodos[ix]._fromServer = true;
    } else {
      plannerPushMonthTodo_(st, plannerTodoRowLocal_(payload), true);
    }
  });
}

/**
 * @param {object} st
 * @param {string} dateYmd
 * @returns {object[]}
 */
function plannerMonthTodosForDay_(st, dateYmd) {
  plannerEnsureMonthTodos_(st);
  const day = String(dateYmd || '').trim();
  /** @type {object[]} */
  const rows = [];
  st.monthTodos.forEach(function (t) {
    if (!t || typeof t !== 'object') return;
    if (t._deleted) return;
    if (String(t.date || '') === day) {
      rows.push(t);
      return;
    }
    if (plannerTraceDatesIncludes_(t, day)) {
      rows.push(Object.assign({}, t, { _spTraceGhost: true, _spTraceOnDate: day }));
    }
  });
  rows.sort(plannerCompareMonthTodoDisplay_);
  return rows;
}

/**
 * @param {object} st
 * @param {string} taskId
 * @returns {object|null}
 */
function plannerFindMonthTodoByTaskId_(st, taskId) {
  plannerEnsureMonthTodos_(st);
  const id = String(taskId || '').trim();
  if (!id) return null;
  for (let i = 0; i < st.monthTodos.length; i++) {
    const r = st.monthTodos[i];
    if (r && String(r.task_id) === id) return r;
  }
  return null;
}

/**
 * n빵: M일에 N강을 균등 분배.
 * @param {number} dayCount
 * @param {number} totalLessons
 * @returns {number[]}
 */
function plannerNbungCounts_(dayCount, totalLessons) {
  const M = Math.max(0, Math.floor(Number(dayCount) || 0));
  const N = Math.max(0, Math.floor(Number(totalLessons) || 0));
  if (M <= 0 || N <= 0) return [];
  const base = Math.floor(N / M);
  const rem = N % M;
  /** @type {number[]} */
  const out = [];
  let i;
  for (i = 0; i < M; i++) {
    out.push(base + (i < rem ? 1 : 0));
  }
  return out;
}

/**
 * 서버에서 읽은 `personal` 이 월 todo 스키마인지(`task_id` 키 유무).
 * @param {object|null|undefined} row
 * @returns {boolean}
 */
function plannerBootstrapPersonalIsFullSchema_(row) {
  return Boolean(row && typeof row === 'object' && Object.prototype.hasOwnProperty.call(row, 'task_id'));
}

/**
 * `renderCalendar_` 직후: 회원 bootstrap `personal` → `monthTodos`·POST 페이로드.
 * @param {object} st
 * @param {object[]|null} personal
 * @param {'member'|'guest'} role
 */
function plannerApplyBootstrapPersonal_(st, personal, role) {
  if (!st || typeof st !== 'object') return;
  plannerEnsureMonthTodos_(st);
  if (role !== 'member') {
    st.monthTodos = [];
    plannerRebuildQuickPostPayload_(st);
    return;
  }
  const list = personal != null && Array.isArray(personal) ? personal : [];
  if (!list.length) {
    st.monthTodos = [];
    plannerRebuildQuickPostPayload_(st);
    return;
  }
  const first = list[0];
  if (!plannerBootstrapPersonalIsFullSchema_(first)) {
    st.monthTodos = [];
    plannerRebuildQuickPostPayload_(st);
    return;
  }
  st.monthTodos = list.map(plannerTodoRowFromServer_);
  plannerSyncDayMemoByDateFromMonthTodos_(st);
  if (st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime())) {
    plannerRebuildFixedBlockSlotsForMonth_(st, st.viewMonth);
    plannerInvalidateTimelineCacheForViewMonth_(st, st.viewMonth);
  }
  plannerRebuildQuickPostPayload_(st);
}

/**
 * `monthTodos`의 `category:memo` → `dayMemoByDate` (일일 모달 textarea).
 * @param {object} st
 */
function plannerSyncDayMemoByDateFromMonthTodos_(st) {
  if (!st || typeof st !== 'object') return;
  if (!st.dayMemoByDate) st.dayMemoByDate = {};
  plannerEnsureMonthTodos_(st);
  /** @type {Record<string, string>} */
  const byDay = {};
  st.monthTodos.forEach(function (row) {
    if (!row || String(row.category || '').trim() !== 'memo') return;
    const ymd = String(row.date != null ? row.date : '').trim();
    if (!ymd) return;
    const text = String(row.title != null ? row.title : '').trim();
    if (text) byDay[ymd] = text;
  });
  Object.keys(byDay).forEach(function (ymd) {
    st.dayMemoByDate[ymd] = byDay[ymd];
  });
}

/**
 * 일일 메모 textarea → 해당 날 `monthTodos` memo 행 1건(없으면 제거, 있으면 upsert).
 * @param {object} st
 * @param {string} ymd
 */
function plannerSyncDayMemoToMonthTodo_(st, ymd) {
  if (!st || typeof st !== 'object') return;
  const day = String(ymd || '').trim();
  if (!day) return;
  plannerEnsureMonthTodos_(st);
  const text = st.dayMemoByDate && st.dayMemoByDate[day] != null ? String(st.dayMemoByDate[day]).trim() : '';
  const today = plannerTodayYmdSeoul_();
  let existingIx = -1;
  let existingTid = '';
  let i;
  for (i = 0; i < st.monthTodos.length; i++) {
    const r = st.monthTodos[i];
    if (r && String(r.date || '').trim() === day && String(r.category || '').trim() === 'memo') {
      existingIx = i;
      existingTid = String(r.task_id != null ? r.task_id : '').trim();
      break;
    }
  }
  if (!text.length) {
    if (existingIx >= 0) st.monthTodos.splice(existingIx, 1);
    plannerRebuildQuickPostPayload_(st);
    return;
  }
  const task_id = existingTid.length ? existingTid : '__sp_memo_' + day;
  const payload = {
    task_id: task_id,
    title: text,
    date: day,
    category: 'memo',
    lecture_id: '',
    timeline_slots: '[]',
    sort_key: -800,
    mark: 'none',
    trace_dates: '[]',
    created_date: today,
    updated_date: today
  };
  if (existingIx >= 0) {
    const fromSrv = st.monthTodos[existingIx] && st.monthTodos[existingIx]._fromServer;
    st.monthTodos[existingIx] = plannerTodoRowLocal_(payload);
    if (fromSrv) st.monthTodos[existingIx]._fromServer = true;
  } else {
    plannerPushMonthTodo_(st, plannerTodoRowLocal_(payload), true);
  }
  plannerRebuildQuickPostPayload_(st);
}

/**
 * 고정 일정이 막는 칸 키를 공부·루틴 todo의 `timeline_slots`에서 제거(저장 데이터 정합).
 * @param {object} st
 * @param {string} ymd
 * @param {string[]} slotKeys
 */
function plannerStripStudyTimelineSlotsOnDay_(st, ymd, slotKeys) {
  if (!st || !slotKeys || !slotKeys.length) return;
  /** @type {Record<string, boolean>} */
  const blocked = {};
  slotKeys.forEach(function (k) {
    const sk = plannerNormalizeTimelineSlotKeyFromApi_(k);
    if (sk) blocked[sk] = true;
  });
  if (!Object.keys(blocked).length) return;
  const day = String(ymd || '').trim();
  const today = plannerTodayYmdSeoul_();
  plannerEnsureMonthTodos_(st);
  st.monthTodos.forEach(function (row) {
    if (!row || String(row.date || '').trim() !== day) return;
    if (plannerIsTraceGhostDisplay_(row)) return;
    const cat = String(row.category || '').trim();
    if (cat === PLAN_CATEGORY_FIXED || cat === 'memo') return;
    if (plannerIsRoutineExcludedFromStudyTotals_(row.task_id, cat)) return;
    let arr = [];
    try {
      const j = JSON.parse(String(row.timeline_slots != null ? row.timeline_slots : '[]'));
      if (Array.isArray(j)) arr = j;
    } catch (_e) {}
    const next = [];
    arr.forEach(function (slot) {
      const sk = plannerNormalizeTimelineSlotKeyFromApi_(slot);
      if (sk && blocked[sk]) return;
      next.push(slot);
    });
    if (next.length === arr.length) return;
    row.timeline_slots = JSON.stringify(next);
    if (!row._fromServer) row.updated_date = today;
  });
}

/**
 * `monthTodos` → POST 미리보기·`plannerPersonalTodosApply` 본문.
 * @param {object} st
 */
function plannerRebuildQuickPostPayload_(st) {
  plannerEnsureMonthTodos_(st);
  const view = st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime()) ? st.viewMonth : new Date();
  plannerAssignCategorySortKeysForViewMonth_(st);
  const pfx = plannerMonthYmdPrefix_(view);
  const ym = plannerYearMonthFromDate_(view);
  const todos = st.monthTodos
    .filter(function (r) {
      return (
        r &&
        String(r.date || '').trim().indexOf(pfx) === 0 &&
        plannerShouldIncludeRowInMonthApply_(r)
      );
    })
    .map(plannerTodoRowForPost_);
  st.plannerQuickPostBody = {
    action: 'plannerPersonalTodosApply',
    year_month: ym,
    todos: todos
  };
}

/** 커리큘럼 개별 등록 — 과목 코드(마스터 `courses.subject` 매칭용). */
const PLANNER_CURR_SUBJECT_OPTS = PLANNER_STUDY_SUBJECT_DEFS.map(function (d) {
  return { code: d.code, label: d.label };
});

/**
 * 커리큘럼 등록 과목 셀렉트 옵션 — `기타`는 카탈로그 없어도 항상 노출.
 * @param {object[]} courses
 * @returns {{ value: string, label: string }[]}
 */
function plannerCurriculumSubjectSelectItems_(courses) {
  const out = [];
  PLANNER_CURR_SUBJECT_OPTS.forEach(function (o) {
    if (o.code === 'misc') {
      out.push({ value: o.code, label: o.label });
      return;
    }
    const rows = plannerCurriculumCoursesForSubject_(courses, o.code);
    if (rows.length) out.push({ value: o.code, label: o.label });
  });
  return out;
}

/**
 * @param {object} st
 * @returns {{ courses: object[], lectures: object[] }}
 */
function plannerCurriculumCatalog_(st) {
  const pack = st && st.plannerCurriculum ? st.plannerCurriculum : { courses: [], lectures: [] };
  return {
    courses: Array.isArray(pack.courses) ? pack.courses : [],
    lectures: Array.isArray(pack.lectures) ? pack.lectures : []
  };
}

/**
 * @param {object} st
 * @returns {boolean}
 */
function plannerCurriculumHasCatalog_(st) {
  const c = plannerCurriculumCatalog_(st);
  return c.courses.length > 0 && c.lectures.length > 0;
}

/**
 * 커리큘럼 회차 select 라벨 — `lecture_name (N강)` (없으면 `N강`).
 * @param {string} lectureName
 * @param {number} lectureNo
 * @returns {string}
 */
function plannerCurriculumLectureOptionLabel_(lectureName, lectureNo) {
  const name = String(lectureName != null ? lectureName : '').trim();
  const no = Number(lectureNo);
  const noTxt = isFinite(no) && no > 0 ? String(no) + '강' : '';
  if (!name.length) return noTxt;
  if (!noTxt.length) return name;
  return name + ' (' + noTxt + ')';
}

/**
 * 달력 표시/저장 todo title — lecture_name 기반.
 * - 강사=솔루션편입 또는 과목=어휘(`vocab`) → `lecture_name`
 * - 그 외 → `[N강] lecture_name`
 * lecture_name 없으면 기존 폴백(강좌명 · N강).
 * @param {string} instructor
 * @param {string} courseName
 * @param {number} lectureNo
 * @param {string} lectureName
 * @param {string} [subjectCode] grammar|logic|read|vocab|misc
 * @returns {string}
 */
function plannerCurriculumTodoTitleForCalendar_(instructor, courseName, lectureNo, lectureName, subjectCode) {
  const inst = String(instructor != null ? instructor : '').trim();
  const subj = String(subjectCode != null ? subjectCode : '').trim();
  const lecName = String(lectureName != null ? lectureName : '').trim();
  const no = Number(lectureNo);
  const noTxt = isFinite(no) && no > 0 ? String(no) + '강' : '';
  if (lecName.length) {
    if (inst === '솔루션편입' || subj === 'vocab') return lecName;
    return (noTxt.length ? '[' + noTxt + '] ' : '') + lecName;
  }
  const cname = String(courseName != null ? courseName : '').trim();
  if (!cname.length) return noTxt;
  if (!noTxt.length) return cname;
  return cname + ' · ' + noTxt;
}

/** @type {HTMLSpanElement|null} */
let plannerControlFitMeasureEl_ = null;

/**
 * @param {string} text
 * @param {HTMLElement} refEl
 * @returns {number}
 */
function plannerControlFitMeasureWidth_(text, refEl) {
  if (!plannerControlFitMeasureEl_) {
    plannerControlFitMeasureEl_ = document.createElement('span');
    plannerControlFitMeasureEl_.setAttribute('aria-hidden', 'true');
    plannerControlFitMeasureEl_.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;';
    document.body.appendChild(plannerControlFitMeasureEl_);
  }
  const cs = getComputedStyle(refEl);
  plannerControlFitMeasureEl_.style.font = cs.font;
  plannerControlFitMeasureEl_.textContent = text || '';
  return plannerControlFitMeasureEl_.offsetWidth;
}

/**
 * 기본(첫 측정) 너비는 유지하고, 선택·표시 텍스트 길이에 맞춰 가로 확장.
 * @param {HTMLSelectElement|HTMLInputElement} el
 * @param {string} [textOverride]
 */
function plannerControlFitSyncWidth_(el, textOverride) {
  if (!el || !el.classList || !el.classList.contains('sp-plan-manual__control--fit')) {
    return;
  }
  const padKey = 'data-sp-fit-pad';
  let pad = Number(el.getAttribute(padKey));
  if (!pad) {
    pad = el instanceof HTMLSelectElement ? 38 : 24;
    el.setAttribute(padKey, String(pad));
  }
  const minKey = 'data-sp-fit-min-px';
  let minPx = Number(el.getAttribute(minKey));
  if (!minPx) {
    const ph =
      el.getAttribute('data-sp-fit-ph') ||
      (el instanceof HTMLSelectElement && el.options[0] ? String(el.options[0].textContent || '') : '') ||
      (el instanceof HTMLInputElement ? String(el.placeholder || '') : '') ||
      '선택';
    minPx = plannerControlFitMeasureWidth_(ph, el) + pad;
    el.setAttribute(minKey, String(Math.ceil(minPx)));
    el.style.setProperty('--sp-plan-control-fit-min', minPx + 'px');
  }
  let text = textOverride != null ? String(textOverride) : '';
  if (!text.length) {
    if (el instanceof HTMLSelectElement) {
      const opt = el.options[el.selectedIndex];
      text = opt ? String(opt.textContent || '').trim() : '';
    } else if (el instanceof HTMLInputElement) {
      text = String(el.value || el.placeholder || '').trim();
    }
  }
  const contentW = text.length ? plannerControlFitMeasureWidth_(text, el) + pad : minPx;
  el.style.width = Math.ceil(Math.max(minPx, contentW)) + 'px';
}

/**
 * @param {HTMLElement} slot
 */
function plannerControlFitSyncWidthsIn_(slot) {
  slot.querySelectorAll('.sp-plan-manual__control--fit').forEach(function (node) {
    if (node instanceof HTMLSelectElement || node instanceof HTMLInputElement) {
      plannerControlFitSyncWidth_(node);
    }
  });
}

/**
 * @param {HTMLSelectElement} sel
 * @param {{ value: string, label: string }[]} items
 * @param {string} [placeholder]
 */
function plannerSelectFillOptions_(sel, items, placeholder) {
  const prev = sel.value;
  sel.innerHTML = '';
  if (placeholder) {
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = placeholder;
    sel.appendChild(ph);
  }
  items.forEach(function (it) {
    const o = document.createElement('option');
    o.value = String(it.value);
    o.textContent = String(it.label);
    sel.appendChild(o);
  });
  if (prev) {
    const ok = Array.prototype.some.call(sel.options, function (opt) {
      return opt.value === prev;
    });
    if (ok) sel.value = prev;
  }
  if (sel.classList.contains('sp-plan-manual__control--fit')) {
    plannerControlFitSyncWidth_(sel);
  }
}

/**
 * @param {object[]} courses
 * @param {string} subjectCode
 * @returns {object[]}
 */
function plannerCurriculumCoursesForSubject_(courses, subjectCode) {
  const code = String(subjectCode || '').trim();
  if (!code) return [];
  return courses.filter(function (c) {
    return c && typeof c === 'object' && plannerSubjectCodeFromCatalogCourse_(c) === code;
  });
}

/**
 * 개별 등록 폼 id — `panel`(LEGACY 상단 패널) · `calreg`(달력 우클릭 모달).
 * @param {'panel'|'calreg'} kind
 * @returns {Record<string, string>}
 */
function plannerManualFormIds_(kind) {
  const cal = kind === 'calreg';
  const curr = cal ? 'sp-calreg-curr' : 'sp-curr';
  return {
    manualTitle: cal ? 'sp-calreg-manual-title' : 'sp-manual-title',
    manualDue: cal ? '' : 'sp-manual-due',
    manualCat: cal ? 'sp-calreg-manual-cat' : 'sp-manual-cat',
    manualFixedTime: cal ? 'sp-calreg-manual-fixed-time' : 'sp-manual-fixed-time',
    fixedStart: cal ? 'sp-calreg-fixed-start' : 'sp-manual-fixed-start',
    fixedEnd: cal ? 'sp-calreg-fixed-end' : 'sp-manual-fixed-end',
    manualAdd: cal ? 'sp-calreg-manual-add' : 'sp-manual-add',
    currAdd: cal ? 'sp-calreg-curr-add' : 'sp-curr-add',
    currDue: cal ? '' : 'sp-curr-due',
    currSubj: curr + '-subj',
    currInstructor: curr + '-instructor',
    currCourse: curr + '-course',
    currLecture: curr + '-lecture',
    currTitlePreview: curr + '-title-preview',
    currHint: cal ? 'sp-calreg-curr-catalog-hint' : 'sp-curr-catalog-hint',
    directBlock: cal ? 'sp-calreg-manual-direct' : 'sp-plan-manual-direct',
    currBlock: cal ? 'sp-calreg-manual-curriculum' : 'sp-plan-manual-curriculum',
    modeDirect: cal ? 'sp-calreg-mode-direct' : 'sp-manual-mode-direct',
    modeCurr: cal ? 'sp-calreg-mode-curriculum' : 'sp-manual-mode-curriculum',
    manualErr: cal ? 'sp-calreg-manual-err' : 'sp-plan-manual-err',
    currErr: cal ? 'sp-calreg-curr-err' : 'sp-plan-curr-err'
  };
}

/**
 * @param {HTMLElement} root
 * @param {'panel'|'calreg'} kind
 */
function plannerSyncManualFixedTimeVisibility_(root, kind) {
  const ids = plannerManualFormIds_(kind);
  const catEl = root.querySelector('#' + ids.manualCat);
  const wrap = root.querySelector('#' + ids.manualFixedTime);
  if (!(catEl instanceof HTMLSelectElement) || !(wrap instanceof HTMLElement)) return;
  const on = String(catEl.value || '').trim() === PLAN_CATEGORY_FIXED;
  if (on) wrap.removeAttribute('hidden');
  else wrap.setAttribute('hidden', 'hidden');
}

/**
 * @param {HTMLElement} slot
 * @param {object} st
 * @param {'all'|'subject'|'instructor'|'course'|'preview'} fromLevel
 * @param {'panel'|'calreg'} [formKind]
 */
function plannerCurriculumRefreshCascade_(slot, st, fromLevel, formKind) {
  const kind = formKind === 'calreg' ? 'calreg' : 'panel';
  const ids = plannerManualFormIds_(kind);
  const subjEl = slot.querySelector('#' + ids.currSubj);
  const instEl = slot.querySelector('#' + ids.currInstructor);
  const courseEl = slot.querySelector('#' + ids.currCourse);
  const lecEl = slot.querySelector('#' + ids.currLecture);
  const titleEl = slot.querySelector('#' + ids.currTitlePreview);
  const hintEl = slot.querySelector('#' + ids.currHint);
  if (
    !(subjEl instanceof HTMLSelectElement) ||
    !(instEl instanceof HTMLSelectElement) ||
    !(courseEl instanceof HTMLSelectElement) ||
    !(lecEl instanceof HTMLSelectElement)
  ) {
    return;
  }
  if (fromLevel === 'preview') {
    plannerCurriculumUpdateTitlePreview_(slot, st, lecEl, titleEl);
    return;
  }
  const cat = plannerCurriculumCatalog_(st);
  const has = plannerCurriculumHasCatalog_(st);
  if (hintEl) {
    if (!has) {
      hintEl.textContent = '등록된 강좌가 없습니다. 담당자에게 문의해 주세요.';
      hintEl.removeAttribute('hidden');
    } else {
      hintEl.textContent = '';
      hintEl.setAttribute('hidden', 'hidden');
    }
  }
  subjEl.disabled = !has;
  instEl.disabled = !has;
  courseEl.disabled = !has;
  lecEl.disabled = !has;

  if (fromLevel === 'all') {
    const subjItems = plannerCurriculumSubjectSelectItems_(cat.courses);
    plannerSelectFillOptions_(subjEl, subjItems, '과목 선택');
    subjEl.value = subjItems.length ? subjItems[0].value : '';
    fromLevel = 'subject';
  }

  const subjectCode = String(subjEl.value || '').trim();
  if (fromLevel === 'subject') {
    const coursesSub = plannerCurriculumCoursesForSubject_(cat.courses, subjectCode);
    /** @type {Record<string, boolean>} */
    const seenInst = {};
    const instItems = [];
    coursesSub.forEach(function (c) {
      const inst = String(c.instructor != null ? c.instructor : '').trim() || '(선생님 미입력)';
      if (seenInst[inst]) return;
      seenInst[inst] = true;
      instItems.push({ value: inst, label: inst });
    });
    instItems.sort(function (a, b) {
      return a.label.localeCompare(b.label, 'ko');
    });
    plannerSelectFillOptions_(instEl, instItems, '선생님 선택');
    fromLevel = 'instructor';
  }

  const instructor = String(instEl.value || '').trim();
  if (fromLevel === 'instructor') {
    const coursesSub = plannerCurriculumCoursesForSubject_(cat.courses, subjectCode);
    const coursesInst = coursesSub.filter(function (c) {
      const inst = String(c.instructor != null ? c.instructor : '').trim() || '(선생님 미입력)';
      return inst === instructor;
    });
    const courseItems = coursesInst.map(function (c) {
      const cid = c.course_id != null ? String(c.course_id) : '';
      const cname = String(c.course_name != null ? c.course_name : '').trim() || '(강좌명 없음)';
      return { value: cid, label: cname };
    });
    courseItems.sort(function (a, b) {
      return a.label.localeCompare(b.label, 'ko');
    });
    plannerSelectFillOptions_(courseEl, courseItems, '강좌명 선택');
    fromLevel = 'course';
  }

  const courseId = String(courseEl.value || '').trim();
  if (fromLevel === 'course') {
    const courseRow = cat.courses.find(function (c) {
      return c && String(c.course_id) === courseId;
    });
    const cname = courseRow ? String(courseRow.course_name != null ? courseRow.course_name : '').trim() : '';
    const lecRows = cat.lectures
      .filter(function (L) {
        return L && String(L.course_id) === courseId;
      })
      .sort(function (a, b) {
        return (Number(a.lecture_no) || 0) - (Number(b.lecture_no) || 0);
      });
    const lecItems = lecRows.map(function (L) {
      const lid = L.lecture_id != null ? String(L.lecture_id) : '';
      const no = Number(L.lecture_no);
      const label = plannerCurriculumLectureOptionLabel_(L.lecture_name, no);
      return { value: lid, label: label };
    });
    plannerSelectFillOptions_(lecEl, lecItems, '회차 선택');
  }

  plannerCurriculumUpdateTitlePreview_(slot, st, lecEl, titleEl);
  plannerControlFitSyncWidthsIn_(slot);
}

/**
 * @param {HTMLElement} slot
 * @param {object} st
 * @param {HTMLSelectElement} lecEl
 * @param {HTMLElement|null} titleEl
 */
function plannerCurriculumUpdateTitlePreview_(slot, st, lecEl, titleEl) {
  const cat = plannerCurriculumCatalog_(st);
  let preview = '';
  const lecId = String(lecEl.value || '').trim();
  if (lecId) {
    const lec = cat.lectures.find(function (L) {
      return L && String(L.lecture_id) === lecId;
    });
    const courseRow = cat.courses.find(function (c) {
      return c && String(c.course_id) === String(lec && lec.course_id);
    });
    if (lec && courseRow) {
      preview = plannerCurriculumTodoTitleForCalendar_(
        courseRow.instructor,
        courseRow.course_name,
        lec.lecture_no,
        lec.lecture_name,
        plannerSubjectCodeFromCatalogCourse_(courseRow)
      );
    }
  }
  if (titleEl && 'value' in titleEl) {
    const inp = /** @type {HTMLInputElement} */ (titleEl);
    inp.value = preview;
    if (inp.classList.contains('sp-plan-manual__control--fit')) {
      plannerControlFitSyncWidth_(inp, preview);
    }
  }
}

/**
 * @param {HTMLElement} slot
 * @param {object} st
 * @param {'direct'|'curriculum'} mode
 * @param {'panel'|'calreg'} [formKind]
 */
function plannerSetManualRegMode_(slot, st, mode, formKind) {
  const kind = formKind === 'calreg' ? 'calreg' : 'panel';
  const ids = plannerManualFormIds_(kind);
  const direct = slot.querySelector('#' + ids.directBlock);
  const curr = slot.querySelector('#' + ids.currBlock);
  const btnD = slot.querySelector('#' + ids.modeDirect);
  const btnC = slot.querySelector('#' + ids.modeCurr);
  const next = mode === 'curriculum' ? 'curriculum' : 'direct';
  if (st && typeof st === 'object') st.manualRegMode = next;
  if (direct) direct.toggleAttribute('hidden', next !== 'direct');
  if (curr) curr.toggleAttribute('hidden', next !== 'curriculum');
  if (btnD) {
    btnD.setAttribute('aria-pressed', next === 'direct' ? 'true' : 'false');
    btnD.classList.toggle('is-active', next === 'direct');
  }
  if (btnC) {
    btnC.setAttribute('aria-pressed', next === 'curriculum' ? 'true' : 'false');
    btnC.classList.toggle('is-active', next === 'curriculum');
  }
  if (next === 'curriculum') plannerCurriculumRefreshCascade_(slot, st, 'all', kind);
}

/**
 * 커리큘럼 개별 등록 → `monthTodos` append.
 * @param {HTMLElement} slot
 * @param {object} st
 * @param {{ dueYmd?: string, formKind?: 'panel'|'calreg' }} [opts]
 * @returns {string}
 */
function plannerAppendCurriculumTodoFromForm_(slot, st, opts) {
  if (!plannerCurriculumHasCatalog_(st)) {
    return '커리큘럼 마스터가 없어 등록할 수 없습니다.';
  }
  const kind = opts && opts.formKind === 'calreg' ? 'calreg' : 'panel';
  const ids = plannerManualFormIds_(kind);
  const dueOverride = opts && opts.dueYmd ? String(opts.dueYmd).trim() : '';
  const dueEl = ids.currDue ? slot.querySelector('#' + ids.currDue) : null;
  const lecEl = slot.querySelector('#' + ids.currLecture);
  const due =
    dueOverride ||
    (dueEl && 'value' in dueEl ? String(/** @type {HTMLInputElement} */ (dueEl).value).trim() : '');
  const lecId = lecEl && 'value' in lecEl ? String(/** @type {HTMLSelectElement} */ (lecEl).value).trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return '날짜를 선택해 주세요.';
  if (!lecId.length) return '회차(강의)를 선택해 주세요.';

  const cat = plannerCurriculumCatalog_(st);
  const lec = cat.lectures.find(function (L) {
    return L && String(L.lecture_id) === lecId;
  });
  if (!lec) return '선택한 강의를 찾을 수 없습니다. 다시 고르거나 새로고침해 주세요.';
  const courseRow = cat.courses.find(function (c) {
    return c && String(c.course_id) === String(lec.course_id);
  });
  if (!courseRow) return '강좌 정보를 찾을 수 없습니다.';

  const category = plannerSubjectCodeFromCatalogCourse_(courseRow);
  if (!category) return '이 강좌의 과목(문법·논리·독해·어휘)을 확인할 수 없습니다. 마스터 시트 subject를 맞춰 주세요.';

  const title = plannerCurriculumTodoTitleForCalendar_(
    courseRow.instructor,
    courseRow.course_name,
    lec.lecture_no,
    lec.lecture_name,
    category
  );
  if (!title.length) return '제목을 만들 수 없습니다. 강좌명·회차를 확인해 주세요.';

  const task_id = 'lec_' + lecId + '_' + due;
  const todayCur = plannerTodayYmdSeoul_();
  plannerEnsureMonthTodos_(st);
  const dup = st.monthTodos.some(function (m) {
    return m && String(m.task_id) === task_id;
  });
  if (dup) return '같은 날짜에 이미 추가한 회차입니다.';

  plannerPushMonthTodo_(
    st,
    plannerTodoRowLocal_({
      task_id: task_id,
      title: title,
      date: due,
      category: category,
      lecture_id: lecId,
      timeline_slots: '[]',
      sort_key: 0,
      mark: 'none',
      trace_dates: '[]',
      created_date: todayCur,
      updated_date: todayCur
    })
  );
  if (lecEl instanceof HTMLSelectElement) lecEl.value = '';
  plannerCurriculumRefreshCascade_(slot, st, 'course', kind);
  return '';
}

/**
 * 고정 일정 — 하루·시간 구간(개별 등록·달력 모달).
 * @param {object} st
 * @param {string} ymd
 * @param {string} title
 * @param {number} startIx
 * @param {number} endIx
 * @returns {string}
 */
function plannerAppendFixedTodoForOneDay_(st, ymd, title, startIx, endIx) {
  const name = String(title != null ? title : '').trim();
  if (!name.length) return '일정 이름을 입력해 주세요.';
  const day = String(ymd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '날짜가 올바르지 않습니다.';
  const s0 = Number(startIx);
  const s1 = Number(endIx);
  if (!isFinite(s0) || !isFinite(s1)) return '시간을 선택해 주세요.';
  if (s1 <= s0) return '끝 시간은 시작 시간보다 뒤여야 합니다.';
  const maxIx = PLAN_TIMELINE_HOURS_ORDERED.length * PLAN_TIMELINE_CELLS_PER_HOUR;
  if (!plannerFixedTimelineOrderIndexIsHalfHour_(s0)) return '시작 시각은 30분 단위만 선택할 수 있습니다.';
  if (s1 !== maxIx && !plannerFixedTimelineOrderIndexIsHalfHour_(s1)) {
    return '끝 시각은 30분 단위 또는 「타임라인 끝」만 선택할 수 있습니다.';
  }
  if (s0 < 0 || s0 >= maxIx) return '시간 범위가 올바르지 않습니다.';
  if (s1 <= 0 || s1 > maxIx) return '시간 범위가 올바르지 않습니다.';
  plannerEnsureMonthTodos_(st);
  if (!st.dayFixedBlockSlotsByDate) st.dayFixedBlockSlotsByDate = {};
  /** @type {string[]} */
  const slotKeysForRows = [];
  let ix;
  for (ix = s0; ix < s1; ix++) {
    const ks = plannerOrderIndexToSlotKey_(ix);
    if (ks) slotKeysForRows.push(ks);
  }
  const timeline_slots = JSON.stringify(slotKeysForRows);
  const ruleId = 'fxd_' + String(Date.now()) + '_' + String(Math.floor(Math.random() * 1e6));
  const task_id = '__sp_fix_' + ruleId + '_' + day;
  const todayFx = plannerTodayYmdSeoul_();
  plannerPushMonthTodo_(
    st,
    plannerTodoRowLocal_({
      task_id: task_id,
      title: name,
      date: day,
      category: PLAN_CATEGORY_FIXED,
      lecture_id: '',
      timeline_slots: timeline_slots,
      sort_key: -600,
      mark: 'none',
      trace_dates: '[]',
      created_date: todayFx,
      updated_date: todayFx
    }),
    true
  );
  if (!st.dayFixedBlockSlotsByDate[day]) st.dayFixedBlockSlotsByDate[day] = {};
  const slots = plannerEnsureTimelineTodoSlots_(st, day);
  let skdx;
  for (skdx = s0; skdx < s1; skdx++) {
    const k = plannerOrderIndexToSlotKey_(skdx);
    if (!k) continue;
    st.dayFixedBlockSlotsByDate[day][k] = true;
    try {
      delete slots[k];
    } catch (_e) {
      slots[k] = '';
    }
  }
  plannerStripStudyTimelineSlotsOnDay_(st, day, slotKeysForRows);
  if (st.dayTimelineTodoByDate && st.dayTimelineTodoByDate[day]) {
    try {
      delete st.dayTimelineTodoByDate[day];
    } catch (_e2) {
      st.dayTimelineTodoByDate[day] = {};
    }
  }
  if (st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime())) {
    plannerRebuildFixedBlockSlotsForMonth_(st, st.viewMonth);
  }
  plannerRebuildQuickPostPayload_(st);
  return '';
}

/**
 * 일반 등록 폼 → `monthTodos`에 append 후 페이로드 재생성.
 * @param {HTMLElement} slot
 * @param {object} st
 * @param {{ dueYmd?: string, formKind?: 'panel'|'calreg' }} [opts]
 * @returns {string} 빈 문자열 = 성공, 아니면 에러 메시지
 */
function plannerAppendManualTodoFromForm_(slot, st, opts) {
  plannerEnsureMonthTodos_(st);
  const kind = opts && opts.formKind === 'calreg' ? 'calreg' : 'panel';
  const ids = plannerManualFormIds_(kind);
  const dueOverride = opts && opts.dueYmd ? String(opts.dueYmd).trim() : '';
  const titleEl = slot.querySelector('#' + ids.manualTitle);
  const dueEl = ids.manualDue ? slot.querySelector('#' + ids.manualDue) : null;
  const catEl = slot.querySelector('#' + ids.manualCat);
  const title = titleEl && 'value' in titleEl ? String(/** @type {HTMLInputElement} */ (titleEl).value).trim() : '';
  const due =
    dueOverride ||
    (dueEl && 'value' in dueEl ? String(/** @type {HTMLInputElement} */ (dueEl).value).trim() : '');
  const category = catEl && 'value' in catEl ? String(/** @type {HTMLSelectElement} */ (catEl).value).trim() : 'misc';
  if (!title.length) return '할 일 제목을 입력해 주세요.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return '날짜를 선택해 주세요.';
  if (category === PLAN_CATEGORY_FIXED) {
    const startEl = slot.querySelector('#' + ids.fixedStart);
    const endEl = slot.querySelector('#' + ids.fixedEnd);
    const s0 = startEl && 'value' in startEl ? Number(/** @type {HTMLSelectElement} */ (startEl).value) : NaN;
    const s1 = endEl && 'value' in endEl ? Number(/** @type {HTMLSelectElement} */ (endEl).value) : NaN;
    const msgFx = plannerAppendFixedTodoForOneDay_(st, due, title, s0, s1);
    if (!msgFx.length && titleEl) /** @type {HTMLInputElement} */ (titleEl).value = '';
    return msgFx;
  }
  const allowedC = {};
  PLANNER_STUDY_CATEGORY_ORDER.forEach(function (code) {
    allowedC[code] = true;
  });
  const c = allowedC[category] ? category : 'misc';
  let task_id = '';
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      task_id = 'man_' + due + '_' + globalThis.crypto.randomUUID();
    }
  } catch (_e) {
    task_id = '';
  }
  if (!task_id) task_id = 'man_' + due + '_' + String(Date.now()) + '_' + String(Math.floor(Math.random() * 1e6));
  const todayMan = plannerTodayYmdSeoul_();
  plannerPushMonthTodo_(
    st,
    plannerTodoRowLocal_({
      task_id: task_id,
      title: title,
      date: due,
      category: c,
      lecture_id: '',
      timeline_slots: '[]',
      sort_key: 0,
      mark: 'none',
      trace_dates: '[]',
      created_date: todayMan,
      updated_date: todayMan
    })
  );
  if (titleEl) /** @type {HTMLInputElement} */ (titleEl).value = '';
  return '';
}

/**
 * @param {object} st
 * @param {string} dateYmd
 * @returns {{ task_id: string, title: string, date: string, category: string, sort_key: number, created_date: string, updated_date: string }[]}
 */
function plannerOrderedDayTodos_(st, dateYmd) {
  const day = String(dateYmd || '').trim();
  const rows = plannerMonthTodosForDay_(st, day)
    .filter(function (r) {
      const cat = r ? String(r.category || '').trim() : '';
      return cat !== 'memo' && cat !== PLAN_CATEGORY_EVENT;
    })
    .slice();
  rows.sort(plannerCompareMonthTodoDisplay_);
  return plannerWithFixedRoutineTodosFirst_(day, rows);
}

/**
 * @param {HTMLElement} root
 */
function plannerRefreshPostPreview_(root) {
  const pre = root.querySelector('#sp-plan-post-preview');
  if (!pre) return;
  const st = root.__spPlanState;
  const body = st && st.plannerQuickPostBody ? st.plannerQuickPostBody : { action: 'plannerPersonalTodosApply', todos: [] };
  try {
    pre.textContent = JSON.stringify(body, null, 2);
  } catch (_e) {
    pre.textContent = '';
  }
}

/**
 * 해당 날짜 타임라인에서 `taskId`에 칠해진 10분 칸 합(분).
 * @param {object} st
 * @param {string} ymd
 * @param {string} taskId
 * @returns {number}
 */
function plannerTaskTimelineMinutesForDay_(st, ymd, taskId) {
  const slots = st.dayTimelineTodoByDate && st.dayTimelineTodoByDate[ymd];
  if (!slots || typeof slots !== 'object') return 0;
  const tid = String(taskId || '').trim();
  if (!tid) return 0;
  const map = plannerDayTodoIdMapForDay_(ymd, st);
  const row = map[tid];
  if (plannerIsExcludedFromStudyTotals_(tid, row && row.category)) return 0;
  let n = 0;
  Object.keys(slots).forEach(function (k) {
    if (!plannerTimelineSlotKeyParse_(k)) return;
    if (plannerFixedSlotBlocked_(st, ymd, k)) return;
    if (String(slots[k] != null ? slots[k] : '').trim() === tid) n++;
  });
  return n * PLAN_TIMELINE_CELL_MIN;
}

/**
 * 일일 모달 왼쪽: 과목(연속 동일 과목 rowspan) · 할 일 · 달성도(select) · 공부시간 체크.
 * @param {string} dateYmd
 * @param {object} st
 * @returns {string}
 */
function plannerDayTodosFromPayloadHtml_(dateYmd, st) {
  const rows = plannerOrderedDayTodos_(st, dateYmd);
  const brush = st.modalBrushTodoId ? String(st.modalBrushTodoId) : '';
  if (!rows.length) {
    return (
      '<p class="sp-plan-todoSideEmpty" role="status">이 날짜에 표시할 할 일이 없습니다.</p>'
    );
  }
  let body = '';
  let i = 0;
  while (i < rows.length) {
    const r0 = rows[i];
    const mk = plannerTodoSideMergeKey_(r0);
    let j = i + 1;
    while (j < rows.length && plannerTodoSideMergeKey_(rows[j]) === mk) {
      j++;
    }
    const rowspan = j - i;
    const subjHead = esc(plannerTodoSideSubjectLabel_(r0));
    for (let k = i; k < j; k++) {
      const r = rows[k];
      const id = String(r.task_id || '');
      let rowKind = '';
      if (id === PLAN_FIXED_SLEEP_TODO_ID) rowKind = ' sp-plan-todoSide__row--sleep';
      else if (id === PLAN_FIXED_MEAL_TODO_ID) rowKind = ' sp-plan-todoSide__row--meal';
      else if (String(r.category || '').trim() === PLAN_CATEGORY_FIXED) rowKind = ' sp-plan-todoSide__row--fixed';
      else if (plannerIsTraceGhostDisplay_(r)) rowKind = ' sp-plan-todoSide__row--trace';
      let title = esc(String(r.title || '').trim() || id);
      if (plannerIsTraceGhostDisplay_(r)) {
        const toD = String(r.date != null ? r.date : '').trim();
        if (toD) title += esc(' → ' + toD);
      }
      const isTrace = plannerIsTraceGhostDisplay_(r);
      const isFixedSched = String(r.category || '').trim() === PLAN_CATEGORY_FIXED;
      const isRoutine = plannerIsRoutineExcludedFromStudyTotals_(id, r.category);
      const markEligible = plannerTodoMarkEligible_(r);
      const isB = !isTrace && !isFixedSched && Boolean(brush && brush === id);
      const comp = plannerTodoCompletionGet_(st, dateYmd, id);
      const selNone = comp === 'none' ? ' selected' : '';
      const selO = comp === 'circle' ? ' selected' : '';
      const selTri = comp === 'triangle' ? ' selected' : '';
      const selX = comp === 'x' ? ' selected' : '';
      const hueCls =
        isTrace || rowKind ? '' : ' sp-plan-todoCat--' + plannerTodoPaintColorClass_(st, dateYmd, id, r);
      body +=
        '<tr class="sp-plan-todoSide__row' +
        rowKind +
        hueCls +
        (isB ? ' is-brushRow' : '') +
        '" data-todo-id="' +
        esc(id) +
        '"' +
        (isTrace ? ' data-sp-plan-trace="1"' : '') +
        '>';
      if (k === i) {
        body +=
          '<th class="sp-plan-todoSide__thSubj" scope="row" rowspan="' +
          String(rowspan) +
          '">' +
          subjHead +
          '</th>';
      }
      body += '<td class="sp-plan-todoSide__tdTodo"><span class="sp-plan-todoSide__title">' + title + '</span>';
      if (!isTrace && isFixedSched) {
        body +=
          '<button type="button" class="sp-plan-todoSide__brushBtn is-fixedNoBrush" disabled aria-disabled="true" title="고정 일정은 시간표에 칠 수 없습니다">체크</button>';
      } else if (!isTrace) {
        body +=
          '<button type="button" class="sp-plan-todoSide__brushBtn' +
          (isB ? ' is-brush' : '') +
          '" data-action="todo-brush" aria-pressed="' +
          (isB ? 'true' : 'false') +
          '" aria-label="이 할 일로 시간표에 표시">' +
          (isB ? '체크 ✓' : '체크') +
          '</button>';
      }
      body += '</td><td class="sp-plan-todoSide__tdMark">';
      if (isTrace || isFixedSched || isRoutine || !markEligible) {
        body += '<span class="sp-plan-todoSide__traceMark" aria-hidden="true">—</span>';
      } else {
        body +=
          '<label class="sp-plan-todoSide__markLbl"><span class="sp-plan-vh">달성도</span>' +
          '<select class="sp-plan-todoSide__markSel" data-todo-id="' +
          esc(id) +
          '" aria-label="' +
          esc(String(r.title || '').trim() || id) +
          ' 달성도">' +
          '<option value="none"' +
          selNone +
          '>선택</option>' +
          '<option value="circle"' +
          selO +
          '>○</option>' +
          '<option value="triangle"' +
          selTri +
          '>△</option>' +
          '<option value="x"' +
          selX +
          '>×</option>' +
          '</select></label>';
      }
      body += '</td></tr>';
    }
    i = j;
  }
  return (
    '<div class="sp-plan-todoSideWrap">' +
    '<table class="sp-plan-todoSideTable">' +
    '<thead><tr>' +
    '<th scope="col" class="sp-plan-todoSide__colSubj">과목</th>' +
    '<th scope="col" class="sp-plan-todoSide__colTodo">할 일</th>' +
    '<th scope="col" class="sp-plan-todoSide__colMark">달성도</th>' +
    '</tr></thead><tbody>' +
    body +
    '</tbody></table></div>'
  );
}

/**
 * @param {object} st
 * @param {string} ymd
 */
function plannerAssignedMinutesForDay_(st, ymd) {
  const slots = st.dayTimelineTodoByDate && st.dayTimelineTodoByDate[ymd];
  if (!slots) return 0;
  const map = plannerDayTodoIdMapForDay_(ymd, st);
  let n = 0;
  Object.keys(slots).forEach(function (k) {
    if (plannerFixedSlotBlocked_(st, ymd, k)) return;
    const tid = String(slots[k] != null ? slots[k] : '').trim();
    if (!tid) return;
    const row = map[tid];
    if (plannerIsExcludedFromStudyTotals_(tid, row && row.category)) return;
    n++;
  });
  return n * PLAN_TIMELINE_CELL_MIN;
}

/**
 * 빠른 등록: 커리큘럼 강좌·회차 구간을 선택 요일에 그리디 배치 → `monthTodos`에 추가.
 * @param {object} st
 * @param {Date} viewMonth
 * @param {number[]} weekdays 0=일 … 6=토
 * @param {string} courseId
 * @param {number} fromNo
 * @param {number} toNo
 * @param {Record<number, string>} countByDow 요일별 강 수(빈 문자열이면 n빵)
 * @returns {string} 에러 문구 또는 ''
 */
function plannerApplyQuickCurriculumToMonthTodos_(
  st,
  viewMonth,
  weekdays,
  courseId,
  fromNo,
  toNo,
  countByDow,
  startDateOpt
) {
  const cat = plannerCurriculumCatalog_(st);
  const courseRow = cat.courses.find(function (c) {
    return c && String(c.course_id) === String(courseId);
  });
  if (!courseRow) return '강좌를 선택해 주세요.';
  const category = plannerSubjectCodeFromCatalogCourse_(courseRow);
  if (!category) return '이 강좌의 과목(문법·논리·독해·어휘)을 확인할 수 없습니다.';
  const cname = String(courseRow.course_name != null ? courseRow.course_name : '').trim();
  const lecList = cat.lectures
    .filter(function (L) {
      return L && String(L.course_id) === String(courseId);
    })
    .sort(function (a, b) {
      return (Number(a.lecture_no) || 0) - (Number(b.lecture_no) || 0);
    });
  const lo = Math.min(Number(fromNo) || 1, Number(toNo) || 1);
  const hi = Math.max(Number(fromNo) || 1, Number(toNo) || 1);
  const inRange = lecList.filter(function (L) {
    const no = Number(L.lecture_no);
    return isFinite(no) && no >= lo && no <= hi;
  });
  if (!inRange.length) return '선택한 회차가 없습니다.';
  const y = viewMonth.getFullYear();
  const m0 = viewMonth.getMonth();
  const last = new Date(y, m0 + 1, 0).getDate();
  const startDateStr = String(startDateOpt != null ? startDateOpt : '').trim();
  let startDay = 1;
  if (startDateStr.length) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) return '시작일 형식이 올바르지 않습니다.';
    const parts = startDateStr.split('-').map(function (s) {
      return Number(s);
    });
    const sd = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(sd.getTime())) return '시작일이 올바르지 않습니다.';
    if (sd.getFullYear() !== y || sd.getMonth() !== m0) return '시작일은 현재 보고 있는 달 안에서만 선택할 수 있습니다.';
    startDay = sd.getDate();
  }
  /** @type {{ ymd: string, dow: number }[]} */
  const dateSlots = [];
  let day;
  for (day = startDay; day <= last; day++) {
    const dd = new Date(y, m0, day);
    if (weekdays.indexOf(dd.getDay()) >= 0) {
      dateSlots.push({ ymd: plannerYmdFromParts_(y, m0, day), dow: dd.getDay() });
    }
  }
  if (!dateSlots.length) return '요일을 한 개 이상 선택해 주세요.';
  const N = inRange.length;
  const nbung = plannerNbungCounts_(dateSlots.length, N);
  let lecIx = 0;
  const todayQ = plannerTodayYmdSeoul_();
  let di;
  for (di = 0; di < dateSlots.length; di++) {
    const ymd = dateSlots[di].ymd;
    const dowFix = dateSlots[di].dow;
    const rawCnt = countByDow && countByDow[dowFix] != null ? String(countByDow[dowFix]).trim() : '';
    let cnt = rawCnt.length ? Math.max(0, Math.floor(Number(rawCnt))) : nbung[di] || 0;
    if (!isFinite(cnt)) cnt = nbung[di] || 0;
    let k;
    for (k = 0; k < cnt && lecIx < inRange.length; k++) {
      const L = inRange[lecIx];
      lecIx++;
      const lecId = L.lecture_id != null ? String(L.lecture_id) : '';
      const title = plannerCurriculumTodoTitleForCalendar_(
        courseRow.instructor,
        cname,
        L.lecture_no,
        L.lecture_name,
        category
      );
      const task_id = 'lec_' + lecId + '_' + ymd;
      plannerPushMonthTodo_(
        st,
        plannerTodoRowLocal_({
          task_id: task_id,
          title: title,
          date: ymd,
          category: category,
          lecture_id: lecId,
          timeline_slots: '[]',
          sort_key: 0,
          mark: 'none',
          trace_dates: '[]',
          created_date: todayQ,
          updated_date: todayQ
        }),
        true
      );
    }
  }
  plannerRebuildQuickPostPayload_(st);
  return '';
}

/**
 * @param {HTMLElement} slot
 */
function plannerQuickSyncDowCountInputs_(slot) {
  slot.querySelectorAll('input[name="sp-dow"]').forEach(function (cb) {
    const el = /** @type {HTMLInputElement} */ (cb);
    const inp = slot.querySelector('.sp-plan-quick__dowCnt[data-dow="' + el.value + '"]');
    if (!(inp instanceof HTMLInputElement)) return;
    if (el.checked) inp.removeAttribute('hidden');
    else {
      inp.setAttribute('hidden', 'hidden');
      inp.value = '';
    }
  });
}

/**
 * @param {HTMLElement} slot
 * @param {object} st
 * @param {'all'|'subject'|'instructor'|'course'} fromLevel
 */
function plannerQuickCurriculumRefreshCascade_(slot, st, fromLevel) {
  const subjEl = slot.querySelector('#sp-quick-subj');
  const instEl = slot.querySelector('#sp-quick-instructor');
  const courseEl = slot.querySelector('#sp-quick-course');
  const fromEl = slot.querySelector('#sp-quick-lec-from');
  const toEl = slot.querySelector('#sp-quick-lec-to');
  const hintEl = slot.querySelector('#sp-quick-catalog-hint');
  if (
    !(subjEl instanceof HTMLSelectElement) ||
    !(instEl instanceof HTMLSelectElement) ||
    !(courseEl instanceof HTMLSelectElement) ||
    !(fromEl instanceof HTMLSelectElement) ||
    !(toEl instanceof HTMLSelectElement)
  ) {
    return;
  }
  const cat = plannerCurriculumCatalog_(st);
  const has = plannerCurriculumHasCatalog_(st);
  if (hintEl) {
    if (!has) {
      hintEl.textContent = '등록된 강좌가 없습니다.';
      hintEl.removeAttribute('hidden');
    } else {
      hintEl.textContent = '';
      hintEl.setAttribute('hidden', 'hidden');
    }
  }
  subjEl.disabled = !has;
  instEl.disabled = !has;
  courseEl.disabled = !has;
  fromEl.disabled = !has;
  toEl.disabled = !has;
  if (fromLevel === 'all') {
    const subjItems = plannerCurriculumSubjectSelectItems_(cat.courses);
    plannerSelectFillOptions_(subjEl, subjItems, '과목 선택');
    subjEl.value = subjItems.length ? subjItems[0].value : '';
    fromLevel = 'subject';
  }
  const subjectCode = String(subjEl.value || '').trim();
  if (fromLevel === 'subject') {
    const coursesSub = plannerCurriculumCoursesForSubject_(cat.courses, subjectCode);
    const seenInst = {};
    const instItems = [];
    coursesSub.forEach(function (c) {
      const inst = String(c.instructor != null ? c.instructor : '').trim() || '(선생님 미입력)';
      if (seenInst[inst]) return;
      seenInst[inst] = true;
      instItems.push({ value: inst, label: inst });
    });
    instItems.sort(function (a, b) {
      return a.label.localeCompare(b.label, 'ko');
    });
    plannerSelectFillOptions_(instEl, instItems, '선생님 선택');
    fromLevel = 'instructor';
  }
  const instructor = String(instEl.value || '').trim();
  if (fromLevel === 'instructor') {
    const coursesSub = plannerCurriculumCoursesForSubject_(cat.courses, subjectCode);
    const coursesInst = coursesSub.filter(function (c) {
      const inst = String(c.instructor != null ? c.instructor : '').trim() || '(선생님 미입력)';
      return inst === instructor;
    });
    const courseItems = coursesInst.map(function (c) {
      const cid = c.course_id != null ? String(c.course_id) : '';
      const cname = String(c.course_name != null ? c.course_name : '').trim() || '(강좌명 없음)';
      return { value: cid, label: cname };
    });
    courseItems.sort(function (a, b) {
      return a.label.localeCompare(b.label, 'ko');
    });
    plannerSelectFillOptions_(courseEl, courseItems, '강좌명 선택');
    fromLevel = 'course';
  }
  const courseId = String(courseEl.value || '').trim();
  if (fromLevel === 'course') {
    const courseRow = cat.courses.find(function (c) {
      return c && String(c.course_id) === courseId;
    });
    const cname = courseRow ? String(courseRow.course_name != null ? courseRow.course_name : '').trim() : '';
    const lecRows = cat.lectures
      .filter(function (L) {
        return L && String(L.course_id) === courseId;
      })
      .sort(function (a, b) {
        return (Number(a.lecture_no) || 0) - (Number(b.lecture_no) || 0);
      });
    const lecItems = lecRows.map(function (L) {
      const no = Number(L.lecture_no);
      return {
        value: String(isFinite(no) ? no : ''),
        label: plannerCurriculumLectureOptionLabel_(L.lecture_name, no)
      };
    });
    plannerSelectFillOptions_(fromEl, lecItems, '시작 회차');
    plannerSelectFillOptions_(toEl, lecItems, '끝 회차');
    if (lecItems.length) {
      fromEl.value = lecItems[0].value;
      toEl.value = lecItems[lecItems.length - 1].value;
    }
  }
  plannerControlFitSyncWidthsIn_(slot);
}

/**
 * @param {HTMLElement} slot
 * @returns {Record<number, string>}
 */
function plannerQuickReadCountByDow_(slot) {
  /** @type {Record<number, string>} */
  const out = {};
  slot.querySelectorAll('.sp-plan-quick__dowCnt').forEach(function (inp) {
    if (!(inp instanceof HTMLInputElement)) return;
    const d = inp.getAttribute('data-dow');
    if (d == null || d === '') return;
    out[Number(d)] = String(inp.value != null ? inp.value : '').trim();
  });
  return out;
}

/**
 * 달력 일자 칸 할 일 뱃지 한 줄.
 * @param {string} mod grammar|logic|read|vocab|misc
 * @param {string} label
 * @returns {string}
 */
/**
 * 달성도 신호등 — 칩 오른쪽 15% 그라데이션용 클래스. `none`이면 빈 문자열.
 * @param {'none'|'circle'|'triangle'|'x'} mark
 * @returns {string}
 */
function plannerTodoMarkChipClass_(mark) {
  const v = String(mark != null ? mark : 'none').trim();
  if (v === 'circle') return ' has-mark is-mark-circle';
  if (v === 'triangle') return ' has-mark is-mark-triangle';
  if (v === 'x') return ' has-mark is-mark-x';
  return '';
}

/**
 * @param {object|null} row
 * @returns {boolean}
 */
function plannerTodoMarkEligible_(row) {
  if (!row || typeof row !== 'object') return false;
  if (plannerIsTraceGhostDisplay_(row)) return false;
  const cat = String(row.category != null ? row.category : '').trim();
  if (cat === PLAN_CATEGORY_FIXED || cat === PLAN_CATEGORY_EVENT || cat === 'memo') return false;
  const tid = String(row.task_id != null ? row.task_id : '').trim();
  if (plannerIsRoutineExcludedFromStudyTotals_(tid, cat)) return false;
  return true;
}

/**
 * @param {string} mod
 * @param {string} label
 * @param {{ taskId?: string, mark?: string, isTrace?: boolean, traceYmd?: string }} [attrs]
 * @returns {string}
 */
function plannerCurBadgeSpan_(mod, label, attrs) {
  const body = String(label != null ? label : '').trim();
  if (!body) return '';
  const modStr = String(mod != null ? mod : '').trim();
  const m = (plannerIsStudyCategoryCode_(modStr) || modStr === 'fixed') ? modStr : 'misc';
  const tid = attrs && attrs.taskId ? String(attrs.taskId).trim() : '';
  if (attrs && attrs.isTrace) {
    const traceYmd = attrs.traceYmd != null ? String(attrs.traceYmd).trim() : '';
    const traceData =
      tid.length > 0
        ? ' data-sp-task-id="' +
          esc(tid) +
          '" data-sp-trace="1" data-sp-trace-ymd="' +
          escAttr(traceYmd) +
          '" data-sp-ymd-parent="1"'
        : '';
    return (
      '<span class="sp-plan-curBadge sp-plan-curBadge--trace sp-plan-curBadge--' +
      esc(m) +
      '"' +
      traceData +
      ' title="' +
      esc(body + ' (이전 일정 흔적)') +
      '">' +
      '<span class="sp-plan-curBadge__text">' +
      esc(body) +
      '</span></span>'
    );
  }
  const markRaw = attrs && attrs.mark != null ? String(attrs.mark).trim() : 'none';
  const mark =
    markRaw === 'circle' || markRaw === 'triangle' || markRaw === 'x' ? markRaw : 'none';
  const data =
    tid.length > 0
      ? ' data-sp-task-id="' + esc(tid) + '" data-sp-ymd-parent="1"'
      : '';
  const markCls = plannerTodoMarkChipClass_(/** @type {'none'|'circle'|'triangle'|'x'} */ (mark));
  const titleExtra =
    mark === 'circle'
      ? ' · 달성도 양호'
      : mark === 'triangle'
        ? ' · 달성도 보통'
        : mark === 'x'
          ? ' · 달성도 미달'
          : '';
  return (
    '<span class="sp-plan-curBadge sp-plan-curBadge--' +
    esc(m) +
    markCls +
    '"' +
    data +
    ' data-sp-draggable-todo="1"' +
    (mark !== 'none' ? ' data-sp-mark="' + esc(mark) + '"' : '') +
    ' title="' +
    esc(body + titleExtra) +
    '">' +
    '<span class="sp-plan-curBadge__text">' +
    esc(body) +
    '</span></span>'
  );
}

/**
 * 제목 문자열에서 `· 3강`, `1~3강` 등 **강 번호** 나열.
 * @param {string} title
 * @returns {number[]}
 */
function plannerLessonsFromStudyTitle_(title) {
  const s = String(title != null ? title : '').trim();
  if (!s.length) return [];
  /** @type {number[]} */
  const nums = [];
  const re = /(\d+)(?:~(\d+))?강/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const a = Number(m[1]);
    const b = m[2] != null ? Number(m[2]) : a;
    if (!isFinite(a) || a <= 0) continue;
    if (isFinite(b) && b >= a) {
      for (let k = a; k <= b; k++) {
        nums.push(k);
      }
    } else {
      nums.push(a);
    }
  }
  return nums;
}

/**
 * 강 번호 배열 → `1`, `1~3`, `1, 4~6` (중복 제거·연속 구간 묶음).
 * @param {number[]} nums
 * @returns {string}
 */
function plannerLessonsToOutline_(nums) {
    const u = nums
      .slice()
      .sort(function (a, b) {
        return a - b;
      })
      .filter(function (v, i, a) {
        return i === 0 || v !== a[i - 1];
      });
    if (!u.length) return '';
    const parts = [];
    let runStart = u[0];
    let prev = u[0];
    for (let i = 1; i <= u.length; i++) {
      const cur = u[i];
      if (i === u.length || cur !== prev + 1) {
        parts.push(runStart === prev ? String(runStart) : runStart + '~' + prev);
        if (i < u.length) {
          runStart = cur;
          prev = cur;
        }
      } else {
        prev = cur;
      }
    }
    return parts.join(', ');
  }

/**
 * 달력 칸 todo 칩 1개 (과목색 `sp-plan-curBadge`).
 * @param {{ title: string, task_id: string, mark?: string, isTrace?: boolean, traceYmd?: string }} item
 * @param {string} [mod] grammar|logic|read|vocab|misc
 * @returns {string}
 */
function plannerDayCellTodoChipHtml_(item, mod) {
  const t = String(item && item.title != null ? item.title : '').trim();
  const tid = String(item && item.task_id != null ? item.task_id : '').trim();
  if (!t || !tid) return '';
  const m =
    mod && (plannerIsStudyCategoryCode_(mod) || mod === 'fixed')
      ? mod
      : plannerTodoCategoryToken_(tid);
  if (item && item.isTrace) {
    const traceYmd = item.traceYmd != null ? String(item.traceYmd).trim() : '';
    return plannerCurBadgeSpan_(m, t, { taskId: tid, isTrace: true, traceYmd: traceYmd });
  }
  const mark = item && item.mark != null ? String(item.mark) : 'none';
  return plannerCurBadgeSpan_(m, t, { taskId: tid, mark: mark });
}

/**
 * 과목별 그룹 — 할 일마다 칩을 항상 표시(접기 없음).
 * @param {string} mod
 * @param {string} _headLabel unused (호환)
 * @param {{ title: string, task_id: string }[]} items
 * @returns {string}
 */
function plannerDayCellGroupHtml_(mod, _headLabel, items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return '';
  const m = plannerIsStudyCategoryCode_(mod) && mod !== 'misc' ? mod : 'misc';
  const chips = list
    .map(function (it) {
      return plannerDayCellTodoChipHtml_(it, m);
    })
    .filter(Boolean)
    .join('');
  if (!chips) return '';
  return (
    '<div class="sp-plan-dayCellGroup sp-plan-dayCellGroup--' +
    esc(m) +
    (list.length === 1 ? ' sp-plan-dayCellGroup--solo' : '') +
    '">' +
    chips +
    '</div>'
  );
}

/**
 * 해당 날 메모 본문(없으면 빈 문자열).
 * @param {object} st
 * @param {string} ymd
 * @returns {string}
 */
function plannerDayMemoText_(st, ymd) {
  const day = String(ymd || '').trim();
  let text = '';
  plannerMonthTodosForDay_(st, day).forEach(function (r) {
    if (!r || String(r.category || '').trim() !== 'memo') return;
    const t = String(r.title != null ? r.title : '').trim();
    if (t) text = t;
  });
  if (!text && st.dayMemoByDate && st.dayMemoByDate[day] != null) {
    text = String(st.dayMemoByDate[day]).trim();
  }
  return text;
}

/**
 * 달력 일자 칸 — 메모 있으면 연필 아이콘만(칩·본문 미표시).
 * @param {object} st
 * @param {string} ymd
 * @returns {string}
 */
function plannerDayMemoIconHtml_(st, ymd) {
  const text = plannerDayMemoText_(st, ymd);
  if (!text) return '';
  return (
    '<span role="button" tabindex="0" class="sp-plan-day__memoIcon" data-sp-open-memo="1" data-sp-ymd-parent="1" title="' +
    esc(text) +
    '" aria-label="메모 있음">✏️</span>'
  );
}

/**
 * 달력 일자 칸 **요약 표시**: 과목별 할 일 칩(메모는 날짜 옆 ✏️만 — `plannerDayMemoIconHtml_`).
 * @param {object} st
 * @param {string} key ymd
 * @returns {string}
 */
function plannerQuickPlanCellSummaryHtml_(st, key) {
  const subjName = {};
  PLANNER_STUDY_SUBJECT_DEFS.forEach(function (d) {
    subjName[d.code] = d.label;
  });
  const order = PLANNER_STUDY_CATEGORY_ORDER.slice();
  /** @type {Record<string, { title: string, task_id: string, mark: string, isTrace?: boolean, traceYmd?: string }[]>} */
  const byCat = {};
  const rows = plannerMonthTodosForDay_(st, key);
  rows.forEach(function (t) {
    if (!t || typeof t !== 'object') return;
    const tid = String(t.task_id != null ? t.task_id : '').trim();
    if (!tid) return;
    if (plannerIsRoutineExcludedFromStudyTotals_(tid, t.category)) return;
    const cat = String(t.category != null ? t.category : 'misc').trim() || 'misc';
    if (cat === PLAN_CATEGORY_FIXED || cat === PLAN_CATEGORY_EVENT || cat === 'memo') return;
    const title = String(t.title != null ? t.title : '').trim();
    if (!title) return;
    if (!byCat[cat]) byCat[cat] = [];
    if (plannerIsTraceGhostDisplay_(t)) {
      const traceYmd = String(t._spTraceOnDate != null ? t._spTraceOnDate : key).trim();
      byCat[cat].push({ title: title, task_id: tid, mark: 'none', isTrace: true, traceYmd: traceYmd });
      return;
    }
    const mark = plannerTodoMarkEligible_(t) ? plannerTodoCompletionGet_(st, key, tid) : 'none';
    byCat[cat].push({ title: title, task_id: tid, mark: mark });
  });

  const blocks = [];
  function pushGroup_(code) {
    const items = byCat[code];
    delete byCat[code];
    if (!items || !items.length) return;
    const name = subjName[code] != null ? subjName[code] : code;
    /** @type {number[]} */
    const lessonNums = [];
    items.forEach(function (it) {
      plannerLessonsFromStudyTitle_(it.title).forEach(function (n) {
        lessonNums.push(n);
      });
    });
    let headLabel = name;
    if (lessonNums.length === items.length && lessonNums.length > 0) {
      const outline = plannerLessonsToOutline_(lessonNums);
      if (outline) headLabel = name + ' ' + outline + '강';
    } else if (items.length === 1) {
      headLabel = items[0].title;
    } else {
      headLabel = name + ' ' + items.length + '건';
    }
    const block = plannerDayCellGroupHtml_(code, headLabel, items);
    if (block) blocks.push(block);
  }

  order.forEach(pushGroup_);
  Object.keys(byCat).forEach(function (code) {
    pushGroup_(code);
  });

  if (!blocks.length) return '';
  return '<div class="sp-plan-dayCellSum">' + blocks.join('') + '</div>';
}

/** @param {Record<string, unknown>} legacy */
function plannerMigrateLegacySlotsToTodo_(legacy) {
  const out = {};
  if (!legacy || typeof legacy !== 'object') return out;
  Object.keys(legacy).forEach(function (k) {
    const v = legacy[k];
    if (typeof v === 'boolean') {
      if (v) out[k] = '';
    } else if (typeof v === 'string') {
      out[k] = v;
    }
  });
  return out;
}

/** 과목 합산·레거시: task_id 문자열에서 학습 과목 코드 추출 — `plannerTodoCategoryToken_` (상단 정의). */

/**
 * @param {object} [st]
 * @param {string} [dateYmd]
 * @param {string} taskId
 * @param {{ category?: string }|null} [rowOpt]
 * @returns {string} grammar|logic|read|vocab|misc|…
 */
function plannerTodoPaintColorClass_(st, dateYmd, taskId, rowOpt) {
  const tid = String(taskId != null ? taskId : '').trim();
  if (!tid) return 'misc';
  let cat = rowOpt && rowOpt.category != null ? String(rowOpt.category).trim() : '';
  if (!cat && st && dateYmd) {
    const map = plannerDayTodoIdMapForDay_(String(dateYmd), st);
    if (map[tid]) cat = String(map[tid].category || '').trim();
  }
  return plannerCategoryHueClassForTodo_(tid, cat);
}

/** @param {string} id @returns {string} */
function plannerTodoHueClass_(id) {
  return plannerCategoryHueClassForTodo_(id, '');
}

/** 타임라인 10분 칸 키 — 6시~23시 순서 고정 */
function plannerTimelineOrderedSlotKeys_() {
  /** @type {string[]} */
  const keys = [];
  let hi;
  for (hi = 0; hi < PLAN_TIMELINE_HOURS_ORDERED.length; hi++) {
    const h = PLAN_TIMELINE_HOURS_ORDERED[hi];
    let sub;
    for (sub = 0; sub < PLAN_TIMELINE_CELLS_PER_HOUR; sub++) {
      keys.push(plannerTimelineSlotKey_(h, sub));
    }
  }
  return keys;
}

/**
 * 같은 할 일이 이어진 구간 — 막대 모양 (`solo`|`start`|`mid`|`end`).
 * @param {Record<string, string>} slots
 * @param {string} slotKey
 * @param {string} todoId
 * @returns {string}
 */
function plannerTimelineBarRole_(slots, slotKey, todoId) {
  const tid = String(todoId != null ? todoId : '').trim();
  if (!tid.length) {
    return '';
  }
  const order = plannerTimelineOrderedSlotKeys_();
  const ix = order.indexOf(String(slotKey));
  if (ix < 0) {
    return 'solo';
  }
  const prevT = ix > 0 ? String(slots[order[ix - 1]] != null ? slots[order[ix - 1]] : '').trim() : '';
  const nextT =
    ix < order.length - 1 ? String(slots[order[ix + 1]] != null ? slots[order[ix + 1]] : '').trim() : '';
  const prevSame = prevT === tid;
  const nextSame = nextT === tid;
  if (!prevSame && !nextSame) {
    return 'solo';
  }
  if (!prevSame && nextSame) {
    return 'start';
  }
  if (prevSame && nextSame) {
    return 'mid';
  }
  return 'end';
}

/**
 * 같은 할 일이 **연속**인 막대(run) 안에서 이 칸이 몇 번째 10분 칸인지(0부터). 끊기면 다시 0.
 * @param {Record<string, string>} slots
 * @param {string} slotKey
 * @param {string} todoId
 * @returns {number}
 */
function plannerTimelineBarChunkIndex_(slots, slotKey, todoId) {
  const order = plannerTimelineOrderedSlotKeys_();
  const tid = String(todoId != null ? todoId : '').trim();
  const ix = order.indexOf(String(slotKey));
  if (ix < 0) {
    return 0;
  }
  let runStart = ix;
  while (runStart > 0) {
    const prevT = String(slots[order[runStart - 1]] != null ? slots[order[runStart - 1]] : '').trim();
    if (prevT !== tid) {
      break;
    }
    runStart--;
  }
  return ix - runStart;
}

/**
 * 할 일 제목(공백 제거)을 막대 칸마다 N글자씩(`PLAN_TIMELINE_BAR_LABEL_CHUNK_LEN`). 한 바퀴 지나면 `----`.
 * @param {string} title
 * @param {number} chunkIndex run 내 0부터
 * @returns {string}
 */
function plannerTodoBarLabelChunk_(title, chunkIndex) {
  const w = PLAN_TIMELINE_BAR_LABEL_CHUNK_LEN;
  const padDash = '-'.repeat(w);
  const t = String(title != null ? title : '')
    .replace(/\s+/g, '')
    .trim();
  if (!t.length) {
    return padDash;
  }
  const n = Math.max(0, chunkIndex);
  const chunksInLap = Math.ceil(t.length / w);
  if (n >= chunksInLap) {
    return padDash;
  }
  const start = n * w;
  let chunk = t.slice(start, start + w);
  while (chunk.length < w) {
    chunk += ' ';
  }
  return chunk;
}

/**
 * @param {Record<string, string>} slots
 * @param {string} slotKey
 * @param {string} todoId
 * @param {Record<string, { task_id: string, title: string, category: string }>} todoMap
 * @returns {string}
 */
function plannerSlotBarChunkLabel_(slots, slotKey, todoId, todoMap) {
  const tid = String(todoId != null ? todoId : '').trim();
  if (!tid.length) {
    return '';
  }
  const row = todoMap[tid];
  let title = row && row.title ? String(row.title).trim() : '';
  if (!title.length) {
    title = tid;
  }
  const chunkIx = plannerTimelineBarChunkIndex_(slots, slotKey, tid);
  return plannerTodoBarLabelChunk_(title, chunkIx);
}

/**
 * 그날 할 일 → 과목(카테고리)별 색 클래스 — 타임라인·미러·필 공통.
 * @param {object} st
 * @param {string} dateYmd
 * @param {Record<string, string>} [slotsOpt]
 * @returns {Record<string, string>}
 */
function plannerDayTodoHueMapForDay_(st, dateYmd, slotsOpt) {
  const ymd = String(dateYmd || '').trim();
  const todoMap = plannerDayTodoIdMapForDay_(ymd, st);
  /** @type {Record<string, string>} */
  const map = {};
  Object.keys(todoMap).forEach(function (tid) {
    const row = todoMap[tid];
    map[tid] = plannerTodoPaintColorClass_(st, ymd, tid, row);
  });
  const slots = slotsOpt != null ? slotsOpt : plannerEnsureTimelineTodoSlots_(st, ymd);
  Object.keys(slots).forEach(function (k) {
    const tid = String(slots[k] != null ? slots[k] : '').trim();
    if (!tid.length || map[tid]) return;
    map[tid] = plannerTodoPaintColorClass_(st, ymd, tid, todoMap[tid] || null);
  });
  return map;
}

/**
 * @param {object} st
 * @param {string} dateYmd
 * @param {HTMLElement} timegrid
 */
function plannerRefreshTimegridSlotcellsUi_(st, dateYmd, timegrid) {
  if (!timegrid || !st) {
    return;
  }
  const ymd = String(dateYmd || '').trim();
  if (!ymd.length) {
    return;
  }
  const slots = plannerEnsureTimelineTodoSlots_(st, ymd);
  const hueMap = plannerDayTodoHueMapForDay_(st, ymd, slots);
  const todoMap = plannerDayTodoIdMapForDay_(ymd, st);
  timegrid.querySelectorAll('.sp-plan-slotcell').forEach(function (el) {
    if (!(el instanceof HTMLButtonElement)) {
      return;
    }
    const sk = el.getAttribute('data-slot') || '';
    if (!sk.length) {
      return;
    }
    if (plannerFixedSlotBlocked_(st, ymd, sk)) {
      el.className = 'sp-plan-slotcell sp-plan-slotcell--fixedBlock is-fixedBlock';
      el.setAttribute('aria-pressed', 'false');
      el.setAttribute('disabled', 'disabled');
      el.setAttribute('aria-disabled', 'true');
      el.removeAttribute('data-todo-id');
      const p0 = plannerTimelineSlotKeyParse_(sk);
      if (p0) {
        const m0 = p0.sub * PLAN_TIMELINE_CELL_MIN;
        const m1 = m0 + PLAN_TIMELINE_CELL_MIN;
        const lab =
          plannerPad2_(p0.hour) +
          ':' +
          plannerPad2_(m0) +
          '–' +
          plannerPad2_(p0.hour) +
          ':' +
          plannerPad2_(m1);
        el.setAttribute('aria-label', esc(lab + ' · 고정 일정(비활성)'));
      }
      return;
    }
    el.removeAttribute('disabled');
    el.removeAttribute('aria-disabled');
    const tidRaw = String(slots[sk] != null ? slots[sk] : '').trim();
    const tid = tidRaw && todoMap[tidRaw] ? tidRaw : '';
    const rowPaint = tid ? todoMap[tid] : null;
    const hue = tid ? hueMap[tid] || plannerTodoPaintColorClass_(st, ymd, tid, rowPaint) : '';
    const bar = tid ? plannerTimelineBarRole_(slots, sk, tid) : '';
    let cls = 'sp-plan-slotcell';
    if (tid) {
      cls += ' is-on sp-plan-slotcell--todo sp-plan-slotcell--todo--' + hue;
      if (bar) {
        cls += ' sp-plan-slotcell--bar-' + bar;
      }
      el.setAttribute('data-todo-id', tid);
      const chunk = plannerSlotBarChunkLabel_(slots, sk, tid, todoMap);
      if (chunk) {
        el.setAttribute('data-bar-chunk', chunk);
      } else {
        el.removeAttribute('data-bar-chunk');
      }
    } else {
      el.removeAttribute('data-todo-id');
      el.removeAttribute('data-bar-chunk');
    }
    el.className = cls;
    el.setAttribute('aria-pressed', tid ? 'true' : 'false');
    const p = plannerTimelineSlotKeyParse_(sk);
    if (p) {
      const m0 = p.sub * PLAN_TIMELINE_CELL_MIN;
      const m1 = m0 + PLAN_TIMELINE_CELL_MIN;
      const lab =
        plannerPad2_(p.hour) +
        ':' +
        plannerPad2_(m0) +
        '–' +
        plannerPad2_(p.hour) +
        ':' +
        plannerPad2_(m1);
      let title = tid;
      const row = tid && todoMap[tid] ? todoMap[tid] : null;
      if (row && row.title) {
        title = String(row.title).trim();
      }
      const chunkLbl = tid ? plannerSlotBarChunkLabel_(slots, sk, tid, todoMap) : '';
      el.setAttribute(
        'aria-label',
        esc(lab + (tid ? ' · ' + title + (chunkLbl ? ' · ' + chunkLbl : '') : '') + ' 칸')
      );
    }
  });
}

/**
 * 과목·루틴 기준 색 클래스 (`sp-plan-todoCat--*`) — 타임라인 외 레거시.
 * @param {string} taskId
 * @param {string} [category]
 * @returns {string}
 */
function plannerCategoryHueClassForTodo_(taskId, category) {
  const id = String(taskId != null ? taskId : '').trim();
  if (id === PLAN_FIXED_SLEEP_TODO_ID) return 'sleep';
  if (id === PLAN_FIXED_MEAL_TODO_ID) return 'meal';
  const c = String(category != null ? category : '').trim();
  if (c === PLAN_CATEGORY_FIXED) return 'fixed';
  if (c === PLAN_CATEGORY_ROUTINE) return 'routine';
  if (c === 'memo') return 'memo';
  if (plannerIsStudyCategoryCode_(c)) return c;
  return 'misc';
}

/**
 * 타임라인 칸 안 1글자 라벨.
 * @param {string} taskId
 * @param {string} [category]
 * @returns {string}
 */
function plannerCategoryShortLabelForTodo_(taskId, category) {
  const id = String(taskId != null ? taskId : '').trim();
  if (id === PLAN_FIXED_SLEEP_TODO_ID) return '취';
  if (id === PLAN_FIXED_MEAL_TODO_ID) return '식';
  const c = String(category != null ? category : '').trim();
  if (c === PLAN_CATEGORY_FIXED) return '고';
  if (c === PLAN_CATEGORY_ROUTINE) return '루';
  if (c === 'memo') return '메';
  const short = plannerStudyCategoryShortFromCode_(c);
  return short || '기';
}

/**
 * brush 없음 → 칸 변경 없음(클릭만으로 시간 취소 금지). brush 있음 → 빈 칸에 칠함.
 * 이미 다른 할 일이 있으면 덮어쓰지 않음. 같은 할 일 칸을 다시 적용하면 토글로 지움.
 * @param {Record<string, string>} slots
 * @param {string} slotKey
 * @param {string} brush
 * @param {object} [st]
 * @param {string} [ymd]
 * @returns {string} 반영 후 해당 칸의 todo id 또는 ''
 */
function plannerTimelineSlotApplyBrush_(slots, slotKey, brush, st, ymd) {
  const sk = String(slotKey);
  if (st && ymd && plannerFixedSlotBlocked_(st, String(ymd), sk)) {
    const cur0 = slots[sk] != null ? String(slots[sk]).trim() : '';
    return cur0;
  }
  const b = brush ? String(brush).trim() : '';
  if (b && st && ymd) {
    const todoMap = plannerDayTodoIdMapForDay_(String(ymd), st);
    const row = todoMap[b];
    if (row && String(row.category || '').trim() === PLAN_CATEGORY_FIXED) {
      const curFix = slots[sk] != null ? String(slots[sk]).trim() : '';
      return curFix;
    }
  }
  const cur = slots[sk] != null ? String(slots[sk]).trim() : '';
  if (!b) {
    return cur;
  }
  if (cur === b) {
    slots[sk] = '';
    return '';
  }
  if (cur && cur !== b) {
    return cur;
  }
  slots[sk] = b;
  return b;
}

/**
 * 타임라인 `시_칸` 키 → 0..143 순번(6시 첫 칸=0).
 * @param {string} slotKey
 * @returns {number}
 */
function plannerSlotKeyToOrderIndex_(slotKey) {
  const p = plannerTimelineSlotKeyParse_(String(slotKey));
  if (!p) return -1;
  const hi = PLAN_TIMELINE_HOURS_ORDERED.indexOf(p.hour);
  if (hi < 0) return -1;
  return hi * PLAN_TIMELINE_CELLS_PER_HOUR + p.sub;
}

/**
 * @param {number} ix
 * @returns {string}
 */
function plannerOrderIndexToSlotKey_(ix) {
  const n = Number(ix);
  const max = PLAN_TIMELINE_HOURS_ORDERED.length * PLAN_TIMELINE_CELLS_PER_HOUR;
  if (!isFinite(n) || n < 0 || n >= max) return '';
  const hi = Math.floor(n / PLAN_TIMELINE_CELLS_PER_HOUR);
  const sub = n % PLAN_TIMELINE_CELLS_PER_HOUR;
  const h = PLAN_TIMELINE_HOURS_ORDERED[hi];
  return plannerTimelineSlotKey_(h, sub);
}

/**
 * 타임라인 순번이 **정시 또는 :30** 시작(10분 격자상 `sub` 0 또는 3)인지.
 * @param {number} ix
 * @returns {boolean}
 */
function plannerFixedTimelineOrderIndexIsHalfHour_(ix) {
  const n = Number(ix);
  if (!isFinite(n) || n < 0) return false;
  const max = PLAN_TIMELINE_HOURS_ORDERED.length * PLAN_TIMELINE_CELLS_PER_HOUR;
  if (n >= max) return false;
  const sub = n % PLAN_TIMELINE_CELLS_PER_HOUR;
  return sub === 0 || sub === 3;
}

/**
 * @param {boolean} [includeEndBoundary] true면 value=max(배타적 끝) 한 줄 추가 — 끝 시각용
 * @returns {string}
 */
function plannerFixedTimelineSelectOptionsHtml_(includeEndBoundary) {
  let s = '';
  let ix;
  const max = PLAN_TIMELINE_HOURS_ORDERED.length * PLAN_TIMELINE_CELLS_PER_HOUR;
  for (ix = 0; ix < max; ix++) {
    if (!plannerFixedTimelineOrderIndexIsHalfHour_(ix)) continue;
    const k = plannerOrderIndexToSlotKey_(ix);
    const p = plannerTimelineSlotKeyParse_(k);
    if (!p) continue;
    const m0 = p.sub * PLAN_TIMELINE_CELL_MIN;
    const lab = plannerPad2_(p.hour) + ':' + plannerPad2_(m0);
    s += '<option value="' + String(ix) + '">' + esc(lab) + '</option>';
  }
  if (includeEndBoundary) {
    s += '<option value="' + String(max) + '">' + esc('타임라인 끝(24h)') + '</option>';
  }
  return s;
}

/**
 * 타임라인 시·10분 칸 → 고정 일정 select `value`(order index).
 * @param {number} hour 0~23
 * @param {number} [sub] 0~5
 * @returns {number}
 */
function plannerFixedTimelineOrderIndexForHour_(hour, sub) {
  const hi = PLAN_TIMELINE_HOURS_ORDERED.indexOf(Number(hour));
  if (hi < 0) return -1;
  const s = Number(sub);
  return hi * PLAN_TIMELINE_CELLS_PER_HOUR + (isFinite(s) ? s : 0);
}

/** 고정 일정 시간 기본값 — 새벽 03:00~04:00 (학생 시간표에 거의 안 보이는 구간). */
function plannerDefaultFixedTimelineOrderRange_() {
  const startIx = plannerFixedTimelineOrderIndexForHour_(3, 0);
  const endIx = plannerFixedTimelineOrderIndexForHour_(4, 0);
  return {
    startIx: startIx >= 0 ? startIx : 0,
    endIx: endIx >= 0 ? endIx : 6
  };
}

/**
 * @param {HTMLSelectElement|null} startEl
 * @param {HTMLSelectElement|null} endEl
 */
function plannerSetFixedTimelineSelectDefaults_(startEl, endEl) {
  const r = plannerDefaultFixedTimelineOrderRange_();
  if (startEl instanceof HTMLSelectElement) {
    startEl.value = String(r.startIx);
  }
  if (endEl instanceof HTMLSelectElement) {
    endEl.value = String(r.endIx);
  }
}

/**
 * 보는 달 안 시작·종료일 → 일(day) 구간. 빈 문자열이면 1일·말일.
 * @param {Date} viewMonth
 * @param {string} startDateOpt `YYYY-MM-DD`
 * @param {string} endDateOpt `YYYY-MM-DD`
 * @returns {{ startDay: number, endDay: number, error?: string }}
 */
function plannerParseMonthDayRange_(viewMonth, startDateOpt, endDateOpt) {
  const y = viewMonth.getFullYear();
  const m0 = viewMonth.getMonth();
  const last = new Date(y, m0 + 1, 0).getDate();
  let startDay = 1;
  let endDay = last;

  /**
   * @param {string} raw
   * @returns {{ day: number, error?: string }}
   */
  function dayInViewMonth_(raw) {
    const s = String(raw != null ? raw : '').trim();
    if (!s.length) return { day: -1 };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { day: -1, error: '날짜 형식이 올바르지 않습니다.' };
    const parts = s.split('-').map(function (p) {
      return Number(p);
    });
    const sd = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(sd.getTime())) return { day: -1, error: '날짜가 올바르지 않습니다.' };
    if (sd.getFullYear() !== y || sd.getMonth() !== m0) {
      return { day: -1, error: '시작일·종료일은 현재 보고 있는 달 안에서만 선택할 수 있습니다.' };
    }
    return { day: sd.getDate() };
  }

  const startStr = String(startDateOpt != null ? startDateOpt : '').trim();
  const endStr = String(endDateOpt != null ? endDateOpt : '').trim();
  if (startStr.length) {
    const p0 = dayInViewMonth_(startStr);
    if (p0.error) return { startDay: 1, endDay: last, error: p0.error };
    if (p0.day > 0) startDay = p0.day;
  }
  if (endStr.length) {
    const p1 = dayInViewMonth_(endStr);
    if (p1.error) return { startDay: 1, endDay: last, error: p1.error };
    if (p1.day > 0) endDay = p1.day;
  }
  if (startDay > endDay) {
    return { startDay: startDay, endDay: endDay, error: '시작일은 종료일보다 늦을 수 없습니다.' };
  }
  return { startDay: startDay, endDay: endDay };
}

/**
 * @param {object} st
 * @param {string} ymd
 * @param {string} slotKey
 * @returns {boolean}
 */
function plannerFixedSlotBlocked_(st, ymd, slotKey) {
  const m = st.dayFixedBlockSlotsByDate && st.dayFixedBlockSlotsByDate[ymd];
  return Boolean(m && m[String(slotKey)]);
}

/**
 * `category:fixed` 행의 `timeline_slots` → `dayFixedBlockSlotsByDate` (bootstrap·삭제 후 재구축).
 * @param {object} st
 * @param {Date} viewMonth
 */
function plannerRebuildFixedBlockSlotsForMonth_(st, viewMonth) {
  if (!st || typeof st !== 'object') return;
  if (!st.dayFixedBlockSlotsByDate) st.dayFixedBlockSlotsByDate = {};
  const view = viewMonth instanceof Date && !isNaN(viewMonth.getTime()) ? viewMonth : new Date();
  const pfx = plannerMonthYmdPrefix_(view);
  Object.keys(st.dayFixedBlockSlotsByDate).forEach(function (k) {
    if (k.indexOf(pfx) === 0) {
      try {
        delete st.dayFixedBlockSlotsByDate[k];
      } catch (_e) {
        st.dayFixedBlockSlotsByDate[k] = {};
      }
    }
  });
  plannerEnsureMonthTodos_(st);
  st.monthTodos.forEach(function (row) {
    if (!row || String(row.category || '').trim() !== PLAN_CATEGORY_FIXED) return;
    const ymd = String(row.date != null ? row.date : '').trim();
    if (!ymd || ymd.indexOf(pfx) !== 0) return;
    let keys = [];
    try {
      const j = JSON.parse(String(row.timeline_slots != null ? row.timeline_slots : '[]'));
      if (Array.isArray(j)) keys = j;
    } catch (_e) {}
    if (!st.dayFixedBlockSlotsByDate[ymd]) st.dayFixedBlockSlotsByDate[ymd] = {};
    keys.forEach(function (slot) {
      const sk = plannerNormalizeTimelineSlotKeyFromApi_(slot);
      if (sk) st.dayFixedBlockSlotsByDate[ymd][sk] = true;
    });
  });
}

/**
 * @param {object} st
 * @param {string} ymd
 * @param {string} taskId
 */
function plannerScrubTimelineMapForTask_(st, ymd, taskId) {
  const map = st.dayTimelineTodoByDate && st.dayTimelineTodoByDate[ymd];
  if (!map || typeof map !== 'object') return;
  const tid = String(taskId || '').trim();
  if (!tid) return;
  Object.keys(map).forEach(function (k) {
    if (String(map[k] != null ? map[k] : '').trim() === tid) {
      try {
        delete map[k];
      } catch (_e) {
        map[k] = '';
      }
    }
  });
}

/**
 * `monthTodos`에서 한 건 제거 + 해당 날 타임라인·고정 막힘 정리.
 * @param {object} st
 * @param {string} ymd
 * @param {string} taskId
 * @returns {boolean} 제거했으면 true
 */
function plannerRemoveMonthTodo_(st, ymd, taskId) {
  plannerEnsureMonthTodos_(st);
  const day = String(ymd || '').trim();
  const tid = String(taskId || '').trim();
  if (!day || !tid) return false;
  /** @type {object|null} */
  let removed = null;
  let ri;
  for (ri = 0; ri < st.monthTodos.length; ri++) {
    const r = st.monthTodos[ri];
    if (r && String(r.date || '').trim() === day && String(r.task_id || '').trim() === tid) {
      removed = r;
      break;
    }
  }
  if (!removed) return false;
  if (String(removed.category || '').trim() === 'memo') return false;
  const before = st.monthTodos.length;
  st.monthTodos = st.monthTodos.filter(function (r) {
    return r !== removed;
  });
  if (st.monthTodos.length === before) return false;
  plannerScrubTimelineMapForTask_(st, day, tid);
  const cat = removed ? String(removed.category || '').trim() : '';
  if (cat === PLAN_CATEGORY_FIXED && st.viewMonth) {
    plannerRebuildFixedBlockSlotsForMonth_(st, st.viewMonth);
  }
  plannerRebuildQuickPostPayload_(st);
  return true;
}

/**
 * 서버(기존 저장) 행 삭제 예약 — `_deleted=true`로 숨김. (저장 전 새로고침하면 복원됨)
 * @param {object} st
 * @param {string} ymd
 * @param {string} taskId
 * @returns {boolean}
 */
function plannerMarkMonthTodoDeleted_(st, ymd, taskId) {
  plannerEnsureMonthTodos_(st);
  const day = String(ymd || '').trim();
  const tid = String(taskId || '').trim();
  if (!day || !tid) return false;
  /** @type {object|null} */
  let removed = null;
  let ri;
  for (ri = 0; ri < st.monthTodos.length; ri++) {
    const r = st.monthTodos[ri];
    if (r && String(r.date || '').trim() === day && String(r.task_id || '').trim() === tid) {
      removed = r;
      break;
    }
  }
  if (!removed) return false;
  if (String(removed.category || '').trim() === 'memo') return false;
  removed._deleted = true;
  plannerScrubTimelineMapForTask_(st, day, tid);
  const cat = String(removed.category || '').trim();
  if (cat === PLAN_CATEGORY_FIXED && st.viewMonth) {
    plannerRebuildFixedBlockSlotsForMonth_(st, st.viewMonth);
  }
  plannerRebuildQuickPostPayload_(st);
  return true;
}

/**
 * @param {object} st
 * @param {Date} viewMonth
 * @param {number[]} weekdays
 * @param {string} title
 * @param {number} startIx
 * @param {number} endIx
 * @param {string} [startDateOpt] `YYYY-MM-DD` · 빈 값이면 그 달 1일
 * @param {string} [endDateOpt] `YYYY-MM-DD` · 빈 값이면 그 달 말일
 * @returns {string} 빈 문자열=성공, 아니면 에러 문구
 */
function plannerApplyFixedScheduleForMonth_(st, viewMonth, weekdays, title, startIx, endIx, startDateOpt, endDateOpt) {
  const name = String(title != null ? title : '').trim();
  if (!name.length) return '일정 이름을 입력해 주세요.';
  if (!weekdays.length) return '요일을 한 개 이상 선택해 주세요.';
  const s0 = Number(startIx);
  const s1 = Number(endIx);
  if (!isFinite(s0) || !isFinite(s1)) return '시간을 선택해 주세요.';
  if (s1 <= s0) return '끝 시간은 시작 시간보다 뒤여야 합니다.';
  const maxIx = PLAN_TIMELINE_HOURS_ORDERED.length * PLAN_TIMELINE_CELLS_PER_HOUR;
  if (!plannerFixedTimelineOrderIndexIsHalfHour_(s0)) return '시작 시각은 30분 단위만 선택할 수 있습니다.';
  if (s1 !== maxIx && !plannerFixedTimelineOrderIndexIsHalfHour_(s1)) {
    return '끝 시각은 30분 단위 또는 「타임라인 끝」만 선택할 수 있습니다.';
  }
  if (s0 < 0 || s0 >= maxIx) return '시간 범위가 올바르지 않습니다.';
  if (s1 <= 0 || s1 > maxIx) return '시간 범위가 올바르지 않습니다.';
  const range = plannerParseMonthDayRange_(viewMonth, startDateOpt, endDateOpt);
  if (range.error) return range.error;
  const startDay = range.startDay;
  const endDay = range.endDay;
  const y = viewMonth.getFullYear();
  const m0 = viewMonth.getMonth();
  let hasDay = false;
  let dCheck;
  for (dCheck = startDay; dCheck <= endDay; dCheck++) {
    const ddChk = new Date(y, m0, dCheck);
    if (weekdays.indexOf(ddChk.getDay()) >= 0) {
      hasDay = true;
      break;
    }
  }
  if (!hasDay) return '선택한 기간·요일에 해당하는 날짜가 없습니다.';
  const ruleId = 'fxr_' + String(Date.now()) + '_' + String(Math.floor(Math.random() * 1e6));
  plannerEnsureMonthTodos_(st);
  if (!st.dayFixedBlockSlotsByDate) st.dayFixedBlockSlotsByDate = {};
  /** @type {string[]} */
  const slotKeysForRows = [];
  for (let ix = s0; ix < s1; ix++) {
    const ks = plannerOrderIndexToSlotKey_(ix);
    if (ks) slotKeysForRows.push(ks);
  }
  const timeline_slots = JSON.stringify(slotKeysForRows);
  let d;
  let skdx;
  for (d = startDay; d <= endDay; d++) {
    const dd = new Date(y, m0, d);
    if (weekdays.indexOf(dd.getDay()) < 0) continue;
    const ymd = plannerYmdFromParts_(y, m0, d);
    const task_id = '__sp_fix_' + ruleId + '_' + ymd;
    const todayFx = plannerTodayYmdSeoul_();
    plannerPushMonthTodo_(
      st,
      plannerTodoRowLocal_({
        task_id: task_id,
        title: name,
        date: ymd,
        category: PLAN_CATEGORY_FIXED,
        lecture_id: '',
        timeline_slots: timeline_slots,
        sort_key: -600,
        mark: 'none',
        trace_dates: '[]',
        created_date: todayFx,
        updated_date: todayFx
      }),
      true
    );
    if (!st.dayFixedBlockSlotsByDate[ymd]) st.dayFixedBlockSlotsByDate[ymd] = {};
    const slots = plannerEnsureTimelineTodoSlots_(st, ymd);
    for (skdx = s0; skdx < s1; skdx++) {
      const k = plannerOrderIndexToSlotKey_(skdx);
      if (!k) continue;
      st.dayFixedBlockSlotsByDate[ymd][k] = true;
      try {
        delete slots[k];
      } catch (_e) {
        slots[k] = '';
      }
    }
    plannerStripStudyTimelineSlotsOnDay_(st, ymd, slotKeysForRows);
    if (st.dayTimelineTodoByDate && st.dayTimelineTodoByDate[ymd]) {
      try {
        delete st.dayTimelineTodoByDate[ymd];
      } catch (_e) {
        st.dayTimelineTodoByDate[ymd] = {};
      }
    }
  }
  plannerRebuildQuickPostPayload_(st);
  return '';
}

/**
 * 달력 일자 칸 하단 고정 일정(빨간 텍스트만).
 * @param {object} st
 * @param {string} key ymd
 * @returns {string}
 */
function plannerFixedScheduleFooterHtml_(st, key) {
  const rows = plannerMonthTodosForDay_(st, key);
  const lines = [];
  rows.forEach(function (r) {
    if (!r || String(r.date || '').trim() !== key) return;
    if (String(r.category || '').trim() !== PLAN_CATEGORY_FIXED) return;
    const t = String(r.title || '').trim();
    const tid = String(r.task_id != null ? r.task_id : '').trim();
    if (t && tid) lines.push({ title: t, task_id: tid });
  });
  if (!lines.length) return '';
  return (
    '<div class="sp-plan-day__fixedFoot" aria-label="고정 일정">' +
    lines
      .map(function (item) {
        return (
          '<span class="sp-plan-day__fixedTxt" data-sp-task-id="' +
          esc(item.task_id) +
          '" data-sp-ymd-parent="1" title="' +
          esc(item.title) +
          '">' +
          esc(item.title) +
          '</span>'
        );
      })
      .join('') +
    '</div>'
  );
}

/**
 * @param {number} hour
 * @param {number} sub 0..PLAN_TIMELINE_CELLS_PER_HOUR-1
 * @returns {string}
 */
function plannerTimelineSlotKey_(hour, sub) {
  return String(hour) + '_' + String(sub);
}

/**
 * @param {string} key
 * @returns {{ hour: number, sub: number }|null}
 */
function plannerTimelineSlotKeyParse_(key) {
  const s = String(key != null ? key : '');
  const m = s.match(/^(\d+)_([0-5])$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const sub = Number(m[2]);
  if (!isFinite(hour) || !isFinite(sub)) return null;
  return { hour: hour, sub: sub };
}

/**
 * @param {Record<string, string>} slots
 * @returns {boolean}
 */
function plannerTimelineNeedsLegacyNumericKeys_(slots) {
  return Object.keys(slots).some(function (k) {
    return /^\d+$/.test(k);
  });
}

/**
 * 예전 30분 단위 정수 키(0,1,…) → `시_칸` 10분 키
 * @param {Record<string, string>} slots
 * @returns {Record<string, string>}
 */
function plannerMigrateNumeric30SlotsToTenMin_(slots) {
  /** @type {Record<string, string>} */
  const out = {};
  Object.keys(slots).forEach(function (k) {
    const v = slots[k];
    if (v == null || String(v).trim() === '') return;
    if (!/^\d+_[0-5]$/.test(k)) return;
    out[k] = String(v);
  });
  Object.keys(slots).forEach(function (k) {
    const v = slots[k];
    if (v == null || String(v).trim() === '') return;
    if (!/^\d+$/.test(k)) return;
    const sv = String(v);
    const i = Number(k);
    if (!isFinite(i) || i < 0) return;
    const startMin = PLAN_TIMELINE_LEGACY_START_H * 60 + i * PLAN_TIMELINE_LEGACY_STEP_MIN;
    let m;
    for (m = 0; m < PLAN_TIMELINE_LEGACY_STEP_MIN; m += PLAN_TIMELINE_CELL_MIN) {
      const t = startMin + m;
      const h = Math.floor(t / 60);
      const sub = Math.floor((t % 60) / PLAN_TIMELINE_CELL_MIN);
      if (h < 0 || h > 23 || sub < 0 || sub >= PLAN_TIMELINE_CELLS_PER_HOUR) continue;
      out[plannerTimelineSlotKey_(h, sub)] = sv;
    }
  });
  return out;
}

/** @param {string} dateYmd
 * @param {object} st
 * @returns {Record<string, { task_id: string, title: string, category: string }>}
 */
function plannerDayTodoIdMapForDay_(dateYmd, st) {
  const rows = plannerOrderedDayTodos_(st, dateYmd);
  /** @type {Record<string, { task_id: string, title: string, category: string }>} */
  const o = {};
  rows.forEach(function (r) {
    if (!r || !r.task_id || plannerIsTraceGhostDisplay_(r)) return;
    o[String(r.task_id)] = {
      task_id: String(r.task_id),
      title: String(r.title != null ? r.title : ''),
      category: String(r.category != null ? r.category : '')
    };
  });
  return o;
}

/**
 * @param {Record<string, string>} slots
 * @param {string} dateYmd
 * @param {object} st
 * @param {number} hour
 * @returns {string}
 */
function plannerHourTodoColHtmlFromSlots_(slots, dateYmd, st, hour) {
  const seen = [];
  const order = [];
  let sub;
  for (sub = 0; sub < PLAN_TIMELINE_CELLS_PER_HOUR; sub++) {
    const tid = String(slots[plannerTimelineSlotKey_(hour, sub)] || '').trim();
    if (!tid) continue;
    if (seen.indexOf(tid) < 0) {
      seen.push(tid);
      order.push(tid);
    }
  }
  if (!order.length) {
    return '<span class="sp-plan-hourTodoEmpty" aria-hidden="true"> </span>';
  }
  const map = plannerDayTodoIdMapForDay_(dateYmd, st);
  let h = '';
  order.forEach(function (tid) {
    const row = map[tid];
    if (!row) return;
    const txt = row.title ? String(row.title).trim() : tid.length > 10 ? tid.slice(0, 10) + '…' : tid;
    const cat = plannerTodoPaintColorClass_(st, dateYmd, tid, row);
    const short = txt.length > 10 ? txt.slice(0, 10) + '…' : txt;
    h +=
      '<span class="sp-plan-hourTodoPill sp-plan-hourTodoPill--cat-' +
      esc(cat) +
      '" title="' +
      esc(row && row.title ? String(row.title).trim() : tid) +
      '">' +
      esc(short) +
      '</span>';
  });
  return h;
}

/**
 * @param {object} st
 * @param {string} ymd
 * @param {string} taskId
 * @returns {'none'|'circle'|'triangle'|'x'}
 */
function plannerTodoCompletionGet_(st, ymd, taskId) {
  const row = plannerFindMonthTodoByTaskId_(st, taskId);
  if (!row || String(row.date || '').trim() !== String(ymd || '').trim()) return 'none';
  const v = String(row.mark != null ? row.mark : 'none').trim();
  if (v === 'circle' || v === 'triangle' || v === 'x') return v;
  return 'none';
}

/**
 * @param {object} st
 * @param {string} ymd
 * @param {string} taskId
 * @param {'none'|'circle'|'triangle'|'x'} mark
 */
function plannerTodoCompletionSet_(st, ymd, taskId, mark) {
  const row = plannerFindMonthTodoByTaskId_(st, taskId);
  if (!row || String(row.date || '').trim() !== String(ymd || '').trim()) return;
  row.mark = mark === 'none' ? 'none' : mark;
  if (!row._fromServer) row.updated_date = plannerTodayYmdSeoul_();
  plannerRebuildQuickPostPayload_(st);
}

/**
 * 타임라인 10분 칸 기준 과목별 합계(분)
 * @param {object} st
 * @param {string} ymd
 * @returns {Record<string, number>}
 */
function plannerSubjectMinutesFromTimeline_(st, ymd) {
  const slots = st.dayTimelineTodoByDate && st.dayTimelineTodoByDate[ymd];
  /** @type {Record<string, number>} */
  const acc = plannerStudyCategoryMinutesAccumulator_();
  if (!slots || typeof slots !== 'object') return acc;
  const map = plannerDayTodoIdMapForDay_(ymd, st);
  Object.keys(slots).forEach(function (k) {
    if (!plannerTimelineSlotKeyParse_(k)) return;
    if (plannerFixedSlotBlocked_(st, ymd, k)) return;
    const tid = String(slots[k] != null ? slots[k] : '').trim();
    const row = map[tid];
    if (!tid || plannerIsExcludedFromStudyTotals_(tid, row && row.category)) return;
    const cat = row && row.category ? String(row.category).trim() : '';
    const suf = cat && acc[cat] != null ? cat : plannerTodoCategoryToken_(tid);
    const key = acc[suf] != null ? suf : 'misc';
    acc[key] = (acc[key] || 0) + PLAN_TIMELINE_CELL_MIN;
  });
  return acc;
}

/**
 * @param {number} minutes
 * @returns {string}
 */
function plannerFormatStudyDurationKo_(minutes) {
  const n = Math.max(0, Math.floor(Number(minutes) || 0));
  if (n <= 0) return '0분';
  if (n < 60) return String(n) + '분';
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (m === 0) return String(h) + '시간';
  return String(h) + '시간 ' + String(m) + '분';
}

/**
 * @param {object} st
 * @param {string} ymd
 * @returns {string}
 */
function plannerDayModalSubjectStatsHtml_(st, ymd) {
  const acc = plannerSubjectMinutesFromTimeline_(st, ymd);
  const labels = {};
  PLANNER_STUDY_SUBJECT_DEFS.forEach(function (d) {
    labels[d.code] = d.label;
  });
  const order = PLANNER_STUDY_CATEGORY_ORDER.slice();
  let sum = 0;
  const items = [];
  order.forEach(function (key) {
    const m = acc[key] || 0;
    if (m <= 0) return;
    sum += m;
    items.push(
      '<li class="sp-plan-studyFooter__item sp-plan-studyFooter__item--' +
        esc(key) +
        '"><span class="sp-plan-studyFooter__lab">' +
        esc(labels[key] || key) +
        '</span><span class="sp-plan-studyFooter__val">' +
        esc(plannerFormatStudyDurationKo_(m)) +
        '</span></li>'
    );
  });
  if (!items.length) {
    return (
      '<div class="sp-plan-studyFooter__inner">' +
      '<div class="sp-plan-studyFooter__title">타임라인 과목별 공부 시간</div>' +
      '<p class="sp-plan-studyFooter__empty">아직 표시한 10분 칸이 없습니다. 왼쪽 할 일 목록에서 「체크」로 할 일을 고른 뒤 시간표에 칠하면 여기에 합계가 나타납니다.</p>' +
      '</div>'
    );
  }
  return (
    '<div class="sp-plan-studyFooter__inner">' +
    '<div class="sp-plan-studyFooter__title">타임라인 과목별 공부 시간</div>' +
    '<ul class="sp-plan-studyFooter__list">' +
    items.join('') +
    '</ul>' +
    '<p class="sp-plan-studyFooter__sum">합계 <strong>' +
    esc(plannerFormatStudyDurationKo_(sum)) +
    '</strong></p>' +
    '</div>'
  );
}

/**
 * @param {HTMLElement} root
 */
function plannerRefreshDayModalStudyFooter_(root) {
  const el = root.querySelector('#sp-plan-day-study-footer');
  if (!el) return;
  const st = root.__spPlanState;
  if (!st || !st.selectedDate) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = plannerDayModalSubjectStatsHtml_(st, st.selectedDate);
}

/**
 * 일일 모달 왼쪽 열(할 일 요약)만 다시 그립니다.
 * @param {HTMLElement} root
 */
function plannerRefreshDayModalTodoSide_(root) {
  const m = root.querySelector('#sp-plan-day-modal');
  const side = m && m.querySelector('#sp-plan-day-todo-side');
  const st = root.__spPlanState;
  if (!side || !st || !st.selectedDate) return;
  side.innerHTML = plannerDayTodosFromPayloadHtml_(st.selectedDate, st);
}

/** @param {HTMLElement} timegrid */
function plannerRovingTabindexSlotcells_(timegrid) {
  if (!timegrid) return;
  const cells = timegrid.querySelectorAll('.sp-plan-slotcell');
  let placed = false;
  cells.forEach(function (el) {
    if (!(el instanceof HTMLElement)) return;
    const dis = el instanceof HTMLButtonElement && el.disabled;
    if (!dis && !placed) {
      el.setAttribute('tabindex', '0');
      placed = true;
    } else {
      el.setAttribute('tabindex', '-1');
    }
  });
}

/** @param {HTMLElement} timegrid
 * @param {HTMLButtonElement} btn */
function plannerFocusSlotcell_(timegrid, btn) {
  if (!timegrid || !(btn instanceof HTMLButtonElement)) return;
  timegrid.querySelectorAll('.sp-plan-slotcell').forEach(function (el) {
    if (el instanceof HTMLElement) el.setAttribute('tabindex', '-1');
  });
  btn.setAttribute('tabindex', '0');
  try {
    btn.focus();
  } catch (_e) {
    /* ignore */
  }
}

/**
 * @param {object} st
 * @param {string} d
 * @returns {Record<string, string>} `시_칸`(0~5) → todoId
 */
function plannerEnsureTimelineTodoSlots_(st, d) {
  if (!st.dayTimelineTodoByDate) st.dayTimelineTodoByDate = {};
  if (!st.dayTimelineTodoByDate[d]) {
    const leg = st.dayTimelineSlotsByDate && st.dayTimelineSlotsByDate[d];
    st.dayTimelineTodoByDate[d] = leg
      ? plannerMigrateLegacySlotsToTodo_(leg)
      : plannerBuildTimelineSlotMapForDayFromMonthTodos_(st, d);
    if (leg && st.dayTimelineSlotsByDate) {
      try {
        delete st.dayTimelineSlotsByDate[d];
      } catch (_e) {
        st.dayTimelineSlotsByDate[d] = {};
      }
    }
  }
  let slots = st.dayTimelineTodoByDate[d];
  if (slots && plannerTimelineNeedsLegacyNumericKeys_(slots)) {
    slots = plannerMigrateNumeric30SlotsToTenMin_(slots);
    st.dayTimelineTodoByDate[d] = slots;
  }
  return st.dayTimelineTodoByDate[d];
}

/**
 * @param {object} st
 * @param {string} dateYmd
 * @returns {string}
 */
function plannerDayTimelineHtml_(st, dateYmd) {
  const slots = plannerEnsureTimelineTodoSlots_(st, dateYmd);
  const hueMap = plannerDayTodoHueMapForDay_(st, dateYmd, slots);
  const todoMap = plannerDayTodoIdMapForDay_(dateYmd, st);
  let html = '';
  let idx;
  for (idx = 0; idx < PLAN_TIMELINE_HOURS_ORDERED.length; idx++) {
    const h = PLAN_TIMELINE_HOURS_ORDERED[idx];
    let cells = '';
    for (let sub = 0; sub < PLAN_TIMELINE_CELLS_PER_HOUR; sub++) {
      const k = plannerTimelineSlotKey_(h, sub);
      const blocked = plannerFixedSlotBlocked_(st, dateYmd, k);
      const tid = !blocked && slots[k] ? String(slots[k]).trim() : '';
      const row = tid && todoMap[tid] ? todoMap[tid] : null;
      const hue = tid ? hueMap[tid] || plannerTodoPaintColorClass_(st, dateYmd, tid, row) : '';
      const bar = tid ? plannerTimelineBarRole_(slots, k, tid) : '';
      const m0 = sub * PLAN_TIMELINE_CELL_MIN;
      const m1 = m0 + PLAN_TIMELINE_CELL_MIN;
      const lab = plannerPad2_(h) + ':' + plannerPad2_(m0) + '–' + plannerPad2_(h) + ':' + plannerPad2_(m1);
      let cls =
        'sp-plan-slotcell' +
        (blocked ? ' sp-plan-slotcell--fixedBlock is-fixedBlock' : '') +
        (tid ? ' is-on sp-plan-slotcell--todo sp-plan-slotcell--todo--' + hue : '');
      if (tid && bar) {
        cls += ' sp-plan-slotcell--bar-' + bar;
      }
      const chunkLbl = tid ? plannerSlotBarChunkLabel_(slots, k, tid, todoMap) : '';
      const titleFull = row && row.title ? String(row.title).trim() : tid;
      const al = blocked
        ? lab + ' · 고정 일정(비활성)'
        : lab + (tid ? ' · ' + titleFull + (chunkLbl ? ' · ' + chunkLbl : '') : '') + ' 칸';
      cells +=
        '<button type="button" tabindex="-1" class="' +
        cls +
      '" data-slot="' +
      esc(k) +
        '"' +
        (tid ? ' data-todo-id="' + esc(tid) + '"' : '') +
        (chunkLbl ? ' data-bar-chunk="' + esc(chunkLbl) + '"' : '') +
        (blocked ? ' disabled aria-disabled="true"' : '') +
        ' aria-pressed="' +
      (tid ? 'true' : 'false') +
      '" aria-label="' +
        esc(al) +
        '"></button>';
    }
    const hourLbl = plannerPad2_(h) + '시';
    html +=
      '<div class="sp-plan-hourRow" data-hour="' +
      String(h) +
      '">' +
      '<div class="sp-plan-hourRow__time" aria-hidden="true">' +
      esc(hourLbl) +
      '</div>' +
      '<div class="sp-plan-hourRow__cells" role="group" aria-label="' +
      esc(hourLbl) +
      ' 10분 칸">' +
      cells +
      '</div></div>' +
    '<nav id="sp-plan-todo-ctx-menu" class="sp-plan-todoCtx" hidden role="menu" aria-label="할 일 메뉴">' +
    '<button type="button" class="sp-plan-todoCtx__btn" data-sp-ctx-action="delete" role="menuitem">삭제</button>' +
    '</nav>';
  }
  return html;
}

/**
 * 슬롯 상태 → 버튼 DOM만 반영(브러시 적용 없음).
 * @param {HTMLButtonElement} btn
 * @param {Record<string, string>} slots
 * @param {string} slot
 * @param {object} [st]
 * @param {string} [ymd]
 */
function plannerSyncSlotcellUi_(btn, slots, slot, st, ymd, timegrid) {
  if (st && ymd && timegrid) {
    plannerRefreshTimegridSlotcellsUi_(st, String(ymd), timegrid);
    return;
  }
  const sk = String(slot);
  const tid = slots[sk] != null ? String(slots[sk]).trim() : '';
  const ymdStr = ymd != null ? String(ymd) : '';
  const hue = tid && st && ymdStr ? plannerTodoPaintColorClass_(st, ymdStr, tid, null) : '';
  const bar = tid ? plannerTimelineBarRole_(slots, sk, tid) : '';
  let cls = 'sp-plan-slotcell';
  if (tid) {
    cls += ' is-on sp-plan-slotcell--todo sp-plan-slotcell--todo--' + hue;
    if (bar) {
      cls += ' sp-plan-slotcell--bar-' + bar;
    }
    btn.setAttribute('data-todo-id', tid);
  } else {
    btn.removeAttribute('data-todo-id');
  }
  btn.className = cls;
  btn.setAttribute('aria-pressed', tid ? 'true' : 'false');
}

/**
 * @param {HTMLElement} root
 * @param {HTMLButtonElement} btn
 * @param {HTMLElement|null} timegrid
 */
function plannerPaintSlotcellFromState_(root, btn, timegrid) {
  const st = root.__spPlanState;
  if (!st || !st.selectedDate) return;
  const slot = btn.getAttribute('data-slot');
  if (slot == null || String(slot).indexOf('_') < 0) return;
  if (plannerFixedSlotBlocked_(st, st.selectedDate, String(slot))) return;
  const slots = plannerEnsureTimelineTodoSlots_(st, st.selectedDate);
  const brush = st.modalBrushTodoId ? String(st.modalBrushTodoId) : '';
  plannerTimelineSlotApplyBrush_(slots, slot, brush, st, st.selectedDate);
  if (timegrid) {
    plannerRefreshTimegridSlotcellsUi_(st, st.selectedDate, timegrid);
  } else {
    plannerSyncSlotcellUi_(btn, slots, String(slot), st, st.selectedDate, null);
  }
  plannerRefreshDayModalTodoSide_(root);
}

/**
 * 일일 모달: 왼쪽 할 일 표(체크·달성도) · 오른쪽 10분 칸(POST 없음)
 * @param {HTMLElement} modalEl
 * @param {HTMLElement} root
 */
function wirePlannerDayModalUiOnce_(modalEl, root) {
  if (modalEl.__spPlanDayUiWired) return;
  modalEl.__spPlanDayUiWired = true;
  const todoSide = modalEl.querySelector('#sp-plan-day-todo-side');
  const timegrid = modalEl.querySelector('#sp-plan-day-timegrid');
  if (!todoSide || !timegrid) return;

  let painting = false;
  let lastPaintSlot = '';

  function syncBrushTable_(st) {
    const brush = st.modalBrushTodoId ? String(st.modalBrushTodoId) : '';
    const side = modalEl.querySelector('#sp-plan-day-todo-side');
    if (!side) return;
    side.querySelectorAll('.sp-plan-todoSide__row').forEach(function (tr) {
      if (!(tr instanceof HTMLElement)) return;
      const id = tr.getAttribute('data-todo-id') || '';
      const on = Boolean(brush && id === brush);
      tr.classList.toggle('is-brushRow', on);
      const b = tr.querySelector('[data-action="todo-brush"]');
      if (b instanceof HTMLElement) {
        b.classList.toggle('is-brush', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.textContent = on ? '체크 ✓' : '체크';
      }
    });
  }

  modalEl.addEventListener('click', function (e) {
    const side = modalEl.querySelector('#sp-plan-day-todo-side');
    if (!side || !e.target) return;
    const t = /** @type {HTMLElement} */ (e.target instanceof HTMLElement ? e.target : null);
    if (!t || !side.contains(t)) return;
    const brushBtn = t.closest ? t.closest('[data-action="todo-brush"]') : null;
    if (!brushBtn || !side.contains(brushBtn)) return;
    if (brushBtn instanceof HTMLButtonElement && brushBtn.disabled) return;
    const tr = brushBtn.closest ? brushBtn.closest('.sp-plan-todoSide__row') : null;
    if (!(tr instanceof HTMLElement)) return;
    if (tr.classList.contains('sp-plan-todoSide__row--fixed')) return;
    const st = root.__spPlanState;
    if (!st || !st.selectedDate) return;
    const id = tr.getAttribute('data-todo-id') || '';
    st.modalBrushTodoId = st.modalBrushTodoId === id ? '' : id;
    syncBrushTable_(st);
  });

  modalEl.addEventListener('change', function (e) {
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement)) return;
    if (!sel.classList.contains('sp-plan-todoSide__markSel')) return;
    const side = modalEl.querySelector('#sp-plan-day-todo-side');
    if (!side || !side.contains(sel)) return;
    const st = root.__spPlanState;
    if (!st || !st.selectedDate) return;
    const ymd = st.selectedDate;
    const taskId = sel.getAttribute('data-todo-id') || '';
    if (!taskId) return;
    const v = String(sel.value || 'none');
    if (v === 'circle' || v === 'triangle' || v === 'x') {
      plannerTodoCompletionSet_(st, ymd, taskId, /** @type {'circle'|'triangle'|'x'} */ (v));
    } else {
      plannerTodoCompletionSet_(st, ymd, taskId, 'none');
    }
    if (typeof root.__spPlanRerenderMonth === 'function') {
      root.__spPlanRerenderMonth();
    }
  });

  function endPaintGlobal() {
    painting = false;
    lastPaintSlot = '';
    const st = root.__spPlanState;
    if (st && st.selectedDate) {
      plannerPersistTimelineSlotMapToMonthTodos_(st, st.selectedDate);
    }
    plannerRefreshDayModalStudyFooter_(root);
    plannerRefreshDayModalTodoSide_(root);
    window.removeEventListener('pointerup', endPaintGlobal);
    window.removeEventListener('pointercancel', endPaintGlobal);
  }

  timegrid.addEventListener('pointerdown', function (e) {
    const btn = e.target && e.target.closest ? e.target.closest('.sp-plan-slotcell') : null;
    if (!btn || !timegrid.contains(btn) || !(btn instanceof HTMLButtonElement)) return;
    if (btn.disabled) return;
    const stPaint = root.__spPlanState;
    const brushPaint =
      stPaint && stPaint.modalBrushTodoId ? String(stPaint.modalBrushTodoId).trim() : '';
    plannerFocusSlotcell_(timegrid, btn);
    if (!brushPaint) return;
    painting = true;
    lastPaintSlot = '';
    plannerPaintSlotcellFromState_(root, btn, timegrid);
    lastPaintSlot = btn.getAttribute('data-slot') || '';
    window.addEventListener('pointerup', endPaintGlobal);
    window.addEventListener('pointercancel', endPaintGlobal);
  });

  timegrid.addEventListener('pointermove', function (e) {
    if (!painting) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const btn = el && el.closest ? el.closest('.sp-plan-slotcell') : null;
    if (!btn || !timegrid.contains(btn) || !(btn instanceof HTMLButtonElement)) return;
    if (btn.disabled) return;
    const sk = btn.getAttribute('data-slot') || '';
    if (sk === lastPaintSlot) return;
    lastPaintSlot = sk;
    plannerPaintSlotcellFromState_(root, btn, timegrid);
  });

  timegrid.addEventListener('keydown', function (e) {
    const btn = e.target && e.target.closest ? e.target.closest('.sp-plan-slotcell') : null;
    if (!btn || !timegrid.contains(btn) || !(btn instanceof HTMLButtonElement)) return;
    const cells = Array.prototype.slice.call(timegrid.querySelectorAll('.sp-plan-slotcell'));
    const i = cells.indexOf(btn);
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      const st = root.__spPlanState;
      if (!st || !st.selectedDate) return;
      if (btn.disabled) return;
      const brush = st.modalBrushTodoId ? String(st.modalBrushTodoId).trim() : '';
      if (!brush) return;
      const slot = btn.getAttribute('data-slot');
      if (slot == null) return;
      const slots = plannerEnsureTimelineTodoSlots_(st, st.selectedDate);
      plannerTimelineSlotApplyBrush_(slots, String(slot), brush, st, st.selectedDate);
      plannerRefreshTimegridSlotcellsUi_(st, st.selectedDate, timegrid);
      plannerPersistTimelineSlotMapToMonthTodos_(st, st.selectedDate);
      plannerRefreshDayModalStudyFooter_(root);
      plannerRefreshDayModalTodoSide_(root);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      let j = i + 1;
      while (j < cells.length) {
        const next = cells[j];
        if (next instanceof HTMLButtonElement && !next.disabled) {
          plannerFocusSlotcell_(timegrid, next);
          break;
        }
        j++;
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      let j = i - 1;
      while (j >= 0) {
        const next = cells[j];
        if (next instanceof HTMLButtonElement && !next.disabled) {
          plannerFocusSlotcell_(timegrid, next);
          break;
        }
        j--;
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      let j = i + PLAN_TIMELINE_CELLS_PER_HOUR;
      while (j < cells.length) {
        const next = cells[j];
        if (next instanceof HTMLButtonElement && !next.disabled) {
          plannerFocusSlotcell_(timegrid, next);
          break;
        }
        j++;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      let j = i - PLAN_TIMELINE_CELLS_PER_HOUR;
      while (j >= 0) {
        const next = cells[j];
        if (next instanceof HTMLButtonElement && !next.disabled) {
          plannerFocusSlotcell_(timegrid, next);
          break;
        }
        j--;
      }
    }
  });
  const memoTa = modalEl.querySelector('#sp-plan-day-memo');
  if (memoTa instanceof HTMLTextAreaElement) {
    memoTa.addEventListener('input', function () {
      const st = root.__spPlanState;
      if (!st || !st.selectedDate) return;
      if (!st.dayMemoByDate) st.dayMemoByDate = {};
      st.dayMemoByDate[st.selectedDate] = memoTa.value;
      plannerSyncDayMemoToMonthTodo_(st, st.selectedDate);
    });
  }
}

/**
 * `monthTodos` 중 해당 날짜 건수(고정·trace 제외).
 * @param {object} st
 * @param {string} ymd
 * @returns {number}
 */
function plannerManualTodosCountForDay_(st, ymd) {
  return plannerMonthTodosForDay_(st, ymd).filter(function (r) {
    if (!r || plannerIsTraceGhostDisplay_(r)) return false;
    return !plannerIsExcludedFromStudyTotals_(r.task_id, r.category);
  }).length;
}

/**
 * 달력 **배지 숫자** — 일일 모달 학습 할 일만(취침·식사·루틴·고정·메모·trace 제외).
 * @param {object} st
 * @param {string} ymd
 * @returns {number}
 */
function plannerCalendarUserTodoCountForBadge_(st, ymd) {
  return plannerMonthTodosForDay_(st, ymd).filter(function (r) {
    if (!r || plannerIsTraceGhostDisplay_(r)) return false;
    return !plannerIsExcludedFromStudyTotals_(r.task_id, r.category);
  }).length;
}

/**
 * @param {HTMLElement} slot
 */
function plannerHideTodoContextMenu_(slot) {
  const menu = slot.querySelector('#sp-plan-calendar-ctx-menu');
  if (menu instanceof HTMLElement) {
    menu.setAttribute('hidden', 'hidden');
    menu.style.left = '';
    menu.style.top = '';
  }
  slot.__spPlanCtxMenu = null;
  slot.__spPlanDragPayload = null;
}

/**
 * @param {HTMLElement} el
 * @returns {string[]}
 */
function plannerResolveTodoIdsFromContextTarget_(el) {
  const one = el.getAttribute('data-sp-task-id');
  if (one && String(one).trim()) return [String(one).trim()];
  const many = el.getAttribute('data-sp-task-ids');
  if (many) {
    return String(many)
      .split(',')
      .map(function (s) {
        return String(s).trim();
      })
      .filter(Boolean);
  }
  return [];
}

/**
 * 달력 할 일 우클릭 삭제 — 로컬에선 제거, 서버 행은 삭제 예약(저장 시 반영).
 * @param {HTMLElement} root
 * @param {string} ymd
 * @param {string[]} taskIds
 */
async function plannerDeleteTodosFromCalendar_(root, ymd, taskIds) {
  if (!root.__spPlanAdminMode) return;
  const st = root.__spPlanState;
  const slot = root.querySelector('#sp-plan-calendar-slot');
  if (!st || !taskIds.length) return;
  const day = String(ymd || '').trim();
  taskIds.forEach(function (tid) {
    const row = st.monthTodos.find(function (r) {
      return r && String(r.date || '').trim() === day && String(r.task_id || '').trim() === tid;
    });
    if (row && row._fromServer) {
      plannerMarkMonthTodoDeleted_(st, day, tid);
    } else {
      plannerRemoveMonthTodo_(st, day, tid);
    }
  });
  plannerRefreshPostPreview_(root);
  if (typeof root.__spPlanRerenderMonth === 'function') {
    root.__spPlanRerenderMonth();
  }
  const modal = root.querySelector('#sp-plan-day-modal');
  if (modal && st.selectedDate === day && !modal.hasAttribute('hidden')) {
    if (st.dayTimelineTodoByDate) {
      try {
        delete st.dayTimelineTodoByDate[day];
      } catch (_e) {
        st.dayTimelineTodoByDate[day] = {};
      }
    }
    if (typeof root.__spPlanRefreshOpenDayModal === 'function') {
      root.__spPlanRefreshOpenDayModal();
    }
  }
  if (slot) plannerHideTodoContextMenu_(slot);
}

/**
 * @param {HTMLElement} root
 * @param {{ role: string, common: object[], personal: object[] | null, curriculum?: unknown }} boot
 */
function renderCalendar_(root, boot) {
  const slot = root.querySelector('#sp-plan-calendar-slot');
  const ban = root.querySelector('#sp-plan-banner');
  if (!slot) return;

  const role = boot && boot.role === 'member' ? 'member' : 'guest';

  const common = plannerNormalizeCommonEventsFromApi_(boot && boot.common);
  const personal = boot && boot.personal != null && Array.isArray(boot.personal) ? boot.personal : [];

  /** @type {Record<string, number>} */
  const byDate = {};
  plannerCommonEventsMergeIntoByDate_(byDate, common);
  personal.forEach(function (ev) {
    const d0 = String((ev && ev.date) || '').trim();
    if (!d0) return;
    byDate[d0] = (byDate[d0] || 0) + 1;
  });

  const apiHadCalendarRows = common.length > 0 || personal.length > 0;

  /** @type {{ role: 'member'|'guest', viewMonth: Date, byDate: Record<string, number>, selectedDate: string|null, apiHadCalendarRows: boolean, plannerCurriculum?: { courses: object[], lectures: object[] }, monthTodos?: object[], dayTimelineSlotsByDate?: Record<string, Record<string, boolean>>, dayTimelineTodoByDate?: Record<string, Record<string, string>>, dayFixedBlockSlotsByDate?: Record<string, Record<string, boolean>>, dayMemoByDate?: Record<string, string>, plannerQuickPostBody?: { action: string, todos: object[] }, modalBrushTodoId?: string, quickRegCollapsed?: boolean, planGuestUnlockMock?: boolean }} */
  const st = (root.__spPlanState =
    root.__spPlanState && typeof root.__spPlanState === 'object'
      ? root.__spPlanState
      : {
          role: role,
          viewMonth: new Date(),
          byDate: {},
          selectedDate: null,
          apiHadCalendarRows: false,
          dayTimelineSlotsByDate: {},
          dayTimelineTodoByDate: {},
          dayFixedBlockSlotsByDate: {},
          dayMemoByDate: {},
          monthTodos: [],
          plannerCurriculum: { courses: [], lectures: [] },
          plannerQuickPostBody: { action: 'plannerPersonalTodosApply', todos: [] },
          modalBrushTodoId: '',
          quickRegCollapsed: false,
          planGuestUnlockMock: false
        });
  st.role = role;
  /* 시연: 모달에서 '구매하기' 누른 뒤엔 재부트( renderCalendar_ ) 때도 API guest를 덮지 않음 */
  if (st.planGuestUnlockMock) {
    st.role = 'member';
  }
  st.byDate = byDate;
  st.apiHadCalendarRows = apiHadCalendarRows;
  st.plannerCommonEvents = common;
  plannerInitCurriculumOnCalendar_(root, boot);
  if (st.modalBrushTodoId == null) st.modalBrushTodoId = '';
  plannerEnsureMonthTodos_(st);
  if (!st.plannerQuickPostBody || typeof st.plannerQuickPostBody !== 'object') {
    st.plannerQuickPostBody = { action: 'plannerPersonalTodosApply', todos: [] };
    plannerRebuildQuickPostPayload_(st);
  }
  if (!st.dayTimelineTodoByDate) st.dayTimelineTodoByDate = {};
  if (!st.dayFixedBlockSlotsByDate) st.dayFixedBlockSlotsByDate = {};
  if (!st.dayMemoByDate) st.dayMemoByDate = {};
  if (typeof st.quickRegCollapsed !== 'boolean') st.quickRegCollapsed = false;
  if (typeof st.planGuestUnlockMock !== 'boolean') st.planGuestUnlockMock = false;
  if (ban) {
    if (st.role === 'guest') {
      ban.textContent = '수강 확인이 되지 않아 학원 공통 일정만 표시됩니다. 문의가 필요하면 담당자에게 연락해 주세요.';
      ban.removeAttribute('hidden');
    } else {
      ban.setAttribute('hidden', 'hidden');
    }
  }
  if (!(st.viewMonth instanceof Date) || isNaN(Number(st.viewMonth))) {
    st.viewMonth = new Date();
  }
  if (plannerIsPlanDemoRoot_(root)) {
    const fixVm = root.__spPlanDemoViewMonth;
    if (fixVm instanceof Date && !isNaN(fixVm.getTime())) {
      st.viewMonth = new Date(fixVm.getTime());
    }
  }

  plannerApplyBootstrapPersonal_(st, personal, st.role);

  function pad2(n) {
    return String(n < 10 ? '0' : '') + String(n);
  }

  /** @param {Date} d */
  function ymd(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** @param {Date} d */
  function ym(d) {
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월';
  }

  /** @param {Date} d */
  function mdShort(d) {
    return d.getMonth() + 1 + '/' + d.getDate();
  }

  /** @param {Date} d */
  function monthStartSunday(d) {
    const s = new Date(d.getFullYear(), d.getMonth(), 1);
    const wd = s.getDay(); // 0=Sun
    s.setDate(s.getDate() - wd);
    s.setHours(0, 0, 0, 0);
    return s;
  }

  function renderMonth_() {
    const view = st.viewMonth;
    const wrap = slot.querySelector('#sp-plan-month-wrap');
    if (!wrap) return;
    const title = wrap.querySelector('.sp-plan-month__title');
    if (title) title.textContent = ym(view);

    const grid = wrap.querySelector('.sp-plan-month__grid');
    if (!grid) return;
    const start = monthStartSunday(view);
    const viewY = view.getFullYear();
    const viewM = view.getMonth();

    /** @type {string[]} */
    const wkMetaKo = [];
    let weekOrd = 0;
    const ordWords = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째'];
    for (let ww = 0; ww < 6; ww++) {
      const su = new Date(start.getFullYear(), start.getMonth(), start.getDate() + ww * 7);
      let touches = false;
      for (let di = 0; di < 7; di++) {
        const dd = new Date(su.getFullYear(), su.getMonth(), su.getDate() + di);
        if (dd.getFullYear() === viewY && dd.getMonth() === viewM) touches = true;
      }
      if (touches) {
        const word = ordWords[weekOrd] != null ? ordWords[weekOrd] : String(weekOrd + 1);
        wkMetaKo[ww] = String(viewM + 1) + '월 ' + word + '주';
        weekOrd++;
      } else {
        wkMetaKo[ww] = '';
      }
    }

    let html = '';
    const planMobile = plannerIsPlanMobile_(root);
    for (let w = 0; w < 6; w++) {
      const sun = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7);
      const sat = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 6);
      /** @type {string[]} */
      const weekYmds = [];
      for (let di0 = 0; di0 < 7; di0++) {
        const dd0 = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + di0);
        weekYmds.push(ymd(dd0));
      }
      const curPayload = plannerCurriculumWeekPayloadForRender_(
        w,
        weekYmds,
        st.plannerCurriculum,
        st
      );
      html += '<div class="sp-plan-month__weekRow">';
      if (planMobile) {
        const subjN = plannerCurriculumWeekDistinctSubjectCount_(curPayload.rows || []);
        html +=
          '<div class="sp-plan-month__weekLead sp-plan-month__weekLead--planMobile">' +
          '<div class="sp-plan-month__weekMeta" aria-label="주간 구간">' +
          '<div class="sp-plan-month__weekMeta-range">' +
          mdShort(sun) +
          ' – ' +
          mdShort(sat) +
          '</div>' +
          (wkMetaKo[w]
            ? '<div class="sp-plan-month__weekMeta-wk">' + esc(wkMetaKo[w]) + '</div>'
            : '') +
          '</div>' +
          '<button type="button" class="btn btn--ghost sp-plan-weekCurBtn" data-sp-open-week-cur="' +
          String(w) +
          '" aria-haspopup="dialog">' +
          esc(subjN > 0 ? '주간 교재 · ' + String(subjN) + '과목' : '주간 교재 보기') +
          '</button></div>';
      } else {
      html +=
        '<div class="sp-plan-month__weekLead">' +
        '<div class="sp-plan-month__weekMeta" aria-label="주간 구간">' +
        '<div class="sp-plan-month__weekMeta-range">' +
        mdShort(sun) +
        ' – ' +
        mdShort(sat) +
        '</div>' +
          (wkMetaKo[w]
            ? '<div class="sp-plan-month__weekMeta-wk">' + esc(wkMetaKo[w]) + '</div>'
            : '') +
        '</div>' +
          plannerCurriculumWeekTableHtml_(curPayload) +
        '</div>';
      }

      for (let di = 0; di < 7; di++) {
        const d = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + di);
        const inMonth = d.getFullYear() === viewY && d.getMonth() === viewM;
        const key = ymd(d);
        const wkCls = di === 0 ? ' is-sun' : di === 6 ? ' is-sat' : '';
        const apiN = st.byDate[key] || 0;
        const mn = plannerManualTodosCountForDay_(st, key);
        const qn = mn;
        const badge = plannerCalendarUserTodoCountForBadge_(st, key);
        const asg = plannerAssignedMinutesForDay_(st, key) > 0 ? 1 : 0;
        const memoIcon = plannerDayMemoIconHtml_(st, key);
        const dayEvents = plannerEventsForDay_(st, key);
        const eventTitleAttr = dayEvents.length
          ? ' title="' + esc(plannerDayEventHoverTitle_(dayEvents)) + '"'
          : '';
        const hasEventCls = dayEvents.length ? ' has-event' : '';
        let dots = '';
        if (apiN) dots += '<span class="sp-plan-day__dot sp-plan-day__dot--api" title="일정"></span>';
        if (qn) dots += '<span class="sp-plan-day__dot sp-plan-day__dot--quick" title="빠른등록"></span>';
        if (mn) dots += '<span class="sp-plan-day__dot sp-plan-day__dot--manual" title="개별 등록"></span>';
        if (asg) dots += '<span class="sp-plan-day__dot sp-plan-day__dot--assign" title="시간표"></span>';
        html += `
        <button type="button" class="sp-plan-day${wkCls}${inMonth ? '' : ' is-out'}${memoIcon ? ' has-memo' : ''}${hasEventCls}" data-ymd="${key}"${eventTitleAttr} ${inMonth ? '' : 'disabled'}>
          <div class="sp-plan-day__top">
            <span class="sp-plan-day__dateHead">
              <span class="sp-plan-day__num">${d.getDate()}</span>${memoIcon}
            </span>
            ${badge ? `<span class="sp-plan-day__badge" aria-label="요약 ${badge}건">${badge}</span>` : ''}
          </div>
          <div class="sp-plan-day__dots" aria-hidden="true">${dots}</div>
          ${planMobile ? '' : plannerQuickPlanCellSummaryHtml_(st, key)}
          ${planMobile ? '' : plannerFixedScheduleFooterHtml_(st, key)}
        </button>`;
      }
      html += '</div>';
    }
    grid.innerHTML = html;
    plannerSyncCalendarChipDraggable_(root, grid);
    plannerRefreshPostPreview_(root);
    plannerRefreshMonthlyNotice_(root);
  }

  function plannerEnsureDayModalEventStrip_(modalEl) {
    if (!modalEl || modalEl.querySelector('#sp-plan-day-event-strip')) return;
    const footer = modalEl.querySelector('#sp-plan-day-study-footer');
    if (!footer) return;
    footer.insertAdjacentHTML(
      'beforebegin',
      '<div id="sp-plan-day-event-strip" class="sp-plan-day__eventStrip" hidden></div>'
    );
  }

  function plannerEnsureDayModalSaveActions_(modalEl) {
    if (!modalEl || modalEl.querySelector('#sp-plan-day-save')) return;
    const memoBlock = modalEl.querySelector('.sp-plan-day__memo');
    if (!memoBlock) return;
    memoBlock.insertAdjacentHTML(
      'afterend',
      '<div class="sp-plan-day__actions" aria-label="일일 저장">' +
        '<button type="button" class="btn btn--primary" id="sp-plan-day-save">저장하기</button>' +
        '<span class="sp-plan-day__applyMsg" id="sp-plan-day-apply-msg" hidden></span>' +
        '</div>'
    );
  }

  function ensurePlanMobileModals_() {
    let weekM = root.querySelector('#sp-plan-week-modal');
    if (!weekM) {
      weekM = document.createElement('div');
      weekM.id = 'sp-plan-week-modal';
      weekM.className = 'sp-plan-modal sp-plan-modal--weekCur';
      weekM.setAttribute('hidden', 'hidden');
      weekM.innerHTML =
        '<div class="sp-plan-modal__backdrop" data-sp-plan-close="week" aria-hidden="true"></div>' +
        '<div class="sp-plan-modal__panel" role="dialog" aria-modal="true" aria-labelledby="sp-plan-week-modal-title">' +
        '<div class="sp-plan-modal__head">' +
        '<div class="sp-plan-modal__title" id="sp-plan-week-modal-title">주간 교재</div>' +
        '<button type="button" class="btn btn--ghost sp-plan-modal__close" data-sp-plan-close="week">닫기</button>' +
        '</div>' +
        '<div class="sp-plan-modal__body sp-plan-weekModal__body" id="sp-plan-week-modal-body"></div>' +
        '</div>';
      root.appendChild(weekM);
      weekM.addEventListener('click', function (e) {
        const t = e.target instanceof HTMLElement ? e.target : null;
        if (!t) return;
        if (t.getAttribute('data-sp-plan-close') === 'week' || t.closest('[data-sp-plan-close="week"]')) {
          closeWeekCurModal_();
        }
      });
    }

    let peekM = root.querySelector('#sp-plan-day-peek-modal');
    if (!peekM) {
      peekM = document.createElement('div');
      peekM.id = 'sp-plan-day-peek-modal';
      peekM.className = 'sp-plan-modal sp-plan-modal--dayPeek';
      peekM.setAttribute('hidden', 'hidden');
      peekM.innerHTML =
        '<div class="sp-plan-modal__backdrop" data-sp-plan-close="peek" aria-hidden="true"></div>' +
        '<div class="sp-plan-modal__panel" role="dialog" aria-modal="true" aria-labelledby="sp-plan-day-peek-modal-title">' +
        '<div class="sp-plan-modal__head">' +
        '<div class="sp-plan-modal__title" id="sp-plan-day-peek-modal-title">오늘의 할 일</div>' +
        '<button type="button" class="btn btn--ghost sp-plan-modal__close" data-sp-plan-close="peek">닫기</button>' +
        '</div>' +
        '<div class="sp-plan-modal__body sp-plan-dayPeek__body" id="sp-plan-day-peek-body"></div>' +
        '<div class="sp-plan-dayPeek__foot">' +
        '<button type="button" class="btn btn--primary" id="sp-plan-day-peek-open-planner">일일 플래너 열기</button>' +
        '</div></div>';
      root.appendChild(peekM);
      peekM.addEventListener('click', function (e) {
        const t = e.target instanceof HTMLElement ? e.target : null;
        if (!t) return;
        if (t.getAttribute('data-sp-plan-close') === 'peek' || t.closest('[data-sp-plan-close="peek"]')) {
          closeDayPeekModal_();
          return;
        }
        const openBtn =
          t.id === 'sp-plan-day-peek-open-planner'
            ? t
            : t.closest
              ? t.closest('#sp-plan-day-peek-open-planner')
              : null;
        if (openBtn && st.selectedDate) {
          e.preventDefault();
          closeDayPeekModal_();
          openDayModal_(st.selectedDate);
        }
      });
    }

    if (!root.__spPlanMobileEscWired) {
      root.__spPlanMobileEscWired = true;
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        const coachingEl = root.querySelector('#sp-plan-coaching-subj-modal');
        if (coachingEl && !coachingEl.hasAttribute('hidden')) {
          plannerCloseCoachingSubjModal_(root);
          e.preventDefault();
          return;
        }
        const peekEl = root.querySelector('#sp-plan-day-peek-modal');
        if (peekEl && !peekEl.hasAttribute('hidden')) {
          closeDayPeekModal_();
          e.preventDefault();
          return;
        }
        const weekEl = root.querySelector('#sp-plan-week-modal');
        if (weekEl && !weekEl.hasAttribute('hidden')) {
          closeWeekCurModal_();
          e.preventDefault();
        }
      });
    }
  }

  /**
   * @param {number} weekIndex
   */
  function openWeekCurModal_(weekIndex) {
    ensurePlanMobileModals_();
    const m = root.querySelector('#sp-plan-week-modal');
    if (!m) return;
    const w = Number(weekIndex);
    if (!isFinite(w) || w < 0) return;
    const start = monthStartSunday(st.viewMonth);
    const sun = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7);
    const sat = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 6);
    /** @type {string[]} */
    const weekYmds = [];
    for (let di = 0; di < 7; di++) {
      const d = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + di);
      weekYmds.push(ymd(d));
    }
    const payload = plannerCurriculumWeekPayloadForRender_(w, weekYmds, st.plannerCurriculum, st);
    const title = m.querySelector('#sp-plan-week-modal-title');
    if (title) {
      title.textContent = mdShort(sun) + ' – ' + mdShort(sat) + ' · 주간 교재';
    }
    const body = m.querySelector('#sp-plan-week-modal-body');
    if (body) body.innerHTML = plannerCurriculumWeekTableHtml_(payload);
    m.removeAttribute('hidden');
  }

  function closeWeekCurModal_() {
    const m = root.querySelector('#sp-plan-week-modal');
    if (m) m.setAttribute('hidden', 'hidden');
  }

  /**
   * @param {string} dateYmd
   */
  function openDayPeekModal_(dateYmd) {
    ensurePlanMobileModals_();
    const m = root.querySelector('#sp-plan-day-peek-modal');
    if (!m) return;
    st.selectedDate = String(dateYmd || '');
    const title = m.querySelector('#sp-plan-day-peek-modal-title');
    if (title) {
      title.textContent = plannerFormatYmdKoShort_(st.selectedDate) + ' · 오늘의 할 일';
    }
    const body = m.querySelector('#sp-plan-day-peek-body');
    if (body) body.innerHTML = plannerPlanDayPeekBodyHtml_(st, st.selectedDate);
    m.removeAttribute('hidden');
  }

  function closeDayPeekModal_() {
    const m = root.querySelector('#sp-plan-day-peek-modal');
    if (m) m.setAttribute('hidden', 'hidden');
  }

  function ensureModal_() {
    const existingModal = root.querySelector('#sp-plan-day-modal');
    if (existingModal) {
      plannerEnsureDayModalEventStrip_(existingModal);
      plannerEnsureDayModalSaveActions_(existingModal);
      return;
    }
    const el = document.createElement('div');
    el.id = 'sp-plan-day-modal';
    el.className = 'sp-plan-modal';
    el.setAttribute('hidden', 'hidden');
    el.innerHTML = `
      <div class="sp-plan-modal__backdrop" data-sp-plan-close="1"></div>
      <div class="sp-plan-modal__panel" role="dialog" aria-modal="true" aria-labelledby="sp-plan-day-modal-title">
        <div class="sp-plan-modal__head">
          <div class="sp-plan-modal__title" id="sp-plan-day-modal-title">오늘의 학습</div>
          <button type="button" class="btn btn--ghost sp-plan-modal__close" data-sp-plan-close="1">닫기</button>
        </div>
        <div class="sp-plan-modal__body">
          <div class="sp-plan-day sp-plan-day--daily">
            <section class="sp-plan-day__timeline" aria-label="할 일·시간표">
              <div class="sp-plan-day__secTitle">할 일과 학습 시간</div>
              <div class="sp-plan-day__split" role="presentation">
                <aside class="sp-plan-day__splitCol sp-plan-day__splitCol--todos" aria-label="할 일 요약">
                  <div class="sp-plan-day__splitColHead">할 일</div>
                  <div id="sp-plan-day-todo-side" class="sp-plan-day__todoSideSlot"></div>
                </aside>
                <div class="sp-plan-day__splitCol sp-plan-day__splitCol--time" aria-label="시간표 영역">
                  <div class="sp-plan-day__splitColHead">시간표</div>
                  <div class="sp-plan-day__timegrid sp-plan-day__timegrid--hourly" id="sp-plan-day-timegrid" role="group" aria-label="10분 단위 시간표"></div>
                </div>
              </div>
              <div id="sp-plan-day-event-strip" class="sp-plan-day__eventStrip" hidden></div>
              <div id="sp-plan-day-study-footer" class="sp-plan-day__studyFooter" aria-live="polite"></div>
              <div class="sp-plan-day__memo" aria-label="일일 메모">
                <div class="sp-plan-day__memoHead">메모</div>
                <textarea id="sp-plan-day-memo" class="sp-plan-day__memoTa" rows="4" maxlength="3000" spellcheck="true" placeholder="오늘 기억할 내용을 적어 주세요."></textarea>
              </div>
            </section>
          </div>
          <div class="sp-plan-lock" id="sp-plan-day-lock" hidden>
            <div class="sp-plan-lock__card">
              <div class="sp-plan-lock__title">수강 확인 후 이용할 수 있습니다</div>
              <div class="sp-plan-lock__desc">날짜별 할 일과 시간표는 수강이 확인된 회원에게 제공됩니다.</div>
              <button type="button" id="sp-plan-lock-buy" class="btn btn--primary sp-plan-lock__cta">솔패스 안내</button>
            </div>
          </div>
        </div>
      </div>`;
    root.appendChild(el);
    plannerEnsureDayModalSaveActions_(el);
    function plannerGuestUnlockBuy_() {
      const st0 = root.__spPlanState;
      if (st0 && typeof st0 === 'object') {
        st0.planGuestUnlockMock = true;
      }
      const lockEl = el.querySelector('#sp-plan-day-lock');
      if (lockEl) {
        lockEl.setAttribute('hidden', 'hidden');
        lockEl.setAttribute('aria-hidden', 'true');
      }
    }
    const buyBtn = el.querySelector('#sp-plan-lock-buy');
    if (buyBtn) {
      buyBtn.addEventListener(
        'click',
        function (e) {
          e.preventDefault();
          e.stopPropagation();
          plannerGuestUnlockBuy_();
        },
        true
      );
    }
    el.addEventListener('click', function (e) {
      let t = /** @type {Node|null} */ (e.target);
      if (!t) return;
      if (t.nodeType === 3 && t.parentNode) t = t.parentNode;
      const h = t instanceof HTMLElement ? t : null;
      if (!h) return;
      if (h.getAttribute && h.getAttribute('data-sp-plan-close') === '1') {
        closeDayModal_();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const m = root.querySelector('#sp-plan-day-modal');
        if (m && !m.hasAttribute('hidden')) {
          closeDayModal_();
        }
      }
    });
    wirePlannerDayModalUiOnce_(el, root);
  }

  function openDayModal_(dateYmd) {
    ensureModal_();
    const m = root.querySelector('#sp-plan-day-modal');
    if (!m) return;
    st.selectedDate = String(dateYmd || '');
    if (st.modalBrushTodoId) {
      const brushId = String(st.modalBrushTodoId);
      const brushRow = plannerMonthTodosForDay_(st, st.selectedDate).find(function (r) {
        return r && String(r.task_id || '') === brushId;
      });
      if (
        brushRow &&
        (String(brushRow.category || '').trim() === PLAN_CATEGORY_FIXED ||
          String(brushRow.category || '').trim() === PLAN_CATEGORY_EVENT ||
          String(brushRow.category || '').trim() === 'memo')
      ) {
        st.modalBrushTodoId = '';
      }
    }
    plannerInvalidateDayTimelineCache_(st, st.selectedDate);
    if (st.viewMonth instanceof Date && !isNaN(st.viewMonth.getTime())) {
      plannerRebuildFixedBlockSlotsForMonth_(st, st.viewMonth);
    }
    const title = m.querySelector('#sp-plan-day-modal-title');
    if (title) title.textContent = st.selectedDate ? st.selectedDate + ' · 일일 플래너' : '일일 플래너';
    const todoSide = m.querySelector('#sp-plan-day-todo-side');
    if (todoSide) todoSide.innerHTML = plannerDayTodosFromPayloadHtml_(st.selectedDate, st);
    const timegrid = m.querySelector('#sp-plan-day-timegrid');
    if (timegrid) {
      timegrid.innerHTML = plannerDayTimelineHtml_(st, st.selectedDate);
      plannerRovingTabindexSlotcells_(timegrid);
    }
    plannerRefreshDayModalEventStrip_(root);
    plannerRefreshDayModalStudyFooter_(root);
    const memo = m.querySelector('#sp-plan-day-memo');
    if (memo instanceof HTMLTextAreaElement) {
      if (!st.dayMemoByDate) st.dayMemoByDate = {};
      let mv = '';
      plannerMonthTodosForDay_(st, st.selectedDate).forEach(function (r) {
        if (!r || String(r.category || '').trim() !== 'memo') return;
        const t = String(r.title != null ? r.title : '').trim();
        if (t) mv = t;
      });
      if (!mv && st.dayMemoByDate[st.selectedDate] != null) {
        mv = String(st.dayMemoByDate[st.selectedDate]);
      }
      st.dayMemoByDate[st.selectedDate] = mv;
      memo.value = mv;
    }
    m.removeAttribute('hidden');
    const lock = m.querySelector('#sp-plan-day-lock');
    if (lock) {
      if (st.planGuestUnlockMock) {
        lock.setAttribute('hidden', 'hidden');
        lock.setAttribute('aria-hidden', 'true');
      } else if (st.role === 'guest') {
        lock.removeAttribute('hidden');
        lock.removeAttribute('aria-hidden');
      } else {
        lock.setAttribute('hidden', 'hidden');
        lock.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function closeDayModal_() {
    const m = root.querySelector('#sp-plan-day-modal');
    if (!m) return;
    m.setAttribute('hidden', 'hidden');
  }

  const vmMan = st.viewMonth;
  const defManDue =
    vmMan instanceof Date && !isNaN(Number(vmMan.getTime()))
      ? plannerYmdFromParts_(vmMan.getFullYear(), vmMan.getMonth(), 1)
      : plannerYmdFromParts_(new Date().getFullYear(), new Date().getMonth(), 1);
  const defFixedEnd =
    vmMan instanceof Date && !isNaN(Number(vmMan.getTime()))
      ? plannerYmdFromParts_(
          vmMan.getFullYear(),
          vmMan.getMonth(),
          new Date(vmMan.getFullYear(), vmMan.getMonth() + 1, 0).getDate()
        )
      : defManDue;

  const fixedTimeOptsStart = plannerFixedTimelineSelectOptionsHtml_(false);
  const fixedTimeOptsEnd = plannerFixedTimelineSelectOptionsHtml_(true);
  slot.innerHTML =
    '<div class="sp-plan-calstack">' +
    '<section class="sp-plan-todoReg sp-plan-quick' +
    (st.quickRegCollapsed ? ' is-collapsed' : '') +
    '" id="sp-plan-quick-reg" aria-label="할 일 등록">' +
    '<header class="sp-plan-todoReg__outerHead sp-plan-quick__head">' +
    '<div class="sp-plan-quick__headL">' +
    '<button type="button" class="sp-plan-quick__collapse" id="sp-quick-toggle" aria-expanded="' +
    (st.quickRegCollapsed ? 'false' : 'true') +
    '" aria-controls="sp-plan-todo-reg-body" title="할 일 등록 영역 접기·펼치기">' +
    '<span class="sp-plan-quick__chev" aria-hidden="true">▼</span>' +
    '</button>' +
    '<div class="sp-plan-todoReg__headMain">' +
    '<span class="sp-plan-todoReg__outerTitle">할 일 등록</span>' +
    '<span class="sp-plan-todoReg__outerSub">한 달 일정을 빠르게 채우거나, 달력 날짜에서 우클릭해 한 건씩 추가합니다.</span>' +
    '</div></div></header>' +
    '<div id="sp-plan-todo-reg-body" class="sp-plan-quick__body sp-plan-todoReg__scroll">' +
    '<div class="sp-plan-todoReg__panel sp-plan-todoReg__panel--quick">' +
    '<div class="sp-plan-todoReg__panelHead">' +
    '<span class="sp-plan-todoReg__panelBadge" aria-hidden="true">빠른</span>' +
    '<div class="sp-plan-todoReg__panelHeadText">' +
    '<h3 class="sp-plan-todoReg__panelTitle">빠른 등록</h3>' +
    '<p class="sp-plan-todoReg__panelSub">강좌와 회차 범위를 고른 뒤, 선택한 요일에 나눠 넣습니다. 요일별 강 수를 비우면 균등하게 배분합니다.</p>' +
    '</div></div>' +
    '<p class="sp-plan-quick__err" id="sp-plan-quick-err" hidden></p>' +
    '<p class="sp-plan-curr__hint" id="sp-quick-catalog-hint" hidden></p>' +
    '<div class="sp-plan-quick__row sp-plan-quick__row--stack">' +
    '<span class="sp-plan-quick__lbl">요일·강 수</span>' +
    '<div class="sp-plan-quick__dowGrid" role="group" aria-label="요일">' +
    '<div class="sp-plan-quick__dowItem"><label class="sp-plan-quick__chk"><input type="checkbox" name="sp-dow" value="1"/>월</label><input type="text" class="sp-plan-quick__dowCnt" data-dow="1" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="강 수" hidden/></div>' +
    '<div class="sp-plan-quick__dowItem"><label class="sp-plan-quick__chk"><input type="checkbox" name="sp-dow" value="2"/>화</label><input type="text" class="sp-plan-quick__dowCnt" data-dow="2" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="강 수" hidden/></div>' +
    '<div class="sp-plan-quick__dowItem"><label class="sp-plan-quick__chk"><input type="checkbox" name="sp-dow" value="3"/>수</label><input type="text" class="sp-plan-quick__dowCnt" data-dow="3" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="강 수" hidden/></div>' +
    '<div class="sp-plan-quick__dowItem"><label class="sp-plan-quick__chk"><input type="checkbox" name="sp-dow" value="4"/>목</label><input type="text" class="sp-plan-quick__dowCnt" data-dow="4" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="강 수" hidden/></div>' +
    '<div class="sp-plan-quick__dowItem"><label class="sp-plan-quick__chk"><input type="checkbox" name="sp-dow" value="5"/>금</label><input type="text" class="sp-plan-quick__dowCnt" data-dow="5" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="강 수" hidden/></div>' +
    '<div class="sp-plan-quick__dowItem"><label class="sp-plan-quick__chk"><input type="checkbox" name="sp-dow" value="6"/>토</label><input type="text" class="sp-plan-quick__dowCnt" data-dow="6" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="강 수" hidden/></div>' +
    '<div class="sp-plan-quick__dowItem"><label class="sp-plan-quick__chk"><input type="checkbox" name="sp-dow" value="0"/>일</label><input type="text" class="sp-plan-quick__dowCnt" data-dow="0" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="강 수" hidden/></div>' +
    '</div></div>' +
    '<div class="sp-plan-manual__grid sp-plan-manual__grid--quick">' +
    '<label class="sp-plan-manual__lbl">과목<select id="sp-quick-subj" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="과목 선택"></select></label>' +
    '<label class="sp-plan-manual__lbl">선생님<select id="sp-quick-instructor" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="선생님 선택"></select></label>' +
    '<label class="sp-plan-manual__lbl">강좌명<select id="sp-quick-course" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="강좌명 선택"></select></label>' +
    '<label class="sp-plan-manual__lbl">시작일<input type="date" id="sp-quick-start-date" class="sp-plan-manual__input" value="' +
    esc(defManDue) +
    '"/></label>' +
    '<label class="sp-plan-manual__lbl">시작<select id="sp-quick-lec-from" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="시작 회차"></select></label>' +
    '<label class="sp-plan-manual__lbl">끝<select id="sp-quick-lec-to" class="sp-plan-manual__select sp-plan-manual__control--fit" data-sp-fit-ph="끝 회차"></select></label>' +
    '</div>' +
    '<div class="sp-plan-quick__applyRow">' +
    '<button type="button" class="btn btn--primary sp-plan-quick__apply" id="sp-quick-apply">이 달에 반영</button>' +
    '<button type="button" class="btn btn--ghost sp-plan-quick__clear" id="sp-quick-clear">이 달 추가분 지우기</button>' +
    '</div></div>' +
    '<div class="sp-plan-todoReg__panel sp-plan-todoReg__panel--fixed" id="sp-plan-fixed-reg" aria-label="고정 일정">' +
    '<div class="sp-plan-todoReg__panelHead">' +
    '<span class="sp-plan-todoReg__panelBadge sp-plan-todoReg__panelBadge--fixed" aria-hidden="true">고정</span>' +
    '<div class="sp-plan-todoReg__panelHeadText">' +
    '<h3 class="sp-plan-todoReg__panelTitle">고정 일정</h3>' +
    '<p class="sp-plan-todoReg__panelSub">선택한 기간·요일·시간에 반복됩니다. 해당 시간은 시간표에서 사용할 수 없습니다.</p>' +
    '</div></div>' +
    '<p class="sp-plan-quick__err" id="sp-plan-fixed-err" hidden></p>' +
    '<div class="sp-plan-manual__grid sp-plan-manual__grid--fixedDates">' +
    '<label class="sp-plan-manual__lbl">시작일<input type="date" id="sp-fixed-start-date" class="sp-plan-manual__input" value="' +
    esc(defManDue) +
    '"/></label>' +
    '<label class="sp-plan-manual__lbl">종료일<input type="date" id="sp-fixed-end-date" class="sp-plan-manual__input" value="' +
    esc(defFixedEnd) +
    '"/></label>' +
    '</div>' +
    '<div class="sp-plan-quick__row sp-plan-quick__row--horiz">' +
    '<span class="sp-plan-quick__lbl">요일</span>' +
    '<div class="sp-plan-quick__chks" role="group" aria-label="고정 일정 요일">' +
    '<label class="sp-plan-quick__chk"><input type="checkbox" name="sp-fixed-dow" value="1"/>월</label>' +
    '<label class="sp-plan-quick__chk"><input type="checkbox" name="sp-fixed-dow" value="2"/>화</label>' +
    '<label class="sp-plan-quick__chk"><input type="checkbox" name="sp-fixed-dow" value="3"/>수</label>' +
    '<label class="sp-plan-quick__chk"><input type="checkbox" name="sp-fixed-dow" value="4"/>목</label>' +
    '<label class="sp-plan-quick__chk"><input type="checkbox" name="sp-fixed-dow" value="5"/>금</label>' +
    '<label class="sp-plan-quick__chk"><input type="checkbox" name="sp-fixed-dow" value="6"/>토</label>' +
    '<label class="sp-plan-quick__chk"><input type="checkbox" name="sp-fixed-dow" value="0"/>일</label>' +
    '</div></div>' +
    '<div class="sp-plan-fixed__nameRow">' +
    '<label class="sp-plan-fixed__nameLbl"><span class="sp-plan-quick__lbl">일정 이름</span>' +
    '<input type="text" id="sp-fixed-title" class="sp-plan-manual__input" maxlength="200" placeholder="예: 학원 수업" autocomplete="off"/></label>' +
    '</div>' +
    '<div class="sp-plan-quick__row sp-plan-quick__row--horiz">' +
    '<span class="sp-plan-quick__lbl">시간</span>' +
    '<div class="sp-plan-fixed__timeSelects">' +
    '<label class="sp-plan-fixed__timeLbl">시작<select id="sp-fixed-start" class="sp-plan-manual__select">' +
    fixedTimeOptsStart +
    '</select></label>' +
    '<label class="sp-plan-fixed__timeLbl">끝<select id="sp-fixed-end" class="sp-plan-manual__select">' +
    fixedTimeOptsEnd +
    '</select></label>' +
    '</div></div>' +
    '<div class="sp-plan-fixed__applyRow">' +
    '<button type="button" class="btn btn--primary" id="sp-fixed-apply">이 달에 반영</button>' +
    '</div></div>' +
    '<div class="sp-plan-quick__postPreview sp-plan-todoReg__postPreview">' +
    '<div class="sp-plan-quick__postActions">' +
    '<button type="button" class="btn btn--primary" id="sp-plan-todos-apply">일정 저장하기</button>' +
    '<span class="sp-plan-quick__applyMsg" id="sp-plan-todos-apply-msg" hidden></span>' +
    '</div>' +
    '<pre class="sp-plan-quick__postPre" id="sp-plan-post-preview" hidden aria-hidden="true"></pre>' +
    '</div></div></section>' +
    '<div class="sp-plan-month" id="sp-plan-month-wrap">' +
    '<div class="sp-plan-month__head">' +
    '<button type="button" class="btn btn--ghost sp-plan-month__nav" data-nav="-1" aria-label="이전 달">‹</button>' +
    '<div class="sp-plan-month__title">' +
    ym(st.viewMonth) +
    '</div>' +
    '<button type="button" class="btn btn--ghost sp-plan-month__nav" data-nav="1" aria-label="다음 달">›</button>' +
    '</div>' +
    '<div class="sp-plan-month__actions" role="group" aria-label="월간 일정 저장·삭제">' +
    '<button type="button" class="btn btn--primary" id="sp-plan-month-save">일정 저장하기</button>' +
    '<button type="button" class="btn btn--ghost" id="sp-plan-month-clear">일정 전체 삭제하기</button>' +
    '<span class="sp-plan-month__applyMsg" id="sp-plan-month-apply-msg" hidden></span>' +
    '</div>' +
    '<div class="sp-plan-month__dow" role="row" aria-label="요일">' +
    '<div class="sp-plan-month__dowCorner" aria-hidden="true">주간 안내</div>' +
    '<div class="sp-plan-month__dowCell is-sun">SUN</div>' +
    '<div class="sp-plan-month__dowCell">MON</div>' +
    '<div class="sp-plan-month__dowCell">TUE</div>' +
    '<div class="sp-plan-month__dowCell">WED</div>' +
    '<div class="sp-plan-month__dowCell">THU</div>' +
    '<div class="sp-plan-month__dowCell">FRI</div>' +
    '<div class="sp-plan-month__dowCell is-sat">SAT</div>' +
    '</div>' +
    '<div class="sp-plan-month__grid" role="grid" aria-label="월간 달력"></div>' +
    '<div class="sp-plan-month__loading" id="sp-plan-month-loading" hidden role="status" aria-live="polite">' +
    '<div class="sp-plan-month__loadingBox" aria-hidden="true"><span class="sp-plan-month__loadingSpinner"></span></div>' +
    '<span class="sp-plan-month__loadingText">일정 불러오는 중…</span></div>' +
    '<nav id="sp-plan-calendar-ctx-menu" class="sp-plan-todoCtx sp-plan-calendarCtx" hidden role="menu" aria-label="달력 메뉴">' +
    '<button type="button" class="sp-plan-todoCtx__btn" data-sp-ctx-action="register" role="menuitem">일정 등록</button>' +
    '<button type="button" class="sp-plan-todoCtx__btn" data-sp-ctx-action="event-register" role="menuitem">이벤트 등록</button>' +
    '<button type="button" class="sp-plan-todoCtx__btn" data-sp-ctx-action="event-delete" role="menuitem" hidden>이벤트 삭제</button>' +
    '<button type="button" class="sp-plan-todoCtx__btn" data-sp-ctx-action="delete" role="menuitem" hidden>삭제</button>' +
    '<button type="button" class="sp-plan-todoCtx__btn" data-sp-ctx-action="delete-trace" role="menuitem" hidden>흔적 삭제</button>' +
    '</nav>' +
    '</div></div>';

  renderMonth_();

  plannerSetFixedTimelineSelectDefaults_(
    slot.querySelector('#sp-fixed-start'),
    slot.querySelector('#sp-fixed-end')
  );

  plannerEnsureCalRegModal_(root, fixedTimeOptsStart, fixedTimeOptsEnd);
  plannerEnsureEventRegModal_(root);
  plannerQuickCurriculumRefreshCascade_(slot, st, 'all');
  plannerControlFitSyncWidthsIn_(slot);
  plannerQuickSyncDowCountInputs_(slot);

  if (!slot.__spPlanCalWired) {
    slot.__spPlanCalWired = true;
    slot.addEventListener('click', function (e) {
      const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
      if (!t) return;
      const ctxReg = t.closest ? t.closest('[data-sp-ctx-action="register"]') : null;
      if (ctxReg && slot.__spPlanCtxMenu && slot.__spPlanCtxMenu.ymd) {
        e.preventDefault();
        e.stopPropagation();
        plannerOpenCalRegModal_(root, slot.__spPlanCtxMenu.ymd);
        plannerHideTodoContextMenu_(slot);
        return;
      }
      const ctxEventReg = t.closest ? t.closest('[data-sp-ctx-action="event-register"]') : null;
      if (ctxEventReg && slot.__spPlanCtxMenu && slot.__spPlanCtxMenu.ymd) {
        e.preventDefault();
        e.stopPropagation();
        plannerOpenEventRegModal_(root, slot.__spPlanCtxMenu.ymd);
        plannerHideTodoContextMenu_(slot);
        return;
      }
      const ctxEventDel = t.closest ? t.closest('[data-sp-ctx-action="event-delete"]') : null;
      if (ctxEventDel && slot.__spPlanCtxMenu && slot.__spPlanCtxMenu.hasEvents && slot.__spPlanCtxMenu.ymd) {
        e.preventDefault();
        e.stopPropagation();
        void plannerDeleteAllEventsForDay_(root, slot.__spPlanCtxMenu.ymd);
        return;
      }
      const ctxDel = t.closest ? t.closest('[data-sp-ctx-action="delete"]') : null;
      const ctxTraceDel = t.closest ? t.closest('[data-sp-ctx-action="delete-trace"]') : null;
      if ((ctxDel || ctxTraceDel) && slot.__spPlanCtxMenu) {
        e.preventDefault();
        e.stopPropagation();
        const pending = slot.__spPlanCtxMenu;
        if (pending.isTrace && pending.taskIds.length) {
          plannerDeleteTraceFromCalendar_(root, pending.taskIds[0], pending.traceYmd || pending.ymd);
        } else if (pending.taskIds && pending.taskIds.length) {
          void plannerDeleteTodosFromCalendar_(root, pending.ymd, pending.taskIds.slice());
        }
        return;
      }
      const ctxMenuEl = slot.querySelector('#sp-plan-calendar-ctx-menu');
      if (ctxMenuEl && !ctxMenuEl.hasAttribute('hidden') && !t.closest('#sp-plan-calendar-ctx-menu')) {
        plannerHideTodoContextMenu_(slot);
      }
      const quickToggle = t.id === 'sp-quick-toggle' ? t : t.closest ? t.closest('#sp-quick-toggle') : null;
      if (quickToggle) {
        const sec = slot.querySelector('#sp-plan-quick-reg');
        const btn = slot.querySelector('#sp-quick-toggle');
        if (sec && btn) {
          const nowCollapsed = sec.classList.toggle('is-collapsed');
          st.quickRegCollapsed = nowCollapsed;
          btn.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
          if (!nowCollapsed) {
            const bodyEl = sec.querySelector('#sp-plan-todo-reg-body');
            if (bodyEl instanceof HTMLElement) {
              bodyEl.scrollTop = 0;
              requestAnimationFrame(function () {
                bodyEl.scrollTop = 0;
              });
            }
          }
        }
        return;
      }
      const quickApply = t.id === 'sp-quick-apply' ? t : t.closest ? t.closest('#sp-quick-apply') : null;
      const quickClear = t.id === 'sp-quick-clear' ? t : t.closest ? t.closest('#sp-quick-clear') : null;
      if (quickApply || quickClear) {
        const errEl = slot.querySelector('#sp-plan-quick-err');
        const qr = slot.querySelector('#sp-plan-quick-reg');
        if (quickApply && qr) {
          if (errEl) {
            errEl.textContent = '';
            errEl.setAttribute('hidden', 'hidden');
          }
          const weekdays = [];
          qr.querySelectorAll('input[name="sp-dow"]:checked').forEach(function (cb) {
            weekdays.push(Number(/** @type {HTMLInputElement} */ (cb).value));
          });
          const courseEl = slot.querySelector('#sp-quick-course');
          const fromEl = slot.querySelector('#sp-quick-lec-from');
          const toEl = slot.querySelector('#sp-quick-lec-to');
          const startEl = slot.querySelector('#sp-quick-start-date');
          const courseId =
            courseEl && 'value' in courseEl ? String(/** @type {HTMLSelectElement} */ (courseEl).value).trim() : '';
          const fromL = fromEl && 'value' in fromEl ? Number(/** @type {HTMLSelectElement} */ (fromEl).value) : 1;
          const toL = toEl && 'value' in toEl ? Number(/** @type {HTMLSelectElement} */ (toEl).value) : 1;
          const countByDow = plannerQuickReadCountByDow_(slot);
          const startDate =
            startEl && 'value' in startEl ? String(/** @type {HTMLInputElement} */ (startEl).value).trim() : '';
          const msg = plannerApplyQuickCurriculumToMonthTodos_(
            st,
            st.viewMonth,
            weekdays,
            courseId,
            fromL,
            toL,
            countByDow,
            startDate
          );
          if (msg) {
            if (errEl) {
              errEl.textContent = msg;
              errEl.removeAttribute('hidden');
            }
            return;
          }
          plannerRefreshPostPreview_(root);
          renderMonth_();
          const modal = root.querySelector('#sp-plan-day-modal');
          if (modal && st.selectedDate && !modal.hasAttribute('hidden')) {
            if (st.dayTimelineTodoByDate) {
              try {
                delete st.dayTimelineTodoByDate[st.selectedDate];
              } catch (_e) {
                st.dayTimelineTodoByDate[st.selectedDate] = {};
              }
            }
            openDayModal_(st.selectedDate);
          }
        }
        if (quickClear) {
          plannerClearQuickPlanForMonth_(st, st.viewMonth);
          plannerRefreshPostPreview_(root);
          renderMonth_();
          if (errEl) {
            errEl.textContent = '';
            errEl.setAttribute('hidden', 'hidden');
          }
          const modal = root.querySelector('#sp-plan-day-modal');
          if (modal && st.selectedDate && !modal.hasAttribute('hidden')) {
            if (st.dayTimelineTodoByDate) {
              try {
                delete st.dayTimelineTodoByDate[st.selectedDate];
              } catch (_e) {
                st.dayTimelineTodoByDate[st.selectedDate] = {};
              }
            }
            openDayModal_(st.selectedDate);
          }
        }
        return;
      }
      const fixedApply = t.id === 'sp-fixed-apply' ? t : t.closest ? t.closest('#sp-fixed-apply') : null;
      if (fixedApply) {
        const errF = slot.querySelector('#sp-plan-fixed-err');
        const box = slot.querySelector('#sp-plan-fixed-reg');
        if (errF) {
          errF.textContent = '';
          errF.setAttribute('hidden', 'hidden');
        }
        const titleEl = slot.querySelector('#sp-fixed-title');
        const startEl = slot.querySelector('#sp-fixed-start');
        const endEl = slot.querySelector('#sp-fixed-end');
        const fixedStartDateEl = slot.querySelector('#sp-fixed-start-date');
        const fixedEndDateEl = slot.querySelector('#sp-fixed-end-date');
        const title =
          titleEl && 'value' in titleEl ? String(/** @type {HTMLInputElement} */ (titleEl).value).trim() : '';
        const weekdays = [];
        if (box) {
          box.querySelectorAll('input[name="sp-fixed-dow"]:checked').forEach(function (cb) {
            weekdays.push(Number(/** @type {HTMLInputElement} */ (cb).value));
          });
        }
        const sIx = startEl && 'value' in startEl ? String(/** @type {HTMLSelectElement} */ (startEl).value) : '';
        const eIx = endEl && 'value' in endEl ? String(/** @type {HTMLSelectElement} */ (endEl).value) : '';
        const fixedStartDate =
          fixedStartDateEl && 'value' in fixedStartDateEl
            ? String(/** @type {HTMLInputElement} */ (fixedStartDateEl).value).trim()
            : '';
        const fixedEndDate =
          fixedEndDateEl && 'value' in fixedEndDateEl
            ? String(/** @type {HTMLInputElement} */ (fixedEndDateEl).value).trim()
            : '';
        const msg = plannerApplyFixedScheduleForMonth_(
          st,
          st.viewMonth,
          weekdays,
          title,
          Number(sIx),
          Number(eIx),
          fixedStartDate,
          fixedEndDate
        );
        if (errF) {
          if (msg) {
            errF.textContent = msg;
            errF.removeAttribute('hidden');
          } else {
            errF.textContent = '';
            errF.setAttribute('hidden', 'hidden');
          }
        }
        plannerRefreshPostPreview_(root);
        renderMonth_();
        const modalF = root.querySelector('#sp-plan-day-modal');
        if (modalF && st.selectedDate && !modalF.hasAttribute('hidden')) {
          if (st.dayTimelineTodoByDate) {
            try {
              delete st.dayTimelineTodoByDate[st.selectedDate];
            } catch (_e) {
              st.dayTimelineTodoByDate[st.selectedDate] = {};
            }
          }
          openDayModal_(st.selectedDate);
        }
        return;
      }
      const modeDirect =
        t.id === 'sp-manual-mode-direct' ? t : t.closest ? t.closest('#sp-manual-mode-direct') : null;
      const modeCurr =
        t.id === 'sp-manual-mode-curriculum' ? t : t.closest ? t.closest('#sp-manual-mode-curriculum') : null;
      if (modeDirect) {
        plannerSetManualRegMode_(slot, st, 'direct');
        return;
      }
      if (modeCurr) {
        plannerSetManualRegMode_(slot, st, 'curriculum');
        return;
      }
      const manualAdd = t.id === 'sp-manual-add' ? t : t.closest ? t.closest('#sp-manual-add') : null;
      if (manualAdd) {
        const errM = slot.querySelector('#sp-plan-manual-err');
        const msg = plannerAppendManualTodoFromForm_(slot, st);
        if (errM) {
          if (msg) {
            errM.textContent = msg;
            errM.removeAttribute('hidden');
          } else {
            errM.textContent = '';
            errM.setAttribute('hidden', 'hidden');
          }
        }
        plannerRefreshPostPreview_(root);
        renderMonth_();
        const modal2 = root.querySelector('#sp-plan-day-modal');
        if (modal2 && st.selectedDate && !modal2.hasAttribute('hidden')) {
          openDayModal_(st.selectedDate);
        }
        return;
      }
      const currAdd = t.id === 'sp-curr-add' ? t : t.closest ? t.closest('#sp-curr-add') : null;
      if (currAdd) {
        const errC = slot.querySelector('#sp-plan-curr-err');
        const msgC = plannerAppendCurriculumTodoFromForm_(slot, st);
        if (errC) {
          if (msgC) {
            errC.textContent = msgC;
            errC.removeAttribute('hidden');
          } else {
            errC.textContent = '';
            errC.setAttribute('hidden', 'hidden');
          }
        }
        plannerRefreshPostPreview_(root);
        renderMonth_();
        const modalC = root.querySelector('#sp-plan-day-modal');
        if (modalC && st.selectedDate && !modalC.hasAttribute('hidden')) {
          openDayModal_(st.selectedDate);
        }
        return;
      }
      const nav = t.closest ? t.closest('[data-nav]') : null;
      if (nav && nav.getAttribute) {
        if (plannerIsPlanDemoRoot_(root)) {
          return;
        }
        const step = Number(nav.getAttribute('data-nav')) || 0;
        if (step) {
          plannerFlushMonthlyNoticeDraft_(root);
          st.viewMonth = new Date(st.viewMonth.getFullYear(), st.viewMonth.getMonth() + step, 1);
          renderMonth_();
          void plannerRefetchBootstrapForViewMonth_(root);
        }
        return;
      }
      const weekCurBtn = t.closest ? t.closest('[data-sp-open-week-cur]') : null;
      if (weekCurBtn instanceof HTMLElement) {
        e.preventDefault();
        e.stopPropagation();
        const wi = Number(weekCurBtn.getAttribute('data-sp-open-week-cur'));
        openWeekCurModal_(wi);
        return;
      }
      const memoOpen = t.closest ? t.closest('[data-sp-open-memo]') : null;
      if (memoOpen) {
        e.preventDefault();
        e.stopPropagation();
        const dayBtn = t.closest('.sp-plan-day');
        const key = dayBtn && dayBtn.getAttribute ? dayBtn.getAttribute('data-ymd') || '' : '';
        if (key) {
          if (plannerIsPlanMobile_(root)) {
            openDayPeekModal_(key);
          } else {
            openDayModal_(key);
            requestAnimationFrame(function () {
              const ta = root.querySelector('#sp-plan-day-memo');
              if (ta instanceof HTMLTextAreaElement) ta.focus();
            });
          }
        }
        return;
      }
      const btn = t.closest ? t.closest('.sp-plan-day') : null;
      if (btn && btn.getAttribute && !btn.hasAttribute('disabled')) {
        const key = btn.getAttribute('data-ymd') || '';
        if (key) {
          if (plannerIsPlanMobile_(root)) {
            openDayPeekModal_(key);
          } else {
          openDayModal_(key);
          }
        }
      }
    });
    slot.addEventListener('change', function (e) {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.name === 'sp-dow') {
        plannerQuickSyncDowCountInputs_(slot);
        return;
      }
      if (!(t instanceof HTMLSelectElement)) return;
      const id = t.id || '';
      if (id === 'sp-curr-subj') {
        plannerCurriculumRefreshCascade_(slot, st, 'subject');
      } else if (id === 'sp-curr-instructor') {
        plannerCurriculumRefreshCascade_(slot, st, 'instructor');
      } else if (id === 'sp-curr-course') {
        plannerCurriculumRefreshCascade_(slot, st, 'course');
      } else if (id === 'sp-curr-lecture') {
        plannerCurriculumRefreshCascade_(slot, st, 'preview');
      } else if (id === 'sp-quick-subj') {
        plannerQuickCurriculumRefreshCascade_(slot, st, 'subject');
      } else if (id === 'sp-quick-instructor') {
        plannerQuickCurriculumRefreshCascade_(slot, st, 'instructor');
      } else if (id === 'sp-quick-course') {
        plannerQuickCurriculumRefreshCascade_(slot, st, 'course');
      } else if (id === 'sp-quick-lec-from' || id === 'sp-quick-lec-to') {
        plannerControlFitSyncWidth_(t);
      }
    });
    slot.addEventListener('contextmenu', function (e) {
      if (!root.__spPlanAdminMode) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (!t) return;
      const dayBtn = t.closest('.sp-plan-day');
      if (!dayBtn || dayBtn.hasAttribute('disabled')) return;
      const ymdKey = dayBtn.getAttribute('data-ymd') || '';
      if (!ymdKey) return;
      const hit = t.closest('[data-sp-task-id]') || t.closest('[data-sp-task-ids]');
      /** @type {string[]} */
      let ids = [];
      let isTrace = false;
      let traceYmd = ymdKey;
      if (hit && hit instanceof HTMLElement) {
        ids = plannerResolveTodoIdsFromContextTarget_(hit);
        isTrace = hit.getAttribute('data-sp-trace') === '1';
        traceYmd = hit.getAttribute('data-sp-trace-ymd') || ymdKey;
      }
      e.preventDefault();
      const dayEvents = plannerEventsForDay_(st, ymdKey);
      slot.__spPlanCtxMenu = {
        ymd: ymdKey,
        taskIds: ids,
        isTrace: isTrace,
        traceYmd: traceYmd,
        hasEvents: dayEvents.length > 0
      };
      plannerUpdateCalendarCtxMenuLabels_(slot, slot.__spPlanCtxMenu);
      const menu = slot.querySelector('#sp-plan-calendar-ctx-menu');
      if (!(menu instanceof HTMLElement)) return;
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      menu.removeAttribute('hidden');
    });

    slot.addEventListener('dragstart', function (e) {
      if (!root.__spPlanAdminMode) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (!t) return;
      const chip = t.closest('[data-sp-draggable-todo="1"]');
      if (!chip || !(chip instanceof HTMLElement)) return;
      if (chip.getAttribute('data-sp-trace') === '1') return;
      const dayBtn = chip.closest('.sp-plan-day');
      if (!dayBtn || dayBtn.hasAttribute('disabled')) return;
      const fromYmd = dayBtn.getAttribute('data-ymd') || '';
      const taskId = chip.getAttribute('data-sp-task-id') || '';
      if (!fromYmd || !taskId) return;
      const stD = root.__spPlanState;
      const rowD = stD ? plannerFindMonthTodoByTaskId_(stD, taskId) : null;
      if (!rowD || !plannerTodoCanDrag_(rowD) || String(rowD.date || '').trim() !== fromYmd) {
        e.preventDefault();
        return;
      }
      slot.__spPlanDragPayload = { taskId: taskId, fromYmd: fromYmd };
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', taskId + '|' + fromYmd);
      }
      chip.classList.add('is-dragging');
      e.stopPropagation();
    });

    slot.addEventListener('dragend', function (e) {
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t) {
        const chip = t.closest('[data-sp-draggable-todo="1"]');
        if (chip instanceof HTMLElement) chip.classList.remove('is-dragging');
      }
      slot.querySelectorAll('.sp-plan-day.is-drag-over').forEach(function (el) {
        el.classList.remove('is-drag-over');
      });
      slot.__spPlanDragPayload = null;
    });

    slot.addEventListener('dragover', function (e) {
      if (!root.__spPlanAdminMode || !slot.__spPlanDragPayload) return;
      const dayBtn = e.target instanceof HTMLElement ? e.target.closest('.sp-plan-day:not([disabled])') : null;
      if (!dayBtn) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      slot.querySelectorAll('.sp-plan-day.is-drag-over').forEach(function (el) {
        if (el !== dayBtn) el.classList.remove('is-drag-over');
      });
      dayBtn.classList.add('is-drag-over');
    });

    slot.addEventListener('dragleave', function (e) {
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (!t) return;
      const dayBtn = t.closest('.sp-plan-day');
      if (dayBtn && !dayBtn.contains(/** @type {Node} */ (e.relatedTarget))) {
        dayBtn.classList.remove('is-drag-over');
      }
    });

    slot.addEventListener('drop', function (e) {
      if (!root.__spPlanAdminMode) return;
      const payload = slot.__spPlanDragPayload;
      if (!payload) return;
      const dayBtn = e.target instanceof HTMLElement ? e.target.closest('.sp-plan-day:not([disabled])') : null;
      if (!dayBtn) return;
      e.preventDefault();
      e.stopPropagation();
      dayBtn.classList.remove('is-drag-over');
      const toYmd = dayBtn.getAttribute('data-ymd') || '';
      const stDrop = root.__spPlanState;
      if (!stDrop || !toYmd) return;
      const errEl = slot.querySelector('#sp-plan-month-apply-msg');
      const msg = plannerMoveMonthTodoByDrag_(stDrop, payload.taskId, payload.fromYmd, toYmd);
      if (msg) {
        if (errEl) {
          errEl.textContent = msg;
          errEl.removeAttribute('hidden');
        }
      } else if (errEl) {
        errEl.textContent = '';
        errEl.setAttribute('hidden', 'hidden');
      }
      plannerRefreshPostPreview_(root);
      renderMonth_();
      const modalDrop = root.querySelector('#sp-plan-day-modal');
      if (modalDrop && stDrop.selectedDate && !modalDrop.hasAttribute('hidden')) {
        if (typeof root.__spPlanRefreshOpenDayModal === 'function') {
          root.__spPlanRefreshOpenDayModal();
        }
      }
      slot.__spPlanDragPayload = null;
    });
  }

  root.__spPlanRerenderMonth = renderMonth_;
  root.__spPlanRefreshOpenDayModal = function () {
    const m = root.querySelector('#sp-plan-day-modal');
    if (m && st.selectedDate && !m.hasAttribute('hidden')) {
      openDayModal_(st.selectedDate);
    }
  };

  if (!root.__spPlanMobileMqWired) {
    root.__spPlanMobileMqWired = true;
    try {
      const mq = window.matchMedia(PLAN_MOBILE_MQ);
      mq.addEventListener('change', function () {
        closeWeekCurModal_();
        closeDayPeekModal_();
        renderMonth_();
      });
    } catch (_mqErr) {
      /* matchMedia 미지원 */
    }
  }

  plannerApplyPlanMobileCalHint_(root);
  plannerApplyAdminVisibility_(root);
}

/**
 * @param {HTMLElement} root
 */
function wireGate_(root) {
  const btn = root.querySelector('#sp-plan-gate-submit');
  const errEl = root.querySelector('#sp-plan-gate-err');
  const nameInput = root.querySelector('#sp-plan-name');
  const gate = root.querySelector('.sp-plan-gate');
  const appMain = root.querySelector('#sp-plan-app-main');
  if (!btn || !gate || !appMain) return;

  wirePlanPhoneDigitsOnly_(root);

  const statusEl = root.querySelector('#sp-plan-gate-status');
  const phoneInputs = [
    root.querySelector('#sp-plan-p0'),
    root.querySelector('#sp-plan-p1'),
    root.querySelector('#sp-plan-p2')
  ];

  function showErr(msg) {
    if (!errEl) return;
    if (msg) {
      errEl.textContent = msg;
      errEl.removeAttribute('hidden');
    } else {
      errEl.textContent = '';
      errEl.setAttribute('hidden', 'hidden');
    }
  }

  /**
   * @param {boolean} on
   * @param {string} [statusText]
   */
  function setGateLoading_(on, statusText) {
    const msg = String(statusText != null ? statusText : '').trim();
    if (on) {
      root.classList.add('is-plan-gate-loading');
      gate.setAttribute('aria-busy', 'true');
      btn.setAttribute('disabled', 'disabled');
      if (msg) {
        btn.textContent = msg;
      }
      if (nameInput instanceof HTMLInputElement) {
        nameInput.disabled = true;
      }
      phoneInputs.forEach(function (inp) {
        if (inp instanceof HTMLInputElement) {
          inp.disabled = true;
        }
      });
      if (statusEl) {
        statusEl.textContent = msg || '처리 중…';
        statusEl.removeAttribute('hidden');
        statusEl.setAttribute('aria-busy', 'true');
      }
    } else {
      root.classList.remove('is-plan-gate-loading');
      gate.setAttribute('aria-busy', 'false');
      btn.removeAttribute('disabled');
      btn.textContent = '확인';
      if (nameInput instanceof HTMLInputElement) {
        nameInput.disabled = false;
      }
      phoneInputs.forEach(function (inp) {
        if (inp instanceof HTMLInputElement) {
          inp.disabled = false;
        }
      });
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.setAttribute('hidden', 'hidden');
        statusEl.setAttribute('aria-busy', 'false');
      }
    }
  }

  async function runBootstrap(memberCode, segs, name) {
    plannerClearProfileDirty_(root);
    root.__spPlanMonthlyNoticesInitial = {};
    root.__spPlannerBootstrapCtx = {
      memberCode: memberCode || '',
      phoneSegments: Array.isArray(segs)
        ? segs.map(function (s) {
            return String(s != null ? s : '');
          })
        : ['', '', ''],
      name: name || ''
    };
    const stPre = root.__spPlanState;
    const ymDate =
      stPre && stPre.viewMonth instanceof Date && !isNaN(stPre.viewMonth.getTime())
        ? stPre.viewMonth
        : new Date();
    const boot = await plannerGasCall_({
      action: 'plannerBootstrap',
      phoneSegments: segs,
      name: name || '',
      memberCode: memberCode || '',
      year_month: plannerYearMonthFromDate_(ymDate)
    });
    if (!boot || !boot.ok) {
      const m = boot && boot.error && boot.error.message != null ? String(boot.error.message) : '일정을 불러오지 못했습니다.';
      showErr(m);
      return;
    }
    const d = /** @type {{ role?: string, common?: object[], personal?: object[] | null, student_profile?: Record<string, unknown>, curriculum_version?: string }} */ (
      boot.data || {}
    );
    const cv = d.curriculum_version != null ? String(d.curriculum_version).trim() : '';
    setGateLoading_(true, '커리큘럼 불러오는 중…');
    const curPack = await plannerFetchCurriculumPack_(cv);
    setGateLoading_(false);
    gate.setAttribute('hidden', 'hidden');
    gate.setAttribute('aria-hidden', 'true');
    plannerRevealPlanMain_(root);
    /** @type {{ role: string, common: object[], personal: object[] | null, curriculum?: unknown }} */
    const bootRender = {
      role: d.role || 'guest',
      common: d.common || [],
      personal: d.personal != null ? d.personal : null
    };
    if (curPack) {
      bootRender.curriculum = curPack.curriculum;
    }
    renderCalendar_(root, bootRender);
    renderPlannerStudentProfile_(root, d.student_profile);
  }

  btn.addEventListener('click', async function () {
    showErr('');
    const p0 = /** @type {HTMLInputElement | null} */ (root.querySelector('#sp-plan-p0'));
    const p1 = /** @type {HTMLInputElement | null} */ (root.querySelector('#sp-plan-p1'));
    const p2 = /** @type {HTMLInputElement | null} */ (root.querySelector('#sp-plan-p2'));
    const segs = readPhoneSegments_([p0 && p0.value, p1 && p1.value, p2 && p2.value]);
    if (segs[0].length !== 3 || segs[1].length !== 4 || segs[2].length !== 4) {
      showErr('휴대전화를 11자리(앞 3 · 가운데 4 · 끝 4) 숫자로만 입력해 주세요.');
      if (p0 && segs[0].length < 3) p0.focus();
      else if (p1 && segs[1].length < 4) p1.focus();
      else if (p2) p2.focus();
      return;
    }
    const name = nameInput ? String(nameInput.value || '').trim() : '';

    setGateLoading_(true, '등록 여부 확인 중…');
    try {
    const res = await plannerGasCall_({
      action: 'plannerMatch',
      phoneSegments: segs,
      name: name
    });
    if (!res || !res.ok) {
      const m = res && res.error && res.error.message != null ? String(res.error.message) : '확인에 실패했습니다.';
      showErr(m);
      return;
    }
      const data = /** @type {{ outcome?: string, needName?: boolean, link_key?: string | null, memberCode?: string | null }} */ (
        res.data || {}
      );
    const oc = String(data.outcome || '');
    if (oc === 'need_name') {
      if (nameInput) {
        nameInput.focus();
      }
      showErr('같은 번호로 등록된 분이 여러 명입니다. 이름을 입력한 뒤 다시 확인을 눌러 주세요.');
      return;
    }
    const linkKey =
      data.link_key != null && String(data.link_key).trim()
        ? String(data.link_key).trim()
        : data.memberCode != null && String(data.memberCode).trim()
          ? String(data.memberCode).trim()
          : '';
    setGateLoading_(true, '플래너 불러오는 중…');
    if (oc === 'matched' && linkKey) {
      await runBootstrap(linkKey, segs, name);
      return;
    }
    // no_match 등 — 공통 일정만 보는 guest
    await runBootstrap('', segs, name);
    } finally {
      setGateLoading_(false);
    }
  });
}

/**
 * @param {HTMLElement} root
 * @param {boolean} on
 * @param {string} [title]
 * @param {string} [sub]
 */
function setPlanSyncOverlay_(root, on, title, sub) {
  const el = root.querySelector('#sp-plan-sync-overlay');
  const tEl = root.querySelector('#sp-plan-sync-overlay-title');
  const sEl = root.querySelector('#sp-plan-sync-overlay-desc');
  if (tEl && title) {
    tEl.textContent = title;
  }
  if (sEl && sub) {
    sEl.textContent = sub;
  }
  if (on) {
    root.classList.add('is-plan-syncing');
    root.setAttribute('aria-busy', 'true');
    if (el) {
      el.removeAttribute('hidden');
      el.setAttribute('aria-hidden', 'false');
    }
  } else {
    root.classList.remove('is-plan-syncing');
    root.removeAttribute('aria-busy');
    if (el) {
      el.setAttribute('hidden', '');
      el.setAttribute('aria-hidden', 'true');
    }
  }
}

/**
 * @param {HTMLElement} root
 */
function wirePlanDevBar_(root) {
  const msg = root.querySelector('#sp-plan-dev-msg');
  const skipBtn = root.querySelector('#sp-plan-dev-skip-gate');
  const initBtn = root.querySelector('#sp-plan-dev-init');
  const syncBtn = root.querySelector('#sp-plan-dev-sync');
  if (!skipBtn || !initBtn || !syncBtn) return;

  function showDevMsg(text) {
    if (msg) msg.textContent = text || '';
  }

  skipBtn.addEventListener('click', function () {
    if (root.__spPlanSyncBusy) return;
    showDevMsg('제작용: 게이트 생략 · GAS 없이 원페이지만 표시');
    const gate = root.querySelector('.sp-plan-gate');
    const appMain = root.querySelector('#sp-plan-app-main');
    if (gate) {
      gate.setAttribute('hidden', 'hidden');
      gate.setAttribute('aria-hidden', 'true');
    }
    plannerRevealPlanMain_(root);
    renderCalendar_(root, { role: 'guest', common: [], personal: null });
    renderPlannerStudentProfile_(root, null);
  });

  initBtn.addEventListener('click', async function () {
    if (root.__spPlanSyncBusy) return;
    showDevMsg('');
    const r = await plannerGasCall_({ action: 'initPlannerMasterSheets' });
    if (!r || !r.ok) {
      const m = r && r.error && r.error.message != null ? String(r.error.message) : '마스터 준비에 실패했습니다.';
      showDevMsg(m);
      return;
    }
    const d = /** @type {{ plannerSpreadsheetUrl?: string, createdNew?: boolean, alreadyConfigured?: boolean }} */ (r.data || {});
    const url = d.plannerSpreadsheetUrl != null ? String(d.plannerSpreadsheetUrl) : '';
    let line = '';
    if (d.createdNew) {
      line = '새 플래너 마스터 파일을 만들었습니다.';
    } else if (d.alreadyConfigured) {
      line = '연결된 마스터를 열어 필요한 탭·헤더를 확인했습니다.';
    } else {
      line = '마스터 준비가 완료되었습니다.';
    }
    showDevMsg(line + (url ? ' ' + url : ''));
  });

  syncBtn.addEventListener('click', async function () {
    if (root.__spPlanSyncBusy) return;
    root.__spPlanSyncBusy = true;
    skipBtn.disabled = true;
    initBtn.disabled = true;
    syncBtn.disabled = true;
    showDevMsg('');
    setPlanSyncOverlay_(
      root,
      true,
      '동기화 중',
      '화면을 닫지 마세요. 학생 파일이 많을수록 수 분 걸릴 수 있습니다.'
    );
    try {
      const maxRounds = 8;
      let round = 0;
      let lastProcessed = -1;
      /** @type {Record<string, unknown>} */
      let lastD = {};
      let lastIncomplete = false;
      while (round < maxRounds) {
        round += 1;
        const r = await plannerGasCall_({ action: 'plannerRegistryRebuild' });
        if (!r || !r.ok) {
          const m =
            r && r.error && r.error.message != null ? String(r.error.message) : '동기화에 실패했습니다.';
          showDevMsg(m);
          return;
        }
        lastD = /** @type {Record<string, unknown>} */ (r.data || {});
        lastIncomplete = Boolean(lastD.incomplete);
        const processed = lastD.processed != null ? Number(lastD.processed) : 0;
        const total = lastD.total != null ? Number(lastD.total) : 0;
        if (!lastIncomplete) {
          break;
        }
        if (round > 1 && processed <= lastProcessed) {
          break;
        }
        lastProcessed = processed;
        setPlanSyncOverlay_(
          root,
          true,
          '동기화 이어서 처리 중',
          (total > 0 ? String(processed) + ' / ' + String(total) + '명까지 반영했습니다. ' : '') +
            '화면을 닫지 마세요.'
        );
      }
      const d = lastD;
      let line =
        '동기화 완료. 레지스트리 ' +
        (d.written != null ? d.written : 0) +
        '행' +
        (d.preservedRegistryRows ? ', 수기 유지 ' + d.preservedRegistryRows : '') +
        ', 신규 학생파일 ' +
        (d.provisioned != null ? d.provisioned : 0) +
        ', 재사용 ' +
        (d.reusedStudentFiles != null ? d.reusedStudentFiles : 0) +
        (d.reusedByTitle ? ', 제목 재사용 ' + d.reusedByTitle : '') +
        (d.provisionErrors ? ', 생성 실패 ' + d.provisionErrors : '');
      if (lastIncomplete) {
        const processed = d.processed != null ? Number(d.processed) : 0;
        const total = d.total != null ? Number(d.total) : 0;
        line =
          (total > 0 ? String(processed) + ' / ' + String(total) + '명까지 반영했습니다. ' : '') +
          '시간 제한으로 일부가 남았습니다. 같은 버튼을 한 번 더 눌러 주세요.';
      }
      showDevMsg(line);
    } finally {
      setPlanSyncOverlay_(root, false);
      root.__spPlanSyncBusy = false;
      skipBtn.disabled = false;
      initBtn.disabled = false;
      syncBtn.disabled = false;
    }
  });
}

function main() {
  const el = document.getElementById(MOUNT_ID);
  if (!el) return;
  injectPlanGateFallbackCss_();
  el.innerHTML = `<div class="sp-plan-rootinner">${PLAN_DEV_HTML}${PLAN_APP_SHELL_START}${GATE_HTML}${PLAN_ADMIN_MODAL_HTML}${PLAN_APP_MAIN_AND_CLOSE}</div>`;
  if (PLAN_DEMO.active) {
    el.__spPlanAdminMode = false;
  } else {
    try {
      el.__spPlanAdminMode = sessionStorage.getItem(PLAN_SESSION_ADMIN_KEY) === '1';
    } catch (_e) {
      el.__spPlanAdminMode = false;
    }
  }
  wirePlannerAdminUnlockOnce_(el);
  wirePlannerProfileDirtyTrackingOnce_(el);
  wirePlannerMainTabsOnce_(el);
  wirePlannerManualRegOnce_(el);
  wirePlannerStudentProfileSaveOnce_(el);
  wirePlannerCoachingSubjReadOnce_(el);
  wirePlannerPdfExportOnce_(el);
  wirePlannerPersonalTodosApplyOnce_(el);
  wirePlannerDemoTrackOnce_(el);
  renderPlannerStudentProfile_(el, null);
  wirePlanDevBar_(el);
  plannerApplyAdminVisibility_(el);
  if (PLAN_DEMO.active) {
    el.classList.add('is-plan-demo');
    const gateEarly = el.querySelector('.sp-plan-gate');
    if (gateEarly) {
      gateEarly.setAttribute('hidden', 'hidden');
      gateEarly.setAttribute('aria-hidden', 'true');
    }
    void plannerStartPlanDemo_(el);
    return;
  }
  plannerSetGatePending_(el);
  if (GAS_MODE.useMock) {
    const g = el.querySelector('.sp-plan-gate');
    if (g) {
      g.innerHTML =
        '<p class="sp-plan-gate__err">플래너를 불러올 수 없습니다. 잠시 후 다시 시도하거나 담당자에게 문의해 주세요.</p>';
    }
    return;
  }
  wireGate_(el);
}

main();
