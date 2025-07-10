@echo off
echo ============================================
echo  Git Installation for Ultra KibanaDownloader
echo ============================================

echo [INFO] Checking if Git is already installed...
git --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Git is already installed!
    git --version
    goto :setup_repo
)

echo [INFO] Git not found. Installing Git for Windows...
echo [INFO] Downloading Git installer...

powershell -Command "& {Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v2.42.0.windows.2/Git-2.42.0.2-64-bit.exe' -OutFile 'Git-Installer.exe'}"

if exist "Git-Installer.exe" (
    echo [INFO] Running Git installer...
    echo [NOTE] Please follow the installation wizard
    echo [NOTE] Keep default settings, just click "Next" and "Install"
    start /wait Git-Installer.exe
    
    echo [INFO] Cleaning up installer...
    del Git-Installer.exe
    
    echo [INFO] Please close and reopen your terminal, then run this script again
    pause
    exit
) else (
    echo [ERROR] Failed to download Git installer
    echo [INFO] Please download Git manually from: https://git-scm.com/download/win
    pause
    exit
)

:setup_repo
echo.
echo ============================================
echo  Setting up Git Repository
echo ============================================

echo [INFO] Configuring Git (first time setup)...
set /p user_name="Enter your name for Git commits: "
set /p user_email="Enter your email for Git commits: "

git config --global user.name "%user_name%"
git config --global user.email "%user_email%"

echo [INFO] Initializing Git repository...
git init

echo [INFO] Creating .gitignore file...
echo # Compiled class files > .gitignore
echo *.class >> .gitignore
echo. >> .gitignore
echo # Package files >> .gitignore
echo *.jar >> .gitignore
echo !ElasticLoganaGUI.jar >> .gitignore
echo. >> .gitignore
echo # Log files >> .gitignore
echo logs/*.log >> .gitignore
echo logs/*.txt >> .gitignore
echo. >> .gitignore
echo # Temporary files >> .gitignore
echo *.tmp >> .gitignore
echo *.temp >> .gitignore
echo. >> .gitignore
echo # ZIP distribution files >> .gitignore
echo *.zip >> .gitignore
echo. >> .gitignore
echo # IDE files >> .gitignore
echo .vscode/ >> .gitignore
echo .idea/ >> .gitignore
echo *.iml >> .gitignore

echo [INFO] Adding files to Git...
git add .

echo [INFO] Creating initial commit...
git commit -m "Initial commit: Ultra KibanaDownloader v1.0 - Professional log analytics tool"

echo.
echo ============================================
echo  Next Steps - Choose your Git hosting:
echo ============================================
echo.
echo 1. GITHUB (Recommended - Free, Popular)
echo    - Go to: https://github.com
echo    - Create account or login
echo    - Click "New repository"
echo    - Name: "ultra-kibana-downloader"
echo    - Keep it Public or Private (your choice)
echo    - Don't initialize with README
echo    - Copy the repository URL
echo.
echo 2. GITLAB (Alternative - Free, Corporate friendly)
echo    - Go to: https://gitlab.com
echo    - Same process as GitHub
echo.
echo 3. BITBUCKET (Atlassian - Good for teams)
echo    - Go to: https://bitbucket.org
echo    - Same process
echo.
echo Once you create the repository, come back and run:
echo.
echo git remote add origin [YOUR_REPOSITORY_URL]
echo git branch -M main
echo git push -u origin main
echo.
echo ============================================
echo  Quick Commands for Future Updates:
echo ============================================
echo.
echo git add .                     # Add all changes
echo git commit -m "Description"  # Commit changes
echo git push                      # Upload to repository
echo.
pause
