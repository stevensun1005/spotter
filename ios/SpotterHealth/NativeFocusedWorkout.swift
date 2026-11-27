import SwiftUI

struct NativeFocusedWorkoutSetView<SetTimer: View>: View {
    typealias SetPosition = NativeWorkoutSession.SetPosition

    @Environment(\.spotterAccent) private var accent
    let session: NativeWorkoutSession
    let position: SetPosition
    let next: SetPosition?
    let previous: NativeJSON?
    let previousUnit: String?
    let showTempo: Bool
    let showEffort: Bool
    let isBusy: Bool
    let onSelect: (SetPosition) -> Void
    let onEdit: (String, Bool, Double) -> Void
    let onAdjust: (String, Bool, Double) -> Void
    let onDemonstration: () -> Void
    let onAddSet: () -> Void
    @ViewBuilder let timedControl: () -> SetTimer

    var body: some View {
        let moves = session.plan.exercises
        if moves.indices.contains(position.move), let line = session.line(at: position) {
            let move = moves[position.move]
            let rows = session.rows[position.move]
            VStack(alignment: .leading, spacing: 10) {
                exerciseHeader(move: move, moves: moves, rows: rows)
                setValues(move: move, line: line)
                timedControl()
                if showEffort { effortButton(line: line) }
                if let next, next != position { NativeFocusedWorkoutNextSet(session: session, position: next) }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("workout-focus-set-view")
        }
    }

    private func exerciseHeader(move: NativeJSON, moves: [NativeJSON], rows: [NativeJSON]) -> some View {
        let exercise = NativeExerciseLabel(move, preservingNameQualifiers: true)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 0) {
                exerciseArrow("上一动作", symbol: "chevron.left", offset: -1)
                exerciseMenu(moves)
                exerciseArrow("下一动作", symbol: "chevron.right", offset: 1)
            }
            .background(SpotterPalette.background, in: Capsule())
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    if !exercise.slot.isEmpty {
                        Text(exercise.slot).font(.caption.weight(.semibold)).monospacedDigit()
                            .foregroundStyle(accent.tint)
                    }
                    Text(exercise.name)
                        .font(.title2.weight(.bold))
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityIdentifier("workout-focus-exercise-title")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: onDemonstration) {
                    Image(systemName: "play.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(accent.tint)
                        .frame(width: 44, height: 44)
                        .background(accent.selection, in: Circle())
                        .contentShape(Circle())
                }
                .buttonStyle(.spotterPress)
                .accessibilityLabel("动作演示")
                .accessibilityIdentifier("workout-exercise-demonstration-\(position.move)")
            }
            if !move["cue"].string.isEmpty {
                Text(move["cue"].string).font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
            if showTempo, let tempo = NativeExerciseTempo.display(move, category: session.plan.category) {
                Label(tempo.value, systemImage: "metronome")
                    .font(.caption.weight(.semibold)).monospacedDigit()
                    .foregroundStyle(accent.tint)
                    .accessibilityLabel(tempo.accessibilityDescription)
                    .accessibilityIdentifier("workout-exercise-tempo-\(position.move)")
            }
            setPicker(rows)
        }
        .padding(12)
        .spotterCard(radius: 22)
    }

    private func exerciseMenu(_ moves: [NativeJSON]) -> some View {
        Menu {
            ForEach(moves.indices, id: \.self) { index in
                Button { selectMove(index) } label: {
                    if index == position.move {
                        Label(moves[index]["name"].string, systemImage: "checkmark")
                    } else {
                        Text(moves[index]["name"].string)
                    }
                }
            }
        } label: {
            HStack(spacing: 5) {
                Text("动作 \(position.move + 1) / \(moves.count)")
                    .font(.subheadline.weight(.semibold)).monospacedDigit()
                Image(systemName: "chevron.down").font(.caption2.weight(.semibold))
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .foregroundStyle(SpotterPalette.muted)
            .contentShape(Rectangle())
        }
        .disabled(isBusy || moves.count == 1)
        .accessibilityLabel("选择动作，当前第 \(position.move + 1) 个，共 \(moves.count) 个")
        .accessibilityIdentifier("workout-focus-move-picker")
    }

    private func exerciseArrow(_ label: String, symbol: String, offset: Int) -> some View {
        Button { selectMove(position.move + offset) } label: {
            Image(systemName: symbol).font(.subheadline.weight(.bold))
                .frame(width: 44, height: 44)
                .contentShape(Circle())
        }
        .buttonStyle(.spotterPress)
        .disabled(isBusy || !session.plan.exercises.indices.contains(position.move + offset))
        .accessibilityLabel(label)
    }

    private func selectMove(_ index: Int) {
        let groups = session.rows
        guard groups.indices.contains(index), !groups[index].isEmpty else { return }
        let row = groups[index].firstIndex { !$0["done"].bool } ?? 0
        onSelect(.init(move: index, row: row))
    }

    private func setPicker(_ rows: [NativeJSON]) -> some View {
        HStack(spacing: 8) {
            Text("组次").font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                .fixedSize()
            ScrollViewReader { scroll in
                ScrollView(.horizontal) {
                    HStack(spacing: 5) {
                        ForEach(rows.indices, id: \.self) { row in
                            setPickerButton(row, done: rows[row]["done"].bool)
                                .id(row)
                        }
                    }
                }
                .scrollIndicators(.hidden)
                .onChange(of: position) { selected in scroll.scrollTo(selected.row, anchor: .center) }
                .onAppear { scroll.scrollTo(position.row, anchor: .center) }
            }
            Button(action: onAddSet) {
                Image(systemName: "plus").font(.subheadline.weight(.semibold))
                    .foregroundStyle(accent.tint)
                    .frame(width: 44, height: 44)
                    .background(accent.selection.opacity(0.7), in: Circle())
                    .contentShape(Circle())
            }
            .buttonStyle(.spotterPress)
            .disabled(rows.count >= 30 || isBusy)
            .accessibilityLabel("增加一组")
            .accessibilityIdentifier("workout-focus-add-set")
        }
    }

    private func setPickerButton(_ row: Int, done: Bool) -> some View {
        let selected = row == position.row
        return Button { onSelect(.init(move: position.move, row: row)) } label: {
            Text("\(row + 1)")
                .font(.subheadline.weight(.semibold)).monospacedDigit()
                .foregroundStyle(selected || done ? accent.tint : SpotterPalette.muted)
                .frame(width: 44, height: 44)
                .background(selected ? accent.selection : SpotterPalette.background, in: RoundedRectangle(cornerRadius: 12))
                .overlay(alignment: .topTrailing) {
                    if done {
                        Image(systemName: "checkmark").font(.system(size: 8, weight: .bold))
                            .foregroundStyle(accent.tint)
                            .padding(5)
                            .accessibilityHidden(true)
                    }
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(selected ? accent.tint.opacity(0.44) : .clear)
                        .allowsHitTesting(false)
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .disabled(isBusy)
        .accessibilityLabel("第 \(row + 1) 组")
        .accessibilityValue(done ? "已完成" : "待完成")
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("workout-focus-set-\(position.move)-\(row)")
    }

    private func setValues(move: NativeJSON, line: NativeJSON) -> some View {
        let unit = NativeExerciseHistory.unit(of: move)
        let timed = move["seconds"].number > 0 || line["seconds"].number > 0
        let sided = line["right"] != .null
        return VStack(spacing: 8) {
            metricPair(unit: unit, timed: timed, line: line, right: false, side: sided ? "左侧" : "")
            if sided { metricPair(unit: unit, timed: false, line: line["right"], right: true, side: "右侧") }
        }
    }

    private func metricPair(unit: String, timed: Bool, line: NativeJSON, right: Bool, side: String) -> some View {
        let history = right ? previous?["right"] : previous
        let prefix = side.isEmpty ? "" : "\(side) · "
        return HStack(alignment: .top, spacing: 8) {
            metric("\(prefix)重量 · \(unit)", key: "weight", value: line["weight"].number, right: right,
                   history: history, unit: previousUnit ?? unit, step: unit == "lb" ? 5 : 2.5, limit: 2_000)
            metric(timed ? "时长 · 秒" : "\(prefix)次数", key: timed ? "seconds" : "reps",
                   value: line[timed ? "seconds" : "reps"].number, right: right, history: history,
                   unit: timed ? "秒" : "次", step: timed ? 5 : 1, limit: timed ? 18_000 : 999)
        }
    }

    private func metric(_ title: String, key: String, value: Double, right: Bool,
                        history: NativeJSON?, unit: String, step: Double, limit: Double) -> some View {
        let shape = RoundedRectangle(cornerRadius: 20)
        return VStack(spacing: 5) {
            Button { onEdit(key, right, value) } label: {
                VStack(spacing: 3) {
                    Text(title).font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                    Text(value.formatted(.number.precision(.fractionLength(0...2))))
                        .font(.system(.largeTitle, design: .rounded).weight(.heavy)).monospacedDigit()
                        .lineLimit(1).minimumScaleFactor(0.45)
                        .foregroundStyle(SpotterPalette.ink)
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel("编辑\(title)")
            .accessibilityValue(value.formatted())
            .accessibilityIdentifier("workout-focus-edit-\(right ? "right-" : "")\(key)")

            if let history, history[key] != .null {
                Text("上次 \(history[key].number.formatted(.number.precision(.fractionLength(0...2)))) \(unit)")
                    .font(.caption2).foregroundStyle(SpotterPalette.muted)
                    .lineLimit(1).minimumScaleFactor(0.75)
            }
            HStack(spacing: 0) {
                adjustButton("减少\(title)", symbol: "minus", enabled: value > 0) {
                    onAdjust(key, right, -step)
                }
                Rectangle().fill(SpotterPalette.line).frame(width: 1, height: 18).accessibilityHidden(true)
                adjustButton("增加\(title)", symbol: "plus", enabled: value < limit) {
                    onAdjust(key, right, step)
                }
            }
            .background(SpotterPalette.background, in: Capsule())
        }
        .padding(10)
        .frame(maxWidth: .infinity)
        .background {
            shape.fill(SpotterPalette.card)
                .overlay {
                    if key != "weight" {
                        shape.fill(LinearGradient(colors: [accent.selection.opacity(0.65), .clear], startPoint: .top, endPoint: .bottom))
                    }
                }
        }
        .overlay { shape.strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
        .disabled(isBusy)
    }

    private func adjustButton(_ label: String, symbol: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .disabled(!enabled)
        .accessibilityLabel(label)
    }

    private func effortButton(line: NativeJSON) -> some View {
        let value = line["rpe"].number
        return Button { onEdit("rpe", false, value == 0 ? 8 : value) } label: {
            HStack(spacing: 6) {
                Label("RPE", systemImage: "speedometer")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(value == 0 ? "选填" : value.formatted())
                    .foregroundStyle(SpotterPalette.muted)
                Image(systemName: "chevron.right").font(.caption.weight(.semibold))
                    .foregroundStyle(SpotterPalette.muted)
            }
            .padding(.horizontal, 12).frame(minHeight: 44)
            .spotterCard(radius: 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .disabled(isBusy)
        .accessibilityIdentifier("workout-focus-rpe")
    }
}

struct NativeFocusedWorkoutRestView: View {
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    let session: NativeWorkoutSession
    let next: NativeWorkoutSession.SetPosition?
    let isBusy: Bool
    let onAdjust: (Int) -> Void
    let onTick: (Int) -> Void

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            if let rest = session.restStatus(at: Int64(context.date.timeIntervalSince1970 * 1_000)) {
                VStack(spacing: 12) {
                    VStack(spacing: 10) {
                        restHeader(rest)
                        restRing(rest)
                        HStack(spacing: 8) {
                            restAdjustment("减少休息 15 秒", symbol: "minus", seconds: -15,
                                           available: rest.remainingSeconds > 0)
                                .accessibilityIdentifier("workout-rest-less")
                            restAdjustment("增加休息 15 秒", symbol: "plus", seconds: 15,
                                           available: rest.remainingSeconds < NativeWorkoutSession.maximumRestSeconds)
                                .accessibilityIdentifier("workout-rest-more")
                        }
                        .frame(maxWidth: 260)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity)
                    .background {
                        let surface = RoundedRectangle(cornerRadius: 24, style: .continuous)
                        surface.fill(LinearGradient(colors: [accent.selection, SpotterPalette.card],
                                                    startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay { surface.strokeBorder(SpotterPalette.line) }
                    }
                    if let next { NativeFocusedWorkoutNextSet(session: session, position: next) }
                }
                .disabled(isBusy)
                .onAppear { onTick(rest.remainingSeconds) }
                .onChange(of: rest.remainingSeconds) { onTick($0) }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("workout-focus-rest-view")
            }
        }
    }

    private func restHeader(_ rest: NativeWorkoutSession.RestStatus) -> some View {
        HStack(spacing: 8) {
            Label(rest.remainingSeconds == 0 ? "休息结束" : rest.kind,
                  systemImage: rest.remainingSeconds == 0 ? "checkmark.circle" : "timer")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(accent.tint)
                .accessibilityHidden(true)
            Spacer(minLength: 0)
            if !session.isRunning && rest.remainingSeconds > 0 {
                Label("训练已暂停", systemImage: "pause.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(SpotterPalette.muted)
            }
        }
    }

    private func restAdjustment(_ title: String, symbol: String, seconds: Int, available: Bool) -> some View {
        Button { onAdjust(seconds) } label: {
            Label("15 秒", systemImage: symbol)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(SpotterPalette.ink)
                .padding(.horizontal, 8)
                .frame(maxWidth: .infinity, minHeight: 44)
                .spotterCard(radius: 14)
                .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .disabled(!available)
        .accessibilityLabel(title)
    }

    private func restRing(_ rest: NativeWorkoutSession.RestStatus) -> some View {
        let progress = Double(rest.remainingSeconds) / Double(max(1, rest.totalSeconds, rest.remainingSeconds))
        let track = Circle().inset(by: 4)
        return ZStack {
            Circle().inset(by: 10).fill(SpotterPalette.card.opacity(0.6))
            track.stroke(accent.tint.opacity(0.14), lineWidth: 6)
            track.trim(from: 0, to: progress)
                .stroke(AngularGradient(colors: [accent.tint.opacity(0.55), accent.tint, accent.tint], center: .center),
                        style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .opacity(progress == 0 ? 0 : 1)
                .animation(motion, value: progress)
            VStack(spacing: 2) {
                Text(NativeWorkoutView.duration(rest.remainingSeconds * 1_000))
                    .font(.system(size: 58, weight: .bold, design: .rounded)).monospacedDigit()
                    .tracking(-2)
                    .lineLimit(1).minimumScaleFactor(0.60)
                    .contentTransition(.numericText(countsDown: true))
                Text("共 \(rest.totalSeconds) 秒")
                    .font(.caption.weight(.medium)).foregroundStyle(SpotterPalette.muted)
            }
            .padding(18)
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(maxWidth: 176)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(rest.remainingSeconds > 0 ? rest.kind : "休息结束")
        .accessibilityValue("剩余 \(rest.remainingSeconds) 秒")
        .accessibilityAddTraits(.updatesFrequently)
        .accessibilityIdentifier("workout-rest-summary")
    }
}

private struct NativeFocusedWorkoutNextSet: View {
    @Environment(\.spotterAccent) private var accent
    let session: NativeWorkoutSession
    let position: NativeWorkoutSession.SetPosition

    var body: some View {
        let exercises = session.plan.exercises
        if exercises.indices.contains(position.move), let line = session.line(at: position) {
            let move = exercises[position.move]
            HStack(alignment: .center, spacing: 10) {
                Image(systemName: "arrow.right").font(.caption.weight(.bold))
                    .foregroundStyle(accent.tint)
                    .frame(width: 34, height: 34)
                    .background(accent.selection, in: Circle())
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("接下来 · 第 \(position.row + 1) 组")
                        .font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                    Text(move["name"].string).font(.subheadline.weight(.bold))
                    Text(NativeExerciseHistory.amount(line, unit: NativeExerciseHistory.unit(of: move), showEffort: false))
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(10)
            .spotterCard(radius: 18)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("workout-focus-next-set")
        }
    }
}
