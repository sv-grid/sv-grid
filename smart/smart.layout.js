
/* Smart UI v26.0.8 (2026-05-15) 
Copyright (c) 2011-2026 jQWidgets. 
License: https://htmlelements.com/license/ */ //


class LayoutItem extends HTMLElement {
    constructor() {
        super();

        this._properties = {
            'min': 50,
            'label': 'Item',
            'modifiers': ['resize', 'drag', 'close'],
            'size': null
        }
    }

    _setProperty(property, value) {
        const that = this;

        if (that._properties[property] === value) {
            return;
        }

        that._properties[property] = value;
        that._updating = true;

        if (property === 'disabled' || property === 'modifiers') {
            if (value) {
                that.setAttribute(property, value);
            }
            else {
                that.removeAttribute(property);
            }
        }
        else {
            if (value === null) {
                that.removeAttribute(property);
            }
            else {
                that.setAttribute(property, value);
            }
        }

        if (!that.isCompleted) {
            return;
        }

        const layout = that.closest('smart-layout');

        if (layout) {
            if (!layout._resizeDetails && !layout._updating && layout.isRendered) {
                layout.refresh();
            }
        }
        that._updating = false;
    }

    get label() {
        return this._properties['label'];
    }

    set label(value) {
        this._setProperty('label', value);
    }

    get modifiers() {
        return this._properties['modifiers'];
    }

    set modifiers(value) {
        this._setProperty('modifiers', value);
    }

    get min() {
        return this._properties['min'];
    }

    set min(value) {
        this._setProperty('min', value);
    }

    get size() {
        return this._properties['size'];
    }

    set size(value) {
        if (value !== null) {
            if (typeof value === 'string') {
                this._setProperty('size', value);
            }
            else {
                this._setProperty('size', Math.max(this.min, value));
            }
        }
        else {
            this._setProperty('size', value);
        }
    }

    static get observedAttributes() {
        return ['min', 'size', 'label', 'modifiers'];
    }


    attributeChangedCallback(name, oldValue, newValue) {
        const that = this;

        if (oldValue === newValue) {
            return;
        }

        if (!that.isCompleted) {
            return;
        }

        if (name === 'size') {
            if (!that._updating) {
                if (newValue === null) {
                    this[name] = null;
                    return;
                }

                that[name] = Math.max(that.min, parseInt(newValue));
            }
        }
        else {
            that[name] = newValue;
        }
    }

    connectedCallback() {
        if (!this.isCompleted) {
            this.render();
        }
    }

    whenRendered(callback) {
        const that = this;

        if (that.isRendered) {
            callback();
            return;
        }

        if (!that.whenRenderedCallbacks) {
            that.whenRenderedCallbacks = [];
        }

        that.whenRenderedCallbacks.push(callback);
    }

    render() {
        const that = this;

        if (!that.hasAttribute('data-id')) {
            that.setAttribute('data-id', 'id' + Math.random().toString(16).slice(2));
        }

        if (!that.hasAttribute('label')) {
            that.setAttribute('label', that.label);
        }

        if (!that.hasAttribute('min')) {
            that.setAttribute('min', that.min);
        }

        if (!that.hasAttribute('label')) {
            that.setAttribute('label', that.label);
        }

        if (!that.hasAttribute('modifiers')) {
            that.setAttribute('modifiers', that.modifiers);
        }

        for (let i = 0; i < that.attributes.length; i++) {
            const attribute = that.attributes[i];
            const attributeName = attribute.name;
            const attributeValue = attribute.value;

            if (!isNaN(attributeValue) && (attributeName === 'min' || attributeName === 'size')) {
                that._properties[attributeName] = parseInt(attributeValue);
                continue;
            }

            that._properties[attributeName] = attributeValue;
        }

        that.classList.add('smart-layout-item');

        that.isCompleted = true;

        if (that.whenRenderedCallbacks) {
            for (let i = 0; i < that.whenRenderedCallbacks.length; i++) {
                that.whenRenderedCallbacks[i]();
            }

            that.whenRenderedCallbacks = [];
        }
    }
}

class LayoutGroup extends LayoutItem {
    constructor() {
        super();

        this._properties['label'] = 'Group';
        this._properties['orientation'] = 'vertical'
    }

    get orientation() {
        return this._properties.orientation;
    }

    set orientation(value) {
        this._setProperty('orientation', value);
    }

    static get observedAttributes() {
        return ['min', 'size', 'modifiers', 'orientation', 'position'];
    }

    render() {
        const that = this;

        super.render();

        that.className = 'smart-layout-group';

        if (!that.hasAttribute('orientation')) {
            that.setAttribute('orientation', that._properties['orientation']);
        }
        else {
            that._properties['orientation'] = that.getAttribute('orientation');
        }
    }
}

class TabLayoutGroup extends LayoutGroup {
    constructor() {
        super();
        this._properties['position'] = 'top'
        this._properties['label'] = 'TabGroup';
    }

    get position() {
        return this._properties.position;
    }

    set position(value) {
        this._setProperty('position', value);
    }

    render() {
        const that = this;

        super.render();

        if (!that.hasAttribute('position') && that.position) {
            that.setAttribute('position', 'top');
        }
    }

    static get observedAttributes() {
        return ['min', 'size', 'modifiers', 'orientation', 'position'];
    }
}

class TabLayoutItem extends LayoutGroup {
    constructor() {
        super();
        this._properties['label'] = 'TabItem';
    }
}

customElements.define('smart-layout-group', LayoutGroup);
customElements.define('smart-layout-item', LayoutItem);
customElements.define('smart-tab-layout-group', TabLayoutGroup);
customElements.define('smart-tab-layout-item', TabLayoutItem);


