import illustrations from "./workout-motions.json" with { type: "json" };
import { parsePlanMove } from "./move-name";
import { catalogueIllustrations } from "./catalogue-illustrations";
import { mobilityIllustrations } from "./mobility-illustrations";
import { lungeIllustrations } from "./lunge-illustrations";
import { pullingIllustrations } from "./pulling-illustrations";
import { plankIllustrations } from "./plank-illustrations";
import { pushupIllustrations } from "./pushup-illustrations";
import { wristNeckIllustrations } from "./wrist-neck-illustrations";
import { wristMobilityIllustrations } from "./wrist-mobility-illustrations";
import { upperBodyIllustrations } from "./upper-body-illustrations";
import { conditioningIllustrations } from "./conditioning-illustrations";
import { hingeIllustrations } from "./hinge-illustrations";
import { pulloverIllustrations } from "./pullover-illustrations";
import { rowingIllustrations } from "./rowing-illustrations";
import { sideBendIllustrations } from "./side-bend-illustrations";
import { coreIllustrations } from "./core-illustrations";
import { hipBridgeIllustrations } from "./hip-bridge-illustrations";
import { flyIllustrations } from "./fly-illustrations";
import { legRaiseIllustrations } from "./leg-raise-illustrations";
import { documentedMachineIllustrations } from "./documented-machine-illustrations";
import { landmineIllustrations } from "./landmine-illustrations";
import { posteriorStretchIllustrations } from "./posterior-stretch-illustrations";
import { medicineBallIllustrations } from "./medicine-ball-illustrations";
import { shoulderMobilityIllustrations } from "./shoulder-mobility-illustrations";
import { jumpIllustrations } from "./jump-illustrations";
import { rotationIllustrations } from "./rotation-illustrations";
import { sledIllustrations } from "./sled-illustrations";
import { upperStretchIllustrations } from "./upper-stretch-illustrations";
import { mobilityReleaseIllustrations } from "./mobility-release-illustrations";
import { agilityIllustrations } from "./agility-illustrations";
import { legMachineIllustrations } from "./leg-machine-illustrations";
import { lowerBodyIllustrations } from "./lower-body-illustrations";
import { armIllustrations } from "./arm-illustrations";
import { tricepsIllustrations } from "./triceps-illustrations";
import { dipIllustrations } from "./dip-illustrations";
import { reviewedCorrectionIllustrations } from "./reviewed-corrections-illustrations";
import { floorControlIllustrations } from "./floor-control-illustrations";
import { lowerBodyEquipmentIllustrations } from "./lower-body-equipment-illustrations";
import { verticalPullIllustrations } from "./vertical-pull-illustrations";
import { ankleFootIllustrations } from "./ankle-foot-illustrations";
import { shoulderRaiseIllustrations } from "./shoulder-raise-illustrations";
import { floorLocomotionIllustrations } from "./floor-locomotion-illustrations";
import { neckControlIllustrations } from "./neck-control-illustrations";
import { aerobicIllustrations } from "./aerobic-illustrations";
import { freeWeightCleanIllustrations } from "./free-weight-clean-illustrations";
import { lowerLimbStretchIllustrations } from "./lower-limb-stretch-illustrations";
import { olympicBarbellIllustrations } from "./olympic-barbell-illustrations";
import { boxingIllustrations } from "./boxing-illustrations";
import { strongmanIllustrations } from "./strongman-illustrations";
import { pressIllustrations } from "./press-illustrations";
import { squatLungeVariantsIllustrations } from "./squat-lunge-variants-illustrations";
import { yogaIllustrations } from "./yoga-illustrations";
import { shoulderAccessoryIllustrations } from "./shoulder-accessory-illustrations";
import { stepLungeIllustrations } from "./step-lunge-illustrations";
import { torsoTwistIllustrations } from "./torso-twist-illustrations";
import { upperBodyStretchIllustrations } from "./upper-body-stretch-illustrations";
import { gripIllustrations } from "./grip-illustrations";
import { hipRotationIllustrations } from "./hip-rotation-illustrations";
import { kettlebellDynamicsIllustrations } from "./kettlebell-dynamics-illustrations";
import { lowerBodyResistanceIllustrations } from "./lower-body-resistance-illustrations";
import { legacyMobilityCorrections } from "./legacy-mobility-corrections";
import { legacyArmCorrectionIllustrations } from "./legacy-arm-corrections-illustrations";
import { floorCoreVariantIllustrations } from "./floor-core-variants-illustrations";
import { matYogaIllustrations } from "./mat-yoga-illustrations";
import { compoundUpperIllustrations } from "./compound-upper-illustrations";
import { upperFormCheckIllustrations } from "./upper-form-checks-illustrations";
import { mobilityDeviceIllustrations } from "./mobility-device-illustrations";
import { reviewedLowerBodyIllustrations } from "./reviewed-lower-body-illustrations";
import { pilatesMatIllustrations } from "./pilates-mat-illustrations";
import { trunkLeverIllustrations } from "./trunk-lever-illustrations";
import { trunkMobilityIllustrations } from "./trunk-mobility-illustrations";
import { upperPullMobilityIllustrations } from "./upper-pull-mobility-illustrations";
import { ropeBarIllustrations } from "./rope-bar-illustrations";
import { balanceMobilityIllustrations } from "./balance-mobility-illustrations";
import { kneeMobilityIllustrations } from "./knee-mobility-illustrations";
import { bodyweightCardioIllustrations } from "./bodyweight-cardio-illustrations";
import { sportsConditioningIllustrations } from "./sports-conditioning-illustrations";
import { lowerFormIllustrations } from "./lower-form-illustrations";
import { lowerMovementSequenceIllustrations } from "./lower-movement-sequence-illustrations";
import { lowerHipConditioningIllustrations } from "./lower-hip-conditioning-illustrations";
import { postureFormIllustrations } from "./posture-form-illustrations";
import { upperArmSpecialtyIllustrations } from "./upper-arm-specialty-illustrations";
import { reformerMatIllustrations } from "./reformer-mat-illustrations";
import { towelAndShoulderIllustrations } from "./towel-and-shoulder-illustrations";
import { legacyLowerMotionIllustrations } from "./legacy-lower-motion-illustrations";
import { reviewedPressAndExtensionIllustrations } from "./reviewed-press-and-extension-illustrations";
import { legacySmithUpperCorrections } from "./legacy-smith-upper-corrections";
import { reviewedFreeweightExtensions } from "./reviewed-freeweight-extensions";
import { legacySportMotionCorrections } from "./legacy-sport-motion-corrections";
import { elasticWarmupIllustrations } from "./elastic-warmup-illustrations";
import { reviewedCurlsAndSkullcrushers } from "./reviewed-curls-and-skullcrushers";
import { lowerLungeWarmupsIllustrations } from "./lower-lunge-warmups-illustrations";
import { alternatingConditioningIllustrations } from "./alternating-conditioning-illustrations";
import { distalMobilityIllustrations } from "./distal-mobility-illustrations";
import { trunkControlIllustrations } from "./trunk-control-illustrations";
import { neckSourceIllustrations } from "./neck-source-illustrations";
import { arcIllustrations } from "./arc-illustrations";
import { supportSkillIllustrations } from "./support-skill-illustrations";
import { dailyMobilityIllustrations } from "./daily-mobility-illustrations";
import { verifiedLowerEdgeIllustrations } from "./verified-lower-edge-illustrations";
import { suspensionAttachmentIllustrations } from "./suspension-attachment-illustrations";
import { specializedLowerMachineIllustrations } from "./specialized-lower-machine-illustrations";
import { originalDrillCorrections } from "./original-drill-corrections";
import { verifiedMobilityIllustrations } from "./verified-mobility-illustrations";
import { preciseUpperIllustrations } from "./precise-upper-illustrations";
import { sportSpecificCorrections } from "./sport-specific-corrections";
import { hangboardIllustrations } from "./hangboard-illustrations";
import { assessmentAndReleaseIllustrations } from "./assessment-and-release-illustrations";
import { cableRowSourceCorrections } from "./cable-row-source-corrections";
import { legacyLowerSourceIllustrations } from "./legacy-lower-source-illustrations";
import { cardioSourceCorrections } from "./cardio-source-corrections";
import { reviewedDumbbellPressIllustrations } from "./reviewed-dumbbell-press-illustrations";
import { reviewedBarAndBellIllustrations } from "./reviewed-bar-and-bell-illustrations";
import { neurodynamicIllustrations } from "./neurodynamic-illustrations";
import { reviewedDumbbellVariantIllustrations } from "./reviewed-dumbbell-variants-illustrations";
import { cableCoreSourceCorrections } from "./cable-core-source-corrections";
import { floorKneeControlIllustrations } from "./floor-knee-control-illustrations";
import { verifiedSpecialUpperIllustrations } from "./verified-special-upper-illustrations";
import { cableChestSourceCorrections } from "./cable-chest-source-corrections";
import { verifiedDumbbellCombinations } from "./verified-dumbbell-combinations";
import { legacyCoreSourceIllustrations } from "./legacy-core-source-illustrations";
import { assistedEquipmentIllustrations } from "./assisted-equipment-illustrations";
import { cableTricepsSourceCorrections } from "./cable-triceps-source-corrections";
import { cableShoulderSourceCorrections } from "./cable-shoulder-source-corrections";
import { verifiedDumbbellGripIllustrations } from "./verified-dumbbell-grip-illustrations";
import { cablelessAccessoryIllustrations } from "./cableless-accessory-illustrations";
import { techniqueReviewIllustrations } from "./technique-review-illustrations";
import { cableCurlSourceCorrections } from "./cable-curl-source-corrections";
import { cableSpecialSourceCorrections } from "./cable-special-source-corrections";
import { verifiedDumbbellFinalIllustrations } from "./verified-dumbbell-final-illustrations";
import { legacyCalisthenicSourceIllustrations } from "./legacy-calisthenic-source-illustrations";
import { reviewedUpperLegacyIllustrations } from "./reviewed-upper-legacy-illustrations";
import { leverCoreIllustrations } from "./lever-core-illustrations";
import { floorLegCoreIllustrations } from "./floor-leg-core-illustrations";
import type { CatalogEntry } from "./open-gym";
import poseSources from "./workout-guide-motions.json" with { type: "json" };
import flowSources from "./flow-motion-equivalents.json" with { type: "json" };

