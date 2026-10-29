import type { RobotConfig } from "../../types";

/**
 * Mona Shores' robot (20245 and 19429 are the same), the box a new project starts with: 17.5 in
 * from its back plate to the tip of the FLOWER poker, 16 in wide, and the box's middle 1.03 in
 * ahead of the drive base's centre (the back plate is 7.72 in behind it). Upstream's defaults
 * stay as they are; the fork applies this on top.
 */
export const TEAM_ROBOT_BOX: Pick<
  RobotConfig,
  "rLength" | "rWidth" | "rForward"
> = {
  rLength: 17.5,
  rWidth: 16,
  rForward: 1.03,
};

/** The "Our robot" image: drawn from the box's numbers (`teamRobotImage`), not a fixed picture. */
export const TEAM_ROBOT_IMAGE = "/robot.png";

/** The image to draw for `settings`: our robot redrawn for its box, or the chosen picture. */
export function robotImageSrc(
  settings: { robotImage?: string } & Pick<RobotConfig, "rLength" | "rWidth"> &
    Partial<Pick<RobotConfig, "rForward">>,
): string {
  const image = settings.robotImage || TEAM_ROBOT_IMAGE;
  return image === TEAM_ROBOT_IMAGE ? teamRobotImage(settings) : image;
}

/** Inches the FLOWER poker sticks out of the front of the body. */
const POKER_OUT = 1.5;

/**
 * A top view of our robot filling a `rLength` x `rWidth` box, front to the right (the field draws
 * the image facing right), as an SVG data URL. The parts the team measured sit where they are on
 * the robot, from the drive base's centre, which is `rForward` behind the box's middle: the turret
 * 3.33 in behind and 1.87 in right (TurretSubsystem), the Limelight 4.0 in ahead on the centre
 * line (CameraMount). The rest follows the box: wheels at the corners, intake across the front,
 * the poker out of its middle. So a new Length, Width or "Box ahead of centre" redraws the robot
 * to fit, and a part that would land outside the box is left out rather than drawn wrong.
 */
