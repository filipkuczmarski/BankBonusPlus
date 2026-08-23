
import { supabase } from '@/lib/supabase';
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
  } | null;
};

type Task = {
  id: string;
  promotion_id: string;
  title: string;
  description: string | null;
  task_order: number;
};

type UserTaskProgress = {
  id: string;
  user_id: string;
  task_id: string;
  completed: boolean;
};

type PromotionWithProgress = Promotion & {
  progress: number;
  completedTasks: number;
  totalTasks: number;
};

export default function HomeScreen() {
  const [promotions, setPromotions] = useState<
    PromotionWithProgress[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const loadPromotions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      /*
       * 1. Pobieramy zalogowanego użytkownika.
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error('USER ERROR:', userError);
      }

      /*
       * Jeżeli użytkownik nie jest zalogowany,
       * nadal możemy pokazać promocje,
       * ale nie będziemy mieli jego postępu.
       */
      const userId = user?.id ?? null;

      /*
       * 2. Pobieramy aktywne promocje
       * razem z bankami.
       */
      const {
        data: promotionsData,
        error: promotionsError,
      } = await supabase
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

      if (promotionsError) {
        console.error(
          'PROMOTIONS ERROR:',
          promotionsError
        );

        setError(
          'Nie udało się pobrać promocji.'
        );

        return;
      }

      const loadedPromotions =
        (promotionsData || []) as Promotion[];

      

      /*
       * Jeżeli nie ma promocji,
       * kończymy tutaj.
       */
      if (loadedPromotions.length === 0) {
        setPromotions([]);
        return;
      }

      /*
       * 3. Pobieramy wszystkie zadania
       * należące do aktywnych promocji.
       */
      const promotionIds =
        loadedPromotions.map(
          (promotion) => promotion.id
        );

      const {
        data: tasksData,
        error: tasksError,
      } = await supabase
        .from('tasks')
        .select(`
          id,
          promotion_id,
          title,
          description,
          task_order
        `)
        .in(
          'promotion_id',
          promotionIds
        );

      if (tasksError) {
        console.error(
          'TASKS ERROR:',
          tasksError
        );

        setError(
          'Nie udało się pobrać zadań promocji.'
        );

        return;
      }

      const loadedTasks =
        (tasksData || []) as Task[];

     

      /*
       * 4. Pobieramy postęp użytkownika
       * z Supabase.
       *
       * NIE używamy tutaj AsyncStorage.
       */
      let loadedProgress: UserTaskProgress[] =
        [];

      if (userId && loadedTasks.length > 0) {
        const taskIds =
          loadedTasks.map(
            (task) => task.id
          );

        const {
          data: progressData,
          error: progressError,
        } = await supabase
          .from('user_task_progress')
          .select(`
            id,
            user_id,
            task_id,
            completed
          `)
          .eq('user_id', userId)
          .in('task_id', taskIds);

        if (progressError) {
          console.error(
            'PROGRESS ERROR:',
            progressError
          );

          setError(
            'Nie udało się pobrać Twojego postępu.'
          );

          return;
        }

        loadedProgress =
          (progressData ||
            []) as UserTaskProgress[];

       
      }

      /*
       * 5. Łączymy promocje,
       * zadania i postęp użytkownika.
       */
      const promotionsWithProgress =
        loadedPromotions.map(
          (promotion) => {
            const promotionTasks =
              loadedTasks.filter(
                (task) =>
                  task.promotion_id ===
                  promotion.id
              );

            const promotionTaskIds =
              promotionTasks.map(
                (task) => task.id
              );

            const completedTasks =
              loadedProgress.filter(
                (progress) =>
                  promotionTaskIds.includes(
                    progress.task_id
                  ) &&
                  progress.completed === true
              ).length;

            const totalTasks =
              promotionTasks.length;

            const progress =
              totalTasks > 0
                ? Math.round(
                    (completedTasks /
                      totalTasks) *
                      100
                  )
                : 0;

            return {
              ...promotion,
              progress,
              completedTasks,
              totalTasks,
            };
          }
        );

      setPromotions(
        promotionsWithProgress
      );
    } catch (err) {
      console.error(
        'LOAD PROMOTIONS ERROR:',
        err
      );

      setError(
        'Wystąpił nieoczekiwany błąd.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * Pierwsze załadowanie Dashboardu.
   */
  React.useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  /*
   * Za każdym razem, gdy wracamy
   * na Dashboard, pobieramy świeży
   * postęp z Supabase.
   */
  useFocusEffect(
    useCallback(() => {
      loadPromotions();
    }, [loadPromotions])
  );

  /*
   * Suma wszystkich możliwych bonusów.
   */
  const totalBonus = promotions.reduce(
    (sum, promotion) =>
      sum + promotion.bonus_amount,
    0
  );

  /*
   * Łączna liczba ukończonych zadań.
   */
  const totalCompletedTasks =
    promotions.reduce(
      (sum, promotion) =>
        sum + promotion.completedTasks,
      0
    );

  /*
   * Łączna liczba wszystkich zadań.
   */
  const totalTasks = promotions.reduce(
    (sum, promotion) =>
      sum + promotion.totalTasks,
    0
  );

  /*
   * Loading.
   */
  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Ładowanie promocji...
        </Text>
      </SafeAreaView>
    );
  }

  /*
   * Error.
   */
  if (error) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
      >
        <Text style={styles.errorText}>
          {error}
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadPromotions}
        >
          <Text
            style={styles.retryButtonText}
          >
            Spróbuj ponownie
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        {/* HEADER */}

        <Text style={styles.logo}>
          BankBonus
        </Text>

        {/* PODSUMOWANIE */}

        <View
          style={styles.summaryCard}
        >
          <Text
            style={styles.summaryLabel}
          >
            Twoje możliwe bonusy
          </Text>

          <Text
            style={styles.summaryAmount}
          >
            {totalBonus} zł
          </Text>

          <Text
            style={
              styles.summaryDescription
            }
          >
            Potencjalnie do zdobycia
          </Text>

          {totalTasks > 0 && (
            <Text
              style={
                styles.summaryProgress
              }
            >
              Wykonane zadania:{' '}
              {totalCompletedTasks} /{' '}
              {totalTasks}
            </Text>
          )}
        </View>

        {/* PROMOCJE */}

        <Text
          style={styles.sectionTitle}
        >
          Aktywne promocje
        </Text>

        {promotions.map(
          (promotion) => (
            <View
              key={promotion.id}
              style={
                styles.promotionCard
              }
            >
              {/* BANK */}

              <Text
                style={styles.bankName}
              >
                {promotion.banks?.name ??
                  'Bank'}
              </Text>

              {/* TYTUŁ */}

              <Text
                style={
                  styles.promotionTitle
                }
              >
                {promotion.title}
              </Text>

              {/* BONUS */}

              <Text
                style={styles.bonus}
              >
                +{promotion.bonus_amount}{' '}
                zł
              </Text>

              {/* PROGRESS BAR */}

              <View
                style={
                  styles.progressBackground
                }
              >
                <View
                  style={[
                    styles.progress,
                    {
                      width: `${promotion.progress}%`,
                    },
                  ]}
                />
              </View>

              {/* PROGRESS */}

              <View
                style={styles.progressRow}
              >
                <Text
                  style={
                    styles.progressText
                  }
                >
                  {promotion.completedTasks}{' '}
                  z{' '}
                  {promotion.totalTasks}{' '}
                  zadań •{' '}
                  {promotion.progress}%
                </Text>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname:
                        '/promotion',
                      params: {
                        id: promotion.id,
                      },
                    })
                  }
                >
                  <Text
                    style={
                      styles.details
                    }
                  >
                    Zobacz →
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        )}

        {/* BRAK PROMOCJI */}

        {promotions.length === 0 && (
          <View
            style={styles.emptyCard}
          >
            <Text
              style={styles.emptyTitle}
            >
              Brak aktywnych promocji
            </Text>

            <Text
              style={styles.emptyText}
            >
              Aktualnie nie znaleziono
              żadnych aktywnych
              promocji.
            </Text>
          </View>
        )}

        {/* WSZYSTKIE PROMOCJE */}

        <TouchableOpacity
          style={styles.allButton}
          activeOpacity={0.7}
        >
          <Text
            style={styles.allButtonText}
          >
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

  summaryProgress: {
    color: '#D1D5DB',
    fontSize: 13,
    marginTop: 14,
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
    flex: 1,
    marginRight: 10,
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
