#!/usr/bin/env node
/* eslint-env node */
/* global __dirname */
/**
 * Patch MapboxNavigation RouteVoiceController.swift to avoid crash when reroute-sound asset is missing.
 * Crash: NSDataAsset(name: "reroute-sound", bundle: .mapboxNavigation)! force unwrap
 * Cause: Bundle assets not properly included (actool disabled for Assets.car fix)
 */
const fs = require('fs');
const path = require('path');

const podsRoot = path.join(__dirname, '..', 'ios', 'Pods');
const voicePath = path.join(podsRoot, 'MapboxNavigation/Sources/MapboxNavigation/RouteVoiceController.swift');

if (!fs.existsSync(voicePath)) {
  console.log('[fix-mapbox-route-voice] RouteVoiceController.swift not found (run pod install first)');
  process.exit(0);
}

try {
  const { execSync } = require('child_process');
  const mapboxDir = path.join(podsRoot, 'MapboxNavigation');
  execSync(`chmod -R u+w "${mapboxDir}"`, { stdio: 'ignore' });
} catch (_) {}

let content = fs.readFileSync(voicePath, 'utf8');

// Already correctly patched (delegate after super.init)
if (content.includes('rerouteSoundPlayer?.delegate = self')) {
  console.log('[fix-mapbox-route-voice] Already patched');
  process.exit(0);
}

// Replace the crash-prone init block with safe optional loading
const oldInit = `    public init(navigationService: NavigationService, speechSynthesizer: SpeechSynthesizing? = nil, accessToken: String? = nil, host: String? = nil) {
        self.speechSynthesizer = speechSynthesizer ?? MultiplexedSpeechSynthesizer(accessToken: accessToken, host: host)
        rerouteSoundPlayer = try! AVAudioPlayer(data: NSDataAsset(name: "reroute-sound", bundle: .mapboxNavigation)!.data,
                                                fileTypeHint: AVFileType.mp3.rawValue)
        
        super.init()
        
        rerouteSoundPlayer.delegate = self`;

const newInit = `    public init(navigationService: NavigationService, speechSynthesizer: SpeechSynthesizing? = nil, accessToken: String? = nil, host: String? = nil) {
        self.speechSynthesizer = speechSynthesizer ?? MultiplexedSpeechSynthesizer(accessToken: accessToken, host: host)
        if let asset = NSDataAsset(name: "reroute-sound", bundle: .mapboxNavigation),
           let player = try? AVAudioPlayer(data: asset.data, fileTypeHint: AVFileType.mp3.rawValue) {
            rerouteSoundPlayer = player
        } else {
            rerouteSoundPlayer = nil
        }
        
        super.init()
        
        rerouteSoundPlayer?.delegate = self`;

// Match our previous patch (with player.delegate before super.init - causes build error)
const oldInitAlt = `        if let asset = NSDataAsset(name: "reroute-sound", bundle: .mapboxNavigation),
           let player = try? AVAudioPlayer(data: asset.data, fileTypeHint: AVFileType.mp3.rawValue) {
            rerouteSoundPlayer = player
            player.delegate = self
        } else {
            rerouteSoundPlayer = nil
        }
        
        super.init()`;

const newInitAlt = `        if let asset = NSDataAsset(name: "reroute-sound", bundle: .mapboxNavigation),
           let player = try? AVAudioPlayer(data: asset.data, fileTypeHint: AVFileType.mp3.rawValue) {
            rerouteSoundPlayer = player
        } else {
            rerouteSoundPlayer = nil
        }
        
        super.init()
        
        rerouteSoundPlayer?.delegate = self`;

if (content.includes(oldInitAlt)) {
  content = content.replace(oldInitAlt, newInitAlt);
} else if (content.includes(oldInit)) {
  content = content.replace(oldInit, newInit);
} else {
  console.log('[fix-mapbox-route-voice] Init block not found (SDK version may have changed)');
  process.exit(0);
}

// Change property to optional (nil when asset missing)
const oldProperty = `    /**
     Sound to play prior to reroute. Inherits volume level from \`volume\`.
     */
    public var rerouteSoundPlayer: AVAudioPlayer`;

const newProperty = `    /**
     Sound to play prior to reroute. Inherits volume level from \`volume\`.
     Nil when reroute-sound asset is missing from bundle.
     */
    public var rerouteSoundPlayer: AVAudioPlayer?`;

content = content.replace(oldProperty, newProperty);

// Fix play() call - use optional chaining
content = content.replace('rerouteSoundPlayer.play()', 'rerouteSoundPlayer?.play()');

fs.writeFileSync(voicePath, content);
console.log('[fix-mapbox-route-voice] Patched RouteVoiceController.swift - safe fallback for missing reroute-sound');
