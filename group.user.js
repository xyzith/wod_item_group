// ==UserScript==
// @name            WOD Item Group
// @namespace       ttang.tw
// @updateURL       https://raw.githubusercontent.com/xyzith/wod_item_group/master/group.user.js
// @grant           none
// @author          Taylor Tang
// @version         1.8
// @description     Add item group feature
// @include         *://*.world-of-dungeons.org/wod/spiel/hero/items.php*
// ==/UserScript==

(function(){
    var LANGUAGE = Object.freeze({
        COIN: '金币',
        ITEM: '物品',
        GROUP: '团队',
        SELL: '出售',
        POSITION: '位置',
        WAREHOUSE: '仓库',
        GROUP_WAREHOUSE2: '团队仓库',
        GROUP_WAREHOUSE: '宝库',
        STORAGE_ROOM: '贮藏室'
    });

    function addCss() {
        var style = document.createElement('style');
        var row0 = document.querySelector('tr.row0');
        var row1 = document.querySelector('tr.row1');
        if(row0) {
            document.head.appendChild(style);
            var row0_color = getComputedStyle(row0).getPropertyValue('background-color');
            var row1_color = getComputedStyle(row1).getPropertyValue('background-color');
            style.sheet.insertRule('table.content_table .hidden_row { display: none; }', 0);
            style.sheet.insertRule('table.content_table > tbody > :nth-child(2n) { background-color: ' + row0_color + '; }', 0);
            style.sheet.insertRule('table.content_table > tbody > :nth-child(2n+1) { background-color: ' + row1_color + '; }', 0);
        }
    }

    function setSelectValue(select, value) {
        if(select.querySelector('[value="' + value + '"]')) {
            select.value = value;
            return true;
        }
        return false;
    }

    function chomp(str) {
        return str.replace(/[ \xA0\n\t\r]*/g, '');
    }

    function findTable() {
        function findSiblings(el) {
            if(!el) { return false; }
            var next = el.nextElementSibling;
            if(!next) { return null; }
            if(next.tagName.toLowerCase() === 'table' && next.classList.contains('content_table')) {
                return next;
            } else {
                return findSiblings(next);
            }
        }
        var search = document.querySelector('.search_container');
        return findSiblings(search);
    }

    function Item(row) {
        var name = row.cells[1];
        var use = name.textContent.match(/\((\d+)\/\d+\)$/);
        var price_el = this.getPrice(row);

        this.el = row;
        this.name = name.querySelector('a').textContent.replace(/!$/, '');
        this.item_useability = name.querySelector('a').className;
        this.use = use ? Number(use[1]) : 1;
        this.price = price_el ? Number(price_el.textContent) : 0;
        this.sell_checkbox = price_el ? price_el.querySelector('input') : null;
        this.group_item_checkbox = this.getGroupItemCheckbox(row);
        this.item_position_select = this.getItemPositionSelect(row);
    }

    Item.prototype.getPrice = function(el) {
        var price = el.querySelector('img[title="' + LANGUAGE.COIN + '"]');
        if(price) {
            return price.parentNode;
        }
        return null;
    };

    Item.prototype.getGroupItemCheckbox = function(el) {
        return el.querySelector('input[name^="SetGrpItem"]');
    };

    Item.prototype.getItemPositionSelect = function(el) {
        return el.querySelector('select[name^="EquipItem"]');
    };

    function ItemGroup() {
        function useGetter() {
            var use = this.child.map((k) => (k.use));
            return use.reduce((sum, value) => (sum + value));
        }
        function priceGetter() {
            var use = this.child.map((k) => (k.price));
            return use.reduce((sum, value) => (sum + value));
        }

        function indexGetter() {
            return this.child[0].el.cells[0].textContent;
        }

        this.child = [];

        Object.defineProperty(this, 'use', {
            get: useGetter.bind(this),
            writeable: false
        });

        Object.defineProperty(this, 'price', {
            get: priceGetter.bind(this),
            writeable: false
        });

        Object.defineProperty(this, 'index', {
            get: indexGetter.bind(this),
            writeable: false
        });
    }

    ItemGroup.prototype.add = function(item) {
        this.child.push(item);
        this.name = item.name;
        function setupSyncEvent(key) {
            if(!item[key]) { return false; }
            if(item[key].tagName.toLowerCase() === 'select') {
                item[key].addEventListener('change', (function(){
                    this.syncSelect(key);
                }).bind(this));
            } else {
                item[key].addEventListener('change', (function(){
                    this.syncCheckbox(key);
                }).bind(this));
            }
        }
        setupSyncEvent.call(this, 'sell_checkbox');
        setupSyncEvent.call(this, 'group_item_checkbox');
        setupSyncEvent.call(this, 'item_position_select');
    };

    ItemGroup.prototype.renderIndex = function(row) {
        var index = row.insertCell();
        index.style.textAlign = 'right';
        index.textContent = this.index;
    };
    ItemGroup.prototype.syncSelect = function(key) {
        var el = this[key];
        var prev, now, select;
        if(!el) { return false; }
        for(var i = 0; i < this.child.length; i++) {
            select = this.child[i][key];
            now = select.options[select.selectedIndex].value;
            if(typeof prev === 'undefined') {
                prev = now;
            } else if(prev != now){
                el.value = '0';
                return false;
            }
        }
        if(!setSelectValue(el, now.replace(/^-/, ''))) {
            el.value = '0';
        }
    };
    ItemGroup.prototype.syncCheckbox = function(key) {
        var el = this[key];
        var prev, now, check;
        if(!el) { return false; }
        for(var i = 0; i < this.child.length; i++) {
            check = this.child[i][key];
            if(!check) { return false; }
            now = check.checked;
            if(typeof prev === 'undefined') {
                prev = now;
            } else if(prev != now){
                return false;
            }
        }
        el.checked = now;
    };
    ItemGroup.prototype.renderItemPosition = function(row, head_cell) {
        function newOps(txt, value) {
            var opt = document.createElement('option');
            opt.textContent = txt;
            opt.value = value;
            return opt;
        }
        var position = row.insertCell();
        var select = document.createElement('select');

        position.style.textAlign = 'right';
        select.appendChild(newOps('-------', '0'));
        select.appendChild(newOps(LANGUAGE.WAREHOUSE, 'go_lager'));
        select.appendChild(newOps(LANGUAGE.GROUP_WAREHOUSE2, 'go_group_2'));
        select.appendChild(newOps(LANGUAGE.GROUP_WAREHOUSE, 'go_group'));
        select.appendChild(newOps(LANGUAGE.STORAGE_ROOM, 'go_keller'));
        select.addEventListener('change', (function(e){
            var value = e.target.options[e.target.selectedIndex].value;
            this.child.forEach(function(c){
                if(c.item_position_select) {
                    setSelectValue(c.item_position_select, value);
                    setSelectValue(c.item_position_select, '-' + value);
                }
            });
        }).bind(this));
        position.appendChild(select);
        this.item_position_select = select;
        head_cell.querySelector('select').addEventListener('change', (function() {
            this.syncSelect('item_position_select');
        }).bind(this));

    };
    ItemGroup.prototype.renderItemPrice = function(row, head_cell) {
        var price = row.insertCell();
        var text = document.createElement('span');
        var checkbox = document.createElement('input');
        price.style.textAlign = 'right';
        text.textContent = this.price;
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', (function(e){
            var checked = e.target.checked;
            this.child.forEach(function(c) {
                if(c.sell_checkbox) {
                    c.sell_checkbox.checked = checked;
                }
            });
        }).bind(this));
        price.appendChild(text);
        price.appendChild(checkbox);
        this.sell_checkbox = checkbox;
        head_cell.querySelector('input[type="checkbox"]').addEventListener('change', (function() {
            this.syncCheckbox('sell_checkbox');
        }).bind(this));
    };

    ItemGroup.prototype.renderGroupSetter = function(row, head_cell) {
        var cell = row.insertCell();
        var setter = document.createElement('input');
        cell.style.textAlign = 'center';
        setter.type = 'checkbox';
        setter.addEventListener('change', (function(e){
            var checked = e.target.checked;
            this.child.forEach(function(c){
                if(c.group_item_checkbox) {
                    c.group_item_checkbox.checked = checked;
                }
            });
        }).bind(this));
        cell.appendChild(setter);
        this.group_item_checkbox = setter;
        head_cell.querySelector('input[type="checkbox"]').addEventListener('change', (function() {
            this.syncCheckbox('group_item_checkbox');
        }).bind(this));
    };

    ItemGroup.prototype.renderItemName = function(row) {
        var text = row.insertCell();
        var a = document.createElement('a');
        a.innerHTML = '&#128194 ';
        a.textContent += this.name + ' (' + this.use + ')';
        a.className = this.child[0].item_useability;
        text.appendChild(a);
    };

    ItemGroup.prototype.toggleChild = function() {
        if(!this.row) { return false; }
        if(this.child[0].el.classList.contains('hidden_row')) {
            this.expand();
        } else {
            this.shrink();
        }
    };

    ItemGroup.prototype.createContainer = function(table) {
        var row = table.querySelector('tbody').insertRow();
        row.className = 'item_group';
        row.style.cursor = 'pointer';
        row.addEventListener('click', (function(e) {
            var tag = e.target.tagName.toLowerCase();
            if(tag != 'input' && tag != 'select' && tag != 'option') {
                this.toggleChild();
            }
        }).bind(this));
        return row;
    };

    ItemGroup.prototype.parseCell = function(cell, row) {
        var btn, title = (btn = cell.querySelector('input[type="submit"]')) ? btn.value : cell.textContent;
        if(cell == cell.parentNode.cells[0]) {
            this.renderIndex(row);
        } else if(title.match(LANGUAGE.GROUP)) {
            this.renderGroupSetter(row, cell);
        } else if(title.match(LANGUAGE.SELL)) {
            this.renderItemPrice(row, cell);
        } else if(title.match(LANGUAGE.ITEM)) {
            this.renderItemName(row);
        } else if(title.match(LANGUAGE.POSITION)) {
            this.renderItemPosition(row, cell);
        } else {
            row.insertCell();
        }
    };

    ItemGroup.prototype.render = function(table, idx) {
        var head = table.tHead.querySelector('.header');

        if(this.child.length != 1) {
            this.row = this.createContainer(table);
            for(var i = 0; i < head.children.length; i++) {
                this.parseCell(head.children[i], this.row);
            }
            this.syncSelect('item_position_select');
            this.syncCheckbox('group_item_checkbox');
            this.syncCheckbox('sell_checkbox');
            this.child.reverse();
        } else {
            table.tBodies[0].appendChild(this.child[0].el);
        }
    };

    ItemGroup.prototype.shrink = function() {
        var table_body = this.row.parentNode;
        this.child.forEach((c) => {
            c.el.remove();
            table_body.appendChild(c.el);
            c.el.classList.add('hidden_row');
        });
    };

    ItemGroup.prototype.expand = function() {
        var table_body = this.row.parentNode;
        if(this.row) {
            this.child.forEach((c) => {
                c.el.remove();
                table_body.insertBefore(c.el, this.row.nextSibling);
                c.el.classList.remove('hidden_row');
            });
        }
    };

    function init() {
        function parseRow(row) {
            var item = new Item(row);
            if(!item_db[item.name]) {
                item_db[item.name] = new ItemGroup();
            }
            item_db[item.name].add(item);
        }

        var index = 0;
        var item_db = {};
        var table = findTable();
        addCss();
        if(table && table.tBodies[0].rows.length > 1) {
            while(table.tBodies[0].rows[0]) {
                parseRow(table.rows[2]);
                table.rows[2].remove();
            }

            for(var k in item_db) {
                if(item_db.hasOwnProperty(k)){
                    item_db[k].child.forEach((c) => (c.el.cells[0].textContent = ++index));
                    item_db[k].render(table);
                    item_db[k].toggleChild();
                }
            }
        }
    }

    init();
})();
