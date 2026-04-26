/**
 * id 접두 `sp-`
 */
export const SYNC_PAGE_SHELL_HTML = `<div class="app-shell app-shell--v9">
      <header class="app-header">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true"></span>
          <div>
            <h1>솔루션편입 대시보드</h1>
            <p class="sp-cdn-build" id="sp-cdnBuild" title="" hidden aria-label="프론트 jsDelivr 핀(임웹에 넣은 스니펫과 Network의 app.js @ 일치)"></p>
          </div>
        </div>
        <div class="sp-intro-wrap">
          <div class="sp-intro-card sp-intro-card--an" id="sp-introAn" aria-hidden="false">
            <p class="sp-intro-title">매출·구매 인원(라인) 지표 · 사용 안내</p>
            <ul class="sp-intro-list">
              <li><strong>이 탭</strong>은 실제 <strong>매출(원) 목표</strong>와 <strong>인원(건수) 목표</strong>를 <strong>숫자로</strong> 모아 두는 곳입니다. <strong>꺾은선·막대 그래프는 없고</strong>, <strong>표(칸)</strong>로만 보고 고칩니다. (연동·상품분류·이 목표는 <strong>드라이브에 파일이 셋</strong>으로 갈립니다.)</li>
              <li><strong>드라이브에 저장</strong>을 누르면, 아래 표에 올라와 있는 <strong>목표 줄</strong>이 <strong>팀 구글 드라이브</strong>의 <strong>이 지표용 파일</strong>에 담깁니다. <strong>처음 한 번</strong>은 <strong>데이터 생성</strong>이 필요할 수 있고, <strong>생성이 안 될 때</strong>는 <strong>「데이터 동기화」</strong>를 한번 실행한 뒤에 다시 시도합니다.</li>
              <li><strong>범위</strong>를 <strong>대분류</strong>로 두면 <strong>상품 항목 분류</strong>에 맞는 상품군(솔패스, 미분류 등)에 맞게, <strong>상품</strong>이면 <strong>상품 번호</strong>를 넣습니다. <strong>월 0(연간)</strong>이면 그 해 한 줄에 잡는 연간 목표로 둡니다.</li>
              <li><strong>매출</strong> / <strong>건수(인원)</strong> 버튼은 <strong>같은 표</strong>에서 <strong>어느 칸을 굵게 볼지</strong>만 바꿉니다. 위 <strong>연도·월</strong>을 고르면 <strong>그 조건에 맞는 행</strong>만 남깁니다.</li>
              <li><strong>전부 초기화</strong>는 여기에 쌓인 목표와 일부 자동 캐시를 비웁니다. 팀에 공지한 뒤에만 누릅니다.</li>
            </ul>
          </div>
          <div class="sp-intro-card sp-intro-card--sync" id="sp-introSync" hidden aria-hidden="true">
            <p class="sp-intro-title">데이터 동기화 · 사용 안내</p>
            <ul class="sp-intro-list">
              <li>아임웹 <strong>솔루션 편입</strong>에 묶인 <strong>회원·상품·주문(품목)</strong>을 <strong>팀 구글 드라이브(연동·원본 쪽)</strong>에 맞춰 올리는 화면입니다. <strong>숫자·원천 목록</strong>은 <strong>이 탭</strong>이 쓰는 <strong>그 파일</strong>에 쌓이고, 위 <strong>구글 드라이브(연동)</strong>로 그 <strong>같은 곳</strong>을 엽니다. <strong>품목 분류</strong>는 <strong>「상품 항목 분류」</strong>·<strong>다른 파일</strong>입니다.</li>
              <li><strong>실행</strong>을 누를 때마다, 그때 맞춰 둔 아임웹 데이터가 <strong>그 드라이브 파일</strong>에 <strong>통째로</strong> 다시 올라갑니다. <strong>손으로 적어 둔 메모·수식</strong>은 <strong>덮어쓸 수 있으니</strong>, 꼭 남길 내용은 <strong>실행 전</strong>에 복사하거나 옮깁니다.</li>
              <li>잘못 누르는 실수를 줄이려고, 확인 칸에 <strong>「데이터 동기화」</strong>를 <strong>한 글자도 틀리지 않게</strong> 적은 뒤에만 <strong>실행</strong>됩니다.</li>
              <li>한 번에 <strong>수 분</strong> 걸릴 수 있습니다. 끝나면 안내·<strong>드라이브에서 보기</strong>로 건수를 보고, <strong>구글 드라이브</strong>에서 눈으로도 한 번 확인합니다.</li>
              <li>상단 배지는 <strong>연결됨</strong>이면 정상입니다. <strong>미연결</strong>이면 <strong>내부 담당자에게</strong> 연락해 주세요.</li>
            </ul>
          </div>
          <div class="sp-intro-card sp-intro-card--pm" id="sp-introPm" hidden>
            <p class="sp-intro-title">상품 항목 분류 · 사용 안내</p>
            <ul class="sp-intro-list">
              <li>팀에서 정한 흐름으로, <strong>연동 수치·원천</strong>은 <strong>「데이터 동기화」</strong> 쪽 <strong>드라이브 파일</strong>에 쌓고, <strong>각 품목이 어느 강좌/상품군에 붙는지, 지금 어떻게 취급할지</strong>는 <strong>「상품 항목 분류」</strong>에 쓰는 <strong>드라이브</strong>에 적어 둡니다. 그 파일 안 <strong>「상품 매핑(분류)」</strong>이 <strong>저장해 두는 쪽(맨 앞/위)</strong>입니다. 위 <strong>구글 드라이브(상품·분류)</strong>로 갑니다.</li>
              <li><strong>내부 대분류</strong>는 품목을 <strong>어느 상품군(솔패스·솔루틴·챌린지·교재·자소서·미분류)</strong>으로 묶어 볼지에 대한 <strong>큰 꼬리표</strong>입니다. <strong>매출·구매 인원</strong> 탭을 <strong>같은 묶음으로</strong> 잡을 때 맞춥니다.</li>
              <li><strong>상태</strong>는 <strong>같은 품목도 운영·노출을 어떻게 볼지</strong>를 나눈 값입니다. <strong>진행</strong>은 지금 취급하는 판매 품목, <strong>만료</strong>는 <strong>상품은 판매 대상이지만(상품이 살아 있지만) 판매(노출) 기간이 끝난</strong> 경우, <strong>테스트</strong>는 시험·검수용, <strong>(구)상품</strong>은 <strong>판매를 완전히 끝냈거나, 대체 상품이 올라와 예전 품목으로만</strong> 보는 경우에 맞춥니다.</li>
              <li><strong>회원·주문 반영</strong>은 <strong>데이터 동기화</strong> 탭에서, <strong>이 탭</strong>에서는 품목 <strong>분류·상태</strong>만 손댑니다. 파일이 아직 없으면 <strong>상품 불러오기</strong>로 먼저 만듭니다.</li>
              <li>드롭다운을 바꾼 뒤 <strong>수정하기</strong>를 눌러 <strong>구글 쪽</strong>에 반영합니다. 끝나면 잠시 뒤 목록이 다시 그려집니다. 바꾼 내용이 없으면 <strong>수정하기</strong>는 켜지지 않습니다.</li>
              <li><strong>데이터 초기화</strong>는 <strong>「상품 매핑(분류)」</strong>에 적어 둔 것을 비우고, <strong>동기화</strong>에 올라와 있는 <strong>상품 목록</strong>을 기준으로 <strong>처음부터</strong> 다시 채웁니다. 팀에 공지한 뒤에만(돌이킬 수 없습니다).</li>
              <li><strong>상태</strong>를 <strong>테스트</strong>로 둔 품목은, 위쪽 대분류 박스가 아니라 <strong>아래 붉은「상태·테스트」</strong> 구역에만 모여 보입니다(대분류랑 겹쳐 두 번 나오지 않게 한 규칙입니다).</li>
              <li><strong>미분류만</strong>을 켜면 <strong>내부 대분류가「미분류」</strong>로 남은 품목만 볼 수 있습니다. 검색은 <strong>상품 이름·상품 번호</strong>에 맞습니다.</li>
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
          >매출·구매 인원</button>
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
            <div class="sp-spinner" role="status" aria-label="로딩"></div>
            <p class="sp-overlay-text">처리 중</p>
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
              <h2 class="sp-panel-eyebrow" id="sp-an-eyebrow">솔루션편입 · 매출·구매 인원</h2>
              <div class="sp-an-head__right" id="sp-an-external" hidden>
                <button type="button" class="btn btn--secondary" id="sp-an-btnRepair" hidden>
                  탭·주문라인 갱신
                </button>
                <a
                  class="btn btn--secondary sp-sync-head__link"
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
                아래는 <strong>매출 현황</strong>과 <strong>구매 인원(라인) 현황</strong> 두 덩어리로 나뉩니다. 숫자는 모두 <strong>데이터 동기화</strong> 주문을 기준으로 하며, 목표·드라이브 저장은 매출 쪽에서만 씁니다.
              </p>
              <p class="sp-pm__hint" id="sp-an-hint" hidden></p>
              <div class="sp-an-pillar sp-an-pillar--sales" id="sp-an-pillarSales">
                <h2 class="sp-an-pillar__title">매출 현황</h2>
                <p class="sp-an-pillar__lede">기간 합계, 일별 순매출 표, 집계에 쓰는 품목 줄 확인·수정, 목표(KPI) 입력까지 이어집니다.</p>
              <div class="sp-an-actuals" id="sp-an-actuals" hidden>
                <h3 class="sp-an-actuals__h">선택 기간 실적</h3>
                <p class="sp-an-actuals__lede" id="sp-an-actualsLede" aria-live="polite">기간을 바꾸면 카드 숫자가 맞춰집니다. 「전체」는 <strong>이번 달</strong>입니다.</p>
                <div class="sp-an-filters" id="sp-an-filters">
                  <label class="sp-an-filters__f sp-an-filters__f--wide"><span class="sp-pm-filters__lbl">기간</span>
                    <select class="sp-confirm" id="sp-an-filterPeriod" title="실적 카드·아래 표·목표 행 필터를 같은 기간으로 맞춥니다"></select>
                  </label>
                </div>
                <div class="sp-an-actuals__cards" id="sp-an-actualsCards" aria-label="선택 기간 합계">
                  <div class="sp-an-card" id="sp-an-cardSales"><span class="sp-an-card__lbl">실제 매출(원)</span><span class="sp-an-card__val" id="sp-an-valSales">—</span></div>
                  <div class="sp-an-card" id="sp-an-cardOrders"><span class="sp-an-card__lbl">주문 건수</span><span class="sp-an-card__val" id="sp-an-valOrders">—</span></div>
                  <div class="sp-an-card" id="sp-an-cardMem"><span class="sp-an-card__lbl">구매자 수(고유)</span><span class="sp-an-card__val" id="sp-an-valMem">—</span></div>
                </div>
                <p class="sp-an-actuals__prev" id="sp-an-actualsPrev" aria-live="polite"></p>
                <p class="sp-an-actuals__warn" id="sp-an-actualsWarn" hidden></p>
              </div>
              <div class="sp-an-viz" id="sp-an-viz" hidden>
                <h3 class="sp-an-viz__title" id="sp-an-vizTitle">솔루션편입 · 일별 순매출</h3>
                <div class="sp-an-viz__toolbar" id="sp-an-vizToolbar">
                  <label class="sp-an-filters__f"><span class="sp-pm-filters__lbl">보기 범위</span>
                    <select class="sp-confirm" id="sp-an-vizScope" title="사이트 전체(대분류 행) 또는 한 대분류(상품 행)">
                      <option value="entire">전체(사이트) — 대분류 행</option>
                    </select>
                  </label>
                </div>
                <p class="sp-an-viz__lede" id="sp-an-vizLede">위 [기간]에서 월까지 고르면, <strong>가로 날짜 · 세로 상품군(또는 단품)</strong> 격자로 순매출을 봅니다. 교재·자소서는 상품군만 묶습니다.</p>
                <p class="sp-an-viz__warn" id="sp-an-vizWarn" hidden></p>
                <div class="sp-an-viz__summary" id="sp-an-vizSummary" aria-label="목표·전년"></div>
                <div class="sp-an-viz-scroll" id="sp-an-vizScroll" role="region" aria-label="일별 순매출 표"></div>
              </div>
              <div class="sp-an-ol" id="sp-an-ol" hidden>
                <h3 class="sp-an-ol__title">품목 줄 · 인정일·집계 반영</h3>
                <p class="sp-an-ol__lede" id="sp-an-olLede">위 [기간]과 같은 달·주문일 기준으로 품목 줄을 불러옵니다. 여기서 바꾼 인정일·집계 제외 여부는 드라이브 집계 시트에도 반영됩니다. 행이 많으면 일부만 보일 수 있습니다.</p>
                <p class="sp-an-ol__warn" id="sp-an-olWarn" hidden></p>
                <div class="sp-an-ol-scroll" id="sp-an-olScroll" role="region" aria-label="품목 줄 인정·집계 반영"></div>
              </div>
              <div class="sp-pm__loading" id="sp-an-loading" hidden>불러오는 중</div>
              <div class="sp-pm-init" id="sp-an-init" hidden>
                <p class="sp-pm-init__lede" id="sp-an-initLede">목표를 드라이브 표에 쓰려면 먼저 여기서 시트를 만듭니다. <strong>위 실적 요약</strong>은 동기화만 되어 있으면 됩니다. 예전 파일만 있을 때는 시트를 연 뒤 <strong>탭·주문라인 갱신</strong>으로 구조를 맞춥니다.</p>
                <div class="sp-confirm-row sp-pm-init__row">
                  <button type="button" class="btn btn--primary" id="sp-an-btnInit">집계용 드라이브 시트 생성</button>
                </div>
              </div>
              <div id="sp-an-body" hidden>
                <details class="sp-an-kpi" id="sp-an-kpi">
                  <summary class="sp-an-kpi__sum">목표(KPI) 표 · 부가 입력</summary>
                <div class="sp-an-subtabs" role="tablist" aria-label="목표 표에서 강조할 칸">
                  <button type="button" class="sp-an-subtabs__btn is-active" id="sp-an-subSales" role="tab" aria-selected="true" aria-controls="sp-an-tableWrap" tabindex="0">매출</button>
                  <button type="button" class="sp-an-subtabs__btn" id="sp-an-subCount" role="tab" aria-selected="false" aria-controls="sp-an-tableWrap" tabindex="-1">건수</button>
                </div>
                <p class="sp-an-subtabs__lede" id="sp-an-subLede" aria-live="polite">아래 <strong>목표</strong> 표에서 <strong>매출(원)</strong> 열이 더 잘 보이게 켠 상태입니다.</p>
                <p class="sp-an-table-legend" id="sp-an-tableLegend">▸ <strong>기간</strong>에 맞는 <strong>목표</strong> 행만 남깁니다(위 <strong>실적 요약</strong>과 별개로, 여기만 손으로 적습니다). 목표가 없으면 <strong>전년 동기</strong> 실적으로 비교하세요.</p>
                <div class="sp-an-table-wrap" id="sp-an-tableWrap" role="tabpanel" aria-labelledby="sp-an-subSales">
                  <div class="sp-an-table-scroll">
                    <table class="sp-an-table sp-an-table--mode-sales" id="sp-an-table">
                      <thead>
                        <tr>
                          <th>연</th>
                          <th>월</th>
                          <th>범위</th>
                          <th>대상</th>
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
                <div class="sp-an-add" id="sp-an-form">
                  <p class="sp-an-add__title">목표 한 줄 입력</p>
                  <div class="sp-an-add__row sp-an-add__row--inline">
                    <label class="sp-an-add__field"><span class="sp-an-add__lbl">연</span> <input type="number" class="sp-confirm" id="sp-an-inY" min="2000" max="2100" step="1" /></label>
                    <label class="sp-an-add__field"><span class="sp-an-add__lbl">월</span>
                      <select class="sp-confirm" id="sp-an-inM" title="0은 연간"></select>
                    </label>
                    <label class="sp-an-add__field"><span class="sp-an-add__lbl">범위</span>
                      <select class="sp-confirm" id="sp-an-inScope">
                        <option value="category">대분류</option>
                        <option value="product">상품</option>
                      </select>
                    </label>
                    <label class="sp-an-add__field sp-an-add__field--grow"><span class="sp-an-add__lbl">대상</span> <input type="text" class="sp-confirm" id="sp-an-inKey" placeholder="대분류 이름 또는 상품 번호" spellcheck="false" /></label>
                    <label class="sp-an-add__field"><span class="sp-an-add__lbl">매출(원)</span> <input type="number" class="sp-confirm" id="sp-an-inAmt" min="0" step="1" /></label>
                    <label class="sp-an-add__field"><span class="sp-an-add__lbl">건수</span> <input type="number" class="sp-confirm" id="sp-an-inCnt" min="0" step="1" /></label>
                    <label class="sp-an-add__field sp-an-add__field--grow"><span class="sp-an-add__lbl">비고</span>
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

              <div class="sp-an-pillar sp-an-pillar--buyers" id="sp-an-pillarBuyers">
                <h2 class="sp-an-pillar__title">구매 인원 현황</h2>
                <p class="sp-an-pillar__lede">한 번의 주문 안의 품목 줄(건)을 세어, 날짜·상품군별로 봅니다. 사람 수가 아니라 <strong>품목 줄 수</strong>입니다.</p>
              <div class="sp-an-people" id="sp-an-people" hidden>
                <div class="sp-an-people__toolbar" id="sp-an-peopleToolbar">
                  <label class="sp-an-filters__f"><span class="sp-pm-filters__lbl">연도</span>
                    <input type="number" class="sp-confirm" id="sp-an-peopleY" min="2000" max="2100" step="1" title="표에 쓸 연도" />
                  </label>
                  <label class="sp-an-filters__f"><span class="sp-pm-filters__lbl">월</span>
                    <select class="sp-confirm" id="sp-an-peopleM" title="이 달 일별 표에 쓸 월"></select>
                  </label>
                </div>
                <p class="sp-an-people__lede" id="sp-an-peopleLede">이 달 표는 선택한 연·월의 품목 줄 수입니다. 연도별 월 합계는 아래를 펼친 뒤에만 불러옵니다.</p>
                <p class="sp-an-people__warn" id="sp-an-peopleWarn" hidden></p>
                <p class="sp-an-subcap">이 달 — 날짜별 × 품목</p>
                <div class="sp-an-people-scroll" id="sp-an-peopleGrid" role="region" aria-label="이 달 일자별 품목 줄 수"></div>
                <details class="sp-an-people-year" id="sp-an-peopleYearDetails">
                  <summary class="sp-an-people-year__sum">연도별 월 합계 · 상품군별 (연도 선택 후 펼치면 불러옴)</summary>
                  <div class="sp-an-people-scroll" id="sp-an-peopleMatrix" role="region" aria-label="선택 연도 월별 상품군 줄 수"></div>
                </details>
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
            <h2 class="sp-panel-eyebrow" id="sp-panel-sync-h">데이터 동기화</h2>
            <div class="sp-sync-head__right">
              <span class="chip chip--soft" id="sp-envChip">미연결</span>
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
              <h2 class="sp-panel-eyebrow" id="sp-pm-eyebrow">상품 항목 분류</h2>
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
                    title="「상품 매핑(분류)」에 적어 둔 내용을 비우고, 데이터 동기화에 올라와 있는 상품 목록 기준으로 다시 채웁니다. 편집한 내용이 사라집니다."
                    aria-label="데이터 초기화: 상품 매핑을 동기화된 상품 목록 기준으로 다시 맞춤"
                  >데이터 초기화</button>
                </div>
                <p class="sp-pm-reset-note" id="sp-pm-resetNote" hidden>위 작업은 <strong>되돌릴 수 없습니다</strong>. 팀에 공유한 뒤 누르세요.</p>
            </div>
            <div class="sp-confirm-block sp-pm-confirm" id="sp-pm-confirm">
              <p class="sp-confirm-instruct" id="sp-pm-instruct"><strong>데이터 동기화</strong>로 올라온 <strong>상품 목록</strong>에 맞춰, <strong>상품 분류</strong>용 <strong>구글 드라이브</strong>에 <strong>내부 대분류</strong>·<strong>상태</strong>를 적어 둡니다(솔패스·솔루틴·챌린지·교재·자소서 등). <strong>처음</strong>이면 <strong>상품 불러오기</strong>로 <strong>「상품 매핑(분류)」</strong>이 있는 파일을 만듭니다.</p>
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
                  <span>미분류만</span>
                </label>
              </div>
              <div class="sp-pm__loading" id="sp-pm-listLoading" hidden>불러오는 중</div>
              <div class="sp-pm-sections" id="sp-pm-sections" hidden></div>
              <p class="actions-note sp-pm__footer-note" id="sp-pm-footerNote" hidden>편집한 뒤 <strong>수정하기</strong>로 <strong>구글 쪽</strong>에 반영합니다. 드롭다운을 바꾸면 <strong>수정하기</strong>가 켜집니다.</p>
            </div>
          </div>
        </section>
        </div>
        </main>
      </div>
    </div>`;
