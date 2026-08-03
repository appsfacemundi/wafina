const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the root workspace (including packages/ and root node_modules)
config.watchFolders = [workspaceRoot];

// 2. Resolve node_modules from app first, then workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve symlinked packages across the workspace
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
