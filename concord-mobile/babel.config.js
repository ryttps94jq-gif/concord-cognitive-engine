module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@surface': './src/surface',
            '@mesh': './src/mesh',
            '@foundation': './src/foundation',
            '@dtu': './src/dtu',
            '@economy': './src/economy',
            '@shield': './src/shield',
            '@brain': './src/brain',
            '@broadcast': './src/broadcast',
            '@store': './src/store',
            '@hooks': './src/hooks',
            '@utils': './src/utils',
          },
        },
      ],
    ],
  };
};
