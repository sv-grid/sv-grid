
/* Smart UI v26.0.8 (2026-05-15) 
Copyright (c) 2011-2026 jQWidgets. 
License: https://htmlelements.com/license/ */ //

Smart('smart-scheduler', class Scheduler extends Smart.ScrollViewer {
    // Element's properties.
    static get properties() {
        return {
            'available': {
                value: [],
                type: 'array'
            },
            'autoCreateDialog': {
                value: false,
                type: 'boolean'
            },
            'autoHeightAllDayCells': {
                value: false,
                type: 'boolean'
            },
            'autoScrollStep': {
                value: 30,
                type: 'number'
            },
            'colorScheme': {
                value: ['#D50000', '#E67C73', '#F4511E', '#F6BF26',
                    '#33B679', '#0B8043', '#039BE5', '#3F51B5',
                    '#7986CB', '#8E24AA', '#616161', ''],
                type: 'array'
            },
            'currentTime': {
                value: null,
                type: 'any',
                validator: '_dateValidator'
            },
            'currentTimeIndicator': {
                value: false,
                type: 'boolean'
            },
            'currentTimeIndicatorInterval': {
                value: 1,
                validator: '_currentTimeIndicatorIntervalValidator',
                type: 'number'
            },
            'contextMenuDataSource': {
                value: null,
                type: 'any',
                reflectToAttribute: false
            },
            'contextMenuClipboardActions': {
                value: false,
                type: 'boolean'
            },
            'eventTemplate': {
                value: null,
                type: 'any',
                reflectToAttribute: false
            },
            'eventCollectorTemplate': {
                value: null,
                type: 'any'
            },
            //In 'classic' mode, the events are placed one over another.
            // In 'modern' if mobile use event collectors only, if not use collector when necessary
            'eventRenderMode': {
                allowedValues: ['classic', 'modern'],
                value: 'modern',
                type: 'string'
            },
            'eventTooltipTemplate': { //Tooltip template for the events
                value: null,
                type: 'any'
            },
            'cellTemplate': { //A template for the Timeline cells
                value: null,
                type: 'any',
                reflectToAttribute: false
            },
            'dateCurrent': { //Deterines the current visible date
                value: new Date(),
                type: 'any',
                validator: '_dateValidator'
            },
            'dataExport': {
                value: {
                    'header': {
                        value: true,
                        type: 'boolean'
                    },
                    'columns': {
                        value: [],
                        type: 'array'
                    },
                    'style': {
                        value: null,
                        type: 'object'
                    },
                    'fileName': {
                        value: 'SmartScheduler',
                        type: 'string?'
                    },
                    'pageOrientation': {
                        value: 'portrait',
                        type: 'string'
                    }
                },
                type: 'object'
            },
            'dataSource': {
                value: [],
                type: 'any',
                reflectToAttribute: false
            },
            'dateSelectorFormatFunction': { //Allows to reformat the text inside the date range selector in the Header
                value: null,
                reflectToAttribute: false,
                type: 'function?'
            },
            'dayFormat': {
                value: 'numeric',
                allowedValues: ['2-digit', 'numeric'],
                type: 'string'
            },
            'disableAutoScroll': {
                value: false,
                type: 'boolean'
            },
            'disableDrag': { //Applicable to specific events as well
                value: false,
                type: 'boolean'
            },
            'disableDrop': { //Applicable to specific events as well
                value: false,
                type: 'boolean'
            },
            'disableResize': { //Applicable to specific events as well
                value: false,
                type: 'boolean'
            },
            'disableSelection': { //disables cell selection
                value: false,
                type: 'boolean'
            },
            'disableWindowEditor': { //disable editing via the Window
                value: false,
                type: 'boolean'
            },
            'disableContextMenu': { //disable view menu
                value: false,
                type: 'boolean'
            },
            'disableEventMenu': { //disable view menu
                value: false,
                type: 'boolean'
            },
            'disableViewMenu': { //disable view menu
                value: false,
                type: 'boolean'
            },
            'disableDateMenu': { //disable date menu
                value: false,
                type: 'boolean'
            },
            'disableConflicts': { //Applicable to events.
                value: false,
                type: 'boolean'
            },
            'dragFeedbackFormatFunction': { //Feedback for the events while dragging
                value: null,
                type: 'function?',
                reflectToAttribute: false
            },
            'dragOffset': {
                value: [10, 10],
                type: 'array'
            },
            'filterable': {
                value: false,
                type: 'boolean'
            },
            'filter': {
                value: null,
                type: 'any'
            },
            'filterMode': {
                value: 'equals',
                allowedValues: ['contains', 'containsIgnoreCase', 'doesNotContain', 'doesNotContainIgnoreCase', 'equals', 'equalsIgnoreCase', 'startsWith', 'startsWithIgnoreCase', 'endsWith', 'endsWithIgnoreCase'],
                type: 'string'
            },
            'firstDayOfWeek': {
                value: 0,
                type: 'number',
                defaultValue: 0,
                validator: '_firstDayOfWeekValidator'
            },
            'footerTemplate': { //A template for the Footer section
                value: null,
                type: 'any',
                reflectToAttribute: false
            },
            //Appointments are grouped by date first and then by resource; opposite if false.
            'groupByDate': {
                value: false,
                type: 'boolean'
            },
            'groupOrientation': { //Can be defined for each view as well
                allowedValues: ['horizontal', 'vertical'],
                value: 'horizontal',
                type: 'string',
            },
            'groupTemplate': { //Sets a Template for the group headers
                value: null,
                type: 'any',
                reflectToAttribute: false
            },
            'groups': { //Defines the list of groups for the Timeline. The order is important
                value: [],
                type: 'array'
            },
            'hourEnd': { //Determines the end hour for the timeline. Validated againts the events
                value: 23,
                type: 'number',
                validator: '_hourValidator'
            },
            'hourStart': { //Determines the start hour for the timeline. Validated againts the events
                value: 0,
                type: 'number',
                validator: '_hourValidator'
            },
            'hourFormat': {
                value: 'numeric',
                allowedValues: ['numeric', '2-digit'],
                type: 'string'
            },
            'headerTemplate': { //A template for the Header section
                value: null,
                type: 'any',
                reflectToAttribute: false
            },
            'headerDatePosition': {
                value: 'near',
                allowedValues: ['near', 'far'],
                type: 'string'
            },
            'headerNavigationStyle': {
                value: 'flat',
                allowedValues: ['flat', 'raised'],
                type: 'string'
            },
            'headerViewPosition': {
                value: 'far',
                allowedValues: ['near', 'far'],
                type: 'string'
            },
            'hideAllDay': { //Hides the all day panel along with the all-day events
                value: false,
                type: 'boolean'
            },
            'hideNonworkingWeekdays': { //Hides the nonworking days for all views except 'day' and 'timelineDay'
                value: false,
                type: 'boolean'
            },
            'hideOtherMonthDays': { //Determines whether other month days are visible or not in month view
                value: false,
                type: 'boolean'
            },
            'hideTodayButton': { //Hides the today button in the header
                value: false,
                type: 'boolean'
            },
            'hideViewMenuCheckableItems': { //Hides the 'show weekends' checkable item inside the view menu
                value: false,
                type: 'boolean'
            },
            'hideWeekend': { //Hides the nonworking days for all views except 'day' and 'timelineDay'
                value: false,
                type: 'boolean'
            },
            'legendLocation': {
                allowedValues: ['header', 'footer'],
                value: 'footer',
                type: 'string'
            },
            'legendPosition': {
                allowedValues: ['near', 'far'],
                value: 'near',
                type: 'string'
            },
            'legendLayout': {
                allowedValues: ['auto', '', 'menu'],
                value: 'auto',
                type: 'string'
            },
            'legendLayoutMenuBreakpoint': {
                value: 10,
                type: 'number'
            },
            'max': { //Maximal selectable date
                value: new Date(2100, 0, 1),
                type: 'any',
                validator: '_dateMaxValidator'
            },
            'maxEventsPerCell': { //Maximum tasks per cell
                value: null,
                type: 'number?',
            },
            'min': { //Minimal selectable date
                value: new Date(1900, 0, 1),
                type: 'any',
                validator: '_dateMinValidator'
            },
            'messages': {
                extend: true,
                value: {
                    'en': {
                        'invalidValue': '{{elementType}}: Invalid {{property}} value. {{property}} should be of type {{typeOne}} or {{typeTwo}}.',
                        'invalidTimeZone': '{{elementType}}: Invalid timeZone value. TimeZone should be the id of an allowed timeZone value.',
                        'incorrectArgument': '{{elementType}}: Incorrect argument {{argumentName}} in method {{methodName}}.',
                        'exceptionExists': '{{elementType}}: Trying to add an exception via {{methodName}} that already exists. Cannot have duplicate exception of the same event on same date.',
                        'noId': 'SmartScheduler requires an id in order to save/load/clear a state.',
                        'agenda': 'Agenda',
                        'agendaPlaceholder': 'No events to display',
                        'day': 'Day',
                        'week': 'Week',
                        'month': 'Month',
                        'allDay': 'All Day',
                        'timelineDay': 'Timeline Day',
                        'timelineWeek': 'Timeline Week',
                        'timelineMonth': 'Timeline Month',
                        'newEvent': 'New Event',
                        'ok': 'Ok',
                        'cancel': 'Cancel',
                        'delete': 'Delete',
                        'label': 'Label',
                        'dateStart': 'Start Date',
                        'dateEnd': 'End Date',
                        'repeat': 'Repeat',
                        'description': 'Description',
                        'repeatFreq': 'Repeat',
                        'repeatInterval': 'Repeat Every',
                        'repeatOn': 'Repeat On',
                        'repeatEnd': 'End Repeat',
                        'repeatEndOption': 'Never',
                        'repeatEndOnOption': 'On',
                        'repeatEndAfterOption': 'After',
                        'repeatEndAfter': 'occurrence(s)',
                        'hidden': 'Hidden',
                        'hourly': 'Hourly',
                        'daily': 'Daily',
                        'weekly': 'Weekly',
                        'monthly': 'Monthly',
                        'yearly': 'Yearly',
                        'repeatConfirm': 'Do you want to edit only the current event or the whole series ?',
                        'repeatConfirmLabel': 'Edit Repeating Event',
                        'create': 'Create Event on ',
                        'edit': 'Edit',
                        'cut': 'Cut',
                        'copy': 'Copy',
                        'paste': 'Paste',
                        'editEvent': 'Edit event',
                        'editSeries': 'Edit series',
                        'eventException': 'Event Exception',
                        'collector': 'more',
                        'repeatEveryHour': 'hours',
                        'repeatEveryDay': 'days',
                        'repeatEveryWeek': 'weeks',
                        'repeatEveryMonth': 'months',
                        'repeatEveryYear': 'years',
                        'backgroundColor': 'Background Color',
                        'status': 'Status',
                        'resources': 'Resources',
                        'selectPlaceholder': 'Select...',
                        'none': 'None',
                        'free': 'Free',
                        'busy': 'Busy',
                        'tentative': 'Tentative',
                        'outOfOffice': 'Out of Office',
                        'exceptions': 'Exceptions',
                        'resetExceptions': 'Reset Exceptions',
                        'notifications': 'Notification(s)',
                        'notificationMessage': 'is starting on',
                        'today': 'Today',
                        'agendaShortcut': 'A',
                        'dayShortcut': 'D',
                        'weekShortcut': 'W',
                        'monthShortcut': 'M',
                        'timelineDayShortcut': 'T+D',
                        'timelineWeekShortcut': 'T+W',
                        'timelineMonthShortcut': 'T+M',
                        'showWeekends': 'Show weekends',
                        'beforeAt': 'before at',
                        'days': 'days',
                        'weeks': 'weeks',
                        'placeholder': 'Add notification',
                        'placeholderLink': 'Add video conferencing',
                        'placeholderSetLink': 'Set video conferencing link',
                        'invalidConferenceLink': 'Invalid video conference link.',
                        'now': 'Now',
                        'dateTabLabel': 'DATE',
                        'timeTabLabel': 'TIME',
                        'hours': 'Hours',
                        'minutes': 'Minutes',
                        'am': 'am',
                        'pm': 'pm',
                        'loadingIndicatorPlaceholder': 'Loading...',
                        'duplicate': 'Copy',
                        'deleteConfirm': 'Do you want to delete only the current event or the whole repeating series ?',
                        'deleteConfirmLabel': 'Delete Repeating Event',
                        'deleteConfirmEvent': 'Delete Event',
                        'deleteConfirmSeries': 'Delete Series',
                        'joinWith': 'Join with {{value}}',
                        'join': 'Join the meeting',
                        'addTitle': 'Add Title',
                        'noDate': 'No date',
                        'unnamed': 'Unnamed',
                        'dropToUnschedule': 'Drop here to unschedule it',
                        'dropToSchedule': 'You can schedule these by dragging them onto the calendar',
                        'show': 'Events',
                        'showN': 'Events ({{value}} unscheduled)',
                        'all': 'All',
                        'withoutDates': 'Without dates',
                        'withDates': 'With dates',
                        'collision': 'This time slot is already reserved',
                        'navigateTo': 'Navigate to event'
                    }
                },
                type: 'object'
            },
            'minuteFormat': {
                value: '2-digit',
                allowedValues: ['numeric', '2-digit'],
                type: 'string'
            },
            'monthFormat': {
                value: 'long',
                allowedValues: ['2-digit', 'numeric', 'long', 'short', 'narrow'],
                type: 'string'
            },
            'mouseWheelStep': {
                value: 50,
                type: 'number'
            },
            'nonworkingDays': { //Define a list of non working dates(Date | String)/days(number)
                value: [],
                type: 'array',
                validator: '_nonworkingDayValidator'
            },
            'nonworkingHours': {
                value: [],
                type: 'array',
                validator: '_nonworkingTimeValidator'
            },
            'notificationInterval': {
                value: 60,
                validator: '_currentTimeIndicatorIntervalValidator',
                type: 'number'
            },
            'onItemInserted': {
                value: null,
                reflectToAttribute: false,
                type: 'function?'
            },
            'resizeHandlesVisibility': {
                allowedValues: ['auto', 'hidden', 'visible'],
                value: 'auto',
                type: 'string'
            },
            'resizeInterval': {
                value: 0,
                type: 'number'
            },
            'resources': {
                value: [],
                type: 'any',
                reflectToAttribute: false
            },
            'restrictedDates': {
                value: [],
                type: 'array',
                validator: '_datesValidator'
            },
            'restricted': {
                value: [],
                type: 'array'
            },
            'restrictedHours': {
                value: [],
                type: 'array',
                validator: '_nonworkingTimeValidator'
            },
            'specialDates': {
                value: [],
                type: 'array'
            },
            'scrollButtonsPosition': {
                value: 'near',
                allowedValues: ['near', 'far', 'both'],
                type: 'string'
            },
            'shadeUntilCurrentTime': {
                value: false,
                type: 'boolean'
            },
            'showLegend': {
                value: false,
                type: 'boolean'
            },
            'showList': {
                value: false,
                type: 'boolean'
            },
            'listWidth': {
                value: 250,
                type: 'number'
            },
            'sortBy': {
                value: null,
                type: 'string?'
            },
            'selectOne': {
                value: false,
                type: 'boolean'
            },
            'sortFunction': {
                value: null,
                type: 'function?'
            },
            'sortOrder': {
                allowedValues: ['asc', 'desc', 'custom'],
                value: 'asc',
                type: 'string'
            },
            'spinButtonsDelay': {
                value: 200,
                type: 'number'
            },
            'spinButtonsInitialDelay': {
                value: 0,
                type: 'number'
            },
            'statuses': {
                value: [{ label: 'None', value: undefined },
                { label: 'Free', value: 'free' }, { label: 'Tentative', value: 'tentative' },
                { label: 'Busy', value: 'busy' }, { label: 'Out of Office', value: 'outOfOffice' }],
                type: 'array'
            },
            'timelineHeaderFormatFunction': { //Allows to reformat the Timeline header
                value: null,
                type: 'function?',
                reflectToAttribute: false
            },
            'timelineDayScale': { //Determines the scale of a day cell
                value: 'hour',
                allowedValues: ['hour', 'halfHour', 'quarterHour', 'tenMinutes', 'fiveMinutes'],
                type: 'string'
            },
            'timeRulerTicks': {
                value: false,
                type: 'boolean'
            },
            'timeZone': { //Custom time zone. This option accepts a time zone id from Smart.Utilities.DateTime
                value: 'local',
                type: 'string',
                validator: '_timeZoneValidator'
            },
            'timeZones': { //Determines the visible timeZones in the vertical header
                value: [],
                type: 'array',
                validator: '_timeZonesValidator'
            },
            'tooltipDelay': {
                value: 0,
                type: 'number'
            },
            'tooltipOffset': {
                value: [],
                type: 'array'
            },
            'undoRedoSteps': {
                value: 100,
                type: 'number'
            },
            'view': { //Shows the current view
                value: 'day',
                type: 'string',
                validator: '_viewValidator'
            },
            'viewType': { //Returns the view type
                allowedValues: ['agenda', 'day', 'week', 'month', 'timelineDay', 'timelineWeek', 'timelineMonth'],
                defaultReflectToAttribute: true,
                value: 'day',
                type: 'string',
                validator: '_viewTypeValidator'
            },
            'views': {  //Predefined view Options for the Header
                value: ['day', 'week', 'month'],
                type: 'array',
                validator: '_viewsValidator'
            },
            'viewSelectorType': { //Determines the selector type for the View selector. 'auto' will determine the type depending on the space avaiable
                allowedValues: ['auto', 'tabs', 'menu'],
                value: 'menu',
                type: 'string',
            },
            'viewStartDay': {
                value: 'firstDayOfWeek',
                type: 'string',
                allowedValues: ['dateCurrent', 'firstDayOfWeek']
            },
            'weekdayFormat': {
                value: 'short',
                allowedValues: ['long', 'short', 'narrow'],
                type: 'string'
            },
            'yearFormat': {
                value: 'numeric',
                allowedValues: ['2-digit', 'numeric'],
                type: 'string'
            },
            'windowCustomizationFunction': {
                value: null,
                reflectToAttribute: false,
                type: 'function?'
            }
        };
    }

    /*
    *  "conferenceData": { "createRequest": { "requestId": "7qxalsvy0e" } */
    /**
     * Events Fired by the element
     */
    //'dateChange' - fired when the dateCurrent is changed
    // 'dragStart' - fired when dragging is started
    // 'dragEnd' - fired when dragging is completed
    // 'resizeStart' - fired when resizing is started
    // 'resizeEnd' - fired when resizing ends
    // 'itemInsert' - fired when a new eventItem is inserted
    // 'itemUpdate' - fired when an eventItem is updated
    // 'itemRemove' - fired when an eventItem is removed
    // 'itemClick' - fired when an item(event rr menu item) is clicked
    // 'itemChange' - fired when an event item is changed
    // 'itemChanging' - fired when an event item is going to be changed ( removed, updated, inserted)
    // 'editDialogOpening', - fored when the edit dialog is opening
    // 'editDialogOpen' - fired when the edit dialog is opened
    // 'editDialogClose' - fired when the edit dialog is closed
    // 'editDialogClosing' - fired when the edit dialog is closing
    // 'contextMenuOpen' - fired when the context menu is opened
    // 'contextMenuOpening' - fired when the context menu is opening
    // 'contextMenuClose' - fired when the context menu is closed
    // 'contextMenuClosing' - fired when the context menu is closing
    // 'eventMenuOpen' - fired when the event menu is opened
    // 'eventMenuOpening' - fired when the event menu is opening
    // 'eventMenuClose' - fired when the event menu is closed
    // 'eventMenuClosing' - fired when the event menu is closing
    // 'dateMenuOpen' - fired when the date menu is opened
    // 'dateMenuClose' - fired when the date menu is closed
    // 'viewMenuOpen' - fired when the view menu is opened
    // 'viewMenuClose' - fired when the view menu is closed
    // 'notificationOpen' - fired when a notification is opened
    // 'notificationClose' - fired when a notification is closed
    // 'change' - selection change
    // 'viewChange' - fired when the view is changed
    // 'eventShortcutKey' - fired when a view shortcut key is pressed

    /** Element's template. */
    template() {
        return `<div id="container" role="presentation">
                    <div id="header" class="smart-scheduler-header" role="heading" aria-level="1">
                        <div id="dateSelectorContainer" class="smart-scheduler-date-nav" role="presentation">
                            <smart-button today id="todayDate" right-to-left="[[rightToLeft]]" class="smart-scheduler-nav"></smart-button>
                            <smart-repeat-button prev id="previousDate" initial-delay="[[spinButtonsInitialDelay]]" delay="[[spinButtonsDelay]]"
                             aria-label="Previous date" class="smart-scheduler-nav"></smart-repeat-button>
                             <smart-repeat-button next id="nextDate" initial-delay="[[spinButtonsInitialDelay]]" delay="[[spinButtonsDelay]]"
                              aria-label="Next date" class="smart-scheduler-nav"></smart-repeat-button>
                            <smart-button current id="currentDate" right-to-left="[[rightToLeft]]" class="smart-scheduler-nav"></smart-button>
                        </div>
                        <div id="viewSelectorContainer" class="smart-scheduler-view-nav" role="presentation">
                            <div id="viewItemsContainer" class="smart-scheduler-items-container" role="listbox" aria-label="View Items"></div>
                            <smart-button id="viewItemsButton" class="smart-scheduler-view-items-button smart-visibility-hidden"
                            aria-label="View Selector DropDown" right-to-left="[[rightToLeft]]"></smart-button>
                            <smart-button id="viewListButton" style="display: none;" class="smart-scheduler-list-button smart-scheduler-view-list-button smart-hidden"
                            aria-label="View List DropDown" right-to-left="[[rightToLeft]]"></smart-button>
                        </div>
                    </div>
                    <div class="smart-scheduler-view-container" id="viewContent" role="presentation">
                        <div id="timeline" class="smart-scheduler-view">
                                <div id="timelineHeaderHorizontal" class="smart-scheduler-view-header-horizontal" role="rowgroup">
                                    <div class="smart-scheduler-view-time-container" id="timelineViewCellsContainer" role="presentation">
                                        <div class="smart-scheduler-view-label-container" id="timelineViewCellsLabelContainer" role="row"></div>
                                        <div class="smart-scheduler-view-header-horizontal-content" id="timelineHeaderHorizontalContent" role="presentation">
                                            <div class="smart-scheduler-view-details"></div>
                                            <div class="smart-scheduler-view-time">
                                                <div class="smart-scheduler-cells" role="row"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="smart-scheduler-view-all-day" id="timelineViewAllDay" role="presentation">
                                        <div class="smart-scheduler-view-all-day-label-container" id="timelineAllDayLabelContainer" role="presentation">
                                            <div class="smart-scheduler-view-all-day-label" id="timelineViewAllDaylabel" role="presentation"></div>
                                            <div class="smart-scheduler-time-zone-container" id="timelineTimeZoneLabelContainer"></div>
                                        </div>
                                        <div class="smart-scheduler-view-all-day-content" id="timelineViewAllDayContent" role="presentation">
                                            <div class="smart-scheduler-cells-container" id="timelineViewAllDayCellsContainer" role="row"></div>
                                            <div class="smart-scheduler-events-container" id="allDayEventsContainer" role="row"></div>
                                        </div>
                                    </div>
                                </div>
                                <div id="timelineHeaderVertical" class="smart-scheduler-view-header-vertical" role="rowgroup">
                                    <div class="smart-scheduler-view-header-vertical-content" id="timelineHeaderVerticalContent" role="presentation">
                                        <div class="smart-scheduler-view-time" role="row">
                                            <div class="smart-scheduler-cells" role="presentation"></div>
                                        </div>
                                    </div>
                                </div>
                                <div id="timelineContainer" class="smart-scheduler-scrollable-container" role="rowgroup">
                                    <div id="timelineContent" class="smart-scheduler-content" role="presentation">
                                        <div id="timelineCellsContainer" class="smart-scheduler-cells-container" role="presentation"></div>
                                        <div id="timelineEventsContainer" class="smart-scheduler-events-container" role="row"></div>
                                        <div id="timelineIndicatorsContainer" class="smart-scheduler-indicators-container" role="presentation"></div>
                                    </div>
                                </div>
                        </div>
                        <smart-scroll-bar wait id="verticalScrollBar" class="smart-scheduler-view-scroll-bar" orientation="vertical"
                        right-to-left="[[rightToLeft]]" aria-controls="[[id]]" animation="[[animation]]"></smart-scroll-bar>
                        <smart-scroll-bar wait id="horizontalScrollBar" class="smart-scheduler-view-scroll-bar"
                        right-to-left="[[rightToLeft]]" aria-controls="[[id]]" animation="[[animation]]"></smart-scroll-bar>
                    </div>
                    <div id="footer" class="smart-scheduler-footer"></div>
                    <smart-tooltip id="tooltip" class="smart-scheduler-tooltip" role="presentation" position="auto" arrow open-mode="manual"
                        right-to-left="[[rightToLeft]]"  delay="[[tooltipDelay]]" offset="[[tooltipOffset]]"></smart-tooltip>
                </div>`
    }

    static get listeners() {
        return {
            'down': '_downHandler',
            'document.move': '_documentMoveHandler',
            'document.up': '_documentUpHandler',
            'document.dragstart': '_dragStartHandler',
            'container.click': '_containerClickHandler',
            'container.contextmenu': '_containerContextMenuHandler',
            'container.wheel': '_mouseWheelHandler',
            'horizontalScrollBar.change': '_horizontalScrollbarHandler',
            'verticalScrollBar.change': '_verticalScrollbarHandler',
            'keydown': '_keyDownHandler',
            'keyup': '_keyUpHandler',
            'move': '_moveHandler',
            'dragover': '_dragoverHandler',
            'drop': '_dropHandler',
            'resize': '_resizeEventHandler',
            'tooltip.open': '_tooltipVisibilityHandler',
            'tooltip.opening': '_tooltipVisibilityHandler',
            'tooltip.closing': '_tooltipVisibilityHandler',
            'tooltip.close': '_tooltipVisibilityHandler',
            'tooltip.change': '_tooltipChangeHandler',
            'tooltip.click': '_tooltipClickHandler',
            'tooltip.keydown': '_tooltipKeyDownHandler',
            'tooltip.keyup': '_tooltipKeyUpHandler',
            'tooltip.down': '_tooltipDownHandler',
            'tooltip.contextmenu': '_tooltipContextMenuHandler',
            'timeline.focus': '_timelineFocusHandler',
            'timeline.focusin': '_timelineFocusHandler',
            'timeline.focusout': '_timelineFocusHandler',
            'viewListButton.pointerdown': '_viewListHandler'
        }
    }

    /**
    * CSS files needed for the element (ShadowDOM)
    */
    static get styleUrls() {
        return [
            'smart.scheduler.css'
        ]
    }

    /**
     * * Checks for missing modules.
     * */
    static get requires() {
        return {
            'Smart.Window': 'smart.window.js',
            'Smart.Calendar': 'smart.calendar.js',
            'Smart.Tooltip': 'smart.tooltip.js'
        }
    }

    /**
     * Property Change handler
     * @param {any} propertyName
     * @param {any} oldValue
     * @param {any} newValue
     */
    propertyChangedHandler(propertyName, oldValue, newValue) {
        super.propertyChangedHandler(propertyName, oldValue, newValue);

        const that = this;

        switch (propertyName) {
            case 'showList': {
                that._refreshViewList();
                break;
            }
            case 'contextMenuClipboardActions': {
                const tooltip = that.$.tooltip;

                if (tooltip.visible && tooltip.contains(that._contextList)) {
                    that._getContextMenu(tooltip.selector);
                }

                break;
            }
            case 'dataSource':
                that._handleDataAdapter();
                that._createEvents();
                that._createTimeline();
                that.closeWindow();
                break;
            case 'disabled':
                that._setFocusable();
                that._refreshEvents();
                break;
            case 'disableSelection':
                that._handleCellSelection();
                break;
            case 'disableContextMenu':
            case 'disableDateMenu':
            case 'disableEventMenu':
            case 'disableViewMenu':
                that.$.tooltip.close();
                break;
            case 'disableWindowEditor':
                that.closeWindow();
                break;
            case 'currentTimeIndicator':
            case 'shadeUntilCurrentTime':
                that._setCurrentTimeIndicators();
                break;
            case 'eventRenderMode':
                that._refreshEvents();
                break;
            case 'filter':
            case 'filterable':
            case 'filterMode':
                if (propertyName === 'filter') {
                    const legend = that._legend;

                    if (legend && that.$.container.contains(legend)) {
                        legend.querySelectorAll('.smart-scheduler-legend-res-item').forEach(i => {
                            i.removeAttribute('unselected');
                            i.setAttribute('aria-selected', true);
                        });
                    }

                    delete that._eventsBetween;
                    that._createTimeline();
                }
                else {
                    that._refreshTimelineEvents();
                }
                break;
            case 'autoHeightAllDayCells':
            case 'firstDayOfWeek':
            case 'viewStartDay':
            case 'max':
            case 'min':
                if (that._calendar) {
                    that._calendar[propertyName] = newValue;
                }

                that._createTimeline();
                that._refreshDateNavButtons();
                that._refreshDateSelector();

                break;
            case 'maxEventsPerCell':
                that._refreshEvents();
                break;
            case 'hideAllDay':
                if (['day', 'week'].indexOf(that.viewType) > -1) {
                    that._createTimeline();
                }
                break;
            case 'hideOtherMonthDays':
                that._refreshTimelineEvents();
                break;
            case 'hideWeekend':
            case 'hideNonworkingWeekdays':
                that._checkHideWekendItem();
                if (that.viewType.toLowerCase().indexOf('day') < 0) {
                    that._createTimeline();
                }
                break;
            case 'hideViewMenuCheckableItems':
                that._refreshViewSelector();
                break;
            case 'timeZone': {
                that._events.forEach(e => that._setEventTimeZone(e, oldValue));
                that._createTimeline();
                break;
            }
            case 'timeZones':
                that._createTimeline();
                break;
            case 'dateCurrent':
            case 'groups':
            case 'groupOrientation':
            case 'hourStart':
            case 'hourEnd':
            case 'nonworkingDays':
            case 'nonworkingHours':
            case 'timelineDayScale':
            case 'resources':
            case 'rightToLeft': {
                const schedulerWindow = that.$.schedulerWindow,
                    confirmSchedulerWindow = that.$.confirmSchedulerWindow;

                [that.$.toast, that.$.tooltip, that._calendar, that._list, schedulerWindow, confirmSchedulerWindow].
                    forEach(w => w ? w[propertyName] = newValue : undefined);

                if (schedulerWindow && schedulerWindow.opened) {
                    const editors = schedulerWindow.querySelectorAll('.smart-element[event-editor]'),
                        buttonPosition = newValue ? 'left' : 'right';

                    for (let i = 0; i < editors.length; i++) {
                        const editor = editors[i];

                        editor[propertyName] = newValue;

                        if (editor.calendarButtonPosition) {
                            editor.calendarButtonPosition = buttonPosition;
                        }
                        else if (editor.dropDownButtonPosition !== 'none') {
                            editor.dropDownButtonPosition = buttonPosition;
                        }
                    }
                }

                if (propertyName === 'groups' && that.$.timeline) {
                    that.$.timeline.removeAttribute('show-group-header');
                }
                if (propertyName === 'resources') {
                    that._setLegend();
                }

                that._createTimeline();
                that._refreshDateSelector();
                break;
            }
            case 'sortBy':
            case 'sortOrder':
            case 'sortFunction':
                that._createTimeline();
                break;
            case 'undoRedoSteps':
                delete that._undoRedoHistory;
                break;
            case 'view':
                that._handleViewSelection();
                that._createTimeline();
                that._refreshDateSelector();
                that._scrollToView();
                that.$.fireEvent('viewChange', { oldValue: oldValue, value: newValue });
                break;
            case 'views':
                that._handleViewSelection();
                that._createTimeline();
                that._refreshDateSelector();
                that._refreshViewSelector();
                break;
            case 'viewSelectorType':
                that._setHeader();
                break;
            case 'headerTemplate':
                that._setHeader();
                that._createTimeline();
                break;
            case 'footerTemplate':
                that._setFooter();
                that._createTimeline();
                break;
            case 'cellTemplate':
            case 'groupTemplate':
                if (that._templates) {
                    delete that._templates[propertyName];
                }
                that._createTimeline();
                break;
            case 'unfocusable':
                that._setFocusable();
                that._refreshEvents();
                break;
            case 'hourFormat':
            case 'minuteFormat':
            case 'dayFormat':
            case 'monthFormat':
            case 'weekdayFormat':
            case 'yearFormat':
            case 'dateSelectorFormatFunction':
            case 'timelineHeaderFormatFunction':
            case 'messages':
            case 'locale': {
                that._createTimeline();
                that._setHeader();

                if (that._calendar && propertyName === 'locale') {
                    that._calendar[propertyName] = newValue;
                }

                //Re-open the window if already opened
                const schedulerWindow = that.$.schedulerWindow,
                    confirmWindow = that.$.confirmSchedulerWindow;

                if (schedulerWindow && schedulerWindow.opened) {
                    const windowTarget = schedulerWindow._target;

                    schedulerWindow.close();
                    that._openWindow(windowTarget.event, windowTarget.originalTarget);
                }
                else if (confirmWindow && confirmWindow.opened) {
                    const windowTarget = confirmWindow._target;

                    confirmWindow.close();
                    that._openWindow(windowTarget.event, windowTarget.originalTarget);
                }

                break;
            }
            case 'legendLocation':
            case 'showLegend':
                that._setLegend();
                that._createTimeline();
                break;
            case 'restrictedDates':
            case 'restrictedHours':
                delete that._eventsBetween;
                that._createTimeline();
                break;
            case 'windowCustomizationFunction': {
                const popupWindow = that.$.schedulerWindow || that.$.confirmSchedulerWindow;

                if (!popupWindow) {
                    return;
                }

                if (newValue === null) {
                    popupWindow.clear();
                }
                else if (popupWindow.opened) {
                    const type = popupWindow === that.$.confirmSchedulerWindow ? 'confirm' : '';

                    that.windowCustomizationFunction(popupWindow, type, that._cloneObject(popupWindow._target));
                }
                break;
            }
        }
    }

    /**
    * Element Attached method. Called when element is attached to the DOM.
    */
    attached() {
        const that = this;

        super.attached();

        //Handle ScrollViewer events
        if (!that._scrollView) {
            that._scrollView = new Smart.Utilities.Scroll(that.$.timeline, that.$.horizontalScrollBar, that.$.verticalScrollBar);
        }

        const popupWindows = [that.$.schedulerWindow, that.$.confirmSchedulerWindow],
            tooltip = that.$.tooltip;

        if (tooltip.visible) {
            that.getShadowRootOrBody().appendChild(tooltip);
        }

        for (let i = 0; i < popupWindows.length; i++) {
            const popupWindow = popupWindows[i];

            if (popupWindow && popupWindow.opened) {
                const popupWindowExtended = that.$schedulerWindow;

                //Open the modal
                that._handleModal(true);

                //Bind to events
                popupWindowExtended.listen('open', that._windowOpenHandler.bind(that));
                popupWindowExtended.listen('close', that._windowCloseHandler.bind(that));
                popupWindowExtended.listen('closing', that._windowClosingHandler.bind(that));
                popupWindowExtended.listen('click', that._windowClickHandler.bind(that));
                popupWindowExtended.listen('change', that._windowChangeHandler.bind(that));
                popupWindowExtended.listen('keydown', that._windowKeyDownHandler.bind(that));

                if (popupWindow.hasAnimation) {
                    popupWindow.listen('transitionend', that._windowTransitionendHandler.bind(that));
                }

                that.getShadowRootOrBody().appendChild(popupWindow);
            }
        }

        //Refreshes the notifications
        if (!that.$.container.contains(that.$.toast)) {
            that._checkNotifications(true);
        }
    }

    /**
     * Element Detached method. Called when the element is detached from the DOM.
     */
    detached() {
        const that = this;

        super.detached();

        //Handle ScrollView events
        if (that._scrollView) {
            that._scrollView.unlisten();
            that._scrollView.disableSwipeScroll = false;
            delete that._scrollView;
        }

        that._touchmoveInside = false;
        delete that._dragDetails;

        if (Smart.Scheduler.schedulerStart === that) {
            //Remove the feedback element
            Smart.Scheduler.feedback.remove();

            delete Smart.Scheduler.schedulerStart;
            delete Smart.Scheduler.hoveredCell;
            delete Smart.Scheduler.hoveredScheduler;
            delete Smart.Scheduler.feedback;
        }

        const popupWindows = [that.$.schedulerWindow, that.$.confirmSchedulerWindow],
            tooltip = that.$.tooltip;

        if (!that.$.container.contains(tooltip)) {
            that.$.container.appendChild(tooltip);
        }

        //Removes Toast from the DOM and detaches it's event listeners
        that._removeToast();

        for (let i = 0; i < popupWindows.length; i++) {
            const popupWindow = popupWindows[i];

            //Remove the modal
            that._handleModal();

            if (popupWindow) {
                popupWindow.remove();

                const popupWindowExtended = popupWindow === that.$.schedulerWindow ? that.$schedulerWindow : that.$confirmSchedulerWindow;

                popupWindowExtended.unlisten('open');
                popupWindowExtended.unlisten('close');
                popupWindowExtended.unlisten('closing');
                popupWindowExtended.unlisten('click');
                popupWindowExtended.unlisten('change');
                popupWindowExtended.unlisten('keydown');
                popupWindowExtended.unlisten('transitionend');
            }
        }
    }

    /**
    * Scheduler's ready function. Called on initialization
    */
    ready() {
        //Used in Smart.ScrollViewer. Indicates that the ScrollView object will be custom
        this._customScrollView = true;

        super.ready();
    }

    /**
     * Renders the element
     */
    render() {
        const that = this;

        const view = that.viewType.toLowerCase();
        if (that.firstDayOfWeek !== 0 && view.indexOf('week') > -1) {
            if (that.dateCurrent && that.dateCurrent.getDay() !== that.firstDayOfWeek) {
                const dayOfWeek = that.dateCurrent.getDay() - that.firstDayOfWeek;

                that.dateCurrent = that.dateCurrent.setDate(that.dateCurrent.getDate() - that.dateCurrent.getDay() + that.firstDayOfWeek - (dayOfWeek > 0 ? 0 : 7));
            }
        }

        //Sets the viewType prop based on the view
        that._isViewUpdated = true;
        that._setViewType(that.view);
        delete that._isViewUpdated;

        //Accessibility
        if (!that.$.timeline.hasAttribute('role')) {
            that.$.timeline.setAttribute('role', 'grid');
        }

        //Check if RRule is present
        if (!window.rrule || !window.rrule.RRule) {
            that.error(that.localize('missingReference', { elementType: that.nodeName.toLowerCase(), files: 'rrule.min.js' }));
        }

        that._rRule = window.rrule.RRule;
        if (that._rRule && window.rrule.RRule.RRule) {
            that._rRule = window.rrule.RRule.RRule;
        }
        //Used for eventRenderMoude 'modern' on mobile, where the event collectors are styled differently
        if (Smart.Utilities.Core.isMobile) {
            that._isMobile = true;
            that.$.timeline.setAttribute('mobile', '');
            that.autoCreateDialog = false;
        }

        //Handles the dataSource if set to a DataAdapter
        that._handleDataAdapter();

        //Configures the ScrollBars
        that._setFocusable();
        that._setScrollBars();
        that._setHeader();
        that._setFooter();
        that._createEvents();
        that._createTimeline();
        that.checkLicense();


        super.render();
    }

    /**
     * Events getter
     */
    get events() {
        const that = this,
            events = that._events;

        if (!that.isReady || !events || !events.length) {
            return [];
        }

        return events.map(t => that._cloneObject(t));
    }

    /**
     * Create an event
     * @param {object} event - a Scheduler event object definition. Same as when defining the dataSource
     */
    addEvent(event, callback) {
        this.insertEvent(event, -1, callback);
    }

    /**
     * Returns true or false whether the Scheduler contains the event or not
     * @param {*} event - a Scheduler event
     */
    containsEvent(event) {
        return !!this._containsEvent(event)
    }

    /**
     * Clears the previously saved state
     */
    clearState() {
        const that = this;

        if (!that.id) {
            that.warn(that.localize('noId'));
            return;
        }

        window.localStorage.removeItem('SmartScheduler' + that.id);
    }

    /**
     * Returns the current state of the Element as JSON
     */
    getState() {
        const that = this,
            events = that._events || [];

        return {
            dateCurrent: that.dateCurrent.toISOString(),
            dataSource: JSON.parse(JSON.stringify(events.map(t => that._cloneObject(t, true)))),
            timeZone: that.timeZone
        }
    }

    /**
     * Loads a previously saved state of the element
     * @param {any} state - must be an array of tasks
     */
    loadState(state) {
        const that = this;

        if (!state) {
            if (!that.id) {
                return;
            }

            state = JSON.parse(window.localStorage.getItem('SmartScheduler' + that.id));
        }

        if (!state) {
            return;
        }

        //Fresh copy of the data
        let dataSource = JSON.parse(JSON.stringify(state.dataSource)),
            dateCurrent = new Date(state.dateCurrent),
            timeZone = state.timeZone;

        if (dateCurrent instanceof Date && !isNaN(dateCurrent.getTime())) {
            //Update the dateCurrent property
            that.set('dateCurrent', dateCurrent);
            that._refreshDateSelector();
        }

        if (Array.isArray(dataSource)) {
            //Update the dataSource property
            that.set('dataSource', dataSource);
            that._createEvents(undefined, timeZone);
            that._createTimeline();
        }
    }

    /**
     * Saves the current state of the Layout
     * @param {array} state - a Scheduler state
     */
    saveState(state) {
        const that = this;

        if (!that.id) {
            that.warn(that.localize('noId'));
            return;
        }

        if (!state) {
            state = that.getState();
        }

        //Save to LocalStorage
        window.localStorage.setItem('SmartScheduler' + that.id, JSON.stringify(state));
    }

    createEvent(label, value, dateStart, dateEnd, allDay, description = '') {
        const that = this;

        const dataEvent = {
            label: label,
            value: value,
            id: value,
            dateStart: dateStart,
            dateEnd: dateEnd,
            description: description,
            allDay: allDay
        }

        that.addEvent(dataEvent);
    }
    /**
     * Create an event
     * @param {object} event - a Scheduler event object definition. Same as when defining the dataSource
     * @param {number} index - optional index to indicate the position where the event will be inserted
     */
    insertEvent(event, index, callback) {
        const that = this,
            events = that._events;

        //Duplicate event
        if (events.indexOf(event) > -1 || that._containsEvent(event)) {
            return;
        }

        const newEvent = that._createEvents(Array.isArray(event) ? event : [event])[0];

        if (!newEvent) {
            return
        }

        const itemCopy = that._cloneObject(newEvent);

        if (that.$.fireEvent('itemChanging', { type: 'inserting', item: itemCopy }).defaultPrevented) {
            return
        }

        if (typeof index === 'number') {
            events.splice(Math.max(0, Math.min(events.length, index)), 0, newEvent);
        }
        else {
            events.push(newEvent);
        }

        if (that._isUpdating) {
            return
        }

        that._refreshTimelineEvents();
        that._updateUndoRedo(undefined, that._cloneObject(newEvent), 'itemInsert');

        that.$.fireEvent('itemInsert', { item: itemCopy });
        that.$.fireEvent('itemChange', { type: 'insert', item: itemCopy });

        if (that.onItemInserted) {
            that.onItemInserted(itemCopy, callback);
        }
    }

    /**
     * Update an appintment
     * @param {object | number} event - a Scheduler event object or it's index
     * @param {object} details - a Scheduler event object details (includes properties of an event)
     */
    updateEvent(event, details) {
        const that = this,
            events = that._events;

        if (typeof event === 'number' && events) {
            event = events[event];
        }
        else {
            event = that._containsEvent(event);
        }

        if (!event) {
            return
        }

        const itemCopy = that._cloneObject(event);

        if (that.$.fireEvent('itemChanging', { type: 'updating', item: itemCopy }).defaultPrevented) {
            return
        }

        for (let d in details) {
            event[d] = details[d];
        }

        //TODO: Validate the details first
        event.dateStart = that._dateValidator(undefined, event.dateStart);
        event.dateEnd = that._dateValidator(undefined, event.dateEnd);
        event.dateEnd = new Date(Math.max(event.dateStart.getTime(), event.dateEnd.getTime()));

        if (that._isUpdating) {
            return
        }

        that._refreshTimelineEvents();

        that.$.fireEvent('itemUpdate', { item: itemCopy });
        that.$.fireEvent('itemChange', { type: 'update', item: itemCopy });
    }

    /**
    * Update an appintment
    * @param {object | number} event - a Scheduler event object or it's index
    */
    getEvent(eventId) {
        const that = this;

        if (that._events) {
            for (let i = 0; i < that._events.length; i++) {
                const eventObj = that._events[i];

                if (eventObj) {
                    if (eventObj.id === undefined) {
                        return that._events[eventId];
                    }

                    if (eventObj.id === eventId) {
                        return eventObj;
                    }
                }
            }
        }

        if (that._noDateEvents) {
            for (let i = 0; i < that._noDateEvents.length; i++) {
                const eventObj = that._noDateEvents[i];

                if (eventObj) {
                    if (eventObj.id === undefined) {
                        return that._noDateEvents[eventId];
                    }

                    if (eventObj.id === eventId) {
                        return eventObj;
                    }
                }
            }
        }


        return null;
    }

    focusEvent(eventId) {
        const that = this;

        const eventObj = that.getEvent(eventId);

        if (eventObj) {
            const allEventElements = that.querySelectorAll('.smart-scheduler-event');
            allEventElements.forEach(element => element.removeAttribute('hover'));
            const eventElements = that.querySelectorAll('.smart-scheduler-event[id="' + eventId + '"]');

            if (eventElements.length) {
                for (let i = 0; i < eventElements.length; i++) {
                    const eventElement = eventElements[i];
                    eventElement.setAttribute('hover', '');
                }
            }
        }
    }

    refreshEvents() {
        const that = this;
        that._refreshTimelineEvents();
    }
    /**
     * Remove an appintment
     * * @param {object | number} event - a Scheduler event object or it's index
     */
    removeEvent(event) {
        const that = this,
            events = that._events;

        if (typeof event === 'number' && events) {
            event = events[event];
        }
        else {
            event = that._containsEvent(event);
        }

        if (!event) {
            return
        }

        const itemCopy = that._cloneObject(event);

        if (that.$.fireEvent('itemChanging', { type: 'removing', item: itemCopy }).defaultPrevented) {
            return;
        }

        events.splice(events.indexOf(event), 1);

        if (that._isUpdating) {
            return
        }

        //Refresh the Timeline events
        that._refreshTimelineEvents();
        that._updateUndoRedo(that._cloneObject(event), undefined, 'itemRemove');


        that.$.fireEvent('itemRemove', { item: itemCopy });
        that.$.fireEvent('itemChange', { type: 'remove', item: itemCopy });
    }

    /**
     * Returns the exceptions of a repeating event
     */
    getEventExceptions(event) {
        const that = this,
            events = that._events;

        if (typeof event === 'number' && events) {
            event = events[event];
        }
        else {
            event = that._containsEvent(event);
        }

        if (!event || !event.repeat) {
            return []
        }

        const eventExceptions = event.repeat.exceptions;

        if (!eventExceptions || !eventExceptions.length) {
            return []
        }

        return eventExceptions
    }

    /**
     * Adds an exception to a repeating event
     * @param {object} eventObj - the target repeating event object to add an exception to
     * @param {ObjectConstructor} occurrenceObj - the exception object that shuld be added
     * @returns 
     */
    addEventException(eventObj, occurrenceObj) {
        const that = this,
            events = that._events;

        if (typeof eventObj === 'number' && events) {
            eventObj = events[eventObj];
        }
        else {
            eventObj = that._containsEvent(eventObj);
        }

        if (!eventObj || !eventObj.repeat) {
            return []
        }

        if (!occurrenceObj || typeof occurrenceObj !== 'object' || !(occurrenceObj.date instanceof Date)) {
            return
        }

        const exceptionDate = occurrenceObj.date;
        let exceptions = eventObj.repeat.exceptions;

        if (!exceptions) {
            exceptions = eventObj.repeat.exceptions = [];
        }

        delete occurrenceObj.repeat;

        for (let i = 0, max = exceptions.length; i < max; i += 1) {
            const exception = exceptions[i];

            if (exception.date.getTime() === exceptionDate.getTime()) {
                that.error(that.localize('exceptionExists', { elementType: that.nodeName.toLowerCase(), elementMethod: 'addEventException' }));
                return
            }
        }

        if (that.$.fireEvent('itemChanging', { type: 'exceptionInserting', item: that._cloneObject(eventObj) }).defaultPrevented) {
            return
        }

        exceptions.push(occurrenceObj);

        if (that._isUpdating) {
            return
        }

        that._refreshTimelineEvents();
        that.$.fireEvent('itemChange', { type: 'exceptionInsert', item: that._cloneObject(eventObj) });
    }

    /**
     * Updates an existing event exception
     * @param {object} eventObj - the target repeating event
     * @param {number | string | date} exceptionRef - a reference to the exception, which can be the index, id or date of occurence
     * @param {object} exceptionObj - the exception details to update
     * @returns 
     */
    updateEventException(eventObj, exceptionRef, exceptionObj) {
        const that = this,
            events = that._events;

        if (typeof eventObj === 'number' && events) {
            eventObj = events[eventObj];
        }
        else {
            eventObj = that._containsEvent(eventObj);
        }

        if (!eventObj || !eventObj.repeat || exceptionRef === undefined || exceptionRef === null || !exceptionObj || typeof exceptionObj !== 'object') {
            return []
        }

        const exceptions = eventObj.repeat.exceptions;

        if (!exceptions || !exceptions.length) {
            return []
        }

        let targetException;

        if (typeof exceptionRef === 'number') {
            targetException = exceptions.indexOf(exceptionRef);
        }

        if (!targetException) {
            const dateRef = exceptionRef instanceof Date ? exceptionRef : new Date(exceptionObj.date);

            for (let i = 0, max = exceptions.length; i < max; i += 1) {
                const exception = exceptions[i];

                if (i === exceptionRef) {
                    targetException = exception;
                }

                if (exception.id === exceptionRef || exception.date.getTime() === dateRef.getTime()) {
                    targetException = exception;
                    break;
                }
            }
        }

        if (targetException) {
            if (that.$.fireEvent('itemChanging', { type: 'exceptionUpdating', item: that._cloneObject(eventObj) }).defaultPrevented) {
                return
            }

            //Update the event
            for (let p in exceptionObj) {
                if (p !== 'date' && p !== 'repeat' && p !== '$') {
                    targetException[p] = p === 'dateStart' || p === 'dateEnd' ? that._dateValidator(undefined, exceptionObj[p]) : exceptionObj[p];
                }
            }

            //Validate the dateStart/dateEnd
            targetException.dateEnd = new Date(Math.max(targetException.dateStart.getTime(), targetException.dateEnd.getTime()));

            if (that._isUpdating) {
                return
            }

            that._refreshTimelineEvents();
            that.$.fireEvent('itemChange', { type: 'exceptionUpdate', item: that._cloneObject(eventObj) });
        }
    }

    /**
    * Remove an exception of a repeating event
    */
    removeEventException(eventObj, ref) {
        const that = this,
            events = that._events;

        if (typeof eventObj === 'number' && events) {
            eventObj = events[eventObj];
        }
        else {
            eventObj = that._containsEvent(eventObj);
        }

        if (!eventObj || !eventObj.repeat) {
            return
        }

        const exceptions = eventObj.repeat.exceptions;

        if (!exceptions || !exceptions.length) {
            return
        }

        let exceptionIndex = exceptions.indexOf(ref);

        if (exceptionIndex < 0) {
            const dateRef = new Date(ref);

            for (let i = 0, max = exceptions.length; i < max; i += 1) {
                const exception = exceptions[i];

                if (i === ref) {
                    exceptionIndex = i;
                }

                if (exception.id === ref || exception.date.getTime() === dateRef.getTime()) {
                    exceptionIndex = i;
                    break;
                }
            }
        }

        if (exceptionIndex > -1) {
            if (that.$.fireEvent('itemChanging', { type: 'exceptionRemoving', item: that._cloneObject(eventObj) }).defaultPrevented) {
                return
            }

            exceptions.splice(exceptionIndex, 1);

            if (!exceptions.length) {
                delete eventObj.repeat.exceptions;
            }

            if (that._isUpdating) {
                return
            }

            that._refreshTimelineEvents();
            that.$.fireEvent('itemChange', { type: 'exceptionRemove', item: that._cloneObject(eventObj) });
        }
    }

    /**
     * Exports the TaskTree to XLSX or PDF
     */
    exportData(dataFormat, callback, exportDataCallback) {
        const that = this;

        if (!Smart.Utilities.DataExporter) {
            that.error(that.localize('missingReference', { elementType: that.nodeName.toLowerCase(), methodName: 'exportData', files: 'smart.export.js' }));
            return;
        }

        try {
            new JSZip();
        }
        catch (error) {
            that.error(that.localize('missingReference', { elementType: that.nodeName.toLowerCase(), methodName: 'exportData', files: 'jszip.min.js' }));
            return;
        }

        if (dataFormat === 'pdf' && !window.pdfMake) {
            that.error(that.localize('missingReference', { elementType: that.nodeName.toLowerCase(), methodName: 'exportData', files: 'pdfMake.min.js' }));
            return;
        }

        const events = that._events;

        if (!events || !events.length) {
            return;
        }

        if ((dataFormat + '').toLowerCase() === 'ical') {
            return that._exportToICal(callback, exportDataCallback);
        }

        const dataExporter = new Smart.Utilities.DataExporter({
            exportHeader: that.dataExport.header,
            pageOrientation: that.dataExport.pageOrientation,
            style: that.dataExport.style
        });

        const header = that._getExportRecord();
        let dataExporterHeader = { columns: [] };

        for (let h in header) {
            dataExporterHeader.columns.push({ label: header[h], dataField: h });
        }

        dataExporter.header = dataExporterHeader;

        that._setExportStyles(dataExporter, dataFormat);

        let data = [];

        //Create the event records
        for (let i = 0; i < events.length; i++) {
            data.push(that._getExportRecord(events[i]));
        }

        if (exportDataCallback) {
            const result = exportDataCallback(data, dataExporter, dataFormat);
            if (result) {
                data = result;
            }
        }

        return dataExporter.exportData(data, dataFormat, that.dataExport.fileName, callback);
    }

    /**
     * Returns all current event as a JSON string
     */
    getDataSource() {
        const that = this;
        let events = that._events;

        if (that.timeZone !== 'local') {
            events = events.map(t => that._cloneObject(t, false));
            events.forEach((event) => {
                event.dateStart = new Smart.Utilities.DateTime(event.dateStart, that.timeZone).toTimeZone('Local').toDate();
                event.dateEnd = new Smart.Utilities.DateTime(event.dateEnd, that.timeZone).toTimeZone('Local').toDate();
            });
        }
        return events && events.length ? JSON.parse(JSON.stringify(events.map(t => that._cloneObject(t, true)))) : ''
    }

    /**
     * Returns the current resources as JSON string
     */
    getResources() {
        const that = this,
            resources = that.resources;

        return resources && resources.length ? JSON.parse(JSON.stringify(resources)) : ''
    }

    /**
     * Prepares the element for printing
     */
    print() {
        const that = this,
            fileName = that.dataExport.fileName;

        that.dataExport.fileName = null;

        const output = that.exportData('html');

        const newWindow = window.open('', '', 'width=800,height=500'),
            printDocument = newWindow.document.open(),
            pageContent =
                '<!DOCTYPE html>' +
                '<html>' +
                '<head>' +
                '<meta charset="utf-8" />' +
                '<title>' + fileName + '</title>' +
                '</head>' +
                '<body>' + output + '</body></html>';

        try {
            printDocument.write(pageContent);
            printDocument.close();

            setTimeout(function () {
                newWindow.print();
                newWindow.close();
            }, 100);
        }
        catch (error) {
            //
        }

        that.dataExport.fileName = fileName;
    }

    /**
     * Refreshes the ScrollBars
     * @param {Boolean} fullRefresh - re-renders the Timeline
     */
    refresh(fullRefresh) {
        const that = this;

        if (!fullRefresh) {
            that._refresh();
            return
        }

        if (that.isRendered) {
            that._createTimeline();
        }
    }

    /**
     * Marks the begining of a batch update
     */
    beginUpdate() {
        const that = this;

        if (that._isUpdating) {
            return
        }

        that._isUpdating = true;

        that.$.fireEvent('beginUpdate');
    }

    /**
     * Marks the end of a batch update
     */
    endUpdate() {
        const that = this;

        if (!that._isUpdating) {
            return;
        }

        that._refreshTimelineEvents();

        that.$.fireEvent('endUpdate');
    }

    addView(viewType, label, value, hideWeekend, hideNonworkingWeekdays, additionalDays) {
        const that = this;

        const view = {
            label: label,
            type: viewType,
            value: value,
            hideWeekend: hideWeekend,
            hideNonworkingWeekdays: hideNonworkingWeekdays,
            additionalDays: additionalDays
        }

        that.views.push(view);
        that._refreshViewSelector();
        that.refresh();
    }

    setView(view) {
        const that = this;
        const oldValue = that.view;
        const viewDetails = that.views.find(v => v.value && v.value === view);

        if (view !== oldValue) {
            that.set('view', view);
            view = viewDetails ? viewDetails.type : view;
            that._createTimeline();
            that._refreshDateSelector();
            that._checkHideWekendItem();

            //Scroll to the view item
            that._scrollToView(viewDetails);
            that._handleViewSelection();

            that.$.fireEvent('viewChange', { oldValue: oldValue, value: view });
        }
    }

    /**
     * Scrolls the Timeline to a certain Date
     * @param {Date | { year: number, month: number, date: number, hours: hours, minutes: minutes}} date - target date
     * @param {boolean} strict - Determines whether to scroll to the begining of the cell that represent the date or just scroll to be in view
     * @param {Boolean} autoScroll - after scrolling, adds an offset to scroll within the middle of the view.
      */
    scrollToDate(date, strictScroll, autoScroll) {
        const that = this;

        if (date instanceof Date) {
            date = new Date(date);
        }
        else if (date instanceof HTMLElement && (!date.classList.contains('smart-scheduler-cell') || !that.$.timeline.contains(date))) {
            return
        }
        else if (typeof date === 'object') {
            const currentDate = new Date(that.dateCurrent);

            date.year = date.year !== undefined ? date.year : currentDate.getFullYear();
            date.month = date.month !== undefined ? date.month : currentDate.getMonth();
            date.date = date.date !== undefined ? date.date : currentDate.getDate();

            date = new Date(date.year, date.month, date.date, date.hours, date.getMinutes);
        }
        else if (typeof date === 'string') {
            if (date.indexOf('Date') >= 0) {
                date = date.replace('new Date(', '').replace(')', '');
                date = date.split(', ');

                let newDate = '';

                for (let i = 0; i < date.length; i++) {
                    newDate += date[i];
                    if (i < 2) {
                        newDate += '-';
                    }
                    else if (i === 2) {
                        newDate += ' ';
                    }
                    else if (i < date.length - 1) {
                        newDate += ':';
                    }
                }

                date = newDate;
            }

            date = new Date(date);
        }

        if (!date || isNaN(date.getTime())) {
            return
        }

        that._scrollTo(date, strictScroll, autoScroll);
    }

    /**
     * Scrolls the Timeline to a certain Date
     * @param {Object} eventObj - target event object
     */
    scrollToEvent(eventObj) {
        const that = this,
            events = that._events;

        if (typeof eventObj === 'number' && events) {
            eventObj = events[eventObj];
        }
        else {
            eventObj = that._containsEvent(eventObj);
        }

        if (!eventObj) {
            return
        }

        //Scrolls to the event
        that._scrollTo(eventObj.dateStart);
    }

    /**
     * Opens a new notification
     * @param {String} message - the notification message
     * @param {String} iconType - notification icon type
     */
    openNotification(message, toastSettings) {
        const that = this;

        message += '';

        if (!message) {
            return
        }

        //Prepare the Toast element
        that._setToast();

        const toast = that.$.toast;

        if (toast) {
            if (typeof toastSettings === 'object') {
                for (let setting in toastSettings) {
                    toast[setting] = toastSettings[setting];
                }
            }

            that._appendToast();
            toast.open(message);
        }
    }

    /**
     * Closes all notifications
     */
    closeNotifications() {
        const that = this;

        //Close the client notifications and refresh the event notifications
        that._checkNotifications(true);
    }

    /**
     * Opens the window to edit a date/event
     * @param {Date | string | Object | undefined} eventObj - target event/event id/ date or nothing
     */
    openWindow(eventObj) {
        const that = this;
        let event = eventObj;

        if (eventObj === undefined || typeof eventObj === 'object') {
            eventObj = that._containsEvent(eventObj);

            if (eventObj) {
                that._openWindow(eventObj);
                return
            }

            eventObj = new Date(that.dateCurrent);
        }
        else if (typeof eventObj === 'string') {
            event = that._events.find(e => (e.id + '') === eventObj);

            if (event) {
                that._openWindow(event);
                return
            }

            if (!event) {
                event = new Date(eventObj);
            }
        }
        else if (typeof eventObj === 'number') {
            event = that._events[eventObj];

            if (event) {
                that._openWindow(event);
            }

            return
        }

        if (eventObj instanceof Date) {
            if (isNaN(eventObj.getTime())) {
                return
            }

            eventObj = {
                dateStart: new Date(that.dateCurrent)
            };
        }

        if (typeof eventObj === 'object' && !eventObj.dateStart) {
            eventObj.dateStart = new Date(that.dateCurrent);
        }

        eventObj = that._createEvents([eventObj]);

        if (!eventObj) {
            return
        }

        that._openWindow(eventObj[0]);
    }

    /**
     * Closes the Editor Window
     */
    closeWindow() {
        const that = this,
            confirmSchedulerWindow = that.$.confirmSchedulerWindow,
            schedulerWindow = that.$.schedulerWindow;

        if (schedulerWindow) {
            schedulerWindow.close();
            delete schedulerWindow._target;
        }

        if (confirmSchedulerWindow) {
            confirmSchedulerWindow.close();
            delete confirmSchedulerWindow._target;
        }
    }

    /**
     * Returns the date occurrences of the event
     * @param {Object} event - Scheduler event
     * @param {number} max - maximum number of occurrences
     */
    occurrences(eventObj, max = 100) {
        const that = this,
            events = that._events,
            rRule = that._rRule;

        if (typeof eventObj === 'number' && events) {
            eventObj = events[eventObj];
        }
        else {
            const existingEventObj = that._containsEvent(eventObj);

            if (existingEventObj) {
                eventObj = existingEventObj;
            }
        }

        if (!eventObj) {
            return
        }

        const options = that._getEventRepeatOptions(eventObj);

        if (!options) {
            return
        }

        max = parseInt(max);
        max = isNaN(max) ? 100 : max;

        //The returned date is in UTC so we convert it to local time by gettint the UTC values
        return new rRule(options).all((date, i) => !(!options.count && i === max)).map(date =>
            new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
                date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds())
        );
    }

    /**
     * Returns all occurrences of the Event between two dates
     * @param {Object} eventObj - Scheduler event
     * @param {Date} dateFrom - from Date
     * @param {Date} dateTo - to Date
     */
    occurrencesBetween(eventObj, dateFrom, dateTo) {
        const that = this,
            events = that._events,
            rRule = that._rRule;

        if (typeof eventObj === 'number' && events) {
            eventObj = events[eventObj];
        }
        else {
            const existingEventObj = that._containsEvent(eventObj);

            if (existingEventObj) {
                eventObj = existingEventObj;
            }
        }

        if (!eventObj || isNaN(new Date(dateFrom).getTime()) || isNaN(new Date(dateTo).getTime())) {
            return
        }

        const options = that._getEventRepeatOptions(eventObj);

        if (!options) {
            return
        }

        dateFrom = new Date(Math.min(dateFrom.getTime(), dateTo.getTime()));
        dateTo = new Date(Math.max(dateFrom.getTime(), dateTo.getTime()));

        //NOTE: true flag, means it will include the dateFrom, dateTo, if they are also occurrences
        return new rRule(options).between(new Date(Date.UTC(...that._getDateArgs(dateFrom))),
            new Date(Date.UTC(...that._getDateArgs(dateTo))), true).map(date =>
                new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
                    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds())
            );
    }

    /**
     * Returns the first occurrence of the event after a date
     * @param {*} eventObj -  scheduler event
     * @param {*} date - a Date
     */
    occurrenceAfter(eventObj, date) {
        return this._occurrence(eventObj, date, 'after');
    }

    /**
    * Returns the first occurrence of the event before a date
    * @param {*} eventObj - scheduler event
    * @param {*} date - a Date
    */
    occurrenceBefore(eventObj, date) {
        return this._occurrence(eventObj, date, 'before');
    }

    /**
     * Returns the dateStart/dateEnd of a Timeline cell
     * @param {*} schedulerCell
     */
    getCellDateRange(timelineCell) {
        const that = this;

        if (!timelineCell || !that.$.timelineCellsContainer.contains(timelineCell) || !timelineCell.classList.contains('smart-scheduler-cell')) {
            return
        }

        if (timelineCell.classList.contains('scale')) {
            timelineCell = timelineCell.children[0];
        }

        return that._getCellDateRange(timelineCell)
    }

    /**
     * Undo the last event modification. Available only for drag and resize operations
     * @param {number | undefined} step - the step to redo to. Optional
     */
    undo(step) {
        return this._handleUndoRedo('undo', step);
    }

    /**
    * Redo the next event modification.Available only for drag and resize operations
    * @param {number | undefined} step - the step to redo to. Optional
    */
    redo(step) {
        return this._handleUndoRedo('redo', step);
    }

    /**
     * Deletes the Undo/Redo history
     */
    deleteUndoRedoHistory() {
        this._updateUndoRedo();
    }

    /**
     * Returns a Boolean indicating whether the Undo operation is possible or not
     */
    canUndo() {
        return this._isUndoPossible();
    }

    /**
    * Returns a Boolean indicating whether the Redo operation is possible or not
    */
    canRedo() {
        return this._isRedoPossible();
    }

    /**
     * Returns the first occurrence before/after a date. Called as by public methods
     * @param {*} eventObj - scheduler event
     * @param {date} date - target date
     * @param {string} methodName - 'before' or 'after' method
     */
    _occurrence(eventObj, date, methodName) {
        const that = this,
            rRule = that._rRule;

        if (!rRule || !eventObj || isNaN(new Date(date).getTime())) {
            return
        }

        const options = that._getEventRepeatOptions(eventObj);

        if (!options) {
            return
        }

        //NOTE: true flag, means it will include the date, if it's also an occurrence

        const occurrence = new rRule(options)[methodName](new Date(Date.UTC(...that._getDateArgs(date))), true);

        if (occurrence) {
            return new Date(occurrence.getUTCFullYear(), occurrence.getUTCMonth(), occurrence.getUTCDate(),
                occurrence.getUTCHours(), occurrence.getUTCMinutes(), occurrence.getUTCSeconds())
        }
    }

    /**
     * Open event Tooltip
     * @param {*} event
     */
    openEventTooltip(eventObj) {
        const that = this,
            tooltip = that.$.tooltip,
            events = that._events;

        if (typeof eventObj === 'number' && events) {
            eventObj = events[eventObj];
        }
        else {
            eventObj = that._containsEvent(eventObj);
        }

        if (!eventObj) {
            return
        }

        if (tooltip) {
            const schedulerEvents = that.$.timeline.querySelectorAll('.smart-scheduler-event');

            for (let i = 0; i < schedulerEvents.length; i++) {
                const schedulerEvent = schedulerEvents[i].$ ? ([schedulerEvents[i]] || schedulerEvents[i].$.events) : undefined;

                if (schedulerEvent && schedulerEvent.some(e => {
                    const eObj = e.$ ? e.$.event : undefined;
                    return eObj && (eObj === eventObj || (eObj.$ && eObj.$.event === eventObj))
                })) {
                    delete that._openEventMenu;
                    that._handleTooltipContent(schedulerEvent[0]);
                    break;
                }
            }
        }
    }

    /**
     * Close event tooltip
     */
    closeEventTooltip() {
        const that = this,
            tooltip = that.$.tooltip;

        if (tooltip.visible && tooltip.contains(that._eventList)) {
            tooltip.close();
        }
    }

    /**
     * Returns true or false whether the eventObj contains restricted dates
     * @param {Object | HTMLElement} eventObj - the event obj or it's html element
     */
    isEventRestricted(eventObj) {
        const that = this;

        if (eventObj && eventObj.classList && eventObj.classList.contains('smart-scheduler-event')) {
            eventObj = eventObj.$ ? eventObj.$.event : undefined;
        }

        if (!eventObj || !(eventObj.dateStart instanceof Date) || !(eventObj.dateEnd instanceof Date)) {
            return false
        }

        return that._isEventRestricted(eventObj)
    }

    /**
     * Returns true or false whether the date is restricted
     * @param {Date | Object} date - date object or a timeline cell
     */
    isDateRestricted(date) {
        const that = this;

        if (date && date.classList && date.classList.contains('smart-scheduler-cell')) {
            date = date.$ && date.$.cellObj ? new Date(date.$.cellObj.time) : undefined;
        }

        if (!date || date.getTime === undefined || isNaN(date.getTime())) {
            return false
        }

        return that._isDateRestricted(date)
    }

    /**
     * Returns true or false whether the date is restricted
     * @param {Date | Object} date - date object or a timeline cell
     */
    isHourRestricted(date) {
        const that = this;

        if (date && date.classList && date.classList.contains('smart-scheduler-cell')) {
            date = date.$ && date.$.cellObj ? new Date(date.$.cellObj.time) : undefined;
        }

        return that._isHourRestricted(date)
    }

    /**
      * Checks for mouse double click on a cell/event
      */
    _checkDoubleClick(eventTarget) {
        const that = this;

        //Check for double click
        if (that._dblClickDetails === undefined) {
            that._dblClickDetails = { clicks: 0 };
        }

        clearTimeout(that._dblClickDetails.timeOut);

        if (eventTarget !== that._dblClickDetails.target) {
            that._dblClickDetails.clicks = 0;
        }

        that._dblClickDetails.target = eventTarget;
        that._dblClickDetails.clicks++;

        that._dblClickDetails.timeOut = setTimeout(function () {
            if (that._dblClickDetails) {
                that._dblClickDetails.clicks = 0;
            }

            if (that._openEventMenu) {
                //Open the tooltip and show event(s)
                that._handleTooltipContent(that._openEventMenu);
                delete that._openEventMenu;
            }
        }, 250);

        if (that._dblClickDetails.clicks === 2) {
            that._doubleClickHandler(eventTarget);
            that._dblClickDetails.clicks = 0;
            delete that._openEventMenu;
            return true;
        }
    }

    /**
     * Creates a Scheduler event clone
     * @param {Object} obj - a Scheduler event
     * @param {Boolean} isJSON - flag indicating whether it should be a JSON or JS object
     */
    _cloneObject(obj, isJSON, keepReferences) {
        const that = this;
        let newObj = {};

        for (let prop in obj) {
            let objValue = obj[prop];

            if (objValue instanceof Date) {
                newObj[prop] = isJSON ? objValue.toISOString() : new Date(objValue);
            }
            else if (prop === 'repeat') {
                newObj[prop] = Object.assign({}, objValue);

                if (newObj[prop].exceptions) {
                    const exceptions = newObj[prop].exceptions = newObj[prop].exceptions.slice();

                    for (let i = 0; i < exceptions.length; i++) {
                        exceptions[i] = that._cloneObject(exceptions[i])
                    }
                }
            }
            else {
                newObj[prop] = objValue;
            }
        }

        if (!keepReferences) {
            delete newObj.$;

            if (newObj.repeat && newObj.repeat.exceptions) {
                newObj.repeat.exceptions.forEach(e => delete e.$);
            }
        }

        return newObj
    }

    /**
     * Double click handler
     * @param {any} event
     */
    _doubleClickHandler(eventTarget) {
        const that = this;

        if (that.disabled || that.disableWindowEditor) {
            return;
        }

        const tooltip = that.$.tooltip;
        let target = eventTarget.closest ? eventTarget.closest('.smart-scheduler-cell:not(.scale)') : undefined;

        if (that.$.timelineContainer.contains(target) || that.$.timelineViewAllDay.contains(target)) {
            that._openWindow();
            return
        }

        if (eventTarget.classList.contains('smart-scheduler-event')) {
            target = eventTarget;
        }
        else {
            target = eventTarget.closest('.smart-scheduler-event-content');
        }

        //Handle Event double click
        if (target && (that.$.timeline.contains(target) || tooltip.contains(target))) {
            // target = target.closest('.smart-scheduler-event-item') || target.closest('.smart-scheduler-event');
            target = target.closest('.smart-scheduler-event');

            let eventObj = target && target.$ ? target.$ : undefined;

            if (!eventObj || eventObj.events) {
                return
            }

            //Handles Event cells
            eventObj = eventObj.event;

            const repeatingEvent = eventObj.$ ? eventObj.$.event : undefined,
                eventExceptions = repeatingEvent && repeatingEvent.repeat ? repeatingEvent.repeat.exceptions : undefined;
            let targetEvent;

            if (eventExceptions && eventExceptions.indexOf(eventObj) > -1) {
                //Use the existing event esception
                targetEvent = eventObj;
            }
            else {
                const eventCellDateObj = target.$;

                //Repeating event check
                if (repeatingEvent) {
                    //Create a new event exception
                    targetEvent = Object.assign({}, eventObj, {
                        dateStart: eventCellDateObj.dateStart,
                        dateEnd: eventCellDateObj.dateEnd
                    });
                }
                else {
                    targetEvent = eventObj;
                }
            }

            tooltip.close();
            that._openWindow(targetEvent, repeatingEvent ? target : undefined);
        }
    }

    /**
     * Creates a new event from a cell
     * @param {HTMLElement | Object} selected - a scheduler cell or cell selection object
     */
    _createEventFromSelection(selected) {
        const that = this;

        if (!selected) {
            selected = that._selectedCellObj;
        }

        if (selected instanceof HTMLElement && selected.$) {
            selected = { from: selected.$.cellObj, to: selected.$.cellObj };
        }


        if (!selected || !selected.from) {
            return
        }

        const selectFrom = selected.from,
            selectTo = selected.to;

        if (that.hideOtherMonthDays && new Date(selectFrom.time).getMonth() !== new Date(that.dateCurrent).getMonth()) {
            return
        }

        const dateStart = new Date(Math.min(selectFrom.time, selectTo.time)),
            dateEnd = new Date(Math.max(selectFrom.time, selectTo.time)),
            groups = selectFrom.horizontal.group || selectFrom.vertical.group;

        if (!selectFrom.allDay && that.viewType.toLowerCase().indexOf('month') < 0) {
            dateEnd.setHours(dateEnd.getHours(), dateEnd.getMinutes() + (60 / that._getCellsScaleCount()), 0, 0);
        }
        else {
            dateEnd.setHours(23, 59, 59, 999);
        }

        const newEvent = {
            allDay: !!selectFrom.allDay,
            dateStart: dateStart,
            dateEnd: dateEnd
        }

        if (groups) {
            for (let g in groups) {
                newEvent[g] = groups[g];
            }
        }

        if (that._isEventRestricted(newEvent)) {
            return
        }

        return newEvent
    }

    /**
    * Element Down Event Handler
    * @param {any} event
    */
    _downHandler(event) {
        const that = this,
            tooltip = that.$.tooltip,
            originalEvent = event.originalEvent;
        let target = (that.shadowRoot || that.isInShadowDOM ? originalEvent.composedPath()[0] : originalEvent.target);

        event.stopPropagation();

        if (event.button === 0 && tooltip.contains(that._contextList) && (target && target.closest && !target.closest('.smart-scheduler-nav[current]') &&
            !target.closest('.smart-scheduler-view-items-button') && !tooltip.contains(target))) {
            tooltip.close();
        }

        if (that._dragDetails) {
            //Terminate all interaction processes like drag/resize, etc
            that._endDrag();
            that._endResize();
            delete that._dragDetails;
            clearInterval(that._scrollInterval);
            delete that._scrollInterval;
            return;
        }

        if (!that.$.timeline.contains(target) && !that.$.tooltip.contains(target)) {
            return;
        }

        if (that._isMobile) {
            that.$.timelineContent.classList.add('hide-overlay');
            target = (that.shadowRoot || document).elementFromPoint(originalEvent.pageX - window.pageXOffset, originalEvent.pageY - window.pageYOffset);
            that.$.timelineContent.classList.remove('hide-overlay');
        }

        if (!target || !target.closest) {
            return
        }

        that._dragDetails = { target: target, button: event.button, timestamp: Date.now() };

        const timelineCell = target.closest('.smart-scheduler-cell:not(.scale)');

        if (timelineCell && timelineCell.$ && (that.$.timelineContainer.contains(timelineCell) || that.$.timelineViewAllDay.contains(timelineCell))) {
            const cellObj = timelineCell.$.cellObj;

            if (!cellObj) {
                return;
            }

            that._dragDetails.timelineCellObj = Object.assign({}, cellObj);

            if (event.button === 0 && that._checkDoubleClick(target)) {
                return;
            }

            //cell selection on Mobile happens on documentUp
            if (that._isMobile) {
                return
            }

            if (event.button === 0 && event.shiftKey && that._selectedCellObj) {
                that._handleCellSelection(that._selectedCellObj.from, cellObj);
            }
            else {
                if (event.button !== 0 && that._isCellObjSelected(cellObj)) {
                    return
                }

                that._handleCellSelection(cellObj);
            }

            //Keep the starting cell selection obj
            that._dragDetails.selectedCellObj = Object.assign({}, that._selectedCellObj);
            return
        }

        const schedulerEvent = target.closest('.smart-scheduler-event');

        if (schedulerEvent) {
            if (event.button === 0 && that._checkDoubleClick(target)) {
                return;
            }

            that._dragDetails.schedulerEvent = schedulerEvent;
            that._dragDetails.coordinates = { x: event.pageX, y: event.pageY };
            that._dragDetails.originialEvent = event;

            if (that.resizeHandlesVisibility === 'visible' || (that._isMobile && that.resizeHandlesVisibility === 'auto')) {
                that._checkEventResizability(event);
            }
        }
    }

    _dropHandler(event) {
        const that = this;

        const
            hoveredScheduler = Smart.Scheduler.hoveredScheduler,
            hoveredCell = Smart.Scheduler.hoveredCell,
            body = document.body;


        //End the Dragging operation of the starting Scheduler

        delete Smart.Scheduler.hoveredScheduler;
        delete Smart.Scheduler.hoveredCell;
        delete Smart.Scheduler.schedulerStart;
        delete Smart.Scheduler.feedback;


        if (hoveredScheduler) {
            hoveredScheduler.removeAttribute('dragged');

            //Stop ongoing autoScrolling
            clearInterval(hoveredScheduler._scrollInterval);
            delete hoveredScheduler._scrollInterval;

            //Handle Scheduler drop target
            if (hoveredCell) {
                hoveredCell.classList.remove('smart-scheduler-feedback');
            }
        }

        if (hoveredCell) {
            that.$.fireEvent('dropoverCell', {
                target: event.target,
                allDay: hoveredCell.hasAttribute('all-day'),
                date: hoveredCell.getAttribute('date')
            });
        }

        body.classList.remove('smart-dragging');
        body.classList.remove('smart-dragging-disabled');

        //NOTE: When drag/resize of an event is finished
        that._scrollView.disableSwipeScroll = that._touchmoveInside = false;

        if (that._list) {
            that._list.disableSwipeScroll = that._list._touchmoveInside = false;
        }

        delete that._dragDetails;
    }

    _dragoverHandler(event) {
        const that = this;
        that._setDropTarget(event);
    }
    /**
     * DocumentMove event handler
     * @param {Event} event
     */
    _documentMoveHandler(event) {
        const that = this,
            originalEvent = event.originalEvent,
            dragDetails = that._dragDetails,
            schedulerDragStart = Smart.Scheduler.schedulerStart;
        let target = (that.shadowRoot || that.isInShadowDOM ? originalEvent.composedPath()[0] : originalEvent.target);

        if (schedulerDragStart) {
            that._setDropTarget(event);
        }
        //Hovers a task
        else if (!dragDetails) {
            that._checkEventResizability(event);
            return;
        }

        if (!dragDetails || dragDetails.button !== 0) {
            return
        }

        //Handles Task Bar resizing
        if (that.$.timeline.getAttribute('event-hovered')) {
            that._handleEventResize(event);
            return;
        }

        if (!that.disableDrag && dragDetails.schedulerEvent && !schedulerDragStart) {
            that._setDragStart(event);
            return
        }

        if (schedulerDragStart === that) {
            const dragOffset = that.dragOffset,
                feedback = Smart.Scheduler.feedback;

            if (!feedback) {
                return;
            }

            if (!feedback.parentElement) {
                document.body.appendChild(feedback);
            }

            if (that.rightToLeft) {
                feedback.style.left = (event.pageX - dragOffset[0] - feedback.offsetWidth) + 'px';
            }
            else {
                feedback.style.left = (event.pageX + dragOffset[0]) + 'px';
            }

            feedback.style.top = (event.pageY + dragOffset[1]) + 'px';

            return;
        }


        if (that._isMobile) {
            const tooltip = that.$.tooltip;

            if (schedulerDragStart === that && tooltip.visible) {
                tooltip.close();
            }
            return
        }

        //Mark for selection
        if (!that.disableSelection && that.viewType !== 'agenda' && !event.shiftKey) {
            //Fixes a FireFox Bug with incorrect target
            if (Smart.Utilities.Core.Browser.Firefox) {
                target = (that.shadowRoot || document).elementFromPoint(originalEvent.pageX - window.pageXOffset, originalEvent.pageY - window.pageYOffset);
            }

            const timelineCellObj = dragDetails.timelineCellObj,
                targetTimelineCell = that.$.timeline.contains(target) ? target.closest('.smart-scheduler-cell:not(.scale)') : undefined;

            if (timelineCellObj && targetTimelineCell) {
                if (that.selectOne) {
                    return;
                }
                that._selectCell(timelineCellObj, targetTimelineCell);
            }
        }
    }

    _generateUUID() {
        // Create an array to hold the random values
        const cryptoObj = window.crypto;
        const buffer = new Uint8Array(16);
        cryptoObj.getRandomValues(buffer);

        // Set the version to 4 (randomly generated UUID)
        buffer[6] = (buffer[6] & 0x0f) | 0x40;
        buffer[8] = (buffer[8] & 0x3f) | 0x80;

        const hex = Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');

        return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
    }

    /**
     * Document Up Event Handler
     * @param {Event} event
     */
    _documentUpHandler(event) {
        const that = this,
            originalEvent = event.originalEvent;
        const dragDetails = that._dragDetails,
            pageX = originalEvent.pageX - window.pageXOffset,
            pageY = originalEvent.pageY - window.pageYOffset;
        let target = (that.shadowRoot || that.isInShadowDOM ? originalEvent.composedPath()[0] : originalEvent.target);

        if (that._isMobile) {
            that.$.timelineContent.classList.add('hide-overlay');
            target = (that.shadowRoot || document).elementFromPoint(pageX, pageY);
            that.$.timelineContent.classList.remove('hide-overlay');
        }

        if (that._listDragDetails) {
            delete that._listDragDetails;
        }
        //ScrollViewer Handler
        that._upHandler();

        clearInterval(that._scrollInterval);
        delete that._scrollInterval;

        if (dragDetails && Smart.Scheduler.schedulerStart) {
            that._endDrag(event, target);
            return
        }

        if (dragDetails && that.hasAttribute('resized')) {
            that._endResize(event);
            return
        }

        const tooltip = that.$.tooltip;

        //Close the Tooltip
        if (tooltip.visible && !(tooltip.contains(target) || (that.shadowRoot || that).contains(target))) {
            tooltip.close();
        }

        if (target && target.closest) {
            if (dragDetails) {
                const schedulerEvent = target.closest('.smart-scheduler-event');

                if (dragDetails.schedulerEvent === schedulerEvent) {
                    that._handleCellSelection();
                    that.$.fireEvent('itemClick', { item: schedulerEvent, type: 'event', itemObj: that._cloneObject(schedulerEvent.$.event) });

                    const isShortPress = !that._isMobile || (Date.now() - dragDetails.timestamp < 250);

                    //Opens the Event menu when the double click timeout finishes
                    if (!tooltip.contains(target) && (isShortPress && dragDetails.button === 0)) {
                        if (that._dblClickDetails && that._dblClickDetails.clicks === 0) {
                            if (that.disableEventMenu) {
                                delete that._openEventMenu;
                                return;
                            }
                            that._handleTooltipContent(schedulerEvent);
                            delete that._openEventMenu;
                        }
                        else {
                            //DoubleClickTimeout will open it when it's done
                            if (!that.disableEventMenu) {
                                that._openEventMenu = schedulerEvent;
                            }
                            else {
                                delete that._openEventMenu;
                            }
                        }
                    }
                }
                else {
                    delete that._openEventMenu;
                    const tooltipSelector = tooltip.selector;
                    if (dragDetails.button === 0 && !(event.shiftKey && that._selectedCellObj) &&
                        !(tooltip.contains(target) && tooltipSelector && tooltipSelector.classList.contains('smart-scheduler-cell'))) {
                        if (that.contains(target)) {
                            if (that.selectOne) {
                                that._handleCellSelection(target, target);
                            }
                            else {
                                that._handleCellSelection(dragDetails.timelineCellObj, target);
                            }
                        }

                        let clicks = 1;
                        if (new Date() - that._clickTime < 300) {
                            clicks++;
                        }
                        that._clickTime = new Date();
                        if (clicks === 2) {
                            if (that.autoCreateDialog && target && target.classList.contains('smart-scheduler-cell')) {
                                that._setupAutoCreateDialog(event);
                            }
                        }
                    }
                }
            }
            else {
                const popupWindow = that.$.schedulerWindow;

                if (that.contains(target) && target.classList.contains('smart-scheduler-window-modal') && popupWindow) {
                    popupWindow.focus();
                }

                return
            }
        }

        delete that._dragDetails;
    }

    _setupAutoCreateDialog(event) {
        const that = this,
            originalEvent = event.originalEvent;
        let target = originalEvent ? ((that.shadowRoot || that.isInShadowDOM) ? originalEvent.composedPath()[0] : originalEvent.target) : that.querySelector('.smart-scheduler-cell[selected]');

        if (!target) {
            return;
        }

        const targetObj = that._createEventFromSelection();
        if (!targetObj || (targetObj && targetObj.dateStart === undefined)) {
            return;
        }
        targetObj.id = that._generateUUID();

        const view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {};

        if (viewDetails && viewDetails.hideHours) {
            targetObj.dateEnd.setHours(0, 0, 0, 0);
            targetObj.allDay = true;
        }
        if (that.viewType.toLowerCase().indexOf('month') >= 0) {
            targetObj.dateEnd.setHours(0, 0, 0, 0);
            targetObj.allDay = true;
        }

        const reposition = (dialog) => {
            const schedulerRect = that.getBoundingClientRect();
            const boundRect = target.getBoundingClientRect();
            const rightClickDetails = originalEvent ? { x: originalEvent.pageX, y: originalEvent.pageY } : { x: boundRect.left, y: boundRect.top };
            const bottom = window.screen.height - dialog.offsetHeight - 10;

            dialog.style.top = Math.min(rightClickDetails.y + 1, bottom, schedulerRect.bottom + window.pageYOffset) + 'px';
            const leftPosition = schedulerRect.right + window.pageXOffset - dialog.offsetWidth - boundRect.width;
            dialog.style.left = Math.min(boundRect.right - 21, Math.max(leftPosition, schedulerRect.left + 10)) + 'px';


            if (that._isMobile) {
                dialog.style.left = 'calc(50% - 160px)';
                dialog.style.top = 'calc(50% - 100px)';
                dialog.style.height = '200px';
                dialog.style.width = '320px';
            }
        }
        if (!that._autoCreateDialogElement) {
            const dialog = document.createElement('smart-window');
            dialog.disableFocus = true;
            dialog.headerButtons = ['close'];
            dialog.label = that.localize('create');
            dialog.style.height = 'auto';
            dialog.style.width = 'auto';
            dialog.item = targetObj;
            dialog.style.setProperty('--smart-surface', '--smart-background');
            dialog.style.setProperty('--smart-window-header-background', '--smart-background');

            const input = document.createElement('smart-input');
            dialog.input = input;
            dialog.appendChild(input);
            input.classList.add('underlined');
            input.placeholder = that.localize('addTitle');
            input.style.marginTop = input.style.marginLeft = input.style.marginRight = '20px';

            const okButton = document.createElement('smart-button');
            okButton.innerHTML = that.localize('ok');
            okButton.classList.add('primary');
            okButton.style.marginTop = '30px';
            okButton.style.marginRight = '20px';
            okButton.style.alignSelf = 'end';

            dialog.appendChild(okButton);

            that._autoCreateDialogElement = dialog;
            document.body.appendChild(dialog);
            input.style.setProperty('--smart-font-size', '22px');

            okButton.onclick = () => {
                dialog.item.label = input.value;
                that.addEvent(dialog.item, (id) => {
                    targetObj.id = id;
                });
                dialog.close();
            }
            input.onkeydown = (event) => {
                if (event.key === 'Enter') {
                    okButton.click();
                }
            }

            dialog.onOpen = () => {
                let dateStart = new Date(dialog.item.dateStart).toLocaleTimeString(that.locale,
                    { hour: that.hourFormat, minute: that.minuteFormat });
                let dateEnd = new Date(dialog.item.dateEnd).toLocaleTimeString(that.locale,
                    { hour: that.hourFormat, minute: that.minuteFormat });

                if (that.view.toLowerCase().indexOf('month') >= 0) {
                    dateStart = new Date(dialog.item.dateStart);
                    dateEnd = new Date(dialog.item.dateEnd);

                    if (dateStart.toString() === dateEnd.toString()) {
                        dialog.label = that.localize('create') + ' ' + new Intl.DateTimeFormat(that.locale, { day: that.dayFormat, month: that.monthFormat }).format(dateStart);
                    }
                    else {
                        dialog.label = that.localize('create') + ' ' + new Intl.DateTimeFormat(that.locale, { day: that.dayFormat, month: that.monthFormat }).format(dateStart) + ' - ' + new Intl.DateTimeFormat(that.locale, { day: that.dayFormat, month: that.monthFormat }).format(dateEnd);
                    }
                }
                else {
                    dateStart = new Date(dialog.item.dateStart);
                    dateEnd = new Date(dialog.item.dateEnd);
                    const view = that.view,
                        viewDetails = that.views.find(v => v.value && v.value === view) || {};

                    if (dateStart.toString() === dateEnd.toString()) {
                        let dateStart = new Date(dialog.item.dateStart).toLocaleTimeString(that.locale,
                            { hour: that.hourFormat, minute: that.minuteFormat });

                        if (viewDetails && viewDetails.hideHours) {
                            dateStart = new Intl.DateTimeFormat(that.locale, { day: that.dayFormat, month: that.monthFormat }).format(new Date(dialog.item.dateStart));
                        }

                        dialog.label = that.localize('create') + ' ' + dateStart;
                    }
                    else {
                        let dateStart = new Date(dialog.item.dateStart).toLocaleTimeString(that.locale,
                            { hour: that.hourFormat, minute: that.minuteFormat });
                        let dateEnd = new Date(dialog.item.dateEnd).toLocaleTimeString(that.locale,
                            { hour: that.hourFormat, minute: that.minuteFormat });

                        if (viewDetails && viewDetails.hideHours) {
                            dateStart = new Intl.DateTimeFormat(that.locale, { day: that.dayFormat, month: that.monthFormat }).format(new Date(dialog.item.dateStart));
                            dateEnd = new Intl.DateTimeFormat(that.locale, { day: that.dayFormat, month: that.monthFormat }).format(new Date(dialog.item.dateEnd));
                        }

                        dialog.label = that.localize('create') + ' ' + dateStart + ' - ' + dateEnd;
                    }
                }

                that.setAttribute('modal', '');
                setTimeout(() => {
                    input.focus();
                }, 300);
            }
            dialog.onClose = () => {
                that.removeAttribute('modal');
            }
            reposition(dialog);
            dialog.open();
        }
        else {
            const dialog = that._autoCreateDialogElement;
            dialog.item = targetObj;
            reposition(dialog);
            dialog.input.value = '';
            dialog.open();
        }
    }

    /**
    * Handles the dataSource when it's set to a DataAdapter instance
    */
    _handleDataAdapter() {
        const that = this;

        if (that.dataSource && that.dataSource instanceof Smart.DataAdapter) {
            const loadingElement = that.querySelector('.smart-loader-container');

            if (loadingElement) {
                loadingElement.remove();
            }

            if (that.dataSource.url) {
                const loadingIndicator = document.createElement('div');
                loadingIndicator.classList.add('smart-loader-container', 'smart-scheduler-loading-container');

                loadingIndicator.innerHTML = `<span id=\'loadingIndicator\' class=\'smart-scheduler-loader smart-loader\'></span>
                <span id=\'loadingIndicatorPlaceholder\' class =\'smart-loader-label\'>${that.localize('loadingIndicatorPlaceholder')}</span>`

                that.appendChild(loadingIndicator);
            }

            that.dataSource.notify(function (changes) {
                if (that.dataSource._updating) {
                    return;
                }

                const loadingElement = that.querySelector('.smart-loader-container');

                if (loadingElement) {
                    loadingElement.remove();
                }

                let data = changes.data,
                    index = changes.index;

                switch (changes.action) {
                    case 'add':
                    case 'insert':
                        data = that._parseAdapterData(data.length ? data : [data]);
                        that.insertEvent(data, index);
                        break;
                    case 'update':
                        data = that._parseAdapterData(data.length ? data : [data]);
                        that.updateEvent(index, data);
                        break;
                    case 'remove':
                    case 'removeLast':
                        that.removeEvent(index !== undefined ? index : that._events.length - 1);
                        break;
                    case 'bindingComplete': {
                        //Remove the exceptions
                        that.dataSource.canNotify = false;
                        that.dataSource.dataSource = that._parseAdapterData(that.dataSource.toArray()).filter(d => d !== undefined);
                        that.dataSource.canNotify = true;

                        that._createEvents();
                        that._createTimeline();
                        that.closeWindow();
                        break;
                    }
                }
                that._refreshViewList();
            });
        }
    }

    /**
     * Parses the Data coming from a DataAdapter change and returns it
     * @param {Object} data - data coming from the DataAdapter
     */
    _parseAdapterData(data) {
        const that = this,
            isMonthOrAgendaView = ['month', 'agenda'].indexOf(that.viewType.toLowerCase()) > -1,
            oneDay = 24 * 60 * 60 * 1000;

        if (!Array.isArray(data)) {
            data = Array.from(data);
        }

        for (let i = 0; i < data.length; i++) {
            const eventItem = data[i],
                dateStart = eventItem.dateStart,
                dateEnd = eventItem.dateEnd;
            let exdates = [];

            if (!isMonthOrAgendaView && dateStart instanceof Date && dateEnd instanceof Date && dateEnd.getTime() - dateStart.getTime() >= oneDay) {
                eventItem.allDay = true;
            }

            if (eventItem.rrule) {
                that._parseIcalRrule(eventItem);
            }

            if (eventItem.extdate) {
                let value = eventItem.extdate;

                if (value.indexOf('EXDATE:') >= 0) {
                    value = value.substring(value.indexOf('EXDATE:') + 7);
                }

                if (value.indexOf(',') >= 0) {
                    exdates = value.split(',');
                }
                else {
                    exdates.push(value);
                }
            }

            if (eventItem.reccurenceId) {
                const repeatingEvent = data.find(d => d.uid === eventItem.uid && !d.reccurenceId);

                if (!repeatingEvent) {
                    continue
                }

                that._parseICalReccurenceId(eventItem, repeatingEvent, exdates);

                data[i] = undefined;
            }

            if (eventItem.alarm) {
                //Handle notificaitons
                that._parseICalAlarm(eventItem);
            }

            if (eventItem.categories) {
                that._parseICalCategories(eventItem);
            }
        }

        return data
    }

    /**
     * Parses a RRule string and sets the options to the event object
     * @param {Object} eventItem - the Scheduler event object
     */
    _parseIcalRrule(eventItem) {
        const that = this,
            rRule = that._rRule;

        if (!rRule) {
            return
        }

        const options = rRule.parseString(eventItem.rrule);
        let repeatEnd;

        if (options) {
            const repeatFreq = rRule.FREQUENCIES[options.freq].toLowerCase();
            let repeatOnCondition;

            switch (repeatFreq) {
                case 'weekly':
                    if (options.byweekday !== undefined) {
                        const weekDays = Array.isArray(options.byweekday) ? options.byweekday : Array.from(options.byweekday);

                        //NOTE: RRule weekStart is 0 - Monday, 6 - Sunday
                        repeatOnCondition = weekDays.map(d => ((d.weekday + 1) + 7) % 7);
                    }

                    break;
                case 'monthly':
                    if (options.bymonthday !== undefined) {
                        //NOTE: RRule weekStart is 0 - Monday, 6 - Sunday
                        repeatOnCondition = options.bymonthday;
                    }
                    break;
                case 'yearly':
                    //RRule 'bymonth' prop starts from 1-12 isntead of 0-11(JS Date)
                    if (options.bymonth !== undefined && options.bymonthday !== undefined) {
                        repeatOnCondition = { month: options.bymonth - 1, date: options.bymonthday }
                    }
                    break;
            }

            eventItem.repeat = {
                repeatFreq: rRule.FREQUENCIES[options.freq].toLowerCase(),
                repeatInterval: options.interval,
                repeatOn: repeatOnCondition
            };

            if (options.until instanceof Date) {
                repeatEnd = new Date(Date.UTC(...that._getUTCDateArgs(options.until)));
            }
            else if (typeof options.count === 'number') {
                repeatEnd = options.count;
            }

            if (repeatEnd !== undefined) {
                eventItem.repeat.repeatEnd = repeatEnd;
            }
        }
    }

    /**
     * Parses the ReccurenceId property of the iCal file which determines the event exceptions
     * @param {*} eventItem - Scheduler event obj
     * @param {*} repeatingEvent - the repeating event obj that contains the exception
     * @param {*} exdates - exception dates
     */
    _parseICalReccurenceId(eventItem, repeatingEvent, exdates) {
        const that = this,
            reccurenceId = eventItem.reccurenceId;

        const getDateFromString = (until) => {
            let ignoreTime;

            //allDay events do not include Time with the date
            if (until.indexOf('VALUE=DATE:') > -1) {
                until = until.replace('VALUE=DATE:', '');
                ignoreTime = true;
            }

            const re = /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})Z)?$/,
                bits = re.exec(until);

            if (!bits) {
                throw new Error('Invalid DATE value: ' + until)
            }

            if (ignoreTime) {
                return new Date(bits[1], bits[2] - 1, bits[3], 0, 0, 0, 0)
            }

            return new Date(
                Date.UTC(bits[1],
                    bits[2] - 1,
                    bits[3],
                    bits[5] || 0,
                    bits[6] || 0,
                    bits[7] || 0
                ));
        }

        if (!eventItem) {
            return
        }

        const exception = that._cloneObject(eventItem);
        delete exception.repeat;

        exception.date = getDateFromString(reccurenceId);

        if (exdates.indexOf(exception.date) > -1) {
            exception.hidden = true;
        }

        if (repeatingEvent.repeat) {
            if (!repeatingEvent.repeat.exceptions) {
                repeatingEvent.repeat.exceptions = [];
            }

            repeatingEvent.repeat.exceptions.push(exception);
        }
    }

    /**
     * Parses iCal alarms as Scheduler event notifications
     * @param {Object} eventItem - Scheduler event obj
     */
    _parseICalAlarm(eventItem) {
        if (!eventItem) {
            return
        }

        const notifications = JSON.parse(eventItem.alarm),
            eventTimeStart = eventItem.dateStart.getTime();

        if (Array.isArray(notifications)) {
            let eventNotifications = [],
                triggerRegex = /^(-)?P(\d+)DT(\d{1,2})H(\d{1,2})M(\d{1,2})S$/;

            for (let i = 0; i < notifications.length; i++) {
                const notification = notifications[i],
                    trigger = notification.TRIGGER;

                if (triggerRegex.test(trigger)) {
                    const match = triggerRegex.exec(trigger);

                    if (!match) {
                        continue
                    }

                    let interval = parseInt(match[2]), type, sign = match[1] === '-' ? -1 : 1,
                        targetDate = new Date(eventTimeStart);

                    targetDate.setDate(targetDate.getDate() + sign * interval);
                    targetDate = new Date(targetDate.getTime() +
                        sign * (((match[3] || 0) * 1000 * 60 * 60) + (match[4] || 0) * 1000 * 60 + (match[5] || 0) * 1000));

                    if (interval > 28) {
                        interval = Math.round(interval / 7);
                        type = 'weeks';
                    }
                    else {
                        type = 'days';
                    }

                    eventNotifications.push({
                        interval: interval,
                        type: type,
                        time: [targetDate.getHours(), targetDate.getMinutes()],
                        message: notification.description || '',
                    });
                }
            }

            delete eventItem.alarm;
            eventItem.notifications = eventNotifications;
        }
    }

    /**
     * Parses iCal categories as Scheduler event resources
     * @param {Object} eventItem - Scheduler event obj
     */
    _parseICalCategories(eventItem) {
        if (!eventItem) {
            return
        }

        //Checks if the resources are available in the Scheduler
        // const eventResources = eventItem.categories.split(',').filter(r => {
        //     const rData = r.split('/');
        //     return resources.find(res => res.value === rData[0])
        // })

        //Handle resources
        eventItem.categories.split(',').forEach(r => {
            const rData = r.split('/');

            if (rData[1] !== undefined) {
                eventItem[rData[0]] = parseInt(rData[1]);
            }
        });

        delete eventItem.categories
    }

    /**
    * Exports the events to iCal . Read iCal Specifications: https://www.kanzaki.com/docs/ical/
    * @param {*} callback
    */
    _exportToICal(callback, exportDataCallback) {
        const that = this,
            id = that.id,
            rRule = that._rRule,
            resources = that.resources,
            timeStamp = that._getUTCDate(new Date()),
            events = that._events;

        //TODO: Check each row length. Must not be longer than 74 characters, if it is separate them with \r\n
        let fileContent = 'BEGIN:VCALENDAR\r\n' +
            'PRODID:-//HTMLElements//Smart Scheduler//EN\r\n' +
            'VERSION:2.0\r\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\r\n' +
            `X-WR-CALNAME:${id}\r\nX-WR-TIMEZONE:${that.timeZone}\r\n`;

        for (let i = 0; i < events.length; i++) {
            const event = events[i],
                repeatOptions = that._getEventRepeatOptions(event, true),
                eventResources = resources.filter(r => event[r.value]),
                eventStatus = event.status,
                uId = event.id ? event.id : (id + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1));

            fileContent += 'BEGIN:VEVENT\r\n';
            fileContent += that._getICalEventDates(event);
            fileContent +=
                `DTSTAMP:${timeStamp}\r\n` +
                `UID:${uId}\r\n` +
                `CREATED:${timeStamp}\r\n` +
                `DESCRIPTION:${event.description || ''}\r\n` +
                `TRANSP:${!eventStatus || eventStatus === 'free' ? 'TRANSPARENT' : 'OPAQUE'}\r\n` +
                'SEQUENCE:0\r\n' +
                `STATUS:${that._getICalStatus(event.status)}\r\n` +
                `SUMMARY:${event.label || ''}\r\n`;

            if (eventResources.length) {
                const categories = eventResources.map(r => `${r.value}/${event[r.value]}`);
                fileContent += `CATEGORIES:${categories.toString()}\r\n`;
            }

            fileContent += that._getICalNotifications(event);

            if (repeatOptions) {
                const exceptions = event.repeat.exceptions;

                delete repeatOptions.dtstart;
                fileContent += new rRule(repeatOptions).toString() + '\r\n';

                if (exceptions && exceptions.length) {
                    for (let i = 0; i < exceptions.length; i++) {
                        const exception = exceptions[i];

                        if (exception.hidden) {
                            fileContent += `EXDATE;VALUE=DATE:${that._getUTCDate(exception.date, event.allDay)}\r\n`;
                        }
                    }

                    fileContent += 'END:VEVENT\r\n';

                    //Create the Exceptions
                    for (let i = 0; i < exceptions.length; i++) {
                        const exception = exceptions[i];

                        if (!exception.hidden && exception.dateStart && exception.dateEnd) {
                            const exceptionResources = resources.filter(r => exception[r.vlaue]);

                            fileContent += 'BEGIN:VEVENT\r\n';
                            fileContent += that._getICalEventDates(exception);
                            fileContent +=
                                `DTSTAMP:${timeStamp}\r\n` +
                                `UID:${uId}\r\n` +
                                `RECURRENCE-ID${event.allDay ? ';VALUE=DATE' : ''}:${that._getUTCDate(exception.date, event.allDay)}\r\n` +
                                `CREATED:${timeStamp}\r\n` +
                                `DESCRIPTION:${exception.description || ''}\r\n` +
                                'SEQUENCE:1\r\n' +
                                `STATUS:${that._getICalStatus(exception.status)}\r\n` +
                                `SUMMARY:${exception.label || ''}\r\n`;

                            if (exceptionResources.length) {
                                const categories = exceptionResources.map(r => `${r.value}/${exception[r.value]}`);
                                fileContent += `CATEGORIES:${categories.toString()}\r\n`;
                            }

                            fileContent += 'END:VEVENT\r\n';
                        }
                    }
                    continue
                }
            }

            fileContent += 'END:VEVENT\r\n';
        }

        fileContent += 'END:VCALENDAR';

        if (exportDataCallback) {
            const result = exportDataCallback(fileContent, 'text/calendar', that.dataExport.fileName);
            if (result) {
                fileContent = result;
            }
        }

        const output = new Smart.Utilities.DataExporter().downloadFile(fileContent, 'text/calendar', that.dataExport.fileName);

        if (callback && output) {
            callback(output);
        }

        return output;
    }

    /**
     * Returns the date start and date end to the iCal event
     * @param {string} fileContent - the iCal file
     * @param {object} eventObj - the event object
     */
    _getICalEventDates(eventObj) {
        const that = this;

        if (!eventObj.dateStart || !eventObj.dateEnd) {
            return ''
        }

        if (eventObj.allDay || eventObj.$ && eventObj.$.event.allDay) {
            const endDate = new Date(eventObj.dateEnd);

            endDate.setDate(endDate.getDate() + 1);
            return `DTSTART;VALUE=DATE:${that._getUTCDate(eventObj.dateStart, true)}\r\n` +
                `DTEND;VALUE=DATE:${that._getUTCDate(endDate, true)}\r\n`;
        }
        else {
            return `DTSTART:${that._getUTCDate(eventObj.dateStart)}\r\n` +
                `DTEND:${that._getUTCDate(eventObj.dateEnd)}\r\n`;
        }
    }

    /**
     * Returns the iCal notifications for the event
     * @param {*} eventObj
     */
    _getICalNotifications(eventObj) {
        let notifications = '';

        if (!eventObj) {
            return notifications
        }

        const eventNotifications = eventObj.notifications;

        if (eventNotifications && eventNotifications.length) {
            const eDateStart = eventObj.dateStart,
                eTimeStart = eDateStart.getTime();

            for (let i = 0; i < eventNotifications.length; i++) {
                const n = eventNotifications[i],
                    interval = n.type === 'days' || n.type === 0 ? n.interval : n.interval * 7,
                    time = n.time,
                    date = new Date(eTimeStart - interval * 24 * 60 * 60 * 1000);

                date.setHours(time[0] % 23, time[1] % 60, 0, 0);

                let timeDiff = date.getTime() - eTimeStart;
                const sign = timeDiff < 0 ? '-' : '';

                timeDiff = Math.abs(timeDiff);

                const days = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));

                timeDiff -= days * 1000 * 60 * 60 * 24;

                const hours = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60)));

                timeDiff -= hours * 1000 * 60 * 60;

                const minutes = Math.max(0, Math.floor(timeDiff / (1000 * 60)));

                notifications += 'BEGIN:VALARM\r\n' +
                    'ACTION:DISPLAY\r\n' +
                    `DESCRIPTION:${n.message}\r\n` +
                    `TRIGGER:${sign}P${days}DT${hours}H${minutes}M0S\r\n` +
                    'END:VALARM\r\n';
            }
        }

        return notifications
    }

    /**
     * Returns a DATE WITH UTC TIME CAPITAL LETTER Z
     * @param {Date} date - a JS date
     */
    _getUTCDate(date, ignoreTime) {
        function pad(i) {
            return i < 10 ? `0${i}` : `${i}`;
        }

        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        if (ignoreTime) {
            //NOTE:When the event is allDay, time is irrelevant
            return `${date.getFullYear()}${date.getMonth() + 1}${date.getDate()}`
        }

        const year = date.getUTCFullYear(),
            month = pad(date.getUTCMonth() + 1),
            day = pad(date.getUTCDate()),
            hour = pad(date.getUTCHours()),
            minute = pad(date.getUTCMinutes()),
            second = pad(date.getUTCSeconds());

        return `${year}${month}${day}T${hour}${minute}${second}Z`
    }

    /**
     * Returns the iCal status of an event
     * @param {string} status - evnet status
     */
    _getICalStatus(status) {
        //NOTE: iCal full specs https://www.kanzaki.com/docs/ical/
        //Possible values: 'TENTATIVE', 'CONFIRMED', 'CANCELLED'
        switch (status) {
            case 'tentative':
                return 'TENTATIVE'
            case 'canceled':
                return 'CANCELED'
            case 'draft':
                return 'DRAFT'
            case 'final':
                return 'FINAL'
            case 'in-process':
                return 'IN-PROCESS'
            case 'needs-action':
                return 'NEEDS-ACTION'
            default:
                return 'CONFIRMED'
        }
    }

    /**
     * Sets the Drop target when dragging an event
     * @param {Event} event - documentMove event
     * @param {HTMLElement} target - target element
     */
    _setDropTarget(event) {
        const that = this,
            originalEvent = event.originalEvent ? event.originalEvent : event;
        let target = (that.shadowRoot || that.isInShadowDOM ? originalEvent.composedPath()[0] : originalEvent.target),
            hoveredCell = Smart.Scheduler.hoveredCell,
            hoveredScheduler = Smart.Scheduler.hoveredScheduler, newHoveredCell;

        if ((that.shadowRoot || that).contains(target)) {
            if (hoveredScheduler && hoveredScheduler !== that) {
                //Stop the autoScrolling
                hoveredScheduler.removeAttribute('dragged');
                clearInterval(hoveredScheduler._scrollInterval);
                delete hoveredScheduler._scrollInterval;
            }

            Smart.Scheduler.hoveredScheduler = hoveredScheduler = that;
            that.setAttribute('dragged', '');
        }

        if (that._isMobile && hoveredScheduler) {
            hoveredScheduler.$.timelineContent.classList.add('hide-overlay');
            target = (that.shadowRoot || document).elementFromPoint(originalEvent.pageX - window.pageXOffset, originalEvent.pageY - window.pageYOffset);
            hoveredScheduler.$.timelineContent.classList.remove('hide-overlay');
        }

        if (target && target.closest && !target.closest('.smart-scheduler-groups-container')) {
            newHoveredCell = target.closest('.smart-scheduler-cell:not(.scale)');
        }

        //Set the currently hovered Scheduler
        if (newHoveredCell && newHoveredCell !== hoveredCell && (that.shadowRoot || that).contains(newHoveredCell)) {
            const body = document.body;

            //Remove the feedback style from the previous cell
            if (hoveredCell) {
                hoveredCell.classList.remove('smart-scheduler-feedback');
            }

            if (that.disableDrop) {
                delete Smart.Scheduler.hoveredCell;
            }

            Smart.Scheduler.hoveredCell = newHoveredCell;

            if (!newHoveredCell.hasAttribute('restricted')) {
                //Add the feedback class to the target cell
                newHoveredCell.classList.add('smart-scheduler-feedback');
                body.classList.remove('smart-dragging-disabled');
                body.classList.add('smart-dragging');
            }
            else {
                body.classList.remove('smart-dragging');
                body.classList.add('smart-dragging-disabled');
            }

            Smart.Scheduler.hoveredScheduler = hoveredScheduler = that;
        }
        //Remove the feedback style from the previous cell
        else if (!newHoveredCell) {
            if (hoveredScheduler === that && !that.$.container.contains(target)) {
                that.removeAttribute('dragged');
                clearInterval(that._scrollInterval);
                delete that._scrollInterval;
                delete Smart.Scheduler.hoveredScheduler;
            }

            if (hoveredCell) {
                hoveredCell.classList.remove('smart-scheduler-feedback');
                delete Smart.Scheduler.hoveredCell;
            }
        }

        //Handles autoScroll
        if (hoveredScheduler) {
            hoveredScheduler._autoScroll(originalEvent);
        }
    }

    /**
     * Starts the Event Dragging
     * @param {Event} event - documentMove event
     */
    _setDragStart(event) {
        const that = this,
            tooltip = that.$.tooltip,
            dragDetails = that._dragDetails;
        let isLongPress = true;

        if (that._isMobile) {
            isLongPress = Date.now() - dragDetails.timestamp >= 250;

            //Prevent scrolling
            if (tooltip.contains(dragDetails.schedulerEvent) && that._list) {
                that._list.disableSwipeScroll = that._list._touchmoveInside = isLongPress;
            }
            else {
                that._scrollView.disableSwipeScroll = that._touchmoveInside = isLongPress;
            }
        }

        if (!isLongPress || Math.abs(event.pageX - dragDetails.coordinates.x) < 5 && Math.abs(event.pageY - dragDetails.coordinates.y) < 5) {
            return
        }

        if (dragDetails.schedulerEvent.hasAttribute('collector') || that.viewType === 'agenda' || dragDetails.resizeDetails) {
            return
        }

        const eventObj = dragDetails.schedulerEvent.$.event;

        if (!eventObj || eventObj.disableDrag) {
            return
        }

        const schedulerEventObj = that._cloneObject(eventObj);

        if (that.$.fireEvent('dragStart', {
            target: dragDetails.schedulerEvent,
            item: schedulerEventObj,
            itemDateRange: { dateStart: new Date(schedulerEventObj.dateStart), dateEnd: new Date(schedulerEventObj.dateEnd) },
            originalEvent: dragDetails.originialEvent
        }).defaultPrevented) {
            return
        }

        //Avoid page scrollbar appearing
        dragDetails.originalBodyOverflow = {
            overflowX: document.body.style.overflowX,
            overflowY: document.body.style.overflowY,
            overflow: document.body.style.overflow
        };

        const isVerticalScrollable = (document.scrollingElement || document.documentElement).scrollHeight > document.documentElement.clientHeight,
            isHorizontalScrollable = (document.scrollingElement || document.documentElement).scrollWidth > document.documentElement.clientWidth;

        document.body.style.overflow = document.body.style.overflowX = document.body.style.overflowY = '';

        if (isVerticalScrollable && !isHorizontalScrollable) {
            document.body.style.overflowX = 'hidden';
        }
        else if (isHorizontalScrollable && !isVerticalScrollable) {
            document.body.style.overflowY = 'hidden';
        }
        else if (!isHorizontalScrollable && !isVerticalScrollable) {
            document.body.style.overflow = 'hidden';
        }

        if (tooltip.contains(dragDetails.schedulerEvent) && that._list) {
            that._list.disableSwipeScroll = that._list._touchmoveInside = true;
        }

        tooltip.close();

        Smart.Scheduler.schedulerStart = that;
        Smart.Scheduler.feedback = that._createDragFeedback(schedulerEventObj);
        that._dragDetails.schedulerEventObj = schedulerEventObj;
        //Disable scrolling while dragging
        that._scrollView.disableSwipeScroll = that._touchmoveInside = true;

        that.setAttribute('dragged', '');

        document.body.classList.add('smart-dragging');
    }

    /**
     * Completes the event dragging process
     * @param {Event} event - documentUp event
     * @param {HTMLElement} target - scheduler event
     */
    _endDrag(event, target) {
        const that = this;

        if (!Smart.Scheduler.schedulerStart) {
            return
        }

        const dragDetails = that._dragDetails,
            schedulerDragStart = Smart.Scheduler.schedulerStart,
            schedulerEvent = Smart.Scheduler.schedulerStart._dragDetails.schedulerEvent,
            schedulerEventObj = Smart.Scheduler.schedulerStart._dragDetails.schedulerEventObj,
            hoveredScheduler = Smart.Scheduler.hoveredScheduler,
            hoveredCell = Smart.Scheduler.hoveredCell,
            body = document.body;

        if (schedulerDragStart !== that) {
            return
        }

        let dropDates = {};
        let dragDates = {};

        if (schedulerEventObj) {
            dragDates = { dateStart: schedulerEventObj.dateStart, dateEnd: schedulerEventObj.dateEnd };
        }

        //End the Dragging operation of the starting Scheduler
        Smart.Scheduler.feedback.remove();

        delete Smart.Scheduler.hoveredScheduler;
        delete Smart.Scheduler.hoveredCell;
        delete Smart.Scheduler.schedulerStart;
        delete Smart.Scheduler.feedback;

        //Retrieve the original Body overflow. Used to avoid unnecessary scrollbars while dragging
        if (dragDetails.originalBodyOverflow) {
            body.style.overflow = dragDetails.originalBodyOverflow.overflow;
            body.style.overflowX = dragDetails.originalBodyOverflow.overflowX;
            body.style.overflowY = dragDetails.originalBodyOverflow.overflowY;
        }

        if (hoveredScheduler) {
            hoveredScheduler.removeAttribute('dragged');

            //Stop ongoing autoScrolling
            clearInterval(hoveredScheduler._scrollInterval);
            delete hoveredScheduler._scrollInterval;

            //Handle Scheduler drop target
            if (hoveredCell) {
                const dropDetails = {
                    event: event,
                    schedulerEvent: schedulerEvent,
                    hoveredCell: hoveredCell,
                    hoveredScheduler: hoveredScheduler,
                    schedulerEventObj: schedulerEventObj
                };

                hoveredCell.classList.remove('smart-scheduler-feedback');

                that._setEventDropDates(dropDetails);
                that._completeEventDragDrop(dropDetails);

                dropDates.dateStart = dropDetails.newDateStart;
                dropDates.dateEnd = dropDetails.newDateEnd;
                dragDetails.schedulerEventObj = dropDetails.schedulerEventObj;
            }
        }

        if (event) {
            that._handleDisableConflict(dragDetails.schedulerEventObj)

            const dragEndEvent = that.$.fireEvent('dragEnd', {
                target: target,
                item: dragDetails.schedulerEventObj,
                itemDateRange: dropDates,
                originalEvent: event
            });

            if (dragEndEvent.defaultPrevented) {
                setTimeout(() => {
                    that.updateEvent(dragDetails.schedulerEventObj, dragDates);
                });
            }
            that.$.fireEvent('itemChange', { type: 'drag', item: dragDetails.schedulerEventObj });
        }

        body.classList.remove('smart-dragging');
        body.classList.remove('smart-dragging-disabled');
        schedulerDragStart.removeAttribute('dragged');

        //NOTE: When drag/resize of an event is finished
        that._scrollView.disableSwipeScroll = that._touchmoveInside = false;

        if (that._list) {
            that._list.disableSwipeScroll = that._list._touchmoveInside = false;
        }

        //NOTE: schedulerEvent can be a menu item inside the tooltip, se we get the corresponding element inside the timeline
        const schedulerEventElement = that._handleEventFocus({ type: 'focusin', target: schedulerEvent });

        if (schedulerEventElement) {
            schedulerEventElement.focus({ preventScroll: true });
        }

        delete that._dragDetails;
    }

    _handleDisableConflict(eventObj) {
        const that = this;
        if (that.disableConflicts) {
            const viewType = that.viewType;
            const isDayOrWeekView = ['day', 'week'].indexOf(viewType) > -1;
            const details = eventObj.allDay ? that._allDayEventDetails : (isDayOrWeekView ? that._dayOrWeekEventDetails : that._eventDetails);

            if (!details || (details && details.events.length === 0)) {
                return false;
            }

            const collisionDetails = that._getEventsCollisionIndexes(details);

            const eventOverlaps = collisionDetails.eventOverlaps;

            for (let i = 0; i < eventOverlaps.length; i++) {
                const overlap = eventOverlaps[i];
                const overlapIndex = overlap.findIndex((item) => {
                    if (eventObj.id === item.id && eventObj.label === item.label) {
                        return item;
                    }
                });

                if (overlapIndex >= 0 && overlap.length > 1) {
                    that.undo();

                    setTimeout(() => {
                        that.openNotification(that.localize('collision'), {
                            autoClose: true,
                            type: 'error'
                        });
                    });
                    break;
                }
            }
        }
    }

    /**
     * Completes the event resizing process
     * @param {Event} event - documentUp event
     * @param {HTMLElement} target - scheduler event
     */
    _endResize(event) {
        const that = this,
            dragDetails = that._dragDetails,
            resizeDetails = dragDetails ? dragDetails.resizeDetails : undefined;

        that.removeAttribute('resized');

        if (!dragDetails || !resizeDetails) {
            return
        }

        const schedulerEvent = dragDetails.schedulerEvent;
        let resizeDates = {};

        schedulerEvent.removeAttribute('resized');

        if (event) {
            that._setEventResizeDates(resizeDates);
            that._completeEventResize(resizeDates);

            resizeDetails.schedulerEventObj.dateStart = resizeDates.dateStart;
            resizeDetails.schedulerEventObj.dateEnd = resizeDates.dateEnd;

            const eventObj = resizeDetails.schedulerEventObj;
            that._handleDisableConflict(eventObj)

            that.$.fireEvent('resizeEnd', {
                target: dragDetails.schedulerEvent,
                item: resizeDetails.schedulerEventObj,
                itemDateRange: resizeDates,
                originalEvent: event.originialEvent || event
            });

            that.$.fireEvent('itemChange', { type: 'resize', item: resizeDetails.schedulerEventObj });
        }
        else {
            //Restore the original size and position of the scheduler event
            schedulerEvent.style.left = resizeDetails.originalPosition.x + 'px';
            schedulerEvent.style.top = resizeDetails.originalPosition.y + 'px';
            schedulerEvent.style.width = resizeDetails.originalSize.width + 'px';
            schedulerEvent.style.height = resizeDetails.originalSize.height + 'px';
        }

        that._scrollView.disableSwipeScroll = that._touchmoveInside = false;
        delete that._dragDetails;

        //Remove 'hover' from the scheduler event
        that._handleEventHover();

        //Refresh the Event Cells
        that._refreshTimelineEvents();

        schedulerEvent.focus({ preventScroll: true });
        that._handleEventFocus({ type: 'focusin', target: schedulerEvent });
    }

    /**
    * Completes the Drag & Drop operation by removing the event from the start Scheduler and adding it to the new
    */
    _completeEventResize(resizeDates) {
        const that = this,
            dragDetails = that._dragDetails,
            resizeDetails = dragDetails.resizeDetails,
            cellObj = resizeDetails.cellObj,
            newDateStart = resizeDates.dateStart,
            newDateEnd = resizeDates.dateEnd;

        if (!cellObj || !resizeDates || !newDateStart || !newDateEnd) {
            return
        }

        const schedulerEvent = dragDetails.schedulerEvent;
        let eventObj = schedulerEvent.$.event;

        //Check if the size has been changed at all
        if (!schedulerEvent || !eventObj || resizeDetails.otherMonthDate ||
            eventObj.dateStart.getTime() === newDateStart.getTime() && eventObj.dateEnd.getTime() === newDateEnd.getTime()) {
            return
        }

        if (that._isEventRestricted({ dateStart: newDateStart, dateEnd: newDateEnd })) {
            return
        }

        const repeatingEvent = eventObj.$ && eventObj.$.event ? eventObj.$.event : undefined;
        let originalEventObj;

        //Handle repeating event as an event exception
        if (repeatingEvent) {
            originalEventObj = that._cloneObject(repeatingEvent);
            that._handleEventExceptionDrop(eventObj);
        }
        else {
            originalEventObj = that._cloneObject(eventObj);
        }

        const isDateStartChanged = eventObj.dateStart.getTime() !== newDateStart.getTime();

        eventObj.dateStart = new Date(newDateStart);
        eventObj.dateEnd = new Date(newDateEnd);

        //If the cell is not allDay cell and the event is an allDay event then it wont be anymore
        if (['day', 'week'].indexOf(that.viewType) > -1 && eventObj.allDay && !resizeDetails.isAllDay) {
            delete eventObj.allDay;
        }

        //Update the cellTime of the start cell of the event. Used to differ the event cells when they have the same object
        if (isDateStartChanged) {
            schedulerEvent.$.cellTime = newDateStart.getTime();
        }

        //Validate the dateRange
        that._validateEventDateRange(eventObj);

        that._updateUndoRedo(originalEventObj, that._cloneObject(repeatingEvent ? repeatingEvent : eventObj), 'resizeEnd');
    }

    /**
     * Returns the new dates after event resizing
     */
    _setEventResizeDates(resizeDates) {
        const that = this,
            dragDetails = that._dragDetails,
            resizeDetails = dragDetails.resizeDetails,
            cellObj = resizeDetails.cellObj;

        if (!cellObj) {
            return
        }

        const resizeSide = resizeDetails.side,
            schedulerEvent = dragDetails.schedulerEvent,
            [position, size] = resizeSide === 'left' || resizeSide === 'right' ? ['x', 'width'] : ['y', 'height'];
        let eventObj = schedulerEvent.$.event;

        //Check if the size has been changed at all
        if (!resizeDetails.resizeFromMiddle && resizeDetails.originalPosition[position] === resizeDetails.position[position] &&
            resizeDetails.originalSize[size] === resizeDetails.size[size]) {
            resizeDates.dateStart = new Date(eventObj.dateStart);
            resizeDates.dateEnd = new Date(eventObj.dateEnd);
            return
        }

        const viewType = that.viewType,
            rightToLeft = that.rightToLeft,
            scaleTime = 60 / that._getCellsScaleCount(),
            cellObjDate = cellObj.date,
            cellObjScaleIndex = resizeDetails.scaleIndex || 0;
        let date, dateType;

        if (resizeSide === 'top') {
            dateType = 'dateStart';
            date = new Date(eventObj.dateStart);
            date.setHours(cellObjDate.getHours(), cellObjDate.getMinutes() + scaleTime * cellObjScaleIndex, 0, 0);
        }
        else if (resizeSide === 'bottom') {
            dateType = 'dateEnd';
            date = new Date(eventObj.dateEnd);
            date.setHours(cellObjDate.getHours(), cellObjDate.getMinutes() + scaleTime * (cellObjScaleIndex + 1), 0, 0);
        }
        else {
            dateType = resizeSide === 'left' && !rightToLeft || resizeSide === 'right' && rightToLeft ? 'dateStart' : 'dateEnd';

            const originalDate = eventObj[dateType];

            if (viewType === 'month') {
                //Get the verrtical cellObj that corresponds to the coordinates
                const vCellObj = that._getCellObjOffset(schedulerEvent, resizeDetails.position,
                    dateType === 'dateStart' ? 'bottom' : 'top').cellObj;

                date = new Date(originalDate);

                const hours = date.getHours(),
                    minutes = date.getMinutes(),
                    isDateEndIncluded = dateType === 'dateEnd' && hours === 0 && minutes === 0;

                date = new Date(vCellObj.date);
                date.setDate(date.getDate() + (cellObjDate.getDay() - that.firstDayOfWeek + 7) % 7);

                if (isDateEndIncluded) {
                    date.setDate(date.getDate() + 1);
                }
                else {
                    date.setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds());
                }
            }
            else {
                //all Timeline views
                date = new Date(cellObjDate);

                if (viewType === 'timelineMonth') {
                    if (dateType === 'dateEnd' && date.getHours() === 0 && date.getMinutes() === 0) {
                        if (eventObj.allDay) {
                            date.setDate(date.getDate());
                            date.setHours(0, 0, 0, 0);
                        }
                        else {
                            date.setDate(date.getDate());
                            date.setHours(23, 59, 59, 0);
                        }
                    }
                    else {
                        date.setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds());
                    }
                }
                else if (['day', 'week'].indexOf(viewType) > -1 && resizeDetails.isAllDay) {
                    date = new Date(cellObjDate);

                    if (dateType === 'dateEnd') {
                        date.setHours(23, 59, 59, 999);
                    }
                }
                else {
                    const view = that.view,
                        viewDetails = that.views.find(v => v.value && v.value === view) || {};

                    if (viewType === 'timelineWeek' && viewDetails && viewDetails.hideHours) {
                        if (dateType === 'dateEnd') {
                            date.setHours(23, 59, 59, 999);
                        }
                        else {
                            date.setHours(0, 0, 0, 0);
                        }
                    }
                    else {
                        date.setMinutes(cellObjDate.getMinutes() + scaleTime * (cellObjScaleIndex + (dateType === 'dateStart' ? 0 : 1)), 0, 0);
                    }
                }
            }
        }

        if (dateType === 'dateStart') {
            resizeDates.dateStart = date;
            resizeDates.dateEnd = new Date(eventObj.dateEnd);
        }
        else {
            resizeDates.dateStart = new Date(eventObj.dateStart);
            resizeDates.dateEnd = date;
        }

        //Note: Dropping on hidde other month days is not allowed
        if (that.hideOtherMonthDays && resizeDates.dateStart.getMonth() !== that.dateCurrent.getMonth()) {
            resizeDetails.otherMonthDate = true;
        }
    }

    /**
     * Completes the Drag & Drop operation by removing the event from the start Scheduler and adding it to the new
     * @param {Object} dropDetails - drop details regarding the event and scheduler
     */
    _completeEventDragDrop(dropDetails) {
        const that = this,
            event = dropDetails.event,
            schedulerEvent = dropDetails.schedulerEvent,
            hoveredCell = dropDetails.hoveredCell,
            hoveredScheduler = dropDetails.hoveredScheduler,
            schedulerEventObj = dropDetails.schedulerEventObj,
            newDateStart = dropDetails.newDateStart,
            newDateEnd = dropDetails.newDateEnd;


        const view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            groupOrientation = viewDetails && viewDetails.groupOrientation ? viewDetails.groupOrientation : that.groupOrientation,
            eventObj = schedulerEvent.$.event,
            repeatingEvent = eventObj.$ ? eventObj.$.event : undefined,
            cellObj = hoveredCell.$.cellObj,
            cellGroup = cellObj[groupOrientation].group,
            eventStartTime = eventObj.dateStart ? eventObj.dateStart.getTime() : new Date(2024, 1, 1, 0, 0, 0).getTime(),
            cellTime = hoveredCell.$.cellObj.time;
        let newEventObj, originalEventObj;

        const newSchedulerEventObj = JSON.parse(JSON.stringify(schedulerEventObj));
        newSchedulerEventObj.dateStart = newDateStart;
        newSchedulerEventObj.dateEnd = newDateEnd;

        if (newDateStart === newDateEnd) {
            newSchedulerEventObj.allDay = true;
        }

        for (let i in cellGroup) {
            newSchedulerEventObj[i] = cellGroup[i];
        }

        if (schedulerEvent && schedulerEvent.$.event && !schedulerEvent.$.event.dateStart && that._noDateEvents) {
            const index = that._noDateEvents.findIndex((item) => {
                if (newSchedulerEventObj.id === item.id && newSchedulerEventObj.label === item.label) {
                    return item;
                }
            });

            if (index >= 0) {
                that._noDateEvents.splice(index, 1);
                that.addEvent(newSchedulerEventObj, (id) => {
                    newSchedulerEventObj.id = id;
                });
            }
        }

        if (hoveredScheduler.disableDrop || event && event.type === 'keydown' && event.key === 'Escape' || dropDetails.otherMonthDate ||
            !newDateStart || !newDateEnd || that._isEventRestricted(newSchedulerEventObj)) {
            return
        }

        if (hoveredScheduler === that) {
            originalEventObj = that._cloneObject(repeatingEvent ? repeatingEvent : eventObj);
            newEventObj = eventObj;
        }
        else {
            newEventObj = schedulerEventObj;
        }

        if (hoveredScheduler !== that || eventStartTime !== cellTime) {
            //Converts the repeating event into an exception, if it's a repeating event
            that._handleEventExceptionDrop(eventObj, newEventObj);
        }

        newEventObj.dateStart = new Date(newDateStart);
        newEventObj.dateEnd = new Date(newDateEnd);

        if (['day', 'week'].indexOf(that.viewType) > -1) {
            newEventObj.allDay = !!cellObj.allDay;
        }

        if (eventStartTime !== cellTime) {
            //Update the cellTime of the event. It is used to differ the events when they have more than one instance
            schedulerEvent.$.cellTime = cellTime;
        }

        if (!newEventObj.allDay) {
            delete newEventObj.allDay;
        }

        if (cellGroup && !that._isEventPartOfGroup(eventObj, cellGroup)) {
            //Remove existing groups
            that.groups.forEach(g => delete newEventObj[g]);

            //Add the cell groups
            for (let i in cellGroup) {
                newEventObj[i] = cellGroup[i];
            }
        }

        if (hoveredScheduler === that) {
            that._validateEventDateRange(newEventObj);
            that._refreshTimelineEvents();

            //Create a new clone from the object
            dropDetails.schedulerEventObj = that._cloneObject(repeatingEvent || newEventObj);
            that._updateUndoRedo(originalEventObj, that._cloneObject(repeatingEvent || newEventObj), 'dragEnd');
        }
        else {
            if (!repeatingEvent) {
                that.removeEvent(eventObj);
            }

            hoveredScheduler.insertEvent(newEventObj);
        }
    }

    /**
     * Returns the new dateStart/dateEnd after event Drag and Drop
     * @param {Object} dropDetails - drop details object
     */
    _setEventDropDates(dropDetails) {
        const that = this,
            schedulerEvent = dropDetails.schedulerEvent,
            hoveredScheduler = dropDetails.hoveredScheduler,
            hoveredCell = dropDetails.hoveredCell,
            eventObj = schedulerEvent.$.event,
            cellObj = hoveredCell.$.cellObj,
            eventStartTime = eventObj.dateStart ? eventObj.dateStart.getTime() : new Date(2024, 1, 1, 0, 0, 0).getTime(),
            cellTime = hoveredCell.$.cellObj.time,
            cellObjGroup = cellObj[that.groupOrientation].group;

        if (hoveredScheduler === that && eventStartTime === cellTime && !!cellObj.allDay === !!eventObj.allDay &&
            (!cellObjGroup || that._isEventPartOfGroup(eventObj, cellObjGroup))) {
            dropDetails.newDateStart = new Date(eventObj.dateStart);
            dropDetails.newDateEnd = new Date(eventObj.dateEnd);
            return
        }

        const schedulerEventObj = dropDetails.schedulerEventObj,
            isDayOrWeekView = ['day', 'week'].indexOf(that.viewType) > -1,
            newEventObj = hoveredScheduler === that ? eventObj : schedulerEventObj;
        let newDateStart, newDateEnd;

        newDateStart = new Date(cellTime);



        if (isDayOrWeekView && !!newEventObj.allDay !== !!cellObj.allDay) {
            newDateEnd = that._getCellDateRange(cellObj).dateEnd;
        }
        else {
            if (newEventObj.dateEnd) {
                const eventDuration = newEventObj.dateEnd.getTime() - newEventObj.dateStart.getTime();

                newDateEnd = new Date(newDateStart.getTime() + eventDuration);
            }
            else {
                newDateEnd = that._getCellDateRange(cellObj).dateEnd;
            }
        }

        if (isDayOrWeekView && cellObj.allDay) {
            newDateStart.setHours(0, 0, 0, 0);

            if (newDateEnd.getHours() !== 0 && newDateEnd.getMinutes() !== 0 && newDateEnd.getSeconds() !== 0) {
                newDateEnd.setHours(23, 59, 59, 999);
            }
        }

        dropDetails.newDateStart = newDateStart;
        dropDetails.newDateEnd = newDateEnd;

        //Note: Dropping on hidde other month days is not allowed
        if (that.hideOtherMonthDays && newDateStart.getMonth() !== that.dateCurrent.getMonth()) {
            dropDetails.otherMonthDate = true;
        }
    }

    /**
     * Checks if the Timeline Task is reziable or not
     * @param {any} timelineTask
     */
    _checkEventResizability(event) {
        const that = this,
            dragDetails = that._dragDetails,
            originalEvent = event.originalEvent || event;
        let target = originalEvent.target;

        if (that._isMobile) {
            if (!dragDetails) {
                return
            }

            that.$.timelineContent.classList.add('hide-overlay');
            target = (that.shadowRoot || document).elementFromPoint(originalEvent.pageX - window.pageXOffset, originalEvent.pageY - window.pageYOffset);
            that.$.timelineContent.classList.remove('hide-overlay');
        }
        else if (that.shadowRoot && target === that) {
            target = event.originalEvent.composedPath()[0];
        }

        const timeline = that.$.timeline;
        let schedulerEvent = target && target.closest && !that.disabled ? target.closest('.smart-scheduler-event') : undefined;

        that._handleEventHover(schedulerEvent);

        if (!schedulerEvent || that.disableResize || that.viewType === 'agenda') {
            return;
        }

        const schedulerEventObj = schedulerEvent.$ ? schedulerEvent.$.event : undefined;

        if (!timeline.contains(schedulerEvent) || schedulerEvent.hasAttribute('collector') || !schedulerEventObj || schedulerEventObj.disableResize) {
            return;
        }

        const viewType = that.viewType,
            isAllDay = that.$.timelineViewAllDay.contains(schedulerEvent),
            pageX = event.pageX - window.pageXOffset,
            pageY = event.pageY - window.pageYOffset,
            minOffset = that.resizeHandlesVisibility === 'visible' || that._isMobile ? 20 : 5,
            eventRect = schedulerEvent.getBoundingClientRect();

        if (viewType.toLowerCase().indexOf('timeline') > -1 || viewType === 'month' || isAllDay) {
            if (Math.round(eventRect.left) + minOffset >= pageX && Math.round(eventRect.left) - minOffset <= pageX) {
                timeline.setAttribute('event-hovered', 'left');
                return
            }
            else if (Math.round(eventRect.right) + minOffset >= pageX && Math.round(eventRect.right) - minOffset <= pageX) {
                timeline.setAttribute('event-hovered', 'right');
                return
            }
        }
        else {
            if (Math.round(eventRect.top) + minOffset >= pageY && Math.round(eventRect.top) - minOffset <= pageY) {
                timeline.setAttribute('event-hovered', 'top');
                return
            }
            else if (Math.round(eventRect.bottom) + minOffset >= pageY && Math.round(eventRect.bottom) - minOffset <= pageY) {
                timeline.setAttribute('event-hovered', 'bottom');
                return
            }
        }

        if (timeline.hasAttribute('event-hovered')) {
            timeline.setAttribute('event-hovered', '');
        }
    }

    /**
     * Handles Scheduler event hover state
     * @param {HTMLElement | undefined} target - scheduler event
     */
    _handleEventHover(schedulerEvent) {
        const that = this,
            timeline = that.$.timeline;

        if (!schedulerEvent && !timeline.hasAttribute('event-hovered') || schedulerEvent && schedulerEvent.hasAttribute('hover')) {
            return
        }

        const schedulerEventObj = schedulerEvent && schedulerEvent.$ ? schedulerEvent.$.event : undefined;
        let schedulerEvents = [].concat(Array.from(that.$.timelineEventsContainer.children), Array.from(that.$.allDayEventsContainer.children));

        if (that._eventList) {
            schedulerEvents = schedulerEvents.concat(Array.from(that._eventList.children));
        }

        for (let i = 0; i < schedulerEvents.length; i++) {
            const timelineEvent = schedulerEvents[i],
                eventObj = timelineEvent.$.event;

            if (timelineEvent === schedulerEvent || schedulerEventObj && schedulerEventObj === eventObj) {
                timelineEvent.setAttribute('hover', '');
            }
            else {
                timelineEvent.removeAttribute('hover');
            }
        }

        if (schedulerEventObj || schedulerEvent) {
            timeline.setAttribute('event-hovered', '');
        }
        else {
            timeline.removeAttribute('event-hovered');
        }
    }

    /**
    * Handles the resizing of a Events
    * @param {any} event
    */
    _handleEventResize(event) {
        const that = this,
            dragDetails = that._dragDetails,
            schedulerEvent = dragDetails ? dragDetails.schedulerEvent : undefined;

        if (that.disableResize || !dragDetails || !schedulerEvent || that.viewType === 'agenda' ||
            (that._isMobile && Date.now() - dragDetails.timestamp < 250)) {
            return;
        }

        if (!that.hasAttribute('resized')) {
            that._setResizeStart(schedulerEvent);
        }

        const resizeDetails = dragDetails.resizeDetails;

        if (!resizeDetails) {
            return
        }

        const pageX = event.pageX - window.pageXOffset,
            pageY = event.pageY - window.pageYOffset,
            resizeSide = resizeDetails.side,
            timelineContainerRect = that.$.timelineContainer.getBoundingClientRect();
        let x;

        //Right-To-Left offset
        if (resizeDetails.rightToLeft) {
            x = timelineContainerRect.right - pageX;
        }
        else {
            x = pageX - timelineContainerRect.left;
        }

        const newPosition = {
            x: Math.max(0, x + that.scrollLeft),
            y: Math.max(0, pageY - timelineContainerRect.top + that.scrollTop)
        }, cellObjDetails = that._getCellObjOffset(schedulerEvent, newPosition, resizeSide);

        that._autoScroll(event);

        if (!cellObjDetails) {
            return
        }

        resizeDetails.cellObj = cellObjDetails.cellObj;
        resizeDetails.scaleIndex = cellObjDetails.scaleIndex;

        if (resizeSide === 'left' || resizeSide === 'right') {
            if (!that._resizeEventHorizontal(cellObjDetails, resizeSide)) {
                return
            }
        }
        else {
            if (!that._resizeEventVertical(cellObjDetails, resizeSide)) {
                return
            }
        }
    }

    /**
     * Marks the begining of an event resizing operation
     * @param {*} schedulerEvent
     */
    _setResizeStart(schedulerEvent) {
        const that = this,
            dragDetails = that._dragDetails,
            eventObj = schedulerEvent.$.event,
            timeline = that.$.timeline,
            eventList = that._eventList;

        if (!eventObj || eventObj.disableResize || Smart.Scheduler.schedulerStart || eventList && eventList.contains(schedulerEvent)) {
            return;
        }

        const schedulerEventObj = that._cloneObject(eventObj);

        if (that.$.fireEvent('resizeStart', {
            target: dragDetails.schedulerEvent,
            item: schedulerEventObj,
            itemDateRange: { dateStart: new Date(eventObj.dateStart), dateEnd: new Date(eventObj.dateEnd) },
            originalEvent: dragDetails.originialEvent
        }).defaultPrevented) {
            return;
        }

        that.$.tooltip.close();
        that.setAttribute('resized', '');
        schedulerEvent.setAttribute('resized', '');
        that._scrollView.disableSwipeScroll = that._touchmoveInside = true;

        const rightToLeft = that.rightToLeft,
            eventLeft = parseFloat(schedulerEvent.style[rightToLeft ? 'right' : 'left']),
            eventTop = parseFloat(schedulerEvent.style.top),
            eventWidth = parseFloat(schedulerEvent.style.width),
            eventHeight = parseFloat(schedulerEvent.style.height),
            originalSize = { width: eventWidth, height: eventHeight },
            side = timeline.getAttribute('event-hovered'),
            originalPosition = { x: eventLeft, y: eventTop };

        //Hides all previous event cells that correspond to the same event. This usually happens in 'month' view or when grouped by date
        const schedulerEvents = schedulerEvent.closest('.smart-scheduler-events-container').children;
        let resizeFromMiddle;

        for (let i = 0; i < schedulerEvents.length; i++) {
            const eventCell = schedulerEvents[i],
                eObj = eventCell.$ ? eventCell.$.event : undefined,
                eLeft = parseFloat(eventCell.style.left),
                eTop = parseFloat(eventCell.style.top);

            if (eObj === eventObj && schedulerEvent !== eventCell &&
                (side === 'left' && (eTop < eventTop || eTop === eventTop && eLeft < eventLeft) ||
                    side === 'right' && (eTop > eventTop || eTop === eventTop && eLeft > eventLeft))) {
                eventCell.classList.add('smart-hidden');
                resizeFromMiddle = true;
            }
        }

        dragDetails.resizeDetails = {
            side: side,
            originalSize: originalSize,
            originalPosition: originalPosition,
            position: { x: originalPosition.x, y: originalPosition.y },
            size: { width: originalSize.width, height: originalSize.height },
            isAllDay: that.$.timelineViewAllDay.contains(schedulerEvent),
            rightToLeft: rightToLeft,
            resizeFromEnd: side === 'bottom' || (side === 'right' && !rightToLeft || side === 'left' && rightToLeft),
            resizeFromMiddle: resizeFromMiddle,
            schedulerEventObj: schedulerEventObj
        };
    }

    /**
     * Handles horizontal resizing of a scheduler event
     * @param {*} cellObjOffsetDetails - cellObj offset details
     * @param {*} resizeSide - the resizing side
     */
    _resizeEventHorizontal(cellObjOffsetDetails, resizeSide) {
        const that = this,
            dragDetails = that._dragDetails,
            schedulerEvent = dragDetails.schedulerEvent,
            rightToLeft = that.rightToLeft,
            resizeDetails = dragDetails.resizeDetails;
        let currentPosition = resizeDetails.position.x,
            offset = cellObjOffsetDetails.offset, size;

        if ((resizeSide === 'left' && !rightToLeft) || (resizeSide === 'right' && rightToLeft)) {
            const originalOffset = resizeDetails.originalPosition.x;

            if (currentPosition === offset) {
                return
            }

            if (currentPosition < offset) {
                offset = currentPosition < originalOffset ? Math.min(originalOffset, offset) : offset;
                size = resizeDetails.size.width - (offset - currentPosition);
            }
            else {
                offset = currentPosition > originalOffset ? Math.max(originalOffset, offset) : offset;
                size = resizeDetails.size.width + (currentPosition - offset);
            }

            if (size <= 0) {
                return
            }

            resizeDetails.position.x = offset;

            if (rightToLeft) {
                schedulerEvent.style.left = '';
                schedulerEvent.style.right = offset + 'px';
            }
            else {
                schedulerEvent.style.right = '';
                schedulerEvent.style.left = offset + 'px';
            }
        }
        //Resize From Right side
        else {
            currentPosition += resizeDetails.size.width;
            offset += cellObjOffsetDetails.size;

            if (currentPosition === offset) {
                return
            }

            if (currentPosition < offset) {
                size = resizeDetails.size.width + (offset - currentPosition);
            }
            else {
                size = resizeDetails.size.width - (currentPosition - offset);
            }

            if (size <= 0) {
                return
            }
        }

        resizeDetails.size.width = size;
        schedulerEvent.style.width = resizeDetails.size.width + 'px';

        return true
    }

    /**
     * Handles vertical resizing of a scheduler event
     * @param {*} cellObjOffsetDetails - cellObj offset details
     * @param {*} resizeSide - the resizing side
     */
    _resizeEventVertical(cellObjOffsetDetails, resizeSide) {
        const that = this,
            dragDetails = that._dragDetails,
            schedulerEvent = dragDetails.schedulerEvent,
            resizeDetails = dragDetails.resizeDetails;
        let currentPosition = resizeDetails.position.y,
            offset = cellObjOffsetDetails.offset, size;

        //Resize from the Top
        if (resizeSide === 'top') {
            const originalOffset = resizeDetails.originalPosition.y;

            if (currentPosition === offset) {
                return
            }

            if (currentPosition < offset) {
                offset = currentPosition < originalOffset ? Math.min(originalOffset, offset) : offset;
                size = resizeDetails.size.height - (offset - currentPosition);
            }
            else {
                offset = currentPosition > originalOffset ? Math.max(originalOffset, offset) : offset;
                size = resizeDetails.size.height + (currentPosition - offset);
            }

            if (size <= 0) {
                return
            }

            resizeDetails.position.y = offset;

            schedulerEvent.style.top = offset + 'px';
        }
        //Resize from the Bottom
        else {
            currentPosition += resizeDetails.size.height;
            offset += cellObjOffsetDetails.size;

            if (currentPosition === offset) {
                return
            }

            if (currentPosition < offset) {
                size = resizeDetails.size.height + (offset - currentPosition);
            }
            else {
                size = resizeDetails.size.height - (currentPosition - offset);
            }

            if (size <= 0) {
                return
            }
        }

        resizeDetails.size.height = size;
        schedulerEvent.style.height = resizeDetails.size.height + 'px';

        return true
    }

    /**
     * Returns the next possible cellObj when resizing and event
     * @param {HTMLElement} schedulerEvent - the scheduler event cell that is being resized
     * @param {Object<number>} dragPosition - the current pointer position
     * @param {String} resizeSide - the size from which the event is being resized
     */
    _getCellObjOffset(schedulerEvent, dragPosition, resizeSide) {
        const that = this,
            resizeDetails = that._dragDetails.resizeDetails,
            timelineCells = that._timelineCells,
            eventObj = schedulerEvent.$.event,
            scaleCount = resizeDetails.isAllDay ? 1 : that._getCellsScaleCount(),
            [size, offset, orientation, position] = resizeSide === 'right' || resizeSide === 'left' ?
                ['width', 'left', 'horizontal', 'x'] : ['height', 'top', 'vertical', 'y'],
            resizeFromEnd = resizeDetails.resizeFromEnd,
            cellObjs = timelineCells[orientation],
            startSize = resizeDetails.originalSize[size];
        let originalPosition = resizeDetails.originalPosition[position],
            startPosition = originalPosition,
            pointerPosition = dragPosition[position], cellObj, firstCellObj, lastCellObj,
            firstCellPosition, lastCellPosition;

        //Validate the pointer position according to the start/end of the event
        if (resizeFromEnd) {
            originalPosition = parseFloat((originalPosition + startSize).toFixed(2));
            pointerPosition = Math.max(startPosition, pointerPosition);
            firstCellPosition = startPosition;
        }
        else {
            startPosition = parseFloat((startPosition + startSize).toFixed(2));
            pointerPosition = Math.min(startPosition, pointerPosition);
            lastCellPosition = startPosition;
        }

        //Find the next possible cellObj
        for (let i = 0; i < cellObjs.length; i++) {
            const cObj = cellObjs[i];

            if (cObj.group && !that._isEventPartOfGroup(eventObj, cObj.group)) {
                continue;
            }

            const cObjEndPosition = parseFloat((cObj[offset] + cObj[size]).toFixed(2));

            if (!firstCellObj) {
                if (firstCellPosition === undefined) {
                    if (cObjEndPosition > pointerPosition) {
                        firstCellObj = cObj;
                    }
                }
                else if (cObjEndPosition > firstCellPosition) {
                    firstCellObj = cObj;
                }
            }

            if (lastCellPosition === undefined) {
                if (cObj[offset] <= pointerPosition) {
                    lastCellObj = cObj;
                }
            }
            else if (cObj[offset] < lastCellPosition) {
                lastCellObj = cObj;
            }

            if (pointerPosition !== startPosition && cObj[offset] <= pointerPosition && cObjEndPosition >= pointerPosition) {
                cellObj = cObj;
            }
        }

        if (!cellObj) {
            cellObj = resizeFromEnd && startPosition === pointerPosition ||
                !resizeFromEnd && startPosition !== pointerPosition ? firstCellObj : lastCellObj;
        }

        if (!cellObj) {
            return
        }

        let cellOffset = cellObj[offset], scaleIndex,
            cellSize = parseFloat((cellObj[size] / scaleCount).toFixed(2));

        //Find the scaleIndex of the celLobj
        for (let i = 0; i < scaleCount; i++) {
            const scaleCellOffset = parseFloat((cellObj[offset] + cellSize * i).toFixed(2));

            if (startPosition !== pointerPosition && scaleCellOffset === pointerPosition ||
                scaleCellOffset + cellSize === pointerPosition ||
                scaleCellOffset < pointerPosition && scaleCellOffset + cellSize >= pointerPosition) {
                cellOffset = scaleCellOffset;
                scaleIndex = i;
            }
        }

        if (originalPosition > cellOffset && originalPosition < parseFloat((cellOffset + cellSize).toFixed(2))) {
            if (resizeFromEnd && pointerPosition <= originalPosition) {
                cellSize = originalPosition - cellOffset;
            }
            else if (!resizeFromEnd && pointerPosition >= originalPosition) {
                cellOffset = originalPosition;
            }
        }

        return { offset: cellOffset, size: cellSize, cellObj: cellObj, scaleIndex: scaleIndex }
    }

    /**
     * Converts a repeating event into an event exception
     * @param {Object} eventObj - event object
     * @param {Object} newEventObj - a new event object
     */
    _handleEventExceptionDrop(eventObj, newEventObj) {
        const repeatingEvent = eventObj.$ ? eventObj.$.event : undefined;

        if (!newEventObj) {
            newEventObj = eventObj;
        }

        if (eventObj !== newEventObj) {
            //NOTE: Event exceptions cannot repeat
            delete newEventObj.repeat;
            delete newEventObj.date;
            return
        }

        if (!repeatingEvent) {
            return
        }

        //Convert the repeating event into an exception
        const repeatObj = repeatingEvent.repeat;

        if (!newEventObj.date) {
            newEventObj.date = new Date(newEventObj.dateStart);
        }

        //NOTE: Event exceptions cannot repeat
        delete newEventObj.repeat;

        if (repeatObj) {
            const eventObjExceptions = repeatObj.exceptions;

            if (!eventObjExceptions) {
                repeatObj.exceptions = [newEventObj];
            }
            else if (eventObjExceptions.indexOf(newEventObj) < 0) {
                eventObjExceptions.push(newEventObj);
            }
        }
    }

    /**
    * Document Drag Start
    * @param {any} event
    */
    _dragStartHandler(event) {
        const that = this,
            closest = event.target.closest;

        if (that._dragDetails || (closest && closest.call(that, 'smart-scheduler') === that)) {
            if (event.target) {
                let target = event.target;
                while (target) {
                    if (target.className && target.className.indexOf('smart-scheduler') >= 0) {
                        event.preventDefault();
                        return;
                    }

                    target = target.parentNode;
                }
            }
        }
    }

    /**
     * Handles autoScroll functionality
     * @param {any} event
     */
    _autoScroll(event) {
        const that = this,
            timelineContainer = that.$.timelineContainer,
            target = (event.originalEvent || event).target,
            autoScrollStep = that.autoScrollStep,
            dragDetails = that._dragDetails,
            rightToLeft = that.rightToLeft;

        function continueOperation(coeff, isVerticallScroll) {
            if (!isVerticallScroll) {
                that.scrollLeft -= (rightToLeft ? -1 : 1) * autoScrollStep * coeff;

                if (dragDetails) {
                    dragDetails.coordinates.x += autoScrollStep * coeff;
                }
            }
            else {
                that.scrollTop -= autoScrollStep * coeff;

                if (dragDetails) {
                    dragDetails.coordinates.y += autoScrollStep * coeff;
                }
            }

            if (that.hasAttribute('resized')) {
                that._handleEventResize(event);
            }
        }

        if (that.disableAutoScroll || !event || !timelineContainer.contains(target) ||
            (!that.hasAttribute('dragged') && !that.hasAttribute('resized'))) {
            clearInterval(that._scrollInterval);
            return;
        }

        clearInterval(that._scrollInterval);

        const timelineRect = timelineContainer.getBoundingClientRect(),
            isAllDayTarget = dragDetails && dragDetails.resizeDetails ? dragDetails.resizeDetails.isAllDay : false,
            scrollZoneSize = 50;

        that._scrollInterval = setInterval(function () {
            //20px is the autoScroll zone size
            if ((that.scrollLeft || rightToLeft) && event.clientX <= timelineRect.left + scrollZoneSize) {
                continueOperation(1);
            }
            else if (that.scrollLeft !== (rightToLeft ? 0 : that.scrollWidth) && event.clientX >= timelineRect.left + timelineRect.width - scrollZoneSize) {
                continueOperation(-1);
            }
            else if (!isAllDayTarget) {
                if (that.scrollTop && event.clientY <= timelineRect.top + scrollZoneSize) {
                    continueOperation(1, true);
                }
                else if (that.scrollTop !== that.scrollHeight && event.clientY >= timelineRect.top + timelineRect.height - scrollZoneSize) {
                    continueOperation(-1, true);
                }
                else {
                    clearInterval(that._scrollInterval);
                    that._scrollInterval = undefined;
                }
            }
        }, 1);
    }

    /**
     * Creates the drag feedback element
     */
    _createDragFeedback(schedulerEventObj) {
        const that = this,
            theme = that.theme,
            rightToLeft = that.rightToLeft,
            schedulerEvent = that._dragDetails.schedulerEvent;
        let feedback = document.createElement('div');

        if (that.dragFeedbackFormatFunction) {
            feedback.innerHTML = that.dragFeedbackFormatFunction(schedulerEventObj) || '';
        }
        else {
            feedback = schedulerEvent.cloneNode(true)
            feedback.setAttribute('view-type', that.viewType);
            feedback.setAttribute('event-render-mode', that.eventRenderMode);
        }

        feedback.classList.remove('smart-scheduler-event');
        feedback.classList.add('smart-scheduler-drag-feedback');
        feedback.setAttribute('parent-scheduler-id', that.id);

        if (that._isMobile) {
            feedback.setAttribute('mobile', '');
        }

        if (theme) {
            feedback.setAttribute('theme', theme);
        }

        if (rightToLeft) {
            feedback.setAttribute('right-to-left', '');
        }

        return feedback
    }

    /**
     * Returns a matching event
     * @param {Object} event - a Scheduler event
     */
    _containsEvent(event) {
        const that = this,
            events = that._events;

        if (!event) {
            return
        }

        if (events.indexOf(event) > -1) {
            return event
        }

        //Unique event props to distinguish events
        // const uniqueProps =  ['id', 'label', 'description', 'dateStart', 'dateEnd'];
        const uniqueProps = ['label', 'description'],
            groups = that.groups,
            eventId = typeof event === 'string' ? event : event.id;

        for (let i = 0; i < events.length; i++) {
            const e = events[i];

            if (e.id !== undefined && (e.id + '') === eventId) {
                return e
            }

            if (e.id !== undefined && (e.id + '') === ('' + eventId)) {
                return e
            }

            if (e.id !== undefined && (e.id + '') !== (eventId + '')) {
                continue;
            }

            if (uniqueProps.every(p => {
                if (e[p] instanceof Date) {
                    return new Date(e[p]).getTime() === new Date(event[p]).getTime()
                }
                else {
                    return e[p] === event[p]
                }
            }) && (!groups.length || groups.every(g => event[g] === e[g]))) {
                //Return the duplicate event
                return e
            }
        }
    }

    /**
     * Handles Timeline cell keyboard navigation
     * @param {Object} event
     */
    _keyDownHandler(event) {
        const that = this;

        if (that.readonly || that.hasAttribute('modal')) {
            delete that._keyPressed;
            return;
        }

        const tooltip = that.$.tooltip,
            key = event.key,
            viewItemsContainer = that.$.viewItemsContainer,
            eventTarget = event.target;

        switch (key) {
            case 'End':
            case 'Home':
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight':
            case 'PageDown':
            case 'PageUp':
                event.preventDefault();
                that._handleKeyNavigation(event);
                break;
            case 'Enter':
            case 'Escape': {
                if (key === 'Enter') {
                    if (tooltip.contains(eventTarget)) {
                        const target = tooltip.querySelector('[selected]');

                        if (!target) {
                            return
                        }

                        if (eventTarget === viewItemsContainer) {
                            const showWeekendItem = that.$.showWeekendItem;

                            if (showWeekendItem && showWeekendItem.hasAttribute('selected')) {
                                that._checkHideWekendItem(showWeekendItem);
                            }

                            tooltip.close();
                            that.$.viewItemsButton.focus({ preventScroll: true });
                        }
                        else if (eventTarget.classList.contains('smart-scheduler-event-button')) {
                            //Delete event button
                            that._deleteEventViaWindow(eventTarget.closest('.smart-scheduler-event').$.event);
                            tooltip.close();
                            that.$.timeline.focus({ preventScroll: true });
                        }
                        else if (target.classList.contains('smart-scheduler-event')) {
                            //Open the window to edit the event
                            that._doubleClickHandler(target);
                        }
                        else if (target.classList.contains('smart-scheduler-context-menu-item')) {
                            //Context menu item
                            that._handleContextMenuItemClick(target);
                        }
                        event.preventDefault();
                    }
                    else if (eventTarget.classList.contains('smart-scheduler-event')) {
                        //Open the window to edit the event
                        that._doubleClickHandler(eventTarget);
                    }
                    else if (eventTarget.classList.contains('smart-scheduler-legend-res-item')) {
                        if (!that.filterable) {
                            return
                        }
                        //Handle Legend Item click
                        that._handleLegendItemClick(eventTarget);
                    }
                    else if (eventTarget === that.$.timeline) {
                        //Open window to create a new event
                        if (that.autoCreateDialog) {
                            that._setupAutoCreateDialog(event);
                        }
                        else {
                            that._openWindow();
                        }
                        event.preventDefault();
                    }

                    break;
                }

                if (key === 'Escape') {
                    if (Smart.Scheduler.schedulerStart === that) {
                        that._endDrag(event, that);
                        event.preventDefault();
                    }
                    else if (that.hasAttribute('resized')) {
                        that._endResize();
                        event.preventDefault();
                    }
                }

                tooltip.close();

                if (tooltip.selector) {
                    tooltip.selector.focus({ preventScroll: true });
                }
                break
            }
            case 'Tab': {
                //Focuses the next event cell
                const eventCell = eventTarget;
                let eventCells;

                if (eventCell.classList.contains('smart-scheduler-event') || eventCell.classList.contains('smart-scheduler-view')) {
                    eventCells = Array.from(that.$.timeline.querySelectorAll('.smart-scheduler-event'));
                }

                if (!eventCells) {
                    break
                }

                const eventCellIndex = eventCells.indexOf(eventCell),
                    nextEventCell = eventCellIndex < 0 ? eventCells[0] : eventCells[eventCellIndex + (event.shiftKey ? - 1 : 1)]

                if (tooltip.visible && tooltip.contains(eventCell)) {
                    return
                }

                if (nextEventCell) {
                    event.preventDefault();
                    nextEventCell.focus({ preventScroll: true });
                }
                break;
            }
            case 'c':
            case 'C':
            case 'x':
            case 'X':
                if (!that._dragDetails && event.ctrlKey && eventTarget.classList.contains('smart-scheduler-event')) {
                    that._updateClipboard(eventTarget.$.event, key === 'c' ? 'copy' : 'cut');
                    that._handleEventCut(eventTarget);
                }
                break;
            case 'z':
            case 'Z':
            case 'y':
            case 'Y': {
                const rootNode = that.getRootNode(),
                    activeElementClassList = rootNode ? rootNode.activeElement.classList : undefined;

                if (!activeElementClassList.contains('smart-scheduler-event') && !activeElementClassList.contains('smart-scheduler-view')
                    && !activeElementClassList.contains('smart-scheduler')) {
                    return
                }

                if (!that._dragDetails && event.ctrlKey) {
                    //Executes Undo/Redo operation
                    that._handleUndoRedo(key === 'z' ? 'undo' : 'redo');
                }
                break;
            }
            case 'v':
            case 'V':
                if (!that._dragDetails && event.ctrlKey && eventTarget.classList.contains('smart-scheduler-view') && that._selectedCellObj) {
                    that._pasteEvent(that._selectedCellObj.from);
                }
                break;
            case 'Delete':
                if (!that._dragDetails && eventTarget.classList.contains('smart-scheduler-event') && !eventTarget.hasAttribute('collector')) {
                    if (that.$.fireEvent('eventShortcutKey', {
                        key: key,
                        target: eventTarget,
                        eventObj: that._cloneObject(eventTarget.$.event)
                    }).defaultPrevented) {
                        return
                    }

                    event.preventDefault();
                    that._handleEventMenuDelete(eventTarget);
                }
                break;
            case ' ':
                if (that.filterable && eventTarget.classList.contains('smart-scheduler-legend-res-item')) {
                    //Handle Legend Item click
                    that._handleLegendItemClick(eventTarget);
                }
                break
            default:
                if (eventTarget === viewItemsContainer || eventTarget.closest('.smart-scheduler-view-items-button')) {
                    //Handles view items menu shortcut keys
                    let keyPressed = that._keyPressed;

                    if (!keyPressed) {
                        keyPressed = that._keyPressed = {};
                    }

                    keyPressed[key.toLowerCase()] = true;

                    //Find the view item that has the shortcut
                    const keyNames = Object.keys(keyPressed),
                        viewItem = Array.from(viewItemsContainer.children).find(i => {
                            const shortcutKeys = (i.getAttribute('shortcut-key') || '').toLowerCase().split('+');
                            shortcutKeys.forEach(i => i.trim());
                            return keyNames.length === shortcutKeys.length && keyNames.every(k => shortcutKeys.indexOf(k) > -1);
                        });

                    if (viewItem) {
                        that._handleViewSelection(viewItem);
                        event.preventDefault();
                        tooltip.close();
                    }
                }

                break;
        }
    }

    /**
     * Scheduler key up handler
     */
    _keyUpHandler(event) {
        const that = this;

        if (that.disabled || that.readonly) {
            delete that._keyPressed;
            return
        }

        let keyPressed = that._keyPressed;

        if (keyPressed) {
            delete keyPressed[event.key.toLowerCase()];

            if (!Object.keys(keyPressed).length) {
                delete that._keyPressed;
            }
        }
    }

    /**
     * Handles Context Menu Item click
     * @param {HTMLElement} target - the target element
     */
    _handleContextMenuItemClick(target) {
        const that = this,
            tooltip = that.$.tooltip,
            tooltipTarget = tooltip.selector,
            action = target.getAttribute('value');
        let targetObj;

        switch (action) {
            case 'create': {
                //Create a new event
                if (tooltipTarget.classList.contains('smart-scheduler-cell')) {
                    if (that._selectedCellObj) {
                        targetObj = that._createEventFromSelection();
                    }
                    else {
                        const cellDateRange = that._getCellDateRange(tooltipTarget),
                            cellObj = tooltipTarget.$.cellObj,
                            cellGroup = cellObj.vertical.group || cellObj.horizontal.group;

                        targetObj = {
                            dateStart: cellDateRange.dateStart,
                            dateEnd: cellDateRange.dateEnd,
                            allDay: tooltipTarget.hasAttribute('all-day')
                        }

                        //Set the cell group to the new event
                        if (cellGroup) {
                            for (let g in cellGroup) {
                                targetObj[g] = cellGroup[g];
                            }
                        }
                    }
                }
                else if (tooltipTarget.classList.contains('smart-scheduler-event')) {
                    const eventObj = Object.assign({}, tooltipTarget.$.event);

                    targetObj = {
                        dateStart: new Date(eventObj.dateStart),
                        dateEnd: new Date(eventObj.dateEnd),
                        allDay: eventObj.allDay
                    }
                }

                that._openWindow(targetObj);
                break;
            }
            case 'edit':
                //Edit the current event
                that._doubleClickHandler(tooltipTarget);
                break;
            case 'copy':
            case 'cut':
                if (tooltipTarget.classList.contains('smart-scheduler-event') && !tooltipTarget.hasAttribute('collector')) {
                    that._updateClipboard(tooltipTarget.$.event, action);
                    that._handleEventCut(tooltipTarget);
                }
                break;
            case 'paste':
                if (target.hasAttribute('disabled')) {
                    return
                }

                if (tooltipTarget.classList.contains('smart-scheduler-cell')) {
                    //Paste the event in the target cell
                    that._pasteEvent(tooltipTarget);
                }
                break;
            case 'delete': {
                //Delete the event
                if (!tooltipTarget.classList.contains('smart-scheduler-event') || tooltipTarget.hasAttribute('collector')) {
                    return
                }

                //Handles event deleting
                that._handleEventMenuDelete(tooltipTarget);
                // that._deleteEventViaWindow(tooltipTarget.$.event);
                break;
            }
        }

        if (target instanceof HTMLElement) {
            const details = { item: target, type: 'context', value: target.getAttribute('value') };

            if (targetObj) {
                details.itemObj = that._cloneObject(targetObj);
            }

            that.$.fireEvent('itemClick', details);
        }

        tooltip.close();
    }

    /**
     * Updates the clipboard when an event is copied or cut
     * @param {object} eventObj - the target event object
     * @param {string} action - the copy/cut action name
     */
    _updateClipboard(eventObj, action) {
        const that = this;

        if (!eventObj || !action) {
            delete that._clipboard;
            return
        }

        that._clipboard = { target: eventObj, action: action };

        let csvFormat = [], csvHeader = [];
        const locale = that.locale,
            dateFormatObj = {
                year: that.yearFormat,
                month: that.monthFormat,
                day: that.dayFormat,
                hour: that.hourFormat,
                minute: that.minuteFormat
            },
            propertyOrder = [{
                label: 'id',
                value: 'Id'
            },
            {
                label: 'label',
                value: 'Label'
            },
            {
                label: 'description',
                value: 'Description'
            },
            {
                label: 'dateStart',
                value: 'Date Start'
            },
            {
                label: 'dateEnd',
                value: 'Date End'
            },
            {
                label: 'allDay',
                value: 'All Day'
            },
            {
                label: 'repeat',
                value: 'Repeat'
            },
            {
                label: 'notifications',
                value: 'Notifications'
            }];

        for (let i = 0; i < propertyOrder.length; i++) {
            const propName = propertyOrder[i].label;

            if (eventObj[propName] !== undefined) {
                let value = eventObj[propName];

                if (value instanceof Date) {
                    // value = new Date(value).toISOString();
                    value = new Intl.DateTimeFormat(locale, dateFormatObj).format(new Date(value));
                }
                else if (propName === 'repeat') {
                    value = (Object.keys(value).length > 0) + '';
                }
                else if (propName === 'notifications') {
                    value = (Array.isArray(value) && value.length > 0) + '';
                }

                csvHeader.push(propertyOrder[i].value);
                csvFormat.push(value + '');
            }
        }

        csvFormat = csvHeader.join(',') + '\n' + csvFormat.join(',');

        //Copy to the Clipboard API as JSON string
        //NOTE: Firefox and Chrome, Safari support the Clipbaord API only if permission is granted
        if (navigator.clipboard) {
            navigator.clipboard.writeText(csvFormat);
        }
        //Fallback
        else if (document.execCommand) {
            //Safari does not support the execCommand function
            const textArea = document.createElement('textarea'),
                activeElement = that.getRootNode().activeElement

            textArea.value = csvFormat;
            textArea.style.position = 'fixed';

            document.body.appendChild(textArea);

            textArea.focus({ preventScroll: true });
            textArea.select();

            document.execCommand('copy');

            document.body.removeChild(textArea);

            if (activeElement) {
                activeElement.focus({ preventScroll: true });
            }
            return
        }
    }

    /**
     * Sets the cut attribute to the target Event element
     * @param {HTMLElement} tooltipTarget
     */
    _handleEventCut(target) {
        const that = this,
            clipboard = that._clipboard,
            schedulerEvents = Array.from(that.$.timelineEventsContainer.children).concat(Array.from(that.$.allDayEventsContainer.children));
        let cutEventObj;

        if (!clipboard || clipboard.action !== 'cut') {
            target = undefined;
        }

        if (target) {
            cutEventObj = target.$.event;
        }
        else if (!target && clipboard && clipboard.action === 'cut') {
            cutEventObj = clipboard.target;
        }

        //Repeating events cannot be copied/cut
        if (cutEventObj && cutEventObj.$ && cutEventObj.$.event) {
            const repeatingEvent = cutEventObj.$.event;

            if (repeatingEvent && repeatingEvent.repeat &&
                (!repeatingEvent.repeat.exceptions || repeatingEvent.repeat.exceptions.indexOf(cutEventObj) < 0)) {
                cutEventObj = undefined;
            }
        }

        //Handle the 'cut' attribute from a cut event
        for (let i = 0; i < schedulerEvents.length; i++) {
            const schedulerEvent = schedulerEvents[i];

            if (cutEventObj && schedulerEvent.$ && schedulerEvent.$.event === cutEventObj) {
                schedulerEvent.setAttribute('cut', '');
            }
            else {
                schedulerEvent.removeAttribute('cut');
            }
        }
    }

    /**
     * Handles event Paste operation
     * @param {HTMLEElement} cell - the target cell where the event should be pasted
     */
    _pasteEvent(cellObj) {
        const that = this,
            clipboard = that._clipboard;

        if (!clipboard) {
            return
        }

        let target = clipboard.target;

        if (!target) {
            return
        }

        cellObj = cellObj instanceof HTMLElement ? cellObj.$.cellObj : cellObj;

        if (!cellObj) {
            return
        }

        //Repeating events cannot be pasted, only exceptions can be after cut operation
        const repeatingEvent = target.$ && target.$.event ? target.$.event : undefined;

        if (repeatingEvent && repeatingEvent.repeat &&
            (!repeatingEvent.repeat.exceptions || repeatingEvent.repeat.exceptions.indexOf(target) < 0)) {
            return
        }

        const view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            groupOrientation = viewDetails && viewDetails.groupOrientation ? viewDetails.groupOrientation : that.groupOrientation,
            cellGroup = cellObj[groupOrientation].group,
            isDayOrWeekView = ['day', 'week'].indexOf(that.viewType) > -1;
        let newDateStart, newDateEnd, eventName, originalEventObj;

        switch (clipboard.action) {
            case 'copy': {
                if (repeatingEvent) {
                    return;
                }

                const copyLabel = that.localize('duplicate'),
                    copyRegex = new RegExp(`\\s?-\\s?${copyLabel}\\s?(\\(([0-9]+)\\))?$`, 'g'),
                    events = that._events;
                let targetLabel = (target.label + '').replace(copyRegex, ''),
                    copyNumber = 0;

                target = that._cloneObject(target);

                for (let i = 0; i < events.length; i++) {
                    const e = events[i];

                    if (e.label.indexOf(targetLabel) > -1) {
                        copyRegex.lastIndex = 0;

                        if (copyRegex.test(e.label)) {
                            copyRegex.lastIndex = 0;

                            const match = copyRegex.exec(e.label);

                            copyNumber = Math.max(copyNumber, parseInt(match[2]) || 1) + 1;
                        }
                    }
                }

                if (copyNumber > 1) {
                    target.label = `${targetLabel} - ${copyLabel} (${copyNumber})`;
                }
                else {
                    target.label = `${targetLabel} - ${copyLabel}`;
                }

                //Delete the id, because it's not unique any more
                delete target.id;

                //Add the new Copy of the event
                that._events.push(target);

                eventName = 'itemInsert';
                break;
            }
            case 'cut':
                originalEventObj = that._cloneObject(repeatingEvent || target);

                //Remove other resource if Scheduler is grouped by a resource
                if (cellGroup && !that._isEventPartOfGroup(target, cellGroup)) {
                    that.groups.forEach(g => delete target[g]);
                }

                that._updateClipboard();
                eventName = 'itemUpdate';
                break;
        }

        newDateStart = new Date(cellObj.time);

        //Get the dateEnd
        if (isDayOrWeekView && !!target.allDay !== !!cellObj.allDay) {
            newDateEnd = that._getCellDateRange(cellObj).dateEnd;
        }
        else {
            newDateEnd = new Date(newDateStart.getTime() + (target.dateEnd.getTime() - target.dateStart.getTime()));
        }

        if (isDayOrWeekView) {
            //Validate the endDate
            if (cellObj.allDay) {
                newDateStart.setHours(0, 0, 0, 0);

                if (newDateEnd.getHours() !== 0 && newDateEnd.getMinutes() !== 0 && newDateEnd.getSeconds() !== 0) {
                    newDateEnd.setHours(23, 59, 59, 999);
                }
            }

            //Set the allDay property
            target.allDay = !!cellObj.allDay;
        }

        if (!target.allDay) {
            delete target.allDay;
        }

        target.dateStart = newDateStart;
        target.dateEnd = newDateEnd;

        if (cellGroup) {
            //Add the cell groups
            for (let i in cellGroup) {
                target[i] = cellGroup[i];
            }
        }

        that._validateEventDateRange(target);
        that._refreshTimelineEvents();

        if (eventName === 'itemInsert') {
            that._updateUndoRedo(undefined, that._cloneObject(repeatingEvent || target), eventName);
        }
        else {
            that._updateUndoRedo(originalEventObj, that._cloneObject(repeatingEvent || target), eventName);
        }

        const itemCopy = that._cloneObject(repeatingEvent || target);

        that.$.fireEvent(eventName, { item: itemCopy });
        that.$.fireEvent('itemChange', { item: itemCopy });
    }

    /**
     * Handles key down inside the Scheduler
     * @param {Object} event
     */
    _handleKeyNavigation(event) {
        const that = this,
            viewType = that.viewType.toLowerCase(),
            isTimelineView = viewType.indexOf('timeline') > -1,
            tooltip = that.$.tooltip,
            rightToLeft = that.rightToLeft,
            key = event.key;
        let target = that.enableShadowDOM ? event.composedPath()[0] : event.target;

        //If the tooltip is opened, focus it's content
        if (tooltip.visible) {
            const focusableTarget = tooltip.$.content instanceof HTMLElement ? tooltip.$.content.querySelector('[tabindex]') : null;

            if (focusableTarget) {
                focusableTarget.focus({ preventScroll: true });
                target = focusableTarget;
            }
        }

        if (target === that.$.timeline) {
            const timelineContent = that.$.timelineContent,
                allDayCells = that.$.timelineViewAllDay,
                areAllDayCellsVisible = allDayCells.offsetHeight > 0;

            //Select first cell
            if (!that._selectedCellObj) {
                that._handleCellSelection((areAllDayCellsVisible ? allDayCells : timelineContent).querySelector('.smart-scheduler-cell:not(.scale)'));

                if (that._selectedCellObj) {
                    that._scrollTo(that._selectedCellObj.to);
                }
                return;
            }

            const selectedCellObj = that._selectedCellObj[event.shiftKey ? 'to' : 'from'],
                scaleCount = that._getCellsScaleCount(),
                scaleIndex = selectedCellObj.scaleIndex || 0,
                lastScaleCellIndex = scaleCount - 1;
            let [hCellObj, vCellObj, targetScaleIndex] = [selectedCellObj.horizontal, selectedCellObj.vertical, scaleIndex], cells, cellObj,
                isAllDayCell = selectedCellObj.allDay;

            switch (key) {
                case 'Home':
                case 'End': {
                    cells = that._timelineCells[isTimelineView ? 'horizontal' : 'vertical'];
                    [cellObj, targetScaleIndex, isAllDayCell] =
                        key === 'Home' ? [cells[0], 0, !event.shiftKey && areAllDayCellsVisible] : [cells[cells.length - 1], lastScaleCellIndex, false];
                    [hCellObj, vCellObj] = isTimelineView ? [cellObj, vCellObj] : [hCellObj, cellObj];
                    break;
                }
                case 'ArrowUp':
                case 'ArrowDown':
                case 'ArrowLeft':
                case 'ArrowRight': {
                    const isArrowUpDown = ['ArrowUp', 'ArrowDown'].indexOf(key) > -1,
                        offset = rightToLeft && key === 'ArrowRight' || !rightToLeft && key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
                    [cells, cellObj] = isArrowUpDown ? [that._timelineCells.vertical, vCellObj] : [that._timelineCells.horizontal, hCellObj];

                    if (isArrowUpDown && isTimelineView || !isArrowUpDown && !isTimelineView) {
                        cellObj = cells[cells.indexOf(cellObj) + offset];
                    }
                    else {
                        targetScaleIndex += offset;

                        if (targetScaleIndex < 0 || targetScaleIndex > lastScaleCellIndex) {
                            cellObj = cells[cells.indexOf(cellObj) + offset];
                            targetScaleIndex = targetScaleIndex > lastScaleCellIndex ? 0 : lastScaleCellIndex;
                        }
                    }

                    [hCellObj, vCellObj] = isArrowUpDown ? [hCellObj, cellObj] : [cellObj, vCellObj];
                    break;
                }
                case 'PageDown':
                case 'PageUp': {
                    if (isTimelineView || selectedCellObj.allDay) {
                        break;
                    }

                    const pageSize = selectedCellObj.vertical.top + that._scrollViewSize.height * (key === 'PageUp' ? -1 : 1),
                        vCells = that._timelineCells.vertical;

                    vCellObj = that._timelineCells.vertical.find(c => c.top >= pageSize);

                    if (!vCellObj) {
                        vCellObj = key === 'PageUp' ? vCells[0] : vCells[vCells.length - 1];
                    }

                    break;
                }
            }

            if (!event.shiftKey) {
                if (isAllDayCell && key === 'ArrowDown') {
                    vCellObj = that._timelineCells.vertical[0];
                    targetScaleIndex = 0;
                    isAllDayCell = false;
                }
                else if (key === 'ArrowUp' && !vCellObj) {
                    isAllDayCell = areAllDayCellsVisible;
                }
            }

            const targetCell = that._getCellByObj({
                horizontal: hCellObj,
                vertical: vCellObj,
                scaleIndex: targetScaleIndex,
                allDay: isAllDayCell
            });

            if (targetCell) {
                const startCell = that._selectedCellObj.from;

                that._handleCellSelection(viewType !== 'agenda' && event.shiftKey && !!startCell.allDay === !!isAllDayCell ?
                    startCell : targetCell, targetCell);
            }
        }
        else if (target === that.$.viewItemsContainer) {
            //Handle view tab items navigation
            const viewItems = that.$.viewItemsContainer.children,
                selectedItem = Array.from(viewItems).find(i => i.hasAttribute('selected'));
            let nextItem;

            if (!selectedItem || key === 'Home') {
                nextItem = viewItems[0];
            }
            else if (key === 'End') {
                nextItem = viewItems[viewItems.length - 1];
            }
            else if ((that.$.tooltip.contains(target) && (key === 'ArrowUp' || key === 'ArrowDown')) ||
                (that.$.header.contains(target) && (key === 'ArrowLeft' || key === 'ArrowRight'))) {
                nextItem = selectedItem[key === 'ArrowUp' || key === 'ArrowLeft' && !rightToLeft ||
                    key === 'ArrowRight' && rightToLeft ? 'previousElementSibling' : 'nextElementSibling'];
            }

            if (nextItem && selectedItem !== nextItem) {
                that._handleViewSelection(nextItem);
            }
        }
        else if (target === that._list) {
            //Handle view tab items navigation
            const itemList = (that._list.contains(that._eventList) ? that._eventList : that._contextList).children,
                selectedItem = Array.from(itemList).find(i => i.hasAttribute('selected'));
            let nextItem;

            if (!selectedItem || key === 'Home') {
                nextItem = itemList[0];
            }
            else if (key === 'End') {
                nextItem = itemList[itemList.length - 1];
            }
            else if (key === 'ArrowUp' || key === 'ArrowDown') {
                nextItem = selectedItem[key === 'ArrowUp' ? 'previousElementSibling' : 'nextElementSibling'];
            }

            if (nextItem && selectedItem !== nextItem) {
                that._handleEventItemSelection(itemList, nextItem);
            }
        }
    }

    /**
     * Handles Event list keyboard selection
     * @param {*} eventItems
     * @param {*} nextItem
     */
    _handleEventItemSelection(eventItems, nextItem) {
        const that = this;

        if (!that._eventList && !that._contextList) {
            return
        }

        const itemsContainer = (that._list.contains(that._eventList) ? that._eventList : that._contextList);

        if (!itemsContainer) {
            return
        }

        if (!eventItems) {
            eventItems = (that._list.contains(that._eventList) ? that._eventList : that._contextList).children;
        }

        for (let i = 0; i < eventItems.length; i++) {
            const item = eventItems[i];

            if (item === nextItem) {
                item.setAttribute('selected', '');
            }
            else {
                item.removeAttribute('selected');
            }
        }
    }

    /**
     * Returns the Timeline cell that corresponds to the cell object
     * @param {Object} obj - timeline cell object
     */
    _getCellByObj(obj) {
        const that = this;

        if (!obj) {
            return;
        }

        if (!that._scrollTo(obj)) {
            return
        }

        //All day or timeline cell
        const isAllDay = obj.allDay,
            cellsContainer = isAllDay ? that.$.timelineViewAllDay : that.$.timelineCellsContainer,
            timelineCells = Array.from(cellsContainer.querySelectorAll('.smart-scheduler-cell:not(.scale)'));

        //Remove the vertical obj All day cells, because they dont use it
        if (isAllDay) {
            delete obj.vertical;
        }

        const objProps = Object.keys(obj);

        return timelineCells.find(cell => objProps.every(p => obj[p] === cell.$.cellObj[p] || cell.$.cellObj[p] === undefined))
    }

    /**
     * Scrolls to a target Date or to a timeline cell based on it's object
     * @param {Object} targetDate - a date to scroll to or a timeline cell object
     * @param {Boolean} strictScroll - determines whether to scroll stricty to the target date and time or not. By default
     * if the date is visible scrolling is not necessary. Setting this flag to true will scroll to it anyway
     * @param {Boolean} autoScroll - after scrolling, adds an offset to scroll within the middle of the view.
     */
    _scrollTo(targetDate, strictScroll, autoScroll) {
        const that = this,
            scaleCount = that._getCellsScaleCount(),
            viewType = that.viewType.toLowerCase(),
            isTimelineView = viewType.indexOf('timeline') > -1;
        let hCell, vCell, scaleIndex, isAllDay;

        if (targetDate instanceof HTMLElement && targetDate.classList.contains('smart-scheduler-event') ||
            that._events && that._events.indexOf(targetDate) > -1) {
            const cellObj = that._scrollToEvent(targetDate);

            if (!cellObj) {
                return
            }

            [hCell, vCell, scaleIndex, isAllDay] = [cellObj.hCell, cellObj.vCell, cellObj.scaleIndex, cellObj.allDay];
        }
        else if (targetDate instanceof Date) {
            let cellObj = that._getCellObjByDate(targetDate);

            if (!cellObj) {
                that.navigateToDate(targetDate);
                cellObj = that._getCellObjByDate(targetDate);

                if (!cellObj) {
                    return;
                }
            }

            [hCell, vCell, scaleIndex, isAllDay] = [cellObj.hCell, cellObj.vCell, cellObj.scaleIndex, cellObj.allDay];
        }
        else {
            if (targetDate instanceof HTMLElement && targetDate.$) {
                targetDate = targetDate.$.cellObj;
            }

            if (!targetDate) {
                return;
            }

            hCell = targetDate.horizontal || targetDate;
            vCell = targetDate.vertical || targetDate;
            scaleIndex = targetDate.scaleIndex || 0;
            isAllDay = targetDate.allDay;
        }

        let scrollName, cellSize, size, cellOffset;
        const setScroll = () => {
            const scroll = that[scrollName];

            if (strictScroll || scroll > cellOffset) {
                that[scrollName] = cellOffset;

                if (!that.isCompleted) {
                    that.$.timelineContainer[scrollName] = that[scrollName];
                    that._recycle();
                }
            }
            else if (scroll + size < cellOffset + cellSize) {
                that[scrollName] = Math.max(0, cellOffset + cellSize - size);

                if (!that.isCompleted) {
                    that.$.timelineContainer[scrollName] = that[scrollName];
                    that._recycle();
                }
            }
        }

        if (hCell) {
            let hCellWidth = hCell.width ? hCell.width : (hCell.first ? hCell.first.height : 0);
            let hCellLeft = hCell.left ? hCell.left : 0;

            [scrollName, cellSize, size] = ['scrollLeft', hCellWidth / (isTimelineView ? scaleCount : 1), that._scrollViewSize.width];
            cellOffset = hCellLeft + cellSize * (isTimelineView ? scaleIndex : 0);
            setScroll();
        }

        if (vCell && !isAllDay) {
            let vCellHeight = vCell.height ? vCell.height : (vCell.first ? vCell.first.height : 0);
            let vCellTop = vCell.top !== undefined ? vCell.top : (vCell.first ? vCell.first.top : 0);

            [scrollName, cellSize, size] = ['scrollTop', vCellHeight / (!isTimelineView ? scaleCount : 1), that._scrollViewSize.height];
            cellOffset = vCellTop + cellSize * (!isTimelineView ? scaleIndex : 0);

            if (autoScroll) {
                if (strictScroll) {
                    cellOffset = Math.max(0, cellOffset + cellSize - size);
                }

                cellOffset += ((that._scrollViewSize.height - cellSize) / 2);
            }
            setScroll();
        }

        return true
    }

    /**
     * Scrolls to an event cell
     * @param {Object | HTMLElement} schedulerEvent - eventObj or a event cell
     */
    _scrollToEvent(eventObj) {
        const that = this;

        if (!eventObj) {
            return
        }

        if (eventObj instanceof HTMLElement && eventObj.classList.contains('smart-scheduler-event') && !that.$.timeline.contains(eventObj)) {
            eventObj = eventObj.$ ? eventObj.$.event : undefined;
        }

        const events = that._events;

        if (!eventObj || !events || events.indexOf(eventObj) < 0) {
            return
        }

        const eventHCellObj = that._getEventHorizontallCellObjs(eventObj),
            eventVCellObj = that._getEventVerticalCellObjs(eventObj),
            eventHCellStart = eventHCellObj.start || eventHCellObj.first,
            eventVCellStart = eventVCellObj.start || eventVCellObj.first;
        let eventStartScale = 0;

        if (!eventObj.allDay) {
            eventStartScale = that._getEventScaleIndex(eventObj, that.viewType.indexOf('timeline') > -1 ? eventHCellStart : eventVCellStart).start;
        }

        return { hCell: eventHCellStart, vCell: eventVCellObj, scaleIndex: eventStartScale, allDay: eventObj.allDay }
    }

    /**
     * Returns the horizontal,vertical cells and scaleIndex that correspond to the target Date
     * @param {Date} targetDate - a Date
     */
    _getCellObjByDate(targetDate) {
        if (!(targetDate instanceof Date) || !targetDate || isNaN(targetDate.getTime())) {
            return;
        }

        const that = this,
            viewType = that.viewType.toLowerCase(),
            hCells = that._timelineCells.horizontal,
            vCells = that._timelineCells.vertical,
            isMonthView = viewType.indexOf('month') > -1;
        let hCell, vCell, weekStart,
            [year, month, date, hours, day] =
                [targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), targetDate.getHours(), targetDate.getDay()];

        //Basic view
        if (viewType === 'agenda') {
            vCell = vCells.find(c => {
                const cellDate = c.date;
                return cellDate.getFullYear() === year && cellDate.getMonth() === month && cellDate.getDate() === date
            });

            if (!vCell) {
                return;
            }
        }
        else if (viewType.indexOf('timeline') < 0) {
            hCell = hCells.find(c => {
                const cellDate = c.date;
                return (isMonthView && cellDate.getDay() === day) ||
                    (cellDate.getFullYear() === year && cellDate.getMonth() === month && cellDate.getDate() === date)
            });

            if (isMonthView) {
                weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - weekStart.getDay() + that.firstDayOfWeek);
                [year, month, date, hours, day] =
                    [weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), weekStart.getHours(), weekStart.getDay()];
            }

            vCell = vCells.find(c => {
                const cellDate = c.date;
                return !isMonthView ? cellDate.getHours() === hours :
                    cellDate.getFullYear() === year && cellDate.getMonth() === month && cellDate.getDate() === date && cellDate.getHours() === hours;
            });

            if (!hCell || !vCell) {
                return;
            }
        }
        else {
            hCell = hCells.find(c => {
                const cellDate = c.date;
                return cellDate.getFullYear() === year && cellDate.getMonth() === month && cellDate.getDate() === date &&
                    (isMonthView || cellDate.getHours() === hours)
            });

            if (!hCell) {
                return;
            }
        }

        return { hCell: hCell, vCell: vCell, scaleIndex: Math.floor((targetDate.getMinutes() / 60) * that._getCellsScaleCount()) }
    }


    _mouseWheelNative(value, horizontal) {
        const that = this;

        if (that._scrollWheelContent === undefined) {
            that._scrollWheelContent = document.createElement('div');
            that._scrollWheelContent.style.width = '100%';
            that._scrollWheelContent.style.height = '100%';
            that._scrollWheelContent.style.position = 'absolute';
            that._scrollWheelContent.style.left = '0px';
            that._scrollWheelContent.style.top = '0px';
            that._scrollWheelContent.style.background = 'white';
            that._scrollWheelContent.style.zIndex = 9999;
            that._scrollWheelContent.style.opacity = 0;
            that._scrollWheelContent.style.overflow = 'auto';
            that._scrollWheelContent.style.visibility = 'hidden';
        }
        let rafId = 0;
        const autoScroll = () => {
            if (!horizontal) {
                const y = that._scrollWheelContent.scrollTop;
                that._scrollView.vScrollBar.value = y;
                if (y === value) {
                    that._scrollWheelContent.remove();
                }
            }
            else {
                const x = that._scrollWheelContent.scrollLeft;
                that._scrollView.hScrollBar.value = x;
                if (x === value) {
                    that._scrollWheelContent.remove();
                }
            }
        }

        that._scrollWheelContent.onscroll = () => {
            cancelAnimationFrame(rafId);
            rafId = 0;
            rafId = requestAnimationFrame(autoScroll);
        }

        if (!that._scrollWheelContentView) {
            that._scrollWheelContentView = document.createElement('div');
            that._scrollWheelContent.appendChild(that._scrollWheelContentView);
        }
        that._scrollWheelContentView.style.width = that.offsetWidth + that._scrollView.scrollWidth + 'px';
        that._scrollWheelContentView.style.height = that.offsetHeight + that._scrollView.scrollHeight + 'px';
        that.$.viewContent.appendChild(that._scrollWheelContent);
        that._scrollWheelContent.scrollTop = that._scrollView.vScrollBar.value;
        that._scrollWheelContent.scrollLeft = that._scrollView.hScrollBar.value;

        if (horizontal === true) {
            that._scrollWheelContent.scrollTo({
                top: that._scrollView.vScrollBar.value,
                left: value,
                behavior: 'smooth'
            });
        }
        else {
            that._scrollWheelContent.scrollTo({
                top: value,
                left: that._scrollView.hScrollBar.value,
                behavior: 'smooth'
            });
        }
    }
    /**
    * Container mousewheel event handler.
    */
    _mouseWheelHandler(event) {
        const that = this;
        const target = event.target;

        if (that.$.viewSelectorContainer.contains(target)) {
            that._handleViewNavigation(event);
            return;
        }

        if (that.disabled || target.closest('.smart-scheduler-window-modal')) {
            return;
        }

        if (that._scrollView.hScrollBar.$.hasClass('smart-hidden') && that._scrollView.vScrollBar.$.hasClass('smart-hidden')) {
            return;
        }

        if (event.pointerId === 42) {
            return;
        }

        let isTrackpad = false;
        if (event.wheelDeltaY) {
            if (Math.abs(event.wheelDeltaY) !== 120 && Math.abs(event.wheelDeltaY) !== 240 && Math.abs(event.wheelDeltaY) !== 360) {
                isTrackpad = true;
            }
        }
        else if (event.deltaMode === 0) {
            isTrackpad = true;
        }

        if (!that.disabled && !that._scrollView.vScrollBar.$.hasClass('smart-hidden') && !event.shiftKey && event.deltaY) {
            const scrollTop = that.scrollTop;

            if (scrollTop === 0 && event.deltaY < 0 ||
                scrollTop === that.scrollHeight && event.deltaY > 0) {
                return;
            }

            if (event.target && event.target.offsetParent && event.target.offsetParent.classList.contains('smart-scheduler-list-container')) {
                return;
            }

            event.stopPropagation();
            event.preventDefault();

            let verticalOffset = 15 * 30;

            if (event.deltaY <= 0) {
                verticalOffset = -15 * 30;
            }


            if (Math.abs(event.deltaY) >= 100 && !isTrackpad && !Smart.Utilities.Core.Browser.Firefox) {
                that._mouseWheelNative(that._scrollView.scrollTop + verticalOffset);
            }
            else {
                that._wheelrafId = 0;
                const autoScroll = () => {
                    that._scrollView.scrollTop += event.deltaY;
                }
                cancelAnimationFrame(that._wheelrafId);
                that._wheelrafId = 0;
                that._wheelrafId = requestAnimationFrame(autoScroll);
            }
        }
        else if (!that.disabled && (!that._scrollView.hScrollBar.$.hasClass('smart-hidden') || event.shiftKey)) {
            event.stopPropagation();
            event.preventDefault();
            let horizontalOffset = 160;
            const delta = event.deltaX === 0 ? event.wheelDelta : event.deltaX;

            if (delta < 0) {
                horizontalOffset = -160;
            }


            if (Math.abs(delta) >= 100 && !isTrackpad && !Smart.Utilities.Core.Browser.Firefox) {
                that._mouseWheelNative(that._scrollView.scrollLeft + horizontalOffset, true);
            }
            else {
                that._scrollView.scrollLeft += delta;
            }
        }
    }

    /**
     * Handles Timeline cell selection
     * @param {HTMLElement | undefined} cell
     */
    _handleCellSelection(from, to) {
        const that = this,
            currentSelectedCellObj = that._dragDetails ? that._dragDetails.selectedCellObj : that._selectedCellObj;
        let currentFromCellObj, currentToCellObj, newFromCellObj, newToCellObj;

        if (currentSelectedCellObj) {
            currentFromCellObj = currentSelectedCellObj.from;
            currentToCellObj = currentSelectedCellObj.to;
        }

        if (that.disableSelection) {
            that._selectCell();
        }
        else {
            that._selectCell(from, to);
        }

        if (that._selectedCellObj) {
            newFromCellObj = that._selectedCellObj.from;
            newToCellObj = that._selectedCellObj.to;
        }

        //Fire change event
        const eventDetails = { dateStart: undefined, dateEnd: undefined, group: undefined };
        let fromDate, toDate, newFromDate, newToDate, group, newGroup;

        if (currentFromCellObj) {
            fromDate = new Date(currentFromCellObj.time);
            toDate = new Date(currentToCellObj.time);
            group = currentFromCellObj.horizontal.group || currentFromCellObj.vertical.group;
        }

        if (newFromCellObj) {
            newFromDate = new Date(newFromCellObj.time);
            newGroup = newFromCellObj.horizontal.group || newFromCellObj.vertical.group;
            eventDetails.dateStart = newFromDate;
            eventDetails.group = newGroup;

            newToDate = new Date(newToCellObj.time);
            eventDetails.dateEnd = newToDate;
        }

        if (currentFromCellObj && !newFromCellObj || !currentFromCellObj && newFromCellObj || (fromDate &&
            (fromDate.getTime() !== newFromDate.getTime() || toDate.getTime() !== newToDate.getTime() || group !== newGroup))) {
            that.$.fireEvent('change', eventDetails);
        }
    }

    /**
     * Selects a range of timeline cells
     * @param {HTMLElement | Object} from - starting timeline cell / timeline cell object
     * @param {HTMLElement | Object} to - ending timeline cell / timeline cell object
     */
    _selectCell(from, to) {
        const that = this;

        function unselectCell() {
            const cells = that.$.timeline.querySelectorAll('.smart-scheduler-cell[selected]');

            for (let i = 0; i < cells.length; i++) {
                cells[i].removeAttribute('selected');
            }

            delete that._selectedCellObj;
        }

        if (!to) {
            to = from;
        }

        if (!from || that.viewType === 'agenda') {
            unselectCell();
            return
        }

        let fromCellObj = from, toCellObj = to;

        if (from.closest) {
            const fromCell = from.closest('.smart-scheduler-cell:not(.scale)');

            if (!fromCell || !that.$.timeline.contains(fromCell)) {
                return;
            }

            fromCellObj = fromCell.$ ? fromCell.$.cellObj : undefined;
        }

        if (to.closest) {
            const toCell = to.closest('.smart-scheduler-cell:not(.scale)');

            if (!toCell || !that.$.timeline.contains(toCell)) {
                return
            }

            toCellObj = toCell.$ ? toCell.$.cellObj : undefined;
        }

        if (!fromCellObj || !toCellObj || that._isMobile && Object.keys(fromCellObj).some(k => fromCellObj[k] !== toCellObj[k]) ||
            fromCellObj.time === undefined || toCellObj.time === undefined) {
            return
        }

        //find the All day cell
        if (fromCellObj.allDay && !toCellObj.allDay) {
            const allDayCells = that.$.timelineViewAllDayCellsContainer.children;

            for (let i = 0; i < allDayCells.length; i++) {
                const allDayCell = allDayCells[i];

                if (!allDayCell.$) {
                    continue
                }

                const cellObj = allDayCell.$.cellObj;

                if (cellObj.horizontal === toCellObj.horizontal) {
                    toCellObj = cellObj;
                    break;
                }
            }
        }

        if (fromCellObj.allDay !== toCellObj.allDay) {
            return
        }

        //Unselect all
        const view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            groupOrientation = viewDetails && viewDetails.groupOrientation ? viewDetails.groupOrientation : that.groupOrientation,
            fromGroup = (fromCellObj[groupOrientation] || fromCellObj).group,
            toGroup = (toCellObj[groupOrientation] || toCellObj).group;

        if (fromGroup !== toGroup) {
            return;
        }

        unselectCell();

        let [fromTime, toTime] = [fromCellObj.time, toCellObj.time], cell;

        if (that.viewType === 'agenda' && fromTime !== toTime) {
            return
        }

        let selectedCellObj = {};

        if (fromTime > toTime) {
            const temp = fromTime;

            fromTime = toTime;
            toTime = temp;
        }

        selectedCellObj.from = Object.assign({}, fromCellObj);
        selectedCellObj.to = Object.assign({}, toCellObj);

        that._selectedCellObj = selectedCellObj;

        const fromCellContainer = fromCellObj.allDay ? that.$.timelineViewAllDay : that.$.timelineContent,
            cells = fromCellContainer.querySelectorAll('.smart-scheduler-cell:not(.scale)');

        for (let i = 0; i < cells.length; i++) {
            cell = cells[i];

            cell.removeAttribute('selected');

            if (!cell.$) {
                continue
            }

            const cObject = cell.$.cellObj;

            if ((cObject[groupOrientation] || cObject).group !== fromGroup) {
                continue
            }

            const time = cObject.time,
                cellProps = Object.keys(cObject);

            if (time >= fromTime && time <= toTime) {
                cell.setAttribute('selected', fromCellObj === toCellObj || cellProps.every(p => cObject[p] === fromCellObj[p]) ? 'start' : '');
            }
        }

        that._scrollTo(toCellObj);
    }

    /**
     * Returns a boolean whether a cellObj is selected or not
     * @param {*} cellObj - the target cell object
     */
    _isCellObjSelected(cellObj) {
        const that = this,
            selectedCellObj = that._selectedCellObj;

        if (!selectedCellObj || !cellObj) {
            return
        }

        const fromCellObj = selectedCellObj.from,
            toCellObj = selectedCellObj.to,
            view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            groupOrientation = viewDetails && viewDetails.groupOrientation ? viewDetails.groupOrientation : that.groupOrientation,
            fromGroup = (fromCellObj[groupOrientation] || fromCellObj).group,
            cellObjGroup = (cellObj[groupOrientation] || cellObj).group;

        if (fromGroup !== cellObjGroup) {
            return;
        }

        const fromTime = Math.min(fromCellObj.time, toCellObj.time),
            toTime = Math.max(fromCellObj.time, toCellObj.time),
            cellTime = cellObj.time;

        if (cellTime >= fromTime && cellTime <= toTime) {
            return true
        }
    }

    /**
     * Returns the date accordiong to the cell or cellObj
     * @param {Object | HTMLElement} cell
     */
    _getCellTime(cell) {
        if (!cell) {
            return 0
        }

        const that = this,
            viewType = that.viewType;
        let cellObj;

        if (cell instanceof HTMLElement && cell.closest('.smart-scheduler-cell:not(.scale)')) {
            if (!cell.$ || !cell.$.cellObj) {
                return 0
            }

            cellObj = cell.$.cellObj;
        }
        else {
            cellObj = cell;
        }

        if (viewType === 'agenda') {
            return cellObj.vertical.date.getTime();
        }

        let date;

        if (viewType === 'month') {
            date = new Date(cellObj.vertical.date);

            const dayOfWeek = new Date(cellObj.horizontal.date).getDay() - that.firstDayOfWeek;

            date.setDate(date.getDate() + (dayOfWeek < 0 ? (7 + dayOfWeek) : dayOfWeek));

            return date.getTime()
        }

        const scaleIndex = cellObj.scaleIndex || 0,
            scaleTime = (60 / that._getCellsScaleCount()) * 60 * 1000;

        if (viewType.indexOf('timeline') < 0) {
            date = new Date(cellObj.horizontal.date);

            if (!cellObj.allDay) {
                date.setHours(cellObj.vertical.date.getHours());
            }
        }
        else {
            date = new Date(cellObj.horizontal.date);
        }

        return date.getTime() + scaleTime * scaleIndex
    }

    /**
    * Handles mouse wheel vertical scrolling inside the Timeline
    */
    _handleVerticalScroll(event) {
        const that = this;

        if (!that.computedVerticalScrollBarVisibility) {
            return true;
        }

        const scrollTop = that.scrollTop;

        if (scrollTop === 0 && event.deltaY < 0 ||
            scrollTop === that.scrollHeight && event.deltaY > 0) {
            event.stopPropagation();
            return;
        }

        event.preventDefault();

        let isTrackpad = false;
        if (event.wheelDeltaY) {
            if (Math.abs(event.wheelDeltaY) !== 120 && Math.abs(event.wheelDeltaY) !== 240 && Math.abs(event.wheelDeltaY) !== 360) {
                isTrackpad = true;
            }
        }
        else if (event.deltaMode === 0) {
            isTrackpad = true;
        }

        if (that.mouseWheelStep > 0 && !isTrackpad) {
            that.scrollTop = scrollTop + (event.deltaY < 0 ? -that.mouseWheelStep : that.mouseWheelStep);
        }
        else {
            that._wheelrafId = 0;
            const autoScroll = () => {
                that._scrollView.scrollTop += event.deltaY;
            }
            cancelAnimationFrame(that._wheelrafId);
            that._wheelrafId = 0;
            that._wheelrafId = requestAnimationFrame(autoScroll);
        }
    }

    /**
     * Handles mouse wheel horizontal scrolling inside the Timeline
     */
    _handleHorizontalScroll(event) {
        const that = this;

        if (!that.computedHorizontalScrollBarVisibility) {
            return true;
        }

        const scrollLeft = that.scrollLeft;
        const delta = event.deltaX === 0 ? event.wheelDelta : event.deltaX;

        if (scrollLeft === 0 && delta < 0 ||
            scrollLeft === that.scrollWidth && delta > 0) {
            event.stopPropagation();
            return
        }

        event.preventDefault();


        let isTrackpad = false;
        if (event.wheelDeltaY) {
            if (Math.abs(event.wheelDeltaY) !== 120 && Math.abs(event.wheelDeltaY) !== 240 && Math.abs(event.wheelDeltaY) !== 360) {
                isTrackpad = true;
            }
        }
        else if (event.deltaMode === 0) {
            isTrackpad = true;
        }

        if (that.mouseWheelStep > 0 && !isTrackpad) {
            that._scrollView.scrollLeft += that.mouseWheelStep;
        }
        else {
            that._scrollView.scrollLeft += delta;
        }
    }

    _horizontalScrollbarHandler(event) {
        const that = this;

        if (that._hscrollTimer) {
            clearTimeout(that._hscrollTimer);
        }

        that.$.timelineContainer.scrollLeft = that._getScrollLeft(event.detail.value);

        if (that.dataSource && that.dataSource.length > 100) {
            that._recycle(event, false);

            that._hscrollTimer = setTimeout(() => {
                that._recycle(event);
            }, 25);
        }
        else {
            that._recycle(event);
        }
    }

    _verticalScrollbarHandler(event) {
        const that = this;

        if (that._scrollTimer) {
            clearTimeout(that._scrollTimer);
        }

        that.$.timelineContainer.scrollTop = Math.round(event.detail.value);

        if (that.dataSource && that.dataSource.length > 100) {
            that._recycle(event, false);

            that._scrollTimer = setTimeout(() => {
                that._recycle(event);
            }, 25);
        }
        else {
            that._recycle(event);
        }
    }

    /**
     * Recycles the timeline header cells and updates them with fresh data
     */
    _recycle(event, recycleEvents) {
        const that = this,
            timelineCellsObjs = that._timelineCells,
            tooltip = that.$.tooltip;

        //The element is not initialized yet
        if (!timelineCellsObjs.vertical || !timelineCellsObjs.horizontal) {
            return
        }

        if (tooltip.visible && that.$.timeline.contains(tooltip.selector)) {
            tooltip.close();
        }

        //recycle the header
        if (!event) {
            //Refresh the timeline cells
            that._recycleHeaderCells(that.$.timelineHeaderHorizontalContent);
            that._recycleHeaderCells(that.$.timelineHeaderVerticalContent);
            that._refreshTimelineContentCells();
            that._refreshTimelineAllDayCells();
            if (recycleEvents !== false) {
                that._refreshEvents();
            }
            return;
        }

        if (event.context.orientation === 'horizontal') {
            that._recycleHeaderCells(that.$.timelineHeaderHorizontalContent);
            that._refreshTimelineContentCells();
            that._refreshTimelineAllDayCells();
            if (recycleEvents !== false) {
                that._refreshEvents();
            }
            return;
        }

        that._recycleHeaderCells(that.$.timelineHeaderVerticalContent);
        that._refreshTimelineContentCells();

        if (recycleEvents !== false) {
            that._refreshEvents();
        }

        that._disableGroupCellsFromFilter();
    }

    /**
      * Updates the content of the timeline cells and header during scrolling
      * @param {any} event
      * @param {any} container
      */
    _recycleHeaderCells(container) {
        const that = this,
            rightToLeft = that.rightToLeft,
            [orientation, position, size, scroll] = container === that.$.timelineHeaderHorizontalContent ?
                ['horizontal', 'left', 'width', 'scrollLeft'] : ['vertical', 'top', 'height', 'scrollTop'],
            content = container.querySelector('.smart-scheduler-view-time'),
            timelineCells = that._timelineCells[orientation];

        if (!timelineCells || !timelineCells.length) {
            return;
        }

        const firstCellObj = that._getFirstCellObjInView(orientation),
            cellsNeeded = that._getTimelineVisibleCellsCount(orientation),
            headerViews = content.children;

        //Handle Header views(Timezones)
        for (let i = 0; i < headerViews.length; i++) {
            const headerView = headerViews[i],
                viewCells = headerView.children;

            let fragment = document.createDocumentFragment();

            while (viewCells.length) {
                fragment.appendChild(headerView.firstElementChild);
            }

            //Generate additional cells if needed
            that._recycleContainerCells({ fragment: fragment, cellsNeeded: cellsNeeded });

            let cellIndex = timelineCells.indexOf(firstCellObj);

            for (let c = 0; c < fragment.children.length; c++) {
                const fragmentCell = fragment.children[c],
                    timelineCell = timelineCells[cellIndex];

                fragmentCell.$ = { cellObj: timelineCell };

                if (!timelineCell) {
                    break;
                }

                if (orientation === 'horizontal') {
                    if (rightToLeft) {
                        fragmentCell.style.left = '';
                        fragmentCell.style.right = timelineCell.left + 'px';
                    }
                    else {
                        fragmentCell.style.right = '';
                        fragmentCell.style.left = timelineCell.left + 'px';
                    }
                }
                else {
                    fragmentCell.style[position] = timelineCell[position] + 'px';
                }

                fragmentCell.style[size] = timelineCell[size] + 'px';
                fragmentCell.innerHTML = `<div>${timelineCell.noLabel ? '' :
                    that._getDateString({ date: new Date(timelineCell.date), timeZone: headerViews[i].timeZone }, orientation)}</div>`;
                timelineCell.weekend ? fragmentCell.setAttribute('weekend', '') : fragmentCell.removeAttribute('weekend');
                timelineCell.nonworking ? fragmentCell.setAttribute('nonworking', '') : fragmentCell.removeAttribute('nonworking');
                timelineCell.separator ? fragmentCell.setAttribute('separator', '') : fragmentCell.removeAttribute('separator');
                timelineCell.groupSeparator ? fragmentCell.setAttribute('group-separator', '') : fragmentCell.removeAttribute('group-separator');
                timelineCell.showLabel ? fragmentCell.setAttribute('show-label', timelineCell.showLabel) : fragmentCell.removeAttribute('show-label');
                timelineCell.restricted ? fragmentCell.setAttribute('restricted', '') : fragmentCell.removeAttribute('restricted');

                cellIndex++;
            }

            headerView.appendChild(fragment);
        }

        //Recycles the header Detail/Group cells
        that._refreshHeaderDetailCells(orientation);
        that._refreshHeaderGroupCells(orientation);

        //Scroll the container
        container[scroll] = scroll === 'scrollLeft' ? that._getScrollLeft(that[scroll]) : that[scroll];
    }

    _moveHandler(event) {
        const that = this;

        if (!that._isMobile) {
            event.stopPropagation();
        }

        if (that.hasAttribute('dragged') || that.hasAttribute('resized')) {
            if (event.originalEvent.type === 'touchmove') {
                event.originalEvent.preventDefault();
            }
        }
    }

    /**
     * * Returns the scrollLeft of the itemsContainer
     * */
    _getScrollLeft(scrollLeft) {
        const that = this;

        if (!that.rightToLeft) {
            return scrollLeft;
        }

        //Note: Chrome has a bug with direction: rtl. Doesn't inverse the scrollLeft
        //see: https://bugs.chromium.org/p/chromium/issues/detail?id=721759
        // if (Smart.Utilities.Core.Browser.Chrome) {
        //     if (!scrollWidth) {
        //         scrollWidth = that.scrollWidth;
        //     }

        //     scrollLeft = scrollWidth - scrollLeft;
        // }
        // else {
        scrollLeft *= -1;
        // }

        return scrollLeft;
    }

    /**
     * Timeline header click handler
     * @param {Event} event
     */
    _containerClickHandler(event) {
        const that = this;

        if (that.readonly || that.hasAttribute('modal')) {
            return
        }

        const tooltip = that.$.tooltip;
        let target = (event || event.originalEvent).target;

        //Handles Header Date selection
        if (that.$.dateSelectorContainer.contains(target)) {
            const navItem = target.closest('.smart-scheduler-nav');

            if (navItem && navItem.hasAttribute('current') && that.disableDateMenu) {
                tooltip.close();
                return
            }

            that._handleDateSelection(navItem)
            return;
        }

        if (tooltip.contains(target)) {
            return;
        }

        //Toggle ViewItems menu
        if (target.closest('.smart-scheduler-view-items-button')) {
            if (that.disableViewMenu) {
                tooltip.close();
                return
            }

            const noToggle = tooltip.visible && !tooltip.contains(that.$.viewItemsContainer);

            that._handleTooltipContent(that.$.viewItemsButton);

            if (!noToggle) {
                tooltip.toggle();
            }

            return;
        }

        //Handles Legend item click
        if (target.classList.contains('smart-scheduler-legend-res-item')) {
            that._handleLegendItemClick(target);
            return
        }

        if (that._isMobile) {
            that.$.timelineContent.classList.add('hide-overlay');
            target = (that.shadowRoot || document).elementFromPoint(event.pageX - window.pageXOffset, event.pageY - window.pageYOffset);
            that.$.timelineContent.classList.remove('hide-overlay');
        }

        //Handled in the documentUp handler
        if (target.closest('.smart-scheduler-event')) {
            return
        }

        tooltip.close();

        //Handle View Item selection [selected] attr
        if (that.$.viewSelectorContainer.contains(target)) {
            const viewButton = target.closest('.smart-scheduler-nav');

            if (viewButton) {
                that._handleViewNavigation(viewButton);
                return;
            }

            const viewItem = target.closest('.smart-scheduler-item');

            if (viewItem === that.$.showWeekendItem) {
                that._checkHideWekendItem(viewItem);
            }
            else {
                that._handleViewSelection(viewItem);
            }

            return;
        }
    }

    _disableGroupCellsFromFilter() {
        const that = this;

        if (that.resources && that.resources.length && that.groups && that.groups.length) {
            that.querySelectorAll('.smart-scheduler-cell').forEach((cell) => {
                cell.classList.remove('smart-disabled');
            });

            if (that.filter && that.resources) {
                for (let i = 0; i < that.resources.length; i++) {
                    const resource = that.resources[i];
                    if (that.groups.indexOf(resource.value) >= 0) {
                        const filter = that.filter.find(item => item.name === resource.value);
                        if (filter) {
                            for (let j = 0; j < resource.dataSource.length; j++) {
                                const resourceItem = resource.dataSource[j];

                                if (!filter.value(resourceItem.id)) {
                                    that.querySelectorAll('[group-value="' + resourceItem.id + '"]').forEach((cell) => {
                                        cell.classList.add('smart-disabled');
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    /**
     * Handles clicking on Legend items
     * @param {HTMLElement} eventTarget - the legend item element that was clicked
     */
    _handleLegendItemClick(target) {
        const that = this,
            legend = that._legend;

        if (!that.filterable || !legend) {
            return
        }

        if (target.hasAttribute('unselected')) {
            target.removeAttribute('unselected');
            target.setAttribute('aria-selected', true);
        }
        else {
            target.setAttribute('unselected', '');
            target.setAttribute('aria-selected', false);
        }

        const unselectedItems = legend.querySelectorAll('.smart-scheduler-legend-res-item[unselected]');
        let newFilter = [], resourceDetails = {};

        for (let i = 0; i < unselectedItems.length; i++) {
            const item = unselectedItems[i],
                resourceValue = item.getAttribute('resource'),
                resourceId = item.getAttribute('resource-id');


            if (!resourceDetails[resourceValue]) {
                resourceDetails[resourceValue] = [];
            }

            resourceDetails[resourceValue].push(resourceId + '');
        }

        for (let resValue in resourceDetails) {
            newFilter.push({ name: resValue, value: (resId) => !resourceDetails[resValue].includes(resId + '') })
        }

        //NOTE: Resetting the value is required becase Smartelement will not apply the new value
        that.set('filter', null); //First we reset the property

        if (newFilter.length) {
            that.set('filter', newFilter); //Set to the new value
        }


        that._disableGroupCellsFromFilter();
        that._refreshTimelineEvents();
    }

    /**
     * Container ContextMenu Event Handler
     * @param {*} event
     */
    _containerContextMenuHandler(event) {
        const that = this;
        let target = event.target;

        if (that.disableContextMenu) {
            return
        }

        const pageX = event.pageX - window.pageXOffset,
            pageY = event.pageY - window.pageYOffset;

        if (that._isMobile) {
            that.$.timelineContent.classList.add('hide-overlay');
            target = (that.shadowRoot || document).elementFromPoint(pageX, pageY);
            that.$.timelineContent.classList.remove('hide-overlay');
        }

        if (that.$.timelineContent.contains(target) || that.$.timelineViewAllDayContent.contains(target)) {
            event.preventDefault();
            target = target.closest('.smart-scheduler-event') || target.closest('.smart-scheduler-cell');

            if (!target || that.disableContextMenu) {
                return
            }

            if (target.classList.contains('smart-scheduler-event')) {
                that._handleCellSelection();
            }

            that._handleTooltipContent(target, { x: event.pageX, y: event.pageY });
        }
        else {
            that.$.tooltip.close();
        }
    }

    /**
     * Handles View Items Container scrolling when viewSelectorType = 'tabs'
     * @param {Object | HTMLElement} button
     */
    _handleViewNavigation(event) {
        const that = this;
        let scroll;

        if (!event) {
            return;
        }

        const scrollTarget = that.$.viewItemsContainer;

        if (event instanceof Smart.RepeatButton) {
            scroll = 10 * (event.hasAttribute('prev') ? -1 : 1);
        }
        else {
            scroll = event.deltaY;
        }

        scrollTarget.scrollLeft += that._getScrollLeft(scroll);

        const viewButtons = that._viewButtons;

        if (!viewButtons) {
            return;
        }

        scroll = scrollTarget.scrollLeft;

        const prevButton = viewButtons.prev,
            nextButton = viewButtons.next;

        //NOTE: Bug with RTL. ScrollWidth can become +/- 1px
        prevButton.disabled = !scroll;
        nextButton.disabled = scrollTarget.offsetWidth + Math.abs(scroll) === scrollTarget.scrollWidth;
    }

    /**
     * Handles Header Date Selection
     * @param {HTMLElement} dateItem
     */
    _handleDateSelection(dateItem) {
        const that = this,
            tooltip = that.$.tooltip;

        if (dateItem instanceof HTMLElement) {
            if (dateItem.hasAttribute('prev')) {
                //Change to preivous date
                tooltip.close();
                that._navigateDate(-1);
            }
            else if (dateItem.hasAttribute('current')) {
                //Open Calendar popup to select date
                const noToggle = tooltip.visible && !tooltip.contains(that._calendar);

                that._handleTooltipContent(that.$.currentDate);

                if (!noToggle) {
                    tooltip.toggle();
                }
            }
            else if (dateItem.hasAttribute('next')) {
                //Change to next date
                tooltip.close();
                that._navigateDate(1);
            }
            else if (dateItem.hasAttribute('today')) {
                tooltip.close();
                that._navigateDate();
            }
        }
    }

    navigateToDate(date) {
        const that = this;

        if (date instanceof Date) {
            date = new Date(date);
        }
        else if (date instanceof HTMLElement && (!date.classList.contains('smart-scheduler-cell') || !that.$.timeline.contains(date))) {
            return
        }
        else if (typeof date === 'object') {
            const currentDate = new Date(that.dateCurrent);

            date.year = date.year !== undefined ? date.year : currentDate.getFullYear();
            date.month = date.month !== undefined ? date.month : currentDate.getMonth();
            date.date = date.date !== undefined ? date.date : currentDate.getDate();

            date = new Date(date.year, date.month, date.date, date.hours, date.getMinutes);
        }
        else if (typeof date === 'string') {
            if (date.indexOf('Date') >= 0) {
                date = date.replace('new Date(', '').replace(')', '');
                date = date.split(', ');

                let newDate = '';

                for (let i = 0; i < date.length; i++) {
                    newDate += date[i];
                    if (i < 2) {
                        newDate += '-';
                    }
                    else if (i === 2) {
                        newDate += ' ';
                    }
                    else if (i < date.length - 1) {
                        newDate += ':';
                    }
                }

                date = newDate;
            }

            date = new Date(date);
        }

        let dateCurrent = date;
        that._refreshDateNavButtons(dateCurrent);

        if (dateCurrent.getTime() > that.max || dateCurrent.getTime() < that.min) {
            return
        }

        that.set('dateCurrent', dateCurrent);

        if (that.dateCurrent.getTime() !== dateCurrent.getTime()) {
            that.$.fireEvent('dateChange', { oldValue: new Date(that.dateCurrent), value: new Date(dateCurrent) });
        }

        if (that._calendar) {
            that._calendar.selectedDates = [new Date(dateCurrent)];

            if (that.$.tooltip.contains(that._calendar)) {
                return;
            }
        }

        that._createTimeline();
        that._refreshDateSelector();
    }

    /**
     * Handles header date navigation buttons
     * @param {Number|undefined} direction - determines the direction ( -1 previus or +1 forward )
     */
    _navigateDate(direction) {
        const that = this,
            viewType = that.viewType.toLowerCase();
        let dateCurrent = that.dateCurrent,
            targetDate = new Date(dateCurrent);

        if (direction === undefined) {
            targetDate = new Date();
        }
        else {
            targetDate.setHours(0, 0, 0, 0);

            if (viewType.includes('day')) {
                targetDate.setDate(targetDate.getDate() + direction);

            }
            else if (viewType.includes('week') || viewType === 'agenda') {
                targetDate.setDate(targetDate.getDate() + direction * 7);

                const viewDetails = that.views.find(v => v.value && v.value === that.view) || {};
                if (viewDetails.additionalDays) {
                    let lastDate = new Smart.Utilities.DateTime(dateCurrent);

                    lastDate = lastDate.addDays(direction * (6 + viewDetails.additionalDays));
                    targetDate = lastDate.toDate();
                    targetDate.setHours(0, 0, 0, 0);
                }
            }
            else {
                let lastDayOfNextMonth = new Date(targetDate);

                if (direction > 0) {
                    lastDayOfNextMonth.setDate(1);
                    lastDayOfNextMonth.setMonth(lastDayOfNextMonth.getMonth() + 2);
                    lastDayOfNextMonth.setDate(0);
                }
                else {
                    lastDayOfNextMonth.setDate(0);
                }

                targetDate.setMonth(targetDate.getMonth() + direction);

                //Check month
                if (targetDate.getMonth() !== lastDayOfNextMonth.getMonth()) {
                    targetDate = lastDayOfNextMonth;
                }
            }

            targetDate.setHours(dateCurrent.getHours(), dateCurrent.getMinutes(), dateCurrent.getSeconds(), dateCurrent.getMilliseconds());
        }

        that._refreshDateNavButtons(targetDate);

        if (targetDate.getTime() > that.max || targetDate.getTime() < that.min) {
            return
        }

        that.set('dateCurrent', targetDate);

        if (dateCurrent.getTime() !== targetDate.getTime()) {
            that.$.fireEvent('dateChange', { oldValue: new Date(dateCurrent), value: new Date(targetDate) });
        }

        if (that._calendar) {
            that._calendar.selectedDates = [new Date(targetDate)];

            if (that.$.tooltip.contains(that._calendar)) {
                return;
            }
        }

        that._createTimeline();
        that._scrollTo(targetDate);
        that._refreshDateSelector();
    }

    /**
     * Refreshes the date nav buttons
     * @param {Date} date
     */
    _refreshDateNavButtons(date) {
        const that = this;

        if (!date) {
            date = that.dateCurrent;
        }

        const dateSelectorContainer = that.$.dateSelectorContainer,
            prevButton = dateSelectorContainer.querySelector('.smart-scheduler-nav[prev]'),
            nextButton = dateSelectorContainer.querySelector('.smart-scheduler-nav[next]');

        if (prevButton) {
            prevButton.disabled = date.getTime() <= that.min;
        }

        if (nextButton) {
            nextButton.disabled = date.getTime() >= that.max;
        }
    }

    /**
     * Handles the content of the Tooltip before opening
     * @param {HTMLElement} target
     */
    _handleTooltipContent(target, rightClickDetails) {
        const that = this,
            tooltip = that.$.tooltip;

        if (!target) {
            tooltip.close();
            return
        }

        function setTooltipContent(content) {
            if (content && !tooltip.contains(content)) {
                tooltip.clear();
                tooltip.appendChild(content);
            }
        }

        if (target === that.$.currentDate) {
            tooltip.selector = target;
            tooltip.position = 'auto';
            tooltip.arrow = true;

            let calendar = that._calendar;

            if (!calendar) {
                calendar = document.createElement('smart-calendar');
                calendar.firstDayOfWeek = that.firstDayOfWeek;
                calendar.selectionMode = 'oneExtended';
                calendar.selectedDates = [new Date(that.dateCurrent)];
                calendar.max = that.max;
                calendar.min = that.min;
                calendar.rightToLeft = that.rightToLeft;
                calendar.locale = that.locale;
                calendar.id = that.id + 'Calendar';
                calendar.classList.add('smart-scheduler-calendar-popup');
                that._calendar = calendar;
            }

            setTooltipContent(calendar);
        }
        else if (target === that.$.viewItemsButton) {
            tooltip.selector = target;
            tooltip.position = 'auto';
            tooltip.arrow = true;

            setTooltipContent(that.$.viewItemsContainer);
            that._handleViewSelection();
            that._checkHideWekendItem();
        }
        else if (target.classList.contains('smart-scheduler-event') || target.classList.contains('smart-scheduler-cell')) {
            let list = that._list, itemList;

            if (!list) {
                that._list = list = document.createElement('smart-scroll-viewer');
                list.horizontalScrollBarVisibility = 'hidden';
            }

            list.theme = that.theme;
            list.tabIndex = that.tabIndex;
            list.rightToLeft = that.rightToLeft;
            that.inverted ? list.setAttribute('inverted', '') : list.removeAttribute('inverted');

            if (rightClickDetails) {
                itemList = that._getContextMenu(target);
            }
            else {
                itemList = that._getEventList(target);
            }

            if (!itemList || !itemList.innerHTML) {
                return
            }

            // list.focus({ preventScroll: true });
            that._handleEventItemSelection();

            if (!list.contains(itemList)) {
                if (list.isCompleted) {
                    list.removeAll();
                }

                list.appendChild(itemList);
            }
            else {
                if (tooltip.selector === target && tooltip.contains(list)) {
                    if (rightClickDetails) {
                        const schedulerRect = that.getBoundingClientRect();
                        tooltip.style.top = Math.min(rightClickDetails.y + 1, schedulerRect.bottom + window.pageYOffset - tooltip.offsetHeight) + 'px';
                        tooltip.style.left = Math.min(rightClickDetails.x + 1, schedulerRect.right + window.pageXOffset - tooltip.offsetWidth) + 'px';

                        if (tooltip.visible && that._fireTooltipVisibilityEvent({ type: 'opening', detail: { owner: tooltip.selector } })) {
                            that._skipEventFiring = true;
                            tooltip.close();
                            delete that._skipEventFiring;
                            return
                        }

                        tooltip.open();
                        return
                    }

                    if (tooltip.visible && tooltip.selector) {
                        tooltip.selector.focus({ preventScroll: true });
                    }

                    list.refresh();
                    tooltip.toggle();
                    return
                }
            }

            tooltip.selector = target;
            setTooltipContent(list);
            list.refresh();

            if (rightClickDetails) {
                const schedulerRect = that.getBoundingClientRect();
                tooltip.style.top = Math.min(rightClickDetails.y + 1, schedulerRect.bottom + window.pageYOffset - tooltip.offsetHeight) + 'px';
                tooltip.style.left = Math.min(rightClickDetails.x + 1, schedulerRect.right + window.pageXOffset - tooltip.offsetWidth) + 'px';
            }

            if (tooltip.visible) {
                if (that._fireTooltipVisibilityEvent({ type: 'opening', detail: { owner: tooltip.selector } })) {
                    that._skipEventFiring = true;
                    tooltip.close()
                    delete that._skipEventFiring;
                    return
                }

                if (!rightClickDetails) {
                    tooltip.reposition();
                }
                return
            }

            if (!tooltip.visible) {
                tooltip.open();
            }
        }
    }

    /**
     * Handles event cell right mouse click. Opens context menu for event
     * @param {*} eventCell
     */
    _getContextMenu(targetCell) {
        const that = this,
            tooltip = that.$.tooltip;
        let contextList = that._contextList, dataSource = that.contextMenuDataSource,
            isCell, isRepeatingEvent;

        if (targetCell.classList.contains('smart-scheduler-event') && !targetCell.hasAttribute('collector')) {
            const eventObj = targetCell.$ ? targetCell.$.event : undefined;

            if (eventObj && eventObj.$ && eventObj.$.event) {
                isRepeatingEvent = true;
            }

            //Show Context menu for Scheduler Event
            if (!dataSource) {
                dataSource = ['create', 'edit', 'delete'];

                if (that.contextMenuClipboardActions) {
                    ['copy', 'cut'].forEach(i => dataSource.push(i));
                }
            }

            if (eventObj.disableContextMenu) {
                dataSource = [];
                tooltip.close();
            }

        }
        else if (targetCell.classList.contains('smart-scheduler-cell')) {
            //Show Context menu for scheduler cell
            isCell = true;

            if (!dataSource) {
                dataSource = ['create'];

                if (that.disableConflicts) {
                    if (that._events) {
                        let dates = [];
                        for (let i = 0; i < that._events.length; i++) {
                            const dateObj = that._events[i];
                            dates.push({
                                start: dateObj.dateStart,
                                end: dateObj.dateEnd
                            });
                        }

                        const targetDate = new Date(targetCell.$.cellObj.time);
                        const collision = that.isCollision(targetDate, targetDate, dates);

                        if (collision) {
                            dataSource = [];
                            tooltip.close();
                        }
                    }
                }

                if (that.contextMenuClipboardActions) {
                    dataSource.push('paste');
                }
            }
        }
        else {
            tooltip.close();
            return
        }

        //Position the tooltip
        tooltip.position = 'absolute';
        tooltip.arrow = false;

        if (!contextList) {
            that._contextList = contextList = document.createElement('div');
            contextList.classList.add('smart-scheduler-context-menu');
            contextList.setAttribute('role', 'listbox');
            contextList.setAttribute('aria-label', 'Context Menu');
        }

        const fragment = document.createDocumentFragment(),
            currentItems = Array.from(contextList.children),
            hideOtherMonthDays = that.hideOtherMonthDays;
        let nonRepeatingEventOps = ['copy', 'cut'];

        //Remove previous events
        for (let i = 0; i < currentItems.length; i++) {
            const item = currentItems[i];

            if (dataSource.indexOf(item.getAttribute('value')) < 0) {
                item.remove();
            }
        }

        //Create the list items
        for (let i = 0; i < dataSource.length; i++) {
            const dataItem = dataSource[i];
            let item = currentItems[i], label, value;

            if (typeof dataItem === 'object') {
                label = dataItem.label;
                value = dataItem.value;
            }
            else {
                label = value = dataItem + '';
            }

            if (!item) {
                item = document.createElement('div');
                item.classList.add('smart-scheduler-context-menu-item');
                item.setAttribute('role', 'option');
            }

            if (!item.parentElement) {
                fragment.appendChild(item);
            }

            if (targetCell.hasAttribute('restricted') || hideOtherMonthDays && targetCell.hasAttribute('other-month')) {
                item.setAttribute('disabled', '');
            }
            else {
                if (isCell && value === 'paste') {
                    that._clipboard ? item.removeAttribute('disabled') : item.setAttribute('disabled', '');
                }
                else if (isRepeatingEvent && nonRepeatingEventOps.indexOf(value) > -1) {
                    item.setAttribute('disabled', '');
                }
                else {
                    item.removeAttribute('disabled');
                }
            }

            item.innerHTML = that.localize(label) || label;
            item.setAttribute('value', value);
        }

        contextList.appendChild(fragment);

        return contextList
    }

    /**
     * Returns the event list for the collector
     * @param {*} collector
     */
    _getEventList(target) {
        const that = this;

        if (!target.classList.contains('smart-scheduler-event') || !target.$) {
            return
        }

        const isCollector = target.hasAttribute('collector'),
            events = isCollector ? target.$.events : [target.cloneNode(true)];
        let eventList = that._eventList;

        if (!events || !events.length) {
            if (eventList) {
                eventList.innerHTML = '';
            }
            return
        }

        const tooltip = that.$.tooltip;

        tooltip.position = 'auto';
        tooltip.arrow = true;

        if (!eventList) {
            eventList = document.createElement('div');
            eventList.classList.add('smart-scheduler-collector-event-list');
            eventList.setAttribute('role', 'menu');
            eventList.id = that.id + 'EventMenu';
            that._eventList = eventList;
        }

        //Keep a reference to the event cell
        eventList._target = target;

        const fragment = document.createDocumentFragment(),
            currentItems = Array.from(eventList.children),
            eventDetails = { isAllDayEvent: that.$.timelineViewAllDay.contains(target), isTooltipEvent: true };

        //Remove previous events
        for (let i = 0; i < currentItems.length; i++) {
            const item = currentItems[i];

            if (events.indexOf(item) < 0) {
                item.remove();
            }
        }

        for (let i = 0; i < events.length; i++) {
            const eventCell = events[i];

            if (!isCollector) {
                //Cloned events need to have their event object reset
                eventCell.$ = target.$;
            }

            eventDetails.eventObj = eventCell.$.event;
            eventDetails.isAllDayEvent = eventDetails.eventObj.allDay;
            that._setEventCellContent(eventCell, eventDetails);

            fragment.appendChild(events[i]);
        }

        eventList.appendChild(fragment);

        return eventList
    }

    /**
     * Handles Tooltip Opening/Closing events
     * @param {Event} event
     */
    _tooltipVisibilityHandler(event) {
        const that = this,
            eventType = event.type,
            tooltip = that.$.tooltip,
            host = that.getRootNode().host || that.getRootNode();

        event.stopPropagation();

        if (!that._skipEventFiring && that._fireTooltipVisibilityEvent(event)) {
            event.preventDefault();
            return
        }

        if (host !== document && !document.body.contains(host)) {
            return;
        }

        if (eventType === 'opening') {
            tooltip.classList.remove('smart-visibility-hidden');
            that.getShadowRootOrBody().appendChild(tooltip);
        }
        else if (eventType === 'closing') {
            if (that.hasAnimation) {
                tooltip.addEventListener('animationend', () => {
                    if (!tooltip.visible) {
                        tooltip.classList.add('smart-visibility-hidden');
                        tooltip.style.top = tooltip.style.left = 0;
                        that.$.container.appendChild(tooltip);
                    }
                }, { once: true });
            }
            else {
                that.$.container.appendChild(tooltip);
            }
        }
    }

    /**
     * Fires Opening/Closing events for the events/cells/viewsMenu/dateMenu
     * @param {Object} event
     */
    _fireTooltipVisibilityEvent(event) {
        const that = this,
            eventType = event.type,
            tooltip = that.$.tooltip,
            isContextMenu = tooltip.contains(that._contextList),
            isEventMenu = tooltip.contains(that._eventList),
            tooltipOwner = event.detail.owner;
        let eventDetails = { target: tooltip, owner: tooltipOwner }, eventName;

        //Setting Event details
        if (isContextMenu) {
            if (tooltipOwner.classList.contains('smart-scheduler-event')) {
                eventDetails.eventObj = [that._cloneObject(tooltipOwner.$.event)];
            }
            else {
                let date, group;

                if (that._selectedCellObj) {
                    const fromCellObj = that._selectedCellObj.from,
                        toCellObj = that._selectedCellObj.to,
                        fromTime = Math.min(fromCellObj.time, toCellObj.time),
                        toTime = Math.max(fromCellObj.time, toCellObj.time);

                    date = fromTime === toTime ? [new Date(fromTime)] : [new Date(fromTime), new Date(toTime)];
                    group = (fromCellObj.vertical.group || fromCellObj.horizontal.group);
                }
                else {
                    const cellObj = tooltipOwner.$.cellObj;

                    date = [new Date(cellObj.time)];
                    group = (cellObj.vertical.group || cellObj.horizontal.group);
                }

                eventDetails.cellObj = { date: date };

                if (group) {
                    eventDetails.group = group;
                }
            }
        }
        else if (isEventMenu) {
            if (tooltipOwner.$.events) {
                //Colelctor
                eventDetails.eventObj = tooltipOwner.$.events.map(e => that._cloneObject(e.$.event));
            }
            else if (tooltipOwner.$.event) {
                //Event
                eventDetails.eventObj = [that._cloneObject(tooltipOwner.$.event)];
                if (eventDetails.eventObj && eventDetails.eventObj[0] && eventDetails.eventObj[0].disableEventMenu) {
                    return true;
                }
            }
        }

        if (eventType === 'open' || eventType === 'close') {
            if (isContextMenu) {
                eventName = 'contextMenu';
            }
            else if (isEventMenu) {
                eventName = 'eventMenu';
            }
            else if (tooltip.contains(that._calendar)) {
                eventName = 'dateMenu';
            }
            else if (tooltip.contains(that.$.viewItemsContainer)) {
                eventName = 'viewMenu';
            }

            let ariaOwns = (that.getAttribute('aria-owns') || '') + ' ' + tooltip.id;

            //Handle aria attribute for the ownership of the Tooltip
            if (eventType === 'open') {
                that.setAttribute('aria-owns', ariaOwns.trim());
            }
            else if (that.hasAttribute('aria-owns')) {
                ariaOwns = that.getAttribute('aria-owns').replace(tooltip.id, '').trim();
                ariaOwns ? that.setAttribute('aria-owns', ariaOwns) : that.removeAttribute('aria-owns');
            }

            if (eventName) {
                that.$.fireEvent(eventName + (eventType === 'open' ? 'Open' : 'Close'), eventDetails);
            }
            return
        }

        if (isContextMenu) {
            //Context Menu
            eventName = eventType === 'opening' ? 'contextMenuOpening' : 'contextMenuClosing';
        }
        else if (isEventMenu) {
            //Event Menu
            eventName = eventType === 'opening' ? 'eventMenuOpening' : 'eventMenuClosing';
        }

        if (eventName && that.$.fireEvent(eventName, eventDetails).defaultPrevented) {
            return true
        }
    }

    /**
     * Tooltip Change event handler
     * @param {Event} event
     */
    _tooltipChangeHandler(event) {
        const that = this,
            calendar = that._calendar;

        if (event.target === calendar) {
            event.stopPropagation();

            const dateCurrent = that.dateCurrent;

            that.set('dateCurrent', calendar.selectedDates[0] || that.dateCurrent);

            if (that.dateCurrent.getTime() !== dateCurrent.getTime()) {
                that.$.fireEvent('dateChange', { oldValue: new Date(that.dateCurrent), value: new Date(dateCurrent) });
            }

            that._refreshDateSelector();
            that._createTimeline();
            event.context.close();
            return;
        }
    }

    /**
     * Tooltip Click Handler
     * @param {Event} event
     */
    _tooltipClickHandler(event) {
        const that = this,
            tooltip = that.$.tooltip,
            target = that.isInShadowDOM ? (event || event.originalEvent).composedPath()[0] : (event || event.originalEvent).target;

        //Handle View Item selection
        if (that.$.viewItemsContainer.contains(target)) {
            const viewItem = target.closest('.smart-scheduler-item');

            if (viewItem === that.$.showWeekendItem) {
                that._checkHideWekendItem(viewItem);
            }
            else {
                that._handleViewSelection(viewItem);
            }

            tooltip.close();
            return;
        }

        const eventItem = target.closest('.smart-scheduler-event');

        //Open Event Editor Window
        if (eventItem) {
            if (target.closest('.smart-scheduler-event-button')) {
                that._handleEventMenuDelete(eventItem);
                return
            }

            that._doubleClickHandler(target);
            return
        }

        const contextMenuItem = target.closest('.smart-scheduler-context-menu-item');

        if (contextMenuItem) {
            that._handleContextMenuItemClick(contextMenuItem);
        }
    }

    /**
     * Handles Deleting an event/repeating event from the Event Menu
     * @param {HTMLElement} eventItem - the event element
     * @returns 
     */
    _handleEventMenuDelete(eventItem) {
        const that = this,
            tooltip = that.$.tooltip,
            eventObj = eventItem.$ ? eventItem.$.event : undefined;

        tooltip.close();
        // delete that._openEventMenu;

        if (!eventObj) {
            that.$.timeline.focus({ preventScroll: true });
            return
        }

        const repeatingEvent = eventObj.$ ? eventObj.$.event : undefined;

        if (repeatingEvent) {
            const eventExceptions = repeatingEvent && repeatingEvent.repeat ? repeatingEvent.repeat.exceptions : undefined;

            that._openWindow(eventExceptions && eventExceptions.indexOf(eventObj) > -1 ?
                eventObj : Object.assign({}, eventObj, {
                    dateStart: eventItem.$.dateStart,
                    dateEnd: eventItem.$.dateEnd
                }), eventItem, 'deleteConfirm');
        }
        else {
            //Delete the event
            that._deleteEventViaWindow(eventObj);
            that.$.timeline.focus({ preventScroll: true });
        }
    }

    /**
     * Tooltip keydown handler
     * @param {*} event
     */
    _tooltipKeyDownHandler(event) {
        this._keyDownHandler(event);
    }

    /**
     * Tooltip keyUp handler
     * @param {*} event
     */
    _tooltipKeyUpHandler(event) {
        this._keyUpHandler(event);
    }

    /**
    * Tooltip keydown handler
    * @param {*} event
    */
    _tooltipDownHandler(event) {
        event.stopPropagation();
        this._downHandler(event);
    }

    /**
     * Tooltip ContextMenu Handler
     * @param {*} event
     */
    _tooltipContextMenuHandler(event) {
        const eventTarget = event.target;

        if (eventTarget && eventTarget.closest && eventTarget.closest('.smart-scheduler-event')) {
            event.preventDefault();
        }
    }

    /**
     * Scheduler Timelien focus handler
     * @param {Event} event
     */
    _timelineFocusHandler(event) {
        const that = this;

        if (event.type === 'focusin' || event.type === 'focusout') {
            event.type === 'focusin' || that.hasAttribute('modal') ? that.$.viewContent.firstElementChild.setAttribute('focus', '') : that.$.viewContent.firstElementChild.removeAttribute('focus');
            that._handleEventFocus(event);
            return
        }

        if (that.readonly || that.hasAttribute('modal')) {
            return
        }

        const allDayCells = that.$.timelineViewAllDay,
            areAllDayCellsVisible = allDayCells.offsetHeight > 0;

        if (!that._isMobile && (!that._dragDetails || !that._dragDetails.timelineCellObj)) {
            if (!that._selectedCellObj) {
                //Select the first cell
                that._handleCellSelection((areAllDayCellsVisible ? allDayCells : that.$.timelineContent).querySelector('.smart-scheduler-cell:not(.scale)'));
            }
            else {
                const relatedTarget = event.relatedTarget,
                    schedulerWindow = that.$.schedulerWindow,
                    confirmWindow = that.$.confirmWindow;

                //Keep the last selection if the window is canceled
                if (schedulerWindow && schedulerWindow.contains(relatedTarget) || confirmWindow && confirmWindow.contains(relatedTarget)) {
                    return
                }

                //Select only the last cell
                if (that._selectedCellObj.from.time !== that._selectedCellObj.to.time) {
                    that._handleCellSelection(that._selectedCellObj.from);
                }
            }
        }
    }

    /**
     * Handles the focus attribute for the event elements when focused
     * @param {*} target
     */
    _handleEventFocus(event) {
        const that = this,
            schedulerEvent = event && event.type === 'focusin' ? event.target : undefined,
            schedulerEventObj = schedulerEvent && schedulerEvent.$ ? schedulerEvent.$.event : undefined,
            schedulerEvents = that.$.timeline.querySelectorAll('.smart-scheduler-event');
        let targetEvent;

        for (let i = 0; i < schedulerEvents.length; i++) {
            const timelineEvent = schedulerEvents[i],
                eventObj = timelineEvent.$.event;

            if (timelineEvent === schedulerEvent || schedulerEventObj && schedulerEventObj === eventObj) {
                timelineEvent.setAttribute('focus', '');
                targetEvent = timelineEvent;
            }
            else {
                timelineEvent.removeAttribute('focus');
            }
        }

        return targetEvent
    }

    /**
     * Handles Header View Selection
     * @param {HTMLElement} viewItem - view item element
     */
    _handleViewSelection(viewItem) {
        const that = this,
            showWeekendItem = that.$.showWeekendItem,
            viewItems = that.$.viewItemsContainer.children,
            oldValue = that.view;
        let view;

        if (viewItem instanceof HTMLElement) {
            view = viewItem.$ ? viewItem.$.value : null;
        }

        if (!view) {
            view = that.view;
        }

        if (view !== oldValue && that.$.fireEvent('viewChanging', { oldValue: oldValue, value: view }).defaultPrevented) {
            return
        }

        for (let i = 0; i < viewItems.length; i++) {
            const item = viewItems[i];

            item.removeAttribute('selected');

            if (!viewItem && item.$ && item.$.value === view) {
                viewItem = item;
            }
        }

        if (viewItem) {
            viewItem.setAttribute('selected', '');
        }

        if (viewItem === showWeekendItem) {
            return
        }

        if (view !== oldValue) {
            that.set('view', view);
            that._createTimeline();
            that._refreshDateSelector();
            that._checkHideWekendItem();

            //Scroll to the view item
            that._scrollToView(viewItem);

            that.$.fireEvent('viewChange', { oldValue: oldValue, value: view });
        }

        that.$.viewItemsButton.innerHTML = `<span>${viewItem ? viewItem.textContent.trim() : (that.localize(view) || view)}</span>`;
    }

    /**
     * Select/Unselect hideWeekend Menu item
     */
    _checkHideWekendItem(showWeekendItem) {
        const that = this,
            isNotDayView = that.viewType.toLowerCase().indexOf('day') < 0,
            view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            isHideWeekendCustom = viewDetails && viewDetails.hideWeekend !== undefined ? viewDetails.hideWeekend : undefined,
            isWeekendHidden = isHideWeekendCustom ? (viewDetails.hideWeekend || that.hideWeekend) : that.hideWeekend;

        if (!showWeekendItem) {
            showWeekendItem = that.$.showWeekendItem;

            if (!showWeekendItem || !showWeekendItem.parentElement) {
                return
            }

            if (showWeekendItem) {
                if (!isWeekendHidden || !isNotDayView) {
                    showWeekendItem.setAttribute('checked', '');
                }
                else {
                    showWeekendItem.removeAttribute('checked');
                }
            }

            if (that.viewType.toLowerCase().indexOf('day') > -1) {
                showWeekendItem.setAttribute('disabled', '');
            }
            else {
                showWeekendItem.removeAttribute('disabled');
            }

            return
        }

        if (!showWeekendItem || !showWeekendItem.parentElement || showWeekendItem !== that.$.showWeekendItem) {
            return
        }

        if (showWeekendItem.hasAttribute('checked')) {
            showWeekendItem.removeAttribute('checked');
            that.set('hideWeekend', true);
        }
        else {
            showWeekendItem.setAttribute('checked', '');
            that.set('hideWeekend', false);
        }

        const hideWeekendValue = that.hideWeekend;

        if (isHideWeekendCustom !== undefined) {
            viewDetails.hideWeekend = hideWeekendValue;
        }

        if (isWeekendHidden !== hideWeekendValue && isNotDayView) {
            that._createTimeline();
        }
    }

    /**
     * Scrolls to a view item
     * @param {HTMLElement} viewItem - a scheduler view item
     */
    _scrollToView(viewItem) {
        const that = this;

        if (that.viewSelectorType !== 'tabs') {
            return
        }

        const scrollView = that.$.viewItemsContainer;

        viewItem = viewItem || scrollView.querySelector('.smart-scheduler-item[selected]');

        if (!viewItem) {
            return
        }

        const size = scrollView.offsetWidth,
            cellOffset = viewItem.offsetLeft,
            cellSize = cellOffset + viewItem.offsetWidth;
        let scroll = scrollView.scrollLeft;

        if (scroll > cellOffset) {
            scroll = scrollView.scrollLeft = cellOffset;
        }
        else if (scroll + size < cellSize) {
            scroll = scrollView.scrollLeft = cellSize - size;
        }

        //Update the scroll buttons
        const viewButtons = that._viewButtons;

        if (viewButtons) {
            viewButtons.prev.disabled = !scroll;
            viewButtons.next.disabled = Math.abs(scroll) + size === scrollView.scrollWidth;
        }
    }

    /**
     * Resize event handler
     */
    _resizeEventHandler(event) {
        const that = this,
            target = event ? (that.enableShadowDOM ? event.composedPath()[0] : event.target) : undefined;

        if (target !== that) {
            return
        }

        function resizeElement() {
            if (that._noResizeHandler) {
                delete that._noResizeHandler;
                return;
            }

            if (that.offsetHeight === 0) {
                return;
            }

            that._refreshHeaderControlsVisibility();

            const tooltip = that.$.tooltip;

            that._positionWindow();
            that._createTimeline();

            if (tooltip.visible) {
                if (tooltip.contains(that._contextList)) {
                    tooltip.close();
                }
                else {
                    tooltip.reposition();
                }
            }

            that._refreshViewSelector();

            if (that._resizeLegend) {
                that._resizeLegend();
            }
        }

        clearTimeout(that._resizeTimeout);

        if (!that.resizeInterval) {
            resizeElement();
            return
        }

        that._resizeTimeout = setTimeout(resizeElement.bind(that), that.resizeInterval);
    }

    /**
    * Configures the Scroll Bars on initialization
    */
    _setScrollBars() {
        const that = this;

        if (!that._scrollView) {
            that._scrollView = new Smart.Utilities.Scroll(that.$.timeline, that.$.horizontalScrollBar, that.$.verticalScrollBar);
        }

        const vScrollBar = that._scrollView.vScrollBar,
            hScrollBar = that._scrollView.hScrollBar;

        hScrollBar.$.addClass('smart-hidden');
        vScrollBar.$.addClass('smart-hidden');

        //Cancel Style/Resize observers of the ScrollBars
        vScrollBar.hasStyleObserver = false;
        hScrollBar.hasStyleObserver = false;
        vScrollBar.hasResizeObserver = false;
        hScrollBar.hasResizeObserver = false;

        hScrollBar.wait = false;
        vScrollBar.wait = false;

        //Refreshes the ScrollBars
        that._refresh();
    }

    /**
     * Sets the tab index
     */
    _setFocusable() {
        const that = this;

        if (that.disabled || that.unfocusable) {
            that.removeAttribute('tabindex');
            that.$.timeline.removeAttribute('tabindex');
            that.$.viewItemsContainer.removeAttribute('tabindex');
            return;
        }

        const tabIndex = that.tabIndex > 0 ? that.tabIndex : 0;

        that.tabIndex = tabIndex;
        that.$.tooltip.tabIndex = tabIndex;
        that.$.timeline.tabIndex = tabIndex;
        that.$.viewItemsContainer.tabIndex = tabIndex;
    }

    /**
    * Sets the export styles
    * @param {string} rgb - a RGB color string
    */
    _toHex(rgb) {
        function hex(x) {
            const hexDigits = new Array('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f');
            return isNaN(x) ? '00' : hexDigits[(x - x % 16) / 16] + hexDigits[x % 16];
        }

        rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

        if (!rgb) {
            return '#ffffff';
        }

        return '#' + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]).toUpperCase();
    }

    /**
     * Sets the export styles
     * @param {object} dataExporter - the DataExported object
     * @param {string} dataFormat - the data format
     */
    _setExportStyles(dataExporter, dataFormat) {
        const that = this;

        if (dataExporter.style) {
            return
        }

        const dataExporterHeader = dataExporter.header,
            columnsData = dataExporterHeader.columns,
            computedStyle = window.getComputedStyle(that),
            header = {
                height: computedStyle.getPropertyValue('--smart-scheduler-timeline-header-horizontal-cells-size'),
                border: '1px solid ' + that._toHex(computedStyle.borderColor),
                fontFamily: 'Calibri',
                fontSize: computedStyle.fontSize,
                color: that._toHex(computedStyle.color),
                backgroundColor: that._toHex(computedStyle.backgroundColor),
                fontWeight: '400'
            },
            columns = {
                border: '1px solid ' + that._toHex(computedStyle.borderColor),
                fontFamily: 'Calibri',
                fontSize: computedStyle.fontSize
            },
            timelineCells = that._timelineCells;
        let cellHeight, cellWidth;

        if (timelineCells && timelineCells.vertical && timelineCells.horizontal) {
            cellHeight = timelineCells.vertical[0] ? timelineCells.vertical[0].height : undefined;
            cellWidth = timelineCells.horizontal[0] ? timelineCells.horizontal[0].width : undefined;
        }

        if (cellHeight === undefined) {
            cellHeight = Math.max(parseFloat(computedStyle.getPropertyValue('--smart-scheduler-timeline-cell-height')) || 0,
                parseFloat(computedStyle.getPropertyValue('--smart-scheduler-timeline-cell-min-height') || 0));
        }

        if (cellWidth === undefined) {
            cellWidth = Math.max(parseFloat(computedStyle.getPropertyValue('--smart-scheduler-timeline-cell-width')) || 0,
                parseFloat(computedStyle.getPropertyValue('--smart-scheduler-timeline-cell-min-width') || 0));
        }

        if (dataFormat === 'pdf') {
            cellWidth = 100 / columnsData.length + '%';
        }
        else {
            cellWidth += 'px';
        }

        cellHeight += 'px';

        for (let i = 0; i < columnsData.length; i++) {
            const column = columnsData[i];

            header[column.dataField] = {
                textAlign: 'center',
                width: cellWidth
            }

            columns[column.dataField] = {
                textAlign: 'start',
                format: column.dataField.indexOf('date') > -1 ? 'd' : ''
            };
        }

        //Set the styles
        dataExporter.style = {
            border: '1px solid ' + that._toHex(computedStyle.borderColor),
            borderCollapse: 'collapse',
            header: header,
            columns: columns,
            rows: {
                height: cellHeight
            }
        }
    }

    /**
     * Returns the records for exporting
     * @param {object} schedulerEvent - a scheduler event to create a record from
     */
    _getExportRecord(eventObj) {
        const that = this,
            locale = that.locale,
            events = that._events,
            resources = that.resources,
            firstEvent = events[0],
            yearFormat = that.yearFormat,
            monthFormat = that.monthFormat,
            dayFormat = that.dayFormat,
            hourFormat = that.hourFormat,
            minuteFormat = that.minuteFormat;
        let columns = that.dataExport.columns, record = {};

        if (!columns || !columns.length) {
            //Set the columns if not set by the user
            const defaultCols = ['id', 'label', 'description', 'dateStart', 'dateEnd'];

            columns = Object.keys(firstEvent).filter(k => defaultCols.indexOf(k) > -1);

            //Add resource collumns depending on the current resources
            resources.forEach(r => columns.push(r.value));
        }

        //Create the Header
        for (let c = 0; c < columns.length; c++) {
            const col = columns[c],
                resource = resources.find(r => r.value === col);

            if (eventObj) {
                if (resource && eventObj[resource.value]) {
                    //Find the resource label
                    if (resource && resource.dataSource) {
                        const resourceDataItem = resource.dataSource.find(i => i.id === eventObj[resource.value]);

                        record[col] = resourceDataItem ? resourceDataItem.label || '' : '';
                    }
                }
                else {
                    const value = eventObj[col];

                    if (value instanceof Date) {
                        record[col] = new Intl.DateTimeFormat(locale, {
                            year: yearFormat, month: monthFormat, day: dayFormat,
                            hour: hourFormat, minute: minuteFormat
                        }).format(value);
                    }
                    else {
                        record[col] = value || '';
                    }
                }

                record._keyDataField = events.indexOf(eventObj);
            }
            else {
                record[col] = (resource ? resource.label : (that.localize(col) || col)) || '';
            }
        }

        return record
    }

    /**
     * Refreshes the ScrollBars
     */
    _refresh() {
        const that = this;

        function getScrollWidth() {
            const scrollWidth = that.$.timelineContent.offsetWidth - that.$.timelineContainer.offsetWidth;

            if (scrollWidth > 0 && that.horizontalScrollBarVisibility !== 'hidden' || that.horizontalScrollBarVisibility === 'visible') {
                that.$container.addClass('hscroll');
            }
            else {
                that.$container.removeClass('hscroll');
            }

            return scrollWidth;
        }

        function getScrollHeight() {
            const scrollHeight = that.$.timelineContent.offsetHeight - that.$.timelineContainer.offsetHeight;

            if (scrollHeight > 0 && that.verticalScrollBarVisibility !== 'hidden' || that.verticalScrollBarVisibility === 'visible') {
                that.$container.addClass('vscroll');
            }
            else {
                that.$container.removeClass('vscroll');
            }

            return scrollHeight;
        }

        //Caching the size's before they are re-calculated. Used to check if width/height of the container have changed.
        const initialWidth = that.scrollWidth,
            initialHeight = that.scrollHeight;
        let newScrollWidth = getScrollWidth(),
            newScrollHeight = getScrollHeight();

        //double check in case vScroll has become hidden and hScroll visibility should be checked
        if (!newScrollHeight || initialHeight !== newScrollHeight) {
            newScrollWidth = getScrollWidth();
        }

        //doble check in case hScroll has become hidden and vScroll visibility should be checked
        if (!newScrollWidth || initialWidth !== newScrollWidth) {
            newScrollHeight = getScrollHeight();
        }

        that.scrollWidth = newScrollWidth;
        that.scrollHeight = newScrollHeight;

        //Bottom-corner refresh
        that.$.horizontalScrollBar.refresh();
        that.$.verticalScrollBar.refresh();
    }

    /**
     * Configures the header container of the Scheduler
     */
    _setHeader() {
        const that = this,
            header = that.$.header,
            todayButton = that.$.todayDate;

        if (that.headerTemplate) {
            //Handle Header Template
            that._applyTemplate('headerTemplate', header);
        }
        else {
            const dateSelectorContainer = that.$.dateSelectorContainer;

            //Set the original header
            if (!header.contains(dateSelectorContainer)) {
                header.innerHTML = '';
                header.appendChild(dateSelectorContainer);
                header.appendChild(that.$.viewSelectorContainer);
            }

            that._setLegend(header);
        }

        if (header.contains(todayButton)) {
            todayButton.innerHTML = `<span>${that.localize('today')}</span>`;
        }

        that._refreshDateSelector();
        that._refreshViewSelector();
        that._refreshHeaderControlsVisibility();
    }

    /**
     * Refreshes the visibility of the header controls.
     * When the size of the Scheduler is changed some of the header controls should be hidden
     */
    _refreshHeaderControlsVisibility() {
        const that = this,
            viewSelectorType = that.viewSelectorType;

        if (viewSelectorType === 'tabs' || viewSelectorType === 'auto' && !that._isMobile) {
            return
        }

        const schedulerWidth = that.offsetWidth,
            todayButton = that.$.todayDate,
            currentDate = that.$.currentDate;

        if (schedulerWidth <= 500) {
            todayButton.classList.add('smart-hidden');
        }
        else {
            todayButton.classList.remove('smart-hidden');
        }

        if (schedulerWidth <= 320) {
            currentDate.classList.add('smart-hidden');
        }
        else {
            currentDate.classList.remove('smart-hidden');
        }
    }

    /**
    * Configures the footer container of the Scheduler
    */
    _setFooter() {
        const that = this,
            footer = that.$.footer;

        if (that.footerTemplate === null) {
            footer.innerHTML = null;

            that._setLegend(footer);

            if (!footer.children.length) {
                that.$.container.removeAttribute('show-footer');
            }

            return
        }

        //Show the Footer
        that.$.container.setAttribute('show-footer', '');

        //Handle Footer Template
        that._applyTemplate('footerTemplate', footer);
    }

    /**
     * Handles the Footer legend. The legend shows the resources
     */
    _setLegend(container) {
        const that = this,
            footer = that.$.footer,
            legendContainer = that.legendLocation === 'header' ? that.$.header : footer;

        if (container && container !== legendContainer) {
            return
        }

        let legend = that._legend;

        if (!that.showLegend) {
            if (legend) {
                legend.innerHTML = '';
                legend.remove();
            }

            if (legendContainer === footer && !footer.children.length) {
                that.$.container.removeAttribute('show-footer');
            }
            return
        }

        if (!legend) {
            legend = that._legend = document.createElement('div');
            legend.classList.add('smart-scheduler-legend');
            legend.setAttribute('role', 'presentation');
        }

        legend.innerHTML = '';

        //Create legend items for each resource
        const resources = that.resources,
            noLabel = resources.length === 1,
            legendItems = legend.children;

        for (let i = 0; i < resources.length; i++) {
            const res = resources[i];

            if (res.dataSource.length) {
                that._refreshLegendItems(i, noLabel);
            }
        }

        //Remove unnecessary legend items

        while (resources.length < legendItems.length) {
            legendItems.lastElementChild.remove();
        }

        //Add the legend to the Footer
        if (!legendContainer.contains(legend)) {
            legendContainer.appendChild(legend);
        }
    }

    /**
     * Refreshes the Legend items
     * @param {object} resource - the target resource
     * @param {boolean} noLabel -  indicating whether to create a label or not
     */
    _refreshLegendItems(i, noLabel) {
        const that = this,
            resource = that.resources[i],
            legend = that._legend;
        let legendItems = legend.children,
            resContainer = legendItems[i],
            label, resourceItemsContainer;

        if (!resContainer) {
            resContainer = document.createElement('div');
            resContainer.classList.add('smart-scheduler-legend-item');
            resContainer.setAttribute('role', 'listbox');
        }

        resContainer.setAttribute('resource', resource.value + '');

        const resContainerChildren = resContainer.children;

        for (let i = 0; i < resContainerChildren.length; i++) {
            const child = resContainerChildren[i];

            if (child.classList.contains('smart-scheduler-legend-res-label')) {
                label = child;
            }
            else if (child.classList.contains('smart-scheduler-legend-res-items')) {
                resourceItemsContainer = child;
            }
        }

        if (!label && !noLabel) {
            label = document.createElement('label');
            label.classList.add('smart-scheduler-legend-res-label');
            label.id = that.id + 'LegendResourceLabel';
        }
        else if (label && noLabel) {
            label.remove();
        }

        //Set the Resource Label
        if (label) {
            label.textContent = resource.label || '';
            resContainer.setAttribute('aria-labelledby', label.id);
        }

        if (!resourceItemsContainer) {
            resourceItemsContainer = document.createElement('div');
            resourceItemsContainer.classList.add('smart-scheduler-legend-res-items');
            resourceItemsContainer.setAttribute('role', 'presentation');
        }

        //Refreshes the resource item corresponding to the dataSource of the resources
        that._refereshLegendResItems(resource, resourceItemsContainer);

        //Add the Resource Items Container
        if (!resContainer.contains(resourceItemsContainer)) {
            resContainer.appendChild(resourceItemsContainer);
        }

        //Add the Label
        if (!noLabel && !resContainer.contains(label)) {
            resContainer.insertBefore(label, resourceItemsContainer);
        }

        //Add the Resource Container to the Legend
        if (!legend.contains(resContainer)) {
            legend.appendChild(resContainer);
        }
    }

    /**
     * Refreshes the Legend Resource items
     * @param {object[]} resItems - the dataSource of the resource item
     * @param {HTMLElement} resourceItemsContainer - the container for the resource items
     */
    _refereshLegendResItems(resource, resourceItemsContainer) {
        const that = this,
            filter = that.filter,
            resourceItems = resourceItemsContainer.children,
            tabIndex = Math.max(that.tabIndex, 0),
            resItems = resource.dataSource,
            resourceValue = resource.value;

        let totalLength = 0;

        for (let i = 0; i < resItems.length; i++) {
            const resItem = resItems[i];
            let resItemElement = resourceItems[i];

            if (!resItemElement) {
                resItemElement = document.createElement('div');
                resItemElement.classList.add('smart-scheduler-legend-res-item');
                resItemElement.setAttribute('role', 'option');
            }

            //Set the resource items
            resItemElement.innerHTML = `<span>${resItem.label || ''}</span>`;
            resItemElement.title = resItem.label;
            totalLength += resItem.label.length;
            resItemElement.setAttribute('aria-label', resItem.label);

            resItemElement.setAttribute('resource', resourceValue + '');
            resItemElement.setAttribute('resource-id', resItem.id + '');

            if (filter && Array.isArray(filter)) {
                //Checks for filtering via the Legend to apply 'unselected' attribute
                let filterCondition = filter.find(f => f.name === resourceValue);

                if (filterCondition && typeof filterCondition.value === 'function' && !filterCondition.value(resItem.id)) {
                    resItemElement.setAttribute('unselected', '');
                }
                else {
                    resItemElement.removeAttribute('unselected');
                }
            }
            else {
                resItemElement.removeAttribute('unselected');
            }

            if (resItem.disabled) {
                resItemElement.setAttribute('disabled', '');
                resItemElement.removeAttribute('tabindex');
                resItemElement.removeAttribute('aria-selected');
            }
            else {
                resItemElement.removeAttribute('disabled');
                resItemElement.setAttribute('tabindex', tabIndex);

                if (resItemElement.hasAttribute('unselected')) {
                    resItemElement.setAttribute('aria-selected', false);
                }
                else {
                    resItemElement.setAttribute('aria-selected', true);
                }
            }

            //Set the backgroundColor var for the item
            if (resItem.backgroundColor) {
                resItemElement.style.setProperty('--smart-scheduler-legend-item-background', resItem.backgroundColor);
            }
            else {
                resItemElement.style.removeProperty('--smart-scheduler-legend-item-background');
            }

            if (!resourceItemsContainer.contains(resItemElement)) {
                resourceItemsContainer.appendChild(resItemElement);
            }
        }

        //Remove unnecessary resource items
        while (resItems.length < resourceItems.length) {
            resourceItemsContainer.lastElementChild.remove();
        }

        that._resizeLegend = () => {
            let totalWidth = 14 * totalLength * 0.52;

            const children = [...resourceItemsContainer.querySelectorAll('.smart-scheduler-legend-res-item')];

            children.forEach((item) => {
                item.classList.remove('smart-hidden');
            });

            if (this.legendLayout === 'auto') {
                if (totalWidth > that.offsetWidth) {
                    resourceItemsContainer.querySelectorAll('span').forEach((element) => {
                        element.classList.add('smart-hidden');
                    });

                    if (that.offsetWidth < 550 || children.length > that.legendLayoutMenuBreakpoint) {
                        children.forEach((item) => {
                            item.classList.add('smart-hidden');
                        });

                        if (that._legendList.parentElement && that._legendList.parentElement.parentElement) {
                            that._legendList.close();
                        }
                        that._legendList.classList.remove('smart-hidden');
                    }
                    else {
                        if (that._legendList.parentElement && that._legendList.parentElement.parentElement) {
                            that._legendList.close();
                        }
                        that._legendList.classList.add('smart-hidden');
                    }
                }
                else {
                    if (that._legendList.parentElement && that._legendList.parentElement.parentElement) {
                        that._legendList.close();
                    }
                    that._legendList.classList.add('smart-hidden');
                    resourceItemsContainer.querySelectorAll('span').forEach((element) => {
                        element.classList.remove('smart-hidden');
                    })
                }
            }
            else if (this.legendLayout === '') {
                if (that._legendList.parentElement && that._legendList.parentElement.parentElement) {
                    that._legendList.close();
                }
                that._legendList.classList.add('smart-hidden');
                resourceItemsContainer.querySelectorAll('span').forEach((element) => {
                    element.classList.remove('smart-hidden');
                })
            }
            else if (this.legendLayout === 'menu') {
                resourceItemsContainer.querySelectorAll('span').forEach((element) => {
                    element.classList.add('smart-hidden');
                });
                children.forEach((item) => {
                    item.classList.add('smart-hidden');
                });

                if (that._legendList.parentElement && that._legendList.parentElement.parentElement) {
                    that._legendList.close();
                }
                that._legendList.classList.remove('smart-hidden');
            }
        }


        // create legend list

        const createLegendList = () => {
            const list = document.createElement('smart-check-input');
            list.classList.add('smart-scheduler-legend-list');
            list.dataSource = resItems.map((item) => {
                const label = item.label;
                const value = '' + item.id;

                return {
                    label: label,
                    color: item.backgroundColor,
                    value: value
                }
            });

            list.readonly = true;
            if (list.dataSource.length > 10) {
                list.dropDownHeight = 200;
            }
            else {
                list.dropDownHeight = 'auto';
            }
            list.dropDownOpenPosition = 'auto';
            list.dropDownButtonPosition = 'none';
            if (list.parentElement) {
                list.checkAll();
            }
            list.onItemClick = (event) => {
                const index = event.detail.index;
                resourceItemsContainer.children[index].click();
            }
            resourceItemsContainer.appendChild(list);
            that._legendList = list;
            list.classList.add('smart-hidden');
        }

        createLegendList();
        that._resizeLegend();
    }

    /**
     * Updates the Date Seletor inside the Header
     */
    _refreshDateSelector() {
        const that = this,
            locale = that.locale,
            dateSelector = that.$.currentDate;

        if (!that.$.header.contains(dateSelector)) {
            return
        }

        let dateCurrent = new Smart.Utilities.DateTime(new Date(that.dateCurrent)).toDate(that.timeZone);

        if (isNaN(dateCurrent.getTime())) {
            dateCurrent = new Date();
        }

        let dateString = '';

        //set the dateCurrent
        if (that.dateSelectorFormatFunction) {
            dateString = that.dateSelectorFormatFunction(dateCurrent) + '';
        }
        else {
            const view = that.viewType.toLowerCase(),
                dayFormat = that.dayFormat,
                monthFormat = that.monthFormat,
                yearFormat = that.yearFormat;

            if (view.indexOf('day') > -1) {
                dateString = new Intl.DateTimeFormat(locale, { day: dayFormat }).format(dateCurrent);
            }
            else if (view.indexOf('week') > -1 || view === 'agenda') {
                let firstDayOfWeek = new Date(dateCurrent);

                if (view !== 'agenda') {
                    firstDayOfWeek.setDate(firstDayOfWeek.getDate() - firstDayOfWeek.getDay() + that.firstDayOfWeek);
                }

                if (that.viewStartDay === 'dateCurrent') {
                    firstDayOfWeek = new Date(dateCurrent);
                }

                let lastDayOfWeek = new Date(firstDayOfWeek);

                lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
                const viewDetails = that.views.find(v => v.value && v.value === that.view) || {};

                if (viewDetails.additionalDays) {
                    let lastDate = new Smart.Utilities.DateTime(firstDayOfWeek);
                    lastDate = lastDate.addDays(6 + viewDetails.additionalDays);
                    lastDayOfWeek = lastDate.toDate();
                }

                dateString = new Intl.DateTimeFormat(locale, { day: dayFormat }).format(firstDayOfWeek);

                if (firstDayOfWeek.getMonth() !== lastDayOfWeek.getMonth()) {
                    dateString += ' ' + new Intl.DateTimeFormat(locale, { month: monthFormat }).format(firstDayOfWeek);
                }

                if (firstDayOfWeek.getFullYear() !== lastDayOfWeek.getFullYear()) {
                    dateString += ' ' + new Intl.DateTimeFormat(locale, { year: yearFormat }).format(firstDayOfWeek);
                }

                dateString += '-' + new Intl.DateTimeFormat(locale, { day: dayFormat }).format(lastDayOfWeek);
                dateCurrent = lastDayOfWeek;
            }

            dateString += ' ' + new Intl.DateTimeFormat(locale, { month: monthFormat }).format(dateCurrent) +
                ' ' + new Intl.DateTimeFormat(locale, { year: yearFormat }).format(dateCurrent);
        }

        dateSelector.innerHTML = dateString;
    }

    /**
     * Updates the View Selector inside the Header
     */
    _refreshViewSelector() {
        const that = this,
            views = that.views,
            viewSelectorType = that.viewSelectorType,
            viewSelectorContainer = that.$.viewSelectorContainer,
            viewItemsContainer = that.$.viewItemsContainer,
            viewItemsButton = that.$.viewItemsButton,
            tooltip = that.$.tooltip,
            areItemsInsideTooltip = tooltip.contains(viewItemsContainer);
        let showWeekendItem = that.$.showWeekendItem;

        if (!that.$.header.contains(viewItemsButton)) {
            return
        }

        //Hide the view selection container
        viewSelectorContainer.classList.add('smart-visibility-hidden');

        viewItemsButton.classList.add('smart-visibility-hidden');
        viewSelectorContainer.classList.remove('no-overflowing');

        //Remove it from the DOM
        viewItemsContainer.remove();

        //Remove the hideWekend item
        if (showWeekendItem) {
            showWeekendItem.remove();
        }

        //Remove unnecessary view items
        while (views.length < viewItemsContainer.children.length) {
            viewItemsContainer.firstElementChild.remove();
        }

        //Add aditional items
        while (views.length > viewItemsContainer.children.length) {
            const viewItem = document.createElement('div');

            viewItem.classList.add('smart-scheduler-item');
            viewItem.setAttribute('role', 'option');
            viewItemsContainer.appendChild(viewItem);
        }

        //Update items content
        const viewItems = viewItemsContainer.children;

        for (let i = 0; i < viewItems.length; i++) {
            const viewItem = viewItems[i],
                viewLabel = views[i];
            let view, shortcutKey;

            if (typeof views[i] === 'string') {
                viewItem.innerHTML = '<div>' + that.localize(view = views[i]) + '</div>';
            }
            else {
                let label = viewLabel.label;

                if (that.messages[that.locale][label.toLowerCase()]) {
                    label = that.localize(label.toLowerCase());
                }

                view = viewLabel.value;
                viewItem.innerHTML = '<div>' + (typeof label === 'string' || !isNaN(label) ? label : that.localize(view)) + '</div>';
                shortcutKey = viewLabel.shortcutKey;
            }

            if (shortcutKey === undefined) {
                shortcutKey = that.localize(view + 'Shortcut');
            }

            if (shortcutKey) {
                viewItem.setAttribute('shortcut-key', that.localize(shortcutKey) || shortcutKey)
            }
            else {
                viewItem.removeAttribute('shortcut-key')
            }

            viewItem.$ = { value: view };
        }

        //Add it back to the DOM
        viewSelectorContainer.appendChild(viewItemsContainer);

        if (that._viewButtons) {
            for (let button in that._viewButtons) {
                that._viewButtons[button].remove();
            }
        }

        const isOverflowing = viewSelectorContainer.offsetWidth - viewItemsContainer.offsetWidth < 0;

        if (viewSelectorType === 'tabs') {
            let prevViewButton, nextViewButton;

            if (areItemsInsideTooltip) {
                tooltip.close();
            }

            if (isOverflowing) {
                //Create the repeat buttons
                if (!that._viewButtons) {
                    prevViewButton = document.createElement('smart-repeat-button');
                    nextViewButton = document.createElement('smart-repeat-button');

                    prevViewButton.classList.add('smart-scheduler-nav');
                    nextViewButton.classList.add('smart-scheduler-nav');

                    prevViewButton.setAttribute('prev', '');
                    nextViewButton.setAttribute('next', '');

                    //Accessibility
                    prevViewButton.setAttribute('aria-label', 'Previous View');
                    nextViewButton.setAttribute('aria-label', 'Next View');

                    that._viewButtons = {
                        prev: prevViewButton,
                        next: nextViewButton
                    }
                }

                prevViewButton = that._viewButtons.prev;
                nextViewButton = that._viewButtons.next;


                viewSelectorContainer.classList.add('no-overflowing');

                viewSelectorContainer.insertBefore(prevViewButton, viewItemsContainer);
                viewSelectorContainer.appendChild(nextViewButton);

                that._scrollToView();
            }

            //Show the view selection container
            viewSelectorContainer.removeAttribute('show-menu');
            viewSelectorContainer.classList.remove('smart-visibility-hidden');
            that._handleViewSelection();
            return;
        }

        delete that._viewButtons;

        if (viewSelectorType === 'menu' || isOverflowing) {
            //Add the additional 'showWeekend' item
            if (that.hideViewMenuCheckableItems) {
                if (showWeekendItem) {
                    showWeekendItem.remove();
                }
            }
            else if (!viewItemsContainer.contains(showWeekendItem)) {
                if (!showWeekendItem) {
                    showWeekendItem = that.$.showWeekendItem = document.createElement('div');
                    showWeekendItem.classList.add('smart-scheduler-item');
                    showWeekendItem.setAttribute('checkable', '');
                    showWeekendItem.setAttribute('separator', '');
                }

                showWeekendItem.innerHTML = '<div>' + that.localize('showWeekends') + '</div>';

                //Update the state of the button
                that._checkHideWekendItem();

                viewItemsContainer.appendChild(showWeekendItem);
            }

            if (areItemsInsideTooltip) {
                tooltip.clear();
                tooltip.appendChild(viewItemsContainer);
            }
            else {
                viewItemsContainer.remove();
            }

            viewSelectorContainer.setAttribute('show-menu', '');
            viewItemsButton.classList.remove('smart-visibility-hidden');
        }
        else {
            viewSelectorContainer.removeAttribute('show-menu');

            if (areItemsInsideTooltip) {
                tooltip.close();
            }
        }

        //Show the view selection container
        viewSelectorContainer.classList.remove('smart-visibility-hidden');

        that._handleViewSelection();
    }

    /**
     * Checks the events for notifications
     */
    _checkNotifications(resetNotifications) {
        const that = this,
            events = that._events,
            toast = that.$.toast;

        if (resetNotifications) {
            if (toast && toast.isCompleted) {
                toast.items.forEach(i => {
                    if (i.classList.contains('smart-scheduler-event-notification')) {
                        toast.closeItem(i);
                    }
                })
            }

            delete that._notificationObj;
            delete that._notificationsInterval;
        }

        clearInterval(that._notificationsInterval);

        if (!events) {
            that._removeToast();
            delete that._notificationsInterval;
            delete that._notificationObj;
            return
        }

        let notificationObj = that._notificationObj;

        if (!notificationObj) {
            notificationObj = that._notificationObj = { events: events.filter(e => Array.isArray(e.notifications)) };
        }

        const notificationEvents = notificationObj.events;

        if (!notificationEvents) {
            that._removeToast();
            delete that._notificationsInterval;
            return
        }

        if (!that._notificationsInterval) {
            that._refreshNotifications();
        }

        that._notificationsInterval = setInterval(that._refreshNotifications.bind(that), that.notificationInterval * 1000);
    }

    /**
     * Removes the Toast from the DOM
     */
    _removeToast() {
        const that = this,
            toast = that.$.toast;

        if (toast) {
            const toastExtended = that.$toast;

            toastExtended.unlisten('open');
            toastExtended.unlisten('close');
            toast.remove();
        }
    }

    /**
     * Adds the Toast to the DOM
     */
    _appendToast() {
        const that = this,
            toast = that.$.toast;

        if (!that.$.container.contains(toast)) {
            const toastExtended = that.$toast;

            toastExtended.listen('open', that._toastVisibilityHandler.bind(that));
            toastExtended.listen('close', that._toastVisibilityHandler.bind(that));

            that.$.container.appendChild(toast);
        }
    }

    /**
     * Handles Toast open/close events
     */
    _toastVisibilityHandler(event) {
        const that = this,
            toast = that.$.toast;

        if (event.target !== toast) {
            return
        }

        event.stopPropagation();

        that.$.fireEvent(event.type === 'open' ? 'notificationOpen' : 'notificationClose', event.detail);
    }

    /**
     * Refreshes the notifications
     */
    _refreshNotifications() {
        const that = this,
            notificationObj = that._notificationObj;

        if (!notificationObj) {
            clearInterval(that._notificationsInterval);
            return
        }

        const notificationEvents = notificationObj.events;
        //Notification time range
        let minTime = new Date();

        minTime.setSeconds(0, 0);
        minTime = minTime.getTime();

        if (notificationObj.time === minTime) {
            return;
        }

        //Stores the time to avoid duplicate notifications
        notificationObj.time = minTime;

        //Get the events with notifications that are in the notification range
        const notifyEvents = that._getNotificationEvents(notificationEvents, minTime);
        let upComingEvents = [];

        //Find all upcoming notifications
        for (let i = 0; i < notifyEvents.length; i++) {
            const e = notifyEvents[i],
                eTimeStart = e.dateStart.getTime(),
                notifications = e.notifications;

            if (Array.isArray(notifications)) {
                notifications.forEach(n => {
                    const interval = (n.interval || 0) * (n.type === 'days' || n.type === 0 ? 1 : 7),
                        time = n.time,
                        date = new Date(eTimeStart - interval * 24 * 60 * 60 * 1000);

                    date.setHours(time[0] % 23, time[1] % 60, 0, 0);

                    if (date.getTime() === minTime) {
                        upComingEvents.push({ dateStart: e.dateStart, label: e.label, message: n.message, iconType: n.iconType });
                    }
                });
            }
        }

        //Show Toast items on upcoming events
        that._notifyForUpcomingEvents(upComingEvents);
    }

    /**
     * Returns the notifications that are in the notification range (0 - 28 days from today)
     * @param {Array<Object>} notificationEvents - events that have notifications
     * @param {number} minTime - start time, today
     */
    _getNotificationEvents(notificationEvents, minTime) {
        const that = this;
        let notifyEvents = [];
        const maxTime = minTime + 28 * 24 * 60 * 60 * 1000,
            rRule = that._rRule,
            repeatingDetails = {
                isMonthView: true,
                hourStart: that.hourStart,
                hourEnd: that.hourEnd,
                restrictedDates: that.restrictedDates,
                restrictedHours: that.restrictedHours,
                dateStart: new Date(minTime),
                dateEnd: new Date(maxTime),
                rRule: rRule,
                targetEvents: notifyEvents
            };

        //Get all events that are in the min/max range
        for (let i = 0; i < notificationEvents.length; i++) {
            const e = notificationEvents[i],
                eventDateStart = e.dateStart,
                eventDateEnd = e.dateEnd;

            if (!eventDateStart || !eventDateEnd) {
                continue;
            }

            const eTimeStart = eventDateStart.getTime(),
                eTimeEnd = eventDateEnd.getTime();

            if (e.repeat && rRule) {
                //Check repeating events and exceptions
                const options = that._getEventRepeatOptions(e);

                // Check for repeating events
                if (options) {
                    repeatingDetails.event = e;
                    repeatingDetails.repeatObj = e.repeat;
                    repeatingDetails.options = options;
                    repeatingDetails.eventTimeStart = eTimeStart;
                    repeatingDetails.eventTimeEnd = eTimeEnd;

                    that._setRepeatingEvents(repeatingDetails);
                    continue;
                }
            }
            else if (eTimeStart >= minTime && eTimeStart <= maxTime) {
                notifyEvents.push(e);
            }
        }

        return notifyEvents
    }

    /**
     * Shows Toast items for each event notification
     * @param {Array<Object>} upComingEvents - upcoming events
     */
    _notifyForUpcomingEvents(upComingEvents) {
        const that = this;

        if (!upComingEvents.length) {
            return
        }

        //Creates the Toast and updates it's common properties
        that._setToast();

        const toast = that.$.toast;

        that._appendToast();

        const dayFormat = that.dayFormat,
            monthFormat = that.monthFormat,
            weekdayFormat = that.weekdayFormat,
            locale = that.locale,
            hourFormat = that.hourFormat,
            minuteFormat = that.minuteFormat,
            dateTime = Smart.Utilities.DateTime,
            timeZone = that.timeZone;

        for (let i = 0; i < upComingEvents.length; i++) {
            const e = upComingEvents[i],
                eDateStart = new dateTime(e.dateStart).toDate(timeZone),
                message = e.message ? e.message : (e.label + ' ' + that.localize('notificationMessage') + ' ' +
                    new Intl.DateTimeFormat(locale,
                        { day: dayFormat, weekday: weekdayFormat, month: monthFormat }).format(eDateStart) + ' at ' +
                    new Intl.DateTimeFormat(locale, { hour: hourFormat, minute: minuteFormat }).format(eDateStart));

            toast.open(message, e.iconType);
        }
    }

    /**
     * Sets the Toast element for notifications
     */
    _setToast() {
        const that = this;
        let toast = that.$.toast;

        if (!toast) {
            that.$.toast = toast = document.createElement('smart-toast');
            toast.appendTo = that.$.timeline;
            toast.showCloseButton = true;
            toast.itemClass = 'smart-scheduler-event-notification';
            that.$toast = Smart.Utilities.Extend(toast);
        }

        toast.rightToLeft = that.rightToLeft;
        toast.theme = that.theme;
        toast.animation = that.animation;
    }

    /**
     * Creates the Sheduler events
     */
    _createEvents(dataSource, timeZone) {
        const that = this;
        let customEventsList = dataSource !== undefined;

        if (!customEventsList) {
            dataSource = that.dataSource;
            that._clearEvents();
        }

        if (that.dataSource instanceof Smart.DataAdapter) {
            dataSource = that.dataSource.dataSourceType === 'ics' ? that.dataSource.dataSource : that.dataSource.toArray();
        }

        if (!Array.isArray(dataSource) || !dataSource.length) {
            return;
        }

        //Find the timeZone offset
        const viewType = that.viewType;
        let events = [];
        let noDateEvents = [];

        for (let i = 0; i < dataSource.length; i++) {
            const eventData = dataSource[i];

            if (!eventData) {
                continue
            }

            let allDay = eventData.allDay, dateStart, dateEnd;

            if (typeof allDay === 'string') {
                allDay = allDay === 'true';
            }

            allDay = !!allDay;

            if (!eventData.dateStart && !eventData.dateEnd) {
                const event = Object.assign({}, eventData, {
                    dateStart: null,
                    dateEnd: null,
                    allDay: allDay,
                    label: eventData.label || ''
                });
                noDateEvents.push(event);
                continue;
            }
            dateStart = that._dateValidator(undefined, eventData.dateStart);
            dateEnd = that._dateValidator(undefined, eventData.dateEnd);

            if (!dateStart || !dateStart.getTime()) {
                continue;
            }

            if (!dateEnd || !dateEnd.getTime()) {
                dateEnd = new Date(dateStart);
                dateEnd.setHours(dateEnd.getHours(), dateEnd.getMinutes() + (60 / that._getCellsScaleCount()), 0, 0);
            }

            dateEnd = new Date(Math.max(dateStart.getTime(), dateEnd.getTime()));

            switch (viewType) {
                case 'week':
                case 'day':
                case 'timelineWeek':
                case 'timelineDay': {
                    if (allDay) {
                        dateEnd.setHours(23, 59, 59, 999);
                    }
                    break;
                }
                default:
                    //NOTE: when allDay is true and no time is set, keep the dateEnd in the same day as the dateStart
                    if (allDay && dateEnd.getHours() === 0 && dateEnd.getMinutes() === 0 && dateEnd.getSeconds() === 0 && dateEnd.getMilliseconds() === 0) {
                        //        dateEnd = new Date(dateEnd.getTime() - 1);
                        dateEnd.setHours(23, 59, 59, 999);
                    }
                    break;
            }

            //Create an event
            const event = Object.assign({}, eventData, {
                dateStart: dateStart,
                dateEnd: dateEnd,
                allDay: allDay,
                label: eventData.label || ''
            });

            // delete event.$;

            //Validate repeat params
            let repeatSettings = event.repeat;

            if (repeatSettings) {
                repeatSettings = event.repeat = Object.assign({}, repeatSettings);

                const repeatFreq = ['hourly', 'daily', 'weekly', 'monthly', 'yearly'];

                for (let p in repeatSettings) {
                    if (p === 'repeatFreq' && repeatFreq.indexOf(repeatSettings[p]) < 0) {
                        repeatSettings[p] = repeatFreq[0];
                    }
                    else if (p === 'repeatInterval') {
                        repeatSettings[p] = !isNaN(repeatSettings[p]) ? repeatSettings[p] : 1;
                    }
                    else if (p === 'exceptions') {
                        let exceptions = repeatSettings[p];

                        if (!Array.isArray(exceptions)) {
                            exceptions = [exceptions];
                        }
                        else {
                            exceptions = exceptions.slice();
                        }

                        for (let i = 0; i < exceptions.length; i++) {
                            let exception = exceptions[i];

                            if (exception.date === undefined) {
                                exception = {
                                    date: that._parseDate(exception)
                                }
                            }
                            else {
                                exception = Object.assign({}, exception);

                                if (!exception.date) {
                                    exception.date = new Date(exception.dateStart);
                                }
                                else if (!(exception.date instanceof Date)) {
                                    exception.date = that._parseDate(exception.date);
                                }
                            }


                            if (!exception.dateStart) {
                                exception.dateStart = new Date(exception.date);
                            }
                            else if (!(exception.dateStart instanceof Date)) {
                                exception.dateStart = that._parseDate(exception.dateStart);
                            }

                            if (!exception.dateEnd) {
                                exception.dateEnd = new Date(exception.dateStart.getTime() + event.dateEnd.getTime() - event.dateStart.getTime());
                            }
                            else if (!(exception.dateEnd instanceof Date)) {
                                exception.dateEnd = that._parseDate(exception.dateEnd);
                            }

                            delete exception.$;
                            exceptions[i] = exception;
                        }

                        if (exceptions) {
                            repeatSettings[p] = exceptions;
                        }
                    }
                }
            }


            if (!that._containsEvent(event)) {
                that._setEventTimeZone(event, timeZone);
                events.push(event);
            }
        }

        //Return the custom events list
        if (customEventsList) {
            return events;
        }

        //Clear old notifications
        that._removeToast();
        delete that._notificationsInterval;
        delete that._notificationObj;

        that._events = events;
        that._noDateEvents = noDateEvents;
    }

    _setEventTimeZone(eventObj, oldTimeZone = 'local') {
        const that = this,
            dateTime = Smart.Utilities.DateTime,
            timeZones = new dateTime().timeZones,
            timeZone = that.timeZone.toLowerCase(),
            currentTimeZone = (oldTimeZone || that.timeZone).toLowerCase();

        if (!eventObj || !eventObj.dateStart || !eventObj.dateEnd) {
            return
        }

        if (oldTimeZone && timeZone === currentTimeZone) {
            return
        }

        const timeZoneDetails = timeZones.find(tz => tz.id.toLowerCase() === timeZone);

        if (!timeZoneDetails) {
            return
        }

        let currentTimeZoneDetails = timeZones.find(tz => tz.id.toLowerCase() === currentTimeZone),
            dateStart = new Date(eventObj.dateStart),
            dateEnd = new Date(eventObj.dateEnd);
        const localTimeZoneDetails = timeZones.find(tz => tz.id.toLowerCase() === 'local');

        if (!currentTimeZoneDetails) {
            currentTimeZoneDetails = localTimeZoneDetails;
        }

        const localTimeZoneOffset = localTimeZoneDetails.offset,
            dateStartDSTOffset = (-1 * dateStart.getTimezoneOffset() - localTimeZoneDetails.offset) * 60 * 1000,
            dateEndDSTOffset = (-1 * dateEnd.getTimezoneOffset() - localTimeZoneDetails.offset) * 60 * 1000,
            currentTimeZoneOffset = (currentTimeZoneDetails.offset) * 60 * 1000,
            timeZoneOffset = timeZoneDetails.offset * 60 * 1000;

        if (!eventObj.allDay) {
            eventObj.dateStart = new Date(dateStart.getTime() - dateStartDSTOffset - currentTimeZoneOffset + timeZoneOffset);
            eventObj.dateEnd = new Date(dateEnd.getTime() - dateEndDSTOffset - currentTimeZoneOffset + timeZoneOffset);
        }

        if (eventObj.repeat && eventObj.repeat.exceptions) {
            const exceptions = eventObj.repeat.exceptions;

            for (let i = 0; i < exceptions.length; i++) {
                const exception = exceptions[i];

                if (exception.allDay) {
                    continue;
                }

                const exceptionDateDSTOffset = (-1 * exception.date.getTimezoneOffset() - localTimeZoneOffset) * 60 * 1000,
                    exceptionDateStartDSTOffset = (-1 * exception.dateStart.getTimezoneOffset() - localTimeZoneOffset) * 60 * 1000,
                    exceptionDateEndDSTOffset = (-1 * exception.dateEnd.getTimezoneOffset() - localTimeZoneOffset) * 60 * 1000;

                exception.date = new Date(exception.date.getTime() - exceptionDateDSTOffset - currentTimeZoneOffset + timeZoneOffset);
                exception.dateStart = new Date(exception.dateStart.getTime() - exceptionDateStartDSTOffset - currentTimeZoneOffset + timeZoneOffset);
                exception.dateEnd = new Date(exception.dateEnd.getTime() - exceptionDateEndDSTOffset - currentTimeZoneOffset + timeZoneOffset);
            }
        }
    }

    /**
     * Clears the Events from the Scheduler
     */
    _clearEvents() {
        const that = this;

        that._events = [];

        if (that._eventList) {
            that._eventList.innerHTML = null;
        }

        //Clear the events from the DOM
        that.$.timelineEventsContainer.innerHTML = '';
        that.$.allDayEventsContainer.innerHTML = '';

        //Deletes the cached events between dates
        delete that._eventsBetween;

        if (!that.rendered) {
            return;
        }

        that._refreshTimelineEvents();
    }

    /**
     * Inserts the events into the Timeline
     */
    _refreshEvents() {
        const that = this,
            events = that._events,
            eventsContainer = that.$.timelineEventsContainer,
            allDayEventsContainer = that.$.allDayEventsContainer,
            timelineCellObjs = that._timelineCells;

        if (!events || !timelineCellObjs.horizontal || !timelineCellObjs.horizontal.length ||
            !timelineCellObjs.vertical || !timelineCellObjs.vertical.length) {
            eventsContainer.innerHTML = '';
            allDayEventsContainer.innerHTML = '';
            delete that._eventsBetween;
            return
        }

        //Caches the timeline events and their cell objs for better performance
        let eventCellDetails = that._eventsBetween ? that._eventsBetween.eventCellDetails : undefined,
            eventCells = [], viewEventDetails = {};
        const view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            maxEventsPerCell = viewDetails ? parseFloat(viewDetails.maxEventsPerCell) : NaN;

        if (!isNaN(maxEventsPerCell)) {
            viewEventDetails.maxEventsPerCell = maxEventsPerCell;
        }
        else if (that.maxEventsPerCell !== null) {
            viewEventDetails.maxEventsPerCell = that.maxEventsPerCell;
        }

        //Refreshes the events based on the cached object, if available
        if (eventCellDetails) {
            const eventGroups = eventCellDetails.eventGroups,
                eventRanges = eventCellDetails.cellRanges,
                allDayEventGroups = eventCellDetails.allDayEventGroups,
                allDayEventCellRanges = eventCellDetails.allDayEventCellRanges;

            //Create non-allday events
            for (let i = 0; i < eventGroups.length; i++) {
                viewEventDetails.events = eventGroups[i];
                viewEventDetails.eventCells = eventRanges[i];
                eventCells = eventCells.concat(that._createTimelineEvents(viewEventDetails));
            }

            //Create all allDay events
            for (let i = 0; i < allDayEventGroups.length; i++) {
                viewEventDetails.events = allDayEventGroups[i];
                viewEventDetails.eventCells = allDayEventCellRanges[i];
                viewEventDetails.isAllDay = true;
                eventCells = eventCells.concat(that._createTimelineEvents(viewEventDetails));
            }
        }
        else {
            //Creates the timeline events and returns them
            eventCells = that._createViewEvents();
        }

        //Does not remove any event cells while resizing
        if (that.hasAttribute('resized')) {
            return
        }

        //Remove the unused event cells from the DOM
        const currentEventCells = Array.from(eventsContainer.children).concat(Array.from(allDayEventsContainer.children)),
            eventList = that._eventList;

        if (Array.from(eventsContainer.children).length === 0) {
            eventsContainer.setAttribute('role', 'presentation');
        }
        else {
            eventsContainer.setAttribute('role', 'row');
        }

        if (Array.from(allDayEventsContainer.children).length === 0) {
            allDayEventsContainer.setAttribute('role', 'presentation');
        }
        else {
            allDayEventsContainer.setAttribute('role', 'row');
        }

        for (let i = 0; i < currentEventCells.length; i++) {
            const cell = currentEventCells[i];

            if (eventCells.indexOf(cell) < 0) {
                cell.remove();

                //Remove all event cells from the corresponding event context menu
                if (eventList && eventList._target === cell) {
                    eventList.innerHTML = '';
                    delete eventList._target;
                }
            }
        }

        that._refreshViewList();
        that._handleEventCut();
    }

    /**
     * Creates the timeline Events
     */
    _createViewEvents() {
        const that = this,
            events = that._events,
            groups = that._timelineCells.groups,
            newEvents = that._getViewEvents();
        let eventCells = [];
        const collectors = that.$.timeline.querySelectorAll('.smart-scheduler-event[collector]');

        //Clear the collectors of old event objects
        for (let i = 0; i < collectors.length; i++) {
            if (collectors[i].$) {
                collectors[i].$.events = collectors[i].$.events.reduce((acc, e) => {
                    if (events.indexOf(e) > -1) {
                        acc.push(e)
                    }
                    return acc
                }, []);
            }
        }

        if (groups && groups.length > 0) {
            eventCells = that._createGroupedEvents(newEvents, groups);
        }
        else {
            eventCells = that._createNonGroupedEvents(newEvents);
        }

        return eventCells
    }

    /**
     * Creates the events when no grouping is enabled
     * @param {Array<Object>} newEvents - all events to be displayed
     */
    _createNonGroupedEvents(newEvents) {
        const that = this;
        //Caches the events and their cellObjs for faster scrolling
        let eventCells = [], viewEventDetails = {};

        //Caches the events and their cellObjs for faster scrolling
        const eventCellDetails = { eventGroups: [], cellRanges: [], allDayEventGroups: [], allDayEventCellRanges: [] };

        const view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            maxEventsPerCell = viewDetails ? parseFloat(viewDetails.maxEventsPerCell) : NaN;

        if (!isNaN(maxEventsPerCell)) {
            viewEventDetails.maxEventsPerCell = maxEventsPerCell;
        }
        else if (that.maxEventsPerCell !== null) {
            viewEventDetails.maxEventsPerCell = that.maxEventsPerCell;
        }

        //Used by Agenda view to store vCells that already have been used for a perticular event.
        //NOTE: In Agenda view the vertical cells have duplicates
        let usedTimelineCells = [];

        const eventCellRanges = that._getTimelineEventCells(newEvents, usedTimelineCells);

        //Separates the allDay events from the non-allDay events
        const viewEvents = that._separateAllDayEvents(newEvents, eventCellRanges);

        //Create all non-allday events
        if (viewEvents.events.length) {
            viewEventDetails.events = viewEvents.events;
            viewEventDetails.eventCells = viewEvents.eventCells;

            eventCellDetails.eventGroups.push(viewEvents.events);
            eventCellDetails.cellRanges.push(viewEvents.eventCells);
            eventCells = eventCells.concat(that._createTimelineEvents(viewEventDetails));
        }

        //Create all allDay events
        if (viewEvents.allDayEvents.length) {
            viewEventDetails.events = viewEvents.allDayEvents;
            viewEventDetails.eventCells = viewEvents.allDayEventCells;
            viewEventDetails.isAllDay = true;

            eventCellDetails.allDayEventGroups.push(viewEvents.allDayEvents);
            eventCellDetails.allDayEventCellRanges.push(viewEvents.allDayEventCells)
            eventCells = eventCells.concat(that._createTimelineEvents(viewEventDetails));
        }

        //Cache the events and their cell objects to speed up scrolling
        that._eventsBetween.eventCellDetails = eventCellDetails;

        return eventCells
    }

    /**
     * Creates the events when grouping is enabled
     * @param {Array<Object>} newEvents - all events to be displayed
     * @param {Array<Object>} groups - all groups
     */
    _createGroupedEvents(newEvents, groups) {
        const that = this;

        //Caches the events and their cellObjs for faster scrolling
        let eventCells = [], viewEventDetails = {};

        const view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            maxEventsPerCell = viewDetails ? parseFloat(viewDetails.maxEventsPerCell) : NaN;

        if (!isNaN(maxEventsPerCell)) {
            viewEventDetails.maxEventsPerCell = maxEventsPerCell;
        }
        else if (that.maxEventsPerCell !== null) {
            viewEventDetails.maxEventsPerCell = that.maxEventsPerCell;
        }

        //Caches the events and their cellObjs for faster scrolling
        const eventCellDetails = { eventGroups: [], cellRanges: [], allDayEventGroups: [], allDayEventCellRanges: [] };

        //Used by Agenda view to store vCells that already have been used for a perticular event.
        //NOTE: In Agenda view the vertical cells have duplicates
        let usedTimelineCells = [];

        const groupCells = groups[groups.length - 1].cells;
        let allDayEventDetails = { events: [], eventCells: [] };

        for (let i = 0; i < groupCells.length; i++) {
            const groupEvents = newEvents.filter(e => that._isEventPartOfGroup(e, groupCells[i])),
                eventCellRanges = that._getTimelineEventCells(groupEvents, usedTimelineCells);

            //Separates the allDay events from the non-allDay events
            const viewEvents = that._separateAllDayEvents(groupEvents, eventCellRanges);

            //Gather all allDay events and their cells
            allDayEventDetails.events = allDayEventDetails.events.concat(viewEvents.allDayEvents);
            allDayEventDetails.eventCells = allDayEventDetails.eventCells.concat(viewEvents.allDayEventCells);

            //Create non-allday events
            if (viewEvents.events.length) {
                viewEventDetails.events = viewEvents.events;
                viewEventDetails.eventCells = viewEvents.eventCells;

                eventCellDetails.eventGroups.push(viewEvents.events);
                eventCellDetails.cellRanges.push(viewEvents.eventCells);
                eventCells = eventCells.concat(that._createTimelineEvents(viewEventDetails));
            }
        }

        const originalEventOrder = allDayEventDetails.events.slice();

        //Sorts the events from earliest to latest
        that._sortEventCellObjs(allDayEventDetails.events, ['day', 'week'].indexOf(that.viewType) > -1);

        //Update the event cells with the new event order
        allDayEventDetails.eventCells = allDayEventDetails.events.map(e => {
            return allDayEventDetails.eventCells[originalEventOrder.indexOf(e)]
        })

        //Create all allDay events for 'day' or 'week' view
        for (let i = 0; i < allDayEventDetails.events.length; i++) {
            viewEventDetails.events = allDayEventDetails.events;
            viewEventDetails.eventCells = allDayEventDetails.eventCells;
            viewEventDetails.isAllDay = true;

            eventCellDetails.allDayEventGroups.push(allDayEventDetails.events);
            eventCellDetails.allDayEventCellRanges.push(allDayEventDetails.eventCells)
            eventCells = eventCells.concat(that._createTimelineEvents(viewEventDetails));
        }

        //Cache the events and their cell objects to speed up scrolling
        that._eventsBetween.eventCellDetails = eventCellDetails;

        return eventCells
    }

    /**
     * Separates the allDay events from the non-allDay events and returns them
     * @param {*} events - events
     * @param {*} eventCells - events cellObjs representing the cells that they will occupy
     */
    _separateAllDayEvents(events, eventCells) {
        const that = this,
            dayDuration = 24 * 60 * 60 * 1000;
        let [allDayEvents, allDayEventCells, viewEvents, viewEventCells] = [[], [], [], []];

        if (['day', 'week'].indexOf(that.viewType) < 0) {
            viewEvents = events;
            viewEventCells = eventCells;
        }
        else {
            //Separate AllDay events from other events only in 'day' or 'week' view
            for (let i = 0; i < events.length; i++) {
                const eventObj = events[i];

                //All day event
                if (eventObj.allDay || eventObj.dateEnd.getTime() - eventObj.dateStart.getTime() >= dayDuration) {
                    allDayEvents.push(eventObj);
                    allDayEventCells.push(eventCells[i])
                }
                else {
                    viewEvents.push(eventObj);
                    viewEventCells.push(eventCells[i]);
                }
            }
        }

        return { allDayEvents: allDayEvents, allDayEventCells: allDayEventCells, events: viewEvents, eventCells: viewEventCells }
    }

    /**
     * Returns the events for the current view
     */
    _getViewEvents() {
        const that = this,
            viewType = that.viewType.toLowerCase(),
            currentDate = that.dateCurrent,
            firstDayOfWeek = that.firstDayOfWeek;
        let fromDate = new Date(currentDate),
            toDate = new Date(currentDate);

        if (viewType === 'agenda') {
            fromDate.setHours(0, 0, 0, 0);
            toDate.setDate(toDate.getDate() + 6);
            toDate.setHours(23, 59, 59, 999);
        }
        else if (viewType.indexOf('month') > -1) {
            //Set the date to the first day of the week
            fromDate.setDate(1);

            if (that.hideOtherMonthDays) {
                fromDate.setHours(0, 0, 0, 0);
                toDate = new Date(fromDate);
                toDate.setDate(32);
                toDate.setDate(0);
                toDate.setHours(23, 59, 59, 999);
            }
            else {
                fromDate.setDate(fromDate.getDate() - (fromDate.getDay() - firstDayOfWeek + 7) % 7);
                fromDate.setHours(0, 0, 0, 0);
                toDate = new Date(fromDate);

                //Fast forward 6 weeks because month view = 6 weeks
                for (let i = 0; i < 5; i++) {
                    toDate.setDate(toDate.getDate() + 7);
                }

                //Set the date to the last day of the week
                toDate.setDate(toDate.getDate() + 6);
                toDate.setHours(23, 59, 59, 999);
            }
        }
        else if (viewType.indexOf('week') > -1) {
            if (that.viewStartDay !== 'dateCurrent') {
                fromDate.setDate(fromDate.getDate() - fromDate.getDay() + firstDayOfWeek);
            }

            toDate.setDate(fromDate.getDate() + 6);
            fromDate.setHours(0, 0, 0, 0);
            const viewDetails = that.views.find(v => v.value && v.value === that.view) || {};
            if (viewDetails.additionalDays) {
                let lastDate = new Smart.Utilities.DateTime(fromDate);

                lastDate = lastDate.addDays(6 + viewDetails.additionalDays);
                toDate = lastDate.toDate();
            }

            toDate.setHours(23, 59, 59, 999);
        }
        else if (viewType.indexOf('day') > -1) {
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);
        }

        return that._getEventsBetween(fromDate, toDate)
    }

    /**
     * Refereshes the timeline events
     */
    _refreshTimelineEvents() {
        const that = this;

        //Deletes the cached events between dates
        delete that._eventsBetween;

        //Referesh the timeline events
        if (that.viewType === 'agenda') {
            that._createTimeline();
        }
        else {
            that._refreshEvents();
            that._checkNotifications(true);
        }
    }

    /**
     * Returns the cell ranges that will be used by each event object
     * @param {Object} eventObj - event object
     * @param {Array<Object>} usedTimelineCells - array of cells that have been used for the events
     * @param {Boolean} isAllDayEvent - indicates whether the event is for the allDayContainer in the day/week basic views
     */
    _getTimelineEventCells(events, usedTimelineCells) {
        const that = this,
            isAllDayView = ['day', 'week'].indexOf(that.viewType) > -1,
            dayDuration = 24 * 60 * 60 * 1000,
            hideAllDay = that.hideAllDay;

        let eventTimelineCells = [];

        for (let i = 0; i < events.length; i++) {
            const eventObj = events[i];
            let eventViewCells = [], isAllDayEvent;

            if (isAllDayView && (eventObj.allDay || eventObj.dateEnd.getTime() - eventObj.dateStart.getTime() >= dayDuration)) {
                //All day event
                isAllDayEvent = true;
            }

            if (eventObj.hidden || isAllDayEvent && hideAllDay) {
                //Remove the event cells
                eventTimelineCells.push(eventViewCells);
                continue
            }

            //Gets all cells that will be used by the event
            eventViewCells = that._getEventTimelineCells(eventObj, usedTimelineCells, isAllDayEvent);

            //Gets the cell ranges for the event
            eventTimelineCells.push(that._getEventTimelineCellRanges(eventViewCells, isAllDayEvent));
        }

        return eventTimelineCells
    }

    /**
     * Creates the event cells and adds them to the Scheduler
     * @param {Array<Object>} events - event objects
     * @param {Object} eventCells - timeline cells that the events will use
     */
    _createTimelineEvents(viewEventDetails) {
        const that = this,
            events = viewEventDetails.events,
            eventCells = viewEventDetails.eventCells,
            isAllDay = viewEventDetails.isAllDay,
            viewType = that.viewType,
            view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            eventRenderMode = that.eventRenderMode,
            maxEventsPerCell = viewEventDetails.maxEventsPerCell,
            collectorSize = eventRenderMode === 'classic' ? (viewType === 'month' ? that._monthViewNumberSize : 0) : that._eventCollectorSize,
            isDayOrWeekView = ['day', 'week'].indexOf(viewType) > -1,
            cellSize = that._getCellSize(),
            maxEventSize = cellSize[isDayOrWeekView ? 'width' : 'height'] - collectorSize,
            eventSize = maxEventsPerCell !== undefined ? maxEventSize / maxEventsPerCell : Math.min(maxEventSize, that._eventSize);

        //Stores the common parameters for the events
        let eventDetails = {
            events: events,
            eventCells: eventCells,
            viewType: viewType,
            viewDetails: viewDetails,
            isAllDayEvent: isAllDay,
            isMobile: that.$.timeline.hasAttribute('mobile'),
            isDayOrWeekView: isDayOrWeekView,
            rightToLeft: that.rightToLeft,
            eventRenderMode: eventRenderMode,
            eventSize: eventSize,
            collectorSize: collectorSize,
            usedEventCells: [],
            eventIndexes: [],
            maxEventsPerCell: maxEventsPerCell
        };

        //Handles allDay events
        if (isAllDay) {
            eventDetails.cellSize = { height: that._allDayCellSize, width: cellSize.width };
            eventDetails.spaceAvailable = that._allDayCellSize - collectorSize;
            eventDetails.currentEvents = that.$.allDayEventsContainer.children;

            if (maxEventsPerCell !== undefined) {
                eventDetails.eventSize = eventDetails.spaceAvailable / maxEventsPerCell;
            }

            that._setVerticalTimelineEvents(eventDetails);
            that._allDayEventDetails = eventDetails;
        }
        else {
            eventDetails.cellSize = cellSize;
            eventDetails.spaceAvailable = maxEventSize;
            eventDetails.currentEvents = that.$.timelineEventsContainer.children;

            if (isDayOrWeekView) {
                that._setHorizontalTimelineEvents(eventDetails);
                that._dayOrWeekEventDetails = eventDetails;
            }
            else {
                that._setVerticalTimelineEvents(eventDetails);
                that._eventDetails = eventDetails;
            }
        }

        return eventDetails.usedEventCells
    }

    /**
     * Sets the horizontal event cells
     * @param {Object} eventDetails - event details
     */
    _setHorizontalTimelineEvents(eventDetails) {
        const that = this,
            events = eventDetails.events,
            eventCells = eventDetails.eventCells,
            eventRenderMode = eventDetails.eventRenderMode;

        if (eventRenderMode === 'modern' && eventDetails.isMobile) {
            return that._setAgendaOrMobileEvents(eventDetails);
        }

        const eventIndexes = eventDetails.eventIndexes,
            spaceAvailable = eventDetails.spaceAvailable,
            minEventSize = eventRenderMode === 'classic' ? 1 :
                (eventDetails.maxEventsPerCell !== undefined ? eventDetails.eventSize : that._eventSize),
            [scrollTop, scrollLeft] = [that.scrollTop, that.scrollLeft],
            [scrollBottom, scrollRight] = [scrollTop + that._scrollViewSize.height, scrollLeft + that._scrollViewSize.width],
            //Find the collision count, overlapping events and their indexes
            collisionDetails = that._getEventsCollisionIndexes(eventDetails),
            eventOverlaps = collisionDetails.eventOverlaps,
            eventCollisionsCount = collisionDetails.eventCollisionsCount;

        for (let i = 0; i < events.length; i++) {
            const cellRanges = eventCells[i],
                event = events[i];
            let eventsInCollision = eventCollisionsCount[i];

            // Set the event cells
            for (let r = 0; r < cellRanges.length; r++) {
                const cellRange = cellRanges[r],
                    firstCell = cellRange[0];

                if (!firstCell) {
                    continue
                }

                const lastCell = cellRange[cellRange.length - 1],
                    [firstVCell, lastVCell] = [firstCell.vertical, lastCell.vertical],
                    [firstHCell, lastHCell] = [firstCell.horizontal, lastCell.horizontal];

                //Create the event cell if visible
                if (lastVCell.top + lastVCell.height < scrollTop || firstVCell.top > scrollBottom ||
                    lastHCell.left + lastHCell.width < scrollLeft || firstHCell.left > scrollRight) {
                    continue
                }

                const eventIndex = eventIndexes[i],
                    eventCollisions = eventOverlaps.filter(e => e.indexOf(event) > -1);

                // Get the biggest collision
                for (let c = 0; c < eventCollisions.length; c++) {
                    const maxCollision = eventCollisions[c].reduce((acc, value) => acc = Math.max(acc, eventCollisionsCount[events.indexOf(value)] || 1), 1);
                    eventsInCollision = Math.max(eventsInCollision, maxCollision);
                }

                if (eventRenderMode === 'modern') {
                    eventsInCollision = Math.min(Math.floor(spaceAvailable / minEventSize), eventsInCollision);
                }

                //Make the event fit the whole space when last item and space is available
                let eventSpanCoeff = 1;

                for (let i = eventIndex + 1; i < eventsInCollision; i++) {
                    if (!eventCollisions.every(collision => collision.map(c => eventIndexes[events.indexOf(c)]).indexOf(i) < 0)) {
                        break;
                    }
                    eventSpanCoeff++;
                }

                eventDetails.eventObj = event;
                eventDetails.cellEventsCount = eventsInCollision;
                eventDetails.cellRange = cellRange;
                eventDetails.eventIndex = eventIndex;
                eventDetails.eventSize = (spaceAvailable / eventsInCollision) * eventSpanCoeff;

                if (eventRenderMode === 'modern' && (eventIndex + 1) * minEventSize > spaceAvailable) {
                    that._addEventToCollector(eventDetails);
                }
                else {
                    that._setEventCell(eventDetails);
                }
            }
        }

        return eventDetails.usedEventCells
    }

    /**
     * Checks all leaf events for collisions and returns them all
     * @param {*} eventOverlaps
     * @param {*} allEventCollisions
     * @param {*} colls
     */
    _getAllEventCollisions(eventOverlaps, allEventCollisions, colls) {
        const that = this;

        if (!colls) {
            colls = allEventCollisions;
        }

        for (let i = 0; i < colls.length; i++) {
            let leafColls = eventOverlaps.filter(e => colls[i].some(colEvent => e.indexOf(colEvent) > -1) && allEventCollisions.indexOf(e) < 0);

            if (leafColls.length) {
                allEventCollisions = that._getAllEventCollisions(eventOverlaps, allEventCollisions.concat(leafColls), leafColls);
            }
        }

        return allEventCollisions
    }

    /**
     * Returns details about the event indexes, event collisions, collision count. Important when creating event cells
     * @param {*} eventDetails - event details
     * @param {*} orientation - detemines whether it's for horizontal or vertical event cells
     */
    _getEventsCollisionIndexes(eventDetails) {
        const that = this,
            events = eventDetails.events,
            eventCells = eventDetails.eventCells,
            eventIndexes = eventDetails.eventIndexes;
        let eventOverlaps = [],
            eventCollisionsCount = [],
            collisionsCount = 0;

        //Find the collision count for each event, overlapping events and their indexes
        for (let i = 0; i < events.length; i++) {
            const event = events[i];

            if (!eventCells[i].length) {
                continue;
            }

            eventDetails.eventObj = event;

            const collisionEvents = that._getEventsInCollision(eventDetails);
            let allEventCollisions = eventOverlaps.filter(e => collisionEvents.some(colEvent => e.indexOf(colEvent) > -1));

            eventCollisionsCount[i] = collisionEvents.length;

            if (allEventCollisions.length) {
                //Check the leaf collisions
                if (collisionsCount !== eventCollisionsCount[i]) {
                    allEventCollisions = that._getAllEventCollisions(eventOverlaps, allEventCollisions);
                }

                allEventCollisions.sort((a, b) => b.length - a.length);

                let eventsInCollision = Math.max(collisionEvents.length, allEventCollisions[0].length);

                allEventCollisions.forEach(c => c.forEach(e => {
                    const eventIndex = events.indexOf(e);

                    eventCollisionsCount[eventIndex] = Math.max(eventCollisionsCount[eventIndex] || 0, eventsInCollision);
                }));
            }

            collisionsCount = Math.max(collisionsCount, eventCollisionsCount[i]);

            eventOverlaps[i] = collisionEvents;
            eventIndexes[i] = collisionEvents.indexOf(event);
        }

        return { eventOverlaps: eventOverlaps, eventCollisionsCount: eventCollisionsCount }
    }

    /**
     * Returns the events that are in collision
     * @param {Object} eventDetails - object with event details
     */
    _getEventsInCollision(eventDetails) {
        const that = this,
            eventCellDetails = that._getEventCellDetails(eventDetails),
            eventCellStartTime = eventCellDetails.eventCellStartTime,
            eventCellEndTime = eventCellDetails.eventCellEndTime,
            hCellGroup = eventCellDetails.hCellGroup,
            vCellGroup = eventCellDetails.vCellGroup,
            cellGroup = eventDetails.isDayOrWeekView && vCellGroup !== undefined ? undefined : (vCellGroup || hCellGroup);
        let events = eventDetails.events,
            cellEvents = [],
            collisionEvents = [];

        for (let i = 0; i < events.length; i++) {
            const e = events[i];

            if (cellGroup && !that._isEventPartOfGroup(e, cellGroup)) {
                continue;
            }

            const eStartTime = e.dateStart.getTime(),
                eEndTime = e.dateEnd.getTime();

            //Finds the events that start from the same cell
            if (eStartTime >= eventCellStartTime && eStartTime <= eventCellEndTime) {
                cellEvents.push(e);
                continue;
            }

            //Finds the event that collide with the start cell
            if (eEndTime > eventCellStartTime && eStartTime < eventCellEndTime) {
                collisionEvents.push(e);
            }
        }

        //When the event is before the first possible cell date
        if (!cellEvents.length && collisionEvents.length) {
            cellEvents = collisionEvents;
            collisionEvents = [];
        }

        //Sorts the events in the starting cell by longest to shortest
        that._sortEventCellObjs(cellEvents, eventDetails.isDayOrWeekView);

        return that._getOrderedEventCollision(eventDetails, cellEvents, collisionEvents)
    }

    isCollision(dateStart, dateEnd, dateRanges) {
        // Ensure the start date is before the end date
        if (dateStart > dateEnd) {
            throw new Error('Start date must be before end date');
        }

        // Iterate through each range in the array
        for (let i = 0; i < dateRanges.length; i++) {
            let rangeStart = dateRanges[i].start;
            let rangeEnd = dateRanges[i].end;

            // Check if the current range collides with the provided dates
            if (
                (dateStart >= rangeStart && dateStart <= rangeEnd) ||  // Start date falls within a range
                (dateEnd >= rangeStart && dateEnd <= rangeEnd) ||      // End date falls within a range
                (dateStart <= rangeStart && dateEnd >= rangeEnd)       // Provided range encompasses a range
            ) {
                return true; // Collision detected
            }
        }

        return false; // No collision
    }

    /**
     * Sorts the events from earliest to latest
     * @param {Array<Object>} events - events objects
     * @param {Boolean} isDayOrWeekView - indicates whether the view is 'day' or 'week'
     */
    _sortEventCellObjs(events, isDayOrWeekView) {
        if (isDayOrWeekView) {
            events.sort((a, b) => {
                const aObj = a instanceof HTMLElement ? a.$.event : a,
                    bObj = b instanceof HTMLElement ? b.$.event : b,
                    aStartTime = aObj.dateStart.getTime(),
                    bStartTime = bObj.dateStart.getTime();

                //if events have equal start time, then compare their end times
                if (aStartTime === bStartTime) {
                    return bObj.dateEnd.getTime() - aObj.dateEnd.getTime();
                }

                //Sort from earlies to latest event
                return aStartTime - bStartTime;
            });
        }
        else {
            events.sort((a, b) => {
                const aObj = a instanceof HTMLElement ? a.$.event : a,
                    bObj = b instanceof HTMLElement ? b.$.event : b;

                aObj.dateStart.getTime() - bObj.dateStart.getTime()
            });
        }
    }

    /**
     * Combines the cell events and collision events into a single array and returns it
     * @param {Object} eventDetails - event details
     * @param {Array<Object>} cellEvents - events that start form the same cell
     * @param {Array<Object>} collisionEvents - events that are in collision
     */
    _getOrderedEventCollision(eventDetails, cellEvents, collisionEvents) {
        const events = eventDetails.events,
            eventIndexes = eventDetails.eventIndexes;

        const eventsInCollision = Math.max(eventDetails.eventsInCollision || 1, cellEvents.length + collisionEvents.length);
        let allEvents = [];

        //Validate the event index accordiong to the overlapping events
        if (collisionEvents.length) {
            const collisionEventIndexes = collisionEvents.map(c => eventIndexes[events.indexOf(c)]);

            for (let c = 0; c < eventsInCollision; c++) {
                const eventInCollision = collisionEvents[collisionEventIndexes.indexOf(c)];

                if (eventInCollision) {
                    allEvents.push(eventInCollision);
                }
                else {
                    const cEvent = cellEvents.find(cEvent => allEvents.indexOf(cEvent) < 0);

                    if (cEvent) {
                        allEvents.push(cEvent);
                    }
                }
            }

            //Add the rest of the collision events to the end, because they have higher indexes
            collisionEvents.forEach(e => allEvents.indexOf(e) < 0 ? allEvents.push(e) : null);
        }
        else {
            allEvents = cellEvents;
        }

        return allEvents
    }

    /**
     * Returns the event start/end cell time range and group
     * @param {Object} eventDetails - event details
     */
    _getEventCellDetails(eventDetails) {
        const that = this,
            viewType = that.viewType;

        if (viewType === 'month') {
            return that._getMonthEventCellDetails(eventDetails);
        }

        const view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            event = eventDetails.eventObj,
            eventDateStart = event.dateStart,
            eventDateEnd = event.dateEnd,
            eventHCellObj = that._getEventHorizontallCellObjs(event),
            eventVCellObj = that._getEventVerticalCellObjs(event),
            eventVCellStart = eventVCellObj.start || eventVCellObj.first,
            vCellGroup = eventVCellStart.group;
        let eventHCellStart = eventHCellObj.start,
            eventStartScale = 0, eventCellStartTime, hCellGroup, eventCellEndTime;

        if (!eventHCellStart) {
            eventHCellStart = eventHCellObj.first;
        }

        hCellGroup = eventHCellStart.group;
        eventCellStartTime = eventHCellStart.date;

        if (eventDetails.isAllDayEvent) {
            if (eventCellStartTime > eventDateStart.getTime()) {
                eventCellStartTime = new Date(eventDateStart);
                eventCellStartTime.setHours(eventCellStartTime.getHours(), 0, 0, 0);
            }

            eventCellEndTime = new Date(eventCellStartTime);
            eventCellEndTime.setHours(23, 59, 59, 999);
            eventCellStartTime = eventCellStartTime.getTime();
            eventCellEndTime = eventCellEndTime.getTime();
        }
        else {
            let dayScaleCount = that._getCellsScaleCount();

            eventStartScale = that._getEventScaleIndex(event, viewType.indexOf('timeline') > -1 ? eventHCellStart : eventVCellStart).start;
            eventCellStartTime = that._getCellTime({ horizontal: eventHCellStart, vertical: eventVCellStart, scaleIndex: eventStartScale });

            //Keep the original event date but with the correct timeline cell time day scale
            if (eventCellStartTime > eventDateStart.getTime()) {
                eventCellStartTime = new Date(eventDateStart);
                eventCellStartTime.setHours(eventCellStartTime.getHours(), 0, 0, 0);
                eventCellStartTime = eventCellStartTime.getTime();
                dayScaleCount = 1;
            }
            //Set the start time according to the event if it's past the cell start time
            else if (eventCellStartTime < eventDateStart.getTime()) {
                eventCellStartTime = new Date(eventCellStartTime);
                eventCellStartTime.setMinutes(eventDateStart.getMinutes());
                eventCellStartTime = eventCellStartTime.getTime();
            }

            eventCellEndTime = eventCellStartTime;

            //-1 to set the last possible time of the same day
            if ((viewType === 'timelineMonth' || viewType === 'timelineWeek' && viewDetails && viewDetails.hideHours)) {
                eventCellEndTime += 24 * 60 * 60 * 1000 - 1;
            }
            else {
                eventCellEndTime += 60 / dayScaleCount * 60 * 1000 - 1;
            }

            //Set the end time according to the event if it's past the cell end time
            if (eventCellEndTime > eventDateEnd.getTime()) {
                eventCellEndTime = new Date(eventCellEndTime);
                eventCellEndTime.setMinutes(eventDateEnd.getMinutes() - 1);
                eventCellEndTime = eventCellEndTime.getTime();
            }
        }

        return { eventCellStartTime: eventCellStartTime, eventCellEndTime: eventCellEndTime, hCellGroup: hCellGroup, vCellGroup: vCellGroup }
    }

    /**
     * Returns the event cell start/end time for an event
     * @param {*} eventDetails - event details
     */
    _getMonthEventCellDetails(eventDetails) {
        const that = this,
            event = eventDetails.eventObj,
            eventDateStart = event.dateStart,
            eventDateEnd = event.dateEnd,
            eventVCellObj = that._getEventVerticalCellObjs(event);
        let eventHCellStart, eventCellStartTime, hCellGroup, vCellGroup, eventCellEndTime,
            eventVCellStart = eventVCellObj.start || eventVCellObj.first;

        eventVCellStart = eventVCellObj.start;
        vCellGroup = eventVCellStart.group;

        const vCellStartDate = new Date(eventVCellStart.date),
            vCellEndDate = new Date(eventVCellStart.date),
            eventCopy = Object.assign({}, event);

        //Set to the end of the week
        vCellEndDate.setDate(vCellEndDate.getDate() + 6);
        vCellEndDate.setHours(23, 59, 59, 999);
        vCellStartDate.setHours(0, 0, 0, 0);

        eventCopy.dateStart = new Date(Math.max(eventDateStart.getTime(), vCellStartDate.getTime()));
        eventCopy.dateEnd = new Date(Math.min(eventDateEnd.getTime(), vCellEndDate.getTime()));

        //NOTE: To get the correct horizontal cell we need to use the date of the corresponding vertical cell
        const eventHCellObj = that._getEventHorizontallCellObjs(eventCopy);

        eventHCellStart = eventHCellObj.start;

        if (!eventHCellStart) {
            eventHCellStart = eventHCellObj.first;
        }

        hCellGroup = eventHCellStart.group;
        eventCellStartTime = eventHCellStart.date;

        eventCellStartTime = that._getCellTime({ horizontal: eventHCellStart, vertical: eventVCellStart, scaleIndex: 0 });

        //Keep the original event date but with the correct timeline cell time day scale
        if (eventCellStartTime > eventDateStart.getTime()) {
            eventCellStartTime = new Date(eventDateStart);
            eventCellStartTime = eventCellStartTime.getTime();
        }

        eventCellEndTime = eventCellStartTime + 24 * 60 * 60 * 1000 - 1; //-1 to set the last possible miliseocnd of the same day

        //Set the end time according to the event if it's past the cell end time
        if (eventCellEndTime > eventDateEnd.getTime()) {
            eventCellEndTime = new Date(eventCellEndTime);

            eventCellEndTime.setMinutes(eventDateEnd.getMinutes() - 1);
            eventCellEndTime = eventCellEndTime.getTime();
        }

        return { eventCellStartTime: eventCellStartTime, eventCellEndTime: eventCellEndTime, hCellGroup: hCellGroup, vCellGroup: vCellGroup }
    }

    /**
     * Returns the timelien day scale index of an event
     * @param {Object} event  - an event
     */
    _getEventScaleIndex(eventObj, cellObj) {
        const that = this,
            scaleCount = that._getCellsScaleCount(),
            dayScale = 60 / scaleCount,
            eventDateStart = eventObj.dateStart,
            eventDateEnd = eventObj.dateEnd;
        let min = 0, max = dayScale, startScaleIndex, endScaleIndex, skipStartScaleIndex, skipEndScaleIndex;

        if (cellObj) {
            const cellDate = cellObj.date;
            let cellStartTime = new Date(cellDate),
                cellEndTime = new Date(cellDate);

            //In day/week views the vCells only indicate hours and minutes
            if (that.viewType.indexOf('timeline') < 0) {
                cellStartTime = new Date(eventDateStart);
                cellEndTime = new Date(eventDateEnd);
                cellStartTime.setHours(cellDate.getHours(), cellDate.getMinutes(), 0, 0);
                cellEndTime.setHours(cellDate.getHours(), cellDate.getMinutes(), 0, 0);
            }

            cellStartTime = cellStartTime.getTime();
            cellEndTime = cellStartTime + 60 * 60 * 1000;

            if (eventDateStart.getTime() <= cellStartTime) {
                skipStartScaleIndex = true;
                startScaleIndex = 0;
            }

            if (eventDateEnd.getTime() >= cellEndTime) {
                skipEndScaleIndex = true;
                endScaleIndex = scaleCount - 1;
            }
        }

        if (startScaleIndex === undefined || endScaleIndex === undefined) {
            const eventStartMinutes = eventDateStart.getMinutes(),
                eventEndMinutes = eventDateEnd.getMinutes();

            for (let i = 0; i < scaleCount; i++) {
                if (!skipStartScaleIndex && min <= eventStartMinutes && max >= eventStartMinutes) {
                    startScaleIndex = i;
                }

                if (!skipEndScaleIndex && min < eventEndMinutes && max >= eventEndMinutes) {
                    endScaleIndex = i;
                }

                min += dayScale;
                max += dayScale;
            }
        }

        return { start: startScaleIndex || 0, end: endScaleIndex || 0 }
    }

    /**
     * Returns the valid dateStart/dateEnd of an event according to hideWeekend and hideNonworkingWeekdays
     * @param {*} eventObj
     */
    _getEventVisibleDateRange(eventObj) {
        const that = this,
            eventDateStart = eventObj.dateStart,
            eventDateEnd = eventObj.dateEnd;

        if (that.viewType.toLowerCase().indexOf('day') > -1) {
            return { dateStart: eventDateStart, dateEnd: eventDateEnd }
        }

        const view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {};
        let newDateStart = new Date(eventDateStart),
            newDateEnd = new Date(eventDateEnd),
            hiddenDays = [], dateStartChanged, dateEndChanged;

        if (newDateEnd.getHours() === 0 && newDateEnd.getMinutes() === 0 && newDateEnd.getSeconds() === 0) {
            newDateEnd.setDate(newDateEnd.getDate() - 1);
            // newDateEnd.setHours(eventDateEnd.getHours(), eventDateEnd.getMinutes(), eventDateEnd.getSeconds(), 0);
            newDateEnd.setHours(23, 59, 59, 999);
        }

        //Add the nonworking week days to hidden days
        if (that.hideNonworkingWeekdays || viewDetails.hideNonworkingWeekdays) {
            (that.nonworkingDays || viewDetails.nonworkingDays).forEach(d => hiddenDays.push(d));
        }

        //Add weekends to nonworking days
        if (that.hideWeekend || viewDetails.hideWeekend) {
            [0, 6].forEach(d => hiddenDays.push(d));
        }

        //If all days of the week are hidden
        if ([0, 1, 2, 3, 4, 5, 6].every(d => hiddenDays.indexOf(d) > -1)) {
            return
        }

        //Validate the start/end dates
        while (hiddenDays.indexOf(newDateStart.getDay()) > -1) {
            newDateStart.setDate(newDateStart.getDate() + 1);
            dateStartChanged = true;
        }

        while (hiddenDays.indexOf(newDateEnd.getDay()) > -1) {
            newDateEnd.setDate(newDateEnd.getDate() - 1);
            dateEndChanged = true;
        }

        if (newDateStart.getTime() <= newDateEnd.getTime()) {
            return { dateStart: dateStartChanged ? newDateStart : eventDateStart, dateEnd: dateEndChanged ? newDateEnd : eventDateEnd }
        }
    }

    /**
     * Returns the start/end horizontal cell objects that correspond to the event
     * @param {Object} event  - event object
     */
    _getEventHorizontallCellObjs(eventObj) {
        const that = this,
            hourStart = that.hourStart,
            hourEnd = that.hourEnd,
            eventVisibleDateRange = that._getEventVisibleDateRange(eventObj);

        if (!eventVisibleDateRange) {
            return
        }

        const eventDateStart = eventVisibleDateRange.dateStart,
            eventDateEnd = eventVisibleDateRange.dateEnd,
            eventStartHour = eventDateStart.getHours(),
            eventEndHour = eventDateEnd.getHours(),
            isExactStart = eventDateStart.getMinutes() + eventDateStart.getSeconds() + eventDateStart.getMilliseconds() === 0,
            isExactEnd = eventDateEnd.getMinutes() + eventDateEnd.getSeconds() + eventDateEnd.getMilliseconds() === 0,
            endsOnStart = eventDateEnd.getTime() > eventDateStart.getTime() && isExactEnd,
            viewType = that.viewType,
            view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            isSameDay = eventDateStart.getFullYear() === eventDateEnd.getFullYear() &&
                eventDateStart.getMonth() === eventDateEnd.getMonth() && eventDateStart.getDate() === eventDateEnd.getDate();

        function getTimeRange(dateStart, dateEnd) {
            let isCellDate;

            if (!arguments.length) {
                dateStart = eventDateStart;
                dateEnd = eventDateEnd;
            }
            else {
                isCellDate = true;

                if (!dateEnd) {
                    dateEnd = dateStart;
                }
            }

            let start = new Date(dateStart),
                end = new Date(dateEnd);

            switch (viewType) {
                case 'agenda':
                    //In Agenda only the group of the header cell is important
                    start = eventDateStart;
                    end = eventDateEnd;
                    break;
                case 'day':
                case 'week':
                case 'timelineMonth':
                    if (isCellDate) {
                        start.setHours(0, 0, 0, 0);
                        end.setHours(23, 59, 59, 999);
                    }
                    else {
                        if (!eventObj.allDay && viewType === 'day') {
                            const maxDateEnd = new Date(eventDateStart);

                            maxDateEnd.setHours(23, 59, 59, 999);
                            if (eventDateEnd.getDate() === maxDateEnd.getDate()) {
                                end = new Date(Math.min(eventDateEnd.getTime(), maxDateEnd.getTime()));
                            }
                        }
                        else {
                            end = new Date(eventDateEnd);
                        }

                        end.setHours(end.getHours(), end.getMinutes(), 0, 0);

                        if (endsOnStart) {
                            end = new Date(end.getTime() - 1);
                            end.setHours(end.getHours(), 59, 59, 999);
                        }
                    }
                    break;
                case 'timelineDay':
                case 'timelineWeek':
                    if (viewType === 'timelineWeek' && viewDetails && viewDetails.hideHours) {
                        if (!isCellDate && endsOnStart) {
                            end = new Date(eventDateEnd.getTime() - 1);
                            end.setHours(end.getHours(), 59, 59, 999);
                        }
                        return { start: start.getDay(), end: end.getDay() }
                    }

                    if (isCellDate) {
                        const startHour = dateStart.getHours(),
                            endHour = dateEnd.getHours();

                        if (isSameDay && ((eventStartHour < hourStart && (eventEndHour < hourStart || eventEndHour === hourStart && isExactEnd)) ||
                            ((eventStartHour > hourEnd || eventStartHour === hourStart && isExactStart) && eventEndHour > hourEnd))) {
                            start.setHours(startHour, 0, 0, 0);
                            end.setHours(endHour, 59, 59, 999);
                        }
                        else {
                            start.setHours(startHour === hourStart && eventStartHour < hourStart ? eventStartHour : startHour, 0, 0, 0);
                            end.setHours(endHour === hourEnd && eventEndHour > hourEnd ? eventEndHour : endHour, 59, 59, 999);
                        }
                    }
                    else {
                        if (endsOnStart) {
                            end = new Date(end.getTime() - 1);
                            end.setHours(end.getHours(), 59, 59, 999);
                        }

                        if (!isSameDay) {
                            if (eventStartHour > hourEnd) {
                                start.setHours(0);
                                start.setDate(start.getDate() + 1);
                                start.setHours(hourStart);

                                const visibleDates = that._getEventVisibleDateRange({ dateStart: start, dateEnd: end });

                                if (visibleDates && visibleDates.dateStart.getTime() < end.getTime()) {
                                    start = visibleDates.dateStart;
                                }
                                else {
                                    start = new Date(dateStart);
                                }
                            }

                            if (eventEndHour < hourStart || eventEndHour === hourStart && isExactEnd) {
                                end.setHours(0);
                                end.setDate(end.getDate() - 1);
                                end.setHours(hourEnd);

                                const visibleDates = that._getEventVisibleDateRange({ dateStart: start, dateEnd: end });

                                if (visibleDates && visibleDates.dateEnd.getTime() > start.getTime()) {
                                    end = visibleDates.dateEnd;
                                }
                                else {
                                    end = new Date(dateEnd);
                                }
                            }

                            if (eventEndHour > hourEnd) {
                                end.setHours(hourEnd);
                            }
                        }
                    }
                    break;
                case 'month':
                    if (!isCellDate && endsOnStart) {
                        end = new Date(eventDateEnd.getTime() - 1);
                        end.setHours(end.getHours(), 59, 59, 999);
                    }
                    return { start: start.getDay(), end: end.getDay() }
            }

            start = start.getTime();
            end = end.getTime();

            return { start: start, end: end }
        }

        return that._getEventCellObjs(eventObj, getTimeRange, 'horizontal');
    }

    /**
     * Returns the start/end horizontal cell objects that correspond to the event
     * @param {Object} event  - event object
     */
    _getEventVerticalCellObjs(eventObj) {
        const that = this,
            hourStart = that.hourStart,
            hourEnd = that.hourEnd,
            eventVisibleDateRange = that._getEventVisibleDateRange(eventObj);

        if (!eventVisibleDateRange) {
            return
        }

        const eventDateStart = eventVisibleDateRange.dateStart,
            eventDateEnd = eventVisibleDateRange.dateEnd,
            eventStartHour = eventDateStart.getHours(),
            eventEndHour = eventDateEnd.getHours(),
            endsOnStart = eventDateEnd.getTime() > eventDateStart.getTime() &&
                eventDateEnd.getMinutes() + eventDateEnd.getSeconds() + eventDateEnd.getMilliseconds() === 0,
            viewType = that.viewType;

        function getTimeRange(dateStart, dateEnd) {
            let isCellDate;

            if (!arguments.length) {
                dateStart = eventDateStart;
                dateEnd = eventDateEnd;
            }
            else {
                isCellDate = true;

                if (!dateEnd) {
                    dateEnd = dateStart;
                }
            }


            let start = new Date(dateStart),
                end = new Date(dateEnd);

            switch (viewType) {
                case 'day':
                case 'week': {
                    start = new Date(eventDateStart);
                    end = new Date(eventDateEnd);

                    if (isCellDate) {
                        end = new Date(start);

                        const startHour = dateStart.getHours(),
                            endHour = dateEnd.getHours();

                        if (eventEndHour <= hourStart && eventStartHour <= hourStart || eventStartHour >= hourEnd && eventEndHour >= hourEnd) {
                            start.setHours(startHour, 0, 0, 0);
                            end.setHours(endHour, 59, 59, 999);
                        }
                        else {
                            start.setHours(startHour === hourStart && eventStartHour < hourStart ? eventStartHour : startHour, 0, 0, 0);
                            end.setHours(endHour === hourEnd && eventEndHour > hourEnd ? eventEndHour : endHour, 59, 59, 999);
                        }

                        // start.setHours(startHour === hourStart && eventStartHour < hourStart ? eventStartHour : startHour, 0, 0, 0);
                        // end.setHours(endHour === hourEnd && eventEndHour > hourEnd ? eventEndHour : endHour, 59, 59, 999);
                    }
                    else {
                        start.setHours(start.getHours(), start.getMinutes(), 0, 0);
                        end.setHours(end.getHours(), end.getMinutes(), 0, 0);

                        if (endsOnStart) {
                            end = new Date(end.getTime() - 1);
                            end.setHours(end.getHours(), 59, 59, 999);
                        }
                    }
                    break;
                }
                case 'agenda':
                    if (isCellDate) {
                        start.setHours(0, 0, 0, 0);
                        end.setHours(23, 59, 59, 999);
                    }
                    break;
                case 'month':
                    if (isCellDate) {
                        start.setHours(0, 0, 0, 0);
                        end = new Date(dateStart);
                        end.setDate(end.getDate() + 6);
                        end.setHours(23, 59, 59, 999);
                    }
                    else if (endsOnStart) {
                        end = new Date(end.getTime() - 1);
                        end.setHours(end.getHours(), 59, 59, 999);
                    }
                    break;
                case 'timelineDay':
                case 'timelineWeek':
                case 'timelineMonth':
                    return { start: 0, end: 0 }
            }

            start = start.getTime();
            end = end.getTime();

            return { start: start, end: end }
        }

        return that._getEventCellObjs(eventObj, getTimeRange, 'vertical');
    }

    /**
     * Returns the start/end cell objs for the event
     * @param {Object} event  - event object
     * @param {Function} getTimeRange - function that returns the start/end date for the event/cell
     * @param {String} type  - defines whether horizontal/vertical cell objs
     */
    _getEventCellObjs(eventObj, getTimeRange, type = 'horizontal') {
        const that = this,
            timelineCells = that._timelineCells;

        if (!timelineCells || !timelineCells[type]) {
            return
        }

        const cells = timelineCells[type],
            eventDateRange = getTimeRange(),
            eventTimeStart = eventDateRange.start,
            eventTimeEnd = eventDateRange.end;
        let cellStart, cellEnd, firstCell, lastCell, firstCellStartTime, lastCellStartTime;

        for (let i = 0; i < cells.length; i++) {
            const cellObj = cells[i],
                cellDate = cellObj.date,
                cellGroup = cellObj.group;

            if (cellGroup && !that._isEventPartOfGroup(eventObj, cellGroup)) {
                continue;
            }

            const cellDateRange = getTimeRange(cellDate, cellDate),
                cellStartTime = cellDateRange.start,
                cellEndTime = cellDateRange.end;

            if (!cellStart && eventTimeStart >= cellStartTime && eventTimeStart <= cellEndTime) {
                cellStart = cellObj;
            }

            if (eventTimeEnd >= cellStartTime && eventTimeEnd <= cellEndTime) {
                cellEnd = cellObj;
            }

            if (!firstCell) {
                firstCell = cellObj;
                firstCellStartTime = cellStartTime;
            }

            lastCell = cellObj;
            lastCellStartTime = cellStartTime;
        }

        if (!cellStart && eventTimeStart <= firstCellStartTime && eventTimeEnd > firstCellStartTime) {
            cellStart = firstCell;
        }

        if (!cellEnd && cellStart) {
            // cellEnd = lastCell;
            cellEnd = eventTimeEnd >= firstCellStartTime && eventTimeEnd <= lastCellStartTime ? cellStart : lastCell;
        }

        return { start: cellStart, end: cellEnd, first: firstCell, last: lastCell }
    }

    /**
     * Sets the vertical event cells
     * @param {Object} eventDetails - events details
     */
    _setVerticalTimelineEvents(eventDetails) {
        const that = this,
            events = eventDetails.events,
            eventCells = eventDetails.eventCells,
            eventRenderMode = eventDetails.eventRenderMode;

        if (eventDetails.viewType === 'agenda' || eventRenderMode === 'modern' && eventDetails.isMobile) {
            return that._setAgendaOrMobileEvents(eventDetails);
        }

        const isAllDayEvent = eventDetails.isAllDayEvent,
            spaceAvailable = eventDetails.spaceAvailable,
            eventSize = eventDetails.eventSize,
            maxEventsPerCell = Math.floor(spaceAvailable / eventSize),
            eventIndexes = eventDetails.eventIndexes,
            [scrollTop, scrollLeft] = [that.scrollTop, that.scrollLeft],
            [scrollBottom, scrollRight] = [scrollTop + that._scrollViewSize.height, scrollLeft + that._scrollViewSize.width];
        let eventOverlaps, eventCollisionsCount;

        if (eventRenderMode === 'classic' || that.autoHeightAllDayCells) {
            //Find the collision count, overlapping events and their indexes
            const collisionDetails = that._getEventsCollisionIndexes(eventDetails, 'vertical');

            eventOverlaps = collisionDetails.eventOverlaps;
            eventCollisionsCount = collisionDetails.eventCollisionsCount;
        }

        if (that.autoHeightAllDayCells) {
            that._allDayCellSize = that.__allDayCellSize;
        }

        //Set the new events
        for (let i = 0; i < events.length; i++) {
            const cellRanges = eventCells[i],
                event = events[i];

            eventDetails.eventObj = event;

            for (let r = 0; r < cellRanges.length; r++) {
                const cellRange = cellRanges[r],
                    firstCell = cellRange[0];

                if (!firstCell) {
                    continue;
                }

                eventDetails.cellRange = cellRange;

                let eventIndex = eventIndexes[i];

                //Calculate the index of the event inside the cell
                if (eventIndex === undefined) {
                    const collisionEvents = that._getEventsInCollision(eventDetails);

                    //Get all events that start from this cell
                    eventDetails.cellEventsCount = collisionEvents.length;
                    eventIndexes[i] = collisionEvents.indexOf(event);
                }

                if (!isAllDayEvent) {
                    const lastCell = cellRange[cellRange.length - 1],
                        [firstVCell, lastVCell] = [firstCell.vertical, lastCell.vertical],
                        [firstHCell, lastHCell] = [firstCell.horizontal, lastCell.horizontal];

                    //Create the event cell if visible
                    if (lastVCell.top + lastVCell.height < scrollTop || firstVCell.top > scrollBottom ||
                        lastHCell.left + lastHCell.width < scrollLeft || firstHCell.left > scrollRight) {
                        continue
                    }
                }

                eventDetails.eventIndex = eventIndex = eventIndexes[i];

                if (!that.autoHeightAllDayCells) {
                    if (eventRenderMode === 'modern' && (eventIndex + 1) * eventSize > spaceAvailable) {
                        that._addEventToCollector(eventDetails);
                        continue
                    }
                }

                if (eventRenderMode === 'classic' || that.autoHeightAllDayCells) {
                    const eventCollisions = eventOverlaps.filter(e => e.indexOf(event) > -1),
                        eventsInCollision = eventOverlaps[i].reduce((acc, value) => acc = Math.max(acc, eventCollisionsCount[events.indexOf(value)] || 1), 1);

                    //Make the event fit the whole space when last item and space is available
                    let eventSpanCoeff = 1;

                    for (let i = eventIndex + 1; i < eventsInCollision; i++) {
                        if (!eventCollisions.every(collision => collision.map(c => eventIndexes[events.indexOf(c)]).indexOf(i) < 0)) {
                            break;
                        }
                        eventSpanCoeff++;
                    }

                    //Determines how the events are positioned
                    eventDetails.isMaxSizeReached = eventsInCollision > maxEventsPerCell;
                    eventDetails.cellEventsCount = eventsInCollision;
                    eventDetails.eventSize = Math.min(eventSize, (spaceAvailable / eventsInCollision) * eventSpanCoeff);

                    if (that.autoHeightAllDayCells) {
                        eventDetails.eventSize = eventSize;
                        that._allDayCellSize = Math.max(that._allDayCellSize, 25 + (eventSize * eventsInCollision));
                        that.style.setProperty('--smart-scheduler-timeline-header-all-day-cells-size', that._allDayCellSize + 'px');
                        that._refresh();
                    }
                }

                that._setEventCell(eventDetails);
            }
        }
    }

    /**
     * Renders Agenda and Modern(Mobile) event cells
     * @param {*} eventDetails - event details
     */
    _setAgendaOrMobileEvents(eventDetails) {
        const that = this,
            events = eventDetails.events,
            isAllDayEvent = eventDetails.isAllDayEvent,
            eventCells = eventDetails.eventCells,
            isAgendaView = eventDetails.viewType === 'agenda';
        let scrollTop, scrollLeft, scrollBottom, scrollRight;

        if (!isAllDayEvent) {
            [scrollTop, scrollLeft] = [that.scrollTop, that.scrollLeft];
            [scrollBottom, scrollRight] = [scrollTop + that._scrollViewSize.height, scrollLeft + that._scrollViewSize.width];
        }

        for (let i = 0; i < events.length; i++) {
            const cellRanges = eventCells[i],
                event = events[i];

            eventDetails.eventObj = event;
            // Set the event cells for each cell in the range
            cellRanges.forEach(cellRange => {
                if (cellRange[0]) {
                    eventDetails.cellRange = cellRange;

                    if (isAllDayEvent) {
                        isAgendaView ? that._setEventCell(eventDetails) : that._addEventToCollector(eventDetails);
                    }
                    else {
                        const firstCell = cellRange[0],
                            lastCell = cellRange[cellRange.length - 1],
                            [firstVCell, lastVCell] = [firstCell.vertical, lastCell.vertical],
                            [firstHCell, lastHCell] = [firstCell.horizontal, lastCell.horizontal];

                        //Create the event cell if visible
                        if (lastVCell.top + lastVCell.height >= scrollTop && firstVCell.top <= scrollBottom &&
                            lastHCell.left + lastHCell.width >= scrollLeft && firstHCell.left <= scrollRight) {
                            isAgendaView ? that._setEventCell(eventDetails) : that._addEventToCollector(eventDetails);
                        }
                    }
                }
            });
        }

        return eventDetails.usedEventCells
    }

    /**
     * Adds an event to a collector
     * @param {Object} eventDetails - details for the event
     */
    _addEventToCollector(eventDetails) {
        const that = this,
            viewType = eventDetails.viewType,
            isTimelineView = viewType.indexOf('timeline') > -1,
            eventObj = eventDetails.eventObj,
            cellRange = eventDetails.cellRange,
            usedEventCells = eventDetails.usedEventCells,
            allDayEventsContainer = that.$.allDayEventsContainer,
            isAllDayEvent = eventDetails.isAllDayEvent,
            isDayOrWeekView = eventDetails.isDayOrWeekView,
            isMonthView = viewType === 'month',
            eventCellsContainer = isAllDayEvent ? allDayEventsContainer : that.$.timelineEventsContainer,
            scaleCount = that._getCellsScaleCount(),
            eventCell = that._setEventCell(eventDetails, true),
            cellRangeCount = cellRange.length,
            tabIndex = that.hasAttribute('tabindex') ? that.tabIndex : undefined;
        let fragment = document.createDocumentFragment(),
            collectorDetails = { tabIndex: tabIndex };

        cellRangeLoop: for (let i = 0; i < cellRangeCount; i++) {
            const cellObj = cellRange[i],
                scaleIndex = cellObj.scaleIndex,
                cellGroup = cellObj.vertical.group || cellObj.horizontal.group;
            let scaleCellsCount

            //Find the scaleCount
            if (isAllDayEvent) {
                scaleCellsCount = 1;
            }
            else {
                if (cellRangeCount === 1) {
                    scaleCellsCount = that._getEventScaleIndex(eventObj, isTimelineView ? cellObj.horizontal : cellObj.vertical).end + 1;
                }
                else {
                    scaleCellsCount = i === cellRangeCount - 1 ? scaleIndex + 1 : scaleCount;
                }
            }

            //Create a collector for each scale of each cell
            for (let c = i === 0 ? (scaleIndex || 0) : 0; c < scaleCellsCount; c++) {
                cellObj.scaleIndex = c;

                const cellTime = that._getCellTime(cellObj);
                let eventCollector = that._findCollector(eventDetails, cellTime, cellGroup);

                if (eventCollector) {
                    const collectorEvents = eventCollector.$.events,
                        collectorEventObjs = collectorEvents.map(e => e.$.event);

                    if (collectorEventObjs.indexOf(eventObj) < 0) {
                        collectorEvents.push(eventCell);
                        that._sortEventCellObjs(collectorEvents, isDayOrWeekView);
                    }
                }
                else {
                    eventCollector = document.createElement('div');
                    eventCollector.classList.add('smart-scheduler-event');
                    eventCollector.setAttribute('collector', '');

                    //Accessibility
                    eventCollector.setAttribute('role', 'gridcell');
                    eventCollector.setAttribute('aria-haspopup', true);

                    eventCollector.$ = {
                        group: cellGroup,
                        cellTime: cellTime,
                        collector: true,
                        events: [eventCell]
                    };

                    fragment.appendChild(eventCollector);
                }

                //NOTE: First day of month has additional month label in the cell
                if (isMonthView && new Date(cellTime).getDate() === 1) {
                    eventCollector.setAttribute('first-month-day', '');
                }
                else {
                    eventCollector.removeAttribute('first-month-day');
                }

                collectorDetails.eventCollector = eventCollector;
                collectorDetails.cellObj = cellObj;

                that._setEventCollectorStyles(eventDetails, collectorDetails);
                that._setEventCellContent(eventCollector, eventDetails);

                if (usedEventCells.indexOf(eventCollector) < 0) {
                    usedEventCells.push(eventCollector);
                }

                if (isDayOrWeekView && !isAllDayEvent) {
                    break cellRangeLoop;
                }
            }

            cellObj.scaleIndex = scaleIndex;
        }

        if (fragment.children.length) {
            eventCellsContainer.appendChild(fragment);
        }
    }

    /**
     * Finds a collector based on time and group
     * @param {object} eventDetails - event details
     * @param {number} cellTime - cell time
     * @param {string} cellGroup  - cell group
     */
    _findCollector(eventDetails, cellTime, cellGroup) {
        const that = this;

        if (!eventDetails) {
            return
        }

        const currentEvents = eventDetails.currentEvents;

        for (let i = 0; i < currentEvents.length; i++) {
            const currentEvent = currentEvents[i];

            //Only collectors have that object
            if (!currentEvent.$.events) {
                continue
            }

            if (currentEvent.$.cellTime === cellTime && (!cellGroup || that._isEventPartOfGroup(currentEvent.$.group, cellGroup))) {
                return currentEvent
            }
        }
    }

    /**
     * Sets the styles of the event collectors
     * @param {Object} eventDetails - event details
     * @param {Object} collectorDetails - collector details
     */
    _setEventCollectorStyles(eventDetails, collectorDetails) {
        const that = this,
            cellSize = eventDetails.cellSize,
            eventRenderMode = eventDetails.eventRenderMode,
            eventCollector = collectorDetails.eventCollector,
            cellObj = collectorDetails.cellObj,
            tabIndex = collectorDetails.tabIndex,
            isMobile = eventDetails.isMobile,
            hOffset = eventDetails.rightToLeft ? 'right' : 'left',
            isAllDayEvent = eventDetails.isAllDayEvent,
            isBasicView = eventDetails.isDayOrWeekView,
            cellOffset = that._getCellOffset(cellObj);
        let collectorSize = eventDetails.collectorSize;

        //Rest previous orientaiton position
        eventCollector.style[eventDetails.rightToLeft ? 'left' : 'right'] = '';

        if (eventRenderMode === 'modern' && isMobile) {
            collectorSize = Math.min(cellSize.width, cellSize.height);

            eventCollector.style.width = eventCollector.style.height = collectorSize + 'px';
            eventCollector.style[hOffset] = (cellOffset.left + (cellSize.width - collectorSize) / 2) + 'px';
            eventCollector.style.top = (cellOffset.top + (cellSize.height - collectorSize) / 2) + 'px';
        }
        else {
            eventCollector.style.top = cellOffset.top + 'px';
            eventCollector.style.height = that._eventCollectorSize + 'px';

            if (isBasicView && !isAllDayEvent) {
                eventCollector.style[hOffset] = (cellOffset.left + cellSize.width - collectorSize) + 'px';
                eventCollector.style.width = collectorSize + 'px';
            }
            else {
                eventCollector.style[hOffset] = cellOffset.left + 'px';
                eventCollector.style.width = Math.max(0, cellSize.width) + 'px';
            }
        }

        if (tabIndex !== undefined) {
            eventCollector.tabIndex = tabIndex;
        }
        else {
            eventCollector.removeAttribute('tabindex');
        }
    }

    /**
     * Removes an event from a collector
     * @param {*} eventDetails - event details
     */
    _removeEventFromCollector(eventDetails) {
        const that = this,
            eventObj = eventDetails.eventObj,
            cellRange = eventDetails.cellRange;
        let removeEventCell;

        for (let i = 0; i < cellRange.length; i++) {
            const cellObj = cellRange[i],
                cellGroup = cellObj.vertical.group || cellObj.horizontal.group,
                cellTime = that._getCellTime(cellObj),
                eventCollector = that._findCollector(eventDetails, cellTime, cellGroup);

            if (eventCollector) {
                const collectorEvents = eventCollector.$.events,
                    eventIndex = collectorEvents.map(e => e.$.event).indexOf(eventObj);

                if (eventIndex > -1) {
                    removeEventCell = collectorEvents.splice(eventIndex, 1)[0];
                }

                if (!collectorEvents.length) {
                    eventCollector.remove();
                }
                else {
                    that._setEventCellContent(eventCollector, eventDetails);
                }
            }
        }

        return removeEventCell
    }

    /**
     * Finds the target event element
     */
    _findEventElement(eventDetails, cellTime, eventObj) {
        if (!eventDetails) {
            return
        }

        const currentEvents = eventDetails.currentEvents;

        for (let i = 0; i < currentEvents.length; i++) {
            const currentEvent = currentEvents[i];

            if (currentEvent.$.event === eventObj && currentEvent.$.cellTime === cellTime) {
                return currentEvent
            }
        }
    }

    /**
     * Creates an even cell
     * @param {Object} eventDetails - event details
     */
    _setEventCell(eventDetails, isCollectorItem) {
        const that = this,
            viewType = eventDetails.viewType,
            eventObj = eventDetails.eventObj,
            usedEventCells = eventDetails.usedEventCells,
            repeatingEvent = eventObj.$ ? eventObj.$.event : undefined,
            eventDateStart = eventObj.dateStart,
            eventDateEnd = eventObj.dateEnd,
            eventStatus = eventObj.status,
            startCellTime = that._getCellTime(eventDetails.cellRange[0]),
            eventCellsContainer = eventDetails.isAllDayEvent ? that.$.allDayEventsContainer : that.$.timelineEventsContainer,
            dragDetails = that._dragDetails,
            tabIndex = that.tabIndex;
        let eventCell = that._findEventElement(eventDetails, startCellTime, eventObj),
            eventStart, eventCellObj;

        if (!isCollectorItem) {
            //Get Event Cell from the collector
            const collectorItem = that._removeEventFromCollector(eventDetails);

            if (!eventCell && collectorItem) {
                eventCell = collectorItem;
            }
        }

        //Does not reset the style of the event cell if it's being resized
        if (eventCell && that.hasAttribute('resized') && eventCell === dragDetails.schedulerEvent) {
            return;
        }

        if (!eventCell) {
            eventCell = document.createElement('div');
            eventCell.classList.add('smart-scheduler-event');

            //Accessibility
            eventCell.setAttribute('role', 'gridcell');
            eventCell.setAttribute('aria-haspopup', true);
        }
        else {
            //EventCell might have been hidden during resizing
            eventCell.classList.remove('smart-hidden');
        }

        that._setEventCellStyles(eventDetails, { eventCell: eventCell });

        if (viewType === 'agenda') {
            eventStart = new Date(startCellTime);
            eventStart.setHours(eventDateStart.getHours(), eventDateStart.getMinutes());
        }
        else {
            eventStart = new Date(eventDateStart);
        }

        //NOTE:Only dateStart/dateEnd in the object are important
        if (!eventCell.$) {
            eventCell.$ = {};
        }

        eventCellObj = eventCell.$;
        eventCellObj.cellTime = startCellTime;
        eventCellObj.dateStart = eventStart;
        eventCellObj.dateEnd = new Date(eventStart.getTime() + eventDateEnd.getTime() - eventDateStart.getTime());
        eventCellObj.event = eventObj;

        //Set resources
        that.resources.forEach(resource => {
            if (eventObj[resource.value] !== undefined) {
                eventCell.setAttribute(resource.value, eventObj[resource.value])
            }
        });

        let statusColor = '';

        if (eventStatus !== undefined && that.statuses.some(s => s.value === eventStatus)) {
            eventCell.setAttribute('status', eventStatus);
            for (let i = 0; i < that.statuses.length; i++) {
                if (that.statuses[i].value === eventStatus) {
                    if (that.statuses[i].color) {
                        statusColor = that.statuses[i].color;
                    }
                    break;
                }
            }
        }
        else {
            eventCell.removeAttribute('status');
        }

        if (statusColor) {
            eventCell.setAttribute('status', '');
            eventCell.style.setProperty('--smart-scheduler-status-background', that._getRGBA(statusColor));
        }

        //Repeating event
        if (repeatingEvent) {
            const eventExceptions = repeatingEvent.repeat.exceptions;

            eventCell.setAttribute('repeating', '');

            if (eventExceptions && eventExceptions.indexOf(eventObj) > -1) {
                eventCell.setAttribute('exception', '');
            }
            else {
                eventCell.removeAttribute('exception');
            }
        }
        else {
            eventCell.removeAttribute('repeating');
            eventCell.removeAttribute('exception');
        }

        eventObj.allDay ? eventCell.setAttribute('all-day', '') : eventCell.removeAttribute('all-day');

        if (isCollectorItem) {
            return eventCell
        }

        that._setEventCellContent(eventCell, eventDetails);

        if (that.hasAttribute('tabindex')) {
            eventCell.tabIndex = tabIndex;
        }
        else {
            eventCell.removeAttribute('tabindex');
        }

        eventObj.disableResize ? eventCell.setAttribute('disable-resize', '') : eventCell.removeAttribute('disable-resize');

        eventCell.setAttribute('title', eventObj.label);

        //Add the event cell to the list so it doesn get removed from the DOM
        if (usedEventCells.indexOf(eventCell) < 0) {
            usedEventCells.push(eventCell);
        }

        //Append the event cell to the DOM
        if (!eventCellsContainer.contains(eventCell)) {
            eventCellsContainer.appendChild(eventCell);
        }
    }

    /**
    * Sets the styles of the event cells
    * @param {Object} eventDetails - event details
    * @param {Object} cellDetails - cell details
    */
    _setEventCellStyles(eventDetails, cellDetails) {
        const that = this,
            viewType = eventDetails.viewType,
            eventObj = eventDetails.eventObj,
            eventIndex = eventDetails.eventIndex,
            eventCell = cellDetails.eventCell,
            collectorSize = eventDetails.collectorSize,
            cellRange = eventDetails.cellRange,
            cellSize = eventDetails.cellSize,
            cellObjStart = cellRange[0],
            cellObjEnd = cellRange[cellRange.length - 1],
            cellStartOffset = that._getCellOffset(cellObjStart),
            isDayOrWeekView = eventDetails.isDayOrWeekView,
            isAllDayEvent = eventDetails.isAllDayEvent,
            hOffset = eventDetails.rightToLeft ? 'right' : 'left',
            isTimelineView = viewType.indexOf('timeline') > -1,
            viewDetails = eventDetails.viewDetails,
            isTimelineDayOrWeekView = ['timelineDay', 'timelineWeek'].indexOf(viewType) > -1,
            classList = eventObj.class ? Array.isArray(eventObj.class) ? eventObj.class : [eventObj.class] : [];
        let backgroundColor = eventObj.backgroundColor,
            color = eventObj.color;

        let statusColor = eventObj.statusColor;

        if (!backgroundColor || !color) {
            //Find the resource backgroundColor
            const eventResource = that.resources.find(r => eventObj[r.value] !== undefined);

            if (eventResource && eventResource.dataSource) {
                const resourceDataItem = eventResource.dataSource.find(i => i.id === eventObj[eventResource.value]);

                if (resourceDataItem) {
                    backgroundColor = backgroundColor || resourceDataItem.backgroundColor;
                    color = color || resourceDataItem.color;
                }
            }
        }

        //Rest previous orientaiton position
        eventCell.style[eventDetails.rightToLeft ? 'left' : 'right'] = '';

        if (statusColor) {
            eventCell.setAttribute('status', '');
            eventCell.style.setProperty('--smart-scheduler-status-background', that._getRGBA(statusColor));
        }

        //Event backgroundColor property
        eventCell.style.setProperty('--smart-scheduler-event-background', that._getRGBA(backgroundColor));
        eventCell.style.setProperty('--smart-scheduler-event-focus', that._getRGBA(backgroundColor, -1));
        eventCell.style.setProperty('--smart-scheduler-event-hover', that._getRGBA(backgroundColor, -2));
        eventCell.style.setProperty('--smart-scheduler-event-color', that._getRGBA(color));
        eventCell.style.setProperty('--smart-scheduler-event-color-hover', that._getRGBA(color));
        eventCell.style.setProperty('--smart-scheduler-event-color-focus', that._getRGBA(color));

        if (viewType === 'agenda') {
            eventCell.style.top = cellStartOffset.top + 'px';
            eventCell.style[hOffset] = cellStartOffset.left + 'px';
            eventCell.style.width = cellSize.width + 'px';
            eventCell.style.height = cellSize.height + 'px';
        }
        else {
            const cellEventsCount = eventDetails.cellEventsCount,
                endScaleIndex = cellObjEnd.scaleIndex;
            let eventOffsetStart = 0, eventOffsetEnd = 0,
                eventSize = eventDetails.eventSize, cellEndOffset;

            if (isTimelineDayOrWeekView || isDayOrWeekView) {
                eventOffsetStart = that._getEventCellOffset(eventObj, cellObjStart);
            }

            //When event starts and ends in the same scale cell
            if (cellObjStart === cellObjEnd) {
                cellObjEnd.scaleIndex = that._getEventScaleIndex(eventObj, isTimelineView ? cellObjEnd.horizontal : cellObjEnd.vertical).end;
            }

            cellEndOffset = that._getCellOffset(cellObjEnd);

            if (isDayOrWeekView && !isAllDayEvent) {
                eventOffsetStart = parseFloat((cellSize.height * eventOffsetStart).toFixed(2));
                eventOffsetEnd = parseFloat((cellSize.height * that._getEventCellOffset(eventObj, cellObjEnd, true)).toFixed(2));

                const height = (eventOffsetEnd + cellEndOffset.top - cellStartOffset.top - eventOffsetStart);

                eventCell.style.height = (height === 0 ? cellSize.height : height) + 'px';
                eventCell.style.width = eventSize + 'px';
                eventCell.style.top = (cellStartOffset.top + eventOffsetStart) + 'px';
                eventCell.style[hOffset] = (cellStartOffset.left + eventIndex * ((cellSize.width - collectorSize) / cellEventsCount)) + 'px';
            }
            else {
                if (viewType === 'timelineDay' || viewType === 'timelineWeek' && (!viewDetails || !viewDetails.hideHours)) {
                    eventOffsetStart = parseFloat((cellSize.width * eventOffsetStart).toFixed(2));
                    eventOffsetEnd = parseFloat((cellSize.width * that._getEventCellOffset(eventObj, cellObjEnd, true)).toFixed(2));
                }
                else {
                    eventOffsetEnd = cellSize.width;
                    eventOffsetStart = 0;
                }

                const width = (eventOffsetEnd + cellEndOffset.left - cellStartOffset.left - eventOffsetStart);

                eventCell.style.height = eventSize + 'px';
                eventCell.style.width = (width === 0 ? cellSize.width : width) + 'px';
                eventCell.style[hOffset] = (cellStartOffset.left + eventOffsetStart) + 'px';

                if (that.eventRenderMode === 'classic' && eventDetails.isMaxSizeReached) {
                    eventCell.style.top = (cellStartOffset.top + collectorSize + eventIndex * ((cellSize.height - collectorSize) / cellEventsCount)) + 'px';
                }
                else {
                    eventCell.style.top = (cellStartOffset.top + collectorSize + eventIndex * eventSize) + 'px';
                }
            }

            if (classList.length) {
                classList.forEach(c => eventCell.classList.add(c));
            }
            else if (eventCell.className !== 'smart-scheduler-event') {
                eventCell.className = 'smart-scheduler-event';
            }

            if (eventObj.id !== undefined) {
                eventCell.id = eventObj.id + '';
            }
            else {
                delete eventObj.id;
            }

            //Set the original endScaleIndex if it has been changed
            cellObjEnd.scaleIndex = endScaleIndex;
        }
    }

    /**
     * Returns the event start/end time offset for day and week views
     * @param {*} eventObj
     * @param {*} cellObj
     */
    _getEventCellOffset(eventObj, cellObj, isEnd) {
        if (cellObj.scaleIndex === undefined) {
            return 0
        }

        const that = this,
            orientation = ['day', 'week'].indexOf(that.viewType) > -1 ? 'vertical' : 'horizontal',
            scaleCount = that._getCellsScaleCount(),
            scaleTime = (60 / scaleCount) * 60 * 1000;
        let eventDate = isEnd ? eventObj.dateEnd : eventObj.dateStart,
            cellTime = cellObj[orientation].date;

        cellTime = new Date(cellTime.getTime() + scaleTime * cellObj.scaleIndex);

        if (orientation === 'vertical') {
            //Vertical cells use only the time portion. Should not rely on the Date of the vertical cells
            cellTime = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), cellTime.getHours(), cellTime.getMinutes(), 0, 0);

            //When an event in 'week' view spans on two horizontal cells because it has more than 1 cell range
            //Occures when the event ends on another day or starts from another day but is not an allDay event (less then 24 hours)
            if (cellTime.getHours() !== eventDate.getHours()) {
                return isEnd ? 1 : 0
            }
        }

        cellTime = cellTime.getTime();
        eventDate = eventDate.getTime();

        return Math.max(0, Math.min(1, cellTime > eventDate ? (isEnd ? 1 : 0) : parseFloat(((eventDate - cellTime) / scaleTime).toFixed(2))))
    }

    /**
     * Returns the rgba of a hex color
     * @param {string} color - a HEX color string
     */
    _getRGBA(value, alpha) {
        if (!value) {
            return ''
        }

        const shortHexResult = /^#(.)(.)(.)$/gi.exec(value),
            defaultAlpha = alpha !== undefined && alpha < 0 ? parseFloat((1 + alpha / 10).toFixed(2)) : undefined;
        let r, g, b, a;

        const colors = {
            'black': [0, 0, 0, 1],
            'white': [255, 255, 255, 1],
            'red': [255, 0, 0, 1],
            'green': [0, 128, 0, 1],
            'blue': [0, 0, 255, 1],
            'yellow': [255, 255, 0, 1],
            'cyan': [0, 255, 255, 1],
            'magenta': [255, 0, 255, 1],
            'gray': [128, 128, 128, 1],
            'maroon': [128, 0, 0, 1],
            'olive': [128, 128, 0, 1],
            'purple': [128, 0, 128, 1],
            'teal': [0, 128, 128, 1],
            'navy': [0, 0, 128, 1],
            'orange': [255, 165, 0, 1],
            'pink': [255, 192, 203, 1],
            'brown': [165, 42, 42, 1],
            'lime': [0, 255, 0, 1],
            'indigo': [75, 0, 130, 1],
            'violet': [238, 130, 238, 1],
            'gold': [255, 215, 0, 1],
            // Add more colors as needed
        };

        if (colors[value]) {
            const color = colors[value];
            const r = color[0];
            const g = color[1];
            const b = color[2];

            return `rgba(${r},${g},${b},${alpha || 1})`
        }

        if (shortHexResult) {
            r = parseInt(shortHexResult[1] + shortHexResult[1], 16);
            g = parseInt(shortHexResult[2] + shortHexResult[2], 16);
            b = parseInt(shortHexResult[3] + shortHexResult[3], 16);

            if (alpha < 0) {
                alpha = parseFloat((1 + (alpha / 10)).toFixed());
            }
        }
        else {
            const longHexResult = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(value);

            if (!longHexResult) {
                return ''
            }

            r = parseInt(longHexResult[1], 16);
            g = parseInt(longHexResult[2], 16);
            b = parseInt(longHexResult[3], 16);
            a = parseInt(longHexResult[4], 16) / 255;

            if (!isNaN(a)) {
                alpha = parseFloat((alpha !== undefined && alpha < 0 ? (a + alpha / 10) : a).toFixed(2));
            }
        }

        if (alpha !== undefined && alpha < 0) {
            alpha = defaultAlpha;
        }

        return `rgba(${r},${g},${b},${alpha || 1})`
    }

    /**
     * Returns the ranges of cell objects in asc order that will be traversed when creating events
     * @param {Object} eventHCellObj - event cell objects
     * @param {String} direction - determines whether horizontal/vertical cell objects
     */
    _getCellRanges(eventCellObj, direction = 'horizontal') {
        if (!eventCellObj) {
            return []
        }

        const that = this,
            cells = that._timelineCells[direction],
            startCell = eventCellObj.start,
            endCell = eventCellObj.end,
            firstCell = eventCellObj.first,
            lastCell = eventCellObj.last;

        if (!startCell && !endCell || !firstCell && !lastCell) {
            return [];
        }

        const fromCell = eventCellObj.start || firstCell,
            toCell = eventCellObj.end || lastCell,
            fromIndex = cells.indexOf(fromCell),
            toIndex = cells.indexOf(toCell),
            firstHCellIndex = cells.indexOf(firstCell),
            lastHCellIndex = cells.indexOf(lastCell);
        let indexRanges = [];

        if (fromIndex > toIndex) {
            indexRanges = [{ fromIndex: fromIndex, toIndex: lastHCellIndex }, { fromIndex: firstHCellIndex, toIndex: toIndex }];
        }
        else {
            indexRanges = [{ fromIndex: fromIndex, toIndex: toIndex }];
        }

        return indexRanges
    }

    /**
     * Returns the timeline cells used for the event
     * @param {Object} eventObj - the event object
     * @param {*} timelineCells - all timeline cells
     */
    _getEventTimelineCells(eventObj, usedTimelineCells, isAllDayEvent) {
        const that = this,
            viewType = that.viewType,
            isAgendaView = viewType === 'agenda',
            eventDateStart = new Date(eventObj.dateStart),
            eventDateEnd = new Date(eventObj.dateEnd),
            hCells = that._timelineCells.horizontal,
            vCells = that._timelineCells.vertical;
        let eventViewCells = [];

        if (viewType === 'month') {
            return that._getEventTimelineCellsMonth(eventObj)
        }

        //Handles all day cells
        if (isAllDayEvent) {
            const vCell = { height: that._allDayCellSize, top: 0, date: new Date(that.dateCurrent) };

            vCell.date.setHours(0, 0, 0, 0);

            that._getCellRanges(that._getEventHorizontallCellObjs(eventObj)).forEach(range => {
                const fromIndex = range.fromIndex,
                    toIndex = range.toIndex;

                for (let i = fromIndex; i <= toIndex; i++) {
                    const hCell = hCells[i],
                        cellGroup = hCell.group;

                    if (cellGroup && !that._isEventPartOfGroup(eventObj, cellGroup)) {
                        continue;
                    }

                    eventViewCells.push({ allDay: true, horizontal: hCell, vertical: vCell });
                }
            })

            return eventViewCells
        }

        const eventCopy = Object.assign({}, eventObj),
            isTimelineView = viewType.indexOf('timeline') > -1;
        let eventStartScaleIndex, eventEndScaleIndex;

        //Finds the correct horizontal cell objects in order to create timeline cells
        that._getCellRanges(that._getEventHorizontallCellObjs(eventObj)).forEach(range => {
            const fromHIndex = range.fromIndex,
                toHIndex = range.toIndex;

            for (let i = fromHIndex; i <= toHIndex; i++) {
                const hCell = hCells[i],
                    hCellStartDate = new Date(hCell.date),
                    cellGroup = hCell.group;
                let hCellEndDate = new Date(hCell.date);

                if (cellGroup && !that._isEventPartOfGroup(eventObj, cellGroup)) {
                    continue;
                }

                if (eventDateStart.getTime() >= hCellStartDate.getTime()) {
                    hCellStartDate.setHours(eventDateStart.getHours(), eventDateStart.getMinutes());
                }

                hCellEndDate.setHours(eventDateEnd.getHours(), eventDateEnd.getMinutes());

                if (viewType === 'timelineMonth') {
                    hCellEndDate.setHours(23, 59, 59);
                }
                if (hCellEndDate.getTime() < hCellStartDate.getTime()) {
                    if (viewType === 'timelineWeek' || viewType === 'timelineDay') {
                        while (hCellEndDate.getTime() < hCellStartDate.getTime()) {
                            const hour = hCellEndDate.getHours();

                            hCellEndDate.setHours(hour + 1, 0, 0, 0);

                            //Safari bug fix
                            if (hour === hCellEndDate.getHours()) {
                                hCellEndDate.setHours(hCellEndDate.getHours() + 2, 0, 0, 0);
                            }
                        }
                    }
                    else {
                        hCellEndDate.setDate(hCellEndDate.getDate() + 1);
                        hCellEndDate.setHours(0, 0, 0, 0);
                    }
                }

                if (!isAgendaView) {
                    eventCopy.dateStart = hCellStartDate;
                    eventCopy.dateEnd = hCellEndDate;
                }

                let lastCellObj;

                //Finds the correct vertical cell objects and creates a horizontal/vertical cell object that represents a single timeline cell
                that._getCellRanges(that._getEventVerticalCellObjs(eventCopy), 'vertical').forEach(range => {
                    const fromVIndex = range.fromIndex,
                        toVIndex = range.toIndex;

                    for (let k = fromVIndex; k <= toVIndex; k++) {
                        const vCell = vCells[k],
                            cellGroup = vCell.group;

                        if (cellGroup && !that._isEventPartOfGroup(eventCopy, cellGroup)) {
                            continue;
                        }

                        //NOTE: In Agenda view, the cells are the same as the events
                        if (isAgendaView && (lastCellObj && lastCellObj.date.getTime() === vCell.date.getTime() ||
                            usedTimelineCells.some(cObj => cObj.horizontal === hCell && cObj.vertical === vCell))) {
                            continue
                        }

                        const cellObj = { horizontal: hCell, vertical: vCell };

                        // if (i === fromHIndex && k === fromVIndex) {
                        if ((!isTimelineView || i === fromHIndex) && k === fromVIndex) {
                            if (eventStartScaleIndex === undefined) {
                                eventStartScaleIndex = that._getEventScaleIndex(eventObj, isTimelineView ? hCell : vCell).start;
                            }

                            cellObj.scaleIndex = eventStartScaleIndex;
                        }
                        // else if (i === toHIndex && k === toVIndex) {
                        else if ((!isTimelineView || i === toHIndex) && k === toVIndex) {
                            if (eventEndScaleIndex === undefined) {
                                eventEndScaleIndex = that._getEventScaleIndex(eventObj, isTimelineView ? hCell : vCell).end;
                            }

                            cellObj.scaleIndex = eventEndScaleIndex;
                        }

                        lastCellObj = vCell;
                        eventViewCells.push(cellObj);
                        usedTimelineCells.push(cellObj);
                    }
                })
            }
        })

        return eventViewCells
    }

    /**
     * Returns the timeline cells used for the event in Month View
     * @param {Object} eventObj - the event object
     * @param {*} usedTimelineCells - timeline cells that have been used
     */
    _getEventTimelineCellsMonth(eventObj) {
        const that = this,
            eventDateStart = new Date(eventObj.dateStart),
            eventDateEnd = new Date(eventObj.dateEnd),
            hCells = that._timelineCells.horizontal,
            vCells = that._timelineCells.vertical;
        const eventCopy = Object.assign({}, eventObj);
        let eventViewCells = [];

        //Finds the correct vertical cell objects and creates a horizontal/vertical cell object that represents a single timeline cell
        that._getCellRanges(that._getEventVerticalCellObjs(eventObj), 'vertical').forEach(range => {
            const fromVIndex = range.fromIndex,
                toVIndex = range.toIndex;

            for (let k = fromVIndex; k <= toVIndex; k++) {
                const vCell = vCells[k],
                    vCellStartDate = new Date(vCell.date),
                    vCellEndDate = new Date(vCell.date),
                    cellGroup = vCell.group;

                if (cellGroup && !that._isEventPartOfGroup(eventObj, cellGroup)) {
                    continue;
                }

                //Set to the end of the week
                vCellEndDate.setDate(vCellEndDate.getDate() + 6);
                vCellEndDate.setHours(23, 59, 59, 999);
                vCellStartDate.setHours(0, 0, 0, 0);

                eventCopy.dateStart = new Date(Math.max(eventDateStart.getTime(), vCellStartDate.getTime()));
                eventCopy.dateEnd = new Date(Math.min(eventDateEnd.getTime(), vCellEndDate.getTime()));

                that._getCellRanges(that._getEventHorizontallCellObjs(eventCopy)).forEach(range => {
                    const fromHIndex = range.fromIndex,
                        toHIndex = range.toIndex;

                    for (let i = fromHIndex; i <= toHIndex; i++) {
                        const hCell = hCells[i],
                            cellGroup = vCell.group;

                        if (cellGroup && !that._isEventPartOfGroup(eventObj, cellGroup)) {
                            continue;
                        }

                        const cellObj = { horizontal: hCell, vertical: vCell };

                        if (k === fromVIndex || k === toVIndex) {
                            cellObj.scaleIndex = 0;
                        }

                        eventViewCells.push(cellObj);
                    }
                })
            }
        })

        return eventViewCells
    }

    /**
     * Returns array of timeline cell ranges for each event cell
     * @param {Array<HTMLElement>} viewCells - the timeline cells used for the event
     * @param {*} timelineCells - all timeline cells
     */
    _getEventTimelineCellRanges(eventCellObjs, isAllDayEvent) {
        const that = this,
            viewType = that.viewType;

        if (!eventCellObjs.length) {
            return []
        }

        //Returns an array of timeline cell ranges. Each range represents an event cell
        if (viewType === 'agenda') {
            return eventCellObjs.map(c => [c])
        }
        else {
            let lastCellObj, cellRange = [], cellRanges = [];
            const isVertical = ['day', 'week'].indexOf(viewType) > -1 && !isAllDayEvent;

            for (let i = 0; i < eventCellObjs.length; i++) {
                const cellObj = eventCellObjs[i];

                if (!lastCellObj) {
                    cellRange.push(lastCellObj = cellObj);
                    continue;
                }

                const hCellObj = cellObj.horizontal,
                    vCellObj = cellObj.vertical,
                    lastHCellObj = lastCellObj.horizontal,
                    lastVCellObj = lastCellObj.vertical,
                    cellOffset = that._getCellOffset(cellObj, vCellObj.scaleIndex === undefined),
                    lastCellOffset = that._getCellOffset(lastCellObj, vCellObj.scaleIndex === undefined);

                if ((!isVertical && (vCellObj !== lastVCellObj || lastCellOffset.right !== cellOffset.left)) ||
                    (isVertical && (hCellObj !== lastHCellObj || lastCellOffset.bottom !== cellOffset.top))) {
                    cellRanges.push(cellRange);
                    cellRange = [cellObj];
                }
                else {
                    cellRange.push(cellObj);
                }

                lastCellObj = cellObj;
            }

            if (cellRange.length) {
                cellRanges.push(cellRange);
            }

            return cellRanges
        }
    }

    /**
     * Returns the width/height of a timeline cell
     * @param {HTMLElement} cell - Timeline view cell
     */
    _getCellSize(cell) {
        const that = this,
            viewType = that.viewType;
        let vCell, hCell;

        if (cell) {
            let cellObj = cell;

            if (cell instanceof HTMLElement) {
                cellObj = cell.$ ? cell.$.cellObj : undefined;
            }

            if (!cellObj) {
                return { width: 0, height: 0 }
            }

            vCell = cellObj.vertical;
            hCell = cellObj.horizontal;
        }
        else {
            const timelineCells = that._timelineCells,
                vCells = timelineCells.vertical,
                hCells = timelineCells.horizontal;

            if (!vCells.length || !hCells.length) {
                return { width: 0, height: 0 }
            }

            vCell = vCells[0];
            hCell = hCells[0];
        }

        const scaleCount = that._getCellsScaleCount();
        let width, height;

        switch (viewType) {
            case 'agenda':
            case 'month':
            case 'timelineMonth':
                width = hCell.width;
                height = vCell.height;
                break;
            case 'day':
            case 'week':
                width = hCell.width;
                height = vCell.height / scaleCount;
                break;
            case 'timelineDay':
            case 'timelineWeek':
                width = hCell.width / scaleCount;
                height = vCell.height;
                break;
        }

        return { width: width, height: height }
    }


    /**
     * Returns the left/top of a timeline cell
     * @param {HTMLElement} cell - Timeline view cell
     */
    _getCellOffset(cell, ignoreScaleIndex) {
        const that = this,
            viewType = that.viewType;
        let vCell, hCell, cellObj = cell;

        if (!cell) {
            return { left: 0, top: 0 }
        }

        if (cell instanceof HTMLElement) {
            cellObj = cell.$ ? cell.$.cellObj : undefined;
        }

        if (!cellObj) {
            return { left: 0, top: 0 }
        }

        vCell = cellObj.vertical;
        hCell = cellObj.horizontal;

        const scaleCount = that._getCellsScaleCount(),
            scaleIndex = ignoreScaleIndex || cellObj.allDay ? 0 : (cellObj.scaleIndex || 0);

        let left, top;

        switch (viewType) {
            case 'agenda':
            case 'month':
            case 'timelineMonth':
                left = hCell.left;
                top = vCell.top;
                break;
            case 'day':
            case 'week':
                left = hCell.left;
                top = parseFloat((vCell.top + (vCell.height / scaleCount) * scaleIndex).toFixed(2));
                break;
            case 'timelineDay':
            case 'timelineWeek':
                left = parseFloat((hCell.left + (hCell.width / scaleCount) * scaleIndex).toFixed(2));
                top = vCell.top;
                break;
        }

        const right = parseFloat((left + hCell.width).toFixed(2)),
            bottom = parseFloat((top + vCell.height).toFixed(2));

        return { left: left, right: right, top: top, bottom: bottom }
    }

    /**
     * Returns the dateEnd of a cell
     * @param {Date} dateStart
     */
    _getCellDateRange(cell) {
        const that = this;
        let cellObj = cell;

        if (cell instanceof HTMLElement) {
            cellObj = cell && cell.$ ? cell.$.cellObj : undefined;
        }

        if (!cellObj) {
            return
        }

        const viewType = that.viewType;
        let dateStart = new Date(cellObj.time ? cellObj.time : that._getCellTime(cellObj)),
            dateEnd = new Date(dateStart);

        switch (viewType) {
            case 'agenda':
            case 'month':
            case 'timelineMonth':
                dateEnd.setHours(23, 59, 59, 999);
                break;
            case 'week':
            case 'day':
            case 'timelineWeek':
            case 'timelineDay': {
                if (cellObj.allDay) {
                    dateEnd.setHours(23, 59, 59, 999);
                }
                else {
                    dateEnd = new Date(dateEnd.getTime() + (60 / that._getCellsScaleCount()) * 60 * 1000);
                }
                break;
            }
        }

        return { dateStart: dateStart, dateEnd: dateEnd }
    }

    /**
     * Sets the content of an event cell
     * @param {HTMLElement} eventCell - the event cell
     * @param {Object} eventObj - the event object
     */
    _setEventCellContent(eventCell, eventDetails) {
        const that = this,
            eventObj = eventDetails.eventObj;

        if (!eventCell || !eventObj) {
            return
        }

        const isDayOrWeekView = eventDetails.isDayOrWeekView,
            isAllDayEvent = eventDetails.isAllDayEvent;
        let eventContent = eventCell.querySelector('.smart-scheduler-event-content');

        //Collector
        if (eventCell.$ && eventCell.$.events) {
            const collectorEvents = eventCell.$.events;

            if (!eventContent) {
                eventCell.innerHTML = '<div class="smart-scheduler-event-content"><div></div></div>';
                eventContent = eventCell.firstElementChild;
            }

            if (that.eventCollectorTemplate) {
                that._applyTemplate('eventCollectorTemplate', eventContent, collectorEvents.map(e => that._cloneObject(e)));
            }
            else {
                const eventRenderMode = that.eventRenderMode,
                    isMobile = that.$.timeline.hasAttribute('mobile'),
                    content = collectorEvents.length + (isMobile || eventRenderMode === 'modern' && isDayOrWeekView && !isAllDayEvent ? '' :
                        ' ' + that.localize('collector'));

                //NOTE: Using an additional DIV for text-overflow: ellispsis
                eventContent.firstElementChild.textContent = content;
            }
            return
        }

        if (!eventContent) {
            eventCell.innerHTML = '<div class="smart-scheduler-event-content"></div><div class="smart-scheduler-event-button"></div>';
            eventContent = eventCell.firstElementChild;
        }

        const eventButton = eventCell.querySelector('.smart-scheduler-event-button');
        let labelElement;

        if (eventButton) {
            eventButton.tabIndex = eventDetails.tabIndex;
        }

        //Set the content
        if (eventDetails.isTooltipEvent && that.eventTooltipTemplate) {
            that._applyTemplate('eventTooltipTemplate', eventContent, that._cloneObject(eventObj));
        }
        else if (that.eventTemplate) {
            that._applyTemplate('eventTemplate', eventContent, that._cloneObject(eventObj));
        }
        else {
            const isMonthView = eventDetails.isMonthView !== undefined ? eventDetails.isMonthView : ['timelineMonth', 'month'].indexOf(that.viewType) > -1;
            let timeElement = eventContent.querySelector('.smart-scheduler-event-time'),
                label = eventObj.label;

            labelElement = eventContent.querySelector('.smart-scheduler-event-label');

            const locale = that.locale,
                eventDateStart = eventObj.dateStart,
                eventDateEnd = eventObj.dateEnd;
            let timeRange;

            if (eventDetails.isAllDayEvent || isMonthView) {
                const monthFormat = 'short',
                    dayFormat = that.dayFormat;

                if (eventDateStart.getFullYear() === eventDateEnd.getFullYear() && eventDateStart.getMonth() === eventDateEnd.getMonth() &&
                    eventDateStart.getDate() === eventDateEnd.getDate()) {
                    timeRange =
                        new Intl.DateTimeFormat(locale, { day: dayFormat, month: monthFormat }).format(eventDateStart);
                }
                else {
                    const dateTimeFormat = new Intl.DateTimeFormat(locale, { day: dayFormat, month: monthFormat });
                    timeRange = dateTimeFormat.format(eventDateStart) + ' - ' + dateTimeFormat.format(eventDateEnd);
                    if (eventObj.allDay) {
                        if (eventDateStart.toString() === eventDateEnd.toString()) {
                            timeRange = dateTimeFormat.format(eventDateStart);
                        }
                    }
                }
            }
            else {
                const dateTimeFormat = new Intl.DateTimeFormat(locale, { hour: that.hourFormat, minute: that.minuteFormat });
                timeRange = dateTimeFormat.format(eventDateStart) + ' - ' + dateTimeFormat.format(eventDateEnd);
                if (eventObj.allDay) {
                    const monthFormat = 'short',
                        dayFormat = that.dayFormat;
                    timeRange =
                        new Intl.DateTimeFormat(locale, { day: dayFormat, month: monthFormat }).format(eventDateStart);
                }
            }

            if (!timeElement || !labelElement) {
                //NOTE: The <div> wrapper is needed for text-overflow:ellipsis
                if (!(eventObj.label + '')) {
                    eventContent.innerHTML = '<div role="presentation"><label class="smart-scheduler-event-time"></label></div>';
                }
                else {
                    eventContent.innerHTML = `
                            <div role="presentation"><label class="smart-scheduler-event-label"></label></div>
                            <div role="presentation"><label class="smart-scheduler-event-time"></label></div>`;
                }

                labelElement = eventContent.querySelector('.smart-scheduler-event-label');
                timeElement = eventContent.querySelector('.smart-scheduler-event-time');
            }

            if (labelElement) {
                labelElement.textContent = label;
            }

            if (timeElement) {
                timeElement.textContent = timeRange;

                //NOTE: 45 pixels is the min size that determines whether to show the timeRange or not
                if (labelElement && isMonthView && eventDetails.eventSize < 45) {
                    eventContent.setAttribute('single-line', '');
                }
                else {
                    eventContent.removeAttribute('single-line');
                }
            }


            if (eventDetails.isTooltipEvent && eventObj.conference) {
                const valid = /^(ftp|http|https):\/\/[^ "]+$/.test(eventObj.conference);

                if (valid) {
                    const link = document.createElement('div');
                    link.innerHTML = `<a target="_blank" href="${eventObj.conference}" class="info">${that.localize('join')}</a>`;
                    link.classList.add('meeting');

                    const conference = eventObj.conference;

                    if (conference.startsWith('https://zoom.us/')) {
                        link.innerHTML = `<a target="_blank" href="${eventObj.conference}" class="info">${that.localize('joinWith', { value: 'Zoom' })}</a>`;
                    }
                    else if (conference.startsWith('https://meet.google.com/')) {
                        link.innerHTML = `<a target="_blank" href="${eventObj.conference}" class="info">${that.localize('joinWith', { value: 'Google Meet' })}</a>`;
                    }
                    else if (conference.startsWith('https://teams.microsoft.com/')) {
                        link.innerHTML = `<a target="_blank" href="${eventObj.conference}" class="info">${that.localize('joinWith', { value: 'Microsoft Teams' })}</a>`;
                    }

                    eventContent.appendChild(link);
                }
            }
        }
    }

    /**
     * Creates the timeline
     */
    _createTimeline() {
        const that = this,
            resizeTrigger = that.resizeTrigger,
            scrollTop = that.scrollTop,
            scrollLeft = that.scrollLeft,
            timeline = that.$.timeline;
        let triggerWidth, triggerHeight;

        //NOTE: Avoids resizeEvent being thrown unnecessarily
        if (resizeTrigger) {
            triggerWidth = resizeTrigger.offsetWidth;
            triggerHeight = resizeTrigger.offsetHeight;
            resizeTrigger.style.display = 'none';
        }

        delete that._selectedCellObj;
        delete that._eventsBetween;

        that._createTimelineHeader();
        that._refreshTimelineContentCells();
        that._handleMenuAria();

        if (timeline.classList.contains('no-agenda')) {
            timeline.setAttribute('agenda-placeholder', that.localize('agendaPlaceholder'))
        }
        else {
            timeline.removeAttribute('agenda-placeholder');
        }

        //Restore the previous scroll position
        that.scrollTop = scrollTop;
        that.scrollLeft = scrollLeft;

        if (resizeTrigger) {
            resizeTrigger.style.display = null;

            if (triggerWidth !== resizeTrigger.offsetWidth || triggerHeight !== resizeTrigger.offsetHeight) {
                that._noResizeHandler = true;
            }
        }

        //Refreshes the events
        that._refreshEvents();

        //Checks the events for notifications
        that._checkNotifications();
    }

    /**
     * Creates the Timeline Header
     */
    _createTimelineHeader() {
        const that = this,
            timelineContent = that.$.timelineContent;

        timelineContent.style.width = timelineContent.style.height = null;

        //NOTE: CSS grid/flex bug in Chrome. Needs CSS reflow
        if (Smart.Utilities.Core.Browser.Chrome) {
            const vHeader = that.$.timelineHeaderVertical;

            vHeader.style.display = 'none';
            vHeader.offsetHeight;
            vHeader.style.display = null;
        }

        //Validates the endDate of the events according to the AllDay option
        that._validateEventDateRange();

        //Creates the header cell objects
        that._createTimelineCellsObj();

        //Creates the Horizontal Timeline Header View cells
        that._createTimelineHeaderCells('horizontal');

        //Creates the Vertical Timeline Header View cells
        that._createTimelineHeaderCells('vertical');

        //Refreshes the content of the Timeline header cells
        that._refreshTimelineHeaderCells();

        //Crеates/refreshes the All day cells
        that._refreshTimelineAllDayCells();

        //Refresh the ScrollBars
        that._refresh();
    }

    /**
     * Validates the dateEnd according to it's duration,view and allDay property
     */
    _validateEventDateRange(event) {
        const that = this,
            viewType = that.viewType;

        if (['month', 'agenda'].indexOf(viewType.toLowerCase()) > -1) {
            return
        }

        const isDayOrWeekView = viewType === 'day' || viewType === 'week',
            events = event ? [event] : that._events,
            dayDuration = 24 * 60 * 60 * 1000;

        for (let i = 0; i < events.length; i++) {
            const event = events[i],
                dateStart = event.dateStart,
                dateEnd = event.dateEnd;

            if (isDayOrWeekView && dateEnd.getTime() - dateStart.getTime() >= dayDuration) {
                event.allDay = true;
            }

            if (event.allDay) {
                event.dateStart.setHours(0, 0, 0, 0);
                event.dateEnd.setHours(23, 59, 59, 999);
            }
        }
    }

    /**
     * Sets the aria attributes for handling the menu
     */
    _handleMenuAria() {
        const that = this,
            currentDate = that.$.currentDate,
            viewItemsButton = that.$.viewItemsButton,
            tooltip = that.$.tooltip;

        //Note: Most Menu components are dynamically created. Hence they cannot be assigned by default
        // currentDate.setAttribute('aria-controls', that.id + 'Calendar');
        currentDate.setAttribute('aria-haspopup', true);
        viewItemsButton.setAttribute('aria-controls', tooltip.id);
        viewItemsButton.setAttribute('aria-haspopup', true);
        //NOTE: Timeline Cells and Events also have these props set in their rendering methods
    }

    /**
     * Creates/Removes the timeline group header
     */
    _handleTimelineGroupHeader(cellsCountObj) {
        const that = this,
            groups = that._timelineCells.groups;
        let groupContainer = that.$.groupsContainer;


        if (!groups || !groups.length || (that.viewType === 'agenda' && !Object.keys(cellsCountObj.vertical).length)) {
            if (groupContainer) {
                groupContainer.remove();
            }
            return;
        }

        //Create the groups container
        if (!groupContainer) {
            groupContainer = document.createElement('div');
            groupContainer.classList.add('smart-scheduler-groups-container');
            // groupContainer.setAttribute('role', 'row');
            groupContainer.innerHTML = `
                        <div class="smart-scheduler-view-groups-label-container" role="row"></div>
                        <div class="smart-scheduler-view-groups-content" role="presentation">
                            <div class="smart-scheduler-view-header-groups-container" role="presentation"></div>
                        </div>`;

            that.$.groupsContainer = groupContainer;
        }

        const view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            groupOrientation = viewDetails && viewDetails.groupOrientation ? viewDetails.groupOrientation : that.groupOrientation,
            container = groupOrientation !== 'vertical' ? that.$.timelineHeaderHorizontal : that.$.timelineHeaderVertical;

        if (!container.contains(groupContainer)) {
            container.insertBefore(groupContainer, container.firstElementChild);
        }
    }

    /**
     *  Creates/Removes the timeline timeZone header
     */
    _handleTimeZoneHeader(orientation) {
        const that = this;

        if (!orientation) {
            orientation = 'horizontal';
            that._handleTimeZoneHeader('vertical');
        }

        const viewType = that.viewType.toLowerCase(),
            isTimelineView = viewType.indexOf('timeline') > -1,
            headerContent = orientation === 'vertical' ? that.$.timelineHeaderVerticalContent : that.$.timelineHeaderHorizontalContent,
            content = headerContent.querySelector('.smart-scheduler-view-time'),
            viewCells = content.children,
            timelineLineViewCellsLabelContainer = that.$.timelineViewCellsLabelContainer,
            areTimeZonesAllowed = (!isTimelineView && viewType !== 'agenda' && orientation === 'vertical') || (orientation === 'horizontal' && isTimelineView);
        let timeZones = that.timeZones.slice(0);
        const detailsLabel = that.$.viewDetailsLabel,
            allDayLabelContainer = that.$.timelineViewAllDay,
            timeZoneLabelContainer = that.$.timelineTimeZoneLabelContainer;

        timeZoneLabelContainer.remove();

        if (detailsLabel) {
            detailsLabel.remove();
        }

        //1 is for default group.
        that._recycleContainerCells({
            fragment: content,
            cellsNeeded: 1 + (areTimeZonesAllowed && viewType.indexOf('month') < 0 ? timeZones.length : 0),
            className: 'smart-scheduler-cells'
        });

        timeZones.push(that.timeZone);

        if (isTimelineView && areTimeZonesAllowed || !isTimelineView) {
            that._recycleContainerCells({
                fragment: timelineLineViewCellsLabelContainer,
                cellsNeeded: !isTimelineView && viewType.indexOf('month') < 0 && viewType !== 'agenda' ? timeZones.length : 0,
                className: 'smart-scheduler-time-zone'
            });
        }

        //NOTE:AllDay label container needs maxWidth set,because it's content may overflow
        if (allDayLabelContainer.offsetHeight && timelineLineViewCellsLabelContainer.offsetHeight) {
            that.$.timelineViewAllDaylabel.style.maxWidth = timelineLineViewCellsLabelContainer.offsetWidth + 'px';
        }

        //Handle TimeZone labelContainer
        if (areTimeZonesAllowed) {
            const parentContainer = timeZoneLabelContainer.parentElement;


            that._recycleContainerCells({
                fragment: timeZoneLabelContainer,
                cellsNeeded: viewCells.length === 1 ? 0 : viewCells.length, //Default Timezone
                className: 'smart-scheduler-time-zone'
            });

            if (viewCells.length && parentContainer) {
                parentContainer.appendChild(timeZoneLabelContainer);
            }
        }
    }

    /**
     * Creates the Header cells
     * @param {String} orientation
     */
    _createTimelineHeaderCells(orientation = 'vertical') {
        const that = this,
            viewType = that.viewType.toLowerCase(),
            isTimelineView = viewType.indexOf('timeline') > -1,
            headerContent = orientation === 'vertical' ? that.$.timelineHeaderVerticalContent : that.$.timelineHeaderHorizontalContent,
            content = headerContent.querySelector('.smart-scheduler-view-time'),
            details = headerContent.querySelector('.smart-scheduler-view-details'),
            viewCells = content.children,
            areTimeZonesAllowed = (!isTimelineView && viewType !== 'agenda' && orientation === 'vertical') || (orientation === 'horizontal' && isTimelineView);
        let timeZones = that.timeZones.slice(0);

        //Create addtional timeZone cell containers
        const cellsNeeded = that._getTimelineVisibleCellsCount(orientation),
            defaultTimeZone = that.timeZone,
            viewCellsCount = viewCells.length;

        timeZones.push(that.timeZone);

        for (let i = 0; i < viewCellsCount; i++) {
            const fragment = viewCells[i],
                timeZone = timeZones[i];

            fragment.timeZone = viewCellsCount === 1 ? defaultTimeZone : (timeZone.id || timeZone);

            that._recycleContainerCells({ fragment: fragment, cellsNeeded: cellsNeeded });
        }

        //Recycle the Header Details Container cells
        if (details) {
            that._recycleContainerCells({
                fragment: details,
                cellsNeeded: that._getTimelineVisibleCellsCount({ orientation: orientation, type: 'details' })
            });
        }

        //Creates the group cells
        that._createTimelineHeaderGroupCells(orientation);

        if (areTimeZonesAllowed) {
            const timeZoneLabelContainer = that.$.timelineTimeZoneLabelContainer,
                timelineLineViewCellsLabelContainer = that.$.timelineViewCellsLabelContainer;

            timeZoneLabelContainer.remove();

            const allDayLabelContainer = that.$.timelineAllDayLabelContainer;
            let viewDetailsLabel = that.$.viewDetailsLabel;

            //View Details are only available in 'timelineWeek'
            if (isTimelineView && viewType.indexOf('week') > -1 && details) {
                if (!viewDetailsLabel) {
                    viewDetailsLabel = document.createElement('div');
                    viewDetailsLabel.classList.add('smart-scheduler-view-details-label');
                    that.$.viewDetailsLabel = viewDetailsLabel;
                }

                if (!viewDetailsLabel.parentElement) {
                    timelineLineViewCellsLabelContainer.appendChild(viewDetailsLabel);
                }
            }
            else if (viewDetailsLabel && viewDetailsLabel.parentElement) {
                viewDetailsLabel.remove();
            }

            if (!timeZoneLabelContainer.children.length) {
                return;
            }

            if (!isTimelineView && allDayLabelContainer.offsetHeight) {
                allDayLabelContainer.appendChild(timeZoneLabelContainer);
            }
            else if (timelineLineViewCellsLabelContainer.offsetHeight) {
                timelineLineViewCellsLabelContainer.appendChild(timeZoneLabelContainer);
            }
        }
    }

    /**
     * Creates the Header group cells
     * @param {String} orientation
     */
    _createTimelineHeaderGroupCells(orientation) {
        const that = this,
            view = that.view,
            viewType = that.viewType,
            isTimelineView = viewType.indexOf('timeline') > -1,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            timelineCells = that._timelineCells,
            groups = timelineCells.groups,
            groupOrientation = viewDetails && viewDetails.groupOrientation ? viewDetails.groupOrientation : that.groupOrientation;
        let groupContainer = that.$.groupsContainer;

        if ((orientation === 'vertical' && groupOrientation !== 'vertical') ||
            (((orientation === 'horizontal' && viewType !== 'day') || !orientation) && groupOrientation === 'vertical')) {
            return;
        }

        if (groupContainer) {
            groupContainer.remove();
        }

        if (!groups || !groups.length || (viewType === 'agenda' && !timelineCells.vertical.length)) {
            return;
        }

        const groupHeaders = that._timelineCells.groups,
            groupsContainer = groupContainer.querySelector('.smart-scheduler-view-header-groups-container'),
            resourceGroups = groupsContainer.children;

        that._recycleContainerCells({
            fragment: groupsContainer,
            cellsNeeded: groupHeaders.length,
            className: 'smart-scheduler-cell-container',
            role: 'row'
        });

        for (let i = 0; i < resourceGroups.length; i++) {
            that._recycleContainerCells({
                fragment: resourceGroups[i],
                cellsNeeded: that._getTimelineVisibleCellsCount({ orientation: orientation, type: 'groups', resource: groupHeaders[i].resource })
            });
        }

        let timeZones = orientation === 'vertical' || viewType.toLowerCase().indexOf('month') > -1 ? 0 :
            (that.timeZones.length + (viewType === 'month' ? 0 : 1));

        if (isTimelineView) {
            timeZones = timeZones > 1 ? 1 : 0;
        }

        if (viewType === 'agenda') {
            timeZones = groupOrientation !== 'vertical' && that._timelineCells.vertical.length ? 1 : 0;
        }

        that._recycleContainerCells({
            fragment: groupContainer.querySelector('.smart-scheduler-view-groups-label-container'),
            cellsNeeded: timeZones,
            className: 'smart-scheduler-time-zone'
        });

        if (!groupContainer.parentElement && orientation === groupOrientation) {
            const container = orientation === 'horizontal' ? that.$.timelineHeaderHorizontal : that.$.timelineHeaderVertical;

            container.insertBefore(groupContainer, container.firstElementChild);
        }
    }

    /**
     * Recycles the cells of a container
     * @param {Object} data
     */
    _recycleContainerCells(data) {
        const that = this,
            fragment = data.fragment;

        if (!fragment) {
            return
        }

        const cells = fragment.children,
            cellsAvailable = fragment.children.length,
            cellsNeeded = data.cellsNeeded,
            className = data.className,
            role = data.role,
            child = data.isBackwards ? 'lastElementChild' : 'firstElementChild';

        if (cellsAvailable > cellsNeeded) {
            while (cells.length && cells.length !== cellsNeeded) {
                fragment.removeChild(fragment[child]);
            }
        }
        else if (cellsAvailable < cellsNeeded) {
            fragment.appendChild(that._createCells(cellsNeeded - cellsAvailable, className, role));
        }
    }

    /**
     *Creates the cell objects ( virtual cells)
     */
    _createTimelineCellsObj() {
        const that = this,
            viewType = that.viewType,
            isTimelineView = viewType.indexOf('timeline') > -1,
            cellsCountObj = that._getCellsCount(),
            scaleCount = that._getCellsScaleCount(),
            computedStyle = window.getComputedStyle(that);

        if (that.timeZones.length > 0 && isTimelineView && viewType !== 'timelineMonth') {
            that.$.timeline.setAttribute('show-vertical-header', '');
        }
        else {
            that.$.timeline.removeAttribute('show-vertical-header');
        }

        let cellHeight = Math.max(parseFloat(computedStyle.getPropertyValue('--smart-scheduler-timeline-cell-height')) || 0,
            parseFloat(computedStyle.getPropertyValue('--smart-scheduler-timeline-cell-min-height') || 0)),
            cellWidth = Math.max(parseFloat(computedStyle.getPropertyValue('--smart-scheduler-timeline-cell-width')) || 0,
                parseFloat(computedStyle.getPropertyValue('--smart-scheduler-timeline-cell-min-width') || 0));

        //Caches the CSS variables for later use
        that._eventSize = parseFloat(computedStyle.getPropertyValue('--smart-scheduler-event-size')) || 0;
        that._allDayCellSize = parseFloat(computedStyle.getPropertyValue('--smart-scheduler-timeline-header-all-day-cells-size')) || that.$.timelineViewAllDay.offsetHeight;

        if (!that.__allDayCellSize) {
            that.__allDayCellSize = that._allDayCellSize;
        }

        that._eventCollectorSize = parseFloat(computedStyle.getPropertyValue('--smart-scheduler-event-collector-size')) || 0;
        // that._eventDefaultBackgroundColor = computedStyle.getPropertyValue('--smart-scheduler-event-background').trim();
        that._monthViewNumberSize = viewType !== 'month' ? 0 : parseFloat(computedStyle.getPropertyValue('--smart-scheduler-month-view-number-size')) || 0;

        if (viewType.indexOf('timeline') > -1) {
            cellWidth *= scaleCount;
        }
        else {
            cellHeight *= scaleCount;
        }

        //Creates Timeline Cell object
        that._timelineCells = {};
        that._scrollViewSize = {};

        //Header details cell objects
        if (that.groups.length) {
            that._timelineCells.groups = that._getTimelineCellsObjGroups();
        }

        //Create/Remove the timeline group header
        that._handleTimelineGroupHeader(cellsCountObj);

        //Creates/Removes the timeZones header
        that._handleTimeZoneHeader();

        //Refresh the scroll bars
        that._refresh();

        //Calculate Timeline Content size and Scrollbars visibility
        that._handleTimelineContentSize(cellsCountObj, cellHeight, 'height');

        let viewSize = that.$.timelineContainer.offsetHeight;

        that._handleTimelineContentSize(cellsCountObj, cellWidth, 'width');

        if (viewSize !== (viewSize = that.$.timelineContainer.offsetHeight)) {
            that._handleTimelineContentSize(cellsCountObj, cellHeight, 'height');
        }

        //Caches the offsetWith/offsetHeight of the scrollable area to avoid reflows later
        that._scrollViewSize.height = viewSize;
        that._scrollViewSize.width = that.$.timelineContainer.offsetWidth;

        //Creates Timeline Cell object
        that._timelineCells.horizontal = that._getTimelineCellsObjHorizontal(cellsCountObj.horizontal, cellWidth);
        that._timelineCells.vertical = that._getTimelineCellsObjVertical(cellsCountObj.vertical, cellHeight);

        //Header details cell objects
        if (viewType === 'timelineWeek') {
            that._timelineCells.details = that._getTimelineCellsObjDetails();
        }
    }

    /**
     * Returns the Timeline Group Header cell objects
     */
    _getResourceGroups() {
        const that = this,
            groups = that.groups,
            resources = that.resources;
        let resourceGroups = [], groupTimelineCells = [], parentGroup;

        if (!groups.length || !resources.length) {
            return groupTimelineCells;
        }

        //Creates resource group objects
        for (let g = 0; g < groups.length; g++) {
            const groupDetails = resources.find(res => res.value === groups[g]);

            if (!groupDetails || !groupDetails.dataSource.length) {
                continue;
            }

            const subGroups = that._getResourceData(groupDetails);

            if (Object.keys(subGroups).length) {
                const groups = Object.values(subGroups),
                    parentCells = parentGroup ? parentGroup.cells.length : 1;
                let cells = [];

                that._applyResourceSorting(groupDetails, groups);

                for (let i = 0; i < parentCells; i++) {
                    for (let k = 0; k < groups.length; k++) {
                        const cell = {
                            resource: groupDetails.value,
                            label: groups[k].label,
                            group: parentGroup ? Object.assign({}, parentGroup.cells[i].group) : {},
                            groupSeparator: true
                        };

                        cell.group[groupDetails.value] = groups[k].id;

                        cells.push(cell);
                    }
                }

                resourceGroups.push(parentGroup = {
                    resource: groupDetails.value,
                    groups: groups,
                    cells: cells
                });
            }
        }

        return resourceGroups
    }

    /**
     * Returns the sub groups of a resource based on it's dataSource property
     * @param {object} resourceObj - the resource object
     * @returns 
     */
    _getResourceData(resourceObj) {
        const dataSource = resourceObj ? resourceObj.dataSource : undefined;

        if (!dataSource || !dataSource.length) {
            return
        }

        let subGroups = {};

        for (let i = 0; i < dataSource.length; i++) {
            const group = dataSource[i];

            subGroups[group.id] = {
                id: group.id,
                label: group.label,
                color: group.color
            }
        }



        return subGroups
    }

    /**
     * Applies sorting to the Resource data
     * @param {object} resourceObj - the resource object
     * @param {array} groups - the resource dataSource array with the sub groups
     * @returns 
     */
    _applyResourceSorting(resourceObj, groups) {
        const that = this,
            customSortFunction = resourceObj.sortFunction ? resourceObj.sortFunction : that.sortFunction,
            sortBy = resourceObj.sortBy ? resourceObj.sortBy : that.sortBy,
            sortOrder = resourceObj.sortOrder ? resourceObj.sortOrder : that.sortOrder;

        if (!sortBy) {
            return
        }

        const sortFunc = (a, b) => {
            const aValue = a[sortBy],
                bValue = b[sortBy];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return aValue.toLowerCase().localeCompare(bValue.toLowerCase())
            }
            else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
                return aValue === bValue
            }
            else if (aValue instanceof Date && bValue instanceof Date) {
                return aValue.getTime() - bValue.getTime()
            }
            else {
                return aValue - bValue
            }
        };

        switch (sortOrder) {
            case 'asc':
            case 'ascending':
                groups.sort((a, b) => sortFunc(a, b));
                break;
            case 'desc':
            case 'descending':
                groups.sort((a, b) => sortFunc(b, a));
                break;
            case 'custom':
                if (typeof customSortFunction === 'function') {
                    groups.sort(customSortFunction);
                }
                break;
            default:
                return
        }
    }

    /**
    * Returns the Timeline Group cell objects
    */
    _getTimelineCellsObjGroups() {
        const that = this,
            groups = that._getResourceGroups();
        let groupTimelineCells = [];

        if (!groups.length) {
            return groupTimelineCells;
        }

        //Create the group cells
        for (let i = groups.length - 1; i > -1; i--) {
            const resGroup = groups[i];

            if (!groupTimelineCells.length) {
                resGroup.groups.forEach(group => {
                    const groupCell = {
                        label: group.label,
                        color: group.color,
                        group: {},
                        resource: resGroup.resource,
                        groupSeparator: true
                    };

                    //Set the group as { resource : groupId}
                    groupCell.group[resGroup.resource] = group.id;

                    groupTimelineCells.push(groupCell);
                });
            }
            else {
                const currentCells = groupTimelineCells.slice(0);

                groupTimelineCells = [];

                resGroup.groups.forEach(group => {
                    currentCells.forEach(groupCell => {
                        const newCell = Object.assign({}, groupCell);

                        newCell.group = Object.assign({}, newCell.group);
                        newCell.group[resGroup.resource] = group.id;

                        groupTimelineCells.push(newCell);
                    });
                })
            }
        }

        if (groupTimelineCells.length) {
            const view = that.view,
                viewDetails = that.views.find(v => v.value && v.value === view) || {},
                groupOrientation = viewDetails && viewDetails.groupOrientation ? viewDetails.groupOrientation : that.groupOrientation;

            that.$.timeline.setAttribute('show-group-header', groupOrientation);
        }
        else {
            that.$.timeline.removeAttribute('show-group-header');
        }

        groups[groups.length - 1].cells = groupTimelineCells;

        return groups
    }

    /**
    * Returns the Horizontal Timeline cells
    * @param {*} cellsWidthCount - cell count
    * @param {*} cellWidth - cell width
    */
    _getTimelineCellsObjHorizontal(cellsWidthCount, cellWidth) {
        const that = this,
            view = that.view,
            viewType = that.viewType,
            isTimelineView = view.indexOf('timeline') > -1,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            date = new Date(that.dateCurrent);

        if (isTimelineView) {
            date.setHours(that.hourStart, 0, 0, 0);
        }
        else {
            date.setHours(0, 0, 0, 0);
        }

        const firstDayOfWeek = that.firstDayOfWeek;
        let hideNonworkingWeekdays, hideWeekend;

        switch (viewType) {
            case 'week':
            case 'timelineWeek':
                if (that.viewStartDay !== 'dateCurrent') {
                    date.setDate(date.getDate() - date.getDay() + firstDayOfWeek);
                }
                hideWeekend = that.hideWeekend || viewDetails.hideWeekend
                hideNonworkingWeekdays = that.hideNonworkingWeekdays || viewDetails.hideNonworkingWeekdays;
                break;
            case 'month':
            case 'timelineMonth':
                date.setDate(1);

                if (!isTimelineView) {
                    if (that.viewStartDay !== 'dateCurrent') {
                        date.setDate(date.getDate() - date.getDay() + firstDayOfWeek);
                    }
                }

                date.setHours(0, 0, 0, 0);

                hideWeekend = that.hideWeekend || viewDetails.hideWeekend;
                hideNonworkingWeekdays = that.hideNonworkingWeekdays || viewDetails.hideNonworkingWeekdays;
                break;
        }

        return that._getCellsObject({
            orientation: 'horizontal',
            cells: [],
            cellSize: cellWidth,
            cellCount: cellsWidthCount,
            date: date,
            hideWeekend: hideWeekend,
            hideNonworkingWeekdays: hideNonworkingWeekdays,
            hourStart: that.hourStart,
            hourEnd: that.hourEnd,
            viewSize: that.$.timelineContent.offsetWidth,
            viewDetails: viewDetails,
            offset: 0
        });
    }

    /**
     * Returns the timeline cell objects
     * @param {Object} details - object with details for the cells
     */
    _getCellsObject(details) {
        const that = this,
            view = that.view,
            viewType = that.viewType,
            viewDetails = details.viewDetails || that.views.find(v => v.value && v.value === view) || {},
            groups = that._timelineCells.groups,
            groupOrientation = viewDetails && viewDetails.groupOrientation ? viewDetails.groupOrientation : that.groupOrientation,
            cellCount = details.cellCount,
            viewSize = details.viewSize,
            orientation = details.orientation,
            cells = details.cells;
        let cellSize = details.cellSize, groupCells,
            [size, offset] = orientation === 'horizontal' ? ['width', 'left'] : ['height', 'top'];

        details.restrictedDates = that.restrictedDates;
        details.restrictedHours = that.restrictedHours;

        if (groups && groups.length) {
            groupCells = groups[groups.length - 1].cells;
        }

        if (!groupCells || !groupCells.length || ((orientation === 'horizontal' && groupOrientation === 'vertical') ||
            (orientation === 'vertical' && groupOrientation !== 'vertical'))) {
            if (cellCount * cellSize < viewSize) {
                cellSize = viewSize / cellCount;
            }

            details.cellSize = parseFloat(cellSize.toFixed(2));

            if (viewType === 'agenda' && groupCells && groupCells.length) {
                details.groups = groupCells;
            }

            that._createCellObjects(details);
        }
        else {
            const groupCount = groupCells.length;

            if (cellCount === 1) {
                let newSize = viewSize / groupCount;

                if (newSize >= cellSize) {
                    cellSize = newSize;
                }
            }
            else {
                const cells = cellCount * groupCount;

                if (cells * cellSize < viewSize) {
                    cellSize = viewSize / cells;
                }
            }

            details.cellSize = parseFloat(cellSize.toFixed(2));

            if (that.groupByDate && orientation === groupOrientation) {
                details.groupHeader = groups[groups.length - 1];
                that._createCellObjects(details);
            }
            else {
                //Sets the size/offset of the main group cells
                for (let g = 0; g < groupCells.length; g++) {
                    const group = groupCells[g];

                    group[offset] = details.offset;

                    details.size = 0;
                    details.group = group.group;

                    that._createCellObjects(details);

                    group[size] = details.size || 0;

                    //Set the size/offset of the rest of the Header cells
                    that._refreshGroupHeaderCells(orientation, group);
                }

                if (!cells.length) {
                    that._createCellObjects(details);
                }
            }
        }

        return cells
    }

    /**
     * Refreshes the size/offset of the Group Header cells
     * @param {String} orientation -
     * @param {Object} group - a group cell object
     * @param {Date} date - a group date
     */
    _refreshGroupHeaderCells(orientation = 'horizontal', group) {
        const that = this,
            parentGroups = group.group,
            groupHeaders = that._timelineCells.groups;

        if (!groupHeaders) {
            return
        }

        let date = group.date,
            cellsName = date ? 'cellsByDate' : 'cells';
        const [size, offset] = orientation === 'horizontal' ? ['width', 'left'] : ['height', 'top'];

        groupHeaders.forEach(groupHeader => {
            if (groupHeader.resource !== group.resource) {
                const groupCells = groupHeader[cellsName];

                for (let i = 0; i < groupCells.length; i++) {
                    const groupHeaderCell = groupCells[i],
                        groupHeaderCellParentGroups = groupHeaderCell.group;

                    if (date && date.getTime() !== groupHeaderCell.date.getTime()) {
                        continue;
                    }

                    if (Object.keys(groupHeaderCellParentGroups).every(g => groupHeaderCellParentGroups[g] === parentGroups[g])) {
                        groupHeaderCell[size] = (groupHeaderCell[size] === undefined ? 0 : groupHeaderCell[size]) + group[size];

                        if (groupHeaderCell[offset] === undefined) {
                            groupHeaderCell[offset] = group[offset];
                        }
                    }
                }
            }
        });
    }

    /**
     * Creates the timeline cell objects
     * @param {Object} details - timeline cell details object
     */
    _createCellObjects(details) {
        const that = this;

        if (details.orientation === 'horizontal') {
            that._createCellsObjectHorizontal(details);
        }
        else {
            that._createCellsObjectVertical(details);
        }
    }

    /**
     * Creates the Horizontal Timeline cells objects
     * @param {Object} details
     */
    _createCellsObjectHorizontal(details) {
        if (!details) {
            return []
        }

        const that = this,
            viewType = that.viewType,
            isTimelineView = viewType.indexOf('timeline') > -1,
            horizontalTimelineCells = details.cells,
            date = new Date(details.date),
            cellWidth = details.cellSize,
            cellsWidthCount = details.cellCount,
            hideWeekend = details.hideWeekend,
            hideNonworkingWeekdays = details.hideNonworkingWeekdays,
            hourStart = details.hourStart,
            hourEnd = details.hourEnd,
            group = details.group,
            groupHeader = details.groupHeader,
            viewDetails = details.viewDetails,
            isTimelineWeekOrDayView = ['timelineDay', 'timelineWeek'].indexOf(viewType) > -1;
        let offset = details.offset, width = 0, cellObj, nonworkingDays, nonworkingHours, restrictedDates, restrictedHours;

        if (viewType === 'agenda') {
            nonworkingDays = nonworkingHours = restrictedDates = restrictedHours = [];
        }
        else {
            nonworkingDays = that.nonworkingDays;
            nonworkingHours = that.nonworkingHours;
            restrictedDates = details.restrictedDates;
            restrictedHours = details.restrictedHours;
        }

        if (isTimelineWeekOrDayView) {
            date.setHours(hourStart);
        }
        else {
            date.setHours(0, 0, 0, 0);
        }

        for (let i = 0; i < cellsWidthCount; i++) {
            cellObj = { width: cellWidth };

            if (hideNonworkingWeekdays) {
                let count = 0;
                const currentHour = date.getHours();

                while (count < 7 && nonworkingDays.indexOf(date.getDay()) > -1) {
                    date.setDate(date.getDate() + 1);
                    count++;
                }

                date.setHours(currentHour);
            }

            if (hideWeekend && [0, 6].indexOf(date.getDay()) > -1) {
                const currentHour = date.getHours();

                date.setDate(date.getDate() + 1);
                date.setHours(currentHour);
            }

            cellObj.restricted = that._isDateRestricted(date, restrictedDates);

            if (!cellObj.restricted && isTimelineView) {
                cellObj.restricted = that._isHourRestricted(date, restrictedHours);
            }

            const specialDate = that._isSpecialDate(date, that.specialDates);
            if (specialDate) {
                cellObj.specialDate = specialDate;
            }

            if (that.restricted) {
                for (let m = 0; m < that.restricted.length; m++) {
                    const restricted = that.restricted[m];

                    if (that._isDateRestricted(date, [restricted.date])) {
                        if (restricted.hours.length === 0) {
                            cellObj.restricted = true;
                        }
                    }
                }
            }

            if (viewType === 'agenda') {
                cellObj.noLabel = true;
            }
            else {
                cellObj.weekend = date.getDay() === 0 || date.getDay() === 6;
            }

            cellObj.nonworking = nonworkingDays.indexOf(date.getDay()) > -1;

            if (isTimelineWeekOrDayView) {
                cellObj.nonworking = cellObj.nonworking || nonworkingHours.indexOf(date.getHours()) > -1;
            }

            if (groupHeader) {
                details.offset = offset;
                details.date = date;

                that._createCellsObjByDate(cellObj, details);

                offset = details.offset;
            }
            else {
                if (group) {
                    cellObj.group = group;
                }

                cellObj.left = offset;
                cellObj.date = new Date(date);

                horizontalTimelineCells.push(cellObj);

                offset = parseFloat((offset + cellWidth).toFixed(2));
            }

            if (!isTimelineView || viewType === 'timelineMonth' || viewType === 'timelineWeek' && viewDetails && viewDetails.hideHours) {
                date.setDate(date.getDate() + 1);
                date.setHours(0, 0, 0, 0);
            }
            else {
                const currentHour = date.getHours();

                if (viewType === 'timelineWeek' && currentHour === hourEnd) {
                    date.setDate(date.getDate() + 1);
                    date.setHours(hourStart);
                }
                else {
                    //NOTE: Daylight saving time causes one hour loss
                    date.setHours(date.getHours() + 1);

                    //Safari bug fix
                    if (currentHour === date.getHours()) {
                        date.setHours(date.getHours() + 2);
                    }
                }
            }

            width += cellWidth;
        }

        //Set a separator on the last group cell object
        if (cellObj && group) {
            cellObj.groupSeparator = true;
        }

        details.offset = offset;
        details.size = width;
    }

    /**
     * Returns the Vertical Timeline cell objects
     * @param {*} cellHeightCount - cell count
     * @param {*} cellHeight - cell height
     */
    _getTimelineCellsObjVertical(cellHeightCount, cellHeight) {
        const that = this;

        return that._getCellsObject({
            orientation: 'vertical',
            cells: [],
            date: new Date(that.dateCurrent),
            cellSize: cellHeight,
            cellCount: cellHeightCount,
            viewSize: that._scrollViewSize.height,
            offset: 0
        });
    }

    /**
     * Checks whether an event is part of a group
     * @param {Object} event - scheduler event. Used for agenda view
     * @param {Object} group - timeline group object
     */
    _isEventPartOfGroup(event, groups) {
        if (!event) {
            return
        }

        //Checks whether it's a timeline group object or a group
        groups = groups.group || groups;

        return Object.keys(groups).every(g => event[g] !== undefined && event[g] === groups[g]);
    }

    /**
     * Creates the Horizontal Cell objects and Group cell objects by date when groupByDate is true
     * @param {Object}} cellObj - cell object
     * @param {Object} details - details object
     */
    _createCellsObjByDate(cellObj, details) {
        const that = this,
            groupHeader = details.groupHeader;

        if (!groupHeader) {
            return;
        }

        const [size, offset] = details.orientation === 'horizontal' ? ['width', 'left'] : ['height', 'top'],
            groupCells = groupHeader.cells,
            date = details.date,
            cellWidth = cellObj[size],
            cells = details.cells,
            agendaItem = details.agendaItem;
        let offsetSize = details.offset;

        //Creates the group object
        that._createGroupCellsByDate(details, agendaItem);

        const cellsByDate = groupHeader.cellsByDate,
            groupCellsCount = groupCells.length,
            groupLabelType = groupCellsCount % 2 === 0 ? 'center' : 'offset';

        //Creates the cell object and group cell objects
        for (let i = 0; i < groupCellsCount; i++) {
            const group = groupCells[i],
                parentGroup = group.group;

            if (agendaItem && !that._isEventPartOfGroup(agendaItem, parentGroup)) {
                continue;
            }

            const obj = Object.assign({}, cellObj),
                cellByDate = cellsByDate.find(c => c.date.getTime() === date.getTime() &&
                    Object.keys(parentGroup).every(g => parentGroup[g] === c.group[g]));

            if (!cellByDate) {
                continue;
            }

            cellByDate[offset] = cellByDate[offset] === undefined ? offsetSize : cellByDate[offset];
            cellByDate[size] = obj[size] + (agendaItem ? (cellByDate[size] || 0) : 0);

            obj[offset] = offsetSize;
            obj.date = new Date(date);
            obj.group = group.group;

            if (!agendaItem) {
                if (i === groupCellsCount - 1) {
                    obj.groupSeparator = true;
                }

                if (i === Math.round(groupCellsCount / 2)) {
                    obj.showLabel = groupLabelType;
                }
            }

            //Updates the offset/size of the group header cellsByDate
            that._refreshGroupHeaderCells(details.orientation, cellByDate);

            cells.push(obj);

            offsetSize = parseFloat((offsetSize + cellWidth).toFixed(2));
        }

        details.offset = offsetSize;
    }

    /**
     * Creates cells by date for each Header Group
     * @param {Object} details - contains details about the cell
     * @param {Object} agendaItem - an Agenda view item(event)
     */
    _createGroupCellsByDate(details, agendaItem) {
        const that = this,
            date = details.date,
            groupHeaders = that._timelineCells.groups;

        if (!date) {
            return
        }

        //Creates the cells for each Group Header
        for (let i = 0; i < groupHeaders.length; i++) {
            const groupHeader = groupHeaders[i];

            let cellsByDate = groupHeader.cellsByDate;

            if (!cellsByDate) {
                cellsByDate = groupHeader.cellsByDate = [];
            }

            //Creates cell by date
            const cells = groupHeader.cells;

            for (let c = 0; c < cells.length; c++) {
                let cell;

                if (agendaItem) {
                    if (!that._isEventPartOfGroup(agendaItem, cells[c])) {
                        continue;
                    }

                    cell = cellsByDate.find(cell => cell.date.getTime() === date.getTime() &&
                        cell.group[cell.resource] === agendaItem[cell.resource]);
                }

                cell = cell || Object.assign({}, cells[c]);

                if (!cell.date) {
                    cell.date = new Date(date);
                }

                cell.separator = !!details.separator; //Agenda view separator
                cell.groupSeparator = agendaItem ? !cell.separator : c === cells.length - 1;

                if (!cellsByDate.includes(cell)) {
                    cellsByDate.push(cell);
                }
            }
        }
    }

    /**
     * Creates Vertical Timeline cell objects
     * @param {Object} details
     */
    _createCellsObjectVertical(details) {
        const that = this;

        if (!details) {
            return;
        }

        const firstDayOfWeek = that.firstDayOfWeek,
            viewType = that.viewType,
            isTimelineView = viewType.indexOf('timeline') > -1,
            verticalTimelineCells = details.cells,
            date = new Date(details.date),
            cellHeightCount = details.cellCount,
            viewSize = details.viewSize,
            nonworkingHours = that.nonworkingHours,
            group = details.group,
            groups = details.groups,
            groupHeader = details.groupHeader;
        let offset = details.offset, totalHeight = 0,
            cellHeight = details.cellSize, cellObj;

        if (viewType === 'agenda') {
            const agendaItems = Object.keys(cellHeightCount).sort((a, b) => parseInt(a) - parseInt(b));

            for (let agendaItem of agendaItems) {
                let agenda = cellHeightCount[agendaItem],
                    height = cellHeight;

                if (group) {
                    //NOTE: When groupOrientation is 'vertical', filters specific group events
                    agenda = agenda.filter(a => that._isEventPartOfGroup(a, group));
                }
                else if (groups) {
                    //NOTE: When groupOrientation is 'horizontal', filters all group events
                    agenda = that._getAgendaGroupEvents(agenda);
                }
                else if (groupHeader) {
                    //NOTE: When groupOrientation is 'vertical' and groupByDate is set, filters specific group events
                    const groupCells = groupHeader.cells;
                    let agendaItems = agenda.slice(0);

                    agenda = [];

                    for (let i = 0; i < groupCells.length; i++) {
                        agenda.push(...agendaItems.filter(a => that._isEventPartOfGroup(a, groupCells[i])));
                    }
                }

                const cellCount = agenda.length,
                    agendaDate = new Date(parseInt(agendaItem));

                if (cellCount * height < viewSize) {
                    height = viewSize / cellCount;
                }

                height = parseFloat(cellHeight.toFixed(2));

                for (let i = 0; i < cellCount; i++) {
                    const date = agendaDate;
                    // eventStartDate = new Date(agenda[i].dateStart);

                    //Validate date against hourStart
                    // if (eventStartDate.getTime() > date.getTime()) {
                    //     date.setHours(eventStartDate.getHours(), eventStartDate.getMinutes());
                    // }

                    cellObj = {
                        height: height,
                        separator: i === cellCount - 1,
                        weekend: date.getDay() === 0 || date.getDay() === 6,
                        nonworking: that.nonworkingDays.indexOf(date.getDay()) > -1
                    };

                    if (i > 0) {
                        cellObj.noLabel = true;
                    }

                    if (groupHeader) {
                        details.offset = offset;
                        details.date = date;
                        details.agendaItem = agenda[i];
                        details.separator = cellObj.separator;

                        that._createCellsObjByDate(cellObj, details);

                        offset = details.offset;
                    }
                    else {
                        if (group) {
                            cellObj.group = group;
                        }

                        cellObj.top = offset;
                        cellObj.date = date;

                        verticalTimelineCells.push(cellObj);

                        offset = parseFloat((offset + height).toFixed(2));
                    }

                    totalHeight += height;
                }
            }

            that.$.timeline.classList[!verticalTimelineCells.length ? 'add' : 'remove']('no-agenda');
        }
        else {
            if (isTimelineView) {
                //Depends on the grouping but default is 1
                for (let i = 0; i < cellHeightCount; i++) {
                    date.setHours(0, 0, 0, 0);

                    cellObj = {
                        height: cellHeight,
                        weekend: date.getDay() === 0 || date.getDay() === 6
                    };

                    if (groupHeader) {
                        details.offset = offset;
                        details.date = date;

                        that._createCellsObjByDate(cellObj, details);

                        offset = details.offset;
                    }
                    else {
                        if (group) {
                            cellObj.group = group;
                        }

                        cellObj.top = offset;
                        cellObj.date = new Date(date);

                        verticalTimelineCells.push(cellObj);

                        offset = parseFloat((offset + cellHeight).toFixed(2));
                    }

                    totalHeight += cellHeight;
                }
            }
            else {
                let restrictedHours;

                if (viewType === 'month') {
                    date.setDate(1);
                    // date.setDate(date.getDate() - date.getDay() + firstDayOfWeek);
                    date.setDate(date.getDate() - (date.getDay() - firstDayOfWeek + 7) % 7);
                    date.setHours(0, 0, 0, 0);
                }
                else {
                    date.setHours(that.hourStart, 0, 0, 0);
                    restrictedHours = details.restrictedHours;
                }

                for (let i = 0; i < cellHeightCount; i++) {
                    cellObj = { height: cellHeight };

                    if (groupHeader) {
                        details.offset = offset;
                        details.date = date;

                        that._createCellsObjByDate(cellObj, details);

                        offset = details.offset;
                    }
                    else {
                        if (group) {
                            cellObj.group = group;
                        }

                        cellObj.top = offset;
                        cellObj.date = new Date(date);

                        verticalTimelineCells.push(cellObj)
                        offset = parseFloat((offset + cellHeight).toFixed(2));
                    }

                    totalHeight += cellHeight;

                    if (viewType === 'month') {
                        date.setDate(date.getDate() + 7);
                    }
                    else {
                        cellObj.nonworking = nonworkingHours.indexOf(date.getHours()) > -1;
                        date.setHours(date.getHours() + 1);

                        if (restrictedHours) {
                            cellObj.restricted = that._isHourRestricted(date, restrictedHours);
                        }
                    }
                }
            }
        }

        //Set a separator on the last group cell object
        if (cellObj && group) {
            cellObj.groupSeparator = true;
        }

        details.offset = offset;
        details.size = totalHeight;
    }

    /**
     * Returns the Timeline header details cells
     * @param {Array} horizontalTimelineCells
     */
    _getTimelineCellsObjDetails() {
        const that = this,
            view = that.view,
            viewDetails = that.views.find(v => v.value && v.value === view);

        if (that.viewType !== 'timelineWeek' || viewDetails && viewDetails.hideHours) {
            return []
        }

        function getGroupId(group) {
            let id = '';

            if (!groupByDate && group) {
                for (const g in group) {
                    id += g + group[g];
                }
            }

            return id
        }

        const hourStart = that.hourStart,
            groupByDate = that.groupByDate,
            timelineCells = that._timelineCells.horizontal;
        let timelineDetailCells = {}, cellDetail;

        //Create the Header detail cells
        for (let i = 0; i < timelineCells.length; i++) {
            const cell = timelineCells[i],
                cellDate = cell.date,
                cellId = cellDate.getDate() + getGroupId(cell.group);
            cellDetail = timelineDetailCells[cellId];

            if (!cellDetail) {
                cellDetail = timelineDetailCells[cellId] = { width: 0, left: cell.left };
            }

            cellDetail.width += cell.width;

            if (cell.groupSeparator) {
                cellDetail.groupSeparator = cell.groupSeparator;
            }

            if (!cellDetail.date) {
                const date = new Date(cellDate);

                //Set the day to the begining of the week
                date.setHours(hourStart, 0, 0, 0);

                cellDetail.date = date;
            }
        }

        //Convert to Array
        timelineDetailCells = Object.values(timelineDetailCells).sort((a, b) => a.left - b.left);

        return timelineDetailCells
    }

    /**
      * Returns the events for the longest Agenda group for a given Agenda date
      * @param {Array[Object]} agenda - array of agenda events for a specific date
      */
    _getAgendaGroupEvents(agenda) {
        const that = this,
            groups = that._timelineCells.groups;
        let groupCells;

        if (groups && groups.length) {
            groupCells = groups[groups.length - 1].cells;
        }

        const groupItems = {};
        let longestAgendaGroup = 0;

        //Filter out the longest agenda item's group
        for (let i = 0; i < groupCells.length; i++) {
            groupItems[i] = agenda.filter(a => that._isEventPartOfGroup(a, groupCells[i]));

            if (groupItems[i].length > groupItems[longestAgendaGroup].length) {
                longestAgendaGroup = i;
            }
        }

        return groupItems[longestAgendaGroup]
    }

    /**
     * Sets the width/height of the timeline content
     * @param {Number} cells - the number of cells
     * @param {Number} cellSize - cell's size
     * @param {String} size - represents 'width' or 'height' will be measured
     */
    _handleTimelineContentSize(cellsObj, cellSize, size) {
        const that = this,
            view = that.view,
            viewType = that.viewType,
            groups = that._timelineCells.groups,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            groupOrientation = viewDetails && viewDetails.groupOrientation ? viewDetails.groupOrientation : that.groupOrientation,
            headerOffset = viewType === 'agenda' && Object.keys(cellsObj.vertical).length ?
                that.$.timelineHeaderVertical.offsetWidth :
                Math.max(that.$.timelineViewCellsLabelContainer.offsetWidth, that.$.timelineViewAllDaylabel.offsetWidth),
            viewSize = size === 'width' ?
                Math.max(0, that.$.timeline.offsetWidth - headerOffset) : that.$.timelineContainer.offsetHeight;
        let newSize = 0,
            groupCells = [],
            cells = cellsObj[size === 'width' ? 'horizontal' : 'vertical'];

        if (groups && groups.length) {
            groupCells = groups[groups.length - 1].cells;
        }

        if (viewType === 'agenda' && size === 'height') {
            for (let agendaDate in cells) {
                let agendaEvents = cells[agendaDate];

                if (groupCells.length) {
                    //NOTE: Horizontal Agenda Grouping needs the group with the most events per agenda date
                    if (groupOrientation === 'horizontal') {
                        agendaEvents = that._getAgendaGroupEvents(agendaEvents);
                    }
                    else {
                        agendaEvents = agendaEvents.filter(a => groupCells.some(group => that._isEventPartOfGroup(a, group)));
                    }
                }

                newSize += agendaEvents.length * cellSize;
            }
        }
        else {
            let groupCount = 1;

            //Default is horizontal
            if (that.groups.length && ((groupOrientation !== 'vertical' && size === 'width') ||
                (groupOrientation === 'vertical' && size === 'height'))) {
                groupCount = Math.max(groupCells.length, 1);
            }

            if (cells === 1) {
                if (viewSize < cellSize) {
                    newSize = cellSize * groupCount;
                }
                else {
                    newSize = viewSize / groupCount;

                    if (newSize < cellSize) {
                        newSize = cellSize * groupCount;
                    }
                }
            }
            else {
                cells *= groupCount;

                if (cells * cellSize < viewSize) {
                    cellSize = viewSize / cells;
                }

                cellSize = parseFloat(cellSize.toFixed(2));
                newSize = cells * cellSize;
            }
        }

        //Set size to the timeline
        newSize = Math.max(newSize, viewSize, cellSize);

        that.$.timelineContent.style[size] = newSize === viewSize ? '' : newSize + 'px';

        //Refresh the scrollBars
        that._refresh();
    }

    /**
     * Creates Timeline cells
     * @param {any} count - number of cells to create
     */
    _createCells(count, classList = 'smart-scheduler-cell', role = 'gridcell') {
        let cell,
            fragment = document.createDocumentFragment();

        if (!Array.isArray(classList)) {
            classList = [classList];
        }

        for (let c = 0; c < count; c++) {
            cell = document.createElement('div');

            classList.forEach(className => cell.classList.add(className));

            //Accesibility
            cell.setAttribute('role', role);
            fragment.appendChild(cell);
        }

        return fragment;
    }

    /**
     * Creates the Timeline content cells
     */
    _refreshTimelineContentCells() {
        //TODO: Speed up
        const that = this,
            timelineCells = that._timelineCells;

        if (!timelineCells || !timelineCells.vertical || !timelineCells.horizontal) {
            return;
        }

        const timelineContainer = that.$.timelineContainer,
            timelineCellsContainer = that.$.timelineCellsContainer,
            containerParent = that.$.timelineContent,
            view = that.view,
            viewType = that.viewType,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            groupOrientation = viewDetails && viewDetails.groupOrientation ? viewDetails.groupOrientation : that.groupOrientation,
            visibleCellObjs = that._getVisibleCellObj();

        if (!visibleCellObjs) {
            return
        }

        const cellDetails = {
            viewType: viewType,
            isTimelineView: viewType.indexOf('timeline') > -1,
            visibleCellObjs: visibleCellObjs,
            groupOrientation: groupOrientation,
            locale: that.locale,
            timeZone: that.timeZone,
            isRightToLeft: that.rightToLeft,
            dateCurrent: that.dateCurrent,
            restrictedDates: that.restrictedDates,
            restrictedHours: that.restrictedHours
        };

        //Remove the cell container from the DOM
        timelineCellsContainer.remove();

        //Generate additional cells if needed
        that._recycleContainerCells({
            fragment: timelineCellsContainer,
            cellsNeeded: visibleCellObjs[that.viewType.indexOf('timeline') > -1 ? 'horizontal' : 'vertical'].length,
            className: 'smart-scheduler-cell-container',
            role: 'row'
        });

        //Refresh timeline content cells
        that._refreshContainerCells(timelineCellsContainer, cellDetails);

        //Put it back in the DOM
        containerParent.insertBefore(timelineCellsContainer, containerParent.firstElementChild);

        timelineContainer.scrollTop = that.scrollTop;
        timelineContainer.scrollLeft = that._getScrollLeft(that.scrollLeft);

        //Set the currentTimeIndicator and shadeUntilCurrentTime
        that._setCurrentTimeIndicators();
    }

    /**
     * Returns the visible horizontal/vertical cell objs
     */
    _getVisibleCellObj() {
        const that = this,
            timelineCells = that._timelineCells;

        if (!timelineCells || !timelineCells.vertical || !timelineCells.horizontal) {
            return;
        }

        const vCellObjs = timelineCells.vertical,
            hCellObjs = timelineCells.horizontal,
            [scrollTop, scrollLeft] = [that.scrollTop, that.scrollLeft],
            [scrollBottom, scrollRight] = [scrollTop + that._scrollViewSize.height, scrollLeft + that._scrollViewSize.width];
        let [visibleVCellObjs, visibleHCellObjs] = [[], []];

        //Find the visible vertical cell objs
        for (let i = 0; i < vCellObjs.length; i++) {
            const cellObj = vCellObjs[i];

            if (cellObj.top + cellObj.height >= scrollTop && cellObj.top <= scrollBottom) {
                visibleVCellObjs.push(cellObj);
            }
        }

        //Find the visible horizontal cell objs
        for (let i = 0; i < hCellObjs.length; i++) {
            const cellObj = hCellObjs[i];

            if (cellObj.left + cellObj.width >= scrollLeft && cellObj.left <= scrollRight) {
                visibleHCellObjs.push(cellObj);
            }
        }

        return { vertical: visibleVCellObjs, horizontal: visibleHCellObjs }
    }

    /**
     * Controls the number of cells inside the content section
     * @param {HTMLElement} container
     */
    _refreshContainerCells(container, cellDetails) {
        const that = this,
            viewType = cellDetails.viewType,
            groupOrientation = cellDetails.groupOrientation,
            isTimelineView = cellDetails.isTimelineView,
            visibleCellObjs = cellDetails.visibleCellObjs,
            cells = container.children,
            isViewCellContainer = container === that.$.timelineCellsContainer,
            isRightToLeft = cellDetails.isRightToLeft,
            dateCurrent = cellDetails.dateCurrent,
            restrictedDates = cellDetails.restrictedDates,
            restrictedHours = cellDetails.restrictedHours,
            today = new Date();
        let viewCells, selectedCellObj, totalCells, cellScaleCount, orientation, position, size;

        if (isViewCellContainer) {
            if (isTimelineView) {
                totalCells = visibleCellObjs.horizontal;
                [orientation, position, size] = ['horizontal', 'left', 'width'];
            }
            else {
                totalCells = visibleCellObjs.vertical;
                [orientation, position, size] = ['vertical', 'top', 'height'];
            }

            viewCells = visibleCellObjs.vertical;
            cellScaleCount = that._getCellsScaleCount();
        }
        else {
            if (isTimelineView) {
                viewCells = visibleCellObjs.horizontal;
                totalCells = visibleCellObjs.vertical;
                [orientation, position, size] = ['vertical', 'top', 'height'];
            }
            else {
                viewCells = visibleCellObjs.vertical;
                totalCells = visibleCellObjs.horizontal;
                [orientation, position, size] = ['horizontal', 'left', 'width']
            }

            if (that._selectedCellObj) {
                const fromCellObj = that._selectedCellObj.from;

                if (!fromCellObj.allDay) {
                    const toCellObj = that._selectedCellObj.to;

                    selectedCellObj = {
                        lastTime: fromCellObj.time,
                        fromTime: Math.min(fromCellObj.time, toCellObj.time),
                        toTime: Math.max(fromCellObj.time, toCellObj.time),
                        group: fromCellObj[groupOrientation] ? fromCellObj[groupOrientation].group : undefined
                    };
                }
            }
        }

        //Set the top/left
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i],
                cellObj = totalCells[i];
            let groupSeparator;

            cellObj.nonworking ? cell.setAttribute('nonworking', '') : cell.removeAttribute('nonworking');
            cellObj.weekend ? cell.setAttribute('weekend', '') : cell.removeAttribute('weekend');
            cellObj.separator ? cell.setAttribute('separator', '') : cell.removeAttribute('separator');

            groupSeparator = cellObj.groupSeparator;

            //Apply timelineDayScale
            if (isViewCellContainer) {
                if (!isTimelineView && groupOrientation === 'vertical') {
                    groupSeparator = viewCells[i].groupSeparator;
                }

                if (groupSeparator && (isTimelineView && groupOrientation !== 'vertical' || !isTimelineView && groupOrientation === 'vertical')) {
                    cell.setAttribute('group-separator', '');
                }
                else {
                    cell.removeAttribute('group-separator');
                }

                cell.$ = { cellObj: cellObj };

                //Refreshes the scale cells
                that._refreshScaleCells(cell, cellDetails, cellScaleCount);
            }
            else {
                if (!cell.$) {
                    cell.$ = { cellObj: {} };
                }

                const scaleCellObj = cell.$.cellObj;

                scaleCellObj.scaleIndex = container._scaleIndex;

                if (isTimelineView) {
                    scaleCellObj['horizontal'] = container.$.cellObj;
                    scaleCellObj['vertical'] = cellObj;
                }
                else {
                    scaleCellObj['horizontal'] = cellObj;
                    scaleCellObj['vertical'] = container.$.cellObj;
                }

                const cellGroup = scaleCellObj[groupOrientation] ? scaleCellObj[groupOrientation].group : undefined;

                if (cellGroup) {
                    for (const g in cellGroup) {
                        cell.setAttribute(g, cellGroup[g] || '')
                        cell.setAttribute('group-value', cellGroup[g] || '')
                    }
                }

                if (groupSeparator && (!isTimelineView && groupOrientation !== 'vertical' || isTimelineView && groupOrientation === 'vertical')) {
                    cell.setAttribute('group-separator', '');
                }
                else {
                    cell.removeAttribute('group-separator');
                }

                const cellDate = new Date(scaleCellObj.time = that._getCellTime(scaleCellObj));

                if (that._isDateRestricted(cellDate, restrictedDates) || that._isHourRestricted(cellDate, restrictedHours)) {
                    cell.setAttribute('restricted', '')
                }
                else {
                    cell.removeAttribute('restricted')
                }

                if (that.specialDates && that.specialDates.length) {
                    const specialDate = that._isSpecialDate(cellDate, that.specialDates);
                    cell.style.background = '';
                    cell.style.color = '';
                    cell.removeAttribute('special-date');
                    if (that._customClassNames) {
                        that._customClassNames.forEach((className => {
                            cell.classList.remove(className);
                        }))
                    }
                    if (specialDate) {
                        if (specialDate.value) {
                            cell.setAttribute('special-date', specialDate.value);
                        }
                        else {
                            cell.setAttribute('special-date', '');
                        }

                        if (specialDate.restricted) {
                            cell.setAttribute('restricted', specialDate.restricted);
                            const color = new Smart.Color(specialDate.color);
                            const rgba = `rgba(${color.r}, ${color.g}, ${color.b}, .15)`;
                            cell.style.background = `0 -245rem / 12px 12px linear-gradient(135deg, ${rgba} 25%, transparent 25%, transparent 50%, ${rgba} 50%, ${rgba} 75%, transparent 75%, transparent)`;
                        }
                        else {
                            const smartColor = new Smart.Color(specialDate.color);
                            cell.style.background = specialDate.color;
                            cell.style.color = smartColor.getInvertedColor();
                        }

                        if (specialDate.className) {
                            if (!that._customClassNames) {
                                that._customClassNames = [];
                            }

                            if (!that._customClassNames.includes(specialDate.className)) {
                                that._customClassNames.push(specialDate.className);
                            }
                            cell.classList.add(specialDate.className);
                        }
                    }
                }

                if (that.restricted) {
                    for (let m = 0; m < that.restricted.length; m++) {
                        const restricted = that.restricted[m];

                        if (that._isDateRestricted(cellDate, [restricted.date])) {
                            const hour = cellDate.getHours();

                            for (let q = 0; q < restricted.hours.length; q++) {
                                const hours = restricted.hours[q];

                                if (Array.isArray(hours)) {
                                    if (hour >= hours[0] && hour <= hours[1]) {
                                        cell.setAttribute('restricted', '')
                                    }
                                }
                                else if (hour === hours) {
                                    cell.setAttribute('restricted', '')
                                }
                            }
                        }
                    }
                }

                that._refreshAvailableState(cellObj, cell, cellDate);

                if (cellDate.getFullYear() === today.getFullYear() && cellDate.getMonth() === today.getMonth() &&
                    cellDate.getDate() === today.getDate()) {
                    cell.setAttribute('today', '');
                }
                else {
                    cell.removeAttribute('today', '');
                }

                that._setCellContent(cell, cellDate);

                cell.setAttribute('aria-haspopup', true);

                if (viewType === 'month') {
                    if (cellDate.getMonth() !== dateCurrent.getMonth()) {
                        cell.setAttribute('other-month', '');
                    }
                    else {
                        cell.removeAttribute('other-month');
                    }
                }
                else {
                    cell.removeAttribute('other-month');
                }

                cell.setAttribute('date', cellDate);

                //NOTE: Setting this date attribute has Very negative Impact on Scrolling Performance
                //using new Intl.DateTimeFormat() makes no difference
                // cell.setAttribute('date', cellDate.toLocaleString(locale));

                cell.removeAttribute('selected');

                if (selectedCellObj && cellGroup === selectedCellObj.group &&
                    scaleCellObj.time >= selectedCellObj.fromTime && scaleCellObj.time <= selectedCellObj.toTime) {
                    cell.setAttribute('selected', scaleCellObj.time === selectedCellObj.lastTime ? 'start' : '');
                }
            }

            cell.style.top = cell.style.left = cell.style.right = cell.style.width = cell.style.height = '';
            cell.style[size] = cellObj[size] + 'px';

            if (orientation === 'horizontal') {
                cell.style[isRightToLeft ? 'right' : 'left'] = cellObj.left + 'px';
            }
            else {
                cell.style[position] = cellObj[position] + 'px';
            }
        }
    }

    getViewDates() {
        const that = this;

        const cells = that.querySelectorAll('.smart-scheduler-cell');

        let firstCell = null;
        let lastCell = null;

        for (let i = 0; i < cells.length; i++) {
            if (cells[i].hasAttribute('all-day') || !cells[i].hasAttribute('date')) {
                continue;
            }

            if (!firstCell) {
                firstCell = cells[i];
            }

            lastCell = cells[i];
        }

        if (firstCell && lastCell) {

            const startDate = new Date(firstCell.getAttribute('date'));
            const endDate = new Date(lastCell.getAttribute('date'));

            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            return [startDate, endDate];
        }
        return null;
    }
    /**
     * Refreshes the Timeline scale cells. Handles timelineDayScale property
     * @param {HTMLElement} container - the parent container for the scale cells
     * @param {number} totalCells - the number of cells for the scale
     */
    _refreshScaleCells(container, cellDetails, totalCells) {
        const that = this,
            visibleCellObjs = cellDetails.visibleCellObjs,
            isTimelineView = cellDetails.isTimelineView,
            cells = container.children;

        //Generate additional cells if needed
        that._recycleContainerCells({
            fragment: container,
            cellsNeeded: totalCells,
            className: ['smart-scheduler-cell', 'scale'],
            role: 'presentation'
        });

        const size = isTimelineView ? 'width' : 'height',
            cellsCount = cells.length,
            cellObj = container.$.cellObj,
            cellsNeeded = visibleCellObjs[isTimelineView ? 'vertical' : 'horizontal'].length;

        for (let i = 0; i < cellsCount; i++) {
            const cell = cells[i];

            cell.$ = container.$;
            cell._scaleIndex = i;

            cellObj.nonworking ? cell.setAttribute('nonworking', '') : cell.removeAttribute('nonworking');

            cell.style.width = cell.style.height = null;
            cell.style[size] = (100 / totalCells) + '%';

            that._recycleContainerCells({
                fragment: cell,
                cellsNeeded: cellsNeeded
            });

            that._refreshContainerCells(cell, cellDetails);
            delete cell._scaleIndex;
        }
    }

    getDateFromCoordinates(x, y) {
        const that = this;
        const cells = that.querySelectorAll('.smart-scheduler-cell');

        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            const rect = cell.getBoundingClientRect();

            if (!cell.hasAttribute('date')) {
                continue;
            }

            if (rect.left <= x && rect.right >= x) {
                if (rect.top <= y && rect.bottom >= y) {
                    const date = cell.getAttribute('date');

                    return new Date(date);
                }
            }
        }
        return null;
    }

    getIsAllDayCellFromCoordinates(x, y) {
        const that = this;
        const cells = that.querySelectorAll('.smart-scheduler-cell');

        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            const rect = cell.getBoundingClientRect();

            if (!cell.hasAttribute('date')) {
                continue;
            }

            if (rect.left <= x && rect.right >= x) {
                if (rect.top <= y && rect.bottom >= y) {
                    if (cell.hasAttribute('all-day')) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    _refreshAvailableState(cellObj, cell, cellDate) {
        const that = this;

        if (that.available && that.available.length) {
            cell.setAttribute('restricted', '')
            cellObj.restricted = true;

            for (let m = 0; m < that.available.length; m++) {
                const availableRange = that.available[m];
                const keyId = cellObj.group ? Object.keys(cellObj.group)[0] : null;

                if (!cellObj.group || availableRange[keyId] === undefined || (cellObj.group && (cellObj.group[keyId] === availableRange[keyId]))) {
                    if (typeof availableRange.start === 'string' && availableRange.start.length === 5 && availableRange.start.indexOf(':') >= 0) {
                        const startParts = availableRange.start.split(':');
                        const startHour = parseInt(startParts[0]);
                        const startMinutes = parseInt(startParts[1]);

                        const endParts = availableRange.end.split(':');
                        const endHour = parseInt(endParts[0]);
                        const endMinutes = parseInt(endParts[1]);

                        const startDate = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), startHour, startMinutes, 0);
                        const endDate = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), endHour, endMinutes, 0);

                        if (startDate <= cellDate && cellDate <= endDate) {
                            cell.removeAttribute('restricted');
                            cellObj.restricted = false;
                        }
                    }
                    else if (typeof availableRange.start === 'string' && availableRange.start.length <= 2) {
                        const startHour = parseInt(availableRange.start);
                        const endHour = parseInt(availableRange.end);

                        const startDate = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), startHour, 0, 0);
                        const endDate = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), endHour, 0, 0);

                        if (startDate <= cellDate && cellDate <= endDate) {
                            cell.removeAttribute('restricted');
                            cellObj.restricted = false;
                        }
                    }
                    else if (availableRange.date) {
                        if (availableRange.date.getFullYear() === cellDate.getFullYear() &&
                            availableRange.date.getMonth() === cellDate.getMonth() &&
                            availableRange.date.getDate() === cellDate.getDate()) {
                            const hour = cellDate.getHours();

                            if (!availableRange.hours) {
                                cell.removeAttribute('restricted', '')
                                cellObj.restricted = false;
                            }
                            else {
                                for (let q = 0; q < availableRange.hours.length; q++) {
                                    const hours = availableRange.hours[q];

                                    if (Array.isArray(hours)) {
                                        if (hour >= hours[0] && hour <= hours[1]) {
                                            cell.removeAttribute('restricted', '');
                                            cellObj.restricted = false;
                                        }
                                    }
                                    else if (hour === hours) {
                                        cell.removeAttribute('restricted', '')
                                        cellObj.restricted = false;
                                    }
                                }
                            }
                        }
                    }
                    else if (typeof availableRange.start === 'number') {
                        const startHour = availableRange.start;
                        const endHour = availableRange.end;

                        const startDate = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), startHour, 0, 0);
                        const endDate = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), endHour, 0, 0);

                        if (startDate <= cellDate && cellDate <= endDate) {
                            cell.removeAttribute('restricted');
                            cellObj.restricted = false;
                        }
                    }
                    else {
                        const startDate = new Smart.Utilities.DateTime(availableRange.start).toDate();
                        const endDate = new Smart.Utilities.DateTime(availableRange.end).toDate();
                        if (startDate <= cellDate && cellDate <= endDate) {
                            cell.removeAttribute('restricted');
                            cellObj.restricted = false;
                        }
                    }
                }
            }
        }
    }

    /**
     * Refreshes the cells of the AllDay container
     */
    _refreshTimelineAllDayCells() {
        const that = this,
            today = new Date(),
            restrictedHours = that.restrictedHours,
            viewType = that.viewType.toLowerCase(),
            container = that.$.timelineViewAllDayContent,
            allDaysCellsContainer = that.$.timelineViewAllDayCellsContainer;

        if (viewType.indexOf('timeline') > -1 || viewType.indexOf('month') > -1) {
            allDaysCellsContainer.innerHTML = '';
            return;
        }

        allDaysCellsContainer.remove();

        const allDayCells = allDaysCellsContainer.children,
            locale = that.locale,
            rightToLeft = that.rightToLeft,
            vCellObj = { height: that._allDayCellSize, top: 0 },
            horizontalViewCells = that.$.timelineHeaderHorizontalContent.querySelector('.smart-scheduler-cells').children;

        //Generate additional cells if needed
        that._recycleContainerCells({ fragment: allDaysCellsContainer, cellsNeeded: viewType === 'agenda' ? 0 : horizontalViewCells.length });

        //Refresh the position and size
        for (let i = 0; i < allDayCells.length; i++) {
            const cell = allDayCells[i],
                targetCell = horizontalViewCells[i],
                targetCellObj = targetCell.$.cellObj;

            if (!cell.$) {
                cell.$ = { cellObj: {} };
            }

            const cellObj = cell.$.cellObj;

            cellObj.horizontal = targetCellObj;
            cellObj.vertical = vCellObj;
            cellObj.allDay = true;

            cell.setAttribute('all-day', '');

            const cellGroup = cellObj.horizontal.group;

            if (cellGroup) {
                for (const g in cellGroup) {
                    cell.setAttribute(g, cellGroup[g] || '');
                    cell.setAttribute('group-value', cellGroup[g] || '')
                }
            }

            const cellDate = new Date(cellObj.time = that._getCellTime(cellObj));

            targetCellObj.restricted || restrictedHours.length ? cell.setAttribute('restricted', '') : cell.removeAttribute('restricted');

            if (cellDate.getFullYear() === today.getFullYear() && cellDate.getMonth() === today.getMonth() &&
                cellDate.getDate() === today.getDate()) {
                cell.setAttribute('today', '');
            }
            else {
                cell.removeAttribute('today', '');
            }

            that._setCellContent(cell, cellDate);
            cell.setAttribute('date', cellDate.toLocaleDateString(locale));

            targetCellObj.groupSeparator ? cell.setAttribute('group-separator', '') : cell.removeAttribute('group-separator');
            targetCellObj.weekend ? cell.setAttribute('weekend', '') : cell.removeAttribute('weekend');
            targetCellObj.nonworking ? cell.setAttribute('nonworking', '') : cell.removeAttribute('nonworking');

            that._refreshAvailableState(targetCellObj, cell, cellDate);
            if (rightToLeft) {
                cell.style.left = '';
                cell.style.right = targetCell.style.right;
            }
            else {
                cell.style.right = '';
                cell.style.left = targetCell.style.left;
            }

            cell.style.width = targetCell.style.width;
        }

        container.insertBefore(allDaysCellsContainer, container.firstElementChild);

        container.scrollLeft = that._getScrollLeft(that.scrollLeft);
    }

    /**
     * Returns the number of cells required for the current timelineDayScale
     */
    _getCellsScaleCount() {
        const that = this,
            viewType = that.viewType,
            view = that.view;

        if (['timelineMonth', 'month', 'agenda'].indexOf(viewType) > -1) {
            return 1;
        }

        if (viewType === 'timelineWeek') {
            const viewDetails = that.views.find(v => v.value && v.value === view) || {};

            if (viewDetails && viewDetails.hideHours) {
                return 1
            }
        }

        switch (that.timelineDayScale) {
            case 'hour':
                return 1;
            case 'halfHour':
                return 2;
            case 'quarterHour':
                return 4;
            case 'tenMinutes':
                return 6;
            case 'fiveMinutes':
                return 12;
            default:
                return 1;
        }
    }

    /**
    * Returns the count of timeline cells that should be rendered/visible
    * @param {String} orientation - the orientation of the cells
    * @param {HTMLElement} type - additional cells type ( groups or details )
    */
    _getTimelineVisibleCellsCount(details = 'horizontal') {
        const that = this,
            orientation = details.orientation || details,
            type = details.type,
            resource = details.resource;
        let timelineCells = that._timelineCells[orientation];

        if (type) {
            if (resource) {
                const groupHeader = that._timelineCells.groups.find(g => g.resource === resource);

                timelineCells = groupHeader[that.groupByDate ? 'cellsByDate' : 'cells'];
            }
            else {
                timelineCells = that._timelineCells[type];
            }
        }

        if (!timelineCells) {
            return 0
        }

        const firstCellObj = that._getFirstCellObjInView({ orientation: orientation, type: type, resource: resource });

        if (!firstCellObj) {
            return 0
        }

        const [position, size, scroll] = orientation === 'horizontal' ? ['left', 'width', that.scrollLeft] : ['top', 'height', that.scrollTop];
        let viewSize;

        if (orientation === 'vertical') {
            viewSize = that._scrollViewSize.height;
        }
        else {
            viewSize = (that.$.timelineHeaderHorizontalContent.offsetWidth || that.$.timelineViewAllDayContent.offsetWidth)

            if (!viewSize && that.hideAllDay && that.viewType === 'day') {
                viewSize = that.offsetWidth;
            }
            if (that.viewType === 'agenda' && that._timelineCells.vertical.length) {
                viewSize -= that.$.timelineHeaderVertical.offsetWidth;
            }
        }

        if (type) {
            let headerDetailsObjCount = 0;

            if (type === 'details' && (that.viewType !== 'timelineWeek' || orientation === 'vertical')) {
                return headerDetailsObjCount
            }

            for (let i = timelineCells.indexOf(firstCellObj); i < timelineCells.length; i++) {
                const cell = timelineCells[i];

                if (cell[position] + cell[size] >= scroll && cell[position] < viewSize + scroll) {
                    headerDetailsObjCount++;
                }
            }

            return headerDetailsObjCount
        }

        const firstCellOffset = 1 - (firstCellObj[position] + firstCellObj[size] - scroll) / timelineCells[0][size];

        if (isNaN(firstCellOffset) || !isFinite(firstCellOffset)) {
            return 0
        }

        return Math.min(timelineCells.length, Math.ceil(parseFloat(((viewSize / firstCellObj[size]) + firstCellOffset).toFixed(2))));
    }

    /**
    * Returns the first visible cell object
    *  @param {String} orientation - the orientation of the cells
    *  @param {String} type - additional cells type ( details or group)
    */
    _getFirstCellObjInView(details = 'horizontal') {
        const that = this,
            orientation = details.orientation || details,
            type = details.type,
            resource = details.resource,
            timelineCells = that._timelineCells;

        if (!timelineCells) {
            return;
        }

        let firstCellObj, lastCellObj, cellObjs;

        const [scrollAmount, offset, size] = orientation === 'horizontal' ? ['scrollLeft', 'left', 'width'] : ['scrollTop', 'top', 'height'],
            scrollSize = Math.abs(that[scrollAmount]);

        cellObjs = timelineCells[orientation];

        if (type) {
            if (resource) {
                const groupHeader = that._timelineCells.groups.find(g => g.resource === resource);

                cellObjs = groupHeader[that.groupByDate ? 'cellsByDate' : 'cells'];
            }
            else {
                cellObjs = that._timelineCells[type];
            }
        }

        for (let i = 0; i < cellObjs.length; i++) {
            const cellObj = cellObjs[i];

            if (cellObj[offset] + cellObj[size] >= scrollSize) {
                firstCellObj = cellObj;
                break;
            }

            lastCellObj = cellObj;
        }

        if (!firstCellObj && lastCellObj) {
            firstCellObj = scrollSize > lastCellObj[offset] ? lastCellObj : cellObjs[0];
        }

        return firstCellObj;
    }

    /**
     * Returns the nubmer of cells that should be created depending on the view
     * @param {any} type - timeline header type (horizontal or vertical)
     * @param {any} view
     */
    _getCellsCount(view) {
        const that = this,
            dateCurrent = that.dateCurrent,
            date = new Date(that.dateCurrent);

        if (!view) {
            view = that.view;
        }

        const viewType = that.viewType,
            viewDetails = that.views.find(v => v.value && v.value === view) || {},
            nonworkingDays = that.nonworkingDays;
        let [horizontalCells, verticalCells, detailCells, weekend] = [0, 0, 0, 0, 0];
        const hideNonworkingWeekdays = that.hideNonworkingWeekdays || viewDetails.hideNonworkingWeekdays,
            hideWeekend = that.hideWeekend || viewDetails.hideWeekend;

        if (hideWeekend) {
            weekend = 2;

            if (hideNonworkingWeekdays) {
                weekend -= (nonworkingDays.includes(0) ? 1 : 0) + (nonworkingDays.includes(6) ? 1 : 0);
            }
        }

        switch (viewType) {
            //Basic Views
            case 'agenda': {
                verticalCells = that._getAgendaEvents(date, viewDetails);
                horizontalCells = 1;
                break;
            }
            case 'day': {
                verticalCells = that._getDayHours(date);
                horizontalCells = 1;
                break;
            }
            case 'month':
            case 'week':
                //6 is the number of visible weeks
                verticalCells = viewType === 'month' ? 6 : (that.hourEnd - that.hourStart + 1);
                horizontalCells = 7 - (hideNonworkingWeekdays ? (nonworkingDays.length) : 0) - weekend;

                if (viewDetails.additionalDays) {
                    horizontalCells += viewDetails.additionalDays;
                }
                break;
            //Timeline Views
            //Default verticalCells is 1 - the number of visible weeks
            //NOTE: verticalCells depends on the Number of groups
            case 'timelineDay':
                horizontalCells = that._getDayHours(date);
                verticalCells = 1;
                if (viewDetails && viewDetails.hideHours) {
                    horizontalCells = 1;
                }
                break;
            case 'timelineWeek': {
                const firstDayOfWeek = that.firstDayOfWeek,
                    hideHours = viewDetails && viewDetails.hideHours;
                let day = new Date(date);

                verticalCells = 1;
                day.setDate(day.getDate() - day.getDay() + firstDayOfWeek);

                let days = 7;
                if (viewDetails.additionalDays) {
                    days += viewDetails.additionalDays;
                }

                for (let i = 0; i < days; i++) {
                    if ((!hideWeekend || (hideWeekend && [0, 6].indexOf(day.getDay()) < 0)) &&
                        (!hideNonworkingWeekdays || (hideNonworkingWeekdays && nonworkingDays.indexOf(day.getDay()) < 0))) {
                        horizontalCells += !hideHours ? that._getDayHours(day) : 1;
                        detailCells++;
                    }

                    day.setDate(day.getDate() + 1);
                }



                break;
            }
            case 'timelineMonth': {
                const lastDayOfMonth = new Date(dateCurrent);

                lastDayOfMonth.setDate(1);
                lastDayOfMonth.setMonth(lastDayOfMonth.getMonth() + 1);
                lastDayOfMonth.setDate(0);

                horizontalCells = lastDayOfMonth.getDate();
                if (viewDetails.additionalDays) {
                    horizontalCells += viewDetails.additionalDays;
                }
                verticalCells = 1;
                break;
            }
        }

        return { horizontal: horizontalCells, vertical: verticalCells, detail: detailCells };
    }

    /**
     * Returns the number of Agenda view events for the target date week
     * @param {Date} date
     */
    _getAgendaEvents(date, viewDetails) {
        const that = this;

        if (!viewDetails) {
            const view = that.view;
            viewDetails = that.views.find(v => v.value && v.value === view) || {};
        }

        if (!date) {
            date = new Date(that.currentDate);
        }

        const hideNonworkingWeekdays = that.hideNonworkingWeekdays || viewDetails.hideNonworkingWeekdays,
            hideWeekend = that.hideWeekend || viewDetails.hideWeekend,
            nonworkingDays = that.nonworkingDays,
            weekStart = new Date(date),
            hourStart = that.hourStart,
            hourEnd = that.hourEnd;

        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);

        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const [timeStart, timeEnd] = [weekStart.getTime(), weekEnd.getTime()],
            events = that._getEventsBetween(timeStart, timeEnd);
        let agendaEvents = {};

        if (!events || !events.length) {
            return agendaEvents
        }

        for (let i = 0; i < events.length; i++) {
            const event = events[i],
                eventDateStart = event.dateStart,
                eventDateEnd = event.dateEnd,
                eventStartTime = eventDateStart.getTime(),
                eventEndTime = eventDateEnd.getTime();

            if (eventStartTime >= timeEnd || eventEndTime <= timeStart || event.hidden) {
                continue;
            }

            for (let d = 0; d < 7; d++) {
                const weekDay = new Date(weekStart);

                weekDay.setDate(weekDay.getDate() + d);

                if ((hideNonworkingWeekdays && nonworkingDays.indexOf(weekDay.getDay()) > -1) ||
                    (hideWeekend && [0, 6].indexOf(weekDay.getDay()) > -1)) {
                    continue;
                }

                weekDay.setHours(hourStart, 0, 0, 0);

                const weekDayEnd = new Date(weekDay);

                weekDayEnd.setHours(hourEnd, 59, 59, 999);

                const weekDayStartTime = weekDay.getTime(),
                    weekDayEndTime = weekDayEnd.getTime();

                if (weekDayStartTime <= eventEndTime && weekDayEndTime >= eventStartTime) {
                    // if (weekDayStartTime < eventEndTime && weekDayEndTime > eventStartTime) {
                    let dayEvents = agendaEvents[weekDayStartTime];

                    if (!dayEvents) {
                        agendaEvents[weekDayStartTime] = dayEvents = [];
                    }

                    dayEvents.push(event);
                }
            }
        }

        //Sort the events based on their dates
        for (let agendaDate in agendaEvents) {
            agendaEvents[agendaDate].sort((a, b) => a.dateStart.getTime() - b.dateStart.getTime());
        }

        return agendaEvents
    }

    /**
     * Returns an array of events between two dates
     * @param {number | Date} timeStart - start time
     * @param {number | Date} timeEnd - end time
     */
    _getEventsBetween(timeStart, timeEnd) {
        const that = this;

        if (!timeStart || !timeEnd) {
            return []
        }

        if (timeStart instanceof Date) {
            timeStart = timeStart.getTime();
        }

        if (timeEnd instanceof Date) {
            timeEnd = timeEnd.getTime();
        }

        let eventsBetween = that._eventsBetween;

        if (!that._eventsBetween) {
            eventsBetween = that._eventsBetween = { timeStart: timeStart, timeEnd: timeEnd, events: [] };
        }
        else if (eventsBetween.timeStart === timeStart && eventsBetween.timeEnd === timeEnd) {
            return eventsBetween.events;
        }

        let targetEvents = [];
        const events = that._events,
            rRule = that._rRule,
            restrictedDates = that.restrictedDates,
            restrictedHours = that.restrictedHours,
            repeatingDetails = {
                isMonthView: that.viewType.toLowerCase().indexOf('month') > -1,
                restrictedDates: that.restrictedDates,
                restrictedHours: that.restrictedHours,
                hourStart: that.hourStart,
                hourEnd: that.hourEnd,
                dateStart: new Date(timeStart),
                dateEnd: new Date(timeEnd),
                rRule: rRule,
                targetEvents: targetEvents
            };

        for (let i = 0; i < events.length; i++) {
            const event = events[i],
                repeatObj = event.repeat,
                eventDateStart = event.dateStart,
                eventDateEnd = event.dateEnd,
                eventTimeStart = eventDateStart.getTime(),
                eventTimeEnd = eventDateEnd.getTime();

            if (!that._applyFiltering(event)) {
                continue;
            }

            if (repeatObj && rRule) {
                const options = that._getEventRepeatOptions(event);

                // Check for repeating events
                if (options) {
                    repeatingDetails.event = event;
                    repeatingDetails.repeatObj = repeatObj;
                    repeatingDetails.options = options;
                    repeatingDetails.eventTimeStart = eventTimeStart;
                    repeatingDetails.eventTimeEnd = eventTimeEnd;

                    that._setRepeatingEvents(repeatingDetails);
                    continue;
                }
            }
            else if (that._isEventRestricted(event, restrictedDates, restrictedHours) || eventTimeStart > timeEnd || eventTimeEnd < timeStart) {
                continue;
            }

            targetEvents.push(event);
        }

        //Sort the events by date
        targetEvents.sort((a, b) => a.dateStart.getTime() - b.dateStart.getTime());

        eventsBetween.timeStart = timeStart;
        eventsBetween.timeEnd = timeEnd;

        return eventsBetween.events = targetEvents
    }

    /**
     * Applies the filtering condition on a event Object
     * @param {*} events
     */
    _applyFiltering(eventObj) {
        const that = this;

        if (!that.filterable) {
            return true
        }

        const filter = that.filter;

        if (typeof filter === 'function') {
            return !!filter(that._cloneObject(eventObj))
        }
        else if (Array.isArray(filter)) {
            if (!filter.length) {
                return true
            }

            for (let i = 0; i < filter.length; i++) {
                const filterCondition = filter[i];

                if (filterCondition.name === undefined) {
                    continue
                }

                const prop = filterCondition.name,
                    propValue = eventObj[prop],
                    condition = filterCondition.value;

                if (typeof condition === 'function') {
                    if (propValue === undefined) {
                        return (!!condition(propValue) && !!condition(''));
                    }

                    return !!condition(propValue);
                }
                else {
                    return that._checkFilterMode(propValue + '', condition + '')
                }
            }
        }
        else {
            return true
        }
    }

    /**
     * Checks the property value agains the condition value according to the FilterMode
     */
    _checkFilterMode(propValue, conditionValue) {
        const that = this;

        switch (that.filterMode) {
            case 'startsWith':
                return propValue.indexOf(conditionValue) === 0
            case 'startsWithIgnoreCase':
                return propValue.toLowerCase().indexOf(conditionValue.toLowerCase()) === 0
            case 'doesNotContain':
                return propValue.indexOf(conditionValue) < 0
            case 'doesNotContainIgnoreCase':
                return propValue.toLowerCase().indexOf(conditionValue.toLowerCase()) < 0
            case 'contains':
                return propValue.indexOf(conditionValue) > -1
            case 'containsIgnoreCase':
                return propValue.toLowerCase().indexOf(conditionValue.toLowerCase()) > -1
            case 'equals':
                return propValue.localeCompare(conditionValue) === 0
            case 'equalsIgnoreCase':
                return propValue.toLowerCase().localeCompare(conditionValue.toLowerCase()) === 0
            case 'endsWith':
                return propValue.endsWith(conditionValue)
            case 'endsWithIgnoreCase':
                return propValue.toLowerCase().endsWith(conditionValue.toLowerCase())
        }
    }

    /**
    * Determines whether an event is retricted or not
    * @param {Date} date - a Date
    * @param {Array<Date>} restrictedDates - restricted dates array
    */
    _isEventRestricted(eventObj, restrictedDates, restrictedHours) {
        const that = this;

        if (!eventObj) {
            return false
        }

        const eventDateStart = eventObj.dateStart,
            eventDateEnd = eventObj.dateEnd,
            eventTimeStart = eventDateStart.getTime(),
            eventTimeEnd = eventDateEnd.getTime();
        let eventHours;

        if (!restrictedDates) {
            restrictedDates = that.restrictedDates;
        }

        if (!restrictedHours) {
            restrictedHours = that.restrictedHours;
        }

        if (restrictedHours.length) {
            //Gets the hours that the event takes from dateStart to dateEnd
            let durationInHours = Math.max(1, Math.min(23, Math.floor((eventDateEnd.getTime() - eventDateStart.getTime()) / (1000 * 60 * 60)))),
                startHour = eventDateStart.getHours();

            if (durationInHours > 0) {
                eventHours = [];

                while (durationInHours >= 0) {
                    eventHours.push(startHour);
                    startHour = startHour === 23 ? 0 : (startHour + 1);
                    durationInHours--;
                }

                if (eventHours.length > 1) {
                    eventHours.pop();
                }
            }

            if (eventHours && restrictedHours.some(h => eventHours.includes(h))) {
                return true
            }
        }


        for (let i = 0; i < restrictedDates.length; i++) {
            const restrictedDate = restrictedDates[i],
                resTimeStart = restrictedDate.getTime();
            let resTimeEnd = new Date(restrictedDate);

            resTimeEnd.setHours(23, 59, 59, 999);
            resTimeEnd = resTimeEnd.getTime();

            if (eventTimeStart <= resTimeEnd && eventTimeEnd >= resTimeStart) {
                return true
            }
        }

        if (that.restricted) {
            for (let m = 0; m < that.restricted.length; m++) {
                const restricted = that.restricted[m];

                if (that._isDateRestricted(eventDateStart, [restricted.date])) {
                    const hour = eventDateStart.getHours();

                    for (let q = 0; q < restricted.hours.length; q++) {
                        const hours = restricted.hours[q];

                        if (Array.isArray(hours)) {
                            if (hour >= hours[0] && hour <= hours[1]) {
                                return true;
                            }
                        }
                        else if (hour === hours) {
                            return true;
                        }
                    }
                }
            }
        }

        if (that.specialDates) {
            for (let m = 0; m < that.specialDates.length; m++) {
                const specialDate = that.specialDates[m];

                if (!specialDate.restricted) {
                    continue;
                }

                if (that._isDateRestricted(eventDateStart, [specialDate.date])) {
                    const hour = eventDateStart.getHours();

                    if (specialDate.hours) {
                        for (let q = 0; q < specialDate.hours.length; q++) {
                            const hours = specialDate.hours[q];

                            if (Array.isArray(hours)) {
                                if (hour >= hours[0] && hour <= hours[1]) {
                                    return true;
                                }
                            }
                            else if (hour === hours) {
                                return true;
                            }
                        }
                    }
                    else {
                        return true;
                    }
                }
            }
        }

        if (that.available && that.available.length) {
            let isRestricted = true;

            for (let m = 0; m < that.available.length; m++) {
                const availableRange = that.available[m];
                const resourceId = that.resources.length > 0 ? that.resources[0].value : null;

                if (!resourceId || eventObj[resourceId] === undefined || (resourceId && ((eventObj[resourceId] === availableRange[resourceId]) || availableRange[resourceId] === undefined))) {
                    if (typeof availableRange.start === 'string' && availableRange.start.length === 5 && availableRange.start.indexOf(':') >= 0) {
                        const startParts = availableRange.start.split(':');
                        const startHour = parseInt(startParts[0]);
                        const startMinutes = parseInt(startParts[1]);

                        const endParts = availableRange.end.split(':');
                        const endHour = parseInt(endParts[0]);
                        const endMinutes = parseInt(endParts[1]);

                        const startDate = new Date(eventDateStart.getFullYear(), eventDateStart.getMonth(), eventDateStart.getDate(), startHour, startMinutes, 0);
                        const endDate = new Date(eventDateStart.getFullYear(), eventDateStart.getMonth(), eventDateStart.getDate(), endHour, endMinutes, 0);

                        if (startDate <= eventDateStart && eventDateStart <= endDate) {
                            isRestricted = false;
                        }
                    }
                    else if (typeof availableRange.start === 'string' && availableRange.start.length <= 2) {
                        const startHour = parseInt(availableRange.start);
                        const endHour = parseInt(availableRange.end);

                        const startDate = new Date(eventDateStart.getFullYear(), eventDateStart.getMonth(), eventDateStart.getDate(), startHour, 0, 0);
                        const endDate = new Date(eventDateStart.getFullYear(), eventDateStart.getMonth(), eventDateStart.getDate(), endHour, 0, 0);

                        if (startDate <= eventDateStart && eventDateStart <= endDate) {
                            isRestricted = false;
                        }
                    }
                    else if (availableRange.date) {
                        if (availableRange.date.getFullYear() === eventDateStart.getFullYear() &&
                            availableRange.date.getMonth() === eventDateStart.getMonth() &&
                            availableRange.date.getDate() === eventDateStart.getDate()) {
                            const hour = eventDateStart.getHours();

                            if (!availableRange.hours) {
                                isRestricted = false;
                            }
                            else {
                                for (let q = 0; q < availableRange.hours.length; q++) {
                                    const hours = availableRange.hours[q];

                                    if (Array.isArray(hours)) {
                                        if (hour >= hours[0] && hour <= hours[1]) {
                                            isRestricted = false;
                                        }
                                    }
                                    else if (hour === hours) {
                                        isRestricted = false;
                                    }
                                }
                            }
                        }
                    }
                    else if (typeof availableRange.start === 'number') {
                        const startHour = availableRange.start;
                        const endHour = availableRange.end;

                        const startDate = new Date(eventDateStart.getFullYear(), eventDateStart.getMonth(), eventDateStart.getDate(), startHour, 0, 0);
                        const endDate = new Date(eventDateStart.getFullYear(), eventDateStart.getMonth(), eventDateStart.getDate(), endHour, 0, 0);

                        if (startDate <= eventDateStart && eventDateStart <= endDate) {
                            isRestricted = false;
                        }
                    }
                    else {
                        const startDate = new Smart.Utilities.DateTime(availableRange.start).toDate();
                        const endDate = new Smart.Utilities.DateTime(availableRange.end).toDate();
                        if (startDate <= eventDateStart && eventDateStart <= endDate) {
                            isRestricted = false;
                        }
                    }
                }
            }

            return isRestricted;
        }


        return false
    }

    /**
     * Determines whether a date is retricted or not
     * @param {Date} date - a Date
     * @param {Array<Date>} restrictedDates - restricted dates array
     */
    _isDateRestricted(date, restrictedDates) {
        const that = this;

        if (!date || !date.getTime || isNaN(date.getTime())) {
            return false
        }

        const targetYear = date.getFullYear(),
            targetMonth = date.getMonth(),
            targetDate = date.getDate();

        if (!restrictedDates) {
            restrictedDates = that.restrictedDates;
        }

        for (let i = 0; i < restrictedDates.length; i++) {
            const restrictedDate = restrictedDates[i],
                rYear = restrictedDate.getFullYear(),
                rMonth = restrictedDate.getMonth(),
                rDate = restrictedDate.getDate();

            if (targetYear === rYear && targetMonth === rMonth && targetDate === rDate) {
                return true
            }
        }

        return false
    }

    /**
    * Determines whether a date is special or not
    * @param {Date} date - a Date
    * @param {Array<Date>} specialDates - special dates array
    */
    _isSpecialDate(date, specialDates) {
        const that = this;

        if (!date || !date.getTime || isNaN(date.getTime())) {
            return false
        }

        const targetYear = date.getFullYear(),
            targetMonth = date.getMonth(),
            targetDate = date.getDate();

        if (!specialDates) {
            specialDates = that.specialDates;
        }

        for (let i = 0; i < specialDates.length; i++) {
            const specialDate = specialDates[i],
                rYear = specialDate.date.getFullYear(),
                rMonth = specialDate.date.getMonth(),
                rDate = specialDate.date.getDate();

            if (targetYear === rYear && targetMonth === rMonth && targetDate === rDate) {
                return specialDate;
            }
        }

        return false;
    }



    /**
     * Determines whether an hour is retricted or not
     * @param {Date} hour - an hour ( from 0 to 23)
     * @param {Array<Date>} restrictedHours - restricted hours array
     */
    _isHourRestricted(hour, restrictedHours) {
        const that = this;

        if (hour instanceof Date) {
            hour = hour.getHours();
        }

        if (hour === undefined || isNaN(hour)) {
            return false
        }

        if (!restrictedHours) {
            restrictedHours = that.restrictedHours;
        }

        return restrictedHours.includes(hour)
    }

    /**
     * Sets all repeating events and exceptions between dates
     * @param {Object} repeatingDetails - an object with repeat event details
     */
    _setRepeatingEvents(repeatingDetails) {
        const that = this,
            isMonthView = repeatingDetails.isMonthView,
            hourStart = repeatingDetails.hourStart,
            hourEnd = repeatingDetails.hourEnd,
            rRule = repeatingDetails.rRule,
            dateStart = repeatingDetails.dateStart,
            dateEnd = repeatingDetails.dateEnd,
            restrictedDates = repeatingDetails.restrictedDates,
            restrictedHours = repeatingDetails.restrictedHours,
            timeStart = dateStart.getTime(),
            timeEnd = dateEnd.getTime(),
            event = repeatingDetails.event,
            options = repeatingDetails.options,
            repeatObj = repeatingDetails.repeatObj,
            eventTimeStart = repeatingDetails.eventTimeStart,
            eventTimeEnd = repeatingDetails.eventTimeEnd,
            exceptions = repeatObj.exceptions,
            targetEvents = repeatingDetails.targetEvents,
            eventDateStart = event.dateStart,
            eventDateEnd = event.dateEnd;
        //By default we search for repeating dates from timeStart
        let repeatDateStart = dateStart;

        //Check whether the eventObj is in one day or many. If not set new timeStart
        if (eventDateStart.getFullYear() !== eventDateEnd.getFullYear() || eventDateStart.getMonth() !== eventDateEnd.getMonth() ||
            eventDateStart.getDate() !== eventDateEnd.getDate()) {
            repeatDateStart = event.dateStart;
        }

        //NOTE: Searching for repeating events between the dateStart of the event because there might be an repeating date
        //that ends between timeStart and timeEnd
        let newEvents = new rRule(options).between(new Date(Date.UTC(...that._getDateArgs(repeatDateStart))), new Date(Date.UTC(...that._getDateArgs(dateEnd))), true);

        //Check if there's a repeating event that ends between dates
        if (!newEvents.length) {
            const lastOccurance = new rRule(options).before(new Date(Date.UTC(...that._getDateArgs(dateStart))));

            if (lastOccurance) {
                const lastOccuranceTime = new Date(lastOccurance.getUTCFullYear(), lastOccurance.getUTCMonth(),
                    lastOccurance.getUTCDate(), lastOccurance.getUTCHours(), lastOccurance.getUTCMinutes()).getTime();

                if (lastOccuranceTime + eventTimeEnd - eventTimeStart >= timeStart) {
                    newEvents.push(lastOccurance);
                }
            }
        }

        //Create the repeating events
        for (let i = 0; i < newEvents.length; i++) {
            let e = newEvents[i];

            //Convert from UTC to Local Time
            e = new Date(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), e.getUTCHours(), e.getUTCMinutes());

            let dateStart = new Date(e),
                dateEnd = new Date(e.getTime() + eventTimeEnd - eventTimeStart), newEvent;

            if (that._isEventRestricted(event, restrictedDates, restrictedHours) || dateStart.getTime() > timeEnd || dateEnd.getTime() < timeStart) {
                continue
            }

            //Check for exceptions
            if (exceptions) {
                newEvent = exceptions.find(exception => {
                    const exceptionDate = exception.date;

                    if (event.allDay) {
                        exceptionDate.setHours(e.getHours(), e.getMinutes(), e.getSeconds(), e.getMilliseconds());
                    }

                    return exceptionDate.getTime() === e.getTime()
                });
            }

            if (newEvent) {
                dateStart = newEvent.dateStart;
                dateEnd = newEvent.dateEnd;
            }

            if (!dateStart || isNaN(dateStart.getTime())) {
                dateStart = new Date(e);
            }

            if (!dateEnd || isNaN(dateEnd.getTime())) {
                dateEnd = new Date(dateStart.getTime() + eventTimeEnd - eventTimeStart);
            }

            if (!isMonthView && (dateStart.getHours() < hourStart && dateEnd.getHours() < hourStart ||
                dateStart.getHours() > hourEnd && dateEnd.getHours() > hourEnd)) {
                continue;
            }

            if (!newEvent) {
                newEvent = that._cloneObject(event, false, true);
                newEvent.dateStart = dateStart;
                newEvent.dateEnd = dateEnd;
                newEvent.$ = { event: event };

                if (exceptions) {
                    //Adds the exceptions that occure before the end of the repeating event.
                    //This can occure most often in Agenda view
                    const timeStart = newEvent.dateStart.getTime(),
                        timeEnd = newEvent.dateEnd.getTime();

                    for (let i = 0; i < exceptions.length; i++) {
                        const exception = exceptions[i],
                            exceptionTime = exception.date.getTime();

                        if (exceptionTime > timeStart && exceptionTime <= timeEnd) {
                            if (exception.dateStart === undefined) {
                                exception.dateStart = new Date(dateStart);
                            }

                            if (exception.dateEnd === undefined) {
                                exception.dateEnd = new Date(dateEnd);
                            }

                            targetEvents.push(exception);
                        }
                    }
                }
            }
            else {
                if (!newEvent.dateStart || isNaN(newEvent.dateStart.getTime())) {
                    newEvent.dateStart = dateStart;
                }

                if (!newEvent.dateEnd || isNaN(newEvent.dateEnd.getTime())) {
                    newEvent.dateEnd = dateEnd;
                }

                newEvent.$ = { event: event };
            }

            targetEvents.push(newEvent);
        }
    }

    /**
     * Returns the event repeat options for RRule.js
     * @param {Objct} event - Scheduler event
     */
    _getEventRepeatOptions(event, toUTC) {
        const that = this,
            rRule = that._rRule;

        if (!event || !event.repeat || !rRule) {
            return
        }

        const repeatOptions = event.repeat,
            repeatFreq = repeatOptions.repeatFreq,
            freq = repeatFreq ? rRule[repeatFreq.toUpperCase()] : undefined;

        //NOTE: repeat Frequency is Required for RRule !
        if (freq === undefined) {
            return
        }

        const repeatOn = repeatOptions.repeatOn,
            repeatEnd = repeatOptions.repeatEnd;
        let options = {
            freq: freq, //frequency
            // wkst: that.firstDayOfWeek, //Start week day
            //NOTE: RRule weeStart is 0 - Monday, 6 - Sunday
            wkst: ((that.firstDayOfWeek - 1) + 7) % 7, //Start week day
            interval: repeatOptions.repeatInterval || 1 //interval
        };

        //RepeatOn condition
        const repeatOnCondition = that._getRepeatOnCondition(repeatFreq, repeatOn);

        switch (repeatFreq) {
            case 'weekly':
                //NOTE: RRule weekStart is 0 - Monday, 6 - Sunday
                options.byweekday = repeatOnCondition.map(i => ((i - 1) + 7) % 7); //Array<integer>, weedays
                break;
            case 'monthly':
                if (repeatOnCondition && typeof repeatOnCondition === 'object' && !Array.isArray(repeatOnCondition)) {
                    options.bysetpos = repeatOnCondition.setPosition; //integer, the occurrence of the
                    options.byweekday = typeof repeatOnCondition.weekday === 'number' ? ((repeatOnCondition.weekday - 1 + 7) % 7) : repeatOnCondition.weekday.map(i => ((i - 1) + 7) % 7); //integer, the weekday
                }
                else {
                    options.bymonthday = repeatOnCondition; //integer, the month day
                }
                break;
            case 'yearly':
                //RRule 'bymonth' prop starts from 1-12 isntead of 0-11(JS Date)
                options.bymonth = repeatOnCondition.index + 1; //Array<integer>, month numbers
                options.bymonthday = repeatOnCondition.value;
                break;
        }

        //Rpeat untill date
        if (repeatEnd instanceof Date) {
            options.until = new Date(Date.UTC(...that[toUTC ? '_getUTCDateArgs' : '_getDateArgs'](repeatEnd)));
        }
        else if (typeof repeatEnd === 'number' && !isNaN(repeatEnd)) {
            options.count = repeatEnd; //Repeat count
        }

        //Sets Date Start
        options.dtstart = new Date(Date.UTC(...that[toUTC ? '_getUTCDateArgs' : '_getDateArgs'](event.dateStart)));

        return options
    }

    /**
     * Returns Date.UTC() arguments from a Date object
     * @param {Date} date
     */
    _getUTCDateArgs(date) {
        if (isNaN(new Date(date).getTime())) {
            return
        }

        return [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes()]
    }

    /**
     * Returns Date.UTC() arguments from a Date object
     * @param {Date} date
     */
    _getDateArgs(date) {
        if (isNaN(new Date(date).getTime())) {
            return
        }

        // return [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes()]
        return [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]
    }

    /**
     * Returns the repeatOn condition depending on the repeat Frequency
     * @param {Object} freq - repeatFreq event condition
     * @param {Object} repeatOnCondition - repeatOn event condition
     */
    _getRepeatOnCondition(freq, repeatOnCondition) {
        if (!freq || !repeatOnCondition) {
            return []
        }

        let condition;

        if (freq === 'weekly') {
            let weekDays = [];

            if (!Array.isArray(repeatOnCondition)) {
                repeatOnCondition = [repeatOnCondition];
            }

            for (let i = 0; i < repeatOnCondition.length; i++) {
                condition = repeatOnCondition[i];

                if (typeof condition === 'string') {
                    condition = isNaN(parseInt(condition)) ? new Date(condition) : parseInt(condition);
                }

                if (condition instanceof Date && !isNaN(condition.getTime())) {
                    weekDays.push(condition.getDay());
                }
                else {
                    weekDays.push(Math.max(0, Math.min(6, (parseInt(repeatOnCondition[i]) || 0))));
                }
            }

            return weekDays
        }

        if (freq === 'monthly') {
            if (Array.isArray(repeatOnCondition)) {
                repeatOnCondition = repeatOnCondition[0];
            }

            condition = repeatOnCondition;

            if (typeof condition === 'string') {
                condition = isNaN(parseInt(condition)) ? new Date(condition) : parseInt(condition);
            }

            if (condition instanceof Date && !isNaN(condition.getTime())) {
                condition = condition.getDate();
            }
            else if (typeof condition === 'object') {
                return condition;
            }
            else {
                condition = Math.max(0, Math.min(31, (parseInt(repeatOnCondition) || 0)));
            }

            return condition
        }

        if (freq === 'yearly') {
            let index, value;

            if (Array.isArray(repeatOnCondition)) {
                repeatOnCondition = repeatOnCondition[0];
            }

            condition = repeatOnCondition;

            if (typeof condition === 'string') {
                condition = isNaN(parseInt(condition)) ? new Date(condition) : parseInt(condition);
            }

            if (condition instanceof Date && !isNaN(condition.getTime())) {
                index = condition.getMonth();
                value = condition.getDate();
            }
            else {
                let month = repeatOnCondition,
                    date = repeatOnCondition;

                if (typeof repeatOnCondition === 'object') {
                    month = repeatOnCondition.month;
                    date = repeatOnCondition.date;
                }

                index = Math.max(0, Math.min(11, (parseInt(month) || 0)));
                value = Math.max(0, Math.min(31, (parseInt(date) || 0)));
            }

            return { index: index, value: value }
        }
    }

    /**
     * Returns the number of hours for the day
     * @param {Date} date - the target Date
     */
    _getDayHours(date) {
        const that = this,
            tempDate = new Date(date || that.dateCurrent),
            currentDate = tempDate.getDate(),
            hourStart = that.hourStart,
            hourEnd = that.hourEnd;
        let hours = 0;

        tempDate.setHours(hourStart, 0, 0, 0);

        while (currentDate === tempDate.getDate() && tempDate.getHours() <= hourEnd) {
            hours++;

            const hour = tempDate.getHours();

            tempDate.setHours(tempDate.getHours() + 1, 0, 0, 0);

            //Safari bug fix
            if (hour === tempDate.getHours()) {
                tempDate.setHours(tempDate.getHours() + 2, 0, 0, 0);
            }
        }

        return hours;
    }

    /**
    * Returns the Date string according to the view
    * @param {any} date
    * @param {any} type
    */
    _getDateString(date, orientation = 'horizontal', isHeaderDetails) {
        const that = this,
            locale = that.locale,
            view = that.view,
            viewType = that.viewType,
            viewDetails = that.views.find(v => v.value && v.value === view),
            isTimelineView = viewType.indexOf('timeline') > -1,
            timeZone = date.timeZone || that.timeZone;
        let dateValue;

        //Convert the date to the appropriate time zone
        if (isHeaderDetails && isTimelineView) {
            date = date.date || date;
        }
        else if (!date.timeZone || date.timeZone !== that.timeZone) {
            date = new Smart.Utilities.DateTime(date.date || date).toDate(timeZone);
        }
        else {
            date = date.date || date;
        }

        //Timeline views
        if (isTimelineView) {
            if (orientation === 'vertical') {
                return '';
            }

            if (viewType === 'timelineMonth' || (viewType === 'timelineWeek' && (isHeaderDetails || viewDetails && viewDetails.hideHours))) {
                dateValue = new Intl.DateTimeFormat(locale, { day: that.dayFormat, weekday: that.weekdayFormat }).format(date);
            }
            else if (viewType === 'timelineDay' && viewDetails && viewDetails.hideHours) {
                dateValue = new Intl.DateTimeFormat(locale, { day: that.dayFormat, weekday: that.weekdayFormat }).format(date);
            }
            else {
                dateValue = new Intl.DateTimeFormat(locale, { hour: that.hourFormat, minute: that.minuteFormat }).format(date);
            }
        }
        else {
            //Basic views
            if (orientation === 'horizontal') {
                if (viewType === 'day') {
                    return '';
                }
                else if (viewType === 'week') {
                    dateValue = new Intl.DateTimeFormat(locale, { day: that.dayFormat, weekday: that.weekdayFormat }).format(date);
                }
                else if (viewType === 'month') {
                    dateValue = new Intl.DateTimeFormat(locale, { weekday: that.weekdayFormat }).format(date);
                }
            }
            else {
                if (viewType === 'month') {
                    return '';
                }
                else if (viewType === 'agenda') {
                    dateValue = new Intl.DateTimeFormat(locale, { day: that.dayFormat, weekday: that.weekdayFormat }).format(date);
                }
                else {
                    dateValue = new Intl.DateTimeFormat(locale, { hour: that.hourFormat, minute: that.minuteFormat }).format(date);
                }
            }
        }

        if (that.timelineHeaderFormatFunction) {
            return that.timelineHeaderFormatFunction(date, orientation, isHeaderDetails, dateValue);
        }

        return dateValue
    }

    /**
     * Returns the content for the header group
     */
    _setGroupContent(cell) {
        const that = this,
            cellObj = cell.$.cellObj;

        if (that.groupTemplate) {
            that._applyTemplate('groupTemplate', cell, cellObj);
        }
        else {
            const resources = that.resources,
                resource = resources.find(res => res.value === cellObj.resource);

            if (!resource) {
                cell.innerHTML = '';
                return;
            }

            let group;

            if (cellObj.group) {
                group = cellObj.label;
            }

            let label = group ? group : resource.label;

            if (that.timelineHeaderGroupFormatFunction) {
                const details = { cell: cell, cellObj: cellObj, isRendered: false };

                label = that.timelineHeaderGroupFormatFunction(group, resource, label, details);
                if (details.isRendered) {
                    return;
                }
            }

            cell.innerHTML = `<div>${label}</div>`;
        }
    }

    /**
     * Applys Custom templates to content
     * @param {String} name - the name of the template property
     * @param {HTMLElement} target - the timeline cell
     * @param {Strint | Object} value - the value of the cell
     */
    _applyTemplate(name, target, value) {
        const that = this;
        let template = that[name], resource;

        if (name === 'groupTemplate') {
            resource = that.resources.find(res => res.value === value.resource);

            if (resource) {
                const groupId = value.group[value.resource];

                value = resource.dataSource.find(group => group.id === groupId);
            }

            if (!value) {
                value = resource;
            }
        }

        if (!that._templates) {
            that._templates = {};
        }

        const templates = that._templates;

        //Handle groupTemplate
        if (typeof template === 'function') {
            template.call(that, target, value);
            delete templates[name];
            return;
        }
        else if (typeof template === 'string') {
            const templateString = template;
            template = document.getElementById(template);

            if (!template) {
                template = templateString;
                if (typeof value === 'object') {
                    for (let propertyName in value) {
                        template = template.replaceAll('{{' + propertyName + '}}', value[propertyName]);
                    }
                }
                else {
                    const regex = /{{\s*\w*\s*}}/gm;
                    let bindings = [];
                    let nodeHTML = template;

                    //Replace bindings
                    if (regex.test(nodeHTML)) {
                        const matches = nodeHTML.match(regex);

                        if (!bindings) {
                            bindings = [];
                        }

                        if (matches) {
                            matches.forEach(m => {
                                if (!bindings.includes(m)) {
                                    bindings.push(m);
                                }
                            });
                        }
                    }


                    if (bindings) {
                        for (let i = 0; i < bindings.length; i++) {
                            const match = bindings[i];
                            nodeHTML = nodeHTML.replace(match, typeof value === 'object' ? (value[match.replace(/{{|}}/gm, '').trim()] || '') : value);
                        }
                    }

                    template = nodeHTML;
                }

                target.innerHTML = template;
                return;
            }
        }

        if (!('content' in document.createElement('template'))) {
            that.error(that.localize('htmlTemplateNotSuported', { elementType: that.nodeName.toLowerCase() }));
            delete templates[name];
            return;
        }

        if (template === null || !('content' in template)) {
            that.error(that.localize('invalidTemplate', { elementType: that.nodeName.toLowerCase(), property: 'groupTemplate' }));
            delete templates[name];
            return;
        }

        let templateObj = templates[name];

        if (!templateObj) {
            templateObj = templates[name] = {};
        }

        target.innerHTML = '';

        let clonedNode = document.createElement('span');
        let error = '';
        try {
            clonedNode = template.content.cloneNode(true);
        }
        catch (e) {
            error = e;
        }

        if (error) {
            that._error = error;
        }
        const clone = clonedNode;

        if (name === 'cellTemplate') {
            value = new Intl.DateTimeFormat(that.locale, { day: that.dayFormat }).format(value);
        }
        else if (name === 'eventCollectorTemplate' || name === 'headerTemplate' || name === 'footerTemplate') {
            target.innerHTML = '';
            target.appendChild(clone);
            return
        }

        //Handles binding
        const nodes = clone.childNodes,
            templateBindings = templateObj.bindings;
        let bindings;

        if (templateBindings) {
            bindings = templateBindings;
        }

        for (let i = 0; i < nodes.length; i++) {
            let nodeHTML = nodes[i].outerHTML;

            if (nodeHTML) {
                if (!templateBindings) {
                    const regex = /{{\s*\w*\s*}}/gm;

                    //Replace bindings
                    if (regex.test(nodeHTML)) {
                        const matches = nodeHTML.match(regex);

                        if (!bindings) {
                            bindings = [];
                        }

                        if (matches) {
                            matches.forEach(m => {
                                if (!bindings.includes(m)) {
                                    bindings.push(m);
                                }
                            });
                        }
                    }
                }

                if (bindings) {
                    for (let i = 0; i < bindings.length; i++) {
                        const match = bindings[i];
                        nodeHTML = nodeHTML.replace(match, typeof value === 'object' ? (value[match.replace(/{{|}}/gm, '').trim()] || '') : value);
                    }
                }

                target.innerHTML += nodeHTML;
            }
        }

        if (bindings) {
            templateObj.bindings = bindings;
        }
    }

    /**
     * Sets the content of a Timeline cell
     * @param {HTMLElement} cell  - a timeline cell
     * @param {String} value - the default cell content
     */
    _setCellContent(cell, value) {
        const that = this;

        value = new Date(value ? value : that.dateCurrent);

        if (that.cellTemplate) {
            that._applyTemplate('cellTemplate', cell, value);
            return;
        }


        const renderSpecialDate = () => {
            if (that.specialDates && that.specialDates.length) {
                const specialDate = that._isSpecialDate(value);
                if (specialDate && specialDate.label) {
                    that.viewType !== 'month' ? cell.innerHTML += `<span>${specialDate.label}</span>` : cell.innerHTML += `<span class="center middle smart-flex" style="position: absolute;">${specialDate.label}</span>`;
                    return;
                }
            }
        }

        if (that.viewType !== 'month') {
            cell.innerHTML = '';
            renderSpecialDate();
            return;
        }

        if (value.getDate() === 1 && !cell.hasAttribute('today')) {
            cell.innerHTML = `<div>${new Intl.DateTimeFormat(that.locale, { month: 'short', day: that.dayFormat }).format(value)}</div>`;
        }
        else {
            cell.innerHTML = `<div>${new Intl.DateTimeFormat(that.locale, { day: that.dayFormat }).format(value)}</div>`;
        }
        renderSpecialDate();
    }

    _refreshViewList() {
        const that = this;

        if (that._noDateEvents && that._noDateEvents.length) {
            that.$.viewListButton.innerHTML = `<span style="margin-right: 20px;">${that.localize('showN', { value: that._noDateEvents.length })}</span>`;
        }
        else {
            that.$.viewListButton.innerHTML = `<span style="margin-right: 20px;">${that.localize('show')}</span>`;
        }

        if (!that.showList) {
            that.$.viewListButton.classList.add('smart-hidden');

            if (that._popupEventsList) {
                that._popupEventsList.remove();
                delete that._popupEventsList;
            }
            if (that._listEventsChooser) {
                that._listEventsChooser.remove();
                delete that._listEventsChooser;
            }
            return;
        }
        that.$.viewListButton.classList.remove('smart-hidden');

        if (!that._popupEventsList) {
            that._popupEventsList = document.createElement('div');
            that.$.container.appendChild(that._popupEventsList);
            that._popupEventsList.classList.add('smart-scheduler-list-container');
            that._popupEventsList.style.width = that.listWidth + 'px';
            that._popupEventsList.style.top = that.$.header.offsetHeight + 'px';
            that._popupEventsList.style.height = 'calc(100% - ' + that.$.header.offsetHeight + 'px)';

            that._listEventsChooser = document.createElement('smart-input');
            that._listEventsChooser.readonly = true;
            that._listEventsChooser.classList.add('underlined');
            that._listEventsChooser.dropDownButtonPosition = 'right';
            that._listEventsChooser.dataSource = [that.localize('all'), that.localize('withoutDates'), that.localize('withDates')];
            that._listEventsChooser.selectedIndex = 0;
            that._listEventsChooser.style.setProperty('--smart-background', 'var(--smart-surface)');
            that._listEventsChooser.style.height = 'var(--smart-scheduler-timeline-header-horizontal-cells-size)';
            that._listEventsChooser.style.width = '100%';
            that._listEventsChooser.style.marginTop = '1px';
            that._listEventsChooser.onchange = () => {
                that._refreshViewList();
            }

            const header = document.createElement('div');
            const content = document.createElement('div');
            that._popupEventsList.appendChild(header);

            const overlay = document.createElement('div');
            overlay.classList.add('smart-flex', 'middle', 'center');
            overlay.style.width = overlay.style.height = '100%';
            overlay.style.position = 'absolute';
            overlay.style.top = '0px';
            overlay.style.left = '0px';
            overlay.innerHTML = '<span style="padding: 10px; opacity: 0.8; border-radius: 15px; box-shadow: var(--smart-elevation-8); background: var(--smart-background); color: var(--smart-primary);">' + that.localize('dropToUnschedule') + '</span>'
            overlay.style.textAlign = 'center';
            overlay.style.fontWeight = 'bold';
            overlay.style.fontSize = '16px';
            overlay.style.backgroundColor = '#ffffff33';
            overlay.style.backdropFilter = 'blur(2px)';
            overlay.style.color = 'var(--smart-primary)';
            overlay.style.zIndex = 999;
            overlay.style.display = 'none';
            overlay.onpointerup = () => {
                if (that._dragDetails.schedulerEventObj) {
                    const schedulerEvents = that.$.timeline.querySelectorAll('.smart-scheduler-event');

                    for (let i = 0; i < schedulerEvents.length; i++) {
                        const schedulerEvent = schedulerEvents[i].$ ? ([schedulerEvents[i]] || schedulerEvents[i].$.events) : undefined;

                        if (schedulerEvent && schedulerEvent.some(e => {
                            const eObj = e.$ ? e.$.event : undefined;
                            return eObj && (JSON.stringify(eObj) === JSON.stringify(that._dragDetails.schedulerEventObj) || (eObj.$ && JSON.stringify(eObj.$.event) === JSON.stringify(that._dragDetails.schedulerEventObj)))
                        })) {
                            that._dragDetails.schedulerEventObj.dateStart = that._dragDetails.schedulerEventObj.dateEnd = null;
                            that._noDateEvents.push(schedulerEvent[0].$.event);
                            that._events.splice(that._events.indexOf(schedulerEvent[0].$.event), 1);
                            schedulerEvent[0].$.event.dateStart = schedulerEvent[0].$.event.dateEnd = null;
                        }
                    }

                    that._refreshViewList();
                    that._refreshTimelineEvents();
                    overlay.style.display = 'none';
                }
            }

            that._popupEventsList.onmouseenter = () => {
                if (that.showList && that._dragDetails) {
                    if (that.$.timeline.contains(that._dragDetails.schedulerEvent)) {
                        overlay.style.display = '';
                    }
                }
            }


            that._popupEventsList.onmouseleave = () => {
                if (that.showList && that._dragDetails) {
                    if (that.$.timeline.contains(that._dragDetails.schedulerEvent)) {
                        overlay.style.display = 'none';
                    }
                }
            }

            that._popupEventsList.appendChild(overlay);

            that._popupEventsList.appendChild(content);
            content.style.overflow = 'auto';
            content.style.height = '100%';

            header.appendChild(that._listEventsChooser);

        }

        const content = that._popupEventsList.lastElementChild;
        content.innerHTML = '';
        const fragment = document.createDocumentFragment();

        if (!that._noDateEvents) {
            that._noDateEvents = [];
        }

        let mappedEvents = [...that._events, ...that._noDateEvents];
        const filterEvents = (events) => {
            if (that.filter && that.filter[0]) {
                return events.filter(item => {
                    if (that.filter && that.filter[0]) {
                        const filter = that.filter[0];

                        return filter.value(item[filter.name]);
                    }
                });
            }
            return events;
        }
        mappedEvents = filterEvents(mappedEvents);
        that._listEventsChooser.title = '';
        if (that._listEventsChooser.selectedIndex === 1) {
            mappedEvents = [...that._noDateEvents];
            mappedEvents = filterEvents(mappedEvents);
            that._listEventsChooser.title = that.localize('dropToSchedule');
            const notification = document.createElement('div');
            notification.style.background = 'var(--smart-surface)';
            notification.style.color = 'var(--smart-surface-color)';
            notification.style.marginLeft = notification.style.marginTop = notification.style.marginBottom = notification.style.marginRight = '5px';
            notification.style.paddingLeft = notification.style.paddingTop = notification.style.paddingBottom = notification.style.paddingRight = '5px';

            notification.style.color = 'var(--smart-surface-color)';
            notification.innerHTML = that.localize('dropToSchedule');
            if (mappedEvents.length) {
                content.appendChild(notification);
            }
        }
        else if (that._listEventsChooser.selectedIndex === 2) {
            mappedEvents = [...that._events];
            mappedEvents = filterEvents(mappedEvents);
        }
        mappedEvents = mappedEvents.sort((a, b) => {
            if (a.dateStart < b.dateStart) {
                return -1;
            }

            if (a.dateStart > b.dateStart) {
                return 1;
            }

            if (!a.dateStart) {
                return -1;
            }
            if (!b.dateStart) {
                return -1;
            }
            return 0;
        });

        if (mappedEvents.length === 0) {
            const placeholder = that.localize('agendaPlaceholder');
            const placeholderElement = document.createElement('div');
            placeholderElement.innerHTML = placeholder;
            placeholderElement.style.width = '100%';
            placeholderElement.style.height = '100%';
            placeholderElement.style.display = 'flex';
            placeholderElement.style.alignItems = 'center';
            placeholderElement.style.justifyContent = 'center';

            fragment.appendChild(placeholderElement);

        }

        const addEvents = (mappedEvents) => {
            const fragment = document.createDocumentFragment();

            for (let i = 0; i < mappedEvents.length; i++) {
                const eventData = mappedEvents[i];
                let backgroundColor = eventData.backgroundColor;
                let color = eventData.color;
                let statusColor = eventData.statusColor;

                if (!backgroundColor || !color) {
                    //Find the resource backgroundColor
                    const eventResource = that.resources.find(r => eventData[r.value] !== undefined);

                    if (eventResource && eventResource.dataSource) {
                        const resourceDataItem = eventResource.dataSource.find(i => i.id === eventData[eventResource.value]);

                        if (resourceDataItem) {
                            backgroundColor = backgroundColor || resourceDataItem.backgroundColor;
                            color = color || resourceDataItem.color;
                        }
                    }
                }

                const eventCell = document.createElement('div');
                eventCell.classList.add('smart-scheduler-event', 'smart-scheduler-event-list-event');
                eventCell.style.width = 'calc(100% - 6px)';
                eventCell.style.position = 'static';
                eventCell.style.height = 'auto';
                eventCell.style.marginLeft = eventCell.style.marginRight = eventCell.style.marginBottom = '3px';
                eventCell.style.borderRadius = 'var(--smart-border-radius)';
                eventCell.style.setProperty('--smart-scheduler-event-background', that._getRGBA(backgroundColor));
                eventCell.style.setProperty('--smart-scheduler-event-focus', that._getRGBA(backgroundColor, -1));
                eventCell.style.setProperty('--smart-scheduler-event-hover', that._getRGBA(backgroundColor, -2));
                eventCell.style.setProperty('--smart-scheduler-event-color', that._getRGBA(color));
                eventCell.style.setProperty('--smart-scheduler-event-color-hover', that._getRGBA(color));
                eventCell.style.setProperty('--smart-scheduler-event-color-focus', that._getRGBA(color));
                eventCell.data = eventData;
                eventCell.data.dateStart = eventCell.data.dateStart ? new Date(eventCell.data.dateStart) : null;
                eventCell.data.dateEnd = eventCell.data.dateEnd ? new Date(eventCell.data.dateEnd) : null;

                const eventStatus = eventData.status;

                //Set resources
                that.resources.forEach(resource => {
                    if (eventData[resource.value] !== undefined) {
                        eventCell.setAttribute(resource.value, eventData[resource.value])
                    }
                });

                if (eventStatus !== undefined && that.statuses.some(s => s.value === eventStatus)) {
                    eventCell.setAttribute('status', eventStatus);
                    for (let i = 0; i < that.statuses.length; i++) {
                        if (that.statuses[i].value === eventStatus) {
                            if (that.statuses[i].color) {
                                statusColor = that.statuses[i].color;
                            }
                            break;
                        }
                    }
                }
                else {
                    eventCell.removeAttribute('status');
                }

                if (statusColor) {
                    eventCell.setAttribute('status', '');
                    eventCell.style.setProperty('--smart-scheduler-status-background', that._getRGBA(statusColor));
                }

                eventCell.setAttribute('role', 'gridcell');
                eventCell.title = eventData.label ? eventData.label : that.localize('Unnamed');

                const dateTimeFormat = new Intl.DateTimeFormat(that.locale, { hour: that.hourFormat, minute: that.minuteFormat });
                let timeRange = !eventData.dateStart ? that.localize('noDate') : dateTimeFormat.format(eventData.dateStart) + ' - ' + dateTimeFormat.format(eventData.dateEnd);

                if (eventData.allDay && eventData.dateStart) {
                    timeRange =
                        new Intl.DateTimeFormat(that.locale, { day: '2-digit', month: 'short' }).format(eventData.dateStart);

                    if (eventData.dateStart && eventData.dateEnd) {
                        timeRange =
                            new Intl.DateTimeFormat(that.locale, { day: '2-digit', month: 'short' }).format(eventData.dateStart) + ' - ' + new Intl.DateTimeFormat(that.locale, { day: '2-digit', month: 'short' }).format(eventData.dateEnd)
                    }
                }
                else if (eventData.dateStart && eventData.dateEnd) {
                    if (eventData.dateStart.getDate() !== eventData.dateEnd.getDate()) {
                        timeRange =
                            new Intl.DateTimeFormat(that.locale, { day: '2-digit', month: 'short', hour: that.hourFormat, minute: that.minuteFormat }).format(eventData.dateStart) + ' - ' + new Intl.DateTimeFormat(that.locale, { day: '2-digit', month: 'short', hour: that.hourFormat, minute: that.minuteFormat }).format(eventData.dateEnd)
                    }
                    else {
                        timeRange =
                            new Intl.DateTimeFormat(that.locale, { day: '2-digit', month: 'short', hour: that.hourFormat, minute: that.minuteFormat }).format(eventData.dateStart) + ' - ' + new Intl.DateTimeFormat(that.locale, { hour: that.hourFormat, minute: that.minuteFormat }).format(eventData.dateEnd);
                    }
                }

                if (eventData.dateStart && eventData.dateEnd) {
                    if (eventData.dateStart.getHours() === 0 && eventData.dateStart.getMinutes() === 0 &&
                        eventData.dateEnd.getHours() === 23 && eventData.dateEnd.getMinutes() === 59 &&
                        eventData.dateStart.getDate() === eventData.dateEnd.getDate() &&
                        eventData.dateStart.getMonth() === eventData.dateEnd.getMonth() &&
                        eventData.dateStart.getFullYear() === eventData.dateEnd.getFullYear()) {
                        timeRange =
                            new Intl.DateTimeFormat(that.locale, { day: that.dayFormat, month: that.monthFormat }).format(eventData.dateStart);
                    }
                }

                eventCell.innerHTML = `
                <div class="smart-scheduler-event-content">
                    <div role="presentation"><label style="white-space: normal;" class="smart-scheduler-event-label">${eventData.label ? eventData.label : that.localize('Unnamed')}</label><div class="smart-event-actions"><span title="${that.localize('editEvent')}" edit class="smart-icon-edit"></span><span title="${that.localize('navigateTo')}" navigate class="smart-icon-navigate"></span></div></div>
                    <div role="presentation"><label class="smart-scheduler-event-time">${timeRange}</label></div>
                </div>`;

                fragment.appendChild(eventCell);
            }

            return fragment;
        }
        content.appendChild(fragment);
        if (mappedEvents.length <= 100) {
            content.appendChild(addEvents(mappedEvents));
        }
        else {
            let index = 0;
            const chunksCount = Math.ceil(mappedEvents.length / 100);

            content.appendChild(addEvents(mappedEvents.slice(0, 100)));
            index++;

            content.onscroll = () => {
                const isScrollBottomReached = content.scrollHeight - content.scrollTop - content.clientHeight < 1;
                if (isScrollBottomReached) {
                    if (index < chunksCount) {
                        const loadingEvents = mappedEvents.slice(index * 100, (index + 1) * 100);
                        content.appendChild(addEvents(loadingEvents));
                        index++;
                    }
                }
            }
        }

        content.onclick = (event) => {
            const schedulerEvent = event.target.closest('.smart-scheduler-event');

            if (schedulerEvent) {
                if (event.target.hasAttribute('edit')) {
                    that._openWindow(schedulerEvent.data);
                }
                else if (event.target.hasAttribute('navigate')) {
                    that.scrollToEvent(schedulerEvent.data);
                }
            }
        }

        content.onpointerdown = (event) => {
            const schedulerEvent = event.target.closest('.smart-scheduler-event');


            if (schedulerEvent) {
                that._dragDetails = { target: schedulerEvent, button: event.button, timestamp: Date.now() };
                that._dragDetails.schedulerEvent = schedulerEvent.cloneNode(true);
                that._dragDetails.schedulerEvent.style.width = 'auto';
                that._dragDetails.schedulerEvent.style.position = '';

                that._dragDetails.schedulerEvent.$ = { event: schedulerEvent.data };
                that._dragDetails.coordinates = { x: event.pageX, y: event.pageY };
                that._dragDetails.originialEvent = event;

                that._listDragDetails = {
                    target: schedulerEvent,
                    x: event.pageX,
                    y: event.pageY
                }
                event.preventDefault();
                event.stopPropagation();
            }
        }

        content.onpointermove = (event) => {
            if (that._listDragDetails && !that._listDragDetails.dragStarted && that._dragDetails) {
                const coords = that._listDragDetails;
                if (Math.abs(event.pageX - coords.x) >= 3 || Math.abs(event.pageY - coords.y) >= 3) {
                    that._setDragStart(that._listDragDetails.target);
                    that._listDragDetails.dragStarted = true;
                    event.preventDefault();
                    event.stopPropagation();
                }

            }
        }

        content.onpointerup = () => {
            delete that._listDragDetails;
        }

        if (that.$.viewListButton.classList.contains('active')) {
            that._popupEventsList.classList.add('open');
        }
        else {
            that._popupEventsList.classList.remove('open');
        }
    }

    _openViewList() {
        const that = this;

        if (!that.showList) {
            return;
        }

        that.$.viewListButton.classList.add('active');
        that.$.viewContent.style.width = 'calc(100% - ' + that.listWidth + 'px)';

        that._refreshViewList();
        that._createTimeline();
        that._refreshViewSelector();

        that._popupEventsList.classList.add('open');
        if (that._resizeLegend) {
            that._resizeLegend();
        }
    }

    _hideViewList() {
        const that = this;

        that.$.viewListButton.classList.remove('active');
        that._popupEventsList.classList.remove('open');

        that._refreshViewList();
        that._createTimeline();
        that._refreshViewSelector();

        if (that._resizeLegend) {
            that._resizeLegend();
        }
    }

    _viewListHandler() {
        const that = this;

        that.$.viewListButton.classList.toggle('active');
        if (that.$.viewListButton.classList.contains('active')) {
            that.$.viewContent.style.width = 'calc(100% - ' + that.listWidth + 'px)';
        }
        else {
            that.$.viewContent.style.width = '';
        }


        that._refreshViewList();


        that._createTimeline();
        that._refreshViewSelector();

        if (that._resizeLegend) {
            that._resizeLegend();
        }
    }

    /**
     * Sets the Current Time indicator
     */
    _setCurrentTimeIndicators() {
        const that = this;

        clearInterval(that._currentTimeIndicatorInterval);
        delete that._currentTimeIndicatorInterval;

        that._refreshIndicators();

        if (!that.currentTimeIndicator && !that.shadeUntilCurrentTime) {
            return
        }

        that._currentTimeIndicatorInterval = setInterval(that._refreshIndicators.bind(that), that.currentTimeIndicatorInterval * 1000);
    }

    /**
     * Refreshes the Current Time indicator and shader
     */
    _refreshIndicators() {
        const that = this,
            viewType = that.viewType,
            cellsContainer = that.$.timelineCellsContainer,
            scaleCount = that._getCellsScaleCount(),
            dayScale = 60 / scaleCount,
            isMonthView = viewType.toLowerCase().indexOf('month') > -1,
            cells = cellsContainer.querySelectorAll('.smart-scheduler-cell:not(.scale)');
        let todayCells = [], currentCellsObj;

        let today = that.currentTime || new Date();

        //Finds the today cells, if any
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i],
                cellDate = new Date(cell.$.cellObj.time);

            if (!cell.$) {
                continue;
            }

            if (today.getFullYear() === cellDate.getFullYear() && today.getMonth() === cellDate.getMonth() && today.getDate() === cellDate.getDate()) {
                if (!isMonthView && cellDate.getHours() !== today.getHours() || cellDate.getMinutes() + dayScale < today.getMinutes() || cellDate.getMinutes() > today.getMinutes()) {
                    continue;
                }

                todayCells.push(cell);
            }
        }

        //Calculates the params for the today cell fill
        if (todayCells.length) {
            const cellObj = todayCells[0].$.cellObj,
                cellDate = new Date(cellObj.time),
                scaleIndex = cellObj.scaleIndex || 0;
            let max, minutes;

            if (isMonthView) {
                minutes = today.getHours() * 60 + today.getMinutes();
                max = 24 * 60;
            }
            else {
                minutes = today.getMinutes();
                max = cellDate.getMinutes() + dayScale;
            }

            currentCellsObj = { cells: todayCells, minutes: minutes, max: max, scaleIndex: scaleIndex };
        }

        //Refreshes the currentTimeIndicator
        that._refreshCurrentTimeIndicator(currentCellsObj);

        //Refreshes the Current Time Shader
        that._refreshCurrentTimeShader(currentCellsObj);
    }

    /**
     * Sets a current time indicator to the header cells
     */
    _refreshCurrentTimeIndicatorHeader() {
        const that = this;

        const currentTimeIndicator = that.currentTimeIndicator,
            timeZone = that.timeZone,
            today = that.currentTime || new Date(),
            year = today.getFullYear(),
            month = today.getMonth(),
            date = today.getDate(),
            hour = today.getHours(),
            viewType = that.viewType.toLowerCase(),
            isInCurrentMonth = (cellDate) => {
                let tempDate = new Date(cellDate);

                for (let i = 0; i < 6; i++) {
                    if (tempDate.getFullYear() === year && tempDate.getMonth() === month && tempDate.getDate() === date) {
                        return true
                    }

                    tempDate.setDate(tempDate.getDate() + 7);
                }
            },
            isAgendaView = viewType.indexOf('agenda') > -1,
            isTimelineView = viewType.indexOf('timeline') > -1,
            isMonthView = viewType.indexOf('month') > -1;

        function setCurrentCell(timeZoneContainers, isVertical) {
            let cells;
            const checkHours = !isAgendaView && !isMonthView && (isVertical && !isTimelineView || !isVertical && isTimelineView);

            for (let i = 0; i < timeZoneContainers.length; i++) {
                const timeZoneContainer = timeZoneContainers[i];

                if (timeZoneContainer.timeZone === timeZone) {
                    cells = timeZoneContainer.children;
                    break
                }
            }

            if (!cells) {
                return
            }

            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];

                if (!cell.$ || !cell.$.cellObj) {
                    return
                }

                const cellDate = cell.$.cellObj.date;

                if (currentTimeIndicator) {
                    if (isMonthView && !isTimelineView) {
                        if (isInCurrentMonth(cellDate)) {
                            cell.setAttribute('current', '');
                        }
                        else {
                            cell.removeAttribute('current');
                        }
                        continue;
                    }

                    if (cellDate.getDate() === date &&
                        (!checkHours || cellDate.getFullYear() === year && cellDate.getMonth() === month && cellDate.getHours() === hour)) {
                        cell.setAttribute('current', '');
                        continue;
                    }
                }

                cell.removeAttribute('current');
            }
        }

        setCurrentCell(that.$.timelineHeaderHorizontalContent.querySelectorAll('.smart-scheduler-cells'));
        setCurrentCell(that.$.timelineHeaderVerticalContent.querySelectorAll('.smart-scheduler-cells'), true);
    }

    /**
     * Refreshes the Current Time indicator
     */
    _refreshCurrentTimeIndicator(currentCellsObj) {
        const that = this,
            viewType = that.viewType,
            indicatorsContainer = that.$.timelineIndicatorsContainer;
        let currentTimeContainer = indicatorsContainer.querySelector('.smart-scheduler-current-time');

        //Sets the current indicator to the header cells
        that._refreshCurrentTimeIndicatorHeader();

        if (!that.currentTimeIndicator || viewType === 'agenda' || !currentCellsObj) {
            if (currentTimeContainer) {
                currentTimeContainer.remove();
            }

            if (!indicatorsContainer.firstElementChild) {
                clearInterval(that._currentTimeIndicatorInterval);
                delete that._currentTimeIndicatorInterval;
            }
            return
        }

        const [todayCells, minutes, max, scaleIndex] = [currentCellsObj.cells, currentCellsObj.minutes, currentCellsObj.max, currentCellsObj.scaleIndex],
            cellsCount = todayCells.length,
            scaleCount = that._getCellsScaleCount();

        if (!currentTimeContainer) {
            currentTimeContainer = document.createElement('div');
            currentTimeContainer.classList.add('smart-scheduler-current-time');
            currentTimeContainer.setAttribute('role', 'presentation');
        }

        const indicators = currentTimeContainer.children;

        that._recycleContainerCells({
            fragment: currentTimeContainer,
            cellsNeeded: cellsCount,
            className: 'smart-scheduler-current-time-indicator'
        });

        for (let i = 0; i < indicators.length; i++) {
            const todayCell = todayCells[i],
                indicator = indicators[i],
                todayCellContainer = todayCell.closest('.smart-scheduler-cell-container');
            let size;

            if (that.rightToLeft) {
                if (viewType.toLowerCase().indexOf('timeline') > -1) {
                    size = (parseFloat(todayCellContainer.style.width) / scaleCount) * (scaleIndex + 1);
                    indicator.style.width = todayCell.style.width;
                    indicator.style.height = todayCell.style.height;
                    indicator.style.right = parseFloat(todayCellContainer.style.right) + size * (minutes / max) + 'px';
                    indicator.style.top = todayCell.style.top;
                }
                else {
                    size = (parseFloat(todayCellContainer.style.height) / scaleCount) * (scaleIndex + 1);
                    indicator.style.width = todayCell.style.width;
                    indicator.style.height = todayCell.style.height;
                    indicator.style.right = todayCell.style.right;
                    indicator.style.top = parseFloat(todayCellContainer.style.top) + size * (minutes / max) + 'px';
                }
            }
            else {
                if (viewType.toLowerCase().indexOf('timeline') > -1) {
                    size = (parseFloat(todayCellContainer.style.width) / scaleCount) * (scaleIndex + 1);
                    indicator.style.width = todayCell.style.width;
                    indicator.style.height = todayCell.style.height;
                    indicator.style.left = parseFloat(todayCellContainer.style.left) + size * (minutes / max) + 'px';
                    indicator.style.top = todayCell.style.top;
                }
                else {
                    size = (parseFloat(todayCellContainer.style.height) / scaleCount) * (scaleIndex + 1);
                    indicator.style.width = todayCell.style.width;
                    indicator.style.height = todayCell.style.height;
                    indicator.style.left = todayCell.style.left;
                    indicator.style.top = parseFloat(todayCellContainer.style.top) + size * (minutes / max) + 'px';
                }
            }


            indicator.removeAttribute('role');
            indicator.setAttribute('aria-label', 'Current Time Indicator');
        }

        if (!currentTimeContainer.parentElement) {
            indicatorsContainer.appendChild(currentTimeContainer);
        }
    }

    /**
     * Sets the Current Time Shader / Shades the timeline until the current time
     */
    _refreshCurrentTimeShader(currentCellsObj) {
        const that = this,
            indicatorsContainer = that.$.timelineIndicatorsContainer;
        let shaderContainer = indicatorsContainer.querySelector('.smart-scheduler-shader');

        if (!that.shadeUntilCurrentTime || that.viewType === 'agenda') {
            if (shaderContainer) {
                shaderContainer.remove();
            }

            if (!that.currentTimeIndicator) {
                clearInterval(that._currentTimeIndicatorInterval);
                delete that._currentTimeIndicatorInterval;
            }
            return
        }

        if (!shaderContainer) {
            shaderContainer = document.createElement('div');
            shaderContainer.classList.add('smart-scheduler-shader');
        }

        const shades = shaderContainer.children;

        if (!currentCellsObj) {
            const hCellRanges = that._getCellShadeRangesByDate(),
                ranges = hCellRanges.length;

            that._recycleContainerCells({
                fragment: shaderContainer,
                cellsNeeded: ranges,
                className: 'smart-scheduler-shade'
            });

            if (!ranges) {
                shaderContainer.remove();

                if (!indicatorsContainer.firstElementChild) {
                    clearInterval(that._currentTimeIndicatorInterval);
                    delete that._currentTimeIndicatorInterval;
                    return
                }
            }

            for (let i = 0; i < ranges; i++) {
                const cellRange = hCellRanges[i],
                    firstHCell = cellRange.hFrom,
                    lastHCell = cellRange.hTo,
                    firstVCell = that._getFirstShadeCell(cellRange.vFrom.$.cellObj, true),
                    lastVCell = that._getFirstShadeCell(cellRange.vTo.$.cellObj, true, true);
                const shade = shades[i];

                that._recycleContainerCells({
                    fragment: shade,
                    cellsNeeded: 1,
                    className: 'smart-scheduler-shade-section'
                });

                const shadeFirst = shade.children[0];

                if (that.rightToLeft) {
                    shadeFirst.style.width = parseFloat(lastHCell.style.right) + parseFloat(lastHCell.style.width) - parseFloat(firstHCell.style.right) + 'px';
                    shadeFirst.style.height = parseFloat(lastVCell.style.top) + parseFloat(lastVCell.style.height) - parseFloat(firstVCell.style.top) + 'px';

                    shadeFirst.style.right = firstHCell.style.right;
                    shadeFirst.style.top = firstVCell.style.top;
                }
                else {
                    shadeFirst.style.width = parseFloat(lastHCell.style.left) + parseFloat(lastHCell.style.width) - parseFloat(firstHCell.style.left) + 'px';
                    shadeFirst.style.height = parseFloat(lastVCell.style.top) + parseFloat(lastVCell.style.height) - parseFloat(firstVCell.style.top) + 'px';

                    shadeFirst.style.left = firstHCell.style.left;
                    shadeFirst.style.top = firstVCell.style.top;
                }
            }
        }
        else {
            that._shadeUntilToday(shaderContainer, currentCellsObj);
        }

        if (!shaderContainer.parentElement) {
            indicatorsContainer.insertBefore(shaderContainer, indicatorsContainer.firstElementChild);
        }
    }

    /**
     * Creates the shaders for the today cells
     * @param {HTMLElement} shaderContainer - the shader container
     * @param {Array[Object]} currentCellsObj - an object containing the today cells and details about them
     */
    _shadeUntilToday(shaderContainer, currentCellsObj) {
        const that = this;

        if (!currentCellsObj) {
            shaderContainer.innerHTML = '';
            return
        }

        const left = !that.rightToLeft ? 'left' : 'right';

        const shades = shaderContainer.children,
            viewType = that.viewType,
            isMonthView = viewType.indexOf('month') > -1,
            scaleCount = that._getCellsScaleCount(),
            [todayCells, minutes, max, scaleIndex] = [currentCellsObj.cells, currentCellsObj.minutes, currentCellsObj.max, currentCellsObj.scaleIndex],
            shadersCount = todayCells ? todayCells.length : 1;

        that._recycleContainerCells({
            fragment: shaderContainer,
            cellsNeeded: shadersCount,
            className: 'smart-scheduler-shade'
        });

        for (let i = 0; i < shadersCount; i++) {
            const todayCell = todayCells[i],
                shade = shades[i],
                todayCellContainer = todayCell.closest('.smart-scheduler-cell-container'),
                hCell = todayCell.$.cellObj.horizontal,
                vCell = todayCell.$.cellObj.vertical;
            let size;

            if (viewType.toLowerCase().indexOf('timeline') > -1) {
                that._recycleContainerCells({
                    fragment: shade,
                    cellsNeeded: 1,
                    className: 'smart-scheduler-shade-section'
                });

                const shadeFirst = shade.children[0];
                const firstHCell = that._getFirstShadeCell(hCell);

                size = (parseFloat(todayCellContainer.style.width) / scaleCount) * (scaleIndex + 1);
                shadeFirst.style.width = parseFloat(todayCellContainer.style[left]) - parseFloat(firstHCell.style[left]) + size * (minutes / max) + 'px';
                shadeFirst.style.height = todayCell.style.height;
                shadeFirst.style[left] = firstHCell.style[left];
                shadeFirst.style.top = todayCell.style.top;

            }
            else {
                that._recycleContainerCells({
                    fragment: shade,
                    cellsNeeded: isMonthView ? 3 : 2,
                    className: 'smart-scheduler-shade-section'
                });

                const shadeFirst = shade.children[0],
                    shadeSecond = shade.children[1];
                const firstHCell = that._getFirstShadeCell(hCell),
                    firstVCell = that._getFirstShadeCell(vCell, true),
                    lastVCell = that._getFirstShadeCell(vCell, true, true);

                size = (parseFloat(todayCellContainer.style.height) / scaleCount) * (scaleIndex + 1);

                shadeFirst.style.top = firstVCell.style.top;
                shadeFirst.style[left] = firstHCell.style[left];

                //NOTE: In Basic Month view, 3 shade sections are used per shade
                if (isMonthView) {
                    shadeFirst.style.width = parseFloat(todayCell.style[left]) - parseFloat(firstHCell.style[left]) + 'px';
                    shadeFirst.style.height = parseFloat(todayCellContainer.style.top) - parseFloat(firstVCell.style.top) + parseFloat(todayCellContainer.style.height) + 'px';

                    const lastHCell = that._getFirstShadeCell(hCell, undefined, true),
                        shadeThird = shade.children[2];

                    shadeSecond.style.width = parseFloat(lastHCell.style[left]) + parseFloat(lastHCell.style.width) - parseFloat(firstHCell.style[left]) - parseFloat(shadeFirst.style.width) + 'px';
                    shadeSecond.style.height = parseFloat(todayCellContainer.style.top) - parseFloat(firstVCell.style.top) + 'px';
                    shadeSecond.style.top = firstVCell.style.top;
                    shadeSecond.style[left] = parseFloat(firstHCell.style[left]) + parseFloat(shadeFirst.style.width) + 'px';

                    shadeThird.style.top = parseFloat(shadeSecond.style.top) + parseFloat(shadeSecond.style.height) + 'px';
                    shadeThird.style[left] = shadeSecond.style[left];
                    shadeThird.style.width = todayCell.style.width;
                    shadeThird.style.height = size * (minutes / max) + 'px';
                }
                else {
                    shadeFirst.style.width = parseFloat(todayCell.style[left]) + parseFloat(todayCell.style.width) - parseFloat(firstHCell.style[left]) + 'px';
                    shadeFirst.style.height = parseFloat(todayCellContainer.style.top) - parseFloat(firstVCell.style.top) + size * (minutes / max) + 'px';

                    shadeSecond.style.top = parseFloat(shadeFirst.style.top) + parseFloat(shadeFirst.style.height) + 'px';
                    shadeSecond.style[left] = firstHCell.style[left];
                    shadeSecond.style.width = parseFloat(todayCell.style[left]) - parseFloat(firstHCell.style[left]) + 'px';
                    shadeSecond.style.height = parseFloat(lastVCell.style.top) + parseFloat(lastVCell.style.height) - parseFloat(shadeSecond.style.top) + 'px';
                }
            }
        }
    }

    /**
     * Returns the first header cell for the shader
     * @param {*} cellObj - target cell object
     * @param {*} isVertical - determines whether vertical cell or horizontal
     * @param {*} isReversed - determines whether the first or last cell is needed
     */
    _getFirstShadeCell(cellObj, isVertical, isReversed) {
        const that = this,
            cells = (isVertical ? that.$.timelineHeaderVerticalContent : that.$.timelineHeaderHorizontalContent).querySelectorAll('.smart-scheduler-view-time .smart-scheduler-cell'),
            cellGroup = cellObj.group;

        if (!cellGroup) {
            return isReversed ? cells[cells.length - 1] : cells[0]
        }

        let targetCell;

        for (let i = 0; i < cells.length; i++) {
            const hCell = cells[i],
                group = hCell.$.cellObj.group;

            if (group && Object.keys(group).every(g => group[g] === cellGroup[g])) {
                targetCell = hCell;

                if (!isReversed) {
                    return targetCell
                }
            }
        }

        return targetCell
    }

    /**
     * Returns an array of cell ranges(from, to) for shading
     * @param {Boolean} isVertical - determines whether the cell are vertical or horizontal
     */
    _getCellShadeRangesByDate() {
        const that = this,
            isTimelineView = that.viewType.indexOf('timeline') > -1,
            today = that.currentTime || new Date(),
            todayYear = today.getFullYear(),
            todayMonth = today.getMonth(),
            todayDate = today.getDate(),
            todayHours = today.getHours(),
            cells = that.$.timelineHeaderHorizontalContent.querySelectorAll('.smart-scheduler-view-time .smart-scheduler-cell'),
            vCells = that.$.timelineHeaderVerticalContent.querySelectorAll('.smart-scheduler-cell'),
            getVCellsRange = (date) => {
                let vStart, vEnd;

                for (let i = 0; i < vCells.length; i++) {
                    vEnd = vCells[i];

                    if (!vEnd.$) {
                        continue;
                    }

                    const tempDate = new Date(vEnd.$.cellObj.date);

                    tempDate.setDate(date.getDate());

                    const time = tempDate.getTime() || 0;

                    if (!vStart && time <= today.getTime()) {
                        vStart = vEnd;
                    }

                    if (vStart && time > today.getTime()) {
                        break;
                    }
                }
                return vStart && vEnd ? { from: vStart, to: vEnd } : undefined
            },
            isDateToday = (date) => date.getFullYear() === todayYear && date.getMonth() === todayMonth && date.getDate() === todayDate;
        let cellRanges = [], firstCell, lastCell, vCellRange;

        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i],
                date = cell.$.cellObj.date;

            if (!firstCell && date.getTime() <= today.getTime()) {
                firstCell = cell;
            }

            if (isDateToday(date) && (!isTimelineView || date.getHours() === todayHours)) {
                vCellRange = getVCellsRange(date);

                lastCell = !vCellRange ? lastCell : cell;

                if (lastCell) {
                    vCellRange = getVCellsRange(lastCell.$.cellObj.date);

                    if (vCellRange) {
                        cellRanges.push({ hFrom: firstCell, hTo: lastCell, vFrom: vCellRange.from, vTo: vCellRange.to });
                    }
                }

                firstCell = undefined;
            }

            lastCell = cell;
        }

        if (firstCell && !cellRanges.length) {
            lastCell = cells[cells.length - 1];
            const lastCellTime = lastCell.$ ? lastCell.$.cellObj.date.getTime() : 0;

            if (lastCellTime > today.getTime()) {
                lastCell = firstCell;
            }

            vCellRange = lastCell.$ ? getVCellsRange(lastCell.$.cellObj.date) : undefined;

            if (vCellRange) {
                cellRanges.push({ hFrom: firstCell, hTo: lastCell, vFrom: vCellRange.from, vTo: vCellRange.to })
            }
        }

        return cellRanges
    }

    /**
     * Refreshes the content of the header cells
     */
    _refreshTimelineHeaderCells(orientation) {
        const that = this;

        //Update the content of the additional header
        if (!orientation) {
            orientation = 'horizontal';
            that._refreshTimelineHeaderCells('vertical');
        }

        if (orientation === 'horizontal' && that.$.timelineViewAllDay.offsetHeight) {
            that.$.timelineViewAllDaylabel.innerHTML = `<div>${that.localize('allDay')}</div>`;
        }

        const [scrollAmount, offset, size, container] = orientation === 'horizontal' ?
            ['scrollLeft', 'left', 'width', that.$.timelineHeaderHorizontalContent] :
            ['scrollTop', 'top', 'height', that.$.timelineHeaderVerticalContent],
            timeZoneLabelContainer = that.$.timelineTimeZoneLabelContainer,
            timeZones = that.timeZones,
            rightToLeft = that.rightToLeft,
            cellsContainer = container.querySelector('.smart-scheduler-view-time'),
            viewType = that.viewType,
            isTimelineView = viewType.indexOf('timeline') > -1,
            viewCells = cellsContainer.children,
            scrollSize = that[scrollAmount],
            cellsObj = that._timelineCells[orientation];
        let startTimelineCellIndex, timeZoneLabels;

        //Get the first visible timeline cell
        for (let i = 0; i < cellsObj.length; i++) {
            const cellObj = cellsObj[i];

            if (scrollSize <= cellObj[offset] + cellObj[size]) {
                startTimelineCellIndex = i;
                break;
            }
        }

        if (timeZoneLabelContainer.parentElement && (!isTimelineView && viewType !== 'agenda' && orientation === 'vertical') ||
            (isTimelineView && orientation === 'horizontal')) {
            timeZoneLabels = timeZoneLabelContainer.children;
        }

        for (let i = 0; i < viewCells.length; i++) {
            const viewCell = viewCells[i],
                cells = viewCell.children;
            let cellIndex = startTimelineCellIndex;

            if (timeZoneLabels) {
                const timeZoneObj = timeZones.find(zone => zone.id === viewCell.timeZone);

                if (timeZoneLabels[i]) {
                    timeZoneLabels[i].innerHTML = timeZoneObj ? `<div>${timeZoneObj.label}</div>` : '';
                }
            }

            //Update the content of the header cells
            for (let c = 0; c < cells.length; c++) {
                const cell = cells[c],
                    cellObj = cellsObj[cellIndex];

                if (!cellObj) {
                    break;
                }

                cellIndex++;

                cell.$ = { cellObj: cellObj };

                cell.innerHTML = `<div>${cellObj.noLabel ? '' :
                    that._getDateString({ date: new Date(cellObj.date), timeZone: viewCell.timeZone }, orientation)}</div>`;

                cell.style[size] = cellObj[size] + 'px';

                if (orientation === 'horizontal') {
                    if (rightToLeft) {
                        cell.style.left = '';
                        cell.style.right = cellObj[offset] + 'px';
                    }
                    else {
                        cell.style.right = '';
                        cell.style.left = cellObj[offset] + 'px';
                    }
                }
                else {
                    cell.style[offset] = cellObj[offset] + 'px';
                }

                cellObj.weekend ? cell.setAttribute('weekend', '') : cell.removeAttribute('weekend');
                cellObj.nonworking ? cell.setAttribute('nonworking', '') : cell.removeAttribute('nonworking');
                cellObj.separator ? cell.setAttribute('separator', '') : cell.removeAttribute('separator');
                cellObj.groupSeparator ? cell.setAttribute('group-separator', '') : cell.removeAttribute('group-separator');
                cellObj.showLabel ? cell.setAttribute('show-label', cellObj.showLabel) : cell.removeAttribute('show-label');
                cellObj.restricted ? cell.setAttribute('restricted', '') : cell.removeAttribute('restricted');
            }
        }

        //Refreshes the Header Details/Groups container
        that._refreshHeaderDetailCells(orientation);
        that._refreshHeaderGroupCells(orientation);

        container[scrollAmount] = scrollAmount === 'scrollLeft' ? that._getScrollLeft(that[scrollAmount]) : that[scrollAmount];
    }

    /**
    * Refreshes the Header Group cells
    * @param {String} orientation
    * @param {Boolean} refreshContentOnly - determines whether to refresh the content only or not
    */
    _refreshHeaderGroupCells(orientation) {
        const that = this,
            cellsObj = that._timelineCells.groups,
            groupContainer = that.$.groupsContainer,
            groupByDate = that.groupByDate;
        let offset, size, scrollAmount, container, cellsContainer;

        if (!groupContainer) {
            return;
        }

        cellsContainer = groupContainer.querySelector('.smart-scheduler-view-header-groups-container');
        container = orientation === 'horizontal' ? that.$.timelineHeaderHorizontal : that.$.timelineHeaderVertical;

        if (!cellsObj || !cellsContainer || !container.contains(cellsContainer)) {
            return;
        }

        [offset, size, scrollAmount] = orientation === 'vertical' ? ['top', 'height', 'scrollTop'] : ['left', 'width', 'scrollLeft'];

        //Recycle the cells
        let viewCells = cellsContainer.children,
            fragment = document.createDocumentFragment();

        while (viewCells.length) {
            fragment.appendChild(cellsContainer.firstElementChild);
        }

        viewCells = fragment.children;

        for (let i = 0; i < viewCells.length; i++) {
            const viewCell = viewCells[i],
                cellObj = cellsObj[i];

            //Refreshes the cells
            that._refreshAdditionalHeaderCells({
                orientation: orientation,
                fragment: viewCell,
                type: 'groups',
                offset: offset,
                size: size,
                cellsObj: cellObj[groupByDate ? 'cellsByDate' : 'cells'],
                resource: cellObj.resource
            });
        }

        cellsContainer.appendChild(fragment);

        that.$.groupsContainer.querySelector('.smart-scheduler-view-groups-content')[scrollAmount] =
            scrollAmount === 'scrollLeft' ? that._getScrollLeft(that[scrollAmount]) : that[scrollAmount];
    }

    /**
     * Refreshes the header details cells
     * @param {String} orientation - header orientation - horizontal or vertical
     * @param {Boolean} refreshContentOnly  - determines whether to update the content only or everythong
     */
    _refreshHeaderDetailCells(orientation, refreshContentOnly) {
        const that = this,
            cellsObj = that._timelineCells.details;
        let offset, size, container, cellsContainer;

        if (!cellsObj || orientation !== 'horizontal' || that.viewType !== 'timelineWeek') {
            return;
        }

        container = that.$.timelineHeaderHorizontalContent;
        cellsContainer = container.querySelector('.smart-scheduler-view-details');

        if (!cellsContainer) {
            return;
        }

        [offset, size] = ['left', 'width'];

        //Recycle the cells
        let viewCells = cellsContainer.children,
            fragment = document.createDocumentFragment();

        while (viewCells.length) {
            fragment.appendChild(cellsContainer.firstElementChild);
        }

        //Refreshes the cells
        that._refreshAdditionalHeaderCells({
            orientation: orientation,
            fragment: fragment,
            type: 'details',
            offset: offset,
            size: size,
            cellsObj: cellsObj,
            refreshContentOnly: refreshContentOnly
        });

        cellsContainer.appendChild(fragment);
    }

    /**
     * Refreshes the cells of the Additional headers(Details or Groups)
     * @param {Object} details
     */
    _refreshAdditionalHeaderCells(details) {
        const that = this,
            isAgendaView = that.viewType === 'agenda',
            orientation = details.orientation,
            fragment = details.fragment,
            [type, offset, size, cellsObj, resource] = [details.type, details.offset, details.size, details.cellsObj, details.resource]
        const firstCell = that._getFirstCellObjInView({ orientation: orientation, type: type, resource: resource });

        if (!firstCell) {
            return;
        }

        //Generate additional cells if needed
        that._recycleContainerCells({
            fragment: fragment,
            cellsNeeded: that._getTimelineVisibleCellsCount({ orientation: orientation, type: type, resource: resource })
        });

        const viewCells = Array.from(fragment.children),
            cellIndex = cellsObj.indexOf(firstCell),
            rightToLeft = that.rightToLeft,
            cellOffset = offset === 'top' ? offset : 'left';

        for (let i = 0; i < viewCells.length; i++) {
            const cell = viewCells[i],
                cellObj = cellsObj[cellIndex + i];

            cell.$ = { cellObj: cellObj };

            if (type === 'groups') {
                //NOTE: In Agenda view, only the group cells regarding the agenda events should be visible
                if (!cellObj[size] && isAgendaView) {
                    cell.remove();
                    continue
                }

                that._setGroupContent(cell);
            }
            else {
                const date = cellObj.date;
                cell.innerHTML = `<div>${cellObj.noLabel ? '' : that._getDateString({ date: new Date(date) }, orientation, true)}</div>`;
            }

            cellObj.groupSeparator ? cell.setAttribute('group-separator', '') : cell.removeAttribute('group-separator');
            cellObj.separator ? cell.setAttribute('separator', '') : cell.removeAttribute('separator');

            if (cellObj.group) {
                const cellGroup = cellObj.group;

                for (const g in cellGroup) {
                    cell.setAttribute(g, cellGroup[g] || '')
                    cell.setAttribute('group-value', cellGroup[g] || '')
                }
            }

            cell.style.top = cell.style.left = cell.style.width = cell.style.height = null;
            cell.style[size] = cellObj[size] + 'px';

            if (cellOffset === 'left') {
                if (rightToLeft) {
                    cell.style.left = '';
                    cell.style.right = cellObj[offset] + 'px';
                }
                else {
                    cell.style.right = '';
                    cell.style.left = cellObj[offset] + 'px';
                }
            }
            else {
                cell.style.left = '';
                cell.style.right = '';
                cell.style[cellOffset] = cellObj[offset] + 'px';
            }
        }
    }

    /**
     *  Creates the Window Editor
     */
    _createWindow(type) {
        const that = this,
            windowName = type ? type + 'SchedulerWindow' : 'schedulerWindow';

        if (that.$[windowName]) {
            return that.$[windowName];
        }

        const popupWindow = document.createElement('smart-window');

        popupWindow.classList.add('smart-scheduler-window');

        if (type) {
            popupWindow.classList.add(type);
            popupWindow.id = that.id + 'ConfirmWindow';
        }
        else {
            popupWindow.id = that.id + 'Window';
        }

        //Configure
        popupWindow.setAttribute('smart-id', windowName);
        that.$[windowName] = popupWindow;
        that['$' + windowName] = Smart.Utilities.Extend(popupWindow);

        //Set properties
        popupWindow.rightToLeft = that.rightToLeft;
        popupWindow.theme = that.theme;
        popupWindow.animation = that.animation;
        popupWindow.disableSnap = true;
        popupWindow.headerButtons = ['close'];

        return popupWindow;
    }

    /**
     * Opens the popupWindow
     */
    _openWindow(target, originalTarget, windowType) {
        const that = this;

        if (!target) {
            target = that._createEventFromSelection();

            if (!target) {
                return
            }
        }

        if ([that.$.schedulerWindow, that.$.confirmSchedulerWindow].some(i => i && i.opened) || that.disableWindowEditor) {
            return
        }

        //NOTE: Currently only Repeat event Confirm window and event editor window are used
        const type = originalTarget ? 'confirm' : '';
        function configureWindow() {
            function openWindow() {
                //Positions the windiow in the center always
                that._positionWindow();

                if (popupWindow.opened) {
                    popupWindow.bringToFront();
                    popupWindow._handleActiveState();

                    if (popupWindow._onOpenCallback) {
                        popupWindow._onOpenCallback();
                    }
                }
                else {
                    popupWindow.open();
                }
            }

            //Set the Content for the Window
            if (that.windowCustomizationFunction) {
                that.windowCustomizationFunction(popupWindow, type, that._cloneObject(target));
            }
            else {
                that._setPopupWindowTemplate('header', type, windowType);
                that._setPopupWindowTemplate('footer', type, windowType);
                that._setPopupWindowTemplate('content', type, windowType);
            }

            if (!popupWindow.opened) {
                const windowExtended = that['$' + (type ? type + 'SchedulerWindow' : 'schedulerWindow')];

                windowExtended.unlisten('transitionend');
                windowExtended.unlisten('open');
                windowExtended.unlisten('close');
                windowExtended.unlisten('closing');
                windowExtended.unlisten('click');
                windowExtended.unlisten('change');
                windowExtended.unlisten('keydown');

                //Called when the window is opened. Focuses the first Input inside the window
                if (!type) {
                    popupWindow._onOpenCallback = () => {
                        const labelEditor = (popupWindow.shadowRoot || popupWindow).querySelector('.smart-input');
                        (labelEditor || popupWindow).focus({ preventScroll: true });
                    }
                }

                //Bind to events
                if (popupWindow.hasAnimation) {
                    windowExtended.listen('transitionend', that._windowTransitionendHandler.bind(that));
                }

                windowExtended.listen('open', that._windowOpenHandler.bind(that));
                windowExtended.listen('close', that._windowCloseHandler.bind(that));
                windowExtended.listen('closing', that._windowClosingHandler.bind(that));
                windowExtended.listen('click', that._windowClickHandler.bind(that));
                windowExtended.listen('change', that._windowChangeHandler.bind(that));
                windowExtended.listen('keydown', that._windowKeyDownHandler.bind(that));
            }

            if (popupWindow.shadowRoot) {
                //The styles for the input
                popupWindow.importStyle(Smart.Utilities.Core.getScriptLocation() + Smart.StyleBaseUrl.replace('/scoped/', '/smart.textbox.css'));

                that._onShadowDomLoaded(popupWindow, 'smart.window.css', openWindow);
            }
            else {
                openWindow();
            }

            //Set Aria to indicate the owner
            const ariaOwns = (that.getAttribute('aria-owns') || '') + ' ' + popupWindow.id;

            that.setAttribute('aria-owns', ariaOwns.trim());
        }

        if (!target) {
            return;
        }

        const popupWindow = that._createWindow(type),
            isOpeningEventPrevented = that.$.fireEvent('editDialogOpening', { target: popupWindow, type: type, item: that._cloneObject(target) }).defaultPrevented;

        if (isOpeningEventPrevented) {
            return;
        }

        //Used to store the event
        popupWindow._target = { event: target, originalTarget: originalTarget, windowType: windowType };

        if (!popupWindow.parentElement) {
            that.getShadowRootOrBody().appendChild(popupWindow);
        }

        if (!popupWindow.isCompleted) {
            popupWindow.whenReady(() => configureWindow());
        }
        else {
            configureWindow();
        }
    }

    /**
     * Position the Window to the center of the element
     */
    _positionWindow() {
        const that = this,
            windowParent = that.getShadowRootOrBody(),
            popupWindows = [that.$.schedulerWindow, that.$.confirmSchedulerWindow];

        for (let i = 0; i < popupWindows.length; i++) {
            const popupWindow = popupWindows[i];

            if (!popupWindow || !windowParent.contains(popupWindow)) {
                continue
            }

            const rect = that.getBoundingClientRect();

            if (!popupWindow.opened) {
                popupWindow.style.left = popupWindow.style.top = '';
            }

            if (popupWindow.querySelector('.smart-scheduler-window-repeat')) {
                const popupWindowWidth = popupWindow.offsetWidth;

                if (!popupWindow.hasAttribute('horizontal') && popupWindowWidth * 2 <= rect.width) {
                    popupWindow.setAttribute('horizontal', '');
                }
                else if (popupWindow.hasAttribute('horizontal') && popupWindowWidth > rect.width) {
                    popupWindow.removeAttribute('horizontal');
                }
            }
            else {
                popupWindow.removeAttribute('horizontal');
            }

            if (that._isMobile) {
                popupWindow.setAttribute('mobile', '');
                popupWindow.style.left = (rect.left + window.pageXOffset) + 'px';
                popupWindow.style.top = (rect.top + window.pageYOffset) + 'px';
                popupWindow.style.width = rect.width + 'px';
                popupWindow.style.height = rect.height + 'px';
            }
            else {
                popupWindow.style.left = Math.max(rect.left + window.pageXOffset, (rect.left + window.pageXOffset + rect.width / 2 - popupWindow.offsetWidth / 2)) + 'px';
                popupWindow.style.top = Math.max(rect.top + window.pageYOffset, (rect.top + window.pageYOffset + rect.height / 2 - popupWindow.offsetHeight / 2)) + 'px';
            }
        }
    }

    /**
    * PopupWindow Transitionend Event Handler
    */
    _windowTransitionendHandler(event) {
        const that = this,
            target = event.target;

        // if (targetWindow !== that.$.schedulerWindow) {
        if (!target.classList.contains('smart-scheduler-window')) {
            return
        }

        let targetWindow, windowExtended;

        if (target.classList.contains('confirm')) {
            targetWindow = that.$.confirmSchedulerWindow;
            windowExtended = that.$confirmSchedulerWindow;
        }
        else {
            targetWindow = that.$.schedulerWindow;
            windowExtended = that.$schedulerWindow;
        }

        //Removes the popupWindow from the DOM when it's closed
        if (!targetWindow.opened && event.propertyName === 'visibility') {
            windowExtended.unlisten('transitionend');
            targetWindow.remove();
        }
    }

    /**
    * PopupWindow Open event handler
    */
    _windowOpenHandler(event) {
        const that = this,
            target = event.target;

        if (!target.classList.contains('smart-scheduler-window')) {
            return
        }

        const targetWindow = target.classList.contains('confirm') ? that.$confirmSchedulerWindow : that.$schedulerWindow,
            eventObj = target._target.event;

        if (targetWindow) {
            that._handleModal(true);

            if (target === that.$.schedulerWindow) {
                that.$.fireEvent('editDialogOpen', { target: event.target, editors: that._windowEditors, item: that._cloneObject(eventObj) });
            }
            else {
                that.$.fireEvent('editDialogOpen', { target: event.target, item: that._cloneObject(eventObj) });
            }

            targetWindow.unlisten('open');
        }
    }

    /**
     * PopupWindow Closing event handler
     */
    _windowClosingHandler(event) {
        const that = this,
            target = event.target;

        if (!target.classList.contains('smart-scheduler-window')) {
            return
        }

        const targetWindow = target.classList.contains('confirm') ? that.$confirmSchedulerWindow : that.$schedulerWindow;

        if (targetWindow) {
            const eventObj = { target: event.target, item: that._cloneObject(event.target._target.event) };

            if (target === that.$.schedulerWindow) {
                eventObj.editors = that._windowEditors;
            }

            if (that.$.fireEvent('editDialogClosing', eventObj).defaultPrevented) {
                event.preventDefault();
                return;
            }

            targetWindow.unlisten(event.type);

            //Remove the Aria for the ownership of the window
            if (that.hasAttribute('aria-owns')) {
                const ariaOwns = that.getAttribute('aria-owns').replace(targetWindow.id, '').trim();

                ariaOwns ? that.setAttribute('aria-owns', ariaOwns) : that.removeAttribute('aria-owns');
            }
        }
    }

    /**
     * PopupWindow Close event handler
     */
    _windowCloseHandler(event) {
        const that = this,
            target = event.target;

        if (!target.classList.contains('smart-scheduler-window')) {
            return
        }

        const targetWindow = target.classList.contains('confirm') ? that.$confirmSchedulerWindow : that.$schedulerWindow;

        if (targetWindow) {
            const eventObj = event.target._target.event;

            that._handleModal();

            if (target === that.$.schedulerWindow) {
                that.$.fireEvent('editDialogClose', { target: event.target, editors: that._windowEditors, item: that._cloneObject(eventObj) });
            }
            else {
                that.$.fireEvent('editDialogClose', { target: event.target, item: that._cloneObject(eventObj) });
            }

            targetWindow.unlisten('close');
            targetWindow.unlisten('click');
            targetWindow.unlisten('keydown');

            //Remove the Aria for the ownership of the window
            if (that.hasAttribute('aria-owns')) {
                that.removeAttribute('aria-owns');
            }

            if (!that.hasAnimation) {
                targetWindow.remove();
            }

            const eventCell = that._getEventCell(target._target.originalTarget || eventObj);

            (eventCell ? eventCell : that.$.timeline).focus({ preventScroll: true });

        }
    }

    /**
     * Returns the event cell that corresponds to the object
     * @param {Object} eventObj - event object
     */
    _getEventCell(eventObj) {
        const that = this;

        if (eventObj instanceof HTMLElement) {
            eventObj = eventObj.$.event;
        }

        if (!eventObj) {
            return
        }

        const eventCells = that.$.timelineEventsContainer.children;

        for (let i = 0; i < eventCells.length; i++) {
            const eventCell = eventCells[i],
                cellObj = eventCell.$ ? eventCell.$.event : undefined;

            //Event Collectors do not have cellObj like the event cells
            if (!cellObj) {
                continue;
            }

            const repeatingEvent = cellObj.$ ? cellObj.$.event : undefined;

            if ((cellObj === eventObj || repeatingEvent && (repeatingEvent === eventObj || eventObj.$ && repeatingEvent === eventObj.$.event))) {
                return eventCell
            }
        }
    }

    /**
     * Popup Window change event handler
     * @param {Event} event
     */
    _windowChangeHandler(event) {
        const that = this,
            target = event.target,
            popupWindow = target.closest('.smart-scheduler-window.confirm') ? that.$.confirmSchedulerWindow : that.$.schedulerWindow;

        event.stopPropagation();

        if (popupWindow !== that.$.schedulerWindow) {
            return
        }

        const editor = target.closest('.smart-scheduler-window-editor'),
            editorType = editor ? editor.getAttribute('type') : undefined;

        if (!editorType) {
            return
        }

        //Handles the Repeat section Radio button options
        if (editorType.indexOf('repeatEnd') > -1) {
            const edtorContainer = target.closest('.smart-scheduler-window-editor[multiple]');

            if (edtorContainer) {
                const editors = edtorContainer.children;

                for (let i = 0; i < editors.length; i++) {
                    const editor = editors[i],
                        editorElement = editor.querySelector('[event-editor]');

                    if (editorElement) {
                        editorElement.disabled = !editor.contains(target);
                    }
                }
            }
            return
        }

        if (!that._windowEditors || !target.hasAttribute('event-editor')) {
            return
        }

        //Handles the Main section Switch button options
        if (editorType === 'allDay') {
            that._handleEditorAllDay(target, popupWindow);
            return
        }

        if (editorType === 'repeat') {
            const eventObj = popupWindow._target.event;

            if (eventObj) {
                that._createWindowEditor('repeat');
                that._positionWindow();
            }
            return
        }

        if (editorType === 'repeatFreq') {
            that._setPopupWindowEditor(that._windowEditors['repeatOn']);
            //Update the label of the editor
            that._setPopupWindowEditor(that._windowEditors['repeatInterval']);
            return
        }

        if (editorType === 'dateStart' || editorType === 'dateEnd') {
            that._handleEditorDateValidation(target);
            return
        }

        if (editorType === 'resources') {
            that._setResourceDataEditor(that._windowEditors['resourceData']);
            return
        }
    }

    /**
     * Handles window key down event
     * @param {Event} event
     */
    _windowKeyDownHandler(event) {
        const that = this,
            target = event.target,
            popupWindow = target.closest('.smart-scheduler-window.confirm') ? that.$.confirmSchedulerWindow : that.$.schedulerWindow;

        event.stopPropagation();

        if (popupWindow !== that.$.schedulerWindow || event.key !== 'Enter') {
            return
        }

        const activeElement = popupWindow.getRootNode().activeElement,
            windowEditors = that._windowEditors,
            targetEvent = popupWindow._target.event;

        if (targetEvent && windowEditors && windowEditors.label && windowEditors.label.contains(activeElement)) {
            //Submit the window
            that._updateEventViaWindow(targetEvent, windowEditors);
            that._handleCellSelection();
            popupWindow.close();
            delete popupWindow._target;
        }
    }

    /**
     * Validates the dateStart/dateEnd editors when some of their values is changed
     * @param {*} target - target editor
     */
    _handleEditorDateValidation(target) {
        const that = this;

        const dateStartEditor = that._windowEditors.dateStart,
            dateEndEditor = that._windowEditors.dateEnd,
            allDayEditor = that._windowEditors.allDay ? that._windowEditors.allDay.querySelector('[event-editor]') : undefined;

        if (!dateStartEditor || !dateEndEditor) {
            return
        }

        const dateStartElement = dateStartEditor.querySelector('[event-editor]'),
            dateEndElement = dateEndEditor.querySelector('[event-editor]'),
            dateObj = {
                dateStart: dateStartElement.value.toDate(),
                dateEnd: dateEndElement.value.toDate(),
                allDay: allDayEditor ? allDayEditor.checked : false
            };

        if (target === dateStartElement) {
            dateObj.type = 'end';
            dateEndElement.value = that._getValidDate(dateObj);
        }
        else if (target === dateEndElement) {
            dateObj.type = 'start';
            dateStartElement.value = that._getValidDate(dateObj);
        }
    }

    /**
     * Handles the AllDay Switch button inside the Window Editor
     * @param {*} target - target editor
     * @param {*} popupWindow - Scheduler popup window
     */
    _handleEditorAllDay(target) {
        const that = this,
            dateStartEditor = that._windowEditors.dateStart,
            dateEndEditor = that._windowEditors.dateEnd;

        if (!dateStartEditor || !dateEndEditor) {
            return
        }

        const dateStartElement = dateStartEditor.querySelector('[event-editor]'),
            dateEndElement = dateEndEditor.querySelector('[event-editor]'),
            isAllDay = target.checked;
        let dateStart = dateStartElement.value.toDate(),
            dateEnd = dateEndElement.value.toDate();

        if (isAllDay) {
            const dateObj = {
                dateStart: dateStart,
                dateEnd: dateEnd,
                allDay: isAllDay,
                type: 'start'
            };

            dateStartElement.formatString = 'yyyy-MMM-dd';
            dateEndElement.formatString = 'yyyy-MMM-dd';

            dateStart.setHours(that.hourStart, 0, 0, 0);
            dateEnd.setHours(that.hourEnd, 0, 0, 0);

            dateStartElement.value = that._getValidDate(dateObj);
            dateObj.type = 'end';
            dateEndElement.value = that._getValidDate(dateObj);
        }
        else {
            const hourStart = that.hourStart,
                schedulerWindow = that.$.schedulerWindow;

            if (schedulerWindow && schedulerWindow._target) {
                dateStart = schedulerWindow._target.event.dateStart;
                dateEnd = schedulerWindow._target.event.dateEnd;
            }
            else {
                dateEnd = new Date(dateStart);
                dateStart.setHours(hourStart, 0, 0, 0);
                dateEnd.setHours(hourStart, 60 / that._getCellsScaleCount(), 0, 0);
            }

            dateStartElement.value = dateStart;
            dateEndElement.value = dateEnd;
            dateStartElement.formatString = 'yyyy-MMM-dd HH:mm';
            dateEndElement.formatString = 'yyyy-MMM-dd HH:mm';
        }
    }

    /**
    * Click Handler for the Popup Window
    * @param {any} event
    */
    _windowClickHandler(event) {
        const that = this;
        let target = (event.originalEvent || event).target;

        if (target.shadowRoot) {
            target = (event.originalEvent || event).composedPath()[0];
        }

        const popupWindow = target.closest('.smart-scheduler-window.confirm') ? that.$.confirmSchedulerWindow : that.$.schedulerWindow,
            windowButton = target.closest('.smart-scheduler-window-button'),
            editors = that._windowEditors,
            targetEvent = popupWindow._target.event,
            windowType = popupWindow._target.windowType;

        if (!popupWindow || !windowButton) {
            return
        }

        //Handles Ok Button click
        if (windowButton.classList.contains('ok') && editors) {
            that._handleCellSelection();
            that._updateEventViaWindow(targetEvent, editors);
        }
        //Handles Delete Button Click
        else if (windowButton.classList.contains('delete')) {
            that._deleteEventViaWindow(targetEvent);
        }

        //Cancel button click
        popupWindow.close();
        delete popupWindow._target;

        //Handles Edit Event Button click for repeating events in order to create an event exception
        if (windowButton.classList.contains('edit-event')) {
            //Add the exception occurrence date
            if (!targetEvent.date) {
                targetEvent.date = new Date(targetEvent.dateStart);
            }

            //NOTE: Event exceptions cannot repeat
            delete targetEvent.repeat;

            //Create a hidden exception
            if (windowType === 'deleteConfirm') {
                targetEvent.hidden = true;
                that._updateEventViaWindow(targetEvent);
                return
            }

            that._openWindow(targetEvent);
        }
        else if (windowButton.classList.contains('edit-series') && targetEvent.$) {
            //NOTE: Delete the repeating series
            if (windowType === 'deleteConfirm') {
                delete targetEvent.$.event.repeat;
                that._updateEventViaWindow(targetEvent);
                return
            }

            that._openWindow(targetEvent.$.event);
        }
    }

    /**
     * Deletes an event via the Window Editor on Delete button Click
     * @param {Object} targetEvent - target event
     */
    _deleteEventViaWindow(targetEvent) {
        const that = this,
            eventIndex = that._events.indexOf(targetEvent),
            repeatingEvent = targetEvent.$ ? targetEvent.$.event : undefined;

        if (repeatingEvent) {
            const eventExceptions = repeatingEvent.repeat ? repeatingEvent.repeat.exceptions : undefined,
                eventExceptionIndex = eventExceptions ? eventExceptions.indexOf(targetEvent) : undefined;

            //Remove event exception
            if (eventExceptionIndex > -1) {
                eventExceptions.splice(eventExceptionIndex, 1);
                that._refreshTimelineEvents();
            }
        }
        else {
            //Remove the event
            if (eventIndex > -1) {
                const itemCopy = that._cloneObject(targetEvent);

                if (that.$.fireEvent('itemChanging', { type: 'removing', item: itemCopy }).defaultPrevented) {
                    return;
                }

                that._events.splice(eventIndex, 1);
                that._refreshTimelineEvents();
                that._updateUndoRedo(that._cloneObject(targetEvent), undefined, 'itemRemove');

                that.$.fireEvent('itemRemove', { item: itemCopy });
                that.$.fireEvent('itemChange', { type: 'remove', item: itemCopy });
            }
        }
    }

    /**
     * Updates a Scheduler event on Window Ok Button click
     * @param {Object} targetEvent - target event
     */
    _updateEventViaWindow(targetEvent, editors) {
        const that = this,
            eventIndex = that._events.indexOf(targetEvent),
            repeatingEvent = targetEvent.$ ? targetEvent.$.event : undefined,
            isNewEvent = eventIndex < 0;

        if (!isNewEvent && that.$.fireEvent('itemChanging', { type: 'updating', item: that._cloneObject(targetEvent) }).defaultPrevented) {
            return
        }

        if (isNewEvent && !repeatingEvent && that.$.fireEvent('itemChanging', { type: 'inserting', item: that._cloneObject(targetEvent) }).defaultPrevented) {
            return
        }

        let eventType = 'Update', itemCopy;

        if (editors) {
            that._updateEventSettings(targetEvent, editors);
        }

        //Update/Create event
        if (isNewEvent) {
            if (that.disableConflicts) {
                if (that._events) {
                    let dates = [];
                    for (let i = 0; i < that._events.length; i++) {
                        const dateObj = that._events[i];
                        dates.push({
                            start: dateObj.dateStart,
                            end: dateObj.dateEnd
                        });
                    }

                    const collision = that.isCollision(targetEvent.dateStart, targetEvent.dateEnd, dates);

                    if (collision) {
                        return true;
                    }
                }
            }


            if (!targetEvent.id) {
                targetEvent.id = that._generateUUID();
            }

            //Check if the event is part of a repeating event
            if (!repeatingEvent) {
                eventType = 'Insert';
                itemCopy = that._cloneObject(targetEvent);

                that._events.push(targetEvent);
                that._updateUndoRedo(undefined, itemCopy, 'itemInsert');
            }
            else if (repeatingEvent.repeat) {
                //Add as exception
                const repeatObj = repeatingEvent.repeat;

                if (!repeatObj.exceptions) {
                    repeatObj.exceptions = [];
                }

                const eventExceptions = repeatObj.exceptions;

                //NOTE: Event exceptions cannot repeat
                delete repeatObj.repeat;

                //If it doesn't exist add it as new exception
                if (eventExceptions.indexOf(targetEvent) < 0) {
                    repeatObj.exceptions.push(targetEvent);
                }

                itemCopy = that._cloneObject(repeatingEvent);
            }
        }
        else {
            itemCopy = that._cloneObject(targetEvent);
        }

        that.$.fireEvent('item' + eventType, { item: itemCopy });
        that.$.fireEvent('itemChange', { type: eventType.toLowerCase(), item: itemCopy });

        that._validateEventDateRange(targetEvent);
        that._refreshTimelineEvents();
    }

    /**
     * Updates a Scheduler event settings via the Window Editors
     * @param {Object} targetEvent - target event
     * @param {Array<HTMLElement>} editors - all editor containers
     */
    _updateEventSettings(targetEvent, editors) {
        const that = this,
            editorNames = Object.keys(editors);

        for (let i = 0; i < editorNames.length; i++) {
            const editorName = editorNames[i],
                eventEditors = editors[editorName].querySelectorAll('[event-editor]'),
                eventEditor = eventEditors[0];

            if (eventEditor) {
                switch (editorName) {
                    case 'allDay':
                        targetEvent[editorName] = eventEditor.checked;

                        if (eventEditor.checked) {
                            targetEvent.dateStart.setHours(0, 0, 0, 0);
                            targetEvent.dateEnd.setHours(23, 59, 59, 999);

                            targetEvent.dateEnd = that._getValidDate({
                                dateStart: targetEvent.dateStart,
                                dateEnd: targetEvent.dateEnd,
                                allDay: true,
                                type: 'end'
                            });
                        }
                        break;
                    case 'dateEnd':
                    case 'dateStart': {
                        const editorValue = eventEditor.value.toDate();
                        let newDateStart, newDateEnd;

                        if (editorName === 'dateStart') {
                            newDateStart = editorValue;
                            newDateEnd = targetEvent.dateEnd;
                        }
                        else {
                            newDateStart = targetEvent.dateStart;
                            newDateEnd = editorValue;
                        }

                        //Validate event DateEnd agains the dateStart
                        newDateEnd = that._getValidDate({
                            dateStart: newDateStart,
                            dateEnd: newDateEnd,
                            type: 'end'
                        });

                        if (!that._isEventRestricted({ dateStart: newDateStart, dateEnd: newDateEnd })) {
                            targetEvent.dateStart = newDateStart;
                            targetEvent.dateEnd = newDateEnd;
                        }
                        break;
                    }
                    case 'conference': {
                        targetEvent[editorName] = eventEditor.value;
                        break;
                    }
                    case 'description':
                    case 'label':
                        targetEvent[editorName] = eventEditor.value;
                        break;
                    case 'exceptions':
                        if (targetEvent.repeat && eventEditor.checked) {
                            delete targetEvent.repeat.exceptions;
                        }
                        break;
                    case 'notifications':
                        if (eventEditor.value.length) {
                            targetEvent.notifications = eventEditor.value.slice(0);
                        }
                        else {
                            delete targetEvent.notifications;
                        }
                        break;
                    case 'hidden':
                        //NOTE: Only event exceptions can be hidden
                        if (targetEvent.$ && targetEvent.$.event) {
                            targetEvent[editorName] = eventEditor.checked;
                        }
                        break;
                    case 'backgroundColor':
                        targetEvent[editorName] = eventEditor.value;

                        if (!targetEvent[editorName]) {
                            delete targetEvent[editorName];
                        }
                        break;
                    case 'resources': {
                        that._updateEventResources(targetEvent, editors, eventEditor);
                        break;
                    }
                    case 'resoruceData':
                        break;
                    case 'status': {
                        const status = that.statuses[eventEditor.selectedIndex];

                        if (status && status.value) {
                            targetEvent[editorName] = status.value;
                        }
                        else {
                            delete targetEvent[editorName];
                        }
                        break;
                    }
                    default:
                        that._updateEventRepeating(targetEvent, editors, editorName, eventEditors);
                        break
                }
            }
        }
    }

    /**
     * Updates the resource settings of an event via the Window Editors
     * @param {Object} targetEvent - target event
     * @param {Array<HTMLElement>} editors - all editor containers
     * @param {HTMLElement} eventEditor - event editor
     */
    _updateEventResources(targetEvent, editors, eventEditor) {
        const that = this,
            resources = that.resources;

        if (!eventEditor.value) {
            resources.forEach(r => delete targetEvent[r.value]);
            return
        }

        const resourceDataEditors = editors.resourceData.querySelectorAll('.smart-scheduler-window-editor[resource-type]');
        let resourceValues = [], isRsourceChanged;

        for (let i = 0; i < resourceDataEditors.length; i++) {
            const resourceDataEditor = resourceDataEditors[i],
                resDataEditor = resourceDataEditor.querySelector('[event-editor]'),
                resourceValue = resourceDataEditor.getAttribute('resource-type');

            if (!resDataEditor || resDataEditor.value && resDataEditor.selectedIndex < 0) {
                resourceValues.push(resourceValue);
                continue;
            }

            const resource = resources.find(res => res.value === resourceValue);

            if (resource) {
                const resData = resource.dataSource[resDataEditor.selectedIndex];

                isRsourceChanged = true;

                if (resData) {
                    targetEvent[resourceValue] = resData.id;
                    resourceValues.push(resourceValue);
                }
                else {
                    delete targetEvent[resourceValue];
                }
            }
        }

        if (isRsourceChanged) {
            //Remove previous resources
            resources.forEach(res => {
                if (resourceValues.indexOf(res.value) < 0) {
                    delete targetEvent[res.value];
                }
            })
        }
    }

    /**
     * Updates the repeating settings of an event via the Window Editors
     * @param {Object} targetEvent - target event
     * @param {Array<HTMLElement>} editors - all editor containers
     * @param {String} editorName - editor name
     * @param {Array<HTMLElement>} eventEditors - event editors
     */
    _updateEventRepeating(targetEvent, editors, editorName, eventEditors) {
        const eventEditor = eventEditors[0];

        if (editorName === 'repeat') {
            if (eventEditor.checked) {
                targetEvent.repeat = targetEvent.repeat || {};
            }
            else {
                delete targetEvent.repeat;
            }
        }
        else {
            if (editorName.toLowerCase().indexOf('repeat') < 0 || !targetEvent.repeat) {
                return
            }

            //Handles repeat settings
            if (typeof targetEvent.repeat !== 'object') {
                targetEvent.repeat = {};
            }

            const repeat = targetEvent.repeat;

            switch (editorName) {
                case 'repeatEnd':
                case 'repeatEndAfter':
                case 'repeatEndOn': {
                    const radioButton = editors[editorName].querySelector('.smart-radio-button');

                    if (radioButton && radioButton.checked) {
                        const editorValue = eventEditor.value;
                        repeat['repeatEnd'] = editorName === 'repeatEndOn' ? editorValue.toDate() : parseInt(editorValue);
                    }
                    break;
                }
                case 'repeatFreq':
                    repeat[editorName] = eventEditor.value.toLowerCase();
                    break;
                case 'repeatInterval':
                    repeat[editorName] = parseInt(eventEditor.value);
                    break;
                case 'repeatOn':
                    switch (repeat.repeatFreq) {
                        case 'weekly':
                            repeat[editorName] = eventEditor.selectedValues;
                            break;
                        case 'monthly':
                            repeat[editorName] = eventEditor.val ? eventEditor.val() : eventEditor.value;
                            break;
                        case 'yearly': {
                            const secondEditorValue = eventEditors[1] ? parseInt(eventEditors[1].value) : 0;
                            repeat[editorName] = { month: eventEditor.selectedIndex, date: secondEditorValue };
                            break;
                        }
                    }
                    break;
            }
        }
    }

    /**
     * Handles the Undo/Redo actions for the events
     * @param {Object} eventObj - the event object
     * @param {string} action - the event action
     */
    _updateUndoRedo(originalEventObj, eventObj, action) {
        const that = this;

        if (!eventObj && !originalEventObj) {
            delete that._undoRedoHistory;
            return
        }

        let undoRedo = that._undoRedoHistory;

        if (!undoRedo) {
            undoRedo = that._undoRedoHistory = { currentStep: 1, steps: [] };
        }

        if (action) {
            const currentStep = undoRedo.currentStep;

            //NOTE: Remove the next(redo) steps if continuing from a previous step
            if (currentStep !== undoRedo.steps.length) {
                undoRedo.steps = currentStep < 1 ? [] : undoRedo.steps.slice(0, currentStep);
            }

            //If greater the step limit, the first step will be removed
            if (undoRedo.steps.length === that.undoRedoSteps) {
                undoRedo.steps.shift();
            }

            undoRedo.steps.push({ oldValue: originalEventObj, newValue: eventObj, action: action, timeStamp: Date.now() });
        }

        //Update the current undo/redo step
        undoRedo.currentStep = Math.max(1, undoRedo.steps.length);
    }

    /**
     * Returns a Boolean value whether Undo Operation is available or not
     */
    _isUndoPossible() {
        const that = this,
            undoRedoHistory = that._undoRedoHistory;

        if (!undoRedoHistory) {
            return
        }

        const steps = undoRedoHistory.steps;

        return steps.length && undoRedoHistory.currentStep > 0
    }

    /**
     * Returns a Boolean value whether Redo operation is available or not
     */
    _isRedoPossible() {
        const that = this,
            undoRedoHistory = that._undoRedoHistory;

        if (!undoRedoHistory) {
            return
        }

        const steps = undoRedoHistory.steps;

        return steps.length && undoRedoHistory.currentStep < steps.length
    }

    /**
     * Handles the Undo and Redo operations for events
     * @param {number | undefined} action - the name of the operation: 'undo' or 'redo'
     * @param {number | undefined} step - the undo/redo step
     */
    _handleUndoRedo(operation = 'undo', step) {
        const that = this,
            undoRedoHistory = that._undoRedoHistory;

        if (!undoRedoHistory) {
            return
        }

        const steps = undoRedoHistory.steps,
            operationStep = operation === 'undo' ? 0 : 1,
            //Find the correct step
            undoRedoRecord = steps[(!isNaN(step) ? step : undoRedoHistory.currentStep + operationStep) - 1];

        //Update to the corresponding step
        if (undoRedoRecord) {
            const events = that._events;
            let eventObj, action, targetEvent;

            if (operation === 'undo') {
                if (undoRedoRecord.newValue && !undoRedoRecord.oldValue) {
                    action = 'delete';
                    eventObj = undoRedoRecord.newValue;
                }
                else if (!undoRedoRecord.newValue && undoRedoRecord.oldValue) {
                    action = 'insert';
                    eventObj = undoRedoRecord.oldValue;
                }
                else if (undoRedoRecord.newValue && undoRedoRecord.oldValue) {
                    action = 'update';
                    eventObj = undoRedoRecord.oldValue;
                }
            }
            else {
                if (undoRedoRecord.newValue && !undoRedoRecord.oldValue) {
                    action = 'insert';
                    eventObj = undoRedoRecord.newValue;
                }
                else if (!undoRedoRecord.newValue && undoRedoRecord.oldValue) {
                    action = 'delete';
                    eventObj = undoRedoRecord.oldValue;
                }
                else if (undoRedoRecord.newValue && undoRedoRecord.oldValue) {
                    action = 'update';
                    eventObj = undoRedoRecord.newValue;
                }
            }

            switch (action) {
                case 'insert':
                    targetEvent = eventObj;
                    events.push(targetEvent);
                    break;
                case 'delete':
                    targetEvent = that._containsEvent(eventObj);

                    if (targetEvent) {
                        events.splice(events.indexOf(targetEvent), 1);
                    }

                    break;
                case 'update': {
                    targetEvent = that._containsEvent(operation === 'undo' ? undoRedoRecord.oldValue : undoRedoRecord.newValue);

                    if (targetEvent) {
                        //Remove all of it's current proeprties
                        for (let i in targetEvent) {
                            delete targetEvent[i];
                        }

                        //Creating a fresh copy here to avoid same memory references
                        const eventCopy = that._cloneObject(eventObj);

                        //Copy all properties of the stored event obj to the original
                        for (let i in eventCopy) {
                            targetEvent[i] = eventCopy[i];
                        }
                    }
                    break;
                }
            }

            if (targetEvent) {
                //Update the currentStep
                undoRedoHistory.currentStep = Math.max(0, steps.indexOf(undoRedoRecord) + operationStep);

                //Close the tooltip
                that.$.tooltip.close();

                //Close the window
                that.closeWindow();

                that._refreshTimelineEvents();
                that.$.fireEvent(undoRedoRecord.action,
                    {
                        operation: operation,
                        eventObj: that._cloneObject(targetEvent),
                        itemDateRange: { dateStart: new Date(eventObj.dateStart), dateEnd: new Date(eventObj.dateEnd) }
                    });

                if (!that.unfocusable) {
                    that.$.timeline.focus({ preventScroll: true });
                }

                return true
            }
        }
    }

    /**
     * Validates the dateEnd according to dateStart
     * @param {Date} dateStart
     * @param {Date} dateEnd
     */
    _getValidDate(dateObj) {
        const [dateStart, dateEnd, type, allDay] = [dateObj.dateStart, dateObj.dateEnd, dateObj.type, dateObj.allDay];
        let from = new Date(dateStart),
            to = new Date(dateEnd);

        if (isNaN(from) || isNaN(to) || dateEnd.getTime() > dateStart.getTime()) {
            return type === 'start' ? from : to
        }

        if (type === 'start') {
            from = new Date(to);
        }
        else {
            to = new Date(from);
        }

        while (from.getTime() > to.getTime()) {
            const currentTime = from.getTime();

            if (type === 'start') {
                from.setHours(from.getHours() - 1);

                //Safari bug fix. When daylight date is reached Safari doesn't change the date. The result is an infinite loop
                if (from.getTime() === currentTime) {
                    from.setHours(from.getHours() - 2);
                }
            }
            else {
                to.setHours(to.getHours() + 1);

                //Safari bug fix. When daylight date is reached Safari doesn't change the date. The result is an infinite loop
                if (to.getTime() === currentTime) {
                    to.setHours(to.getHours() + 2);
                }
            }
        }

        if (allDay && from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth() && from.getDate() === to.getDate()) {
            to.setHours(0, 0, 0, 0);
            to.setDate(to.getDate() + 1);
        }

        return type === 'start' ? from : to
    }

    /**
    * Handles the modal
    * @param {any} open
    */
    _handleModal(open) {
        const that = this;

        let modal = (that.shadowRoot || that).querySelector('.smart-scheduler-window-modal');

        if (open) {
            if (!modal) {
                //Create the modal for the element
                modal = document.createElement('div');
                modal.classList.add('smart-scheduler-window-modal');
            }

            if (!modal.parentElement) {
                that.$.container.appendChild(modal);
                that.setAttribute('modal', '');
            }
        }
        else if (modal && modal.parentElement) {
            modal.parentElement.removeChild(modal);
            that.removeAttribute('modal');
        }
    }

    /**
     * Executes specific functions when a specific style is loaded insnide ShadowDOM
     */
    _onShadowDomLoaded(target, styleName, handler) {
        function checkLoadedStyles() {
            const linkElements = (target.shadowRoot || target.getRootNode()).querySelectorAll('link');

            for (let i = 0; i < linkElements.length; i++) {
                if (linkElements[i].href.indexOf(styleName) !== -1) {
                    handler()
                    return;
                }
            }

            requestAnimationFrame(checkLoadedStyles);
        }

        requestAnimationFrame(checkLoadedStyles);
    }

    /**
     * Populates the Scheduler Window
     * @param {any} section - the section of the Window
     */
    _setPopupWindowTemplate(section, type, windowType) {
        const that = this,
            // popupWindow = that.$.schedulerWindow;
            popupWindow = that.$[type ? type + 'SchedulerWindow' : 'schedulerWindow'];

        if (!popupWindow) {
            return
        }

        if (section === 'content') {
            that._setWindowContent(type, windowType);
            return
        }

        if (!popupWindow[section + 'Template']) {
            popupWindow[section + 'Template'] = that._createWindowTemplate(section, type);
        }

        if (type) {
            that._setWindowTypeSection(section, type, windowType);
            return
        }

        const target = popupWindow._target.event,
            repeatingEvent = target.$ && target.$.event,
            isNewEvent = that._events.indexOf(target) < 0 && !repeatingEvent;
        let isEventException;

        if (repeatingEvent && repeatingEvent.repeat.exceptions) {
            isEventException = repeatingEvent.repeat.exceptions.indexOf(target) > -1;
        }

        //Update the content of the template
        if (section === 'header') {
            const label = (popupWindow.shadowRoot || popupWindow).querySelector('.smart-scheduler-window-label');

            if (target) {
                //TODO: Handle Event details
                if (label) {
                    //If target === event show it's label
                    label.innerHTML = isNewEvent ? that.localize('newEvent') :
                        repeatingEvent && !isEventException ? that.localize('eventException') : target.label;
                }
            }

        }
        else if (section === 'footer') {
            const buttons = (popupWindow.shadowRoot || popupWindow).querySelectorAll('.smart-scheduler-window-button');

            for (let b = 0; b < buttons.length; b++) {
                const button = buttons[b];

                //Avoids problems when ShadowDOM is applied
                button.innerHTML = '<span class="smart-icon"></span>';
                button.theme = that.theme;
                button.rightToLeft = that.rightToLeft;
                button.animation = that.animation;

                if (button.classList.contains('ok')) {
                    button.innerHTML += that.localize('ok');
                    button.setAttribute('aria-label', 'ok');
                }
                else if (button.classList.contains('cancel')) {
                    button.innerHTML += that.localize('cancel');
                    button.setAttribute('aria-label', 'cancel');
                }
                else if (button.classList.contains('delete')) {
                    button.innerHTML += that.localize('delete');
                    button.setAttribute('aria-label', 'delete');
                    button.classList[isNewEvent || repeatingEvent && !isEventException ? 'add' : 'remove']('smart-hidden');
                }

                //Remove ripple element left from incomplete animation
                const unfinishedRippleElement = button.querySelector('.smart-ripple');

                if (unfinishedRippleElement) {
                    unfinishedRippleElement.parentElement.removeChild(unfinishedRippleElement);
                }
            }
        }
    }

    /**
     * Sets the content of the Header/Footer section of the additional windows (e.g. confirm window)
     * @param {String} section - determines whether the section is header or footer
     * @param {String} type - the type of window
     */
    _setWindowTypeSection(section, type, windowType) {
        const that = this,
            popupWindow = that.$[type ? type + 'SchedulerWindow' : 'schedulerWindow'];

        if (!type || !popupWindow) {
            return
        }

        if (type === 'confirm') {
            if (section === 'header') {
                const label = (popupWindow.shadowRoot || popupWindow).querySelector('.smart-scheduler-window-label');

                if (label) {
                    label.innerHTML = that.localize(windowType ? (windowType + 'Label') : 'repeatConfirmLabel') || '';
                }
            }
            else if (section === 'footer') {
                const buttons = (popupWindow.shadowRoot || popupWindow).querySelectorAll('.smart-scheduler-window-button');

                for (let b = 0; b < buttons.length; b++) {
                    const button = buttons[b];

                    //Avoids problems when ShadowDOM is applied
                    button.theme = that.theme;
                    button.rightToLeft = that.rightToLeft;
                    button.animation = that.animation;

                    if (button.classList.contains('edit-event')) {
                        button.innerHTML = that.localize(windowType ? (windowType + 'Event') : 'editEvent');
                        button.setAttribute('aria-label', 'edit-event');
                    }
                    else if (button.classList.contains('edit-series')) {
                        button.innerHTML = that.localize(windowType ? (windowType + 'Series') : 'editSeries');
                        button.setAttribute('aria-label', 'edit-series');
                    }

                    //Remove ripple element left from incomplete animation
                    const unfinishedRippleElement = button.querySelector('.smart-ripple');

                    if (unfinishedRippleElement) {
                        unfinishedRippleElement.parentElement.removeChild(unfinishedRippleElement);
                    }
                }
            }

            return
        }
    }

    /**
    * Sets the content for the Popup Windows
    * @param {any} type
    * @param {any} target
    */
    _setWindowContent(type, windowType) {
        const that = this,
            popupWindow = that.$[type ? type + 'SchedulerWindow' : 'schedulerWindow'];

        if (type) {
            let confirmLabel = popupWindow.querySelector('.smart-scheduler-confirm-label');

            if (!popupWindow.content || (popupWindow.content.innerHTML && !confirmLabel)) {
                return;
            }

            if (!confirmLabel) {
                confirmLabel = document.createElement('label');
                confirmLabel.classList.add('smart-scheduler-confirm-label');
                popupWindow.appendChild(confirmLabel);
            }

            if (type === 'confirm' && confirmLabel) {
                confirmLabel.innerHTML = that.localize(windowType ? windowType : 'repeatConfirm') || '';
            }

            return
        }

        const target = popupWindow._target.event,
            editorContainers = [].slice.call(popupWindow.getElementsByClassName('smart-scheduler-window-editor'));

        if (popupWindow.innerHTML && !editorContainers.length) {
            return;
        }

        if (target) {
            that._createWindowEditor(); //Main editors
            that._createWindowEditor('repeat');//Repeating event editors

            //Accessibility
            if (target.id) {
                popupWindow.setAttribute('aria-controls', target.id);
            }
        }
    }

    /**
     * Creates the Window editors
     * @param {String} type - the type of editors to create
     */
    _createWindowEditor(type = 'main') {
        const that = this,
            popupWindow = that.$.schedulerWindow,
            eventTarget = popupWindow._target.event,
            windowEditors = that._windowEditors;
        let contentWrapper = popupWindow.querySelector('.smart-scheduler-window-content-wrapper'),
            editorContainer = popupWindow.querySelector(`.smart-scheduler-window-${type}`),
            isRepeatingEvent = eventTarget.repeat,
            isEventException = eventTarget.$ && eventTarget.$.event;

        if (windowEditors && windowEditors.repeat) {
            const repeatEditor = windowEditors.repeat.querySelector('[event-editor]');

            if (repeatEditor) {
                isRepeatingEvent = repeatEditor.checked;
            }
        }

        if (!contentWrapper) {
            contentWrapper = document.createElement('div');
            contentWrapper.classList.add('smart-scheduler-window-content-wrapper');
            popupWindow.appendChild(contentWrapper);
        }

        //Will not create repeating editors for repeating event exceptions or non repeating events
        if (type === 'repeat' && (!isRepeatingEvent || isEventException)) {
            if (editorContainer) {
                editorContainer.remove();
            }
            return
        }

        if (!editorContainer) {
            if (windowEditors) {
                //NOTE: repeatInteval is one of the many editors inside smart-scheduler-window-repeat
                //NOTE: label is one of the many editors inside smart-scheduler-window-main
                const editor = type === 'main' ? windowEditors.label : windowEditors.repeatFreq;

                if (editor) {
                    editorContainer = editor.closest(`.smart-scheduler-window-${type}`);
                }
            }

            if (!editorContainer) {
                editorContainer = document.createElement('div');
                editorContainer.classList.add(`smart-scheduler-window-${type}`);
                editorContainer.innerHTML = that._getWindowEditorTemplate(type);
            }
        }

        if (!contentWrapper.contains(editorContainer)) {
            contentWrapper.appendChild(editorContainer);
        }

        //Set the value of the editors here because now they are in the DOM
        const editors = editorContainer.querySelectorAll('.smart-scheduler-window-editor[type]');

        for (let i = 0; i < editors.length; i++) {
            that._setPopupWindowEditor(editors[i]);
        }
    }

    /**
     * Returns the Window Editors template
     * @param {String} type  - the type of template to return. Two editor templates are available: 'main' and 'repeat'
     */
    _getWindowEditorTemplate(type) {
        if (!type || type === 'main') {
            return `
            <div class="smart-scheduler-window-editor" type="label">
                <label></label>
                <smart-input event-editor></smart-input>
            </div>
            <div class="smart-scheduler-window-editor" multiple>
                <div class="smart-scheduler-window-editor" type="dateStart">
                    <label></label>
                    <smart-date-time-picker calendar-button drop-down-append-to="body" event-editor
                    enable-mouse-wheel-action drop-down-display-mode="auto"></smart-date-time-picker>
                </div>
                <div class="smart-scheduler-window-editor" type="dateEnd">
                    <label></label>
                    <smart-date-time-picker calendar-button drop-down-append-to="body" event-editor
                        enable-mouse-wheel-action drop-down-display-mode="auto"></smart-date-time-picker>
                </div>
            </div>
            <div class="smart-scheduler-window-editor" type="description">
                <label></label>
                <smart-text-area event-editor></smart-text-area>
            </div>
            <div class="smart-scheduler-window-editor" multiple>
                <div class="smart-scheduler-window-editor" type="allDay">
                    <label></label>
                    <smart-switch-button event-editor></smart-switch-button>
                </div>
                <div class="smart-scheduler-window-editor" type="hidden">
                    <label></label>
                    <smart-switch-button event-editor></smart-switch-button>
                </div>
                <div class="smart-scheduler-window-editor" type="repeat">
                    <label></label>
                    <smart-switch-button event-editor></smart-switch-button>
                </div>
            </div>
            <div class="smart-scheduler-window-editor" type="conference">
                <label></label>
                <smart-input event-editor></smart-input>
                <div style="color: var(--smart-error);" class="smart-hidden smart-invalid-conference-link-label"></div>
                <div class="smart-hidden" class="smart-conference-link"></div>
            </div>
            <div class="smart-scheduler-window-editor" type="notifications">
                <label></label>
                <smart-notification-panel event-editor></smart-notification-panel>
            </div>
            <div class="smart-scheduler-window-editor" multiple>
                <div class="smart-scheduler-window-editor" type="backgroundColor">
                    <label></label>
                    <smart-color-input event-editor></smart-color-input>
                </div>
                <div class="smart-scheduler-window-editor" type="status">
                    <label></label>
                    <smart-input event-editor></smart-input>
                </div>
            </div>
            <div class="smart-scheduler-window-editor smart-hidden" type="resources">
                <label></label>
                <smart-check-input event-editor disabled></smart-check-input>
            </div>
            <div class="smart-scheduler-window-editor smart-hidden" multiple type="resourceData"></div>
            </div>`
        }

        if (type === 'repeat') {
            return `
                <div class="smart-scheduler-window-editor" type="repeatFreq">
                    <label></label>
                    <smart-input readonly event-editor drop-down-button-position="right"></smart-input>
                </div>
                <div class="smart-scheduler-window-editor" type="repeatInterval">
                    <label></label>
                    <smart-number-input min="1" event-editor></smart-number-input>
                </div>
                <div class="smart-scheduler-window-editor" type="repeatOn" multiple>
                    <label></label>
                </div>
                <div class="smart-scheduler-window-editor" multiple>
                    <div class="smart-scheduler-window-editor" type="repeatEnd">
                        <label></label>
                        <smart-radio-button group-name="repeat"></smart-radio-button>
                    </div>
                    <div class="smart-scheduler-window-editor" type="repeatEndOn">
                        <smart-radio-button group-name="repeat"></smart-radio-button>
                        <smart-date-time-picker calendar-button drop-down-append-to="body" event-editor
                        enable-mouse-wheel-action drop-down-display-mode="auto"></smart-date-time-picker>
                    </div>
                    <div class="smart-scheduler-window-editor" type="repeatEndAfter">
                        <smart-radio-button group-name="repeat"></smart-radio-button>
                        <smart-number-input min="1" event-editor></smart-number-input>
                        <label></label>
                    </div>
                </div>
                <div class="smart-scheduler-window-editor smart-hidden" type="exceptions">
                    <label></label>
                    <smart-check-box event-editor></smart-check-box>
                </div>`
        }
    }

    /**
     * Sets the editor for the event properties
     * @param {HTMLElement} editor - an editor for an event property
     * @param {Object} target - the event that is going to be edited
     */
    _setPopupWindowEditor(editor) {
        const that = this,
            type = editor.getAttribute('type'),
            labelElement = editor.querySelector('label'),
            target = that.$.schedulerWindow._target.event,
            repeatingEvent = target.$ && target.$.event;
        let editElement = editor.querySelector('[event-editor]');

        if (!target) {
            return
        }

        if (!that._windowEditors) {
            that._windowEditors = {};
        }

        const editors = that._windowEditors,
            rightToLeft = that.rightToLeft;

        if (!editors[type]) {
            editors[type] = editor;
        }

        if (labelElement) {
            labelElement.id = that.id + type + 'Label';
            labelElement.innerHTML = that.localize(type);
        }

        if (type === 'label' || type === 'description') {
            editElement.value = target[type] !== undefined ? target[type] + '' : '';
        }
        else if (type.indexOf('date') > -1) {
            const isAllDay = !!target.allDay;

            editElement.formatString = isAllDay ? 'yyyy-MMM-dd' : 'yyyy-MMM-dd HH:mm';
            editElement.calendarButtonPosition = rightToLeft ? 'left' : 'right';
            editElement.value = new Date(target[type]);
        }
        else if (type === 'allDay' || type === 'repeat') {
            editElement.checked = !!target[type];

            //Hide the repeat button for repeating event exceptions
            editor.classList[type === 'repeat' && repeatingEvent ? 'add' : 'remove']('smart-hidden');
        }
        else if (type === 'notifications') {
            //Depending on the repeatFreq property create the appropriate editor
            that._setNotificationEditor(editor, editElement);
        }
        else if (type === 'conference') {
            const invalidLink = editElement.nextElementSibling;
            invalidLink.innerHTML = that.localize('invalidConferenceLink');
            invalidLink.classList.add('smart-hidden');

            const link = editElement.nextElementSibling.nextElementSibling;
            link.innerHTML = `<smart-button class="info">${that.localize('join')}</smart-button>`;
            link.classList.add('smart-hidden');

            labelElement.innerHTML = `<div class="smart-notification-panel">
               <div class="smart-notification-placeholder" role="button" smart-id="placeholder" tabindex="0">${that.localize('placeholderLink')}</div>
            </div>`;
            labelElement.onclick = () => {
                if (editElement.classList.contains('smart-hidden')) {
                    editElement.classList.remove('smart-hidden');
                    labelElement.innerHTML = `<div class="smart-notification-panel">
                <div role="button" smart-id="placeholder" tabindex="0">${that.localize('placeholderSetLink')}</div>
             </div>`;
                    editElement.focus();
                }
            }

            link.onclick = (event) => {
                if (event.target && event.target.classList.contains('smart-button')) {
                    window.open(link.getAttribute('link'), '_blank');
                }
            }

            const setLink = () => {
                if (editElement.value.startsWith('https://zoom.us/')) {
                    link.innerHTML = `<smart-button class="info">${that.localize('joinWith', { value: 'Zoom' })}</smart-button>`;
                }
                else if (editElement.value.startsWith('https://meet.google.com/')) {
                    link.innerHTML = `<smart-button class="info">${that.localize('joinWith', { value: 'Google Meet' })}</smart-button>`;
                }
                else if (editElement.value.startsWith('https://teams.microsoft.com/')) {
                    link.innerHTML = `<smart-button class="info">${that.localize('joinWith', { value: 'Microsoft Teams' })}</smart-button>`;
                }
                link.setAttribute('link', editElement.value);
                link.classList.remove('smart-hidden');
            }

            const validateLink = () => {
                const valid = /^(ftp|http|https):\/\/[^ "]+$/.test(editElement.value);
                if (valid) {
                    invalidLink.classList.add('smart-hidden');

                    setLink();
                }
                else {
                    invalidLink.classList.remove('smart-hidden');
                    link.classList.add('smart-hidden');
                }
            }
            editElement.onchange = editElement.onkeyup = () => {
                const valid = /^(ftp|http|https):\/\/[^ "]+$/.test(editElement.value);

                if (that._typing) {
                    clearTimeout(that._typing);
                }
                that._typing = setTimeout(() => {
                    if (valid) {
                        invalidLink.classList.add('smart-hidden');

                        setLink();
                    }
                    else {
                        invalidLink.classList.remove('smart-hidden');
                        link.classList.add('smart-hidden');
                    }
                }, 300);
            }

            editElement.classList.add('smart-hidden');

            if (target[type]) {
                editElement.value = target[type];
                editElement.classList.remove('smart-hidden');
                labelElement.innerHTML = `<div class="smart-notification-panel">
                <div role="button" smart-id="placeholder" tabindex="0">${that.localize('placeholderSetLink')}</div>
             </div>`;

                setLink();
                validateLink();
            }
            else {
                editElement.value = '';

            }
        }
        else if (type === 'repeatFreq') {
            const allowedValues = ['hourly', 'daily', 'weekly', 'monthly', 'yearly'],
                repeatFreq = target.repeat ? (target.repeat.repeatFreq + '').toLowerCase() : allowedValues[0];

            editElement.dataSource = [
                { label: that.localize(allowedValues[0]), value: allowedValues[0] },
                { label: that.localize(allowedValues[1]), value: allowedValues[1] },
                { label: that.localize(allowedValues[2]), value: allowedValues[2] },
                { label: that.localize(allowedValues[3]), value: allowedValues[3] },
                { label: that.localize(allowedValues[4]), value: allowedValues[4] }];

            editElement.value = that.localize(allowedValues.indexOf(repeatFreq) > -1 ? repeatFreq : allowedValues[0]);
        }
        else if (type === 'repeatInterval') {
            const repeatInterval = parseInt(target.repeat ? target.repeat.repeatInterval : undefined);

            editElement.value = !isNaN(repeatInterval) ? repeatInterval : 1;

            if (labelElement && editors.repeatFreq) {
                const repeatFreqEditor = editors.repeatFreq.querySelector('[event-editor]');

                if (repeatFreqEditor) {
                    const repeatFrequencies = {
                        'hourly': 'repeatEveryHour',
                        'daily': 'repeatEveryDay',
                        'weekly': 'repeatEveryWeek',
                        'monthly': 'repeatEveryMonth',
                        'yearly': 'repeatEveryYear'
                    },
                        selectedValue = repeatFreqEditor.dataSource[Math.max(0, repeatFreqEditor.selectedIndex)].value || '';

                    labelElement.innerHTML += ` (${that.localize(repeatFrequencies[selectedValue.toLowerCase()]) || ''})`;
                }
            }
        }
        else if (type === 'repeatOn') {
            //Depending on the repeatFreq property create the appropriate editor
            that._setRepeatOnEditor(editor, editElement);
        }
        else if (type.indexOf('repeatEnd') > -1) {
            let repeatEnd = target.repeat ? target.repeat.repeatEnd : undefined,
                repeatEndCondition = repeatEnd;

            switch (type) {
                case 'repeatEnd':
                    repeatEndCondition = !repeatEndCondition;
                    break;
                case 'repeatEndOn':
                    repeatEndCondition = repeatEndCondition instanceof Date;
                    break;
                case 'repeatEndAfter':
                    repeatEndCondition = typeof repeatEndCondition === 'number' && !isNaN(repeatEndCondition);
                    break;
            }

            const radioButton = editor.querySelector('.smart-radio-button');

            if (radioButton) {
                radioButton.innerHTML = that.localize(type + 'Option');
                radioButton.checked = repeatEndCondition;
                that._setEditorCommonProperties(radioButton);
            }

            if (editElement) {
                if (editElement instanceof Smart.DateTimePicker) {
                    repeatEnd = new Date(repeatEnd);
                    editElement.formatString = 'yyyy-MMM-dd';
                    editElement.calendarButtonPosition = rightToLeft ? 'left' : 'right';
                    editElement.value = repeatEndCondition && !isNaN(repeatEnd.getTime()) ? repeatEnd : new Date();
                }
                else {
                    repeatEnd = parseInt(repeatEnd);
                    editElement.value = repeatEndCondition && !isNaN(repeatEnd) ? repeatEnd : 1;
                }

                editElement.disabled = radioButton && !radioButton.checked;
            }
        }
        else if (type === 'exceptions') {
            const exceptions = !repeatingEvent && target.repeat && target.repeat.exceptions && target.repeat.exceptions.length;

            //Determines whether the exceptions should be deleted or not
            editElement.checked = false;
            editElement.innerHTML = that.localize('resetExceptions');
            editor.classList[exceptions ? 'remove' : 'add']('smart-hidden');

        }
        else if (type === 'hidden') {
            editElement.checked = !!target[type];

            //Show the hide event button for repeating event exceptions
            editor.classList[repeatingEvent ? 'remove' : 'add']('smart-hidden');
        }
        else if (type === 'backgroundColor') {
            if (!editElement.dataSource) {
                editElement.dataSource = target.colorScheme || that.colorScheme;
            }

            //Used to set custom style on the color input
            const colorInputPopup = editElement.$.scrollView;

            if (colorInputPopup) {
                colorInputPopup.classList.add('smart-scheduler-color-input');
            }

            editElement.valueDisplayMode = 'colorBox';
            editElement.value = target.backgroundColor || '';
        }
        else if (type === 'status') {
            that._setStatusEditor(editor, editElement);
        }
        else if (type === 'resources') {
            that._setResourceEditor(editor, editElement);
        }
        else if (type === 'resourceData') {
            that._setResourceDataEditor(editor);
        }

        if (editElement && labelElement) {
            editElement.setAttribute('aria-labelledby', labelElement.id);
        }

        that._setEditorCommonProperties(editElement);
    }

    /**
     * Sets the common properties of the element
     * @param {HTMLElement} editElement - scheduler window editor
     */
    _setEditorCommonProperties(editElement) {
        const that = this;

        if (editElement) {
            const messages = editElement.messages,
                schedulerMessages = that.messages,
                locale = that.locale;

            if (messages) {
                for (let m in messages['en']) {
                    const localizeMessage = schedulerMessages[locale][m];

                    if (localizeMessage !== undefined) {
                        if (!messages[locale]) {
                            messages[locale] = {};
                        }
                        messages[locale][m] = localizeMessage;
                    }
                }
            }

            editElement.locale = that.locale;
            editElement.rightToLeft = that.rightToLeft;
            editElement.animation = that.animation;
            editElement.theme = that.theme;
        }
    }

    /**
     * SEts the Notification Editor
     * @param {HTMLElement} editor - editor container
     * @param {*} editElement
     */
    _setNotificationEditor(editor, editElement) {
        const that = this,
            popupWindow = that.$.schedulerWindow,
            target = popupWindow._target.event;

        if (!target) {
            editElement.value = [];
            return
        }

        editElement.value = Array.isArray(target.notifications) ? target.notifications.slice() : [];
        editElement.hourStart = that.hourStart;
        editElement.hourFormat = that.hourFormat;
        editElement.minuteFormat = that.minuteFormat;
        editElement.timeZone = that.timeZone;

        that._setEditorCommonProperties(editElement);
    }

    /**
     * Sets the status Window editor
     * @param {HTMLElement} editor - editor container
     * @param {HTMLElement} editElement - scheduler window editor
     */
    _setStatusEditor(editor, editElement) {
        const that = this,
            statuses = that.statuses,
            popupWindow = that.$.schedulerWindow,
            target = popupWindow._target.event;

        if (!target || !statuses.length) {
            editor.classList.add('smart-hidden');
            return
        }

        const targetStatus = target['status'],
            currentStatus = statuses.find(status => status.value === targetStatus);

        editor.classList.remove('smart-hidden');

        editElement.dataSource = that.statuses.map(s => {
            const label = s.value === undefined ? 'none' : s.value;
            return s.label = that.localize(label) || label
        });
        editElement.value = currentStatus ? (that.localize(currentStatus.label) || currentStatus.label) : '';
        editElement.readonly = true;
        editElement.placeholder = that.localize('selectPlaceholder');
        editElement.dropDownButtonPosition = that.rightToLeft ? 'left' : 'right';
        that._setEditorCommonProperties(editElement);
    }

    /**
    * Sets the Scheduler Window resource editor
    * @param {HTMLElement} editor - editor container
    * @param {HTMLElement} editElement - editor element
    */
    _setResourceEditor(editor, editElement) {
        const that = this,
            resources = that.resources,
            popupWindow = that.$.schedulerWindow,
            target = popupWindow._target.event;
        let resourseData = [], selectedResources = [];

        if (!target || !resources.length) {
            editor.classList.add('smart-hidden');
            return
        }

        editor.classList.remove('smart-hidden');

        resourseData = resources.map(res => {
            if (res && target[res.value]) {
                selectedResources.push(res.label);
            }
            return { label: res.label, value: res.value }
        });

        editElement.readonly = true;
        editElement.placeholder = that.localize('selectPlaceholder');
        editElement.dropDownButtonPosition = that.rightToLeft ? 'left' : 'right';
        editElement.disabled = !resources.length;
        editElement.dataSource = resourseData;
        editElement.value = selectedResources.toString();
        that._setEditorCommonProperties(editElement);

        if (editElement.wait) {
            editElement.wait = false;
        }
    }

    /**
    * Sets the Scheduler Window resource data editors
    * @param {HTMLElement} editor - editor container
    */
    _setResourceDataEditor(editorContainer) {
        const that = this,
            resources = that.resources,
            popupWindow = that.$.schedulerWindow,
            target = popupWindow._target.event;
        let editors = Array.from(editorContainer.querySelectorAll('.smart-scheduler-window-editor')),
            usedEditors = [];
        //   debugger;
        if (!target || !resources.length) {
            editorContainer.classList.add('smart-hidden');
            return
        }

        let selectedResources, resorucesEditor;

        if (that._windowEditors.resources) {
            resorucesEditor = that._windowEditors.resources.querySelector('[event-editor]');

            if (resorucesEditor && resorucesEditor.value) {
                selectedResources = resorucesEditor.selectedValues;
            }
        }

        for (let i = 0; i < resources.length; i++) {
            const resource = resources[i],
                resourceLabel = resource.label,
                resourceValue = resource.value,
                resourceData = resource.dataSource;

            if (!resourceData || !selectedResources) {
                continue
            }

            const selectedResCount = selectedResources.length;

            if (selectedResCount && selectedResources.indexOf(resourceValue) > -1 || !selectedResCount && target[resourceValue]) {
                const resourceItem = resourceData.find(resData => resource && resData.id === target[resourceValue]);
                let editor = editors.find(e => e.getAttribute('resource-type') === resourceValue), resoruceLabel, resourceInput;

                if (editor) {
                    resoruceLabel = editor.querySelector('label');
                    resourceInput = editor.querySelector('[event-editor]');
                }
                else {
                    editor = document.createElement('div');
                    resoruceLabel = document.createElement('label');
                    resourceInput = document.createElement('smart-input');

                    resourceInput.setAttribute('event-editor', '');

                    editor.appendChild(resoruceLabel);
                    editor.appendChild(resourceInput);
                    editor.classList.add('smart-scheduler-window-editor');
                    editor.setAttribute('resource-type', resourceValue);

                    editorContainer.appendChild(editor);
                }

                usedEditors.push(editor);

                that._setEditorCommonProperties(resourceInput);
                resoruceLabel.innerHTML = that.localize(resourceLabel) || resourceLabel;
                resourceInput.dataSource = resource.dataSource.map(resData => Object.create({ label: resData.label, value: resData.value }));
                resourceInput.value = resourceItem ? resourceItem.label : '';
                resourceInput.dropDownButtonPosition = that.rightToLeft ? 'left' : 'right';
                resourceInput.readonly = true;
                resourceInput.placeholder = that.localize('selectPlaceholder');
            }
        }

        //Remove editors that are not used
        for (let i = 0; i < editors.length; i++) {
            if (usedEditors.indexOf(editors[i]) < 0) {
                editors[i].remove();
            }
        }

        //Show the editor container
        editorContainer.classList.remove('smart-hidden');
    }

    /**
     * Sets the Scheduler Window repeatOn editors for repeating events
     * @param {HTMLElement} editor - the editor container
     * @param {HTMLElement} editElement - editor element
     */
    _setRepeatOnEditor(editor) {
        const that = this,
            popupWindow = that.$.schedulerWindow,
            target = popupWindow._target.event,
            editors = that._windowEditors,
            repeatOnEditor = editors.repeatOn,
            repeatFreq = editors.repeatFreq.querySelector('[event-editor]').value.toLowerCase();
        let repeatOnCondition = target.repeat ? target.repeat.repeatOn : undefined, condition;

        if (!target || !repeatFreq || ['weekly', 'monthly', 'yearly'].indexOf(repeatFreq) < 0) {
            editor.classList.add('smart-hidden');
            return
        }

        if (!repeatOnEditor.$) {
            repeatOnEditor.$ = {}
        }

        const repeatOnEditors = repeatOnEditor.$;

        for (let editorName in repeatOnEditors) {
            if (editorName !== repeatFreq && repeatOnEditors[editorName]) {
                repeatOnEditors[editorName].remove();
            }
        }

        if (repeatOnCondition === undefined) {
            repeatOnCondition = new Date(target.dateStart);
        }

        let editElement = repeatOnEditors[repeatFreq];

        switch (repeatFreq) {
            case 'weekly': {
                if (!editElement) {
                    editElement = document.createElement('smart-button-group');
                    editElement.dataSource = that._getWeekDays();
                    editElement.selectionMode = 'zeroOrMany';
                    editElement.setAttribute('event-editor', '');
                    repeatOnEditors[repeatFreq] = editElement;
                }

                that._setEditorCommonProperties(editElement);
                editElement.selectedValues = that._getRepeatOnCondition(repeatFreq, repeatOnCondition).map(i => i.toString());
                break;
            }
            case 'monthly':
                if (!editElement) {
                    editElement = document.createElement('smart-number-input');
                    editElement.min = 1;
                    editElement.max = 31;
                    editElement.setAttribute('event-editor', '');

                    const radioButton = document.createElement('smart-radio-button');
                    radioButton.checked = true;
                    radioButton.setAttribute('dayOfMonthOption', '');
                    radioButton.groupName = 'monthlyRepeatOn';
                    radioButton.innerHTML = that.localize('day');

                    const radioButton2 = document.createElement('smart-radio-button');
                    radioButton2.setAttribute('dayOfWeekOption', '');
                    radioButton2.groupName = 'monthlyRepeatOn';
                    radioButton2.innerHTML = that.localize('on').substring(0, 1).toUpperCase() + that.localize('on').substring(1);

                    const container = document.createElement('div');
                    container.classList.add('smart-flex');
                    container.style.flexDirection = 'column';
                    container.style.gap = '10px';

                    const row = document.createElement('div');
                    row.classList.add('smart-scheduler-window-editor');
                    row.appendChild(radioButton);
                    row.appendChild(editElement);

                    container.appendChild(row);

                    const row2 = document.createElement('div');
                    row2.classList.add('smart-scheduler-window-editor');
                    row2.appendChild(radioButton2);

                    const numberEditElement = document.createElement('smart-number-input');
                    numberEditElement.min = 1;
                    numberEditElement.max = 5;
                    numberEditElement.setAttribute('event-editor', '');
                    numberEditElement.setAttribute('setPositionInput', '');
                    container.appendChild(row2);

                    const editElement2 = document.createElement('smart-button-group');
                    editElement2.dataSource = that._getWeekDays();
                    editElement2.selectionMode = 'one';
                    editElement2.selectedIndex = 1;
                    editElement2.setAttribute('event-editor', '');
                    row2.appendChild(numberEditElement);
                    const delimiter = document.createElement('div');
                    row2.appendChild(delimiter);
                    container.appendChild(row2);
                    container.appendChild(editElement2);
                    repeatOnEditors[repeatFreq] = container;
                    editElement.val = function () {
                        if (radioButton.checked) {
                            return parseInt(this.value);
                        }
                        else if (radioButton2.checked) {
                            return {
                                setPosition: parseInt(numberEditElement.value),
                                weekday: editElement2.selectedValues.map(v => parseInt(v))
                            };
                        }
                    };
                }

                that._setEditorCommonProperties(editElement);
                if (typeof repeatOnCondition === 'number') {
                    editElement.value = that._getRepeatOnCondition(repeatFreq, repeatOnCondition).toString();
                    const dayOfMonthOption = editElement.parentElement.parentElement.querySelector('[dayOfMonthOption]');
                    dayOfMonthOption.checked = true;
                }
                else if (repeatOnCondition && repeatOnCondition.setPosition && repeatOnCondition.weekday) {
                    const container = editElement.parentElement.parentElement;
                    const dayOfMonthOption = container.querySelector('[dayOfMonthOption]');
                    const dayOfWeekOption = container.querySelector('[dayOfWeekOption]'),
                        numberInput = container.querySelector('[setPositionInput]'),
                        weekDayEditor = container.querySelector('smart-button-group');
                    dayOfMonthOption.checked = false;
                    dayOfWeekOption.checked = true;
                    numberInput.value = repeatOnCondition.setPosition;
                    weekDayEditor.selectedIndex = typeof repeatOnCondition.weekday === 'number' ? repeatOnCondition.weekday : repeatOnCondition.weekday.map(v => v.toString());
                }
                break;
            case 'yearly': {
                let monthInput, dateInput;

                if (!editElement) {
                    editElement = document.createElement('div');

                    const monthInput = document.createElement('smart-input'),
                        dateInput = document.createElement('smart-number-input');

                    monthInput.dataSource = that._getMonthNames();
                    monthInput.dropDownButtonPosition = that.rightToLeft ? 'left' : 'right';
                    monthInput.readonly = true;
                    dateInput.min = 1;
                    dateInput.max = 31;

                    monthInput.setAttribute('event-editor', '');
                    dateInput.setAttribute('event-editor', '');

                    that._setEditorCommonProperties(monthInput);
                    that._setEditorCommonProperties(dateInput);

                    editElement.appendChild(monthInput);
                    editElement.appendChild(dateInput);
                    editElement.classList.add('smart-scheduler-window-editor');
                    repeatOnEditors[repeatFreq] = editElement;
                }

                if (!monthInput) {
                    monthInput = editElement.querySelector('smart-input');
                }

                if (!dateInput) {
                    dateInput = editElement.querySelector('smart-number-input');
                }

                condition = that._getRepeatOnCondition(repeatFreq, repeatOnCondition);

                monthInput.selectedIndex = condition.index;
                dateInput.value = condition.value.toString();
                break;
            }
        }

        editElement = repeatOnEditors[repeatFreq];

        if (!editor.contains(editElement)) {
            editor.appendChild(editElement);
        }

        editor.classList.remove('smart-hidden');
    }

    /**
     * Returns the array of objects which represent the months and their day index
     */
    _getMonthNames() {
        const that = this,
            data = [],
            monthFormat = that.monthFormat,
            locale = that.locale,
            date = new Date();

        date.setMonth(0);

        for (let i = 0; i < 12; i++) {
            data.push(
                {
                    label: new Intl.DateTimeFormat(locale, { month: monthFormat }).format(date),
                    value: date.getMonth()
                })

            date.setMonth(date.getMonth() + 1);
        }

        return data
    }

    /**
     * Returns the array of objects which represent the weekdays and their day index
     */
    _getWeekDays() {
        const that = this,
            data = [],
            weekdayFormat = that.weekdayFormat,
            locale = that.locale,
            date = new Date();

        date.setDate(date.getDate() - date.getDay() + that.firstDayOfWeek);

        for (let i = 0; i < 7; i++) {
            data.push(
                {
                    label: new Intl.DateTimeFormat(locale, { weekday: weekdayFormat }).format(date),
                    value: date.getDay()
                })

            date.setDate(date.getDate() + 1);
        }

        return data
    }

    /**
     * Creates the Template for the corresponding section of the popupWindow
     */
    _createWindowTemplate(section, type) {
        const that = this,
            animation = that.animation,
            theme = that.theme,
            rightToLeft = that.rightToLeft,
            template = document.createElement('template');

        if (section === 'footer') {
            if (!type) {
                template.innerHTML =
                    `<smart-button class="smart-scheduler-window-button ok primary"
                        animation="${animation}" theme="${theme}" ${rightToLeft ? 'right-to-left' : ''}>
                    </smart-button>
                    <smart-button class="smart-scheduler-window-button cancel"
                        animation="${animation}" theme="${theme}" ${rightToLeft ? 'right-to-left' : ''}>
                    </smart-button>
                    <smart-button class="smart-scheduler-window-button delete secondary"
                        animation="${animation}" theme="${theme}" ${rightToLeft ? 'right-to-left' : ''}>
                    </smart-button>`;
            }
            else if (type === 'confirm') {
                template.innerHTML = `
                    <smart-button class="smart-scheduler-window-button edit-event"
                        animation="${animation}" theme="${theme}" ${rightToLeft ? 'right-to-left' : ''}>
                    </smart-button>
                    <smart-button class="smart-scheduler-window-button edit-series"
                        animation="${animation}" theme="${theme}" ${rightToLeft ? 'right-to-left' : ''}>
                    </smart-button>`;
            }
        }
        else if (section === 'header') {
            template.innerHTML = '<span class="smart-scheduler-window-label"></span>';
        }

        return template;
    }

    /**
     * Validates the currentTimeIndicatorInterval property
     * @param {} oldValue
     * @param {*} newValue
     */
    _currentTimeIndicatorIntervalValidator(oldValue, newValue) {
        return Math.max(1, newValue)
    }

    /**
     * Validates the hourStart/hourEnd properties
     * @param {} oldValue
     * @param {*} newValue
     */
    _hourValidator(oldValue, newValue) {
        return Math.max(0, Math.min(23, newValue))
    }

    /**
     * Validates an Array of potential dates. Used for Restricted Dates
     */
    _datesValidator(oldValue, newValue) {
        const that = this;
        let dates = [];

        for (let i = 0; i < newValue.length; i++) {
            const date = that._parseDate(newValue[i]);

            if (!isNaN(date)) {
                date.setHours(0, 0, 0, 0);
                dates.push(date);
            }
        }

        return dates
    }

    /**
     * Date validator for the startDate, endDate properties
     */
    _dateValidator(oldValue, newValue) {
        const that = this;

        newValue = that._parseDate(newValue);

        return that._minMaxDateValidator(isNaN(newValue) ? oldValue : newValue);
    }

    _dateMaxValidator(oldValue, newValue) {
        const that = this;
        newValue = that._parseDate(newValue);

        if (newValue > that.min) {
            return newValue;
        }


        return oldValue;
    }

    _dateMinValidator(oldValue, newValue) {
        const that = this;

        newValue = that._parseDate(newValue);

        if (newValue < that.max) {
            return newValue;
        }

        return oldValue;
    }

    /**
     * Parses the value to date object
     * @param {string|number|date} newValue - the value
     */
    _parseDate(newValue) {
        let newDate;

        if (newValue instanceof Date) {
            return newValue;
        }
        else if (Smart.Utilities.DateTime && newValue instanceof Smart.Utilities.DateTime) {
            return newValue.toDate();
        }
        else if (typeof (newValue) === 'string') {
            //regex for the time
            const regexTime = /\d+:\d+:\d+/;

            if (newValue.trim() === 'new Date()' || newValue.trim() === 'new Smart.Utilities.DateTime()') {
                return new Date();
            }
            else if (!isNaN(Date.parse(newValue))) {
                newDate = new Date(Date.parse(newValue));

                if (!regexTime.test(newValue)) {
                    newDate.setHours(0, 0, 0, 0);
                }

                newValue = newDate;
            }
            else {
                const regexDate = /(\d+[,-.\/]{1}\s*\d+[,-.\/]{1}\s*\d+)/;

                if (regexDate.test(newValue)) {
                    const date = regexDate.exec(newValue)[0].replace(/[,-.\/]/g, ',').split(',');

                    if (date.length === 3) {
                        const [day, year] = parseInt(date[0]) < parseInt(date[2]) ? [date[0], date[2]] : [date[2], date[0]];

                        newDate = new Date(parseInt(year), parseInt(date[1]) - 1, parseInt(day));

                        if (regexTime.test(newValue)) {
                            const time = regexTime.exec(newValue)[0].split(':');

                            newDate.setHours(time[0] || 0, time[1] || 0, time[2] || 0);
                        }

                        newValue = newDate;
                    }
                }
            }
        }

        return new Date(newValue);
    }

    /**
     * Validates firstDayOfWeek
     * @param {number} oldValue
     * @param {number} newValue
     */
    _firstDayOfWeekValidator(oldValue, newValue) {
        return Math.min(6, Math.max(0, newValue));
    }

    /**
     * Validates a date according to element's min/max property
     * @param {any} date
     */
    _minMaxDateValidator(date) {
        if (!date || isNaN(date.getTime())) {
            return date;
        }

        const that = this,
            min = new Date(that.min),
            max = new Date(that.max);

        if (min) {
            date = new Date(Math.max(min.getTime(), date.getTime()))
        }

        if (max) {
            date = new Date(Math.min(max.getTime(), date.getTime()));
        }

        return date;
    }

    /**
     * Validates nonworkingDays
     * @param {Array} oldValue
     * @param {Array} newValue
     */
    _nonworkingDayValidator(oldValue, newValue) {
        return this._nonworkingDateTimeValidator(oldValue, newValue);
    }

    /**
     * Validates nonworkingHours
     * @param {Array} oldValue
     * @param {Array} newValue
     */
    _nonworkingTimeValidator(oldValue, newValue) {
        return this._nonworkingDateTimeValidator(oldValue, newValue, true);
    }

    /**
     * Validates nonrowkingDays/nonworkingHours property
     * @param {Array} oldValue
     * @param {Array} newValue
     */
    _nonworkingDateTimeValidator(oldValue, newValue, isTimeValidator) {
        let days = [];
        const [min, max] = [0, isTimeValidator ? 23 : 6];

        for (let i = 0; i < newValue.length; i++) {
            const value = newValue[i];

            if (typeof value === 'number' && !isNaN(value)) {
                days.push(Math.max(min, Math.min(max, parseInt(value))));
            }
            else if (Array.isArray(value)) {
                let from = Math.max(min, Math.min(max, parseInt(value[0]))),
                    to = Math.max(min, Math.min(max, parseInt(value[1])));

                if (!isNaN(from) && !isNaN(to)) {
                    while (from !== to) {
                        days.push(from);
                        from = from === max ? min : ++from;
                    }

                    days.push(from);
                }
            }
            else {
                const date = this._dateValidator(value, value);

                if (date instanceof Date) {
                    days.push(isTimeValidator ? date.getHours() : date.getDay());
                }
            }
        }

        return days;
    }

    /**
     * Sets the viewType of the current view
     */
    _setViewType(view) {
        const that = this,
            viewDetails = that.views.find(v => v.value && v.value === view);

        view = viewDetails ? viewDetails.type : view;

        //Default view is 'day'
        that.set('viewType', that.properties.viewType.allowedValues.indexOf(view) > -1 ? view : 'day');
    }

    /**
    * Validates the timeZone property
    * @param {string} oldValue - old time zone
    * @param {string} newValue  - new time zone
    */
    _timeZoneValidator(oldValue, newValue) {
        const that = this,
            timeZones = new Smart.Utilities.DateTime().timeZones;

        if (!newValue) {
            newValue = 'local';
        }

        newValue = newValue.toLowerCase();

        const timeZone = timeZones.find(tz => tz.id.toLowerCase() === newValue);

        if (timeZone) {
            return timeZone.id
        }

        that.error(that.localize('invalidTimeZone', { elementType: that.nodeName.toLowerCase() }));
        return oldValue
    }

    /**
     * Validates the timeZones property
     */
    _timeZonesValidator(oldValue, newValue) {
        const that = this;
        let timeZones = [];

        for (let i = 0; i < newValue.length; i++) {
            const value = newValue[i],
                timeZone = value.id || value;

            if (that._timeZoneValidator(null, timeZone) !== null) {
                timeZones.push({ id: timeZone, label: value.label || timeZone });
            }
        }

        return timeZones
    }

    /**
     * View proeprty validator
     * @param {String} oldValue
     * @param {String} newValue
     */
    _viewValidator(oldValue, newValue) {
        const that = this;

        //Allows the viewType to be updated
        that._isViewUpdated = true;
        that._setViewType(newValue);
        delete that._isViewUpdated;

        return newValue;
    }

    /**
     * ViewType property validator. Automatically determined based on the view property
     */
    _viewTypeValidator(oldValue, newValue) {
        return this._isViewUpdated ? newValue : oldValue
    }

    /**
     * Validates the Views
     * @param {string | object} oldValue
     * @param {string | object} newValue
     */
    _viewsValidator(oldValue, newValue) {
        const that = this,
            viewTypes = that.properties.viewType.allowedValues;
        let validValue = [];

        for (let i = 0; i < newValue.length; i++) {
            const viewItem = newValue[i];

            if ((typeof viewItem === 'string' && viewTypes.includes(viewItem))) {
                validValue.push(viewItem);
            }
            else if (typeof viewItem === 'object' && viewTypes.includes(viewItem.type)) {
                //Checks the viewItem objects for valid view configuration
                viewItem.value = viewItem.value || viewItem.type;
                viewItem.label = viewItem.label === undefined ? that.localize(viewItem.type) : (viewItem.label + '');
                validValue.push(viewItem);
            }
        }

        return validValue;
    }
});

Smart('smart-notification-panel', class NotificationPanel extends Smart.BaseElement {
    // Element's properties.
    static get properties() {
        return {
            'hourStart': {
                value: 0,
                type: 'number',
            },
            'hourFormat': {
                value: 'numeric',
                allowedValues: ['numeric', '2-digit'],
                type: 'string'
            },
            'messages': {
                extend: true,
                value: {
                    'en': {
                        'beforeAt': 'before at',
                        'days': 'days',
                        'weeks': 'weeks',
                        'placeholder': 'Add notification',
                        'hours': 'Hours',
                        'minutes': 'Minutes',
                        'am': 'am',
                        'pm': 'pm'
                    }
                },
                type: 'object'
            },
            'minuteFormat': {
                value: '2-digit',
                allowedValues: ['numeric', '2-digit'],
                type: 'string'
            },
            'placeholder': {
                value: 'placeholder',
                type: 'string'
            },
            'timeZone': { //Custom time zone. This option accepts a time zone id from Smart.Utilities.DateTime
                value: 'local',
                type: 'string'
            },
            'value': {
                value: [],
                type: 'array'
            }
        }
    }

    /** Element's template. */
    template() {
        return `<div id="container" role="presentation">
                    <div id="notificationsContainer" class="smart-notification-container" role="group"></div>
                    <div id="placeholder" class="smart-notification-placeholder" role="button"></div>
                    <smart-input wait right-to-left="[[rightToLeft]]" readonly id="typeInput" class="smart-notification-editor smart-hidden"></smart-input>
                    <smart-time-input wait right-to-left="[[rightToLeft]]" id="timeInput" class="smart-notification-editor smart-hidden"></smart-time-input>
                    <smart-number-input wait right-to-left="[[rightToLeft]]" id="intervalInput" class="smart-notification-editor smart-hidden"></smart-number-input>
                </div>`
    }

    static get listeners() {
        return {
            'document.click': '_clickHandler',
            'keydown': '_keyDownHandler',
            'container.change': '_containerChangeHandler'
        }
    }

    static get requires() {
        return {
            'Smart.Input': 'smart.input.js',
            'Smart.TimeInput': 'smart.timeinput.js',
            'Smart.NumberInput': 'smart.numberinput.js'
        }
    }

    /**
     * Property Change handler
     * @param {any} propertyName
     * @param {any} oldValue
     * @param {any} newValue
     */
    propertyChangedHandler(propertyName, oldValue, newValue) {
        const that = this;

        if (propertyName === 'placeholder') {
            that.$.placeholder.textContent = that.localize(that.placeholder);
            return
        }
        else if (propertyName === 'rightToLeft') {
            const dropDownButtonPosition = newValue ? 'left' : 'right';

            that.$.typeInput.dropDownButtonPosition = dropDownButtonPosition;
            that.$.intervalInput.dropDownButtonPosition = dropDownButtonPosition;
        }
        else if (propertyName === 'locale') {
            that.$.placeholder.textContent = that.localize(that.placeholder);
            that._handleNotificationEditors();
        }
        else {
            super.propertyChangedHandler(propertyName, oldValue, newValue);
        }

        that._handleNotifications();
    }

    render() {
        const that = this;

        if (!that.hasAttribute('role')) {
            that.setAttribute('role', 'dialog');
        }

        that.$.placeholder.textContent = that.localize(that.placeholder);
        that._handleNotifications();
        that._handleNotificationEditors();
        that._setFocusable();

        super.render();
    }

    /**
     * Sets the tab index
     */
    _setFocusable() {
        const that = this,
            placeholder = that.$.placeholder;

        if (that.disabled || that.unfocusable) {
            that.removeAttribute('tabindex');
            placeholder.removeAttribute('tabindex');
            return;
        }

        const tabIndex = that.tabIndex > 0 ? that.tabIndex : 0;

        that.tabIndex = tabIndex;
        placeholder.setAttribute('tabindex', tabIndex);

        const notificationItems = that.$.notificationsContainer.children;

        for (let i = 0; i < notificationItems.length; i++) {
            const notificationItem = notificationItems[i];

            Array.from(notificationItem.children).forEach(c => {
                if (!(c instanceof HTMLLabelElement)) {
                    c.tabIndex = tabIndex;
                }
            })
        }
    }

    _keyDownHandler(event) {
        const that = this;

        if (that.disabled || that.readonly) {
            return
        }

        const target = event.target;

        switch (event.key) {
            case 'Enter':
                if (target.closest('.smart-notification-item') || target.closest('.smart-notification-placeholder')) {
                    event.preventDefault();
                    that._clickHandler({ target: target });
                }
                break;
            case 'Escape':
            case 'Tab':
                that._hideEditor();
                break;
        }
    }

    /**
     * Container click handler
     * @param {Object} event
     */
    _clickHandler(event) {
        const that = this;
        let target = event.target;

        if (!target || !target.closest || !that.$.container.contains(target) || that.disabled || that.readonly) {
            that._hideEditor();
            return
        }

        if (target.closest('.smart-notificaiton-editor')) {
            return
        }

        if (target.closest('.smart-notification-placeholder')) {
            that._createNotificaiton();
            that._hideEditor();
            return
        }

        const notificationItem = target.closest('.smart-notification-item');

        if (!notificationItem) {
            if (that._editor && !that._editor.classList.contains('smart-hidden') && target.closest('.smart-notification-editor')) {
                return
            }

            that._hideEditor();
            return
        }

        that._hideEditor();

        const notificationObj = notificationItem._notificationObj;

        if (target.hasAttribute('delete')) {
            that._deleteNotification(notificationItem);
            return
        }

        const input = target.closest('.smart-input');

        if (!input) {
            return
        }

        let editor;

        //Open the appropriate editor
        if (target.hasAttribute('interval')) {
            editor = that.$.intervalInput;
            editor.value = notificationObj.interval;
            editor.min = 0;
            editor.max = notificationObj.type === 'days' ? 28 : 4;
        }
        else if (target.hasAttribute('type')) {
            editor = that.$.typeInput;
            editor.value = editor.dataSource.find(d => d.value === notificationObj.type).label;

        }
        else if (target.hasAttribute('time')) {
            editor = that.$.timeInput;
            editor.dateTimeFormat = { hour: that.hourFormat, minute: that.minuteFormat };
            editor.value = notificationObj.time;
        }

        editor._notificationObj = notificationObj;
        editor.classList.remove('smart-hidden');
        editor.wait = false;
        editor.style.width = input.offsetWidth + 'px';
        editor.style.height = input.offsetHeight + 'px';
        editor.style.top = input.offsetTop + 'px';
        editor.style.left = input.offsetLeft + 'px';

        if (editor) {
            editor.open();
        }

        that._editor = editor;
    }

    /**
     * Hides the currently opened editor
     */
    _hideEditor() {
        const that = this,
            editor = that._editor;

        if (!editor) {
            return
        }

        const notificationObj = that._editor._notificationObj;

        if (notificationObj) {
            if (editor === that.$.timeInput) {
                notificationObj.time = editor.value;
            }
            else if (editor === that.$.typeInput) {
                notificationObj.type = editor.value;
            }
            else {
                notificationObj.interval = editor.value;
            }

            that._refreshNotificationItem(notificationObj);
        }

        if (editor.close) {
            editor.close();
        }

        that._editor.classList.add('smart-hidden');
        delete that._editor;
    }

    /**
     * Creates a new notification
     */
    _createNotificaiton() {
        const that = this,
            notifications = that._notifications;

        if (!notifications) {
            return
        }

        const notificationObj = {
            interval: 1,
            type: 'days',
            time: [that.hourStart, 0]
        };

        notifications.push(notificationObj);

        that._refreshNotificationItems();
    }

    /**
     * Delete a notification
     * @param {HTMLElement} notificationItem - a notificaiton item
     */
    _deleteNotification(notificationItem) {
        const that = this,
            notifications = that._notifications;

        if (!notifications || !notificationItem) {
            return
        }

        const notificationObj = notificationItem._notificationObj;

        delete notificationItem._notificationObj;
        notificationItem.remove();

        if (!notificationObj) {
            return
        }

        const notificationIndex = notifications.indexOf(notificationObj);

        if (notificationIndex < 0) {
            return
        }

        notifications.splice(notificationIndex, 1);

        that._refreshNotificationItems();
    }

    _containerChangeHandler(event) {
        const that = this,
            target = event.target,
            notificationObj = target._notificationObj;

        if (target === that.$.timeInput) {
            notificationObj.time = target.value;
        }
        else if (target === that.$.typeInput) {
            notificationObj.type = target.dataSource.find(d => d.label === target.value).value;
        }
        else if (target === that.$.intervalInput) {
            notificationObj.interval = target.value;
        }

        that._refreshNotificationItem(notificationObj);
    }

    /**
     * Refreshes a single notification item
     * @param {Object} notificationObj
     */
    _refreshNotificationItem(notificationObj) {
        const that = this,
            notificationsContainer = that.$.notificationsContainer,
            notifications = notificationsContainer.children;

        for (let i = 0; i < notifications.length; i++) {
            const notificationElement = notifications[i];

            if (notificationElement._notificationObj === notificationObj) {
                let date = new Date();

                date.setHours(notificationObj.time[0], notificationObj.time[1]);

                const itemFields = notificationElement.children;

                for (let c = 0; c < itemFields.length; c++) {
                    const field = itemFields[c];

                    if (field.hasAttribute('interval')) {
                        field.textContent = notificationObj.interval;
                    }
                    else if (field.hasAttribute('type')) {
                        field.textContent = that.localize(notificationObj.type) || notificationObj.type;
                    }
                    else if (field.hasAttribute('time')) {
                        field.textContent = date.toLocaleTimeString(that.locale,
                            { hour: that.hourFormat, minute: that.minuteFormat });
                    }
                }
            }
        }
    }

    /**
     * Refreshes all notifications
     */
    _refreshNotificationItems() {
        const that = this,
            notificationsContainer = that.$.notificationsContainer,
            notifications = that._notifications;

        while (notificationsContainer.firstElementChild) {
            delete notificationsContainer.firstElementChild._notificationObj;
            notificationsContainer.firstElementChild.remove();
        }

        if (notifications && notifications.length) {
            const fragment = document.createDocumentFragment();

            for (let i = 0; i < notifications.length; i++) {
                fragment.appendChild(that._createNotificationItem(notifications[i]));
            }

            if (fragment.children.length) {
                notificationsContainer.appendChild(fragment);
            }
        }

        that._setFocusable();
        that.set('value', notifications);
    }

    /**
     * Handles the value by creating notification items
     */
    _handleNotifications() {
        const that = this,
            value = that.value;
        let notifications;

        that.$.notificationsContainer.innerHTML = '';

        notifications = that._notifications = [];

        for (let i = 0; i < value.length; i++) {
            const notification = value[i];
            let interval = notification.interval, //number
                type = notification.type, //string
                time = notification.time; //Array[number]

            if (interval === undefined || type === undefined || time === undefined) {
                continue
            }

            if (time instanceof Date) {
                time = [time.getHours(), time.getMinutes()];
            }
            else if (!Array.isArray(time)) {
                time = [];
            }

            //Type:
            //0 - 'days', 1 - 'weeks'
            type = !type || type === 'days' ? 'days' : 'weeks';

            //Intercal:
            //Days 0 - 28
            //Weeks 0 - 4
            if (type === 'days') {
                interval = Math.max(0, Math.min(28, interval));
            }
            else {
                type = 'weeks';
                interval = Math.max(0, Math.min(4, interval));
            }

            time[0] = Math.max(0, Math.min(23, time[0] || 0));
            time[1] = Math.max(0, Math.min(59, time[1] || 0));

            const notificationObj = {
                interval: interval,
                type: type,
                time: time
            };

            notifications.push(notificationObj);
        }

        that._refreshNotificationItems();
    }

    /**
     * Creates a new notification item
     * @param {Object} notificationObj
     */
    _createNotificationItem(notificationObj) {
        const that = this,
            notificationElement = document.createElement('div');

        notificationElement.classList.add('smart-notification-item');
        notificationElement.setAttribute('role', 'group');

        let date = new Smart.Utilities.DateTime(new Date()).toDate(that.timeZone);

        date.setHours(notificationObj.time[0], notificationObj.time[1]);

        notificationElement.innerHTML = `
            <div class="smart-input" interval>${notificationObj.interval}</div>
            <div class="smart-input" type>${that.localize(notificationObj.type) || notificationObj.type}</div>
            <label>${that.localize('beforeAt') || ''}</label>
            <div class="smart-input" time>${date.toLocaleTimeString(that.locale,
            { hour: that.hourFormat, minute: that.minuteFormat })}</div>
            <div class="smart-button" delete aria-label="Delete" role="button"></div>`;

        notificationElement._notificationObj = notificationObj;

        return notificationElement
    }

    /**
     * Configures the notification item editors
     */
    _handleNotificationEditors() {
        const that = this,
            rightToLeft = that.rightToLeft,
            locale = that.locale,
            theme = that.theme,
            intervalEditor = that.$.intervalInput,
            typeEditor = that.$.typeInput,
            timeEditor = that.$.timeInput,
            elementMessages = that.messages;

        [intervalEditor, typeEditor, timeEditor].forEach(e => {
            const messages = e.messages;

            for (let m in messages['en']) {
                const localizeMessage = elementMessages[locale][m];

                if (localizeMessage !== undefined) {
                    if (!messages[locale]) {
                        messages[locale] = {};
                    }
                    messages[locale][m] = localizeMessage;
                }
            }

            e.rigtToLeft = rightToLeft;
            e.locale = locale;
            e.theme = theme;
        })

        const dropDownButtonPosition = rightToLeft ? 'left' : 'right';

        timeEditor.dropDownButtonPosition = 'none';
        typeEditor.dropDownButtonPosition = dropDownButtonPosition;
        intervalEditor.dropDownButtonPosition = dropDownButtonPosition;
        typeEditor.dataSource = [{ label: that.localize('days'), value: 'days' }, { label: that.localize('weeks'), value: 'weeks' }];
    }
})