import { Redirect } from 'expo-router';

/** Ancienne route : une seule entrée téléphone sur l’index du groupe (auth). */
export default function LoginRedirect() {
  return <Redirect href="/(auth)" />;
}
