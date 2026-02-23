import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Loader2, ChevronDown, Lock, Sparkles, MessageSquare } from 'lucide-react';

// --- CONSTANTS & POKER LOGIC ---
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const HAND_TYPES = [
  { id: 'STRAIGHT_FLUSH', name: 'Straight Flush' },
  { id: 'QUADS', name: 'Four of a Kind' },
  { id: 'FULL_HOUSE', name: 'Full House' },
  { id: 'FLUSH', name: 'Flush' },
  { id: 'STRAIGHT', name: 'Straight' },
  { id: 'TRIPS', name: 'Three of a Kind' },
  { id: 'TWO_PAIR', name: 'Two Pair' },
  { id: 'PAIR', name: 'Pair' },
];

const HAND_FREQUENCIES = {
  STRAIGHT_FLUSH: "1 out of 3,217 hold 'em hands",
  QUADS: "1 out of 594 hold 'em hands",
  FULL_HOUSE: "1 out of 39 hold 'em hands",
  FLUSH: "1 out of 33 hold 'em hands",
  STRAIGHT: "1 out of 21 hold 'em hands",
  TRIPS: "1 out of 20 hold 'em hands",
  TWO_PAIR: "1 out of 4 hold 'em hands",
  PAIR: "1 out of 2.4 hold 'em hands",
  HIGH_CARD: "1 out of 5.7 hold 'em hands"
};

const STAGES = [
  { label: 'Flop', count: 5 },
  { label: 'Turn', count: 6 },
  { label: 'River', count: 7 }
];

const FULL_DECK = [];
for (let s of SUITS) {
  for (let r of RANKS) {
    FULL_DECK.push({ rank: r, suit: s, value: RANK_VALUES[r], id: `${r}${s}` });
  }
}

function getMadeHands(cards) {
  const results = {
    STRAIGHT_FLUSH: false,
    QUADS: false,
    FULL_HOUSE: false,
    FLUSH: false,
    STRAIGHT: false,
    TRIPS: false,
    TWO_PAIR: false,
    PAIR: false,
  };

  if (cards.length < 2) return results;

  const suitsCount = { '♠': [], '♥': [], '♦': [], '♣': [] };
  const rankCounts = {};
  const values = [];

  cards.forEach(card => {
    suitsCount[card.suit].push(card);
    rankCounts[card.value] = (rankCounts[card.value] || 0) + 1;
    values.push(card.value);
  });

  for (let suit in suitsCount) {
    if (suitsCount[suit].length >= 5) {
      results.FLUSH = true;
      if (checkStraightInValues(suitsCount[suit].map(c => c.value)))
        results.STRAIGHT_FLUSH = true;
    }
  }

  if (checkStraightInValues(values)) results.STRAIGHT = true;

  const counts = Object.values(rankCounts).sort((a, b) => b - a);

  if (counts[0] >= 4) results.QUADS = true;
  else if (counts[0] === 3) {
    results.TRIPS = true;
    if (counts[1] >= 2) results.FULL_HOUSE = true;
  } else if (counts[0] === 2) {
    results.PAIR = true;
    if (counts[1] >= 2) results.TWO_PAIR = true;
  }

  return results;
}

function checkStraightInValues(values) {
  let uniqueValues = [...new Set(values)].sort((a, b) => b - a);
  if (uniqueValues.includes(14)) uniqueValues.push(1);

  let consecutiveCount = 1;
  for (let i = 0; i < uniqueValues.length - 1; i++) {
    if (uniqueValues[i] - 1 === uniqueValues[i + 1]) {
      consecutiveCount++;
      if (consecutiveCount >= 5) return true;
    } else consecutiveCount = 1;
  }
  return false;
}

function getCombinations(array, size) {
  const result = [];
  function p(t, i) {
    if (t.length === size) {
      result.push(t);
      return;
    }
    if (i + 1 > array.length) return;
    p([...t, array[i]], i + 1);
    p(t, i + 1);
  }
  p([], 0);
  return result;
}

