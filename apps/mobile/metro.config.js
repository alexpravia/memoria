const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root so Metro sees changes in packages/
config.watchFolders = [workspaceRoot];

// Resolve @memoria/core from the workspace root node_modules as well
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Enable symlink resolution (npm workspaces uses symlinks)
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
