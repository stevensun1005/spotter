import SwiftUI

struct NativeWelcomeView: View {
    private struct Feature {
        let symbol: String
        let detailSymbol: String
        let title: String
        let subtitle: String
    }

    private static let features = [
        Feature(symbol: "figure.strengthtraining.traditional", detailSymbol: "play.fill", title: "欢迎来到训练搭子",
                subtitle: "安排下一次训练，记下每一组，和搭子一起坚持。"),
        Feature(symbol: "calendar", detailSymbol: "dumbbell.fill", title: "开始第一堂训练",
                subtitle: "点底部绿色播放键开练。训练时可以记重量、次数和组间休息。"),
        Feature(symbol: "fork.knife", detailSymbol: "chart.bar.xaxis", title: "记饮食，看进度",
                subtitle: "首页可以记餐、饮水和蛋白粉。「统计」能查看训练趋势和整月打卡。"),
        Feature(symbol: "person.2.fill", detailSymbol: "heart.fill", title: "和搭子一起练",
                subtitle: "邀请好友后，可以看彼此共享的打卡并互相加油。到好友设置里选择想分享的内容。"),
    ]

    private struct Goal: Identifiable, Equatable {
        let title: String
        let symbol: String
        let coachGoal: String
        var id: String { title }
    }

    private static let goals = [
        Goal(title: "增肌塑形", symbol: "dumbbell", coachGoal: "hypertrophy"),
        Goal(title: "提高力量", symbol: "bolt", coachGoal: "strength"),
        Goal(title: "体能与活动", symbol: "figure.run", coachGoal: "conditioning"),
        Goal(title: "建立训练习惯", symbol: "calendar.badge.checkmark", coachGoal: "general"),
    ]

    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var step = 0
    @State private var goal: Goal?
    let finish: (String?) -> Void

    private var choosingGoal: Bool { step == Self.features.count }
    private var count: Int { Self.features.count + 1 }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                Group {
                    if choosingGoal { goalPage }
                    else { featurePage(Self.features[step]) }
                }
                .id(step)
                .transition(.opacity)
                .frame(maxWidth: 510)
                .padding(.horizontal, 24)
                .padding(.vertical, 18)
                .frame(maxWidth: .infinity)
            }
            .scrollIndicators(.hidden)
            footer
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .foregroundStyle(SpotterPalette.ink)
    }

    private var header: some View {
        VStack(spacing: 13) {
            HStack {
                if step > 0 {
                    Button { withAnimation(motion) { step -= 1 } } label: {
                        Image(systemName: "chevron.left").frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("上一步")
                    .spotterGlass(in: Circle())
                } else {
                    Image("DockTraining").renderingMode(.template).resizable().scaledToFit()
                        .frame(width: 22, height: 22).frame(width: 44, height: 44)
                        .foregroundStyle(accent.tint)
                        .accessibilityHidden(true)
                }
                Spacer()
                Button("跳过引导") { finish(nil) }
                    .font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                    .padding(.horizontal, 8).frame(minHeight: 44)
            }
            HStack(spacing: 6) {
                ForEach(0..<count, id: \.self) { index in
                    Capsule().fill(index <= step ? accent.tint : SpotterPalette.line).frame(height: 3)
                }
            }
            .accessibilityLabel("引导第 \(step + 1) 步，共 \(count) 步")
        }
        .padding(.horizontal, 24)
        .padding(.top, 8)
    }

    private func featurePage(_ feature: Feature) -> some View {
        VStack(alignment: .leading, spacing: 17) {
            ZStack {
                RoundedRectangle(cornerRadius: 29).fill(
                    LinearGradient(colors: [SpotterPalette.color(0x304c39), SpotterPalette.deep],
                                   startPoint: .topLeading, endPoint: .bottomTrailing))
                Circle().stroke(.white.opacity(0.12), lineWidth: 1).frame(width: 176, height: 176)
                Circle().stroke(.white.opacity(0.08), lineWidth: 1).frame(width: 218, height: 218)
                Image(systemName: feature.symbol).font(.system(size: 65, weight: .medium))
                    .foregroundStyle(accent.fill)
                Image(systemName: feature.detailSymbol).font(.system(size: 21, weight: .semibold))
                    .foregroundStyle(SpotterPalette.deep).frame(width: 54, height: 54)
                    .background(accent.fill, in: Circle()).offset(x: 82, y: 58)
            }
            .frame(height: 226)
            .clipped()
            .accessibilityHidden(true)
            Text(feature.title).font(.largeTitle.weight(.heavy)).accessibilityAddTraits(.isHeader)
            Text(feature.subtitle).font(.body).foregroundStyle(SpotterPalette.muted).lineSpacing(6)
        }
    }

    private var goalPage: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Spotter AI 教练", systemImage: "sparkles").font(.subheadline.weight(.semibold))
                .foregroundStyle(accent.tint)
            Text("你想怎么开始？").font(.largeTitle.weight(.heavy)).accessibilityAddTraits(.isHeader)
            Text("选一个目标，教练会问你有多少时间、能用哪些器械，再给你一份可以调整的计划。")
                .font(.subheadline).foregroundStyle(SpotterPalette.muted)
            ForEach(Self.goals) { option in
                Button {
                    withAnimation(motion) { goal = option }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: option.symbol).frame(width: 27).foregroundStyle(accent.tint)
                        Text(option.title).font(.body.weight(.semibold))
                        Spacer()
                        Image(systemName: goal == option ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(goal == option ? accent.tint : SpotterPalette.muted)
                    }
                    .padding(.horizontal, 14)
                    .frame(minHeight: 54)
                    .spotterGlass(cornerRadius: 15, tint: goal == option ? accent.fill.opacity(0.30) : nil)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .accessibilityAddTraits(goal == option ? .isSelected : [])
            }
        }
    }

    private var footer: some View {
        VStack(spacing: 5) {
            Button {
                if choosingGoal { finish(goal?.coachGoal) }
                else { withAnimation(motion) { step += 1 } }
            } label: {
                Text(choosingGoal ? (goal == nil ? "进入训练搭子" : "和 AI 教练聊聊") : step == 0 ? "开始了解" : "下一步")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(SpotterNativeButtonStyle(primary: true))
            if choosingGoal && goal != nil {
                Button("稍后再做计划") { finish(nil) }
                    .font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                    .frame(minHeight: 44)
            }
        }
        .frame(maxWidth: 510)
        .padding(.horizontal, 24)
        .padding(.vertical, 9)
    }
}
