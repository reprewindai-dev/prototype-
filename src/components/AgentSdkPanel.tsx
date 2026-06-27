import React, { useState, useEffect } from "react";
import { 
  Terminal, 
  Play, 
  Check, 
  Copy, 
  Sliders, 
  Cpu, 
  Code, 
  Zap, 
  Download, 
  BookOpen, 
  RefreshCw, 
  Layers, 
  FileCode,
  Shield,
  HelpCircle,
  FileCheck,
  Award,
  AlertTriangle,
  Clock,
  ExternalLink,
  Lock,
  Globe,
  Compass,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  GitPullRequest
} from "lucide-react";

export default function AgentSdkPanel() {
  const [activeSubTab, setActiveSubTab] = useState<"sdk" | "provider" | "badges" | "dispute">("sdk");
  const [useCase, setUseCase] = useState("image_generation");
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>(["openai", "anthropic", "together"]);
  const [constraint, setConstraint] = useState("latency < 500ms");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // SDK Code Language toggle
  const [sdkLanguage, setSdkLanguage] = useState<"python" | "typescript">("python");

  // Simulation terminal States
  const [simulating, setSimulating] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [resultJson, setResultJson] = useState<any>(null);
  const [simStep, setSimStep] = useState(0);

  // Provider Hub States
  const [selectedProviderApi, setSelectedProviderApi] = useState("openai");
  const [verificationCode] = useState("vnp-verification-6c9f82d1ab3e46c7b952a1");
  const [dnsStatus, setDnsStatus] = useState<"unclaimed" | "checking" | "verified">("unclaimed");
  const [claimProgress, setClaimProgress] = useState(0);
  
  // Explainability sliders for selected provider
  const [providerLatency, setProviderLatency] = useState(148);
  const [providerErrorRate, setProviderErrorRate] = useState(0.13);
  const [providerSecCompliance, setProviderSecCompliance] = useState(94);
  const [providerDxScore, setProviderDxScore] = useState(88);
  
  // Conformance Badge states
  const [badgeApi, setBadgeApi] = useState("anthropic");

  // Dispute States
  const [disputeApi, setDisputeApi] = useState("together");
  const [disputedMetrics, setDisputedMetrics] = useState("P99 Latency anomaly in us-west-2 on 2026-06-27");
  const [disputeLogs, setDisputeLogs] = useState<any[]>([
    { id: 1, time: "2026-06-27T12:00:00Z", api: "cohere", type: "Tier 1 SLA check", msg: "Dispute lodged: Latency spike dispute.", status: "RESOLVED_AUTO", sla: "00:00:00" },
    { id: 2, time: "2026-06-27T14:15:32Z", api: "together", type: "Tier 2 Telemetry check", msg: "Awaiting multi-region probe consensus.", status: "PENDING_AUDIT", sla: "22:18:14" }
  ]);
  const [isLodging, setIsLodging] = useState(false);

  // SLA Countdown Simulation (decrement seconds for pending logs)
  const [slaTime, setSlaTime] = useState(80294); // ~22 hours 18 mins

  useEffect(() => {
    const interval = setInterval(() => {
      setSlaTime(prev => {
        if (prev <= 0) return 86400; // Reset
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatSla = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const pythonCode = `"""
VNP Agent SDK - Python
=====================

One-line API selection for LLM agents.

INSTALL:
  pip install vnp-sdk

USAGE:
  from vnp import APISelector
  
  selector = APISelector()
  best = selector.select(
      use_case="image_generation",
      candidates=["openai", "anthropic", "together"],
      constraint="latency < 500ms"
  )
  # {"api": "anthropic", "score": 89.2, "confidence": 95.8, "uri": "https://api.anthropic.com"}
  
  # Use the best API
  response = requests.post(
      f"https://{best['uri']}",
      json={"prompt": "..."}
  )

FEATURES:
  - Real-time VNP scoring
  - Latency constraints
  - Cost-based selection
  - Regional preferences
  - Fallback chains
  - Caching (5-minute TTL)
  - Type hints (Python 3.9+)
"""

import asyncio
import hashlib
import json
import logging
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from enum import Enum

import aiohttp
import requests
from cachetools import TTLCache

logger = logging.getLogger("vnp")

# ============================================================================
# CONFIGURATION
# ============================================================================

VNP_API_URL = "https://api.vnp.io"
VNP_GRAPHQL_URL = f"{VNP_API_URL}/graphql"
CACHE_TTL_SECONDS = 300  # 5 minutes


class UseCase(Enum):
    IMAGE_GENERATION = "image_generation"
    TEXT_GENERATION = "text_generation"
    TEXT_EMBEDDING = "text_embedding"
    SPEECH_TO_TEXT = "speech_to_text"
    TEXT_TO_SPEECH = "text_to_speech"
    TRANSLATION = "translation"
    PAYMENT_PROCESSING = "payment_processing"
    DATA_VALIDATION = "data_validation"
    CUSTOM = "custom"


# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class VNPScore:
    api_id: str
    api_name: str
    composite_score: float
    confidence_interval_95: Tuple[float, float]
    p99_latency_ms: float
    error_rate_pct: float
    availability_pct: float
    throughput_rps: float
    regional_scores: Dict[str, float]
    measurement_count: int
    last_updated: str
    vnp_uri: str


@dataclass
class APISelection:
    api: str
    score: float
    confidence: float
    p99_latency_ms: float
    error_rate_pct: float
    availability_pct: float
    uri: str
    reason: str
    alternatives: List[Dict]
    selected_at: str


# ============================================================================
# VNP API CLIENT & SELECTOR
# ============================================================================

class VNPClient:
    def __init__(self, api_url: str = VNP_API_URL, cache_ttl: int = CACHE_TTL_SECONDS):
        self.api_url = api_url
        self.graphql_url = f"{api_url}/graphql"
        self.cache = TTLCache(maxsize=1000, ttl=cache_ttl)
        self.session = None
    
    async def get_score(self, api_id: str) -> Optional[VNPScore]:
        # Implementation checks cache then fetches GraphQL score endpoint...
        pass
`;

  const tsCode = `/**
 * VNP Agent SDK - JavaScript/TypeScript
 * 
 * One-line API selection for LLM agents and applications.
 * 
 * INSTALL:
 *   npm install @vnp/sdk
 * 
 * USAGE:
 *   import { selectBestAPI } from '@vnp/sdk';
 *   
 *   const best = await selectBestAPI({
 *     candidates: ['openai', 'anthropic', 'together'],
 *     constraint: 'latency < 500ms'
 *   });
 */

export enum UseCase {
  IMAGE_GENERATION = 'image_generation',
  TEXT_GENERATION = 'text_generation',
  TEXT_EMBEDDING = 'text_embedding',
  SPEECH_TO_TEXT = 'speech_to_text',
  TEXT_TO_SPEECH = 'text_to_speech',
  TRANSLATION = 'translation',
  PAYMENT_PROCESSING = 'payment_processing',
}

export interface VNPScore {
  apiId: string;
  apiName: string;
  compositeScore: number;
  confidenceInterval95: [number, number];
  p99LatencyMs: number;
  errorRatePct: number;
  availabilityPct: number;
  throughputRps: number;
  regionalScores: Record<string, number>;
  measurementCount: number;
  lastUpdated: string;
  vnpUri: string;
}

export interface APISelection {
  api: string;
  score: number;
  confidence: number;
  p99LatencyMs: number;
  errorRatePct: number;
  availabilityPct: number;
  uri: string;
  reason: string;
  alternatives: Array<{
    api: string;
    score: number;
    confidence: number;
  }>;
  selectedAt: string;
}

export interface SelectOptions {
  candidates: string[];
  useCase?: UseCase;
  constraint?: string;
  region?: string;
  preferCostEfficient?: boolean;
  fallbackChain?: number;
}

export class APISelector {
  private apiEndpoints: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    together: 'https://api.together.xyz/v1',
    groq: 'https://api.groq.com/v1',
    stripe: 'https://api.stripe.com/v1',
  };

  async select(options: SelectOptions): Promise<APISelection> {
    // Normalizes candidate names to VNP did:vnp:api:...
    // Fetches multi-region telemetry from high-performance cache.
    // Automatically solves routing constraints & fallback thresholds.
  }
}
`;

  const availableCandidates = [
    { id: "openai", name: "OpenAI GPT-4o", defaultScore: 89.4, latency: 148, err: 0.13, avail: 99.60, url: "https://api.openai.com/v1", fips: true, tls: "1.3" },
    { id: "anthropic", name: "Anthropic Claude 3.5 Sonnet", defaultScore: 92.1, latency: 104.9, err: 0.10, avail: 99.90, url: "https://api.anthropic.com/v1", fips: true, tls: "1.3" },
    { id: "together", name: "Together.ai (Llama-3-70B)", defaultScore: 86.8, latency: 237.9, err: 0.13, avail: 99.62, url: "https://api.together.xyz/v1", fips: false, tls: "1.3" },
    { id: "groq", name: "Groq Llama-3-70B-Instant", defaultScore: 88.3, latency: 45.0, err: 0.07, avail: 99.67, url: "https://api.groq.com/v1", fips: false, tls: "1.3" },
    { id: "stripe", name: "Stripe Payment MPP Hub", defaultScore: 95.8, latency: 68.1, err: 0.00, avail: 99.98, url: "https://api.stripe.com/v1", fips: true, tls: "1.3" },
    { id: "cohere", name: "Cohere Command R+", defaultScore: 85.2, latency: 412.1, err: 0.05, avail: 99.92, url: "https://api.cohere.ai", fips: false, tls: "1.2" },
  ];

  // Load selected provider settings
  useEffect(() => {
    const api = availableCandidates.find(c => c.id === selectedProviderApi);
    if (api) {
      setProviderLatency(api.latency);
      setProviderErrorRate(api.err);
      setProviderSecCompliance(api.fips ? 98 : 82);
      setProviderDxScore(Math.floor(api.defaultScore + (Math.random() * 4 - 2)));
    }
  }, [selectedProviderApi]);

  // Calculate simulated VNP score based on explainability sliders
  const getSimulatedScore = () => {
    // Latency weight (40%)
    const lScore = Math.max(0, 100 - (providerLatency / 5));
    // Error rate weight (25%)
    const eScore = Math.max(0, 100 - (providerErrorRate * 120));
    // Security compliance (15%)
    const sScore = providerSecCompliance;
    // DX/TTFC (20%)
    const dScore = providerDxScore;

    const composite = (lScore * 0.40) + (eScore * 0.25) + (sScore * 0.15) + (dScore * 0.20);
    return parseFloat(composite.toFixed(1));
  };

  const simScore = getSimulatedScore();
  const certTier = simScore >= 85 ? "Gold" : simScore >= 75 ? "Silver" : simScore >= 65 ? "Bronze" : "Measured";
  const certColor = simScore >= 85 ? "text-amber-400" : simScore >= 75 ? "text-slate-300" : simScore >= 65 ? "text-orange-400" : "text-slate-500";
  const badgeBg = simScore >= 85 ? "bg-amber-500/10 border-amber-500/40" : simScore >= 75 ? "bg-slate-500/10 border-slate-500/40" : "bg-orange-500/10 border-orange-500/40";

  const handleToggleCandidate = (id: string) => {
    setSelectedCandidates(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const runSimulation = () => {
    if (simulating) return;
    setSimulating(true);
    setTerminalLogs([]);
    setResultJson(null);
    setSimStep(0);

    const isPy = sdkLanguage === "python";
    const startCmd = isPy ? ">>> python run_vnp_selector.py" : ">>> node run_vnp_selector.js";
    const initMsg = isPy 
      ? "[VNP Python SDK] Initializing APISelector on mainnet (v1.0.0)..." 
      : "[VNP TS SDK] Initializing APISelector instance (v1.0.0)...";

    const steps = [
      { text: startCmd, delay: 0 },
      { text: initMsg, delay: 400 },
      { text: `[VNP SDK] Configuration: use_case='${useCase}', constraint='${constraint}'`, delay: 900 },
      { text: `[VNP SDK] Scanning VNP telemetry scores for candidates: ${selectedCandidates.join(", ")}`, delay: 1400 },
      { text: "[VNP SDK] Connecting to VNP Ledger gateway for live multi-region proof data...", delay: 2000 },
      { text: "[VNP SDK] Resolving optimal node by trust-weight composite equations...", delay: 2600 },
    ];

    let activeList = availableCandidates.filter(c => selectedCandidates.includes(c.id));
    
    let passedList = [...activeList];
    if (constraint.includes("latency")) {
      const maxL = parseFloat(constraint.replace(/[^0-9.]/g, "")) || 500;
      passedList = activeList.filter(c => c.latency < maxL);
    } else if (constraint.includes("error_rate")) {
      const maxE = parseFloat(constraint.replace(/[^0-9.]/g, "")) || 1.0;
      passedList = activeList.filter(c => c.err < maxE);
    } else if (constraint.includes("availability")) {
      const minA = parseFloat(constraint.replace(/[^0-9.]/g, "")) || 99.5;
      passedList = activeList.filter(c => c.avail >= minA);
    }

    if (passedList.length === 0) {
      steps.push({ text: `⚠️ [VNP SDK] Warning: No candidates passed constraint '${constraint}'. Falling back to best unconstrained.`, delay: 3100 });
      passedList = [...activeList];
    }

    passedList.sort((a, b) => b.defaultScore - a.defaultScore);
    const winner = passedList[0] || availableCandidates[0];

    const alternatives = activeList
      .filter(c => c.id !== winner.id)
      .map(c => ({
        api: c.id,
        score: c.defaultScore,
        confidence: parseFloat((93.5 + Math.random() * 4).toFixed(1))
      }));

    const finalSelection = {
      api: winner.id,
      score: winner.defaultScore,
      confidence: parseFloat((94.0 + Math.random() * 4.5).toFixed(1)),
      p99_latency_ms: winner.latency,
      error_rate_pct: winner.err,
      availability_pct: winner.avail,
      uri: winner.url,
      reason: `Best VNP score (${winner.defaultScore}) with 916,435 live multi-regional measurements`,
      alternatives: alternatives.slice(0, 2),
      selected_at: new Date().toISOString(),
    };

    steps.push({ text: `[VNP SDK] Selected best node: ${winner.name} (Score: ${winner.defaultScore})`, delay: 3400 });
    steps.push({ text: `[VNP SDK] Active redirect payload shunted safely inside local container. Decided in 82.4ms.`, delay: 3800 });

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setTerminalLogs(prev => [...prev, step.text]);
        setSimStep(idx);
        if (idx === steps.length - 1) {
          setResultJson(finalSelection);
          setSimulating(false);
        }
      }, step.delay);
    });
  };

  const handleClaimApi = () => {
    if (dnsStatus !== "unclaimed") return;
    setDnsStatus("checking");
    setClaimProgress(0);

    const interval = setInterval(() => {
      setClaimProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setDnsStatus("verified");
          return 100;
        }
        return prev + 20;
      });
    }, 300);
  };

  const triggerDownload = () => {
    const code = sdkLanguage === "python" ? pythonCode : tsCode;
    const filename = sdkLanguage === "python" ? "vnp_sdk.py" : "vnp_sdk.ts";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLodgeDispute = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLodging(true);

    setTimeout(() => {
      const newDispute = {
        id: Date.now(),
        time: new Date().toISOString(),
        api: disputeApi,
        type: "Tier 1 SLA check",
        msg: disputedMetrics,
        status: "PENDING_AUDIT",
        sla: "23:59:59"
      };
      setDisputeLogs(prev => [newDispute, ...prev]);
      setIsLodging(false);
      setDisputedMetrics("");
    }, 1200);
  };

  // Get active badge info based on selection
  const currentBadgeApi = availableCandidates.find(c => c.id === badgeApi) || availableCandidates[0];
  const badgeScore = currentBadgeApi.defaultScore;
  const badgeTier = badgeScore >= 85 ? "Gold" : badgeScore >= 75 ? "Silver" : "Bronze";
  const badgeColorHex = badgeScore >= 85 ? "#FFD700" : badgeScore >= 75 ? "#C0C0C0" : "#CD7F32";

  const badgeMarkdownCode = `[![VNP Certified](https://vnp.io/v1/badge/${currentBadgeApi.id}.svg)](https://vnp.io/provider/${currentBadgeApi.id})`;
  const badgeHtmlCode = `<a href="https://vnp.io/provider/${currentBadgeApi.id}">\n  <img src="https://vnp.io/v1/badge/${currentBadgeApi.id}.svg" alt="VNP ${badgeTier} Certified" />\n</a>`;

  return (
    <div id="vnp-developer-portal" className="space-y-6">
      
      {/* Upper Navigation/Control Hub header bar */}
      <div className="bg-[#0b1017] border border-slate-900 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-indigo-700 flex items-center justify-center text-white font-black font-mono">
            V
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-200 uppercase tracking-tight">Veklom Developer & Provider Operations Hub</h2>
            <p className="text-[10px] text-slate-400 font-mono">Unified ecosystem for multi-agent routing, compliance, and badge certification</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-900 w-full md:w-auto overflow-x-auto">
          {[
            { id: "sdk", label: "Agent SDK & Simulation", icon: Terminal },
            { id: "provider", label: "Provider Suite & Explainability", icon: Sliders },
            { id: "badges", label: "Conformance Badges", icon: Award },
            { id: "dispute", label: "Dispute Center", icon: Shield }
          ].map(t => {
            const Icon = t.icon;
            const active = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveSubTab(t.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10.5px] font-mono font-bold transition cursor-pointer select-none whitespace-nowrap ${
                  active 
                    ? "bg-[#121822] text-amber-400 border border-amber-500/20" 
                    : "text-slate-500 hover:text-slate-300 border border-transparent"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-amber-400" : "text-slate-500"}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-TAB VIEWPORT 1: Agent SDK & Playground */}
      {activeSubTab === "sdk" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Interactive Simulator Controller & Terminal - col-span 6 */}
          <div className="lg:col-span-6 space-y-5">
            <div className="bg-[#0b1017] border border-slate-900 rounded-2xl p-5 space-y-5">
              <div className="flex items-center gap-1.5 border-b border-slate-900 pb-3">
                <Sliders className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Agent SDK Selection Simulator
                </h3>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed pl-0.5">
                Test the VNP Agent SDK locally inside our sandbox playground. Customize the agent's target use case, supply candidate providers, impose real-time constraints, and run the selector to see instant, validated routing telemetry.
              </p>

              <div className="space-y-4 text-xs">
                {/* Use Case Select */}
                <div className="space-y-1">
                  <label className="text-slate-400 font-mono text-[10px] uppercase font-bold">Use Case Domain Context:</label>
                  <select
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none focus:border-amber-500/80 font-mono text-[11px]"
                  >
                    <option value="image_generation">image_generation (Stable Diffusion / Dall-E)</option>
                    <option value="text_generation">text_generation (LLM Text & Chat)</option>
                    <option value="text_embedding">text_embedding (Vector Embeddings)</option>
                    <option value="translation">translation (Multi-language localization)</option>
                    <option value="payment_processing">payment_processing (Escrow & Settlement)</option>
                  </select>
                </div>

                {/* Candidates Pill List */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-mono text-[10px] uppercase font-bold block">Candidate Router Targets:</label>
                  <div className="flex flex-wrap gap-2">
                    {availableCandidates.map(c => {
                      const isSelected = selectedCandidates.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleToggleCandidate(c.id)}
                          className={`px-3 py-1.5 rounded-lg border text-[10.5px] font-mono font-semibold transition cursor-pointer select-none ${
                            isSelected 
                              ? "bg-amber-500/10 border-amber-500/40 text-amber-400 font-extrabold"
                              : "bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {c.id}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Constraint Input & Presets */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-mono text-[10px] uppercase font-bold">Active SLA Constraints:</label>
                  <input
                    type="text"
                    value={constraint}
                    onChange={(e) => setConstraint(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none focus:border-amber-500/80 font-mono text-[11px]"
                    placeholder="e.g. latency < 500ms"
                  />
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {["latency < 150ms", "latency < 300ms", "error_rate < 0.1%", "availability > 99.8%", "No Constraints"].map(p => (
                      <button
                        key={p}
                        onClick={() => setConstraint(p === "No Constraints" ? "" : p)}
                        className="text-[9px] font-mono bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 rounded px-1.5 py-0.5 cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ingestion load trigger button */}
                <button
                  onClick={runSimulation}
                  disabled={simulating}
                  className="w-full py-2.5 bg-gradient-to-tr from-amber-600 to-indigo-700 hover:from-amber-500 hover:to-indigo-600 disabled:opacity-40 text-white rounded-xl text-xs font-black transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-950/20 cursor-pointer select-none"
                >
                  {simulating ? (
                    <>
                      <RefreshCw className="w-4 h-4 text-amber-300 animate-spin" />
                      <span>SIMULATING SELECTOR ROUTE...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 animate-pulse" />
                      <span>RUN AGENT SELECTION SESSION</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Terminal Console Log View */}
            <div className="bg-[#050811] border border-slate-900 rounded-2xl p-4 flex flex-col justify-between h-[285px] font-mono text-[11px]">
              <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-500" /> Virtualenv sandbox Terminal
                </span>
                <div className="flex-1 bg-black p-3 rounded-xl overflow-y-auto font-mono text-[9.5px]/relaxed text-emerald-400 space-y-1 select-text custom-scrollbar">
                  {terminalLogs.map((log, idx) => {
                    let color = "text-slate-400";
                    if (log.startsWith(">>>")) color = "text-yellow-400 font-bold";
                    else if (log.includes("[VNP SDK]")) color = "text-emerald-400";
                    else if (log.includes("Selected best node")) color = "text-amber-400 font-extrabold";
                    else if (log.includes("Warning")) color = "text-red-400 font-bold";

                    return (
                      <div key={idx} className={`${color} break-all`}>
                        {log}
                      </div>
                    );
                  })}
                  {simulating && (
                    <div className="text-slate-500 animate-pulse">Running VNP routing equations...</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Code View / Output JSON block - col-span 6 */}
          <div className="lg:col-span-6 space-y-5 flex flex-col justify-between">
            
            {/* Output Return JSON Display */}
            <div className="bg-[#050811] border border-slate-900 rounded-2xl p-4 h-[225px] flex flex-col justify-between font-mono text-[11px]">
              <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-extrabold uppercase pb-1 border-b border-slate-900/40">
                  <span className="flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span>Returned Payload (dict Selection)</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(resultJson, null, 2), "json")}
                    className="text-[9px] hover:text-white flex items-center gap-1 transition"
                    disabled={!resultJson}
                  >
                    {copiedText === "json" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText === "json" ? "Copied" : "Copy Output"}</span>
                  </button>
                </div>
                
                <div className="flex-1 bg-slate-950 p-3 rounded-xl overflow-y-auto font-mono text-[9.5px]/relaxed text-[#38bdf8] custom-scrollbar">
                  {resultJson ? (
                    <pre>{JSON.stringify(resultJson, null, 2)}</pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-600 italic">
                      Run simulation to generate selection dictionary output.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Python Source Code tab/viewer */}
            <div className="bg-[#0b1017] border border-slate-900 rounded-2xl overflow-hidden flex flex-col h-[400px]">
              {/* Code Header Bar */}
              <div className="bg-[#121822] border-b border-slate-900 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
                    <button 
                      onClick={() => setSdkLanguage("python")}
                      className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-bold transition ${sdkLanguage === "python" ? "bg-amber-500/15 text-amber-400" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      Python
                    </button>
                    <button 
                      onClick={() => setSdkLanguage("typescript")}
                      className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-bold transition ${sdkLanguage === "typescript" ? "bg-indigo-500/15 text-indigo-400" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      TypeScript
                    </button>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 tracking-tight font-bold">
                    {sdkLanguage === "python" ? "/vnp_sdk/python/vnp/selector.py" : "/vnp_sdk/typescript/src/selector.ts"}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={triggerDownload}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] transition cursor-pointer font-bold font-mono"
                    title="Download SDK File"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden md:inline font-mono">Download</span>
                  </button>
                  
                  <button
                    onClick={() => copyToClipboard(sdkLanguage === "python" ? pythonCode : tsCode, "sdk")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] transition cursor-pointer font-bold font-mono"
                  >
                    {copiedText === "sdk" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-mono">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="font-mono">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Code Content */}
              <div className="flex-1 overflow-auto p-4 font-mono text-[9.5px]/relaxed text-slate-300 selection:bg-amber-500/20 custom-scrollbar">
                <pre className="whitespace-pre">
                  {sdkLanguage === "python" ? pythonCode : tsCode}
                </pre>
              </div>

              {/* Footer bar */}
              <div className="bg-slate-950 border-t border-slate-900 px-4 py-2 text-[10px] text-slate-500 flex items-center justify-between font-mono">
                <div className="flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-emerald-500" />
                  <span>Attested VNP Multi-Agent Router Release. Fully typed signatures.</span>
                </div>
                <span className="tracking-wider text-slate-600 uppercase font-mono">v1.0.0 Stable</span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SUB-TAB VIEWPORT 2: Provider Suite & Score Explainability */}
      {activeSubTab === "provider" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Claim API Section */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-[#0b1017] border border-slate-900 rounded-2xl p-5 space-y-5">
              <div className="flex items-center gap-1.5 border-b border-slate-900 pb-3">
                <Shield className="w-4.5 h-4.5 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Claim API Owner Verification
                </h3>
              </div>
              
              <p className="text-[11px] text-slate-400 leading-relaxed pl-0.5 font-sans">
                Claim ownership of your API to unlock detailed analytics, trend metrics, custom SLA dispute logging, and auto-alerts if your VNP score drifts.
              </p>

              <div className="space-y-4 text-xs font-mono">
                <div>
                  <label className="text-slate-400 font-mono text-[10px] uppercase font-bold block mb-1">Select Your API Registry Item:</label>
                  <select
                    value={selectedProviderApi}
                    onChange={(e) => {
                      setSelectedProviderApi(e.target.value);
                      setDnsStatus("unclaimed");
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none font-mono text-[11px]"
                  >
                    {availableCandidates.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                    ))}
                  </select>
                </div>

                <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 space-y-2 text-[10.5px]">
                  <div className="text-slate-400 font-bold flex items-center gap-1.5 text-[9px] uppercase">
                    <Globe className="w-3.5 h-3.5 text-blue-400" /> DNS TXT Verification Method
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                    Publish the following cryptographic TXT record on your domain host to prove authority:
                  </p>
                  
                  <div className="flex items-center justify-between bg-black px-2.5 py-1.5 rounded border border-slate-900 font-mono text-[10px]">
                    <span className="text-emerald-400 select-all truncate">{verificationCode}</span>
                    <button
                      onClick={() => copyToClipboard(verificationCode, "txt")}
                      className="text-slate-500 hover:text-white transition cursor-pointer ml-2"
                    >
                      {copiedText === "txt" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  
                  <div className="text-[9.5px] text-slate-500 italic font-sans">
                    Host: <span className="text-slate-300 font-mono">@</span> or <span className="text-slate-300 font-mono">_vnp.{selectedProviderApi}.io</span>
                  </div>
                </div>

                {dnsStatus === "unclaimed" && (
                  <button
                    onClick={handleClaimApi}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-[10px] font-bold tracking-wider transition border border-slate-800 cursor-pointer"
                  >
                    VERIFY DNS TXT RECORD
                  </button>
                )}

                {dnsStatus === "checking" && (
                  <div className="space-y-1 bg-slate-950 border border-slate-900 p-3 rounded-xl text-center">
                    <RefreshCw className="w-4 h-4 text-amber-500 animate-spin mx-auto mb-1" />
                    <div className="text-[10.5px] text-slate-400">Querying auth records ({claimProgress}%)...</div>
                    <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${claimProgress}%` }}></div>
                    </div>
                  </div>
                )}

                {dnsStatus === "verified" && (
                  <div className="bg-emerald-950/20 border border-emerald-900/60 p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-extrabold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>API CLAIM VERIFIED SUCCESSFULLY</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                      Cryptographic link is established. Your VNP score alert webhook is registered with a 24-hour automated SLA audit cycle.
                    </p>
                    <div className="text-[9.5px] text-slate-500 font-mono">
                      Owner DID: <span className="text-emerald-500">did:vnp:owner:{selectedProviderApi}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 space-y-3 font-mono">
              <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest block">Governance SLA Policy</span>
              <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                VNP-v0.1.5 operates under a strict, automated <span className="text-amber-400 font-bold font-mono">24-hour dispute turnaround SLA</span>. Claimed API owners get real-time monitoring of raw telemetry inputs with instant fallback routing shunting.
              </p>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-[#050811] p-2.5 rounded border border-slate-900">
                <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="font-mono">FIPS 140-3 cryptography attestation cycle active</span>
              </div>
            </div>
          </div>

          {/* Explainability Suite Column - col-span 7 */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#0b1017] border border-slate-900 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-4.5 h-4.5 text-amber-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                    Provider Score Explainability Suite
                  </h3>
                </div>
                <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">REMEDIATION MODE</span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Adjust the sliders to simulate infrastructure upgrades for <span className="text-amber-400 font-bold font-mono">{availableCandidates.find(c => c.id === selectedProviderApi)?.name}</span>. Observe how lowering latency, correcting error rates, or elevating compliance immediately shifts the dynamic VNP score and changes the certification bracket.
              </p>

              {/* Dynamic Score Attestation Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 text-center flex flex-col justify-center">
                  <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest block mb-0.5">Simulated Score</span>
                  <div className="text-2xl font-black font-mono text-amber-400 tracking-tight">{simScore}</div>
                  <span className="text-[8px] text-slate-500 font-mono uppercase tracking-wider">Out of 100.0 Max</span>
                </div>

                <div className={`border rounded-xl p-3 text-center flex flex-col justify-center ${badgeBg} transition-colors duration-200`}>
                  <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest block mb-0.5">Certification Class</span>
                  <div className={`text-base font-black font-mono ${certColor} tracking-wide flex items-center justify-center gap-1`}>
                    <Award className="w-4 h-4 animate-bounce" />
                    <span>VNP {certTier}</span>
                  </div>
                  <span className="text-[8px] text-slate-500 font-mono uppercase tracking-wider">
                    {simScore >= 85 ? "Gold (score >= 85)" : simScore >= 75 ? "Silver (score >= 75)" : simScore >= 65 ? "Bronze (score >= 65)" : "Standard measured"}
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 text-center flex flex-col justify-center font-mono">
                  <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest block mb-0.5">Sovereign Routing Priority</span>
                  <div className="text-xs font-black text-slate-200 tracking-tight uppercase">
                    {simScore >= 85 ? "🔥 TIER 1 DIRECT" : simScore >= 75 ? "⚡ TIER 2 RUNNER" : "⚠️ STANDBY CAP"}
                  </div>
                  <span className="text-[8px] text-slate-500 font-mono uppercase tracking-wider">Dynamic Router Placement</span>
                </div>
              </div>

              {/* Sliders Form Section */}
              <div className="space-y-4 text-xs font-mono pt-2">
                
                {/* Slider 1: Latency */}
                <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-900/60">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">P99 Latency (40% Weight):</span>
                    <span className="text-amber-400 font-extrabold font-mono">{providerLatency} ms</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="600"
                    step="5"
                    value={providerLatency}
                    onChange={(e) => setProviderLatency(parseInt(e.target.value))}
                    className="w-full accent-amber-500 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>30ms (Ideal)</span>
                    <span>150ms (Gold target)</span>
                    <span>600ms (High overhead)</span>
                  </div>
                </div>

                {/* Slider 2: Error Rate */}
                <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-900/60">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Heartbeat Error Rate (25% Weight):</span>
                    <span className="text-amber-400 font-extrabold font-mono">{providerErrorRate.toFixed(2)} %</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="2.5"
                    step="0.05"
                    value={providerErrorRate}
                    onChange={(e) => setProviderErrorRate(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>0.0% (Perfect)</span>
                    <span>0.2% (Silver threshold)</span>
                    <span>2.5% (Severe drift)</span>
                  </div>
                </div>

                {/* Slider 3: Cryptography / Compliance */}
                <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-900/60">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Security, FIPS & Certifications (15% Weight):</span>
                    <span className="text-amber-400 font-extrabold font-mono">{providerSecCompliance} / 100</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={providerSecCompliance}
                    onChange={(e) => setProviderSecCompliance(parseInt(e.target.value))}
                    className="w-full accent-amber-500 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>50 (Uncertified Ciphers)</span>
                    <span>85 (TLS 1.3 mandated)</span>
                    <span>100 (FIPS 140-3 + FedRAMP)</span>
                  </div>
                </div>

                {/* Slider 4: DX/TTFC Score */}
                <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-900/60">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Developer Experience & Documentation (20% Weight):</span>
                    <span className="text-amber-400 font-extrabold font-mono">{providerDxScore} / 100</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={providerDxScore}
                    onChange={(e) => setProviderDxScore(parseInt(e.target.value))}
                    className="w-full accent-amber-500 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>40 (Incomplete docs)</span>
                    <span>75 (Valid OpenAPI schema)</span>
                    <span>100 (Interactive Sandbox SDK)</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      )}

      {/* SUB-TAB VIEWPORT 3: Conformance Certification Program */}
      {activeSubTab === "badges" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Badge selection controls */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-[#0b1017] border border-slate-900 rounded-2xl p-5 space-y-5">
              <div className="flex items-center gap-1.5 border-b border-slate-900 pb-3">
                <Award className="w-4.5 h-4.5 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Conformance Badging Center
                </h3>
              </div>
              
              <p className="text-[11px] text-slate-400 leading-relaxed pl-0.5 font-sans">
                Advertise your verified VNP Certification status on your website or repository. These SVG badges dynamically fetch your live 30-day composite scores directly from our mainnet database.
              </p>

              <div className="space-y-4 text-xs font-mono">
                <div>
                  <label className="text-slate-400 font-mono text-[10px] uppercase font-bold block mb-1">Select Target API Node:</label>
                  <select
                    value={badgeApi}
                    onChange={(e) => setBadgeApi(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none font-mono text-[11px]"
                  >
                    {availableCandidates.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (Live Score: {c.defaultScore})</option>
                    ))}
                  </select>
                </div>

                {/* Badge specifications */}
                <div className="space-y-2 text-[10.5px] border-t border-slate-900 pt-3">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest font-extrabold block">Certification Threshold Rules</span>
                  
                  <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-900">
                    <span className="text-amber-400 font-extrabold flex items-center gap-1">🏆 VNP GOLD</span>
                    <span className="text-slate-300 font-bold">Score ≥ 85.0</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-900">
                    <span className="text-slate-300 font-extrabold flex items-center gap-1">🥈 VNP SILVER</span>
                    <span className="text-slate-400 font-bold">Score ≥ 75.0</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-900">
                    <span className="text-orange-400 font-extrabold flex items-center gap-1">🥉 VNP BRONZE</span>
                    <span className="text-slate-500 font-bold">Score ≥ 65.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Badge Display & Copy Code Block */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#0b1017] border border-slate-900 rounded-2xl p-5 space-y-5">
              <div className="flex items-center gap-1.5 border-b border-slate-900 pb-3">
                <FileCode className="w-4.5 h-4.5 text-[#38bdf8]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Live Preview & Copy Code
                </h3>
              </div>

              {/* Dynamic SVG Drawing Representation */}
              <div className="bg-slate-950 border border-slate-900 p-8 rounded-xl flex flex-col items-center justify-center space-y-2">
                <span className="text-[8.5px] text-slate-500 uppercase tracking-widest block font-mono">Live SVG Badge Rendering:</span>
                
                {/* Handcrafted dynamic SVG badge preview */}
                <div className="bg-[#111] p-3 rounded-lg border border-slate-800 shadow-xl flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="200" height="28" viewBox="0 0 200 28" className="select-none">
                    <rect width="200" height="28" fill="#1e1e1e" rx="3" />
                    <rect x="2" y="2" width="60" height="24" fill={badgeColorHex} rx="2" />
                    <rect x="66" y="2" width="132" height="24" fill="#0f0f0f" rx="2" stroke={badgeColorHex} strokeWidth="1" />
                    <text x="32" y="18" fontFamily="monospace" fontSize="13" fontWeight="bold" textAnchor="middle" fill="#000">
                      {badgeScore}
                    </text>
                    <text x="132" y="18" fontFamily="monospace" fontSize="11" fontWeight="extrabold" textAnchor="middle" fill={badgeColorHex}>
                      VNP {badgeTier}
                    </text>
                  </svg>
                </div>

                <span className="text-[10px] text-slate-400 font-mono">Active Verification Anchor: <span className="text-amber-500 font-bold">Base L2 mainnet verified</span></span>
              </div>

              {/* Copy Embed Formats */}
              <div className="space-y-4 text-xs font-mono">
                
                {/* Format 1: Markdown */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Embed in README.md (Markdown Format)</span>
                    <button
                      onClick={() => copyToClipboard(badgeMarkdownCode, "mdBadge")}
                      className="text-[9px] hover:text-white flex items-center gap-1 transition"
                    >
                      {copiedText === "mdBadge" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedText === "mdBadge" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-900 overflow-x-auto text-[9.5px] text-blue-400">
                    <code>{badgeMarkdownCode}</code>
                  </div>
                </div>

                {/* Format 2: HTML */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Embed in Webpage (HTML Format)</span>
                    <button
                      onClick={() => copyToClipboard(badgeHtmlCode, "htmlBadge")}
                      className="text-[9px] hover:text-white flex items-center gap-1 transition"
                    >
                      {copiedText === "htmlBadge" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedText === "htmlBadge" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-900 overflow-x-auto text-[9.5px] text-indigo-400 whitespace-pre">
                    <code>{badgeHtmlCode}</code>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>
      )}

      {/* SUB-TAB VIEWPORT 4: Dispute Center */}
      {activeSubTab === "dispute" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Dispute submission form */}
          <div className="lg:col-span-5 space-y-5">
            <form onSubmit={handleLodgeDispute} className="bg-[#0b1017] border border-slate-900 rounded-2xl p-5 space-y-5">
              <div className="flex items-center gap-1.5 border-b border-slate-900 pb-3">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Lodge Telemetry Dispute
                </h3>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed pl-0.5 font-sans">
                Claimed API owners can contest automated telemetry anomalies (e.g. outlier packets, false regional downtime, routing blackholes) within 48 hours of detection.
              </p>

              <div className="space-y-4 text-xs font-mono">
                <div>
                  <label className="text-slate-400 font-mono text-[10px] uppercase font-bold block mb-1">Select Dispute Target API:</label>
                  <select
                    value={disputeApi}
                    onChange={(e) => setDisputeApi(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none font-mono text-[11px]"
                  >
                    {availableCandidates.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-mono text-[10px] uppercase font-bold block mb-1">Dispute Incident & Telemetry details:</label>
                  <textarea
                    rows={3}
                    value={disputedMetrics}
                    onChange={(e) => setDisputedMetrics(e.target.value)}
                    placeholder="e.g. P99 Latency outlier spikes in EU-WEST during server routing failover check..."
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none font-mono text-[11px] placeholder-slate-700 resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLodging || !disputedMetrics}
                  className="w-full py-2 bg-gradient-to-tr from-amber-600 to-indigo-700 hover:from-amber-500 hover:to-indigo-600 disabled:opacity-40 text-white font-black rounded-lg text-[10px] tracking-wider transition cursor-pointer"
                >
                  {isLodging ? "SUBMITTING DISPUTE PROTOCOL..." : "LODGE OFFICIAL DISPUTE"}
                </button>
              </div>
            </form>
          </div>

          {/* Active Disputes & SLA tracking */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#0b1017] border border-slate-900 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                    Automated Dispute Audit Queue
                  </h3>
                </div>
                <span className="text-[9px] bg-slate-950 border border-slate-900 px-2 py-0.5 rounded font-mono text-amber-500 font-extrabold flex items-center gap-1.5">
                  <span>SLA TIMER:</span>
                  <span>{formatSla(slaTime)}</span>
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {disputeLogs.map((log) => (
                  <div key={log.id} className="bg-slate-950 border border-slate-900 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded font-black text-slate-300">
                          {log.api.toUpperCase()}
                        </span>
                        <span className="text-[9px] text-slate-500">{new Date(log.time).toLocaleTimeString()}</span>
                      </div>
                      
                      <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-black tracking-widest ${
                        log.status === "RESOLVED_AUTO" 
                          ? "bg-emerald-950/20 text-emerald-400 border border-emerald-900/40"
                          : "bg-amber-950/20 text-amber-400 border border-amber-900/40 animate-pulse"
                      }`}>
                        {log.status}
                      </span>
                    </div>

                    <div className="text-[10.5px] text-slate-300 leading-relaxed">
                      {log.msg}
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-slate-500 border-t border-slate-900/60 pt-2">
                      <span>Type: {log.type}</span>
                      <span>SLA Response Window: <span className="text-slate-300 font-bold">{log.status === "RESOLVED_AUTO" ? "00:00:00" : formatSla(slaTime)}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
