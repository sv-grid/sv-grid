/**
 * "Delete record?" asked by the record menus (a row's, a card's) before the
 * record goes. The grid's header host (FieldsHeaderEnd) shows it for the grid
 * the request names.
 */
export type DeleteRecordRequest = { ctrl: unknown; api: unknown; row: unknown }

let request = $state.raw<DeleteRecordRequest | null>(null)

export const getDeleteRecordRequest = () => request
export function askDeleteRecord(r: DeleteRecordRequest | null): void {
  request = r
}
