import Foundation

@main
struct NativeProductHelpSmoke {
    static func main() throws {
        let data = try Data(contentsOf: URL(fileURLWithPath: "cloudflare/shared/product-help.json"))
        let catalogue = try JSONDecoder().decode(NativeProductHelp.Catalogue.self, from: data)
        precondition(Set(catalogue.topics.map(\.id)).count == catalogue.topics.count)
        precondition(catalogue.topics.allSatisfy { !$0.ios.isEmpty && !$0.aliases.isEmpty })
        let help = NativeProductHelp.Index(catalogue)

        precondition(help.reply(to: "怎么用训练搭子？")?.contains("高亮按钮") == true)
        precondition(help.reply(to: "我在哪重新看引导？")?.contains("关于与更新") == true)
        precondition(help.reply(to: "怎么添加训练计划？")?.contains("我的计划」→「新建计划") == true)
        precondition(help.reply(to: "我在网页上怎么添加训练计划？")?.contains("· 网页版") == true)
        precondition(help.reply(to: "从哪添加官方模板？")?.contains("功能模块") == true)
        precondition(help.reply(to: "那饮食呢？", previousQuestion: "怎么用训练搭子？")?.contains("记录正餐") == true)
        precondition(help.reply(to: "那网页版呢？", previousQuestion: "那饮食呢？")?.contains("· 网页版") == true)
        precondition(help.reply(to: "那饮食呢？") == nil)
        precondition(help.reply(to: "好友怎么加？")?.contains("联系人") == true)
        precondition(help.reply(to: "怎么提高平均心率？", previousQuestion: "官方模板在哪？") == nil)
        precondition(help.reply(to: "午餐该吃多少？", previousQuestion: "官方模板在哪？") == nil)
        precondition(help.reply(to: "如何连接自己的 ＡＩ Agent？")?.contains("新建 Agent 连接") == true)
        precondition(help.reply(to: "用自己的 AI 的教学在哪？")?.contains("使用教学") == true)
        precondition(help.reply(to: "怎么复制提示词？")?.contains("MCP、OpenAPI") == true)
        precondition(help.reply(to: "怎么删除个人模板？")?.contains("解除关联") == true)
        precondition(help.reply(to: "怎么改个人模板的名字？")?.contains("… → 改名") == true)
        precondition(help.reply(to: "跟练链接在哪？")?.contains("待训练") == true)
        precondition(help.reply(to: "怎么用外部 Agent 改模板？")?.contains("当前版本") == true)
        precondition(help.reply(to: "怎么上传动作 GIF？")?.contains("768 KiB") == true)
        precondition(help.reply(to: "怎么更换头像？")?.contains("保存头像") == true)
        precondition(help.reply(to: "在哪里授权 Apple 健康？")?.contains("手表与健康") == true)
        precondition(help.reply(to: "训练搭子里的航班预订入口在哪里？")?.contains("暂时没有") == true)

        for question in ["我午餐吃了两个汤圆，帮我记一下", "帮我记午餐，然后告诉我在哪里改昵称", "如何提高平均心率", "怎么增加体重", "怎么练跑步耐力", "给我做个训练计划", "帮我删除个人模板"] {
            precondition(help.reply(to: question) == nil, "Expected coaching or record flow for \(question)")
        }
        print("PASS native product help: shared catalogue, routed answers, short follow-ups and write intent isolation")
    }
}
