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
    { title: 'Твой номер один: муз-лото 🎵', video: 'video/formats/corporate-1.mp4', poster: 'img/format-corporate-1.jpg', vertical: true },
    { title: 'Корпоратив 2025 🎄', video: 'video/formats/corporate-2.mp4', poster: 'img/format-corporate-2.jpg', vertical: true },
    { title: 'Летний волейбольный турнир 🏐☀️', video: 'video/reels/summer.mp4', poster: 'img/reel-summer.jpg', vertical: true },
    { title: 'Корпоративо-мексикано 🇲🇽', video: 'video/reels/mexico.mp4', poster: 'img/reel-mexico.jpg', vertical: false },
    { title: 'Корпоратив компании «Бани с Чехова» 🪆 Русские традиции', video: 'video/formats/corporate-5.mp4', poster: 'img/format-corporate-5.jpg', vertical: true }
  ],
  'Выпускной': [
    { title: '«Энергия этого вечера ⚡»', video: 'video/reels/energy.mp4', poster: 'img/reel-energy.jpg', vertical: true },
    { title: '«Мы смеялись и играли ❤️‍🔥»', video: 'video/formats/graduation-2.mp4', poster: 'img/format-graduation-2.jpg', vertical: true },
    { title: '«Импровизация и живые эмоции ✌️»', video: 'video/formats/graduation-3.mp4', poster: 'img/format-graduation-3.jpg', vertical: true },
    { title: 'Слова благодарности 💐', video: 'video/formats/graduation-4.mp4', poster: 'img/format-graduation-4.jpg', vertical: false },
    { title: 'Песня «Я — это ты» 🎤', video: 'video/formats/graduation-5.mp4', poster: 'img/format-graduation-5.jpg', vertical: false }
  ],
  'Городское событие': [
    { title: 'Зима в Москве: репортаж «Вестей» 📺', video: 'video/formats/city-1.mp4', poster: 'img/format-city-1.jpg', vertical: false },
    { title: 'Самые весёлые развлечения у нас 🎉', video: 'video/formats/city-2.mp4', poster: 'img/format-city-2.jpg', vertical: true },
    { title: 'Концерт 9 мая 🎖', video: 'video/formats/city-3.mp4', poster: 'img/format-city-3.jpg', vertical: false },
    { title: 'Памятная церемония 🕊', video: 'video/formats/city-4.mp4', poster: 'img/format-city-4.jpg', vertical: true }
  ],
  'Специальное мероприятие': [
    { title: 'Выступление на сцене 🎤', video: 'video/formats/special-1.mp4', poster: 'img/format-special-1.jpg', vertical: false },
    { title: 'Видео со специального мероприятия 2', video: '', poster: '', vertical: true },
    { title: 'Видео со специального мероприятия 3', video: '', poster: '', vertical: true }
  ]
};
