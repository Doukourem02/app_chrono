import { Stack } from "expo-router";
import { initSentry } from "../utils/sentry";
import { ErrorBoundary } from "../components/error/ErrorBoundary";

initSentry();

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="summary" />
      </Stack>
    </ErrorBoundary>
  );
}
