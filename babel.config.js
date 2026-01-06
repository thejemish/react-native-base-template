module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  plugins.push([
    'react-native-unistyles/plugin',
    {
      root: 'app',
      autoProcessImports: ['@/components'],
    },
  ]);

  // Add babel-plugin-transform-remove-console only for production and  builds
  if (process.env.EXPO_APP_ENV === 'production' || process.env.EXPO_APP_ENV === 'preview') {
    plugins.push('transform-remove-console');
  }

  plugins.push('react-native-worklets/plugin');

  return {
    presets: ['babel-preset-expo'],

    plugins,
  };
};
