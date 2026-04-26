import { dyno } from "@sparkjsdev/spark";

const TRANSITION_SPEED = 0.01;

export class ParticleEffect {
  constructor(splat) {
    this.splat = splat;
    this._prog = dyno.dynoFloat(0.0); // 0=normal, 1=full particles
    this._time = dyno.dynoFloat(0.0);
    this.state = "normal";
    this._ready = false;

    this.params = {
      LOCAL_FREQ:               dyno.dynoFloat(0.2),
      LOCAL_TRIGGER_PROB:       dyno.dynoFloat(0.1),
      LOCAL_DIR_XZ_SCALE:       dyno.dynoFloat(0.06),
      LOCAL_HEIGHT_BASE:        dyno.dynoFloat(0.08),
      LOCAL_HEIGHT_RANGE:       dyno.dynoFloat(0.1),

      ENABLE_SHOCK:             dyno.dynoFloat(1.0),  // 1=on, 0=off
      SHOCK_INTERVAL:           dyno.dynoFloat(4.5),
      SHOCK_RANDOM_DELAY:       dyno.dynoFloat(2.0),
      SHOCK_SPEED:              dyno.dynoFloat(4.0),
      SHOCK_WIDTH_SCALE:        dyno.dynoFloat(1.5),
      SHOCK_TIME_DECAY:         dyno.dynoFloat(1.0),
      SHOCK_PUSH_XZ:            dyno.dynoFloat(0.01),
      SHOCK_PUSH_Y:             dyno.dynoFloat(0.05),
      SHOCK_CHAOS_AMP:          dyno.dynoFloat(0.02),
    };
  }

