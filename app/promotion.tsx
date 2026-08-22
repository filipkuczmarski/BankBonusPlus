import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const promotions = {
  santander: {
    bank: 'Santander',
    bonus: 500,
    tasks: [
      'Załóż konto osobiste',
      'Wykonaj 5 płatności kartą',
      'Wpłać minimum 1000 zł',
      'Zaloguj się do aplikacji bankowej',
    ],
  },

  millennium: {
    bank: 'Millennium',
    bonus: 600,
    tasks: [
      'Załóż konto osobiste',
      'Wykonaj 5 płatności kartą',
      'Zapewnij wpływ minimum 2000 zł',
      'Wykonaj płatność mobilną',
    ],
  },

  pekao: {
    bank: 'Pekao',
    bonus: 400,
    tasks: [
      'Załóż konto osobiste',
      'Zamów kartę',
      'Wykonaj 3 płatności kartą',
      'Zaloguj się do aplikacji',
    ],
  },
};

export default function PromotionScreen() {
  const { id } = useLocalSearchParams();

  const promotionId = Array.isArray(id)
    ? id[0]
    : id;

  const promotion =
    promotions[promotionId as keyof typeof promotions] ??
    promotions.santander;

  const [completed, setCompleted] = useState<boolean[]>(
    promotion.tasks.map(() => false)
  );

  const toggleTask = (index: number) => {
    setCompleted((current) =>
      current.map((value, i) =>
        i === index ? !value : value
      )
    );
  };

  const completedCount =
    completed.filter(Boolean).length;

  const progress = Math.round(
    (completedCount / promotion.tasks.length) * 100
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            ← Wróć
          </Text>
        </TouchableOpacity>

        <Text style={styles.bank}>
          {promotion.bank}
        </Text>

        <Text style={styles.title}>
          Zdobądź do {promotion.bonus} zł
        </Text>

        <Text style={styles.description}>
          Wykonaj wszystkie wymagane kroki,
          aby otrzymać bonus.
        </Text>

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
            {completedCount} z {promotion.tasks.length} wykonanych
          </Text>

        </View>

        <Text style={styles.sectionTitle}>
          Co musisz zrobić?
        </Text>

        {promotion.tasks.map((task, index) => (

          <TouchableOpacity
            key={task}
            style={styles.task}
            onPress={() => toggleTask(index)}
            activeOpacity={0.7}
          >

            <View
              style={[
                styles.checkbox,
                completed[index] &&
                  styles.checkboxCompleted,
              ]}
            >

              {completed[index] && (
                <Text style={styles.checkmark}>
                  ✓
                </Text>
              )}

            </View>

            <Text
              style={[
                styles.taskText,
                completed[index] &&
                  styles.taskCompleted,
              ]}
            >
              {task}
            </Text>

          </TouchableOpacity>

        ))}

        {progress === 100 && (

          <View style={styles.successCard}>

            <Text style={styles.successTitle}>
              🎉 Wszystko gotowe!
            </Text>

            <Text style={styles.successText}>
              Spełniłeś wszystkie warunki
              promocji.
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

  taskText: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },

  taskCompleted: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
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

});