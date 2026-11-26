import SwiftUI

enum NativeGuideStep: Hashable {
    enum Section: Hashable { case training, nutrition, friends, coach }
    enum Presentation: Equatable { case dock, tabContent, planEditor, mealEditor, invitation, coachPanel, agentAccess }

    case trainingTab, newPlan, planFields, officialTemplates, officialFilters
    case todayTab, mainMeal, mealChoice, mealFields
    case friendsTab, findBuddy, buddySearch, privacy, coach
    case coachMenu, agentConnect, agentTutorial

    var section: Section {
        switch self {
        case .trainingTab, .newPlan, .planFields, .officialTemplates, .officialFilters: return .training
        case .todayTab, .mainMeal, .mealChoice, .mealFields: return .nutrition
        case .friendsTab, .findBuddy, .buddySearch, .privacy: return .friends
        case .coach, .coachMenu, .agentConnect, .agentTutorial: return .coach
        }
    }

    var presentation: Presentation {
        switch self {
        case .planFields: return .planEditor
        case .mealChoice, .mealFields: return .mealEditor
        case .buddySearch: return .invitation
        case .trainingTab, .todayTab, .friendsTab, .coach: return .dock
        case .coachMenu, .agentConnect: return .coachPanel
        case .agentTutorial: return .agentAccess
        default: return .tabContent
        }
    }

    var followsTargetTap: Bool {
        switch self {
        case .planFields, .officialFilters, .mealFields, .buddySearch: return false
        default: return true
        }
    }

    var title: String {
        switch self {
        case .trainingTab: return "先去训练页"
        case .newPlan: return "打开新建计划"
        case .planFields: return "看看一份训练计划怎么填"
        case .officialTemplates: return "也可以从官方模板开始"
        case .officialFilters: return "挑符合目标的周计划"
        case .todayTab: return "回首页记一餐"
        case .mainMeal: return "打开正餐记录"
        case .mealChoice: return "试着选早餐"
        case .mealFields: return "填写食物和份量"
        case .friendsTab: return "找到你的训练搭子"
        case .findBuddy: return "打开找搭子"
        case .buddySearch: return "按用户名找人"
        case .privacy: return "查看分享权限"
        case .coach: return "让 AI 教练帮你开个头"
        case .coachMenu: return "也可以用自己的 AI"
        case .agentConnect: return "找到连接和提示词"
        case .agentTutorial: return "跟着教学配置外部 Agent"
        }
    }

    var instruction: String {
        switch self {
        case .trainingTab: return "点底部高亮的「训练」。这里能管理自己的计划、模板和动作。"
        case .newPlan: return "点「新建计划」，看看日期、动作和组次在哪填。"
        case .planFields: return "这里填计划名，下面可以选日期、填动作和组次。以后点右上角「保存」，计划就会出现在首页日程。"
        case .officialTemplates: return "点「官方模板」，里面有完整的每周训练安排。"
        case .officialFilters: return "按目标和水平筛选。以后点开模板即可查看练习日和休息日，选好开始日再排进日历。"
        case .todayTab: return "点底部「今日」。最上方的饮食卡片可以直接记餐。"
        case .mainMeal: return "点「记录正餐」。拍一张照片也能记，用同一排的「拍照记录」。"
        case .mealChoice: return "点这里的「早餐」。也可以在这排选午餐或晚餐。"
        case .mealFields: return "填食物名称和份量，有需要再填营养数据。点「下一步」继续引导。之后真正记餐时点下方「保存」。"
        case .friendsTab: return "点底部的「好友」。联系人、朋友圈和共享权限都在这里。"
        case .findBuddy: return "邀请一起练的人时点「找搭子」，加普通朋友时点旁边的「添加好友」。"
        case .buddySearch: return "填对方的用户名或完整的「用户名#数字」，搜索后就能核对结果。发送前看一眼页面上的共享范围。"
        case .privacy: return "点「权限设置」可查看朋友圈共享范围。也可以进某位联系人的资料调整对这个人的分享。"
        case .coach: return "点右侧的星星，先看看教练怎样定制计划。回到教练后，可以继续学怎么连接自己的 AI。"
        case .coachMenu: return "点高亮的教练菜单，选择「用自己的 AI」。"
        case .agentConnect: return "点「设置连接与复制提示词」，查看该给自己的 Agent 开哪些权限。"
        case .agentTutorial: return "点「使用教学」，按步骤学会连接、复制提示词和发出第一条任务。可以先看示例。"
        }
    }

