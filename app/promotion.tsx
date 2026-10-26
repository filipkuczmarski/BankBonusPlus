import AddPromotionModal from '@/components/AddPromotionModal';
import UserPromotionSchedule from '@/components/UserPromotionSchedule';
import { syncUserPromotionNotifications } from '@/lib/dynamicNotifications';


import {
  cancelTaskNotifications,
  scheduleTaskNotifications
} from '@/lib/notifications';

import { supabase } from '@/lib/supabase';

import UserPromotionTimeline from '@/components/UserPromotionTimeline';

import { router, useLocalSearchParams } from 'expo-router';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';



import { SafeAreaView } from 'react-native-safe-area-context';

type PromotionCategory =
  | 'personal_account'
  | 'business_account'
  | 'card'
  | 'savings';

type PromotionDifficulty =
  | 'easy'
  | 'medium'
  | 'hard';

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

  category: PromotionCategory | null;
  difficulty: PromotionDifficulty | null;
  account_fee: number | null;
  card_fee: number | null;

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
  due_date: string | null;
  task_type: 'checkbox' | 'counter';
  target_count: number;
  period_label: string | null;
  period_order: number | null;
};

type TaskProgress = {
  completed: boolean;
  current_count: number;
};

type ProgressMap = Record<string, TaskProgress>;

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


const getCategoryLabel = (
  category: PromotionCategory | null
) => {
  switch (category) {
    case 'personal_account':
      return 'Konto osobiste';

    case 'business_account':
      return 'Konto firmowe';

    case 'card':
      return 'Karta';

    case 'savings':
      return 'Oszczędności';

    default:
      return null;
  }
};

const getDifficultyConfig = (
  difficulty: PromotionDifficulty | null
) => {
  switch (difficulty) {
    case 'easy':
      return {
        label: 'Łatwa',
        backgroundColor: '#ECFDF5',
        color: '#15803D',
      };

    case 'medium':
      return {
        label: 'Średnia',
        backgroundColor: '#FFFBEB',
        color: '#B45309',
      };

    case 'hard':
      return {
        label: 'Trudna',
        backgroundColor: '#FEF2F2',
        color: '#DC2626',
      };

    default:
      return null;
  }
};

const formatFee = (
  fee: number | null
) => {
  if (fee === null) {
    return 'Brak danych';
  }

  if (fee === 0) {
    return '0 zł';
  }

  return `${fee} zł / mies.`;
};

const formatDate = (
  date: string | null
) => {
  if (!date) {
    return 'Brak danych';
  }

  return new Date(
    `${date}T12:00:00`
  ).toLocaleDateString('pl-PL');
};

const getDaysRemaining = (
  endDate: string | null
) => {
  if (!endDate) {
    return null;
  }

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const end = new Date(
    `${endDate}T00:00:00`
  );

  const difference =
    end.getTime() -
    today.getTime();

  return Math.ceil(
    difference /
      (1000 * 60 * 60 * 24)
  );
};

const getDaysRemainingLabel = (
  days: number | null
) => {
  if (days === null) {
    return null;
  }

  if (days < 0) {
    return 'Promocja zakończona';
  }

  if (days === 0) {
    return '🔥 Ostatni dzień';
  }

  if (days === 1) {
    return '🔥 Został 1 dzień';
  }

  if (days <= 3) {
    return `🔥 Zostały ${days} dni`;
  }

  if (days <= 7) {
    return `Kończy się za ${days} dni`;
  }

  return `Zostało ${days} dni`;
};

const getTaskDeadlineLabel = (
  dueDate: string | null
) => {
  if (!dueDate) {
    return null;
  }

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const due = new Date(
    `${dueDate}T00:00:00`
  );

  const difference =
    due.getTime() -
    today.getTime();

  const days = Math.ceil(
    difference /
      (1000 * 60 * 60 * 24)
  );

  if (days < 0) {
    return {
      label: 'Termin minął',
      backgroundColor: '#F3F4F6',
      color: '#6B7280',
    };
  }

  if (days === 0) {
    return {
      label: 'Dzisiaj',
      backgroundColor: '#FEF2F2',
      color: '#DC2626',
    };
  }

  if (days === 1) {
    return {
      label: 'Jutro',
      backgroundColor: '#FFF7ED',
      color: '#C2410C',
    };
  }

  if (days <= 3) {
    return {
      label: `Za ${days} dni`,
      backgroundColor: '#FFF7ED',
      color: '#C2410C',
    };
  }

  return {
    label: formatDate(dueDate),
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
  };
};

