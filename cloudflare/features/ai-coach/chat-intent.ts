const chineseLead = /^(?:教练[：:\s]*)?(?:请(?:问|你)?\s*)?(?:(?:你\s*)?(?:能不能|能否|可不可以|可以|能|麻烦你?)\s*)?(?:(?:帮我|给我|替我|为我|帮忙)\s*)?/u;
const chineseAction = /^(?:生成|制定|制订|定制|创建|设计|拟定|拟|编排|规划|安排|排|做|写|出|配)\s*/u;
const chineseDesire = /^我(?:想让你|想请你|想要|想|要|需要|希望你|希望)\s*/u;
const chineseReordered = /^把(.+?)(?:安排|编排|规划|排)(?:一下|出来|好)(?:吧|吗|嘛)?$/u;
const chineseRequestedNoun = /^(?:一?[个份套]|[上下本]周的?)/u;
const chinesePlan = /(?:计划|方案|安排|日程|训练表)/u;
const chineseTraining = /(?:训练|健身|锻炼|运动|增肌|力量|举铁|有氧|跑步|体能|塑形|减脂|上肢|下肢|上半身|下半身|全身|臀腿|核心|分化|每周[一二两三四五六七1-7]\s*练)/u;
const genericPlan = /^(?:(?:一|这)?[个份套]|一下|(?:一|两|二|三|四|五|六|七|\d+)周的?)*\s*计划\s*(?:吧|嘛|吗|一下)?$/u;
const otherPlan = /(?:饮食|食谱|餐单|餐食|吃饭|膳食|营养|旅行|旅游|学习|复习|备考|理财|预算|排班|工作计划)/u;
const chineseDiscussion = /^(?:不|别|先不|暂不|暂时不|无需|了解|知道|看|问|分享|把|分析|讨论|解释|评估|评价|点评|改|优化|调整|比较|学习|说明|怎么|如何|怎样)|(?:是什么|什么意思|怎么样|有什么区别|需要注意什么|要注意什么|有什么建议)|(?:计划|方案)的?(?:分析|评价|建议|解释|模板|指南|原理)/u;
const chineseSessionRequest = /^(?:我)?(?:想|要|打算)?\s*(?:今天|今日|今晚|明天|后天)\s*(?:我)?(?:想|要|打算)?\s*(?:在家|在健身房|做)?\s*练\s*(?:上半身|下半身|上肢|下肢|全身|胸|背|肩|腿|臀|核心)(?:[\d\s分钟。]*|怎么安排)$/u;

function asksInChinese(clause: string) {
  const request = clause.replace(chineseLead, "");
  if (chineseSessionRequest.test(request)) return true;
  const desire = request.match(chineseDesire);
  const statement = desire ? request.slice(desire[0].length).replace(chineseLead, "") : request;
  const action = statement.match(chineseAction);
  const reordered = statement.match(chineseReordered);
  if (!action && !desire && !reordered && !(request !== clause && chineseRequestedNoun.test(request))) return false;

  const subject = reordered?.[1] ?? statement.slice(action?.[0].length ?? 0);
  if (otherPlan.test(subject) || chineseDiscussion.test(subject)) return false;
  if (genericPlan.test(subject)) return true;
  if (!chineseTraining.test(subject)) return false;
  return Boolean(reordered) || chinesePlan.test(subject) || Boolean(action && /^(?:编排|规划|安排|排)$/u.test(action[0].trim()));
}

