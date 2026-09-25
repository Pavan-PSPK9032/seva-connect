/* ============================================================
   SEVA CONNECT — app.js
   Shared application layer injected into every page:
   navbar, footer, preloader, theme, toasts, modals, global
   search, notifications, animations and the Seva AI chatbot.
   ============================================================ */
(function () {
  'use strict';

  var NAV_LINKS = [
    { label: 'Home', href: 'index.html' },
    { label: 'NGOs', href: 'ngos.html' },
    { label: 'Events', href: 'events.html' },
    { label: 'Impact', href: 'impact.html' },
    { label: 'Leaderboard', href: 'leaderboard.html' },
    { label: 'About', href: 'about.html' },
    { label: 'Contact', href: 'contact.html' }
  ];

  var CURRENT_PAGE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function esc(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function avatarGrad(name) {
    var h = 0;
    var s = String(name || 'SC');
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    var c1 = ['#2E8B57', '#FF9800', '#4CAF50', '#2196F3', '#E91E63', '#9C27B0', '#00BCD4', '#F4511E'];
    var c2 = ['#4CAF50', '#FFB74D', '#66BB6A', '#64B5F6', '#F06292', '#BA68C8', '#4DD0E1', '#FF7043'];
    var a = c1[h % c1.length];
    var b = c2[(h >> 4) % c2.length];
    return 'linear-gradient(135deg, ' + a + ', ' + b + ')';
  }

  function avatarHTML(name, photo, cls) {
    var cn = 'avatar ' + (cls || '');
    if (photo) return '<span class="' + cn + '"><img src="' + esc(photo) + '" alt="' + esc(name) + '"></span>';
    var grad = avatarGrad(name);
    var initials = (SC && SC.initials ? SC.initials(name) : (name || 'SC').slice(0, 1).toUpperCase());
    return '<span class="' + cn + '" style="--avatar-bg:' + grad + '" role="img" aria-label="' + esc(name) + '">' + esc(initials) + '</span>';
  }

  function pageTitle() {
    return document.title.replace(' — Seva Connect', '') || 'Seva Connect';
  }

  /* ============================================================
     THEME
     ============================================================ */

  var Theme = {
    current: function () { return document.documentElement.getAttribute('data-theme') || 'light'; },
    apply: function (theme, save) {
      document.documentElement.setAttribute('data-theme', theme);
      if (save !== false) { try { localStorage.setItem('sc_theme', theme); } catch (e) {} }
      var toggles = qsa('[data-theme-toggle]');
      toggles.forEach(function (b) {
        b.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
      });
    },
    toggle: function () {
      var next = this.current() === 'dark' ? 'light' : 'dark';
      this.apply(next, true);
      App.toast(next === 'dark' ? 'Dark Mode Enabled' : 'Light Mode Enabled', 'Theme updated. Enjoy the view.', 'info', 2200);
    },
    init: function () {
      var stored = null;
      try { stored = localStorage.getItem('sc_theme'); } catch (e) {}
      if (!stored) {
        stored = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }
      this.apply(stored, false);
    }
  };

  /* ============================================================
     TOASTS
     ============================================================ */

  var Toast = {
    icons: { success: '✅', error: '🚫', warning: '⚠️', info: '💡' },
    show: function (title, msg, type, duration) {
      type = type || 'info';
      duration = duration || 4000;
      var wrap = qs('#toast-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'toast-wrap';
        wrap.setAttribute('aria-live', 'polite');
        document.body.appendChild(wrap);
      }
      var el = document.createElement('div');
      el.className = 'toast ' + esc(type);
      el.setAttribute('role', 'status');
      el.innerHTML =
        '<span class="t-ico">' + Toast.icons[type] + '</span>' +
        '<div class="t-body"><div class="t-title">' + esc(title) + '</div>' +
        (msg ? '<div class="t-msg">' + esc(msg) + '</div>' : '') + '</div>' +
        '<div class="t-progress" style="animation-duration:' + duration + 'ms"></div>';
      wrap.appendChild(el);
      setTimeout(function () {
        el.classList.add('closing');
        setTimeout(function () { el.remove(); }, 320);
      }, duration);
    }
  };

  /* ============================================================
     MODALS
     ============================================================ */

  var modalCount = 0;
  var Modal = {
    open: function (opts) {
      opts = opts || {};
      modalCount++;
      var id = 'modal-' + modalCount;
      var backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.id = id;
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      backdrop.innerHTML =
        '<div class="modal" role="document">' +
        '<div class="modal-head"><h3>' + esc(opts.title || '') + '</h3>' +
        '<button class="modal-x" data-modal-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        (opts.footer ? '<div class="modal-foot">' + opts.footer + '</div>' : '') +
        '</div>';
      document.body.appendChild(backdrop);
      requestAnimationFrame(function () { backdrop.classList.add('open'); });
      if (typeof opts.onOpen === 'function') { opts.onOpen(backdrop); }
      qsa('[data-modal-close]', backdrop).forEach(function (b) {
        b.addEventListener('click', function () { Modal.close(backdrop); });
      });
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop && opts.backdropClose !== false) Modal.close(backdrop);
      });
      document.addEventListener('keydown', function escKey(e) {
        if (e.key === 'Escape' && backdrop.classList.contains('open')) {
          Modal.close(backdrop);
          document.removeEventListener('keydown', escKey);
        }
      });
      return backdrop;
    },
    close: function (backdrop) {
      if (!backdrop) return;
      backdrop.classList.remove('open');
      setTimeout(function () { backdrop.remove(); }, 320);
    }
  };

  function modalFooter(primaryLabel, primaryCb, opts) {
    opts = opts || {};
    return '<button class="btn btn-ghost btn-sm" data-modal-close>' + esc(opts.cancelLabel || 'Cancel') + '</button>' +
      '<button class="btn btn-' + (opts.primaryClass || 'primary') + ' btn-sm" data-modal-ok>' + esc(primaryLabel) + '</button>';
  }

  function confirmModal(title, message, onYes, opts) {
    var backdrop = Modal.open({
      title: title,
      body: '<div class="modal-center"><span class="modal-icon">' + (opts && opts.icon || '❓') + '</span>' +
        '<p>' + esc(message) + '</p></div>',
      footer: modalFooter((opts && opts.okLabel) || 'Confirm', null, opts)
    });
    qs('[data-modal-ok]', backdrop).addEventListener('click', function () {
      if (typeof onYes === 'function') onYes();
      Modal.close(backdrop);
    });
  }

  /* ============================================================
     CONFITTI + BADGE UNLOCK OVERLAY
     ============================================================ */

  function confetti() {
    var canvas = qs('#confetti-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      document.body.appendChild(canvas);
    }
    var ctx = canvas.getContext('2d');
    var W = canvas.width = window.innerWidth;
    var H = canvas.height = window.innerHeight;
    var colors = ['#2E8B57', '#4CAF50', '#FF9800', '#FFB74D', '#46A0E9', '#E91E63'];
    var parts = [];
    for (var i = 0; i < 140; i++) {
      parts.push({
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.5,
        w: 6 + Math.random() * 8,
        h: 6 + Math.random() * 8,
        c: colors[Math.floor(Math.random() * colors.length)],
        vx: -2 + Math.random() * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        vr: -0.15 + Math.random() * 0.3
      });
    }
    var frames = 0;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frames++;
      if (frames < 190) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, W, H);
    }
    draw();
  }

  function unlockBadge(badge) {
    var backdrop = document.createElement('div');
    backdrop.className = 'unlock-pop';
    backdrop.innerHTML =
      '<div class="unlock-card card">' +
      '<span class="u-emoji">' + esc(badge.emoji) + '</span>' +
      '<span class="badge badge-primary">🎉 Badge Unlocked</span>' +
      '<h3 class="mt-2">' + esc(badge.name) + '</h3>' +
      '<p>' + esc(badge.desc) + '</p>' +
      '<button class="btn btn-primary">Awesome, keep going!</button></div>';
    document.body.appendChild(backdrop);
    requestAnimationFrame(function () { backdrop.classList.add('open'); });
    confetti();
    var btn = qs('button', backdrop);
    btn.addEventListener('click', function () {
      backdrop.classList.remove('open');
      setTimeout(function () { backdrop.remove(); }, 320);
    });
    qs('.u-emoji', backdrop).addEventListener('animationend', function () { confetti(); });
  }

  /* ============================================================
     SCROLL ANIMATIONS + COUNTERS
     ============================================================ */

  /* ============================================================
     SCROLL ANIMATIONS + COUNTERS
     ============================================================ */

  function refreshReveals(scope) {
    var root = scope || document;
    qsa('.reveal', root).forEach(function (el) {
      if (el.classList.contains('visible')) return;
      var delay = parseFloat(el.getAttribute('data-delay') || 0);
      if (delay) el.style.transitionDelay = delay + 's';
    });
  }

  function animateCounters(scope) {
    var root = scope || document;
    qsa('.counter', root).forEach(function (el) {
      if (el.dataset.done) return;
      el.dataset.done = '1';
      var target = parseFloat(el.getAttribute('data-target'));
      if (isNaN(target)) return;
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var thousands = el.getAttribute('data-format') === 'thousand';
      var fmt = function (v) {
        return decimals ? v.toFixed(decimals) : (thousands ? Math.round(v).toLocaleString('en-IN') : Math.round(v).toLocaleString('en-IN'));
      };
      var dur = 1600;
      var start = null;
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        p = 1 - Math.pow(1 - p, 3); // easeOutCubic
        var val = target * p;
        el.textContent = prefix + fmt(val) + suffix;
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = prefix + fmt(target) + suffix;
      }
      requestAnimationFrame(step);
    });
  }

  var io = null;
  function setupObservers() {
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var el = entry.target;
            el.classList.add('visible');
            if (el.classList.contains('counter')) animateCounters(null);
            if (el.dataset.counters) animateCounters(el);
            io.unobserve(el);
          }
        });
      }, { threshold: 0.12 });
      qsa('.reveal, .counter').forEach(function (el) { io.observe(el); });
    } else {
      qsa('.reveal').forEach(function (el) { el.classList.add('visible'); });
      animateCounters(null);
    }
  }

  /* ============================================================
     GLOBAL SEARCH
     ============================================================ */

  function bindSearch() {
    qsa('[data-search]').forEach(function (input) {
      if (input.dataset.bound) return;
      input.dataset.bound = '1';
      var wrap = input.closest('.search-box') || input.parentElement;
      var panel = wrap.querySelector('[data-search-results]');
      if (!panel) {
        panel = document.createElement('div');
        panel.className = 'search-results hide';
        panel.dataset.searchResults = '1';
        wrap.appendChild(panel);
      }
      input.addEventListener('input', function (e) {
        var q = e.target.value.trim();
        if (!q) { panel.classList.add('hide'); return; }
        panel.classList.remove('hide');
        var res = SC.search(q);
        var html = '';
        var any = false;
        var groups = [
          { key: 'ngos', label: 'NGOs', icon: null, emoji: null, fn: function (n) { return { title: n.name, meta: n.category + ' · ' + n.city, go: 'ngos.html?q=' + esc(q), thumb: n.logo || '🏢' }; } },
          { key: 'events', label: 'Events', icon: null, emoji: null, fn: function (e) { return { title: e.title, meta: e.category + ' · ' + e.location, go: 'events.html?q=' + esc(q), thumb: e.icon || '📅' }; } },
          { key: 'volunteers', label: 'Volunteers', icon: null, emoji: null, fn: function (v) { return { title: v.fullName, meta: v.city + ' · Volunteer', go: 'leaderboard.html?q=' + esc(v.fullName.split(' ')[0]), avatar: v, thumb: '👤' }; } },
          { key: 'skills', label: 'Skills', emoji: '🛠️', fn: function (s) { return { title: s, meta: 'Skill · matching events', go: 'events.html?q=' + esc(s) }; } },
          { key: 'causes', label: 'Causes', emoji: '🎯', fn: function (c) { return { title: c, meta: 'Cause · supporting NGOs', go: 'ngos.html?cat=' + esc(c) }; } }
        ];
        groups.forEach(function (g) {
          var items = res[g.key];
          if (!items || !items.length) return;
          any = true;
          html += '<div class="search-group-label">' + g.label + '</div>';
          items.slice(0, 5).forEach(function (item) {
            var d = g.fn(item);
            var thumb = d.avatar ? avatarHTML(d.avatar.fullName, d.avatar.photo, 'avatar-sm') : '<span class="s-emoji">' + esc(g.emoji || d.thumb) + '</span>';
            html += '<div class="search-item" data-go="' + esc(d.go) + '" tabindex="0" role="option">' + thumb +
              '<div><div class="s-title">' + esc(d.title) + '</div><div class="s-meta">' + esc(d.meta) + '</div></div></div>';
          });
        });
        if (!any) html = '<div class="search-empty"><i class="fa-solid fa-magnifying-glass"></i>No results &ldquo;' + esc(q) + '&rdquo;</div>';
        panel.innerHTML = html;
        qsa('.search-item', panel).forEach(function (el) {
          el.addEventListener('click', function () { location.href = el.dataset.go; });
          el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') location.href = el.dataset.go; });
        });
      });
    });
  }

  /* ============================================================
     NOTIFICATIONS POPOVER
     ============================================================ */

  function notificationsPanel(popoverId) {
    var user = SC.currentUser();
    var notes = SC.getNotifications(user ? user.id : null);
    var unread = notes.filter(function (n) { return !n.read; }).length;
    var html = '<div class="popover-head"><h4>Notifications</h4><div class="popover-actions">' +
      '<button class="link-btn" data-notif="all">Mark all read</button>' +
      '<button class="link-btn" data-notif="clear">Clear</button></div></div>';
    if (!notes.length) {
      html += '<div class="note-empty"><i class="fa-regular fa-bell-slash"></i>You are all caught up!</div>';
    } else {
      html += '<div class="popover-list">';
      notes.slice(0, 12).forEach(function (n) {
        html += '<div class="note-item' + (!n.read ? ' unread' : '') + '" data-note="' + esc(n.id) + '" tabindex="0" role="button">' +
          '<span class="note-ico">' + esc(n.icon) + '</span>' +
          '<div><div class="note-title">' + esc(n.title) + '</div>' +
          '<div class="note-msg">' + esc(n.message) + '</div>' +
          '<div class="note-date">' + esc(SC.formatDate(n.date, { day: 'numeric', month: 'short' })) + '</div></div></div>';
      });
      html += '</div>';
    }
    return html;
  }

  function togglePopover(triggerEl, getHtml, closeCb) {
    closePopovers();
    var existing = qs('.nav-popover');
    if (existing && existing.dataset.for === triggerEl.dataset.popped) {
      closePopovers();
      return;
    }
    var panel = document.createElement('div');
    panel.className = 'nav-popover';
    panel.dataset.for = triggerEl.dataset.popped;
    panel.dataset.popover = '1';
    panel.innerHTML = getHtml();
    document.body.appendChild(panel);
    var rect = triggerEl.getBoundingClientRect();
    panel.style.top = (rect.bottom + 12) + 'px';
    panel.style.right = Math.max(12, window.innerWidth - rect.right) + 'px';
    panel.addEventListener('click', function (e) {
      var c = e.target.closest('[data-notif]');
      if (c) {
        var user = SC.currentUser();
        if (c.dataset.notif === 'all') { SC.markAllNotificationsRead(user.id); App.toast('Done', 'All notifications marked as read.', 'success', 2000); }
        if (c.dataset.notif === 'clear') { SC.clearNotifications(user.id); App.toast('Done', 'Notifications cleared.', 'info', 2000); }
        panel.innerHTML = notificationsPanel(triggerEl.dataset.popped);
        refreshNavbar();
      }
      var n = e.target.closest('[data-note]');
      if (n) {
        var user2 = SC.currentUser();
        SC.markNotificationRead(user2.id, n.dataset.note);
        panel.innerHTML = notificationsPanel(triggerEl.dataset.popped);
        refreshNavbar();
      }
    });
  }

  function closePopovers() {
    qsa('[data-popover]').forEach(function (p) { p.remove(); });
  }

  /* ============================================================
     NAVBAR + FOOTER INJECTION
     ============================================================ */

  function navbarHTML() {
    var user = SC.currentUser();
    var notes = SC.getNotifications(user ? user.id : null);
    var unread = notes.filter(function (n) { return !n.read; }).length;

    var links = NAV_LINKS.map(function (l) {
      var active = l.href.split('?')[0].toLowerCase().replace('index.html', '') === CURRENT_PAGE.replace('index.html', '') && CURRENT_PAGE === l.href.toLowerCase();
      var isIndex = (CURRENT_PAGE === 'index.html' && l.href === 'index.html');
      var is = CURRENT_PAGE === l.href.toLowerCase();
      return '<a href="' + l.href + '" class="' + (is || isIndex ? 'active' : '') + '">' + l.label + '</a>';
    }).join('');

    var right = '';
    if (user) {
      right += '<a class="btn btn-ghost btn-sm" href="dashboard.html"><i class="fa-solid fa-gauge-high"></i> Dashboard</a>';
      right += '<div class="nav-user-wrap"><button class="icon-btn" data-popover-tt="bell" aria-label="Notifications">' +
        '<i class="fa-regular fa-bell"></i>' + (unread ? '<span class="dot">' + (unread > 9 ? '9+' : unread) + '</span>' : '') + '</button></div>';
      right += '<div class="nav-user-wrap"><button class="nav-user" data-popover-tt="user" aria-label="Account menu">' +
        avatarHTML(user.fullName, user.photo, 'avatar-sm') +
        '<span class="nav-user-name" style="font-size:.82rem;font-weight:600">' + esc(user.fullName.split(' ')[0]) + '</span></button></div>';
    } else {
      right += '<a class="btn btn-ghost btn-sm" href="login.html">Sign In</a>';
      right += '<a class="btn btn-primary btn-sm" href="register.html"><i class="fa-solid fa-heart"></i> Join Us</a>';
    }

    return '<div class="navbar"><div class="container nav-inner">' +
      '<a class="brand" href="index.html" aria-label="Seva Connect home">' +
      '<span class="brand-mark" aria-hidden="true">S</span>' +
      '<span><span class="brand-name">Seva <span class="gradient-text">Connect</span></span>' +
      '<div class="brand-tag">Social Impact Network</div></span></a>' +
      '<nav class="nav-links" aria-label="Primary">' + links + '</nav>' +
      '<div class="search-box" role="search">' +
      '<div class="search-input-wrap"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
      '<input type="search" placeholder="Search NGOs, events, skills…" data-search aria-label="Global search">' +
      '</div><div class="search-results hide" data-search-results role="listbox"></div></div>' +
      '<div class="nav-actions">' +
      '<button class="icon-btn" data-theme-toggle aria-label="Toggle dark mode">' +
      '<i class="fa-solid fa-moon"></i></button>' +
      right +
      '<button class="hamburger" aria-label="Open menu"><i class="fa-solid fa-bars"></i></button>' +
      '</div></div></div>' +
      '<div class="drawer-backdrop" data-drawer-backdrop></div>' +
      '<aside class="drawer" aria-label="Mobile menu">' +
      '<a class="brand" href="index.html" aria-label="Seva Connect home">' +
      '<span class="brand-mark" aria-hidden="true">S</span>' +
      '<span><span class="brand-name">Seva <span class="gradient-text">Connect</span></span>' +
      '<div class="brand-tag">Social Impact Network</div></span></a>' +
      '<div class="search-input-wrap mb-2"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
      '<input type="search" placeholder="Search…" data-search aria-label="Global search"></div>' +
      '<nav class="drawer-nav" aria-label="Mobile primary">' +
      NAV_LINKS.map(function (l, i) {
        return '<a href="' + l.href + '" class="' + (CURRENT_PAGE === l.href.toLowerCase() ? 'active' : '') + '">' +
          '<i class="fa-solid ' + ['fa-house', 'fa-hand-holding-heart', 'fa-calendar-days', 'fa-chart-line', 'fa-trophy', 'fa-circle-info', 'fa-envelope'][i] + '"></i>' + l.label + '</a>';
      }).join('') +
      (user && user.role === 'admin' ? '<a href="admin.html" class="' + (CURRENT_PAGE === 'admin.html' ? 'active' : '') + '"><i class="fa-solid fa-user-shield"></i> Admin Panel</a>' : '') +
      '</nav><div class="drawer-footer">' +
      (user
        ? '<a class="btn btn-primary btn-block" href="dashboard.html"><i class="fa-solid fa-gauge-high"></i> My Dashboard</a>' +
          '<a class="btn btn-ghost btn-block" href="profile.html"><i class="fa-solid fa-user"></i> My Profile</a>' +
          '<button class="btn btn-ghost btn-block" data-logout><i class="fa-solid fa-arrow-right-from-bracket"></i> Logout</button>'
        : '<a class="btn btn-primary btn-block" href="register.html">Become a Volunteer</a>' +
          '<a class="btn btn-ghost btn-block" href="login.html">Sign In</a>') +
      '</div></aside>';
  }

  function footerHTML() {
    var year = new Date().getFullYear();
    return '<footer class="footer"><div class="container">' +
      '<div class="footer-grid">' +
      '<div class="footer-about">' +
      '<a class="brand" href="index.html" aria-label="Seva Connect home"><span class="brand-mark" aria-hidden="true">S</span>' +
      '<span><span class="brand-name">Seva <span class="gradient-text">Connect</span></span><div class="brand-tag">Social Impact Network</div></span></a>' +
      '<p>Connecting passionate volunteers with trusted NGOs. Turn your time into measurable social impact — one hour at a time.</p>' +
      '<div class="social-row">' +
      ['facebook-f', 'instagram', 'x-twitter', 'linkedin-in', 'youtube'].map(function (ic) {
        return '<a class="social-btn" href="#" aria-label="' + ic + '" data-social>' + '<i class="fa-brands fa-' + ic + '"></i></a>';
      }).join('') +
      '</div></div>' +
      '<div><h4>Explore</h4><div class="footer-links">' +
      '<a href="index.html">Home</a><a href="ngos.html">NGOs</a><a href="events.html">Events</a><a href="impact.html">Social Impact</a><a href="leaderboard.html">Leaderboard</a><a href="about.html">About Us</a>' +
      '</div></div>' +
      '<div><h4>For Volunteers</h4><div class="footer-links">' +
      '<a href="register.html">Become a Volunteer</a><a href="dashboard.html">My Dashboard</a><a href="certificates.html">Certificates</a><a href="achievements.html">Achievements</a><a href="attendance.html">Attendance</a><a href="admin.html">Admin Panel</a>' +
      '</div></div>' +
      '<div class="newsletter"><h4>Stay Inspired</h4>' +
      '<p>Get personalised volunteering picks and impact stories in your inbox.</p>' +
      '<form class="newsletter-form" data-newsletter><input type="email" required placeholder="you@email.com" aria-label="Email address">' +
      '<button class="btn btn-primary btn-sm" type="submit">Subscribe</button></form>' +
      '</div></div>' +
      '<div class="footer-bottom">' +
      '<span>&copy; ' + year + ' Seva Connect · Connect. Serve. Transform.</span>' +
      '<span>Made with <i class="fa-solid fa-heart" style="color:var(--danger)"></i> for a better tomorrow · Demo project — data stays in your browser</span>' +
      '</div></div></footer>';
  }

  /* ============================================================
     NAVBAR BEHAVIOUR
     ============================================================ */

  function refreshNavbar() {
    var mount = qs('[data-component="navbar"]');
    var footer = qs('[data-component="footer"]');
    if (mount) mount.innerHTML = navbarHTML();
    if (footer && !footer.dataset.bound) { footer.innerHTML = footerHTML(); footer.dataset.bound = '1'; }
    bindChrome();
  }

  function bindChrome() {
    qsa('[data-theme-toggle]').forEach(function (b) {
      if (b.dataset.bound) return;
      b.dataset.bound = '1';
      b.addEventListener('click', function (e) { e.stopPropagation(); Theme.toggle(); });
    });

    // drawer
    var burger = qs('.hamburger');
    var drawer = qs('.drawer');
    var backdrop = qs('[data-drawer-backdrop]');
    if (burger && drawer && backdrop) {
      if (!burger.dataset.bound) {
        burger.dataset.bound = '1';
        burger.addEventListener('click', function () {
          drawer.classList.toggle('open');
          backdrop.classList.toggle('open');
          burger.setAttribute('aria-expanded', drawer.classList.contains('open'));
        });
        drawer.querySelectorAll('a').forEach(function (a) {
          a.addEventListener('click', function () {
            drawer.classList.remove('open');
            backdrop.classList.remove('open');
          });
        });
        backdrop.addEventListener('click', function () {
          drawer.classList.remove('open');
          backdrop.classList.remove('open');
        });
      }
    }

    // logout
    qsa('[data-logout]').forEach(function (b) {
      if (b.dataset.bound) return;
      b.dataset.bound = '1';
      b.addEventListener('click', function () { App.logout(); });
    });

    // search
    bindSearch();

    // popovers
    qsa('[data-popover-tt]').forEach(function (b) {
      if (b.dataset.bound) return;
      b.dataset.bound = '1';
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var kind = b.dataset.popoverTt;
        var html = kind === 'bell'
          ? notificationsPanel(kind)
          : userPopoverHTML();
        togglePopover(b, function () { return html; });
      });
    });

    // navbar scroll shadow
    var navbar = qs('.navbar');
    if (navbar) {
      var onScroll = function () {
        navbar.classList.toggle('scrolled', window.scrollY > 10);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    // newsletter subscribe
    qsa('[data-newsletter]').forEach(function (form) {
      if (form.dataset.bound) return;
      form.dataset.bound = '1';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        App.toast('Subscribed 🎉', 'You will now receive volunteering picks from Seva Connect.', 'success', 3200);
        form.reset();
      });
    });

    // social links toast
    qsa('[data-social]').forEach(function (a) {
      if (a.dataset.bound) return;
      a.dataset.bound = '1';
      a.addEventListener('click', function (e) {
        e.preventDefault();
        App.toast('Coming Soon', 'Social profiles are part of the full product launch.', 'info', 2400);
      });
    });
  }

  function userPopoverHTML() {
    var user = SC.currentUser();
    if (!user) return '';
    var st = SC.computeStats(user.id);
    return '<div class="popover-head"><h4>' + esc(user.fullName) + '</h4><span class="badge badge-primary">' + esc(user.id) + '</span></div>' +
      '<div class="popover-list">' +
      '<a class="note-item" href="profile.html"><span class="note-ico">👤</span><div class="note-title">My Profile</div></a>' +
      '<a class="note-item" href="dashboard.html"><span class="note-ico">📊</span><div class="note-title">My Dashboard</div></a>' +
      '<a class="note-item" href="achievements.html"><span class="note-ico">🏆</span><div class="note-title">Achievements &mdash; ' + st.badges.length + '/' + SC.BADGES.length + '</div></a>' +
      '<a class="note-item" href="certificates.html"><span class="note-ico">🎓</span><div class="note-title">Certificates</div></a>' +
      (user.role === 'admin' ? '<a class="note-item" href="admin.html"><span class="note-ico">🛡️</span><div class="note-title">Admin Panel</div></a>' : '') +
      '<a class="note-item" href="login.html" data-logout-pop><span class="note-ico">🚪</span><div class="note-title" style="color:var(--danger)">Logout</div></a>' +
      '</div>';
  }

  /* ============================================================
     SEVA AI — chatbot (frontend "AI" assistant)
     ============================================================ */

  function helpString() {
    var user = SC.currentUser();
    return '# I can help you with things like:\n' +
      '• How many hours have I volunteered?\n' +
      '• What should I volunteer for?\n' +
      '• Which NGO matches my skills?\n' +
      '• What badge can I earn next?\n' +
      '• What events are available?\n' +
      '• Explain my Impact Score\n' +
      '• Recommend an environmental event\n' +
      '• How can I become a better volunteer?\n' +
      '• Show my streak\n' +
      '• Who is leading the leaderboard?' +
      (user ? '' : '\n\nTip: sign in to get answers personalised to your own activity.');
  }

  function getAIResponse(raw) {
    var msg = String(raw || '').trim().toLowerCase();
    var user = SC.currentUser();
    var stats = user ? SC.computeStats(user.id) : null;
    var has = function (k) { return msg.indexOf(k) !== -1; };
    var recs = user ? SC.recommend(user, 3) : [];

    if (!msg) return 'Hi! I am Seva AI 🤖 Ask me about events, NGOs, your hours, badges or impact.';

    // greetings
    if (/^(hi|hii+|hello|hey|namaste|yo)\b/.test(msg) || msg === 'yo') {
      return '# Namaste' + (user ? ', ' + user.fullName.split(' ')[0] + '! ' : '! ') + 'Welcome to Seva Connect.\nI am Seva AI — your social impact assistant.\nAsk me anything from the suggested topics below, or just type your question. 🌱';
    }

    // thanks
    if (has('thank')) {
      return 'You are most welcome! Happy volunteering — your time truly changes someone\'s tomorrow. 🌟';
    }

    // who are you / your name
    if (has('who are you') || has('your name') || has('what are you')) {
      return '# I am Seva AI 🤖\nYour Social Impact Assistant for Seva Connect.\nI use the data stored in your browser to give you personalised recommendations, stats and guidance — no backend required.';
    }

    // hours / time
    if ((has('hours') || has('time') || has('volunteer')) && (has('have') || has('completed') || has('total') || has('how much') || has('how many'))) {
      if (user) {
        return '# Your Volunteer Hours ⏱️\n• Total completed hours: ' + stats.hours + ' hours\n• Events attended: ' + stats.eventsAttended + '\n• Current streak: ' + stats.streak + ' week' + (stats.streak === 1 ? '' : 's') + ' 🔥\n\nKeep it up! Every hour moves you up the leaderboard and unlocks badges.';
      }
      return '# Volunteer Hours ⏱️\nYou are not signed in. Please log in so I can read your hours from your profile.\n\nDemo tip: sign in as demo@sevaconnect.com to see an active volunteer profile.';
    }

    // badge next
    if (has('badge') || has('achievement') || has('milestone')) {
      if (!user) return '# Badges & Achievements 🏆\nThere are 10 badges in Seva Connect — from First Step 🥉 to Impact Leader 🌍.\nSign in to check which badges you can unlock next.';
      var list = SC.getBadgesFor(user.id);
      var nextUnlock = list.filter(function (b) { return !b.unlocked; }).slice(0, 2);
      var out = '# Badge Progress ' + stats.badges.length + '/' + SC.BADGES.length + ' 🏆\n';
      out += '• Unlocked: ' + (stats.badges.map(function (id) { var b = SC.getBadgeById(id); return b.emoji + ' ' + b.name; }).join(', ') || 'none yet');
      out += '\n\nNext up:';
      nextUnlock.forEach(function (b) {
        out += '\n• ' + b.badge.emoji + ' ' + b.badge.name + ' — ' + b.badge.desc;
      });
      out += '\n\nKeep volunteering — badges unlock automatically as you serve.';
      return out;
    }

    // recommend / match / what should I volunteer / find opportunity
    if (has('recommend') || has('match') || has('what should i') || has('find') || has('suggest') || has('opportunit') || (has('volunteer') && (has('for what') || has('should')))) {
      if (!user) return '# Find My Perfect Opportunity 🎯\nTo match you personally, I need your volunteer profile. Sign in or register, then ask me again.\n\nMeanwhile, check out our events page: events.html';
      var top = recs[0];
      if (!top) return '# Matching 🎯\nThere are no open events right now. Check back soon — new opportunities are added regularly!';
      var out = '# Perfect Match For You 🎯\nBased on your skills, interests, availability and city, here are your top opportunities:\n\n';
      recs.forEach(function (r) {
        out += '• ' + r.event.title + ' (' + r.match + '% match) — ' + r.event.location + ' on ' + SC.formatDate(r.event.date, { weekday: 'short', month: 'short', day: 'numeric' });
        r.reasons.forEach(function (rs) { out += '\n  ✓ ' + rs; });
        out += '\n';
      });
      out += '\nTap an event on the events page to register. Want me to pick the single best one?';
      return out;
    }

    // environmental / green
    if (has('environment') || has('green') || has('tree') || has('cleanup')) {
      var env = SC.getEvents().filter(function (e) { return (e.status === 'upcoming') && hasTag(e, 'Environment'); });
      if (!env.length) {
        return '# Environmental Opportunities 🌳\nNo upcoming environment events right now, but GreenSparks Foundation is always organising drives.\nCheck ngos.html and follow them for the next plantation drive!';
      }
      var out = '# Green Opportunities 🌳\nI found ' + env.length + ' environmental event' + (env.length === 1 ? '' : 's') + ':\n';
      env.forEach(function (e) {
        out += '\n• ' + e.title + ' — ' + e.location + ' · ' + SC.formatDate(e.date);
        out += '\n  ✓ ' + e.description.slice(0, 90) + '…';
      });
      out += '\n\nEnvironment events unlock the Green Warrior 🌱 badge after 3 of them.';
      return out;
    }

    // impact score
    if (has('impact')) {
      if (!user) return '# Impact Score 💚\nYour Impact Score is calculated from hours, events, NGOs joined and consistency. Sign in to see your own score.';
      return '# Impact Score 💚\nYour current score is ' + stats.impactScore + '.\n\nHow it works:\n• Volunteer hours × 10\n• Events attended × 25\n• NGOs joined × 35\n• Stream consistency bonus\n\nLevel: ' + stats.levelName + ' (' + stats.xp + ' XP) — ' + stats.levelProgress + '% to next level.';
    }

    // streak
    if (has('streak')) {
      if (!user) return '# Volunteer Streak 🔥\nSign in to see your personal streak. It is built from your attendance history.';
      return '# Your Streak 🔥\nYou have a ' + stats.streak + ' week' + (stats.streak === 1 ? '' : 's') + ' streak.\nAttend at least one activity most weeks to keep the flame alive. Cross 7 weeks to unlock Consistency Champion 🔥.';
    }

    // leaderboard
    if (has('leader')) {
      var lb = SC.getLeaderboard();
      if (!lb.length) return '# Leaderboard 🏆\nNo volunteers ranked yet. Be the first!';
      var podium = ['🥇', '🥈', '🥉'];
      var out = '# Leaderboard Top 3 🏆\n';
      lb.slice(0, 3).forEach(function (r, i) {
        out += '\n• ' + podium[i] + ' ' + r.volunteer.fullName + ' — ' + r.stats.impactScore + ' pts (' + r.stats.hours + ' hrs)\n';
      });
      out += '\nSee the full rankings on leaderboard.html';
      return out;
    }

    // level / xp
    if (has('level') || has('xp')) {
      if (!user) return '# Levels & XP 🌱\nSeva Connect has 5 levels: New Volunteer → Active Helper → Community Contributor → Social Impact Champion → Community Leader.\nSign in to see your level.';
      return '# Your Level ' + stats.levelIcon + ' ' + stats.levelName + '\n• XP: ' + stats.xp + '\n• Progress to ' + stats.nextLevel + ': ' + stats.levelProgress + '%\n\nYou earn XP from every session, event and NGO you join. Community Leader (1000+ XP) is the ultimate goal!';
    }

    // events available
    if (has('events') || has('event') || has('register') || has('join')) {
      var up = SC.getEvents().filter(function (e) { return e.status === 'upcoming'; }).slice(0, 4);
      if (!up.length) return '# Upcoming Events 📅\nNo upcoming events at the moment. Check back soon!';
      var o = '# Upcoming Events (next ' + up.length + ') 📅\n';
      up.forEach(function (e) {
        o += '\n• ' + e.title + ' — ' + e.location + ' · ' + SC.formatDate(e.date, { weekday: 'short', month: 'short', day: 'numeric' });
        o += '\n  ✓ ' + e.ngoName + ' · ' + e.time;
      });
      o += '\n\nFind them all with filters and calendar on events.html';
      return o;
    }

    // NGOs
    if (has('ngo') || has('organisation') || has('organization')) {
      var ngos = SC.getNGOs().filter(function (n) { return n.status === 'approved'; });
      if (!ngos.length) return '# NGOs 🤝\nNo NGOs registered yet.';
      var o2 = '# Verified NGOs (' + ngos.length + ') 🤝\n';
      ngos.slice(0, 4).forEach(function (n) {
        o2 += '\n• ' + n.logo + ' ' + n.name + ' — ' + n.category + ' · ' + n.city + ' · ⭐ ' + n.rating;
      });
      o2 += '\n\nExplore, compare and join any NGO on ngos.html';
      return o2;
    }

    // skills based NGO matching
    if ((has('skill')) && (has('ngo') || has('match'))) {
      if (!user) return '# NGO Matching 🤝\nSign in so I can match NGOs to your skills and interests.';
      var best = SC.getNGOs().filter(function (n) { return SC.intersect(n.skillsNeeded, user.skills).length > 0 || SC.memberOf(user.interests, n.category); });
      if (!best.length) return '# NGO Matching 🤝\nNo NGO currently matches your exact profile, but new NGOs are added often. Browse ngos.html and join any you like.';
      var ob = '# NGOs That Fit You 🤝\nBased on your profile, try:\n';
      best.slice(0, 3).forEach(function (n) {
        ob += '\n• ' + n.name + ' — ' + n.category + ' · ' + n.city + ' ⭐' + n.rating;
      });
      ob += '\n\nJoin an NGO to unlock its events and grow your impact.';
      return ob;
    }

    // certificates
    if (has('certificate')) {
      if (!user) return '# Certificates 🎓\nWhen you complete events, Seva Connect issues verifiable Certificates of Appreciation.\nSign in to see yours, or verify any certificate on certificates.html.';
      var certs = SC.certificatesOf(user.id);
      return '# My Certificates 🎓\n• Certificates earned: ' + certs.length + '\n' +
        (certs.length
          ? certs.slice(0, 3).map(function (c) { return '• ' + c.event + ' (' + c.hours + 'h) — ' + SC.formatDate(c.date); }).join('\n')
          : 'Complete and check out of an event to earn your first certificate.') +
        '\n\nEvery certificate has a unique ID that anyone can verify on certificates.html.';
    }

    // better volunteer / tips
    if (has('better') || has('tips') || has('improve') || has('start')) {
      return '# How To Be An Even Better Volunteer 💪\n• Show up consistently — streaks earn bonus XP and unlock badges.\n• Match your skills to the right causes.\n• Check in & out of every session so your hours are recorded.\n• Join NGOs that align with your interests.\n• Recruit friends — community grows impact.\n\nYou have ' + (stats ? stats.hours + ' hours already logged' : 'started your journey') + ' — keep it going!';
    }

    // people helped
    if ((has('people') || has('helped'))) {
      if (!user) return '# People Helped 💚\nTurn your hours into estimated impact — you can try the Time → Impact calculator on impact.html.';
      return '# Estimated Impact 💚\nBased on your activity, your estimated contribution is ' + stats.peopleHelped + ' people helped.\n\nRemember: this is an estimate computed from your logged hours and activities.';
    }

    // help
    if (has('help') || has('what can you') || has('capab')) {
      return helpString();
    }

    // fallback
    return '# I\'m not 100% sure about that one 🤔\nTry asking me about one of these:\n' +
      '• "How many hours have I volunteered?"\n' +
      '• "What should I volunteer for?"\n' +
      '• "What events are available?"\n' +
      '• "Which NGO matches my skills?"\n' +
      '• "What badge can I earn next?"\n' +
      '• "Explain my impact score"\n' +
      '• "Recommend an environmental event"';

    function hasTag(e, cat) { return String(e.category).toLowerCase().indexOf(cat.toLowerCase()) !== -1; }
  }

  var Chat = {
    build: function () {
      if (qs('.chatbot')) return;
      var wrap = document.createElement('div');
      wrap.innerHTML =
        '<button class="chatbot-toggle" data-chat-toggle aria-label="Open Seva AI chat" aria-expanded="false">' +
        '<span class="btn-ico">🤖</span> Ask Seva AI</button>' +
        '<section class="chatbot" data-chat role="dialog" aria-label="Seva AI assistant">' +
        '<div class="chat-head">' +
        '<span class="chat-ava">🤖</span>' +
        '<div><div class="ch-name">Seva AI</div><div class="ch-sub">Your Social Impact Assistant</div></div>' +
        '<div class="chat-head-actions">' +
        '<button data-chat-min aria-label="Minimize chat"><i class="fa-solid fa-minus"></i></button>' +
        '<button data-chat-close aria-label="Close chat"><i class="fa-solid fa-xmark"></i></button>' +
        '</div></div>' +
        '<div class="chat-body" data-chat-body></div>' +
        '<div class="chat-suggest" data-chat-suggest></div>' +
        '<div class="chat-input-row">' +
        '<input type="text" placeholder="Ask Seva AI something…" aria-label="Message Seva AI" data-chat-input>' +
        '<button class="chat-send" data-chat-send aria-label="Send message"><i class="fa-solid fa-paper-plane"></i></button>' +
        '</div></section>';
      // avoid reusing wrapper for all bots
      while (wrap.firstChild) {
        document.body.appendChild(wrap.firstChild);
      }
      var sugg = [
        'Find volunteering opportunities for me',
        'Which NGO matches my skills?',
        'How many hours have I volunteered?',
        'What badge can I earn next?',
        'What events are available?',
        'Explain my Impact Score',
        'Recommend an environmental event',
        'How can I become a better volunteer?'
      ];
      var sugWrap = qs('[data-chat-suggest]');
      sugg.forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = s;
        b.addEventListener('click', function () { Chat.send(s); });
        sugWrap.appendChild(b);
      });
      this.bind();
    },
    bind: function () {
      var bot = qs('.chatbot');
      var input = qs('[data-chat-input]');
      var send = qs('[data-chat-send]');
      var toggle = qs('[data-chat-toggle]');

      toggle.addEventListener('click', function () {
        var open = bot.classList.contains('open');
        if (!open) Chat.open();
        else Chat.close();
      });
      qs('[data-chat-min]', bot).addEventListener('click', function () { Chat.close(true); });
      qs('[data-chat-close]', bot).addEventListener('click', function () { Chat.close(); });
      send.addEventListener('click', function () { Chat.send(input.value); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); Chat.send(input.value); }
        e.stopPropagation();
      });
    },
    open: function () {
      var bot = qs('.chatbot');
      bot.classList.add('open');
      qs('[data-chat-toggle]').setAttribute('aria-expanded', 'true');
      // restore minimized view
      var body = qs('[data-chat-body]', bot);
      if (body) body.style.display = '';
      var sug = qs('[data-chat-suggest]', bot);
      if (sug) sug.style.display = '';
      var row = qs('.chat-input-row', bot);
      if (row) row.style.display = '';
      bot.style.height = '';
      bot.style.width = '';
      qs('[data-chat-input]').focus();
      if (!qsa('.chat-msg', bot).length) Chat.greet();
    },
    close: function (minimize) {
      var bot = qs('.chatbot');
      bot.classList.remove('open');
      qs('[data-chat-toggle]').setAttribute('aria-expanded', 'false');
      if (minimize) {
        var body = qs('[data-chat-body]', bot);
        if (body) {
          body.style.display = 'none';
          qs('[data-chat-suggest]', bot).style.display = 'none';
          qs('.chat-input-row', bot).style.display = 'none';
          bot.style.height = 'auto';
          qs('.chat-head', bot).style.borderRadius = '0';
        }
      }
    },
    greet: function () {
      var user = SC.currentUser();
      var hello = 'Hi' + (user ? ', ' + user.fullName.split(' ')[0] : ' there') + '! 👋 I am Seva AI, your social impact assistant.\n\nI can tell you about events, NGOs, your hours, badges, streak and impact — all from your own data.\n\nTry a suggestion below or type your question!';
      Chat.renderBot(hello);
    },
    send: function (msg) {
      msg = String(msg || '').trim();
      var input = qs('[data-chat-input]');
      if (!msg) return;
      input.value = '';
      Chat.renderUser(msg);
      Chat.typing(true);
      var delay = 500 + Math.min(msg.length * 14, 900);
      setTimeout(function () {
        Chat.typing(false);
        Chat.renderBot(getAIResponse(msg));
      }, delay);
    },
    renderUser: function (msg) {
      var body = qs('[data-chat-body]');
      var el = document.createElement('div');
      el.className = 'chat-msg user';
      el.textContent = msg;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
    },
    typing: function (on) {
      var body = qs('[data-chat-body]');
      var t = qs('.typing', body);
      if (on && !t) {
        t = document.createElement('div');
        t.className = 'chat-msg bot typing';
        t.innerHTML = '<span></span><span></span><span></span>';
        t.setAttribute('aria-label', 'Seva AI is typing');
        body.appendChild(t);
        body.scrollTop = body.scrollHeight;
      } else if (!on && t) {
        t.remove();
      }
    },
    renderBot: function (text) {
      var body = qs('[data-chat-body]');
      var el = document.createElement('div');
      el.className = 'chat-msg bot';
      var lines = String(text || '').split('\n');
      var html = '';
      lines.forEach(function (line) {
        var t = line.trim();
        if (!t) { html += '<div class="cm-divider"></div>'; return; }
        if (t.indexOf('#') === 0) {
          html += '<div class="cm-title">' + esc(t.replace(/^#+\s*/, '')) + '</div>';
        } else if (t.indexOf('•') === 0 || t.indexOf('✓') === 0) {
          var isCheck = t.indexOf('✓') === 0;
          html += '<div class="cm-row"><i class="fa-solid ' + (isCheck ? 'fa-circle-check' : 'fa-circle') + '"></i><span>' + esc(t.replace(/^[•✓]\s*/, '')) + '</span></div>';
        } else if (t.indexOf('**') === 0) {
          html += '<div class="cm-title" style="color:var(--ink)">' + esc(t.replace(/\*\*/g, '')) + '</div>';
        } else {
          html += '<div>' + esc(t) + '</div>';
        }
      });
      el.innerHTML = html;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
    }
  };

  /* ============================================================
     PAGE-LEVEL HELPERS
     ============================================================ */

  function initFaq() {
    document.addEventListener('click', function (e) {
      var q = e.target.closest('.faq-q');
      if (!q) return;
      var item = q.closest('.faq-item');
      var ans = item.querySelector('.faq-a');
      var open = item.classList.contains('open');
      qsa('.faq-item.open').forEach(function (i) {
        i.classList.remove('open');
        i.querySelector('.faq-a').style.maxHeight = '0px';
      });
      if (!open) {
        item.classList.add('open');
        ans.style.maxHeight = ans.scrollHeight + 'px';
      }
    });
  }

  function initScrollTop() {
    var btn = document.createElement('button');
    btn.className = 'scroll-top';
    btn.setAttribute('aria-label', 'Scroll to top');
    btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    document.body.appendChild(btn);
    window.addEventListener('scroll', function () {
      btn.classList.toggle('show', window.scrollY > 480);
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initPreloader() {
    var pre = qs('#preloader');
    if (!pre) return;
    var done = function () {
      pre.classList.add('done');
      setTimeout(function () { if (pre.parentNode) pre.parentNode.removeChild(pre); }, 500);
    };
    if (document.readyState === 'complete') done();
    else window.addEventListener('load', done);
    setTimeout(done, 2500); // safety
  }

  function initClock() {
    qsa('[data-clock]').forEach(function (el) {
      function tick() {
        var d = new Date();
        el.textContent = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      tick();
      setInterval(tick, 1000);
    });
  }

  /* ============================================================
     HOME PAGE (index.html) widgets — data-driven sections
     ============================================================ */

  function ngoCardHTML(n) {
    return '<article class="card ngo-card reveal">' +
      '<div class="ngo-top-row">' +
      '<span class="ngo-logo" style="background:' + esc(n.color) + ';color:#fff" aria-hidden="true">' + esc(n.logo) + '</span>' +
      '<div class="flex" style="flex-wrap:wrap"><h3 class="ngo-name">' + esc(n.name) +
      (n.verified ? ' <span class="badge badge-verified">Verified</span>' : '') + '</h3>' +
      '<span class="ngo-cat">' + esc(n.category) + '</span></div></div>' +
      '<p class="ngo-desc">' + esc((n.description || '').slice(0, 120)) + '…</p>' +
      '<div class="ngo-meta">' +
      '<div><div class="n">' + n.volunteersCount + '+</div><div class="l">Volunteers</div></div>' +
      '<div><div class="n">' + n.projects + '</div><div class="l">Projects</div></div>' +
      '<div><div class="n" style="color:var(--warning)"><span class="ngo-stars">★</span> ' + n.rating + '</div><div class="l">Rating</div></div>' +
      '</div>' +
      '<a class="btn btn-outline btn-sm btn-block" href="ngos.html"><i class="fa-solid fa-arrow-right"></i> Explore NGO</a>' +
      '</article>';
  }

  function eventCardHTML(e) {
    var d = new Date(e.date + 'T00:00:00');
    var seatsLeft = Math.max(0, e.capacity - (e.registered ? e.registered.length : 0));
    var fill = e.capacity ? Math.round(((e.capacity - seatsLeft) / e.capacity) * 100) : 0;
    return '<article class="card event-card reveal">' +
      '<div class="event-banner" style="background:linear-gradient(135deg,' + esc(e.color || '#2E8B57') + ',' + esc(e.color2 || '#4CAF50') + ')">' +
      '<span class="event-cat-pill">' + esc(e.category) + '</span>' +
      '<span class="event-date-pill"><span class="d">' + d.getDate() + '</span><span class="m">' + d.toLocaleString('en-IN', { month: 'short' }) + '</span></span>' +
      '<span aria-hidden="true">' + esc(e.icon) + '</span></div>' +
      '<div class="event-body">' +
      '<h3 class="event-title">' + esc(e.title) + '</h3>' +
      '<div class="event-org">' + esc(e.ngoName) + '</div>' +
      '<p class="event-desc">' + esc((e.description || '').slice(0, 110)) + '…</p>' +
      '<div class="event-details">' +
      '<span><i class="fa-solid fa-location-dot"></i> ' + esc(e.location) + '</span>' +
      '<span><i class="fa-regular fa-clock"></i> ' + esc(e.time) + '</span>' +
      '</div>' +
      '<div class="event-seats"><div class="seat-bar"><span style="width:' + fill + '%"></span></div>' +
      '<span class="seat-count">' + seatsLeft + ' seats left</span></div>' +
      '<a class="btn btn-primary btn-sm btn-block" href="events.html"><i class="fa-solid fa-circle-plus"></i> View &amp; Join</a>' +
      '</div></article>';
  }

  function initIndex() {
    if (CURRENT_PAGE !== 'index.html') return;

    var avWrap = qs('#hero-avatars');
    if (avWrap) {
      var vols = SC.getVolunteers().filter(function (v) { return v.role !== 'admin'; }).slice(0, 5);
      avWrap.innerHTML = vols.map(function (v) { return avatarHTML(v.fullName, v.photo); }).join('');
    }

    var ngoGrid = qs('#featured-ngos-grid');
    if (ngoGrid) {
      var topNgos = SC.getNGOs().filter(function (n) { return n.status === 'approved' && n.verified; })
        .sort(function (a, b) { return b.rating - a.rating; }).slice(0, 3);
      ngoGrid.innerHTML = topNgos.map(ngoCardHTML).join('');
    } else {
      var fallback = qs('.featured-ngos-static');
      if (fallback) fallback.classList.remove('hide');
    }

    var eventGrid = qs('#upcoming-events-grid');
    if (eventGrid) {
      var evs = SC.getEvents().filter(function (e) { return e.status === 'upcoming'; })
        .sort(function (a, b) { return a.date.localeCompare(b.date); }).slice(0, 3);
      eventGrid.innerHTML = evs.map(eventCardHTML).join('');
    }
  }

  /* ============================================================
     PUBLIC APP API
     ============================================================ */

  window.App = {
    esc: esc,
    avatarHTML: avatarHTML,
    avatarGrad: avatarGrad,
    pageTitle: pageTitle,
    qs: qs,
    qsa: qsa,
    initReveals: setupObservers,
    refreshReveals: refreshReveals,
    animateCounters: animateCounters,
    toast: Toast.show,
    modal: Modal.open,
    confirm: confirmModal,
    confetti: confetti,
    unlockBadge: unlockBadge,
    closePopovers: closePopovers,
    getAIResponse: getAIResponse,
    theme: Theme,
    isAdmin: function () { var u = SC.currentUser(); return !!(u && u.role === 'admin'); },
    requireLogin: function (redirect) {
      var u = SC.currentUser();
      if (u) return u;
      App.toast('Please Sign In', 'You need to be signed in to access that page.', 'warning', 3000);
      setTimeout(function () {
        location.href = 'login.html?next=' + encodeURIComponent(redirect || CURRENT_PAGE);
      }, 600);
      return null;
    },
    logout: function () {
      SC.logout();
      App.toast('Signed Out', 'You have been logged out. See you soon!', 'info', 2400);
      setTimeout(function () { if (CURRENT_PAGE === 'index.html') refreshNavbar(); else location.href = 'index.html'; }, 400);
    },
    currentPage: function () { return CURRENT_PAGE; }
  };

  /* ============================================================
     BOOT
     ============================================================ */

  function boot() {
    try { Theme.init(); } catch (e) {}

    initPreloader();
    initFaq();
    initScrollTop();
    initClock();

    // mount chrome
    qsa('[data-component="navbar"]').forEach(function (m) {
      if (m.dataset.bound) return;
      m.innerHTML = navbarHTML();
      m.dataset.bound = '1';
    });
    qsa('[data-component="footer"]').forEach(function (m) {
      if (m.dataset.bound) return;
      m.innerHTML = footerHTML();
      m.dataset.bound = '1';
    });
    bindChrome();

    // logout inside user popover
    document.addEventListener('click', function (e) {
      var lo = e.target.closest('[data-logout-pop]');
      if (lo) { e.preventDefault(); App.closePopovers(); App.logout(); }
    });

    // chat
    Chat.build();

    // home page data widgets
    initIndex();

    // observers after chrome mounted
    setupObservers();

    // outside click closes popovers
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-popover-tt]') && !e.target.closest('.nav-popover')) closePopovers();
    });

    // theme icon sync on widget swap for page module scripts
    qsa('[data-component="navbar"]').forEach(function (m) { Theme.apply(Theme.current(), false); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // keep reference for future page scripts needing reveal/counter rescan
  window._scBoot = boot;
})();