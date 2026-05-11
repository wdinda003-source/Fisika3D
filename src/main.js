import './style.css'
import * as BABYLON from '@babylonjs/core/Legacy/legacy'
import '@babylonjs/core/Materials/standardMaterial'
import '@babylonjs/core/Meshes/Builders/boxBuilder'
import '@babylonjs/core/Meshes/Builders/sphereBuilder'
import '@babylonjs/core/Meshes/Builders/groundBuilder'
import '@babylonjs/core/Meshes/Builders/linesBuilder'
import '@babylonjs/core/Meshes/Builders/tubeBuilder'
import '@babylonjs/core/Physics/physicsEngineComponent'
import RAPIER from '@dimforge/rapier3d-compat'

const $ = (id) => document.getElementById(id)

const ui = {
  canvas: $('renderCanvas'),
  canvasWrap: $('canvasWrap'),
  overlay: $('loadingOverlay'),
  engineStatus: $('engineStatus'),
  engineDetail: $('engineDetail'),
  lessonButtons: $('lessonButtons'),
  lessonTitle: $('lessonTitle'),
  lessonLabel: $('lessonLabel'),
  conceptTitle: $('conceptTitle'),
  conceptText: $('conceptText'),
  formulaText: $('formulaText'),
  parameterPanel: $('parameterPanel'),
  dataPanel: $('dataPanel'),
  playBtn: $('playBtn'),
  pauseBtn: $('pauseBtn'),
  resetBtn: $('resetBtn'),
  zoomInBtn: $('zoomInBtn'),
  zoomOutBtn: $('zoomOutBtn'),
  fullscreenBtn: $('fullscreenBtn'),
  gestureBtn: $('gestureBtn'),
  gestureVideo: $('gestureVideo'),
  gestureHint: $('gestureHint'),
  gestureBadge: $('gestureBadge')
}

let engine = null
let scene = null
let currentLessonKey = 'freefall'
let activeLesson = null
let paused = false
let rapierReady = false
let R = null
let rapierWorld = null
let rigidBodies = []
let time = 0
let lastTime = performance.now()
let gestureRecognizer = null
let gestureRunning = false
let gestureStream = null
let lastGestureCommandAt = 0
let lastGestureName = 'None'

