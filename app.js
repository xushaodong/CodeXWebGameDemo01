const state = {
  route: '/splash',
  level: 1,
  gold: 200,
  soundOn: true,
  game: null,
  inventory: { undo: 3, shuffle: 3, hint: 3, revive: 1 },
};

const icons = ['🍓', '🍋', '🍇', '🥝', '🥕', '🍄', '🍪', '🧋', '🍉', '🌽', '🍒', '🥥'];
const levelConfig = (lv) => ({
  types: Math.min(6 + Math.floor((lv - 1) / 5), 12),
  count: Math.min(60 + lv * 6, 120),
  layers: Math.min(3 + Math.floor((lv - 1) / 4), 7),
});

const view = document.querySelector('#view');
const subtitle = document.querySelector('#pageSubtitle');
document.querySelectorAll('[data-route]').forEach((btn) => {
  btn.addEventListener('click', () => navigate(btn.dataset.route));
});
document.querySelector('#backBtn').addEventListener('click', () => navigate('/home'));
document.querySelector('#soundBtn').addEventListener('click', () => {
  state.soundOn = !state.soundOn;
  document.querySelector('#soundBtn').textContent = state.soundOn ? '🔊' : '🔈';
});

function navigate(rawRoute) {
  const route = rawRoute.startsWith('/game') ? rawRoute : rawRoute.split('?')[0];
  state.route = route;
  render();
}

function template(id) {
  return document.querySelector(id).content.cloneNode(true);
}

function render() {
  view.innerHTML = '';
  const route = state.route;

  if (route === '/splash') renderSplash();
  else if (route === '/home') renderHome();
  else if (route.startsWith('/game')) renderGame(route);
  else if (route === '/result') renderResult();
  else renderPlaceholder(route);
}

function renderSplash() {
  subtitle.textContent = '启动页';
  view.appendChild(template('#splashTpl'));
  const bar = document.querySelector('#loadBar');
  const pct = document.querySelector('#loadPct');
  const enter = document.querySelector('#enterBtn');
  let v = 0;
  const t = setInterval(() => {
    v += 10;
    bar.style.width = `${v}%`;
    pct.textContent = `${v}%`;
    if (v >= 100) {
      clearInterval(t);
      enter.disabled = false;
      enter.addEventListener('click', () => navigate('/home'));
    }
  }, 80);
}

function renderHome() {
  subtitle.textContent = `金币 ${state.gold}`;
  view.appendChild(template('#homeTpl'));
  document.querySelector('#currentLevelTxt').textContent = state.level;
  document.querySelector('#continueBtn').addEventListener('click', () => navigate(`/game/${state.level}`));
  view.querySelectorAll('[data-route]').forEach((btn) => btn.addEventListener('click', () => navigate(btn.dataset.route)));
}

function buildLevel(lv) {
  const cfg = levelConfig(lv);
  const boardW = 520;
  const boardH = 360;
  const total = cfg.count - (cfg.count % 3);
  const pool = icons.slice(0, cfg.types);
  const tiles = [];

  for (let i = 0; i < total / 3; i += 1) {
    const kind = pool[i % pool.length];
    for (let k = 0; k < 3; k += 1) {
      const layer = Math.floor(Math.random() * cfg.layers);
      tiles.push({
        id: `${kind}-${i}-${k}-${Math.random().toString(36).slice(2, 7)}`,
        kind,
        x: Math.floor(Math.random() * (boardW - 64)),
        y: Math.floor(Math.random() * (boardH - 64)),
        z: layer,
        removed: false,
      });
    }
  }
  tiles.sort((a, b) => a.z - b.z);
  return { id: lv, total, removedCount: 0, boardW, boardH, tiles, tray: [], history: [], alive: true };
}

function isCovered(tile, tiles) {
  return tiles.some((other) => {
    if (other.removed || other.id === tile.id || other.z <= tile.z) return false;
    const overlapX = Math.abs(other.x - tile.x) < 42;
    const overlapY = Math.abs(other.y - tile.y) < 42;
    return overlapX && overlapY;
  });
}

