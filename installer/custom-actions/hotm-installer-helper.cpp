/*
 * HotM Advanced Installer Custom Actions
 * 
 * This file implements the custom actions for the HotM unified runtime installer
 * including deployment mode configuration, service management, and dependency handling.
 */

#include <windows.h>
#include <msiquery.h>
#include <string>
#include <vector>
#include <fstream>
#include <filesystem>
#include <process.h>
#include <regex>
#include <thread>
#include <chrono>
#include <memory>
#include <map>
#include <winsock2.h>
#include <ws2tcpip.h>

#pragma comment(lib, "msi.lib")
#pragma comment(lib, "ws2_32.lib")

namespace hotm {
namespace installer {

// Logging helpers
class Logger {
public:
    static void Info(MSIHANDLE hInstall, const std::wstring& message) {
        LogMessage(hInstall, L"INFO", message);
    }
    
    static void Warning(MSIHANDLE hInstall, const std::wstring& message) {
        LogMessage(hInstall, L"WARNING", message);
    }
    
    static void Error(MSIHANDLE hInstall, const std::wstring& message) {
        LogMessage(hInstall, L"ERROR", message);
    }

private:
    static void LogMessage(MSIHANDLE hInstall, const std::wstring& level, const std::wstring& message) {
        PMSIHANDLE hRecord = MsiCreateRecord(2);
        MsiRecordSetStringW(hRecord, 0, L"HotM Installer [1]: [2]");
        MsiRecordSetStringW(hRecord, 1, level.c_str());
        MsiRecordSetStringW(hRecord, 2, message.c_str());
        MsiProcessMessage(hInstall, INSTALLMESSAGE_INFO, hRecord);
    }
};

// MSI Property helper
class PropertyHelper {
public:
    static std::wstring GetProperty(MSIHANDLE hInstall, const std::wstring& propertyName) {
        DWORD size = 0;
        UINT result = MsiGetPropertyW(hInstall, propertyName.c_str(), L"", &size);
        
        if (result == ERROR_MORE_DATA) {
            std::vector<wchar_t> buffer(size + 1);
            result = MsiGetPropertyW(hInstall, propertyName.c_str(), buffer.data(), &size);
            if (result == ERROR_SUCCESS) {
                return std::wstring(buffer.data());
            }
        }
        
        return L"";
    }
    
    static void SetProperty(MSIHANDLE hInstall, const std::wstring& propertyName, const std::wstring& value) {
        MsiSetPropertyW(hInstall, propertyName.c_str(), value.c_str());
    }
    
    static int GetIntProperty(MSIHANDLE hInstall, const std::wstring& propertyName, int defaultValue = 0) {
        std::wstring value = GetProperty(hInstall, propertyName);
        if (value.empty()) return defaultValue;
        
        try {
            return std::stoi(value);
        } catch (...) {
            return defaultValue;
        }
    }
    
    static bool GetBoolProperty(MSIHANDLE hInstall, const std::wstring& propertyName, bool defaultValue = false) {
        std::wstring value = GetProperty(hInstall, propertyName);
        return value == L"1" ? true : defaultValue;
    }
};

// Command execution helper
class CommandExecutor {
public:
    struct ExecutionResult {
        bool success;
        DWORD exitCode;
        std::wstring output;
        std::wstring error;
    };
    
