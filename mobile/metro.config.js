// The app shares a few dependency-free helpers with the website (../lib): the
// chat reply protocol, the streaming pacer, the Markdown tidier, the em dash
// filter, and the data types. Metro has to be allowed to read that folder.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, "../lib")];

module.exports = config;
