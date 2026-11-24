export const compositionMeasurements = {
  fat: { name: "体脂率", unit: "%", min: 1, max: 75 },
  muscle: { name: "肌肉量", unit: "kg", min: 1, max: 200 },
  fatMass: { name: "体脂肪量", unit: "kg", min: 0, max: 350 },
  skeletalMuscle: { name: "骨骼肌量", unit: "kg", min: 1, max: 200 },
  fatFreeMass: { name: "去脂体重", unit: "kg", min: 1, max: 350 },
  bodyWater: { name: "体水分量", unit: "kg", min: 1, max: 350 },
  boneMass: { name: "骨量", unit: "kg", min: 0.1, max: 25 },
  proteinMass: { name: "身体蛋白质量", unit: "kg", min: 0.1, max: 150 },
  bmr: { name: "基础代谢（设备估算）", unit: "千卡/天", min: 100, max: 10000 },
  visceralFat: { name: "内脏脂肪等级", unit: "级", min: 0, max: 100 },
  subcutaneousFat: { name: "皮下脂肪率", unit: "%", min: 0, max: 75 },
  smi: { name: "骨骼肌指数", unit: "kg/m²", min: 0.1, max: 50 },
  metabolicAge: { name: "代谢年龄（设备估算）", unit: "岁", min: 1, max: 150 },
  waistHipRatio: { name: "腰臀比", unit: "", min: 0.2, max: 4 },
} as const;

export const circumferenceMeasurements = {
  waist: { name: "腰围", unit: "cm", min: 10, max: 400 },
  chest: { name: "胸围", unit: "cm", min: 10, max: 400 },
  hip: { name: "臀围", unit: "cm", min: 10, max: 400 },
  neck: { name: "颈围", unit: "cm", min: 5, max: 200 },
  shoulders: { name: "肩宽", unit: "cm", min: 10, max: 200 },
  arm: { name: "臂围", unit: "cm", min: 5, max: 150 },
  thigh: { name: "大腿围", unit: "cm", min: 5, max: 200 },
} as const;

const trackedMeasurements = { ...compositionMeasurements, ...circumferenceMeasurements };
export type BodyMeasurement = keyof typeof trackedMeasurements;
export const recordedMetrics = Object.keys(trackedMeasurements) as [BodyMeasurement, ...BodyMeasurement[]];
export const measurements = {
  weight: { name: "体重", unit: "kg", min: 10, max: 700 },
  ...trackedMeasurements,
} as const;
export type BodyMetric = keyof typeof measurements;
