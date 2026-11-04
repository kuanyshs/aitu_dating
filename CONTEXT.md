# Aitu Dating

Closed, Russian-speaking verified dating community: people meet through conversations, posts, questions, comments and safe one-to-one meeting plans rather than a swipe catalogue.

## Language

### People and access

**Вступление** (`AccessFlow`):
The way a **Неверифицированный пользователь** becomes a **Верифицированный пользователь**: Aitu Passport, club rules, a paid **Подписка на клуб** period, payment, the **Карточка**, the **Анкета** and the confirmation «Вы верифицированный пользователь». It can be closed at any step and continued later from the last finished one («Продолжить вступление»).
_Avoid_: onboarding, registration

**Кандидат Passport** (`PassportCandidate`):
A mock Aitu Passport identity the demo user can sign in as. Has no **Карточка** until the **Анкета** is finished and is never one of the seeded community **Верифицированные пользователи**.
_Avoid_: test user, demo user

**Верифицированный пользователь** (`Member`):
A person with a published **Карточка** inside the community.
_Avoid_: участник (former name), profile

**Неверифицированный пользователь** (`Guest`):
Someone looking at the app without member access; sees only the **Безопасный вид**.
_Avoid_: гость (former name), anonymous, visitor

**Безопасный вид** (`SafeAuthorView`):
The only shape of another person a **Неверифицированный пользователь** or an expired **Верифицированный пользователь** receives: gender label, age, city at allowed precision and the shared neutral avatar.
_Avoid_: masked profile, blurred profile

**Полный вид** (`MemberAuthorView`):
The permitted shape of another person an active **Верифицированный пользователь** receives: name, verified mark, photo and the **Безопасный вид** fields.

**Подписка на клуб** (`Membership`):
A **Верифицированный пользователь**'s paid access for exactly one **Период**; active or expired. It starts once the payment succeeds. There is no free tier.
_Avoid_: membership (former name); «подписка» alone where it could be read as a **Подписка** on a person

**Период** (`periodMonths`):
The length of a **Подписка на клуб**: 1, 3, 6 or 12 months; exactly one is chosen at a time.

**Продление** (`Renewal`):
Choosing and paying for a new **Период**. An expired **Подписка на клуб** starts again from the payment; an early one adds the **Период** to the current end date. Months are calendar months in Asia/Almaty (31 January plus one month is the last day of February). Never repeats the **Анкета** and never lifts an **Ограничение**.
_Avoid_: resubscribe, re-onboarding

**Блокировка** (`Block`):
One **Верифицированный пользователь** hiding another: their content and chats disappear for both sides and no new chat or **Запрос** between them is possible. Hidden **Посты** read «Публикация недоступна», a hidden **Комментарий** that still holds others' **Ответы** reads «Комментарий скрыт», the other's **Карточка** is not found; counters stay as they were. Nobody blocks themselves; a **Блокировка** is lifted in «Безопасность» → «Заблокированные».
_Avoid_: ban, restriction

**Ограничение** (`Restriction`):
A moderation decision that puts a person into the blocked access state, with a reason (one of the **Жалоба** reasons) and a term: 7 days, 30 days or until lifted. It ends by itself when its term is over, or when moderation lifts it — after an **Апелляция** or on its own; «Продлить» never lifts it. Meanwhile the person sees only the restriction screen: the reason, until when, the state of their **Апелляция**, the rules and **Поддержка**; their content is hidden from everyone. Removing content never restricts its author by itself.
_Avoid_: block, ban

**Апелляция** (`Appeal`):
The restricted person's one request to review an **Ограничение**, with an explanation of up to 1 000 characters, within 7 calendar days of the decision. Sending again returns the same one; there is never a second **Апелляция** on the same decision. It waits for moderation, then the **Ограничение** is lifted or stays in force.
_Avoid_: complaint, dispute

