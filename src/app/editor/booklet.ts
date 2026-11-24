// Booklet imposition: returns the 0-based page index for each half of each
// printed sheet, in reading order of the sheets (left, right, left, right...).
// `null` means a blank half (used for padding).
//
// 2 pages or fewer are NOT imposed: page 1 goes on the left, page 2 on the right.
// More than 2 pages follows standard saddle-stitch imposition, e.g.
//   4 pages -> [4|1] [2|3]
//   8 pages -> [8|1] [2|7] [6|3] [4|5]
export const buildBookletOrder = (pageCount: number): (number | null)[] => {
  if (pageCount <= 0) return [];

  const order: (number | null)[] = [];

  if (pageCount <= 2) {
    for (let i = 0; i < pageCount; i += 1) order.push(i);
    while (order.length % 2 !== 0) order.push(null);
    return order;
  }

  // Saddle-stitch needs a multiple of 4 pages; missing pages become blanks.
  const padded = Math.ceil(pageCount / 4) * 4;

  const push = (index: number) => {
    order.push(index >= 0 && index < pageCount ? index : null);
  };

  for (let sheet = 0; sheet < padded / 4; sheet += 1) {
    // Front side: last page on the left, first page on the right.
    push(padded - 2 * sheet - 1);
    push(2 * sheet);
    // Back side: next page on the left, previous page on the right.
    push(2 * sheet + 1);
    push(padded - 2 * sheet - 2);
  }

  return order;
};
