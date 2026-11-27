import SwiftUI
import UIKit

/// Keep the launcher above presentations in the same scene. The hosting view can
/// present its own SwiftUI sheet without dismissing the screen underneath it.
@MainActor
struct NativeCoachOverlay<Content: View>: UIViewRepresentable {
    let visible: Bool
    let presenting: Bool
    @ViewBuilder let content: () -> Content

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> Anchor {
        let view = Anchor(frame: .zero)
        view.isUserInteractionEnabled = false
        view.accessibilityElementsHidden = true
        view.attach = { [weak coordinator = context.coordinator] window in
            coordinator?.attach(to: window)
        }
        return view
    }

    func updateUIView(_ view: Anchor, context: Context) {
        if let window = view.window { context.coordinator.attach(to: window) }
        context.coordinator.update(visible: visible, presenting: presenting, content: content())
    }

    static func dismantleUIView(_ view: Anchor, coordinator: Coordinator) {
        view.attach = nil
        coordinator.dismantle()
    }

    final class Anchor: UIView {
        var attach: ((UIWindow) -> Void)?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            // A full-screen presentation can temporarily detach the anchor.
            if let window { attach?(window) }
        }
    }

    @MainActor
    final class Coordinator {
        private weak var appWindow: UIWindow?
        private weak var previousKeyWindow: UIWindow?
        private var coachWindow: NativeCoachTouchWindow?
        private var host: UIHostingController<Content>?
        private var content: Content?
        private var needsUpdate = false
        private var visible = false
        private var presenting = false

        func attach(to window: UIWindow) {
            guard appWindow !== window else { return }
            appWindow = window
            scheduleUpdate()
        }

        func update(visible: Bool, presenting: Bool, content: Content) {
            self.visible = visible
            self.presenting = presenting
            self.content = content
            scheduleUpdate()
        }

        private func scheduleUpdate() {
            guard !needsUpdate else { return }
            needsUpdate = true
            DispatchQueue.main.async { [weak self] in
                guard let self, needsUpdate else { return }
                needsUpdate = false
                updateWindow()
            }
        }

        private func updateWindow() {
            guard let appWindow, let scene = appWindow.windowScene else { return }
            if let coachWindow, coachWindow.windowScene !== scene { removeWindow() }

            guard visible || presenting else {
                if let coachWindow {
                    restoreKeyWindow(from: coachWindow)
                    coachWindow.isHidden = true
                    coachWindow.acceptsSheetTouches = false
                }
                return
            }
            guard let content else { return }

            let window: NativeCoachTouchWindow
            if let coachWindow, let host {
                window = coachWindow
                host.rootView = content
            } else {
                window = NativeCoachTouchWindow(windowScene: scene)
                window.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.normal.rawValue + 1)
                window.isOpaque = false
                window.backgroundColor = .clear
                let controller = UIHostingController(rootView: content)
                controller.view.isOpaque = false
                controller.view.backgroundColor = .clear
                window.rootViewController = controller
                coachWindow = window
                host = controller
            }

            if window.overrideUserInterfaceStyle != appWindow.overrideUserInterfaceStyle {
                window.overrideUserInterfaceStyle = appWindow.overrideUserInterfaceStyle
            }
            window.isHidden = false
            if presenting, !window.acceptsSheetTouches {
                previousKeyWindow = scene.keyWindow ?? appWindow
                previousKeyWindow?.endEditing(true)
                window.acceptsSheetTouches = true
                window.makeKey()
            } else if !presenting, window.acceptsSheetTouches {
                restoreKeyWindow(from: window)
                window.acceptsSheetTouches = false
            }
        }

        private func restoreKeyWindow(from window: UIWindow) {
            defer { previousKeyWindow = nil }
            guard window.isKeyWindow, let scene = window.windowScene else { return }
            if let previousKeyWindow, previousKeyWindow.windowScene === scene, !previousKeyWindow.isHidden {
                previousKeyWindow.makeKey()
            } else if let appWindow, appWindow.windowScene === scene, !appWindow.isHidden {
                appWindow.makeKey()
            }
        }

        private func removeWindow() {
            if let coachWindow {
                restoreKeyWindow(from: coachWindow)
                coachWindow.isHidden = true
                coachWindow.rootViewController = nil
            }
            host = nil
            coachWindow = nil
        }

        func dismantle() {
            needsUpdate = false
            content = nil
            removeWindow()
            appWindow = nil
        }
    }
}

@MainActor
struct NativeCoachOverlayTouchTarget: UIViewRepresentable {
    func makeUIView(context: Context) -> Target {
        let view = Target(frame: .zero)
        view.isUserInteractionEnabled = false
        view.accessibilityElementsHidden = true
        return view
    }

    func updateUIView(_ view: Target, context: Context) {}

    final class Target: UIView {
        override func didMoveToWindow() {
            super.didMoveToWindow()
            (window as? NativeCoachTouchWindow)?.touchTarget = self
        }
    }
}

private final class NativeCoachTouchWindow: UIWindow {
    weak var touchTarget: UIView?
    var acceptsSheetTouches = false

    override var canBecomeKey: Bool { acceptsSheetTouches }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        if !acceptsSheetTouches {
            guard let touchTarget, touchTarget.window === self,
                  touchTarget.bounds.contains(touchTarget.convert(point, from: self)) else { return nil }
        }
        return super.hitTest(point, with: event)
    }
}
