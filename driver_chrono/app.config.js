require('dotenv').config({ path: '.env' });

module.exports = {
  expo: {
    owner: "doukourem02",
    name: "Krono pro",
    slug: "driver_chrono",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo/LOGO_APP1.png",
    scheme: "driverchrono",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.anonymous.driver-chrono",
      /** À incrémenter (+1) avant chaque build TestFlight / App Store (autoIncrement incompatible avec app.config.js). */
      buildNumber: "25",
      supportsTablet: true,
      infoPlist: {
        CFBundleDisplayName: "Krono pro",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.anonymous.driver_chrono",
      adaptiveIcon: {
        backgroundColor: "#FFFFFF",
        foregroundImage: "./assets/images/logo/LOGO_APP1.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "static",
      favicon: "./assets/images/logo/LOGO_APP1.png"
    },
    plugins: [
      "expo-asset",
      "expo-audio",
      "@driveapp/expo-plugin-pod-disable-paths",
      "./plugins/withMapboxToken.js",
      "./plugins/withPodfileAssetsCarFix.js",
      "./plugins/withDisplayName.js",
      "expo-router",
      [
        "expo-camera",
        {
          cameraPermission: "Cette application a besoin de la caméra pour scanner les QR codes.",
        },
      ],
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          // Aligné sur MapboxNavigation 2.20 (Fleetbase patché) : MapboxMaps ~> 10.19. 11.x entre en conflit CocoaPods avec Navigation.
          RNMapboxMapsVersion: "10.19.4",
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
        "expo-splash-screen",
        {
          image: "./assets/images/logo/LOGO_APP1.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000"
          }
        }
      ],
      [
        "expo-notifications",
        {
          /** iOS : push en arrière-plan (nouvelles courses, messages, etc.). */
          enableBackgroundRemoteNotifications: true,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    },
    extra: {
      eas: {
        projectId: "9618f8cb-2c98-4b1c-b50c-9f24fe1a2526",
      },
      // Exposer les variables d'environnement (noms EXPO_PUBLIC_* pour envCheck)
      mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000',
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4000',
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL,
      EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
      legalCguUrl: process.env.EXPO_PUBLIC_LEGAL_CGU_URL || '',
      legalPrivacyUrl: process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL || '',
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
      EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
    }
  }
};

