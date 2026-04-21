// ============================================================
// quiz.js — Moteur de quiz
// Dépendances : data.js (TOP100, BLOCS)
// ============================================================

const TH={hist:'Histoire/Géo',rep:'République',cult:'Culture',vie:'Vie quotidienne',dem:'Démocratie'};
const THCLS={hist:'tag-hist',rep:'tag-rep',cult:'tag-cult',vie:'tag-vie',dem:'tag-dem'};
const NBCLS={hist:'q-num-hist',rep:'q-num-rep',cult:'q-num-cult',vie:'q-num-vie',dem:'q-num-dem'};
const DCLS={easy:'diff-easy',med:'diff-med',hard:'diff-hard'};
const DLBL={easy:'Facile',med:'Intermédiaire',hard:'Difficile'};
const BARCOL={hist:'#16A34A',rep:'#1A4ED8',cult:'#D97706',vie:'#5B21B6',dem:'#E11D48'};

let ALL_TABS=[], statesMap={}, filtersMap={};

function initQuizApp() {
  ALL_TABS = [
    {id:'top100', label:'★ TOP 100', cls:'top100-tab', isTop100:true, premium:true, data:TOP100},
    ...BLOCS.map((b,i) => ({id:'bloc-'+i, label:'Bloc '+(i+1), cls:'', isTop100:false, premium:false, data:b}))
  ];
  
  ALL_TABS.forEach(t => {
    if (!statesMap[t.id]) statesMap[t.id] = makeState(t.data.questions.length);
    if (!filtersMap[t.id]) filtersMap[t.id] = 'all';
  });

  const nav = document.getElementById('bloc-nav');
  const main = document.getElementById('main-content');

  // Update header
  const uEl = document.getElementById('header-user-info');
  if (uEl && currentUser) {
    const name = (userProfile && userProfile.full_name) || currentUser.email.split('@')[0];
    const badge = isDonor ? '<span class="donor-badge">★ Donateur</span>' : '';
    uEl.innerHTML = `Bonjour&nbsp;<strong>${name}</strong>&nbsp;${badge}`;
  }

  // Build nav
  nav.innerHTML = ALL_TABS.map((t, i) => {
    if (t.premium && !isDonor) {
      return `<button class="bloc-tab top100-locked" onclick="showPaywallScreen()" title="Accès donateur — 1€">★ TOP 100 🔒</button>`;
    }
    return `<button class="bloc-tab ${t.cls}${i===0?' active':''}" onclick="showTabByIndex(${i})">${t.label}</button>`;
  }).join('');

  // Build content containers
  main.innerHTML = ALL_TABS.map((t, i) => 
    `<div id="tab-${t.id}" class="bloc-content${i===0?' active':''}"></div>`
  ).join('');

  showScreen('app-screen');

  // Build first tab
  if (isDonor) {
    buildTab('top100');
  } else {
    buildTab('bloc-0');
  }
}

function makeState(n) {
  const s={};
  for(let i=0;i<n;i++) s[i]={sel:null,submitted:false,correct:false};
  return s;
}

function getS(tabId, gi) {
  if (!statesMap[tabId]) statesMap[tabId] = makeState(1000);
  if (!statesMap[tabId][gi]) statesMap[tabId][gi] = {sel:null,submitted:false,correct:false};
  return statesMap[tabId][gi];
}

function showTabByIndex(idx) {
  const tabs = document.querySelectorAll('.bloc-tab');
  document.querySelectorAll('.bloc-content').forEach(el => el.classList.remove('active'));
  tabs.forEach(el => el.classList.remove('active'));
  const tab = ALL_TABS[idx];
  if (!tab) return;
  const container = document.getElementById('tab-' + tab.id);
  if (container) container.classList.add('active');
  if (tabs[idx]) tabs[idx].classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
  buildTab(tab.id);
}

