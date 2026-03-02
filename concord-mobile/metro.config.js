const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Allow .cjs files for some native modules
config.resolver.sourceExts.push('cjs');

module.exports = config;
