/** @type {import('jest').Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/tests"],
    setupFiles: ["<rootDir>/tests/setup-env.ts"],
    // Sources use ESM-style ".js" import suffixes; map them back to the .ts files.
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
};
