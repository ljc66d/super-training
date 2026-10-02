module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // 不使用 Tamagui babel 插件预编译，让 Tamagui 完全在运行时工作
    // 避免 web 导出时 config 加载问题
  };
};
