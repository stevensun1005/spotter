import type { CatalogEntry } from "./open-gym";
import { label as translate } from "./labels";

export type ExerciseFamily = {
  id: string;
  title: string;
  primary: CatalogEntry;
  variants: CatalogEntry[];
  aliases?: string[];
  note?: string;
};

type Rule = {
  id: string;
  title: string;
  action: RegExp;
  targets: string[];
  equipment?: string;
  primary?: string;
  aliases?: string[];
  note?: string;
  exclude?: RegExp;
  types?: string[];
};

const cable = "cable";
const triceps = ["triceps"];
const lats = ["lats"];
const back = ["upper back", "lats"];
const chest = ["pectorals"];
const legs = ["quads", "glutes"];
const hip = ["hamstrings", "glutes"];
const biceps = ["biceps"];
const frontDelts = ["front delts"];
const abs = ["abs", "obliques"];
const compound = /\b(?:and|to|into|with)\s+(?:an?\s+)?(?:[a-z]+\s+){0,2}(?:squat|lunge|deadlift|press|curl|row|fly|push up|burpee|raise|kick|clean|snatch|jump|reach|twist|rotation|mountain climber)\b|\b(?:curl press|squat press|push up mountain climber)\b/;
const rules: Rule[] = [
  {
    id: "cable-triceps", title: "绳索三头伸展",
    action: /\b(?:push|press)down\b|\bkickback\b|\boverhead\b.*\btriceps?\b.*\bextension\b/,
    equipment: cable, targets: triceps, primary: "0200",
    aliases: ["绳索下压", "三头肌下压", "绳索三头下压", "绳索三头肌下压", "绳索高位下拉", "跪姿绳索高位下拉",
      "绳索过头臂屈伸", "绳索过头三头肌伸展", "跪姿绳索三头肌伸展", "绳索跪姿三头肌伸展", "绳索过头三头",
      "绳索三头后踢", "绳索三头肌后踢", "绳索后摆伸肘"],
    note: "绳索下压、过头臂屈伸和俯身后踢都靠伸肘训练三头肌。选择适合现场滑轮和把手的变式。",
  },
  {
    id: "glute-kickback", title: "臀后踢", action: /\bkickback\b|\bdonkey kick\b/,
    targets: ["glutes"], primary: "5120", aliases: ["绳索后踢", "绳索臀部后踢", "驴踢"],
    note: "靠髋关节将腿向后伸，骨盆保持平稳。使用绳索时确认用的是踝带。",
  },
  {
    id: "straight-arm-pulldown", title: "直臂下拉",
    action: /\bstraight arm\b.*\b(?:pulldown|pushdown)\b|\b(?:pulldown|pushdown)\b.*\bstraight arm\b|\blat pushdown\b/,
    targets: lats, primary: "0238", aliases: ["绳索直臂下拉", "绳索直臂下压", "背阔肌下压"],
    note: "手肘保持轻弯，主要由肩关节把上臂向下带。绳把和直杆的握法不同。",
  },
  {
    id: "lat-pulldown", title: "背阔肌高位下拉", action: /\b(?:pulldown|pull down)\b/,
    targets: lats, primary: "0198", aliases: ["高位下拉", "背阔肌下拉", "绳索跪姿下拉", "龙门架下拉", "lat pulldown"],
    note: "把肘向下带，主要练背阔肌。跪姿可用龙门架，坐姿器械有座椅和压腿垫来稳定身体。",
  },
  { id: "pullover", title: "过头下拉", action: /\bpullovers?\b/, targets: ["lats", "pectorals"], aliases: ["哑铃过头下拉", "仰卧上拉", "杠铃过头下拉"] },
  { id: "triceps-kickback", title: "俯身三头臂屈伸", action: /\bkickback\b/, targets: triceps, primary: "0333", aliases: ["三头后踢", "哑铃三头肌后踢", "哑铃俯身臂屈伸"] },
  { id: "overhead-extension", title: "过头臂屈伸", action: /\boverhead\b.*\b(?:triceps?\s+)?extension\b|\btriceps?\b.*\boverhead\b.*\bextension\b/, targets: triceps, aliases: ["过头三头肌伸展", "头上三头屈伸"] },
  { id: "lying-extension", title: "仰卧臂屈伸", action: /\b(?:lying|skull crusher|skullcrusher)\b.*\b(?:triceps?|extension)\b|\bskull crushers?\b/, targets: triceps, aliases: ["仰卧三头肌伸展", "碎颅者"] },
  { id: "bench-press", title: "卧推", action: /\bbench press(?:es)?\b/, targets: chest, primary: "0025", aliases: ["杠铃卧推", "哑铃卧推", "上斜卧推", "平板卧推"], note: "平板是常见基准。上斜改变推举方向，单臂和哑铃版本可以分别控制两侧路径。" },
  { id: "close-bench-press", title: "窄距卧推", action: /\bbench press(?:es)?\b/, targets: triceps, aliases: ["三头卧推", "窄握卧推"] },
  { id: "chest-press", title: "推胸", action: /\bchest press\b/, targets: chest, aliases: ["器械推胸", "绳索推胸", "坐姿推胸"] },
  { id: "chest-fly", title: "飞鸟夹胸", action: /\b(?:fly|flye|flyes|flies|pec deck|crossover)\b/, targets: chest, primary: "0308", aliases: ["哑铃飞鸟", "绳索夹胸", "夹胸", "胸飞鸟"] },
  { id: "rear-fly", title: "反向飞鸟", action: /\b(?:fly|flye|flyes|flies|lateral raise)\b/, targets: ["rear delts"], primary: "0383", aliases: ["反向夹胸", "后束飞鸟"] },
  { id: "face-pull", title: "面拉", action: /\bface pull\b/, targets: ["rear delts"], aliases: ["绳索面拉", "拉脸"] },
  { id: "lateral-raise", title: "侧平举", action: /\blateral raise\b/, targets: ["side delts"], primary: "0334", aliases: ["侧举", "哑铃侧平举", "绳索侧平举"] },
  { id: "front-raise", title: "前平举", action: /\bfront raise\b/, targets: frontDelts, primary: "0310", aliases: ["前举", "哑铃前平举"] },
  { id: "shoulder-press", title: "肩上推举", action: /\b(?:shoulder|overhead|military|arnold) press\b/, targets: frontDelts, primary: "1162", aliases: ["推肩", "肩推", "过头推举", "军事推举"] },
  { id: "preacher-curl", title: "牧师凳弯举", action: /\bpreacher curl\b/, targets: biceps, aliases: ["斜托弯举", "牧师弯举"] },
  { id: "hammer-curl", title: "锤式弯举", action: /\bhammer curl\b/, targets: biceps, primary: "0313", aliases: ["锤式二头弯举", "锤式弯举"] },
  { id: "biceps-curl", title: "二头弯举", action: /\bcurl(?:s)?\b/, targets: biceps, primary: "0294", aliases: ["肱二头肌弯举", "哑铃弯举", "杠铃弯举", "绳索二头弯举"] },
  { id: "wrist-curl", title: "腕弯举", action: /\bwrist curl\b/, targets: ["forearms"], aliases: ["手腕弯举", "腕屈伸"] },
  { id: "shrug", title: "耸肩", action: /\bshrug(?:s)?\b/, targets: ["traps"], primary: "0095", aliases: ["杠铃耸肩", "哑铃耸肩"] },
  { id: "upright-row", title: "直立划船", action: /\bupright row\b/, targets: ["traps", "side delts", "upper back"], aliases: ["直立提拉", "立姿划船"] },
  { id: "inverted-row", title: "反向划船", action: /\b(?:inverted row|body row|horizontal pull up)\b/, targets: back, aliases: ["自重划船", "水平引体"] },
  { id: "seated-row", title: "坐姿划船", action: /\bseated\b.*\brow\b|\brow\b.*\bseated\b/, targets: back, primary: "0861", aliases: ["坐姿绳索划船", "坐姿低位划船"] },
  { id: "row", title: "俯身划船", action: /\b(?:bent over|chest supported|incline bench|kneeling|one arm|single arm|t bar|pendlay|meadows|landmine)\b.*\brow\b|\brow\b.*\b(?:bent over|chest supported|incline bench|kneeling)\b/, targets: back, primary: "0027", aliases: ["杠铃划船", "哑铃划船", "单臂划船", "俯身划船"], exclude: /\b(?:inverted|standing|seated|upright|plank|renegade|twisting)\b/ },
  { id: "pull-up", title: "引体向上", action: /\b(?:pull ups?|chin ups?)\b/, targets: ["lats", "upper back", "biceps"], primary: "0652", aliases: ["反握引体", "助力引体", "正握引体"], exclude: /\b(?:bench|horizontal|false grip muscle|muscle up)\b/ },
  { id: "push-up", title: "俯卧撑", action: /\bpush ups?\b/, targets: ["pectorals", "triceps", "front delts"], primary: "0662", aliases: ["伏地挺身", "跪姿俯卧撑"], exclude: /\b(?:handstand|pike|burpee|squat|spider push up with)\b/ },
  { id: "dip", title: "双杠臂屈伸", action: /\bdips?\b/, targets: ["triceps", "pectorals"], primary: "0251", aliases: ["双杠撑体", "三头双杠臂屈伸", "胸部双杠臂屈伸"], exclude: /\b(?:bench|chair|floor|plank)\b/ },
  { id: "bench-dip", title: "凳上臂屈伸", action: /\b(?:bench|chair)\b.*\bdips?\b|\bdips?\b.*\b(?:bench|chair)\b/, targets: triceps, aliases: ["凳上撑体", "凳上三头臂屈伸"] },
  { id: "romanian-deadlift", title: "罗马尼亚硬拉", action: /\bromanian deadlift\b/, targets: hip, primary: "0085", aliases: ["罗马尼亚硬拉", "RDL"] },
  { id: "stiff-leg-deadlift", title: "直腿硬拉", action: /\b(?:stiff leg|straight leg)\b.*\bdeadlift\b/, targets: hip, aliases: ["直膝硬拉"] },
  { id: "deadlift", title: "硬拉", action: /\bdeadlift\b/, targets: hip, primary: "0032", aliases: ["杠铃硬拉", "相扑硬拉", "陷阱杠硬拉"], exclude: /\b(?:romanian|stiff leg|straight leg)\b/ },
  { id: "good-morning", title: "早安式髋铰链", action: /\bgood morning\b/, targets: ["hamstrings", "glutes"], primary: "0044", aliases: ["早安式", "早安式体前屈"] },
  { id: "split-squat", title: "分腿蹲", action: /\bsplit squat\b/, targets: legs, primary: "2960", aliases: ["保加利亚分腿蹲", "后脚抬高分腿蹲"], exclude: /\b(?:step up|jump)\b/ },
  { id: "lunge", title: "弓步蹲", action: /\blunges?\b/, targets: legs, primary: "0336", aliases: ["箭步蹲", "后撤弓步", "前弓步", "侧弓步"], exclude: /\b(?:split squat|step up)\b/ },
  { id: "hack-squat", title: "哈克深蹲", action: /\bhack squats?\b/, targets: ["quads", "hamstrings"], primary: "0046", aliases: ["哈克蹲", "器械哈克深蹲"] },
  { id: "sissy-squat", title: "西西深蹲", action: /\bsissy squats?\b/, targets: ["quads"], primary: "4723", aliases: ["西斯深蹲", "sissy squat"] },
  { id: "cossack-squat", title: "哥萨克深蹲", action: /\bcossack squats?\b/, targets: ["quads", "adductors"], primary: "2569", aliases: ["侧蹲", "哥萨克蹲"] },
  { id: "squat", title: "深蹲", action: /\bsquats?\b/, targets: legs, primary: "3593", aliases: ["杠铃深蹲", "高脚杯深蹲", "自重深蹲"], exclude: /\b(?:split|jump|pull up|step up|curtsy|hack|sissy|cossack|lunge|press|kick|snatch|kneeling)\b/ },
  { id: "step-up", title: "踏台上步", action: /\bstep ups?\b/, targets: legs, primary: "0431", aliases: ["踏阶", "登台阶", "踏台", "上步"], exclude: /\b(?:split squat|jump)\b/ },
  { id: "hip-thrust", title: "臀推", action: /\bhip thrust\b/, targets: ["glutes"], primary: "1060", aliases: ["杠铃臀推", "器械臀推", "单腿臀推"] },
  { id: "glute-bridge", title: "臀桥", action: /\b(?:glute|hip) bridge\b/, targets: ["glutes"], aliases: ["地面臀桥", "单腿臀桥", "仰卧臀桥"] },
  { id: "leg-press", title: "腿举", action: /\bleg press\b/, targets: legs, primary: "0739", aliases: ["腿推", "倒蹬", "腿举机"] },
  { id: "leg-extension", title: "腿屈伸", action: /\bleg extension\b/, targets: ["quads"], primary: "0585", aliases: ["腿伸展", "坐姿腿屈伸"] },
  { id: "leg-curl", title: "腿弯举", action: /\bleg curls?\b/, targets: ["hamstrings"], primary: "0586", aliases: ["俯卧腿弯举", "坐姿腿弯举"], exclude: /\b(?:inverse|nordic)\b/ },
  { id: "calf-raise", title: "提踵", action: /\bcalf raises?\b/, targets: ["calves"], primary: "3018", aliases: ["小腿提踵", "站姿提踵", "坐姿提踵"], exclude: /\breverse\b/ },
  { id: "hip-abduction", title: "髋外展", action: /\bhip abduction\b/, targets: ["abductors", "glutes"], aliases: ["髋外展", "臀腿外展"], exclude: /\b(?:bridge|plank)\b/ },
  { id: "hip-adduction", title: "髋内收", action: /\bhip adduction\b/, targets: ["adductors"], primary: "0168", aliases: ["髋内收", "夹腿"] },
  { id: "crunch", title: "卷腹", action: /\bcrunch(?:es)?\b/, targets: abs, aliases: ["卷腹", "腹部卷曲"], exclude: /\b(?:reverse|bicycle|side|oblique|twist|plank|sit up|leg raise)\b/ },
  { id: "twisting-crunch", title: "转体卷腹", action: /\b(?:twisting|oblique|bicycle|side)\b.*\bcrunch(?:es)?\b|\bcrunch(?:es)?\b.*\btwist\b/, targets: abs, aliases: ["侧转卷腹", "单车卷腹"] },
  { id: "reverse-crunch", title: "反向卷腹", action: /\breverse crunch\b/, targets: abs, aliases: ["反卷腹"] },
  { id: "sit-up", title: "仰卧起坐", action: /\bsit ups?\b/, targets: abs, primary: "0001", aliases: ["起坐", "负重仰卧起坐"] },
  { id: "hanging-leg-raise", title: "悬垂举腿", action: /\bhanging\b.*\b(?:leg|knee) raises?\b/, targets: abs, aliases: ["悬垂提膝", "悬挂举腿"] },
  { id: "lying-leg-raise", title: "仰卧举腿", action: /\b(?:lying|supine)\b.*\b(?:leg|knee) raises?\b/, targets: ["abs"], aliases: ["仰卧抬腿", "仰卧提膝"], exclude: /\b(?:side lying|prone|reverse)\b/ },
  { id: "back-extension", title: "背伸", action: /\b(?:back extension|hyperextension)\b/, targets: ["glutes", "spine"], aliases: ["罗马椅挺身", "山羊挺身"], exclude: /\b(?:reverse|scapular)\b/ },
  { id: "reverse-hyperextension", title: "反向背伸", action: /\breverse hyperextension\b/, targets: ["glutes", "spine"], aliases: ["反向挺身"] },
  { id: "superman", title: "超人式", action: /\bsuperman\b/, targets: ["spine"], aliases: ["俯卧超人"], types: ["isometric", "calisthenics", "strength"] },
  { id: "nordic-curl", title: "北欧腿弯举", action: /\bnordic\b.*\bcurl\b/, targets: ["hamstrings"], aliases: ["北欧腘绳肌弯举", "腘绳肌离心"] },
  { id: "glute-ham-raise", title: "臀腿腘绳肌挺身", action: /\bglute ham raise\b/, targets: ["hamstrings"], aliases: ["臀腿挺身", "GHR"] },
  { id: "russian-twist", title: "俄罗斯转体", action: /\brussian twists?\b/, targets: abs, primary: "0846", aliases: ["俄罗斯扭转"] },
  { id: "side-bend", title: "躯干侧屈", action: /\bside bends?\b/, targets: ["obliques"], aliases: ["体侧屈", "哑铃侧屈"] },
  { id: "pallof", title: "帕洛夫推举", action: /\bpallof (?:press|hold)\b/, targets: abs, aliases: ["抗旋转推举", "帕洛夫抗旋"], types: ["strength", "calisthenics", "isometric"] },
  { id: "side-plank", title: "侧平板支撑", action: /\bside plank\b/, targets: abs, aliases: ["侧桥", "侧平板"], types: ["isometric", "calisthenics"], exclude: /\b(?:row|crunch|twist|dip|rotation|leg raise|abduction)\b/ },
  { id: "plank", title: "平板支撑", action: /\bplank\b/, targets: abs, aliases: ["肘撑平板", "高位平板"], types: ["isometric", "calisthenics"], exclude: /\b(?:side|reverse|row|kickback|crunch|twist|rotation|raise|mountain climber|push up|walk|tap|jack|reach)\b/ },
  { id: "jump-rope", title: "跳绳", action: /\bjump rope\b/, targets: ["cardiovascular system"], aliases: ["单摇", "双摇"], types: ["cardio"] },
  { id: "burpee", title: "波比跳", action: /\bburpees?\b/, targets: ["cardiovascular system"], aliases: ["波比", "burpee"], types: ["cardio", "plyometrics"], exclude: /\b(?:box|long jump|mountain climber|complex)\b/ },
  { id: "cat-cow", title: "猫牛式", action: /\bcat cow\b/, targets: ["spine"], primary: "4580", aliases: ["猫牛伸展", "猫牛"], types: ["yoga", "stretching", "mobility"] },
  { id: "jump-squat", title: "深蹲跳", action: /\bjump squats?\b|\bsquat jumps?\b/, targets: ["quads", "cardiovascular system"], aliases: ["跳跃深蹲"], types: ["plyometrics"], exclude: /\b(?:battling ropes|drop jump|split squat)\b/ },
];

