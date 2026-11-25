import SwiftUI

@main
@MainActor
struct SpotterHealthApp: App {
    init() {
        if #available(iOS 17.0, *) { NativeWatchHeartRate.shared.prepare() }
    }

    var body: some Scene {
        WindowGroup { NativeSpotterApp() }
    }
}