const lessons = {
  freefall: {
    icon: '⬇️',
    title: 'Gerak jatuh bebas',
    subtitle: 'Bola jatuh karena gravitasi',
    concept:
      'Gerak jatuh bebas terjadi saat benda bergerak vertikal karena pengaruh gravitasi. Hambatan udara diabaikan, sehingga percepatan benda bernilai tetap.',
    formulas: ['v = g t', 'h = h₀ - ½ g t²', 'Eₚ = m g h'],
    params: {
      gravity: { label: 'Gravitasi', unit: 'm/s²', min: 1, max: 20, step: 0.1, value: 9.8 },
      height: { label: 'Ketinggian awal', unit: 'm', min: 3, max: 30, step: 1, value: 18 },
      mass: { label: 'Massa bola', unit: 'kg', min: 0.2, max: 8, step: 0.1, value: 1.2 }
    }
  },
  projectile: {
    icon: '🎯',
    title: 'Gerak parabola',
    subtitle: 'Bola ditembak dengan sudut tertentu',
    concept:
      'Gerak parabola menggabungkan gerak lurus beraturan pada sumbu horizontal dan gerak berubah beraturan pada sumbu vertikal.',
    formulas: ['x = v₀ cos θ · t', 'y = v₀ sin θ · t - ½ g t²', 'R = v₀² sin(2θ) / g'],
    params: {
      speed: { label: 'Kecepatan awal', unit: 'm/s', min: 5, max: 35, step: 1, value: 20 },
      angle: { label: 'Sudut elevasi', unit: '°', min: 10, max: 80, step: 1, value: 45 },
      gravity: { label: 'Gravitasi', unit: 'm/s²', min: 1, max: 20, step: 0.1, value: 9.8 }
    }
  },
  newton: {
    icon: '🧱',
    title: 'Hukum Newton',
    subtitle: 'Balok bergerak karena gaya',
    concept:
      'Hukum II Newton menjelaskan hubungan antara gaya, massa, dan percepatan. Semakin besar gaya, semakin besar percepatan. Semakin besar massa, semakin kecil percepatan.',
    formulas: ['ΣF = m a', 'a = F / m', 's = ½ a t²'],
    params: {
      force: { label: 'Gaya dorong', unit: 'N', min: 1, max: 80, step: 1, value: 28 },
      mass: { label: 'Massa balok', unit: 'kg', min: 1, max: 20, step: 1, value: 6 },
      friction: { label: 'Koefisien gesek', unit: '', min: 0, max: 0.8, step: 0.01, value: 0.18 }
    }
  },
  collision: {
    icon: '⚪',
    title: 'Tumbukan',
    subtitle: 'Dua bola bertabrakan',
    concept:
      'Tumbukan menunjukkan perubahan kecepatan benda akibat interaksi singkat. Simulasi ini menekankan momentum dan koefisien restitusi.',
    formulas: ['p = m v', 'm₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′', 'e = |v₂′ - v₁′| / |v₁ - v₂|'],
    params: {
      m1: { label: 'Massa bola 1', unit: 'kg', min: 0.5, max: 8, step: 0.1, value: 2 },
      m2: { label: 'Massa bola 2', unit: 'kg', min: 0.5, max: 8, step: 0.1, value: 3 },
      speed: { label: 'Kecepatan awal', unit: 'm/s', min: 1, max: 14, step: 0.5, value: 7 },
      restitution: { label: 'Restitusi', unit: '', min: 0, max: 1, step: 0.01, value: 0.85 }
    }
  },
  pendulum: {
    icon: '⏱️',
    title: 'Bandul sederhana',
    subtitle: 'Bandul berayun',
    concept:
      'Bandul sederhana berayun karena gaya pemulih gravitasi. Untuk sudut kecil, periode bandul terutama dipengaruhi panjang tali dan gravitasi.',
    formulas: ['T = 2π √(L/g)', 'ω = √(g/L)', 'θ(t) = θ₀ cos(ωt)'],
    params: {
      length: { label: 'Panjang tali', unit: 'm', min: 1, max: 8, step: 0.1, value: 4 },
      angle: { label: 'Sudut awal', unit: '°', min: 5, max: 60, step: 1, value: 28 },
      gravity: { label: 'Gravitasi', unit: 'm/s²', min: 1, max: 20, step: 0.1, value: 9.8 }
    }
  },
  solar: {
    icon: '🪐',
    title: 'Tata surya',
    subtitle: 'Planet mengorbit matahari',
    concept:
      'Model tata surya ini memvisualisasikan orbit planet. Skala disederhanakan agar gerak planet mudah diamati di layar.',
    formulas: ['F = G M m / r²', 'v = √(GM/r)', 'T² ∝ r³'],
    params: {
      orbitSpeed: { label: 'Kecepatan orbit', unit: 'x', min: 0.2, max: 3, step: 0.1, value: 1 },
      distance: { label: 'Skala jarak', unit: 'x', min: 0.7, max: 1.6, step: 0.1, value: 1 },
      planetSize: { label: 'Skala ukuran planet', unit: 'x', min: 0.6, max: 2, step: 0.1, value: 1 }
    }
  },
  wave: {
    icon: '〰️',
    title: 'Gelombang',
    subtitle: 'Permukaan gelombang bergerak',
    concept:
      'Gelombang memindahkan energi tanpa memindahkan medium secara permanen. Parameter utama gelombang meliputi amplitudo, panjang gelombang, frekuensi, dan cepat rambat.',
    formulas: ['v = f λ', 'y = A sin(kx - ωt)', 'ω = 2πf'],
    params: {
      amplitude: { label: 'Amplitudo', unit: 'm', min: 0.2, max: 3, step: 0.1, value: 1.2 },
      wavelength: { label: 'Panjang gelombang', unit: 'm', min: 1, max: 8, step: 0.1, value: 4 },
      frequency: { label: 'Frekuensi', unit: 'Hz', min: 0.2, max: 3, step: 0.1, value: 1 }
    }
  },
  magnet: {
    icon: '🧲',
    title: 'Medan magnet',
    subtitle: 'Garis medan di sekitar magnet',
    concept:
      'Medan magnet digambarkan dengan garis medan. Semakin rapat garis medan, semakin kuat medan pada daerah tersebut.',
    formulas: ['B ∝ 1/r²', 'F = q v B sin θ', 'Φ = B A cos θ'],
    params: {
      strength: { label: 'Kuat medan', unit: 'T relatif', min: 0.5, max: 5, step: 0.1, value: 2 },
      lines: { label: 'Jumlah garis medan', unit: 'garis', min: 8, max: 32, step: 1, value: 18 },
      spin: { label: 'Kecepatan partikel', unit: 'x', min: 0.2, max: 4, step: 0.1, value: 1.2 }
    }
  }
}

let paramValues = Object.fromEntries(
  Object.entries(lessons).map(([key, lesson]) => [
    key,
    Object.fromEntries(Object.entries(lesson.params).map(([p, cfg]) => [p, cfg.value]))
  ])
)

function setStatus(text, detail = '', type = 'ok') {
  ui.engineStatus.textContent = text
  ui.engineDetail.textContent = detail
  ui.engineStatus.style.color = type === 'error' ? '#fb7185' : type === 'warn' ? '#f59e0b' : '#34d399'
}

function hideOverlay() {
  ui.overlay.classList.add('hidden')
}

function showOverlay(text = 'Menyiapkan animasi 3D...') {
  ui.overlay.classList.remove('hidden')
  ui.overlay.querySelector('p').textContent = text
}

function clearScene() {
  if (!scene) return
  rigidBodies = []
  rapierWorld = null

  scene.meshes.slice().forEach((mesh) => mesh.dispose())
  scene.lights.slice().forEach((light) => light.dispose())
  scene.cameras.slice().forEach((camera) => camera.dispose())
  scene.materials.slice().forEach((mat) => mat.dispose())

  time = 0
  lastTime = performance.now()
}

function mat(name, color, emissive = false) {
  const m = new BABYLON.StandardMaterial(name, scene)
  m.diffuseColor = color
  m.specularColor = new BABYLON.Color3(0.35, 0.35, 0.35)
  if (emissive) m.emissiveColor = color.scale(0.65)
  return m
}

