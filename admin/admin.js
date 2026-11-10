(function () {
  'use strict';

  var API = 'api.php';
  var SITE_URL = new URL('../', location.href).href;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var pageSrc = '';        // index.html с сервера
  var doc = null;          // документ внутри окна правок
  var formats = null;      // содержимое js/formats.js
  var formatsSaved = '';
  var dirtyPage = false;
  var sel = { target: null, leaf: null, item: null, media: null, link: null };
  var editing = null;

  /* ---------- Связь с сервером ---------- */
  var api = function (action, body, isJson) {
    var opt = { method: action === 'me' ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'X-Admin': '1' } };
    if (body) {
      if (isJson) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
      else opt.body = body;
    }
    return fetch(API + '?action=' + action, opt).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'Сервер не ответил. Проверьте интернет и попробуйте ещё раз' }; });
    }, function () { return { ok: false, error: 'Нет связи с сервером. Проверьте интернет' }; });
  };

  var toastT;
  var toast = function (text, kind) {
    var t = $('#toast');
    t.textContent = text;
    t.className = 'toast is-on' + (kind === 'err' ? ' is-err' : '');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.className = 'toast'; }, kind === 'err' ? 6000 : 3000);
  };
  var busy = function (text, pct) {
    if (text === false) { $('#busy').hidden = true; return; }
    $('#busy').hidden = false;
    $('#busyText').textContent = text;
    $('#busyBar').style.width = (pct == null ? 100 : pct) + '%';
  };

  /* ---------- Загрузка файлов частями (обходит ограничения хостинга на размер) ---------- */
  var CHUNK = 2 * 1024 * 1024;
  var upload = function (file, kind, slot, max) {
    var total = Math.max(1, Math.ceil(file.size / CHUNK));
    var uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    var label = kind === 'video' ? 'Загружаю видео' : 'Загружаю фото';
    var send = function (i) {
      busy(label + '… ' + Math.round(i / total * 100) + '%', i / total * 100);
      var fd = new FormData();
      fd.append('kind', kind); fd.append('uid', uid); fd.append('index', i); fd.append('total', total);
      fd.append('slot', slot || kind);
      if (max) fd.append('max', max);
      fd.append('blob', file.slice(i * CHUNK, (i + 1) * CHUNK), 'part');
      return api('upload', fd).then(function (res) {
        if (!res.ok) throw new Error(res.error || 'Не удалось загрузить файл');
        return i + 1 < total ? send(i + 1) : res;
      });
    };
    return send(0).then(function (res) { busy(false); return res; }, function (e) { busy(false); throw e; });
  };

  var pickFile = function (input) {
    return new Promise(function (resolve) {
      input.value = '';
      input.onchange = function () { if (input.files[0]) resolve(input.files[0]); };
      input.click();
    });
  };

  // Проверяем, что браузер может показать это видео, и узнаём его размеры
  var probeVideo = function (src) {
    return new Promise(function (resolve, reject) {
      var v = document.createElement('video');
      v.preload = 'metadata'; v.muted = true;
      v.onloadedmetadata = function () { resolve({ w: v.videoWidth, h: v.videoHeight, d: v.duration }); };
      v.onerror = function () { reject(new Error('Это видео не открывается в браузере. Сохраните его в формате MP4 (H.264) и попробуйте снова')); };
      v.src = src;
    });
  };

  var chooseVideo = function () {
    return pickFile($('#fileVideo')).then(function (file) {
      if (!/\.mp4$/i.test(file.name) && file.type !== 'video/mp4') throw new Error('Нужно видео в формате MP4');
      if (file.size > 400 * 1024 * 1024) throw new Error('Видео больше 400 МБ. Его нужно сжать');
      if (file.size > 80 * 1024 * 1024 && !confirm('Видео весит ' + Math.round(file.size / 1048576) + ' МБ. Посетители будут ждать его загрузку. Лучше сжать до 30–50 МБ. Всё равно загрузить?')) throw new Error('');
      var url = URL.createObjectURL(file);
      return probeVideo(url).then(function (m) {
        return upload(file, 'video', 'video').then(function (res) { return { path: res.path, url: url, meta: m }; });
      });
    });
  };

  var chooseImage = function (slot, max) {
    return pickFile($('#fileImg')).then(function (file) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Подходят фото JPG, PNG или WEBP');
      return upload(file, 'image', slot, max);
    });
  };

  /* ---------- Выбор кадра для обложки ---------- */
  var fmtTime = function (s) { s = Math.max(0, s || 0); var m = Math.floor(s / 60); var r = (s - m * 60).toFixed(1); return m + ':' + (r < 10 ? '0' : '') + r.replace('.', ','); };
  var pickFrame = function (src) {
    return new Promise(function (resolve, reject) {
      var dlg = $('#frameDlg'), v = $('#fVideo'), range = $('#fRange');
      var close = function () { dlg.hidden = true; v.pause(); v.removeAttribute('src'); v.load(); };
      dlg.hidden = false;
      v.src = src;
      v.onloadedmetadata = function () { range.max = v.duration; range.value = Math.min(1, v.duration / 3); v.currentTime = +range.value; };
      v.ontimeupdate = function () { $('#fTime').textContent = fmtTime(v.currentTime); };
      v.onseeked = v.ontimeupdate;
      v.onerror = function () { close(); reject(new Error('Видео не открылось')); };
      range.oninput = function () { v.currentTime = +range.value; };
      $('#fBack').onclick = function () { v.currentTime = Math.max(0, v.currentTime - 0.2); range.value = v.currentTime; };
      $('#fFwd').onclick = function () { v.currentTime = Math.min(v.duration, v.currentTime + 0.2); range.value = v.currentTime; };
      $('#fCancel').onclick = function () { close(); reject(new Error('')); };
      $('#fTake').onclick = function () {
        var k = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        c.toBlob(function (blob) {
          close();
          if (!blob) { reject(new Error('Не удалось взять кадр')); return; }
          blob.name = 'frame.jpg';
          upload(blob, 'image', 'cover', 1600).then(resolve, reject);
        }, 'image/jpeg', 0.88);
      };
    });
  };

  var report = function (e) { if (e && e.message) toast(e.message, 'err'); };

  /* ---------- Состояние «есть несохранённые изменения» ---------- */
  var refreshDirty = function () {
    var dirty = dirtyPage || (formats && JSON.stringify(formats) !== formatsSaved);
    $('#bar').classList.toggle('is-dirty', !!dirty);
    $('#status').textContent = dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены';
    $('#save').disabled = !dirty;
    $('#discard').hidden = !dirty;
    return dirty;
  };
  var touchPage = function () { dirtyPage = true; refreshDirty(); };
  window.addEventListener('beforeunload', function (e) { if (refreshDirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ==========================================================
     Правка страницы
     ========================================================== */
  var ITEMS = [
    ['.reels > .reel', 'Видео в ленте'],
    ['.reviews > .review', 'Отзыв'],
    ['.atmo__track > .atmo__item', 'Фото в «Атмосфере»'],
    ['.prices__grid > .price', 'Тариф'],
    ['.faq__list > .faq__item', 'Вопрос'],
    ['.about__docs > .about__doc', 'Документ'],
    ['.about__links > .about__link', 'Ссылка'],
    ['.socials > a', 'Соцсеть'],
    ['.nums > div', 'Цифра'],
    ['.nav > a', 'Пункт меню'],
    ['li', 'Пункт списка'],
    ['.faq__item > p, .about__text > p, .steps__text > p', 'Абзац']
  ];
  var INLINE = { B: 1, STRONG: 1, I: 1, EM: 1, SMALL: 1, SPAN: 1, BR: 1 };
  var BLOCKISH = { P: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, LI: 1, FIGCAPTION: 1, LABEL: 1, DIV: 1, BLOCKQUOTE: 1, SUMMARY: 1 };
  var NOEDIT = { HTML: 1, BODY: 1, MAIN: 1, SECTION: 1, HEADER: 1, FOOTER: 1, NAV: 1, FORM: 1, SELECT: 1, OPTION: 1, TEXTAREA: 1, INPUT: 1, SCRIPT: 1, STYLE: 1 };

  var itemOf = function (el) {
    for (; el && el.nodeType === 1 && el.tagName !== 'BODY'; el = el.parentElement) {
      for (var i = 0; i < ITEMS.length; i++) if (el.matches(ITEMS[i][0])) return { el: el, name: ITEMS[i][1] };
    }
    return null;
  };
  var isLeaf = function (el) {
    if (!el || el.nodeType !== 1 || NOEDIT[el.tagName] || el.closest('svg')) return false;
    if (!el.textContent.trim()) return false;
    return $$('*', el).every(function (c) { return INLINE[c.tagName]; });
  };
  var leafOf = function (el) {
    var leaves = [];
    for (; el && el.nodeType === 1 && el.tagName !== 'BODY'; el = el.parentElement) {
      if (isLeaf(el)) leaves.push(el); else if (leaves.length) break;
    }
    if (!leaves.length) return null;
    for (var i = leaves.length - 1; i >= 0; i--) if (BLOCKISH[leaves[i].tagName]) return leaves[i];
    return leaves[0];
  };
  var mediaOf = function (target, item) {
    var scope = item ? item.el : null;
    if (target.tagName === 'IMG') return target;
    if (target.tagName === 'VIDEO' && !target.closest('[data-video]')) return target;
    var v = target.closest('[data-video]');
    if (v) return v;
    var bg = target.closest('.media, .about__doc, .atmo__item');
    if (bg && $('img', bg)) return $('img', bg);
    if (scope) {
      var m = $('[data-video]', scope) || (scope.matches('[data-video]') ? scope : null) || $('video[src]', scope) || $('img', scope);
      if (m) return m;
    }
    return null;
  };

  var clearMarks = function () {
    if (!doc) return;
    $$('.ed-sel, .ed-item, .ed-hover', doc).forEach(function (e) { e.classList.remove('ed-sel', 'ed-item', 'ed-hover'); if (!e.className) e.removeAttribute('class'); });
  };

  var select = function (target, forceItem) {
    finishEdit();
    clearMarks();
    var item = forceItem || itemOf(target);
    var leaf = forceItem ? null : leafOf(target);
    var media = forceItem ? mediaOf(forceItem.el, forceItem) : mediaOf(target, item);
    var link = (leaf || target).closest('a[href]');
    if (forceItem && forceItem.el.matches('a[href]')) link = forceItem.el;
    sel = { target: target, leaf: leaf, item: item, media: media, link: link };
    if (leaf) leaf.classList.add('ed-sel');
    else if (media && media.classList) media.classList.add('ed-sel');
    if (item && item.el !== leaf) item.el.classList.add('ed-item');
    renderPanel();
  };

  var deselect = function () { finishEdit(); clearMarks(); sel = {}; $('#panel').hidden = true; };

  var renderPanel = function () {
    var p = $('#panel');
    p.hidden = false;
    var has = false;
    $('#pTitle').textContent = sel.item ? sel.item.name : (sel.leaf ? 'Текст' : (sel.media ? 'Фото / видео' : 'Выбрано'));
    $('#gText').hidden = !sel.leaf; has = has || !!sel.leaf;
    $('#aEdit').hidden = !!editing; $('#aDone').hidden = !editing;

    var linkOk = sel.link && /^(https?:|tel:|mailto:)/i.test(sel.link.getAttribute('href') || '');
    $('#gLink').hidden = !linkOk;
    if (linkOk) { $('#aLink').value = sel.link.getAttribute('href'); has = true; }

    var rev = sel.item && sel.item.el.matches('.review');
    $('#gGroup').hidden = !rev;
    if (rev) { $('#aGroup').value = sel.item.el.getAttribute('data-group') || 'Свадьбы'; has = true; }

    var m = sel.media;
    var isVid = !!m && (m.hasAttribute('data-video') || m.tagName === 'VIDEO');
    $('#gImg').hidden = !m || isVid;
    $('#gVideo').hidden = !isVid;
    has = has || !!m;

    $('#gItem').hidden = !sel.item;
    if (sel.item) {
      has = true;
      $('#nItem').textContent = 'Весь блок «' + sel.item.name + '»:';
      var sib = siblings(sel.item.el);
      $('#aUp').disabled = sib.indexOf(sel.item.el) <= 0;
      $('#aDown').disabled = sib.indexOf(sel.item.el) >= sib.length - 1;
      $('#aDel').disabled = sib.length <= 1;
    }
    var start = sel.item ? sel.item.el.parentElement : (sel.leaf || sel.target);
    $('#aParent').hidden = !(start && itemOf(start));
    $('#nNothing').hidden = has;
  };

  var siblings = function (el) {
    var it = itemOf(el);
    return Array.prototype.filter.call(el.parentElement.children, function (c) { var o = itemOf(c); return o && it && o.el === c && o.name === it.name; });
  };

  /* ---------- Правка текста ---------- */
  var sanitize = function (el) {
    var clean = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) return;
        if (c.nodeType !== 1) { c.remove(); return; }
        var tag = c.tagName;
        if (INLINE[tag]) {
          var keep = {};
          if (tag === 'SPAN') ['class', 'data-from', 'data-to'].forEach(function (a) { if (c.hasAttribute(a)) keep[a] = c.getAttribute(a); });
          Array.prototype.slice.call(c.attributes).forEach(function (a) { c.removeAttribute(a.name); });
          Object.keys(keep).forEach(function (a) { c.setAttribute(a, keep[a]); });
          if (c.classList) c.classList.remove('ed-sel', 'ed-item', 'ed-hover');
          if (c.getAttribute('class') === '') c.removeAttribute('class');
          clean(c);
          if (tag === 'SPAN' && !c.attributes.length) { while (c.firstChild) c.parentNode.insertBefore(c.firstChild, c); c.remove(); }
          else if (tag !== 'BR' && !c.textContent) c.remove();
          return;
        }
        // Всё остальное (div, font и т. п. от браузера) превращаем в обычный текст с переносом
        clean(c);
        if ((tag === 'DIV' || tag === 'P') && c.previousSibling) c.parentNode.insertBefore(doc.createElement('br'), c);
        while (c.firstChild) c.parentNode.insertBefore(c.firstChild, c);
        c.remove();
      });
    };
    clean(el);
    while (el.lastChild && el.lastChild.nodeName === 'BR') el.lastChild.remove();
  };

  var onKey = function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (BLOCKISH[editing.tagName] && !e.shiftKey) doc.execCommand('insertLineBreak');
      else if (e.shiftKey) doc.execCommand('insertLineBreak');
      else finishEdit(true);
    }
    if (e.key === 'Escape') finishEdit(true);
  };
  var onPaste = function (e) {
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain');
    doc.execCommand('insertText', false, t.replace(/\s*\n\s*/g, ' '));
  };
  var editBefore = '';
  var startEdit = function () {
    var el = sel.leaf;
    if (!el || editing === el) return;
    finishEdit();
    editing = el;
    editBefore = el.innerHTML;
    el.classList.remove('ed-sel');
    if (!el.className) el.removeAttribute('class');
    el.setAttribute('contenteditable', 'true');
    el.addEventListener('keydown', onKey);
    el.addEventListener('paste', onPaste);
    el.focus();
    var r = doc.createRange(); r.selectNodeContents(el); r.collapse(false);
    var s = doc.getSelection(); s.removeAllRanges(); s.addRange(r);
    renderPanel();
  };
  var finishEdit = function (reselect) {
    if (!editing) return;
    var el = editing;
    editing = null;
    el.removeAttribute('contenteditable');
    el.removeEventListener('keydown', onKey);
    el.removeEventListener('paste', onPaste);
    sanitize(el);
    if (!el.textContent.trim()) { el.innerHTML = editBefore; toast('Пустой текст не сохранить. Чтобы убрать пункт, выделите его и нажмите «Удалить»', 'err'); }
    if (el.innerHTML !== editBefore) touchPage();
    if (reselect) { el.classList.add('ed-sel'); renderPanel(); }
  };

  /* ---------- Фото ---------- */
  var setPhoto = function (img, res) {
    var old = img.getAttribute('src');
    img.setAttribute('src', res.path);
    img.removeAttribute('srcset');
    if (img.hasAttribute('width')) { img.setAttribute('width', res.w); img.setAttribute('height', res.h); }
    var holder = img.closest('[data-photo]');
    if (holder && (holder.getAttribute('data-photo') === old || holder.contains(img))) holder.setAttribute('data-photo', res.path);
    var box = img.closest('.atmo__item, .about__doc');
    if (box) { box.style.aspectRatio = res.w + '/' + res.h; if (box.matches('.atmo__item')) box.classList.add('atmo__item--fit'); }
    var rev = img.closest('.review--shot');
    if (rev) { rev.setAttribute('data-w', res.w); rev.setAttribute('data-h', res.h); }
    $$('link[rel="preload"][as="image"]', doc).forEach(function (l) { if (l.getAttribute('href') === old) l.setAttribute('href', res.path); });
    touchPage();
  };

  /* ---------- Видео на странице ---------- */
  var videoSrc = function (m) { return m.hasAttribute('data-video') ? m.getAttribute('data-video') : m.getAttribute('src'); };
  var setPoster = function (m, path) {
    var v = m.tagName === 'VIDEO' ? m : $('video', m);
    if (v) v.setAttribute('poster', path);
    else if ($('img', m)) $('img', m).setAttribute('src', path);
    touchPage();
  };
  var setVideo = function (m, up) {
    if (m.hasAttribute('data-video')) {
      m.setAttribute('data-video', up.path);
      var v = $('video', m);
      if (v) { v.removeAttribute('data-src'); v.removeAttribute('src'); }
      if (m.hasAttribute('data-portrait') || m.matches('.reel')) {
        if (up.meta.w > up.meta.h) m.removeAttribute('data-portrait'); else if (m.matches('.review')) m.setAttribute('data-portrait', '');
      }
      var dur = $('.reel__cap small', m);
      if (dur && up.meta.d) { var s = Math.round(up.meta.d); dur.textContent = Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
    } else {
      m.setAttribute('src', up.path);
    }
    touchPage();
  };

  /* ---------- Подготовка страницы для окна правок ---------- */
  var toEditor = function (src) {
    return src
      .replace(/<script\s+src="(js\/[^"]+)"><\/script>/g, '<script type="text/x-off" data-off-src="$1"></script>')
      .replace(/<head>/i, '<head><base href="' + SITE_URL + '" data-ed="1">')
      .replace(/<\/head>/i, '<link rel="stylesheet" href="' + SITE_URL + 'admin/editor.css?v=1" data-ed="1"></head>');
  };

  var serialize = function () {
    finishEdit();
    var root = doc.documentElement.cloneNode(true);
    $$('[data-ed]', root).forEach(function (e) { e.remove(); });
    $$('[contenteditable]', root).forEach(function (e) { e.removeAttribute('contenteditable'); });
    $$('.ed-sel, .ed-item, .ed-hover', root).forEach(function (e) { e.classList.remove('ed-sel', 'ed-item', 'ed-hover'); });
    $$('[class=""]', root).forEach(function (e) { e.removeAttribute('class'); });
    $$('[style=""]', root).forEach(function (e) { e.removeAttribute('style'); });
    $$('details[open]', root).forEach(function (d) { d.removeAttribute('open'); });
    // Счётчики: если вписали число, анимация досчитает до него; если не число, просто текст
    $$('.js-count', root).forEach(function (c) {
      var t = c.textContent.trim();
      if (/^\d+$/.test(t)) { c.setAttribute('data-to', t); if (+c.getAttribute('data-from') > +t) c.setAttribute('data-from', '0'); }
      else c.replaceWith(root.ownerDocument.createTextNode(c.textContent));
    });
    // Кнопка тарифа передаёт в заявку его название
    $$('.price', root).forEach(function (p) {
      var h = $('h3', p), b = $('[data-tariff]', p);
      if (h && b) b.setAttribute('data-tariff', h.textContent.trim());
    });
    // Подписи к отзывам для поисковиков и незрячих
    $$('.review--shot', root).forEach(function (r) {
      var img = $('img', r), cap = $('small', r);
      if (img && cap) img.setAttribute('alt', 'Отзыв: ' + cap.textContent.trim());
    });
    var html = '<!DOCTYPE html>\n' + root.outerHTML + '\n';
    return html.replace(/<script type="text\/x-off" data-off-src="([^"]+)"><\/script>/g, '<script src="$1"></script>');
  };

  var buildEditor = function (src) {
    var frame = $('#frame');
    var y = doc ? (doc.scrollingElement || doc.documentElement).scrollTop : 0;
    deselect();
    frame.onload = function () {
      doc = frame.contentDocument;
      (doc.scrollingElement || doc.documentElement).scrollTop = y;
      wireFrame();
    };
    frame.srcdoc = toEditor(src);
  };

  var wireFrame = function () {
    var hoverEl = null;
    doc.addEventListener('mouseover', function (e) {
      if (editing) return;
      if (hoverEl) { hoverEl.classList.remove('ed-hover'); if (!hoverEl.className) hoverEl.removeAttribute('class'); }
      hoverEl = leafOf(e.target) || mediaOf(e.target, itemOf(e.target));
      if (hoverEl && hoverEl.classList) hoverEl.classList.add('ed-hover');
    });
    doc.addEventListener('click', function (e) {
      if (editing && editing.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      var t = e.target.nodeType === 1 ? e.target : e.target.parentElement;
      if (t.closest('svg') && t.tagName !== 'svg') t = t.closest('svg');
      if (t.tagName === 'svg' || t.tagName === 'use') t = t.parentElement;
      var leaf = leafOf(t);
      if (leaf && sel.leaf === leaf && !editing) { startEdit(); return; }
      select(t);
    }, true);
    // Отключаем отправку форм и открытие <details> по клику: правим, а не пользуемся
    doc.addEventListener('submit', function (e) { e.preventDefault(); }, true);
    $$('details', doc).forEach(function (d) { d.open = true; });
  };

  /* ---------- Кнопки панели ---------- */
  $('#aEdit').onclick = startEdit;
  $('#aDone').onclick = function () { finishEdit(true); };
  $('#pClose').onclick = deselect;
  $('#aParent').onclick = function () {
    var start = sel.item ? sel.item.el.parentElement : (sel.leaf || sel.target);
    var up = itemOf(start);
    if (up) select(up.el, up);
  };
  $('#aLink').onchange = function () {
    var v = this.value.trim();
    if (!/^(https?:\/\/|tel:|mailto:)/i.test(v)) { toast('Ссылка должна начинаться с https://', 'err'); this.value = sel.link.getAttribute('href'); return; }
    sel.link.setAttribute('href', v); touchPage();
  };
  $('#aGroup').onchange = function () { sel.item.el.setAttribute('data-group', this.value); touchPage(); };
  $('#aImg').onclick = function () {
    var img = sel.media;
    var big = img.closest('.hero__bg') ? 2400 : (img.closest('.review') ? 1000 : 1800);
    chooseImage('photo', big).then(function (res) { setPhoto(img, res); toast('Фото заменено. Не забудьте сохранить'); }).catch(report);
  };
  $('#aVideo').onclick = function () {
    var m = sel.media;
    chooseVideo().then(function (up) {
      setVideo(m, up);
      toast('Видео загружено. Теперь выберите кадр для обложки');
      return pickFrame(up.url).then(function (res) { setPoster(m, res.path); toast('Готово. Не забудьте сохранить'); });
    }).catch(report);
  };
  $('#aFrame').onclick = function () {
    var m = sel.media;
    pickFrame('../' + videoSrc(m)).then(function (res) { setPoster(m, res.path); toast('Обложка заменена. Не забудьте сохранить'); }).catch(report);
  };
  $('#aPoster').onclick = function () {
    var m = sel.media;
    chooseImage('cover', 1600).then(function (res) { setPoster(m, res.path); toast('Обложка заменена. Не забудьте сохранить'); }).catch(report);
  };
  $('#aWatch').onclick = function () { window.open('../' + videoSrc(sel.media), '_blank'); };
  $('#aUp').onclick = function () {
    var el = sel.item.el, sib = siblings(el), i = sib.indexOf(el);
    if (i > 0) { sib[i - 1].before(el); touchPage(); select(el, sel.item); el.scrollIntoView({ block: 'nearest' }); }
  };
  $('#aDown').onclick = function () {
    var el = sel.item.el, sib = siblings(el), i = sib.indexOf(el);
    if (i < sib.length - 1) { sib[i + 1].after(el); touchPage(); select(el, sel.item); el.scrollIntoView({ block: 'nearest' }); }
  };
  $('#aCopy').onclick = function () {
    var el = sel.item.el, c = el.cloneNode(true);
    c.classList.remove('ed-item', 'ed-sel');
    $$('.ed-sel, .ed-item', c).forEach(function (e) { e.classList.remove('ed-sel', 'ed-item'); });
    el.after(c);
    touchPage();
    select(c, { el: c, name: sel.item.name });
    c.scrollIntoView({ block: 'nearest' });
    toast('Копия добавлена следом. Измените в ней текст или фото');
  };
  $('#aDel').onclick = function () {
    var el = sel.item.el;
    if (!confirm('Удалить «' + sel.item.name + '»?')) return;
    deselect(); el.remove(); touchPage();
    toast('Удалено. Если передумали, нажмите «Отменить» вверху');
  };

  $('#hintClose').onclick = function () { $('#pageHint').hidden = true; try { localStorage.setItem('ed-hint', '1'); } catch (e) {} };
  try { if (localStorage.getItem('ed-hint')) $('#pageHint').hidden = true; } catch (e) {}
  $$('#viewSwitch button').forEach(function (b) {
    b.onclick = function () {
      $$('#viewSwitch button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      $('#stage').classList.toggle('is-phone', b.dataset.view === 'phone');
    };
  });

  /* ==========================================================
     Видео в форматах
     ========================================================== */
  var loadFormats = function () {
    return fetch('../js/formats.js?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (txt) {
      var w = {};
      new Function('window', txt)(w);
      formats = w.FORMATS || {};
      formatsSaved = JSON.stringify(formats);
      renderFormats();
    });
  };

  var h = function (tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  };

  var renderFormats = function () {
    var box = $('#fmtList');
    box.textContent = '';
    Object.keys(formats).forEach(function (cat) {
      var list = formats[cat];
      var items = h('div', { class: 'fmt-items' });
      list.forEach(function (it, i) {
        var change = function () { refreshDirty(); };
        var move = function (d) { return function () { var j = i + d; if (j < 0 || j >= list.length) return; list.splice(j, 0, list.splice(i, 1)[0]); renderFormats(); refreshDirty(); }; };
        var title = h('input', { type: 'text', value: it.title || '', 'aria-label': 'Название видео' });
        title.oninput = function () { it.title = title.value; change(); };
        var vert = h('input', { type: 'checkbox' }); vert.checked = it.vertical === false;
        vert.onchange = function () { it.vertical = !vert.checked; change(); };
        var whole = h('input', { type: 'checkbox' }); whole.checked = it.fit === 'whole';
        whole.onchange = function () { if (whole.checked) it.fit = 'whole'; else delete it.fit; change(); };
        items.appendChild(h('div', { class: 'fmt-it' }, [
          h('div', { class: 'fmt-it__thumb' }, [it.poster ? h('img', { src: '../' + it.poster, alt: '' }) : null]),
          h('div', { class: 'fmt-it__main' }, [
            h('label', { class: 'f' }, [h('span', { text: (i + 1) + '. Название' }), title]),
            h('div', { class: 'fmt-it__opts' }, [
              h('label', {}, [vert, document.createTextNode('Снято горизонтально')]),
              h('label', {}, [whole, document.createTextNode('Показывать кадр целиком')])
            ]),
            h('div', { class: 'row' }, [
              h('button', { type: 'button', class: 'btn', text: '↑', title: 'Выше', onclick: move(-1) }),
              h('button', { type: 'button', class: 'btn', text: '↓', title: 'Ниже', onclick: move(1) }),
              h('button', { type: 'button', class: 'btn', text: 'Обложка из видео', onclick: function () {
                pickFrame('../' + it.video).then(function (res) { it.poster = res.path; renderFormats(); refreshDirty(); }).catch(report);
              } }),
              h('button', { type: 'button', class: 'btn', text: 'Обложка: фото', onclick: function () {
                chooseImage('cover', 1600).then(function (res) { it.poster = res.path; renderFormats(); refreshDirty(); }).catch(report);
              } }),
              h('button', { type: 'button', class: 'btn', text: 'Заменить видео', onclick: function () {
                chooseVideo().then(function (up) {
                  it.video = up.path; it.vertical = up.meta.h >= up.meta.w;
                  return pickFrame(up.url).then(function (res) { it.poster = res.path; });
                }).then(function () { renderFormats(); refreshDirty(); }, function (e) { renderFormats(); refreshDirty(); report(e); });
              } }),
              h('button', { type: 'button', class: 'btn btn--ghost', text: 'Смотреть', onclick: function () { window.open('../' + it.video, '_blank'); } }),
              h('button', { type: 'button', class: 'btn btn--danger', text: 'Удалить', onclick: function () {
                if (!confirm('Удалить видео «' + (it.title || '') + '» из раздела «' + cat + '»?')) return;
                list.splice(i, 1); renderFormats(); refreshDirty();
              } })
            ])
          ])
        ]));
      });
      var add = h('button', { type: 'button', class: 'btn btn--gold btn--sm', text: '+ Добавить видео', onclick: function () {
        chooseVideo().then(function (up) {
          var it = { title: 'Новое видео', video: up.path, vertical: up.meta.h >= up.meta.w };
          list.push(it);
          renderFormats(); refreshDirty();
          toast('Видео загружено. Выберите кадр для обложки');
          return pickFrame(up.url).then(function (res) { it.poster = res.path; renderFormats(); refreshDirty(); });
        }).catch(report);
      } });
      box.appendChild(h('div', { class: 'fmt-cat card' }, [h('h3', {}, [document.createTextNode(cat), add]), items]));
    });
  };

  /* ==========================================================
     Сохранение, отмена, версии
     ========================================================== */
  var renderBackups = function (list) {
    var ul = $('#backups');
    ul.textContent = '';
    if (!list || !list.length) { ul.appendChild(h('li', { text: 'Пока нет сохранённых версий' })); return; }
    list.forEach(function (b, i) {
      ul.appendChild(h('li', {}, [
        h('span', { text: 'Версия до сохранения ' + b.date + (i === 0 ? ' (последняя)' : '') }),
        h('button', { type: 'button', class: 'btn btn--sm', text: 'Вернуть', onclick: function () {
          if (!confirm('Вернуть сайт к версии от ' + b.date + '? Текущая версия тоже сохранится в списке.')) return;
          var fd = new FormData(); fd.append('id', b.id);
          busy('Возвращаю версию…');
          api('restore', fd).then(function (res) {
            busy(false);
            if (!res.ok) { toast(res.error, 'err'); return; }
            pageSrc = res.page; dirtyPage = false;
            buildEditor(pageSrc); renderBackups(res.backups);
            loadFormats().then(refreshDirty);
            toast('Версия от ' + b.date + ' возвращена');
          });
        } })
      ]));
    });
  };

  $('#save').onclick = function () {
    var body = {};
    if (dirtyPage) body.page = serialize();
    if (JSON.stringify(formats) !== formatsSaved) body.formats = formats;
    busy('Сохраняю…');
    api('save', body, true).then(function (res) {
      busy(false);
      if (!res.ok) { toast(res.error || 'Не удалось сохранить', 'err'); return; }
      pageSrc = res.page;
      dirtyPage = false;
      if (body.formats) formatsSaved = JSON.stringify(formats);
      buildEditor(pageSrc);
      renderBackups(res.backups);
      refreshDirty();
      toast('Сохранено! Изменения уже на сайте');
    });
  };

  $('#discard').onclick = function () {
    if (!confirm('Отменить все несохранённые изменения?')) return;
    dirtyPage = false;
    buildEditor(pageSrc);
    formats = JSON.parse(formatsSaved);
    renderFormats();
    refreshDirty();
  };

  $$('.tab').forEach(function (t) {
    t.onclick = function () {
      finishEdit();
      $$('.tab').forEach(function (x) { x.classList.toggle('is-on', x === t); });
      $$('.pane').forEach(function (p) { p.classList.toggle('is-on', p.dataset.pane === t.dataset.tab); });
      if (t.dataset.tab === 'leads') loadLeads();
    };
  });

  /* ---------- Заявки ---------- */
  var LEAD_FIELDS = [['name', 'Имя'], ['phone', 'Телефон'], ['telegram', 'Telegram'], ['contact', 'Связь'], ['event', 'Праздник'], ['date', 'Дата'], ['tariff', 'Тариф'], ['topic', 'Тема'], ['guests', 'Гостей'], ['message', 'Комментарий']];
  var loadLeads = function () {
    var box = $('#leadList');
    box.textContent = 'Загружаю…';
    api('leads').then(function (res) {
      box.textContent = '';
      if (!res.ok) { box.textContent = res.error || 'Не удалось загрузить заявки'; return; }
      if (!res.leads.length) { box.appendChild(h('p', { class: 'note', text: 'Пока заявок нет.' })); return; }
      res.leads.forEach(function (l) {
        var dl = h('dl');
        LEAD_FIELDS.forEach(function (f) {
          if (!l[f[0]]) return;
          var v = f[0] === 'telegram' ? '@' + l[f[0]] : (f[0] === 'date' ? new Date(l.date).toLocaleDateString('ru-RU') : l[f[0]]);
          dl.appendChild(h('dt', { text: f[1] }));
          dl.appendChild(h('dd', { text: v }));
        });
        box.appendChild(h('div', { class: 'lead' }, [
          h('div', { class: 'lead__head' }, [
            h('span', { class: 'lead__time', text: new Date(l.time).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }) }),
            h('button', { type: 'button', class: 'btn btn--sm btn--danger', text: 'Удалить', onclick: function () {
              if (!confirm('Удалить заявку ' + (l.name || '') + '?')) return;
              var fd = new FormData();
              fd.append('id', l._id);
              api('lead_delete', fd).then(function (r) { if (r.ok) { toast('Заявка удалена'); loadLeads(); } else toast(r.error, 'err'); });
            } })
          ]),
          dl
        ]));
      });
    });
  };

  $('#passForm').onsubmit = function (e) {
    e.preventDefault();
    api('password', new FormData(this)).then(function (res) {
      if (res.ok) { toast('Пароль изменён'); e.target.reset(); } else toast(res.error, 'err');
    });
  };
  $('#logout').onclick = function () {
    if (refreshDirty() && !confirm('Есть несохранённые изменения. Всё равно выйти?')) return;
    api('logout').then(function () { dirtyPage = false; formatsSaved = JSON.stringify(formats); location.reload(); });
  };

  /* ---------- Вход ---------- */
  var startApp = function () {
    $('#login').hidden = true;
    $('#app').hidden = false;
    busy('Открываю сайт…');
    return api('load').then(function (res) {
      busy(false);
      if (!res.ok) { toast(res.error, 'err'); if (res.error === 'Нужно войти заново') showLogin(); return; }
      pageSrc = res.page;
      renderBackups(res.backups);
      buildEditor(pageSrc);
      return loadFormats();
    }).then(refreshDirty).catch(function (e) { busy(false); report(e); });
  };
  var showLogin = function () { $('#app').hidden = true; $('#login').hidden = false; $('#password').focus(); };

  $('#loginForm').onsubmit = function (e) {
    e.preventDefault();
    $('#loginErr').textContent = '';
    api('login', new FormData(this)).then(function (res) {
      if (res.ok) startApp(); else $('#loginErr').textContent = res.error || 'Не удалось войти';
    });
  };

  api('me').then(function (res) { if (res.ok && res.auth) startApp(); else showLogin(); });
})();
