//
//  TimerView.swift
//  ZenFocus
//

import SwiftUI

struct TimerView: View {
    @EnvironmentObject var timerManager: TimerManager
    @EnvironmentObject var settingsManager: SettingsManager
    @EnvironmentObject var statsManager: StatsManager
    @State private var showingSessionComplete = false

    var body: some View {
        NavigationStack {
            ZStack {
                // Background gradient
                backgroundGradient
                    .ignoresSafeArea()

                VStack(spacing: 40) {
                    // Session type indicator
                    sessionTypeIndicator

                    Spacer()

                    // Timer circle
                    timerCircle

                    Spacer()

                    // Control buttons
                    controlButtons

                    // Session counter
                    sessionCounter
                }
                .padding()
            }
            .navigationTitle("")
            .onChange(of: timerManager.sessionCompleted) { _, completed in
                if completed {
                    handleSessionComplete()
                }
            }
            .alert("Session Complete!", isPresented: $showingSessionComplete) {
                Button("Continue") {
                    timerManager.startNextSession()
                }
                Button("Take a Break", role: .cancel) {
                    timerManager.reset()
                }
            } message: {
                Text(timerManager.isBreak ? "Break time is over. Ready to focus?" : "Great work! Time for a break.")
            }
        }
    }

    // MARK: - View Components

    private var backgroundGradient: some View {
        LinearGradient(
            colors: timerManager.isBreak
                ? [Color.green.opacity(0.1), Color.mint.opacity(0.05)]
                : [settingsManager.accentColor.opacity(0.1), settingsManager.accentColor.opacity(0.05)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var sessionTypeIndicator: some View {
        HStack(spacing: 8) {
            Image(systemName: timerManager.isBreak ? "cup.and.saucer.fill" : "brain.head.profile")
                .font(.title2)

            Text(timerManager.isBreak ? "Break Time" : "Focus Session")
                .font(.title2)
                .fontWeight(.semibold)
        }
        .foregroundStyle(timerManager.isBreak ? .green : settingsManager.accentColor)
        .padding(.top, 20)
    }

    private var timerCircle: some View {
        ZStack {
            // Background circle
            Circle()
                .stroke(lineWidth: 12)
                .opacity(0.1)
                .foregroundStyle(timerManager.isBreak ? .green : settingsManager.accentColor)

            // Progress circle
            Circle()
                .trim(from: 0, to: timerManager.progress)
                .stroke(
                    timerManager.isBreak ? .green : settingsManager.accentColor,
                    style: StrokeStyle(lineWidth: 12, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 0.5), value: timerManager.progress)

            // Timer display
            VStack(spacing: 8) {
                Text(timerManager.timeString)
                    .font(.system(size: 64, weight: .thin, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.primary)

                Text(timerManager.isRunning ? "Remaining" : "Ready")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 280, height: 280)
    }

    private var controlButtons: some View {
        HStack(spacing: 40) {
            // Reset button
            Button {
                withAnimation(.spring(response: 0.3)) {
                    timerManager.reset()
                }
            } label: {
                Image(systemName: "arrow.counterclockwise")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                    .frame(width: 60, height: 60)
                    .background(Color(.systemGray6))
                    .clipShape(Circle())
            }

            // Play/Pause button
            Button {
                withAnimation(.spring(response: 0.3)) {
                    if timerManager.isRunning {
                        timerManager.pause()
                    } else {
                        timerManager.start()
                    }
                }
            } label: {
                Image(systemName: timerManager.isRunning ? "pause.fill" : "play.fill")
                    .font(.title)
                    .foregroundStyle(.white)
                    .frame(width: 80, height: 80)
                    .background(timerManager.isBreak ? .green : settingsManager.accentColor)
                    .clipShape(Circle())
                    .shadow(color: (timerManager.isBreak ? Color.green : settingsManager.accentColor).opacity(0.4), radius: 10, y: 5)
            }

            // Skip button
            Button {
                withAnimation(.spring(response: 0.3)) {
                    timerManager.skip()
                }
            } label: {
                Image(systemName: "forward.fill")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                    .frame(width: 60, height: 60)
                    .background(Color(.systemGray6))
                    .clipShape(Circle())
            }
        }
    }

    private var sessionCounter: some View {
        HStack(spacing: 6) {
            ForEach(0..<settingsManager.sessionsUntilLongBreak, id: \.self) { index in
                Circle()
                    .fill(index < timerManager.completedSessions
                          ? (timerManager.isBreak ? Color.green : settingsManager.accentColor)
                          : Color(.systemGray4))
                    .frame(width: 10, height: 10)
            }
        }
        .padding(.bottom, 20)
    }

    // MARK: - Actions

    private func handleSessionComplete() {
        if !timerManager.isBreak {
            statsManager.recordSession(duration: settingsManager.focusDuration)
        }

        if settingsManager.autoStartBreaks || settingsManager.autoStartFocus {
            timerManager.startNextSession()
        } else {
            showingSessionComplete = true
        }

        timerManager.sessionCompleted = false
    }
}

#Preview {
    TimerView()
        .environmentObject(TimerManager())
        .environmentObject(SettingsManager())
        .environmentObject(StatsManager())
}