    static ExecutionResult Execute(MSIHANDLE hInstall, const std::wstring& command, 
                                 const std::wstring& workingDir = L"", 
                                 int timeoutMs = 300000) {
        Logger::Info(hInstall, L"Executing: " + command);
        
        STARTUPINFOW si = { sizeof(si) };
        PROCESS_INFORMATION pi = { 0 };
        
        si.dwFlags = STARTF_USESHOWWINDOW | STARTF_USESTDHANDLES;
        si.wShowWindow = SW_HIDE;
        
        // Create pipes for output capture
        HANDLE hStdoutRead, hStdoutWrite;
        HANDLE hStderrRead, hStderrWrite;
        
        SECURITY_ATTRIBUTES sa = { sizeof(SECURITY_ATTRIBUTES), NULL, TRUE };
        
        CreatePipe(&hStdoutRead, &hStdoutWrite, &sa, 0);
        CreatePipe(&hStderrRead, &hStderrWrite, &sa, 0);
        
        SetHandleInformation(hStdoutRead, HANDLE_FLAG_INHERIT, 0);
        SetHandleInformation(hStderrRead, HANDLE_FLAG_INHERIT, 0);
        
        si.hStdOutput = hStdoutWrite;
        si.hStdError = hStderrWrite;
        
        std::vector<wchar_t> cmdBuffer(command.begin(), command.end());
        cmdBuffer.push_back(L'\0');
        
        BOOL result = CreateProcessW(
            nullptr,
            cmdBuffer.data(),
            nullptr,
            nullptr,
            TRUE,
            CREATE_NO_WINDOW,
            nullptr,
            workingDir.empty() ? nullptr : workingDir.c_str(),
            &si,
            &pi
        );
        
        CloseHandle(hStdoutWrite);
        CloseHandle(hStderrWrite);
        
        ExecutionResult execResult = { false, 0, L"", L"" };
        
        if (!result) {
            Logger::Error(hInstall, L"Failed to create process: " + std::to_wstring(GetLastError()));
            CloseHandle(hStdoutRead);
            CloseHandle(hStderrRead);
            return execResult;
        }
        
        // Wait for completion with timeout
        DWORD waitResult = WaitForSingleObject(pi.hProcess, timeoutMs);
        
        if (waitResult == WAIT_TIMEOUT) {
            Logger::Error(hInstall, L"Command execution timed out");
            TerminateProcess(pi.hProcess, 1);
        }
        
        GetExitCodeProcess(pi.hProcess, &execResult.exitCode);
        execResult.success = (execResult.exitCode == 0);
        
        // Read output
        execResult.output = ReadPipeOutput(hStdoutRead);
        execResult.error = ReadPipeOutput(hStderrRead);
        
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        CloseHandle(hStdoutRead);
        CloseHandle(hStderrRead);
        
        if (execResult.success) {
            Logger::Info(hInstall, L"Command completed successfully");
        } else {
            Logger::Error(hInstall, L"Command failed with exit code: " + std::to_wstring(execResult.exitCode));
            if (!execResult.error.empty()) {
                Logger::Error(hInstall, L"Error output: " + execResult.error);
            }
        }
        
        return execResult;
    }

private:
    static std::wstring ReadPipeOutput(HANDLE hPipe) {
        std::wstring output;
        const DWORD bufferSize = 4096;
        char buffer[bufferSize];
        DWORD bytesRead;
        
        while (ReadFile(hPipe, buffer, bufferSize - 1, &bytesRead, nullptr) && bytesRead > 0) {
            buffer[bytesRead] = '\0';
            // Convert to wide string (simplified conversion)
            std::wstring wbuffer(buffer, buffer + bytesRead);
            output += wbuffer;
        }
        
        return output;
    }
};

// Network utilities
class NetworkHelper {
public:
    static bool IsPortAvailable(int port, const std::wstring& host = L"127.0.0.1") {
        WSADATA wsaData;
        if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
            return false;
        }
        
        SOCKET sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (sock == INVALID_SOCKET) {
            WSACleanup();
            return false;
        }
        
        sockaddr_in addr = { 0 };
        addr.sin_family = AF_INET;
        inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);
        addr.sin_port = htons(port);
        
        int result = bind(sock, (sockaddr*)&addr, sizeof(addr));
        closesocket(sock);
        WSACleanup();
        
        return result == 0;
    }
    
    static int FindAvailablePort(MSIHANDLE hInstall, int preferredPort, int rangeStart, int rangeEnd) {
        if (IsPortAvailable(preferredPort)) {
            return preferredPort;
        }
        
        Logger::Warning(hInstall, L"Preferred port " + std::to_wstring(preferredPort) + L" is not available, searching for alternative...");
        
        for (int port = rangeStart; port <= rangeEnd; ++port) {
            if (IsPortAvailable(port)) {
                Logger::Info(hInstall, L"Found available port: " + std::to_wstring(port));
                return port;
            }
        }
        
        Logger::Error(hInstall, L"No available ports found in range " + 
                     std::to_wstring(rangeStart) + L"-" + std::to_wstring(rangeEnd));
        return -1;
    }
};

// System compatibility checker
class SystemChecker {
public:
    struct SystemInfo {
        std::wstring osVersion;
        std::wstring architecture;
        DWORD totalMemoryMB;
        ULONGLONG freeDiskSpaceGB;
        bool isElevated;
        bool hasRequiredFeatures;
    };
    
