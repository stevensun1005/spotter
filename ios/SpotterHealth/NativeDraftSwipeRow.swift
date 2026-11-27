import SwiftUI
import UIKit

/// Hosts a draft card in a native swipe row while the surrounding page scrolls.
@MainActor
struct NativeDraftSwipeRow<Content: View>: UIViewRepresentable {
    let onDelete: () -> Void
    @ViewBuilder let content: () -> Content

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> UITableView {
        let table = UITableView(frame: .zero, style: .plain)
        table.backgroundColor = .clear
        table.separatorStyle = .none
        table.contentInsetAdjustmentBehavior = .never
        table.showsVerticalScrollIndicator = false
        table.scrollsToTop = false
        table.bounces = false
        table.allowsSelection = false
        table.rowHeight = UITableView.automaticDimension
        table.estimatedRowHeight = 56
        // Leave UIKit's row swipe recognizer enabled. The parent owns vertical scrolling.
        table.panGestureRecognizer.isEnabled = false
        table.dataSource = context.coordinator
        table.delegate = context.coordinator
        return table
    }

    func updateUIView(_ table: UITableView, context: Context) {
        let environment = context.environment
        let configuration = UIHostingConfiguration {
            content()
                .environment(\.spotterAccent, environment.spotterAccent)
                .environment(\.spotterReduceMotion, environment.spotterReduceMotion)
                .environment(\.colorScheme, environment.colorScheme)
                .environment(\.layoutDirection, environment.layoutDirection)
                .dynamicTypeSize(environment.dynamicTypeSize)
        }
        .margins(.all, 0)
        context.coordinator.update(configuration: configuration, onDelete: onDelete, in: table)
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITableView, context: Context) -> CGSize? {
        guard let width = proposal.width, width.isFinite, width > 0 else { return nil }
        return context.coordinator.measure(width: width)
    }

    @MainActor
    final class Coordinator: NSObject, UITableViewDataSource, UITableViewDelegate {
        private var configuration: (any UIContentConfiguration)?
        private var measurementView: (UIView & UIContentView)?
        private var onDelete: (() -> Void)?

        func update(configuration: any UIContentConfiguration, onDelete: @escaping () -> Void, in table: UITableView) {
            let isInitialUpdate = self.configuration == nil
            self.configuration = configuration
            self.onDelete = onDelete
            if let measurementView {
                measurementView.configuration = configuration
            } else {
                measurementView = configuration.makeContentView()
            }
            if isInitialUpdate {
                table.reloadData()
            } else {
                table.cellForRow(at: IndexPath(row: 0, section: 0))?.contentConfiguration = configuration
            }
        }

        func measure(width: CGFloat) -> CGSize? {
            guard let measurementView else { return nil }
            let size = measurementView.systemLayoutSizeFitting(
                CGSize(width: width, height: UIView.layoutFittingCompressedSize.height),
                withHorizontalFittingPriority: .required, verticalFittingPriority: .fittingSizeLevel
            )
            return CGSize(width: width, height: max(44, ceil(size.height)))
        }

        func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { 1 }

        func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
            let cell = UITableViewCell()
            cell.backgroundColor = .clear
            cell.selectionStyle = .none
            cell.contentConfiguration = configuration
            return cell
        }

        func tableView(_ tableView: UITableView, trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
            let delete = UIContextualAction(style: .destructive, title: "删除") { [weak self] _, _, completion in
                // The existing confirmation owns the deletion and its list update.
                completion(false)
                self?.onDelete?()
            }
            delete.image = UIImage(systemName: "trash")
            let configuration = UISwipeActionsConfiguration(actions: [delete])
            configuration.performsFirstActionWithFullSwipe = false
            return configuration
        }
    }
}
