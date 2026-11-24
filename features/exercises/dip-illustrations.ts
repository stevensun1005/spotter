import type { Illustration, Point } from "./motion-data";

type MediaProps = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type DipSupport = "high-bars" | "wide-bars" | "chairs" | "straps" | "kneeband" | "footband" | "assisted-machine";
type Disposition = "upright" | "chest" | "planche";

function elevatedDip(support: DipSupport, disposition: Disposition, assistedFeet = false, belt = false, hold = false): Illustration {
  const wide = support === "wide-bars" || support === "chairs";
  const strapped = support === "straps";
  const lowHandles = assistedFeet || support === "chairs";
  const hand: Point = [162, lowHandles ? 108 : 101];
  const farHand: Point = [wide ? 124 : 143, hand[1] - 4];
  const machineAssisted = support === "assisted-machine";
  const feetBand = support === "footband";
  const kneeBand = support === "kneeband";
  const supportingBand = feetBand || kneeBand;
  const pitched = disposition === "chest";
  const planche = disposition === "planche";
  const standardBars: MediaProps = [
    [110, farHand[1], 192, farHand[1]], [117, farHand[1], 117, 159], [186, farHand[1], 186, 159],
    [147, hand[1], 208, hand[1]], [152, hand[1], 152, 159], [205, hand[1], 205, 159],
  ];
  const props: MediaProps = strapped
    ? [[112, 21, 205, 21]]
    : support === "chairs"
      ? [[98, 106, 136, 106], [99, 105, 99, 67], [104, 106, 104, 159], [131, 106, 131, 159],
        [150, 109, 190, 109], [188, 109, 188, 72], [154, 109, 154, 159], [184, 109, 184, 159]]
      : machineAssisted
        ? [[211, 44, 211, 158], [230, 44, 230, 158], [211, 44, 230, 44], [178, hand[1], 211, hand[1]],
          [155, hand[1], 211, hand[1]], [141, farHand[1], 211, farHand[1]], [184, 158, 237, 158]]
        : standardBars;
  const dynamic: Attachments = [];
  if (strapped) dynamic.push(["cable", 4, 170, 21], ["cable", 6, 147, 21]);
  if (supportingBand) dynamic.push(["band", 11, 4], ["band", 11, 6]);
  if (machineAssisted) dynamic.push(["pad", 11, 0, 4], ["line", 11, 12]);
  if (belt) dynamic.push(["pad", 2, 0, 4], ["line", 2, 11], ["plate", 11, 0, 0]);
  const render = (bottom: boolean): Point[] => {
    const shoulders: Point = planche ? [bottom ? 187 : 181, bottom ? 81 : 62]
      : pitched ? [bottom ? 186 : 171, bottom ? 82 : 59]
      : [bottom ? 177 : 160, bottom ? 81 : 56];
    const hip: Point = planche ? [bottom ? 137 : 135, bottom ? 102 : 79]
      : [pitched ? bottom ? 153 : 155 : bottom ? 169 : 154, bottom ? 125 : 101];
    const knee: Point = planche ? [112, bottom ? 108 : 86] : machineAssisted
      ? [151, bottom ? 140 : 125] : assistedFeet
        ? [pitched ? 142 : 158, bottom ? 140 : 132] : [kneeBand ? 156 : 154, bottom ? 142 : 127];
    const ankle: Point = planche ? [90, bottom ? 115 : 94] : machineAssisted
      ? [150, bottom ? 153 : 141] : assistedFeet
        ? [pitched ? 131 : 158, 154] : kneeBand
          ? [133, bottom ? 142 : 130] : [feetBand ? 157 : 144, bottom ? 150 : 138];
    const kneeFar: Point = [knee[0] - 8, knee[1] - 2];
    const ankleFar: Point = [ankle[0] - 8, ankle[1] - 1];
    const elbow: Point = bottom ? [155, hand[1] - 22] : [(shoulders[0] + hand[0]) / 2, (shoulders[1] + hand[1]) / 2];
    const farElbow: Point = bottom ? [wide ? 143 : 145, farHand[1] - 23] : [(shoulders[0] + farHand[0]) / 2, (shoulders[1] + farHand[1]) / 2];
    const marker: Point = machineAssisted ? [ankle[0], ankle[1] - 1] : supportingBand
      ? [feetBand ? ankle[0] - 4 : knee[0] - 4, (feetBand ? ankle[1] : knee[1]) + 3]
      : [hip[0] - 6, hip[1] + 22];
    return [[shoulders[0] + 5, shoulders[1] - 17], shoulders, hip, elbow, hand, farElbow, farHand,
      knee, ankle, kneeFar, ankleFar, marker, [213, marker[1] + 4]];
  };
  const ready = render(false), lowered = render(true);
  if (hold) {
    const settled = ready.map(([x, y], index): Point => index === 0 || index === 1 ? [x, y + 2] : [x, y]);
    return { frames: [ready, settled, settled], props, dynamic, ms: 1400, reference: true };
  }
  return { frames: [ready, lowered], props, dynamic, ms: 1000, reference: true };
}