**Обращение в поддержку** (`SupportRequest`):
A message to the club's support with a topic (ограничение, безопасность, аккаунт, оплата, другое) and a text of up to 1 000 characters; any person with an Aitu Passport identity sends one, the restricted included. It is received and listed in «Мои обращения» with its status; a retry never sends it twice.
_Avoid_: ticket, feedback

**Жалоба** (`Report`):
A signal to moderation about a person or a piece of content (**Пост**, **Комментарий**, **Встреча**, message) with a reason and optional details. It goes from created to reviewing to resolved and ends with an **Итог жалобы**. A second **Жалоба** on the same target while the first is unresolved returns the first; nobody reports their own content. A **Неверифицированный пользователь** may report anonymously but never sees the status.
_Avoid_: complaint, flag

**Итог жалобы** (`ReportOutcome`):
The moderator's decision on a **Жалоба**: dismissed, content removed (shown exactly like a deletion by its author; a removed message disappears from the chat for both) or member restricted (an **Ограничение** with its term). One decision resolves every open **Жалоба** on the same target. The reporter learns it only from «Мои жалобы».
_Avoid_: verdict

**Очередь модерации** (`ReportQueue`):
The moderator's list of **Жалобы** in three tabs: new, reviewing, resolved, and of waiting **Апелляции** in a fourth. Opening a **Жалоба** moves it to reviewing; a moderator never sees **Жалобы** about their own content.
_Avoid_: inbox, tickets

### Profile

**Профиль** (own):
The **Верифицированный пользователь**'s own page: their **Карточка** and **Фото**, then «Редактировать карточку», «Мои публикации», «Мои встречи», «Мои запросы», «Подписчики», «Подписки», «Мои действия», «Уведомления», «Сообщения» and «Настройки».

**Карточка** (`ProfileCard`):
A **Верифицированный пользователь**'s community profile: bio, **Намерения**, interests, communication style and the **Анкета** answers. Name, surname, age, gender and **Населённый пункт** come from Passport and are read-only. The surname is hidden from others until the owner turns on «Показывать фамилию в профиле»; the owner always sees it.
_Avoid_: profile card, анкета (the questionnaire is a different thing)

**Анкета** (`Questionnaire`):
The seven questions answered during onboarding; finishing it publishes the **Карточка**. Each takes several options up to its own limit (two **Населённые пункты**, three **Намерения**, one pace); only the **Населённый пункт** may be left empty («Не указан»). It is edited later in «Редактировать анкету», and the profile's **Населённый пункт** follows the first one chosen.
_Avoid_: survey, onboarding form

**Фильтры ленты** (`FeedFilters`):
The **Анкета** questions that rank the «Для тебя» **Лента**: any number of options per question, and a person matches a question when one of their answers is among the chosen options. A **Верифицированный пользователь** starts from their own answers and may change them, keeping them with their account; a **Неверифицированный пользователь** starts with none and keeps them on the device. Ranking puts first the people matching the most chosen questions and sharing interests, then the same **Населённый пункт**, **Намерение** and meeting format, then **Подписки** and newness; for **Встречи** a nearer date and a matching format and goal count too. An active **Верифицированный пользователь** sees up to two reasons on a card («Общие интересы: кино»); nobody sees a percentage or the other person's answers.
_Avoid_: preferences, matching settings, compatibility score

**Населённый пункт** (`Settlement`):
A place in Kazakhstan from the single directory built from the official КАТО classifier: oblast, district, city, town or village. Every place field picks from it; there is no «Другой город» and no free text. A Passport place is matched to it by code, and an unmatched one must be chosen by hand before the **Вступление** ends. It filters search and sets a **Встреча**'s place; it never makes a feed of its own.
_Avoid_: city (unqualified), location

**Намерение** (`DatingIntent`):
What a person is looking for in the community: общение, свидания, дружба or новые впечатления.
_Avoid_: intent (unqualified), goal

### Content

