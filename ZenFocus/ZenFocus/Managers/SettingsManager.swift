//
//  SettingsManager.swift
//  ZenFocus
//

import SwiftUI

class SettingsManager: ObservableObject {
    // Timer Settings
    @AppStorage("focusDuration") var focusDuration: Int = 25
    @AppStorage("shortBreakDuration") var shortBreakDuration: Int = 5
    @AppStorage("longBreakDuration") var longBreakDuration: Int = 15
    @AppStorage("sessionsUntilLongBreak") var sessionsUntilLongBreak: Int = 4

    // Behavior Settings
    @AppStorage("autoStartBreaks") var autoStartBreaks: Bool = false
    @AppStorage("autoStartFocus") var autoStartFocus: Bool = false
    @AppStorage("soundEnabled") var soundEnabled: Bool = true
    @AppStorage("vibrationEnabled") var vibrationEnabled: Bool = true

    // Appearance Settings
    @AppStorage("selectedTheme") var selectedTheme: String = "default"
    @AppStorage("accentColorIndex") var accentColorIndex: Int = 0

    // Premium
    @AppStorage("isPremium") var isPremium: Bool = false

    // Available accent colors
    static let accentColors: [Color] = [
        .blue,
        .purple,
        .pink,
        .orange,
        .red,
        .mint,
        .teal,
        .indigo
    ]

    static let accentColorNames: [String] = [
        "Ocean Blue",
        "Royal Purple",
        "Coral Pink",
        "Sunset Orange",
        "Ruby Red",
        "Fresh Mint",
        "Deep Teal",
        "Indigo Night"
    ]

    var accentColor: Color {
        Self.accentColors[min(accentColorIndex, Self.accentColors.count - 1)]
    }

    // Preset configurations
    static let presets: [(name: String, focus: Int, shortBreak: Int, longBreak: Int)] = [
        ("Classic Pomodoro", 25, 5, 15),
        ("Deep Work", 50, 10, 30),
        ("Quick Sprints", 15, 3, 10),
        ("Extended Focus", 45, 10, 20),
        ("Ultra Focus", 90, 15, 30)
    ]

    func applyPreset(_ preset: (name: String, focus: Int, shortBreak: Int, longBreak: Int)) {
        focusDuration = preset.focus
        shortBreakDuration = preset.shortBreak
        longBreakDuration = preset.longBreak
    }

    func resetToDefaults() {
        focusDuration = 25
        shortBreakDuration = 5
        longBreakDuration = 15
        sessionsUntilLongBreak = 4
        autoStartBreaks = false
        autoStartFocus = false
        soundEnabled = true
        vibrationEnabled = true
        selectedTheme = "default"
        accentColorIndex = 0
    }
}
