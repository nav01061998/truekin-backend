import { supabaseAdmin } from "../lib/supabase.js";

export type HomepageConfig = {
  mode: "guest" | "authenticated";
  greeting: string;
  title: string;
  subtitle: string;
  topBar: {
    title: string;
    navbarItems: Array<{
      id: string;
      icon: string;
      hPos: number;
      pageName: string;
    }>;
  };
  bottomBar: {
    items: Array<{
      id: string;
      title: string;
      activeIcon: string;
      inActiveIcon: string;
      hPos: number;
      pageName: string;
    }>;
  };
  prompt?: {
    title: string;
    description: string;
    ctaLabel: string;
    actionId: string;
  };
  sectionTitle: string;
  cards: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    ctaLabel?: string;
    actionId?: string;
  }>;
  update: {
    available: boolean;
    autoPrompt: boolean;
    title: string;
    description: string;
    url: string | null;
  };
};

export async function getHomepageConfig(mode: "guest" | "authenticated"): Promise<HomepageConfig> {
  const { data, error } = await supabaseAdmin
    .from("homepage_config")
    .select(
      `id,
       mode,
       greeting,
       title,
       subtitle,
       top_bar_title,
       top_bar_items,
       bottom_bar_items,
       prompt_title,
       prompt_description,
       prompt_cta_label,
       prompt_action_id,
       section_title,
       cards,
       update_available,
       update_auto_prompt,
       update_title,
       update_description,
       update_url`
    )
    .eq("mode", mode)
    .eq("is_active", true)
    .single();

  if (error) {
    console.error("Error fetching homepage config:", error);
    throw new Error(`Failed to load homepage configuration: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Homepage configuration not found for mode: ${mode}`);
  }

  // Transform database row to API response format
  const config: HomepageConfig = {
    mode: data.mode,
    greeting: data.greeting,
    title: data.title,
    subtitle: data.subtitle,
    topBar: {
      title: data.top_bar_title,
      navbarItems: data.top_bar_items || [],
    },
    bottomBar: {
      items: data.bottom_bar_items || [],
    },
    sectionTitle: data.section_title,
    cards: data.cards || [],
    update: {
      available: data.update_available || false,
      autoPrompt: data.update_auto_prompt || false,
      title: data.update_title || "New Version Available!",
      description:
        data.update_description ||
        "Enjoy new features and improvements. Update now for the best experience.",
      url: data.update_url || null,
    },
  };

  // Add optional prompt if all fields are present
  if (
    data.prompt_title &&
    data.prompt_description &&
    data.prompt_cta_label &&
    data.prompt_action_id
  ) {
    config.prompt = {
      title: data.prompt_title,
      description: data.prompt_description,
      ctaLabel: data.prompt_cta_label,
      actionId: data.prompt_action_id,
    };
  }

  return config;
}

export async function updateHomepageConfig(
  mode: "guest" | "authenticated",
  updates: Partial<Omit<HomepageConfig, "mode">>
): Promise<HomepageConfig> {
  const updatePayload: Record<string, any> = {};

  if (updates.greeting) updatePayload.greeting = updates.greeting;
  if (updates.title) updatePayload.title = updates.title;
  if (updates.subtitle) updatePayload.subtitle = updates.subtitle;

  if (updates.topBar?.title) {
    updatePayload.top_bar_title = updates.topBar.title;
  }
  if (updates.topBar?.navbarItems) {
    updatePayload.top_bar_items = updates.topBar.navbarItems;
  }

  if (updates.bottomBar?.items) {
    updatePayload.bottom_bar_items = updates.bottomBar.items;
  }

  if (updates.sectionTitle) updatePayload.section_title = updates.sectionTitle;
  if (updates.cards) updatePayload.cards = updates.cards;

  if (updates.prompt) {
    updatePayload.prompt_title = updates.prompt.title;
    updatePayload.prompt_description = updates.prompt.description;
    updatePayload.prompt_cta_label = updates.prompt.ctaLabel;
    updatePayload.prompt_action_id = updates.prompt.actionId;
  }

  if (updates.update) {
    updatePayload.update_available = updates.update.available;
    updatePayload.update_auto_prompt = updates.update.autoPrompt;
    updatePayload.update_title = updates.update.title;
    updatePayload.update_description = updates.update.description;
    updatePayload.update_url = updates.update.url;
  }

  const { error } = await supabaseAdmin
    .from("homepage_config")
    .update(updatePayload)
    .eq("mode", mode)
    .eq("is_active", true);

  if (error) {
    console.error("Error updating homepage config:", error);
    throw new Error(`Failed to update homepage configuration: ${error.message}`);
  }

  return getHomepageConfig(mode);
}
