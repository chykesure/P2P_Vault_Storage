/**
 * Navigation type definitions.
 */

export type RootStackParamList = {
  // Auth
  SetupPassword: undefined;
  UnlockVault: undefined;

  // Main tabs
  Home: undefined;
  Upload: undefined;
  Files: undefined;
  Settings: undefined;

  // Detail
  FileDetail: { cid: string };
};
