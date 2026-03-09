import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Lightbulb, Fan, Zap, TriangleAlert, Info, MousePointer2, Square, Eraser, Play, Square as SquareIcon, PowerOff, Power, Hand, ZoomIn, ZoomOut, Maximize, Wind, Undo2, Redo2, Save, FolderOpen, Trash2, Edit2, X, Check, CircleDot } from 'lucide-react';

// --- CONSTANTS & CONFIGURATIONS ---

const GRID_SIZE = 20;

const WIRE_TYPES = {
  'live_1.5': { color: '#ef4444', label: '1.5mm Live (Lights)', gauge: 1.5, type: 'live' },
  'live_2.5': { color: '#b91c1c', label: '2.5mm Live (Sockets/AC)', gauge: 2.5, type: 'live', strokeWidth: 4 },
  'neutral_1.5': { color: '#1f2937', label: '1.5mm Neutral (Lights)', gauge: 1.5, type: 'neutral' },
  'neutral_2.5': { color: '#000000', label: '2.5mm Neutral (Sockets/AC)', gauge: 2.5, type: 'neutral', strokeWidth: 4 },
};

const COMPONENT_DEF = {
  'source': { name: 'Main Power Source', width: 100, height: 80, color: 'bg-yellow-200 border-yellow-500' },
  'ac': { name: 'Air Conditioner', width: 120, height: 60, color: 'bg-white border-cyan-300' },
  'joint': { name: 'Wire Splice', width: 20, height: 20, color: 'bg-neutral-500 border-neutral-400' },
  'bulb': { name: 'Bulb', width: 60, height: 60, color: 'bg-white border-yellow-300' },
  'fan': { name: 'Ceiling Fan', width: 80, height: 80, color: 'bg-white border-blue-300' },
  'socket_1': { name: '1 Socket Box', width: 80, height: 80, color: 'bg-gray-100 border-gray-400', sockets: 1, switches: 0 },
  'switch_1': { name: '1 Switch Box', width: 60, height: 80, color: 'bg-gray-100 border-gray-400', sockets: 0, switches: 1 },
  'box_2s_1soc': { name: '2 Switch, 1 Socket', width: 140, height: 80, color: 'bg-gray-100 border-gray-400', switches: 2, sockets: 1 },
  'box_3s_1soc': { name: '3 Switch, 1 Socket', width: 180, height: 80, color: 'bg-gray-100 border-gray-400', switches: 3, sockets: 1 },
  'box_4s_1soc': { name: '4 Switch, 1 Socket', width: 220, height: 80, color: 'bg-gray-100 border-gray-400', switches: 4, sockets: 1 },
  'box_5s_1soc': { name: '5 Switch, 1 Socket', width: 260, height: 80, color: 'bg-gray-100 border-gray-400', switches: 5, sockets: 1 },
};

// --- HELPER: GENERATE TERMINALS BASED ON TYPE ---
const generateTerminals = (type, width, height) => {
  let terminals = [];
  const def = COMPONENT_DEF[type];
  
  if (type === 'source') {
    terminals.push({ id: 'L', type: 'L', label: 'L', x: 25, y: height - 15, color: 'bg-red-500' });
    terminals.push({ id: 'N', type: 'N', label: 'N', x: 75, y: height - 15, color: 'bg-gray-800' });
  } else if (type === 'joint') {
    terminals.push({ id: 'center', type: 'joint', label: '', x: 10, y: 10, color: 'bg-transparent border-none opacity-0' });
  } else if (type === 'bulb' || type === 'fan' || type === 'ac') {
    terminals.push({ id: 'L', type: 'in', label: 'L', x: 15, y: 15, color: 'bg-red-200' });
    terminals.push({ id: 'N', type: 'in', label: 'N', x: width - 15, y: 15, color: 'bg-gray-300' });
  } else if (type.startsWith('box_') || type.startsWith('switch_') || type.startsWith('socket_')) {
    const swCount = def.switches;
    const socCount = def.sockets;
    let currentX = 10;
    
    for (let i = 0; i < swCount; i++) {
      const startX = currentX + i * 40;
      terminals.push({ id: `sw${i}_in`, type: 'sw_in', label: 'In', x: startX + 15, y: 15, color: 'bg-red-200' });
      terminals.push({ id: `sw${i}_out`, type: 'sw_out', label: 'Out', x: startX + 15, y: height - 15, color: 'bg-red-300' });
    }
    
    currentX += swCount * 40;
    for (let i = 0; i < socCount; i++) {
      const startX = currentX + i * 60;
      terminals.push({ id: `soc${i}_L`, type: 'soc_L', label: 'L', x: startX + 20, y: height / 2, color: 'bg-red-200' });
      terminals.push({ id: `soc${i}_N`, type: 'soc_N', label: 'N', x: startX + 40, y: height / 2, color: 'bg-gray-300' });
    }
  }
  return terminals;
};

