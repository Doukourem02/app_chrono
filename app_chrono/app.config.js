require('dotenv').config({ path: '.env' });
const fs = require('fs');
const path = require('path');

const googleServicesPath = path.join(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesPath);

module.exports = {
  expo: {
    owner: "doukourem02",
    name: "Krono",
    slug: "app_chrono",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo/LOGO_APP2.png",
    scheme: "appchrono",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.anonymous.app-chrono",
      /** À incrémenter (+1) avant chaque build TestFlight / App Store (autoIncrement incompatible avec app.config.js). */
      buildNumber: "54",
      /**
       * Live Activities / Dynamic Island (ActivityKit) requiert iOS 16.2+ côté target widget.
       * Aligner la cible principale évite des erreurs CocoaPods pendant "Install pods".
       */
      deploymentTarget: "16.2",
      supportsTablet: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleDisplayName: "Krono",
        NSContactsUsageDescription:
          "Krono a besoin d'accéder à vos contacts pour sélectionner le numéro du destinataire.",
      },
    },
    android: {
      package: "com.anonymous.app_chrono",
      /**
       * "pan" évite adjustResize : sinon la fenêtre se redimensionne en même temps que le sheet
       * animé (expandForAddressInput), ce qui provoque des tremblements au focus des champs adresse.
       */
      softwareKeyboardLayoutMode: "pan",
      adaptiveIcon: {
        backgroundColor: "#FFFFFF",
        foregroundImage: "./assets/images/logo/LOGO_APP2.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
    },
    web: {
      output: "static",
      favicon: "./assets/images/logo/LOGO_APP2.png"
    },
    plugins: [
      "expo-asset",
      "expo-router",
      "@sentry/react-native",
      "expo-audio",
      "expo-font",
      "expo-image",
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Cette application a besoin de votre localisation pour fonctionner correctement.",
          locationAlwaysPermission: "Cette application a besoin de votre localisation en arrière-plan pour le suivi des livraisons.",
          locationWhenInUsePermission: "Cette application a besoin de votre localisation pour afficher votre position sur la carte.",
        }
      ],
      [
        "expo-contacts",
        {
          contactsPermission:
            "Krono a besoin d'accéder à vos contacts pour sélectionner le numéro du destinataire.",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/logo/LOGO_APP2.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000"
          }
        }
      ],
      "expo-secure-store",
      [
        "expo-notifications",
        {
          /** iOS : mode distant en arrière-plan (utile pour événements type « en route »). */
          enableBackgroundRemoteNotifications: true,
        },
      ],
      "expo-web-browser",
      [
        "expo-widgets",
        {
          bundleIdentifier: "com.anonymous.app-chrono.ExpoWidgetsTarget",
          groupIdentifier: "group.com.anonymous.app-chrono",
          /** Passer à true quand le backend enverra des mises à jour APNs pour la Live Activity. */
          enablePushNotifications: false,
          widgets: [],
        },
      ],
      "./plugins/withMergeBackgroundModes.js",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    },
    extra: {
      eas: {
        projectId: "02928131-25c4-40be-9a4c-77f251406a82",
      },
      // Exposer les variables d'environnement
      mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000',
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4000',
      /** URL publique de la page /track (admin Next). Obligatoire en prod pour « Partager le lien » et tests sur téléphone. */
      trackBaseUrl: process.env.EXPO_PUBLIC_TRACK_BASE_URL || '',
      // Même noms que sur EAS (aligné driver_chrono + envCheck)
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      legalCguUrl: process.env.EXPO_PUBLIC_LEGAL_CGU_URL || '',
      legalPrivacyUrl: process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL || '',
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
      EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
    }
  }
};

