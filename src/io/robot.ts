import type { RobotConfig, RobotFeature, Settings } from "../types";

export const ROBOT_CONFIG_KEYS = [
  "forwardVelocity",
  "strafeVelocity",
  "aVelocity",
  "kFriction",
  "rLength",
  "rWidth",
  "rForward",
  "safetyMargin",
  "maxVelocity",
  "maxAcceleration",
  "maxDeceleration",
] as const satisfies readonly (keyof RobotConfig)[];

export function robotConfigOf(settings: Settings): RobotConfig {
  return normalizeRobotConfig(settings, settings);
}

/** Each key from `input` when it is a finite number, else from `fallback`. */
export function normalizeRobotConfig(
  input: unknown,
  fallback: RobotConfig,
): RobotConfig {
  const source = (input ?? {}) as Partial<Record<keyof RobotConfig, unknown>>;
  const config: Partial<RobotConfig> = {};
  for (const key of ROBOT_CONFIG_KEYS) {
    const value = source[key];
    const chosen =
      typeof value === "number" && Number.isFinite(value)
        ? value
        : // Fork: a file that records no box offset has a centred box, whatever the default.
          key === "rForward" && input !== fallback
          ? undefined
          : fallback[key];
    if (chosen !== undefined) config[key] = chosen;
  }
  // Fork: a file that records no features has none, whatever the default.
  const features =
    source.features !== undefined || input === fallback
      ? normalizeFeatures(source.features)
      : [];
  if (features.length) config.features = features;
  return config as RobotConfig;
}

/** Fork: the well-formed features in `value`, sizes positive, numbers finite. */
export function normalizeFeatures(value: unknown): RobotFeature[] {
  if (!Array.isArray(value)) return [];
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return value.flatMap((raw): RobotFeature[] => {
    if (typeof raw !== "object" || raw === null) return [];
    const f = raw as Record<string, unknown>;
    const length = num(f.length);
    const width = num(f.width);
    if (!length || !width || length <= 0 || width <= 0) return [];
    return [
      {
        name: typeof f.name === "string" ? f.name : "Feature",
        length,
        width,
        forward: num(f.forward) ?? 0,
        left: num(f.left) ?? 0,
        collides: f.collides !== false,
        ...(typeof f.color === "string" && /^#[0-9a-f]{3,8}$/i.test(f.color)
          ? { color: f.color }
          : {}),
      },
    ];
  });
}
