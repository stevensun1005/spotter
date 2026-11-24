import assert from "node:assert/strict";
import { test } from "node:test";
import { asksForTrainingPlan } from "../features/ai-coach/chat-intent.ts";

test("Chinese training plan requests enter the conversation drafting flow", () => {
  for (const message of [
    "生成计划",
    "我今天想练上半身，只有30分钟",
    "帮我排30分钟的上半身",
    "我要排个训练计划",
    "帮我做个每周三练的增肌计划",
    "给我生成一个 4 周增肌计划，不要饮食",
    "我想排个四周计划",
    "能不能帮忙做一个训练计划",
    "你可以生成我的训练计划吗",
    "给我安排下周训练",
    "帮我把下周的训练排一下",
    "教练，能帮我定制一个健身方案吗？",
    "我想要一份适合初学者的力量训练计划",
    "给我一份增肌训练计划",
    "帮我做一份不需要器械的训练计划",
    "我每周可以练三天。请帮我排个训练计划！",
    "不要给我写饮食计划，帮我制定下周的训练计划",
  ]) assert.equal(asksForTrainingPlan(message), true, message);
});

test("English training plan requests enter the conversation drafting flow", () => {
  for (const message of [
    "Please create a workout plan.",
    "Can you make me a 4-week lifting plan?",
    "I'd like a beginner gym routine.",
    "I want you to put together a strength training program.",
    "I want you to help me plan my workouts.",
    "Could you plan my workouts for next week?",
    "Help me come up with a training plan.",
  ]) assert.equal(asksForTrainingPlan(message), true, message);
});

test("questions, negation, critiques and unrelated plans stay in free chat", () => {
  for (const message of [
    "怎么安排两天训练？",
    "训练计划需要热身吗？",
    "我想了解怎么生成训练计划",
    "帮我看看这个训练计划怎么样",
    "我想优化一下现有的训练计划",
    "我要看看现有的训练计划",
    "帮我把训练计划排一下顺序",
    "我想分享一个训练计划",
    "我想让你帮我看看训练计划",
    "生成一个训练计划的分析",
    "一份适合初学者的训练计划",
    "先不用生成计划，讲讲组间休息",
    "别给我做训练计划",
    "帮我做个增肌饮食计划",
    "帮我制定学习计划",
    "帮我做个钢琴练习计划",
    "先练胸还是先练背？",
    "How can I make a training plan?",
    "Could you explain how to build a training plan?",
    "I want to know how to create a workout plan.",
    "Can you review my workout plan?",
    "Write a review of a training plan.",
    "Please don't make a workout plan.",
    "I'd like not to make a workout plan.",
    "Make me a meal plan for gym days.",
    "I did that workout yesterday.",
  ]) assert.equal(asksForTrainingPlan(message), false, message);
});
