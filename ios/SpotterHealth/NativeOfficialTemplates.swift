import SwiftUI

struct NativeOfficialTemplates: View {
    private typealias Goal = NativeOfficialTrainingTemplate.Goal
    private typealias Level = NativeOfficialTrainingTemplate.Level

    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterGuide) private var guide
    @Environment(\.dynamicTypeSize) private var dynamicType
    @State private var goal: Goal?
    @State private var level: Level?
    @State private var selected: NativeOfficialTrainingTemplate?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                switch NativeOfficialTrainingCatalogue.bundled {
                case .success(let catalogue):
                    filters
                    let matches = catalogue.matching(goal: goal, level: level)
                    ForEach(matches) { template in
                        Button { selected = template } label: { templateCard(template) }
                            .buttonStyle(.spotterPress)
                            .disabled(guide?.step == .officialFilters)
                            .accessibilityHint("查看每周安排和动作")
                            .accessibilityIdentifier("official-template-card-" + template.id)
                    }
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

    private var filters: some View {
        let goals: [(Goal?, String)] = [(nil, "全部")] + Goal.allCases.map { (Optional($0), $0.title) }
        let levels: [(Level?, String)] = [(nil, "全部")] + Level.allCases.map { (Optional($0), $0.title) }
        let layout = dynamicType.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8))
            : AnyLayout(HStackLayout(spacing: 8))
        return layout {
            SpotterMenuPicker("训练目标", selection: $goal, options: goals) {
                filterLabel("训练目标", value: goal?.title ?? "全部")
            }
            .accessibilityIdentifier("official-template-goal-filter")
            SpotterMenuPicker("训练水平", selection: $level, options: levels) {
                filterLabel("训练水平", value: level?.title ?? "全部")
            }
            .accessibilityIdentifier("official-template-level-filter")
        }
        .nativeGuideTarget(.officialFilters)
    }

    private func filterLabel(_ title: String, value: String) -> some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.caption.weight(.medium)).foregroundStyle(SpotterPalette.muted)
                Text(value).font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.ink)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.down")
                .font(.caption2.weight(.bold))
                .foregroundStyle(SpotterPalette.muted)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
                Text("\(template.goal.title) · \(template.level.title)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(accent.tint)
                Text(template.summary).font(.subheadline).foregroundStyle(SpotterPalette.muted)
                Text("\(template.weeks) 周 · \(template.weeklySessionLabel) · \(template.equipment)")
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
}

struct NativeOfficialTemplatePreview: View {
    let template: NativeOfficialTrainingTemplate
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @State private var startDay = Date()
    @State private var selectedWeek = 1
    @State private var draft: NativeTrainingProgram?
    @State private var showsDraft = false
    @State private var error: String?
    @State private var exercisePreview: NativeTemplateExercisePreview?

    private var week: [Int: NativeOfficialTrainingTemplate.TrainingDay] {
        Dictionary(uniqueKeysWithValues: template.trainingDays(for: selectedWeek).map { ($0.day, $0) })
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                overview
                startDate
                HStack {
                    Text(template.isWeekSpecific ? "训练安排" : "每周训练安排")
                        .font(.headline)
                        .accessibilityAddTraits(.isHeader)
                    Spacer(minLength: 8)
                    if template.isWeekSpecific {
                        SpotterMenuPicker("周次", selection: $selectedWeek, options: (1...template.weeks).map { ($0, "第 \($0) 周") }) {
                            HStack(spacing: 6) {
                                Text("第 \(selectedWeek) 周")
                                Image(systemName: "chevron.down").font(.caption.weight(.semibold))
                            }
                            .font(.subheadline.weight(.semibold))
                        }
                        .accessibilityIdentifier("official-template-week-picker")
                    }
                }
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
        .sheet(item: $exercisePreview) { preview in
            NativeTemplateExerciseSheet(store: store, move: preview.move)
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
            Text(template.isWeekSpecific
                 ? "第 1 天从开始日算起。确认时会排入全部 \(template.weeks) 周训练，重量可按自己的水平填写。"
                 : "第 1 天从开始日算起，后面各周沿用这套安排。重量可按自己的训练水平填写。")
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
            ForEach(Array(workout.exercises.enumerated()), id: \.offset) { index, exercise in
                let rowID = "official-template-exercise-\(workout.day)-\(index)"
                NativeTemplateExerciseButton(name: exercise.name, prescription: exerciseDetails(exercise),
                                             cue: exercise.cue ?? "") {
                    exercisePreview = .init(id: rowID, move: exercise.move(unit: NativePreferenceKey.newMoveUnit))
                }
                .accessibilityIdentifier(rowID)
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
        guard let date = calendar.date(byAdding: .day, value: (selectedWeek - 1) * 7 + day - 1, to: startDay) else { return "第 \(day) 天" }
        let weekday = ["日", "一", "二", "三", "四", "五", "六"][calendar.component(.weekday, from: date) - 1]
        return "第 \(day) 天（周\(weekday)）"
    }

    private func exerciseDetails(_ exercise: NativeOfficialTrainingTemplate.Exercise) -> String {
        [exercise.prescription, exercise.restSeconds.map { "休息 \($0) 秒" },
         exercise.targetRpe.map { "目标 RPE \($0.formatted())" }].compactMap { $0 }.joined(separator: " · ")
    }
}

struct NativeTemplateExercisePreview: Identifiable {
    let id: String
    let move: NativeJSON
}

struct NativeTemplateExerciseButton: View {
    let name: String
    let prescription: String
    let cue: String
    let action: () -> Void
    @Environment(\.spotterAccent) private var accent

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(name).font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.ink)
                    Text(prescription).font(.caption).foregroundStyle(SpotterPalette.muted)
                    if !cue.isEmpty { Text(cue).font(.caption).foregroundStyle(SpotterPalette.muted) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "play.rectangle")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(accent.tint)
                    .accessibilityHidden(true)
            }
            .padding(10)
            .frame(minHeight: 44)
            .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 10))
            .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityHint("打开动作详情及演示")
    }
}

struct NativeTemplateExerciseSheet: View {
    let store: NativeWorkoutStore
    let move: NativeJSON

    var body: some View {
        NavigationStack {
            NativeExerciseProgressView(store: store, move: move, showsClose: true)
        }
        .presentationDragIndicator(.visible)
    }
}
