/**
 * Open API **연속 통신 테스트** — 에디터에서 **`imwebApiTestAll`만 Run.**
 * 매 실행마다 **아래 순서 전부** 호출 (4)~(11). API는 `http`+본문; **OAuth token POST/저장**은 **본문·토큰 값 Logger에 안 씀** — Properties 상태 + **인가 URL**만.
 *
 * **Script Properties (사전)**
 * - `IMWEB_CLIENT_ID`, `IMWEB_CLIENT_SECRET`, `IMWEB_REDIRECT_URI`, `IMWEB_SITE_CODE`, `IMWEB_SCOOP`
 * - **최초 토큰(인가 `code` 교환):** `Code.js` **Web App** `?code=` → `imwebExchangeByCodeAndStore_` **만** (에디터 `Run`엔 `code` 없음). `IMWEB_OAUTH_EXCHANGE_CODE` **같은 키 쓰지 않음.**
 * - (이미 있으면) `IMWEB_OAUTH_ACCESS_TOKEN`, `IMWEB_OAUTH_REFRESH_TOKEN` — refresh `POST` **200**이면 `imwebSaveTokenResponseToProperties_`로 갱신
 * - `IMWEB_UNIT_CODE` — `GET /site-info` 200이면 `unitList[0].unitCode`로 덮어씀
 * - **`Code.js` doGet** — `?code=` 는 교환·저장 후 `imwebApiTestAll({ fromDoGet: true, skipInitialRefresh: true })` (이중 refresh 생략). **루트**는 doGet 안에서 먼저 refresh·저장 시도 → 성공 시 위와 동일, 실패 시 **브라우저**를 인가 URL로 **자동 이동** (로그인·승인은 아임웹 쪽 필수, GAS가 대신 불가)
 */
var imwebTestApiBase_ = 'https://openapi.imweb.me';
var imwebTestTokenUrl_ = imwebTestApiBase_ + '/oauth2/token';

/**
 * Open API 연속 테스트. 에디터 Run 시 인자 생략.
 * @param {{ fromDoGet?: boolean, skipInitialRefresh?: boolean }} [opt]
 *   `fromDoGet` — Web App 실행(에디터 대신)
 *   `skipInitialRefresh` — 직전에 doGet이 code 교환이나 루트 refresh로 이미 Properties 갱신함 → (2)(3) POST 생략
 */
