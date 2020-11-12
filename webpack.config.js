const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require("webpack");

let config = {
    context: path.resolve(__dirname, "src"),
    entry: "./app.js",
    resolve: {
        alias: {
            'syncPlay': path.resolve(__dirname, "src/components/syncPlay/core")
        }
    },
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "dist"),
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyWebpackPlugin([{
            from: "**/*",
            to: ".",
            ignore: ['*.js']
        }])
    ]
};

module.exports = (env, argv) => {
    const isProduction = (argv.mode === "production");

    config.plugins.push(
        new webpack.DefinePlugin({
            PRODUCTION: JSON.stringify(isProduction)
        })
    );

    if (!isProduction) {
        config.devtool = "#inline-source-map";
    }

    return config;
};
