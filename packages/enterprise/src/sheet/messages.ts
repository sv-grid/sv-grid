/**
 * Every string the spreadsheet shell shows, in one flat map, English by
 * default and any subset overridable through `<SvSheet localization>`.
 *
 * Two kinds of key. The ribbon's come from the ribbon model itself, so a
 * button added to `ribbon.ts` is translatable without a second edit here:
 * `ribbon.tab.<tab>`, `ribbon.group.<group>`, `ribbon.<item>.label`,
 * `ribbon.<item>.title`, `ribbon.<item>.option.<value>` and
 * `ribbon.<item>.none`. The rest are the typed keys below, for the chrome,
 * the tab strip, the formula bar, the menus and the sentences the status
 * bar says, and the dialogs' under `<dialog>.<part>` keys. A sentence with `{placeholders}` lets a translator
 * choose the word order; `formatMessage` fills them.
 */
import { RIBBON_TABS } from './ribbon'
import { PROTECTED_MESSAGE } from './protection'

export type SheetTextMessages = {
  // Status bar
  statusReady: string
  statusAverage: string
  statusCount: string
  statusSum: string
  /** "{shown} of {total} records found" */
  statusRecordsFound: string
  // Ribbon chrome
  ribbonLabel: string
  ribbonTabs: string
  ribbonExpand: string
  ribbonCollapse: string
  ribbonPin: string
  /** "{group} settings": a group's launcher. */
  groupSettings: string
  paletteThemeColors: string
  paletteStandardColors: string
  /** "{title} options": the arrow of a split button. */
  menuOptions: string
  // Formula bar
  formulaBar: string
  nameBox: string
  definedNames: string
  namesHeading: string
  formulaBarCancel: string
  formulaBarEnter: string
  insertFunction: string
  formula: string
  expandFormulaBar: string
  collapseFormulaBar: string
  functionSuggestions: string
  // Sheet tabs
  scrollTabsLeft: string
  scrollTabsRight: string
  sheets: string
  sheetName: string
  newSheet: string
  tabInsert: string
  tabDelete: string
  tabRename: string
  tabDuplicate: string
  tabMoveLeft: string
  tabMoveRight: string
  tabHide: string
  tabUnhide: string
  deleteSheetTitle: string
  /** "... Delete "{name}"?" */
  deleteSheetMessage: string
  /** ""{name}" is not a valid sheet name" */
  invalidSheetName: string
  /** "a sheet named "{name}" already exists" */
  duplicateSheetName: string
  // Buttons shared by the dialogs
  ok: string
  cancel: string
  delete: string
  close: string
  yes: string
  no: string
  retry: string
  save: string
  // The cell and header menus
  menuPasteSpecial: string
  menuInsertRows: string
  menuInsertColumns: string
  menuDeleteRows: string
  menuDeleteColumns: string
  menuClearContents: string
  menuClearFormats: string
  menuMergeCenter: string
  menuUnmergeCells: string
  menuNewComment: string
  menuEditComment: string
  menuDeleteComment: string
  menuFormatCells: string
  menuColumnWidth: string
  menuRowHeight: string
  menuHide: string
  menuUnhide: string
  // Cell chrome
  invalidCellMark: string
  openList: string
  listEmpty: string
  choices: string
  filter: string
  comment: string
  commentPlaceholder: string
  commentReply: string
  commentReplyPlaceholder: string
  commentPosts: string
  commentEdit: string
  commentResolve: string
  commentReopen: string
  commentResolved: string
  dataValidationTitle: string
  /** "Comment on {address}" */
  commentOn: string
  commentSaves: string
  commentsOnSheet: string
  noComments: string
  // The shell's own dialogs
  newWorkbookTitle: string
  newWorkbookMessage: string
  newWorkbookButton: string
  mergeCellsTitle: string
  mergeCellsMessage: string
  rowHeightTitle: string
  columnWidthTitle: string
  rowHeightLabel: string
  columnWidthLabel: string
  validationContinue: string
  // What the status bar says
  /** "Opened {name}." */
  openedFile: string
  /** "Could not open {name}." */
  couldNotOpen: string
  couldNotSave: string
  couldNotExport: string
  /** "Could not copy {name}." */
  couldNotCopySheet: string
  noPrecedents: string
  noDependents: string
  sheetProtected: string
  sheetUnprotected: string
  protectedCell: string
  nothingToHide: string
  nothingHidden: string
  /** "{count} {unit} {state}" */
  linesToggled: string
  /** "{count} hidden {unit} left in place", after a sort that skipped them. */
  sortKeptHidden: string
  unitRow: string
  unitRows: string
  unitColumn: string
  unitColumns: string
  stateHidden: string
  stateShown: string
  mergeSameSize: string
  selectBlockToSort: string
  noInvalidData: string
  /** "{count} cell breaks a validation rule." */
  invalidCellFound: string
  /** "{count} cells break a validation rule." */
  invalidCellsFound: string
  formatPainterHint: string
  selectBlockToChart: string
  selectChartFirst: string
  couldNotReadPicture: string
  chartObject: string
  pictureObject: string
  sparklineObject: string
  selectBlockToPivot: string
  noPivotHere: string
  noPivotDetails: string
  pivotDetails: string
  pivotDetailsSheet: string
  linkRemoved: string
  noLinkHere: string
  selectBlockToTable: string
  noTableHere: string
  tableRemoved: string
  tableMade: string
  tableUpdated: string
  tableNameTaken: string
  cannotOpenLink: string
  linkNotFollowed: string
  pivotRefreshed: string
  pivotWritten: string
  selectRangeForSparklines: string
  sparklinesCleared: string
  noSparklinesHere: string
  printAreaSet: string
  printAreaCleared: string
  couldNotPrint: string
}

