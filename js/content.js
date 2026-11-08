/*
  Подставляет на страницу тексты, цены и фото из content/content.json.
  Этот файл меняется через страницу правок /admin.
  Если файл не загрузился, на странице остаётся текст, который уже есть в HTML.
*/
(function () {
  'use strict';

  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  // Достаём значение по пути вида "prices.0.features"
  var get = function (obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  };

  // Неразрывный пробел после коротких слов, чтобы предлоги не висели в конце строки
  var typo = function (t) {
    return String(t)
      .replace(/(^|[\s(«])(в|во|на|с|со|к|ко|а|и|но|не|ни|о|об|у|за|от|до|по|из|без|для|при|под|над|про|я|вы|мы|же|ли|то|как|или|их|все|всё) /gi, '$1$2 ')
      .replace(/(\d) (?=\d{3}\b)/g, '$1 ')
      .replace(/(\d) (?=₽|час|мин|гост|недел|ролик)/g, '$1 ')
      .replace(/ —/g, ' —');
  };

  var okImg = function (p) { return typeof p === 'string' && /^img\/[\w\-\/]+\.(jpe?g|png|webp)$/i.test(p); };
  var okUrl = function (u) { return typeof u === 'string' && /^(https?:\/\/|tel:|mailto:)/i.test(u); };

  var el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = typo(text);
    return e;
  };

  var apply = function (c) {
    $$('[data-c]').forEach(function (n) {
      var v = get(c, n.getAttribute('data-c'));
      if (typeof v === 'string' && v.trim()) n.textContent = typo(v);
    });

    $$('[data-c-src]').forEach(function (n) {
      var v = get(c, n.getAttribute('data-c-src'));
      if (okImg(v)) n.src = v;
    });
    $$('[data-c-photo]').forEach(function (n) {
      var v = get(c, n.getAttribute('data-c-photo'));
      if (okImg(v)) n.setAttribute('data-photo', v);
    });
    $$('[data-c-href]').forEach(function (n) {
      var v = get(c, n.getAttribute('data-c-href'));
      if (okUrl(v)) n.href = v;
    });

    $$('[data-c-paras]').forEach(function (n) {
      var v = get(c, n.getAttribute('data-c-paras'));
      if (typeof v !== 'string' || !v.trim()) return;
      n.textContent = '';
      v.split(/\n\s*\n/).forEach(function (p) { if (p.trim()) n.appendChild(el('p', '', p.trim())); });
    });

    $$('[data-c-list]').forEach(function (n) {
      var v = get(c, n.getAttribute('data-c-list'));
      if (!Array.isArray(v) || !v.length) return;
      n.textContent = '';
      v.forEach(function (item) { if (String(item).trim()) n.appendChild(el('li', '', item)); });
    });

    // Цены: часть до « / » выделяется жирным
    $$('[data-c-costs]').forEach(function (n) {
      var v = get(c, n.getAttribute('data-c-costs'));
      if (!Array.isArray(v) || !v.length) return;
      n.textContent = '';
      v.forEach(function (line) {
        var parts = String(line).split(' / ');
        var p = el('p', 'price__cost');
        p.appendChild(el('b', '', parts[0]));
        if (parts[1]) p.appendChild(document.createTextNode(' / ' + typo(parts.slice(1).join(' / '))));
        n.appendChild(p);
      });
    });

    $$('[data-c-faq]').forEach(function (n) {
      var v = get(c, n.getAttribute('data-c-faq'));
      if (!Array.isArray(v) || !v.length) return;
      n.textContent = '';
      v.forEach(function (item) {
        if (!item || !item.q) return;
        var d = el('details', 'faq__item');
        var s = el('summary', '', item.q);
        s.insertAdjacentHTML('beforeend', '<svg><use href="#i-plus"/></svg>');
        d.appendChild(s);
        d.appendChild(el('p', '', item.a || ''));
        n.appendChild(d);
      });
    });
  };

  fetch('content/content.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(apply)
    .catch(function () { /* остаётся текст из HTML */ });
})();
