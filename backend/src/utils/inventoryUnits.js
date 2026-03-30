const UNIT_ALIASES = {
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  g: 'g',
  gram: 'g',
  grams: 'g',
  litre: 'litre',
  liter: 'litre',
  litres: 'litre',
  liters: 'litre',
  l: 'litre',
  ml: 'ml',
  millilitre: 'ml',
  milliliter: 'ml',
  millilitres: 'ml',
  milliliters: 'ml',
  piece: 'pieces',
  pieces: 'pieces',
  pc: 'pieces',
  pcs: 'pieces',
  unit: 'pieces',
  units: 'pieces',
};

const UNIT_META = {
  kg: { dimension: 'weight', factorToBase: 1000, baseUnit: 'g' },
  g: { dimension: 'weight', factorToBase: 1, baseUnit: 'g' },
  litre: { dimension: 'volume', factorToBase: 1000, baseUnit: 'ml' },
  ml: { dimension: 'volume', factorToBase: 1, baseUnit: 'ml' },
  pieces: { dimension: 'count', factorToBase: 1, baseUnit: 'pieces' },
};

export function normalizeInventoryUnit(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return UNIT_ALIASES[normalizedValue] || null;
}

export function assertSupportedInventoryUnit(value) {
  const unit = normalizeInventoryUnit(value);
  if (!unit || !UNIT_META[unit]) {
    throw new Error('Unsupported inventory unit');
  }

  return unit;
}

export function convertInventoryQuantity(quantity, fromUnit, toUnit) {
  const normalizedFrom = assertSupportedInventoryUnit(fromUnit);
  const normalizedTo = assertSupportedInventoryUnit(toUnit);
  const fromMeta = UNIT_META[normalizedFrom];
  const toMeta = UNIT_META[normalizedTo];

  if (fromMeta.dimension !== toMeta.dimension) {
    throw new Error(`Cannot convert ${normalizedFrom} to ${normalizedTo}`);
  }

  const baseQuantity = Number(quantity || 0) * fromMeta.factorToBase;
  return Number((baseQuantity / toMeta.factorToBase).toFixed(4));
}

export function areInventoryUnitsCompatible(firstUnit, secondUnit) {
  const normalizedFirst = normalizeInventoryUnit(firstUnit);
  const normalizedSecond = normalizeInventoryUnit(secondUnit);

  if (!normalizedFirst || !normalizedSecond) {
    return false;
  }

  return UNIT_META[normalizedFirst]?.dimension === UNIT_META[normalizedSecond]?.dimension;
}