const rulesById = new Map(rules.map((rule) => [rule.id, rule]));

const commonTricepsQueries = new Set(["绳索下压", "绳索高位下拉", "跪姿绳索高位下拉"]);
export function preferredFamilyForQuery(query: string) {
  if (commonTricepsQueries.has(query)) return "cable-triceps";
  if (query === "高位下拉" || query === "背阔肌下拉") return "lat-pulldown";
}

export function tricepsVariantGroup(row: CatalogEntry): string {
  if (/\bkickback\b/i.test(row.en)) return "俯身后踢";
  if (/\boverhead\b/i.test(row.en) || row.id === "0176" || row.id === "1859") return "过头臂屈伸";
  return "下压";
}

// These catalogue titles omit the part of the motion described in their instructions.
const reviewed: Record<string, string> = {
  "0176": "cable-triceps",
  "1859": "cable-triceps",
  "4893": "cable-triceps",
  "4960": "cable-triceps",
  "11051": "cable-triceps",
  "3719": "cable-triceps",
  "0172": "lat-pulldown",
};

const specific: Record<string, { label: string; tip: string }> = {
  "0200": { label: "站姿 · 双手绳把", tip: "双手握住绳端，底部可自然分开，手腕可随动作调整角度。" },
  "0201": { label: "站姿 · 正握直杆", tip: "固定横杆让双手同步伸肘，握距和手腕角度比较容易保持一致。" },
  "0207": { label: "站姿 · 反握直杆", tip: "手掌朝上，手腕和握力承担方式不同，选能控稳横杆的重量。" },
  "0241": { label: "站姿 · V 形把手", tip: "把手提供斜角握法，两手仍同时移动，适合需要固定握距时。" },
  "2249": { label: "站姿 · V 形把手（同动作来源 2）", tip: "动作要领与标准 V 形把手相同，可按自己常用的记录选用。" },
  "4355": { label: "站姿 · V 形把手（同动作来源 3）", tip: "同为 V 形把手下压，原动作要领提示允许躯干轻微前倾。" },
  "0176": { label: "双膝跪姿 · 面向器械", tip: "手肘靠近头侧。双膝着地减少腿部借力，伸肘时保持躯干稳定。" },
  "1859": { label: "双膝跪姿 · 背向器械", tip: "把手从头后起动。双膝着地减少腿部借力，注意肋骨和骨盆别跟着绳索移动。" },
  "4893": { label: "双膝跪姿 · 半程下压", tip: "肘靠体侧，只做接近伸直的一段。它是半程版本，训练记录宜与全程版分开。" },
  "3920": { label: "地面坐姿 · 绳索下压", tip: "低位身体位置适合不同的滑轮设置，肘仍贴在身侧伸直。" },
  "0198": { label: "坐姿 · 标准高位下拉", tip: "座椅和压腿垫有助固定下半身。把肘带向身体侧下方。" },
  "0172": { label: "上斜凳靠背 · 拉到上胸", tip: "用上斜凳支撑躯干，从头上方向拉到上胸，肘会弯曲。" },
  "4948": { label: "双膝跪姿 · 单臂", tip: "可在龙门架上逐侧做。每侧分别拉，躯干保持朝同一方向。" },
  "11253": { label: "双膝跪姿 · 绳索下拉", tip: "肩带动上臂下拉。动作步骤要求把肘向下带，把手拉向胸前。" },
  "0860": { label: "站姿俯身 · 单臂伸肘", tip: "俯身后固定上臂，把前臂向身后伸直。可以分别观察和记录左右侧。" },
  "1068": { label: "俯身 · 上臂近水平", tip: "这条的动作要领强调让上臂接近水平，伸肘时避免把肩一起抬起。" },
  "5120": { label: "站姿 · 踝带单腿后踢", tip: "把踝带接到低位滑轮，可扶器械稳住身体，再从髋关节向后伸腿。" },
};

