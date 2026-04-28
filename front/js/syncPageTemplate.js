/**
 * id 접두 `sp-`
 */
export const SYNC_PAGE_SHELL_HTML = `<div class="app-shell app-shell--v9">
      <header class="app-header">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true"></span>
          <div>
            <div class="brand__title">솔루션편입 대시보드</div>
            <p class="sp-cdn-build" id="sp-cdnBuild" title="" hidden aria-label="화면 버전 표시. 임웹 스니펫과 같은 배포인지 확인할 때 참고"></p>
          </div>
        </div>
        <div class="sp-intro-wrap">
          <div class="sp-intro-card sp-intro-card--an" id="sp-introAn" aria-hidden="false">
            <p class="sp-intro-title">매출·구매 건수 지표 · 사용 안내</p>
            <ul class="sp-intro-list">
              <li><strong>이 탭</strong>은 실제 <strong>매출(원) 목표</strong>와 <strong>인원(건수) 목표</strong>를 <strong>숫자로</strong> 모아 두는 곳입니다. <strong>꺾은선·막대 그래프는 없고</strong>, <strong>표(칸)</strong>로만 보고 고칩니다. (연동·상품분류·이 목표는 <strong>드라이브에 파일이 셋</strong>으로 갈립니다.)</li>
              <li><strong>드라이브에 저장</strong>을 누르면, 아래 표에 올라와 있는 <strong>목표 줄</strong>이 <strong>팀 구글 드라이브</strong>의 <strong>이 지표용 파일</strong>에 담깁니다. <strong>처음 한 번</strong>은 <strong>데이터 생성</strong>이 필요할 수 있고, <strong>생성이 안 될 때</strong>는 <strong>「데이터 동기화」</strong>를 한번 실행한 뒤에 다시 시도합니다.</li>
              <li><strong>월별 목표 입력</strong>에서는 <strong>전체·솔패스·챌린지·솔루틴</strong> 중 하나만 고르고 매출·건수를 넣습니다(위 일별 매출 보기 범위와 같습니다). <strong>연간</strong>을 고르면 그 해 한 줄 목표로 넣습니다.</li>
              <li><strong>매출</strong> / <strong>건수(인원)</strong> 버튼은 <strong>같은 표</strong>에서 <strong>어느 칸을 굵게 볼지</strong>만 바꿉니다. <strong>실적 목표 표</strong>는 위에서 고른 <strong>연도</strong>에 넣어 둔 목표를 <strong>월·목표 구분 상관없이 한꺼번에</strong> 보여 줍니다(일별 표의 <strong>보기 범위</strong>와 무관). <strong>연간 한 줄</strong>만 보려면 <strong>연간 목표만</strong>을 켭니다.</li>
              <li><strong>전부 초기화</strong>는 여기에 쌓인 목표와 일부 자동 캐시를 비웁니다. 팀에 공지한 뒤에만 누릅니다.</li>
            </ul>
          </div>
          <div class="sp-intro-card sp-intro-card--sync" id="sp-introSync" hidden aria-hidden="true">
            <p class="sp-intro-title">데이터 동기화 · 사용 안내</p>
            <ul class="sp-intro-list">
              <li>아임웹 <strong>솔루션 편입</strong>에 있는 <strong>회원·상품·주문(품목)</strong>을 <strong>팀 구글 드라이브</strong>에 맞춰 올리는 화면입니다. <strong>숫자와 목록</strong>은 <strong>이 탭</strong>에서 쓰는 <strong>연동 파일</strong>에 쌓이고, 위 <strong>구글 드라이브(연동)</strong>로 그 <strong>같은 파일</strong>을 엽니다. <strong>품목 분류</strong>는 <strong>「상품 항목 분류」</strong> 메뉴의 <strong>다른 파일</strong>입니다.</li>
              <li><strong>실행</strong>을 누를 때마다, 그때 맞춰 둔 아임웹 데이터가 <strong>그 드라이브 파일</strong>에 <strong>통째로</strong> 다시 올라갑니다. <strong>손으로 적어 둔 메모·수식</strong>은 <strong>덮어쓸 수 있으니</strong>, 꼭 남길 내용은 <strong>실행 전</strong>에 복사하거나 옮깁니다.</li>
              <li>잘못 누르는 실수를 줄이려고, 확인 칸에 <strong>「데이터 동기화」</strong>를 <strong>한 글자도 틀리지 않게</strong> 적은 뒤에만 <strong>실행</strong>됩니다.</li>
              <li>한 번에 <strong>수 분</strong> 걸릴 수 있습니다. 끝나면 안내·<strong>드라이브에서 보기</strong>로 건수를 보고, <strong>구글 드라이브</strong>에서 눈으로도 한 번 확인합니다.</li>
              <li>상단 배지가 <strong>연결됨</strong>이면 정상입니다. <strong>연결 안 됨</strong>이면 <strong>담당자에게</strong> 연락해 주세요.</li>
            </ul>
          </div>
          <div class="sp-intro-card sp-intro-card--pm" id="sp-introPm" hidden>
            <p class="sp-intro-title">상품 항목 분류 · 사용 안내</p>
            <ul class="sp-intro-list">
              <li>팀에서 정한 흐름으로, <strong>매출·주문 같은 수치</strong>는 <strong>「데이터 동기화」</strong> 쪽 <strong>드라이브 파일</strong>에 쌓고, <strong>각 품목이 어느 강좌/상품군에 붙는지, 지금 어떻게 취급할지</strong>는 <strong>「상품 항목 분류」</strong>에 쓰는 <strong>드라이브</strong>에 적어 둡니다. 그 파일 맨 앞 <strong>「품목 분류」</strong> 칸에 저장합니다. 위 <strong>구글 드라이브(상품·분류)</strong>로 갑니다.</li>
              <li><strong>상품군</strong>은 품목을 <strong>솔패스·솔루틴·챌린지·교재·자소서·아직 정하지 않음</strong> 중 어디로 묶어 볼지 정하는 <strong>큰 이름표</strong>입니다. <strong>매출·구매 건수</strong> 탭과 <strong>같은 기준</strong>으로 맞춥니다.</li>
              <li><strong>상태</strong>는 <strong>같은 품목도 운영·노출을 어떻게 볼지</strong>를 나눈 값입니다. <strong>진행</strong>은 지금 취급하는 판매 품목, <strong>만료</strong>는 <strong>상품은 판매 대상이지만(상품이 살아 있지만) 판매(노출) 기간이 끝난</strong> 경우, <strong>테스트</strong>는 시험·검수용, <strong>(구)상품</strong>은 <strong>판매를 완전히 끝냈거나, 대체 상품이 올라와 예전 품목으로만</strong> 보는 경우에 맞춥니다.</li>
              <li><strong>회원·주문 반영</strong>은 <strong>데이터 동기화</strong> 탭에서, <strong>이 탭</strong>에서는 품목 <strong>분류·상태</strong>만 손댑니다. 파일이 아직 없으면 <strong>상품 불러오기</strong>로 먼저 만듭니다.</li>
              <li>드롭다운을 바꾼 뒤 <strong>수정하기</strong>를 눌러 <strong>구글 쪽</strong>에 반영합니다. 끝나면 잠시 뒤 목록이 다시 그려집니다. 바꾼 내용이 없으면 <strong>수정하기</strong>는 켜지지 않습니다.</li>
              <li><strong>데이터 초기화</strong>는 <strong>품목 분류 시트</strong>에 적어 둔 것을 비우고, <strong>동기화</strong>에 올라와 있는 <strong>상품 목록</strong>을 기준으로 <strong>처음부터</strong> 다시 채웁니다. 팀에 공지한 뒤에만(돌이킬 수 없습니다).</li>
              <li><strong>상태</strong>를 <strong>테스트</strong>로 둔 품목은, 위쪽 상품군 박스가 아니라 <strong>아래 붉은「상태·시험용」</strong> 구역에만 모여 보입니다(같은 품목이 두 번 나오지 않게 한 규칙입니다).</li>
              <li><strong>상품군 미정만</strong>을 켜면 <strong>아직 상품군을 고르지 않은</strong> 품목만 볼 수 있습니다. 검색은 <strong>상품 이름·상품 번호</strong>에 맞습니다.</li>
            </ul>
          </div>
        </div>
      </header>

      <div class="sp-app-outer">
        <nav class="sp-tabs" role="tablist" aria-label="메뉴">
          <button
            type="button"
            class="sp-tabs__btn is-active"
            id="sp-tab-an"
            role="tab"
            aria-selected="true"
            aria-controls="sp-panel-an"
            tabindex="0"
          >매출·구매 건수</button>
          <button
            type="button"
            class="sp-tabs__btn"
            id="sp-tab-sync"
            role="tab"
            aria-selected="false"
            aria-controls="sp-panel-sync"
            tabindex="-1"
          >데이터 동기화</button>
          <button
            type="button"
            class="sp-tabs__btn"
            id="sp-tab-pm"
            role="tab"
            aria-selected="false"
            aria-controls="sp-panel-pm"
            tabindex="-1"
          >상품 항목 분류</button>
        </nav>

        <main class="app-main sp-app-main" id="sp-main">
        <div class="sp-overlay" id="sp-loadingOverlay" hidden aria-hidden="true">
          <div class="sp-overlay-box">
            <div class="sp-spinner" role="status" aria-label="데이터 처리 중"></div>
            <p class="sp-overlay-text" id="sp-loadingOverlay-title">데이터 반영 중</p>
            <p class="sp-overlay-sub" id="sp-loadingOverlay-desc">잠시만 기다려 주세요. 수 분 걸릴 수 있습니다.</p>
          </div>
        </div>
        <div class="sp-overlay sp-an-busy-overlay" id="sp-an-loadingOverlay" hidden aria-hidden="true">
          <div class="sp-overlay-box">
            <div class="sp-spinner" role="status" aria-label="불러오는 중"></div>
            <p class="sp-overlay-text" id="sp-an-loadingOverlay-title">불러오는 중</p>
            <p class="sp-overlay-sub" id="sp-an-loadingOverlay-desc">매출·구매 건수 표를 준비합니다. 잠시만 기다려 주세요.</p>
          </div>
        </div>

        <div class="sp-tab-panels">
        <section
          class="sp-tab-panel is-active"
          id="sp-panel-an"
          role="tabpanel"
          aria-labelledby="sp-tab-an"
        >
          <div class="panel panel--hero" id="sp-an-root">
            <div class="panel__head sp-an-head">
              <div class="sp-panel-eyebrow" id="sp-an-eyebrow" role="heading" aria-level="2">솔루션편입 · 매출·구매 건수</div>
              <div class="sp-an-head__right" id="sp-an-external" hidden>
                <a
                  class="btn btn--secondary sp-sync-head__link sp-an-head__cta"
                  id="sp-an-linkSheet"
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  hidden
                >드라이브(일/월간 지표)</a>
              </div>
            </div>
            <div class="sp-confirm-block sp-an-block" id="sp-an-block">
              <p class="sp-confirm-instruct" id="sp-an-instruct">
                아래는 <strong>매출 현황</strong>과 <strong>구매 건수 현황</strong> 두 덩어리로 나뉩니다. 숫자는 모두 <strong>데이터 동기화</strong> 주문을 기준으로 하며, 목표·드라이브 저장은 매출 쪽에서만 씁니다.
              </p>
              <p class="sp-pm__hint" id="sp-an-hint" hidden></p>
              <div class="sp-confirm-row">
                <button type="button" class="btn btn--secondary" id="sp-an-btnExportBundleTop">통합 시트 저장</button>
                <button type="button" class="btn btn--danger" id="sp-an-btnRebuildAnalytics" title="지표 DB를 다시 생성/연결하고, 집계 데이터를 다시 채웁니다.">지표 DB 초기화(재생성)</button>
              </div>
              <div class="sp-an-pillar sp-an-pillar--sales" id="sp-an-pillarSales">
                <div class="sp-an-pillar__title" role="heading" aria-level="2">매출 현황</div>
                <p class="sp-an-pillar__lede">선택한 연·월 실적 요약과 <strong>목표 표</strong> 입력을 한 흐름으로 확인하고 저장합니다.</p>
              <div class="sp-an-salesUnified" id="sp-an-actuals" hidden>
                <div class="sp-an-salesUnified__h" role="heading" aria-level="3">매출 · 선택 기간</div>
                <p class="sp-an-salesUnified__lede" id="sp-an-actualsLede" aria-live="polite">위 <strong>연도·월</strong>에서 월을 <strong>전체</strong>로 두면 일별 순매출은 그 해 1~12월을 한 번에 봅니다. 아래 <strong>실적 목표 표</strong>는 <strong>연도</strong>만 맞으면 넣어 둔 목표를 모두 보여 주며, <strong>일별 순매출의 보기 범위</strong>와는 별개입니다. 맨 위 카드의 <strong>실제 매출·주문</strong>은 그 <strong>보기 범위</strong>(전체·솔패스·챌린지·솔루틴)에 맞춰 집계하고, 막대·목표 둘째 줄도 <strong>같은 범위의 목표</strong>와 맞춥니다(전체: 한 줄 또는 분류별 합). <strong>연간 목표만</strong>을 켜면 표는 연간 행만 보이게 좁히고 스크롤합니다. 숫자는 <strong>상품군 미정</strong>만 빼고(교재·자소서 포함), <strong>시험용·관리자·테스트 주문</strong>도 뺍니다.</p>
                <div class="sp-an-filters sp-an-filters--period" id="sp-an-filters">
                  <label class="sp-an-filters__f"><span class="sp-pm-filters__lbl">연도</span>
                    <select class="sp-confirm" id="sp-an-filterY" title="실적 요약·일별 표·목표 표(연도 필터)에 쓰는 연도"></select>
                  </label>
                  <label class="sp-an-filters__f"><span class="sp-pm-filters__lbl">월</span>
                    <select class="sp-confirm" id="sp-an-filterM" title="맨 위 실적 카드·일별 순매출 표 기간. 목표 표는 연도만 맞으면 월·목표 구분 전부 표시(이 셀렉트와 무관)">
                      <option value="0">전체</option>
                      <option value="1">1월</option>
                      <option value="2">2월</option>
                      <option value="3">3월</option>
                      <option value="4">4월</option>
                      <option value="5">5월</option>
                      <option value="6">6월</option>
                      <option value="7">7월</option>
                      <option value="8">8월</option>
                      <option value="9">9월</option>
                      <option value="10">10월</option>
                      <option value="11">11월</option>
                      <option value="12">12월</option>
                    </select>
                  </label>
                  <button type="button" class="btn btn--secondary sp-an-btnKpiAnnual" id="sp-an-btnKpiAnnual" aria-pressed="false" title="켜면 아래 목표 표에서 연간 한 줄 목표만 봅니다. 실적·일별 표는 위에서 고른 월 그대로입니다.">연간 목표만</button>
                </div>
                <div class="sp-an-actuals__cards sp-an-actuals__cards--tworow" id="sp-an-actualsCards" aria-label="선택 기간 실적·비교">
                  <div class="sp-an-metric-row">
                    <div class="sp-an-card sp-an-card--meter" id="sp-an-cardSales">
                      <span class="sp-an-card__lbl">실제 매출(원)<span class="sp-an-card__lbl-note">(상품군 미정 제외)</span></span>
                      <div class="sp-an-card__value-row">
                        <span class="sp-an-card__val" id="sp-an-valSales">—</span>
                        <span class="sp-an-card__pct" id="sp-an-pctSales"></span>
                      </div>
                      <div class="sp-an-meter" aria-hidden="true"><div class="sp-an-meter__fill" id="sp-an-meterSales"></div></div>
                    </div>
                    <div class="sp-an-card sp-an-card--meter" id="sp-an-cardOrders">
                      <span class="sp-an-card__lbl">주문 건수<span class="sp-an-card__lbl-note">(상품군 미정 제외)</span></span>
                      <div class="sp-an-card__value-row">
                        <span class="sp-an-card__val" id="sp-an-valOrders">—</span>
                        <span class="sp-an-card__pct" id="sp-an-pctOrders"></span>
                      </div>
                      <div class="sp-an-meter" aria-hidden="true"><div class="sp-an-meter__fill" id="sp-an-meterOrders"></div></div>
                    </div>
                  </div>
                  <div class="sp-an-metric-row sp-an-metric-row--secondary" id="sp-an-actSecondary">
                    <div class="sp-an-metric-row2-head">
                      <div class="sp-an-metric-row2__title" id="sp-an-actRow2Title" role="heading" aria-level="4">이번 기간 목표</div>
                      <p class="sp-an-metric-row2__sub" id="sp-an-actRow2Sub" hidden></p>
                    </div>
                    <div class="sp-an-metric-row2-cards">
                      <div class="sp-an-card sp-an-card--plain">
                        <span class="sp-an-card__lbl" id="sp-an-actRow2LblA">매출 목표(원)</span>
                        <span class="sp-an-card__val" id="sp-an-actRow2ValA">—</span>
                      </div>
                      <div class="sp-an-card sp-an-card--plain">
                        <span class="sp-an-card__lbl" id="sp-an-actRow2LblB">주문 목표(건)</span>
                        <span class="sp-an-card__val" id="sp-an-actRow2ValB">—</span>
                      </div>
                    </div>
                  </div>
                </div>
                <p class="sp-an-actuals__warn" id="sp-an-actualsWarn" hidden></p>
                <div class="sp-an-vizSection" id="sp-an-viz" hidden>
                  <div class="sp-an-viz__subhead">
                    <div class="sp-an-viz__h4" id="sp-an-vizHeading" role="heading" aria-level="4"><span class="sp-an-viz__h4-main">일별 순매출</span> <span class="sp-an-viz__h4-meta" id="sp-an-vizPeriodMeta"></span></div>
                    <div class="sp-an-viz__toolbar" id="sp-an-vizToolbar">
                      <label class="sp-an-filters__f"><span class="sp-pm-filters__lbl">보기 범위</span>
                        <select class="sp-confirm" id="sp-an-vizScope" title="일별 순매출 격자와 맨 위 실적 카드(실제·목표)가 함께 따르는 범위입니다">
                          <option value="entire">전체(사이트) — 상품군별</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <div class="sp-an-viz__scopeStrip" id="sp-an-vizScopeStrip" aria-label="보기 범위 기준 요약"></div>
                  <p class="sp-an-viz__lede" id="sp-an-vizLede">위에서 고른 <strong>연·월</strong>에 맞춰 <strong>가로 날짜 · 세로 상품군(또는 단품)</strong> 격자로 순매출을 봅니다.</p>
                  <p class="sp-an-viz__warn" id="sp-an-vizWarn" hidden></p>
                  <div class="sp-an-viz-scroll" id="sp-an-vizScroll" role="region" aria-label="일별 순매출 표"></div>
                </div>
              </div>
              <div class="sp-pm__loading sp-an-loading" id="sp-an-loading" hidden role="status" aria-live="polite">데이터를 불러오는 중…</div>
              <div class="sp-pm-init" id="sp-an-init" hidden>
                <p class="sp-pm-init__lede" id="sp-an-initLede">목표를 드라이브 표에 쓰려면 먼저 여기서 <strong>지표용 파일</strong>을 만듭니다. <strong>위 실적 요약</strong>은 동기화만 되어 있으면 됩니다. 문제가 생기면 이 파일을 다시 만들어 전체를 새로 시작합니다.</p>
                <div class="sp-confirm-row sp-pm-init__row">
                  <button type="button" class="btn btn--primary" id="sp-an-btnInit">지표용 드라이브 파일 만들기</button>
                </div>
              </div>
              <div id="sp-an-body" hidden>
                <div class="sp-an-kpi" id="sp-an-kpi">
                <div class="sp-an-kpi__headblock" role="group" aria-label="실적 목표 표">
                  <div class="sp-an-kpi__headtitle" id="sp-an-kpiHeadTitle" role="heading" aria-level="3">실적 목표 표</div>
                <div class="sp-an-subtabs" role="tablist" aria-label="목표 표에서 강조할 칸">
                  <button type="button" class="sp-an-subtabs__btn is-active" id="sp-an-subSales" role="tab" aria-selected="true" aria-controls="sp-an-tableWrap" tabindex="0">매출</button>
                  <button type="button" class="sp-an-subtabs__btn" id="sp-an-subCount" role="tab" aria-selected="false" aria-controls="sp-an-tableWrap" tabindex="-1">건수</button>
                </div>
                <p class="sp-an-subtabs__lede" id="sp-an-subLede" aria-live="polite">아래 <strong>목표</strong> 표에서 <strong>매출(원)</strong> 열이 더 잘 보이게 켠 상태입니다.</p>
                <p class="sp-an-table-legend" id="sp-an-tableLegend">▸ 위에서 고른 <strong>연도</strong>에 저장해 둔 <strong>목표</strong>가 <strong>월·목표 구분 전부</strong> 여기에 보입니다(일별 표 <strong>보기 범위</strong>를 바꿔도 사라지지 않습니다). <strong>연간 목표만</strong>을 켜면 연간(월 0) 행만 좁혀 봅니다. 맨 위 카드는 <strong>보기 범위</strong>에 맞는 목표·실적만 비교합니다.</p>
                <div class="sp-an-table-wrap" id="sp-an-tableWrap" role="tabpanel" aria-labelledby="sp-an-subSales">
                  <div class="sp-an-table-scroll">
                    <table class="sp-an-table sp-an-table--mode-sales" id="sp-an-table">
                      <thead>
                        <tr>
                          <th>연</th>
                          <th>월</th>
                          <th>목표 구분</th>
                          <th class="sp-an-table__em-sales">매출목표(원)</th>
                          <th class="sp-an-table__em-count">건수목표</th>
                          <th>비고</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody id="sp-an-tbody"></tbody>
                    </table>
                  </div>
                </div>
                </div>
                <details class="sp-an-kpi__fold" id="sp-an-kpiFormFold">
                  <summary class="sp-an-kpi__sum">월별 목표 입력 <span class="sp-an-kpi__sum-hint">(클릭하여 열기·닫기)</span></summary>
                <div class="sp-an-add" id="sp-an-form">
                  <div class="sp-an-add__row sp-an-add__row--inline">
                    <label class="sp-an-add__field sp-an-add__field--y"><span class="sp-an-add__lbl">연</span> <input type="number" class="sp-confirm" id="sp-an-inY" min="2000" max="2100" step="1" /></label>
                    <label class="sp-an-add__field sp-an-add__field--m"><span class="sp-an-add__lbl">월</span>
                      <select class="sp-confirm" id="sp-an-inM" title="0·연간을 고르면 그 해 한 줄 목표로 넣습니다"></select>
                    </label>
                    <label class="sp-an-add__field sp-an-add__field--goal"><span class="sp-an-add__lbl">목표 구분</span>
                      <select class="sp-confirm" id="sp-an-inGoalTarget" title="일별 매출 표에서 고르는 범위와 동일: 전체·솔패스·챌린지·솔루틴">
                        <option value="entire">전체</option>
                        <option value="solpass">솔패스</option>
                        <option value="challenge">챌린지</option>
                        <option value="solutine">솔루틴</option>
                      </select>
                    </label>
                    <label class="sp-an-add__field sp-an-add__field--amt"><span class="sp-an-add__lbl">매출(원)</span> <input type="number" class="sp-confirm" id="sp-an-inAmt" min="0" step="1" /></label>
                    <label class="sp-an-add__field sp-an-add__field--cnt"><span class="sp-an-add__lbl">건수</span> <input type="number" class="sp-confirm" id="sp-an-inCnt" min="0" step="1" /></label>
                    <label class="sp-an-add__field sp-an-add__field--notes"><span class="sp-an-add__lbl">비고</span>
                    <input type="text" class="sp-confirm" id="sp-an-inNotes" maxlength="200" />
                    </label>
                  </div>
                  <div class="sp-an-add__ctas">
                    <button type="button" class="btn btn--secondary" id="sp-an-btnAdd">이 줄을 표에 넣기</button>
                    <button type="button" class="btn btn--primary" id="sp-an-btnSave">지금 드라이브에 다시 저장</button>
                    <button type="button" class="btn btn--danger" id="sp-an-btnReset">전부 초기화</button>
                  </div>
                </div>
                </details>
                </div>
              </div>
              </div>

              <div class="sp-an-pillar sp-an-pillar--buyers" id="sp-an-pillarBuyers">
                <div class="sp-an-pillar__title" role="heading" aria-level="2">구매 건수 현황</div>
                <p class="sp-an-pillar__lede">선택한 달 기준으로, 날짜·상품별 <strong>구매 건수</strong>(주문에 담긴 품목 줄 수와 같습니다)를 봅니다.</p>
              <div class="sp-an-people" id="sp-an-people" hidden>
                <div class="sp-an-people__toolbar" id="sp-an-peopleToolbar">
                  <label class="sp-an-filters__f"><span class="sp-pm-filters__lbl">연도</span>
                    <input type="number" class="sp-confirm" id="sp-an-peopleY" min="2000" max="2100" step="1" title="표에 쓸 연도" />
                  </label>
                  <label class="sp-an-filters__f"><span class="sp-pm-filters__lbl">월</span>
                    <select class="sp-confirm" id="sp-an-peopleM" title="이 달 일별 표에 쓸 월"></select>
                  </label>
                </div>
                <p class="sp-an-people__lede" id="sp-an-peopleLede">아래 표는 선택한 연·월의 날짜별 구매 건수입니다. <strong>품목 분류</strong>에서 <strong>지금 판매 중(진행)</strong>으로 두었고, 이 달과 판매 기간이 겹치는 품목만 보입니다(상품군 미정·판매 종료·시험용·옛 상품 제외, 교재는 한 줄로 합칩니다).</p>
                <p class="sp-an-people__warn" id="sp-an-peopleWarn" hidden></p>
                <p class="sp-an-subcap">이 달 — 날짜별 × 상품</p>
                <div class="sp-an-people-scroll" id="sp-an-peopleGrid" role="region" aria-label="이 달 일자별 상품 구매 건수"></div>
                <div class="sp-an-people-year" id="sp-an-peopleYearWrap">
                  <div class="sp-an-people-year__title" role="heading" aria-level="3">연도별 월 합계 · 상품군별</div>
                  <div class="sp-an-people-scroll" id="sp-an-peopleMatrix" role="region" aria-label="선택 연도 월별 상품군 구매 건수"></div>
                </div>
              </div>
              </div>

            </div>
          </div>
        </section>

        <section
          class="sp-tab-panel"
          id="sp-panel-sync"
          role="tabpanel"
          aria-labelledby="sp-tab-sync"
          hidden
        >
        <div class="panel panel--hero">
          <div class="panel__head sp-sync-head">
            <div class="sp-panel-eyebrow" id="sp-panel-sync-h" role="heading" aria-level="2">데이터 동기화</div>
            <div class="sp-sync-head__right">
              <span class="chip chip--soft" id="sp-envChip">연결 안 됨</span>
              <a
                class="btn btn--secondary sp-sync-head__link"
                id="sp-syncLinkAggregate"
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                hidden
              >구글 드라이브(연동)</a>
            </div>
          </div>
          <div class="sp-confirm-block">
            <p class="sp-confirm-instruct">아래 칸에 <strong>「데이터 동기화」</strong>를 한 글자도 틀리지 않게 입력한 뒤 <strong>실행</strong>을 누릅니다.</p>
            <label class="sp-confirm-label" for="sp-confirm">확인 입력</label>
            <div class="sp-confirm-row">
              <input type="text" class="sp-confirm" id="sp-confirm" name="sp-confirm" autocomplete="off" spellcheck="false" disabled placeholder="데이터 동기화" />
              <button type="button" class="btn btn--primary" id="sp-btnSync" disabled>실행</button>
            </div>
            <p class="actions-note" id="sp-actionNote"></p>
            <div class="sp-feedback" id="sp-feedback" hidden>
              <p class="sp-feedback__main" id="sp-statusLine"></p>
              <p class="sp-feedback__sub" id="sp-hintLine"></p>
              <div class="sp-success-actions" id="sp-successActions" hidden>
                <a
                  class="btn btn--secondary"
                  id="sp-sheetsLink"
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  hidden
                >드라이브에서 보기</a>
              </div>
            </div>
          </div>
        </div>
        </section>

        <section
          class="sp-tab-panel"
          id="sp-panel-pm"
          role="tabpanel"
          aria-labelledby="sp-tab-pm"
          hidden
        >
          <div class="panel panel--hero" id="sp-pm-root">
            <div class="panel__head sp-pm-head">
              <div class="sp-panel-eyebrow" id="sp-pm-eyebrow" role="heading" aria-level="2">상품 항목 분류</div>
              <div class="sp-pm-head__right sp-pm-external" id="sp-pm-external" hidden>
                <a
                  class="sp-pm-external__link"
                  id="sp-pm-linkOps"
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  hidden
                  >구글 드라이브(상품·분류)</a
                >
              </div>
            </div>
            <div class="sp-pm-hero__actions" id="sp-pm-heroActions">
                <div class="sp-pm-hero__ctas" id="sp-pm-heroCtas">
                  <button type="button" class="btn btn--primary sp-pm-apply" id="sp-pm-apply" disabled>수정하기</button>
                  <button
                    type="button"
                    class="btn btn--danger sp-pm-reset"
                    id="sp-pm-reset"
                    hidden
                    title="품목 분류 시트에 적어 둔 내용을 비우고, 데이터 동기화에 올라와 있는 상품 목록 기준으로 다시 채웁니다. 편집한 내용이 사라집니다."
                    aria-label="데이터 초기화: 품목 분류를 동기화된 상품 목록 기준으로 다시 맞춤"
                  >데이터 초기화</button>
                </div>
                <p class="sp-pm-reset-note" id="sp-pm-resetNote" hidden>위 작업은 <strong>되돌릴 수 없습니다</strong>. 팀에 공유한 뒤 누르세요.</p>
            </div>
            <div class="sp-confirm-block sp-pm-confirm" id="sp-pm-confirm">
              <p class="sp-confirm-instruct" id="sp-pm-instruct"><strong>데이터 동기화</strong>로 올라온 <strong>상품 목록</strong>에 맞춰, <strong>상품 분류</strong>용 <strong>구글 드라이브</strong>에 <strong>상품군</strong>·<strong>상태</strong>를 적어 둡니다(솔패스·솔루틴·챌린지·교재·자소서 등). <strong>처음</strong>이면 <strong>상품 불러오기</strong>로 <strong>품목 분류</strong> 시트가 들어 있는 파일을 만듭니다.</p>
              <p class="sp-pm__hint" id="sp-pm-hint" hidden></p>
              <div class="sp-pm-init" id="sp-pm-init" hidden>
                <div class="sp-confirm-row sp-pm-init__row">
                  <button type="button" class="btn btn--primary" id="sp-pm-btnInit">상품 불러오기</button>
                </div>
              </div>
              <div class="sp-pm-filters" id="sp-pm-filters" hidden>
                <label class="sp-pm-filters__s"><span class="sp-pm-filters__lbl">검색</span>
                  <input type="search" class="sp-confirm sp-pm__search" id="sp-pm-search" placeholder="상품명, 번호" autocomplete="off" />
                </label>
                <label class="sp-pm-filters__c"><input type="checkbox" id="sp-pm-onlyUnmapped" />
                  <span>상품군 미정만</span>
                </label>
              </div>
              <div class="sp-pm__loading" id="sp-pm-listLoading" hidden role="status" aria-live="polite">데이터를 불러오는 중…</div>
              <div class="sp-pm-sections" id="sp-pm-sections" hidden></div>
              <p class="actions-note sp-pm__footer-note" id="sp-pm-footerNote" hidden>편집한 뒤 <strong>수정하기</strong>로 <strong>구글 드라이브</strong>에 반영합니다. 드롭다운을 바꾸면 <strong>수정하기</strong>가 켜집니다.</p>
            </div>
          </div>
        </section>
        </div>
        </main>
      </div>
    </div>`;
