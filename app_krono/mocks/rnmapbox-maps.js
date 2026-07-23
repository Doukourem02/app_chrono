// Mock for @rnmapbox/maps on web (nécessite du natif, non disponible sur web)
import React from 'react';
import { View, Text } from 'react-native';

const MapView = React.forwardRef((props, ref) => (
  <View style={props.style}>
    <Text>Mapbox n&apos;est pas disponible sur web. Utilisez un dev build iOS/Android.</Text>
  </View>
));
MapView.displayName = 'MapView';

const PointAnnotation = () => null;
const MarkerView = () => null;
const ShapeSource = ({ children }) => children ?? null;
const LineLayer = () => null;
const FillLayer = () => null;
const Camera = () => null;
const LocationPuck = () => null;

export default {
  setAccessToken: () => {},
};
export { MapView, PointAnnotation, MarkerView, ShapeSource, LineLayer, FillLayer, Camera, LocationPuck };
