import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type StartPromotionValues = {
  accountOpenedAt?: Date;
  promotionRegisteredAt?: Date;
};

type Props = {
  visible: boolean;
  loading?: boolean;
  requireAccountOpenedAt: boolean;
  requirePromotionRegisteredAt: boolean;
  onClose: () => void;
  onConfirm: (values: StartPromotionValues) => void;
};

const toPolishDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
};

const parsePolishDate = (value: string): Date | null => {
  const match = value
    .trim()
    .match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(12, 0, 0, 0);

  return date;
};

export default function AddPromotionModal({
  visible,
  loading = false,
  requireAccountOpenedAt,
  requirePromotionRegisteredAt,
  onClose,
  onConfirm,
}: Props) {

  
  const [accountOpenedAt, setAccountOpenedAt] =
    useState('');

  const [
    promotionRegisteredAt,
    setPromotionRegisteredAt,
  ] = useState('');

  const [error, setError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    const today = toPolishDate(new Date());


    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset formularza po otwarciu modala
    setAccountOpenedAt(today);
    setPromotionRegisteredAt(today);
    setError(null);
  }, [visible]);

  const handleConfirm = () => {
    const accountDate = requireAccountOpenedAt
      ? parsePolishDate(accountOpenedAt)
      : undefined;

    const promotionDate =
      requirePromotionRegisteredAt
        ? parsePolishDate(promotionRegisteredAt)
        : undefined;

    if (requireAccountOpenedAt && !accountDate) {
      setError(
        'Podaj poprawną datę otwarcia konta w formacie DD.MM.RRRR.'
      );
      return;
    }

    if (
      requirePromotionRegisteredAt &&
      !promotionDate
    ) {
      setError(
        'Podaj poprawną datę dołączenia do promocji w formacie DD.MM.RRRR.'
      );
      return;
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (accountDate && accountDate > today) {
      setError(
        'Data otwarcia konta nie może być z przyszłości.'
      );
      return;
    }

    if (promotionDate && promotionDate > today) {
      setError(
        'Data dołączenia do promocji nie może być z przyszłości.'
      );
      return;
    }

    setError(null);

    onConfirm({
  accountOpenedAt: accountDate ?? undefined,
  promotionRegisteredAt: promotionDate ?? undefined,
});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <Text style={styles.eyebrow}>
              ROZPOCZNIJ PROMOCJĘ
            </Text>

            <Text style={styles.title}>
              Ustaw daty startowe
            </Text>

            <Text style={styles.description}>
              Na ich podstawie BankBonusPlus
              wygeneruje Twój indywidualny
              harmonogram, terminy i przypomnienia.
            </Text>

            {requireAccountOpenedAt && (
              <View style={styles.dateCard}>
                <Text style={styles.dateLabel}>
                  DATA OTWARCIA KONTA
                </Text>

                <TextInput
                  value={accountOpenedAt}
                  onChangeText={setAccountOpenedAt}
                  placeholder="DD.MM.RRRR"
                  keyboardType="numbers-and-punctuation"
                  style={styles.dateInput}
                  maxLength={10}
                  editable={!loading}
                />

                <Text style={styles.dateHint}>
                  Np. 05.09.2026
                </Text>
              </View>
            )}

            {requirePromotionRegisteredAt && (
              <View style={styles.dateCard}>
                <Text style={styles.dateLabel}>
                  DATA DOŁĄCZENIA DO PROMOCJI
                </Text>

                <TextInput
                  value={promotionRegisteredAt}
                  onChangeText={setPromotionRegisteredAt}
                  placeholder="DD.MM.RRRR"
                  keyboardType="numbers-and-punctuation"
                  style={styles.dateInput}
                  maxLength={10}
                  editable={!loading}
                />

                <Text style={styles.dateHint}>
                  Data rejestracji lub złożenia
                  wniosku.
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>
            )}

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>
                Dlaczego pytamy o datę?
              </Text>

              <Text style={styles.infoText}>
                Część promocji liczy terminy od
                dnia otwarcia konta, a część od
                dnia dołączenia do promocji.
                Pokazujemy tylko daty potrzebne
                dla tej konkretnej oferty.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                loading &&
                  styles.confirmButtonDisabled,
              ]}
              disabled={loading}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={styles.confirmButtonText}
                >
                  Rozpocznij promocję
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              disabled={loading}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>
                Anuluj
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'flex-end',
  },

  sheet: {
    maxHeight: '88%',
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
  },

  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    marginBottom: 4,
  },

  content: {
    padding: 22,
    paddingBottom: 34,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#2563EB',
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#111827',
    marginTop: 7,
  },

  description: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    marginBottom: 20,
  },

  dateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 17,
    marginBottom: 12,
  },

  dateLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#6B7280',
  },

  dateInput: {
    marginTop: 8,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
  },

  dateHint: {
    fontSize: 12,
    lineHeight: 17,
    color: '#9CA3AF',
    marginTop: 6,
  },

  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },

  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },

  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    marginTop: 2,
    marginBottom: 18,
  },

  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E40AF',
  },

  infoText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#1D4ED8',
    marginTop: 5,
  },

  confirmButton: {
    backgroundColor: '#2563EB',
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmButtonDisabled: {
    opacity: 0.65,
  },

  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  cancelButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },

  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
  },
});
