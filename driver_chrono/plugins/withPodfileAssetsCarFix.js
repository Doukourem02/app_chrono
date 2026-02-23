const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const POST_INSTALL_FIX = `
    # Fix duplicate Assets.car (Multiple commands produce)
    fix_script = File.join(__dir__, '..', 'scripts', 'fix-assets-car.js')
    if File.exist?(fix_script)
      system('node', fix_script)
    end
    # Fix MapboxMaps ViewAnnotationManager.swift for Xcode 16 (compactMapValues type inference)
    mapbox_swift = File.join(installer.sandbox.root, 'MapboxMaps/Sources/MapboxMaps/Annotations/ViewAnnotationManager.swift')
    system('chmod', '-R', 'u+w', File.join(installer.sandbox.root, 'MapboxMaps')) rescue nil
    if File.exist?(mapbox_swift)
      content = File.read(mapbox_swift)
      old = '        idsByView.compactMapValues { [mapboxMap] id in
            try? mapboxMap.options(forViewAnnotationWithId: id)
        }'
      new = '        var result: [UIView: ViewAnnotationOptions] = [:]
        for (view, id) in idsByView {
            if let options = try? mapboxMap.options(forViewAnnotationWithId: id) {
                result[view] = options
            }
        }
        return result'
      if content.include?(old)
        content = content.sub(old, new)
        File.write(mapbox_swift, content)
        puts '[Fix] Patched ViewAnnotationManager.swift for Xcode 16'
      end
    end`;

/**
 * Corrige l'erreur "Multiple commands produce Assets.car" :
 * 1. install! 'cocoapods', :disable_input_output_paths => true
 * 2. post_install : supprime Assets.car des output_paths de [CP] Copy Pods Resources
 */
function withPodfileAssetsCarFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = await fs.promises.readFile(podfilePath, 'utf8');

      // 1. Ajouter install! si absent
      const fixLine = "install! 'cocoapods', :disable_input_output_paths => true";
      if (!contents.includes(fixLine)) {
        const platformRegex = /^(platform :ios[^\n]+\n)/m;
        contents = platformRegex.test(contents)
          ? contents.replace(platformRegex, `$1\n# Fix Multiple commands produce Assets.car\n${fixLine}\n\n`)
          : contents.replace(/(\nprepare_react_native_project!)/, `\n\n${fixLine}\n$1`);
      }

      // 2. Ajouter le fix post_install si absent
      if (!contents.includes('Fix duplicate Assets.car')) {
        contents = contents.replace(
          /(:ccache_enabled => ccache_enabled\?\(podfile_properties\),\s*\n\s+\)\s*\n)(\s+end\s*\n)(end)/m,
          `$1${POST_INSTALL_FIX}\n$2$3`
        );
      } else if (!contents.includes('ViewAnnotationManager.swift')) {
        // Podfile a déjà le fix Assets.car, ajouter le fix Mapbox Xcode 16
        const MAPBOX_FIX = `
    # Fix MapboxMaps ViewAnnotationManager.swift for Xcode 16 (compactMapValues type inference)
    mapbox_swift = File.join(installer.sandbox.root, 'MapboxMaps/Sources/MapboxMaps/Annotations/ViewAnnotationManager.swift')
    system('chmod', '-R', 'u+w', File.join(installer.sandbox.root, 'MapboxMaps')) rescue nil
    if File.exist?(mapbox_swift)
      content = File.read(mapbox_swift)
      old = '        idsByView.compactMapValues { [mapboxMap] id in
            try? mapboxMap.options(forViewAnnotationWithId: id)
        }'
      new = '        var result: [UIView: ViewAnnotationOptions] = [:]
        for (view, id) in idsByView {
            if let options = try? mapboxMap.options(forViewAnnotationWithId: id) {
                result[view] = options
            }
        }
        return result'
      if content.include?(old)
        content = content.sub(old, new)
        File.write(mapbox_swift, content)
        puts '[Fix] Patched ViewAnnotationManager.swift for Xcode 16'
      end
    end`;
        contents = contents.replace(
          /(fix_script = File\.join\(__dir__, '\.\.', 'scripts', 'fix-assets-car\.js'\)\s+if File\.exist\?\(fix_script\)\s+system\('node', fix_script\)\s+end)/m,
          `$1${MAPBOX_FIX}`
        );
      }

      await fs.promises.writeFile(podfilePath, contents);
      return config;
    },
  ]);
}

module.exports = withPodfileAssetsCarFix;
