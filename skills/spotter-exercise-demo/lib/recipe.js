import { seatedErgometers } from './seated-ergometer-geometry.js';
import { assistedExercises } from './assisted-exercise-geometry.js';
import { leverPulls } from './lever-pull-geometry.js';

const joints = ['hips', 'chest', 'neck', 'head', 'ls', 'le', 'lw', 'rs', 're', 'rw',
  'lh', 'lk', 'la', 'lt', 'rh', 'rk', 'ra', 'rt'];
const optionalVectors = ['lGrip', 'rGrip', 'lFingers', 'rFingers', 'lPalmSide', 'rPalmSide', 'headAim'];
const musclePattern = /^(?:(?:l|r):)?(?:lat|quad|glute|pec|core|shoulder|rearShoulder|forearm|biceps|triceps|trap|calf|hamstring|adductor|shin|neck)$/;
const cardioEquipment = [
  'rig-contact-wall', 'rig-contact-tall-wall', 'rig-suitcase-bar', 'rig-goblet-plates', 'rig-single-carry', 'rig-single-kettlebell', 'rig-pass-ball', 'rig-slam-ball', 'rig-bike', 'rig-treadmill', 'rig-run-belt', 'rig-elliptical', 'rig-stepmill', 'rig-rower', 'rig-kettles-carry', 'rig-trap-carry', 'rig-jump-rope',
];
const validEquipment = new Set([...cardioEquipment, 'none', 'mat', 'step', 'step-dumbbells', 'dumbbell', 'dumbbells',
  'mat-dumbbells', 'chest-bench-dumbbells', 'band', 'band-ankle', 'stretch-band', 'mat-stretch-band', 'high-stretch-band', 'barbell', 'trap-bar', 'bench', 'bench-barbell', 'bench-dumbbell', 'bench-dumbbells', 'neutral-pull-up', 'pull-up', 'cable', 'dual-cable', 'cable-lat-bar', 'leg-curl', 'rope', 'landmine']);
for (const preset of ['incline-bench-barbell', 'bench-ez-bar', 'cable-ankle', 'stability-ball', 'stability-ball-wall', 'standing-leg-curl', 'nordic-mat', 'hand-roller', 'wide-pull-up', 'narrow-neutral-pull-up']) {
  validEquipment.add(preset);
}

for (const preset of Object.keys(leverPulls)) validEquipment.add(preset);

for (const preset of Object.keys(assistedExercises)) validEquipment.add(preset);
for(const preset of ['assisted-low-bar','assisted-squat-bar'])validEquipment.add(preset);
validEquipment.add('hanging-arm-slings');

const smallPropPresets = {
  'spotter-med-ball': 'medicine', 'spotter-med-ball-mat': 'medicine', 'spotter-med-ball-bench': 'medicine',
  'spotter-med-ball-wall-mat': 'medicine', 'spotter-med-ball-wall-tall': 'medicine',
  'spotter-med-ball-stability': 'medicine', 'spotter-med-ball-ghd': 'medicine', 'spotter-bosu-med-ball': 'bosu-medicine',
  'spotter-massage-ball': 'massage-ball', 'spotter-massage-front-wall': 'massage-front-wall',
  'spotter-massage-rear-wall': 'massage-rear-wall', 'spotter-massage-table': 'massage-table',
  'spotter-massage-headrest': 'massage-headrest', 'spotter-massage-bench': 'massage-bench',
  'spotter-bosu': 'bosu', 'spotter-foam-roller': 'foam', 'spotter-foam-wall': 'foam-wall',
  'spotter-foam-long': 'foam-long', 'spotter-ab-wheel': 'wheel',
  'spotter-tiger-tail': 'tiger-tail', 'spotter-tiger-tail-table': 'tiger-tail-table', 'spotter-tiger-tail-bench': 'tiger-tail-bench',
  'spotter-ab-wheel-stretch-band': 'wheel-band', 'spotter-ab-wheel-wall': 'wheel-wall', 'spotter-tire-flip': 'tire',
};
for (const preset of Object.keys(smallPropPresets)) validEquipment.add(preset);
const stabilityBallPresets = new Map([['stability-ball-hug', .218], ['stability-ball-chest-stretch', .165]]);
for (const preset of stabilityBallPresets.keys()) validEquipment.add(preset);
const singleBallPresets = new Map([
  ['stability-ball-adduction', {radius: .128, mat: true}],
  ['stability-ball-handoff', {radius: .235, mat: true}],
  ['stability-ball-rollout', {radius: .285, mat: true}],
  ['stability-ball-wall-front', {radius: .285, frontWall: true}],
  ['stability-ball-bench', {radius: .285, bench: 'dip'}],
  ['stability-ball-bench-high', {radius: .285, bench: 'ball'}],
]);
for (const preset of singleBallPresets.keys()) validEquipment.add(preset);

for (const preset of seatedErgometers) validEquipment.add(preset);

const bodyweightProps = new Set([
  'extension-45', 'extension-flat', 'doorway', 'plyo-box', 'back-plate', 'assault-bike', 'incline-treadmill', 'push-up-handles',
  'parallel-dips', 'cage-dips', 'straight-dip', 'dip-bench', 'double-dip-bench', 'inverted-row', 'inverted-high-row',
  'handstand-wall', 'handstand-front-wall', 'handstand-bench-wall', 'drop-steps', 'ab-decline', 'ab-steep', 'ab-incline', 'captains-chair', 'under-bench',
  'balance-board', 'training-towel', 'slide-disc', 'fitness-rings', 'row-suspension',
  'front-suspension', 'press-suspension', 'foot-suspension', 'conditioning-line', 'conditioning-cones', 'conditioning-chair', 'conditioning-water',
  'gym-box-low','gym-box-standard','gym-box-high','gym-box-side','gym-box-rear','gym-box-stairs',
  'gym-step-patrick','gym-step-peterson','gym-step-poliquin','gym-step-bench','gym-step-chair',
  'gym-bench-flat','gym-bench-front','gym-bench-low','gym-bench-side','gym-bench-squat','gym-bench-pike','gym-bench-pike-decline',
  'gym-dip-chairs','gym-pike-chairs','gym-row-chairs','gym-row-chairs-high','gym-chair-front','gym-chair-wall','gym-triple-dip',
]);
for (const preset of bodyweightProps) validEquipment.add(preset);

const suspensionPresets = new Map([['adjustable-straps', 'handle'], ['adjustable-foot-straps', 'foot'], ['adjustable-rings', 'ring'], ['adjustable-ring-feet', 'ring-foot']]);
suspensionPresets.set('adjustable-sheet-assist','sheet');
for(const [preset, kind] of [['rings-elevated-row','ring'],['straps-elevated-weighted-row','handle'],
  ['adjustable-ring-band-stretch-band','ring'],['rings-raised-pike','ring'],
  ['mat-adjustable-foot-straps','foot'],['braced-adjustable-foot-straps','foot']])suspensionPresets.set(preset,kind);
for (const preset of suspensionPresets.keys()) validEquipment.add(preset);

const calfRails = new Map([['calf-step-rail', 'step'], ['calf-stair-rail', 'stairs']]);
for (const preset of calfRails.keys()) validEquipment.add(preset);

const bandSupports = new Map([['seat-stretch-band', 'seat'], ['high-seat-stretch-band', 'seat'], ['bench-stretch-band', 'flat'], ['post-stretch-band', 'post'], ['post-seat-stretch-band', 'post-seat'], ['mat-post-stretch-band', 'post'], ['incline-stretch-band', 'incline']]);
for (const [preset, support] of [['post-braced-stretch-band','post-brace'],['post-hinge-stretch-band','post-hinge'],
  ['braced-stretch-band','brace'],['post-chair-stretch-band','post-chair'],
  ['quad-bench-stretch-band','quad-bench'],['post-quad-bench-stretch-band','post-quad-bench'],
  ['dual-pin-mat-stretch-band','hip-pins'],['dual-pin-bench-stretch-band','hip-pins-bench'],
  ['feet-bench-mat-stretch-band','feet-bench'],['box-stretch-band','step-box'],
  ['rear-bench-stretch-band','rear-bench'],['post-rear-bench-stretch-band','post-rear-bench']]) bandSupports.set(preset,support);
