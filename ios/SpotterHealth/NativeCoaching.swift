import SwiftUI

private struct CoachingRelationship: Decodable, Identifiable {
    let id: String
    let coachId: String
    let coachName: String
    let studentId: String
    let studentName: String
    let shareDetails: Bool
}

private struct CoachingAssignmentRow: Decodable, Identifiable {
    let id: String
    let title: String
    let note: String
    let coachName: String
    let studentName: String
    let viewerRole: String
    let startDate: String
    let sessionCount: Int
    let status: String

    var statusLabel: String {
        switch status {
        case "pending": "待确认"
        case "accepted": "已加入日程"
        case "declined": "已拒绝"
        case "cancelled": "已撤回"
        default: "状态待同步"
        }
    }
}

private struct CoachingPlanSource: Decodable, Identifiable {
    let id: String
    let title: String
    let kind: String
    let sessionCount: Int
    let expectedHash: String?
    var key: String { kind + ":" + id }
}

private struct CoachingHomeData: Decodable {
    let viewerId: String
    let links: [CoachingRelationship]
    let assignments: [CoachingAssignmentRow]
    let sources: [CoachingPlanSource]
}

private struct CoachingInviteData: Decodable {
    struct Invite: Decodable {
        let code: String
    }
    let invite: Invite
}

private struct CoachingInviteReview: Decodable {
    let coachName: String
}

private struct CoachingSourceResponse: Decodable {
    let source: CoachingPlanSource
}

private struct CoachingAssignmentPreview: Decodable, Identifiable {
    struct Preview: Decodable {
        struct Item: Decodable, Identifiable {
            let id: String
            let title: String
            let date: String
            let reason: String
        }
        let revision: String
        let token: String
        let items: [Item]
    }
    let assignment: CoachingAssignmentRow
    let preview: Preview
    var id: String { assignment.id }
}

@MainActor
struct NativeCoachingView: View {
    let api: NativeAPI
    let owner: String
    @State private var home: CoachingHomeData?
    @State private var isBusy = false
    @State private var notice: String?
    @State private var failure: String?
    @State private var inviteCode: String?
    @State private var receivedCode = ""
    @State private var reviewedCode: String?
    @State private var inviteReview: CoachingInviteReview?
    @State private var student = ""
    @State private var sourceKey = ""
    @State private var start = Date.now
    @State private var attempt = SendAttempt()
    @State private var assignmentPreview: CoachingAssignmentPreview?

    private struct SendAttempt {
        var fields: [String] = []
        var id = UUID().uuidString.lowercased()

        mutating func identifier(for fields: [String]) -> String {
            if self.fields != fields { self = SendAttempt(fields: fields) }
            return id
        }
    }

    private let endpoint = "/api/coaching"
    private var students: [CoachingRelationship] { home?.links.filter { $0.coachId == owner } ?? [] }
    private var sources: [CoachingPlanSource] { home?.sources ?? [] }
    private var normalizedCode: String { receivedCode.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }

