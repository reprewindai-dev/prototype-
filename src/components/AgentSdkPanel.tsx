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
  FileCheck
} from "lucide-react";

export default function AgentSdkPanel() {
  const [useCase, setUseCase] = useState("image_generation");
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>(["openai", "anthropic", "together"]);
  const [constraint, setConstraint] = useState("latency < 500ms");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Simulation terminal States
  const [simulating, setSimulating] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [resultJson, setResultJson] = useState<any>(null);
  const [simStep, setSimStep] = useState(0);

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
    """VNP-supported use cases"""
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
    """VNP API score"""
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
    vnp_uri: str  # Link to provider dashboard


@dataclass
class APISelection:
    """Result of API selection"""
    api: str  # e.g., "openai-api"
    score: float
    confidence: float
    p99_latency_ms: float
    error_rate_pct: float
    availability_pct: float
    uri: str  # Actual API endpoint
    reason: str  # Why this API was selected
    alternatives: List[Dict]  # Other candidates + scores
    selected_at: str


# ============================================================================
# VNP API CLIENT
# ============================================================================

class VNPClient:
    """Low-level client for VNP API"""
    
    def __init__(self, api_url: str = VNP_API_URL, cache_ttl: int = CACHE_TTL_SECONDS):
        self.api_url = api_url
        self.graphql_url = f"{api_url}/graphql"
        self.cache = TTLCache(maxsize=1000, ttl=cache_ttl)
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def get_score_sync(self, api_id: str) -> Optional[VNPScore]:
        """Synchronous score fetch (blocking)"""
        return asyncio.run(self.get_score(api_id))
    
    async def get_score(self, api_id: str) -> Optional[VNPScore]:
        """Fetch VNP score for an API"""
        cache_key = f"score:{api_id}"
        
        # Check cache
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        query = f"""
        query {{
            score(api_id: "{api_id}") {{
                apiId
                compositeScore
                confidence_interval_95
                dimensions {{
                    p99_latency {{ score }}
                    error_rate {{ score }}
                    availability {{ score }}
                    throughput {{ score }}
                }}
                regionalScores: regional_scores
                measurementCount: measurement_count
                lastUpdated: computed_at
            }}
        }}
        """
        
        try:
            if self.session:
                async with self.session.post(
                    self.graphql_url,
                    json={"query": query},
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    result = await response.json()
            else:
                # Fallback to synchronous request
                response = requests.post(
                    self.graphql_url,
                    json={"query": query},
                    timeout=5
                )
                result = response.json()
            
            if "errors" in result:
                logger.warning(f"VNP error for {api_id}: {result['errors']}")
                return None
            
            data = result.get("data", {}).get("score")
            if not data:
                return None
            
            score = VNPScore(
                api_id=data["apiId"],
                api_name=data["apiId"].split(":")[-1],
                composite_score=data["compositeScore"],
                confidence_interval_95=tuple(data["confidence_interval_95"]),
                p99_latency_ms=data["dimensions"]["p99_latency"]["score"],
                error_rate_pct=data["dimensions"]["error_rate"]["score"],
                availability_pct=data["dimensions"]["availability"]["score"],
                throughput_rps=data["dimensions"]["throughput"]["score"],
                regional_scores=data.get("regionalScores", {}),
                measurement_count=data["measurementCount"],
                last_updated=data["lastUpdated"],
                vnp_uri=f"https://vnp.io/provider/{{data['apiId']}}"
            )
            
            self.cache[cache_key] = score
            return score
        
        except Exception as e:
            logger.error(f"Failed to fetch VNP score for {api_id}: {e}")
            return None
    
    def batch_scores(self, api_ids: List[str]) -> Dict[str, Optional[VNPScore]]:
        """Fetch multiple scores in parallel"""
        return asyncio.run(self._batch_scores_async(api_ids))
    
    async def _batch_scores_async(self, api_ids: List[str]) -> Dict[str, Optional[VNPScore]]:
        """Async batch score fetch"""
        tasks = [self.get_score(api_id) for api_id in api_ids]
        results = await asyncio.gather(*tasks)
        return {api_id: score for api_id, score in zip(api_ids, results)}


# ============================================================================
# API SELECTOR (Primary Interface)
# ============================================================================

class APISelector:
    """
    Smart API selection based on VNP scores.
    """
    
    def __init__(self, vnp_api_url: str = VNP_API_URL):
        self.client = VNPClient(api_url=vnp_api_url)
        self.api_endpoints = self._load_api_endpoints()
    
    def _load_api_endpoints(self) -> Dict[str, str]:
        """Load canonical API endpoints"""
        return {
            "openai": "https://api.openai.com/v1",
            "anthropic": "https://api.anthropic.com/v1",
            "together": "https://api.together.xyz/v1",
            "groq": "https://api.groq.com/v1",
            "stripe": "https://api.stripe.com/v1",
            "twilio": "https://api.twilio.com",
            "cloudflare": "https://api.cloudflare.com/client/v4",
            "cohere": "https://api.cohere.ai",
            "replicate": "https://api.replicate.com/v1",
        }
    
    def select(
        self,
        candidates: List[str],
        use_case: Optional[UseCase] = None,
        constraint: Optional[str] = None,
        region: Optional[str] = None,
        prefer_cost_efficient: bool = False,
        fallback_chain: int = 3,
    ) -> APISelection:
        """
        Select best API from candidates based on VNP scores.
        """
        api_ids = [f"did:vnp:api:{name}" for name in candidates]
        scores = self.client.batch_scores(api_ids)
        valid_scores = {
            name: score
            for name, score in zip(candidates, [scores.get(aid) for aid in api_ids])
            if score is not None
        }
        
        if not valid_scores:
            raise ValueError(f"No VNP scores found for {candidates}")
        
        filtered = self._apply_constraints(valid_scores, constraint, region)
        if not filtered:
            filtered = valid_scores
        
        ranked = sorted(
            filtered.items(),
            key=lambda x: x[1].composite_score,
            reverse=True
        )
        
        best_name, best_score = ranked[0]
        alternatives = [
            {
                "api": name,
                "score": score.composite_score,
                "confidence": score.confidence_interval_95[1] - score.confidence_interval_95[0],
            }
            for name, score in ranked[1:fallback_chain]
        ]
        
        return APISelection(
            api=best_name,
            score=best_score.composite_score,
            confidence=(best_score.confidence_interval_95[1] - best_score.confidence_interval_95[0]),
            p99_latency_ms=best_score.p99_latency_ms,
            error_rate_pct=best_score.error_rate_pct,
            availability_pct=best_score.availability_pct,
            uri=self.api_endpoints.get(best_name, f"https://api.{best_name}.com"),
            reason=f"Best VNP score ({best_score.composite_score:.1f}) with {best_score.measurement_count:,} measurements",
            alternatives=alternatives,
            selected_at=datetime.utcnow().isoformat(),
        )
`;

  const availableCandidates = [
    { id: "openai", name: "OpenAI GPT-4o", defaultScore: 89.4, latency: 148, err: 0.13, avail: 99.60, url: "https://api.openai.com/v1" },
    { id: "anthropic", name: "Anthropic Claude 3.5 Sonnet", defaultScore: 92.1, latency: 104.9, err: 0.10, avail: 99.90, url: "https://api.anthropic.com/v1" },
    { id: "together", name: "Together.ai (Llama-3-70B)", defaultScore: 86.8, latency: 237.9, err: 0.13, avail: 99.62, url: "https://api.together.xyz/v1" },
    { id: "groq", name: "Groq Llama-3-70B-Instant", defaultScore: 88.3, latency: 45.0, err: 0.07, avail: 99.67, url: "https://api.groq.com/v1" },
    { id: "stripe", name: "Stripe Payment MPP Hub", defaultScore: 95.8, latency: 68.1, err: 0.00, avail: 99.98, url: "https://api.stripe.com/v1" },
    { id: "cohere", name: "Cohere Command R+", defaultScore: 85.2, latency: 412.1, err: 0.05, avail: 99.92, url: "https://api.cohere.ai" },
  ];

  const handleToggleCandidate = (id: string) => {
    setSelectedCandidates(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least one
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

    const steps = [
      { text: ">>> python run_vnp_selector.py", delay: 0 },
      { text: "[VNP SDK] Initializing APISelector on mainnet (v0.1)...", delay: 400 },
      { text: `[VNP SDK] Configuration: use_case='${useCase}', constraint='${constraint}'`, delay: 900 },
      { text: `[VNP SDK] Scanning VNP telemetry scores for candidates: ${selectedCandidates.join(", ")}`, delay: 1400 },
      { text: "[VNP SDK] Connecting to VNP Ledger gateway for live multi-region proof data...", delay: 2000 },
      { text: "[VNP SDK] Resolving optimal node by trust-weight composite equations...", delay: 2600 },
    ];

    // Compute the actual best candidate based on selectedCandidates scores and constraints
    let activeList = availableCandidates.filter(c => selectedCandidates.includes(c.id));
    
    // Check constraints and filter
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

    // Sort by defaultScore descending
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
    steps.push({ text: `[VNP SDK] Active redirect payload shunted safely inside local Docker container. Decided in 82.4ms.`, delay: 3800 });

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

  // Run on mount once
  useEffect(() => {
    runSimulation();
  }, []);

  const triggerDownload = () => {
    const blob = new Blob([pythonCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vnp_sdk.py";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="vnp-agent-sdk-root" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Left Column: Interactive Simulator Controller & Terminal - col-span 6 */}
      <div className="lg:col-span-6 space-y-5 flex flex-col justify-between">
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
              <Terminal className="w-3.5 h-3.5 text-amber-500" /> python virtualenv sandbox
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
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80 block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 block" />
              </div>
              <span className="text-[11px] font-mono text-slate-400 tracking-tight font-bold">
                /vnp_sdk/python/vnp/selector.py
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={triggerDownload}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] transition cursor-pointer font-bold font-mono"
                title="Download SDK File"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Download SDK</span>
              </button>
              
              <button
                onClick={() => copyToClipboard(pythonCode, "sdk")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] transition cursor-pointer font-bold font-mono"
              >
                {copiedText === "sdk" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Code Content */}
          <div className="flex-1 overflow-auto p-4 font-mono text-[9.5px]/relaxed text-slate-300 selection:bg-amber-500/20 custom-scrollbar">
            <pre className="whitespace-pre">
              {pythonCode}
            </pre>
          </div>

          {/* Footer bar */}
          <div className="bg-slate-950 border-t border-slate-900 px-4 py-2 text-[10px] text-slate-500 flex items-center justify-between font-mono">
            <div className="flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-500" />
              <span>Attested Python SDK release. Fully typed signatures.</span>
            </div>
            <span className="tracking-wider text-slate-600 uppercase font-mono">v1.0.0 Stable</span>
          </div>
        </div>

      </div>

    </div>
  );
}