    static func path(officialTemplates: Bool, nutrition: Bool, friends: Bool) -> [Self] {
        [.trainingTab, .newPlan, .planFields]
            + (officialTemplates ? [.officialTemplates, .officialFilters] : [])
            + (nutrition ? [.todayTab, .mainMeal, .mealChoice, .mealFields] : [])
            + (friends ? [.friendsTab, .findBuddy, .buddySearch, .privacy] : [])
            + [.coach, .coachMenu, .agentConnect, .agentTutorial]
    }
}

struct NativeGuideContext {
    let step: NativeGuideStep
    let number: Int
    let count: Int
    let advance: (NativeGuideStep) -> Void
    let skipSection: (NativeGuideStep) -> Void
    let close: () -> Void
}

private struct NativeGuideContextKey: EnvironmentKey {
    static let defaultValue: NativeGuideContext? = nil
}

extension EnvironmentValues {
    var spotterGuide: NativeGuideContext? {
        get { self[NativeGuideContextKey.self] }
        set { self[NativeGuideContextKey.self] = newValue }
    }
}

private struct NativeGuideAnchors: PreferenceKey {
    static let defaultValue: [NativeGuideStep: Anchor<CGRect>] = [:]

    static func reduce(value: inout Value, nextValue: () -> Value) {
        value.merge(nextValue(), uniquingKeysWith: { first, _ in first })
    }
}

private struct NativeGuideTooltipHeight: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

private struct NativeGuideTarget: ViewModifier {
    @Environment(\.spotterGuide) private var guide
    let step: NativeGuideStep

    func body(content: Content) -> some View {
        content.anchorPreference(key: NativeGuideAnchors.self, value: .bounds) { anchor in
            guide?.step == step ? [step: anchor] : [:]
        }
    }
}

extension View {
    @ViewBuilder func nativeGuideTarget(_ step: NativeGuideStep?) -> some View {
        if let step { modifier(NativeGuideTarget(step: step)) }
        else { self }
    }

    func nativeGuideLayer(_ presentation: NativeGuideStep.Presentation, leave: @escaping () -> Void = {}) -> some View {
        modifier(NativeGuideLayer(presentation: presentation, leave: leave))
    }
}

private struct NativeGuideLayer: ViewModifier {
    @Environment(\.spotterGuide) private var guide
    let presentation: NativeGuideStep.Presentation
    let leave: () -> Void

    func body(content: Content) -> some View {
        content.overlayPreferenceValue(NativeGuideAnchors.self) { anchors in
            if let guide, guide.step.presentation == presentation {
                NativeGuideSpotlight(guide: guide, target: anchors[guide.step], leave: leave)
            }
        }
    }
}

private struct NativeGuideSpotlight: View {
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @AccessibilityFocusState private var focusTitle: Bool
    @State private var showFallback = false
    @State private var contentHeight: CGFloat = 170
    let guide: NativeGuideContext
    let target: Anchor<CGRect>?
    let leave: () -> Void

    var body: some View {
        GeometryReader { geometry in
            let canvas = CGRect(origin: .zero, size: geometry.size)
            let targetFrame = target.map { geometry[$0].insetBy(dx: -4, dy: -4).intersection(canvas) }
            let hole = targetFrame.flatMap { $0.width >= 20 && $0.height >= 20 && !$0.isEmpty ? $0 : nil }
            if let hole {
                let above = hole.midY > canvas.midY
                let space = max(0, (above ? hole.minY : canvas.maxY - hole.maxY) - 13)
                ZStack {
                    scrims(canvas: canvas, hole: hole)
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(accent.fill, lineWidth: 2)
                        .frame(width: hole.width, height: hole.height)
                        .position(x: hole.midX, y: hole.midY)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                    if space >= 110 {
                        tooltip(space: space, anchored: true)
                            .padding(.horizontal, 12)
                            .frame(width: canvas.width, height: space, alignment: above ? .bottom : .top)
                            .position(x: canvas.midX, y: above ? space / 2 : canvas.maxY - space / 2)
                    } else {
                        fallbackTooltip
                    }
                }
            } else if showFallback {
                fallbackTooltip
            }
        }
        .task(id: guide.step) {
            showFallback = false
            focusTitle = true
            do {
                try await Task.sleep(for: .milliseconds(500))
                showFallback = true
            } catch {}
        }
        .animation(motion, value: guide.step)
    }

    private var fallbackTooltip: some View {
        VStack {
            Spacer(minLength: 0)
            tooltip(space: 210, anchored: false)
                .padding(12)
        }
    }

