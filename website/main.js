// Points the hero button at the file for the visitor's platform, switches the
// download tabs, wires the copy buttons and runs the undo clip. Without JS the
// hero button scrolls to the download section, where every platform is listed.
// The hero playground lives in play.js.
(function () {
  function detectOs() {
    var p = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '').toLowerCase();
    var ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod|android/.test(ua)) return null;
    // iPadOS reports itself as a Mac; only it has a touch screen.
    if (/macintosh/.test(ua) && navigator.maxTouchPoints > 1) return null;
    if (p.indexOf('mac') === 0 || /macintosh/.test(ua)) return 'mac';
    if (p.indexOf('win') === 0 || /windows/.test(ua)) return 'win';
    if (/linux|x11|cros/.test(p + ' ' + ua)) return 'linux';
    return null;
  }

  var os = detectOs();

  // Download tabs. Without JS all panels show one after another.
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.os-tab'));
  var tablist = document.querySelector('.os-tabs');
  function select(name, focus) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-os') === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
  }
  if (tablist && tabs.length) {
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t.getAttribute('data-os')); });
      t.addEventListener('keydown', function (e) {
        var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select(tabs[(next + tabs.length) % tabs.length].getAttribute('data-os'), true);
      });
    });
    // "Your platform" badge on the tab that matches the visitor.
    tabs.forEach(function (t) { if (t.getAttribute('data-os') === os) t.classList.add('yours'); });
    tablist.hidden = false;
    select(os || 'mac');
  }

  // Hero button: a direct link to the file for this platform.
  var primary = document.getElementById('primary-download');
  if (primary && os) {
    var file = { mac: 'mac', linux: 'deb' }[os];
    var link = document.querySelector('a[data-dl="' + file + '"]');
    var version = document.getElementById('download-title').textContent.replace(/^Download Mergelio\s*/, '');
    var names = { mac: 'macOS', win: 'Windows', linux: 'Linux' };
    var kinds = { mac: 'Apple silicon', win: 'x64', linux: '.deb, Debian/Ubuntu' };
    if (link) {
      primary.href = link.href;
      primary.setAttribute('download', '');
      document.getElementById('primary-label').textContent = 'Download for ' + names[os];
      document.getElementById('primary-sub').textContent =
        'v' + version + ' · ' + kinds[os] + ' · ' + link.getAttribute('data-size');
      var alt = document.getElementById('primary-alt');
      var rpm = document.querySelector('a[data-dl="rpm"]');
      alt.innerHTML = os === 'linux' && rpm
        ? 'On Fedora? <a href="' + rpm.href + '" download>Get the .rpm</a> · <a href="#download">Other platforms</a>'
        : 'Not on ' + names[os] + '? <a href="#download">Other platforms</a>';
      alt.hidden = false;
    }
  }

  document.querySelectorAll('.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.previousElementSibling.textContent;
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = 'Copied';
        btn.classList.add('done');
        setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1500);
      });
    });
  });

  // The undo clip plays only while it is on screen, never when the visitor
  // asked for reduced motion, and can always be paused.
  var clip = document.querySelector('.clip');
  if (clip) {
    var toggle = clip.querySelector('.clip-toggle');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var dark = window.matchMedia('(prefers-color-scheme: dark)');
    var paused = reduce.matches;
    var inView = false;
    var current = function () { return clip.querySelector(dark.matches ? '.clip-dark' : '.clip-light'); };
    var sync = function () {
      clip.querySelectorAll('video').forEach(function (v) {
        if (v !== current() || paused || !inView) v.pause();
      });
      var v = current();
      if (!paused && inView) {
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      }
      toggle.textContent = paused ? 'Play' : 'Pause';
    };
    toggle.addEventListener('click', function () { paused = !paused; sync(); });
    if (dark.addEventListener) dark.addEventListener('change', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }, { threshold: 0.5 }).observe(clip);
    }
    toggle.hidden = false;
    toggle.textContent = paused ? 'Play' : 'Pause';
  }

})();
