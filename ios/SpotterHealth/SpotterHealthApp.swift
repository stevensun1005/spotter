import SwiftUI

@main
@MainActor
struct SpotterHealthApp: App {
    @UIApplicationDelegateAdaptor(SpotterNotificationDelegate.self) private var notificationDelegate

    init() {
        if #available(iOS 17.0, *) { NativeWatchHeartRate.shared.prepare() }
    }

    var body: some Scene {
        WindowGroup { NativeSpotterApp() }
    }
}
