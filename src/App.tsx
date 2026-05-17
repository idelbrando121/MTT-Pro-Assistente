/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Zap, 
  Target, 
  TrendingUp, 
  ShieldCheck, 
  AlertTriangle, 
  ChevronRight, 
  Keyboard,
  Trophy,
  History,
  Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Constants ---

type Position = 'UTG' | 'UTG+1' | 'UTG+2' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
type Phase = 1 | 2 | 3 | 4 | 5; // 1:INI, 2:MID, 3:BUBBLE, 4:ITM, 5:FINAL
type Action = 'PUSH' | 'FOLD' | 'CALL' | 'RAISE' | 'ALL-IN';

interface EvaluationResult {
  score: number; // 0-10
  suggestion: Action;
  potOdds: number;
  reasoning: string;
}

const POSITIONS: Position[] = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const PHASES = [
  { id: 1, label: 'INÍCIO' },
  { id: 2, label: 'MEIO' },
  { id: 3, label: 'BOLHA' },
  { id: 4, label: 'ITM' },
  { id: 5, label: 'FINAL' }
];

// --- Poker Logic Helpers ---

const getHandStrength = (hand: string): number => {
  const h = hand.toLowerCase().trim();
  if (!h) return 0;

  // Exact Match High Premiums
  if (/^(aa|kk)$/.test(h)) return 10;
  if (/^(qq|aks|jj)$/.test(h)) return 9.5;
  if (/^(ak|ako|tt|aqs)$/.test(h)) return 9.0;
  
  // High Tier
  if (/^(99|ajs|aqo|kqs|88)$/.test(h)) return 8.0;
  if (/^(ats|kjs|qjs|ajo|77)$/.test(h)) return 7.5;
  
  // Mid Tier / Speculative
  if (/^(66|55|kts|qts|jts|t9s|kqo)$/.test(h)) return 6.5;
  if (/^(44|33|22|98s|87s|76s|at|kjo)$/.test(h)) return 5.5;
  
  // Low Suited / Broadway Junk
  if (h.endsWith('s')) return 4.5;
  if (/^(qj|jt|t9)$/.test(h)) return 4.0;
  
  return 2.0;
};

const evaluateMTT = (
  hand: string,
  pos: Position,
  stack: number,
  phase: number,
  pot: number,
  call: number
): EvaluationResult => {
  let score = getHandStrength(hand);
  const potOdds = call > 0 ? (call / (pot + call)) * 100 : 0;
  
  // Position Adjustments (EP = UTG, LP = BTN/CO)
  const posIndex = POSITIONS.indexOf(pos);
  if (posIndex <= 2) score -= 1.5; // Early Position penalty
  if (pos === 'BTN' || pos === 'CO') score += 1.0; // Late Position bonus

  // Stack Depth Adjustments
  if (stack < 15) {
    // Push/Fold territory
    if (score >= 6.5) return { 
      score, 
      suggestion: 'PUSH', 
      potOdds, 
      reasoning: 'Stack curto (<15BB). Agressividade máxima recomendada.' 
    };
    if (score < 5.0) return { score, suggestion: 'FOLD', potOdds, reasoning: 'Mão fraca para push 15bb.' };
  }

  // Phase Adjustments
  if (phase === 3) { // Bubble
    score -= 1.0; // Be tighter
  } else if (phase >= 4) { // ITM/Final
    score += 0.5; // Slightly more aggressive
  }

  // SUGGESTION LOGIC
  let suggestion: Action = 'FOLD';
  let reasoning = 'Mão marginal. Evite riscos desnecessários.';

  if (score >= 8.5) {
    suggestion = 'RAISE';
    reasoning = 'Mão premium. Construa o pote.';
  } else if (score >= 6.5) {
    if (potOdds < 25 && call > 0) {
      suggestion = 'CALL';
      reasoning = 'Boas pot odds para continuar.';
    } else {
      suggestion = 'RAISE';
      reasoning = 'Mão forte em posição/stack favorável.';
    }
  } else if (score >= 5.0 && potOdds < 15) {
    suggestion = 'CALL';
    reasoning = 'Investimento barato com potencial.';
  }

  return { score: Math.min(10, Math.max(0, score)), suggestion, potOdds, reasoning };
};

// --- Components ---

