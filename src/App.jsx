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

  const hasAnyBoardCards = useMemo(() => {
    return board.some(c => c !== null);
  }, [board]);

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
    if (type === 'pocket') {
      return !hasAnyBoardCards;
    }
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
        if (pocket.every(c => c !== null) && (nextIdx < 3 || newBoard.slice(0, nextIdx).every(c => c !== null))) setActiveSlot({ type: 'board', index: nextIdx });
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

  const handleRandomFill = () => {
    if (isBoardFull) {
      resetHand();
      return;
    }

    const availableDeck = [...FULL_DECK].filter(c => !selectedCards.includes(c.id));
    if (availableDeck.length === 0) return;

    const shuffled = availableDeck.sort(() => Math.random() - 0.5);
    let pickIdx = 0;

    const isPocketFilled = pocket.every(c => c !== null);

    if (!isPocketFilled) {
      const newPocket = [...pocket];
      for (let i = 0; i < 2; i++) if (newPocket[i] === null) newPocket[i] = shuffled[pickIdx++];
      setPocket(newPocket);
      if (!board[0]) setActiveSlot({ type: 'board', index: 0 });
    } else if (!board.slice(0, 3).every(c => c !== null)) {
      const newBoard = [...board];
      for (let i = 0; i < 3; i++) if (newBoard[i] === null) newBoard[i] = shuffled[pickIdx++];
      setBoard(newBoard);
      if (!board[3]) setActiveSlot({ type: 'board', index: 3 });
    } else if (board[3] === null) {
      const newBoard = [...board];
      newBoard[3] = shuffled[pickIdx++];
      setBoard(newBoard);
      if (!board[4]) setActiveSlot({ type: 'board', index: 4 });
    } else {
      const newBoard = [...board];
      newBoard[4] = shuffled[pickIdx++];
      setBoard(newBoard);
      setActiveSlot(null);
    }
    setCoachAdvice("");
  };

  const removeCard = (e, type, index) => {
    e.stopPropagation();
    if (type === 'pocket') {
      if (hasAnyBoardCards) return;
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

  const getCoachAdvice = async () => {
    if (!pocket[0] || !pocket[1] || !odds) return;
    setIsAdviceLoading(true);
    setAdviceError("");

    const pocketStr = pocket.map(c => c.id).join(', ');
    const boardStr = board.filter(c => c !== null).map(c => c.id).join(', ') || "None";
    const oddsStr = Object.entries(odds).filter(([_, v]) => v > 0).map(([k, v]) => `${k}: ${v.toFixed(2)}%`).join(', ');

    const prompt = `NL Hold'em analysis: Pocket: ${pocketStr} Board: ${boardStr} Target: ${targetStage} Odds: ${oddsStr}. Max 3 sentences strategy advice. Be elite and professional.`;
    
    const apiKey = ""; 

    let delay = 1000;
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: "You are a professional poker coach. Provide strategic analysis based on odds." }] }
          })
        });

        if (!response.ok) throw new Error();
        const data = await response.json();
        setCoachAdvice(data.candidates?.[0]?.content?.parts?.[0]?.text);
        setIsAdviceLoading(false);
        return;
      } catch {
        if (i === 4) {
          setAdviceError("Coach is thinking... Try again in a second.");
          setIsAdviceLoading(false);
        }
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
  };

  const renderCardSlot = (card, type, index, label) => {
    const isActive = activeSlot?.type === type && activeSlot?.index === index;
    const isRed = card?.suit === '♥' || card?.suit === '♦';
    const canSelect = canSelectSlot(type, index);
    const isLockedPocket = type === 'pocket' && hasAnyBoardCards;

    return (
      <div key={`${type}-${index}`} className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{label}</span>
        <div 
          onClick={() => canSelect && setActiveSlot({ type, index })}
          className={`relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg flex flex-col justify-center items-center transition-all border-2 shadow-sm ${!canSelect ? 'cursor-not-allowed grayscale' : 'cursor-pointer'} ${isActive ? 'border-red-500 ring-4 ring-red-500/30 shadow-red-500/50 scale-105' : 'border-black/20 hover:border-white/30'} ${card ? 'bg-white' : 'bg-black/20 backdrop-blur-sm border-dashed'} `}
        >
          {card ? (
            <>
              <span className={`text-xl sm:text-2xl font-black ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{card.rank}</span>
              <span className={`text-2xl sm:text-3xl ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{card.suit}</span>
              {(!isLockedPocket) && (
                <button onClick={(e) => removeCard(e, type, index)} className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md text-xs font-bold border border-white/20">×</button>
              )}
              {isLockedPocket && (
                <div className="absolute -top-2 -right-2 bg-slate-800 text-slate-400 rounded-full w-6 h-6 flex items-center justify-center shadow-md border border-white/10">
                  <Lock size={12} />
                </div>
              )}
            </>
          ) : (
            <span className="text-2xl sm:text-3xl text-white/20 font-black">
              {!canSelect ? <Lock size={20} /> : '+'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 font-mono selection:bg-red-500/30">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tighter text-white flex items-center gap-2 italic">
              POKER ODDS CALCULATOR
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">by Jesse Stern</p>
          </div>
          <button onClick={resetHand} className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-black transition-all active:scale-95 text-slate-300">
            <RefreshCw size={14} /> Reset All
          </button>
        </header>

        {/* BOARD SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Game Board
              </h2>
              <button onClick={handleRandomFill} className="text-[10px] font-black uppercase px-3 py-1 bg-red-600/10 text-red-500 border border-red-500/20 rounded hover:bg-red-600 hover:text-white transition-all italic">
                🎲 {isBoardFull ? 'Reset & Fill' : 'Random Fill'}
              </button>
            </div>

            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl shadow-2xl space-y-8">
              {/* STREETS */}
              <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                {renderCardSlot(board[0], 'board', 0, 'Flop 1')}
                {renderCardSlot(board[1], 'board', 1, 'Flop 2')}
                {renderCardSlot(board[2], 'board', 2, 'Flop 3')}
                <div className="w-px bg-slate-800 self-stretch my-2 hidden sm:block" />
                {renderCardSlot(board[3], 'board', 3, 'Turn')}
                <div className="w-px bg-slate-800 self-stretch my-2 hidden sm:block" />
                {renderCardSlot(board[4], 'board', 4, 'River')}
              </div>

              {/* POCKET */}
              <div className="pt-8 border-t border-slate-800/50 flex flex-col items-center gap-4">
                <div className="flex gap-4">
                  {renderCardSlot(pocket[0], 'pocket', 0, 'Pocket 1')}
                  {renderCardSlot(pocket[1], 'pocket', 1, 'Pocket 2')}
                </div>
              </div>
            </div>
          </div>

          {/* INPUT SECTION */}
          <div className="space-y-4">
            {isBoardFull ? (
              <div className="h-full bg-red-600/5 border border-red-500/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center text-red-500 mb-2">
                   <Lock size={32} />
                </div>
                <h3 className="text-lg font-black uppercase italic text-red-500">Board is full</h3>
                <p className="text-xs text-slate-500 max-w-[200px]">Reset the hand to start a new simulation.</p>
                <button onClick={resetHand} className="mt-4 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition-all shadow-lg shadow-red-900/20 uppercase italic text-sm">
                  RESET ALL
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Cards:</h3>
                <div className="grid grid-cols-1 gap-2">
                  {SUITS.map(suit => (
                    <div key={suit} className="flex gap-1.5">
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
                            <span className="text-[8px] font-bold text-slate-600 mb-0.5">{rank}</span>
                            <span className={`text-lg sm:text-xl ${isSelected ? 'text-slate-800' : isRed ? 'text-red-600' : 'text-white'}`}>{suit}</span>
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

        {/* RESULTS SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-800">
          <div className="bg-black/40 rounded-2xl border border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Odds by the:</h3>
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

            {!pocket[0] || !pocket[1] ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-700 space-y-2">
                <div className="text-4xl font-black italic">?</div>
                <p className="text-[10px] uppercase font-bold tracking-widest">Choose pocket cards</p>
              </div>
            ) : isCalculating ? (
              <div className="py-12 flex flex-col items-center justify-center text-red-500 space-y-4">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-[10px] uppercase font-black tracking-[0.3em] animate-pulse">Calculating...</p>
              </div>
            ) : odds ? (
              <div className="space-y-1.5">
                {HAND_TYPES.map(ht => {
                  const val = odds[ht.id];
                  const color = val >= 100 ? "bg-red-600" : val > 50 ? "bg-red-700" : val > 20 ? "bg-blue-800" : "bg-slate-700";
                  return (
                    <div key={ht.id} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                        <span className={val >= 100 ? 'text-red-500' : 'text-slate-400'}>{ht.name}</span>
                        <span className={val > 0 ? 'text-white' : 'text-slate-800'}>{val > 0 && val < 0.01 ? '<0.01%' : `${Number(val.toFixed(2))}%`}</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${color}`}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[9px] text-slate-600 font-bold uppercase pt-4 tracking-wider leading-relaxed">
                  Odds of holding **at least** this hand by the **{targetStage}**.
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
             {currentBestHand && odds && (
               <div className="bg-red-600/5 border border-red-500/20 rounded-2xl p-6 space-y-2">
                 <p className="text-[10px] font-black uppercase tracking-widest text-red-500/60">High hand:</p>
                 <h4 className="text-2xl font-black italic text-white uppercase tracking-tighter">{currentBestHand.name}</h4>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{HAND_FREQUENCIES[currentBestHand.id]}</p>
               </div>
             )}

             {odds && (
               <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Sparkles size={14} className="text-red-500" /> Strategy Coach
                    </h3>
                    <button 
                      onClick={getCoachAdvice}
                      disabled={isAdviceLoading}
                      className="text-[10px] font-black uppercase bg-white text-black px-3 py-1 rounded hover:bg-red-600 hover:text-white transition-all disabled:opacity-50 italic"
                    >
                      {isAdviceLoading ? <Loader2 className="animate-spin inline mr-1" size={10} /> : <MessageSquare size={10} className="inline mr-1" />} ✨ Ask Coach
                    </button>
                 </div>
                 <div className="min-h-[60px] flex items-center">
                    {coachAdvice ? (
                      <p className="text-xs leading-relaxed text-slate-300 font-medium italic">\"{coachAdvice}\"</p>
                    ) : (
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                        {adviceError || "Need strategy advice? Get an AI analysis of your odds."}
                      </p>
                    )}
                 </div>
               </div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
}
