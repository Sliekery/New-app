//
//  SessionPlannerView.swift
//  ZenFocus
//
//  This is the UNIQUE feature that addresses user complaints about
//  not being able to plan multiple focus sessions in advance.
//

import SwiftUI

struct SessionPlannerView: View {
    @EnvironmentObject var timerManager: TimerManager
    @EnvironmentObject var settingsManager: SettingsManager
    @State private var showingAddSession = false
    @State private var showingPresets = false

    var body: some View {
        NavigationStack {
            ZStack {
                if timerManager.plannedSessions.isEmpty {
                    emptyStateView
                } else {
                    sessionListView
                }
            }
            .navigationTitle("Plan Your Day")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button {
                            showingPresets = true
                        } label: {
                            Label("Quick Templates", systemImage: "square.stack.3d.up")
                        }

                        Button(role: .destructive) {
                            timerManager.clearPlan()
                        } label: {
                            Label("Clear Plan", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAddSession = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                    }
                }
            }
            .sheet(isPresented: $showingAddSession) {
                AddSessionSheet()
            }
            .sheet(isPresented: $showingPresets) {
                PresetsSheet()
            }
        }
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 24) {
            Image(systemName: "calendar.badge.plus")
                .font(.system(size: 64))
                .foregroundStyle(settingsManager.accentColor.opacity(0.6))

            VStack(spacing: 8) {
                Text("Plan Your Focus Sessions")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Stack focus and break sessions to create your ideal work schedule.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }

            Button {
                showingAddSession = true
            } label: {
                Label("Add Session", systemImage: "plus")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(settingsManager.accentColor)
                    .clipShape(Capsule())
            }

            Button {
                showingPresets = true
            } label: {
                Text("Or choose a template")
                    .font(.subheadline)
                    .foregroundStyle(settingsManager.accentColor)
            }
        }
    }

    // MARK: - Session List

    private var sessionListView: some View {
        VStack(spacing: 0) {
            // Summary header
            planSummaryHeader

            // Session list
            List {
                ForEach(Array(timerManager.plannedSessions.enumerated()), id: \.element.id) { index, session in
                    SessionRowView(
                        session: session,
                        index: index,
                        isActive: timerManager.isExecutingPlan && index == timerManager.currentPlannedSessionIndex
                    )
                }
                .onDelete(perform: deleteSession)
                .onMove(perform: moveSession)
            }
            .listStyle(.plain)

            // Start button
            if !timerManager.isExecutingPlan {
                startPlanButton
            } else {
                activePlanIndicator
            }
        }
    }

    private var planSummaryHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(timerManager.plannedSessions.count) Sessions")
                    .font(.headline)

                Text("Total: \(formatDuration(timerManager.totalPlanDuration))")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            let focusCount = timerManager.plannedSessions.filter { $0.type == .focus }.count
            let breakCount = timerManager.plannedSessions.filter { $0.type == .break }.count

            HStack(spacing: 12) {
                Label("\(focusCount)", systemImage: "brain.head.profile")
                    .font(.caption)
                    .foregroundStyle(.blue)

                Label("\(breakCount)", systemImage: "cup.and.saucer.fill")
                    .font(.caption)
                    .foregroundStyle(.green)
            }
        }
        .padding()
        .background(Color(.systemBackground))
    }

    private var startPlanButton: some View {
        Button {
            timerManager.startPlan()
        } label: {
            HStack {
                Image(systemName: "play.fill")
                Text("Start Plan")
            }
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(settingsManager.accentColor)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .padding()
    }

    private var activePlanIndicator: some View {
        HStack {
            Image(systemName: "play.circle.fill")
                .foregroundStyle(.green)

            Text("Plan in progress...")
                .font(.headline)

            Spacer()

            Button("Stop") {
                timerManager.reset()
            }
            .foregroundStyle(.red)
        }
        .padding()
        .background(Color.green.opacity(0.1))
    }

    // MARK: - Actions

    private func deleteSession(at offsets: IndexSet) {
        for index in offsets {
            timerManager.removePlannedSession(at: index)
        }
    }

    private func moveSession(from source: IndexSet, to destination: Int) {
        timerManager.plannedSessions.move(fromOffsets: source, toOffset: destination)
    }

    private func formatDuration(_ minutes: Int) -> String {
        let hours = minutes / 60
        let mins = minutes % 60
        if hours > 0 {
            return "\(hours)h \(mins)m"
        }
        return "\(mins) min"
    }
}

// MARK: - Session Row View

struct SessionRowView: View {
    let session: PlannedSession
    let index: Int
    let isActive: Bool

