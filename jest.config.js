/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": ["@swc/jest", { module: { type: "es6" } }],
  },
  resolver: "./jest-resolver.cjs",
};
