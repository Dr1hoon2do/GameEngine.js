(function () {
  const ENGINE_BASE = 'KuntoGame/';
  const ENGINE_FILES = [
    'math/Vector.js',
    'math/Matrix.js',
    'core/Component.js',
    'core/Transform.js',
    'core/GameObject.js',
    'core/Renderer.js',
    'systems/Time.js',
    'core/Engine.js',
    'core/Resource.js',
    'systems/Input.js',
    'components/Camera.js',
    'components/SpriteRenderer.js',
    'systems/RenderPipeline.js',
  ];

  const GAME_BASE = 'assets/';
  const GAME_FILES = [
    'main.js',
  ];

  const bootstrap = document.createElement('script');
  bootstrap.src = ENGINE_BASE + 'core/Load.js';

  bootstrap.onload = () => {
    Load.basePath = ENGINE_BASE;
    Load.Scripts(ENGINE_FILES)
      .then(() => {
        Load.basePath = GAME_BASE;
        return Load.Scripts(GAME_FILES);
      })
      .catch((err) => {
        console.error('init.js: failed to load', err.message);
      });
  };

  bootstrap.onerror = () => {
    console.error('init.js: failed to load Load.js itself at "' + bootstrap.src + '"');
  };

  document.head.appendChild(bootstrap);
})();