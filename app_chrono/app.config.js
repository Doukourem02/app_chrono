require('dotenv').config({ path: '.env' });

module.exports = {
  expo: {
    owner: "doukourem02",
    name: "app_chrono",
    slug: "app_chrono",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "appchrono",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.anonymous.app-chrono",
      supportsTablet: true,
    },
    android: {
      package: "com.anonymous.app_chrono",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
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
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          imageHeight: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000"
          }
        }
      ]
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
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    }
  }
};