function createBaseScene(cameraPosition = new BABYLON.Vector3(0, 8, -16), target = BABYLON.Vector3.Zero()) {
  const camera = new BABYLON.ArcRotateCamera('camera', Math.PI / 2.2, Math.PI / 2.8, 18, target, scene)
  camera.setPosition(cameraPosition)
  camera.attachControl(ui.canvas, true)
  camera.lowerRadiusLimit = 6
  camera.upperRadiusLimit = 42
  camera.wheelDeltaPercentage = 0.015
  camera.pinchDeltaPercentage = 0.01

  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene)
  hemi.intensity = 0.75

  const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-0.4, -0.8, 0.45), scene)
  dir.position = new BABYLON.Vector3(8, 14, -8)
  dir.intensity = 1.3

  scene.clearColor = new BABYLON.Color4(0.02, 0.05, 0.10, 1)
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2
  scene.fogDensity = 0.012
  scene.fogColor = new BABYLON.Color3(0.03, 0.07, 0.13)

  return camera
}

function createGrid(size = 20) {
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: size, height: size }, scene)
  ground.material = mat('groundMat', new BABYLON.Color3(0.08, 0.13, 0.20))
  ground.position.y = -0.05

  const lines = []
  for (let i = -size / 2; i <= size / 2; i += 1) {
    lines.push([new BABYLON.Vector3(i, 0.01, -size / 2), new BABYLON.Vector3(i, 0.01, size / 2)])
    lines.push([new BABYLON.Vector3(-size / 2, 0.01, i), new BABYLON.Vector3(size / 2, 0.01, i)])
  }

  const grid = BABYLON.MeshBuilder.CreateLineSystem('grid', { lines }, scene)
  grid.color = new BABYLON.Color3(0.18, 0.29, 0.40)
  return ground
}

function makeTextPlane(name, text, position, size = 1.2) {
  const texture = new BABYLON.DynamicTexture(`${name}Texture`, { width: 768, height: 256 }, scene, true)
  texture.hasAlpha = true
  const ctx = texture.getContext()
  ctx.clearRect(0, 0, 768, 256)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)'
  ctx.roundRect?.(16, 16, 736, 224, 28)
  ctx.fill()
  ctx.fillStyle = '#e0f2fe'
  ctx.font = 'bold 52px Arial'
  ctx.fillText(text, 44, 145)
  texture.update()

  const plane = BABYLON.MeshBuilder.CreatePlane(name, { width: size * 3, height: size }, scene)
  const material = new BABYLON.StandardMaterial(`${name}Mat`, scene)
  material.diffuseTexture = texture
  material.emissiveTexture = texture
  material.opacityTexture = texture
  plane.material = material
  plane.position = position
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL
  return plane
}

function createRapierWorld(gravityY) {
  if (!rapierReady || !R) return null
  try {
    rapierWorld = new R.World({ x: 0, y: gravityY, z: 0 })
    return rapierWorld
  } catch (err) {
    console.warn('Rapier fallback:', err)
    return null
  }
}

function addRapierSphere(mesh, radius, mass, position, velocity = { x: 0, y: 0, z: 0 }, restitution = 0.7) {
  if (!rapierWorld || !R) return null
  const bodyDesc = R.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z)
  const body = rapierWorld.createRigidBody(bodyDesc)
  body.setLinvel(velocity, true)
  const colliderDesc = R.ColliderDesc.ball(radius).setRestitution(restitution).setMass(mass)
  rapierWorld.createCollider(colliderDesc, body)
  rigidBodies.push({ mesh, body })
  return body
}

function addRapierBox(mesh, size, mass, position, velocity = { x: 0, y: 0, z: 0 }, restitution = 0.25) {
  if (!rapierWorld || !R) return null
  const bodyDesc = R.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z)
  const body = rapierWorld.createRigidBody(bodyDesc)
  body.setLinvel(velocity, true)
  const colliderDesc = R.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setRestitution(restitution).setMass(mass)
  rapierWorld.createCollider(colliderDesc, body)
  rigidBodies.push({ mesh, body })
  return body
}

function addRapierGround(y = 0) {
  if (!rapierWorld || !R) return
  const groundBody = rapierWorld.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, y, 0))
  rapierWorld.createCollider(R.ColliderDesc.cuboid(60, 0.05, 60), groundBody)
}

function syncRapier() {
  if (!rapierWorld) return
  rapierWorld.step()
  for (const item of rigidBodies) {
    const t = item.body.translation()
    const r = item.body.rotation()
    item.mesh.position.set(t.x, t.y, t.z)
    item.mesh.rotationQuaternion = new BABYLON.Quaternion(r.x, r.y, r.z, r.w)
  }
}

function getParams() {
  return paramValues[currentLessonKey]
}

function renderData(data) {
  ui.dataPanel.innerHTML = Object.entries(data)
    .map(([key, value]) => `
      <div class="data-item">
        <span>${key}</span>
        <strong>${value}</strong>
      </div>
    `)
    .join('')
}

function renderButtons() {
  ui.lessonButtons.innerHTML = ''
  Object.entries(lessons).forEach(([key, lesson]) => {
    const btn = document.createElement('button')
    btn.className = `lesson-btn ${key === currentLessonKey ? 'active' : ''}`
    btn.type = 'button'
    btn.innerHTML = `<strong>${lesson.icon} ${lesson.title}</strong><span>${lesson.subtitle}</span>`
    btn.addEventListener('click', () => selectLesson(key))
    ui.lessonButtons.appendChild(btn)
  })
}