export type Point = [number, number];
export type Illustration = {
  frames: Point[][];
  partnerFrames?: Point[][];
  partnerSpine?: number[];
  spine?: number[];
  shoulders?: [number, number];
  props?: [number, number, number, number][];
  dynamic?: [string, number, number, number?][];
  topView?: boolean;
  cutOnLoop?: boolean;
  formCheckFrom?: number;
  reference?: boolean;
  ms?: number;
  duration?: number;
};

export const slowFrameMs = (ms: number) => Math.round(ms * 2);

const key = (name: string) => parsePlanMove(name).name.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
const byName = new Map(Object.entries(illustrations).map(([name, item]) => [key(name), item as Illustration]));
export function motionFor(...names: (string | undefined)[]) {
  for (const name of names) {
    const motion = name && byName.get(key(name));
    if (motion) return motion;
  }
}

const namedFlow: Record<string, string> = {
  "上斜俯卧哑铃展臂": "0326",
  "站姿哑铃推肩": "0426",
  "后脚抬高分腿蹲": "0410",
  "站姿绳索左右转体": "0243",
  "俯卧 T 字举臂": "3542",
};
const namedId = new Map(Object.entries(namedFlow).map(([name, id]) => [key(name), id]));

const linkedMotion: Record<string, string> = {
  "8299": "半跪绳索划船", "11253": "跪姿绳索高位下拉",
  "3863": "后脚抬高分腿跳", "2906": "后退拉雪橇", "4029": "站姿弹力带单腿内收",
  "2473": "靠凳单腿臀桥", "7743": "半跪绳索面拉", "3525": "半跪单臂地雷杆推举",
  "5066": "哑铃深蹲接推肩", "0564": "侧向跳上低箱", "5473": "中立握引体向上",
};

