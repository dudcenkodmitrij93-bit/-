(function () {
  'use strict';

  // В превью без сервера заявки не отправляются: включается демо-режим
  var DEMO = false;

  var $ = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

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

  /* ---------- Якоря: плавный скролл ---------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var t = $(id);
      if (!t) return;
      e.preventDefault();
      setMenu(false);
      t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---------- Подсветка пункта меню текущей секции ---------- */
  var links = $$('.nav a[href^="#"]:not(.btn)');
  if (hasIO) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var t = $(a.getAttribute('href')); if (t) spy.observe(t); });
  }

  /* ---------- Появление блоков при прокрутке ---------- */
  var reveals = $$('.reveal');
  if (hasIO && !reduce) {
    var rio = new IntersectionObserver(function (entries) {
      var n = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.setProperty('--rd', (n++ * 0.08) + 's');
        e.target.classList.add('is-in');
        rio.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { rio.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Счётчики ---------- */
  if (hasIO && !reduce) {
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

  /* ---------- Видео-рилсы играют сами, пока видны ---------- */
  var previews = $$('video[data-src]');
  if (hasIO && !reduce) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (!v.getAttribute('src')) v.src = v.dataset.src;
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.3 });
    previews.forEach(function (v) { vio.observe(v); });
  }

  /* ---------- «Узнать больше обо мне» раскрывает рассказ ---------- */
  var more = $('.js-more');
  if (more) {
    var panel = $('#aboutMore');
    more.addEventListener('click', function () {
      var open = panel.hidden;
      panel.hidden = !open;
      more.setAttribute('aria-expanded', String(open));
      more.firstChild.textContent = open ? 'Свернуть ' : 'Узнать больше обо мне ';
      if (open) panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    });
  }

  /* ---------- Просмотр видео со звуком и фото ---------- */
  var modal = $('#mediaModal');
  var inner = $('#mediaInner');
  var lastFocus = null;
  var openModal = function (html, portrait) {
    lastFocus = document.activeElement;
    inner.innerHTML = html;
    inner.classList.toggle('is-portrait', !!portrait);
    modal.hidden = false;
    document.body.classList.add('lock');
    $('.modal__close', modal).focus();
  };
  var closeModal = function () {
    modal.hidden = true;
    inner.innerHTML = '';
    if (!nav.classList.contains('is-open')) document.body.classList.remove('lock');
    if (lastFocus) lastFocus.focus();
  };
  $$('[data-video]').forEach(function (b) {
    b.addEventListener('click', function () {
      openModal('<video src="' + b.getAttribute('data-video') + '" controls autoplay playsinline></video>', b.hasAttribute('data-portrait'));
    });
  });
  $$('[data-photo]').forEach(function (b) {
    b.addEventListener('click', function () { openModal('<img src="' + b.getAttribute('data-photo') + '" alt="">', false); });
  });
  $$('[data-close]', modal).forEach(function (x) { x.addEventListener('click', closeModal); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!modal.hidden) closeModal();
    if (nav.classList.contains('is-open')) setMenu(false);
  });

  /* ---------- Форма заявки ---------- */
  var form = $('#leadForm');
  var phone = $('.js-phone', form);
  phone.addEventListener('input', function () {
    var d = phone.value.replace(/\D/g, '');
    phone.closest('.line-field').classList.remove('is-err');
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

  var today = new Date();
  form.date.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  var status = $('.form__status', form);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = '';
    status.classList.remove('is-err');
    var phoneOk = phone.value.replace(/\D/g, '').length === 11;
    phone.closest('.line-field').classList.toggle('is-err', !phoneOk);
    form.agree.closest('.agree').classList.toggle('is-err', !form.agree.checked);
    if (!phoneOk) { phone.focus(); return; }
    if (!form.agree.checked) return;

    form.classList.add('is-loading');
    var req = DEMO
      ? new Promise(function (r) { setTimeout(function () { r({ ok: true }); }, 400); })
      : fetch(form.getAttribute('action'), { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json().catch(function () { return { ok: false }; }); });
    req.then(function (res) {
      if (!res.ok) throw new Error('send failed');
      form.innerHTML = '<div class="lead-ok"><b>Спасибо, заявка у меня.</b><span>Свяжусь с вами в ближайшее время' + (DEMO ? ' (демо: заявка никуда не отправлена)' : '') + '.</span></div>';
    }).catch(function () {
      status.textContent = 'Не удалось отправить. Напишите мне в Telegram, ссылка слева.';
      status.classList.add('is-err');
    }).then(function () { form.classList.remove('is-loading'); });
  });

  var y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
})();
