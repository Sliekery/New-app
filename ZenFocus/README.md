# ZenFocus - Minimalist Focus Timer

A beautiful, distraction-free focus timer for iOS built with SwiftUI.

## Features

### Core Features (Free)
- **Clean Timer Interface** - Distraction-free Pomodoro timer with visual progress ring
- **Session Planning** - Unique feature: Stack multiple focus and break sessions
- **Customizable Durations** - Set your own focus, short break, and long break lengths
- **Quick Presets** - Classic Pomodoro, Deep Work, Quick Sprints, and more
- **Statistics Tracking** - Daily, weekly, and all-time focus statistics
- **Streak Counter** - Build consistency with streak tracking
- **Background Support** - Timer continues when app is in background
- **Notifications** - Get alerted when sessions complete

### Premium Features ($2.99 one-time)
- 8 Beautiful accent color themes
- Advanced analytics and insights
- Pre-built session planning templates
- iCloud sync across devices
- Premium notification sounds

## Project Structure

```
ZenFocus/
├── ZenFocus.xcodeproj/
│   └── project.pbxproj
├── ZenFocus/
│   ├── ZenFocusApp.swift          # App entry point
│   ├── ContentView.swift           # Main tab view
│   ├── Info.plist                  # App configuration
│   ├── Views/
│   │   ├── TimerView.swift         # Main timer interface
│   │   ├── SessionPlannerView.swift # Session stacking feature
│   │   ├── StatsView.swift         # Statistics and charts
│   │   └── SettingsView.swift      # App settings
│   ├── Managers/
│   │   ├── TimerManager.swift      # Timer logic and state
│   │   ├── SettingsManager.swift   # User preferences
│   │   └── StatsManager.swift      # Statistics tracking
│   └── Assets.xcassets/
│       ├── AppIcon.appiconset/
│       └── AccentColor.colorset/
└── APP_STORE_METADATA.md           # App Store submission info
```

## Requirements

- iOS 16.0+
- Xcode 15.0+
- Swift 5.9+

## Installation

1. Clone this repository
2. Open `ZenFocus.xcodeproj` in Xcode
3. Select your development team in Signing & Capabilities
4. Build and run on simulator or device

## Key Differentiators

Based on market research, ZenFocus addresses common user complaints:

1. **Not too simple, not too complex** - Right balance of features
2. **Background timer support** - Timer doesn't stop when switching apps
3. **Session planning** - Users requested ability to stack multiple sessions
4. **One-time purchase** - No expensive subscriptions
5. **Clean, modern UI** - Not dated or bloated

## Architecture

- **SwiftUI** - Declarative UI framework
- **MVVM Pattern** - Managers act as ViewModels
- **UserDefaults** - Persistent storage for settings and stats
- **UserNotifications** - Local notifications for session completion
- **Background Tasks** - Timer continues in background

## Monetization Strategy

- **Freemium Model** - Core features free, premium one-time purchase
- **Price Point** - $2.99 (below competitor subscriptions)
- **No Ads** - Premium feel throughout

## Future Roadmap

- [ ] Dynamic Island support (Live Activities)
- [ ] Apple Watch companion app
- [ ] Widgets (Home Screen, Lock Screen)
- [ ] Focus Mode integration
- [ ] Ambient sounds during focus
- [ ] Siri Shortcuts integration
- [ ] Calendar integration
- [ ] Task/to-do integration

## Market Research

This app was designed based on extensive market research identifying:

- User frustrations with existing Pomodoro apps (too complex or too basic)
- Missing features users requested (session planning)
- Pricing complaints (expensive subscriptions)
- Technical issues (timers stopping in background)

See `APP_STORE_METADATA.md` for full ASO strategy and competitor analysis.

## License

MIT License - Feel free to use this code as a starting point for your own app.