const variantMarkers = [
  { find: /\bhalf kneeling\b/, label: "半跪", tip: "一膝着地、另一脚踩稳，动作中保持肋骨和骨盆稳定。" },
  { find: /\bkneeling\b|\bon knees\b/, label: "跪姿", tip: "跪姿减少腿部借力，过程中维持躯干稳定。" },
  { find: /\bseated\b|\bsitting\b/, label: "坐姿", tip: "坐姿有稳定的支撑位置，便于复现每组的起始姿势。" },
  { find: /\bprone\b|\bface down\b/, label: "俯卧", tip: "身体朝下有支撑，动作中尽量维持躯干位置。" },
  { find: /\bside lying\b/, label: "侧卧", tip: "保持侧卧支撑，用稳定的起始角度做每一次。" },
  { find: /\bsupine\b|\bbench\b.*\bpress\b/, label: "仰卧", tip: "利用凳面或地面支撑，让目标关节按同一轨迹活动。" },
  { find: /\blying\b/, label: "卧姿", tip: "躯干有支撑。凳面、高度和身体朝向按原动作设置。" },
  { find: /\bbent over\b/, label: "俯身", tip: "先稳住俯身角度，再控制动作轨迹。" },
  { find: /\bstanding\b/, label: "站姿", tip: "无需座椅，用双脚站稳以保持躯干位置。" },
  { find: /\bsingle arm\b|\bone arm\b|\bunilateral\b/, label: "单臂", tip: "可以逐侧调整动作路径，记录左右侧时也更清楚。" },
  { find: /\bsingle leg\b|\bone leg\b/, label: "单腿", tip: "每侧独立承担动作，重点保持骨盆平稳。" },
  { find: /\balternat(?:e|ing)\b/, label: "交替", tip: "两侧依次做，交替时控制身体晃动。" },
  { find: /\b(?:two|double|both) arm\b/, label: "双臂", tip: "两侧同时发力，适合比较共同的动作节奏。" },
  { find: /\bchest supported\b|\bchest support\b/, label: "胸托", tip: "胸部有支撑，减轻维持俯身角度的要求。" },
  { find: /\bbulgarian\b|\brear foot elevated\b/, label: "后脚抬高", tip: "后脚放在凳面，主要用前脚支撑，需要更多平衡控制。" },
  { find: /\bfront foot elevated\b/, label: "前脚垫高", tip: "垫高改变前腿的活动幅度，先选一个能稳住的垫高高度。" },
  { find: /\b(?:behind neck|rear pulldown)\b/, label: "颈后", tip: "把手经过头后方，需要肩部在该位置能舒适活动。" },
  { find: /\b(?:decline|declined)\b/, label: "下斜", tip: "下斜凳改变用力方向，上凳前确认保护和支撑固定。" },
  { find: /\b(?:incline|inclined)\b/, label: "上斜", tip: "上斜改变躯干与阻力的夹角，记录凳背档位方便复现。" },
  { find: /\bpaused?\b|\bpause\b/, label: "停顿", tip: "在指定位置短暂停住，便于控制回弹和节奏。" },
  { find: /\b(?:partial|half range)\b/, label: "半程", tip: "只在指定幅度内动作，记录时与全程版区分。" },
  { find: /\b(?:wide grip|wide neutral grip|wide pulldown|wide stance)\b/, label: "宽距", tip: "比常规距离更宽，按自己的舒适范围控制动作。" },
  { find: /\b(?:close grip|narrow grip|narrow stance)\b/, label: "窄距", tip: "比常规距离更窄，保持手腕或支撑脚在自然位置。" },
  { find: /\b(?:reverse grip|underhand|supinated)\b/, label: "反握", tip: "手掌朝上或朝向身体，选舒适的手腕角度。" },
  { find: /\b(?:neutral grip|parallel grip)\b/, label: "中立握", tip: "双手相对，无需把手腕转到完全正握或反握。" },
  { find: /\b(?:overhand|pronated)\b/, label: "正握", tip: "手背朝上或朝向身体，保持腕部顺着前臂。" },
  { find: /\bv bar\b/, label: "V 形把手", tip: "斜角把手保持固定握距，双手一起移动。" },
  { find: /\b(?:rope attachment|with rope|rope equipment|rope high pulley)\b/, label: "绳把", tip: "两端可以独立移动，手腕可按舒服的方向调整。" },
  { find: /\bstraight bar\b/, label: "直杆", tip: "两侧由同一根横杆连接，方便保持两手同步。" },
  { find: /\b(?:sz|ez) bar\b/, label: "曲杆", tip: "弯曲握位提供不同的手腕角度，按舒适度选择。" },
  { find: /\b(?:assisted|assistance)\b/, label: "助力", tip: "助力减少需要自行承受的负荷，适合先练熟动作轨迹。" },
  { find: /\bweighted\b/, label: "负重", tip: "在保持原动作范围和控制的基础上增加外部阻力。" },
  { find: /\bsumo\b/, label: "宽站距", tip: "站距比常规款更宽，脚尖和膝盖方向保持一致。" },
  { find: /\bfront squat\b/, label: "前置负重", tip: "负重放在身体前侧，保持躯干直立时也要稳住负重。" },
  { find: /\b(?:double under|double jump rope)\b/, label: "双摇", tip: "一次跳起让绳通过两次，先练稳定的单摇再增加转绳频率。" },
  { find: /\bzottman\b/, label: "佐特曼", tip: "通常正向弯举后转腕再回落，选能控制转腕的重量。" },
  { find: /\b(?:reverse lunge|backward lunge)\b/, label: "后撤", tip: "从站姿向后迈步，再用前腿控制下蹲和回位。" },
  { find: /\b(?:lateral lunge|side lunge)\b/, label: "侧向", tip: "向侧方移动重心，把臀部往屈膝的一侧坐。" },
] as const;

