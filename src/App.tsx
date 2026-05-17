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
type Action = 'PUSH' | 'FOLD' | 'CALL' | 'RAISE' | 'ALL-IN' | string;
type Street = 'PRE' | 'FLOP' | 'TURN' | 'RIVER';
type VillainPosition = 'EP' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB' | 'NONE';
type VillainAction = 'FOLD' | 'CALL' | 'RAISE' | 'ALL-IN' | 'NONE';
type VillainProfile = 'AGRESSIVO' | 'MEDIO' | 'TIGHT';

interface HandHistory {
  wins: number;
  total: number;
}

interface EvaluationResult {
  score: number; // 0-10
  suggestion: Action;
  potOdds: number;
  reasoning: string;
  madeHand: string;
  history?: HandHistory;
  scoreBase?: number;
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
  const normalize = (c: string) => {
    if (c.length < 2) return c;
    const r = c[0];
    let s = c[1].toLowerCase();
    if (s === 'e') s = 's'; // Espada
    if (s === 'o') s = 'd'; // Ouro
    if (s === 'p') s = 'c'; // Paus
    if (s === 'c') s = 'h'; // Copa -> Hearts
    return r + s;
  };

  const handNormalized = handStr.toLowerCase().replace(/[^a-z0-9]/g, '');
  const board = boardStr.toLowerCase().split(' ').filter(c => c.length >= 2).map(normalize);
  const handCards = (handNormalized.match(/.{1,2}/g) || []).map(normalize);
  const fullCards = [...handCards, ...board];
  
  if (board.length === 0) {
    const h = handNormalized;
    if (/^(aa|kk)$/.test(h)) return { score: 10, description: 'AA/KK Premium' };
    if (/^(qq|ak[shdco]|jj)$/.test(h)) return { score: 9.5, description: 'JJ+ / AKs' };
    if (/^(ak|tt|aq[shdco])$/.test(h)) return { score: 9.0, description: 'AK / TT / AQs' };
    if (/^(99|aj[shdco]|aqo|kq[shdco]|88)$/.test(h)) return { score: 8.0, description: 'Mãos Fortes' };
    if (/^(at[shdco]|kj[shdco]|qj[shdco]|ajo|77|a9[shdco])$/.test(h)) return { score: 7.5, description: 'Mãos de Abertura' };
    return { score: 2.0, description: 'Lixo / Fold' };
  }

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

  if (isFlush) return { score: 9.3, description: 'Flush!' };
  if (maxConsecutive >= 5) return { score: 9.1, description: 'Sequência!' };
  if (maxCount === 4) return { score: 9.8, description: 'Quadra!' };
  if (maxCount === 3 && pairCount >= 1) return { score: 9.5, description: 'Full House' };
  if (maxCount === 3) return { score: 7.8, description: 'Trinca' };
  if (pairCount >= 2) return { score: 7.3, description: 'Dois Pares' };
  if (pairCount === 1) return { score: 5.8, description: 'Um Par' };

  if (isFlushDraw && maxConsecutive === 4) return { score: 7.5, description: 'Flush Draw + Seq Aberta' };
  if (isFlushDraw) return { score: 6.8, description: 'Flush Draw' };
  if (maxConsecutive === 4) return { score: 6.0, description: 'Sequência Aberta' };

  return { score: 3.0, description: 'Carta Alta / Sem Jogo' };
};

