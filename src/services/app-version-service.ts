import { supabaseAdmin } from "../lib/supabase.js";

export type AppVersion = {
  platform: "ios" | "android";
  latest_version: string;
  minimum_supported_version: string;
  update_url: string;
  release_notes: string;
  release_date: string;
  changelog: any;
};

/**
 * Fetch active app version from database for a specific platform
 */
export async function getAppVersion(platform: "ios" | "android"): Promise<AppVersion | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_versions")
      .select("*")
      .eq("platform", platform)
      .eq("is_active", true)
      .single();

    if (error) {
      console.error(`Error fetching app version for ${platform}:`, error);
      return null;
    }

    return data as AppVersion;
  } catch (error) {
    console.error(`Exception fetching app version for ${platform}:`, error);
    return null;
  }
}

/**
 * Compare two semantic versions
 * Returns: 0 if equal, 1 if version1 > version2, -1 if version1 < version2
 */
export function compareVersions(version1: string, version2: string): number {
  const parseVersion = (v: string) => {
    const parts = v.split(".").map((p) => parseInt(p) || 0);
    return {
      major: parts[0],
      minor: parts[1],
      patch: parts[2],
    };
  };

  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (v1.major !== v2.major) return v1.major > v2.major ? 1 : -1;
  if (v1.minor !== v2.minor) return v1.minor > v2.minor ? 1 : -1;
  if (v1.patch !== v2.patch) return v1.patch > v2.patch ? 1 : -1;

  return 0;
}

/**
 * Check version status and determine update type
 */
export function getUpdateType(
  clientVersion: string,
  latestVersion: string,
  minimumVersion: string
): "none" | "optional" | "required" {
  const belowMinimum = compareVersions(clientVersion, minimumVersion) < 0;
  const updateAvailable = compareVersions(clientVersion, latestVersion) < 0;

  if (belowMinimum) {
    return "required";
  } else if (updateAvailable) {
    return "optional";
  }

  return "none";
}

/**
 * Update app version configuration in the database
 */
export async function updateVersionConfig(config: {
  platform: "ios" | "android";
  latestVersion: string;
  minimumSupportedVersion: string;
  updateUrl: string;
  releaseNotes: string;
  releaseDate: string;
  changeLog?: any;
}): Promise<AppVersion> {
  try {
    // Get current active version to update it
    const { data: currentVersion, error: fetchError } = await supabaseAdmin
      .from("app_versions")
      .select("*")
      .eq("platform", config.platform)
      .eq("is_active", true)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 is "not found" error, which is fine
      throw fetchError;
    }

    let result;

    if (currentVersion) {
      // Update existing active version
      const { data, error } = await supabaseAdmin
        .from("app_versions")
        .update({
          latest_version: config.latestVersion,
          minimum_supported_version: config.minimumSupportedVersion,
          update_url: config.updateUrl,
          release_notes: config.releaseNotes,
          release_date: config.releaseDate,
          changelog: config.changeLog || [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentVersion.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new version entry if none exists
      const { data, error } = await supabaseAdmin
        .from("app_versions")
        .insert({
          platform: config.platform,
          latest_version: config.latestVersion,
          minimum_supported_version: config.minimumSupportedVersion,
          update_url: config.updateUrl,
          release_notes: config.releaseNotes,
          release_date: config.releaseDate,
          changelog: config.changeLog || [],
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return result as AppVersion;
  } catch (error) {
    console.error(`Error updating app version for ${config.platform}:`, error);
    throw error;
  }
}
