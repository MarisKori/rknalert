let background = chrome.extension.getBackgroundPage();

//------------------------ TABS ----------------

var tab; // заголовок вкладки
var tabContent; // блок содержащий контент вкладки

function hideTabsContent(a) {
    for (var i=a; i<tabContent.length; i++) {
        tabContent[i].classList.remove('show');
        tabContent[i].classList.add("hide");
        tab[i].classList.remove('whiteborder');
    }
}

function showTabsContent(b){
    if (tabContent[b].classList.contains('hide')) {
        hideTabsContent(0);
        tab[b].classList.add('whiteborder');
        tabContent[b].classList.remove('hide');
        tabContent[b].classList.add('show');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    tabContent=document.getElementsByClassName('tabContent');
    tab=document.getElementsByClassName('tab');
    hideTabsContent(1);
	
	document.getElementById('tabs').onclick= function (event) {
		var target=event.target;
		if (target.className=='tab') {
		   for (var i=0; i<tab.length; i++) {
			   if (target == tab[i]) {
				   showTabsContent(i);
				   break;
	}}}}	
});

//------------------- INTERFACE ---------------------------

let html;
function add(info) {
	html += info + "<br>\n";
}

function options_update() {
	let options = background.options_hint;
	html = '';
	if (options.db_size) add('Размер базы: ' + options.db_size);
	if (options.update_records) add('Записей в базе: ' + options.update_records);
	add('Актуальность базы: ' + background.localStorage['Antizapret_updateTime']);
	html += 'Последяя проверка: ';
	if (options.updated_date) html+=(new Date(options.updated_date-0)).toLocaleString();
	if (options.is_updating) html+='<img src="/images/loading_16.gif">';
	document.getElementById("update_date").innerHTML = html;
	if (options.update_error) document.getElementById("update_error").innerHTML = options.update_error;
	else document.getElementById("update_error").innerHTML = '';
	//select data source
	let rad = document.getElementsByName('data_source');
	for(let i = 0; i < rad.length; i++) {
		if (rad[i].value == background.localStorage['db_source']) { //select 
			rad[i].checked = true;
		}
	}
	//checkbox
	let show_updating = document.getElementsByName('show_updating')[0];
	show_updating.checked = background.localStorage.show_updating==1;
	let use_httpdns = document.getElementsByName('use_httpdns')[0];
	use_httpdns.checked = background.localStorage.use_httpdns==1;
	let check_site_is_online = document.getElementsByName('check_site_is_online')[0];
	check_site_is_online.checked = background.localStorage.check_site_is_online==1;
	//custom_provider_stub
	//let custom_provider_stub = document.getElementsByName('custom_provider_stub')[0];
	//custom_provider_stub.value = background.localStorage.custom_provider_stub;
	//domain info: blocked urls
	let blocked_domain = document.getElementById('blocked_domain');
	if (options.urls) {
		html = '<h3>Заблокированные URL для '+options.domain+'</h3>';
		for (let i=0;i<options.urls.length;i++) {
			html+='<br><a href="http://'+options.urls[i]+'">'+options.urls[i]+'</a>';
		}
		blocked_domain.innerHTML = html;
	}
	else {
		blocked_domain.innerHTML =
			'Информация появится, если зайти на сайт, где присутствуют заблокированные URL <img src="/images/circ_orange_green_16.png">';
	}
	//frequency
	document.getElementById("frequency").value = background.localStorage.update_frequency;
}

function update_now() {
	background.update_now();
}

function update_frequency(e) {
	background.change_frequency(e.target.value);
	options_update();
}

let save_custom_provider_stub;
let custom_provider_stub;
function lookup_provider_stub_input() {
	if (custom_provider_stub.value != save_custom_provider_stub) {
		save_custom_provider_stub = custom_provider_stub.value;
		background.parse_custom_provider_stub(save_custom_provider_stub);
	}
}

document.addEventListener('DOMContentLoaded', function () {
	document.getElementById("upd_button").addEventListener("click", update_now);
	let frequency = document.getElementById("frequency");
	frequency.addEventListener("change", update_frequency);
	let rad = document.getElementsByName('data_source');
	for(let i = 0; i < rad.length; i++) {
		rad[i].addEventListener('change', function(e){
			let val = e.target.value;
			background.localStorage['db_source'] = val;
		});
	}
	let show_updating = document.getElementsByName('show_updating')[0];
	show_updating.addEventListener('change', function(e) {
		background.localStorage.show_updating = e.target.checked?1:0;
		//background.updateIcon(); //jj: may be recursive??
	});
	let use_httpdns = document.getElementsByName('use_httpdns')[0];
	use_httpdns.addEventListener('change', function(e) {
		background.localStorage.use_httpdns = e.target.checked?1:0;
	});
	let check_site_is_online = document.getElementsByName('check_site_is_online')[0];
	check_site_is_online.addEventListener('change', function(e) {
		background.localStorage.check_site_is_online = e.target.checked?1:0;
	});
	custom_provider_stub = document.getElementsByName('custom_provider_stub')[0];
	custom_provider_stub.value = background.localStorage.custom_provider_stub;
	save_custom_provider_stub = custom_provider_stub.value;
	setInterval(lookup_provider_stub_input, 500);
	background.options_update_unsafe = options_update; //will recieve updated data
	options_update(); //update now (initialize)
	//modification for firefox
	/*
	if (location.href.split('://')[0] == 'moz-extension') { //FireFox
		document.getElementById("extension_link").href='https://addons.mozilla.org/en-US/firefox/addon/blocklistcheck/';
	}
	*/
})

