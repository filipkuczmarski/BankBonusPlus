import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '../../lib/supabase';

type PromotionCategory =
  | 'personal_account'
  | 'business_account'
  | 'card'
  | 'savings';

type PromotionDifficulty =
  | 'easy'
  | 'medium'
  | 'hard';

type CategoryFilter =
  | 'all'
  | PromotionCategory;

type SortOption =
  | 'default'
  | 'bonus_desc'
  | 'difficulty'
  | 'ending_soon';

type Promotion = {
  id: string;
  title: string;
  bonus_amount: number;
  description: string | null;
  status: string;
  end_date: string | null;

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
};

type UserTaskProgress = {
  task_id: string;
  completed: boolean;
};

type PromotionProgress = {
  total: number;
  completed: number;
  percentage: number;
};

const CATEGORY_FILTERS: {
  key: CategoryFilter;
  label: string;
}[] = [
  {
    key: 'all',
    label: 'Wszystkie',
  },
  {
    key: 'personal_account',
    label: 'Konta osobiste',
  },
  {
    key: 'business_account',
    label: 'Konta firmowe',
  },
  {
    key: 'card',
    label: 'Karty',
  },
  {
    key: 'savings',
    label: 'Oszczędności',
  },
];

const SORT_OPTIONS: {
  key: SortOption;
  label: string;
}[] = [
  {
    key: 'default',
    label: 'Domyślne',
  },
  {
    key: 'bonus_desc',
    label: 'Najwyższa premia',
  },
  {
    key: 'difficulty',
    label: 'Najłatwiejsze',
  },
  {
    key: 'ending_soon',
    label: 'Kończące się',
  },
];

const getCategoryLabel = (
  category: Promotion['category']
) => {
  switch (category) {
    case 'personal_account':
      return 'Konto osobiste';

    case 'business_account':
      return 'Konto firmowe';

    case 'card':
      return 'Karta';

    case 'savings':
      return 'Oszczędności / Lokaty';

    default:
      return null;
  }
};