// --- SIMULATION ENGINE ---
const runSimulation = (components, wires) => {
  const simState = {
    status: 'OK',
    messages: [],
    poweredComponents: new Set(),
    liveTerminals: new Set(),
    neutralTerminals: new Set(),
    flowingWires: new Set(),
  };

  const sourceComponent = components.find(c => c.type === 'source');
  if (!sourceComponent) {
    simState.status = 'ERROR';
    simState.messages.push("No Main Power Source found.");
    return simState;
  }

  // 1. Build Graph
  const adj = {};
  wires.forEach(w => {
    if (!adj[w.from]) adj[w.from] = [];
    if (!adj[w.to]) adj[w.to] = [];
    adj[w.from].push({ node: w.to, wire: w });
    adj[w.to].push({ node: w.from, wire: w });
  });

  // 2. Add Internal Switch Connections
  components.forEach(c => {
    if (c.type.includes('switch') || c.type.includes('box')) {
      c.state.switches.forEach((isOn, i) => {
        if (isOn) {
          const inId = `${c.id}-sw${i}_in`;
          const outId = `${c.id}-sw${i}_out`;
          if (!adj[inId]) adj[inId] = [];
          if (!adj[outId]) adj[outId] = [];
          adj[inId].push({ node: outId, internal: true, compId: c.id });
          adj[outId].push({ node: inId, internal: true, compId: c.id });
        }
      });
    }
  });

  // 3. Trace Live
  let liveQueue = [`${sourceComponent.id}-L`];
  while (liveQueue.length > 0) {
    let curr = liveQueue.shift();
    if (!simState.liveTerminals.has(curr)) {
      simState.liveTerminals.add(curr);
      (adj[curr] || []).forEach(edge => {
        if (!simState.liveTerminals.has(edge.node)) {
          liveQueue.push(edge.node);
          if (edge.wire) simState.flowingWires.add(edge.wire.id);
        }
      });
    }
  }

  // 4. Trace Neutral
  let neutralQueue = [`${sourceComponent.id}-N`];
  while (neutralQueue.length > 0) {
    let curr = neutralQueue.shift();
    if (!simState.neutralTerminals.has(curr)) {
      simState.neutralTerminals.add(curr);
      (adj[curr] || []).forEach(edge => {
        if (!simState.neutralTerminals.has(edge.node)) {
          neutralQueue.push(edge.node);
          if (edge.wire) simState.flowingWires.add(edge.wire.id);
        }
      });
    }
  }

  // 5. Detect Shorts
  const shorts = [...simState.liveTerminals].filter(t => simState.neutralTerminals.has(t));
  if (shorts.length > 0) {
    simState.status = 'SHORT_CIRCUIT';
    simState.messages.push("💥 SHORT CIRCUIT! Live and Neutral are directly connected.");
    return simState;
  }

  // 6. Evaluate Appliances & Rules
  components.forEach(c => {
    // Check Bulbs, Fans, and AC
    if (c.type === 'bulb' || c.type === 'fan' || c.type === 'ac') {
      const lId = `${c.id}-L`;
      const nId = `${c.id}-N`;
      if (simState.liveTerminals.has(lId) && simState.neutralTerminals.has(nId)) {
        simState.poweredComponents.add(c.id);

        // Heavy Load check for AC
        if (c.type === 'ac') {
          const connectedWires = wires.filter(w => w.from === lId || w.to === lId || w.from === nId || w.to === nId);
          const hasThinWire = connectedWires.some(w => WIRE_TYPES[w.type].gauge === 1.5);
          if (hasThinWire) {
            simState.status = 'OVERLOAD';
            simState.messages.push(`⚠️ OVERLOAD: Air Conditioner is powered using 1.5mm wire. Fire hazard! Use 2.5mm wire.`);
          }
        }
      }
    }
    
    // Check Sockets & Overload
    if (c.type.includes('socket') || c.type.includes('box')) {
      const def = COMPONENT_DEF[c.type];
      for (let i = 0; i < def.sockets; i++) {
        const lId = `${c.id}-soc${i}_L`;
        const nId = `${c.id}-soc${i}_N`;
        
        if (simState.liveTerminals.has(lId) && simState.neutralTerminals.has(nId)) {
          simState.poweredComponents.add(`${c.id}-soc${i}`);
          
          // Safety Check: Heavy appliances require 2.5mm wire
          const connectedWires = wires.filter(w => w.from === lId || w.to === lId || w.from === nId || w.to === nId);
          const hasThinWire = connectedWires.some(w => WIRE_TYPES[w.type].gauge === 1.5);
          
          if (hasThinWire) {
            simState.status = 'OVERLOAD';
            simState.messages.push(`⚠️ OVERLOAD: Socket in ${def.name} is powered using 1.5mm wire. Fire hazard! Use 2.5mm wire.`);
          }
        }
      }
    }
  });

  if (simState.status === 'OK' && simState.poweredComponents.size > 0) {
    simState.messages.push("✅ System running normally. Appliances powered.");
  } else if (simState.status === 'OK') {
    simState.messages.push("ℹ️ Power is ON, but no appliances are currently running.");
  }

  return simState;
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [components, setComponents] = useState([
    { id: 'source-1', type: 'source', x: 50, y: 50, state: { switches: [] } }
  ]);
  const [wires, setWires] = useState([]);
  const [rooms, setRooms] = useState([]);
  
  // History Management for Undo/Redo
  const [history, setHistory] = useState({ past: [], future: [] });

  // Tool & Draw State
  const [tool, setTool] = useState('select');
  const [selectedWireType, setSelectedWireType] = useState('live_1.5');
  const [wireStart, setWireStart] = useState(null);
  const [currentWaypoints, setCurrentWaypoints] = useState([]); 
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); 
  const [draggedItem, setDraggedItem] = useState(null);
  const [roomDrawStart, setRoomDrawStart] = useState(null);
  
  // Storage State
  const [savedProjects, setSavedProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [isAutoSave, setIsAutoSave] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [deletingProjectId, setDeletingProjectId] = useState(null);

  // Transform State for Zoom/Pan
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Simulation State
  const [simulationActive, setSimulationActive] = useState(false);
  const [simResult, setSimResult] = useState({ status: 'IDLE', messages: [], poweredComponents: new Set(), liveTerminals: new Set(), neutralTerminals: new Set(), flowingWires: new Set() });

  const canvasRef = useRef(null);

  // --- HISTORY & SNAPSHOT SYSTEM ---
  const takeSnapshot = useCallback(() => {
    setHistory(prev => {
      const currentStateStr = JSON.stringify({ components, wires, rooms });
      const lastStateStr = prev.past.length > 0 ? JSON.stringify(prev.past[prev.past.length - 1]) : null;
      if (currentStateStr === lastStateStr) return prev; // Prevent redundant snapshots
      
      const newPast = [...prev.past, { components, wires, rooms }].slice(-50); // Keep last 50 actions
      return { past: newPast, future: [] };
    });
  }, [components, wires, rooms]);

  const handleUndo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, -1);
      
      setComponents(previous.components);
      setWires(previous.wires);
      setRooms(previous.rooms);

      return { past: newPast, future: [{ components, wires, rooms }, ...prev.future] };
    });
  }, [components, wires, rooms]);

  const handleRedo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);
      
      setComponents(next.components);
      setWires(next.wires);
      setRooms(next.rooms);

      return { past: [...prev.past, { components, wires, rooms }], future: newFuture };
    });
  }, [components, wires, rooms]);

  // Load Projects on Mount
  useEffect(() => {
    const stored = localStorage.getItem('wiringSimulatorProjects');
    if (stored) setSavedProjects(JSON.parse(stored));
  }, []);

  const updateCurrentProject = useCallback(() => {
    if (!currentProjectId) return;
    setSavedProjects(prev => {
      const updated = prev.map(p => 
        p.id === currentProjectId 
          ? { ...p, data: { components, wires, rooms }, updatedAt: new Date().toLocaleString() } 
          : p
      );
      localStorage.setItem('wiringSimulatorProjects', JSON.stringify(updated));
      return updated;
    });
  }, [currentProjectId, components, wires, rooms]);

  // Auto Save Effect
  useEffect(() => {
    if (isAutoSave && currentProjectId) {
      const timeout = setTimeout(() => {
        updateCurrentProject();
      }, 1000); // 1s debounce
      return () => clearTimeout(timeout);
    }
  }, [components, wires, rooms, isAutoSave, currentProjectId, updateCurrentProject]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setWireStart(null);
        setCurrentWaypoints([]);
        setDraggedItem(null);
        setRoomDrawStart(null);
        setIsPanning(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Re-run simulation when state changes
  useEffect(() => {
    if (simulationActive) {
      setSimResult(runSimulation(components, wires));
    } else {
      setSimResult({ status: 'IDLE', messages: [], poweredComponents: new Set(), liveTerminals: new Set(), neutralTerminals: new Set(), flowingWires: new Set() });
    }
  }, [simulationActive, components, wires]);

  // --- STORAGE HANDLERS ---
  const saveCurrentProject = () => {
    if (!newProjectName.trim()) return;
    const newProject = {
      id: `proj-${Date.now()}`,
      name: newProjectName.trim(),
      data: { components, wires, rooms },
      updatedAt: new Date().toLocaleString()
    };
    const updated = [...savedProjects, newProject];
    setSavedProjects(updated);
    localStorage.setItem('wiringSimulatorProjects', JSON.stringify(updated));
    setCurrentProjectId(newProject.id);
    setNewProjectName("");
  };

  const loadProject = (proj) => {
    takeSnapshot();
    setComponents(proj.data.components || []);
    setWires(proj.data.wires || []);
    setRooms(proj.data.rooms || []);
    setCurrentProjectId(proj.id);
    setIsStorageModalOpen(false);
  };

  const deleteProject = (id) => {
    const updated = savedProjects.filter(p => p.id !== id);
    setSavedProjects(updated);
    localStorage.setItem('wiringSimulatorProjects', JSON.stringify(updated));
    setDeletingProjectId(null);
    if (currentProjectId === id) setCurrentProjectId(null);
  };

  const saveRename = (id) => {
    if (!editProjectName.trim()) { setEditingProjectId(null); return; }
    const updated = savedProjects.map(p => p.id === id ? { ...p, name: editProjectName } : p);
    setSavedProjects(updated);
    localStorage.setItem('wiringSimulatorProjects', JSON.stringify(updated));
    setEditingProjectId(null);
  };

  // --- CANVAS HELPERS ---
  const getCanvasCoords = (clientX, clientY) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - transform.x) / transform.scale;
    const y = (clientY - rect.top - transform.y) / transform.scale;
    return { x, y };
  };

  const handleDragStart = (e, type) => e.dataTransfer.setData('type', type);

  const handleDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (type) {
      takeSnapshot();
      const coords = getCanvasCoords(e.clientX, e.clientY);
      const x = Math.round(coords.x / GRID_SIZE) * GRID_SIZE;
      const y = Math.round(coords.y / GRID_SIZE) * GRID_SIZE;
      
      const def = COMPONENT_DEF[type];
      setComponents([...components, { 
        id: `${type}-${Date.now()}`, 
        type, x, y, 
        state: { switches: new Array(def.switches || 0).fill(false) } 
      }]);
    }
  };

  const handleWheel = (e) => {
    if (!canvasRef.current) return;
    const scaleAdjust = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newScale = Math.min(Math.max(0.1, transform.scale * scaleAdjust), 5); 
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvasX = (mouseX - transform.x) / transform.scale;
    const canvasY = (mouseY - transform.y) / transform.scale;

    const newX = mouseX - canvasX * newScale;
    const newY = mouseY - canvasY * newScale;

    setTransform({ x: newX, y: newY, scale: newScale });
  };

  const handleCanvasMouseDown = (e) => {
    if (e.button === 1 || tool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      return;
    }
    if (tool === 'wire' && wireStart) {
      setCurrentWaypoints(prev => [...prev, getCanvasCoords(e.clientX, e.clientY)]);
    }
    if (tool === 'room') {
      takeSnapshot(); // Snapshot before room draw starts
      setRoomDrawStart(getCanvasCoords(e.clientX, e.clientY));
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (isPanning) {
      setTransform(prev => ({ ...prev, x: e.clientX - panStart.x, y: e.clientY - panStart.y }));
      return;
    }

    const coords = getCanvasCoords(e.clientX, e.clientY);
    setMousePos(coords);

    if (draggedItem) {
      const snappedX = Math.round((coords.x - draggedItem.offsetX) / GRID_SIZE) * GRID_SIZE;
      const snappedY = Math.round((coords.y - draggedItem.offsetY) / GRID_SIZE) * GRID_SIZE;
      setComponents(comps => comps.map(c => c.id === draggedItem.id ? { ...c, x: snappedX, y: snappedY } : c));
    }
  };

  const handleCanvasMouseUp = () => {
    if (isPanning) setIsPanning(false);
    setDraggedItem(null);
    if (tool === 'room' && roomDrawStart) {
      const w = Math.abs(mousePos.x - roomDrawStart.x);
      const h = Math.abs(mousePos.y - roomDrawStart.y);
      if (w > 10 && h > 10) {
        setRooms([...rooms, { 
          id: `room-${Date.now()}`, 
          x: Math.min(roomDrawStart.x, mousePos.x), 
          y: Math.min(roomDrawStart.y, mousePos.y), w, h
        }]);
      }
      setRoomDrawStart(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setIsPanning(false);
    setDraggedItem(null);
    setRoomDrawStart(null);
  };

  const handleComponentMouseDown = (e, comp) => {
    if (tool === 'select') {
      e.stopPropagation();
      takeSnapshot(); // Snapshot before drag begins
      const coords = getCanvasCoords(e.clientX, e.clientY);
      setDraggedItem({ id: comp.id, offsetX: coords.x - comp.x, offsetY: coords.y - comp.y });
    } else if (tool === 'eraser') {
      e.stopPropagation();
      if (comp.type !== 'source') {
        takeSnapshot();
        setComponents(components.filter(c => c.id !== comp.id));
        setWires(wires.filter(w => !w.from.startsWith(comp.id) && !w.to.startsWith(comp.id)));
      }
    }
  };

  const completeWire = (fromTermId, toTermId) => {
    if (fromTermId === toTermId) return;
    const exists = wires.some(w => (w.from === fromTermId && w.to === toTermId) || (w.to === fromTermId && w.from === toTermId));
    if (!exists) {
      takeSnapshot();
      setWires(prev => [...prev, { id: `wire-${Date.now()}`, from: fromTermId, to: toTermId, type: selectedWireType, waypoints: currentWaypoints }]);
    }
    setWireStart(null);
    setCurrentWaypoints([]);
  };

  const handleTerminalMouseDown = (e, compId, terminal) => {
    e.stopPropagation();
    const fullTermId = `${compId}-${terminal.id}`;
    if (tool === 'wire') {
      if (!wireStart) {
        setWireStart(fullTermId);
        setCurrentWaypoints([]);
      } else {
        completeWire(wireStart, fullTermId);
      }
    }
  };

  const handleTerminalMouseUp = (e, compId, terminal) => {
    e.stopPropagation();
    const fullTermId = `${compId}-${terminal.id}`;
    if (tool === 'wire' && wireStart && wireStart !== fullTermId) {
      completeWire(wireStart, fullTermId);
    }
  };

  const toggleSwitch = (compId, index) => {
    takeSnapshot();
    setComponents(comps => comps.map(c => {
      if (c.id === compId) {
        const newSwitches = [...c.state.switches];
        newSwitches[index] = !newSwitches[index];
        return { ...c, state: { ...c.state, switches: newSwitches } };
      }
      return c;
    }));
  };

  const handleWireClick = (e, wireId) => {
    e.stopPropagation();
    if (tool === 'eraser') {
      takeSnapshot();
      setWires(wires.filter(w => w.id !== wireId));
    } else if (tool === 'wire') {
      takeSnapshot();
      const wire = wires.find(w => w.id === wireId);
      if (!wire) return;
      
      const coords = getCanvasCoords(e.clientX, e.clientY);

      // Find the closest wire segment to project the splice onto perfectly
      const startCoords = getTerminalCoords(wire.from);
      const endCoords = getTerminalCoords(wire.to);
      const pts = [startCoords, ...(wire.waypoints || []), endCoords];

      let minDist = Infinity;
      let splitIndex = 0;
      let projX = coords.x;
      let projY = coords.y;

      for (let i = 0; i < pts.length - 1; i++) {
        const v = pts[i];
        const w = pts[i+1];
        const l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
        let t = 0;
        if (l2 !== 0) {
          t = ((coords.x - v.x) * (w.x - v.x) + (coords.y - v.y) * (w.y - v.y)) / l2;
          t = Math.max(0, Math.min(1, t));
        }
        const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
        const d = (coords.x - proj.x)**2 + (coords.y - proj.y)**2;
        if (d < minDist) {
          minDist = d;
          splitIndex = i;
          projX = proj.x;
          projY = proj.y;
        }
      }
      
      const jointId = `joint-${Date.now()}`;
      // Do not snap splice joint to grid to ensure it sits exactly on the custom drawn path
      const newJoint = { id: jointId, type: 'joint', x: projX - 10, y: projY - 10, state: { switches: [] } };
      
      // Preserve existing path correctly
      const waypoints1 = wire.waypoints ? wire.waypoints.slice(0, splitIndex) : [];
      const waypoints2 = wire.waypoints ? wire.waypoints.slice(splitIndex) : [];

      const wire1 = { id: `wire-${Date.now()}-1`, from: wire.from, to: `${jointId}-center`, type: wire.type, waypoints: waypoints1 };
      const wire2 = { id: `wire-${Date.now()}-2`, from: `${jointId}-center`, to: wire.to, type: wire.type, waypoints: waypoints2 };
      
      setComponents(prev => [...prev, newJoint]);
      setWires(prev => [...prev.filter(w => w.id !== wireId), wire1, wire2]);
      
      setSelectedWireType(wire.type);
      setWireStart(`${jointId}-center`);
      setCurrentWaypoints([]);
    }
  };

  const getTerminalCoords = (fullTermId) => {
    if (!fullTermId) return { x: 0, y: 0 };
    const lastDashIndex = fullTermId.lastIndexOf('-');
    const compId = fullTermId.substring(0, lastDashIndex);
    const termId = fullTermId.substring(lastDashIndex + 1);
    
    const comp = components.find(c => c.id === compId);
    if (!comp) return { x: 0, y: 0 };
    const terminals = generateTerminals(comp.type, COMPONENT_DEF[comp.type].width, COMPONENT_DEF[comp.type].height);
    const term = terminals.find(t => t.id === termId);
    if (!term) return { x: comp.x, y: comp.y };
    return { x: comp.x + term.x, y: comp.y + term.y };
  };

  const renderWirePath = (start, waypoints = [], end) => {
    if (!start || !end) return '';
    let path = `M ${start.x} ${start.y}`;
    waypoints.forEach(wp => path += ` L ${wp.x} ${wp.y}`);
    path += ` L ${end.x} ${end.y}`;
    return path;
  };

  return (
    <div className="flex h-screen bg-neutral-900 text-white font-sans overflow-hidden select-none">
      
      {/* STORAGE MODAL OVERLAY */}
      {isStorageModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-in fade-in" onClick={() => setIsStorageModalOpen(false)}>
          <div className="bg-neutral-800 border border-neutral-700 w-[500px] rounded-xl shadow-2xl p-6 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><FolderOpen className="text-blue-400" /> Saved Projects</h2>
              <button onClick={() => setIsStorageModalOpen(false)} className="text-neutral-400 hover:text-white transition-colors"><X size={20}/></button>
            </div>

            <div className="flex gap-2 mb-6 bg-neutral-900 p-3 rounded-lg border border-neutral-700">
              <input
                type="text"
                placeholder="Name current project..."
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                className="flex-1 bg-neutral-800 text-white border border-neutral-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && saveCurrentProject()}
              />
              <button onClick={saveCurrentProject} disabled={!newProjectName.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-2 transition-colors">
                <Save size={16} /> Save
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {savedProjects.length === 0 ? (
                <div className="text-neutral-500 text-center py-8 text-sm italic">No saved projects yet.</div>
              ) : (
                savedProjects.map(proj => (
                  <div key={proj.id} className="bg-neutral-700/50 border border-neutral-600 rounded-lg p-3 flex items-center justify-between group hover:bg-neutral-700 transition-colors">
                     {editingProjectId === proj.id ? (
                       <div className="flex items-center gap-2 flex-1 mr-4">
                         <input autoFocus type="text" value={editProjectName} onChange={e => setEditProjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveRename(proj.id)} className="flex-1 bg-neutral-900 text-white border border-blue-500 rounded px-2 py-1 text-sm focus:outline-none" />
                         <button onClick={() => saveRename(proj.id)} className="text-green-400 hover:text-green-300 p-1"><Check size={16}/></button>
                         <button onClick={() => setEditingProjectId(null)} className="text-red-400 hover:text-red-300 p-1"><X size={16}/></button>
                       </div>
                     ) : (
                       <div className="flex-1 min-w-0">
                         <div className="font-bold truncate text-sm text-neutral-200">{proj.name}</div>
                         <div className="text-[10px] text-neutral-400">{proj.updatedAt}</div>
                       </div>
                     )}

                     {editingProjectId !== proj.id && (
                       <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                         {deletingProjectId === proj.id ? (
                           <div className="flex items-center gap-2 mr-2">
                             <span className="text-xs text-red-400 font-bold">Delete?</span>
                             <button onClick={() => deleteProject(proj.id)} className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-xs transition-colors">Yes</button>
                             <button onClick={() => setDeletingProjectId(null)} className="bg-neutral-600 hover:bg-neutral-500 text-white px-2 py-0.5 rounded text-xs transition-colors">No</button>
                           </div>
                         ) : (
                           <>
                             <button onClick={() => loadProject(proj)} title="Load Project" className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded transition-colors"><FolderOpen size={14} /></button>
                             <button onClick={() => { setEditingProjectId(proj.id); setEditProjectName(proj.name); setDeletingProjectId(null); }} title="Rename" className="p-1.5 bg-neutral-600/50 text-neutral-300 hover:bg-neutral-500 hover:text-white rounded transition-colors"><Edit2 size={14} /></button>
                             <button onClick={() => setDeletingProjectId(proj.id)} title="Delete" className="p-1.5 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded transition-colors"><Trash2 size={14} /></button>
                           </>
                         )}
                       </div>
                     )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR - PALETTE */}
      <div className="w-72 bg-neutral-800 border-r border-neutral-700 flex flex-col z-20 shadow-xl">
        <div className="p-4 border-b border-neutral-700 bg-neutral-900 flex items-center gap-2">
          <Zap className="text-yellow-400" />
          <h1 className="text-lg font-bold">Wiring Simulator</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          
          <div>
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Tools</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTool('select')} className={`p-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${tool === 'select' ? 'bg-blue-600 text-white' : 'bg-neutral-700 hover:bg-neutral-600'}`}>
                <MousePointer2 size={18} /> <span className="text-[10px]">Select</span>
              </button>
              <button onClick={() => setTool('pan')} className={`p-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${tool === 'pan' ? 'bg-blue-600 text-white' : 'bg-neutral-700 hover:bg-neutral-600'}`}>
                <Hand size={18} /> <span className="text-[10px]">Pan Canvas</span>
              </button>
              <button onClick={() => setTool('wire')} className={`p-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${tool === 'wire' ? 'bg-blue-600 text-white' : 'bg-neutral-700 hover:bg-neutral-600'}`}>
                <Zap size={18} /> <span className="text-[10px]">Draw Wire</span>
              </button>
              <button onClick={() => setTool('room')} className={`p-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${tool === 'room' ? 'bg-blue-600 text-white' : 'bg-neutral-700 hover:bg-neutral-600'}`}>
                <Square size={18} /> <span className="text-[10px]">Draw Room</span>
              </button>
              <button onClick={() => setTool('eraser')} className={`p-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${tool === 'eraser' ? 'bg-red-600 text-white' : 'bg-neutral-700 hover:bg-neutral-600'}`}>
                <Eraser size={18} /> <span className="text-[10px]">Eraser</span>
              </button>
            </div>
          </div>

          {tool === 'wire' && (
            <div className="bg-neutral-900 p-3 rounded-lg border border-neutral-700 animate-in fade-in slide-in-from-top-2">
              <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Wire Type</h2>
              <div className="space-y-2">
                {Object.entries(WIRE_TYPES).map(([key, w]) => (
                  <button key={key} onClick={() => setSelectedWireType(key)} 
                    className={`w-full text-left p-2 rounded text-xs flex items-center gap-2 transition-colors ${selectedWireType === key ? 'bg-blue-900/50 border border-blue-500' : 'bg-neutral-800 border border-transparent hover:bg-neutral-700'}`}>
                    <div className="w-4 h-4 rounded-full border border-gray-500" style={{ backgroundColor: w.color }}></div>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Components (Drag & Drop)</h2>
            <div className="space-y-2">
              {Object.entries(COMPONENT_DEF).filter(([k]) => k !== 'source').map(([key, def]) => (
                <div 
                  key={key} 
                  draggable 
                  onDragStart={(e) => handleDragStart(e, key)}
                  className="bg-neutral-700 p-3 rounded cursor-grab hover:bg-neutral-600 transition-colors flex items-center gap-3 border border-neutral-600"
                >
                  {key === 'bulb' && <Lightbulb size={20} className="text-yellow-200" />}
                  {key === 'fan' && <Fan size={20} className="text-blue-200" />}
                  {key === 'ac' && <Wind size={20} className="text-cyan-300" />}
                  {key === 'joint' && <CircleDot size={20} className="text-neutral-400" />}
                  {key.includes('box') || key.includes('socket') || key.includes('switch') ? <SquareIcon size={20} className="text-gray-400" /> : null}
                  <span className="text-sm">{def.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CANVAS AREA */}
      <div className="flex-1 flex flex-col relative bg-slate-200">
        
        {/* TOP BAR - SIMULATION CONTROLS */}
        <div className="h-14 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-6 z-20 shadow-md">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSimulationActive(!simulationActive)}
              className={`flex items-center gap-2 px-4 py-2 rounded font-bold transition-all shadow-lg ${simulationActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
            >
              {simulationActive ? <><PowerOff size={18} /> Stop Sim</> : <><Play size={18} /> Simulate Power</>}
            </button>
            
            {simulationActive && (
              <div className={`px-4 py-1.5 rounded flex items-center gap-2 text-sm font-bold border ${simResult.status === 'OK' ? 'bg-green-900/50 border-green-500 text-green-400' : simResult.status === 'SHORT_CIRCUIT' ? 'bg-red-900/50 border-red-500 text-red-400' : 'bg-orange-900/50 border-orange-500 text-orange-400'}`}>
                {simResult.status === 'OK' ? <Zap size={16} /> : <TriangleAlert size={16} />}
                {simResult.status}
              </div>
            )}
            
            {!simulationActive && (
              <div className="flex items-center gap-2 border-l border-neutral-700 pl-4 ml-2">
                <button onClick={handleUndo} disabled={history.past.length === 0} className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors rounded hover:bg-neutral-700" title="Undo (Ctrl+Z)"><Undo2 size={18} /></button>
                <button onClick={handleRedo} disabled={history.future.length === 0} className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors rounded hover:bg-neutral-700" title="Redo (Ctrl+Y)"><Redo2 size={18} /></button>
              </div>
            )}
            
            {currentProjectId && !simulationActive && (
              <div className="flex items-center gap-3 border-l border-neutral-700 pl-4 ml-2 animate-in fade-in">
                <span className="text-xs font-bold text-neutral-400 truncate max-w-[120px]" title={savedProjects.find(p => p.id === currentProjectId)?.name}>
                  {savedProjects.find(p => p.id === currentProjectId)?.name}
                </span>
                <button onClick={updateCurrentProject} className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 p-1.5 rounded transition-colors" title="Save / Update Project">
                  <Save size={16} />
                </button>
                <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer hover:text-white" title="Automatically save changes">
                  <input type="checkbox" checked={isAutoSave} onChange={e => setIsAutoSave(e.target.checked)} className="rounded cursor-pointer accent-blue-500 w-3.5 h-3.5" />
                  Auto-save
                </label>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-neutral-400 hidden lg:flex items-center gap-2">
              <Info size={16} /> Tip: Click on a wire with the Wire Tool to splice it.
            </div>
            <button onClick={() => setIsStorageModalOpen(true)} className="flex items-center gap-2 text-sm font-bold text-neutral-300 hover:text-white bg-neutral-700/50 border border-neutral-600 hover:bg-neutral-600 px-4 py-1.5 rounded transition-colors shadow-sm">
              <FolderOpen size={16} /> Projects
            </button>
          </div>
        </div>

        {/* CANVAS BOUNDARY */}
        <div 
          ref={canvasRef}
          className="flex-1 relative overflow-hidden"
          style={{ 
            backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)', 
            backgroundSize: `${GRID_SIZE * transform.scale}px ${GRID_SIZE * transform.scale}px`,
            backgroundPosition: `${transform.x}px ${transform.y}px`,
            cursor: isPanning ? 'grabbing' : tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : tool === 'wire' ? 'crosshair' : tool === 'eraser' ? 'cell' : 'crosshair'
          }}
          onWheel={handleWheel}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseDown={handleCanvasMouseDown}
          onMouseLeave={handleCanvasMouseLeave}
        >
          {/* ZOOM/PAN SCALED WRAPPER */}
          <div className="absolute inset-0" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0' }}>
            
            {/* ROOMS */}
            {rooms.map(r => (
              <div key={r.id} className="absolute border-4 border-slate-400 bg-slate-300/30 pointer-events-none rounded" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
                <span className="absolute -top-6 text-slate-600 font-bold text-sm">Room Area</span>
              </div>
            ))}
            {tool === 'room' && roomDrawStart && (
              <div className="absolute border-4 border-blue-500 border-dashed bg-blue-500/10 pointer-events-none" style={{ 
                left: Math.min(roomDrawStart.x, mousePos.x), top: Math.min(roomDrawStart.y, mousePos.y), 
                width: Math.abs(mousePos.x - roomDrawStart.x), height: Math.abs(mousePos.y - roomDrawStart.y) 
              }} />
            )}

            {/* WIRES LAYER */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
              {wires.map(w => {
                const start = getTerminalCoords(w.from);
                const end = getTerminalCoords(w.to);
                const wireDef = WIRE_TYPES[w.type];
                const isFlowing = simulationActive && simResult.flowingWires.has(w.id);
                const isShorted = simulationActive && simResult.status === 'SHORT_CIRCUIT';
                
                return (
                  <g key={w.id} onClick={(e) => handleWireClick(e, w.id)} style={{ pointerEvents: (tool === 'eraser' || tool === 'wire') ? 'stroke' : 'none' }} className={(tool === 'eraser' || tool === 'wire') ? 'cursor-pointer hover:opacity-50' : ''}>
                    <path d={renderWirePath(start, w.waypoints, end)} fill="none" stroke="transparent" strokeWidth="20" strokeLinejoin="round" strokeLinecap="round" />
                    <path 
                      d={renderWirePath(start, w.waypoints, end)} 
                      fill="none" 
                      stroke={isShorted ? '#ef4444' : wireDef.color} 
                      strokeWidth={wireDef.strokeWidth || 2} 
                      strokeDasharray={isFlowing ? "10,5" : "none"}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      className={isFlowing && !isShorted ? "animate-[dash_1s_linear_infinite]" : ""}
                      style={{ filter: isFlowing && !isShorted ? `drop-shadow(0 0 5px ${wireDef.color})` : 'none' }}
                    />
                  </g>
                )
              })}
              
              {tool === 'wire' && wireStart && (
                <path 
                  d={renderWirePath(getTerminalCoords(wireStart), currentWaypoints, mousePos)} 
                  fill="none" stroke={WIRE_TYPES[selectedWireType].color} strokeWidth={WIRE_TYPES[selectedWireType].strokeWidth || 2} strokeDasharray="5,5" opacity="0.7"
                  strokeLinejoin="round" strokeLinecap="round"
                />
              )}
            </svg>

            {/* COMPONENTS LAYER */}
            {components.map(comp => {
              const def = COMPONENT_DEF[comp.type];
              const terminals = generateTerminals(comp.type, def.width, def.height);
              const isPowered = simulationActive && simResult.poweredComponents.has(comp.id);
              const isHoveredDelete = tool === 'eraser' && comp.type !== 'source';

              return (
                <div 
                  key={comp.id}
                  onMouseDown={(e) => handleComponentMouseDown(e, comp)}
                  className={`absolute ${comp.type === 'joint' ? 'rounded-full' : 'rounded-lg'} border-2 shadow-lg flex flex-col items-center justify-center transition-all z-20 ${def.color} ${isHoveredDelete ? 'opacity-50 border-red-500 cursor-cell' : tool === 'select' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  style={{ 
                    left: comp.x, top: comp.y, width: def.width, height: def.height,
                    boxShadow: isPowered && comp.type !== 'bulb' && comp.type !== 'joint' ? `0 0 20px 5px rgba(74, 222, 128, 0.4)` : 'none',
                    borderColor: isPowered && comp.type !== 'bulb' && comp.type !== 'joint' ? '#4ade80' : ''
                  }}
                >
                  {comp.type !== 'joint' && <span className="text-[10px] font-bold absolute -top-5 text-neutral-400 bg-neutral-900 px-1 rounded whitespace-nowrap">{def.name}</span>}
                  
                  {/* Visual rendering of component internals */}
                  {comp.type === 'source' && (
                    <div className="flex flex-col items-center">
                      <Power size={32} className="text-yellow-600 mb-1" />
                      <span className="text-black font-black text-xs">230V AC MAIN</span>
                    </div>
                  )}
                  {comp.type === 'bulb' && (
                    <div className={`transition-all duration-300 ${isPowered ? 'scale-110' : ''}`} style={{ filter: isPowered ? 'drop-shadow(0 0 15px rgba(250, 204, 21, 1)) drop-shadow(0 0 35px rgba(250, 204, 21, 0.8))' : 'none' }}>
                      <Lightbulb size={32} className={`transition-colors duration-300 ${isPowered ? 'text-yellow-400 fill-yellow-200' : 'text-gray-300'}`} />
                    </div>
                  )}
                  {comp.type === 'fan' && (
                    <Fan size={32} className={`transition-all duration-500 ${isPowered ? 'text-blue-500 animate-spin' : 'text-gray-300'}`} />
                  )}
                  {comp.type === 'ac' && (
                    <div className="flex flex-col items-center justify-center">
                      <Wind size={24} className={`transition-all duration-500 ${isPowered ? 'text-cyan-500 animate-pulse' : 'text-gray-300'}`} />
                      <span className={`text-[9px] font-bold mt-1 ${isPowered ? 'text-cyan-600' : 'text-gray-400'}`}>2.0 TON AC</span>
                    </div>
                  )}
                  {comp.type === 'joint' && (
                    <CircleDot size={12} className="text-neutral-200" />
                  )}

                  {/* Draw Switches and Sockets within Boxes */}
                  {(comp.type.includes('box') || comp.type.includes('switch') || comp.type.includes('socket')) && (
                    <div className="flex w-full h-full items-center justify-center px-2 gap-1">
                      {Array.from({ length: def.switches }).map((_, i) => (
                        <div key={`sw-${i}`} className="flex flex-col items-center justify-center flex-1 h-full relative border-r border-gray-300 last:border-0">
                          <button 
                            onMouseDown={(e) => e.stopPropagation()} 
                            onClick={() => toggleSwitch(comp.id, i)}
                            className={`w-6 h-10 rounded border border-gray-400 shadow-inner flex items-center justify-center transition-colors ${comp.state.switches[i] ? 'bg-green-100' : 'bg-gray-200'}`}
                          >
                            <div className={`w-4 h-4 rounded-full shadow ${comp.state.switches[i] ? 'bg-green-500 translate-y-2' : 'bg-red-500 -translate-y-2'} transition-transform duration-200`}></div>
                          </button>
                        </div>
                      ))}
                      {Array.from({ length: def.sockets }).map((_, i) => {
                         const socId = `${comp.id}-soc${i}`;
                         const socPowered = simulationActive && simResult.poweredComponents.has(socId);
                         const socOverloaded = simulationActive && simResult.status === 'OVERLOAD' && simResult.messages.some(m => m.includes(def.name));
                         return (
                          <div key={`soc-${i}`} className="flex flex-col items-center justify-center flex-1 h-full relative">
                            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-inner relative bg-white ${socOverloaded ? 'border-red-500' : socPowered ? 'border-green-400' : 'border-gray-400'}`}>
                              <div className="w-2 h-2 rounded-full bg-gray-800 absolute top-2 left-2"></div>
                              <div className="w-2 h-2 rounded-full bg-gray-800 absolute top-2 right-2"></div>
                              <div className="w-2 h-2 rounded-full bg-gray-800 absolute bottom-2 left-4"></div>
                              {socOverloaded && <TriangleAlert size={20} className="absolute -top-6 text-red-500 bg-white rounded-full" />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* TERMINALS */}
                  {terminals.map(term => {
                    const fullTermId = `${comp.id}-${term.id}`;
                    const isDrawingStart = wireStart === fullTermId;
                    const isConnected = wires.some(w => w.from === fullTermId || w.to === fullTermId);
                    const isLive = simulationActive && simResult.liveTerminals.has(fullTermId);
                    const isNeutral = simulationActive && simResult.neutralTerminals.has(fullTermId);
                    
                    let glowClass = '';
                    if (isLive && isNeutral) glowClass = 'shadow-[0_0_10px_red] bg-red-600 animate-pulse border-red-200'; 
                    else if (isLive) glowClass = 'shadow-[0_0_5px_red] bg-red-500 border-red-200';
                    else if (isNeutral) glowClass = 'shadow-[0_0_5px_gray] bg-gray-800 border-gray-400';
                    else if (isConnected) glowClass = 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white border-white opacity-100 shadow-sm';
                    else glowClass = 'border-neutral-800 opacity-80';

                    return (
                      <div 
                        key={term.id}
                        title={`${term.label} Terminal`}
                        onMouseDown={(e) => handleTerminalMouseDown(e, comp.id, term)}
                        onMouseUp={(e) => handleTerminalMouseUp(e, comp.id, term)}
                        className={`absolute w-5 h-5 rounded-full border flex items-center justify-center transition-all z-20 ${term.color} ${glowClass} hover:scale-125 ${tool === 'wire' ? 'cursor-crosshair' : ''} ${isDrawingStart ? 'ring-4 ring-blue-400 ring-opacity-50 scale-125' : ''}`}
                        style={{ left: term.x - 10, top: term.y - 10 }}
                      >
                        {isConnected && !simulationActive && <div className="absolute w-2 h-2 rounded-full bg-blue-500 pointer-events-none"></div>}
                        <span className={`text-[8px] font-bold pointer-events-none ${isConnected && !simulationActive ? 'opacity-0' : 'text-black opacity-60'}`}>{term.label}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* ZOOM OVERLAY CONTROLS */}
          <div className="absolute bottom-6 right-6 flex items-center gap-1 bg-neutral-800 p-1.5 rounded-lg border border-neutral-700 shadow-lg z-30">
            <button title="Zoom Out" onClick={() => setTransform(prev => ({...prev, scale: Math.max(prev.scale / 1.2, 0.1)}))} className="p-1.5 hover:bg-neutral-700 rounded transition-colors"><ZoomOut size={16} /></button>
            <span className="text-xs font-mono font-bold text-neutral-400 w-12 text-center">{Math.round(transform.scale * 100)}%</span>
            <button title="Zoom In" onClick={() => setTransform(prev => ({...prev, scale: Math.min(prev.scale * 1.2, 5)}))} className="p-1.5 hover:bg-neutral-700 rounded transition-colors"><ZoomIn size={16} /></button>
            <div className="w-px h-4 bg-neutral-600 mx-1"></div>
            <button title="Reset View" onClick={() => setTransform({x: 0, y: 0, scale: 1})} className="p-1.5 hover:bg-neutral-700 rounded transition-colors"><Maximize size={16} /></button>
          </div>
        </div>

        {/* BOTTOM PANEL - SIMULATION LOGS */}
        {simulationActive && (
          <div className="h-48 bg-neutral-900 border-t border-neutral-700 p-4 overflow-y-auto font-mono text-sm shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-20">
            <h3 className="text-neutral-400 mb-2 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
              <Zap size={14} /> Diagnostic Logs
            </h3>
            {simResult.messages.length === 0 ? (
              <p className="text-neutral-500 italic">No activity...</p>
            ) : (
              <ul className="space-y-1">
                {simResult.messages.map((msg, idx) => (
                  <li key={idx} className={`${msg.includes('✅') ? 'text-green-400' : msg.includes('💥') || msg.includes('⚠️') || msg.includes('No Main') ? 'text-red-400 font-bold' : 'text-blue-300'}`}>
                    {msg}
                  </li>
                ))}
              </ul>
            )}
            
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs border-t border-neutral-800 pt-4">
               <div>
                 <span className="text-neutral-500">Live Terminals:</span> <span className="text-red-400">{simResult.liveTerminals.size}</span>
               </div>
               <div>
                 <span className="text-neutral-500">Neutral Terminals:</span> <span className="text-gray-400">{simResult.neutralTerminals.size}</span>
               </div>
               <div>
                 <span className="text-neutral-500">Powered Items:</span> <span className="text-green-400">{simResult.poweredComponents.size}</span>
               </div>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dash { to { stroke-dashoffset: -15; } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #171717; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #404040; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #525252; }
      `}} />
    </div>
  );
}