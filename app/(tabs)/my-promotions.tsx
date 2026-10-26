import { syncUserPromotionNotifications } from '@/lib/dynamicNotifications';
import { supabase } from '@/lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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

type DynamicUserTask = {
  id: string;
  user_promotion_id: string;
  completed: boolean;
};

type PromotionWithProgress = UserPromotion & {
  progress: number;
  completedTasks: number;
  totalTasks: number;
};

type StartPromotionTarget = {
  userPromotionId: string;
  promotionId: string;
  promotionTitle: string;
  requireAccountOpenedAt: boolean;
  requirePromotionRegisteredAt: boolean;
};

type StartPromotionValues = {
  accountOpenedAt?: Date;
  promotionRegisteredAt?: Date;
};

const ACCOUNT_PERIOD_TYPES = [
  'account_open_month',
  'full_month_after_open',
  'nth_full_month_after_open',
  'days_after_open',
];

const ACCOUNT_DEADLINE_TYPES = [
  'days_after_account_open',
  'end_of_account_open_month',
  'end_of_nth_full_month',
];

const JOIN_PERIOD_TYPES = [
  'join_month',
];

const JOIN_DEADLINE_TYPES = [
  'days_after_join',
  'end_of_join_month',
];

const formatDateForDatabase = (date: Date) => {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};


