// POKER ODDS CALCULATOR - GitHub Ready
// 
// --- PROJECT SETUP INSTRUCTIONS ---
// 1. Create your project: npm create vite@latest poker-odds-calculator -- --template react
// 2. Install dependencies: npm install lucide-react tailwindcss@3 postcss autoprefixer
// 3. Initialize Tailwind: npx tailwindcss init -p
//
// --- TAILWIND CONFIGURATION (Paste into tailwind.config.js) ---
// export default {
//   content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
//   theme: { extend: {} },
//   plugins: [],
// }
//
// --- CSS SETUP (Paste into src/index.css) ---
// @tailwind base;
// @tailwind components;
// @tailwind utilities;

import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Loader2, ChevronDown, Lock } from 'lucide-react';

/**
 * POKER ODDS CALCULATOR
 * Features:
 * - Real-time probability engine with cumulative logic
 * - Proactive street detection (Flop -> Turn -> River)
 * - Sequential selection and deletion rules
 * - Random street filler / Reset board (🎲 ? / 🎲 !)
 */

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
      if (checkStraightInValues(suitsCount[suit].map(c => c.value))) results.STRAIGHT_FLUSH = true;
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
    if (t.length === size) { result.push(t); return; }
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

      if (cardsNeeded <= 0) { tallyHands(relevantKnownCards); totalRuns = 1; }
      else if (cardsNeeded <= 2) {
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
      HAND_TYPES.forEach(ht => { percentages[ht.id] = (results[ht.id] / totalRuns) * 100; });
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

  // Helper to determine the next logical, legal empty slot
  const getNextLogicalSlot = (currentPocket, currentBoard) => {
    // 1. Fill pocket first
    if (currentPocket.includes(null)) {
      return { type: 'pocket', index: currentPocket.indexOf(null) };
    }
    // 2. Fill flop
    if (currentBoard.slice(0, 3).includes(null)) {
      return { type: 'board', index: currentBoard.indexOf(null) };
    }
    // 3. Fill turn
    if (currentBoard[3] === null) {
      return { type: 'board', index: 3 };
    }
    // 4. Fill river
    if (currentBoard[4] === null) {
      return { type: 'board', index: 4 };
    }
    // 5. Board is full
    return null;
  };

  const handleCardPick = (card) => {
    if (isBoardFull) return;
    if (!activeSlot || !canSelectSlot(activeSlot.type, activeSlot.index)) return;
    
    // We create local copies of the state arrays so we can 
    // immediately calculate the next logical slot without waiting for React.
    let newPocket = [...pocket];
    let newBoard = [...board];

    if (activeSlot.type === 'pocket') {
      newPocket[activeSlot.index] = card;
      setPocket(newPocket);
    } else if (activeSlot.type === 'board') {
      newBoard[activeSlot.index] = card;
      setBoard(newBoard);
    }
    
    // Immediately advance cursor
    setActiveSlot(getNextLogicalSlot(newPocket, newBoard));
  };

  const resetHand = () => {
    setPocket([null, null]);
    setBoard([null, null, null, null, null]);
    setActiveSlot({ type: 'pocket', index: 0 });
    setOdds(null);
    setTargetStage('Flop');
    setIsManualTarget(false);
  };

  const handleRandomFill = () => {
    if (isBoardFull) { resetHand(); return; }
    const availableDeck = [...FULL_DECK].filter(c => !selectedCards.includes(c.id));
    if (availableDeck.length === 0) return;
    const shuffled = availableDeck.sort(() => Math.random() - 0.5);
    let pickIdx = 0;
    
    let newPocket = [...pocket];
    let newBoard = [...board];
    const isPocketFilled = pocket.every(c => c !== null);

    if (!isPocketFilled) {
      for (let i = 0; i < 2; i++) if (newPocket[i] === null) newPocket[i] = shuffled[pickIdx++];
    } else if (!board.slice(0, 3).every(c => c !== null)) {
      for (let i = 0; i < 3; i++) if (newBoard[i] === null) newBoard[i] = shuffled[pickIdx++];
    } else if (board[3] === null) {
      newBoard[3] = shuffled[pickIdx++];
    } else {
      newBoard[4] = shuffled[pickIdx++];
    }

    setPocket(newPocket);
    setBoard(newBoard);
    
    // Immediately advance cursor
    setActiveSlot(getNextLogicalSlot(newPocket, newBoard));
  };

  const removeCard = (e, type, index) => {
    e.stopPropagation();
    
    // If we're removing a card, it's safe to use the existing states 
    // because we are explicitly targeting the slot we just emptied.
    let newPocket = [...pocket];
    let newBoard = [...board];
    
    if (type === 'pocket') {
      newPocket[index] = null;
      setPocket(newPocket);
    } else {
      newBoard[index] = null;
      setBoard(newBoard);
    }
    
    setIsManualTarget(false);
    setActiveSlot({ type, index });
    setOdds(null);
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
    
    // We only allow clicking to activate a slot if it is legal based on Poker rules.
    const handleSlotClick = () => {
      if (canSelect) setActiveSlot({ type, index });
    }

    return (
      <div className={`flex flex-col items-center mx-1 transition-opacity duration-300 ${!canSelect && !card ? 'opacity-30' : 'opacity-100'}`}>
        <span className="text-xs text-slate-100/60 mb-1 font-semibold tracking-wider uppercase drop-shadow-sm">{label}</span>
        <div 
          onClick={handleSlotClick}
          className={`relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg flex flex-col justify-center items-center transition-all border-2 shadow-sm
            ${!canSelect ? 'cursor-not-allowed grayscale' : 'cursor-pointer'}
            ${isActive ? 'border-red-500 ring-4 ring-red-500/30 shadow-red-500/50 scale-105' : 'border-black/20 hover:border-white/30'}
            ${card ? 'bg-white' : 'bg-black/20 backdrop-blur-sm border-dashed'}
          `}
        >
          {card ? (
            <>
              <div className={`text-2xl sm:text-3xl font-bold ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{card.rank}</div>
              <div className={`text-3xl sm:text-4xl ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{card.suit}</div>
              <button onClick={(e) => removeCard(e, type, index)} className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md text-xs font-bold border border-white/20">×</button>
            </>
          ) : (
            <div className="flex flex-col items-center">
               {!canSelect ? <Lock size={16} className="text-white/20" /> : <span className="text-white/20 text-3xl font-light">+</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 font-sans p-4 sm:p-8 flex justify-center">
      <div className="max-w-4xl w-full flex flex-col gap-6">
        <header className="flex justify-between items-center border-b border-slate-900 pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-red-600 uppercase tracking-tight">POKER ODDS CALCULATOR</h1>
            <p className="text-slate-500 text-sm mt-1 font-medium italic">by Jesse Stern</p>
          </div>
          <button onClick={resetHand} className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors border border-slate-800 shadow-lg">
            <RefreshCw size={16} /> <span className="hidden sm:inline">Reset All</span>
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-[#076324] border-4 border-[#054d1c] rounded-[2rem] p-6 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5),0_10px_40px_rgba(0,0,0,0.4)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>
              <button onClick={handleRandomFill} className="absolute bottom-4 left-4 w-14 h-14 flex items-center justify-center bg-black/30 hover:bg-black/50 border border-white/10 rounded-xl backdrop-blur-md shadow-xl transition-all active:scale-90 z-20 text-2xl">
                🎲 {isBoardFull ? '!' : '?'}
              </button>
              <div className="relative z-10 flex flex-col gap-8">
                <div className="flex flex-col items-center">
                  <div className="flex justify-center flex-wrap gap-2">
                    {renderCardSlot(board[0], 'board', 0, 'Flop 1')}
                    {renderCardSlot(board[1], 'board', 1, 'Flop 2')}
                    {renderCardSlot(board[2], 'board', 2, 'Flop 3')}
                    <div className="w-2 sm:w-4" />
                    {renderCardSlot(board[3], 'board', 3, 'Turn')}
                    <div className="w-2 sm:w-4" />
                    {renderCardSlot(board[4], 'board', 4, 'River')}
                  </div>
                </div>
                <div className="flex flex-col items-center pt-6 border-t border-white/10">
                   <div className="flex justify-center gap-2">
                    {renderCardSlot(pocket[0], 'pocket', 0, 'Pocket 1')}
                    {renderCardSlot(pocket[1], 'pocket', 1, 'Pocket 2')}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-md shadow-2xl min-h-[200px] flex flex-col justify-center relative">
              {isBoardFull ? (
                <div className="flex justify-center items-center py-10 w-full">
                  <button onClick={resetHand} className="flex items-center gap-6 px-9 py-6 bg-slate-900 hover:bg-slate-800 rounded-2xl text-2xl font-black transition-all border-2 border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.5)] active:scale-95 group">
                    <RefreshCw size={48} className="group-hover:rotate-180 transition-transform duration-500" /> 
                    <span>RESET ALL</span>
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-slate-400 mb-4 text-center uppercase tracking-[0.2em]">SELECT CARDS:</h3>
                  <div className="grid grid-cols-13 gap-1 sm:gap-2">
                    {SUITS.map(suit => (
                      <div key={suit} className="flex gap-1 sm:gap-2 w-full justify-between">
                        {RANKS.map(rank => {
                          const id = `${rank}${suit}`;
                          const isSelected = selectedCards.includes(id);
                          const isRed = suit === '♥' || suit === '♦';
                          return (
                            <button key={id} disabled={isSelected} onClick={() => handleCardPick({ rank, suit, value: RANK_VALUES[rank], id })} className={`flex-1 py-1 sm:py-2 rounded flex flex-col items-center justify-center border transition-all ${isSelected ? 'opacity-5 bg-black border-transparent cursor-not-allowed' : 'bg-black border-slate-800 hover:bg-slate-800 hover:border-slate-500 shadow-sm'}`}>
                              <span className={`text-xs sm:text-base font-bold ${isRed && !isSelected ? 'text-red-500' : 'text-slate-400'}`}>{rank}</span>
                              <span className={`text-xs sm:text-sm ${isRed && !isSelected ? 'text-red-500' : 'text-slate-400'}`}>{suit}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-5 border-b border-slate-800/50 pb-3">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Odds by the:</h2>
                <div className="relative group">
                  <select value={targetStage} onChange={(e) => { setTargetStage(e.target.value); setIsManualTarget(true); }} className="appearance-none bg-black text-white pl-4 pr-10 py-1.5 rounded-lg text-sm font-black border border-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all uppercase">
                    {STAGES.map(stage => <option key={stage.label} value={stage.label}>{stage.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
                </div>
              </div>
              {!pocket[0] || !pocket[1] ? (
                <div className="text-center py-12 text-slate-700 flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center bg-black/20"><span className="text-3xl opacity-30 font-light">?</span></div>
                  <p className="text-xs uppercase tracking-[0.2em] font-black text-slate-600">Choose pocket cards</p>
                </div>
              ) : isCalculating ? (
                <div className="flex flex-col items-center justify-center py-16 text-red-600"><Loader2 className="animate-spin mb-4" size={32} /> <span className="text-xs font-black animate-pulse">Calculating...</span></div>
              ) : odds ? (
                <div className="flex flex-col gap-4">
                  {HAND_TYPES.map(ht => {
                    const val = odds[ht.id];
                    const color = val >= 100 ? "bg-red-600" : val > 50 ? "bg-red-700" : val > 20 ? "bg-blue-800" : "bg-slate-700";
                    return (
                      <div key={ht.id}>
                        <div className="flex justify-between text-[13px] mb-1 font-bold uppercase tracking-tight">
                          <span className={val >= 100 ? 'text-red-500' : 'text-slate-400'}>{ht.name}</span>
                          <span className={val > 0 ? 'text-white' : 'text-slate-800'}>{val > 0 && val < 0.01 ? '<0.01%' : `${Number(val.toFixed(2))}%`}</span>
                        </div>
                        <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden border border-slate-800/50">
                          <div className={`h-full rounded-full transition-all duration-1000 ${color}`} style={{ width: `${val}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-5 pt-4 border-t border-slate-800/50 text-[10px] text-slate-600 leading-relaxed italic uppercase tracking-wider text-center">Odds of holding <strong>at least</strong> this hand by the <strong>{targetStage}</strong>.</div>
                </div>
              ) : null}
            </div>
            
            {currentBestHand && odds && (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
                <div className="text-xs font-bold text-slate-500 mb-1">High hand:</div>
                <div className="text-lg font-extrabold text-slate-300 tracking-tighter leading-tight">{currentBestHand.name}</div>
                <div className="text-[11px] font-bold text-slate-400 italic mt-1">{HAND_FREQUENCIES[currentBestHand.id]}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