const supportedBands = new Map([
  ['pull-up-stretch-band',{pullUp:'bar'}],['dip-stretch-band',{bodyweight:'parallel-dips'}],
  ['post-nordic-mat-stretch-band',{nordic:true,fixture:'post'}],
  ['nordic-mat-stretch-band',{nordic:true}],['ghd-stretch-band',{lever:'station-ghd-raise',fixture:'post'}],
  ['extension-45-stretch-band',{bodyweight:'extension-45',fixture:'base-anchors'}],
  ['decline-post-stretch-band',{bodyweight:'ab-decline',fixture:'post'}],
  ['post-mat-stretch-band',{fixture:'post'}],['post-bench-stretch-band',{fixture:'post-bench'}],
  ['ball-bench-post-stretch-band',{ball:true,fixture:'post-bench'}],
  ['assist-push-stretch-band',{fixture:'assist-push'}],
  ['band-inverted-stretch-band',{bodyweight:'inverted-high-row'}],
  ['bosu-stretch-band',{fixture:'bosu'}],['rack-stretch-band',{fixture:'overhead-rack'}],
  ['wall-stretch-band',{fixture:'wall'}],['foam-wall-stretch-band',{fixture:'wall',roller:true}],
  ['double-stretch-band',{secondary:true}],['kettle-stretch-band',{bell:true}],
  ['seat-digit-stretch-band',{fixture:'seat',digits:true}],
]);
for(const [preset,props] of supportedBands)if(props.fixture)bandSupports.set(preset,props.fixture);
for(const preset of supportedBands.keys()) validEquipment.add(preset);
for (const preset of bandSupports.keys()) validEquipment.add(preset);

const kettleSupports = new Map([
  ['kettlebells', { count: 2 }], ['kettlebell-left', { count: 1 }],
  ['mat-kettlebells', { count: 2, mat: true }], ['mat-kettlebell-left', { count: 1, mat: true }],
  ['seat-kettlebells', { count: 2, seat: true }], ['seat-kettlebell-left', { count: 1, seat: true }],
  ['bench-kettlebell-left', { count: 1, support: 'flat' }],
  ['incline-bench-kettlebells', { count: 2, support: 'incline' }],
  ['step-kettlebell-left', { count: 1, support: 'step' }],
  ['box-kettlebell-left', { count: 1, bodyweight: 'plyo-box' }],
  ['assisted-split-kettlebell-left', { count: 1, support: 'split-balance' }],
  ['kettlebell-banded-swing', { count: 1, band: 'post' }],
  ['step-banded-kettlebell-left', { count: 1, band: 'floor', support: 'step' }],
  ['wide-step-kettlebell-left', { count: 1, support: 'wide-step' }],
]);
for (const preset of kettleSupports.keys()) validEquipment.add(preset);

const leverPressProps = new Set(['lever-press-flat', 'lever-press-incline', 'lever-press-standing',
  'lever-press-fly', 'lever-press-reverse', 'lever-press-leg', 'lever-press-rotary-calf',
  'lever-press-seated-calf', 'lever-press-standing-calf', 'lever-press-hip', 'lever-press-crunch',
  'lever-press-twist', 'lever-press-reverse-hyper', 'lever-press-incline-plate',
  'lever-press-flat-plate', 'lever-press-incline-stack', 'lever-press-flat-stack', 'lever-press-flat-floor',
  'lever-press-fly-stack', 'lever-press-fly-pad-stack', 'lever-press-fly-incline-stack',
  'lever-press-lateral-pad-plate', 'lever-press-lateral-pad-stack',
  'lever-press-elbow-pad-stack', 'lever-press-dip-plate', 'lever-press-knee-stack', 'lever-press-knee-plate',
  'lever-press-knee-curl-stack', 'lever-press-knee-curl-plate', 'lever-press-knee-prone-plate',
  'lever-press-knee-prone-stack', 'lever-press-knee-kneeling-plate', 'lever-press-seated-calf-plate',
  'lever-press-hip-stack',
  'lever-press-station-horizontal', 'lever-press-station-angled', 'lever-press-station-outdoor',
  'lever-press-station-seat', 'lever-press-station-calf', 'lever-press-station-calf-angled', 'lever-press-station-hack-linear',
  'lever-press-station-hack-reverse', 'lever-press-station-hack-arc',
  'lever-press-station-hack-pendulum', 'lever-press-station-hack-chair', 'lever-press-station-hack-calf',
  'lever-press-station-hack-abduction', 'lever-press-station-hack-reverse-slope',
  'lever-press-station-hack-hinge', 'lever-press-station-hack-shrug',
  'lever-press-station-hack-comparison',
  'lever-press-station-ghd-sit', 'lever-press-station-ghd-extend', 'lever-press-station-ghd-raise',
  'lever-press-station-belt-basic', 'lever-press-station-belt-split',
  'lever-press-station-belt-v', 'lever-press-station-belt-straight',
  'lever-press-station-thrust-belt', 'lever-press-station-thrust-loaded-belt',
  'lever-press-station-thrust-step', 'lever-press-station-thrust-pad', 'lever-press-station-thrust-band',
  'lever-press-station-thrust-loaded-pad', 'lever-press-station-thrust-standing',
  'lever-press-station-reformer-footbar', 'lever-press-station-reformer-standing',
  'lever-press-station-reformer-hands', 'lever-press-station-reformer-feet',
  'lever-press-station-axial-coaster', 'lever-press-station-axial-swing',
  'lever-press-station-axial-seat-back', 'lever-press-station-axial-seat-back-grip',
  'lever-press-station-axial-recline-decline', 'lever-press-station-axial-recline-flat',
  'lever-press-station-axial-recline-stack', 'lever-press-station-axial-recline-legs',
  'lever-press-station-axial-seat-palms', 'lever-press-station-axial-seat-full',
  'lever-press-station-axial-seat-chest', 'lever-press-station-axial-rotation-seated',
  'lever-press-station-axial-rotation-torso', 'lever-press-station-axial-rotation-trunk',
  'lever-press-station-axial-rotation-standing',
  'lever-press-station-special-leg-hip-out', 'lever-press-station-special-leg-hip-in',
  'lever-press-station-special-leg-hip-front', 'lever-press-station-special-leg-hip-rear',
  'lever-press-station-special-leg-hip-foot', 'lever-press-station-special-leg-kneeling-rear',
  'lever-press-station-special-leg-kneeling-in', 'lever-press-station-special-leg-squat-hold',
  'lever-press-station-special-leg-prone-curl-hyper', 'lever-press-station-special-leg-stepper',
  'lever-press-station-special-leg-seated-toe', 'lever-press-station-special-leg-donkey']);
for (const preset of leverPressProps) validEquipment.add(preset);
for (const name of ['chest-band','chest-lying','chest-side','chest-outdoor','fly-incline','fly-bent',
  'fly-side','fly-lateral','fly-standing','cable-lat','cable-shoulder','cable-cross-lat','cable-rope-lat',
  'cable-out-lat','cable-triceps','neck-back','neck-left','neck-right','turned-preacher','hinge',
  'seated-shrug','unilateral-row']) {
  const preset='lever-press-station-special-upper-'+name;
  leverPressProps.add(preset);
  validEquipment.add(preset);
}

const originalRopes = new Map([
  ['battle-ropes','battle'], ['battle-pull-rope','battle-pull'], ['climb-rope','climb'],
  ['climb-pair-ropes','climb-pair'], ['stretch-rope','stretch'], ['mat-stretch-rope','stretch'],
  ['extension-towel','towel'], ['sled-pull-rope','sled'], ['truck-harness-rope','truck'],
]);
const pairedRopes = new Set(['battle', 'climb-pair']);
for (const preset of originalRopes.keys()) validEquipment.add(preset);

const stretchSupports = new Set(['adductor-step','situp-anchor']);
for (const preset of stretchSupports) validEquipment.add(preset);

for (const preset of ['rig-reclined-bike','rig-assault-treadmill','rig-elliptical-fixed']) validEquipment.add(preset);

const landmineSupports = new Map([['landmine-banded','banded'],['landmine-row-bench','row-bench'],
  ['landmine-hip-bench','hip-bench'],['landmine-lever-handle','lever-handle']]);
for(const preset of landmineSupports.keys())validEquipment.add(preset);
const trapBarPresets=new Set(['trap-bar','trap-bar-banded','trap-bar-deficit']);
for(const preset of trapBarPresets)validEquipment.add(preset);