**Лента** (`Feed`):
One of the three streams on Главная: «Для тебя» (ranked by the **Фильтры ленты**), «Популярное» and «Подписки» (people the viewer follows, newest first). Each mixes ordinary **Посты** and **Встречи** and has its own content type, «Все», «Посты» or «Планы встреч», remembered per **Лента**. A cancelled or past **Встреча** leaves every **Лента**. There is no separate feed of **Встречи** and no feed by city. A **Неверифицированный пользователь** sees «Подписки» as an invitation to join; an expired **Верифицированный пользователь** reads it in the **Безопасный вид**.
_Avoid_: tab (unqualified), timeline

**Пост** (`Post`):
A feed entry: a post, a question, a quote of another **Пост**, or the feed face of a **Встреча**. A post, question or quote holds up to 2 000 characters, up to two **Темы** and up to two **Фото**.

**Комментарий** (`RootComment`):
A first-level response to a **Пост**. Only its author can delete it; a deleted **Комментарий** that has **Ответы** stays in the thread as «Комментарий удалён».
_Avoid_: reply (that is **Ответ**)

**Ответ** (`Reply`):
A response to a **Комментарий**; the second and last level of a thread.
_Avoid_: nested comment, sub-reply

**Репост** (`Repost`):
An **Верифицированный пользователь** sharing someone else's **Пост** as it is, without their own text; it can be undone. Nobody reposts their own **Пост**.
_Avoid_: share, retweet

**Цитата** (`Quote`):
A new **Пост** with its author's own text that points to another **Пост**.
_Avoid_: repost with comment

**Вопрос** (`Question`):
A **Пост** in which its author asks the community something. It differs from a plain post only by its label and prompt; it need not end with «?».
_Avoid_: poll

**Фото** (`Photo`):
A JPG, PNG or WEBP picture of up to 10 MB that a **Верифицированный пользователь** uploads: up to four in their **Карточка** (one of them main, which is their avatar), up to two in a **Пост**, one in a chat message. **Комментарии** and **Запросы** carry none. A **Неверифицированный пользователь** and an expired **Верифицированный пользователь** never receive anyone's **Фото**. An upload can be cancelled, fails visibly and is retried without a duplicate.
_Avoid_: image, picture, media

**Тема** (`Topic`):
One of the catalog subjects a **Пост** can carry, up to two; the feed shows it as `#тема`.
_Avoid_: tag, hashtag

**Черновик** (`Draft`):
An unpublished text from the post editor: its type, text, **Темы** and quoted **Пост**. One per **Верифицированный пользователь**, kept only on the device; saved by choice when the editor closes and cleared once published.
_Avoid_: saved post

**Упоминание** (`Mention`):
An `@` reference to a **Верифицированный пользователь** inside a **Пост** or **Комментарий**; shown to a **Неверифицированный пользователь** as «@участник». There are no usernames.
_Avoid_: tag, @username

### Relations and chats

**Подписка** (`Follow`):
One **Верифицированный пользователь** following another; two opposite **Подписки** make a mutual follow. Only an active **Верифицированный пользователь** follows; nobody follows themselves. A **Блокировка** removes the **Подписки** both ways, and lifting it does not bring them back. A member's «Подписчики» are those following them, their «Подписки» those they follow. «Подписчики» are open to active **Верифицированные пользователи**; «Подписки» — the list and its count — to the owner only.
_Avoid_: subscription (as in **Подписка на клуб**), friend

**Поиск** (`Search`):
Finding people and **Посты** by text and filters (city, interests, **Намерение**, **Темы**). Opened from «Для тебя»; it is not a tab. A **Неверифицированный пользователь** and an expired **Верифицированный пользователь** search **Посты** only; people are for active **Верифицированные пользователи**. Nobody in a **Блокировка** with the viewer, nobody under **Ограничение** and never oneself shows up.
_Avoid_: discovery, explore

**Профиль недоступен** (`profile unavailable`):
What another **Верифицированный пользователь**'s profile reads when they are in a **Блокировка** with the viewer or under **Ограничение**; nothing else about them is shown.
_Avoid_: deleted account

