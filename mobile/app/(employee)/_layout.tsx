import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, Platform } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { useChatStore } from '../../src/store/chatStore';
import { getConversations } from '../../src/api/chatApi';

function PortalBottomNav({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const unreadCount = useChatStore((s: any) => s.unreadCount);
  const activeConversationId = useChatStore((s: any) => s.activeConversationId);
  const chatSectionTab = useChatStore((s: any) => s.chatSectionTab);
  const setChatSectionTab = useChatStore((s: any) => s.setChatSectionTab);

  const role = useAuthStore((s: any) => s.role);
  const profile = useAuthStore((s: any) => s.profile);
  const isAdmin = role === 'ADMIN' || profile?.employee_id === 'ADMIN';

  const currentRouteName = state.routes[state.index]?.name;
  const isChatRoute = currentRouteName === 'chat';

  // Inside an active chat room, hide bottom navigation so composer sits comfortably above keyboard
  if (isChatRoute && activeConversationId) {
    return null;
  }

  // 1. CHAT-SPECIFIC NAVIGATION BAR
  if (isChatRoute) {
    const chatNavButtons: Array<{
      key: string;
      label: string;
      icon: any;
      isFocused: boolean;
      badge?: number;
      onPress: () => void;
    }> = [
      {
        key: 'chat-nav-home',
        label: 'Home',
        icon: 'home',
        isFocused: false,
        onPress: () => navigation.navigate('home'),
      },
      {
        key: 'chat-nav-direct',
        label: 'Chat',
        icon: 'message-square',
        isFocused: chatSectionTab === 'direct',
        badge: unreadCount,
        onPress: () => setChatSectionTab('direct'),
      },
      {
        key: 'chat-nav-groups',
        label: 'Groups',
        icon: 'users',
        isFocused: chatSectionTab === 'groups',
        onPress: () => setChatSectionTab('groups'),
      },
    ];

    if (isAdmin) {
      chatNavButtons.push({
        key: 'chat-nav-emp-chat',
        label: 'Emp Chat',
        icon: 'user-check',
        isFocused: chatSectionTab === 'emp_chat',
        onPress: () => setChatSectionTab('emp_chat'),
      });
    }

    return (
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 6) }]}>
        {chatNavButtons.map((btn) => (
          <TouchableOpacity
            key={btn.key}
            onPress={btn.onPress}
            style={styles.navItem}
            activeOpacity={0.7}
          >
            {btn.isFocused && <View style={styles.navIndicator} />}
            <View style={[styles.iconWrapper, btn.isFocused && styles.iconWrapperActive]}>
              <Feather
                name={btn.icon}
                size={20}
                color={btn.isFocused ? '#6B2FA0' : '#64748b'}
              />
              {btn.badge !== undefined && btn.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {btn.badge > 99 ? '99+' : btn.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={[styles.navLabel, btn.isFocused && styles.navLabelActive]}
            >
              {btn.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // 2. STANDARD EMPLOYEE BOTTOM NAVIGATION BAR (Home, Chat, Attendance, Apply Leave)
  const employeeNavButtons: Array<{
    route: string;
    label: string;
    icon: any;
    isFocused: boolean;
    badge?: number;
    onPress: () => void;
  }> = [
    {
      route: 'home',
      label: 'Home',
      icon: 'home',
      isFocused: currentRouteName === 'home',
      onPress: () => navigation.navigate('home'),
    },
    {
      route: 'chat',
      label: 'Chat',
      icon: 'message-square',
      isFocused: currentRouteName === 'chat',
      badge: unreadCount,
      onPress: () => {
        setChatSectionTab('direct');
        navigation.navigate('chat');
      },
    },
    {
      route: 'attendance',
      label: 'Attendance',
      icon: 'clock',
      isFocused: currentRouteName === 'attendance',
      onPress: () => navigation.navigate('attendance'),
    },
    {
      route: 'leaves',
      label: 'Apply Leave',
      icon: 'calendar',
      isFocused: currentRouteName === 'leaves',
      onPress: () => navigation.navigate('leaves'),
    },
  ];

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {employeeNavButtons.map((btn) => (
        <TouchableOpacity
          key={btn.route}
          onPress={btn.onPress}
          style={styles.navItem}
          activeOpacity={0.7}
        >
          {btn.isFocused && <View style={styles.navIndicator} />}
          <View style={[styles.iconWrapper, btn.isFocused && styles.iconWrapperActive]}>
            <Feather
              name={btn.icon}
              size={20}
              color={btn.isFocused ? '#6B2FA0' : '#64748b'}
            />
            {btn.badge !== undefined && btn.badge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {btn.badge > 99 ? '99+' : btn.badge}
                </Text>
              </View>
            )}
          </View>
          <Text
            numberOfLines={1}
            style={[styles.navLabel, btn.isFocused && styles.navLabelActive]}
          >
            {btn.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function EmployeeLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { getToken } = useAuth();
  const setUnreadCount = useChatStore((s: any) => s.setUnreadCount);

  // Poll conversations for badge updates across the portal
  useQuery({
    queryKey: ['chat-conversations-badge'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const convs = await getConversations(token);
      const totalUnread = convs.reduce((acc: number, c: any) => acc + (c.unread_count || 0), 0);
      setUnreadCount(totalUnread);
      return convs;
    },
    staleTime: 10000,
    refetchInterval: 15000,
  });

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

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
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