/**
 * The dialogs' strings, keyed `<dialog>.<part>`. Declared as a value so the
 * key list is the type: a key added here is typed, defaulted and
 * overridable at once.
 */
export const defaultDialogMessages = {
  // Format Cells
  'formatCells.title': 'Format Cells',
  'formatCells.tabs': 'Format Cells tabs',
  'formatCells.tab.number': 'Number',
  'formatCells.tab.alignment': 'Alignment',
  'formatCells.tab.font': 'Font',
  'formatCells.tab.border': 'Border',
  'formatCells.tab.fill': 'Fill',
  'formatCells.tab.protection': 'Protection',
  'formatCells.category': 'Category:',
  'formatCells.categoryList': 'Category',
  'formatCells.category.general': 'General',
  'formatCells.category.number': 'Number',
  'formatCells.category.currency': 'Currency',
  'formatCells.category.accounting': 'Accounting',
  'formatCells.category.percent': 'Percentage',
  'formatCells.category.date': 'Date',
  'formatCells.category.time': 'Time',
  'formatCells.category.scientific': 'Scientific',
  'formatCells.category.special': 'Special',
  'formatCells.category.custom': 'Custom',
  'formatCells.sample': 'Sample',
  'formatCells.decimalPlaces': 'Decimal places:',
  'formatCells.thousands': 'Use 1000 separator (,)',
  'formatCells.symbol': 'Symbol:',
  'formatCells.symbol.none': 'None',
  'formatCells.symbol.euro': '€ Euro',
  'formatCells.symbol.pound': '£ Pound',
  'formatCells.symbol.yen': '¥ Yen',
  'formatCells.type': 'Type:',
  'formatCells.special.zip': 'Zip Code',
  'formatCells.special.zip4': 'Zip Code + 4',
  'formatCells.special.phone': 'Phone Number',
  'formatCells.special.ssn': 'Social Security Number',
  'formatCells.hint.general': 'General format cells have no specific number format.',
  'formatCells.hint.number': 'Number is used for general display of numbers.',
  'formatCells.hint.currency': 'Currency formats are used for general monetary values.',
  'formatCells.hint.accounting': 'Accounting formats line up the currency symbols and decimal points in a column.',
  'formatCells.hint.special': 'Special formats are useful for tracking list and database values.',
  'formatCells.hint.percent': 'Percentage formats multiply the cell value by 100 and display the result with a percent symbol.',
  'formatCells.hint.date': 'Date formats display date serial numbers as dates.',
  'formatCells.hint.time': 'Time formats display date serial numbers as times.',
  'formatCells.hint.scientific': 'Scientific formats display numbers in exponential notation.',
  'formatCells.hint.custom': 'Type the number format code, using one of the existing codes as a starting point.',
  'formatCells.horizontal': 'Horizontal:',
  'formatCells.align.general': 'General',
  'formatCells.align.left': 'Left (Indent)',
  'formatCells.align.center': 'Center',
  'formatCells.align.right': 'Right (Indent)',
  'formatCells.indent': 'Indent:',
  'formatCells.textControl': 'Text control',
  'formatCells.wrap': 'Wrap text',
  'formatCells.font': 'Font:',
  'formatCells.size': 'Size:',
  'formatCells.sizeDefault': 'Default',
  'formatCells.fontStyle': 'Font style',
  'formatCells.bold': 'Bold',
  'formatCells.italic': 'Italic',
  'formatCells.underline': 'Underline',
  'formatCells.strikethrough': 'Strikethrough',
  'formatCells.color': 'Color',
  'formatCells.automatic': 'Automatic',
  'formatCells.fontColor': 'Font colour',
  'formatCells.presets': 'Presets',
  'formatCells.borderGroup': 'Border',
  'formatCells.keepAsIs': 'Keep as is',
  'formatCells.border.none': 'None',
  'formatCells.border.outside': 'Outline',
  'formatCells.border.all': 'All borders',
  'formatCells.border.top': 'Top',
  'formatCells.border.bottom': 'Bottom',
  'formatCells.border.left': 'Left',
  'formatCells.border.right': 'Right',
  'formatCells.border.thick-bottom': 'Thick bottom',
  'formatCells.borderHint': 'Bottom, top, left and right go on the edge of the selection; All borders lines every cell; Outline frames the block.',
  'formatCells.backgroundColor': 'Background Color',
  'formatCells.noColor': 'No Color',
  'formatCells.fillGroup': 'Fill colour',
  'formatCells.locked': 'Locked',
  'formatCells.lockedHint': 'Locking cells has no effect until you protect the sheet (Review tab, Protect Sheet). Every cell is locked to begin with; unlock the ones that may change, then protect the sheet.',
  // The AutoFilter menu
  'filter.label': 'Filter {header}',
  'filter.sortAsc': 'Sort A to Z',
  'filter.sortDesc': 'Sort Z to A',
  'filter.sortSmallest': 'Sort Smallest to Largest',
  'filter.sortLargest': 'Sort Largest to Smallest',
  'filter.clear': 'Clear Filter From "{header}"',
  'filter.byColor': 'Filter by Color',
  'filter.byColorGroup': 'Filter by cell colour',
  'filter.noFill': 'No Fill',
  'filter.byFill': 'Filter by {fill}',
  'filter.byNoFill': 'Filter by no fill',
  'filter.dateFilters': 'Date Filters',
  'filter.datePeriod': 'Date period',
  'filter.date': 'Date',
  'filter.secondDate': 'Second date',
  'filter.and': 'and',
  'filter.numberFilters': 'Number Filters',
  'filter.textFilters': 'Text Filters',
  'filter.firstCondition': 'First condition',
  'filter.firstValue': 'First value',
  'filter.firstUpperValue': 'First upper value',
  'filter.joinAnd': 'And',
  'filter.joinOr': 'Or',
  'filter.secondCondition': 'Second condition',
  'filter.none': '(none)',
  'filter.secondValue': 'Second value',
  'filter.secondUpperValue': 'Second upper value',
  'filter.top10': 'Top 10',
  'filter.topOrBottom': 'Top or bottom',
  'filter.top': 'Top',
  'filter.bottom': 'Bottom',
  'filter.howMany': 'How many',
  'filter.itemsOrPercent': 'Items or percent',
  'filter.items': 'Items',
  'filter.percent': 'Percent',
  'filter.search': 'Search',
  'filter.searchValues': 'Search values',
  'filter.values': 'Values',
  'filter.selectAll': '(Select All)',
  'filter.selectAllResults': '(Select All Search Results)',
  'filter.blanks': '(Blanks)',
  'filter.noMatches': 'No matches.',
  'filter.period.equals': 'Equals',
  'filter.period.before': 'Before',
  'filter.period.after': 'After',
  'filter.period.between': 'Between',
  'filter.period.tomorrow': 'Tomorrow',
  'filter.period.today': 'Today',
  'filter.period.yesterday': 'Yesterday',
  'filter.period.nextWeek': 'Next Week',
  'filter.period.thisWeek': 'This Week',
  'filter.period.lastWeek': 'Last Week',
  'filter.period.nextMonth': 'Next Month',
  'filter.period.thisMonth': 'This Month',
  'filter.period.lastMonth': 'Last Month',
  'filter.period.nextQuarter': 'Next Quarter',
  'filter.period.thisQuarter': 'This Quarter',
  'filter.period.lastQuarter': 'Last Quarter',
  'filter.period.nextYear': 'Next Year',
  'filter.period.thisYear': 'This Year',
  'filter.period.lastYear': 'Last Year',
  'filter.period.yearToDate': 'Year to Date',
  'filter.op.equals': 'Equals',
  'filter.op.notEquals': 'Does Not Equal',
  'filter.op.startsWith': 'Begins With',
  'filter.op.endsWith': 'Ends With',
  'filter.op.contains': 'Contains',
  'filter.op.notContains': 'Does Not Contain',
  'filter.op.isBlank': 'Is Blank',
  'filter.op.isNotBlank': 'Is Not Blank',
  'filter.op.greaterThan': 'Greater Than',
  'filter.op.lessThan': 'Less Than',
  'filter.op.between': 'Between',
  // Name Manager
  'nameManager.title': 'Name Manager',
  'nameManager.name': 'Name',
  'nameManager.refersTo': 'Refers to',
  'nameManager.value': 'Value',
  'nameManager.edit': 'Edit',
  'nameManager.empty': 'No defined names. Add one below.',
  'nameManager.nameField': 'Name:',
  'nameManager.refersToField': 'Refers to:',
  'nameManager.namePlaceholder': 'TaxRate',
  'nameManager.refersToPlaceholder': 'Inputs!B3 or B2:B13',
  'nameManager.new': 'New',
  // Conditional Formatting Rules Manager
  'manageRules.title': 'Conditional Formatting Rules Manager',
  'manageRules.showFor': 'Show formatting rules for:',
  'manageRules.thisSheet': 'This Worksheet',
  'manageRules.selection': 'Current Selection',
  'manageRules.editRule': 'Edit Rule...',
  'manageRules.deleteRule': 'Delete Rule',
  'manageRules.moveUp': 'Move Up',
  'manageRules.moveDown': 'Move Down',
  'manageRules.rules': 'Rules',
  'manageRules.rule': 'Rule (applied in order shown)',
  'manageRules.format': 'Format',
  'manageRules.appliesTo': 'Applies to',
  'manageRules.stopIfTrue': 'Stop If True',
  'manageRules.noneOnSheet': 'No rules on this sheet.',
  'manageRules.noneInSelection': 'No rules over the selection.',
  'manageRules.iconSet': 'Icon Set',
  // Data Validation
  'validation.title': 'Data Validation',
  'validation.tabs': 'Data Validation tabs',
  'validation.tab.settings': 'Settings',
  'validation.tab.input': 'Input Message',
  'validation.tab.alert': 'Error Alert',
  'validation.criteria': 'Validation criteria',
  'validation.allow': 'Allow:',
  'validation.allow.any': 'Any value',
  'validation.allow.whole': 'Whole number',
  'validation.allow.decimal': 'Decimal',
  'validation.allow.list': 'List',
  'validation.allow.date': 'Date',
  'validation.allow.textLength': 'Text length',
  'validation.allow.custom': 'Custom',
  'validation.data': 'Data:',
  'validation.operator.between': 'between',
  'validation.operator.notBetween': 'not between',
  'validation.operator.equal': 'equal to',
  'validation.operator.notEqual': 'not equal to',
  'validation.operator.greater': 'greater than',
  'validation.operator.less': 'less than',
  'validation.operator.greaterOrEqual': 'greater than or equal to',
  'validation.operator.lessOrEqual': 'less than or equal to',
  'validation.source': 'Source:',
  'validation.formula': 'Formula:',
  'validation.startDate': 'Start date:',
  'validation.endDate': 'End date:',
  'validation.minimum': 'Minimum:',
  'validation.maximum': 'Maximum:',
  'validation.date': 'Date:',
  'validation.length': 'Length:',
  'validation.value': 'Value:',
  'validation.listPlaceholder': 'Red, Green, Blue or =$D$1:$D$5',
  'validation.ignoreBlank': 'Ignore blank',
  'validation.inCellDropdown': 'In-cell dropdown',
  'validation.customHint': 'Written for the top-left cell of the selection; it moves with each cell, as a copied formula would. TRUE (or a number other than 0) allows the entry.',
  'validation.listHint': 'A comma-separated list, or a range or a defined name starting with =.',
  'validation.boundHint': 'A bound can be a formula, so =$B$1 follows B1.',
  'validation.showInput': 'Show input message when cell is selected',
  'validation.inputLead': 'When cell is selected, show this input message:',
  'validation.inputTitle': 'Title:',
  'validation.inputMessage': 'Input message:',
  'validation.alertLead': 'When the user enters invalid data, show this alert:',
  'validation.style': 'Style:',
  'validation.stop': 'Stop',
  'validation.warning': 'Warning',
  'validation.errorTitle': 'Title:',
  'validation.errorMessage': 'Error message:',
  'validation.alertHint': 'Stop refuses the entry and offers Retry; Warning asks whether to keep it anyway.',
  'validation.clearAll': 'Clear All',
  // Find and Replace
  'findReplace.title': 'Find and Replace',
  'findReplace.findWhat': 'Find what:',
  'findReplace.replaceWith': 'Replace with:',
  'findReplace.matchCase': 'Match case',
  'findReplace.entireCell': 'Match entire cell contents',
  'findReplace.lookIn': 'Look in:',
  'findReplace.values': 'Values',
  'findReplace.formulas': 'Formulas',
  'findReplace.replaceAll': 'Replace All',
  'findReplace.replace': 'Replace',
  'findReplace.findAll': 'Find All',
  'findReplace.findNext': 'Find Next',
  'findReplace.notFound': "We couldn't find what you were looking for.",
  'findReplace.cellFound': '{count} cell found',
  'findReplace.cellsFound': '{count} cells found',
  'findReplace.nothingToReplace': "We couldn't find anything to replace.",
  'findReplace.replacedOne': 'All done. We made {count} replacement.',
  'findReplace.replacedMany': 'All done. We made {count} replacements.',
  // Insert Function
  'insertFunction.title': 'Insert Function',
  'insertFunction.search': 'Search for a function:',
  'insertFunction.searchPlaceholder': 'Type a name or what you want to do',
  'insertFunction.category': 'Or select a category:',
  'insertFunction.all': 'All',
  'insertFunction.select': 'Select a function:',
  'insertFunction.functions': 'Functions',
  'insertFunction.noMatch': 'No function matches.',
  'insertFunction.noDescription': 'No description.',
  'insertFunction.group.Financial': 'Financial',
  'insertFunction.group.Math': 'Math',
  'insertFunction.group.Statistical': 'Statistical',
  'insertFunction.group.Logical': 'Logical',
  'insertFunction.group.Information': 'Information',
  'insertFunction.group.Text': 'Text',
  'insertFunction.group.Date & Time': 'Date & Time',
  'insertFunction.group.Lookup & Reference': 'Lookup & Reference',
  'insertFunction.group.Other': 'Other',
  // Conditional formatting rule dialog
  'cf.title.greater': 'Greater Than',
  'cf.title.less': 'Less Than',
  'cf.title.between': 'Between',
  'cf.title.equal': 'Equal To',
  'cf.title.text': 'Text That Contains',
  'cf.title.duplicates': 'Duplicate Values',
  'cf.title.top10': 'Top 10 Items',
  'cf.title.bottom10': 'Bottom 10 Items',
  'cf.title.aboveAverage': 'Above Average',
  'cf.title.belowAverage': 'Below Average',
  'cf.title.formula': 'New Formatting Rule',
  'cf.lead.greater': 'Format cells that are GREATER THAN:',
  'cf.lead.less': 'Format cells that are LESS THAN:',
  'cf.lead.between': 'Format cells that are BETWEEN:',
  'cf.lead.equal': 'Format cells that are EQUAL TO:',
  'cf.lead.text': 'Format cells that contain the text:',
  'cf.lead.duplicates': 'Format cells that contain:',
  'cf.lead.top10': 'Format cells that rank in the TOP:',
  'cf.lead.bottom10': 'Format cells that rank in the BOTTOM:',
  'cf.lead.aboveAverage': 'Format cells that are ABOVE AVERAGE for the selected range:',
  'cf.lead.belowAverage': 'Format cells that are BELOW AVERAGE for the selected range:',
  'cf.lead.formula': 'Format values where this formula is true:',
  'cf.lowerValue': 'Lower value',
  'cf.upperValue': 'Upper value',
  'cf.and': 'and',
  'cf.formula': 'Formula',
  'cf.value': 'Value',
  'cf.textPlaceholder': 'text',
  'cf.valuePlaceholder': 'value or =formula',
  'cf.duplicateOrUnique': 'Duplicate or unique',
  'cf.duplicate': 'Duplicate',
  'cf.unique': 'Unique',
  'cf.values': 'values',
  'cf.howMany': 'How many',
  'cf.percentOfRange': '% of selected range',
  'cf.with': 'with',
  'cf.formatStyle': 'Format style',
  'cf.style.light-red': 'Light Red Fill with Dark Red Text',
  'cf.style.yellow': 'Yellow Fill with Dark Yellow Text',
  'cf.style.green': 'Green Fill with Dark Green Text',
  'cf.style.red-fill': 'Light Red Fill',
  'cf.style.red-text': 'Red Text',
  'cf.formulaHint': "Written for the top-left cell of the range; it moves with each cell as a copied formula would, so =$B2>100 on A2:A9 reads each row's B. TRUE formats.",
  // Text to Columns
  'textToColumns.title': 'Convert Text to Columns Wizard',
  'textToColumns.group': 'Convert Text to Columns',
  'textToColumns.lead': 'Choose the delimiter your data contains. The preview shows how it splits.',
  'textToColumns.delimiters': 'Delimiters',
  'textToColumns.tab': 'Tab',
  'textToColumns.semicolon': 'Semicolon',
  'textToColumns.comma': 'Comma',
  'textToColumns.space': 'Space',
  'textToColumns.other': 'Other',
  'textToColumns.otherDelimiter': 'Other delimiter',
  'textToColumns.collapse': 'Treat consecutive delimiters as one',
  'textToColumns.trim': 'Trim spaces around each field',
  'textToColumns.preview': 'Data preview',
  /** "{rows} rows in column {from} become {count} {unit} from column {from}. ..." */
  'textToColumns.status': '{rows} rows in column {from} become {count} {unit} from column {from}. Anything already in those columns is replaced.',
  'textToColumns.column': 'column',
  'textToColumns.columns': 'columns',
  'textToColumns.finish': 'Finish',
  'textToColumns.done': 'Split {rows} rows into {columns} columns.',
  // Sort
  'sort.title': 'Sort',
  'sort.addLevel': 'Add Level',
  'sort.deleteLevel': 'Delete Level',
  'sort.hasHeaders': 'My data has headers',
  'sort.levels': 'Sort levels',
  'sort.sortBy': 'Sort by',
  'sort.thenBy': 'Then by',
  'sort.column': '{by} column',
  'sort.order': '{by} order',
  'sort.asc': 'A to Z',
  'sort.desc': 'Z to A',
  'sort.columnLetter': 'Column {letter}',
  'sort.on': 'Sort on, for {by}',
  'sort.onValue': 'Values',
  'sort.onFill': 'Cell Colour',
  'sort.onFont': 'Font Colour',
  'sort.onTop': 'On Top',
  'sort.onBottom': 'On Bottom',
  'sort.colour': 'Colour:',
  'sort.noColours': 'This column carries no colour of that kind.',
  'sort.hint': 'Sorting {range}. Numbers sort before text, blanks go last, and formats move with their rows.',
  // Remove Duplicates
  'removeDuplicates.title': 'Remove Duplicates',
  'removeDuplicates.lead': 'To delete duplicate values, select one or more columns that contain duplicates.',
  'removeDuplicates.selectAll': 'Select All',
  'removeDuplicates.unselectAll': 'Unselect All',
  'removeDuplicates.hasHeaders': 'My data has headers',
  'removeDuplicates.columns': 'Columns',
  'removeDuplicates.columnLetter': 'Column {letter}',
  // Paste Special
  'pasteSpecial.title': 'Paste Special',
  'pasteSpecial.empty': 'Nothing has been copied from the sheet yet. Copy a range first, then Paste Special.',
  'pasteSpecial.paste': 'Paste',
  'pasteSpecial.all': 'All',
  'pasteSpecial.formulas': 'Formulas',
  'pasteSpecial.values': 'Values',
  'pasteSpecial.formats': 'Formats',
  'pasteSpecial.operation': 'Operation',
  'pasteSpecial.none': 'None',
  'pasteSpecial.add': 'Add',
  'pasteSpecial.subtract': 'Subtract',
  'pasteSpecial.multiply': 'Multiply',
  'pasteSpecial.divide': 'Divide',
  'pasteSpecial.skipBlanks': 'Skip blanks',
  'pasteSpecial.transpose': 'Transpose',
  // Protect Sheet
  'protectSheet.title': 'Protect Sheet',
  'protectSheet.lead': 'Allow all users of this worksheet to:',
  'protectSheet.formatCells': 'Format cells',
  'protectSheet.formatColumns': 'Format columns',
  'protectSheet.formatRows': 'Format rows',
  'protectSheet.insertColumns': 'Insert columns',
  'protectSheet.insertRows': 'Insert rows',
  'protectSheet.deleteColumns': 'Delete columns',
  'protectSheet.deleteRows': 'Delete rows',
  'protectSheet.sort': 'Sort',
  'protectSheet.autoFilter': 'Use AutoFilter',
  'protectSheet.hint': 'Locked cells hold; what is ticked stays open. The ranges under Allow Edit Ranges take an edit whatever is ticked.',
  // Allow Users to Edit Ranges
  'editRanges.title': 'Allow Users to Edit Ranges',
  'editRanges.lead': 'Ranges unlocked when the sheet is protected:',
  'editRanges.name': 'Title',
  'editRanges.refersTo': 'Refers to cells',
  'editRanges.modify': 'Modify',
  'editRanges.empty': 'No ranges yet. Add one below.',
  'editRanges.titleField': 'Title:',
  'editRanges.refersField': 'Refers to cells:',
  'editRanges.titlePlaceholder': 'Range1',
  'editRanges.refersPlaceholder': 'B2:B10 or A1, C3:C5',
  'editRanges.invalidRef': '"{text}" is not a cell or range',
  'editRanges.new': 'New',
  'editRanges.protectSheet': 'Protect Sheet...',
  // Chart Setup
  'chartSetup.title': 'Chart',
  'chartSetup.range': 'Reading {range}',
  'chartSetup.type': 'Type:',
  'chartSetup.type.bar': 'Column',
  'chartSetup.type.line': 'Line',
  'chartSetup.type.area': 'Area',
  'chartSetup.type.pie': 'Pie',
  'chartSetup.type.scatter': 'Scatter',
  'chartSetup.chartTitle': 'Title:',
  'chartSetup.titlePlaceholder': 'None',
  'chartSetup.series': 'Series in:',
  'chartSetup.series.columns': 'Columns',
  'chartSetup.series.rows': 'Rows',
  'chartSetup.headers': 'First row and column are labels',
  'chartSetup.stacked': 'Stack the series',
  'chartSetup.trend': 'Trendline:',
  'chartSetup.trend.none': 'None',
  'chartSetup.trend.linear': 'Linear',
  'chartSetup.trend.sma3': 'Moving average (3)',
  'chartSetup.secondary': 'Secondary axis:',
  'chartSetup.secondary.none': 'None',
  'chartSetup.hint': 'The chart reads the range, so editing a cell redraws it. Drag the chart to move it, its corner to resize it, and press Delete to remove it.',
  // Create Table
  'table.title': 'Create Table',
  'table.range': 'Where are the cells?',
  'table.rangePlaceholder': 'A1:D20',
  'table.name': 'Name:',
  'table.namePlaceholder': 'Table1',
  'table.headers': 'My table has headers',
  'table.totals': 'Show a totals row',
  'table.hint': 'A table names its columns, so a formula can say Orders[Amount] and keep meaning it as rows are added. Typing under the last row grows it.',
  'table.style': 'Style:',
  'table.styleNone': 'None: keep the cells as they are',
  /** The same choice named in a sentence, where the explanation does not fit. */
  'table.styleNoneShort': 'no style',
  'table.badRange': 'That is not a range on this sheet.',
  'table.badName': 'A table name starts with a letter and holds no spaces.',
  // Evaluate Formula
  'evaluate.title': 'Evaluate Formula',
  'evaluate.reference': 'Reference:',
  'evaluate.evaluation': 'Evaluation:',
  'evaluate.evaluate': 'Evaluate',
  'evaluate.stepBack': 'Step Back',
  'evaluate.restart': 'Restart',
  'evaluate.result': 'Result:',
  'evaluate.hint': 'The underlined part is what the next click works out. Keep clicking to reach the cell\'s own answer, and Restart to walk it again.',
  'evaluate.done': 'Nothing left to work out: this is the cell\'s answer.',
  'evaluate.noFormula': 'Select a cell with a formula in it, then open this again.',
  // Error Checking
  'errors.title': 'Error Checking',
  'errors.previous': 'Previous',
  'errors.next': 'Next',
  'errors.steps': 'Show Calculation Steps...',
  'errors.position': 'Problem {index} of {count}',
  'errors.none': 'No errors were found on this sheet.',
  'errors.inconsistent': 'Inconsistent formula',
  'errors.hint': 'Every cell on this sheet whose formula reports an error, and every formula that breaks the pattern of the ones above and below it.',
  // Calculation Options
  'iteration.title': 'Calculation Options',
  'iteration.enable': 'Enable iterative calculation',
  'iteration.maxIterations': 'Maximum iterations:',
  'iteration.maxChange': 'Maximum change:',
  'iteration.hint': 'A circular reference is normally an error. Some models are one on purpose, because the answer is a fixed point: a bonus that is a share of the profit it is taken out of. With this on, the loop runs until it stops moving or the passes run out.',
  'iteration.badNumbers': 'Iterations is a whole number of at least 1, and the change is not negative.',
  // Insert Link
  'link.title': 'Link',
  'link.address': 'Address:',
  'link.addressPlaceholder': 'https://example.com, or Sheet2!B4',
  'link.text': 'Text to display:',
  'link.textPlaceholder': 'The cell as it stands',
  'link.tip': 'ScreenTip:',
  'link.tipPlaceholder': 'None, so hovering shows the address',
  'link.hint': 'A link on a cell, not on its text: editing the cell keeps it, clearing the cell takes it away. An address on this workbook moves the selection instead of leaving the page.',
  'link.remove': 'Remove Link',
  'link.badAddress': 'Type an address: a URL, or a cell like Sheet2!B4.',
  'link.unsafeScheme': 'That kind of address is not opened from a cell. Use http, https, mailto, tel, sms or ftp, or an address on this workbook.',
  // Create PivotTable
  'pivot.title': 'PivotTable',
  'pivot.source': 'Source block:',
  'pivot.sourcePlaceholder': 'A1:D200',
  'pivot.target': 'Put it at:',
  'pivot.targetPlaceholder': 'F1',
  'pivot.field': 'Field',
  'pivot.place': 'Use as',
  'pivot.summarise': 'Summarise by',
  'pivot.place.none': 'Not used',
  'pivot.place.rows': 'Rows',
  'pivot.place.cols': 'Columns',
  'pivot.place.values': 'Values',
  'pivot.place.filters': 'Filter',
  'pivot.filterValue': 'Value for {field}',
  'pivot.agg.sum': 'Sum',
  'pivot.agg.avg': 'Average',
  'pivot.agg.count': 'Count',
  'pivot.agg.countDistinct': 'Distinct count',
  'pivot.agg.min': 'Min',
  'pivot.agg.max': 'Max',
  'pivot.grandTotal': 'Grand total row',
  'pivot.subtotals': 'Subtotal rows',
  'pivot.hint': 'The result is written as cells, so it can be formatted, charted and saved like any other block. Refresh rebuilds it from the source.',
  'pivot.badRange': 'That is not a range and a cell on this sheet.',
  'pivot.needValue': 'Pick at least one field to summarise.',
  // Create Sparklines
  'sparklines.title': 'Create Sparklines',
  'sparklines.type': 'Type:',
  'sparklines.type.line': 'Line',
  'sparklines.type.column': 'Column',
  'sparklines.type.winloss': 'Win/Loss',
  'sparklines.data': 'Data range:',
  'sparklines.dataPlaceholder': 'B2:E5',
  'sparklines.location': 'Location range:',
  'sparklines.locationPlaceholder': 'F2:F5',
  'sparklines.colour': 'Colour:',
  'sparklines.negativeColour': 'Negative:',
  'sparklines.sameScale': 'One value scale for the whole group',
  'sparklines.markers': 'Mark the last point',
  'sparklines.hint': 'One sparkline per row of the data, drawn in the cells of the location. They read the range, so editing a number redraws them.',
  'sparklines.badRange': 'That is not a range on this sheet.',
  'sparklines.mismatch': 'The location needs one cell per line of the data.',
  // Page Setup
  'pageSetup.title': 'Page Setup',
  'pageSetup.orientation': 'Orientation:',
  'pageSetup.portrait': 'Portrait',
  'pageSetup.landscape': 'Landscape',
  'pageSetup.paper': 'Paper size:',
  'pageSetup.margins': 'Margins:',
  'pageSetup.margins.normal': 'Normal',
  'pageSetup.margins.narrow': 'Narrow',
  'pageSetup.margins.wide': 'Wide',
  'pageSetup.margins.custom': 'Custom',
  'pageSetup.scale': 'Scale (%):',
  'pageSetup.printArea': 'Print area:',
  'pageSetup.printAreaPlaceholder': 'Whole sheet, or B2:F20',
  'pageSetup.titleRows': 'Rows to repeat at top:',
  'pageSetup.titleRowsPlaceholder': 'None, or 1:2',
  'pageSetup.gridlines': 'Print gridlines',
  'pageSetup.headings': 'Print row and column headings',
  'pageSetup.invalidArea': '"{text}" is not a cell or range',
  'pageSetup.invalidRows': '"{text}" is not a row range like 1:2',
  'pageSetup.print': 'Print...',
  // Goal Seek
  'goalSeek.title': 'Goal Seek',
  'goalSeek.statusTitle': 'Goal Seek Status',
  'goalSeek.setCell': 'Set cell:',
  'goalSeek.toValue': 'To value:',
  'goalSeek.byChanging': 'By changing cell:',
  'goalSeek.notAddress': '"{text}" is not a cell address',
  'goalSeek.toValueNumber': 'To value must be a number',
  'goalSeek.needsFormula': '{cell} must contain a formula',
  'goalSeek.found': 'Goal Seeking with Cell {cell} found a solution.',
  'goalSeek.notFound': 'Goal Seeking with Cell {cell} may not have found a solution.',
  'goalSeek.target': 'Target value:',
  'goalSeek.current': 'Current value:',
  'goalSeek.becomes': '{cell} becomes:',
  'goalSeek.iterations': '{count} iterations.',
} as const satisfies Record<string, string>

