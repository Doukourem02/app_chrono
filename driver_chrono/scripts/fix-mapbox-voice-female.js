#!/usr/bin/env node
/* eslint-env node */
/* global __dirname */
/**
 * Force la voix féminine pour la navigation Mapbox en français.
 * Par défaut iOS peut utiliser une voix masculine ; on préfère une voix féminine pour fr-FR.
 */
const fs = require('fs');
const path = require('path');

const podsRoot = path.join(__dirname, '..', 'ios', 'Pods');
const synthPath = path.join(podsRoot, 'MapboxNavigation/Sources/MapboxNavigation/SystemSpeechSynthesizer.swift');

if (!fs.existsSync(synthPath)) {
  console.log('[fix-mapbox-voice-female] SystemSpeechSynthesizer.swift not found (run pod install first)');
  process.exit(0);
}

try {
  const { execSync } = require('child_process');
  const mapboxDir = path.join(podsRoot, 'MapboxNavigation');
  execSync(`chmod -R u+w "${mapboxDir}"`, { stdio: 'ignore' });
} catch (_) {}

let content = fs.readFileSync(synthPath, 'utf8');

// Déjà patché
if (content.includes('Préférer la voix féminine pour le français')) {
  console.log('[fix-mapbox-voice-female] Already patched');
  process.exit(0);
}

const oldBlock = `        // Only localized languages will have a proper fallback voice
        if utterance?.voice == nil {
            utterance?.voice = AVSpeechSynthesisVoice(language: localeCode)
        }`;

const newBlock = `        // Only localized languages will have a proper fallback voice
        if utterance?.voice == nil {
            // Préférer la voix féminine pour le français (Côte d'Ivoire)
            if localeCode.hasPrefix("fr") {
                let femaleVoice = AVSpeechSynthesisVoice.speechVoices().first { $0.language.hasPrefix("fr") && $0.gender == .female }
                utterance?.voice = femaleVoice ?? AVSpeechSynthesisVoice(language: localeCode)
            } else {
                utterance?.voice = AVSpeechSynthesisVoice(language: localeCode)
            }
        }`;

if (!content.includes(oldBlock)) {
  console.log('[fix-mapbox-voice-female] Target block not found (SDK version may have changed)');
  process.exit(0);
}

content = content.replace(oldBlock, newBlock);
fs.writeFileSync(synthPath, content);
console.log('[fix-mapbox-voice-female] Patched SystemSpeechSynthesizer - female voice for French');