Smart('smart-layout', class Layout extends Smart.ContentElement {
    /**
    * Element's properties
    */
    static get properties() {
        return {
            'allowLiveSplit': {
                value: false,
                type: 'boolean'
            },
            'allowContextMenu': {
                value: false,
                type: 'boolean'
            },
            'contextMenuDataSource': {
                value: ['select', 'delete'],
                type: 'any'
            },
            'dataSource': {
                reflectToAttribute: false,
                value: null,
                type: 'any'
            },
            'messages': {
                value: {
                    'en': {
                        'select': 'Select Parent',
                        'delete': 'Delete'
                    }
                },
                type: 'object',
                extend: true
            },
            'orientation': {
                value: 'vertical',
                type: 'string'
            },
            'selectedIndex': {
                value: null,
                type: 'any'
            }
        }
    }

    /**
    * Element's event listeners.
    */
    static get listeners() {
        return {
            'contextmenu': '_contextMenuHandler',
            'document.down': '_documentDownHandler',
            'document.move': '_documentMoveHandler',
            'document.up': '_documentUpHandler',
            'document.selectstart': '_documentSelectStartHandler',
            'mouseleave': '_leaveHandler',
            'mouseenter': '_enterHandler',
            'dragStart': '_dragStart',
            'document.keyup': '_keyUpHandler'
        }
    }

    _dragStart(event) {
        event.stopPropagation();
        event.preventDefault();
    }

    _leaveHandler() {
        const that = this;

        if (that._resizeDetails) {
            return;
        }

        that._handleButtonsVisibility(null);
        that._hideSplitter();

        requestAnimationFrame(() => {
            that.classList.remove('outline');
        })
    }

    _enterHandler() {
        const that = this;

        if (that._resizeDetails) {
            return;
        }

        that._handleButtonsVisibility(that._selectedItem);

        that._updateSplitter();

        requestAnimationFrame(() => {
            that.classList.add('outline');
        })
    }

    /**
    * Element's HTML template.
    */
    template() {
        return '<div id="container" role="presentation"><smart-layout-group data-id="root" id="itemsContainer"><content></content></smart-layout-group><div root-splitter id="splitter" class="smart-layout-splitter"></div>';
    }

    /**
    * Updates the element when a property is changed.
    * @param {string} propertyName The name of the property.
    * @param {number/string} oldValue The previously entered value. Max, min and value are of type Number. The rest are of type String.
    * @param {number/string} newValue The new entered value. Max, min and value are of type Number. The rest are of type String.
    */
    propertyChangedHandler(propertyName, oldValue, newValue) {
        const that = this;

        switch (propertyName) {
            case 'contextMenuDataSource':
                if (that._contextMenu) {
                    that._closeContextMenu();
                    that._contextMenu.innerHTML = '';
                }
                break;
            case 'orientation':
                if (that.$.itemsContainer) {
                    that.$.itemsContainer.orientation = that.orientation;
                }
                break;
            case 'dataSource':
                that.dataBind();
                break;
            case 'selectedIndex':
                that._handleItemClick(that.getItem(newValue + ''), true);
                break;
            default:
                super.propertyChangedHandler(propertyName, oldValue, newValue);
                break;
        }
    }

    dataBind() {
        const that = this;

        that.$.itemsContainer.innerHTML = '';

        let template = '';
        const processDataSource = (dataSource, isTabLayoutGroup) => {
            for (let i = 0; i < dataSource.length; i++) {
                const item = dataSource[i];

                const size = item.size;
                const min = item.min;
                const modifiers = item.modifiers;
                const type = item.type;
                const position = item.position;
                const orientation = item.orientation ? item.orientation : 'vertical';

                let props = '';

                if (size !== undefined) {
                    props += `size="${size}" `
                }

                if (min !== undefined) {
                    props += `min="${min}" `
                }

                if (modifiers !== undefined) {
                    props += `modifiers="${modifiers}" `
                }

                if (position !== undefined) {
                    props += `position="${position}" `
                }

                if (item.items) {
                    props += `orientation=${orientation} `

                    if (type === 'tabs') {
                        template += `<smart-tab-layout-group ${props}>`;
                        processDataSource(item.items, true);
                        template += '</smart-tab-layout-group>'
                    }
                    else {
                        template += `<smart-layout-group ${props}>`;
                        processDataSource(item.items);
                        template += '</smart-layout-group>'
                    }
                }
                else {
                    const content = item.content || '';
                    if (isTabLayoutGroup) {
                        template += `<smart-tab-layout-item ${props}>` + content + '</smart-tab-layout-item>';
                    }
                    else {
                        template += `<smart-layout-item ${props}>` + content + '</smart-layout-item>';
                    }
                }
            }
        }

        processDataSource(that.dataSource);
        that.$.itemsContainer.innerHTML = template;
        that.refresh();
    }
    /**
     * Element's render funciton
     */
    render() {
        const that = this;

        that.setAttribute('role', 'group');

        if (that.selectedIndex) {
            that._handleItemClick(that.getItem(that.selectedIndex + ''), true);
        }

        that.checkLicense();

        const render = (() => {
            if (!that.dataSource) {
                that.dataSource = that._getDataSource(that._getLayout());
            }
            else {
                that.dataBind();
            }

            that.$.itemsContainer.orientation = that.orientation;

            super.render();
            that.refresh();
            that._updateSplitter();
        })

        if (document.readyState === 'complete') {
            render();
        }
        else {
            window.addEventListener('load', (() => {
                render();
            }));
        }
    }


    /**
    * Returns the Splitter item according to the index
    * @param {any} index - string, e.g. '0.1'
    */
    getItem(index) {
        const that = this;

        if (index === undefined || index === null) {
            return;
        }

        index = (index + '').split('.');

        let items = that._getDataSource(that._getLayout()),
            item;

        for (let i = 0; i < index.length; i++) {
            item = items[index[i]];

            if (!item) {
                break;
            }

            items = item.items;
        }

        return item;
    }

    /**
     * Handles context menu opening
     * @param {any} event
     */
    _contextMenuHandler(event) {
        const that = this;
        let target = event.target;

        if (!that.allowContextMenu) {
            return;
        }

        if (target.closest) {
            if (target.closest('.smart-layout-context-menu')) {
                //Prevent default context menu opening
                event.preventDefault();
                return;
            }

            let layoutItem = that.querySelector('[selected][data-id]');
            if (!layoutItem) {
                layoutItem = target.closest('.smart-layout-item') || target.closest('.smart-layout-group');
            }

            if (!layoutItem) {
                return;
            }

            //Prevent default context menu opening
            event.preventDefault();

            that._createContextMenu();

            //Disable "delete" operation for Root items when there's no conent inside them so they don't get detached
            const items = that._contextMenu.children;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                if (item.getAttribute('value') !== 'delete') {

                    if (item.getAttribute('value') === 'select') {
                        if (layoutItem.hasAttribute('index') && layoutItem.getAttribute('index') === '0' || !(layoutItem.parentElement instanceof LayoutGroup)) {
                            item.setAttribute('disabled', '');
                        }
                        else {
                            item.removeAttribute('disabled');
                        }
                    }

                    continue;
                }

                if (layoutItem.hasAttribute('index') && layoutItem.getAttribute('index') === '0') {
                    item.setAttribute('disabled', '');
                }
                else {
                    item.removeAttribute('disabled');
                }
            }

            that._openContextMenu(layoutItem, event.pageX, event.pageY);
        }
    }

    /**
     * Creates the context menu
     */
    _createContextMenu() {
        const that = this;
        let menu = that._contextMenu;

        if (!menu) {
            menu = document.createElement('div');

            menu.classList.add('smart-layout-context-menu', 'smart-visibility-hidden');
            that._contextMenu = menu;
        }

        if (!menu.innerHTML) {
            const contextMenuDataSource = that.contextMenuDataSource;

            for (let i = 0; i < contextMenuDataSource.length; i++) {
                const option = contextMenuDataSource[i];
                let label, value;

                if (typeof option === 'object') {
                    label = option.label;
                    value = option.value;
                }
                else {
                    value = label = option + '';
                }

                menu.innerHTML += `<div class="smart-layout-context-menu-item" value="${value}">${that.localize(label) || label}</div>`;
            }
        }
    }

    /**
     * Opens the context menu
     */
    _openContextMenu(target, x, y) {
        const that = this,
            menu = that._contextMenu;

        if (!menu || !menu.classList.contains('smart-visibility-hidden')) {
            return;
        }

        const openingEvent = that.$.fireEvent('opening');

        if (openingEvent.defaultPrevented) {
            return;
        }

        //Set the target Splitter item that opened the menu
        if (!target.parentElement) {
            return;
        }

        menu._target = target;
        that._opening = true;
        that.$.container.appendChild(menu);
        that._positionContextMenu(x, y);
        menu.classList.remove('smart-visibility-hidden');
        that.$.fireEvent('open');
    }

    /**
     * Closes the context menu
     */
    _closeContextMenu() {
        const that = this,
            menu = that._contextMenu;

        if (!menu || menu.classList.contains('smart-visibility-hidden')) {
            return;
        }

        const closingEvent = that.$.fireEvent('closing');

        if (closingEvent.defaultPrevented) {
            return;
        }

        delete that._opening;

        if (that.hasAnimation) {
            menu.addEventListener('transitionend', that._contextMenuTransitionEndHandler.bind(that), { once: true })
        }

        menu.classList.add('smart-visibility-hidden');
        that.$.fireEvent('close');
    }

    /**
     * Context menu Transitionend event handler
     * @param {any} event
     */
    _contextMenuTransitionEndHandler() {
        const that = this,
            menu = that._contextMenu;

        if (!menu || that._opening || !menu.parentElement) {
            return;
        }

        that.$.container.removeChild(menu);
    }

    /**
     * Positions the Context menu
     * @param {any} event
     */
    _positionContextMenu(x, y) {
        const that = this,
            menu = that._contextMenu;

        if (!menu) {
            return;
        }

        const layoutRect = that.$.container.getBoundingClientRect();

        x -= layoutRect.left + window.pageXOffset;
        y -= layoutRect.top + window.pageYOffset;

        if (x + menu.offsetWidth > layoutRect.width) {
            x -= x + menu.offsetWidth - layoutRect.width;
        }

        if (y + menu.offsetHeight > layoutRect.height) {
            y -= y + menu.offsetHeight - layoutRect.height;
        }

        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    }

    /**
     * Document down handler
     * @param {any} event
     */
    _documentDownHandler(event) {
        const that = this,
            target = event.originalEvent.target;

        if (that.contains(target) && target.closest) {
            that._target = target;
            that._updateSplitter();
        }
    }

    /**
     * Document move handler
     * @param {any} event
     */
    _documentMoveHandler(event) {
        const that = this,
            target = event.originalEvent.target,
            menu = that._contextMenu;

        if (menu && !Smart.Utilities.Core.isMobile) {
            if (menu.querySelector('.smart-layout-context-menu-item[hover]')) {
                const items = menu.children;

                for (let i = 0; i < items.length; i++) {
                    items[i].removeAttribute('hover');
                }
            }

            if (menu.contains(target) && target.closest && target.closest('.smart-layout-context-menu-item')) {
                target.setAttribute('hover', '');
            }
        }

        if (that._dragDetails) {
            const offsetX = Math.abs(that._dragDetails.pageX - event.pageX);
            const offsetY = Math.abs(that._dragDetails.pageY - event.pageY);

            if (offsetY <= 5 && offsetX <= 5) {
                return;
            }

            if (!that._dragDetails.feedback.parentElement) {
                document.body.appendChild(that._dragDetails.feedback);
                document.body.appendChild(that._dragDetails.overlay)
                setTimeout(() => {
                    that._dragDetails.feedback.classList.add('dragging');
                }, 100);
            }

            that._dragDetails.dragging = true;

            that._dragDetails.feedback.style.left = event.pageX - that._dragDetails.feedback.offsetWidth / 2 - 5 + 'px';
            that._dragDetails.feedback.style.top = event.pageY - that._dragDetails.feedback.offsetHeight / 2 - 5 + 'px';

            const elements = document.elementsFromPoint(event.pageX, event.pageY);
            let group = null;
            let isTabStrip = false;

            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];

                if (that._dragDetails.feedback.contains(element)) {
                    continue;
                }

                if (element.classList.contains('smart-layout-tab-strip')) {
                    if (that._dragDetails.element.contains(element)) {
                        continue;
                    }

                    group = element.parentElement;
                    isTabStrip = true;
                    break;
                }

                if ((element.parentElement === that._dragDetails.parent || element === that._dragDetails.parent) && that._dragDetails.layoutGroup.items.length === 1) {
                    continue;
                }

                if (that._dragDetails.element.contains(element)) {
                    continue;
                }

                if (element instanceof TabLayoutItem) {
                    group = element.parentElement;
                    break;
                }
                else if (element instanceof TabLayoutGroup) {
                    group = element;
                    break;
                }
            }

            const getPosition = (group, size) => {
                const offset = that.offset(group);
                let position = null;
                let edgeSize = 50;

                let height = size;
                let width = size;

                if (!size) {
                    width = group.offsetWidth / 3;
                    height = group.offsetHeight / 3;
                }
                else {
                    edgeSize = 0;
                }

                const positionRects = [
                    {
                        left: offset.left,
                        top: offset.top,
                        right: offset.left + edgeSize,
                        bottom: offset.top + edgeSize,
                        position: 'top'
                    },
                    {
                        left: offset.left + edgeSize,
                        top: offset.top,
                        right: offset.left + group.offsetWidth - edgeSize,
                        bottom: offset.top + height - edgeSize,
                        position: 'top'
                    },
                    {
                        left: offset.left + group.offsetWidth - edgeSize,
                        top: offset.top,
                        right: offset.left + group.offsetWidth,
                        bottom: offset.top + edgeSize,
                        position: 'top'
                    },
                    {
                        left: offset.left,
                        top: offset.top + edgeSize,
                        right: offset.left + width,
                        bottom: offset.top + group.offsetHeight - edgeSize,
                        position: 'left'
                    },
                    {
                        left: offset.left + group.offsetWidth - width,
                        top: offset.top + edgeSize,
                        right: offset.left + group.offsetWidth,
                        bottom: offset.top + group.offsetHeight - edgeSize,
                        position: 'right'
                    },
                    {
                        left: offset.left,
                        top: offset.top + group.offsetHeight - edgeSize,
                        right: offset.left + edgeSize,
                        bottom: offset.top + group.offsetHeight,
                        position: 'bottom'
                    },
                    {
                        left: offset.left + edgeSize,
                        top: offset.top + group.offsetHeight - height + edgeSize,
                        right: offset.left + group.offsetWidth - edgeSize,
                        bottom: offset.top + group.offsetHeight,
                        position: 'bottom'
                    },
                    {
                        left: offset.left + group.offsetWidth - edgeSize,
                        top: offset.top + group.offsetHeight - edgeSize,
                        right: offset.left + group.offsetWidth,
                        bottom: offset.top + group.offsetHeight,
                        position: 'bottom'
                    },
                ]

                for (let i = 0; i < positionRects.length; i++) {
                    const rect = positionRects[i];

                    if (rect.left <= event.pageX && event.pageX <= rect.right) {
                        if (rect.top <= event.pageY && event.pageY <= rect.bottom) {
                            position = rect.position;
                            break;
                        }
                    }
                }

                return position;
            }

            const rootGroup = that.querySelector('smart-layout-group');

            let position = getPosition(rootGroup, 10);
            let currentGroup = null;

            if (!position) {
                if (!group) {
                    that._handleDropArea(null);
                }
                else {
                    if (isTabStrip) {
                        if (group !== that._dragDetails.parent) {
                            position = 'center';
                            currentGroup = group;
                        }
                    }
                    else {
                        position = getPosition(group) || 'center';
                        currentGroup = group
                    }
                }
            }
            else {
                currentGroup = rootGroup;
            }

            if (currentGroup) {
                that._dragDetails.current = currentGroup;
                that._dragDetails.position = position;
                that._handleDropArea(currentGroup, position);
            }
        }

        if (that._resizeDetails) {
            const offsetX = Math.abs(that._resizeDetails.clientX - event.clientX);
            const offsetY = Math.abs(that._resizeDetails.clientY - event.clientY);

            const splitter = that._resizeDetails.splitter;
            const item = that._resizeDetails.item;
            const itemRect = that._resizeDetails.itemRect;
            const previousItemRect = that._resizeDetails.previousItemRect;
            const previousItem = that._resizeDetails.previousItem;
            const nextItemRect = that._resizeDetails.nextItemRect;
            const nextItem = that._resizeDetails.nextItem;
            const minSize = parseInt(item.getAttribute('min'));

            const resetSplitter = (splitter) => {
                if (splitter.classList.contains('smart-visibility-hidden')) {
                    return;
                }

                splitter.style.right = '';
                splitter.style.top = '';
                splitter.style.left = '';
                splitter.style.bottom = '';
            }

            resetSplitter(splitter);
            resetSplitter(that.$.splitter);

            splitter.classList.remove('error');
            splitter.classList.add('active');

            if (!that._resizeDetails.dragging) {
                if (splitter.classList.contains('horizontal') && offsetY <= 5) {
                    return;
                }
                else if (splitter.classList.contains('vertical') && offsetX <= 5) {
                    return;
                }

                that._resizeDetails.dragging = true;
            }

            let normalized = {
                'clientPos': 'clientX',
                'pos': 'x',
                'size': 'width',
                'near': 'left',
                'far': 'right',
                'offsetSize': 'offsetWidth'
            }

            if (splitter.classList.contains('horizontal')) {
                normalized = {
                    'clientPos': 'clientY',
                    'pos': 'y',
                    'size': 'height',
                    'near': 'top',
                    'far': 'bottom',
                    'offsetSize': 'offsetHeight'
                }
            }

            const updateSplitter = (splitter) => {
                const offset = that.offset(splitter);
                const elementOffset = that.offset(that);

                that.$.splitter.style.width = splitter.offsetWidth + 'px';
                that.$.splitter.style.height = splitter.offsetHeight + 'px';

                that.$.splitter.className = splitter.className;

                that.$.splitter.style.left = offset.left - elementOffset.left + 'px';
                that.$.splitter.style.top = offset.top - elementOffset.top + 'px';

                splitter.setAttribute('drag', '');
                that.$.splitter.setAttribute('drag', '');
            }

            if (splitter.classList.contains('last')) {
                let newPosition = event[normalized.clientPos] - that._resizeDetails.splitterRect[normalized.pos];
                let maxPosition = itemRect[normalized.size] - minSize;

                if (newPosition > maxPosition) {
                    newPosition = maxPosition;
                    splitter.classList.add('error');
                }

                if (previousItemRect) {
                    const minSize = parseInt(previousItem.getAttribute('min'));

                    let minPosition = previousItemRect[normalized.size] - minSize;
                    if (newPosition < -minPosition) {
                        newPosition = -minPosition;
                        splitter.classList.add('error');
                    }
                }

                splitter.style[normalized.near] = newPosition + 'px';

                const newSize = item[normalized.offsetSize] - newPosition;

                item.setAttribute('size', newSize);

                if (previousItem) {
                    const previousItemSize = item[normalized.offsetSize] + previousItem[normalized.offsetSize] - newSize;

                    previousItem.setAttribute('size', previousItemSize);
                }
            }
            else {
                let newPosition = -event[normalized.clientPos] + that._resizeDetails.splitterRect[normalized.pos];
                let minPosition = itemRect[normalized.size] - minSize;

                if (newPosition > minPosition) {
                    newPosition = minPosition;
                    splitter.classList.add('error');
                }

                if (nextItemRect) {
                    const minSize = parseInt(nextItem.getAttribute('min'));

                    let maxPosition = -nextItemRect[normalized.size] + minSize;
                    if (newPosition < maxPosition) {
                        newPosition = maxPosition;
                        splitter.classList.add('error');
                    }
                }


                splitter.style[normalized.far] = newPosition + 'px';

                const newSize = item[normalized.offsetSize] - newPosition;

                item.setAttribute('size', newSize);

                if (nextItem) {
                    const nextItemSize = nextItem[normalized.offsetSize] + item[normalized.offsetSize] - newSize;

                    nextItem.setAttribute('size', nextItemSize);
                }
            }

            updateSplitter(splitter);
        }
    }

    _offsetTop(element) {
        const that = this;

        if (!element) {
            return 0;
        }

        return element.offsetTop + that._offsetTop(element.offsetParent);
    }

    _offsetLeft(element) {
        const that = this;

        if (!element) {
            return 0;
        }

        return element.offsetLeft + that._offsetLeft(element.offsetParent);
    }

    offset(element) {
        return { left: this._offsetLeft(element), top: this._offsetTop(element) }
    }

    _keyUpHandler(event) {
        const that = this;
        if (event.key === 'Escape') {
            if (that._dragDetails) {
                that._dragDetails.feedback.remove();
                that._dragDetails.overlay.remove();
                that._dragDetails = null;
                that._handleDropArea(null);
            }

            if (that._resizeDetails) {
                const drag = that._resizeDetails;

                drag.splitter.classList.contains('last') ? drag.previousItem.size = drag.previousItemSize : drag.nextItem.size = drag.nextItem.previousItemSize;
                drag.item.size = drag.itemSize;

                that.refresh();
                that._handleItemClick(drag.item);
                that._resizeDetails = null;
                return;
            }
        }
        else if (event.key === 'Delete' && (event.ctrlKey || event.metaKey)) {
            if (that._selectedItem) {
                that._removeLayoutItem(that._selectedItem);
            }
        }
    }

    _endDrag() {
        const that = this;

        that._handleDropArea(null);

        if (!that._dragDetails.dragging) {
            that._dragDetails = null;
            return;
        }

        const group = that._dragDetails.current;
        const item = that._dragDetails.element;
        const position = that._dragDetails.position;

        that._handleDropArea(null);

        if (group) {
            that._addTabLayoutItem(group, position, item);
            that._removeLayoutItem(item);

            if (group.parentElement && Array.from(group.parentElement.parentElement.children).filter((value) => {
                if (value.classList.contains('smart-layout-group')) {
                    return true;
                }

                return false;
            }).length === 1) {
                const parent = group.parentElement;
                const parentGroup = parent.parentElement;
                const ownerGroup = parentGroup.parentElement;

                if (!(parentGroup.getAttribute('data-id') === 'root' || ownerGroup.getAttribute('data-id') === 'root') && ownerGroup !== that) {
                    const index = Array.from(ownerGroup.children).indexOf(parent.parentElement);

                    if (index >= 0) {
                        ownerGroup.insertBefore(parent, ownerGroup.children[index])
                    }
                    else {
                        ownerGroup.appendChild(parent);
                    }

                    parentGroup.remove();
                }
            }

            that.refresh();
            that._updateSplitter();

            requestAnimationFrame(() => {
                that.classList.add('outline');
                that.querySelectorAll('.smart-element').forEach((control) => {
                    control.$.fireEvent('resize');
                });
            })
        }

        that.$.fireEvent('stateChange', { type: 'insert', item: item });
        that._dragDetails.feedback.remove();
        that._dragDetails.overlay.remove();
        that._dragDetails = null;
    }
    /**
     * Document up handler
     * @param {any} event
     */
    _documentUpHandler(event) {
        const that = this,
            isMobile = Smart.Utilities.Core.isMobile,
            target = isMobile ? document.elementFromPoint(event.pageX - window.pageXOffset, event.pageY - window.pageYOffset) : event.originalEvent.target;


        if (event.button === 2) {
            return;
        }

        if (that._dragDetails) {
            that._endDrag(event);
        }

        if (that._resizeDetails) {
            const drag = that._resizeDetails;

            if (drag.item) {
                drag.item.style.overflow = '';
            }

            if (drag.previousItem) {
                drag.previousItem.style.overflow = '';
            }

            if (drag.nextItem) {
                drag.nextItem.style.overflow = '';
            }

            that.refresh();
            that._handleItemClick(drag.item);
            that._resizeDetails = null;

            that.querySelectorAll('.smart-element').forEach((control) => {
                control.$.fireEvent('resize');
            });
            return;
        }

        if (!that.contains(target)) {
            return;
        }

        that.classList.add('outline');

        if (that._target && !target.item) {
            if (target instanceof TabLayoutItem) {
                that._handleItemClick(target);
            }
            else {
                that._handleItemClick(target.closest('.smart-layout-item'));
            }
        }

        if (that._target) {
            if (that._target !== target) {
                delete that._target;
                return;
            }

            if (!event.button && target.closest('.smart-layout-buttons-container')) {
                const button = event.originalEvent.target;

                that._handleButtonClick(button.item, button.position);
            }
            else if (target.closest('.smart-layout-context-menu') && (!isMobile && !event.button || isMobile)) {
                that._handleMenuItemClick(target.closest('.smart-layout-context-menu-item'));
            }

            delete that._target;
        }
    }

    /**
    * Document Select Start event handler
    */
    _documentSelectStartHandler(event) {
        const that = this;

        if (that._target) {
            event.preventDefault();
        }
    }

    /**
     * Adds labels to the items that do not have set
     * @param {any} data
     */
    _getDataSource(layout, path, index) {
        const that = this;

        let data = [];

        if (!index) {
            index = 0;
        }

        if (!path) {
            path = '';
        }

        for (let i = 0; i < layout.length; i++) {
            const layoutItem = layout[i];

            const item = {
                label: layoutItem.label,
                id: layoutItem.getAttribute('data-id'),
                orientation: layoutItem.orientation,
                size: layoutItem.size,
                min: layoutItem.min,
                type: layoutItem.type,
                modifiers: layoutItem.modifiers,
                position: layoutItem.position
            }

            layoutItem.removeAttribute('index');

            if (layoutItem instanceof LayoutGroup) {
                data.push(item);

                item.index = path !== '' ? path + '.' + index : index.toString();
                layoutItem.setAttribute('index', item.index);

                if (layoutItem.items) {
                    const items = that._getDataSource(layoutItem.items, item.index, 0);
                    item.items = items;
                }
            }
            else if (layoutItem instanceof LayoutItem) {
                if (layoutItem.items) {
                    const items = that._getDataSource(layoutItem.items, path, index);

                    data = data.concat(items);
                }
                else {
                    item.index = path !== '' ? path + '.' + index : index.toString();
                    layoutItem.setAttribute('index', item.index);

                    data.push(item);
                }
            }

            index++;
        }

        return data;
    }

    /**
     * Generates the JSON array of the current structure of the element
     */
    _getLayout() {
        const that = this;
        const group = !arguments.length ? that.$.itemsContainer : arguments[0];

        if (that._buttons) {
            that._buttons.remove();
        }

        if (that._dropArea) {
            that._dropArea.remove();
        }

        const splitters = that.querySelectorAll('.smart-layout-splitter');

        for (let i = 0; i < splitters.length; i++) {
            const splitter = splitters[i];

            if (splitter !== that.$.splitter) {
                splitter.remove();
            }
        }

        group.items = Array.from(group.children);
        group.items = group.items.filter((value) => {
            return value !== group.tabs && value.hasAttribute('data-id');
        });

        const items = group.items.map(function (value) {
            if (value.classList.contains('smart-layout-tab-strip')) {
                return null;
            }

            const item = value;
            const itemGroup = value instanceof LayoutGroup ? value : null;

            if (itemGroup) {
                item.items = that._getLayout(itemGroup)
            }

            return item;
        });

        if (group !== that.$.itemsContainer) {
            return items.filter((value) => {
                return value !== null && value !== group.tabs
            });
        }

        const data = [];
        const item = group;

        item.items = items.filter((value) => {
            return value !== null && value !== group.tabs
        });

        data.push(item);

        return data;
    }


    _updateSplitter() {
        const that = this;

        if (that._buttons && that._dragDetails) {
            that._buttons.remove();
        }

        that._removeSplitter();
        const items = that.querySelectorAll('[data-id]');

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            if (item.getAttribute('data-id') === 'root') {
                continue;
            }

            if (item.hasAttribute('role')) {
                const role = item.getAttribute('role');

                if (role === 'gridcell' || role === 'row' || role === 'columnheader' || role === 'rowheader') {
                    continue;
                }
            }

            item.setAttribute('hover', '');
            that._handleSplitter(item);
        }
    }

    _hideSplitter() {
        const that = this;

        const items = that.querySelectorAll('[data-id]');

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            item.removeAttribute('hover');
        }
    }

    _removeSplitter() {
        const that = this;
        const splitters = that.querySelectorAll('.smart-layout-splitter');

        for (let i = 0; i < splitters.length; i++) {
            const splitter = splitters[i];

            if (splitter !== that.$.splitter) {
                splitter.remove();
            }
        }

        that._hideSplitter();
    }

    /**
     * Handles item selection
     * @param {any} target - target element that was clicked
     * @param {any} isOnDemand - selection on demand
     */
    _handleItemClick(target) {
        const that = this,
            previouslySelectedIndex = that.selectedIndex;

        let item = null;

        if (!target) {
            that._closeContextMenu();
            that.selectedIndex = null;
            that.querySelectorAll('[data-id]').forEach(i => i.removeAttribute('selected'));
            that._selectedItem = null;
            return;
        }
        else {
            item = target instanceof HTMLElement ? target : that.querySelector('[data-id=' + target.id + ']');

            if (item && item.readonly) {
                that._closeContextMenu();
                that.selectedIndex = null;
                return;
            }

            that.querySelectorAll('[data-id]').forEach(i => i.removeAttribute('selected'));
            that._closeContextMenu();

            if (!item) {
                that.refresh();
                return;
            }

            that.selectedIndex = item.getAttribute('index');

            item.setAttribute('selected', '');
            item.setAttribute('hover', '');
            that._selectedItem = item;
            if (item.classList.contains('smart-hidden')) {
                that.refresh();
            }

            that._handleButtonsVisibility(item);

            if (previouslySelectedIndex !== that.selectedIndex) {
                that.$.fireEvent('change', {
                    'selectedIndex': that.selectedIndex,
                    'oldSelectedIndex': previouslySelectedIndex
                });
            }
        }

        that._updateSplitter();
    }

    /**
     * Handles Layout Button click
     * @param {any} target
     */
    _handleButtonClick(target, position) {
        const that = this,
            newItem = that._addLayoutItem(target, position);

        //Select the new empty item
        that.$.fireEvent('stateChange', { type: 'insert', item: newItem });
        that._handleItemClick(newItem, true);
    }

    /**
     * Handles Context Menu item click
     * @param {any} item
     */
    _handleMenuItemClick(item) {
        const that = this;

        if (!item || item.hasAttribute('disabled')) {
            return;
        }

        const action = item.getAttribute('value'),
            menu = that._contextMenu;

        that.$.fireEvent('menuItemClick', { 'target': (menu ? menu._target : null), 'item': item, 'label': item.textContent, 'value': action });

        const target = menu._target;

        if (!target) {
            return;
        }

        if (action === 'select') {
            that._handleItemClick(target.parentElement ? target.parentElement : target);
        }

        if (action === 'delete') {
            that._removeLayoutItem(target);
        }
    }


    _removeLayoutItem(item) {
        const that = this;

        if (item.getAttribute('data-id') === 'root') {
            return;
        }

        if (item instanceof LayoutItem && item.parentElement.items.length === 1) {
            let parent = item.parentElement;
            let currentParent = parent;

            while (parent && parent.items && parent.items.length === 1) {
                if (parent.getAttribute('data-id') === 'root') {
                    break;
                }

                currentParent = parent;
                parent = parent.parentElement;
            }

            if (currentParent.getAttribute('data-id') !== 'root') {
                currentParent.remove();
            }
            else if (that.allowLiveSplit) {
                currentParent.appendChild(document.createElement('smart-layout-item'));
            }
        }
        else {
            item.remove();
        }

        that.refresh();
        that.$.fireEvent('stateChange', { type: 'delete', item: item });
    }

    /**
    * Refreshes the UI Component.
    */
    refresh() {
        const that = this;

        if (that._isUpdating) {
            return;
        }

        that.dataSource = that._getDataSource(that._getLayout());

        that.$.splitter.className = 'smart-visibility-hidden smart-layout-splitter';

        const refreshLayoutGroup = (group) => {
            const item = that.getItem(group.getAttribute('index'));

            if (!item) {
                return;
            }
            group.style.gridTemplateColumns = '';
            group.style.gridTemplateRows = '';

            let template = '';
            let percentages = 0;
            let withSizeCount = 0;

            if (group instanceof TabLayoutGroup) {
                if (group.tabs) {
                    group.tabs.remove();
                }

                const header = document.createElement('div');
                header.classList.add('smart-layout-tab-strip');

                if (that._selectedItem && group.contains(that._selectedItem) && that._selectedItem instanceof TabLayoutItem) {
                    group.selectedIndex = Math.max(0, group.items.indexOf(that._selectedItem));
                }

                if (group.selectedIndex >= group.children.length) {
                    group.selectedIndex = 0;
                }

                for (let i = 0; i < group.children.length; i++) {
                    const child = group.children[i];
                    const childItem = that.getItem(child.getAttribute('index'));

                    if (!childItem) {
                        continue;
                    }

                    const tab = document.createElement('div');
                    tab.classList.add('smart-layout-tab');
                    tab.innerHTML = '<label>' + childItem.label + '</label><span class="smart-close-button"></span>';
                    header.appendChild(tab);
                    child.setAttribute('tab', '');
                    child.classList.add('smart-hidden');
                    tab.content = child;
                    tab.item = childItem;
                    tab.group = item;

                    if (child.modifiers) {
                        if (child.modifiers.indexOf('close') === -1) {
                            tab.querySelector('.smart-close-button').classList.add('smart-hidden');
                        }
                    }
                    else {
                        tab.querySelector('.smart-close-button').classList.add('smart-hidden');
                    }

                    if (undefined === group.selectedIndex || i === group.selectedIndex) {
                        tab.classList.add('selected');
                        child.classList.remove('smart-hidden');
                        group.selectedIndex = i;
                    }


                    tab.onpointerup = function (event) {
                        if (event.target.classList.contains('smart-close-button') && tab.close) {
                            group.selectedIndex = 0;
                            that._removeLayoutItem(that._selectedItem);
                            that._handleItemClick(parent);
                        }
                    }
                    tab.onpointerdown = function (event) {
                        const parent = this.closest('.smart-layout-group');
                        that._handleItemClick(this.content);
                        tab.close = false;
                        if (!event.target.classList.contains('smart-close-button')) {
                            if (childItem.modifiers && childItem.modifiers.indexOf('drag') >= 0) {
                                that._beginDrag(parent, this, event);
                            }
                        }
                        else {
                            tab.close = true;
                        }
                    }

                }


                group.tabs = header;

                if (item.position === 'top' || item.position === 'left') {
                    group.insertBefore(header, group.firstChild);
                }
                else {
                    group.appendChild(header);
                }
            }
            else {
                for (var i = 0; i < group.children.length; i++) {
                    var child = group.children[i];

                    if (child.hasAttribute('size')) {
                        var size = child.getAttribute('size');

                        var pixels = parseFloat(size);
                        var groupSize = group.orientation === 'vertical' ? group.offsetWidth : group.offsetHeight;
                        var percentage = size.indexOf('%') >= 0 ? parseFloat(size) : parseFloat((pixels / groupSize) * 100);

                        percentages += percentage;
                        withSizeCount++;

                        if (withSizeCount === group.children.length) {
                            if (percentages < 100) {
                                template += '1fr ';
                                percentages = 100;
                                continue;
                            }
                            else if (percentages > 100) {
                                percentages -= percentage;
                                percentage = 100 - percentages;
                                percentages = 100;
                            }
                        }
                        else if (percentages > 100 || percentage === 0) {
                            withSizeCount = group.children.length;
                            percentages = 0;
                            break;
                        }

                        template += percentage + '% ';
                        continue;
                    }

                    template += '1fr ';
                }

                if (withSizeCount === group.children.length) {
                    if (percentages < 99 || percentages > 100) {
                        template = '';

                        for (let i = 0; i < group.children.length; i++) {
                            const child = group.children[i];

                            child.removeAttribute('size');
                            template += '1fr ';
                        }
                    }
                }

                if (group.orientation === 'vertical') {
                    group.style.gridTemplateColumns = template;
                }
                else {
                    group.style.gridTemplateRows = template;
                }
            }

            group.items = Array.from(group.children);
            group.items = group.items.filter((value) => {
                return value !== group.tabs;
            });
        }

        const layoutGroups = that.querySelectorAll('.smart-layout-group');

        for (let i = 0; i < layoutGroups.length; i++) {
            refreshLayoutGroup(layoutGroups[i]);
        }
    }

    _beginDrag(parent, element, event) {
        const that = this;

        if (that._dragDetails) {
            that._dragDetails.feedback.remove();
        }

        const feedback = document.createElement('div');
        const overlay = document.createElement('div');
        const tabs = parent.querySelector('.smart-layout-tab-strip');
        let label = '';

        if (tabs) {
            for (let i = 0; i < Array.from(tabs.children).length; i++) {
                if (i === parent.selectedIndex) {
                    label = tabs.children[i].innerText;
                }
            }
        }

        feedback.innerHTML = `<smart-layout><smart-tab-layout-group><smart-tab-layout-item label="${label}"></smart-tab-layout-item></smart-tab-layout-group></smart-layout>`
        that._feedback = feedback;
        that._feedback.classList.add('smart-layout-feedback', 'smart-layout');

        overlay.classList.add('smart-layout-overlay');

        that._dragDetails = {
            element: element.content,
            item: element.item,
            layoutGroup: element.group,
            parent: parent,
            overlay: overlay,
            feedback: feedback,
            pageX: event.pageX,
            pageY: event.pageY
        }
    }

    moveChildren(oldItem, newItem) {
        newItem.innerHTML = '';
        let content = oldItem;

        while (content.firstChild) {
            const child = content.firstChild;
            newItem.appendChild(child);
        }
    }

    createLayoutItem(type, position) {
        const that = this;

        const getLayoutItem = () => {
            const item = document.createElement('smart-layout-item');

            item.innerHTML = '';

            that.$.fireEvent('createItem', {
                item: item,
                type: 'layoutItem'
            });

            return item;
        }

        const getTabLayoutItem = () => {
            const item = document.createElement('smart-tab-layout-item');

            item.innerHTML = '';

            that.$.fireEvent('createItem', {
                item: item,
                type: 'tabLayoutItem'
            });

            return item;
        }

        const getLayoutGroup = (position) => {
            const item = document.createElement('smart-layout-group');
            const orientation = position === 'top' || position === 'bottom' ? 'horizontal' : 'vertical';

            that.$.fireEvent('createGroup', {
                item: item,
                type: 'layoutGroup'
            });

            item.setAttribute('orientation', orientation);
            item.orientation = orientation;

            return item;
        }

        const getTabLayoutGroup = (position) => {
            const item = document.createElement('smart-tab-layout-group');
            const orientation = position === 'top' || position === 'bottom' ? 'horizontal' : 'vertical';

            item.setAttribute('orientation', orientation);
            item.orientation = orientation;

            that.$.fireEvent('createGroup', {
                item: item,
                type: 'tabLayoutGroup'
            });

            return item;
        }

        if (type === 'layoutItem' || !type) {
            return getLayoutItem();
        }
        else if (type === 'tabLayoutItem' || !type) {
            return getTabLayoutItem();
        }
        else if (type === 'tabLayoutGroup') {
            return getTabLayoutGroup(position);
        }
        else {
            return getLayoutGroup(position);
        }
    }

    _addTabLayoutItem(targetItem, position, myItem) {
        const that = this;
        const newItem = that.createLayoutItem('tabLayoutItem');

        const parentLayoutGroup = targetItem.closest('smart-tab-layout-group');
        let layoutGroup;

        if (myItem) {
            newItem.label = myItem.label;
            newItem.modifiers = myItem.modifiers;
            that.moveChildren(myItem, newItem);
        }

        const resetGroup = (group) => {
            for (let i = 0; i < group.children.length; i++) {
                const child = group.children[i];

                child.removeAttribute('size');
            }

            group.removeAttribute('size');
        }

        const addTabItemChild = (position) => {
            targetItem.removeAttribute('size');

            if (targetItem.querySelector('smart-layout-group')) {
                that._addLayoutItem(targetItem.querySelector('smart-layout-group'), position);
            }
            else {
                layoutGroup = that.createLayoutItem('layoutGroup', position);

                const newLayoutItem = that.createLayoutItem();
                that.moveChildren(targetItem, newLayoutItem)

                if (position === 'top' || position === 'left') {
                    layoutGroup.appendChild(that.createLayoutItem());
                    layoutGroup.appendChild(newLayoutItem);
                }
                else {
                    layoutGroup.appendChild(newLayoutItem);
                    layoutGroup.appendChild(that.createLayoutItem());
                }

                targetItem.appendChild(layoutGroup);
            }
        }

        const addRootTab = (tabLayoutGroup, position) => {

            const parentLayoutGroup = targetItem.parentElement;
            const layoutGroup = targetItem;
            const newLayoutGroup = that.createLayoutItem('layoutGroup', position);

            parentLayoutGroup.insertBefore(newLayoutGroup, layoutGroup);

            if (position === 'top' || position === 'left') {
                newLayoutGroup.append(tabLayoutGroup);
                newLayoutGroup.appendChild(layoutGroup);
            }
            else {
                newLayoutGroup.appendChild(layoutGroup);
                newLayoutGroup.append(tabLayoutGroup);
            }

            if (layoutGroup.getAttribute('data-id') === 'root') {
                layoutGroup.setAttribute('data-id', newLayoutGroup.getAttribute('data-id'));
                newLayoutGroup.setAttribute('data-id', 'root');
                that.$.itemsContainer = newLayoutGroup;
            }

            resetGroup(layoutGroup);
            resetGroup(parentLayoutGroup);
        }

        if (myItem) {
            switch (position) {
                case 'center': {
                    if (targetItem instanceof TabLayoutGroup || targetItem instanceof TabLayoutItem) {
                        parentLayoutGroup.appendChild(newItem);
                    }
                    else {
                        const tabLayoutGroup = that.createLayoutItem('tabLayoutGroup', 'top');
                        tabLayoutGroup.appendChild(newItem);

                        if (targetItem instanceof LayoutGroup && !(targetItem instanceof TabLayoutItem)) {
                            targetItem.appendChild(tabLayoutGroup);
                            resetGroup(targetItem);
                        }
                        else if (targetItem instanceof LayoutItem) {
                            layoutGroup = that.createLayoutItem('layoutGroup');

                            targetItem.parentElement.insertBefore(layoutGroup, targetItem);
                            layoutGroup.appendChild(targetItem);
                            layoutGroup.appendChild(tabLayoutGroup);
                            resetGroup(layoutGroup);
                        }
                    }
                }
                    break;
                case 'left':
                case 'right': {
                    const tabLayoutGroup = that.createLayoutItem('tabLayoutGroup', 'top');
                    tabLayoutGroup.appendChild(newItem);
                    if (targetItem.getAttribute('data-id') === 'root') {
                        tabLayoutGroup.position = position;
                        addRootTab(tabLayoutGroup, position);
                    }
                    else {
                        addRootTab(tabLayoutGroup, position);
                    }
                }
                    break;
                case 'top':
                case 'bottom': {
                    const tabLayoutGroup = that.createLayoutItem('tabLayoutGroup', 'top');
                    tabLayoutGroup.appendChild(newItem);

                    if (targetItem.getAttribute('data-id') === 'root') {
                        tabLayoutGroup.position = position;
                        addRootTab(tabLayoutGroup, position);
                    }
                    else {
                        addRootTab(tabLayoutGroup, position);
                    }
                    break;
                }
            }

            return;
        }

        switch (position) {
            case 'center':
                if (targetItem instanceof TabLayoutGroup || targetItem instanceof TabLayoutItem) {
                    parentLayoutGroup.appendChild(newItem);
                }
                else {
                    addTabItemChild();
                }
                break;
            case 'left':
            case 'right':
                if (targetItem instanceof TabLayoutGroup) {
                    const firstItem = targetItem.querySelector('smart-tab-layout-item');

                    if (firstItem && position === 'left') {
                        targetItem.insertBefore(newItem, firstItem);
                    }
                    else {
                        targetItem.appendChild(newItem);
                    }
                }
                else if (targetItem instanceof TabLayoutItem) {
                    const tabLayoutGroup = that.createLayoutItem('tabLayoutGroup', 'top');
                    const parentLayoutGroup = targetItem.parentElement;

                    tabLayoutGroup.appendChild(newItem);

                    layoutGroup = that.createLayoutItem('layoutGroup');

                    parentLayoutGroup.parentElement.insertBefore(layoutGroup, parentLayoutGroup);

                    if (position === 'right') {
                        layoutGroup.appendChild(parentLayoutGroup);
                        layoutGroup.appendChild(tabLayoutGroup);
                    }
                    else if (position === 'left') {
                        layoutGroup.appendChild(tabLayoutGroup);
                        layoutGroup.appendChild(parentLayoutGroup);
                    }
                }
                else if (myItem) {
                    const tabLayoutGroup = that.createLayoutItem('tabLayoutGroup', 'top');
                    tabLayoutGroup.appendChild(newItem);

                    if (targetItem instanceof LayoutGroup) {
                        targetItem.insertBefore(targetItem.firstChild, tabLayoutGroup);
                    }
                    else if (targetItem instanceof LayoutItem) {
                        layoutGroup = that.createLayoutItem('layoutGroup');
                        layoutGroup.orientation = parentLayoutGroup.orientation;
                        layoutGroup.setAttribute('orientation', parentLayoutGroup.orientation);

                        targetItem.removeAttribute('size');
                        targetItem.parentElement.insertBefore(layoutGroup, targetItem);
                        layoutGroup.appendChild(targetItem);
                        layoutGroup.appendChild(tabLayoutGroup);
                    }
                }
                else {
                    addTabItemChild(position);
                }
                break;
            case 'top':
            case 'bottom':
                if (targetItem instanceof TabLayoutGroup) {
                    layoutGroup = that.createLayoutItem('layoutGroup', 'top');
                    targetItem.removeAttribute('size');

                    targetItem.parentElement.insertBefore(layoutGroup, targetItem);

                    if (position === 'top') {
                        layoutGroup.appendChild(that.createLayoutItem());
                        layoutGroup.appendChild(targetItem);
                    }
                    else {
                        layoutGroup.appendChild(targetItem);
                        layoutGroup.appendChild(that.createLayoutItem());
                    }
                }
                else {
                    addTabItemChild(position);
                }
                break;
        }

        that.refresh();
    }

    /**
     * Creates a new item by splitting the target Splitter
     */
    _addLayoutItem(targetItem, position, myItem) {
        const that = this;

        if (!targetItem) {
            return;
        }

        const resetGroup = (group) => {
            for (let i = 0; i < group.children.length; i++) {
                const child = group.children[i];

                child.removeAttribute('size');
            }

            group.removeAttribute('size');
        }

        const isTabItem = targetItem instanceof TabLayoutItem || targetItem instanceof TabLayoutGroup || (myItem && myItem instanceof TabLayoutItem);

        if (isTabItem) {
            return that._addTabLayoutItem(targetItem, position, myItem);
        }

        const newItem = that.createLayoutItem();

        const parentLayoutGroup = targetItem.closest('.smart-layout-group');
        let layoutGroup;

        if (myItem) {
            that.moveChildren(myItem, newItem);
        }

        if (position === 'center') {
            if (targetItem instanceof LayoutGroup) {
                layoutGroup = parentLayoutGroup;
                layoutGroup.appendChild(newItem);

                resetGroup(layoutGroup);
                that.refresh();

                return newItem;
            }
            else if (targetItem instanceof LayoutItem) {
                layoutGroup = that.createLayoutItem('layoutGroup');
                layoutGroup.orientation = parentLayoutGroup.orientation;
                layoutGroup.setAttribute('orientation', parentLayoutGroup.orientation);

                targetItem.removeAttribute('size');
                targetItem.parentElement.insertBefore(layoutGroup, targetItem);
                layoutGroup.appendChild(targetItem);
                layoutGroup.appendChild(newItem);

                that.refresh();

                return layoutGroup;
            }
        }

        if (parentLayoutGroup.orientation === 'vertical' && (position === 'left' || position === 'right') ||
            parentLayoutGroup.orientation === 'horizontal' && (position === 'top' || position === 'bottom')) {
            layoutGroup = parentLayoutGroup;

            if (targetItem instanceof LayoutGroup) {
                if (position === 'left' || position === 'top') {
                    layoutGroup.insertBefore(newItem, layoutGroup.children[0]);
                }
                else {
                    layoutGroup.appendChild(newItem);
                }

                resetGroup(targetItem);
            }
            else {
                const layoutGroupItems = layoutGroup.items,
                    newItemIndex = Math.max(0, layoutGroupItems.indexOf(targetItem) + (position === 'top' || position === 'left' ? 0 : 1));

                layoutGroup.insertBefore(newItem, layoutGroupItems[newItemIndex]);
                resetGroup(layoutGroup);
            }
        }
        else {
            if (targetItem instanceof LayoutGroup) {
                const parentLayoutGroup = targetItem.parentElement;
                const layoutGroup = targetItem;
                const newLayoutGroup = that.createLayoutItem('layoutGroup', position);

                parentLayoutGroup.insertBefore(newLayoutGroup, layoutGroup);

                if (position === 'top' || position === 'left') {
                    newLayoutGroup.append(newItem);
                    newLayoutGroup.appendChild(layoutGroup);
                }
                else {
                    newLayoutGroup.appendChild(layoutGroup);
                    newLayoutGroup.append(newItem);
                }

                if (layoutGroup.getAttribute('data-id') === 'root') {
                    layoutGroup.setAttribute('data-id', newLayoutGroup.getAttribute('data-id'));
                    newLayoutGroup.setAttribute('data-id', 'root');
                    that.$.itemsContainer = newLayoutGroup;
                }

                resetGroup(parentLayoutGroup);
            }
            else {
                layoutGroup = that.createLayoutItem('layoutGroup', position);

                parentLayoutGroup.insertBefore(layoutGroup, targetItem);

                if (position === 'top' || position === 'left') {
                    layoutGroup.appendChild(newItem);
                    layoutGroup.appendChild(targetItem);
                }
                else {
                    layoutGroup.appendChild(targetItem);
                    layoutGroup.appendChild(newItem);
                }

                resetGroup(layoutGroup);
            }
        }

        that.refresh();

        return newItem;
    }

    /**
     * Shows/Hides the Add buttons
     * @param {any} item
     */
    _handleButtonsVisibility(item) {
        const that = this;

        if (!that._buttons) {
            that._buttons = document.createElement('div');
            that._buttons.classList.add('smart-layout-buttons-container');
            that._buttons.innerHTML = `<div role="button" position="top"></div>
                                       <div role="button" position="bottom"></div>
                                       <div role="button" position="center"></div>
                                       <div role="button" position="left"></div>
                                       <div role="button" position="right"></div>`;

        }

        if (!item) {
            if (that._buttons.parentElement) {
                that._buttons.parentElement.removeChild(that._buttons);

                return;
            }
        }

        if (item) {
            const buttonPosition = item._buttonPosition || [],
                buttons = that._buttons.children;


            for (let b = 0; b < buttons.length; b++) {
                const button = buttons[b];

                button.position = button.getAttribute('position');
                button.item = item;
                buttonPosition.length && buttonPosition.indexOf(button.getAttribute('position')) < 0 ? button.classList.add('smart-hidden') : button.classList.remove('smart-hidden');

                button.onmouseenter = () => {
                    button.setAttribute('hover', '');
                }
                button.onmouseleave = () => {
                    button.removeAttribute('hover')
                }
            }

            if (that.allowLiveSplit && that._buttons.parentElement !== item) {
                item.appendChild(that._buttons);
            }
        }
    }

    _handleDropArea(item, position = 'center') {
        const that = this;

        const positionDropArea = (position) => {
            const areaSize = 50;

            switch (position) {
                case 'left':
                    that._dropArea.style.top = '0px';
                    that._dropArea.style.left = '0px';
                    that._dropArea.style.width = areaSize + '%';
                    that._dropArea.style.height = '100%';
                    break;
                case 'right':
                    that._dropArea.style.top = '0px';
                    that._dropArea.style.left = `calc(100% - ${areaSize}%)`;
                    that._dropArea.style.width = areaSize + '%';
                    that._dropArea.style.height = '100%';
                    break;
                case 'top':
                    that._dropArea.style.top = '0px';
                    that._dropArea.style.left = '0px';
                    that._dropArea.style.width = '100%';
                    that._dropArea.style.height = areaSize + '%';
                    break;
                case 'bottom':
                    that._dropArea.style.top = `calc(100% - ${areaSize}%)`;
                    that._dropArea.style.left = '0px';
                    that._dropArea.style.width = '100%';
                    that._dropArea.style.height = areaSize + '%';
                    break;
                case 'center':
                    that._dropArea.style.top = '0px';
                    that._dropArea.style.left = '0px';
                    that._dropArea.style.width = '100%';
                    that._dropArea.style.height = '100%';
                    break;
            }
        }

        if (that._dropArea && that._dropArea.parentElement === item) {
            positionDropArea(position);
            return;
        }

        if (that._dropArea) {
            that._dropArea.remove();
        }

        if (!that._dragDetails || !item) {
            return;
        }

        that._dropArea = document.createElement('div');
        that._dropArea.classList.add('smart-layout-drop-area');

        item.appendChild(that._dropArea);

        that._dropArea.style.opacity = 1;
        positionDropArea(position);
    }

    _handleSplitter(item) {
        const that = this;

        if (!item) {
            return;
        }

        if (item.hasAttribute('tab')) {
            item = item.parentElement;
        }

        if (item._splitter) {
            item._splitter.remove();
        }

        if (!item._splitter) {
            item._splitter = document.createElement('div');
        }

        if (that._dragDetails && that._dragDetails.dragging) {
            item._splitter.remove();
            return;
        }

        if (item.modifiers.indexOf('resize') === -1) {
            return;
        }

        item.appendChild(item._splitter);

        const layoutGroup = item.parentElement;

        if (layoutGroup) {
            item._splitter.className = 'smart-layout-splitter';

            item._splitter.item = item;

            item._splitter.removeAttribute('drag');

            const orientation = layoutGroup.orientation;

            if (item.nextElementSibling && item.nextElementSibling.hasAttribute('data-id')) {
                item._splitter.classList.add(orientation);
            }
            else if (item.previousElementSibling && item.previousElementSibling.hasAttribute('data-id')) {
                item._splitter.classList.add(orientation);
                item._splitter.classList.add('last');
            }

            const handleResize = (splitter) => {
                splitter.style.top = '';
                splitter.style.left = '';
                splitter.style.bottom = '';
                splitter.style.right = '';

                splitter.onpointerdown = (event) => {
                    const item = event.target.item;
                    item.style.overflow = 'hidden';

                    that._resizeDetails = {
                        splitter: event.target,
                        splitterRect: event.target.getBoundingClientRect(),
                        itemRect: item.getBoundingClientRect(),
                        item: item,
                        itemSize: item.size,
                        group: item.parentElement,
                        clientX: event.clientX,
                        clientY: event.clientY
                    }

                    if (that._selectedItem !== item) {
                        that.querySelectorAll('[data-id]').forEach(i => i.removeAttribute('selected'));
                        that.selectedIndex = item.getAttribute('index');
                        item.setAttribute('selected', '');
                        that._selectedItem = item;
                        that._handleButtonsVisibility(item);
                    }

                    if (item.previousElementSibling && item.previousElementSibling.hasAttribute('data-id')) {
                        that._resizeDetails.previousItemRect = item.previousElementSibling.getBoundingClientRect();
                        that._resizeDetails.previousItem = item.previousElementSibling;
                        that._resizeDetails.previousItemSize = item.previousElementSibling.size;
                        that._resizeDetails.previousItem.style.overflow = 'hidden';
                    }
                    else {
                        that._resizeDetails.previousItemRect = null;
                        that._resizeDetails.previousItem = null;
                    }

                    if (item.nextElementSibling && item.nextElementSibling.hasAttribute('data-id')) {
                        that._resizeDetails.nextItemRect = item.nextElementSibling.getBoundingClientRect();
                        that._resizeDetails.nextItem = item.nextElementSibling;
                        that._resizeDetails.nextItemSize = item.nextElementSibling.size;
                        that._resizeDetails.nextItem.style.overflow = 'hidden';
                    }
                    else {
                        that._resizeDetails.nextItemRect = null;
                        that._resizeDetails.nextItem = null;
                    }
                }
            }

            handleResize(item._splitter);
        }
    }
})
