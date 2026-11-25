import SwiftUI

enum NativeWelcomeDestination: Equatable {
    case home, officialTemplates, nutrition, friends
}

@MainActor
struct NativeWelcomeView: View {
    private enum Page: Int, CaseIterable {
        case permissions, plans, nutrition, friends, next

        var name: String {
            switch self {
            case .permissions: return "权限设置"
            case .plans: return "训练计划"
            case .nutrition: return "饮食记录"
            case .friends: return "搭子与好友"
            case .next: return "开始使用"
            }
        }

        var practice: Practice? {
            switch self {
            case .permissions, .next: return nil
            case .plans:
                return Practice(
                    title: "把一周训练排进日历",
                    route: "底部「训练」→ 顶部「官方模板」",
                    steps: [
                        .init("官方模板", "square.grid.2x2", "先选训练目标，再选初级、中级或高级。"),
                        .init("打开一周训练示例", "calendar", "查看每天安排，例如周一练全身、周三练全身、周六练全身，其余日子可以休息。"),
                        .init("使用这个模板", "calendar.badge.plus", "选「周期开始日」，再使用模板。你还可以在训练周期中调整排期。"),
                        .init("保存并预览排期", "checklist", "核对日期再确认，课程会出现在「我的计划」和首页训练日程。训练当天打开课程，填重量和次数，勾选完成的组。结束后可在「统计 → 打卡历史」回看。")
                    ],
                    outcome: "有自己的安排？到「我的计划」点「新建计划」。已有文字或链接可选「添加计划 → 粘贴已有内容」。"
                )
            case .nutrition:
                return Practice(
                    title: "试着从首页记一顿早餐",
                    route: "底部「今日」→「饮食记录」",
                    steps: [
                        .init("记录正餐", "fork.knife", "这个按钮会打开早餐、午餐和晚餐选择。"),
                        .init("早餐", "sun.horizon", "可以选最近记过的食物，或者手动输入食物名称。"),
                        .init("燕麦 · 40 克", "scalemass", "核对食物和份量。手动添加时也可以填写热量和营养。"),
                        .init("保存", "checkmark", "保存后，这顿饭会出现在当天饮食记录，首页的热量和营养统计也会更新。")
                    ],
                    outcome: "「拍照记录」可直接打开相机。零食用「加餐」，喝水用「饮水」。常吃的组合可以存到「常用餐」，之后点一下就能记。"
                )
            case .friends:
                return Practice(
                    title: "添加搭子，决定共享内容",
                    route: "底部「好友」→「联系人」",
                    steps: [
                        .init("找搭子", "person.2", "如果只是添加普通好友，在同一页点「添加好友」，也可以用邀请链接。"),
                        .init("搜索 spotter#1234", "magnifyingglass", "输入对方的用户名或完整的用户名#编号。用户名搜索默认开启，也可以在「权限设置」关闭。"),
                        .init("发送申请", "paperplane", "对方接受后，名字会显示在「联系人」，有打卡时可在「朋友圈」看对方共享的动态。"),
                        .init("查看共享范围", "lock.shield", "在「权限设置」查看朋友圈权限，点某位联系人可以单独调整共享范围。")
                    ],
                    outcome: "新搭子申请和接受时会分别核对饮食共享，默认勾选，可以取消。普通好友的饮食状态和详情默认私密。已有关系继续使用各自保存的分享范围。身体测量和原始心率属于私密数据。"
                )
            }
        }
    }

    private struct Practice {
        let title: String
        let route: String
        let steps: [Step]
        let outcome: String

        struct Step {
            let button: String
            let symbol: String
            let explanation: String

            init(_ button: String, _ symbol: String, _ explanation: String) {
                self.button = button
                self.symbol = symbol
                self.explanation = explanation
            }
        }
    }

    private struct Goal: Identifiable, Equatable {
        let title: String
        let symbol: String
        let id: String
    }

