export const types = ["strength", "calisthenics", "olympic", "plyometrics", "isometric", "cardio", "stretching", "mobility", "yoga", "pilates", "combat", "rehab"];
const labels: Record<string, string> = {
  back: "背部", cardio: "有氧", chest: "胸部", "full body": "全身", "lower arms": "前臂", "lower legs": "小腿",
  neck: "颈部", shoulders: "肩部", "upper arms": "上臂", "upper legs": "大腿", waist: "腰腹",
  strength: "力量", calisthenics: "徒手训练", olympic: "奥林匹克举重", plyometrics: "增强式训练", isometric: "等长训练",
  stretching: "拉伸", mobility: "活动度", yoga: "瑜伽", pilates: "普拉提", combat: "搏击", rehab: "康复",
  "body weight": "自重", "wheel roller": "健腹轮", cable: "绳索", treadmill: "跑步机", stick: "训练棍", "bosu ball": "半球平衡球", "stationary bike": "固定单车",
  "leverage machine": "杠杆器械", assisted: "辅助训练", "medicine ball": "药球", weighted: "负重",
  "stability ball": "瑜伽球", band: "弹力带", "ez barbell": "曲杆", "resistance band": "阻力带", barbell: "杠铃",
  "olympic barbell": "奥杆", rope: "训练绳", dumbbell: "哑铃", "sled machine": "滑轨器械", "elliptical machine": "椭圆机",
  roller: "泡沫轴", "upper body ergometer": "上肢功率车", "suspension trainer": "悬挂训练带", kettlebell: "壶铃",
  landmine: "地雷杆", "weight plate": "杠铃片", "smith machine": "史密斯机", "massage ball": "按摩球",
  sandbag: "沙袋", "skierg machine": "滑雪机", hammer: "训练锤", macebell: "训练锤铃", tire: "轮胎",
  "trap bar": "六角杠", "stepmill machine": "登阶机",
  "axle bar": "粗轴杠", "atlas stone": "阿特拉斯石球", "conan wheel": "柯南之轮", "hinged post": "铰接立柱",
  "hercules columns": "负重立柱", "cross hold weights": "侧举配重", "iron block": "铁块", "throwing keg": "投掷桶",
  "log bar": "圆木杠", "mas stick": "木棒与抵脚板", "weighted shield": "盾形负重", "timber frame": "负重木框",
  "viking press frame": "维京推举架", "throw weight": "投掷配重", wheelbarrow: "独轮车",
  pectorals: "胸肌", abs: "腹直肌", "cardiovascular system": "心肺", glutes: "臀肌", delts: "三角肌",
  "front delts": "三角肌前束", "side delts": "三角肌中束", "rear delts": "三角肌后束",
  triceps: "肱三头肌", biceps: "肱二头肌", "upper back": "上背", lats: "背阔肌", calves: "小腿后侧",
  quads: "股四头肌", forearms: "前臂", hamstrings: "腘绳肌", spine: "下背", traps: "斜方肌",
  "hip flexors": "髋屈肌", obliques: "腹斜肌", shins: "小腿前侧",
  adductors: "大腿内收肌", "serratus anterior": "前锯肌", abductors: "髋外展肌", "levator scapulae": "肩胛提肌",
};
export const label = (value: string) => labels[value] ?? value;

export const muscleNames: Record<string, string> = {
  chest: "胸大肌", "upper-chest": "胸大肌上束", "lower-chest": "胸大肌中下束", serratus: "前锯肌",
  trapezius: "斜方肌", "upper-trapezius": "上斜方肌", "lower-trapezius": "下斜方肌",
  lats: "背阔肌", "upper-back": "上背", "lower-back": "下背／竖脊肌", rhomboids: "菱形肌", "rotator-cuff": "肩袖",
  "front-delts": "三角肌前束", "side-delts": "三角肌中束", "rear-delts": "三角肌后束", biceps: "肱二头肌", triceps: "肱三头肌", forearm: "前臂",
  abs: "腹直肌", "upper-abs": "上腹", "lower-abs": "下腹", obliques: "腹斜肌", gluteal: "臀肌",
  quadriceps: "股四头肌", "inner-quad": "股四头肌内侧", "outer-quad": "股四头肌外侧",
  hamstring: "腘绳肌", adductors: "大腿内收肌", "hip-flexors": "髋屈肌", calves: "小腿后侧", tibialis: "胫骨前肌",
  "cardiovascular system": "心肺",
};

export const groups = [
  { id: "chest", title: "胸部", muscles: ["chest", "serratus"] },
  { id: "back", title: "背部", muscles: ["lats", "upper-back", "lower-back", "trapezius"] },
  { id: "shoulders", title: "肩部", muscles: ["front-delts", "side-delts", "rear-delts"] },
  { id: "arms", title: "手臂", muscles: ["biceps", "triceps", "forearm"] },
  { id: "core", title: "核心", muscles: ["abs", "obliques"] },
  { id: "legs", title: "腿部", muscles: ["gluteal", "quadriceps", "hamstring", "adductors", "hip-flexors", "calves", "tibialis"] },
];

const parent: Record<string, string> = {
  "upper-chest": "chest", "lower-chest": "chest", "upper-abs": "abs", "lower-abs": "abs",
  "front-deltoid": "front-delts", "rear-deltoid": "rear-delts", deltoids: "side-delts",
  "upper-trapezius": "trapezius", "lower-trapezius": "trapezius", "inner-quad": "quadriceps", "outer-quad": "quadriceps",
  rhomboids: "upper-back", "rotator-cuff": "rear-delts",
};
export const regionMuscle = (region: string) => parent[region] ?? region;

export function expandAnatomyWeights(weights: Record<string, number>) {
  const expanded = { ...weights };
  for (const [region, group] of Object.entries(parent)) {
    if (expanded[region] === undefined && weights[group] !== undefined) expanded[region] = weights[group];
  }
  return expanded;
}
export const termMuscles = (term: string) => groups.find((group) => "group:" + group.id === term)?.muscles ?? [term];
