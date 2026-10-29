import { describe, expect, it } from "vitest";
import {
  TEAM_ROBOT,
  TEAM_ROBOT_IMAGE,
  isTeamRobot,
  robotImageSrc,
  teamRobotImage,
} from "../src/lib/auto/teamRobot";

const svgOf = (url: string) =>
  decodeURIComponent(url.replace("data:image/svg+xml;charset=utf-8,", ""));

describe("our robot", () => {
  it("is a drive base centred on the wheelbase, plus the poker as a feature that collides", () => {
    // Body front 8.28 in ahead of the centre; poker tip 9.78 ahead.
    expect(TEAM_ROBOT.rLength / 2).toBeCloseTo(8.28, 2);
    const [poker] = TEAM_ROBOT.features!;
    expect(poker.forward + poker.length / 2).toBeCloseTo(9.78, 2);
    expect(poker.forward - poker.length / 2).toBeCloseTo(8.28, 2);
    expect(poker.collides).toBe(true);
    expect(isTeamRobot(TEAM_ROBOT)).toBe(true);
    expect(isTeamRobot({ ...TEAM_ROBOT, features: [] })).toBe(false);
  });
});

describe("our chassis, drawn from its box", () => {
  it("fills the box it is given", () => {
    const svg = svgOf(teamRobotImage(TEAM_ROBOT));
    expect(svg).toContain('viewBox="0 0 16.56 16"');
    for (const part of ["#e8743b", "#7fb3ff", "#a9cbe6"])
      expect(svg, part).toContain(part); // turret, Limelight, ramp
    expect(svg, "the poker is a feature, drawn by the field").not.toContain(
      "#f2c94c",
    );
  });

  it("redraws for a new size", () => {
    const svg = svgOf(teamRobotImage({ rLength: 20, rWidth: 18, rForward: 0 }));
    expect(svg).toContain('viewBox="0 0 20 18"');
    expect(svg).not.toBe(svgOf(teamRobotImage(TEAM_ROBOT)));
  });

  it("leaves out a part that no longer fits rather than drawing it outside the box", () => {
    const svg = svgOf(teamRobotImage({ rLength: 8, rWidth: 8, rForward: 0 }));
    expect(svg).not.toContain("#e8743b");
  });

  it("is what the default image means; any other picture is used as chosen", () => {
    expect(robotImageSrc({ ...TEAM_ROBOT })).toMatch(/^data:image\/svg/);
    expect(
      robotImageSrc({ ...TEAM_ROBOT, robotImage: TEAM_ROBOT_IMAGE }),
    ).toMatch(/^data:image\/svg/);
    expect(
      robotImageSrc({ ...TEAM_ROBOT, robotImage: "/MecanumDuck.png" }),
    ).toBe("/MecanumDuck.png");
  });
});
