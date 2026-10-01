const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('m3u')) {
  config.resolver.assetExts.push('m3u');
}

module.exports = config;
