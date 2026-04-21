// ============================================================
// app.js — Logique applicative : auth, Supabase, PayPal
// Dépendances : Supabase SDK (CDN), quiz.js, data.js
// ============================================================

// Chargement robuste du SDK Supabase avec fallback CDN
(function() {
  // ============================================================
  // ⚠️  CONFIGURATION — REMPLACEZ PAR VOS CLÉS
  // ============================================================
  window.SUPABASE_URL       = 'https://VOTRE_PROJET.supabase.co';
  window.SUPABASE_ANON_KEY  = 'votre_anon_key_supabase_ici';
  window.PAYPAL_CLIENT_ID   = 'votre_paypal_client_id_ici';
  window.PAYPAL_AMOUNT      = '1.00';
  window.PAYPAL_CURRENCY    = 'EUR';
  // ============================================================

  // Validation immédiate des clés
  if (window.SUPABASE_URL.includes('VOTRE_PROJET') || 
      window.SUPABASE_ANON_KEY.includes('votre_anon') ||
      window.SUPABASE_URL.endsWith('/')) {
    document.getElementById('loading-sub-text').textContent = 
      '⚠️ Configuration manquante — voir commentaires dans le code source';
  }
})();

function loadScript(src, onLoad, onError) {
  const s = document.createElement('script');
  s.src = src;
  s.onload = onLoad;
  s.onerror = onError;
  document.head.appendChild(s);
}

function initSupabase() {
  // URL nettoyée : retirer le slash final s'il existe
  const url = window.SUPABASE_URL.replace(/\/$/, '');
  const key = window.SUPABASE_ANON_KEY.trim();

  try {
    window.sb = window.supabase.createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'examen-civique-auth'
      },
      global: {
        headers: {
          'apikey': key,
          'Authorization': 'Bearer ' + key
        }
      }
    });
    startApp();
  } catch(e) {
    showSdkError('Erreur initialisation Supabase : ' + e.message);
  }
}

function showSdkError(msg) {
  document.getElementById('loading-screen').innerHTML = 
    '<div class="sdk-error" style="max-width:480px;margin:auto;margin-top:3rem">' +
    '<strong>Erreur de connexion</strong><br>' + msg + 
    '<br><br><button onclick="location.reload()" style="margin-top:8px;padding:8px 16px;border:1px solid #EF4444;background:transparent;color:#991B1B;border-radius:8px;cursor:pointer;font-family:inherit">Réessayer</button>' +
    '</div>';
}

// Essayer jsDelivr d'abord, puis unpkg en fallback
loadScript(
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.min.js',
  initSupabase,
  function() {
    // Fallback sur unpkg
    document.getElementById('loading-sub-text').textContent = 'CDN principal indisponible, utilisation du backup…';
    loadScript(
      'https://unpkg.com/@supabase/supabase-js@2.39.3/dist/umd/supabase.min.js',
      initSupabase,
      function() {
        showSdkError('Impossible de charger le SDK. Vérifiez votre connexion internet.');
      }
    );
  }
);

// ============================================================
// HELPERS UI
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'auth-msg ' + type;
  el.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function setBtnLoading(btnId, loading, originalText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading 
    ? '<span class="btn-spinner"></span> Chargement…' 
    : originalText;
}

// Enter key support sur les formulaires
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  const active = document.querySelector('.screen.active');
  if (!active) return;
  const id = active.id;
  if (id === 'login-screen') doLogin();
  else if (id === 'register-screen') doRegister();
  else if (id === 'forgot-screen') doForgot();
});

// ============================================================
// STATE
// ============================================================
let currentUser = null;
let userProfile = null;
let isDonor = false;

// ============================================================
// AUTH FUNCTIONS
// ============================================================
async function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  if (!email || !password) {
    showMsg('login-msg', 'Veuillez remplir votre e-mail et mot de passe.', 'error'); 
    return;
  }
  setBtnLoading('login-btn', true, 'Se connecter');
  try {
    const { data, error } = await window.sb.auth.signInWithPassword({ email, password });
    if (error) {
      let msg = 'E-mail ou mot de passe incorrect.';
      if (error.message.toLowerCase().includes('email not confirmed')) {
        msg = '⚠️ Votre e-mail n\'est pas encore confirmé. Vérifiez votre boîte mail et cliquez sur le lien de confirmation.';
      } else if (error.message.toLowerCase().includes('invalid login')) {
        msg = 'E-mail ou mot de passe incorrect.';
      } else if (error.status === 500) {
        msg = 'Erreur serveur (500). Vérifiez votre clé Supabase dans le code source.';
      }
      showMsg('login-msg', msg, 'error');
    }
    // Success handled by onAuthStateChange
  } catch(e) {
    showMsg('login-msg', 'Erreur réseau : ' + e.message, 'error');
  }
  setBtnLoading('login-btn', false, 'Se connecter');
}

