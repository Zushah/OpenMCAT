import { expect, test as base } from "@playwright/test";

export { expect };

export const test = base.extend({
    page: async ({ page }, use) => {
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
        await use(page);
        expect(errors, `Unexpected browser errors:\n${errors.join("\n\n")}`).toEqual([]);
    }
});

export const closeBackupReminderIfVisible = async (page) => {
    const laterButton = page.getByRole("button", { name: "Remind me later" });
    if (await laterButton.isVisible()) await laterButton.click();
};
