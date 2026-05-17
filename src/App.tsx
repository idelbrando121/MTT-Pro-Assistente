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
type Street = 'PRE' | 'FLOP' | 'TURN' | 'RIVER';

interface EvaluationResult {
  score: number; // 0-10
  suggestion: Action;
  potOdds: number;
  reasoning: string;
  madeHand: string;
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

const evaluateHand = (handStr: string, boardStr: string): { score: number, description: string } => {
  const hand = handStr.toLowerCase().replace(/[^a-z0-9s]/g, '');
  const board = boardStr.toLowerCase().split(' ').filter(c => c.length >= 1);
  const handCards = hand.match(/.{1,2}/g) || [];
  const fullCards = [...handCards, ...board];
  
  // PRE-FLOP LOGIC
  if (board.length === 0) {
    if (/^(aa|kk)$/.test(hand)) return { score: 10, description: 'AA/KK Premium' };
    if (/^(qq|aks|jj)$/.test(hand)) return { score: 9.5, description: 'JJ+ / AKs' };
    if (/^(ak|ako|tt|aqs)$/.test(hand)) return { score: 9.0, description: 'AK / TT / AQs' };
    if (/^(99|ajs|aqo|kqs|88)$/.test(hand)) return { score: 8.0, description: 'Mãos Fortes' };
    if (/^(ats|kjs|qjs|ajo|77|a9s|a8s|a7s|kts|qts|jts)$/.test(hand)) return { score: 7.5, description: 'Mãos de Abertura' };
    if (/^(66|55|t9s|kqo|a9o|a8o|a7o|k9s|at)$/.test(hand)) return { score: 6.5, description: 'Speculative/Mid' };
    if (/^(44|33|22|98s|87s|76s|kjo|k9o|k8o|q9o|q8o|q9s|q8s|j9s|a6o|a5o)$/.test(hand)) return { score: 5.5, description: 'Low Pairs / SCs / Broadways Curtos' };
    if (hand.endsWith('s') || /^([akqj]..)$/.test(hand)) return { score: 4.5, description: 'Face Cards / Suited' };
    return { score: 2.0, description: 'Lixo / Fold' };
  }

  // POST-FLOP HEURISTICS
  const ranks: Record<string, number> = {};
  const suits: Record<string, number> = {};
  
  fullCards.forEach(c => {
    const r = c[0].toUpperCase();
    const s = c[1]?.toLowerCase();
    ranks[r] = (ranks[r] || 0) + 1;
    if (s) suits[s] = (suits[s] || 0) + 1;
  });

  const counts = Object.values(ranks);
  const maxCount = Math.max(...counts);
  const pairCount = counts.filter(v => v === 2).length;
  const isFlushDraw = Object.values(suits).some(v => v === 4);
  const isFlush = Object.values(suits).some(v => v >= 5);

  const rankValues = Object.keys(ranks)
    .map(r => {
      if (r === 'A') return 14;
      if (r === 'K') return 13;
      if (r === 'Q') return 12;
      if (r === 'J') return 11;
      if (r === 'T') return 10;
      return parseInt(r);
    })
    .sort((a, b) => a - b);
  
  let consecutive = 1;
  let maxConsecutive = 1;
  for (let i = 0; i < rankValues.length - 1; i++) {
    if (rankValues[i+1] === rankValues[i] + 1) {
      consecutive++;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    } else if (rankValues[i+1] !== rankValues[i]) {
      consecutive = 1;
    }
  }

  if (isFlush) return { score: 9.2, description: 'Flush!' };
  if (maxConsecutive >= 5) return { score: 9.0, description: 'Sequência!' };
  if (maxCount === 4) return { score: 9.8, description: 'Quadra!' };
  if (maxCount === 3 && pairCount >= 1) return { score: 9.5, description: 'Full House' };
  if (maxCount === 3) return { score: 7.5, description: 'Trinca' };
  if (pairCount >= 2) return { score: 7.0, description: 'Dois Pares' };
  if (pairCount === 1) return { score: 5.5, description: 'Um Par' };

  if (isFlushDraw && maxConsecutive === 4) return { score: 7.0, description: 'Flush Draw + Seq Aberta' };
  if (isFlushDraw) return { score: 6.0, description: 'Flush Draw' };
  if (maxConsecutive === 4) return { score: 5.5, description: 'Sequência Aberta' };

  return { score: 3.0, description: 'Carta Alta / Draw' };
};

const evaluateMTT = (
  hand: string,
  pos: Position,
  stack: number,
  phase: number,
  pot: number,
  call: number,
  board: string
): EvaluationResult => {
  const { score: baseScore, description: madeHand } = evaluateHand(hand, board);
  let score = baseScore;
  const potOdds = call > 0 ? (call / (pot + call)) * 100 : 0;
  
  if (board === '') {
    const posIndex = POSITIONS.indexOf(pos);
    // Position adjustments (Lower index = earlier position)
    if (posIndex <= 2) score -= 1.2; // UTG/UTG+1/UTG+2 are tighter
    if (pos === 'BTN') score += 1.8; // Button is extremely aggressive
    if (pos === 'CO') score += 1.2;  // CO is very aggressive
    if (pos === 'HJ') score += 0.5;
    
    // Stack adjustments for Push/Fold phase
    if (stack < 15 && score >= 5.0) score += 2.5; 
    if (stack < 10) score += 1.0;
  }
  
  if (phase === 3) score -= 0.8; // Tighten up significantly on the Bubble

  let suggestion: Action = 'FOLD';
  if (score >= 8.5) {
    suggestion = 'ALL-IN';
  } else if (score >= 6.8) {
    suggestion = potOdds < 30 ? 'RAISE' : 'CALL';
  } else if (score >= 4.8) {
    suggestion = potOdds < 25 ? 'CALL' : 'FOLD';
  } else {
    suggestion = 'FOLD';
  }

  return { 
    score: Math.min(10, Math.max(0, score)), 
    suggestion, 
    potOdds, 
    reasoning: `Score: ${score.toFixed(1)} | Odds: ${potOdds.toFixed(1)}%`,
    madeHand
  };
};

export default function App() {
  const [hand, setHand] = useState('');
  const [pos, setPos] = useState<Position>('UTG');
  const [stack, setStack] = useState(40);
  const [phase, setPhase] = useState<Phase>(2);
  const [pot, setPot] = useState(10);
  const [betToCall, setBetToCall] = useState(0);
  const [flop, setFlop] = useState('');
  const [turn, setTurn] = useState('');
  const [river, setRiver] = useState('');
  const [street, setStreet] = useState<Street>('PRE');
  
  const inputRef = useRef<HTMLInputElement>(null);

  const fullBoard = [flop, turn, river].filter(Boolean).join(' ');

  const result = useMemo(() => {
    return evaluateMTT(hand, pos, stack, phase, pot, betToCall, fullBoard);
  }, [hand, pos, stack, phase, pot, betToCall, fullBoard]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setHand('');
        setFlop('');
        setTurn('');
        setRiver('');
        setBetToCall(0);
        setStreet('PRE');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden select-none">
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
        <div className="w-full md:w-[400px] border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col gap-6 bg-slate-900/20 overflow-y-auto">
          
          <div className="flex gap-1 p-1 bg-slate-950 rounded border border-slate-800">
            {(['PRE', 'FLOP', 'TURN', 'RIVER'] as Street[]).map(s => (
              <button 
                key={s}
                onClick={() => setStreet(s)}
                className={`flex-1 py-3 text-[10px] font-bold rounded uppercase transition-colors ${street === s ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-900'}`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            {street === 'PRE' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Mão (Ex: AKs, TT)</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={hand}
                  onChange={(e) => setHand(e.target.value)}
                  className="bg-slate-800 border-2 border-slate-700 text-4xl p-4 font-mono font-bold text-white text-center focus:border-blue-500 outline-none rounded-lg uppercase"
                  placeholder="---"
                />
              </div>
            )}

            {street === 'FLOP' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Flop (3 cartas - Ex: As 7d 2c)</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={flop}
                  onChange={(e) => setFlop(e.target.value)}
                  className="bg-slate-800 border-2 border-slate-700 text-3xl p-4 font-mono font-bold text-white text-center focus:border-blue-500 outline-none rounded-lg uppercase"
                  placeholder="--- --- ---"
                />
              </div>
            )}

            {street === 'TURN' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Turn (4ª carta)</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={turn}
                  onChange={(e) => setTurn(e.target.value)}
                  className="bg-slate-800 border-2 border-slate-700 text-3xl p-4 font-mono font-bold text-white text-center focus:border-blue-500 outline-none rounded-lg uppercase"
                  placeholder="---"
                />
              </div>
            )}

            {street === 'RIVER' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">River (5ª carta)</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={river}
                  onChange={(e) => setRiver(e.target.value)}
                  className="bg-slate-800 border-2 border-slate-700 text-3xl p-4 font-mono font-bold text-white text-center focus:border-blue-500 outline-none rounded-lg uppercase"
                  placeholder="---"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Pote (BB)</label>
              <input
                type="number"
                value={pot}
                onChange={(e) => setPot(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 p-3 text-center rounded text-white font-mono font-bold"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">A Pagar (BB)</label>
              <input
                type="number"
                value={betToCall}
                onChange={(e) => setBetToCall(Number(e.target.value))}
                className="bg-slate-800 border-2 border-red-500/30 p-3 text-center rounded text-white font-mono font-bold"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Posição</label>
            <div className="grid grid-cols-3 gap-1">
              {POSITIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPos(p)}
                  className={`p-2 text-[10px] rounded border font-bold transition-all ${pos === p ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Stack: {stack}BB</label>
            <input 
              type="range" min="2" max="150" value={stack}
              onChange={(e) => setStack(parseInt(e.target.value))}
              className="w-full accent-blue-500 h-1 bg-slate-800 rounded-full appearance-none"
            />
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 p-8 flex flex-col bg-[#020617] overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={result.score + result.suggestion}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex-1 flex flex-col"
            >
              <div className={`flex-1 border-2 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-500 min-h-[300px] ${
                result.suggestion === 'PUSH' || result.suggestion === 'ALL-IN' ? 'border-red-500/30 bg-red-500/5' : 
                result.suggestion === 'FOLD' ? 'border-slate-800 bg-slate-900/20' : 
                result.suggestion === 'RAISE' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-emerald-500/30 bg-emerald-500/5'
              }`}>
                <div className={`absolute top-0 left-0 w-full h-1 ${
                  result.suggestion === 'PUSH' || result.suggestion === 'ALL-IN' ? 'bg-red-500' :
                  result.suggestion === 'FOLD' ? 'bg-slate-800' :
                  result.suggestion === 'RAISE' ? 'bg-yellow-500' : 'bg-emerald-500'
                }`}></div>
                
                <span className="text-[12px] uppercase tracking-[0.4em] font-bold mb-4 text-slate-500">Recomendação Estratégica</span>
                
                <h2 className="text-7xl md:text-[120px] leading-none font-black text-white italic tracking-tighter drop-shadow-2xl uppercase text-center">
                  {result.suggestion}
                </h2>

                <div className="mt-8 md:mt-12 flex gap-8 md:gap-12 items-center">
                  <div className="text-center group">
                    <div className="text-4xl md:text-5xl font-mono font-black text-white tracking-tighter">{result.score.toFixed(1)}</div>
                    <div className="text-[10px] uppercase text-slate-500 tracking-widest font-bold mt-1">Força</div>
                  </div>
                  <div className="w-[1px] h-12 bg-slate-800"></div>
                  <div className="text-center group">
                    <div className="text-4xl md:text-5xl font-mono font-black text-white tracking-tighter">{result.potOdds.toFixed(1)}%</div>
                    <div className="text-[10px] uppercase text-slate-500 tracking-widest font-bold mt-1">Pot Odds</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border-l-4 border-orange-400 pl-4 py-3 bg-slate-900/40 rounded-r">
                  <h3 className="text-xs font-black text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" /> JOGO IDENTIFICADO
                  </h3>
                  <p className="text-sm text-slate-400 font-medium leading-snug">
                    {result.madeHand || 'Calculando...'}
                  </p>
                </div>
                <div className="border-l-4 border-blue-400 pl-4 py-3 bg-slate-900/40 rounded-r">
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

          <div className="mt-auto pt-6 flex justify-between items-center border-t border-slate-800">
            <div className="flex gap-2">
              <button 
                onClick={() => { setHand(''); setFlop(''); setTurn(''); setRiver(''); setStreet('PRE'); setBetToCall(0); }}
                className="w-10 h-10 rounded border border-slate-700 flex items-center justify-center text-[10px] font-mono hover:bg-slate-800 text-slate-500"
              >
                ESC
              </button>
            </div>
            <button 
              onClick={() => {
                if (street === 'PRE') setStreet('FLOP');
                else if (street === 'FLOP') setStreet('TURN');
                else if (street === 'TURN') setStreet('RIVER');
                else setStreet('PRE');
                setTimeout(() => inputRef.current?.focus(), 10);
              }}
              className="bg-white text-black px-6 md:px-8 py-3 rounded font-black text-xs tracking-[0.2em] hover:bg-slate-200 uppercase transition-all"
            >
              Próxima Rua
            </button>
          </div>
        </div>
      </div>

      <div className="h-1 bg-slate-900 flex shrink-0">
        <div className={`transition-all duration-1000 ${result.suggestion === 'FOLD' ? 'w-full bg-slate-800' : 'w-1/4 bg-blue-500/30'}`}></div>
        <div className="w-1/4 bg-slate-900"></div>
        <div className="w-1/4 bg-green-500/30"></div>
        <div className="w-1/4 bg-slate-900"></div>
      </div>
    </div>
  );
}
