import { type NetworkState, NetworkStateType } from "expo-network";

export function isNetworkOffline(state: NetworkState): boolean {
  if (state.isConnected === false) return true;
  if (state.type === NetworkStateType.NONE) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}
