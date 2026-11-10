<?php
/**
 * Серверная часть панели правок /admin.
 *
 * Панель правит сами файлы сайта: index.html и js/formats.js.
 * Перед каждым сохранением старые версии кладутся в content/backups,
 * к любой из них можно вернуться из панели.
 * Новые фото и видео сохраняются в img/uploads и video/uploads.
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
$PAGE     = $ROOT . '/index.html';
$FORMATS  = $ROOT . '/js/formats.js';
$DATA     = $ROOT . '/content';
$BACKUPS  = $DATA . '/backups';
$TMP      = $DATA . '/tmp';
$PASSFILE = $DATA . '/.pass';
const KEEP_BACKUPS = 40;
const MAX_VIDEO = 400 * 1024 * 1024;
const MAX_IMAGE = 25 * 1024 * 1024;

function out(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $msg, int $code = 400): void { out(['ok' => false, 'error' => $msg], $code); }

function ensure_data_dir(string $dir): void {
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $ht = dirname($dir) === dirname(__DIR__) ? $dir . '/.htaccess' : null;
    if ($ht && !is_file($ht)) @file_put_contents($ht, "Require all denied\n");
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Всё, кроме проверки входа, только POST и только со своей страницы
if ($method !== 'POST' && $action !== 'me') fail('Метод не поддерживается', 405);
if ($method === 'POST' && ($_SERVER['HTTP_X_ADMIN'] ?? '') !== '1') fail('Неверный запрос');

ensure_data_dir($DATA);

/* ---------- Вход ---------- */
if ($action === 'me') out(['ok' => true, 'auth' => !empty($_SESSION['admin'])]);

if ($action === 'login') {
    $lock  = $DATA . '/.lock_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
    $fails = is_file($lock) ? (int)file_get_contents($lock) : 0;
    if ($fails >= 5 && time() - filemtime($lock) < 900) fail('Слишком много попыток. Подождите 15 минут', 429);
    if ($fails >= 5) $fails = 0;

    $pass = (string)($_POST['password'] ?? '');
    $hash = is_file($PASSFILE) ? trim((string)file_get_contents($PASSFILE)) : ADMIN_PASSWORD_HASH;
    if ($hash === '' || !password_verify($pass, $hash)) {
        @file_put_contents($lock, (string)($fails + 1));
        usleep(500000);
        fail('Неверный пароль', 401);
    }
    @unlink($lock);
    session_regenerate_id(true);
    $_SESSION['admin'] = true;
    out(['ok' => true]);
}

if (empty($_SESSION['admin'])) fail('Нужно войти заново', 401);

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);
}

if ($action === 'password') {
    $new = (string)($_POST['new'] ?? '');
    if (mb_strlen($new) < 8) fail('Пароль должен быть не короче 8 символов', 422);
    if (@file_put_contents($PASSFILE, password_hash($new, PASSWORD_DEFAULT), LOCK_EX) === false) fail('Не удалось сохранить пароль', 500);
    @chmod($PASSFILE, 0600);
    out(['ok' => true]);
}

/* ---------- Резервные копии ---------- */
function list_backups(string $dir): array {
    $all = glob($dir . '/*', GLOB_ONLYDIR) ?: [];
    rsort($all);
    $res = [];
    foreach ($all as $d) {
        $id = basename($d);
        if (!preg_match('~^\d{8}-\d{6}-[a-z0-9]{4}$~', $id)) continue;
        $t = DateTime::createFromFormat('Ymd-His', substr($id, 0, 15));
        $res[] = ['id' => $id, 'date' => $t ? $t->format('d.m.Y H:i') : $id];
    }
    return $res;
}
function make_backup(string $dir, array $files): void {
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $d = $dir . '/' . date('Ymd-His') . '-' . substr(bin2hex(random_bytes(2)), 0, 4);
    @mkdir($d, 0755, true);
    foreach ($files as $name => $path) if (is_file($path)) copy($path, $d . '/' . $name);
    $all = glob($dir . '/*', GLOB_ONLYDIR) ?: [];
    sort($all);
    while (count($all) > KEEP_BACKUPS) {
        $old = array_shift($all);
        array_map('unlink', glob($old . '/*') ?: []);
        @rmdir($old);
    }
}
function write_atomic(string $file, string $data): void {
    $tmp = $file . '.tmp-' . bin2hex(random_bytes(3));
    if (@file_put_contents($tmp, $data, LOCK_EX) === false || !@rename($tmp, $file)) {
        @unlink($tmp);
        throw new RuntimeException('Не удалось записать файл ' . basename($file) . '. Проверьте права на папку сайта');
    }
}

