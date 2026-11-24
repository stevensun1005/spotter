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