const sledProps = new Set(['sled-press', 'sled-press-lying', 'sled-hack', 'sled-standing-calf', 'sled-smith', 'sled-horizontal',
  'sled-press-contact','sled-press-lying-contact',
  'sled-prowler-front','sled-prowler-rear','sled-prowler-rope','sled-prowler-axis','sled-prowler-harness','sled-prowler-tank']);
for (const preset of sledProps) validEquipment.add(preset);

const barbellSupports = {
  'barbell-rack': 'rack', 'barbell-pins': 'pull-pins', 'barbell-bench-pins': 'press-pins',
  'barbell-squat-rack': 'squat-rack', 'barbell-squat-pins': 'squat-pins', 'barbell-box-squat': 'squat-box',
  'barbell-decline': 'decline', 'ez-decline': 'decline', 'ez-incline': 'incline', 'ez-incline-free': 'incline-free',
  'barbell-seat': 'seat', 'ez-seat': 'seat', 'barbell-preacher': 'preacher', 'ez-preacher': 'preacher',
  'barbell-chest-bench': 'chest-bench', 'ez-chest-bench': 'chest-bench', 'barbell-chest-support-row': 'chest-row-bench',
  'barbell-onearm-bench': 'onearm-bench', 'barbell-rear-bench': 'rear-bench', 'barbell-plyo-box': 'plyo-box', 'smith-rear-bench': 'smith-rear-bench',
  'smith-rear-bench-step': 'smith-rear-bench-step',
  'barbell-low-step': 'low-step', 'barbell-seat-step': 'seat-step', 'barbell-bench-elevated-feet': 'bridge-bench',
  'smith-standing': 'smith', 'smith-flat': 'smith-flat', 'smith-decline': 'smith-decline',
  'smith-incline': 'smith-incline', 'smith-seat': 'smith-seat', 'smith-box': 'smith-box',
  'smith-low-step': 'smith-low-step', 'smith-seat-step': 'smith-seat-step',
  'barbell-arm-blaster': 'arm-blaster', 'ez-arm-blaster': 'arm-blaster',
  'ez-stability-ball': 'free', 'ez-barbell': 'free', 'ez-standing-preacher': 'standing-preacher',
  'ez-floor-band': 'floor-band', 'olympic-neutral-bar': 'free',
  'barbell-olympic-blocks': 'olympic-blocks',
  'barbell-bench-band':'free-flat--band-floor', 'barbell-bench-band-heavy':'free-flat--band-heavy',
  'barbell-bench-hanging':'free-flat--hanging', 'barbell-bench-chains':'free-flat--chains',
  'barbell-bench-hanging-kettle':'free-flat--hanging-kettle', 'barbell-bench-band-overhead':'press-pins--band-upper',
  'barbell-bench-extra':'free-flat--extra', 'barbell-bench-board-1':'free-flat--board-1',
  'barbell-bench-board-2':'free-flat--board-2', 'barbell-bench-board-3':'free-flat--board-3',
  'barbell-bands-rear-bench':'rear-bench--band-floor', 'barbell-rack-bands':'squat-rack--band-floor',
  'barbell-chains-rear-bench':'rear-bench--chains', 'barbell-bands-front':'free--band-floor',
  'barbell-hanging-squat':'free--hanging-kettle', 'barbell-chains-squat':'free--chains',
  'smith-banded-squat':'smith--band-floor', 'barbell-dead-band-overhead':'squat-rack--band-upper',
  'barbell-dead-chains':'free--chains', 'barbell-dead-band':'free--band-floor',
  'barbell-dead-chains-heavy':'free--chains-heavy', 'barbell-dead-underfoot':'floor-band',
  'barbell-hanging-overhead':'free--hanging', 'barbell-hip-band':'hip-thrust--band-hip',
  'barbell-hip-knee-band':'hip-thrust--knees', 'barbell-hip-thrust':'hip-thrust',
  'smith-hip-thrust':'smith-hip-thrust',
  'smith-prone-hyper':'smith-prone-hyper', 'smith-calf-seat':'smith-calf-seat',
  'smith-raised-front':'smith-raised-front', 'smith-raised-lateral':'smith-raised-lateral',
  'smith-side-press':'smith-side-press', 'smith-chest-row':'smith-chest-row', 'smith-wide-chair':'smith-wide-chair',
  'barbell-stability-ball':'free', 'barbell-prone-flat':'prone-flat', 'barbell-incline-free':'incline-free',
  'barbell-wrist-bench':'wrist-bench', 'barbell-fat-grip':'free--fat-grip', 'barbell-upright-seat':'upright-seat',
  'barbell-seated-rack':'upright-rack', 'barbell-shoulder-pins':'press-height-pins',
  'barbell-deficit':'deficit', 'barbell-deficit-bench':'deficit-bench', 'barbell-extra':'free--extra',
  'barbell-heel-plates':'heel-plates', 'barbell-decline-rear':'angled-rear',
  'barbell-raised-front':'raised-front', 'barbell-raised-lateral':'raised-lateral',
  'barbell-form-bench':'free-flat--comparison', 'barbell-form-standing':'free--comparison',
  'ez-form-preacher':'preacher--comparison',
  'barbell-inverted-row-rack':'pull-pins--bare',
  'barbell-seal-row-bench':'seal-row-bench', 'barbell-cambered-row-bench':'seal-row-bench--cambered',
  'barbell-rollout-bench':'rollout-bench', 'barbell-leg-raise-female':'free', 'barbell-floor-fly':'free--parallel',
  'strongman-farmers-barbells':'free--farmers', 'strongman-yoke-barbell':'free--yoke',
  'barbell-safety':'free--safety', 'barbell-safety-heels':'heel-plates--safety',
  'barbell-safety-front':'free--safety-front', 'barbell-roman-bench':'roman-bench',
  'strongman-apollons-axle':'free--apollons-axle',
  'training-assist-dowel':'free--dowel',
};
for (const preset of Object.keys(barbellSupports)) validEquipment.add(preset);
const catalogueCablePresets = {
  'cable-lat-wide': { attachment: 'wide', support: 'lat' },
  'cable-lat-straight': { attachment: 'straight', support: 'lat' },
  'cable-lat-medium': { attachment: 'medium', support: 'lat' },
  'cable-lat-pro': { attachment: 'pro', support: 'lat' },
  'cable-lat-neutral': { attachment: 'v', support: 'lat' },
  'cable-lat-neutral-wide': { attachment: 'wideNeutral', support: 'lat' },
  'cable-lat-mag': { attachment: 'mag', support: 'lat' },
  'cable-incline-v': { attachment: 'v', support: 'incline' },
  'cable-training-box': { support: 'training-box' },
  'cable-loop-stretch-band': {},
  'cable-twin-long-bar': { dual: true, straightSpan: true },
  'cable-hanging-ankles': { dual: true, ankle: 'hanging', pullUp: 'bar' },
  'cable-incline-ankle': { ankle: 'incline' },
  'cable-foot-strap': { ankle: 'foot' },
  'cable-seated-ankle': { ankle: 'seated' },
  'cable-head-harness': { headHarness: true, support: 'chair' },
  'cable-chair': { support: 'chair' },
  'cable-seated-medium': { attachment: 'medium', support: 'seat' },
  'cable-seated-parallel': { attachment: 'wideNeutral', support: 'seat' },
  'cable-wide-bar': { attachment: 'wide' },
  'cable-waist-belt': { waistBelt: true },
  'cable-bosu-dual': { support: 'bosu', dual: true },
  'cable-incline-rope': { rope: true, support: 'incline' },
  'cable-preacher-kneel': { support: 'low-preacher' },
  'cable-seated-single-rope': { rope: true, singleRope: true, support: 'seat' },
  'cable-flat-bench-v': { attachment: 'v', support: 'flat' },
  'cable-flat-bench-single': { support: 'flat' },
  'cable-mat': { mat: true },
  'cable-mat-medium': { attachment: 'medium', mat: true },
  'cable-mat-ez': { attachment: 'ez', mat: true },
  'cable-ankle-mat-dual': { ankle: 'floor', dual: true },
  'cable-chest-single': { support: 'chest-incline' },
  'cable-chest-wrist': { support: 'chest-incline', wristCuff: true },
  'cable-chest-dual-wrist': { support: 'chest-incline', wristCuff: true, dual: true },
  'cable-lat-narrow': { attachment: 'narrow', support: 'lat' },
  'cable-lat-rope': { rope: true, support: 'lat' },
  'cable-lat-dual': { dual: true, support: 'lat' },
  'cable-straight-bar': { attachment: 'straight' },
  'cable-short-bar': { attachment: 'narrow' },
  'cable-ez-bar': { attachment: 'ez' },
  'cable-arm-blaster-ez': { attachment: 'ez', armBlaster: true },
  'cable-arm-blaster-v': { attachment: 'pressV', armBlaster: true },
  'cable-single-rope': { rope: true, singleRope: true },
  'cable-brace-rope': { rope: true, singleRope: true, brace: true },
  'cable-brace': { brace: true },
  'cable-one-arm-bench': { support: 'one-arm-bench' },
  'cable-one-arm-bench-rope': { rope: true, singleRope: true, support: 'one-arm-bench' },
  'cable-incline-single': { support: 'incline' },
  'cable-seated-ez': { attachment: 'ez', support: 'seat' },
  'cable-preacher-single': { support: 'preacher' },
  'cable-preacher-single-rope': { rope: true, singleRope: true, support: 'preacher' },
  'cable-decline-press': { support: 'decline-press', dual: true },
  'cable-decline-single-press': { support: 'decline-press' },
  'cable-ball-dual': { support: 'ball', dual: true },
  'cable-incline-short': { attachment: 'narrow', support: 'incline' },
  'cable-incline-medium': { attachment: 'medium', support: 'incline' },
  'cable-medium-bar': { attachment: 'medium' },
  'cable-v-bar': { attachment: 'v' },
  'cable-v-press-bar': { attachment: 'pressV' },
  'cable-seated': { support: 'seat' },
  'cable-seated-bar': { attachment: 'straight', support: 'seat' },
  'cable-seated-short-bar': { attachment: 'narrow', support: 'seat' },
  'cable-seated-v': { attachment: 'v', support: 'seat' },
  'cable-seated-rope': { rope: true, support: 'seat' },
  'cable-seated-dual': { dual: true, support: 'seat' },
  'cable-seat-ball': { support: 'ball' },
  'cable-ball-bar': { support: 'ball', attachment: 'medium' },
  'cable-row-bar': { attachment: 'straight', support: 'row' },
  'cable-row-v': { attachment: 'v', support: 'row' },
  'cable-row-wide': { attachment: 'wide', support: 'row' },
  'cable-row-rope': { rope: true, support: 'row' },
  'cable-elevated-row': { rope: true, support: 'high-row' },
  'cable-decline-row': { attachment: 'wide', support: 'decline-row' },
  'cable-floor-row': { attachment: 'wide', support: 'floor-row' },
  'cable-flat-bench': { dual: true, support: 'flat' },
  'cable-mat-short': { attachment: 'narrow', mat: true },
  'cable-flat-bench-short': { attachment: 'narrow', support: 'flat' },
  'cable-flat-bench-medium': { attachment: 'medium', support: 'flat' },
  'cable-flat-bench-rope': { rope: true, support: 'flat' },
  'cable-decline-bench': { support: 'decline' },
  'cable-incline-bench': { dual: true, support: 'incline' },
  'cable-supported-row': { dual: true, support: 'chest-incline' },
  'cable-supported-rope-row': { rope: true, support: 'chest-incline' },
  'cable-preacher-bar': { attachment: 'straight', support: 'preacher' },
  'cable-preacher-rope': { rope: true, support: 'preacher' },
  'cable-standing-preacher': { support: 'standing-preacher' },
  'cable-calf-step': { support: 'step' },
  'cable-ankle-extension': { ankle: 'extension' },
  'cable-ankle-floor': { ankle: 'floor' },
  'cable-ankle-flat-bench': { ankle: 'bench', dual: true },
  'cable-step-grip': { support: 'step-up' },
  'cable-side-step-grip': { support: 'step-up-lateral' },
  'cable-box-grip': { support: 'step-up-box' },
  'cable-ankle-tuck': { ankle: 'tuck' },
};
for (const preset of Object.keys(catalogueCablePresets)) validEquipment.add(preset);
const dumbbellSupports = new Map([
  ['bench', 'flat'], ['long-bench', 'long-flat'], ['bench-kneeling-mat', 'kneeling-mat'],
  ['mat-round', 'floor-mat'],
  ['incline-30-bench', 'incline-30'], ['incline-70-bench', 'incline-70'],
  ['split-rail', 'split-balance'], ['offset-bench', 'offset-bench'], ['split-deficit', 'split-deficit'],
  ['split-twin-steps', 'split-twin-steps'], ['bench-side', 'side-bench'], ['squat-plates', 'squat-plates'],
  ['bosu-front', 'bosu-front'], ['wide-step', 'wide-step'], ['calf-wall', 'calf-wall'],
  ['split-rear-step', 'split-rear-step'], ['assisted-calf-dumbbell', 'calf-ground-weight'],
  ['circus', 'circus-weight'],
  ['bench-band', 'flat'], ['bench-hip-band', 'flat'], ['wall-band', 'wall'],
  ['elevated-bench', 'elevated-flat'], ['bosu-seat', 'bosu-seat'], ['wide-bench-dip', 'wide-bench-dip'],
  ['extension-45', 'extension-45'], ['decline-split-bench', 'decline-split'],
  ['front-wall-row', 'front-wall-row'], ['side-bench-pair', 'side-bench-pair'], ['supported-squat', 'calf-bracket'],
  ['bench-hanging-band', 'flat'], ['bench-chain-fly', 'flat'],
  ['chest-bench', 'chest'], ['incline-bench', 'incline'],
  ['decline-bench', 'decline'], ['preacher-bench', 'preacher'],
  ['upright-bench', 'upright'], ['stability-ball', 'ball'], ['arm-blaster', 'blaster'],
  ['incline-ball', 'incline-ball'], ['mat', 'floor-mat'], ['step', 'step'], ['wall', 'wall'],
  ['wrist-bench', 'wrist'], ['seat-step', 'seat-step'], ['step-brace', 'step-brace'],
  ['rear-step', 'rear-step'], ['wall-ball', 'wall-ball'], ['wall-ball-knees', 'wall-ball-knees'],
  ['wall-ball-ankles', 'wall-ball-ankles'], ['raise-brace', 'raise-brace'], ['head-brace', 'head-brace'],
]);
for (const prefix of dumbbellSupports.keys()) {
  validEquipment.add(prefix + '-dumbbell');
  validEquipment.add(prefix + '-dumbbells');
}
const handHeldProps = new Map([
  ['bottle', {kind:'bottle', count:1}], ['bottles', {kind:'bottle', count:2}],
  ['mat-bottle', {kind:'bottle', count:1, support:'floor-mat'}],
  ['mat-bottles', {kind:'bottle', count:2, support:'floor-mat'}],
  ['bench-bottle', {kind:'bottle', count:1, support:'flat'}],
  ['plate', {kind:'plate', count:1}], ['plates', {kind:'plate', count:2}],
  ['mat-plate', {kind:'plate', count:1, support:'floor-mat'}],
  ['bench-plate', {kind:'plate', count:1, support:'flat'}],
  ['long-bench-plate', {kind:'plate', count:1, support:'long-flat'}],
  ['incline-bench-plate', {kind:'plate', count:1, support:'incline'}],
  ['stability-ball-plate', {kind:'plate', count:1, support:'ball'}],
  ['wall-ball-plate', {kind:'plate', count:1, support:'wall-ball'}],
  ['extension-plate', {kind:'plate', count:1, bodyweight:'extension-45'}],
  ['decline-ab-plate', {kind:'plate', count:1, bodyweight:'ab-decline'}],
  ['dip-bench-plate', {kind:'plate', count:1, bodyweight:'dip-bench'}],
  ['straps-elevated-weighted-row', {kind:'plate', count:1}],
  ['inverted-row-plate', {kind:'plate', count:1, bodyweight:'inverted-row'}],
  ['sandbag', {kind:'sandbag', count:1}],
  ['triple-dip-plate', {kind:'plate',count:1,support:'triple-dip'}],
  ['heel-step-plate', {kind:'plate',count:1,support:'squat-plates'}],
  ['upright-brace-plate', {kind:'plate',count:1,support:'upright'}],
  ['bosu-ankle-plate', {kind:'plate',count:1,support:'flat'}],
]);
for (const preset of handHeldProps.keys()) validEquipment.add(preset);
const wearableWeights = {
  'weighted-backpack': { weight: 'backpack' },
  'mat-weight-vest': { weight: 'vest', mat: true },
  'vest-pull-up': { weight: 'vest', pullUp: 'bar' },
  'weight-belt-pull-up': { weight: 'belt', pullUp: 'bar' },
  'weight-belt-straight-dip': { weight: 'belt', bodyweight: 'straight-dip' },
  'weight-belt-parallel-dips': { weight: 'belt', bodyweight: 'parallel-dips' },
  'mat-ankle-weight-left': { weight: 'ankle-left', mat: true },
  'bench-ankle-weight-left': { weight: 'ankle-left', bench: true },
  'bench-head-harness': { weight: 'head-harness', bench:true },
  'long-bench-head-harness': { weight:'head-harness',support:'long-flat' },
  'standing-head-harness': { weight: 'head-harness' },
  'captains-chair-ankle-weights': { weight: 'ankles', bodyweight: 'captains-chair' },
  'pull-up-dumbbell': { pullUp: 'bar', bells: 1 },
  'weight-belt-cage-pull-up': { weight:'belt',pullUp:'bar',bodyweight:'parallel-dips' },
  'weight-belt-cage-neutral': { weight:'belt',pullUp:'neutral',bodyweight:'parallel-dips' },
  'weight-belt-calf-rail': { weight:'belt',calfRail:'step' },
  'weight-belt-rings': { weight:'belt',suspension:'ring' },
  'weighted-vibration-station': { variation:'vibration' },
};
for (const preset of Object.keys(wearableWeights)) validEquipment.add(preset);
const specialtyWeights = new Set(['hand-spring','wrist-roller-pronated','wrist-roller-neutral',
  'car-flip','conan-wheel','wheelbarrow','platform-squat','power-stairs','stones','platform-load','stone-press']);
