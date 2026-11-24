
import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Fittings = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];

const offset = ([x, y]: Point, dx: number, dy: number): Point => [x + dx, y + dy];
const between = ([ax, ay]: Point, [bx, by]: Point): Point => [(ax + bx) / 2, (ay + by) / 2];

function body(head: Point, shoulder: Point, hip: Point, nearArm: Limb, farArm: Limb,
  nearLeg: Limb, farLeg: Limb, nearToe: Point, farToe: Point): Point[] {
  return [head, shoulder, hip, ...nearArm, ...farArm, ...nearLeg, ...farLeg, nearToe, farToe];
}

function animation(frames: Point[][], props: Props = [], fittings: Fittings = [], ms = 1020): Illustration {
  return { frames, props, ms, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...fittings], reference: true };
}

const bench: Props = [[107, 111, 194, 111], [112, 111, 112, 157], [190, 111, 190, 157]];
const chairStandingFoot: [Point, Point] = [[172, 154], [128, 154]];
const chairKnees: [Point, Point] = [[172, 119], [128, 119]];

function seated(direction: "internal" | "external", mode: "test" | "exercise" | "lift") {
  const rotation = direction === "internal" ? 1 : -1;
  const extent = mode === "test" ? 34 : 40;

  function at(side: number, depth: number, lift = false): Point[] {
    const sign = side === 0 ? 1 : -1;
    const heading = rotation * sign * depth * Math.PI * extent / 180;
    const upperLift = lift ? 4 : 0;
    const ankles: [Point, Point] = [...chairStandingFoot];
    const pivot = chairKnees[side];
    const shin = lift || depth ? 32 : 35;
    ankles[side] = [pivot[0] + Math.sin(heading) * shin, pivot[1] + Math.cos(heading) * shin - upperLift];
    const pair: [Limb, Limb] = [[chairKnees[0], ankles[0]], [chairKnees[1], ankles[1]]];
    const nearToe: Point = [ankles[0][0] + 7, ankles[0][1] + 1];
    const farToe: Point = [ankles[1][0] - 7, ankles[1][1] + 1];
    return body([152, 46], [151, 63], [150, 107], [[173, 84], [168, 105]], [[128, 85], [131, 106]],
      ...pair, nearToe, farToe);
  }

  const ready = at(0, 0);
  const turned = at(0, 1, mode === "lift");
  return animation(mode === "test" ? [ready, at(0, .45), turned, turned, turned, ready, at(1, .45), at(1, 1), at(1, 1), ready]
    : mode === "lift" ? [ready, at(0, 0, true), turned, turned, at(0, 0, true)] : [ready, at(0, .44), turned, turned, at(0, .44)],
    bench, [], mode === "test" ? 1010 : 950);
}

function seatedBand(): Illustration {
  function at(amount: number): Point[] {
    const nearKnee: Point = [172 + 19 * amount, 119 + 1 * amount];
    const farKnee: Point = [128 - 19 * amount, 119 + 1 * amount];
    const [nearHeel, farHeel] = chairStandingFoot;
    const hips: Point = [150, 107];
    const posture = body([152, 46], [151, 62], hips, [[169, 84], [166, 108]], [[130, 84], [134, 107]],
      [nearKnee, nearHeel], [farKnee, farHeel], [181, 155], [120, 155]);
    const strap = (knee: Point): Point => offset(knee, (hips[0] - knee[0]) * .25, -4);
    return [...posture, strap(nearKnee), strap(farKnee)];
  }
  return animation([at(0), at(.5), at(1), at(1), at(.5)], bench, [["knee-band", 13, 14]], 880);
}

