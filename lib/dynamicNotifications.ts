import * as Notifications from 'expo-notifications';

import { supabase } from '@/lib/supabase';

export type NotificationUserTask = {
  id: string;
  title: string;
  completed: boolean;
  calculated_due_date: string | null;
};

/**
 * Ile dni przed deadlinem przypominamy.
 *
 * 7 = tydzień przed
 * 3 = trzy dni przed
 * 1 = dzień przed
 * 0 = w dniu deadline'u
 */
const REMINDER_DAYS = [7, 3, 1, 0];

const NOTIFICATION_HOUR = 9;
const NOTIFICATION_MINUTE = 0;

const parseLocalDate = (date: string) => {
  const [year, month, day] = date
    .split('-')
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
    NOTIFICATION_HOUR,
    NOTIFICATION_MINUTE,
    0,
    0
  );
};

const subtractDays = (
  date: Date,
  days: number
) => {
  const result = new Date(date);

  result.setDate(
    result.getDate() - days
  );

  return result;
};

const isFuture = (date: Date) => {
  return date.getTime() >
    Date.now() + 5_000;
};

const getReminderTitle = (
  daysBefore: number
) => {
  if (daysBefore === 0) {
    return 'Termin mija dzisiaj ⏰';
  }

  if (daysBefore === 1) {
    return 'Termin mija jutro';
  }

  if (daysBefore === 3) {
    return 'Zostały 3 dni';
  }

  if (daysBefore === 7) {
    return 'Został tydzień';
  }

  return 'Zbliża się termin';
};

/**
 * Sprawdza pozwolenie na lokalne
 * powiadomienia.
 */
export async function ensureNotificationPermission() {
  const existing =
    await Notifications.getPermissionsAsync();

  if (
    existing.status ===
    Notifications.PermissionStatus.GRANTED
  ) {
    return true;
  }

  const requested =
    await Notifications.requestPermissionsAsync();

  return (
    requested.status ===
    Notifications.PermissionStatus.GRANTED
  );
}

/**
 * Usuwa wszystkie zaplanowane
 * powiadomienia dotyczące jednego
 * user_task.
 *
 * Nie potrzebujemy przechowywać identifierów
 * w Supabase — znajdujemy powiadomienia po
 * content.data.userTaskId.
 */
export async function cancelUserTaskNotifications(
  userTaskId: string
) {
  try {
    const scheduled =
      await Notifications.getAllScheduledNotificationsAsync();

    const matching =
      scheduled.filter(notification => {
        return (
          notification.content.data
            ?.userTaskId === userTaskId
        );
      });

    await Promise.all(
      matching.map(notification =>
        Notifications.cancelScheduledNotificationAsync(
          notification.identifier
        )
      )
    );

    console.log(
      `🔕 Usunięto przypomnienia taska ${userTaskId}:`,
      matching.length
    );
  } catch (error) {
    console.error(
      'CANCEL USER TASK NOTIFICATIONS ERROR:',
      error
    );
  }
}

/**
 * Planuje komplet przypomnień
 * dla pojedynczego user_task.
 */
export async function scheduleUserTaskNotifications(
  task: NotificationUserTask
) {
  if (
    task.completed ||
    !task.calculated_due_date
  ) {
    return;
  }

  const permission =
    await ensureNotificationPermission();

  if (!permission) {
    console.log(
      'Brak zgody na powiadomienia.'
    );

    return;
  }

  /*
   * Najpierw czyścimy stare wpisy.
   * Dzięki temu funkcję można bezpiecznie
   * uruchamiać wiele razy.
   */
  await cancelUserTaskNotifications(
    task.id
  );

  const deadline =
    parseLocalDate(
      task.calculated_due_date
    );

  for (const daysBefore of REMINDER_DAYS) {
    const notificationDate =
      subtractDays(
        deadline,
        daysBefore
      );

    /*
     * Nie planujemy przypomnień,
     * których termin już minął.
     */
    if (!isFuture(notificationDate)) {
      continue;
    }

    try {
      const identifier =
        await Notifications.scheduleNotificationAsync({
          content: {
            title:
              getReminderTitle(
                daysBefore
              ),

            body: task.title,

            sound: true,

            data: {
              type: 'promotion_task',
              userTaskId: task.id,
              dueDate:
                task.calculated_due_date,
              daysBefore,
            },
          },

          trigger: {
            type:
              Notifications
                .SchedulableTriggerInputTypes
                .DATE,

            date: notificationDate,
          },
        });

      console.log(
        '🔔 Zaplanowano:',
        task.title,
        notificationDate,
        identifier
      );
    } catch (error) {
      console.error(
        'SCHEDULE USER TASK NOTIFICATION ERROR:',
        error
      );
    }
  }
}

/**
 * Najważniejsza funkcja.
 *
 * completed = true
 * -> kasujemy wszystkie przyszłe przypomnienia
 *
 * completed = false
 * -> ponownie je planujemy
 */
export async function syncUserTaskNotifications(
  task: NotificationUserTask
) {
  if (task.completed) {
    await cancelUserTaskNotifications(
      task.id
    );

    return;
  }

  if (!task.calculated_due_date) {
    await cancelUserTaskNotifications(
      task.id
    );

    return;
  }

  await scheduleUserTaskNotifications(
    task
  );
}

/**
 * Synchronizuje wszystkie zadania
 * konkretnej promocji użytkownika.
 *
 * Przydatne:
 * - po wygenerowaniu harmonogramu,
 * - po wejściu w promocję,
 * - po zmianie daty otwarcia konta.
 */
export async function syncUserPromotionNotifications(
  userPromotionId: string
) {
  try {
    const {
      data,
      error,
    } = await supabase
      .from('user_tasks')
      .select(
        `
        id,
        title,
        completed,
        calculated_due_date
        `
      )
      .eq(
        'user_promotion_id',
        userPromotionId
      );

    if (error) {
      throw error;
    }

    const tasks =
      (data || []) as NotificationUserTask[];

    for (const task of tasks) {
      await syncUserTaskNotifications(
        task
      );
    }

    console.log(
      `🔔 Zsynchronizowano ${tasks.length} zadań promocji`
    );
  } catch (error) {
    console.error(
      'SYNC PROMOTION NOTIFICATIONS ERROR:',
      error
    );
  }
}

/**
 * Opcjonalna funkcja diagnostyczna.
 * Możesz jej używać podczas testów.
 */
export async function debugScheduledNotifications() {
  const scheduled =
    await Notifications.getAllScheduledNotificationsAsync();

  console.log(
    '🔔 SCHEDULED NOTIFICATIONS:',
    scheduled.map(notification => ({
      id: notification.identifier,

      title:
        notification.content.title,

      body:
        notification.content.body,

      userTaskId:
        notification.content.data
          ?.userTaskId,

      trigger:
        notification.trigger,
    }))
  );

  return scheduled;
}




