
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type TimelinePeriod = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  reward_amount: number | null;
};

type TimelineTask = {
  id: string;
  title: string;
  calculated_due_date: string | null;
  completed: boolean;
};

type TimelineItem =
  | {
      id: string;
      type: 'period_start';
      date: string;
      title: string;
      subtitle: string | null;
      completed: boolean;
    }
  | {
      id: string;
      type: 'period_end';
      date: string;
      title: string;
      subtitle: string | null;
      completed: boolean;
    }
  | {
      id: string;
      type: 'task';
      date: string;
      title: string;
      subtitle: string | null;
      completed: boolean;
    };

type Props = {
  promotionId: string;
};

const parseDate = (date: string) =>
  new Date(`${date}T12:00:00`);

const formatDate = (date: string) =>
  parseDate(date).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

const daysDifference = (date: string) => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const target = parseDate(date);

  return Math.round(
    (target.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
};

const getRelativeLabel = (date: string) => {
  const days = daysDifference(date);

  if (days === 0) return 'Dzisiaj';
  if (days === 1) return 'Jutro';
  if (days === -1) return 'Wczoraj';

  if (days > 1) {
    return `Za ${days} dni`;
  }

  return `${Math.abs(days)} dni temu`;
};

export default function UserPromotionTimeline({
  promotionId,
}: Props) {
  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [periods, setPeriods] =
    useState<TimelinePeriod[]>([]);

  const [tasks, setTasks] =
    useState<TimelineTask[]>([]);

  const loadTimeline = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const user = userData.user;

      if (!user) {
        setPeriods([]);
        setTasks([]);
        return;
      }

      const {
        data: userPromotion,
        error: promotionError,
      } = await supabase
        .from('user_promotions')
        .select('id')
        .eq('user_id', user.id)
        .eq('promotion_id', promotionId)
        .maybeSingle();

      if (promotionError) {
        throw promotionError;
      }

      if (!userPromotion) {
        setPeriods([]);
        setTasks([]);
        return;
      }

      const {
        data: periodsData,
        error: periodsError,
      } = await supabase
        .from('user_promotion_periods')
        .select(`
          id,
          title,
          start_date,
          end_date,
          reward_amount
        `)
        .eq(
          'user_promotion_id',
          userPromotion.id
        );

      if (periodsError) {
        throw periodsError;
      }

      const {
        data: tasksData,
        error: tasksError,
      } = await supabase
        .from('user_tasks')
        .select(`
          id,
          title,
          calculated_due_date,
          completed
        `)
        .eq(
          'user_promotion_id',
          userPromotion.id
        );

      if (tasksError) {
        throw tasksError;
      }

      setPeriods(
        (periodsData || []) as TimelinePeriod[]
      );

      setTasks(
        (tasksData || []) as TimelineTask[]
      );
    } catch (err: any) {
      console.error(
        'TIMELINE ERROR:',
        err
      );

      setError(
        err?.message ||
          'Nie udało się pobrać kalendarza.'
      );
    } finally {
      setLoading(false);
    }
  }, [promotionId]);

 useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect -- pobranie kalendarza po zmianie promocji
  loadTimeline();
}, [loadTimeline]);

  const items = useMemo(() => {
    const timeline: TimelineItem[] = [];

    for (const period of periods) {
      if (period.start_date) {
        timeline.push({
          id: `period-start-${period.id}`,
          type: 'period_start',
          date: period.start_date,
          title: `Start: ${period.title}`,
          subtitle:
            period.reward_amount &&
            Number(period.reward_amount) > 0
              ? `Etap za ${Number(
                  period.reward_amount
                ).toLocaleString('pl-PL')} zł`
              : null,
          completed:
            daysDifference(
              period.start_date
            ) < 0,
        });
      }

      if (period.end_date) {
        timeline.push({
          id: `period-end-${period.id}`,
          type: 'period_end',
          date: period.end_date,
          title: `Koniec: ${period.title}`,
          subtitle: 'Koniec okresu promocji',
          completed:
            daysDifference(
              period.end_date
            ) < 0,
        });
      }
    }

    for (const task of tasks) {
      if (!task.calculated_due_date) {
        continue;
      }

      timeline.push({
        id: `task-${task.id}`,
        type: 'task',
        date: task.calculated_due_date,
        title: task.title,
        subtitle: task.completed
          ? 'Warunek wykonany'
          : 'Termin wykonania warunku',
        completed: task.completed,
      });
    }

    return timeline.sort(
      (a, b) =>
        parseDate(a.date).getTime() -
        parseDate(b.date).getTime()
    );
  }, [periods, tasks]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>
          Ładowanie kalendarza...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>
          Nie udało się pobrać kalendarza
        </Text>

        <Text style={styles.errorText}>
          {error}
        </Text>
      </View>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>
        KALENDARZ
      </Text>

      <Text style={styles.heading}>
        Najważniejsze terminy
      </Text>

      <Text style={styles.description}>
        Tutaj zobaczysz starty etapów,
        deadline’y i końce okresów promocji.
      </Text>

      <View style={styles.timeline}>
        {items.map((item, index) => {
          const difference =
            daysDifference(item.date);

          const isPast =
            difference < 0;

          const isToday =
            difference === 0;

          const isTask =
            item.type === 'task';

          return (
            <View
              key={item.id}
              style={styles.timelineRow}
            >
              <View style={styles.markerColumn}>
                <View
                  style={[
                    styles.marker,
                    item.completed &&
                      styles.markerCompleted,
                    isToday &&
                      styles.markerToday,
                  ]}
                />

                {index <
                  items.length - 1 && (
                  <View
                    style={
                      styles.timelineLine
                    }
                  />
                )}
              </View>

              <View
                style={[
                  styles.eventCard,

                  item.completed &&
                    styles.eventCompleted,

                  isToday &&
                    styles.eventToday,

                  isPast &&
                    !item.completed &&
                    styles.eventPast,
                ]}
              >
                <View
                  style={
                    styles.eventTopRow
                  }
                >
                  <View
                    style={
                      styles.eventTitleArea
                    }
                  >
                    <Text
                      style={
                        styles.relativeLabel
                      }
                    >
                      {getRelativeLabel(
                        item.date
                      )}
                    </Text>

                    <Text
                      style={
                        styles.eventDate
                      }
                    >
                      {formatDate(
                        item.date
                      )}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.typeBadge,

                      isTask
                        ? styles.taskBadge
                        : styles.periodBadge,
                    ]}
                  >
                    <Text
                      style={
                        styles.typeBadgeText
                      }
                    >
                      {isTask
                        ? 'ZADANIE'
                        : 'ETAP'}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.eventTitle,

                    item.completed &&
                      styles.eventTitleCompleted,
                  ]}
                >
                  {item.completed &&
                    item.type ===
                      'task' &&
                    '✓ '}

                  {item.title}
                </Text>

                {item.subtitle && (
                  <Text
                    style={
                      styles.eventSubtitle
                    }
                  >
                    {item.subtitle}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
    marginBottom: 10,
  },

  eyebrow: {
    fontSize: 11,
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

  description: {
    marginTop: 6,
    marginBottom: 20,
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
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
  },

  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
  },

  errorText: {
    marginTop: 5,
    fontSize: 13,
    color: '#B91C1C',
  },

  timeline: {
    marginTop: 2,
  },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  markerColumn: {
    width: 30,
    alignItems: 'center',
  },

  marker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 18,
    backgroundColor: '#D1D5DB',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },

  markerCompleted: {
    backgroundColor: '#16A34A',
  },

  markerToday: {
    backgroundColor: '#2563EB',
  },

  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },

  eventCard: {
    flex: 1,
    marginBottom: 14,
    padding: 15,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  eventCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },

  eventToday: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },

  eventPast: {
    opacity: 0.65,
  },

  eventTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },

  eventTitleArea: {
    flex: 1,
  },

  relativeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },

  eventDate: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },

  eventTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  eventTitleCompleted: {
    color: '#166534',
  },

  eventSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },

  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },

  taskBadge: {
    backgroundColor: '#DBEAFE',
  },

  periodBadge: {
    backgroundColor: '#EDE9FE',
  },

  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#374151',
  },
});
