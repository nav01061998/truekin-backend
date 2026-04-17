type PlatformType = "ios" | "android";

type ChangeLogEntry = {
  version: string;
  date: string;
  features: string[];
  bugFixes: string[];
};

type PlatformConfig = {
  latestVersion: string;
  minimumSupportedVersion: string;
  updateUrl: string;
  releaseNotes: string;
  releaseDate: string;
  changeLog: ChangeLogEntry[];
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

// Version configuration for each platform
// This should be updated via admin panel in production
const versionConfig: Record<PlatformType, PlatformConfig> = {
  ios: {
    latestVersion: "1.0.0",
    minimumSupportedVersion: "1.0.0",
    updateUrl: "https://apps.apple.com/app/truekin/id123456",
    releaseNotes: "Initial release",
    releaseDate: "2026-04-17",
    changeLog: [
      {
        version: "1.0.0",
        date: "2026-04-17",
        features: ["User onboarding", "Medication tracking", "Health conditions"],
        bugFixes: [],
      },
    ],
  },
  android: {
    latestVersion: "1.0.0",
    minimumSupportedVersion: "1.0.0",
    updateUrl: "https://play.google.com/store/apps/details?id=com.careloop.truekin",
    releaseNotes: "Initial release",
    releaseDate: "2026-04-17",
    changeLog: [
      {
        version: "1.0.0",
        date: "2026-04-17",
        features: ["User onboarding", "Medication tracking", "Health conditions"],
        bugFixes: [],
      },
    ],
  },
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

export async function checkAppVersion(
  request: VersionCheckRequest
): Promise<VersionCheckResponse> {
  const platform = request.platform.toLowerCase() as PlatformType;

  if (!["ios", "android"].includes(platform)) {
    throw new Error("Invalid platform. Must be 'ios' or 'android'");
  }

  const config = versionConfig[platform];
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

export function getVersionConfig(platform: PlatformType): PlatformConfig {
  return versionConfig[platform];
}

export function setVersionConfig(platform: PlatformType, config: Partial<PlatformConfig>): void {
  if (!["ios", "android"].includes(platform)) {
    throw new Error("Invalid platform");
  }
  versionConfig[platform] = { ...versionConfig[platform], ...config };
}
