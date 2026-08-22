import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
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
  status: string;
  banks: {
    name: string;
    logo_url: string | null;
  };
};

export default function HomeScreen() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPromotions = async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select(`
          id,
          title,
          bonus_amount,
          description,
          status,
          banks (
            name,
            logo_url
          )
        `)
        .eq('status', 'active');

      if (error) {
        console.error('SUPABASE ERROR:', error);
        setError('Nie udało się pobrać promocji.');
        setLoading(false);
        return;
      }

      console.log('PROMOTIONS FROM SUPABASE:', data);

      setPromotions(data as Promotion[]);
      setLoading(false);
    };

    loadPromotions();
  }, []);

  const totalBonus = promotions.reduce(
    (sum, promotion) => sum + promotion.bonus_amount,
    0
  );

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

  if (error) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          {error}
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.retryButtonText}>
            Spróbuj ponownie
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

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
              {promotion.banks.name}
            </Text>

            <Text style={styles.promotionTitle}>
              {promotion.title}
            </Text>

            <Text style={styles.bonus}>
              +{promotion.bonus_amount} zł
            </Text>

            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progress,
                  {
                    width: '0%',
                  },
                ]}
              />
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.progressText}>
                Postęp: 0%
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

  promotionTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },

  bonus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16A34A',
    marginTop: 8,
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