    private static let goals = [
        Goal(title: "增肌塑形", symbol: "dumbbell", id: "hypertrophy"),
        Goal(title: "提高力量", symbol: "bolt", id: "strength"),
        Goal(title: "体能与活动", symbol: "figure.run", id: "conditioning"),
        Goal(title: "建立训练习惯", symbol: "calendar.badge.checkmark", id: "general"),
    ]

    let permissionOnboarding: NativePermissionOnboarding
    let showsOfficialTemplates: Bool
    let showsNutrition: Bool
    let showsFriends: Bool
    let startCoach: (String) -> Void
    let finish: (NativeWelcomeDestination) -> Void

    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var page = Page.permissions
    @State private var stage = 0
    @State private var goal: Goal?

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                pageContent
                    .frame(maxWidth: 510)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 20)
                    .frame(maxWidth: .infinity)
            }
            .id(page)
            footer
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .foregroundStyle(SpotterPalette.ink)
    }

    private var header: some View {
        VStack(spacing: 10) {
            HStack(spacing: 9) {
                if page != .permissions {
                    Button {
                        if let previous = Page(rawValue: page.rawValue - 1) { changePage(to: previous) }
                    } label: {
                        Image(systemName: "chevron.left").frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("上一步")
                    .spotterGlass(in: Circle())
                } else {
                    Image(systemName: "figure.strengthtraining.traditional")
                        .font(.headline)
                        .frame(width: 44, height: 44)
                        .foregroundStyle(accent.tint)
                        .accessibilityHidden(true)
                }
                Text("使用引导").font(.subheadline.weight(.semibold))
                Spacer()
                Button("跳过引导") { finish(.home) }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(SpotterPalette.muted)
                    .frame(minHeight: 44)
            }
            ProgressView(value: Double(page.rawValue + 1), total: Double(Page.allCases.count))
                .animation(motion, value: page)
                .accessibilityLabel("第 \(page.rawValue + 1) 步，共 \(Page.allCases.count) 步，\(page.name)")
        }
        .padding(.horizontal, 22)
        .padding(.top, 5)
    }

    @ViewBuilder private var pageContent: some View {
        if page == .permissions {
            VStack(alignment: .leading, spacing: 16) {
                heading("欢迎来到训练搭子", detail: "先按需开启权限，接下来跟着引导试一遍排训练、记饮食和添加朋友。")
                NativePermissionSetup(controller: permissionOnboarding)
            }
        } else if let practice = page.practice {
            practicePage(practice)
        } else {
            startPage
        }
    }

    private func heading(_ title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.largeTitle.weight(.heavy)).accessibilityAddTraits(.isHeader)
            Text(detail).font(.subheadline).foregroundStyle(SpotterPalette.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func practicePage(_ practice: Practice) -> some View {
        VStack(alignment: .leading, spacing: 15) {
            heading(practice.title, detail: practice.route)
            VStack(alignment: .leading, spacing: 12) {
                Label("跟着点 · 示例练习", systemImage: "hand.tap")
                    .font(.subheadline.weight(.semibold))
                if stage > 0 {
                    let previous = practice.steps[stage - 1]
                    Label(previous.button, systemImage: "checkmark.circle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(accent.tint)
                    Text(previous.explanation)
                        .font(.subheadline)
                        .foregroundStyle(SpotterPalette.muted)
                        .accessibilityIdentifier("spotter-guide-practice-feedback")
                }
                if stage < practice.steps.count {
                    let action = practice.steps[stage]
                    Button {
                        stage = min(stage + 1, practice.steps.count)
                    } label: {
                        HStack(spacing: 9) {
                            Image(systemName: action.symbol).frame(minWidth: 20).accessibilityHidden(true)
                            Text(action.button).multilineTextAlignment(.leading)
                            Spacer(minLength: 2)
                            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).accessibilityHidden(true)
                        }
                        .frame(maxWidth: .infinity, minHeight: 22, alignment: .leading)
                    }
                    .buttonStyle(SpotterNativeButtonStyle(primary: true))
                    .accessibilityIdentifier("spotter-guide-practice-action")
                    .accessibilityHint("体验示例中的第 \(stage + 1) 步")
                } else {
                    Label("练习完成", systemImage: "checkmark.seal.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(accent.tint)
                        .accessibilityIdentifier("spotter-guide-practice-complete")
                }
            }
            .padding(16)
            .spotterCard(radius: 18)

            Text(practice.outcome)
                .font(.subheadline)
                .foregroundStyle(SpotterPalette.muted)
                .padding(.horizontal, 2)
            if moduleHidden {
                Label("可到「设置 → 功能模块」开启本节介绍的入口。", systemImage: "gearshape")
                    .font(.footnote)
                    .foregroundStyle(SpotterPalette.muted)
            }
        }
    }

    private var moduleHidden: Bool {
        switch page {
        case .permissions, .next: return false
        case .plans: return !showsOfficialTemplates
        case .nutrition: return !showsNutrition
        case .friends: return !showsFriends
        }
    }

    private var startPage: some View {
        VStack(alignment: .leading, spacing: 14) {
            heading("现在试试真正的操作", detail: "直接打开常用入口，或让教练帮你从目标定一份计划。")
            if showsOfficialTemplates { destination("浏览官方模板", symbol: "calendar.badge.plus", value: .officialTemplates) }
            if showsNutrition { destination("打开饮食记录", symbol: "fork.knife", value: .nutrition) }
            if showsFriends { destination("查看搭子与好友", symbol: "person.2", value: .friends) }

            Divider().padding(.vertical, 2)

            Label("和 AI 教练定训练目标", systemImage: "sparkles")
                .font(.headline)
                .foregroundStyle(accent.tint)
                .accessibilityAddTraits(.isHeader)
            ForEach(Self.goals) { option in
                Button {
                    withAnimation(motion) { goal = goal == option ? nil : option }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: option.symbol).frame(minWidth: 24).foregroundStyle(accent.tint)
                        Text(option.title)
                        Spacer(minLength: 4)
                        Image(systemName: goal == option ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(goal == option ? accent.tint : SpotterPalette.muted)
                            .accessibilityHidden(true)
                    }
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 13)
                    .frame(minHeight: 48)
                    .frame(maxWidth: .infinity)
                    .background(goal == option ? accent.selection : SpotterPalette.card, in: RoundedRectangle(cornerRadius: 13))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .accessibilityAddTraits(goal == option ? .isSelected : [])
            }
        }
    }

    private func destination(_ title: String, symbol: String, value: NativeWelcomeDestination) -> some View {
        Button { finish(value) } label: {
            HStack(spacing: 10) {
                Label(title, systemImage: symbol)
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").font(.caption.weight(.semibold)).accessibilityHidden(true)
            }
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 13)
            .frame(minHeight: 48)
            .frame(maxWidth: .infinity)
            .spotterCard(radius: 13)
            .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
    }

    private var footer: some View {
        VStack(spacing: 0) {
            Button {
                if let next = Page(rawValue: page.rawValue + 1) { changePage(to: next) }
                else if let goal { startCoach(goal.id) }
                else { finish(.home) }
            } label: {
                Text(continueTitle).frame(maxWidth: .infinity, minHeight: 22)
            }
            .buttonStyle(SpotterNativeButtonStyle(primary: true))
            .accessibilityIdentifier("spotter-guide-continue")
            if page == .next && goal != nil {
                Button("先进入首页") { finish(.home) }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(SpotterPalette.muted)
                    .frame(minHeight: 44)
            }
        }
        .frame(maxWidth: 510)
        .padding(.horizontal, 22)
        .padding(.vertical, 9)
    }

    private var continueTitle: String {
        switch page {
        case .permissions: return "开始使用引导"
        case .plans, .nutrition: return "下一节"
        case .friends: return "完成练习"
        case .next: return goal == nil ? "进入训练搭子" : "和 AI 教练聊聊"
        }
    }

    private func changePage(to newPage: Page) {
        stage = 0
        page = newPage
    }
}
