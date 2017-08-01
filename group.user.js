// ==UserScript==
// @name            WOD Item Group
// @namespace       ttang.tw
// @updateURL       https://raw.githubusercontent.com/xyzith/wod_item_group/master/group.user.js
// @grant           none
// @author          Taylor Tang
// @version         2.0
// @description     Add item group feature
// @include         *://*.world-of-dungeons.org/wod/spiel/hero/items.php*
// ==/UserScript==

(function(){
    var LANGUAGE = Object.freeze({
        COIN: '金币',
        ITEM: '物品',
        GROUP_ITEM: '团队物品',
        SELL: '出售',
        POSITION: '位置',
        WAREHOUSE: '仓库',
        GROUP_WAREHOUSE2: '团队仓库',
        GROUP_WAREHOUSE: '宝库',
        STORAGE_ROOM: '贮藏室',
        OWNER: '所有者',
        STORAGE_DATE: '入库时间',
        DROP_DATE: '掉落',
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
            style.sheet.insertRule('table.content_table > tbody > :nth-child(2n) { background-color: ' + row1_color + '; }', 0);
            style.sheet.insertRule('table.content_table > tbody > :nth-child(2n+1) { background-color: ' + row0_color + '; }', 0);
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
        var regex = new RegExp('[ ' + String.fromCharCode(8593) + String.fromCharCode(8595) + '\xA0\t\n\r]|&\w+;', 'g');
        return str.replace(regex, '');
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

    function Item(row, table_map) {
        var head = row.parentNode.parentNode.tHead.querySelector('.header');
        var name = row.cells[1];
        var use = name.textContent.match(/\((\d+)\/\d+\)$/);

        this.el = row;
        for(var i = 0; i < table_map.length; i++) {
            if( table_map[i] in this.parser) {
                this.parser[table_map[i]].call(this, i);
            }
        }
    }

    Item.prototype.parser = Object.freeze({
        sell: function(idx) {
            var price = this.el.cells[idx];
            if(!price) { return false; }
            this.price = Number(price.textContent || 0);
            this.sell_checkbox = price.querySelector('input');
        },
        item: function(idx) {
            var item = this.el.cells[idx];
            var use = item.textContent.match(/\((\d+)\/\d+\)$/);
            item = item.querySelector('a');

            this.item = item.textContent.replace(/!$/, '');
            this.use = use ? Number(use[1]) : 1;
            this.item_useability = item.className;
        },
        owner: function(idx) {
            var owner = this.el.cells[idx];
            this.owner = owner.textContent;
        },
        group_item: function(idx) {
            var el = this.el.cells[idx];
            this.group_item_checkbox = el.querySelector('input[name="SetGrpItem"]');
        },
        position: function(idx) {
            var el = this.el.cells[idx];
            this.item_position_select = el.querySelector('select');
        },
        storage_date: function(idx) {
            var storage_date = this.el.cells[idx];
            this.storage_date = storage_date.textContent;
        },
        drop_date: function(idx) {
            var drop_date = this.el.cells[idx];
            this.drop_date = drop_date.textContent;
        }
    });

    function ItemGroup(table, prime_key) {
        function useGetter() {
            var use = this.child.map((k) => (k.use));
            return use.reduce((sum, value) => (sum + value));
        }

        function priceGetter() {
            return this.child.map((k) => (k.price)).reduce((sum, value) => (sum + value));
        }

        function rowGetter() {
            if(!row) {
                row = this.createContainer();
            }
            return row;
        }

        var row;

        this.pk = prime_key;
        this.tbody = table.tBodies[0];
        this.thead = table.tHead.rows[1];
        this.child = [];

        Object.defineProperty(this, 'row', {
            get: rowGetter.bind(this),
            writeable: false
        });
        Object.defineProperty(this, 'use', {
            get: useGetter.bind(this),
            writeable: false
        });

        Object.defineProperty(this, 'price', {
            get: priceGetter.bind(this),
            writeable: false
        });
    }

    ItemGroup.prototype.add = function(item) {
        this.child.push(item);
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

    ItemGroup.prototype.renderDefault = function(cell, idx, align) {
        cell.style.textAlign = align || 'center';
        cell.textContent = this.child[0].el.cells[idx].textContent;
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

    ItemGroup.prototype.renderItemPosition = function(position, idx) {
        function newOps(txt, value) {
            var opt = document.createElement('option');
            opt.textContent = txt;
            opt.value = value;
            return opt;
        }
        var select = document.createElement('select');
        var head_cell = this.thead.cells[idx];

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

    ItemGroup.prototype.renderItemPrice = function(price, idx) {
        var text = document.createElement('span');
        var checkbox = document.createElement('input');
        var head_cell = this.thead.cells[idx];
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

    ItemGroup.prototype.renderGroupSetter = function(cell, idx) {
        var setter = document.createElement('input');
        var head_cell = this.thead.cells[idx];
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

    ItemGroup.prototype.renderItemName = function(name) {
        if(this.pk === 'item') {
            var a = document.createElement('a');
            a.innerHTML = '&#128194 ';
            a.textContent += this.child[0].item + ' (' + this.use + ')';
            a.className = this.child[0].item_useability;
            name.appendChild(a);
        } else {
            name.innerHTML = '&#128194 ' + this.child.length + ' items';
        }
    };

    ItemGroup.prototype.toggleChild = function() {
        if(this.child.length <= 1) { return false; }
        if(this.child[0].el.classList.contains('hidden_row')) {
            this.expand();
        } else {
            this.shrink();
        }
    };

    ItemGroup.prototype.createContainer = function() {
        var row = this.tbody.insertRow();
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

    ItemGroup.prototype.parseCell = function(type, idx) {
        var cell = this.row.insertCell();
        switch(type) {
            case 'index':
                this.renderDefault(cell, idx, 'right');
                break;
            case 'item':
                this.renderItemName(cell);
                break;
            case 'sell':
                this.renderItemPrice(cell, idx);
                break;
            case 'position':
                this.renderItemPosition(cell, idx);
                break;
            case 'group_item':
                this.renderGroupSetter(cell, idx);
                break;
            case 'owner':
            case 'storage_date':
            case 'drop_date':
                if(this.pk === type) {
                    this.renderDefault(cell, idx);
                }
            break;
        }
    };

    ItemGroup.prototype.render = function(table_map) {
        if(this.child.length > 1) {
            this.renderGroup(table_map);
        } else {
            this.tbody.appendChild(this.child[0].el);
        }
    };
    ItemGroup.prototype.renderGroup = function(table_map) {
        for(var i = 0; i < table_map.length; i++) {
            this.parseCell(table_map[i], i);
        }
        this.syncSelect('item_position_select');
        this.syncCheckbox('group_item_checkbox');
        this.syncCheckbox('sell_checkbox');
        this.child.reverse();
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
    function indexOf(obj, value) {
        var tmp = Object.entries(LANGUAGE);
        var idx = tmp.findIndex(function(pair){
            return pair[1] === value;
        });
        if(idx > 0) {
            return tmp[idx][0];
        } else {
            return '';
        }
    }

    function init() {
        var table = findTable();
        if(!(table && table.tHead && table.tBodies[0].rows.length > 1)) { return false; }

        function parseRow(item_db, table) {
            var row = table.tBodies[0].rows[0];
            var item = new Item(row, table_map);
            if(!item_db[item[group_by]]) {
                item_db[item[group_by]] = new ItemGroup(table, group_by);
            }
            item_db[item[group_by]].add(item);
        }

        function parseTableIndex() {
            var arr =  [];
            function parseCell(head_cell) {
                var btn, title = (btn = head_cell.querySelector('input[type="submit"]')) ? btn.value : head_cell.textContent;
                title = chomp(title);
                return indexOf(LANGUAGE, title).toLowerCase();
            }
            for(var i = 0; i < head.children.length; i++) {
                arr.push(parseCell(head.children[i]));
            }
            arr[0] = 'index';
            return arr;
        }

        function parseTable(table) {
            var item_db = {};
            var tbody = table.tBodies[0];
            while(tbody.rows[0]) {
                parseRow(item_db, table);
                tbody.rows[0].remove();
            }
            return item_db;
        }

        function initItemGroup(item_db) {
            var index = Number(item_db[Object.keys(item_db)[0]].child[0].el.cells[0].textContent);
            for(var k in item_db) {
                if(item_db.hasOwnProperty(k)){
                    item_db[k].child.forEach((c) => (c.el.cells[0].textContent = index++));
                    item_db[k].render(table_map);
                }
            }
            for(k in item_db) {
                if(item_db.hasOwnProperty(k)){
                    item_db[k].toggleChild();
                }
            }
        }


        var head = table.tHead.rows[1];
        var table_map = parseTableIndex(head);
        var group_by = indexOf(LANGUAGE, chomp(head.querySelector('.table_hl_sorted').value)).toLowerCase();

        if(/item|owner|storage_date|drop_date/.test(group_by)) {
            addCss();
            initItemGroup(parseTable(table));
        }
    }
    init();
})();
