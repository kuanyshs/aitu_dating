import type { PassportCandidate } from '@/contracts';

// Mock Aitu Passport identities from the gap-resolution document. They are new people
// without a card and never part of the seeded community.
export const passportCandidates: PassportCandidate[] = [
  {
    id: 'passport-1',
    aituSubjectId: 'aitu-subject-almaty-102',
    name: 'Айдана',
    surname: 'Кенжебаева',
    gender: 'woman',
    age: 27,
    city: '750000000',
  },
  {
    id: 'passport-2',
    aituSubjectId: 'aitu-subject-astana-207',
    name: 'Тимур',
    surname: 'Есенов',
    gender: 'man',
    age: 31,
    city: '710000000',
  },
  {
    id: 'passport-3',
    aituSubjectId: 'aitu-subject-karaganda-314',
    name: 'Мадина',
    surname: 'Тулегенова',
    gender: 'woman',
    age: 29,
    city: '351010000',
  },
];
