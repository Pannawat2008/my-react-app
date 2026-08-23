import { useControls, folder } from 'leva';

export function useGearParams(store) {
  const [values] = useControls(
    () => {
      const config = {
        'Global Settings': folder({
          numStages: { value: 2, min: 1, max: 5, step: 1 },
          animate: true,
          gearType: { options: ['spur', 'helical', 'herringbone'] },
          helixAngle: {
            value: 20,
            min: 5,
            max: 45,
            step: 1,
            render: (get) => get('Global Settings.gearType') !== 'spur',
          },
        }),
        '3D-Print Tolerances': folder({
          backlashMm: {
            label: 'Backlash (mm)',
            value: 0.2,
            min: 0.0,
            max: 0.8,
            step: 0.05,
            hint: 'Thins gear teeth to allow smooth mesh on FDM/SLA 3D printers',
          },
          antiElephantsFoot: {
            label: "Elephant's Foot Chamfer",
            value: true,
            hint: "45° edge bevel to prevent first-layer 3D printer squish from jamming teeth",
          },
          chamferSizeMm: {
            label: 'Chamfer (mm)',
            value: 0.4,
            min: 0.1,
            max: 1.5,
            step: 0.1,
            render: (get) => get("3D-Print Tolerances.antiElephantsFoot"),
          },
        }),
      };

      for (let i = 0; i < 5; i++) {
        const p = `s${i}`;
        const showFolder = (get) => get('Global Settings.numStages') > i;

        config[`Stage ${i + 1}`] = folder(
          {
            'Gear Geometry': folder({
              [`${p}_numTeeth`]: { label: 'Teeth', value: i === 0 ? 36 : 30, min: 8, max: 200, step: 1 },
              [`${p}_module`]: { label: 'Module', value: 2.0, min: 0.5, max: 10, step: 0.01 },
              [`${p}_pressureAngle`]: { label: 'Pressure Angle', value: 20, min: 14.5, max: 30, step: 0.5 },
              [`${p}_thickness`]: { label: 'Thickness', value: 10, min: 2, max: 100, step: 1 },
              [`${p}_hasSpokes`]: { label: 'Spokes', value: true },
              [`${p}_numSpokes`]: {
                label: 'Num Spokes',
                value: 4,
                min: 2,
                max: 12,
                step: 1,
                render: (get) => get(`Stage ${i + 1}.Gear Geometry.${p}_hasSpokes`),
              },
              [`${p}_spokeWidth`]: {
                label: 'Width',
                value: 8,
                min: 2,
                max: 50,
                step: 1,
                render: (get) => get(`Stage ${i + 1}.Gear Geometry.${p}_hasSpokes`),
              },
              [`${p}_spokeChamfer`]: {
                label: 'Aero Chamfer',
                value: 2,
                min: 0,
                max: 20,
                step: 0.5,
                render: (get) => get(`Stage ${i + 1}.Gear Geometry.${p}_hasSpokes`),
              },
              [`${p}_spokePitch`]: {
                label: 'Pitch Twist',
                value: 0,
                min: -60,
                max: 60,
                step: 1,
                render: (get) => get(`Stage ${i + 1}.Gear Geometry.${p}_hasSpokes`),
              },
            }),
            'Hub & Bore': folder({
              [`${p}_hubDiameter`]: { label: 'Hub Dia', value: 25, min: 0, max: 100, step: 1 },
              [`${p}_boreType`]: { label: 'Bore Type', options: ['round', 'd-shaft', 'hex', 'keyway', 'none'] },
              [`${p}_boreDiameter`]: {
                label: 'Bore Dia',
                value: 10,
                min: 1,
                max: 100,
                step: 0.01,
                render: (get) => get(`Stage ${i + 1}.Hub & Bore.${p}_boreType`) !== 'none',
              },
              [`${p}_keywayWidth`]: {
                label: 'Keyway W',
                value: 3,
                min: 1,
                max: 20,
                step: 0.01,
                render: (get) => get(`Stage ${i + 1}.Hub & Bore.${p}_boreType`) === 'keyway',
              },
              [`${p}_keywayDepth`]: {
                label: 'Keyway D',
                value: 1.5,
                min: 0.5,
                max: 10,
                step: 0.01,
                render: (get) => get(`Stage ${i + 1}.Hub & Bore.${p}_boreType`) === 'keyway',
              },
              [`${p}_dShaftFlat`]: {
                label: 'D-Shaft Flat',
                value: 1.0,
                min: 0.1,
                max: 20,
                step: 0.01,
                render: (get) => get(`Stage ${i + 1}.Hub & Bore.${p}_boreType`) === 'd-shaft',
              },
            }),
            'Pinion': folder({
              [`${p}_hasPinion`]: { label: 'Has Pinion', value: i !== 4 },
              [`${p}_pinionTeeth`]: {
                label: 'Pinion Teeth',
                value: 10,
                min: 6,
                max: 100,
                step: 1,
                render: (get) => get(`Stage ${i + 1}.Pinion.${p}_hasPinion`),
              },
              [`${p}_pinionModule`]: {
                label: 'Pinion Mod',
                value: 2.0,
                min: 0.5,
                max: 10,
                step: 0.01,
                render: (get) => get(`Stage ${i + 1}.Pinion.${p}_hasPinion`),
              },
              [`${p}_pinionPressureAngle`]: {
                label: 'Pinion PA',
                value: 20,
                min: 14.5,
                max: 30,
                step: 0.5,
                render: (get) => get(`Stage ${i + 1}.Pinion.${p}_hasPinion`),
              },
              [`${p}_pinionThickness`]: {
                label: 'Pinion Thick',
                value: 12,
                min: 2,
                max: 100,
                step: 1,
                render: (get) => get(`Stage ${i + 1}.Pinion.${p}_hasPinion`),
              },
            }),
            'Bearing Stand': folder({
              [`${p}_hasBearingStand`]: { label: 'Bearing Stand', value: false },
              [`${p}_bearingStandDia`]: {
                label: 'Stand Dia',
                value: 30,
                min: 1,
                max: 200,
                step: 1,
                render: (get) => get(`Stage ${i + 1}.Bearing Stand.${p}_hasBearingStand`),
              },
              [`${p}_bearingStandThick`]: {
                label: 'Stand Thick',
                value: 5,
                min: 1,
                max: 50,
                step: 1,
                render: (get) => get(`Stage ${i + 1}.Bearing Stand.${p}_hasBearingStand`),
              },
              [`${p}_bearingStandBore`]: {
                label: 'Stand Bore',
                value: 15,
                min: 0,
                max: 100,
                step: 1,
                render: (get) => get(`Stage ${i + 1}.Bearing Stand.${p}_hasBearingStand`),
              },
            }),
          },
          { render: showFolder }
        );
      }
      return config;
    },
    { store }
  );

  return values;
}

