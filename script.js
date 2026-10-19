const LEARN_LANG_STORAGE_KEY = 'skipbo.learnLang';
let lang = 'en';
let selected = null; // {source, handIndex?, discardIndex?, playerId?}
let state = null;
let matchScores = [];
let scoring = false;

const I18N = {
  en: {
    setupTitle: 'Play Skip-Bo',
    setupSub: 'Create a game and play against bots.',
    players: 'Players',
    stock: 'Stock pile',
    beginner: 'Beginner setup',
    scoring: 'Match scoring (500)',
    start: 'Start game',
    learn: 'Learn to play',
    draw: 'Draw pile',
    messageStart: 'Start a game.',
    yourTurn: 'Your turn. Play cards, then discard one to end.',
    botTurn: 'Bot thinking...',
    win: 'wins!',
    stockLeft: 'stock left',
    close: 'Close',
    newGame: 'New game',
    gameOver: 'Game Over',
  },
  da: {
    setupTitle: 'Spil Skip-Bo',
    setupSub: 'Opret et spil og spil mod bots.',
    players: 'Spillere',
    stock: 'Stock-bunke',
    beginner: 'Begynderopsætning',
    scoring: 'Matchscoring (500)',
    start: 'Start spil',
    learn: 'Lær at spille',
    draw: 'Trækbunke',
    messageStart: 'Start et spil.',
    yourTurn: 'Din tur. Spil kort, smid så ét for at afslutte.',
    botTurn: 'Bot tænker...',
    win: 'vinder!',
    stockLeft: 'stock tilbage',
    close: 'Luk',
    newGame: 'Nyt spil',
    gameOver: 'Spillet er slut',
  }
};

function t(key){ return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key; }
function cardColorClass(v){
  if(v===0) return '';
  if(v<=3) return ' c-red';
  if(v<=6) return ' c-blue';
  if(v<=9) return ' c-amber';
  return ' c-purple';
}

function toggleLang(){ lang = lang==='en'?'da':'en'; try{localStorage.setItem('skipbo.lang',lang);}catch(e){} applyLang(); setLearnLang(lang); }
function loadLang(){ try{const s=localStorage.getItem('skipbo.lang'); if(s) lang=s;}catch(e){} }

function applyLang(){
  document.getElementById('lang-toggle').textContent = lang.toUpperCase();
  document.getElementById('setup-title').textContent = t('setupTitle');
  document.getElementById('setup-sub').textContent = t('setupSub');
  document.getElementById('lbl-players').textContent = t('players');
  document.getElementById('lbl-stock').textContent = t('stock');
  document.getElementById('lbl-beginner').textContent = t('beginner');
  document.getElementById('lbl-scoring').textContent = t('scoring');
  document.getElementById('btn-start').textContent = t('start');
  document.getElementById('btn-learn').textContent = t('learn');
  const lc = document.getElementById('learn-close-btn'); if (lc) lc.textContent = t('close');
  const wb = document.getElementById('win-btn'); if (wb) wb.textContent = t('newGame');
  const wt = document.getElementById('win-title'); if (wt) wt.textContent = t('gameOver');
  document.documentElement.lang = lang;
}

function toggleSetup(){ const p=document.getElementById('setup-panel'); p.hidden=!p.hidden; }
function toggleLearn(){ const p=document.getElementById('learn-panel'); p.hidden=!p.hidden; if(!p.hidden){ setLearnLang(lang==='da'?'da':'en'); } }
function learnBackdropClick(e){ if(e.target.id==='learn-panel') toggleLearn(); }
function setLearnLang(l){
  document.getElementById('learn-pane-en').hidden = (l!=='en');
  document.getElementById('learn-pane-da').hidden = (l!=='da');
  document.getElementById('learn-lang-en').setAttribute('aria-pressed', l==='en');
  document.getElementById('learn-lang-da').setAttribute('aria-pressed', l==='da');
  try{localStorage.setItem(LEARN_LANG_STORAGE_KEY,l);}catch(e){}
}

