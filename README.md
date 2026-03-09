# ⚡ Wiring Simulator

An interactive, browser-based electrical wiring simulator designed to help electricians, students, and hobbyists plan, visualize, and validate real-world residential wiring layouts — all without touching a single physical wire.

---

## 🎯 Project Goal

The goal of this project is to provide a **hands-on learning and planning tool** for domestic AC wiring. Instead of relying on abstract diagrams or static textbooks, users can:

- Drag and drop real electrical components onto a canvas
- Connect them with correctly-typed live and neutral wires
- Flip switches and instantly see power flow through the circuit
- Receive immediate diagnostic feedback — including short circuits, overloads, and wiring errors

This simulator is intentionally grounded in real-world Philippine/international residential wiring standards (230V AC), making the output directly applicable to actual installations.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [React 19](https://react.dev/) |
| **Build Tool** | [Vite 7](https://vite.dev/) |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Language** | JavaScript (JSX) |
| **Runtime** | Browser-only, no backend required |

The entire simulation engine runs **purely in the browser** as a deterministic graph traversal algorithm — no server, no external dependencies beyond the packages listed above.

---

## 🗂️ Project Structure

```
wiring-simulator/
├── src/
│   └── App.jsx          # All components, simulation engine, and UI
├── public/
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── package.json
```

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## 🧠 How the Simulation Engine Works

The simulation runs a **Breadth-First Search (BFS) graph traversal** each time the circuit changes:

1. **Graph Construction** — Each wire connection becomes a graph edge between two terminals (`componentId-terminalId`).
2. **Switch Logic** — Switches that are `ON` inject internal edges between their `IN` and `OUT` terminals, completing a path.
3. **Live Trace** — BFS from the `Main Power Source` `L` terminal marks every reachable terminal as **live**.
4. **Neutral Trace** — BFS from the `Main Power Source` `N` terminal marks every reachable terminal as **neutral**.
5. **Appliance Evaluation** — A bulb or fan is considered **powered** when both its `L` and `N` terminals are simultaneously live and neutral.
6. **Safety Checks** — The engine detects:
   - **Short Circuits**: Any terminal that is both live and neutral simultaneously.
   - **Overload / Fire Hazard**: A socket circuit wired with undersized 1.5mm cable instead of the required 2.5mm.

---

## 🔌 Components & Real-World Mapping

Every component in the simulator directly corresponds to a physical real-world part:

| Simulator Component | Real-World Part | Notes |
|---|---|---|
| **Main Power Source** | Distribution board / consumer unit output | 230V AC, provides L + N terminals |
| **Bulb** | Ceiling light / lamp holder | Requires L + N; glows when powered |
| **Ceiling Fan** | Ceiling fan unit | Requires L + N; spins when powered |
| **1 Switch Box** | Single gang switch plate | Interrupts the live wire to a load |
| **1 Socket Box** | Single gang 3-pin socket | Requires correctly-sized 2.5mm wire |
| **2 Switch + 1 Socket** | 2-gang switch + socket combined plate | Common in Philippine residential fit-out |
| **3/4/5 Switch + Socket** | Multi-gang combined plates | For rooms with multiple lighting circuits |

### Wire Types & Real-World Standards

| Wire Label | Color | Real-World Use | Required For |
|---|---|---|---|
| `1.5mm Live` | Red | 1.5mm² TW/THHN stranded — Lighting circuits | Bulbs, fans, switches |
| `2.5mm Live` | Dark Red | 2.5mm² TW/THHN stranded — Power circuits | Sockets, heavy loads |
| `1.5mm Neutral` | Dark Gray | 1.5mm² neutral return — Lighting | Paired with 1.5mm live |
| `2.5mm Neutral` | Black | 2.5mm² neutral return — Power | Paired with 2.5mm live |

> **Why this matters:** In real residential wiring, using 1.5mm cable on a socket circuit that draws high current (e.g., air conditioning, appliances) causes the wire insulation to overheat — a leading cause of electrical fires. The simulator flags this as an **OVERLOAD** warning.

---

## ✅ Safety Rules Enforced

The simulator enforces the following rules, mirroring those found in the **Philippine Electrical Code (PEC)** and general IEC/BS 7671 practice:

1. **Short Circuit Detection** — Live and neutral must never be directly connected. If they are, the simulation halts with a `SHORT_CIRCUIT` error.
2. **Socket Wire Sizing** — Sockets must be wired with 2.5mm cable. Using 1.5mm triggers an `OVERLOAD` warning.
3. **Source Required** — A Main Power Source must be present for any simulation to run.
4. **Switch Interrupts Live** — Switches correctly interrupt only the live conductor, matching standard wiring practice.

---

## 🖱️ Controls & UI Reference

| Action | How |
|---|---|
| **Add component** | Drag from the left palette onto the canvas |
| **Move component** | Select tool → click and drag |
| **Draw wire** | Wire tool → click a terminal → click another terminal |
| **Delete wire/component** | Eraser tool → click the target |
| **Toggle switch** | Click the switch toggle inside a switch box |
| **Pan canvas** | Pan tool, or hold middle mouse button and drag |
| **Zoom** | Scroll wheel, or use the zoom controls (bottom-right) |
| **Draw room area** | Room tool → click and drag to define a room boundary |
| **Run simulation** | Click **Simulate Power** in the top bar |
| **Cancel action** | Press `Escape` |

---

## 📋 Simulation Status Codes

| Status | Meaning |
|---|---|
| `IDLE` | Simulation not running |
| `OK` | Circuit is valid and appliances are powered correctly |
| `SHORT_CIRCUIT` | Live and neutral are directly bridged — dangerous! |
| `OVERLOAD` | A socket is wired with undersized cable — fire hazard |
| `ERROR` | Configuration error (e.g., missing power source) |

---

## 📌 Roadmap / Potential Enhancements

- [ ] Export circuit as PNG or PDF
- [ ] Label rooms with custom names
- [ ] Two-way (intermediate) switch wiring support
- [ ] Earth/ground wire support
- [ ] Circuit breaker components with trip simulation
- [ ] Load calculation (total wattage / amperage per circuit)
- [ ] Save/load circuit layouts (JSON export/import)


Follow me on instagram @heyvaibhavs