// Native bridge: AdMob (rewarded + interstitial), consent (UMP + iOS ATT), haptics,
// Android back button, status bar and a durable copy of the save game.
// In a desktop browser every call falls back safely, so the game still runs for previews.
(function () {
  const C = window.PP_CONFIG;
  const Cap = window.Capacitor;
  const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const platform = Cap && Cap.getPlatform ? Cap.getPlatform() : 'web';
  const plugin = name => (isNative && Cap.registerPlugin ? Cap.registerPlugin(name) : null);
  const AdMob = plugin('AdMob'), Haptics = plugin('Haptics'), AppP = plugin('App'),
        Prefs = plugin('Preferences'), Splash = plugin('SplashScreen'), StatusBar = plugin('StatusBar');
  const units = platform === 'ios' ? C.ads.ios : C.ads.android;
  const SAVE_KEY = 'pocket-postman-save';

  const ads = { started: false, canRequest: false, privacyRequired: false, rewardedReady: false, interReady: false };

  function log(...a) { try { console.log('[PocketPostman]', ...a); } catch (e) {} }

  async function prepareRewarded() {
    if (!ads.canRequest) return;
    ads.rewardedReady = false;
    try { await AdMob.prepareRewardVideoAd({ adId: units.rewarded, isTesting: C.ads.testing }); ads.rewardedReady = true; }
    catch (e) { log('rewarded load failed', e); setTimeout(prepareRewarded, 30000); }
  }
  async function prepareInterstitial() {
    if (!ads.canRequest) return;
    ads.interReady = false;
    try { await AdMob.prepareInterstitial({ adId: units.interstitial, isTesting: C.ads.testing }); ads.interReady = true; }
    catch (e) { log('interstitial load failed', e); setTimeout(prepareInterstitial, 30000); }
  }

  // Audience from the neutral age screen: 'child' (under 13), 'teen' (13-15), 'adult' (16+), or null if not asked.
  function audience() {
    if (C.childDirected) return 'child';
    try { return localStorage.getItem('pp-age'); } catch (e) { return null; }
  }

  async function startAds() {
    if (!AdMob || ads.started) return;
    const aud = audience();
    // Unknown age with the age screen switched on: request no ads at all until the player answers.
    if (C.ageScreen && !aud) return;
    const child = aud === 'child', teen = aud === 'teen';
    ads.started = true;
    try {
      // 1) Consent (GDPR / US states) through Google's User Messaging Platform.
      let info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: child || teen });
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
      ads.canRequest = !!info.canRequestAds;
      ads.privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
    } catch (e) { log('consent error', e); ads.canRequest = false; }
    // Without consent (or if the check failed) request no ads, so EEA/UK players never get ads they didn't agree to.
    if (!ads.canRequest) return;
    try {
      // 2) iOS App Tracking Transparency prompt (skipped for child-directed apps).
      if (platform === 'ios' && !child && !teen) {
        const s = await AdMob.trackingAuthorizationStatus();
        if (s.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      }
    } catch (e) { log('ATT error', e); }
    try {
      await AdMob.initialize({
        initializeForTesting: C.ads.testing,
        // Google: never set both tags to true. Child = COPPA treatment (no ad ID, no personalised ads).
        tagForChildDirectedTreatment: child,
        tagForUnderAgeOfConsent: !child && teen,
        // The game is rated for everyone, so ads are limited to general-audience content for all players.
        maxAdContentRating: 'General'
      });
    } catch (e) { log('init error', e); return; }
    prepareRewarded();
    prepareInterstitial();
  }

  const Native = {
    isNative, platform, ads,

    async boot() {
      if (!isNative) return;
      try { await StatusBar.setOverlaysWebView({ overlay: true }); await StatusBar.setStyle({ style: 'LIGHT' }); } catch (e) {}
      try { await Splash.hide(); } catch (e) {}
    },
    startAds,

    // Resolves true (reward earned), false (closed early) or null (no ad available).
    audience,
    showRewarded() {
      if (!AdMob || !ads.rewardedReady) { if (AdMob) prepareRewarded(); return Promise.resolve(null); }
      return new Promise(async resolve => {
        let earned = false, done = false;
        const handles = [];
        const finish = v => { if (done) return; done = true; handles.forEach(h => h && h.remove && h.remove()); prepareRewarded(); resolve(v); };
        handles.push(await AdMob.addListener('onRewardedVideoAdReward', () => { earned = true; }));
        handles.push(await AdMob.addListener('onRewardedVideoAdDismissed', () => finish(earned)));
        handles.push(await AdMob.addListener('onRewardedVideoAdFailedToShow', () => finish(null)));
        ads.rewardedReady = false;
        try { const item = await AdMob.showRewardVideoAd(); if (item && item.amount !== undefined) earned = true; }
        catch (e) { finish(null); }
        setTimeout(() => finish(earned), 120000);
      });
    },

    // Resolves when the interstitial is closed, or right away if none is loaded.
    showInterstitial() {
      if (!AdMob || !ads.interReady) { if (AdMob) prepareInterstitial(); return Promise.resolve(false); }
      return new Promise(async resolve => {
        let done = false; const handles = [];
        const finish = v => { if (done) return; done = true; handles.forEach(h => h && h.remove && h.remove()); prepareInterstitial(); resolve(v); };
        handles.push(await AdMob.addListener('interstitialAdDismissed', () => finish(true)));
        handles.push(await AdMob.addListener('interstitialAdFailedToShow', () => finish(false)));
        ads.interReady = false;
        try { await AdMob.showInterstitial(); } catch (e) { finish(false); }
        setTimeout(() => finish(true), 120000);
      });
    },

    async privacyOptions() { if (AdMob) { try { await AdMob.showPrivacyOptionsForm(); } catch (e) { log(e); } } },

    haptic(kind) {
      if (!Haptics || localStorage.getItem('pp-haptics') === 'off') return;
      try {
        if (kind === 'success') Haptics.notification({ type: 'SUCCESS' });
        else if (kind === 'warning') Haptics.notification({ type: 'WARNING' });
        else Haptics.impact({ style: kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
      } catch (e) {}
    },

    onBack(fn) { if (AppP) AppP.addListener('backButton', fn); },
    exit() { if (AppP) AppP.exitApp(); },
    openUrl(url) { window.open(url, '_blank'); },

    // The WebView's localStorage is the working copy; Preferences is the durable backup.
    saveCopy(json) { if (Prefs) Prefs.set({ key: SAVE_KEY, value: json }).catch(() => {}); },
    async loadCopy() { if (!Prefs) return null; try { const r = await Prefs.get({ key: SAVE_KEY }); return r.value || null; } catch (e) { return null; } }
  };
  window.Native = Native;
})();