const canonicalEnglish = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sourceSuffix = /(?:\s*\((?:version|v\.?)\s*[0-9]{1,2}\)|\s+(?:version|v\.?)\s*[0-9]{1,2}|\s*\((?:(?:front|back|side|rear|left|right) (?:view|pov)|male|female)\))$/i;
function baseName(name: string) {
  let base = name.trim();
  while (sourceSuffix.test(base)) base = base.replace(sourceSuffix, "").trimEnd();
  return base;
}

function groupRule(row: CatalogEntry) {
  const existing = reviewed[row.id];
  if (existing) return rulesById.get(existing);
  const name = canonicalEnglish(row.en);
  if (compound.test(name)) return undefined;
  return rules.find((rule) =>
    (rule.types ?? ["strength", "calisthenics"]).includes(row.type) &&
    rule.targets.includes(row.target) &&
    (!rule.equipment || row.equipment === rule.equipment) &&
    (!rule.exclude || !rule.exclude.test(name)) && rule.action.test(name));
}

const fallbackTip = "可在详情核对器械、起始姿势和演示，再按自己现场的条件选择。";
const cachedFamilies = new WeakMap<readonly CatalogEntry[], ReadonlyMap<string, ExerciseFamily>>();
export function catalogFamilies(rows: readonly CatalogEntry[]): ReadonlyMap<string, ExerciseFamily> {
  const cached = cachedFamilies.get(rows);
  if (cached) return cached;
  const groups = new Map<string, { rows: CatalogEntry[]; rule?: Rule }>();
  for (const row of rows) {
    const rule = groupRule(row);
    // Only ignore source version suffixes when English name, muscle and equipment still match.
    const key = rule?.id ?? ["source", row.type, row.equipment, row.target, canonicalEnglish(baseName(row.en))].join(":");
    const group = groups.get(key);
    if (group) group.rows.push(row);
    else groups.set(key, { rows: [row], rule });
  }

  const byId = new Map<string, ExerciseFamily>();
  for (const [id, { rows: members, rule }] of groups) {
    if (members.length < 2) continue;
    const primary = members.find((row) => row.id === rule?.primary)
      ?? members.find((row) => row.animation && baseName(row.en) === row.en.trim())
      ?? members.find((row) => baseName(row.en) === row.en.trim())
      ?? members[0];
    const family = {
      id, title: rule?.title ?? baseName(primary.name), primary,
      variants: [primary, ...members.filter((row) => row !== primary)],
      aliases: rule?.aliases, note: rule?.note,
    };
    for (const row of members) byId.set(row.id, family);
  }
  cachedFamilies.set(rows, byId);
  return byId;
}

