import { Stack } from "expo-router";
import { useEffect } from "react";
import { initSentry } from "../utils/sentry";

// 🔍 SENTRY: Initialiser le monitoring d'erreurs
initSentry();

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="summary" />
    </Stack>
  );
}
