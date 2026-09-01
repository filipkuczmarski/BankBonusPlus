import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const requestNotificationPermissions = async () => {
  const existingPermissions =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingPermissions.status;

  if (finalStatus !== 'granted') {
    const requestedPermissions =
      await Notifications.requestPermissionsAsync();

    finalStatus = requestedPermissions.status;
  }

  return finalStatus === 'granted';
};

export const sendTestNotification = async () => {
  const hasPermission =
    await requestNotificationPermissions();

  if (!hasPermission) {
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'BankBonusPlus 💰',
      body: 'Powiadomienia działają. Nie przegapisz warunków promocji.',
    },
    trigger: null,
  });

  return true;
};

type TaskNotificationInput = {
  taskId: string;
  taskTitle: string;
  promotionTitle: string;
  dueDate: string | null;
};

const getNotificationDate = (
  dueDate: string,
  daysBefore: number,
  hour = 10
) => {
  const due = new Date(`${dueDate}T12:00:00`);

  const notificationDate = new Date(due);

  notificationDate.setDate(
    notificationDate.getDate() - daysBefore
  );

  notificationDate.setHours(
    hour,
    0,
    0,
    0
  );

  return notificationDate;
};

export const cancelTaskNotifications = async (
  taskId: string
) => {
  const scheduled =
    await Notifications.getAllScheduledNotificationsAsync();

  const matchingNotifications =
    scheduled.filter(
      (notification) =>
        notification.content.data?.taskId === taskId
    );

  await Promise.all(
    matchingNotifications.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(
        notification.identifier
      )
    )
  );
};

export const scheduleTaskNotifications = async ({
  taskId,
  taskTitle,
  promotionTitle,
  dueDate,
}: TaskNotificationInput) => {
  if (!dueDate) {
    return;
  }

  const hasPermission =
    await requestNotificationPermissions();

  if (!hasPermission) {
    return;
  }

  // Najpierw usuwamy wcześniejsze przypomnienia
  // dotyczące tego samego zadania.
  await cancelTaskNotifications(taskId);

  const now = new Date();

  const reminders = [
    {
      daysBefore: 3,
      title: 'Zostały 3 dni ⏳',
      body: `${promotionTitle}: ${taskTitle}`,
    },
    {
      daysBefore: 1,
      title: 'Termin już jutro ⚠️',
      body: `${promotionTitle}: ${taskTitle}`,
    },
    {
      daysBefore: 0,
      title: 'Termin mija dzisiaj 🔥',
      body: `${promotionTitle}: ${taskTitle}`,
    },
  ];

  for (const reminder of reminders) {
    const notificationDate =
      getNotificationDate(
        dueDate,
        reminder.daysBefore,
        10
      );

    // Nie planujemy powiadomienia,
    // jeśli jego termin już minął.
    if (notificationDate <= now) {
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body,
        sound: true,

        data: {
          taskId,
          promotionTitle,
          taskTitle,
          dueDate,
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
  }
};

export const schedulePromotionTaskNotifications = async (
  promotionTitle: string,
  tasks: {
    id: string;
    title: string;
    due_date: string | null;
  }[]
) => {
  for (const task of tasks) {
    if (!task.due_date) {
      continue;
    }

    await scheduleTaskNotifications({
      taskId: task.id,
      taskTitle: task.title,
      promotionTitle,
      dueDate: task.due_date,
    });
  }
};

export const cancelPromotionTaskNotifications = async (
  taskIds: string[]
) => {
  for (const taskId of taskIds) {
    await cancelTaskNotifications(taskId);
  }
};