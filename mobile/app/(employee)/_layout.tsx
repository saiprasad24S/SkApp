import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, Platform } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useChatStore } from '../../src/store/chatStore';

function PortalBottomNav({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const unreadCount = useChatStore((s: any) => s.unreadCount);

  const visibleRoutes = state.routes.filter((route: any) => {
    const { options } = descriptors[route.key];
    return options.href !== null;
  });

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {visibleRoutes.map((route: any) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === state.routes.findIndex((r: any) => r.key === route.key);

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        let iconName: any = 'home';
        if (route.name === 'home') iconName = 'home';
        else if (route.name === 'chat') iconName = 'message-square';
        else if (route.name === 'attendance') iconName = 'clock';
        else if (route.name === 'leaves') iconName = 'calendar';

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.navItem}
            activeOpacity={0.7}
          >
            {isFocused && <View style={styles.navIndicator} />}
            <View style={[styles.iconWrapper, isFocused && styles.iconWrapperActive]}>
              <Feather
                name={iconName}
                size={20}
                color={isFocused ? '#6B2FA0' : '#64748b'}
              />
              {route.name === 'chat' && unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={[styles.navLabel, isFocused && styles.navLabelActive]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function EmployeeLayout() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onBackPress = () => {
      if (pathname === '/(employee)/home' || pathname === '/home') {
        BackHandler.exitApp();
        return true;
      } else {
        router.push('/(employee)/home');
        return true;
      }
    };

    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, [pathname, router]);

  return (
    <Tabs
      tabBar={(props) => <PortalBottomNav {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
        }}
      />
      <Tabs.Screen
        name="leaves"
        options={{
          title: 'Apply Leave',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    height: Platform.OS === 'ios' ? 84 : 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: '100%',
  },
  navIndicator: {
    position: 'absolute',
    top: -6,
    width: 32,
    height: 3,
    backgroundColor: '#6B2FA0',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  iconWrapper: {
    width: 36,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(107, 47, 160, 0.12)',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#6B2FA0',
    fontWeight: '700',
  },
});
