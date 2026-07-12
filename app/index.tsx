import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const role = useAuthStore((s) => s.role);

  if (!role) return <Redirect href="/(auth)/login" />;
  if (role === 'resident') return <Redirect href="/(resident)" />;
  if (role === 'guard') return <Redirect href="/(guard)" />;
  if (role === 'admin') return <Redirect href="/(admin)" />;

  return <Redirect href="/(auth)/login" />;
}