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
            lockCard(context.state)
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
                    timing(context.state).foregroundStyle(lime)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack { nextSet(context.state); Spacer(minLength: 6); sets(context.state) }
                        progress(context.state)
                    }.padding(.top, 3)
                }
            } compactLeading: {
                Image(systemName: context.state.isRunning ? "dumbbell.fill" : "pause.fill")
                    .font(.caption.weight(.bold)).foregroundStyle(lime)
                    .accessibilityLabel(context.state.isRunning ? "训练中" : "训练已暂停")
            } compactTrailing: {
                if context.state.restDeadline != nil {
                    timing(context.state).foregroundStyle(lime).fixedSize(horizontal: true, vertical: false)
                } else {
                    Text("\(context.state.completedSets)/\(context.state.totalSets)")
                        .font(.caption2.weight(.semibold)).monospacedDigit().foregroundStyle(lime)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
            } minimal: {
                Image(systemName: context.state.restDeadline == nil ? "dumbbell.fill" : "timer")
                    .font(.caption.weight(.bold)).foregroundStyle(lime).accessibilityLabel("训练搭子")
            }
            .widgetURL(trainingURL)
            .keylineTint(lime)
        }
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
                VStack(alignment: .trailing, spacing: 2) {
                    timing(state).foregroundStyle(lime)
                    if state.restDeadline != nil || state.pausedRestSeconds != nil {
                        Text(state.isRunning ? "休息倒计时" : "休息已暂停").font(.caption2).foregroundStyle(soft)
                    }
                }.fixedSize(horizontal: true, vertical: false)
            }
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

    @ViewBuilder private func timing(_ state: SpotterTrainingActivityAttributes.ContentState) -> some View {
        if let end = state.restDeadline {
            Text(timerInterval: end.addingTimeInterval(-600)...end, countsDown: true, showsHours: false)
                .font(.subheadline.weight(.bold)).monospacedDigit().accessibilityLabel("休息倒计时")
        } else if let seconds = state.pausedRestSeconds {
            Text(String(format: "%d:%02d", seconds / 60, seconds % 60))
                .font(.subheadline.weight(.bold)).monospacedDigit().accessibilityLabel("剩余 \(seconds) 秒")
        } else {
            Image(systemName: state.isRunning ? "arrow.up.right" : "pause.fill").font(.caption.weight(.bold))
                .accessibilityHidden(true)
        }
    }
}
