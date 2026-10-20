<?php
/**
 * Обработчик заявок с сайта.
 * Отправляет заявку в Telegram и/или на e-mail.
 * Заполните настройки ниже (или задайте переменные окружения на хостинге).
 */

// ===== НАСТРОЙКИ =====
$TELEGRAM_BOT_TOKEN = getenv('TG_BOT_TOKEN') ?: '';   // токен бота от @BotFather
$TELEGRAM_CHAT_ID   = getenv('TG_CHAT_ID') ?: '';     // ваш chat_id (узнать: @userinfobot)
$MAIL_TO            = getenv('MAIL_TO') ?: '';        // e-mail для заявок, напр. info@example.ru
$MAIL_FROM          = getenv('MAIL_FROM') ?: 'no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
// =====================

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

if (mb_strlen($name) < 2) respond(false, 'Укажите имя', 422);
if (strlen(preg_replace('/\D/', '', $phone)) < 10) respond(false, 'Укажите телефон', 422);
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
    'Телефон: ' . $phone,
];
if ($event)   $lines[] = 'Праздник: ' . $event;
if ($date)    $lines[] = 'Дата: ' . date('d.m.Y', strtotime($date));
if ($tariff)  $lines[] = 'Тариф: ' . $tariff;
if ($topic)   $lines[] = 'Тема: ' . $topic;
if ($contact) $lines[] = 'Связь: ' . $contact;
if ($message) $lines[] = 'Комментарий: ' . $message;
$text = implode("\n", $lines);

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

if ($MAIL_TO) {
    $subject = '=?UTF-8?B?' . base64_encode('Заявка с сайта: ' . $name) . '?=';
    $headers = "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nFrom: " . $MAIL_FROM . "\r\n";
    if (@mail($MAIL_TO, $subject, $text, $headers)) $sent = true;
}

if (!$sent) respond(false, 'Не настроена отправка заявок', 500);
respond(true);
