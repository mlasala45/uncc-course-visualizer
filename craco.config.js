module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.module.rules.push({
        test: /\.wgsl$/,
        type: 'asset/source', // Use Webpack's asset module to treat `.wgsl` files as raw text
      });
      

      webpackConfig.resolve.extensions = [
        '.ts',
        '.tsx',
        ...webpackConfig.resolve.extensions,
      ];

      return webpackConfig;
    },
  },
};