function clam(banded: boolean) {
  const heel: Point = [181, 154], hip: Point = [136, 146];
  const lowerKnee: Point = [171, 139];

  function at(amount: number): Point[] {
    const upperKnee: Point = [171 - 3 * amount, 135 - 25 * amount];
    const frame = body([68, 144], [94, 145], hip, [[108, 139], [113, 154]], [[75, 153], [55, 154]],
      [upperKnee, heel], [lowerKnee, heel], [193, 154], [192, 155]);
    const strap = (knee: Point): Point => [knee[0] + (hip[0] - knee[0]) * .26, knee[1] + (hip[1] - knee[1]) * .26];
    return banded ? [...frame, strap(upperKnee), strap(lowerKnee)] : frame;
  }

  return animation([at(0), at(.55), at(1), at(1), at(.6)], [], banded ? [["knee-band", 13, 14]] : [], 920);
}

function lyingInternalBand(): Illustration {
  const mat: Props = [[101, 33, 213, 33], [101, 33, 101, 158], [213, 33, 213, 158], [101, 158, 213, 158],
    [83, 133, 83, 149], [76, 143, 94, 143]];
  const nearKnee: Point = [173, 122], otherKnee: Point = [130, 121];
  const pivot: Point = [83, 142];
  function at(amount: number) {
    const shin = 30;
    const angle = amount * 36 * Math.PI / 180;
    const workingAnkle: Point = [nearKnee[0] + Math.sin(angle) * shin, nearKnee[1] + Math.cos(angle) * shin - 2];
    const stableAnkle: Point = [129, 148];
    const foot = offset(workingAnkle, amount * 4, 7 - amount);
    const frame = body([150, 47], [150, 67], [150, 106], [[179, 87], [177, 113]], [[122, 86], [124, 110]],
      [nearKnee, workingAnkle], [otherKnee, stableAnkle], foot, [125, 155]);
    return [...frame, between(nearKnee, workingAnkle)];
  }

  const angle = -65 * Math.PI / 180;
  const onMat = ([px, py]: Point): Point => {
    const x = px - 150, y = py - 90;
    return [145 + x * Math.cos(angle) - y * Math.sin(angle), 85 + x * Math.sin(angle) + y * Math.cos(angle)];
  };
  const frames = [at(0), at(.5), at(1), at(1), at(.5)].map((frame) => frame.map(onMat));
  const supplies = mat.map(([x, y, endX, endY]): Props[number] => [...onMat([x, y]), ...onMat([endX, endY])]);
  return { ...animation(frames, supplies, [["band", 13, ...onMat(pivot)], ["pad", 13, 0, 0]], 930), topView: true };
}

function supportedLegArc(): Illustration {
  function at(mode: number): Point[] {
    const along = Math.abs(mode);
    const shoulder: Point = [150 - 5 * mode, 95 + 2 * along];
    const hip: Point = [149 + mode * 4, 148];
    const nearKnee: Point = [159 + mode * 30, 105 + along * 8];
    const farKnee: Point = [144 + mode * 25, 109 + along * 10];
    const nearHeel: Point = [166 + mode * 42, 124 + along * 11];
    const farHeel: Point = [153 + mode * 39, 126 + along * 11];
    return body(offset(shoulder, 3, -14), shoulder, hip, [[176, 124], [196, 154]], [[125, 123], [104, 154]],
      [nearKnee, nearHeel], [farKnee, farHeel], offset(nearHeel, 7 + mode * 3, 0), offset(farHeel, 7 + mode * 3, 1));
  }
  return animation([at(0), at(.5), at(1), at(.5), at(0), at(-.5), at(-1), at(-.5)], [], [], 740);
}

const bandClam = clam(true);
export const hipRotationIllustrations: Record<string, Illustration> = {
  "0982": bandClam,
  "3023": lyingInternalBand(),
  "0995": seatedBand(),
  "6787": seated("external", "test"),
  "6788": seated("internal", "test"),
  "2771": seated("external", "exercise"),
  "2772": seated("internal", "exercise"),
  "6749": seated("external", "lift"),
  "2845": supportedLegArc(),
  "2150": bandClam,
  "2461": clam(false),
};