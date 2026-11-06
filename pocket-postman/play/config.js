// Pocket Postman — app settings. This is the only file you need to edit before release.
window.PP_CONFIG = {
  version: '1.0.0',

  // Show the Playtest tab (stats + "Copy results"). true for tester builds, false for the store build.
  showPlaytest: false,

  // Who the game is for. The cartoon style appeals to children, so the default is a MIXED audience:
  // a neutral age screen on first launch, child-safe ads for under-13s, normal ads for everyone else.
  //   ageScreen: true,  childDirected: false  -> mixed audience (recommended; Play target audience includes under-13)
  //   ageScreen: false, childDirected: true   -> treat every player as a child (simplest, lowest ad income)
  //   ageScreen: false, childDirected: false  -> 13+ only. Not advised: Google may judge the art as appealing to kids.
  ageScreen: true,
  childDirected: false,

  // Link shown in Settings. Both stores require a privacy policy for apps with ads.
  // Upload privacy/index.html from the project folder so it's served at this address.
  privacyPolicyUrl: 'https://alphoriasystems.com/pocket-postman/privacy/',

  ads: {
    // Keep true while developing. Set false only when the real ad unit IDs below are filled in.
    testing: false,

    // Your real ad units (AdMob account ca-app-pub-3916240134674735)
    android: {
      rewarded: 'ca-app-pub-3916240134674735/9131271556',
      interstitial: 'ca-app-pub-3916240134674735/2837325947'
    },
    ios: {
      rewarded: 'ca-app-pub-3916240134674735/3847155283',
      interstitial: 'ca-app-pub-3916240134674735/8709519596'
    }
  }
};

// Browser version on the website: no ads, so no age question is needed.
window.PP_CONFIG.ageScreen = false;
window.PP_CONFIG.showPlaytest = false;
