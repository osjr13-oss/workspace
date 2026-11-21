import Foundation

nonisolated struct ChatThread: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    let project_id: String?
    let active_leaf_id: String?
    let temporary: Bool?
    let created_at: String
    var updated_at: String
}

nonisolated struct Citation: Codable, Hashable {
    let kind: String?
    let marker: String?
    let fileId: String?
    let fileName: String?
    let title: String?
    let url: String?
    let label: String?
}

nonisolated struct ChatMessage: Codable, Identifiable, Hashable {
    var id: String
    let parent_id: String?
    let role: String
    var content: String
    var citations: [Citation]?
    let created_at: String

    init(id: String, parent_id: String? = nil, role: String, content: String, citations: [Citation]? = nil, created_at: String) {
        self.id = id
        self.parent_id = parent_id
        self.role = role
        self.content = content
        self.citations = citations
        self.created_at = created_at
    }

    var isUser: Bool { role == "user" }

    /// Files or pictures attached to a user's message.
    var attachedFileNames: [String] {
        (citations ?? []).compactMap { citation in
            guard let marker = citation.marker, marker.hasPrefix("attachment-"), let name = citation.fileName else { return nil }
            return name
        }
    }

    /// Sources worth showing under a reply: web pages and files, not internal tool notes.
    var visibleSources: [Citation] {
        (citations ?? []).filter { ($0.kind == "web" && $0.url != nil) || ($0.kind ?? "file") == "file" && $0.fileName != nil }
    }
}

/// Walks the active conversation branch (same contract as lib/chat-tree.ts on the web)
/// so edited questions and retried answers never appear twice in one thread.
nonisolated enum ChatTree {
    static func effectiveParents(_ rows: [ChatMessage]) -> [String: String?] {
        let ids = Set(rows.map(\.id))
        let firstLinked = rows.firstIndex { $0.parent_id != nil && ids.contains($0.parent_id!) } ?? rows.count
        var parents: [String: String?] = [:]
        for (index, row) in rows.enumerated() {
            if let parentId = row.parent_id, ids.contains(parentId) {
                parents[row.id] = parentId
            } else if index > 0 && (index < firstLinked || row.role == "assistant") {
                parents[row.id] = rows[index - 1].id
            } else {
                parents[row.id] = nil
            }
        }
        return parents
    }

    static func activePath(_ rows: [ChatMessage], leafId: String?) -> [ChatMessage] {
        guard !rows.isEmpty else { return [] }
        let byId = Dictionary(uniqueKeysWithValues: rows.map { ($0.id, $0) })
        let parents = effectiveParents(rows)
        var children: [String: [ChatMessage]] = [:]
        for row in rows {
            if let parent = parents[row.id] ?? nil {
                children[parent, default: []].append(row)
            }
        }
        var current: ChatMessage? = (leafId.flatMap { byId[$0] }) ?? rows.last
        // Follow newest descendants if leafId points to an ancestor.
        var seenDown = Set<String>()
        while let node = current, let next = children[node.id]?.last, !seenDown.contains(next.id) {
            seenDown.insert(node.id)
            current = next
        }
        var path: [ChatMessage] = []
        var seenUp = Set<String>()
        while let node = current, !seenUp.contains(node.id) {
            seenUp.insert(node.id)
            path.append(node)
            current = (parents[node.id] ?? nil).flatMap { byId[$0] }
        }
        return path.reversed()
    }
}

nonisolated struct Project: Codable, Identifiable, Hashable {
    let id: String
    let name: String
}

nonisolated struct Note: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var content: String
    var project_id: String?
    let created_at: String
    var updated_at: String
}

nonisolated struct WorkspaceFile: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let mime_type: String?
    let size_bytes: Int?
    let extraction_status: String
    let extracted_text: String?
    let storage_path: String?
    let created_at: String

    var statusLabel: String {
        switch extraction_status {
        case "ready": return "Searchable"
        case "pending": return "Processing"
        case "unsupported": return "Unsupported"
        default: return "Needs attention"
        }
    }
}

nonisolated struct Memory: Codable, Identifiable, Hashable {
    let id: String
    var content: String
    var pinned: Bool?
    let source: String?
    let created_at: String
    let updated_at: String?
}

nonisolated struct MemoryList: Codable { let memories: [Memory] }
nonisolated struct MemoryResult: Codable { let memory: Memory }

// MARK: Today (/api/today)

nonisolated struct TodaySection<T: Codable & Sendable>: Codable, Sendable {
    let status: String
    let data: T?
}

nonisolated struct CalendarEvent: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let start: String
    let end: String?
    let allDay: Bool
    let location: String?
    let link: String?
}

nonisolated struct TodayCalendar: Codable { let events: [CalendarEvent] }
nonisolated struct CategoryTotal: Codable, Hashable { let label: String; let total: Double }
nonisolated struct TodayMoney: Codable {
    let thisMonth: Double
    let lastMonthSameDay: Double
    let categories: [CategoryTotal]
    let hasTransactions: Bool
}
nonisolated struct PinnedMemory: Codable, Identifiable, Hashable { let id: String; let content: String }
nonisolated struct TodayMemories: Codable { let memories: [PinnedMemory] }

nonisolated struct TodayData: Codable {
    let calendar: TodaySection<TodayCalendar>
    let money: TodaySection<TodayMoney>
    let memories: TodaySection<TodayMemories>
}

// MARK: Money (/api/plaid)

nonisolated struct MoneyItem: Codable, Identifiable, Hashable {
    let item_id: String
    let institution_name: String?
    let status: String
    let last_synced_at: String?
    var id: String { item_id }
}

nonisolated struct MoneyAccount: Codable, Identifiable, Hashable {
    let account_id: String
    let name: String
    let mask: String?
    let type: String
    let current_balance: Double?
    let available_balance: Double?
    var id: String { account_id }
}

nonisolated struct MoneySummary: Codable, Hashable {
    let spending: Double
    let income: Double
    let categories: [MoneyCategory]
}

nonisolated struct MoneyCategory: Codable, Hashable, Identifiable {
    let category: String
    let label: String
    let total: Double
    var id: String { category }
}

nonisolated struct MoneyTransaction: Codable, Identifiable, Hashable {
    let transaction_id: String
    let date: String
    let name: String
    let merchant_name: String?
    let amount: Double
    let pending: Bool
    var id: String { transaction_id }
}

nonisolated struct MoneyOverview: Codable {
    let configured: Bool
    let items: [MoneyItem]
    let accounts: [MoneyAccount]
    let thisMonth: MoneySummary?
    let lastMonth: MoneySummary?
    let recent: [MoneyTransaction]?
}
