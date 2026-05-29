import { flag } from "flags/next";

export const emailNotificationsFlag = flag<boolean>({
  key: "email-notifications",
  description: "Enable email sending for notifications and project updates",
  defaultValue: false,
  decide: () => false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const newFeaturesPageFlag = flag<boolean>({
  key: "new-features-page",
  description: "Show the dedicated new features / changelog page",
  defaultValue: false,
  decide: () => false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const enhancedAiFlag = flag<boolean>({
  key: "enhanced-ai",
  description: "Enable next-generation AI features across the workspace",
  defaultValue: false,
  decide: () => false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const uiRefreshFlag = flag<boolean>({
  key: "ui-refresh",
  description: "Enable the updated UI redesign",
  defaultValue: false,
  decide: () => false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});