function imwebApiTestAll(opt) {
  opt = opt || {};
  var fromDoGet = opt.fromDoGet === true;
  var skipR = opt.skipInitialRefresh === true;
  var p = PropertiesService.getScriptProperties();
  imwebTLog_(
    fromDoGet
      ? skipR
        ? '(0) 시작 — Web App doGet (토큰은 이번 요청 **앞**에서 code/ref로 Properties 반영됨)'
        : '(0) 시작 — Web App doGet (이어서 (2)(3) refresh 수행)'
      : '(0) 시작 (에디터 Run)',
    '—',
    0,
    ''
  );
  imwebTLogPropertiesTokens_('(0) Run 직후 — Script Properties');
  var rt0 = p.getProperty('IMWEB_OAUTH_REFRESH_TOKEN') != null ? String(p.getProperty('IMWEB_OAUTH_REFRESH_TOKEN')).trim() : '';
  var at0 = p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN') != null ? String(p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN')).trim() : '';

  if (fromDoGet && skipR && !at0.length) {
    imwebTLog_(
      '(중단) `IMWEB_OAUTH_ACCESS_TOKEN` 없음 — 이번 doGet 앞 `code` 교환이나 루트 refresh가 실패했는지 **같은 실행** 앞부분(Logger)을 확인. (4)~(11) 생략.',
      '—',
      0,
      ''
    );
    imwebTLog_('(끝)', '—', 0, '');
    return;
  }
  if (!fromDoGet && !at0.length && !rt0.length) {
    imwebTLog_(
      '(중단) **Script Properties에 access·refresh 둘 다 없음** — "API 테스트 **전**에 토큰을 따로 또 받는" 단계가 **아닙니다**. 지금 (2)는 `refresh`가 비어 있는데도 POST 해서 **10004(잘못된 입력)**,(4)는 Bearer 없이 GET 해서 **10001**이 난 것입니다. **에디터 `Run`만으로는** `code`가 없어 **토큰이 절대 생기지 않습니다.**\n' +
        '➡ 최초·만료: **Web App을 배포한 URL**을 **브라우저**로 열기(루트) → 인가·로그인·승인 → `?code=` 로 돌아오면 `IMWEB_OAUTH_*` **자동 저장** (또는 루트에서 유효 refresh만으로 갱신).',
      'LOG',
      0,
      imwebTBuildAuthUrl_()
    );
    imwebTLog_('(끝) — (2)~(3) 이후 (4)~(11) 생략', '—', 0, '');
    return;
  }

  if (fromDoGet && skipR) {
    imwebTLog_(
      '(1) — (2)(3) **생략** (code 교환·저장 **또는** 루트에서 refresh·저장 **직전에 끝남**). (4) GET~ (11)',
      'LOG',
      0,
      ''
    );
  } else if (!fromDoGet) {
    imwebTLog_(
      '(1) — 에디터: `code` 없음. refresh가 있으면 (2)(3)으로 access 갱신, 없고 access만 있으면 (2)(3) 생략. **둘 다 없으면** 위 (중단) — Web App + 인가 필요.',
      'LOG',
      0,
      imwebTBuildAuthUrl_()
    );
  } else if (fromDoGet) {
    imwebTLog_('(1) — Web App, (2)(3) refresh 수행', 'LOG', 0, '');
  }

  if (!skipR) {
    if (rt0.length) {
      var b2 = imwebTTokenBodyRefresh_();
      imwebTLogOAuthTokenPostResult_('(2) POST ' + imwebTestTokenUrl_ + ' grant_type=refresh_token (1)', b2);
      imwebSaveTokenResponseToProperties_(b2._text);

      var b3 = imwebTTokenBodyRefresh_();
      imwebTLogOAuthTokenPostResult_('(3) POST ' + imwebTestTokenUrl_ + ' grant_type=refresh_token (2) — 동일 refresh로 재POST', b3);
      imwebSaveTokenResponseToProperties_(b3._text);
      imwebTLogPropertiesTokens_('(3) 끝 — refresh 둘 다 시도 후(저장 200이면 갱신됨)');
    } else {
      imwebTLog_(
        '(2)(3) **생략** — `IMWEB_OAUTH_REFRESH_TOKEN` 비어 있음(빈 값 refresh POST → 아임웹 **10004**). access만으로 GET 시도(유효기간 남았을 때).',
        'LOG',
        0,
        ''
      );
    }
  }

  var access = p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN') != null ? String(p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN')).trim() : '';
  if (!access.length) {
    imwebTLog_(
      '(중단) `IMWEB_OAUTH_ACCESS_TOKEN` **여전히 비어 있음** — refresh도 없거나(또는 둘 다 실패). (4)~(11) **생략** (빈 Bearer → 10001).\n' +
        '➡ **Web App 배포 URL**을 브라우저로 열고 아임웹 인가(또는 루트에서 refresh OK면 자동) 후 다시.',
      'LOG',
      0,
      imwebTBuildAuthUrl_()
    );
    imwebTLog_('(끝)', '—', 0, '');
    return;
  }
  var g1 = imwebTGet_('/site-info', null, access);
  imwebTLog_('(4) GET ' + imwebTestApiBase_ + '/site-info', 'GET', g1._http, g1._text);
  imwebTStoreUnitCodeFromSiteInfo_(g1._text, p);
  var uc = p.getProperty('IMWEB_UNIT_CODE') != null ? String(p.getProperty('IMWEB_UNIT_CODE')).trim() : '';

  var g2 = imwebTGet_('/member-info/members', { page: 1, limit: 1, unitCode: uc }, access);
  imwebTLog_(
    '(5) GET /member-info/members (page,limit,unitCode 필수)',
    'GET',
    g2._http,
    g2._text
  );

  var g3 = imwebTGet_('/products', { page: 1, limit: 1, unitCode: uc }, access);
  imwebTLog_(
    '(6) GET /products (page,limit,unitCode 필수)',
    'GET',
    g3._http,
    g3._text
  );

  var prodNo = imwebTFirstProdNoFromBody_(g3._text);
  var path9 = '/products/' + encodeURIComponent(String(prodNo));
  var g4 = imwebTGet_(path9, { unitCode: uc }, access);
  imwebTLog_(
    '(7) GET /products/{prodNo} (필수 query unitCode; prodNo는 (6) 응답에서 첫 prodNo, 없으면 0)',
    'GET',
    g4._http,
    g4._text
  );

  var path10 = path9 + '/options';
  var g5 = imwebTGet_(path10, { page: 1, limit: 1, unitCode: uc }, access);
  imwebTLog_(
    '(8) GET /products/{prodNo}/options (page,limit,unitCode 필수)',
    'GET',
    g5._http,
    g5._text
  );

  var optionCode = imwebTFirstOptionCodeFromOptionsBody_(g5._text);
  var path11 = path9 + '/options/' + encodeURIComponent(String(optionCode));
  var g6 = imwebTGet_(path11, { unitCode: uc }, access);
  imwebTLog_(
    '(9) GET /products/{prodNo}/options/{optionCode} (unitCode 필수; optionCode는 (8)에서 첫 값, 없으면 빈 문자)',
    'GET',
    g6._http,
    g6._text
  );

  var oq = imwebTBuildOpenOrdersListQuery_(uc);
  var g7 = imwebTGet_('/orders', oq, access);
  imwebTLog_(
    '(10) GET /orders (page,limit,unitCode; startWtime/endWtime=최근 180일) — 품목: list[].sections[].sectionItems[]·productInfo (prodName)',
    'GET',
    g7._http,
    g7._text
  );
  var orderNo1 = imwebTFirstOrderNoFromBody_(g7._text);
  if (orderNo1 && String(orderNo1).length) {
    var g8 = imwebTGet_('/orders/' + encodeURIComponent(String(orderNo1)), null, access);
    imwebTLog_(
      '(11) GET /orders/{orderNo} (orderNo=(10) list[0])',
      'GET',
      g8._http,
      g8._text
    );
  } else {
    imwebTLog_('(11) **생략** — (10)에 주문 0건이거나 orderNo 없음', 'LOG', 0, '');
  }

  imwebTLogPropertiesTokens_('(끝) — 최종 Properties');
  imwebTLog_('(끝)', '—', 0, '');
}

