//
//  SettingsView.swift
//  ZenFocus
//

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settingsManager: SettingsManager
    @EnvironmentObject var timerManager: TimerManager
    @EnvironmentObject var statsManager: StatsManager
    @State private var showingResetAlert = false
    @State private var showingPremiumSheet = false

    var body: some View {
        NavigationStack {
            Form {
                // Timer Settings
                timerSection

                // Presets
                presetsSection

                // Behavior
                behaviorSection

                // Appearance
                appearanceSection

                // Premium
                premiumSection

                // Data
                dataSection

                // About
                aboutSection
            }
            .navigationTitle("Settings")
            .onChange(of: settingsManager.focusDuration) { _, newValue in
                timerManager.updateSettings(
                    focus: newValue,
                    shortBreak: settingsManager.shortBreakDuration,
                    longBreak: settingsManager.longBreakDuration,
                    sessions: settingsManager.sessionsUntilLongBreak
                )
            }
            .onChange(of: settingsManager.shortBreakDuration) { _, newValue in
                timerManager.updateSettings(
                    focus: settingsManager.focusDuration,
                    shortBreak: newValue,
                    longBreak: settingsManager.longBreakDuration,
                    sessions: settingsManager.sessionsUntilLongBreak
                )
            }
            .onChange(of: settingsManager.longBreakDuration) { _, newValue in
                timerManager.updateSettings(
                    focus: settingsManager.focusDuration,
                    shortBreak: settingsManager.shortBreakDuration,
                    longBreak: newValue,
                    sessions: settingsManager.sessionsUntilLongBreak
                )
            }
            .sheet(isPresented: $showingPremiumSheet) {
                PremiumSheet()
            }
        }
    }

    // MARK: - Timer Section

    private var timerSection: some View {
        Section {
            Stepper("Focus: \(settingsManager.focusDuration) min",
                    value: $settingsManager.focusDuration,
                    in: 1...120,
                    step: 5)

            Stepper("Short Break: \(settingsManager.shortBreakDuration) min",
                    value: $settingsManager.shortBreakDuration,
                    in: 1...30,
                    step: 1)

            Stepper("Long Break: \(settingsManager.longBreakDuration) min",
                    value: $settingsManager.longBreakDuration,
                    in: 5...60,
                    step: 5)

            Stepper("Sessions until long break: \(settingsManager.sessionsUntilLongBreak)",
                    value: $settingsManager.sessionsUntilLongBreak,
                    in: 2...8)
        } header: {
            Text("Timer Durations")
        } footer: {
            Text("Customize how long your focus sessions and breaks last.")
        }
    }

    // MARK: - Presets Section

    private var presetsSection: some View {
        Section("Quick Presets") {
            ForEach(SettingsManager.presets, id: \.name) { preset in
                Button {
                    withAnimation {
                        settingsManager.applyPreset(preset)
                    }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(preset.name)
                                .foregroundStyle(.primary)

                            Text("\(preset.focus)/\(preset.shortBreak)/\(preset.longBreak) min")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        if settingsManager.focusDuration == preset.focus &&
                            settingsManager.shortBreakDuration == preset.shortBreak &&
                            settingsManager.longBreakDuration == preset.longBreak {
                            Image(systemName: "checkmark")
                                .foregroundStyle(settingsManager.accentColor)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Behavior Section

    private var behaviorSection: some View {
        Section {
            Toggle("Auto-start breaks", isOn: $settingsManager.autoStartBreaks)
            Toggle("Auto-start focus sessions", isOn: $settingsManager.autoStartFocus)
            Toggle("Sound notifications", isOn: $settingsManager.soundEnabled)
            Toggle("Vibration", isOn: $settingsManager.vibrationEnabled)
        } header: {
            Text("Behavior")
        } footer: {
            Text("Control how the timer behaves when sessions complete.")
        }
    }

    // MARK: - Appearance Section

    private var appearanceSection: some View {
        Section("Appearance") {
            NavigationLink {
                ColorPickerView()
            } label: {
                HStack {
                    Text("Accent Color")
                    Spacer()
                    Circle()
                        .fill(settingsManager.accentColor)
                        .frame(width: 24, height: 24)
                }
            }
        }
    }

    // MARK: - Premium Section

    private var premiumSection: some View {
        Section {
            if settingsManager.isPremium {
                HStack {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundStyle(.yellow)
                    Text("Premium Active")
                        .fontWeight(.medium)
                    Spacer()
                    Text("Thank you!")
                        .foregroundStyle(.secondary)
                }
            } else {
                Button {
                    showingPremiumSheet = true
                } label: {
                    HStack {
                        Image(systemName: "star.fill")
                            .foregroundStyle(.yellow)
                        Text("Upgrade to Premium")
                            .foregroundStyle(.primary)
                        Spacer()
                        Text("$2.99")
                            .foregroundStyle(.secondary)
                    }
                }
            }
        } header: {
            Text("Premium")
        } footer: {
            Text("Unlock all themes, detailed analytics, and session planning templates.")
        }
    }

    // MARK: - Data Section

    private var dataSection: some View {
        Section {
            Button(role: .destructive) {
                showingResetAlert = true
            } label: {
                HStack {
                    Image(systemName: "trash")
                    Text("Clear All Data")
                }
            }
            .alert("Clear All Data?", isPresented: $showingResetAlert) {
                Button("Cancel", role: .cancel) {}
                Button("Clear", role: .destructive) {
                    statsManager.clearAllData()
                    settingsManager.resetToDefaults()
                }
            } message: {
                Text("This will delete all your focus history and reset settings. This action cannot be undone.")
            }
        } header: {
            Text("Data")
        }
    }

    // MARK: - About Section

    private var aboutSection: some View {
        Section("About") {
            HStack {
                Text("Version")
                Spacer()
                Text("1.0.0")
                    .foregroundStyle(.secondary)
            }

            Link(destination: URL(string: "https://example.com/privacy")!) {
                HStack {
                    Text("Privacy Policy")
                        .foregroundStyle(.primary)
                    Spacer()
                    Image(systemName: "arrow.up.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Link(destination: URL(string: "https://example.com/terms")!) {
                HStack {
                    Text("Terms of Service")
                        .foregroundStyle(.primary)
                    Spacer()
                    Image(systemName: "arrow.up.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

// MARK: - Color Picker View

struct ColorPickerView: View {
    @EnvironmentObject var settingsManager: SettingsManager

    var body: some View {
        List {
            ForEach(0..<SettingsManager.accentColors.count, id: \.self) { index in
                Button {
                    withAnimation {
                        settingsManager.accentColorIndex = index
                    }
                } label: {
                    HStack {
                        Circle()
                            .fill(SettingsManager.accentColors[index])
                            .frame(width: 32, height: 32)

                        Text(SettingsManager.accentColorNames[index])
                            .foregroundStyle(.primary)

                        Spacer()

                        if settingsManager.accentColorIndex == index {
                            Image(systemName: "checkmark")
                                .foregroundStyle(SettingsManager.accentColors[index])
                        }
                    }
                }
            }
        }
        .navigationTitle("Accent Color")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Premium Sheet

struct PremiumSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var settingsManager: SettingsManager

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                // Header
                VStack(spacing: 16) {
                    Image(systemName: "star.circle.fill")
                        .font(.system(size: 80))
                        .foregroundStyle(.yellow)

                    Text("ZenFocus Premium")
                        .font(.title)
                        .fontWeight(.bold)

                    Text("Unlock your full potential")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 32)

                // Features
                VStack(alignment: .leading, spacing: 16) {
                    FeatureRow(icon: "paintpalette.fill", title: "All Themes", description: "8 beautiful accent colors")
                    FeatureRow(icon: "chart.line.uptrend.xyaxis", title: "Advanced Analytics", description: "Detailed focus insights")
                    FeatureRow(icon: "square.stack.3d.up.fill", title: "Session Templates", description: "Pre-built focus plans")
                    FeatureRow(icon: "icloud.fill", title: "iCloud Sync", description: "Sync across all devices")
                    FeatureRow(icon: "bell.badge.fill", title: "Custom Sounds", description: "Premium notification sounds")
                }
                .padding(.horizontal)

                Spacer()

                // Purchase button
                VStack(spacing: 12) {
                    Button {
                        // In a real app, this would trigger StoreKit
                        settingsManager.isPremium = true
                        dismiss()
                    } label: {
                        Text("Get Premium - $2.99")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(.yellow.gradient)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }

                    Text("One-time purchase. No subscriptions.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding()
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(.yellow)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body)
                    .fontWeight(.medium)

                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(SettingsManager())
        .environmentObject(TimerManager())
        .environmentObject(StatsManager())
}
