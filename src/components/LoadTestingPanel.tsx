import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, 
  Square, 
  Zap, 
  TrendingUp, 
  Server, 
  Activity, 
  Database, 
  AlertTriangle, 
  Cpu, 
  Layers, 
  Settings, 
  Send, 
  HelpCircle, 
  ArrowRight, 
  Clock, 
  Sparkles, 
  RefreshCw,
  Sliders,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

interface JourneyStep {
  name: string;
  type: "read" | "write" | "compute";
  description: string;
  baseLatencyMs: number;
}

interface JourneyTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  defaultReadRatio: number; // 0 to 1
  steps: JourneyStep[];
}

interface TelemetryPoint {
  time: string;
  rps: number;
  latency: number;
  errorRate: number;
  dbQueueDepth: number;
  cacheHitRate: number;
}

export default function LoadTestingPanel() {
  // Config States
  const [activeJourneyId, setActiveJourneyId] = useState<string>("fin-settle");
  const [trafficShape, setTrafficShape] = useState<"constant" | "spike" | "sine" | "flash">("spike");
  const [baseRps, setBaseRps] = useState<number>(1800);
  const [readRatio, setReadRatio] = useState<number>(0.2); // 0.2 means 20% reads, 80% writes (write-heavy)
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1); // seconds per tick
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [tickCount, setTickCount] = useState<number>(0);

  // Simulation Running State
  const [currentRps, setCurrentRps] = useState<number>(1800);
  const [currentLatency, setCurrentLatency] = useState<number>(240);
  const [currentErrorRate, setCurrentErrorRate] = useState<number>(0.08);
  const [currentQueueDepth, setCurrentQueueDepth] = useState<number>(8);
  const [currentCacheHit, setCurrentCacheHit] = useState<number>(95);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [simulationLogs, setSimulationLogs] = useState<Array<{ time: string; level: "INF" | "WRN" | "ERR" | "SUC"; text: string }>>([
    { time: "00:00:00", level: "INF", text: "VNP Load Testing Engine initialized." },
    { time: "00:00:00", level: "INF", text: "Ready to deploy simulated virtual agents." }
  ]);

  // Telemetry Chart History (holds up to 20 points)
  const [chartHistory, setChartHistory] = useState<TelemetryPoint[]>([]);

  // AI Chat Consultant States
  const [chatPrompt, setChatPrompt] = useState<string>("");
  const [chatHistoryList, setChatHistoryList] = useState<Array<{ role: "user" | "model"; text: string }>>([
    {
      role: "model",
      text: "Hello! I am the **VNP Load Testing & Architectural Consultant**. Run a simulation wave, tune your read/write payload weight, or ask me how to configure Kubernetes horizontal autoscaling to handle bursty write-heavy workloads without route degradation."
    }
  ]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Templates
  const journeys: JourneyTemplate[] = [
    {
      id: "fin-settle",
      name: "Sovereign Financial Settlement Swarm",
      description: "Models highly transactional multi-signature write locks, escrow reservations, and ledger state commits.",
      icon: <Database className="w-4 h-4 text-emerald-400" />,
      defaultReadRatio: 0.15,
      steps: [
        { name: "Auth & Escrow Check", type: "read", description: "Verifies client credentials and token balance in edge cache.", baseLatencyMs: 12 },
        { name: "Pre-Auth Reservation", type: "write", description: "Places hold on prepaid credits in ledger, locking account row.", baseLatencyMs: 95 },
        { name: "Validator Quorum Signing", type: "compute", description: "Collects 3 independent validator signatures over the payment envelope.", baseLatencyMs: 180 },
        { name: "Double-Entry Ledger Commit", type: "write", description: "Appends immutable entry to database with time-series partitioning.", baseLatencyMs: 140 },
        { name: "Stripe Meter Update", type: "write", description: "Pushes final settlement aggregate to commercial gateway queue.", baseLatencyMs: 85 }
      ]
    },
    {
      id: "sov-rag",
      name: "Sovereign RAG Agent Matrix",
      description: "Simulates high-concurrency read-heavy vector lookups, context fetching, and multi-model consensus.",
      icon: <Cpu className="w-4 h-4 text-[#818cf8]" />,
      defaultReadRatio: 0.90,
      steps: [
        { name: "Query Deconstruction", type: "compute", description: "Translates query into embedding query format.", baseLatencyMs: 40 },
        { name: "Discovery & Routing Lookup", type: "read", description: "Fetches current highest-rated inference nodes from Route Beacon.", baseLatencyMs: 6 },
        { name: "Hot Vector DB Query", type: "read", description: "Accesses vector DB indexes. Highly parallelized, optimized read path.", baseLatencyMs: 18 },
        { name: "Consensus Model Selection", type: "compute", description: "Queries LLM cluster to compute best consensus response.", baseLatencyMs: 310 },
        { name: "Telemetry Record Release", type: "write", description: "Asynchronously logs proxy request metadata for compliance audit.", baseLatencyMs: 35 }
      ]
    },
    {
      id: "ecom-broker",
      name: "Mixed E-Commerce Agent Journey",
      description: "A standard alternating pattern of heavy catalogue lookups followed by transactional item purchasing.",
      icon: <Activity className="w-4 h-4 text-amber-400" />,
      defaultReadRatio: 0.50,
      steps: [
        { name: "Price Oracle Lookup", type: "read", description: "Retrieves current price indices for agent negotiation.", baseLatencyMs: 15 },
        { name: "Catalogue Read", type: "read", description: "Pulls product description details and media assets.", baseLatencyMs: 25 },
        { name: "Consensus Match", type: "compute", description: "Agent analyzes alternative deals and matches specification.", baseLatencyMs: 60 },
        { name: "Credit Reservation Hold", type: "write", description: "Acquires lock on reservation state and holds items in inventory.", baseLatencyMs: 110 },
        { name: "Invoicing Settlement", type: "write", description: "Finalizes transaction, updates credit balance, and generates keys.", baseLatencyMs: 120 }
      ]
    }
  ];

  const activeJourney = journeys.find(j => j.id === activeJourneyId) || journeys[0];

  // Sync default read-ratio when changing journeys
  useEffect(() => {
    setReadRatio(activeJourney.defaultReadRatio);
  }, [activeJourneyId]);

  // Main simulation clock tick
  useEffect(() => {
    let timer: any = null;
    if (isSimulating) {
      timer = setInterval(() => {
        setTickCount(prev => prev + 1);
      }, (simulationSpeed === 2 ? 800 : simulationSpeed === 0.5 ? 2400 : 1300));
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isSimulating, simulationSpeed]);

  // Execute a simulation tick, calculate metrics dynamically
  useEffect(() => {
    if (!isSimulating) return;

    // 1. Calculate Traffic Shape RPS Modifier
    let targetRps = baseRps;
    const cycle = (tickCount % 20); // 20-tick period
    
    if (trafficShape === "spike") {
      // Create a sharp spike at ticks 6-9, followed by recovery
      if (cycle >= 6 && cycle <= 9) {
        const spikeMultiplier = cycle === 7 || cycle === 8 ? 2.5 : 1.8;
        targetRps = Math.round(baseRps * spikeMultiplier);
      } else if (cycle >= 10 && cycle <= 13) {
        // Recovery dip
        targetRps = Math.round(baseRps * 0.7);
      }
    } else if (trafficShape === "sine") {
      // Sinusoidal wave
      const angle = (tickCount * Math.PI) / 6; // 12-tick full cycle
      const sineVal = Math.sin(angle); // -1 to 1
      targetRps = Math.round(baseRps * (1 + sineVal * 0.45));
    } else if (trafficShape === "flash") {
      // Starts small, sudden extreme burst, then dies down
      if (cycle < 4) {
        targetRps = Math.round(baseRps * 0.25);
      } else if (cycle >= 4 && cycle <= 7) {
        targetRps = Math.round(baseRps * 3.8); // MASSIVE BURST!
      } else {
        targetRps = Math.round(baseRps * 0.5);
      }
    }

    setCurrentRps(targetRps);

    // 2. Step through the User Journey
    const nextStepIndex = (activeStepIndex + 1) % activeJourney.steps.length;
    setActiveStepIndex(nextStepIndex);
    const activeStep = activeJourney.steps[nextStepIndex];

    // 3. Compute Performance Impact based on Read/Write Ratio
    // Reads hit the cache. Writes hit PostgreSQL + ledger streams.
    // Higher base rps + higher writes (lower readRatio) = higher queue depth, higher latency, higher error rate.
    const writeRatio = 1 - readRatio;
    
    // Cache Hit rate degrades slightly under massive RPS
    const calculatedCacheHit = Math.max(25, Math.round(98 - (targetRps / 12000) * (1 - readRatio * 0.2) * 10));
    setCurrentCacheHit(calculatedCacheHit);

    // Base latency computed from active journey step
    let latencyMultiplier = 1.0;
    
    // Writes create DB lock delays
    let queueGrowth = 0;
    if (targetRps > 2000) {
      queueGrowth = Math.round((targetRps - 2000) * writeRatio * 0.006);
    }
    const targetQueue = Math.max(1, Math.round(2 + queueGrowth + (activeStep.type === "write" ? 4 : 0) + (trafficShape === "spike" && cycle >= 7 && cycle <= 9 ? 12 : 0)));
    setCurrentQueueDepth(targetQueue);

    // Queue depth increases latency exponentially
    const queueDelay = targetQueue * 14;
    
    // Read-heavy requests get low latency when hitting the cache
    let stepBaseLatency = activeStep.baseLatencyMs;
    if (activeStep.type === "read") {
      // proportion of reads that hit cache get < 5ms latency, others get stepBase
      const cacheHitFraction = calculatedCacheHit / 100;
      stepBaseLatency = Math.round((cacheHitFraction * 4) + ((1 - cacheHitFraction) * stepBaseLatency));
    }

    // Workload thermal additions
    const scaleFactor = targetRps / 2000;
    const computedLatency = Math.round((stepBaseLatency + queueDelay) * scaleFactor * (0.95 + Math.random() * 0.1));
    setCurrentLatency(computedLatency);

    // Error rate increases under heavy CPU or massive write queues
    let baseErr = 0.02; // 0.02%
    if (computedLatency > 800) {
      baseErr += (computedLatency - 800) * 0.005;
    }
    if (targetQueue > 15) {
      baseErr += (targetQueue - 15) * 0.3;
    }
    const computedError = parseFloat(Math.min(100, Math.max(0.01, baseErr + (Math.random() * 0.04))).toFixed(2));
    setCurrentErrorRate(computedError);

    // 4. Generate Simulation logs for visual realism
    const timeString = new Date().toTimeString().split(" ")[0];
    let logText = "";
    let logLevel: "INF" | "WRN" | "ERR" | "SUC" = "INF";

    if (tickCount % 4 === 0) {
      logText = `[Journey Step: ${activeStep.name}] Processing ${targetRps.toLocaleString()} virtual requests/sec. Latency: ${computedLatency}ms.`;
      if (computedLatency > 800) {
        logLevel = "WRN";
        logText += ` [Slow Response detected]`;
      } else {
        logLevel = "SUC";
      }
    } else if (activeStep.type === "write" && writeRatio > 0.7) {
      logLevel = "INF";
      logText = `[Ledger Lock] Write transaction commit to PostgreSQL. DB Queue: ${targetQueue} items. Ledger delay stable.`;
    } else if (activeStep.type === "read" && calculatedCacheHit > 90) {
      logLevel = "SUC";
      logText = `[Beacon Cache] Route recommendations served. Cache Hit: ${calculatedCacheHit}%. Response: 3.8ms.`;
    } else if (computedError > 4.0) {
      logLevel = "ERR";
      logText = `[🚨 SLA BREACH] High error rate (${computedError}%) in region US-EAST. Queue congestion limits reached.`;
    } else {
      logLevel = "INF";
      logText = `[Worker Pool] Horizontal Pod Autoscaler healthy. Live replicas: ${Math.min(12, Math.max(2, Math.ceil(targetRps / 800)))}.`;
    }

    setSimulationLogs(prev => [
      { time: timeString, level: logLevel, text: logText },
      ...prev.slice(0, 49) // Keep last 50 logs
    ]);

    // 5. Append to Telemetry History Graph
    setChartHistory(prev => {
      const nextList = [
        ...prev,
        {
          time: timeString.substr(3, 5), // mm:ss
          rps: targetRps,
          latency: computedLatency,
          errorRate: computedError,
          dbQueueDepth: targetQueue,
          cacheHitRate: calculatedCacheHit
        }
      ];
      // Keep only last 18 items for the graph width
      if (nextList.length > 18) {
        return nextList.slice(nextList.length - 18);
      }
      return nextList;
    });

  }, [tickCount, isSimulating]);

  // Handle Manual Spike Injection
  const handleManualSpike = () => {
    if (!isSimulating) {
      setIsSimulating(true);
    }
    const timeString = new Date().toTimeString().split(" ")[0];
    setSimulationLogs(prev => [
      { time: timeString, level: "WRN", text: "⚡ MANUAL SPIKE INJECTED: Swarming 7,500 additional concurrent mock requests!" },
      ...prev
    ]);
    
    // Momentarily spike RPS and Latency
    setCurrentRps(prev => prev + 7500);
    setCurrentLatency(prev => prev + 450);
    setCurrentQueueDepth(prev => prev + 22);
    setCurrentErrorRate(prev => parseFloat(Math.min(100, prev + 3.8).toFixed(2)));
  };

  // AI Load Testing Advisor Chat submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatPrompt.trim()) return;

    const userMsg = chatPrompt;
    setChatPrompt("");
    setChatHistoryList(prev => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);

    // Build context-aware load testing architectural prompt
    const fullContextPrompt = `The user is running a load testing simulation inside Veklom Nexus Protocol (VNP).
Current Scenario Status:
- Journey Template: ${activeJourney.name} (${activeJourney.description})
- Traffic Shape Wave: ${trafficShape}
- Configured Base RPS: ${baseRps} req/sec
- Read/Write Ratio: ${Math.round(readRatio * 100)}% Reads, ${Math.round((1 - readRatio) * 100)}% Writes
- Live Measurements at last tick: RPS = ${currentRps}, Latency = ${currentLatency}ms, Error Rate = ${currentErrorRate}%, DB Queue Depth = ${currentQueueDepth}, Cache Hit Rate = ${currentCacheHit}%

User's Question: "${userMsg}"

Provide highly actionable, technical architectural advice on how the user can improve distributed microservice stability, scale database transactions, protect the route-beacon latency, optimize PostgreSQL partitions or Redis queues, or configure Kubernetes HPA metrics to handle these specific loads. Give a precise, structured answer in crisp, professional developer terms. Keep it under 200 words.`;

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullContextPrompt })
      });
      
      const data = await res.json();
      if (data.text) {
        setChatHistoryList(prev => [...prev, { role: "model", text: data.text }]);
      } else {
        throw new Error("Empty AI text");
      }
    } catch (err) {
      console.error(err);
      setChatHistoryList(prev => [...prev, {
        role: "model",
        text: "🚨 **Error connecting to VNP Consensus AI Advisor**: Make sure your `GEMINI_API_KEY` is fully configured in the Settings menu. For now, here is a general recommendation: When experiencing write-heavy queue congestion, transition your transactional logs to an asynchronous Redis list buffer to protect PostgreSQL database pools from write-lock exhaustion."
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // SVG Custom Sparkline Paths builder
  const buildSvgPath = (data: TelemetryPoint[], key: keyof TelemetryPoint, minVal: number, maxVal: number, height: number, width: number) => {
    if (data.length < 2) return "";
    const padding = 10;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;
    
    const points = data.map((d, index) => {
      const val = d[key] as number;
      const x = padding + (index / (data.length - 1)) * innerWidth;
      
      // Calculate normalized Y coord
      const ratio = maxVal === minVal ? 0.5 : (val - minVal) / (maxVal - minVal);
      // Invert Y because SVG coordinates go top-down
      const y = padding + innerHeight - (ratio * innerHeight);
      return `${x},${y}`;
    });
    
    return `M ${points.join(" L ")}`;
  };

  return (
    <div id="vnp-load-testing-workspace" className="p-6 space-y-6">
      
      {/* Top Section Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono px-2 py-0.5 rounded font-extrabold tracking-wider uppercase">
              DATA-PLANE ADVERSARIAL SWARM
            </span>
            <span className="text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
              TRAFFIC EMULATION ENGINE
            </span>
          </div>
          <h2 className="text-lg font-black text-white tracking-tight">Advanced Load Testing Suite</h2>
          <p className="text-xs text-slate-400">
            Simulate realistic multi-region agent swarms, define multi-step user journeys, and model write-heavy transaction bottlenecks to secure distributed microservice resiliency.
          </p>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            id="vnp-btn-manual-spike"
            onClick={handleManualSpike}
            className="flex items-center gap-1.5 bg-[#1a140b] border border-amber-500/30 hover:border-amber-500/50 hover:bg-[#2c1d09] text-amber-400 text-xs font-bold font-mono px-4 py-2.5 rounded-xl transition cursor-pointer select-none"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
            <span>Inject Manual Spike!</span>
          </button>

          <button
            id="vnp-btn-toggle-sim"
            onClick={() => {
              setIsSimulating(!isSimulating);
              if (!isSimulating) {
                const timeStr = new Date().toTimeString().split(" ")[0];
                setSimulationLogs(prev => [
                  { time: timeStr, level: "SUC", text: `🚀 Traffic wave simulation '${trafficShape.toUpperCase()}' started successfully.` },
                  ...prev
                ]);
              }
            }}
            className={`flex items-center gap-1.5 text-xs font-extrabold px-5 py-2.5 rounded-xl transition cursor-pointer select-none border ${
              isSimulating 
                ? "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20" 
                : "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            {isSimulating ? (
              <>
                <Square className="w-3.5 h-3.5" />
                <span>Halt Simulation</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Start Load Simulation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid Layout: Config Sidebar (col 4) & Main Sim (col 8) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Configuration Workspace */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Section 1: Journey Template Selection */}
          <div className="bg-[#0b1017] border border-slate-900 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>1. Select User Journey</span>
            </div>
            
            <div className="space-y-3">
              {journeys.map((j) => (
                <div
                  key={j.id}
                  onClick={() => setActiveJourneyId(j.id)}
                  className={`p-3.5 border rounded-xl cursor-pointer transition select-none ${
                    activeJourneyId === j.id 
                      ? "bg-[#0c1322] border-emerald-500/50 text-slate-200" 
                      : "bg-[#070b12] border-slate-900/80 hover:border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-extrabold text-[11px] text-slate-200 flex items-center gap-1.5">
                      {j.icon}
                      {j.name}
                    </span>
                    <span className="text-[8px] bg-slate-950 border border-slate-900 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                      {j.steps.length} steps
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-400">
                    {j.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Traffic Wave & Load Controls */}
          <div className="bg-[#0b1017] border border-slate-900 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>2. Traffic Wave Settings</span>
            </div>

            {/* Traffic Shape Toggle */}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 uppercase font-mono font-bold block">Wave Form Strategy</label>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                {[
                  { id: "spike", label: "⚡ SPIKE WAVE", tooltip: "Regular sudden load surges" },
                  { id: "sine", label: "📈 SINE DIURNAL", tooltip: "Cyclical peak-to-trough sine curve" },
                  { id: "flash", label: "🔥 FLASH MOB", tooltip: "Sudden extreme load burst" },
                  { id: "constant", label: "⚖️ CONSTANT FLAT", tooltip: "Standard flat sustained rate" }
                ].map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => setTrafficShape(shape.id as any)}
                    title={shape.tooltip}
                    className={`p-2 border rounded-lg text-center transition cursor-pointer select-none font-bold ${
                      trafficShape === shape.id 
                        ? "bg-[#0d1624] border-emerald-500/50 text-emerald-400" 
                        : "bg-[#070b12] border-slate-900 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Base RPS Slider */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">Base Conc. Workload:</span>
                <span className="text-emerald-400 font-extrabold">{baseRps.toLocaleString()} RPS</span>
              </div>
              <input
                type="range"
                min="500"
                max="5000"
                step="250"
                value={baseRps}
                onChange={(e) => setBaseRps(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[8.5px] text-slate-500 font-mono">
                <span>500 RPS (Low-SLA)</span>
                <span>5,000 RPS (HPA Peak)</span>
              </div>
            </div>

            {/* Read/Write Ratio Slider */}
            <div className="space-y-2 pt-2 border-t border-slate-900/60 pt-3">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">API Workload Mix:</span>
                <span className={`font-extrabold ${readRatio < 0.3 ? "text-red-400" : readRatio > 0.7 ? "text-blue-400" : "text-amber-400"}`}>
                  {Math.round(readRatio * 100)}% Read / {Math.round((1 - readRatio) * 100)}% Write
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.05"
                value={readRatio}
                onChange={(e) => setReadRatio(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-[#10b981]"
              />
              <div className="flex justify-between text-[8.5px] text-slate-500 font-mono">
                <span className="text-red-400 font-bold uppercase">WRITE-HEAVY (SQL locks)</span>
                <span className="text-blue-400 font-bold uppercase">READ-HEAVY (Redis cache)</span>
              </div>
              
              <p className="text-[9.5px] text-slate-500 font-sans leading-relaxed pt-1">
                {readRatio < 0.3 ? (
                  <span className="text-red-400/80">⚠️ Write-heavy configurations saturate the PostgreSQL engine, causing row locking and forcing Kubernetes Horizontal Pod replicas to scale.</span>
                ) : readRatio > 0.7 ? (
                  <span className="text-[#a78bfa]">✓ Read-heavy loads utilize the Edge Cache (Redis / Route Beacon) and complete quickly in sub-5ms latency.</span>
                ) : (
                  <span className="text-slate-400">Mixed workload pattern balances lookup cache efficiency and transaction settlement locks.</span>
                )}
              </p>
            </div>

            {/* Simulation speed options */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-900/60 pt-3">
              <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Tick Frequency</span>
              <div className="flex gap-1.5 font-mono text-[9px]">
                {[
                  { value: 0.5, label: "Slow" },
                  { value: 1, label: "1x (Normal)" },
                  { value: 2, label: "2x (Fast)" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSimulationSpeed(opt.value)}
                    className={`px-2 py-1 rounded border cursor-pointer select-none font-bold ${
                      simulationSpeed === opt.value 
                        ? "bg-slate-800 text-emerald-400 border-slate-700" 
                        : "bg-[#070b12] text-slate-500 border-slate-900 hover:border-slate-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT: Live Visualizer & Charts & AI Chat */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Dashboard Monitors */}
          <div className="bg-[#0b1017] border border-slate-900 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Distributed Data-Plane telemetry</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-slate-950 border border-slate-900 font-mono text-slate-400 px-2 py-0.5 rounded">
                  Wave Strategy: {trafficShape.toUpperCase()}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full ${isSimulating ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              </div>
            </div>

            {/* Live 4 Gauge Blocks */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-center font-mono">
              
              <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-xl flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute top-0 left-0 h-1 bg-emerald-500 transition-all" style={{ width: isSimulating ? "100%" : "0%" }} />
                <span className="text-[8px] text-slate-500 block uppercase font-bold leading-tight">THROUGHPUT</span>
                <span className="text-lg font-black text-white mt-1">
                  {isSimulating ? currentRps.toLocaleString() : "0"}{" "}
                  <span className="text-[9px] font-medium text-slate-500">RPS</span>
                </span>
                <span className="text-[8.5px] text-slate-400 block mt-1 uppercase font-bold text-emerald-400/80">
                  {isSimulating ? `${Math.ceil(currentRps / 800)} Replicas Active` : "Cluster Dormant"}
                </span>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-xl flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute top-0 left-0 h-1 bg-[#818cf8]" />
                <span className="text-[8px] text-slate-500 block uppercase font-bold leading-tight">AVG P99 LATENCY</span>
                <span className={`text-lg font-black mt-1 ${isSimulating && currentLatency > 800 ? "text-amber-400 animate-pulse" : "text-white"}`}>
                  {isSimulating ? currentLatency : "—"}{" "}
                  <span className="text-[9px] font-medium text-slate-500">MS</span>
                </span>
                <span className="text-[8.5px] text-slate-500 block mt-1 font-bold">
                  {isSimulating ? (currentLatency < 200 ? "✓ Absolute Peak DX" : currentLatency < 600 ? "SLA Conformant" : "⚠️ Severe Congestion") : "Inert State"}
                </span>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-xl flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute top-0 left-0 h-1 bg-red-500" />
                <span className="text-[8px] text-slate-500 block uppercase font-bold leading-tight">M2M ERROR RATE</span>
                <span className={`text-lg font-black mt-1 ${isSimulating && currentErrorRate > 4.0 ? "text-red-400 animate-pulse" : "text-white"}`}>
                  {isSimulating ? `${currentErrorRate}%` : "0.00%"}
                </span>
                <span className={`text-[8.5px] block mt-1 font-bold ${isSimulating && currentErrorRate > 4.0 ? "text-red-400" : "text-emerald-500"}`}>
                  {isSimulating ? (currentErrorRate < 1.0 ? "✓ Clear Path SLA" : "❌ SLA Violation Threshold") : "Healthy State"}
                </span>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-xl flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute top-0 left-0 h-1 bg-amber-500" />
                <span className="text-[8px] text-slate-500 block uppercase font-bold leading-tight">POSTGRES DB QUEUE</span>
                <span className={`text-lg font-black mt-1 ${isSimulating && currentQueueDepth > 15 ? "text-amber-400" : "text-white"}`}>
                  {isSimulating ? currentQueueDepth : "0"}
                </span>
                <span className="text-[8.5px] text-slate-500 block mt-1 font-bold">
                  {isSimulating ? (currentQueueDepth < 5 ? "IDLE / NO STALL" : currentQueueDepth < 15 ? "Buffered Smoothing" : "⚠️ DB Locks Active") : "Flush State"}
                </span>
              </div>

            </div>

            {/* Custom SVG Time-series Sparkline Chart representing historical simulation results */}
            <div className="bg-[#070a10] border border-slate-950 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 uppercase font-bold">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-1 bg-emerald-400 block rounded" /> Throughput (RPS)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-1 bg-[#818cf8] block rounded" /> Latency (ms)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-1 bg-red-400 block rounded" /> Errors (%)
                </span>
              </div>

              <div className="h-[180px] w-full bg-slate-950 rounded border border-slate-900 relative">
                {chartHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-2">
                    <Activity className="w-6 h-6 text-slate-700" />
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Run Simulation to generate live telemetry curves</span>
                  </div>
                ) : (
                  <svg width="100%" height="100%" className="absolute inset-0">
                    {/* Horizontal grid lines */}
                    <line x1="0" y1="35" x2="100%" y2="35" stroke="rgba(30, 41, 59, 0.25)" strokeDasharray="3,3" />
                    <line x1="0" y1="90" x2="100%" y2="90" stroke="rgba(30, 41, 59, 0.25)" strokeDasharray="3,3" />
                    <line x1="0" y1="145" x2="100%" y2="145" stroke="rgba(30, 41, 59, 0.25)" strokeDasharray="3,3" />

                    {/* Throughput Curve (Green) */}
                    <path
                      d={buildSvgPath(chartHistory, "rps", 0, Math.max(8000, ...chartHistory.map(h => h.rps)), 180, 500)}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* Latency Curve (Indigo) */}
                    <path
                      d={buildSvgPath(chartHistory, "latency", 0, Math.max(1200, ...chartHistory.map(h => h.latency)), 180, 500)}
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />

                    {/* Error Curve (Red) */}
                    <path
                      d={buildSvgPath(chartHistory, "errorRate", 0, Math.max(10, ...chartHistory.map(h => h.errorRate)), 180, 500)}
                      fill="none"
                      stroke="#f87171"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    {/* Time ticks label text in corners */}
                    <text x="10" y="20" fill="#475569" fontSize="8" fontFamily="monospace">HIGH OUTLET LEVEL</text>
                    <text x="10" y="170" fill="#475569" fontSize="8" fontFamily="monospace">{chartHistory[0].time} START</text>
                    <text x="90%" y="170" fill="#475569" fontSize="8" fontFamily="monospace" textAnchor="end">{chartHistory[chartHistory.length-1].time} NOW</text>
                  </svg>
                )}
              </div>
            </div>

            {/* Visualizing Active Journey step progression */}
            <div className="space-y-3">
              <div className="text-[10px] font-mono text-slate-500 uppercase font-bold tracking-wider">
                Active User Journey Step Progression:
              </div>

              <div className="flex flex-col md:flex-row items-stretch justify-between gap-2.5">
                {activeJourney.steps.map((step, idx) => {
                  const isActive = isSimulating && idx === activeStepIndex;
                  let typeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/15";
                  if (step.type === "write") typeColor = "text-red-400 bg-red-500/10 border-red-500/15";
                  if (step.type === "compute") typeColor = "text-[#a78bfa] bg-[#a78bfa]/10 border-[#a78bfa]/15";

                  return (
                    <div
                      key={step.name}
                      className={`flex-1 p-3 border rounded-lg flex flex-col justify-between transition-all relative select-none ${
                        isActive 
                          ? "bg-[#0f192b] border-[#10b981] shadow-md shadow-[#10b981]/5" 
                          : "bg-slate-950/60 border-slate-900 text-slate-500"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[8px] font-mono">
                          <span className="font-bold text-slate-400">STEP 0{idx + 1}</span>
                          <span className={`px-1 rounded uppercase font-extrabold font-mono text-[7px] border ${typeColor}`}>
                            {step.type}
                          </span>
                        </div>
                        <h4 className={`text-[10px] font-black tracking-tight ${isActive ? "text-slate-100" : "text-slate-400"}`}>
                          {step.name}
                        </h4>
                      </div>

                      <p className={`text-[9px] leading-relaxed mt-1.5 ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                        {step.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Section 2: Real-time Emulation Logs (Half Width Column split or full panel) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Simulation Terminal Log Stream */}
            <div className="bg-[#0b1017] border border-slate-900 rounded-xl p-5 flex flex-col justify-between min-h-[300px]">
              <div className="space-y-3.5 flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                  <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>Emulation Event Stream</span>
                  </span>
                  
                  <span className="text-[8.5px] font-mono text-slate-500 uppercase font-black">
                    k6 virtual threads
                  </span>
                </div>

                {/* Log area */}
                <div className="flex-1 overflow-y-auto max-h-[220px] font-mono text-[9px] space-y-2 pr-1 custom-scrollbar">
                  {simulationLogs.map((log, index) => {
                    let badgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/15";
                    if (log.level === "WRN") badgeColor = "text-amber-400 bg-amber-500/10 border-amber-500/15";
                    if (log.level === "ERR") badgeColor = "text-red-400 bg-red-500/10 border-red-500/15";

                    return (
                      <div key={index} className="flex items-start gap-1.5 leading-relaxed text-slate-400 hover:text-slate-300 transition">
                        <span className="text-slate-600 shrink-0 font-medium">{log.time}</span>
                        <span className={`text-[7px] px-1 font-black shrink-0 border rounded uppercase ${badgeColor}`}>
                          {log.level}
                        </span>
                        <span className="break-all">{log.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* AI Architectural Load testing Advisor Panel */}
            <div className="bg-[#0b1017] border border-slate-900 rounded-xl p-5 flex flex-col justify-between min-h-[300px]">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                  <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>AI Consensus Advisor</span>
                  </span>
                  <span className="text-[7.5px] bg-[#111c2c] text-slate-400 border border-slate-800 px-1.5 py-0.2 rounded font-mono uppercase">
                    gemini-3.1-flash-lite
                  </span>
                </div>

                {/* Chat feed */}
                <div className="overflow-y-auto max-h-[160px] space-y-3 pr-1 text-xs custom-scrollbar">
                  {chatHistoryList.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg leading-relaxed text-[11px] ${
                        msg.role === "user" 
                          ? "bg-slate-950 border border-slate-900 text-slate-300 ml-4" 
                          : "bg-[#0d131f]/60 text-slate-300 mr-4 border border-slate-900/60"
                      }`}
                    >
                      <div className="text-[7.5px] text-slate-500 font-mono font-bold uppercase mb-1">
                        {msg.role === "user" ? "Developer Agent" : "Consensus Engine"}
                      </div>
                      <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono italic">
                      <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                      <span>AI model recalculating optimal shard topology...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Input */}
              <form onSubmit={handleChatSubmit} className="flex gap-2 border-t border-slate-900/60 pt-3 mt-3 shrink-0">
                <input
                  type="text"
                  value={chatPrompt}
                  onChange={(e) => setChatPrompt(e.target.value)}
                  placeholder={isSimulating ? "Ask about current simulation metrics..." : "Ask about HPA scaling optimization..."}
                  className="flex-1 bg-slate-950 border border-slate-900 text-slate-100 placeholder-slate-500 text-xs px-3.5 py-2.5 rounded-xl focus:border-emerald-500/50 outline-none font-sans"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 text-emerald-400 rounded-xl px-3.5 py-2.5 transition cursor-pointer select-none disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

          </div>

          {/* SLA Performance Diagnostics Card */}
          <div className="bg-[#0b1017] border border-slate-900 rounded-xl p-4 flex flex-col md:flex-row items-stretch justify-between gap-4 font-mono text-[11px]">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold uppercase">
                <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                <span>Distributed Data-Plane SLA Diagnostics</span>
              </div>
              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                {isSimulating ? (
                  currentLatency > 800 ? (
                    <span className="text-red-400/90 font-medium">🚨 CRITICAL SLA BREACH DETECTED: Latency has exceeded the 1200ms tollerance threshold. PostgreSQL write queues are locking. Recommendation: Immediately scale Kubernetes pods to 10 replicas or move downstream commits to an asynchronous RabbitMQ queue buffering.</span>
                  ) : currentLatency > 400 ? (
                    <span className="text-amber-400/90 font-medium">⚠️ WARNING SLA BORDERLINE: High CPU and DB Queue buffers observed. Edge cache hit is degrading. Consider raising cache TTL constraints to safeguard Route Beacon lookups.</span>
                  ) : (
                    <span className="text-emerald-400/90 font-medium">✓ OPTIMAL CLUSTER RESILIENCY: All regional probes and microservice processes running under 400ms SLA guidelines. Trust scoring algorithms verified.</span>
                  )
                ) : (
                  "Initiate the Traffic emulation engine above to evaluate live system performance under stress. The diagnostic console will pinpoint real-time bottlenecks."
                )}
              </p>
            </div>

            <div className="flex flex-col justify-center items-start md:items-end gap-1 font-mono shrink-0 pt-2 md:pt-0 border-t md:border-t-0 md:border-l border-slate-900 pl-0 md:pl-5">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">M2M SLA Threshold:</span>
                <span className="text-slate-300 font-bold">1200ms p99</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Max Tolerable Loss:</span>
                <span className="text-slate-300 font-bold">5.0% Errors</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
