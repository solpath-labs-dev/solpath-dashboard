import { GAS_BASE_URL, GAS_MODE } from './config.js';

/**
 * @param {string} baseUrl
 * @param {string} action
 * @param {number} timeoutMs
 * @returns {Promise<Object>}
 */
function gasJsonp_(baseUrl, action, timeoutMs) {
  return gasJsonpWithParams_(baseUrl, action, null, timeoutMs);
}

/**
 * @param {string} baseUrl
 * @param {string} action
 * @param {Object<string, string>|null} extraParams
 * @param {number} timeoutMs
 * @returns {Promise<Object>}
 */
function gasJsonpWithParams_(baseUrl, action, extraParams, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const cb =
      '_solpath_jp_' + String(Date.now()) + '_' + String(Math.floor(Math.random() * 1e9));
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
    g[cb] = function (/** @type {object} */ data) {
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
 * @param {string} v
 * @returns {string}
 */
function ymdFromDateTime_(v) {
  const s = String(v != null ? v : '').trim();
  if (!s) {
    return '';
  }
  const m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  }
  return s.slice(0, 10).replace(/[./]/g, '-');
}

const STU_CAT_LABEL = {
  solpass: '솔패스',
  solutine: '솔루틴',
  challenge: '챌린지'
};

/** @type {Array<Record<string, string>>} */
let _dateEditorRows = [];
/** @type {'none'|'asc'|'desc'} */
let _dateSortStart = 'none';
/** @type {'none'|'asc'|'desc'} */
let _dateSortEnd = 'none';

/**
 * @param {string} c
 * @returns {string}
 */
function stuCatLabel_(c) {
  const k = String(c || '').trim().toLowerCase();
  return STU_CAT_LABEL[k] || k || '-';
}

/**
 * @param {HTMLElement | null} mount
 * @param {boolean} busy
 * @param {string} title
 * @param {string} sub
 */
function setStuOverlay_(mount, busy, title, sub) {
  const el = mount && mount.querySelector('#sp-stu-overlay');
  const tEl = mount && mount.querySelector('#sp-stu-overlay-title');
  const sEl = mount && mount.querySelector('#sp-stu-overlay-desc');
  if (!el) {
    return;
  }
  if (tEl) {
    tEl.textContent = title || '처리 중';
  }
  if (sEl) {
    sEl.textContent = sub || '잠시만 기다려 주세요.';
  }
  if (busy) {
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
  } else {
    el.setAttribute('hidden', '');
    el.setAttribute('aria-hidden', 'true');
  }
}

/**
 * @param {Record<string, unknown>} d
 */
export function applyStudentMgmtStateFromData(mount, d) {
  if (!mount || !d) {
    return;
  }
  const link = /** @type {HTMLAnchorElement | null} */ (mount.querySelector('#sp-stu-linkDrive'));
  const status = /** @type {HTMLElement | null} */ (mount.querySelector('#sp-stu-status'));
  const hint = /** @type {HTMLElement | null} */ (mount.querySelector('#sp-stu-hint'));
  const ready = Boolean(d.studentMgmtReady);
  const url = d.studentMgmtSpreadsheetUrl != null ? String(d.studentMgmtSpreadsheetUrl).trim() : '';
  const mCount = d.studentMemberRowCount != null ? d.studentMemberRowCount : '—';
  const eCount = d.studentEventRowCount != null ? d.studentEventRowCount : '—';
  if (hint) {
    hint.textContent = '';
    hint.setAttribute('hidden', '');
  }
  if (link) {
    if (ready && url) {
      link.href = url;
      link.removeAttribute('hidden');
    } else {
      link.setAttribute('hidden', '');
      link.href = '#';
    }
  }
  if (status) {
    if (!GAS_MODE.canSync) {
      status.textContent = '연결 프로그램이 없어 상태를 불러오지 않습니다.';
    } else if (ready) {
      status.textContent =
        '수강생 DB 연결됨 · 회원 ' + String(mCount) + '명 · 주문 이벤트 ' + String(eCount) + '건';
    } else {
      const reason = d.studentMgmtReason != null ? String(d.studentMgmtReason) : '';
      status.textContent =
        '수강생 DB가 아직 없습니다. 오른쪽 「데이터 초기화」로 파일을 만든 뒤 다시 「상태 새로고침」을 누릅니다.' +
        (reason && reason !== 'NO_STUDENT_SHEET' ? ' (' + reason + ')' : '');
    }
  }
}

/**
 * @param {HTMLElement | null} mount
 */
export function initStudentMgmt(mount) {
  const btnInit = /** @type {HTMLButtonElement | null} */ (mount && mount.querySelector('#sp-stu-btnInit'));
  const btnRefresh = /** @type {HTMLButtonElement | null} */ (mount && mount.querySelector('#sp-stu-btnRefresh'));
  const btnDateLoad = /** @type {HTMLButtonElement | null} */ (mount && mount.querySelector('#sp-stu-btnDateLoad'));
  const btnDateSaveAll = /** @type {HTMLButtonElement | null} */ (mount && mount.querySelector('#sp-stu-btnDateSaveAll'));
  const filterCat = /** @type {HTMLSelectElement | null} */ (mount && mount.querySelector('#sp-stu-dateFilterCat'));
  const sortBtns = mount ? Array.from(mount.querySelectorAll('.sp-stu-sort-btn')) : [];
  if (!mount) {
    return;
  }
  if (!GAS_MODE.canSync || GAS_MODE.useMock) {
    if (btnInit) {
      btnInit.disabled = true;
    }
    if (btnRefresh) {
      btnRefresh.disabled = true;
    }
    if (btnDateLoad) {
      btnDateLoad.disabled = true;
    }
    if (btnDateSaveAll) {
      btnDateSaveAll.disabled = true;
    }
    applyStudentMgmtStateFromData(mount, {});
    return;
  }
  if (btnInit) {
    btnInit.disabled = false;
    btnInit.addEventListener('click', function () {
      void onInitClick_(mount);
    });
  }
  if (btnRefresh) {
    btnRefresh.disabled = false;
    btnRefresh.addEventListener('click', function () {
      void refreshStudentPanel_(mount);
    });
  }
  if (btnDateLoad) {
    btnDateLoad.disabled = false;
    btnDateLoad.addEventListener('click', function () {
      void loadDateEditorList_(mount);
    });
  }
  if (btnDateSaveAll) {
    btnDateSaveAll.disabled = false;
    btnDateSaveAll.addEventListener('click', function () {
      void saveDateEditorAll_(mount);
    });
  }
  if (filterCat) {
    filterCat.addEventListener('change', function () {
      renderDateEditorRows_(mount);
    });
  }
  sortBtns.forEach(function (btnEl) {
    if (!(btnEl instanceof HTMLButtonElement)) {
      return;
    }
    btnEl.addEventListener('click', function () {
      const k = String(btnEl.getAttribute('data-sort-key') || '');
      if (k === 'start') {
        _dateSortStart = _dateSortStart === 'none' ? 'asc' : _dateSortStart === 'asc' ? 'desc' : 'none';
        _dateSortEnd = 'none';
      } else if (k === 'end') {
        _dateSortEnd = _dateSortEnd === 'none' ? 'asc' : _dateSortEnd === 'asc' ? 'desc' : 'none';
        _dateSortStart = 'none';
      }
      renderDateEditorRows_(mount);
    });
  });
}

/**
 * @param {HTMLElement | null} mount
 */
export async function refreshStudentPanel_(mount) {
  const url = String(GAS_BASE_URL).trim();
  const hint = /** @type {HTMLElement | null} */ (mount && mount.querySelector('#sp-stu-hint'));
  if (!url || !mount) {
    return;
  }
  setStuOverlay_(mount, true, '불러오는 중', '수강생 DB 상태를 확인합니다.');
  if (hint) {
    hint.setAttribute('hidden', '');
  }
  try {
    const st = await gasJsonp_(url, 'productMappingState', 90000);
    if (st && st.ok && st.data) {
      applyStudentMgmtStateFromData(mount, st.data);
    } else {
      if (hint) {
        const em =
          st && st.message
            ? String(st.message)
            : st && st.error && st.error.message
              ? String(st.error.message)
              : '';
        hint.textContent = em || '상태를 가져오지 못했습니다.';
        hint.removeAttribute('hidden');
      }
    }
  } catch (e) {
    if (hint) {
      hint.textContent = e && e.message != null ? String(e.message) : '요청 실패';
      hint.removeAttribute('hidden');
    }
  } finally {
    setStuOverlay_(mount, false, '', '');
  }
}

/**
 * @param {HTMLElement | null} mount
 */
async function onInitClick_(mount) {
  const url = String(GAS_BASE_URL).trim();
  const hint = /** @type {HTMLElement | null} */ (mount && mount.querySelector('#sp-stu-hint'));
  if (!url || !mount) {
    return;
  }
  const ok = window.confirm(
    '드라이브에 「솔루션편입_수강생_마스터」 파일을 만들거나 연결하고, 원천 주문을 기준으로 수강생 시트를 채웁니다.\n\n' +
      '이미 만든 파일이 있으면 같은 폴더에서 다시 잡습니다. 계속할까요?'
  );
  if (!ok) {
    return;
  }
  setStuOverlay_(mount, true, '수강생 DB 준비 중', '수 분 걸릴 수 있습니다.');
  if (hint) {
    hint.setAttribute('hidden', '');
  }
  try {
    const r = await gasJsonp_(url, 'initStudentMgmtSheets', 360000);
    if (!r || !r.ok) {
      if (hint) {
        const em =
          r && r.message
            ? String(r.message)
            : r && r.error && r.error.message
              ? String(r.error.message)
              : '';
        hint.textContent = em || '초기화에 실패했습니다.';
        hint.removeAttribute('hidden');
      }
      return;
    }
    await refreshStudentPanel_(mount);
  } catch (e) {
    if (hint) {
      hint.textContent = e && e.message != null ? String(e.message) : '요청 실패';
      hint.removeAttribute('hidden');
    }
  } finally {
    setStuOverlay_(mount, false, '', '');
  }
}

/**
 * @param {HTMLElement | null} mount
 * @param {string} msg
 * @param {boolean} show
 */
function setDateEditorHint_(mount, msg, show) {
  const hint = /** @type {HTMLElement | null} */ (mount && mount.querySelector('#sp-stu-dateHint'));
  if (!hint) {
    return;
  }
  hint.textContent = msg || '';
  if (show) {
    hint.removeAttribute('hidden');
  } else {
    hint.setAttribute('hidden', '');
  }
}

/**
 * @param {HTMLElement | null} mount
 * @param {HTMLElement | null} mount
 * @returns {Array<Record<string, string>>}
 */
function getDateEditorViewRows_(mount) {
  const sel = /** @type {HTMLSelectElement | null} */ (mount && mount.querySelector('#sp-stu-dateFilterCat'));
  const catFilter = sel ? String(sel.value || '').trim().toLowerCase() : '';
  let rows = _dateEditorRows.slice();
  if (catFilter) {
    rows = rows.filter(function (r) {
      return String(r.internalCategory || '').trim().toLowerCase() === catFilter;
    });
  }
  const cmpDate = function (a, b, key) {
    const av = ymdFromDateTime_(String(a[key] || ''));
    const bv = ymdFromDateTime_(String(b[key] || ''));
    return av.localeCompare(bv);
  };
  rows.sort(function (a, b) {
    if (_dateSortStart !== 'none') {
      const c1 = cmpDate(a, b, 'productStartDate');
      if (c1 !== 0) {
        return _dateSortStart === 'asc' ? c1 : -c1;
      }
    } else if (_dateSortEnd !== 'none') {
      const c2 = cmpDate(a, b, 'productEndDate');
      if (c2 !== 0) {
        return _dateSortEnd === 'asc' ? c2 : -c2;
      }
    }
    const ac = String(a.internalCategory || '');
    const bc = String(b.internalCategory || '');
    if (ac !== bc) {
      return ac.localeCompare(bc);
    }
    return String(a.memberName || '').localeCompare(String(b.memberName || ''));
  });
  return rows;
}

/**
 * @param {HTMLElement | null} mount
 */
function applyDateEditorSortIndicators_(mount) {
  const startEl = /** @type {HTMLElement | null} */ (mount && mount.querySelector('[data-sort-dir-for="start"]'));
  const endEl = /** @type {HTMLElement | null} */ (mount && mount.querySelector('[data-sort-dir-for="end"]'));
  if (startEl) {
    startEl.textContent = _dateSortStart === 'asc' ? '▲' : _dateSortStart === 'desc' ? '▼' : '-';
  }
  if (endEl) {
    endEl.textContent = _dateSortEnd === 'asc' ? '▲' : _dateSortEnd === 'desc' ? '▼' : '-';
  }
}

/**
 * @param {HTMLElement | null} mount
 */
function renderDateEditorRows_(mount) {
  const tbody = /** @type {HTMLElement | null} */ (mount && mount.querySelector('#sp-stu-dateTbody'));
  if (!tbody) {
    return;
  }
  const rows = getDateEditorViewRows_(mount);
  applyDateEditorSortIndicators_(mount);
  if (!rows || !rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="sp-stu-date-editor__empty">표시할 항목이 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  rows.forEach(function (r) {
    const tr = document.createElement('tr');
    const orderItemCode = String(r.orderItemCode || '');
    const startYmd = ymdFromDateTime_(String(r.productStartDate || ''));
    const endYmd = ymdFromDateTime_(String(r.productEndDate || ''));
    tr.setAttribute('data-order-item-code', orderItemCode);
    tr.setAttribute('data-orig-start', startYmd);
    tr.setAttribute('data-orig-end', endYmd);
    tr.innerHTML =
      `<td>${String(r.memberName || '')}</td>` +
      `<td><span class="sp-stu-cat-badge sp-stu-cat-badge--${String(r.internalCategory || '').trim().toLowerCase()}">${stuCatLabel_(String(r.internalCategory || ''))}</span></td>` +
      `<td>${String(r.prodName || '')}</td>` +
      `<td class="sp-stu-date-order-time">${String(r.orderTime || '')}</td>` +
      `<td><input type="date" class="sp-stu-date-start" value="${startYmd}" /></td>` +
      `<td><input type="date" class="sp-stu-date-end" value="${endYmd}" /></td>` +
      `<td class="sp-stu-date-updated">${String(r.updatedAt || '')}</td>`;
    tbody.appendChild(tr);
  });
}

/**
 * @param {HTMLElement | null} mount
 */
async function loadDateEditorList_(mount) {
  const url = String(GAS_BASE_URL).trim();
  if (!url || !mount) {
    return;
  }
  setDateEditorHint_(mount, '', false);
  try {
    const r = await gasJsonp_(url, 'studentMgmtDateEditorList', 120000);
    if (!r || !r.ok) {
      const em =
        r && r.error && r.error.message
          ? String(r.error.message)
          : r && r.message
            ? String(r.message)
            : '목록을 불러오지 못했습니다.';
      setDateEditorHint_(mount, em, true);
      _dateEditorRows = [];
      renderDateEditorRows_(mount);
      return;
    }
    const rows = r.data && Array.isArray(r.data.rows) ? r.data.rows : [];
    _dateEditorRows = rows;
    _dateSortStart = 'none';
    _dateSortEnd = 'none';
    renderDateEditorRows_(mount);
  } catch (e) {
    setDateEditorHint_(mount, e && e.message != null ? String(e.message) : '요청 실패', true);
  }
}

/**
 * @param {HTMLElement | null} mount
 * @returns {Array<Record<string, string|boolean>>}
 */
function collectDateEditorChangedRows_(mount) {
  const tbody = /** @type {HTMLElement | null} */ (mount && mount.querySelector('#sp-stu-dateTbody'));
  if (!tbody) {
    return [];
  }
  const trs = Array.from(tbody.querySelectorAll('tr'));
  const out = [];
  trs.forEach(function (row) {
    if (!(row instanceof HTMLTableRowElement)) {
      return;
    }
    const startInput = /** @type {HTMLInputElement|null} */ (row.querySelector('.sp-stu-date-start'));
    const endInput = /** @type {HTMLInputElement|null} */ (row.querySelector('.sp-stu-date-end'));
    const orderItemCode = String(row.getAttribute('data-order-item-code') || '');
    if (!orderItemCode.length) {
      return;
    }
    const origStart = String(row.getAttribute('data-orig-start') || '');
    const origEnd = String(row.getAttribute('data-orig-end') || '');
    const nextStart = startInput ? String(startInput.value || '').trim() : '';
    const nextEnd = endInput ? String(endInput.value || '').trim() : '';
    const changedStart = nextStart !== origStart;
    const changedEnd = nextEnd !== origEnd;
    if (!changedStart && !changedEnd) {
      return;
    }
    out.push({
      orderItemCode: orderItemCode,
      productStartDate: nextStart,
      productEndDate: nextEnd,
      changedStart: changedStart,
      changedEnd: changedEnd
    });
  });
  return out;
}

/**
 * @param {HTMLElement | null} mount
 * @param {Array<Record<string, string>>} savedRows
 */
function applyDateEditorSavedRows_(mount, savedRows) {
  const tbody = /** @type {HTMLElement | null} */ (mount && mount.querySelector('#sp-stu-dateTbody'));
  if (!tbody || !savedRows || !savedRows.length) {
    return;
  }
  savedRows.forEach(function (d) {
    const code = String(d.orderItemCode || '');
    if (!code) {
      return;
    }
    const tr = tbody.querySelector(`tr[data-order-item-code="${code}"]`);
    if (!(tr instanceof HTMLTableRowElement)) {
      return;
    }
    const startInput = /** @type {HTMLInputElement|null} */ (tr.querySelector('.sp-stu-date-start'));
    const endInput = /** @type {HTMLInputElement|null} */ (tr.querySelector('.sp-stu-date-end'));
    const savedStart = ymdFromDateTime_(String(d.productStartDate || ''));
    const savedEnd = ymdFromDateTime_(String(d.productEndDate || ''));
    if (startInput) {
      startInput.value = savedStart;
    }
    if (endInput) {
      endInput.value = savedEnd;
    }
    tr.setAttribute('data-orig-start', savedStart);
    tr.setAttribute('data-orig-end', savedEnd);
    const up = tr.querySelector('.sp-stu-date-updated');
    if (up) {
      up.textContent = String(d.updatedAt || '');
    }
    const code0 = String(d.orderItemCode || '');
    _dateEditorRows = _dateEditorRows.map(function (x) {
      if (String(x.orderItemCode || '') !== code0) {
        return x;
      }
      return {
        ...x,
        productStartDate: String(d.productStartDate || x.productStartDate || ''),
        productEndDate: String(d.productEndDate || x.productEndDate || ''),
        updatedAt: String(d.updatedAt || x.updatedAt || '')
      };
    });
  });
  renderDateEditorRows_(mount);
}

/**
 * @param {HTMLElement | null} mount
 */
async function saveDateEditorAll_(mount) {
  const url = String(GAS_BASE_URL).trim();
  const btnDateSaveAll = /** @type {HTMLButtonElement | null} */ (mount && mount.querySelector('#sp-stu-btnDateSaveAll'));
  if (!url || !mount) {
    return;
  }
  const changedRows = collectDateEditorChangedRows_(mount);
  if (!changedRows.length) {
    setDateEditorHint_(mount, '변경된 값이 없습니다.', true);
    return;
  }
  if (btnDateSaveAll) {
    btnDateSaveAll.disabled = true;
  }
  try {
    const r = await gasJsonpWithParams_(
      url,
      'studentMgmtDateEditorSaveBatch',
      { payload: JSON.stringify({ rows: changedRows }) },
      180000
    );
    if (!r || !r.ok) {
      const em =
        r && r.error && r.error.message
          ? String(r.error.message)
          : r && r.message
            ? String(r.message)
            : '저장하지 못했습니다.';
      setDateEditorHint_(mount, em, true);
      return;
    }
    const rows = r.data && Array.isArray(r.data.rows) ? r.data.rows : [];
    applyDateEditorSavedRows_(mount, rows);
    setDateEditorHint_(mount, '전체 수정 반영 완료', true);
  } catch (e) {
    setDateEditorHint_(mount, e && e.message != null ? String(e.message) : '요청 실패', true);
  } finally {
    if (btnDateSaveAll) {
      btnDateSaveAll.disabled = false;
    }
  }
}

/**
 * @param {HTMLElement | null} mount
 */
export function studentMgmtOnTabActivate(mount) {
  void refreshStudentPanel_(mount);
}
