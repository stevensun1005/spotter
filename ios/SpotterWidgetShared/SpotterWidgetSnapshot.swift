import Foundation

/// A local summary of the signed-in user's activity and their buddy's shared check-ins.
struct SpotterWidgetSnapshot: Codable, Equatable, Sendable {
    struct Workout: Codable, Equatable, Sendable {
        let title: String
        let day: String
        let minutes: Int
        let planID: String?

        init(title: String, day: String, minutes: Int, planID: String? = nil) {
            self.title = SpotterWidgetSnapshot.widgetTitle(title, fallback: "训练计划")
            self.day = day
            self.minutes = min(1_440, max(0, minutes))
            self.planID = planID
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

    enum DayState: String, Codable, Sendable {
        case completed
        case rest
        case planned
        case none
        case unavailable
    }

    struct Buddy: Codable, Equatable, Sendable {
        let id: String
        let name: String
        let ownDays: [DayState]
        let buddyDays: [DayState]
        let todayTitle: String?
        let todayTime: String?
        let cheered: Bool

        init(id: String, name: String, ownDays: [DayState], buddyDays: [DayState],
             todayTitle: String? = nil, todayTime: String? = nil, cheered: Bool = false) {
            self.id = id
            self.name = SpotterWidgetSnapshot.widgetTitle(name, fallback: "训练搭子")
            self.ownDays = ownDays
            self.buddyDays = buddyDays
            self.todayTitle = SpotterWidgetSnapshot.optionalLabel(todayTitle, limit: 72)
            self.todayTime = SpotterWidgetSnapshot.optionalLabel(todayTime, limit: 24)
            self.cheered = cheered
        }
    }

    struct Nutrition: Codable, Equatable, Sendable {
        struct Goals: Codable, Equatable, Sendable {
            let calories: Double
            let protein: Double
            let carbs: Double
            let fat: Double
        }

        struct FrequentMeal: Codable, Equatable, Sendable {
            let id: String
            let name: String

            init(id: String, name: String) {
                self.id = id
                self.name = SpotterWidgetSnapshot.widgetTitle(name, fallback: "常用餐")
            }
        }

        let calories: Double
        let protein: Double
        let carbs: Double
        let fat: Double
        let waterML: Double
        let goals: Goals?
        let offersUpdatedEstimate: Bool?
        private let mealShortcuts: [FrequentMeal]?

        var frequentMeals: [FrequentMeal] { mealShortcuts ?? [] }

        private enum CodingKeys: String, CodingKey {
            case calories, protein, carbs, fat, waterML, goals, offersUpdatedEstimate
            case mealShortcuts = "frequentMeals"
        }

        init(calories: Double, protein: Double, carbs: Double, fat: Double, waterML: Double,
             goals: Goals? = nil, frequentMeals: [FrequentMeal] = [], offersUpdatedEstimate: Bool? = nil) {
            self.calories = calories
            self.protein = protein
            self.carbs = carbs
            self.fat = fat
            self.waterML = waterML
            self.goals = goals
            self.offersUpdatedEstimate = offersUpdatedEstimate
            self.mealShortcuts = frequentMeals.isEmpty ? nil : Array(frequentMeals.prefix(3))
        }
    }

    struct WeekDay: Codable, Equatable, Sendable {
        let trainingState: DayState
        let trainingProgress: Double
        let nutritionProgress: Double?
        let hasNutritionRecord: Bool?
    }

    struct Weekly: Codable, Equatable, Sendable {
        let weekStart: String
        let dailyMinutes: [Int]
        let trainingDays: Int
        let totalMinutes: Int
        let completedSets: Int
        let previousTrainingDays: Int
    }

    struct Year: Codable, Equatable, Sendable {
        /// Completed training minutes keyed by local date. A missing date has no completed training.
        let dailyMinutes: [String: Int]
    }

    let updatedAt: Date
    let day: String
    let todayCompleted: Int
    let weekStart: String
    let weekCheckins: [Bool]
    let nextWorkout: Workout?
    let activeWorkout: Active?
    let buddy: Buddy?
    let nutrition: Nutrition?
    let weekly: Weekly?
    let year: Year?
    let progressWeek: [WeekDay]?

    init(updatedAt: Date, day: String, todayCompleted: Int, weekStart: String, weekCheckins: [Bool],
         nextWorkout: Workout?, activeWorkout: Active?, buddy: Buddy? = nil, nutrition: Nutrition? = nil,
         weekly: Weekly? = nil, year: Year? = nil, progressWeek: [WeekDay]? = nil) {
        self.updatedAt = updatedAt
        self.day = day
        self.todayCompleted = todayCompleted
        self.weekStart = weekStart
        self.weekCheckins = weekCheckins
        self.nextWorkout = nextWorkout
        self.activeWorkout = activeWorkout
        self.buddy = buddy
        self.nutrition = nutrition
        self.weekly = weekly
        self.year = year
        self.progressWeek = progressWeek
    }

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

    static func weekDays(startingAt day: String) -> [String] {
        let calendar = calendar(in: .gmt)
        guard let start = midnight(day, in: calendar), calendar.component(.weekday, from: start) == 2 else {
            return []
        }
        return (0..<7).compactMap { offset in
            calendar.date(byAdding: .day, value: offset, to: start).map { dayKey(for: $0, timeZone: .gmt) }
        }
    }

    static func isDayKey(_ value: String) -> Bool {
        midnight(value, in: calendar(in: .gmt)) != nil
    }

    static func isEntryID(_ value: String) -> Bool {
        (1...120).contains(value.utf16.count) &&
        value == value.trimmingCharacters(in: .whitespacesAndNewlines) &&
        value.rangeOfCharacter(from: .controlCharacters) == nil
    }

    static func yearDays(endingAt date: Date, timeZone: TimeZone = .current) -> [String?] {
        yearDays(endingOn: dayKey(for: date, timeZone: timeZone))
    }

    /// A trailing 365-day window, arranged in Monday-first columns.
    /// Dates outside the window are represented by nil, including the rows after today.
    static func yearDays(endingOn day: String) -> [String?] {
        let calendar = calendar(in: .gmt)
        guard let end = midnight(day, in: calendar),
              let start = calendar.date(byAdding: .day, value: -364, to: end) else { return [] }
        let leading = (calendar.component(.weekday, from: start) + 5) % 7
        let trailing = (7 - ((leading + 365) % 7)) % 7
        let dates = (0..<365).map { offset in
            calendar.date(byAdding: .day, value: offset, to: start).map { dayKey(for: $0, timeZone: .gmt) }
        }
        return Array(repeating: nil, count: leading) + dates + Array(repeating: nil, count: trailing)
    }

    private static func calendar(in timeZone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar
    }

    private static func widgetTitle(_ value: String, fallback: String) -> String {
        optionalLabel(value, limit: 72) ?? fallback
    }

    private static func optionalLabel(_ value: String?, limit: Int) -> String? {
        guard let value else { return nil }
        let compact = value.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        return compact.isEmpty ? nil : String(compact.prefix(limit))
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
                  (0...1_440).contains(nextWorkout.minutes), (1...72).contains(nextWorkout.title.count),
                  nextWorkout.planID.map(Self.isEntryID) != false else { return false }
        }
        if let activeWorkout {
            guard (0...10_000).contains(activeWorkout.totalSets),
                  (0...activeWorkout.totalSets).contains(activeWorkout.completedSets),
                  (1...72).contains(activeWorkout.title.count) else { return false }
        }
        if let buddy {
            guard (1...256).contains(buddy.id.utf8.count), (1...72).contains(buddy.name.count),
                  buddy.ownDays.count == 7, buddy.buddyDays.count == 7,
                  (buddy.todayTitle?.count ?? 0) <= 72, (buddy.todayTime?.count ?? 0) <= 24 else { return false }
        }
        if let nutrition {
            let totals = [nutrition.calories, nutrition.protein, nutrition.carbs, nutrition.fat, nutrition.waterML]
            guard totals.allSatisfy({ $0.isFinite && $0 >= 0 }) else { return false }
            if let goals = nutrition.goals {
                guard [goals.calories, goals.protein, goals.carbs, goals.fat].allSatisfy({ $0.isFinite && $0 >= 0 })
                else { return false }
            }
            guard nutrition.frequentMeals.count <= 3,
                  nutrition.frequentMeals.allSatisfy({
                      (1...256).contains($0.id.utf8.count) && (1...72).contains($0.name.count)
                  }),
                  Set(nutrition.frequentMeals.map(\.id)).count == nutrition.frequentMeals.count else { return false }
        }
        if let weekly {
            guard let start = Self.midnight(weekly.weekStart, in: calendar),
                  calendar.component(.weekday, from: start) == 2, start <= firstDay,
                  weekly.dailyMinutes.count == 7, weekly.dailyMinutes.allSatisfy({ $0 >= 0 }),
                  (0...7).contains(weekly.trainingDays), (0...7).contains(weekly.previousTrainingDays),
                  weekly.totalMinutes >= 0, weekly.completedSets >= 0 else { return false }
        }
        if let year {
            guard year.dailyMinutes.count <= 365,
                  let first = calendar.date(byAdding: .day, value: -364, to: currentDay),
                  year.dailyMinutes.allSatisfy({ key, minutes in
                      guard let date = Self.midnight(key, in: calendar) else { return false }
                      return date >= first && date <= currentDay && minutes >= 0
                  }) else { return false }
        }
        if let progressWeek {
            guard progressWeek.count == 7, progressWeek.allSatisfy({
                (0...1).contains($0.trainingProgress) && ($0.nutritionProgress.map { (0...1).contains($0) } ?? true)
            }) else { return false }
        }
        return true
    }

    fileprivate func matchesVisibleContent(of other: Self) -> Bool {
        day == other.day && todayCompleted == other.todayCompleted && weekStart == other.weekStart &&
            weekCheckins == other.weekCheckins && nextWorkout == other.nextWorkout && activeWorkout == other.activeWorkout &&
            buddy == other.buddy && nutrition == other.nutrition && weekly == other.weekly && year == other.year &&
            progressWeek == other.progressWeek
    }
}

/// The widget gets only the app-group copy. No alternate file or account data is visible when it is unavailable.
struct SpotterWidgetStore: Sendable {
    static let groupIdentifier = "group.app.spotter.health"
    static let widgetKind = "SpotterTrainingWidget"
    static let buddyKind = "SpotterBuddyWidget"
    static let nutritionKind = "SpotterNutritionWidget"
    static let weeklyKind = "SpotterWeeklyWidget"
    static let yearKind = "SpotterYearWidget"
    static let progressWeekKind = "SpotterWeekProgressWidget"
    static let widgetKinds = [widgetKind, buddyKind, nutritionKind, weeklyKind, yearKind, progressWeekKind]
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
