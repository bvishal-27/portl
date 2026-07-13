import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);

  const handleLogin = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert('Login failed', error.message);
      setLoading(false);
      return;
    }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      Alert.alert('Error', 'No profile found for this user');
      setLoading(false);
      return;
    }

    setSession(data.user.id, profile.role);
    setLoading(false);
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Portl Login</Text>
      <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} />
      <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      <Button mode="contained" onPress={handleLogin} loading={loading}>Log In</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { marginBottom: 24, textAlign: 'center' },
  input: { marginBottom: 16 },
});