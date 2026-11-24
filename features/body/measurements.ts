export const measurements = {
  weight: { name: "体重", unit: "kg", min: 10, max: 700 },
  fat: { name: "体脂率", unit: "%", min: 1, max: 75 },
  muscle: { name: "肌肉量", unit: "kg", min: 1, max: 200 },
  waist: { name: "腰围", unit: "cm", min: 10, max: 400 },
  chest: { name: "胸围", unit: "cm", min: 10, max: 400 },
  hip: { name: "臀围", unit: "cm", min: 10, max: 400 },
  neck: { name: "颈围", unit: "cm", min: 5, max: 200 },
  shoulders: { name: "肩宽", unit: "cm", min: 10, max: 200 },
  arm: { name: "臂围", unit: "cm", min: 5, max: 150 },
  thigh: { name: "大腿围", unit: "cm", min: 5, max: 200 },
} as const;

export type BodyMetric = keyof typeof measurements;
