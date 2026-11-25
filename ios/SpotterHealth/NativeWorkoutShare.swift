import Photos
import SwiftUI
import UIKit

@MainActor
struct NativeWorkoutShareView: View {
    let entry: NativeWorkoutEntry
    let logs: [NativeWorkoutEntry]
    let owner: String
    let displayName: String
    let api: NativeAPI?

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var showDetails = true
    @State private var merge = false
    @State private var includeHeart = false
    @State private var theme = ShareTheme.sketch
    @State private var figure = SecondaryAnatomy.Figure.male
    @State private var artwork: [String: SecondaryAnatomy.Drawing]?
    @State private var shading: MuscleShading?
    @State private var heart: HeartSelection?
    @State private var saving = false
    @State private var message: String?
    @State private var output: ShareOutput?

    private struct MuscleShading {
        let entries: [NativeWorkoutEntry]
        let values: [String: Double]
    }

    private struct HeartSelection {
        let ids: [String]
        let readings: [String: ShareHeart]
        let hadError: Bool
    }

    private struct ShareOutput: Identifiable {
        let id = UUID()
        let image: UIImage
    }

    private var dayLogs: [NativeWorkoutEntry] {
        NativeWorkoutShareSummary.entries(for: entry, among: logs, owner: owner, merge: true)
    }
    private var displayedLogs: [NativeWorkoutEntry] {
        merge ? dayLogs : NativeWorkoutShareSummary.entries(for: entry, among: [], owner: owner, merge: false)
    }
    private var requestedHeart: [String] { includeHeart ? displayedLogs.map(\.id) : [] }
    private var selectedHeart: HeartSelection? { includeHeart && heart?.ids == requestedHeart ? heart : nil }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("训练分享卡").font(.headline.weight(.bold)).accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.system(size: 17, weight: .semibold))
                        .frame(width: 44, height: 44)
                        .spotterGlass(in: Circle(), tint: theme.tile.opacity(0.48), interactive: motion != nil && !saving)
                }
                .buttonStyle(.spotterPress).accessibilityLabel("关闭分享卡").disabled(saving)
            }
            .padding(.horizontal, 13).padding(.top, 11).padding(.bottom, 7)
            .background(theme.tile)
            .overlay(alignment: .bottom) { Rectangle().fill(theme.line).frame(height: 1).allowsHitTesting(false) }
            if displayedLogs.isEmpty {
                Text("只有本人可以生成这条训练记录的分享卡。").frame(maxHeight: .infinity).padding()
            } else {
                ScrollView {
                    poster.padding(10)
                }
                .accessibilityIdentifier("workout-share-preview")
                .safeAreaInset(edge: .bottom, spacing: 0) { footer }
            }
        }
        .foregroundStyle(theme.ink)
        .background(theme.paper.ignoresSafeArea())
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(saving)
        .task {
            artwork = await Task.detached(priority: .utility) { SecondaryAnatomy.loadArtwork() }.value
        }
        .task(id: displayedLogs) {
            let entries = displayedLogs
            let values = await Task.detached(priority: .utility) { SecondaryMusclePanel.posterIntensity(entries) }.value
            guard !Task.isCancelled else { return }
            shading = MuscleShading(entries: entries, values: values)
        }
        .task(id: requestedHeart) { await loadHeart(ids: requestedHeart) }
        .sheet(item: $output) { ShareActivity(image: $0.image).presentationDetents([.medium, .large]) }
    }

    private var poster: WorkoutSharePoster {
        WorkoutSharePoster(summary: NativeWorkoutShareSummary(entry: entry, logs: displayedLogs),
                           name: displayName, theme: theme, artwork: artwork ?? [:], figure: figure,
                           intensity: shading?.entries == displayedLogs ? shading?.values ?? [:] : [:],
                           details: showDetails, heart: selectedHeart?.readings ?? [:])
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 6) {
                Button(showDetails ? "隐藏明细" : "显示明细") {
                    withAnimation(motion) { showDetails.toggle() }
                    message = nil
                }
                .buttonStyle(ShareControlStyle(theme: theme))
                Button(merge ? "仅本次" : "合并当天") {
                    withAnimation(motion) { merge.toggle() }
                    message = nil
                }
                .buttonStyle(ShareControlStyle(theme: theme))
                .disabled(dayLogs.count < 2)
                SpotterMenuPicker("海报样式", selection: $theme, options: ShareTheme.allCases.map { ($0, $0.rawValue) }) {
                    HStack(spacing: 5) {
                        Text(theme.rawValue).fontWeight(.semibold)
                        Image(systemName: "chevron.down").font(.caption2)
                    }
                    .lineLimit(1).minimumScaleFactor(0.8)
                    .frame(maxWidth: .infinity)
                }
            }
            .spotterGlassCluster()
            HStack(spacing: 12) {
                Button {
                    withAnimation(motion) { includeHeart.toggle() }
                    message = nil
                } label: {
                    Label("附带心率", systemImage: includeHeart ? "checkmark.square.fill" : "square")
                        .frame(minHeight: 32)
                }
                .buttonStyle(SpotterGlassChoiceStyle(selected: includeHeart))
                .accessibilityAddTraits(includeHeart ? .isSelected : [])
                .disabled(api == nil)
                Spacer(minLength: 5)
                if artwork?.isEmpty == false {
                    SpotterMenuPicker("肌群图体型", selection: $figure, options: SecondaryAnatomy.Figure.allCases.map { ($0, $0.title) }) {
                        Label(figure.title, systemImage: "figure.stand")
                    }
                }
            }
            .spotterGlassCluster()
            .font(.subheadline.weight(.semibold)).foregroundStyle(theme.quiet)
            if let message { Text(message).font(.footnote).foregroundStyle(theme.quiet) }
            else if includeHeart {
                if selectedHeart == nil { ProgressView("正在读取训练心率…").font(.footnote) }
                else if selectedHeart?.hadError == true { Text("部分训练心率读取失败。仅分享已读取的心率。").font(.footnote) }
                else if selectedHeart?.readings.isEmpty == true { Text("所选训练暂无心率记录。").font(.footnote) }
            }
            Divider().overlay(theme.line)
            HStack(spacing: 9) {
                Button {
                    Task { await saveImage() }
                } label: {
                    Label(saving ? "正在保存" : "保存图片", systemImage: "arrow.down.to.line")
                }
                .buttonStyle(ShareControlStyle(theme: theme, isOutput: true))
                Button {
                    message = nil
                    if let image = renderImage() { output = ShareOutput(image: image) }
                    else { message = "生成图片失败，请再试一次。" }
                } label: {
                    Label("分享图片", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(ShareControlStyle(theme: theme, isOutput: true, highlighted: true))
            }
            .spotterGlassCluster()
            .disabled(saving || artwork == nil || shading?.entries != displayedLogs || (includeHeart && selectedHeart == nil))
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(theme.tile)
        .environment(\.colorScheme, .light)
        .overlay(alignment: .top) { Rectangle().fill(theme.line).frame(height: 1).allowsHitTesting(false) }
    }

    private func loadHeart(ids: [String]) async {
        guard let api, !ids.isEmpty else { heart = nil; return }
        let results = await withTaskGroup(of: (String, ShareHeart?, Bool).self) { group in
            for id in ids where UUID(uuidString: id) != nil {
                group.addTask {
                    do {
                        let value = try await api.spotterRead("/api/health?id=" + id, as: ShareHeartResponse.self)
                        return (id, value.data, false)
                    } catch { return (id, nil, true) }
                }
            }
            var selected: [String: ShareHeart] = [:]
            var hadError = false
            for await (id, result, failed) in group {
                selected[id] = result
                hadError = hadError || failed
            }
            return (selected, hadError)
        }
        guard !Task.isCancelled, ids == requestedHeart else { return }
        heart = HeartSelection(ids: ids, readings: results.0, hadError: results.1)
    }

    private func renderImage() -> UIImage? {
        let renderer = ImageRenderer(content: poster.environment(\.dynamicTypeSize, .medium).frame(width: 480))
        renderer.proposedSize = ProposedViewSize(width: 480, height: nil)
        renderer.isOpaque = true
        var size = CGSize.zero
        renderer.render { measured, _ in size = measured }
        guard size.width.isFinite, size.height.isFinite, size.width > 0, size.height > 0 else { return nil }
        renderer.scale = min(2, 8192 / max(size.width, size.height), sqrt(14_000_000 / (size.width * size.height)))
        return renderer.uiImage
    }

    private func saveImage() async {
        guard !saving else { return }
        saving = true
        message = nil
        defer { saving = false }
        guard let data = renderImage()?.pngData() else { message = "生成图片失败，请再试一次。"; return }
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            message = "请在系统设置允许训练搭子添加照片，或用分享图片保存。"
            return
        }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetCreationRequest.forAsset().addResource(with: .photo, data: data, options: nil)
            }
            message = "已保存到照片。"
        } catch { message = "保存图片失败，请再试一次。" }
    }
}

