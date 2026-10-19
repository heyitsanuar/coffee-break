// Compiled/typechecked separately; excluded from the executable model tests.
// Type aliases check SDK declarations, never instantiate framework objects.
import Virtualization
private typealias ConfigurationDeclaration = VZVirtualMachineConfiguration
private typealias LinuxLoaderDeclaration = VZLinuxBootLoader
private typealias GenericPlatformDeclaration = VZGenericPlatformConfiguration
private typealias ReadOnlyDiskDeclaration = VZDiskImageStorageDeviceAttachment
private typealias ConsoleDeclaration = VZVirtioConsoleDeviceSerialPortConfiguration
private typealias ConsoleAttachmentDeclaration = VZFileHandleSerialPortAttachment
private typealias SocketDeclaration = VZVirtioSocketDeviceConfiguration
