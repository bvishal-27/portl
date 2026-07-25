import { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, Text, Button } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';

const INK = '#15131F';
const INK_MUTED = '#6B6878';
const INK_FAINT = '#A6A3B3';
const ACCENT = '#4F3FE0';
const ACCENT_SOFT = '#EFECFD';
const PAGE_BG = '#EFEEF5';
const CARD_BG = '#FFFFFF';
const BORDER = '#ECEAF2';
const INPUT_BG = '#F5F4F9';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Focus States to match Login & Signup interaction
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Missing info', 'Please enter and confirm your new password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Password Reset Failed', error.message);
    } else {
      Alert.alert(
        'Password Updated! 🎉',
        'Your password has been reset successfully. You can now log in with your new password.',
        [
          {
            text: 'Log In Now',
            onPress: async () => {
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    }
  };

  const inputTheme = {
    colors: { onSurfaceVariant: INK_MUTED, background: 'transparent', primary: ACCENT },
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -100}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Logo & Branding Block */}
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>P</Text>
          </View>

          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>PORTL</Text>
            <Text style={styles.brandTagline}>Security & Access Management</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Set New Password</Text>
            <Text style={styles.cardSubtitle}>
              Please enter your new password below to update your account.
            </Text>

            <View style={[styles.inputWrap, passwordFocused && styles.inputWrapFocused]}>
              <TextInput
                mode="flat"
                label="New Password"
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
                left={
                  <TextInput.Icon
                    icon="lock-outline"
                    color={passwordFocused ? ACCENT : INK_FAINT}
                  />
                }
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    color={INK_FAINT}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                }
              />
            </View>

            <View style={[styles.inputWrap, confirmFocused && styles.inputWrapFocused]}>
              <TextInput
                mode="flat"
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                style={styles.input}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                textColor={INK}
                theme={inputTheme}
                cursorColor={ACCENT}
                selectionColor={ACCENT_SOFT}
                left={
                  <TextInput.Icon
                    icon="lock-check-outline"
                    color={confirmFocused ? ACCENT : INK_FAINT}
                  />
                }
              />
            </View>

            <Button
              mode="contained"
              buttonColor={ACCENT}
              textColor="#fff"
              loading={loading}
              disabled={loading}
              onPress={handleUpdatePassword}
              style={{ borderRadius: 14, marginTop: 10 }}
              contentStyle={{ paddingVertical: 6 }}
            >
              Update Password
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },

  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 48,
    paddingBottom: 48,
  },

  logoMark: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoLetter: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  brandBlock: { alignItems: 'center', marginBottom: 32 },
  brandName: { fontSize: 24, fontWeight: '800', color: INK, letterSpacing: 4 },
  brandTagline: { fontSize: 13, color: INK_MUTED, marginTop: 6, textAlign: 'center' },

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
});