function imwebTLog_(title, method, http, text) {
  var line2 = 'http=' + String(http) + (text != null && String(text).length ? '\n' + String(text) : '');
  Logger.log('=== ' + title + ' ===\n' + method + (method === 'LOG' ? '\n' : '') + line2);
}

function imwebTLogPropertiesTokens_(label) {
  var pr = PropertiesService.getScriptProperties();
  var a = pr.getProperty('IMWEB_OAUTH_ACCESS_TOKEN');
  var r = pr.getProperty('IMWEB_OAUTH_REFRESH_TOKEN');
  var hasA = a != null && String(a).trim() !== '';
  var hasR = r != null && String(r).trim() !== '';
  var authU = '';
  try {
    authU = imwebTBuildAuthUrl_();
  } catch (e) {
    authU = '';
  }
  Logger.log(
    '=== ' +
      label +
      ' ===\n' +
      'access: ' +
      (hasA ? '있음' : '없음') +
      ' (값 Logger 미출력)  |  refresh: ' +
      (hasR ? '있음' : '없음') +
      ' (값 Logger 미출력)\n' +
      '— 브라우저 인가(스코프·재로그인):\n' +
      (authU.length ? authU : '(IMWEB_SCOOP·REDIRECT·CLIENT_ID Property 확인)')
  );
}

/**
 * `POST /oauth2/token` 응답은 access/refresh JWT 포함 — **200이면 본문 Logger에 안 씀**
 * @param {string} title
 * @param {{ _http: number, _text: string }} b
 */
function imwebTLogOAuthTokenPostResult_(title, b) {
  var http = b && b._http != null ? b._http : 0;
  if (http === 200) {
    Logger.log('=== ' + title + ' ===\nPOST\nhttp=' + http + ' (본문 토큰, Logger에 미출력) → imwebSaveTokenResponseToProperties_ 로 Properties 갱신');
  } else {
    Logger.log(
      '=== ' + title + ' ===\nPOST\nhttp=' + http + '\n' + String(b && b._text != null ? b._text : '').slice(0, 500)
    );
  }
}

