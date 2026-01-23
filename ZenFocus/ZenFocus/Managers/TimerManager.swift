//
//  TimerManager.swift
//  ZenFocus
//

import SwiftUI
import UserNotifications
import Combine

class TimerManager: ObservableObject {
    @Published var timeRemaining: Int = 25 * 60 // Default 25 minutes
    @Published var isRunning: Bool = false
    @Published var isBreak: Bool = false
    @Published var completedSessions: Int = 0
    @Published var sessionCompleted: Bool = false
    @Published var currentPlannedSessionIndex: Int = 0

    private var timer: Timer?
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    private var targetEndTime: Date?

    // Settings references
    private var focusDuration: Int = 25 * 60
    private var shortBreakDuration: Int = 5 * 60
    private var longBreakDuration: Int = 15 * 60
    private var sessionsUntilLongBreak: Int = 4

    // Planned sessions
    @Published var plannedSessions: [PlannedSession] = []
    @Published var isExecutingPlan: Bool = false

    var totalDuration: Int {
        isBreak ? (isLongBreak ? longBreakDuration : shortBreakDuration) : focusDuration
    }

    var isLongBreak: Bool {
        completedSessions > 0 && completedSessions % sessionsUntilLongBreak == 0
    }

    var progress: CGFloat {
        guard totalDuration > 0 else { return 1.0 }
        return CGFloat(timeRemaining) / CGFloat(totalDuration)
    }

    var timeString: String {
        let minutes = timeRemaining / 60
        let seconds = timeRemaining % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    init() {
        loadSettings()
        setupNotificationObservers()
    }

    deinit {
        timer?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Settings

    func loadSettings() {
        let settings = SettingsManager()
        focusDuration = settings.focusDuration * 60
        shortBreakDuration = settings.shortBreakDuration * 60
        longBreakDuration = settings.longBreakDuration * 60
        sessionsUntilLongBreak = settings.sessionsUntilLongBreak
        timeRemaining = focusDuration
    }

    func updateSettings(focus: Int, shortBreak: Int, longBreak: Int, sessions: Int) {
        focusDuration = focus * 60
        shortBreakDuration = shortBreak * 60
        longBreakDuration = longBreak * 60
        sessionsUntilLongBreak = sessions

        if !isRunning {
            timeRemaining = isBreak ? (isLongBreak ? longBreakDuration : shortBreakDuration) : focusDuration
        }
    }

    // MARK: - Timer Controls

    func start() {
        guard !isRunning else { return }

        isRunning = true
        targetEndTime = Date().addingTimeInterval(TimeInterval(timeRemaining))

        startBackgroundTask()
        scheduleNotification()

        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.tick()
        }
        RunLoop.current.add(timer!, forMode: .common)
    }

    func pause() {
        isRunning = false
        timer?.invalidate()
        timer = nil
        targetEndTime = nil
        endBackgroundTask()
        cancelNotifications()
    }

    func reset() {
        pause()
        isBreak = false
        timeRemaining = focusDuration
        isExecutingPlan = false
        currentPlannedSessionIndex = 0
    }

    func skip() {
        pause()
        completeCurrentSession()
    }

    func startNextSession() {
        pause()

        if isExecutingPlan && currentPlannedSessionIndex < plannedSessions.count - 1 {
            currentPlannedSessionIndex += 1
            let nextSession = plannedSessions[currentPlannedSessionIndex]
            isBreak = nextSession.type == .break
            timeRemaining = nextSession.duration * 60
        } else if isExecutingPlan && currentPlannedSessionIndex >= plannedSessions.count - 1 {
            // Plan complete
            isExecutingPlan = false
            currentPlannedSessionIndex = 0
            reset()
            return
        } else {
            // Standard Pomodoro flow
            if isBreak {
                isBreak = false
                timeRemaining = focusDuration
            } else {
                completedSessions += 1
                isBreak = true
                timeRemaining = isLongBreak ? longBreakDuration : shortBreakDuration
            }
        }

        start()
    }

    // MARK: - Planned Sessions

    func startPlan() {
        guard !plannedSessions.isEmpty else { return }

        reset()
        isExecutingPlan = true
        currentPlannedSessionIndex = 0

        let firstSession = plannedSessions[0]
        isBreak = firstSession.type == .break
        timeRemaining = firstSession.duration * 60

        start()
    }

    func addPlannedSession(_ session: PlannedSession) {
        plannedSessions.append(session)
    }

    func removePlannedSession(at index: Int) {
        guard index < plannedSessions.count else { return }
        plannedSessions.remove(at: index)
    }

    func clearPlan() {
        plannedSessions.removeAll()
        isExecutingPlan = false
        currentPlannedSessionIndex = 0
    }

    var totalPlanDuration: Int {
        plannedSessions.reduce(0) { $0 + $1.duration }
    }

    // MARK: - Private Methods

    private func tick() {
        guard isRunning else { return }

        // Sync with target end time for accuracy
        if let endTime = targetEndTime {
            let remaining = Int(endTime.timeIntervalSinceNow)
            timeRemaining = max(0, remaining)
        } else {
            timeRemaining -= 1
        }

        if timeRemaining <= 0 {
            completeCurrentSession()
        }
    }

    private func completeCurrentSession() {
        pause()
        sessionCompleted = true
        sendCompletionNotification()
    }

    // MARK: - Background Support

    private func setupNotificationObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillResignActive),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }

    @objc private func appWillResignActive() {
        // Timer will continue via scheduled notification
    }

    @objc private func appDidBecomeActive() {
        // Sync time when returning to app
        if isRunning, let endTime = targetEndTime {
            let remaining = Int(endTime.timeIntervalSinceNow)
            if remaining <= 0 {
                completeCurrentSession()
            } else {
                timeRemaining = remaining
            }
        }
    }

    private func startBackgroundTask() {
        backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
            self?.endBackgroundTask()
        }
    }

    private func endBackgroundTask() {
        if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
    }

    // MARK: - Notifications

    private func scheduleNotification() {
        let content = UNMutableNotificationContent()
        content.title = isBreak ? "Break Over!" : "Focus Session Complete!"
        content.body = isBreak ? "Ready to get back to work?" : "Great job! Time for a well-deserved break."
        content.sound = .default
        content.badge = 1

        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: TimeInterval(timeRemaining),
            repeats: false
        )

        let request = UNNotificationRequest(
            identifier: "timerComplete",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }

    private func cancelNotifications() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: ["timerComplete"]
        )
    }

    private func sendCompletionNotification() {
        let content = UNMutableNotificationContent()
        content.title = isBreak ? "Break Over!" : "Focus Session Complete!"
        content.body = isBreak ? "Ready to get back to work?" : "Great job! Time for a well-deserved break."
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "sessionComplete",
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }
}

// MARK: - Planned Session Model

struct PlannedSession: Identifiable, Codable {
    let id: UUID
    var name: String
    var duration: Int // in minutes
    var type: SessionType

    init(id: UUID = UUID(), name: String, duration: Int, type: SessionType) {
        self.id = id
        self.name = name
        self.duration = duration
        self.type = type
    }

    enum SessionType: String, Codable, CaseIterable {
        case focus = "Focus"
        case `break` = "Break"

        var icon: String {
            switch self {
            case .focus: return "brain.head.profile"
            case .break: return "cup.and.saucer.fill"
            }
        }

        var color: Color {
            switch self {
            case .focus: return .blue
            case .break: return .green
            }
        }
    }
}