type BenchSupport = "floor" | "chair" | "bench" | "second-bench" | "ball";
function benchDip(support: BenchSupport, load?: "dumbbell" | "plate", single = false): Illustration {
  const rear = support === "floor" ? 154 : support === "chair" ? 119 : 114;
  const fixedBench: MediaProps = [[79, rear + 3, 118, rear + 3], [83, rear + 4, 83, 159], [114, rear + 4, 114, 159]];
  const heelsRaised = support === "second-bench" || support === "ball";
  const ankle: Point = [203, heelsRaised ? 120 : 155];
  const ankleFar: Point = single ? [222, 133] : [198, ankle[1] - 1];
  const render = (low: boolean): Point[] => {
    const shoulder: Point = [123, rear - (low ? 18 : 43)];
    const hip: Point = support === "floor" ? [143, low ? 148 : 133] : [127, rear + (low ? 15 : -3)];
    const knee: Point = [171, heelsRaised ? Math.round((hip[1] + ankle[1]) / 2) : 129];
    return [[125, shoulder[1] - 17], shoulder, hip, low ? [100, rear - 15] : [119, rear - 23], [115, rear],
      low ? [92, rear - 13] : [113, rear - 21], [107, rear], knee, ankle, [166, single ? 134 : knee[1] + 2], ankleFar,
      [hip[0] + 18, hip[1] - 4]];
  };
  const props: MediaProps = support === "floor" ? [] : [...fixedBench];
  if (support === "chair") props.push([79, rear, 79, 72], [74, 76, 74, 159]);
  if (support === "second-bench") props.push([189, 123, 230, 123], [193, 125, 193, 159], [225, 125, 225, 159]);
  const dynamic: Attachments = [["foot", 8, ankle[0] + 7, ankle[1] + 2], ["foot", 10, ankleFar[0] + 7, ankleFar[1] + 2]];
  if (support === "ball") dynamic.push(["stability-ball", 8, 1, 21]);
  if (load) dynamic.push([load, 11, 0, -2]);
  return { frames: [render(false), render(true)], props, dynamic, ms: 1050, reference: true };
}

function leverDip(): Illustration {
  const body: Point[] = [[140, 47], [142, 67], [140, 116], [128, 81], [158, 92],
    [133, 84], [152, 93], [172, 119], [172, 156], [160, 118], [158, 156]];
  const rearPivot: Point = [99, 110];
  const base = [...body, rearPivot, [84, 114] as Point, [90, 114] as Point];
  const down = base.map((pt, i): Point => {
    switch (i) {
      case 3: return [147, 88];
      case 4: return [152, 116];
      case 5: return [138, 89];
      case 6: return [145, 113];
      case 12: return [84, 105];
      case 13: return [90, 107];
      default: return pt;
    }
  });
  return { frames: [base, down], props: [[93, 110, 104, 110], [99, 109, 99, 159], [71, 159, 197, 159],
    [119, 120, 159, 120], [124, 121, 124, 159], [149, 121, 149, 159], [158, 113, 172, 113], [185, 112, 185, 158]],
  dynamic: [["line", 4, 11], ["line", 6, 11], ["line", 11, 12], ["line", 11, 13],
    ["plate", 12, 0, 0], ["plate", 13, 0, 0], ["bar", 4, 6]], ms: 950, reference: true };
}

export const dipIllustrations: Readonly<Record<string, Illustration>> = {
  "1028": elevatedDip("assisted-machine", "upright"),
  "4205": elevatedDip("footband", "upright"),
  "4719": elevatedDip("kneeband", "upright"),
  "4352": benchDip("bench"),
  "5513": benchDip("ball"),
  "4360": benchDip("second-bench"),
  "1442": elevatedDip("high-bars", "chest", false, false, true),
  "3443": benchDip("chair"),
  "3387": elevatedDip("chairs", "upright"),
  "4728": benchDip("bench", "dumbbell"),
  "4729": benchDip("second-bench", "dumbbell"),
  "1871": leverDip(),
  "7415": elevatedDip("high-bars", "planche"),
  "4364": benchDip("floor", undefined, true),
  "1072": elevatedDip("straps", "chest"),
  "1093": elevatedDip("straps", "chest", true),
  "1095": elevatedDip("straps", "upright", true),
  "1103": elevatedDip("straps", "upright"),
  "8143": elevatedDip("high-bars", "upright"),
  "0830": benchDip("bench", "plate"),
  "1755": benchDip("bench", "plate"),
  "1767": elevatedDip("high-bars", "upright", false, true),
  "2363": elevatedDip("wide-bars", "chest"),
};
