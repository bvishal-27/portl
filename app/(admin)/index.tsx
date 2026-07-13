import { View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

export default function ResidentHome() {
  const clearSession = useAuthStore((s) => s.clearSession);

  const handleLogout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.log('Logout error:', error.message);
  }
  clearSession();
  router.replace('/(auth)/login');
};

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Admin Dashboard</Text>
      <Button mode="outlined" onPress={handleLogout} style={{ marginTop: 20 }}>Log Out</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18, fontWeight: '600' },
});