import { router } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const promotions = [
  {
    id: 'santander',
    bank: 'Santander',
    bonus: 500,
    progress: 70,
  },
  {
    id: 'millennium',
    bank: 'Millennium',
    bonus: 600,
    progress: 40,
  },
  {
    id: 'pekao',
    bank: 'Pekao',
    bonus: 400,
    progress: 0,
  },
];

export default function HomeScreen() {
  const totalBonus = promotions.reduce(
    (sum, promotion) => sum + promotion.bonus,
    0
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.logo}>
          BankBonus
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            Twoje możliwe bonusy
          </Text>

          <Text style={styles.summaryAmount}>
            {totalBonus} zł
          </Text>

          <Text style={styles.summaryDescription}>
            Potencjalnie do zdobycia
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          Aktywne promocje
        </Text>

        {promotions.map((promotion) => (
          <View
            key={promotion.id}
            style={styles.promotionCard}
          >
            <Text style={styles.bankName}>
              {promotion.bank}
            </Text>

            <Text style={styles.bonus}>
              +{promotion.bonus} zł
            </Text>

            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progress,
                  {
                    width: `${promotion.progress}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.progressText}>
                Postęp: {promotion.progress}%
              </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: '/promotion',
                    params: {
                      id: promotion.id,
                    },
                  })
                }
              >
                <Text style={styles.details}>
                  Zobacz →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.allButton}
          activeOpacity={0.7}
        >
          <Text style={styles.allButtonText}>
            Zobacz wszystkie promocje
          </Text>
        </TouchableOpacity>

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

  logo: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 24,
  },

  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
  },

  summaryLabel: {
    color: '#D1D5DB',
    fontSize: 15,
    marginBottom: 8,
  },

  summaryAmount: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
  },

  summaryDescription: {
    color: '#9CA3AF',
    marginTop: 6,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },

  promotionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },

  bankName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  bonus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16A34A',
    marginTop: 4,
    marginBottom: 16,
  },

  progressBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },

  progress: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },

  progressRow: {
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
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },

  allButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    padding: 17,
    alignItems: 'center',
    marginTop: 10,
  },

  allButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});