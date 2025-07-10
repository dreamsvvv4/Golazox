# 🚀 Git Setup Guide for Ultra KibanaDownloader

## 📋 **Step-by-Step Git Repository Creation**

### Step 1: Install Git
1. **Run the installer**: Double-click `setup_git.bat`
2. **If Git not installed**: The script will download and install Git for Windows
3. **Follow installer**: Keep default settings, just click "Next" → "Install"
4. **Restart terminal**: Close and reopen PowerShell/Command Prompt

### Step 2: Configure Git (First Time Only)
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@verisure.com"
```

### Step 3: Initialize Repository
```bash
git init
git add .
git commit -m "Initial commit: Ultra KibanaDownloader v1.0"
```

### Step 4: Create Online Repository

#### Option A: GitHub (Recommended)
1. **Go to**: https://github.com
2. **Sign up/Login** with your account
3. **Click**: "New repository" (green button)
4. **Repository name**: `ultra-kibana-downloader`
5. **Description**: "Advanced log analytics tool for Elasticsearch"
6. **Visibility**: 
   - ✅ **Public** (recommended - easy sharing)
   - ⚠️ **Private** (if sensitive)
7. **DON'T check**: "Add a README file"
8. **Click**: "Create repository"

#### Option B: GitLab (Corporate Alternative)
1. **Go to**: https://gitlab.com
2. Same process as GitHub

#### Option C: Bitbucket (Atlassian)
1. **Go to**: https://bitbucket.org
2. Same process as GitHub

### Step 5: Connect Local to Online Repository

After creating online repository, you'll see a page with commands. Copy the **HTTPS URL** and run:

```bash
git remote add origin https://github.com/yourusername/ultra-kibana-downloader.git
git branch -M main
git push -u origin main
```

## 🎯 **Daily Git Workflow**

### Making Changes and Pushing
```bash
# 1. Make your changes to files
# 2. Add changes to staging
git add .

# 3. Commit with description
git commit -m "Added new feature: improved dialog design"

# 4. Push to repository
git push
```

### Checking Status
```bash
git status          # See what files changed
git log --oneline    # See commit history
```

### Creating Versions/Releases
```bash
# Create a version tag
git tag -a v1.1 -m "Version 1.1: Added modern service dialog"
git push --tags
```

## 📁 **Repository Structure**

Your repository will look like this:
```
ultra-kibana-downloader/
├── README.md                    # Main documentation
├── ElasticLoganaGUI.java       # Main application
├── ElasticLoganaGUI.jar        # Compiled application
├── main.py                     # Python backend
├── model/                      # Configuration classes
├── ui/components/              # UI components
├── Requirements/               # Installers and dependencies
├── conf*.py                    # Configuration files
├── .gitignore                  # Git ignore rules
└── setup_git.bat              # Git setup script
```

## 🔄 **Common Git Commands**

### Basic Operations
```bash
git status                      # Check current status
git add filename.java          # Add specific file
git add .                      # Add all changes
git commit -m "Description"    # Commit changes
git push                       # Upload to repository
```

### Viewing Changes
```bash
git diff                       # See what changed
git log                        # See commit history
git show                       # See last commit details
```

### Branching (Advanced)
```bash
git branch feature-name        # Create new branch
git checkout feature-name      # Switch to branch
git merge feature-name         # Merge branch to main
```

### Undoing Changes
```bash
git checkout -- filename      # Undo changes to file
git reset HEAD filename       # Unstage file
git revert commit-hash        # Undo specific commit
```

## 🆘 **Troubleshooting**

### "Git not recognized"
- Run `setup_git.bat` to install Git
- Restart your terminal
- Check installation: `git --version`

### "Permission denied"
- Use HTTPS URL instead of SSH
- Check your GitHub/GitLab login

### "Repository already exists"
- Use a different repository name
- Or delete the existing one and recreate

### "Failed to push"
- Pull first: `git pull origin main`
- Then push: `git push`

## 🎉 **Benefits of Using Git**

✅ **Version Control**: Track all changes to your code  
✅ **Backup**: Your code is safe in the cloud  
✅ **Collaboration**: Easy sharing with team members  
✅ **History**: See what changed and when  
✅ **Branching**: Work on features without breaking main code  
✅ **Releases**: Create official versions with tags  

## 🚀 **Next Steps**

1. **Run** `setup_git.bat`
2. **Create** online repository (GitHub recommended)
3. **Connect** local to online repository
4. **Start** making commits for each change
5. **Share** repository URL with your team

---

**Pro Tip**: Make small, frequent commits with descriptive messages. This makes it easier to track changes and find issues later!

**Example commit messages**:
- `"Added search functionality to service dialog"`
- `"Fixed progress bar update issue"`
- `"Updated README with installation instructions"`
- `"Released version 1.1 with modern UI"`