    static SystemInfo GetSystemInfo() {
        SystemInfo info = {};
        
        // Get OS version
        OSVERSIONINFOW osvi = { sizeof(OSVERSIONINFOW) };
        if (GetVersionExW(&osvi)) {
            info.osVersion = std::to_wstring(osvi.dwMajorVersion) + L"." + std::to_wstring(osvi.dwMinorVersion);
        }
        
        // Get architecture
        SYSTEM_INFO si;
        GetSystemInfo(&si);
        info.architecture = (si.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_AMD64) ? L"x64" : L"x86";
        
        // Get memory info
        MEMORYSTATUSEX memStatus = { sizeof(MEMORYSTATUSEX) };
        if (GlobalMemoryStatusEx(&memStatus)) {
            info.totalMemoryMB = static_cast<DWORD>(memStatus.ullTotalPhys / (1024 * 1024));
        }
        
        // Get disk space
        ULARGE_INTEGER freeBytesToCaller;
        if (GetDiskFreeSpaceExW(L"C:\\", &freeBytesToCaller, nullptr, nullptr)) {
            info.freeDiskSpaceGB = freeBytesToCaller.QuadPart / (1024 * 1024 * 1024);
        }
        
        // Check elevation
        info.isElevated = IsElevated();
        
        return info;
    }
    
    static bool CheckCompatibility(MSIHANDLE hInstall, const SystemInfo& info) {
        bool compatible = true;
        
        // Check Windows version (Windows 10 or later)
        if (info.osVersion < L"10.0") {
            Logger::Error(hInstall, L"Windows 10 or later is required. Found: " + info.osVersion);
            compatible = false;
        }
        
        // Check architecture
        if (info.architecture != L"x64") {
            Logger::Error(hInstall, L"64-bit architecture is required. Found: " + info.architecture);
            compatible = false;
        }
        
        // Check memory (4 GB minimum)
        if (info.totalMemoryMB < 4096) {
            Logger::Warning(hInstall, L"System has " + std::to_wstring(info.totalMemoryMB) + 
                           L" MB RAM. 4 GB minimum recommended.");
        }
        
        // Check disk space (2 GB minimum)
        if (info.freeDiskSpaceGB < 2) {
            Logger::Error(hInstall, L"Insufficient disk space. At least 2 GB required. Available: " + 
                         std::to_wstring(info.freeDiskSpaceGB) + L" GB");
            compatible = false;
        }
        
        // Check elevation
        if (!info.isElevated) {
            Logger::Error(hInstall, L"Administrator privileges are required for installation.");
            compatible = false;
        }
        
        return compatible;
    }

private:
    static bool IsElevated() {
        BOOL isElevated = FALSE;
        HANDLE hToken = nullptr;
        
        if (OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &hToken)) {
            TOKEN_ELEVATION elevation;
            DWORD size = sizeof(TOKEN_ELEVATION);
            
            if (GetTokenInformation(hToken, TokenElevation, &elevation, sizeof(elevation), &size)) {
                isElevated = elevation.TokenIsElevated;
            }
            
            CloseHandle(hToken);
        }
        
        return isElevated != FALSE;
    }
};

