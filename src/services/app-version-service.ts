import { supabaseAdmin } from "../lib/supabase.js";
import { z } from "zod";

type PlatformType = "ios" | "android";

type ChangeLogEntry = {
  version: string;
  date: string;
  features: string[];
  bugFixes: string[];
};

type PlatformConfig = {
  id: string;
  platform: string;
  latestVersion: string;
  minimumSupportedVersion: string;
  updateUrl: string;
  releaseNotes: string;
  releaseDate: string;
  changeLog: ChangeLogEntry[];
  isActive: boolean;
};

type VersionCheckRequest = {
  appVersion: string;
  appName: string;
  platform: "ios" | "android";
  buildNumber?: string;
  osVersion?: string;
  deviceModel?: string;
};

type VersionCheckResponse = {
  success: boolean;
  updateAvailable: boolean;
  updateRequired: boolean;
  currentVersion: string;
  latestVersion: string;
  minimumSupportedVersion: string;
  updateType: "none" | "optional" | "required";
  updateUrl?: string;
  releaseNotes?: string;
  changeLog?: ChangeLogEntry[];
  skipAvailable?: boolean;
  skipUntilVersion?: string | null;
};

type UpdateVersionRequest = {
  platform: PlatformType;
  latestVersion: string;
  minimumSupportedVersion: string;
  updateUrl: string;
  releaseNotes: string;
  releaseDate: string;
  changeLog: ChangeLogEntry[];
};

function parseVersion(versionStr: string): number[] {
  return versionStr.split(".").map((v) => parseInt(v, 10) || 0);
}

function compareVersions(current: string, target: string): number {
  const currentParts = parseVersion(current);
  const targetParts = parseVersion(target);

  const maxLength = Math.max(currentParts.length, targetParts.length);

  for (let i = 0; i < maxLength; i++) {
    const curr = currentParts[i] || 0;
    const targ = targetParts[i] || 0;

    if (curr < targ) return -1;
    if (curr > targ) return 1;
  }

  return 0;
}

export async function getVersionConfig(platform: PlatformType): Promise<PlatformConfig> {
  const { data, error } = await supabaseAdmin
    .from("app_versions")
    .select("id, platform, latest_version, minimum_supported_version, update_url, release_notes, release_date, changelog, is_active")
    .eq("platform", platform)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch version config for ${platform}`);
  }

  return {
    id: data.id,
    platform: data.platform,
    latestVersion: data.latest_version,
    minimumSupportedVersion: data.minimum_supported_version,
    updateUrl: data.update_url,
    releaseNotes: data.release_notes,
    releaseDate: data.release_date,
    changeLog: data.changelog || [],
    isActive: data.is_active,
  };
}

export async function checkAppVersion(
  request: VersionCheckRequest
): Promise<VersionCheckResponse> {
  const platform = request.platform.toLowerCase() as PlatformType;

  if (!["ios", "android"].includes(platform)) {
    throw new Error("Invalid platform. Must be 'ios' or 'android'");
  }

  const config = await getVersionConfig(platform);
  const currentVersion = request.appVersion.trim();
  const latestVersion = config.latestVersion;
  const minimumVersion = config.minimumSupportedVersion;

  const currentVsMin = compareVersions(currentVersion, minimumVersion);
  const currentVsLatest = compareVersions(currentVersion, latestVersion);

  if (currentVsMin < 0) {
    return {
      success: true,
      updateAvailable: true,
      updateRequired: true,
      currentVersion,
      latestVersion,
      minimumSupportedVersion: minimumVersion,
      updateType: "required",
      updateUrl: config.updateUrl,
      releaseNotes: config.releaseNotes,
      changeLog: config.changeLog,
      skipAvailable: false,
    };
  }

  if (currentVsLatest < 0) {
    return {
      success: true,
      updateAvailable: true,
      updateRequired: false,
      currentVersion,
      latestVersion,
      minimumSupportedVersion: minimumVersion,
      updateType: "optional",
      updateUrl: config.updateUrl,
      releaseNotes: config.releaseNotes,
      changeLog: config.changeLog,
      skipAvailable: true,
    };
  }

  return {
    success: true,
    updateAvailable: false,
    updateRequired: false,
    currentVersion,
    latestVersion,
    minimumSupportedVersion: minimumVersion,
    updateType: "none",
  };
}

export async function updateVersionConfig(
  input: UpdateVersionRequest
): Promise<PlatformConfig> {
  const updateVersionSchema = z.object({
    latestVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    minimumSupportedVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    updateUrl: z.string().url(),
    releaseNotes: z.string().min(1),
    releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    changeLog: z.array(
      z.object({
        version: z.string(),
        date: z.string(),
        features: z.array(z.string()),
        bugFixes: z.array(z.string()),
      })
    ),
  });

  const validated = updateVersionSchema.parse(input);

  const { data, error } = await supabaseAdmin
    .from("app_versions")
    .update({
      latest_version: validated.latestVersion,
      minimum_supported_version: validated.minimumSupportedVersion,
      update_url: validated.updateUrl,
      release_notes: validated.releaseNotes,
      release_date: validated.releaseDate,
      changelog: validated.changeLog,
    })
    .eq("platform", input.platform)
    .eq("is_active", true)
    .select("id, platform, latest_version, minimum_supported_version, update_url, release_notes, release_date, changelog, is_active")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update version config for ${input.platform}`);
  }

  return {
    id: data.id,
    platform: data.platform,
    latestVersion: data.latest_version,
    minimumSupportedVersion: data.minimum_supported_version,
    updateUrl: data.update_url,
    releaseNotes: data.release_notes,
    releaseDate: data.release_date,
    changeLog: data.changelog || [],
    isActive: data.is_active,
  };
}