function imwebTBuildAuthUrl_() {
  var p = PropertiesService.getScriptProperties();
  var clientId = p.getProperty('IMWEB_CLIENT_ID');
  var ru = p.getProperty('IMWEB_REDIRECT_URI');
  var redirectUri = ru != null ? String(ru).trim() : '';
  var siteCode = p.getProperty('IMWEB_SITE_CODE');
  var sc = p.getProperty('IMWEB_SCOOP') != null ? String(p.getProperty('IMWEB_SCOOP')).trim() : '';
  var q = [
    'responseType=code',
    'clientId=' + encodeURIComponent(String(clientId || '')),
    'redirectUri=' + encodeURIComponent(redirectUri),
    'scope=' + encodeURIComponent(sc),
    'state=' + encodeURIComponent(Utilities.getUuid()),
    'siteCode=' + encodeURIComponent(String(siteCode || ''))
  ];
  return imwebTestApiBase_ + '/oauth2/authorize?' + q.join('&');
}

function imwebTForm_(fields) {
  var keys = Object.keys(fields);
  var out = [];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (!Object.prototype.hasOwnProperty.call(fields, k) || fields[k] == null) {
      continue;
    }
    out.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(fields[k])));
  }
  return out.join('&');
}

function imwebTTokenBodyRefresh_() {
  var p = PropertiesService.getScriptProperties();
  var payload = imwebTForm_({
    grantType: 'refresh_token',
    clientId: String(p.getProperty('IMWEB_CLIENT_ID') || '').trim(),
    clientSecret: String(p.getProperty('IMWEB_CLIENT_SECRET') || '').trim(),
    refreshToken: String(p.getProperty('IMWEB_OAUTH_REFRESH_TOKEN') || '').trim()
  });
  return imwebTPostForm_(imwebTestTokenUrl_, payload);
}

function imwebTPostForm_(url, formBody) {
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: formBody,
    muteHttpExceptions: true
  });
  var text = resp.getContentText();
  if (text == null) {
    text = '';
  }
  return { _http: resp.getResponseCode(), _text: text };
}

/**
 * Open API 본문에서 statusCode/message 추출 (파싱 실패 시 null)
 * @param {string} raw
 * @return {{statusCode:number|null,message:string}}
 */
function imwebBodyMeta_(raw) {
  var out = { statusCode: null, message: '' };
  var j;
  try {
    j = JSON.parse(raw || '');
  } catch (_e) {
    return out;
  }
  if (j && j.statusCode != null && isFinite(Number(j.statusCode))) {
    out.statusCode = Number(j.statusCode);
  }
  if (j && j.message != null) {
    out.message = String(j.message);
  }
  return out;
}

/**
 * access 만료/무효로 refresh가 필요한 응답인지 판정
 * - HTTP 401 이거나
 * - 본문 statusCode 30101 (invalid/expired access token)
 * @param {{_http:number,_text:string}} resp
 * @return {boolean}
 */
function imwebNeedsRefreshFromResponse_(resp) {
  if (!resp) {
    return false;
  }
  if (Number(resp._http) === 401) {
    return true;
  }
  var meta = imwebBodyMeta_(resp._text);
  return meta.statusCode === 30101;
}

/**
 * refresh_token으로 access 갱신 (필요 시에만 호출)
 * @throws {Error}
 */
function imwebRefreshAccessTokenForOpenSync_() {
  var p = PropertiesService.getScriptProperties();
  var rt = p.getProperty('IMWEB_OAUTH_REFRESH_TOKEN') != null ? String(p.getProperty('IMWEB_OAUTH_REFRESH_TOKEN')).trim() : '';
  if (!rt.length) {
    throw new Error('IMWEB_OAUTH_REFRESH_TOKEN 없음');
  }
  var b = imwebTTokenBodyRefresh_();
  if (imwebSaveTokenResponseToProperties_(b._text) === true) {
    Logger.log('[imwebRefreshAccessTokenForOpenSync_] refresh OK http=' + b._http);
    return;
  }
  var meta = imwebBodyMeta_(b._text);
  throw new Error(
    'POST /oauth2/token refresh 실패' +
      ' http=' +
      String(b._http) +
      ' statusCode=' +
      String(meta.statusCode != null ? meta.statusCode : '') +
      ' message=' +
      String(meta.message || '')
  );
}

