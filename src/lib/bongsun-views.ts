// Camera angles shared by the painted and unpainted compatibility renders.
export const BONGSUN_VIEWS = [
  { frame: "front-m45", angle: -45 }, { frame: "front-m34", angle: -33.75 },
  { frame: "front-left", angle: -22.5 }, { frame: "front-m11", angle: -11.25 },
  { frame: "front-m6", angle: -5.625 }, { frame: "front", angle: 0 },
  { frame: "front-p6", angle: 5.625 }, { frame: "front-p11", angle: 11.25 },
  { frame: "front-right", angle: 22.5 }, { frame: "front-p34", angle: 33.75 },
  { frame: "front-p45", angle: 45 },
] as const;
