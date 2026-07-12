import { Stack } from 'expo-router';
export default function GuardLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}