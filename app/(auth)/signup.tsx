import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { TextInput, Text, Chip } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';

// ---- Inline theme: light, minimal, premium (matches Login) ----
const INK = '#15131F';
const INK_MUTED = '#6B6878';
const INK_FAINT = '#A6A3B3';
const ACCENT = '#4F3FE0';
const ACCENT_SOFT = '#EFECFD';
const GOLD = '#C9922B';
const PAGE_BG = '#FAFAFC';
const CARD_BG = '#FFFFFF';
const BORDER = '#ECEAF2';
const INPUT_BG = '#F5F4F9';

type Tower = { id: string; name: string };
type Flat = { id: string; tower_id: string; flat_number: string };

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [selectedTower, setSelectedTower] = useState<string | null>(null);
  const [selectedFlat, setSelectedFlat] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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
        "Your account is pending admin approval. You'll be able to log in once approved.",
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (err) {
      Alert.alert('Something went wrong', 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const inputTheme = { colors: { onSurfaceVariant: INK_MUTED, background: 'transparent', primary: ACCENT } };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>P</Text>
          </View>

          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>PORTL</Text>
            <Text style={styles.brandTagline}>Request access to your community</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Request Access</Text>
            <Text style={styles.cardSubtitle}>Admin approval is required before you can log in</Text>

            <View style={[styles.inputWrap, nameFocused && styles.inputWrapFocused]}>
              <TextInput
                mode="flat"
                label="Full Name"
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                style={styles.input}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                textColor={INK}
                theme={inputTheme}
                left={<TextInput.Icon icon="account-outline" color={nameFocused ? ACCENT : INK_FAINT} />}
              />
            </View>

            <View style={[styles.inputWrap, emailFocused && styles.inputWrapFocused]}>
              <TextInput
                mode="flat"
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                style={styles.input}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                textColor={INK}
                theme={inputTheme}
                left={<TextInput.Icon icon="email-outline" color={emailFocused ? ACCENT : INK_FAINT} />}
              />
            </View>

            <View style={[styles.inputWrap, phoneFocused && styles.inputWrapFocused]}>
              <TextInput
                mode="flat"
                label="Phone (optional)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                style={styles.input}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                textColor={INK}
                theme={inputTheme}
                left={<TextInput.Icon icon="phone-outline" color={phoneFocused ? ACCENT : INK_FAINT} />}
              />
            </View>

            <View style={[styles.inputWrap, passwordFocused && styles.inputWrapFocused]}>
              <TextInput
                mode="flat"
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                style={styles.input}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                textColor={INK}
                theme={inputTheme}
                left={<TextInput.Icon icon="lock-outline" color={passwordFocused ? ACCENT : INK_FAINT} />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    color={INK_FAINT}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                }
              />
            </View>

            <Text style={styles.sectionLabel}>Select Tower</Text>
            <View style={styles.chipRow}>
              {towers.length === 0 && <Text style={styles.empty}>No towers set up yet — contact admin</Text>}
              {towers.map((t) => {
                const selected = selectedTower === t.id;
                return (
                  <Chip
                    key={t.id}
                    selected={selected}
                    onPress={() => { setSelectedTower(t.id); setSelectedFlat(null); }}
                    style={[styles.chip, selected && styles.chipSelected]}
                    textStyle={[styles.chipText, selected && styles.chipTextSelected]}
                    selectedColor={GOLD}
                  >
                    {t.name}
                  </Chip>
                );
              })}
            </View>

            {selectedTower && (
              <>
                <Text style={styles.sectionLabel}>Select Flat</Text>
                <View style={styles.chipRow}>
                  {flatsForTower.length === 0 && (
                    <Text style={styles.empty}>No flats in this tower yet — contact admin</Text>
                  )}
                  {flatsForTower.map((f) => {
                    const selected = selectedFlat === f.id;
                    return (
                      <Chip
                        key={f.id}
                        selected={selected}
                        onPress={() => setSelectedFlat(f.id)}
                        style={[styles.chip, selected && styles.chipSelected]}
                        textStyle={[styles.chipText, selected && styles.chipTextSelected]}
                        selectedColor={GOLD}
                      >
                        {f.flat_number}
                      </Chip>
                    );
                  })}
                </View>
              </>
            )}

            <Pressable onPress={handleSignup} disabled={loading} style={{ marginTop: 10 }}>
              <View style={styles.loginButton}>
                {loading ? (
                  <Text style={styles.loginButtonLabel}>Submitting…</Text>
                ) : (
                  <Text style={styles.loginButtonLabel}>Submit Request</Text>
                )}
              </View>
            </Pressable>

            <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.signupLinkWrap}>
              <Text style={styles.signupLinkLabel}>Already have an account? Log in →</Text>
            </Pressable>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerNote}>Your request will be reviewed by an admin</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },

  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 64, paddingBottom: 60 },

  logoMark: {
    alignSelf: 'center',
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: INK,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  logoLetter: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  brandBlock: { alignItems: 'center', marginBottom: 24 },
  brandName: { fontSize: 22, fontWeight: '800', color: INK, letterSpacing: 4 },
  brandTagline: { fontSize: 13, color: INK_MUTED, marginTop: 6 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    shadowColor: '#151329',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  cardTitle: { fontSize: 21, fontWeight: '700', color: INK, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: INK_MUTED, marginBottom: 22, lineHeight: 19 },

  inputWrap: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 14,
  },
  inputWrapFocused: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_SOFT,
  },
  input: { backgroundColor: 'transparent' },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: INK_MUTED, marginBottom: 10, marginTop: 4, letterSpacing: 0.3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: ACCENT_SOFT,
    borderColor: ACCENT,
  },
  chipText: { color: INK_MUTED },
  chipTextSelected: { color: INK, fontWeight: '600' },
  empty: { color: INK_FAINT, fontStyle: 'italic', fontSize: 13 },

  loginButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  loginButtonLabel: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  signupLinkWrap: { alignItems: 'center', marginTop: 16, paddingVertical: 4 },
  signupLinkLabel: { color: GOLD, fontSize: 13, fontWeight: '600' },

  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 26 },
  footerNote: { color: INK_FAINT, fontSize: 12 },
});