/* ---------- Проверки содержимого ---------- */
function ok_media(string $p, string $kind): bool {
    $ext = $kind === 'video' ? 'mp4' : '(jpe?g|png|webp|svg)';
    $base = $kind === 'video' ? 'video/' : 'img/';
    return strpos($p, '..') === false && (bool)preg_match('~^' . $base . '[\w\-/]+\.' . $ext . '$~i', $p);
}

function check_page(string $html): string {
    if (strlen($html) > 3 * 1024 * 1024) throw new RuntimeException('Страница получилась слишком большой');
    if (stripos($html, '<html') === false || stripos($html, '</body>') === false) throw new RuntimeException('Страница повреждена, сохранение отменено');
    // На странице допустимы только наши скрипты и разметка для поисковиков
    if (!preg_match_all('~<script\b([^>]*)>~i', $html, $m)) throw new RuntimeException('Пропали скрипты сайта');
    $need = ['js/formats.js' => false, 'js/main.js' => false];
    foreach ($m[1] as $attrs) {
        if (preg_match('~type\s*=\s*"application/ld\+json"~i', $attrs)) continue;
        if (preg_match('~^\s*src\s*=\s*"(js/(formats|main)\.js)(\?v=\d+)?"\s*$~i', $attrs, $s)) { $need[$s[1]] = true; continue; }
        throw new RuntimeException('На странице появился посторонний скрипт, сохранение отменено');
    }
    foreach ($need as $f => $found) if (!$found) throw new RuntimeException('Пропал файл ' . $f . ', сохранение отменено');
    if (preg_match('~\son[a-z]+\s*=|javascript:|<iframe|<object|<embed~i', $html)) throw new RuntimeException('На странице появился недопустимый код, сохранение отменено');
    return $html;
}

function build_formats(array $in): string {
    $out = [];
    $cats = 0;
    foreach ($in as $cat => $items) {
        $cat = trim(strip_tags((string)$cat));
        if ($cat === '' || !is_array($items) || ++$cats > 12) continue;
        $out[$cat] = [];
        foreach ($items as $it) {
            if (!is_array($it)) continue;
            $video = (string)($it['video'] ?? '');
            if (!ok_media($video, 'video')) continue;
            $row = ['title' => mb_substr(trim(strip_tags((string)($it['title'] ?? ''))), 0, 140), 'video' => $video];
            $poster = (string)($it['poster'] ?? '');
            if ($poster !== '' && ok_media($poster, 'image')) $row['poster'] = $poster;
            $row['vertical'] = !isset($it['vertical']) || $it['vertical'] !== false;
            if (($it['fit'] ?? '') === 'whole') $row['fit'] = 'whole';
            $out[$cat][] = $row;
            if (count($out[$cat]) >= 40) break;
        }
    }
    if (!$out) throw new RuntimeException('Список видео пуст, сохранение отменено');
    $js = "/*\n  Видео для плиток «Какой праздник вы планируете?».\n  Этот файл меняется из панели правок /admin (раздел «Видео в форматах»).\n  vertical: true — ролик снят вертикально, fit: 'whole' — показывать кадр целиком.\n*/\n";
    $js .= 'window.FORMATS = ' . json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . ";\n";
    return $js;
}

/* ---------- Загрузка содержимого в панель ---------- */
if ($action === 'load') {
    out(['ok' => true, 'page' => (string)@file_get_contents($PAGE), 'backups' => list_backups($BACKUPS)]);
}

