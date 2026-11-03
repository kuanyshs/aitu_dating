import { Redirect } from 'expo-router';

/**
 * An address the app does not know (an old link, or the prototype opened as a saved
 * file, where the address is the file's path) leads to Home instead of a dead end.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
