// How a place is lit through what is drawn there, as a share of the way to the glow's ink: its outline, its inside.
// The hover lights in white what a click would act on, a drag's target the same way, in red where it will not go;
// the windows (`glow` in kit.ts) and the map's frame (`pixelMap`'s `lit`) read the same shares.
export const GLOW = { edge: 0.5, inside: 0.1 } as const
