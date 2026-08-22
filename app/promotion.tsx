import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
  banks: {
    name: string;
    logo_url: string | null;
  };
};

type Task = {
  id: string;
  promotion_id: string;
  title: string;
  description: string | null;
  task_order: number;
};

export default function PromotionScreen() {
  const { id } = useLocalSearchParams();

  const promotionId = Array.isArray(id) ? id[0] : id;

  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
   * Unikalny klucz zapisu dla każdej promocji.
   * Ten sam klucz jest używany przez Dashboard.
   */
  const storageKey = promotionId
    ? 'bankbonus_progress_' + promotionId
    : null;

  useEffect(() => {
    const loadPromotion = async () => {
      if (!promotionId) {
        setError('Nie znaleziono promocji.');
        setLoading(false);
        return;
      }

      /*
       * Pobieramy dane promocji z Supabase.
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
          banks (
            name,
            logo_url
          )
        `)
        .eq('id', promotionId)
        .single();

      if (promotionError) {
        console.error('PROMOTION ERROR:', promotionError);
        setError('Nie udało się pobrać promocji.');
        setLoading(false);
        return;
      }

      /*
       * Pobieramy zadania przypisane do promocji.
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
        .order('task_order', { ascending: true });

      if (tasksError) {
        console.error('TASKS ERROR:', tasksError);
        setError('Nie udało się pobrać zadań.');
        setLoading(false);
        return;
      }

      const loadedTasks = (tasksData || []) as Task[];

      /*
       * Sprawdzamy, czy istnieje zapisany postęp
       * dla tej promocji.
       */
      let savedProgress: boolean[] | null = null;

      if (storageKey) {
        try {
          const saved = await AsyncStorage.getItem(storageKey);

          if (saved) {
            const parsed = JSON.parse(saved);

            /*
             * Obsługujemy zapis bezpośrednio jako tablicę:
             * [true, false, true]
             */
            if (
              Array.isArray(parsed) &&
              parsed.length === loadedTasks.length
            ) {
              savedProgress = parsed;
            }

            /*
             * Obsługujemy również ewentualny zapis
             * w formacie:
             * { completed: [true, false, true] }
             */
            if (
              !savedProgress &&
              parsed &&
              Array.isArray(parsed.completed) &&
              parsed.completed.length === loadedTasks.length
            ) {
              savedProgress = parsed.completed;
            }
          }
        } catch (storageError) {
          console.error(
            'ASYNC STORAGE READ ERROR:',
            storageError
          );
        }
      }

      setPromotion(promotionData as Promotion);
      setTasks(loadedTasks);

      /*
       * Jeśli znaleźliśmy zapisany postęp,
       * przywracamy go.
       *
       * Jeśli nie — wszystkie zadania zaczynają jako false.
       */
      setCompleted(
        savedProgress ?? loadedTasks.map(() => false)
      );

      setLoading(false);
    };

    loadPromotion();
  }, [promotionId, storageKey]);

  /*
   * Zaznaczenie / odznaczenie zadania.
   */
  const toggleTask = (index: number) => {
    setCompleted((current) => {
      const updated = current.map((value, i) => {
        if (i === index) {
          return !value;
        }

        return value;
      });

      /*
       * Zapisujemy nowy stan lokalnie na telefonie.
       */
      if (storageKey) {
        
        AsyncStorage.setItem(
          storageKey,
          JSON.stringify(updated)
        ).catch((storageError) => {
          console.error(
            'ASYNC STORAGE WRITE ERROR:',
            storageError
          );
        });
      }

      return updated;
    });
  };

  /*
   * Liczba wykonanych zadań.
   */
  const completedCount = completed.filter(Boolean).length;

  /*
   * Procent postępu.
   */
  const progress =
    tasks.length > 0
      ? Math.round(
          (completedCount / tasks.length) * 100
        )
      : 0;

  /*
   * Ekran ładowania.
   */
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Ładowanie promocji...
        </Text>
      </SafeAreaView>
    );
  }

  /*
   * Ekran błędu.
   */
  if (error || !promotion) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          {error || 'Nie znaleziono promocji.'}
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.retryButtonText}>
            Wróć
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  /*
   * Główny ekran promocji.
   */
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>
            ← Wróć
          </Text>
        </TouchableOpacity>

        <Text style={styles.bank}>
          {promotion.banks.name}
        </Text>

        <Text style={styles.title}>
          {promotion.title}
        </Text>

        <Text style={styles.bonus}>
          +{promotion.bonus_amount} zł
        </Text>

        {promotion.description && (
          <Text style={styles.description}>
            {promotion.description}
          </Text>
        )}

        <View style={styles.progressCard}>

          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              Twój postęp
            </Text>

            <Text style={styles.progressPercent}>
              {progress}%
            </Text>
          </View>

          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progress,
                {
                  width: `${progress}%`,
                },
              ]}
            />
          </View>

          <Text style={styles.progressText}>
            {completedCount} z {tasks.length} wykonanych
          </Text>

        </View>

        <Text style={styles.sectionTitle}>
          Co musisz zrobić?
        </Text>

        {tasks.map((task, index) => (
          <TouchableOpacity
            key={task.id}
            style={styles.task}
            onPress={() => toggleTask(index)}
            activeOpacity={0.7}
          >

            <View
              style={[
                styles.checkbox,
                completed[index] && styles.checkboxCompleted,
              ]}
            >
              {completed[index] && (
                <Text style={styles.checkmark}>
                  ✓
                </Text>
              )}
            </View>

            <View style={styles.taskContent}>

              <Text
                style={[
                  styles.taskText,
                  completed[index] && styles.taskCompleted,
                ]}
              >
                {task.title}
              </Text>

              {task.description && (
                <Text style={styles.taskDescription}>
                  {task.description}
                </Text>
              )}

            </View>

          </TouchableOpacity>
        ))}

        {progress === 100 && (
          <View style={styles.successCard}>

            <Text style={styles.successTitle}>
              🎉 Wszystko gotowe!
            </Text>

            <Text style={styles.successText}>
              Spełniłeś wszystkie warunki promocji.
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
    paddingBottom: 40,
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
    marginBottom: 24,
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