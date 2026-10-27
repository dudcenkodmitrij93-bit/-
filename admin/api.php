<?php
/**
 * Серверная часть страницы правок /admin.
 * Хранит содержимое сайта в content/content.json, делает резервные копии
 * перед каждым сохранением и принимает загрузку фото.
 */
declare(strict_types=1);

require __DIR__ . '/config.php';

session_name('egadmin');
session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Strict',
    'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$ROOT     = dirname(__DIR__);
$CONTENT  = $ROOT . '/content/content.json';
$BACKUPS  = $ROOT . '/content/backups';
$PASSFILE = $ROOT . '/content/.pass';
$UPLOADS  = $ROOT . '/img/uploads';
const KEEP_BACKUPS = 30;

function out(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Все изменения только POST и только со своей страницы (заголовок не подделать с чужого сайта)
if ($method !== 'POST' && $action !== 'me') out(['ok' => false, 'error' => 'Метод не поддерживается'], 405);
if ($method === 'POST' && ($_SERVER['HTTP_X_ADMIN'] ?? '') !== '1') out(['ok' => false, 'error' => 'Неверный запрос'], 400);

/* ---------- Вход ---------- */
if ($action === 'me') out(['ok' => true, 'auth' => !empty($_SESSION['admin'])]);

if ($action === 'login') {
    $lock  = sys_get_temp_dir() . '/egadmin_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
    $fails = is_file($lock) ? (int)file_get_contents($lock) : 0;
    if ($fails >= 5 && time() - filemtime($lock) < 600) {
        out(['ok' => false, 'error' => 'Слишком много попыток. Подождите 10 минут'], 429);
    }
    if ($fails >= 5) $fails = 0;

    $pass = (string)($_POST['password'] ?? '');
    if (is_file($PASSFILE)) {
        $ok = password_verify($pass, trim((string)file_get_contents($PASSFILE)));
    } else {
        $ok = ADMIN_PASSWORD !== '' && ADMIN_PASSWORD !== 'ПОМЕНЯЙТЕ-ПАРОЛЬ' && hash_equals(ADMIN_PASSWORD, $pass);
    }
    if (!$ok) {
        file_put_contents($lock, (string)($fails + 1));
        usleep(400000);
        out(['ok' => false, 'error' => 'Неверный пароль'], 401);
    }
    @unlink($lock);
    session_regenerate_id(true);
    $_SESSION['admin'] = true;
    out(['ok' => true]);
}

if (empty($_SESSION['admin'])) out(['ok' => false, 'error' => 'Нужно войти заново'], 401);

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);
}

/* ---------- Проверка содержимого перед сохранением ---------- */
function clean_text($v, int $max = 2000): string {
    $v = is_string($v) ? $v : '';
    $v = str_replace("\r\n", "\n", $v);
    $v = strip_tags($v);
    return mb_substr(trim($v), 0, $max);
}
function clean_list($v, int $maxItems = 20, int $max = 300): array {
    if (!is_array($v)) return [];
    $out = [];
    foreach ($v as $item) {
        $t = clean_text($item, $max);
        if ($t !== '') $out[] = $t;
        if (count($out) >= $maxItems) break;
    }
    return $out;
}
function clean_img($v, string $fallback): string {
    return (is_string($v) && preg_match('~^img/[\w\-/]+\.(jpe?g|png|webp)$~i', $v) && strpos($v, '..') === false) ? $v : $fallback;
}
function clean_url($v): string {
    return (is_string($v) && preg_match('~^(https?://|tel:|mailto:)~i', $v)) ? mb_substr(trim($v), 0, 300) : '';
}

function validate(array $in, array $old): array {
    $c = [];
    $h = $in['hero'] ?? [];
    $c['hero'] = [
        'eyebrow'   => clean_text($h['eyebrow'] ?? '', 120),
        'title'     => clean_text($h['title'] ?? '', 120),
        'titleGold' => clean_text($h['titleGold'] ?? '', 120),
        'text'      => clean_text($h['text'] ?? '', 400),
        'photo'     => clean_img($h['photo'] ?? '', $old['hero']['photo'] ?? 'img/hero.jpg'),
    ];
    if ($c['hero']['title'] === '') throw new RuntimeException('Заголовок первого экрана не может быть пустым');

    foreach (['facts' => ['num', 'text'], 'takes' => ['title', 'text'], 'fears' => ['q', 'a']] as $key => $fields) {
        $c[$key] = [];
        foreach (($in[$key] ?? []) as $item) {
            $row = [];
            foreach ($fields as $f) $row[$f] = clean_text($item[$f] ?? '', 500);
            $c[$key][] = $row;
        }
    }

    $c['about'] = ['bio' => clean_text($in['about']['bio'] ?? '', 4000)];

    $c['scenarios'] = [];
    foreach (($in['scenarios'] ?? []) as $s) {
        $c['scenarios'][] = [
            'meta'  => clean_text($s['meta'] ?? '', 100),
            'title' => clean_text($s['title'] ?? '', 100),
            'steps' => clean_list($s['steps'] ?? [], 10, 160),
        ];
    }

    $c['prices'] = [];
    foreach (($in['prices'] ?? []) as $i => $p) {
        $row = [
            'name'     => clean_text($p['name'] ?? '', 60),
            'costs'    => clean_list($p['costs'] ?? [], 4, 80),
            'features' => clean_list($p['features'] ?? [], 12, 160),
        ];
        if ($row['name'] === '') throw new RuntimeException('У тарифа №' . ($i + 1) . ' пустое название');
        if (!$row['costs']) throw new RuntimeException('У тарифа «' . $row['name'] . '» не указана цена');
        $c['prices'][] = $row;
    }
    $c['pricesNote'] = clean_text($in['pricesNote'] ?? '', 400);

    $c['faq'] = [];
    foreach (($in['faq'] ?? []) as $f) {
        $q = clean_text($f['q'] ?? '', 200);
        $a = clean_text($f['a'] ?? '', 1500);
        if ($q !== '') $c['faq'][] = ['q' => $q, 'a' => $a];
        if (count($c['faq']) >= 20) break;
    }

    $c['photos'] = [];
    foreach (['atmosphere', 'moment1', 'moment2', 'moment3', 'moment4'] as $k) {
        $c['photos'][$k] = clean_img($in['photos'][$k] ?? '', $old['photos'][$k] ?? '');
    }

    $c['socials'] = [];
    foreach (['telegram', 'vk', 'youtube', 'instagram'] as $k) {
        $c['socials'][$k] = clean_url($in['socials'][$k] ?? '');
    }
    return $c;
}

