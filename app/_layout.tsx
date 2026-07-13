import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const queryClient = new QueryClient();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.session.user.id)
          .single();
        if (profile) setSession(data.session.user.id, profile.role);
      }
      setReady(true);
    };
    init();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(resident)" />
          <Stack.Screen name="(guard)" />
          <Stack.Screen name="(admin)" />
        </Stack>
      </PaperProvider>
    </QueryClientProvider>
  );
}