function renderParameters() {
  const lesson = lessons[currentLessonKey]
  const values = paramValues[currentLessonKey]
  ui.parameterPanel.innerHTML = ''

  Object.entries(lesson.params).forEach(([key, cfg]) => {
    const row = document.createElement('div')
    row.className = 'param-row'
    const value = values[key]
    row.innerHTML = `
      <label class="param-label">
        <span>${cfg.label}</span>
        <output id="out-${key}">${value}${cfg.unit ? ` ${cfg.unit}` : ''}</output>
      </label>
      <input type="range" min="${cfg.min}" max="${cfg.max}" step="${cfg.step}" value="${value}" aria-label="${cfg.label}" />
    `
    const input = row.querySelector('input')
    const output = row.querySelector('output')
    input.addEventListener('input', () => {
      values[key] = Number(input.value)
      output.textContent = `${values[key]}${cfg.unit ? ` ${cfg.unit}` : ''}`
      if (activeLesson?.onParamChange) activeLesson.onParamChange()
    })
    input.addEventListener('change', () => {
      if (activeLesson?.resetOnChange) resetLesson()
    })
    ui.parameterPanel.appendChild(row)
  })
}

function renderLessonInfo() {
  const lesson = lessons[currentLessonKey]
  ui.lessonTitle.textContent = lesson.title
  ui.conceptTitle.textContent = lesson.title
  ui.conceptText.textContent = lesson.concept
  ui.formulaText.innerHTML = lesson.formulas.map((f) => `<code>${f}</code>`).join('')
}

function selectLesson(key) {
  currentLessonKey = key
  renderButtons()
  renderParameters()
  renderLessonInfo()
  resetLesson()
}

function resetLesson() {
  if (!scene) return
  showOverlay('Memuat ulang animasi...')
  clearScene()

  const factory = sceneFactories[currentLessonKey]
  activeLesson = factory()
  activeLesson?.reset?.()

  setTimeout(hideOverlay, 120)
}