/**
 * Calculates complete gear train positions, kinematics, and engineering diameters.
 */
export function computeGearStages(levaParams) {
  if (!levaParams || !levaParams.numStages) return [];

  const data = [];
  let currentX = 0;
  let currentY = 0;
  let currentZ = 0;
  let currentSpeed = 1.0;
  let currentPhase = 0;

  const backlashMm = levaParams.backlashMm !== undefined ? levaParams.backlashMm : 0.2;
  const antiElephantsFoot = levaParams.antiElephantsFoot !== undefined ? levaParams.antiElephantsFoot : true;
  const chamferSizeMm = levaParams.chamferSizeMm !== undefined ? levaParams.chamferSizeMm : 0.4;

  let totalRatioProduct = 1.0;

  for (let i = 0; i < levaParams.numStages; i++) {
    const p = `s${i}`;

    const stageParams = {
      gearType: levaParams.gearType,
      helixAngle: levaParams.helixAngle,
      backlashMm,
      antiElephantsFoot,
      chamferSizeMm,
      numTeeth: levaParams[`${p}_numTeeth`] || 30,
      module: levaParams[`${p}_module`] || 2.0,
      pressureAngle: levaParams[`${p}_pressureAngle`] || 20,
      thickness: levaParams[`${p}_thickness`] || 10,
      hasSpokes: levaParams[`${p}_hasSpokes`],
      numSpokes: levaParams[`${p}_numSpokes`],
      spokeWidth: levaParams[`${p}_spokeWidth`],
      spokeChamfer: levaParams[`${p}_spokeChamfer`],
      spokePitch: levaParams[`${p}_spokePitch`],
      hubDiameter: levaParams[`${p}_hubDiameter`],
      boreType: levaParams[`${p}_boreType`] || 'round',
      boreDiameter: levaParams[`${p}_boreType`] === 'none' ? 0 : levaParams[`${p}_boreDiameter`] || 10,
      keywayWidth: levaParams[`${p}_keywayWidth`] || 3,
      keywayDepth: levaParams[`${p}_keywayDepth`] || 1.5,
      dShaftFlat: levaParams[`${p}_dShaftFlat`] || 1.0,
      hasPinion: levaParams[`${p}_hasPinion`],
      pinionTeeth: levaParams[`${p}_pinionTeeth`] || 10,
      pinionModule: levaParams[`${p}_pinionModule`] || levaParams[`${p}_module`] || 2.0,
      pinionPressureAngle: levaParams[`${p}_pinionPressureAngle`] || levaParams[`${p}_pressureAngle`] || 20,
      pinionThickness: levaParams[`${p}_pinionThickness`] || 12,
      hasBearingStand: levaParams[`${p}_hasBearingStand`],
      bearingStandDiameter: levaParams[`${p}_bearingStandDia`],
      bearingStandThickness: levaParams[`${p}_bearingStandThick`],
      bearingStandBore: levaParams[`${p}_bearingStandBore`],
    };

    const paRad = (stageParams.pressureAngle * Math.PI) / 180;
    const rGear = (stageParams.module * stageParams.numTeeth) / 2;
    const dp = stageParams.module * stageParams.numTeeth;
    const db = dp * Math.cos(paRad);
    const da = dp + 2 * stageParams.module;
    const df = Math.max(1, dp - 2.5 * stageParams.module);

    let stageCenterDist = 0;
    let contactRatio = 1.45; // standard involute default
    let stageRatio = 1.0;

    if (i > 0) {
      const prevP = `s${i - 1}`;
      const prevPinionTeeth = levaParams[`${prevP}_pinionTeeth`] || 10;
      const prevPinionMod = levaParams[`${prevP}_pinionModule`] || stageParams.module;
      const prevRPinion = (prevPinionMod * prevPinionTeeth) / 2;
      const prevThickness = levaParams[`${prevP}_thickness`] || 10;
      const prevPinionThickness = levaParams[`${prevP}_pinionThickness`] || 12;

      stageCenterDist = prevRPinion + rGear;
      const angle = i % 2 !== 0 ? Math.PI / 6 : -Math.PI / 6;

      currentX += stageCenterDist * Math.cos(angle);
      currentY += stageCenterDist * Math.sin(angle);
      currentZ += prevThickness / 2 + prevPinionThickness / 2;

      stageRatio = stageParams.numTeeth / prevPinionTeeth;
      totalRatioProduct *= stageRatio;

      currentSpeed = currentSpeed * -(prevPinionTeeth / stageParams.numTeeth);
      currentPhase =
        currentPhase * -(prevPinionTeeth / stageParams.numTeeth) + Math.PI / stageParams.numTeeth;

      // Contact Ratio calculation: ε = (√(ra1² - rb1²) + √(ra2² - rb2²) - a*sin(α)) / (π*m*cos(α))
      const ra1 = prevRPinion + prevPinionMod;
      const rb1 = prevRPinion * Math.cos(paRad);
      const ra2 = rGear + stageParams.module;
      const rb2 = db / 2;
      const pathOfContact =
        Math.sqrt(Math.max(0, ra1 * ra1 - rb1 * rb1)) +
        Math.sqrt(Math.max(0, ra2 * ra2 - rb2 * rb2)) -
        stageCenterDist * Math.sin(paRad);
      contactRatio = Math.max(1.0, pathOfContact / (Math.PI * stageParams.module * Math.cos(paRad)));
    }

    data.push({
      params: stageParams,
      position: [currentX, currentY, currentZ],
      speedRatio: currentSpeed,
      rotationOffset: currentPhase,
      kinematics: {
        pitchDia: dp,
        baseDia: db,
        tipDia: da,
        rootDia: df,
        centerDist: stageCenterDist,
        contactRatio: parseFloat(contactRatio.toFixed(2)),
        stageRatio: parseFloat(stageRatio.toFixed(2)),
        totalRatio: parseFloat(totalRatioProduct.toFixed(2)),
      },
    });
  }

  return data;
}
