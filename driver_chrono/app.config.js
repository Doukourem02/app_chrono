require('dotenv').config({ path: '.env' });

module.exports = {
  expo: {
    owner: "doukourem02",
    name: "driver_chrono",
    slug: "driver_chrono",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "driverchrono",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.anonymous.driver-chrono",
      supportsTablet: true,
    },
    android: {
      package: "com.anonymous.driver_chrono",
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
        "expo-camera",
        {
          cameraPermission: "Cette application a besoin de la caméra pour scanner les QR codes.",
        },
      ],
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
        projectId: "9618f8cb-2c98-4b1c-b50c-9f24fe1a2526",
      },
      // Exposer les variables d'environnement
      // Fallback: NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (admin) si EXPO_PUBLIC non défini
      mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000',
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4000',
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    }
  }
};

