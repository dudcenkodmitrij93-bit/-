(function () {
  'use strict';

  // Адрес обработчика заявок. В превью без сервера заявки не отправляются
  var SEND_URL = '../send.php';
  var DEMO = false;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* Шапка и меню */
  var header = $('#header'), nav = $('#nav'), burger = $('#burger');
  var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 10); };
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  var setMenu = function (open) {
    nav.classList.toggle('is-open', open); burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  };
  burger.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });

  /* Якоря: плавный скролл через JS */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href'); if (id.length < 2) return;
      var t = $(id); if (!t) return;
      e.preventDefault(); setMenu(false); t.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* Маска телефона */
  $$('.js-phone').forEach(function (p) {
    p.addEventListener('input', function () {
      var d = p.value.replace(/\D/g, ''); p.classList.remove('is-err');
      if (!d) { p.value = ''; return; }
      if (d[0] === '8') d = '7' + d.slice(1); if (d[0] !== '7') d = '7' + d; d = d.slice(0, 11);
      var r = '+7'; if (d.length > 1) r += ' (' + d.slice(1, 4); if (d.length >= 4) r += ')';
      if (d.length > 4) r += ' ' + d.slice(4, 7); if (d.length > 7) r += '-' + d.slice(7, 9); if (d.length > 9) r += '-' + d.slice(9, 11);
      p.value = r;
    });
    p.addEventListener('focus', function () { if (!p.value) p.value = '+7 ('; });
    p.addEventListener('blur', function () { if (p.value.replace(/\D/g, '').length <= 1) p.value = ''; });
  });
  var today = new Date();
  $$('.js-date').forEach(function (d) { d.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10); });

  var check = function (form) {
    var p = $('.js-phone', form), agree = form.agree, ok = true;
    if (p.value.replace(/\D/g, '').length !== 11) { p.classList.add('is-err'); p.focus(); ok = false; }
    agree.closest('.consent').classList.toggle('is-err', !agree.checked);
    return ok && agree.checked;
  };
  var send = function (form) {
    if (DEMO) return new Promise(function (r) { setTimeout(function () { r({ ok: true }); }, 400); });
    return fetch(SEND_URL, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); });
  };
  var fail = function (form) {
    var st = $('.form-status', form);
    st.textContent = 'Не получилось отправить. Напишите мне в Telegram или позвоните по номеру +7 (900) 000-00-00';
    st.classList.add('is-err');
  };

  /* Формы проверки даты */
  $$('.js-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault(); $('.form-status', form).textContent = '';
      if (!check(form)) return;
      form.classList.add('is-loading');
      send(form).then(function (res) {
        if (!res.ok) throw 0;
        form.innerHTML = '<p class="form-ok">Заявка принята. Евгений проверит дату и напишет вам' + (DEMO ? ' (демо: заявка никуда не отправлена)' : '') + '</p>';
      }).catch(function () { fail(form); }).then(function () { form.classList.remove('is-loading'); });
    });
  });

  /* Квиз */
  var quiz = $('.js-quiz'), qf = $('.js-quiz-form'), step = 1;
  var show = function (n) {
    step = n;
    $$('.step', qf).forEach(function (s) { s.classList.toggle('is-on', +s.dataset.step === n); });
    $('.js-qn', qf).textContent = 'Вопрос ' + n + ' из 3';
    $('.js-bar', qf).style.width = (n * 33.4) + '%';
    $('.js-back', qf).hidden = n === 1;
  };
  $$('.opt', qf).forEach(function (o) {
    o.addEventListener('click', function () {
      $$('.opt', o.parentNode).forEach(function (x) { x.classList.remove('is-on'); });
      o.classList.add('is-on'); qf[o.dataset.name].value = o.dataset.v;
      setTimeout(function () { show(step + 1); }, 180);
    });
  });
  $$('.tab', qf).forEach(function (t) {
    t.addEventListener('click', function () {
      $$('.tab', qf).forEach(function (x) { x.classList.remove('is-on'); });
      t.classList.add('is-on'); qf.contact.value = t.dataset.c;
    });
  });
  $('.js-back', qf).addEventListener('click', function () { if (step > 1) show(step - 1); });
  qf.addEventListener('submit', function (e) {
    e.preventDefault(); $('.form-status', qf).textContent = '';
    if (!check(qf)) return;
    qf.classList.add('is-loading');
    send(qf).then(function (res) {
      if (!res.ok) throw 0;
      qf.hidden = true; $('.js-done', quiz).hidden = false;
    }).catch(function () { fail(qf); }).then(function () { qf.classList.remove('is-loading'); });
  });
  // Кнопки тарифов передают выбранный формат в квиз
  $$('.js-pick').forEach(function (b) {
    b.addEventListener('click', function () { qf.tariff.value = b.dataset.tariff; $('.js-qt', qf).textContent = 'Формат: ' + b.dataset.tariff; });
  });

  /* Слайдер галереи */
  var track = $('.js-track');
  var stepPx = function () { var t = $('.tile', track); return t ? t.getBoundingClientRect().width + 16 : 400; };
  $('.js-prev').addEventListener('click', function () { track.scrollBy({ left: -stepPx(), behavior: 'smooth' }); });
  $('.js-next').addEventListener('click', function () { track.scrollBy({ left: stepPx(), behavior: 'smooth' }); });

  /* Просмотр фото и видео */
  var modal = $('#media'), inner = $('#mediaIn'), last = null;
  var open = function (html, portrait) {
    last = document.activeElement; inner.innerHTML = html; inner.classList.toggle('is-portrait', !!portrait);
    modal.hidden = false; document.body.classList.add('lock'); $('.modal__x', modal).focus();
  };
  var close = function () { modal.hidden = true; inner.innerHTML = ''; document.body.classList.remove('lock'); if (last) last.focus(); };
  $$('[data-video]').forEach(function (b) {
    b.addEventListener('click', function () { open('<video src="' + b.dataset.video + '" controls autoplay playsinline></video>', b.hasAttribute('data-portrait')); });
  });
  $$('[data-photo]').forEach(function (b) {
    b.addEventListener('click', function () { open('<img src="' + b.dataset.photo + '" alt="">', false); });
  });
  $$('[data-close]', modal).forEach(function (x) { x.addEventListener('click', close); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!modal.hidden) close(); setMenu(false); } });

  /* Быстрая связь */
  var fab = $('.js-fab'), fabBtn = $('.js-fab-btn');
  fabBtn.addEventListener('click', function () { var o = !fab.classList.contains('is-open'); fab.classList.toggle('is-open', o); fabBtn.setAttribute('aria-expanded', String(o)); });

  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
})();
