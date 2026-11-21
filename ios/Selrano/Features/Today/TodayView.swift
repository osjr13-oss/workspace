import SwiftUI

struct TodayView: View {
    @Environment(Session.self) private var session
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL
    @State private var today: TodayData?
    @State private var todayFailed = false
    @State private var threads: [ChatThread]?
    @State private var notes: [Note]?
    @State private var question = ""
    @State private var appeared = false
    @FocusState private var asking: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    askBox
                    StarterGrid { prompt in router.startChat(with: prompt) }
                        .padding(.bottom, 6)
                    Group {
                        calendarCard
                        chatsCard
                        moneyCard
                        notesCard
                        memoriesCard
                    }
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 14)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
            }
            .background(Theme.paper.ignoresSafeArea())
            .refreshable { await load() }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Note.self) { NoteEditorView(note: $0) {} }
            .task {
                await load()
                withAnimation(.spring(duration: 0.6).delay(0.05)) { appeared = true }
            }
        }
    }

    // MARK: Header and ask box

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(Date().formatted(.dateTime.weekday(.wide).month(.wide).day()))
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.muted)
            Text(Format.greeting(name: session.firstName))
                .font(Theme.display(36))
                .foregroundStyle(Theme.ink)
                .minimumScaleFactor(0.7)
                .lineLimit(2)
        }
        .padding(.top, 18)
    }

    private var askBox: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Ask Selrano anything", text: $question, axis: .vertical)
                .font(.system(size: 16))
                .lineLimit(1...5)
                .focused($asking)
                .submitLabel(.send)
                .onSubmit(ask)
                .padding(.vertical, 14)
                .padding(.leading, 16)
            Button(action: ask) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color(hex: 0xFDFBF7))
                    .frame(width: 36, height: 36)
                    .background(question.trimmingCharacters(in: .whitespaces).isEmpty ? Theme.borderStrong : Theme.accent, in: Circle())
            }
            .accessibilityLabel("Send message")
            .padding(.trailing, 8)
            .padding(.bottom, 8)
        }
        .background(Color.white, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(asking ? Theme.accent.opacity(0.4) : Theme.borderStrong, lineWidth: 1))
        .shadow(color: Theme.accent.opacity(0.08), radius: 16, y: 6)
    }

    private func ask() {
        let text = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        question = ""
        asking = false
        router.startChat(with: text)
    }

    // MARK: Cards

    @ViewBuilder
    private var calendarCard: some View {
        if today?.calendar.status != "unavailable" {
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    CardHeader(title: "Coming up", systemImage: "calendar")
                    if let section = today?.calendar {
                        switch section.status {
                        case "ready":
                            let events = (section.data?.events ?? []).filter { ["Today", "Tomorrow"].contains(dayLabel($0)) }
                            if events.isEmpty {
                                Text("Nothing on your calendar today or tomorrow.")
                                    .font(.system(size: 14)).foregroundStyle(Theme.inkSoft)
                            } else {
                                ForEach(Array(Dictionary(grouping: events, by: dayLabel).sorted { $0.key > $1.key }), id: \.key) { day, items in
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text(day).font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.muted)
                                        ForEach(items) { event in eventRow(event) }
                                    }
                                }
                            }
                        case "not_connected":
                            EmptyNote(text: "Connect Google to see what is coming up here and ask about your calendar and email in chat.", actionTitle: "Connect on selrano.com") {
                                openURL(AppConfig.baseURL.appending(path: "/settings"))
                            }
                        default:
                            couldNotLoad
                        }
                    } else if todayFailed {
                        couldNotLoad
                    } else {
                        SkeletonLines(count: 2)
                    }
                }
            }
        }
    }

    private func eventRow(_ event: CalendarEvent) -> some View {
        let start = Format.date(event.start) ?? .distantFuture
        let end = Format.date(event.end)
        let now = Date()
        let happening = !event.allDay && start <= now && (end.map { $0 > now } ?? false)
        return HStack(alignment: .top, spacing: 12) {
            Text(event.allDay ? "All day" : happening ? "Now" : Format.time(event.start))
                .font(.system(size: 14, weight: happening ? .semibold : .regular))
                .monospacedDigit()
                .foregroundStyle(happening ? Theme.accent : Theme.inkSoft)
                .frame(width: 72, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(event.title).font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.ink)
                if let location = event.location {
                    Text(location).font(.system(size: 13)).foregroundStyle(Theme.muted).lineLimit(1)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func dayLabel(_ event: CalendarEvent) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = Format.easternTime
        let date: Date
        if event.allDay {
            var parsing = DateComponents()
            let parts = event.start.prefix(10).split(separator: "-").compactMap { Int($0) }
            guard parts.count == 3 else { return "" }
            parsing.year = parts[0]; parsing.month = parts[1]; parsing.day = parts[2]; parsing.hour = 12
            date = calendar.date(from: parsing) ?? .distantFuture
        } else {
            date = Format.date(event.start) ?? .distantFuture
        }
        if calendar.isDateInToday(date) || date < Date() { return "Today" }
        if calendar.isDateInTomorrow(date) { return "Tomorrow" }
        return ""
    }

    private var chatsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                CardHeader(title: "Pick up where you left off", systemImage: "bubble.left")
                if let threads {
                    if threads.isEmpty {
                        Text("Your conversations will show up here.").font(.system(size: 14)).foregroundStyle(Theme.inkSoft)
                    }
                    ForEach(threads.prefix(4)) { thread in
                        Button { router.openChat(thread) } label: {
                            row(icon: "bubble.left", title: Format.clean(thread.title), detail: Format.relative(thread.updated_at))
                        }
                        .buttonStyle(PressableStyle())
                    }
                } else {
                    SkeletonLines(count: 3)
                }
            }
        }
    }

    @ViewBuilder
    private var moneyCard: some View {
        if today?.money.status != "unavailable" {
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    CardHeader(title: "This month", systemImage: "wallet.bifold") {
                        if today?.money.status == "ready" {
                            Button("Money") { router.tab = .money }.font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.muted)
                        }
                    }
                    if let section = today?.money {
                        switch section.status {
                        case "ready":
                            if let money = section.data, money.hasTransactions {
                                MoneySnapshot(money: money)
                            } else {
                                Text("No transactions synced yet. Open Money to refresh.").font(.system(size: 14)).foregroundStyle(Theme.inkSoft)
                            }
                        case "not_connected":
                            EmptyNote(text: "Connect a bank to see this month's spending here. Read only: Selrano never moves money.", actionTitle: "Connect on selrano.com") {
                                openURL(AppConfig.baseURL.appending(path: "/money"))
                            }
                        default:
                            couldNotLoad
                        }
                    } else if todayFailed {
                        couldNotLoad
                    } else {
                        SkeletonLines(count: 3)
                    }
                }
            }
        }
    }

    private var notesCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                CardHeader(title: "Notes", systemImage: "book.closed") {
                    Button("All notes") { router.tab = .notes }.font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.muted)
                }
                if let notes {
                    if notes.isEmpty {
                        Text("Notes you write, or ask Selrano to save, land here.").font(.system(size: 14)).foregroundStyle(Theme.inkSoft)
                    }
                    ForEach(notes) { note in
                        NavigationLink(value: note) {
                            row(icon: "book.closed", title: Format.clean(note.title), detail: Format.relative(note.updated_at))
                        }
                        .buttonStyle(PressableStyle())
                    }
                } else {
                    SkeletonLines(count: 2)
                }
            }
        }
    }

    @ViewBuilder
    private var memoriesCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                CardHeader(title: "Pinned memories", systemImage: "pin")
                if let section = today?.memories {
                    let memories = section.data?.memories ?? []
                    if memories.isEmpty {
                        Text("Pin what Selrano should always keep in mind, or say \"remember that...\" in any chat.").font(.system(size: 14)).foregroundStyle(Theme.inkSoft)
                    }
                    ForEach(memories) { memory in
                        Text(memory.content)
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.inkSoft)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.paperRaised, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                } else if todayFailed {
                    couldNotLoad
                } else {
                    SkeletonLines(count: 2)
                }
            }
        }
    }

    private func row(icon: String, title: String, detail: String, detailColor: Color = Theme.muted) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 14)).foregroundStyle(Theme.muted).frame(width: 18)
            Text(title.isEmpty ? "Untitled" : title)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
            Spacer(minLength: 8)
            Text(detail).font(.system(size: 13, weight: .medium)).foregroundStyle(detailColor)
            Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.borderStrong)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
    }

    private var couldNotLoad: some View {
        Text("Could not load this right now. Pull down to try again.").font(.system(size: 14)).foregroundStyle(Theme.muted)
    }

    // MARK: Loading

    private func load() async {
        async let todayResult: TodayData? = try? session.api.get("/api/today")
        async let threadResult: [ChatThread]? = try? session.api.rows("chat_threads", query: "select=*&temporary=eq.false&order=updated_at.desc&limit=4")
        async let noteResult: [Note]? = try? session.api.rows("notes", query: "select=*&order=updated_at.desc&limit=3")
        let (t, c, n) = await (todayResult, threadResult, noteResult)
        withAnimation {
            today = t
            todayFailed = t == nil
            threads = c ?? threads ?? []
            notes = n ?? notes ?? []
        }
    }
}