private struct ShareHeartResponse: Decodable, Sendable { let data: ShareHeart? }

private struct ShareHeart: Decodable, Sendable {
    let from: Int
    let to: Int
    let average: Int?
    let minimum: Int?
    let maximum: Int?
    let samples: [HeartPoint]
}

private struct ShareActivity: UIViewControllerRepresentable {
    let image: UIImage
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [image], applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

private enum ShareTheme: String, CaseIterable {
    case sketch = "手绘方格", lilac = "雾紫", forest = "松林"

    private func choice(_ sketch: UInt32, _ lilac: UInt32, _ forest: UInt32) -> Color {
        SpotterPalette.color(self == .sketch ? sketch : self == .lilac ? lilac : forest)
    }
    var paper: Color { choice(0xfbf7ec, 0xf2edf8, 0xe8f1e8) }
    var tile: Color { choice(0xfffdf5, 0xfffefd, 0xfafff8) }
    var ink: Color { choice(0x2a2a2e, 0x27243f, 0x182f28) }
    var quiet: Color { choice(0x62626b, 0x605971, 0x496455) }
    var line: Color { choice(0xd9d3c2, 0xded6e8, 0xcfded0) }
    var light: Color { choice(0xbddbab, 0xc4b8df, 0xb3d8ad) }
    var highlight: Color { choice(0xfff0a0, 0xe6dcf4, 0xd4e7c9) }
}

private struct ShareControlStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    @Environment(\.spotterInteractionMotion) private var motion
    let theme: ShareTheme
    var isOutput = false
    var highlighted = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.subheadline.weight(.semibold))
            .lineLimit(1).minimumScaleFactor(0.8)
            .frame(maxWidth: .infinity, minHeight: isOutput ? 46 : 44)
            .padding(.horizontal, 4)
            .foregroundStyle(theme.ink.opacity(enabled ? 1 : 0.44))
            .contentShape(Capsule())
            .spotterGlass(in: Capsule(), tint: highlighted ? theme.highlight.opacity(0.72) : theme.light.opacity(0.20),
                          interactive: enabled && motion != nil)
            .spotterPressFeedback(configuration.isPressed)
    }
}