// Configuration generator
class ConfigurationManager {
public:
    static bool GenerateConfiguration(MSIHANDLE hInstall) {
        std::wstring deploymentMode = PropertyHelper::GetProperty(hInstall, L"DEPLOYMENT_MODE");
        std::wstring installDir = PropertyHelper::GetProperty(hInstall, L"INSTALLFOLDER");
        std::wstring dataDir = PropertyHelper::GetProperty(hInstall, L"PROGRAMDATADIR") + L"HotM\\";
        
        Logger::Info(hInstall, L"Generating configuration for deployment mode: " + deploymentMode);
        
        // Generate mode-specific configuration
        std::wstring configContent = GenerateModeConfig(hInstall, deploymentMode);
        
        // Write configuration file
        std::wstring configPath = dataDir + L"config\\runtime-config.toml";
        return WriteConfigFile(hInstall, configPath, configContent);
    }

private:
    static std::wstring GenerateModeConfig(MSIHANDLE hInstall, const std::wstring& mode) {
        std::wstring config = L"# HotM Runtime Configuration\n";
        config += L"# Generated by installer on " + GetCurrentDateTime() + L"\n\n";
        
        config += L"[runtime]\n";
        config += L"mode = \"" + mode + L"\"\n";
        config += L"version = \"" + PropertyHelper::GetProperty(hInstall, L"ProductVersion") + L"\"\n\n";
        
        if (mode == L"desktop" || mode == L"hybrid") {
            config += GenerateDesktopConfig(hInstall);
        }
        
        if (mode == L"server" || mode == L"hybrid" || mode == L"development") {
            config += GenerateServerConfig(hInstall);
        }
        
        if (PropertyHelper::GetBoolProperty(hInstall, L"INSTALL_EMBEDDED_DB")) {
            config += GenerateDatabaseConfig(hInstall);
        }
        
        if (PropertyHelper::GetBoolProperty(hInstall, L"INSTALL_EMBEDDED_OLLAMA")) {
            config += GenerateOllamaConfig(hInstall);
        }
        
        return config;
    }
    
    static std::wstring GenerateDesktopConfig(MSIHANDLE hInstall) {
        std::wstring config = L"[desktop]\n";
        config += L"show_gui = true\n";
        config += L"system_tray = true\n";
        config += L"auto_start = " + (PropertyHelper::GetBoolProperty(hInstall, L"ADD_TO_STARTUP") ? L"true" : L"false") + L"\n";
        config += L"global_hotkey = \"Ctrl+Alt+H\"\n\n";
        return config;
    }
    
    static std::wstring GenerateServerConfig(MSIHANDLE hInstall) {
        int port = PropertyHelper::GetIntProperty(hInstall, L"HOTM_SERVER_PORT", 53211);
        
        std::wstring config = L"[server]\n";
        config += L"bind_address = \"127.0.0.1:" + std::to_wstring(port) + L"\"\n";
        config += L"enable_web_ui = true\n";
        config += L"enable_api = true\n";
        config += L"enable_websocket = true\n\n";
        return config;
    }
    
    static std::wstring GenerateDatabaseConfig(MSIHANDLE hInstall) {
        int port = PropertyHelper::GetIntProperty(hInstall, L"POSTGRES_PORT", 54321);
        std::wstring dataDir = PropertyHelper::GetProperty(hInstall, L"PROGRAMDATADIR") + L"HotM\\";
        
        std::wstring config = L"[database]\n";
        config += L"type = \"postgresql\"\n";
        config += L"host = \"localhost\"\n";
        config += L"port = " + std::to_wstring(port) + L"\n";
        config += L"database = \"hotm\"\n";
        config += L"username = \"hotm\"\n";
        config += L"ssl_mode = \"disable\"\n";
        config += L"pool_size = 20\n";
        config += L"cluster_path = \"" + dataDir + L"database\\\\cluster\"\n\n";
        return config;
    }
    
    static std::wstring GenerateOllamaConfig(MSIHANDLE hInstall) {
        int port = PropertyHelper::GetIntProperty(hInstall, L"OLLAMA_PORT", 11434);
        
        std::wstring config = L"[ollama]\n";
        config += L"host = \"localhost\"\n";
        config += L"port = " + std::to_wstring(port) + L"\n";
        config += L"generation_model = \"gpt-oss:20b\"\n";
        config += L"embedding_model = \"nomic-embed-text\"\n\n";
        return config;
    }
    
    static bool WriteConfigFile(MSIHANDLE hInstall, const std::wstring& path, const std::wstring& content) {
        try {
            std::filesystem::create_directories(std::filesystem::path(path).parent_path());
            
            std::wofstream file(path);
            if (file.is_open()) {
                file << content;
                file.close();
                Logger::Info(hInstall, L"Configuration written to: " + path);
                return true;
            } else {
                Logger::Error(hInstall, L"Failed to open configuration file for writing: " + path);
                return false;
            }
        } catch (const std::exception& e) {
            Logger::Error(hInstall, L"Exception writing configuration: " + std::wstring(e.what(), e.what() + strlen(e.what())));
            return false;
        }
    }
    
    static std::wstring GetCurrentDateTime() {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        
        std::wstringstream ss;
        ss << std::put_time(std::gmtime(&time_t), L"%Y-%m-%dT%H:%M:%SZ");
        return ss.str();
    }
};

} // namespace installer
} // namespace hotm