function renderGame(route) {
  const lv = Number(route.split('/')[2]) || state.level;
  state.level = lv;
  if (!state.game || state.game.id !== lv || !state.game.alive) state.game = buildLevel(lv);

  subtitle.textContent = `第 ${lv} 关`;
  view.appendChild(template('#gameTpl'));
  document.querySelector('#levelTitle').textContent = `第 ${lv} 关`;

  const board = document.querySelector('#board');
  board.style.width = '100%';

  const draw = () => {
    board.innerHTML = '';
    const activeTiles = state.game.tiles.filter((t) => !t.removed);
    activeTiles.sort((a, b) => a.z - b.z).forEach((tile) => {
      const blocked = isCovered(tile, activeTiles);
      const el = document.createElement('button');
      el.className = `tile ${blocked ? 'blocked' : ''}`;
      el.style.left = `${tile.x}px`;
      el.style.top = `${tile.y}px`;
      el.style.zIndex = String(tile.z + 1);
      el.textContent = tile.kind;
      el.disabled = blocked;
      el.addEventListener('click', () => pickTile(tile.id));
      board.appendChild(el);
    });

    renderTray();
    updateProgress();
  };

  function pickTile(id) {
    const tile = state.game.tiles.find((t) => t.id === id);
    if (!tile || tile.removed) return;
    tile.removed = true;
    state.game.history.push(id);
    state.game.removedCount += 1;
    state.game.tray.push(tile.kind);
    state.game.tray.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    clearTriples();
    draw();
    checkGameEnd();
  }

  function clearTriples() {
    const counts = state.game.tray.reduce((acc, k) => ((acc[k] = (acc[k] || 0) + 1), acc), {});
    Object.entries(counts).forEach(([kind, count]) => {
      if (count >= 3) {
        let removed = 0;
        state.game.tray = state.game.tray.filter((k) => {
          if (k === kind && removed < 3) {
            removed += 1;
            return false;
          }
          return true;
        });
      }
    });
  }

  function renderTray() {
    const tray = document.querySelector('#tray');
    tray.innerHTML = '';
    for (let i = 0; i < 7; i += 1) {
      const item = document.createElement('div');
      item.className = state.game.tray[i] ? 'tray-item' : 'slot';
      item.textContent = state.game.tray[i] || '';
      tray.appendChild(item);
    }
    document.querySelector('#trayWarn').classList.toggle('hidden', state.game.tray.length < 5);
    tray.classList.toggle('danger', state.game.tray.length >= 7);
  }

  function updateProgress() {
    const pct = Math.round((state.game.removedCount / state.game.total) * 100);
    const bar = document.querySelector('#levelProgress');
    bar.style.width = `${pct}%`;
    bar.style.background = pct < 33 ? '#ef4444' : pct < 66 ? '#f59e0b' : '#10b981';
    document.querySelector('#progressText').textContent = `${pct}%`;
  }

  function checkGameEnd() {
    if (state.game.tray.length >= 7) {
      state.game.alive = false;
      state.lastResult = { win: false, reason: '收集槽已满，挑战失败', gold: 0 };
      setTimeout(() => navigate('/result'), 350);
      return;
    }
    if (state.game.removedCount >= state.game.total) {
      state.game.alive = false;
      const reward = 30 + lv * 5;
      state.gold += reward;
      state.lastResult = { win: true, reason: '恭喜通关！', gold: reward };
      setTimeout(() => navigate('/result'), 280);
    }
  }

  function bindTools() {
    ['undo', 'shuffle', 'hint', 'revive'].forEach((name) => {
      document.querySelector(`#${name}Count`).textContent = state.inventory[name];
      document.querySelector(`[data-tool="${name}"]`).addEventListener('click', () => {
        if (state.inventory[name] <= 0) return;
        if (name === 'undo') {
          const last = state.game.history.pop();
          const kind = state.game.tray.pop();
          if (last && kind) {
            const tile = state.game.tiles.find((t) => t.id === last);
            tile.removed = false;
            state.game.removedCount -= 1;
          }
        }
        if (name === 'shuffle') {
          state.game.tiles.filter((t) => !t.removed).forEach((t) => {
            t.x = Math.floor(Math.random() * (state.game.boardW - 64));
            t.y = Math.floor(Math.random() * (state.game.boardH - 64));
          });
        }
        if (name === 'hint') {
          const active = state.game.tiles.filter((t) => !t.removed && !isCovered(t, state.game.tiles));
          const countMap = active.reduce((acc, t) => ((acc[t.kind] = (acc[t.kind] || 0) + 1), acc), {});
          const kind = Object.keys(countMap).find((k) => countMap[k] >= 3) || active[0]?.kind;
          [...document.querySelectorAll('.tile')].forEach((el) => {
            if (el.textContent === kind) {
              el.classList.add('hint');
              setTimeout(() => el.classList.remove('hint'), 600);
            }
          });
        }
        if (name === 'revive' && state.game.tray.length >= 6) {
          state.game.tray = [];
        }
        state.inventory[name] -= 1;
        document.querySelector(`#${name}Count`).textContent = state.inventory[name];
        draw();
      });
    });
  }

  draw();
  bindTools();
}

function renderResult() {
  subtitle.textContent = '结算页';
  view.appendChild(template('#resultTpl'));
  const result = state.lastResult || { win: false, reason: '结果未知', gold: 0 };
  document.querySelector('#resultTitle').textContent = result.win ? '🎉 通关成功' : '💥 挑战失败';
  document.querySelector('#resultDesc').textContent = result.reason;
  document.querySelector('#resultGold').textContent = result.gold;
  document.querySelector('#retryBtn').addEventListener('click', () => {
    state.game = null;
    navigate(`/game/${state.level}`);
  });
  document.querySelector('#nextBtn').addEventListener('click', () => {
    state.game = null;
    if (result.win) state.level += 1;
    navigate(`/game/${state.level}`);
  });
}

function renderPlaceholder(route) {
  subtitle.textContent = route;
  const sec = document.createElement('section');
  sec.className = 'screen';
  sec.innerHTML = `<div class="card"><h2>${route.replace('/', '') || '页面'}</h2><p>该页面为 PRD 导航占位，已预留扩展入口。</p><button class="cta" data-route="/home">返回首页</button></div>`;
  view.appendChild(sec);
  sec.querySelector('[data-route]').addEventListener('click', () => navigate('/home'));
}

render();
