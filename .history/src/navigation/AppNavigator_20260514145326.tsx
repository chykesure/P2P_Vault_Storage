/**
 * App Navigator
 *
 * Main navigation structure for the P2P Storage Vault app.
 * Uses React Navigation with bottom tabs for main screens
 * and a stack navigator for detail/auth screens.
 *
 * Bottom tab bar is responsive across all Android devices using
 * useSafeAreaInsets to account for device navigation bars.
 *
 * FIX: Added isChecking guard to prevent password modal flash on cold start.
 * FIX: Changed isAuthenticated → isUnlocked (matches EncryptionContext).
 */

import React from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons as Icon } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Icon>['name'];

// Screens
import { HomeScreen } from '@screens/HomeScreen';
import { UploadScreen } from '@screens/UploadScreen';
import { FileListScreen } from '@screens/FileListScreen';
import { SettingsScreen } from '@screens/SettingsScreen';
import { FileDetailScreen } from '@screens/FileDetailScreen';

// Contexts
import { useWeb3 } from '@contexts/Web3Context';
import { useEncryption } from '@contexts/EncryptionContext';

import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootStackParamList>();

// ========================================
// Bottom Tab Navigator (Main App)
// ========================================

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: IoniconName;
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Upload':
              iconName = focused ? 'cloud-upload' : 'cloud-upload-outline';
              break;
            case 'Files':
              iconName = focused ? 'folder' : 'folder-outline';
              break;
            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'ellipse-outline';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6C5CE7',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          paddingBottom: Math.max(insets.bottom - 4, 5),
          paddingTop: 5,
          height: 60 + Math.max(insets.bottom - 4, 0),
          backgroundColor: '#fff',
          borderTopColor: '#ECF0F1',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#6C5CE7',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Vault' }}
      />
      <Tab.Screen
        name="Upload"
        component={UploadScreen}
        options={{ title: 'Upload' }}
      />
      <Tab.Screen
        name="Files"
        component={FileListScreen}
        options={{ title: 'My Files' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

// ========================================
// Auth Screens (shown when not authenticated)
// ========================================

function SetupPasswordScreen() {
  const { SetupPasswordScreen: Screen } = require('@screens/SetupPasswordScreen');
  return <Screen />;
}

function UnlockVaultScreen() {
  const { UnlockVaultScreen: Screen } = require('@screens/UnlockVaultScreen');
  return <Screen />;
}

// ========================================
// Loading screen while checking SecureStore
// ========================================

function CheckingScreen() {
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#0A0A1A',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <ActivityIndicator size="large" color="#6C5CE7" />
    </View>
  );
}

// ========================================
// Root Stack Navigator
// ========================================

export function AppNavigator() {
  const { isConnected } = useWeb3();
  const { isSetup, isUnlocked, isChecking } = useEncryption();

  // Determine which screen to show — only AFTER SecureStore check completes
  const getInitialRoute = (): keyof RootStackParamList => {
    if (!isSetup) return 'SetupPassword';
    if (!isUnlocked) return 'UnlockVault';
    return 'Home';
  };

  // ★ FIX: Wait for SecureStore check before deciding initial route
  if (isChecking) {
    return <CheckingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={getInitialRoute()}
        screenOptions={{
          headerStyle: {
            backgroundColor: '#6C5CE7',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '700',
          },
        }}
      >
        <Stack.Screen
          name="SetupPassword"
          component={SetupPasswordScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="UnlockVault"
          component={UnlockVaultScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Upload"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Files"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Settings"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FileDetail"
          component={FileDetailScreen}
          options={{
            title: 'File Details',
            presentation: 'card',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
