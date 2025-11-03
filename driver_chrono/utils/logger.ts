// Minimal logger for driver_chrono to avoid cross-project imports.
// Keeps the same public methods used by services: debug/info/warn/error/userError.
import { Alert } from 'react-native';

function format(msg: string) {
  return `[driver_chrono] ${msg}`;
}

export const logger = {
  debug: (message: string, _component?: string, extra?: any) => {
    if (__DEV__) console.log(format(message), extra ?? '');
  },
  info: (message: string, _component?: string, extra?: any) => {
    console.info(format(message), extra ?? '');
  },
  warn: (message: string, _component?: string, extra?: any) => {
    console.warn(format(message), extra ?? '');
  },
  error: (message: string, _component?: string, extra?: any) => {
    console.error(format(message), extra ?? '');
  },
  userError: (message: string, title = 'Erreur') => {
    console.error(format(message));
    try { Alert.alert(title, message); } catch {}
  }
};
