class GameObject {
  constructor(name = 'GameObject') {
    // identity
    this._name = name;
    this._tags = [];
    this._transform = new Transform();
    this._transform._gameObject = this;
    this._components = [this._transform];

    // active state
    this._active = true;

    // lifecycle
    this._awoken = false;
    this._started = false;
    this._destroyed = false;
  }

  // identity getter/setter
  get name() { return this._name; }
  set name(v) { this._name = v; }
  get tags() { return this._tags; }
  get transform() { return this._transform; }
  get components() { return this._components; }

  // active state
  get isActive() { return this._active; }
  get isDestroyed() { return this._destroyed; }

  get activeInHierarchy() {
    if (!this._active || this._destroyed) return false;
    const parent = this.transform.parent;
    return parent ? parent.gameObject.activeInHierarchy : true;
  }

  setActive(value) {
    if (this._active === value) return this;
    const before = this.activeInHierarchy;
    this._active = value;
    if (before !== this.activeInHierarchy) this._refreshHierarchy();
    return this;
  }

  // component management
  addComponent(Type, ...args) {
    const component = new Type(...args);
    component._gameObject = this;
    this._components.push(component);

    if (this._awoken && !this._destroyed) {
      component._awoken = true;
      component.awake();
      if (this.activeInHierarchy && component.enabled) {
        component._enabledCalled = true;
        component.onEnable();
      }
    }
    return component;
  }

  getComponent(Type) {
    return this.components.find((c) => c instanceof Type) ?? null;
  }

  getComponents(Type) {
    return this.components.filter((c) => c instanceof Type);
  }

  removeComponent(component) {
    const i = this._components.indexOf(component);
    if (i < 0) return false;

    this._components.splice(i, 1);
    if (component._enabledCalled) component.onDisable();
    if (component._awoken) component.onDestroy();
    component._gameObject = null;
    return true;
  }

  // hierarchy
  get parent() {
    const p = this.transform.parent;
    return p ? p.gameObject : null;
  }

  addChild(gameObject) {
    gameObject.transform.setParent(this.transform);
    return gameObject;
  }

  find(name) {
    const t = this.transform.find(name);
    return t ? t.gameObject : null;
  }

  // destroy
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    for (const child of [...this.transform.children]) child.gameObject.destroy();
  }

  _destroyImmediate() {
    for (const child of [...this.transform.children]) child.gameObject._destroyImmediate();

    for (const c of [...this._components]) {
      if (c._enabledCalled) c.onDisable();
    }
    for (const c of [...this._components]) {
      if (c._awoken) c.onDestroy();
    }

    if (this.transform.parent) {
      const i = this.transform.parent.children.indexOf(this.transform);
      if (i >= 0) this.transform.parent.children.splice(i, 1);
    }
    this.transform.parent = null;

    this._components.length = 0;
  }

  // internal: onEnable/onDisable 재계산
  _refreshComponents() {
    const active = this.activeInHierarchy;
    for (const c of [...this._components]) {
      const should = active && c.enabled && c._awoken;
      if (should && !c._enabledCalled) {
        c._enabledCalled = true;
        c.onEnable();
      } else if (!should && c._enabledCalled) {
        c._enabledCalled = false;
        c.onDisable();
      }
    }
  }

  _refreshHierarchy() {
    this._refreshComponents();
    for (const child of [...this.transform.children]) child.gameObject._refreshHierarchy();
  }

  // lifecycle pass
  _awakePass() {
    if (this._destroyed) return;
    this._awoken = true;
    for (const c of [...this._components]) {
      if (!c._awoken) {
        c._awoken = true;
        c.awake();
      }
    }
    this._refreshComponents();
    for (const child of [...this.transform.children]) child.gameObject._awakePass();
  }

  _startPass() {
    if (this._destroyed) return;
    for (const c of [...this._components]) {
      if (!c._started && c._enabledCalled) {
        c._started = true;
        c.start();
      }
    }
    for (const child of [...this.transform.children]) child.gameObject._startPass();
  }

  _updatePass(deltaTime) {
    if (this._destroyed || !this._active) return;
    for (const c of [...this._components]) {
      if (c._started && c.enabled) c.update(deltaTime);
    }
    for (const child of [...this.transform.children]) child.gameObject._updatePass(deltaTime);
  }

  _lateUpdatePass(deltaTime) {
    if (this._destroyed || !this._active) return;
    for (const c of [...this._components]) {
      if (c._started && c.enabled) c.lateUpdate(deltaTime);
    }
    for (const child of [...this.transform.children]) child.gameObject._lateUpdatePass(deltaTime);
  }
}