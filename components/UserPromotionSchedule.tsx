
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  syncUserPromotionNotifications,
} from '@/lib/dynamicNotifications';

import UserTaskProgress from '@/components/UserTaskProgress';
import { supabase } from '@/lib/supabase';

type TaskType =
  | 'checkbox'
  | 'counter'
  | 'amount'
  | 'balance'
  | 'login'
  | 'confirmation'
  | 'ongoing';

type UserTask = {
  id: string;
  user_promotion_id: string;
  user_period_id: string | null;
  title: string;
  description: string | null;
  task_type: TaskType;
  task_order: number;
  target_count: number | null;
  current_count: number;
  target_amount: number | null;
  current_amount: number;
  calculated_due_date: string | null;
  is_required: boolean;
  completed: boolean;
  completed_at: string | null;
};

type UserPeriod = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  reward_amount: number | null;
  status:
    | 'upcoming'
    | 'active'
    | 'completed'
    | 'failed';
  completed_at: string | null;
};

type Props = {
  promotionId: string;
  onTaskChanged?: () => void;
};

const parseDate = (date: string) => {
  return new Date(`${date}T12:00:00`);
};

const formatDate = (date: string | null) => {
  if (!date) return '';

  return parseDate(date).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getPeriodDisplayStatus = (
  period: UserPeriod,
  tasks: UserTask[]
) => {
  const requiredTasks = tasks.filter(
    task => task.is_required
  );

  const allRequiredCompleted =
    requiredTasks.length > 0 &&
    requiredTasks.every(
      task => task.completed
    );

  if (allRequiredCompleted) {
    return 'completed';
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  if (period.start_date) {
    const startDate =
      parseDate(period.start_date);

    if (startDate > today) {
      return 'upcoming';
    }
  }

  if (period.end_date) {
    const endDate =
      parseDate(period.end_date);

    if (
      endDate < today &&
      !allRequiredCompleted
    ) {
      return 'failed';
    }
  }

  return 'active';
};

export default function UserPromotionSchedule({
  promotionId,
  onTaskChanged,
}: Props) {
  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [userPromotionId, setUserPromotionId] =
    useState<string | null>(null);

  const [periods, setPeriods] =
    useState<UserPeriod[]>([]);

  const [tasks, setTasks] =
    useState<UserTask[]>([]);

  const loadSchedule =
    useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: userData,
          error: userError,
        } =
          await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        const user =
          userData.user;

        if (!user) {
          setUserPromotionId(null);
          setPeriods([]);
          setTasks([]);
          return;
        }

        const {
          data: userPromotion,
          error: userPromotionError,
        } = await supabase
          .from('user_promotions')
          .select(
            `
            id,
            account_opened_at,
            schedule_generated_at
          `
          )
          .eq(
            'user_id',
            user.id
          )
          .eq(
            'promotion_id',
            promotionId
          )
          .maybeSingle();

        if (userPromotionError) {
          throw userPromotionError;
        }

        if (!userPromotion) {
          setUserPromotionId(null);
          setPeriods([]);
          setTasks([]);
          return;
        }

        setUserPromotionId(
          userPromotion.id
        );

        const {
          data: periodsData,
          error: periodsError,
        } = await supabase
          .from(
            'user_promotion_periods'
          )
          .select(
            `
            id,
            title,
            start_date,
            end_date,
            reward_amount,
            status,
            completed_at
          `
          )
          .eq(
            'user_promotion_id',
            userPromotion.id
          )
          .order(
            'start_date',
            {
              ascending: true,
              nullsFirst: false,
            }
          );

        if (periodsError) {
          throw periodsError;
        }

        const {
          data: tasksData,
          error: tasksError,
        } = await supabase
          .from('user_tasks')
          .select(
            `
            id,
            user_promotion_id,
            user_period_id,
            title,
            description,
            task_type,
            task_order,
            target_count,
            current_count,
            target_amount,
            current_amount,
            calculated_due_date,
            is_required,
            completed,
            completed_at
          `
          )
          .eq(
            'user_promotion_id',
            userPromotion.id
          )
          .order(
            'task_order',
            {
              ascending: true,
            }
          );

        if (tasksError) {
          throw tasksError;
        }

        setPeriods(
          (periodsData || []) as UserPeriod[]
        );

        setTasks(
          (tasksData || []) as UserTask[]
        );

        await syncUserPromotionNotifications(
  userPromotion.id
);
      } catch (err: any) {
        console.error(
          'SCHEDULE LOAD ERROR:',
          err
        );

        setError(
          err?.message ||
            'Nie udało się pobrać harmonogramu.'
        );
      } finally {
        setLoading(false);
      }
    }, [promotionId]);

useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect -- pobranie harmonogramu po zmianie promocji
  loadSchedule();
}, [loadSchedule]);

  const standaloneTasks =
    useMemo(
      () =>
        tasks.filter(
          task =>
            task.user_period_id === null
        ),
      [tasks]
    );

  const rewardSummary = useMemo(() => {
    let earned = 0;
    let total = 0;

    for (const period of periods) {
      const reward =
        Number(period.reward_amount) || 0;

      total += reward;

      const periodTasks = tasks.filter(
        task =>
          task.user_period_id === period.id
      );

      const requiredTasks =
        periodTasks.filter(
          task => task.is_required
        );

      const allRequiredCompleted =
        requiredTasks.length > 0 &&
        requiredTasks.every(
          task => task.completed
        );

      if (allRequiredCompleted) {
        earned += reward;
      }
    }

    return {
      earned,
      total,
      remaining: Math.max(
        total - earned,
        0
      ),
    };
  }, [periods, tasks]);

  const updateTask = (
  updatedTask: UserTask
) => {
  setTasks(previous =>
    previous.map(task =>
      task.id === updatedTask.id
        ? {
            ...task,
            ...updatedTask,
          }
        : task
    )
  );

  onTaskChanged?.();
};

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />

        <Text
          style={styles.loadingText}
        >
          Ładowanie harmonogramu...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>
          Nie udało się pobrać harmonogramu
        </Text>

        <Text style={styles.errorText}>
          {error}
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={loadSchedule}
        >
          <Text
            style={styles.retryButtonText}
          >
            Spróbuj ponownie
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!userPromotionId) {
    return null;
  }

  if (
    periods.length === 0 &&
    tasks.length === 0
  ) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>
          Harmonogram nie jest jeszcze gotowy
        </Text>

        <Text style={styles.emptyText}>
          Dla tej promocji nie wygenerowano
          jeszcze indywidualnego harmonogramu.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {rewardSummary.total > 0 && (
        <View style={styles.rewardSummaryCard}>
          <Text style={styles.rewardSummaryEyebrow}>
            TWOJA PREMIA
          </Text>

          <View style={styles.rewardSummaryRow}>
            <View>
              <Text style={styles.rewardSummaryLabel}>
                Zdobyte
              </Text>

              <Text style={styles.rewardSummaryEarned}>
                {rewardSummary.earned.toLocaleString(
                  'pl-PL'
                )}{' '}
                zł
              </Text>
            </View>

            <View style={styles.rewardSummaryRight}>
              <Text style={styles.rewardSummaryLabel}>
                Łącznie
              </Text>

              <Text style={styles.rewardSummaryTotal}>
                {rewardSummary.total.toLocaleString(
                  'pl-PL'
                )}{' '}
                zł
              </Text>
            </View>
          </View>

          <View style={styles.rewardProgressTrack}>
            <View
              style={[
                styles.rewardProgressFill,
                {
                  width: `${
                    rewardSummary.total > 0
                      ? Math.min(
                          (rewardSummary.earned /
                            rewardSummary.total) *
                            100,
                          100
                        )
                      : 0
                  }%`,
                },
              ]}
            />
          </View>

          <Text style={styles.rewardRemaining}>
            Pozostało do zdobycia:{' '}
            {rewardSummary.remaining.toLocaleString(
              'pl-PL'
            )}{' '}
            zł
          </Text>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.eyebrow}>
          TWÓJ PLAN
        </Text>

        <Text style={styles.heading}>
          Harmonogram promocji
        </Text>

        <Text style={styles.subheading}>
          Warunki są podzielone na konkretne
          etapy i okresy.
        </Text>
      </View>

      {standaloneTasks.length > 0 && (
        <View style={styles.periodBlock}>
          <View style={styles.periodHeader}>
            <View style={styles.periodTitleArea}>
              <Text
                style={styles.periodLabel}
              >
                NA START
              </Text>

              <Text
                style={styles.periodTitle}
              >
                Warunki początkowe
              </Text>
            </View>
          </View>

          <View style={styles.tasks}>
            {standaloneTasks.map(
              task => (
                <UserTaskProgress
                  key={task.id}
                  task={task}
                  onChange={
                    updateTask
                  }
                />
              )
            )}
          </View>
        </View>
      )}

      {periods.map(period => {
        const periodTasks =
          tasks.filter(
            task =>
              task.user_period_id ===
              period.id
          );

        const requiredTasks =
          periodTasks.filter(
            task =>
              task.is_required
          );

        const completedRequired =
          requiredTasks.filter(
            task =>
              task.completed
          ).length;

        const progress =
          requiredTasks.length > 0
            ? Math.round(
                (completedRequired /
                  requiredTasks.length) *
                  100
              )
            : 0;

        const status =
          getPeriodDisplayStatus(
            period,
            periodTasks
          );

        const isCompleted =
          status === 'completed';

        const isUpcoming =
          status === 'upcoming';

        const isFailed =
          status === 'failed';

        return (
          <View
            key={period.id}
            style={[
              styles.periodBlock,

              isCompleted &&
                styles.periodCompleted,

              isUpcoming &&
                styles.periodUpcoming,

              isFailed &&
                styles.periodFailed,
            ]}
          >
            <View
              style={styles.periodHeader}
            >
              <View
                style={
                  styles.periodTitleArea
                }
              >
                <Text
                  style={[
                    styles.periodLabel,

                    isCompleted &&
                      styles.greenText,

                    isFailed &&
                      styles.redText,
                  ]}
                >
                  {isCompleted
                    ? 'UKOŃCZONE'
                    : isUpcoming
                      ? 'NADCHODZI'
                      : isFailed
                        ? 'TERMIN MINĄŁ'
                        : 'AKTYWNE'}
                </Text>

                <Text
                  style={
                    styles.periodTitle
                  }
                >
                  {period.title}
                </Text>

                {(period.start_date ||
                  period.end_date) && (
                  <Text
                    style={
                      styles.periodDates
                    }
                  >
                    {period.start_date
                      ? formatDate(
                          period.start_date
                        )
                      : '—'}

                    {' → '}

                    {period.end_date
                      ? formatDate(
                          period.end_date
                        )
                      : '—'}
                  </Text>
                )}
              </View>

              {period.reward_amount !== null &&
                Number(period.reward_amount) > 0 && (
                  <View
                    style={[
                      styles.rewardBadge,

                      isCompleted &&
                        styles.rewardBadgeEarned,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rewardValue,

                        isCompleted &&
                          styles.rewardValueEarned,
                      ]}
                    >
                      {isCompleted ? '✓ ' : '+'}

                      {Number(
                        period.reward_amount
                      ).toLocaleString('pl-PL')}{' '}
                      zł
                    </Text>
                  </View>
                )}
            </View>

            {requiredTasks.length > 0 && (
              <View
                style={
                  styles.progressSection
                }
              >
                <View
                  style={
                    styles.progressTop
                  }
                >
                  <Text
                    style={
                      styles.progressLabel
                    }
                  >
                    Postęp etapu
                  </Text>

                  <Text
                    style={
                      styles.progressValue
                    }
                  >
                    {progress}%
                  </Text>
                </View>

                <View
                  style={
                    styles.progressTrack
                  }
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progress}%`,
                      },
                    ]}
                  />
                </View>

                <Text
                  style={
                    styles.progressDetail
                  }
                >
                  {completedRequired} z{' '}
                  {requiredTasks.length}{' '}
                  warunków spełnionych
                </Text>
              </View>
            )}

            {isUpcoming &&
              period.start_date && (
                <View
                  style={
                    styles.infoBanner
                  }
                >
                  <Text
                    style={
                      styles.infoBannerText
                    }
                  >
                    Ten etap rozpocznie się{' '}
                    {formatDate(
                      period.start_date
                    )}
                  </Text>
                </View>
              )}

            <View style={styles.tasks}>
              {periodTasks.length ===
              0 ? (
                <Text
                  style={
                    styles.noTasksText
                  }
                >
                  Brak warunków w tym etapie.
                </Text>
              ) : (
                periodTasks.map(
                  task => (
                    <UserTaskProgress
                      key={task.id}
                      task={task}
                      onChange={
                        updateTask
                      }
                    />
                  )
                )
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 28,
  },

  rewardSummaryCard: {
    marginBottom: 24,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#111827',
  },

  rewardSummaryEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#9CA3AF',
  },

  rewardSummaryRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },

  rewardSummaryRight: {
    alignItems: 'flex-end',
  },

  rewardSummaryLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  rewardSummaryEarned: {
    marginTop: 3,
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  rewardSummaryTotal: {
    marginTop: 3,
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  rewardProgressTrack: {
    marginTop: 18,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#374151',
  },

  rewardProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },

  rewardRemaining: {
    marginTop: 10,
    fontSize: 12,
    color: '#D1D5DB',
  },

  sectionHeader: {
    marginBottom: 16,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#6B7280',
  },

  heading: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },

  subheading: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
  },

  loading: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 10,
  },

  loadingText: {
    fontSize: 13,
    color: '#6B7280',
  },

  errorCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
  },

  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
  },

  errorText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: '#B91C1C',
  },

  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#991B1B',
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  emptyCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  emptyText: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },

  periodBlock: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  periodCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },

  periodUpcoming: {
    backgroundColor: '#F9FAFB',
  },

  periodFailed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },

  periodHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  periodTitleArea: {
    flex: 1,
  },

  periodLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#2563EB',
  },

  greenText: {
    color: '#15803D',
  },

  redText: {
    color: '#B91C1C',
  },

  periodTitle: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },

  periodDates: {
    marginTop: 5,
    fontSize: 13,
    color: '#6B7280',
  },

  rewardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
  },

  rewardValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },

  rewardBadgeEarned: {
    backgroundColor: '#166534',
  },

  rewardValueEarned: {
    color: '#FFFFFF',
  },

  progressSection: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },

  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },

  progressValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },

  progressTrack: {
    marginTop: 9,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#16A34A',
  },

  progressDetail: {
    marginTop: 7,
    fontSize: 12,
    color: '#6B7280',
  },

  infoBanner: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
  },

  infoBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },

  tasks: {
    marginTop: 16,
  },

  noTasksText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});