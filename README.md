# 🌸 PeriodPal — Period Cycle Tracker

**PeriodPal** is a simple, user-friendly menstrual cycle tracking website that helps users record period dates, view their period history, and estimate upcoming periods.

The project is designed with a clean interface and responsive layout so it can be used on both mobile devices and desktop computers.

## ✨ Features

- 🩸 **Period Tracking:** Add period start and end dates.
- 📅 **Monthly Calendar:** View recorded period dates and navigate between months.
- 📊 **Cycle Calculations:** Calculate cycle length and bleeding duration.
- 🔮 **Next Period Estimation:** Estimate the next period date using available cycle history.
- 📝 **Period History:** View previously recorded periods.
- ✏️ **Edit and Delete:** Update or remove existing records.
- 💾 **Local Storage:** Save records in the browser so they remain available after refreshing the page.
- 🗑️ **Clear All Data:** Remove saved period records with confirmation.
- 📱 **Responsive Design:** Designed to work on mobile, tablet, and desktop screens.
- 🔒 **Privacy Awareness:** Period records are stored in the browser rather than intentionally sent to a project backend.

## 🛠️ Technologies Used

- HTML5
- CSS3
- JavaScript
- Browser Local Storage

*Adjust this list if your project uses additional technologies, such as React, Vite, or Tailwind CSS.*

## 🚀 Getting Started

### Run the project locally

1. Download or clone this repository.
2. Open the project folder in Visual Studio Code.
3. Open `index.html` in your browser, or use the Live Server extension if the project supports that workflow.

If your project uses Vite or React, follow the commands in `package.json` instead of opening `index.html` directly.

### Clone the repository

```bash
git clone YOUR_REPOSITORY_URL
cd YOUR_PROJECT_FOLDER
```

Replace `YOUR_REPOSITORY_URL` and `YOUR_PROJECT_FOLDER` with your actual repository URL and folder name.

## 📖 How It Works

1. Enter the start and end dates of a period.
2. View the recorded dates in the monthly calendar.
3. Check your period history and calculated cycle information.
4. Edit or delete records when necessary.
5. Revisit the website to access saved records in the same browser profile.

Cycle length is calculated from the first day of one period to the first day of the next distinct period. Bleeding duration counts both the start date and the end date.

Next-period dates are estimates, not guarantees, because menstrual cycles can vary.

## 🔐 Privacy and Data Storage

- Period records are saved using the browser's local storage.
- Local storage is not encrypted health-data storage.
- Anyone with access to the same browser profile may be able to access the saved records.
- Clearing browser data or site storage may erase saved records.
- Do not enter sensitive information on a shared or untrusted device.
- Do not commit real period records or other personal health information to GitHub.

## 🌐 Deployment

PeriodPal can be published using **GitHub Pages** if the project is configured correctly.

1. Push your project files to a GitHub repository.
2. Open the repository on GitHub.
3. Go to **Settings → Pages**.
4. Choose the appropriate deployment source or GitHub Actions workflow.
5. Complete the deployment configuration for your project.
6. Open the published URL and test the website.

For Vite or React projects, configure the correct base path for the repository before deploying.

## 🎯 Project Goals

- Practise front-end web development.
- Learn JavaScript date calculations and form validation.
- Understand browser local storage.
- Build responsive user interfaces.
- Learn testing, debugging, GitHub, and website deployment.

## ⚠️ Disclaimer

PeriodPal is an educational tracking tool. It does not provide medical advice, diagnose health conditions, or guarantee accurate period predictions. Consult a qualified healthcare professional for medical concerns.

## 👩‍💻 Author

Created as a personal web development project to practise front-end development and build a useful tracking application.

---

**Made with 💗 for learning and building.**
