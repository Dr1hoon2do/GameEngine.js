class Camera extends Component {
  static main = null;

  constructor(zoom = 1) {
    super();
    // 설정
    this.zoom = zoom;
    this.depth = 0;
    this.pixelPerfect = true;
    this.cullingMargin = 0;

    // 캐시
    this._view = new Matrix();
    this._inverse = new Matrix();
    this._bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    this._pixelRatio = 1;
    this._width = 0;
    this._height = 0;
  }

  // Camera.main 자동 관리
  onEnable() {
    if (!Camera.main) Camera.main = this;
  }

  onDisable() {
    if (Camera.main === this) Camera.main = null;
  }

  onDestroy() {
    if (Camera.main === this) Camera.main = null;
  }

  // getter
  get viewMatrix() { return this._view; }
  get inverseViewMatrix() { return this._inverse; }
  get worldBounds() { return this._bounds; }
  get viewWidth() { return this.zoom === 0 ? 0 : this._width / this.zoom; }
  get viewHeight() { return this.zoom === 0 ? 0 : this._height / this.zoom; }

  setViewHeight(worldUnits) {
    if (worldUnits > 0 && this._height > 0) {
      const z = this._height / worldUnits;
      this.zoom = this.pixelPerfect ? Math.max(1, Math.floor(z)) : z;
    }
    return this;
  }

  // 매 프레임 RenderPipeline이 호출. Y축을 여기서 뒤집는다.
  updateMatrices(width, height, pixelRatio = 1) {
    this._width = width;
    this._height = height;
    this._pixelRatio = pixelRatio;

    const inv = this.transform.inverseWorldMatrix;
    const z = this.zoom;
    const m = this._view;

    m.a = z * inv.a;
    m.b = -z * inv.b;
    m.c = z * inv.c;
    m.d = -z * inv.d;
    m.e = z * inv.e + width / 2;
    m.f = -z * inv.f + height / 2;

    if (this.pixelPerfect) {
      m.e = Math.round(m.e);
      m.f = Math.round(m.f);
    }

    if (!Matrix.invert(m, this._inverse)) Matrix.setIdentity(this._inverse);
    this._updateBounds(width, height);
    return m;
  }

  // 좌표 변환
  screenToWorld(x, y) {
    const inv = this._inverse;
    const px = x * this._pixelRatio;
    const py = y * this._pixelRatio;
    return new Vector(
      inv.a * px + inv.c * py + inv.e,
      inv.b * px + inv.d * py + inv.f
    );
  }

  worldToScreen(worldPoint) {
    const m = this._view;
    const r = this._pixelRatio;
    return new Vector(
      (m.a * worldPoint.x + m.c * worldPoint.y + m.e) / r,
      (m.b * worldPoint.x + m.d * worldPoint.y + m.f) / r
    );
  }

  // 컬링
  isInView(minX, minY, maxX, maxY) {
    const b = this._bounds;
    return !(maxX < b.minX || minX > b.maxX || maxY < b.minY || minY > b.maxY);
  }

  _updateBounds(width, height) {
    const inv = this._inverse;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const xs = [0, width, 0, width];
    const ys = [0, 0, height, height];

    for (let i = 0; i < 4; i++) {
      const wx = inv.a * xs[i] + inv.c * ys[i] + inv.e;
      const wy = inv.b * xs[i] + inv.d * ys[i] + inv.f;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy;
      if (wy > maxY) maxY = wy;
    }

    const b = this._bounds;
    b.minX = minX - this.cullingMargin;
    b.minY = minY - this.cullingMargin;
    b.maxX = maxX + this.cullingMargin;
    b.maxY = maxY + this.cullingMargin;
  }
}