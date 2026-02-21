import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'chrono:refreshToken';

export async function getRefreshToken(): Promise<string | null> {
  try {
    return (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function setRefreshToken(token: string | null): Promise<void> {
  try {
    if (!token) {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      return;
    }
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    // ignore
  }
}

export async function clearSecureTokens(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