    var body: some View {
        List {
            if let failure {
                Section {
                    Text(failure).foregroundStyle(.red)
                    Button("重新读取") { Task { await reload() } }
                }
            }
            if let notice { Text(notice).foregroundStyle(.secondary) }
            if isBusy { ProgressView("正在同步") }
            if let home {
                relationships(home.links)
                invitations
                if !students.isEmpty { assignmentForm }
                assignments(home.assignments)
            }
        }
        .navigationTitle("教练与学员")
        .task(id: owner) { await reload() }
        .refreshable { await reload() }
        .sheet(item: $assignmentPreview) { review in
            NavigationStack {
                List {
                    Section(review.assignment.title) {
                        ForEach(review.preview.items) { item in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.title)
                                Text([item.date, item.reason].filter { !$0.isEmpty }.joined(separator: " · "))
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    if let failure { Text(failure).foregroundStyle(.red) }
                    Button("确认加入训练日程") {
                        Task {
                            await mutate({
                                try await api.spotterSend(endpoint, body: [
                                    "action": "accept", "assignmentId": review.id, "revision": review.preview.revision,
                                    "previewToken": review.preview.token, "confirmed": true
                                ])
                                assignmentPreview = nil
                            }, success: "已加入训练日程。")
                        }
                    }
                    .disabled(isBusy)
                }
                .navigationTitle("核对训练计划")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { assignmentPreview = nil }.disabled(isBusy)
                } }
            }
            .presentationDragIndicator(.visible)
        }
    }

    private func relationships(_ links: [CoachingRelationship]) -> some View {
        Section("当前关系") {
            if links.isEmpty { Text("还没有教练或学员。").foregroundStyle(.secondary) }
            ForEach(links) { link in
                if link.coachId == owner {
                    Label(link.studentName, systemImage: "person")
                        .accessibilityLabel("学员 \(link.studentName)")
                } else if link.studentId == owner {
                    Toggle(isOn: Binding(get: { link.shareDetails }, set: { value in
                        Task {
                            await mutate {
                                try await api.spotterSend(endpoint, body: [
                                    "action": "sharing", "linkId": link.id, "shareDetails": value
                                ])
                            }
                        }
                    })) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("教练 \(link.coachName)")
                            Text("分享已分配训练的实际组数与记录").font(.caption).foregroundStyle(.secondary)
                        }
                    }.disabled(isBusy)
                }
            }
        }
    }

    private var invitations: some View {
        Section("建立关系") {
            Button("生成学员邀请码") {
                Task {
                    await mutate {
                        let data = try await api.spotterSend(endpoint, body: ["action": "invite"])
                        inviteCode = try JSONDecoder().decode(CoachingInviteData.self, from: data).invite.code
                    }
                }
            }.disabled(isBusy)
            if let inviteCode { ShareLink(item: inviteCode) { Label("分享一次性邀请码", systemImage: "square.and.arrow.up") } }
            TextField("教练发给你的邀请码", text: $receivedCode)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            Button("检查邀请码") {
                let code = normalizedCode
                Task {
                    await mutate {
                        let data = try await api.spotterSend(endpoint, body: ["action": "inspectInvite", "code": code])
                        inviteReview = try JSONDecoder().decode(CoachingInviteReview.self, from: data)
                        reviewedCode = code
                    }
                }
            }.disabled(isBusy || normalizedCode.count != 64)
            if let inviteReview, let reviewedCode, reviewedCode == normalizedCode {
                Button("确认成为 \(inviteReview.coachName) 的学员") {
                    Task {
                        await mutate({
                            try await api.spotterSend(endpoint, body: [
                                "action": "join", "code": reviewedCode, "confirmed": true, "shareDetails": false
                            ])
                            receivedCode = ""
                            self.inviteReview = nil
                        }, success: "已建立教练关系。")
                    }
                }.disabled(isBusy)
            }
        }
    }

    private var assignmentForm: some View {
        Section("发训练计划") {
            if sources.isEmpty {
                Text("先在训练中保存一份计划。").foregroundStyle(.secondary)
            } else {
                Picker("学员", selection: $student) {
                    Text("选择学员").tag("")
                    ForEach(students) { Text($0.studentName).tag($0.id) }
                }
                Picker("已有计划", selection: $sourceKey) {
                    Text("选择计划").tag("")
                    ForEach(sources, id: \.key) { Text("\($0.title) · \($0.sessionCount) 堂").tag($0.key) }
                }
                DatePicker("开始日期", selection: $start, displayedComponents: .date)
                Button("发给学员") {
                    guard let source = sources.first(where: { $0.key == sourceKey }),
                          students.contains(where: { $0.id == student }) else { return }
                    let linkId = student
                    let day = spotterDay(start)
                    Task {
                        await mutate({
                            var components = URLComponents()
                            components.queryItems = [
                                URLQueryItem(name: "sourceKind", value: source.kind),
                                URLQueryItem(name: "sourceId", value: source.id)
                            ]
                            let path = endpoint + "?" + (components.percentEncodedQuery ?? "")
                            let response = try await api.spotterRead(path, as: CoachingSourceResponse.self)
                            guard let hash = response.source.expectedHash else { throw CoachingViewError.invalidSource }
                            let requestId = attempt.identifier(for: [linkId, source.key, day, hash])
                            try await api.spotterSend(endpoint, body: [
                                "action": "send", "linkId": linkId, "requestId": requestId, "startDate": day,
                                "source": ["id": source.id, "kind": source.kind, "expectedHash": hash]
                            ])
                            attempt = SendAttempt()
                        }, success: "已发给学员，等待对方确认。")
                    }
                }.disabled(isBusy || student.isEmpty || sourceKey.isEmpty)
            }
        }
    }

    private func assignments(_ values: [CoachingAssignmentRow]) -> some View {
        Section("计划记录") {
            if values.isEmpty { Text("还没有收到或发出的训练计划。").foregroundStyle(.secondary) }
            ForEach(values) { item in
                VStack(alignment: .leading, spacing: 7) {
                    Text(item.title).font(.headline)
                    Text("\(item.viewerRole == "student" ? item.coachName : item.studentName) · \(item.startDate) · \(item.sessionCount) 堂 · \(item.statusLabel)")
                        .font(.caption).foregroundStyle(.secondary)
                    if !item.note.isEmpty { Text(item.note).font(.subheadline) }
                    if item.viewerRole == "student", item.status == "pending" {
                        Button("预览并接受") {
                            Task {
                                await mutate({
                                    let data = try await api.spotterSend(endpoint, body: ["action": "preview", "assignmentId": item.id])
                                    assignmentPreview = try JSONDecoder().decode(CoachingAssignmentPreview.self, from: data)
                                }, refresh: false)
                            }
                        }.buttonStyle(.bordered).disabled(isBusy)
                    }
                }
            }
        }
    }

    private func loadHome() async throws {
        let result = try await api.spotterRead(endpoint, as: CoachingHomeData.self)
        guard result.viewerId == owner else {
            home = nil
            throw CoachingViewError.accountChanged
        }
        home = result
    }

    private func reload() async {
        await mutate({ try await loadHome() }, refresh: false)
    }

    private func mutate(_ action: () async throws -> Void, success: String? = nil, refresh: Bool = true) async {
        guard !isBusy else { return }
        isBusy = true
        failure = nil
        notice = nil
        defer { isBusy = false }
        do {
            try await action()
            notice = success
            if refresh { try await loadHome() }
        } catch is CancellationError {
            return
        } catch {
            failure = (error as? LocalizedError)?.errorDescription ?? "教练功能暂时无法同步。请检查网络后重试。"
        }
    }
}

private enum CoachingViewError: LocalizedError {
    case accountChanged
    case invalidSource

    var errorDescription: String? {
        switch self {
        case .accountChanged: "登录账号已切换，请重新打开教练与学员。"
        case .invalidSource: "此计划暂时无法发送，请重新选择。"
        }
    }
}
