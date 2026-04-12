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