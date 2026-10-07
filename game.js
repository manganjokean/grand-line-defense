(() => {
  'use strict';

  const CREW = [
    { id: 'luffy', name: 'Luffy', role: 'All-rounder', cost: 100, damage: 23, range: 155, cooldown: 0.72, description: 'Rubber-powered punches that keep the Marines in check.' },
    { id: 'zoro', name: 'Zoro', role: 'Heavy damage', cost: 140, damage: 43, range: 125, cooldown: 1.0, description: 'Three-sword strikes deal devastating single-target damage.' },
    { id: 'nami', name: 'Nami', role: 'Slows enemies', cost: 95, damage: 16, range: 155, cooldown: 0.85, description: 'Weather attacks slow enemies for a moment after each hit.' },
    { id: 'usopp', name: 'Usopp', role: 'Long range', cost: 85, damage: 19, range: 230, cooldown: 1.05, description: 'Sharpshooter with the longest reach on the island.' },
    { id: 'sanji', name: 'Sanji', role: 'Splash damage', cost: 125, damage: 26, range: 125, cooldown: 0.85, description: 'Fiery kicks damage nearby Marines as well as the target.' },
    { id: 'chopper', name: 'Chopper', role: 'Ship support', cost: 75, damage: 12, range: 140, cooldown: 0.8, description: 'Every 6 successful hits restores 1 ship health.' }
  ];
  const CREW_BY_ID = Object.fromEntries(CREW.map(hero => [hero.id, hero]));
  const COLUMNS = 12;
  const ROWS = 8;
  const MAX_WAVES = 10;
  const MAX_LIVES = 20;
  const routeCells = [
    [0,3],[1,3],[2,3],[2,2],[2,1],[3,1],[4,1],[5,1],
    [5,2],[5,3],[6,3],[7,3],[8,3],[8,4],[8,5],[9,5],[10,5],[11,5]
  ];
  const pathTiles = new Set(routeCells.map(([c,r]) => `${c},${r}`));
  const routePoints = [{x:-50,y:350}, ...routeCells.map(([c,r]) => ({x:c*100+50,y:r*100+50})), {x:1250,y:550}];
  const segments = [];
  let routeLength = 0;
  for (let i = 1; i < routePoints.length; i++) {
    const from = routePoints[i-1], to = routePoints[i];
    const length = Math.hypot(to.x-from.x, to.y-from.y);
    segments.push({from,to,length,start:routeLength});
    routeLength += length;
  }

  const $ = id => document.getElementById(id);
  const board = $('board'), grid = $('board-grid'), layer = $('entity-layer');
  const crewGrid = $('crew-grid'), details = $('details-panel');
  const rangeIndicator = $('range-indicator');
  const startButton = $('start-button'), pauseButton = $('pause-button'), speedButton = $('speed-button');
  const overlay = $('board-overlay');
  let state, lastFrame = 0, nextId = 0;

  // These tiny, original vector portraits keep the game fully playable offline.
  function portrait(id) {
    const backgrounds = {luffy:'#8b5842',zoro:'#467c69',nami:'#557a8a',usopp:'#7d7954',sanji:'#756b80',chopper:'#658a8a'};
    const skin = id === 'chopper' ? '#aa725c' : id === 'usopp' ? '#bd855b' : '#edbd8e';
    const shirts = {luffy:'#bd4342',zoro:'#244b3f',nami:'#f4d49a',usopp:'#a67948',sanji:'#202b37',chopper:'#e48aa1'};
    const behind = {
      luffy:'', zoro:'',
      nami:'<path d="M16 36 Q12 6 37 9 Q69 7 67 39 L68 79 H12Z" fill="#dc793c"/>',
      usopp:'<path d="M13 24 Q39 -2 68 23 L66 58 L12 58Z" fill="#332a2a"/>',
      sanji:'<path d="M12 31 Q12 5 43 9 Q65 8 68 33 L67 66 H14Z" fill="#e8c775"/>',
      chopper:'<path d="M14 30 L4 13 L16 18 L17 6 L23 22 M66 30 L76 13 L64 18 L63 6 L57 22" fill="none" stroke="#8f684a" stroke-width="7" stroke-linecap="round"/>'
    }[id];
    const face = `<ellipse cx="40" cy="44" rx="23" ry="26" fill="${skin}"/><ellipse cx="17" cy="46" rx="4" ry="7" fill="${skin}"/><ellipse cx="63" cy="46" rx="4" ry="7" fill="${skin}"/>`;
    const eyes = id === 'sanji'
      ? '<path d="M44 43 Q49 40 54 43" fill="none" stroke="#40312d" stroke-width="2"/><circle cx="28" cy="44" r="2" fill="#252d30"/>'
      : '<circle cx="31" cy="43" r="2.1" fill="#2b302e"/><circle cx="49" cy="43" r="2.1" fill="#2b302e"/>';
    const noses = {luffy:'<path d="M40 46 l-2 6 h4" fill="none" stroke="#b98269" stroke-width="1.5"/>',zoro:'<path d="M40 47 l-2 5 h4" fill="none" stroke="#b98269" stroke-width="1.5"/>',nami:'<path d="M40 47 l-2 5 h4" fill="none" stroke="#b98269" stroke-width="1.5"/>',usopp:'<path d="M39 44 Q53 50 51 55 Q46 60 39 55" fill="#b77c54" stroke="#956847" stroke-width="1"/>',sanji:'<path d="M40 47 l-2 5 h4" fill="none" stroke="#b98269" stroke-width="1.5"/>',chopper:'<ellipse cx="40" cy="52" rx="5" ry="4" fill="#4d6580"/>'};
    const mouths = id === 'luffy' ? '<path d="M30 58 Q40 68 51 57Z" fill="#703638" stroke="#5d3232" stroke-width="1"/><path d="M32 58 Q40 61 49 58" fill="none" stroke="#fff2dc" stroke-width="2"/>' : '<path d="M35 59 Q40 63 45 59" fill="none" stroke="#8c5550" stroke-width="1.8" stroke-linecap="round"/>';
    const fronts = {
      luffy:'<path d="M17 39 Q14 23 26 22 L25 35 L31 27 L34 36 L40 29 L45 35 L55 27 L62 39 Q65 23 58 18 H23Z" fill="#24282a"/><ellipse cx="40" cy="25" rx="36" ry="8" fill="#d8ae65" stroke="#aa8046" stroke-width="2"/><path d="M18 19 Q20 1 40 1 Q60 1 62 19Z" fill="#e6bf77"/><path d="M18 17 Q40 22 62 17 L63 23 Q40 29 17 23Z" fill="#bb4541"/>',
      zoro:'<path d="M16 35 L15 18 L23 24 L25 10 L33 18 L40 7 L46 17 L55 11 L56 24 L65 19 L62 37 Q52 30 48 33 L39 27 L32 34Z" fill="#5aa87a"/><path d="M27 46 l-4 9" stroke="#ac5b5b" stroke-width="1.5"/>',
      nami:'<path d="M16 34 Q19 10 39 11 Q59 9 65 36 Q52 21 42 23 Q31 34 16 34Z" fill="#ef8949"/><path d="M17 31 Q10 52 15 71 M63 29 Q72 50 64 73" fill="none" stroke="#e98040" stroke-width="9"/>',
      usopp:'<path d="M16 35 Q14 15 40 13 Q65 11 65 35 Q48 27 40 28 Q27 30 16 35Z" fill="#29282b"/><path d="M10 25 Q39 17 70 25 L69 34 Q39 26 11 34Z" fill="#dcbd69"/><circle cx="23" cy="32" r="3" fill="#f2db9d"/>',
      sanji:'<path d="M17 37 Q12 11 43 10 Q60 10 65 26 Q50 23 42 34 Q34 44 20 48Z" fill="#edce82"/><path d="M47 34 Q54 25 61 28" fill="none" stroke="#d9b36c" stroke-width="5"/><path d="M22 48 Q31 40 34 31" fill="none" stroke="#f7dd9a" stroke-width="10"/>',
      chopper:'<path d="M14 32 Q10 12 24 12 H56 Q70 12 66 32Z" fill="#ee93ad"/><path d="M14 28 Q40 34 66 28 L64 39 Q40 36 16 39Z" fill="#e2a2b3"/><path d="M34 10 H46 V17 H53 V25 H27 V17 H34Z" fill="#f9e4de"/><circle cx="28" cy="43" r="2" fill="#252d30"/><circle cx="52" cy="43" r="2" fill="#252d30"/>'
    }[id];
    return `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="80" height="80" fill="${backgrounds[id]}"/><circle cx="68" cy="11" r="24" fill="#ffffff10"/>${behind}<path d="M4 80 Q8 65 27 63 L40 69 L53 63 Q71 65 76 80Z" fill="${shirts[id]}"/>${face}${eyes}${noses[id]}${mouths}${fronts}</svg>`;
  }

  function positionAt(distance) {
    const d = Math.min(routeLength, Math.max(0, distance));
    const segment = segments.find(s => d <= s.start + s.length) || segments[segments.length - 1];
    const ratio = (d - segment.start) / segment.length;
    return {x:segment.from.x + (segment.to.x-segment.from.x)*ratio, y:segment.from.y + (segment.to.y-segment.from.y)*ratio};
  }
  function placeElement(el, x, y) {
    el.style.left = `${x / 12}%`;
    el.style.top = `${y / 8}%`;
  }
  function setTip(text) { $('tip-text').textContent = text; }

  function drawBoard() {
    const route = 'M ' + routePoints.map(p => `${p.x} ${p.y}`).join(' L ');
    for (const id of ['route-shadow','route-border','route-main','route-detail']) $(id).setAttribute('d', route);
    grid.innerHTML = '';
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLUMNS; c++) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = `tile${pathTiles.has(`${c},${r}`) ? ' path-tile' : ''}`;
      tile.dataset.c = c; tile.dataset.r = r;
      tile.setAttribute('aria-label', `Column ${c+1}, row ${r+1}${pathTiles.has(`${c},${r}`) ? ', Marine route' : ', grass'}`);
      grid.appendChild(tile);
    }
  }
  function drawCrew() {
    crewGrid.innerHTML = CREW.map((hero,i) => `<button type="button" class="crew-card" data-hero="${hero.id}" aria-label="Recruit ${hero.name}, ${hero.role}, ${hero.cost} berries. Shortcut ${i+1}"><span class="crew-card-top"><span class="crew-portrait">${portrait(hero.id)}</span><span class="crew-price">${hero.cost}</span></span><span class="crew-name">${hero.name}</span><span class="crew-role">${hero.role}</span></button>`).join('');
  }

  function updateRange() {
    const tower = state.inspectedTower;
    if (!tower) { rangeIndicator.style.display = 'none'; return; }
    const range = tower.hero.range + (tower.level-1)*15;
    rangeIndicator.style.display = 'block';
    rangeIndicator.style.left = `${tower.x / 12}%`;
    rangeIndicator.style.top = `${tower.y / 8}%`;
    rangeIndicator.style.width = `${range * 2 / 12}%`;
    rangeIndicator.style.height = `${range * 2 / 8}%`;
  }
  function renderDetails() {
    const hero = state.inspectedTower?.hero || CREW_BY_ID[state.selectedType];
    if (!hero) {
      details.innerHTML = '<div class="details-empty"><span class="details-empty-icon">✧</span><strong>Your crew awaits</strong><span>Select a crewmate to see their abilities, or click a placed tower to upgrade it.</span></div>';
    } else {
      const tower = state.inspectedTower;
      const level = tower?.level || 1;
      const upgradeCost = tower ? Math.round(hero.cost * .75 * level) : 0;
      details.innerHTML = `<div class="detail-main"><span class="detail-portrait">${portrait(hero.id)}</span><div><h3>${hero.name}</h3><span>${tower ? `LEVEL ${level} · ${hero.role.toUpperCase()}` : hero.role.toUpperCase()}</span></div></div><p class="detail-description">${tower ? hero.description : `${hero.description} Click an open grass tile to recruit.`}</p><div class="detail-stats"><span>⚔ <b>${Math.round(hero.damage * (1 + .5 * (level-1)))}</b> damage</span><span>◎ <b>${hero.range + (level-1)*15}</b> range</span></div>${tower ? `<div class="detail-actions"><button type="button" data-action="upgrade" ${level >= 3 || state.money < upgradeCost ? 'disabled' : ''}>${level >= 3 ? 'Max level reached' : `Upgrade · ✦ ${upgradeCost}`}</button><button type="button" class="sell-button" data-action="sell">Sell · ${Math.floor(tower.investment*.65)}</button></div>` : ''}`;
    }
    grid.querySelectorAll('.tile.inspected').forEach(tile => tile.classList.remove('inspected'));
    if (state.inspectedTower) {
      grid.querySelector(`[data-c="${state.inspectedTower.c}"][data-r="${state.inspectedTower.r}"]`)?.classList.add('inspected');
    }
    updateRange();
  }
  function updateHUD() {
    $('wave-value').textContent = state.wave;
    $('lives-value').textContent = state.lives;
    $('money-value').textContent = state.money;
    $('kills-value').textContent = state.kills;
    startButton.disabled = state.phase === 'running' || state.phase === 'won' || state.phase === 'lost';
    startButton.innerHTML = `${state.wave === 0 ? 'Start wave' : 'Next wave'} <span>→</span>`;
    pauseButton.disabled = state.phase !== 'running';
    pauseButton.textContent = state.paused ? '▶' : 'Ⅱ';
    pauseButton.setAttribute('aria-label', state.paused ? 'Resume game' : 'Pause game');
    speedButton.textContent = `${state.speed}×`;
    speedButton.setAttribute('aria-label', `Game speed, currently ${state.speed} times`);
    board.classList.toggle('placing', !!state.selectedType);
    for (const card of crewGrid.children) {
      const hero = CREW_BY_ID[card.dataset.hero];
      card.classList.toggle('selected',state.selectedType === hero.id);
      card.classList.toggle('unaffordable',state.money < hero.cost);
      card.setAttribute('aria-pressed', String(state.selectedType === hero.id));
    }
    if (state.phase === 'running') {
      $('status-icon').textContent = state.paused ? 'Ⅱ' : '⚔';
      $('status-title').textContent = state.paused ? 'Battle paused' : `Wave ${state.wave} in progress`;
      $('status-description').textContent = state.paused ? 'Take a breath, captain. Press play when ready.' : `${state.queue.length + state.enemies.length} Marines remaining · Protect the Sunny!`;
    } else if (state.phase === 'between') {
      $('status-icon').textContent = '✦';
      $('status-title').textContent = `Wave ${state.wave} complete!`;
      $('status-description').textContent = 'Well defended! Reinforce your crew for the next wave.';
    } else if (state.phase === 'ready') {
      $('status-icon').textContent = '⚑';
      $('status-title').textContent = 'The coast is clear';
      $('status-description').textContent = 'Recruit your crew, then begin the first wave.';
    } else {
      $('status-icon').textContent = state.phase === 'won' ? '★' : '☠';
      $('status-title').textContent = state.phase === 'won' ? 'The Sunny is safe!' : 'The Sunny has fallen';
      $('status-description').textContent = state.phase === 'won' ? 'You conquered the Grand Line.' : 'Gather your crew and try again.';
    }
    renderDetails();
  }

  function selectHero(id) {
    if (state.phase === 'won' || state.phase === 'lost') return;
    state.inspectedTower = null;
    state.selectedType = state.selectedType === id ? null : id;
    setTip(state.selectedType ? `${CREW_BY_ID[id].name} selected. Click an empty grass tile to place them. Press Esc to cancel.` : 'Place your crew near bends in the path to cover more ground.');
    updateHUD();
  }
  function onTileClick(c,r) {
    const tower = state.towers.find(t => t.c === c && t.r === r);
    if (tower) {
      state.selectedType = null;
      state.inspectedTower = tower;
      setTip(`Upgrade ${tower.hero.name} for a stronger attack, or sell to recover some berries.`);
      updateHUD(); return;
    }
    if (pathTiles.has(`${c},${r}`)) { setTip('The Marines need that path. Choose a grassy tile instead!'); return; }
    if (!state.selectedType) { setTip('Choose a Straw Hat from the crew panel first.'); return; }
    const hero = CREW_BY_ID[state.selectedType];
    if (state.money < hero.cost) { setTip(`You need ${hero.cost - state.money} more berries to recruit ${hero.name}.`); return; }
    state.money -= hero.cost;
    const newTower = {id:++nextId,hero,c,r,x:c*100+50,y:r*100+50,level:1,investment:hero.cost,cooldown:.2,hits:0,el:document.createElement('div'),firingTimer:0};
    newTower.el.className = 'tower level-1';
    newTower.el.innerHTML = `<span class="tower-portrait">${portrait(hero.id)}</span><span class="tower-level">1</span>`;
    placeElement(newTower.el,newTower.x,newTower.y);
    layer.appendChild(newTower.el);
    state.towers.push(newTower);
    grid.querySelector(`[data-c="${c}"][data-r="${r}"]`).classList.add('occupied');
    setTip(`${hero.name} joined the defense! Select another crewmate or place more.`);
    updateHUD();
  }
  function upgradeTower() {
    const t = state.inspectedTower;
    if (!t || t.level >= 3) return;
    const cost = Math.round(t.hero.cost * .75 * t.level);
    if (state.money < cost) return;
    state.money -= cost; t.investment += cost; t.level++;
    t.el.className = `tower level-${t.level}`;
    t.el.querySelector('.tower-level').textContent = t.level;
    setTip(`${t.hero.name} reached level ${t.level}!`);
    updateHUD();
  }
  function sellTower() {
    const t = state.inspectedTower;
    if (!t) return;
    state.money += Math.floor(t.investment*.65);
    t.el.remove();
    grid.querySelector(`[data-c="${t.c}"][data-r="${t.r}"]`).classList.remove('occupied');
    state.towers = state.towers.filter(item => item !== t);
    state.inspectedTower = null;
    setTip(`${t.hero.name} stepped back from the battle. Berries refunded.`);
    updateHUD();
  }

  function makeWave(wave) {
    const queue = [];
    const count = 7 + wave * 2;
    for (let i=0;i<count;i++) {
      let type = 'grunt';
      if (wave >= 2 && i > 0 && i % 6 === 0) type = 'tank';
      else if (i > 0 && i % 4 === 0) type = 'runner';
      queue.push(type);
    }
    if (wave === 5 || wave === 10) queue.push('boss');
    return queue;
  }
  function startWave() {
    if (state.phase !== 'ready' && state.phase !== 'between') return;
    state.wave++;
    state.queue = makeWave(state.wave);
    state.spawnTimer = .25;
    state.phase = 'running';
    state.paused = false;
    setTip(`Wave ${state.wave} is here! Click a placed crewmate to upgrade them during battle.`);
    updateHUD();
  }
  function spawnEnemy(type) {
    const wave = state.wave;
    const specs = {
      grunt: {hp:52+wave*15,speed:62+wave*1.6,reward:8+Math.floor(wave/3),damage:1,symbol:'⚓'},
      runner: {hp:38+wave*11,speed:94+wave*2,reward:10+Math.floor(wave/3),damage:1,symbol:'➤'},
      tank: {hp:125+wave*37,speed:43+wave,reward:17+wave,damage:2,symbol:'♜'},
      boss: {hp:440+wave*82,speed:37+wave,reward:90,damage:5,symbol:'☠'}
    }[type];
    const el = document.createElement('div');
    el.className = `enemy ${type}`;
    el.innerHTML = `<span>${specs.symbol}</span><div class="enemy-health"><span></span></div>`;
    layer.appendChild(el);
    const enemy = {id:++nextId,type,el,hp:specs.hp,maxHp:specs.hp,speed:specs.speed,reward:specs.reward,damage:specs.damage,distance:0,x:-50,y:350,slow:0,dead:false};
    state.enemies.push(enemy);
    placeElement(el,enemy.x,enemy.y);
  }
  function effect(x,y,kind='hit') {
    const el = document.createElement('div');
    el.className = kind === 'hit' ? 'hit-effect' : 'float-text';
    if (kind !== 'hit') el.textContent = kind;
    placeElement(el,x,y);
    layer.appendChild(el);
    el.addEventListener('animationend',()=>el.remove(),{once:true});
  }
  function removeEnemy(enemy,escaped=false) {
    if (enemy.dead) return;
    enemy.dead = true;
    enemy.el.remove();
    if (escaped) {
      state.lives = Math.max(0,state.lives - enemy.damage);
      effect(1130,590,`−${enemy.damage} ♥`);
      if (state.lives <= 0) endGame(false);
    } else {
      state.kills++;
      state.money += enemy.reward;
      effect(enemy.x,enemy.y,`+${enemy.reward} ✦`);
    }
    updateHUD();
  }
  function damageEnemy(enemy,damage,tower) {
    if (enemy.dead) return;
    enemy.hp -= damage;
    enemy.el.querySelector('.enemy-health span').style.width = `${Math.max(0,enemy.hp/enemy.maxHp*100)}%`;
    enemy.el.classList.toggle('low',enemy.hp/enemy.maxHp < .3);
    effect(enemy.x,enemy.y);
    if (tower.hero.id === 'nami') enemy.slow = 1.7;
    if (tower.hero.id === 'chopper') {
      tower.hits++;
      if (tower.hits % 6 === 0 && state.lives < MAX_LIVES) {
        state.lives++;
        effect(tower.x,tower.y,'+1 ♥');
        updateHUD();
      }
    }
    if (enemy.hp <= 0) removeEnemy(enemy);
  }
  function fire(tower,target) {
    const el = document.createElement('div');
    el.className = `projectile ${tower.hero.id}`;
    placeElement(el,tower.x,tower.y);
    layer.appendChild(el);
    state.projectiles.push({el,x:tower.x,y:tower.y,target,tower});
    tower.firingTimer = .23;
    tower.el.classList.add('firing');
  }
  function updateBattle(dt) {
    if (state.queue.length) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(state.queue.shift());
        state.spawnTimer += Math.max(.48,.86-state.wave*.025);
      }
    }
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      enemy.slow = Math.max(0,enemy.slow-dt);
      enemy.distance += enemy.speed * (enemy.slow > 0 ? .55 : 1) * dt;
      const pos = positionAt(enemy.distance);
      enemy.x = pos.x; enemy.y = pos.y;
      placeElement(enemy.el,enemy.x,enemy.y);
      if (enemy.distance >= routeLength) removeEnemy(enemy,true);
    }
    if (state.phase !== 'running') return;
    state.enemies = state.enemies.filter(e => !e.dead);
    for (const tower of state.towers) {
      tower.cooldown -= dt;
      if (tower.firingTimer > 0) {
        tower.firingTimer -= dt;
        if (tower.firingTimer <= 0) tower.el.classList.remove('firing');
      }
      if (tower.cooldown > 0) continue;
      const range = tower.hero.range + (tower.level-1)*15;
      const target = state.enemies.filter(e => Math.hypot(e.x-tower.x,e.y-tower.y) <= range).sort((a,b) => b.distance-a.distance)[0];
      if (target) {
        fire(tower,target);
        tower.cooldown = tower.hero.cooldown / (1 + (tower.level-1)*.12);
      }
    }
    for (let i=state.projectiles.length-1;i>=0;i--) {
      const p = state.projectiles[i];
      if (p.target.dead) { p.el.remove(); state.projectiles.splice(i,1); continue; }
      const dx = p.target.x-p.x, dy = p.target.y-p.y;
      const dist = Math.hypot(dx,dy);
      const step = 800*dt;
      if (dist <= step || dist < 8) {
        const damage = Math.round(p.tower.hero.damage * (1 + .5 * (p.tower.level-1)));
        const splashTargets = p.tower.hero.id === 'sanji' ? state.enemies.filter(e => e !== p.target && !e.dead && Math.hypot(e.x-p.target.x,e.y-p.target.y) < 70) : [];
        damageEnemy(p.target,damage,p.tower);
        for (const other of splashTargets) damageEnemy(other,Math.round(damage*.55),p.tower);
        p.el.remove(); state.projectiles.splice(i,1);
      } else {
        p.x += dx/dist*step; p.y += dy/dist*step;
        placeElement(p.el,p.x,p.y);
      }
    }
    state.enemies = state.enemies.filter(e => !e.dead);
    if (!state.queue.length && !state.enemies.length) {
      if (state.wave >= MAX_WAVES) endGame(true);
      else {
        const reward = 50 + state.wave*12;
        state.money += reward;
        state.phase = 'between';
        setTip(`Wave cleared! You earned ${reward} bonus berries. Prepare for wave ${state.wave+1}.`);
        updateHUD();
      }
    }
  }
  function endGame(won) {
    state.phase = won ? 'won' : 'lost';
    state.paused = false;
    state.selectedType = null;
    state.inspectedTower = null;
    for (const p of state.projectiles) p.el.remove();
    state.projectiles = [];
    overlay.classList.remove('hidden');
    overlay.innerHTML = `<div class="overlay-content"><span class="overlay-symbol">${won ? '✦' : '☠'}</span><h2>${won ? 'The sea is yours!' : 'The Sunny has fallen.'}</h2><p>${won ? `You held off all ${MAX_WAVES} Marine waves and kept the Straw Hats sailing. The adventure continues!` : `You survived to wave ${state.wave} and defeated ${state.kills} Marines. Rally the crew and give it another shot.`}</p><button type="button" id="overlay-restart">Play again →</button></div>`;
    $('overlay-restart').addEventListener('click',resetGame);
    updateHUD();
  }
  function resetGame() {
    layer.replaceChildren();
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
    nextId = 0;
    state = {wave:0,lives:MAX_LIVES,money:220,kills:0,phase:'ready',selectedType:null,inspectedTower:null,towers:[],enemies:[],projectiles:[],queue:[],spawnTimer:0,paused:false,speed:1};
    grid.querySelectorAll('.tile.occupied').forEach(tile => tile.classList.remove('occupied'));
    setTip('Place your crew near bends in the path to cover more ground.');
    updateHUD();
  }
  function frame(time) {
    const dt = Math.min((time-lastFrame)/1000,.05);
    lastFrame = time;
    if (state.phase === 'running' && !state.paused) {
      updateBattle(dt*state.speed);
      if (state.phase === 'running') $('status-description').textContent = `${state.queue.length + state.enemies.length} Marines remaining · Protect the Sunny!`;
    }
    requestAnimationFrame(frame);
  }

  drawBoard();
  drawCrew();
  resetGame();
  crewGrid.addEventListener('click', e => {
    const card = e.target.closest('[data-hero]');
    if (card) selectHero(card.dataset.hero);
  });
  grid.addEventListener('click', e => {
    const tile = e.target.closest('.tile');
    if (tile && state.phase !== 'won' && state.phase !== 'lost') onTileClick(Number(tile.dataset.c),Number(tile.dataset.r));
  });
  details.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'upgrade') upgradeTower();
    if (action === 'sell') sellTower();
  });
  startButton.addEventListener('click',startWave);
  pauseButton.addEventListener('click',() => { if (state.phase === 'running') { state.paused = !state.paused; updateHUD(); } });
  speedButton.addEventListener('click',() => { state.speed = state.speed === 1 ? 2 : 1; updateHUD(); });
  $('reset-button').addEventListener('click',() => {
    if (state.phase === 'ready' && state.towers.length === 0) return;
    if (window.confirm('Start a new voyage? Your current progress will be lost.')) resetGame();
  });
  document.addEventListener('keydown',e => {
    if (e.target instanceof HTMLElement && ['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key >= '1' && e.key <= '6') selectHero(CREW[Number(e.key)-1].id);
    if (e.key === 'Escape') { state.selectedType = null; state.inspectedTower = null; updateHUD(); }
    if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); if (state.phase === 'running') { state.paused = !state.paused; updateHUD(); } else startWave(); }
  });
  requestAnimationFrame(time => { lastFrame = time; requestAnimationFrame(frame); });
})();
