/*
  Видео для плиток «Какой праздник вы планируете?».
  У каждого формата 2-3 ролика. Пока поле video пустое, на сайте показывается
  пронумерованное место под видео. Чтобы поставить ролик, впишите путь к файлу
  (например "video/wedding-2.mp4") и, по желанию, обложку в poster.
  vertical: true — для роликов, снятых вертикально на телефон.
*/
window.FORMATS = {
  'Свадьба': [
    { title: 'Свадьба в ускоренной перемотке 😉', video: 'video/wedding-fast.mp4', poster: 'img/video-wedding-fast.jpg', vertical: false },
    { title: 'Свадебный ведущий Евгений Глуховский 💍', video: 'video/reels/promo.mp4', poster: 'img/promo-wedding-h.jpg', vertical: false },
    { title: 'Свадебный вечер за минуту ✨', video: 'video/formats/wedding-3.mp4', poster: 'img/format-wedding-3.jpg', vertical: true },
    { title: 'Выездная регистрация. Авторский текст ✍️', video: 'video/formats/wedding-4.mp4', poster: 'img/format-wedding-4.jpg', vertical: false },
    { title: 'Свет, тепло и улыбки ☀️', video: 'video/formats/wedding-5.mp4', poster: 'img/format-wedding-5.jpg', vertical: true },
    { title: 'Встречаем красиво наших молодожёнов 💐', video: 'video/formats/wedding-6.mp4', poster: 'img/format-wedding-6.jpg', vertical: true },
    { title: 'Финал с бенгальскими огнями 🎇', video: 'video/formats/wedding-7.mp4', poster: 'img/format-wedding-7.jpg', vertical: true }
  ],
  'Юбилей': [
    { title: 'Весёлый конкурс «Face to face» 😎', video: 'video/formats/jubilee-1.mp4', poster: 'img/format-jubilee-1.jpg', vertical: false },
    { title: 'Импровизация. Вручение подарков 🎁', video: 'video/improv.mp4', poster: 'img/reel-improv.jpg', vertical: false },
    { title: 'Выход юбиляра 🔥', video: 'video/formats/jubilee-3.mp4', poster: 'img/format-jubilee-3.jpg', vertical: true },
    { title: 'Семейный праздник: один годик 🎈', video: 'video/formats/jubilee-4.mp4', poster: 'img/format-jubilee-4.jpg', vertical: false },
    { title: 'С днём рождения! 🎂', video: 'video/formats/jubilee-5.mp4', poster: 'img/format-jubilee-5.jpg', vertical: true },
    { title: 'Тортик в ресторане «Старая басня» 🕯', video: 'video/formats/jubilee-6.mp4', poster: 'img/format-jubilee-6.jpg', vertical: true }
  ],
  'Корпоратив': [
    { title: 'Видео с корпоратива 1', video: '', poster: '', vertical: true },
    { title: 'Видео с корпоратива 2', video: '', poster: '', vertical: true },
    { title: 'Видео с корпоратива 3', video: '', poster: '', vertical: true }
  ],
  'Выпускной': [
    { title: 'Видео с выпускного 1', video: '', poster: '', vertical: true },
    { title: 'Видео с выпускного 2', video: '', poster: '', vertical: true },
    { title: 'Видео с выпускного 3', video: '', poster: '', vertical: true }
  ],
  'Городское событие': [
    { title: 'Видео с городского события 1', video: '', poster: '', vertical: true },
    { title: 'Видео с городского события 2', video: '', poster: '', vertical: true },
    { title: 'Видео с городского события 3', video: '', poster: '', vertical: true }
  ],
  'Специальное мероприятие': [
    { title: 'Видео со специального мероприятия 1', video: '', poster: '', vertical: true },
    { title: 'Видео со специального мероприятия 2', video: '', poster: '', vertical: true },
    { title: 'Видео со специального мероприятия 3', video: '', poster: '', vertical: true }
  ]
};
