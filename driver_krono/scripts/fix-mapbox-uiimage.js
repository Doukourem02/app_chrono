#!/usr/bin/env node
/* eslint-env node */
/* global __dirname */
/**
 * Patch MapboxNavigation UIImage.swift to avoid crash when bundle assets are missing.
 * Crash: assertionFailure in locationImage -> ResumeButton -> NavigationView
 * Cause: UIImage(named:in:compatibleWith:)! force unwrap when image not in .mapboxNavigation bundle
 */
const fs = require('fs');
const path = require('path');

const podsRoot = path.join(__dirname, '..', 'ios', 'Pods');
const uiimagePath = path.join(podsRoot, 'MapboxNavigation/Sources/MapboxNavigation/UIImage.swift');

if (!fs.existsSync(uiimagePath)) {
  console.log('[fix-mapbox-uiimage] MapboxNavigation UIImage.swift not found (run pod install first)');
  process.exit(0);
}

// Ensure writable (Pods can be read-only)
try {
  const { execSync } = require('child_process');
  const mapboxDir = path.join(podsRoot, 'MapboxNavigation');
  execSync(`chmod -R u+w "${mapboxDir}"`, { stdio: 'ignore' });
} catch (_) {}

let content = fs.readFileSync(uiimagePath, 'utf8');

if (content.includes('mapboxNavigationImage(named:')) {
  console.log('[fix-mapbox-uiimage] Already patched');
  process.exit(0);
}

const helper = `    private static func mapboxNavigationImage(named name: String) -> UIImage {
        if let img = UIImage(named: name, in: .mapboxNavigation, compatibleWith: nil) { return img }
        let size = CGSize(width: 24, height: 24)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let rect = CGRect(origin: .zero, size: size)
            UIColor.clear.setFill()
            ctx.cgContext.fill(rect)
            UIColor.white.setStroke()
            UIColor.white.setFill()
            ctx.cgContext.setLineWidth(2)
            let center = CGPoint(x: size.width/2, y: size.height/2)
            if name.lowercased().contains("zoom") && name.lowercased().contains("in") {
                ctx.cgContext.strokeEllipse(in: rect.insetBy(dx: 4, dy: 4))
                ctx.cgContext.move(to: CGPoint(x: center.x, y: center.y - 6))
                ctx.cgContext.addLine(to: CGPoint(x: center.x, y: center.y + 6))
                ctx.cgContext.move(to: CGPoint(x: center.x - 6, y: center.y))
                ctx.cgContext.addLine(to: CGPoint(x: center.x + 6, y: center.y))
                ctx.cgContext.strokePath()
            } else if name.lowercased().contains("zoom") && name.lowercased().contains("out") {
                ctx.cgContext.strokeEllipse(in: rect.insetBy(dx: 4, dy: 4))
                ctx.cgContext.move(to: CGPoint(x: center.x - 6, y: center.y))
                ctx.cgContext.addLine(to: CGPoint(x: center.x + 6, y: center.y))
                ctx.cgContext.strokePath()
            } else if name.lowercased().contains("location") || name.lowercased().contains("recenter") || name.lowercased().contains("compass") {
                ctx.cgContext.strokeEllipse(in: rect.insetBy(dx: 4, dy: 4))
                ctx.cgContext.move(to: CGPoint(x: center.x, y: center.y - 4))
                ctx.cgContext.addLine(to: CGPoint(x: center.x, y: center.y + 6))
                ctx.cgContext.strokePath()
            } else {
                UIColor.systemBlue.setFill()
                ctx.cgContext.fillEllipse(in: rect.insetBy(dx: 2, dy: 2))
            }
        }.withRenderingMode(.alwaysTemplate)
    }

`;

content = content.replace(/extension UIImage \{\s*\n/, `extension UIImage {\n${helper}`);

// 1. With withRenderingMode
content = content.replace(
  /UIImage\(named: "([^"]+)",\s+in: \.mapboxNavigation,\s+compatibleWith: nil\)!\.withRenderingMode\(\.alwaysTemplate\)/g,
  'mapboxNavigationImage(named: "$1").withRenderingMode(.alwaysTemplate)'
);

// 2. With ! only
content = content.replace(
  /UIImage\(named: "([^"]+)",\s+in: \.mapboxNavigation,\s+compatibleWith: nil\)!/g,
  'mapboxNavigationImage(named: "$1")'
);

// 3. Optional (no !)
content = content.replace(
  /UIImage\(named: "([^"]+)",\s+in: \.mapboxNavigation,\s+compatibleWith: nil\)/g,
  'mapboxNavigationImage(named: "$1")'
);

fs.writeFileSync(uiimagePath, content);
console.log('[fix-mapbox-uiimage] Patched UIImage.swift - safe fallback for missing bundle assets');
