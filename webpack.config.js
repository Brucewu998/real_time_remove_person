const path = require('path');
const webpack = require('webpack');

module.exports={
    mode: 'development', 
    entry: './src/index.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'), // 打包路径 __dirname: 绝对路径
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin() // 热更新
    ],
    devServer: {
        contentBase: './dist',
        hot: true
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            }

        ]
    }
}