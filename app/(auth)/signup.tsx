import { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { TextInput, Button, Text, Chip } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';

type Tower = { id: string; name: string };
type Flat = { id: string; tower_id: string; flat_number: string };

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [towers, setTowers] = useState<Tower[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [selectedTower, setSelectedTower] = useState<string | null>(null);
  const [selectedFlat, setSelectedFlat] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: towerData } = await supabase.from('towers').select('*').order('name');
      if (towerData) setTowers(towerData);
      const { data: flatData } = await supabase.from('flats').select('*').order('flat_number');
      if (flatData) setFlats(flatData);
    };
    load();
  }, []);

  const flatsForTower = flats.filter((f) => f.tower_id === selectedTower);

  const handleSignup = async () => {
    if (loading) return;
    if (!fullName || !email || !password || !selectedTower || !selectedFlat) {
      Alert.alert('Missing info', 'Fill all fields and select your tower and flat');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError || !authData.user) {
        Alert.alert('Signup failed', authError?.message ?? 'Could not create account');
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        full_name: fullName,
        phone,
        role: 'resident',
        flat_id: selectedFlat,
        approved: false,
      });

      if (profileError) {
        Alert.alert('Error', profileError.message);
        setLoading(false);
        return;
      }

      Alert.alert(
        'Request submitted',
        'Your account is pending admin approval. You\'ll be able to log in once approved.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (err) {
      Alert.alert('Something went wrong', 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Request Access</Text>
      <Text style={styles.subtitle}>Sign up as a resident. Admin approval is required before you can log in.</Text>

      <TextInput label="Full Name" value={fullName} onChangeText={setFullName} style={styles.input} />
      <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <TextInput label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
      <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />

      <Text style={styles.label}>Select Tower</Text>
      <View style={styles.chipRow}>
        {towers.length === 0 && <Text style={styles.empty}>No towers set up yet — contact admin</Text>}
        {towers.map((t) => (
          <Chip
            key={t.id}
            selected={selectedTower === t.id}
            onPress={() => { setSelectedTower(t.id); setSelectedFlat(null); }}
            style={styles.chip}
          >
            {t.name}
          </Chip>
        ))}
      </View>

      {selectedTower && (
        <>
          <Text style={styles.label}>Select Flat</Text>
          <View style={styles.chipRow}>
            {flatsForTower.length === 0 && <Text style={styles.empty}>No flats in this tower yet — contact admin</Text>}
            {flatsForTower.map((f) => (
              <Chip
                key={f.id}
                selected={selectedFlat === f.id}
                onPress={() => setSelectedFlat(f.id)}
                style={styles.chip}
              >
                {f.flat_number}
              </Chip>
            ))}
          </View>
        </>
      )}

      <Button mode="contained" onPress={handleSignup} loading={loading} disabled={loading} style={styles.submitBtn}>
        Submit Request
      </Button>

      <Button mode="text" onPress={() => router.replace('/(auth)/login')}>
        Already have an account? Log in
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60 },
  title: { marginBottom: 8, textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 24 },
  input: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 8, color: '#444' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { marginBottom: 4 },
  empty: { color: '#888', fontStyle: 'italic' },
  submitBtn: { marginTop: 8, marginBottom: 8 },
});