async function doRegister() {
  const name     = document.getElementById('register-name').value.trim();
  const email    = document.getElementById('register-email').value.trim().toLowerCase();
  const pw       = document.getElementById('register-password').value;
  const pw2      = document.getElementById('register-password2').value;

  if (!name)       { showMsg('register-msg', 'Entrez votre prénom et nom.', 'error'); return; }
  if (!email)      { showMsg('register-msg', 'Entrez votre adresse e-mail.', 'error'); return; }
  if (!pw)         { showMsg('register-msg', 'Choisissez un mot de passe.', 'error'); return; }
  if (pw.length < 8) { showMsg('register-msg', 'Le mot de passe doit faire au moins 8 caractères.', 'error'); return; }
  if (pw !== pw2)  { showMsg('register-msg', 'Les deux mots de passe ne correspondent pas.', 'error'); return; }

  setBtnLoading('register-btn', true, 'Créer mon compte');
  try {
    const redirectTo = window.location.origin + window.location.pathname;
    const { data, error } = await window.sb.auth.signUp({
      email,
      password: pw,
      options: {
        data: { full_name: name },
        emailRedirectTo: redirectTo
      }
    });
    if (error) {
      let msg = error.message;
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('user already')) {
        msg = 'Cette adresse e-mail est déjà utilisée. <a onclick="showScreen(\'login-screen\')" style="color:var(--blue);cursor:pointer">Se connecter</a> ou <a onclick="showScreen(\'forgot-screen\')" style="color:var(--blue);cursor:pointer">mot de passe oublié</a>.';
        document.getElementById('register-msg').innerHTML = msg;
        document.getElementById('register-msg').className = 'auth-msg error';
      } else {
        showMsg('register-msg', msg, 'error');
      }
    } else {
      // Supabase can auto-confirm or require email confirmation
      if (data.user && data.user.confirmed_at) {
        // Auto-confirmed — direct login
        await loadUserProfile(data.user);
        initQuizApp();
      } else {
        document.getElementById('confirm-email-display').textContent = email;
        showScreen('confirm-screen');
      }
    }
  } catch(e) {
    showMsg('register-msg', 'Erreur réseau : ' + e.message, 'error');
  }
  setBtnLoading('register-btn', false, 'Créer mon compte');
}

async function doForgot() {
  const email = document.getElementById('forgot-email').value.trim().toLowerCase();
  if (!email) { showMsg('forgot-msg', 'Entrez votre adresse e-mail.', 'error'); return; }
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await window.sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) { showMsg('forgot-msg', error.message, 'error'); return; }
  showMsg('forgot-msg', '✅ E-mail de réinitialisation envoyé ! Vérifiez votre boîte mail (et les spams).', 'success');
}

async function doLogout() {
  await window.sb.auth.signOut();
  currentUser = null; userProfile = null; isDonor = false;
  showScreen('login-screen');
}

// ============================================================
// PROFILE
// ============================================================
async function loadUserProfile(user) {
  currentUser = user;
  isDonor = false;
  userProfile = null;

  try {
    // maybeSingle() returns null (no error) when no row found — avoids PGRST116 (406)
    const { data, error } = await window.sb
      .from('profiles')
      .select('id, email, full_name, is_donor, donation_date')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      // Log but don't block — app still works without profile
      console.warn('Profile fetch warning:', error.message, error.code);
    }

    if (data) {
      userProfile = data;
      isDonor = data.is_donor === true;
    } else {
      // No profile yet — try to create one (trigger may not have fired)
      const newProfile = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || '',
        is_donor: false
      };
      const { error: upsertErr } = await window.sb
        .from('profiles')
        .upsert(newProfile, { onConflict: 'id', ignoreDuplicates: false });

      if (upsertErr) {
        console.warn('Profile create warning:', upsertErr.message);
        // Not blocking — continue with default values
      }
      userProfile = newProfile;
      isDonor = false;
    }
  } catch(e) {
    // Network error or unexpected — still show the app
    console.error('Profile load error:', e);
    isDonor = false;
  }
}