function imwebTGet_(path, query, bearer) {
  var pth = path.indexOf('/') === 0 ? path : '/' + path;
  var url = imwebTestApiBase_ + pth;
  if (query) {
    var parts = [];
    for (var k in query) {
      if (Object.prototype.hasOwnProperty.call(query, k) && query[k] != null && String(query[k]) !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(query[k])));
      }
    }
    if (parts.length) {
      url += '?' + parts.join('&');
    }
  }
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + String(bearer != null ? bearer : ''), accept: 'application/json' },
    muteHttpExceptions: true
  });
  var t = resp.getContentText();
  if (t == null) {
    t = '';
  }
  return { _http: resp.getResponseCode(), _text: t };
}

/**
 * OpenSync 전용: refresh 없이 access 토큰만 사용해 GET
 * - 실패 원인을 숨기지 않기 위해 자동 refresh/retry를 하지 않는다.
 * @param {string} path
 * @param {Object|null|undefined} query
 * @return {{_http:number,_text:string}}
 */
function imwebTGetOpenSyncStrict_(path, query) {
  var p = PropertiesService.getScriptProperties();
  var access = p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN') != null ? String(p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN')).trim() : '';
  if (!access.length) {
    throw new Error('IMWEB_OAUTH_ACCESS_TOKEN 없음');
  }
  Logger.log('[imwebTGetOpenSyncStrict_] ACCESS_TOKEN key used for path=' + String(path));
  return imwebTGet_(path, query, access);
}

/**
 * Open API GET with auth retry:
 * 1) 현재 access로 1회 요청
 * 2) 401/30101이면 refresh 후 access 재조회
 * 3) 동일 요청 1회 재시도
 * @param {string} path
 * @param {Object|null|undefined} query
 * @return {{_http:number,_text:string}}
 */
function imwebTGetWithOpenSyncRetry_(path, query) {
  var p = PropertiesService.getScriptProperties();
  var access = p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN') != null ? String(p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN')).trim() : '';
  if (!access.length) {
    throw new Error('IMWEB_OAUTH_ACCESS_TOKEN 없음');
  }
  var first = imwebTGet_(path, query, access);
  if (!imwebNeedsRefreshFromResponse_(first)) {
    return first;
  }
  var firstMeta = imwebBodyMeta_(first._text);
  Logger.log(
    '[imwebTGetWithOpenSyncRetry_] auth retry triggered: path=' +
      String(path) +
      ' http=' +
      String(first._http) +
      ' statusCode=' +
      String(firstMeta.statusCode != null ? firstMeta.statusCode : '') +
      ' message=' +
      String(firstMeta.message || '')
  );
  imwebRefreshAccessTokenForOpenSync_();
  access = p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN') != null ? String(p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN')).trim() : '';
  if (!access.length) {
    throw new Error('refresh 후 IMWEB_OAUTH_ACCESS_TOKEN 없음');
  }
  var second = imwebTGet_(path, query, access);
  var secondMeta = imwebBodyMeta_(second._text);
  Logger.log(
    '[imwebTGetWithOpenSyncRetry_] retry result: path=' +
      String(path) +
      ' http=' +
      String(second._http) +
      ' statusCode=' +
      String(secondMeta.statusCode != null ? secondMeta.statusCode : '') +
      ' message=' +
      String(secondMeta.message || '')
  );
  return second;
}

/**
 * `POST /oauth2/token` **본문**(`statusCode` + `data`)에서 access·refresh 를 읽어 `IMWEB_OAUTH_*`에 쓴다.
 * 아임웹 응답: 보통 `data.accessToken` / `data.refreshToken` — **snake_case**도 처리.
 * @param {string} raw JSON 문자열
 */
