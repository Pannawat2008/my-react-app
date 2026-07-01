# ⚡ AeroBlade Pro — Wind Turbine Blade Designer

A real-time, browser-based wind turbine blade designer with **3D visualization**, **BEM aerodynamic simulation**, and **interactive charts**. Design, analyze, and export wind turbine blades — all running client-side with zero server dependencies.

![Built with React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-0.184-000000?logo=three.js&logoColor=white)
![License](https://img.shields.io/badge/License-Private-gray)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Development](#-development)
- [Build for Production](#-build-for-production)
- [Project Structure](#-project-structure)
- [Architecture Overview](#-architecture-overview)
- [Configuration](#-configuration)
- [Export Formats](#-export-formats)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

### Blade Design
- **3 blade regions** — Root (structural), Mid-span (power), Tip (low-loss) with independent controls
- **3 airfoil profiles** — DU 91-W2-250, NREL S809, NACA 4412
- **Adjustable mid-span position** — Slide the root/mid/tip boundary from 15% to 85% of span
- **Planform shape** — Linear taper or optimized cosine-interpolated curve
- **Configurable segments** — 5 to 30 BEM segments for accuracy vs. performance trade-off

### Simulation
- **Real-time BEM solver** — Blade Element Momentum theory with:
  - Prandtl tip loss correction
  - Glauert empirical correction for high induction
  - Stall detection (AoA > 14°)
- **Power curve generation** — Sweeps wind speed 3–25 m/s
- **Live metrics** — Power (kW), Cp, Thrust (kN), RPM

### Visualization
- **Interactive 3D blade** — React Three Fiber with orbit controls, environment lighting, contact shadows
- **Spar cap visualization** — Toggle internal structural elements
- **3 chart tabs** — Aerodynamic efficiency (L/D & α), load distribution, power curve with Betz limit reference
- **Expandable charts panel** — Toggle between compact and expanded views

### Data Management
- **4 preset configurations** — Small Research (1m), Medium HAWT (5m), Utility Scale (10m), Custom
- **JSON save/load** — Export full design to JSON, import later
- **CSV export** — Blade aerodynamics data in UIUC/XFOIL format
- **STL export** — 3D printable geometry

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React 19 | UI components & state management |
| **Bundler** | Vite 8 | Dev server & production build |
| **3D Engine** | Three.js + React Three Fiber | 3D blade rendering |
| **3D Helpers** | @react-three/drei | OrbitControls, Environment, Shadows, Grid |
| **Charts** | Recharts 3 | Line charts, area charts, tooltips |
| **Styling** | Vanilla CSS | Custom design system with CSS classes |
| **Fonts** | Inter (Google Fonts) | Typography |

---

## 📦 Prerequisites

Before you begin, make sure you have:

- **Node.js** — Version 18.0 or higher ([download](https://nodejs.org/))
- **npm** — Version 9.0 or higher (comes with Node.js)

Verify your installation:

```bash
node --version   # Should print v18.x.x or higher
npm --version    # Should print 9.x.x or higher
```

---

## 🚀 Installation

### 1. Clone or download the project

```bash
# If using git
git clone <your-repo-url>
cd "Web for wind"

# Or just navigate to the project folder
cd "C:\Users\Panna\Documents\Web for wind"
```

### 2. Install dependencies

```bash
npm install
```

This will install all required packages (~231 packages). It should take about 30–60 seconds.

### 3. Verify installation

```bash
npm ls --depth=0
```

You should see these key dependencies:
```
├── @react-three/drei@10.7.7
├── @react-three/fiber@9.6.1
├── lucide-react@1.17.0
├── react@19.2.6
├── react-dom@19.2.6
├── recharts@3.8.1
└── three@0.184.0
```

---

## 💻 Development

### Start the dev server

```bash
npm run dev
```

This starts Vite's development server with Hot Module Replacement (HMR):

```
VITE v8.0.16  ready in ~300 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open **http://localhost:5173/** in your browser.

### Development tips

- **Hot reload** — Changes to `.jsx`, `.js`, and `.css` files automatically update in the browser
- **3D performance** — If the 3D view is slow, reduce the number of blade segments (5–10 is fast)
- **Browser** — Chrome or Edge recommended for best WebGL performance

### Lint the code

```bash
npm run lint
```

---

## 📦 Build for Production

### Create an optimized build

```bash
npm run build
```

This outputs static files to the `dist/` folder:

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js      (~400 KB gzipped)
│   └── index-[hash].css     (~15 KB)
└── favicon.svg
```

### Preview the production build locally

```bash
npm run preview
```

Opens on **http://localhost:4173/**

### Deploy

The `dist/` folder is fully static and can be deployed to any hosting service:

- **Vercel** — `npx vercel --prod`
- **Netlify** — Drag and drop the `dist/` folder
- **GitHub Pages** — Push `dist/` contents to `gh-pages` branch
- **Any static host** — Just serve the `dist/` folder

---

## 📁 Project Structure

```
Web for wind/
├── index.html                  # HTML entry point
├── package.json                # Dependencies & scripts
├── vite.config.js              # Vite configuration
├── eslint.config.js            # ESLint rules
├── public/
│   ├── favicon.svg             # App icon
│   └── icons.svg               # UI icons
├── src/
│   ├── main.jsx                # React entry point
│   ├── App.jsx                 # Main app layout, state, presets
│   ├── index.css               # Complete CSS design system
│   ├── components/
│   │   ├── Blade.jsx           # 3D blade mesh (Three.js geometry)
│   │   ├── ChartsPanel.jsx     # Tabbed charts (Recharts)
│   │   └── ControlsPanel.jsx   # Left sidebar controls & sliders
│   ├── engine/
│   │   ├── bem.js              # BEM aerodynamic solver
│   │   └── airfoils.js         # Airfoil polar database (Cl/Cd)
│   └── utils/
│       ├── airfoilProfile.js   # NACA 4-digit geometry generator
│       ├── geometryBuilder.js  # Blade segment interpolation
│       └── exporters.js        # CSV, STL, JSON export functions
└── dist/                       # Production build output
```

---

## 🏗 Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                         App.jsx                              │
│  State: bladeParams, windSpeed, tsr, showSpar, presets       │
│                                                              │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ ControlsPanel│  │   Canvas (3D)    │  │  Right Sidebar │  │
│  │             │  │                  │  │                │  │
│  │ • Geometry  │  │  ┌────────────┐  │  │ • CSV Export   │  │
│  │ • Mid-Span  │  │  │  Blade.jsx │  │  │ • STL Export   │  │
│  │ • Regions   │  │  │  (Three.js)│  │  │ • JSON Save    │  │
│  │ • Wind/TSR  │  │  └────────────┘  │  │ • JSON Load    │  │
│  │ • Structural│  │                  │  │                │  │
│  └──────┬──────┘  └────────┬─────────┘  └────────────────┘  │
│         │                  │                                 │
│         ▼                  ▼                                 │
│  ┌─────────────────────────────────────┐                     │
│  │         geometryBuilder.js          │                     │
│  │  Interpolates root→mid→tip params   │                     │
│  │  into discrete blade segments       │                     │
│  └──────────────┬──────────────────────┘                     │
│                 ▼                                            │
│  ┌─────────────────────────────────────┐                     │
│  │             bem.js                  │                     │
│  │  BEM solver: Cl/Cd → forces → power │                     │
│  │  + Prandtl tip loss                 │                     │
│  │  + Glauert correction               │                     │
│  └──────────────┬──────────────────────┘                     │
│                 ▼                                            │
│  ┌─────────────────────────────────────┐                     │
│  │          ChartsPanel.jsx            │                     │
│  │  Tab 1: Efficiency (L/D & AoA)      │                     │
│  │  Tab 2: Load Distribution           │                     │
│  │  Tab 3: Power Curve                 │                     │
│  └─────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User adjusts controls** → updates `bladeParams` state
2. **`geometryBuilder.js`** interpolates root/mid/tip parameters into segment array
3. **`bem.js`** runs BEM iteration on each segment → computes forces, power, Cp
4. **`Blade.jsx`** generates 3D mesh from segments → renders in Three.js canvas
5. **`ChartsPanel.jsx`** plots BEM results in interactive charts
6. **Power curve** sweeps wind speeds 3–25 m/s through BEM → plots power vs. wind

All computations use React `useMemo` — only recompute when inputs change.

---

## ⚙ Configuration

### Blade Parameters

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| Blade Length (R) | 100–20,000 mm | 10,000 mm | Rotor radius |
| Mid-Span Position | 15%–85% | 50% | Where root→mid/mid→tip boundary sits |
| Blade Segments | 5–30 | 15 | Number of BEM elements |
| Planform Shape | Linear / Optimized | Optimized | Interpolation method |

### Per-Region Parameters (Root / Mid / Tip)

| Parameter | Range | Description |
|-----------|-------|-------------|
| Chord Length | 10–3,000 mm | Width of the airfoil section |
| Twist Angle | -10° to 45° | Blade twist at that span location |
| Thickness | 8%–50% | Airfoil thickness ratio |
| Airfoil | DU91W2250 / S809 / NACA4412 | Aerodynamic profile selection |

### Operating Conditions

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| Wind Speed | 3–25 m/s | 10 m/s | Freestream wind velocity |
| Tip Speed Ratio (λ) | 3–12 | 7 | Blade tip speed / wind speed |

---

## 📤 Export Formats

| Format | Extension | Contents |
|--------|-----------|----------|
| **CSV** | `.csv` | r/R, chord, twist, thickness, AoA, Cl, Cd, thrust, torque per segment |
| **STL** | `.stl` | Full 3D blade geometry (ASCII STL), ready for 3D printing or CAD import |
| **JSON** | `.json` | Complete design state (blade params + operating conditions), for save/load |
| **OBJ** | `.obj` | 3D Mesh geometry format, universally supported by Blender, Unity, and CAD tools |

---

## ❓ Troubleshooting

### `npm install` fails

```bash
# Clear npm cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### PowerShell script execution error on Windows

If you see `running scripts is disabled on this system`:

```bash
# Option 1: Use cmd instead
cmd /c "npm run dev"

# Option 2: Fix PowerShell policy (run as admin)
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 3D canvas is blank / white

- Make sure your browser supports **WebGL 2.0** — check at https://get.webgl.org/webgl2/
- Try Chrome or Edge (Safari may have issues with some WebGL features)
- Disable browser extensions that might block WebGL

### Slow performance

- Reduce **Blade Segments** to 5–10 (slider in Global Geometry section)
- Close other GPU-intensive tabs
- The power curve computation runs the BEM solver 23 times (once per wind speed) — this is the heaviest operation

### Port 5173 already in use

```bash
# Kill the process using the port
npx kill-port 5173

# Or specify a different port
npm run dev -- --port 3000
```

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Build optimized production bundle to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint on all source files |

---

## 🔬 Technical Notes

### BEM Solver
The Blade Element Momentum solver in `engine/bem.js` implements:
- **Standard BEM iteration** with relaxation factor (0.1) for stability
- **Prandtl tip loss factor** — `F = (2/π) × arccos(e^(-(B/2)(R-r)/(r·sin(φ))))`
- **Glauert correction** — For high induction factors (a > 0.33), uses empirical K-based formula instead of standard momentum theory
- **Convergence** — Max 100 iterations, tolerance 1e-4 on both axial and tangential induction factors
- **Stall detection** — Flags segments where AoA exceeds 14° or drops below -2°

### Airfoil Database
Three airfoil profiles with interpolated Cl/Cd polars:
- **DU 91-W2-250** — 25% thick, designed for root/mid sections (TU Delft)
- **NREL S809** — 21% thick, designed for HAWTs, soft stall characteristics
- **NACA 4412** — 12% thick, classic general-purpose, good for tip sections

### Geometry Generation
- NACA 4-digit thickness distribution with cosine spacing
- Cosine interpolation (smoothStep) for optimized planform
- Configurable mid-span boundary for root→mid and mid→tip transitions