for(const preset of specialtyWeights)validEquipment.add('weighted-'+preset);
const stoneWeights = new Set(['power-stairs','stones','platform-load','stone-press']);
const strongmanProps = new Map(['mace','sledge-training','training-stick','mas-board','log','keg','height-weight','atlas',
  'iron','shield','fingal','hercules','cross-weights','timber','viking'].map(prop=>['spotter-strongman-'+prop,prop]));
for(const preset of strongmanProps.keys())validEquipment.add(preset);
const strongmanBallProps = new Set(['keg','height-weight','atlas']);
const strongmanStickProps = new Set(['mace','sledge-training','training-stick','mas-board']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function number(value, min, max, label) {
  assert(Number.isFinite(value) && value >= min && value <= max, `${label}: expected a number from ${min} to ${max}.`);
  return value;
}

function vector(value, label) {
  assert(Array.isArray(value) && value.length === 3, `${label}: expected [x, y, z].`);
  return value.map((coordinate) => number(coordinate, -4, 4, label));
}

function axis(value, label) {
  const direction = vector(value, label);
  assert(Math.hypot(...direction) >= .01, `${label}: grip direction is too short.`);
  return direction;
}

const equal = (a, b) => a.every((value, index) => value === b[index]);
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const mix = (a, b, weight) => a + (b - a) * weight;
const blend = (a, b, weight) => a.map((value, index) => mix(value, b[index], weight));

function bodyPose(frame, index) {
  const pose = Object.fromEntries(joints.map((joint) => [joint, vector(frame[joint], joint)]));
  for (const [start, end, min, max] of [['lh', 'rh', .11, .38], ['ls', 'rs', .24, .57],
    ['hips', 'neck', .42, .75], ['ls', 'le', .13, .40], ['rs', 're', .13, .40],
    ['le', 'lw', .20, .52], ['re', 'rw', .20, .52], ['lh', 'lk', .29, .53], ['rh', 'rk', .29, .53],
    ['lk', 'la', .29, .53], ['rk', 'ra', .29, .53], ['la', 'lt', .06, .25], ['ra', 'rt', .06, .25]]) {
    number(distance(pose[start], pose[end]), min, max, `frame ${index + 1}: ${start}–${end} length (m)`);
  }
  for (const key of optionalVectors) {
    if (frame[key] != null) pose[key] = axis(frame[key], key);
  }
  for (const key of ['lFingerCurl', 'rFingerCurl', 'lFingerSpread', 'rFingerSpread', 'lThumbExtend', 'rThumbExtend']) {
    if (frame[key] != null) pose[key] = number(frame[key], 0, 1, 'finger curl');
  }
  pose.planted = {};
  for (const side of ['l', 'r']) {
    if (frame.planted?.[side] != null) {
      pose.planted[side] = number(frame.planted[side], 0, 1.25, 'support surface height');
    }
  }
  pose.headDrop = number(frame.headDrop ?? 0, -.09, .09, 'headDrop');
  pose.headTurn = number(frame.headTurn ?? 0, -1.32, 1.32, 'headTurn');
  return pose;
}

function blendBody(a, b, weight) {
  const pose = Object.fromEntries(joints.map((joint) => [joint, blend(a[joint], b[joint], weight)]));
  for (const key of optionalVectors) {
    if (a[key] && b[key]) pose[key] = blend(a[key], b[key], weight);
  }
  for (const key of ['lFingerCurl', 'rFingerCurl', 'lFingerSpread', 'rFingerSpread', 'lThumbExtend', 'rThumbExtend']) {
    if (a[key] != null && b[key] != null) pose[key] = mix(a[key], b[key], weight);
  }
  pose.planted = {};
  for (const side of ['l', 'r']) {
    if (a.planted[side] === b.planted[side]) pose.planted[side] = a.planted[side];
  }
  pose.headDrop = mix(a.headDrop, b.headDrop, weight);
  pose.headTurn = mix(a.headTurn, b.headTurn, weight);
  return pose;
}

export function prepareRecipe(input) {
  assert(input?.version === 1, 'Use recipe version 1.');
  const durationMs = number(input.durationMs, 1200, 6500, 'durationMs');
  const equipment = input.equipment ?? 'none';
  assert(validEquipment.has(equipment), 'Unknown equipment preset.');
  const catalogueCable = Object.hasOwn(catalogueCablePresets, equipment) ? catalogueCablePresets[equipment] : undefined;
  const handHeld = handHeldProps.get(equipment);
  const wearable = Object.hasOwn(wearableWeights, equipment) ? wearableWeights[equipment] : undefined;
  const dumbbellSupport = dumbbellSupports.get(equipment.replace(/-dumbbells?$/, ''));
  const dumbbellAccessory = handHeld?.support ?? kettleSupports.get(equipment)?.support ?? wearable?.support ??
    ((equipment.endsWith('-dumbbell') || equipment.endsWith('-dumbbells')) ? dumbbellSupport : undefined);
  const catalogueSmallProp = smallPropPresets[equipment];
  const supportedBand = supportedBands.get(equipment);
  const options = {
    strongmanProp: strongmanProps.get(equipment),
    specialtyWeight: specialtyWeights.has(equipment.slice(9)) && equipment.startsWith('weighted-') ? equipment.slice(9) : undefined,
    catalogueSmallProp,
    seatedErgometer: seatedErgometers.has(equipment) ? equipment : undefined,
    assistedExercise: Object.hasOwn(assistedExercises, equipment) ? equipment : undefined,
    leverPull: Object.hasOwn(leverPulls, equipment) ? equipment : undefined,
    pikeSuspensionDeck: equipment==='rings-raised-pike',
    suspensionBrace: equipment==='braced-adjustable-foot-straps',
    elevatedSuspensionBench: equipment==='rings-elevated-row'||equipment==='straps-elevated-weighted-row',
    bodyweightProp: supportedBand?.bodyweight ?? wearable?.bodyweight ?? handHeld?.bodyweight ?? kettleSupports.get(equipment)?.bodyweight ??
      (equipment === 'spotter-med-ball-ghd' ? 'extension-flat' : undefined) ??
      (dumbbellAccessory === 'extension-45' ? 'extension-45' : undefined) ??
      (bodyweightProps.has(equipment) ? equipment : undefined),
    wearableWeight: wearable?.weight,
    suspensionRig: wearable?.suspension ?? suspensionPresets.get(equipment),
    bandSupport: bandSupports.get(equipment),
    secondaryBand: supportedBand?.secondary === true,
    fingerBand: supportedBand?.digits === true,
    kettleSupport: kettleSupports.get(equipment),
    leverPressProp: supportedBand?.lever ?? (leverPressProps.has(equipment) ? equipment.slice(12) : undefined),
    ropeProp: originalRopes.get(equipment),
    stretchSupport: stretchSupports.has(equipment) ? equipment : undefined,
    sledProp: sledProps.has(equipment) ? equipment.slice(5) : undefined,
    barbellSupport: barbellSupports[equipment],
    secondBarbell: equipment === 'barbell-floor-fly' || equipment === 'strongman-farmers-barbells',
    femaleAvatar: equipment === 'barbell-leg-raise-female',
    handHeldProp: handHeld?.kind,
    bells: handHeld?.count ?? wearable?.bells ?? (dumbbellSupport && dumbbellAccessory ? (equipment.endsWith('dumbbells') ? 2 : 1)
      : ({dumbbell: 1, dumbbells: 2, 'step-dumbbells': 2, 'mat-dumbbells': 2})[equipment] ?? 0),
    catalogueCable,
    cableCount: catalogueCable ? (catalogueCable.dual || (catalogueCable.rope && !catalogueCable.singleRope) || catalogueCable.ankle === 'tuck' ? 2 : 1)
      : ({cable: 1, 'cable-lat-bar': 1, 'cable-ankle': 1, 'dual-cable': 2, rope: 2})[equipment] ?? 0,
    indoorBike: equipment === 'rig-bike',
    reclinedBike: equipment === 'rig-reclined-bike',
    treadmill: equipment === 'rig-treadmill' || equipment === 'rig-run-belt',
    assaultTreadmill: equipment === 'rig-assault-treadmill',
    runningClip: equipment === 'rig-run-belt',
    elliptical: equipment === 'rig-elliptical' || equipment === 'rig-elliptical-fixed',
    ellipticalFixed: equipment === 'rig-elliptical-fixed',
    stepmill: equipment === 'rig-stepmill',
    rower: equipment === 'rig-rower',
    carryKettles: equipment === 'rig-kettles-carry' || equipment === 'rig-single-carry',
    singleCarry: equipment === 'rig-single-carry',
    trapCarry: equipment === 'rig-trap-carry',
    jumpRope: equipment === 'rig-jump-rope',
    projectile: equipment === 'rig-pass-ball' || equipment === 'rig-slam-ball' || catalogueSmallProp === 'medicine' || catalogueSmallProp === 'bosu-medicine' || catalogueSmallProp?.startsWith('massage') === true,
    massageBall: catalogueSmallProp?.startsWith('massage') ? catalogueSmallProp : undefined,
    targetWall: equipment === 'rig-pass-ball' || equipment === 'spotter-med-ball-wall-mat' || equipment === 'spotter-med-ball-wall-tall',
    tallTargetWall: equipment === 'spotter-med-ball-wall-tall',
    singleKettlebell: supportedBand?.bell === true || equipment === 'rig-single-kettlebell' || equipment === 'rig-goblet-plates',
    heelPlates: equipment === 'rig-goblet-plates',
    contactWall: equipment === 'rig-contact-wall' || equipment === 'rig-contact-tall-wall',
    tallContactWall: equipment === 'rig-contact-tall-wall',
    suitcaseBar: equipment === 'rig-suitcase-bar',
    rope: equipment === 'rope' || catalogueCable?.rope === true,
    band: equipment === 'band' || equipment === 'band-ankle',
    ankleCuff: equipment === 'band-ankle',
    bench: wearable?.bench === true || ['bench', 'bench-barbell', 'bench-ez-bar', 'spotter-med-ball-bench', 'spotter-massage-bench',
      'spotter-tiger-tail-bench', 'weighted-hand-spring'].includes(equipment) || ['flat', 'wrist', 'seat-step'].includes(dumbbellAccessory),
    chestBench: dumbbellAccessory === 'chest',
    dumbbellAccessory,
    roundDumbbell: equipment === 'mat-round-dumbbells',
    circusDumbbell: equipment === 'circus-dumbbell',
    hangingDumbbellBand: equipment === 'bench-hanging-band-dumbbell',
    dumbbellChains: equipment === 'bench-chain-fly-dumbbells',
    inclineBench: equipment === 'incline-bench-barbell',
    barbell: Boolean(barbellSupports[equipment]) || ['barbell', 'bench-barbell', 'incline-bench-barbell', 'bench-ez-bar'].includes(equipment),
    ezBar: equipment === 'bench-ez-bar' || equipment.startsWith('ez-'),
    neutralCurlBar: equipment === 'olympic-neutral-bar',
    trapBar: trapBarPresets.has(equipment),
    trapBarDeficit: equipment==='trap-bar-deficit',
    trapBarBanded: equipment==='trap-bar-banded',
    stretchBand: equipment.endsWith('stretch-band') || Boolean(kettleSupports.get(equipment)?.band) ||
      ['bench-band-dumbbells','bench-hip-band-dumbbell','wall-band-dumbbell','wall-band-dumbbells'].includes(equipment),
    highMount: equipment === 'high-stretch-band' || equipment === 'high-seat-stretch-band',
    pullUp: supportedBand?.pullUp ?? catalogueCable?.pullUp ?? wearable?.pullUp ?? ({ 'neutral-pull-up': 'neutral',
      'narrow-neutral-pull-up': 'narrow-neutral', 'pull-up': 'bar', 'wide-pull-up': 'wide',
      'assisted-low-bar':'assisted-low','assisted-squat-bar':'assisted-squat','hanging-arm-slings':'bar' })[equipment],
    armSlings: equipment === 'hanging-arm-slings',
    latBar: equipment === 'cable-lat-bar',
    cableAnkle: equipment === 'cable-ankle' || Boolean(catalogueCable?.ankle),
    legCurl: equipment === 'leg-curl' || equipment === 'standing-leg-curl',
    standingLegCurl: equipment === 'standing-leg-curl',
    stabilityBallWall: equipment === 'stability-ball-wall',
    singleBall: singleBallPresets.get(equipment),
    secondaryBallRadius: equipment === 'spotter-med-ball-stability' ? .285 : stabilityBallPresets.get(equipment),
    ezBallSupport: equipment === 'ez-stability-ball',
    stabilityBall: supportedBand?.ball === true || ['stability-ball', 'stability-ball-wall', 'ez-stability-ball', 'barbell-stability-ball'].includes(equipment) || stabilityBallPresets.has(equipment) || singleBallPresets.has(equipment) ||
      ['ball', 'incline-ball', 'wall-ball', 'wall-ball-knees', 'wall-ball-ankles'].includes(dumbbellAccessory) || catalogueCable?.support === 'ball',
    nordicAnchor: supportedBand?.nordic === true || equipment === 'nordic-mat',
    handRoller: supportedBand?.roller === true || equipment === 'hand-roller' || strongmanStickProps.has(strongmanProps.get(equipment)) || catalogueSmallProp?.startsWith('tiger-tail') === true ||
      ['foam', 'foam-wall', 'foam-long', 'wheel', 'wheel-band', 'wheel-wall'].includes(catalogueSmallProp),
    landmine: equipment === 'landmine' || landmineSupports.has(equipment),
    landmineSupport: landmineSupports.get(equipment),
    mat: equipment==='mat-adjustable-foot-straps' || equipment.includes('-mat-stretch-band') || wearable?.mat === true || dumbbellAccessory === 'floor-mat' || catalogueCable?.mat === true || ['mat', 'mat-stretch-rope', 'mat-stretch-band', 'mat-post-stretch-band', 'nordic-mat', 'stability-ball', 'stability-ball-wall',
      'spotter-med-ball-mat', 'spotter-med-ball-wall-mat', 'spotter-massage-ball', 'spotter-massage-headrest',
      'spotter-foam-roller', 'spotter-foam-long', 'spotter-tiger-tail', 'spotter-ab-wheel-stretch-band'].includes(equipment),
    step: equipment === 'step' || equipment === 'step-dumbbells' || dumbbellAccessory === 'step' || calfRails.has(equipment) || Boolean(wearable?.calfRail),
    lowStep: equipment === 'step-dumbbells',
    calfRail: wearable?.calfRail ?? calfRails.get(equipment),
    vibrationStation: wearable?.variation === 'vibration',
  };
  const muscles = input.muscles ?? [];
  assert(Array.isArray(muscles) && muscles.length <= 12 &&
    muscles.every((item) => typeof item === 'string' && musclePattern.test(item)), 'Unknown muscle highlight.');
  const source = input.keyframes;
  assert(Array.isArray(source) && source.length >= 3 && source.length <= 65, 'Use 3–65 ordered keyframes.');
  assert(source[0]?.at === 0 && source.at(-1)?.at === 1, 'First and last keyframes must be at 0 and 1.');
  const partner = source[0].partner != null;
  const formComparison = input.formComparison ?? false;
  assert(typeof formComparison === 'boolean' && (!formComparison || partner), 'A form comparison requires two athletes.');
  const pairedSled = options.leverPressProp === 'station-hack-comparison';
  const pairedDumbbells = formComparison && options.bells > 0;
  const pairedBarbell = options.barbellSupport?.endsWith('--comparison') === true;
  const comparisonGear = pairedSled || pairedDumbbells || pairedBarbell || (formComparison && options.bodyweightProp === 'dip-bench');
  assert(!comparisonGear || formComparison, 'Paired equipment requires a form comparison.');
  const barbellPoints = (barbell) => ({center: vector(barbell?.center, 'barbell center'), axis: axis(barbell?.axis, 'barbell axis')});
  function leverPoints(frame,initial) {
    const handles=frame.leverPressHandles;
    assert(Array.isArray(handles)&&handles.length===2,'Lever press requires two machine arms.');
    return handles.map((handle,index)=>{
      const pivot=vector(handle?.pivot,'lever arm pivot');
      assert(equal(pivot,initial.leverPressHandles[index].pivot),'The lever arm pivot must stay fixed.');
      return {pivot,point:vector(handle.point,'lever arm grip'),axis:axis(handle.axis,'lever grip alignment')};
    });
  }
  const frames = source.map((frame, index) => {
    assert(frame && typeof frame === 'object', 'Invalid keyframe.');
    const at = number(frame.at, 0, 1, 'keyframe.at');
    assert(index === 0 || at > source[index - 1].at, 'Keyframe times must strictly increase.');
    const pose = bodyPose(frame, index);
    assert((frame.partner != null) === partner, 'Keep the same number of athletes in every keyframe.');
    if (partner) pose.partner = bodyPose(frame.partner, index);
    if (options.singleKettlebell) {
      pose.bellCenter = vector(frame.bellCenter, 'bellCenter');
      pose.bellTilt = number(frame.bellTilt ?? 0, -2, 2, 'bellTilt');
    }
    if (options.projectile || options.stabilityBall || stoneWeights.has(options.specialtyWeight) || strongmanBallProps.has(options.strongmanProp)) pose.ballCenter = vector(frame.ballCenter, 'ballCenter');
    if (options.secondaryBallRadius) pose.secondaryBallCenter = vector(frame.secondaryBallCenter, 'second stability ball center');
    if (catalogueSmallProp === 'tire') {
      pose.tireCenter = vector(frame.tireCenter, 'tire center');
      pose.tireAngle = number(frame.tireAngle, 0, Math.PI, 'tire angle');
    }
    if (dumbbellAccessory === 'wall-ball-knees' || dumbbellAccessory === 'wall-ball-ankles') {
      pose.tennisBall = vector(frame.tennisBall, 'tennis ball center');
    }
    pose.machineTravel = number(frame.machineTravel ?? 0, 0, 12, 'machineTravel');
    pose.followZ = number(frame.followZ ?? 0, -2, 2, 'followZ');
    if (options.kettleSupport) {
      const weights = frame.kettlebells;
      assert(Array.isArray(weights) && weights.length === options.kettleSupport.count, 'Match kettlebells to the equipment preset.');
      pose.kettlebells = weights.map(weight => ({
        grip: vector(weight?.grip, 'kettlebell grip'), handle: axis(weight?.handle, 'kettlebell handle alignment'),
        down: axis(weight?.down, 'kettlebell body direction'),
      }));
    }
    if(options.leverPressProp)pose.leverPressHandles=leverPoints(frame,source[0]);
    if(pairedSled)pose.partner.leverPressHandles=leverPoints(frame.partner,source[0].partner);
    if (options.suspensionRig) {
      const links = frame.straps;
      const initial = source[0].straps;
      assert(Array.isArray(initial), 'Missing suspension setup.');
      const feet = options.suspensionRig.endsWith('foot');
      assert(Array.isArray(links) && links.length >= 1 && links.length <= 2 && links.length === initial.length,
        'Use one or two fixed suspension links.');
      assert(new Set(links.map((link) => link.side)).size === links.length, 'Use one suspension link per limb.');
      pose.straps = links.map(({ anchor, side, end: endpoint, axis: shaft }, index) => {
        assert((side === 'l' || side === 'r') && side === initial[index].side, 'Use the same straps throughout the exercise.');
        anchor = vector(anchor, 'strap anchor');
        number(anchor[1], 1.8, 3.0, 'suspension anchor height');
        assert(equal(anchor, initial[index].anchor) && anchor[1] === initial[0].anchor[1] &&
          anchor[2] === initial[0].anchor[2], 'Strap anchors must stay fixed on one beam.');
        const end = vector(endpoint, 'strap attachment');
        number(distance(pose[side + (feet ? 'a' : 'w')], end), 0, feet ? .105 : .005, 'strap contact gap');
        number(distance(anchor, end), .30, 2.9, 'strap length');
        assert(Math.abs(distance(anchor, end) - distance(anchor, initial[index].end)) <= .014,
          'Suspension straps cannot lengthen through the movement.');
        return { anchor, side, end, axis: axis(shaft, 'suspension handle axis') };
      });
    }
    if (options.ropeProp) {
      const tracks = frame.ropeTracks;
      assert(Array.isArray(tracks) && tracks.length === (pairedRopes.has(options.ropeProp) ? 2 : 1),
        'Match rope tracks to the equipment preset.');
      pose.ropeTracks = tracks.map((path,index) => {
        assert(Array.isArray(path) && path.length >= 2 && path.length <= 30 &&
          path.length === source[0].ropeTracks[index].length, 'Use matching rope paths of 2–30 points.');
        return path.map((point) => vector(point, 'rope point'));
      });
    }
    const bells = frame.dumbbells ?? [];
    assert(Array.isArray(bells) && bells.length === options.bells, 'Match dumbbells to the equipment preset.');
    pose.dumbbells = bells.map((bell) => ({center: vector(bell?.center, 'dumbbell center'), axis: axis(bell?.axis, 'dumbbell axis')}));
    if (pairedDumbbells) {
      const second = frame.partner.dumbbells;
      assert(Array.isArray(second) && second.length === options.bells, 'The comparison athlete needs the same dumbbells.');
      pose.partner.dumbbells = second.map((bell) => ({center: vector(bell?.center, 'dumbbell center'), axis: axis(bell?.axis, 'dumbbell axis')}));
    }
    if (options.barbell || options.trapBar) pose.barbell = barbellPoints(frame.barbell);
    if (options.secondBarbell) pose.secondBarbell=barbellPoints(frame.secondBarbell);
    if (pairedBarbell) pose.partner.barbell = barbellPoints(frame.partner.barbell);
    if (options.stretchBand) {
      const path = frame.bandPath;
      assert(Array.isArray(path) && path.length >= 2 && path.length <= 8 &&
        path.length === source[0].bandPath.length, 'Use a stable 2–8 point band path.');
      pose.bandPath = path.map((joint) => vector(joint, 'band path point'));
      if(options.secondaryBand){
        const other=frame.secondaryBandPath;
        assert(Array.isArray(other)&&other.length>=2&&other.length<=8&&
          other.length===source[0].secondaryBandPath.length,'Secondary band requires a stable 2–8 point path.');
        pose.secondaryBandPath=other.map(joint=>vector(joint,'secondary band path point'));
      }
      if (options.highMount) {
        assert(path.length === 3 && equal(path[1], source[0].bandPath[1]), 'The overhead band mount must stay fixed.');
        number(path[1][1], 1.4, 2.7, 'high band mount height');
      }
    }
    if (options.seatedErgometer === 'ergometer-arms') pose.ergometerCrank = number(frame.ergometerCrank, 0, 6*Math.PI, 'arm crank phase');
    if (options.assistedExercise) pose.assistedPadY = number(frame.assistedPadY, .05, 1.22, 'assistance pad height');
    if (options.leverPull) {
      const angles = frame.leverPullAngles;
      assert(Array.isArray(angles) && angles.length === 2, 'Use two lever angles.');
      pose.leverPullAngles = angles.map((angle) => number(angle, -Math.PI, Math.PI, 'lever pull angle'));
    }
    const cables = frame.cables ?? [];
    assert(Array.isArray(cables) && cables.length === options.cableCount, 'Match cables to the equipment preset.');
    pose.cables = cables.map((cable, cableIndex) => {
      const anchor = vector(cable?.anchor, 'cable anchor');
      number(anchor[1], .16, 2.7, 'cable anchor height');
      const firstAnchor = source[0].cables[cableIndex]?.anchor;
      assert(equal(anchor, firstAnchor), 'Cable anchors must stay fixed.');
      return {anchor, end: vector(cable.end, 'cable end'), grip: axis(cable.grip, 'cable grip'), kind: options.rope ? 'rope' : 'handle'};
    });
    if (options.rope && !catalogueCable?.singleRope) assert(equal(pose.cables[0].anchor, pose.cables[1].anchor), 'Both rope ends must use the same anchor.');
    if (options.legCurl) pose.roller = vector(frame.roller, 'leg curl roller');
    if (options.handRoller) pose.handRoller = {center: vector(frame.handRoller?.center, 'hand roller center'),
      axis: axis(frame.handRoller?.axis, 'hand roller axis')};
    if (options.band) {
      const anchor = vector(frame.band?.anchor, 'band anchor');
      number(anchor[1], .12, 2.6, 'band anchor height');
      assert(equal(anchor, source[0].band.anchor), 'Band anchor must stay fixed.');
      pose.band = {anchor, end: vector(frame.band.end, 'band end')};
    }
    if (options.landmine) {
      const pivot = vector(frame.landmine?.pivot, 'landmine pivot');
      assert(equal(pivot, source[0].landmine.pivot), 'Landmine pivot must stay fixed.');
      pose.landmine = {pivot, end: vector(frame.landmine.end, 'landmine end')};
    }
    return {at, pose};
  });
  const camera = {
    yaw: number(input.camera?.yaw ?? 38, -180, 180, 'camera.yaw'),
    elevation: number(input.camera?.elevation ?? 14, -5, 60, 'camera.elevation'),
    focus: vector(input.camera?.focus ?? [0, .93, 0], 'camera.focus'),
    height: number(input.camera?.height ?? 2.28, .9, 4.8, 'camera.height'),
  };

  function sample(phase) {
    const right = Math.max(1, frames.findIndex((frame) => frame.at >= phase));
    if (phase >= 1) return frames.at(-1).pose;
    const {at: start, pose: a} = frames[right - 1];
    const {at: end, pose: b} = frames[right];
    const weight = (phase - start) / (end - start);
    if (weight <= 0) return a;
    if (weight >= 1) return b;
    const pose = blendBody(a, b, weight);
    if (partner) pose.partner = blendBody(a.partner, b.partner, weight);
    if (options.singleKettlebell) {
      pose.bellCenter = blend(a.bellCenter, b.bellCenter, weight);
      pose.bellTilt = mix(a.bellTilt, b.bellTilt, weight);
    }
    if (options.projectile || options.stabilityBall || stoneWeights.has(options.specialtyWeight) || strongmanBallProps.has(options.strongmanProp)) pose.ballCenter = blend(a.ballCenter, b.ballCenter, weight);
    if (options.secondaryBallRadius) pose.secondaryBallCenter = blend(a.secondaryBallCenter, b.secondaryBallCenter, weight);
    if (catalogueSmallProp === 'tire') {
      pose.tireCenter = blend(a.tireCenter, b.tireCenter, weight);
      pose.tireAngle = mix(a.tireAngle, b.tireAngle, weight);
    }
    if (options.leverPull) pose.leverPullAngles = blend(a.leverPullAngles, b.leverPullAngles, weight);
    if (options.seatedErgometer === 'ergometer-arms') pose.ergometerCrank = a.ergometerCrank+(b.ergometerCrank-a.ergometerCrank)*weight;
    if (options.assistedExercise) {
      pose.assistedPadY = a.assistedPadY+(b.assistedPadY-a.assistedPadY)*weight;
      if (assistedExercises[options.assistedExercise].platform) {
        pose.planted.l = pose.assistedPadY;
        if (!assistedExercises[options.assistedExercise].singleFoot) pose.planted.r = pose.assistedPadY;
      }
    }
    if (a.tennisBall) pose.tennisBall = blend(a.tennisBall, b.tennisBall, weight);
    pose.machineTravel = mix(a.machineTravel, b.machineTravel, weight);
    pose.followZ = mix(a.followZ, b.followZ, weight);
    if (options.kettleSupport) pose.kettlebells = a.kettlebells.map((bell,index) => ({
      grip: blend(bell.grip,b.kettlebells[index].grip,weight),
      handle: blend(bell.handle,b.kettlebells[index].handle,weight),
      down: blend(bell.down,b.kettlebells[index].down,weight),
    }));
    const leverBlend=(from,to)=>from.leverPressHandles.map((handle,index)=>({
      pivot:handle.pivot,point:blend(handle.point,to.leverPressHandles[index].point,weight),
      axis:blend(handle.axis,to.leverPressHandles[index].axis,weight),
    }));
    if(options.leverPressProp)pose.leverPressHandles=leverBlend(a,b);
    if(pairedSled)pose.partner.leverPressHandles=leverBlend(a.partner,b.partner);
    if (options.suspensionRig) pose.straps = a.straps.map((link, index) => ({
      ...link, end: blend(link.end, b.straps[index].end, weight), axis: blend(link.axis, b.straps[index].axis, weight),
    }));
    if (options.ropeProp) pose.ropeTracks = a.ropeTracks.map((path,index) =>
      path.map((point,position) => blend(point,b.ropeTracks[index][position],weight)));
    pose.dumbbells = a.dumbbells.map((bell, index) => ({
      center: blend(bell.center, b.dumbbells[index].center, weight),
      axis: blend(bell.axis, b.dumbbells[index].axis, weight),
    }));
    if (pairedDumbbells) pose.partner.dumbbells = a.partner.dumbbells.map((bell,index) => ({
      center: blend(bell.center,b.partner.dumbbells[index].center,weight),
      axis: blend(bell.axis,b.partner.dumbbells[index].axis,weight),
    }));
    if (options.barbell || options.trapBar) {
      pose.barbell = {center: blend(a.barbell.center, b.barbell.center, weight), axis: blend(a.barbell.axis, b.barbell.axis, weight)};
    }
    if(options.secondBarbell){
      pose.secondBarbell={center:blend(a.secondBarbell.center,b.secondBarbell.center,weight),
        axis:blend(a.secondBarbell.axis,b.secondBarbell.axis,weight)};
    }
    if (pairedBarbell) {
      pose.partner.barbell = {center: blend(a.partner.barbell.center,b.partner.barbell.center,weight),
        axis: blend(a.partner.barbell.axis,b.partner.barbell.axis,weight)};
    }
    if (options.stretchBand) pose.bandPath = a.bandPath.map((point,index)=>blend(point,b.bandPath[index],weight));
    if (options.secondaryBand) pose.secondaryBandPath = a.secondaryBandPath.map((joint,index) => blend(joint,b.secondaryBandPath[index],weight));
    pose.cables = a.cables.map((cable, index) => ({
      ...cable,
      end: blend(cable.end, b.cables[index].end, weight),
      grip: blend(cable.grip, b.cables[index].grip, weight),
    }));
    if (options.legCurl) pose.roller = blend(a.roller, b.roller, weight);
    if (options.handRoller) pose.handRoller = {center: blend(a.handRoller.center, b.handRoller.center, weight),
      axis: blend(a.handRoller.axis, b.handRoller.axis, weight)};
    if (options.band) pose.band = {anchor: a.band.anchor, end: blend(a.band.end, b.band.end, weight)};
    if (options.landmine) pose.landmine = {pivot: a.landmine.pivot, end: blend(a.landmine.end, b.landmine.end, weight)};
    return pose;
  }

  return {durationMs, camera, muscles, partner, formComparison, comparisonGear, options, sample};
}
