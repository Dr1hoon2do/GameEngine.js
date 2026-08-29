class Transform extends Component {
  constructor() {
    super();
    this._awoken = true;
    this._started = true;

    // local 값
    this._localPosition = new Vector(0, 0);
    this._localRotation = 0;
    this._localScale = new Vector(1, 1);

    // 계층
    this.parent = null;
    this.children = [];

    // 행렬 캐시
    this._local = new Matrix();
    this._world = new Matrix();
    this._inverse = new Matrix();
    this._localDirty = true;
    this._worldDirty = true;
    this._inverseDirty = true;
  }

  // local getter/setter
  get localPosition() { return this._localPosition.clone(); }
  set localPosition(v) { this._localPosition = new Vector(v.x, v.y); this._markDirty(); }

  get localRotation() { return this._localRotation; }
  set localRotation(radians) { this._localRotation = radians; this._markDirty(); }

  get localScale() { return this._localScale.clone(); }
  set localScale(v) { this._localScale = new Vector(v.x, v.y); this._markDirty(); }

  setLocalPosition(x, y) {
    this._localPosition.x = x;
    this._localPosition.y = y;
    this._markDirty();
    return this;
  }

  setLocalScale(x, y = x) {
    this._localScale.x = x;
    this._localScale.y = y;
    this._markDirty();
    return this;
  }

  // world getter/setter
  get position() {
    const m = this.worldMatrix;
    return new Vector(m.e, m.f);
  }

  set position(v) {
    if (!this.parent) {
      this.setLocalPosition(v.x, v.y);
      return;
    }
    const local = this.parent.inverseWorldMatrix.transformPoint(v);
    this.setLocalPosition(local.x, local.y);
  }

  setPosition(x, y) {
    if (!this.parent) return this.setLocalPosition(x, y);
    const local = this.parent.inverseWorldMatrix.transformPoint(new Vector(x, y));
    return this.setLocalPosition(local.x, local.y);
  }

  get rotation() {
    return this.worldMatrix.getRotation();
  }

  set rotation(radians) {
    this.localRotation = this.parent ? radians - this.parent.rotation : radians;
  }

  get scale() {
    return this.worldMatrix.getScale();
  }

  set scale(v) {
    if (!this.parent) {
      this.setLocalScale(v.x, v.y);
      return;
    }
    const p = this.parent.scale;
    this.setLocalScale(p.x === 0 ? 0 : v.x / p.x, p.y === 0 ? 0 : v.y / p.y);
  }

  // 행렬 (dirty 캐시)
  get localMatrix() {
    if (this._localDirty) {
      Matrix.composeInto(this._localPosition, this._localRotation, this._localScale, this._local);
      this._localDirty = false;
    }
    return this._local;
  }

  get worldMatrix() {
    if (this._worldDirty) {
      if (this.parent) {
        Matrix.multiply(this.parent.worldMatrix, this.localMatrix, this._world);
      } else {
        Matrix.copy(this.localMatrix, this._world);
      }
      this._worldDirty = false;
    }
    return this._world;
  }

  get inverseWorldMatrix() {
    if (this._inverseDirty) {
      if (!Matrix.invert(this.worldMatrix, this._inverse)) Matrix.setIdentity(this._inverse);
      this._inverseDirty = false;
    }
    return this._inverse;
  }

  // 이동/회전 헬퍼
  translate(v) {
    return this.setLocalPosition(this._localPosition.x + v.x, this._localPosition.y + v.y);
  }

  rotate(radians) {
    this.localRotation = this._localRotation + radians;
    return this;
  }

  // 좌표 변환
  transformPoint(v) {
    return this.worldMatrix.transformPoint(v);
  }

  transformDirection(v) {
    return this.worldMatrix.transformVector(v);
  }

  inverseTransformPoint(v) {
    return this.inverseWorldMatrix.transformPoint(v);
  }

  inverseTransformDirection(v) {
    return this.inverseWorldMatrix.transformVector(v);
  }

  // 계층
  setParent(parent, worldPositionStays = true) {
    if (parent === this.parent) return this;

    const world = worldPositionStays ? this.worldMatrix.clone() : null;

    if (this.parent) {
      const i = this.parent.children.indexOf(this);
      if (i >= 0) this.parent.children.splice(i, 1);
    }

    this.parent = parent;
    if (parent) parent.children.push(this);

    if (world) {
      const target = parent ? Matrix.multiply(parent.inverseWorldMatrix, world, new Matrix()) : world;
      const d = target.decompose();
      this._localPosition = d.position;
      this._localRotation = d.rotation;
      this._localScale = d.scale;
    }

    this._markDirty();
    return this;
  }

  find(name) {
    for (const c of this.children) {
      if (c.gameObject && c.gameObject.name === name) return c;
    }
    for (const c of this.children) {
      const found = c.find(name);
      if (found) return found;
    }
    return null;
  }

  // internal
  _markDirty() {
    this._localDirty = true;
    this._markWorldDirty();
  }

  _markWorldDirty() {
    if (this._worldDirty) return;
    this._worldDirty = true;
    this._inverseDirty = true;
    for (const c of this.children) c._markWorldDirty();
  }
}