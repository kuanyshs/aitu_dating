import type { PassportCandidate } from '@/contracts';

// Mock Aitu Passport identities from the gap-resolution document. They are new people
// without a card and never part of the seeded community.
export const passportCandidates: PassportCandidate[] = [
  {
    id: 'passport-1',
    aituSubjectId: 'aitu-subject-almaty-102',
    name: 'Айдана',
    gender: 'woman',
    age: 27,
    city: 'almaty',
  },
  {
    id: 'passport-2',
    aituSubjectId: 'aitu-subject-astana-207',
    name: 'Тимур',
    gender: 'man',
    age: 31,
    city: 'astana',
  },
  {
    id: 'passport-3',
    aituSubjectId: 'aitu-subject-karaganda-314',
    name: 'Мадина',
    gender: 'woman',
    age: 29,
    city: 'karaganda',
  },
];