export default function App() {
  const [hand, setHand] = useState('');
  const [pos, setPos] = useState<Position>('UTG');
  const [stack, setStack] = useState(40);
  const [phase, setPhase] = useState<Phase>(2);
  const [pot, setPot] = useState(10);
  const [betToCall, setBetToCall] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => {
    return evaluateMTT(hand, pos, stack, phase, pot, betToCall);
  }, [hand, pos, stack, phase, pot, betToCall]);

  // Keyboard focus helper
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden select-none">
      {/* Header: Phase & Global Context */}
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase flex items-baseline gap-2">
            Assistente MTT <span className="text-slate-500 font-normal text-xs font-mono">V2.4_LIVE</span>
          </h1>
        </div>
        <div className="hidden md:flex gap-1 overflow-x-auto px-2 py-1">
          {PHASES.map((ph) => (
            <button
              key={ph.id}
              onClick={() => setPhase(ph.id as Phase)}
              className={`px-4 py-2 text-[10px] font-black border transition-all duration-200 cursor-pointer whitespace-nowrap ${
                phase === ph.id
                  ? 'border-orange-500/50 bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/50'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              {ph.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Panel: Input Core */}
        <div className="w-full md:w-[400px] border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col gap-6 bg-slate-900/20 overflow-y-auto">
          
          {/* Entrada da Mão */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center justify-between">
              Entrada da Mão (Ex: AKs, TT)
              <span className="flex items-center gap-1 opacity-40"><Keyboard className="w-3 h-3" /> /</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={hand}
              onChange={(e) => setHand(e.target.value)}
              className="bg-slate-800 border-2 border-slate-700 text-4xl p-4 font-mono font-bold text-white text-center focus:border-blue-500 outline-none rounded-lg uppercase placeholder:opacity-20"
              placeholder="---"
            />
          </div>

          {/* Grade de Posição (9 Jogadores) */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Posição na Mesa</label>
            <div className="grid grid-cols-3 gap-2">
              {POSITIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPos(p)}
                  className={`p-3 text-xs rounded border transition-all duration-150 font-bold cursor-pointer outline-none focus:ring-1 focus:ring-blue-500 ${
                    pos === p
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/40'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Tamanho do Stack BB */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Stack Efetivo (BB)</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={stack}
                onChange={(e) => setStack(Number(e.target.value))}
                className="flex-1 bg-slate-800 border border-slate-700 p-4 text-2xl font-mono text-center rounded text-white font-bold outline-none focus:border-slate-500"
              />
              <div className="flex flex-col gap-1 w-24">
                <span className={`text-[10px] px-2 py-1 text-center font-bold border ${
                  stack < 15 
                    ? 'bg-red-900/30 text-red-500 border-red-500/30' 
                    : stack < 40 
                    ? 'bg-orange-900/30 text-orange-400 border-orange-500/30' 
                    : 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30'
                }`}>
                  {stack < 15 ? 'CURTO' : stack < 40 ? 'MÉDIO' : 'ALTO'}
                </span>
                <span className="text-[9px] opacity-30 px-2 py-1 text-center uppercase font-bold tracking-tight">
                  {stack < 15 ? 'PUSH/FOLD' : stack < 40 ? 'ROUBO/DEF' : 'EQUILÍBRIO'}
                </span>
              </div>
            </div>
            <input 
              type="range" 
              min="2" 
              max="150" 
              value={stack}
              onChange={(e) => setStack(parseInt(e.target.value))}
              className="w-full accent-blue-500 h-1 bg-slate-800 rounded-full appearance-none mt-2"
            />
          </div>

          {/* Pote & Aposta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Pote Total (BB)</label>
              <input
                type="number"
                value={pot}
                onChange={(e) => setPot(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 p-3 text-center rounded text-white font-mono font-bold outline-none focus:border-slate-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">A Pagar (BB)</label>
              <input
                type="number"
                value={betToCall}
                onChange={(e) => setBetToCall(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 p-3 text-center rounded text-white font-mono font-bold outline-none focus:border-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Right Panel: Strategic Analysis */}
        <div className="flex-1 p-8 flex flex-col bg-[#020617] relative overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={result.score + result.suggestion}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex-1 flex flex-col"
            >
              {/* Primary Recommendation */}
              <div className={`flex-1 border-2 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-500 min-h-[300px] ${
                result.suggestion === 'PUSH' || result.suggestion === 'ALL-IN' 
                  ? 'border-red-500/30 bg-red-500/5' 
                  : result.suggestion === 'FOLD' 
                  ? 'border-slate-800 bg-slate-900/20' 
                  : result.suggestion === 'RAISE'
                  ? 'border-yellow-500/30 bg-yellow-500/5'
                  : 'border-emerald-500/30 bg-emerald-500/5'
              }`}>
                <div className={`absolute top-0 left-0 w-full h-1 transition-colors duration-500 ${
                  result.suggestion === 'PUSH' || result.suggestion === 'ALL-IN' ? 'bg-red-500' :
                  result.suggestion === 'FOLD' ? 'bg-slate-800' :
                  result.suggestion === 'RAISE' ? 'bg-yellow-500' : 'bg-emerald-500'
                }`}></div>
                
                <span className={`text-[12px] uppercase tracking-[0.4em] font-bold mb-4 ${
                  result.suggestion === 'PUSH' || result.suggestion === 'ALL-IN' ? 'text-red-500' :
                  result.suggestion === 'FOLD' ? 'text-slate-500' :
                  result.suggestion === 'RAISE' ? 'text-yellow-500' : 'text-emerald-500'
                }`}>Recomendação Estratégica</span>
                
                <h2 className="text-7xl md:text-[120px] leading-none font-black text-white italic tracking-tighter drop-shadow-2xl uppercase">
                  {result.suggestion}
                </h2>

                <div className="mt-8 md:mt-12 flex gap-8 md:gap-12 items-center">
                  <div className="text-center group">
                    <div className="text-4xl md:text-5xl font-mono font-black text-white tracking-tighter">{result.score.toFixed(1)}</div>
                    <div className="text-[10px] uppercase text-slate-500 tracking-widest font-bold mt-1">Força da Mão</div>
                  </div>
                  <div className="w-[1px] h-12 bg-slate-800"></div>
                  <div className="text-center group">
                    <div className="text-4xl md:text-5xl font-mono font-black text-white tracking-tighter">{result.potOdds.toFixed(1)}%</div>
                    <div className="text-[10px] uppercase text-slate-500 tracking-widest font-bold mt-1">Odds do Pote</div>
                  </div>
                </div>
              </div>

              {/* Ajustes Contextuais Detalhados */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border-l-4 border-orange-400 pl-4 py-3 bg-slate-900/40 rounded-r shadow-sm">
                  <h3 className="text-xs font-black text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" /> AJUSTE MTT
                  </h3>
                  <p className="text-sm text-slate-400 font-medium leading-snug">
                    {phase === 3 
                      ? "Ajuste de Bolha ativo. Poupando stack para evitar eliminação prematura." 
                      : phase === 5 
                      ? "Mesa Final. Cada blind conta. Aumento de agressividade por ICM."
                      : "Ajuste de fase padrão aplicado aos ranges de abertura dinâmicos."}
                  </p>
                </div>
                <div className="border-l-4 border-blue-400 pl-4 py-3 bg-slate-900/40 rounded-r shadow-sm">
                  <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Zap className="w-3 h-3" /> NOTA ESTRATÉGICA
                  </h3>
                  <p className="text-sm text-slate-400 font-medium leading-snug">
                    {result.reasoning}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Controles do Rodapé */}
          <div className="mt-auto pt-6 flex justify-between items-center border-t border-slate-800 shrink-0">
            <div className="flex gap-2">
              <button 
                onClick={() => { setHand(''); setBetToCall(0); }}
                className="w-10 h-10 rounded border border-slate-700 flex items-center justify-center text-[10px] font-mono hover:bg-slate-800 transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-slate-500 text-slate-400"
              >
                ESC
              </button>
              <div className="hidden sm:flex text-[10px] text-slate-500 items-center italic font-bold uppercase tracking-tight">Limpar Mão Atual</div>
            </div>
            <div className="flex gap-6">
              <div className="hidden sm:flex flex-col items-end justify-center">
                <span className="text-[9px] text-slate-500 font-bold tracking-widest uppercase">STATUS DE ESTABILIDADE</span>
                <span className="text-xs font-black text-emerald-400 uppercase tracking-tighter">MOTOR_OTIMIZADO</span>
              </div>
              <button 
                onClick={() => { setHand(''); setBetToCall(0); inputRef.current?.focus(); }}
                className="bg-white text-black px-6 md:px-8 py-3 rounded font-black text-xs tracking-[0.2em] hover:bg-slate-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] uppercase cursor-pointer outline-none"
              >
                Próxima Mão
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid Visual Aid */}
      <div className="h-1 bg-slate-900 flex shrink-0">
        <div className={`transition-all duration-1000 ${result.suggestion === 'PUSH' ? 'w-full bg-red-500/50' : 'w-1/4 bg-blue-500/30'}`}></div>
        <div className="w-1/4 bg-slate-900"></div>
        <div className="w-1/4 bg-green-500/30"></div>
        <div className="w-1/4 bg-slate-900"></div>
      </div>
    </div>
  );
}
