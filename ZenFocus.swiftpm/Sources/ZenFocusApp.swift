//
//  ZenFocusApp.swift
//  ZenFocus
//
//  A minimalist focus timer app that helps you get things done.
//

import SwiftUI

@main
struct ZenFocusApp: App {
    @StateObject private var timerManager = TimerManager()
    @StateObject private var settingsManager = SettingsManager()
    @StateObject private var statsManager = StatsManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(timerManager)
                .environmentObject(settingsManager)
                .environmentObject(statsManager)
        }
    }
}
