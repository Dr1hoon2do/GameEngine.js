class SpriteRenderer extends Renderer {
  constructor(sprite = null, options = {}) {
    super();
    // 스프라이트 소스
    this.sprite = sprite;
    this.region = options.region ?? null;

    // 배치
    this.pivot = options.pivot ? new Vector(options.pivot.x, options.pivot.y) : new Vector(0.5, 0.5);
    this.pixelsPerUnit = options.pixelsPerUnit ?? 1;
    this.flipX = options.flipX ?? false;
    this.flipY = options.flipY ?? false;
    this.pixelSnap = options.pixelSnap ?? true;

    if (options.sortingLayer) this.sortingLayer = options.sortingLayer;
    if (options.orderInLayer !== undefined) this.orderInLayer = options.orderInLayer;
    if (options.ySort !== undefined) this.ySort = options.ySort;
    if (options.opacity !== undefined) this.opacity = options.opacity;
  }

  setSprite(sprite, region = null) {
    this.sprite = sprite;
    this.region = region;
    return this;
  }

  setRegion(x, y, width, height) {
    this.region = { x, y, width, height };
    return this;
  }

  setPivot(x, y) {
    this.pivot.x = x;
    this.pivot.y = y;
    return this;
  }

  // 크기
  get sourceWidth() {
    if (this.region) return this.region.width;
    return this.sprite ? (this.sprite.naturalWidth || this.sprite.width || 0) : 0;
  }

  get sourceHeight() {
    if (this.region) return this.region.height;
    return this.sprite ? (this.sprite.naturalHeight || this.sprite.height || 0) : 0;
  }

  get worldWidth() { return this.sourceWidth / this.pixelsPerUnit; }
  get worldHeight() { return this.sourceHeight / this.pixelsPerUnit; }

  // 컬링용 월드 AABB
  getBounds(out) {
    if (!this.sprite) return null;
    const w = this.worldWidth;
    const h = this.worldHeight;
    const x0 = -this.pivot.x * w;
    const x1 = x0 + w;
    const y0 = -this.pivot.y * h;
    const y1 = y0 + h;

    const m = this.transform.worldMatrix;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const xs = [x0, x1, x0, x1];
    const ys = [y0, y0, y1, y1];

    for (let i = 0; i < 4; i++) {
      const wx = m.a * xs[i] + m.c * ys[i] + m.e;
      const wy = m.b * xs[i] + m.d * ys[i] + m.f;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy;
      if (wy > maxY) maxY = wy;
    }

    out.minX = minX;
    out.minY = minY;
    out.maxX = maxX;
    out.maxY = maxY;
    return out;
  }

  // 그리기
  render(ctx, camera) {
    const img = this.sprite;
    if (!img) return;

    const w = this.worldWidth;
    const h = this.worldHeight;
    if (w <= 0 || h <= 0) return;

    Matrix.multiply(camera.viewMatrix, this.transform.worldMatrix, SPRITE_MATRIX);
    if (this.pixelSnap) {
      SPRITE_MATRIX.e = Math.round(SPRITE_MATRIX.e);
      SPRITE_MATRIX.f = Math.round(SPRITE_MATRIX.f);
    }

    ctx.setTransform(SPRITE_MATRIX.a, SPRITE_MATRIX.b, SPRITE_MATRIX.c, SPRITE_MATRIX.d, SPRITE_MATRIX.e, SPRITE_MATRIX.f);
    ctx.scale(this.flipX ? -1 : 1, this.flipY ? 1 : -1);

    const dx = -this.pivot.x * w;
    const dy = -(1 - this.pivot.y) * h;

    const alpha = this.opacity;
    if (alpha < 1) ctx.globalAlpha = alpha;

    if (this.region) {
      const r = this.region;
      ctx.drawImage(img, r.x, r.y, r.width, r.height, dx, dy, w, h);
    } else {
      ctx.drawImage(img, dx, dy, w, h);
    }

    if (alpha < 1) ctx.globalAlpha = 1;
  }
}

// render()에서 매 프레임 재사용하는 스크래치 행렬 (할당 방지)
const SPRITE_MATRIX = new Matrix();