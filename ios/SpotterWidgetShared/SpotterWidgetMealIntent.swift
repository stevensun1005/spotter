import AppIntents
import Foundation

@available(iOS 17.0, *)
struct SpotterWidgetMealIntent: AppIntent {
    static let title: LocalizedStringResource = "记一份常用餐"
    static let description = IntentDescription("把桌面所选的一份常用餐加入今天的饮食记录。")
    static let isDiscoverable = false
    static let openAppWhenRun = true
    @available(iOS 26.0, *)
    static let supportedModes: IntentModes = .foreground(.immediate)

    @Parameter(title: "常用餐") var mealID: String
    @Parameter(title: "记录日期") var day: String

    init() {}

    init(mealID: String, day: String) {
        self.mealID = mealID
        self.day = day
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let name = try await log()
        return .result(dialog: "已记录一份\(name)。")
    }

    @MainActor
    private func log() async throws -> String {
        #if SPOTTER_WIDGET_EXTENSION
        throw SpotterWidgetMealError.openApp
        #else
        return try await NativeWidgetMealAction.log(mealID: mealID, day: day)
        #endif
    }
}

enum SpotterWidgetMealError: LocalizedError {
    case openApp, outdated, missingMeal, inProgress

    var errorDescription: String? {
        switch self {
        case .openApp: return "请先打开训练搭子并登录，再试一次。"
        case .outdated: return "日期已变更。请打开训练搭子更新今天的小组件。"
        case .missingMeal: return "这个常用餐已从桌面移除。请在常用餐里重新选择。"
        case .inProgress: return "这份常用餐正在保存，请稍候。"
        }
    }
}
