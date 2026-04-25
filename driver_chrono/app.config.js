require('dotenv').config({ path: '.env' });
const fs = require('fs');
const path = require('path');

const androidServicesConfigPath = path.join(__dirname, 'google-services.json');
const hasAndroidServicesConfig = fs.existsSync(androidServicesConfigPath);

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
      buildNumber: "100",
      supportsTablet: true,
      infoPlist: {
        CFBundleDisplayName: "Krono pro",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.anonymous.driver_chrono",
      versionCode: 100,
      adaptiveIcon: {
        backgroundColor: "#FFFFFF",
        foregroundImage: "./assets/images/logo/LOGO_APP1.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      ...(hasAndroidServicesConfig ? { googleServicesFile: './google-services.json' } : {}),
    },
    web: {
      output: "static",
      favicon: "./assets/images/logo/LOGO_APP1.png"
    },
    plugins: [
      [
        'expo-build-properties',
        {
          android: {
            /**
             * @rnmapbox/maps (10.19.x) : si targetSdk ≥ 35, Gradle peut résoudre com.mapbox.maps:android-ndk27.
             * 10.19.4 n’existe pas sur le Maven Mapbox (404) — utiliser une version publiée (ex. 10.19.1).
             * (Play Store pourra exiger 35+ plus tard : vérifier la variante -ndk27 pour la version choisie.)
             */
            targetSdkVersion: 34,
          },
        },
      ],
      './plugins/withGradleWrapperNetworkTimeout.js',
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
      /**
       * Doit être listé *avant* @rnmapbox/maps : pour projectBuildGradle, Expo enregistre le dernier plugin
       * en « extérieur » (il s’exécute en premier). Ici on veut l’inverse — patcher après l’ajout du bloc Maven.
       */
      './plugins/withMapboxMavenTokenFromRootProject.js',
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          // Ligne Maps 10.19.x (11.x : conflits CocoaPods possibles avec Navigation). 10.19.4 absente du Maven Mapbox ; 10.19.1 publiée.
          RNMapboxMapsVersion: "10.19.1",
          ...(process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN || process.env.MAPBOX_DOWNLOADS_TOKEN
            ? {
                RNMapboxMapsDownloadToken:
                  process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN ||
                  process.env.MAPBOX_DOWNLOADS_TOKEN,
              }
            : {}),
        },
      ],
      /** Patch token dans le bloc Maven Mapbox du settings (si présent). */
      './plugins/withMapboxSettingsGradleDownloadsToken.js',
      /** mapbox-init.gradle + apply from: settings (EAS n’applique pas toujours -I sur gradleCommand). */
      './plugins/withMapboxGradleApplyInitScript.js',
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
      /** Après génération android/ : fichier .mapbox_downloads_token (EAS : post-install trop tôt). */
      './plugins/withMapboxAndroidDownloadsTokenFile.js',
      /**
       * MAPBOX_DOWNLOADS_TOKEN dans gradle.properties en dernier : sinon Expo / autres plugins
       * peuvent régénérer gradle.properties et effacer la ligne avant Gradle.
       */
      './plugins/withRequireMapboxDownloadsTokenAndroid.js',
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
      betterStackSourceToken:
        process.env.EXPO_PUBLIC_BETTER_STACK_SOURCE_TOKEN || process.env.EXPO_PUBLIC_LOGTAIL_SOURCE_TOKEN || '',
      betterStackIngestUrl: process.env.EXPO_PUBLIC_BETTER_STACK_INGEST_URL || '',
      EXPO_PUBLIC_BETTER_STACK_SOURCE_TOKEN: process.env.EXPO_PUBLIC_BETTER_STACK_SOURCE_TOKEN || '',
    }
  }
};