export default function MyPromotionsScreen() {
  const [items, setItems] = useState<PromotionWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [startingId, setStartingId] =
    useState<string | null>(null);

  const [startTarget, setStartTarget] =
    useState<StartPromotionTarget | null>(null);

  const [startModalVisible, setStartModalVisible] =
    useState(false);

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

      
const userPromotions: UserPromotion[] = (
  userPromotionsData ?? []
).map((item) => {
  const rawPromotion = item.promotions;

  const promotion = Array.isArray(rawPromotion)
    ? rawPromotion[0] ?? null
    : rawPromotion ?? null;

  const rawBanks = promotion?.banks;

  const bank = Array.isArray(rawBanks)
    ? rawBanks[0] ?? null
    : rawBanks ?? null;

  return {
    ...item,
    promotions: promotion
      ? {
          ...promotion,
          banks: bank,
        }
      : null,
  };
});

  

      if (userPromotions.length === 0) {
        setItems([]);
        return;
      }

      const userPromotionIds = userPromotions.map(
        (item) => item.id
      );

      const {
        data: userTasksData,
        error: userTasksError,
      } = await supabase
        .from('user_tasks')
        .select(`
          id,
          user_promotion_id,
          completed
        `)
        .eq('user_id', user.id)
        .in('user_promotion_id', userPromotionIds);

      if (userTasksError) {
        console.error(
          'USER TASKS ERROR:',
          userTasksError
        );
        setError(
          'Nie udało się pobrać postępu promocji.'
        );
        return;
      }

      const userTasks =
        (userTasksData || []) as DynamicUserTask[];

      const itemsWithProgress =
        userPromotions.map((item) => {
          const promotionTasks =
            userTasks.filter(
              (task) =>
                task.user_promotion_id === item.id
            );

          const totalTasks =
            promotionTasks.length;

          const completedTasks =
            promotionTasks.filter(
              (task) => task.completed
            ).length;

          let progress = 0;

          if (item.status === 'completed') {
            progress = 100;
          } else if (totalTasks > 0) {
            progress = Math.round(
              (completedTasks / totalTasks) * 100
            );
          }

          return {
            ...item,
            progress,
            completedTasks,
            totalTasks,
          };
        });

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
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert(
          'Błąd',
          'Nie znaleziono użytkownika.'
        );
        return;
      }

      const { error: deleteError } =
        await supabase
          .from('user_promotions')
          .delete()
          .eq('id', userPromotionId)
          .eq('user_id', user.id);

      if (deleteError) {
        console.error(
          'REMOVE USER PROMOTION ERROR:',
          deleteError
        );
        Alert.alert(
          'Błąd',
          `Nie udało się usunąć promocji.\n\n${deleteError.message}`
        );
        return;
      }

      setItems((current) =>
        current.filter(
          (item) =>
            item.id !== userPromotionId
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


  const activatePromotion = async (
    target: StartPromotionTarget,
    values: StartPromotionValues = {}
  ) => {
    try {
      setStartingId(target.userPromotionId);

      const updatePayload: Record<string, unknown> = {
        activated_at: new Date().toISOString(),
        schedule_generated_at: null,
      };

      if (values.accountOpenedAt) {
        updatePayload.account_opened_at =
          formatDateForDatabase(
            values.accountOpenedAt
          );
      }

      if (values.promotionRegisteredAt) {
        updatePayload.promotion_registered_at =
          formatDateForDatabase(
            values.promotionRegisteredAt
          );
      }

      const { error: updateDatesError } =
        await supabase
          .from('user_promotions')
          .update(updatePayload)
          .eq('id', target.userPromotionId);

      if (updateDatesError) {
        throw updateDatesError;
      }

      const {
        data: scheduleResult,
        error: scheduleError,
      } = await supabase.rpc(
        'generate_user_promotion_schedule',
        {
          p_user_promotion_id:
            target.userPromotionId,
          p_force: true,
        }
      );

      if (scheduleError) {
        console.error(
          'GENERATE SCHEDULE ERROR:',
          scheduleError
        );

        throw new Error(
          `Nie udało się wygenerować harmonogramu: ${scheduleError.message}`
        );
      }

      console.log(
        'GENERATED SCHEDULE:',
        scheduleResult
      );

      const { error: statusError } =
        await supabase
          .from('user_promotions')
          .update({
            status: 'active',
          })
          .eq('id', target.userPromotionId);

      if (statusError) {
        throw statusError;
      }

      try {
        await syncUserPromotionNotifications(
          target.userPromotionId
        );
      } catch (notificationError) {
        console.warn(
          'NOTIFICATION SYNC WARNING:',
          notificationError
        );
      }

      setStartModalVisible(false);
      setStartTarget(null);

      await loadMyPromotions();

      Alert.alert(
        'Promocja rozpoczęta ✓',
        'Harmonogram został wygenerowany. Od teraz BankBonusPlus może śledzić Twoje warunki i terminy.'
      );
    } catch (startError) {
      console.error(
        'START PROMOTION ERROR:',
        startError
      );

      Alert.alert(
        'Nie udało się rozpocząć promocji',
        startError instanceof Error
          ? startError.message
          : 'Wystąpił nieoczekiwany błąd.'
      );
    } finally {
      setStartingId(null);
    }
  };

  const preparePromotionStart = async (
    item: PromotionWithProgress
  ) => {
    const promotion = item.promotions;

    if (!promotion) {
      return;
    }

    try {
      setStartingId(item.id);

      const [
        periodTemplatesResponse,
        taskTemplatesResponse,
      ] = await Promise.all([
        supabase
          .from('promotion_period_templates')
          .select('period_type')
          .eq(
            'promotion_id',
            promotion.id
          ),

        supabase
          .from('task_templates')
          .select('deadline_type')
          .eq(
            'promotion_id',
            promotion.id
          ),
      ]);

      if (periodTemplatesResponse.error) {
        throw periodTemplatesResponse.error;
      }

      if (taskTemplatesResponse.error) {
        throw taskTemplatesResponse.error;
      }

      const periodTemplates =
        periodTemplatesResponse.data || [];

      const taskTemplates =
        taskTemplatesResponse.data || [];

      if (
        periodTemplates.length === 0 &&
        taskTemplates.length === 0
      ) {
        Alert.alert(
          'Brak harmonogramu',
          'Ta promocja jest zapisana, ale nie ma jeszcze skonfigurowanych nowych template’ów harmonogramu. Dodamy je w punkcie z realnymi promocjami.'
        );

        return;
      }

      const periodTypes =
        periodTemplates
          .map((row) => row.period_type)
          .filter(Boolean);

      const deadlineTypes =
        taskTemplates
          .map((row) => row.deadline_type)
          .filter(Boolean);

      const requireAccountOpenedAt =
        periodTypes.some((type) =>
          ACCOUNT_PERIOD_TYPES.includes(type)
        ) ||
        deadlineTypes.some((type) =>
          ACCOUNT_DEADLINE_TYPES.includes(type)
        );

      const requirePromotionRegisteredAt =
        periodTypes.some((type) =>
          JOIN_PERIOD_TYPES.includes(type)
        ) ||
        deadlineTypes.some((type) =>
          JOIN_DEADLINE_TYPES.includes(type)
        );

      const target: StartPromotionTarget = {
        userPromotionId: item.id,
        promotionId: promotion.id,
        promotionTitle: promotion.title,
        requireAccountOpenedAt,
        requirePromotionRegisteredAt,
      };

      if (
        !requireAccountOpenedAt &&
        !requirePromotionRegisteredAt
      ) {
        await activatePromotion(
          target,
          {}
        );

        return;
      }

      setStartTarget(target);
      setStartModalVisible(true);
    } catch (prepareError) {
      console.error(
        'PREPARE START ERROR:',
        prepareError
      );

      Alert.alert(
        'Błąd',
        'Nie udało się sprawdzić warunków rozpoczęcia tej promocji.'
      );
    } finally {
      setStartingId(null);
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

  const savedItems =
    items.filter(
      (item) => item.status === 'saved'
    );

  const activeItems =
    items.filter(
      (item) => item.status === 'active'
    );

  const completedItems =
    items.filter(
      (item) => item.status === 'completed'
    );

  const activeBonus =
    activeItems.reduce(
      (sum, item) =>
        sum +
        (item.promotions?.bonus_amount ?? 0),
      0
    );

  const completedBonus =
    completedItems.reduce(
      (sum, item) =>
        sum +
        (item.promotions?.bonus_amount ?? 0),
      0
    );

  const openPromotion = (
    promotionId: string
  ) => {
    router.push({
      pathname: '/promotion',
      params: {
        id: promotionId,
      },
    });
  };

  const renderRemoveButton = (
    item: PromotionWithProgress
  ) => {
    const promotion = item.promotions;

    if (!promotion) {
      return null;
    }

    const isRemoving =
      removingId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.removeButton,
          isRemoving &&
            styles.removeButtonDisabled,
        ]}
        disabled={isRemoving}
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
            style={styles.removeButtonText}
          >
            Usuń z moich promocji
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Ładowanie promocji...
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.stateIcon}>
          <Text style={styles.stateIconText}>!</Text>
        </View>

        <Text style={styles.stateTitle}>
          Nie udało się pobrać promocji
        </Text>

        <Text style={styles.stateText}>
          {error}
        </Text>

        <TouchableOpacity
          style={styles.statePrimaryButton}
          activeOpacity={0.85}
          onPress={loadMyPromotions}
        >
          <Text style={styles.statePrimaryButtonText}>
            Spróbuj ponownie
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.stateSecondaryAction}>
            Wróć do dashboardu
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>
          Moje promocje
        </Text>

        <Text style={styles.subtitle}>
          Zapisuj oferty i rozpocznij śledzenie,
          kiedy będziesz gotowy.
        </Text>

        {items.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>
                ☆
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              Nie masz jeszcze promocji
            </Text>

            <Text style={styles.emptyText}>
              Zapisz interesującą ofertę z dashboardu.
              Pojawi się tutaj i uruchomisz ją dopiero,
              kiedy będziesz gotowy.
            </Text>

            <TouchableOpacity
              style={styles.emptyPrimaryButton}
              activeOpacity={0.85}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.emptyPrimaryButtonText}>
                Przeglądaj promocje
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ZAPISANE */}

        {savedItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Zapisane
            </Text>

            {savedItems.map((item) => {
              const promotion =
                item.promotions;

              if (!promotion) {
                return null;
              }

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  activeOpacity={0.88}
                  onPress={() =>
                    openPromotion(
                      promotion.id
                    )
                  }
                >
                  <View style={styles.statusRow}>
                    <Text style={styles.bank}>
                      {promotion.banks?.name ??
                        'Bank'}
                    </Text>

                    <View style={styles.savedBadge}>
                      <Text
                        style={styles.savedBadgeText}
                      >
                        Zapisana
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={styles.promotionTitle}
                  >
                    {promotion.title}
                  </Text>

                  <Text style={styles.bonus}>
                    +{promotion.bonus_amount} zł
                  </Text>

                  <Text
                    style={styles.savedDescription}
                  >
                    Masz tę promocję zapisaną.
                    Wejdź w szczegóły, aby ją
                    rozpocząć lub sprawdzić
                    warunki.
                  </Text>

                  <View
                    style={styles.detailsButton}
                  >
                    <Text style={styles.details}>
                      Zobacz szczegóły →
                    </Text>
                  </View>

                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* W TRAKCIE */}

        {activeItems.length > 0 && (
          <>
            <View style={styles.summaryCard}>
              <Text
                style={styles.summaryLabel}
              >
                Do zdobycia
              </Text>

              <Text
                style={styles.summaryAmount}
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

            <Text style={styles.sectionTitle}>
              W trakcie
            </Text>

            {activeItems.map((item) => {
              const promotion =
                item.promotions;

              if (!promotion) {
                return null;
              }

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  activeOpacity={0.88}
                  onPress={() =>
                    openPromotion(
                      promotion.id
                    )
                  }
                >
                  <View style={styles.statusRow}>
                    <Text style={styles.bank}>
                      {promotion.banks?.name ??
                        'Bank'}
                    </Text>

                    <View style={styles.activeBadge}>
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
                    style={styles.promotionTitle}
                  >
                    {promotion.title}
                  </Text>

                  <Text style={styles.bonus}>
                    +{promotion.bonus_amount} zł
                  </Text>

                  <View
                    style={styles.progressHeader}
                  >
                    <Text
                      style={styles.progressLabel}
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
                          width:
                            `${item.progress}%`,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.bottomRow}>
                    <Text
                      style={styles.progressText}
                    >
                      {item.completedTasks} z{' '}
                      {item.totalTasks} zadań
                    </Text>

                    <Text style={styles.details}>
                      Zobacz →
                    </Text>
                  </View>

                </TouchableOpacity>
              );
            })}
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
              style={styles.completedSummary}
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

            {completedItems.map((item) => {
              const promotion =
                item.promotions;

              if (!promotion) {
                return null;
              }

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  activeOpacity={0.88}
                  onPress={() =>
                    openPromotion(
                      promotion.id
                    )
                  }
                >
                  <View style={styles.statusRow}>
                    <Text style={styles.bank}>
                      {promotion.banks?.name ??
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
                    style={styles.promotionTitle}
                  >
                    {promotion.title}
                  </Text>

                  <Text style={styles.bonus}>
                    +{promotion.bonus_amount} zł
                  </Text>

                  <View
                    style={styles.progressHeader}
                  >
                    <Text
                      style={styles.progressLabel}
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

                  <View style={styles.bottomRow}>
                    <Text
                      style={styles.progressText}
                    >
                      {item.completedTasks} z{' '}
                      {item.totalTasks} zadań
                    </Text>

                    <Text style={styles.details}>
                      Zobacz →
                    </Text>
                  </View>

                </TouchableOpacity>
              );
            })}
          </>
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
    lineHeight: 21,
  },

  summaryCard: {
    backgroundColor: '#111827',
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
    marginTop: 6,
  },

  completedSectionTitle: {
    marginTop: 18,
  },

  completedSummary: {
    backgroundColor: '#DCFCE7',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  bank: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 10,
  },

  savedBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  savedBadgeText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '700',
  },

  activeBadge: {
    backgroundColor: '#DBEAFE',
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
    backgroundColor: '#DCFCE7',
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

  savedDescription: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },

  startButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },

  startButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  startButtonDisabled: {
    opacity: 0.65,
  },

  detailsButton: {
    alignItems: 'center',
    paddingVertical: 5,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },

  progress: {
    height: 8,
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },

  bottomRow: {
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
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },

  removeButton: {
    backgroundColor: '#FEF2F2',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  emptyIconText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2563EB',
  },

  emptyPrimaryButton: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },

  emptyPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
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
    backgroundColor: '#2563EB',
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },

  stateIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  stateIconText: {
    fontSize: 25,
    fontWeight: '900',
    color: '#DC2626',
  },

  stateTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },

  stateText: {
    maxWidth: 320,
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },

  statePrimaryButton: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statePrimaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  stateSecondaryAction: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },

  errorText: {
    color: '#DC2626',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 18,
  },

  retryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
