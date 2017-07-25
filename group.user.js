// ==UserScript==
// @name            WOD Item Group 
// @namespace       ttang.tw
// @updateURL       TODO https://raw.githubusercontent.com/xyzith/wod_item_group/master/group.user.js
// @grant           none
// @author          Taylor Tang
// @version         1.0
// @description     Add item group feature
// @include         *://*.world-of-dungeons.org/wod/spiel/hero/items.php*
// ==/UserScript==

(function(){
    var LANGUAGE = Object.freeze({
        COIN: '金币',
        ITEM: '物品',
        GROUP: '团队',
        SELL: '出售',
        POCKET: '口袋',
        POSITION: '位置',
        WAREHOUSE: '仓库',
        GROUP_WAREHOUSE2: '团队仓库',
        GROUP_WAREHOUSE: '宝库',
        STORAGE_ROOM: '贮藏室'
    });

    function addCss() {
        var style = document.createElement('style');
        document.head.appendChild(style);
        style.sheet.insertRule('.hide { display: none; }');
    }
    function chomp(str) {
        return str.replace(/[ \xA0\n\t\r]*/g, '');
    }

    function findTable() {
        function findSiblings(el) {
            var next = el.nextElementSibling;
            if(!next) { return null; };
            if(next.tagName.toLowerCase() === 'table' && next.className === 'content_table') {
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
        this.use = use ? Number(use[1]) : 1;
        this.price = price_el ? Number(price_el.textContent) : 0;
        this.sell_checkbox = price_el ? price_el.querySelector('input') : null;
        this.group_item_checkbox = this.getGroupItemCheckbox(row);
        this.item_position_select = this.getItemPositionSelect(row);
    }

    Item.prototype.getPrice = function(el) {
        var price = el.querySelector('img[title="' + LANGUAGE.COIN + '"]')
        if(price) {
            return price.parentNode;
        }
        return null;
    }

    Item.prototype.getGroupItemCheckbox = function(el) {
        return el.querySelector('input[name^="SetGrpItem"]');
    }

    Item.prototype.getItemPositionSelect = function(el) {
        return el.querySelector('select[name^="EquipItem"]');
    }

    function ItemGroup() {
        function useGetter() {
            var use = this.child.map((k) => (k['use']));
            return use.reduce((sum, value) => (sum + value));
        }
        function priceGetter() {
            var use = this.child.map((k) => (k['price']));
            return use.reduce((sum, value) => (sum + value));
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
    }

    ItemGroup.prototype.add = function(item) {
        this.child.push(item);
        this.name = item.name;
    }

    ItemGroup.prototype.renderItemPosition = function(row) {
        function newOps(txt, value) {
            var opt = document.createElement('option');
            opt.textContent = txt;
            opt.value = value;
            return opt;
            
        }
        function setValue(select, value) {
            var orig_value = select.value;
            select.value = value;
            if(!select.value) {
                select.value = orig_value;
            }
        }
        var position = row.insertCell();
        var select = document.createElement('select');

        position.style.textAlign = 'right';
        select.appendChild(newOps('-------', ''));
        select.appendChild(newOps(LANGUAGE.POCKET, 'go_tasche'));
        select.appendChild(newOps(LANGUAGE.WAREHOUSE, 'go_lager'));
        select.appendChild(newOps(LANGUAGE.GROUP_WAREHOUSE2, 'go_group_2'));
        select.appendChild(newOps(LANGUAGE.GROUP_WAREHOUSE, 'go_group'));
        select.appendChild(newOps(LANGUAGE.STORAGE_ROOM, 'go_keller'));
        select.addEventListener('change', (function(e){
            var value = e.target.options[e.target.selectedIndex].value;
            this.child.forEach(function(c){
                if(c.item_position_select) {
                    setValue(c.item_position_select, value);
                    setValue(c.item_position_select, '-' + value);
                }
            });
        }).bind(this));
        position.appendChild(select);
    }

    ItemGroup.prototype.renderItemPrice = function(row) {
        var price = row.insertCell();
        var text = document.createElement('span');
        var checkbox = document.createElement('input');
        price.style.textAlign = 'right';
        text.textContent = this.price;
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', (function(e){
            var checked = e.target.checked;
            this.child.forEach(function(c){
                if(c.sell_checkbox) {
                    c.sell_checkbox.checked = checked;
                }
            });
        }).bind(this));
        price.appendChild(text);
        price.appendChild(checkbox);
    }

    ItemGroup.prototype.renderGroupSetter = function(row) {
        var cell = row.insertCell();
        var setter = document.createElement('input');
        cell.style.textAlign = 'right';
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
    }

    ItemGroup.prototype.renderItemName = function(row) {
        var text = row.insertCell();
        text.textContent = this.name + ' (' + this.use + ')';
    }

    ItemGroup.prototype.createContainer = function() {
        var row = table.querySelector('tbody').insertRow();
        row.className = 'row0';
        row.style.cursor = 'pointer';
        row.addEventListener('click', (function(e) {
            var tag = e.target.tagName.toLowerCase();
            if(tag != 'input' && tag != 'select') {
                this.child.forEach((c) => ( c.el.classList.toggle('hide')));
            }
        }).bind(this));
        this.child.forEach( (c) => c.el.classList.add('hide'));
        return row;
    }

    ItemGroup.prototype.parseCell = function(cell, row) {
        var btn, title = (btn = cell.querySelector('input[type="submit"]')) ? btn.value : cell.textContent;

        if(title.match(LANGUAGE.GROUP)) {
            this.renderGroupSetter(row);
        } else if(title.match(LANGUAGE.SELL)) {
            this.renderItemPrice(row);
        } else if(title.match(LANGUAGE.ITEM)) {
            this.renderItemName(row);
        } else if(title.match(LANGUAGE.POSITION)) {
            this.renderItemPosition(row);
        } else {
            row.insertCell();
        }
    }

    ItemGroup.prototype.render = function(table, idx) {
        var head = table.tHead.querySelector('.header');

        if(this.child.length != 1) {
            var row = this.createContainer();
            for(var i = 0; i < head.children.length; i++) {
                this.parseCell(head.children[i], row);
            }
        }
        this.child.forEach( (c) => table.querySelector('tbody').appendChild(c.el));
        return idx;
    }

    var item_db = {};

    function parseRow(row) {
        var item = new Item(row);
        if(!item_db[item.name]) {
            item_db[item.name] = new ItemGroup();
        }
        item_db[item.name].add(item);
    }
    var table = findTable();

    addCss();
    while(Number(table.rows[2].cells[0].textContent)) {
        parseRow(table.rows[2]);
        table.rows[2].remove();
    }

    for(var k in item_db) {
        item_db[k].render(table);
    }
    console.log(item_db);
    function reIndex() {
    }
})();
