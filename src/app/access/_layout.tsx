import { Stack } from 'expo-router';

/** The access flow: one modal stack of step screens, each a real route. */
export default function AccessLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