export default function PromotionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const params =
    useLocalSearchParams<{
      id?: string;
    }>();
  const [timelineRefreshKey, setTimelineRefreshKey] =
  useState(0);

  const promotionId =
    Array.isArray(params.id)
      ? params.id[0]
      : params.id;

  const [
    promotion,
    setPromotion,
  ] =
    useState<Promotion | null>(
      null
    );

  const [
    tasks,
    setTasks,
  ] =
    useState<Task[]>([]);

  const [
    progress,
    setProgress,
  ] =
    useState<ProgressMap>(
      {}
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    isInMyPromotions,
    setIsInMyPromotions,
  ] =
    useState(false);

  const [
    userPromotionStatus,
    setUserPromotionStatus,
  ] =
    useState<string | null>(
      null
    );


  const [
    userPromotionId,
    setUserPromotionId,
  ] =
    useState<string | null>(
      null
    );

  const [
    startPromotionModalVisible,
    setStartPromotionModalVisible,
  ] =
    useState(false);

  const [
    requireAccountOpenedAt,
    setRequireAccountOpenedAt,
  ] =
    useState(false);

  const [
    requirePromotionRegisteredAt,
    setRequirePromotionRegisteredAt,
  ] =
    useState(false);

  const [
    startingPromotion,
    setStartingPromotion,
  ] =
    useState(false);

  const [
    removingPromotion,
    setRemovingPromotion,
  ] =
    useState(false);

  const [
    addingPromotion,
    setAddingPromotion,
  ] =
    useState(false);

  const [
    savingTaskId,
    setSavingTaskId,
  ] =
    useState<string | null>(
      null
    );


 const loadPromotion = useCallback(async () => {
      if (!promotionId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const {
          data: promotionData,
          error:
            promotionError,
        } =
          await supabase
            .from(
              'promotions'
            )
            .select(
              `
              id,
              title,
              bonus_amount,
              description,
              start_date,
              end_date,
              terms_url,
              application_url,
              status,
              category,
              difficulty,
              account_fee,
              card_fee,
              banks (
                name,
                logo_url
              )
            `
            )
            .eq(
              'id',
              promotionId
            )
            .single();

        if (
          promotionError
        ) {
          throw promotionError;
        }

        setPromotion(
          promotionData as unknown as Promotion
        );

        const {
          data: tasksData,
          error:
            tasksError,
        } =
          await supabase
            .from('tasks')
            .select(
              `
              id,
              promotion_id,
              title,
              description,
              task_order,
              due_date,
              task_type,
              target_count,
              period_label,
              period_order
            `
            )
            .eq(
              'promotion_id',
              promotionId
            )
            .order(
              'task_order',
              {
                ascending:
                  true,
              }
            );

        if (tasksError) {
          throw tasksError;
        }

        const loadedTasks =
          (tasksData ??
            []) as Task[];

        setTasks(
          loadedTasks
        );

        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (!user) {
          setProgress(
            {}
          );

          setIsInMyPromotions(
            false
          );

          setUserPromotionStatus(
            null
          );

          setUserPromotionId(
            null
          );

          return;
        }

        const {
          data:
            userPromotion,
          error:
            userPromotionError,
        } =
          await supabase
            .from(
              'user_promotions'
            )
            .select(
              'id, status'
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

        if (
          userPromotionError
        ) {
          throw userPromotionError;
        }

        setIsInMyPromotions(
          Boolean(
            userPromotion
          )
        );

        setUserPromotionStatus(
          userPromotion?.status ??
            null
        );

        setUserPromotionId(
          userPromotion?.id ??
            null
        );

        if (
          loadedTasks.length ===
          0
        ) {
          return;
        }

        const taskIds =
          loadedTasks.map(
            (task) =>
              task.id
          );

        const {
          data:
            progressData,
          error:
            progressError,
        } =
          await supabase
            .from(
              'user_task_progress'
            )
            .select(
              'task_id, completed, current_count'
            )
            .eq(
              'user_id',
              user.id
            )
            .in(
              'task_id',
              taskIds
            );

        if (
          progressError
        ) {
          throw progressError;
        }

        const progressMap:
          ProgressMap =
          {};

        for (
          const row of
            progressData ??
          []
        ) {
          progressMap[
            row.task_id
          ] = {
            completed: row.completed === true,
            current_count: row.current_count ?? 0,
          };
        }

        setProgress(
          progressMap
        );
      } catch (
        err
      ) {
        console.error(
          'LOAD PROMOTION ERROR:',
          err
        );

        setError(
          'Nie udało się załadować promocji.'
        );
      } finally {
        setLoading(
          false
        );
      }
    }, [promotionId]);


   

useEffect(() => {
  if (promotionId) {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPromotion();
  }
}, [promotionId, loadPromotion]);

  const updatePromotionStatus =
    async (
      userId: string,
      nextProgress: ProgressMap
    ) => {
      if (!promotionId) {
        return;
      }

      if (
        tasks.length ===
        0
      ) {
        return;
      }

      const allCompleted =
        tasks.every(
          (task) =>
            nextProgress[
              task.id
            ]?.completed === true
        );

      const {
        error:
          statusError,
      } =
        await supabase
          .from(
            'user_promotions'
          )
          .update({
            status:
              allCompleted
                ? 'completed'
                : 'active',

            completed_at:
              allCompleted
                ? new Date().toISOString()
                : null,
          })
          .eq(
            'user_id',
            userId
          )
          .eq(
            'promotion_id',
            promotionId
          );

      if (statusError) {
        throw statusError;
      }
    };

  const addToMyPromotions =
    async () => {
      if (
        !promotion ||
        !promotionId
      ) {
        return;
      }

      try {
        setAddingPromotion(
          true
        );

        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (!user) {
          Alert.alert(
            'Zaloguj się',
            'Musisz być zalogowany, aby dodać promocję.'
          );

          return;
        }

        const {
          data:
            userPromotion,
          error:
            insertError,
        } =
          await supabase
            .from(
              'user_promotions'
            )
            .upsert(
              {
                user_id:
                  user.id,

                promotion_id:
                  promotionId,

                status:
                  'saved',

                completed_at:
                  null,
              },
              {
                onConflict:
                  'user_id,promotion_id',
              }
            )
            .select('id')
            .single();

        if (insertError) {
          throw insertError;
        }

        setUserPromotionId(
          userPromotion?.id ??
            null
        );

        setIsInMyPromotions(
          true
        );

        setUserPromotionStatus(
          'saved'
        );

        Alert.alert(
          'Promocja zapisana ✓',
          'Znajdziesz ją w sekcji „Moje promocje”. Możesz rozpocząć ją później.'
        );
      } catch (
        err
      ) {
        console.error(
          'ADD PROMOTION ERROR:',
          err
        );

        Alert.alert(
          'Błąd',
          'Nie udało się dodać promocji.'
        );
      } finally {
        setAddingPromotion(
          false
        );
      }
    };


  const preparePromotionStart =
    async () => {
      if (
        !promotionId ||
        !userPromotionId
      ) {
        return;
      }

      try {
        setStartingPromotion(
          true
        );

        const [
          periodTemplatesResponse,
          taskTemplatesResponse,
        ] = await Promise.all([
          supabase
            .from(
              'promotion_period_templates'
            )
            .select(
              'period_type'
            )
            .eq(
              'promotion_id',
              promotionId
            ),

          supabase
            .from(
              'task_templates'
            )
            .select(
              'deadline_type'
            )
            .eq(
              'promotion_id',
              promotionId
            ),
        ]);

        if (
          periodTemplatesResponse.error
        ) {
          throw periodTemplatesResponse.error;
        }

        if (
          taskTemplatesResponse.error
        ) {
          throw taskTemplatesResponse.error;
        }

        const periodTemplates =
          periodTemplatesResponse.data ??
          [];

        const taskTemplates =
          taskTemplatesResponse.data ??
          [];

        if (
          periodTemplates.length === 0 &&
          taskTemplates.length === 0
        ) {
          Alert.alert(
            'Brak harmonogramu',
            'Ta promocja nie ma jeszcze skonfigurowanego dynamicznego harmonogramu.'
          );

          return;
        }

        const periodTypes =
          periodTemplates
            .map(
              row =>
                row.period_type
            )
            .filter(Boolean);

        const deadlineTypes =
          taskTemplates
            .map(
              row =>
                row.deadline_type
            )
            .filter(Boolean);

        const needsAccountDate =
          periodTypes.some(
            type =>
              ACCOUNT_PERIOD_TYPES.includes(
                type
              )
          ) ||
          deadlineTypes.some(
            type =>
              ACCOUNT_DEADLINE_TYPES.includes(
                type
              )
          );

        const needsJoinDate =
          periodTypes.some(
            type =>
              JOIN_PERIOD_TYPES.includes(
                type
              )
          ) ||
          deadlineTypes.some(
            type =>
              JOIN_DEADLINE_TYPES.includes(
                type
              )
          );

        setRequireAccountOpenedAt(
          needsAccountDate
        );

        setRequirePromotionRegisteredAt(
          needsJoinDate
        );

        if (
          !needsAccountDate &&
          !needsJoinDate
        ) {
          await activatePromotion(
            {}
          );

          return;
        }

        setStartPromotionModalVisible(
          true
        );
      } catch (
        err
      ) {
        console.error(
          'PREPARE START ERROR:',
          err
        );

        Alert.alert(
          'Błąd',
          'Nie udało się sprawdzić warunków rozpoczęcia promocji.'
        );
      } finally {
        setStartingPromotion(
          false
        );
      }
    };


  const activatePromotion =
    async (
      values: StartPromotionValues
    ) => {
      if (
        !userPromotionId
      ) {
        return;
      }

      try {
        setStartingPromotion(
          true
        );

        const updatePayload:
          Record<string, unknown> = {
            activated_at:
              new Date().toISOString(),
            schedule_generated_at:
              null,
          };

        if (
          values.accountOpenedAt
        ) {
          updatePayload.account_opened_at =
            formatDateForDatabase(
              values.accountOpenedAt
            );
        }

        if (
          values.promotionRegisteredAt
        ) {
          updatePayload.promotion_registered_at =
            formatDateForDatabase(
              values.promotionRegisteredAt
            );
        }

        const {
          error:
            updateDatesError,
        } =
          await supabase
            .from(
              'user_promotions'
            )
            .update(
              updatePayload
            )
            .eq(
              'id',
              userPromotionId
            );

        if (
          updateDatesError
        ) {
          throw updateDatesError;
        }

        const {
          error:
            scheduleError,
        } =
          await supabase.rpc(
            'generate_user_promotion_schedule',
            {
              p_user_promotion_id:
                userPromotionId,
              p_force:
                true,
            }
          );

        if (
          scheduleError
        ) {
          throw scheduleError;
        }

        const {
          error:
            statusError,
        } =
          await supabase
            .from(
              'user_promotions'
            )
            .update({
              status:
                'active',
            })
            .eq(
              'id',
              userPromotionId
            );

        if (
          statusError
        ) {
          throw statusError;
        }

        try {
          await syncUserPromotionNotifications(
            userPromotionId
          );
        } catch (
          notificationError
        ) {
          console.warn(
            'NOTIFICATION SYNC WARNING:',
            notificationError
          );
        }

        setUserPromotionStatus(
          'active'
        );

        setStartPromotionModalVisible(
          false
        );

        setTimelineRefreshKey(
          previous =>
            previous + 1
        );

        Alert.alert(
          'Promocja rozpoczęta ✓',
          'Harmonogram został wygenerowany. Od teraz śledzimy Twoje terminy i postęp.'
        );
      } catch (
        err
      ) {
        console.error(
          'START PROMOTION ERROR:',
          err
        );

        Alert.alert(
          'Nie udało się rozpocząć promocji',
          err instanceof Error
            ? err.message
            : 'Wystąpił nieoczekiwany błąd.'
        );
      } finally {
        setStartingPromotion(
          false
        );
      }
    };


  const removeFromMyPromotions =
    async () => {
      if (
        !userPromotionId
      ) {
        return;
      }

      try {
        setRemovingPromotion(
          true
        );

        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (!user) {
          return;
        }

        const {
          error:
            deleteError,
        } =
          await supabase
            .from(
              'user_promotions'
            )
            .delete()
            .eq(
              'id',
              userPromotionId
            )
            .eq(
              'user_id',
              user.id
            );

        if (
          deleteError
        ) {
          throw deleteError;
        }

        setIsInMyPromotions(
          false
        );

        setUserPromotionStatus(
          null
        );

        setUserPromotionId(
          null
        );

        Alert.alert(
          'Usunięto promocję',
          'Promocja nie jest już w Twoich promocjach.'
        );
      } catch (
        err
      ) {
        console.error(
          'REMOVE PROMOTION ERROR:',
          err
        );

        Alert.alert(
          'Błąd',
          'Nie udało się usunąć promocji.'
        );
      } finally {
        setRemovingPromotion(
          false
        );
      }
    };


  const confirmRemovePromotion =
    () => {
      Alert.alert(
        'Usunąć promocję?',
        'Usuniemy ją z Twoich promocji razem z zapisanym harmonogramem i postępem.',
        [
          {
            text:
              'Anuluj',
            style:
              'cancel',
          },
          {
            text:
              'Usuń',
            style:
              'destructive',
            onPress:
              removeFromMyPromotions,
          },
        ]
      );
    };


  const toggleTask =
    async (
      task: Task
    ) => {
      if (
        !promotion
      ) {
        return;
      }

      try {
        setSavingTaskId(
          task.id
        );

        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (!user) {
          Alert.alert(
            'Zaloguj się',
            'Musisz być zalogowany, aby zapisywać postęp.'
          );

          return;
        }

        /*
         * Jeśli użytkownik
         * zaczyna odhaczać zadanie,
         * a promocja nie była jeszcze
         * dodana do jego promocji,
         * dodajemy ją automatycznie.
         */
        if (
          !isInMyPromotions
        ) {
          const {
            error:
              promotionInsertError,
          } =
            await supabase
              .from(
                'user_promotions'
              )
              .upsert(
                {
                  user_id:
                    user.id,
                  promotion_id:
                    promotion.id,
                  status:
                    'active',
                },
                {
                  onConflict:
                    'user_id,promotion_id',
                }
              );

          if (
            promotionInsertError
          ) {
            throw promotionInsertError;
          }

          setIsInMyPromotions(
            true
          );
        }

        const currentValue =
          progress[task.id]?.completed === true;

        const newValue = !currentValue;

        const nextProgress = {
          ...progress,
          [task.id]: {
            completed: newValue,
            current_count: newValue ? 1 : 0,
          },
        };

        /*
         * Optymistycznie
         * aktualizujemy UI.
         */
        setProgress(
          nextProgress
        );

        const {
          data:
            existingProgress,
          error:
            existingError,
        } =
          await supabase
            .from(
              'user_task_progress'
            )
            .select(
              'id'
            )
            .eq(
              'user_id',
              user.id
            )
            .eq(
              'task_id',
              task.id
            )
            .maybeSingle();

        if (
          existingError
        ) {
          throw existingError;
        }

        if (
          existingProgress
        ) {
          const {
            error:
              updateError,
          } =
            await supabase
              .from(
                'user_task_progress'
              )
              .update({
                completed: newValue,
                current_count: newValue ? 1 : 0,
                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                'id',
                existingProgress.id
              );

          if (
            updateError
          ) {
            throw updateError;
          }
        } else {
          const {
            error:
              insertError,
          } =
            await supabase
              .from(
                'user_task_progress'
              )
              .insert({
                user_id:
                  user.id,
                task_id:
                  task.id,
                completed: newValue,
                current_count: newValue ? 1 : 0,
                updated_at:
                  new Date().toISOString(),
              });

          if (
            insertError
          ) {
            throw insertError;
          }
        }

        /*
         * -------------------------
         * OBSŁUGA POWIADOMIEŃ
         * -------------------------
         */

        if (newValue) {
          /*
           * Zadanie wykonane.
           *
           * Usuwamy wszystkie
           * przyszłe przypomnienia
           * dla tego zadania.
           */
          await cancelTaskNotifications(
            task.id
          );
        } else {
          /*
           * Zadanie zostało ponownie
           * oznaczone jako niewykonane.
           *
           * Jeśli ma deadline,
           * planujemy przypomnienia
           * ponownie.
           */
          await scheduleTaskNotifications(
            {
              taskId:
                task.id,

              taskTitle:
                task.title,

              promotionTitle:
                promotion.title,

              dueDate:
                task.due_date,
            }
          );
        }

        await updatePromotionStatus(
          user.id,
          nextProgress
        );
      } catch (
        err
      ) {
        console.error(
          'TOGGLE TASK ERROR:',
          err
        );

        /*
         * Jeśli zapis się nie udał,
         * przywracamy poprzedni stan.
         */
        setProgress(
          (previous) => ({
            ...previous,
            [task.id]: {
              completed: !(previous[task.id]?.completed ?? false),
              current_count: previous[task.id]?.current_count ?? 0,
            },
          })
        );

        Alert.alert(
          'Błąd',
          'Nie udało się zapisać postępu.'
        );
      } finally {
        setSavingTaskId(
          null
        );
      }
    };

  const changeCounterTask =
    async (task: Task, delta: number) => {
      if (!promotion) return;

      const target = Math.max(task.target_count || 1, 1);
      const previousCount = progress[task.id]?.current_count ?? 0;
      const nextCount = Math.max(0, Math.min(target, previousCount + delta));

      if (nextCount === previousCount) return;

      const nextCompleted = nextCount >= target;
      const previousEntry = progress[task.id] ?? { completed: false, current_count: 0 };
      const nextProgress: ProgressMap = {
        ...progress,
        [task.id]: { completed: nextCompleted, current_count: nextCount },
      };

      try {
        setSavingTaskId(task.id);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('Zaloguj się', 'Musisz być zalogowany, aby zapisywać postęp.');
          return;
        }

        if (!isInMyPromotions) {
          const { error: promotionInsertError } = await supabase
            .from('user_promotions')
            .upsert(
              { user_id: user.id, promotion_id: promotion.id, status: 'active' },
              { onConflict: 'user_id,promotion_id' }
            );
          if (promotionInsertError) throw promotionInsertError;
          setIsInMyPromotions(true);
          setUserPromotionStatus('active');
        }

        setProgress(nextProgress);

        const { error: progressError } = await supabase
          .from('user_task_progress')
          .upsert(
            {
              user_id: user.id,
              task_id: task.id,
              completed: nextCompleted,
              current_count: nextCount,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,task_id' }
          );

        if (progressError) throw progressError;

        if (nextCompleted) {
          await cancelTaskNotifications(task.id);
        } else if (previousEntry.completed) {
          await scheduleTaskNotifications({
            taskId: task.id,
            taskTitle: task.title,
            promotionTitle: promotion.title,
            dueDate: task.due_date,
          });
        }

        await updatePromotionStatus(user.id, nextProgress);
      } catch (err) {
        console.error('COUNTER TASK ERROR:', err);
        setProgress(previous => ({ ...previous, [task.id]: previousEntry }));
        Alert.alert('Błąd', 'Nie udało się zapisać licznika.');
      } finally {
        setSavingTaskId(null);
      }
    };

  const groupedTasks = useMemo(() => {
    const groups = new Map<string, { label: string; order: number; tasks: Task[] }>();

    for (const task of tasks) {
      const label = task.period_label?.trim() || 'Pozostałe warunki';
      const order = task.period_order ?? 9999;
      const key = `${order}::${label}`;

      if (!groups.has(key)) groups.set(key, { label, order, tasks: [] });
      groups.get(key)!.tasks.push(task);
    }

    return Array.from(groups.values())
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pl'))
      .map(group => ({
        ...group,
        tasks: [...group.tasks].sort((a, b) => a.task_order - b.task_order),
      }));
  }, [tasks]);

  const completedCount =
    useMemo(
      () =>
        tasks.filter(
          (task) =>
            progress[
              task.id
            ]?.completed === true
        ).length,
      [
        tasks,
        progress,
      ]
    );

  const progressPercent =
    tasks.length > 0
      ? Math.round(
          (completedCount /
            tasks.length) *
            100
        )
      : 0;

  const daysRemaining =
    getDaysRemaining(
      promotion?.end_date ??
        null
    );

  const daysRemainingLabel =
    getDaysRemainingLabel(
      daysRemaining
    );

  const promotionExpired =
    daysRemaining !== null &&
    daysRemaining < 0;

  const difficultyConfig =
    getDifficultyConfig(
      promotion?.difficulty ??
        null
    );

  const categoryLabel =
    getCategoryLabel(
      promotion?.category ??
        null
    );

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
          style={
            styles.loadingText
          }
        >
          Ładowanie promocji...
        </Text>
      </SafeAreaView>
    );
  }

  if (
    error ||
    !promotion
  ) {
    return (
      <SafeAreaView
        style={
          styles.loadingContainer
        }
      >
        <Text
          style={
            styles.errorTitle
          }
        >
          Nie udało się otworzyć promocji
        </Text>

        <Text
          style={
            styles.errorText
          }
        >
          {error ??
            'Promocja nie istnieje.'}
        </Text>

        <TouchableOpacity
          style={
            styles.backErrorButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backErrorText
            }
          >
            ← Wróć
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.container
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          style={
            styles.backButton
          }
        >
          <Text
            style={
              styles.backText
            }
          >
            ← Wróć
          </Text>
        </TouchableOpacity>

        {/* HERO */}

        <View
          style={
            styles.heroCard
          }
        >
          <View
            style={
              styles.bankRow
            }
          >
            <View
              style={
                styles.bankIcon
              }
            >
              <Text
                style={
                  styles.bankIconText
                }
              >
                {promotion.banks?.name
                  ?.charAt(
                    0
                  )
                  .toUpperCase() ??
                  'B'}
              </Text>
            </View>

            <Text
              style={
                styles.bankName
              }
            >
              {promotion
                .banks
                ?.name ??
                'Bank'}
            </Text>
          </View>

          <View
            style={
              styles.badgesRow
            }
          >
            {categoryLabel && (
              <View
                style={
                  styles.categoryBadge
                }
              >
                <Text
                  style={
                    styles.categoryBadgeText
                  }
                >
                  {
                    categoryLabel
                  }
                </Text>
              </View>
            )}

            {difficultyConfig && (
              <View
                style={[
                  styles.difficultyBadge,
                  {
                    backgroundColor:
                      difficultyConfig.backgroundColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.difficultyDot,
                    {
                      backgroundColor:
                        difficultyConfig.color,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.difficultyText,
                    {
                      color:
                        difficultyConfig.color,
                    },
                  ]}
                >
                  {
                    difficultyConfig.label
                  }
                </Text>
              </View>
            )}
          </View>

          <Text
            style={
              styles.promotionTitle
            }
          >
            {promotion.title}
          </Text>

          <Text
            style={
              styles.bonusLabel
            }
          >
            DO ZDOBYCIA
          </Text>

          <Text
            style={
              styles.bonusAmount
            }
          >
            +
            {
              promotion.bonus_amount
            }{' '}
            zł
          </Text>

          {daysRemainingLabel && (
            <View
              style={[
                styles.daysBadge,
                promotionExpired &&
                  styles.daysBadgeExpired,

                daysRemaining !==
                  null &&
                  daysRemaining >=
                    0 &&
                  daysRemaining <=
                    3 &&
                  styles.daysBadgeUrgent,
              ]}
            >
              <Text
                style={[
                  styles.daysBadgeText,
                  promotionExpired &&
                    styles.daysBadgeTextExpired,

                  daysRemaining !==
                    null &&
                    daysRemaining >=
                      0 &&
                    daysRemaining <=
                      3 &&
                    styles.daysBadgeTextUrgent,
                ]}
              >
                {
                  daysRemainingLabel
                }
              </Text>
            </View>
          )}
        </View>

        {/* GŁÓWNY CTA */}

        {promotion.application_url &&
          !promotionExpired && (
            <TouchableOpacity
              style={
                styles.primaryCta
              }
              activeOpacity={
                0.85
              }
              onPress={() =>
                Linking.openURL(
                  promotion.application_url!
                )
              }
            >
              <Text
                style={
                  styles.primaryCtaSmall
                }
              >
                PRZEJDŹ DO
                BANKU
              </Text>

              <Text
                style={
                  styles.primaryCtaText
                }
              >
                Otwórz konto i
                zdobądź{' '}
                {
                  promotion.bonus_amount
                }{' '}
                zł →
              </Text>
            </TouchableOpacity>
          )}

        {/* MOJE PROMOCJE */}

        {isInMyPromotions ? (
          <View
            style={
              styles.trackingCard
            }
          >
            <Text
              style={
                styles.trackingTitle
              }
            >
              {userPromotionStatus ===
              'saved'
                ? '✓ Zapisana w Twoich promocjach'
                : '✓ W Twoich promocjach'}
            </Text>

            <Text
              style={
                styles.trackingDescription
              }
            >
              {userPromotionStatus ===
              'saved'
                ? 'Promocja jest zapisana. Rozpocznij ją dopiero, gdy faktycznie do niej przystąpisz.'
                : 'Śledzimy Twój postęp i terminy tej promocji.'}
            </Text>

            {userPromotionStatus ===
              'saved' && (
              <TouchableOpacity
                style={
                  styles.startTrackingButton
                }
                activeOpacity={
                  0.85
                }
                disabled={
                  startingPromotion
                }
                onPress={
                  preparePromotionStart
                }
              >
                {startingPromotion ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.startTrackingButtonText
                    }
                  >
                    Rozpocznij promocję
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={
              styles.addPromotionButton
            }
            onPress={
              addToMyPromotions
            }
            disabled={
              addingPromotion
            }
            activeOpacity={
              0.8
            }
          >
            {addingPromotion ? (
              <ActivityIndicator
                color="#2563EB"
              />
            ) : (
              <Text
                style={
                  styles.addPromotionText
                }
              >
                + Dodaj do moich
                promocji
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* NAJWAŻNIEJSZE INFORMACJE */}

        <View
          style={
            styles.sectionCard
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Najważniejsze
            informacje
          </Text>

          <View
            style={
              styles.infoRow
            }
          >
            <View
              style={
                styles.infoItem
              }
            >
              <Text
                style={
                  styles.infoLabel
                }
              >
                Konto
              </Text>

              <Text
                style={
                  styles.infoValue
                }
              >
                {formatFee(
                  promotion.account_fee
                )}
              </Text>
            </View>

            <View
              style={
                styles.infoDivider
              }
            />

            <View
              style={
                styles.infoItem
              }
            >
              <Text
                style={
                  styles.infoLabel
                }
              >
                Karta
              </Text>

              <Text
                style={
                  styles.infoValue
                }
              >
                {formatFee(
                  promotion.card_fee
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* DATY */}

        <View
          style={
            styles.sectionCard
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Termin promocji
          </Text>

          <View
            style={
              styles.dateRow
            }
          >
            <View
              style={
                styles.dateItem
              }
            >
              <Text
                style={
                  styles.infoLabel
                }
              >
                Start
              </Text>

              <Text
                style={
                  styles.infoValue
                }
              >
                {formatDate(
                  promotion.start_date
                )}
              </Text>
            </View>

            <View
              style={
                styles.dateItem
              }
            >
              <Text
                style={
                  styles.infoLabel
                }
              >
                Koniec
              </Text>

              <Text
                style={
                  styles.infoValue
                }
              >
                {formatDate(
                  promotion.end_date
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* OPIS */}

        {promotion.description && (
          <View
            style={
              styles.sectionCard
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              O promocji
            </Text>

            <Text
              style={
                styles.description
              }
            >
              {
                promotion.description
              }
            </Text>
          </View>
        )}


       

{(userPromotionStatus === 'active' ||
  userPromotionStatus === 'completed') &&
  promotionId && (
  <>
    <UserPromotionSchedule
      promotionId={promotionId}
      onTaskChanged={() =>
        setTimelineRefreshKey(
          previous => previous + 1
        )
      }
    />

    <UserPromotionTimeline
      key={timelineRefreshKey}
      promotionId={promotionId}
    />
  </>
)}



        {/* CHECKLISTA */}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Jak zdobyć premię?</Text>

          {tasks.length > 0 ? (
            <>
              <View style={styles.progressHeader}>
                <Text style={styles.progressText}>
                  {completedCount} z {tasks.length} warunków
                </Text>
                <Text style={styles.progressPercent}>{progressPercent}%</Text>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
              </View>

              <View style={styles.tasksContainer}>
                {groupedTasks.map(group => {
                  const groupCompleted = group.tasks.filter(
                    task => progress[task.id]?.completed === true
                  ).length;

                  return (
                    <View key={`${group.order}-${group.label}`} style={styles.periodGroup}>
                      <View style={styles.periodHeader}>
                        <View>
                          <Text style={styles.periodTitle}>{group.label}</Text>
                          <Text style={styles.periodProgressText}>
                            {groupCompleted} z {group.tasks.length} wykonane
                          </Text>
                        </View>

                        {groupCompleted === group.tasks.length && (
                          <View style={styles.periodDoneBadge}>
                            <Text style={styles.periodDoneText}>✓</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.periodTasks}>
                        {group.tasks.map(task => {
                          const taskProgress = progress[task.id] ?? {
                            completed: false,
                            current_count: 0,
                          };
                          const completed = taskProgress.completed;
                          const deadline = getTaskDeadlineLabel(task.due_date);
                          const saving = savingTaskId === task.id;
                          const isCounter = task.task_type === 'counter';
                          const target = Math.max(task.target_count || 1, 1);
                          const currentCount = Math.min(taskProgress.current_count, target);

                          return (
                            <View
                              key={task.id}
                              style={[
                                styles.taskCard,
                                completed && styles.taskCardCompleted,
                              ]}
                            >
                              <View style={styles.taskTopRow}>
                                <View style={styles.taskContent}>
                                  <Text
                                    style={[
                                      styles.taskTitle,
                                      completed && styles.taskTitleCompleted,
                                    ]}
                                  >
                                    {task.title}
                                  </Text>

                                  {task.description && (
                                    <Text
                                      style={[
                                        styles.taskDescription,
                                        completed && styles.taskDescriptionCompleted,
                                      ]}
                                    >
                                      {task.description}
                                    </Text>
                                  )}

                                  {deadline && (
                                    <View
                                      style={[
                                        styles.deadlineBadge,
                                        { backgroundColor: deadline.backgroundColor },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.deadlineText,
                                          { color: deadline.color },
                                        ]}
                                      >
                                        ⏱ {deadline.label}
                                      </Text>
                                    </View>
                                  )}
                                </View>

                                {!isCounter && (
                                  <TouchableOpacity
                                    style={[
                                      styles.checkbox,
                                      completed && styles.checkboxCompleted,
                                    ]}
                                    activeOpacity={0.8}
                                    disabled={saving}
                                    onPress={() => toggleTask(task)}
                                  >
                                    {saving ? (
                                      <ActivityIndicator
                                        size="small"
                                        color={completed ? '#FFFFFF' : '#2563EB'}
                                      />
                                    ) : (
                                      completed && <Text style={styles.checkmark}>✓</Text>
                                    )}
                                  </TouchableOpacity>
                                )}
                              </View>

                              {isCounter && (
                                <View style={styles.counterRow}>
                                  <TouchableOpacity
                                    style={[
                                      styles.counterButton,
                                      (saving || currentCount <= 0) && styles.counterButtonDisabled,
                                    ]}
                                    disabled={saving || currentCount <= 0}
                                    onPress={() => changeCounterTask(task, -1)}
                                  >
                                    <Text style={styles.counterButtonText}>−</Text>
                                  </TouchableOpacity>

                                  <View style={styles.counterValueBox}>
                                    {saving ? (
                                      <ActivityIndicator size="small" color="#2563EB" />
                                    ) : (
                                      <>
                                        <Text
                                          style={[
                                            styles.counterValue,
                                            completed && styles.counterValueCompleted,
                                          ]}
                                        >
                                          {currentCount} / {target}
                                        </Text>
                                        <Text style={styles.counterLabel}>wykonano</Text>
                                      </>
                                    )}
                                  </View>

                                  <TouchableOpacity
                                    style={[
                                      styles.counterButton,
                                      completed && styles.counterButtonCompleted,
                                      (saving || currentCount >= target) && styles.counterButtonDisabled,
                                    ]}
                                    disabled={saving || currentCount >= target}
                                    onPress={() => changeCounterTask(task, 1)}
                                  >
                                    <Text
                                      style={[
                                        styles.counterButtonText,
                                        completed && styles.counterButtonTextCompleted,
                                      ]}
                                    >
                                      +
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.noTasksText}>
              Dla tej promocji nie dodano jeszcze warunków.
            </Text>
          )}
        </View>

        {/* SUKCES */}

        {tasks.length >
          0 &&
          progressPercent ===
            100 && (
            <View
              style={
                styles.successCard
              }
            >
              <Text
                style={
                  styles.successEmoji
                }
              >
                🎉
              </Text>

              <Text
                style={
                  styles.successTitle
                }
              >
                Wszystkie warunki
                wykonane!
              </Text>

              <Text
                style={
                  styles.successDescription
                }
              >
                Świetna robota.
                Oznaczyliśmy tę
                promocję jako
                ukończoną.
              </Text>
            </View>
          )}

        {/* DOLNY CTA */}

        {promotion.application_url &&
          !promotionExpired && (
            <TouchableOpacity
              style={
                styles.bottomCta
              }
              activeOpacity={
                0.85
              }
              onPress={() =>
                Linking.openURL(
                  promotion.application_url!
                )
              }
            >
              <Text
                style={
                  styles.bottomCtaText
                }
              >
                Zdobądź{' '}
                {
                  promotion.bonus_amount
                }{' '}
                zł →
              </Text>
            </TouchableOpacity>
          )}

        {/* REGULAMIN */}

        {promotion.terms_url && (
          <TouchableOpacity
            style={
              styles.termsButton
            }
            activeOpacity={
              0.8
            }
            onPress={() =>
              Linking.openURL(
                promotion.terms_url!
              )
            }
          >
            <Text
              style={
                styles.termsText
              }
            >
              Regulamin
              promocji ↗
            </Text>
          </TouchableOpacity>
        )}


        {isInMyPromotions && (
          <View
            style={
              styles.managePromotionSection
            }
          >
            <TouchableOpacity
              style={
                styles.removePromotionButton
              }
              activeOpacity={
                0.7
              }
              disabled={
                removingPromotion
              }
              onPress={
                confirmRemovePromotion
              }
            >
              {removingPromotion ? (
                <ActivityIndicator
                  size="small"
                  color="#B91C1C"
                />
              ) : (
                <Text
                  style={
                    styles.removePromotionText
                  }
                >
                  Usuń z moich promocji
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Text
          style={
            styles.disclaimer
          }
        >
          Przed skorzystaniem
          z promocji sprawdź
          aktualne warunki i
          regulamin banku.
        </Text>
      </ScrollView>

      <AddPromotionModal
        visible={
          startPromotionModalVisible
        }
        loading={
          startingPromotion
        }
        requireAccountOpenedAt={
          requireAccountOpenedAt
        }
        requirePromotionRegisteredAt={
          requirePromotionRegisteredAt
        }
        onClose={() => {
          if (
            startingPromotion
          ) {
            return;
          }

          setStartPromotionModalVisible(
            false
          );
        }}
        onConfirm={
          activatePromotion
        }
      />
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

    scrollContent: {
      padding: 20,
      paddingBottom: 50,
    },

    backButton: {
      marginBottom: 18,
    },

    backText: {
      fontSize: 16,
      color: '#2563EB',
      fontWeight: '600',
    },

    heroCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 22,
      padding: 22,
      marginBottom: 16,
    },

    bankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },

    bankIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor:
        '#EFF6FF',
      justifyContent:
        'center',
      alignItems: 'center',
      marginRight: 12,
    },

    bankIconText: {
      color: '#2563EB',
      fontSize: 20,
      fontWeight: '800',
    },

    bankName: {
      color: '#374151',
      fontWeight: '700',
      fontSize: 16,
    },

    badgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },

    categoryBadge: {
      backgroundColor:
        '#EFF6FF',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },

    categoryBadgeText: {
      color: '#2563EB',
      fontSize: 12,
      fontWeight: '700',
    },

    difficultyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },

    difficultyDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginRight: 6,
    },

    difficultyText: {
      fontSize: 12,
      fontWeight: '700',
    },

    promotionTitle: {
      fontSize: 25,
      lineHeight: 31,
      fontWeight: '800',
      color: '#111827',
      marginBottom: 22,
    },

    bonusLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: '#9CA3AF',
      letterSpacing: 1,
    },

    bonusAmount: {
      marginTop: 4,
      fontSize: 38,
      fontWeight: '900',
      color: '#16A34A',
    },

    daysBadge: {
      alignSelf:
        'flex-start',
      backgroundColor:
        '#EFF6FF',
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 7,
      marginTop: 14,
    },

    daysBadgeUrgent: {
      backgroundColor:
        '#FEF2F2',
    },

    daysBadgeExpired: {
      backgroundColor:
        '#F3F4F6',
    },

    daysBadgeText: {
      color: '#2563EB',
      fontSize: 13,
      fontWeight: '700',
    },

    daysBadgeTextUrgent: {
      color: '#DC2626',
    },

    daysBadgeTextExpired: {
      color: '#6B7280',
    },

    primaryCta: {
      backgroundColor:
        '#2563EB',
      borderRadius: 18,
      paddingVertical: 17,
      paddingHorizontal: 20,
      marginBottom: 14,
    },

    primaryCtaSmall: {
      fontSize: 10,
      color: '#BFDBFE',
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 4,
    },

    primaryCtaText: {
      fontSize: 17,
      color: '#FFFFFF',
      fontWeight: '800',
    },

    addPromotionButton: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: '#2563EB',
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 16,
    },

    addPromotionText: {
      color: '#2563EB',
      fontSize: 16,
      fontWeight: '700',
    },

    trackingCard: {
      backgroundColor:
        '#ECFDF5',
      borderRadius: 16,
      padding: 17,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: '#BBF7D0',
    },

    trackingTitle: {
      color: '#15803D',
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
    },

    trackingDescription: {
      color: '#166534',
      fontSize: 13,
      lineHeight: 19,
    },

    sectionCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
    },

    sectionTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: '#111827',
      marginBottom: 17,
    },

    infoRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },

    infoItem: {
      flex: 1,
    },

    infoDivider: {
      width: 1,
      backgroundColor:
        '#E5E7EB',
      marginHorizontal: 18,
    },

    infoLabel: {
      fontSize: 12,
      color: '#6B7280',
      marginBottom: 5,
    },

    infoValue: {
      fontSize: 15,
      color: '#111827',
      fontWeight: '700',
    },

    dateRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      gap: 16,
    },

    dateItem: {
      flex: 1,
      backgroundColor:
        '#F9FAFB',
      padding: 14,
      borderRadius: 14,
    },

    description: {
      color: '#4B5563',
      fontSize: 15,
      lineHeight: 23,
    },

    progressHeader: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },

    progressText: {
      color: '#6B7280',
      fontSize: 13,
      fontWeight: '600',
    },

    progressPercent: {
      color: '#2563EB',
      fontSize: 14,
      fontWeight: '800',
    },

    progressTrack: {
      height: 8,
      backgroundColor:
        '#E5E7EB',
      borderRadius: 999,
      overflow: 'hidden',
      marginBottom: 18,
    },

    progressBar: {
      height: '100%',
      backgroundColor:
        '#2563EB',
      borderRadius: 999,
    },

    tasksContainer: {
      gap: 10,
    },

    taskCard: {
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 16,
      padding: 15,
      backgroundColor:
        '#FFFFFF',
    },

    taskCardCompleted: {
      backgroundColor:
        '#F0FDF4',
      borderColor: '#BBF7D0',
    },

    taskTopRow: {
      flexDirection: 'row',
      alignItems:
        'flex-start',
    },

    taskNumber: {
      width: 31,
      height: 31,
      borderRadius: 10,
      backgroundColor:
        '#EFF6FF',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    taskNumberCompleted: {
      backgroundColor:
        '#DCFCE7',
    },

    taskNumberText: {
      color: '#2563EB',
      fontWeight: '800',
    },

    taskNumberTextCompleted: {
      color: '#15803D',
    },

    taskContent: {
      flex: 1,
      paddingRight: 10,
    },

    taskTitle: {
      color: '#111827',
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '700',
    },

    taskTitleCompleted: {
      color: '#6B7280',
      textDecorationLine:
        'line-through',
    },

    taskDescription: {
      color: '#6B7280',
      fontSize: 13,
      lineHeight: 19,
      marginTop: 5,
    },

    taskDescriptionCompleted: {
      color: '#9CA3AF',
    },

    deadlineBadge: {
      alignSelf:
        'flex-start',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      marginTop: 9,
    },

    deadlineText: {
      fontSize: 11,
      fontWeight: '700',
    },

    checkbox: {
      width: 27,
      height: 27,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: '#D1D5DB',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    checkboxCompleted: {
      backgroundColor:
        '#16A34A',
      borderColor: '#16A34A',
    },

    checkmark: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },

    periodGroup: {
      backgroundColor: '#F9FAFB',
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },

    periodHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      paddingHorizontal: 2,
    },

    periodTitle: {
      color: '#111827',
      fontSize: 16,
      fontWeight: '800',
    },

    periodProgressText: {
      color: '#6B7280',
      fontSize: 12,
      fontWeight: '600',
      marginTop: 3,
    },

    periodDoneBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
    },

    periodDoneText: {
      color: '#15803D',
      fontSize: 16,
      fontWeight: '900',
    },

    periodTasks: {
      gap: 9,
    },

    counterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
      gap: 12,
    },

    counterButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: '#BFDBFE',
      backgroundColor: '#EFF6FF',
      alignItems: 'center',
      justifyContent: 'center',
    },

    counterButtonCompleted: {
      backgroundColor: '#DCFCE7',
      borderColor: '#BBF7D0',
    },

    counterButtonDisabled: {
      opacity: 0.35,
    },

    counterButtonText: {
      color: '#2563EB',
      fontSize: 25,
      lineHeight: 28,
      fontWeight: '700',
    },

    counterButtonTextCompleted: {
      color: '#15803D',
    },

    counterValueBox: {
      minWidth: 86,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },

    counterValue: {
      color: '#111827',
      fontSize: 18,
      fontWeight: '900',
    },

    counterValueCompleted: {
      color: '#15803D',
    },

    counterLabel: {
      color: '#9CA3AF',
      fontSize: 10,
      fontWeight: '700',
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    noTasksText: {
      color: '#6B7280',
      fontSize: 14,
      lineHeight: 21,
    },

    successCard: {
      backgroundColor:
        '#ECFDF5',
      borderColor: '#BBF7D0',
      borderWidth: 1,
      borderRadius: 20,
      padding: 22,
      alignItems: 'center',
      marginBottom: 16,
    },

    successEmoji: {
      fontSize: 34,
      marginBottom: 10,
    },

    successTitle: {
      color: '#166534',
      fontSize: 19,
      fontWeight: '800',
      marginBottom: 6,
      textAlign: 'center',
    },

    successDescription: {
      color: '#15803D',
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },

    bottomCta: {
      backgroundColor:
        '#2563EB',
      borderRadius: 17,
      paddingVertical: 17,
      alignItems: 'center',
      marginBottom: 12,
    },

    bottomCtaText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '800',
    },

    termsButton: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 14,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },

    termsText: {
      color: '#2563EB',
      fontSize: 15,
      fontWeight: '700',
    },

    startTrackingButton: {
      marginTop: 16,
      backgroundColor: '#2563EB',
      minHeight: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    startTrackingButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },

    managePromotionSection: {
      marginTop: 26,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
      alignItems: 'center',
    },

    removePromotionButton: {
      paddingHorizontal: 18,
      paddingVertical: 12,
    },

    removePromotionText: {
      color: '#B91C1C',
      fontSize: 13,
      fontWeight: '600',
    },

    disclaimer: {
      color: '#9CA3AF',
      fontSize: 11,
      lineHeight: 17,
      textAlign: 'center',
      paddingHorizontal: 15,
    },

    loadingContainer: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
      backgroundColor:
        '#F5F6FA',
      padding: 30,
    },

    loadingText: {
      color: '#6B7280',
      marginTop: 12,
    },

    errorTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: '#111827',
      textAlign: 'center',
      marginBottom: 8,
    },

    errorText: {
      fontSize: 14,
      color: '#6B7280',
      textAlign: 'center',
      marginBottom: 20,
    },

    backErrorButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor:
        '#2563EB',
      borderRadius: 12,
    },

    backErrorText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });