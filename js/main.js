(function () {
  'use strict';

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
      var tariff = btn.getAttribute('data-tariff') || '';
      var ev = btn.getAttribute('data-event') || '';
      var topic = btn.getAttribute('data-topic') || '';
      form.tariff.value = tariff;
      form.topic.value = topic;
      if (ev) form.event.value = ev;
      formTitle.textContent = tariff ? 'Тариф «' + tariff + '»' : ev ? ev + ': обсудим детали' : 'Обсудим ваш праздник';
      formBody.hidden = false;
      formSuccess.hidden = true;
      openModal(formModal);
    });
  });

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

  var validate = function () {
    var ok = true;
    var nameField = form.name.closest('.field');
    var phoneField = phone.closest('.field');
    var nameOk = form.name.value.trim().length >= 2;
    var phoneOk = phone.value.replace(/\D/g, '').length === 11;
    nameField.classList.toggle('has-error', !nameOk);
    phoneField.classList.toggle('has-error', !phoneOk);
    form.agree.closest('.agree').classList.toggle('has-error', !form.agree.checked);
    if (!nameOk || !phoneOk || !form.agree.checked) ok = false;
    return ok;
  };
  [form.name, phone].forEach(function (el) {
    el.addEventListener('input', function () { el.closest('.field').classList.remove('has-error'); });
  });

  var status = $('.form__status', form);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = '';
    status.classList.remove('is-error');
    if (!validate()) { var bad = $('.has-error input', form); if (bad) bad.focus(); return; }

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

  /* ---------- Год в футере ---------- */
  var y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
})();