struct MoneySnapshot: View {
    let money: TodayMoney
    @State private var grown = false

    var body: some View {
        let difference = money.thisMonth - money.lastMonthSameDay
        let comparison = money.lastMonthSameDay <= 0 ? "Spent so far this month."
            : abs(difference) < 1 ? "About the same as this point last month."
            : "\(Format.money(abs(difference))) \(difference > 0 ? "more" : "less") than this point last month."
        let top = max(money.categories.first?.total ?? 1, 1)
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(Format.money(money.thisMonth))
                    .font(Theme.display(38))
                    .foregroundStyle(Theme.ink)
                    .contentTransition(.numericText())
                Text(comparison).font(.system(size: 14)).foregroundStyle(Theme.inkSoft)
            }
            ForEach(Array(money.categories.enumerated()), id: \.offset) { index, category in
                VStack(alignment: .leading, spacing: 5) {
                    HStack {
                        Text(category.label).font(.system(size: 14, weight: .medium))
                        Spacer()
                        Text(Format.money(category.total)).font(.system(size: 14)).monospacedDigit().foregroundStyle(Theme.inkSoft)
                    }
                    GeometryReader { proxy in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Theme.accentSoft)
                            Capsule().fill(Theme.accent)
                                .frame(width: grown ? max(6, proxy.size.width * category.total / top) : 0)
                                .animation(.spring(duration: 0.8).delay(0.15 + Double(index) * 0.08), value: grown)
                        }
                    }
                    .frame(height: 6)
                }
            }
        }
        .onAppear { grown = true }
    }
}
