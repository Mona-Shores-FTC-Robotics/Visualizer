import { describe, expect, it } from "vitest";
import {
  TEAM_ROBOT_BOX,
  TEAM_ROBOT_IMAGE,
  robotImageSrc,
  teamRobotImage,
} from "../src/lib/auto/teamRobot";

const svgOf = (url: string) =>
  decodeURIComponent(url.replace("data:image/svg+xml;charset=utf-8,", ""));

describe("our robot, drawn from its box", () => {
  it("fills the box it is given", () => {
    const svg = svgOf(teamRobotImage(TEAM_ROBOT_BOX));
    expect(svg).toContain('viewBox="0 0 17.5 16"');
    for (const part of ["#e8743b", "#7fb3ff", "#f2c94c", "#a9cbe6"])
      expect(svg, part).toContain(part); // turret, Limelight, poker, ramp
  });

  it("redraws for a new size", () => {
    const svg = svgOf(teamRobotImage({ rLength: 20, rWidth: 18, rForward: 0 }));
    expect(svg).toContain('viewBox="0 0 20 18"');
    expect(svg).not.toBe(svgOf(teamRobotImage(TEAM_ROBOT_BOX)));
  });

  it("leaves out a part that no longer fits rather than drawing it outside the box", () => {
    const svg = svgOf(teamRobotImage({ rLength: 8, rWidth: 8, rForward: 0 }));
    expect(svg).not.toContain("#e8743b");
  });

  it("is what the default image means; any other picture is used as chosen", () => {
    expect(robotImageSrc({ ...TEAM_ROBOT_BOX })).toMatch(/^data:image\/svg/);
    expect(
      robotImageSrc({ ...TEAM_ROBOT_BOX, robotImage: TEAM_ROBOT_IMAGE }),
    ).toMatch(/^data:image\/svg/);
    expect(
      robotImageSrc({ ...TEAM_ROBOT_BOX, robotImage: "/MecanumDuck.png" }),
    ).toBe("/MecanumDuck.png");
  });
});