function imwebSaveTokenResponseToProperties_(raw) {
  var j, d, p, at, rt;
  try {
    j = JSON.parse(raw || '');
  } catch (e) {
    Logger.log('[imwebSaveTokenResponseToProperties_] JSON 파싱 실패 — 저장 생략');
    return false;
  }
  if (j.statusCode !== 200 || !j.data) {
    Logger.log(
      '[imwebSaveTokenResponseToProperties_] 200+data 아님 — 저장 안 함. statusCode=' +
        (j != null && j.statusCode != null ? String(j.statusCode) : '') +
        (j != null && j.message != null ? ' message=' + String(j.message) : '') +
        ' (오류 본문은 토큰·민감 가능성으로 Logger에 안 찍음)'
    );
    return false;
  }
  d = j.data;
  p = PropertiesService.getScriptProperties();
  at =
    d.accessToken != null && String(d.accessToken).trim() !== ''
      ? String(d.accessToken).trim()
      : d.access_token != null && String(d.access_token).trim() !== ''
        ? String(d.access_token).trim()
        : '';
  if (d.refreshToken != null && String(d.refreshToken).trim() !== '') {
    rt = String(d.refreshToken).trim();
  } else if (d.refresh_token != null) {
    rt = String(d.refresh_token).trim();
  } else {
    rt = '';
  }
  if (at.length) {
    p.setProperty('IMWEB_OAUTH_ACCESS_TOKEN', at);
  }
  if (rt.length) {
    p.setProperty('IMWEB_OAUTH_REFRESH_TOKEN', rt);
  }
  p.deleteProperty('IMWEB_OAUTH_EXPIRES_AT');
  Logger.log(
    '[imwebSaveTokenResponseToProperties_] Properties 저장(값 미로그) — access: ' +
      (at.length ? 'Y' : 'N') +
      '  refresh: ' +
      (rt.length ? 'Y' : 'N')
  );
  return at.length > 0;
}

/**
 * `dbSyncOpenAll`·대시보드 [실행] 직전: `IMWEB_OAUTH_REFRESH_TOKEN`이 있으면 POST refresh로 access 갱신.
 * 브라우저로 Web App 루트를 열 땐 `doGet`이 갱신하지만, **doPost/JSONP만** 쓰면 만료 access로 `GET /member-info/members` 등이 **401·30101**이 남는다.
 * @throws {Error} refresh가 있는데 응답 저장 실패 시(만료된 refresh 등)
 */
function imwebEnsureAccessTokenForOpenSync_() {
  Logger.log('[imwebEnsureAccessTokenForOpenSync_] deprecated: 선 refresh를 수행하지 않음(요청 시 401/30101일 때만 refresh)');
}

/**
 * **Web App doGet** — 리다이렉트 `code`로 토큰 교환·저장. `Code.js`가 호출.
 * @param {string} code
 * @returns {{_http:number, _text:string, _saved:boolean}} UrlFetch 결과 + `access` 저장 여부
 */
function imwebExchangeByCodeAndStore_(code) {
  var c = code != null ? String(code).trim() : '';
  var p0 = PropertiesService.getScriptProperties();
  var form = imwebTForm_({
    grantType: 'authorization_code',
    clientId: String(p0.getProperty('IMWEB_CLIENT_ID') || '').trim(),
    clientSecret: String(p0.getProperty('IMWEB_CLIENT_SECRET') || '').trim(),
    redirectUri: String(p0.getProperty('IMWEB_REDIRECT_URI') || '').trim(),
    code: c
  });
  var r = imwebTPostForm_(imwebTestTokenUrl_, form);
  var saved = imwebSaveTokenResponseToProperties_(r._text) === true;
  Logger.log(
    '[imwebExchangeByCodeAndStore_] http=' +
      r._http +
      (r._http === 200 && saved ? ' — token Properties 저장(본문 Logger 미출력)' : r._http === 200 && !saved ? ' — 200이나 저장 실패' : ' — code 교환 본문 Logger 미출력(토큰)')
  );
  return { _http: r._http, _text: r._text, _saved: saved };
}

function imwebTStoreUnitCodeFromSiteInfo_(raw, props) {
  var j, ul, u0, uc, i;
  try {
    j = JSON.parse(raw || '');
  } catch (e) {
    return;
  }
  if (j.statusCode !== 200 || !j.data) {
    return;
  }
  ul = j.data.unitList;
  if (Array.isArray(ul) && ul.length) {
    u0 = ul[0];
    if (u0 && typeof u0 === 'object' && u0.unitCode) {
      uc = String(u0.unitCode).trim();
      if (uc.length) {
        props.setProperty('IMWEB_UNIT_CODE', uc);
        return;
      }
    }
  }
  for (i = 0; i < (ul && ul.length ? ul.length : 0); i++) {
    if (typeof ul[i] === 'string' && String(ul[i]).trim().length) {
      props.setProperty('IMWEB_UNIT_CODE', String(ul[i]).trim());
      return;
    }
  }
}

