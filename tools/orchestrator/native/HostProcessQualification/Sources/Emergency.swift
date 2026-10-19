import Foundation

enum EmergencyQualification { case unavailable, unqualified, qualifiedSimulation }
enum EmergencyOutcome { case unavailable, denied, accepted }
/// Trusted injected model capability, separate from normal child authority. It
/// takes no PID, helper token or report. Qualification never means native proof.
protocol AdapterEmergency: AnyObject {
    func qualify(bindingDigest: String) -> EmergencyQualification
    func requestStop(bindingDigest: String) -> EmergencyOutcome
}
final class UnavailableAdapterEmergency: AdapterEmergency {
    func qualify(bindingDigest: String) -> EmergencyQualification { .unavailable }
    func requestStop(bindingDigest: String) -> EmergencyOutcome { .unavailable }
}
