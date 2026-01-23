//
//  StatsView.swift
//  ZenFocus
//

import SwiftUI
import Charts

struct StatsView: View {
    @EnvironmentObject var statsManager: StatsManager
    @EnvironmentObject var settingsManager: SettingsManager
    @State private var selectedTimeRange: TimeRange = .week

    enum TimeRange: String, CaseIterable {
        case week = "Week"
        case month = "Month"
        case all = "All Time"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Quick stats cards
                    quickStatsSection

                    // Chart section
                    chartSection

                    // Streak section
                    streakSection

                    // History section
                    historySection
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Statistics")
        }
    }

    // MARK: - Quick Stats

    private var quickStatsSection: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            StatCard(
                title: "Today",
                value: formatTime(statsManager.todayMinutes),
                icon: "sun.max.fill",
                color: .orange
            )

            StatCard(
                title: "This Week",
                value: formatTime(statsManager.weekMinutes),
                icon: "calendar",
                color: settingsManager.accentColor
            )

            StatCard(
                title: "Total Focus",
                value: formatTime(statsManager.totalMinutes),
                icon: "clock.fill",
                color: .purple
            )

            StatCard(
                title: "Sessions",
                value: "\(statsManager.sessions.count)",
                icon: "checkmark.circle.fill",
                color: .green
            )
        }
    }

    // MARK: - Chart Section

    private var chartSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Focus Time")
                    .font(.headline)

                Spacer()

                Picker("Time Range", selection: $selectedTimeRange) {
                    ForEach(TimeRange.allCases, id: \.self) { range in
                        Text(range.rawValue).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 200)
            }

            if #available(iOS 16.0, *) {
                chartView
            } else {
                legacyChartView
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    @available(iOS 16.0, *)
    private var chartView: some View {
        let data = chartData

        return Chart(data) { item in
            BarMark(
                x: .value("Day", item.label),
                y: .value("Minutes", item.minutes)
            )
            .foregroundStyle(settingsManager.accentColor.gradient)
            .cornerRadius(4)
        }
        .frame(height: 200)
        .chartYAxis {
            AxisMarks(position: .leading)
        }
    }

    private var legacyChartView: some View {
        let data = chartData
        let maxValue = max(data.map { $0.minutes }.max() ?? 1, 1)

        return HStack(alignment: .bottom, spacing: 8) {
            ForEach(data) { item in
                VStack(spacing: 4) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(settingsManager.accentColor)
                        .frame(width: 30, height: CGFloat(item.minutes) / CGFloat(maxValue) * 150)

                    Text(item.label)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(height: 200)
    }

    private var chartData: [ChartDataPoint] {
        switch selectedTimeRange {
        case .week:
            return statsManager.dailyData(for: 7).map {
                ChartDataPoint(label: $0.dayName, minutes: $0.minutes)
            }
        case .month:
            return statsManager.weeklyData(for: 4).map {
                ChartDataPoint(label: $0.weekLabel, minutes: $0.minutes)
            }
        case .all:
            return statsManager.weeklyData(for: 8).map {
                ChartDataPoint(label: $0.weekLabel, minutes: $0.minutes)
            }
        }
    }

    // MARK: - Streak Section

    private var streakSection: some View {
        HStack(spacing: 16) {
            VStack(spacing: 8) {
                Image(systemName: "flame.fill")
                    .font(.title)
                    .foregroundStyle(.orange)

                Text("\(statsManager.currentStreak)")
                    .font(.title)
                    .fontWeight(.bold)

                Text("Current Streak")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))

            VStack(spacing: 8) {
                Image(systemName: "trophy.fill")
                    .font(.title)
                    .foregroundStyle(.yellow)

                Text("\(statsManager.longestStreak)")
                    .font(.title)
                    .fontWeight(.bold)

                Text("Best Streak")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    // MARK: - History Section

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Sessions")
                .font(.headline)

            if statsManager.sessions.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "clock.badge.questionmark")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)

                    Text("No sessions yet")
                        .foregroundStyle(.secondary)

                    Text("Complete a focus session to see your history here.")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
            } else {
                ForEach(statsManager.sessions.suffix(5).reversed()) { session in
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(formatDate(session.date))
                                .font(.subheadline)

                            Text(formatTime(session.duration))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                    .padding(.vertical, 8)

                    if session.id != statsManager.sessions.last?.id {
                        Divider()
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Helpers

    private func formatTime(_ minutes: Int) -> String {
        if minutes < 60 {
            return "\(minutes)m"
        }
        let hours = minutes / 60
        let mins = minutes % 60
        return mins > 0 ? "\(hours)h \(mins)m" : "\(hours)h"
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Supporting Views

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(color)

                Spacer()
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(value)
                    .font(.title2)
                    .fontWeight(.bold)

                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

struct ChartDataPoint: Identifiable {
    let id = UUID()
    let label: String
    let minutes: Int
}

#Preview {
    StatsView()
        .environmentObject(StatsManager())
        .environmentObject(SettingsManager())
}
