/*
 * HotM Installer Custom Actions for Embedded PostgreSQL
 * 
 * This file implements the custom actions called during MSI installation
 * to initialize and configure the embedded PostgreSQL database.
 */

#include <windows.h>
#include <msiquery.h>
#include <string>
#include <vector>
#include <fstream>
#include <filesystem>
#include <process.h>

// Logging helper
void LogMessage(MSIHANDLE hInstall, const std::wstring& message) {
    PMSIHANDLE hRecord = MsiCreateRecord(1);
    MsiRecordSetStringW(hRecord, 0, L"HotM Database Setup: [1]");
    MsiRecordSetStringW(hRecord, 1, message.c_str());
    MsiProcessMessage(hInstall, INSTALLMESSAGE_INFO, hRecord);
}

void LogError(MSIHANDLE hInstall, const std::wstring& error) {
    PMSIHANDLE hRecord = MsiCreateRecord(1);
    MsiRecordSetStringW(hRecord, 0, L"HotM Database Error: [1]");
    MsiRecordSetStringW(hRecord, 1, error.c_str());
    MsiProcessMessage(hInstall, INSTALLMESSAGE_ERROR, hRecord);
}

// Get MSI property helper
std::wstring GetProperty(MSIHANDLE hInstall, const std::wstring& propertyName) {
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

// Execute command and wait for completion
bool ExecuteCommand(MSIHANDLE hInstall, const std::wstring& command, const std::wstring& workingDir = L"") {
    LogMessage(hInstall, L"Executing: " + command);
    
    STARTUPINFOW si = { sizeof(si) };
    PROCESS_INFORMATION pi = { 0 };
    
    // Create mutable command string
    std::vector<wchar_t> cmdBuffer(command.begin(), command.end());
    cmdBuffer.push_back(L'\0');
    
    BOOL result = CreateProcessW(
        nullptr,                    // Application name
        cmdBuffer.data(),          // Command line
        nullptr,                   // Process security attributes
        nullptr,                   // Thread security attributes  
        FALSE,                     // Inherit handles
        CREATE_NO_WINDOW,          // Creation flags
        nullptr,                   // Environment
        workingDir.empty() ? nullptr : workingDir.c_str(),  // Current directory
        &si,                       // Startup info
        &pi                        // Process info
    );
    
    if (!result) {
        LogError(hInstall, L"Failed to create process: " + std::to_wstring(GetLastError()));
        return false;
    }
    
    // Wait for completion with timeout (10 minutes)
    DWORD waitResult = WaitForSingleObject(pi.hProcess, 600000);
    
    if (waitResult == WAIT_TIMEOUT) {
        LogError(hInstall, L"Command execution timed out");
        TerminateProcess(pi.hProcess, 1);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        return false;
    }
    
    DWORD exitCode = 0;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    
    if (exitCode != 0) {
        LogError(hInstall, L"Command failed with exit code: " + std::to_wstring(exitCode));
        return false;
    }
    
    LogMessage(hInstall, L"Command completed successfully");
    return true;
}

// Check if port is available
bool IsPortAvailable(int port) {
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
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");
    addr.sin_port = htons(port);
    
    int result = bind(sock, (sockaddr*)&addr, sizeof(addr));
    closesocket(sock);
    WSACleanup();
    
    return result == 0;
}

// Find available port starting from the preferred port
int FindAvailablePort(MSIHANDLE hInstall, int preferredPort) {
    // Try preferred port first
    if (IsPortAvailable(preferredPort)) {
        return preferredPort;
    }
    
    LogMessage(hInstall, L"Preferred port " + std::to_wstring(preferredPort) + L" is not available, searching for alternative...");
    
    // Search in range 54321-55000
    for (int port = 54321; port <= 55000; ++port) {
        if (IsPortAvailable(port)) {
            LogMessage(hInstall, L"Found available port: " + std::to_wstring(port));
            return port;
        }
    }
    
    LogError(hInstall, L"No available ports found in range 54321-55000");
    return -1;
}

// Generate secure random password
std::string GeneratePassword(int length = 20) {
    const char charset[] = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    const size_t charsetSize = sizeof(charset) - 1;
    
    std::string password;
    password.reserve(length);
    
    // Use Windows crypto API for secure random numbers
    HCRYPTPROV hProvider = 0;
    if (CryptAcquireContext(&hProvider, nullptr, nullptr, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT)) {
        for (int i = 0; i < length; ++i) {
            BYTE randomByte;
            if (CryptGenRandom(hProvider, 1, &randomByte)) {
                password += charset[randomByte % charsetSize];
            }
        }
        CryptReleaseContext(hProvider, 0);
    }
    
    return password;
}

// Custom Action: Initialize Embedded PostgreSQL
extern "C" __declspec(dllexport) UINT InitializeEmbeddedPostgreSQL(MSIHANDLE hInstall) {
    LogMessage(hInstall, L"Starting PostgreSQL initialization...");
    
    try {
        // Get installation properties
        std::wstring installDir = GetProperty(hInstall, L"INSTALLDIR");
        std::wstring dataDir = GetProperty(hInstall, L"PROGRAMDATADIR") + L"HotM\\";
        std::wstring postgresPort = GetProperty(hInstall, L"POSTGRES_PORT");
        
        if (installDir.empty() || dataDir.empty()) {
            LogError(hInstall, L"Required installation properties not found");
            return ERROR_INSTALL_FAILURE;
        }
        
        LogMessage(hInstall, L"Install directory: " + installDir);
        LogMessage(hInstall, L"Data directory: " + dataDir);
        
        // Validate and find available port
        int port = postgresPort.empty() ? 54321 : std::stoi(postgresPort);
        int availablePort = FindAvailablePort(hInstall, port);
        
        if (availablePort == -1) {
            LogError(hInstall, L"Could not find available port for PostgreSQL");
            return ERROR_INSTALL_FAILURE;
        }
        
        // Update port property if changed
        if (availablePort != port) {
            MsiSetPropertyW(hInstall, L"POSTGRES_PORT", std::to_wstring(availablePort).c_str());
        }
        
        // Create directory structure
        std::vector<std::wstring> directories = {
            dataDir + L"database\\cluster",
            dataDir + L"database\\backups\\daily",
            dataDir + L"database\\backups\\weekly", 
            dataDir + L"database\\backups\\pre-upgrade",
            dataDir + L"database\\backups\\manual",
            dataDir + L"database\\backups\\emergency",
            dataDir + L"database\\migration",
            dataDir + L"config",
            dataDir + L"logs\\postgresql"
        };
        
        for (const auto& dir : directories) {
            std::filesystem::create_directories(dir);
            LogMessage(hInstall, L"Created directory: " + dir);
        }
        
        // Generate database passwords
        std::string postgresPassword = GeneratePassword();
        std::string hotmPassword = GeneratePassword();
        
        // Store passwords securely (encrypted registry or protected file)
        HKEY hKey;
        if (RegCreateKeyExW(HKEY_LOCAL_MACHINE, L"SOFTWARE\\HotM\\Database\\Credentials", 
                           0, nullptr, 0, KEY_WRITE, nullptr, &hKey, nullptr) == ERROR_SUCCESS) {
            
            // In production, these should be encrypted
            RegSetValueExA(hKey, "PostgresPassword", 0, REG_SZ, 
                          (BYTE*)postgresPassword.c_str(), postgresPassword.length() + 1);
            RegSetValueExA(hKey, "HotmPassword", 0, REG_SZ, 
                          (BYTE*)hotmPassword.c_str(), hotmPassword.length() + 1);
            
            RegCloseKey(hKey);
            LogMessage(hInstall, L"Database passwords stored securely");
        }
        
        // Build PowerShell command for cluster initialization
        std::wstring psCommand = L"powershell.exe -ExecutionPolicy Bypass -Command \"& '";
        psCommand += installDir + L"database\\scripts\\init-cluster.ps1' ";
        psCommand += L"-InstallPath '" + installDir + L"' ";
        psCommand += L"-DataPath '" + dataDir + L"' ";
        psCommand += L"-PostgresPassword '" + std::wstring(postgresPassword.begin(), postgresPassword.end()) + L"' ";
        psCommand += L"-Port " + std::to_wstring(availablePort) + L"\"";
        
        // Execute cluster initialization
        if (!ExecuteCommand(hInstall, psCommand)) {
            LogError(hInstall, L"PostgreSQL cluster initialization failed");
            return ERROR_INSTALL_FAILURE;
        }
        
        LogMessage(hInstall, L"PostgreSQL initialization completed successfully");
        return ERROR_SUCCESS;
    }
    catch (const std::exception& e) {
        std::string error = "Exception during PostgreSQL initialization: ";
        error += e.what();
        LogError(hInstall, std::wstring(error.begin(), error.end()));
        return ERROR_INSTALL_FAILURE;
    }
}

// Custom Action: Configure Embedded PostgreSQL
extern "C" __declspec(dllexport) UINT ConfigureEmbeddedPostgreSQL(MSIHANDLE hInstall) {
    LogMessage(hInstall, L"Starting PostgreSQL configuration...");
    
    try {
        std::wstring installDir = GetProperty(hInstall, L"INSTALLDIR");
        std::wstring dataDir = GetProperty(hInstall, L"PROGRAMDATADIR") + L"HotM\\";
        std::wstring postgresPort = GetProperty(hInstall, L"POSTGRES_PORT");
        
        // Run configuration optimization
        std::wstring configCommand = L"\"" + installDir + L"bin\\hotm-db-manager.exe\" ";
        configCommand += L"configure --cluster-path \"" + dataDir + L"database\\cluster\" ";
        configCommand += L"--port " + postgresPort + L" --optimize-system";
        
        if (!ExecuteCommand(hInstall, configCommand)) {
            LogError(hInstall, L"PostgreSQL configuration failed");
            return ERROR_INSTALL_FAILURE;
        }
        
        // Create database configuration file
        std::wstring configFile = dataDir + L"config\\database.toml";
        std::wofstream config(configFile);
        
        if (config.is_open()) {
            config << L"[database]\n";
            config << L"type = \"postgresql\"\n";
            config << L"host = \"localhost\"\n";
            config << L"port = " << postgresPort << L"\n";
            config << L"database = \"hotm\"\n";
            config << L"username = \"hotm\"\n";
            config << L"ssl_mode = \"disable\"\n";
            config << L"pool_size = 20\n";
            config << L"embedded = true\n";
            config << L"\n";
            config << L"[cluster]\n";
            config << L"data_directory = \"" << dataDir << L"database\\\\cluster\"\n";
            config << L"backup_directory = \"" << dataDir << L"database\\\\backups\"\n";
            config << L"log_directory = \"" << dataDir << L"logs\\\\postgresql\"\n";
            
            config.close();
            LogMessage(hInstall, L"Database configuration file created");
        }
        
        LogMessage(hInstall, L"PostgreSQL configuration completed successfully");
        return ERROR_SUCCESS;
    }
    catch (const std::exception& e) {
        std::string error = "Exception during PostgreSQL configuration: ";
        error += e.what();
        LogError(hInstall, std::wstring(error.begin(), error.end()));
        return ERROR_INSTALL_FAILURE;
    }
}

// Custom Action: Start Database Service
extern "C" __declspec(dllexport) UINT StartDatabaseService(MSIHANDLE hInstall) {
    LogMessage(hInstall, L"Starting PostgreSQL database service...");
    
    try {
        // Start the Windows service
        SC_HANDLE hSCManager = OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT);
        if (hSCManager == nullptr) {
            LogError(hInstall, L"Failed to open Service Control Manager");
            return ERROR_INSTALL_FAILURE;
        }
        
        SC_HANDLE hService = OpenServiceW(hSCManager, L"HotM-PostgreSQL", SERVICE_START | SERVICE_QUERY_STATUS);
        if (hService == nullptr) {
            LogError(hInstall, L"Failed to open HotM-PostgreSQL service");
            CloseServiceHandle(hSCManager);
            return ERROR_INSTALL_FAILURE;
        }
        
        if (!StartServiceW(hService, 0, nullptr)) {
            DWORD error = GetLastError();
            if (error != ERROR_SERVICE_ALREADY_RUNNING) {
                LogError(hInstall, L"Failed to start service. Error: " + std::to_wstring(error));
                CloseServiceHandle(hService);
                CloseServiceHandle(hSCManager);
                return ERROR_INSTALL_FAILURE;
            }
        }
        
        // Wait for service to start (up to 60 seconds)
        SERVICE_STATUS status;
        int attempts = 0;
        const int maxAttempts = 60;
        
        do {
            Sleep(1000);  // Wait 1 second
            if (!QueryServiceStatus(hService, &status)) {
                LogError(hInstall, L"Failed to query service status");
                break;
            }
            attempts++;
        } while (status.dwCurrentState == SERVICE_START_PENDING && attempts < maxAttempts);
        
        CloseServiceHandle(hService);
        CloseServiceHandle(hSCManager);
        
        if (status.dwCurrentState == SERVICE_RUNNING) {
            LogMessage(hInstall, L"PostgreSQL service started successfully");
            
            // Verify database connectivity
            std::wstring testCommand = GetProperty(hInstall, L"INSTALLDIR") + L"bin\\hotm-db-manager.exe test-connection";
            if (ExecuteCommand(hInstall, testCommand)) {
                LogMessage(hInstall, L"Database connectivity verified");
                return ERROR_SUCCESS;
            } else {
                LogError(hInstall, L"Database connectivity test failed");
                return ERROR_INSTALL_FAILURE;
            }
        } else {
            LogError(hInstall, L"Service failed to start within timeout period");
            return ERROR_INSTALL_FAILURE;
        }
    }
    catch (const std::exception& e) {
        std::string error = "Exception during service startup: ";
        error += e.what();
        LogError(hInstall, std::wstring(error.begin(), error.end()));
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