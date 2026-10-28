(function () {
  'use strict';

  // В превью без сервера заявки не отправляются
  var DEMO = false;

  var $ = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };

  /* ---------- Плейсхолдеры для фото: если файла нет — показываем заглушку ---------- */
  $$('.media > img').forEach(function (img) {
    var mark = function () { img.parentElement.classList.add('is-empty'); };
    if (img.complete && img.naturalWidth === 0) mark();
    img.addEventListener('error', mark);
  });

  /* ---------- Шапка ---------- */
  var header = $('#header');
  var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 20); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Мобильное меню ---------- */
  var burger = $('#burger');
  var nav = $('#nav');
  var setMenu = function (open) {
    nav.classList.toggle('is-open', open);
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    document.body.classList.toggle('lock', open);
  };
  burger.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
  $$('a, button', nav).forEach(function (el) { el.addEventListener('click', function () { setMenu(false); }); });

  /* ---------- Подсветка пункта меню текущей секции ---------- */
  var links = $$('.nav a[href^="#"]');
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var t = $(a.getAttribute('href')); if (t) spy.observe(t); });
  }

  /* ---------- Анимация появления ---------- */
  var revealEls = $$('.section .container > *, .dark .container > *, .footer__top > *');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  /* ---------- Модальные окна ---------- */
  var lastFocus = null;
  var openModal = function (modal) {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('lock');
    var f = modal.querySelector('input:not([type=hidden]):not(.hp), button.modal__close');
    if (f) setTimeout(function () { f.focus(); }, 50);
  };
  var closeModal = function (modal) {
    $$('video', modal).forEach(function (v) { v.pause(); });
    modal.hidden = true;
    if (!nav.classList.contains('is-open')) document.body.classList.remove('lock');
    if (modal.id === 'mediaModal') $('#mediaInner').innerHTML = '';
    if (lastFocus) lastFocus.focus();
  };
  $$('.modal').forEach(function (m) {
    $$('[data-close]', m).forEach(function (b) { b.addEventListener('click', function () { closeModal(m); }); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    $$('.modal').forEach(function (m) { if (!m.hidden) closeModal(m); });
    if (nav.classList.contains('is-open')) setMenu(false);
  });

  /* ---------- Форма заявки ---------- */
  var formModal = $('#formModal');
  var form = $('#leadForm');
  var formBody = $('#formBody');
  var formSuccess = $('#formSuccess');
  var formTitle = $('#formTitle');

  $$('[data-open-form]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      // Если кнопка внутри другого окна (например, видео по формату), закрываем его
      var parent = btn.closest('.modal');
      if (parent) closeModal(parent);
      var tariff = btn.getAttribute('data-tariff') || '';
      var ev = btn.getAttribute('data-event') || '';
      var topic = btn.getAttribute('data-topic') || '';
      form.tariff.value = tariff;
      form.topic.value = topic;
      if (!ev && parent && parent.id === 'formatModal') ev = parent.getAttribute('data-current') || '';
      if (ev) form.event.value = ev;
      formTitle.textContent = tariff ? 'Тариф «' + tariff + '»' : ev ? ev + ': обсудим детали' : 'Обсудим ваш праздник';
      formBody.hidden = false;
      formSuccess.hidden = true;
      openModal(formModal);
    });
  });
  // Переход со страницы «Обо мне» по кнопке «Обсудить мероприятие»
  if (location.hash === '#zayavka') {
    history.replaceState(null, '', location.pathname);
    openModal(formModal);
  }

  // Маска телефона +7 (XXX) XXX-XX-XX
  var phone = form.phone;
  phone.addEventListener('input', function () {
    var d = phone.value.replace(/\D/g, '');
    if (!d) { phone.value = ''; return; }
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    var r = '+7';
    if (d.length > 1) r += ' (' + d.slice(1, 4);
    if (d.length >= 4) r += ')';
    if (d.length > 4) r += ' ' + d.slice(4, 7);
    if (d.length > 7) r += '-' + d.slice(7, 9);
    if (d.length > 9) r += '-' + d.slice(9, 11);
    phone.value = r;
  });
  phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+7 ('; });
  phone.addEventListener('blur', function () { if (phone.value.replace(/\D/g, '').length <= 1) phone.value = ''; });

  // Минимальная дата — сегодня
  var today = new Date();
  form.date.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  // Telegram: можно оставить ник вместо телефона. WhatsApp и звонок: нужен телефон
  var tg = $('.js-tg', form);
  var tgField = $('.js-tg-field', form);
  var tgHint = $('.js-tg-hint', form);
  var phoneLabel = $('.js-phone-label', form);
  var isTg = function () { return form.contact.value === 'Telegram'; };
  var syncContact = function () {
    tgField.hidden = !isTg();
    tgHint.hidden = !isTg();
    phoneLabel.textContent = isTg() ? 'Или телефон' : 'Телефон *';
    tgField.classList.remove('has-error');
    phone.closest('.field').classList.remove('has-error');
  };
  Array.prototype.forEach.call(form.contact, function (el) { el.addEventListener('change', syncContact); });
  syncContact();
  tg.addEventListener('blur', function () {
    var v = tg.value.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@+/, '');
    tg.value = v ? '@' + v : '';
  });

  var validate = function () {
    var nameField = form.name.closest('.field');
    var phoneField = phone.closest('.field');
    var nameOk = form.name.value.trim().length >= 2;
    var digits = phone.value.replace(/\D/g, '').length;
    var phoneOk = digits === 11;
    var contactOk;
    if (isTg()) {
      var nick = tg.value.trim();
      var nickOk = /^@?[A-Za-z0-9_]{4,32}$/.test(nick);
      var phoneEmpty = digits <= 1;
      contactOk = (nick && nickOk && (phoneEmpty || phoneOk)) || (!nick && phoneOk);
      tgField.classList.toggle('has-error', !contactOk && (nick ? !nickOk : phoneEmpty));
      phoneField.classList.toggle('has-error', !contactOk && !phoneEmpty && !phoneOk);
    } else {
      contactOk = phoneOk;
      phoneField.classList.toggle('has-error', !phoneOk);
    }
    nameField.classList.toggle('has-error', !nameOk);
    form.agree.closest('.agree').classList.toggle('has-error', !form.agree.checked);
    return nameOk && contactOk && form.agree.checked;
  };
  [form.name, phone, tg].forEach(function (el) {
    el.addEventListener('input', function () { el.closest('.field').classList.remove('has-error'); });
  });

  var status = $('.form__status', form);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = '';
    status.classList.remove('is-error');
    if (!validate()) { var bad = $('.has-error input', form); if (bad) bad.focus(); return; }
    if (DEMO) { formBody.hidden = true; formSuccess.hidden = false; return; }

    form.classList.add('is-loading');
    fetch(form.getAttribute('action'), {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || 'send failed');
        form.reset();
        form.agree.checked = true;
        syncContact();
        formBody.hidden = true;
        formSuccess.hidden = false;
      })
      .catch(function () {
        status.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз или напишите мне в Telegram.';
        status.classList.add('is-error');
      })
      .finally(function () { form.classList.remove('is-loading'); });
  });

  /* ---------- Видео и фото ---------- */
  var mediaModal = $('#mediaModal');
  var mediaInner = $('#mediaInner');

  var toEmbed = function (url) {
    var m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    if (m) return '<iframe src="https://www.youtube.com/embed/' + m[1] + '?autoplay=1&rel=0" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>';
    var vk = url.match(/vk(?:video)?\.(?:com|ru)\/video(-?\d+)_(\d+)/);
    if (vk) return '<iframe src="https://vk.com/video_ext.php?oid=' + vk[1] + '&id=' + vk[2] + '&autoplay=1" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>';
    if (/\.(mp4|webm)(\?|$)/i.test(url)) return '<video src="' + url + '" controls autoplay playsinline></video>';
    return '<iframe src="' + url + '" allow="autoplay; fullscreen" allowfullscreen></iframe>';
  };

  $$('[data-video]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-video');
      mediaInner.innerHTML = url
        ? toEmbed(url)
        : '<div class="stub"><svg><use href="#i-play"/></svg>Видео скоро появится</div>';
      // Вертикальные ролики (снятые на телефон) показываем высоким окном
      mediaInner.classList.toggle('is-portrait', !!url && btn.hasAttribute('data-portrait'));
      openModal(mediaModal);
    });
  });

  $$('[data-photo]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.classList.contains('is-empty')) {
        mediaInner.innerHTML = '<div class="stub">Фото скоро появится</div>';
      } else {
        mediaInner.innerHTML = '<img src="' + btn.getAttribute('data-photo') + '" alt="">';
      }
      openModal(mediaModal);
    });
  });

  /* ---------- Рилсы играют сами без звука, пока видны ---------- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduce) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (!v.getAttribute('src')) v.src = v.dataset.src;
          var pr = v.play();
          if (pr && pr.catch) pr.catch(function () {});
        } else v.pause();
      });
    }, { threshold: 0.3 });
    $$('video[data-src]').forEach(function (v) { vio.observe(v); });

    /* Цифры отсчитываются, когда блок появляется на экране */
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        var el = e.target, from = +el.dataset.from, to = +el.dataset.to, t0 = null;
        var tick = function (t) {
          if (!t0) t0 = t;
          var k = Math.min(1, (t - t0) / 1400);
          k = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(from + (to - from) * k);
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    $$('.js-count').forEach(function (c) { c.textContent = c.dataset.from; cio.observe(c); });
  }

  /* ---------- Видео по форматам ---------- */
  var fModal = $('#formatModal');
  var fTrack = $('#formatTrack');
  var fDots = $('#formatDots');
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var stopAll = function () { $$('video', fTrack).forEach(function (v) { v.pause(); }); };
  $$('[data-format]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var name = btn.getAttribute('data-format');
      var list = (window.FORMATS && window.FORMATS[name]) || [];
      fModal.setAttribute('data-current', name);
      $('#formatTitle').textContent = name;
      fTrack.innerHTML = list.map(function (it, i) {
        var cls = 'fmt__item' + (it.vertical === false ? ' fmt__item--wide' : '');
        var inner = it.video
          ? '<video src="' + esc(it.video) + '"' + (it.poster ? ' poster="' + esc(it.poster) + '"' : '') + ' controls playsinline preload="metadata"></video>'
          : '<div class="fmt__ph"><svg><use href="#i-play"/></svg><b>' + esc(it.title) + '</b><span>Видео появится здесь</span></div>';
        return '<figure class="' + cls + '" data-i="' + i + '">' + inner + '<figcaption>' + esc(it.title) + '</figcaption></figure>';
      }).join('');
      fDots.innerHTML = list.map(function (_, i) { return '<button type="button" aria-label="Видео ' + (i + 1) + '" data-go="' + i + '"></button>'; }).join('');
      var mark = function () {
        var items = $$('.fmt__item', fTrack), mid = fTrack.scrollLeft + fTrack.clientWidth / 2, best = 0, bd = 1e9;
        items.forEach(function (el, i) { var c = el.offsetLeft + el.offsetWidth / 2, d = Math.abs(c - mid); if (d < bd) { bd = d; best = i; } });
        $$('button', fDots).forEach(function (d, i) { d.classList.toggle('is-on', i === best); });
      };
      fTrack.onscroll = function () { requestAnimationFrame(mark); };
      $$('button', fDots).forEach(function (d) {
        d.addEventListener('click', function () {
          var el = $$('.fmt__item', fTrack)[+d.getAttribute('data-go')];
          fTrack.scrollTo({ left: el.offsetLeft - (fTrack.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
        });
      });
      // Играет только одно видео одновременно
      $$('video', fTrack).forEach(function (v) {
        v.addEventListener('play', function () { $$('video', fTrack).forEach(function (o) { if (o !== v) o.pause(); }); });
      });
      openModal(fModal);
      fTrack.scrollLeft = 0;
      mark();
    });
  });
  $$('[data-close]', fModal).forEach(function (b) { b.addEventListener('click', stopAll); });

  /* ---------- Живая карусель атмосферы ---------- */
  var atmo = $('.js-atmo');
  if (atmo) {
    // Дублируем ленту, чтобы она крутилась без разрыва
    atmo.innerHTML += atmo.innerHTML;
    $$('[data-photo]', atmo).forEach(function (btn, i) {
      if (i >= atmo.children.length / 2) btn.setAttribute('aria-hidden', 'true'), btn.tabIndex = -1;
      btn.addEventListener('click', function () {
        mediaInner.innerHTML = '<img src="' + btn.getAttribute('data-photo') + '" alt="">';
        mediaInner.classList.remove('is-portrait');
        openModal(mediaModal);
      });
    });
  }

  /* ---------- Год в футере ---------- */
  var y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
})();