const evaluateMTT = (
  hand: string,
  pos: Position,
  stack: number,
  phase: number,
  pot: number,
  call: number,
  board: string,
  learningData: Record<string, HandHistory>,
  villainPos: VillainPosition,
  villainAction: VillainAction,
  villainProfile: VillainProfile
): EvaluationResult => {
  const { score: baseScore, description: madeHand } = evaluateHand(hand, board);
  let score = baseScore;
  const potOdds = call > 0 ? (call / (pot + call)) * 100 : 0;
  const posIndex = POSITIONS.indexOf(pos);

  // --- Perfil do Vilão ---
  if (villainProfile === 'AGRESSIVO') score += 1.5;
  if (villainProfile === 'TIGHT') score -= 1.5;

  // --- Lógica do Vilão ---
  if (villainAction !== 'NONE') {
    if (villainAction === 'FOLD') {
      score += 0.5; // Vilão foldou, mesa mais limpa
    } else if (villainAction === 'CALL') {
      // Score base mantido
    } else if (villainAction === 'RAISE') {
      // Posição ruim do vilão (EP/MP) = Range muito forte
      if (villainPos === 'EP' || villainPos === 'MP') {
        score -= 1.2;
      } else {
        score -= 0.6;
      }
    } else if (villainAction === 'ALL-IN') {
      score -= 2.5; 
    }
  }

  // Chave de aprendizado simplificada (ignora detalhes de naipes para agrupar melhor os dados)
  const handKey = hand.toLowerCase().replace(/[eocp]/g, 'x'); 
  const stackType = stack < 15 ? 'SHORT' : stack < 40 ? 'MEDIUM' : 'DEEP';
  const learningKey = `${handKey}:${pos}:${stackType}:${phase}`;
  const history = learningData[learningKey];

  // Ajuste do sistema baseado no aprendizado (mínimo 5 mãos para confiar)
  if (history && history.total >= 5) {
    const winRate = history.wins / history.total;
    if (winRate >= 0.60) score += 1.5; // Usuário ganha muito com essa mão aqui -> seja mais agressivo
    if (winRate <= 0.40) score -= 1.5; // Usuário perde muito -> seja mais conservador
  }
  
  if (board === '') {
    if (posIndex <= 2) score -= 1.8; 
    if (pos === 'LJ') score -= 0.8;
    if (pos === 'HJ') score += 0.2;  
    if (pos === 'CO') score += 1.5;  
    if (pos === 'BTN') score += 3.2; 
    if (pos === 'SB') score += 2.2;  
    
    if (phase === 1) score -= 0.5;
    else if (phase === 3) score -= 2.0;
    else if (phase === 4) score += 0.5;
    else if (phase === 5) score += 1.2;

    if (stack < 15 && score >= 4.0) score += 2.5; 
    if (stack < 10) score += 1.5;
  }
  
  if (board !== '') {
    if (phase === 3) score -= 0.5;
    if (phase === 5) score += 0.3;
  }

  let suggestion: Action = 'FOLD';
  let raiseSize = '';

  // Bloqueio de segurança contra All-in do vilão
  if (villainAction === 'ALL-IN' && score < 9.0) {
    suggestion = 'FOLD';
  } else if (score >= 8.5) {
    suggestion = 'ALL-IN';
  } else if (score >= 6.5) {
    if (villainAction === 'RAISE' && score < 7.5) {
      suggestion = 'FOLD'; // Desistir de mãos marginais contra raises
    } else if (potOdds < 30) {
      suggestion = 'RAISE';
      if (stack > 50 || posIndex <= 2) raiseSize = ' (3x-4x)';
      else raiseSize = ' (2x-2.5x)';
    } else {
      suggestion = 'CALL';
    }
  } else if (score >= 4.5) {
    // Se houve agressão do vilão e a mão é apenas média, foldar
    if (villainAction === 'RAISE' || villainAction === 'ALL-IN') {
      suggestion = 'FOLD';
    } else {
      suggestion = potOdds < 25 ? 'CALL' : 'FOLD';
    }
  } else {
    suggestion = 'FOLD';
  }

  const posReasoning = {
    'UTG': 'UTG (12%): Conservador.',
    'UTG+1': 'UTG+1 (12%).',
    'UTG+2': 'UTG+2 (12%).',
    'LJ': 'LJ (14%).',
    'HJ': 'HJ (18%).',
    'CO': 'CO (28%): Atacar.',
    'BTN': 'BTN (45%): Roubo agressivo.',
    'SB': 'SB (35%): Amplo, mas Cuidado.',
    'BB': 'BB: Defesa.'
  };

  return { 
    score: Math.min(10, Math.max(0, score)), 
    suggestion: (suggestion + raiseSize) as Action, 
    potOdds, 
    reasoning: board === '' ? posReasoning[pos] : `Score Pós-Flop: ${score.toFixed(1)} | Odds: ${potOdds.toFixed(1)}%`,
    madeHand,
    history,
    scoreBase: score // Pass score to UI if needed
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
  const [villainPos, setVillainPos] = useState<VillainPosition>('NONE');
  const [villainAction, setVillainAction] = useState<VillainAction>('NONE');
  const [villainProfile, setVillainProfile] = useState<VillainProfile>('MEDIO');
  const [learningData, setLearningData] = useState<Record<string, HandHistory>>(() => {
    const saved = localStorage.getItem('mtt_learning_data_v1');
    return saved ? JSON.parse(saved) : {};
  });
  
  const inputRef = useRef<HTMLInputElement>(null);

  const fullBoard = [flop, turn, river].filter(Boolean).join(' ');

  const result = useMemo(() => {
    if (!hand) return null;
    return evaluateMTT(hand, pos, stack, phase, pot, betToCall, fullBoard, learningData, villainPos, villainAction, villainProfile);
  }, [hand, pos, stack, phase, pot, betToCall, fullBoard, learningData, villainPos, villainAction, villainProfile]);

  const recordOutcome = (won: boolean) => {
    if (!hand) return;
    const handKey = hand.toLowerCase().replace(/[eocp]/g, 'x'); 
    const stackType = stack < 15 ? 'SHORT' : stack < 40 ? 'MEDIUM' : 'DEEP';
    const learningKey = `${handKey}:${pos}:${stackType}:${phase}`;
    
    const current = learningData[learningKey] || { wins: 0, total: 0 };
    const updated = {
      ...learningData,
      [learningKey]: {
        wins: current.wins + (won ? 1 : 0),
        total: current.total + 1
      }
    };
    
    setLearningData(updated);
    localStorage.setItem('mtt_learning_data_v1', JSON.stringify(updated));
  };

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
            Assistente MTT <span className="text-blue-500 font-normal text-xs font-mono italic">LEARNING_PRO</span>
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
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  Mão (Ex: AhKs, 99, 72o)
                  <span className="block text-[8px] opacity-40">Naipe: o=ouro, e=espada, c=copa, p=paus</span>
                </label>
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
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  Flop (Ex: As 7o 2c)
                  <span className="block text-[8px] opacity-40">Espaçado. Ex: Ad 7h 2c</span>
                </label>
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
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Inves. (BB)</label>
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

          <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-lg flex flex-col gap-3">
             <div className="flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-red-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Simulação do Vilão</span>
             </div>
             
             <div className="flex flex-col gap-2">
                <label className="text-[8px] uppercase text-slate-500 font-bold">Onde ele está?</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['EP', 'MP', 'CO', 'BTN', 'SB', 'BB', 'NONE'] as VillainPosition[]).map(vp => (
                    <button 
                      key={vp}
                      onClick={() => setVillainPos(vp)}
                      className={`py-1 text-[8px] font-bold rounded border ${villainPos === vp ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-600'}`}
                    >
                      {vp}
                    </button>
                  ))}
                </div>
             </div>

             <div className="flex flex-col gap-2">
                <label className="text-[8px] uppercase text-slate-500 font-bold">O que ele fez?</label>
                <div className="grid grid-cols-2 gap-1">
                  {(['NONE', 'FOLD', 'CALL', 'RAISE', 'ALL-IN'] as VillainAction[]).map(va => (
                    <button 
                      key={va}
                      onClick={() => setVillainAction(va)}
                      className={`py-2 text-[9px] font-black rounded border transition-all ${villainAction === va ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
                    >
                      {va}
                    </button>
                  ))}
                </div>
             </div>

             <div className="flex flex-col gap-2 mt-2">
                <label className="text-[8px] uppercase text-slate-500 font-bold">Perfil do Vilão (Estimado)</label>
                <div className="grid grid-cols-3 gap-1">
                  <button 
                    onClick={() => setVillainProfile('AGRESSIVO')}
                    className={`py-2 text-[8px] font-black rounded border transition-all ${villainProfile === 'AGRESSIVO' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-800 text-emerald-600/60'}`}
                  >
                    AGRESSIVO
                  </button>
                  <button 
                    onClick={() => setVillainProfile('MEDIO')}
                    className={`py-2 text-[8px] font-black rounded border transition-all ${villainProfile === 'MEDIO' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
                  >
                    MÉDIO
                  </button>
                  <button 
                    onClick={() => setVillainProfile('TIGHT')}
                    className={`py-2 text-[8px] font-black rounded border transition-all ${villainProfile === 'TIGHT' ? 'bg-red-900 border-red-800 text-white' : 'bg-slate-900 border-slate-800 text-red-500/60'}`}
                  >
                    TIGHT
                  </button>
                </div>
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
            {result ? (
              <motion.div
                key={result.score + result.suggestion}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="flex-1 flex flex-col"
              >
                <div className={`flex-1 border-2 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-500 min-h-[300px] ${
                  result.suggestion.includes('PUSH') || result.suggestion.includes('ALL-IN') ? 'border-red-500/30 bg-red-500/5' : 
                  result.suggestion === 'FOLD' ? 'border-slate-800 bg-slate-900/20' : 
                  result.suggestion.includes('RAISE') ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-emerald-500/30 bg-emerald-500/5'
                }`}>
                  <div className={`absolute top-0 left-0 w-full h-1 ${
                    result.suggestion.includes('PUSH') || result.suggestion.includes('ALL-IN') ? 'bg-red-500' :
                    result.suggestion === 'FOLD' ? 'bg-slate-800' :
                    result.suggestion.includes('RAISE') ? 'bg-yellow-500' : 'bg-emerald-500'
                  }`}></div>
                  
                  <span className="text-[12px] uppercase tracking-[0.4em] font-bold mb-4 text-slate-500">Sugestão MTT IA</span>
                  
                  <h2 className="text-6xl md:text-8xl leading-none font-black text-white italic tracking-tighter drop-shadow-2xl uppercase text-center">
                    {result.suggestion}
                  </h2>
  
                  <div className="mt-8 flex gap-8 items-center">
                    <div className="text-center">
                      <div className="text-4xl font-mono font-black text-white tracking-tighter">{result.score.toFixed(1)}</div>
                      <div className="text-[10px] uppercase text-slate-500 font-bold mt-1 tracking-widest">Score</div>
                    </div>
                    <div className="w-[1px] h-12 bg-slate-800"></div>
                    <div className="text-center">
                      <div className="text-4xl font-mono font-black text-white tracking-tighter">{result.potOdds.toFixed(1)}%</div>
                      <div className="text-[10px] uppercase text-slate-500 font-bold mt-1 tracking-widest">Odds</div>
                    </div>
                  </div>
                </div>
  
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-900 border-l-4 border-orange-400 rounded-r">
                    <h3 className="text-xs font-black text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <ShieldCheck className="w-3 h-3" /> ANÁLISE DE MÃO
                    </h3>
                    <p className="text-sm text-slate-400 font-medium">
                      {result.madeHand} — {result.reasoning}
                    </p>
                    {villainProfile !== 'MEDIO' && (
                      <div className="mt-2 text-[10px] font-bold text-slate-500 uppercase">
                        Perfil: <span className={villainProfile === 'AGRESSIVO' ? 'text-emerald-500' : 'text-red-500'}>{villainProfile}</span>
                        {villainProfile === 'AGRESSIVO' ? ' (Ajuste +1.5)' : ' (Ajuste -1.5)'}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 bg-slate-900 border-l-4 border-blue-500 rounded-r flex flex-col">
                    <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <Trophy className="w-3 h-3" /> HISTÓRICO & APRENDIZADO
                    </h3>
                    {result.history ? (
                      <p className="text-sm text-slate-300 font-bold">
                        Jogado {result.history.total}x | Vitória: {((result.history.wins / result.history.total) * 100).toFixed(0)}%
                        <span className="block text-[10px] text-slate-500 font-normal mt-1 italic">Sistema ajustado para o seu perfil.</span>
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">Nenhum dado prévio para esta mão nesta posição/fase.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-center md:text-left">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Você ganhou essa mão?</div>
                    <div className="text-[10px] text-slate-600 uppercase">Input manual para alimentar a IA</div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => recordOutcome(true)}
                      className="flex-1 md:flex-none px-6 py-2 bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white rounded font-black text-[10px] transition-all"
                    >
                      SIM, GANHEI
                    </button>
                    <button 
                      onClick={() => recordOutcome(false)}
                      className="flex-1 md:flex-none px-6 py-2 bg-red-600/10 hover:bg-red-600 border border-red-500/50 text-red-400 hover:text-white rounded font-black text-[10px] transition-all"
                    >
                      NÃO, PERDI
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-700">
                <Zap className="w-20 h-20 mb-6 opacity-10" />
                <p className="text-sm animate-pulse tracking-[0.2em] uppercase font-bold">Aguardando definição da mão...</p>
                <div className="mt-8 text-[10px] opacity-40 uppercase tracking-widest max-w-xs text-center leading-relaxed">
                  Insira o formato da mão (ex: A9o ou Ah9s) e o assistente analisará o seu histórico de ganhos para sugerir o melhor move.
                </div>
              </div>
            )}
          </AnimatePresence>
  
          <div className="mt-auto pt-6 flex justify-between items-center border-t border-slate-800">
            <button 
              onClick={() => { setHand(''); setFlop(''); setTurn(''); setRiver(''); setStreet('PRE'); setBetToCall(0); }}
              className="px-4 py-2 border border-slate-800 rounded text-[10px] font-black text-slate-600 hover:bg-slate-900 hover:text-slate-400 uppercase transition-all"
            >
              Resetar (ESC)
            </button>
            <button 
              onClick={() => {
                if (street === 'PRE') setStreet('FLOP');
                else if (street === 'FLOP') setStreet('TURN');
                else if (street === 'TURN') setStreet('RIVER');
                else setStreet('PRE');
                setTimeout(() => inputRef.current?.focus(), 10);
              }}
              className="bg-white text-black px-10 py-3 rounded-full font-black text-xs tracking-[0.2em] shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 transition-all uppercase"
            >
              Próxima Rua
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
