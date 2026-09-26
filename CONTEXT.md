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
One **Участник** hiding another: their content and chats disappear for both sides and no new chat or **Отклик** between them is possible.
_Avoid_: ban, restriction

**Ограничение** (`Restriction`):
A moderation decision that puts a person into the blocked access state: they see only the restriction screen, rules and support, and their content is hidden from everyone.
_Avoid_: block, ban

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
A first-level response to a **Пост**.
_Avoid_: reply (that is **Ответ**)

**Ответ** (`Reply`):
A response to a **Комментарий**; the second and last level of a thread.
_Avoid_: nested comment, sub-reply

**Упоминание** (`Mention`):
An `@` reference to a **Участник** inside a **Пост** or **Комментарий**; shown to a **Гость** as «@участник». There are no usernames.
_Avoid_: tag, @username

### Relations and chats

**Подписка** (`Follow`):
One **Участник** following another; two opposite **Подписки** make a mutual follow.
_Avoid_: subscription (as in **Membership**), friend

**Контекстный чат** (`Chat`):
The single conversation between two **Участники**, opened from a **Комментарий**, a mutual **Подписка** or an accepted **Отклик**; it keeps the context it started from.
_Avoid_: DM, direct message

### Meetings

**План** (`Plan`):
A one-to-one meeting invitation published by its author: city, date, time, format, place, duration, **Цель встречи** and payment policy. Never has capacity or group participants.
_Avoid_: event, meetup, встреча (for the unpublished or unmatched thing)

**Цель встречи** (`MeetingGoal`):
Why a specific **План** exists: познакомиться, поговорить or совместное занятие.
_Avoid_: intent (unqualified)

**Отклик** (`MeetingRequest`):
Another **Участник**'s request to join a **План**. A **План** can receive many; its author accepts at most one.
_Avoid_: join, application, заявка

**Встреча** (matched **План**):
A **План** whose author accepted an **Отклик**; it gets a contextual chat between the two people.

## Relationships

- A **Кандидат Passport** becomes a **Участник** by passing rules, **Membership** and the **Анкета**.
- A **Пост** of plan type is the feed face of exactly one **План**.
- A **Комментарий** belongs to one **Пост**; an **Ответ** belongs to one **Комментарий**; nothing answers an **Ответ**.
- A **План** has many **Отклики** and at most one accepted, which turns it into a **Встреча**.
- Two **Участники** share at most one **Контекстный чат**; an accepted **Отклик** creates it if it does not exist.
- A **Блокировка** is between two **Участники**; an **Ограничение** is between moderation and one person.

## Example dialogue

> **Dev:** "When Тимур sends an **Отклик** on Айдана's **План**, does Тимур already see her **Полный вид**?"
> **Domain expert:** "Only if Тимур is an active **Участник**. An expired one still gets her **Безопасный вид**, and the **Отклик** button leads to renewal."

## Flagged ambiguities

- The documents used "intent" for both **Намерение** and **Цель встречи**; they are separate concepts with separate value sets.
- "Blocked" meant both a member hiding someone and a moderation decision; resolved as **Блокировка** and **Ограничение**. A **Гость** can report but cannot block.
- Seed data made Айдана, Тимур and Мадина both **Кандидаты Passport** and existing **Участники**; resolved: **Кандидаты Passport** are separate people without a **Карточка**.
