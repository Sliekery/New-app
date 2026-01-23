//
//  ContentView.swift
//  ZenFocus
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var timerManager: TimerManager
    @EnvironmentObject var settingsManager: SettingsManager
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            TimerView()
                .tabItem {
                    Image(systemName: "timer")
                    Text("Focus")
                }
                .tag(0)

            SessionPlannerView()
                .tabItem {
                    Image(systemName: "list.bullet.clipboard")
                    Text("Plan")
                }
                .tag(1)

            StatsView()
                .tabItem {
                    Image(systemName: "chart.bar")
                    Text("Stats")
                }
                .tag(2)

            SettingsView()
                .tabItem {
                    Image(systemName: "gear")
                    Text("Settings")
                }
                .tag(3)
        }
        .tint(settingsManager.accentColor)
    }
}

#Preview {
    ContentView()
        .environmentObject(TimerManager())
        .environmentObject(SettingsManager())
        .environmentObject(StatsManager())
}