function imwebTFirstProdNoFromBody_(raw) {
  var j, data, d0, list, a;
  try {
    j = JSON.parse(raw || '');
  } catch (e) {
    return '0';
  }
  if (j.statusCode !== 200) {
    return '0';
  }
  data = j.data;
  a = Array.isArray(data) ? data[0] : data;
  if (a && typeof a === 'object' && a.list) {
    list = a.list;
  } else if (data && data.list) {
    list = data.list;
  } else {
    list = null;
  }
  if (!list || !list.length) {
    return '0';
  }
  d0 = list[0];
  if (d0 && d0.prodNo != null) {
    return String(d0.prodNo);
  }
  return '0';
}

function imwebTFirstOptionCodeFromOptionsBody_(raw) {
  var j, data, block, list, k, item;
  try {
    j = JSON.parse(raw || '');
  } catch (e) {
    return '';
  }
  if (j.statusCode !== 200 || j.data == null) {
    return '';
  }
  data = j.data;
  block = Array.isArray(data) ? data[0] : data;
  if (!block || !block.list) {
    return '';
  }
  list = block.list;
  for (k = 0; k < list.length; k++) {
    item = list[k];
    if (item && item.optionCode != null) {
      return String(item.optionCode).trim();
    }
  }
  return '';
}

/**
 * `GET /orders` 쿼리. Reference: page·limit·unitCode 필수에 가깝고, 주문일시는 startWtime/endWtime(ISO).
 * @param {string} unitCode
 * @returns {{ page: number, limit: number, unitCode: string, startWtime: string, endWtime: string }}
 */
function imwebTBuildOpenOrdersListQuery_(unitCode) {
  var end = new Date();
  var start = new Date();
  start.setDate(start.getDate() - 180);
  return {
    page: 1,
    limit: 5,
    unitCode: String(unitCode != null ? unitCode : '').trim(),
    startWtime: start.toISOString(),
    endWtime: end.toISOString()
  };
}

/**
 * @param {string} raw `GET /orders` 본문
 * @returns {string} 첫 `data.list[0].orderNo` 없으면 ''
 */
function imwebTFirstOrderNoFromBody_(raw) {
  var j, list, d0;
  try {
    j = JSON.parse(raw || '');
  } catch (e) {
    return '';
  }
  if (j.statusCode !== 200 || !j.data || !j.data.list) {
    return '';
  }
  list = j.data.list;
  if (!list.length) {
    return '';
  }
  d0 = list[0];
  if (d0 && d0.orderNo != null) {
    return String(d0.orderNo);
  }
  return '';
}

/**
 * **디버그 전용** — 아임웹 `GET /orders/{orderNo}`(unitCode 필수)로 1건 받아 Logger에 출력.
 * 동기 `GET /orders` 목록의 **각 원소와 동일 계열** 구조이나, 취소/반품·가격 확인은 단건이 보기 쉬움.
 *
 * **실행:** GAS 에디터에서 `imwebDebugLogOrderToLogger()` 또는 `imwebDebugLogOrderToLogger('주문번호')`
 * (Node `require` 없음 — `apiTest.js`·`dbSyncOrders.js`·`dbSchema.js` 같은 스크립트 프로젝트에만 있으면 됨.)
 *
 * 출력: 주문 요약, 섹션별 `cancelInfo`/`returnInfo` **전 키·값**, 라인 원본 금액, `dbMapOrderItemRowOpen_`로 만든 시트 행( line_price / line_price_sale / line_point / line_coupon ) 및 **line_net(재구축 식)**.
 *
 * @param {string} [orderNo] 기본 `202603162774427`
 */
