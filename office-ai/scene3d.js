/* Mô hình văn phòng hỗ trợ IT bằng Three.js.
 *
 * index.html gọi createScene3D({host, teams, agents, colors, onPick}) rồi dùng bộ điều khiển trả về:
 *   resetView() / zoom(k) / toggleBig()
 * Trạng thái agent (idle | work | done | err) được đọc trực tiếp từ agents[i].st ở mỗi khung hình.
 *
 * Three.js được nạp theo thứ tự: vendor/three.module.js (chạy offline) -> jsDelivr -> unpkg.
 * Nếu không nạp được hoặc máy không có WebGL, createScene3D ném lỗi và index.html dùng cảnh 2D dự phòng.
 */
const THREE_URLS = [
  '/vendor/three.module.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
  'https://unpkg.com/three@0.160.0/build/three.module.js',
];

async function loadThree() {
  let last;
  for (const u of THREE_URLS) {
    try {
      const m = await import(u);
      if (m && m.WebGLRenderer) return m;
    } catch (e) { last = e; }
  }
  throw last || new Error('Không tải được Three.js');
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const STATE_TEXT = { idle: 'Đang chờ', work: 'Đang xử lý', done: 'Hoàn thành', err: 'Gặp lỗi' };

export async function createScene3D(opts) {
  const T = opts.three || await loadThree();
  const { host, teams, agents } = opts;
  const colors = opts.colors || {};

  /* ---------- renderer, scene, camera ---------- */
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 2), 2.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0xf2f4f6, 1);
  const cvs = renderer.domElement;
  cvs.style.touchAction = 'none';
  cvs.style.cursor = 'grab';
  host.insertBefore(cvs, host.firstChild);

  const scene = new T.Scene();
  scene.background = new T.Color(0xf2f4f6);
  scene.fog = new T.Fog(0xf2f4f6, 38, 78);
  const FOV = 40;
  const camera = new T.PerspectiveCamera(FOV, 1, 0.1, 120);

  scene.add(new T.AmbientLight(0xffffff, 0.85));
  scene.add(new T.HemisphereLight(0xffffff, 0x9aa6b2, 1.0));
  const sun = new T.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-5, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -18;
  sun.shadow.camera.right = sun.shadow.camera.top = 18;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  /* ---------- tiện ích vật liệu và chữ ---------- */
  const std = (color, o = {}) => new T.MeshStandardMaterial({ color, metalness: 0.12, roughness: 0.72, ...o });
  const basic = (color, o = {}) => new T.MeshBasicMaterial({ color, ...o });
  const box = (parent, size, pos, material, cast = true) => {
    const m = new T.Mesh(new T.BoxGeometry(...size), material);
    m.position.set(...pos); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  };

  function makeLabel(text, css, px, worldH) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    const font = `600 ${px}px "Segoe UI", system-ui, sans-serif`;
    g.font = font;
    const w = Math.ceil(g.measureText(text).width + px * 1.6), h = Math.round(px * 1.9);
    c.width = w; c.height = h;  // đổi kích thước canvas làm mất font, nên đặt lại
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    const r = h / 2;
    g.beginPath(); g.moveTo(r, 1.5); g.lineTo(w - r, 1.5); g.arc(w - r, r, r - 1.5, -Math.PI / 2, Math.PI / 2);
    g.lineTo(r, h - 1.5); g.arc(r, r, r - 1.5, Math.PI / 2, Math.PI * 1.5); g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.96)'; g.fill();
    g.lineWidth = 1.5; g.strokeStyle = css; g.globalAlpha = 0.65; g.stroke(); g.globalAlpha = 1;
    g.fillStyle = '#273746'; g.fillText(text, w / 2, h / 2 + 1);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(worldH * (w / h), worldH, 1);
    return sp;
  }

  /* ---------- nền: sàn văn phòng tối, ít nhiễu ---------- */
  const floor = new T.Mesh(new T.CircleGeometry(13.5, 96), std(0xdce2e7, { roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.18; floor.receiveShadow = true; scene.add(floor);
  const floorEdge = new T.Mesh(new T.TorusGeometry(13.25, 0.075, 8, 120), std(0xb8c2cb, { metalness: 0.1, roughness: 0.75 }));
  floorEdge.rotation.x = Math.PI / 2; floorEdge.position.y = -0.1; scene.add(floorEdge);
  const grid = new T.GridHelper(26, 13, 0xc5cdd4, 0xd0d6dc);
  grid.material.transparent = true; grid.material.opacity = 0.18; grid.position.y = -0.16;
  scene.add(grid);

  /* ---------- bàn họp điều phối ---------- */
  const HUBC = 0x557a95;
  const hub = new T.Group(); scene.add(hub);
  const pedestal = new T.Mesh(new T.CylinderGeometry(1.15, 1.28, 0.42, 48), std(0x9aa5ae, { metalness: 0.08, roughness: 0.75 }));
  pedestal.position.y = 0.21; pedestal.castShadow = true; hub.add(pedestal);
  const tableTop = new T.Mesh(new T.CylinderGeometry(1.42, 1.42, 0.14, 64), std(0x9a795b, { roughness: 0.62 }));
  tableTop.position.y = 0.5; tableTop.castShadow = true; hub.add(tableTop);
  box(hub, [0.92, 0.52, 0.075], [0, 0.88, 0.35], std(0x526273, { roughness: 0.62 }));
  const meetingScreen = new T.Mesh(new T.PlaneGeometry(0.78, 0.38), basic(0x36566d));
  meetingScreen.position.set(0, 0.89, 0.392); hub.add(meetingScreen);
  box(hub, [0.36, 0.025, 0.02], [0, 0.76, 0.4], basic(0xd6e0e7), false);
  const hubLabel = makeLabel('ĐIỀU PHỐI', '#557a95', 30, 0.8);
  hubLabel.position.set(0, 2.05, 0); hub.add(hubLabel);

  /* ---------- các phòng và agent ---------- */
  const D = 5.4, W = 4.3;           // khoảng cách phòng tới tâm, cạnh bệ phòng
  const roomList = [], agentObjs = {}, hitMeshes = [];

  teams.forEach((team, ti) => {
    const css = colors[team.id] || '#38bdf8', col = new T.Color(css);
    const ang = Math.PI + ti * (Math.PI * 2 / teams.length);
    const cx = D * Math.cos(ang), cz = D * Math.sin(ang);
    const g = new T.Group(); g.position.set(cx, 0, cz); g.rotation.y = Math.atan2(cx, cz);  // mặt trước hướng về tâm
    scene.add(g);

    const slab = new T.Mesh(new T.BoxGeometry(W, 0.28, W), std(0xc5cdd4, { roughness: 0.9 }));
    slab.position.y = 0.14; slab.receiveShadow = true; g.add(slab);
    const top = new T.Mesh(new T.PlaneGeometry(W - 0.18, W - 0.18), basic(0xffffff, { transparent: true, opacity: 0.28, depthWrite: false }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.305; g.add(top);
    const edges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(W, 0.28, W)), new T.LineBasicMaterial({ color: 0xaeb9c2, transparent: true, opacity: 0.65 }));
    edges.position.y = 0.14; g.add(edges);
    box(g, [W - 0.18, 0.045, 0.09], [0, 0.33, -W / 2 + 0.12], std(0xa6b2bd, { roughness: 0.75 }), false);

    const barW = W - 0.9, barZ = -W / 2 + 0.32;     // thanh tiến độ ở mép trước
    const track = new T.Mesh(new T.BoxGeometry(barW, 0.05, 0.12), basic(0xd3dbe1));
    track.position.set(0, 0.33, barZ); g.add(track);
    const fillGeo = new T.BoxGeometry(1, 0.07, 0.14); fillGeo.translate(0.5, 0, 0);
    const fill = new T.Mesh(fillGeo, std(col, { roughness: 0.65 }));
    fill.position.set(-barW / 2, 0.34, barZ); fill.scale.x = 0.001; g.add(fill);

    const label = makeLabel(team.name, css, 34, 0.96);
    label.position.set(0, 2.75, 0.15); g.add(label);

    const room = { team, fill, barW, frac: 0, tgt: 0 };
    roomList.push(room);

    const list = agents.filter(a => a.team === team.id), n = list.length;
    const slots = n === 3 ? [[0, -1.15], [-1.2, 0.85], [1.2, 0.85]] : list.map((_, k) => [(k - (n - 1) / 2) * 1.4, 0.2]);
    list.forEach((a, k) => {
      const h = new T.Group(); h.position.set(slots[k][0], 0.3, slots[k][1]); g.add(h);
      // Bàn làm việc, màn hình và ghế xoay. Trạng thái hiển thị trên màn hình.
      const wood = std(0x9a795b, { roughness: 0.62 }), frame = std(0x667584, { metalness: 0.08, roughness: 0.68 });
      box(h, [1.16, 0.09, 0.68], [0, 0.67, 0.12], wood);
      [[-0.49, 0.35, -0.12], [0.49, 0.35, -0.12], [-0.49, 0.35, 0.36], [0.49, 0.35, 0.36]].forEach(p => box(h, [0.055, 0.62, 0.055], p, frame));
      box(h, [0.59, 0.43, 0.055], [0, 1.0, 0.33], frame);
      const screen = new T.Mesh(new T.PlaneGeometry(0.5, 0.32), basic(0x36566d));
      screen.position.set(0, 1.0, 0.361); h.add(screen);
      const statusMark = box(h, [0.22, 0.025, 0.018], [0, 0.86, 0.367], basic(0xb8c7d2), false);
      box(h, [0.34, 0.035, 0.15], [0, 0.755, 0.02], std(0x74818b, { roughness: 0.65 }));
      box(h, [0.72, 0.1, 0.64], [0, 0.49, -0.58], std(0x788694, { roughness: 0.78 }));
      box(h, [0.72, 0.56, 0.09], [0, 0.81, -0.91], std(0x87939d, { roughness: 0.78 }));
      const chairStem = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 0.38, 12), frame); chairStem.position.set(0, 0.28, -0.58); h.add(chairStem);
      const chairFoot = new T.Mesh(new T.CylinderGeometry(0.27, 0.27, 0.045, 20), frame); chairFoot.position.set(0, 0.07, -0.58); h.add(chairFoot);
      const base = new T.Mesh(new T.CylinderGeometry(0.31, 0.35, 0.045, 24), std(0xaab4bd)); base.position.y = 0.025; h.add(base);
      const baseRing = new T.Mesh(new T.TorusGeometry(0.34, 0.01, 6, 40), basic(0xa6b2bd, { transparent: true, opacity: 0.55 }));
      baseRing.rotation.x = Math.PI / 2; baseRing.position.y = 0.055; h.add(baseRing);
      const doneRing = new T.Mesh(new T.TorusGeometry(0.43, 0.015, 6, 40), basic(0x398365, { transparent: true, opacity: 0 }));
      doneRing.rotation.x = Math.PI / 2; doneRing.position.y = 0.07; doneRing.scale.setScalar(0.001); h.add(doneRing);

      const core = new T.Group(); core.position.set(0, 1.0, 0.39); h.add(core);
      const hit = new T.Mesh(new T.SphereGeometry(0.42, 12, 10), basic(0xffffff, { transparent: true, opacity: 0, depthWrite: false }));
      hit.position.copy(core.position); hit.userData.agentId = a.id; h.add(hit); hitMeshes.push(hit);

      const name = makeLabel(a.name, css, 28, 0.66);
      name.position.set(0, 1.78, 0.12); name.material.opacity = 0; h.add(name);

      agentObjs[a.id] = {
        a, screen, statusMark, doneRing, name,
        last: '',
        v: { label: 0, done: 0 },
      };
    });
  });

  /* ---------- camera: kéo để xoay, Ctrl + cuộn để thu phóng ---------- */
  const cam = { theta: 0.62, phi: 1.0, r: 22 }, goal = { ...cam }, HOME = { theta: 0.62, phi: 1.0, r: 22 };
  const LOOK = new T.Vector3(0, 0.9, 0);
  let userZoom = false, big = false;

  function homeRadius(aspect) {                    // khoảng cách vừa đủ thấy trọn cả 4 phòng
    const half = Math.tan(FOV * Math.PI / 360), need = D + W / 2 + 1.1;
    return Math.max(need / (half * aspect), (need * Math.cos(HOME.phi) + 2.2) / half) * 1.04;
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    HOME.r = clamp(homeRadius(camera.aspect), 12, 40);
    if (!userZoom) goal.r = HOME.r;
  }
  new ResizeObserver(resize).observe(host);
  resize(); cam.r = goal.r;

  function resetView() {                          // về góc nhìn ban đầu theo đường quay ngắn nhất
    const TAU = Math.PI * 2, diff = ((HOME.theta - cam.theta + Math.PI) % TAU + TAU) % TAU - Math.PI;
    goal.theta = cam.theta + diff; goal.phi = HOME.phi; goal.r = HOME.r; userZoom = false;
  }
  function zoom(k) { goal.r = clamp(goal.r * k, 9, 40); userZoom = true; }

  /* ---------- tương tác: chọn agent, chú thích khi rê chuột ---------- */
  const ray = new T.Raycaster(), mouse = new T.Vector2();
  let hover = null, drag = null;
  const tip = document.createElement('div'); tip.className = 's3-tip';
  const tipName = document.createElement('b'), tipState = document.createElement('span');
  tip.append(tipName, document.createElement('br'), tipState); host.appendChild(tip);

  function pick(e) {
    const r = cvs.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(hitMeshes, false);
    return hits.length ? hits[0].object.userData.agentId : null;
  }
  function setHover(id, e) {
    hover = id;
    cvs.style.cursor = id ? 'pointer' : (drag ? 'grabbing' : 'grab');
    if (!id) { tip.style.display = 'none'; return; }
    const ao = agentObjs[id], hr = host.getBoundingClientRect();
    tipName.textContent = ao.a.name;
    tipState.textContent = STATE_TEXT[ao.a.st] || '';
    tipState.style.color = ao.a.st === 'err' ? '#a94141' : ao.a.st === 'done' ? '#28734d' : ao.a.st === 'work' ? '#245b83' : '#687789';
    tip.style.left = (e.clientX - hr.left) + 'px'; tip.style.top = (e.clientY - hr.top) + 'px'; tip.style.display = 'block';
  }
  cvs.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    try { cvs.setPointerCapture(e.pointerId); } catch (_) { /* không sao */ }
    cvs.style.cursor = 'grabbing';
  });
  cvs.addEventListener('pointermove', e => {
    if (!drag) { setHover(pick(e), e); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    goal.theta -= dx * 0.0075; goal.phi = clamp(goal.phi - dy * 0.0055, 0.3, 1.45);
    tip.style.display = 'none';
  });
  const endDrag = e => {
    if (!drag) return;
    const click = drag.moved < 5; drag = null;
    const id = pick(e); setHover(id, e);
    if (click && id && opts.onPick) opts.onPick(id);
  };
  cvs.addEventListener('pointerup', endDrag);
  cvs.addEventListener('pointercancel', () => { drag = null; setHover(null); });
  cvs.addEventListener('pointerleave', () => { if (!drag) setHover(null); });
  cvs.addEventListener('dblclick', resetView);
  cvs.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;          // cuộn bình thường vẫn cuộn trang
    e.preventDefault(); zoom(Math.exp(e.deltaY * 0.002));
  }, { passive: false });

  /* ---------- nút điều khiển trên khung cảnh ---------- */
  const tools = document.createElement('div'); tools.className = 's3-tools';
  const btn = (txt, title, fn) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = title;
    b.addEventListener('click', e => { e.stopPropagation(); fn(b); }); tools.appendChild(b); return b;
  };
  btn('+', 'Phóng to', () => zoom(0.85));
  btn('−', 'Thu nhỏ', () => zoom(1.18));
  btn('⟲', 'Đặt lại góc nhìn', resetView);
  const bigBtn = btn('⤢', 'Mở rộng khung cảnh (Esc để thu lại)', () => toggleBig());
  function toggleBig(force) {
    big = typeof force === 'boolean' ? force : !big;
    host.classList.toggle('s3-big', big); bigBtn.classList.toggle('on', big);
    requestAnimationFrame(resize);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && big) toggleBig(false); });
  host.appendChild(tools);
  const hint = document.createElement('div'); hint.className = 's3-hint';
  hint.textContent = 'Kéo để xoay · Ctrl + cuộn để thu phóng · Bấm vào agent để xem kết quả';
  host.appendChild(hint);

  /* ---------- vòng lặp vẽ ---------- */
  const clock = new T.Clock();
  let rafId = 0;

  function tick() {
    rafId = requestAnimationFrame(tick);
    if (!host.clientWidth || !host.clientHeight) return;       // đang ở tab khác, không cần vẽ
    const dt = Math.min(0.05, clock.getDelta()), k = Math.min(1, dt * 5);
    // camera
    const f = 1 - Math.exp(-dt * 7);
    cam.theta += (goal.theta - cam.theta) * f; cam.phi += (goal.phi - cam.phi) * f; cam.r += (goal.r - cam.r) * f;
    const sp = Math.sin(cam.phi);
    camera.position.set(LOOK.x + cam.r * sp * Math.sin(cam.theta), LOOK.y + cam.r * Math.cos(cam.phi), LOOK.z + cam.r * sp * Math.cos(cam.theta));
    camera.lookAt(LOOK);

    // agent
    Object.values(agentObjs).forEach(ao => {
      const st = ao.a.st || 'idle', v = ao.v, isHover = hover === ao.a.id;
      if (st !== ao.last) {
        ao.last = st;
        const c = st === 'err' ? 0xa94141 : st === 'done' ? 0x54866a : st === 'work' ? 0x477b9c : 0x36566d;
        ao.screen.material.color.setHex(c);
        ao.statusMark.material.color.setHex(st === 'err' ? 0xa94141 : st === 'done' ? 0x54866a : st === 'work' ? 0x477b9c : 0xb8c7d2);
      }
      const labelTarget = st === 'work' || isHover ? 1 : 0;
      v.label += (labelTarget - v.label) * k;
      v.done += ((st === 'done' ? 1 : 0) - v.done) * k;
      ao.name.material.opacity = v.label;
      const dr = Math.max(0.001, v.done); ao.doneRing.scale.setScalar(dr); ao.doneRing.material.opacity = v.done * 0.9;
    });

    // tiến độ từng phòng và chấm sáng trên dải dữ liệu
    roomList.forEach(r => {
      const mine = agents.filter(a => a.team === r.team.id);
      r.tgt = mine.length ? mine.filter(a => a.st === 'done' || a.st === 'err').length / mine.length : 0;
      r.frac += (r.tgt - r.frac) * k;
      r.fill.scale.x = Math.max(0.001, r.frac * r.barW);
    });

    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(tick);

  cvs.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(rafId); });
  cvs.addEventListener('webglcontextrestored', () => { rafId = requestAnimationFrame(tick); });

  return { resetView, zoom, toggleBig, three: T };
}
