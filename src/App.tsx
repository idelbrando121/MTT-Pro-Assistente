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

const GTO_RANGES_INTERNAL = {
  EP: ['aa', 'kk', 'qq', 'jj', 'tt', 'aks', 'aqs', 'ajs', 'ako', 'aqo'],
  MP: ['aa', 'kk', 'qq', 'jj', 'tt', '99', 'aks', 'aqs', 'ajs', 'ats', 'ako', 'aqo', 'ajo', 'kqs', 'kjs', 'qjs'],
  CO: ['aa', 'kk', 'qq', 'jj', 'tt', '99', '88', '77', 'aks', 'aqs', 'ajs', 'ats', 'a9s', 'ako', 'aqo', 'ajo', 'ato', 'kqs', 'kjs', 'kts', 'k9s', 'kqo', 'kjo', 'kto', 'qjs', 'qts', 'q9s', 'qjo', 'jts', 'j9s', 't9s', '98s'],
  BTN: ['aa', 'kk', 'qq', 'jj', 'tt', '99', '88', '77', '66', '55', '44', '33', '22', 'aks', 'aqs', 'ajs', 'ats', 'a9s', 'a8s', 'a7s', 'a6s', 'a5s', 'a4s', 'a3s', 'a2s', 'ako', 'aqo', 'ajo', 'ato', 'a9o', 'a8o', 'a7o', 'a6o', 'a5o', 'a4o', 'a3o', 'a2o', 'kqs', 'kjs', 'kts', 'k9s', 'k8s', 'k7s', 'k6s', 'k5s', 'k4s', 'k3s', 'k2s', 'kqo', 'kjo', 'kto', 'k9o', 'k8o', 'k7o', 'k6o', 'k5o', 'k4o', 'k3o', 'k2o', 'qjs', 'qts', 'q9s', 'q8s', 'q7s', 'q6s', 'q5s', 'qjo', 'qto', 'q9o', 'q8o', 'jts', 'j9s', 'j8s', 'j7s', 'jto', 't9s', 't8s', 't7s', 't9o', '98s', '97s', '98o', '87s', '86s', '76s', '75s', '65s', '54s', '43s'],
  SB: ['aa', 'kk', 'qq', 'jj', 'tt', '99', '88', '77', 'aks', 'aqs', 'ajs', 'ats', 'a9s', 'a8s', 'ako', 'aqo', 'ajo', 'ato', 'kqs', 'kjs', 'kts', 'kqo', 'kjo', 'qjs', 'qts', 'jts', 't9s', '98s', '87s'],
  BB: ["22","33","44","55","66","77","88","99","tt","jj","qq","kk","aa","a2o","a3o","a4o","a5o","a6o","a7o","a8o","a9o","ato","ajo","aqo","ako","a2s","a3s","a4s","a5s","a6s","a7s","a8s","a9s","ats","ajs","aqs","aks","k2o","k3o","k4o","k5o","k6o","k7o","k8o","k9o","kto","kjo","kqo","k2s","k3s","k4s","k5s","k6s","k7s","k8s","k9s","kts","kjs","kqs","q8o","q9o","qto","qjo","q5s","q6s","q7s","q8s","q9s","qts","qjs","j8o","j9o","jto","j5s","j6s","j7s","j8s","j9s","jts","t8o","t9o","t6s","t7s","t8s","t9s","98o","96s","97s","98s","87s","85s","86s","76s","75s","65s","54s","53s","64s"],
  BB_DEFENSE: ["22","33","44","55","66","77","88","99","tt","jj","qq","kk","aa","a2o","a3o","a4o","a5o","a6o","a7o","a8o","a9o","ato","ajo","aqo","ako","a2s","a3s","a4s","a5s","a6s","a7s","a8s","a9s","ats","ajs","aqs","aks","k2o","k3o","k4o","k5o","k6o","k7o","k8o","k9o","kto","kjo","kqo","k2s","k3s","k4s","k5s","k6s","k7s","k8s","k9s","kts","kjs","kqs","q8o","q9o","qto","qjo","q5s","q6s","q7s","q8s","q9s","qts","qjs","j8o","j9o","jto","j5s","j6s","j7s","j8s","j9s","jts","t8o","t9o","t6s","t7s","t8s","t9s","98o","96s","97s","98s","87s","85s","86s","76s","75s","65s","54s","53s","64s"],
  BB_3BET_VALUE: ["aa", "kk", "qq", "jj", "tt", "aks", "ako", "aqs"],
  BB_3BET_BLUFF: ["a2o", "a3o", "a4o", "a5o", "k4o", "k5o", "k6o", "k7o", "t7o", "86s", "75s"]
};

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
  spr?: number;
  proTip?: string;
  texture?: 'DRY' | 'WET' | 'NEUTRAL';
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

