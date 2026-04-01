import { Redirect } from 'expo-router';

/** Ancienne route : une seule entrée téléphone sur l’index du groupe (auth). */
export default function RegisterRedirect() {
  return <Redirect href="/(auth)" />;
}
