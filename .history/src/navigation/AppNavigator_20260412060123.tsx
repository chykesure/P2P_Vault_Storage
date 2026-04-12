/**
 * App Navigator
 *
 * Main navigation structure for the P2P Storage Vault app.
 * Uses React Navigation with bottom tabs for main screens
 * and a stack navigator for detail/auth screens.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons as Icon } from '@expo/vector-icons';

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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: any;
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
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
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
  // Lazy import to avoid circular deps
  const { SetupPasswordScreen: Screen } = require('@screens/SetupPasswordScreen');
  return <Screen />;
}

function UnlockVaultScreen() {
  const { UnlockVaultScreen: Screen } = require('@screens/UnlockVaultScreen');
  return <Screen />;
}

// ========================================
// Root Stack Navigator
// ========================================

export function AppNavigator() {
  const { isConnected } = useWeb3();
  const { isSetup, isAuthenticated } = useEncryption();
  const navigationRef = React.useRef<any>(null);

  // Navigate when auth state changes (after password setup/unlock)
  React.useEffect(() => {
    if (!navigationRef.current) return;
    
    if (!isSetup) {
      navigationRef.current.resetRoot({ index: 0, routes: [{ name: 'SetupPassword' }] });
    } else if (!isAuthenticated) {
      navigationRef.current.resetRoot({ index: 0, routes: [{ name: 'UnlockVault' }] });
    } else {
      navigationRef.current.resetRoot({ index: 0, routes: [{ name: 'Home' }] });
    }
  }, [isSetup, isAuthenticated]);

  // Determine which screen to show on first mount
  const getInitialRoute = (): keyof RootStackParamList => {
    if (!isSetup) return 'SetupPassword';
    if (!isAuthenticated) return 'UnlockVault';
    return 'Home';
  };

  return (
    <NavigationContainer ref={navigationRef}>
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
