// ================================================================
//  game.js — Author Competition Game Engine
//  Each HTML page must define window.GAME_CONFIG before this file
//  is loaded. See the GAME_CONFIG reference at the bottom of this
//  file for every supported option.
// ================================================================

(function () {

  // ── Read configuration ────────────────────────────────────────
  var C            = window.GAME_CONFIG  || {};
  var ROUNDS       = C.rounds            || {};
  var SAVE_KEY     = C.saveKey           || 'authorCompGame';
  var IS_REVIEW    = !!C.isReview;
  var IS_DEMO      = !!C.isDemo;
  var TPT_URL      = C.tptUrl            || '#';
  var PHASE1_LABEL = C.phase1Label       || 'Fact Gathering';
  var PHASE1_NOTE  = C.phase1Note        || '';
  var TIMER_ALERT  = C.timerAlertText    || "Time\u2019s up! Begin Phase\u00a02.";

  // ── Shared team colours (eight slots, same across all authors) ─
  var TEAM_COLORS = [
    { bg: '#D18080', border: '#b05050' },  // Crimson  (Blood)
    { bg: '#FFE791', border: '#c8a800' },  // Gold     (Yellow Bile)
    { bg: '#7EA9D6', border: '#4a7ab5' },  // Cobalt   (Phlegm)
    { bg: '#B8B8B8', border: '#888888' },  // Ash      (Black Bile)
    { bg: '#8FBC8F', border: '#5a8a5a' },  // Sage
    { bg: '#F4A460', border: '#c07030' },  // Amber
    { bg: '#C4A8D4', border: '#8860a8' },  // Violet
    { bg: '#7ECACA', border: '#3d9090' },  // Teal
  ];

  var MAX_TEAMS = 8;

  // ── Game state ────────────────────────────────────────────────
  var timerInterval;
  var currentRound     = 1;
  var currentGameData  = [];
  var numTeams         = 4;
  var numTeamsEntering = 4;

  // ================================================================
  //  localStorage helpers
  // ================================================================

  function saveState() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        currentRound   : currentRound,
        currentGameData: currentGameData,
        numTeams       : numTeams,
        activePage     : getActivePage(),
        savedAt        : Date.now()
      }));
    } catch(e) {}
  }

  function getActivePage() {
    var ids = ['instructions-page','team-page','round-page',
               'scoreboard-page','gameover-page'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.style.display !== 'none') return ids[i];
    }
    return 'instructions-page';
  }

  function checkSavedState() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      var state = JSON.parse(raw);
      if (Date.now() - state.savedAt > 12 * 3600 * 1000) {
        localStorage.removeItem(SAVE_KEY); return;
      }
      if (!state.currentGameData || state.currentGameData.length === 0) return;
      window._savedState = state;
      var banner = document.getElementById('restore-banner');
      if (banner) banner.style.display = 'block';
    } catch(e) {
      try { localStorage.removeItem(SAVE_KEY); } catch(e2) {}
    }
  }

  function restoreGame() {
    var s = window._savedState;
    if (!s) return;
    currentRound    = s.currentRound;
    currentGameData = s.currentGameData;
    numTeams        = s.numTeams;
    var banner = document.getElementById('restore-banner');
    if (banner) banner.style.display = 'none';
    hideAllPages();
    if (s.activePage === 'round-page') {
      loadRound();
    } else if (s.activePage === 'scoreboard-page') {
      document.getElementById('scoreboard-page').style.display = 'block';
      buildScoreboard(currentGameData, 'scoreboard-table-container');
      updateScoreboardButton();
    } else if (s.activePage === 'gameover-page') {
      showGameOver();
    } else {
      document.getElementById('instructions-page').style.display = 'block';
    }
  }

  function dismissRestore() {
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
    var banner = document.getElementById('restore-banner');
    if (banner) banner.style.display = 'none';
    window._savedState = null;
  }

  // ================================================================
  //  Modal (stealing rules)
  // ================================================================

  function openModal() {
    var m = document.getElementById('steal-modal');
    if (m) m.classList.add('open');
  }

  function closeModal() {
    var m = document.getElementById('steal-modal');
    if (m) m.classList.remove('open');
  }

  function handleOverlayClick(e) {
    if (e.target === document.getElementById('steal-modal')) closeModal();
  }

  // ================================================================
  //  Page helpers
  // ================================================================

  function hideAllPages() {
    var ids = ['instructions-page','team-page','round-page',
               'scoreboard-page','gameover-page'];
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  // ================================================================
  //  Instructions → Team page
  // ================================================================

  function goToTeamInput() {
    document.getElementById('instructions-page').style.display = 'none';
    document.getElementById('team-page').style.display = 'block';
    initTeamPage();
  }

  // ================================================================
  //  Team input page
  // ================================================================

  function initTeamPage() {
    numTeamsEntering = 4;
    var container = document.getElementById('team-inputs');
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < 4; i++) buildTeamRow(i);
    var addBtn = document.getElementById('add-team-btn');
    var remBtn = document.getElementById('remove-team-btn');
    if (addBtn) { addBtn.disabled = false; addBtn.textContent = '+ Add Team'; }
    if (remBtn) remBtn.style.display = 'none';
  }

  function buildTeamRow(i) {
    var c   = TEAM_COLORS[i];
    var row = document.createElement('div');
    row.className = 'team-input-row';
    row.id = 'team-row-' + i;
    var inp = document.createElement('input');
    inp.type        = 'text';
    inp.id          = 'team' + i;
    inp.className   = 'team-input';
    inp.placeholder = 'Team ' + (i + 1) + ' Name';
    inp.style.borderLeftColor = c.bg;
    row.appendChild(inp);
    document.getElementById('team-inputs').appendChild(row);
  }

  function addTeamInput() {
    if (numTeamsEntering >= MAX_TEAMS) return;
    buildTeamRow(numTeamsEntering);
    numTeamsEntering++;
    var remBtn = document.getElementById('remove-team-btn');
    if (remBtn) remBtn.style.display = 'inline-block';
    var addBtn = document.getElementById('add-team-btn');
    if (numTeamsEntering >= MAX_TEAMS && addBtn) {
      addBtn.disabled    = true;
      addBtn.textContent = 'Maximum 8 Teams';
    }
    var inp = document.getElementById('team' + (numTeamsEntering - 1));
    if (inp) inp.focus();
  }

  function removeLastTeam() {
    if (numTeamsEntering <= 4) return;
    numTeamsEntering--;
    var row = document.getElementById('team-row-' + numTeamsEntering);
    if (row) row.remove();
    var addBtn = document.getElementById('add-team-btn');
    if (addBtn) { addBtn.disabled = false; addBtn.textContent = '+ Add Team'; }
    if (numTeamsEntering <= 4) {
      var remBtn = document.getElementById('remove-team-btn');
      if (remBtn) remBtn.style.display = 'none';
    }
  }

  function submitTeams() {
    numTeams = numTeamsEntering;
    currentGameData = [];
    for (var i = 0; i < numTeams; i++) {
      var el  = document.getElementById('team' + i);
      var val = (el ? el.value : '').trim() || 'Team ' + (i + 1);
      currentGameData.push([val, 0, 0, 0, 0]);
    }
    saveState();
    loadRound();
  }

  // ================================================================
  //  Round page
  // ================================================================

  function loadRound() {
    clearInterval(timerInterval);
    hideAllPages();
    document.getElementById('round-page').style.display = 'block';

    // Round title & subtitle from GAME_CONFIG
    var rd = ROUNDS[currentRound] || {};
    var titleEl    = document.getElementById('round-title');
    var subtitleEl = document.getElementById('round-subtitle');
    if (titleEl)    titleEl.innerText    = rd.title    || 'Round ' + currentRound;
    if (subtitleEl) subtitleEl.innerText = rd.subtitle || '';

    // Phase 1 label & note from GAME_CONFIG
    var ph1 = document.getElementById('phase1-heading');
    var ph1n = document.getElementById('phase1-note');
    if (ph1)  ph1.innerText  = 'Phase 1: ' + PHASE1_LABEL;
    if (ph1n) ph1n.innerHTML = PHASE1_NOTE;

    // Timer reset
    var td = document.getElementById('timer-display');
    if (td) { td.innerText = '05:00'; td.style.color = 'var(--timer-color, #d32f2f)'; }
    var tb = document.getElementById('timer-btn');
    if (tb) tb.disabled = false;

    // Save button
    var srb = document.getElementById('save-round-btn');
    if (srb) { srb.innerText = 'Save Round ' + currentRound + ' Scores'; srb.disabled = false; }

    buildRoundPage();
    saveState();
  }

  function buildRoundPage() {
    // ── Facts grid ───────────────────────────────────────────
    var grid = document.getElementById('facts-grid');
    if (!grid) return;
    grid.innerHTML = '';
    grid.style.gridTemplateColumns =
      numTeams <= 4 ? 'repeat(' + numTeams + ', 1fr)' : 'repeat(4, 1fr)';

    for (var i = 0; i < numTeams; i++) {
      (function(idx) {
        var c   = TEAM_COLORS[idx];
        var col = document.createElement('div');
        col.className = 'fact-col';
        col.id        = 'fact-col-' + idx;

        var hdr = document.createElement('div');
        hdr.className               = 'fact-col-header';
        hdr.style.backgroundColor   = c.bg;
        hdr.style.borderBottomColor = c.border;
        hdr.textContent = currentGameData[idx][0];

        var list = document.createElement('div');
        list.className = 'fact-list';
        list.id        = 'fact-list-' + idx;

        var addBtn = document.createElement('button');
        addBtn.className   = 'add-fact-btn';
        addBtn.textContent = '+ Add Fact';
        addBtn.onclick     = function() { addFactRow(idx); };

        col.appendChild(hdr);
        col.appendChild(list);
        col.appendChild(addBtn);
        grid.appendChild(col);
        addFactRow(idx, true); // seed one empty row silently
      })(i);
    }

    // ── Score rows ───────────────────────────────────────────
    var sec = document.getElementById('scores-section');
    if (!sec) return;
    sec.innerHTML = '<p class="scores-label"><strong>Round Scores</strong> &mdash; edit any score manually if needed.</p>';

    for (var j = 0; j < numTeams; j++) {
      (function(idx) {
        var c   = TEAM_COLORS[idx];
        var row = document.createElement('div');
        row.className = 'score-row';

        var badge = document.createElement('span');
        badge.className             = 'team-score-badge';
        badge.style.backgroundColor = c.bg;
        badge.style.borderColor     = c.border;
        badge.textContent           = currentGameData[idx][0];

        var inp = document.createElement('input');
        inp.type      = 'number';
        inp.id        = 'score-' + idx;
        inp.className = 'score-input';
        inp.value     = 0;
        inp.min       = 0;

        var pts = document.createElement('span');
        pts.textContent = 'pts';
        pts.className   = 'pts-label';

        var pen = document.createElement('button');
        pen.className = 'penalty-btn';
        pen.innerHTML = '&#x2212;1 Penalty';
        pen.title     = 'Deduct 1 point from ' + currentGameData[idx][0];
        pen.onclick   = function() { applyPenalty(idx); };

        row.appendChild(badge);
        row.appendChild(inp);
        row.appendChild(pts);
        row.appendChild(pen);
        sec.appendChild(row);
      })(j);
    }
  }

  // ================================================================
  //  Fact entry
  // ================================================================

  function addFactRow(teamIdx, silent) {
    var list = document.getElementById('fact-list-' + teamIdx);
    if (!list) return;
    var num  = list.children.length + 1;
    var row  = document.createElement('div');
    row.className = 'fact-row';

    var ns = document.createElement('span');
    ns.className   = 'fact-num';
    ns.textContent = num + '.';

    var inp = document.createElement('input');
    inp.type        = 'text';
    inp.className   = 'fact-input';
    inp.placeholder = 'Fact ' + num + '\u2026';
    inp.addEventListener('keydown', (function(idx) {
      return function(e) { factKeyDown(e, idx); };
    })(teamIdx));

    var del = document.createElement('button');
    del.className   = 'fact-del';
    del.textContent = '\u00D7';
    del.title       = 'Remove this fact';
    del.onclick     = (function(idx) {
      return function() { deleteFactRow(del, idx); };
    })(teamIdx);

    row.appendChild(ns);
    row.appendChild(inp);
    row.appendChild(del);
    list.appendChild(row);

    if (!silent) {
      inp.focus();
      syncScoreToFacts(teamIdx);
      saveState();
    }
  }

  function deleteFactRow(delBtn, teamIdx) {
    var row  = delBtn.parentElement;
    var list = row.parentElement;
    if (list.children.length <= 1) {
      var fi = row.querySelector('.fact-input');
      if (fi) fi.value = '';
      syncScoreToFacts(teamIdx);
      return;
    }
    row.remove();
    renumberFacts(teamIdx);
    syncScoreToFacts(teamIdx);
    saveState();
  }

  function renumberFacts(teamIdx) {
    var list = document.getElementById('fact-list-' + teamIdx);
    if (!list) return;
    var rows = list.querySelectorAll('.fact-row');
    rows.forEach(function(row, idx) {
      var ns  = row.querySelector('.fact-num');
      var inp = row.querySelector('.fact-input');
      if (ns)  ns.textContent  = (idx + 1) + '.';
      if (inp) inp.placeholder = 'Fact ' + (idx + 1) + '\u2026';
    });
  }

  function factKeyDown(e, teamIdx) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFactRow(teamIdx, false);
    } else if (e.key === 'Backspace') {
      var inp  = e.target;
      var list = inp.parentElement && inp.parentElement.parentElement;
      if (inp.value === '' && list && list.children.length > 1) {
        var prev = inp.parentElement.previousElementSibling;
        deleteFactRow(inp.parentElement.querySelector('.fact-del'), teamIdx);
        if (prev) {
          var pi = prev.querySelector('.fact-input');
          if (pi) pi.focus();
        }
      }
    }
  }

  function syncScoreToFacts(teamIdx) {
    var list = document.getElementById('fact-list-' + teamIdx);
    var inp  = document.getElementById('score-' + teamIdx);
    if (list && inp) inp.value = list.querySelectorAll('.fact-row').length;
  }

  // ================================================================
  //  Penalty
  // ================================================================

  function applyPenalty(teamIdx) {
    var inp = document.getElementById('score-' + teamIdx);
    if (!inp) return;
    inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) - 1);
    saveState();
  }

  // ================================================================
  //  Timer
  // ================================================================

  function startTimer(duration) {
    clearInterval(timerInterval);
    var timer = duration;
    var disp  = document.getElementById('timer-display');
    var tb    = document.getElementById('timer-btn');
    if (tb) tb.disabled = true;

    timerInterval = setInterval(function() {
      var m = parseInt(timer / 60, 10);
      var s = parseInt(timer % 60, 10);
      if (disp) {
        disp.innerText = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
        if (timer <= 60 && timer > 0) disp.style.color = 'var(--timer-warn-color, #e65100)';
      }
      if (--timer < 0) {
        clearInterval(timerInterval);
        if (disp) { disp.innerText = "TIME'S UP!"; disp.style.color = 'var(--timer-color, #d32f2f)'; }
        try {
          new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play();
        } catch(e) {}
        setTimeout(function() { alert(TIMER_ALERT); }, 500);
      }
    }, 1000);
  }

  // ================================================================
  //  Save round & scoreboard
  // ================================================================

  function saveRoundScores() {
    for (var i = 0; i < numTeams; i++) {
      var el = document.getElementById('score-' + i);
      var s  = el ? (parseInt(el.value, 10) || 0) : 0;
      currentGameData[i][currentRound] = s;
      currentGameData[i][4] = currentGameData[i][1]
                            + currentGameData[i][2]
                            + currentGameData[i][3];
    }
    saveState();
    hideAllPages();
    document.getElementById('scoreboard-page').style.display = 'block';
    buildScoreboard(currentGameData, 'scoreboard-table-container');
    updateScoreboardButton();
  }

  function buildScoreboard(data, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var maxScore = Math.max.apply(null, data.map(function(r) { return r[4]; }));

    var html = '<table class="scoreboard-table" border="1">';
    html += '<tr class="scoreboard-header-row">';
    ['Team','Rd\u00a01','Rd\u00a02','Rd\u00a03','Total'].forEach(function(h) {
      html += '<th class="sb-th">' + h + '</th>';
    });
    html += '</tr>';

    data.forEach(function(row, i) {
      var isLeader = row[4] === maxScore && maxScore > 0;
      var c        = TEAM_COLORS[i] || TEAM_COLORS[0];
      var badge    = isLeader ? ' &#x1F451;' : '';
      html += '<tr class="sb-row' + (isLeader ? ' sb-leader' : '') + '">';
      html += '<td class="sb-team-cell"><span class="sb-team-badge" style="background:' + c.bg
           +  ';border-color:' + c.border + '"><strong>' + row[0] + badge + '</strong></span></td>';
      html += '<td class="sb-score">' + row[1] + '</td>';
      html += '<td class="sb-score">' + row[2] + '</td>';
      html += '<td class="sb-score">' + row[3] + '</td>';
      html += '<td class="sb-total' + (isLeader ? ' sb-total-leader' : '') + '"><strong>' + row[4] + '</strong></td>';
      html += '</tr>';
    });
    html += '</table>';
    container.innerHTML = html;
  }

  function updateScoreboardButton() {
    var btn = document.getElementById('next-round-btn');
    if (!btn) return;

    if (IS_DEMO) {
      // Demo mode: always show the unlock button
      btn.innerText            = '\uD83D\uDD12 Unlock Rounds 2 & 3 \u2014 Get the Full Game!';
      btn.style.backgroundColor = '#e65100';
      btn.onclick = function() { window.open(TPT_URL, '_blank'); };
      return;
    }

    if (currentRound < 3) {
      btn.innerText = 'Start Round ' + (currentRound + 1);
      btn.style.backgroundColor = '';
      btn.onclick = prepareNextRound;
    } else {
      btn.innerText = 'See Final Results';
      btn.style.backgroundColor = '';
      btn.onclick = showGameOver;
    }
  }

  function prepareNextRound() {
    currentRound++;
    loadRound();
  }

  // ================================================================
  //  Game Over
  // ================================================================

  function showGameOver() {
    hideAllPages();
    document.getElementById('gameover-page').style.display = 'block';
    buildScoreboard(currentGameData, 'final-scoreboard-container');
    var maxScore = Math.max.apply(null, currentGameData.map(function(r) { return r[4]; }));
    var winners  = currentGameData.filter(function(r) { return r[4] === maxScore; }).map(function(r) { return r[0]; });
    var wn = document.getElementById('winner-name');
    if (wn) wn.innerText = winners.length > 1
      ? winners.join(' & ') + ' \u2014 it\u2019s a tie!'
      : winners[0];
    saveState();
  }

  function restartGame() {
    currentRound    = 1;
    currentGameData = [];
    numTeams        = 4;
    clearInterval(timerInterval);
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
    hideAllPages();
    document.getElementById('instructions-page').style.display = 'block';
  }

  // ================================================================
  //  Keyboard navigation
  //  Enter navigates forward on instructions/team/scoreboard pages.
  //  Round page is deliberately excluded to protect fact text inputs.
  // ================================================================

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    var ip = document.getElementById('instructions-page');
    var tp = document.getElementById('team-page');
    var sp = document.getElementById('scoreboard-page');
    if (ip && ip.style.display !== 'none') {
      var b = ip.querySelector('button');
      if (b) b.click();
    } else if (tp && tp.style.display !== 'none') {
      if (document.activeElement && document.activeElement.classList.contains('team-input')) return;
      var last = tp.querySelector('button:last-of-type');
      if (last) last.click();
    } else if (sp && sp.style.display !== 'none') {
      var nb = document.getElementById('next-round-btn');
      if (nb) nb.click();
    }
  });

  // ================================================================
  //  Initialise on DOM ready
  // ================================================================

  document.addEventListener('DOMContentLoaded', checkSavedState);

  // ================================================================
  //  Expose to global scope (required for HTML onclick attributes)
  // ================================================================

  window.goToTeamInput        = goToTeamInput;
  window.addTeamInput         = addTeamInput;
  window.removeLastTeam       = removeLastTeam;
  window.submitTeams          = submitTeams;
  window.startTimer           = startTimer;
  window.saveRoundScores      = saveRoundScores;
  window.prepareNextRound     = prepareNextRound;
  window.showGameOver         = showGameOver;
  window.restartGame          = restartGame;
  window.openModal            = openModal;
  window.closeModal           = closeModal;
  window.handleOverlayClick   = handleOverlayClick;
  window.restoreGame          = restoreGame;
  window.dismissRestore       = dismissRestore;

})();

// ================================================================
//  GAME_CONFIG reference
//  Define this object in a <script> block BEFORE loading game.js.
//
//  window.GAME_CONFIG = {
//    saveKey       : 'uniqueKeyPerGame',   // e.g. 'poeGame', 'poeReview'
//    isReview      : false,                // true = review/recall mode
//    isDemo        : false,                // true = lock after Round 1
//    tptUrl        : 'https://...',        // used by demo unlock button
//    rounds: {
//      1: { title: 'Round 1: ...', subtitle: '...' },
//      2: { title: 'Round 2: ...', subtitle: '...' },
//      3: { title: 'Round 3: ...', subtitle: '...' }
//    },
//    phase1Label   : 'Fact Gathering',     // or 'Recall' for review
//    phase1Note    : 'Use your computers…',// HTML string shown under heading
//    timerAlertText: 'Time is up! ...',    // alert when timer hits zero
//  };
// ================================================================