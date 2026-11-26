import productHelp from "@/shared/product-help.json" with { type: "json" };
import { asksForTrainingPlan, asksToLogMeal } from "./chat-intent";

const location = /(?:在哪|哪里|哪儿|从哪|入口|教程|使用引导|新手引导|路径|哪[个一]页|点哪|按哪|怎么点)|\b(?:where|walk me through|step by step)\b/u;
const how = /(?:怎么|如何|怎样|教我)|\b(?:how|show me how)\b/u;
const appName = /(?:训练搭子|这个\s*(?:软件|应用|app)|应用里|软件里|app\s*[里内上]|网页版|苹果手表版)|\b(?:spotter|(?:this|the) app|in app|the website)\b/u;
const uiAction = /(?:使用|打开|进入|切换|找到|查看|查询|添加|导入|导出|连接|绑定|同步|授权|设置|修改|更改|分享|关闭|开启|删除|提醒|记录|记餐|记下|记(?:早餐|午餐|晚餐|饮食|体重|饭|水|训练)|取消|停用|管理|发给|编辑|新增|保存|打卡|打气|拍照|查找|找(?:动作|搭子|好友|计划|入口)|看|加(?:好友|搭子|计划|餐|食物|器械|备注)|(?:开|关)(?:通知|推送)|(?:改|换)(?:昵称|头像|名字|用户名|tag|日期|训练日期|备注)|复制\s*(?:提示词|prompt|连接令牌)|改(?:个人)?模板|上传(?:动作\s*)?gif|移除(?:动作\s*gif|演示动图|备注)|(?:好友|搭子)备注)|\b(?:use|open|find|see|view|check|add|import|export|connect|link|sync|allow|change|edit|share|enable|disable|delete|log|record|save)\b/u;
const shortNavigation = /(?:怎么|如何|怎样)(?:找|点|加|删|改|设|开|关|用|进|记|看)(?:[啊呀吗呢])?[。.!?]*$/u;
const coachingQuestion = /(?:如何|怎样|怎么)(?:给自己|为自己|科学地|合理地)?(?:安排|编排|制定|训练|练|增肌|增加|降低|减少|控制|减脂|减肥|改善|提高|选择|计算|评估)|\bhow (?:to |(?:can|do|should) (?:i|we) )?(?:train|build muscle|lose weight|improve|calculate)\b/u;
const genericOverview = /^(?:(?:这个)?(?:app|应用|软件|训练搭子|spotter))?(?:怎么用|怎么使用|如何使用|怎样使用)(?:这个(?:app|应用|软件)|训练搭子|spotter)?$/u;
const appCapabilities = /(?:有什么|有哪些|包含哪些|可以做什么|能做什么|支持什么)(?:功能)?|\bwhat (?:can|does) (?:this|the) app (?:do|support)\b/u;
const productNamePrefix = /训练搭子(?=\s*(?:网(?:页|站)|软件|应用|里面|里|[中内上]|的|app))/gu;
const sentenceEnd = /[?!.。]+$/gu;
const directAction = /^(?:再|就|先|顺便|也|然后|并|还要)?\s*(?:(?:帮|替|给)我|麻烦(?:你)?|请(?:你)?|我(?:要|想让你)|please\b|(?:can|could) you\b)\s*(?:直接\s*)?(?:把|加|补记|记|保存|删|导入|修改|更改|生成|create\b|record\b|log\b|save\b|add\b|delete\b|import\b)/u;

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

function compact(value: string) {
  return value.replace(/\s+/gu, "");
}

const topicsByAlias = productHelp.topics
  .flatMap((topic) => [topic.title, ...topic.aliases].map((label) => {
    const alias = normalize(label);
    const pattern = /^[a-z\d][a-z\d -]*[a-z\d]$/u.test(alias)
      ? new RegExp(`\\b${alias.replace(/[- ]+/gu, "[ -]+")}\\b`, "u")
      : undefined;
    return { topic, alias: compact(alias), pattern };
  }))
  .filter(({ alias }) => alias.length > 0)
  .sort((a, b) => b.alias.length - a.alias.length);

const overviewAliases = new Set(productHelp.overviewAliases.map((alias) => compact(normalize(alias)).replace(sentenceEnd, "")));

export function productHelpReply(message: string) {
  const question = normalize(message);
  if (!question) return;
  const asksAboutApp = appName.test(question);
  const overviewQuestion = compact(question).replace(sentenceEnd, "");
  const overview = overviewAliases.has(overviewQuestion) || genericOverview.test(overviewQuestion) || asksAboutApp && appCapabilities.test(question);
  const hasNavigation = (part: string) => location.test(part) || shortNavigation.test(part) ||
    how.test(part) && uiAction.test(part);
  if (!overview && (!hasNavigation(question) || !asksAboutApp && !location.test(question) && coachingQuestion.test(question))) return;
  const clauses = question.split(/[。;!?，,\n]+|(?=顺便|也帮我|并帮我|再帮我|然后帮我)/u);
  if (clauses.some((part) => {
    const clause = part.trim();
    return asksToLogMeal(clause) || asksForTrainingPlan(clause) || !hasNavigation(clause) && directAction.test(clause);
  })) return;

  const subject = question.replace(productNamePrefix, "");
  const compactSubject = compact(subject);
  const match = !overview && topicsByAlias.find(({ alias, pattern }) => pattern ? pattern.test(subject) : compactSubject.includes(alias));
  if (match) {
    const web = match.topic.web?.length ? match.topic.web : undefined;
    const steps = web ?? match.topic.ios;
    return `「${match.topic.title}」在${web ? "网页版" : "iPhone App"}这样用：\n` +
      steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  }

  if (!overview && !asksAboutApp) return;
  const examples = productHelp.topics.slice(0, 8).map(({ title }) => `「${title}」`).join("、");
  return overview ? `你可以问我训练搭子的使用方法，例如${examples}。想先了解哪个功能？`
    : `我还没找到这个功能的使用说明。你可以告诉我界面名称，或问我${examples}的入口。`;
}