/* ---------- Сохранение ---------- */
if ($action === 'save') {
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 6 * 1024 * 1024) fail('Слишком большой объём данных', 413);
    $in = json_decode($raw, true);
    if (!is_array($in)) fail('Неверные данные');
    try {
        $page = isset($in['page']) ? check_page((string)$in['page']) : null;
        $fmt  = isset($in['formats']) && is_array($in['formats']) ? build_formats($in['formats']) : null;
        if ($page === null && $fmt === null) fail('Нечего сохранять');
        if ($fmt !== null) {
            // Новая версия файла с видео, чтобы браузеры не показывали старую из кэша
            $page = $page ?? (string)file_get_contents($PAGE);
            $page = preg_replace('~src="js/formats\.js(\?v=\d+)?"~', 'src="js/formats.js?v=' . time() . '"', $page);
            check_page($page);
        }
        make_backup($BACKUPS, ['index.html' => $PAGE, 'formats.js' => $FORMATS]);
        if ($fmt !== null) write_atomic($FORMATS, $fmt);
        write_atomic($PAGE, $page);
    } catch (RuntimeException $e) {
        fail($e->getMessage(), 422);
    }
    out(['ok' => true, 'page' => $page, 'backups' => list_backups($BACKUPS)]);
}

if ($action === 'restore') {
    $id = (string)($_POST['id'] ?? '');
    if (!preg_match('~^\d{8}-\d{6}-[a-z0-9]{4}$~', $id) || !is_dir($BACKUPS . '/' . $id)) fail('Копия не найдена', 404);
    $d = $BACKUPS . '/' . $id;
    try {
        make_backup($BACKUPS, ['index.html' => $PAGE, 'formats.js' => $FORMATS]);
        if (is_file($d . '/formats.js')) write_atomic($FORMATS, (string)file_get_contents($d . '/formats.js'));
        if (is_file($d . '/index.html')) {
            $page = (string)file_get_contents($d . '/index.html');
            $page = preg_replace('~src="js/formats\.js(\?v=\d+)?"~', 'src="js/formats.js?v=' . time() . '"', $page);
            write_atomic($PAGE, $page);
        }
    } catch (RuntimeException $e) {
        fail($e->getMessage(), 500);
    }
    out(['ok' => true, 'page' => (string)file_get_contents($PAGE), 'backups' => list_backups($BACKUPS)]);
}