const sceneFactories = {
  freefall() {
    createBaseScene(new BABYLON.Vector3(0, 8, -18), new BABYLON.Vector3(0, 7, 0))
    createGrid(18)

    const p = getParams()
    const radius = 0.65
    const ball = BABYLON.MeshBuilder.CreateSphere('ball', { diameter: radius * 2, segments: 48 }, scene)
    ball.material = mat('ballMat', new BABYLON.Color3(0.2, 0.72, 1))
    makeTextPlane('freefallLabel', 'v = g t', new BABYLON.Vector3(-4.8, 9, 0), 1)

    let y0 = p.height
    let vy = 0
    let body = null

    function reset() {
      y0 = p.height
      vy = 0
      ball.position.set(0, y0, 0)
      createRapierWorld(-p.gravity)
      addRapierGround(0)
      body = addRapierSphere(ball, radius, p.mass, { x: 0, y: y0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.68)
      time = 0
    }

    function update(dt) {
      const pp = getParams()
      if (rapierWorld && body) {
        syncRapier()
        const vel = body.linvel()
        const pos = body.translation()
        if (pos.y < radius + 0.04) body.setLinvel({ x: 0, y: Math.abs(vel.y) * 0.68, z: 0 }, true)
        renderData({
          'Waktu': `${time.toFixed(2)} s`,
          'Ketinggian': `${Math.max(0, ball.position.y - radius).toFixed(2)} m`,
          'Kecepatan': `${Math.abs(vel.y).toFixed(2)} m/s`,
          'Energi potensial': `${(pp.mass * pp.gravity * Math.max(0, ball.position.y)).toFixed(1)} J`
        })
      } else {
        vy += -pp.gravity * dt
        ball.position.y += vy * dt
        if (ball.position.y < radius) {
          ball.position.y = radius
          vy = Math.abs(vy) * 0.68
        }
        renderData({
          'Waktu': `${time.toFixed(2)} s`,
          'Ketinggian': `${Math.max(0, ball.position.y - radius).toFixed(2)} m`,
          'Kecepatan': `${Math.abs(vy).toFixed(2)} m/s`,
          'Energi potensial': `${(pp.mass * pp.gravity * Math.max(0, ball.position.y)).toFixed(1)} J`
        })
      }
    }

    return { reset, update, resetOnChange: true }
  },

  projectile() {
    createBaseScene(new BABYLON.Vector3(0, 10, -24), new BABYLON.Vector3(5, 4, 0))
    createGrid(32)

    const ball = BABYLON.MeshBuilder.CreateSphere('projectileBall', { diameter: 0.8, segments: 36 }, scene)
    ball.material = mat('projectileMat', new BABYLON.Color3(1, 0.62, 0.24))
    let trail = BABYLON.MeshBuilder.CreateLines('trail', { points: [BABYLON.Vector3.Zero(), BABYLON.Vector3.Zero()] }, scene)
    trail.color = new BABYLON.Color3(0.98, 0.85, 0.36)
    const points = []

    function reset() {
      ball.position.set(-9, 0.45, 0)
      points.length = 0
      time = 0
    }

    function update(dt) {
      const p = getParams()
      const theta = BABYLON.Tools.ToRadians(p.angle)
      const vx = p.speed * Math.cos(theta)
      const vy = p.speed * Math.sin(theta)
      const x = -9 + vx * time * 0.55
      const y = 0.45 + vy * time - 0.5 * p.gravity * time * time
      if (y < 0.45 || x > 14) {
        time = 0
        points.length = 0
        return
      }
      ball.position.set(x, y, 0)
      points.push(ball.position.clone())
      if (points.length > 160) points.shift()
      trail.dispose()
      trail = BABYLON.MeshBuilder.CreateLines('trail', { points: points.length > 1 ? points : [ball.position, ball.position] }, scene)
      trail.color = new BABYLON.Color3(0.98, 0.85, 0.36)
      renderData({
        'Waktu': `${time.toFixed(2)} s`,
        'Posisi x': `${(x + 9).toFixed(2)} m`,
        'Posisi y': `${Math.max(0, y - 0.45).toFixed(2)} m`,
        'Jangkauan teori': `${((p.speed ** 2 * Math.sin(2 * theta)) / p.gravity).toFixed(2)} m`
      })
    }

    return { reset, update, resetOnChange: true }
  },

  newton() {
    createBaseScene(new BABYLON.Vector3(0, 7, -18), new BABYLON.Vector3(0, 2, 0))
    createGrid(22)

    const box = BABYLON.MeshBuilder.CreateBox('box', { width: 2.2, height: 1.4, depth: 1.6 }, scene)
    box.material = mat('boxMat', new BABYLON.Color3(0.56, 0.84, 0.35))

    let x = -8
    let v = 0

    function reset() {
      x = -8
      v = 0
      box.position.set(x, 0.72, 0)
      time = 0
    }

    function update(dt) {
      const p = getParams()
      const frictionForce = p.friction * p.mass * 9.8
      const net = Math.max(0, p.force - frictionForce)
      const a = net / p.mass
      v += a * dt
      x += v * dt
      if (x > 8) {
        x = -8
        v = 0
        time = 0
      }
      box.position.x = x
      box.rotation.z = Math.sin(time * 7) * 0.025
      renderData({
        'Gaya netto': `${net.toFixed(2)} N`,
        'Percepatan': `${a.toFixed(2)} m/s²`,
        'Kecepatan': `${v.toFixed(2)} m/s`,
        'Posisi': `${(x + 8).toFixed(2)} m`
      })
    }

    return { reset, update, resetOnChange: true }
  },

  collision() {
    createBaseScene(new BABYLON.Vector3(0, 8, -22), new BABYLON.Vector3(0, 1, 0))
    createGrid(24)

    const b1 = BABYLON.MeshBuilder.CreateSphere('ball1', { diameter: 1.2, segments: 36 }, scene)
    const b2 = BABYLON.MeshBuilder.CreateSphere('ball2', { diameter: 1.45, segments: 36 }, scene)
    b1.material = mat('b1mat', new BABYLON.Color3(0.2, 0.72, 1))
    b2.material = mat('b2mat', new BABYLON.Color3(1, 0.35, 0.5))

    let x1 = -7
    let x2 = 5
    let v1 = 0
    let v2 = 0
    let collided = false

    function reset() {
      const p = getParams()
      x1 = -7
      x2 = 5
      v1 = p.speed
      v2 = -p.speed * 0.35
      collided = false
      b1.position.set(x1, 0.75, 0)
      b2.position.set(x2, 0.8, 0)
      time = 0
    }

    function update(dt) {
      const p = getParams()
      x1 += v1 * dt
      x2 += v2 * dt
      if (!collided && Math.abs(x2 - x1) < 1.32) {
        const u1 = v1
        const u2 = v2
        const e = p.restitution
        v1 = ((p.m1 - e * p.m2) * u1 + (1 + e) * p.m2 * u2) / (p.m1 + p.m2)
        v2 = ((p.m2 - e * p.m1) * u2 + (1 + e) * p.m1 * u1) / (p.m1 + p.m2)
        collided = true
      }

      if (x1 > 10 || x2 < -10 || x1 < -10 || x2 > 10) reset()

      b1.position.x = x1
      b2.position.x = x2

      renderData({
        'Momentum 1': `${(p.m1 * v1).toFixed(2)} kg m/s`,
        'Momentum 2': `${(p.m2 * v2).toFixed(2)} kg m/s`,
        'v₁': `${v1.toFixed(2)} m/s`,
        'v₂': `${v2.toFixed(2)} m/s`
      })
    }

    return { reset, update, resetOnChange: true }
  },

  pendulum() {
    createBaseScene(new BABYLON.Vector3(0, 6, -18), new BABYLON.Vector3(0, 2.5, 0))
    createGrid(16)

    const pivot = BABYLON.MeshBuilder.CreateSphere('pivot', { diameter: 0.35, segments: 24 }, scene)
    pivot.position.set(0, 6, 0)
    pivot.material = mat('pivotMat', new BABYLON.Color3(0.85, 0.85, 0.95), true)

    const bob = BABYLON.MeshBuilder.CreateSphere('bob', { diameter: 1, segments: 40 }, scene)
    bob.material = mat('bobMat', new BABYLON.Color3(0.95, 0.66, 0.18))
    let rod = null

    function reset() {
      time = 0
    }

    function update() {
      const p = getParams()
      const theta0 = BABYLON.Tools.ToRadians(p.angle)
      const omega = Math.sqrt(p.gravity / p.length)
      const theta = theta0 * Math.cos(omega * time)
      const x = p.length * Math.sin(theta)
      const y = 6 - p.length * Math.cos(theta)
      bob.position.set(x, y, 0)

      if (rod) rod.dispose()
      rod = BABYLON.MeshBuilder.CreateLines('rod', { points: [pivot.position, bob.position] }, scene)
      rod.color = new BABYLON.Color3(0.86, 0.92, 1)

      const T = 2 * Math.PI * Math.sqrt(p.length / p.gravity)
      renderData({
        'Periode': `${T.toFixed(2)} s`,
        'Sudut': `${BABYLON.Tools.ToDegrees(theta).toFixed(1)}°`,
        'Panjang': `${p.length.toFixed(1)} m`,
        'Frekuensi': `${(1 / T).toFixed(2)} Hz`
      })
    }

    return { reset, update, resetOnChange: false, onParamChange: () => {} }
  },

  solar() {
    createBaseScene(new BABYLON.Vector3(0, 12, -26), BABYLON.Vector3.Zero())
    const sun = BABYLON.MeshBuilder.CreateSphere('sun', { diameter: 2.4, segments: 48 }, scene)
    sun.material = mat('sunMat', new BABYLON.Color3(1, 0.68, 0.08), true)

    const planetData = [
      { name: 'Merkurius', r: 3.6, s: 1.6, size: 0.36, color: new BABYLON.Color3(0.7, 0.64, 0.55) },
      { name: 'Bumi', r: 6.0, s: 1.0, size: 0.55, color: new BABYLON.Color3(0.25, 0.55, 1) },
      { name: 'Mars', r: 8.4, s: 0.75, size: 0.48, color: new BABYLON.Color3(1, 0.36, 0.24) }
    ]

    const planets = planetData.map((pd) => {
      const mesh = BABYLON.MeshBuilder.CreateSphere(pd.name, { diameter: pd.size, segments: 32 }, scene)
      mesh.material = mat(`${pd.name}Mat`, pd.color)
      const orbitPoints = []
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2
        orbitPoints.push(new BABYLON.Vector3(Math.cos(a) * pd.r, 0, Math.sin(a) * pd.r))
      }
      const orbit = BABYLON.MeshBuilder.CreateLines(`${pd.name}Orbit`, { points: orbitPoints }, scene)
      orbit.color = new BABYLON.Color3(0.28, 0.45, 0.64)
      return { ...pd, mesh, orbit }
    })

    function reset() {
      time = 0
    }

    function update() {
      const p = getParams()
      sun.rotation.y += 0.01
      planets.forEach((pl) => {
        const r = pl.r * p.distance
        const a = time * pl.s * p.orbitSpeed
        pl.mesh.position.set(Math.cos(a) * r, 0, Math.sin(a) * r)
        pl.mesh.scaling.setAll(p.planetSize)
      })
      renderData({
        'Kecepatan orbit': `${p.orbitSpeed.toFixed(1)} x`,
        'Skala jarak': `${p.distance.toFixed(1)} x`,
        'Planet aktif': '3 planet',
        'Waktu simulasi': `${time.toFixed(1)} s`
      })
    }

    return { reset, update, resetOnChange: false, onParamChange: () => {} }
  },

  wave() {
    createBaseScene(new BABYLON.Vector3(0, 8, -19), new BABYLON.Vector3(0, 1, 0))
    createGrid(22)

    const nodes = []
    const count = 36
    for (let i = 0; i < count; i++) {
      const sphere = BABYLON.MeshBuilder.CreateSphere(`node${i}`, { diameter: 0.24, segments: 12 }, scene)
      sphere.material = mat(`nodeMat${i}`, new BABYLON.Color3(0.2, 0.75, 1))
      nodes.push(sphere)
    }
    let line = null

    function reset() {
      time = 0
    }

    function update() {
      const p = getParams()
      const pts = []
      for (let i = 0; i < count; i++) {
        const x = -9 + (18 * i) / (count - 1)
        const y = 1.5 + p.amplitude * Math.sin((2 * Math.PI / p.wavelength) * x - 2 * Math.PI * p.frequency * time)
        const z = Math.sin(i * 0.4) * 0.35
        nodes[i].position.set(x, y, z)
        pts.push(nodes[i].position.clone())
      }
      if (line) line.dispose()
      line = BABYLON.MeshBuilder.CreateLines('waveLine', { points: pts }, scene)
      line.color = new BABYLON.Color3(0.75, 0.9, 1)
      renderData({
        'Cepat rambat': `${(p.frequency * p.wavelength).toFixed(2)} m/s`,
        'Amplitudo': `${p.amplitude.toFixed(1)} m`,
        'Frekuensi': `${p.frequency.toFixed(1)} Hz`,
        'Panjang gelombang': `${p.wavelength.toFixed(1)} m`
      })
    }

    return { reset, update, resetOnChange: false, onParamChange: () => {} }
  },

  magnet() {
    createBaseScene(new BABYLON.Vector3(0, 7, -18), BABYLON.Vector3.Zero())
    createGrid(18)

    const north = BABYLON.MeshBuilder.CreateBox('north', { width: 1.8, height: 1.2, depth: 1.2 }, scene)
    const south = BABYLON.MeshBuilder.CreateBox('south', { width: 1.8, height: 1.2, depth: 1.2 }, scene)
    north.position.x = -1
    south.position.x = 1
    north.material = mat('northMat', new BABYLON.Color3(0.96, 0.2, 0.28))
    south.material = mat('southMat', new BABYLON.Color3(0.2, 0.48, 1))
    makeTextPlane('nLabel', 'N', new BABYLON.Vector3(-1, 1.35, 0), 0.5)
    makeTextPlane('sLabel', 'S', new BABYLON.Vector3(1, 1.35, 0), 0.5)

    let fieldLines = []
    const particle = BABYLON.MeshBuilder.CreateSphere('particle', { diameter: 0.36, segments: 18 }, scene)
    particle.material = mat('particleMat', new BABYLON.Color3(0.93, 0.98, 0.18), true)

    function rebuildLines() {
      fieldLines.forEach((l) => l.dispose())
      fieldLines = []
      const p = getParams()
      const total = Math.round(p.lines)
      for (let i = 0; i < total; i++) {
        const angle = (i / total) * Math.PI * 2
        const height = Math.sin(angle) * 4
        const z = Math.cos(angle) * 4
        const pts = []
        for (let t = 0; t <= 1; t += 0.04) {
          const x = -4 + 8 * t
          const y = height * Math.sin(Math.PI * t) * 0.52
          const zz = z * Math.sin(Math.PI * t) * 0.52
          pts.push(new BABYLON.Vector3(x, y, zz))
        }
        const line = BABYLON.MeshBuilder.CreateLines(`field${i}`, { points: pts }, scene)
        line.color = new BABYLON.Color3(0.38, 0.88, 1)
        fieldLines.push(line)
      }
    }

    function reset() {
      time = 0
      rebuildLines()
    }

    function update() {
      const p = getParams()
      const a = time * p.spin
      particle.position.set(Math.cos(a) * 3.5, Math.sin(a * 1.4) * 1.8, Math.sin(a) * 2.4)
      const d = Math.max(0.6, particle.position.length())
      renderData({
        'Kuat medan relatif': `${p.strength.toFixed(1)} T`,
        'Jumlah garis': `${Math.round(p.lines)}`,
        'Jarak partikel': `${d.toFixed(2)} m`,
        'B relatif': `${(p.strength / (d * d)).toFixed(2)}`
      })
    }

    return { reset, update, resetOnChange: false, onParamChange: rebuildLines }
  }
}

