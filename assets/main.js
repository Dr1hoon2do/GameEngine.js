const App = new Engine({ canvas: "#game" });
App.renderer = new RenderPipeline();   // 이것도 빠져있었어, 아래서 설명할게

const cam = App.create('camera');
cam.addComponent(Camera, 3);

Load.assetBasePath = 'assets/';
Load.Image('player', 'player.png').then(() => {
  const p = App.create('player');
  p.addComponent(SpriteRenderer, Resource.image('player'), { pivot: { x: 0.5, y: 0 } });
});

App.start();
console.log("started");