const poseMotions: Record<string, string> = poseSources;
const flowMotions: Record<string, string> = flowSources;
const exactIllustrations = {
  ...lowerBodyIllustrations,
  ...legMachineIllustrations,
  ...agilityIllustrations,
  ...mobilityReleaseIllustrations,
  ...upperStretchIllustrations,
  ...sledIllustrations,
  ...rotationIllustrations,
  ...jumpIllustrations,
  ...shoulderMobilityIllustrations,
  ...medicineBallIllustrations,
  ...posteriorStretchIllustrations,
  ...landmineIllustrations,
  ...documentedMachineIllustrations,
  ...legRaiseIllustrations,
  ...flyIllustrations,
  ...hipBridgeIllustrations,
  ...coreIllustrations,
  ...sideBendIllustrations,
  ...rowingIllustrations,
  ...pulloverIllustrations,
  ...hingeIllustrations,
  ...conditioningIllustrations,
  ...upperBodyIllustrations,
  ...wristNeckIllustrations,
  ...wristMobilityIllustrations,
  ...pushupIllustrations,
  ...plankIllustrations,
  ...lungeIllustrations,
  ...pullingIllustrations,
  ...mobilityIllustrations,
  ...catalogueIllustrations,
  ...armIllustrations,
  ...tricepsIllustrations,
  ...floorControlIllustrations,
  ...lowerBodyEquipmentIllustrations,
  ...verticalPullIllustrations,
  ...ankleFootIllustrations,
  ...shoulderRaiseIllustrations,
  ...floorLocomotionIllustrations,
  ...neckControlIllustrations,
  ...aerobicIllustrations,
  ...freeWeightCleanIllustrations,
  ...lowerLimbStretchIllustrations,
  ...olympicBarbellIllustrations,
  ...boxingIllustrations,
  ...strongmanIllustrations,
  ...pressIllustrations,
  ...squatLungeVariantsIllustrations,
  ...yogaIllustrations,
  ...shoulderAccessoryIllustrations,
  ...stepLungeIllustrations,
  ...torsoTwistIllustrations,
  ...upperBodyStretchIllustrations,
  ...gripIllustrations,
  ...hipRotationIllustrations,
  ...kettlebellDynamicsIllustrations,
  ...lowerBodyResistanceIllustrations,
  ...legacyMobilityCorrections,
  ...legacyArmCorrectionIllustrations,
  ...floorCoreVariantIllustrations,
  ...matYogaIllustrations,
  ...compoundUpperIllustrations,
  ...upperFormCheckIllustrations,
  ...mobilityDeviceIllustrations,
  ...reviewedLowerBodyIllustrations,
  ...pilatesMatIllustrations,
  ...trunkLeverIllustrations,
  ...trunkMobilityIllustrations,
  ...upperPullMobilityIllustrations,
  ...ropeBarIllustrations,
  ...balanceMobilityIllustrations,
  ...kneeMobilityIllustrations,
  ...bodyweightCardioIllustrations,
  ...sportsConditioningIllustrations,
  ...lowerFormIllustrations,
  ...lowerMovementSequenceIllustrations,
  ...lowerHipConditioningIllustrations,
  ...postureFormIllustrations,
  ...upperArmSpecialtyIllustrations,
  ...reformerMatIllustrations,
  ...towelAndShoulderIllustrations,
  ...legacyLowerMotionIllustrations,
  ...reviewedPressAndExtensionIllustrations,
  ...legacySmithUpperCorrections,
  ...reviewedFreeweightExtensions,
  ...legacySportMotionCorrections,
  ...elasticWarmupIllustrations,
  ...reviewedCurlsAndSkullcrushers,
  ...lowerLungeWarmupsIllustrations,
  ...alternatingConditioningIllustrations,
  ...distalMobilityIllustrations,
  ...trunkControlIllustrations,
  ...neckSourceIllustrations,
  ...arcIllustrations,
  ...supportSkillIllustrations,
  ...dailyMobilityIllustrations,
  ...verifiedLowerEdgeIllustrations,
  ...suspensionAttachmentIllustrations,
  ...specializedLowerMachineIllustrations,
  ...originalDrillCorrections,
  ...verifiedMobilityIllustrations,
  ...preciseUpperIllustrations,
  ...sportSpecificCorrections,
  ...hangboardIllustrations,
  ...assessmentAndReleaseIllustrations,
  ...cableRowSourceCorrections,
  ...legacyLowerSourceIllustrations,
  ...cardioSourceCorrections,
  ...reviewedDumbbellPressIllustrations,
  ...reviewedBarAndBellIllustrations,
  ...neurodynamicIllustrations,
  ...reviewedDumbbellVariantIllustrations,
  ...cableCoreSourceCorrections,
  ...floorKneeControlIllustrations,
  ...verifiedSpecialUpperIllustrations,
  ...cableChestSourceCorrections,
  ...verifiedDumbbellCombinations,
  ...legacyCoreSourceIllustrations,
  ...assistedEquipmentIllustrations,
  ...cableTricepsSourceCorrections,
  ...cableShoulderSourceCorrections,
  ...verifiedDumbbellGripIllustrations,
  ...cablelessAccessoryIllustrations,
  ...techniqueReviewIllustrations,
  ...cableCurlSourceCorrections,
  ...cableSpecialSourceCorrections,
  ...verifiedDumbbellFinalIllustrations,
  ...legacyCalisthenicSourceIllustrations,
  ...reviewedUpperLegacyIllustrations,
  ...leverCoreIllustrations,
  ...floorLegCoreIllustrations,
  ...dipIllustrations,
  ...reviewedCorrectionIllustrations,
};


export function catalogueMotion(item: Pick<CatalogEntry, "id" | "name" | "animation">) {
  const { id, name, animation } = item;
  const linkedName = id === "1671" ? name : id === "11253" ? undefined : linkedMotion[id];
  const illustration = exactIllustrations[id] ?? motionFor(linkedName);
  // Despite the atlas name, 1015's frames show the horizontal press from a lateral anchor.
  const flow = illustration ? undefined : id === "0979" ? "1015" : animation ? id : flowMotions[id];
  return { id: flow, illustration, poseSlug: illustration ? undefined : poseMotions[id] };
}

export function exerciseMotion(name: string, base: string, original?: string, id?: string, animated = false) {
  const illustration = motionFor(original, name, base, id ? linkedMotion[id] : undefined);
  const borrowing = namedId.get(key(original ?? name)) ?? namedId.get(key(base));
  if (borrowing) return { id: borrowing, illustration };
  // Keep explicit plan movements distinct from catalogue rows with similar names.
  if (id === "0979") return { id: "1015", illustration };
  if (illustration && (id === "1671" || id === "0176")) return { id: undefined, illustration };
  return { id: animated ? id : undefined, illustration };
}