const evaluateHand = (handStr: string, boardStr: string): { score: number, description: string, texture?: 'DRY' | 'WET' | 'NEUTRAL' } => {
  const normalize = (c: string) => {
    if (!c || c.length < 2) return c;
    let r = '';
    let s = '';
    
    const trimmed = c.trim();
    if (trimmed.startsWith('10')) {
      r = 'T';
      s = trimmed.substring(2);
    } else {
      r = trimmed[0].toUpperCase();
      s = trimmed.substring(1);
    }

    const suitMap: Record<string, string> = {
      '♥': 'h', 'h': 'h', 'c': 'h', 'copa': 'h',
      '♦': 'd', 'd': 'd', 'o': 'd', 'ouro': 'd',
      '♣': 'c', 'p': 'c', 'paus': 'c',
      '♠': 's', 's': 's', 'e': 's', 'espada': 's'
    };

    // Special case for 'c' which can be Clubs (paus) or Copa (Hearts)
    // In many PT contexts, 'c' is Copa. In standard poker, 'c' is Clubs.
    // We already handle symbols ♥ and ♣.
    
    let finalSuit = '';
    for (const char of s.toLowerCase()) {
      if (suitMap[char]) {
        finalSuit = suitMap[char];
        break;
      }
    }
    
    if (!finalSuit) finalSuit = s[0]?.toLowerCase() || 'x';

    return r + finalSuit;
  };

  const handNormalized = handStr.toLowerCase();
  const isSuitedInput = handNormalized.includes('s') && !handNormalized.includes('h') && !handNormalized.includes('d') && !handNormalized.includes('c');
  
  const board = boardStr.split(' ').filter(c => c.trim().length >= 2).map(normalize);
  
  // Post-flop: extract full cards from hand string (e.g. "Ah Kh")
  let handCards: string[] = [];
  const cardRegex = /([2-9tjqka]|10)[hsdc♥♦♣♠eo cp]/gi;
  const matchedCards = handStr.match(cardRegex);
  
  if (matchedCards && matchedCards.length >= 2) {
    handCards = matchedCards.map(normalize);
  } else {
    // Pre-flop format fallback "AKs", "72o"
    // For post-flop evaluation, we need specific suits for flush detection.
    // If they typed "AKs" on flop, we assume they are suited but suits are unknown 'x'
    const ranks = handNormalized.replace(/[^2-9tjqka]/g, '').toUpperCase();
    if (ranks.length >= 2) {
      if (isSuitedInput) {
        handCards = [ranks[0] + 'x', ranks[1] + 'x'];
      } else {
        handCards = [ranks[0] + 'x', ranks[1] + 'y'];
      }
    }
  }

  const fullCards = [...handCards, ...board];
  
  if (board.length === 0) {
    // Score based on GTO range membership (handled in evaluateMTT)
    return { score: 1.0, description: 'Pré-Flop Evaluation' };
  }

  const ranksCount: Record<string, number> = {};
  const suitsCount: Record<string, number> = {};
  
  fullCards.forEach(c => {
    const r = c[0];
    const s = c[1];
    ranksCount[r] = (ranksCount[r] || 0) + 1;
    if (s && s !== 'x' && s !== 'y') suitsCount[s] = (suitsCount[s] || 0) + 1;
    // Handle the dummy 'x' suit for AKs inputs
    if (s === 'x') suitsCount['dummy_suited'] = (suitsCount['dummy_suited'] || 0) + 1;
  });

  const counts = Object.values(ranksCount);
  const maxCount = Math.max(...counts);
  const pairCount = counts.filter(v => v === 2).length;
  
  // Flush detection
  let isFlush = false;
  let isFlushDraw = false;
  let isBackdoor = false;

  Object.values(suitsCount).forEach(v => {
    if (v >= 5) isFlush = true;
    if (v === 4) isFlushDraw = true;
    if (v === 3 && board.length === 3) isBackdoor = true;
  });

  const rankValues = Object.keys(ranksCount)
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

  // Texture Analysis
  let texture: 'DRY' | 'WET' | 'NEUTRAL' = 'NEUTRAL';
  const highCards = rankValues.filter(v => v >= 10).length;
  if (isFlushDraw || maxConsecutive >= 3 || highCards >= 2) texture = 'WET';
  else if (maxCount === 1 && maxConsecutive < 3) texture = 'DRY';

  let finalScore = 3.0;
  let finalDesc = 'Carta Alta';

  if (isFlush) { finalScore = 9.3; finalDesc = 'Flush!'; }
  else if (maxCount === 4) { finalScore = 9.8; finalDesc = 'Quadra!'; }
  else if (maxCount === 3 && pairCount >= 1) { finalScore = 9.5; finalDesc = 'Full House'; }
  else if (maxConsecutive >= 5) { finalScore = 9.1; finalDesc = 'Sequência!'; }
  else if (maxCount === 3) { finalScore = 7.8; finalDesc = 'Trinca'; }
  else if (pairCount >= 2) { finalScore = 7.3; finalDesc = 'Dois Pares'; }
  else if (pairCount === 1) { finalScore = 5.8; finalDesc = 'Um Par'; }

  // Draw adjustments (Pro Level)
  if (!isFlush) {
    if (isFlushDraw && maxConsecutive === 4) {
      finalScore += 2.5; // Monster Draw
      finalDesc += ' + COMBO DRAW (Flush + Seq)';
    } else if (isFlushDraw) {
      finalScore += 1.8;
      finalDesc += ' + Flush Draw';
    } else if (isBackdoor) {
      finalScore += 0.6;
      finalDesc += ' + Bckdr Flush';
    }
  }

  if (maxConsecutive === 4 && finalScore < 8.0) {
    finalScore += 1.4;
    if (!finalDesc.includes('Draw')) finalDesc += ' + Seq Aberta';
  } else if (maxConsecutive === 3 && texture === 'WET') {
    finalScore += 0.4; // Gutshot logic simplified
  }

  return { score: finalScore, description: finalDesc, texture };
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
  villainProfile: VillainProfile,
  playersInPot: number
): EvaluationResult => {
  try {
    const { score: baseScore, description: madeHand, texture } = evaluateHand(hand, board);
    let score = baseScore;
    const potOdds = call > 0 ? (call / (pot + call)) * 100 : 0;
    const spr = board !== '' ? stack / pot : undefined;
    
    // Elite Tactical Rule: SPR (Stack to Pot Ratio)
    let tacticalAdvice = "";
    if (spr !== undefined) {
      if (spr < 3) tacticalAdvice = "Comprometido com o pote (Low SPR). Prepare-se para o All-in.";
      else if (spr > 10) tacticalAdvice = "Pote profundo. Controle o range e evite over-commit.";
      else tacticalAdvice = "SPR Médio. Manobras táticas padrão.";
    }

    // --- Perfil do Vilão (Exploitative Pro Play) ---
    let villainReasoning = "";
    if (villainProfile === 'AGRESSIVO') {
      score += 1.2;
      villainReasoning = "Vilão agressivo abre ranges, podemos punir com calls mais largos ou re-raises.";
    } else if (villainProfile === 'TIGHT') {
      score -= 1.8;
      villainReasoning = "Vilão tight só joga o topo do range. Respeite muita força aqui.";
    }

    const handKey = (hand || '').toLowerCase().replace(/[eocp]/g, 'x'); 
    const stackType = stack < 20 ? 'SHORT' : stack < 50 ? 'MEDIUM' : 'DEEP';
    const history = learningData[`${handKey}:${pos}:${stackType}:${phase}`];

    if (board === '') {
      const h = hand.toLowerCase().replace(/[^a-z0-9]/g, '');
      let category: 'EP' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB' = 'EP';
      if (['UTG', 'UTG+1', 'UTG+2'].includes(pos)) category = 'EP';
      else if (['LJ', 'HJ'].includes(pos)) category = 'MP';
      else if (pos === 'CO') category = 'CO';
      else if (pos === 'BTN') category = 'BTN';
      else if (pos === 'SB') category = 'SB';
      else category = 'BB';

      if (category === 'BB' && villainAction === 'RAISE' && ['CO', 'BTN', 'SB'].includes(villainPos)) {
        if (GTO_RANGES_INTERNAL.BB_3BET_VALUE.includes(h)) {
          return { score: 10, suggestion: 'RAISE (3-BET Value)', potOdds, spr, texture, reasoning: 'GTO Pro: 3-Bet obrigatória por valor para polarizar o vilão.', madeHand: 'Premium Value', proTip: "Contra vilões que abrem muito no BTN, aumente o tamanho do seu 3-bet." };
        } else if (GTO_RANGES_INTERNAL.BB_3BET_BLUFF.includes(h)) {
          return { score: 8.5, suggestion: 'RAISE (3-BET Bluff)', potOdds, spr, texture, reasoning: 'Elite Bluff: Use blockers de Ax/Kx para forçar o fold no BTN.', madeHand: 'Semi-Bluff / Blocker', proTip: "Se o vilão der call, jogue de forma agressiva em boards secos." };
        } else if (GTO_RANGES_INTERNAL.BB_DEFENSE.includes(h)) {
          return { score: 7.5, suggestion: 'CALL', potOdds, spr, texture, reasoning: 'Defense GTO: As odds do BB exigem call com quase qualquer mão conectada.', madeHand: 'Defesa Matemática', proTip: "Check-fold em boards onde você não acertar nada. Não force a barra." };
        }
      }

      const range = (GTO_RANGES_INTERNAL as any)[category] || [];
      if (range.includes(h)) {
        const raiseSizeTxt = stack < 20 ? ' (ALL-IN)' : (stack > 60 ? ' (2.5x)' : ' (2.2x)');
        return { score: 8.5, suggestion: ('RAISE' + raiseSizeTxt) as Action, potOdds, spr, texture, reasoning: `Pro Open: Posição ${category} permite atacar blinds.`, madeHand: 'Range de Elite', proTip: `Se houver vilões agressivos à esquerda, diminua o range de abertura de ${category}.` };
      } else {
        return { score: 2.0, suggestion: 'FOLD', potOdds, spr, texture, reasoning: `Safe Play: Mão muito fraca para manter o lucro no longo prazo em ${category}.`, madeHand: 'Fold Disciplinado', proTip: "Paciência é a maior virtude de um campeão de MTT." };
      }
    }

    let suggestion: Action = 'FOLD';
    let proTip = "Foque na leitura do oponente. O poker é um jogo de pessoas usando cartas.";
    let finalReasoning = "";

    if (board !== '') {
      if (villainAction === 'ALL-IN' && score < 9.0) {
        suggestion = 'FOLD';
        finalReasoning = "Sobrevivência Profissional: Não jogue o torneio fora em um coinflip duvidoso.";
        proTip = "Em torneios, preservar stack é mais importante do que ganhar potes marginais.";
      } else if (score >= 8.5) {
        suggestion = 'ALL-IN';
        finalReasoning = "Value Max: Você está no topo do range. Extraia cada ficha possível.";
        proTip = "Não dê slowplay em boards 'Wet'. Cobrar caro de draws é o padrão pro.";
      } else if (score >= 6.5) {
        if (texture === 'WET' && villainAction === 'RAISE' && score < 7.5) {
            suggestion = 'FOLD';
            finalReasoning = "Proteção de Equity: Board perigoso demais para pagar raises com mãos médias.";
        } else if (spr !== undefined && spr < 3) {
            suggestion = 'ALL-IN';
            finalReasoning = "Commitment: Com baixo SPR e uma mão digna, o único caminho é empurrar.";
        } else {
            suggestion = potOdds < 30 ? 'CALL' : 'RAISE';
            finalReasoning = suggestion === 'CALL' ? 'Pot Control: Mantendo o pote pequeno com mão de valor médio.' : 'Agosto Tático: Colocando pressão no range do vilão.';
        }
      } else if (score >= 4.5 && texture === 'DRY') {
          suggestion = 'CALL';
          finalReasoning = "Floating Pro: Pagando no board seco para tentar levar o pote no turn.";
          proTip = "Boards como A-7-2 seco são ótimos para testar a força do vilão com um call.";
      }
    }

    return { 
      score: isNaN(score) ? 0 : Math.min(10, Math.max(0, score)), 
      suggestion: suggestion as Action, 
      potOdds: isNaN(potOdds) ? 0 : potOdds, 
      reasoning: finalReasoning || tacticalAdvice || villainReasoning || "Análise Completa.",
      madeHand,
      history,
      scoreBase: score,
      spr,
      proTip,
      texture
    };
  } catch (err) {
    console.error("Evaluation error:", err);
    return {
      score: 5.0,
      suggestion: 'FOLD',
      potOdds: 0,
      reasoning: 'Erro na análise. Recomendado cautela.',
      madeHand: 'Erro de Dados'
    };
  }
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
  const [playersInPot, setPlayersInPot] = useState<number>(2);
  const [suitedToggle, setSuitedToggle] = useState<boolean | null>(null);
  const [learningData, setLearningData] = useState<Record<string, HandHistory>>(() => {
    const saved = localStorage.getItem('mtt_learning_data_v1');
    return saved ? JSON.parse(saved) : {};
  });
  
  const inputRef = useRef<HTMLInputElement>(null);

  const fullBoard = [flop, turn, river].filter(Boolean).join(' ');

  const result = useMemo(() => {
    if (!hand) return null;
    return evaluateMTT(hand, pos, stack, phase, pot, betToCall, fullBoard, learningData, villainPos, villainAction, villainProfile, playersInPot);
  }, [hand, pos, stack, phase, pot, betToCall, fullBoard, learningData, villainPos, villainAction, villainProfile, playersInPot]);

  const canContinue = useMemo(() => {
    if (street === 'PRE') return hand.length >= 2;
    if (street === 'FLOP') return flop.trim().split(' ').length >= 3;
    if (street === 'TURN') return turn.length >= 2;
    if (street === 'RIVER') return river.length >= 2;
    return false;
  }, [street, hand, flop, turn, river]);

  const handleNextStreet = () => {
    if (!canContinue) return;
    if (street === 'PRE') setStreet('FLOP');
    else if (street === 'FLOP') setStreet('TURN');
    else if (street === 'TURN') setStreet('RIVER');
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleFold = () => {
    setHand('');
    setFlop('');
    setTurn('');
    setRiver('');
    setStreet('PRE');
    setBetToCall(0);
    setVillainAction('NONE');
    setVillainPos('NONE');
  };

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
        handleFold();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const nextStreetLabel = street === 'PRE' ? 'CONTINUAR PARA O FLOP?' : 
                          street === 'FLOP' ? 'CONTINUAR PARA O TURN?' : 
                          street === 'TURN' ? 'CONTINUAR PARA O RIVER?' : '';

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
            {(['PRE', 'FLOP', 'TURN', 'RIVER'] as Street[]).map(s => {
              const isActive = street === s;
              const isLocked = (s === 'FLOP' && !hand) || 
                               (s === 'TURN' && (!hand || !flop)) || 
                               (s === 'RIVER' && (!hand || !flop || !turn));
              return (
                <button 
                  key={s}
                  onClick={() => !isLocked && setStreet(s)}
                  disabled={isLocked}
                  className={`flex-1 py-3 text-[10px] font-bold rounded uppercase transition-colors ${isActive ? 'bg-blue-600 text-white' : isLocked ? 'text-slate-800 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-900'}`}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-4">
            {street === 'PRE' && (
              <div className="flex flex-col gap-3">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  Sua Mão (Ex: AKs, AKo, TT)
                  <span className="block text-[8px] opacity-40">Add 's' para mesmo naipe ou 'o' para diferentes</span>
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={hand}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.toLowerCase() === 'desistir') handleFold();
                    else setHand(val);
                  }}
                  className="bg-slate-800 border-2 border-slate-700 text-4xl p-4 font-mono font-bold text-white text-center focus:border-blue-500 outline-none rounded-lg uppercase"
                  placeholder="---"
                />
                
                {hand.length === 2 && hand[0] !== hand[1] && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setHand(prev => prev.replace(/[so]/gi, '') + 's'); setSuitedToggle(true); }}
                      className={`flex-1 py-2 text-[10px] font-black rounded border transition-all ${hand.toLowerCase().includes('s') ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                    >
                      MESMO NAIPE (s)
                    </button>
                    <button 
                      onClick={() => { setHand(prev => prev.replace(/[so]/gi, '') + 'o'); setSuitedToggle(false); }}
                      className={`flex-1 py-2 text-[10px] font-black rounded border transition-all ${hand.toLowerCase().includes('o') ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                    >
                      NAIPES DIF. (o)
                    </button>
                  </div>
                )}
              </div>
            )}

            {street !== 'PRE' && (
              <div className="flex flex-col gap-4">
                 <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                      {street === 'FLOP' ? '3 Cartas do Flop' : street === 'TURN' ? '4ª Carta (Turn)' : '5ª Carta (River)'}
                      <span className="block text-[8px] opacity-40 italic">Ex: A♥ 7♦ 2♣ ou Ah 7d 2c</span>
                    </label>
                    <div className="relative">
                      <input
                        ref={inputRef}
                        type="text"
                        value={street === 'FLOP' ? flop : street === 'TURN' ? turn : river}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.toLowerCase() === 'desistir') handleFold();
                          if (street === 'FLOP') setFlop(val);
                          else if (street === 'TURN') setTurn(val);
                          else setRiver(val);
                        }}
                        className="w-full bg-slate-800 border-2 border-slate-700 text-2xl p-4 font-mono font-bold text-white text-center focus:border-blue-500 outline-none rounded-lg uppercase"
                        placeholder="VALOR + NAIPE"
                      />
                    </div>
                 </div>
                 <div className="grid grid-cols-4 gap-1">
                    {[
                      { s: '♥', c: 'text-red-500', char: 'h' },
                      { s: '♦', c: 'text-blue-400', char: 'd' },
                      { s: '♣', c: 'text-emerald-500', char: 'c' },
                      { s: '♠', c: 'text-white', char: 's' }
                    ].map(suit => (
                      <button
                        key={suit.s}
                        onClick={() => {
                          const setter = street === 'FLOP' ? setFlop : street === 'TURN' ? setTurn : setRiver;
                          const current = street === 'FLOP' ? flop : street === 'TURN' ? turn : river;
                          setter(current + suit.s + ' ');
                        }}
                        className={`py-3 bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 transition-colors ${suit.c} text-xl font-bold`}
                      >
                        {suit.s}
                      </button>
                    ))}
                 </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Valor do Pote (BB)</label>
              <input
                type="number"
                value={pot}
                onChange={(e) => setPot(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 p-3 text-center rounded text-white font-mono font-bold"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Valor da Aposta (BB)</label>
              <input
                type="number"
                value={betToCall}
                onChange={(e) => setBetToCall(Number(e.target.value))}
                className="bg-slate-800 border-2 border-red-500/30 p-3 text-center rounded text-white font-mono font-bold"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Sua Posição</label>
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
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              {street === 'PRE' ? 'Jogadores no Pote' : 'Jogadores Restantes'}
            </label>
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setPlayersInPot(n)}
                  className={`py-2 text-[10px] font-bold rounded border transition-all ${
                    playersInPot === n ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {n}{n === 5 ? '+' : ''}
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
                  {result.texture && (
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                       <span className={`px-2 py-1 text-[8px] font-black rounded border ${
                         result.texture === 'WET' ? 'bg-red-900/20 border-red-500/50 text-red-400' :
                         result.texture === 'DRY' ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' :
                         'bg-slate-800 border-slate-700 text-slate-400'
                       }`}>
                         BOARD: {result.texture}
                       </span>
                    </div>
                  )}

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
                    {result.spr !== undefined && (
                      <>
                        <div className="w-[1px] h-12 bg-slate-800"></div>
                        <div className="text-center">
                          <div className="text-4xl font-mono font-black text-white tracking-tighter">{result.spr.toFixed(1)}</div>
                          <div className="text-[10px] uppercase text-slate-500 font-bold mt-1 tracking-widest">SPR</div>
                        </div>
                      </>
                    )}
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
                       <ShieldCheck className="w-3 h-3" /> ESTRATÉGIA PROFISSIONAL
                    </h3>
                    <p className="text-sm text-slate-300 font-bold mb-2">
                       {result.madeHand}
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed italic">
                      "{result.reasoning}"
                    </p>
                    <div className="mt-3 p-2 bg-black/40 rounded border border-white/5">
                       <div className="text-[8px] uppercase text-blue-400 font-black tracking-widest mb-1 italic">Mindset de Campeão</div>
                       <p className="text-[10px] text-blue-200 leading-tight">
                         {result.proTip}
                       </p>
                    </div>
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

                {canContinue && street !== 'RIVER' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-6 bg-blue-600/10 border-2 border-blue-500/30 rounded-2xl flex flex-col items-center gap-4"
                  >
                    <div className="text-sm font-black text-blue-400 uppercase tracking-[0.2em]">{nextStreetLabel}</div>
                    <div className="flex gap-4 w-full max-w-xs">
                       <button 
                         onClick={handleNextStreet}
                         className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                       >
                         SIM (Seguir)
                       </button>
                       <button 
                         onClick={handleFold}
                         className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 py-3 rounded-full font-black text-xs uppercase tracking-widest transition-all"
                       >
                         NÃO (Desistir)
                       </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-700">
                <Zap className="w-20 h-20 mb-6 opacity-10" />
                <p className="text-sm animate-pulse tracking-[0.2em] uppercase font-bold">Inicie pelo PRÉ-FLOP...</p>
                <div className="mt-8 text-[10px] opacity-40 uppercase tracking-widest max-w-xs text-center leading-relaxed">
                  Digite sua mão, posição e perfil do vilão para começar. O fluxo seguirá obrigatoriamente do pré-flop ao river.
                </div>
              </div>
            )}
          </AnimatePresence>
  
          <div className="mt-auto pt-6 flex justify-between items-center border-t border-slate-800">
            <button 
              onClick={handleFold}
              className="px-4 py-2 border border-slate-800 rounded text-[10px] font-black text-red-500/70 hover:bg-red-500 hover:text-white hover:border-red-500 uppercase transition-all"
            >
              Desistir / Resetar
            </button>
            <button 
              onClick={handleNextStreet}
              disabled={!canContinue || street === 'RIVER'}
              className={`px-10 py-3 rounded-full font-black text-xs tracking-[0.2em] transition-all uppercase ${
                canContinue && street !== 'RIVER' 
                  ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105' 
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              Próxima Rua
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
