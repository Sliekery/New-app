//
//  ZenFocusApp.swift
//  ZenFocus
//
//  A minimalist focus timer app that helps you get things done.
//

import SwiftUI
import UserNotifications

@main
struct ZenFocusApp: App {
    @StateObject private var timerManager = TimerManager()
    @StateObject private var settingsManager = SettingsManager()
    @StateObject private var statsManager = StatsManager()

    init() {
        requestNotificationPermission()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(timerManager)
                .environmentObject(settingsManager)
                .environmentObject(statsManager)
        }
    }

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if granted {
                print("Notification permission granted")
            }
        }
    }
}
