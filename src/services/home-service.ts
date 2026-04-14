import { env } from "../config/env.js";
import type { HomeContent } from "../types/home.js";

export function buildHomeContent(input: {
  isLoggedIn: boolean;
  displayName?: string | null;
}): HomeContent {
  const update = {
    available: env.appUpdateAvailable,
    autoPrompt: env.appUpdateAutoprompt,
    title: "New Version Available!",
    description:
      "Enjoy new features and improvements. Update now for the best experience!",
    url: env.appUpdateUrl,
  };

  if (!input.isLoggedIn) {
    return {
      mode: "guest",
      greeting: "Welcome to TrueKin",
      title: "Care starts with simple routines",
      subtitle:
        "Sign in to add medicines, create reminders, and stay connected with family health.",
      prompt: {
        title: "Start tracking your medications",
        description:
          "Sign in to add medicines, set reminders, and never miss a dose.",
        ctaLabel: "Sign in to get started",
        actionId: "sign_in",
      },
      sectionTitle: "What you can do with TrueKin",
      cards: [
        {
          id: "guest-reminders",
          title: "Medicine reminders",
          description: "Get gentle nudges so you never miss a dose.",
          icon: "notifications-active",
        },
        {
          id: "guest-scan",
          title: "Scan prescriptions",
          description: "Upload a prescription photo and add medicines faster.",
          icon: "document-scanner",
        },
        {
          id: "guest-family",
          title: "Family health",
          description: "Keep medications and care updates in one place.",
          icon: "people",
        },
      ],
      update,
    };
  }

  return {
    mode: "authenticated",
    greeting: input.displayName?.trim() || "Welcome back",
    title: "Care is easier when your next step is clear",
    subtitle:
      "Start setting up your medication reminders or add the people you care for.",
    sectionTitle: "What you can do with TrueKin",
    cards: [
      {
        id: "auth-reminders",
        title: "Medicine reminders",
        description:
          "Want to start adding medicines and set up timely reminders?",
        icon: "medication",
        ctaLabel: "Start adding medicines",
        actionId: "add_medicine",
      },
      {
        id: "auth-family",
        title: "Family health",
        description:
          "Add other members and keep their medication details organised.",
        icon: "group-add",
        ctaLabel: "Add family members",
        actionId: "add_family",
      },
    ],
    update,
  };
}