function showPaywallScreen() {
  document.querySelectorAll('.bloc-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.bloc-tab').forEach(el => el.classList.remove('active'));
  const container = document.getElementById('tab-top100');
  if (container) {
    container.classList.add('active');
    container.innerHTML = `
      <div class="paywall-box">
        <div class="paywall-icon">⭐</div>
        <div class="paywall-title">TOP 100 Incontournables</div>
        <div class="paywall-sub">Les 100 questions les plus importantes sélectionnées par des experts de l'examen civique. Maîtrisez-les pour maximiser vos chances de réussite.</div>
        <div class="paywall-amount">1€</div>
        <div class="paywall-note">Accès permanent · Paiement unique sécurisé par PayPal</div>
        <ul class="paywall-benefits">
          <li>✅ 100 questions incontournables avec explications détaillées</li>
          <li>✅ Couvre les 5 thématiques officielles de l'examen</li>
          <li>✅ Accès immédiat et permanent sur votre compte</li>
          <li>✅ Filtres par thématique et niveau de difficulté</li>
          <li>✅ Votre progression est sauvegardée</li>
        </ul>
        <div id="paypal-btn-container"></div>
        <div class="paywall-secure">🔒 Paiement sécurisé par PayPal · Vos données bancaires ne nous sont jamais transmises</div>
      </div>`;
    renderPayPalButton('paypal-btn-container');
  }
}

