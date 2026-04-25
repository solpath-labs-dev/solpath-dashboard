/**
 * Web App `doGet`.
 * - **루트** — ① `POST` refresh(저장) 성공 → `imwebApiTestAll` (GET 체인) ② 실패(유효 refresh 없음) → **페이지가 인가 URL로 `location.replace` (버튼 없음)**. 인가·로그인·승인은 **아임웹 브라우저 화면만** 가능(OAuth).
 * - **`?code=`** — `imwebExchangeByCodeAndStore_` → `imwebApiTestAll({ fromDoGet: true, skipInitialRefresh: true })`.
 * Logger: 배포 **Executions** (에디터 Run 이 아님).
 */
function doGet(e) {
  e = e || { parameter: {} };
  var p = e.parameter || {};
  /** 대시보드 JSONP(크로스 오리진 fetch CORS 대신) — imweb·솔패스 */
  var fmt = p.format != null ? String(p.format) : '';
  var jcb = p.callback != null ? String(p.callback) : '';
  if (fmt === 'jsonp' && jcb.length) {
    return openSyncJsonpFromGet_(e, jcb);
  }
  var err = p.error != null ? String(p.error) : '';
  if (err.length) {
    var d = p.error_description != null ? String(p.error_description) : '';
    return imwebCHtmlOutput_(
      imwebCAdminPageHtml_('error', {
        title: 'OAuth 오류',
        body: imwebCEscapeHtml_(err + (d.length ? ' — ' + d : ''))
      })
    );
  }
  var code = p.code != null ? String(p.code).trim() : '';
  if (code.length) {
    var r;
    try {
      r = imwebExchangeByCodeAndStore_(code);
    } catch (x) {
      return imwebCHtmlOutput_(
        imwebCAdminPageHtml_('error', {
          title: '토큰 교환 실패',
          body: imwebCEscapeHtml_(x && x.message != null ? x.message : String(x))
        })
      );
    }
    if (!r._saved) {
      return imwebCHtmlOutput_(
        imwebCAdminPageHtml_('error', {
          title: 'access 저장 실패',
          body:
            'http=' +
            r._http +
            ' — 본문 앞 500자: ' +
            imwebCEscapeHtml_(String(r._text != null ? r._text : '').slice(0, 500))
        })
      );
    }
    try {
      imwebApiTestAll({ fromDoGet: true, skipInitialRefresh: true });
    } catch (t) {
      return imwebCHtmlOutput_(
        imwebCAdminPageHtml_('error', {
          title: 'imwebApiTestAll 실패',
          body: imwebCEscapeHtml_(t && t.message != null ? t.message : String(t)) + ' — Executions에서 부분 로그 확인.'
        })
      );
    }
    return imwebCHtmlOutput_(
      imwebCAdminPageHtml_('success', {
        http: r._http,
        via: 'code'
      })
    );
  }
  var sp = PropertiesService.getScriptProperties();
  var rtInit = sp.getProperty('IMWEB_OAUTH_REFRESH_TOKEN') != null ? String(sp.getProperty('IMWEB_OAUTH_REFRESH_TOKEN')).trim() : '';
  if (!rtInit.length) {
    Logger.log('[doGet root] IMWEB_OAUTH_REFRESH_TOKEN empty — skip refresh POST, redirect to authorize');
    return imwebCHtmlOutput_(imwebCAutoRedirectHtml_(imwebTBuildAuthUrl_()));
  }
  var bRoot = imwebTTokenBodyRefresh_();
  var savedRoot = imwebSaveTokenResponseToProperties_(bRoot._text) === true;
  Logger.log('[doGet root] refresh POST http=' + bRoot._http + ' storedAccess=' + savedRoot);
  if (savedRoot) {
    try {
      imwebApiTestAll({ fromDoGet: true, skipInitialRefresh: true });
    } catch (t) {
      return imwebCHtmlOutput_(
        imwebCAdminPageHtml_('error', {
          title: 'imwebApiTestAll 실패',
          body: imwebCEscapeHtml_(t && t.message != null ? t.message : String(t)) + ' — Executions에서 부분 로그 확인.'
        })
      );
    }
    return imwebCHtmlOutput_(
      imwebCAdminPageHtml_('success', {
        http: bRoot._http,
        via: 'refresh'
      })
    );
  }
  Logger.log('[doGet root] no valid access from refresh — browser redirecting to Imweb authorize (OAuth login required on their site)');
  return imwebCHtmlOutput_(imwebCAutoRedirectHtml_(imwebTBuildAuthUrl_()));
}

/** @param {string} html */
function imwebCHtmlOutput_(html) {
  return HtmlService.createHtmlOutput(html).setTitle('Imweb Open API (GAS)').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function imwebCEscapeHtml_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {'success'|'error'} kind
 * @param {{ title?: string, body?: string, http?: number, via?: string }} p
 */
function imwebCAdminPageHtml_(kind, p) {
  p = p || {};
  var selfUrl = '';
  try {
    selfUrl = ScriptApp.getService().getUrl() || '';
  } catch (e) {
    selfUrl = '';
  }
  if (!selfUrl.length) {
    selfUrl = '#';
  }
  var back =
    '<p><a href="' +
    imwebCEscapeHtml_(selfUrl) +
    '">Web App 루트 다시</a> · <strong>Executions</strong>에서 Logger</p>';

  if (kind === 'success') {
    var viaT =
      p.via === 'refresh'
        ? '리프레시 토큰으로만 갱신(이번 루트는 아임웹 로그인 없이 처리)'
        : p.via === 'code'
          ? '리다이렉트 ?code= 로 교환'
          : '완료';
    return imwebCAdminWrap_(
      '완료',
      '<p><code>imwebApiTestAll</code> GET 체인까지 끝남. (' +
        imwebCEscapeHtml_(viaT) +
        ' · http=' +
        imwebCEscapeHtml_(String(p.http != null ? p.http : '')) +
        ')</p>' +
        '<p class="hint">(4)–(11) · refresh 로그는 <strong>Executions</strong> → 이번 요청.</p>' +
        back
    );
  }
  return imwebCAdminWrap_(p.title || '오류', '<p>' + (p.body || '') + '</p>' + back);
}

/** @param {string} authUrl */
function imwebCAutoRedirectHtml_(authUrl) {
  var a = String(authUrl != null ? authUrl : '');
  return imwebCAdminWrap_(
    '인가로 이동 중',
    '<p class="hint">이 설치에 쓸 수 있는 refresh가 없으면(또는 만료) <strong>아임웹 로그인·승인</strong>이 한 번 필요합니다. 아래는 버튼 없이 자동으로 인가 URL로 이동합니다…</p>' +
      '<script>location.replace(' +
      JSON.stringify(a) +
      ');<\/script>'
  );
}

function imwebCAdminWrap_(title, inner) {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>body{font-family:system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#1a1a1a}' +
    '.btn{display:inline-block;padding:.65em 1.2em;background:#1a73e8;color:#fff!important;border-radius:8px;text-decoration:none;font-weight:600}' +
    '.hint{font-size:13px;color:#555}code{background:#f1f3f4;padding:2px 6px;border-radius:4px}</style></head><body>' +
    '<h1 style="font-size:1.25rem">' +
    imwebCEscapeHtml_(title) +
    '</h1>' +
    inner +
    '</body></html>'
  );
}
