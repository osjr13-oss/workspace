import HealthKit

/// Stable snake_case names for workout types, so the server never depends on
/// HealthKit's raw numbers.
nonisolated enum WorkoutNames {
    static func name(for type: HKWorkoutActivityType) -> String {
        switch type {
        case .walking: "walking"
        case .running: "running"
        case .cycling: "cycling"
        case .swimming: "swimming"
        case .hiking: "hiking"
        case .yoga: "yoga"
        case .pilates: "pilates"
        case .traditionalStrengthTraining: "strength_training"
        case .functionalStrengthTraining: "functional_strength_training"
        case .coreTraining: "core_training"
        case .highIntensityIntervalTraining: "hiit"
        case .crossTraining: "cross_training"
        case .elliptical: "elliptical"
        case .rowing: "rowing"
        case .stairClimbing: "stair_climbing"
        case .stairs: "stairs"
        case .dance, .cardioDance, .socialDance: "dance"
        case .mixedCardio: "mixed_cardio"
        case .flexibility: "flexibility"
        case .cooldown: "cooldown"
        case .mindAndBody: "mind_and_body"
        case .tennis: "tennis"
        case .basketball: "basketball"
        case .soccer: "soccer"
        case .golf: "golf"
        case .boxing, .kickboxing: "boxing"
        case .martialArts: "martial_arts"
        case .climbing: "climbing"
        case .wheelchairWalkPace, .wheelchairRunPace: "wheelchair"
        case .other: "other"
        default: "other_\(type.rawValue)"
        }
    }
}
