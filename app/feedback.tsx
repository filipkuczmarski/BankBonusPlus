import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';

type FeedbackType =
  | 'idea'
  | 'bug'
  | 'promotion'
  | 'other';

const TYPES: {
  key: FeedbackType;
  label: string;
}[] = [
  {
    key: 'idea',
    label: 'Pomysł',
  },
  {
    key: 'bug',
    label: 'Błąd',
  },
  {
    key: 'promotion',
    label: 'Promocja',
  },
  {
    key: 'other',
    label: 'Inne',
  },
];

export default function FeedbackScreen() {
  const [type, setType] =
    useState<FeedbackType>('idea');

  const [message, setMessage] =
    useState('');

  const [sending, setSending] =
    useState(false);

  const trimmedMessage =
    useMemo(
      () => message.trim(),
      [message]
    );

  const canSend =
    trimmedMessage.length >= 5 &&
    !sending;

  const submitFeedback =
    async () => {
      if (!canSend) {
        return;
      }

      try {
        setSending(true);

        const {
          data: {
            user,
          },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          throw new Error(
            'Nie znaleziono zalogowanego użytkownika.'
          );
        }

        const {
          error,
        } =
          await supabase
            .from('feedback')
            .insert({
              user_id: user.id,
              type,
              message:
                trimmedMessage,
              app_source:
                'mobile',
            });

        if (error) {
          throw error;
        }

        setMessage('');

        Alert.alert(
          'Dzięki! 💙',
          'Twoja wiadomość została zapisana. To naprawdę pomaga rozwijać BankBonusPlus.',
          [
            {
              text: 'OK',
              onPress: () =>
                router.back(),
            },
          ]
        );
      } catch (error) {
        console.error(
          'FEEDBACK ERROR:',
          error
        );

        Alert.alert(
          'Nie udało się wysłać',
          'Spróbuj ponownie za chwilę.'
        );
      } finally {
        setSending(false);
      }
    };

  return (
    <SafeAreaView
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            styles.content
          }
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={styles.back}
            >
              ← Wróć
            </Text>
          </TouchableOpacity>

          <Text
            style={styles.eyebrow}
          >
            FEEDBACK
          </Text>

          <Text
            style={styles.title}
          >
            Co możemy zrobić lepiej?
          </Text>

          <Text
            style={styles.subtitle}
          >
            Zgłoś błąd, pomysł albo
            problem z konkretną
            promocją. Na etapie testów
            każda taka wiadomość jest
            bardzo cenna.
          </Text>

          <Text
            style={styles.label}
          >
            Czego dotyczy wiadomość?
          </Text>

          <View
            style={styles.types}
          >
            {TYPES.map(item => {
              const selected =
                type ===
                item.key;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.typeButton,
                    selected &&
                      styles.typeButtonSelected,
                  ]}
                  activeOpacity={0.8}
                  onPress={() =>
                    setType(
                      item.key
                    )
                  }
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      selected &&
                        styles.typeButtonTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text
            style={styles.label}
          >
            Wiadomość
          </Text>

          <TextInput
            value={message}
            onChangeText={
              setMessage
            }
            placeholder="Np. przydałoby się pokazywać..."
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
            maxLength={1500}
            style={styles.input}
          />

          <Text
            style={styles.counter}
          >
            {message.length}/1500
          </Text>

          <View
            style={styles.infoCard}
          >
            <Text
              style={styles.infoTitle}
            >
              Co zapisujemy?
            </Text>

            <Text
              style={styles.infoText}
            >
              Typ zgłoszenia, treść,
              identyfikator Twojego
              konta i datę wysłania.
              Nie wpisuj haseł, numerów
              kart ani innych danych
              bankowych.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              !canSend &&
                styles.sendButtonDisabled,
            ]}
            disabled={!canSend}
            activeOpacity={0.85}
            onPress={
              submitFeedback
            }
          >
            {sending ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.sendButtonText
                }
              >
                Wyślij feedback
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    flex: {
      flex: 1,
    },

    container: {
      flex: 1,
      backgroundColor:
        '#F7F8FA',
    },

    content: {
      padding: 20,
      paddingBottom: 40,
    },

    back: {
      fontSize: 13,
      fontWeight: '800',
      color: '#2563EB',
      marginBottom: 30,
    },

    eyebrow: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
      color: '#2563EB',
      marginBottom: 8,
    },

    title: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '900',
      color: '#111827',
      marginBottom: 10,
    },

    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: '#6B7280',
      marginBottom: 30,
    },

    label: {
      fontSize: 13,
      fontWeight: '800',
      color: '#374151',
      marginBottom: 10,
    },

    types: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 26,
    },

    typeButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
    },

    typeButtonSelected: {
      backgroundColor:
        '#2563EB',
      borderColor:
        '#2563EB',
    },

    typeButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#4B5563',
    },

    typeButtonTextSelected: {
      color: '#FFFFFF',
    },

    input: {
      minHeight: 170,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#D1D5DB',
      borderRadius: 16,
      padding: 15,
      fontSize: 15,
      lineHeight: 22,
      color: '#111827',
    },

    counter: {
      marginTop: 7,
      textAlign: 'right',
      fontSize: 11,
      color: '#9CA3AF',
    },

    infoCard: {
      marginTop: 22,
      backgroundColor:
        '#EFF6FF',
      borderRadius: 15,
      padding: 14,
    },

    infoTitle: {
      fontSize: 12,
      fontWeight: '900',
      color: '#1D4ED8',
      marginBottom: 4,
    },

    infoText: {
      fontSize: 12,
      lineHeight: 18,
      color: '#1E40AF',
    },

    sendButton: {
      marginTop: 24,
      minHeight: 54,
      backgroundColor:
        '#2563EB',
      borderRadius: 15,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal: 18,
    },

    sendButtonDisabled: {
      opacity: 0.45,
    },

    sendButtonText: {
      fontSize: 15,
      fontWeight: '900',
      color: '#FFFFFF',
    },
  });
