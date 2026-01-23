//
//  StatsManager.swift
//  ZenFocus
//

import SwiftUI

class StatsManager: ObservableObject {
    @Published var sessions: [FocusSession] = []
    @Published var todayMinutes: Int = 0
    @Published var weekMinutes: Int = 0
    @Published var totalMinutes: Int = 0
    @Published var currentStreak: Int = 0
    @Published var longestStreak: Int = 0

    private let userDefaults = UserDefaults.standard
    private let sessionsKey = "focusSessions"

    init() {
        loadSessions()
        calculateStats()
    }

    // MARK: - Session Recording

    func recordSession(duration: Int) {
        let session = FocusSession(
            id: UUID(),
            date: Date(),
            duration: duration, // in minutes
            completed: true
        )

        sessions.append(session)
        saveSessions()
        calculateStats()
    }

    // MARK: - Statistics Calculation

    func calculateStats() {
        let calendar = Calendar.current
        let now = Date()

        // Today's minutes
        let todayStart = calendar.startOfDay(for: now)
        todayMinutes = sessions
            .filter { $0.date >= todayStart }
            .reduce(0) { $0 + $1.duration }

        // This week's minutes
        let weekStart = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: now))!
        weekMinutes = sessions
            .filter { $0.date >= weekStart }
            .reduce(0) { $0 + $1.duration }

        // Total minutes
        totalMinutes = sessions.reduce(0) { $0 + $1.duration }

        // Calculate streaks
        calculateStreaks()
    }

    private func calculateStreaks() {
        let calendar = Calendar.current
        var streak = 0
        var maxStreak = 0
        var currentDate = Date()

        // Group sessions by day
        let sessionsByDay = Dictionary(grouping: sessions) { session in
            calendar.startOfDay(for: session.date)
        }

        // Check consecutive days starting from today
        while true {
            let dayStart = calendar.startOfDay(for: currentDate)
            if sessionsByDay[dayStart] != nil {
                streak += 1
                maxStreak = max(maxStreak, streak)
                currentDate = calendar.date(byAdding: .day, value: -1, to: currentDate)!
            } else {
                break
            }
        }

        currentStreak = streak
        longestStreak = max(longestStreak, maxStreak)

        // Load saved longest streak
        let savedLongest = userDefaults.integer(forKey: "longestStreak")
        if longestStreak > savedLongest {
            userDefaults.set(longestStreak, forKey: "longestStreak")
        } else {
            longestStreak = savedLongest
        }
    }

    // MARK: - Data for Charts

    func dailyData(for days: Int) -> [DailyFocusData] {
        let calendar = Calendar.current
        var data: [DailyFocusData] = []

        for dayOffset in (0..<days).reversed() {
            let date = calendar.date(byAdding: .day, value: -dayOffset, to: Date())!
            let dayStart = calendar.startOfDay(for: date)
            let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart)!

            let minutes = sessions
                .filter { $0.date >= dayStart && $0.date < dayEnd }
                .reduce(0) { $0 + $1.duration }

            data.append(DailyFocusData(date: dayStart, minutes: minutes))
        }

        return data
    }

    func weeklyData(for weeks: Int) -> [WeeklyFocusData] {
        let calendar = Calendar.current
        var data: [WeeklyFocusData] = []

        for weekOffset in (0..<weeks).reversed() {
            let weekStart = calendar.date(byAdding: .weekOfYear, value: -weekOffset, to: Date())!
            let startOfWeek = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: weekStart))!
            let endOfWeek = calendar.date(byAdding: .weekOfYear, value: 1, to: startOfWeek)!

            let minutes = sessions
                .filter { $0.date >= startOfWeek && $0.date < endOfWeek }
                .reduce(0) { $0 + $1.duration }

            data.append(WeeklyFocusData(weekStart: startOfWeek, minutes: minutes))
        }

        return data
    }

    // MARK: - Persistence

    private func saveSessions() {
        if let encoded = try? JSONEncoder().encode(sessions) {
            userDefaults.set(encoded, forKey: sessionsKey)
        }
    }

    private func loadSessions() {
        if let data = userDefaults.data(forKey: sessionsKey),
           let decoded = try? JSONDecoder().decode([FocusSession].self, from: data) {
            sessions = decoded
        }
    }

    func clearAllData() {
        sessions.removeAll()
        userDefaults.removeObject(forKey: sessionsKey)
        userDefaults.removeObject(forKey: "longestStreak")
        calculateStats()
    }
}

// MARK: - Models

struct FocusSession: Identifiable, Codable {
    let id: UUID
    let date: Date
    let duration: Int // in minutes
    let completed: Bool
}

struct DailyFocusData: Identifiable {
    let id = UUID()
    let date: Date
    let minutes: Int

    var dayName: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }
}

struct WeeklyFocusData: Identifiable {
    let id = UUID()
    let weekStart: Date
    let minutes: Int

    var weekLabel: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: weekStart)
    }
}
