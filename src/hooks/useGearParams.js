import { useMemo } from 'react';
import { useControls, folder } from 'leva';

export function useGearParams(store) {
  const [values] = useControls(() => {
    const config = {
      'Global Settings': folder({
        numStages: { value: 1, min: 1, max: 5, step: 1 },
        animate: false,
        gearType: { options: ['spur', 'helical', 'herringbone'] },
        helixAngle: { value: 20, min: 5, max: 45, step: 1, render: (get) => get('Global Settings.gearType') !== 'spur' },
      }),
    };
    
    for (let i = 0; i < 5; i++) {
       const p = `s${i}`;
       const showFolder = (get) => get('Global Settings.numStages') > i;
       
       config[`Stage ${i + 1}`] = folder({
         'Gear Geometry': folder({
           [`${p}_numTeeth`]: { label: 'Teeth', value: i === 0 ? 26 : 40, min: 8, max: 200, step: 1 },
           [`${p}_module`]: { label: 'Module', value: 2.5, min: 0.5, max: 10, step: 0.01 },
           [`${p}_pressureAngle`]: { label: 'Pressure Angle', value: 20, min: 14.5, max: 30, step: 0.5 },
           [`${p}_thickness`]: { label: 'Thickness', value: 10, min: 2, max: 100, step: 1 },
           [`${p}_hasSpokes`]: { label: 'Spokes', value: true },
           [`${p}_numSpokes`]: { label: 'Num Spokes', value: 4, min: 2, max: 12, step: 1, render: (get) => get(`Stage ${i+1}.Gear Geometry.${p}_hasSpokes`) },
           [`${p}_spokeWidth`]: { label: 'Width', value: 8, min: 2, max: 50, step: 1, render: (get) => get(`Stage ${i+1}.Gear Geometry.${p}_hasSpokes`) },
           [`${p}_spokeChamfer`]: { label: 'Aero Chamfer', value: 2, min: 0, max: 20, step: 0.5, render: (get) => get(`Stage ${i+1}.Gear Geometry.${p}_hasSpokes`) },
           [`${p}_spokePitch`]: { label: 'Pitch Twist', value: 0, min: -60, max: 60, step: 1, render: (get) => get(`Stage ${i+1}.Gear Geometry.${p}_hasSpokes`) },
         }),
         'Hub & Bore': folder({
           [`${p}_hubDiameter`]: { label: 'Hub Dia', value: 25, min: 0, max: 100, step: 1 },
           [`${p}_boreType`]: { label: 'Bore Type', options: ['round', 'd-shaft', 'keyway', 'none'] },
           [`${p}_boreDiameter`]: { label: 'Bore Dia', value: 10, min: 1, max: 100, step: 0.01, render: (get) => get(`Stage ${i+1}.Hub & Bore.${p}_boreType`) !== 'none' },
           [`${p}_keywayWidth`]: { label: 'Keyway W', value: 3, min: 1, max: 20, step: 0.01, render: (get) => get(`Stage ${i+1}.Hub & Bore.${p}_boreType`) === 'keyway' },
           [`${p}_keywayDepth`]: { label: 'Keyway D', value: 1.5, min: 0.5, max: 10, step: 0.01, render: (get) => get(`Stage ${i+1}.Hub & Bore.${p}_boreType`) === 'keyway' },
           [`${p}_dShaftFlat`]: { label: 'D-Shaft Flat', value: 1.0, min: 0.1, max: 20, step: 0.01, render: (get) => get(`Stage ${i+1}.Hub & Bore.${p}_boreType`) === 'd-shaft' },
         }),
         'Pinion': folder({
           [`${p}_hasPinion`]: { label: 'Has Pinion', value: i !== 4 },
           [`${p}_pinionTeeth`]: { label: 'Pinion Teeth', value: 12, min: 8, max: 100, step: 1, render: (get) => get(`Stage ${i+1}.Pinion.${p}_hasPinion`) },
           [`${p}_pinionModule`]: { label: 'Pinion Mod', value: 2.0, min: 0.5, max: 10, step: 0.01, render: (get) => get(`Stage ${i+1}.Pinion.${p}_hasPinion`) },
           [`${p}_pinionPressureAngle`]: { label: 'Pinion PA', value: 20, min: 14.5, max: 30, step: 0.5, render: (get) => get(`Stage ${i+1}.Pinion.${p}_hasPinion`) },
           [`${p}_pinionThickness`]: { label: 'Pinion Thick', value: 15, min: 2, max: 100, step: 1, render: (get) => get(`Stage ${i+1}.Pinion.${p}_hasPinion`) },
         }),
         'Bearing Stand': folder({
           [`${p}_hasBearingStand`]: { label: 'Bearing Stand', value: false },
           [`${p}_bearingStandDia`]: { label: 'Stand Dia', value: 30, min: 1, max: 200, step: 1, render: (get) => get(`Stage ${i+1}.Bearing Stand.${p}_hasBearingStand`) },
           [`${p}_bearingStandThick`]: { label: 'Stand Thick', value: 5, min: 1, max: 50, step: 1, render: (get) => get(`Stage ${i+1}.Bearing Stand.${p}_hasBearingStand`) },
           [`${p}_bearingStandBore`]: { label: 'Stand Bore', value: 15, min: 0, max: 100, step: 1, render: (get) => get(`Stage ${i+1}.Bearing Stand.${p}_hasBearingStand`) },
         }),
       }, { render: showFolder });
    }
    return config;
  }, { store });
  
  return values;
}

export function computeGearStages(levaParams) {
  const data = [];
  let currentX = 0;
  let currentY = 0;
  let currentZ = 0;
  let currentSpeed = 1.0;
  let currentPhase = 0;

  for (let i = 0; i < levaParams.numStages; i++) {
    const p = `s${i}`;
    
    const stageParams = {
      gearType: levaParams.gearType,
      helixAngle: levaParams.helixAngle,
      numTeeth: levaParams[`${p}_numTeeth`],
      module: levaParams[`${p}_module`],
      pressureAngle: levaParams[`${p}_pressureAngle`],
      thickness: levaParams[`${p}_thickness`],
      hasSpokes: levaParams[`${p}_hasSpokes`],
      numSpokes: levaParams[`${p}_numSpokes`],
      spokeWidth: levaParams[`${p}_spokeWidth`],
      spokeChamfer: levaParams[`${p}_spokeChamfer`],
      spokePitch: levaParams[`${p}_spokePitch`],
      hubDiameter: levaParams[`${p}_hubDiameter`],
      boreType: levaParams[`${p}_boreType`],
      boreDiameter: levaParams[`${p}_boreType`] === 'none' ? 0 : levaParams[`${p}_boreDiameter`],
      keywayWidth: levaParams[`${p}_keywayWidth`],
      keywayDepth: levaParams[`${p}_keywayDepth`],
      dShaftFlat: levaParams[`${p}_dShaftFlat`],
      hasPinion: levaParams[`${p}_hasPinion`],
      pinionTeeth: levaParams[`${p}_pinionTeeth`],
      pinionModule: levaParams[`${p}_pinionModule`],
      pinionPressureAngle: levaParams[`${p}_pinionPressureAngle`],
      pinionThickness: levaParams[`${p}_pinionThickness`],
      hasBearingStand: levaParams[`${p}_hasBearingStand`],
      bearingStandDiameter: levaParams[`${p}_bearingStandDia`],
      bearingStandThickness: levaParams[`${p}_bearingStandThick`],
      bearingStandBore: levaParams[`${p}_bearingStandBore`],
    };

    const rGear = (stageParams.module * stageParams.numTeeth) / 2;

    if (i > 0) {
      const prevP = `s${i-1}`;
      const prevPinionTeeth = levaParams[`${prevP}_pinionTeeth`];
      const prevRPinion = (levaParams[`${prevP}_pinionModule`] * prevPinionTeeth) / 2;
      const prevThickness = levaParams[`${prevP}_thickness`];
      const prevPinionThickness = levaParams[`${prevP}_pinionThickness`];
      
      const centerDist = prevRPinion + rGear;
      const angle = (i % 2 !== 0) ? (Math.PI / 6) : (-Math.PI / 6);
      
      currentX += centerDist * Math.cos(angle);
      currentY += centerDist * Math.sin(angle);
      currentZ += (prevThickness / 2) + (prevPinionThickness / 2);
      
      currentSpeed = currentSpeed * -(prevPinionTeeth / stageParams.numTeeth);
      currentPhase = currentPhase * -(prevPinionTeeth / stageParams.numTeeth) + (Math.PI / stageParams.numTeeth);
    }

    data.push({
      params: stageParams,
      position: [currentX, currentY, currentZ],
      speedRatio: currentSpeed,
      rotationOffset: currentPhase
    });
  }
  
  return data;
}