const getDifficultyConfig = (
  difficulty: Promotion['difficulty']
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

const getDifficultyWeight = (
  difficulty: PromotionDifficulty | null
) => {
  switch (difficulty) {
    case 'easy':
      return 1;

    case 'medium':
      return 2;

    case 'hard':
      return 3;

    default:
      return 99;
  }
};

const formatFee = (fee: number | null) => {
  if (fee === null) return 'Brak danych';

  if (fee === 0) return '0 zł';

  return `${fee} zł/mies.`;
};

const getDaysRemaining = (
  endDate: string | null
) => {
  if (!endDate) return null;

  const [year, month, day] = endDate
    .split('-')
    .map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const end = new Date(
    year,
    month - 1,
    day
  );

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const difference =
    end.getTime() - today.getTime();

  return Math.ceil(
    difference /
      (1000 * 60 * 60 * 24)
  );
};

const getDaysRemainingLabel = (
  days: number | null
) => {
  if (days === null) return null;

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

export default function HomeScreen() {
  const [promotions, setPromotions] =
    useState<Promotion[]>([]);

  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>('all');

  const [selectedSort, setSelectedSort] =
    useState<SortOption>('default');

  const [onlyFree, setOnlyFree] =
    useState(false);

  const [progressByPromotion, setProgressByPromotion] =
    useState<Record<string, PromotionProgress>>({});

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const loadPromotions = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const {
          data: promotionsData,
          error: promotionsError,
        } = await supabase
          .from('promotions')
          .select(`
            id,
            title,
            bonus_amount,
            description,
            status,
            end_date,
            category,
            difficulty,
            account_fee,
            card_fee,
            banks (
              name,
              logo_url
            )
          `)
          .eq('status', 'active');

        if (promotionsError) {
          console.error(
            'PROMOTIONS ERROR:',
            promotionsError
          );

          return;
        }

        const loadedPromotions =
          (promotionsData || []) as Promotion[];

        setPromotions(loadedPromotions);

        if (loadedPromotions.length === 0) {
          setProgressByPromotion({});
          return;
        }

        const promotionIds =
          loadedPromotions.map(
            (promotion) => promotion.id
          );

        const {
          data: tasksData,
          error: tasksError,
        } = await supabase
          .from('tasks')
          .select(`
            id,
            promotion_id,
            title
          `)
          .in(
            'promotion_id',
            promotionIds
          );

        if (tasksError) {
          console.error(
            'TASKS ERROR:',
            tasksError
          );

          return;
        }

        const tasks =
          (tasksData || []) as Task[];

        if (tasks.length === 0) {
          const emptyProgress: Record<
            string,
            PromotionProgress
          > = {};

          loadedPromotions.forEach(
            (promotion) => {
              emptyProgress[promotion.id] = {
                total: 0,
                completed: 0,
                percentage: 0,
              };
            }
          );

          setProgressByPromotion(
            emptyProgress
          );

          return;
        }

        const {
          data: { user },
        } =
          await supabase.auth.getUser();

        let userProgress: UserTaskProgress[] =
          [];

        if (user) {
          const taskIds = tasks.map(
            (task) => task.id
          );

          const {
            data: progressData,
            error: progressError,
          } = await supabase
            .from('user_task_progress')
            .select(`
              task_id,
              completed
            `)
            .eq(
              'user_id',
              user.id
            )
            .in(
              'task_id',
              taskIds
            );

          if (progressError) {
            console.error(
              'PROGRESS ERROR:',
              progressError
            );
          } else {
            userProgress =
              (progressData ||
                []) as UserTaskProgress[];
          }
        }

        const completedTaskIds =
          new Set(
            userProgress
              .filter(
                (item) =>
                  item.completed
              )
              .map(
                (item) =>
                  item.task_id
              )
          );

        const calculatedProgress: Record<
          string,
          PromotionProgress
        > = {};

        loadedPromotions.forEach(
          (promotion) => {
            const promotionTasks =
              tasks.filter(
                (task) =>
                  task.promotion_id ===
                  promotion.id
              );

            const completed =
              promotionTasks.filter(
                (task) =>
                  completedTaskIds.has(
                    task.id
                  )
              ).length;

            const total =
              promotionTasks.length;

            calculatedProgress[
              promotion.id
            ] = {
              total,
              completed,
              percentage:
                total > 0
                  ? Math.round(
                      (completed /
                        total) *
                        100
                    )
                  : 0,
            };
          }
        );

        setProgressByPromotion(
          calculatedProgress
        );
      } catch (error) {
        console.error(
          'LOAD PROMOTIONS ERROR:',
          error
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  React.useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  useFocusEffect(
    useCallback(() => {
      loadPromotions(false);
    }, [loadPromotions])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadPromotions(false);
  };

  const visiblePromotions =
    useMemo(() => {
      let result = [...promotions];

      if (selectedCategory !== 'all') {
        result = result.filter(
          (promotion) =>
            promotion.category ===
            selectedCategory
        );
      }

      if (onlyFree) {
        result = result.filter(
          (promotion) =>
            promotion.account_fee === 0 &&
            promotion.card_fee === 0
        );
      }

      switch (selectedSort) {
        case 'bonus_desc':
          result.sort(
            (a, b) =>
              Number(b.bonus_amount || 0) -
              Number(a.bonus_amount || 0)
          );

          break;

        case 'difficulty':
          result.sort(
            (a, b) =>
              getDifficultyWeight(
                a.difficulty
              ) -
              getDifficultyWeight(
                b.difficulty
              )
          );

          break;

        case 'ending_soon':
          result.sort(
            (a, b) => {
              const daysA =
                getDaysRemaining(
                  a.end_date
                );

              const daysB =
                getDaysRemaining(
                  b.end_date
                );

              const normalizedA =
                daysA === null ||
                daysA < 0
                  ? Number.MAX_SAFE_INTEGER
                  : daysA;

              const normalizedB =
                daysB === null ||
                daysB < 0
                  ? Number.MAX_SAFE_INTEGER
                  : daysB;

              return (
                normalizedA -
                normalizedB
              );
            }
          );

          break;

        case 'default':
        default:
          break;
      }

      return result;
    }, [
      promotions,
      selectedCategory,
      selectedSort,
      onlyFree,
    ]);

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedSort !== 'default' ||
    onlyFree;

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedSort('default');
    setOnlyFree(false);
  };

  const totalBonus =
    promotions.reduce(
      (sum, promotion) =>
        sum +
        Number(
          promotion.bonus_amount || 0
        ),
      0
    );

  const totalTasks =
    Object.values(
      progressByPromotion
    ).reduce(
      (sum, progress) =>
        sum + progress.total,
      0
    );

  const completedTasks =
    Object.values(
      progressByPromotion
    ).reduce(
      (sum, progress) =>
        sum + progress.completed,
      0
    );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Ładowanie promocji...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.contentContainer
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          BANKBONUSPLUS
        </Text>

        <Text style={styles.title}>
          Promocje bankowe
        </Text>

        <Text style={styles.subtitle}>
          Znajdź najlepszą promocję i
          pilnuj wszystkich warunków w
          jednym miejscu.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text
            style={
              styles.summaryLabel
            }
          >
            Do zdobycia
          </Text>

          <Text
            style={
              styles.summaryValue
            }
          >
            {totalBonus} zł
          </Text>
        </View>

        <View
          style={styles.summaryDivider}
        />

        <View style={styles.summaryItem}>
          <Text
            style={
              styles.summaryLabel
            }
          >
            Wykonane zadania
          </Text>

          <Text
            style={
              styles.summaryValue
            }
          >
            {completedTasks}/
            {totalTasks}
          </Text>
        </View>
      </View>

      <View style={styles.categorySection}>
        <Text style={styles.filterSectionTitle}>
          Kategorie
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={
            styles.categoryFilters
          }
        >
          {CATEGORY_FILTERS.map(
            (category) => {
              const isSelected =
                selectedCategory ===
                category.key;

              return (
                <TouchableOpacity
                  key={category.key}
                  style={[
                    styles.categoryFilterButton,
                    isSelected &&
                      styles.categoryFilterButtonActive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() =>
                    setSelectedCategory(
                      category.key
                    )
                  }
                >
                  <Text
                    style={[
                      styles.categoryFilterText,
                      isSelected &&
                        styles.categoryFilterTextActive,
                    ]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>
      </View>

      <View style={styles.sortSection}>
        <Text style={styles.filterSectionTitle}>
          Sortuj
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={
            styles.sortFilters
          }
        >
          {SORT_OPTIONS.map(
            (option) => {
              const isSelected =
                selectedSort ===
                option.key;

              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.sortButton,
                    isSelected &&
                      styles.sortButtonActive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() =>
                    setSelectedSort(
                      option.key
                    )
                  }
                >
                  <Text
                    style={[
                      styles.sortButtonText,
                      isSelected &&
                        styles.sortButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>
      </View>

      <View style={styles.additionalFilters}>
        <TouchableOpacity
          style={[
            styles.freeFilterButton,
            onlyFree &&
              styles.freeFilterButtonActive,
          ]}
          activeOpacity={0.8}
          onPress={() =>
            setOnlyFree(
              (current) => !current
            )
          }
        >
          <View
            style={[
              styles.checkbox,
              onlyFree &&
                styles.checkboxActive,
            ]}
          >
            {onlyFree && (
              <Text
                style={
                  styles.checkboxCheck
                }
              >
                ✓
              </Text>
            )}
          </View>

          <Text
            style={[
              styles.freeFilterText,
              onlyFree &&
                styles.freeFilterTextActive,
            ]}
          >
            Tylko bez opłat
          </Text>
        </TouchableOpacity>

        {hasActiveFilters && (
          <TouchableOpacity
            onPress={resetFilters}
            activeOpacity={0.7}
          >
            <Text
              style={
                styles.resetFiltersText
              }
            >
              Wyczyść filtry
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {selectedCategory === 'all'
            ? 'Aktywne promocje'
            : CATEGORY_FILTERS.find(
                (item) =>
                  item.key ===
                  selectedCategory
              )?.label ||
              'Promocje'}
        </Text>

        <Text
          style={
            styles.sectionCounter
          }
        >
          {visiblePromotions.length}
        </Text>
      </View>

      {visiblePromotions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            Brak promocji
          </Text>

          <Text style={styles.emptyText}>
            Nie znaleźliśmy promocji
            pasujących do wybranych
            filtrów.
          </Text>

          {hasActiveFilters && (
            <TouchableOpacity
              style={
                styles.emptyResetButton
              }
              activeOpacity={0.8}
              onPress={resetFilters}
            >
              <Text
                style={
                  styles.emptyResetButtonText
                }
              >
                Wyczyść filtry
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        visiblePromotions.map(
          (promotion) => {
            const progress =
              progressByPromotion[
                promotion.id
              ] || {
                total: 0,
                completed: 0,
                percentage: 0,
              };

            const categoryLabel =
              getCategoryLabel(
                promotion.category
              );

            const difficulty =
              getDifficultyConfig(
                promotion.difficulty
              );

            const daysRemaining =
              getDaysRemaining(
                promotion.end_date
              );

            const daysLabel =
              getDaysRemainingLabel(
                daysRemaining
              );

            const isEndingSoon =
              daysRemaining !== null &&
              daysRemaining >= 0 &&
              daysRemaining <= 7;

            const isExpired =
              daysRemaining !== null &&
              daysRemaining < 0;

            return (
              <TouchableOpacity
                key={promotion.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname:
                      '/promotion',
                    params: {
                      id: promotion.id,
                    },
                  })
                }
              >
                <View
                  style={
                    styles.cardHeader
                  }
                >
                  <View
                    style={
                      styles.bankContainer
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
                        {promotion.banks
                          ?.name
                          ?.charAt(0)
                          ?.toUpperCase() ||
                          'B'}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.bankName
                      }
                    >
                      {promotion.banks
                        ?.name ||
                        'Bank'}
                    </Text>
                  </View>

                  {categoryLabel && (
                    <View
                      style={
                        styles.categoryBadge
                      }
                    >
                      <Text
                        style={
                          styles.categoryText
                        }
                      >
                        {categoryLabel}
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

                {daysLabel && (
                  <View
                    style={[
                      styles.daysBadge,
                      isEndingSoon &&
                        styles.daysBadgeUrgent,
                      isExpired &&
                        styles.daysBadgeExpired,
                    ]}
                  >
                    <Text
                      style={[
                        styles.daysText,
                        isEndingSoon &&
                          styles.daysTextUrgent,
                        isExpired &&
                          styles.daysTextExpired,
                      ]}
                    >
                      {daysLabel}
                    </Text>
                  </View>
                )}

                <View
                  style={
                    styles.bonusRow
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.bonusLabel
                      }
                    >
                      Premia
                    </Text>

                    <Text
                      style={
                        styles.bonusValue
                      }
                    >
                      +
                      {
                        promotion.bonus_amount
                      }{' '}
                      zł
                    </Text>
                  </View>

                  {difficulty && (
                    <View
                      style={[
                        styles.difficultyBadge,
                        {
                          backgroundColor:
                            difficulty.backgroundColor,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.difficultyDot,
                          {
                            backgroundColor:
                              difficulty.color,
                          },
                        ]}
                      />

                      <Text
                        style={[
                          styles.difficultyText,
                          {
                            color:
                              difficulty.color,
                          },
                        ]}
                      >
                        {difficulty.label}
                      </Text>
                    </View>
                  )}
                </View>

                <View
                  style={
                    styles.feesContainer
                  }
                >
                  <View
                    style={
                      styles.feeItem
                    }
                  >
                    <Text
                      style={
                        styles.feeLabel
                      }
                    >
                      Konto
                    </Text>

                    <Text
                      style={
                        styles.feeValue
                      }
                    >
                      {formatFee(
                        promotion.account_fee
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.feeDivider
                    }
                  />

                  <View
                    style={
                      styles.feeItem
                    }
                  >
                    <Text
                      style={
                        styles.feeLabel
                      }
                    >
                      Karta
                    </Text>

                    <Text
                      style={
                        styles.feeValue
                      }
                    >
                      {formatFee(
                        promotion.card_fee
                      )}
                    </Text>
                  </View>
                </View>

                {progress.total > 0 && (
                  <View
                    style={
                      styles.progressSection
                    }
                  >
                    <View
                      style={
                        styles.progressHeader
                      }
                    >
                      <Text
                        style={
                          styles.progressLabel
                        }
                      >
                        Twój postęp
                      </Text>

                      <Text
                        style={
                          styles.progressPercentage
                        }
                      >
                        {
                          progress.percentage
                        }
                        %
                      </Text>
                    </View>

                    <View
                      style={
                        styles.progressTrack
                      }
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${progress.percentage}%`,
                          },
                        ]}
                      />
                    </View>

                    <Text
                      style={
                        styles.progressTasks
                      }
                    >
                      {
                        progress.completed
                      }{' '}
                      z {progress.total}{' '}
                      zadań wykonanych
                    </Text>
                  </View>
                )}

                <View
                  style={styles.ctaRow}
                >
                  <Text
                    style={
                      styles.ctaText
                    }
                  >
                    Zobacz promocję
                  </Text>

                  <Text
                    style={
                      styles.ctaArrow
                    }
                  >
                    →
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
  },

  header: {
    marginTop: 10,
    marginBottom: 24,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#2563EB',
    marginBottom: 8,
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: '#6B7280',
  },

  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    marginBottom: 28,
  },

  summaryItem: {
    flex: 1,
  },

  summaryDivider: {
    width: 1,
    backgroundColor: '#374151',
    marginHorizontal: 16,
  },

  summaryLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },

  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  categorySection: {
    marginBottom: 22,
  },

  sortSection: {
    marginBottom: 18,
  },

  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 12,
  },

  categoryFilters: {
    paddingRight: 10,
  },

  categoryFilterButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
    marginRight: 9,
  },

  categoryFilterButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },

  categoryFilterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },

  categoryFilterTextActive: {
    color: '#FFFFFF',
  },

  sortFilters: {
    paddingRight: 10,
  },

  sortButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 9,
  },

  sortButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },

  sortButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },

  sortButtonTextActive: {
    color: '#FFFFFF',
  },

  additionalFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 12,
  },

  freeFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  freeFilterButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  checkboxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },

  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  freeFilterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },

  freeFilterTextActive: {
    color: '#2563EB',
  },

  resetFiltersText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
  },

  sectionCounter: {
    marginLeft: 10,
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },

  bankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  bankIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  bankIconText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563EB',
  },

  bankName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    flexShrink: 1,
  },

  categoryBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },

  promotionTitle: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
    color: '#111827',
  },

  daysBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },

  daysBadgeUrgent: {
    backgroundColor: '#FEF2F2',
  },

  daysBadgeExpired: {
    backgroundColor: '#F3F4F6',
  },

  daysText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },

  daysTextUrgent: {
    color: '#DC2626',
    fontWeight: '800',
  },

  daysTextExpired: {
    color: '#9CA3AF',
  },

  bonusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 20,
    marginBottom: 18,
  },

  bonusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 3,
  },

  bonusValue: {
    fontSize: 30,
    fontWeight: '900',
    color: '#16A34A',
  },

  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  difficultyDot: {
    width: 7,
    height: 7,
    borderRadius: 10,
    marginRight: 6,
  },

  difficultyText: {
    fontSize: 12,
    fontWeight: '800',
  },

  feesContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 18,
  },

  feeItem: {
    flex: 1,
  },

  feeDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },

  feeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 4,
  },

  feeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },

  progressSection: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
    marginBottom: 16,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  progressPercentage: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },

  progressTrack: {
    height: 7,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#2563EB',
  },

  progressTasks: {
    marginTop: 7,
    fontSize: 11,
    color: '#9CA3AF',
  },

  ctaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 15,
  },

  ctaText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563EB',
  },

  ctaArrow: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2563EB',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
  },

  emptyResetButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
  },

  emptyResetButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});