// swift-tools-version: 5.9

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "ZenFocus",
    platforms: [
        .iOS("16.0")
    ],
    products: [
        .iOSApplication(
            name: "ZenFocus",
            targets: ["AppModule"],
            bundleIdentifier: "com.zenfocus.app",
            teamIdentifier: "",
            displayVersion: "1.0.0",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .clock),
            accentColor: .presetColor(.indigo),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait,
                .landscapeRight,
                .landscapeLeft,
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ],
            appCategory: .productivity
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: "Sources"
        )
    ]
)
