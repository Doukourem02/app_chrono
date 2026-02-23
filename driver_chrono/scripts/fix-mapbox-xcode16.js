#!/usr/bin/env node
/**
 * Patch MapboxMaps ViewAnnotationManager.swift for Xcode 16 compatibility.
 * Fixes: "cannot convert return expression of type '[UIView : ViewAnnotationOptions]' to return type '[String : Any?]'"
 * See: https://github.com/mapbox/mapbox-maps-ios/issues/2204
 */
const fs = require('fs');
const path = require('path');

const podsDir = path.join(__dirname, '..', 'ios', 'Pods', 'MapboxMaps');
const filePath = path.join(podsDir, 'Sources', 'MapboxMaps', 'Annotations', 'ViewAnnotationManager.swift');

if (!fs.existsSync(filePath)) {
  console.log('[fix-mapbox-xcode16] ViewAnnotationManager.swift not found, skipping');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `    /// The complete list of annotations associated with the receiver.
    public var annotations: [UIView: ViewAnnotationOptions] {
        idsByView.compactMapValues { [mapboxMap] id in
            try? mapboxMap.options(forViewAnnotationWithId: id)
        }
    }`;

const newCode = `    /// The complete list of annotations associated with the receiver.
    public var annotations: [UIView: ViewAnnotationOptions] {
        var result: [UIView: ViewAnnotationOptions] = [:]
        for (view, id) in idsByView {
            if let options = try? mapboxMap.options(forViewAnnotationWithId: id) {
                result[view] = options
            }
        }
        return result
    }`;

if (content.includes('idsByView.compactMapValues { [mapboxMap] id in')) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(filePath, content);
  console.log('[fix-mapbox-xcode16] Patched ViewAnnotationManager.swift for Xcode 16');
} else if (content.includes('var result: [UIView: ViewAnnotationOptions]')) {
  console.log('[fix-mapbox-xcode16] Already patched');
} else {
  console.warn('[fix-mapbox-xcode16] Could not find target code - MapboxMaps version may have changed');
}
