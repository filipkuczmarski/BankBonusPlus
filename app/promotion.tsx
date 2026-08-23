
import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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
  start_date: string | null;
  end_date: string | null;
  terms_url: string | null;
  application_url: string | null;
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

export default function PromotionScreen() {
  const { id } = useLocalSearchParams();

  const promotionId = Array.isArray(id) ? id[0] : id;

  const [promotion, setPromotion] =
    useState<Promotion | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);

  const [completed, setCompleted] =
    useState<boolean[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [savingTask, setSavingTask] =
    useState<string | null>(null);

  /*
   * Pobieramy promocję, zadania
   * oraz postęp użytkownika.
   */
  useEffect(() => {
    const loadPromotion = async () => {
      try {
        if (!promotionId) {
          setError('Nie znaleziono promocji.');
          setLoading(false);
          return;
        }

        /*
         * 1. Aktualny użytkownik
         */
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          console.error('USER ERROR:', userError);

          setError(
            'Nie znaleziono zalogowanego użytkownika.'
          );

          setLoading(false);
          return;
        }

        /*
         * 2. Promocja
         */
        const {
          data: promotionData,
          error: promotionError,
        } = await supabase
          .from('promotions')
          .select(`
            id,
            title,
            bonus_amount,
            description,
            start_date,
            end_date,
            terms_url,
            application_url,
            status,
            banks (
              name,
              logo_url
            )
          `)
          .eq('id', promotionId)
          .single();

        if (promotionError) {
          console.error(
            'PROMOTION ERROR:',
            promotionError
          );

          setError(
            'Nie udało się pobrać promocji.'
          );

          setLoading(false);
          return;
        }

        /*
         * 3. Zadania
         */
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
          .eq('promotion_id', promotionId)
          .order('task_order', {
            ascending: true,
          });

        if (tasksError) {
          console.error(
            'TASKS ERROR:',
            tasksError
          );

          setError(
            'Nie udało się pobrać zadań.'
          );

          setLoading(false);
          return;
        }

        const loadedTasks =
          (tasksData || []) as Task[];

        /*
         * 4. Postęp użytkownika
         */
        let loadedProgress: UserTaskProgress[] = [];

        if (loadedTasks.length > 0) {
          const taskIds = loadedTasks.map(
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
            .eq('user_id', user.id)
            .in('task_id', taskIds);

          if (progressError) {
            console.error(
              'PROGRESS ERROR:',
              progressError
            );

            setError(
              'Nie udało się pobrać Twojego postępu.'
            );

            setLoading(false);
            return;
          }

          loadedProgress =
            (progressData ||
              []) as UserTaskProgress[];
        }

        /*
         * 5. Zamieniamy progress na boolean[]
         */
        const initialCompleted =
          loadedTasks.map((task) => {
            const progressRecord =
              loadedProgress.find(
                (item) =>
                  item.task_id === task.id
              );

            return (
              progressRecord?.completed ??
              false
            );
          });

        setPromotion(
          promotionData as Promotion
        );

        setTasks(loadedTasks);

        setCompleted(initialCompleted);

        setLoading(false);
      } catch (loadError) {
        console.error(
          'LOAD PROMOTION ERROR:',
          loadError
        );

        setError(
          'Wystąpił nieoczekiwany błąd.'
        );

        setLoading(false);
      }
    };

    loadPromotion();
  }, [promotionId]);

  /*
   * Zaznaczanie / odznaczanie zadania.
   */
  const toggleTask = async (index: number) => {
    const task = tasks[index];

    if (!task) {
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('USER ERROR:', userError);
      return;
    }

    const newValue = !completed[index];

    setSavingTask(task.id);

    /*
     * Natychmiastowa aktualizacja UI.
     */
    setCompleted((current) =>
      current.map((value, i) =>
        i === index ? newValue : value
      )
    );

    try {
      /*
       * Sprawdzamy istniejący rekord.
       */
      const {
        data: existingProgress,
        error: existingError,
      } = await supabase
        .from('user_task_progress')
        .select('id')
        .eq('user_id', user.id)
        .eq('task_id', task.id)
        .maybeSingle();

      if (existingError) {
        console.error(
          'CHECK PROGRESS ERROR:',
          existingError
        );

        setCompleted((current) =>
          current.map((value, i) =>
            i === index ? !newValue : value
          )
        );

        return;
      }

      /*
       * UPDATE
       */
      if (existingProgress) {
        const {
          error: updateError,
        } = await supabase
          .from('user_task_progress')
          .update({
            completed: newValue,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            existingProgress.id
          );

        if (updateError) {
          console.error(
            'UPDATE PROGRESS ERROR:',
            updateError
          );

          setCompleted((current) =>
            current.map((value, i) =>
              i === index
                ? !newValue
                : value
            )
          );

          return;
        }
      } else {
        /*
         * INSERT
         */
        const {
          error: insertError,
        } = await supabase
          .from('user_task_progress')
          .insert({
            user_id: user.id,
            task_id: task.id,
            completed: newValue,
          });

        if (insertError) {
          console.error(
            'INSERT PROGRESS ERROR:',
            insertError
          );

          setCompleted((current) =>
            current.map((value, i) =>
              i === index
                ? !newValue
                : value
            )
          );

          return;
        }
      }
    } catch (saveError) {
      console.error(
        'SAVE PROGRESS ERROR:',
        saveError
      );

      setCompleted((current) =>
        current.map((value, i) =>
          i === index ? !newValue : value
        )
      );
    } finally {
      setSavingTask(null);
    }
  };

  /*
   * Liczymy postęp.
   */
  const completedCount =
    completed.filter(Boolean).length;

  const progress =
    tasks.length > 0
      ? Math.round(
          (completedCount /
            tasks.length) *
            100
        )
      : 0;

  /*
   * Liczymy ile dni zostało do końca.
   */
  const getDaysRemaining = (
    endDate: string | null
  ) => {
    if (!endDate) {
      return null;
    }

    const end = new Date(endDate);

    const now = new Date();

    const difference =
      end.getTime() -
      now.getTime();

    const days = Math.ceil(
      difference /
        (1000 * 60 * 60 * 24)
    );

    return days;
  };

  /*
   * Format daty.
   */
  const formatDate = (
    date: string | null
  ) => {
    if (!date) {
      return '—';
    }

    const parsedDate =
      new Date(date);

    return parsedDate.toLocaleDateString(
      'pl-PL'
    );
  };

  const daysRemaining =
    getDaysRemaining(
      promotion?.end_date ?? null
    );

  /*
   * Otwieranie linku.
   */
  const openUrl = async (
    url: string | null
  ) => {
    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error(
        'OPEN URL ERROR:',
        error
      );
    }
  };

  /*
   * Loading
   */
  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={styles.loadingText}
        >
          Ładowanie promocji...
        </Text>
      </SafeAreaView>
    );
  }

  /*
   * Error
   */
  if (error || !promotion) {
    return (
      <SafeAreaView
        style={
          styles.loadingContainer
        }
      >
        <Text
          style={styles.errorText}
        >
          {error ||
            'Nie znaleziono promocji.'}
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.back()}
        >
          <Text
            style={
              styles.retryButtonText
            }
          >
            Wróć
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  /*
   * Główny ekran.
   */
  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        {/* POWRÓT */}

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text
            style={styles.backText}
          >
            ← Wróć
          </Text>
        </TouchableOpacity>

        {/* BANK */}

        <Text style={styles.bank}>
          {promotion.banks?.name ??
            'Bank'}
        </Text>

        {/* TYTUŁ */}

        <Text style={styles.title}>
          {promotion.title}
        </Text>

        {/* BONUS */}

        <Text style={styles.bonus}>
          +{promotion.bonus_amount} zł
        </Text>

        {/* OPIS */}

        {promotion.description && (
          <Text
            style={
              styles.description
            }
          >
            {promotion.description}
          </Text>
        )}

        {/* TERMIN PROMOCJI */}

        <View
          style={
            styles.dateCard
          }
        >
          <View
            style={
              styles.dateRow
            }
          >
            <View>
              <Text
                style={
                  styles.dateLabel
                }
              >
                Początek promocji
              </Text>

              <Text
                style={
                  styles.dateValue
                }
              >
                {formatDate(
                  promotion.start_date
                )}
              </Text>
            </View>

            <View
              style={
                styles.dateRight
              }
            >
              <Text
                style={
                  styles.dateLabel
                }
              >
                Koniec promocji
              </Text>

              <Text
                style={
                  styles.dateValue
                }
              >
                {formatDate(
                  promotion.end_date
                )}
              </Text>
            </View>
          </View>

          {daysRemaining !== null && (
            <View
              style={[
                styles.remainingBadge,
                daysRemaining <= 3 &&
                  styles.remainingBadgeUrgent,
                daysRemaining < 0 &&
                  styles.remainingBadgeExpired,
              ]}
            >
              <Text
                style={
                  styles.remainingText
                }
              >
                {daysRemaining < 0
                  ? 'Promocja zakończona'
                  : daysRemaining === 0
                  ? 'Promocja kończy się dzisiaj'
                  : daysRemaining === 1
                  ? 'Został 1 dzień'
                  : `Zostało ${daysRemaining} dni`}
              </Text>
            </View>
          )}
        </View>

        {/* POSTĘP */}

        <View
          style={
            styles.progressCard
          }
        >
          <View
            style={
              styles.progressHeader
            }
          >
            <Text
              style={
                styles.progressLabel
              }
            >
              Twój postęp
            </Text>

            <Text
              style={
                styles.progressPercent
              }
            >
              {progress}%
            </Text>
          </View>

          <View
            style={
              styles.progressBackground
            }
          >
            <View
              style={[
                styles.progress,
                {
                  width: `${progress}%`,
                },
              ]}
            />
          </View>

          <Text
            style={
              styles.progressText
            }
          >
            {completedCount} z{' '}
            {tasks.length} wykonanych
          </Text>
        </View>

        {/* ZADANIA */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Co musisz zrobić?
        </Text>

        {tasks.map(
          (task, index) => (
            <TouchableOpacity
              key={task.id}
              style={[
                styles.task,
                savingTask ===
                  task.id &&
                  styles.taskSaving,
              ]}
              onPress={() =>
                toggleTask(index)
              }
              activeOpacity={0.7}
              disabled={
                savingTask === task.id
              }
            >
              <View
                style={[
                  styles.checkbox,
                  completed[index] &&
                    styles.checkboxCompleted,
                ]}
              >
                {completed[index] && (
                  <Text
                    style={
                      styles.checkmark
                    }
                  >
                    ✓
                  </Text>
                )}
              </View>

              <View
                style={
                  styles.taskContent
                }
              >
                <Text
                  style={[
                    styles.taskText,
                    completed[index] &&
                      styles.taskCompleted,
                  ]}
                >
                  {task.title}
                </Text>

                {task.description && (
                  <Text
                    style={
                      styles.taskDescription
                    }
                  >
                    {task.description}
                  </Text>
                )}

                {savingTask ===
                  task.id && (
                  <Text
                    style={
                      styles.savingText
                    }
                  >
                    Zapisywanie...
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )
        )}

        {/* LINK DO APLIKACJI */}

        {promotion.application_url && (
          <TouchableOpacity
            style={
              styles.applicationButton
            }
            activeOpacity={0.8}
            onPress={() =>
              openUrl(
                promotion.application_url
              )
            }
          >
            <Text
              style={
                styles.applicationButtonText
              }
            >
              Przejdź do promocji →
            </Text>
          </TouchableOpacity>
        )}

        {/* REGULAMIN */}

        {promotion.terms_url && (
          <TouchableOpacity
            style={
              styles.termsButton
            }
            activeOpacity={0.7}
            onPress={() =>
              openUrl(
                promotion.terms_url
              )
            }
          >
            <Text
              style={
                styles.termsButtonText
              }
            >
              Zobacz regulamin promocji
            </Text>
          </TouchableOpacity>
        )}

        {/* SUCCESS */}

        {progress === 100 && (
          <View
            style={
              styles.successCard
            }
          >
            <Text
              style={
                styles.successTitle
              }
            >
              🎉 Wszystko gotowe!
            </Text>

            <Text
              style={
                styles.successText
              }
            >
              Spełniłeś wszystkie
              warunki promocji.
            </Text>
          </View>
        )}
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
    paddingBottom: 50,
  },

  backButton: {
    marginBottom: 24,
  },

  backText: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: '600',
  },

  bank: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
  },

  bonus: {
    fontSize: 20,
    fontWeight: '700',
    color: '#16A34A',
    marginTop: 8,
  },

  description: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginTop: 10,
    marginBottom: 20,
  },

  dateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },

  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  dateRight: {
    alignItems: 'flex-end',
  },

  dateLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 5,
  },

  dateValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  remainingBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 16,
    alignItems: 'center',
  },

  remainingBadgeUrgent: {
    backgroundColor: '#FEF3C7',
  },

  remainingBadgeExpired: {
    backgroundColor: '#FEE2E2',
  },

  remainingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },

  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 30,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  progressLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  progressPercent: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },

  progressBackground: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
  },

  progress: {
    height: 10,
    backgroundColor: '#2563EB',
    borderRadius: 5,
  },

  progressText: {
    marginTop: 10,
    fontSize: 13,
    color: '#6B7280',
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },

  task: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  taskSaving: {
    opacity: 0.6,
  },

  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxCompleted: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },

  checkmark: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },

  taskContent: {
    flex: 1,
  },

  taskText: {
    fontSize: 16,
    color: '#111827',
  },

  taskCompleted: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },

  taskDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 18,
  },

  savingText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 5,
  },

  applicationButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 12,
  },

  applicationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  termsButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },

  termsButtonText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },

  successCard: {
    backgroundColor: '#DCFCE7',
    borderRadius: 18,
    padding: 20,
    marginTop: 10,
  },

  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#166534',
  },

  successText: {
    fontSize: 14,
    color: '#166534',
    marginTop: 6,
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