// Custom Action Implementations
extern "C" __declspec(dllexport) UINT CheckSystemCompatibility(MSIHANDLE hInstall) {
    hotm::installer::Logger::Info(hInstall, L"Starting system compatibility check...");
    
    try {
        auto systemInfo = hotm::installer::SystemChecker::GetSystemInfo();
        
        hotm::installer::Logger::Info(hInstall, L"System Information:");
        hotm::installer::Logger::Info(hInstall, L"  OS Version: " + systemInfo.osVersion);
        hotm::installer::Logger::Info(hInstall, L"  Architecture: " + systemInfo.architecture);
        hotm::installer::Logger::Info(hInstall, L"  Memory: " + std::to_wstring(systemInfo.totalMemoryMB) + L" MB");
        hotm::installer::Logger::Info(hInstall, L"  Free Disk Space: " + std::to_wstring(systemInfo.freeDiskSpaceGB) + L" GB");
        hotm::installer::Logger::Info(hInstall, L"  Elevated: " + (systemInfo.isElevated ? std::wstring(L"Yes") : std::wstring(L"No")));
        
        if (!hotm::installer::SystemChecker::CheckCompatibility(hInstall, systemInfo)) {
            hotm::installer::Logger::Error(hInstall, L"System compatibility check failed");
            return ERROR_INSTALL_FAILURE;
        }
        
        hotm::installer::Logger::Info(hInstall, L"System compatibility check passed");
        return ERROR_SUCCESS;
    }
    catch (const std::exception& e) {
        hotm::installer::Logger::Error(hInstall, L"Exception during system compatibility check: " + 
                                      std::wstring(e.what(), e.what() + strlen(e.what())));
        return ERROR_INSTALL_FAILURE;
    }
}

extern "C" __declspec(dllexport) UINT ResolvePortConflicts(MSIHANDLE hInstall) {
    hotm::installer::Logger::Info(hInstall, L"Resolving port conflicts...");
    
    try {
        // Check and resolve PostgreSQL port
        if (hotm::installer::PropertyHelper::GetBoolProperty(hInstall, L"INSTALL_EMBEDDED_DB")) {
            int pgPort = hotm::installer::PropertyHelper::GetIntProperty(hInstall, L"POSTGRES_PORT", 54321);
            int newPgPort = hotm::installer::NetworkHelper::FindAvailablePort(hInstall, pgPort, 54321, 55000);
            
            if (newPgPort == -1) {
                hotm::installer::Logger::Error(hInstall, L"Could not find available port for PostgreSQL");
                return ERROR_INSTALL_FAILURE;
            }
            
            if (newPgPort != pgPort) {
                hotm::installer::PropertyHelper::SetProperty(hInstall, L"POSTGRES_PORT", std::to_wstring(newPgPort));
                hotm::installer::Logger::Info(hInstall, L"PostgreSQL port changed to: " + std::to_wstring(newPgPort));
            }
        }
        
        // Check and resolve Ollama port
        if (hotm::installer::PropertyHelper::GetBoolProperty(hInstall, L"INSTALL_EMBEDDED_OLLAMA")) {
            int ollamaPort = hotm::installer::PropertyHelper::GetIntProperty(hInstall, L"OLLAMA_PORT", 11434);
            int newOllamaPort = hotm::installer::NetworkHelper::FindAvailablePort(hInstall, ollamaPort, 11434, 12000);
            
            if (newOllamaPort == -1) {
                hotm::installer::Logger::Error(hInstall, L"Could not find available port for Ollama");
                return ERROR_INSTALL_FAILURE;
            }
            
            if (newOllamaPort != ollamaPort) {
                hotm::installer::PropertyHelper::SetProperty(hInstall, L"OLLAMA_PORT", std::to_wstring(newOllamaPort));
                hotm::installer::Logger::Info(hInstall, L"Ollama port changed to: " + std::to_wstring(newOllamaPort));
            }
        }
        
        // Check and resolve HotM server port
        std::wstring deploymentMode = hotm::installer::PropertyHelper::GetProperty(hInstall, L"DEPLOYMENT_MODE");
        if (deploymentMode == L"server" || deploymentMode == L"hybrid" || deploymentMode == L"development") {
            int serverPort = hotm::installer::PropertyHelper::GetIntProperty(hInstall, L"HOTM_SERVER_PORT", 53211);
            int newServerPort = hotm::installer::NetworkHelper::FindAvailablePort(hInstall, serverPort, 53211, 54000);
            
            if (newServerPort == -1) {
                hotm::installer::Logger::Error(hInstall, L"Could not find available port for HotM server");
                return ERROR_INSTALL_FAILURE;
            }
            
            if (newServerPort != serverPort) {
                hotm::installer::PropertyHelper::SetProperty(hInstall, L"HOTM_SERVER_PORT", std::to_wstring(newServerPort));
                hotm::installer::Logger::Info(hInstall, L"HotM server port changed to: " + std::to_wstring(newServerPort));
            }
        }
        
        hotm::installer::Logger::Info(hInstall, L"Port conflict resolution completed successfully");
        return ERROR_SUCCESS;
    }
    catch (const std::exception& e) {
        hotm::installer::Logger::Error(hInstall, L"Exception during port conflict resolution: " + 
                                      std::wstring(e.what(), e.what() + strlen(e.what())));
        return ERROR_INSTALL_FAILURE;
    }
}

