class Engine {
  constructor(options = {}) {
    // 캔버스/렌더 설정
    const target = options.canvas;
    this.canvas = typeof target === 'string' ? document.querySelector(target) : target;
    this.ctx = this.canvas.getContext('2d', { alpha: options.alpha ?? false });
    this.clearColor = options.clearColor ?? '#AAAAFF';
    this.pixelRatio = options.pixelRatio ?? 1;
    this.imageSmoothing = options.imageSmoothing ?? false;
    this.pauseOnBlur = options.pauseOnBlur ?? true;

    // 확장 지점 (Input, RenderPipeline은 나중에 붙음)
    this.renderer = null;
    this.systems = [];

    // 루트 GameObject 관리
    this._roots = [];

    // 루프 상태
    this._running = false;
    this._rafId = 0;

    this._frame = this._frame.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
    this._onResize = this._onResize.bind(this);

    this._installListeners();
    this.resize();
  }

  // public getter
  get width() { return this.canvas.width / this.pixelRatio; }
  get height() { return this.canvas.height / this.pixelRatio; }
  get isRunning() { return this._running; }
  get roots() { return this._roots; }

  // 시스템 관리 (Input 등)
  addSystem(system) {
    if (!this.systems.includes(system)) this.systems.push(system);
    if (typeof system.attach === 'function') system.attach(this);
    return system;
  }

  removeSystem(system) {
    const i = this.systems.indexOf(system);
    if (i >= 0) this.systems.splice(i, 1);
    if (typeof system.detach === 'function') system.detach(this);
    return this;
  }

  // 루트 GameObject 관리
  create(name) {
    return this.add(new GameObject(name));
  }

  add(gameObject) {
    if (gameObject.transform.parent) return gameObject;
    if (!this._roots.includes(gameObject)) this._roots.push(gameObject);
    return gameObject;
  }

  remove(gameObject) {
    const i = this._roots.indexOf(gameObject);
    if (i >= 0) this._roots.splice(i, 1);
    return gameObject;
  }

  // 시작/정지
  start() {
    if (this._running) return this;
    this._running = true;
    Time.resync();
    this._rafId = requestAnimationFrame(this._frame);
    return this;
  }

  stop() {
    if (!this._running) return this;
    this._running = false;
    cancelAnimationFrame(this._rafId);
    this._rafId = 0;
    return this;
  }

  // 리사이즈
  resize() {
    const rect = this.canvas.getBoundingClientRect
      ? this.canvas.getBoundingClientRect()
      : { width: this.canvas.width, height: this.canvas.height };
    const w = Math.max(1, Math.round((rect.width || this.canvas.width) * this.pixelRatio));
    const h = Math.max(1, Math.round((rect.height || this.canvas.height) * this.pixelRatio));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx.imageSmoothingEnabled = this.imageSmoothing;
    return this;
  }

  // 내부: 프레임 루프
  _frame(timestamp) {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._frame);

    Time.update(timestamp);

    for (const system of this.systems) {
      if (typeof system.update === 'function') system.update();
    }

    const dt = Time.deltaTime;

    for (const root of [...this._roots]) root._awakePass();
    for (const root of [...this._roots]) root._startPass();
    for (const root of [...this._roots]) root._updatePass(dt);
    for (const root of [...this._roots]) root._lateUpdatePass(dt);

    this._clear();
    if (this.renderer) this.renderer.render(this.ctx, this);

    this._flushDestroyed();

    for (const system of this.systems) {
      if (typeof system.lateUpdate === 'function') system.lateUpdate();
    }
  }

  _clear() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.clearColor === null) {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      ctx.fillStyle = this.clearColor;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  // 파괴 스윕: destroy()로 표시만 된 루트/자손을 찾아서 실제 정리
  _flushDestroyed() {
    for (let i = this._roots.length - 1; i >= 0; i--) {
      const root = this._roots[i];
      if (root._destroyed) {
        root._destroyImmediate();
        this._roots.splice(i, 1);
      } else {
        this._sweepDestroyed(root);
      }
    }
  }

  _sweepDestroyed(gameObject) {
    if (gameObject._destroyed) {
      gameObject._destroyImmediate();
      return;
    }
    for (const child of [...gameObject.transform.children]) {
      this._sweepDestroyed(child.gameObject);
    }
  }

  // 내부: 탭 전환/리사이즈 리스너
  _onVisibility() {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      if (this.pauseOnBlur) this.stop();
    } else {
      Time.resync();
      if (this.pauseOnBlur && !this._running) this.start();
    }
  }

  _onResize() {
    this.resize();
  }

  _installListeners() {
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', this._onVisibility);
    }
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(this.canvas);
    } else if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', this._onResize);
    }
  }
}