  init() {
    const prog   = this._prog;
    const tm     = this._time;
    const params = this.params;

    this.splat.objectModifier = dyno.dynoBlock(
      { gsplat: dyno.Gsplat },
      { gsplat: dyno.Gsplat },
      ({ gsplat }) => {
        const shader = new dyno.Dyno({
          inTypes: {
            gsplat:  dyno.Gsplat,
            progress: "float",
            time:     "float",

            LOCAL_FREQ:              "float",
            LOCAL_TRIGGER_PROB:      "float",
            LOCAL_DIR_XZ_SCALE:      "float",
            LOCAL_HEIGHT_BASE:       "float",
            LOCAL_HEIGHT_RANGE:      "float",

            ENABLE_SHOCK:            "float",
            SHOCK_INTERVAL:          "float",
            SHOCK_RANDOM_DELAY:      "float",
            SHOCK_SPEED:             "float",
            SHOCK_WIDTH_SCALE:       "float",
            SHOCK_TIME_DECAY:        "float",
            SHOCK_PUSH_XZ:           "float",
            SHOCK_PUSH_Y:            "float",
            SHOCK_CHAOS_AMP:         "float",
          },
          outTypes: { gsplat: dyno.Gsplat },
          globals:  () => [],

          statements: ({ inputs, outputs }) =>
            dyno.unindentLines(`
${outputs.gsplat} = ${inputs.gsplat};

float pEffect = clamp(${inputs.progress}, 0.0, 1.0);

if (pEffect > 0.0001) {

  vec3 origCenter = ${inputs.gsplat}.center;
  float t = ${inputs.time};
  float PI = 3.14159265359;

  float spatialSeed = fract(sin(dot(origCenter, vec3(12.9898, 78.233, 45.164))) * 43758.5453);

  // Random Jump
  float timeOffset   = t * ${inputs.LOCAL_FREQ} + spatialSeed;
  float currentCell  = floor(timeOffset);
  float localTime    = fract(timeOffset);

  float cellHash     = fract(sin(dot(vec2(spatialSeed, currentCell), vec2(12.9898, 78.233))) * 43758.5453);
  float isTriggered  = step(1.0 - ${inputs.LOCAL_TRIGGER_PROB}, cellHash);
  float envelope     = pow(sin(localTime * PI), 1.2);
  float activeAnim   = envelope * isTriggered;

  float dirX    = (fract(cellHash * 13.3) * 2.0 - 1.0) * ${inputs.LOCAL_DIR_XZ_SCALE};
  float dirZ    = (fract(cellHash * 27.7) * 2.0 - 1.0) * ${inputs.LOCAL_DIR_XZ_SCALE};
  float heightY = ${inputs.LOCAL_HEIGHT_BASE} + fract(cellHash * 41.1) * ${inputs.LOCAL_HEIGHT_RANGE};

  vec3 baseTraj = vec3(dirX, heightY, dirZ);

  float wobble  = sin(localTime * PI * 0.048);
  vec3 turb     = vec3(wobble * dirZ, 0.0, -wobble * dirX);

  vec3 localDisplace = (baseTraj + turb) * activeAnim;

  // wave
  vec3 finalShockDisplace = vec3(0.0);
  float shockIntensity = 0.0;

  if (${inputs.ENABLE_SHOCK} > 0.5) {
    float gCycle      = floor(t / ${inputs.SHOCK_INTERVAL});
    float gCycleTime  = fract(t / ${inputs.SHOCK_INTERVAL}) * ${inputs.SHOCK_INTERVAL};
    float gDelay      = fract(sin(gCycle * 113.3) * 43758.5453) * ${inputs.SHOCK_RANDOM_DELAY};
    float timeSinceShock = gCycleTime - gDelay;

    float distToCenter = length(origCenter.xz);
    float shockPos     = timeSinceShock * ${inputs.SHOCK_SPEED};
    float distFromWave = distToCenter - shockPos;
    float waveWidth    = distFromWave * ${inputs.SHOCK_WIDTH_SCALE};
    shockIntensity = exp(-(waveWidth * waveWidth)) * step(0.0, timeSinceShock);
    shockIntensity *= exp(-timeSinceShock * ${inputs.SHOCK_TIME_DECAY});

    vec3 pushDir = vec3(origCenter.x, 0.0, origCenter.z);
    float pushLen = length(pushDir) + 0.0001;
    pushDir /= pushLen;

    vec3 shockDisplace = (pushDir * ${inputs.SHOCK_PUSH_XZ} + vec3(0.0, ${inputs.SHOCK_PUSH_Y}, 0.0)) * shockIntensity;

    vec3 chaosJitter = vec3(
      fract(spatialSeed * t * 12.0) - 0.5,
      fract(spatialSeed * t * 15.0) - 0.5,
      fract(spatialSeed * t * 14.0) - 0.5
    ) * ${inputs.SHOCK_CHAOS_AMP} * shockIntensity;

    finalShockDisplace = shockDisplace + chaosJitter;
  }

  // apply
  vec3 finalDisplace = localDisplace + finalShockDisplace;
  ${outputs.gsplat}.center = origCenter + finalDisplace * pEffect;

  float pulseScale = 1.0 - (activeAnim * 0.3);
  float shockScale = 1.0 + (shockIntensity * 0.6);

  ${outputs.gsplat}.scales = mix(
    ${inputs.gsplat}.scales,
    vec3(0.003, 0.003, 0.003),
    pEffect
  ) * mix(1.0, pulseScale * shockScale, pEffect);
}
            `),
        });

        return {
          gsplat: shader.apply({
            gsplat,
            progress: prog,
            time:     tm,
            ...Object.fromEntries(
              Object.entries(params).map(([k, v]) => [k, v])
            ),
          }).gsplat,
        };
      },
    );

    this.splat.updateGenerator();
    this._ready = true;
  }

  toggle() {
    switch (this.state) {
      case "normal":
      case "exiting":
        this.state = "entering";
        break;
      default:
        this.state = "exiting";
    }
  }

  // 每帧更新
  // 通过state变量来判断是否进行 updateVersion() 更新
  update(timeSec) {
    if (!this._ready) return;
    this._time.value = timeSec;

    if (this.state === "entering") {
      this._prog.value = Math.min(1, this._prog.value + TRANSITION_SPEED);
      if (this._prog.value >= 1) { this._prog.value = 1; this.state = "particles"; }
    } else if (this.state === "exiting") {
      this._prog.value = Math.max(0, this._prog.value - TRANSITION_SPEED);
      if (this._prog.value <= 0) { this._prog.value = 0; this.state = "normal"; }
    }

    if (this._prog.value > 0) {
      this.splat.updateVersion();
    }
  }

  get isActive() {
    return this.state === "particles" || this.state === "entering";
  }
}