const englishLead = /^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:help\s+me\s+)?/u;
const englishDesire = /^(?:i (?:want|need|would like|am looking for)|i'd like)\s+/u;
const englishAction = /^(?:make|create|build|design|draft|generate|write|prepare|put together|come up with|plan|arrange|schedule)\b\s*/u;
const englishTrainingPlan = /\b(?:workout|training|gym|lifting|weightlifting|strength|exercise|fitness|running|cardio|conditioning)\s+(?:(?:training|workout)\s+)?(?:plan|program(?:me)?|routine|schedule|split)\b/u;
const englishTraining = /\b(?:workouts?|training|exercises?|fitness|lifting|running|cardio)\b/u;
const englishDiscussion = /^(?:no|not|without|how|what|why|whether|know|learn|understand|review|critique|evaluate|revise|change|adjust|improve|explain)\b|^(?:me\s+)?(?:an?|the)\s+(?:review|critique|analysis|summary|explanation|evaluation|guide|comparison)\b/u;

function asksInEnglish(clause: string) {
  const request = clause.replace(englishLead, "");
  const desire = request.match(englishDesire);
  const statement = desire ? request.slice(desire[0].length).replace(/^(?:you\s+)?to\s+/u, "").replace(englishLead, "") : request;
  const action = statement.match(englishAction);
  if (!action && !desire) return false;

  const subject = statement.slice(action?.[0].length ?? 0);
  if (englishDiscussion.test(subject)) return false;
  return englishTrainingPlan.test(subject) ||
    Boolean(action && /^(?:plan|arrange|schedule)$/u.test(action[0].trim()) && englishTraining.test(subject));
}

export function asksForTrainingPlan(message: string) {
  return message.normalize("NFKC").toLowerCase().replace(/[’‘]/gu, "'")
    .split(/[，,。.!！？?；;\n]+/u)
    .some((part) => {
      const clause = part.trim();
      return asksInChinese(clause) || asksInEnglish(clause);
    });
}

const mealCancellation = /^(?:取消\s*(?:(?:这次|本次|刚才)的?)?(?:记餐|饮食记录|记录)?|算了|先不记了?|不记了?|不用(?:了|记(?:了)?)|不要(?:再)?记(?:了)?|别(?:再)?记(?:了)?|cancel(?: it)?)\s*[。！.!]*$/iu;
const noMealWrite = /(?:不用|不必|不要|不想|不需要|先不|暂不|别|不能)\s*(?:再\s*)?(?:(?:帮|给|替)我\s*)?(?:记|补记|添加|加[入进到上]|写入|放进|存入)|(?:已经|刚刚)记(?:过|了|录)|已经(?:加进|加到|保存)|\b(?:do not|don't|no need to|already)\s+(?:log|record|save|add)\b/iu;
const mealHypothetical = /如果|假设|假如|比如|例如|(?:打算|准备|计划|考虑|想)(?:要)?(?:吃|喝)|还没(?:吃|喝)|没吃过|并没(?:有)?(?:吃|喝)|怎么(?:记|加)|如何(?:记|加)|\b(?:if i (?:eat|drink)|hypothetically|for example|how (?:do i|can i) (?:log|record|add)|planning to eat|going to eat)\b/iu;
const mealNoun = /饮食|餐食|[早午晚]餐|加餐|[早午晚]饭|这(?:一)?顿|饭菜|食物|记餐|刚(?:吃|喝)|(?:吃|喝)(?:了|的)|\b(?:meal|food|calorie|breakfast|lunch|dinner|snack|food diary|nutrition log)\b/iu;
const mealAction = "补记|记(?:录|下|上|入|进|到|一下|餐)|添加|加(?:入|到|进|上)|(?:写|存|放)(?:入|进|到)";
const mealWrite = new RegExp(`(?:^|[，,。；;！!\\n]\\s*|帮我|替我|给我|请|麻烦(?:你)?|我(?:想|要|需要))\\s*(?:把[^。！？；;\\n]{1,80})?\\s*(?:${mealAction})`, "u");
const directMealWrite = /(?:^|[，,。；;！!\n]\s*|帮我|替我|给我|请|我要|我想)\s*记\s*(?:(?:今天|昨天|刚才)的?\s*)?(?:饮食|[早午晚]餐|加餐|[早午晚]饭|这(?:一)?顿)/u;
const englishMealWrite = /^(?:(?:please|(?:could|can|would) you|help me|i (?:want|need) (?:you )?to)\s+)*(?:log|record|save|add)\b/iu;
const politeMealWrite = /(?:帮我|替我|给我|麻烦(?:你)?|请)|^(?:please|could you|can you|would you)\b/iu;

export function cancelsMealLogging(text: string) {
  return mealCancellation.test(text.normalize("NFKC").trim());
}

export function asksToLogMeal(text: string) {
  const request = text.normalize("NFKC").trim();
  return !cancelsMealLogging(request) && !noMealWrite.test(request) && !mealHypothetical.test(request) &&
    !/^(?:取消|撤销|删除|怎样|怎么|如何|我该|我应该|你说|举例|查(?:看)?|看(?:看|一下)|\b(?:cancel|undo|delete|what|why|how)\b)/iu.test(request) &&
    !/(?:记过了吗|记了吗|加过了吗|加好了吗|记完了吗|记录在哪|\b(?:did you|did i|have you)\b)/iu.test(request) &&
    (!/[?？]|吗[。.!！]*$/u.test(request) || politeMealWrite.test(request)) &&
    mealNoun.test(request) && (mealWrite.test(request) || directMealWrite.test(request) || englishMealWrite.test(request));
}

const reportTime = String.raw`(?:前天|昨[天晚夜日]|今[天早晚日]|现在|早上|上午|中午|下午|晚上|夜里|[早午晚][餐饭]|加餐|[12]\d{3}[-年]\d{1,2}[-月]\d{1,2}[日号]?|\d{1,2}月\d{1,2}[日号]?)`;
const chineseMealReport = new RegExp(
  String.raw`^(?:我(?:自己)?\s*)?(?:(?:的?\s*${reportTime})\s*[,，]?\s*)*(?:我(?:自己)?\s*)?(?:(?:只|又)\s*)?(?:(?:刚(?:才|刚)?|才)\s*[吃喝](?:完)?(?:了)?|(?:已经\s*)?[吃喝](?:完)?了)\s*(.+)$`,
  "su",
);
const englishMealReport = /^(?:(?:today|yesterday|this (?:morning|afternoon|evening)|last night)[,\s]+)?i\s+(?:just\s+)?(?:ate|drank)\s+([\s\S]+)$/iu;
const mealReportDiscussion = /[?？]|(?:能不能|可不可以|会不会|适不适合|有没有|怎么样|合不合适|该不该|怎么办|要不要|建议|该怎么|如何|热量多少|多少(?:热量|千卡|卡路里)|吗[。.!！\s]*$)|\b(?:should i|would it|is that|how (?:many|much)|what if|can i|will it)\b/iu;
const nonFoodObject = /^(?:(?:[零一二两三四五六七八九十百半\d.]+\s*)?(?:颗|粒|片|剂|个|口|次)\s*)?(?:药(?:物|片|丸|了|\s|[。.!！]|$)|维生素(?:片|软糖)|抗生素|止痛药|退烧药|亏|苦头|闭门羹|官司|哑巴亏|西北风|[“「『"‘'])/u;

export function reportsEatenMeal(text: string) {
  const report = text.normalize("NFKC").trim();
  if (cancelsMealLogging(report) || noMealWrite.test(report) || mealHypothetical.test(report) || mealReportDiscussion.test(report)) return false;
  const food = (report.match(chineseMealReport) ?? report.match(englishMealReport))?.[1];
  return Boolean(food && /\p{L}/u.test(food) && !nonFoodObject.test(food));
}

const priorMealReference = /^(?:(?:请|麻烦(?:你)?)\s*)?(?:(?:帮|替|给)我\s*)?(?:把\s*(?:它|这个|这(?:一)?顿(?:饭)?|刚才那(?:一)?顿|刚才那(?:一)?餐)\s*)?(?:(?:添加|加|记|录|补记|记录)(?:进(?:去|到)?|入|到|上|下|一下)?\s*(?:(?:我(?:的)?\s*)?(?:饮食(?:日记|日志|记录)?|餐食(?:记录)?|日记|日志)(?:里|里面|中)?|这(?:一)?餐|刚才那(?:一)?顿|刚才那(?:一)?餐)?|(?:给|替)我记)(?:吧|一下)?[。.!！]*$/u;
const explicitMealReference = /进去|饮食|餐食|日记|日志|这(?:一)?餐|这(?:一)?顿|刚才|这(?:一)?个|它/u;
const englishMealReference = /^(?:(?:please|can you|could you|would you|help me)\s+)*(?:log|record|save|add)\s+(?:it|that|this meal|that meal|the last meal)(?:\s+(?:to|in)\s+(?:my |the )?(?:food diary|nutrition log|meal log))?[.!?]*$/iu;

export function asksToAddReportedMeal(text: string) {
  const request = text.normalize("NFKC").trim();
  return englishMealReference.test(request) ||
    (explicitMealReference.test(request) && priorMealReference.test(request));
}

export function continuesMealLogging(text: string) {
  const reply = text.normalize("NFKC").trim();
  if (cancelsMealLogging(reply) || noMealWrite.test(reply) || mealHypothetical.test(reply) || /[?？]|(?:怎么|如何|建议|应该|能吃|适合吃|值不值|是什么|多少热量|热量多少|吗[。.!！]?$)/u.test(reply)) return false;
  if (!mealNoun.test(reply) && /(?:训练|体重|锻炼|运动|健身|卧推|深蹲|硬拉|心率|步数|跑步|\b(?:workout|exercise|weigh|training)\b)/iu.test(reply)) return false;
  return /^(?:就这些|就那两样|就这(?:些|两样)|只有这些|没(?:有)?别的(?:了)?|没(?:有)?其他(?:的)?(?:了)?|对(?:的)?|是的|嗯|好(?:的)?|确认|没错|对了|可以|按(?:常见|估算)|就按|that['’]s (?:all|it)|yes|correct)(?:[。.!！\s]|$)/iu.test(reply) ||
    /(?:早餐|午餐|晚餐|加餐|中午|今早|上午|下午|晚上|昨[天晚]|前天|今天|刚才|刚刚|吃(?:了|的)|喝(?:了|的)|\d{1,4}[年月日\-/]|[一二两三四五六七八九十半\d]+\s*(?:个|枚|杯|碗|勺|份|块|包|克|毫升)|\b(?:breakfast|lunch|dinner|snack|today|yesterday|grams?|ml)\b)/iu.test(reply);
}
