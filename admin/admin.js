(function () {
  'use strict';

  // В превью на claude.ai сервера нет: всё работает в демо-режиме и никуда не сохраняется
  var DEMO = !!window.ADMIN_DEMO;
  var API = 'api.php';
  var SITE = window.ADMIN_SITE || '../';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var data = null;       // то, что сейчас на экране
  var saved = '';        // последнее сохранённое состояние, для «есть несохранённые изменения»
  var demoBackups = [];

  /* ---------- Связь с сервером ---------- */
  var api = function (action, body, isJson) {
    if (DEMO) return demoApi(action, body);
    var opt = { method: action === 'me' ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'X-Admin': '1' } };
    if (body) {
      if (isJson) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
      else opt.body = body;
    }
    return fetch(API + '?action=' + action, opt).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'Сервер не ответил. Проверьте интернет' }; });
    });
  };
  var demoApi = function (action, body) {
    var res = { ok: true };
    if (action === 'me') res.auth = false;
    if (action === 'save') { demoBackups.push(saved); res.content = JSON.parse(JSON.stringify(body)); }
    if (action === 'undo') {
      if (!demoBackups.length) res = { ok: false, error: 'Сохранённых копий пока нет' };
      else res.content = JSON.parse(demoBackups.pop());
    }
    if (action === 'password') {
      if (String(body.get('new')).length < 8) res = { ok: false, error: 'Пароль должен быть не короче 8 символов' };
    }
    return new Promise(function (r) { setTimeout(function () { r(res); }, 250); });
  };

  /* ---------- Уведомления ---------- */
  var toastTimer;
  var toast = function (text, kind) {
    var t = $('#toast');
    t.textContent = text;
    t.className = 'toast is-on ' + (kind === 'err' ? 'is-err' : 'is-ok');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 3200);
  };

  /* ---------- Работа с данными ---------- */
  var get = function (path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, data); };
  var set = function (path, val) {
    var keys = path.split('.'), o = data;
    keys.slice(0, -1).forEach(function (k) { o = o[k]; });
    o[keys[keys.length - 1]] = val;
    markDirty();
  };
  var markDirty = function () {
    var dirty = JSON.stringify(data) !== saved;
    $('#bar').classList.toggle('is-dirty', dirty);
    $('#status').textContent = dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены';
    $('#save').disabled = !dirty;
  };

  /* ---------- Построение формы ---------- */
  var h = function (tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  };

  // Поле: path, подпись, тип (input | textarea | lines), подсказка
  var field = function (path, label, type, hint) {
    var isLines = type === 'lines';
    var val = get(path);
    var input = h(type === 'input' ? 'input' : 'textarea', type === 'input' ? { type: 'text' } : {});
    input.value = isLines ? (val || []).join('\n') : (val || '');
    input.addEventListener('input', function () {
      set(path, isLines ? input.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean) : input.value);
    });
    var lab = h('span', { text: label });
    if (hint) lab.appendChild(h('small', { text: ' · ' + hint }));
    return h('label', { class: 'f', 'data-path': path }, [lab, input]);
  };

  var card = function (id, title, hint, kids) {
    return h('section', { class: 'card', id: id }, [h('h2', { text: title }), hint ? h('p', { class: 'card__hint', text: hint }) : null, h('div', { class: 'grid' }, kids)]);
  };
  var sub = function (title, kids, onRemove) {
    var head = h('div', { class: 'sub-card__head' }, [h('b', { text: title })]);
    if (onRemove) {
      var rm = h('button', { class: 'btn btn--ghost btn--small', type: 'button', text: 'Удалить' });
      rm.addEventListener('click', onRemove);
      head.appendChild(rm);
    }
    return h('div', { class: 'sub-card' }, [head].concat(kids));
  };
  var two = function (a, b) { return h('div', { class: 'grid grid--2' }, [a, b]); };

  var photo = function (path, name, slot) {
    var wrap = h('div', { class: 'photo' });
    var img = h('img', { alt: name });
    var src = get(path);
    img.src = /^data:/.test(src) ? src : SITE + src;
    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', id: 'f-' + slot });
    var btn = h('label', { class: 'btn btn--ghost btn--small', for: 'f-' + slot, text: 'Заменить фото' });
    file.addEventListener('change', function () {
      var f = file.files[0];
      if (!f) return;
      if (f.size > 15 * 1024 * 1024) { toast('Фото больше 15 МБ, выберите поменьше', 'err'); return; }
      wrap.classList.add('is-loading');
      var done = function (p, preview) { set(path, p); img.src = preview || SITE + p; wrap.classList.remove('is-loading'); toast('Фото загружено. Не забудьте сохранить'); };
      if (DEMO) {
        var rd = new FileReader();
        rd.onload = function () { done(rd.result, rd.result); };
        rd.readAsDataURL(f);
        return;
      }
      var fd = new FormData(); fd.append('file', f); fd.append('slot', slot);
      api('upload', fd).then(function (r) {
        if (!r.ok) { wrap.classList.remove('is-loading'); toast(r.error, 'err'); return; }
        done(r.path);
      });
      file.value = '';
    });
    wrap.appendChild(h('div', { class: 'photo__img' }, [img]));
    wrap.appendChild(h('p', { class: 'photo__name', text: name }));
    wrap.appendChild(file);
    wrap.appendChild(btn);
    return wrap;
  };

  var render = function () {
    var root = $('#editor');
    var y = window.scrollY;
    root.textContent = '';

    root.appendChild(card('s-hero', 'Первый экран', 'То, что человек видит сразу при открытии сайта', [
      field('hero.eyebrow', 'Строка над заголовком', 'input'),
      two(field('hero.title', 'Заголовок, белая часть', 'input'), field('hero.titleGold', 'Заголовок, золотая часть', 'input')),
      field('hero.text', 'Текст под заголовком', 'textarea'),
      h('div', { class: 'grid' }, data.facts.map(function (f, i) {
        return sub('Цифра ' + (i + 1), [two(field('facts.' + i + '.num', 'Крупно', 'input'), field('facts.' + i + '.text', 'Подпись', 'input'))]);
      })),
      h('div', { class: 'photos' }, [photo('hero.photo', 'Главное фото', 'hero')])
    ]));

    root.appendChild(card('s-prices', 'Тарифы и цены', 'Каждая строка в списке становится отдельным пунктом на сайте', data.prices.map(function (p, i) {
      return sub('Тариф ' + (i + 1), [
        field('prices.' + i + '.name', 'Название', 'input'),
        field('prices.' + i + '.costs', 'Цены', 'lines', 'каждая с новой строки, например «от 55 000 ₽ / 5 часов»'),
        field('prices.' + i + '.features', 'Что входит', 'lines', 'каждый пункт с новой строки')
      ]);
    }).concat([field('pricesNote', 'Примечание под тарифами', 'textarea')])));

    root.appendChild(card('s-scen', 'Варианты сценария вечера', 'Шаги программы: каждый с новой строки', data.scenarios.map(function (s, i) {
      return sub('Сценарий ' + (i + 1), [
        two(field('scenarios.' + i + '.title', 'Название', 'input'), field('scenarios.' + i + '.meta', 'Для кого', 'input')),
        field('scenarios.' + i + '.steps', 'Как проходит вечер', 'lines')
      ]);
    })));

    var faqKids = data.faq.map(function (f, i) {
      return sub('Вопрос ' + (i + 1), [field('faq.' + i + '.q', 'Вопрос', 'input'), field('faq.' + i + '.a', 'Ответ', 'textarea')], function () {
        data.faq.splice(i, 1); markDirty(); render();
      });
    });
    var addFaq = h('button', { class: 'btn btn--ghost add', type: 'button', text: '+ Добавить вопрос' });
    addFaq.addEventListener('click', function () { data.faq.push({ q: '', a: '' }); markDirty(); render(); });
    faqKids.push(addFaq);
    root.appendChild(card('s-faq', 'Вопросы и ответы', 'Можно добавлять и удалять вопросы', faqKids));

    root.appendChild(card('s-about', 'Обо мне', 'Текст, который раскрывается по кнопке «Узнать больше обо мне». Абзацы разделяйте пустой строкой', [
      field('about.bio', 'Рассказ о себе', 'textarea')
    ]));

    root.appendChild(card('s-fears', 'Страхи клиентов и ответы', 'Тёмный блок «Чего обычно боятся, когда выбирают ведущего»', data.fears.map(function (f, i) {
      return sub('Пункт ' + (i + 1), [field('fears.' + i + '.q', 'Опасение', 'input'), field('fears.' + i + '.a', 'Ответ', 'textarea')]);
    })));

    root.appendChild(card('s-takes', 'Что беру на себя', 'Блок «Вы можете быть гостем своего праздника»', data.takes.map(function (t, i) {
      return sub('Пункт ' + (i + 1), [field('takes.' + i + '.title', 'Заголовок', 'input'), field('takes.' + i + '.text', 'Текст', 'input')]);
    })));

    root.appendChild(card('s-photos', 'Фото', 'Подойдёт любое фото с телефона, оно само уменьшится для сайта', [
      h('div', { class: 'photos' }, [
        photo('photos.atmosphere', 'Блок «Гость праздника»', 'atmosphere'),
        photo('photos.moment1', 'Моменты: фото 1', 'moment1'),
        photo('photos.moment2', 'Моменты: фото 2', 'moment2'),
        photo('photos.moment3', 'Моменты: фото 3', 'moment3'),
        photo('photos.moment4', 'Моменты: фото 4', 'moment4')
      ])
    ]));

    root.appendChild(card('s-socials', 'Соцсети', 'Полные ссылки, начиная с https://', [
      two(field('socials.telegram', 'Telegram', 'input'), field('socials.vk', 'ВКонтакте', 'input')),
      two(field('socials.youtube', 'YouTube', 'input'), field('socials.instagram', 'Instagram', 'input'))
    ]));

    var pass = h('input', { type: 'password', autocomplete: 'new-password' });
    var passBtn = h('button', { class: 'btn btn--ghost add', type: 'button', text: 'Сменить пароль' });
    passBtn.addEventListener('click', function () {
      var fd = new FormData(); fd.append('new', pass.value);
      api('password', fd).then(function (r) {
        if (!r.ok) { toast(r.error, 'err'); return; }
        pass.value = ''; toast('Пароль изменён');
      });
    });
    root.appendChild(card('s-settings', 'Пароль', 'Не короче 8 символов', [
      h('label', { class: 'f' }, [h('span', { text: 'Новый пароль' }), pass]), passBtn
    ]));

    window.scrollTo(0, y);
  };

  /* ---------- Сохранить и вернуть как было ---------- */
  var check = function () {
    var bad = [];
    if (!String(data.hero.title || '').trim()) bad.push('hero.title');
    data.prices.forEach(function (p, i) {
      if (!String(p.name || '').trim()) bad.push('prices.' + i + '.name');
      if (!p.costs || !p.costs.length) bad.push('prices.' + i + '.costs');
    });
    document.querySelectorAll('.f.is-err').forEach(function (f) { f.classList.remove('is-err'); });
    bad.forEach(function (p) { var f = document.querySelector('[data-path="' + p + '"]'); if (f) f.classList.add('is-err'); });
    if (bad.length) {
      var first = document.querySelector('[data-path="' + bad[0] + '"]');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('Заполните поля, отмеченные красным', 'err');
    }
    return !bad.length;
  };

  $('#save').addEventListener('click', function () {
    if (!check()) return;
    var btn = $('#save'); btn.disabled = true; btn.textContent = 'Сохраняю…';
    api('save', data, true).then(function (r) {
      btn.textContent = 'Сохранить';
      if (!r.ok) { btn.disabled = false; toast(r.error, 'err'); return; }
      data = r.content; saved = JSON.stringify(data); render(); markDirty();
      toast(DEMO ? 'Сохранено (демо: сайт не изменился)' : 'Сохранено. Обновите сайт, чтобы увидеть изменения');
    });
  });

  $('#undo').addEventListener('click', function () {
    var dirty = JSON.stringify(data) !== saved;
    if (dirty) {
      // Несохранённые правки просто отбрасываем
      data = JSON.parse(saved); render(); markDirty(); toast('Несохранённые изменения отменены');
      return;
    }
    api('undo').then(function (r) {
      if (!r.ok) { toast(r.error, 'err'); return; }
      data = r.content; saved = JSON.stringify(data); render(); markDirty();
      toast('Вернул версию до последнего сохранения');
    });
  });

  window.addEventListener('beforeunload', function (e) {
    if (data && JSON.stringify(data) !== saved) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- Вход и запуск ---------- */
  var start = function () {
    fetch(SITE + 'content/content.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (c) {
        data = c; saved = JSON.stringify(c);
        $('#login').hidden = true; $('#app').hidden = false;
        render(); markDirty();
      })
      .catch(function () { toast('Не удалось загрузить содержимое сайта', 'err'); });
  };

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    $('#loginErr').textContent = '';
    var fd = new FormData(); fd.append('password', $('#password').value);
    api('login', fd).then(function (r) {
      if (!r.ok) { $('#loginErr').textContent = r.error; return; }
      start();
    });
  });

  $('#logout').addEventListener('click', function () {
    api('logout').then(function () { location.reload(); });
  });

  if (DEMO) $('#demoHint').hidden = false;
  api('me').then(function (r) { if (r.auth) start(); else $('#login').hidden = false; });
})();