// ---- Game logic ----
function makeDeck(){
  const deck=[];
  let id=0;
  for(let v=1;v<=12;v++){
    for(let i=0;i<12;i++){ deck.push({id:id++, value:v}); }
  }
  for(let i=0;i<24;i++){ deck.push({id:id++, value:0}); } // wilds
  return shuffle(deck);
}
function shuffle(a){
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

function stockSizeFor(players, choice){
  if(choice==='10') return 10;
  if(choice==='15') return 15;
  return players<=4?30:20;
}

function startGame(){
  const players = parseInt(document.getElementById('player-count').value);
  const stockChoice = document.getElementById('stock-size').value;
  const beginner = document.getElementById('beginner').checked;
  scoring = document.getElementById('scoring').checked;
  const ss = stockSizeFor(players, stockChoice);
  if(matchScores.length!==players) matchScores = new Array(players).fill(0);

  const deck = makeDeck();
  const hands = [];
  const stocks = [];
  const discards = [];
  let idx=0;
  for(let p=0;p<players;p++){
    stocks.push(deck.splice(0,ss));
    // top card face up = last element? We'll keep array bottom->top, top=last. Initially all facedown; reveal top by just using last. No special.
    hands.push([]);
    discards.push([[],[],[],[]]);
  }
  // draw pile rest
  const drawPile = deck;
  const building = [null,null,null,null]; // each null or array of numbers
  const completed = [];
  state = {
    players, hands, stocks, discards, drawPile, building, completed, beginner,
    currentPlayer: 0, winner: null, humanIndex:0
  };
  // youngest first => player 0
  // beginner setup: pre-seed 4 building piles and 4 discards per player with one card from draw
  if(beginner){
    for(let b=0;b<4;b++){
      if(state.drawPile.length){ state.building[b]=[drawOneValue(state.drawPile)]; }
    }
    for(let p=0;p<players;p++){
      for(let d=0;d<4;d++){
        if(state.drawPile.length){
          const c = state.drawPile.splice(0,1)[0];
          state.discards[p][d].push(c);
        }
      }
    }
  }
  document.getElementById('setup-panel').hidden = true;
  document.getElementById('game-area').hidden = false;
  renderSeats();
  beginTurn(0);
}

function drawOneValue(pile){ const c=pile.splice(0,1)[0]; return c.value===0?1:c.value; } // for building seed number

function drawToFive(p){
  while(state.hands[p].length < 5 && state.drawPile.length > 0){
    state.hands[p].push(state.drawPile.splice(0,1)[0]);
  }
  if(state.hands[p].length < 5){
    // reshuffle completed
    if(state.completed.length){
      const sh = shuffle(state.completed.splice(0));
      state.drawPile = state.drawPile.concat(sh);
      while(state.hands[p].length < 5 && state.drawPile.length > 0){
        state.hands[p].push(state.drawPile.splice(0,1)[0]);
      }
    }
  }
}

function beginTurn(p){
  state.currentPlayer = p;
  drawToFive(p);
  selected = null;
  if(p===state.humanIndex){
    render();
    setMessage(t('yourTurn'));
  } else {
    render();
    setMessage(t('botTurn'));
    setTimeout(()=>botTurn(p), 700);
  }
}

function isBot(p){ return p !== state.humanIndex; }

function botTurn(p){
  if(state.winner!==null) return;
  let safety=0;
  let moves=0;
  while(safety++ < 200 && moves < 60){
    if(state.winner!==null) return;
    if(state.hands[p].length===0){
      drawToFive(p);
      if(state.hands[p].length===0) break;
    }
    const move = findBotMove(p);
    if(!move) break;
    applyPlay(p, move.source, move.sourceIndex, move.buildingIndex);
    moves++;
    render();
    if(state.winner!==null){ endGame(); return; }
  }
  // discard
  if(state.hands[p].length>0){
    const hi = chooseDiscardHandIndex(p);
    const di = chooseDiscardPileIndex(p);
    discardCard(p, hi, di);
  }
  endTurn();
}

function findBotMove(p){
  // prioritize stock
  // stock top
  if(state.stocks[p].length>0){
    const card = state.stocks[p][state.stocks[p].length-1];
    const bi = findBuildingForCard(card);
    if(bi!==-1) return {source:'stock', sourceIndex:-1, buildingIndex:bi};
  }
  // discards
  for(let d=0;d<4;d++){
    const pile = state.discards[p][d];
    if(pile.length>0){
      const card = pile[pile.length-1];
      const bi = findBuildingForCard(card);
      if(bi!==-1) return {source:'discard', sourceIndex:d, buildingIndex:bi};
    }
  }
  // hand
  for(let i=0;i<state.hands[p].length;i++){
    const card = state.hands[p][i];
    const bi = findBuildingForCard(card);
    if(bi!==-1) return {source:'hand', sourceIndex:i, buildingIndex:bi};
  }
  return null;
}

function findBuildingForCard(card){
  for(let b=0;b<4;b++){
    if(canPlay(card, b)) return b;
  }
  return -1;
}

function requiredValueFor(buildingIndex){
  const pile = state.building[buildingIndex];
  if(!pile || pile.length===0) return 1;
  return pile[pile.length-1]+1;
}

function canPlay(card, buildingIndex){
  const req = requiredValueFor(buildingIndex);
  if(req>12) return false;
  if(card.value===0) return true; // wild can be req (1..12)
  return card.value === req;
}

function applyPlay(p, source, sourceIndex, buildingIndex){
  let card;
  if(source==='hand'){
    card = state.hands[p].splice(sourceIndex,1)[0];
  } else if(source==='stock'){
    card = state.stocks[p].pop();
  } else if(source==='discard'){
    const pile = state.discards[p][sourceIndex];
    card = pile.pop();
  }
  const req = requiredValueFor(buildingIndex);
  const playedValue = (card.value===0)? req : card.value;
  if(!state.building[buildingIndex]) state.building[buildingIndex]=[];
  state.building[buildingIndex].push(playedValue);
  // complete if 12
  if(playedValue===12){
    const completedPile = state.building[buildingIndex].splice(0);
    state.completed.push(...completedPile.map(v=>({value:v})));
    state.building[buildingIndex]=null;
  }
  // refill hand if emptied by hand play
  if(source==='hand' && state.hands[p].length===0){
    drawToFive(p);
  }
  // win check
  if(source==='stock' && state.stocks[p].length===0){
    state.winner = p;
  }
}

function discardCard(p, handIndex, discardPileIndex){
  const card = state.hands[p].splice(handIndex,1)[0];
  state.discards[p][discardPileIndex].push(card);
}

function chooseDiscardHandIndex(p){
  // discard highest value (wilds last)
  let best=0, bestScore=-1;
  for(let i=0;i<state.hands[p].length;i++){
    const v = state.hands[p][i].value;
    const score = v===0? -1 : v;
    if(score>bestScore){ bestScore=score; best=i; }
  }
  return best;
}
function chooseDiscardPileIndex(p){
  for(let d=0;d<4;d++){ if(state.discards[p][d].length===0) return d; }
  // smallest pile
  let best=0, min=Infinity;
  for(let d=0;d<4;d++){ if(state.discards[p][d].length<min){min=state.discards[p][d].length;best=d;} }
  return best;
}

function endTurn(){
  if(state.winner!==null){ endGame(); return; }
  const next = (state.currentPlayer+1)%state.players;
  beginTurn(next);
}

function endGame(){
  const w = state.winner;
  const names = playerNames();
  if(scoring){
    let add = 25;
    for(let p=0;p<state.players;p++){
      if(p!==w) add += 5*state.stocks[p].length;
    }
    matchScores[w] += add;
  }
  render();
  const modal = document.getElementById('win-modal');
  document.getElementById('win-msg').textContent = names[w] + ' ' + t('win');
  const scoresDiv = document.getElementById('win-scores');
  scoresDiv.innerHTML = '';
  names.forEach((n,i)=>{
    const p = document.createElement('p');
    p.textContent = n + ': ' + (scoring? matchScores[i] : (state.stocks[i].length + ' ' + t('stockLeft')));
    scoresDiv.appendChild(p);
  });
  if(scoring){
    // check match winner
    const mw = matchScores.indexOf(Math.max(...matchScores));
    if(matchScores[mw]>=500){
      document.getElementById('win-msg').textContent = names[mw] + ' wins match!';
    }
  }
  modal.classList.remove('hidden');
  modal.hidden = false;
}

function newGame(){ 
  document.getElementById('win-modal').hidden=true;
  document.getElementById('win-modal').classList.add('hidden');
  document.getElementById('game-area').hidden=true;
  document.getElementById('setup-panel').hidden=false;
}

function playerNames(){
  const names=['You'];
  for(let i=1;i<state.players;i++) names.push('Bot '+i);
  return names;
}

// ---- Rendering ----
function renderSeats(){
  const n = state.players;
  const allSeats = ['bottom','left','topleft','top','topright','right'];
  allSeats.forEach(s=>{
    const el = document.getElementById('seat-'+s);
    if(el) el.hidden = true;
  });
  document.getElementById('seat-bottom').hidden = false;
  document.getElementById('name-bottom').textContent = 'You';
  const oppCount = n-1;
  let seatsToUse;
  if(oppCount===1) seatsToUse=['top'];
  else if(oppCount===2) seatsToUse=['left','right'];
  else if(oppCount===3) seatsToUse=['left','top','right'];
  else if(oppCount===4) seatsToUse=['left','topleft','top','right'];
  else seatsToUse=['left','topleft','top','topright','right'];
  state.seatMap = ['bottom'].concat(seatsToUse);
  for(let i=0;i<oppCount;i++){
    const seat = seatsToUse[i];
    const el = document.getElementById('seat-'+seat);
    if(!el) continue;
    el.hidden = false;
    document.getElementById('name-'+seat).textContent = 'Bot '+(i+1);
  }
}

function render(){
  if(!state) return;
  const names = playerNames();
  // bottom
  renderPlayerArea('bottom', state.humanIndex);
  // opponents in seats
  const oppSeats = state.seatMap.slice(1);
  for(let i=0;i<oppSeats.length;i++){
    const seat = oppSeats[i];
    const p = i+1;
    renderPlayerArea(seat, p);
    document.getElementById('name-'+seat).textContent = names[p];
    const sc = document.getElementById('score-'+seat);
    if(sc) sc.textContent = scoring? matchScores[p] : (state.stocks[p].length+' '+t('stockLeft'));
  }
  document.getElementById('score-bottom').textContent = scoring? matchScores[0] : (state.stocks[0].length+' '+t('stockLeft'));
  // center draw count
  const deck = document.getElementById('deck');
  deck.innerHTML = '';
  const back = document.createElement('div'); back.className='card back'; back.textContent='SKIP-BO'; deck.appendChild(back);
  // building
  const brow = document.getElementById('buildings');
  brow.innerHTML='';
  for(let b=0;b<4;b++){
    const slot = document.createElement('div');
    slot.className='building-slot';
    slot.dataset.b = b;
    slot.onclick = ()=> onBuildingClick(b);
    const pile = state.building[b];
    if(pile && pile.length>0){
      const top = pile[pile.length-1];
      const c = document.createElement('div'); c.className='card'+(top===0?' wild':cardColorClass(top)); c.textContent = top===0?'SB':top; slot.appendChild(c);
    }
    brow.appendChild(slot);
  }
  // message not overwrite
}

function renderPlayerArea(seat, p){
  // stock
  const stockEl = document.getElementById('stock-'+seat);
  stockEl.innerHTML='';
  const stockPile = document.createElement('div');
  stockPile.className='stock-pile';
  // show top card if any
  if(state.stocks[p].length>0){
    const top = state.stocks[p][state.stocks[p].length-1];
    const c = document.createElement('div');
    c.className = 'card'+(top.value===0?' wild':cardColorClass(top.value))+(selected && selected.source==='stock'?' selected':'');
    c.textContent = top.value===0?'SB':top.value;
    if(p===state.humanIndex){
      c.onclick = ()=> selectStock(p);
    }
    stockPile.appendChild(c);
  } else {
    const c = document.createElement('div'); c.className='card back'; c.textContent=''; stockPile.appendChild(c);
  }
  const cnt = document.createElement('div'); cnt.className='stock-count'; cnt.textContent = state.stocks[p].length; stockPile.appendChild(cnt);
  stockEl.appendChild(stockPile);

  // discards
  const discEl = document.getElementById('discards-'+seat);
  discEl.innerHTML='';
  for(let d=0;d<4;d++){
    const pile = document.createElement('div');
    pile.className='discard-pile'+(selected && selected.source==='hand'?' discard-target':'');
    const cards = state.discards[p][d];
    if(cards.length>0){
      const top = cards[cards.length-1];
      const c = document.createElement('div');
      c.className='card'+(top.value===0?' wild':cardColorClass(top.value))+(selected && selected.source==='discard' && selected.discardIndex===d?' selected':'');
      c.textContent = top.value===0?'SB':top.value;
      if(p===state.humanIndex){
        c.onclick = (e)=>{ e.stopPropagation(); handleDiscardPileClick(p,d); };
      }
      pile.appendChild(c);
    }
    if(p===state.humanIndex){
      pile.onclick = ()=> handleDiscardPileClick(p,d);
    }
    discEl.appendChild(pile);
  }

  // hand (only human bottom)
  if(seat==='bottom' && p===state.humanIndex){
    const handEl = document.getElementById('hand-bottom');
    handEl.innerHTML='';
    state.hands[p].forEach((card,i)=>{
      const c = document.createElement('div');
      c.className='card'+(card.value===0?' wild':cardColorClass(card.value))+(selected && selected.source==='hand' && selected.handIndex===i?' selected':'');
      c.textContent = card.value===0?'SB':card.value;
      c.onclick = ()=> selectHand(i);
      handEl.appendChild(c);
    });
  }
  // highlight selected stock
  // (handled by selected global; re-render enough)
}

function selectHand(i){
  if(state.currentPlayer!==state.humanIndex) return;
  selected = {source:'hand', handIndex:i};
  render();
}
function selectStock(p){
  if(state.currentPlayer!==state.humanIndex) return;
  if(p!==state.humanIndex) return;
  if(state.stocks[p].length===0) return;
  selected = {source:'stock'};
  render();
}
function selectDiscard(p,d){
  if(state.currentPlayer!==state.humanIndex) return;
  if(p!==state.humanIndex) return;
  if(state.discards[p][d].length===0) return;
  selected = {source:'discard', discardIndex:d};
  render();
}
function handleDiscardPileClick(p,d){
  if(state.currentPlayer!==state.humanIndex) return;
  if(p!==state.humanIndex) return;
  if(selected && selected.source==='hand'){
    discardSelectedTo(p,d);
  } else {
    if(state.discards[p][d].length>0) selectDiscard(p,d);
  }
}

function onBuildingClick(b){
  if(state.currentPlayer!==state.humanIndex) return;
  if(!selected) return;
  // validate
  let card;
  if(selected.source==='hand') card = state.hands[state.humanIndex][selected.handIndex];
  else if(selected.source==='stock') card = state.stocks[state.humanIndex][state.stocks[state.humanIndex].length-1];
  else if(selected.source==='discard') card = state.discards[state.humanIndex][selected.discardIndex][state.discards[state.humanIndex][selected.discardIndex].length-1];
  if(!card) return;
  if(!canPlay(card,b)) { setMessage('Cannot play there.'); return; }
  // apply
  const src = selected.source;
  const srcIndex = selected.source==='hand'?selected.handIndex:(selected.source==='discard'?selected.discardIndex:-1);
  applyPlay(state.humanIndex, src, srcIndex, b);
  selected = null;
  render();
  if(state.winner!==null){ endGame(); return; }
  setMessage(t('yourTurn'));
}

function discardSelectedTo(p,d){
  if(state.currentPlayer!==state.humanIndex) return;
  if(!selected || selected.source!=='hand') { setMessage('Select a hand card to discard.'); return; }
  const hi = selected.handIndex;
  discardCard(state.humanIndex, hi, d);
  selected = null;
  render();
  endTurn();
}

function setMessage(m){ document.getElementById('message').textContent = m; }

loadLang();
applyLang();
setLearnLang(lang);
// restore learn lang
try{ const s=localStorage.getItem(LEARN_LANG_STORAGE_KEY); if(s) setLearnLang(s);}catch(e){}