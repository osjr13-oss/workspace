import SwiftUI

struct MoneyView: View {
    @Environment(Session.self) private var session
    @Environment(\.openURL) private var openURL
    @State private var overview: MoneyOverview?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let overview {
                        if !overview.configured || overview.items.isEmpty {
                            Card {
                                VStack(alignment: .leading, spacing: 12) {
                                    CardHeader(title: "Connect a bank", systemImage: "building.columns")
                                    EmptyNote(text: "Connect your bank once on selrano.com, then your spending, accounts and subscriptions show up here. Read only: Selrano never moves money.", actionTitle: "Open selrano.com") {
                                        openURL(AppConfig.baseURL.appending(path: "/money"))
                                    }
                                }
                            }
                        } else {
                            monthCard(overview)
                            accountsCard(overview.accounts)
                            transactionsCard(overview.recent ?? [])
                        }
                    } else if let error {
                        Card { Text(error).foregroundStyle(Theme.muted) }
                    } else {
                        Card { SkeletonLines(count: 4) }
                        Card { SkeletonLines(count: 3) }
                    }
                }
                .padding(16)
            }
            .background(Theme.paper.ignoresSafeArea())
            .navigationTitle("Money")
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func monthCard(_ overview: MoneyOverview) -> some View {
        let month = overview.thisMonth
        let top = max(month?.categories.first?.total ?? 1, 1)
        return Card {
            VStack(alignment: .leading, spacing: 14) {
                CardHeader(title: "This month", systemImage: "chart.bar")
                HStack(alignment: .firstTextBaseline, spacing: 18) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Spent").font(.system(size: 13)).foregroundStyle(Theme.muted)
                        Text(Format.money(month?.spending ?? 0)).font(Theme.display(32)).foregroundStyle(Theme.ink)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Came in").font(.system(size: 13)).foregroundStyle(Theme.muted)
                        Text(Format.money(month?.income ?? 0)).font(Theme.display(22)).foregroundStyle(Theme.inkSoft)
                    }
                }
                if let last = overview.lastMonth {
                    Text("Last month: \(Format.money(last.spending)) spent.").font(.system(size: 13)).foregroundStyle(Theme.muted)
                }
                ForEach(month?.categories.prefix(6).map { $0 } ?? []) { category in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text(category.label).font(.system(size: 14, weight: .medium))
                            Spacer()
                            Text(Format.money(category.total)).font(.system(size: 14)).monospacedDigit().foregroundStyle(Theme.inkSoft)
                        }
                        GeometryReader { proxy in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Theme.accentSoft)
                                Capsule().fill(Theme.accent).frame(width: max(6, proxy.size.width * category.total / top))
                            }
                        }
                        .frame(height: 6)
                    }
                }
            }
        }
    }

    private func accountsCard(_ accounts: [MoneyAccount]) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                CardHeader(title: "Accounts", systemImage: "building.columns")
                ForEach(accounts) { account in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(account.name).font(.system(size: 15, weight: .medium))
                            if let mask = account.mask {
                                Text("Ending \(mask)").font(.system(size: 12)).foregroundStyle(Theme.muted)
                            }
                        }
                        Spacer()
                        let balance = account.current_balance ?? 0
                        Text(account.type == "credit" ? "\(Format.money(balance)) owed" : Format.money(account.available_balance ?? balance))
                            .font(.system(size: 15, weight: .semibold))
                            .monospacedDigit()
                    }
                }
            }
        }
    }

    private func transactionsCard(_ transactions: [MoneyTransaction]) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                CardHeader(title: "Recent", systemImage: "list.bullet")
                if transactions.isEmpty {
                    Text("No transactions yet.").font(.system(size: 14)).foregroundStyle(Theme.muted)
                }
                ForEach(transactions.prefix(15)) { transaction in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(transaction.merchant_name ?? transaction.name).font(.system(size: 15, weight: .medium)).lineLimit(1)
                            Text(transaction.pending ? "\(transaction.date), pending" : transaction.date).font(.system(size: 12)).foregroundStyle(Theme.muted)
                        }
                        Spacer()
                        Text(transaction.amount < 0 ? "+\(Format.money(-transaction.amount))" : Format.money(transaction.amount))
                            .font(.system(size: 15, weight: .medium))
                            .monospacedDigit()
                            .foregroundStyle(transaction.amount < 0 ? Theme.good : Theme.ink)
                    }
                }
            }
        }
    }

    private func load() async {
        do {
            let result: MoneyOverview = try await session.api.get("/api/plaid")
            withAnimation { overview = result }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