private struct WorkoutSharePoster: View {
    let summary: NativeWorkoutShareSummary
    let name: String
    let theme: ShareTheme
    let artwork: [String: SecondaryAnatomy.Drawing]
    let figure: SecondaryAnatomy.Figure
    let intensity: [String: Double]
    let details: Bool
    let heart: [String: ShareHeart]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            summaryPanel
            ForEach(summary.workouts) { workout in
                if let readings = heart[workout.id] { heartPanel(readings, title: workout.title) }
                if details && !workout.moves.isEmpty { detailPanel(workout) }
            }
        }
        .padding(15).padding(.bottom, 4)
        .foregroundStyle(theme.ink)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            theme.paper
            if theme == .sketch {
                Canvas { context, size in
                    let color = SpotterPalette.color(0x466eaa)
                    for x in stride(from: 0, through: Int(size.width), by: 14) {
                        var path = Path(); path.move(to: CGPoint(x: CGFloat(x), y: 0)); path.addLine(to: CGPoint(x: CGFloat(x), y: size.height))
                        context.stroke(path, with: .color(color.opacity(x.isMultiple(of: 70) ? 0.16 : 0.07)), lineWidth: 0.6)
                    }
                    for y in stride(from: 0, through: Int(size.height), by: 14) {
                        var path = Path(); path.move(to: CGPoint(x: 0, y: CGFloat(y))); path.addLine(to: CGPoint(x: size.width, y: CGFloat(y)))
                        context.stroke(path, with: .color(color.opacity(y.isMultiple(of: 70) ? 0.16 : 0.07)), lineWidth: 0.6)
                    }
                }.accessibilityHidden(true)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(dateLabel).font(.system(size: 13, weight: .bold)).padding(.horizontal, 8).padding(.vertical, 4)
                    .background(theme.highlight, in: RoundedRectangle(cornerRadius: 5))
                    .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(theme == .sketch ? theme.ink : .clear))
                    .rotationEffect(.degrees(theme == .sketch ? -1.2 : 0))
                Spacer(minLength: 5)
                Text("训练搭子").font(.system(size: 10, weight: .semibold)).foregroundStyle(theme.quiet)
            }
            Text(summary.title).font(.system(size: 27, weight: .heavy))
                .fixedSize(horizontal: false, vertical: true)
                .background(alignment: .bottomTrailing) {
                    if theme == .sketch { Rectangle().fill(theme.highlight).frame(height: 10).padding(.leading, 22).padding(.bottom, 3) }
                }
        }
    }

    private var dateLabel: String {
        let pieces = summary.day.split(separator: "-").compactMap { Int($0) }
        guard pieces.count == 3 else { return summary.day }
        let calendar = Calendar(identifier: .gregorian)
        guard let date = calendar.date(from: DateComponents(year: pieces[0], month: pieces[1], day: pieces[2], hour: 12)) else { return summary.day }
        let weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
        return summary.day + "  " + weekdays[calendar.component(.weekday, from: date) - 1]
    }

    private var summaryPanel: some View {
        panel {
            HStack(spacing: 7) {
                Text(name.first.map { String($0).uppercased() } ?? "练")
                    .font(.system(size: 12, weight: .bold))
                    .frame(width: 25, height: 25).background(theme.light, in: Circle())
                    .accessibilityHidden(true)
                Text(name.isEmpty ? "训练记录" : name).font(.system(size: 14, weight: .bold)).lineLimit(1)
                Spacer(minLength: 0)
            }
            Divider().overlay(theme.line)
            if artwork.isEmpty {
                HStack { measure("分钟 · 时长", String(summary.minutes)); measure("组 · 已完成", String(summary.sets)); volume }
            } else {
                HStack(spacing: 6) {
                    SecondaryAnatomy.poster(artwork, figure: figure, intensity: intensity, tile: theme.tile)
                        .overlay(RoundedRectangle(cornerRadius: 7).strokeBorder(theme.line).allowsHitTesting(false))
                    VStack(spacing: 8) { measure("分钟 · 时长", String(summary.minutes)); measure("组 · 已完成", String(summary.sets)); volume }
                        .frame(width: 77)
                }
            }
        }
    }

    private var volume: some View { measure("kg · 容量", NativeWorkoutShareSummary.number(summary.volume), emphasized: true) }

    private func measure(_ label: String, _ value: String, emphasized: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.system(size: 22, weight: .heavy)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.45)
                .foregroundStyle(emphasized ? SpotterPalette.color(0x245d9b) : theme.ink)
            Text(label).font(.system(size: 9, weight: .medium)).foregroundStyle(theme.quiet).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(6)
        .background(emphasized ? SpotterPalette.color(0xe1edf8) : theme.paper, in: RoundedRectangle(cornerRadius: 5))
        .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(theme == .sketch ? theme.ink : theme.line))
        .accessibilityElement(children: .combine)
    }

    private func detailPanel(_ workout: NativeWorkoutShareSummary.Workout) -> some View {
        panel {
            Text(summary.workouts.count > 1 ? workout.title : "训练明细")
                .font(.system(size: 15, weight: .bold)).fixedSize(horizontal: false, vertical: true)
            ForEach(Array(workout.moves.enumerated()), id: \.offset) { index, move in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 7) {
                        if !move.slot.isEmpty {
                            Text(move.slot).font(.system(size: 10, weight: .bold)).foregroundStyle(.white)
                                .padding(.horizontal, 6).padding(.vertical, 3)
                                .background(slotColor(move.slot), in: RoundedRectangle(cornerRadius: 4))
                        }
                        Text(move.name).font(.system(size: 14, weight: .bold)).fixedSize(horizontal: false, vertical: true)
                    }
                    Text(move.sets.joined(separator: "  ·  ")).font(.system(size: 12)).foregroundStyle(theme.quiet)
                        .fixedSize(horizontal: false, vertical: true)
                    if index + 1 < workout.moves.count { Divider().overlay(theme.line).padding(.top, 6) }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    private func slotColor(_ slot: String) -> Color {
        let colors: [Character: UInt32] = ["W": 0x68634f, "A": 0x2a70cf, "B": 0xb35408, "C": 0x1e7947, "D": 0xbd3827, "E": 0x167883]
        return SpotterPalette.color(slot.first.flatMap { colors[$0] } ?? 0x495e4d)
    }

    private func heartPanel(_ readings: ShareHeart, title: String) -> some View {
        panel {
            Text(summary.workouts.count > 1 ? title + " · 训练心率" : "训练心率").font(.system(size: 15, weight: .bold))
            let lowest = readings.minimum ?? readings.samples.map(\.bpm).min()
            let highest = readings.maximum ?? readings.samples.map(\.bpm).max()
            let numbers = [("平均", readings.average), ("最低", lowest), ("最高", highest)].compactMap { label, value in
                value.map { "\(label) \($0) bpm" }
            }
            Text(numbers.joined(separator: "   ·   ")).font(.system(size: 12)).foregroundStyle(theme.quiet)
            if readings.samples.count > 1 {
                Canvas { context, size in
                    let interval = max(1, Double(readings.to) - Double(readings.from))
                    let bottom = Double((lowest ?? 40) - 4), top = Double((highest ?? 190) + 4)
                    var path = Path()
                    for (index, point) in readings.samples.enumerated() {
                        let x = (Double(point.at) - Double(readings.from)) / interval
                        let y = (Double(point.bpm) - bottom) / max(1, top - bottom)
                        let location = CGPoint(x: CGFloat(x) * size.width, y: CGFloat(1 - y) * size.height)
                        if index == 0 { path.move(to: location) }
                        else { path.addLine(to: location) }
                    }
                    context.stroke(path, with: .color(SpotterPalette.color(0xba4960)), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                }
                .frame(height: 55).clipped().accessibilityLabel("训练心率曲线")
            }
        }
    }

    private func panel<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: 12)
        return VStack(alignment: .leading, spacing: 8, content: content)
            .frame(maxWidth: .infinity, alignment: .leading).padding(11)
            .background {
                if theme == .sketch { shape.fill(theme.ink).offset(x: 3, y: 4) }
                shape.fill(theme.tile)
            }
            .overlay(shape.strokeBorder(theme == .sketch ? theme.ink : theme.line, lineWidth: theme == .sketch ? 1.3 : 1))
    }
}
