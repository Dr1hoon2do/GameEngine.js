class RenderPipeline {
  constructor(options = {}) {
    // 설정
    this.sortingLayers = options.sortingLayers ?? ['Background', 'Default', 'Foreground', 'UI'];
    this.culling = options.culling ?? true;

    // 통계 (디버깅용)
    this.drawCalls = 0;
    this.culledCount = 0;
    this.visibleCount = 0;

    // 내부 스크래치
    this._renderers = [];
    this._cameras = [];
    this._defaultLayer = Math.max(0, this.sortingLayers.indexOf('Default'));
    this._scratch = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  layerIndex(name) {
    const i = this.sortingLayers.indexOf(name);
    return i < 0 ? this._defaultLayer : i;
  }

  // Engine이 매 프레임 호출: render(ctx, engine)
  render(ctx, engine) {
    this._renderers.length = 0;
    this._cameras.length = 0;
    this.drawCalls = 0;
    this.culledCount = 0;

    for (const root of engine.roots) this._collect(root);
    this.visibleCount = this._renderers.length;

    if (this._cameras.length === 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }

    this._cameras.sort((a, b) => a.depth - b.depth);
    if (!Camera.main || !Camera.main.isActiveAndEnabled) Camera.main = this._cameras[0];

    const width = engine.canvas.width;
    const height = engine.canvas.height;
    const ratio = engine.pixelRatio;

    for (const camera of this._cameras) {
      camera.updateMatrices(width, height, ratio);
      this._renderCamera(ctx, camera);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // 트리 순회하며 카메라/렌더러 수집
  _collect(gameObject) {
    if (!gameObject.isActive || gameObject.isDestroyed) return;

    for (const c of gameObject.components) {
      if (c instanceof Camera) {
        if (c.isActiveAndEnabled) this._cameras.push(c);
      } else if (c instanceof Renderer) {
        if (c.isVisible) this._renderers.push(c);
      }
    }

    for (const child of gameObject.transform.children) this._collect(child.gameObject);
  }

  // 컬링 + 정렬 + 그리기
  _renderCamera(ctx, camera) {
    const visible = [];

    for (const r of this._renderers) {
      if (this.culling) {
        const b = r.getBounds(this._scratch);
        if (b && !camera.isInView(b.minX, b.minY, b.maxX, b.maxY)) {
          this.culledCount++;
          continue;
        }
      }
      r._layerIndex = this.layerIndex(r.sortingLayer);
      r._sortY = r.ySort ? r.transform.worldMatrix.f : 0;
      visible.push(r);
    }

    visible.sort(renderPipelineCompare);

    for (const r of visible) {
      r.render(ctx, camera);
      this.drawCalls++;
    }
  }
}

// 정렬 키: 레이어 -> orderInLayer -> 월드 Y 내림차순 (Y-up이라 큰 Y가 더 멀리 있는 것)
function renderPipelineCompare(a, b) {
  if (a._layerIndex !== b._layerIndex) return a._layerIndex - b._layerIndex;
  if (a.orderInLayer !== b.orderInLayer) return a.orderInLayer - b.orderInLayer;
  return b._sortY - a._sortY;
}