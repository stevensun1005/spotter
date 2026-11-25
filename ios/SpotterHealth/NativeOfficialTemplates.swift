import SwiftUI

struct NativeOfficialTemplates: View {
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.spotterAccent) private var accent
    @State private var goal = NativeOfficialTrainingTemplate.Goal.hypertrophy
    @State private var level = NativeOfficialTrainingTemplate.Level.beginner
    @State private var selected: NativeOfficialTrainingTemplate?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                introduction
                switch NativeOfficialTrainingCatalogue.bundled {
                case .success(let catalogue):
                    filters
                    let matches = catalogue.matching(goal: goal, level: level)
                    Text("\(goal.title) · \(level.title) · \(matches.count) 个模板")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(SpotterPalette.muted)
                        .accessibilityAddTraits(.isHeader)
                    ForEach(matches) { template in
                        Button { selected = template } label: { templateCard(template) }
                            .buttonStyle(.spotterPress)
                            .accessibilityHint("查看每周安排和动作")
                    }
                    references
                case .failure:
                    Label("官方模板暂时不可用。", systemImage: "exclamationmark.circle")
                        .font(.subheadline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(14)
                        .spotterCard()
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 6)
            .padding(.bottom, 14)
        }
        .sheet(item: $selected) { template in
            NavigationStack {
                NativeOfficialTemplatePreview(template: template, store: store)
            }
            .presentationDragIndicator(.visible)
        }
    }

    private var introduction: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("官方训练模板", systemImage: "list.clipboard")
                .font(.title2.weight(.heavy))
                .accessibilityAddTraits(.isHeader)
            Text("按目标和训练经验查看每周安排。选好开始日后，可以逐节调整再排入日历。")
                .font(.subheadline)
                .foregroundStyle(SpotterPalette.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .background(accent.selection, in: RoundedRectangle(cornerRadius: 20))
    }

    private var filters: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("训练目标").font(.subheadline.weight(.semibold))
            SpotterGlassSegments(options: NativeOfficialTrainingTemplate.Goal.allCases,
                                 value: $goal, glass: false, title: \.title)
            Text("训练水平").font(.subheadline.weight(.semibold))
            SpotterGlassSegments(options: NativeOfficialTrainingTemplate.Level.allCases,
                                 value: $level, glass: false, title: \.title)
        }
        .padding(12)
        .spotterCard()
    }

    private func templateCard(_ template: NativeOfficialTrainingTemplate) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: template.goal.symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(accent.tint)
                .frame(width: 38, height: 38)
                .background(accent.selection, in: RoundedRectangle(cornerRadius: 11))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 5) {
                Text(template.title).font(.headline).foregroundStyle(SpotterPalette.ink)
                Text(template.summary).font(.subheadline).foregroundStyle(SpotterPalette.muted)
                Text("\(template.weeks) 周 · 每周 \(template.days.count) 节 · \(template.equipment)")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(SpotterPalette.muted)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(SpotterPalette.muted)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .spotterCard()
    }

    private var references: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("编排参考").font(.caption.weight(.semibold))
            ForEach(Self.sources, id: \.name) { source in
                Link(source.name, destination: source.url)
                    .font(.caption)
                    .frame(minHeight: 32, alignment: .leading)
            }
        }
        .foregroundStyle(accent.tint)
        .padding(.horizontal, 4)
    }

    private static let sources = [
        ("ACSM 阻力训练指南", "https://doi.org/10.1249/MSS.0000000000003897"),
        ("CDC 成人身体活动指南", "https://www.cdc.gov/physical-activity-basics/guidelines/adults.html"),
        ("NHS 力量与柔韧训练指南", "https://www.nhs.uk/live-well/exercise/how-to-improve-strength-flexibility/"),
    ].compactMap { name, address in URL(string: address).map { (name: name, url: $0) } }
}

struct NativeOfficialTemplatePreview: View {
    let template: NativeOfficialTrainingTemplate
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @State private var startDay = Date()
    @State private var draft: NativeTrainingProgram?
    @State private var showsDraft = false
    @State private var error: String?

