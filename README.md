# Trading Tracker - Advanced Web App

A comprehensive, offline-capable trading tracker built with React that stores all data in your browser's local storage. Track your daily trades, analyze performance, and visualize your equity curve - all without needing an internet connection!

## Features

### 📊 Core Functionality
- **Daily Trade Entry**: Enter P&L for each trading day with automatic calculations
- **Local Storage**: All data saved in your browser - works completely offline
- **Settings Management**: Configure starting balance, risk percentage, and risk-to-reward ratio
- **Data Management**: Delete individual trades or clear all data

### 📈 Advanced Analytics
- **Trade History Table**: Complete view of all trades with:
  - Date, Day, P&L, % Gain/Loss
  - Open/Close Balance
  - Risk $, Target $, R:R Achieved
  - Result indicators (🎯 CRUSHED IT! for target hits)
  - Cumulative P&L tracking
  - Notes for each trade

### 📅 Calendar View
- **Visual Calendar**: See all trading days at a glance
- **Trade Counts**: Number of trades per day displayed on calendar
- **Best Month Highlight**: Automatically identifies your best performing month
- **Day Details**: Click any day to see detailed trade information
- **Month Statistics**: P&L, win rate, and trade count for each month

### 📉 Equity Curve
- **Account Balance Chart**: Visualize your account balance over time
- **Cumulative P&L Chart**: Track your total profit/loss progression
- **Performance Metrics**: 
  - Current Balance
  - Total Return ($ and %)
  - Max Drawdown ($ and %)

### 🎨 Modern UI/UX
- **Dark Mode Design**: Beautiful, modern dark theme optimized for trading
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile
- **Smooth Animations**: Polished interactions and transitions
- **Color-Coded Results**: Green for wins, red for losses, special indicators for target hits

## Getting Started

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown (typically `http://localhost:5173`)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

### First Time Setup

1. Go to **Settings** tab
2. Enter your:
   - Starting Balance (e.g., $1000)
   - Risk Per Trade % (e.g., 2%)
   - Risk to Reward Ratio (e.g., 3 for 1:3)
3. Click **Save Settings**

### Adding Trades

1. Go to **Dashboard** tab
2. Enter your P&L for the day (positive for profit, negative for loss)
3. Optionally add notes
4. Click **Add Trade**

The app automatically calculates:
- Open Balance (from previous day's close)
- Close Balance (open + P&L)
- % Gain/Loss
- Risk $ and Target $ based on your settings
- R:R Achieved
- Whether you hit your target (shows "🎯 CRUSHED IT!" if yes)

### Viewing Your Data

- **Dashboard**: Add trades and see overall statistics
- **Calendar**: Visual calendar view with trade counts and best month
- **History**: Complete table of all trades with full details
- **Equity Curve**: Charts showing account balance and P&L over time

### Managing Data

- **Delete a Trade**: Click the 🗑️ button in the History table
- **Clear All Data**: Click "Clear All Data" button in History tab (with confirmation)

## Data Storage

All data is stored in your browser's local storage:
- Settings: `trading_tracker_settings`
- Trades: `trading_tracker_trades`

Your data persists between browser sessions and works completely offline. To backup your data, you can export it from browser DevTools (Application > Local Storage).

## Technologies Used

- **React 18**: Modern React with hooks
- **Vite**: Fast build tool and dev server
- **Recharts**: Beautiful charting library
- **date-fns**: Date manipulation and formatting
- **CSS3**: Modern styling with CSS variables for theming

## Browser Support

Works in all modern browsers that support:
- ES6+ JavaScript
- Local Storage API
- CSS Grid and Flexbox

Tested on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Deployment on Railway

This project is configured for easy deployment on Railway.

### Quick Deploy

1. **Install Railway CLI** (optional, but recommended):
   ```bash
   npm i -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Initialize Railway project**:
   ```bash
   railway init
   ```

4. **Deploy**:
   ```bash
   railway up
   ```

### Deploy via Railway Dashboard

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo" (if your code is on GitHub) or "Empty Project"
4. If using GitHub:
   - Connect your repository
   - Railway will automatically detect the `railway.json` configuration
   - The project will build and deploy automatically
5. If using Empty Project:
   - Connect your local project using `railway link`
   - Or push your code to GitHub first

### Configuration

The project includes:
- `railway.json`: Railway configuration file
- `server.js`: Express server to serve the built static files
- Updated `package.json` with `start` script and Express dependency

Railway will automatically:
- Install dependencies (`npm install`)
- Build the project (`npm run build`)
- Start the server (`npm start`)

The app will be available at a Railway-provided URL (e.g., `your-app.railway.app`).

## License

Free to use for personal trading tracking.

---

**Happy Trading! 📈💰**