**Контекстный чат** (`Chat`):
The single conversation between two **Верифицированные пользователи**, opened from someone else's **Комментарий**, a mutual **Подписка** or an accepted **Запрос** (by its two people only); opening it again from anywhere returns the same one, and a new reason to talk is added to it as another **Контекст чата** rather than starting a second chat. Only an active **Верифицированный пользователь** opens one and writes; an expired one reads their chats and is offered «Продлить». A **Блокировка** or an **Ограничение** hides it from both. A message holds up to 2 000 characters and at most one **Фото**; it is «Отправлено», «Прочитано» or «Не отправлено» with «Повторить», keeping its text and **Фото** — nothing is resent behind the user's back. Messages count as read only once the last unread one has been on screen; opening «Сообщения» reads nothing. Chats with unread messages come first, then the rest by their latest message.
_Avoid_: DM, direct message

**Контекст чата** (`ChatContext`):
Why two people talk, shown under their name in the chat and in «Сообщения»: «Из комментария», «Взаимная подписка», «Встреча: …» for an accepted **Запрос**, «Встреча отменена: …» once that **Встреча** is cancelled or the chosen **Верифицированный пользователь** stepped out, and «Переписка» when the source is gone (the **Комментарий** deleted or hidden, the **Подписка** no longer mutual). A chat lists all its contexts, the latest first in one line.
_Avoid_: topic, thread

**Мои действия** (`MyActions`):
What the **Верифицированный пользователь** did themselves, newest first: reactions to **Посты**, **Комментарии**, **Ответы**, **Репосты** and **Подписки**. Seen by the owner only, in their profile; nothing hidden from them (blocked, restricted, deleted) is listed. It never replaces **Уведомления**, which are what others did around them.
_Avoid_: history, my activity