function playSimulation(source = 'button') {
  paused = false
  ui.pauseBtn.textContent = 'Pause'
  if (source === 'gesture') showGestureMessage('Gesture: Play')
}

function pauseSimulation(source = 'button') {
  paused = true
  ui.pauseBtn.textContent = 'Lanjut'
  if (source === 'gesture') showGestureMessage('Gesture: Pause')
}

function zoomCamera(direction = 'in', source = 'button') {
  const camera = scene?.activeCamera
  if (!camera || typeof camera.radius !== 'number') return
  const factor = direction === 'in' ? 0.86 : 1.16
  camera.radius = Math.min(camera.upperRadiusLimit || 60, Math.max(camera.lowerRadiusLimit || 4, camera.radius * factor))
  if (source === 'gesture') showGestureMessage(direction === 'in' ? 'Gesture: Zoom In' : 'Gesture: Zoom Out')
}

function showGestureMessage(message) {
  if (!ui.gestureHint) return
  ui.gestureHint.textContent = `${message}. Telapak terbuka = play, kepalan = pause, telunjuk = zoom in, dua jari = zoom out, jempol = reset.`
}


function isSecureCameraContext() {
  const host = window.location.hostname
  return window.isSecureContext || host === 'localhost' || host === '127.0.0.1'
}

