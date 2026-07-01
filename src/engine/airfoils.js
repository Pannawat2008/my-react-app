// Expanded Airfoil Database for Wind Turbine Blade Designer
// Contains CL and CD values at various angles of attack (alpha in degrees)
// 8 airfoil profiles covering a wide range of applications

export const airfoils = {
  'S809': {
    name: 'NREL S809',
    description: 'Designed for HAWTs. High L/D ratio at design conditions, soft stall.',
    thickness: 0.21, // 21% thickness
    category: 'HAWT Standard',
    polars: [
      { alpha: -5, cl: -0.2, cd: 0.012 },
      { alpha: 0, cl: 0.2, cd: 0.01 },
      { alpha: 5, cl: 0.7, cd: 0.015 },
      { alpha: 8, cl: 0.95, cd: 0.02 }, // Optimal
      { alpha: 10, cl: 1.05, cd: 0.03 },
      { alpha: 14, cl: 1.1, cd: 0.08 }, // Soft stall onset
      { alpha: 20, cl: 0.8, cd: 0.2 }, // Deep stall
      { alpha: 30, cl: 0.6, cd: 0.4 }
    ]
  },
  'NACA4412': {
    name: 'NACA 4412',
    description: 'Classic asymmetrical 4-digit airfoil, good general purpose.',
    thickness: 0.12, // 12% thickness
    category: 'General Purpose',
    polars: [
      { alpha: -5, cl: -0.1, cd: 0.008 },
      { alpha: 0, cl: 0.4, cd: 0.007 },
      { alpha: 5, cl: 0.85, cd: 0.01 },
      { alpha: 8, cl: 1.1, cd: 0.015 }, // Optimal
      { alpha: 10, cl: 1.25, cd: 0.02 },
      { alpha: 14, cl: 1.4, cd: 0.04 }, // Hard stall onset
      { alpha: 20, cl: 0.9, cd: 0.15 },
      { alpha: 30, cl: 0.7, cd: 0.3 }
    ]
  },
  'DU91W2250': {
    name: 'DU 91-W2-250',
    description: 'TU Delft airfoil, designed for root/mid sections, thick and structurally robust.',
    thickness: 0.25, // 25% thickness
    category: 'Thick Root',
    polars: [
      { alpha: -5, cl: -0.3, cd: 0.02 },
      { alpha: 0, cl: 0.15, cd: 0.015 },
      { alpha: 5, cl: 0.65, cd: 0.02 },
      { alpha: 8, cl: 0.9, cd: 0.03 }, // Optimal
      { alpha: 10, cl: 1.05, cd: 0.04 },
      { alpha: 14, cl: 1.25, cd: 0.07 }, 
      { alpha: 20, cl: 1.1, cd: 0.18 }, // Gradual stall
      { alpha: 30, cl: 0.8, cd: 0.45 }
    ]
  },

  /* ── NEW AIRFOILS ── */

  'NACA0012': {
    name: 'NACA 0012',
    description: 'Symmetric airfoil. Zero lift at zero AoA. Used for research and tail rotors.',
    thickness: 0.12,
    category: 'Symmetric',
    polars: [
      { alpha: -5, cl: -0.55, cd: 0.010 },
      { alpha: 0, cl: 0.0, cd: 0.006 },
      { alpha: 5, cl: 0.55, cd: 0.010 },
      { alpha: 8, cl: 0.85, cd: 0.014 },
      { alpha: 10, cl: 1.0, cd: 0.020 },
      { alpha: 14, cl: 1.15, cd: 0.055 },
      { alpha: 20, cl: 0.85, cd: 0.19 },
      { alpha: 30, cl: 0.65, cd: 0.38 }
    ]
  },
  'NACA63215': {
    name: 'NACA 63-215',
    description: 'Laminar flow airfoil. Excellent L/D in clean conditions. Mid-span use.',
    thickness: 0.15,
    category: 'Laminar Flow',
    polars: [
      { alpha: -5, cl: -0.25, cd: 0.007 },
      { alpha: 0, cl: 0.30, cd: 0.005 },
      { alpha: 5, cl: 0.85, cd: 0.008 },
      { alpha: 8, cl: 1.10, cd: 0.012 }, // Very high L/D
      { alpha: 10, cl: 1.25, cd: 0.018 },
      { alpha: 14, cl: 1.35, cd: 0.045 },
      { alpha: 20, cl: 0.95, cd: 0.16 },
      { alpha: 30, cl: 0.70, cd: 0.32 }
    ]
  },
  'S822': {
    name: 'NREL S822',
    description: 'Designed for small wind turbines (2–20 kW). Thick, high lift, insensitive to roughness.',
    thickness: 0.16,
    category: 'Small Turbine',
    polars: [
      { alpha: -5, cl: -0.15, cd: 0.013 },
      { alpha: 0, cl: 0.35, cd: 0.010 },
      { alpha: 5, cl: 0.82, cd: 0.013 },
      { alpha: 8, cl: 1.05, cd: 0.018 },
      { alpha: 10, cl: 1.18, cd: 0.025 },
      { alpha: 14, cl: 1.30, cd: 0.060 },
      { alpha: 20, cl: 0.90, cd: 0.17 },
      { alpha: 30, cl: 0.68, cd: 0.36 }
    ]
  },
  'S833': {
    name: 'NREL S833',
    description: 'Thin tip airfoil for small turbines. Low drag, designed for high tip speed.',
    thickness: 0.10,
    category: 'Thin Tip',
    polars: [
      { alpha: -5, cl: -0.10, cd: 0.007 },
      { alpha: 0, cl: 0.40, cd: 0.006 },
      { alpha: 5, cl: 0.90, cd: 0.009 },
      { alpha: 8, cl: 1.15, cd: 0.013 },
      { alpha: 10, cl: 1.28, cd: 0.019 },
      { alpha: 14, cl: 1.38, cd: 0.042 },
      { alpha: 20, cl: 0.92, cd: 0.14 },
      { alpha: 30, cl: 0.72, cd: 0.30 }
    ]
  },
  'FFAW3241': {
    name: 'FFA-W3-241',
    description: 'Modern thick airfoil by FFA/DTU. For utility-scale root/mid sections. High structural efficiency.',
    thickness: 0.24,
    category: 'Utility Scale',
    polars: [
      { alpha: -5, cl: -0.28, cd: 0.018 },
      { alpha: 0, cl: 0.20, cd: 0.013 },
      { alpha: 5, cl: 0.72, cd: 0.017 },
      { alpha: 8, cl: 1.00, cd: 0.024 },
      { alpha: 10, cl: 1.15, cd: 0.032 },
      { alpha: 14, cl: 1.35, cd: 0.065 },
      { alpha: 20, cl: 1.15, cd: 0.17 },
      { alpha: 30, cl: 0.82, cd: 0.42 }
    ]
  }
};

// Linear interpolation function for polar data
export function getAerodynamicCoefficients(airfoilId, alphaDeg) {
  if (airfoilId === 'Custom') {
    // Since custom airfoils don't provide polar data, we fall back to a generic polar (NACA4412)
    airfoilId = 'NACA4412';
  }
  
  const airfoil = airfoils[airfoilId];
  if (!airfoil) return { cl: 0, cd: 0.1 };

  const polars = airfoil.polars;
  
  // Handle out of bounds
  if (alphaDeg <= polars[0].alpha) return { cl: polars[0].cl, cd: polars[0].cd };
  if (alphaDeg >= polars[polars.length - 1].alpha) return { cl: polars[polars.length - 1].cl, cd: polars[polars.length - 1].cd };

  // Interpolate
  for (let i = 0; i < polars.length - 1; i++) {
    const p1 = polars[i];
    const p2 = polars[i + 1];
    if (alphaDeg >= p1.alpha && alphaDeg <= p2.alpha) {
      const t = (alphaDeg - p1.alpha) / (p2.alpha - p1.alpha);
      const cl = p1.cl + t * (p2.cl - p1.cl);
      const cd = p1.cd + t * (p2.cd - p1.cd);
      return { cl, cd };
    }
  }

  return { cl: 0, cd: 0.1 };
}
