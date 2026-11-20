// The hero playground: a small commit graph the visitor can squash, rebase,
// merge and reset, with every step on an undo/redo stack and listed in a
// journal, as in the app. A short tour plays while the window is on screen
// until the visitor presses anything; it never plays under reduced motion.
// Without JS the window keeps its static screenshot.
(function () {
  var root = document.getElementById('play');
  if (!root || !window.SVGElement) return;

  var ROW = 34;          // row height, px
  var LANE = 22;         // lane spacing, px
  var X0 = 18;           // x of lane 0
  var ROWS = 7;          // the most rows any state can show
  var GUTTER = X0 + LANE + 18;
  var SVGNS = 'http://www.w3.org/2000/svg';

  // ---- Model ------------------------------------------------------------
  // A commit: id, msg, lane (0 main, 1 feature), parents, t (creation order,
  // which is also display order, newest on top).
  var clock = 0;
  function commit(id, msg, lane, parents) {
    return { id: id, msg: msg, lane: lane, parents: parents, t: ++clock };
  }
  function initial() {
    var list = [
      commit('a1', 'Initial commit', 0, []),
      commit('a2', 'Add commit graph', 0, ['a1']),
      commit('b1', 'Add login form', 1, ['a2']),
      commit('a3', 'Fix scroll jump on resize', 0, ['a2']),
      commit('b2', 'Validate email field', 1, ['b1']),
      commit('b3', 'fixup! Validate email field', 1, ['b2'])
    ];
    var commits = {};
    list.forEach(function (c) { commits[c.id] = c; });
    return { commits: commits, refs: { main: 'a3', feat: 'b3' } };
  }
  function clone(s) {
    var commits = {};
    Object.keys(s.commits).forEach(function (k) { commits[k] = s.commits[k]; });
    return { commits: commits, refs: { main: s.refs.main, feat: s.refs.feat } };
  }
  function reach(s, from) {
    var seen = {}, stack = [from];
    while (stack.length) {
      var id = stack.pop();
      if (!id || seen[id]) continue;
      seen[id] = true;
      stack.push.apply(stack, s.commits[id].parents);
    }
    return seen;
  }
  function visible(s) {
    var a = reach(s, s.refs.main), b = reach(s, s.refs.feat), out = [];
    Object.keys(s.commits).forEach(function (k) { if (a[k] || b[k]) out.push(s.commits[k]); });
    return out.sort(function (x, y) { return y.t - x.t; });
  }
  // Commits on feature/login that main doesn't have, oldest first.
  function ahead(s) {
    var onMain = reach(s, s.refs.main), all = reach(s, s.refs.feat);
    return Object.keys(all).filter(function (k) { return !onMain[k]; })
      .map(function (k) { return s.commits[k]; })
      .sort(function (x, y) { return x.t - y.t; });
  }
  var seq = 0;
  function fresh(prefix) { seq += 1; return prefix + seq; }

  // Each operation: can(state) and run(state) → { state, says }.
  var ops = {
    squash: {
      label: 'Squash fixup',
      can: function (s) { return ahead(s).some(function (c) { return /^fixup! /.test(c.msg); }); },
      run: function (s) {
        var n = clone(s), list = ahead(s), fix = list.filter(function (c) { return /^fixup! /.test(c.msg); })[0];
        var target = n.commits[fix.parents[0]];
        var merged = { id: fresh('q'), msg: target.msg, lane: target.lane, parents: target.parents, t: target.t };
        n.commits[merged.id] = merged;
        n.refs.feat = merged.id;
        return { state: n, says: 'Folded “' + fix.msg + '” into the commit it names. One clean commit, new SHA.' };
      }
    },
    rebase: {
      label: 'Rebase onto main',
      can: function (s) {
        var list = ahead(s);
        return list.length > 0 && list[0].parents[0] !== s.refs.main;
      },
      run: function (s) {
        var n = clone(s), base = n.refs.main, list = ahead(s);
        list.forEach(function (c) {
          var copy = { id: fresh('r'), msg: c.msg, lane: 1, parents: [base], t: ++clock };
          n.commits[copy.id] = copy;
          base = copy.id;
        });
        n.refs.feat = base;
        return { state: n, says: 'Replayed ' + list.length + ' commit' + (list.length > 1 ? 's' : '') + ' of feature/login on top of main. Same changes, new SHAs.' };
      }
    },
    merge: {
      label: 'Merge',
      can: function (s) { return ahead(s).length > 0; },
      run: function (s) {
        var n = clone(s), m = { id: fresh('m'), msg: 'Merge feature/login', lane: 0, parents: [s.refs.main, s.refs.feat], t: ++clock };
        n.commits[m.id] = m;
        n.refs.main = m.id;
        return { state: n, says: 'Merged feature/login into main with a merge commit.' };
      }
    },
    reset: {
      label: 'Hard reset',
      can: function (s) { return s.commits[s.refs.main].parents.length > 0; },
      run: function (s) {
        var n = clone(s), head = s.commits[s.refs.main];
        n.refs.main = head.parents[0];
        var gone = !reach(n, n.refs.feat)[head.id];
        return { state: n, says: 'Hard reset: main moved back one commit.' + (gone ? ' “' + head.msg + '” is on no branch now; Undo brings it back.' : '') };
      }
    }
  };
  var order = ['squash', 'rebase', 'merge', 'reset'];

  // History: past states with the op that made each, and a redo stack.
  var state = initial();
  var done = [], undone = [];

  // ---- DOM --------------------------------------------------------------
  var graph = root.querySelector('.win-graph');
  var tools = root.querySelector('.win-tools');
  var foot = root.querySelector('.win-foot');
  var journal = root.querySelector('.journal');
  var status = root.querySelector('.play-status');
  var undoBtn = root.querySelector('[data-act="undo"]');
  var redoBtn = root.querySelector('[data-act="redo"]');
  var tourBtn = root.querySelector('.tour-toggle');

  graph.textContent = '';
  graph.classList.add('live');
  graph.style.setProperty('--gutter', GUTTER + 'px');
  graph.style.height = (ROWS * ROW + 12) + 'px';
  var svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'g-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', GUTTER);
  svg.setAttribute('height', ROWS * ROW + 12);
  var edgeLayer = document.createElementNS(SVGNS, 'g');
  var nodeLayer = document.createElementNS(SVGNS, 'g');
  svg.appendChild(edgeLayer);
  svg.appendChild(nodeLayer);
  var list = document.createElement('ol');
  list.className = 'g-rows';
  list.setAttribute('aria-label', 'Commits, newest first');
  graph.appendChild(svg);
  graph.appendChild(list);

  var cssD = window.CSS && CSS.supports && CSS.supports('d', 'path("M0 0")');
  var nodes = {}, edges = {}, rows = {}, rendered = false;

  function sha(id) {
    var h = 2166136261;
    for (var i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('0000000' + (h >>> 0).toString(16)).slice(-7);
  }
  function lx(lane) { return X0 + lane * LANE; }
  function ry(i) { return 6 + i * ROW + ROW / 2; }
  function edgePath(c, p, ic, ip) {
    var x1 = lx(c.lane), x2 = lx(p.lane), y1 = ry(ic), y2 = ry(ip), h = ROW / 2;
    if (x1 === x2) return 'M' + x1 + ' ' + y1 + 'V' + y2;
    if (c.lane > p.lane) {
      // Branching off: run down the branch's own lane, curve in at the parent.
      return 'M' + x1 + ' ' + y1 + 'V' + (y2 - ROW) + 'C' + x1 + ' ' + (y2 - h) + ' ' + x2 + ' ' + (y2 - h) + ' ' + x2 + ' ' + y2;
    }
    // Merging: curve out of the merge commit, then down the branch's lane.
    return 'M' + x1 + ' ' + y1 + 'C' + x1 + ' ' + (y1 + h) + ' ' + x2 + ' ' + (y1 + h) + ' ' + x2 + ' ' + (y1 + ROW) + 'V' + y2;
  }
  function setD(el, d) {
    el.setAttribute('d', d);
    if (cssD) el.style.d = 'path("' + d + '")';
  }
  function leave(el, map, key) {
    delete map[key];
    el.classList.add('out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
  }

  function render(changed) {
    // Nothing animates in on the first paint.
    var animate = rendered;
    rendered = true;
    var vis = visible(state), index = {};
    vis.forEach(function (c, i) { index[c.id] = i; });

    // Edges
    var want = {};
    vis.forEach(function (c) {
      c.parents.forEach(function (pid) {
        if (index[pid] === undefined) return;
        var key = c.id + '>' + pid, d = edgePath(c, state.commits[pid], index[c.id], index[pid]);
        want[key] = true;
        var el = edges[key];
        if (!el) {
          el = document.createElementNS(SVGNS, 'path');
          el.setAttribute('pathLength', '1');
          el.setAttribute('class', 'g-edge lane-' + (Math.max(c.lane, state.commits[pid].lane)));
          setD(el, d);
          if (animate) el.classList.add('enter');
          edgeLayer.appendChild(el);
          edges[key] = el;
        } else {
          setD(el, d);
        }
      });
    });
    Object.keys(edges).forEach(function (k) { if (!want[k]) leave(edges[k], edges, k); });

    // Nodes and rows
    var seen = {};
    vis.forEach(function (c, i) {
      seen[c.id] = true;
      var pos = 'translate(' + lx(c.lane) + 'px,' + ry(i) + 'px)';
      var n = nodes[c.id];
      if (!n) {
        n = document.createElementNS(SVGNS, 'g');
        n.setAttribute('class', 'g-node lane-' + c.lane + (c.parents.length > 1 ? ' g-merge' : '') + (animate ? ' enter' : ''));
        var dot = document.createElementNS(SVGNS, 'circle');
        dot.setAttribute('r', c.parents.length > 1 ? 7.5 : 6);
        n.appendChild(dot);
        if (c.parents.length > 1) {
          var hole = document.createElementNS(SVGNS, 'circle');
          hole.setAttribute('r', 2.6);
          hole.setAttribute('class', 'g-hole');
          n.appendChild(hole);
        }
        n.style.transform = pos;
        nodeLayer.appendChild(n);
        nodes[c.id] = n;
      } else {
        n.style.transform = pos;
      }

      var r = rows[c.id];
      if (!r) {
        r = document.createElement('li');
        r.className = 'g-row' + (animate ? ' enter' : '') + (changed ? ' new' : '');
        r.innerHTML = '<code class="g-sha"></code><span class="g-msg"></span><span class="g-refs"></span>';
        r.querySelector('.g-sha').textContent = sha(c.id);
        r.querySelector('.g-msg').textContent = c.msg;
        if (/^fixup! /.test(c.msg)) r.classList.add('fixup');
        r.style.transform = 'translateY(' + (6 + i * ROW) + 'px)';
        list.appendChild(r);
        rows[c.id] = r;
        if (changed) setTimeout(function () { r.classList.remove('new'); }, 1600);
      } else {
        r.style.transform = 'translateY(' + (6 + i * ROW) + 'px)';
      }
      var refs = r.querySelector('.g-refs'), html = '';
      if (state.refs.main === c.id) html += '<span class="pill lane-0">main</span>';
      if (state.refs.feat === c.id) html += '<span class="pill lane-1">feature/login</span>';
      if (refs.innerHTML !== html) refs.innerHTML = html;
    });
    Object.keys(nodes).forEach(function (k) { if (!seen[k]) leave(nodes[k], nodes, k); });
    Object.keys(rows).forEach(function (k) { if (!seen[k]) leave(rows[k], rows, k); });

    // Controls
    tools.querySelectorAll('[data-op]').forEach(function (b) {
      b.disabled = !ops[b.getAttribute('data-op')].can(state);
    });
    undoBtn.disabled = !done.length;
    redoBtn.disabled = !undone.length;

    // Journal: newest first; undone entries stay listed, struck through,
    // until something new replaces them.
    journal.textContent = '';
    var items = done.map(function (d) { return { label: d.label, live: true }; })
      .concat(undone.slice().reverse().map(function (d) { return { label: d.label, live: false }; }));
    if (!items.length) {
      var empty = document.createElement('li');
      empty.className = 'j-empty';
      empty.textContent = 'Nothing yet';
      journal.appendChild(empty);
    }
    items.reverse().slice(0, 4).forEach(function (it) {
      var li = document.createElement('li');
      li.textContent = it.label;
      if (!it.live) li.className = 'j-undone';
      journal.appendChild(li);
    });
  }

  function apply(name) {
    var op = ops[name];
    if (!op.can(state)) return;
    var out = op.run(state);
    done.push({ label: op.label, before: state, after: out.state, says: out.says });
    undone = [];
    state = out.state;
    status.textContent = out.says;
    render(true);
  }
  function undo() {
    var d = done.pop();
    if (!d) return;
    undone.push(d);
    state = d.before;
    status.textContent = 'Undid “' + d.label + '”. Everything is back where it was.';
    render(false);
  }
  function redo() {
    var d = undone.pop();
    if (!d) return;
    done.push(d);
    state = d.after;
    status.textContent = 'Redid “' + d.label + '”. ' + d.says;
    render(false);
  }

  // ---- Tour -------------------------------------------------------------
  var script = ['squash', 'rebase', 'merge', 'undo', 'undo', 'undo'];
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var step = 0, timer = null, inView = false, touring = !reduce.matches, tookOver = false;

  function tick() {
    var act = script[step % script.length];
    if (act === 'undo') undo(); else apply(act);
    step += 1;
    // Pause a little longer at the end of a loop, then start over.
    timer = setTimeout(tick, step % script.length === 0 ? 3600 : 2400);
  }
  function syncTour() {
    clearTimeout(timer);
    timer = null;
    if (touring && inView) timer = setTimeout(tick, 1400);
    tourBtn.textContent = touring ? 'Pause tour' : 'Play tour';
    root.classList.toggle('touring', touring);
    // Don't narrate the tour to screen readers, only the visitor's own steps.
    status.setAttribute('aria-live', touring ? 'off' : 'polite');
  }
  function takeOver() {
    tookOver = true;
    if (!touring) return;
    touring = false;
    syncTour();
  }
  tourBtn.addEventListener('click', function () {
    touring = !touring;
    if (touring && tookOver) {
      // The visitor changed the graph; start the script over so its undos
      // only ever take back the tour's own steps.
      state = initial(); done = []; undone = []; step = 0; tookOver = false;
      status.textContent = '';
      render(false);
    }
    syncTour();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      syncTour();
    }, { threshold: 0.4 }).observe(root);
  }

  tools.addEventListener('click', function (e) {
    var b = e.target.closest('[data-op]');
    if (!b) return;
    takeOver();
    apply(b.getAttribute('data-op'));
    keepFocus(b);
  });
  undoBtn.addEventListener('click', function () { takeOver(); undo(); keepFocus(undoBtn); });
  redoBtn.addEventListener('click', function () { takeOver(); redo(); keepFocus(redoBtn); });
  // A pressed button often turns disabled; hand focus to Undo (or Redo) so it
  // doesn't fall back to the page.
  function keepFocus(b) {
    if (!b.disabled) return;
    var next = !undoBtn.disabled ? undoBtn : !redoBtn.disabled ? redoBtn : null;
    if (next) next.focus();
  }

  order.forEach(function (name) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool';
    b.setAttribute('data-op', name);
    b.textContent = ops[name].label;
    tools.appendChild(b);
  });

  tools.hidden = false;
  foot.hidden = false;
  tourBtn.hidden = false;
  render(false);
  syncTour();
})();