function imwebDebugLogOrderToLogger(orderNo) {
  var p = PropertiesService.getScriptProperties();
  var uc = p.getProperty('IMWEB_UNIT_CODE') != null ? String(p.getProperty('IMWEB_UNIT_CODE')).trim() : '';
  if (!uc.length) {
    Logger.log('[imwebDebugLogOrderToLogger] IMWEB_UNIT_CODE 없음. site-info 또는 동기 후 Properties 확인.');
    return;
  }
  var on =
    orderNo != null && String(orderNo).trim() !== '' ? String(orderNo).trim() : '202603162774427';
  var path = '/orders/' + encodeURIComponent(on);
  var g = imwebTGetWithOpenSyncRetry_(path, { unitCode: uc });
  Logger.log('[imwebDebugLogOrderToLogger] GET ' + path + '?unitCode=… http=' + g._http);
  if (g._http !== 200) {
    Logger.log(String(g._text != null ? g._text : '').slice(0, 4000));
    return;
  }
  var j;
  try {
    j = JSON.parse(g._text || '{}');
  } catch (e1) {
    Logger.log('[imwebDebugLogOrderToLogger] JSON.parse 실패: ' + (e1 && e1.message != null ? e1.message : String(e1)));
    return;
  }
  if (j.statusCode !== 200) {
    Logger.log('[imwebDebugLogOrderToLogger] body statusCode!=' + 200 + ' raw=' + String(g._text).slice(0, 1500));
    return;
  }
  var ord = j.data;
  if (ord && Array.isArray(ord.list) && ord.list.length) {
    ord = ord.list[0];
  }
  if (!ord || typeof ord !== 'object') {
    Logger.log('[imwebDebugLogOrderToLogger] data 없음: ' + String(g._text).slice(0, 800));
    return;
  }
  Logger.log(
    '[order] orderNo=' +
      String(ord.orderNo != null ? ord.orderNo : '') +
      ' orderStatus=' +
      String(ord.orderStatus != null ? ord.orderStatus : '') +
      ' totalPaymentPrice=' +
      String(ord.totalPaymentPrice != null ? ord.totalPaymentPrice : '') +
      ' totalPrice=' +
      String(ord.totalPrice != null ? ord.totalPrice : '')
  );

  function logObjKeys_(label, o) {
    if (o == null || typeof o !== 'object') {
      Logger.log(label + ' (null/비객체)');
      return;
    }
    var keys = Object.keys(o).sort();
    var ki;
    for (ki = 0; ki < keys.length; ki++) {
      var k = keys[ki];
      var v = o[k];
      var s = v != null && typeof v === 'object' ? JSON.stringify(v) : String(v);
      if (s.length > 500) {
        s = s.slice(0, 500) + '…';
      }
      Logger.log(label + '.' + k + '=' + s);
    }
  }

  var secs = ord.sections;
  if (!Array.isArray(secs)) {
    Logger.log('[imwebDebugLogOrderToLogger] sections 없음');
    return;
  }
  var sidx;
  for (sidx = 0; sidx < secs.length; sidx++) {
    var sec = secs[sidx] || {};
    Logger.log('--- section[' + sidx + '] orderSectionStatus=' + String(sec.orderSectionStatus != null ? sec.orderSectionStatus : ''));
    logObjKeys_('  cancelInfo', sec.cancelInfo);
    logObjKeys_('  returnInfo', sec.returnInfo);
    var its = sec.sectionItems;
    if (!Array.isArray(its)) {
      continue;
    }
    var ii;
    for (ii = 0; ii < its.length; ii++) {
      var it = its[ii] || {};
      var pi = it.productInfo || {};
      Logger.log(
        '  sectionItem[' +
          ii +
          '] orderSectionItemNo=' +
          String(it.orderSectionItemNo != null ? it.orderSectionItemNo : '') +
          ' itemPrice(raw)=' +
          String(pi.itemPrice != null ? pi.itemPrice : '') +
          ' gradeDiscount=' +
          String(it.gradeDiscount != null ? it.gradeDiscount : '') +
          ' itemCouponDiscount=' +
          String(it.itemCouponDiscount != null ? it.itemCouponDiscount : '') +
          ' itemPointAmount=' +
          String(it.itemPointAmount != null ? it.itemPointAmount : '') +
          ' itemPromotionDiscount=' +
          String(it.itemPromotionDiscount != null ? it.itemPromotionDiscount : '')
      );
      var mapped = dbMapOrderItemRowOpen_(ord, sec, it, '', 'debug');
      var lp = dbNumO_(mapped[10]);
      var lsale = dbNumO_(mapped[11]);
      var lpt = dbNumO_(mapped[12]);
      var lineNet = lp - lsale - lpt;
      Logger.log(
        '  → 시트 매핑: line_price[10]=' +
          mapped[10] +
          ' line_price_sale[11]=' +
          mapped[11] +
          ' line_point[12]=' +
          mapped[12] +
          ' line_coupon[13]=' +
          mapped[13] +
          ' claim_status[5]=' +
          mapped[5] +
          ' claim_event_time[7]=' +
          mapped[7] +
          ' | line_net(02식)=' +
          lineNet
      );
    }
  }
  Logger.log('[imwebDebugLogOrderToLogger] 끝');
}
