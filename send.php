<?php
/**
 * Обработчик заявок с сайта.
 * Отправляет заявку в Telegram, ВКонтакте и/или на e-mail (можно включить любые сразу).
 * Заполните настройки ниже (или задайте переменные окружения на хостинге).
 */

// ===== НАСТРОЙКИ =====
$TELEGRAM_BOT_TOKEN = getenv('TG_BOT_TOKEN') ?: '';   // токен бота от @BotFather
$TELEGRAM_CHAT_ID   = getenv('TG_CHAT_ID') ?: '';     // ваш chat_id (узнать: @userinfobot)
$VK_GROUP_TOKEN     = getenv('VK_GROUP_TOKEN') ?: ''; // ключ доступа сообщества ВК с правом «Сообщения сообщества»
$VK_USER_ID         = getenv('VK_USER_ID') ?: '';     // числовой id страницы ВК, куда присылать заявки
$MAIL_TO            = getenv('MAIL_TO') ?: '';        // e-mail для заявок, напр. info@example.ru
$MAIL_FROM          = getenv('MAIL_FROM') ?: 'no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
// =====================

// Ключи можно держать отдельно от кода, в content/send-config.php (папка content закрыта от доступа из интернета).
// Тогда этот файл можно обновлять, не вписывая токен заново.
if (is_file(__DIR__ . '/content/send-config.php')) require __DIR__ . '/content/send-config.php';

header('Content-Type: application/json; charset=utf-8');

function respond($ok, $error = null, $code = 200) {
    http_response_code($code);
    echo json_encode($error ? ['ok' => $ok, 'error' => $error] : ['ok' => $ok], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(false, 'Method not allowed', 405);

// Ловушка для ботов: скрытое поле должно быть пустым
if (!empty($_POST['website'])) respond(true);

function field($key, $max = 500) {
    $v = trim((string)($_POST[$key] ?? ''));
    $v = strip_tags($v);
    return mb_substr($v, 0, $max);
}

$name    = field('name', 100);
$phone   = field('phone', 30);
$event   = field('event', 100);
$date    = field('date', 20);
$contact = field('contact', 30);
$tariff  = field('tariff', 50);
$topic   = field('topic', 100);
$message = field('message', 2000);
$guests  = field('guests', 30);
$site    = field('site', 30);

// Имя необязательно: в формах второй версии сайта только дата и телефон
if ($name === '') $name = 'не указано';
$telegram = ltrim(field('telegram', 40), '@');
if ($telegram !== '' && !preg_match('/^[A-Za-z0-9_]{4,32}$/', $telegram)) respond(false, 'Проверьте ник в Telegram', 422);
$hasPhone = strlen(preg_replace('/\D/', '', $phone)) >= 10;
if (!$hasPhone && $telegram === '') respond(false, 'Укажите телефон или ник в Telegram', 422);
if (empty($_POST['agree'])) respond(false, 'Нужно согласие на обработку данных', 422);

// Простое ограничение частоты: не чаще 1 заявки в 20 секунд с одного IP
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$lock = sys_get_temp_dir() . '/lead_' . md5($ip);
if (file_exists($lock) && time() - filemtime($lock) < 20) respond(false, 'Слишком часто, попробуйте через минуту', 429);
@touch($lock);

$lines = [
    '🎉 Новая заявка с сайта',
    '',
    'Имя: ' . $name,
];
if ($telegram !== '') $lines[] = 'Telegram: @' . $telegram . ' (https://t.me/' . $telegram . ')';
if ($hasPhone)        $lines[] = 'Телефон: ' . $phone;
if ($event)   $lines[] = 'Праздник: ' . $event;
if ($date)    $lines[] = 'Дата: ' . date('d.m.Y', strtotime($date));
if ($tariff)  $lines[] = 'Тариф: ' . $tariff;
if ($topic)   $lines[] = 'Тема: ' . $topic;
if ($contact) $lines[] = 'Связь: ' . $contact;
if ($guests)  $lines[] = 'Гостей: ' . $guests;
if ($message) $lines[] = 'Комментарий: ' . $message;
if ($site)    $lines[] = 'Версия сайта: ' . $site;
$text = implode("\n", $lines);

// Сначала заявка сохраняется на хостинге в России (152-ФЗ, локализация), потом пересылается в Telegram.
// Сохранённые заявки видны в панели правок, раздел «Заявки». Заявки старше года удаляются сами.
$saved = false;
$leadDir = __DIR__ . '/content/leads';
if (!is_dir($leadDir)) @mkdir($leadDir, 0700, true);
$lead = array_filter([
    'time' => date('c'), 'name' => $name, 'phone' => $hasPhone ? $phone : '', 'telegram' => $telegram,
    'contact' => $contact, 'event' => $event, 'date' => $date, 'tariff' => $tariff, 'topic' => $topic,
    'guests' => $guests, 'message' => $message,
], function ($v) { return $v !== ''; });
if (@file_put_contents($leadDir . '/' . date('Y-m') . '.jsonl', json_encode($lead, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX) !== false) $saved = true;
$oldest = date('Y-m', strtotime('-12 months'));
foreach (glob($leadDir . '/*.jsonl') ?: [] as $f) if (basename($f, '.jsonl') < $oldest) @unlink($f);

$sent = false;

if ($TELEGRAM_BOT_TOKEN && $TELEGRAM_CHAT_ID) {
    $ch = curl_init('https://api.telegram.org/bot' . $TELEGRAM_BOT_TOKEN . '/sendMessage');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => ['chat_id' => $TELEGRAM_CHAT_ID, 'text' => $text],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($res !== false && $code === 200) $sent = true;
}

// ВКонтакте: сообщение от имени сообщества. Получатель должен один раз написать сообществу,
// иначе ВК не разрешит сообществу присылать ему сообщения.
if ($VK_GROUP_TOKEN && $VK_USER_ID) {
    $ch = curl_init('https://api.vk.com/method/messages.send');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => [
            'access_token' => $VK_GROUP_TOKEN,
            'v'            => '5.199',
            'peer_id'      => $VK_USER_ID,
            'random_id'    => random_int(1, PHP_INT_MAX),
            'message'      => $text,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $res = curl_exec($ch);
    curl_close($ch);
    $json = $res !== false ? json_decode($res, true) : null;
    if (isset($json['response'])) $sent = true;
}

if ($MAIL_TO) {
    $subject = '=?UTF-8?B?' . base64_encode('Заявка с сайта: ' . $name) . '?=';
    $headers = "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nFrom: " . $MAIL_FROM . "\r\n";
    if (@mail($MAIL_TO, $subject, $text, $headers)) $sent = true;
}

if (!$sent && !$saved) respond(false, 'Не удалось отправить заявку', 500);
respond(true);
