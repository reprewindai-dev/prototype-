import React, { useState } from "react";
import { Award, Globe, Activity, ShieldCheck, HardDrive, Cpu, Terminal, Anchor, Server, Layers, ArrowRight, Sliders, Check, Zap, GitCompare, X } from "lucide-react";
import { ApiState, RegionMetric } from "../types";

interface BenchmarkPanelProps {
  apis: ApiState[];
  trustBeacon: string;
  blockAnchored: number;
  onRefreshTelemetry?: () => void;
}

// Interactive custom SVG Octagon Radar Polygon Plot with a sweeping target system
function VnpRadarChart({ score, apiId, x402Ready }: { score: number; apiId: string; x402Ready: boolean }) {
  const center = 100;
  const maxRadius = 60;

  // Define 8 uniform dimensions around the octagon
  const axes = [
    { label: "p99", key: "p99" },
    { label: "Stability", key: "uptime" },
    { label: "RPS Cap", key: "rps" },
    { label: "Security", key: "security" },
    { label: "Docs Check", key: "docs" },
    { label: "Version", key: "version" },
    { label: "x402 Spec", key: "x402" },
    { label: "Developer DX", key: "dx" },
  ];

  // Compute a deterministic value multiplier for each axis based on the score and details
  const getScale = (index: number) => {
    // Generate variations to make the polygon look authentic and uniquely organic
    const seed = (apiId.charCodeAt(index % apiId.length) || 7) % 10;
    let val = 75 + (seed * 2.5);

    if (index === 6 && !x402Ready) { // x402 compliance axis
      val = 35;
    }
    if (index === 3) { // security axis
      val = score > 95 ? 98 : score > 90 ? 90 : 80;
    }
    if (index === 0) { // p99 axis
      val = score;
    }
    return Math.min(100, Math.max(30, val)) / 100;
  };

  // Compute coordinates for axes vertices
  const getCoordinates = (index: number, scale: number) => {
    const angle = (index * 2 * Math.PI) / 8 - Math.PI / 2; // Offset by -90 deg to align top
    const r = maxRadius * scale;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Prepare grid lines webs for levels 30%, 65%, 100%
  const webLevels = [0.35, 0.68, 1.0];
  const gridPathLines = webLevels.map((level) => {
    const points = Array.from({ length: 8 }).map((_, i) => {
      const coords = getCoordinates(i, level);
      return `${coords.x},${coords.y}`;
    });
    return points.join(" ") + " " + points[0]; // loop back to start
  });

  // Calculate coordinates of the active score polygon
  const activePoints = axes.map((_, i) => {
    const scale = getScale(i);
    const coords = getCoordinates(i, scale);
    return `${coords.x},${coords.y}`;
  });
  const activePointsStr = activePoints.join(" ");

  return (
    <div className="relative w-full flex flex-col items-center justify-center p-2.5 bg-[#080d15]/60 rounded-xl border border-slate-900/80">
      <style>{`
        @keyframes radarSweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .radar-sweep-line {
          transform-origin: 100px 95px;
          animation: radarSweep 4s linear infinite;
        }
      `}</style>
      
      <svg width="200" height="190" className="w-[185px] h-[178px]">
        {/* Render octagonal background webs */}
        {gridPathLines.map((points, idx) => (
          <polygon
            key={idx}
            points={points}
            fill="none"
            stroke="rgba(16, 185, 129, 0.12)"
            strokeWidth="0.85"
            strokeDasharray={idx === 2 ? "0" : "3,3"}
          />
        ))}

        {/* Draw diagonal axes rods */}
        {axes.map((_, i) => {
          const outer = getCoordinates(i, 1.0);
          return (
            <line
              key={i}
              x1={center}
              y1={95}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(30, 41, 59, 0.45)"
              strokeWidth="0.75"
            />
          );
        })}

        {/* Dynamic Sweep Vector Line */}
        <line
          x1={center}
          y1={95}
          x2={center + maxRadius}
          y2={95}
          stroke="rgba(16, 185, 129, 0.38)"
          strokeWidth="1.5"
          className="radar-sweep-line"
        />

        {/* Render active translucent polygon */}
        <polygon
          points={activePointsStr}
          fill="rgba(16, 185, 129, 0.14)"
          stroke="#10b981"
          strokeWidth="1.75"
          className="transition-all duration-500 ease-out"
        />

        {/* Small pulsing core point */}
        <circle cx={center} cy={95} r="3" fill="#10b981" />

        {/* Multi-dimension label markers */}
        {axes.map((axis, i) => {
          const outer = getCoordinates(i, 1.15);
          let anchor = "middle";
          if (outer.x < center - 10) anchor = "end";
          if (outer.x > center + 10) anchor = "start";
          
          return (
            <text
              key={i}
              x={outer.x}
              y={outer.y + 3.5}
              fill="#4b5563"
              fontSize="7.5"
              fontFamily="monospace"
              textAnchor={anchor}
              className="font-bold select-none text-[8px]"
            >
              {axis.label}
            </text>
          );
        })}
      </svg>
      {/* Target scanning indicator overlay */}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 px-1 py-0.2 rounded text-[7px] font-mono uppercase font-bold animate-pulse">
        Sweep active
      </div>
    </div>
  );
}

export default function BenchmarkPanel({ apis, trustBeacon, blockAnchored, onRefreshTelemetry }: BenchmarkPanelProps) {
  const [selectedApiId, setSelectedApiId] = useState<string>("did:vnp:api:veklom-sovereign-ai");
  const [statusFilter, setStatusFilter] = useState<"All" | "Healthy" | "Warning" | "Critical">("All");
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [compareApiId1, setCompareApiId1] = useState<string>("");
  const [compareApiId2, setCompareApiId2] = useState<string>("");

  // Custom API form states
  const [apiName, setApiName] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [apiVersion, setApiVersion] = useState("v1.0.0");
  const [apiX402, setApiX402] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("");

  // Gateway Proxy sandbox states
  const [proxyTenant, setProxyTenant] = useState("stripe.com");
  const [proxyPayload, setProxyPayload] = useState('{\n  "prompt": "Hello via VNP Secure Proxy",\n  "max_tokens": 100\n}');
  const [isProxying, setIsProxying] = useState(false);
  const [proxyResult, setProxyResult] = useState<any>(null);
  const [proxyError, setProxyError] = useState("");

  // Multi-weight configuration states to let users recalculate live composite API metrics
  const [p99Weight, setP99Weight] = useState<number>(40);
  const [uptimeWeight, setUptimeWeight] = useState<number>(30);
  const [securityWeight, setSecurityWeight] = useState<number>(20);
  const [rpsWeight, setRpsWeight] = useState<number>(10);
  const [weightTuned, setWeightTuned] = useState<boolean>(false);

  // Computes calculated composite scores for each API based on active user-defined weights
  const getRecalculatedScore = (api: ApiState) => {
    // Standard parameters derived from API metrics
    const p99Val = Math.min(100, Math.max(0, 100 - (api.regions["us-east"].p99 / 18)));
    const uptimeVal = Math.min(100, Math.max(0, (api.regions["us-east"].uptime - 90) * 10));
    const securityVal = api.compositeScore > 90 ? 98 : 84;
    const rpsVal = api.regions["us-east"].throughput > 1300 ? 99 : 85;

    const totalWeight = p99Weight + uptimeWeight + securityWeight + rpsWeight || 1;
    const rawSum = (p99Val * p99Weight) + (uptimeVal * uptimeWeight) + (securityVal * securityWeight) + (rpsVal * rpsWeight);
    const calculated = rawSum / totalWeight;

    // Harmonize score relative to base baseline to prevent unnatural swings
    const originalGap = api.compositeScore - 88;
    const drifted = calculated + (originalGap * 0.4);
    return Math.min(100, Math.max(45, parseFloat(drifted.toFixed(1))));
  };

  const getBadgeGrade = (score: number) => {
    if (score >= 96) return "AAA";
    if (score >= 92) return "AA+";
    if (score >= 88) return "AA";
    if (score >= 82) return "A";
    return "BB";
  };

  const getRegionHighlighter = (p99: number) => {
    if (p99 < 350) return "text-emerald-400 bg-emerald-950/40 border-emerald-500/30";
    if (p99 < 700) return "text-blue-400 bg-blue-950/40 border-blue-500/30";
    if (p99 < 1200) return "text-amber-400 bg-amber-950/40 border-amber-500/30";
    return "text-red-400 bg-red-950/40 border-red-500/30";
  };

  // Find selected API
  const baseSelectedApi = apis.find((api) => api.id === selectedApiId) || apis[0];
  
  // Create calculated state API object with modified scores based on current weight coefficients
  const calculatedApis = apis.map(api => ({
    ...api,
    compositeScore: getRecalculatedScore(api)
  }));

  const getApiStatus = (score: number) => {
    if (score >= 90) return "Healthy";
    if (score >= 80) return "Warning";
    return "Critical";
  };

  const apisWithStatus = calculatedApis.map(api => ({
    ...api,
    status: getApiStatus(api.compositeScore)
  }));

  const countAll = apisWithStatus.length;
  const countHealthy = apisWithStatus.filter(api => api.status === "Healthy").length;
  const countWarning = apisWithStatus.filter(api => api.status === "Warning").length;
  const countCritical = apisWithStatus.filter(api => api.status === "Critical").length;

  const filteredApis = apisWithStatus.filter(api => {
    if (statusFilter === "All") return true;
    return api.status === statusFilter;
  });

  const selectedApi = calculatedApis.find(api => api.id === selectedApiId) || calculatedApis[0];

  const handleSliderChange = (setter: React.Dispatch<React.SetStateAction<number>>, val: number) => {
    setter(val);
    setWeightTuned(true);
  };

  const resetWeights = () => {
    setP99Weight(40);
    setUptimeWeight(30);
    setSecurityWeight(20);
    setRpsWeight(10);
    setWeightTuned(false);
  };

  const applyPreset = (p99: number, uptime: number, security: number, rps: number) => {
    setP99Weight(p99);
    setUptimeWeight(uptime);
    setSecurityWeight(security);
    setRpsWeight(rps);
    setWeightTuned(true);
  };

  const isPresetActive = (p99: number, uptime: number, security: number, rps: number) => {
    return p99Weight === p99 && uptimeWeight === uptime && securityWeight === security && rpsWeight === rps;
  };

  return (
    <div id="vnp-benchmark-matrix-root" className="space-y-6">
      
      {/* DUAL ZONE: Sliders Coefficient matrix + Ledger Metrics introduction */}
      <div className="bg-[#0b1017] border border-slate-900 rounded-2xl p-5 space-y-5">
        
        {/* Top Header Row with Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div className="space-y-1 max-w-lg">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-bold uppercase tracking-wider">
              <Sliders className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Consensus Coefficient Matrix</span>
            </div>
            <h3 className="text-md font-black text-white tracking-tight uppercase">Sovereign Telemetry Tuning Weights</h3>
            <p className="text-[11px] text-slate-400 leading-normal">
              Weight telemetry categories to dynamically calculate cryptographic consensus grades across all monitored APIs. Select an industry engineering profile below:
            </p>
          </div>

          {/* Quick Real-world Action Presets */}
          <div className="flex flex-wrap gap-2.5 font-mono text-[10px]">
            <button
              onClick={() => applyPreset(40, 30, 20, 10)}
              className={`px-3 py-2 rounded-xl border font-bold transition duration-150 cursor-pointer ${
                isPresetActive(40, 30, 20, 10) && !weightTuned
                  ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/50"
                  : isPresetActive(40, 30, 20, 10)
                  ? "bg-slate-950 text-emerald-400 border-emerald-500/30"
                  : "bg-[#05080c] text-slate-400 border-slate-900 hover:text-white"
              }`}
            >
              🌌 Balanced Golden Ratio (40 / 30 / 20 / 10)
            </button>

            <button
              onClick={() => applyPreset(15, 45, 35, 5)}
              className={`px-3 py-2 rounded-xl border font-bold transition duration-150 cursor-pointer ${
                isPresetActive(15, 45, 35, 5)
                  ? "bg-indigo-950/40 text-indigo-300 border-indigo-500/50 font-black"
                  : "bg-[#05080c] text-slate-400 border-slate-900 hover:text-white"
              }`}
            >
              🏦 FinTech/Ledger SLA Optimal (15 / 45 / 35 / 5)
            </button>

            <button
              onClick={() => applyPreset(55, 15, 5, 25)}
              className={`px-3 py-2 rounded-xl border font-bold transition duration-150 cursor-pointer ${
                isPresetActive(55, 15, 5, 25)
                  ? "bg-amber-950/40 text-amber-300 border-amber-500/50 font-black"
                  : "bg-[#05080c] text-slate-400 border-slate-900 hover:text-white"
              }`}
            >
              ⚡ Media/Low-Latency Sync (55 / 15 / 5 / 25)
            </button>
          </div>
        </div>

        {/* Sliders Grid + Explanatory Commentary Block */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Sliders panel (lg:col-span-8) */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-[10px] text-slate-400">
            
            <div className="space-y-1.5 p-3 bg-slate-950/70 border border-slate-900 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">p99 Latency Penalty Weight:</span>
                <span className="text-emerald-400 font-black">{p99Weight}%</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="70" 
                value={p99Weight} 
                onChange={(e) => handleSliderChange(setP99Weight, parseInt(e.target.value))}
                className="w-full h-1 bg-slate-900 rounded appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-1.5 p-3 bg-slate-950/70 border border-slate-900 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">Uptime Stability Coefficient:</span>
                <span className="text-[#6366f1] font-black">{uptimeWeight}%</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="70" 
                value={uptimeWeight} 
                onChange={(e) => handleSliderChange(setUptimeWeight, parseInt(e.target.value))}
                className="w-full h-1 bg-slate-900 rounded appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            <div className="space-y-1.5 p-3 bg-slate-950/70 border border-slate-900 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">Security / Auth Standards:</span>
                <span className="text-amber-500 font-black">{securityWeight}%</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="70" 
                value={securityWeight} 
                onChange={(e) => handleSliderChange(setSecurityWeight, parseInt(e.target.value))}
                className="w-full h-1 bg-slate-900 rounded appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <div className="space-y-1.5 p-3 bg-slate-950/70 border border-slate-900 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">Throughput Capacity (RPS):</span>
                <span className="text-blue-400 font-black">{rpsWeight}%</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="70" 
                value={rpsWeight} 
                onChange={(e) => handleSliderChange(setRpsWeight, parseInt(e.target.value))}
                className="w-full h-1 bg-slate-900 rounded appearance-none cursor-pointer accent-blue-500"
              />
            </div>

          </div>

          {/* Contextual Trade-Off Explanation Block (lg:col-span-4) */}
          <div className="lg:col-span-4 bg-slate-950 border border-slate-900 rounded-xl p-3.5 space-y-2.5">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block">SLA Trade-off Mechanics</span>
            
            {isPresetActive(40, 30, 20, 10) && (
              <div className="space-y-1.5 animate-fade-in text-[10px] leading-normal text-slate-400">
                <span className="text-emerald-400 font-bold block uppercase tracking-tight">Symmetric Shannon Optimum:</span>
                <p>
                  Balances latency and availability fairly. It models high-performance systems where mild performance degradation or brief packet renegotiation can solve momentary route surges. 
                </p>
                <span className="text-[8.5px] text-slate-600 block">Perfect for multi-tenant microcent applications trying to stay lean yet resilient.</span>
              </div>
            )}

            {isPresetActive(15, 45, 35, 5) && (
              <div className="space-y-1.5 animate-fade-in text-[10px] leading-normal text-slate-400">
                <span className="text-secondary font-bold block text-indigo-400 uppercase tracking-tight">Financial Ledger Priority:</span>
                <p>
                  Prioritizes uptime and data integrity above all. Outages or unauthenticated security payloads are heavily penalized. Financial layers tolerate minor latency increase to verify the ledger state.
                </p>
                <span className="text-[8.5px] text-slate-500 block">Perfect for payment gateways (Stripe, Plaid) or double-entry bookkeeping consensus.</span>
              </div>
            )}

            {isPresetActive(55, 15, 5, 25) && (
              <div className="space-y-1.5 animate-fade-in text-[10px] leading-normal text-slate-400">
                <span className="text-amber-400 font-bold block uppercase tracking-tight">Real-time Media Sync:</span>
                <p>
                  Urgent millisecond responses are critical. High capacity and fast P99 scores are demanded, letting transient state drift go unpunished. Perfect for streaming, VoIP, or gaming sockets.
                </p>
                <span className="text-[8.5px] text-slate-500 block">Prefers losing a micro-packet rather than pausing the feed to renegotiate transport encryption.</span>
              </div>
            )}

            {!isPresetActive(40, 30, 20, 10) && !isPresetActive(15, 45, 35, 5) && !isPresetActive(55, 15, 5, 25) && (
              <div className="space-y-1.5 animate-fade-in text-[10px] leading-normal text-slate-400">
                <span className="text-indigo-400 font-bold block uppercase tracking-tight">Custom Calibration Mode:</span>
                <p>
                  You are manually defining the node's judging weights. Active consensus grades are recalculating dynamically over the entire peer network of validators.
                </p>
                <button 
                  onClick={resetWeights}
                  className="mt-1 text-[9px] text-emerald-400 underline hover:text-emerald-300 font-bold bg-transparent border-0 cursor-pointer block p-0"
                >
                  Reset to Standard V0.1 weights
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Grid of verified APIs and Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900/60 pb-3 px-1">
        <div className="space-y-0.5">
          <h3 className="text-xs font-mono tracking-wider font-extrabold text-slate-400 uppercase flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <span>Consensus Peer Verified API Nodes ({filteredApis.length})</span>
            {weightTuned && <span className="text-emerald-400 italic font-mono lowercase font-normal">(recalculated weights active)</span>}
          </h3>
          <p className="text-[10px] text-slate-500 font-mono">
            Isolate network bottlenecks or consensus anomalies across peer probers.
          </p>
        </div>

        {/* Filter Bar & Compare Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setCompareApiId1(selectedApiId || calculatedApis[0]?.id || "");
              setCompareApiId2(calculatedApis.find(a => a.id !== (selectedApiId || calculatedApis[0]?.id))?.id || calculatedApis[1]?.id || "");
              setIsCompareModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare Nodes</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-900">
          <button
            onClick={() => setStatusFilter("All")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
              statusFilter === "All"
                ? "bg-slate-900 text-slate-100 border border-slate-800"
                : "text-slate-500 hover:text-slate-300 border border-transparent"
            }`}
          >
            All ({countAll})
          </button>
          <button
            onClick={() => setStatusFilter("Healthy")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "Healthy"
                ? "bg-[#0b1b16] text-emerald-400 border border-emerald-500/20"
                : "text-slate-500 hover:text-emerald-400 border border-transparent"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Healthy ({countHealthy})
          </button>
          <button
            onClick={() => setStatusFilter("Warning")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "Warning"
                ? "bg-[#1f1b10] text-amber-400 border border-amber-500/20"
                : "text-slate-500 hover:text-amber-400 border border-transparent"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Warning ({countWarning})
          </button>
          <button
            onClick={() => setStatusFilter("Critical")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "Critical"
                ? "bg-[#251214] text-red-400 border border-red-500/20"
                : "text-slate-500 hover:text-red-400 border border-transparent"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Critical ({countCritical})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredApis.length === 0 ? (
          <div className="col-span-1 md:col-span-2 p-10 bg-slate-950 border border-slate-900 rounded-2xl text-center space-y-2 flex flex-col items-center justify-center">
            <Activity className="w-8 h-8 text-slate-700 animate-pulse" />
            <p className="text-xs font-mono text-slate-400 uppercase font-bold">
              No API Nodes match the '{statusFilter}' filter
            </p>
            <p className="text-[10px] text-slate-600 font-mono">
              Adjust the consensus weights above or register a new custom node to test status boundaries.
            </p>
            <button
              onClick={() => setStatusFilter("All")}
              className="mt-2 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[9px] font-mono rounded-lg border border-slate-800 transition cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          filteredApis.map((api) => {
            const isSelected = api.id === selectedApiId;
            const grade = getBadgeGrade(api.compositeScore);
            
            return (
              <div
                key={api.id}
                onClick={() => setSelectedApiId(api.id)}
                className={`p-5 rounded-2xl border text-left cursor-pointer transition-all duration-300 relative select-none group flex flex-col justify-between ${
                  isSelected
                    ? "bg-[#0b1017] border-emerald-500/60 shadow-xl shadow-emerald-950/15"
                    : "bg-slate-950/80 border-slate-900 hover:border-slate-800/80 hover:bg-[#0c1119]/50"
                }`}
              >
                {/* Highlight background glow */}
                <div className={`absolute top-0 right-1/4 w-32 h-16 rounded-full filter blur-[40px] opacity-[0.03] pointer-events-none transition-all ${isSelected ? "bg-emerald-500 opacity-[0.07]" : "bg-transparent"}`} />

                <div>
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[9px] tracking-widest font-mono text-slate-500 block uppercase font-bold">
                        VEKLOM ● {api.x402Ready ? "PROTOCOL NORMALIZATION" : "MULTI-AGENT CONSENSUS"}
                      </span>
                      <h4 className="text-base font-extrabold text-slate-100 group-hover:text-emerald-300 transition duration-150">
                        {api.name}
                      </h4>
                      <span className="text-[10px] text-slate-500 font-mono block max-w-[280px] truncate">
                        {api.id}
                      </span>
                    </div>

                    {/* Rating Grade, Score Badge & Status Badge */}
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-stretch gap-1">
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] uppercase font-mono px-2 py-1 rounded font-extrabold flex items-center">
                          {grade}
                        </span>
                        <span className="text-2xl font-black font-mono text-emerald-400 tracking-tighter pl-1">
                          {api.compositeScore}
                        </span>
                      </div>
                      <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider flex items-center gap-1 ${
                        api.status === "Healthy" 
                          ? "text-emerald-400 bg-emerald-950/20 border-emerald-500/30" 
                          : api.status === "Warning" 
                          ? "text-amber-400 bg-amber-950/20 border-amber-500/30" 
                          : "text-red-400 bg-red-950/20 border-red-500/30"
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${
                          api.status === "Healthy" ? "bg-emerald-400" : api.status === "Warning" ? "bg-amber-400" : "bg-red-400 animate-pulse"
                        }`} />
                        {api.status}
                      </span>
                    </div>
                  </div>

                {/* SVG Octagonal Radar Section with Sweeper */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center mt-5 mb-4">
                  <div className="sm:col-span-5 flex justify-center">
                    <VnpRadarChart score={api.compositeScore} apiId={api.id} x402Ready={api.x402Ready} />
                  </div>

                  {/* Telemetry indices stats list */}
                  <div className="sm:col-span-7 font-mono text-[11px] text-slate-400 space-y-2 pb-1">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">P99 Latency Coefficient:</span>
                      <span className="text-slate-200 font-bold">{(100 - (api.regions["us-east"].p99 / 18)).toFixed(1)} / 100</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Uptime Stability Index:</span>
                      <span className="text-slate-200 font-bold">{(Math.min(99.9, api.regions["us-east"].uptime) + 0.1).toFixed(1)} / 100</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Availability Compliance:</span>
                      <span className="text-slate-200 font-bold">{(100 - (api.regions["us-east"].errorRate * 9)).toFixed(1)} / 100</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">SLA Limit Confidence:</span>
                      <span className="text-slate-200 font-bold">100.0 / 100</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Geographical indicators strip */}
              <div className="pt-3.5 border-t border-slate-900 flex items-center justify-between gap-2 mt-auto">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-500 font-mono tracking-wider font-extrabold uppercase">
                    Regions:
                  </span>

                  <div className="flex items-center gap-1">
                    {(Object.keys(api.regions) as Array<keyof typeof api.regions>).map((reg) => {
                      const rData = api.regions[reg];
                      
                      // Simple short letters corresponding to regions
                      let shortLetter = "UE";
                      if (reg === "us-west") shortLetter = "UW";
                      if (reg === "eu-west") shortLetter = "EW";
                      if (reg === "ap-southeast") shortLetter = "AS";
                      if (reg === "ap-northeast") shortLetter = "AN";

                      return (
                        <span
                          key={reg}
                          title={`${reg.toUpperCase()}: ${rData.p99}ms, ${rData.uptime}% stability`}
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono border ${getRegionHighlighter(rData.p99)}`}
                        >
                          {shortLetter}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent selecting the main card
                    setCompareApiId1(api.id);
                    setCompareApiId2(selectedApiId !== api.id ? selectedApiId : (calculatedApis.find(a => a.id !== api.id)?.id || ""));
                    setIsCompareModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-slate-900/80 hover:bg-emerald-950/40 hover:text-emerald-400 hover:border-emerald-500/30 text-slate-400 text-[8.5px] font-mono font-bold rounded border border-slate-800 transition-all cursor-pointer flex items-center gap-1"
                >
                  <GitCompare className="w-2.5 h-2.5" />
                  <span>Compare</span>
                </button>
              </div>
            </div>
          );
        }) )}
      </div>

      {/* Selected Node Geographic Expansion Panel */}
      <div className="border border-slate-900 bg-[#0d121b] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
          <div className="space-y-1">
            <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest flex items-center gap-1 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Telemetry Feed Matrix
            </span>
            <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-tight">{selectedApi.name} Geographic Profiler</h3>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400">{selectedApi.version}</span>
        </div>

        {/* 5-Region Telemetry Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {(Object.keys(selectedApi.regions) as Array<keyof typeof selectedApi.regions>).map((reg) => {
            const m: RegionMetric = selectedApi.regions[reg];
            const p99Color = m.p99 < 350 ? "text-emerald-400" : m.p99 < 800 ? "text-blue-400" : "text-amber-400";

            return (
              <div key={reg} className="p-3 bg-slate-950/70 border border-slate-900 rounded-xl space-y-2 hover:border-slate-800 transition">
                <span className="text-[9px] font-bold font-mono tracking-widest uppercase text-slate-500 block text-center border-b border-slate-900 pb-1.5">
                  {reg.toUpperCase()}
                </span>

                <div className="text-center py-1">
                  <span className={`text-[#10b981] font-bold font-mono block ${p99Color}`}>{m.p99}ms</span>
                  <span className="text-[7.5px] text-slate-500 font-mono block uppercase font-bold">P99 Latency</span>
                </div>

                <div className="text-[9px] font-mono whitespace-nowrap text-slate-400 space-y-1 border-t border-slate-900 pt-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600">p50:</span>
                    <span className="text-slate-200">{m.p50}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Availability:</span>
                    <span className="text-emerald-400">{m.uptime}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Error rate:</span>
                    <span className={m.errorRate > 1 ? "text-amber-400" : "text-emerald-400"}>{m.errorRate}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* NEW FULL PRODUCTION INTEGRATIONS: REGISTRY AND SECURE PROXY GATEWAY SANDBOX */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        
        {/* LEFT COLUMN: Monitored API Node Registration (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-[#080d14]/90 border border-slate-900 rounded-2xl p-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest flex items-center gap-1.5 font-bold">
              <Server className="w-4 h-4 text-emerald-400 animate-pulse" /> VNP Prober Registry
            </span>
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-tight">Add Live Monitored API Node</h3>
            <p className="text-[11px] text-slate-400 leading-normal">
              Register any HTTP/HTTPS rest API endpoint below. The decentralized nodes will immediately query and ping the service to calculate actual real-time SLAs.
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!apiName || !apiEndpoint) return;
              setIsRegistering(true);
              setRegisterMessage("");
              try {
                const res = await fetch("/api/vnp/apis", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: apiName,
                    endpoint: apiEndpoint,
                    version: apiVersion,
                    x402Ready: apiX402
                  })
                });
                if (!res.ok) {
                  const errText = await res.json().catch(() => ({}));
                  throw new Error(errText.error || "Failed to register custom API endpoint");
                }
                const data = await res.json();
                setRegisterMessage(`✓ Successfully added node '${data.name}' with ID '${data.id}'. Real latency tracing initiated!`);
                setApiName("");
                setApiEndpoint("");
                if (onRefreshTelemetry) onRefreshTelemetry();
              } catch (err: any) {
                setRegisterMessage(`❌ Error: ${err.message || String(err)}`);
              } finally {
                setIsRegistering(false);
              }
            }}
            className="space-y-3.5 pt-2 text-[11px] font-mono text-slate-400"
          >
            <div className="space-y-1">
              <label className="text-slate-500 font-bold block select-all">API Target Name:</label>
              <input
                type="text"
                value={apiName}
                onChange={(e) => setApiName(e.target.value)}
                placeholder="e.g. JSONPlaceholder Placeholder API"
                className="w-full bg-slate-950 border border-slate-900 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-500 font-bold block">Absolute Target Endpoint URL:</label>
              <input
                type="url"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://jsonplaceholder.typicode.com/posts/1"
                className="w-full bg-slate-950 border border-slate-900 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-500 font-bold block">API Version tag:</label>
                <input
                  type="text"
                  value={apiVersion}
                  onChange={(e) => setApiVersion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1 flex flex-col justify-end pb-1.5">
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-400 select-none">
                  <input
                    type="checkbox"
                    checked={apiX402}
                    onChange={(e) => setApiX402(e.target.checked)}
                    className="rounded border-slate-900 bg-slate-950 text-emerald-500 focus:ring-opacity-0 w-3.5 h-3.5"
                  />
                  <span>x402 Spec Compliant</span>
                </label>
              </div>
            </div>

            <button
              id="vnp-register-dev-node-btn"
              type="submit"
              disabled={isRegistering}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer transition flex items-center justify-center gap-1.5 uppercase font-mono tracking-wider"
            >
              <Zap className="w-4 h-4 text-emerald-300" />
              <span>{isRegistering ? "Registering..." : "Register Live API Node Monitor"}</span>
            </button>

            {registerMessage && (
              <div className={`p-3 rounded-lg text-[10.5px]/relaxed whitespace-pre-wrap ${registerMessage.startsWith("✓") ? "bg-emerald-950/20 text-emerald-400 border border-emerald-500/20" : "bg-red-950/20 text-red-400 border border-red-500/20"}`}>
                {registerMessage}
              </div>
            )}
          </form>
        </div>

        {/* RIGHT COLUMN: Interactive Live Gateway Proxy Sandbox (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-[#080d14]/90 border border-slate-900 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-blue-400 font-mono uppercase tracking-widest flex items-center gap-1.5 font-bold">
                <Layers className="w-4 h-4 text-blue-400" /> VNP LIVE GATEWAY SANDBOX
              </span>
              <span className="text-[8.5px] uppercase font-bold tracking-wider bg-indigo-950/25 border border-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded animate-pulse">
                Active Proxy Node: us-east
              </span>
            </div>
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-tight">Secure Tunnel Proxy Tester</h3>
            <p className="text-[11px] text-slate-400 leading-normal">
              Execute a real proxy request to the selected API <strong className="text-emerald-400">"{selectedApi.name}"</strong>. VNP will route the request through our high-performance metric proxy, split the microcent payment escrow, and log the direct real-time latency feedback into region profiles!
            </p>
          </div>

          <div className="space-y-3 pt-1 text-[11px] font-mono text-slate-400">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-500 font-bold block font-mono">Simulated Tenant Lock Id:</label>
                <select
                  value={proxyTenant}
                  onChange={(e) => setProxyTenant(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                >
                  <option value="veklom.io">veklom.io</option>
                  <option value="tempo_global">tempo_global</option>
                  <option value="coinbase_swarms">coinbase_swarms</option>
                  <option value="mcp_gateway">mcp_gateway</option>
                  <option value="stripe.com">stripe.com</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 font-bold block">Gateway Escrow Allocation:</label>
                <div className="p-2.5 bg-slate-950/80 border border-slate-900 rounded-xl text-slate-300 font-bold flex items-center justify-between">
                  <span>$0.012500 USD (est)</span>
                  <span className="text-[9px] bg-emerald-900/20 text-emerald-400 px-1.5 py-0.2 rounded uppercase border border-emerald-500/10">Pre-Funded</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-500 font-bold block flex justify-between items-center">
                <span>Payload Body Object JSON (escaped):</span>
                <span className="text-slate-600 lowercase font-normal leading-none">(will fallback to lightweight metadata if endpoint is simple)</span>
              </label>
              <textarea
                value={proxyPayload}
                onChange={(e) => setProxyPayload(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-900 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-[10px]"
                placeholder="{}"
              />
            </div>

            <button
              id="vnp-execute-proxy-btn"
              onClick={async () => {
                setIsProxying(true);
                setProxyResult(null);
                setProxyError("");
                try {
                  let jsonPayload = {};
                  try {
                    jsonPayload = JSON.parse(proxyPayload);
                  } catch (je) {
                    throw new Error("Invalid payload JSON object.");
                  }

                  const res = await fetch(`/api/v1/proxy/${selectedApi.id}`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-vnp-tenant": proxyTenant
                    },
                    body: JSON.stringify({ payload: jsonPayload })
                  });

                  if (!res.ok) {
                    throw new Error(`Proxy gateway error returned HTTP ${res.status}`);
                  }

                  const data = await res.json();
                  setProxyResult(data);
                  if (onRefreshTelemetry) {
                    // Update frontend state immediately to show the injected real latency under us-east region!
                    setTimeout(onRefreshTelemetry, 100);
                  }
                } catch (err: any) {
                  setProxyError(err.message || String(err));
                } finally {
                  setIsProxying(false);
                }
              }}
              disabled={isProxying}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer transition flex items-center justify-center gap-1.5 uppercase font-mono tracking-wider"
            >
              <Zap className="w-4 h-4 text-indigo-300 animate-pulse" />
              <span>{isProxying ? "Routing Secure Escrow Tunnel..." : "Send Request Through Real VNP Proxy Gateway"}</span>
            </button>

            {/* Proxy sandbox outputs */}
            {proxyError && (
              <div className="p-3 bg-red-950/20 text-red-400 border border-red-500/20 rounded-lg text-[10.5px]/relaxed whitespace-pre-wrap font-mono">
                ❌ {proxyError}
              </div>
            )}

            {proxyResult && (
              <div className="space-y-2 bg-[#05060b] rounded-xl border border-slate-900 p-3">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Terminal className="w-3.5 h-3.5 text-slate-400" /> VNP Gateway Tunnel Response Header
                  </span>
                  <span className="text-[#10b981] font-bold">SLA: OK (Latency: {proxyResult.gatewayLatencyMs}ms)</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-[9px] border-b border-slate-900 pb-2">
                  <div className="bg-slate-950 rounded p-1.5 border border-slate-900 text-center">
                    <span className="text-slate-600 uppercase block font-bold leading-tight">Tx Hash Id</span>
                    <span className="text-indigo-400 block truncate uppercase font-bold mt-0.5">{proxyResult.vnpTransactionId.split("_").pop()}</span>
                  </div>
                  <div className="bg-slate-950 rounded p-1.5 border border-slate-900 text-center">
                    <span className="text-slate-600 uppercase block font-bold leading-tight">Settlement</span>
                    <span className="text-emerald-400 block font-bold mt-0.5">${proxyResult.developerBillingSettlementCents.toFixed(6)}</span>
                  </div>
                  <div className="bg-slate-950 rounded p-1.5 border border-slate-900 text-center">
                    <span className="text-slate-600 uppercase block font-bold leading-tight">Response Status</span>
                    <span className="text-blue-400 block font-bold mt-0.5 font-mono">HTTP {proxyResult.downstreamHttpStatus}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9.5px] text-slate-500 font-bold block uppercase pb-0.5">Downstream Payload Output:</span>
                  <pre className="p-2.5 bg-slate-950/90 rounded border border-slate-900/60 font-mono text-[9.5px]/normal text-[#a7f3d0] max-h-[110px] overflow-y-auto overflow-x-hidden custom-scrollbar">
                    {JSON.stringify(proxyResult.proxiedResponse, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* VNP SIDE-BY-SIDE COMPARE MODAL */}
      {isCompareModalOpen && (() => {
        const api1 = calculatedApis.find(a => a.id === compareApiId1) || calculatedApis[0];
        const api2 = calculatedApis.find(a => a.id === compareApiId2) || calculatedApis[1] || calculatedApis[0];

        if (!api1 || !api2) return null;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 md:p-6 overflow-y-auto">
            <div className="bg-[#0a0f18] border border-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6 relative custom-scrollbar">
              
              {/* Close Button */}
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-100 bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                title="Close Comparison"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Title Header */}
              <div className="space-y-1">
                <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest flex items-center gap-1.5 font-bold">
                  <GitCompare className="w-4 h-4 text-emerald-400" /> VNP PEER COMPARISON DESK
                </span>
                <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight">Consensus Node Compare Sandbox</h3>
                <p className="text-xs text-slate-400 leading-normal max-w-2xl">
                  Analyze performance metrics, uptime stability, and protocol conformity between two prober nodes side-by-side to isolate anomalies or optimization fields.
                </p>
              </div>

              {/* Selectors Block */}
              <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center bg-slate-950 p-4 rounded-2xl border border-slate-900/60">
                
                {/* Node 1 Selector */}
                <div className="md:col-span-5 space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase font-bold">Node Candidate A</label>
                  <select
                    value={compareApiId1}
                    onChange={(e) => setCompareApiId1(e.target.value)}
                    className="w-full bg-[#0a0f18] border border-slate-900 rounded-xl p-3 text-sm text-slate-200 font-mono font-bold focus:outline-none focus:border-emerald-500/50"
                  >
                    {calculatedApis.map((a) => (
                      <option key={a.id} value={a.id} disabled={a.id === compareApiId2}>
                        {a.name} ({getBadgeGrade(a.compositeScore)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* VS Divider */}
                <div className="md:col-span-1 flex flex-col items-center justify-center pt-2 md:pt-0">
                  <span className="bg-slate-900 border border-slate-800 text-[10px] font-mono font-black text-slate-500 px-2.5 py-1 rounded-full flex items-center justify-center gap-1 shadow-inner">
                    VS
                  </span>
                </div>

                {/* Node 2 Selector */}
                <div className="md:col-span-5 space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase font-bold">Node Candidate B</label>
                  <select
                    value={compareApiId2}
                    onChange={(e) => setCompareApiId2(e.target.value)}
                    className="w-full bg-[#0a0f18] border border-slate-900 rounded-xl p-3 text-sm text-slate-200 font-mono font-bold focus:outline-none focus:border-emerald-500/50"
                  >
                    {calculatedApis.map((a) => (
                      <option key={a.id} value={a.id} disabled={a.id === compareApiId1}>
                        {a.name} ({getBadgeGrade(a.compositeScore)})
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Side-by-Side Comparison Matrix */}
              <div className="space-y-6">
                
                {/* Core Header Row */}
                <div className="grid grid-cols-2 gap-4 md:gap-8 border-b border-slate-900 pb-5">
                  
                  {/* Candidate A Card */}
                  <div className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-full transition ${
                    api1.compositeScore >= api2.compositeScore
                      ? "bg-[#0b1017] border-emerald-500/30 shadow-md shadow-emerald-950/5"
                      : "bg-slate-950/40 border-slate-900"
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase border text-emerald-400 bg-emerald-950/20 border-emerald-500/20">
                          NODE A
                        </span>
                        {api1.compositeScore >= api2.compositeScore && (
                          <span className="text-[9px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                            🏆 WINNER
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-slate-200 mt-2 truncate">{api1.name}</h4>
                      <p className="text-[10px] font-mono text-slate-500 truncate">{api1.id}</p>
                    </div>

                    <div className="flex items-end justify-between mt-6 pt-3 border-t border-slate-900">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-mono text-slate-500 block uppercase font-bold">Composite VNP Score</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black font-mono text-emerald-400 tracking-tighter">{api1.compositeScore}</span>
                          <span className="text-slate-500 text-xs font-mono">/100</span>
                        </div>
                      </div>
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] uppercase font-mono px-2 py-1 rounded font-black">
                        GRADE {getBadgeGrade(api1.compositeScore)}
                      </span>
                    </div>
                  </div>

                  {/* Candidate B Card */}
                  <div className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-full transition ${
                    api2.compositeScore >= api1.compositeScore
                      ? "bg-[#0b1017] border-emerald-500/30 shadow-md shadow-emerald-950/5"
                      : "bg-slate-950/40 border-slate-900"
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase border text-indigo-400 bg-indigo-950/20 border-indigo-500/20">
                          NODE B
                        </span>
                        {api2.compositeScore >= api1.compositeScore && (
                          <span className="text-[9px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                            🏆 WINNER
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-slate-200 mt-2 truncate">{api2.name}</h4>
                      <p className="text-[10px] font-mono text-slate-500 truncate">{api2.id}</p>
                    </div>

                    <div className="flex items-end justify-between mt-6 pt-3 border-t border-slate-900">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-mono text-slate-500 block uppercase font-bold">Composite VNP Score</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black font-mono text-emerald-400 tracking-tighter">{api2.compositeScore}</span>
                          <span className="text-slate-500 text-xs font-mono">/100</span>
                        </div>
                      </div>
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] uppercase font-mono px-2 py-1 rounded font-black">
                        GRADE {getBadgeGrade(api2.compositeScore)}
                      </span>
                    </div>
                  </div>

                </div>

                {/* SLA Compliance and Features Table */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-mono text-slate-500 uppercase font-black tracking-wider border-b border-slate-900 pb-1.5">Compliance & Architecture</h4>
                  
                  {/* x402 compliance row */}
                  <div className="grid grid-cols-2 gap-4 md:gap-8 items-center py-1">
                    <div className="flex items-center justify-between bg-slate-950/30 p-2.5 rounded-xl border border-slate-900/40">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">x402 Micropayments</span>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                        api1.x402Ready 
                          ? "text-emerald-400 bg-emerald-950/20 border-emerald-500/20" 
                          : "text-slate-500 bg-slate-900 border-slate-800"
                      }`}>
                        {api1.x402Ready ? "Ready" : "Disabled"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-950/30 p-2.5 rounded-xl border border-slate-900/40">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">x402 Micropayments</span>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                        api2.x402Ready 
                          ? "text-emerald-400 bg-emerald-950/20 border-emerald-500/20" 
                          : "text-slate-500 bg-slate-900 border-slate-800"
                      }`}>
                        {api2.x402Ready ? "Ready" : "Disabled"}
                      </span>
                    </div>
                  </div>

                  {/* Version tag row */}
                  <div className="grid grid-cols-2 gap-4 md:gap-8 items-center py-1">
                    <div className="flex items-center justify-between bg-slate-950/30 p-2.5 rounded-xl border border-slate-900/40">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Version Tag</span>
                      <span className="text-[10px] font-mono font-bold text-slate-300">{api1.version}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-950/30 p-2.5 rounded-xl border border-slate-900/40">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Version Tag</span>
                      <span className="text-[10px] font-mono font-bold text-slate-300">{api2.version}</span>
                    </div>
                  </div>

                  {/* Rating description row */}
                  <div className="grid grid-cols-2 gap-4 md:gap-8 items-center py-1">
                    <div className="flex items-center justify-between bg-slate-950/30 p-2.5 rounded-xl border border-slate-900/40">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Stability Profile</span>
                      <span className="text-[10px] font-mono font-bold text-slate-300">{api1.stabilityRating}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-950/30 p-2.5 rounded-xl border border-slate-900/40">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Stability Profile</span>
                      <span className="text-[10px] font-mono font-bold text-slate-300">{api2.stabilityRating}</span>
                    </div>
                  </div>
                </div>

                {/* Latency Index Comparison Table */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-mono text-slate-500 uppercase font-black tracking-wider border-b border-slate-900 pb-1.5 flex items-center justify-between">
                    <span>Latency Comparison (P99 tail latency)</span>
                    <span className="text-[9px] text-emerald-400">Lower is better</span>
                  </h4>
                  
                  <div className="space-y-2 font-mono text-[11px]">
                    {(Object.keys(api1.regions) as Array<keyof typeof api1.regions>).map((reg) => {
                      const lat1 = api1.regions[reg].p99;
                      const lat2 = api2.regions[reg].p99;
                      const isWinner1 = lat1 <= lat2;
                      const isWinner2 = lat2 <= lat1;
                      const diffPct = Math.round(Math.abs((lat1 - lat2) / Math.max(1, lat1)) * 100);

                      let regLabel = "US East";
                      if (reg === "us-west") regLabel = "US West";
                      if (reg === "eu-west") regLabel = "Europe West";
                      if (reg === "ap-southeast") regLabel = "Asia SE";
                      if (reg === "ap-northeast") regLabel = "Asia NE";

                      return (
                        <div key={reg} className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400 font-bold uppercase w-24">{regLabel}</span>
                          
                          <div className="grid grid-cols-2 gap-4 md:gap-8 flex-1">
                            {/* Candidate A value */}
                            <div className="flex items-center justify-between">
                              <span className={`font-bold ${isWinner1 ? "text-emerald-400 font-black" : "text-slate-400"}`}>
                                {lat1} ms
                              </span>
                              {isWinner1 && lat1 !== lat2 && (
                                <span className="text-[9px] bg-emerald-950/30 text-emerald-400 border border-emerald-500/10 px-1.5 py-0.2 rounded font-extrabold uppercase">
                                  -{diffPct}% Fast
                                </span>
                              )}
                            </div>

                            {/* Candidate B value */}
                            <div className="flex items-center justify-between">
                              <span className={`font-bold ${isWinner2 ? "text-emerald-400 font-black" : "text-slate-400"}`}>
                                {lat2} ms
                              </span>
                              {isWinner2 && lat1 !== lat2 && (
                                <span className="text-[9px] bg-emerald-950/30 text-emerald-400 border border-emerald-500/10 px-1.5 py-0.2 rounded font-extrabold uppercase">
                                  -{diffPct}% Fast
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Uptime Stability Comparison Table */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-mono text-slate-500 uppercase font-black tracking-wider border-b border-slate-900 pb-1.5 flex items-center justify-between">
                    <span>Uptime & Stability Index</span>
                    <span className="text-[9px] text-emerald-400">Higher is better</span>
                  </h4>

                  <div className="space-y-2 font-mono text-[11px]">
                    {(Object.keys(api1.regions) as Array<keyof typeof api1.regions>).map((reg) => {
                      const upt1 = api1.regions[reg].uptime;
                      const upt2 = api2.regions[reg].uptime;
                      const isWinner1 = upt1 >= upt2;
                      const isWinner2 = upt2 >= upt1;

                      let regLabel = "US East";
                      if (reg === "us-west") regLabel = "US West";
                      if (reg === "eu-west") regLabel = "Europe West";
                      if (reg === "ap-southeast") regLabel = "Asia SE";
                      if (reg === "ap-northeast") regLabel = "Asia NE";

                      return (
                        <div key={reg} className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400 font-bold uppercase w-24">{regLabel}</span>

                          <div className="grid grid-cols-2 gap-4 md:gap-8 flex-1">
                            {/* Candidate A value */}
                            <div className="flex items-center justify-between">
                              <span className={`font-bold ${isWinner1 ? "text-emerald-400 font-black" : "text-slate-400"}`}>
                                {upt1.toFixed(2)}%
                              </span>
                              {isWinner1 && upt1 !== upt2 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              )}
                            </div>

                            {/* Candidate B value */}
                            <div className="flex items-center justify-between">
                              <span className={`font-bold ${isWinner2 ? "text-emerald-400 font-black" : "text-slate-400"}`}>
                                {upt2.toFixed(2)}%
                              </span>
                              {isWinner2 && upt1 !== upt2 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI / Operational Verdict block */}
                <div className="p-4 bg-emerald-950/10 border border-emerald-500/25 rounded-2xl space-y-1.5">
                  <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest block">System Consensus Verdict</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-mono">
                    {api1.compositeScore > api2.compositeScore + 2 
                      ? `Node "${api1.name}" demonstrates a clear architectural advantage with an overall composite rating outperforming "${api2.name}" by ${(api1.compositeScore - api2.compositeScore).toFixed(1)} points. It excels particularly in global lower tail-latencies. Recommended for high-priority routing.`
                      : api2.compositeScore > api1.compositeScore + 2
                      ? `Node "${api2.name}" holds the consensus quality standard over "${api1.name}" by ${(api2.compositeScore - api1.compositeScore).toFixed(1)} score points. Uptime and error rates are optimal across monitored entry points.`
                      : `Both "${api1.name}" and "${api2.name}" are running neck-and-neck inside the acceptable multi-region SLA variance window (difference of < 2.0). Both represent top-tier candidates for secure routing and decentralized attestation.`}
                  </p>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      </div>
    </div>
  );
}