    private func scrims(canvas: CGRect, hole: CGRect) -> some View {
        let strips = [
            CGRect(x: 0, y: 0, width: canvas.width, height: hole.minY),
            CGRect(x: 0, y: hole.maxY, width: canvas.width, height: canvas.height - hole.maxY),
            CGRect(x: 0, y: hole.minY, width: hole.minX, height: hole.height),
            CGRect(x: hole.maxX, y: hole.minY, width: canvas.width - hole.maxX, height: hole.height)
        ]
        return ForEach(strips.indices, id: \.self) { index in
            let rect = strips[index]
            Rectangle()
                .fill(.black.opacity(0.42))
                .frame(width: rect.width, height: rect.height)
                .contentShape(Rectangle())
                .position(x: rect.midX, y: rect.midY)
                .onTapGesture {}
                .allowsHitTesting(guide.step.followsTargetTap || guide.step == .officialFilters)
                .accessibilityHidden(true)
        }
    }

    private func tooltip(space: CGFloat, anchored: Bool) -> some View {
        let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
        return ScrollView {
            tooltipContent(anchored: anchored)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background {
                    GeometryReader { geometry in
                        Color.clear.preference(key: NativeGuideTooltipHeight.self, value: geometry.size.height)
                    }
                }
        }
        .scrollDisabled(contentHeight <= space)
        .scrollIndicators(.hidden)
        .onPreferenceChange(NativeGuideTooltipHeight.self) { height in
            if height > 0, abs(contentHeight - height) > 1 { contentHeight = height }
        }
        .frame(height: min(space, contentHeight))
        .frame(maxWidth: 370)
        .background(SpotterPalette.card, in: shape)
        .clipShape(shape)
        .overlay { shape.strokeBorder(accent.tint.opacity(0.32)).allowsHitTesting(false) }
        .shadow(color: .black.opacity(0.22), radius: 12, y: 4)
        .frame(maxWidth: .infinity)
    }

    private func tooltipContent(anchored: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("使用引导 \(guide.number)/\(guide.count)")
                    .font(.caption.weight(.semibold)).foregroundStyle(accent.tint)
                Spacer(minLength: 4)
                Button {
                    guide.close()
                    leave()
                } label: {
                    Image(systemName: "xmark").font(.caption.weight(.semibold))
                        .frame(width: 44, height: 38)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .accessibilityLabel("结束使用引导")
                .accessibilityIdentifier("spotter-guide-close")
            }
            Text(guide.step.title).font(.headline)
                .accessibilityAddTraits(.isHeader)
                .accessibilityFocused($focusTitle)
                .accessibilityIdentifier(anchored ? "spotter-guide-spotlight" : "spotter-guide-fallback")
            Text(guide.step.instruction).font(.subheadline).foregroundStyle(SpotterPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                if guide.step.section != .coach {
                    Button("跳过本节") {
                        guide.skipSection(guide.step)
                        leave()
                    }
                    .buttonStyle(.spotterPress)
                    .font(.caption.weight(.semibold))
                    .frame(minHeight: 44)
                }
                Spacer(minLength: 0)
                if !guide.step.followsTargetTap {
                    Button("下一步") {
                        guide.advance(guide.step)
                        leave()
                    }
                    .buttonStyle(.spotterPrimaryControl)
                    .accessibilityIdentifier("spotter-guide-next")
                }
            }
        }
        .foregroundStyle(SpotterPalette.ink)
        .padding(.horizontal, 14)
        .padding(.bottom, 8)
    }
}

@MainActor
struct NativeWelcomeView: View {
    let permissionOnboarding: NativePermissionOnboarding
    let begin: () -> Void
    let skip: () -> Void

    @Environment(\.spotterAccent) private var accent

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Label("训练搭子", systemImage: "figure.strengthtraining.traditional")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(accent.tint)
                Text("欢迎来到训练搭子").font(.largeTitle.weight(.heavy)).accessibilityAddTraits(.isHeader)
                Text("按需开启权限，再跟着提示试着排训练、记一餐、找搭子和连接自己的 AI。")
                    .font(.subheadline)
                    .foregroundStyle(SpotterPalette.muted)
                NativePermissionSetup(controller: permissionOnboarding)
            }
            .frame(maxWidth: 510)
            .padding(.horizontal, 22)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 4) {
                Button(action: begin) {
                    Text("开始使用引导").frame(maxWidth: .infinity, minHeight: 22)
                }
                .buttonStyle(.spotterPrimaryControl)
                .accessibilityIdentifier("spotter-guide-continue")
                Button("跳过引导", action: skip)
                    .buttonStyle(.spotterPress)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(SpotterPalette.muted)
                    .frame(minHeight: 44)
            }
            .frame(maxWidth: 510)
            .padding(.horizontal, 22)
            .padding(.top, 8)
            .frame(maxWidth: .infinity)
            .background(SpotterPalette.background)
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .foregroundStyle(SpotterPalette.ink)
    }
}