/* ---------- Загрузка фото и видео частями ---------- */
if ($action === 'upload') {
    $kind  = ($_POST['kind'] ?? '') === 'video' ? 'video' : 'image';
    $uid   = preg_replace('~[^a-z0-9]~', '', strtolower((string)($_POST['uid'] ?? '')));
    $index = (int)($_POST['index'] ?? -1);
    $total = (int)($_POST['total'] ?? 0);
    $f     = $_FILES['blob'] ?? null;
    if (strlen($uid) < 8 || $index < 0 || $total < 1 || $index >= $total) fail('Неверные данные загрузки');
    if (!$f || $f['error'] !== UPLOAD_ERR_OK) fail('Часть файла не загрузилась. Проверьте интернет и попробуйте ещё раз');

    if (!is_dir($TMP)) @mkdir($TMP, 0755, true);
    foreach (glob($TMP . '/*.part') ?: [] as $old) if (time() - filemtime($old) > 86400) @unlink($old);
    $part = $TMP . '/' . $uid . '.part';
    if ($index === 0) @unlink($part);
    elseif (!is_file($part)) fail('Загрузка прервалась, начните заново');
    if (@file_put_contents($part, (string)file_get_contents($f['tmp_name']), FILE_APPEND | LOCK_EX) === false) fail('Не удалось сохранить файл', 500);
    $size = filesize($part);
    if ($size > ($kind === 'video' ? MAX_VIDEO : MAX_IMAGE)) { @unlink($part); fail($kind === 'video' ? 'Видео больше 400 МБ' : 'Фото больше 25 МБ', 413); }
    if ($index < $total - 1) out(['ok' => true, 'next' => $index + 1]);

    $slot = preg_replace('~[^a-z0-9\-]~', '', strtolower((string)($_POST['slot'] ?? ''))) ?: $kind;
    $slot = substr($slot, 0, 30);
    $name = $slot . '-' . date('Ymd-His') . '-' . substr(bin2hex(random_bytes(2)), 0, 4);

    if ($kind === 'video') {
        $fh = fopen($part, 'rb');
        $head = fread($fh, 12);
        fclose($fh);
        if (substr($head, 4, 4) !== 'ftyp') { @unlink($part); fail('Подходят только видео в формате MP4', 415); }
        $dir = $ROOT . '/video/uploads';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $path = 'video/uploads/' . $name . '.mp4';
        if (!@rename($part, $ROOT . '/' . $path)) fail('Не удалось сохранить видео', 500);
        @chmod($ROOT . '/' . $path, 0644);
        out(['ok' => true, 'path' => $path]);
    }

    $info = @getimagesize($part);
    $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($types[$info[2]])) { @unlink($part); fail('Подходят только фото JPG, PNG или WEBP', 415); }
    $dir = $ROOT . '/img/uploads';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $max = max(400, min(2400, (int)($_POST['max'] ?? 1800)));

    // Уменьшаем большие фото и поворачиваем снимки с телефона, чтобы сайт грузился быстро
    if (function_exists('imagecreatefromstring')) {
        $src = @imagecreatefromstring((string)file_get_contents($part));
        if ($src) {
            if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
                $o = (int)(@exif_read_data($part)['Orientation'] ?? 1);
                if ($o === 3) $src = imagerotate($src, 180, 0);
                if ($o === 6) $src = imagerotate($src, -90, 0);
                if ($o === 8) $src = imagerotate($src, 90, 0);
            }
            [$w, $h] = [imagesx($src), imagesy($src)];
            $k = min(1, $max / max($w, $h));
            $nw = (int)round($w * $k);
            $nh = (int)round($h * $k);
            $dst = imagecreatetruecolor($nw, $nh);
            imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
            $path = 'img/uploads/' . $name . '.jpg';
            imageinterlace($dst, true);
            imagejpeg($dst, $ROOT . '/' . $path, 84);
            imagedestroy($src);
            imagedestroy($dst);
            @unlink($part);
            out(['ok' => true, 'path' => $path, 'w' => $nw, 'h' => $nh]);
        }
    }
    $path = 'img/uploads/' . $name . '.' . $types[$info[2]];
    if (!@rename($part, $ROOT . '/' . $path)) fail('Не удалось сохранить фото', 500);
    out(['ok' => true, 'path' => $path, 'w' => $info[0], 'h' => $info[1]]);
}

/* ---------- Заявки с сайта (их сохраняет send.php) ---------- */
if ($action === 'leads') {
    $res = [];
    $files = glob($DATA . '/leads/*.jsonl') ?: [];
    rsort($files);
    foreach ($files as $f) {
        $lines = file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        for ($i = count($lines) - 1; $i >= 0; $i--) {
            $row = json_decode($lines[$i], true);
            if (!is_array($row)) continue;
            $row['_id'] = basename($f, '.jsonl') . ':' . $i;
            $res[] = $row;
            if (count($res) >= 500) break 2;
        }
    }
    out(['ok' => true, 'leads' => $res]);
}

if ($action === 'lead_delete') {
    if (!preg_match('~^(\d{4}-\d{2}):(\d+)$~', (string)($_POST['id'] ?? ''), $m)) fail('Заявка не найдена', 404);
    $f = $DATA . '/leads/' . $m[1] . '.jsonl';
    $lines = is_file($f) ? (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []) : [];
    if (!isset($lines[(int)$m[2]])) fail('Заявка не найдена', 404);
    unset($lines[(int)$m[2]]);
    try { write_atomic($f, $lines ? implode("\n", $lines) . "\n" : ''); } catch (RuntimeException $e) { fail($e->getMessage(), 500); }
    out(['ok' => true]);
}

fail('Неизвестное действие', 404);
