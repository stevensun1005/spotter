import Foundation

/// A local summary derived from the signed-in user's own training.
struct SpotterWidgetSnapshot: Codable, Equatable, Sendable {
    struct Workout: Codable, Equatable, Sendable {
        let title: String
        let day: String
        let minutes: Int

        init(title: String, day: String, minutes: Int) {
            self.title = SpotterWidgetSnapshot.widgetTitle(title, fallback: "训练计划")
            self.day = day
            self.minutes = min(1_440, max(0, minutes))
        }
    }

    struct Active: Codable, Equatable, Sendable {
        let title: String
        let completedSets: Int
        let totalSets: Int
        let isRunning: Bool

        init(title: String, completedSets: Int, totalSets: Int, isRunning: Bool) {
            self.title = SpotterWidgetSnapshot.widgetTitle(title, fallback: "当前训练")
            self.totalSets = min(10_000, max(0, totalSets))
            self.completedSets = min(self.totalSets, max(0, completedSets))
            self.isRunning = isRunning
        }
    }

    let updatedAt: Date
    let day: String
    let todayCompleted: Int
    let weekStart: String
    let weekCheckins: [Bool]
    let nextWorkout: Workout?
    let activeWorkout: Active?

    var expiresAt: Date { updatedAt.addingTimeInterval(36 * 60 * 60) }

    static func dayKey(for date: Date, timeZone: TimeZone = .current) -> String {
        let calendar = calendar(in: timeZone)
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    static func weekStartKey(for date: Date, timeZone: TimeZone = .current) -> String {
        let calendar = calendar(in: timeZone)
        let weekday = calendar.component(.weekday, from: date)
        let offset = (weekday + 5) % 7
        let start = calendar.date(byAdding: .day, value: -offset, to: date) ?? date
        return dayKey(for: start, timeZone: timeZone)
    }

    private static func calendar(in timeZone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar
    }

    private static func widgetTitle(_ value: String, fallback: String) -> String {
        let compact = value.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        return compact.isEmpty ? fallback : String(compact.prefix(72))
    }

    private static func midnight(_ key: String, in calendar: Calendar) -> Date? {
        let fields = key.split(separator: "-", omittingEmptySubsequences: false)
        guard fields.count == 3, fields[0].count == 4, fields[1].count == 2, fields[2].count == 2,
              let year = Int(fields[0]), let month = Int(fields[1]), let day = Int(fields[2]),
              (1...9_999).contains(year), (1...12).contains(month), (1...31).contains(day),
              let date = calendar.date(from: DateComponents(year: year, month: month, day: day)),
              dayKey(for: date, timeZone: calendar.timeZone) == key else { return nil }
        return date
    }

    fileprivate func isUsable(at date: Date) -> Bool {
        guard updatedAt.timeIntervalSinceReferenceDate.isFinite,
              updatedAt <= date.addingTimeInterval(5 * 60), date < expiresAt,
              (0...10_000).contains(todayCompleted), weekCheckins.count == 7,
              let zone = TimeZone(secondsFromGMT: 0) else { return false }
        let calendar = Self.calendar(in: zone)
        guard let currentDay = Self.midnight(day, in: calendar),
              let firstDay = Self.midnight(weekStart, in: calendar),
              calendar.component(.weekday, from: firstDay) == 2,
              currentDay >= firstDay,
              currentDay.timeIntervalSince(firstDay) < 7 * 24 * 60 * 60 else { return false }
        if let nextWorkout {
            guard nextWorkout.day >= day, Self.midnight(nextWorkout.day, in: calendar) != nil,
                  (0...1_440).contains(nextWorkout.minutes), (1...72).contains(nextWorkout.title.count) else { return false }
        }
        if let activeWorkout {
            guard (0...10_000).contains(activeWorkout.totalSets),
                  (0...activeWorkout.totalSets).contains(activeWorkout.completedSets),
                  (1...72).contains(activeWorkout.title.count) else { return false }
        }
        return true
    }

    fileprivate func matchesVisibleContent(of other: Self) -> Bool {
        day == other.day && todayCompleted == other.todayCompleted && weekStart == other.weekStart &&
            weekCheckins == other.weekCheckins && nextWorkout == other.nextWorkout && activeWorkout == other.activeWorkout
    }
}

/// The widget gets only the app-group copy. No alternate file or account data is visible when it is unavailable.
struct SpotterWidgetStore: Sendable {
    static let groupIdentifier = "group.app.spotter.health"
    static let widgetKind = "SpotterTrainingWidget"
    static let shared = Self(directoryURL: sharedDirectory)

    private static let filename = "spotter-training-widget-v1.json"
    private static let maximumBytes = 16_384
    private static let heartbeat: TimeInterval = 3 * 60 * 60
    private let fileURL: URL?

    init(directoryURL: URL?) {
        fileURL = directoryURL?.appendingPathComponent(Self.filename, isDirectory: false)
    }

    private static var sharedDirectory: URL? {
        #if os(iOS)
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupIdentifier)
        #else
        nil
        #endif
    }

    func read(at date: Date = .now) -> SpotterWidgetSnapshot? {
        guard let fileURL,
              let metadata = try? fileURL.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
              metadata.isRegularFile == true, let bytes = metadata.fileSize, (1...Self.maximumBytes).contains(bytes),
              let payload = try? Data(contentsOf: fileURL), payload.count <= Self.maximumBytes,
              let snapshot = try? JSONDecoder().decode(SpotterWidgetSnapshot.self, from: payload),
              snapshot.isUsable(at: date) else { return nil }
        return snapshot
    }

    @discardableResult
    func write(_ snapshot: SpotterWidgetSnapshot) -> Bool {
        guard let fileURL, snapshot.isUsable(at: snapshot.updatedAt) else { return false }
        if let current = read(at: snapshot.updatedAt), current.matchesVisibleContent(of: snapshot),
           snapshot.updatedAt.timeIntervalSince(current.updatedAt) < Self.heartbeat {
            return false
        }
        guard let payload = try? JSONEncoder().encode(snapshot), payload.count <= Self.maximumBytes else { return false }
        do {
            #if os(iOS)
            try payload.write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            #else
            try payload.write(to: fileURL, options: .atomic)
            #endif
            var target = fileURL
            var resources = URLResourceValues()
            resources.isExcludedFromBackup = true
            try? target.setResourceValues(resources)
            return true
        } catch {
            return false
        }
    }

    @discardableResult
    func remove() -> Bool {
        guard let fileURL else { return false }
        do {
            try FileManager.default.removeItem(at: fileURL)
            return true
        } catch {
            return false
        }
    }
}
