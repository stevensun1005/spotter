import ActivityKit
import SwiftUI
import WidgetKit

@available(iOS 16.1, *)
struct SpotterWorkoutLiveActivity: Widget {
    private let lime = Color(red: 0.82, green: 0.96, blue: 0.48)
    private let soft = Color(red: 0.72, green: 0.82, blue: 0.74)
    private let trainingURL = URL(string: "spotter://widget/training")!

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SpotterTrainingActivityAttributes.self) { context in
            activityCard(context.state)
                .activityBackgroundTint(Color(red: 0.10, green: 0.17, blue: 0.13))
                .activitySystemActionForegroundColor(lime)
                .widgetURL(trainingURL)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("训练搭子", systemImage: "dumbbell.fill")
                        .font(.caption.weight(.semibold)).foregroundStyle(lime).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    elapsed(context.state).foregroundStyle(lime)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            nextSet(context.state)
                            Spacer(minLength: 0)
                            if #available(iOS 16.2, *), !context.isStale, let heart = context.state.visibleHeart() {
                                Label("\(heart) BPM", systemImage: "heart.fill")
                                    .font(.caption.weight(.semibold)).monospacedDigit().foregroundStyle(lime)
                                    .fixedSize(horizontal: true, vertical: false).privacySensitive()
                                    .accessibilityLabel("心率 \(heart) 次每分钟")
                            }
                        }
                        rest(context.state)
                        HStack(spacing: 8) {
                            progress(context.state)
                            if context.state.totalSets > 0 { sets(context.state) }
                        }
                    }.padding(.top, 3)
                }
            } compactLeading: {
                elapsed(context.state, compact: true)
                    .frame(width: 46, alignment: .trailing)
                    .foregroundStyle(lime)
            } compactTrailing: {
                Text("\(context.state.completedSets)/\(context.state.totalSets)")
                    .font(.caption2.weight(.semibold)).monospacedDigit().foregroundStyle(lime)
                    .lineLimit(1).minimumScaleFactor(0.7)
                    .fixedSize(horizontal: true, vertical: false)
                    .accessibilityLabel("已完成 \(context.state.completedSets) 组，共 \(context.state.totalSets) 组")
            } minimal: {
                Image(systemName: context.state.restDeadline == nil ? "dumbbell.fill" : "timer")
                    .font(.caption.weight(.bold)).foregroundStyle(lime).accessibilityLabel("训练搭子")
            }
            .widgetURL(trainingURL)
            .keylineTint(lime)
        }
    }

    @ViewBuilder private func activityCard(_ state: SpotterTrainingActivityAttributes.ContentState) -> some View {
        if #available(iOS 18.0, *) {
            SpotterLiveActivityPresentation {
                lockCard(state)
            } compact: {
                watchCard(state)
            }
        } else {
            lockCard(state)
        }
    }

    private func watchCard(_ state: SpotterTrainingActivityAttributes.ContentState) -> some View {
        HStack(spacing: 9) {
            let resting = state.restDeadline != nil || state.pausedRestSeconds != nil
            Image(systemName: resting ? "timer" : (state.isRunning ? "dumbbell.fill" : "pause.fill"))
                .font(.system(size: 14, weight: .semibold))
                .frame(width: 27, height: 27)
                .background(lime.opacity(0.13), in: RoundedRectangle(cornerRadius: 8))
                .foregroundStyle(lime)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(resting ? (state.isRunning ? "组间休息" : "休息已暂停") : (state.isRunning ? "训练进行中" : "训练已暂停"))
                    .font(.system(size: 10, weight: .semibold)).foregroundStyle(soft)
                if let movement = state.nextMovement, let set = state.nextSet {
                    Text(resting ? "接下来 · \(movement)" : "\(movement) · 第 \(set) 组")
                        .privacySensitive()
                } else {
                    Text("继续训练")
                }
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.75)
            .frame(maxWidth: .infinity, alignment: .leading)
            if resting {
                restCountdown(state)
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .monospacedDigit().fixedSize(horizontal: true, vertical: false).foregroundStyle(lime)
            } else if state.totalSets > 0 {
                sets(state).fixedSize(horizontal: true, vertical: false)
            }
        }
        .padding(.horizontal, 9).padding(.vertical, 5)
        .accessibilityElement(children: .combine)
    }

    private func lockCard(_ state: SpotterTrainingActivityAttributes.ContentState) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "dumbbell.fill")
                    .font(.system(size: 16, weight: .semibold)).foregroundStyle(lime)
                    .frame(width: 36, height: 36)
                    .background(lime.opacity(0.13), in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(state.isRunning ? "训练进行中" : "训练已暂停")
                        .font(.caption.weight(.semibold)).foregroundStyle(lime)
                    nextSet(state)
                }.frame(maxWidth: .infinity, alignment: .leading)
                elapsed(state).foregroundStyle(lime).fixedSize(horizontal: true, vertical: false)
            }
            rest(state)
            HStack(spacing: 10) {
                progress(state)
                if state.totalSets > 0 { sets(state) }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private func nextSet(_ state: SpotterTrainingActivityAttributes.ContentState) -> some View {
        if let movement = state.nextMovement, let next = state.nextSet {
            Text("下一组 · \(movement) · \(next) 组")
                .font(.subheadline.weight(.semibold)).lineLimit(2).foregroundStyle(.white)
                .privacySensitive()
        } else {
            Text("返回训练").font(.subheadline.weight(.semibold)).foregroundStyle(.white)
        }
    }

    private func sets(_ state: SpotterTrainingActivityAttributes.ContentState) -> some View {
        Text("\(state.completedSets)/\(state.totalSets) 组")
            .font(.caption.weight(.semibold)).monospacedDigit().foregroundStyle(soft).lineLimit(1)
    }

    private func progress(_ state: SpotterTrainingActivityAttributes.ContentState) -> some View {
        ProgressView(value: state.progress).tint(lime)
            .accessibilityLabel("完成组数")
            .accessibilityValue("\(state.completedSets) / \(state.totalSets)")
    }

    private func elapsed(_ state: SpotterTrainingActivityAttributes.ContentState, compact: Bool = false) -> some View {
        Group {
            if let start = state.elapsedStartedAt, state.isRunning {
                Text(timerInterval: start...start.addingTimeInterval(86_400), countsDown: false, showsHours: true)
                    .accessibilityLabel("训练用时")
            } else if let seconds = state.elapsedSeconds {
                Text(duration(seconds))
                    .accessibilityLabel("训练用时 \(seconds) 秒，已暂停")
            } else {
                Image(systemName: state.isRunning ? "dumbbell.fill" : "pause.fill")
                    .accessibilityLabel(state.isRunning ? "训练中" : "训练已暂停")
            }
        }
        .font(compact ? .caption2.weight(.semibold) : .subheadline.weight(.bold))
        .monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
    }

    @ViewBuilder private func rest(_ state: SpotterTrainingActivityAttributes.ContentState) -> some View {
        if state.restDeadline != nil || state.pausedRestSeconds != nil {
            HStack(spacing: 8) {
                Label(state.isRunning ? "组间休息" : "休息已暂停", systemImage: "timer")
                Spacer(minLength: 0)
                restCountdown(state)
            }
            .font(.caption.weight(.semibold)).monospacedDigit().foregroundStyle(soft)
        }
    }

    @ViewBuilder private func restCountdown(_ state: SpotterTrainingActivityAttributes.ContentState) -> some View {
        if let end = state.restDeadline {
            Text(timerInterval: end.addingTimeInterval(-600)...end, countsDown: true, showsHours: false)
                .accessibilityLabel("休息倒计时")
        } else if let seconds = state.pausedRestSeconds {
            Text(duration(seconds)).accessibilityLabel("休息剩余 \(seconds) 秒")
        }
    }

    private func duration(_ seconds: Int) -> String {
        let seconds = max(0, min(86_400, seconds))
        if seconds >= 3_600 { return String(format: "%d:%02d:%02d", seconds / 3_600, seconds / 60 % 60, seconds % 60) }
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}

@available(iOS 18.0, *)
struct SpotterWorkoutLiveActivityWithWatch: Widget {
    var body: some WidgetConfiguration {
        SpotterWorkoutLiveActivity().body.supplementalActivityFamilies([.small])
    }
}

@available(iOS 18.0, *)
private struct SpotterLiveActivityPresentation<Phone: View, Compact: View>: View {
    @Environment(\.activityFamily) private var family
    @ViewBuilder let phone: () -> Phone
    @ViewBuilder let compact: () -> Compact

    var body: some View {
        if family == .small {
            compact()
        } else {
            phone()
        }
    }
}
