import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="register" />
      <Stack.Screen name="verification" />
      <Stack.Screen name="success" />
      <Stack.Screen name="validate" />
    </Stack>
  );
}