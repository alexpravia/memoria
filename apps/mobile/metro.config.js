const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root so Metro sees changes in packages/
config.watchFolders = [workspaceRoot];

// Resolve modules from the mobile app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Enable symlink resolution (npm workspaces uses symlinks)
config.resolver.unstable_enableSymlinks = true;

// Force React (and react-native) to always resolve from the mobile app's own
// node_modules, regardless of where the importing file lives in the monorepo.
// extraNodeModules alone doesn't intercept symlinked workspace packages;
// resolveRequest does because it's called for every single module lookup.
const PINNED = new Set([
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-native",
  "react-native-reanimated",
  "react-native-worklets",
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (PINNED.has(moduleName) || moduleName.startsWith("react/") || moduleName.startsWith("react-native/")) {
    return {
      filePath: require.resolve(moduleName, {
        paths: [path.resolve(projectRoot, "node_modules")],
      }),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
