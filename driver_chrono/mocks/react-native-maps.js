// Mock for react-native-maps on web
import React from "react";
import { Text, View } from "react-native";

// Mock MapView component
export const MapView = React.forwardRef((props, ref) => {
  return (
    <View style={props.style}>
      <Text>MapView is not available on web</Text>
    </View>
  );
});
MapView.displayName = "MapView";

// Mock Marker component
export const Marker = (props) => {
  return null;
};
Marker.displayName = "Marker";

// Mock Polyline component
export const Polyline = (props) => {
  return null;
};
Polyline.displayName = "Polyline";

// Mock PROVIDER_GOOGLE constant
export const PROVIDER_GOOGLE = "google";

// Default export
export default MapView;
