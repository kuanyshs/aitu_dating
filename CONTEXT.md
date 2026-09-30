# Aitu Dating

Closed, Russian-speaking verified dating community: people meet through conversations, posts, questions, comments and safe one-to-one meeting plans rather than a swipe catalogue.

## Language

### People and access

**Кандидат Passport** (`PassportCandidate`):
A mock Aitu Passport identity the demo user can sign in as. Has no **Карточка** until the **Анкета** is finished and is never one of the seeded community **Участники**.
_Avoid_: test user, demo user

**Участник** (`Member`):
A person with a published **Карточка** inside the community.
_Avoid_: user (in UI copy), profile

**Гость** (`Guest`):
Someone looking at the app without member access; sees only the **Безопасный вид**.
_Avoid_: anonymous, visitor

**Безопасный вид** (`SafeAuthorView`):
The only shape of another person a **Гость** or an expired **Участник** receives: gender label, age, city at allowed precision and the shared neutral avatar.
_Avoid_: masked profile, blurred profile

**Полный вид** (`MemberAuthorView`):
The permitted shape of another person an active **Участник** receives: name, verified mark, photo and the **Безопасный вид** fields.

**Membership**:
A **Участник**'s paid or free-verified access for exactly one **Период**; active or expired.
_Avoid_: subscription (reserved for **Подписка**), plan (reserved for **План**)

**Период** (`periodMonths`):
The length of a **Membership**: 1, 3, 6 or 12 months; exactly one is chosen at a time.

**Продление** (`Renewal`):
Choosing a new **Период** (and paying, unless free-verified) for an expired **Membership**; never repeats the **Анкета**.
_Avoid_: resubscribe, re-onboarding

**Блокировка** (`Block`):
One **Участник** hiding another: their content and chats disappear for both sides and no new chat or **Отклик** between them is possible. Hidden **Посты** read «Публикация недоступна», a hidden **Комментарий** that still holds others' **Ответы** reads «Комментарий скрыт», the other's **Карточка** is not found; counters stay as they were. Nobody blocks themselves; a **Блокировка** is lifted in «Безопасность» → «Заблокированные».
_Avoid_: ban, restriction

**Ограничение** (`Restriction`):
A moderation decision that puts a person into the blocked access state: they see only the restriction screen, rules and support, and their content is hidden from everyone.
_Avoid_: block, ban

**Жалоба** (`Report`):
A signal to moderation about a person or a piece of content (**Пост**, **Комментарий**, **План**, message) with a reason and optional details. It goes from created to reviewing to resolved and ends with an **Итог жалобы**. A second **Жалоба** on the same target while the first is unresolved returns the first; nobody reports their own content. A **Гость** may report anonymously but never sees the status.
_Avoid_: complaint, flag

**Итог жалобы** (`ReportOutcome`):
The moderator's decision on a **Жалоба**: dismissed, content removed (shown exactly like a deletion by its author) or member restricted (an **Ограничение**). One decision resolves every open **Жалоба** on the same target. The reporter learns it only from «Мои жалобы».
_Avoid_: verdict

**Очередь модерации** (`ReportQueue`):
The moderator's list of **Жалобы** in three tabs: new, reviewing, resolved. Opening a **Жалоба** moves it to reviewing; a moderator never sees **Жалобы** about their own content.
_Avoid_: inbox, tickets

### Profile

**Карточка** (`ProfileCard`):
A **Участник**'s community profile: bio, **Намерение**, interests, communication style and the **Анкета** answers. Name, age, gender and city come from Passport and are read-only.
_Avoid_: profile card, анкета (the questionnaire is a different thing)

**Анкета** (`Questionnaire`):
The seven mandatory single-choice questions answered during onboarding; finishing it publishes the **Карточка**.
_Avoid_: survey, onboarding form

**Намерение** (`DatingIntent`):
What a person is looking for in the community: общение, свидания, дружба or новые впечатления.
_Avoid_: intent (unqualified), goal

### Content

**Пост** (`Post`):
A feed entry: a post, a question, a quote of another **Пост**, or the feed face of a **План**.

**Комментарий** (`RootComment`):
A first-level response to a **Пост**. Only its author can delete it; a deleted **Комментарий** that has **Ответы** stays in the thread as «Комментарий удалён».
_Avoid_: reply (that is **Ответ**)

**Ответ** (`Reply`):
A response to a **Комментарий**; the second and last level of a thread.
_Avoid_: nested comment, sub-reply

**Репост** (`Repost`):
An **Участник** sharing someone else's **Пост** as it is, without their own text; it can be undone. Nobody reposts their own **Пост**.
_Avoid_: share, retweet

**Цитата** (`Quote`):
A new **Пост** with its author's own text that points to another **Пост**.
_Avoid_: repost with comment

**Вопрос** (`Question`):
A **Пост** in which its author asks the community something. It differs from a plain post only by its label and prompt; it need not end with «?».
_Avoid_: poll

**Тема** (`Topic`):
One of the catalog subjects a **Пост** can carry, up to four; the feed shows it as `#тема`.
_Avoid_: tag, hashtag

**Черновик** (`Draft`):
An unpublished text from the post editor: its type, text, **Темы** and quoted **Пост**. One per **Участник**, kept only on the device; saved by choice when the editor closes and cleared once published.
_Avoid_: saved post

**Упоминание** (`Mention`):
An `@` reference to a **Участник** inside a **Пост** or **Комментарий**; shown to a **Гость** as «@участник». There are no usernames.
_Avoid_: tag, @username

### Relations and chats