function write_atomic(string $file, string $data): void {
    $tmp = $file . '.tmp';
    if (file_put_contents($tmp, $data, LOCK_EX) === false || !rename($tmp, $file)) {
        throw new RuntimeException('Не удалось записать файл. Проверьте права на папку content');
    }
}

function backup(string $content, string $dir): void {
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    copy($content, $dir . '/content-' . date('Y-m-d_H-i-s') . '-' . substr(uniqid(), -4) . '.json');
    $all = glob($dir . '/content-*.json') ?: [];
    sort($all);
    while (count($all) > KEEP_BACKUPS) @unlink(array_shift($all));
}

/* ---------- Сохранение ---------- */
if ($action === 'save') {
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 300000) out(['ok' => false, 'error' => 'Слишком большой объём данных'], 413);
    $in = json_decode($raw, true);
    if (!is_array($in)) out(['ok' => false, 'error' => 'Неверные данные'], 400);
    $old = json_decode((string)@file_get_contents($CONTENT), true) ?: [];
    try {
        $clean = validate($in, $old);
        backup($CONTENT, $BACKUPS);
        write_atomic($CONTENT, json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    } catch (RuntimeException $e) {
        out(['ok' => false, 'error' => $e->getMessage()], 422);
    }
    out(['ok' => true, 'content' => $clean, 'backups' => count(glob($BACKUPS . '/content-*.json') ?: [])]);
}

/* ---------- Вернуть как было (последняя копия) ---------- */
if ($action === 'undo') {
    $all = glob($BACKUPS . '/content-*.json') ?: [];
    sort($all);
    $last = array_pop($all);
    if (!$last) out(['ok' => false, 'error' => 'Сохранённых копий пока нет'], 404);
    $data = (string)file_get_contents($last);
    if (!is_array(json_decode($data, true))) out(['ok' => false, 'error' => 'Копия повреждена'], 500);
    try { write_atomic($CONTENT, $data); } catch (RuntimeException $e) { out(['ok' => false, 'error' => $e->getMessage()], 500); }
    @unlink($last);
    out(['ok' => true, 'content' => json_decode($data, true), 'backups' => count($all)]);
}

if ($action === 'info') {
    out(['ok' => true, 'backups' => count(glob($BACKUPS . '/content-*.json') ?: [])]);
}

/* ---------- Загрузка фото ---------- */
if ($action === 'upload') {
    $f = $_FILES['file'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK) out(['ok' => false, 'error' => 'Файл не загрузился. Попробуйте фото меньше 15 МБ'], 400);
    if ($f['size'] > 15 * 1024 * 1024) out(['ok' => false, 'error' => 'Фото больше 15 МБ'], 413);
    $info = @getimagesize($f['tmp_name']);
    $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($types[$info[2]])) out(['ok' => false, 'error' => 'Подходят только фото JPG, PNG или WEBP'], 415);

    if (!is_dir($UPLOADS)) mkdir($UPLOADS, 0755, true);
    $slot = preg_replace('~[^a-z0-9\-]~', '', strtolower((string)($_POST['slot'] ?? 'photo'))) ?: 'photo';
    $name = $slot . '-' . date('Ymd-His');

    // Уменьшаем большие фото, чтобы сайт грузился быстро
    if (function_exists('imagecreatefromstring')) {
        $src = @imagecreatefromstring((string)file_get_contents($f['tmp_name']));
        if ($src) {
            [$w, $h] = [imagesx($src), imagesy($src)];
            $max = 1800;
            $k = min(1, $max / max($w, $h));
            $dst = imagecreatetruecolor((int)round($w * $k), (int)round($h * $k));
            imagecopyresampled($dst, $src, 0, 0, 0, 0, imagesx($dst), imagesy($dst), $w, $h);
            $path = 'img/uploads/' . $name . '.jpg';
            imagejpeg($dst, $ROOT . '/' . $path, 84);
            imagedestroy($src);
            imagedestroy($dst);
            out(['ok' => true, 'path' => $path]);
        }
    }
    $path = 'img/uploads/' . $name . '.' . $types[$info[2]];
    if (!move_uploaded_file($f['tmp_name'], $ROOT . '/' . $path)) out(['ok' => false, 'error' => 'Не удалось сохранить фото'], 500);
    out(['ok' => true, 'path' => $path]);
}

/* ---------- Смена пароля ---------- */
if ($action === 'password') {
    $new = (string)($_POST['new'] ?? '');
    if (mb_strlen($new) < 8) out(['ok' => false, 'error' => 'Пароль должен быть не короче 8 символов'], 422);
    if (file_put_contents($PASSFILE, password_hash($new, PASSWORD_DEFAULT), LOCK_EX) === false) {
        out(['ok' => false, 'error' => 'Не удалось сохранить пароль'], 500);
    }
    @chmod($PASSFILE, 0600);
    out(['ok' => true]);
}

out(['ok' => false, 'error' => 'Неизвестное действие'], 404);
