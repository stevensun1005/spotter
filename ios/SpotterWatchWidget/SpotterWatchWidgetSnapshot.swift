import Foundation
import WidgetKit

struct SpotterWatchWidgetSnapshot: Codable, Equatable {
    struct Active: Codable, Equatable {
        let completedSets: Int
        let totalSets: Int
        let isRunning: Bool
    }

    struct Next: Codable, Equatable {
        let title: String
        let scheduledDate: Date
    }

    var generatedAt: Date = .now
    var active: Active? = nil
    var next: Next? = nil

    var activeExpiration: Date { generatedAt.addingTimeInterval(8 * 60 * 60) }

    func active(at date: Date) -> Active? {
        date < activeExpiration ? active : nil
    }

    func next(at date: Date, calendar: Calendar = .current) -> Next? {
        guard let next, calendar.startOfDay(for: next.scheduledDate) >= calendar.startOfDay(for: date) else { return nil }
        return next
    }

    func refreshDates(after date: Date, calendar: Calendar = .current) -> [Date] {
        var dates = Set<Date>()
        if active != nil, activeExpiration > date { dates.insert(activeExpiration) }
        if let next = next(at: date, calendar: calendar) {
            let day = calendar.startOfDay(for: next.scheduledDate)
            for offset in -1...1 {
                if let boundary = calendar.date(byAdding: .day, value: offset, to: day), boundary > date {
                    dates.insert(boundary)
                }
            }
        }
        return dates.sorted()
    }
}

enum SpotterWatchWidgetStore {
    private static let group = "group.app.spotter.health"
    private static let filename = "spotter-watch-widget-v1.json"

    static let circularKind = "app.spotter.health.watch.training"
    static let nextKind = "app.spotter.health.watch.next"

    private static var file: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?
            .appendingPathComponent(filename)
    }

    static func read() -> SpotterWatchWidgetSnapshot? {
        guard let file, let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(SpotterWatchWidgetSnapshot.self, from: data)
    }

    static func write(_ snapshot: SpotterWatchWidgetSnapshot?) {
        guard let file else { return }
        let previous = read()
        if let snapshot {
            if let previous, previous.active == snapshot.active, previous.next == snapshot.next,
               (previous.active == nil || previous.activeExpiration > snapshot.generatedAt) { return }
            guard let data = try? JSONEncoder().encode(snapshot),
                  (try? data.write(to: file, options: .atomic)) != nil else { return }
        } else {
            guard FileManager.default.fileExists(atPath: file.path),
                  (try? FileManager.default.removeItem(at: file)) != nil else { return }
        }
        WidgetCenter.shared.reloadTimelines(ofKind: circularKind)
        WidgetCenter.shared.reloadTimelines(ofKind: nextKind)
    }
}