type VariantDetails = { label: string; tip: string };
const cachedDetails = new WeakMap<ExerciseFamily, Map<string, VariantDetails>>();

function conciseDetails(row: CatalogEntry, family: ExerciseFamily, variedEquipment: boolean): VariantDetails {
  const stored = specific[row.id];
  if (stored) return stored;
  const name = canonicalEnglish(row.en);
  const found = variantMarkers.filter(({ find, label }) => find.test(name) &&
    (label !== "跪姿" || !name.includes("half kneeling")) &&
    (label !== "卧姿" || !/\b(?:side lying|supine|prone)\b/.test(name)));
  const gear = variedEquipment ? translate(row.equipment) : "";
  const tags = found.map(({ label }) => label);
  const distinctions = found.filter(({ label }) => label !== "站姿");
  return {
    label: [gear, ...tags].filter(Boolean).join(" · ") || (row.id === family.primary.id ? "标准动作" : row.name),
    tip: (distinctions.length ? distinctions.slice(0, 2) : found).map(({ tip }) => tip).join("") || family.note || fallbackTip,
  };
}

export function variantDetails(row: CatalogEntry, family: ExerciseFamily): VariantDetails {
  let details = cachedDetails.get(family);
  if (!details) {
    const differentEquipment = family.variants.some((variant) => variant.equipment !== family.primary.equipment);
    details = new Map();
    const byLabel = new Map<string, CatalogEntry[]>();
    for (const variant of family.variants) {
      const detail = conciseDetails(variant, family, differentEquipment);
      details.set(variant.id, detail);
      const matches = byLabel.get(detail.label);
      if (matches) matches.push(variant);
      else byLabel.set(detail.label, [variant]);
    }
    for (const duplicates of byLabel.values()) {
      if (duplicates.length < 2) continue;
      const sameNames = new Map<string, number>();
      for (const variant of duplicates) sameNames.set(variant.name, (sameNames.get(variant.name) ?? 0) + 1);
      const indices = new Map<string, number>();
      for (const variant of duplicates) {
        const detail = details.get(variant.id)!;
        const index = (indices.get(variant.name) ?? 0) + 1;
        indices.set(variant.name, index);
        const label = (sameNames.get(variant.name) ?? 0) > 1 ? variant.name + " · 来源 " + index : variant.name;
        details.set(variant.id, { ...detail, label });
      }
    }
    cachedDetails.set(family, details);
  }
  return details.get(row.id) ?? conciseDetails(row, family, false);
}
