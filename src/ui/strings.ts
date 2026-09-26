// The single dictionary of Russian UI copy. Components never inline user-facing text.

export const strings = {
  app: {
    name: 'aitu dating',
  },
  time: {
    now: 'сейчас',
    minutes: 'мин',
    hours: 'ч',
    days: 'д',
  },
  tabs: {
    index: 'Главная',
    search: 'Поиск',
    create: 'Создать',
    activity: 'Активность',
    profile: 'Профиль',
  },
  home: {
    brand: 'aitu dating',
    descriptorGuest: 'preview сообщества',
    descriptorMember: 'verified conversations',
    join: 'Вступить',
    about: 'О продукте',
    filtersLabel: 'Фильтры ленты',
    cityLabel: 'Город',
    tabs: {
      for_you: 'Для тебя',
      popular: 'Популярное',
      city: 'В городе',
      plans: 'Планы',
      following: 'Подписки',
    },
  },
  feed: {
    emptyTitle: 'Здесь пока тихо',
    emptyCity: 'В этом городе пока нет публикаций. Посмотрите, о чём говорят в других городах.',
    emptyDefault: 'Публикаций по этому фильтру пока нет.',
    emptyAction: 'Показать ленту «Для тебя»',
    errorTitle: 'Не удалось загрузить ленту',
    errorNetwork: 'Проверьте подключение и попробуйте ещё раз.',
    errorDefault: 'Что-то пошло не так. Попробуйте ещё раз.',
    retry: 'Повторить',
    loadingMore: 'Загружаем ещё',
    endOfFeed: 'Вы всё посмотрели',
  },
  post: {
    type: {
      post: 'Пост',
      question: 'Вопрос',
      quote: 'Цитата',
      plan: 'План встречи',
    },
    showMore: 'Показать полностью',
    verified: 'verified',
    media: 'Изображение к публикации',
    authorSafe: (gender: string, age: number) => `${gender}, ${age}`,
    actions: {
      comment: (n: number) => `Комментарии: ${n}`,
      reaction: (n: number) => `Нравится: ${n}`,
      repost: (n: number) => `Репосты: ${n}`,
      quote: 'Цитировать',
    },
  },
  plan: {
    minutes: (n: number) => `${n} мин`,
    publicPlace: 'Публичное место',
    matched: 'Уже есть пара',
  },
  settings: {
    title: 'Настройки',
    open: 'Настройки',
    close: 'Закрыть',
    appearance: 'Оформление',
    theme: {
      system: 'Системная',
      light: 'Светлая',
      dark: 'Тёмная',
    },
    themeHint: 'Системная тема следует настройке телефона.',
  },
  demo: {
    title: 'Demo controls',
    hint: 'Только в демо-сборке. Помогают проверить ошибки и пустые состояния.',
    reset: 'Сбросить демо',
    resetDone: 'Демо сброшено: вы снова в режиме preview.',
    networkErrorOnce: 'Ошибка сети один раз',
    networkErrorOnceHint: 'Следующий запрос данных завершится ошибкой.',
    networkErrorArmed: 'Следующий запрос завершится ошибкой сети.',
    offline: 'Режим offline',
    offlineHint: 'Все запросы данных получают ошибку сети, пока режим включён.',
  },
  offline: {
    banner: 'Нет сети. Показываем сохранённые данные.',
  },
  storage: {
    resetNotice: 'Сохранённые данные устарели, демо сброшено до начального состояния.',
  },
  stub: {
    back: 'Назад',
    access: {
      title: 'Вступление',
      text: 'Здесь появится вход через Aitu Passport, выбор membership и анкета.',
    },
    about: {
      title: 'О продукте',
      text: 'Aitu Dating — закрытое verified-сообщество, где знакомство начинается с разговора, вопроса или безопасного плана встречи, а не со свайпа.',
    },
  },
  placeholder: {
    home: {
      title: 'Главная',
      text: 'Здесь появится лента разговоров, вопросов и планов.',
    },
    search: {
      title: 'Поиск',
      text: 'Здесь появится поиск по темам, городам, постам и планам.',
    },
    create: {
      title: 'Создать',
      text: 'Здесь можно будет создать пост или встречу один на один.',
    },
    activity: {
      title: 'Активность',
      text: 'Здесь появятся ответы, реакции, подписки и события планов.',
    },
    profile: {
      title: 'Профиль',
      text: 'Здесь появятся ваша карточка, публикации, планы и настройки.',
    },
  },
  uiKit: {
    title: 'Компоненты',
    open: 'Открыть витрину компонентов',
    back: 'Назад',
    primary: 'Основная кнопка',
    secondary: 'Вторичная кнопка',
    text: 'Текстовая кнопка',
    disabled: 'Недоступна',
    loading: 'Загрузка',
    iconAction: 'Действие-иконка',
    sections: {
      default: 'Обычное состояние',
      disabled: 'Недоступно',
      loading: 'Загрузка',
      icon: 'Иконки',
    },
  },
} as const;
