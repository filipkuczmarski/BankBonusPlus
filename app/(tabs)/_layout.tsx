import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
const theme = colorScheme === 'dark' ? 'dark' : 'light';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:
          Colors[theme].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="house.fill"
              color={typeof color === 'string' ? color : Colors[theme].tint}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="my-promotions"
        options={{
          title: 'Moje promocje',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="list.bullet"
              color={typeof color === 'string' ? color : Colors[theme].tint}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="person.fill"
              color={typeof color === 'string' ? color : Colors[theme].tint}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}