function explainCameraError(err) {
  const name = err?.name || 'Error'
  const message = err?.message || 'Kamera tidak dapat diakses.'

  if (!isSecureCameraContext()) {
    return 'Kamera HP diblokir karena halaman dibuka lewat HTTP lokal. Gunakan GitHub Pages HTTPS, atau jalankan npm run dev:https lalu buka alamat https dari HP.'
  }

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Izin kamera ditolak. Buka pengaturan browser, izinkan kamera untuk situs ini, lalu coba lagi.'
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Kamera tidak ditemukan. Pastikan kamera HP tidak sedang dipakai aplikasi lain.'
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Kamera sedang dipakai aplikasi lain atau browser gagal membuka kamera. Tutup aplikasi kamera lain, lalu muat ulang halaman.'
  }

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'Resolusi atau mode kamera tidak cocok. Sistem akan mencoba mode kamera standar.'
  }

  return `${message} (${name}). Coba gunakan Chrome terbaru, GitHub Pages HTTPS, atau npm run dev:https.`
}

async function getGestureCameraStream() {
  const attempts = [
    {
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 }
      },
      audio: false
    },
    {
      video: {
        facingMode: 'user',
        width: { ideal: 480 },
        height: { ideal: 360 }
      },
      audio: false
    },
    {
      video: true,
      audio: false
    }
  ]

  let lastError = null
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      lastError = err
      console.warn('Percobaan kamera gagal:', err)
    }
  }

  throw lastError || new Error('Kamera gagal dibuka.')
}

