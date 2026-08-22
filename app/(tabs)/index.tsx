import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Promotion = {
  id: string;
  title: string;
  bonus_amount: number;
  description: string | null;
  status: string;
  banks: {
    name: string;
    logo_url: string | null;
  };
};

type PromotionProgress = {
  completed: boolean[];
};

type PromotionWithProgress = Promotion & {
  progress: number;
};

export default function HomeScreen() {
  const [promotions, setPromotions] = useState<PromotionWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPromotions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: supabaseError } = await supabase
        .from('promotions')
        .select(`
          id,
          title,
          bonus_amount,
          description,
          status,
          banks (
            name,
            logo_url
          )
        `)
        .eq('status', 'active');

      if (supabaseError) {
        console.error('SUPABASE ERROR:', supabaseError);
        setError('Nie udało się pobrać promocji.');
        setLoading(false);
        return;
      }

      const promotionsFromSupabase = (data || []) as Promotion[];

      const promotionsWithProgress: PromotionWithProgress[] =
        await Promise.all(
          promotionsFromSupabase.map(async (promotion) => {
            const storageKey = `bankbonus_progress_${promotion.id}`;

            try {
              const saved = await AsyncStorage.getItem(storageKey);

              console.log('DASHBOARD READING:', {
  storageKey,
  saved,
});

              if (!saved) {
                return {
                  ...promotion,
                  progress: 0,
                };
              }

              

              
              const parsed = JSON.parse(saved);

                const completed = Array.isArray(parsed)
                ? parsed
              : Array.isArray(parsed.completed)
               ? parsed.completed
              : [];
              const completedCount =
                completed.filter(Boolean).length;

              /*
               * Jeżeli nie mamy jeszcze zadań w Dashboardzie,
               * nie znamy ich całkowitej liczby.
               *
               * W tym momencie korzystamy z liczby zapisanych
               * elementów checklisty.
               */
              const progress =
                completed.length > 0
                  ? Math.round(
                      (completedCount / completed.length) * 100
                    )
                  : 0;

              return {
                ...promotion,
                progress,
              };
            } catch (storageError) {
              console.error(
                'ASYNC STORAGE READ ERROR:',
                storageError
              );

              return {
                ...promotion,
                progress: 0,
              };
            }
          })
        );

      setPromotions(promotionsWithProgress);
    } catch (err) {
      console.error('LOAD PROMOTIONS ERROR:', err);
      setError('Wystąpił nieoczekiwany błąd.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  /*
   * Odświeżamy Dashboard po powrocie z ekranu promocji.
   * Dzięki temu po zaznaczeniu zadań i kliknięciu "Wróć"
   * Dashboard pokaże aktualny postęp.
   */
  useFocusEffect(
  React.useCallback(() => {
    loadPromotions();
  }, [loadPromotions])
);
  /*
   * Suma wszystkich możliwych bonusów.
   */
  const totalBonus = promotions.reduce(
    (sum, promotion) => sum + promotion.bonus_amount,
    0
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Ładowanie promocji...
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          {error}
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadPromotions}
        >
          <Text style={styles.retryButtonText}>
            Spróbuj ponownie
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.logo}>
          BankBonus
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            Twoje możliwe bonusy
          </Text>

          <Text style={styles.summaryAmount}>
            {totalBonus} zł
          </Text>

          <Text style={styles.summaryDescription}>
            Potencjalnie do zdobycia
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          Aktywne promocje
        </Text>

        {promotions.map((promotion) => (
          <View
            key={promotion.id}
            style={styles.promotionCard}
          >
            <Text style={styles.bankName}>
              {promotion.banks.name}
            </Text>

            <Text style={styles.promotionTitle}>
              {promotion.title}
            </Text>

            <Text style={styles.bonus}>
              +{promotion.bonus_amount} zł
            </Text>

            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progress,
                  {
                    width: `${promotion.progress}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.progressText}>
                Postęp: {promotion.progress}%
              </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: '/promotion',
                    params: {
                      id: promotion.id,
                    },
                  })
                }
              >
                <Text style={styles.details}>
                  Zobacz →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {promotions.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Brak aktywnych promocji
            </Text>

            <Text style={styles.emptyText}>
              Aktualnie nie znaleziono żadnych aktywnych promocji.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.allButton}
          activeOpacity={0.7}
        >
          <Text style={styles.allButtonText}>
            Zobacz wszystkie promocje
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  logo: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 24,
  },

  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
  },

  summaryLabel: {
    color: '#D1D5DB',
    fontSize: 15,
    marginBottom: 8,
  },

  summaryAmount: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
  },

  summaryDescription: {
    color: '#9CA3AF',
    marginTop: 6,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },

  promotionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },

  bankName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  promotionTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },

  bonus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16A34A',
    marginTop: 8,
    marginBottom: 16,
  },

  progressBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },

  progress: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },

  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },

  progressText: {
    fontSize: 13,
    color: '#6B7280',
  },

  details: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },

  allButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    padding: 17,
    alignItems: 'center',
    marginTop: 10,
  },

  allButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },

  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 6,
    lineHeight: 20,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
  },

  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 20,
  },

  retryButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});