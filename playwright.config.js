// Playwright configuration for CPR Counter browser tests.
// Serves the repo over plain HTTP on 127.0.0.1 (a secure context, so the
// service worker, Web Locks, and Web Audio paths behave as on localhost).
// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './browser-tests',
  timeout: 60000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8901',
    launchOptions: {
      // Headless audio renders silently; allow the AudioContext to start
      // from the test's synthetic clicks without a real gesture policy.
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  webServer: {
    command: 'python3 -m http.server 8901 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8901/index.html',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