async function createGestureRecognizerSafe(GestureRecognizer, FilesetResolver) {
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm')

  const baseOptions = {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'
  }

  try {
    return await GestureRecognizer.createFromOptions(vision, {
      baseOptions: { ...baseOptions, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1
    })
  } catch (gpuErr) {
    console.warn('Gesture GPU gagal, mencoba CPU:', gpuErr)
    return await GestureRecognizer.createFromOptions(vision, {
      baseOptions: { ...baseOptions, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 1
    })
  }
}


async function startGestureControl() {
  if (gestureRunning) {
    stopGestureControl()
    return
  }

  try {
    ui.gestureBtn.textContent = 'Memuat gesture...'
    ui.gestureBadge.textContent = 'Memuat'
    ui.gestureHint.textContent = 'Menyiapkan kamera dan model gesture. Tunggu beberapa detik.'

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser tidak menyediakan akses kamera.')
    }

    if (!isSecureCameraContext()) {
      throw new Error('Konteks tidak aman untuk kamera.')
    }

    const { GestureRecognizer, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/+esm')
    gestureRecognizer = await createGestureRecognizerSafe(GestureRecognizer, FilesetResolver)

    gestureStream = await getGestureCameraStream()

    ui.gestureVideo.muted = true
    ui.gestureVideo.playsInline = true
    ui.gestureVideo.autoplay = true
    ui.gestureVideo.srcObject = gestureStream

    try {
      await ui.gestureVideo.play()
    } catch (playErr) {
      console.warn('Video preview tidak otomatis play, tetapi stream tetap aktif:', playErr)
    }

    gestureRunning = true
    ui.gestureBtn.textContent = 'Matikan Gesture'
    ui.gestureBadge.textContent = 'Aktif'
    ui.gestureBadge.classList.add('active')
    showGestureMessage('Gesture aktif')
    gestureLoop()
  } catch (err) {
    console.error('Gesture gagal:', err)
    if (gestureStream) {
      gestureStream.getTracks().forEach((track) => track.stop())
      gestureStream = null
    }
    gestureRecognizer = null
    gestureRunning = false
    ui.gestureBtn.textContent = 'Aktifkan Gesture'
    ui.gestureBadge.textContent = 'Gagal'
    ui.gestureBadge.classList.remove('active')
    ui.gestureHint.textContent = `Gesture gagal: ${explainCameraError(err)}`
  }
}

function stopGestureControl() {
  gestureRunning = false
  gestureRecognizer = null
  if (gestureStream) {
    gestureStream.getTracks().forEach((track) => track.stop())
    gestureStream = null
  }
  ui.gestureVideo.srcObject = null
  ui.gestureBtn.textContent = 'Aktifkan Gesture'
  ui.gestureBadge.textContent = 'Nonaktif'
  ui.gestureBadge.classList.remove('active')
  showGestureMessage('Gesture nonaktif')
}

function gestureLoop() {
  if (!gestureRunning || !gestureRecognizer || !ui.gestureVideo.videoWidth) {
    if (gestureRunning) requestAnimationFrame(gestureLoop)
    return
  }

  const results = gestureRecognizer.recognizeForVideo(ui.gestureVideo, performance.now())
  const category = results.gestures?.[0]?.[0]?.categoryName || 'None'

  if (category !== 'None') {
    handleGesture(category)
  }

  requestAnimationFrame(gestureLoop)
}

function handleGesture(name) {
  const now = performance.now()
  const cooldown = name === 'Pointing_Up' || name === 'Victory' ? 550 : 1200
  if (name === lastGestureName && now - lastGestureCommandAt < cooldown) return

  lastGestureName = name
  lastGestureCommandAt = now

  switch (name) {
    case 'Open_Palm':
      playSimulation('gesture')
      break
    case 'Closed_Fist':
      pauseSimulation('gesture')
      break
    case 'Pointing_Up':
      zoomCamera('in', 'gesture')
      break
    case 'Victory':
      zoomCamera('out', 'gesture')
      break
    case 'Thumb_Up':
      resetLesson()
      showGestureMessage('Gesture: Reset')
      break
    default:
      ui.gestureHint.textContent = `Gesture terbaca: ${name}. Gunakan telapak terbuka, kepalan, telunjuk, dua jari, atau jempol.`
  }
}

function animate() {
  if (!engine || !scene) return
  engine.runRenderLoop(() => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - lastTime) / 1000)
    lastTime = now

    if (!paused && activeLesson?.update) {
      time += dt
      activeLesson.update(dt)
    }

    scene.render()
  })
}

async function boot() {
  try {
    showOverlay()
    setStatus('Memuat engine...', 'Mengecek dukungan WebGL.')

    if (!BABYLON.Engine.isSupported()) {
      throw new Error('Browser tidak mendukung WebGL. Gunakan Chrome, Edge, Firefox, atau Safari versi baru.')
    }

    engine = new BABYLON.Engine(ui.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      adaptToDeviceRatio: true
    })

    scene = new BABYLON.Scene(engine)
    window.addEventListener('resize', () => engine.resize())

    try {
      await RAPIER.init()
      R = RAPIER
      rapierReady = true
      setStatus('Engine siap', 'Babylon.js aktif. Rapier aktif untuk simulasi fisika.', 'ok')
    } catch (rapierErr) {
      rapierReady = false
      setStatus('Engine siap dengan fallback', 'Babylon.js aktif. Rapier gagal dimuat, rumus fisika manual digunakan.', 'warn')
      console.warn('Rapier gagal dimuat, fallback aktif:', rapierErr)
    }

    renderButtons()
    renderParameters()
    renderLessonInfo()
    resetLesson()
    animate()
    hideOverlay()
  } catch (err) {
    console.error(err)
    setStatus('Engine gagal dimuat', err.message, 'error')
    ui.overlay.innerHTML = `
      <div class="error-box">
        <strong>Engine gagal dimuat.</strong><br />
        ${err.message}<br /><br />
        Pastikan browser mendukung WebGL dan jalankan lewat <code>npm run dev</code>, bukan membuka file HTML langsung.
      </div>
    `
  }
}

ui.playBtn.addEventListener('click', () => playSimulation())

ui.pauseBtn.addEventListener('click', () => pauseSimulation())

ui.resetBtn.addEventListener('click', () => resetLesson())

ui.zoomInBtn.addEventListener('click', () => zoomCamera('in'))

ui.zoomOutBtn.addEventListener('click', () => zoomCamera('out'))

ui.gestureBtn.addEventListener('click', () => startGestureControl())

ui.fullscreenBtn.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) {
      await ui.canvasWrap.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch (err) {
    console.warn('Fullscreen gagal:', err)
  }
})

boot()

if (!isSecureCameraContext()) {
  ui.gestureHint.textContent = 'Catatan HP: kamera tidak aktif di HTTP lokal. Deploy ke GitHub Pages HTTPS atau jalankan npm run dev:https.'
}