**Уведомления** (`Activity`):
What happened around the **Верифицированный пользователь**, built from the data rather than stored: new **Подписки** on them, **Комментарии** on their **Посты** and **Ответы** to their **Комментарии**, reactions and **Репосты** of their **Посты**, **Запросы** on their **Встречи** and decisions on their own **Запросы**, **Подписка на клуб** and moderation events. Messages stay in «Сообщения» (a tab, and an entry in one's own profile) and never appear here. Opening the tab marks everything so far as seen; for the rest of that visit, whatever came after the previous look still reads as new, in any category. People hidden from the viewer leave no events.
_Avoid_: activity (former name), feed (reserved for Home)

### Meetings

**Встреча** (`Plan`):
A one-to-one meeting invitation published by its author: **Населённый пункт**, date and time (Asia/Almaty), format, duration, **Цель встречи**, who pays, an approximate budget per person, where roughly (a general description of the place, shown to everyone), the exact place, a description and up to two **Темы**. Never has capacity or group participants. Only an active **Верифицированный пользователь** creates one, in a public place they confirm («Это публичное место»), and holds at most 3 open future **Встречи** at a time. The exact place is shown only to the author and, once an **Запрос** is accepted, to its sender; the count of waiting **Запросы** to the author only. Under a **Блокировка** the **Встреча** is not found. A cancelled or past **Встреча** stays in «Мои встречи», «Мои запросы», **Уведомления** and the chat it started.
_Avoid_: план (former name), event, meetup

**Статус встречи** (`PlanStatus`):
Открыт (takes **Запросы**), «Набор закрыт» (the author stopped new **Запросы**; waiting ones are still decided), **Договорённая встреча** («Встреча договорена»), Отменена (by the author, from any status; waiting **Запросы** are declined) and Прошла (the start time has come for an open or closed **Встреча**; computed, never stored). A past **Встреча** takes no **Запросы** and leaves every **Лента**.

**Бюджет** (`PlanBudget`):
The approximate spend per person a **Встреча** names: «До 3 000 ₸», «3 000–7 000 ₸», «7 000–15 000 ₸», «Больше 15 000 ₸» or «Не указывать».
_Avoid_: price, cost

**Цель встречи** (`MeetingGoal`):
Why a specific **Встреча** exists: познакомиться, поговорить or совместное занятие.
_Avoid_: intent (unqualified)

**Запрос** (`MeetingRequest`):
Another **Верифицированный пользователь**'s request to join a **Встреча**, with an optional message up to 360 characters. A **Неверифицированный пользователь** who starts one is sent to **Вступление**, and the message is kept on the device and offered again on that **Встреча** once they are a **Верифицированный пользователь**. Only an active **Верифицированный пользователь**, never on their own **Встреча**, and only on an open future one. One standing **Запрос** per person and **Встреча**: sending again returns the same one; after «Отозвать» a new one may be sent. It is waiting, accepted, declined (the sender reads «Автор выбрал другой вариант») or withdrawn.
_Avoid_: отклик (former name), join, application, заявка

**Договорённая встреча** (matched **Встреча**):
A **Встреча** whose author accepted an **Запрос**, after a confirmation; all other waiting **Запросы** are declined at once. The author does not undo the acceptance — only the whole **Встреча** can be cancelled. The chosen **Верифицированный пользователь** may «Отказаться от встречи»: their **Запрос** becomes withdrawn and a future **Встреча** is open again for new **Запросы**. Both people see «Встреча договорена» and «Написать», which opens their contextual chat; the chat stays after a cancellation.

## Relationships

- A **Кандидат Passport** becomes a **Верифицированный пользователь** by passing rules, **Подписка на клуб** and the **Анкета**.
- A **Пост** of plan type is the feed face of exactly one **Встреча**.
- A **Комментарий** belongs to one **Пост**; an **Ответ** belongs to one **Комментарий**; nothing answers an **Ответ**.
- A **Репост** adds nothing to the original **Пост** but its count; a **Цитата** is a separate **Пост** of its own.
- A **Цитата** points to exactly one **Пост**; when that one is deleted or hidden, the **Цитата** stays and shows «Публикация недоступна» in its place.
- A **Встреча** has many **Запросы** and at most one accepted, which turns it into a **Договорённая встреча**; a **Верифицированный пользователь** has at most one standing **Запрос** per **Встреча**.
- Two **Верифицированные пользователи** share at most one **Контекстный чат**; a **Комментарий**, a mutual **Подписка** or an accepted **Запрос** opens it if it does not exist and adds its **Контекст чата** to it if it does.
- A **Блокировка** is between two **Верифицированные пользователи**; an **Ограничение** is between moderation and one person.
- A **Жалоба** targets exactly one person or piece of content; many **Жалобы** on one target share one **Итог жалобы**.

## Example dialogue

> **Dev:** "When Тимур sends an **Запрос** on Айдана's **Встреча**, does Тимур already see her **Полный вид**?"
> **Domain expert:** "Only if Тимур is an active **Верифицированный пользователь**. An expired one still gets her **Безопасный вид**, and the **Запрос** button leads to renewal."

## Flagged ambiguities

- Задание v4 renamed the UI: «Гость» → **Неверифицированный пользователь**, «Участник» → **Верифицированный пользователь** (short forms «Неверифицированный», «Верифицированный», «Верификация истекла»), «План» → **Встреча**, «Отклик» → **Запрос**, Membership → **Подписка на клуб** (in the UI simply «подписка»: «Продлить подписку», «Срок подписки скоро истечёт»), «Для тебя» → «Поиск», «Подписки» (feed) → «Мои подписки». The word «план» no longer appears in the UI.
- «Подписка» is both a person followed and the club access; the glossary keeps **Подписка** for the person and **Подписка на клуб** for access, and the UI says «Мои подписки» / «Подписчики» for people and «Подписка», «Срок подписки», «Продлить подписку» for access.

- The documents used "intent" for both **Намерение** and **Цель встречи**; they are separate concepts with separate value sets.
- "Blocked" meant both a member hiding someone and a moderation decision; resolved as **Блокировка** and **Ограничение**. A **Неверифицированный пользователь** can report but cannot block.
- Seed data made Айдана, Тимур and Мадина both **Кандидаты Passport** and existing **Верифицированные пользователи**; resolved: **Кандидаты Passport** are separate people without a **Карточка**.
