export type HomeActionId = "sign_in" | "add_medicine" | "add_family";

export type HomeCard = {
  id: string;
  title: string;
  description: string;
  icon: string;
  ctaLabel?: string;
  actionId?: HomeActionId;
};

export type HomeContent = {
  mode: "guest" | "authenticated";
  greeting: string;
  title: string;
  subtitle: string;
  prompt?: {
    title: string;
    description: string;
    ctaLabel: string;
    actionId: HomeActionId;
  };
  sectionTitle: string;
  cards: HomeCard[];
  update: {
    available: boolean;
    autoPrompt: boolean;
    title: string;
    description: string;
    url: string | null;
  };
};

