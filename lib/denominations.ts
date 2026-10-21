export interface Denomination {
  value: number;
  label: string;
  count: number;
  isNote: boolean;
}

const INDIAN_CURRENCIES = [
  { value: 500, label: '₹500 Note', isNote: true },
  { value: 200, label: '₹200 Note', isNote: true },
  { value: 100, label: '₹100 Note', isNote: true },
  { value: 50, label: '₹50 Note', isNote: true },
  { value: 20, label: '₹20 Note', isNote: true },
  { value: 10, label: '₹10 Note', isNote: true },
  { value: 5, label: '₹5 Coin', isNote: false },
  { value: 2, label: '₹2 Coin', isNote: false },
  { value: 1, label: '₹1 Coin', isNote: false },
];

/**
 * Calculates optimal breakdown of notes and coins to return to the customer
 * @param changeAmountInRupees e.g. 49
 */
export function calculateDenominations(changeAmountInRupees: number): Denomination[] {
  let remaining = Math.max(0, Math.floor(changeAmountInRupees));
  const result: Denomination[] = [];

  for (const curr of INDIAN_CURRENCIES) {
    if (remaining >= curr.value) {
      const count = Math.floor(remaining / curr.value);
      remaining %= curr.value;
      result.push({
        value: curr.value,
        label: curr.label,
        count,
        isNote: curr.isNote,
      });
    }
  }

  return result;
}
