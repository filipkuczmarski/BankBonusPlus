
import { sendTestNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setEmail(user?.email ?? null);
      setLoading(false);
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('SIGN OUT ERROR:', error);
      setLoggingOut(false);
      return;
    }

    // _layout.tsx wykryje zmianę sesji
    // i automatycznie przeniesie użytkownika do /login.
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            ← Wróć
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          Profil
        </Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {email?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>

          <Text style={styles.label}>
            Zalogowany jako
          </Text>

          <Text style={styles.email}>
            {email ?? 'Brak adresu email'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={sendTestNotification}
          style={styles.notificationButton}
          activeOpacity={0.8}
        >
          <Text style={styles.notificationButtonText}>
            🔔 Wyślij testowe powiadomienie
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <Text style={styles.logoutText}>
              Wyloguj się
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },

  content: {
    flex: 1,
    padding: 20,
  },

  backButton: {
    marginBottom: 24,
  },

  backText: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: '600',
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 24,
  },

  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },

  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },

  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },

  email: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },

    notificationButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },

  notificationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },

  logoutText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '700',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
  },
});