    var body: some View {
        HStack(spacing: 16) {
            // Index indicator
            ZStack {
                Circle()
                    .fill(isActive ? session.type.color : Color(.systemGray5))
                    .frame(width: 32, height: 32)

                Text("\(index + 1)")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(isActive ? .white : .secondary)
            }

            // Session info
            VStack(alignment: .leading, spacing: 4) {
                Text(session.name)
                    .font(.body)
                    .fontWeight(.medium)

                HStack(spacing: 8) {
                    Image(systemName: session.type.icon)
                        .font(.caption)
                        .foregroundStyle(session.type.color)

                    Text("\(session.duration) min")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            if isActive {
                Image(systemName: "play.fill")
                    .foregroundStyle(session.type.color)
            }
        }
        .padding(.vertical, 8)
        .background(isActive ? session.type.color.opacity(0.1) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Add Session Sheet

struct AddSessionSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var timerManager: TimerManager
    @EnvironmentObject var settingsManager: SettingsManager

    @State private var sessionName = ""
    @State private var duration = 25
    @State private var sessionType: PlannedSession.SessionType = .focus

    var body: some View {
        NavigationStack {
            Form {
                Section("Session Details") {
                    TextField("Session Name", text: $sessionName)

                    Picker("Type", selection: $sessionType) {
                        ForEach(PlannedSession.SessionType.allCases, id: \.self) { type in
                            Label(type.rawValue, systemImage: type.icon)
                                .tag(type)
                        }
                    }

                    Stepper("\(duration) minutes", value: $duration, in: 1...120, step: 5)
                }

                Section("Quick Add") {
                    Button {
                        addSession(name: "Deep Work", duration: 50, type: .focus)
                    } label: {
                        Label("Deep Work (50 min)", systemImage: "brain.head.profile")
                    }

                    Button {
                        addSession(name: "Focus Session", duration: 25, type: .focus)
                    } label: {
                        Label("Pomodoro (25 min)", systemImage: "timer")
                    }

                    Button {
                        addSession(name: "Short Break", duration: 5, type: .break)
                    } label: {
                        Label("Short Break (5 min)", systemImage: "cup.and.saucer.fill")
                    }

                    Button {
                        addSession(name: "Long Break", duration: 15, type: .break)
                    } label: {
                        Label("Long Break (15 min)", systemImage: "figure.walk")
                    }
                }
            }
            .navigationTitle("Add Session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        let name = sessionName.isEmpty
                            ? (sessionType == .focus ? "Focus Session" : "Break")
                            : sessionName
                        addSession(name: name, duration: duration, type: sessionType)
                    }
                }
            }
        }
    }

    private func addSession(name: String, duration: Int, type: PlannedSession.SessionType) {
        let session = PlannedSession(name: name, duration: duration, type: type)
        timerManager.addPlannedSession(session)
        dismiss()
    }
}

// MARK: - Presets Sheet

struct PresetsSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var timerManager: TimerManager

    let presets: [(name: String, sessions: [PlannedSession])] = [
        ("Morning Sprint", [
            PlannedSession(name: "Deep Work", duration: 50, type: .focus),
            PlannedSession(name: "Coffee Break", duration: 10, type: .break),
            PlannedSession(name: "Deep Work", duration: 50, type: .focus),
            PlannedSession(name: "Lunch Break", duration: 30, type: .break)
        ]),
        ("Classic Pomodoro x4", [
            PlannedSession(name: "Focus 1", duration: 25, type: .focus),
            PlannedSession(name: "Short Break", duration: 5, type: .break),
            PlannedSession(name: "Focus 2", duration: 25, type: .focus),
            PlannedSession(name: "Short Break", duration: 5, type: .break),
            PlannedSession(name: "Focus 3", duration: 25, type: .focus),
            PlannedSession(name: "Short Break", duration: 5, type: .break),
            PlannedSession(name: "Focus 4", duration: 25, type: .focus),
            PlannedSession(name: "Long Break", duration: 15, type: .break)
        ]),
        ("Quick Task Burst", [
            PlannedSession(name: "Sprint 1", duration: 15, type: .focus),
            PlannedSession(name: "Quick Break", duration: 3, type: .break),
            PlannedSession(name: "Sprint 2", duration: 15, type: .focus),
            PlannedSession(name: "Quick Break", duration: 3, type: .break),
            PlannedSession(name: "Sprint 3", duration: 15, type: .focus)
        ]),
        ("Writing Session", [
            PlannedSession(name: "Outline", duration: 20, type: .focus),
            PlannedSession(name: "Stretch", duration: 5, type: .break),
            PlannedSession(name: "Draft Writing", duration: 45, type: .focus),
            PlannedSession(name: "Rest Eyes", duration: 10, type: .break),
            PlannedSession(name: "Editing", duration: 30, type: .focus)
        ])
    ]

    var body: some View {
        NavigationStack {
            List(presets, id: \.name) { preset in
                Button {
                    applyPreset(preset.sessions)
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(preset.name)
                            .font(.headline)
                            .foregroundStyle(.primary)

                        HStack(spacing: 4) {
                            let totalMinutes = preset.sessions.reduce(0) { $0 + $1.duration }
                            let focusMinutes = preset.sessions.filter { $0.type == .focus }.reduce(0) { $0 + $1.duration }

                            Text("\(preset.sessions.count) sessions")
                            Text("•")
                            Text("\(totalMinutes) min total")
                            Text("•")
                            Text("\(focusMinutes) min focus")
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Templates")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func applyPreset(_ sessions: [PlannedSession]) {
        timerManager.clearPlan()
        for session in sessions {
            timerManager.addPlannedSession(session)
        }
        dismiss()
    }
}

#Preview {
    SessionPlannerView()
        .environmentObject(TimerManager())
        .environmentObject(SettingsManager())
}