function buildTab(tabId) {
  const container = document.getElementById('tab-' + tabId);
  if (!container) return;
  const tab = ALL_TABS.find(t => t.id === tabId);
  if (!tab) return;

  const bloc = tab.data;
  const isTop100 = tab.isTop100;
  const filter = filtersMap[tabId] || 'all';
  const filtered = filter === 'all' ? bloc.questions : bloc.questions.filter(q => q.th === filter);
  const total = bloc.questions.length;
  const allS = Object.values(statesMap[tabId] || {});
  const subCount = allS.filter(s => s.submitted).length;
  const ok = allS.filter(s => s.submitted && s.correct).length;
  const ko = allS.filter(s => s.submitted && !s.correct).length;
  const pct = subCount > 0 ? Math.round(ok / total * 100) : null;

  const themeBtns = ['all','hist','rep','cult','vie','dem'].map(th => {
    const count = th === 'all' ? total : bloc.questions.filter(q => q.th === th).length;
    const lbl = th === 'all' ? `Toutes (${count})` : `${TH[th]} (${count})`;
    return `<button class="theme-btn${filter===th?' active':''}" onclick="setFilter('${tabId}','${th}')">${lbl}</button>`;
  }).join('');

  const topBanner = isTop100 ? `<div class="top100-banner"><div class="top100-banner-icon">⭐</div><div class="top100-banner-text"><h3>Sélection experte — Les incontournables de l'examen civique</h3><p>Ces 100 questions couvrent les points les plus fréquemment testés. Maîtrisez-les en priorité avant de passer aux 9 blocs progressifs.</p></div></div>` : '';

  let qHTML = '', prevTh = null;
  filtered.forEach((q, vi) => {
    const gi = bloc.questions.indexOf(q);
    const s = getS(tabId, gi);
    let cc = 'q-card' + (isTop100 ? ' top100-card' : '');
    if (s.submitted) cc += s.correct ? ' answered-ok' : ' answered-ko';
    const optsHTML = q.opts.map((o, oi) => {
      let cls = 'opt';
      if (s.submitted) { if (oi === q.ans) cls += ' correct'; else if (oi === s.sel) cls += ' wrong'; }
      else if (s.sel === oi) cls += ' selected';
      return `<button class="${cls}" onclick="selOpt('${tabId}',${gi},${oi})"${s.submitted?' disabled':''}>${o}</button>`;
    }).join('');
    const expl = s.submitted ? `<div class="expl ${s.correct?'expl-ok':'expl-ko'}"><strong>${s.correct?'✓ Correct':'✗ Incorrect'}</strong> — ${q.e}</div>` : '';
    const btn = !s.submitted ? `<button class="validate-btn" onclick="submitQ('${tabId}',${gi})">Valider ma réponse</button>` : '';
    if (filter === 'all' && q.th !== prevTh) { qHTML += `<div class="theme-section-title">${TH[q.th]}</div>`; prevTh = q.th; }
    const star = isTop100 ? `<span class="star-badge">★</span>` : '';
    qHTML += `<div class="${cc}" id="t-${tabId}-q${gi}"><div class="q-meta"><div class="q-num ${NBCLS[q.th]}">${vi+1}</div><span class="theme-tag ${THCLS[q.th]}">${TH[q.th]}</span><span class="diff-tag ${DCLS[q.diff]}">${DLBL[q.diff]}</span>${star}</div><div class="q-text">${q.q}</div><div class="opts">${optsHTML}</div>${btn}${expl}</div>`;
  });

  let resultHTML = '';
  if (subCount === total && total > 0) {
    const pass = ok >= Math.round(total * 0.8);
    const barsHTML = ['hist','rep','cult','vie','dem'].map(th => {
      const thQs = bloc.questions.filter(q => q.th === th);
      const thOk = thQs.filter(q => getS(tabId, bloc.questions.indexOf(q)).correct).length;
      const p = thQs.length > 0 ? Math.round(thOk / thQs.length * 100) : 0;
      return `<div><div class="rbi-label">${TH[th]}</div><div class="rbi-track"><div class="rbi-fill" style="width:${p}%;background:${BARCOL[th]}"></div></div><div class="rbi-score" style="color:${BARCOL[th]}">${thOk}/${thQs.length}</div></div>`;
    }).join('');
    const tabIdx = ALL_TABS.findIndex(t => t.id === tabId);
    let nextBtn = '';
    if (isTop100) {
      nextBtn = `<button class="next-btn" onclick="showTabByIndex(1)">Commencer Bloc 1 →</button>`;
    } else if (tabIdx < ALL_TABS.length - 1) {
      nextBtn = `<button class="next-btn" onclick="showTabByIndex(${tabIdx+1})">Bloc suivant →</button>`;
    } else {
      nextBtn = `<button class="next-btn" onclick="resetAll()">Tout recommencer</button>`;
    }
    resultHTML = `<div class="result-box"><div class="result-score ${isTop100?'r-gold':pass?'pass':'fail'}">${ok}/${total}</div><div class="result-verdict">${pass?'🎉 Objectif atteint — Félicitations !':'Encore un effort — continuez à réviser'}</div><div class="result-detail">Score : ${Math.round(ok/total*100)}% · Seuil de réussite : 80% (${Math.round(total*0.8)}/${total}) · ${pass?'✓ Admis':'✗ Non admis'}</div><div class="result-bars">${barsHTML}</div>${nextBtn}</div>`;
  }

  const fillCls = isTop100 ? 'gold-fill' : '';
  container.innerHTML = `<div class="bloc-header"><h1>${bloc.title}</h1><p class="bloc-subtitle">${bloc.subtitle}</p></div>${topBanner}<div class="stats-bar"><div class="stat-card"><div class="stat-label">Répondues</div><div class="stat-val">${subCount}/${total}</div></div><div class="stat-card"><div class="stat-label">Correctes</div><div class="stat-val ok">${ok}</div></div><div class="stat-card"><div class="stat-label">Incorrectes</div><div class="stat-val ko">${ko}</div></div><div class="stat-card"><div class="stat-label">Score</div><div class="stat-val">${pct!==null?pct+'%':'—'}</div></div></div><div class="progress-wrap"><div class="progress-label"><span>Progression</span><span>${subCount}/${total}</span></div><div class="progress-track"><div class="progress-fill ${fillCls}" style="width:${Math.round(subCount/total*100)}%"></div></div></div><div class="theme-filter">${themeBtns}</div><div>${qHTML}</div>${resultHTML}`;
}

function selOpt(tabId, gi, oi) {
  const s = getS(tabId, gi);
  if (s.submitted) return;
  s.sel = oi;
  buildTab(tabId);
}

function submitQ(tabId, gi) {
  const s = getS(tabId, gi);
  if (s.sel === null) return;
  s.submitted = true;
  const tab = ALL_TABS.find(t => t.id === tabId);
  s.correct = s.sel === tab.data.questions[gi].ans;
  buildTab(tabId);
  const el = document.getElementById(`t-${tabId}-q${gi}`);
  if (el) el.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function setFilter(tabId, th) {
  filtersMap[tabId] = th;
  buildTab(tabId);
}

function resetAll() {
  ALL_TABS.forEach(t => {
    statesMap[t.id] = makeState(t.data.questions.length);
    filtersMap[t.id] = 'all';
  });
  showTabByIndex(isDonor ? 0 : 0);
}
