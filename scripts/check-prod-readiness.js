#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const strictEnv = process.argv.includes("--strict-env");
const errors = [];
const warnings = [];
const infos = [];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) env[key] = value;
  }
  return env;
}

function mergedEnv(...relativeFiles) {
  return Object.assign(
    {},
    ...relativeFiles.map((file) => readEnvFile(path.join(rootDir, file))),
    process.env
  );
}

function addEnvIssue(message) {
  if (strictEnv) {
    errors.push(message);
  } else {
    warnings.push(message);
  }
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function pluginOptions(plugins, pluginName) {
  const plugin = plugins.find((item) => {
    if (typeof item === "string") return item === pluginName;
    return Array.isArray(item) && item[0] === pluginName;
  });
  if (!plugin) return null;
  return Array.isArray(plugin) ? plugin[1] || {} : {};
}

function semverGte(left, right) {
  const a = String(left).split(".").map((part) => Number(part) || 0);
  const b = String(right).split(".").map((part) => Number(part) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
}

function requiredEnv(env, names, scope) {
  for (const name of names) {
    if (!String(env[name] || "").trim()) {
      addEnvIssue(`${scope}: ${name} is missing.`);
    }
  }
}

function main() {
  const appPackage = readJson(path.join(rootDir, "app_chrono/package.json"));
  const backendPackage = readJson(path.join(rootDir, "chrono_backend/package.json"));
  const rootPackage = readJson(path.join(rootDir, "package.json"));
  const appConfig = require(path.join(rootDir, "app_chrono/app.config.js"));
  const expo = appConfig.expo || {};
  const plugins = expo.plugins || [];

  check(Boolean(rootPackage.scripts?.["check:prod"]), "Root package is missing check:prod script.");
  check(Boolean(rootPackage.scripts?.["eas:ios"]), "Root package is missing eas:ios script.");
  check(appPackage.dependencies?.["expo-widgets"], "app_chrono: expo-widgets dependency is missing.");
  check(backendPackage.dependencies?.jsonwebtoken, "chrono_backend: jsonwebtoken dependency is missing.");

  check(expo.owner === "doukourem02", "app.config.js: expo.owner should be doukourem02.");
  check(expo.slug === "app_chrono", "app.config.js: expo.slug should be app_chrono.");
  check(expo.ios?.bundleIdentifier === "com.anonymous.app-chrono", "iOS bundle id is not com.anonymous.app-chrono.");
  check(expo.android?.package === "com.anonymous.app_chrono", "Android package is not com.anonymous.app_chrono.");
  check(Boolean(expo.extra?.eas?.projectId), "EAS projectId is missing from app.config.js.");

  check(
    semverGte(expo.ios?.deploymentTarget || "0.0", "16.2"),
    "iOS deploymentTarget must be >= 16.2 for ActivityKit."
  );
  check(
    expo.ios?.infoPlist?.NSSupportsLiveActivities === true,
    "NSSupportsLiveActivities must be true."
  );

  const widgets = pluginOptions(plugins, "expo-widgets");
  check(Boolean(widgets), "expo-widgets plugin is missing.");
  if (widgets) {
    check(
      widgets.bundleIdentifier === "com.anonymous.app-chrono.ExpoWidgetsTarget",
      "expo-widgets bundleIdentifier is not the expected widget target."
    );
    check(
      widgets.groupIdentifier === "group.com.anonymous.app-chrono",
      "expo-widgets groupIdentifier is not the expected App Group."
    );
    check(widgets.enablePushNotifications === true, "expo-widgets enablePushNotifications must be true.");
    check(widgets.frequentUpdates === true, "expo-widgets frequentUpdates must be true.");
  }

  const notifications = pluginOptions(plugins, "expo-notifications");
  check(Boolean(notifications), "expo-notifications plugin is missing.");
  if (notifications) {
    check(
      notifications.enableBackgroundRemoteNotifications === true,
      "expo-notifications enableBackgroundRemoteNotifications must be true."
    );
  }

  const iosBuild = Number(expo.ios?.buildNumber || 0);
  const androidVersionCode = Number(expo.android?.versionCode || 0);
  check(Number.isInteger(iosBuild) && iosBuild > 0, "iOS buildNumber must be a positive integer string.");
  check(
    Number.isInteger(androidVersionCode) && androidVersionCode > 0,
    "Android versionCode must be a positive integer."
  );
  warn(
    iosBuild === androidVersionCode,
    `iOS buildNumber (${expo.ios?.buildNumber}) and Android versionCode (${expo.android?.versionCode}) are not aligned.`
  );

  const appEnv = mergedEnv("app_chrono/.env", ".env");
  requiredEnv(
    appEnv,
    [
      "EXPO_PUBLIC_API_URL",
      "EXPO_PUBLIC_SOCKET_URL",
      "EXPO_PUBLIC_SUPABASE_URL",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY",
      "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN",
      "EXPO_PUBLIC_TRACK_BASE_URL",
      "EXPO_PUBLIC_LEGAL_CGU_URL",
      "EXPO_PUBLIC_LEGAL_PRIVACY_URL",
    ],
    "EAS/client env"
  );
  warn(
    fs.existsSync(path.join(rootDir, "app_chrono/google-services.json")),
    "app_chrono/google-services.json is missing locally. Android FCM push needs it in EAS or the repo workspace."
  );

  const backendEnv = mergedEnv("chrono_backend/.env", ".env");
  requiredEnv(
    backendEnv,
    ["APNS_ENV", "APNS_BUNDLE_ID", "APNS_TEAM_ID", "APNS_KEY_ID"],
    "Render/backend APNs env"
  );
  if (!backendEnv.APNS_PRIVATE_KEY && !backendEnv.APNS_PRIVATE_KEY_BASE64) {
    addEnvIssue("Render/backend APNs env: APNS_PRIVATE_KEY or APNS_PRIVATE_KEY_BASE64 is missing.");
  }
  if (backendEnv.APNS_ENV && backendEnv.APNS_ENV !== "production") {
    addEnvIssue(`Render/backend APNs env: APNS_ENV should be production for TestFlight, got ${backendEnv.APNS_ENV}.`);
  }
  if (
    backendEnv.APNS_BUNDLE_ID &&
    backendEnv.APNS_BUNDLE_ID !== "com.anonymous.app-chrono"
  ) {
    addEnvIssue(`Render/backend APNs env: APNS_BUNDLE_ID should be com.anonymous.app-chrono.`);
  }

  check(
    fs.existsSync(path.join(rootDir, "chrono_backend/migrations/027_live_activity_tokens.sql")),
    "Migration 027_live_activity_tokens.sql is missing."
  );
  check(
    fs.existsSync(path.join(rootDir, "app_chrono/services/orderLiveActivity.ts")),
    "Client Live Activity service is missing."
  );
  check(
    fs.existsSync(path.join(rootDir, "chrono_backend/src/services/liveActivityApnsService.ts")),
    "Backend APNs Live Activity service is missing."
  );

  infos.push("Run before real validation: app_chrono tsc, chrono_backend tsc, git diff --check.");
  infos.push("Then apply migration 027, set Render APNs env, build EAS iOS production, test on device/TestFlight.");

  console.log("\nKrono production readiness check\n");
  if (errors.length === 0 && warnings.length === 0) {
    console.log("OK: no blocking issue found.");
  }
  for (const error of errors) console.log(`ERROR: ${error}`);
  for (const warning of warnings) console.log(`WARN: ${warning}`);
  for (const info of infos) console.log(`INFO: ${info}`);
  console.log("");

  if (errors.length > 0) process.exit(1);
}

main();