async function markAsDonor(transactionId) {
  if (!currentUser) return;
  await window.sb.from('profiles').update({
    is_donor: true,
    donation_date: new Date().toISOString(),
    paypal_transaction_id: transactionId
  }).eq('id', currentUser.id);

  // Log the donation
  await window.sb.from('donations').insert({
    user_id: currentUser.id,
    paypal_transaction_id: transactionId,
    amount: parseFloat(window.PAYPAL_AMOUNT),
    currency: window.PAYPAL_CURRENCY,
    status: 'completed'
  });

  isDonor = true;
  if (userProfile) userProfile.is_donor = true;
  initQuizApp(); // Rebuild nav to show TOP100
}

// ============================================================
// AUTH STATE LISTENER
// ============================================================
function startApp() {
  let appInitialized = false;

  window.sb.auth.onAuthStateChange(async (event, session) => {
    console.log('[Auth]', event, session ? '✓ session' : '✗ no session');

    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session) {
      if (appInitialized) return;
      appInitialized = true;
      showScreen('loading-screen');
      document.getElementById('loading-sub-text').textContent = 'Chargement de votre profil…';
      await loadUserProfile(session.user);
      initQuizApp();
    } else if (event === 'INITIAL_SESSION' && !session) {
      // Pas de session active — afficher la page de connexion immédiatement
      appInitialized = false;
      showScreen('login-screen');
    } else if (event === 'SIGNED_OUT') {
      appInitialized = false;
      showScreen('login-screen');
    } else if (event === 'PASSWORD_RECOVERY') {
      showScreen('login-screen');
      showMsg('login-msg', 'Saisissez votre nouveau mot de passe ci-dessous.', 'info');
    } else if (event === 'USER_UPDATED') {
      showMsg('login-msg', '✅ Mot de passe mis à jour. Connectez-vous.', 'success');
    }
  });

  // Vérification directe de la session au chargement de la page.
  // On ne compte PAS uniquement sur onAuthStateChange car il peut ne pas
  // se déclencher avec INITIAL_SESSION sur certains navigateurs/configurations.
  (async () => {
    try {
      const { data: { session }, error } = await window.sb.auth.getSession();

      if (error) {
        console.error('[Session] Erreur:', error.message);
        showScreen('login-screen');
        return;
      }

      if (session && session.user) {
        // Session valide — charger le profil et lancer l'app
        if (appInitialized) return; // onAuthStateChange l'a déjà géré
        appInitialized = true;
        document.getElementById('loading-sub-text').textContent = 'Connexion en cours…';
        await loadUserProfile(session.user);
        initQuizApp();
      } else {
        // Aucune session — afficher la connexion directement, sans attendre
        showScreen('login-screen');
      }
    } catch(e) {
      console.error('[Session] Exception:', e);
      showScreen('login-screen');
    }
  })();
}

// ============================================================
// PAYPAL
// ============================================================
let paypalLoaded = false;

function loadPayPal(callback) {
  if (paypalLoaded && window.paypal) { callback(); return; }
  const s = document.createElement('script');
  s.src = `https://www.paypal.com/sdk/js?client-id=${window.PAYPAL_CLIENT_ID}&currency=${window.PAYPAL_CURRENCY}&locale=fr_FR&intent=capture`;
  s.onload = () => { paypalLoaded = true; callback(); };
  s.onerror = () => { 
    const container = document.getElementById('paypal-btn-container');
    if (container) container.innerHTML = '<p style="color:var(--red);font-size:13px">⚠️ Impossible de charger PayPal. Vérifiez votre connexion.</p>';
  };
  document.head.appendChild(s);
}

function renderPayPalButton(containerId) {
  loadPayPal(() => {
    const container = document.getElementById(containerId);
    if (!container || container.children.length > 0) return;
    window.paypal.Buttons({
      style: { layout:'vertical', color:'gold', shape:'rect', label:'donate', height:48 },
      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [{
            amount: { value: window.PAYPAL_AMOUNT, currency_code: window.PAYPAL_CURRENCY },
            description: 'Accès TOP 100 Incontournables — Examen civique 2026'
          }],
          application_context: { locale: 'fr-FR' }
        });
      },
      onApprove: async (data, actions) => {
        const order = await actions.order.capture();
        await markAsDonor(order.id);
        // Navigate to TOP100 tab
        setTimeout(() => {
          const tabs = document.querySelectorAll('.bloc-tab');
          if (tabs.length > 0) showTabByIndex(0);
        }, 200);
      },
      onCancel: () => {},
      onError: (err) => { 
        console.error('PayPal error:', err); 
        alert('Une erreur est survenue avec PayPal. Veuillez réessayer.'); 
      }
    }).render('#' + containerId);
  });
}
