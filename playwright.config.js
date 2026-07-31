import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
    testDir: "./test",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ["line"],
        ["html", { open: "never" }]
    ],
    use: {
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure"
    },
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                permissions: ["clipboard-read", "clipboard-write"]
            }
        },
        {
            name: "firefox",
            use: {
                ...devices["Desktop Firefox"]
            }
        },
        {
            name: "webkit",
            use: {
                ...devices["Desktop Safari"]
            }
        }
    ],
    webServer: {
        command: "node test/server.js",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000
    }
});
