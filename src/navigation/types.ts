/**
 * Navigation type definitions.
 */

export type RootStackParamList = {
  // Auth
  SetupPassword: undefined;
  UnlockVault: undefined;

  // Main tabs wrapper
  MainTabs: undefined;

  // Tab screens
  Home: undefined;
  Upload: undefined;
  Files: undefined;
  Settings: undefined;

  // Detail
  FileDetail: { cid: string };
};