export function teamRobotImage(
  robot: Pick<RobotConfig, "rLength" | "rWidth"> &
    Partial<Pick<RobotConfig, "rForward">>,
): string {
  const L = Math.max(4, robot.rLength);
  const W = Math.max(4, robot.rWidth);
  const back = (robot.rForward ?? 0) - L / 2; // drive-base frame: +fwd ahead, +right to its right
  const poker = back + L;
  const front = poker - Math.min(POKER_OUT, L / 4);
  const half = W / 2;
  // SVG units are inches, origin at the box's back-left corner.
  const X = (fwd: number) => r(fwd - back);
  const Y = (right: number) => r(right + half);
  const fits = (fwd: number, right: number, pad = 0) =>
    fwd - pad >= back && fwd + pad <= front && Math.abs(right) + pad <= half;
  const parts: string[] = [];
  const add = (s: string) => parts.push(s);

  // Body: a dark plate with a light rim, so it reads on red, blue and grey. The side plates stand
  // 0.3 in inside the box on each side.
  const sideIn = Math.min(0.3, half / 4);
  add(
    `<rect x="${X(back + 0.15)}" y="${Y(-half + sideIn)}" width="${r(front - back - 0.3)}" height="${r(W - 2 * sideIn)}" rx="0.7" fill="#2b2f36" stroke="#e8eaed" stroke-width="0.3"/>`,
  );

  // Mecanum wheels at the corners: 4.1 in long, 1.5 wide, outer faces 1.1 in inside the box.
  const wheelLen = Math.min(4.1, (front - back) / 2.5);
  const wheelW = Math.min(1.5, half / 3);
  const wheelSide = half - 1.1 - wheelW / 2;
  const wheelFwd = [back + 0.06 + wheelLen / 2, front - 0.58 - wheelLen / 2];
  wheelFwd.forEach((fwd, i) =>
    [-wheelSide, wheelSide].forEach((right, j) => {
      const x = X(fwd - wheelLen / 2);
      const y = Y(right - wheelW / 2);
      const box = `x="${x}" y="${y}" width="${r(wheelLen)}" height="${r(wheelW)}" rx="0.25"`;
      const id = `w${i}${j}`;
      add(`<clipPath id="${id}"><rect ${box}/></clipPath>`);
      add(`<rect ${box} fill="#111316"/>`);
      // Rollers at 45°: an X seen from above.
      const sign = (i === 1) === right < 0 ? 1 : -1;
      const y0 = r(y + 0.12);
      const y1 = r(y + wheelW - 0.12);
      const dx = ((wheelW - 0.24) / 2) * sign;
      const rollers = [];
      for (let k = -4; k <= 4; k++) {
        const ox = x + wheelLen / 2 + k * 0.55;
        rollers.push(
          `<line x1="${r(ox - dx)}" y1="${y0}" x2="${r(ox + dx)}" y2="${y1}"/>`,
        );
      }
      add(
        `<g clip-path="url(#${id})" stroke="#9aa0a6" stroke-width="0.12" stroke-linecap="round">${rollers.join("")}</g>`,
      );
      add(`<rect ${box} fill="none" stroke="#9aa0a6" stroke-width="0.08"/>`);
    }),
  );

  // FLOWER poker: out of the middle of the front.
  if (poker > front)
    add(
      `<rect x="${X(front - 0.35)}" y="${Y(-0.75)}" width="${r(poker - front + 0.3)}" height="1.5" rx="0.3" fill="#f2c94c" stroke="#1d1f23" stroke-width="0.1"/>`,
    );

  // Frame channels, front to back, just inside the wheels.
  const channel = wheelSide - wheelW / 2 - 0.7;
  if (channel > 0.5)
    for (const right of [-channel, channel])
      add(
        `<rect x="${X(back + 0.45)}" y="${Y(right - 0.45)}" width="${r(front - back - 0.9)}" height="0.9" rx="0.15" fill="#4b525c" stroke="#7d848e" stroke-width="0.06"/>`,
      );

  // Intake: seven gecko wheels on a shaft across the front, about 7.1 in wide and centred.
  const geckos = Math.max(1, Math.min(7, Math.floor((2 * channel) / 1.08)));
  const geckoHalf = ((geckos - 1) * 1.08) / 2;
  const shaft = front - 1.3;
  add(
    `<line x1="${X(shaft)}" y1="${Y(-geckoHalf - 0.575)}" x2="${X(shaft)}" y2="${Y(geckoHalf + 0.575)}" stroke="#9aa0a6" stroke-width="0.25" stroke-linecap="round"/>`,
  );
  for (let k = 0; k < geckos; k++)
    add(
      `<rect x="${X(shaft - 0.75)}" y="${Y(-geckoHalf + k * 1.08 - 0.375)}" width="1.5" height="0.75" rx="0.3" fill="#4a5059" stroke="#c9cdd2" stroke-width="0.08"/>`,
    );

  // FLOWER ramp: the light-blue panel across the middle, its front edge at the Limelight's back.
  if (fits(0.35, 3.75) && fits(3.35, 3.75))
    add(
      `<rect x="${X(0.35)}" y="${Y(-3.75)}" width="3" height="7.5" rx="0.4" fill="#a9cbe6" stroke="#5b7f9e" stroke-width="0.1"/>`,
    );

  // Turret: its ring at the launcher's axis, the barrel pointing forward (locked at home).
  if (fits(-3.33, 1.87, 2.9))
    add(
      `<circle cx="${X(-3.33)}" cy="${Y(1.87)}" r="2.9" fill="#e8743b" stroke="#1d1f23" stroke-width="0.15"/>` +
        `<rect x="${X(-3.33)}" y="${Y(1.87 - 0.45)}" width="3.4" height="0.9" rx="0.2" fill="#1d1f23"/>` +
        `<circle cx="${X(-3.33)}" cy="${Y(1.87)}" r="0.45" fill="#1d1f23"/>`,
    );

  // Limelight: facing forward, pitched up at the HIVE.
  if (fits(4.0, 1.1, 0.65))
    add(
      `<rect x="${X(3.35)}" y="${Y(-1.1)}" width="1.3" height="2.2" rx="0.2" fill="#15171a" stroke="#6b7280" stroke-width="0.08"/>` +
        `<circle cx="${X(4.35)}" cy="${Y(0)}" r="0.4" fill="#3a4250" stroke="#9aa0a6" stroke-width="0.08"/>` +
        `<circle cx="${X(4.35)}" cy="${Y(0)}" r="0.15" fill="#7fb3ff"/>` +
        `<circle cx="${X(4.35)}" cy="${Y(-0.75)}" r="0.12" fill="#2f9e44"/>` +
        `<circle cx="${X(4.35)}" cy="${Y(0.75)}" r="0.12" fill="#2f9e44"/>`,
    );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${r(L * 40)}" height="${r(W * 40)}" viewBox="0 0 ${r(L)} ${r(W)}" preserveAspectRatio="none">${parts.join("")}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const r = (v: number) => Math.round(v * 1000) / 1000;
