import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Approximate specs for the Verkada lineup — editable in the admin catalog.
const models = [
  // Dome
  { name: "CD42", family: "dome", hfovDeg: 128, effectiveRangeM: 15, mp: 5, ir: 15 },
  { name: "CD52", family: "dome", hfovDeg: 128, effectiveRangeM: 20, mp: 5, ir: 20 },
  { name: "CD53", family: "dome", hfovDeg: 128, effectiveRangeM: 20, mp: 5, ir: 20 },
  { name: "CD62", family: "dome", hfovDeg: 128, effectiveRangeM: 40, mp: 4, ir: 30, notes: "Telephoto zoom option" },
  { name: "CD62-E", family: "dome", hfovDeg: 128, effectiveRangeM: 40, mp: 4, ir: 30, notes: "Outdoor-rated" },
  { name: "CD63", family: "dome", hfovDeg: 114, effectiveRangeM: 30, mp: 8, ir: 30, notes: "4K" },
  // Mini
  { name: "CM41", family: "mini", hfovDeg: 94, effectiveRangeM: 15, mp: 5, ir: 15 },
  { name: "CM41-E", family: "mini", hfovDeg: 94, effectiveRangeM: 15, mp: 5, ir: 15, notes: "Outdoor-rated" },
  { name: "CM41-S", family: "mini", hfovDeg: 94, effectiveRangeM: 15, mp: 5, ir: 15 },
  { name: "CM42", family: "mini", hfovDeg: 94, effectiveRangeM: 15, mp: 5, ir: 15 },
  // Bullet
  { name: "CB51", family: "bullet", hfovDeg: 90, effectiveRangeM: 30, mp: 5, ir: 30 },
  { name: "CB52-E", family: "bullet", hfovDeg: 60, effectiveRangeM: 50, mp: 5, ir: 50, notes: "Telephoto" },
  { name: "CB53", family: "bullet", hfovDeg: 90, effectiveRangeM: 30, mp: 8, ir: 30 },
  { name: "CB61", family: "bullet", hfovDeg: 60, effectiveRangeM: 50, mp: 4, ir: 50 },
  { name: "CB62-E", family: "bullet", hfovDeg: 45, effectiveRangeM: 50, mp: 4, ir: 50, notes: "Outdoor telephoto" },
  // Fisheye
  { name: "CF81-E", family: "fisheye", hfovDeg: 360, effectiveRangeM: 12, mp: 12, ir: 20 },
  { name: "CF83", family: "fisheye", hfovDeg: 360, effectiveRangeM: 12, mp: 12, ir: 20 },
  // Multisensor
  { name: "CH52-E", family: "multisensor", lensCount: 4, hfovDeg: 90, effectiveRangeM: 30, mp: 20, ir: 30, notes: "4 independent heads" },
  // PTZ
  { name: "CP52-E", family: "ptz", hfovDeg: 60, effectiveRangeM: 100, mp: 2, ir: 100, notes: "PTZ — renders 360 ring" },
  { name: "CP62-E", family: "ptz", hfovDeg: 55, effectiveRangeM: 150, mp: 4, ir: 150, notes: "PTZ — renders 360 ring" },
  // Legacy
  { name: "D80", family: "multisensor", lensCount: 2, hfovDeg: 100, effectiveRangeM: 20, mp: 8, ir: 20, notes: "Legacy dual-head" },
];

async function main() {
  await prisma.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  for (const m of models) {
    await prisma.cameraModel.upsert({
      where: { name: m.name },
      update: {},
      create: {
        name: m.name, family: m.family, lensCount: m.lensCount ?? 1,
        hfovDeg: m.hfovDeg, effectiveRangeM: m.effectiveRangeM,
        megapixels: m.mp, irRangeM: m.ir, notes: m.notes,
      },
    });
  }
  console.log(`Seeded ${models.length} camera models`);
}

main().finally(() => prisma.$disconnect());
