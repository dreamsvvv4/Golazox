@echo off
echo =====================================
echo  GITHUB REPOSITORY SETUP SCRIPT
echo =====================================
echo.
echo This script will help you connect your local Git repository to GitHub.
echo.
echo PREREQUISITES:
echo 1. You need a GitHub account
echo 2. You should create a new repository on GitHub first
echo.
echo STEPS TO FOLLOW:
echo.
echo 1. Go to https://github.com and log in to your account
echo 2. Click "New repository" (green button)
echo 3. Enter repository name: elasticlogana
echo 4. Make it Public or Private (your choice)
echo 5. DO NOT initialize with README (we already have one)
echo 6. Click "Create repository"
echo.
echo 7. Copy the repository URL from GitHub (it will look like):
echo    https://github.com/yourusername/elasticlogana.git
echo.
echo 8. Come back here and run the following commands:
echo.
echo    git remote add origin https://github.com/yourusername/elasticlogana.git
echo    git push -u origin main
echo.
echo Replace "yourusername" with your actual GitHub username.
echo.
echo CURRENT REPOSITORY STATUS:
echo Branch: main
echo Commits: 1 (Initial commit with all project files)
echo Ready to push to GitHub: YES
echo.
pause
