import { useState } from 'react';


import {
  syncUserTaskNotifications,
} from '@/lib/dynamicNotifications';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';



type UserTask = {
  id: string;

user_promotion_id: string;
user_period_id: string | null;
task_order: number;
is_required: boolean;
completed_at: string | null;


  title: string;
  description: string | null;

  task_type:
    | 'checkbox'
    | 'counter'
    | 'amount'
    | 'balance'
    | 'login'
    | 'confirmation'
    | 'ongoing';

  current_count: number;
  target_count: number | null;

  current_amount: number;
  target_amount: number | null;

  completed: boolean;

  calculated_due_date: string | null;
};

type Props = {
  task: UserTask;

  onChange?: (task: UserTask) => void;
};

export default function UserTaskProgress({
  task,
  onChange,
}: Props) {
  const [currentTask, setCurrentTask] =
    useState<UserTask>(task);

  const [loading, setLoading] =
    useState(false);

  const updateLocalTask = async (
    updatedTask: UserTask
  ) => {
    setCurrentTask(updatedTask);


await syncUserTaskNotifications({
  id: updatedTask.id,
  title: updatedTask.title,
  completed: updatedTask.completed,
  calculated_due_date:
    updatedTask.calculated_due_date,
});



    onChange?.(updatedTask);
  };

  const changeCounter = async (
    increment: number
  ) => {
    if (loading) return;

    try {
      setLoading(true);

      const { data, error } =
        await supabase.rpc(
          'increment_user_task_count',
          {
            p_user_task_id:
              currentTask.id,

            p_increment:
              increment,
          }
        );

      if (error) {
        throw error;
      }

      if (data) {
        updateLocalTask(
          data as UserTask
        );
      }
    } catch (error: any) {
      console.error(
        'COUNTER ERROR:',
        error
      );

      Alert.alert(
        'Błąd',
        error?.message ||
          'Nie udało się zapisać postępu.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleCheckbox = async () => {
    if (loading) return;

    try {
      setLoading(true);

      const { data, error } =
        await supabase.rpc(
          'set_user_task_completed',
          {
            p_user_task_id:
              currentTask.id,

            p_completed:
              !currentTask.completed,
          }
        );

      if (error) {
        throw error;
      }

      if (data) {
        updateLocalTask(
          data as UserTask
        );
      }
    } catch (error: any) {
      console.error(
        'CHECKBOX ERROR:',
        error
      );

      Alert.alert(
        'Błąd',
        error?.message ||
          'Nie udało się zapisać postępu.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderCounter = () => {
    const current =
      currentTask.current_count || 0;

    const target =
      currentTask.target_count || 0;

    return (
      <View style={styles.counterArea}>
        <View style={styles.dots}>
          {Array.from({
            length: target,
          }).map((_, index) => {
            const active =
              index < current;

            return (
              <View
                key={index}
                style={[
                  styles.dot,

                  active &&
                    styles.dotActive,
                ]}
              />
            );
          })}
        </View>

        <View style={styles.counterBottom}>
          <Text
            style={styles.counterText}
          >
            {current} / {target}
          </Text>

          <View
            style={
              styles.counterControls
            }
          >
            <Pressable
              disabled={
                loading ||
                current <= 0
              }
              onPress={() =>
                changeCounter(-1)
              }
              style={[
                styles.counterButton,

                current <= 0 &&
                  styles.buttonDisabled,
              ]}
            >
              <Text
                style={
                  styles.counterButtonText
                }
              >
                −
              </Text>
            </Pressable>

            <Pressable
              disabled={
                loading ||
                current >= target
              }
              onPress={() =>
                changeCounter(1)
              }
              style={[
                styles.counterButton,

                styles.counterButtonPrimary,

                current >= target &&
                  styles.buttonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.counterButtonText,

                  styles.counterButtonPrimaryText,
                ]}
              >
                +
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  const renderCheckbox = () => (
    <Pressable
      disabled={loading}
      onPress={toggleCheckbox}
      style={[
        styles.checkbox,

        currentTask.completed &&
          styles.checkboxCompleted,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.checkboxText,

            currentTask.completed &&
              styles.checkboxTextCompleted,
          ]}
        >
          {currentTask.completed
            ? '✓'
            : ''}
        </Text>
      )}
    </Pressable>
  );

  const supportsCounter =
    currentTask.task_type ===
      'counter' ||
    currentTask.task_type ===
      'login';

      console.log(
  'USER TASK:',
  currentTask.title,
  currentTask.task_type,
  currentTask.current_count,
  currentTask.target_count
);

  const supportsCheckbox =
  currentTask.task_type === 'checkbox' ||
  currentTask.task_type === 'confirmation' ||
  currentTask.task_type === 'ongoing' ||
  currentTask.task_type === 'amount' ||
  currentTask.task_type === 'balance';

  return (
    <View
      style={[
        styles.card,

        currentTask.completed &&
          styles.cardCompleted,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.textArea}>
          <Text
            style={[
              styles.title,

              currentTask.completed &&
                styles.titleCompleted,
            ]}
          >
            {currentTask.title}
          </Text>

          {!!currentTask.description && (
            <Text
              style={
                styles.description
              }
            >
              {
                currentTask.description
              }
            </Text>
          )}

          {!!currentTask.calculated_due_date && (
            <Text
              style={styles.deadline}
            >
              Termin:{' '}
              {
                currentTask.calculated_due_date
              }
            </Text>
          )}
        </View>

        {supportsCheckbox &&
          renderCheckbox()}
      </View>

      {supportsCounter &&
        renderCounter()}

      {currentTask.completed && (
        <Text
          style={
            styles.completedLabel
          }
        >
          ✓ Warunek spełniony
        </Text>
      )}



    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  cardCompleted: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  textArea: {
    flex: 1,
  },

  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  titleCompleted: {
    color: '#166534',
  },

  description: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },

  deadline: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  counterArea: {
    marginTop: 16,
  },

  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },

  dotActive: {
    backgroundColor: '#16A34A',
  },

  counterBottom: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  counterText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },

  counterControls: {
    flexDirection: 'row',
    gap: 8,
  },

  counterButton: {
    width: 42,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },

  counterButtonPrimary: {
    backgroundColor: '#111827',
  },

  counterButtonText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
  },

  counterButtonPrimaryText: {
    color: '#FFFFFF',
  },

  buttonDisabled: {
    opacity: 0.3,
  },

  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxCompleted: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },

  checkboxText: {
    fontSize: 18,
    fontWeight: '800',
  },

  checkboxTextCompleted: {
    color: '#FFFFFF',
  },

  completedLabel: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
});