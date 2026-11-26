import Foundation

enum NativeProductHelp {
    struct Catalogue: Decodable {
        struct Topic: Decodable {
            let id: String
            let title: String
            let aliases: [String]
            let ios: [String]
            let web: [String]?
        }

        let overviewAliases: [String]
        let topics: [Topic]
    }

    struct Index {
        private struct Alias {
            let text: String
            let topic: Catalogue.Topic
        }

        private enum Match { case overview, topic(Catalogue.Topic), unknown }

        private let aliases: [Alias]
        private let overview: Set<String>
        private static let routePhrases = ["在哪", "哪里", "哪儿", "从哪", "入口", "教程", "怎么点", "点哪个", "哪个按钮", "底栏", "设置里", "搭子和好友有什么区别", "where", "whichbutton"]
        private static let questions = ["怎么", "如何", "怎样", "教我", "带我", "howto", "howdo"]
        private static let interfaceActions = ["打开", "记录", "添加", "导入", "授权", "查看", "使用", "绑定", "连接", "设置", "开启", "关闭", "筛选", "保存", "开始训练", "删除计划", "改昵称", "改头像", "换头像", "更换头像", "改用户名", "加好友", "找搭子", "打气", "拍照", "同步", "排期", "操作", "怎么弄", "怎么记", "open", "add", "import", "record", "log", "connect", "enable", "use",
                                               "复制提示词", "复制prompt", "复制连接令牌", "编辑模板", "编辑个人模板", "修改模板", "修改个人模板",
                                               "改模板", "改个人模板", "删除模板", "删除个人模板", "上传动作gif", "上传gif", "移除动作gif", "移除演示动图",
                                               "加备注", "改备注", "编辑备注", "移除备注", "删除备注", "好友备注", "搭子备注",
                                               "约下次训练", "约搭子训练", "约训练", "训练邀约", "删除好友", "移除好友", "删好友"]
        private static let product = ["训练搭子", "spotter", "这个app", "这个应用", "这个软件", "app里", "应用里", "软件里"]
        private static let followUps = ["那", "还有", "以及", "接着", "另外", "and", "whatabout"]
        private static let shortRouteQuestions = ["怎么加", "怎么进", "怎么开", "怎么看", "怎么找", "怎么改", "怎么用"]
        private static let web = ["网页版", "网页端", "网页上", "网站上", "浏览器", "cloudflare"]
        private static let writeRequest = #"(?:^|然后|顺便|再)(?:请|先|麻烦)?(?:帮我|替我|给我|直接)(?:把|记|添加|保存|导入|写入|删除|修改)"#

        init(_ catalogue: Catalogue) {
            overview = Set(catalogue.overviewAliases.map(Self.normalize))
            aliases = catalogue.topics.flatMap { topic in
                (topic.aliases + [topic.title]).map { Alias(text: Self.normalize($0), topic: topic) }
            }.filter { !$0.text.isEmpty }.sorted { $0.text.count > $1.text.count }
        }

        func reply(to question: String, previousQuestion: String? = nil) -> String? {
            let current = Self.normalize(question)
            guard !current.isEmpty, current.count <= 1000,
                  current.range(of: Self.writeRequest, options: .regularExpression) == nil else { return nil }
            let prior = previousQuestion.map(Self.normalize)
            var match = matchExplicit(current)
            if match == nil, let prior, let previousMatch = matchExplicit(prior) ?? findTopic(in: prior).map(Match.topic),
               let subject = followUpSubject(current, question: question) {
                if let alias = aliases.first(where: { $0.text == subject }) { match = .topic(alias.topic) }
                else if Self.web.contains(subject), case .topic = previousMatch { match = previousMatch }
            }
            guard let match else { return nil }
            switch match {
            case .overview:
                return """
                想做什么？我可以告诉你从哪里进、点哪个按钮。可以问我：
                • 怎么添加训练计划或套用官方模板？
                • 怎么拍照记餐或设置常用餐？
                • 怎么按用户名找搭子？
                • 怎么连 Apple 健康或开启通知？
                • 怎么添加小组件或接入自己的 Agent？
                想跟着屏幕上的高亮按钮操作，打开「设置 → 关于与更新 → 重新查看使用引导」。
                """
            case .topic(let topic):
                let wantsWeb = Self.web.contains(where: current.contains) ||
                    (!matchIsExplicit(current) && prior.map { prior in Self.web.contains(where: prior.contains) } == true)
                let webSteps = wantsWeb ? topic.web : nil
                let surface = webSteps == nil ? "iPhone App" : "网页版"
                let steps = (webSteps ?? topic.ios).enumerated().map { "\($0.offset + 1). \($0.element)" }.joined(separator: "\n")
                return "\(topic.title) · \(surface)\n\n\(steps)"
            case .unknown:
                return "我暂时没有这个功能的操作步骤。你可以告诉我想完成什么，比如添加计划、拍照记餐或找搭子，我会给你对应的入口。"
            }
        }

        private func matchExplicit(_ text: String) -> Match? {
            if overview.contains(text) { return .overview }
            guard matchIsExplicit(text) else { return nil }
            if let topic = findTopic(in: text) { return .topic(topic) }
            return Self.product.contains(where: text.contains) ? .unknown : nil
        }

        private func matchIsExplicit(_ text: String) -> Bool {
            Self.routePhrases.contains(where: text.contains) || Self.shortRouteQuestions.contains(where: text.hasSuffix) ||
                (Self.questions.contains(where: text.contains) &&
                (Self.interfaceActions.contains(where: text.contains) || Self.product.contains(where: text.contains)))
        }

        private func findTopic(in text: String) -> Catalogue.Topic? {
            let search = text.replacingOccurrences(of: "训练搭子里", with: "").replacingOccurrences(of: "spotter里", with: "")
            return aliases.first { search.contains($0.text) }?.topic
        }

        private func followUpSubject(_ normalized: String, question: String) -> String? {
            guard normalized.count <= 28 else { return nil }
            let text = question.trimmingCharacters(in: .whitespacesAndNewlines)
            let prefix = Self.followUps.first(where: normalized.hasPrefix)
            guard prefix != nil || normalized.hasSuffix("呢") || text.hasSuffix("？") || text.hasSuffix("?") else { return nil }
            let subject = normalized.dropFirst(prefix?.count ?? 0)
            return String(subject.hasSuffix("呢") ? subject.dropLast() : subject)
        }

        private static func normalize(_ text: String) -> String {
            let characters = text.precomposedStringWithCompatibilityMapping.lowercased().unicodeScalars
            return String(String.UnicodeScalarView(characters.filter { CharacterSet.alphanumerics.contains($0) }))
        }
    }

    private static let index: Index? = {
        guard let url = Bundle.main.url(forResource: "product-help", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let catalogue = try? JSONDecoder().decode(Catalogue.self, from: data) else { return nil }
        return Index(catalogue)
    }()

    static func reply(to question: String, previousQuestion: String? = nil) -> String? {
        index?.reply(to: question, previousQuestion: previousQuestion)
    }
}
