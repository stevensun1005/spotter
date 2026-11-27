import * as T from 'three';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { createSkinnedAvatar } from './skinned-avatar.js';
import { createEquipment } from './equipment.js';
import { prepareRecipe } from './recipe.js';

function light(scene, color, intensity, position) {
  const source = new T.DirectionalLight(color, intensity);
  source.position.set(...position);
  scene.add(source);
  return source;
}

function formLabel(title, background) {
  const image = document.createElement('canvas');
  image.width = 192;
  image.height = 72;
  const context = image.getContext('2d');
  context.fillStyle = background;
  context.beginPath();
  context.roundRect(4,4,184,64,25);
  context.fill();
  context.font = '600 37px -apple-system, sans-serif';
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(title,96,37);
  const texture = new T.CanvasTexture(image);
  texture.colorSpace = T.SRGBColorSpace;
  const material = new T.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,toneMapped:false});
  const label = new T.Sprite(material);
  label.scale.set(.39,.146,1);
  return label;
}

function labelPosition(label, body) {
  const center = body.chest;
  label.position.set(center[0],Math.max(body.head[1],body.hips[1],body.chest[1])+.189,center[2]);
}

function studio(recipe, width, height) {
  const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.setSize(width, height, false);

  const scene = new T.Scene();
  scene.background = new T.Color(0xe8e9e5);
  scene.add(new T.HemisphereLight(0xf9fbff, 0x7a817c, 2));
  const key = light(scene, 0xfff6eb, 3.2, [-3.4, 5.2, -3]);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {left: -5, right: 5, top: 5, bottom: -5, near: .1, far: 16});
  key.shadow.normalBias = .013;
  key.shadow.bias = -.0002;
  light(scene, 0xe2ecfb, 1.55, [3, 2, 2.2]);
  light(scene, 0xf6ffef, 2.25, [-1.3, 3.7, 3.3]);

  const floor = new T.Mesh(new T.PlaneGeometry(100, 100),
    new T.MeshStandardMaterial({color: 0xbec4bc, roughness: 1}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const avatar = createSkinnedAvatar();
  avatar.setFocus(recipe.muscles.length > 0, recipe.muscles);
  const partner = recipe.partner ? createSkinnedAvatar() : undefined;
  const gear = createEquipment(recipe.options, recipe.sample);
  scene.add(floor, gear.group, avatar.group);
  if (partner) scene.add(partner.group);
  const labels = recipe.formComparison ? [formLabel('正确','#315848'),formLabel('需调整','#8b5a43')] : [];
  if (labels.length) scene.add(...labels);
  const halfHeight = recipe.camera.height / 2;
  const halfWidth = halfHeight * width / height;
  const camera = new T.OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, .05, 35);
  const [x, y, z] = recipe.camera.focus;
  const yaw = T.MathUtils.degToRad(recipe.camera.yaw);
  const elevation = T.MathUtils.degToRad(recipe.camera.elevation);
  camera.position.set(x + 6 * Math.cos(elevation) * Math.sin(yaw), y + 6 * Math.sin(elevation),
    z + 6 * Math.cos(elevation) * Math.cos(yaw));
  const baseZ = camera.position.z;

  return {
    canvas: renderer.domElement,
    paint(phase) {
      const pose = recipe.sample(phase);
      camera.position.z = baseZ + pose.followZ;
      camera.lookAt(x, y, z + pose.followZ);
      avatar.update(pose);
      if (partner) partner.update(pose.partner);
      if (labels.length) {
        labelPosition(labels[0],pose);
        labelPosition(labels[1],pose.partner);
      }
      gear.update(pose);
      renderer.render(scene, camera);
    },
    dispose() {
      for (const label of labels) {
        label.material.map.dispose();
        label.material.dispose();
      }
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

function encode(frames, width, height, delay, colors) {
  const gif = GIFEncoder();
  for (const rgba of frames) {
    const palette = quantize(rgba, colors, {format: 'rgb565'});
    const indexed = applyPalette(rgba, palette, 'rgb565');
    gif.writeFrame(indexed, width, height, {palette, delay, repeat: 0});
  }
  gif.finish();
  return gif.bytes();
}

async function renderGif(input, progress = () => {}) {
  const recipe = prepareRecipe(input);
  const width = 384;
  const height = 216;
  const total = Math.round(recipe.durationMs / 100);
  const delay = recipe.durationMs / total;
  const player = studio(recipe, width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  const frames = [];
  try {
    for (let index = 0; index < total; index++) {
      player.paint(index / total);
      ctx.drawImage(player.canvas, 0, 0);
      frames.push(ctx.getImageData(0, 0, width, height).data);
      if (index % 4 === 0) {
        progress(index + 1, total);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  } finally {
    player.dispose();
  }
  for (const colors of [72, 42, 24, 12]) {
    const bytes = encode(frames, width, height, delay, colors);
    if (bytes.length <= 768 * 1024) return bytes;
  }
  throw new Error('GIF exceeds 768 KiB. Try a shorter loop or closer camera framing.');
}

window.spotterDemoRenderer = {
  createFrameRenderer(input) {
    const player = studio(prepareRecipe(input), 704, 396);
    return {
      frame(phase, mime = 'image/png') {
        player.paint(phase);
        return player.canvas.toDataURL(mime, .91).split(',')[1];
      },
      dispose: player.dispose,
    };
  },
  async renderBase64(recipe) {
    const bytes = await renderGif(recipe);
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  },
};

const form = document.querySelector('form');
const file = document.querySelector('input');
const status = document.querySelector('#status');
const image = document.querySelector('img');
const download = document.querySelector('#download');
const submit = form.querySelector('button');
let resultUrl;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const selected = file.files[0];
  if (!selected || selected.size > 384 * 1024) {
    status.textContent = '请选择 384 KiB 以内的动作配方 JSON。';
    return;
  }
  submit.disabled = true;
  download.hidden = true;
  image.hidden = true;
  status.textContent = '正在渲染…';
  try {
    const bytes = await renderGif(JSON.parse(await selected.text()), (current, total) => {
      status.textContent = `正在渲染 ${current} / ${total}`;
    });
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(new Blob([bytes], {type: 'image/gif'}));
    image.src = resultUrl;
    download.href = resultUrl;
    image.hidden = false;
    download.hidden = false;
    status.textContent = `示例已生成 · ${Math.ceil(bytes.length / 1024)} KiB`;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
