// The single dictionary of Russian UI copy. Components never inline user-facing text.

export const strings = {
  app: {
    name: 'aitu dating',
  },
  tabs: {
    index: 'Главная',
    search: 'Поиск',
    create: 'Создать',
    activity: 'Активность',
    profile: 'Профиль',
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