export default function App() {
  const [pocket, setPocket] = useState([null, null]);
  const [board, setBoard] = useState([null, null, null, null, null]);
  const [activeSlot, setActiveSlot] = useState({ type: 'pocket', index: 0 });
  const [targetStage, setTargetStage] = useState('Flop');
  const [isManualTarget, setIsManualTarget] = useState(false);
  const [odds, setOdds] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState("");
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState("");

  const selectedCards = useMemo(() => {
    return [...pocket, ...board].filter(c => c !== null).map(c => c.id);
  }, [pocket, board]);

  const isBoardFull = useMemo(() => {
    return pocket.every(c => c !== null) && board.every(c => c !== null);
  }, [pocket, board]);

  useEffect(() => {
    if (isManualTarget) return;
    const filledBoardCount = board.filter(c => c !== null).length;
    if (filledBoardCount >= 4) setTargetStage('River');
    else if (filledBoardCount === 3) setTargetStage('Turn');
    else setTargetStage('Flop');
  }, [board, isManualTarget]);

  useEffect(() => {
    if (pocket.includes(null)) {
      setOdds(null);
      setCoachAdvice("");
      return;
    }

    setIsCalculating(true);
    const calcTimeout = setTimeout(() => {
      const stageInfo = STAGES.find(s => s.label === targetStage);
      const targetCount = stageInfo.count;
      const knownPocket = pocket.filter(c => c !== null);
      const knownBoard = board.filter(c => c !== null);
      const relevantBoardCount = Math.min(knownBoard.length, targetCount - 2);
      const relevantKnownCards = [...knownPocket, ...knownBoard.slice(0, relevantBoardCount)];

      const cardsNeeded = targetCount - relevantKnownCards.length;
      const deck = FULL_DECK.filter(c => !selectedCards.includes(c.id));

      let results = {};
      HAND_TYPES.forEach(ht => results[ht.id] = 0);

      let totalRuns = 0;

      const tallyHands = (cards) => {
        const made = getMadeHands(cards);
        let foundBetter = false;
        for (const ht of HAND_TYPES) {
          if (made[ht.id] || foundBetter) {
            results[ht.id]++;
            foundBetter = true;
          }
        }
      };

      if (cardsNeeded <= 0) {
        tallyHands(relevantKnownCards);
        totalRuns = 1;
      } else if (cardsNeeded <= 2) {
        const combos = getCombinations(deck, cardsNeeded);
        totalRuns = combos.length;
        for (let combo of combos) tallyHands([...relevantKnownCards, ...combo]);
      } else {
        totalRuns = 5000;
        for (let i = 0; i < totalRuns; i++) {
          let shuffled = [...deck].sort(() => 0.5 - Math.random());
          let runout = shuffled.slice(0, cardsNeeded);
          tallyHands([...relevantKnownCards, ...runout]);
        }
      }

      const percentages = {};
      HAND_TYPES.forEach(ht => {
        percentages[ht.id] = (results[ht.id] / totalRuns) * 100;
      });

      setOdds(percentages);
      setIsCalculating(false);
    }, 50);

    return () => clearTimeout(calcTimeout);
  }, [pocket, board, targetStage, selectedCards]);

  const canSelectSlot = (type, index) => {
    const isPocketFilled = pocket.every(c => c !== null);
    if (type === 'pocket') return true;
    if (type === 'board') {
      if (!isPocketFilled) return false;
      if (index < 3) return true;
      if (index === 3) return board.slice(0, 3).every(c => c !== null);
      if (index === 4) return board.slice(0, 4).every(c => c !== null);
    }
    return false;
  };

  const handleCardPick = (card) => {
    if (isBoardFull) return;
    if (!activeSlot || !canSelectSlot(activeSlot.type, activeSlot.index)) return;

    if (activeSlot.type === 'pocket') {
      const newPocket = [...pocket];
      newPocket[activeSlot.index] = card;
      setPocket(newPocket);
      if (activeSlot.index === 0 && !newPocket[1]) setActiveSlot({ type: 'pocket', index: 1 });
      else if (activeSlot.index === 1 && !board[0]) setActiveSlot({ type: 'board', index: 0 });
    } else if (activeSlot.type === 'board') {
      const newBoard = [...board];
      newBoard[activeSlot.index] = card;
      setBoard(newBoard);
      if (activeSlot.index < 4) {
        const nextIdx = activeSlot.index + 1;
        if (canSelectSlot('board', nextIdx)) setActiveSlot({ type: 'board', index: nextIdx });
      }
    }
    setCoachAdvice("");
  };

  const resetHand = () => {
    setPocket([null, null]);
    setBoard([null, null, null, null, null]);
    setActiveSlot({ type: 'pocket', index: 0 });
    setOdds(null);
    setTargetStage('Flop');
    setIsManualTarget(false);
    setCoachAdvice("");
  };

  const removeCard = (e, type, index) => {
    e.stopPropagation();
    if (type === 'pocket') {
      const newPocket = [...pocket];
      newPocket[index] = null;
      setPocket(newPocket);
    } else {
      const newBoard = [...board];
      newBoard[index] = null;
      setBoard(newBoard);
    }
    setIsManualTarget(false);
    setActiveSlot({ type, index });
    setOdds(null);
    setCoachAdvice("");
  };

  const currentBestHand = useMemo(() => {
    const isRiverFull = board.every(c => c !== null);
    if (!isRiverFull) return null;
    const made = getMadeHands([...pocket, ...board]);
    const bestHandType = HAND_TYPES.find(ht => made[ht.id]);
    if (bestHandType) return bestHandType;
    return { id: 'HIGH_CARD', name: 'High Card' };
  }, [pocket, board]);

  const renderCardSlot = (card, type, index, label) => {
    const isActive = activeSlot?.type === type && activeSlot?.index === index;
    const isRed = card?.suit === '♥' || card?.suit === '♦';
    const canSelect = canSelectSlot(type, index);

    return (
      <div key={`${type}-${index}`} className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <div 
          onClick={() => canSelect && setActiveSlot({ type, index })}
          className={`relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg flex flex-col justify-center items-center transition-all border-2 shadow-sm ${!canSelect ? 'cursor-not-allowed grayscale' : 'cursor-pointer'} ${isActive ? 'border-red-500 ring-4 ring-red-500/30 shadow-red-500/50 scale-105' : 'border-black/20 hover:border-white/30'} ${card ? 'bg-white' : 'bg-black/20 backdrop-blur-sm border-dashed'}`}
        >
          {card ? (
            <>
              <span className={`text-xl sm:text-2xl font-black ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{card.rank}</span>
              <span className={`text-2xl sm:text-3xl ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{card.suit}</span>
              <button 
                onClick={(e) => removeCard(e, type, index)}
                className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md text-xs font-bold border border-white/20"
              >×</button>
            </>
          ) : (
            <span className={`text-2xl font-light ${isActive ? 'text-red-400' : 'text-slate-700'}`}>{!canSelect ? <Lock size={16} /> : '+'}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 font-sans max-w-2xl mx-auto pb-24">
      <header className="mb-8 text-center pt-4">
        <h1 className="text-2xl font-black tracking-tighter text-white flex items-center justify-center gap-2 italic">
          <Sparkles className="text-red-600" fill="currentColor" size={20} />
          POKER ODDS CALCULATOR
        </h1>
        <p className="text-[10px] font-bold text-slate-500 tracking-[0.2em] mt-1">by Jesse Stern</p>
      </header>

      <div className="grid grid-cols-1 gap-6 mb-8">
        <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl p-6 border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
            <RefreshCw onClick={resetHand} className="cursor-pointer hover:rotate-180 transition-all duration-500" size={20} />
          </div>
          
          <div className="flex justify-center gap-3 sm:gap-4 mb-8">
            {renderCardSlot(board[0], 'board', 0, 'Flop 1')}
            {renderCardSlot(board[1], 'board', 1, 'Flop 2')}
            {renderCardSlot(board[2], 'board', 2, 'Flop 3')}
            <div className="w-px bg-white/10 mx-1 h-20 self-end mb-2"></div>
            {renderCardSlot(board[3], 'board', 3, 'Turn')}
            {renderCardSlot(board[4], 'board', 4, 'River')}
          </div>

          <div className="flex justify-center gap-4">
            {renderCardSlot(pocket[0], 'pocket', 0, 'Pocket 1')}
            {renderCardSlot(pocket[1], 'pocket', 1, 'Pocket 2')}
          </div>
        </div>

        {isBoardFull ? (
          <button 
            onClick={resetHand}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
          >
            <RefreshCw size={18} /> RESET ALL
          </button>
        ) : (
          <div className="bg-slate-900/40 rounded-2xl p-4 border border-white/5">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>
              Select Cards
            </h3>
            <div className="flex flex-col gap-2">
              {SUITS.map(suit => (
                <div key={suit} className="flex gap-1.5 sm:gap-2">
                  {RANKS.map(rank => {
                    const id = `${rank}${suit}`;
                    const isSelected = selectedCards.includes(id);
                    const isRed = suit === '♥' || suit === '♦';
                    return (
                      <button
                        key={id}
                        disabled={isSelected}
                        onClick={() => handleCardPick({ rank, suit, value: RANK_VALUES[rank], id })}
                        className={`flex-1 py-1 sm:py-2 rounded flex flex-col items-center justify-center border transition-all ${isSelected ? 'opacity-5 bg-black border-transparent cursor-not-allowed' : 'bg-black border-slate-800 hover:bg-slate-800 hover:border-slate-500 shadow-sm'}`}
                      >
                        <span className={`text-xs sm:text-sm font-black ${isRed ? 'text-red-500' : 'text-slate-300'}`}>{rank}</span>
                        <span className={`text-xs ${isRed ? 'text-red-500' : 'text-slate-300'}`}>{suit}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="bg-white/5 p-4 flex items-center justify-between border-b border-white/5">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Analysis</h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Target:</span>
            <div className="relative">
              <select 
                value={targetStage} 
                onChange={(e) => {
                  setTargetStage(e.target.value);
                  setIsManualTarget(true);
                }}
                className="appearance-none bg-black text-white pl-4 pr-10 py-1.5 rounded-lg text-sm font-black border border-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all uppercase"
              >
                {STAGES.map(stage => <option key={stage.label} value={stage.label}>{stage.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        <div className="p-6">
          {!pocket[0] || !pocket[1] ? (
            <div className="text-center py-12 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-600">
                <Sparkles size={32} />
              </div>
              <p className="text-slate-500 font-medium text-sm">Select both pocket cards to calculate odds.</p>
            </div>
          ) : isCalculating ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="animate-spin text-red-600" size={32} />
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Calculating Simulation...</p>
            </div>
          ) : odds ? (
            <div className="space-y-4">
              {HAND_TYPES.map(ht => {
                const val = odds[ht.id];
                const color = val >= 100 ? "bg-red-600" : val > 50 ? "bg-red-700" : val > 20 ? "bg-blue-800" : "bg-slate-700";
                return (
                  <div key={ht.id} className="group">
                    <div className="flex justify-between items-end mb-1.5 px-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${val >= 100 ? 'text-red-500' : 'text-slate-400 group-hover:text-slate-200'}`}>{ht.name}</span>
                      <span className={`text-sm font-black ${val > 0 ? 'text-white' : 'text-slate-800'}`}>{val > 0 && val < 0.01 ? '<0.01%' : `${Number(val.toFixed(2))}%`}</span>
                    </div>
                    <div className="h-2 bg-black rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={`h-full ${color} transition-all duration-700 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                        style={{ width: `${val}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest pt-4 opacity-50 italic">
                Odds of holding AT LEAST this hand by the {targetStage}.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {currentBestHand && odds && (
        <div className="mt-6 bg-red-600/10 border border-red-600/20 rounded-2xl p-6 flex items-start gap-4 shadow-xl">
          <div className="bg-red-600 p-3 rounded-xl shadow-lg shadow-red-600/20">
            <Sparkles className="text-white" size={24} />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-1">Current Best Hand</h4>
            <p className="text-xl font-black text-white italic tracking-tighter">{currentBestHand.name}</p>
            <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed opacity-80">{HAND_FREQUENCIES[currentBestHand.id]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
