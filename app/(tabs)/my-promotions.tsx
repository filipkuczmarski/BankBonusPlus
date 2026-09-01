import { supabase } from '@/lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type UserPromotion = {
  id: string;
  status: string;
  joined_at: string;
  completed_at: string | null;
  promotions: {
    id: string;
    title: string;
    bonus_amount: number;
    banks: {
      name: string;
    } | null;
  } | null;
};

type Task = {
  id: string;
  promotion_id: string;
};

type UserTaskProgress = {
  task_id: string;
  completed: boolean;
};

type PromotionWithProgress = UserPromotion & {
  progress: number;
  completedTasks: number;
  totalTasks: number;
};

export default function MyPromotionsScreen() {
  const [items, setItems] = useState<
    PromotionWithProgress[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [removingId, setRemovingId] =
    useState<string | null>(null);

  const loadMyPromotions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('USER ERROR:', userError);
        setError('Nie znaleziono użytkownika.');
        return;
      }

      /*
       * Pobieramy zarówno active,
       * jak i completed.
       */
      const {
        data: userPromotionsData,
        error: promotionsError,
      } = await supabase
        .from('user_promotions')
        .select(`
          id,
          status,
          joined_at,
          completed_at,
          promotions (
            id,
            title,
            bonus_amount,
            banks (
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('joined_at', {
          ascending: false,
        });

      if (promotionsError) {
        console.error(
          'MY PROMOTIONS ERROR:',
          promotionsError
        );

        setError(
          'Nie udało się pobrać Twoich promocji.'
        );

        return;
      }

      const userPromotions =
        (userPromotionsData ||
          []) as UserPromotion[];

      if (userPromotions.length === 0) {
        setItems([]);
        return;
      }

      const promotionIds =
        userPromotions
          .map(
            (item) =>
              item.promotions?.id
          )
          .filter(
            (id): id is string =>
              Boolean(id)
          );

      const {
        data: tasksData,
        error: tasksError,
      } = await supabase
        .from('tasks')
        .select(`
          id,
          promotion_id
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
          'Nie udało się pobrać zadań.'
        );

        return;
      }

      const tasks =
        (tasksData || []) as Task[];

      let progressData: UserTaskProgress[] = [];

      if (tasks.length > 0) {
        const taskIds =
          tasks.map(
            (task) => task.id
          );

        const {
          data,
          error: progressError,
        } = await supabase
          .from('user_task_progress')
          .select(`
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
            'Nie udało się pobrać postępu.'
          );

          return;
        }

        progressData =
          (data ||
            []) as UserTaskProgress[];
      }

      const itemsWithProgress =
        userPromotions.map(
          (item) => {
            const promotion =
              item.promotions;

            if (!promotion) {
              return {
                ...item,
                progress: 0,
                completedTasks: 0,
                totalTasks: 0,
              };
            }

            const promotionTasks =
              tasks.filter(
                (task) =>
                  task.promotion_id ===
                  promotion.id
              );

            const totalTasks =
              promotionTasks.length;

            const completedTasks =
              promotionTasks.filter(
                (task) => {
                  const progressRecord =
                    progressData.find(
                      (progress) =>
                        progress.task_id ===
                        task.id
                    );

                  return (
                    progressRecord?.completed ===
                    true
                  );
                }
              ).length;

            const progress =
              totalTasks > 0
                ? Math.round(
                    (completedTasks /
                      totalTasks) *
                      100
                  )
                : 0;

            return {
              ...item,
              progress,
              completedTasks,
              totalTasks,
            };
          }
        );

      setItems(itemsWithProgress);
    } catch (loadError) {
      console.error(
        'LOAD MY PROMOTIONS ERROR:',
        loadError
      );

      setError(
        'Wystąpił nieoczekiwany błąd.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMyPromotions();
    }, [loadMyPromotions])
  );

  const removeFromMyPromotions = async (
    userPromotionId: string
  ) => {
    try {
      setRemovingId(userPromotionId);

      const {
        error: deleteError,
      } = await supabase
        .from('user_promotions')
        .delete()
        .eq('id', userPromotionId);

      if (deleteError) {
        console.error(
          'REMOVE USER PROMOTION ERROR:',
          deleteError
        );

        Alert.alert(
          'Błąd',
          'Nie udało się usunąć promocji.'
        );

        return;
      }

      setItems((current) =>
        current.filter(
          (item) =>
            item.id !==
            userPromotionId
        )
      );
    } catch (removeError) {
      console.error(
        'REMOVE PROMOTION ERROR:',
        removeError
      );

      Alert.alert(
        'Błąd',
        'Wystąpił nieoczekiwany błąd.'
      );
    } finally {
      setRemovingId(null);
    }
  };

  const confirmRemove = (
    userPromotionId: string,
    promotionTitle: string
  ) => {
    Alert.alert(
      'Usuń promocję?',
      `Czy na pewno chcesz usunąć „${promotionTitle}” z Moich promocji?`,
      [
        {
          text: 'Anuluj',
          style: 'cancel',
        },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: () =>
            removeFromMyPromotions(
              userPromotionId
            ),
        },
      ]
    );
  };

  const activeItems =
    items.filter(
      (item) =>
        item.status === 'active'
    );

  const completedItems =
    items.filter(
      (item) =>
        item.status === 'completed'
    );

  const activeBonus =
    activeItems.reduce(
      (sum, item) =>
        sum +
        (item.promotions
          ?.bonus_amount ?? 0),
      0
    );

  const completedBonus =
    completedItems.reduce(
      (sum, item) =>
        sum +
        (item.promotions
          ?.bonus_amount ?? 0),
      0
    );

  if (loading) {
    return (
      <SafeAreaView
        style={styles.center}
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

  if (error) {
    return (
      <SafeAreaView
        style={styles.center}
      >
        <Text
          style={styles.errorText}
        >
          {error}
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadMyPromotions}
        >
          <Text
            style={
              styles.retryButtonText
            }
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
        <Text style={styles.title}>
          Moje promocje
        </Text>

        <Text
          style={styles.subtitle}
        >
          Śledź postęp swoich promocji.
        </Text>

        {items.length === 0 && (
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Nie masz jeszcze promocji
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Dodaj promocję z Home,
              aby pojawiła się tutaj.
            </Text>

            <TouchableOpacity
              style={
                styles.homeButton
              }
              onPress={() =>
                router.push('/(tabs)')
              }
            >
              <Text
                style={
                  styles.homeButtonText
                }
              >
                Przejdź do promocji
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* W TRAKCIE */}

        {activeItems.length > 0 && (
          <>
            <View
              style={
                styles.summaryCard
              }
            >
              <Text
                style={
                  styles.summaryLabel
                }
              >
                Do zdobycia
              </Text>

              <Text
                style={
                  styles.summaryAmount
                }
              >
                {activeBonus} zł
              </Text>

              <Text
                style={
                  styles.summaryDescription
                }
              >
                {activeItems.length}{' '}
                {activeItems.length === 1
                  ? 'promocja w trakcie'
                  : 'promocje w trakcie'}
              </Text>
            </View>

            <Text
              style={
                styles.sectionTitle
              }
            >
              W trakcie
            </Text>

            {activeItems.map(
              (item) => {
                const promotion =
                  item.promotions;

                if (!promotion) {
                  return null;
                }

                const isRemoving =
                  removingId === item.id;

                return (
                  <View
                    key={item.id}
                    style={styles.card}
                  >
                    <View
                      style={
                        styles.statusRow
                      }
                    >
                      <Text
                        style={
                          styles.bank
                        }
                      >
                        {promotion
                          .banks
                          ?.name ??
                          'Bank'}
                      </Text>

                      <View
                        style={
                          styles.activeBadge
                        }
                      >
                        <Text
                          style={
                            styles.activeBadgeText
                          }
                        >
                          W trakcie
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={
                        styles.promotionTitle
                      }
                    >
                      {
                        promotion.title
                      }
                    </Text>

                    <Text
                      style={
                        styles.bonus
                      }
                    >
                      +
                      {
                        promotion.bonus_amount
                      }{' '}
                      zł
                    </Text>

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
                        Postęp
                      </Text>

                      <Text
                        style={
                          styles.progressPercent
                        }
                      >
                        {item.progress}%
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
                            width: `${item.progress}%`,
                          },
                        ]}
                      />
                    </View>

                    <View
                      style={
                        styles.bottomRow
                      }
                    >
                      <Text
                        style={
                          styles.progressText
                        }
                      >
                        {
                          item.completedTasks
                        }{' '}
                        z{' '}
                        {
                          item.totalTasks
                        }{' '}
                        zadań
                      </Text>

                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname:
                              '/promotion',
                            params: {
                              id:
                                promotion.id,
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

                    <TouchableOpacity
                      style={[
                        styles.removeButton,
                        isRemoving &&
                          styles.removeButtonDisabled,
                      ]}
                      disabled={
                        isRemoving
                      }
                      onPress={() =>
                        confirmRemove(
                          item.id,
                          promotion.title
                        )
                      }
                    >
                      {isRemoving ? (
                        <ActivityIndicator
                          size="small"
                          color="#DC2626"
                        />
                      ) : (
                        <Text
                          style={
                            styles.removeButtonText
                          }
                        >
                          Usuń z moich
                          promocji
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }
            )}
          </>
        )}

        {/* UKOŃCZONE */}

        {completedItems.length > 0 && (
          <>
            <Text
              style={[
                styles.sectionTitle,
                styles.completedSectionTitle,
              ]}
            >
              Ukończone
            </Text>

            <View
              style={
                styles.completedSummary
              }
            >
              <Text
                style={
                  styles.completedSummaryLabel
                }
              >
                Ukończone bonusy
              </Text>

              <Text
                style={
                  styles.completedSummaryAmount
                }
              >
                {completedBonus} zł
              </Text>
            </View>

            {completedItems.map(
              (item) => {
                const promotion =
                  item.promotions;

                if (!promotion) {
                  return null;
                }

                return (
                  <View
                    key={item.id}
                    style={styles.card}
                  >
                    <View
                      style={
                        styles.statusRow
                      }
                    >
                      <Text
                        style={
                          styles.bank
                        }
                      >
                        {promotion
                          .banks
                          ?.name ??
                          'Bank'}
                      </Text>

                      <View
                        style={
                          styles.completedStatusBadge
                        }
                      >
                        <Text
                          style={
                            styles.completedStatusText
                          }
                        >
                          ✓ Ukończona
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={
                        styles.promotionTitle
                      }
                    >
                      {
                        promotion.title
                      }
                    </Text>

                    <Text
                      style={
                        styles.bonus
                      }
                    >
                      +
                      {
                        promotion.bonus_amount
                      }{' '}
                      zł
                    </Text>

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
                        Postęp
                      </Text>

                      <Text
                        style={
                          styles.completedPercent
                        }
                      >
                        100%
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
                            width: '100%',
                          },
                        ]}
                      />
                    </View>

                    <View
                      style={
                        styles.bottomRow
                      }
                    >
                      <Text
                        style={
                          styles.progressText
                        }
                      >
                        {
                          item.totalTasks
                        }{' '}
                        z{' '}
                        {
                          item.totalTasks
                        }{' '}
                        zadań
                      </Text>

                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname:
                              '/promotion',
                            params: {
                              id:
                                promotion.id,
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
                );
              }
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#F5F6FA',
    },

    content: {
      padding: 20,
      paddingBottom: 40,
    },

    title: {
      fontSize: 30,
      fontWeight: '800',
      color: '#111827',
    },

    subtitle: {
      fontSize: 15,
      color: '#6B7280',
      marginTop: 6,
      marginBottom: 24,
    },

    summaryCard: {
      backgroundColor:
        '#111827',
      borderRadius: 20,
      padding: 22,
      marginBottom: 26,
    },

    summaryLabel: {
      color: '#D1D5DB',
      fontSize: 14,
    },

    summaryAmount: {
      color: '#FFFFFF',
      fontSize: 34,
      fontWeight: '800',
      marginTop: 4,
    },

    summaryDescription: {
      color: '#9CA3AF',
      fontSize: 13,
      marginTop: 6,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#111827',
      marginBottom: 12,
    },

    completedSectionTitle: {
      marginTop: 18,
    },

    completedSummary: {
      backgroundColor:
        '#DCFCE7',
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
    },

    completedSummaryLabel: {
      color: '#166534',
      fontSize: 13,
      fontWeight: '600',
    },

    completedSummaryAmount: {
      color: '#166534',
      fontSize: 26,
      fontWeight: '800',
      marginTop: 4,
    },

    card: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      padding: 20,
      marginBottom: 14,
    },

    statusRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    bank: {
      fontSize: 18,
      fontWeight: '700',
      color: '#111827',
      flex: 1,
      marginRight: 10,
    },

    activeBadge: {
      backgroundColor:
        '#DBEAFE',
      borderRadius: 8,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },

    activeBadgeText: {
      color: '#1D4ED8',
      fontSize: 11,
      fontWeight: '700',
    },

    completedStatusBadge: {
      backgroundColor:
        '#DCFCE7',
      borderRadius: 8,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },

    completedStatusText: {
      color: '#166534',
      fontSize: 11,
      fontWeight: '700',
    },

    promotionTitle: {
      fontSize: 14,
      color: '#6B7280',
      marginTop: 4,
    },

    bonus: {
      fontSize: 16,
      fontWeight: '700',
      color: '#16A34A',
      marginTop: 8,
      marginBottom: 18,
    },

    progressHeader: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      marginBottom: 8,
    },

    progressLabel: {
      fontSize: 13,
      color: '#6B7280',
      fontWeight: '600',
    },

    progressPercent: {
      fontSize: 13,
      color: '#2563EB',
      fontWeight: '700',
    },

    completedPercent: {
      fontSize: 13,
      color: '#16A34A',
      fontWeight: '700',
    },

    progressBackground: {
      height: 8,
      backgroundColor:
        '#E5E7EB',
      borderRadius: 4,
      overflow: 'hidden',
    },

    progress: {
      height: 8,
      backgroundColor:
        '#2563EB',
      borderRadius: 4,
    },

    bottomRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginTop: 12,
    },

    progressText: {
      fontSize: 13,
      color: '#6B7280',
    },

    details: {
      color: '#2563EB',
      fontSize: 14,
      fontWeight: '600',
    },

    removeButton: {
      backgroundColor:
        '#FEF2F2',
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 14,
    },

    removeButtonDisabled: {
      opacity: 0.6,
    },

    removeButtonText: {
      color: '#DC2626',
      fontSize: 14,
      fontWeight: '600',
    },

    emptyCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      padding: 20,
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

    homeButton: {
      backgroundColor:
        '#2563EB',
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 18,
    },

    homeButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },

    center: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
      backgroundColor:
        '#F5F6FA',
      padding: 20,
    },

    loadingText: {
      marginTop: 12,
      color: '#6B7280',
    },

    errorText: {
      color: '#DC2626',
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 18,
    },

    retryButton: {
      backgroundColor:
        '#2563EB',
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },

    retryButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });