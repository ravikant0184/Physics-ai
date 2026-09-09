// Fixed, canonical HCV (Concepts of Physics by H.C. Verma) chapter list.
// The LLM is ONLY ever allowed to pick an id from this list — never invent one.
// `aliases` are distinctive phrases used by the fast local (stage-1) classifier.
// Keep aliases as multi-word, distinctive phrases where possible — single
// generic words (like "motion" alone) cause false-positive collisions across
// chapters, so those are intentionally left out and handled by the LLM instead.

export const HCV_CHAPTERS = [
  { id: 1, name: "Introduction to Physics", aliases: ["introduction to physics"] },
  { id: 2, name: "Physics and Mathematics", aliases: ["physics and mathematics", "vectors basics", "vector algebra"] },
  { id: 3, name: "Rest and Motion: Kinematics", aliases: ["rest and motion", "kinematics"] },
  { id: 4, name: "The Forces", aliases: ["the forces", "types of forces"] },
  { id: 5, name: "Newton's Laws of Motion", aliases: ["newton's laws", "newtons laws", "laws of motion"] },
  { id: 6, name: "Friction", aliases: ["friction"] },
  { id: 7, name: "Circular Motion", aliases: ["circular motion"] },
  { id: 8, name: "Work and Energy", aliases: ["work and energy", "work energy theorem"] },
  { id: 9, name: "Centre of Mass, Linear Momentum, Collision", aliases: ["centre of mass", "center of mass", "linear momentum", "collision"] },
  { id: 10, name: "Rotational Mechanics", aliases: ["rotational mechanics", "moment of inertia", "torque"] },
  { id: 11, name: "Gravitation", aliases: ["gravitation", "gravitational"] },
  { id: 12, name: "Simple Harmonic Motion", aliases: ["simple harmonic motion", "shm"] },
  { id: 13, name: "Fluid Mechanics", aliases: ["fluid mechanics", "fluid statics", "bernoulli"] },
  { id: 14, name: "Some Mechanical Properties of Matter", aliases: ["mechanical properties of matter", "elasticity", "surface tension"] },
  { id: 15, name: "Wave Motion and Waves on a String", aliases: ["wave motion", "waves on a string"] },
  { id: 16, name: "Sound Waves", aliases: ["sound waves"] },
  { id: 17, name: "Light Waves", aliases: ["light waves", "wave optics", "interference", "diffraction"] },
  { id: 18, name: "Geometrical Optics", aliases: ["geometrical optics", "ray optics", "mirrors and lenses"] },
  { id: 19, name: "Optical Instruments", aliases: ["optical instruments", "microscope", "telescope"] },
  { id: 20, name: "Dispersion and Spectra", aliases: ["dispersion and spectra", "dispersion of light"] },
  { id: 21, name: "Speed of Light", aliases: ["speed of light"] },
  { id: 22, name: "Photometry", aliases: ["photometry"] },
  { id: 23, name: "Heat and Temperature", aliases: ["heat and temperature", "thermal expansion"] },
  { id: 24, name: "Kinetic Theory of Gases", aliases: ["kinetic theory of gases", "kinetic theory"] },
  { id: 25, name: "Calorimetry", aliases: ["calorimetry"] },
  { id: 26, name: "Laws of Thermodynamics", aliases: ["laws of thermodynamics", "thermodynamics"] },
  { id: 27, name: "Specific Heat Capacities of Gases", aliases: ["specific heat capacities of gases", "specific heat capacity"] },
  { id: 28, name: "Heat Transfer", aliases: ["heat transfer", "conduction convection radiation"] },
  { id: 29, name: "Electric Field and Potential", aliases: ["electric field and potential", "electric field", "electric potential"] },
  { id: 30, name: "Gauss's Law", aliases: ["gauss's law", "gauss law"] },
  { id: 31, name: "Capacitors", aliases: ["capacitors", "capacitance"] },
  { id: 32, name: "Electric Current in Conductors", aliases: ["electric current in conductors", "current electricity"] },
  { id: 33, name: "Thermal and Chemical Effects of Current", aliases: ["thermal and chemical effects of current"] },
  { id: 34, name: "Magnetic Field", aliases: ["magnetic field"] },
  { id: 35, name: "Magnetic Field due to Current", aliases: ["magnetic field due to current", "biot savart", "ampere's law"] },
  { id: 36, name: "Permanent Magnets", aliases: ["permanent magnets"] },
  { id: 37, name: "Magnetic Properties of Matter", aliases: ["magnetic properties of matter"] },
  { id: 38, name: "Electromagnetic Induction", aliases: ["electromagnetic induction", "faraday's law", "lenz's law"] },
  { id: 39, name: "Alternating Current", aliases: ["alternating current", "ac circuits"] },
  { id: 40, name: "Electromagnetic Waves", aliases: ["electromagnetic waves"] },
  { id: 41, name: "Electric Current through Gases", aliases: ["electric current through gases"] },
  { id: 42, name: "Photoelectric Effect and Wave-Particle Duality", aliases: ["photoelectric effect", "wave particle duality", "dual nature"] },
  { id: 43, name: "Bohr's Model and Physics of Atom", aliases: ["bohr's model", "bohr model", "physics of atom", "atomic structure"] },
  { id: 44, name: "X-rays", aliases: ["x-rays", "x rays"] },
  { id: 45, name: "Semiconductors and Semiconductor Devices", aliases: ["semiconductors", "semiconductor devices", "diode", "transistor"] },
  { id: 46, name: "The Nucleus", aliases: ["the nucleus", "nuclear physics", "radioactivity"] },
];

export const HCV_CONTEXT_MARKERS = [
  "hcv", "hc verma", "h.c. verma", "h c verma", "concepts of physics", "verma solutions", "verma soln", "verma problems",
];

export function findChapterById(id) {
  return HCV_CHAPTERS.find((c) => c.id === id) || null;
}