extern "C" __declspec(dllexport) UINT ConfigureServices(MSIHANDLE hInstall) {
    hotm::installer::Logger::Info(hInstall, L"Configuring services...");
    
    try {
        // Generate runtime configuration
        if (!hotm::installer::ConfigurationManager::GenerateConfiguration(hInstall)) {
            hotm::installer::Logger::Error(hInstall, L"Failed to generate runtime configuration");
            return ERROR_INSTALL_FAILURE;
        }
        
        hotm::installer::Logger::Info(hInstall, L"Services configured successfully");
        return ERROR_SUCCESS;
    }
    catch (const std::exception& e) {
        hotm::installer::Logger::Error(hInstall, L"Exception during service configuration: " + 
                                      std::wstring(e.what(), e.what() + strlen(e.what())));
        return ERROR_INSTALL_FAILURE;
    }
}

extern "C" __declspec(dllexport) UINT ValidateInstallation(MSIHANDLE hInstall) {
    hotm::installer::Logger::Info(hInstall, L"Validating installation...");
    
    try {
        std::wstring installDir = hotm::installer::PropertyHelper::GetProperty(hInstall, L"INSTALLFOLDER");
        
        // Check that main executable exists
        std::wstring mainExe = installDir + L"bin\\hotm.exe";
        if (!std::filesystem::exists(mainExe)) {
            hotm::installer::Logger::Error(hInstall, L"Main executable not found: " + mainExe);
            return ERROR_INSTALL_FAILURE;
        }
        
        // Check that configuration files exist
        std::wstring dataDir = hotm::installer::PropertyHelper::GetProperty(hInstall, L"PROGRAMDATADIR") + L"HotM\\";
        std::wstring configFile = dataDir + L"config\\runtime-config.toml";
        if (!std::filesystem::exists(configFile)) {
            hotm::installer::Logger::Error(hInstall, L"Configuration file not found: " + configFile);
            return ERROR_INSTALL_FAILURE;
        }
        
        // Test basic functionality
        std::wstring testCommand = L"\"" + mainExe + L"\" --version";
        auto result = hotm::installer::CommandExecutor::Execute(hInstall, testCommand, L"", 30000);
        
        if (!result.success) {
            hotm::installer::Logger::Error(hInstall, L"Application validation failed - version check failed");
            return ERROR_INSTALL_FAILURE;
        }
        
        hotm::installer::Logger::Info(hInstall, L"Installation validation completed successfully");
        return ERROR_SUCCESS;
    }
    catch (const std::exception& e) {
        hotm::installer::Logger::Error(hInstall, L"Exception during installation validation: " + 
                                      std::wstring(e.what(), e.what() + strlen(e.what())));
        return ERROR_INSTALL_FAILURE;
    }
}

// DLL Entry Point
BOOL APIENTRY DllMain(HMODULE hModule, DWORD reason, LPVOID lpReserved) {
    switch (reason) {
        case DLL_PROCESS_ATTACH:
            DisableThreadLibraryCalls(hModule);
            break;
        case DLL_PROCESS_DETACH:
            break;
    }
    return TRUE;
}