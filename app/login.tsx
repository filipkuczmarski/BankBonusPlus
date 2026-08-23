import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async () => {
    if (!email.trim() || !password) {
      setError('Podaj email i hasło.');
      return;
    }

    setLoading(true);
    setError(null);

    if (isRegistering) {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        console.error('SIGN UP ERROR:', signUpError);
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      router.replace('/(tabs)');
      return;
    }

    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (signInError) {
      console.error('SIGN IN ERROR:', signInError);
      setError('Nieprawidłowy email lub hasło.');
      setLoading(false);
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={
          Platform.OS === 'ios' ? 'padding' : undefined
        }
      >
        <View style={styles.content}>
          <Text style={styles.logo}>
            BankBonus
          </Text>

          <Text style={styles.title}>
            {isRegistering
              ? 'Utwórz konto'
              : 'Witaj ponownie'}
          </Text>

          <Text style={styles.subtitle}>
            {isRegistering
              ? 'Załóż konto, aby śledzić swoje promocje.'
              : 'Zaloguj się, aby kontynuować.'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Hasło"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {error && (
            <Text style={styles.error}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleAuth}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {isRegistering
                  ? 'Załóż konto'
                  : 'Zaloguj się'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => {
              setIsRegistering((current) => !current);
              setError(null);
            }}
          >
            <Text style={styles.switchText}>
              {isRegistering
                ? 'Masz już konto? Zaloguj się'
                : 'Nie masz konta? Załóż je'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },

  keyboard: {
    flex: 1,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  logo: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 36,
    textAlign: 'center',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 28,
    lineHeight: 22,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },

  error: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 12,
  },

  button: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  switchButton: {
    alignItems: 'center',
    marginTop: 20,
  },

  switchText: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '600',
  },
});