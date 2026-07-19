import { useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, Text } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

// ---- Inline theme: light, minimal, premium ----
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

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);

  const buttonScale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const pressOut = () => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

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
      .select('role, approved')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      Alert.alert('Error', 'No profile found for this user');
      setLoading(false);
      return;
    }

    if (!profile.approved) {
      Alert.alert('Pending Approval', 'Your account is still awaiting admin approval. Please check back later.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    setSession(data.user.id, profile.role);

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus === 'granted') {
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          await supabase.from('profiles').update({ push_token: tokenData.data }).eq('id', data.user.id);
        } catch (err) {
          console.log('Push token error:', err);
        }
      }
    }

    setLoading(false);
    router.replace('/');
  };

  const inputTheme = { colors: { onSurfaceVariant: INK_MUTED, background: 'transparent', primary: ACCENT } };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>P</Text>
          </View>

          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>PORTL</Text>
            <Text style={styles.brandTagline}>Your community, one tap away</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to continue</Text>

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
                cursorColor={ACCENT}
                selectionColor={ACCENT_SOFT}
                left={<TextInput.Icon icon="email-outline" color={emailFocused ? ACCENT : INK_FAINT} />}
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
                cursorColor={ACCENT}
                selectionColor={ACCENT_SOFT}
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

            <Pressable
              onPress={handleLogin}
              onPressIn={pressIn}
              onPressOut={pressOut}
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              <Animated.View style={[styles.loginButton, { transform: [{ scale: buttonScale }] }]}>
                {loading ? (
                  <Text style={styles.loginButtonLabel}>Signing in…</Text>
                ) : (
                  <Text style={styles.loginButtonLabel}>Log In</Text>
                )}
              </Animated.View>
            </Pressable>

            <Pressable onPress={() => router.push('/(auth)/signup')} style={styles.signupLinkWrap}>
              <Text style={styles.signupLinkLabel}>New resident? Request access →</Text>
            </Pressable>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.footerDot} />
            <Text style={styles.footerNote}>Secured access for verified residents only</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },

  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 72, paddingBottom: 60 },

  logoMark: {
    alignSelf: 'center',
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: ACCENT,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  logoLetter: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  brandBlock: { alignItems: 'center', marginBottom: 32 },
  brandName: { fontSize: 24, fontWeight: '800', color: INK, letterSpacing: 4 },
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
  cardSubtitle: { fontSize: 14, color: INK_MUTED, marginBottom: 22 },

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

  loginButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  loginButtonLabel: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  signupLinkWrap: { alignItems: 'center', marginTop: 18, paddingVertical: 4 },
  signupLinkLabel: { color: GOLD, fontSize: 13, fontWeight: '600' },

  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 26, gap: 6 },
  footerDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#4ADE80' },
  footerNote: { color: INK_FAINT, fontSize: 12 },
});