    private var week: [Int: NativeOfficialTrainingTemplate.TrainingDay] {
        Dictionary(uniqueKeysWithValues: template.days.map { ($0.day, $0) })
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                overview
                startDate
                Text("每周训练安排")
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                    .padding(.top, 4)
                ForEach(1...7, id: \.self) { day in
                    if let workout = week[day] { trainingDay(workout) }
                    else { restDay(day) }
                }
                if let error { Text(error).font(.footnote).foregroundStyle(.red) }
            }
            .padding(14)
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .foregroundStyle(SpotterPalette.ink)
        .navigationTitle("模板详情")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Button {
                do {
                    draft = try template.draft(startDay: startDay)
                    error = nil
                    showsDraft = true
                } catch { self.error = error.localizedDescription }
            } label: {
                Label("使用这个模板", systemImage: "calendar.badge.plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.spotterPrimaryControl)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(SpotterPalette.background)
        }
        .navigationDestination(isPresented: $showsDraft) {
            if let draft { NativeOfficialProgramReview(draft: draft, store: store) }
        }
    }

    private var overview: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(template.title).font(.title2.weight(.heavy)).accessibilityAddTraits(.isHeader)
            Text(template.summary).font(.subheadline).foregroundStyle(SpotterPalette.muted)
            Label("\(template.goal.title) · \(template.level.title) · \(template.weeks) 周", systemImage: "calendar")
            Label(template.equipment, systemImage: "dumbbell")
        }
        .font(.subheadline.weight(.medium))
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .spotterCard()
    }

    private var startDate: some View {
        VStack(alignment: .leading, spacing: 8) {
            DatePicker("周期开始日", selection: $startDay, displayedComponents: .date)
                .font(.subheadline.weight(.semibold))
            Text("第 1 天从开始日算起，后面各周沿用这套安排。重量可按自己的训练水平填写。")
                .font(.footnote)
                .foregroundStyle(SpotterPalette.muted)
        }
        .padding(14)
        .spotterCard()
    }

    private func trainingDay(_ workout: NativeOfficialTrainingTemplate.TrainingDay) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(dayLabel(workout.day)) · \(workout.title)")
                .font(.subheadline.weight(.bold))
                .accessibilityAddTraits(.isHeader)
            Text("\(workout.category) · 约 \(workout.minutes) 分钟")
                .font(.caption)
                .foregroundStyle(SpotterPalette.muted)
            ForEach(Array(workout.exercises.enumerated()), id: \.offset) { _, exercise in
                VStack(alignment: .leading, spacing: 3) {
                    Text(exercise.name).font(.subheadline.weight(.semibold))
                    Text(exerciseDetails(exercise))
                        .font(.caption)
                        .foregroundStyle(SpotterPalette.muted)
                    if let cue = exercise.cue {
                        Text(cue).font(.caption).foregroundStyle(SpotterPalette.muted)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(9)
                .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 10))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .spotterCard()
    }

    private func restDay(_ day: Int) -> some View {
        Label("\(dayLabel(day)) · 休息", systemImage: "moon")
            .font(.subheadline)
            .foregroundStyle(SpotterPalette.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(accent.selection.opacity(0.42), in: RoundedRectangle(cornerRadius: 12))
    }

    private func dayLabel(_ day: Int) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        guard let date = calendar.date(byAdding: .day, value: day - 1, to: startDay) else { return "第 \(day) 天" }
        let weekday = ["日", "一", "二", "三", "四", "五", "六"][calendar.component(.weekday, from: date) - 1]
        return "第 \(day) 天（周\(weekday)）"
    }

    private func exerciseDetails(_ exercise: NativeOfficialTrainingTemplate.Exercise) -> String {
        [exercise.prescription, exercise.restSeconds.map { "休息 \($0) 秒" },
         exercise.targetRpe.map { "目标 RPE \($0.formatted())" }].compactMap { $0 }.joined(separator: " · ")
    }
}
