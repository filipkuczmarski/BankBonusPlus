import { router, useFocusEffect } from 'expo-router';
import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Modal,
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

type DynamicUserTask = {
  id: string;
  user_promotion_id: string;
  title: string;
  completed: boolean;
  is_required: boolean;
  calculated_due_date: string | null;
  task_order: number;
};

type PromotionProgress = {
  total: number;
  completed: number;
  percentage: number;
};

type UserPromotionStatus =
  | 'active'
  | 'completed';

type UserPromotion = {
  id: string;
  promotion_id: string;
  status: UserPromotionStatus;

  promotions: {
    id: string;
    title: string;
    bonus_amount: number;

    banks: {
      name: string;
    } | null;
  } | null;
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

const formatFee = (
  fee: number | null
) => {
  if (fee === null) {
    return 'Brak danych';
  }

  if (fee === 0) {
    return '0 zł';
  }

  return `${fee} zł/mies.`;
};

const formatMoney = (
  amount: number
) => {
  return Math.round(amount).toLocaleString(
    'pl-PL'
  );
};

const getDaysRemaining = (
  endDate: string | null
) => {
  if (!endDate) {
    return null;
  }

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


const formatDashboardDueDate = (
  dateString: string
) => {
  const [year, month, day] =
    dateString
      .split('-')
      .map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const diff = Math.ceil(
    (target.getTime() -
      today.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (diff < 0) {
    return `Po terminie • ${date.toLocaleDateString(
      'pl-PL'
    )}`;
  }

  if (diff === 0) {
    return 'Termin dzisiaj';
  }

  if (diff === 1) {
    return 'Termin jutro';
  }

  return `Do ${date.toLocaleDateString(
    'pl-PL'
  )} • ${diff} dni`;
};

export default function HomeScreen() {
  const [
    promotions,
    setPromotions,
  ] = useState<Promotion[]>([]);

  const [
    userPromotions,
    setUserPromotions,
  ] = useState<UserPromotion[]>([]);

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState<CategoryFilter>(
    'all'
  );

  const [
    selectedSort,
    setSelectedSort,
  ] = useState<SortOption>(
    'default'
  );

  const [
    onlyFree,
    setOnlyFree,
  ] = useState(false);

  const [
    progressByPromotion,
    setProgressByPromotion,
  ] = useState<
    Record<
      string,
      PromotionProgress
    >
  >({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(null);

  const [
    onboardingVisible,
    setOnboardingVisible,
  ] = useState(false);

  const [
    onboardingStep,
    setOnboardingStep,
  ] = useState(0);

  const [
    nearestTask,
    setNearestTask,
  ] = useState<{
    id: string;
    title: string;
    calculated_due_date: string;
    promotion_id: string;
    promotion_title: string;
    bank_name: string;
  } | null>(null);

  const loadPromotions =
    useCallback(
      async (
        showLoader = true
      ) => {
        try {
          setLoadError(null);

          if (showLoader) {
            setLoading(true);
          }

          /*
           * USER
           */

          const {
            data: {
              user,
            },
          } =
            await supabase.auth.getUser();

          if (
            user &&
            user.user_metadata
              ?.bankbonus_onboarding_completed !==
              true
          ) {
            setOnboardingVisible(true);
          }

          /*
           * KATALOG AKTYWNYCH PROMOCJI
           */

          const {
            data:
              promotionsData,
            error:
              promotionsError,
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
            .eq(
              'status',
              'active'
            );

          if (
            promotionsError
          ) {
            console.error(
              'PROMOTIONS ERROR:',
              promotionsError
            );

            setLoadError(
              'Nie udało się pobrać katalogu promocji. Sprawdź połączenie i spróbuj ponownie.'
            );

            return;
          }

          const loadedPromotions: Promotion[] = (
  promotionsData ?? []
).map((item) => ({
  ...item,
  banks: item.banks?.[0] ?? null,
}));

setPromotions(loadedPromotions);

          /*
           * PROMOCJE UŻYTKOWNIKA
           */

          let loadedUserPromotions:
            UserPromotion[] = [];

          if (user) {
            const {
              data:
                userPromotionsData,
              error:
                userPromotionsError,
            } = await supabase
              .from(
                'user_promotions'
              )
              .select(`
                id,
                promotion_id,
                status,
                promotions (
                  id,
                  title,
                  bonus_amount,
                  banks (
                    name
                  )
                )
              `)
              .eq(
                'user_id',
                user.id
              );

            if (
              userPromotionsError
            ) {
              console.error(
                'USER PROMOTIONS ERROR:',
                userPromotionsError
              );

              setLoadError(
                'Nie udało się pobrać Twoich promocji. Część dashboardu może być chwilowo niedostępna.'
              );

              setUserPromotions(
                []
              );
            } else {
              loadedUserPromotions =
                (userPromotionsData ||
                  []) as unknown as UserPromotion[];

              setUserPromotions(
                loadedUserPromotions
              );
            }
          } else {
            setUserPromotions(
              []
            );
          }

          /*
           * DYNAMICZNE ZADANIA UŻYTKOWNIKA
           */

          if (!user) {
            setProgressByPromotion({});
            setNearestTask(null);
            return;
          }

          const activeRows =
            loadedUserPromotions.filter(
              item =>
                item.status === 'active' &&
                item.promotions
            );

          const activeUserPromotionIds =
            activeRows.map(
              item => item.id
            );

          if (
            activeUserPromotionIds.length ===
            0
          ) {
            setProgressByPromotion({});
            setNearestTask(null);
            return;
          }

          const {
            data: dynamicTasksData,
            error: dynamicTasksError,
          } = await supabase
            .from('user_tasks')
            .select(`
              id,
              user_promotion_id,
              title,
              completed,
              is_required,
              calculated_due_date,
              task_order
            `)
            .eq(
              'user_id',
              user.id
            )
            .in(
              'user_promotion_id',
              activeUserPromotionIds
            );

          if (dynamicTasksError) {
            console.error(
              'DYNAMIC USER TASKS ERROR:',
              dynamicTasksError
            );

            setLoadError(
              'Nie udało się pobrać aktualnego postępu zadań. Spróbuj odświeżyć dashboard.'
            );

            setProgressByPromotion({});
            setNearestTask(null);
            return;
          }

          const dynamicTasks =
            (dynamicTasksData ||
              []) as DynamicUserTask[];

          /*
           * REALNY POSTĘP AKTYWNYCH PROMOCJI
           */

          const calculatedProgress: Record<
            string,
            PromotionProgress
          > = {};

          activeRows.forEach(
            userPromotion => {
              if (
                !userPromotion.promotions
              ) {
                return;
              }

              const promotionTasks =
                dynamicTasks.filter(
                  task =>
                    task.user_promotion_id ===
                    userPromotion.id &&
                    task.is_required !== false
                );

              const completed =
                promotionTasks.filter(
                  task =>
                    task.completed
                ).length;

              const total =
                promotionTasks.length;

              calculatedProgress[
                userPromotion.promotion_id
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

          /*
           * NAJBLIŻSZE NIEWYKONANE ZADANIE
           */

          const today = new Date();
          today.setHours(
            0,
            0,
            0,
            0
          );

          const upcomingTasks =
            dynamicTasks
              .filter(
                task =>
                  !task.completed &&
                  task.is_required !==
                    false &&
                  Boolean(
                    task.calculated_due_date
                  )
              )
              .map(task => {
                const userPromotion =
                  activeRows.find(
                    item =>
                      item.id ===
                      task.user_promotion_id
                  );

                return {
                  task,
                  userPromotion,
                };
              })
              .filter(
                item =>
                  item.userPromotion
                    ?.promotions
              )
              .sort((a, b) => {
                const dateA =
                  new Date(
                    `${a.task.calculated_due_date}T12:00:00`
                  ).getTime();

                const dateB =
                  new Date(
                    `${b.task.calculated_due_date}T12:00:00`
                  ).getTime();

                return dateA - dateB;
              });

          const next =
            upcomingTasks.find(
              item => {
                const due =
                  new Date(
                    `${item.task.calculated_due_date}T12:00:00`
                  );

                return (
                  due.getTime() >=
                  today.getTime()
                );
              }
            ) ??
            upcomingTasks[0] ??
            null;

          if (
            next &&
            next.userPromotion
              ?.promotions &&
            next.task
              .calculated_due_date
          ) {
            setNearestTask({
              id: next.task.id,
              title:
                next.task.title,
              calculated_due_date:
                next.task
                  .calculated_due_date,
              promotion_id:
                next.userPromotion
                  .promotion_id,
              promotion_title:
                next.userPromotion
                  .promotions.title,
              bank_name:
                next.userPromotion
                  .promotions.banks
                  ?.name || 'Bank',
            });
          } else {
            setNearestTask(null);
          }
        } catch (error) {
          console.error(
            'LOAD PROMOTIONS ERROR:',
            error
          );

          setLoadError(
            'Wystąpił problem podczas ładowania dashboardu. Spróbuj ponownie.'
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );



  useFocusEffect(
    useCallback(() => {
      loadPromotions(false);
    }, [loadPromotions])
  );

  const handleRefresh = () => {
    setRefreshing(true);

    loadPromotions(false);
  };

  /*
   * DASHBOARD USERA
   */

  const activeUserPromotions =
    useMemo(
      () =>
        userPromotions.filter(
          (
            item
          ) =>
            item.status ===
            'active' &&
            item.promotions
        ),
      [
        userPromotions,
      ]
    );

  const completedUserPromotions =
    useMemo(
      () =>
        userPromotions.filter(
          (
            item
          ) =>
            item.status ===
            'completed' &&
            item.promotions
        ),
      [
        userPromotions,
      ]
    );

  const bonusToEarn =
    activeUserPromotions.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.promotions
            ?.bonus_amount ||
            0
        ),
      0
    );

  const bonusEarned =
    completedUserPromotions.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.promotions
            ?.bonus_amount ||
            0
        ),
      0
    );

  /*
   * FILTRY KATALOGU
   */

  const visiblePromotions =
    useMemo(() => {
      let result = [
        ...promotions,
      ];

      if (
        selectedCategory !==
        'all'
      ) {
        result =
          result.filter(
            (
              promotion
            ) =>
              promotion.category ===
              selectedCategory
          );
      }

      if (onlyFree) {
        result =
          result.filter(
            (
              promotion
            ) =>
              promotion.account_fee ===
                0 &&
              promotion.card_fee ===
                0
          );
      }

      switch (
        selectedSort
      ) {
        case 'bonus_desc':
          result.sort(
            (
              a,
              b
            ) =>
              Number(
                b.bonus_amount ||
                  0
              ) -
              Number(
                a.bonus_amount ||
                  0
              )
          );

          break;

        case 'difficulty':
          result.sort(
            (
              a,
              b
            ) =>
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
            (
              a,
              b
            ) => {
              const daysA =
                getDaysRemaining(
                  a.end_date
                );

              const daysB =
                getDaysRemaining(
                  b.end_date
                );

              const normalizedA =
                daysA ===
                  null ||
                daysA < 0
                  ? Number.MAX_SAFE_INTEGER
                  : daysA;

              const normalizedB =
                daysB ===
                  null ||
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
    selectedCategory !==
      'all' ||
    selectedSort !==
      'default' ||
    onlyFree;

  const resetFilters = () => {
    setSelectedCategory(
      'all'
    );

    setSelectedSort(
      'default'
    );

    setOnlyFree(
      false
    );
  };

  const completeOnboarding =
    async () => {
      try {
        const {
          error,
        } =
          await supabase.auth.updateUser({
            data: {
              bankbonus_onboarding_completed:
                true,
            },
          });

        if (error) {
          console.error(
            'ONBOARDING UPDATE ERROR:',
            error
          );
        }
      } finally {
        setOnboardingVisible(false);
        setOnboardingStep(0);
      }
    };

  const onboardingSlides = [
    {
      icon: '🔎',
      eyebrow: 'KROK 1 Z 3',
      title: 'Znajdź dobrą promocję',
      text:
        'Porównuj premie, opłaty, trudność i termin zakończenia. Gdy coś Cię interesuje, zapisz ofertę do swoich promocji.',
    },
    {
      icon: '▶️',
      eyebrow: 'KROK 2 Z 3',
      title: 'Rozpocznij, kiedy otworzysz konto',
      text:
        'Po rozpoczęciu promocji BankBonusPlus wygeneruje Twój indywidualny harmonogram na podstawie wymaganych dat.',
    },
    {
      icon: '✅',
      eyebrow: 'KROK 3 Z 3',
      title: 'Realizuj warunki bez stresu',
      text:
        'Odhaczaj zadania, pilnuj liczników i terminów. Dashboard pokaże postęp, a aplikacja przypomni o ważnych deadline’ach.',
    },
  ];

  if (loading) {
    return (
      <View
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
          Ładowanie...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={
        styles.container
      }
      contentContainerStyle={
        styles.contentContainer
      }
      refreshControl={
        <RefreshControl
          refreshing={
            refreshing
          }
          onRefresh={
            handleRefresh
          }
        />
      }
    >
      {/* HEADER */}

      <View
        style={
          styles.header
        }
      >
        <Text
          style={
            styles.eyebrow
          }
        >
          BANKBONUSPLUS
        </Text>

        <Text
          style={
            styles.title
          }
        >
          Twój dashboard
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Kontroluj swoje
          promocje i zgarniaj
          bankowe bonusy.
        </Text>
      </View>

      {loadError && (
        <View
          style={
            styles.errorBanner
          }
        >
          <View
            style={
              styles.errorBannerTextWrap
            }
          >
            <Text
              style={
                styles.errorBannerTitle
              }
            >
              Coś poszło nie tak
            </Text>

            <Text
              style={
                styles.errorBannerText
              }
            >
              {loadError}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() =>
              loadPromotions(true)
            }
          >
            <Text
              style={
                styles.errorBannerAction
              }
            >
              Ponów
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* GŁÓWNY DASHBOARD */}

      <View
        style={
          styles.heroCard
        }
      >
        <Text
          style={
            styles.heroLabel
          }
        >
          DO ZDOBYCIA
        </Text>

        <Text
          style={
            styles.heroValue
          }
        >
          {formatMoney(
            bonusToEarn
          )}{' '}
          zł
        </Text>

        <Text
          style={
            styles.heroDescription
          }
        >
          {activeUserPromotions.length ===
          1
            ? 'w 1 aktywnej promocji'
            : `w ${activeUserPromotions.length} aktywnych promocjach`}
        </Text>
      </View>

      {/* MAŁE STATYSTYKI */}

      <View
        style={
          styles.statsRow
        }
      >
        <View
          style={
            styles.statCard
          }
        >
          <Text
            style={
              styles.statLabel
            }
          >
            ZDOBYTE
          </Text>

          <Text
            style={
              styles.statValueGreen
            }
          >
            {formatMoney(
              bonusEarned
            )}{' '}
            zł
          </Text>

          <Text
            style={
              styles.statCaption
            }
          >
            Łącznie
          </Text>
        </View>

        <View
          style={
            styles.statCard
          }
        >
          <Text
            style={
              styles.statLabel
            }
          >
            AKTYWNE
          </Text>

          <Text
            style={
              styles.statValue
            }
          >
            {
              activeUserPromotions.length
            }
          </Text>

          <Text
            style={
              styles.statCaption
            }
          >
            Promocje
          </Text>
        </View>
      </View>

      {/* NAJBLIŻSZE ZADANIE */}

      {nearestTask && (
        <TouchableOpacity
          style={
            styles.nearestTaskCard
          }
          activeOpacity={0.85}
          onPress={() =>
            router.push({
              pathname:
                '/promotion',
              params: {
                id:
                  nearestTask.promotion_id,
              },
            })
          }
        >
          <View
            style={
              styles.nearestTaskTop
            }
          >
            <Text
              style={
                styles.nearestTaskEyebrow
              }
            >
              NAJBLIŻSZE ZADANIE
            </Text>

            <Text
              style={
                styles.nearestTaskArrow
              }
            >
              →
            </Text>
          </View>

          <Text
            style={
              styles.nearestTaskTitle
            }
          >
            {nearestTask.title}
          </Text>

          <Text
            style={
              styles.nearestTaskPromotion
            }
          >
            {nearestTask.bank_name}
            {' • '}
            {
              nearestTask.promotion_title
            }
          </Text>

          <View
            style={
              styles.nearestTaskDeadline
            }
          >
            <Text
              style={
                styles.nearestTaskDeadlineText
              }
            >
              {formatDashboardDueDate(
                nearestTask.calculated_due_date
              )}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* TWOJE AKTYWNE PROMOCJE */}

      <View
        style={
          styles.myPromotionsSection
        }
      >
        <View
          style={
            styles.sectionHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Twoje aktywne promocje
          </Text>

          <TouchableOpacity
            activeOpacity={
              0.7
            }
            onPress={() =>
              router.push(
                '/my-promotions'
              )
            }
          >
            <Text
              style={
                styles.seeAllText
              }
            >
              Zobacz wszystkie
            </Text>
          </TouchableOpacity>
        </View>

        {activeUserPromotions.length ===
        0 ? (
          <View
            style={
              styles.noActiveCard
            }
          >
            <Text
              style={
                styles.noActiveTitle
              }
            >
              Nie śledzisz jeszcze
              żadnej promocji
            </Text>

            <Text
              style={
                styles.noActiveText
              }
            >
              Wybierz promocję z
              katalogu poniżej i
              dodaj ją do swoich.
            </Text>
          </View>
        ) : (
          activeUserPromotions.map(
            (
              userPromotion
            ) => {
              const promotion =
                userPromotion.promotions;

              if (
                !promotion
              ) {
                return null;
              }

              const progress =
                progressByPromotion[
                  promotion.id
                ] || {
                  total: 0,
                  completed: 0,
                  percentage: 0,
                };

              return (
                <TouchableOpacity
                  key={
                    promotion.id
                  }
                  style={
                    styles.myPromotionCard
                  }
                  activeOpacity={
                    0.85
                  }
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
                      styles.myPromotionHeader
                    }
                  >
                    <View
                      style={
                        styles.myPromotionInfo
                      }
                    >
                      <Text
                        style={
                          styles.myPromotionBank
                        }
                      >
                        {promotion
                          .banks
                          ?.name ||
                          'Bank'}
                      </Text>

                      <Text
                        style={
                          styles.myPromotionTitle
                        }
                        numberOfLines={
                          2
                        }
                      >
                        {
                          promotion.title
                        }
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.myPromotionBonus
                      }
                    >
                      +
                      {formatMoney(
                        Number(
                          promotion.bonus_amount ||
                            0
                        )
                      )}{' '}
                      zł
                    </Text>
                  </View>

                  {progress.total >
                    0 && (
                    <View
                      style={
                        styles.myProgressSection
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
                          {
                            progress.completed
                          }{' '}
                          z{' '}
                          {
                            progress.total
                          }{' '}
                          zadań
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
                    </View>
                  )}
                </TouchableOpacity>
              );
            }
          )
        )}
      </View>

      {/* DISCOVERY */}

      <View
        style={
          styles.discoveryHeader
        }
      >
        <Text
          style={
            styles.discoveryEyebrow
          }
        >
          ODKRYWAJ
        </Text>

        <Text
          style={
            styles.discoveryTitle
          }
        >
          Znajdź kolejną promocję
        </Text>

        <Text
          style={
            styles.discoverySubtitle
          }
        >
          Porównaj dostępne
          bonusy i wybierz
          najlepszą ofertę dla
          siebie.
        </Text>
      </View>

      {/* KATEGORIE */}

      <View
        style={
          styles.categorySection
        }
      >
        <Text
          style={
            styles.filterSectionTitle
          }
        >
          Kategorie
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.categoryFilters
          }
        >
          {CATEGORY_FILTERS.map(
            (
              category
            ) => {
              const isSelected =
                selectedCategory ===
                category.key;

              return (
                <TouchableOpacity
                  key={
                    category.key
                  }
                  style={[
                    styles.categoryFilterButton,
                    isSelected &&
                      styles.categoryFilterButtonActive,
                  ]}
                  activeOpacity={
                    0.8
                  }
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
                    {
                      category.label
                    }
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>
      </View>

      {/* SORTOWANIE */}

      <View
        style={
          styles.sortSection
        }
      >
        <Text
          style={
            styles.filterSectionTitle
          }
        >
          Sortuj
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.sortFilters
          }
        >
          {SORT_OPTIONS.map(
            (
              option
            ) => {
              const isSelected =
                selectedSort ===
                option.key;

              return (
                <TouchableOpacity
                  key={
                    option.key
                  }
                  style={[
                    styles.sortButton,
                    isSelected &&
                      styles.sortButtonActive,
                  ]}
                  activeOpacity={
                    0.8
                  }
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
                    {
                      option.label
                    }
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>
      </View>

      {/* BEZ OPŁAT */}

      <View
        style={
          styles.additionalFilters
        }
      >
        <TouchableOpacity
          style={[
            styles.freeFilterButton,
            onlyFree &&
              styles.freeFilterButtonActive,
          ]}
          activeOpacity={
            0.8
          }
          onPress={() =>
            setOnlyFree(
              (
                current
              ) =>
                !current
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
            onPress={
              resetFilters
            }
            activeOpacity={
              0.7
            }
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

      {/* LISTA PROMOCJI */}

      <View
        style={
          styles.sectionHeader
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          {selectedCategory ===
          'all'
            ? 'Dostępne promocje'
            : CATEGORY_FILTERS.find(
                (
                  item
                ) =>
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
          {
            visiblePromotions.length
          }
        </Text>
      </View>

      {visiblePromotions.length ===
      0 ? (
        <View
          style={
            styles.emptyCard
          }
        >
          <Text
            style={
              styles.emptyTitle
            }
          >
            Brak promocji
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            Nie znaleźliśmy
            promocji pasujących
            do wybranych filtrów.
          </Text>

          {hasActiveFilters && (
            <TouchableOpacity
              style={
                styles.emptyResetButton
              }
              activeOpacity={
                0.8
              }
              onPress={
                resetFilters
              }
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
          (
            promotion
          ) => {
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
              daysRemaining !==
                null &&
              daysRemaining >=
                0 &&
              daysRemaining <=
                7;

            const isExpired =
              daysRemaining !==
                null &&
              daysRemaining <
                0;

            return (
              <TouchableOpacity
                key={
                  promotion.id
                }
                style={
                  styles.card
                }
                activeOpacity={
                  0.85
                }
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
                        {promotion
                          .banks
                          ?.name
                          ?.charAt(
                            0
                          )
                          ?.toUpperCase() ||
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
                        {
                          categoryLabel
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
                  {
                    promotion.title
                  }
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
                      {
                        daysLabel
                      }
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
                        {
                          difficulty.label
                        }
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

                {progress.total >
                  0 && (
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
                      z{' '}
                      {
                        progress.total
                      }{' '}
                      zadań
                      wykonanych
                    </Text>
                  </View>
                )}

                <View
                  style={
                    styles.ctaRow
                  }
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
      {/* FEEDBACK */}

      <TouchableOpacity
        style={
          styles.feedbackCard
        }
        activeOpacity={0.85}
        onPress={() =>
          router.push('/feedback')
        }
      >
        <View
          style={
            styles.feedbackIcon
          }
        >
          <Text
            style={
              styles.feedbackIconText
            }
          >
            💬
          </Text>
        </View>

        <View
          style={
            styles.feedbackContent
          }
        >
          <Text
            style={
              styles.feedbackTitle
            }
          >
            Pomóż ulepszyć BankBonusPlus
          </Text>

          <Text
            style={
              styles.feedbackText
            }
          >
            Znalazłeś błąd albo masz pomysł?
            Napisz nam w kilkanaście sekund.
          </Text>
        </View>

        <Text
          style={
            styles.feedbackArrow
          }
        >
          →
        </Text>
      </TouchableOpacity>

      {/* ONBOARDING */}

      <Modal
        visible={onboardingVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View
          style={
            styles.onboardingOverlay
          }
        >
          <View
            style={
              styles.onboardingCard
            }
          >
            <View
              style={
                styles.onboardingTop
              }
            >
              <Text
                style={
                  styles.onboardingEyebrow
                }
              >
                {
                  onboardingSlides[
                    onboardingStep
                  ].eyebrow
                }
              </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={
                  completeOnboarding
                }
              >
                <Text
                  style={
                    styles.onboardingSkip
                  }
                >
                  Pomiń
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={
                styles.onboardingIcon
              }
            >
              {
                onboardingSlides[
                  onboardingStep
                ].icon
              }
            </Text>

            <Text
              style={
                styles.onboardingTitle
              }
            >
              {
                onboardingSlides[
                  onboardingStep
                ].title
              }
            </Text>

            <Text
              style={
                styles.onboardingText
              }
            >
              {
                onboardingSlides[
                  onboardingStep
                ].text
              }
            </Text>

            <View
              style={
                styles.onboardingDots
              }
            >
              {[0, 1, 2].map(
                dot => (
                  <View
                    key={dot}
                    style={[
                      styles.onboardingDot,
                      dot ===
                        onboardingStep &&
                        styles.onboardingDotActive,
                    ]}
                  />
                )
              )}
            </View>

            <TouchableOpacity
              style={
                styles.onboardingButton
              }
              activeOpacity={0.85}
              onPress={() => {
                if (
                  onboardingStep <
                  onboardingSlides.length -
                    1
                ) {
                  setOnboardingStep(
                    current =>
                      current + 1
                  );
                } else {
                  completeOnboarding();
                }
              }}
            >
              <Text
                style={
                  styles.onboardingButtonText
                }
              >
                {onboardingStep ===
                onboardingSlides.length -
                  1
                  ? 'Zaczynam'
                  : 'Dalej'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#F7F8FA',
    },

    contentContainer: {
      padding: 20,
      paddingBottom: 40,
    },

    loadingContainer: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#F7F8FA',
    },

    loadingText: {
      marginTop: 12,
      fontSize: 15,
      color: '#6B7280',
    },

    header: {
      marginTop: 10,
      marginBottom: 22,
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

    /*
     * DASHBOARD
     */

    heroCard: {
      backgroundColor:
        '#111827',
      borderRadius: 22,
      padding: 22,
      marginBottom: 12,
    },

    heroLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
      color: '#9CA3AF',
      marginBottom: 10,
    },

    heroValue: {
      fontSize: 38,
      fontWeight: '900',
      color: '#FFFFFF',
    },

    heroDescription: {
      marginTop: 7,
      fontSize: 14,
      color: '#D1D5DB',
    },

    statsRow: {
      flexDirection:
        'row',
      gap: 12,
      marginBottom: 30,
    },

    statCard: {
      flex: 1,
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      padding: 17,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.04,

      shadowRadius: 6,
      elevation: 1,
    },

    statLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: '#9CA3AF',
      marginBottom: 8,
    },

    statValue: {
      fontSize: 23,
      fontWeight: '900',
      color: '#111827',
    },

    statValueGreen: {
      fontSize: 23,
      fontWeight: '900',
      color: '#16A34A',
    },

    statCaption: {
      marginTop: 4,
      fontSize: 11,
      color: '#9CA3AF',
    },

    nearestTaskCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      padding: 18,
      marginBottom: 30,
      borderWidth: 1,
      borderColor:
        '#DBEAFE',

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },

    nearestTaskTop: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom: 9,
    },

    nearestTaskEyebrow: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.9,
      color: '#2563EB',
    },

    nearestTaskArrow: {
      fontSize: 19,
      fontWeight: '700',
      color: '#2563EB',
    },

    nearestTaskTitle: {
      fontSize: 17,
      lineHeight: 23,
      fontWeight: '800',
      color: '#111827',
    },

    nearestTaskPromotion: {
      marginTop: 5,
      fontSize: 12,
      lineHeight: 18,
      color: '#6B7280',
    },

    nearestTaskDeadline: {
      alignSelf:
        'flex-start',
      marginTop: 13,
      backgroundColor:
        '#EFF6FF',
      borderRadius: 9,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },

    nearestTaskDeadlineText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#1D4ED8',
    },

    /*
     * MOJE PROMOCJE
     */

    myPromotionsSection: {
      marginBottom: 34,
    },

    seeAllText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#2563EB',
    },

    noActiveCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      padding: 20,
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
    },

    noActiveTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: '#111827',
      marginBottom: 6,
    },

    noActiveText: {
      fontSize: 13,
      lineHeight: 19,
      color: '#6B7280',
    },

    myPromotionCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      padding: 17,
      marginBottom: 11,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.04,

      shadowRadius: 6,
      elevation: 1,
    },

    myPromotionHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
      gap: 12,
    },

    myPromotionInfo: {
      flex: 1,
    },

    myPromotionBank: {
      fontSize: 12,
      fontWeight: '700',
      color: '#6B7280',
      marginBottom: 4,
    },

    myPromotionTitle: {
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '800',
      color: '#111827',
    },

    myPromotionBonus: {
      fontSize: 17,
      fontWeight: '900',
      color: '#16A34A',
    },

    myProgressSection: {
      marginTop: 15,
    },

    /*
     * DISCOVERY
     */

    discoveryHeader: {
      marginBottom: 22,
    },

    discoveryEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      color: '#2563EB',
      marginBottom: 6,
    },

    discoveryTitle: {
      fontSize: 24,
      fontWeight: '900',
      color: '#111827',
      marginBottom: 6,
    },

    discoverySubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: '#6B7280',
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
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
      borderRadius: 999,
      paddingHorizontal: 15,
      paddingVertical: 9,
      marginRight: 9,
    },

    categoryFilterButtonActive: {
      backgroundColor:
        '#2563EB',
      borderColor:
        '#2563EB',
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
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
      marginRight: 9,
    },

    sortButtonActive: {
      backgroundColor:
        '#111827',
      borderColor:
        '#111827',
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
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom: 28,
      gap: 12,
    },

    freeFilterButton: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },

    freeFilterButtonActive: {
      borderColor:
        '#2563EB',
      backgroundColor:
        '#EFF6FF',
    },

    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor:
        '#D1D5DB',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 8,
    },

    checkboxActive: {
      backgroundColor:
        '#2563EB',
      borderColor:
        '#2563EB',
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
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom: 14,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: '#111827',
      flexShrink: 1,
    },

    sectionCounter: {
      marginLeft: 10,
      backgroundColor:
        '#E5E7EB',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 20,
      fontSize: 12,
      fontWeight: '700',
      color: '#4B5563',
    },

    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FEF2F2',
      borderWidth: 1,
      borderColor: '#FECACA',
      borderRadius: 16,
      padding: 14,
      marginBottom: 18,
      gap: 12,
    },

    errorBannerTextWrap: {
      flex: 1,
    },

    errorBannerTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: '#991B1B',
      marginBottom: 3,
    },

    errorBannerText: {
      fontSize: 12,
      lineHeight: 17,
      color: '#B91C1C',
    },

    errorBannerAction: {
      fontSize: 12,
      fontWeight: '900',
      color: '#DC2626',
    },

    feedbackCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 16,
      marginTop: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },

    feedbackIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EFF6FF',
      marginRight: 12,
    },

    feedbackIconText: {
      fontSize: 20,
    },

    feedbackContent: {
      flex: 1,
    },

    feedbackTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: '#111827',
      marginBottom: 3,
    },

    feedbackText: {
      fontSize: 12,
      lineHeight: 17,
      color: '#6B7280',
    },

    feedbackArrow: {
      fontSize: 20,
      fontWeight: '700',
      color: '#2563EB',
      marginLeft: 10,
    },

    onboardingOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(17, 24, 39, 0.58)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 22,
    },

    onboardingCard: {
      width: '100%',
      maxWidth: 430,
      backgroundColor: '#FFFFFF',
      borderRadius: 26,
      padding: 22,
    },

    onboardingTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 24,
    },

    onboardingEyebrow: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.9,
      color: '#2563EB',
    },

    onboardingSkip: {
      fontSize: 13,
      fontWeight: '700',
      color: '#6B7280',
    },

    onboardingIcon: {
      fontSize: 44,
      marginBottom: 18,
    },

    onboardingTitle: {
      fontSize: 25,
      lineHeight: 31,
      fontWeight: '900',
      color: '#111827',
      marginBottom: 10,
    },

    onboardingText: {
      fontSize: 15,
      lineHeight: 23,
      color: '#6B7280',
    },

    onboardingDots: {
      flexDirection: 'row',
      gap: 7,
      marginTop: 26,
      marginBottom: 20,
    },

    onboardingDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: '#D1D5DB',
    },

    onboardingDotActive: {
      width: 24,
      backgroundColor: '#2563EB',
    },

    onboardingButton: {
      minHeight: 52,
      borderRadius: 15,
      backgroundColor: '#2563EB',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },

    onboardingButtonText: {
      fontSize: 15,
      fontWeight: '900',
      color: '#FFFFFF',
    },

    /*
     * KARTA PROMOCJI
     */

    card: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 3,
      },

      shadowOpacity:
        0.06,

      shadowRadius: 8,
      elevation: 2,
    },

    cardHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      gap: 10,
      marginBottom: 14,
    },

    bankContainer: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flex: 1,
    },

    bankIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor:
        '#EFF6FF',
      alignItems:
        'center',
      justifyContent:
        'center',
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
      backgroundColor:
        '#EFF6FF',
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
      alignSelf:
        'flex-start',
      backgroundColor:
        '#F3F4F6',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginTop: 10,
    },

    daysBadgeUrgent: {
      backgroundColor:
        '#FEF2F2',
    },

    daysBadgeExpired: {
      backgroundColor:
        '#F3F4F6',
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
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-end',
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
      flexDirection:
        'row',
      alignItems:
        'center',
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
      flexDirection:
        'row',
      backgroundColor:
        '#F9FAFB',
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
      backgroundColor:
        '#E5E7EB',
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
      borderTopColor:
        '#F3F4F6',
      paddingTop: 16,
      marginBottom: 16,
    },

    progressHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
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
      backgroundColor:
        '#E5E7EB',
      overflow: 'hidden',
    },

    progressFill: {
      height: '100%',
      borderRadius: 20,
      backgroundColor:
        '#2563EB',
    },

    progressTasks: {
      marginTop: 7,
      fontSize: 11,
      color: '#9CA3AF',
    },

    ctaRow: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      borderTopWidth: 1,
      borderTopColor:
        '#F3F4F6',
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
      backgroundColor:
        '#FFFFFF',
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
      alignSelf:
        'flex-start',
      backgroundColor:
        '#2563EB',
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