export type SheetDialogMessages = { [K in keyof typeof defaultDialogMessages]: string }

/** The ribbon's keys are generated, so they are strings; the rest are typed. */
export type SheetMessages = SheetTextMessages & SheetDialogMessages & Record<string, string>

export type SheetLocalization = {
  /** BCP-47 tag for the status bar's numbers; the grid's own formatting
   *  follows it too. Defaults to the page's language. */
  locale?: string
  /** Any subset of the strings; unset keys stay English. */
  text?: Partial<SheetMessages>
}

/** The ribbon's strings, read off the model so they are always complete. */
export function ribbonMessageDefaults(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const tab of RIBBON_TABS) {
    out[`ribbon.tab.${tab.id}`] = tab.label
    for (const group of tab.groups) {
      out[`ribbon.group.${group.id}`] = group.label
      for (const item of group.items) {
        out[`ribbon.${item.id}.label`] = item.label
        out[`ribbon.${item.id}.title`] = item.title
        if (item.none) out[`ribbon.${item.id}.none`] = item.none.label
        // A colour palette lists a hex twice (a theme colour and a standard
        // one can share it); the first keeps the key, `optionLabel` shows
        // the other by its own label.
        for (const option of item.options ?? []) out[`ribbon.${item.id}.option.${option.value}`] ??= option.label
      }
    }
  }
  return out
}

