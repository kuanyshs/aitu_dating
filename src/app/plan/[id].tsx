import { Redirect, useLocalSearchParams } from 'expo-router';

/** Links from before Встреча replaced План keep working. */
export default function OldPlanLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/meeting/${String(id)}`} />;
}
