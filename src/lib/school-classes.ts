export type SchoolClass = {
  value: string;
  english: string;
  bengali: string;
  bengaliOrdinal: string;
};

export const SCHOOL_CLASSES: SchoolClass[] = [
  { value: 'kg', english: 'KG', bengali: 'কেজি', bengaliOrdinal: 'কেজি' },
  { value: 'nursery', english: 'Nursery', bengali: 'নার্সারি', bengaliOrdinal: 'নার্সারি' },
  { value: '1', english: 'Class 1', bengali: 'প্রথম শ্রেণি', bengaliOrdinal: 'প্রথম' },
  { value: '2', english: 'Class 2', bengali: 'দ্বিতীয় শ্রেণি', bengaliOrdinal: 'দ্বিতীয়' },
  { value: '3', english: 'Class 3', bengali: 'তৃতীয় শ্রেণি', bengaliOrdinal: 'তৃতীয়' },
  { value: '4', english: 'Class 4', bengali: 'চতুর্থ শ্রেণি', bengaliOrdinal: 'চতুর্থ' },
  { value: '5', english: 'Class 5', bengali: 'পঞ্চম শ্রেণি', bengaliOrdinal: 'পঞ্চম' },
  { value: '6', english: 'Class 6', bengali: 'ষষ্ঠ শ্রেণি', bengaliOrdinal: 'ষষ্ঠ' },
  { value: '7', english: 'Class 7', bengali: 'সপ্তম শ্রেণি', bengaliOrdinal: 'সপ্তম' },
  { value: '8', english: 'Class 8', bengali: 'অষ্টম শ্রেণি', bengaliOrdinal: 'অষ্টম' },
  { value: '9', english: 'Class 9', bengali: 'নবম শ্রেণি', bengaliOrdinal: 'নবম' },
  { value: '10', english: 'Class 10', bengali: 'দশম শ্রেণি', bengaliOrdinal: 'দশম' },
  { value: '11', english: 'Class 11', bengali: 'একাদশ শ্রেণি', bengaliOrdinal: 'একাদশ' },
  { value: '12', english: 'Class 12', bengali: 'দ্বাদশ শ্রেণি', bengaliOrdinal: 'দ্বাদশ' },
];

function normalizedClass(value: string): string {
  return value.trim().replace(/^class\s+/i, '').toLowerCase();
}

export function formatClassName(value: string): string {
  const schoolClass = SCHOOL_CLASSES.find(
    (option) => option.value === normalizedClass(value)
  );
  return schoolClass ? `${schoolClass.english} (${schoolClass.bengali})` : value;
}

export function formatClassOrdinal(value: string): string {
  const schoolClass = SCHOOL_CLASSES.find(
    (option) => option.value === normalizedClass(value)
  );
  return schoolClass?.bengaliOrdinal ?? value;
}

export function compareSchoolClasses(a: string, b: string): number {
  const order = new Map(SCHOOL_CLASSES.map((schoolClass, index) => [schoolClass.value, index]));
  const orderA = order.get(normalizedClass(a)) ?? Number.MAX_SAFE_INTEGER;
  const orderB = order.get(normalizedClass(b)) ?? Number.MAX_SAFE_INTEGER;
  return orderA - orderB || a.localeCompare(b, undefined, { numeric: true });
}