export const defaultSheetTextMessages: SheetTextMessages = {
  statusReady: 'Ready',
  statusAverage: 'Average:',
  statusCount: 'Count:',
  statusSum: 'Sum:',
  statusRecordsFound: '{shown} of {total} records found',
  ribbonLabel: 'Spreadsheet ribbon',
  ribbonTabs: 'Ribbon tabs',
  ribbonExpand: 'Expand the Ribbon',
  ribbonCollapse: 'Collapse the Ribbon',
  ribbonPin: 'Pin the Ribbon',
  groupSettings: '{group} settings',
  paletteThemeColors: 'Theme Colors',
  paletteStandardColors: 'Standard Colors',
  menuOptions: '{title} options',
  formulaBar: 'Formula bar',
  nameBox: 'Name box',
  definedNames: 'Defined names',
  namesHeading: 'Names',
  formulaBarCancel: 'Cancel',
  formulaBarEnter: 'Enter',
  insertFunction: 'Insert Function',
  formula: 'Formula',
  expandFormulaBar: 'Expand the formula bar',
  collapseFormulaBar: 'Collapse the formula bar',
  functionSuggestions: 'Function suggestions',
  scrollTabsLeft: 'Scroll tabs left',
  scrollTabsRight: 'Scroll tabs right',
  sheets: 'Sheets',
  sheetName: 'Sheet name',
  newSheet: 'New sheet',
  tabInsert: 'Insert...',
  tabDelete: 'Delete',
  tabRename: 'Rename',
  tabDuplicate: 'Duplicate',
  tabMoveLeft: 'Move Left',
  tabMoveRight: 'Move Right',
  tabHide: 'Hide',
  tabUnhide: 'Unhide',
  deleteSheetTitle: 'Delete sheet',
  deleteSheetMessage: 'This sheet holds data. Deleting it cannot be undone. Delete "{name}"?',
  invalidSheetName: '"{name}" is not a valid sheet name',
  duplicateSheetName: 'a sheet named "{name}" already exists',
  ok: 'OK',
  cancel: 'Cancel',
  delete: 'Delete',
  close: 'Close',
  yes: 'Yes',
  no: 'No',
  retry: 'Retry',
  save: 'Save',
  menuPasteSpecial: 'Paste Special...',
  menuInsertRows: 'Insert Rows',
  menuInsertColumns: 'Insert Columns',
  menuDeleteRows: 'Delete Rows',
  menuDeleteColumns: 'Delete Columns',
  menuClearContents: 'Clear Contents',
  menuClearFormats: 'Clear Formats',
  menuMergeCenter: 'Merge & Center',
  menuUnmergeCells: 'Unmerge Cells',
  menuNewComment: 'New Comment',
  menuEditComment: 'Edit Comment',
  menuDeleteComment: 'Delete Comment',
  menuFormatCells: 'Format Cells...',
  menuColumnWidth: 'Column Width...',
  menuRowHeight: 'Row Height...',
  menuHide: 'Hide',
  menuUnhide: 'Unhide',
  invalidCellMark: 'Breaks its validation rule',
  openList: 'Open the list',
  listEmpty: 'The list is empty.',
  choices: 'Choices',
  filter: 'Filter',
  comment: 'Comment',
  commentPlaceholder: 'Type a comment',
  commentReply: 'Reply',
  commentReplyPlaceholder: 'Reply...',
  commentPosts: 'Ctrl+Enter posts',
  commentEdit: 'Edit',
  commentResolve: 'Resolve thread',
  commentReopen: 'Reopen',
  commentResolved: 'Resolved',
  dataValidationTitle: 'Data validation',
  commentOn: 'Comment on {address}',
  commentSaves: 'Ctrl+Enter saves',
  commentsOnSheet: 'Comments on this sheet',
  noComments: 'No comments on this sheet.',
  newWorkbookTitle: 'New workbook',
  newWorkbookMessage: 'Start a new workbook? What is on these sheets goes away unless it was saved.',
  newWorkbookButton: 'New workbook',
  mergeCellsTitle: 'Merge cells',
  mergeCellsMessage: 'Merging cells only keeps the upper-left cell value and discards the other values.',
  rowHeightTitle: 'Row Height',
  columnWidthTitle: 'Column Width',
  rowHeightLabel: 'Row height (px):',
  columnWidthLabel: 'Column width (px):',
  validationContinue: 'Continue?',
  openedFile: 'Opened {name}.',
  couldNotOpen: 'Could not open {name}.',
  couldNotSave: 'Could not save the workbook.',
  couldNotExport: 'Could not export the sheet.',
  couldNotCopySheet: 'Could not copy {name}.',
  noPrecedents: 'The Trace Precedents command found no formula references in the active cell.',
  noDependents: 'The Trace Dependents command found no formulas that refer to the active cell.',
  sheetProtected: 'Sheet protected. Locked cells can no longer be changed.',
  sheetUnprotected: 'Sheet unprotected.',
  protectedCell: PROTECTED_MESSAGE,
  nothingToHide: 'Nothing to hide',
  nothingHidden: 'Nothing hidden in the selection',
  linesToggled: '{count} {unit} {state}',
  sortKeptHidden: '{count} hidden {unit} left in place',
  unitRow: 'row',
  unitRows: 'rows',
  unitColumn: 'column',
  unitColumns: 'columns',
  stateHidden: 'hidden',
  stateShown: 'shown',
  mergeSameSize: 'To do this, all the merged cells need to be the same size.',
  selectBlockToSort: 'Select a block with more than one row to sort.',
  noInvalidData: 'No invalid data was found.',
  invalidCellFound: '{count} cell breaks a validation rule.',
  invalidCellsFound: '{count} cells break a validation rule.',
  formatPainterHint: 'Select where to paste the format, or press Esc',
  selectBlockToChart: 'Select the cells to chart, headers included.',
  selectChartFirst: 'Select a chart first.',
  couldNotReadPicture: 'Could not read the picture.',
  chartObject: 'Chart',
  pictureObject: 'Picture',
  sparklineObject: '{type} sparkline',
  selectBlockToPivot: 'Select the block to summarise, its header row included.',
  noPivotHere: 'No PivotTable here. Select a cell inside one.',
  noPivotDetails: 'That cell has no source rows behind it.',
  pivotDetails: '{count} rows behind that cell, on "{name}".',
  pivotDetailsSheet: 'Details',
  linkRemoved: 'Link removed.',
  noLinkHere: 'No link in the selection.',
  selectBlockToTable: 'Select the cells to make a table of, headers included.',
  noTableHere: 'No table here. Select a cell inside one.',
  tableRemoved: '{name} is ordinary cells again.',
  tableMade: '{name} covers {range}.',
  tableUpdated: '{name} covers {range}, in {style}.',
  tableNameTaken: 'A table called {name} already exists.',
  cannotOpenLink: 'That link goes nowhere on this workbook.',
  linkNotFollowed: 'That kind of address is not opened from a cell.',
  pivotRefreshed: 'PivotTable refreshed.',
  pivotWritten: 'PivotTable written to {range}.',
  selectRangeForSparklines: 'Select the numbers the sparklines read.',
  sparklinesCleared: 'Sparklines cleared.',
  noSparklinesHere: 'No sparklines in the selection.',
  printAreaSet: 'Print area set to {range}.',
  printAreaCleared: 'Print area cleared.',
  couldNotPrint: 'Could not open the print window; the browser blocked the popup.',
}

/** The full English map: the typed strings plus the ribbon's. */
export const defaultSheetMessages: SheetMessages = { ...ribbonMessageDefaults(), ...defaultDialogMessages, ...defaultSheetTextMessages }

/** The defaults with `overrides` laid over them; an undefined override is ignored. */
export function resolveSheetMessages(overrides?: Partial<SheetMessages> | null): SheetMessages {
  if (!overrides) return defaultSheetMessages
  const out: Record<string, string> = { ...defaultSheetMessages }
  for (const [key, value] of Object.entries(overrides)) if (typeof value === 'string') out[key] = value
  return out as SheetMessages
}

/** Fill `{name}` placeholders; a placeholder with no value is left as is. */
export function formatMessage(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
}