**Подписка** (`Follow`):
One **Участник** following another; two opposite **Подписки** make a mutual follow. Only an active **Участник** follows; nobody follows themselves. A **Блокировка** removes the **Подписки** both ways, and lifting it does not bring them back. A member's «Подписчики» are those following them, their «Подписки» those they follow.
_Avoid_: subscription (as in **Membership**), friend

**Поиск** (`Search`):
Finding people and **Посты** by text and filters (city, interests, **Намерение**, **Темы**). A **Гость** and an expired **Участник** search **Посты** only; people are for active **Участники**. Nobody in a **Блокировка** with the viewer, nobody under **Ограничение** and never oneself shows up.
_Avoid_: discovery, explore

**Профиль недоступен** (`profile unavailable`):
What another **Участник**'s profile reads when they are in a **Блокировка** with the viewer or under **Ограничение**; nothing else about them is shown.
_Avoid_: deleted account

**Контекстный чат** (`Chat`):
The single conversation between two **Участники**, opened from someone else's **Комментарий**, a mutual **Подписка** or an accepted **Отклик** (by its two people only); it keeps the context it started from, and opening it again from anywhere returns the same one. Only an active **Участник** opens one and writes; an expired one reads their chats and is offered «Продлить». A **Блокировка** or an **Ограничение** hides it from both. Text only; a message is sent, read, or failed with «Повторить» — nothing is resent behind the user's back.
_Avoid_: DM, direct message

**Активность** (`Activity`):
What happened around the **Участник**, built from the data rather than stored: new **Подписки** on them, **Комментарии** on their **Посты** and **Ответы** to their **Комментарии**, reactions and **Репосты** of their **Посты**, **Отклики** on their **Планы** and decisions on their own **Отклики**, and a **Membership** ending within 7 days. Messages stay in the chats. Opening the tab marks everything so far as seen; for the rest of that visit, whatever came after the previous look still reads as new, in any category. People hidden from the viewer leave no events.
_Avoid_: notifications, feed (reserved for Home)

### Meetings

**План** (`Plan`):
A one-to-one meeting invitation published by its author: city, date, time, format, place, duration, **Цель встречи** and payment policy. Never has capacity or group participants. Only an active **Участник** creates one, in a public place they confirm («Это публичное место»), and holds at most 3 open future **Планы** at a time. The exact place is shown to active **Участники** only; the count of waiting **Отклики** to the author only. Under a **Блокировка** the **План** is not found.
_Avoid_: event, meetup, встреча (for the unpublished or unmatched thing)

**Статус плана** (`PlanStatus`):
Открыт (takes **Отклики**), «Набор закрыт» (the author stopped new **Отклики**; waiting ones are still decided), **Встреча** («Встреча договорена»), Отменён (by the author, from any status; waiting **Отклики** are declined) and Прошёл (the start time has come for an open or closed **План**; computed, never stored). A past **План** takes no **Отклики** and leaves the «Планы» feed tab.

**Цель встречи** (`MeetingGoal`):
Why a specific **План** exists: познакомиться, поговорить or совместное занятие.
_Avoid_: intent (unqualified)

**Отклик** (`MeetingRequest`):
Another **Участник**'s request to join a **План**, with an optional message up to 360 characters. Only an active **Участник**, never on their own **План**, and only on an open future one. One standing **Отклик** per person and **План**: sending again returns the same one; after «Отозвать» a new one may be sent. It is waiting, accepted, declined (the sender reads «Автор выбрал другой вариант») or withdrawn.
_Avoid_: join, application, заявка

**Встреча** (matched **План**):
A **План** whose author accepted an **Отклик**, after a confirmation; all other waiting **Отклики** are declined at once. Acceptance is never undone — only the whole **План** can be cancelled. Both people see «Встреча договорена» and «Написать», which opens their contextual chat.

## Relationships

- A **Кандидат Passport** becomes a **Участник** by passing rules, **Membership** and the **Анкета**.
- A **Пост** of plan type is the feed face of exactly one **План**.
- A **Комментарий** belongs to one **Пост**; an **Ответ** belongs to one **Комментарий**; nothing answers an **Ответ**.
- A **Репост** adds nothing to the original **Пост** but its count; a **Цитата** is a separate **Пост** of its own.
- A **Цитата** points to exactly one **Пост**; when that one is deleted or hidden, the **Цитата** stays and shows «Публикация недоступна» in its place.
- A **План** has many **Отклики** and at most one accepted, which turns it into a **Встреча**; a **Участник** has at most one standing **Отклик** per **План**.
- Two **Участники** share at most one **Контекстный чат**; a **Комментарий**, a mutual **Подписка** or an accepted **Отклик** opens it if it does not exist.
- A **Блокировка** is between two **Участники**; an **Ограничение** is between moderation and one person.
- A **Жалоба** targets exactly one person or piece of content; many **Жалобы** on one target share one **Итог жалобы**.

## Example dialogue

> **Dev:** "When Тимур sends an **Отклик** on Айдана's **План**, does Тимур already see her **Полный вид**?"
> **Domain expert:** "Only if Тимур is an active **Участник**. An expired one still gets her **Безопасный вид**, and the **Отклик** button leads to renewal."

## Flagged ambiguities

- The documents used "intent" for both **Намерение** and **Цель встречи**; they are separate concepts with separate value sets.
- "Blocked" meant both a member hiding someone and a moderation decision; resolved as **Блокировка** and **Ограничение**. A **Гость** can report but cannot block.
- Seed data made Айдана, Тимур and Мадина both **Кандидаты Passport** and existing **Участники**; resolved: **Кандидаты Passport** are separate people without a **Карточка**.
